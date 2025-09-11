# region imports
from AlgorithmImports import *
from datetime import timedelta
from core.performance_cache import HighPerformanceCache, MarketDataCache
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
        
        # PRODUCTION CACHING: High-performance option chain caching
        self.chain_cache = MarketDataCache(
            algorithm,
            max_size=200,  # Cache up to 200 different chain queries
            ttl_minutes=5,  # 5-minute TTL for option chains
            max_memory_mb=30,  # Limit memory usage for chain data
            enable_stats=True,
            price_change_threshold=0.005  # 0.5% price change invalidation
        )
        
        # Greeks calculation cache for option contracts
        self.greeks_cache = HighPerformanceCache(
            algorithm,
            max_size=1500,  # Cache more individual contract Greeks
            ttl_minutes=2 if algorithm.LiveMode else 4,  # Shorter TTL for live
            max_memory_mb=20,
            enable_stats=True
        )
        
        # Legacy cache for backward compatibility
        self.cached_chains = {}
        self.last_update = {}
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=60)  # Log hourly
        self.last_cache_stats_log = algorithm.Time
        
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
            self.algo.Log(f"[WARNING] Added option subscription for {symbol_str}")
            return True
            
        except Exception as e:
            self.algo.Error(f"Failed to add option subscription for {symbol_str}: {e}")
            return False
    
    def get_option_chain(self, symbol_str, min_dte=0, max_dte=730):
        """Get filtered option chain with production-grade caching"""
        try:
            # Run periodic cache maintenance
            self._run_cache_maintenance()
            
            # Create cache key for this specific request
            cache_key = f'chain_{symbol_str}_{min_dte}_{max_dte}'
            
            # Try to get from cache first
            cached_chain = self.chain_cache.get(
                cache_key,
                lambda: self._fetch_option_chain_internal(symbol_str, min_dte, max_dte)
            )
            
            # Update legacy cache for backward compatibility
            if cached_chain:
                self.cached_chains[symbol_str] = cached_chain
                self.last_update[symbol_str] = self.algo.Time
            
            return cached_chain if cached_chain else []
            
        except Exception as e:
            self.algo.Error(f"Error getting option chain for {symbol_str}: {e}")
            return []
    
    def _fetch_option_chain_internal(self, symbol_str, min_dte, max_dte):
        """Internal method to fetch option chain from QuantConnect API"""
        # Check if we have a subscription
        if symbol_str not in self.option_subscriptions:
            if not self.add_option_subscription(symbol_str):
                return []
        
        # Get option chain from current slice
        if hasattr(self.algo, 'CurrentSlice') and self.algo.CurrentSlice:
            option_chains = self.algo.CurrentSlice.OptionChains
            
            for kvp in option_chains:
                chain = kvp.Value
                underlying_symbol = chain.Underlying.Symbol.Value
                
                if underlying_symbol == symbol_str:
                    # Filter by DTE efficiently
                    current_date = self.algo.Time.date()
                    filtered = []
                    
                    for contract in chain:
                        days_to_expiry = (contract.Expiry.date() - current_date).days
                        if min_dte <= days_to_expiry <= max_dte:
                            filtered.append(contract)
                    
                    return filtered
        
        # Fallback to legacy cache if API fails
        if symbol_str in self.cached_chains:
            if symbol_str in self.last_update:
                time_diff = (self.algo.Time - self.last_update[symbol_str]).total_seconds()
                if time_diff < 300:  # Use cache if less than 5 minutes old
                    self.algo.Debug(f"[Option Chain] Using fallback cache for {symbol_str}")
                    return self.cached_chains[symbol_str]
        
        self.algo.Debug(f"No option chain available for {symbol_str}")
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
        """Calculate Black-Scholes Greeks with caching"""
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
            
            # Create cache key for this Greeks calculation
            cache_key = f'greeks_{contract.Strike}_{time_to_expiry:.6f}_{underlying_price:.2f}_{contract.Right}'
            
            # Try to get cached Greeks
            cached_greeks = self.greeks_cache.get(
                cache_key,
                lambda: self._calculate_greeks_internal(contract, underlying_price, time_to_expiry)
            )
            
            return cached_greeks if cached_greeks else self._get_default_greeks()
            
        except Exception as e:
            self.algo.Error(f"Error calculating Greeks: {e}")
            return self._get_default_greeks()
    
    def _calculate_greeks_internal(self, contract, underlying_price, time_to_expiry):
        """Internal Greeks calculation method (cached by calculate_greeks)"""
        try:
            
            # Use standard risk-free rate (5% approximation)
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
            self.algo.Debug(f"Internal Greeks calculation error: {e}")
            return None
    
    def _get_default_greeks(self):
        """Return default Greeks values for error cases"""
        return {
            'delta': 0,
            'gamma': 0,
            'vega': 0,
            'theta': 0,
            'rho': 0,
            'iv': 0.20
        }
    
    def _run_cache_maintenance(self):
        """Run periodic cache maintenance and statistics"""
        current_time = self.algo.Time
        
        # Run cache maintenance
        self.chain_cache.periodic_maintenance()
        self.greeks_cache.periodic_maintenance()
        
        # Log statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_statistics()
            self.last_cache_stats_log = current_time
    
    def _log_cache_statistics(self):
        """Log cache performance statistics"""
        try:
            chain_stats = self.chain_cache.get_statistics()
            greeks_stats = self.greeks_cache.get_statistics()
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[Option Chain Cache] Chain Hit Rate: {chain_stats['hit_rate']:.1%} | "
                    f"Greeks Hit Rate: {greeks_stats['hit_rate']:.1%} | "
                    f"Chain Size: {chain_stats['cache_size']}/{chain_stats['max_size']} | "
                    f"Greeks Size: {greeks_stats['cache_size']}/{greeks_stats['max_size']} | "
                    f"Total Memory: {chain_stats['memory_usage_mb'] + greeks_stats['memory_usage_mb']:.1f}MB"
                )
            
            # Performance warnings
            if chain_stats['hit_rate'] < 0.4:  # Less than 40% hit rate for chains
                self.algo.Log(f"[Performance Warning] Option chain cache hit rate low: {chain_stats['hit_rate']:.1%}")
                
        except Exception as e:
            self.algo.Debug(f"[Option Chain Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> dict:
        """Get comprehensive cache statistics"""
        try:
            return {
                'chain_cache': self.chain_cache.get_statistics(),
                'greeks_cache': self.greeks_cache.get_statistics(),
                'total_memory_mb': (
                    self.chain_cache.get_statistics()['memory_usage_mb'] +
                    self.greeks_cache.get_statistics()['memory_usage_mb']
                )
            }
        except Exception as e:
            self.algo.Error(f"[Option Chain Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_chain_cache(self, symbol_str: str = None, reason: str = "manual"):
        """Invalidate option chain cache"""
        try:
            if symbol_str:
                # Invalidate specific symbol
                count = self.chain_cache.invalidate_pattern(f'chain_{symbol_str}')
                self.algo.Debug(f"[Option Chain Cache] Invalidated {count} entries for {symbol_str}. Reason: {reason}")
            else:
                # Invalidate all
                count = self.chain_cache.invalidate_all()
                self.algo.Debug(f"[Option Chain Cache] Invalidated all {count} entries. Reason: {reason}")
                
        except Exception as e:
            self.algo.Error(f"[Option Chain Cache] Error invalidating cache: {e}")
    
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
                validation_results.append(f"[Option Chain] {symbol_str}: {len(chain)} contracts available")
                
                # Check different expiration ranges
                zero_dte = self.get_zero_dte_chain(symbol_str)
                monthly = self.get_monthly_chain(symbol_str)
                leaps = self.get_leap_chain(symbol_str)
                
                validation_results.append(f"  - 0DTE: {len(zero_dte)} contracts")
                validation_results.append(f"  - Monthly: {len(monthly)} contracts")
                validation_results.append(f"  - LEAPs: {len(leaps)} contracts")
                
                # Add cache performance info
                cache_stats = self.get_cache_statistics()
                if cache_stats:
                    validation_results.append(
                        f"  - Cache Performance: Chain {cache_stats['chain_cache']['hit_rate']:.1%} | "
                        f"Greeks {cache_stats['greeks_cache']['hit_rate']:.1%}"
                    )
            else:
                validation_results.append(f"[Option Chain] {symbol_str}: No option data available")
        
        return validation_results