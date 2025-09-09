#!/usr/bin/env python3
"""
Tom King Trading Framework - QuantConnect-Compatible Position State Manager
Handles complex multi-legged position tracking with proper QuantConnect imports
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import json

# Import from AlgorithmImports or define if running standalone
try:
    from AlgorithmImports import *
except ImportError:
    # Define minimal stubs for standalone testing
    class OptionRight:
        Call = 0
        Put = 1
    
    class OrderStatus:
        Filled = 0
        PartiallyFilled = 1
        Canceled = 2

class PositionComponent:
    """Represents a single component of a multi-legged position"""
    
    def __init__(self, component_id: str, strategy: str, symbol: str, 
                 leg_type: str, contract_symbol: str, quantity: int, 
                 strike: float, expiry: datetime, right: OptionRight = None, multiplier: int = 100):
        self.component_id = component_id
        self.strategy = strategy
        self.symbol = symbol  # Underlying symbol
        self.leg_type = leg_type  # e.g., "LEAP_CALL", "WEEKLY_CALL", "NAKED_PUT_1", "DEBIT_LONG"
        self.contract_symbol = contract_symbol  # Actual option contract symbol
        self.quantity = quantity  # Positive = long, negative = short
        self.strike = strike
        self.expiry = expiry
        self.right = right
        self.multiplier = multiplier  # Option multiplier (usually 100 for equity options)
        self.entry_time = datetime.now()
        self.entry_price = 0.0
        self.current_price = 0.0
        self.status = "OPEN"  # OPEN, CLOSED, ROLLED, ASSIGNED
        self.pnl = 0.0
        self.days_held = 0
        
        # Order execution tracking
        self.order_ticket = None  # QuantConnect OrderTicket
        self.qc_symbol = None  # QuantConnect Symbol object
        self.actual_fill_price = None  # Actual fill price from order
        self.actual_quantity = None  # Actual filled quantity
        self.fill_time = None  # Time of fill
        self.commission = 0.0  # Commission paid
        self.order_status = "PENDING"  # PENDING, FILLED, PARTIAL, CANCELLED
        
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
            'days_held': self.days_held,
            'multiplier': self.multiplier,
            # Order execution tracking
            'order_status': self.order_status,
            'actual_fill_price': self.actual_fill_price,
            'actual_quantity': self.actual_quantity,
            'fill_time': self.fill_time.isoformat() if self.fill_time else None,
            'commission': self.commission
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

class PositionStateManagerQC:
    """
    QuantConnect-Compatible Position State Manager for multi-legged strategies
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
    
    def get_position_current_value(self, position_id: str) -> float:
        """Get current value of all components in a position"""
        if position_id not in self.positions:
            return 0
        
        position = self.positions[position_id]
        total_value = 0
        
        for component in position.components.values():
            # Calculate value based on current price and quantity
            current_price = getattr(component, 'current_price', component.entry_price)
            value = abs(current_price * component.quantity * component.multiplier)
            total_value += value
            
        return total_value
    
    def get_position_dte(self, position_id: str) -> int:
        """Get minimum DTE across all components in a position"""
        if position_id not in self.positions:
            return 999
        
        position = self.positions[position_id]
        min_dte = 999
        
        for component in position.components.values():
            if hasattr(component, 'expiry') and component.expiry:
                dte = (component.expiry - self.algo.Time).days
                min_dte = min(min_dte, dte)
                
        return min_dte
    
    def close_position(self, position_id: str) -> bool:
        """Close all components of a multi-legged position"""
        if position_id not in self.positions:
            self.algo.Log(f"[ERROR] Position {position_id} not found")
            return False
        
        position = self.positions[position_id]
        
        try:
            # Close each component
            for component in position.components.values():
                # Place closing order for each component
                if hasattr(self.algo, 'Liquidate'):
                    self.algo.Liquidate(component.contract_symbol, f"Closing {position.strategy} position")
                    
            # Remove position from tracking
            del self.positions[position_id]
            
            self.algo.Log(f"✅ Closed multi-legged position {position_id} ({position.strategy})")
            return True
            
        except Exception as e:
            self.algo.Log(f"[ERROR] Failed to close position {position_id}: {e}")
            return False
    
    # ================================
    # ORDER EXECUTION INTEGRATION
    # ================================
    
    def link_order_to_component(self, order_ticket, position_id: str, component_id: str):
        """Link QuantConnect order ticket to position component"""
        if position_id in self.positions:
            position = self.positions[position_id]
            if component_id in position.components:
                component = position.components[component_id]
                component.order_ticket = order_ticket
                component.qc_symbol = order_ticket.Symbol
                
                # Update with actual fill if order is filled
                if order_ticket.Status == OrderStatus.Filled:
                    component.actual_fill_price = order_ticket.AverageFillPrice
                    component.actual_quantity = order_ticket.Quantity
                    component.fill_time = self.algo.Time
                    component.order_status = "FILLED"
                    component.entry_price = order_ticket.AverageFillPrice
                    
                    self.algo.Log(f"[ORDER] Linked filled order to {component_id}: Price={component.actual_fill_price}, Qty={component.actual_quantity}")
                else:
                    component.order_status = str(order_ticket.Status)
                    
                return True
        return False
    
    def execute_component_order(self, component: PositionComponent, position_id: str, action: str = 'open'):
        """Execute actual QuantConnect order for component"""
        try:
            # Get the QC Symbol
            qc_symbol = self.algo.Symbol(component.contract_symbol) if isinstance(component.contract_symbol, str) else component.contract_symbol
            
            # Determine order quantity based on action
            if action == 'open':
                order_quantity = component.quantity
            elif action == 'close':
                order_quantity = -component.quantity
            else:
                self.algo.Log(f"[ERROR] Unknown action: {action}")
                return None
            
            # Place the order
            ticket = self.algo.MarketOrder(qc_symbol, order_quantity, tag=f"{component.strategy}_{component.leg_type}")
            
            # Link order to position tracking
            self.link_order_to_component(ticket, position_id, component.component_id)
            
            self.algo.Log(f"[ORDER] Placed {action} order for {component.component_id}: Symbol={qc_symbol}, Qty={order_quantity}")
            
            return ticket
            
        except Exception as e:
            self.algo.Log(f"[ERROR] Failed to execute order for {component.component_id}: {e}")
            return None
    
    def execute_position_orders(self, position_id: str, action: str = 'open'):
        """Execute orders for all components of a position"""
        if position_id not in self.positions:
            self.algo.Log(f"[ERROR] Position {position_id} not found")
            return []
        
        position = self.positions[position_id]
        tickets = []
        
        for component in position.components.values():
            if component.status == "OPEN" and component.order_status != "FILLED":
                ticket = self.execute_component_order(component, position_id, action)
                if ticket:
                    tickets.append(ticket)
        
        self.algo.Log(f"[ORDER] Executed {len(tickets)} orders for position {position_id}")
        return tickets
    
    def update_fills_from_tickets(self, position_id: str):
        """Update component fill information from order tickets"""
        if position_id not in self.positions:
            return
        
        position = self.positions[position_id]
        
        for component in position.components.values():
            if component.order_ticket:
                ticket = component.order_ticket
                
                # Update fill status
                if ticket.Status == OrderStatus.Filled:
                    if component.order_status != "FILLED":
                        component.order_status = "FILLED"
                        component.actual_fill_price = ticket.AverageFillPrice
                        component.actual_quantity = ticket.Quantity
                        component.fill_time = ticket.Time
                        component.entry_price = ticket.AverageFillPrice
                        
                        # Calculate commission if available
                        if hasattr(ticket, 'OrderEvents') and ticket.OrderEvents:
                            total_fees = sum(event.OrderFee.Value.Amount for event in ticket.OrderEvents)
                            component.commission = float(total_fees)
                        
                        self.algo.Log(f"[FILL] Updated {component.component_id}: Price={component.actual_fill_price}, Commission={component.commission}")
                
                elif ticket.Status == OrderStatus.PartiallyFilled:
                    component.order_status = "PARTIAL"
                    if hasattr(ticket, 'QuantityFilled'):
                        component.actual_quantity = ticket.QuantityFilled
                
                elif ticket.Status == OrderStatus.Canceled:
                    component.order_status = "CANCELLED"
                    self.algo.Log(f"[ORDER] Component {component.component_id} order cancelled")
    
    def sync_with_portfolio(self):
        """Sync position tracking with actual QuantConnect portfolio"""
        portfolio_holdings = self.algo.Portfolio
        
        # Check each tracked position against actual holdings
        for position_id, position in self.positions.items():
            for component in position.components.values():
                if component.qc_symbol and component.qc_symbol in portfolio_holdings:
                    holding = portfolio_holdings[component.qc_symbol]
                    
                    # Update current values from portfolio
                    component.current_price = float(holding.Price)
                    component.pnl = float(holding.UnrealizedProfit)
                    
                    # Check for discrepancies
                    if holding.Quantity != component.quantity and component.order_status == "FILLED":
                        self.algo.Log(f"[SYNC] Discrepancy in {component.component_id}: Tracked={component.quantity}, Actual={holding.Quantity}")
                        # Could auto-correct here if desired
                        # component.actual_quantity = holding.Quantity
    
    def get_unfilled_components(self, position_id: str = None) -> List[PositionComponent]:
        """Get all components that haven't been filled yet"""
        unfilled = []
        
        positions_to_check = [self.positions[position_id]] if position_id else self.positions.values()
        
        for position in positions_to_check:
            for component in position.components.values():
                if component.order_status not in ["FILLED", "CANCELLED"]:
                    unfilled.append(component)
        
        return unfilled
    
    # ================================
    # STATE PERSISTENCE
    # ================================
    
    def serialize_state(self) -> str:
        """Serialize position state for persistence"""
        state_data = {
            'positions': {},
            'metadata': {
                'last_updated': self.algo.Time.isoformat(),
                'algorithm_version': '2.0',
                'total_positions': len(self.positions)
            }
        }
        
        for pos_id, position in self.positions.items():
            state_data['positions'][pos_id] = position.to_dict()
        
        return json.dumps(state_data, indent=2)
    
    def deserialize_state(self, state_json: str):
        """Restore position state from persistence"""
        try:
            state_data = json.loads(state_json)
            
            for pos_id, pos_data in state_data['positions'].items():
                # Recreate MultiLegPosition
                position = MultiLegPosition(
                    position_id=pos_id,
                    strategy=pos_data['strategy'],
                    symbol=pos_data['symbol']
                )
                
                # Restore metadata
                position.entry_time = datetime.fromisoformat(pos_data['entry_time'])
                position.status = pos_data['status']
                position.total_pnl = pos_data['total_pnl']
                position.metadata = pos_data.get('metadata', {})
                
                # Recreate components
                for comp_id, comp_data in pos_data['components'].items():
                    component = PositionComponent(
                        component_id=comp_id,
                        strategy=comp_data['strategy'],
                        symbol=comp_data['symbol'],
                        leg_type=comp_data['leg_type'],
                        contract_symbol=comp_data['contract_symbol'],
                        quantity=comp_data['quantity'],
                        strike=comp_data['strike'],
                        expiry=datetime.fromisoformat(comp_data['expiry']),
                        right=OptionRight.Call if comp_data.get('right') == 'OptionRight.Call' else OptionRight.Put if comp_data.get('right') == 'OptionRight.Put' else None
                    )
                    
                    # Restore component state
                    component.entry_time = datetime.fromisoformat(comp_data['entry_time'])
                    component.entry_price = comp_data['entry_price']
                    component.current_price = comp_data['current_price']
                    component.status = comp_data['status']
                    component.pnl = comp_data['pnl']
                    component.days_held = comp_data['days_held']
                    
                    # Restore order tracking state
                    component.order_status = comp_data.get('order_status', 'PENDING')
                    component.actual_fill_price = comp_data.get('actual_fill_price')
                    component.actual_quantity = comp_data.get('actual_quantity')
                    component.fill_time = datetime.fromisoformat(comp_data['fill_time']) if comp_data.get('fill_time') else None
                    component.commission = comp_data.get('commission', 0.0)
                    
                    position.add_component(component)
                
                self.positions[pos_id] = position
            
            self.algo.Log(f"[PERSISTENCE] Restored {len(self.positions)} multi-legged positions")
            
        except Exception as e:
            self.algo.Log(f"[ERROR] State deserialization failed: {e}")
    
    def get_state_summary(self) -> Dict:
        """Get summary of current state for monitoring"""
        summary = {
            'total_positions': len(self.positions),
            'positions_by_strategy': {},
            'positions_by_status': {},
            'total_components': 0,
            'unfilled_components': len(self.get_unfilled_components())
        }
        
        for position in self.positions.values():
            # Count by strategy
            if position.strategy not in summary['positions_by_strategy']:
                summary['positions_by_strategy'][position.strategy] = 0
            summary['positions_by_strategy'][position.strategy] += 1
            
            # Count by status
            if position.status not in summary['positions_by_status']:
                summary['positions_by_status'][position.status] = 0
            summary['positions_by_status'][position.status] += 1
            
            # Count total components
            summary['total_components'] += len(position.components)
        
        return summary
