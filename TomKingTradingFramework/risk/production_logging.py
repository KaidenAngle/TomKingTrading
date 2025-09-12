# Production Logging & Monitoring - The Final 5%
# Persistent logging, heartbeat monitoring, trade journal

from AlgorithmImports import *
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any
from greeks.greeks_monitor import GreeksMonitor

class ProductionLogger:
    """
    Persistent logging system for production trading
    Writes to files for audit trail and debugging
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Log directories (would be configured for your system)
        self.log_base_path = "/logs/tomking/"  # Adjust for your environment
        self.trade_log_file = "trades.json"
        self.error_log_file = "errors.log"
        self.daily_log_file = f"daily_{self.algo.Time.date()}.log"
        
        # Trade journal
        self.trade_journal = []
        
        # Performance metrics
        self.daily_metrics = {
            'trades': 0,
            'wins': 0,
            'losses': 0,
            'total_pnl': 0,
            'max_drawdown': 0,
            'peak_value': 0
        }
        
        self.algo.Log("[WARNING] Production Logger Initialized")
    
    def log_trade_entry(self, strategy_name: str, symbol, quantity: int, 
                       entry_price: float, order_type: str = "MARKET"):
        """Log trade entry to persistent storage"""
        trade_record = {
            'timestamp': str(self.algo.Time),
            'type': 'ENTRY',
            'strategy': strategy_name,
            'symbol': str(symbol),
            'quantity': quantity,
            'price': entry_price,
            'order_type': order_type,
            'account_value': self.algo.Portfolio.TotalPortfolioValue,
            'margin_used': self.algo.Portfolio.TotalMarginUsed,
            'trade_id': f"{strategy_name}_{self.algo.Time.timestamp()}"
        }
        
        # Add to journal
        self.trade_journal.append(trade_record)
        
        # Write to file (in production, would actually write to disk)
        self.write_trade_log(trade_record)
        
        # Also log to QuantConnect
        self.algo.Log(f"[WARNING] TRADE ENTRY: {strategy_name} {symbol} x{quantity} @ ${entry_price:.2f}")
        
        return trade_record['trade_id']
    
    def log_trade_exit(self, trade_id: str, exit_price: float, pnl: float, reason: str = ""):
        """Log trade exit and P&L"""
        trade_record = {
            'timestamp': str(self.algo.Time),
            'type': 'EXIT',
            'trade_id': trade_id,
            'exit_price': exit_price,
            'pnl': pnl,
            'reason': reason,
            'account_value': self.algo.Portfolio.TotalPortfolioValue
        }
        
        # Update metrics
        self.daily_metrics['trades'] += 1
        if pnl > 0:
            self.daily_metrics['wins'] += 1
        else:
            self.daily_metrics['losses'] += 1
        self.daily_metrics['total_pnl'] += pnl
        
        # Add to journal
        self.trade_journal.append(trade_record)
        
        # Write to file
        self.write_trade_log(trade_record)
        
        # Log to QuantConnect
        emoji = "[WARNING]" if pnl > 0 else "[WARNING]"
        self.algo.Log(f"{emoji} TRADE EXIT: {trade_id} P&L: ${pnl:.2f} ({reason})")
    
    def log_error(self, error_type: str, message: str, critical: bool = False):
        """Log errors to separate error file"""
        error_record = {
            'timestamp': str(self.algo.Time),
            'type': error_type,
            'message': message,
            'critical': critical,
            'account_value': self.algo.Portfolio.TotalPortfolioValue,
            'positions': sum(1 for h in self.algo.Portfolio.Values if h.Invested)
        }
        
        # Write to error log
        self.write_error_log(error_record)
        
        # Use appropriate QuantConnect logging level
        if critical:
            self.algo.Error(f"[WARNING] CRITICAL: {error_type} - {message}")
        else:
            self.algo.Log(f"[WARNING] ERROR: {error_type} - {message}")
    
    def write_trade_log(self, record: Dict):
        """Write trade record to file"""
        try:
            existing_trades = []
        if self.algo.ObjectStore.ContainsKey(self.trade_log_file):
            json_data = self.algo.ObjectStore.Read(self.trade_log_file)
        existing_trades = json.loads(json_data)
        except Exception as e:

            # In QuantConnect, use ObjectStore for persistence
            
            existing_trades.append(record)
            
            # Keep last 1000 trades
            if len(existing_trades) > 1000:
                existing_trades = existing_trades[-1000:]
            
            self.algo.ObjectStore.Save(self.trade_log_file, json.dumps(existing_trades))
            
        except Exception as e:
            self.algo.Error(f"Failed to write trade log: {str(e)}")
    
    def write_error_log(self, record: Dict):
        """Write error record to file"""
        try:
            existing_errors = []
        if self.algo.ObjectStore.ContainsKey(self.error_log_file):
            json_data = self.algo.ObjectStore.Read(self.error_log_file)
        existing_errors = json.loads(json_data)
        except Exception as e:

            # In QuantConnect, use ObjectStore
            
            existing_errors.append(record)
            
            # Keep last 500 errors
            if len(existing_errors) > 500:
                existing_errors = existing_errors[-500:]
            
            self.algo.ObjectStore.Save(self.error_log_file, json.dumps(existing_errors))
            
        except Exception as e:
            self.algo.Error(f"Failed to write error log: {str(e)}")
    
    def get_trade_history(self, days: int = 7) -> list:
        """Get recent trade history"""
        try:
            pass
        except Exception as e:

            if self.algo.ObjectStore.ContainsKey(self.trade_log_file):
                json_data = self.algo.ObjectStore.Read(self.trade_log_file)
                all_trades = json.loads(json_data)
                
                # Filter by date
                cutoff_date = self.algo.Time - timedelta(days=days)
                recent_trades = [
                    t for t in all_trades 
                    if datetime.strptime(t['timestamp'][:19], '%Y-%m-%d %H:%M:%S') > cutoff_date
                ]
                
                return recent_trades
            
        except Exception as e:
            self.algo.Error(f"Failed to read trade history: {str(e)}")
        
        return []
    
    def calculate_daily_metrics(self):
        """Calculate and log daily performance metrics"""
        portfolio = self.algo.Portfolio
        current_value = portfolio.TotalPortfolioValue
        
        # Update peak for drawdown calculation
        if current_value > self.daily_metrics.get('peak_value', 0):
            self.daily_metrics['peak_value'] = current_value
        
        # Calculate drawdown
        if self.daily_metrics['peak_value'] > 0:
            drawdown = (self.daily_metrics['peak_value'] - current_value) / self.daily_metrics['peak_value']
            self.daily_metrics['max_drawdown'] = max(self.daily_metrics['max_drawdown'], drawdown)
        
        # Win rate
        total_trades = self.daily_metrics['wins'] + self.daily_metrics['losses']
        win_rate = (self.daily_metrics['wins'] / total_trades * 100) if total_trades > 0 else 0
        
        # Log summary
        summary = f"""
[WARNING] DAILY METRICS - {self.algo.Time.date()}
Trades: {total_trades}
Win Rate: {win_rate:.1f}%
P&L: ${self.daily_metrics['total_pnl']:.2f}
Max Drawdown: {self.daily_metrics['max_drawdown']:.2%}
Account Value: ${current_value:.2f}
"""
        self.algo.Log(summary)
        
        # Save to ObjectStore
        self.algo.ObjectStore.Save(
            f"daily_metrics_{self.algo.Time.date()}.json",
            json.dumps(self.daily_metrics)
        )


class NetworkMonitor:
    """
    Network connection monitoring with heartbeat
    Detects disconnections and attempts recovery
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Connection tracking
        self.last_heartbeat = self.algo.Time
        self.heartbeat_interval = 60  # seconds
        self.max_heartbeat_delay = 300  # 5 minutes
        self.connection_status = "CONNECTED"
        self.failed_heartbeats = 0
        self.max_failed_heartbeats = 3
        
        # Recovery tracking
        self.recovery_attempts = 0
        self.max_recovery_attempts = 5
        
        self.algo.Log("[WARNING] Network Monitor Initialized")
    
    def heartbeat_check(self):
        """Perform heartbeat check - scheduled every minute"""
        try:
            if not self.algo.IsMarketOpen("SPY"):
                return
        except Exception as e:

            # Check if market is open
            
            # Test connection with simple operation
            test_successful = self.test_connection()
            
            if test_successful:
                self.last_heartbeat = self.algo.Time
                self.failed_heartbeats = 0
                
                if self.connection_status != "CONNECTED":
                    self.algo.Log("[WARNING] Connection restored")
                    self.connection_status = "CONNECTED"
                    self.recovery_attempts = 0
                    
                    # Re-enable trading if it was disabled
                    if hasattr(self.algo, 'safety_checks'):
                        self.algo.safety_checks.can_trade = True
                        
            else:
                self.handle_failed_heartbeat()
                
        except Exception as e:
            self.algo.Error(f"Heartbeat check error: {str(e)}")
            self.handle_failed_heartbeat()
    
    def test_connection(self) -> bool:
        """Test connection to broker and data feeds"""
        try:
            value = self.algo.Portfolio.TotalPortfolioValue
        if value <= 0:
            return False
        except Exception as e:

            # Test 1: Portfolio access
            
            # Test 2: Market data access
            if "SPY" in self.algo.Securities:
                price = self.algo.Securities["SPY"].Price
                if price <= 0:
                    return False
            
            # Test 3: TastyTrade connection (if live)
            if self.algo.LiveMode and hasattr(self.algo, 'tastytrade'):
                account = self.algo.tastytrade.get_account_info()
                if not account:
                    return False
            
            return True
            
        except (KeyError, AttributeError, ValueError, TypeError, ConnectionError) as e:
            return False
    
    def handle_failed_heartbeat(self):
        """Handle failed heartbeat"""
        self.failed_heartbeats += 1
        
        if self.failed_heartbeats >= self.max_failed_heartbeats:
            self.connection_status = "DISCONNECTED"
            self.algo.Error(f"[WARNING] CONNECTION LOST - {self.failed_heartbeats} failed heartbeats")
            
            # Disable trading
            if hasattr(self.algo, 'safety_checks'):
                self.algo.safety_checks.can_trade = False
            
            # Attempt recovery
            self.attempt_recovery()
    
    def attempt_recovery(self):
        """Attempt to recover connection"""
        self.recovery_attempts += 1
        
        if self.recovery_attempts > self.max_recovery_attempts:
            self.algo.Error("[WARNING] MAX RECOVERY ATTEMPTS EXCEEDED - MANUAL INTERVENTION REQUIRED")
            return
        
        self.algo.Log(f"Attempting connection recovery ({self.recovery_attempts}/{self.max_recovery_attempts})")
        
        try:
            if hasattr(self.algo, 'tastytrade'):
                self.algo.tastytrade = self.algo.tastytrade.__class__(self.algo)
        except Exception as e:

            # Re-initialize broker connection if needed
                
            # Test connection
            if self.test_connection():
                self.connection_status = "CONNECTED"
                self.failed_heartbeats = 0
                self.algo.Log("[WARNING] Connection recovered successfully")
            else:
                self.algo.Log("[WARNING] Recovery attempt failed")
                
        except Exception as e:
            self.algo.Error(f"Recovery attempt error: {str(e)}")
    
    def get_connection_status(self) -> Dict:
        """Get current connection status"""
        time_since_heartbeat = (self.algo.Time - self.last_heartbeat).seconds
        
        return {
            'status': self.connection_status,
            'last_heartbeat': str(self.last_heartbeat),
            'seconds_since_heartbeat': time_since_heartbeat,
            'failed_heartbeats': self.failed_heartbeats,
            'recovery_attempts': self.recovery_attempts,
            'can_trade': self.connection_status == "CONNECTED"
        }


class GreeksAggregator:
    """
    Portfolio-wide Greeks aggregation
    Monitors total Greeks exposure across all positions
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # FIXED: Use centralized GreeksMonitor instead of duplicate implementation  
        self.greeks_monitor = GreeksMonitor(algorithm)
        
        # DEPRECATED: Greeks limits moved to phase_based_greeks_limits.py
        # Using phase-specific limits instead of linear scaling
        # See: greeks/phase_based_greeks_limits.py for proper implementation
        
        self.algo.Log("[WARNING] Greeks Aggregator Initialized")
    
    def calculate_portfolio_greeks(self) -> Dict[str, float]:
        """FIXED: Delegate to centralized GreeksMonitor instead of duplicating calculation"""
        return self.greeks_monitor.calculate_portfolio_greeks()
    
    def check_greeks_limits(self) -> tuple:
        """
        DEPRECATED: Use phase_greeks_manager.check_greeks_compliance() instead
        Kept for backward compatibility only
        """
        # Delegate to phase-based manager if available
        if hasattr(self.algo, 'phase_greeks_manager'):
            compliant, message, details = self.algo.phase_greeks_manager.check_greeks_compliance()
            violations = details.get('violations', [])
            greeks = details.get('current_greeks', self.calculate_portfolio_greeks())
            return compliant, violations, greeks
        
        # Fallback to basic calculation without limits
        greeks = self.calculate_portfolio_greeks()
        return True, [], greeks
    
    def log_greeks_summary(self):
        """Log portfolio Greeks summary"""
        greeks = self.calculate_portfolio_greeks()
        account_value = self.algo.Portfolio.TotalPortfolioValue
        
        summary = f"""
[WARNING] PORTFOLIO GREEKS
Delta: {greeks['delta']:+.1f}
Gamma: {greeks['gamma']:+.1f}
Theta: {greeks['theta']:+.1f} (${greeks['theta']:.2f}/day)
Vega: {greeks['vega']:+.1f}
Account: ${account_value:,.2f}
"""
        self.algo.Log(summary)
        
        # Check limits
        within_limits, violations, _ = self.check_greeks_limits()
        
        if not within_limits:
            self.algo.Log("[WARNING] GREEKS VIOLATIONS:")
            for violation in violations:
                self.algo.Log(f"   {violation}")


# USAGE IN MAIN.PY:
#