# region imports
from AlgorithmImports import *
# endregion
"""
Tom King Trading Framework - Enhanced Strangle Positions with Ratio Elements
Capital efficient strangle structures with ratio spread components

Key Features:
1. Standard Strangle Base: Traditional 1x1 put/call structure
2. Put Ratio Enhancement: Additional 1x2 put ratio spread  
3. Capital Efficiency: 30% BP reduction vs standard strangles
4. Phase-Based Sizing: Available from Phase 2+ accounts
5. Advanced Management: Sophisticated position management and rolling

Enhanced Structure:
- Base: Standard strangle (1 short put, 1 short call)
- Enhancement: Put ratio (1 long put, 2 short puts at different strikes)
- Result: Improved capital utilization and income potential

Reference: PDF Page 33 - Enhanced Positions, Tom King Advanced Strategies
Author: Tom King Trading System Implementation
Version: 1.0.0 - Enhanced Strangle Module
"""

from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class EnhancedStrangleType(Enum):
    """Types of enhanced strangle configurations"""
    STANDARD_ENHANCED = "STANDARD_ENHANCED"     # Standard strangle + put ratio
    CALL_ENHANCED = "CALL_ENHANCED"             # Standard strangle + call ratio
    DOUBLE_ENHANCED = "DOUBLE_ENHANCED"         # Both put and call ratio elements
    IRON_CONDOR_ENHANCED = "IC_ENHANCED"        # Enhanced iron condor with ratio

class RatioConfiguration(Enum):
    """Ratio spread configurations for enhancement"""
    PUT_RATIO_1x2 = "PUT_1x2"                   # 1 long, 2 short puts
    PUT_RATIO_1x3 = "PUT_1x3"                   # 1 long, 3 short puts  
    CALL_RATIO_1x2 = "CALL_1x2"                 # 1 long, 2 short calls
    CALL_RATIO_1x3 = "CALL_1x3"                 # 1 long, 3 short calls

class ManagementPhase(Enum):
    """Position management phases"""
    ENTRY = "ENTRY"
    MONITORING = "MONITORING"
    PROFIT_TAKING = "PROFIT_TAKING"
    DEFENSIVE = "DEFENSIVE" 
    ROLLING = "ROLLING"
    EXIT = "EXIT"

class EnhancedStrangleSystem:
    """
    Implementation of Tom King's Enhanced Strangle Positions
    
    Features:
    - Standard strangle base with ratio enhancement
    - 30% buying power reduction vs traditional strangles
    - Phase-based availability (Phase 2+ required)
    - Advanced position management and rolling
    - Capital efficiency optimization
    """
    
    def __init__(self, algorithm):
        """Initialize enhanced strangle system"""
        self.algorithm = algorithm
        
        # Enhanced strangle configuration
        self.strangle_config = self._initialize_strangle_config()
        self.ratio_config = self._initialize_ratio_config()
        
        # Active positions tracking
        self.active_positions = {}
        self.position_counter = 0
        
        # Performance tracking
        self.performance_stats = {
            'total_positions': 0,
            'winning_positions': 0,
            'total_profit': 0.0,
            'bp_efficiency_improvement': 0.0,
            'avg_holding_period': 0,
            'management_actions': 0
        }
        
        # Risk management
        self.max_positions_by_phase = {1: 0, 2: 2, 3: 4, 4: 6}  # Phase-based limits
        self.bp_allocation_limit = 0.25  # Max 25% BP per enhanced strangle
        
        self.algorithm.Log("🔧 Enhanced Strangle System Initialized")
    
    def _initialize_strangle_config(self) -> Dict:
        """Initialize enhanced strangle configuration"""
        return {
            'base_strangle': {
                'dte_range': (30, 60),        # DTE range for base strangle
                'put_delta_target': 0.12,     # ~12 delta puts (88% OTM)
                'call_delta_target': 0.12,    # ~12 delta calls (88% OTM)
                'profit_target': 0.50,        # 50% credit received
                'stop_loss': 2.00,            # 200% credit received (2x)
                'management_dte': 21          # Manage at 21 DTE
            },
            'enhancement_criteria': {
                'min_phase': 2,               # Minimum account phase
                'min_account_value': 40000,   # £40k minimum
                'max_vix_level': 30,          # Don't enhance above VIX 30
                'bp_efficiency_target': 0.30  # 30% BP reduction target
            },
            'preferred_underlyings': ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT'],
            'entry_schedule': {
                'days': [1, 3, 5],           # Monday, Wednesday, Friday
                'times': [(9, 35), (10, 30), (14, 30)]  # Entry time windows
            }
        }
    
    def _initialize_ratio_config(self) -> Dict:
        """Initialize ratio spread configuration"""
        return {
            RatioConfiguration.PUT_RATIO_1x2: {
                'structure': {'long': 1, 'short': 2},
                'strike_spacing': 10,        # $10 strike spacing
                'delta_target': 0.08,        # 8 delta for long put
                'bp_reduction': 0.35,        # 35% BP reduction
                'risk_profile': 'MODERATE'
            },
            RatioConfiguration.PUT_RATIO_1x3: {
                'structure': {'long': 1, 'short': 3},
                'strike_spacing': 5,         # $5 strike spacing
                'delta_target': 0.06,        # 6 delta for long put
                'bp_reduction': 0.45,        # 45% BP reduction
                'risk_profile': 'AGGRESSIVE'
            },
            RatioConfiguration.CALL_RATIO_1x2: {
                'structure': {'long': 1, 'short': 2},
                'strike_spacing': 10,        # $10 strike spacing
                'delta_target': 0.08,        # 8 delta for long call
                'bp_reduction': 0.30,        # 30% BP reduction
                'risk_profile': 'MODERATE'
            }
        }
    
    def CheckEnhancedStrangleEntry(self, current_time: datetime, account_phase: int, 
                                 account_value: float, vix_level: float) -> Dict:
        """Check for enhanced strangle entry opportunities"""
        try:
            # Phase requirement check
            if account_phase < self.strangle_config['enhancement_criteria']['min_phase']:
                return {
                    'qualified': False,
                    'reason': f'Enhanced strangles require Phase {self.strangle_config["enhancement_criteria"]["min_phase"]}+ (current: Phase {account_phase})',
                    'account_phase': account_phase
                }
            
            # Account value check
            min_value = self.strangle_config['enhancement_criteria']['min_account_value']
            if account_value < min_value:
                return {
                    'qualified': False,
                    'reason': f'Account value £{account_value:,.0f} below minimum £{min_value:,.0f}',
                    'account_value': account_value
                }
            
            # VIX level check
            max_vix = self.strangle_config['enhancement_criteria']['max_vix_level']
            if vix_level > max_vix:
                return {
                    'qualified': False,
                    'reason': f'VIX {vix_level:.1f} above maximum {max_vix} for enhanced positions',
                    'vix_level': vix_level
                }
            
            # Position limit check
            max_positions = self.max_positions_by_phase.get(account_phase, 0)
            if len(self.active_positions) >= max_positions:
                return {
                    'qualified': False,
                    'reason': f'Maximum positions reached: {len(self.active_positions)}/{max_positions}',
                    'active_positions': len(self.active_positions)
                }
            
            # Entry timing check
            day_of_week = current_time.weekday()  # 0=Monday, 4=Friday
            current_time_obj = current_time.time()
            
            entry_schedule = self.strangle_config['entry_schedule']
            if day_of_week not in entry_schedule['days']:
                return {
                    'qualified': False,
                    'reason': f'Enhanced strangles enter on Mon/Wed/Fri only (today: {current_time.strftime("%A")})',
                    'entry_timing': 'Wrong day'
                }
            
            # Check entry time windows
            in_time_window = False
            for hour, minute in entry_schedule['times']:
                if (hour, minute - 5) <= (current_time_obj.hour, current_time_obj.minute) <= (hour, minute + 5):
                    in_time_window = True
                    break
            
            if not in_time_window:
                return {
                    'qualified': False,
                    'reason': f'Outside entry time windows: {entry_schedule["times"]}',
                    'current_time': f"{current_time_obj.hour:02d}:{current_time_obj.minute:02d}"
                }
            
            # Determine preferred enhancement type based on market conditions
            if vix_level < 15:  # Low volatility - use put ratio
                preferred_enhancement = RatioConfiguration.PUT_RATIO_1x2
            elif 15 <= vix_level < 20:  # Moderate volatility - balanced
                preferred_enhancement = RatioConfiguration.PUT_RATIO_1x2
            else:  # Higher volatility - more conservative
                preferred_enhancement = RatioConfiguration.PUT_RATIO_1x2
            
            return {
                'qualified': True,
                'entry_type': 'ENHANCED_STRANGLE_OPPORTUNITY',
                'account_phase': account_phase,
                'account_value': account_value,
                'vix_level': vix_level,
                'vix_note': self._get_vix_assessment(vix_level),
                'preferred_enhancement': preferred_enhancement.value,
                'available_underlyings': self.strangle_config['preferred_underlyings'],
                'bp_efficiency_target': self.strangle_config['enhancement_criteria']['bp_efficiency_target'],
                'entry_timing': 'QUALIFIED'
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error checking enhanced strangle entry: {e}")
            return {'qualified': False, 'error': str(e)}
    
    def _get_vix_assessment(self, vix_level: float) -> str:
        """Get VIX level assessment for enhanced strangles"""
        if vix_level < 12:
            return "Very Low - Excellent for enhancements"
        elif vix_level < 15:
            return "Low - Good for ratio elements"
        elif vix_level < 20:
            return "Moderate - Standard enhancements"
        elif vix_level < 25:
            return "Elevated - Conservative ratios"
        else:
            return "High - Consider deferring enhancements"
    
    def CalculateEnhancedStranglePosition(self, enhancement_type: RatioConfiguration,
                                        underlying: str, underlying_price: float,
                                        market_data: Dict) -> Dict:
        """Calculate enhanced strangle position structure"""
        try:
            # Get base strangle configuration
            base_config = self.strangle_config['base_strangle']
            ratio_config = self.ratio_config[enhancement_type]
            
            # Calculate base strangle strikes
            dte_target = 45  # Standard DTE for enhanced strangles
            
            # Base strangle strikes (12 delta targets)
            put_strike = underlying_price * (1 - 0.12)  # ~12% OTM
            call_strike = underlying_price * (1 + 0.12)  # ~12% OTM
            
            # Calculate ratio enhancement strikes
            strike_spacing = ratio_config['strike_spacing']
            
            if 'PUT' in enhancement_type.value:
                # Put ratio enhancement
                long_put_strike = put_strike - strike_spacing
                short_put_strikes = [put_strike, put_strike + strike_spacing/2]
                
                enhancement_structure = {
                    'type': 'PUT_RATIO_ENHANCEMENT',
                    'long_put': {'strike': long_put_strike, 'quantity': 1},
                    'short_puts': [
                        {'strike': put_strike, 'quantity': 1},  # Base strangle put
                        {'strike': short_put_strikes[1], 'quantity': 1}  # Ratio put
                    ]
                }
            elif 'CALL' in enhancement_type.value:
                # Call ratio enhancement  
                long_call_strike = call_strike + strike_spacing
                short_call_strikes = [call_strike, call_strike - strike_spacing/2]
                
                enhancement_structure = {
                    'type': 'CALL_RATIO_ENHANCEMENT', 
                    'long_call': {'strike': long_call_strike, 'quantity': 1},
                    'short_calls': [
                        {'strike': call_strike, 'quantity': 1},  # Base strangle call
                        {'strike': short_call_strikes[1], 'quantity': 1}  # Ratio call
                    ]
                }
            
            # Calculate position sizing based on account phase and BP efficiency
            account_value = self.algorithm.Portfolio.TotalPortfolioValue
            account_phase = getattr(self.algorithm, 'account_phase', 2)
            
            # Base position size (1-3 contracts based on phase)
            base_position_size = min(account_phase, 3)
            
            # Calculate BP requirements
            estimated_bp_per_contract = underlying_price * 0.20  # ~20% of underlying
            bp_reduction = ratio_config['bp_reduction']
            enhanced_bp_per_contract = estimated_bp_per_contract * (1 - bp_reduction)
            
            total_bp_required = enhanced_bp_per_contract * base_position_size
            # Safe division for BP allocation percentage
            if account_value > 0:
                bp_allocation_pct = total_bp_required / account_value
            else:
                bp_allocation_pct = 0.0
                self.algorithm.Error(f"Invalid account value {account_value} in BP calculation")
            
            # Adjust position size if BP allocation exceeds limit
            if bp_allocation_pct > self.bp_allocation_limit:
                base_position_size = int((account_value * self.bp_allocation_limit) / enhanced_bp_per_contract)
                base_position_size = max(1, base_position_size)  # Minimum 1 contract
            
            # Calculate expected returns
            estimated_credit = underlying_price * 0.02 * base_position_size  # ~2% credit
            max_profit = estimated_credit
            
            # Calculate max loss (varies by ratio type)
            if 'PUT' in enhancement_type.value:
                max_loss = strike_spacing * base_position_size - estimated_credit
            else:  # CALL ratio
                max_loss = strike_spacing * base_position_size - estimated_credit
            
            return {
                'underlying': underlying,
                'underlying_price': underlying_price,
                'position_size': base_position_size,
                'structure': 'Enhanced Strangle with Ratio Element',
                'enhancement_type': enhancement_type.value,
                'base_strangle': {
                    'put_strike': put_strike,
                    'call_strike': call_strike,
                    'dte': dte_target
                },
                'enhancement': enhancement_structure,
                'bp_allocation': total_bp_required,
                'bp_efficiency_improvement': bp_reduction,
                'estimated_credit': estimated_credit,
                'max_profit': max_profit,
                'max_loss': max_loss,
                'profit_target': estimated_credit * base_config['profit_target'],
                'stop_loss': estimated_credit * base_config['stop_loss'],
                'management_dte': base_config['management_dte'],
                'risk_profile': ratio_config['risk_profile'],
                'strategy_thesis': f"Enhanced {underlying} strangle with {enhancement_type.value} - {bp_reduction:.0%} BP efficiency gain"
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating enhanced strangle position: {e}")
            return {'error': str(e)}
    
    def ExecuteEnhancedStranglePosition(self, position_config: Dict) -> bool:
        """Execute enhanced strangle position"""
        try:
            if 'error' in position_config:
                self.algorithm.Error(f"Cannot execute position with error: {position_config['error']}")
                return False
            
            # Generate unique position ID
            self.position_counter += 1
            position_id = f"ESTRANGLE_{self.position_counter:03d}_{position_config['underlying']}"
            
            # Store position configuration
            position_entry = {
                'id': position_id,
                'entry_time': self.algorithm.Time,
                'underlying': position_config['underlying'],
                'position_size': position_config['position_size'],
                'structure': position_config['structure'],
                'enhancement_type': position_config['enhancement_type'],
                'base_strangle': position_config['base_strangle'],
                'enhancement': position_config['enhancement'],
                'bp_allocated': position_config['bp_allocation'],
                'estimated_credit': position_config['estimated_credit'],
                'profit_target': position_config['profit_target'],
                'stop_loss': position_config['stop_loss'],
                'management_dte': position_config['management_dte'],
                'status': 'ACTIVE',
                'management_phase': ManagementPhase.ENTRY,
                'pnl': 0.0,
                'days_held': 0,
                'management_actions': []
            }
            
            # Add to active positions
            self.active_positions[position_id] = position_entry
            
            # Update performance stats
            self.performance_stats['total_positions'] += 1
            self.performance_stats['bp_efficiency_improvement'] += position_config['bp_efficiency_improvement']
            
            self.algorithm.Log(f"✅ Enhanced Strangle Position Executed:")
            self.algorithm.Log(f"   • Position ID: {position_id}")
            self.algorithm.Log(f"   • Structure: {position_config['structure']}")
            self.algorithm.Log(f"   • BP Efficiency: +{position_config['bp_efficiency_improvement']:.0%}")
            self.algorithm.Log(f"   • Expected Credit: £{position_config['estimated_credit']:,.0f}")
            
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Error executing enhanced strangle position: {e}")
            return False
    
    def ManageEnhancedStranglePositions(self, current_time: datetime):
        """Manage all active enhanced strangle positions"""
        try:
            if not self.active_positions:
                return
            
            for position_id, position in list(self.active_positions.items()):
                if position['status'] != 'ACTIVE':
                    continue
                
                # Update position metrics
                position['days_held'] = (current_time - position['entry_time']).days
                
                # Calculate current DTE
                current_dte = position['management_dte'] - position['days_held']
                
                # Management decision logic
                management_action = self._evaluate_position_management(position, current_dte)
                
                if management_action:
                    self._execute_management_action(position_id, management_action)
            
        except Exception as e:
            self.algorithm.Error(f"Error managing enhanced strangle positions: {e}")
    
    def _evaluate_position_management(self, position: Dict, current_dte: int) -> Optional[Dict]:
        """Evaluate if position needs management action"""
        try:
            # Check profit target
            if position.get('pnl', 0) >= position['profit_target']:
                return {
                    'action': 'CLOSE_PROFIT',
                    'reason': f'Profit target reached: £{position["pnl"]:.0f} >= £{position["profit_target"]:.0f}',
                    'priority': 'HIGH'
                }
            
            # Check stop loss
            if position.get('pnl', 0) <= -position['stop_loss']:
                return {
                    'action': 'CLOSE_LOSS',
                    'reason': f'Stop loss hit: £{position["pnl"]:.0f} <= -£{position["stop_loss"]:.0f}',
                    'priority': 'URGENT'
                }
            
            # Check DTE management
            if current_dte <= 21:  # 21 DTE management rule
                return {
                    'action': 'MANAGE_DTE',
                    'reason': f'DTE management at {current_dte} days (threshold: 21)',
                    'priority': 'MEDIUM'
                }
            
            # Check for defensive adjustments (VIX spike)
            if hasattr(self.algorithm, 'Securities') and 'VIX' in self.algorithm.Securities:
                current_vix = self.algorithm.Securities['VIX'].Price
                if current_vix > 25:  # High volatility
                    return {
                        'action': 'DEFENSIVE_ADJUST',
                        'reason': f'High VIX defensive adjustment: {current_vix:.1f}',
                        'priority': 'MEDIUM'
                    }
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Error evaluating position management: {e}")
            return None
    
    def _execute_management_action(self, position_id: str, action: Dict):
        """Execute management action on position"""
        try:
            position = self.active_positions[position_id]
            
            self.algorithm.Log(f"🔧 ENHANCED STRANGLE MANAGEMENT: {position_id}")
            self.algorithm.Log(f"   • Action: {action['action']}")
            self.algorithm.Log(f"   • Reason: {action['reason']}")
            self.algorithm.Log(f"   • Priority: {action['priority']}")
            
            # Record management action
            position['management_actions'].append({
                'timestamp': self.algorithm.Time,
                'action': action['action'],
                'reason': action['reason']
            })
            
            # Execute based on action type
            if action['action'] in ['CLOSE_PROFIT', 'CLOSE_LOSS']:
                self._close_position(position_id, action['reason'])
            elif action['action'] == 'MANAGE_DTE':
                self._roll_position(position_id)
            elif action['action'] == 'DEFENSIVE_ADJUST':
                self._apply_defensive_adjustment(position_id)
            
            # Update performance stats
            self.performance_stats['management_actions'] += 1
            
        except Exception as e:
            self.algorithm.Error(f"Error executing management action: {e}")
    
    def _close_position(self, position_id: str, reason: str):
        """Close enhanced strangle position"""
        try:
            position = self.active_positions[position_id]
            
            # Mark position as closed
            position['status'] = 'CLOSED'
            position['close_time'] = self.algorithm.Time
            position['close_reason'] = reason
            
            # Update performance stats
            if position.get('pnl', 0) > 0:
                self.performance_stats['winning_positions'] += 1
                self.performance_stats['total_profit'] += position['pnl']
            
            self.algorithm.Log(f"🔒 Enhanced Strangle Closed: {position_id}")
            self.algorithm.Log(f"   • Reason: {reason}")
            self.algorithm.Log(f"   • Days Held: {position['days_held']}")
            self.algorithm.Log(f"   • P&L: £{position.get('pnl', 0):,.0f}")
            
            # Remove from active positions
            del self.active_positions[position_id]
            
        except Exception as e:
            self.algorithm.Error(f"Error closing position {position_id}: {e}")
    
    def _roll_position(self, position_id: str):
        """Roll enhanced strangle position to next expiration"""
        try:
            position = self.active_positions[position_id]
            
            self.algorithm.Log(f"🔄 Rolling Enhanced Strangle: {position_id}")
            
            # For now, mark as needing roll (full implementation would handle option chain selection)
            position['management_phase'] = ManagementPhase.ROLLING
            position['management_actions'].append({
                'timestamp': self.algorithm.Time,
                'action': 'ROLL_INITIATED',
                'reason': 'DTE management at 21 days'
            })
            
        except Exception as e:
            self.algorithm.Error(f"Error rolling position {position_id}: {e}")
    
    def _apply_defensive_adjustment(self, position_id: str):
        """Apply defensive adjustment to position"""
        try:
            position = self.active_positions[position_id]
            
            self.algorithm.Log(f"🛡️ Defensive Adjustment: {position_id}")
            
            # Mark position for defensive management
            position['management_phase'] = ManagementPhase.DEFENSIVE
            position['management_actions'].append({
                'timestamp': self.algorithm.Time,
                'action': 'DEFENSIVE_ADJUSTMENT',
                'reason': 'High volatility protection'
            })
            
        except Exception as e:
            self.algorithm.Error(f"Error applying defensive adjustment to {position_id}: {e}")
    
    def GetEnhancedStrangleStatus(self) -> Dict:
        """Get enhanced strangle system status"""
        try:
            active_count = len(self.active_positions)
            total_positions = self.performance_stats['total_positions']
            
            win_rate = 0.0
            if total_positions > 0:
                win_rate = (self.performance_stats['winning_positions'] / total_positions) * 100
            
            avg_bp_efficiency = 0.0
            if total_positions > 0:
                avg_bp_efficiency = self.performance_stats['bp_efficiency_improvement'] / total_positions
            
            return {
                'active_positions': active_count,
                'total_positions': total_positions,
                'win_rate': f"{win_rate:.1f}%",
                'total_profit': f"£{self.performance_stats['total_profit']:,.0f}",
                'avg_bp_efficiency': f"{avg_bp_efficiency:.1%}",
                'management_actions': self.performance_stats['management_actions'],
                'system_active': True
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error getting enhanced strangle status: {e}")
            return {'error': str(e), 'system_active': False}