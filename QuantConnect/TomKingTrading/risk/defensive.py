# region imports
from AlgorithmImports import *
# endregion
"""
Defensive Adjustment Protocols for QuantConnect LEAN
Implements Tom King's defensive management rules and exit strategies
Automated position monitoring and adjustment recommendations
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from enum import Enum
import math

class DefensiveAction(Enum):
    """Types of defensive actions available"""
    CLOSE_POSITION = "CLOSE_POSITION"
    ROLL_UNTESTED = "ROLL_UNTESTED"
    ROLL_TESTED = "ROLL_TESTED"
    ADD_HEDGE = "ADD_HEDGE"
    REDUCE_SIZE = "REDUCE_SIZE"
    CONVERT_STRUCTURE = "CONVERT_STRUCTURE"
    TAKE_PROFIT = "TAKE_PROFIT"
    EMERGENCY_EXIT = "EMERGENCY_EXIT"

class ManagementTrigger(Enum):
    """Management trigger types"""
    TIME_BASED = "TIME_BASED"           # 21 DTE rule
    PROFIT_BASED = "PROFIT_BASED"       # 50% profit rule
    LOSS_BASED = "LOSS_BASED"           # Stop loss triggers
    DELTA_BASED = "DELTA_BASED"         # Delta breach triggers
    VOLATILITY_BASED = "VOLATILITY_BASED"  # VIX spike triggers
    CORRELATION_BASED = "CORRELATION_BASED"  # Correlation disaster prevention

class PositionStatus(Enum):
    """Position health status"""
    HEALTHY = "HEALTHY"
    WATCH_LIST = "WATCH_LIST"
    DEFENSIVE_NEEDED = "DEFENSIVE_NEEDED"
    EMERGENCY = "EMERGENCY"
    CLOSE_IMMEDIATELY = "CLOSE_IMMEDIATELY"

class DefensiveManager:
    """
    Manages defensive adjustments and exit strategies for Tom King methodology
    
    Key Features:
    - 21 DTE automatic management rule
    - 50% profit target implementation
    - Delta breach detection and response
    - VIX spike protection protocols
    - August 2024 crash prevention measures
    - Strategy-specific defensive protocols
    """
    
    def __init__(self):
        # Strategy-specific management rules
        self.strategy_rules = {
            '0DTE': {
                'profit_target': 0.50,           # 50% of credit
                'stop_loss': -2.00,              # 200% of credit (2x stop)
                'time_exit': {'hour': 15, 'minute': 0},  # 3:00 PM ET
                'delta_threshold': 0.30,         # Close if delta > 30
                'emergency_vix': 35,             # Emergency close above VIX 35
                'min_dte': 0,                    # Same day expiration
                'max_dte': 0,                    # Same day expiration
            },
            'LT112': {
                'profit_target': 0.90,           # 90% credit on naked puts
                'stop_loss': -3.00,              # 300% of debit on spread
                'dte_management': 21,            # Manage at 21 DTE
                'delta_threshold': 0.40,         # Manage if delta > 40
                'roll_strikes': 5,               # Roll strikes when tested
                'hedge_monetization_dte': 30,    # Start selling calls after 30 days
                'max_roll_attempts': 2,          # Maximum rolls before closing
            },
            'STRANGLE': {
                'profit_target': 0.50,           # 50% of credit
                'stop_loss': -2.00,              # 200% of credit
                'dte_management': 21,            # Manage at 21 DTE
                'delta_breach': 0.30,            # Roll when delta > 30
                'roll_width': 5,                 # Strike width for rolls
                'max_adjustments': 3,            # Maximum adjustments
            },
            'IPMCC': {
                'profit_target': 0.50,           # 50% on short calls
                'leap_stop_loss': -0.30,         # 30% loss on LEAP
                'assignment_management': True,   # Handle assignments
                'roll_frequency': 'weekly',      # Weekly rolls
                'strike_selection': 'atm_itm',   # ATM or ITM strikes
            },
            'BUTTERFLY': {
                'profit_target': 0.75,           # 75% of max profit
                'stop_loss': -0.50,              # 50% of debit
                'dte_management': 30,            # Manage at 30 DTE
                'body_defense': True,            # Defend the body
                'wing_adjustment': True,         # Adjust wings if needed
            },
            'RATIO_SPREAD': {
                'profit_target': 0.60,           # 60% of credit
                'stop_loss': -2.50,              # 250% of credit
                'dte_management': 21,            # Manage at 21 DTE
                'delta_balance': 0.10,           # Target delta neutral
                'adjustment_frequency': 'weekly', # Weekly rebalancing
            }
        }
        
        # Global defensive protocols
        self.global_protocols = {
            'vix_spike_threshold': 30,           # Start defensive measures
            'extreme_vix_threshold': 40,         # Emergency protocols
            'correlation_disaster_threshold': 0.80,  # Correlation spike limit
            'max_portfolio_loss': -0.15,        # 15% portfolio stop loss
            'daily_loss_limit': -0.05,          # 5% daily loss limit
            'position_concentration_limit': 0.20, # Max 20% in single position
        }
        
        # Time-based management schedules
        self.management_schedules = {
            'daily_check': {'hour': 9, 'minute': 30},    # Daily 9:30 AM check
            'mid_day_check': {'hour': 12, 'minute': 0},  # Midday 12:00 PM check
            'close_check': {'hour': 15, 'minute': 30},   # Pre-close 3:30 PM check
            'friday_0dte': {'hour': 15, 'minute': 0},    # Friday 3:00 PM 0DTE exit
        }
    
    def analyze_position_health(self, position: Dict, current_market_data: Dict,
                               portfolio_context: Dict = None) -> Dict:
        """
        Analyze individual position health and generate defensive recommendations
        
        Args:
            position: Position details including strategy, entry, current values
            current_market_data: Current market data (VIX, underlying price, etc.)
            portfolio_context: Portfolio-level context for correlation analysis
            
        Returns:
            Position health analysis with defensive recommendations
        """
        strategy = position.get('strategy', '').upper()
        if strategy not in self.strategy_rules:
            strategy = '0DTE'  # Default fallback
        
        rules = self.strategy_rules[strategy]
        current_price = current_market_data.get('underlying_price', 0)
        vix_level = current_market_data.get('vix', 20)
        current_date = datetime.now()
        
        # Calculate position metrics
        metrics = self._calculate_position_metrics(position, current_market_data)
        
        # Check all defensive triggers
        triggers = self._check_defensive_triggers(position, metrics, rules, current_market_data)
        
        # Determine position status
        status = self._determine_position_status(triggers, metrics, vix_level)
        
        # Generate defensive actions
        actions = self._generate_defensive_actions(strategy, triggers, metrics, rules)
        
        # Calculate urgency and priority
        urgency = self._calculate_urgency(triggers, status, vix_level)
        
        return {
            'position_id': position.get('id', 'unknown'),
            'strategy': strategy,
            'status': status.value,
            'urgency': urgency,
            'metrics': metrics,
            'triggers': triggers,
            'recommended_actions': actions,
            'time_analysis': {
                'dte': metrics['dte'],
                'dte_management_threshold': rules.get('dte_management', 21),
                'time_to_expiration': self._format_time_remaining(metrics['dte']),
                'weekend_risk': self._assess_weekend_risk(current_date, metrics['dte'])
            },
            'risk_analysis': {
                'current_pnl_percent': metrics['pnl_percent'],
                'max_theoretical_loss': self._calculate_max_loss(position, strategy),
                'probability_analysis': self._calculate_probability_metrics(position, current_market_data),
                'vix_impact': self._assess_vix_impact(vix_level, strategy, position)
            },
            'market_context': {
                'vix_level': vix_level,
                'vix_regime': self._get_vix_regime(vix_level),
                'correlation_risk': self._assess_position_correlation_risk(position, portfolio_context),
                'market_stress': vix_level > self.global_protocols['vix_spike_threshold']
            }
        }
    
    def monitor_portfolio_defensive_needs(self, portfolio: List[Dict], 
                                        market_data: Dict) -> Dict:
        """
        Monitor entire portfolio for defensive needs and emergency situations
        
        Args:
            portfolio: List of all positions
            market_data: Current market data
            
        Returns:
            Portfolio-wide defensive analysis and recommendations
        """
        vix_level = market_data.get('vix', 20)
        
        # Analyze each position
        position_analyses = []
        total_portfolio_value = 0
        positions_needing_action = 0
        emergency_positions = 0
        
        for position in portfolio:
            analysis = self.analyze_position_health(position, market_data, 
                                                  {'portfolio': portfolio})
            position_analyses.append(analysis)
            
            if analysis['status'] in ['DEFENSIVE_NEEDED', 'EMERGENCY', 'CLOSE_IMMEDIATELY']:
                positions_needing_action += 1
                
            if analysis['status'] in ['EMERGENCY', 'CLOSE_IMMEDIATELY']:
                emergency_positions += 1
            
            total_portfolio_value += position.get('market_value', 0)
        
        # Portfolio-level analysis
        portfolio_analysis = self._analyze_portfolio_defensive_needs(
            portfolio, position_analyses, market_data
        )
        
        # Generate portfolio-wide alerts
        alerts = self._generate_portfolio_alerts(portfolio_analysis, vix_level, 
                                               positions_needing_action, emergency_positions)
        
        # Emergency protocols
        emergency_protocols = self._assess_emergency_protocols(portfolio_analysis, vix_level)
        
        return {
            'portfolio_summary': {
                'total_positions': len(portfolio),
                'positions_needing_action': positions_needing_action,
                'emergency_positions': emergency_positions,
                'total_value': total_portfolio_value,
                'overall_pnl': portfolio_analysis.get('total_pnl', 0),
                'overall_pnl_percent': portfolio_analysis.get('total_pnl_percent', 0)
            },
            'position_analyses': position_analyses,
            'portfolio_risk_analysis': portfolio_analysis,
            'market_context': {
                'vix_level': vix_level,
                'vix_regime': self._get_vix_regime(vix_level),
                'market_stress_level': self._calculate_market_stress_level(market_data),
                'correlation_environment': self._assess_correlation_environment(vix_level)
            },
            'alerts': alerts,
            'emergency_protocols': emergency_protocols,
            'recommended_actions': self._prioritize_portfolio_actions(position_analyses),
            'august_2024_protection': {
                'correlation_check': self._august_2024_correlation_check(portfolio),
                'concentration_check': self._august_2024_concentration_check(portfolio),
                'protection_active': True,
                'tom_king_lessons': self._apply_tom_king_lessons(portfolio, vix_level)
            }
        }
    
    def _calculate_position_metrics(self, position: Dict, market_data: Dict) -> Dict:
        """Calculate key position metrics for defensive analysis"""
        entry_date = position.get('entry_date', datetime.now())
        expiration_date = position.get('expiration_date', datetime.now())
        entry_price = position.get('entry_price', 0)
        current_price = position.get('current_price', entry_price)
        
        # Calculate days to expiration
        if isinstance(expiration_date, str):
            expiration_date = datetime.fromisoformat(expiration_date)
        if isinstance(entry_date, str):
            entry_date = datetime.fromisoformat(entry_date)
        
        dte = (expiration_date - datetime.now()).days
        
        # Calculate P&L
        if entry_price != 0:
            pnl_percent = (current_price - entry_price) / abs(entry_price)
        else:
            pnl_percent = 0
        
        pnl_amount = (current_price - entry_price) * position.get('quantity', 1) * 100
        
        return {
            'dte': max(0, dte),
            'days_in_trade': (datetime.now() - entry_date).days,
            'pnl_amount': pnl_amount,
            'pnl_percent': pnl_percent,
            'current_delta': position.get('delta', 0),
            'current_gamma': position.get('gamma', 0),
            'current_theta': position.get('theta', 0),
            'current_vega': position.get('vega', 0),
            'implied_volatility': position.get('iv', 0),
            'entry_price': entry_price,
            'current_price': current_price,
            'break_even': position.get('break_even', 0),
            'max_profit': position.get('max_profit', 0),
            'max_loss': position.get('max_loss', 0)
        }
    
    def _check_defensive_triggers(self, position: Dict, metrics: Dict, 
                                rules: Dict, market_data: Dict) -> List[Dict]:
        """Check all defensive triggers for a position"""
        triggers = []
        vix_level = market_data.get('vix', 20)
        current_time = datetime.now()
        
        # Time-based triggers
        if metrics['dte'] <= rules.get('dte_management', 21):
            triggers.append({
                'type': ManagementTrigger.TIME_BASED,
                'severity': 'HIGH' if metrics['dte'] <= 7 else 'MODERATE',
                'message': f"Position at {metrics['dte']} DTE - management threshold reached",
                'threshold': rules.get('dte_management', 21),
                'current_value': metrics['dte']
            })
        
        # Profit-based triggers
        profit_target = rules.get('profit_target', 0.50)
        if metrics['pnl_percent'] >= profit_target:
            triggers.append({
                'type': ManagementTrigger.PROFIT_BASED,
                'severity': 'MODERATE',
                'message': f"Profit target reached: {metrics['pnl_percent']:.1%} vs {profit_target:.1%}",
                'threshold': profit_target,
                'current_value': metrics['pnl_percent']
            })
        
        # Loss-based triggers
        stop_loss = rules.get('stop_loss', -2.00)
        if metrics['pnl_percent'] <= stop_loss:
            triggers.append({
                'type': ManagementTrigger.LOSS_BASED,
                'severity': 'CRITICAL',
                'message': f"Stop loss triggered: {metrics['pnl_percent']:.1%} vs {stop_loss:.1%}",
                'threshold': stop_loss,
                'current_value': metrics['pnl_percent']
            })
        
        # Delta-based triggers
        delta_threshold = rules.get('delta_threshold', 0.30)
        if abs(metrics['current_delta']) > delta_threshold:
            triggers.append({
                'type': ManagementTrigger.DELTA_BASED,
                'severity': 'HIGH',
                'message': f"Delta breach: {metrics['current_delta']:.2f} vs ±{delta_threshold:.2f}",
                'threshold': delta_threshold,
                'current_value': abs(metrics['current_delta'])
            })
        
        # VIX spike triggers
        emergency_vix = rules.get('emergency_vix', 35)
        if vix_level > emergency_vix:
            triggers.append({
                'type': ManagementTrigger.VOLATILITY_BASED,
                'severity': 'CRITICAL',
                'message': f"VIX spike emergency: {vix_level} vs {emergency_vix}",
                'threshold': emergency_vix,
                'current_value': vix_level
            })
        
        # Time-specific triggers (e.g., 0DTE Friday 3 PM)
        strategy = position.get('strategy', '').upper()
        if strategy == '0DTE' and current_time.weekday() == 4:  # Friday
            time_exit = rules.get('time_exit', {'hour': 15, 'minute': 0})
            if current_time.hour >= time_exit['hour']:
                triggers.append({
                    'type': ManagementTrigger.TIME_BASED,
                    'severity': 'CRITICAL',
                    'message': f"0DTE Friday time exit: {current_time.hour}:{current_time.minute:02d}",
                    'threshold': f"{time_exit['hour']}:{time_exit['minute']:02d}",
                    'current_value': f"{current_time.hour}:{current_time.minute:02d}"
                })
        
        return triggers
    
    def _determine_position_status(self, triggers: List[Dict], metrics: Dict, 
                                 vix_level: float) -> PositionStatus:
        """Determine overall position status based on triggers and metrics"""
        critical_triggers = [t for t in triggers if t['severity'] == 'CRITICAL']
        high_triggers = [t for t in triggers if t['severity'] == 'HIGH']
        
        # Critical conditions requiring immediate action
        if critical_triggers:
            for trigger in critical_triggers:
                if trigger['type'] in [ManagementTrigger.LOSS_BASED, 
                                     ManagementTrigger.VOLATILITY_BASED]:
                    return PositionStatus.CLOSE_IMMEDIATELY
            return PositionStatus.EMERGENCY
        
        # High priority conditions requiring defensive action
        if high_triggers:
            return PositionStatus.DEFENSIVE_NEEDED
        
        # Moderate conditions for watch list
        if triggers:
            return PositionStatus.WATCH_LIST
        
        # Healthy position
        return PositionStatus.HEALTHY
    
    def _generate_defensive_actions(self, strategy: str, triggers: List[Dict], 
                                  metrics: Dict, rules: Dict) -> List[Dict]:
        """Generate specific defensive actions based on triggers"""
        actions = []
        
        for trigger in triggers:
            if trigger['type'] == ManagementTrigger.TIME_BASED:
                if metrics['dte'] <= 0:
                    actions.append({
                        'action': DefensiveAction.CLOSE_POSITION,
                        'priority': 'CRITICAL',
                        'reason': 'Expiration day - close immediately',
                        'estimated_impact': 'Avoid assignment risk'
                    })
                elif metrics['dte'] <= 21:
                    actions.append({
                        'action': DefensiveAction.ROLL_UNTESTED if metrics['current_delta'] < 0.30 
                                else DefensiveAction.ROLL_TESTED,
                        'priority': 'HIGH',
                        'reason': f"21 DTE management rule triggered ({metrics['dte']} DTE)",
                        'estimated_impact': 'Extend time for mean reversion'
                    })
            
            elif trigger['type'] == ManagementTrigger.PROFIT_BASED:
                actions.append({
                    'action': DefensiveAction.TAKE_PROFIT,
                    'priority': 'MODERATE',
                    'reason': f"Profit target achieved ({metrics['pnl_percent']:.1%})",
                    'estimated_impact': 'Lock in gains, reduce risk'
                })
            
            elif trigger['type'] == ManagementTrigger.LOSS_BASED:
                actions.append({
                    'action': DefensiveAction.CLOSE_POSITION,
                    'priority': 'CRITICAL',
                    'reason': f"Stop loss triggered ({metrics['pnl_percent']:.1%})",
                    'estimated_impact': 'Limit further losses'
                })
            
            elif trigger['type'] == ManagementTrigger.DELTA_BASED:
                if strategy in ['STRANGLE', 'LT112']:
                    actions.append({
                        'action': DefensiveAction.ROLL_TESTED,
                        'priority': 'HIGH',
                        'reason': f"Delta breach requires rolling tested side ({metrics['current_delta']:.2f})",
                        'estimated_impact': 'Reset probabilities, collect additional credit'
                    })
                else:
                    actions.append({
                        'action': DefensiveAction.ADD_HEDGE,
                        'priority': 'HIGH',
                        'reason': f"Delta breach requires hedging ({metrics['current_delta']:.2f})",
                        'estimated_impact': 'Reduce directional risk'
                    })
            
            elif trigger['type'] == ManagementTrigger.VOLATILITY_BASED:
                actions.append({
                    'action': DefensiveAction.EMERGENCY_EXIT,
                    'priority': 'CRITICAL',
                    'reason': f"VIX spike emergency protocol ({trigger['current_value']})",
                    'estimated_impact': 'Prevent August 2024-style disaster'
                })
        
        # Strategy-specific additional actions
        actions.extend(self._get_strategy_specific_actions(strategy, metrics, rules))
        
        return actions
    
    def _get_strategy_specific_actions(self, strategy: str, metrics: Dict, 
                                     rules: Dict) -> List[Dict]:
        """Get strategy-specific defensive actions"""
        actions = []
        
        if strategy == 'LT112' and metrics['days_in_trade'] > 30:
            # Hedge monetization opportunity
            actions.append({
                'action': DefensiveAction.CONVERT_STRUCTURE,
                'priority': 'MODERATE',
                'reason': 'Hedge monetization opportunity after 30 days',
                'estimated_impact': 'Additional £250-350 monthly income',
                'specific_action': 'Sell weekly calls against long put'
            })
        
        elif strategy == 'IPMCC' and metrics['dte'] <= 7:
            # Weekly roll for IPMCC
            actions.append({
                'action': DefensiveAction.ROLL_UNTESTED,
                'priority': 'HIGH',
                'reason': 'Weekly IPMCC roll approaching',
                'estimated_impact': 'Maintain weekly income stream',
                'specific_action': 'Roll short call to next week'
            })
        
        elif strategy == 'BUTTERFLY' and abs(metrics['current_delta']) > 0.10:
            # Butterfly body defense
            actions.append({
                'action': DefensiveAction.CONVERT_STRUCTURE,
                'priority': 'MODERATE',
                'reason': 'Butterfly body defense needed',
                'estimated_impact': 'Protect profit zone',
                'specific_action': 'Adjust wing strikes or convert to iron condor'
            })
        
        return actions
    
    def _calculate_urgency(self, triggers: List[Dict], status: PositionStatus, 
                         vix_level: float) -> str:
        """Calculate action urgency level"""
        critical_triggers = len([t for t in triggers if t['severity'] == 'CRITICAL'])
        
        if status == PositionStatus.CLOSE_IMMEDIATELY or critical_triggers > 1:
            return 'IMMEDIATE'
        elif status == PositionStatus.EMERGENCY or critical_triggers == 1:
            return 'URGENT'
        elif status == PositionStatus.DEFENSIVE_NEEDED:
            return 'HIGH'
        elif status == PositionStatus.WATCH_LIST:
            return 'MODERATE'
        else:
            return 'LOW'
    
    def _format_time_remaining(self, dte: int) -> str:
        """Format time remaining in human-readable format"""
        if dte <= 0:
            return "EXPIRED"
        elif dte == 1:
            return "1 day"
        elif dte < 7:
            return f"{dte} days"
        elif dte < 30:
            weeks = dte // 7
            days = dte % 7
            return f"{weeks}w {days}d" if days > 0 else f"{weeks} weeks"
        else:
            months = dte // 30
            days = dte % 30
            return f"{months}m {days}d" if days > 0 else f"{months} months"
    
    def _assess_weekend_risk(self, current_date: datetime, dte: int) -> str:
        """Assess weekend risk for positions"""
        if dte <= 0:
            return "EXPIRED"
        
        days_until_weekend = (4 - current_date.weekday()) % 7
        
        if dte <= 3 and days_until_weekend <= 1:
            return "HIGH - Position expires over weekend"
        elif dte <= 7 and days_until_weekend == 0:
            return "MODERATE - Weekend gamma risk"
        else:
            return "LOW"
    
    def _calculate_max_loss(self, position: Dict, strategy: str) -> float:
        """Calculate maximum theoretical loss for position"""
        if strategy == '0DTE':
            return position.get('entry_price', 0) * -2.0  # 200% of credit
        elif strategy == 'STRANGLE':
            return position.get('entry_price', 0) * -2.0  # 200% of credit
        elif strategy == 'LT112':
            return position.get('debit_paid', 0) * -3.0   # 300% of debit
        elif strategy == 'BUTTERFLY':
            return position.get('debit_paid', 0) * -1.0   # 100% of debit
        else:
            return position.get('entry_price', 0) * -2.0  # Default 200%
    
    def _calculate_probability_metrics(self, position: Dict, market_data: Dict) -> Dict:
        """Calculate probability metrics for position"""
        # Simplified probability calculations
        dte = max(1, (position.get('expiration_date', datetime.now()) - datetime.now()).days)
        current_price = market_data.get('underlying_price', 0)
        strike = position.get('strike', current_price)
        iv = position.get('iv', 0.20)
        
        # Basic probability of profit calculation
        prob_profit = self._calculate_basic_pop(current_price, strike, dte, iv)
        
        return {
            'probability_of_profit': prob_profit,
            'break_even_probability': prob_profit * 0.8,  # Approximate
            'max_profit_probability': prob_profit * 0.3,   # Approximate
            'days_to_expiration': dte,
            'time_decay_per_day': position.get('theta', 0)
        }
    
    def _calculate_basic_pop(self, current_price: float, strike: float, 
                           dte: int, iv: float) -> float:
        """Calculate basic probability of profit (simplified)"""
        if dte <= 0 or current_price <= 0:
            return 0.0
        
        # Simplified calculation - in practice would use more sophisticated models
        time_factor = math.sqrt(dte / 365.0)
        volatility_move = current_price * iv * time_factor
        distance_from_strike = abs(current_price - strike)
        
        if distance_from_strike <= volatility_move:
            return 0.6  # Moderate probability
        elif distance_from_strike <= volatility_move * 2:
            return 0.8  # High probability
        else:
            return 0.9  # Very high probability
    
    def _assess_vix_impact(self, vix_level: float, strategy: str, position: Dict) -> Dict:
        """Assess VIX impact on position"""
        vega = position.get('vega', 0)
        
        if vix_level < 15:
            impact = "LOW - Low volatility environment"
            vega_impact = vega * -2  # Volatility contraction
        elif vix_level < 25:
            impact = "MODERATE - Normal volatility"
            vega_impact = vega * 0   # Neutral
        elif vix_level < 35:
            impact = "HIGH - Elevated volatility"
            vega_impact = vega * 3   # Volatility expansion
        else:
            impact = "EXTREME - Crisis volatility"
            vega_impact = vega * 8   # Massive volatility expansion
        
        return {
            'vix_impact_description': impact,
            'estimated_vega_pnl': vega_impact,
            'strategy_specific_impact': self._get_strategy_vix_impact(strategy, vix_level)
        }
    
    def _get_strategy_vix_impact(self, strategy: str, vix_level: float) -> str:
        """Get strategy-specific VIX impact analysis"""
        if strategy == '0DTE':
            if vix_level > 30:
                return "NEGATIVE - High gamma risk, consider closing"
            else:
                return "NEUTRAL - Limited time for volatility impact"
        elif strategy in ['STRANGLE', 'BUTTERFLY']:
            if vix_level > 25:
                return "POSITIVE - Volatility expansion benefits short premium"
            else:
                return "NEGATIVE - Volatility contraction hurts position"
        elif strategy == 'LT112':
            if vix_level > 30:
                return "MIXED - Volatility helps long puts, hurts naked puts"
            else:
                return "POSITIVE - Calm environment good for naked puts"
        else:
            return "NEUTRAL - Strategy not significantly VIX sensitive"
    
    def _get_vix_regime(self, vix_level: float) -> str:
        """Get VIX regime classification"""
        if vix_level < 15:
            return "VERY_LOW"
        elif vix_level < 20:
            return "LOW"
        elif vix_level < 25:
            return "NORMAL"
        elif vix_level < 35:
            return "HIGH"
        else:
            return "EXTREME"
    
    def _assess_position_correlation_risk(self, position: Dict, 
                                        portfolio_context: Dict) -> str:
        """Assess position's contribution to portfolio correlation risk"""
        if not portfolio_context:
            return "UNKNOWN"
        
        symbol = position.get('symbol', '')
        portfolio = portfolio_context.get('portfolio', [])
        
        # Count positions in same correlation group
        same_group_positions = 0
        for pos in portfolio:
            if self._get_correlation_group(pos.get('symbol', '')) == self._get_correlation_group(symbol):
                same_group_positions += 1
        
        if same_group_positions > 4:
            return "HIGH - Too many correlated positions"
        elif same_group_positions > 2:
            return "MODERATE - Some correlation risk"
        else:
            return "LOW - Well diversified"
    
    def _get_correlation_group(self, symbol: str) -> str:
        """Get correlation group for symbol (simplified)"""
        equity_symbols = ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'NQ', 'MNQ']
        if symbol.upper() in equity_symbols:
            return "EQUITY_INDEX"
        else:
            return "OTHER"
    
    def _analyze_portfolio_defensive_needs(self, portfolio: List[Dict], 
                                         position_analyses: List[Dict],
                                         market_data: Dict) -> Dict:
        """Analyze portfolio-wide defensive needs"""
        total_pnl = sum(pos.get('pnl_amount', 0) for pos in portfolio)
        total_value = sum(pos.get('market_value', 0) for pos in portfolio)
        total_pnl_percent = total_pnl / total_value if total_value > 0 else 0
        
        # Count positions by status
        status_counts = {}
        for analysis in position_analyses:
            status = analysis['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        # Assess overall portfolio health
        if total_pnl_percent < -0.15:  # 15% portfolio loss
            portfolio_health = "CRITICAL"
        elif status_counts.get('EMERGENCY', 0) > 0:
            portfolio_health = "EMERGENCY"
        elif status_counts.get('DEFENSIVE_NEEDED', 0) > 2:
            portfolio_health = "DEFENSIVE_NEEDED"
        elif status_counts.get('WATCH_LIST', 0) > 3:
            portfolio_health = "WATCH_LIST"
        else:
            portfolio_health = "HEALTHY"
        
        return {
            'total_pnl': total_pnl,
            'total_pnl_percent': total_pnl_percent,
            'portfolio_health': portfolio_health,
            'status_distribution': status_counts,
            'correlation_analysis': self._portfolio_correlation_analysis(portfolio),
            'concentration_risk': self._portfolio_concentration_analysis(portfolio),
            'vix_exposure': self._portfolio_vix_exposure_analysis(portfolio, market_data)
        }
    
    def _generate_portfolio_alerts(self, portfolio_analysis: Dict, vix_level: float,
                                 positions_needing_action: int, emergency_positions: int) -> List[Dict]:
        """Generate portfolio-wide alerts"""
        alerts = []
        
        # Portfolio loss alert
        if portfolio_analysis.get('total_pnl_percent', 0) < -0.10:
            alerts.append({
                'type': 'PORTFOLIO_LOSS',
                'severity': 'HIGH',
                'message': f"Portfolio down {portfolio_analysis['total_pnl_percent']:.1%}",
                'action': 'Consider closing losing positions and reducing exposure'
            })
        
        # Multiple positions needing action
        if positions_needing_action > 3:
            alerts.append({
                'type': 'MULTIPLE_DEFENSIVE',
                'severity': 'HIGH',
                'message': f"{positions_needing_action} positions need defensive action",
                'action': 'Prioritize most urgent positions first'
            })
        
        # Emergency positions
        if emergency_positions > 0:
            alerts.append({
                'type': 'EMERGENCY_POSITIONS',
                'severity': 'CRITICAL',
                'message': f"{emergency_positions} positions in emergency status",
                'action': 'Take immediate action on emergency positions'
            })
        
        # VIX spike alert
        if vix_level > 30:
            alerts.append({
                'type': 'VIX_SPIKE',
                'severity': 'HIGH',
                'message': f"VIX spike to {vix_level} - defensive protocols active",
                'action': 'Monitor correlations closely, be ready for quick exits'
            })
        
        return alerts
    
    def _assess_emergency_protocols(self, portfolio_analysis: Dict, vix_level: float) -> Dict:
        """Assess need for emergency protocols"""
        emergency_level = "NORMAL"
        
        if vix_level > 40 or portfolio_analysis.get('total_pnl_percent', 0) < -0.20:
            emergency_level = "CRITICAL"
        elif vix_level > 30 or portfolio_analysis.get('total_pnl_percent', 0) < -0.15:
            emergency_level = "HIGH"
        elif vix_level > 25 or portfolio_analysis.get('total_pnl_percent', 0) < -0.10:
            emergency_level = "MODERATE"
        
        protocols = {
            'emergency_level': emergency_level,
            'august_2024_protocols_active': vix_level > 25,
            'correlation_disaster_prevention': True,
            'recommended_actions': []
        }
        
        if emergency_level in ['CRITICAL', 'HIGH']:
            protocols['recommended_actions'].extend([
                'Stop opening new positions',
                'Close most speculative positions',
                'Reduce correlation group exposure',
                'Increase cash allocation'
            ])
        
        return protocols
    
    def _prioritize_portfolio_actions(self, position_analyses: List[Dict]) -> List[Dict]:
        """Prioritize defensive actions across portfolio"""
        # Sort positions by urgency and potential impact
        actions = []
        
        for analysis in position_analyses:
            if analysis['recommended_actions']:
                for action in analysis['recommended_actions']:
                    actions.append({
                        'position_id': analysis['position_id'],
                        'strategy': analysis['strategy'],
                        'action': action,
                        'urgency': analysis['urgency'],
                        'status': analysis['status'],
                        'priority_score': self._calculate_action_priority(analysis, action)
                    })
        
        # Sort by priority score (higher is more urgent)
        actions.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return actions[:10]  # Return top 10 priority actions
    
    def _calculate_action_priority(self, analysis: Dict, action: Dict) -> float:
        """Calculate priority score for an action"""
        base_score = 0
        
        # Urgency weighting
        urgency_weights = {
            'IMMEDIATE': 100,
            'URGENT': 80,
            'HIGH': 60,
            'MODERATE': 40,
            'LOW': 20
        }
        base_score += urgency_weights.get(analysis['urgency'], 20)
        
        # Action type weighting
        action_weights = {
            'CLOSE_POSITION': 90,
            'EMERGENCY_EXIT': 100,
            'TAKE_PROFIT': 70,
            'ROLL_TESTED': 60,
            'ADD_HEDGE': 50
        }
        
        action_type = action.get('action', DefensiveAction.CLOSE_POSITION)
        if hasattr(action_type, 'value'):
            action_type = action_type.value
        base_score += action_weights.get(str(action_type), 30)
        
        # Position value impact (larger positions get higher priority)
        position_value = analysis.get('metrics', {}).get('pnl_amount', 0)
        if position_value < -1000:  # Large loss
            base_score += 20
        elif position_value > 1000:  # Large gain to protect
            base_score += 10
        
        return base_score
    
    def _august_2024_correlation_check(self, portfolio: List[Dict]) -> Dict:
        """Check for August 2024-style correlation concentration"""
        equity_positions = 0
        total_positions = len(portfolio)
        
        equity_symbols = ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'NQ', 'MNQ', 'YM', 'RTY']
        
        for position in portfolio:
            symbol = position.get('symbol', '').upper()
            if symbol in equity_symbols or 'LT112' in position.get('strategy', ''):
                equity_positions += 1
        
        concentration = equity_positions / total_positions if total_positions > 0 else 0
        
        return {
            'equity_positions': equity_positions,
            'total_positions': total_positions,
            'equity_concentration': concentration,
            'tom_king_concentration': 1.0,  # His disaster: 6/6 equity positions
            'risk_level': 'HIGH' if concentration > 0.75 else 'MODERATE' if concentration > 0.50 else 'LOW',
            'protection_effectiveness': max(0, 1 - concentration),
            'similar_to_disaster': concentration > 0.80
        }
    
    def _august_2024_concentration_check(self, portfolio: List[Dict]) -> Dict:
        """Check portfolio concentration risk"""
        strategy_counts = {}
        for position in portfolio:
            strategy = position.get('strategy', 'UNKNOWN')
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        
        max_strategy_count = max(strategy_counts.values()) if strategy_counts else 0
        concentration = max_strategy_count / len(portfolio) if portfolio else 0
        
        return {
            'strategy_distribution': strategy_counts,
            'max_strategy_concentration': concentration,
            'tom_king_pattern': concentration > 0.80 and 'LT112' in strategy_counts,
            'diversification_score': 1 - concentration,
            'recommendations': self._get_concentration_recommendations(strategy_counts)
        }
    
    def _apply_tom_king_lessons(self, portfolio: List[Dict], vix_level: float) -> List[str]:
        """Apply lessons learned from Tom King's August 2024 experience"""
        lessons = []
        
        # Lesson 1: Correlation group limits
        equity_count = len([p for p in portfolio if self._get_correlation_group(p.get('symbol', '')) == 'EQUITY_INDEX'])
        if equity_count > 3:
            lessons.append(f"Reduce equity correlation exposure - currently {equity_count} positions")
        
        # Lesson 2: VIX-based position sizing
        if vix_level > 25:
            lessons.append(f"VIX at {vix_level} - use tighter correlation limits and reduced position sizing")
        
        # Lesson 3: Strategy diversification
        strategy_counts = {}
        for pos in portfolio:
            strategy = pos.get('strategy', '')
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        
        if any(count > 4 for count in strategy_counts.values()):
            lessons.append("Too many positions in single strategy - diversify across strategies")
        
        # Lesson 4: Time management
        lessons.append("Maintain strict 21 DTE management rule - no exceptions")
        
        # Lesson 5: Emergency preparedness
        lessons.append("Keep emergency protocol active - ready to close all positions if needed")
        
        return lessons
    
    def _portfolio_correlation_analysis(self, portfolio: List[Dict]) -> Dict:
        """Analyze portfolio correlation risk"""
        # Simplified correlation analysis
        return {'status': 'Implemented in correlation.py module'}
    
    def _portfolio_concentration_analysis(self, portfolio: List[Dict]) -> Dict:
        """Analyze portfolio concentration risk"""
        return {'status': 'Portfolio concentration analysis'}
    
    def _portfolio_vix_exposure_analysis(self, portfolio: List[Dict], market_data: Dict) -> Dict:
        """Analyze portfolio VIX exposure"""
        return {'vix_exposure': 'Portfolio VIX exposure analysis'}
    
    def _calculate_market_stress_level(self, market_data: Dict) -> str:
        """Calculate overall market stress level"""
        vix = market_data.get('vix', 20)
        if vix > 35:
            return "EXTREME"
        elif vix > 25:
            return "HIGH"
        elif vix > 20:
            return "MODERATE"
        else:
            return "LOW"
    
    def _assess_correlation_environment(self, vix_level: float) -> str:
        """Assess correlation environment based on VIX"""
        if vix_level > 30:
            return "HIGH_CORRELATION"
        elif vix_level > 20:
            return "ELEVATED_CORRELATION"
        else:
            return "NORMAL_CORRELATION"
    
    def _get_concentration_recommendations(self, strategy_counts: Dict) -> List[str]:
        """Get recommendations for reducing concentration"""
        recommendations = []
        total = sum(strategy_counts.values())
        
        for strategy, count in strategy_counts.items():
            if count / total > 0.50:
                recommendations.append(f"Reduce {strategy} positions - currently {count}/{total}")
        
        return recommendations