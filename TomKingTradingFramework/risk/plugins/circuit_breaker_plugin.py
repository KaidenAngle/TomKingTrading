# Circuit Breaker Risk Management Plugin
# Migrated from CircuitBreaker standalone component
# Preserves ALL August 5, 2024 safety protections

from AlgorithmImports import *
from typing import Dict, List, Optional, Any
from risk.unified_risk_manager import BaseRiskPlugin, RiskEvent, RiskEventType, RiskLevel
from datetime import datetime, timedelta

class CircuitBreakerPlugin(BaseRiskPlugin):
    """
    Circuit breaker risk management plugin preventing catastrophic losses.
    Migrated from standalone CircuitBreaker component.
    CRITICAL: Preserves all safety logic from August 5, 2024 disaster lessons.
    """
    
    @property
    def plugin_name(self) -> str:
        return "CircuitBreakerPlugin"
    
    @property
    def plugin_version(self) -> str:
        return "2.0.0"
    
    def _plugin_initialize(self) -> bool:
        """Initialize circuit breaker with August 5 disaster parameters"""
        try:
            # Loss limits (percentages of account - NEVER CHANGE)
            self.daily_loss_limit = 0.05    # 5% max daily loss
            self.weekly_loss_limit = 0.10   # 10% max weekly loss
            self.monthly_loss_limit = 0.15  # 15% max monthly loss
            
            # Intraday drawdown limit (flash crash protection)
            self.intraday_drawdown_limit = 0.03  # 3% intraday drawdown
            
            # Consecutive loss tracking
            self.consecutive_losses = 0
            self.max_consecutive_losses = 3  # Statistical anomaly at 65% win rate
            
            # Trading control flags
            self.trading_enabled = True
            self.circuit_breaker_triggered = False
            self.trigger_reason = ""
            self.trigger_time = None
            
            # Portfolio tracking
            self.daily_start_value = self._algorithm.Portfolio.TotalPortfolioValue
            self.weekly_start_value = self._algorithm.Portfolio.TotalPortfolioValue
            self.monthly_start_value = self._algorithm.Portfolio.TotalPortfolioValue
            self.intraday_high = self._algorithm.Portfolio.TotalPortfolioValue
            
            # Trade tracking
            self.trades_today = 0
            self.losses_today = 0
            self.daily_pnl = 0.0
            
            # Recovery requirements
            self.recovery_period_hours = 24  # Must wait 24 hours
            self.recovery_threshold = 0.02   # Must recover 2% before re-enabling
            
            # Performance tracking
            self.circuit_checks = 0
            self.emergency_triggers = 0
            self.false_alarms = 0
            
            # Cache for performance
            self.last_portfolio_value = self._algorithm.Portfolio.TotalPortfolioValue
            self.last_value_update = self._algorithm.Time
            
            self._algorithm.Log("[Circuit Breaker Plugin] Initialized with August 5 protection parameters")
            
            return True
            
        except Exception as e:
            self._algorithm.Error(f"[Circuit Breaker Plugin] Initialization error: {e}")
            return False
    
    def can_open_position(self, symbol: str, quantity: int, 
                         context: Dict[str, Any] = None) -> tuple[bool, str]:
        """Check if trading is allowed by circuit breaker"""
        def _check():
            self.circuit_checks += 1
            
            if not self.trading_enabled:
                # Check if recovery conditions met
                if self._check_recovery_conditions():
                    self._reset_circuit_breaker("Recovery conditions met")
                else:
                    return False, f"Circuit breaker active: {self.trigger_reason}"
            
            # Update portfolio tracking
            self._update_portfolio_tracking()
            
            # Perform all circuit breaker checks
            breach = self._check_all_limits()
            if breach:
                self._trigger_circuit_breaker(breach)
                return False, f"Circuit breaker triggered: {breach}"
            
            return True, "Circuit breaker check passed"
        
        return self._safe_execute("can_open_position", _check)
    
    def on_position_opened(self, symbol: str, quantity: int, 
                          fill_price: float, context: Dict[str, Any] = None):
        """Track new trade for loss statistics"""
        def _track_trade():
            self.trades_today += 1
            self._algorithm.Debug(f"[Circuit Breaker Plugin] Trade #{self.trades_today} opened: {symbol}")
        
        self._safe_execute("on_position_opened", _track_trade)
    
    def on_position_closed(self, symbol: str, quantity: int, 
                          fill_price: float, pnl: float, context: Dict[str, Any] = None):
        """Track trade results for consecutive loss analysis"""
        def _track_result():
            is_win = pnl > 0
            
            if is_win:
                self.consecutive_losses = 0
                self._algorithm.Debug(f"[Circuit Breaker Plugin] Win recorded, consecutive losses reset")
            else:
                self.consecutive_losses += 1
                self.losses_today += 1
                self._algorithm.Debug(
                    f"[Circuit Breaker Plugin] Loss #{self.consecutive_losses} recorded (${pnl:.2f})"
                )
            
            self.daily_pnl += pnl
        
        self._safe_execute("on_position_closed", _track_result)
    
    def on_market_data(self, symbol: str, data: Any):
        """Update portfolio high watermark for drawdown calculation"""
        def _update_tracking():
            # Update intraday high if portfolio increased
            current_value = self._algorithm.Portfolio.TotalPortfolioValue
            
            if current_value > self.intraday_high:
                self.intraday_high = current_value
                self.last_portfolio_value = current_value
                self.last_value_update = self._algorithm.Time
        
        self._safe_execute("on_market_data", _update_tracking)
    
    def periodic_check(self) -> List[RiskEvent]:
        """Perform periodic circuit breaker checks"""
        def _periodic_check():
            events = []
            
            # Update portfolio tracking
            self._update_portfolio_tracking()
            
            # Check all circuit breaker conditions
            if self.trading_enabled:
                breach = self._check_all_limits()
                if breach:
                    self._trigger_circuit_breaker(breach)
                    
                    events.append(RiskEvent(
                        RiskEventType.CIRCUIT_BREAKER_TRIGGERED,
                        RiskLevel.EMERGENCY,
                        f"Circuit breaker triggered: {breach}",
                        {
                            'trigger_reason': breach,
                            'portfolio_value': self._algorithm.Portfolio.TotalPortfolioValue,
                            'daily_pnl': self.daily_pnl,
                            'consecutive_losses': self.consecutive_losses,
                            'trades_today': self.trades_today
                        }
                    ))
            else:
                # Check if recovery possible
                if self._check_recovery_conditions():
                    events.append(RiskEvent(
                        RiskEventType.RECOVERY_CONDITIONS_MET,
                        RiskLevel.INFO,
                        "Circuit breaker recovery conditions met",
                        {
                            'hours_since_trigger': self._hours_since_trigger(),
                            'recovery_threshold_met': True
                        }
                    ))
            
            # Daily reset if needed
            self._check_daily_reset()
            
            return events
        
        return self._safe_execute("periodic_check", _periodic_check) or []
    
    def get_risk_metrics(self) -> Dict[str, Any]:
        """Get circuit breaker metrics"""
        def _get_metrics():
            current_value = self._algorithm.Portfolio.TotalPortfolioValue
            
            return {
                'trading_enabled': self.trading_enabled,
                'circuit_breaker_triggered': self.circuit_breaker_triggered,
                'trigger_reason': self.trigger_reason,
                'risk_score': self._calculate_risk_score(),
                
                # Loss tracking
                'daily_pnl_pct': (current_value - self.daily_start_value) / max(self.daily_start_value, 1),
                'weekly_pnl_pct': (current_value - self.weekly_start_value) / max(self.weekly_start_value, 1),
                'monthly_pnl_pct': (current_value - self.monthly_start_value) / max(self.monthly_start_value, 1),
                'intraday_drawdown_pct': (self.intraday_high - current_value) / max(self.intraday_high, 1),
                
                # Trade statistics
                'consecutive_losses': self.consecutive_losses,
                'trades_today': self.trades_today,
                'losses_today': self.losses_today,
                'loss_rate_today': self.losses_today / max(self.trades_today, 1),
                
                # Limits
                'daily_limit': self.daily_loss_limit,
                'weekly_limit': self.weekly_loss_limit,
                'monthly_limit': self.monthly_loss_limit,
                'drawdown_limit': self.intraday_drawdown_limit,
                'consecutive_loss_limit': self.max_consecutive_losses,
                
                # Performance
                'circuit_checks': self.circuit_checks,
                'emergency_triggers': self.emergency_triggers,
                'false_alarms': self.false_alarms,
                
                # Recovery
                'recovery_period_hours': self.recovery_period_hours,
                'hours_since_trigger': self._hours_since_trigger() if self.trigger_time else 0
            }
        
        return self._safe_execute("get_risk_metrics", _get_metrics) or {}
    
    def _check_all_limits(self) -> Optional[str]:
        """Check all circuit breaker limits, return breach reason if any"""
        current_value = self._algorithm.Portfolio.TotalPortfolioValue
        
        # Daily loss limit
        daily_pnl = (current_value - self.daily_start_value) / self.daily_start_value
        if daily_pnl < -self.daily_loss_limit:
            return f"Daily loss limit exceeded: {daily_pnl:.2%} < {-self.daily_loss_limit:.2%}"
        
        # Weekly loss limit
        weekly_pnl = (current_value - self.weekly_start_value) / self.weekly_start_value
        if weekly_pnl < -self.weekly_loss_limit:
            return f"Weekly loss limit exceeded: {weekly_pnl:.2%} < {-self.weekly_loss_limit:.2%}"
        
        # Monthly loss limit
        monthly_pnl = (current_value - self.monthly_start_value) / self.monthly_start_value
        if monthly_pnl < -self.monthly_loss_limit:
            return f"Monthly loss limit exceeded: {monthly_pnl:.2%} < {-self.monthly_loss_limit:.2%}"
        
        # Intraday drawdown (flash crash protection)
        intraday_drawdown = (self.intraday_high - current_value) / self.intraday_high
        if intraday_drawdown > self.intraday_drawdown_limit:
            return f"Intraday drawdown limit exceeded: {intraday_drawdown:.2%} > {self.intraday_drawdown_limit:.2%}"
        
        # Consecutive losses
        if self.consecutive_losses >= self.max_consecutive_losses:
            return f"Consecutive loss limit exceeded: {self.consecutive_losses} >= {self.max_consecutive_losses}"
        
        # High loss rate (multiple losses in one day)
        if self.trades_today > 0:
            loss_rate = self.losses_today / self.trades_today
            if loss_rate > 0.5 and self.losses_today >= 3:
                return f"High loss rate: {loss_rate:.1%} ({self.losses_today}/{self.trades_today} losses)"
        
        return None
    
    def _trigger_circuit_breaker(self, reason: str):
        """Trigger circuit breaker emergency stop"""
        self.trading_enabled = False
        self.circuit_breaker_triggered = True
        self.trigger_reason = reason
        self.trigger_time = self._algorithm.Time
        self.emergency_triggers += 1
        
        self._algorithm.Error(f"[Circuit Breaker Plugin] EMERGENCY TRIGGERED: {reason}")
        self._algorithm.Error(f"   Portfolio Value: ${self._algorithm.Portfolio.TotalPortfolioValue:,.2f}")
        self._algorithm.Error(f"   All trading SUSPENDED at {self._algorithm.Time}")
        
        # Emit emergency event
        self._emit_event(
            RiskEventType.CIRCUIT_BREAKER_TRIGGERED,
            RiskLevel.EMERGENCY,
            f"Circuit breaker emergency: {reason}",
            {
                'trigger_reason': reason,
                'portfolio_value': self._algorithm.Portfolio.TotalPortfolioValue,
                'trigger_time': self._algorithm.Time.isoformat()
            }
        )
    
    def _check_recovery_conditions(self) -> bool:
        """Check if conditions met to re-enable trading"""
        if not self.circuit_breaker_triggered:
            return True
        
        # Check time elapsed since trigger
        if self._hours_since_trigger() < self.recovery_period_hours:
            return False
        
        # Check portfolio recovery
        current_value = self._algorithm.Portfolio.TotalPortfolioValue
        recovery_from_daily_start = (current_value - self.daily_start_value) / self.daily_start_value
        
        if recovery_from_daily_start >= -self.recovery_threshold:
            return True
        
        return False
    
    def _reset_circuit_breaker(self, reason: str):
        """Reset circuit breaker after recovery"""
        self.trading_enabled = True
        self.circuit_breaker_triggered = False
        old_reason = self.trigger_reason
        self.trigger_reason = ""
        self.trigger_time = None
        self.consecutive_losses = 0  # Reset consecutive losses
        
        self._algorithm.Log(f"[Circuit Breaker Plugin] RESET: {reason}")
        self._algorithm.Log(f"   Previous trigger: {old_reason}")
        self._algorithm.Log(f"   Trading re-enabled at {self._algorithm.Time}")
        
        # Emit recovery event
        self._emit_event(
            RiskEventType.RECOVERY_CONDITIONS_MET,
            RiskLevel.INFO,
            f"Circuit breaker reset: {reason}",
            {
                'reset_reason': reason,
                'previous_trigger': old_reason,
                'recovery_time': self._algorithm.Time.isoformat()
            }
        )
    
    def _update_portfolio_tracking(self):
        """Update portfolio value tracking"""
        current_value = self._algorithm.Portfolio.TotalPortfolioValue
        
        # Update intraday high
        if current_value > self.intraday_high:
            self.intraday_high = current_value
        
        # Cache for performance
        self.last_portfolio_value = current_value
        self.last_value_update = self._algorithm.Time
    
    def _check_daily_reset(self):
        """Check if daily reset is needed"""
        current_date = self._algorithm.Time.date()
        
        # Reset daily tracking if new day
        if not hasattr(self, '_last_reset_date') or self._last_reset_date != current_date:
            self._reset_daily_tracking()
            self._last_reset_date = current_date
    
    def _reset_daily_tracking(self):
        """Reset daily tracking at market open"""
        self.daily_start_value = self._algorithm.Portfolio.TotalPortfolioValue
        self.intraday_high = self._algorithm.Portfolio.TotalPortfolioValue
        self.trades_today = 0
        self.losses_today = 0
        self.daily_pnl = 0.0
        
        # Reset weekly on Monday
        if self._algorithm.Time.weekday() == 0:
            self.weekly_start_value = self._algorithm.Portfolio.TotalPortfolioValue
        
        # Reset monthly on first trading day
        if self._algorithm.Time.day <= 3:
            self.monthly_start_value = self._algorithm.Portfolio.TotalPortfolioValue
        
        self._algorithm.Debug("[Circuit Breaker Plugin] Daily tracking reset")
    
    def _calculate_risk_score(self) -> float:
        """Calculate overall risk score (0-100) for circuit breaker"""
        current_value = self._algorithm.Portfolio.TotalPortfolioValue
        
        scores = []
        
        # Daily loss score
        daily_pnl = (current_value - self.daily_start_value) / self.daily_start_value
        daily_score = abs(daily_pnl) / self.daily_loss_limit * 100
        scores.append(min(100, daily_score))
        
        # Intraday drawdown score
        drawdown = (self.intraday_high - current_value) / max(self.intraday_high, 1)
        drawdown_score = drawdown / self.intraday_drawdown_limit * 100
        scores.append(min(100, drawdown_score))
        
        # Consecutive loss score
        loss_score = (self.consecutive_losses / self.max_consecutive_losses) * 100
        scores.append(min(100, loss_score))
        
        # Loss rate score
        if self.trades_today > 0:
            loss_rate = self.losses_today / self.trades_today
            rate_score = loss_rate * 100
            scores.append(min(100, rate_score))
        
        return max(scores) if scores else 0.0
    
    def _hours_since_trigger(self) -> float:
        """Get hours since circuit breaker was triggered"""
        if not self.trigger_time:
            return 0.0
        
        return (self._algorithm.Time - self.trigger_time).total_seconds() / 3600.0
    
    def shutdown(self):
        """Clean shutdown of circuit breaker plugin"""
        status = "ACTIVE" if self.circuit_breaker_triggered else "OK"
        
        self._algorithm.Log(
            f"[Circuit Breaker Plugin] Shutdown: Status {status}, "
            f"{self.circuit_checks} checks, {self.emergency_triggers} triggers, "
            f"{self.consecutive_losses} consecutive losses"
        )