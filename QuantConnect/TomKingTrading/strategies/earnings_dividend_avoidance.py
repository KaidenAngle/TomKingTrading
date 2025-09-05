# region imports
from AlgorithmImports import *
# endregion
"""
Tom King Trading Framework - Earnings and Dividend Calendar Avoidance System
Event risk management for professional options trading

Key Features:
1. Earnings Calendar Integration: Avoid positions before earnings announcements
2. Dividend Calendar Tracking: Manage positions around ex-dividend dates
3. Event Risk Assessment: Systematic evaluation of upcoming events
4. Position Management: Automatic position adjustment before events
5. Market Event Integration: FOMC, Fed meetings, major economic events

Risk Management Philosophy:
- Never enter positions close to earnings (7-14 day buffer)
- Avoid dividend capture strategies in complex positions
- Close or adjust positions before major market events
- Systematic event tracking and alert system

Reference: Professional risk management practices, Tom King methodology
Author: Tom King Trading System Implementation
Version: 1.0.0 - Earnings Dividend Avoidance Module
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class EventType(Enum):
    """Types of market events to avoid"""
    EARNINGS_ANNOUNCEMENT = "EARNINGS"
    DIVIDEND_EX_DATE = "DIVIDEND_EX"
    DIVIDEND_PAY_DATE = "DIVIDEND_PAY"
    FOMC_MEETING = "FOMC"
    FED_SPEECH = "FED_SPEECH"
    ECONOMIC_RELEASE = "ECONOMIC"
    OPTIONS_EXPIRATION = "OPEX"
    EARNINGS_GUIDANCE = "GUIDANCE"

class EventSeverity(Enum):
    """Severity levels for market events"""
    LOW = "LOW"           # Minor impact, continue normal operations
    MEDIUM = "MEDIUM"     # Moderate impact, increase caution
    HIGH = "HIGH"         # Major impact, avoid new positions
    CRITICAL = "CRITICAL" # Extreme impact, close positions

class AvoidanceAction(Enum):
    """Actions to take based on event proximity"""
    CONTINUE_NORMAL = "CONTINUE"
    INCREASE_CAUTION = "CAUTION"
    AVOID_NEW_ENTRIES = "AVOID_ENTRY"
    CLOSE_POSITIONS = "CLOSE"
    ADJUST_POSITIONS = "ADJUST"

class EarningsDividendAvoidanceSystem:
    """
    Implementation of Earnings and Dividend Calendar Avoidance System
    
    Features:
    - Multi-symbol earnings calendar tracking
    - Ex-dividend date monitoring and position management
    - Major market event integration (FOMC, economic releases)
    - Automatic position risk assessment
    - Event-based trading restrictions
    """
    
    def __init__(self, algorithm):
        """Initialize earnings and dividend avoidance system"""
        self.algorithm = algorithm
        
        # Event tracking
        self.earnings_calendar = {}
        self.dividend_calendar = {}
        self.market_events = {}
        self.tracked_symbols = set()
        
        # Avoidance configuration
        self.avoidance_config = self._initialize_avoidance_config()
        self.event_buffers = self._initialize_event_buffers()
        
        # Position risk tracking
        self.position_event_risks = {}
        self.active_restrictions = {}
        
        # Performance tracking
        self.avoidance_stats = {
            'events_avoided': 0,
            'positions_closed_preemptively': 0,
            'positions_adjusted': 0,
            'events_tracked': 0,
            'losses_prevented': 0.0
        }
        
        self.algorithm.Log("📅 Earnings & Dividend Avoidance System Initialized")
    
    def _initialize_avoidance_config(self) -> Dict:
        """Initialize avoidance configuration"""
        return {
            'earnings': {
                'avoid_entry_days': 7,           # Avoid entries 7 days before earnings
                'close_position_days': 3,        # Close positions 3 days before earnings
                'high_iv_threshold': 0.40,       # High IV threshold for earnings
                'position_size_reduction': 0.50, # Reduce position size by 50%
                'severity_mapping': {
                    'major_tech': EventSeverity.HIGH,
                    'sp500_component': EventSeverity.MEDIUM,
                    'small_cap': EventSeverity.LOW
                }
            },
            'dividends': {
                'avoid_entry_days': 2,           # Avoid entries 2 days before ex-div
                'close_naked_positions': True,   # Close naked positions before ex-div
                'adjust_covered_positions': True, # Adjust covered positions
                'min_dividend_yield': 0.02,      # Track dividends > 2% yield
                'special_dividend_severity': EventSeverity.HIGH
            },
            'market_events': {
                'fomc_avoid_days': 1,            # Avoid new positions 1 day before FOMC
                'economic_release_buffer': 2,    # Buffer for major economic releases
                'fed_speech_sensitivity': 0.5,   # Sensitivity to Fed speeches
                'options_expiration_rules': {
                    'monthly': EventSeverity.MEDIUM,
                    'quarterly': EventSeverity.HIGH,
                    'leaps': EventSeverity.LOW
                }
            },
            'position_management': {
                'max_event_exposure': 0.30,      # Max 30% portfolio exposed to events
                'auto_close_critical': True,     # Auto-close on critical events
                'profit_take_before_events': 0.75, # Take profits at 75% before events
                'stop_loss_tighten': 0.80       # Tighten stops to 80% before events
            }
        }
    
    def _initialize_event_buffers(self) -> Dict:
        """Initialize event buffer periods"""
        return {
            EventType.EARNINGS_ANNOUNCEMENT: timedelta(days=7),
            EventType.DIVIDEND_EX_DATE: timedelta(days=2),
            EventType.DIVIDEND_PAY_DATE: timedelta(days=1),
            EventType.FOMC_MEETING: timedelta(days=1),
            EventType.FED_SPEECH: timedelta(hours=4),
            EventType.ECONOMIC_RELEASE: timedelta(days=1),
            EventType.OPTIONS_EXPIRATION: timedelta(days=1),
            EventType.EARNINGS_GUIDANCE: timedelta(days=3)
        }
    
    def AddSymbolTracking(self, symbol: str, symbol_type: str = 'equity'):
        """Add symbol to earnings and dividend tracking"""
        try:
            if symbol not in self.tracked_symbols:
                self.tracked_symbols.add(symbol)
                
                # Initialize tracking structures
                self.earnings_calendar[symbol] = []
                self.dividend_calendar[symbol] = []
                self.position_event_risks[symbol] = {
                    'earnings_risk': 0.0,
                    'dividend_risk': 0.0,
                    'combined_risk': 0.0,
                    'next_earnings': None,
                    'next_dividend': None
                }
                
                self.algorithm.Log(f"📅 Added {symbol} to event tracking")
                return True
                
        except Exception as e:
            self.algorithm.Error(f"Error adding symbol {symbol} to tracking: {e}")
            return False
    
    def UpdateEarningsCalendar(self, symbol: str, earnings_date: datetime, 
                             earnings_time: str = 'AMC', estimated: bool = True) -> bool:
        """Update earnings calendar for symbol"""
        try:
            if symbol not in self.tracked_symbols:
                self.AddSymbolTracking(symbol)
            
            earnings_entry = {
                'symbol': symbol,
                'date': earnings_date,
                'time': earnings_time,  # BMO (before market open) or AMC (after market close)
                'estimated': estimated,
                'severity': self._assess_earnings_severity(symbol),
                'added_date': self.algorithm.Time
            }
            
            # Add to calendar (remove duplicates)
            self.earnings_calendar[symbol] = [
                e for e in self.earnings_calendar[symbol] 
                if e['date'].date() != earnings_date.date()
            ]
            self.earnings_calendar[symbol].append(earnings_entry)
            
            # Sort by date
            self.earnings_calendar[symbol].sort(key=lambda x: x['date'])
            
            # Update position risk assessment
            self._update_position_risk_assessment(symbol)
            
            self.avoidance_stats['events_tracked'] += 1
            
            self.algorithm.Log(f"📊 Updated earnings: {symbol} on {earnings_date.strftime('%Y-%m-%d')} ({earnings_time})")
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Error updating earnings calendar for {symbol}: {e}")
            return False
    
    def UpdateDividendCalendar(self, symbol: str, ex_date: datetime, 
                             pay_date: datetime, amount: float) -> bool:
        """Update dividend calendar for symbol"""
        try:
            if symbol not in self.tracked_symbols:
                self.AddSymbolTracking(symbol)
            
            # Calculate dividend yield (approximate)
            current_price = self.algorithm.Securities[symbol].Price if symbol in self.algorithm.Securities else 100
            dividend_yield = (amount * 4) / current_price  # Annualized yield estimate
            
            dividend_entry = {
                'symbol': symbol,
                'ex_date': ex_date,
                'pay_date': pay_date,
                'amount': amount,
                'yield': dividend_yield,
                'severity': EventSeverity.HIGH if dividend_yield > 0.05 else EventSeverity.MEDIUM,
                'added_date': self.algorithm.Time
            }
            
            # Add to calendar (remove duplicates)
            self.dividend_calendar[symbol] = [
                d for d in self.dividend_calendar[symbol]
                if d['ex_date'].date() != ex_date.date()
            ]
            self.dividend_calendar[symbol].append(dividend_entry)
            
            # Sort by ex-date
            self.dividend_calendar[symbol].sort(key=lambda x: x['ex_date'])
            
            # Update position risk assessment
            self._update_position_risk_assessment(symbol)
            
            self.avoidance_stats['events_tracked'] += 1
            
            self.algorithm.Log(f"💰 Updated dividend: {symbol} ex-date {ex_date.strftime('%Y-%m-%d')}, ${amount:.2f} ({dividend_yield:.1%} yield)")
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Error updating dividend calendar for {symbol}: {e}")
            return False
    
    def AddMarketEvent(self, event_date: datetime, event_type: EventType, 
                      description: str, severity: EventSeverity) -> bool:
        """Add major market event"""
        try:
            event_id = f"{event_type.value}_{event_date.strftime('%Y%m%d')}"
            
            self.market_events[event_id] = {
                'date': event_date,
                'type': event_type,
                'description': description,
                'severity': severity,
                'buffer_period': self.event_buffers.get(event_type, timedelta(days=1)),
                'added_date': self.algorithm.Time
            }
            
            self.avoidance_stats['events_tracked'] += 1
            
            self.algorithm.Log(f"🏛️ Added market event: {description} on {event_date.strftime('%Y-%m-%d')} ({severity.value})")
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Error adding market event: {e}")
            return False
    
    def _assess_earnings_severity(self, symbol: str) -> EventSeverity:
        """Assess earnings announcement severity"""
        try:
            # Major tech stocks
            major_tech = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'NVDA']
            if symbol in major_tech:
                return EventSeverity.HIGH
            
            # S&P 500 components (simplified check)
            if symbol in ['SPY', 'QQQ', 'IWM']:  # ETFs don't have earnings, but for example
                return EventSeverity.MEDIUM
            
            # Default for unknown symbols
            return EventSeverity.MEDIUM
            
        except Exception as e:
            self.algorithm.Error(f"Error assessing earnings severity for {symbol}: {e}")
            return EventSeverity.MEDIUM
    
    def _update_position_risk_assessment(self, symbol: str):
        """Update position risk assessment based on upcoming events"""
        try:
            if symbol not in self.position_event_risks:
                return
            
            current_time = self.algorithm.Time
            risk_assessment = self.position_event_risks[symbol]
            
            # Assess earnings risk
            earnings_risk = 0.0
            next_earnings = None
            if symbol in self.earnings_calendar:
                for earnings in self.earnings_calendar[symbol]:
                    if earnings['date'] > current_time:
                        days_to_earnings = (earnings['date'] - current_time).days
                        if days_to_earnings <= 14:  # Risk window
                            severity_multiplier = {
                                EventSeverity.LOW: 0.3,
                                EventSeverity.MEDIUM: 0.6,
                                EventSeverity.HIGH: 1.0,
                                EventSeverity.CRITICAL: 1.5
                            }.get(earnings['severity'], 0.6)
                            
                            earnings_risk = max(earnings_risk, 
                                              (14 - days_to_earnings) / 14 * severity_multiplier)
                            next_earnings = earnings['date']
                        break
            
            # Assess dividend risk
            dividend_risk = 0.0
            next_dividend = None
            if symbol in self.dividend_calendar:
                for dividend in self.dividend_calendar[symbol]:
                    if dividend['ex_date'] > current_time:
                        days_to_dividend = (dividend['ex_date'] - current_time).days
                        if days_to_dividend <= 7:  # Risk window
                            dividend_risk = max(dividend_risk, 
                                               (7 - days_to_dividend) / 7 * dividend['yield'])
                            next_dividend = dividend['ex_date']
                        break
            
            # Update risk assessment
            risk_assessment.update({
                'earnings_risk': earnings_risk,
                'dividend_risk': dividend_risk,
                'combined_risk': min(1.0, earnings_risk + dividend_risk),
                'next_earnings': next_earnings,
                'next_dividend': next_dividend,
                'last_updated': current_time
            })
            
        except Exception as e:
            self.algorithm.Error(f"Error updating position risk assessment for {symbol}: {e}")
    
    def CheckEntryRestrictions(self, symbol: str, strategy_type: str, 
                              position_size: float, current_time: datetime) -> Dict:
        """Check if entry should be restricted due to upcoming events"""
        try:
            # Ensure symbol is tracked
            if symbol not in self.tracked_symbols:
                self.AddSymbolTracking(symbol)
                
            # Update risk assessment
            self._update_position_risk_assessment(symbol)
            
            # Get risk data
            risk_data = self.position_event_risks[symbol]
            restrictions = []
            recommended_action = AvoidanceAction.CONTINUE_NORMAL
            risk_score = 0.0
            
            # Check earnings restrictions
            if risk_data['next_earnings']:
                days_to_earnings = (risk_data['next_earnings'] - current_time).days
                avoid_days = self.avoidance_config['earnings']['avoid_entry_days']
                
                if days_to_earnings <= avoid_days:
                    restrictions.append(f"Earnings in {days_to_earnings} days - avoid entry")
                    recommended_action = AvoidanceAction.AVOID_NEW_ENTRIES
                    risk_score += 0.7
            
            # Check dividend restrictions
            if risk_data['next_dividend']:
                days_to_dividend = (risk_data['next_dividend'] - current_time).days
                avoid_days = self.avoidance_config['dividends']['avoid_entry_days']
                
                if days_to_dividend <= avoid_days:
                    restrictions.append(f"Ex-dividend in {days_to_dividend} days - avoid entry")
                    if recommended_action == AvoidanceAction.CONTINUE_NORMAL:
                        recommended_action = AvoidanceAction.INCREASE_CAUTION
                    risk_score += 0.3
            
            # Check market events
            for event_id, event in self.market_events.items():
                days_to_event = (event['date'] - current_time).days
                buffer_days = event['buffer_period'].days
                
                if 0 <= days_to_event <= buffer_days:
                    if event['severity'] in [EventSeverity.HIGH, EventSeverity.CRITICAL]:
                        restrictions.append(f"{event['description']} in {days_to_event} days")
                        recommended_action = AvoidanceAction.AVOID_NEW_ENTRIES
                        risk_score += 0.5
            
            # Determine overall restriction level
            entry_allowed = recommended_action in [AvoidanceAction.CONTINUE_NORMAL, AvoidanceAction.INCREASE_CAUTION]
            
            # Calculate position size adjustment
            size_multiplier = 1.0
            if recommended_action == AvoidanceAction.INCREASE_CAUTION:
                size_multiplier = 0.75  # Reduce by 25%
            elif recommended_action == AvoidanceAction.AVOID_NEW_ENTRIES:
                size_multiplier = 0.0   # No entry allowed
            
            return {
                'entry_allowed': entry_allowed,
                'recommended_action': recommended_action.value,
                'restrictions': restrictions,
                'risk_score': min(1.0, risk_score),
                'size_multiplier': size_multiplier,
                'earnings_risk': risk_data['earnings_risk'],
                'dividend_risk': risk_data['dividend_risk'],
                'combined_risk': risk_data['combined_risk'],
                'next_earnings': risk_data['next_earnings'],
                'next_dividend': risk_data['next_dividend'],
                'reason': '; '.join(restrictions) if restrictions else 'No restrictions'
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error checking entry restrictions for {symbol}: {e}")
            return {
                'entry_allowed': True,
                'recommended_action': AvoidanceAction.CONTINUE_NORMAL.value,
                'error': str(e)
            }
    
    def ManagePositionsForEvents(self, current_time: datetime) -> List[Dict]:
        """Manage existing positions based on upcoming events"""
        try:
            management_actions = []
            
            for symbol in self.tracked_symbols:
                if symbol not in self.algorithm.Portfolio:
                    continue
                    
                position = self.algorithm.Portfolio[symbol]
                if not position.Invested:
                    continue
                
                # Update risk assessment
                self._update_position_risk_assessment(symbol)
                risk_data = self.position_event_risks[symbol]
                
                # Check for required actions
                actions = self._evaluate_position_management(symbol, position, risk_data, current_time)
                
                if actions:
                    management_actions.extend(actions)
            
            # Execute management actions
            for action in management_actions:
                self._execute_position_management(action)
            
            return management_actions
            
        except Exception as e:
            self.algorithm.Error(f"Error managing positions for events: {e}")
            return []
    
    def _evaluate_position_management(self, symbol: str, position, risk_data: Dict, current_time: datetime) -> List[Dict]:
        """Evaluate position management needs"""
        try:
            actions = []
            
            # Check earnings proximity
            if risk_data['next_earnings']:
                days_to_earnings = (risk_data['next_earnings'] - current_time).days
                close_days = self.avoidance_config['earnings']['close_position_days']
                
                if days_to_earnings <= close_days:
                    actions.append({
                        'symbol': symbol,
                        'action': 'CLOSE',
                        'reason': f'Earnings in {days_to_earnings} days - close position',
                        'priority': 'HIGH',
                        'event_type': 'EARNINGS'
                    })
            
            # Check dividend proximity for naked positions
            if risk_data['next_dividend'] and self.avoidance_config['dividends']['close_naked_positions']:
                days_to_dividend = (risk_data['next_dividend'] - current_time).days
                
                if days_to_dividend <= 1 and position.Quantity < 0:  # Short position
                    actions.append({
                        'symbol': symbol,
                        'action': 'CLOSE',
                        'reason': f'Ex-dividend tomorrow - close short position',
                        'priority': 'URGENT',
                        'event_type': 'DIVIDEND'
                    })
            
            # Check for profit-taking before events
            if risk_data['combined_risk'] > 0.5 and position.UnrealizedProfit > 0:
                profit_threshold = self.avoidance_config['position_management']['profit_take_before_events']
                if position.UnrealizedProfit >= position.AveragePrice * profit_threshold:
                    actions.append({
                        'symbol': symbol,
                        'action': 'TAKE_PROFIT',
                        'reason': f'Take profit before events (risk: {risk_data["combined_risk"]:.1%})',
                        'priority': 'MEDIUM',
                        'event_type': 'GENERAL'
                    })
            
            return actions
            
        except Exception as e:
            self.algorithm.Error(f"Error evaluating position management for {symbol}: {e}")
            return []
    
    def _execute_position_management(self, action: Dict):
        """Execute position management action"""
        try:
            symbol = action['symbol']
            action_type = action['action']
            
            self.algorithm.Log(f"📅 EVENT MANAGEMENT: {symbol}")
            self.algorithm.Log(f"   • Action: {action_type}")
            self.algorithm.Log(f"   • Reason: {action['reason']}")
            self.algorithm.Log(f"   • Priority: {action['priority']}")
            
            if action_type == 'CLOSE':
                self.algorithm.Liquidate(symbol, f"Event avoidance: {action['reason']}")
                self.avoidance_stats['positions_closed_preemptively'] += 1
                
            elif action_type == 'TAKE_PROFIT':
                # For now, liquidate (could be more sophisticated)
                self.algorithm.Liquidate(symbol, f"Event profit-taking: {action['reason']}")
                self.avoidance_stats['positions_closed_preemptively'] += 1
                
            elif action_type == 'ADJUST':
                # Position adjustment logic would go here
                self.avoidance_stats['positions_adjusted'] += 1
                self.algorithm.Log(f"📊 Position adjustment needed for {symbol}")
            
        except Exception as e:
            self.algorithm.Error(f"Error executing position management action: {e}")
    
    def GetAvoidanceStatus(self) -> Dict:
        """Get earnings and dividend avoidance system status"""
        try:
            current_time = self.algorithm.Time
            
            # Count upcoming events
            upcoming_earnings = 0
            upcoming_dividends = 0
            
            for symbol in self.tracked_symbols:
                if symbol in self.earnings_calendar:
                    upcoming_earnings += len([e for e in self.earnings_calendar[symbol] 
                                            if e['date'] > current_time])
                if symbol in self.dividend_calendar:
                    upcoming_dividends += len([d for d in self.dividend_calendar[symbol] 
                                             if d['ex_date'] > current_time])
            
            return {
                'tracked_symbols': len(self.tracked_symbols),
                'upcoming_earnings': upcoming_earnings,
                'upcoming_dividends': upcoming_dividends,
                'market_events': len(self.market_events),
                'events_avoided': self.avoidance_stats['events_avoided'],
                'positions_closed': self.avoidance_stats['positions_closed_preemptively'],
                'positions_adjusted': self.avoidance_stats['positions_adjusted'],
                'total_events_tracked': self.avoidance_stats['events_tracked'],
                'system_active': True
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error getting avoidance status: {e}")
            return {'error': str(e), 'system_active': False}