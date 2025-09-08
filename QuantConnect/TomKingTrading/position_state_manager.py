#!/usr/bin/env python3
"""
Tom King Trading Framework - Position State Manager
Handles complex multi-legged position tracking and individual component management
"""

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import json

class PositionComponent:
    """Represents a single component of a multi-legged position"""
    
    def __init__(self, component_id: str, strategy: str, symbol: str, 
                 leg_type: str, contract_symbol: str, quantity: int, 
                 strike: float, expiry: datetime, right: OptionRight = None):
        self.component_id = component_id
        self.strategy = strategy
        self.symbol = symbol  # Underlying symbol
        self.leg_type = leg_type  # e.g., "LEAP_CALL", "WEEKLY_CALL", "NAKED_PUT_1", "DEBIT_LONG"
        self.contract_symbol = contract_symbol  # Actual option contract symbol
        self.quantity = quantity  # Positive = long, negative = short
        self.strike = strike
        self.expiry = expiry
        self.right = right
        self.entry_time = datetime.now()
        self.entry_price = 0.0
        self.current_price = 0.0
        self.status = "OPEN"  # OPEN, CLOSED, ROLLED, ASSIGNED
        self.pnl = 0.0
        self.days_held = 0
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            'component_id': self.component_id,
            'strategy': self.strategy,
            'symbol': self.symbol,
            'leg_type': self.leg_type,
            'contract_symbol': str(self.contract_symbol),
            'quantity': self.quantity,
            'strike': self.strike,
            'expiry': self.expiry.isoformat(),
            'right': str(self.right) if self.right else None,
            'entry_time': self.entry_time.isoformat(),
            'entry_price': self.entry_price,
            'current_price': self.current_price,
            'status': self.status,
            'pnl': self.pnl,
            'days_held': self.days_held
        }

class MultiLegPosition:
    """Represents a complete multi-legged position"""
    
    def __init__(self, position_id: str, strategy: str, symbol: str):
        self.position_id = position_id
        self.strategy = strategy
        self.symbol = symbol
        self.components: Dict[str, PositionComponent] = {}
        self.entry_time = datetime.now()
        self.status = "BUILDING"  # BUILDING, ACTIVE, PARTIALLY_CLOSED, CLOSED
        self.total_pnl = 0.0
        self.metadata = {}  # Strategy-specific metadata
        
    def add_component(self, component: PositionComponent):
        """Add a component to this position"""
        self.components[component.component_id] = component
        if self.status == "BUILDING" and self._is_complete():
            self.status = "ACTIVE"
            
    def remove_component(self, component_id: str) -> Optional[PositionComponent]:
        """Remove and return a component"""
        if component_id in self.components:
            component = self.components.pop(component_id)
            component.status = "CLOSED"
            self._update_status()
            return component
        return None
        
    def get_component(self, component_id: str) -> Optional[PositionComponent]:
        """Get a specific component"""
        return self.components.get(component_id)
        
    def get_components_by_type(self, leg_type: str) -> List[PositionComponent]:
        """Get all components of a specific type"""
        return [c for c in self.components.values() if c.leg_type == leg_type]
        
    def _is_complete(self) -> bool:
        """Check if position has all required components"""
        if self.strategy == "IPMCC":
            return "LEAP_CALL" in [c.leg_type for c in self.components.values()]
        elif self.strategy == "LT112":
            types = [c.leg_type for c in self.components.values()]
            return all(t in types for t in ["DEBIT_LONG", "DEBIT_SHORT", "NAKED_PUT"])
        return len(self.components) > 0
        
    def _update_status(self):
        """Update position status based on remaining components"""
        active_components = [c for c in self.components.values() if c.status == "OPEN"]
        if not active_components:
            self.status = "CLOSED"
        elif len(active_components) < len(self.components):
            self.status = "PARTIALLY_CLOSED"
            
    def calculate_total_pnl(self) -> float:
        """Calculate total position P&L"""
        self.total_pnl = sum(c.pnl for c in self.components.values())
        return self.total_pnl
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            'position_id': self.position_id,
            'strategy': self.strategy,
            'symbol': self.symbol,
            'components': {k: v.to_dict() for k, v in self.components.items()},
            'entry_time': self.entry_time.isoformat(),
            'status': self.status,
            'total_pnl': self.total_pnl,
            'metadata': self.metadata
        }

class PositionStateManager:
    """
    Advanced position state manager for complex multi-legged strategies
    Handles individual component tracking, partial closes, and dynamic management
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.positions: Dict[str, MultiLegPosition] = {}
        self.components_by_symbol: Dict[str, List[str]] = {}  # Symbol -> component_ids
        
    # ================================
    # IPMCC SPECIFIC METHODS
    # ================================
    
    def has_active_leap(self, symbol: str) -> Optional[PositionComponent]:
        """Check if there's an active LEAP for this symbol"""
        for position in self.positions.values():
            if position.strategy == "IPMCC" and position.symbol == symbol:
                leap_components = position.get_components_by_type("LEAP_CALL")
                for leap in leap_components:
                    if leap.status == "OPEN" and leap.expiry > self.algo.Time + timedelta(days=90):
                        return leap
        return None
        
    def create_ipmcc_position(self, symbol: str) -> str:
        """Create new IPMCC position structure"""
        position_id = f"IPMCC_{symbol}_{self.algo.Time.strftime('%Y%m%d')}"
        position = MultiLegPosition(position_id, "IPMCC", symbol)
        self.positions[position_id] = position
        return position_id
        
    def add_ipmcc_leap(self, position_id: str, leap_contract: str, quantity: int, 
                      strike: float, expiry: datetime) -> str:
        """Add LEAP component to IPMCC position"""
        component_id = f"{position_id}_LEAP"
        component = PositionComponent(
            component_id=component_id,
            strategy="IPMCC",
            symbol=self.positions[position_id].symbol,
            leg_type="LEAP_CALL",
            contract_symbol=leap_contract,
            quantity=quantity,
            strike=strike,
            expiry=expiry,
            right=OptionRight.Call
        )
        self.positions[position_id].add_component(component)
        self.algo.Log(f"✅ Added LEAP component: {component_id}")
        return component_id
        
    def add_ipmcc_weekly_call(self, symbol: str, weekly_contract: str, quantity: int,
                             strike: float, expiry: datetime) -> Optional[str]:
        """Add weekly call to existing IPMCC position with LEAP"""
        # Find position with active LEAP for this symbol
        for position_id, position in self.positions.items():
            if (position.strategy == "IPMCC" and position.symbol == symbol and 
                position.get_components_by_type("LEAP_CALL")):
                
                # Create unique component ID for this weekly
                weekly_count = len([c for c in position.components.values() 
                                 if c.leg_type.startswith("WEEKLY_CALL")])
                component_id = f"{position_id}_WEEKLY_{weekly_count + 1}"
                
                component = PositionComponent(
                    component_id=component_id,
                    strategy="IPMCC",
                    symbol=symbol,
                    leg_type=f"WEEKLY_CALL_{weekly_count + 1}",
                    contract_symbol=weekly_contract,
                    quantity=-quantity,  # Short call
                    strike=strike,
                    expiry=expiry,
                    right=OptionRight.Call
                )
                position.add_component(component)
                self.algo.Log(f"✅ Added weekly call to existing IPMCC: {component_id}")
                return component_id
        
        return None
        
    def close_ipmcc_weekly_call(self, symbol: str, component_id: str) -> bool:
        """Close specific weekly call component"""
        for position in self.positions.values():
            if position.strategy == "IPMCC" and position.symbol == symbol:
                component = position.remove_component(component_id)
                if component:
                    self.algo.Log(f"✅ Closed IPMCC weekly call: {component_id}")
                    return True
        return False
        
    # ================================
    # LT112 SPECIFIC METHODS  
    # ================================
    
    def create_lt112_position(self, symbol: str, strikes: Dict, position_size: int) -> str:
        """Create complete LT112 position with all components"""
        position_id = f"LT112_{symbol}_{self.algo.Time.strftime('%Y%m%d_%H%M')}"
        position = MultiLegPosition(position_id, "LT112", symbol)
        
        # Add debit spread components
        debit_long = PositionComponent(
            component_id=f"{position_id}_DEBIT_LONG",
            strategy="LT112",
            symbol=symbol,
            leg_type="DEBIT_LONG",
            contract_symbol=f"{symbol}_PUT_{strikes['debit_spread_long']}",
            quantity=position_size,
            strike=strikes['debit_spread_long'],
            expiry=strikes['expiry_date']
        )
        
        debit_short = PositionComponent(
            component_id=f"{position_id}_DEBIT_SHORT", 
            strategy="LT112",
            symbol=symbol,
            leg_type="DEBIT_SHORT",
            contract_symbol=f"{symbol}_PUT_{strikes['debit_spread_short']}",
            quantity=-position_size,
            strike=strikes['debit_spread_short'],
            expiry=strikes['expiry_date']
        )
        
        # Add naked put components (2 of them)
        naked_put = PositionComponent(
            component_id=f"{position_id}_NAKED_PUT",
            strategy="LT112", 
            symbol=symbol,
            leg_type="NAKED_PUT",
            contract_symbol=f"{symbol}_PUT_{strikes['naked_puts']}",
            quantity=-position_size * 2,
            strike=strikes['naked_puts'],
            expiry=strikes['expiry_date']
        )
        
        position.add_component(debit_long)
        position.add_component(debit_short) 
        position.add_component(naked_put)
        position.metadata = {'tom_king_structure': '1-1-2_put_ratio'}
        
        self.positions[position_id] = position
        self.algo.Log(f"✅ Created complete LT112 position: {position_id}")
        return position_id
        
    def close_lt112_naked_puts_only(self, position_id: str) -> bool:
        """Close only the naked puts, keep debit spread"""
        if position_id in self.positions:
            position = self.positions[position_id]
            naked_component = position.remove_component(f"{position_id}_NAKED_PUT")
            if naked_component:
                self.algo.Log(f"✅ Closed LT112 naked puts only: {position_id}")
                return True
        return False
        
    def close_lt112_debit_spread_only(self, position_id: str) -> bool:
        """Close only the debit spread, keep naked puts"""
        if position_id in self.positions:
            position = self.positions[position_id]
            success = True
            success &= position.remove_component(f"{position_id}_DEBIT_LONG") is not None
            success &= position.remove_component(f"{position_id}_DEBIT_SHORT") is not None
            if success:
                self.algo.Log(f"✅ Closed LT112 debit spread only: {position_id}")
            return success
        return False
        
    # ================================
    # GENERAL POSITION MANAGEMENT
    # ================================
    
    def get_positions_for_symbol(self, symbol: str, strategy: str = None) -> List[MultiLegPosition]:
        """Get all positions for a symbol, optionally filtered by strategy"""
        positions = [p for p in self.positions.values() if p.symbol == symbol]
        if strategy:
            positions = [p for p in positions if p.strategy == strategy]
        return positions
        
    def update_component_prices(self, updates: Dict[str, float]):
        """Update current prices for all components"""
        for position in self.positions.values():
            for component in position.components.values():
                if str(component.contract_symbol) in updates:
                    component.current_price = updates[str(component.contract_symbol)]
                    # Calculate P&L (simplified)
                    if component.quantity > 0:  # Long position
                        component.pnl = (component.current_price - component.entry_price) * component.quantity * 100
                    else:  # Short position  
                        component.pnl = (component.entry_price - component.current_price) * abs(component.quantity) * 100
                        
    def get_management_actions(self) -> List[Dict]:
        """Get all recommended management actions across all positions"""
        actions = []
        
        for position in self.positions.values():
            if position.strategy == "IPMCC":
                actions.extend(self._get_ipmcc_actions(position))
            elif position.strategy == "LT112":
                actions.extend(self._get_lt112_actions(position))
                
        return actions
        
    def _get_ipmcc_actions(self, position: MultiLegPosition) -> List[Dict]:
        """Get management actions for IPMCC positions"""
        actions = []
        
        # Check weekly calls for roll/expiry
        weekly_calls = [c for c in position.components.values() if c.leg_type.startswith("WEEKLY_CALL")]
        for weekly in weekly_calls:
            days_to_expiry = (weekly.expiry - self.algo.Time).days
            if days_to_expiry <= 1:  # Friday expiry
                profit_pct = (weekly.pnl / (abs(weekly.entry_price * weekly.quantity * 100))) * 100
                if profit_pct >= 50:  # 50% profit target
                    actions.append({
                        'position_id': position.position_id,
                        'component_id': weekly.component_id,
                        'action': 'CLOSE_COMPONENT',
                        'reason': f'Weekly call 50% profit ({profit_pct:.1f}%)',
                        'priority': 'MEDIUM'
                    })
                else:
                    actions.append({
                        'position_id': position.position_id, 
                        'component_id': weekly.component_id,
                        'action': 'ROLL_WEEKLY_CALL',
                        'reason': 'Weekly call approaching expiry',
                        'priority': 'HIGH'
                    })
        
        return actions
        
    def _get_lt112_actions(self, position: MultiLegPosition) -> List[Dict]:
        """Get management actions for LT112 positions"""
        actions = []
        
        # Check naked puts for 90% profit target
        naked_puts = position.get_components_by_type("NAKED_PUT")
        for naked in naked_puts:
            if naked.pnl > 0:
                profit_pct = (naked.pnl / (abs(naked.entry_price * naked.quantity * 100))) * 100
                if profit_pct >= 90:  # Tom King 90% target
                    actions.append({
                        'position_id': position.position_id,
                        'component_id': naked.component_id,
                        'action': 'CLOSE_COMPONENT',
                        'reason': f'Naked puts 90% profit ({profit_pct:.1f}%)',
                        'priority': 'HIGH'
                    })
                    
        # Check debit spread for 50% profit target
        debit_components = position.get_components_by_type("DEBIT_LONG") + position.get_components_by_type("DEBIT_SHORT")
        if len(debit_components) == 2:
            debit_pnl = sum(c.pnl for c in debit_components)
            debit_cost = sum(abs(c.entry_price * c.quantity * 100) for c in debit_components)
            if debit_cost > 0:
                debit_profit_pct = (debit_pnl / debit_cost) * 100
                if debit_profit_pct >= 50:  # 50% profit target
                    actions.append({
                        'position_id': position.position_id,
                        'component_ids': [c.component_id for c in debit_components],
                        'action': 'CLOSE_DEBIT_SPREAD',
                        'reason': f'Debit spread 50% profit ({debit_profit_pct:.1f}%)',
                        'priority': 'MEDIUM'
                    })
        
        return actions