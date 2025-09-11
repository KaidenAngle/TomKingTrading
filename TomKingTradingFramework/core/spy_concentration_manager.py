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