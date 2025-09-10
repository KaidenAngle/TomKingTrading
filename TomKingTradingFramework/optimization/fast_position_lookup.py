#!/usr/bin/env python3
"""
Fast Position Lookup System - Phase 4 Optimization
Eliminates O(n²) algorithms with indexed lookups
"""

from typing import Dict, List, Set, Optional, Tuple
from collections import defaultdict
from datetime import datetime

class FastPositionLookup:
    """
    Optimized position lookup system using multiple indexes
    Reduces position search from O(n) to O(1) for most operations
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Multiple indexes for fast lookup
        self.positions_by_symbol: Dict[str, Set[str]] = defaultdict(set)
        self.positions_by_strategy: Dict[str, Set[str]] = defaultdict(set)
        self.positions_by_expiry: Dict[datetime, Set[str]] = defaultdict(set)
        self.positions_by_status: Dict[str, Set[str]] = defaultdict(set)
        
        # Component indexes
        self.components_by_symbol: Dict[str, Set[Tuple[str, str]]] = defaultdict(set)
        self.components_by_strike: Dict[float, Set[Tuple[str, str]]] = defaultdict(set)
        
        # Performance tracking
        self.lookup_count = 0
        self.index_hits = 0
        
    def index_position(self, position_id: str, position):
        """Index a position for fast lookup - O(1) operation"""
        # Index by symbol
        self.positions_by_symbol[position.symbol].add(position_id)
        
        # Index by strategy
        self.positions_by_strategy[position.strategy].add(position_id)
        
        # Index by status
        self.positions_by_status[position.status].add(position_id)
        
        # Index components
        for comp_id, component in position.components.items():
            # By symbol
            self.components_by_symbol[component.symbol].add((position_id, comp_id))
            
            # By strike
            if hasattr(component, 'strike'):
                self.components_by_strike[component.strike].add((position_id, comp_id))
            
            # By expiry
            if hasattr(component, 'expiry'):
                self.positions_by_expiry[component.expiry].add(position_id)
    
    def remove_position_index(self, position_id: str, position):
        """Remove position from all indexes - O(1) operation"""
        # Remove from symbol index
        if position.symbol in self.positions_by_symbol:
            self.positions_by_symbol[position.symbol].discard(position_id)
        
        # Remove from strategy index
        if position.strategy in self.positions_by_strategy:
            self.positions_by_strategy[position.strategy].discard(position_id)
        
        # Remove from status index
        if position.status in self.positions_by_status:
            self.positions_by_status[position.status].discard(position_id)
        
        # Remove components from indexes
        for comp_id, component in position.components.items():
            if component.symbol in self.components_by_symbol:
                self.components_by_symbol[component.symbol].discard((position_id, comp_id))
            
            if hasattr(component, 'strike') and component.strike in self.components_by_strike:
                self.components_by_strike[component.strike].discard((position_id, comp_id))
            
            if hasattr(component, 'expiry') and component.expiry in self.positions_by_expiry:
                self.positions_by_expiry[component.expiry].discard(position_id)
    
    def find_positions_by_symbol(self, symbol: str) -> Set[str]:
        """Find all positions for a symbol - O(1) operation"""
        self.lookup_count += 1
        if symbol in self.positions_by_symbol:
            self.index_hits += 1
        return self.positions_by_symbol.get(symbol, set())
    
    def find_positions_by_strategy(self, strategy: str) -> Set[str]:
        """Find all positions for a strategy - O(1) operation"""
        self.lookup_count += 1
        if strategy in self.positions_by_strategy:
            self.index_hits += 1
        return self.positions_by_strategy.get(strategy, set())
    
    def find_active_positions(self) -> Set[str]:
        """Find all active positions - O(1) operation"""
        self.lookup_count += 1
        self.index_hits += 1
        return self.positions_by_status.get("ACTIVE", set())
    
    def find_positions_expiring_soon(self, days: int = 21) -> Set[str]:
        """Find positions expiring within specified days - O(k) where k is number of expiries"""
        self.lookup_count += 1
        expiring_positions = set()
        current_date = self.algo.Time.date()
        
        for expiry, position_ids in self.positions_by_expiry.items():
            if (expiry.date() - current_date).days <= days:
                expiring_positions.update(position_ids)
                self.index_hits += 1
        
        return expiring_positions
    
    def find_components_by_strike_range(self, min_strike: float, max_strike: float) -> List[Tuple[str, str]]:
        """Find components within strike range - O(k) where k is number of strikes"""
        self.lookup_count += 1
        components = []
        
        for strike, component_refs in self.components_by_strike.items():
            if min_strike <= strike <= max_strike:
                components.extend(component_refs)
                self.index_hits += 1
        
        return components
    
    def rebuild_indexes(self, position_manager):
        """Rebuild all indexes from position manager - O(n) operation"""
        # Clear existing indexes
        self.positions_by_symbol.clear()
        self.positions_by_strategy.clear()
        self.positions_by_expiry.clear()
        self.positions_by_status.clear()
        self.components_by_symbol.clear()
        self.components_by_strike.clear()
        
        # Rebuild indexes
        for position_id, position in position_manager.positions.items():
            self.index_position(position_id, position)
        
        self.algo.Log(f"[OPTIMIZATION] Rebuilt indexes for {len(position_manager.positions)} positions")
    
    def get_lookup_stats(self) -> Dict:
        """Get lookup performance statistics"""
        hit_rate = (self.index_hits / self.lookup_count * 100) if self.lookup_count > 0 else 0
        return {
            'total_lookups': self.lookup_count,
            'index_hits': self.index_hits,
            'hit_rate': hit_rate,
            'symbol_index_size': len(self.positions_by_symbol),
            'strategy_index_size': len(self.positions_by_strategy),
            'expiry_index_size': len(self.positions_by_expiry)
        }


class BatchOperationOptimizer:
    """
    Optimizes batch operations on positions to reduce redundant calculations
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
    def batch_calculate_pnl(self, positions: Dict) -> Dict[str, float]:
        """Calculate P&L for all positions in a single pass - O(n) instead of O(n²)"""
        pnl_results = {}
        
        # Pre-fetch all current prices in one batch
        symbols_to_fetch = set()
        for position in positions.values():
            for component in position.components.values():
                symbols_to_fetch.add(component.contract_symbol)
        
        # Batch fetch prices
        current_prices = self._batch_fetch_prices(symbols_to_fetch)
        
        # Calculate P&L using cached prices
        for position_id, position in positions.items():
            total_pnl = 0
            for component in position.components.values():
                if component.contract_symbol in current_prices:
                    current_price = current_prices[component.contract_symbol]
                    if component.quantity > 0:  # Long
                        component_pnl = (current_price - component.entry_price) * component.quantity * 100
                    else:  # Short
                        component_pnl = (component.entry_price - current_price) * abs(component.quantity) * 100
                    total_pnl += component_pnl
            
            pnl_results[position_id] = total_pnl
        
        return pnl_results
    
    def _batch_fetch_prices(self, symbols: Set[str]) -> Dict[str, float]:
        """Batch fetch prices for multiple symbols efficiently"""
        prices = {}
        
        for symbol in symbols:
            if symbol in self.algo.Securities:
                prices[symbol] = float(self.algo.Securities[symbol].Price)
            else:
                # Symbol not in Securities, default to 0
                prices[symbol] = 0.0
        
        return prices
    
    def batch_check_exit_conditions(self, positions: Dict, exit_manager) -> List[Dict]:
        """Check exit conditions for all positions in a single pass"""
        exit_actions = []
        
        # Pre-calculate all needed data
        pnl_data = self.batch_calculate_pnl(positions)
        
        # Check exits using pre-calculated data
        for position_id, position in positions.items():
            position_info = {
                'position_id': position_id,
                'strategy': position.strategy,
                'symbol': position.symbol,
                'total_pnl': pnl_data.get(position_id, 0),
                'pnl_percentage': (pnl_data.get(position_id, 0) / 
                                 (position.entry_cost if hasattr(position, 'entry_cost') and position.entry_cost > 0 else 1)) * 100,
                'days_held': (self.algo.Time - position.entry_time).days,
                'components': position.components
            }
            
            should_exit, reason, action = exit_manager.check_exits(position_info)
            
            if should_exit:
                exit_actions.append({
                    'position_id': position_id,
                    'reason': reason,
                    'action': action,
                    'pnl': pnl_data.get(position_id, 0)
                })
        
        return exit_actions