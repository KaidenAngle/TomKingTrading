# Tom King Trading Framework - Greeks Engine
# Real-time Greeks calculation and position risk management

from AlgorithmImports import *
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from scipy.stats import norm
import math

class GreeksEngine:
    """
    Real-time Greeks calculation engine for Tom King Trading Framework
    
    Key Features:
    - Real-time Delta, Gamma, Theta, Vega calculation
    - Portfolio Greeks aggregation  
    - Greeks-based position sizing
    - Risk limit monitoring
    - Greeks-based exit signals
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Greeks calculation cache
        self.greeks_cache = {}
        self.cache_expiry = timedelta(minutes=5)  # Cache for 5 minutes
        
        # Risk limits (Tom King specifications)
        self.RISK_LIMITS = {
            'max_portfolio_delta': 50,      # Max net delta exposure
            'max_portfolio_gamma': 5,       # Max gamma exposure
            'max_daily_theta': -500,        # Max theta decay per day
            'max_vega_exposure': 1000,      # Max vega exposure
            'delta_neutral_range': 10       # Consider delta-neutral within ±10
        }
        
        # Greeks thresholds for position management
        self.MANAGEMENT_THRESHOLDS = {
            'delta_adjustment': 0.20,       # Adjust when position delta > 20%
            'gamma_warning': 0.10,          # Warn when gamma > 10% of portfolio
            'theta_acceleration': -50,      # Alert when daily theta < -$50
            'vega_spike_threshold': 100     # Alert when vega exposure spikes
        }
        
        self.algorithm.Log("✅ GREEKS ENGINE INITIALIZED")
    
    def CalculateOptionGreeks(self, option_contract, underlying_price: float, 
                             risk_free_rate: float = 0.05) -> Dict:
        """
        Calculate Greeks for an option contract using Black-Scholes
        
        Args:
            option_contract: The option contract
            underlying_price: Current underlying price
            risk_free_rate: Risk-free rate (default 5%)
        
        Returns:
            Dictionary with all Greeks
        """
        try:
            # Check cache first
            cache_key = f"{option_contract.Symbol}_{underlying_price:.2f}"
            if cache_key in self.greeks_cache:
                cached_time, cached_greeks = self.greeks_cache[cache_key]
                if self.algorithm.Time - cached_time < self.cache_expiry:
                    return cached_greeks
            
            # Get contract details
            strike = float(option_contract.Strike)
            expiry = option_contract.Expiry
            is_call = option_contract.Right == OptionRight.Call
            
            # Calculate time to expiration in years
            time_to_expiry = (expiry - self.algorithm.Time.date()).days / 365.0
            
            # Handle very short DTE (avoid numerical issues)
            if time_to_expiry <= 0:
                time_to_expiry = 1/365.0  # Minimum 1 day
            
            # Get implied volatility or use default
            implied_vol = self._get_implied_volatility(option_contract, underlying_price)
            
            # Ensure implied volatility is not zero to avoid division by zero
            if implied_vol <= 0:
                self.algorithm.Debug(f"Warning: IV <= 0 for {option_contract.Symbol}, using 0.20")
                implied_vol = 0.20  # 20% default
            
            # Ensure strike and underlying price are positive
            if strike <= 0 or underlying_price <= 0:
                self.algorithm.Error(f"Invalid strike ({strike}) or underlying price ({underlying_price})")
                return self._get_default_greeks()
            
            # Safe calculation of d1 and d2 with division by zero protection
            sqrt_time = math.sqrt(max(time_to_expiry, 1/365.0))
            vol_sqrt_time = implied_vol * sqrt_time
            
            # Prevent division by zero in d1 calculation
            if vol_sqrt_time <= 0:
                self.algorithm.Debug(f"Warning: vol_sqrt_time <= 0, using default Greeks")
                return self._get_default_greeks()
            
            # Calculate d1 and d2 for Black-Scholes
            d1 = (math.log(underlying_price / strike) + 
                  (risk_free_rate + 0.5 * implied_vol**2) * time_to_expiry) / vol_sqrt_time
            
            d2 = d1 - vol_sqrt_time
            
            # Standard normal distribution functions
            N_d1 = norm.cdf(d1)
            N_d2 = norm.cdf(d2)
            n_d1 = norm.pdf(d1)
            
            if is_call:
                # Call option Greeks
                delta = N_d1
                theta = (-underlying_price * n_d1 * implied_vol / (2 * sqrt_time) -
                        risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * N_d2) / 365
            else:
                # Put option Greeks
                delta = N_d1 - 1
                theta = (-underlying_price * n_d1 * implied_vol / (2 * sqrt_time) +
                        risk_free_rate * strike * math.exp(-risk_free_rate * time_to_expiry) * (1 - N_d2)) / 365
            
            # Gamma and Vega are same for calls and puts (with division protection)
            if underlying_price > 0 and vol_sqrt_time > 0:
                gamma = n_d1 / (underlying_price * vol_sqrt_time)
                vega = underlying_price * n_d1 * sqrt_time / 100  # Per 1% vol change
            else:
                gamma = 0
                vega = 0
            
            # Calculate theoretical price
            if is_call:
                theoretical_price = (underlying_price * N_d1 - 
                                   strike * math.exp(-risk_free_rate * time_to_expiry) * N_d2)
            else:
                theoretical_price = (strike * math.exp(-risk_free_rate * time_to_expiry) * (1 - N_d2) -
                                   underlying_price * (1 - N_d1))
            
            greeks = {
                'delta': delta,
                'gamma': gamma,
                'theta': theta,
                'vega': vega,
                'theoretical_price': theoretical_price,
                'implied_volatility': implied_vol,
                'time_to_expiry': time_to_expiry,
                'underlying_price': underlying_price,
                'strike': strike,
                'contract_type': 'call' if is_call else 'put'
            }
            
            # Cache the result
            self.greeks_cache[cache_key] = (self.algorithm.Time, greeks)
            
            return greeks
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating Greeks for {option_contract.Symbol}: {e}")
            return self._get_default_greeks()
    
    def CalculatePositionGreeks(self, position: Dict) -> Dict:
        """
        Calculate Greeks for a position (spread, strangle, etc.)
        
        Args:
            position: Position dictionary from execution engine
        
        Returns:
            Aggregated Greeks for the position
        """
        try:
            position_greeks = {
                'net_delta': 0,
                'net_gamma': 0,
                'net_theta': 0,
                'net_vega': 0,
                'total_theoretical_value': 0
            }
            
            position_type = position.get('type')
            if not position_type:
                return position_greeks
            
            underlying = position.get('underlying')
            if not underlying or underlying not in self.algorithm.Securities:
                return position_greeks
            
            underlying_price = self.algorithm.Securities[underlying].Price
            quantity = position.get('quantity', 1)
            
            # Calculate based on position type
            if hasattr(position_type, 'value'):
                pos_type = position_type.value
            else:
                pos_type = str(position_type)
            
            if pos_type == 'PUT_SPREAD':
                position_greeks = self._calculate_spread_greeks(
                    position, underlying_price, quantity, is_put=True
                )
            elif pos_type == 'STRANGLE':
                position_greeks = self._calculate_strangle_greeks(
                    position, underlying_price, quantity
                )
            elif pos_type == 'IRON_CONDOR':
                position_greeks = self._calculate_iron_condor_greeks(
                    position, underlying_price, quantity
                )
            
            return position_greeks
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating position Greeks: {e}")
            return {'net_delta': 0, 'net_gamma': 0, 'net_theta': 0, 'net_vega': 0, 'total_theoretical_value': 0}
    
    def CalculatePortfolioGreeks(self, positions: Dict) -> Dict:
        """
        Calculate aggregated Greeks for entire portfolio
        
        Args:
            positions: Dictionary of active positions
        
        Returns:
            Portfolio Greeks summary
        """
        try:
            portfolio_greeks = {
                'total_delta': 0,
                'total_gamma': 0,
                'total_theta': 0,
                'total_vega': 0,
                'position_count': 0,
                'delta_exposure': 0,  # Dollar delta exposure
                'risk_metrics': {}
            }
            
            for position_id, position in positions.items():
                if position.get('status') == 'open':
                    pos_greeks = self.CalculatePositionGreeks(position)
                    
                    portfolio_greeks['total_delta'] += pos_greeks['net_delta']
                    portfolio_greeks['total_gamma'] += pos_greeks['net_gamma']
                    portfolio_greeks['total_theta'] += pos_greeks['net_theta']
                    portfolio_greeks['total_vega'] += pos_greeks['net_vega']
                    portfolio_greeks['position_count'] += 1
            
            # Calculate dollar delta exposure
            portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
            portfolio_greeks['delta_exposure'] = portfolio_greeks['total_delta'] * portfolio_value / 100
            
            # Calculate risk metrics
            portfolio_greeks['risk_metrics'] = self._calculate_portfolio_risk_metrics(portfolio_greeks)
            
            return portfolio_greeks
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating portfolio Greeks: {e}")
            return {'total_delta': 0, 'total_gamma': 0, 'total_theta': 0, 'total_vega': 0, 'position_count': 0}
    
    def CheckGreeksRiskLimits(self, portfolio_greeks: Dict) -> List[Dict]:
        """
        Check if portfolio Greeks exceed risk limits
        
        Args:
            portfolio_greeks: Portfolio Greeks from CalculatePortfolioGreeks
        
        Returns:
            List of risk limit violations
        """
        violations = []
        
        # Check delta limit
        if abs(portfolio_greeks['total_delta']) > self.RISK_LIMITS['max_portfolio_delta']:
            violations.append({
                'type': 'DELTA_LIMIT',
                'current': portfolio_greeks['total_delta'],
                'limit': self.RISK_LIMITS['max_portfolio_delta'],
                'severity': 'HIGH',
                'action': 'BLOCK_NEW_POSITIONS'
            })
        
        # Check gamma limit
        if abs(portfolio_greeks['total_gamma']) > self.RISK_LIMITS['max_portfolio_gamma']:
            violations.append({
                'type': 'GAMMA_LIMIT',
                'current': portfolio_greeks['total_gamma'],
                'limit': self.RISK_LIMITS['max_portfolio_gamma'],
                'severity': 'MEDIUM',
                'action': 'REDUCE_POSITION_SIZE'
            })
        
        # Check theta limit (negative theta is decay)
        if portfolio_greeks['total_theta'] < self.RISK_LIMITS['max_daily_theta']:
            violations.append({
                'type': 'THETA_LIMIT',
                'current': portfolio_greeks['total_theta'],
                'limit': self.RISK_LIMITS['max_daily_theta'],
                'severity': 'MEDIUM',
                'action': 'LIMIT_SHORT_POSITIONS'
            })
        
        # Check vega limit
        if abs(portfolio_greeks['total_vega']) > self.RISK_LIMITS['max_vega_exposure']:
            violations.append({
                'type': 'VEGA_LIMIT',
                'current': portfolio_greeks['total_vega'],
                'limit': self.RISK_LIMITS['max_vega_exposure'],
                'severity': 'LOW'
            })
        
        return violations
    
    def GetPositionAdjustmentSignals(self, position: Dict) -> List[str]:
        """
        Get Greeks-based adjustment signals for a position
        
        Args:
            position: Position to analyze
        
        Returns:
            List of adjustment recommendations
        """
        signals = []
        position_greeks = self.CalculatePositionGreeks(position)
        
        # Delta adjustment signals
        if abs(position_greeks['net_delta']) > self.MANAGEMENT_THRESHOLDS['delta_adjustment']:
            signals.append(f"HIGH_DELTA: Position delta {position_greeks['net_delta']:.2f} needs adjustment")
        
        # Theta acceleration warning
        if position_greeks['net_theta'] < self.MANAGEMENT_THRESHOLDS['theta_acceleration']:
            signals.append(f"THETA_DECAY: High theta decay ${position_greeks['net_theta']:.2f}/day")
        
        # Gamma risk warning
        if abs(position_greeks['net_gamma']) > self.MANAGEMENT_THRESHOLDS['gamma_warning']:
            signals.append(f"HIGH_GAMMA: Gamma exposure {position_greeks['net_gamma']:.3f}")
        
        return signals
    
    def _calculate_spread_greeks(self, position: Dict, underlying_price: float, 
                               quantity: int, is_put: bool = True) -> Dict:
        """Calculate Greeks for a spread position"""
        # Simplified calculation - in production would use actual option contracts
        # For now, return estimated Greeks based on position parameters
        
        short_strike = position.get('short_strike', 0)
        long_strike = position.get('long_strike', 0)
        
        if not short_strike or not long_strike:
            return {'net_delta': 0, 'net_gamma': 0, 'net_theta': 0, 'net_vega': 0, 'total_theoretical_value': 0}
        
        # Estimate delta based on moneyness
        short_delta = self._estimate_delta(underlying_price, short_strike, is_put)
        long_delta = self._estimate_delta(underlying_price, long_strike, is_put)
        
        # Net Greeks for spread (short - long)
        net_delta = (short_delta - long_delta) * quantity * -1 if is_put else 1
        net_gamma = 0.05 * quantity  # Simplified gamma estimate
        net_theta = -2.0 * quantity  # Simplified theta estimate
        net_vega = 10.0 * quantity   # Simplified vega estimate
        
        return {
            'net_delta': net_delta,
            'net_gamma': net_gamma,
            'net_theta': net_theta,
            'net_vega': net_vega,
            'total_theoretical_value': abs(short_strike - long_strike) * quantity * 100
        }
    
    def _calculate_strangle_greeks(self, position: Dict, underlying_price: float, quantity: int) -> Dict:
        """Calculate Greeks for a strangle position"""
        put_strike = position.get('put_strike', 0)
        call_strike = position.get('call_strike', 0)
        
        if not put_strike or not call_strike:
            return {'net_delta': 0, 'net_gamma': 0, 'net_theta': 0, 'net_vega': 0, 'total_theoretical_value': 0}
        
        # Estimate deltas
        put_delta = self._estimate_delta(underlying_price, put_strike, is_put=True)
        call_delta = self._estimate_delta(underlying_price, call_strike, is_put=False)
        
        # Net Greeks for short strangle
        net_delta = (put_delta + call_delta) * quantity * -1  # Short both
        net_gamma = -0.10 * quantity  # Negative gamma for short strangle
        net_theta = 3.0 * quantity    # Positive theta for short strangle
        net_vega = -15.0 * quantity   # Negative vega for short strangle
        
        return {
            'net_delta': net_delta,
            'net_gamma': net_gamma,
            'net_theta': net_theta,
            'net_vega': net_vega,
            'total_theoretical_value': (call_strike + put_strike) * quantity * 100
        }
    
    def _calculate_iron_condor_greeks(self, position: Dict, underlying_price: float, quantity: int) -> Dict:
        """Calculate Greeks for an iron condor position"""
        # Iron condor is typically delta-neutral with positive theta and negative gamma/vega
        net_delta = 0.02 * quantity   # Near delta-neutral
        net_gamma = -0.08 * quantity  # Negative gamma
        net_theta = 4.0 * quantity    # High positive theta
        net_vega = -20.0 * quantity   # Negative vega
        
        return {
            'net_delta': net_delta,
            'net_gamma': net_gamma,
            'net_theta': net_theta,
            'net_vega': net_vega,
            'total_theoretical_value': quantity * 100  # Simplified
        }
    
    def _estimate_delta(self, underlying_price: float, strike: float, is_put: bool) -> float:
        """Estimate delta based on moneyness"""
        # Safe division for moneyness calculation
        if strike > 0:
            moneyness = underlying_price / strike
        else:
            self.algorithm.Error(f"Invalid strike price {strike} in delta estimation")
            moneyness = 1.0  # Default to ATM
        
        if is_put:
            if moneyness > 1.05:    # Far OTM put
                return -0.10
            elif moneyness > 1.02:  # OTM put
                return -0.25
            elif moneyness > 0.98:  # ATM put
                return -0.50
            elif moneyness > 0.95:  # ITM put
                return -0.75
            else:                   # Deep ITM put
                return -0.90
        else:  # Call
            if moneyness < 0.95:    # Far OTM call
                return 0.10
            elif moneyness < 0.98:  # OTM call
                return 0.25
            elif moneyness < 1.02:  # ATM call
                return 0.50
            elif moneyness < 1.05:  # ITM call
                return 0.75
            else:                   # Deep ITM call
                return 0.90
    
    def _get_implied_volatility(self, option_contract, underlying_price: float) -> float:
        """Get implied volatility with sophisticated validation and fallback logic"""
        try:
            # Primary: Try to get actual IV from option contract
            if hasattr(option_contract, 'ImpliedVolatility'):
                iv = option_contract.ImpliedVolatility
                
                # Sophisticated IV validation
                if iv is not None and iv > 0:
                    # Check for reasonable IV bounds (5% to 500%)
                    if 0.05 <= iv <= 5.0:
                        # Additional validation based on moneyness and time to expiry
                        if hasattr(option_contract, 'Strike') and hasattr(option_contract, 'Expiry'):
                            strike = option_contract.Strike
                            time_to_expiry = (option_contract.Expiry - self.algorithm.Time).days / 365.0
                            
                            # Validate IV based on moneyness
                            moneyness = underlying_price / strike if strike > 0 else 1.0
                            
                            # Far OTM options should have higher IV (volatility smile)
                            if abs(moneyness - 1.0) > 0.2:  # Far OTM or ITM
                                if iv < 0.10:  # Suspiciously low IV for far OTM
                                    self.algorithm.Debug(f"IV validation: Suspiciously low IV {iv:.3f} for moneyness {moneyness:.3f}")
                                    iv = self._estimate_iv_from_moneyness(moneyness, time_to_expiry)
                            
                            # Near expiry options should have adjusted IV
                            if time_to_expiry < 0.02:  # Less than ~7 days
                                if iv > 2.0:  # Very high IV near expiry
                                    self.algorithm.Debug(f"IV validation: Capping extreme IV {iv:.3f} near expiry")
                                    iv = min(iv, 2.0)  # Cap at 200% for near expiry
                            
                            return iv
                        else:
                            # If we can't validate, use the IV if it's in reasonable bounds
                            return iv
                    else:
                        self.algorithm.Debug(f"IV validation: IV {iv:.3f} outside reasonable bounds [0.05, 5.0]")
            
            # Secondary: VIX-based estimation with adjustments
            if "VIX" in self.algorithm.Securities:
                vix = self.algorithm.Securities["VIX"].Price
                if vix and vix > 0:
                    base_iv = vix / 100.0  # Convert VIX to decimal
                    
                    # Adjust based on underlying if available
                    if hasattr(option_contract, 'Underlying'):
                        underlying_symbol = option_contract.Underlying.Value
                        
                        # Higher volatility for individual stocks vs indices
                        if underlying_symbol not in ['SPY', 'QQQ', 'IWM', 'DIA']:
                            base_iv *= 1.2  # 20% higher for individual stocks
                        
                        # Adjust for strike/moneyness if available
                        if hasattr(option_contract, 'Strike'):
                            strike = option_contract.Strike
                            moneyness = underlying_price / strike if strike > 0 else 1.0
                            
                            # Volatility smile adjustment
                            if abs(moneyness - 1.0) > 0.1:
                                smile_adjustment = 1.0 + (abs(moneyness - 1.0) * 0.3)
                                base_iv *= smile_adjustment
                    
                    return min(base_iv, 3.0)  # Cap at 300%
            
            # Tertiary: Historical volatility estimation
            if hasattr(self.algorithm, 'History'):
                try:
                    # Get 20-day historical volatility
                    history = self.algorithm.History(option_contract.Underlying, 20, Resolution.Daily)
                    if not history.empty:
                        returns = history['close'].pct_change().dropna()
                        if len(returns) > 1:
                            historical_vol = returns.std() * np.sqrt(252)  # Annualize
                            # Use historical vol with 20% risk premium
                            return min(historical_vol * 1.2, 2.0)
                except Exception as e:
                    self.algorithm.Debug(f"Historical volatility calculation failed: {str(e)}")
                    # Continue to next fallback method
            
            # Final fallback: Sophisticated default based on market conditions
            # Check if it's a high volatility period
            if hasattr(self.algorithm, 'Time'):
                # Higher default IV during market hours
                hour = self.algorithm.Time.hour
                if 9 <= hour <= 16:  # Market hours
                    return 0.25  # 25% during trading hours
                else:
                    return 0.20  # 20% after hours
            
            return 0.20  # Ultimate fallback: 20%
            
        except Exception as e:
            self.algorithm.Debug(f"IV calculation error: {str(e)}")
            return 0.20  # Safe default on any error
    
    def _estimate_iv_from_moneyness(self, moneyness: float, time_to_expiry: float) -> float:
        """Estimate IV based on moneyness and time to expiry"""
        # Base IV estimation
        if abs(moneyness - 1.0) < 0.02:  # ATM
            base_iv = 0.20
        elif abs(moneyness - 1.0) < 0.10:  # Near ATM
            base_iv = 0.25
        elif abs(moneyness - 1.0) < 0.20:  # OTM/ITM
            base_iv = 0.30
        else:  # Far OTM/ITM
            base_iv = 0.40
        
        # Adjust for time to expiry
        if time_to_expiry < 0.08:  # Less than 30 days
            base_iv *= 1.2
        elif time_to_expiry > 0.5:  # More than 6 months
            base_iv *= 0.9
        
        return min(base_iv, 2.0)  # Cap at 200%
    
    def _calculate_portfolio_risk_metrics(self, portfolio_greeks: Dict) -> Dict:
        """Calculate risk metrics from portfolio Greeks"""
        return {
            'delta_neutral': abs(portfolio_greeks['total_delta']) < self.RISK_LIMITS['delta_neutral_range'],
            'theta_per_day': portfolio_greeks['total_theta'],
            'gamma_risk_score': min(abs(portfolio_greeks['total_gamma']) / 5.0, 1.0),  # 0-1 scale
            'vega_risk_score': min(abs(portfolio_greeks['total_vega']) / 1000.0, 1.0),  # 0-1 scale
        }
    
    def _get_default_greeks(self) -> Dict:
        """Return default Greeks when calculation fails"""
        return {
            'delta': 0,
            'gamma': 0,
            'theta': 0,
            'vega': 0,
            'theoretical_price': 0,
            'implied_volatility': 0.20,
            'time_to_expiry': 0,
            'underlying_price': 0,
            'strike': 0,
            'contract_type': 'unknown'
        }
    
    def LogPortfolioGreeks(self, portfolio_greeks: Dict):
        """Log portfolio Greeks summary"""
        self.algorithm.Log("\n📊 PORTFOLIO GREEKS SUMMARY:")
        self.algorithm.Log(f"  Total Delta: {portfolio_greeks['total_delta']:.2f}")
        self.algorithm.Log(f"  Total Gamma: {portfolio_greeks['total_gamma']:.3f}")
        self.algorithm.Log(f"  Total Theta: ${portfolio_greeks['total_theta']:.2f}/day")
        self.algorithm.Log(f"  Total Vega: ${portfolio_greeks['total_vega']:.2f}/1% vol")
        self.algorithm.Log(f"  Delta Exposure: ${portfolio_greeks.get('delta_exposure', 0):.2f}")
        self.algorithm.Log(f"  Position Count: {portfolio_greeks['position_count']}")