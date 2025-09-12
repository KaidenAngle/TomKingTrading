# SPY/ES Concentration Manager - Prevents multiple strategies from exceeding position limits
# Critical for preventing over-exposure to S&P 500 index

from AlgorithmImports import *
from typing import Dict, List, Optional, Tuple
from config.constants import TradingConstants
from core.performance_cache import PositionAwareCache
from datetime import timedelta

class SPYConcentrationManager:
    """
    Manages concentration limits for SPY/ES/MES positions across all strategies.
    Prevents multiple strategies from creating excessive S&P 500 exposure.
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Track SPY-correlated positions by strategy
        self.spy_positions = {}  # strategy_name -> position details
        self.es_positions = {}   # futures positions
        self.option_positions = {}  # SPY options
        
        # PRODUCTION CACHING: Position-aware caching for concentration calculations
        self.concentration_cache = PositionAwareCache(
            algorithm,
            max_size=200,  # Cache concentration calculations
            ttl_minutes=1 if algorithm.LiveMode else 3,  # Short TTL for position-sensitive data
            max_memory_mb=10,  # Small memory footprint
            enable_stats=True
        )
        
        # Price cache for SPY and related instruments
        self.price_cache = PositionAwareCache(
            algorithm,
            max_size=50,
            ttl_minutes=0.5 if algorithm.LiveMode else 2,  # Very short TTL for prices
            max_memory_mb=5,
            enable_stats=True
        )
        
        # Maximum exposure limits (Tom King methodology)
        self.max_spy_delta = 100  # Maximum net delta exposure to SPY
        self.max_notional = None  # Will be set based on account size
        self.max_strategies_per_underlying = 2  # Max strategies on same underlying
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=30 if algorithm.LiveMode else 60)
        self.last_cache_stats_log = algorithm.Time
        
        # S&P 500 equivalent calculations
        # SPY = 1/10th of S&P 500 index
        # ES = 50x multiplier ($50 per point)
        # MES = 5x multiplier ($5 per point)
        self.multipliers = {
            'SPY': 1,
            'ES': 50,
            'MES': 5,
            'SPX': 10  # SPX index options
        }
        
    def request_spy_allocation(self, strategy_name: str, 
                              position_type: str,
                              requested_delta: float,
                              requested_contracts: int = 0) -> Tuple[bool, str]:
        """
        Request allocation for SPY/ES position with caching.
        
        Args:
            strategy_name: Name of requesting strategy
            position_type: 'options', 'futures', 'stock'
            requested_delta: Net delta exposure requested
            requested_contracts: Number of contracts (for options/futures)
            
        Returns:
            (approved, reason) - Whether allocation approved and explanation
        """
        
        # Run cache maintenance
        self._run_cache_maintenance()
        
        # Calculate current total exposure with caching
        current_exposure = self._calculate_total_spy_exposure()
        
        # Check if adding this would exceed limits
        new_total_delta = current_exposure['total_delta'] + abs(requested_delta)
        
        # Check delta limit
        if new_total_delta > self.max_spy_delta:
            return (False, f"Would exceed max SPY delta: {new_total_delta:.1f} > {self.max_spy_delta}")
        
        # Check strategy count limit
        active_strategies = self._count_active_spy_strategies()
        if strategy_name not in self.spy_positions and active_strategies >= self.max_strategies_per_underlying:
            return (False, f"Already {active_strategies} strategies on SPY/ES (max {self.max_strategies_per_underlying})")
        
        # Check account-based limits
        account_value = self.algo.Portfolio.TotalPortfolioValue
        max_spy_allocation = account_value * 0.30  # Max 30% to SPY/ES
        
        # Estimate position value
        spy_price = self._get_spy_price()
        position_value = abs(requested_delta) * spy_price * 100  # Delta * price * shares per contract
        
        current_spy_value = current_exposure['total_notional']
        if current_spy_value + position_value > max_spy_allocation:
            return (False, f"Would exceed 30% SPY allocation: ${current_spy_value + position_value:,.0f}")
        
        # Check for conflicting positions
        conflicts = self._check_position_conflicts(strategy_name, requested_delta)
        if conflicts:
            return (False, f"Conflicts with {conflicts}")
        
        # Approved - record the allocation
        self._record_allocation(strategy_name, position_type, requested_delta, requested_contracts)
        
        return (True, f"Approved: Delta {requested_delta:.1f}, Total exposure {new_total_delta:.1f}/{self.max_spy_delta}")
    
    def release_spy_allocation(self, strategy_name: str):
        """Release SPY allocation when strategy exits"""
        
        if strategy_name in self.spy_positions:
            del self.spy_positions[strategy_name]
            self.algo.Debug(f"[SPY Manager] Released allocation for {strategy_name}")
        
        if strategy_name in self.es_positions:
            del self.es_positions[strategy_name]
        
        if strategy_name in self.option_positions:
            del self.option_positions[strategy_name]
    
    def update_position_delta(self, strategy_name: str, new_delta: float):
        """Update delta as position changes and invalidate cache"""
        
        if strategy_name in self.spy_positions:
            old_delta = self.spy_positions[strategy_name].get('delta', 0)
            self.spy_positions[strategy_name]['delta'] = new_delta
            
            # Invalidate position-dependent caches when delta changes significantly
            if abs(new_delta - old_delta) > 1.0:  # More than 1 delta change
                self.concentration_cache.invalidate_pattern('spy_exposure')
                self.concentration_cache.invalidate_pattern('available_delta')
                self.concentration_cache.invalidate_pattern('can_trade')
            
            self.algo.Debug(
                f"[SPY Manager] {strategy_name} delta updated: {old_delta:.1f} -> {new_delta:.1f}"
            )
    
    def _calculate_total_spy_exposure(self) -> Dict:
        """Calculate total SPY/ES exposure across all strategies with caching"""
        
        # Create cache key based on current positions
        positions_hash = hash(str(sorted(self.spy_positions.items())) + str(sorted(self.es_positions.items())))
        cache_key = f'spy_exposure_{positions_hash}'
        
        # Try to get cached result
        cached_exposure = self.concentration_cache.get(
            cache_key,
            lambda: self._calculate_exposure_internal()
        )
        
        return cached_exposure if cached_exposure else self._get_default_exposure()
    
    def _calculate_exposure_internal(self) -> Dict:
        """Internal exposure calculation (cached by _calculate_total_spy_exposure)"""
        
        total_delta = 0
        total_gamma = 0
        total_notional = 0
        
        spy_price = self._get_spy_price()
        
        # Sum up all positions
        for strategy, position in self.spy_positions.items():
            delta = position.get('delta', 0)
            gamma = position.get('gamma', 0)
            
            total_delta += delta
            total_gamma += gamma
            
            # Estimate notional value
            notional = abs(delta) * spy_price * 100
            total_notional += notional
        
        # Add futures positions (ES/MES)
        for strategy, position in self.es_positions.items():
            contracts = position.get('contracts', 0)
            symbol = position.get('symbol', 'ES')
            multiplier = self.multipliers.get(symbol, 50)
            
            # Futures have delta of 1.0 per contract
            futures_delta = contracts * 1.0
            total_delta += futures_delta
            
            # Notional value
            es_price = spy_price * 10  # ES is roughly 10x SPY
            notional = abs(contracts) * es_price * multiplier
            total_notional += notional
        
        return {
            'total_delta': total_delta,
            'total_gamma': total_gamma,
            'total_notional': total_notional,
            'strategy_count': len(self.spy_positions) + len(self.es_positions),
            'strategies': list(self.spy_positions.keys()) + list(self.es_positions.keys())
        }
    
    def _count_active_spy_strategies(self) -> int:
        """Count strategies with active SPY/ES positions"""
        
        active = set()
        active.update(self.spy_positions.keys())
        active.update(self.es_positions.keys())
        active.update(self.option_positions.keys())
        
        return len(active)
    
    def _check_position_conflicts(self, strategy_name: str, requested_delta: float) -> Optional[str]:
        """Check for conflicting positions (e.g., one long, one short)"""
        
        # If requesting negative delta (bearish)
        if requested_delta < 0:
            # Check for bullish positions
            for other_strategy, position in self.spy_positions.items():
                if other_strategy != strategy_name and position.get('delta', 0) > 10:
                    return f"{other_strategy} (bullish)"
        
        # If requesting positive delta (bullish)
        elif requested_delta > 0:
            # Check for bearish positions
            for other_strategy, position in self.spy_positions.items():
                if other_strategy != strategy_name and position.get('delta', 0) < -10:
                    return f"{other_strategy} (bearish)"
        
        return None
    
    def _record_allocation(self, strategy_name: str, position_type: str, 
                          delta: float, contracts: int):
        """Record approved allocation"""
        
        record = {
            'delta': delta,
            'contracts': contracts,
            'position_type': position_type,
            'timestamp': self.algo.Time
        }
        
        if position_type == 'futures':
            self.es_positions[strategy_name] = record
        elif position_type == 'options':
            self.option_positions[strategy_name] = record
        else:
            self.spy_positions[strategy_name] = record
        
        self.algo.Debug(
            f"[SPY Manager] Allocated to {strategy_name}: "
            f"Delta {delta:.1f}, Type {position_type}"
        )
    
    def _get_spy_price(self) -> float:
        """Get current SPY price with caching"""
        
        cache_key = 'spy_price'
        cached_price = self.price_cache.get(
            cache_key,
            lambda: self._get_spy_price_internal()
        )
        
        return cached_price if cached_price else 450.0
    
    def _get_spy_price_internal(self) -> float:
        """Internal SPY price fetch (cached)"""
        spy = self.algo.spy
        if spy in self.algo.Securities:
            return self.algo.Securities[spy].Price
        
        # Fallback estimate
        return 450.0  # Approximate SPY price
    
    def get_available_delta(self) -> float:
        """Get remaining delta capacity with caching"""
        
        cache_key = 'available_delta'
        cached_available = self.concentration_cache.get(
            cache_key,
            lambda: self._calculate_available_delta_internal()
        )
        
        return cached_available if cached_available is not None else 0.0
    
    def _calculate_available_delta_internal(self) -> float:
        """Internal available delta calculation (cached)"""
        current = self._calculate_total_spy_exposure()
        return self.max_spy_delta - current['total_delta']
    
    def can_strategy_trade_spy(self, strategy_name: str) -> bool:
        """Quick check if strategy can trade SPY/ES with caching"""
        
        cache_key = f'can_trade_{strategy_name}_{len(self.spy_positions)}_{len(self.es_positions)}'
        cached_result = self.concentration_cache.get(
            cache_key,
            lambda: self._can_strategy_trade_internal(strategy_name)
        )
        
        return cached_result if cached_result is not None else False
    
    def _can_strategy_trade_internal(self, strategy_name: str) -> bool:
        """Internal strategy trading check (cached)"""
        # Check if already at strategy limit
        active_count = self._count_active_spy_strategies()
        if strategy_name not in self.spy_positions and active_count >= self.max_strategies_per_underlying:
            return False
        
        # Check if any delta available
        if self.get_available_delta() <= 5:  # Need at least 5 delta
            return False
        
        return True
    
    def log_concentration_status(self):
        """Log current SPY concentration status"""
        
        exposure = self._calculate_total_spy_exposure()
        
        self.algo.Log("=" * 50)
        self.algo.Log("SPY/ES CONCENTRATION STATUS")
        self.algo.Log("-" * 50)
        self.algo.Log(f"Total Delta: {exposure['total_delta']:.1f} / {self.max_spy_delta}")
        self.algo.Log(f"Total Notional: ${exposure['total_notional']:,.0f}")
        self.algo.Log(f"Active Strategies: {exposure['strategy_count']}")
        
        if exposure['strategies']:
            self.algo.Log("Strategies:")
            for strategy in exposure['strategies']:
                if strategy in self.spy_positions:
                    delta = self.spy_positions[strategy].get('delta', 0)
                    self.algo.Log(f"  {strategy}: Delta {delta:.1f}")
        
        available = self.get_available_delta()
        self.algo.Log(f"Available Delta: {available:.1f}")
        self.algo.Log("=" * 50)
    
    def enforce_emergency_limits(self):
        """Enforce emergency concentration limits during high volatility"""
        
        # During VIX > 30, reduce limits
        vix = self._get_current_vix()
        if vix > 30:
            self.max_spy_delta = 50  # Half normal limit
            self.max_strategies_per_underlying = 1  # Only one strategy
            
            self.algo.Log("[SPY Manager] Emergency limits activated due to high VIX")
    
    def get_total_spy_exposure(self) -> float:
        """Public method to get total SPY exposure (for main.py compatibility)"""
        exposure = self._calculate_total_spy_exposure()
        return exposure['total_delta']
    
    def _get_current_vix(self) -> float:
        """Get current VIX level with caching"""
        
        cache_key = 'current_vix'
        cached_vix = self.price_cache.get(
            cache_key,
            lambda: self._get_vix_internal()
        )
        
        return cached_vix if cached_vix else 20.0
    
    def _get_vix_internal(self) -> float:
        """Internal VIX fetch (cached)"""
        if hasattr(self.algo, 'current_vix') and self.algo.current_vix:
            return self.algo.current_vix
        
        vix = self.algo.vix
        if vix in self.algo.Securities:
            return self.algo.Securities[vix].Price
        
        return 20.0  # Conservative default
    
    def _get_default_exposure(self) -> Dict:
        """Get default exposure values for error cases"""
        return {
            'total_delta': 0,
            'total_gamma': 0,
            'total_notional': 0,
            'strategy_count': 0,
            'strategies': []
        }
    
    def _run_cache_maintenance(self):
        """Run periodic cache maintenance"""
        current_time = self.algo.Time
        
        # Run cache maintenance
        self.concentration_cache.periodic_maintenance()
        self.price_cache.periodic_maintenance()
        
        # Log cache statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_performance()
            self.last_cache_stats_log = current_time
    
    def _log_cache_performance(self):
        """Log SPY concentration cache performance"""
        try:
            conc_stats = self.concentration_cache.get_statistics()
            price_stats = self.price_cache.get_statistics()
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[SPY Cache] Concentration Hit Rate: {conc_stats['hit_rate']:.1%} | "
                    f"Price Hit Rate: {price_stats['hit_rate']:.1%} | "
                    f"Concentration Size: {conc_stats['cache_size']}/{conc_stats['max_size']} | "
                    f"Price Size: {price_stats['cache_size']}/{price_stats['max_size']} | "
                    f"Total Memory: {conc_stats['memory_usage_mb'] + price_stats['memory_usage_mb']:.1f}MB"
                )
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> Dict:
        """Get SPY concentration cache statistics"""
        try:
            return {
                'concentration_cache': self.concentration_cache.get_statistics(),
                'price_cache': self.price_cache.get_statistics(),
                'total_memory_mb': (
                    self.concentration_cache.get_statistics()['memory_usage_mb'] +
                    self.price_cache.get_statistics()['memory_usage_mb']
                )
            }
        except Exception as e:
            self.algo.Error(f"[SPY Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_concentration_cache(self, reason: str = "manual"):
        """Manually invalidate concentration caches"""
        try:
            conc_count = self.concentration_cache.invalidate_all()
            price_count = self.price_cache.invalidate_all()
            
            self.algo.Debug(
                f"[SPY Cache] Invalidated {conc_count} concentration + {price_count} price calculations. Reason: {reason}"
            )
        except Exception as e:
            self.algo.Error(f"[SPY Cache] Error invalidating cache: {e}")
    
    def cleanup_stale_allocations(self, force_reconcile: bool = False) -> Dict:
        """
        CRITICAL FIX #2: Cleanup stale allocations from crashed/inactive strategies
        
        This addresses the documented critical issue where crashed strategies
        permanently consume SPY allocation limits, blocking new strategies.
        
        Implementation follows audit requirements:
        - Reconcile allocations with actual portfolio positions
        - Remove allocations for inactive strategies
        - Detect allocation leaks from crashed strategies
        - Provide detailed cleanup reporting
        
        Args:
            force_reconcile: Force full reconciliation regardless of normal checks
            
        Returns:
            Dict: Cleanup results with actions taken
        """
        
        cleanup_results = {
            'stale_removed': [],
            'reconciled_positions': [],
            'allocation_leaks_fixed': [],
            'total_delta_recovered': 0.0,
            'total_notional_recovered': 0.0,
            'cleanup_timestamp': self.algo.Time,
            'force_reconcile_used': force_reconcile
        }
        
        try:
            # Step 1: Get current actual positions from portfolio
            actual_spy_positions = self._get_actual_portfolio_spy_positions()
            
            # Step 2: Identify stale allocations in spy_positions
            stale_spy_strategies = []
            for strategy_name, allocation in list(self.spy_positions.items()):
                allocation_age = self.algo.Time - allocation.get('timestamp', self.algo.Time)
                
                # Consider stale if:
                # 1. No actual position in portfolio for this allocation
                # 2. Allocation is older than 4 hours (crashed strategy)
                # 3. Force reconcile requested
                has_actual_position = self._strategy_has_actual_spy_position(strategy_name, actual_spy_positions)
                is_old_allocation = allocation_age > timedelta(hours=4)
                
                if force_reconcile or not has_actual_position or is_old_allocation:
                    stale_spy_strategies.append(strategy_name)
                    
                    # Record what we're removing
                    cleanup_results['stale_removed'].append({
                        'strategy': strategy_name,
                        'type': 'SPY',
                        'delta': allocation.get('delta', 0),
                        'reason': 'force_reconcile' if force_reconcile else 
                                 'no_position' if not has_actual_position else 'old_allocation',
                        'age_hours': allocation_age.total_seconds() / 3600,
                        'allocation': allocation.copy()
                    })
                    
                    cleanup_results['total_delta_recovered'] += abs(allocation.get('delta', 0))
                    
                    # Estimate notional recovery
                    spy_price = self._get_spy_price()
                    notional = abs(allocation.get('delta', 0)) * spy_price * 100
                    cleanup_results['total_notional_recovered'] += notional
            
            # Step 3: Identify stale allocations in es_positions
            stale_es_strategies = []
            for strategy_name, allocation in list(self.es_positions.items()):
                allocation_age = self.algo.Time - allocation.get('timestamp', self.algo.Time)
                
                has_actual_position = self._strategy_has_actual_futures_position(strategy_name, actual_spy_positions)
                is_old_allocation = allocation_age > timedelta(hours=4)
                
                if force_reconcile or not has_actual_position or is_old_allocation:
                    stale_es_strategies.append(strategy_name)
                    
                    cleanup_results['stale_removed'].append({
                        'strategy': strategy_name,
                        'type': 'ES_FUTURES',
                        'contracts': allocation.get('contracts', 0),
                        'reason': 'force_reconcile' if force_reconcile else 
                                 'no_position' if not has_actual_position else 'old_allocation',
                        'age_hours': allocation_age.total_seconds() / 3600,
                        'allocation': allocation.copy()
                    })
            
            # Step 4: Identify stale allocations in option_positions
            stale_option_strategies = []
            for strategy_name, allocation in list(self.option_positions.items()):
                allocation_age = self.algo.Time - allocation.get('timestamp', self.algo.Time)
                
                has_actual_position = self._strategy_has_actual_option_position(strategy_name, actual_spy_positions)
                is_old_allocation = allocation_age > timedelta(hours=4)
                
                if force_reconcile or not has_actual_position or is_old_allocation:
                    stale_option_strategies.append(strategy_name)
                    
                    cleanup_results['stale_removed'].append({
                        'strategy': strategy_name,
                        'type': 'SPY_OPTIONS',
                        'delta': allocation.get('delta', 0),
                        'reason': 'force_reconcile' if force_reconcile else 
                                 'no_position' if not has_actual_position else 'old_allocation',
                        'age_hours': allocation_age.total_seconds() / 3600,
                        'allocation': allocation.copy()
                    })
            
            # Step 5: Remove stale allocations
            for strategy_name in stale_spy_strategies:
                if strategy_name in self.spy_positions:
                    del self.spy_positions[strategy_name]
                    self.algo.Log(f"[SPY Cleanup] Removed stale SPY allocation: {strategy_name}")
            
            for strategy_name in stale_es_strategies:
                if strategy_name in self.es_positions:
                    del self.es_positions[strategy_name]
                    self.algo.Log(f"[SPY Cleanup] Removed stale ES allocation: {strategy_name}")
            
            for strategy_name in stale_option_strategies:
                if strategy_name in self.option_positions:
                    del self.option_positions[strategy_name]
                    self.algo.Log(f"[SPY Cleanup] Removed stale option allocation: {strategy_name}")
            
            # Step 6: Reconcile remaining allocations with actual positions
            reconciliation_updates = self._reconcile_allocations_with_actual_positions(actual_spy_positions)
            cleanup_results['reconciled_positions'] = reconciliation_updates
            
            # Step 7: Detect allocation leaks (actual positions without allocations)
            allocation_leaks = self._detect_allocation_leaks(actual_spy_positions)
            cleanup_results['allocation_leaks_fixed'] = allocation_leaks
            
            # Step 8: Invalidate caches after cleanup
            if cleanup_results['stale_removed'] or cleanup_results['reconciled_positions']:
                self.invalidate_concentration_cache("stale_allocation_cleanup")
            
            # Step 9: Log cleanup summary
            total_removed = len(cleanup_results['stale_removed'])
            if total_removed > 0:
                self.algo.Log(
                    f"[SPY Cleanup] COMPLETED: Removed {total_removed} stale allocations, "
                    f"recovered {cleanup_results['total_delta_recovered']:.1f} delta capacity, "
                    f"${cleanup_results['total_notional_recovered']:,.0f} notional capacity"
                )
            else:
                self.algo.Debug("[SPY Cleanup] No stale allocations found")
            
            return cleanup_results
            
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error during cleanup: {e}")
            cleanup_results['error'] = str(e)
            return cleanup_results
    
    def _get_actual_portfolio_spy_positions(self) -> Dict:
        """
        Get actual SPY/ES/SPX positions from the QuantConnect portfolio
        
        Returns:
            Dict: Actual positions organized by type and symbol
        """
        
        actual_positions = {
            'spy_stock': {},
            'spy_options': {},
            'es_futures': {},
            'spx_options': {}
        }
        
        try:
            # Scan all portfolio positions
            for symbol, holding in self.algo.Portfolio.items():
                if holding.Quantity == 0:
                    continue  # Skip closed positions
                
                symbol_str = str(symbol)
                security_type = symbol.SecurityType
                
                # SPY stock positions
                if symbol_str == 'SPY' and security_type == SecurityType.Equity:
                    actual_positions['spy_stock'][symbol_str] = {
                        'quantity': holding.Quantity,
                        'average_price': holding.AveragePrice,
                        'market_value': holding.MarketValue,
                        'unrealized_pnl': holding.UnrealizedProfit
                    }
                
                # SPY option positions
                elif 'SPY' in symbol_str and security_type == SecurityType.Option:
                    actual_positions['spy_options'][symbol_str] = {
                        'quantity': holding.Quantity,
                        'average_price': holding.AveragePrice,
                        'market_value': holding.MarketValue,
                        'unrealized_pnl': holding.UnrealizedProfit,
                        'option_right': symbol.ID.OptionRight,
                        'strike': symbol.ID.StrikePrice,
                        'expiry': symbol.ID.Date
                    }
                
                # ES futures positions
                elif 'ES' in symbol_str and security_type == SecurityType.Future:
                    actual_positions['es_futures'][symbol_str] = {
                        'quantity': holding.Quantity,
                        'average_price': holding.AveragePrice,
                        'market_value': holding.MarketValue,
                        'unrealized_pnl': holding.UnrealizedProfit
                    }
                
                # SPX option positions
                elif 'SPX' in symbol_str and security_type == SecurityType.Option:
                    actual_positions['spx_options'][symbol_str] = {
                        'quantity': holding.Quantity,
                        'average_price': holding.AveragePrice,
                        'market_value': holding.MarketValue,
                        'unrealized_pnl': holding.UnrealizedProfit,
                        'option_right': symbol.ID.OptionRight,
                        'strike': symbol.ID.StrikePrice,
                        'expiry': symbol.ID.Date
                    }
            
            return actual_positions
            
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error scanning portfolio positions: {e}")
            return actual_positions
    
    def _strategy_has_actual_spy_position(self, strategy_name: str, actual_positions: Dict) -> bool:
        """
        Check if strategy has any actual SPY-related positions in portfolio
        
        This is complex because we need to identify which positions belong to which strategy.
        We use position tags, order tags, and timing heuristics.
        """
        
        try:
            # Check if any SPY stock position exists
            if actual_positions['spy_stock']:
                return True  # Assume any SPY stock position could be from this strategy
            
            # Check SPY options - look for positions that could belong to this strategy
            for symbol_str, position in actual_positions['spy_options'].items():
                # If we have significant option positions, assume strategy is active
                if abs(position['quantity']) > 0:
                    return True
            
            # Check if strategy appears in recent orders (last 24 hours)
            recent_orders = self._get_recent_orders_for_strategy(strategy_name, hours=24)
            if recent_orders:
                return True
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error checking actual position for {strategy_name}: {e}")
            return False  # Conservative: assume no position on error
    
    def _strategy_has_actual_futures_position(self, strategy_name: str, actual_positions: Dict) -> bool:
        """Check if strategy has actual ES futures positions"""
        
        try:
            # Check ES futures positions
            if actual_positions['es_futures']:
                return True  # Assume any ES position could be from this strategy
            
            # Check recent futures orders
            recent_orders = self._get_recent_futures_orders_for_strategy(strategy_name, hours=24)
            if recent_orders:
                return True
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error checking futures position for {strategy_name}: {e}")
            return False
    
    def _strategy_has_actual_option_position(self, strategy_name: str, actual_positions: Dict) -> bool:
        """Check if strategy has actual SPY/SPX option positions"""
        
        try:
            # Check SPY options
            if actual_positions['spy_options']:
                return True
            
            # Check SPX options
            if actual_positions['spx_options']:
                return True
            
            # Check recent option orders
            recent_orders = self._get_recent_option_orders_for_strategy(strategy_name, hours=24)
            if recent_orders:
                return True
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error checking option position for {strategy_name}: {e}")
            return False
    
    def _get_recent_orders_for_strategy(self, strategy_name: str, hours: int = 24) -> List:
        """
        Get recent orders that might belong to this strategy
        
        This is challenging in QuantConnect as we don't have perfect strategy->order mapping.
        We use order tags and timing heuristics.
        """
        
        try:
            recent_orders = []
            cutoff_time = self.algo.Time - timedelta(hours=hours)
            
            # Scan transaction history for orders with matching tags
            for order_ticket in self.algo.Transactions.GetOrderTickets():
                # Skip old orders
                if order_ticket.Time < cutoff_time:
                    continue
                
                # Check if order tag contains strategy name
                if order_ticket.Tag and strategy_name in order_ticket.Tag:
                    recent_orders.append({
                        'order_id': order_ticket.OrderId,
                        'symbol': order_ticket.Symbol,
                        'quantity': order_ticket.Quantity,
                        'status': order_ticket.Status,
                        'tag': order_ticket.Tag,
                        'time': order_ticket.Time
                    })
                
                # Check if symbol suggests SPY-related trading
                symbol_str = str(order_ticket.Symbol)
                if 'SPY' in symbol_str and order_ticket.Status in [OrderStatus.Filled, OrderStatus.PartiallyFilled]:
                    recent_orders.append({
                        'order_id': order_ticket.OrderId,
                        'symbol': order_ticket.Symbol,
                        'quantity': order_ticket.Quantity,
                        'status': order_ticket.Status,
                        'tag': order_ticket.Tag,
                        'time': order_ticket.Time
                    })
            
            return recent_orders
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error getting recent orders for {strategy_name}: {e}")
            return []
    
    def _get_recent_futures_orders_for_strategy(self, strategy_name: str, hours: int = 24) -> List:
        """Get recent ES futures orders for strategy"""
        
        try:
            recent_orders = []
            cutoff_time = self.algo.Time - timedelta(hours=hours)
            
            for order_ticket in self.algo.Transactions.GetOrderTickets():
                if order_ticket.Time < cutoff_time:
                    continue
                
                symbol_str = str(order_ticket.Symbol)
                if 'ES' in symbol_str or 'MES' in symbol_str:
                    if order_ticket.Tag and strategy_name in order_ticket.Tag:
                        recent_orders.append({
                            'order_id': order_ticket.OrderId,
                            'symbol': order_ticket.Symbol,
                            'quantity': order_ticket.Quantity,
                            'tag': order_ticket.Tag,
                            'time': order_ticket.Time
                        })
            
            return recent_orders
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error getting recent futures orders for {strategy_name}: {e}")
            return []
    
    def _get_recent_option_orders_for_strategy(self, strategy_name: str, hours: int = 24) -> List:
        """Get recent SPY/SPX option orders for strategy"""
        
        try:
            recent_orders = []
            cutoff_time = self.algo.Time - timedelta(hours=hours)
            
            for order_ticket in self.algo.Transactions.GetOrderTickets():
                if order_ticket.Time < cutoff_time:
                    continue
                
                symbol_str = str(order_ticket.Symbol)
                if ('SPY' in symbol_str or 'SPX' in symbol_str) and order_ticket.Symbol.SecurityType == SecurityType.Option:
                    if order_ticket.Tag and strategy_name in order_ticket.Tag:
                        recent_orders.append({
                            'order_id': order_ticket.OrderId,
                            'symbol': order_ticket.Symbol,
                            'quantity': order_ticket.Quantity,
                            'tag': order_ticket.Tag,
                            'time': order_ticket.Time
                        })
            
            return recent_orders
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error getting recent option orders for {strategy_name}: {e}")
            return []
    
    def _reconcile_allocations_with_actual_positions(self, actual_positions: Dict) -> List:
        """
        Reconcile allocation deltas with actual position deltas
        
        Update allocation records to match reality where possible
        """
        
        reconciliation_updates = []
        
        try:
            # For each tracked allocation, try to estimate actual delta
            for strategy_name, allocation in self.spy_positions.items():
                allocated_delta = allocation.get('delta', 0)
                
                # Estimate actual delta from positions (simplified)
                estimated_actual_delta = self._estimate_strategy_actual_delta(strategy_name, actual_positions)
                
                # If significantly different, update allocation
                delta_difference = abs(allocated_delta - estimated_actual_delta)
                if delta_difference > 5.0:  # More than 5 delta difference
                    
                    old_delta = allocated_delta
                    self.spy_positions[strategy_name]['delta'] = estimated_actual_delta
                    self.spy_positions[strategy_name]['last_reconciled'] = self.algo.Time
                    
                    reconciliation_updates.append({
                        'strategy': strategy_name,
                        'type': 'DELTA_UPDATE',
                        'old_delta': old_delta,
                        'new_delta': estimated_actual_delta,
                        'difference': delta_difference,
                        'reconcile_time': self.algo.Time
                    })
                    
                    self.algo.Debug(
                        f"[SPY Cleanup] Reconciled {strategy_name} delta: "
                        f"{old_delta:.1f} -> {estimated_actual_delta:.1f}"
                    )
            
            return reconciliation_updates
            
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error in reconciliation: {e}")
            return reconciliation_updates
    
    def _estimate_strategy_actual_delta(self, strategy_name: str, actual_positions: Dict) -> float:
        """
        Estimate actual delta exposure for a strategy based on portfolio positions
        
        This is simplified - in production would need more sophisticated attribution
        """
        
        try:
            estimated_delta = 0.0
            
            # SPY stock positions contribute 1:1 delta
            for symbol_str, position in actual_positions['spy_stock'].items():
                # Assume this position belongs to our strategy (simplified)
                estimated_delta += position['quantity'] * 1.0
            
            # SPY option positions - estimate delta (simplified)
            for symbol_str, position in actual_positions['spy_options'].items():
                # Rough delta estimation: ITM options ~0.7 delta, OTM ~0.3 delta
                # This is very simplified - production would use actual Greeks
                quantity = position['quantity']
                rough_delta = 0.5  # Rough estimate
                estimated_delta += quantity * rough_delta
            
            # ES futures contribute large delta
            for symbol_str, position in actual_positions['es_futures'].items():
                # ES futures have ~10x SPY delta equivalent
                estimated_delta += position['quantity'] * 10.0
            
            return estimated_delta
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error estimating delta for {strategy_name}: {e}")
            return 0.0
    
    def _detect_allocation_leaks(self, actual_positions: Dict) -> List:
        """
        Detect actual SPY positions that don't have allocations (allocation leaks)
        
        These represent positions that were opened but never properly tracked
        """
        
        allocation_leaks = []
        
        try:
            # Check if we have actual positions but no tracked allocations
            has_actual_spy_positions = (
                len(actual_positions['spy_stock']) > 0 or
                len(actual_positions['spy_options']) > 0 or
                len(actual_positions['es_futures']) > 0 or
                len(actual_positions['spx_options']) > 0
            )
            
            has_tracked_allocations = (
                len(self.spy_positions) > 0 or
                len(self.es_positions) > 0 or
                len(self.option_positions) > 0
            )
            
            # If we have positions but no allocations, that's a leak
            if has_actual_spy_positions and not has_tracked_allocations:
                
                leak_info = {
                    'type': 'UNTRACKED_POSITIONS',
                    'spy_stock_positions': len(actual_positions['spy_stock']),
                    'spy_option_positions': len(actual_positions['spy_options']),
                    'es_futures_positions': len(actual_positions['es_futures']),
                    'spx_option_positions': len(actual_positions['spx_options']),
                    'estimated_total_delta': self._estimate_total_actual_delta(actual_positions),
                    'detection_time': self.algo.Time
                }
                
                allocation_leaks.append(leak_info)
                
                self.algo.Log(
                    f"[SPY Cleanup] ALLOCATION LEAK DETECTED: "
                    f"Found actual SPY positions worth {leak_info['estimated_total_delta']:.1f} delta "
                    f"with no tracked allocations"
                )
            
            return allocation_leaks
            
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error detecting allocation leaks: {e}")
            return allocation_leaks
    
    def _estimate_total_actual_delta(self, actual_positions: Dict) -> float:
        """Estimate total actual delta from all SPY positions"""
        
        try:
            total_delta = 0.0
            
            # SPY stock
            for position in actual_positions['spy_stock'].values():
                total_delta += position['quantity'] * 1.0
            
            # SPY options (rough estimate)
            for position in actual_positions['spy_options'].values():
                total_delta += position['quantity'] * 0.5  # Rough delta
            
            # ES futures
            for position in actual_positions['es_futures'].values():
                total_delta += position['quantity'] * 10.0  # Rough SPY equivalent
            
            # SPX options (rough estimate)
            for position in actual_positions['spx_options'].values():
                total_delta += position['quantity'] * 5.0  # Rough SPY equivalent
            
            return total_delta
            
        except Exception as e:
            self.algo.Debug(f"[SPY Cleanup] Error estimating total delta: {e}")
            return 0.0
    
    def schedule_periodic_cleanup(self):
        """
        Schedule periodic cleanup of stale allocations
        
        This should be called from main.py during initialization to set up
        automatic cleanup that prevents allocation leaks from accumulating
        """
        
        # Schedule cleanup every 4 hours during market hours
        self.algo.Schedule.On(
            self.algo.DateRules.EveryDay("SPY"),
            self.algo.TimeRules.Every(TimeSpan.FromHours(4)),
            self._periodic_cleanup_task
        )
        
        self.algo.Log("[SPY Cleanup] Scheduled automatic cleanup every 4 hours")
    
    def _periodic_cleanup_task(self):
        """Periodic cleanup task (called by QuantConnect scheduler)"""
        
        try:
            # Only run during market hours to avoid unnecessary processing
            if self.algo.IsMarketOpen("SPY"):
                cleanup_results = self.cleanup_stale_allocations(force_reconcile=False)
                
                # Log significant cleanups
                if len(cleanup_results['stale_removed']) > 0:
                    self.algo.Log(
                        f"[SPY Cleanup] Periodic cleanup removed {len(cleanup_results['stale_removed'])} "
                        f"stale allocations, recovered {cleanup_results['total_delta_recovered']:.1f} delta"
                    )
                
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error in periodic cleanup: {e}")
    
    def get_cleanup_status(self) -> Dict:
        """
        Get status of cleanup system for monitoring and debugging
        
        Returns comprehensive status for validation and troubleshooting
        """
        
        try:
            actual_positions = self._get_actual_portfolio_spy_positions()
            
            status = {
                'cleanup_system_active': True,
                'current_time': self.algo.Time,
                'tracked_allocations': {
                    'spy_positions': len(self.spy_positions),
                    'es_positions': len(self.es_positions),
                    'option_positions': len(self.option_positions),
                    'total_strategies': self._count_active_spy_strategies()
                },
                'actual_positions': {
                    'spy_stock': len(actual_positions['spy_stock']),
                    'spy_options': len(actual_positions['spy_options']),
                    'es_futures': len(actual_positions['es_futures']),
                    'spx_options': len(actual_positions['spx_options'])
                },
                'allocation_health': {
                    'positions_without_allocations': 0,
                    'allocations_without_positions': 0,
                    'stale_allocations_detected': 0,
                    'delta_discrepancies': 0
                },
                'last_cleanup_run': getattr(self, 'last_cleanup_run', None),
                'periodic_cleanup_enabled': True
            }
            
            # Quick health check
            has_positions = sum(status['actual_positions'].values()) > 0
            has_allocations = sum(status['tracked_allocations'].values()) > 0
            
            if has_positions and not has_allocations:
                status['allocation_health']['positions_without_allocations'] = sum(status['actual_positions'].values())
            
            if not has_positions and has_allocations:
                status['allocation_health']['allocations_without_positions'] = sum(status['tracked_allocations'].values())
            
            return status
            
        except Exception as e:
            self.algo.Error(f"[SPY Cleanup] Error getting cleanup status: {e}")
            return {'error': str(e), 'cleanup_system_active': False}