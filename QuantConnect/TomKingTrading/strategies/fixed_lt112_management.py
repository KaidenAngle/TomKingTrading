#!/usr/bin/env python3
"""
FIXED LT112 Management Logic - Individual Leg Management
Handles partial closes and component-level management
"""

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class FixedLT112Management:
    """
    Fixed LT112 management with individual component handling
    Allows closing naked puts while keeping debit spread, etc.
    """
    
    def __init__(self, algorithm, position_state_manager):
        self.algo = algorithm
        self.psm = position_state_manager
        
        # Tom King LT112 Parameters
        self.naked_put_profit_target = 0.90  # 90% profit target for naked puts
        self.debit_spread_profit_target = 0.50  # 50% profit target for debit spread
        self.max_loss_trigger = 2.00  # 200% loss trigger
        self.defensive_dte = 21  # 21 DTE defensive management
        
    def analyze_lt112_positions(self, current_positions: List[Dict]) -> List[Dict]:
        """
        FIXED analysis that provides component-level management actions
        """
        management_actions = []
        
        # Get all LT112 positions from position state manager
        lt112_positions = [p for p in self.psm.positions.values() if p.strategy == "LT112"]
        
        for position in lt112_positions:
            actions = self._analyze_individual_position(position)
            management_actions.extend(actions)
            
        return management_actions
        
    def _analyze_individual_position(self, position) -> List[Dict]:
        """Analyze individual LT112 position for component-level management"""
        actions = []
        current_time = self.algo.Time
        
        # Get individual components
        naked_puts = position.get_components_by_type("NAKED_PUT")
        debit_long = position.get_components_by_type("DEBIT_LONG")
        debit_short = position.get_components_by_type("DEBIT_SHORT")
        
        # Update component prices
        self._update_component_prices(position)
        
        # Analyze naked puts separately
        for naked_put in naked_puts:
            if naked_put.status == "OPEN":
                naked_actions = self._analyze_naked_put_component(position.position_id, naked_put)
                actions.extend(naked_actions)
                
        # Analyze debit spread as a unit
        if len(debit_long) > 0 and len(debit_short) > 0:
            debit_actions = self._analyze_debit_spread_components(position.position_id, debit_long[0], debit_short[0])
            actions.extend(debit_actions)
            
        # Check overall position for defensive management
        dte = (naked_puts[0].expiry - current_time).days if naked_puts else 0
        if dte <= self.defensive_dte:
            defensive_actions = self._analyze_defensive_management(position)
            actions.extend(defensive_actions)
            
        return actions
        
    def _analyze_naked_put_component(self, position_id: str, naked_put) -> List[Dict]:
        """Analyze naked put component for management actions"""
        actions = []
        
        if naked_put.pnl > 0:
            # Calculate profit percentage
            initial_credit = abs(naked_put.entry_price * naked_put.quantity * 100)
            if initial_credit > 0:
                profit_pct = (naked_put.pnl / initial_credit)
                
                # Check for 90% profit target
                if profit_pct >= self.naked_put_profit_target:
                    actions.append({
                        'position_id': position_id,
                        'component_id': naked_put.component_id,
                        'action': 'CLOSE_NAKED_PUTS_ONLY',
                        'reason': f'Naked puts hit 90% profit target ({profit_pct:.1%})',
                        'priority': 'HIGH',
                        'expected_profit': naked_put.pnl,
                        'tom_king_rule': 'Close naked puts at 90% profit, keep debit spread'
                    })
                    
        # Check for loss situation
        elif naked_put.pnl < 0:
            initial_credit = abs(naked_put.entry_price * naked_put.quantity * 100)
            if initial_credit > 0:
                loss_pct = abs(naked_put.pnl / initial_credit)
                
                # Check for max loss trigger (200%)
                if loss_pct >= self.max_loss_trigger:
                    actions.append({
                        'position_id': position_id,
                        'component_id': naked_put.component_id,
                        'action': 'CLOSE_ENTIRE_POSITION',
                        'reason': f'Max loss trigger on naked puts ({loss_pct:.1%})',
                        'priority': 'URGENT',
                        'expected_loss': naked_put.pnl
                    })
                    
        return actions
        
    def _analyze_debit_spread_components(self, position_id: str, debit_long, debit_short) -> List[Dict]:
        """Analyze debit spread components as a unit"""
        actions = []
        
        # Calculate combined debit spread P&L
        debit_pnl = debit_long.pnl + debit_short.pnl
        debit_cost = abs(debit_long.entry_price * debit_long.quantity * 100) + abs(debit_short.entry_price * abs(debit_short.quantity) * 100)
        
        if debit_cost > 0 and debit_pnl > 0:
            profit_pct = debit_pnl / debit_cost
            
            # Check for 50% profit target on debit spread
            if profit_pct >= self.debit_spread_profit_target:
                actions.append({
                    'position_id': position_id,
                    'component_ids': [debit_long.component_id, debit_short.component_id],
                    'action': 'CLOSE_DEBIT_SPREAD_ONLY',
                    'reason': f'Debit spread hit 50% profit target ({profit_pct:.1%})',
                    'priority': 'MEDIUM',
                    'expected_profit': debit_pnl,
                    'tom_king_rule': 'Close debit spread at 50% profit'
                })
                
        return actions
        
    def _analyze_defensive_management(self, position) -> List[Dict]:
        """Tom King 21 DTE defensive management rule"""
        actions = []
        
        total_pnl = position.calculate_total_pnl()
        
        # Estimate initial credit received (simplified)
        naked_puts = position.get_components_by_type("NAKED_PUT")
        estimated_initial_credit = 0
        if naked_puts:
            estimated_initial_credit = abs(naked_puts[0].entry_price * naked_puts[0].quantity * 100)
            
        if estimated_initial_credit > 0:
            profit_pct = total_pnl / estimated_initial_credit
            
            if profit_pct < 0.25:  # Less than 25% profit at 21 DTE
                actions.append({
                    'position_id': position.position_id,
                    'action': 'CLOSE_ENTIRE_POSITION',
                    'reason': f'21 DTE defensive rule - insufficient profit ({profit_pct:.1%})',
                    'priority': 'HIGH',
                    'tom_king_rule': '21 DTE rule: close if < 25% profit'
                })
            else:
                actions.append({
                    'position_id': position.position_id,
                    'action': 'MONITOR_CLOSELY',
                    'reason': f'21 DTE - profitable position ({profit_pct:.1%}), monitor closely',
                    'priority': 'MEDIUM',
                    'tom_king_rule': '21 DTE rule: monitor profitable positions'
                })
                
        return actions
        
    def execute_management_action(self, action: Dict) -> Tuple[bool, str]:
        """Execute a specific management action"""
        try:
            action_type = action['action']
            position_id = action['position_id']
            
            if action_type == 'CLOSE_NAKED_PUTS_ONLY':
                return self._execute_close_naked_puts_only(position_id)
                
            elif action_type == 'CLOSE_DEBIT_SPREAD_ONLY':
                return self._execute_close_debit_spread_only(position_id)
                
            elif action_type == 'CLOSE_ENTIRE_POSITION':
                return self._execute_close_entire_position(position_id)
                
            elif action_type == 'MONITOR_CLOSELY':
                # Just log, no action needed
                self.algo.Log(f"📊 LT112 Monitoring: {action['reason']}")
                return True, "Monitoring position"
                
            else:
                return False, f"Unknown action type: {action_type}"
                
        except Exception as e:
            self.algo.Error(f"Error executing LT112 management action: {str(e)}")
            return False, f"Execution error: {str(e)}"
            
    def _execute_close_naked_puts_only(self, position_id: str) -> Tuple[bool, str]:
        """Close only the naked puts, keep the debit spread"""
        try:
            success = self.psm.close_lt112_naked_puts_only(position_id)
            if success:
                self.algo.Log(f"✅ LT112: Closed naked puts only, keeping debit spread - {position_id}")
                return True, "Naked puts closed successfully"
            else:
                return False, "Failed to close naked puts"
                
        except Exception as e:
            self.algo.Error(f"Error closing naked puts: {str(e)}")
            return False, f"Close error: {str(e)}"
            
    def _execute_close_debit_spread_only(self, position_id: str) -> Tuple[bool, str]:
        """Close only the debit spread, keep the naked puts"""
        try:
            success = self.psm.close_lt112_debit_spread_only(position_id)
            if success:
                self.algo.Log(f"✅ LT112: Closed debit spread only, keeping naked puts - {position_id}")
                return True, "Debit spread closed successfully"
            else:
                return False, "Failed to close debit spread"
                
        except Exception as e:
            self.algo.Error(f"Error closing debit spread: {str(e)}")
            return False, f"Close error: {str(e)}"
            
    def _execute_close_entire_position(self, position_id: str) -> Tuple[bool, str]:
        """Close the entire LT112 position"""
        try:
            position = self.psm.positions.get(position_id)
            if not position:
                return False, "Position not found"
                
            # Close all components
            success = True
            closed_components = []
            
            for component_id in list(position.components.keys()):
                component = position.remove_component(component_id)
                if component:
                    closed_components.append(component_id)
                    # Here you would execute actual market orders to close
                    # For now, just mark as closed
                else:
                    success = False
                    
            if success:
                self.algo.Log(f"✅ LT112: Closed entire position - {position_id}")
                return True, f"Entire position closed ({len(closed_components)} components)"
            else:
                return False, "Failed to close all components"
                
        except Exception as e:
            self.algo.Error(f"Error closing entire position: {str(e)}")
            return False, f"Close error: {str(e)}"
            
    def _update_component_prices(self, position):
        """Update current prices for all position components"""
        # Get current option prices from QuantConnect Securities collection
        for component in position.components.values():
            # Simulate price updates
            if hasattr(self.algo.Securities, component.contract_symbol):
                try:
                    component.current_price = float(self.algo.Securities[component.contract_symbol].Price)
                except Exception as e:
                    # Fallback to estimated pricing based on strike and underlying
                    self.algo.Debug(f"[LT112] Could not get price for {component.contract_symbol}: {e}")
                    if hasattr(component, 'strike') and underlying_price > 0:
                        # Estimate based on intrinsic value for puts
                        intrinsic = max(0, component.strike - underlying_price)
                        component.current_price = intrinsic * 0.9  # Conservative estimate
                    
    def get_lt112_position_summary(self, position_id: str) -> Optional[Dict]:
        """Get detailed summary of LT112 position components"""
        position = self.psm.positions.get(position_id)
        if not position or position.strategy != "LT112":
            self.algo.Debug(f"Position {position_id} not found or not LT112 strategy")
            return None
            
        # Update prices
        self._update_component_prices(position)
        
        # Calculate component-level metrics
        naked_puts = position.get_components_by_type("NAKED_PUT")
        debit_long = position.get_components_by_type("DEBIT_LONG")
        debit_short = position.get_components_by_type("DEBIT_SHORT")
        
        naked_pnl = sum(c.pnl for c in naked_puts)
        debit_pnl = sum(c.pnl for c in debit_long + debit_short)
        total_pnl = naked_pnl + debit_pnl
        
        summary = {
            'position_id': position_id,
            'symbol': position.symbol,
            'status': position.status,
            'entry_time': position.entry_time,
            'components': {
                'naked_puts': {
                    'count': len(naked_puts),
                    'pnl': naked_pnl,
                    'strikes': [c.strike for c in naked_puts],
                    'status': [c.status for c in naked_puts]
                },
                'debit_spread': {
                    'long_strike': debit_long[0].strike if debit_long else None,
                    'short_strike': debit_short[0].strike if debit_short else None,
                    'pnl': debit_pnl,
                    'status': f"{debit_long[0].status if debit_long else 'N/A'}/{debit_short[0].status if debit_short else 'N/A'}"
                }
            },
            'total_pnl': total_pnl,
            'days_held': (self.algo.Time - position.entry_time).days,
            'dte': (naked_puts[0].expiry - self.algo.Time).days if naked_puts else 0
        }
        
        return summary

# USAGE EXAMPLE:
\"\"\"
# In main.py Initialize():
self.position_state_manager = PositionStateManager(self)
self.fixed_lt112 = FixedLT112Management(self, self.position_state_manager)

# In position management loop:
lt112_actions = self.fixed_lt112.analyze_lt112_positions(self.active_positions)
for action in lt112_actions:
    if action['priority'] in ['URGENT', 'HIGH']:
        success, result = self.fixed_lt112.execute_management_action(action)
        self.Log(f"LT112 Action: {action['action']} - {result}")
\"\"\"