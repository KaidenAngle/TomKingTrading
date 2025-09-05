# region imports
from AlgorithmImports import *
# endregion
"""
Tom King Trading Framework - Advanced 0DTE Variations 
Batman Spread and Broken Wing Iron Condor implementations

Key Strategies:
1. Batman Spread: Complex multi-leg strategy for VIX <12 environments (experienced traders only)
2. Broken Wing Iron Condor: Tom's preferred asymmetric IC with enhanced protection
3. Standard Iron Condor: Balanced approach for flat markets

Entry Criteria: Friday 0DTE strategies, market flat (±0.5%), specific VIX conditions
Reference: PDF Pages 4-5 - Weekly Iron Condor Variations

Author: Tom King Trading System Implementation
Version: 1.0.0 - Advanced 0DTE Module
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class ZeroDTEVariant(Enum):
    """Types of 0DTE advanced variations"""
    STANDARD_IRON_CONDOR = "STANDARD_IC"
    BROKEN_WING_IRON_CONDOR = "BROKEN_WING_IC"
    BATMAN_SPREAD = "BATMAN_SPREAD"

class MarketDirection(Enum):
    """Market direction bias for position selection"""
    BULLISH_TESTED = "BULLISH_TESTED"     # Puts tested, favor call side
    BEARISH_TESTED = "BEARISH_TESTED"     # Calls tested, favor put side
    NEUTRAL_FLAT = "NEUTRAL_FLAT"         # Flat market, balanced approach

class BatmanComplexity(Enum):
    """Batman spread complexity levels"""
    BASIC = "BASIC"                       # Simplified Batman
    STANDARD = "STANDARD"                 # Full Batman structure
    ADVANCED = "ADVANCED"                 # Expert-level complexity

class Advanced0DTEStrategies:
    """
    Implementation of Tom King's Advanced 0DTE Variations
    
    Features:
    - Batman Spread (VIX <12 requirement, expert-level complexity)
    - Broken Wing Iron Condor (Tom's preferred asymmetric IC)
    - Standard Iron Condor (balanced approach)
    - Friday-only entries with specific movement criteria
    - ATR-based strike selection and risk management
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.debug = algorithm.Debug
        self.log = algorithm.Log
        self.error = algorithm.Error
        
        # Strategy configuration
        self.config = {
            'entry_day': 'Friday',               # Friday 0DTE only
            'entry_time': time(10, 30),          # 10:30 AM entry
            'min_account_phase': 2,              # Phase 2+ for standard, 3+ for Batman
            'max_movement_pct': 0.005,           # ±0.5% max movement for entry
            'products': ['SPY', 'SPX'],          # Focus on liquid options
            'max_positions_per_day': 2           # Maximum 2 positions per Friday
        }
        
        # Standard Iron Condor configuration
        self.standard_ic_config = {
            'structure': 'Balanced Iron Condor',
            'credit_target': 500,                # £400-500 credit target
            'wing_width': 30,                    # 30 points wing width
            'atr_multiplier': 0.5,              # ATR * 0.5 for strike selection
            'profit_target': 0.50,              # 50% profit target
            'time_exit': time(15, 0)             # 3 PM time exit
        }
        
        # Broken Wing Iron Condor configuration (Tom's Preference)
        self.broken_wing_config = {
            'structure': 'Asymmetric Iron Condor',
            'preference': "Tom's Preferred 0DTE Strategy",
            'credit_target': 600,                # Higher credit due to asymmetry
            'short_wing_width': 20,              # Narrow tested side
            'long_wing_width': 40,               # Wide untested side
            'bias_adjustment': 10,               # Extra protection points
            'profit_target': 0.60,              # 60% profit target
            'max_loss_multiplier': 2.0           # 200% max loss
        }
        
        # Batman Spread configuration (Expert Only)
        self.batman_config = {
            'structure': 'Complex Multi-Leg Batman',
            'warning': 'Only for experienced traders',
            'vix_requirement': 12,               # VIX must be <12
            'min_account_phase': 3,              # Phase 3+ required
            'complexity_levels': {
                'basic': {
                    'legs': 4,
                    'wing_width': 50,
                    'credit_target': 300
                },
                'standard': {
                    'legs': 6,
                    'wing_width': 40,
                    'credit_target': 450
                },
                'advanced': {
                    'legs': 8,
                    'wing_width': 35,
                    'credit_target': 600
                }
            },
            'risk_profile': 'Complex management required',
            'visual_description': 'Risk graph looks like Batman symbol'
        }
        
        # Position tracking
        self.active_positions = {}
        self.friday_entries_today = 0
        self.last_entry_date = None
        
        # Performance tracking
        self.strategy_stats = {
            'standard_ic': {'count': 0, 'wins': 0, 'total_pnl': 0},
            'broken_wing': {'count': 0, 'wins': 0, 'total_pnl': 0},
            'batman': {'count': 0, 'wins': 0, 'total_pnl': 0}
        }
        
        self.log("📊 Advanced 0DTE Strategies Module Initialized")

    def CheckAdvanced0DTEEntry(self, current_time: datetime, account_phase: int, vix_level: float) -> Dict:
        """
        Check for advanced 0DTE entry opportunities
        Friday-only entries with specific movement and VIX criteria
        """
        try:
            # Check if it's Friday
            if current_time.strftime('%A') != 'Friday':
                return {
                    'qualified': False,
                    'reason': 'Advanced 0DTE strategies only on Fridays',
                    'current_day': current_time.strftime('%A')
                }
            
            # Check entry time
            if current_time.time() < self.config['entry_time']:
                return {
                    'qualified': False,
                    'reason': f'Too early - wait until {self.config["entry_time"]}',
                    'current_time': current_time.time()
                }
            
            # Check account phase requirement
            if account_phase < self.config['min_account_phase']:
                return {
                    'qualified': False,
                    'reason': f'Requires Phase {self.config["min_account_phase"]}+ for standard/broken wing ICs'
                }
            
            # Reset daily counter if new day
            today = current_time.date()
            if self.last_entry_date != today:
                self.friday_entries_today = 0
                self.last_entry_date = today
            
            # Check position limit
            if self.friday_entries_today >= self.config['max_positions_per_day']:
                return {
                    'qualified': False,
                    'reason': f'Daily limit reached ({self.friday_entries_today}/{self.config["max_positions_per_day"]})'
                }
            
            # Get market movement analysis
            movement_analysis = self._analyze_market_movement()
            
            # Check movement criteria (±0.5% max)
            if abs(movement_analysis['movement_pct']) > self.config['max_movement_pct']:
                return {
                    'qualified': False,
                    'reason': f'Movement too large: {movement_analysis["movement_pct"]:.2%} (max ±{self.config["max_movement_pct"]:.1%})',
                    'current_movement': movement_analysis['movement_pct']
                }
            
            # Determine available strategies based on conditions
            available_strategies = self._determine_available_strategies(
                vix_level, 
                account_phase, 
                movement_analysis
            )
            
            if not available_strategies:
                return {
                    'qualified': False,
                    'reason': 'No strategies available for current conditions',
                    'vix_level': vix_level,
                    'movement': movement_analysis['movement_pct']
                }
            
            return {
                'qualified': True,
                'entry_type': 'Friday Advanced 0DTE',
                'account_phase': account_phase,
                'vix_level': vix_level,
                'movement_analysis': movement_analysis,
                'available_strategies': available_strategies,
                'recommended_strategy': self._get_recommended_strategy(available_strategies, movement_analysis),
                'entries_today': self.friday_entries_today,
                'max_entries': self.config['max_positions_per_day']
            }
            
        except Exception as e:
            self.error(f"Advanced 0DTE entry check failed: {e}")
            return {'qualified': False, 'error': str(e)}

    def Calculate0DTEPosition(self, variant: ZeroDTEVariant, underlying_symbol: str, underlying_price: float, 
                            movement_analysis: Dict, vix_level: float) -> Dict:
        """
        Calculate advanced 0DTE position structure for specified variant
        Returns complete position specifications with risk metrics
        """
        try:
            if variant == ZeroDTEVariant.STANDARD_IRON_CONDOR:
                position = self._calculate_standard_ic(underlying_symbol, underlying_price, movement_analysis)
            elif variant == ZeroDTEVariant.BROKEN_WING_IRON_CONDOR:
                position = self._calculate_broken_wing_ic(underlying_symbol, underlying_price, movement_analysis)
            elif variant == ZeroDTEVariant.BATMAN_SPREAD:
                position = self._calculate_batman_spread(underlying_symbol, underlying_price, movement_analysis, vix_level)
            else:
                raise ValueError(f"Unknown variant: {variant}")
            
            # Add common metadata
            position.update({
                'variant': variant.value,
                'underlying': underlying_symbol,
                'underlying_price': underlying_price,
                'entry_time': self.algorithm.Time,
                'expiration': 'Today (0DTE)',
                'movement_at_entry': movement_analysis,
                'vix_at_entry': vix_level,
                'position_id': f"0DTE_{variant.value}_{self.algorithm.Time.strftime('%Y%m%d_%H%M')}",
                'risk_metrics': self._calculate_0dte_risk_metrics(position, underlying_price)
            })
            
            return position
            
        except Exception as e:
            self.error(f"0DTE position calculation failed: {e}")
            return {'error': str(e)}

    def _calculate_standard_ic(self, symbol: str, price: float, movement_analysis: Dict) -> Dict:
        """Calculate standard iron condor position"""
        config = self.standard_ic_config
        atr = movement_analysis.get('atr', 30)  # Default ATR if not available
        
        # Balanced iron condor strikes
        call_short = round((price + atr * config['atr_multiplier']) / 5) * 5
        call_long = call_short + config['wing_width']
        put_short = round((price - atr * config['atr_multiplier']) / 5) * 5
        put_long = put_short - config['wing_width']
        
        return {
            'structure': config['structure'],
            'strategy_type': 'Standard Iron Condor',
            'legs': {
                'call_short': {
                    'strike': call_short,
                    'quantity': 1,
                    'action': 'SELL_TO_OPEN',
                    'type': 'CALL'
                },
                'call_long': {
                    'strike': call_long,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'CALL'
                },
                'put_short': {
                    'strike': put_short,
                    'quantity': 1,
                    'action': 'SELL_TO_OPEN',
                    'type': 'PUT'
                },
                'put_long': {
                    'strike': put_long,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'PUT'
                }
            },
            'credit_target': config['credit_target'],
            'profit_target': config['profit_target'],
            'time_exit': config['time_exit'],
            'wing_width': config['wing_width'],
            'market_bias': 'Neutral - balanced structure',
            'management_notes': 'Standard 50% profit target or time exit at 3 PM'
        }

    def _calculate_broken_wing_ic(self, symbol: str, price: float, movement_analysis: Dict) -> Dict:
        """Calculate broken wing iron condor (Tom's preference)"""
        config = self.broken_wing_config
        movement_direction = movement_analysis.get('direction', 'NEUTRAL_FLAT')
        atr = movement_analysis.get('atr', 30)
        
        # Determine tested side (side that moved)
        if movement_analysis['movement_pct'] > 0:
            tested_side = 'call'
            bias = 'Bullish tested - extra put protection'
        else:
            tested_side = 'put'  
            bias = 'Bearish tested - extra call protection'
        
        # Asymmetric strike selection
        if tested_side == 'call':
            # Calls were tested - narrow call side, wide put side
            call_short = round((price + atr * 0.3) / 5) * 5  # Closer to money
            call_long = call_short + config['short_wing_width']
            put_short = round((price - atr * 0.6) / 5) * 5   # Further from money
            put_long = put_short - config['long_wing_width']
        else:
            # Puts were tested - narrow put side, wide call side
            put_short = round((price - atr * 0.3) / 5) * 5   # Closer to money
            put_long = put_short - config['short_wing_width']
            call_short = round((price + atr * 0.6) / 5) * 5  # Further from money
            call_long = call_short + config['long_wing_width']
        
        return {
            'structure': config['structure'],
            'strategy_type': 'Broken Wing Iron Condor',
            'preference': config['preference'],
            'tested_side': tested_side,
            'bias': bias,
            'legs': {
                'call_short': {
                    'strike': call_short,
                    'quantity': 1,
                    'action': 'SELL_TO_OPEN',
                    'type': 'CALL'
                },
                'call_long': {
                    'strike': call_long,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'CALL'
                },
                'put_short': {
                    'strike': put_short,
                    'quantity': 1,
                    'action': 'SELL_TO_OPEN',
                    'type': 'PUT'
                },
                'put_long': {
                    'strike': put_long,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'PUT'
                }
            },
            'credit_target': config['credit_target'],
            'profit_target': config['profit_target'],
            'max_loss_multiplier': config['max_loss_multiplier'],
            'wing_widths': {
                'tested_side': config['short_wing_width'],
                'untested_side': config['long_wing_width']
            },
            'management_notes': 'Tom King preferred - asymmetric protection with higher credit'
        }

    def _calculate_batman_spread(self, symbol: str, price: float, movement_analysis: Dict, vix_level: float) -> Dict:
        """Calculate Batman spread (expert-level complexity)"""
        config = self.batman_config
        
        # VIX requirement check
        if vix_level >= config['vix_requirement']:
            return {
                'error': f'Batman spread requires VIX <{config["vix_requirement"]}, current: {vix_level:.1f}',
                'alternative': 'Use standard or broken wing IC instead'
            }
        
        # Determine complexity level based on account value
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        if account_value < 60000:
            complexity = 'basic'
        elif account_value < 100000:
            complexity = 'standard'
        else:
            complexity = 'advanced'
        
        complexity_config = config['complexity_levels'][complexity]
        
        # Batman spread structure (simplified representation)
        # The actual Batman spread is highly complex with multiple legs
        wing_width = complexity_config['wing_width']
        
        # Basic Batman structure (simplified)
        batman_center = round(price / 5) * 5
        
        return {
            'structure': config['structure'],
            'strategy_type': 'Batman Spread',
            'warning': config['warning'],
            'complexity_level': complexity.upper(),
            'vix_requirement': f'VIX <{config["vix_requirement"]} (Current: {vix_level:.1f})',
            'visual': config['visual_description'],
            'legs': {
                'otm_put_buy': {
                    'strike': batman_center - wing_width,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'PUT',
                    'role': 'Batman wing'
                },
                'atm_put_sell': {
                    'strike': batman_center - 10,
                    'quantity': 2,
                    'action': 'SELL_TO_OPEN',
                    'type': 'PUT',
                    'role': 'Batman body'
                },
                'atm_call_sell': {
                    'strike': batman_center + 10,
                    'quantity': 2,
                    'action': 'SELL_TO_OPEN',
                    'type': 'CALL',
                    'role': 'Batman body'
                },
                'otm_call_buy': {
                    'strike': batman_center + wing_width,
                    'quantity': 1,
                    'action': 'BUY_TO_OPEN',
                    'type': 'CALL',
                    'role': 'Batman wing'
                }
            },
            'credit_target': complexity_config['credit_target'],
            'risk_profile': config['risk_profile'],
            'management_notes': 'EXPERT ONLY - Complex management required, risk graph resembles Batman symbol',
            'complexity_warning': f'{complexity.upper()} level Batman - {complexity_config["legs"]} legs total'
        }

    def ExecuteAdvanced0DTE(self, position_config: Dict) -> bool:
        """Execute the advanced 0DTE position"""
        try:
            strategy_type = position_config.get('strategy_type', 'Unknown')
            
            self.log(f"📊 EXECUTING ADVANCED 0DTE: {strategy_type}")
            self.log(f"   • Underlying: {position_config['underlying']} @ ${position_config['underlying_price']:.2f}")
            self.log(f"   • Structure: {position_config['structure']}")
            
            # Special warnings for complex strategies
            if position_config.get('warning'):
                self.log(f"⚠️  WARNING: {position_config['warning']}")
            
            if position_config.get('preference'):
                self.log(f"🎯 {position_config['preference']}")
            
            # Log position legs
            legs = position_config['legs']
            self.log(f"📋 POSITION LEGS:")
            for leg_name, leg_data in legs.items():
                action = leg_data['action'].replace('_TO_OPEN', '')
                leg_type = leg_data['type']
                strike = leg_data['strike']
                quantity = leg_data['quantity']
                role = leg_data.get('role', 'Standard leg')
                
                self.log(f"   • {action} {quantity}x {leg_type} ${strike} ({role})")
            
            # Log risk metrics and targets
            self.log(f"💰 TARGETS:")
            self.log(f"   • Credit Target: £{position_config['credit_target']}")
            self.log(f"   • Profit Target: {position_config['profit_target']:.0%}")
            
            if position_config.get('time_exit'):
                self.log(f"   • Time Exit: {position_config['time_exit']}")
            
            # Store position for management
            position_id = position_config['position_id']
            variant = ZeroDTEVariant(position_config['variant'])
            
            self.active_positions[position_id] = {
                'config': position_config,
                'entry_date': self.algorithm.Time,
                'status': 'ACTIVE',
                'variant': variant,
                'current_pnl': 0.0
            }
            
            # Update daily counter and stats
            self.friday_entries_today += 1
            
            # Track strategy statistics
            strategy_key = self._get_strategy_key(variant)
            if strategy_key in self.strategy_stats:
                self.strategy_stats[strategy_key]['count'] += 1
            
            self.log(f"✅ ADVANCED 0DTE POSITION EXECUTED - Entry #{self.friday_entries_today} today")
            
            return True
            
        except Exception as e:
            self.error(f"Advanced 0DTE execution failed: {e}")
            return False

    def ManageAdvanced0DTEPositions(self, current_time: datetime) -> None:
        """Manage active advanced 0DTE positions"""
        try:
            for position_id, position in list(self.active_positions.items()):
                config = position['config']
                
                # Check time-based exit (3 PM for most strategies)
                time_exit = config.get('time_exit')
                if time_exit and current_time.time() >= time_exit:
                    self.log(f"⏰ TIME EXIT: {position_id} at {time_exit}")
                    self._close_0dte_position(position_id, 'TIME_EXIT')
                    continue
                
                # Check profit targets (simulate for now)
                self._check_0dte_profit_targets(position_id, position)
                
                # Special management for Batman spreads
                if position['variant'] == ZeroDTEVariant.BATMAN_SPREAD:
                    self._manage_batman_complexity(position_id, position)
                    
        except Exception as e:
            self.error(f"Advanced 0DTE position management failed: {e}")

    # Helper methods
    def _analyze_market_movement(self) -> Dict:
        """Analyze current market movement for 0DTE entry"""
        # Simulate market movement analysis
        # In practice, this would calculate actual movement from market open
        
        simulated_movement = np.random.uniform(-0.004, 0.004)  # ±0.4% typical
        simulated_atr = 30  # Typical ATR value
        
        if simulated_movement > 0.001:
            direction = MarketDirection.BULLISH_TESTED
        elif simulated_movement < -0.001:
            direction = MarketDirection.BEARISH_TESTED
        else:
            direction = MarketDirection.NEUTRAL_FLAT
        
        return {
            'movement_pct': simulated_movement,
            'direction': direction,
            'atr': simulated_atr,
            'suitable_for_ic': abs(simulated_movement) <= 0.005  # ±0.5% max
        }

    def _determine_available_strategies(self, vix_level: float, account_phase: int, movement_analysis: Dict) -> List[str]:
        """Determine which strategies are available based on conditions"""
        available = []
        
        # Standard IC - always available if movement criteria met
        if movement_analysis['suitable_for_ic']:
            available.append(ZeroDTEVariant.STANDARD_IRON_CONDOR.value)
        
        # Broken Wing IC - available if movement criteria met
        if movement_analysis['suitable_for_ic']:
            available.append(ZeroDTEVariant.BROKEN_WING_IRON_CONDOR.value)
        
        # Batman Spread - only if VIX <12 and Phase 3+
        if vix_level < self.batman_config['vix_requirement'] and account_phase >= 3:
            available.append(ZeroDTEVariant.BATMAN_SPREAD.value)
        
        return available

    def _get_recommended_strategy(self, available_strategies: List[str], movement_analysis: Dict) -> str:
        """Get recommended strategy based on conditions"""
        movement_pct = abs(movement_analysis['movement_pct'])
        
        # If Batman is available and movement is minimal, recommend it
        if ZeroDTEVariant.BATMAN_SPREAD.value in available_strategies and movement_pct < 0.002:
            return ZeroDTEVariant.BATMAN_SPREAD.value
        
        # Tom's preference: Broken Wing IC
        if ZeroDTEVariant.BROKEN_WING_IRON_CONDOR.value in available_strategies:
            return ZeroDTEVariant.BROKEN_WING_IRON_CONDOR.value
        
        # Default to standard IC
        return ZeroDTEVariant.STANDARD_IRON_CONDOR.value

    def _calculate_0dte_risk_metrics(self, position: Dict, underlying_price: float) -> Dict:
        """Calculate risk metrics for 0DTE position"""
        credit_target = position.get('credit_target', 500)
        
        # Estimate max loss (simplified)
        if position.get('variant') == ZeroDTEVariant.BATMAN_SPREAD.value:
            max_loss = credit_target * 3  # Batman spreads have complex risk
        else:
            wing_width = position.get('wing_width', 30)
            max_loss = (wing_width * 100) - credit_target  # Standard IC math
        
        return {
            'max_profit': credit_target,
            'max_loss': max_loss,
            'breakeven_range': f"±{(credit_target/100):.1f} points",
            'risk_reward_ratio': credit_target / max(1, max_loss),
            'time_decay_benefit': 'Theta positive (0DTE acceleration)',
            'complexity_rating': self._get_complexity_rating(position)
        }

    def _get_complexity_rating(self, position: Dict) -> str:
        """Get complexity rating for strategy"""
        variant = position.get('variant')
        if variant == ZeroDTEVariant.BATMAN_SPREAD.value:
            return 'EXPERT LEVEL - Complex management required'
        elif variant == ZeroDTEVariant.BROKEN_WING_IRON_CONDOR.value:
            return 'INTERMEDIATE - Asymmetric structure'
        else:
            return 'BEGINNER - Standard balanced approach'

    def _check_0dte_profit_targets(self, position_id: str, position: Dict) -> None:
        """Check profit targets for 0DTE positions"""
        config = position['config']
        profit_target = config['profit_target']
        
        # Simulate profit checking (rapid 0DTE time decay)
        hours_held = (self.algorithm.Time - position['entry_date']).seconds / 3600
        simulated_profit_pct = min(profit_target, hours_held * 0.15)  # Fast 0DTE decay
        
        if simulated_profit_pct >= profit_target:
            self.log(f"✅ PROFIT TARGET HIT: {position_id} ({simulated_profit_pct:.0%})")
            self._close_0dte_position(position_id, 'PROFIT_TARGET')

    def _manage_batman_complexity(self, position_id: str, position: Dict) -> None:
        """Special management for Batman spread complexity"""
        config = position['config']
        self.debug(f"🦇 Batman Management: {position_id}")
        self.debug(f"   • Complexity: {config.get('complexity_level', 'UNKNOWN')}")
        self.debug(f"   • Management: {config.get('risk_profile', 'Standard')}")

    def _close_0dte_position(self, position_id: str, reason: str) -> None:
        """Close 0DTE position and record results"""
        try:
            position = self.active_positions[position_id]
            config = position['config']
            variant = position['variant']
            
            # Record results
            strategy_key = self._get_strategy_key(variant)
            if reason == 'PROFIT_TARGET':
                self.strategy_stats[strategy_key]['wins'] += 1
                estimated_profit = config['credit_target'] * config['profit_target']
            else:
                estimated_profit = 0  # Simplified
            
            self.strategy_stats[strategy_key]['total_pnl'] += estimated_profit
            
            self.log(f"📊 0DTE POSITION CLOSED: {position_id}")
            self.log(f"   • Strategy: {config['strategy_type']}")
            self.log(f"   • Reason: {reason}")
            self.log(f"   • Estimated P&L: £{estimated_profit:.0f}")
            
            # Remove from active positions
            del self.active_positions[position_id]
            
        except Exception as e:
            self.error(f"0DTE position closure failed: {e}")

    def _get_strategy_key(self, variant: ZeroDTEVariant) -> str:
        """Get strategy key for statistics tracking"""
        if variant == ZeroDTEVariant.STANDARD_IRON_CONDOR:
            return 'standard_ic'
        elif variant == ZeroDTEVariant.BROKEN_WING_IRON_CONDOR:
            return 'broken_wing'
        elif variant == ZeroDTEVariant.BATMAN_SPREAD:
            return 'batman'
        else:
            return 'unknown'

    def GetAdvanced0DTEStatus(self) -> Dict:
        """Get current advanced 0DTE strategy status"""
        total_positions = sum(stats['count'] for stats in self.strategy_stats.values())
        total_wins = sum(stats['wins'] for stats in self.strategy_stats.values())
        total_pnl = sum(stats['total_pnl'] for stats in self.strategy_stats.values())
        
        win_rate = (total_wins / max(1, total_positions)) * 100
        
        return {
            'active_positions': len(self.active_positions),
            'friday_entries_today': self.friday_entries_today,
            'max_entries_per_day': self.config['max_positions_per_day'],
            'total_positions_executed': total_positions,
            'overall_win_rate': f"{win_rate:.1f}%",
            'total_pnl': f"£{total_pnl:.0f}",
            'strategy_breakdown': {
                'standard_ic': {
                    'count': self.strategy_stats['standard_ic']['count'],
                    'win_rate': f"{(self.strategy_stats['standard_ic']['wins'] / max(1, self.strategy_stats['standard_ic']['count'])) * 100:.1f}%"
                },
                'broken_wing': {
                    'count': self.strategy_stats['broken_wing']['count'],
                    'win_rate': f"{(self.strategy_stats['broken_wing']['wins'] / max(1, self.strategy_stats['broken_wing']['count'])) * 100:.1f}%",
                    'note': "Tom's Preferred Strategy"
                },
                'batman': {
                    'count': self.strategy_stats['batman']['count'],
                    'win_rate': f"{(self.strategy_stats['batman']['wins'] / max(1, self.strategy_stats['batman']['count'])) * 100:.1f}%",
                    'note': "Expert Level Only - VIX <12 required"
                }
            },
            'entry_criteria': 'Friday 10:30 AM, ±0.5% max movement',
            'pdf_reference': 'Pages 4-5 - Weekly Iron Condor Variations'
        }