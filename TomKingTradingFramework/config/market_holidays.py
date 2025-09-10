# region imports
from AlgorithmImports import *
from datetime import datetime, date, time, timedelta
from typing import Dict, List, Optional
# endregion

class MarketHolidays:
    """
    US Market Holiday Calendar for Trading System
    Simple, maintainable, no over-engineering
    Updates annually with known holidays
    """
    
    def __init__(self):
        # 2025 US Market Holidays (NYSE/NASDAQ closed)
        self.holidays_2025 = {
            date(2025, 1, 1): "New Year's Day",
            date(2025, 1, 20): "Martin Luther King Jr. Day",
            date(2025, 2, 17): "Presidents Day",
            date(2025, 4, 18): "Good Friday",
            date(2025, 5, 26): "Memorial Day",
            date(2025, 6, 19): "Juneteenth",
            date(2025, 7, 4): "Independence Day",
            date(2025, 9, 1): "Labor Day",
            date(2025, 11, 27): "Thanksgiving Day",
            date(2025, 12, 25): "Christmas Day"
        }
        
        # Early close days (2:00 PM ET close)
        self.early_close_2025 = {
            date(2025, 7, 3): "Day before Independence Day",
            date(2025, 11, 28): "Day after Thanksgiving",
            date(2025, 12, 24): "Christmas Eve"
        }
        
        # 2026 US Market Holidays (for forward planning)
        self.holidays_2026 = {
            date(2026, 1, 1): "New Year's Day",
            date(2026, 1, 19): "Martin Luther King Jr. Day",
            date(2026, 2, 16): "Presidents Day",
            date(2026, 4, 3): "Good Friday",
            date(2026, 5, 25): "Memorial Day",
            date(2026, 6, 19): "Juneteenth",
            date(2026, 7, 3): "Independence Day (Observed)",  # July 4 is Saturday
            date(2026, 9, 7): "Labor Day",
            date(2026, 11, 26): "Thanksgiving Day",
            date(2026, 12, 25): "Christmas Day"
        }
        
        # Combine all holidays
        self.all_holidays = {
            **self.holidays_2025,
            **self.holidays_2026
        }
        
        self.all_early_close = {
            **self.early_close_2025
        }
        
    def is_market_holiday(self, check_date: datetime) -> bool:
        """Check if given date is a market holiday"""
        date_only = check_date.date() if isinstance(check_date, datetime) else check_date
        return date_only in self.all_holidays
        
    def is_early_close(self, check_date: datetime) -> bool:
        """Check if given date is an early close day"""
        date_only = check_date.date() if isinstance(check_date, datetime) else check_date
        return date_only in self.all_early_close
        
    def get_holiday_name(self, check_date: datetime) -> Optional[str]:
        """Get holiday name if date is a holiday"""
        date_only = check_date.date() if isinstance(check_date, datetime) else check_date
        return self.all_holidays.get(date_only)
        
    def is_trading_day(self, check_date: datetime) -> bool:
        """Check if given date is a regular trading day"""
        date_only = check_date.date() if isinstance(check_date, datetime) else check_date
        
        # Not a trading day if weekend
        if date_only.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
            
        # Not a trading day if holiday
        if self.is_market_holiday(date_only):
            return False
            
        return True
        
    def get_next_trading_day(self, from_date: datetime) -> datetime:
        """Get next trading day from given date"""
        next_day = from_date
        
        while True:
            next_day = next_day + timedelta(days=1)
            if self.is_trading_day(next_day):
                return next_day
                
    def get_previous_trading_day(self, from_date: datetime) -> datetime:
        """Get previous trading day from given date"""
        prev_day = from_date
        
        while True:
            prev_day = prev_day - timedelta(days=1)
            if self.is_trading_day(prev_day):
                return prev_day
                
    def days_until_next_holiday(self, from_date: datetime) -> int:
        """Days until next market holiday"""
        date_only = from_date.date() if isinstance(from_date, datetime) else from_date
        
        future_holidays = [h for h in self.all_holidays.keys() if h > date_only]
        if future_holidays:
            next_holiday = min(future_holidays)
            return (next_holiday - date_only).days
        return 999  # No upcoming holidays in calendar
        
    def is_expiration_safe(self, expiry_date: datetime) -> bool:
        """Check if expiration date avoids holidays"""
        date_only = expiry_date.date() if isinstance(expiry_date, datetime) else expiry_date
        
        # Check if expiry is on a holiday
        if self.is_market_holiday(date_only):
            return False
            
        # Check if day before expiry is a holiday (assignment risk)
        day_before = date_only - timedelta(days=1)
        if self.is_market_holiday(day_before):
            return False
            
        return True
        
    def adjust_entry_time_for_early_close(self, check_date: datetime, normal_time: time) -> time:
        """Adjust entry times for early close days"""
        if self.is_early_close(check_date):
            # Move entries earlier on early close days
            if normal_time.hour >= 14:  # 2 PM or later
                return time(13, 30)  # Move to 1:30 PM
            elif normal_time.hour >= 10:
                return time(normal_time.hour - 1, normal_time.minute)  # 1 hour earlier
                
        return normal_time
        
    def get_trading_days_in_month(self, year: int, month: int) -> int:
        """Count trading days in a given month"""
        from calendar import monthrange
        
        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])
        
        count = 0
        current = first_day
        while current <= last_day:
            if self.is_trading_day(current):
                count += 1
            current = current + timedelta(days=1)
            
        return count
        
    def log_upcoming_holidays(self, algorithm, days_ahead: int = 30):
        """Log upcoming holidays for awareness"""
        today = algorithm.Time.date()
        end_date = today + timedelta(days=days_ahead)
        
        upcoming = []
        for holiday_date, holiday_name in sorted(self.all_holidays.items()):
            if today < holiday_date <= end_date:
                days_until = (holiday_date - today).days
                upcoming.append(f"{holiday_date}: {holiday_name} ({days_until} days)")
                
        if upcoming:
            algorithm.Log(f"[HOLIDAYS] Upcoming market closures:")
            for holiday in upcoming:
                algorithm.Log(f"  - {holiday}")
                
        # Check early closes too
        early_closes = []
        for close_date, close_name in sorted(self.all_early_close.items()):
            if today < close_date <= end_date:
                days_until = (close_date - today).days
                early_closes.append(f"{close_date}: {close_name} - 2PM close ({days_until} days)")
                
        if early_closes:
            algorithm.Log(f"[EARLY CLOSE] Upcoming early closures:")
            for early in early_closes:
                algorithm.Log(f"  - {early}")
                
    def validate_strategy_schedule(self, algorithm) -> Dict:
        """Validate that strategies won't execute on holidays"""
        issues = []
        current_date = algorithm.Time.date()
        
        # Check next Friday for 0DTE
        days_to_friday = (4 - current_date.weekday()) % 7
        if days_to_friday == 0:
            days_to_friday = 7
        next_friday = current_date + timedelta(days=days_to_friday)
        
        if self.is_market_holiday(next_friday):
            issues.append(f"Friday 0DTE blocked: {next_friday} is {self.get_holiday_name(next_friday)}")
            
        # Check next Wednesday for LT112
        days_to_wednesday = (2 - current_date.weekday()) % 7
        if days_to_wednesday == 0:
            days_to_wednesday = 7
        next_wednesday = current_date + timedelta(days=days_to_wednesday)
        
        if self.is_market_holiday(next_wednesday):
            issues.append(f"LT112 blocked: {next_wednesday} is {self.get_holiday_name(next_wednesday)}")
            
        # Check next Thursday for Futures Strangle
        days_to_thursday = (3 - current_date.weekday()) % 7
        if days_to_thursday == 0:
            days_to_thursday = 7
        next_thursday = current_date + timedelta(days=days_to_thursday)
        
        if self.is_market_holiday(next_thursday):
            issues.append(f"Futures Strangle blocked: {next_thursday} is {self.get_holiday_name(next_thursday)}")
            
        return {
            'has_issues': len(issues) > 0,
            'issues': issues,
            'next_friday_clear': not self.is_market_holiday(next_friday),
            'next_wednesday_clear': not self.is_market_holiday(next_wednesday),
            'next_thursday_clear': not self.is_market_holiday(next_thursday)
        }