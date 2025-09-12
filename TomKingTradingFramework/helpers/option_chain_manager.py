# region imports
from AlgorithmImports import *
from datetime import timedelta
from core.performance_cache import HighPerformanceCache, MarketDataCache
import numpy as np
from greeks.greeks_monitor import GreeksMonitor
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
        
        # FIXED: Use centralized GreeksMonitor instead of duplicate implementation
        self.greeks_monitor = GreeksMonitor(algorithm)
        
        # Legacy cache for backward compatibility
        self.cached_chains = {}
        self.last_update = {}
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=60)  # Log hourly
        self.last_cache_stats_log = algorithm.Time
        
        # CORRECTED: Integrate with existing OptionChainCache system instead of duplicating
        self.integrate_with_existing_cache_system()
        
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
        """FIXED: Delegate to centralized GreeksMonitor instead of duplicating Black-Scholes"""
        try:
            # Time to expiration in days
            dte = (contract.Expiry - current_time).total_seconds() / (24 * 3600)
            
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
            
            # Determine option type string
            option_type = 'CALL' if contract.Right == OptionRight.Call else 'PUT'
            
            # FIXED: Delegate to centralized GreeksMonitor
            greeks = self.greeks_monitor.calculate_option_greeks(
                spot=underlying_price,
                strike=float(contract.Strike),
                dte=dte,
                iv=iv,
                option_type=option_type
            )
            
            # Add implied volatility for backward compatibility
            greeks['iv'] = iv
            
            return greeks
            
        except Exception as e:
            self.algo.Error(f"Error calculating Greeks: {e}")
            return self._get_default_greeks()
    
    # REMOVED: Redundant Black-Scholes calculation - now delegates to centralized GreeksMonitor
    
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
    
    def integrate_with_existing_cache_system(self):
        """
        CORRECTED APPROACH: Integration with existing OptionChainCache system
        
        Instead of duplicating functionality, integrate with the existing
        high-performance option chain caching system in optimization/option_chain_cache.py
        """
        try:
            from optimization.option_chain_cache import OptionChainCache
            
            # Initialize integration with existing cache system
            self.external_chain_cache = OptionChainCache(
                self.algo,
                cache_ttl_minutes=5,  # Match existing system TTL
                max_cache_size=200    # Match existing system size
            )
            
            self.algo.Debug("[Option Chain Manager] Successfully integrated with existing OptionChainCache system")
            
        except ImportError as e:
            self.algo.Error(f"[Option Chain Manager] Could not integrate with existing cache system: {e}")
            # Fallback to current caching system
        except Exception as e:
            self.algo.Error(f"[Option Chain Manager] Cache integration error: {e}")
    
    def validate_chain_quality(self, symbol_str: str) -> dict:
        """
        STREAMLINED: Essential option chain quality validation without redundancy
        
        Validates core quality metrics needed for position opening decisions:
        - Chain availability and basic completeness
        - Integration with existing cache performance metrics
        """
        try:
            # Get chain using existing cache system if available
            if hasattr(self, 'external_chain_cache'):
                chain = self.external_chain_cache.get_option_chain(
                    symbol_str,
                    min_expiry=0, 
                    max_expiry=60
                )
            else:
                chain = self.get_option_chain(symbol_str)
            
            validation_result = {
                'symbol': symbol_str,
                'timestamp': self.algo.Time,
                'has_chain_data': len(chain) > 0 if chain else False,
                'contract_count': len(chain) if chain else 0,
                'is_adequate': False
            }
            
            if chain and len(chain) >= 10:  # Minimum viable chain
                validation_result['is_adequate'] = True
                
            # Log essential metrics only
            status = "ADEQUATE" if validation_result['is_adequate'] else "INSUFFICIENT"
            self.algo.Debug(f"[Chain Quality] {symbol_str}: {status} ({validation_result['contract_count']} contracts)")
            
            return validation_result
            
        except Exception as e:
            self.algo.Error(f"[Chain Quality] Error validating {symbol_str}: {e}")
            return {
                'symbol': symbol_str,
                'timestamp': self.algo.Time,
                'has_chain_data': False,
                'contract_count': 0,
                'is_adequate': False,
                'error': str(e)
            }