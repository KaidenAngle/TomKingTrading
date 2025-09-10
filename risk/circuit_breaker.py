# Circuit Breaker - Critical Safety Component
# Prevents catastrophic losses by stopping trading after limits hit

from AlgorithmImports import *
from datetime import datetime, timedelta

class CircuitBreaker:
    """
    Circuit breaker system to prevent excessive losses
    CRITICAL: Must be active before any live trading
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
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
        Main circuit breaker check - call before any trade
        Returns: True if trading allowed, False if circuit breaker triggered
        """
        if not self.trading_enabled:
            # Check if recovery conditions met
            if self.check_recovery_conditions():
                self.reset_circuit_breaker()
            else:
                return False
        
        current_value = self.algorithm.Portfolio.TotalPortfolioValue
        
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