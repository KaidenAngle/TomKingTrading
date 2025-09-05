# Tom King Trading Framework - Position Exit Manager
# Implements profit targets, stop losses, and 21 DTE exit rules

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum

class ExitReason(Enum):
    """Reasons for position exit"""
    PROFIT_TARGET = "profit_target"
    STOP_LOSS = "stop_loss"
    DTE_EXIT = "21_dte_exit"
    DEFENSIVE = "defensive_exit"
    ROLLING = "rolling"
    MANUAL = "manual_exit"
    EXPIRY = "expiry"
    ASSIGNMENT_RISK = "assignment_risk"
    CORRELATION_VIOLATION = "correlation_violation"
    VIX_SPIKE = "vix_spike"
    AUGUST_2024_PROTECTION = "august_2024_protection"

class PositionExitManager:
    """
    Manages position exits based on Tom King specifications
    
    Key Features:
    - 50% profit target for most strategies
    - 25% profit target for 0DTE
    - 200% stop loss (2x credit received)
    - 21 DTE exit for all positions
    - Defensive exits during market stress
    - Assignment risk management
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Tom King exit parameters
        self.EXIT_PARAMETERS = {
            'LT112': {
                'profit_target': 0.50,      # Exit at 50% of max profit
                'stop_loss': 2.00,          # Exit at 200% loss (2x credit)
                'dte_exit': 21,             # Exit at 21 DTE
                'min_hold_days': 0          # Can exit immediately if profit target hit
            },
            'FRIDAY_0DTE': {
                'profit_target': 0.25,      # Exit at 25% for 0DTE
                'stop_loss': 2.00,          # 200% stop loss
                'dte_exit': 0,              # Same day expiry
                'min_hold_days': 0
            },
            'FUTURES_STRANGLE': {
                'profit_target': 0.50,      # Exit at 50% of credit
                'stop_loss': 2.00,          # 200% stop loss
                'dte_exit': 21,             # Exit at 21 DTE
                'min_hold_days': 0
            },
            'IPMCC': {
                'profit_target': 0.50,      # Exit short calls at 50%
                'stop_loss': None,          # No stop loss for LEAP
                'dte_exit': 21,             # Exit short calls at 21 DTE
                'min_hold_days': 30         # Hold LEAP at least 30 days
            },
            'LEAP_LADDER': {
                'profit_target': 1.00,      # Exit at 100% profit (double)
                'stop_loss': 0.50,          # Exit at 50% loss
                'dte_exit': 90,             # Exit with 90 DTE remaining
                'min_hold_days': 180        # Hold at least 6 months
            }
        }
        
        # Assignment risk thresholds
        self.ASSIGNMENT_THRESHOLDS = {
            'short_put_itm_threshold': 0.02,    # Exit if put > 2% ITM
            'short_call_itm_threshold': 0.01,   # Exit if call > 1% ITM  
            'dte_assignment_check': 7,          # Start checking < 7 DTE
            'dividend_buffer_days': 3           # Exit 3 days before ex-dividend
        }
        
        # Defensive exit thresholds
        self.DEFENSIVE_THRESHOLDS = {
            'vix_spike': 35,                    # Exit if VIX > 35
            'vix_rate_of_change': 0.50,         # Exit if VIX up 50% in a day
            'portfolio_drawdown': 0.15,         # Exit if portfolio down 15%
            'august_2024_pattern': True          # Enable August 2024 protection
        }
        
        # Track exit statistics
        self.exit_stats = {
            'profit_targets_hit': 0,
            'stop_losses_hit': 0,
            'dte_exits': 0,
            'defensive_exits': 0,
            'total_exits': 0
        }
        
        self.algorithm.Log("✅ POSITION EXIT MANAGER INITIALIZED")
    
    def CheckPositionExits(self, positions: Dict) -> List[Dict]:
        """
        Check all positions for exit conditions
        
        Args:
            positions: Dictionary of active positions
        
        Returns:
            List of positions that should be exited with reasons
        """
        positions_to_exit = []
        
        for position_id, position in positions.items():
            if position.get('status') != 'open':
                continue
            
            # Check each exit condition
            exit_checks = [
                self._check_profit_target(position),
                self._check_stop_loss(position),
                self._check_dte_exit(position),
                self._check_assignment_risk(position),
                self._check_defensive_exit(position)
            ]
            
            # Find first triggered exit
            for check_result in exit_checks:
                if check_result['should_exit']:
                    positions_to_exit.append({
                        'position_id': position_id,
                        'position': position,
                        'exit_reason': check_result['reason'],
                        'details': check_result.get('details', '')
                    })
                    break
        
        return positions_to_exit
    
    def _check_profit_target(self, position: Dict) -> Dict:
        """Check if position has hit profit target"""
        try:
            position_type = self._get_position_type(position)
            params = self.EXIT_PARAMETERS.get(position_type, self.EXIT_PARAMETERS['LT112'])
            
            if params['profit_target'] is None:
                return {'should_exit': False, 'reason': None}
            
            # Calculate current P&L
            current_pnl = self._calculate_position_pnl(position)
            max_profit = position.get('max_profit', position.get('credit', 0))
            
            if max_profit > 0:
                profit_pct = current_pnl / max_profit
                
                if profit_pct >= params['profit_target']:
                    self.algorithm.Log(f"🎯 PROFIT TARGET HIT: {position['position_id']}")
                    self.algorithm.Log(f"   P&L: ${current_pnl:.2f} ({profit_pct:.1%} of max)")
                    
                    return {
                        'should_exit': True,
                        'reason': ExitReason.PROFIT_TARGET,
                        'details': f"Profit target {params['profit_target']:.0%} reached"
                    }
            
            return {'should_exit': False, 'reason': None}
            
        except Exception as e:
            self.algorithm.Error(f"Error checking profit target: {e}")
            return {'should_exit': False, 'reason': None}
    
    def _check_stop_loss(self, position: Dict) -> Dict:
        """Check if position has hit stop loss"""
        try:
            position_type = self._get_position_type(position)
            params = self.EXIT_PARAMETERS.get(position_type, self.EXIT_PARAMETERS['LT112'])
            
            if params['stop_loss'] is None:
                return {'should_exit': False, 'reason': None}
            
            # Calculate current loss
            current_pnl = self._calculate_position_pnl(position)
            max_profit = position.get('max_profit', position.get('credit', 0))
            
            if max_profit > 0:
                # Loss is negative P&L relative to credit received
                loss_multiple = abs(current_pnl) / max_profit if current_pnl < 0 else 0
                
                if loss_multiple >= params['stop_loss']:
                    self.algorithm.Log(f"🛑 STOP LOSS HIT: {position['position_id']}")
                    self.algorithm.Log(f"   Loss: ${abs(current_pnl):.2f} ({loss_multiple:.1f}x credit)")
                    
                    return {
                        'should_exit': True,
                        'reason': ExitReason.STOP_LOSS,
                        'details': f"Stop loss {params['stop_loss']:.0f}x reached"
                    }
            
            return {'should_exit': False, 'reason': None}
            
        except Exception as e:
            self.algorithm.Error(f"Error checking stop loss: {e}")
            return {'should_exit': False, 'reason': None}
    
    def _check_dte_exit(self, position: Dict) -> Dict:
        """Check if position should exit based on DTE"""
        try:
            position_type = self._get_position_type(position)
            params = self.EXIT_PARAMETERS.get(position_type, self.EXIT_PARAMETERS['LT112'])
            
            expiry = position.get('expiry')
            if not expiry:
                return {'should_exit': False, 'reason': None}
            
            # Calculate current DTE
            current_dte = (expiry - self.algorithm.Time).days
            
            if current_dte <= params['dte_exit']:
                self.algorithm.Log(f"📅 21 DTE EXIT: {position['position_id']}")
                self.algorithm.Log(f"   Current DTE: {current_dte}")
                
                return {
                    'should_exit': True,
                    'reason': ExitReason.DTE_EXIT,
                    'details': f"21 DTE rule triggered at {current_dte} DTE"
                }
            
            return {'should_exit': False, 'reason': None}
            
        except Exception as e:
            self.algorithm.Error(f"Error checking DTE exit: {e}")
            return {'should_exit': False, 'reason': None}
    
    def _check_assignment_risk(self, position: Dict) -> Dict:
        """Check for assignment risk on short options"""
        try:
            # Only check positions with short options
            if position.get('type') not in ['PUT_SPREAD', 'STRANGLE', 'IRON_CONDOR']:
                return {'should_exit': False, 'reason': None}
            
            expiry = position.get('expiry')
            if not expiry:
                return {'should_exit': False, 'reason': None}
            
            current_dte = (expiry - self.algorithm.Time).days
            
            # Only check near expiry
            if current_dte > self.ASSIGNMENT_THRESHOLDS['dte_assignment_check']:
                return {'should_exit': False, 'reason': None}
            
            # Check if short strikes are ITM
            underlying = position.get('underlying')
            if underlying and underlying in self.algorithm.Securities:
                underlying_price = self.algorithm.Securities[underlying].Price
                
                # Check short put
                short_put_strike = position.get('short_strike') or position.get('put_strike')
                if short_put_strike:
                    put_itm_pct = (short_put_strike - underlying_price) / underlying_price
                    if put_itm_pct > self.ASSIGNMENT_THRESHOLDS['short_put_itm_threshold']:
                        self.algorithm.Log(f"⚠️ ASSIGNMENT RISK: {position['position_id']}")
                        self.algorithm.Log(f"   Short put {put_itm_pct:.1%} ITM")
                        
                        return {
                            'should_exit': True,
                            'reason': ExitReason.ASSIGNMENT_RISK,
                            'details': f"Short put {put_itm_pct:.1%} ITM with {current_dte} DTE"
                        }
                
                # Check short call
                short_call_strike = position.get('call_strike')
                if short_call_strike:
                    call_itm_pct = (underlying_price - short_call_strike) / underlying_price
                    if call_itm_pct > self.ASSIGNMENT_THRESHOLDS['short_call_itm_threshold']:
                        self.algorithm.Log(f"⚠️ ASSIGNMENT RISK: {position['position_id']}")
                        self.algorithm.Log(f"   Short call {call_itm_pct:.1%} ITM")
                        
                        return {
                            'should_exit': True,
                            'reason': ExitReason.ASSIGNMENT_RISK,
                            'details': f"Short call {call_itm_pct:.1%} ITM with {current_dte} DTE"
                        }
            
            return {'should_exit': False, 'reason': None}
            
        except Exception as e:
            self.algorithm.Error(f"Error checking assignment risk: {e}")
            return {'should_exit': False, 'reason': None}
    
    def _check_defensive_exit(self, position: Dict) -> Dict:
        """Check for defensive exit conditions"""
        try:
            # Check VIX spike
            if "VIX" in self.algorithm.Securities:
                vix = self.algorithm.Securities["VIX"].Price
                
                if vix > self.DEFENSIVE_THRESHOLDS['vix_spike']:
                    self.algorithm.Log(f"🚨 DEFENSIVE EXIT: {position['position_id']}")
                    self.algorithm.Log(f"   VIX spike to {vix:.1f}")
                    
                    return {
                        'should_exit': True,
                        'reason': ExitReason.VIX_SPIKE,
                        'details': f"VIX spike to {vix:.1f}"
                    }
            
            # Check portfolio drawdown
            portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
            starting_value = getattr(self.algorithm, 'starting_portfolio_value', 75000)
            drawdown = (starting_value - portfolio_value) / starting_value
            
            if drawdown > self.DEFENSIVE_THRESHOLDS['portfolio_drawdown']:
                self.algorithm.Log(f"🚨 DEFENSIVE EXIT: {position['position_id']}")
                self.algorithm.Log(f"   Portfolio drawdown {drawdown:.1%}")
                
                return {
                    'should_exit': True,
                    'reason': ExitReason.DEFENSIVE,
                    'details': f"Portfolio drawdown {drawdown:.1%}"
                }
            
            return {'should_exit': False, 'reason': None}
            
        except Exception as e:
            self.algorithm.Error(f"Error checking defensive exit: {e}")
            return {'should_exit': False, 'reason': None}
    
    def _calculate_position_pnl(self, position: Dict) -> float:
        """
        Calculate current P&L for a position using real option pricing
        
        Uses Greeks engine to calculate theoretical values and compare
        to entry prices to determine current profit/loss
        """
        try:
            # Get position details
            underlying = position.get('underlying')
            if not underlying or underlying not in self.algorithm.Securities:
                return 0
            
            underlying_price = self.algorithm.Securities[underlying].Price
            entry_time = position.get('entry_time', self.algorithm.Time)
            
            # Get Greeks engine if available
            if not hasattr(self.algorithm, 'greeks_engine'):
                return self._calculate_simplified_pnl(position)
            
            position_greeks = self.algorithm.greeks_engine.CalculatePositionGreeks(position)
            current_theoretical_value = position_greeks.get('total_theoretical_value', 0)
            
            # Calculate P&L based on position type
            position_type = self._get_position_type(position)
            
            if position_type in ['LT112', 'FUTURES_STRANGLE']:
                # For credit spreads/strangles: P&L = Credit - Current Value
                entry_credit = position.get('max_profit', position.get('credit', 0))
                current_cost = self._estimate_position_cost(position, underlying_price)
                pnl = entry_credit - current_cost
                
            elif position_type == 'FRIDAY_0DTE':
                # For iron condors: Similar to credit spreads
                entry_credit = position.get('credit', 0)
                current_cost = self._estimate_position_cost(position, underlying_price)
                pnl = entry_credit - current_cost
                
            elif position_type in ['IPMCC', 'LEAP_LADDER']:
                # For long positions: Current Value - Entry Cost
                entry_cost = position.get('entry_cost', 0)
                pnl = current_theoretical_value - entry_cost
                
            else:
                # Default calculation
                pnl = self._calculate_simplified_pnl(position)
            
            return pnl
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating P&L: {e}")
            return self._calculate_simplified_pnl(position)
    
    def _calculate_simplified_pnl(self, position: Dict) -> float:
        """
        Simplified P&L calculation when Greeks engine not available
        """
        try:
            entry_time = position.get('entry_time', self.algorithm.Time)
            days_held = (self.algorithm.Time - entry_time).days
            max_profit = position.get('max_profit', position.get('credit', 100))
            
            # Simple time decay model
            decay_rate = 0.015 * days_held  # 1.5% per day
            current_pnl = max_profit * min(decay_rate, 0.6)  # Cap at 60% profit
            
            return current_pnl
            
        except:
            return 0
    
    def _estimate_position_cost(self, position: Dict, underlying_price: float) -> float:
        """
        Estimate current cost to close a position
        """
        try:
            position_type = position.get('type')
            if hasattr(position_type, 'value'):
                pos_type = position_type.value
            else:
                pos_type = str(position_type)
            
            # Estimate based on moneyness and time decay
            if pos_type == 'PUT_SPREAD':
                short_strike = position.get('short_strike', 0)
                long_strike = position.get('long_strike', 0)
                
                if short_strike and long_strike:
                    # Estimate intrinsic value
                    short_intrinsic = max(0, short_strike - underlying_price)
                    long_intrinsic = max(0, long_strike - underlying_price)
                    intrinsic_spread = short_intrinsic - long_intrinsic
                    
                    # Add time value estimate
                    days_to_expiry = (position.get('expiry', self.algorithm.Time).date() - self.algorithm.Time.date()).days
                    time_value = max(0, (days_to_expiry / 45.0) * 50)  # Rough time value
                    
                    return intrinsic_spread + time_value
            
            elif pos_type == 'STRANGLE':
                put_strike = position.get('put_strike', 0)
                call_strike = position.get('call_strike', 0)
                
                if put_strike and call_strike:
                    # Estimate intrinsic values
                    put_intrinsic = max(0, put_strike - underlying_price)
                    call_intrinsic = max(0, underlying_price - call_strike)
                    
                    # Add time value
                    days_to_expiry = (position.get('expiry', self.algorithm.Time).date() - self.algorithm.Time.date()).days
                    time_value = max(0, (days_to_expiry / 45.0) * 75)  # Higher time value for strangles
                    
                    return put_intrinsic + call_intrinsic + time_value
            
            elif pos_type == 'IRON_CONDOR':
                # Iron condor cost estimate
                days_to_expiry = (position.get('expiry', self.algorithm.Time).date() - self.algorithm.Time.date()).days
                time_decay_factor = max(0, 1 - (days_to_expiry / 45.0))
                max_loss = position.get('max_loss', 100)
                
                return max_loss * (1 - time_decay_factor * 0.7)  # 70% time decay benefit
            
            # Default estimate
            return 25.0
            
        except Exception as e:
            self.algorithm.Error(f"Error estimating position cost: {e}")
            return 25.0
    
    def _get_position_type(self, position: Dict) -> str:
        """Determine position type for exit parameters"""
        position_type_map = {
            'PUT_SPREAD': 'LT112',
            'IRON_CONDOR': 'FRIDAY_0DTE',
            'STRANGLE': 'FUTURES_STRANGLE',
            'FUTURES_STRANGLE': 'FUTURES_STRANGLE',
            'SINGLE_OPTION': 'IPMCC',
            'BUTTERFLY': 'LT112',
            'CALENDAR': 'LT112'
        }
        
        pos_type = position.get('type')
        if hasattr(pos_type, 'value'):
            pos_type = pos_type.value
        
        return position_type_map.get(pos_type, 'LT112')
    
    def ExecuteExits(self, positions_to_exit: List[Dict], execution_engine) -> Dict:
        """
        Execute the position exits
        
        Args:
            positions_to_exit: List of positions to exit
            execution_engine: The execution engine to use for closing
        
        Returns:
            Dictionary of exit results
        """
        results = {}
        
        for exit_info in positions_to_exit:
            position_id = exit_info['position_id']
            reason = exit_info['exit_reason']
            
            try:
                # Execute the exit through execution engine
                success = execution_engine.close_position(position_id, reason.value)
                
                if success:
                    self.algorithm.Log(f"✅ Position {position_id} closed: {reason.value}")
                    self._update_exit_statistics(reason)
                    results[position_id] = {'success': True, 'reason': reason.value}
                else:
                    self.algorithm.Log(f"❌ Failed to close {position_id}")
                    results[position_id] = {'success': False, 'reason': 'execution_failed'}
                    
            except Exception as e:
                self.algorithm.Error(f"Error executing exit for {position_id}: {e}")
                results[position_id] = {'success': False, 'error': str(e)}
        
        return results
    
    def _update_exit_statistics(self, reason: ExitReason):
        """Update exit statistics"""
        self.exit_stats['total_exits'] += 1
        
        if reason == ExitReason.PROFIT_TARGET:
            self.exit_stats['profit_targets_hit'] += 1
        elif reason == ExitReason.STOP_LOSS:
            self.exit_stats['stop_losses_hit'] += 1
        elif reason == ExitReason.DTE_EXIT:
            self.exit_stats['dte_exits'] += 1
        elif reason in [ExitReason.DEFENSIVE, ExitReason.VIX_SPIKE]:
            self.exit_stats['defensive_exits'] += 1
    
    def GetExitStatistics(self) -> Dict:
        """Get exit statistics summary"""
        return self.exit_stats.copy()
    
    def LogExitSummary(self):
        """Log summary of exit statistics"""
        self.algorithm.Log("\n📊 POSITION EXIT SUMMARY:")
        self.algorithm.Log(f"  Total Exits: {self.exit_stats['total_exits']}")
        self.algorithm.Log(f"  Profit Targets: {self.exit_stats['profit_targets_hit']}")
        self.algorithm.Log(f"  Stop Losses: {self.exit_stats['stop_losses_hit']}")
        self.algorithm.Log(f"  21 DTE Exits: {self.exit_stats['dte_exits']}")
        self.algorithm.Log(f"  Defensive Exits: {self.exit_stats['defensive_exits']}")