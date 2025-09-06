# region imports
from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional
# endregion

class ManualModeFallback:
    """
    Safety system that switches to manual mode when:
    - API errors exceed threshold
    - Unusual market conditions detected
    - Greeks exceed safety limits
    - System health checks fail
    
    In manual mode: Suggests trades but doesn't execute them
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.is_manual_mode = False
        self.pending_trades = []
        self.error_count = 0
        self.max_errors = 3
        self.last_error_time = None
        self.error_reset_minutes = 30
        
        # Tracking
        self.manual_activations = []
        self.suggested_trades_log = []
        
    def check_automation_health(self) -> bool:
        """Check if we should switch to manual mode"""
        
        # Reset error count if enough time passed
        if self.last_error_time:
            time_since_error = (self.algorithm.Time - self.last_error_time).total_seconds() / 60
            if time_since_error > self.error_reset_minutes:
                self.error_count = 0
                self.algorithm.Debug(f"Error count reset after {time_since_error:.1f} minutes")
        
        # Check error threshold
        if self.error_count >= self.max_errors:
            self.activate_manual_mode(f"Error threshold exceeded: {self.error_count} errors")
            return False
            
        # Check extreme market conditions
        if "VIX" in self.algorithm.Securities:
            vix = self.algorithm.Securities["VIX"].Price
            if vix > 50:  # Extreme VIX
                self.activate_manual_mode(f"Extreme VIX level: {vix:.2f}")
                return False
            elif vix > 40:  # High VIX warning
                self.algorithm.Log(f"[WARNING] High VIX: {vix:.2f} - monitoring closely")
                
        # Check portfolio Greeks limits (if available)
        if hasattr(self.algorithm, 'greeks_monitor'):
            portfolio_delta = self.calculate_portfolio_delta()
            if abs(portfolio_delta) > 100:  # Delta limit exceeded
                self.activate_manual_mode(f"Portfolio delta limit exceeded: {portfolio_delta:.2f}")
                return False
                
        # Check for market circuit breakers
        if self.detect_circuit_breaker():
            self.activate_manual_mode("Market circuit breaker detected")
            return False
            
        # Check system memory/performance
        if not self.check_system_resources():
            self.activate_manual_mode("System resource limits exceeded")
            return False
            
        return True
        
    def activate_manual_mode(self, reason: str):
        """Switch to manual mode - suggest but don't execute"""
        
        if self.is_manual_mode:
            return  # Already in manual mode
            
        self.is_manual_mode = True
        activation_time = self.algorithm.Time
        
        self.algorithm.Log(f"""
        ========================================================
        [CRITICAL] MANUAL MODE ACTIVATED
        ========================================================
        Time: {activation_time}
        Reason: {reason}
        
        ACTIONS TAKEN:
        - All automated trading suspended
        - Pending orders cancelled
        - Trade suggestions will be logged only
        - Manual intervention required
        
        TO RESUME AUTOMATION:
        - Fix underlying issue
        - Call resume_automation() method
        ========================================================
        """)
        
        # Cancel all pending orders
        open_orders = self.algorithm.Transactions.GetOpenOrders()
        if open_orders:
            self.algorithm.Log(f"Cancelling {len(open_orders)} open orders")
            self.algorithm.Transactions.CancelOpenOrders()
        
        # Log all current positions
        self.log_current_positions()
        
        # Log suggested trades that won't execute
        if self.pending_trades:
            self.algorithm.Log(f"\n{len(self.pending_trades)} trades pending manual review:")
            for trade in self.pending_trades:
                self.log_manual_trade_suggestion(trade)
                
        # Track activation
        self.manual_activations.append({
            'time': activation_time,
            'reason': reason,
            'portfolio_value': self.algorithm.Portfolio.TotalPortfolioValue
        })
        
        # Send alert (would integrate with notification system)
        self.send_critical_alert(reason)
        
    def suggest_trade(self, strategy: str, symbol, direction: str, quantity: int, 
                     entry_price: float = None, signals: Dict = None):
        """In manual mode, log trade suggestions instead of executing"""
        
        if self.is_manual_mode:
            # Create suggestion
            suggestion = {
                'time': self.algorithm.Time,
                'strategy': strategy,
                'symbol': str(symbol),
                'direction': direction,
                'quantity': quantity,
                'entry': entry_price or self.algorithm.Securities[symbol].Price,
                'signals': signals or {},
                'portfolio_value': self.algorithm.Portfolio.TotalPortfolioValue
            }
            
            # Log the suggestion
            self.algorithm.Log(f"""
            =====================================
            MANUAL TRADE SUGGESTION #{len(self.suggested_trades_log) + 1}
            =====================================
            Time: {self.algorithm.Time}
            Strategy: {strategy}
            Symbol: {symbol}
            Direction: {direction.upper()}
            Quantity: {quantity}
            Entry Price: ${suggestion['entry']:.2f}
            
            SIGNALS:
            {self.format_signals(signals)}
            
            TO EXECUTE MANUALLY:
            1. Review current market conditions
            2. Verify entry price is still valid
            3. Check position sizing (BP: ${self.algorithm.Portfolio.MarginRemaining:.2f})
            4. Place order through broker interface
            
            SUGGESTED ORDER:
            {self.format_order_command(symbol, direction, quantity, suggestion['entry'])}
            =====================================
            """)
            
            # Store suggestion
            self.pending_trades.append(suggestion)
            self.suggested_trades_log.append(suggestion)
            
            return None  # Don't return order ticket
            
        else:
            # Normal execution mode
            return self.execute_trade(symbol, direction, quantity, entry_price)
            
    def execute_trade(self, symbol, direction: str, quantity: int, entry_price: float = None):
        """Execute trade normally when not in manual mode"""
        
        try:
            if direction.upper() == "BUY":
                if entry_price:
                    return self.algorithm.LimitOrder(symbol, quantity, entry_price)
                else:
                    return self.algorithm.MarketOrder(symbol, quantity)
            else:  # SELL
                if entry_price:
                    return self.algorithm.LimitOrder(symbol, -quantity, entry_price)
                else:
                    return self.algorithm.MarketOrder(symbol, -quantity)
                    
        except Exception as e:
            self.algorithm.Error(f"Trade execution failed: {str(e)}")
            self.on_execution_error(e)
            return None
            
    def on_order_event(self, order_event):
        """Track order failures and errors"""
        
        if order_event.Status == OrderStatus.Invalid:
            self.error_count += 1
            self.last_error_time = self.algorithm.Time
            
            self.algorithm.Log(f"[ERROR] Order failed: {order_event.Message} ({self.error_count}/{self.max_errors})")
            
            if self.error_count >= self.max_errors:
                self.activate_manual_mode(f"Too many order failures: {self.error_count}")
                
        elif order_event.Status == OrderStatus.Canceled:
            self.algorithm.Log(f"[INFO] Order cancelled: {order_event.OrderId}")
            
    def on_execution_error(self, error: Exception):
        """Handle execution errors"""
        
        self.error_count += 1
        self.last_error_time = self.algorithm.Time
        
        if self.error_count >= self.max_errors:
            self.activate_manual_mode(f"Execution errors exceeded threshold: {str(error)}")
            
    def resume_automation(self, override_checks: bool = False):
        """Resume automated trading after manual mode"""
        
        if not self.is_manual_mode:
            self.algorithm.Log("[INFO] Already in automation mode")
            return False
            
        # Run health checks unless overridden
        if not override_checks:
            if not self.check_automation_health():
                self.algorithm.Log("[ERROR] Cannot resume automation - health checks failed")
                return False
                
        self.is_manual_mode = False
        self.error_count = 0
        self.pending_trades.clear()
        
        self.algorithm.Log(f"""
        ========================================================
        AUTOMATION RESUMED
        ========================================================
        Time: {self.algorithm.Time}
        Manual mode duration: {self.get_manual_mode_duration()} minutes
        Trades suggested during manual: {len(self.suggested_trades_log)}
        
        System Status:
        - Error count reset to 0
        - Automated trading enabled
        - All systems operational
        ========================================================
        """)
        
        return True
        
    def calculate_portfolio_delta(self) -> float:
        """Calculate total portfolio delta"""
        
        total_delta = 0
        
        for symbol, holding in self.algorithm.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Option:
                # Would need Greeks calculation here
                # For now, estimate based on position
                if holding.IsLong:
                    total_delta += holding.Quantity * 0.5 * 100  # Assume 0.5 delta
                else:
                    total_delta -= abs(holding.Quantity) * 0.5 * 100
                    
        return total_delta
        
    def detect_circuit_breaker(self) -> bool:
        """Detect if market circuit breakers are triggered"""
        
        if "SPY" not in self.algorithm.Securities:
            return False
            
        spy = self.algorithm.Securities["SPY"]
        
        # Check for 7% decline (Level 1 circuit breaker)
        if spy.Open > 0:
            decline = ((spy.Price - spy.Open) / spy.Open) * 100
            if decline <= -7:
                self.algorithm.Log(f"[CIRCUIT BREAKER] SPY down {abs(decline):.2f}%")
                return True
                
        return False
        
    def check_system_resources(self) -> bool:
        """Check if system has adequate resources"""
        
        # In QuantConnect, we have limited visibility into system resources
        # Check what we can
        
        # Check if algorithm is timing out
        if hasattr(self.algorithm, 'TimeLimit'):
            # Would need actual implementation
            pass
            
        return True  # Assume OK for now
        
    def log_current_positions(self):
        """Log all current positions for manual review"""
        
        positions = []
        for symbol, holding in self.algorithm.Portfolio.items():
            if holding.Invested:
                positions.append({
                    'symbol': str(symbol),
                    'quantity': holding.Quantity,
                    'avg_price': holding.AveragePrice,
                    'current_price': holding.Price,
                    'pnl': holding.UnrealizedProfit,
                    'value': holding.HoldingsValue
                })
                
        if positions:
            self.algorithm.Log("\nCURRENT POSITIONS:")
            self.algorithm.Log("-" * 50)
            for pos in positions:
                self.algorithm.Log(
                    f"{pos['symbol']:10} | Qty: {pos['quantity']:6} | "
                    f"Avg: ${pos['avg_price']:.2f} | Current: ${pos['current_price']:.2f} | "
                    f"P&L: ${pos['pnl']:.2f}"
                )
        else:
            self.algorithm.Log("\nNo open positions")
            
    def log_manual_trade_suggestion(self, trade: Dict):
        """Format and log a trade suggestion"""
        
        self.algorithm.Log(f"""
        Trade #{len(self.suggested_trades_log)}:
        - Strategy: {trade.get('strategy', 'Unknown')}
        - Symbol: {trade.get('symbol', 'Unknown')}
        - Direction: {trade.get('direction', 'Unknown')}
        - Quantity: {trade.get('quantity', 0)}
        - Entry: ${trade.get('entry', 0):.2f}
        """)
        
    def format_signals(self, signals: Dict) -> str:
        """Format trading signals for display"""
        
        if not signals:
            return "No signals provided"
            
        formatted = []
        for key, value in signals.items():
            formatted.append(f"- {key}: {value}")
            
        return "\n".join(formatted)
        
    def format_order_command(self, symbol, direction: str, quantity: int, price: float) -> str:
        """Format order command for manual execution"""
        
        order_type = "LIMIT" if price else "MARKET"
        side = direction.upper()
        
        if order_type == "LIMIT":
            return f"{side} {quantity} {symbol} @ ${price:.2f} LIMIT"
        else:
            return f"{side} {quantity} {symbol} MARKET"
            
    def send_critical_alert(self, reason: str):
        """Send alert notification (would integrate with external service)"""
        
        # In production, this would send email/SMS/push notification
        self.algorithm.Log(f"[ALERT] Would send notification: {reason}")
        
    def get_manual_mode_duration(self) -> float:
        """Get duration in manual mode (minutes)"""
        
        if not self.manual_activations:
            return 0
            
        last_activation = self.manual_activations[-1]
        duration = (self.algorithm.Time - last_activation['time']).total_seconds() / 60
        return round(duration, 1)
        
    def get_statistics(self) -> Dict:
        """Get manual mode statistics"""
        
        return {
            'is_manual_mode': self.is_manual_mode,
            'error_count': self.error_count,
            'total_activations': len(self.manual_activations),
            'trades_suggested': len(self.suggested_trades_log),
            'pending_trades': len(self.pending_trades),
            'last_activation': self.manual_activations[-1] if self.manual_activations else None
        }