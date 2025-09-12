# Corporate Events Checker - Robust earnings and dividend detection
# Prevents trading during high-risk corporate events
# Now integrated with enhanced QuantConnect Event Calendar API

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

# Import the enhanced event calendar if available
try:
    
except Exception as e:

    # Log and handle unexpected exception

    print(f'Unexpected exception: {e}')

    raise
from helpers.quantconnect_event_calendar import QuantConnectEventCalendar, EventType, MarketEvent
    HAS_ENHANCED_CALENDAR = True
except ImportError:
    HAS_ENHANCED_CALENDAR = False

class CorporateEventsChecker:
    """
    Comprehensive checker for earnings, dividends, and other corporate events
    Prevents unexpected volatility from corporate actions
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Event detection windows (days before/after)
        self.event_windows = {
            'earnings_blackout': (3, 1),     # 3 days before, 1 day after
            'dividend_blackout': (2, 1),     # 2 days before, 1 day after  
            'split_blackout': (5, 2),         # 5 days before, 2 days after
            'merger_blackout': (10, 5)       # 10 days before, 5 days after
        }
        
        # Cache for event data
        self.earnings_cache = {}
        self.dividend_cache = {}
        self.corporate_actions_cache = {}
        self.last_cache_update = None
        
        # Known earnings dates for major holdings (fallback data)
        self.known_earnings_dates = {
            'AAPL': self._get_quarterly_dates(1, 25),  # ~Jan 25, Apr 25, Jul 25, Oct 25
            'MSFT': self._get_quarterly_dates(1, 20),  # ~Jan 20, Apr 20, Jul 20, Oct 20
            'GOOGL': self._get_quarterly_dates(1, 28), # ~Jan 28, Apr 28, Jul 28, Oct 28
            'AMZN': self._get_quarterly_dates(2, 1),   # ~Feb 1, May 1, Aug 1, Nov 1
            'META': self._get_quarterly_dates(1, 27),  # ~Jan 27, Apr 27, Jul 27, Oct 27
            'NVDA': self._get_quarterly_dates(2, 15),  # ~Feb 15, May 15, Aug 15, Nov 15
            'TSLA': self._get_quarterly_dates(1, 18),  # ~Jan 18, Apr 18, Jul 18, Oct 18
            'SPY': []  # ETF - no earnings
        }
        
        # Tracking
        self.events_detected = []
        self.trades_blocked = []
        
    def check_earnings_window(self, symbol, days_before: int = 3, 
                             days_after: int = 1) -> Tuple[bool, str]:
        """
        Check if symbol is within earnings window
        Returns (is_in_window, description)
        """
        
        symbol_str = str(symbol)
        current_date = self.algo.Time.date()
        
        # Try QuantConnect's fundamental data first
        earnings_date = self._get_earnings_date_from_fundamentals(symbol)
        
        # Fallback to known dates
        if not earnings_date and symbol_str in self.known_earnings_dates:
            earnings_date = self._find_next_known_earnings(symbol_str, current_date)
            
        # Fallback to estimate based on quarterly pattern
        if not earnings_date:
            earnings_date = self._estimate_next_earnings(symbol_str, current_date)
            
        if earnings_date:
            days_until = (earnings_date - current_date).days
            
            # Check if within blackout window
            if -days_after <= days_until <= days_before:
                if days_until > 0:
                    return True, f"Earnings in {days_until} days"
                elif days_until == 0:
                    return True, "Earnings TODAY"
                else:
                    return True, f"Earnings {abs(days_until)} days ago"
                    
        return False, "No earnings detected"
        
    def check_dividend_window(self, symbol, days_before: int = 2,
                            days_after: int = 1) -> Tuple[bool, str]:
        """
        Check if symbol is within dividend ex-date window
        Returns (is_in_window, description)
        """
        
        symbol_str = str(symbol)
        current_date = self.algo.Time.date()
        
        # Try to get dividend info
        ex_date = self._get_dividend_ex_date(symbol)
        
        if ex_date:
            days_until = (ex_date - current_date).days
            
            # Check if within blackout window
            if -days_after <= days_until <= days_before:
                if days_until > 0:
                    return True, f"Ex-dividend in {days_until} days"
                elif days_until == 0:
                    return True, "Ex-dividend TODAY"
                else:
                    return True, f"Ex-dividend {abs(days_until)} days ago"
                    
        return False, "No dividend detected"
        
    def check_all_events(self, symbol) -> Dict:
        """
        Comprehensive check for all corporate events
        Returns detailed status dictionary
        """
        
        result = {
            'symbol': str(symbol),
            'timestamp': self.algo.Time,
            'has_events': False,
            'events': [],
            'can_trade': True,
            'risk_level': 'LOW'
        }
        
        # Check earnings
        in_earnings, earnings_desc = self.check_earnings_window(symbol)
        if in_earnings:
            result['has_events'] = True
            result['events'].append(f"EARNINGS: {earnings_desc}")
            result['risk_level'] = 'HIGH'
            
        # Check dividends
        in_dividend, dividend_desc = self.check_dividend_window(symbol)
        if in_dividend:
            result['has_events'] = True
            result['events'].append(f"DIVIDEND: {dividend_desc}")
            if result['risk_level'] != 'HIGH':
                result['risk_level'] = 'MEDIUM'
                
        # Check for splits or other actions
        has_action, action_desc = self._check_corporate_actions(symbol)
        if has_action:
            result['has_events'] = True
            result['events'].append(f"CORP ACTION: {action_desc}")
            result['risk_level'] = 'HIGH'
            
        # Determine if trading should be blocked
        if result['risk_level'] == 'HIGH':
            result['can_trade'] = False
            
            # Log blocked trade
            self.trades_blocked.append({
                'timestamp': self.algo.Time,
                'symbol': str(symbol),
                'reason': result['events']
            })
            
        # Track detected events
        if result['has_events']:
            self.events_detected.extend(result['events'])
            
        return result
        
    def _get_earnings_date_from_fundamentals(self, symbol) -> Optional[datetime.date]:
        """Get earnings date from QuantConnect fundamentals"""
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
if symbol in self.algo.Securities:
                security = self.algo.Securities[symbol]
                
                # Check if has fundamental data
                if hasattr(security, 'Fundamentals'):
                    fundamentals = security.Fundamentals
                    
                    # Try to get earnings announcement date
                    if hasattr(fundamentals, 'EarningReports'):
                        if hasattr(fundamentals.EarningReports, 'FileDate'):
                            file_date = fundamentals.EarningReports.FileDate
                            if file_date and file_date != datetime.min:
                                return file_date.date()
                                
        except Exception as e:
            self.algo.Debug(f"Error getting earnings date for {symbol}: {e}")
            
        return None
        
    def _get_dividend_ex_date(self, symbol) -> Optional[datetime.date]:
        """Get next dividend ex-date"""
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
if symbol in self.algo.Securities:
                security = self.algo.Securities[symbol]
                
                # Check dividend history
                if hasattr(security, 'Fundamentals'):
                    fundamentals = security.Fundamentals
                    
                    # Get ex-dividend date
                    if hasattr(fundamentals, 'EarningRatios'):
                        if hasattr(fundamentals.EarningRatios, 'DividendDate'):
                            div_date = fundamentals.EarningRatios.DividendDate
                            if div_date and div_date != datetime.min:
                                return div_date.date()
                                
        except Exception as e:
            self.algo.Debug(f"Error getting dividend date for {symbol}: {e}")
            
        return None
        
    def _check_corporate_actions(self, symbol) -> Tuple[bool, str]:
        """Check for splits, mergers, or other corporate actions"""
        
        # This would connect to corporate actions data feed
        # For now, return no action
        return False, ""
        
    def _get_quarterly_dates(self, month: int, day: int) -> List[datetime.date]:
        """Generate quarterly earnings dates for current year"""
        
        current_year = self.algo.Time.year
        dates = []
        
        for quarter_month in [month, month + 3, month + 6, month + 9]:
            if quarter_month <= 12:
                try:
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
date = datetime(current_year, quarter_month, day).date()
                    dates.append(date)
                except ValueError:
                    # Handle invalid dates (e.g., Feb 30) - skip silently
                    continue
                    
        return dates
        
    def _find_next_known_earnings(self, symbol: str, 
                                 current_date: datetime.date) -> Optional[datetime.date]:
        """Find next known earnings date for symbol"""
        
        if symbol not in self.known_earnings_dates:
            return None
            
        dates = self.known_earnings_dates[symbol]
        future_dates = [d for d in dates if d > current_date]
        
        if future_dates:
            return min(future_dates)
            
        # If no future dates this year, estimate next year's first earnings
        if dates:
            first_date = min(dates)
            next_year_date = first_date.replace(year=first_date.year + 1)
            return next_year_date
            
        return None
        
    def _estimate_next_earnings(self, symbol: str, 
                               current_date: datetime.date) -> Optional[datetime.date]:
        """Estimate next earnings based on typical patterns"""
        
        # Most companies report quarterly, roughly 45 days after quarter end
        # Quarter ends: Mar 31, Jun 30, Sep 30, Dec 31
        
        quarter_ends = [
            datetime(current_date.year, 3, 31).date(),
            datetime(current_date.year, 6, 30).date(),
            datetime(current_date.year, 9, 30).date(),
            datetime(current_date.year, 12, 31).date()
        ]
        
        # Find next quarter end
        future_quarters = [q for q in quarter_ends if q > current_date]
        
        if future_quarters:
            next_quarter_end = min(future_quarters)
            # Estimate earnings 45 days after quarter end
            estimated_earnings = next_quarter_end + timedelta(days=45)
            return estimated_earnings
            
        # Next year's Q1 earnings
        return datetime(current_date.year + 1, 5, 15).date()
        
    def should_avoid_trading(self, symbol, conservative: bool = True) -> bool:
        """
        Simple boolean check for whether to avoid trading
        Set conservative=True for stricter checking
        """
        
        event_check = self.check_all_events(symbol)
        
        if conservative:
            # Avoid any elevated risk
            return event_check['risk_level'] in ['MEDIUM', 'HIGH']
        else:
            # Only avoid high risk
            return event_check['risk_level'] == 'HIGH'
            
    def get_safe_trading_symbols(self, symbols: List) -> List:
        """Filter list of symbols to only those safe to trade"""
        
        safe_symbols = []
        
        for symbol in symbols:
            if not self.should_avoid_trading(symbol):
                safe_symbols.append(symbol)
            else:
                self.algo.Debug(f"Filtering out {symbol} due to corporate events")
                
        return safe_symbols
        
    def get_statistics(self) -> Dict:
        """Get corporate events checking statistics"""
        
        stats = {
            'total_events_detected': len(self.events_detected),
            'trades_blocked': len(self.trades_blocked),
            'recent_events': self.events_detected[-10:] if self.events_detected else [],
            'recent_blocks': self.trades_blocked[-5:] if self.trades_blocked else []
        }
        
        return stats