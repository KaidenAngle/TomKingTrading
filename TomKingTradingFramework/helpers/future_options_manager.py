# Future Options Manager - Robust handling of futures options
# Production-grade system with comprehensive error handling and fallback mechanisms

from AlgorithmImports import *
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum

class FutureOptionStatus(Enum):
    """Status of future option support for underlying futures"""
    SUPPORTED = "supported"
    NOT_SUPPORTED = "not_supported"  
    UNKNOWN = "unknown"
    ERROR = "error"

@dataclass
class FutureOptionInfo:
    """Information about a future option contract"""
    symbol: Symbol
    underlying: Symbol
    status: FutureOptionStatus
    error_message: Optional[str] = None
    last_tested: Optional[datetime] = None
    retry_after: Optional[datetime] = None

class FutureOptionsManager:
    """
    PRODUCTION-GRADE Future Options Manager
    
    Provides robust handling of futures options with:
    - Comprehensive error handling and recovery
    - Intelligent retry mechanisms  
    - Fallback strategies for unsupported contracts
    - Performance optimization with caching
    - Production logging and monitoring
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.is_backtest = not algorithm.LiveMode
        
        # Track future options support status
        self.option_support_status: Dict[str, FutureOptionInfo] = {}
        
        # Known supported/unsupported futures (learning cache)
        self.known_supported: Set[str] = {
            'ES',   # E-mini S&P 500 - definitely supports options
            'NQ',   # E-mini NASDAQ - definitely supports options  
            'YM',   # E-mini Dow - supports options
            'RTY',  # E-mini Russell - supports options
            'CL',   # Crude Oil - supports options
            'GC',   # Gold - supports options
            'SI',   # Silver - supports options
            'ZB',   # Treasury Bond - supports options
            'ZN',   # 10-Year Note - supports options
            'ZF',   # 5-Year Note - supports options
        }
        
        self.known_unsupported: Set[str] = {
            'MES',  # Micro E-mini S&P 500 - typically no options
            'MNQ',  # Micro E-mini NASDAQ - typically no options
            'MYM',  # Micro E-mini Dow - typically no options
            'M2K',  # Micro E-mini Russell - typically no options
            'MCL',  # Micro Crude Oil - typically no options
            'MGC',  # Micro Gold - typically no options
            'SIL',  # Micro Silver - typically no options
        }
        
        # Retry configuration
        self.retry_delays = {
            1: timedelta(minutes=5),   # First retry after 5 minutes
            2: timedelta(minutes=15),  # Second retry after 15 minutes  
            3: timedelta(hours=1),     # Third retry after 1 hour
            4: timedelta(hours=6),     # Final retry after 6 hours
        }
        self.max_retries = 4
        
        # Performance tracking
        self.option_attempts = 0
        self.option_successes = 0
        self.option_failures = 0
        
        # Cache for performance
        self.option_chain_cache: Dict[str, Tuple[datetime, any]] = {}
        self.cache_ttl = timedelta(minutes=5 if self.is_backtest else 1)
        
        if not self.is_backtest:
            self.algo.Debug("[FutureOptions] Production-grade manager initialized")
    
    def add_future_option_safely(self, future_symbol: str, 
                                 option_filter_func: callable = None) -> Optional[FutureOptionInfo]:
        """
        Add future option with comprehensive error handling and fallback
        
        Returns FutureOptionInfo with complete status information
        """
        
        self.option_attempts += 1
        
        # Check if we know this future doesn't support options
        if future_symbol in self.known_unsupported:
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] {future_symbol} known unsupported - skipping")
            
            info = FutureOptionInfo(
                symbol=None,
                underlying=None,
                status=FutureOptionStatus.NOT_SUPPORTED,
                error_message="Known unsupported future type",
                last_tested=self.algo.Time
            )
            self.option_support_status[future_symbol] = info
            return info
        
        # Check if we should retry based on previous failures
        if future_symbol in self.option_support_status:
            existing_info = self.option_support_status[future_symbol]
            
            if (existing_info.retry_after and 
                existing_info.retry_after > self.algo.Time):
                # Still in retry delay period
                return existing_info
        
        # Attempt to add future option with robust error handling
        try:
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] Attempting to add options for {future_symbol}")
            
            # Try to add the future option
            future_option = self.algo.AddFutureOption(future_symbol, Resolution.Minute)
            
            if future_option is None:
                return self._handle_future_option_failure(
                    future_symbol, 
                    "AddFutureOption returned None"
                )
            
            # Set the option filter if provided
            if option_filter_func:
                try:
                    future_option.SetFilter(option_filter_func)
                except Exception as filter_error:
                    if not self.is_backtest:
                        self.algo.Debug(f"[FutureOptions] Filter error for {future_symbol}: {filter_error}")
                    # Continue without filter rather than failing completely
            
            # Success! Update tracking
            self.option_successes += 1
            
            info = FutureOptionInfo(
                symbol=future_option.Symbol,
                underlying=future_option.Symbol.Underlying,
                status=FutureOptionStatus.SUPPORTED,
                last_tested=self.algo.Time
            )
            
            self.option_support_status[future_symbol] = info
            self.known_supported.add(future_symbol)  # Learn for future
            
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] Successfully added options for {future_symbol}")
            
            return info
            
        except Exception as e:
            return self._handle_future_option_failure(future_symbol, str(e))
    
    def _handle_future_option_failure(self, future_symbol: str, error_message: str) -> FutureOptionInfo:
        """Handle future option addition failures with intelligent retry logic"""
        
        self.option_failures += 1
        
        # Determine retry strategy based on error type
        retry_count = self._get_retry_count(future_symbol)
        
        if retry_count >= self.max_retries:
            # Too many retries - mark as permanently unsupported
            if not self.is_backtest:
                self.algo.Error(f"[FutureOptions] {future_symbol} permanently failed after {retry_count} retries: {error_message}")
            
            self.known_unsupported.add(future_symbol)
            
            info = FutureOptionInfo(
                symbol=None,
                underlying=None, 
                status=FutureOptionStatus.NOT_SUPPORTED,
                error_message=f"Failed after {retry_count} retries: {error_message}",
                last_tested=self.algo.Time
            )
        else:
            # Schedule retry
            retry_delay = self.retry_delays.get(retry_count + 1, timedelta(hours=6))
            retry_time = self.algo.Time + retry_delay
            
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] {future_symbol} failed (attempt {retry_count + 1}): {error_message}. Retry in {retry_delay}")
            
            info = FutureOptionInfo(
                symbol=None,
                underlying=None,
                status=FutureOptionStatus.ERROR,
                error_message=error_message,
                last_tested=self.algo.Time,
                retry_after=retry_time
            )
        
        self.option_support_status[future_symbol] = info
        return info
    
    def _get_retry_count(self, future_symbol: str) -> int:
        """Get current retry count for a future symbol"""
        if future_symbol not in self.option_support_status:
            return 0
        
        existing_info = self.option_support_status[future_symbol]
        if existing_info.status != FutureOptionStatus.ERROR:
            return 0
        
        # Count error entries in our history (simplified - in production might want more detailed tracking)
        return 1  # Simple implementation - could be enhanced with detailed retry history
    
    def get_option_chain_safely(self, future_symbol: str) -> Optional[OptionChain]:
        """
        Get option chain with caching and error handling
        """
        
        # Check cache first
        cache_key = f"chain_{future_symbol}"
        if cache_key in self.option_chain_cache:
            cache_time, cached_chain = self.option_chain_cache[cache_key]
            if self.algo.Time - cache_time < self.cache_ttl:
                return cached_chain
        
        # Check if this future supports options
        if future_symbol not in self.option_support_status:
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] No option info for {future_symbol}")
            return None
        
        info = self.option_support_status[future_symbol]
        if info.status != FutureOptionStatus.SUPPORTED:
            return None
        
        # Try to get option chain
        try:
            if info.symbol in self.algo.CurrentSlice.OptionChains:
                option_chain = self.algo.CurrentSlice.OptionChains[info.symbol]
                
                # Cache the result
                self.option_chain_cache[cache_key] = (self.algo.Time, option_chain)
                
                return option_chain
            else:
                return None
                
        except Exception as e:
            if not self.is_backtest:
                self.algo.Debug(f"[FutureOptions] Error getting option chain for {future_symbol}: {e}")
            return None
    
    def get_supported_future_options(self) -> List[str]:
        """Get list of futures that successfully support options"""
        return [
            symbol for symbol, info in self.option_support_status.items()
            if info.status == FutureOptionStatus.SUPPORTED
        ]
    
    def get_failed_future_options(self) -> List[str]:
        """Get list of futures that failed to support options"""
        return [
            symbol for symbol, info in self.option_support_status.items() 
            if info.status in [FutureOptionStatus.NOT_SUPPORTED, FutureOptionStatus.ERROR]
        ]
    
    def get_performance_stats(self) -> Dict:
        """Get performance and reliability statistics"""
        return {
            'attempts': self.option_attempts,
            'successes': self.option_successes,
            'failures': self.option_failures,
            'success_rate': (self.option_successes / self.option_attempts * 100) if self.option_attempts > 0 else 0,
            'supported_count': len(self.get_supported_future_options()),
            'failed_count': len(self.get_failed_future_options()),
            'cache_entries': len(self.option_chain_cache),
            'known_supported': len(self.known_supported),
            'known_unsupported': len(self.known_unsupported)
        }
    
    def log_status_report(self):
        """Log comprehensive status report"""
        stats = self.get_performance_stats()
        
        if not self.is_backtest:
            self.algo.Debug(f"[FutureOptions] Status Report:")
            self.algo.Debug(f"  Attempts: {stats['attempts']}, Success Rate: {stats['success_rate']:.1f}%") 
            self.algo.Debug(f"  Supported: {stats['supported_count']}, Failed: {stats['failed_count']}")
            self.algo.Debug(f"  Cache Entries: {stats['cache_entries']}")
            
            if self.get_supported_future_options():
                self.algo.Debug(f"  Supported Futures: {', '.join(self.get_supported_future_options())}")
            
            if self.get_failed_future_options():
                self.algo.Debug(f"  Failed Futures: {', '.join(self.get_failed_future_options())}")
    
    def cleanup_cache(self):
        """Clean up expired cache entries to prevent memory leaks"""
        current_time = self.algo.Time
        expired_keys = []
        
        for key, (cache_time, _) in self.option_chain_cache.items():
            if current_time - cache_time > self.cache_ttl * 2:  # Keep cache 2x longer than TTL for safety
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.option_chain_cache[key]
        
        if expired_keys and not self.is_backtest:
            self.algo.Debug(f"[FutureOptions] Cleaned up {len(expired_keys)} expired cache entries")