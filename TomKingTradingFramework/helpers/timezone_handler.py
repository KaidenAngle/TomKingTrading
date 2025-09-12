# region imports
from AlgorithmImports import *
from datetime import datetime, time, timedelta
# endregion

class TimezoneHandler:
    """
    Handles timezone conversions for Tom King Trading Framework
    Ensures all time comparisons are done in Eastern Time with DST awareness
    """
    
    def __init__(self, algo):
        self.algo = algo
        # QuantConnect uses Eastern Time by default for US markets
        # The algo.Time property is already in Eastern Time
        
    def get_market_time(self):
        """
        Get current market time in Eastern Time
        QuantConnect's algo.Time is already in Eastern Time for US markets
        """
        return self.algo.Time
    
    def is_market_hours(self):
        """Check if currently in regular market hours (9:30 AM - 4:00 PM, ET)"""
        current = self.get_market_time()
        market_open = time(9, 30)
        market_close = time(16, 0)
        
        return (current.weekday() < 5 and  # Monday-Friday
                market_open <= current.time() < market_close)
    
    def is_past_time(self, hour, minute):
        """
        Check if current time is past the specified hour:minute in Eastern Time
        
        Args:
            hour: Hour in 24-hour format (0-23)
            minute: Minute (0-59)
            
        Returns:
            bool: True if current time is past specified time
        """
        current = self.get_market_time()
        target_time = time(hour, minute)
        
        return current.time() >= target_time
    
    def is_before_time(self, hour, minute):
        """
        Check if current time is before the specified hour:minute in Eastern Time
        
        Args:
            hour: Hour in 24-hour format (0-23)
            minute: Minute (0-59)
            
        Returns:
            bool: True if current time is before specified time
        """
        current = self.get_market_time()
        target_time = time(hour, minute)
        
        return current.time() < target_time
    
    def is_between_times(self, start_hour, start_minute, end_hour, end_minute):
        """
        Check if current time is between two times in Eastern Time
        
        Args:
            start_hour: Start hour in 24-hour format
            start_minute: Start minute
            end_hour: End hour in 24-hour format
            end_minute: End minute
            
        Returns:
            bool: True if current time is between start and end times
        """
        current = self.get_market_time()
        start_time = time(start_hour, start_minute)
        end_time = time(end_hour, end_minute)
        
        current_time = current.time()
        
        # Handle case where end time is before start time (spans, midnight)
        if end_time < start_time:
            return current_time >= start_time or current_time < end_time
        else:
            return start_time <= current_time < end_time
    
    def minutes_until_time(self, hour, minute):
        """
        Calculate minutes until a specific time today
        
        Args:
            hour: Target hour in 24-hour format
            minute: Target minute
            
        Returns:
            int: Minutes until target time (negative if, past)
        """
        current = self.get_market_time()
        target = current.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If target time has passed today, it's negative
        delta = target - current
        return int(delta.total_seconds() / 60)
    
    def get_next_market_open(self):
        """Get the next market open time"""
        current = self.get_market_time()
        
        # If it's before 9:30 AM on a weekday, market opens today
        if current.weekday() < 5 and current.time() < time(9, 30):
            return current.replace(hour=9, minute=30, second=0, microsecond=0)
        
        # Otherwise, find next weekday
        next_open = current.replace(hour=9, minute=30, second=0, microsecond=0)
        next_open += timedelta(days=1)
        
        # Skip to Monday if it's weekend
        while next_open.weekday() >= 5:
            next_open += timedelta(days=1)
            
        return next_open
    
    def format_time(self, dt=None):
        """
        Format datetime for logging in Eastern Time
        
        Args:
            dt: datetime object (uses current time if, None)
            
        Returns:
            str: Formatted time string "HH:MM ET"
        """
        if dt is None:
            dt = self.get_market_time()
        
        return dt.strftime("%H:%M ET")
    
    def log_time_check(self, description):
        """
        Log a time check with Eastern Time notation
        
        Args:
            description: Description of the time check
        """
        current = self.get_market_time()
        self.algo.Log(f"[TIME CHECK] {description} at {self.format_time(current)}")