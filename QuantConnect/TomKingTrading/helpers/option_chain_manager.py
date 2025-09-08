# region imports
from AlgorithmImports import *
from datetime import timedelta
import numpy as np
# endregion

class OptionChainManager:
    """
    Centralized option chain management for Tom King Trading System
    Handles option subscriptions, chain filtering, and Greeks calculations
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.option_subscriptions = {}
        self.cached_chains = {}
        self.last_update = {}
        
    def add_option_subscription(self, symbol_str):
        """Add option subscription for a symbol with proper configuration"""
        try:
            # Add the underlying equity if not already added
            if symbol_str not in self.algo.Securities:
                equity = self.algo.AddEquity(symbol_str, Resolution.Minute)
            
            # Add option subscription
            option = self.algo.AddOption(symbol_str, Resolution.Minute)
            
            # Configure option filter for Tom King strategies
            # 0DTE needs 0-1 day, LT112 needs 30-60 days, LEAP needs 365-730 days
            option.SetFilter(
                -20,  # 20 strikes below
                20,   # 20 strikes above
                timedelta(0),    # 0 days minimum
                timedelta(730)   # 2 years maximum
            )
            
            self.option_subscriptions[symbol_str] = option.Symbol
            self.algo.Log(f"✅ Added option subscription for {symbol_str}")
            return True
            
        except Exception as e:
            self.algo.Error(f"Failed to add option subscription for {symbol_str}: {e}")
            return False
    
    def get_option_chain(self, symbol_str, min_dte=0, max_dte=730):
        """Get filtered option chain for a symbol"""
        try:
            # Check if we have a subscription
            if symbol_str not in self.option_subscriptions:
                self.add_option_subscription(symbol_str)
            
            # Get option chain from current slice
            if hasattr(self.algo, 'CurrentSlice') and self.algo.CurrentSlice:
                option_chains = self.algo.CurrentSlice.OptionChains
                
                for kvp in option_chains:
                    chain = kvp.Value
                    underlying_symbol = chain.Underlying.Symbol.Value
                    
                    if underlying_symbol == symbol_str:
                        # Filter by DTE
                        current_date = self.algo.Time.date()
                        filtered = [
                            contract for contract in chain 
                            if min_dte <= (contract.Expiry.date() - current_date).days <= max_dte
                        ]
                        
                        # Cache the chain
                        self.cached_chains[symbol_str] = filtered
                        self.last_update[symbol_str] = self.algo.Time
                        
                        return filtered
            
            # Return cached chain if recent (within 1 minute)
            if symbol_str in self.cached_chains:
                if symbol_str in self.last_update:
                    time_diff = (self.algo.Time - self.last_update[symbol_str]).total_seconds()
                    if time_diff < 60:  # Use cache if less than 1 minute old
                        return self.cached_chains[symbol_str]
            
            self.algo.Debug(f"No option chain available for {symbol_str}")
            return []
            
        except Exception as e:
            self.algo.Error(f"Error getting option chain for {symbol_str}: {e}")
            return []
    
    def get_contracts_by_delta(self, symbol_str, target_delta, option_right, dte):
        """Find option contracts closest to target delta"""
        try:
            # Get filtered chain
            chain = self.get_option_chain(symbol_str, dte - 1, dte + 1)
            
            if not chain:
                self.algo.Debug(f"No option chain found for {symbol_str} with {dte} DTE")
                return None
            
            # Filter by option type
            filtered = [c for c in chain if c.Right == option_right]
            
            if not filtered:
                self.algo.Debug(f"No {option_right} options found for {symbol_str}")
                return None
            
            # Get underlying price
            underlying_price = float(self.algo.Securities[symbol_str].Price)
            
            # Calculate Greeks for each contract
            contracts_with_delta = []
            for contract in filtered:
                greeks = self.calculate_greeks(
                    contract, 
                    underlying_price,
                    self.algo.Time
                )
                
                if greeks and 'delta' in greeks:
                    delta_diff = abs(greeks['delta'] - target_delta)
                    contracts_with_delta.append((contract, greeks['delta'], delta_diff))
            
            # Sort by closest delta
            if contracts_with_delta:
                contracts_with_delta.sort(key=lambda x: x[2])
                return contracts_with_delta[0][0]  # Return closest contract
            
            self.algo.Debug(f"No contracts found matching target delta {target_delta} for {option_right}")
            return None
            
        except Exception as e:
            self.algo.Error(f"Error finding contracts by delta: {e}")
            return None
    
    def calculate_greeks(self, contract, underlying_price, current_time):
        """Calculate Black-Scholes Greeks for an option contract"""
        try:
            # Time to expiration in years
            time_to_expiry = (contract.Expiry - current_time).total_seconds() / (365.25 * 24 * 3600)
            
            # Prevent division by zero for expired options
            if time_to_expiry <= 0:
                return {
                    'delta': 0,
                    'gamma': 0,
                    'vega': 0,
                    'theta': 0,
                    'rho': 0
                }
            
            # Get risk-free rate (simplified - use 5%)
            risk_free_rate = 0.05
            
            # Get implied volatility (use contract IV if available, else estimate)
            if hasattr(contract, 'ImpliedVolatility') and contract.ImpliedVolatility > 0:
                iv = float(contract.ImpliedVolatility)
            else:
                # Estimate IV based on moneyness and time
                moneyness = float(contract.Strike) / underlying_price
                if 0.8 < moneyness < 1.2:  # Near the money
                    iv = 0.20 + 0.1 * abs(1 - moneyness)
                else:  # Far from money
                    iv = 0.25 + 0.2 * abs(1 - moneyness)
            
            # Black-Scholes calculations
            d1 = (np.log(underlying_price / float(contract.Strike)) + 
                  (risk_free_rate + 0.5 * iv * iv) * time_to_expiry) / (iv * np.sqrt(time_to_expiry))
            d2 = d1 - iv * np.sqrt(time_to_expiry)
            
            # Standard normal CDF and PDF
            from scipy.stats import norm
            
            # Calculate Greeks based on option type
            if contract.Right == OptionRight.Call:
                delta = norm.cdf(d1)
                theta = (-underlying_price * norm.pdf(d1) * iv / (2 * np.sqrt(time_to_expiry)) -
                        risk_free_rate * float(contract.Strike) * np.exp(-risk_free_rate * time_to_expiry) * norm.cdf(d2)) / 365.25
            else:  # Put
                delta = norm.cdf(d1) - 1
                theta = (-underlying_price * norm.pdf(d1) * iv / (2 * np.sqrt(time_to_expiry)) +
                        risk_free_rate * float(contract.Strike) * np.exp(-risk_free_rate * time_to_expiry) * norm.cdf(-d2)) / 365.25
            
            # Common Greeks
            gamma = norm.pdf(d1) / (underlying_price * iv * np.sqrt(time_to_expiry))
            vega = underlying_price * norm.pdf(d1) * np.sqrt(time_to_expiry) / 100
            rho = float(contract.Strike) * time_to_expiry * np.exp(-risk_free_rate * time_to_expiry) * (
                norm.cdf(d2) if contract.Right == OptionRight.Call else -norm.cdf(-d2)) / 100
            
            return {
                'delta': abs(delta),  # Return absolute delta for easier comparison
                'gamma': gamma,
                'vega': vega,
                'theta': theta,
                'rho': rho,
                'iv': iv
            }
            
        except Exception as e:
            self.algo.Error(f"Error calculating Greeks: {e}")
            return None
    
    def get_zero_dte_chain(self, symbol_str):
        """Get 0DTE option chain for Friday trading"""
        return self.get_option_chain(symbol_str, 0, 0)
    
    def get_monthly_chain(self, symbol_str, target_dte=45):
        """Get monthly option chain for LT112 strategy"""
        return self.get_option_chain(symbol_str, target_dte - 15, target_dte + 15)
    
    def get_leap_chain(self, symbol_str):
        """Get LEAP option chain (365-730 DTE)"""
        return self.get_option_chain(symbol_str, 365, 730)
    
    def validate_option_data(self):
        """Validate that option data is being received properly"""
        validation_results = []
        
        for symbol_str in self.option_subscriptions:
            chain = self.get_option_chain(symbol_str)
            
            if chain:
                validation_results.append(f"✅ {symbol_str}: {len(chain)} contracts available")
                
                # Check different expiration ranges
                zero_dte = self.get_zero_dte_chain(symbol_str)
                monthly = self.get_monthly_chain(symbol_str)
                leaps = self.get_leap_chain(symbol_str)
                
                validation_results.append(f"  - 0DTE: {len(zero_dte)} contracts")
                validation_results.append(f"  - Monthly: {len(monthly)} contracts")
                validation_results.append(f"  - LEAPs: {len(leaps)} contracts")
            else:
                validation_results.append(f"❌ {symbol_str}: No option data available")
        
        return validation_results