# region imports
from AlgorithmImports import *
import numpy as np
from scipy.stats import norm
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from core.base_component import BaseComponent
from core.dependency_container import IManager
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
from helpers.data_freshness_validator import DataFreshnessValidator
# endregion

class GreeksMonitor(BaseComponent, IManager):
    """
    Real-time Greeks calculation and monitoring
    Essential for options risk management
    Based on Tom King Trading Framework requirements
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm)
        self.position_greeks = {}
        self.portfolio_greeks_history = []
        
        # PHASE 4 OPTIMIZATION: Use shared data_validator from ManagerFactory instead of creating duplicate
        # Prevents redundant DataFreshnessValidator instances and ensures consistency
        self.data_validator = getattr(algorithm, 'data_validator', None)
        
        # UNIFIED INTELLIGENT CACHE: High-performance Greeks caching
        # Uses GREEKS cache type for automatic position-aware invalidation
        # Greeks calculations are invalidated when positions change
        self.greeks_cache = algorithm.unified_cache
        
        # Black-Scholes calculation cache (uses same unified cache with GREEKS type)
        # Option pricing calculations automatically invalidated on market data changes
        self.bs_cache = algorithm.unified_cache
        
        # Performance optimization: Track position changes (legacy compatibility)
        self.last_position_snapshot = {}
        self.cached_portfolio_greeks = None
        self.last_greeks_calculation = None
        
        # Cache statistics tracking
        self.cache_stats_log_interval = timedelta(minutes=30 if algorithm.LiveMode else 60)
        self.last_stats_log = algorithm.Time
        
        # Tom King's Greeks thresholds
        self.alert_thresholds = {
            'delta': 100,    # Max portfolio delta
            'gamma': 20,     # Max portfolio gamma  
            'theta': -500,   # Max daily theta decay
            'vega': 1000,    # Max vega exposure
            'rho': 500       # Max rho exposure
        }
        
        # Phase-based adjustments
        self.phase_multipliers = {
            1: 0.5,   # Phase 1: Conservative
            2: 0.75,  # Phase 2: Moderate
            3: 1.0,   # Phase 3: Standard
            4: 1.25   # Phase 4: Aggressive
        }
    
    def update(self):
        """Update Greeks with advanced caching (performance optimization)"""
        try:
            # Run unified cache maintenance (handles all cache types including Greeks)
            self.greeks_cache.periodic_maintenance()
            
            # Log cache statistics periodically
            if (self.algorithm.Time - self.last_stats_log) > self.cache_stats_log_interval:
                self._log_cache_performance()
                self.last_stats_log = self.algorithm.Time
            
            # Use cached portfolio Greeks with position change detection
            cache_key = 'portfolio_greeks'
            cached_greeks = self.greeks_cache.get(
                cache_key, 
                lambda: self._calculate_portfolio_greeks_internal(),
                cache_type=CacheType.GREEKS
            )
            
            # Update legacy cached values for backward compatibility
            self.cached_portfolio_greeks = cached_greeks
            self.last_greeks_calculation = self.algorithm.Time
            
            return cached_greeks
        except Exception as e:
            self.error(f"Error updating Greeks: {e}")
            return self._get_default_portfolio_greeks()
    
    def _get_position_snapshot(self):
        """Get snapshot of current positions for change detection"""
        snapshot = {}
        for symbol, holding in self.algorithm.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Option:
                snapshot[str(symbol)] = holding.Quantity
        return snapshot
        
    def calculate_option_greeks(self, spot: float, strike: float, dte: float, 
                               iv: float, option_type: str, r: float = 0.05) -> Dict:
        """Calculate Black-Scholes Greeks for single option with caching"""
        
        if dte <= 0:
            return {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}
        
        # UNIFIED INTELLIGENT CACHE: Cache Black-Scholes calculations
        # Uses GREEKS cache type for intelligent invalidation
        cache_key = f'bs_{spot:.2f}_{strike:.2f}_{dte:.3f}_{iv:.4f}_{option_type}_{r:.4f}'
        
        cached_greeks = self.bs_cache.get(
            cache_key,
            lambda: self._calculate_black_scholes_greeks(spot, strike, dte, iv, option_type, r),
            cache_type=CacheType.GREEKS
        )
        
        return cached_greeks
    
    def _calculate_black_scholes_greeks(self, spot: float, strike: float, dte: float, 
                                      iv: float, option_type: str, r: float = 0.05) -> Dict:
        """Internal Black-Scholes calculation (cached by calculate_option_greeks)"""
        try:
            T = max(0.001, dte / 365.0)  # Minimum 0.001 to prevent zero
            sqrt_T = np.sqrt(T)
            
            # Prevent division by zero
            if iv <= 0:
                iv = 0.20  # Default 20% IV
            if sqrt_T <= 0:
                sqrt_T = 0.001  # Fallback for edge case
                
            d1 = (np.log(spot / strike) + (r + 0.5 * iv ** 2) * T) / (iv * sqrt_T)
            d2 = d1 - iv * sqrt_T
            
            # Calculate Greeks based on option type
            if option_type.upper() == 'CALL':
                delta = norm.cdf(d1)
                theta = (-spot * norm.pdf(d1) * iv / (2 * sqrt_T) 
                        - r * strike * np.exp(-r * T) * norm.cdf(d2)) / 365
                rho = strike * T * np.exp(-r * T) * norm.cdf(d2) / 100
            else:  # PUT
                delta = norm.cdf(d1) - 1
                theta = (-spot * norm.pdf(d1) * iv / (2 * sqrt_T) 
                        + r * strike * np.exp(-r * T) * norm.cdf(-d2)) / 365
                rho = -strike * T * np.exp(-r * T) * norm.cdf(-d2) / 100
                
            # Greeks same for calls and puts
            # Protect against division by zero
            if spot == 0 or iv == 0 or sqrt_T == 0:
                gamma = 0
            else:
                gamma = norm.pdf(d1) / (spot * iv * sqrt_T)
            
            vega = spot * norm.pdf(d1) * sqrt_T / TradingConstants.FULL_PERCENTAGE  # Per 1% IV change
        
            return {
                'delta': delta,
                'gamma': gamma,
                'theta': theta,
                'vega': vega,
                'rho': rho,
                'iv': iv
            }
        except Exception as e:
            self.error(f"Error calculating Black-Scholes Greeks: {e}")
            return {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0, 'iv': 0.20}
        
    def calculate_portfolio_greeks(self) -> Dict:
        """Calculate total portfolio Greeks with caching"""
        # Use cached version with position change detection
        cache_key = 'portfolio_greeks_main'
        return self.greeks_cache.get(
            cache_key,
            lambda: self._calculate_portfolio_greeks_internal(),
            cache_type=CacheType.GREEKS
        )
    
    def _calculate_portfolio_greeks_internal(self) -> Dict:
        """Internal portfolio Greeks calculation (cached by calculate_portfolio_greeks)"""
        try:
            portfolio_greeks = {
                'delta': 0,
                'gamma': 0,
                'theta': 0,
                'vega': 0,
                'rho': 0,
                'positions': [],
                'by_underlying': {},
                'by_expiry': {},
                'timestamp': self.algorithm.Time
            }
            
            # Process each position (optimized to skip non-invested)
            for symbol, holding in self.algorithm.Portfolio.items():
                if not holding.Invested or holding.Quantity == 0:
                    continue
                    
                # Handle options
                if holding.Type == SecurityType.Option:
                    option = holding.Symbol
                    underlying = option.Underlying
                    
                    # Get current data
                    if underlying not in self.algorithm.Securities:
                        continue
                        
                    spot = self.algorithm.Securities[underlying].Price
                    strike = option.ID.StrikePrice
                    expiry = option.ID.Date
                    dte = (expiry - self.algorithm.Time).days
                    
                    # Get or estimate IV
                    iv = self.get_implied_volatility(option)
                    
                    option_type = "CALL" if option.ID.OptionRight == OptionRight.Call else "PUT"
                    
                    # Calculate Greeks
                    greeks = self.calculate_option_greeks(spot, strike, dte, iv, option_type)
                    
                    # CRITICAL FIX: Handle sign conventions properly
                    # Position size already includes sign (negative for short)
                    position_size = holding.Quantity
                    
                    # Apply proper sign conventions:
                    # - Delta: Already has correct sign from Black-Scholes
                    # - Gamma: Always positive, multiply by position sign
                    # - Theta: Already negative for long, adjust for position
                    # - Vega: Positive for long, adjust for position sign
                    # - Rho: Already has correct sign from B-S
                    
                    position_greeks = {
                        'symbol': str(symbol),
                        'underlying': str(underlying),
                        'quantity': position_size,
                        'strike': strike,
                        'dte': dte,
                        'type': option_type,
                        'delta': greeks['delta'] * position_size * 100,
                        'gamma': abs(greeks['gamma']) * position_size * 100,  # Gamma * position sign
                        'theta': greeks['theta'] * abs(position_size) * 100,  # Theta sign from B-S
                        'vega': abs(greeks['vega']) * position_size * 100,    # Vega * position sign
                        'rho': greeks['rho'] * position_size * 100,
                        'iv': greeks['iv']
                    }
                    
                    # Add to portfolio totals
                    portfolio_greeks['delta'] += position_greeks['delta']
                    portfolio_greeks['gamma'] += position_greeks['gamma']
                    portfolio_greeks['theta'] += position_greeks['theta']
                    portfolio_greeks['vega'] += position_greeks['vega']
                    portfolio_greeks['rho'] += position_greeks['rho']
                    
                    portfolio_greeks['positions'].append(position_greeks)
                    
                    # Group by underlying
                    underlying_str = str(underlying)
                    if underlying_str not in portfolio_greeks['by_underlying']:
                        portfolio_greeks['by_underlying'][underlying_str] = {
                            'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0
                        }
                    portfolio_greeks['by_underlying'][underlying_str]['delta'] += position_greeks['delta']
                    portfolio_greeks['by_underlying'][underlying_str]['gamma'] += position_greeks['gamma']
                    portfolio_greeks['by_underlying'][underlying_str]['theta'] += position_greeks['theta']
                    portfolio_greeks['by_underlying'][underlying_str]['vega'] += position_greeks['vega']
                    
                    # Group by expiry
                    expiry_str = expiry.strftime('%Y-%m-%d')
                    if expiry_str not in portfolio_greeks['by_expiry']:
                        portfolio_greeks['by_expiry'][expiry_str] = {
                            'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'positions': 0
                        }
                    portfolio_greeks['by_expiry'][expiry_str]['delta'] += position_greeks['delta']
                    portfolio_greeks['by_expiry'][expiry_str]['gamma'] += position_greeks['gamma']
                    portfolio_greeks['by_expiry'][expiry_str]['theta'] += position_greeks['theta']
                    portfolio_greeks['by_expiry'][expiry_str]['vega'] += position_greeks['vega']
                    portfolio_greeks['by_expiry'][expiry_str]['positions'] += 1
                    
                # Handle stock/ETF positions (delta = 1 per share)
                elif holding.Type == SecurityType.Equity:
                    equity_delta = holding.Quantity
                    portfolio_greeks['delta'] += equity_delta
                    
                    position_info = {
                        'symbol': str(symbol),
                        'quantity': holding.Quantity,
                        'type': 'EQUITY',
                        'delta': equity_delta,
                        'gamma': 0,
                        'theta': 0,
                        'vega': 0,
                        'rho': 0
                    }
                    portfolio_greeks['positions'].append(position_info)
                
            # Store in history
            self.portfolio_greeks_history.append(portfolio_greeks.copy())
            
            return portfolio_greeks
        except Exception as e:
            self.error(f"Error calculating portfolio Greeks: {e}")
            return self._get_default_portfolio_greeks()
    
    def _log_cache_performance(self):
        """Log unified Greeks cache performance statistics"""
        try:
            # Log cache performance statistics
            if hasattr(self.algorithm, 'unified_cache'):
                stats = self.algorithm.unified_cache.get_statistics()
                self.debug(f"[GreeksMonitor] Cache hit rate: {stats.get('hit_rate', 0):.2%}")
                self.debug(f"[GreeksMonitor] Cache size: {stats.get('size', 0)} entries")
        except Exception as e:
            # Log and handle unexpected exception
            self.debug(f"[GreeksMonitor] Cache performance logging error: {e}")
    
    def get_cache_statistics(self) -> Dict:
        """Get comprehensive unified cache statistics for monitoring"""
        try:
            # Get comprehensive cache statistics
            if hasattr(self.algorithm, 'unified_cache'):
                return self.algorithm.unified_cache.get_statistics()
            else:
                return {'status': 'cache_unavailable', 'hit_rate': 0}
        except Exception as e:
            # Log and handle unexpected exception
            self.debug(f"[GreeksMonitor] Error getting cache statistics: {e}")
            return {'status': 'error', 'hit_rate': 0}
    
    def invalidate_cache(self, reason: str = "manual"):
        """Manually invalidate Greeks cache"""
        try:
            # Invalidate all GREEKS cache type entries (includes both portfolio and B-S calculations)
            greeks_count = self.greeks_cache.invalidate_by_cache_type(CacheType.GREEKS)
            self.debug(
                f"[Greeks Cache] Invalidated {greeks_count} Greeks calculations (portfolio + Black-Scholes). Reason: {reason}"
            )
        except Exception as e:
            self.error(f"[Greeks Cache] Error invalidating cache: {e}")
        
    def monitor_greeks_limits(self) -> Tuple[Dict, List[str]]:
        """Check if Greeks exceed safety thresholds"""
        
        # Validate data freshness first (with defensive programming for early initialization)
        if self.data_validator and hasattr(self.data_validator, 'check_market_conditions'):
            market_conditions = self.data_validator.check_market_conditions()
            if market_conditions and market_conditions.get('data_quality_score', 100) < 60:
                self.log(f"WARNING: Poor data quality ({market_conditions['data_quality_score']}%)")  # Use inherited method
                if market_conditions.get('issues'):
                    for issue in market_conditions['issues']:
                        self.log(f"  - {issue}")  # Use inherited method
        
        greeks = self.calculate_portfolio_greeks()
        alerts = []
        alert_levels = {}
        
        # Get phase-based multiplier
        phase = self.get_account_phase()
        multiplier = self.phase_multipliers.get(phase, 1.0)
        
        # Check each Greek against adjusted threshold
        checks = [
            ('delta', abs(greeks['delta']), self.alert_thresholds['delta'] * multiplier),
            ('gamma', abs(greeks['gamma']), self.alert_thresholds['gamma'] * multiplier),
            ('theta', greeks['theta'], self.alert_thresholds['theta'] * multiplier),
            ('vega', abs(greeks['vega']), self.alert_thresholds['vega'] * multiplier),
            ('rho', abs(greeks['rho']), self.alert_thresholds['rho'] * multiplier)
        ]
        
        for greek_name, value, threshold in checks:
            if greek_name == 'theta':
                # Theta is negative, so check if more negative than threshold
                if value < threshold:
                    severity = abs(value / threshold)
                    alert_levels[greek_name] = 'CRITICAL' if severity > 1.5 else 'WARNING'
                    alerts.append(f"{greek_name.upper()} DECAY: ${value:.2f}/day (limit: ${threshold:.2f})")
            else:
                # Other Greeks check absolute value
                if value > threshold:
                    severity = value / threshold
                    alert_levels[greek_name] = 'CRITICAL' if severity > 1.5 else 'WARNING'
                    
                    if greek_name == 'delta':
                        alerts.append(f"DELTA EXPOSURE: {value:.2f} (limit: {threshold:.0f})")
                    elif greek_name == 'gamma':
                        alerts.append(f"GAMMA RISK: {value:.2f} (limit: {threshold:.0f})")
                    elif greek_name == 'vega':
                        alerts.append(f"VEGA EXPOSURE: ${value:.2f} per 1% IV (limit: ${threshold:.0f})")
                    elif greek_name == 'rho':
                        alerts.append(f"RHO EXPOSURE: ${value:.2f} per 1% rate (limit: ${threshold:.0f})")
                        
        # Log alerts if any
        if alerts:
            self.log("=" * 60)  # Use inherited method
            self.log(f"GREEKS RISK ALERT - Phase {phase}")  # Use inherited method
            self.log("-" * 60)  # Use inherited method
            for alert in alerts:
                level = "CRITICAL" if any('CRITICAL' in str(v) for v in alert_levels.values()) else "WARNING"
                self.log(f"  [{level}] {alert}")  # Use inherited method
                
            # Log position breakdown
            self.log_position_greeks(greeks)
            
            # Suggest hedges
            hedge_suggestions = self.suggest_hedge(greeks)
            if hedge_suggestions:
                self.log("\nHEDGE SUGGESTIONS:")  # Use inherited method
                for suggestion in hedge_suggestions:
                    self.log(f"  • {suggestion}")  # Use inherited method
                    
            self.log("=" * 60)  # Use inherited method
            
            # Trigger manual mode if critical
            if len([a for a in alert_levels.values() if a == 'CRITICAL']) >= 2:
                if hasattr(self.algorithm, 'manual_mode'):
                    self.algorithm.manual_mode.activate_manual_mode(
                        f"Multiple critical Greeks limits: {', '.join(alerts[:2])}"
                    )
                    
        return greeks, alerts
        
    def suggest_hedge(self, greeks: Dict) -> List[str]:
        """Suggest hedging trades based on Greeks exposure"""
        
        suggestions = []
        
        # Delta hedge
        if abs(greeks['delta']) > 50:
            hedge_shares = -greeks['delta']
            direction = 'Buy' if hedge_shares > 0 else 'Sell'
            suggestions.append(f"Delta Hedge: {direction} {abs(hedge_shares):.0f} SPY shares (neutralize {greeks['delta']:.1f} delta)")
            
        # Gamma hedge
        if abs(greeks['gamma']) > 10:
            if greeks['gamma'] > 0:
                suggestions.append(f"Gamma Hedge: Sell ATM straddle to reduce positive gamma ({greeks['gamma']:.2f})")
            else:
                suggestions.append(f"Gamma Hedge: Buy ATM straddle to reduce negative gamma ({greeks['gamma']:.2f})")
                
        # Theta management
        if greeks['theta'] < -200:
            daily_decay = abs(greeks['theta'])
            monthly_decay = daily_decay * 30
            suggestions.append(f"Theta Alert: Losing ${daily_decay:.0f}/day (${monthly_decay:.0f}/month)")
            suggestions.append(f"Consider: Roll short options or reduce position size")
            
        # Vega hedge
        if abs(greeks['vega']) > 500:
            if greeks['vega'] > 0:
                suggestions.append(f"Vega Hedge: Short volatility - sell OTM options (long ${greeks['vega']:.0f} vega)")
            else:
                suggestions.append(f"Vega Hedge: Long volatility - buy OTM options (short ${abs(greeks['vega']):.0f} vega)")
                
        # Rho considerations
        if abs(greeks['rho']) > 300:
            direction = "rising" if greeks['rho'] > 0 else "falling"
            suggestions.append(f"Rho Alert: ${abs(greeks['rho']):.0f} exposure to {direction} rates")
            
        return suggestions
        
    def get_implied_volatility(self, option) -> float:
        """Get IV from market data or calculate from prices"""
        
        # Validate option data freshness (with defensive programming for early initialization)
        if self.data_validator and hasattr(self.data_validator, 'validate_option_contract'):
            contract_issues = self.data_validator.validate_option_contract(option)
            if contract_issues:
                self.algo.Debug(f"Option data issues for {option.Symbol}: {contract_issues[0]}")
        
        # Try QuantConnect's IV
        if hasattr(option, 'ImpliedVolatility'):
            iv = option.ImpliedVolatility
            if iv > 0 and iv < 5:  # Sanity check: IV between 0 and 500%
                return iv
                
        # Try from Greeks if available
        if hasattr(option, 'Greeks') and hasattr(option.Greeks, 'Vega'):
            # Use actual IV if available
            if hasattr(option, 'ImpliedVolatility') and option.ImpliedVolatility > 0:
                return option.ImpliedVolatility
            # Rough IV estimation from vega and price sensitivity
            return 0.20  # Conservative default when Greeks available
            
        # Calculate from option prices (simplified)
        try:
            if option.BidPrice > 0 and option.AskPrice > 0:
                mid_price = (option.BidPrice + option.AskPrice) / 2
                
                # Fallback IV estimate when QuantConnect IV unavailable
                # Uses simplified approximation for production fallback scenario
                underlying_price = self.algorithm.Securities[option.Underlying].Price
                moneyness = option.ID.StrikePrice / underlying_price
                
                # Time to expiry factor for fallback calculation
                days_to_expiry = (option.ID.Date.date() - self.algorithm.Time.date()).days
                time_factor = max(0.1, days_to_expiry / 30.0)  # 30-day normalization
                
                if 0.95 < moneyness < 1.05:  # Near ATM
                    base_iv = 0.20 + (time_factor * 0.05)
                    return min(base_iv, 0.40)  # Cap at 40%
                elif 0.85 < moneyness < 1.15:  # Slightly OTM/ITM
                    base_iv = 0.25 + (time_factor * 0.08)
                    return min(base_iv, 0.50)  # Cap at 50%
                else:  # Far OTM/ITM
                    base_iv = 0.30 + (time_factor * 0.10)
                    return min(base_iv, 0.80)  # Cap at 80%
        except Exception as e:
            self.debug(f"IV estimation error: {e}")
            
            # Conservative default IV with logging
            self.debug(f"Using default IV 20% for option {option.Symbol}")
            return 0.20
        
    def log_position_greeks(self, greeks: Dict):
        """Log detailed position Greeks breakdown"""
        
        if not greeks['positions']:
            return
            
        self.log("\nPosition Greeks Breakdown:")  # Use inherited method
        self.log("-" * 60)  # Use inherited method
        
        # Sort by absolute delta
        sorted_positions = sorted(greeks['positions'], 
                                 key=lambda x: abs(x['delta']), 
                                 reverse=True)
        
        for pos in sorted_positions[:5]:  # Top 5 positions
            if pos['type'] == 'EQUITY':
                self.log(  # Use inherited method
                    f"  {pos['symbol']:10} | Qty: {pos['quantity']:6.0f} | "
                    f"Delta: {pos['delta']:7.1f}"
                )
            else:
                self.log(  # Use inherited method
                    f"  {pos['symbol'][:20]:20} | {pos['type']:4} | "
                    f"Qty: {pos['quantity']:4.0f} | Strike: {pos['strike']:6.0f} | "
                    f"DTE: {pos['dte']:3.0f} | Delta: {pos['delta']:6.1f} | "
                    f"Gamma: {pos['gamma']:5.2f}"
                )
                
        # Log by underlying
        if greeks['by_underlying']:
            self.log("\nGreeks by Underlying:")  # Use inherited method
            for underlying, underlying_greeks in greeks['by_underlying'].items():
                self.log(  # Use inherited method
                    f"  {underlying:6} | Delta: {underlying_greeks['delta']:7.1f} | "
                    f"Gamma: {underlying_greeks['gamma']:6.2f} | "
                    f"Theta: ${underlying_greeks['theta']:7.0f}"
                )
                
        # Log by expiry
        if greeks['by_expiry']:
            self.log("\nGreeks by Expiry:")  # Use inherited method
            for expiry, expiry_greeks in sorted(greeks['by_expiry'].items()):
                self.log(  # Use inherited method
                    f"  {expiry} | Positions: {expiry_greeks['positions']:2.0f} | "
                    f"Delta: {expiry_greeks['delta']:7.1f} | "
                    f"Theta: ${expiry_greeks['theta']:7.0f}"
                )
                
    # get_account_phase() now inherited from BaseComponent
            
    def calculate_0dte_greeks(self, strike: float, option_type: str, 
                              spot: float = None) -> Dict:
        """Special Greeks calculation for 0DTE options"""
        
        if spot is None:
            spot = self.algorithm.Securities["SPY"].Price if "SPY" in self.algorithm.Securities else 450
            
        # 0DTE has special characteristics
        dte = 0.25  # Fraction of day remaining
        iv = 0.15   # Lower IV for 0DTE
        
        greeks = self.calculate_option_greeks(spot, strike, dte, iv, option_type, r=0.05)
        
        # Adjust for 0DTE characteristics
        greeks['gamma'] *= 2  # Gamma risk amplified
        greeks['theta'] *= 4  # Theta decay accelerated
        
        return greeks
        
    def get_greek_trends(self, lookback_periods: int = 20) -> Dict:
        """Analyze Greeks trends over time"""
        
        if len(self.portfolio_greeks_history) < lookback_periods:
            self.algo.Debug(f"Insufficient Greeks history for trend analysis: {len(self.portfolio_greeks_history)} < {lookback_periods}")
            return {
                'delta_trend': 'INSUFFICIENT_DATA',
                'gamma_trend': 'INSUFFICIENT_DATA', 
                'theta_trend': 'INSUFFICIENT_DATA',
                'vega_trend': 'INSUFFICIENT_DATA',
                'data_points': len(self.portfolio_greeks_history),
                'required_points': lookback_periods,
                'status': 'WARMING_UP'
            }
            
        recent = self.portfolio_greeks_history[-lookback_periods:]
        
        trends = {
            'delta_trend': 'NEUTRAL',
            'gamma_trend': 'NEUTRAL',
            'theta_trend': 'NEUTRAL',
            'vega_trend': 'NEUTRAL'
        }
        
        # Calculate trends
        for greek in ['delta', 'gamma', 'theta', 'vega']:
            values = [g[greek] for g in recent]
            if len(values) >= 2:
                change = values[-1] - values[0]
                
                if greek == 'theta':
                    # Theta getting more negative is bad
                    if change < -50:
                        trends[f'{greek}_trend'] = 'WORSENING'
                    elif change > 50:
                        trends[f'{greek}_trend'] = 'IMPROVING'
                else:
                    # Other Greeks
                    if abs(change) > 20:
                        trends[f'{greek}_trend'] = 'INCREASING' if change > 0 else 'DECREASING'
                        
        return trends
        
    def get_portfolio_greeks(self) -> Dict:
        """Get current portfolio Greeks with comprehensive risk analysis
        
        Critical method for risk monitoring - provides complete portfolio Greeks
        including position breakdown, underlying analysis, and risk metrics.
        
        Returns:
            Dict: Complete portfolio Greeks with structure:
                {
                    'delta': float, 'gamma': float, 'theta': float, 'vega': float, 'rho': float,
                    'positions': list, 'by_underlying': dict, 'by_expiry': dict,
                    'risk_analysis': dict, 'alerts': list, 'timestamp': datetime
                }
        """
        try:
            # Get base portfolio Greeks using existing cached method
            base_greeks = self.calculate_portfolio_greeks()
            
            # Add comprehensive risk analysis
            risk_analysis = {
                'delta_exposure': {
                    'level': abs(base_greeks['delta']),
                    'status': 'SAFE' if abs(base_greeks['delta']) < 50 else 
                             'WARNING' if abs(base_greeks['delta']) < 100 else 'CRITICAL',
                    'threshold': 100
                },
                'gamma_risk': {
                    'level': abs(base_greeks['gamma']),
                    'status': 'SAFE' if abs(base_greeks['gamma']) < 10 else
                             'WARNING' if abs(base_greeks['gamma']) < 20 else 'CRITICAL',
                    'threshold': 20
                },
                'theta_decay': {
                    'daily_pnl': base_greeks['theta'],
                    'monthly_pnl': base_greeks['theta'] * 30,
                    'status': 'SAFE' if base_greeks['theta'] > -200 else
                             'WARNING' if base_greeks['theta'] > -500 else 'CRITICAL',
                    'threshold': -500
                },
                'vega_exposure': {
                    'per_iv_point': abs(base_greeks['vega']),
                    'status': 'SAFE' if abs(base_greeks['vega']) < 500 else
                             'WARNING' if abs(base_greeks['vega']) < 1000 else 'CRITICAL',
                    'threshold': 1000
                }
            }
            
            # Analyze position concentration
            concentration_analysis = {
                'max_underlying_delta': 0,
                'max_expiry_positions': 0,
                'diversification_score': 0
            }
            
            if base_greeks['by_underlying']:
                # Find maximum underlying exposure
                max_delta = max(abs(u['delta']) for u in base_greeks['by_underlying'].values())
                concentration_analysis['max_underlying_delta'] = max_delta
                
                # Calculate diversification score (0-100)
                total_delta = abs(base_greeks['delta'])
                if total_delta > 0:
                    diversification_score = min(100, (1 - max_delta / total_delta) * 100)
                    concentration_analysis['diversification_score'] = diversification_score
            
            if base_greeks['by_expiry']:
                # Find maximum expiry concentration
                max_positions = max(e['positions'] for e in base_greeks['by_expiry'].values())
                concentration_analysis['max_expiry_positions'] = max_positions
            
            # Generate alerts based on risk analysis
            alerts = []
            for risk_type, risk_data in risk_analysis.items():
                if risk_data['status'] == 'CRITICAL':
                    alerts.append(f"CRITICAL: {risk_type.replace('_', ' ').title()} exceeded threshold")
                elif risk_data['status'] == 'WARNING':
                    alerts.append(f"WARNING: {risk_type.replace('_', ' ').title()} approaching threshold")
            
            # Check concentration risks
            if concentration_analysis['diversification_score'] < 30:
                alerts.append("WARNING: Poor diversification - concentrated in single underlying")
            if concentration_analysis['max_expiry_positions'] > 5:
                alerts.append("WARNING: High concentration in single expiry")
            
            # Combine all data
            enhanced_greeks = base_greeks.copy()
            enhanced_greeks.update({
                'risk_analysis': risk_analysis,
                'concentration_analysis': concentration_analysis,
                'alerts': alerts,
                'overall_risk_score': self._calculate_overall_risk_score(risk_analysis),
                'cache_performance': self.get_cache_statistics()
            })
            
            return enhanced_greeks
        except Exception as e:
            self.error(f"[GreeksMonitor] Error getting portfolio greeks: {e}")
            # Return safe fallback
            return {
                'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0,
                'positions': [], 'by_underlying': {}, 'by_expiry': {},
                'risk_analysis': {}, 'alerts': [f"Error calculating greeks: {e}"],
                'timestamp': self.algorithm.Time, 'error': str(e)
            }
    
    def calculate_position_greeks(self, position_data: Dict) -> Dict:
        """Calculate Greeks for a specific position
        
        Essential method for position-level risk analysis - calculates Greeks
        for individual positions or proposed trades.
        
        Args:
            position_data: Dict with position information:
                          {
                              'symbol': str,
                              'quantity': int, 
                              'underlying_price': float,
                              'strike': float,
                              'expiry': datetime,
                              'option_type': str ('CALL' or 'PUT'),
                              'implied_volatility': float (optional)
                          }
        
        Returns:
            Dict: Position Greeks with structure:
                {
                    'delta': float, 'gamma': float, 'theta': float, 'vega': float, 'rho': float,
                    'notional_delta': float, 'risk_metrics': dict, 'warnings': list
                }
        """
        try:
            # Validate required fields
            required_fields = ['symbol', 'quantity', 'underlying_price', 'strike', 'expiry', 'option_type']
            missing_fields = [field for field in required_fields if field not in position_data]
            
            if missing_fields:
                error_msg = f"Missing required fields: {missing_fields}"
                self.error(f"[GreeksMonitor] {error_msg}")
                return {'error': error_msg}
            
            # Extract position data
            symbol = position_data['symbol']
            quantity = position_data['quantity']
            spot = position_data['underlying_price']
            strike = position_data['strike']
            expiry = position_data['expiry']
            option_type = position_data['option_type'].upper()
            
            # Calculate days to expiry
            if isinstance(expiry, str):
                from datetime import datetime
                expiry = datetime.strptime(expiry, '%Y-%m-%d')
            
            dte = (expiry - self.algorithm.Time).days
            if dte < 0:
                dte = 0  # Expired option
            
            # Get or estimate implied volatility
            if 'implied_volatility' in position_data and position_data['implied_volatility'] > 0:
                iv = position_data['implied_volatility']
            else:
                # Estimate IV based on moneyness and DTE
                moneyness = strike / spot if spot > 0 else 1.0
                if 0.95 < moneyness < 1.05:  # ATM
                    iv = 0.20 + (dte / 365) * 0.05
                elif 0.85 < moneyness < 1.15:  # Slightly OTM/ITM
                    iv = 0.25 + (dte / 365) * 0.08
                else:  # Far OTM/ITM
                    iv = 0.30 + (dte / 365) * 0.10
                iv = min(iv, 0.80)  # Cap at 80%
            
            # Calculate base Greeks using Black-Scholes
            base_greeks = self.calculate_option_greeks(spot, strike, dte, iv, option_type)
            
            # Scale by position size (quantity already includes sign for short positions)
            position_greeks = {
                'delta': base_greeks['delta'] * quantity * 100,  # Per share delta
                'gamma': abs(base_greeks['gamma']) * quantity * 100,  # Gamma exposure
                'theta': base_greeks['theta'] * abs(quantity) * 100,  # Daily theta
                'vega': abs(base_greeks['vega']) * quantity * 100,  # Vega exposure  
                'rho': base_greeks['rho'] * quantity * 100,  # Rho exposure
                'iv': iv
            }
            
            # Calculate additional risk metrics
            notional_value = abs(quantity) * spot * 100  # Notional exposure
            position_greeks['notional_delta'] = position_greeks['delta'] / 100  # Equivalent shares
            
            risk_metrics = {
                'notional_value': notional_value,
                'delta_as_pct_notional': abs(position_greeks['delta']) / notional_value * 100 if notional_value > 0 else 0,
                'gamma_dollars_per_point': position_greeks['gamma'],  # $ per 1-point move
                'theta_dollars_per_day': position_greeks['theta'],  # $ decay per day
                'vega_dollars_per_iv_point': position_greeks['vega'],  # $ per 1% IV move
                'moneyness': strike / spot if spot > 0 else 1.0,
                'time_to_expiry_days': dte,
                'annualized_theta': position_greeks['theta'] * 365,  # Annualized theta
            }
            
            # Generate warnings based on risk thresholds
            warnings = []
            
            # Delta warnings
            if abs(position_greeks['delta']) > 500:
                warnings.append(f"High delta exposure: {position_greeks['delta']:.0f}")
            
            # Gamma warnings
            if abs(position_greeks['gamma']) > 100:
                warnings.append(f"High gamma exposure: {position_greeks['gamma']:.2f}")
            
            # Theta warnings
            if position_greeks['theta'] < -100:
                daily_loss = abs(position_greeks['theta'])
                warnings.append(f"High theta decay: ${daily_loss:.0f}/day")
            
            # DTE warnings
            if dte <= 7:
                warnings.append(f"Near expiry: {dte} days remaining")
            
            # Moneyness warnings
            if risk_metrics['moneyness'] < 0.80 or risk_metrics['moneyness'] > 1.20:
                warnings.append(f"Far from money: {risk_metrics['moneyness']:.2f} moneyness")
            
            # Combine all results
            result = position_greeks.copy()
            result.update({
                'risk_metrics': risk_metrics,
                'warnings': warnings,
                'position_info': {
                    'symbol': symbol,
                    'quantity': quantity,
                    'strike': strike,
                    'expiry': str(expiry.date()),
                    'option_type': option_type,
                    'underlying_price': spot
                },
                'calculation_timestamp': self.algorithm.Time
            })
            
            return result
        except Exception as e:
            self.error(f"[GreeksMonitor] Error calculating position greeks: {e}")
            return {
                'error': str(e),
                'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0,
                'warnings': [f"Calculation failed: {e}"]
            }
    
    def _calculate_overall_risk_score(self, risk_analysis: Dict) -> int:
        """Calculate overall risk score from 0-100"""
        try:
            score = 0
            for risk_data in risk_analysis.values():
                if risk_data['status'] == 'CRITICAL':
                    score += 30
                elif risk_data['status'] == 'WARNING':
                    score += 15
                elif risk_data['status'] == 'SAFE':
                    score += 5
            
            return min(100, score)
        except (KeyError, AttributeError, ZeroDivisionError) as e:
            # Handle missing risk data, attributes, or division by zero in risk calculations
            return 50  # Default moderate risk

    def get_statistics(self) -> Dict:
        """Get Greeks monitoring statistics including cache performance"""
        
        current_greeks = self.calculate_portfolio_greeks()
        
        stats = {
            'current_delta': current_greeks['delta'],
            'current_gamma': current_greeks['gamma'],
            'current_theta': current_greeks['theta'],
            'current_vega': current_greeks['vega'],
            'current_rho': current_greeks['rho'],
            'position_count': len(current_greeks['positions']),
            'underlying_count': len(current_greeks['by_underlying']),
            'expiry_count': len(current_greeks['by_expiry']),
            'history_length': len(self.portfolio_greeks_history)
        }
        
        # Add cache performance statistics
        cache_stats = self.get_cache_statistics()
        if cache_stats:
            stats['cache_performance'] = cache_stats
        
        # Add trends if available
        trends = self.get_greek_trends()
        if trends:
            stats.update(trends)
            
        return stats
    
    # IManager Interface Implementation
    
    def handle_event(self, event) -> bool:
        """Handle incoming events from the event bus"""
        # GreeksMonitor can respond to position updates, VIX changes, etc.
        return True  # Always succeeds - Greeks monitor is read-only
    
    def get_dependencies(self) -> List[str]:
        """Return list of manager names this manager depends on"""
        return []  # No dependencies - Greeks monitor is self-contained
    
    def can_initialize_without_dependencies(self) -> bool:
        """Return True if this manager can initialize before its dependencies are ready"""
        return True  # Greeks monitor can start immediately
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "greeks_monitor"
    
    def _get_default_portfolio_greeks(self) -> Dict:
        """Return default portfolio Greeks for error cases"""
        return {
            'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0,
            'positions': [], 'by_underlying': {}, 'by_expiry': {},
            'timestamp': self.algorithm.Time
        }