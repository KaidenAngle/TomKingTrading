#!/usr/bin/env python3
"""
Base Component - Eliminates Code Duplication
Provides common functionality for all Tom King Trading System components
"""

from typing import Dict, List, Optional, Any
from datetime import datetime
import time

class BaseComponent:
    """
    Base class for all Tom King Trading System components
    Eliminates duplicate code patterns across the system
    """
    
    def __init__(self, algorithm):
        """Standard initialization pattern for all components"""
        self.algorithm = algorithm
        self._last_log_time = {}
        self._component_stats = {
            'initialized_at': datetime.now(),
            'method_calls': 0,
            'errors': 0,
            'warnings': 0
        }
    
    # COMMON UTILITY METHODS
    
    def get_account_phase(self) -> int:
        """Get current account phase based on portfolio value"""
        portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        if portfolio_value >= 75000:
            return 4
        elif portfolio_value >= 60000:
            return 3
        elif portfolio_value >= 40000:
            return 2
        else:
            return 1
    
    def log_throttled(self, message: str, throttle_seconds: int = 30, level: str = 'info'):
        """Log with throttling to prevent spam"""
        current_time = time.time()
        key = f"{level}_{hash(message)}"
        
        if key not in self._last_log_time or (current_time - self._last_log_time[key]) >= throttle_seconds:
            if level == 'debug':
                self.algorithm.Debug(message)
            elif level == 'error':
                self.algorithm.Error(message)
                self._component_stats['errors'] += 1
            else:
                self.algorithm.Log(message)
                
            self._last_log_time[key] = current_time
            
            if 'warning' in message.lower() or 'warn' in message.lower():
                self._component_stats['warnings'] += 1
    
    def safe_execute(self, func, *args, default_return=None, error_prefix="Component"):
        """Execute function with error handling"""
        try:
            self._component_stats['method_calls'] += 1
            return func(*args)
        except Exception as e:
            error_msg = f"{error_prefix} error: {str(e)}"
            self.log_throttled(error_msg, level='error')
            return default_return
    
    def validate_configuration(self) -> Dict[str, bool]:
        """Base validation - override in subclasses"""
        return {
            'initialized': hasattr(self, 'algorithm'),
            'algorithm_valid': self.algorithm is not None,
            'stats_available': bool(self._component_stats)
        }
    
    def get_component_stats(self) -> Dict[str, Any]:
        """Get component statistics"""
        stats = self._component_stats.copy()
        stats['uptime_minutes'] = (datetime.now() - stats['initialized_at']).total_seconds() / 60
        stats['error_rate'] = stats['errors'] / max(stats['method_calls'], 1)
        return stats
    
    def get_portfolio_value(self) -> float:
        """Get current portfolio value"""
        return float(self.algorithm.Portfolio.TotalPortfolioValue)
    
    def get_cash_available(self) -> float:
        """Get available cash"""
        return float(self.algorithm.Portfolio.Cash)
    
    def get_buying_power(self) -> float:
        """Get available buying power"""
        return float(self.algorithm.Portfolio.TotalMarginUsed)
    
    def is_market_open(self) -> bool:
        """Check if market is currently open"""
        return self.algorithm.Securities["SPY"].Exchange.ExchangeOpen
    
    def get_current_time(self) -> datetime:
        """Get current algorithm time"""
        return self.algorithm.Time
    
    def get_business_day_between(self, start_date: datetime, end_date: datetime) -> int:
        """Calculate business days between dates"""
        # Simple implementation - can be enhanced
        delta = end_date - start_date
        return max(int(delta.days * 5/7), 1)  # Rough business day approximation
    
    # COMMON VALIDATION PATTERNS
    
    def validate_symbol_data(self, symbol: str) -> bool:
        """Validate symbol has data"""
        if symbol not in self.algorithm.Securities:
            return False
        security = self.algorithm.Securities[symbol]
        return security.HasData and security.Price > 0
    
    def validate_market_conditions(self) -> Dict[str, bool]:
        """Validate basic market conditions"""
        return {
            'market_open': self.is_market_open(),
            'spy_data_available': self.validate_symbol_data("SPY"),
            'portfolio_initialized': self.get_portfolio_value() > 0,
            'cash_available': self.get_cash_available() > 1000
        }
    
    # CLEANUP AND MAINTENANCE
    
    def cleanup_old_data(self, days_to_keep: int = 30):
        """Clean up old data - override in subclasses"""
        # Base implementation does nothing - subclasses should override
        return
    
    def __str__(self):
        """String representation of component"""
        return f"{self.__class__.__name__}(phase={self.get_account_phase()}, uptime={self.get_component_stats()['uptime_minutes']:.1f}min)"
    
    def __repr__(self):
        return self.__str__()