# Tom King Trading Framework - Weekly Cadence Tracker
# CRITICAL: Tracks weekly entry cadence for LT112 and other strategies
# Implements Tom King's specific weekly rhythm system

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum

class WeekOfMonth(Enum):
    """Week of month enumeration"""
    WEEK_1 = 1
    WEEK_2 = 2
    WEEK_3 = 3
    WEEK_4 = 4
    WEEK_5 = 5  # Some months have 5 weeks

class DayOfWeek(Enum):
    """Day of week enumeration"""
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6

class WeeklyCadenceTracker:
    """
    Weekly Cadence Tracking System for Tom King Framework
    
    CRITICAL FUNCTIONALITY:
    - Tracks which week of month for LT112 entries
    - Enforces weekly rhythm (specific strategies on specific days)
    - Prevents duplicate entries in same week
    - Manages 4-week LT112 cycle
    - Tracks monthly reset points
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Weekly rhythm schedule (Tom King specification)
        self.WEEKLY_RHYTHM = {
            DayOfWeek.MONDAY: ['LEAP_LADDER', 'PORTFOLIO_REVIEW'],
            DayOfWeek.TUESDAY: ['MARKET_ANALYSIS'],
            DayOfWeek.WEDNESDAY: ['LT112', 'POSITION_MANAGEMENT'],
            DayOfWeek.THURSDAY: ['FUTURES_STRANGLE', 'PREPARATION'],
            DayOfWeek.FRIDAY: ['FRIDAY_0DTE', 'WEEKLY_CLOSEOUT'],
            DayOfWeek.SATURDAY: ['PLANNING'],
            DayOfWeek.SUNDAY: ['REVIEW', 'PREPARATION']
        }
        
        # LT112 weekly entry tracking
        self.lt112_entries = {}  # {month_year: {week_num: entry_data}}
        self.current_month_entries = {}
        
        # Strategy execution tracking
        self.executed_this_week = set()  # Strategies executed this week
        self.last_execution = {}  # {strategy: last_execution_date}
        
        # Monthly IPMCC tracking
        self.ipmcc_entered_this_month = False
        self.last_ipmcc_month = None
        
        # Week tracking
        self.current_week = None
        self.current_month = None
        
        self.algorithm.Log("✅ WEEKLY CADENCE TRACKER INITIALIZED")
    
    def get_week_of_month(self, date: datetime) -> WeekOfMonth:
        """
        Determine which week of the month a date falls in
        
        Week 1: Days 1-7
        Week 2: Days 8-14
        Week 3: Days 15-21
        Week 4: Days 22-28
        Week 5: Days 29-31 (if exists)
        """
        day = date.day
        
        if day <= 7:
            return WeekOfMonth.WEEK_1
        elif day <= 14:
            return WeekOfMonth.WEEK_2
        elif day <= 21:
            return WeekOfMonth.WEEK_3
        elif day <= 28:
            return WeekOfMonth.WEEK_4
        else:
            return WeekOfMonth.WEEK_5
    
    def get_trading_week_of_month(self, date: datetime) -> int:
        """
        Get trading week of month (counting only trading days)
        Used for LT112 weekly entries
        """
        # Find first trading day of month
        first_of_month = datetime(date.year, date.month, 1)
        
        # Count trading weeks
        week_count = 1
        current_date = first_of_month
        
        while current_date < date:
            # If it's a new week and a weekday, increment week count
            if current_date.weekday() == 0 and current_date != first_of_month:  # Monday
                week_count += 1
            current_date += timedelta(days=1)
        
        return min(week_count, 4)  # Cap at 4 weeks for LT112
    
    def can_enter_lt112(self, date: datetime = None) -> Tuple[bool, str]:
        """
        Check if LT112 entry is allowed based on weekly cadence
        
        Returns:
            Tuple of (can_enter, reason)
        """
        if date is None:
            date = self.algorithm.Time
        
        # Must be Wednesday (Tom King specification)
        if date.weekday() != DayOfWeek.WEDNESDAY.value:
            return False, "LT112 only enters on Wednesdays"
        
        # Get current month and week
        month_key = f"{date.year}_{date.month:02d}"
        week_num = self.get_trading_week_of_month(date)
        
        # Initialize month tracking if new month
        if month_key not in self.lt112_entries:
            self.lt112_entries[month_key] = {}
        
        # Check if already entered this week
        if week_num in self.lt112_entries[month_key]:
            entry_data = self.lt112_entries[month_key][week_num]
            return False, f"Already entered LT112 in week {week_num} on {entry_data['date']}"
        
        # Check total entries this month (max 4)
        month_entries = len(self.lt112_entries[month_key])
        if month_entries >= 4:
            return False, f"Maximum 4 LT112 entries per month reached ({month_entries}/4)"
        
        # Check account phase restrictions
        account_phase = getattr(self.algorithm, 'account_phase', 1)
        if account_phase < 2:
            return False, "LT112 requires Phase 2+ account (£40k+)"
        
        return True, f"Week {week_num} entry available"
    
    def record_lt112_entry(self, underlying: str, strikes: Dict, 
                          credit: float, quantity: int = 1) -> bool:
        """
        Record an LT112 entry for weekly tracking
        
        Returns:
            True if recorded successfully
        """
        date = self.algorithm.Time
        month_key = f"{date.year}_{date.month:02d}"
        week_num = self.get_trading_week_of_month(date)
        
        # Validate entry allowed
        can_enter, reason = self.can_enter_lt112(date)
        if not can_enter:
            self.algorithm.Error(f"Cannot record LT112 entry: {reason}")
            return False
        
        # Record entry
        if month_key not in self.lt112_entries:
            self.lt112_entries[month_key] = {}
        
        self.lt112_entries[month_key][week_num] = {
            'date': date.strftime('%Y-%m-%d'),
            'week': week_num,
            'underlying': underlying,
            'strikes': strikes,
            'credit': credit,
            'quantity': quantity,
            'status': 'open'
        }
        
        self.algorithm.Log(f"✅ LT112 ENTRY RECORDED: Week {week_num}/4 for {month_key}")
        self.algorithm.Log(f"   Underlying: {underlying}")
        self.algorithm.Log(f"   Credit: ${credit:.2f}")
        
        return True
    
    def get_lt112_status(self) -> Dict:
        """Get current LT112 weekly entry status"""
        date = self.algorithm.Time
        month_key = f"{date.year}_{date.month:02d}"
        week_num = self.get_trading_week_of_month(date)
        
        entries = self.lt112_entries.get(month_key, {})
        
        # Build status for each week
        week_status = {}
        for week in range(1, 5):
            if week in entries:
                week_status[f"Week_{week}"] = {
                    'entered': True,
                    'date': entries[week]['date'],
                    'underlying': entries[week]['underlying'],
                    'credit': entries[week]['credit']
                }
            else:
                week_status[f"Week_{week}"] = {
                    'entered': False,
                    'available': week >= week_num  # Future weeks available
                }
        
        return {
            'current_month': month_key,
            'current_week': week_num,
            'total_entries': len(entries),
            'remaining_weeks': max(0, 4 - week_num),
            'week_status': week_status,
            'can_enter_today': self.can_enter_lt112()[0]
        }
    
    def can_execute_strategy(self, strategy: str, date: datetime = None) -> Tuple[bool, str]:
        """
        Check if a strategy can be executed based on weekly rhythm
        
        Returns:
            Tuple of (can_execute, reason)
        """
        if date is None:
            date = self.algorithm.Time
        
        day_of_week = DayOfWeek(date.weekday())
        
        # Check if strategy is scheduled for today
        todays_strategies = self.WEEKLY_RHYTHM.get(day_of_week, [])
        
        # Normalize strategy name
        strategy_upper = strategy.upper().replace('_', '')
        allowed_today = any(s.replace('_', '') == strategy_upper for s in todays_strategies)
        
        if not allowed_today:
            scheduled_days = []
            for day, strategies in self.WEEKLY_RHYTHM.items():
                if any(s.replace('_', '').upper() == strategy_upper for s in strategies):
                    scheduled_days.append(day.name)
            
            if scheduled_days:
                return False, f"{strategy} only executes on {', '.join(scheduled_days)}"
            else:
                return False, f"{strategy} not in weekly rhythm schedule"
        
        # Special checks for specific strategies
        if strategy == "FRIDAY_0DTE":
            if date.weekday() != DayOfWeek.FRIDAY.value:
                return False, "0DTE only trades on Fridays"
            
            current_time = date.time()
            if current_time < datetime.strptime("10:30", "%H:%M").time():
                return False, "0DTE entries start at 10:30 AM"
        
        elif strategy == "LT112":
            return self.can_enter_lt112(date)
        
        elif strategy == "IPMCC":
            # First trading day of month check
            if not self._is_first_trading_week(date):
                return False, "IPMCC enters first week of month only"
            
            month_key = f"{date.year}_{date.month:02d}"
            if self.last_ipmcc_month == month_key:
                return False, "IPMCC already entered this month"
        
        return True, f"Can execute {strategy} on {day_of_week.name}"
    
    def _is_first_trading_week(self, date: datetime) -> bool:
        """Check if date is in first trading week of month"""
        week = self.get_trading_week_of_month(date)
        return week == 1
    
    def record_strategy_execution(self, strategy: str) -> bool:
        """Record that a strategy has been executed"""
        date = self.algorithm.Time
        
        # Record execution
        self.last_execution[strategy] = date
        
        # Special handling for monthly strategies
        if strategy == "IPMCC":
            month_key = f"{date.year}_{date.month:02d}"
            self.last_ipmcc_month = month_key
            self.ipmcc_entered_this_month = True
        
        # Add to weekly execution set
        week_key = f"{date.year}_W{date.isocalendar()[1]}"
        if week_key not in self.executed_this_week:
            self.executed_this_week = set()
        self.executed_this_week.add(strategy)
        
        self.algorithm.Log(f"📝 Recorded {strategy} execution for {date.strftime('%Y-%m-%d')}")
        
        return True
    
    def get_todays_schedule(self) -> List[str]:
        """Get list of strategies scheduled for today"""
        date = self.algorithm.Time
        day_of_week = DayOfWeek(date.weekday())
        
        return self.WEEKLY_RHYTHM.get(day_of_week, [])
    
    def get_weekly_summary(self) -> Dict:
        """Get comprehensive weekly execution summary"""
        date = self.algorithm.Time
        week_num = self.get_trading_week_of_month(date)
        month_key = f"{date.year}_{date.month:02d}"
        
        # Get this week's executions
        week_key = f"{date.year}_W{date.isocalendar()[1]}"
        
        # Build day-by-day schedule
        weekly_plan = {}
        start_of_week = date - timedelta(days=date.weekday())
        
        for i in range(7):
            day_date = start_of_week + timedelta(days=i)
            day_of_week = DayOfWeek(i)
            scheduled = self.WEEKLY_RHYTHM.get(day_of_week, [])
            
            weekly_plan[day_of_week.name] = {
                'date': day_date.strftime('%Y-%m-%d'),
                'scheduled': scheduled,
                'is_today': day_date.date() == date.date(),
                'is_past': day_date.date() < date.date()
            }
        
        return {
            'current_week': week_num,
            'month': month_key,
            'todays_schedule': self.get_todays_schedule(),
            'weekly_plan': weekly_plan,
            'lt112_status': self.get_lt112_status(),
            'executed_this_week': list(self.executed_this_week) if self.executed_this_week else []
        }
    
    def should_reset_weekly_tracking(self) -> bool:
        """Check if we should reset weekly tracking (new week)"""
        date = self.algorithm.Time
        week_key = f"{date.year}_W{date.isocalendar()[1]}"
        
        if self.current_week != week_key:
            self.current_week = week_key
            self.executed_this_week = set()
            return True
        
        return False
    
    def should_reset_monthly_tracking(self) -> bool:
        """Check if we should reset monthly tracking (new month)"""
        date = self.algorithm.Time
        month_key = f"{date.year}_{date.month:02d}"
        
        if self.current_month != month_key:
            self.current_month = month_key
            self.current_month_entries = {}
            self.ipmcc_entered_this_month = False
            return True
        
        return False
    
    def get_phase_adjusted_schedule(self, account_phase: int) -> Dict:
        """
        Get weekly schedule adjusted for account phase
        
        Phase 1: Basic strategies only
        Phase 2: Add LT112
        Phase 3: Add advanced strategies
        Phase 4: Full system
        """
        base_schedule = dict(self.WEEKLY_RHYTHM)
        
        # Adjust based on phase
        if account_phase < 2:
            # Remove LT112 from Wednesday
            if DayOfWeek.WEDNESDAY in base_schedule:
                base_schedule[DayOfWeek.WEDNESDAY] = [
                    s for s in base_schedule[DayOfWeek.WEDNESDAY] 
                    if s != 'LT112'
                ]
        
        if account_phase < 3:
            # Remove advanced strategies
            if DayOfWeek.MONDAY in base_schedule:
                base_schedule[DayOfWeek.MONDAY] = [
                    s for s in base_schedule[DayOfWeek.MONDAY]
                    if s != 'LEAP_LADDER'
                ]
        
        return base_schedule
    
    def get_next_lt112_opportunity(self) -> Optional[Dict]:
        """Get the next available LT112 entry opportunity"""
        date = self.algorithm.Time
        month_key = f"{date.year}_{date.month:02d}"
        current_week = self.get_trading_week_of_month(date)
        
        # Check remaining weeks in current month
        entries = self.lt112_entries.get(month_key, {})
        
        for week in range(current_week, 5):
            if week not in entries and week <= 4:
                # Find next Wednesday
                days_until_wednesday = (2 - date.weekday()) % 7
                if days_until_wednesday == 0 and date.hour >= 10:
                    # Already past entry time today
                    days_until_wednesday = 7
                
                next_wednesday = date + timedelta(days=days_until_wednesday)
                
                # Check if still in same month
                if next_wednesday.month == date.month:
                    return {
                        'week': week,
                        'date': next_wednesday.strftime('%Y-%m-%d'),
                        'days_away': days_until_wednesday
                    }
        
        # Next month
        next_month = datetime(date.year, date.month + 1, 1) if date.month < 12 else datetime(date.year + 1, 1, 1)
        # Find first Wednesday
        days_until_wednesday = (2 - next_month.weekday()) % 7
        first_wednesday = next_month + timedelta(days=days_until_wednesday)
        
        return {
            'week': 1,
            'date': first_wednesday.strftime('%Y-%m-%d'),
            'days_away': (first_wednesday - date).days,
            'next_month': True
        }