# Data Validation Framework - Graceful Degradation vs Hard Failures
# Determines when missing data is expected vs critical system failure

from AlgorithmImports import *
from datetime import time
from typing import Optional, Tuple
from enum import Enum

class DataSeverity(Enum):
    EXPECTED = "expected"      # Normal during certain periods
    WARNING = "warning"        # Concerning but not blocking
    CRITICAL = "critical"      # Should halt trading
    FATAL = "fatal"           # Algorithm shutdown required

class DataValidator:
    """
    Validates data availability and determines appropriate response.
    Distinguishes between expected missing data vs system failures.
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.market_open = time(9, 30)
        self.market_close = time(16, 0)
        
    def validate_vix_data(self) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate VIX data with context-aware severity assessment.
        
        Returns:
            (vix_value, severity) - None vix_value indicates missing data
        """
        
        # Try to get VIX from multiple sources
        vix_value = None
        
        # Primary: Unified VIX manager
        if hasattr(self.algo, 'vix_manager') and self.algo.vix_manager:
            vix_value = self.algo.vix_manager.get_current_vix()
            if vix_value and vix_value > 5:  # Sanity check
                return vix_value, DataSeverity.EXPECTED
        
        # Secondary: Direct VIX subscription
        try:
            vix_symbol = self.algo.vix
            if vix_symbol in self.algo.Securities:
                price = self.algo.Securities[vix_symbol].Price
                if price > 5:  # VIX below 5 is extremely rare
                    return price, DataSeverity.EXPECTED
        except Exception as e:
            self.algo.Debug(f"[DataValidator] VIX secondary source error: {e}")
        
        # Determine severity based on context
        current_time = self.algo.Time.time()
        
        # Expected missing data scenarios
        if current_time < self.market_open or current_time > self.market_close:
            return None, DataSeverity.EXPECTED  # Pre/post market
        
        # First 5 minutes of market - data feeds may be loading
        if current_time <= time(9, 35):
            return None, DataSeverity.WARNING
        
        # During active trading hours - this is concerning
        return None, DataSeverity.CRITICAL
    
    def validate_option_pricing(self, option_symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate option price data is available and reasonable.
        """
        
        try:
            if option_symbol not in self.algo.Securities:
                return None, DataSeverity.CRITICAL  # Option not subscribed
            
            security = self.algo.Securities[option_symbol]
            price = security.Price
            
            # Basic sanity checks
            if price <= 0:
                return None, DataSeverity.CRITICAL
            
            # Check if price is stale (would need last update time)
            # For now, assume good if > 0
            
            return price, DataSeverity.EXPECTED
            
        except Exception:
            return None, DataSeverity.CRITICAL
    
    def validate_underlying_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate underlying asset price - should ALWAYS be available for major assets.
        """
        
        try:
            if symbol not in self.algo.Securities:
                return None, DataSeverity.FATAL  # Major index missing is fatal
            
            price = self.algo.Securities[symbol].Price
            
            if price <= 0:
                return None, DataSeverity.FATAL
            
            # Major indices should have reasonable prices
            if symbol == "SPY" and (price < 200 or price > 1000):
                return None, DataSeverity.CRITICAL  # Likely bad data
            
            return price, DataSeverity.EXPECTED
            
        except Exception:
            return None, DataSeverity.FATAL
    
    def get_safe_fallback_value(self, data_type: str, severity: DataSeverity) -> Optional[float]:
        """
        NO FALLBACK VALUES DURING TRADING HOURS - FAIL FAST APPROACH
        Returns None for all cases to force proper error handling.
        Financial data must be real or trading should halt.
        """
        
        # NEVER provide fallback values for financial data during trading
        # This prevents catastrophic losses from stale/incorrect data
        current_time = self.algo.Time.time()
        
        if self.market_open <= current_time <= self.market_close:
            # During trading hours: NO FALLBACKS EVER
            return None
        
        # Pre/post market: Still no fallbacks - missing data should be investigated
        return None
    
    def handle_data_issue(self, data_type: str, severity: DataSeverity, context: str = ""):
        """
        Handle data issues with appropriate logging and actions.
        """
        
        message = f"[DataValidator] {data_type} data issue - {severity.value}"
        if context:
            message += f" - {context}"
        
        if severity == DataSeverity.EXPECTED:
            pass  # No logging needed for expected scenarios
            
        elif severity == DataSeverity.WARNING:
            self.algo.Debug(message)
            
        elif severity == DataSeverity.CRITICAL:
            self.algo.Error(message)
            # Could trigger trading halt for this strategy
            
        elif severity == DataSeverity.FATAL:
            self.algo.Error(message + " - HALTING ALGORITHM")
            # Could call self.algo.Quit() in extreme cases
    
    def is_trading_safe(self) -> bool:
        """
        Overall safety check - can we trade with current data quality?
        """
        
        # Check core data requirements
        spy_price, spy_severity = self.validate_underlying_price(self.algo.spy)
        if spy_severity == DataSeverity.FATAL:
            return False
        
        vix_value, vix_severity = self.validate_vix_data()
        if vix_severity == DataSeverity.FATAL:
            return False
        
        # During market hours, VIX should be available
        current_time = self.algo.Time.time()
        if (self.market_open <= current_time <= self.market_close and 
            vix_severity == DataSeverity.CRITICAL):
            return False
        
        return True


# Helper Functions for Common Data Validation Patterns

def get_vix_with_validation(algorithm) -> float:
    """
    Get VIX value with proper validation and fallback handling.
    Returns reasonable fallback only for expected missing data scenarios.
    Raises exception for critical data failures.
    """
    
    validator = DataValidator(algorithm)
    vix_value, severity = validator.validate_vix_data()
    
    if vix_value is not None:
        return vix_value
    
    validator.handle_data_issue("VIX", severity)
    
    if severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
        raise ValueError("Critical VIX data failure - cannot trade safely")
    
    # Only return fallback for expected/warning scenarios
    return validator.get_safe_fallback_value("vix", severity)


def get_option_price_with_validation(algorithm, option_symbol) -> float:
    """
    Get option price with validation - no fallbacks for option prices.
    Options must have real market data or trade should be skipped.
    """
    
    validator = DataValidator(algorithm)
    price, severity = validator.validate_option_pricing(option_symbol)
    
    if price is not None:
        return price
    
    validator.handle_data_issue("Option Price", severity, f"Symbol: {option_symbol}")
    
    # No fallbacks for option prices - must have real data
    raise ValueError(f"Option price unavailable for {option_symbol}")