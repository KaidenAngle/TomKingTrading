# Circuit Breaker - Critical Safety Component
# Prevents catastrophic losses by stopping trading after limits hit

from AlgorithmImports import *
from datetime import datetime, timedelta
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType

class CircuitBreaker:
    """
    Circuit breaker system to prevent excessive losses
    CRITICAL: Must be active before any live trading
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # UNIFIED INTELLIGENT CACHE: Portfolio value calculations caching
        # Uses GENERAL cache type for basic calculations
        # Circuit breaker checks use position-aware invalidation
        self.portfolio_cache = algorithm.unified_cache
        self.check_cache = algorithm.unified_cache
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=15 if algorithm.LiveMode else 30)
        self.last_cache_stats_log = algorithm.Time
        
        # Daily loss limits (percentage of account)
        self.daily_loss_limit = 0.05  # 5% max daily loss
        self.weekly_loss_limit = 0.10  # 10% max weekly loss
        self.monthly_loss_limit = 0.15  # 15% max monthly loss
        
        # Consecutive loss tracking
        self.consecutive_losses = 0
        self.max_consecutive_losses = 3
        
        # Intraday drawdown limit
        self.intraday_drawdown_limit = 0.03  # 3% intraday drawdown
        
        # Trading control
        self.trading_enabled = True
        self.circuit_breaker_triggered = False
        self.trigger_reason = ""
        self.trigger_time = None
        
        # Tracking
        self.daily_start_value = algorithm.Portfolio.TotalPortfolioValue
        self.weekly_start_value = algorithm.Portfolio.TotalPortfolioValue
        self.monthly_start_value = algorithm.Portfolio.TotalPortfolioValue
        self.intraday_high = algorithm.Portfolio.TotalPortfolioValue
        
        # Loss tracking
        self.trades_today = 0
        self.losses_today = 0
        self.daily_pnl = 0
        
        # Recovery requirements
        self.recovery_period_hours = 24  # Must wait 24 hours after circuit breaker
        self.recovery_threshold = 0.02  # Must recover 2% before re-enabling
        
        self.algorithm.Log("[WARNING] CIRCUIT BREAKER INITIALIZED")
        self.algorithm.Log(f"   Daily limit: {self.daily_loss_limit:.1%}")
        self.algorithm.Log(f"   Weekly limit: {self.weekly_loss_limit:.1%}")
        self.algorithm.Log(f"   Monthly limit: {self.monthly_loss_limit:.1%}")
    
    def check_circuit_breaker(self) -> bool:
        """
        Main circuit breaker check - call before any trade with caching
        Returns: True if trading allowed, False if circuit breaker triggered
        """
        
        # Run cache maintenance
        self._run_cache_maintenance()
        
        if not self.trading_enabled:
            # Check if recovery conditions met
            if self.check_recovery_conditions():
                self.reset_circuit_breaker()
            else:
                return False
        
        # Create cache key for circuit breaker check
        current_time = self.algorithm.Time
        cache_key = f'circuit_check_{current_time.minute}_{current_time.second//10}'  # 10-second buckets
        
        # Try to get cached result using GENERAL cache type
        cached_result = self.check_cache.get(
            cache_key,
            lambda: self._check_circuit_breaker_internal(),
            cache_type=CacheType.GENERAL
        )
        
        return cached_result if cached_result is not None else False
    
    def _check_circuit_breaker_internal(self) -> bool:
        """Internal circuit breaker check (cached)"""
        
        current_value = self._get_cached_portfolio_value()
        
        # Check daily loss limit
        daily_pnl = (current_value - self.daily_start_value) / self.daily_start_value
        if daily_pnl < -self.daily_loss_limit:
            self.trigger_circuit_breaker(
                f"Daily loss limit exceeded: {daily_pnl:.2%}"
            )
            return False
        
        # Check weekly loss limit
        weekly_pnl = (current_value - self.weekly_start_value) / self.weekly_start_value
        if weekly_pnl < -self.weekly_loss_limit:
            self.trigger_circuit_breaker(
                f"Weekly loss limit exceeded: {weekly_pnl:.2%}"
            )
            return False
        
        # Check monthly loss limit
        monthly_pnl = (current_value - self.monthly_start_value) / self.monthly_start_value
        if monthly_pnl < -self.monthly_loss_limit:
            self.trigger_circuit_breaker(
                f"Monthly loss limit exceeded: {monthly_pnl:.2%}"
            )
            return False
        
        # Check intraday drawdown
        self.intraday_high = max(self.intraday_high, current_value)
        intraday_drawdown = (self.intraday_high - current_value) / self.intraday_high
        if intraday_drawdown > self.intraday_drawdown_limit:
            self.trigger_circuit_breaker(
                f"Intraday drawdown limit exceeded: {intraday_drawdown:.2%}"
            )
            return False
        
        # Check consecutive losses
        if self.consecutive_losses >= self.max_consecutive_losses:
            self.trigger_circuit_breaker(
                f"Consecutive loss limit exceeded: {self.consecutive_losses} losses"
            )
            return False
        
        # Check loss rate (too many losses in one day)
        if self.trades_today > 0:
            loss_rate = self.losses_today / self.trades_today
            if loss_rate > 0.5 and self.losses_today >= 3:  # >50% loss rate with 3+ losses
                self.trigger_circuit_breaker(
                    f"High loss rate: {loss_rate:.1%} ({self.losses_today}/{self.trades_today})"
                )
                return False
        
        return True  # Trading allowed
    
    def _get_cached_portfolio_value(self) -> float:
        """Get portfolio value with caching"""
        cache_key = 'portfolio_value'
        cached_value = self.portfolio_cache.get(
            cache_key,
            lambda: self.algorithm.Portfolio.TotalPortfolioValue,
            cache_type=CacheType.POSITION_AWARE
        )
        
        return cached_value if cached_value else 0.0
    
    def _run_cache_maintenance(self):
        """Run periodic cache maintenance"""
        current_time = self.algorithm.Time
        
        # Run unified cache maintenance (handles all cache types)
        self.portfolio_cache.periodic_maintenance()
        
        # Log cache statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_performance()
            self.last_cache_stats_log = current_time
    
    def _log_cache_performance(self):
        """Log unified circuit breaker cache performance"""
        try:
            unified_stats = self.portfolio_cache.get_statistics()
            
            if not self.algorithm.LiveMode:  # Only detailed logging in backtest
                self.algorithm.Debug(
                    f"[Circuit Cache] Unified Hit Rate: {unified_stats['hit_rate']:.1%} | "
                    f"Size: {unified_stats['cache_size']}/{unified_stats['max_size']} | "
                    f"Memory: {unified_stats['memory_usage_mb']:.1f}MB | "
                    f"Position-Aware: {unified_stats.get('position_aware_entries', 0)} | "
                    f"General: {unified_stats.get('general_entries', 0)}"
                )
            
        except Exception as e:
            self.algorithm.Debug(f"[Circuit Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> dict:
        """Get unified circuit breaker cache statistics"""
        try:
            unified_stats = self.portfolio_cache.get_statistics()
            return {
                'unified_cache': unified_stats,
                'circuit_breaker_specific': {
                    'position_aware_entries': unified_stats.get('position_aware_entries', 0),
                    'general_entries': unified_stats.get('general_entries', 0)
                },
                'total_memory_mb': unified_stats['memory_usage_mb']
            }
        except Exception as e:
            self.algorithm.Error(f"[Circuit Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_circuit_cache(self, reason: str = "manual"):
        """Manually invalidate circuit breaker caches"""
        try:
            # Invalidate position-aware and general cache types used by circuit breaker
            pos_count = self.portfolio_cache.invalidate_by_cache_type(CacheType.POSITION_AWARE)
            general_count = self.portfolio_cache.invalidate_by_cache_type(CacheType.GENERAL)
            
            self.algorithm.Debug(
                f"[Circuit Cache] Invalidated {pos_count} position-aware + {general_count} general calculations. Reason: {reason}"
            )
        except Exception as e:
            self.algorithm.Error(f"[Circuit Cache] Error invalidating cache: {e}")
    
    def trigger_circuit_breaker(self, reason: str):
        """Trigger the circuit breaker and stop all trading"""
        self.trading_enabled = False
        self.circuit_breaker_triggered = True
        self.trigger_reason = reason
        self.trigger_time = self.algorithm.Time
        
        # Log critical alert
        self.algorithm.Error(f"[WARNING] CIRCUIT BREAKER TRIGGERED: {reason}")
        self.algorithm.Error(f"   Trading STOPPED at {self.algorithm.Time}")
        self.algorithm.Error(f"   Account value: ${self.algorithm.Portfolio.TotalPortfolioValue:,.2f}")
        
        # Cancel all pending orders
        self.cancel_all_orders()
        
        # Close all risky positions
        self.close_risky_positions()
        
        # Send alerts (would integrate with alert system)
        self.send_emergency_alert(reason)
    
    def cancel_all_orders(self):
        """Cancel all pending orders immediately"""
        open_orders = self.algorithm.Transactions.GetOpenOrders()
        for order in open_orders:
            self.algorithm.Transactions.CancelOrder(order.Id)
            self.algorithm.Log(f"   Cancelled order: {order.Id}")
    
    def close_risky_positions(self):
        """Close positions that could cause further losses"""
        for symbol, holding in self.algorithm.Portfolio.items():
            if holding.Invested:
                # Close all short options (unlimited risk)
                if holding.Type == SecurityType.Option and holding.IsShort:
                    self.algorithm.Liquidate(symbol, "CIRCUIT_BREAKER_RISK")
                    self.algorithm.Log(f"   Closed risky position: {symbol}")
    
    def check_recovery_conditions(self) -> bool:
        """Check if recovery conditions are met to re-enable trading"""
        if not self.circuit_breaker_triggered:
            return True
        
        # Check time elapsed
        time_elapsed = (self.algorithm.Time - self.trigger_time).total_seconds() / 3600
        if time_elapsed < self.recovery_period_hours:
            return False
        
        # Check recovery threshold
        current_value = self.algorithm.Portfolio.TotalPortfolioValue
        recovery_from_trigger = (current_value - self.daily_start_value) / self.daily_start_value
        
        if recovery_from_trigger >= self.recovery_threshold:
            self.algorithm.Log(f"[WARNING] Circuit breaker recovery conditions met")
            return True
        
        return False
    
    def reset_circuit_breaker(self):
        """Reset circuit breaker after recovery"""
        self.trading_enabled = True
        self.circuit_breaker_triggered = False
        self.consecutive_losses = 0
        self.trigger_reason = ""
        self.trigger_time = None
        
        self.algorithm.Log("[WARNING] CIRCUIT BREAKER RESET - Trading re-enabled")
    
    def record_trade_result(self, is_win: bool, pnl: float):
        """Record trade result for tracking"""
        self.trades_today += 1
        
        if is_win:
            self.consecutive_losses = 0
        else:
            self.consecutive_losses += 1
            self.losses_today += 1
        
        self.daily_pnl += pnl
    
    def reset_daily_tracking(self):
        """Reset daily tracking at market open"""
        self.daily_start_value = self.algorithm.Portfolio.TotalPortfolioValue
        self.intraday_high = self.algorithm.Portfolio.TotalPortfolioValue
        self.trades_today = 0
        self.losses_today = 0
        self.daily_pnl = 0
        
        # Reset weekly on Monday
        if self.algorithm.Time.weekday() == 0:
            self.weekly_start_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        # Reset monthly on first trading day
        if self.algorithm.Time.day <= 3:
            self.monthly_start_value = self.algorithm.Portfolio.TotalPortfolioValue
    
    def get_circuit_breaker_status(self) -> dict:
        """Get current circuit breaker status"""
        current_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        return {
            'enabled': self.trading_enabled,
            'triggered': self.circuit_breaker_triggered,
            'trigger_reason': self.trigger_reason,
            'daily_pnl': (current_value - self.daily_start_value) / self.daily_start_value,
            'weekly_pnl': (current_value - self.weekly_start_value) / self.weekly_start_value,
            'monthly_pnl': (current_value - self.monthly_start_value) / self.monthly_start_value,
            'consecutive_losses': self.consecutive_losses,
            'trades_today': self.trades_today,
            'losses_today': self.losses_today,
            'can_trade': self.check_circuit_breaker()
        }
    
    def send_emergency_alert(self, reason: str):
        """Send emergency alert when circuit breaker triggers"""
        # This would integrate with actual alert system
        alert_message = f"""
        [WARNING] EMERGENCY: CIRCUIT BREAKER TRIGGERED
        
        Reason: {reason}
        Time: {self.algorithm.Time}
        Account Value: ${self.algorithm.Portfolio.TotalPortfolioValue:,.2f}
        Daily P&L: {self.daily_pnl:.2%}
        
        ALL TRADING SUSPENDED
        Manual intervention may be required
        """
        
        # Log for now (would send email/SMS in production)
        self.algorithm.Error(alert_message)