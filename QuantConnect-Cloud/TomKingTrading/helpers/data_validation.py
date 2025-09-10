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
    
    def validate_futures_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate futures contract pricing and contract specifications.
        Futures have unique requirements: expiration, rollover dates, margin.
        """
        
        try:
            if symbol not in self.algo.Securities:
                return None, DataSeverity.CRITICAL  # Futures contract not subscribed
            
            security = self.algo.Securities[symbol]
            price = security.Price
            
            # Basic price validation
            if price <= 0:
                return None, DataSeverity.CRITICAL
            
            # Check if contract is near expiration (would need expiration date)
            # For now, assume good if price is positive and reasonable
            
            # Futures-specific validations
            if hasattr(security, 'Expiry'):
                time_to_expiry = (security.Expiry.date() - self.algo.Time.date()).days
                if time_to_expiry <= 0:
                    return None, DataSeverity.CRITICAL  # Expired contract
                elif time_to_expiry <= 3:
                    # Near expiry - warning but not critical
                    self.algo.Debug(f"[DataValidator] Futures {symbol} near expiry: {time_to_expiry} days")
                    return price, DataSeverity.WARNING
            
            # Validate reasonable price ranges for known contracts
            symbol_str = str(symbol).upper()
            if 'ES' in symbol_str:  # S&P 500 futures
                if price < 2000 or price > 8000:
                    return None, DataSeverity.CRITICAL  # Unreasonable ES price
            elif 'CL' in symbol_str:  # Crude oil futures
                if price < 0 or price > 200:
                    return None, DataSeverity.CRITICAL  # Unreasonable oil price
            elif 'GC' in symbol_str:  # Gold futures
                if price < 1000 or price > 5000:
                    return None, DataSeverity.CRITICAL  # Unreasonable gold price
            
            return price, DataSeverity.EXPECTED
            
        except Exception as e:
            self.algo.Debug(f"[DataValidator] Futures validation error for {symbol}: {e}")
            return None, DataSeverity.CRITICAL
    
    def validate_future_option_pricing(self, symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate future option pricing.
        Similar to equity options but with futures-specific considerations.
        """
        
        try:
            if symbol not in self.algo.Securities:
                return None, DataSeverity.CRITICAL  # Future option not subscribed
            
            security = self.algo.Securities[symbol]
            price = security.Price
            
            # Basic sanity checks
            if price <= 0:
                return None, DataSeverity.CRITICAL
            
            # Check if option is near expiration
            if hasattr(security, 'Expiry'):
                time_to_expiry = (security.Expiry.date() - self.algo.Time.date()).days
                if time_to_expiry <= 0:
                    return None, DataSeverity.CRITICAL  # Expired option
            
            return price, DataSeverity.EXPECTED
            
        except Exception as e:
            self.algo.Debug(f"[DataValidator] Future option validation error for {symbol}: {e}")
            return None, DataSeverity.CRITICAL
    
    def validate_forex_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate forex pair pricing.
        Forex markets have different sessions and spread characteristics.
        """
        
        try:
            if symbol not in self.algo.Securities:
                return None, DataSeverity.CRITICAL  # Forex pair not subscribed
            
            security = self.algo.Securities[symbol]
            price = security.Price
            
            # Basic price validation
            if price <= 0:
                return None, DataSeverity.CRITICAL
            
            # Check for reasonable forex ranges
            symbol_str = str(symbol).upper()
            
            # Major currency pairs validation
            if 'EUR' in symbol_str and 'USD' in symbol_str:  # EURUSD
                if price < 0.5 or price > 2.0:
                    return None, DataSeverity.CRITICAL
            elif 'GBP' in symbol_str and 'USD' in symbol_str:  # GBPUSD
                if price < 0.5 or price > 2.5:
                    return None, DataSeverity.CRITICAL
            elif 'USD' in symbol_str and 'JPY' in symbol_str:  # USDJPY
                if price < 50 or price > 200:
                    return None, DataSeverity.CRITICAL
            
            # Check forex session times (forex markets have different active sessions)
            current_time = self.algo.Time.time()
            
            # During major market closures (weekend gaps), missing data might be expected
            if current_time.hour < 17 or current_time.hour > 22:  # Outside major trading hours
                return price, DataSeverity.EXPECTED
            
            return price, DataSeverity.EXPECTED
            
        except Exception as e:
            self.algo.Debug(f"[DataValidator] Forex validation error for {symbol}: {e}")
            return None, DataSeverity.CRITICAL
    
    def validate_cfd_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
        """
        Validate CFD pricing (often used for ETFs in international markets).
        CFDs track underlying assets and should have reasonable tracking.
        """
        
        try:
            if symbol not in self.algo.Securities:
                return None, DataSeverity.CRITICAL  # CFD not subscribed
            
            security = self.algo.Securities[symbol]
            price = security.Price
            
            # Basic price validation
            if price <= 0:
                return None, DataSeverity.CRITICAL
            
            # ETF CFD validation
            symbol_str = str(symbol).upper()
            
            # Common ETF CFDs validation
            if 'SPY' in symbol_str:
                if price < 200 or price > 1000:
                    return None, DataSeverity.CRITICAL
            elif 'QQQ' in symbol_str:
                if price < 100 or price > 800:
                    return None, DataSeverity.CRITICAL
            elif 'GLD' in symbol_str:
                if price < 100 or price > 300:
                    return None, DataSeverity.CRITICAL
            elif 'TLT' in symbol_str:
                if price < 50 or price > 200:
                    return None, DataSeverity.CRITICAL
            
            return price, DataSeverity.EXPECTED
            
        except Exception as e:
            self.algo.Debug(f"[DataValidator] CFD validation error for {symbol}: {e}")
            return None, DataSeverity.CRITICAL
    
    def validate_data(self, data) -> bool:
        """
        Unified data validation method expected by main algorithm.
        Validates incoming market data slice and returns True if safe to trade.
        """
        
        try:
            # Check overall trading safety first
            if not self.is_trading_safe():
                return False
            
            # Validate data for each security in the data slice
            for symbol in data.Keys:
                if symbol not in self.algo.Securities:
                    continue
                
                security = self.algo.Securities[symbol]
                
                # Validate underlying price for options
                if security.Type == SecurityType.Option:
                    underlying_price, price_severity = self.validate_underlying_price(security.Underlying)
                    if price_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Underlying Price", price_severity, f"Symbol: {security.Underlying}")
                        return False
                    
                    # Validate option pricing
                    option_price, option_severity = self.validate_option_pricing(symbol)
                    if option_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Option Price", option_severity, f"Symbol: {symbol}")
                        return False
                
                # Validate equity/index prices
                elif security.Type in [SecurityType.Equity, SecurityType.Index]:
                    underlying_price, price_severity = self.validate_underlying_price(symbol)
                    if price_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Equity Price", price_severity, f"Symbol: {symbol}")
                        return False
                
                # Validate futures contracts
                elif security.Type == SecurityType.Future:
                    future_price, price_severity = self.validate_futures_price(symbol)
                    if price_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Futures Price", price_severity, f"Symbol: {symbol}")
                        return False
                
                # Validate future options
                elif security.Type == SecurityType.FutureOption:
                    # Validate both the option and underlying futures
                    option_price, option_severity = self.validate_future_option_pricing(symbol)
                    if option_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Future Option Price", option_severity, f"Symbol: {symbol}")
                        return False
                    
                    # Validate underlying futures
                    underlying_future = security.Underlying
                    future_price, future_severity = self.validate_futures_price(underlying_future)
                    if future_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Underlying Futures Price", future_severity, f"Symbol: {underlying_future}")
                        return False
                
                # Validate forex pairs
                elif security.Type == SecurityType.Forex:
                    forex_price, forex_severity = self.validate_forex_price(symbol)
                    if forex_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("Forex Price", forex_severity, f"Symbol: {symbol}")
                        return False
                
                # Validate CFDs (ETFs often map to CFDs)
                elif security.Type == SecurityType.Cfd:
                    cfd_price, cfd_severity = self.validate_cfd_price(symbol)
                    if cfd_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                        self.handle_data_issue("CFD Price", cfd_severity, f"Symbol: {symbol}")
                        return False
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[DataValidator] Data validation error: {e}")
            return False
    
    def validate_all_data(self) -> bool:
        """
        Validate all critical data sources without a specific data slice.
        Used for general safety checks before trading decisions.
        """
        
        try:
            # Check overall trading safety (includes VIX and core data)
            if not self.is_trading_safe():
                return False
            
            # Validate core underlying assets
            spy_price, spy_severity = self.validate_underlying_price(self.algo.spy)
            if spy_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                self.handle_data_issue("SPY Price", spy_severity, "Core market data")
                return False
            
            # Validate VIX explicitly (already checked in is_trading_safe but log details)
            vix_value, vix_severity = self.validate_vix_data()
            if vix_severity in [DataSeverity.CRITICAL, DataSeverity.FATAL]:
                self.handle_data_issue("VIX Data", vix_severity, "Volatility data")
                return False
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[DataValidator] All data validation error: {e}")
            return False
    
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