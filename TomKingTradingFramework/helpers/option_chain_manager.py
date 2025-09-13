# region imports
from AlgorithmImports import *
from datetime import timedelta
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
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
        
        # UNIFIED INTELLIGENT CACHE: High-performance option chain caching
        # Uses MARKET_DATA cache type for automatic price change invalidation
        self.chain_cache = algorithm.unified_cache
        
        # FIXED: Use dependency container to prevent circular dependencies
        self.greeks_monitor = None  # Will be lazy loaded via dependency container
        
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
            if symbol_str not in self.algo.Securities:
                equity = self.algo.AddEquity(symbol_str, Resolution.Minute)
        except Exception as e:
            # Add the underlying equity if not already added
            pass
            
            # Add option subscription
            option = self.algo.AddOption(symbol_str, Resolution.Minute)
            
            # Configure option filter for Tom King strategies
            # 0DTE needs 0-1 day, LT112 needs 30-60 days, LEAP needs TradingConstants.CALENDAR_DAYS_PER_YEAR-730 days
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
            
            # Try to get from cache first using MARKET_DATA type
            cached_chain = self.chain_cache.get(
                cache_key,
                lambda: self._fetch_option_chain_internal(symbol_str, min_dte, max_dte),
                cache_type=CacheType.MARKET_DATA
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
            dte = (contract.Expiry - current_time).total_seconds() / (24 * 3600)  # 3600 seconds per hour
            
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
            
            # FIXED: Use lazy loaded GreeksMonitor to prevent circular dependencies
            greeks_monitor = self._get_greeks_monitor()
            if greeks_monitor:
                greeks = greeks_monitor.calculate_option_greeks(
                    spot=underlying_price,
                    strike=float(contract.Strike),
                    dte=dte,
                    iv=iv,
                    option_type=option_type
                )
            else:
                greeks = self._get_default_greeks()
            
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
        
        # Run unified cache maintenance (handles all cache types)
        self.chain_cache.periodic_maintenance()
        
        # Log statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_statistics()
            self.last_cache_stats_log = current_time
    
    def _log_cache_statistics(self):
        """Log unified cache performance statistics"""
        try:
            unified_stats = self.chain_cache.get_statistics()
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[Option Chain Cache] Unified Hit Rate: {unified_stats['hit_rate']:.1%} | "
                    f"Size: {unified_stats['cache_size']}/{unified_stats['max_size']} | "
                    f"Memory: {unified_stats['memory_usage_mb']:.1f}MB | "
                    f"Market-Data: {unified_stats.get('market_data_entries', 0)} | "
                    f"Greeks: {unified_stats.get('greeks_entries', 0)}"
                )
            
            # Performance warnings
            if unified_stats['hit_rate'] < 0.4:  # Less than 40% hit rate for chains
                self.algo.Log(f"[Performance Warning] Option chain cache hit rate low: {unified_stats['hit_rate']:.1%}")
                
        except Exception as e:
            self.algo.Debug(f"[Option Chain Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> dict:
        """Get comprehensive unified cache statistics"""
        try:
            unified_stats = self.chain_cache.get_statistics()
            return {
                'unified_cache': unified_stats,
                'option_chain_specific': {
                    'market_data_entries': unified_stats.get('market_data_entries', 0),
                    'greeks_entries': unified_stats.get('greeks_entries', 0)
                },
                'total_memory_mb': unified_stats['memory_usage_mb']
            }
        except Exception as e:
            self.algo.Error(f"[Option Chain Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_chain_cache(self, symbol_str: str = None, reason: str = "manual"):
        """Invalidate option chain cache"""
        try:
            if symbol_str:
                # Invalidate specific symbol patterns in MARKET_DATA cache type
                count = self.chain_cache.invalidate_pattern(f'chain_{symbol_str}')
                self.algo.Debug(f"[Option Chain Cache] Invalidated {count} entries for {symbol_str}. Reason: {reason}")
            else:
                # Invalidate all MARKET_DATA cache type entries
                count = self.chain_cache.invalidate_by_cache_type(CacheType.MARKET_DATA)
                self.algo.Debug(f"[Option Chain Cache] Invalidated all {count} market data entries. Reason: {reason}")
                
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
                        f"  - Cache Performance: Unified {cache_stats['unified_cache']['hit_rate']:.1%} | "
                        f"Market-Data: {cache_stats['option_chain_specific']['market_data_entries']} | "
                        f"Greeks: {cache_stats['option_chain_specific']['greeks_entries']}"
                    )
            else:
                validation_results.append(f"[Option Chain] {symbol_str}: No option data available")
        
        return validation_results
    
    def _get_greeks_monitor(self):
        """FIXED: Lazy load greeks monitor through dependency container to prevent circular dependencies"""
        if self.greeks_monitor is None:
            if hasattr(self.algo, 'dependency_container'):
                self.greeks_monitor = self.algo.dependency_container.get_manager('greeks_monitor')
            if self.greeks_monitor is None:
                # Fallback for direct instantiation if container not available
                from greeks.greeks_monitor import GreeksMonitor
                self.greeks_monitor = GreeksMonitor(self.algo)
        return self.greeks_monitor
    
    def integrate_with_existing_cache_system(self):
        """
        FIXED: Integration with existing OptionChainCache system via dependency container
        
        Instead of duplicating functionality or creating circular dependencies,
        integrate through the dependency container system.
        """
        try:
            if hasattr(self.algo, 'dependency_container'):
                self.external_chain_cache = self.algo.dependency_container.get_lazy_proxy('option_cache_manager')
            else:
                # Fallback for systems without dependency container
                self.external_chain_cache = None
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