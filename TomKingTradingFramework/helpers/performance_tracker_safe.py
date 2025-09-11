# Safe Performance Tracker - Prevents overflow and maintains accuracy
# Handles cumulative calculations with bounds checking

from AlgorithmImports import *
from typing import Dict, List, Optional
from decimal import Decimal, ROUND_HALF_UP
import numpy as np

class SafePerformanceTracker:
    """
    Performance tracking with overflow protection and precision handling
    Prevents integer/float overflow in cumulative calculations
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Use Decimal for precise financial calculations
        self.cumulative_pnl = Decimal('0')
        self.cumulative_fees = Decimal('0')
        self.cumulative_slippage = Decimal('0')
        
        # Bounds for safety (in millions)
        self.MAX_VALUE = Decimal('1000000000')  # $1 billion max
        self.MIN_VALUE = Decimal('-1000000000')  # -$1 billion min
        
        # Rolling windows to prevent unbounded growth
        self.pnl_history = []  # Limited to last 1000 entries
        self.trade_history = []
        self.MAX_HISTORY = 1000
        
        # Checkpoints for recovery
        self.checkpoints = []
        self.last_checkpoint = None
        
    def add_trade_pnl(self, pnl: float, fees: float = 0, slippage: float = 0) -> bool:
        """
        Add trade P&L with overflow protection
        Returns False if bounds exceeded
        """
        
        try:
            # Convert to Decimal for precision
            pnl_decimal = Decimal(str(pnl))
            fees_decimal = Decimal(str(fees))
            slippage_decimal = Decimal(str(slippage))
            
            # Check individual values first
            if abs(pnl_decimal) > self.MAX_VALUE:
                self.algo.Error(f"Trade P&L exceeds bounds: ${pnl}")
                return False
                
            # Calculate new cumulative with bounds checking
            new_cumulative = self.cumulative_pnl + pnl_decimal
            new_fees = self.cumulative_fees + fees_decimal
            new_slippage = self.cumulative_slippage + slippage_decimal
            
            # Check bounds
            if new_cumulative > self.MAX_VALUE or new_cumulative < self.MIN_VALUE:
                self.algo.Error(f"Cumulative P&L would exceed bounds: ${new_cumulative}")
                self._create_checkpoint()  # Save state before rejection
                return False
                
            # Update values
            self.cumulative_pnl = new_cumulative
            self.cumulative_fees = new_fees
            self.cumulative_slippage = new_slippage
            
            # Add to history with rolling window
            self.pnl_history.append({
                'timestamp': self.algo.Time,
                'pnl': float(pnl_decimal),
                'cumulative': float(new_cumulative)
            })
            
            # Maintain rolling window
            if len(self.pnl_history) > self.MAX_HISTORY:
                self.pnl_history.pop(0)
                
            return True
            
        except (ValueError, OverflowError) as e:
            self.algo.Error(f"Performance tracking error: {e}")
            return False
            
    def calculate_sharpe_ratio(self, lookback_days: int = 252) -> float:
        """Calculate Sharpe ratio with safe division"""
        
        if len(self.pnl_history) < 2:
            return 0.0
            
        # Get returns
        returns = [h['pnl'] for h in self.pnl_history[-lookback_days:]]
        
        if not returns:
            return 0.0
            
        # Calculate with variance check
        mean_return = np.mean(returns)
        std_return = np.std(returns)
        
        # Prevent division by zero
        if std_return < 0.0001:  # Near-zero variance
            if mean_return > 0:
                return 2.0  # Cap at 2.0 for near-zero volatility with positive returns
            else:
                return 0.0
                
        sharpe = (mean_return / std_return) * np.sqrt(252)
        
        # Bound Sharpe ratio to reasonable range
        return max(-3.0, min(3.0, sharpe))
        
    def calculate_max_drawdown(self) -> Dict:
        """Calculate maximum drawdown with overflow protection"""
        
        if not self.pnl_history:
            return {'max_dd': 0, 'current_dd': 0, 'peak': 0}
            
        cumulative_values = [h['cumulative'] for h in self.pnl_history]
        
        peak = cumulative_values[0]
        max_dd = 0
        current_dd = 0
        
        for value in cumulative_values:
            # Update peak
            if value > peak:
                peak = value
                
            # Calculate drawdown
            if peak > 0:
                dd = (peak - value) / peak
                max_dd = max(max_dd, dd)
                current_dd = dd
                
        return {
            'max_dd': max_dd,
            'current_dd': current_dd,
            'peak': peak
        }
        
    def calculate_win_rate(self) -> Dict:
        """Calculate win rate statistics safely"""
        
        if not self.pnl_history:
            return {'win_rate': 0, 'wins': 0, 'losses': 0, 'total': 0}
            
        wins = sum(1 for h in self.pnl_history if h['pnl'] > 0)
        losses = sum(1 for h in self.pnl_history if h['pnl'] < 0)
        total = len(self.pnl_history)
        
        win_rate = wins / total if total > 0 else 0
        
        return {
            'win_rate': win_rate,
            'wins': wins,
            'losses': losses,
            'total': total
        }
        
    def _create_checkpoint(self):
        """Create checkpoint for recovery"""
        
        checkpoint = {
            'timestamp': self.algo.Time,
            'cumulative_pnl': self.cumulative_pnl,
            'cumulative_fees': self.cumulative_fees,
            'cumulative_slippage': self.cumulative_slippage,
            'history_length': len(self.pnl_history)
        }
        
        self.checkpoints.append(checkpoint)
        
        # Keep only last 10 checkpoints
        if len(self.checkpoints) > 10:
            self.checkpoints.pop(0)
            
        self.last_checkpoint = checkpoint
        
    def restore_from_checkpoint(self):
        """Restore from last checkpoint if needed"""
        
        if self.last_checkpoint:
            self.cumulative_pnl = self.last_checkpoint['cumulative_pnl']
            self.cumulative_fees = self.last_checkpoint['cumulative_fees']
            self.cumulative_slippage = self.last_checkpoint['cumulative_slippage']
            
            self.algo.Log("Performance tracker restored from checkpoint")
            return True
            
        return False
        
    def get_statistics(self) -> Dict:
        """Get comprehensive performance statistics"""
        
        stats = {
            'cumulative_pnl': float(self.cumulative_pnl),
            'cumulative_fees': float(self.cumulative_fees),
            'cumulative_slippage': float(self.cumulative_slippage),
            'net_pnl': float(self.cumulative_pnl - self.cumulative_fees - self.cumulative_slippage),
            'sharpe_ratio': self.calculate_sharpe_ratio(),
            'history_entries': len(self.pnl_history),
            'checkpoints': len(self.checkpoints)
        }
        
        # Add drawdown stats
        dd_stats = self.calculate_max_drawdown()
        stats.update(dd_stats)
        
        # Add win rate stats
        wr_stats = self.calculate_win_rate()
        stats.update(wr_stats)
        
        return stats
        
    def validate_calculations(self) -> bool:
        """Validate all calculations are within bounds"""
        
        checks = [
            abs(self.cumulative_pnl) < self.MAX_VALUE,
            abs(self.cumulative_fees) < self.MAX_VALUE,
            abs(self.cumulative_slippage) < self.MAX_VALUE,
            len(self.pnl_history) <= self.MAX_HISTORY
        ]
        
        return all(checks)
    
    def update_performance_metrics(self):
        """Update performance metrics - called from main.py OnData
        
        This method updates performance tracking based on current portfolio state.
        Called periodically to maintain performance statistics.
        """
        
        try:
            # Get current portfolio value
            current_value = self.algo.Portfolio.TotalPortfolioValue
            
            # Calculate current unrealized P&L if we have a baseline
            if hasattr(self, '_last_portfolio_value'):
                unrealized_change = current_value - self._last_portfolio_value
                
                # Only record if there's a meaningful change (> $0.01)
                if abs(unrealized_change) > 0.01:
                    # Add to performance tracking (this includes validation)
                    self.add_trade_pnl(unrealized_change, 0, 0)
            
            # Update baseline for next comparison
            self._last_portfolio_value = current_value
            
            # Validate calculations periodically
            if not self.validate_calculations():
                self.algo.Error("[Performance] Validation failed - creating checkpoint")
                self._create_checkpoint()
                
        except Exception as e:
            self.algo.Error(f"[Performance] Error updating metrics: {e}")
    
    def record_trade(self, order_event):
        """Record completed trade from order event
        
        This method is called from OnOrderEvent when trades are filled.
        """
        
        try:
            if hasattr(order_event, 'FillPrice') and hasattr(order_event, 'FillQuantity'):
                # QuantConnect provides fill details for complete trade tracking
                fill_value = float(order_event.FillPrice * order_event.FillQuantity)
                
                # Record the trade (basic implementation)
                trade_record = {
                    'timestamp': self.algo.Time,
                    'symbol': str(order_event.Symbol),
                    'quantity': order_event.FillQuantity,
                    'price': order_event.FillPrice,
                    'value': fill_value
                }
                
                self.trade_history.append(trade_record)
                
                # Maintain rolling window
                if len(self.trade_history) > self.MAX_HISTORY:
                    self.trade_history.pop(0)
                    
        except Exception as e:
            self.algo.Error(f"[Performance] Error recording trade: {e}")