# SPY/ES Concentration Manager - Prevents multiple strategies from exceeding position limits
# Critical for preventing over-exposure to S&P 500 index

from AlgorithmImports import *
from typing import Dict, List, Optional, Tuple
from config.constants import TradingConstants

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
        
        # Maximum exposure limits (Tom King methodology)
        self.max_spy_delta = 100  # Maximum net delta exposure to SPY
        self.max_notional = None  # Will be set based on account size
        self.max_strategies_per_underlying = 2  # Max strategies on same underlying
        
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
        Request allocation for SPY/ES position.
        
        Args:
            strategy_name: Name of requesting strategy
            position_type: 'options', 'futures', 'stock'
            requested_delta: Net delta exposure requested
            requested_contracts: Number of contracts (for options/futures)
            
        Returns:
            (approved, reason) - Whether allocation approved and explanation
        """
        
        # Calculate current total exposure
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
        """Update delta as position changes (from Greeks calculations)"""
        
        if strategy_name in self.spy_positions:
            old_delta = self.spy_positions[strategy_name].get('delta', 0)
            self.spy_positions[strategy_name]['delta'] = new_delta
            
            self.algo.Debug(
                f"[SPY Manager] {strategy_name} delta updated: {old_delta:.1f} -> {new_delta:.1f}"
            )
    
    def _calculate_total_spy_exposure(self) -> Dict:
        """Calculate total SPY/ES exposure across all strategies"""
        
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
        """Get current SPY price"""
        
        spy = self.algo.spy
        if spy in self.algo.Securities:
            return self.algo.Securities[spy].Price
        
        # Fallback estimate
        return 450.0  # Approximate SPY price
    
    def get_available_delta(self) -> float:
        """Get remaining delta capacity"""
        
        current = self._calculate_total_spy_exposure()
        return self.max_spy_delta - current['total_delta']
    
    def can_strategy_trade_spy(self, strategy_name: str) -> bool:
        """Quick check if strategy can trade SPY/ES"""
        
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
        """Get current VIX level"""
        
        if hasattr(self.algo, 'current_vix') and self.algo.current_vix:
            return self.algo.current_vix
        
        vix = self.algo.vix
        if vix in self.algo.Securities:
            return self.algo.Securities[vix].Price
        
        return 20.0  # Conservative default