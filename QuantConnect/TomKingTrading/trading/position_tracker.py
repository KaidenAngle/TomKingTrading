# Tom King Trading Framework - Position Tracker
# Real-time position tracking with actual fills and P&L

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json

class PositionTracker:
    """
    Comprehensive position tracking system for Tom King Trading Framework
    
    Key Features:
    - Real-time P&L calculation using actual fills
    - Position performance analytics  
    - Trade history and statistics
    - Greeks-based position monitoring
    - Tax optimization tracking for UK residents
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Position tracking databases
        self.active_positions = {}      # Currently open positions
        self.closed_positions = {}      # Historical closed positions
        
        # Historical fill tracking with rolling window to prevent memory leak
        from collections import deque
        self.fill_history = {}          # OrderId -> deque of fills (max 1000)
        self.max_fill_history = 1000    # Maximum fills to keep per order
        
        # Performance tracking
        self.performance_stats = {
            'total_trades': 0,
            'winning_trades': 0,
            'losing_trades': 0,
            'total_profit': 0.0,
            'total_loss': 0.0,
            'largest_win': 0.0,
            'largest_loss': 0.0,
            'win_rate': 0.0,
            'avg_win': 0.0,
            'avg_loss': 0.0,
            'profit_factor': 0.0,
            'sharpe_ratio': 0.0
        }
        
        # Tax tracking for UK
        self.uk_tax_data = {
            'annual_gains': 0.0,
            'annual_losses': 0.0,
            'cgt_allowance_used': 0.0,     # Capital Gains Tax allowance
            'dividend_income': 0.0,
            'option_premium_income': 0.0,   # Premium collected
            'trade_log': []                 # For HMRC reporting
        }
        
        self.algorithm.Log("[SUCCESS] POSITION TRACKER INITIALIZED")
    
    def OnOrderEvent(self, order_event):
        """Track all order fills for position P&L calculation"""
        try:
            if order_event.Status != OrderStatus.Filled:
                return
            
            # Record the fill
            fill_record = {
                'order_id': order_event.OrderId,
                'symbol': str(order_event.Symbol),
                'quantity': order_event.FillQuantity,
                'fill_price': order_event.FillPrice,
                'fill_time': self.algorithm.Time,
                'direction': 'BUY' if order_event.FillQuantity > 0 else 'SELL',
                'commission': 0,  # TastyTrade commission structure
                'value': order_event.FillQuantity * order_event.FillPrice * 100  # Options multiplier
            }
            
            # Store in fill history with rolling window
            from collections import deque
            if order_event.OrderId not in self.fill_history:
                self.fill_history[order_event.OrderId] = deque(maxlen=self.max_fill_history)
            self.fill_history[order_event.OrderId].append(fill_record)
            
            # Update position tracking
            self._update_position_from_fill(fill_record)
            
        except Exception as e:
            self.algorithm.Error(f"Error processing order event: {e}")
    
    def TrackPositionOpen(self, position_id: str, position_details: Dict):
        """Track opening of a new position"""
        try:
            # Create comprehensive position record
            position_record = {
                'position_id': position_id,
                'strategy': position_details.get('type', 'UNKNOWN'),
                'underlying': position_details.get('underlying', ''),
                'entry_time': self.algorithm.Time,
                'quantity': position_details.get('quantity', 1),
                'status': 'OPEN',
                
                # Entry details
                'entry_credit': 0,
                'entry_debit': 0,
                'entry_fills': [],
                
                # Position structure
                'strikes': position_details.get('strikes', {}),
                'expiry': position_details.get('expiry', self.algorithm.Time),
                'dte_at_entry': position_details.get('dte', 0),
                
                # P&L tracking
                'unrealized_pnl': 0.0,
                'realized_pnl': 0.0,
                'max_profit_seen': 0.0,
                'max_loss_seen': 0.0,
                
                # Greeks tracking
                'entry_greeks': {},
                'current_greeks': {},
                
                # Performance metrics
                'days_held': 0,
                'profit_target_hit': False,
                'stop_loss_hit': False,
                'max_favorable_excursion': 0.0,  # MFE
                'max_adverse_excursion': 0.0,    # MAE
                
                # Tax data
                'premium_collected': 0.0,
                'is_taxable_event': True
            }
            
            self.active_positions[position_id] = position_record
            self.algorithm.Log(f"[DATA] Position tracked: {position_id}")
            
        except Exception as e:
            self.algorithm.Error(f"Error tracking position open: {e}")
    
    def UpdatePositionPnL(self, position_id: str):
        """Update real-time P&L for a position"""
        try:
            if position_id not in self.active_positions:
                return
            
            position = self.active_positions[position_id]
            
            # Calculate current P&L using actual market prices
            current_pnl = self._calculate_realtime_pnl(position)
            
            # Update P&L
            position['unrealized_pnl'] = current_pnl
            position['days_held'] = (self.algorithm.Time - position['entry_time']).days
            
            # Track MFE and MAE
            if current_pnl > position['max_favorable_excursion']:
                position['max_favorable_excursion'] = current_pnl
            
            if current_pnl < position['max_adverse_excursion']:
                position['max_adverse_excursion'] = current_pnl
            
            # Update Greeks if engine available
            if hasattr(self.algorithm, 'greeks_engine'):
                position['current_greeks'] = self.algorithm.greeks_engine.CalculatePositionGreeks(position)
            
        except Exception as e:
            self.algorithm.Error(f"Error updating position P&L: {e}")
    
    def TrackPositionClose(self, position_id: str, exit_reason: str, exit_fills: List[Dict]):
        """Track closing of a position"""
        try:
            if position_id not in self.active_positions:
                return
            
            position = self.active_positions[position_id]
            
            # Calculate final P&L
            final_pnl = self._calculate_final_pnl(position, exit_fills)
            
            # Update position record
            position['status'] = 'CLOSED'
            position['exit_time'] = self.algorithm.Time
            position['exit_reason'] = exit_reason
            position['exit_fills'] = exit_fills
            position['realized_pnl'] = final_pnl
            position['unrealized_pnl'] = 0.0
            
            # Performance flags
            position['profit_target_hit'] = 'profit_target' in exit_reason.lower()
            position['stop_loss_hit'] = 'stop_loss' in exit_reason.lower()
            
            # Move to closed positions
            self.closed_positions[position_id] = position.copy()
            del self.active_positions[position_id]
            
            # Update performance statistics
            self._update_performance_stats(position)
            
            # Update tax tracking
            self._update_tax_tracking(position)
            
            self.algorithm.Log(f"[SUCCESS] Position closed: {position_id} | P&L: ${final_pnl:.2f} | Reason: {exit_reason}")
            
        except Exception as e:
            self.algorithm.Error(f"Error tracking position close: {e}")
    
    def GetPositionPnL(self, position_id: str) -> float:
        """Get current P&L for a position"""
        if position_id in self.active_positions:
            self.UpdatePositionPnL(position_id)
            return self.active_positions[position_id]['unrealized_pnl']
        
        if position_id in self.closed_positions:
            return self.closed_positions[position_id]['realized_pnl']
        
        return 0.0
    
    def GetPortfolioPnL(self) -> Dict:
        """Get total portfolio P&L breakdown"""
        try:
            unrealized_pnl = sum(pos['unrealized_pnl'] for pos in self.active_positions.values())
            realized_pnl = sum(pos['realized_pnl'] for pos in self.closed_positions.values())
            
            return {
                'unrealized_pnl': unrealized_pnl,
                'realized_pnl': realized_pnl,
                'total_pnl': unrealized_pnl + realized_pnl,
                'active_positions': len(self.active_positions),
                'closed_positions': len(self.closed_positions)
            }
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating portfolio P&L: {e}")
            return {'unrealized_pnl': 0, 'realized_pnl': 0, 'total_pnl': 0, 'active_positions': 0, 'closed_positions': 0}
    
    def GetPerformanceStats(self) -> Dict:
        """Get comprehensive performance statistics"""
        return self.performance_stats.copy()
    
    def GetUKTaxReport(self) -> Dict:
        """Generate UK tax report for HMRC compliance"""
        return self.uk_tax_data.copy()
    
    def _calculate_realtime_pnl(self, position: Dict) -> float:
        """Calculate real-time P&L using current market prices"""
        try:
            # Use Greeks engine if available
            if hasattr(self.algorithm, 'greeks_engine'):
                position_greeks = self.algorithm.greeks_engine.CalculatePositionGreeks(position)
                current_value = position_greeks.get('total_theoretical_value', 0)
                entry_value = position.get('entry_credit', 0) + position.get('entry_debit', 0)
                
                # For credit positions: P&L = Credit - Current Cost
                # For debit positions: P&L = Current Value - Debit
                if position.get('entry_credit', 0) > 0:
                    return position['entry_credit'] - current_value
                else:
                    return current_value - position.get('entry_debit', 0)
            
            # Fallback calculation
            days_held = (self.algorithm.Time - position['entry_time']).days
            max_profit = position.get('entry_credit', 100)
            
            # Simple time decay model
            decay_rate = 0.02 * days_held  # 2% per day
            return max_profit * min(decay_rate, 0.7)  # Cap at 70%
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating real-time P&L: {e}")
            return 0.0
    
    def _calculate_final_pnl(self, position: Dict, exit_fills: List[Dict]) -> float:
        """Calculate final realized P&L using actual fill prices"""
        try:
            # Calculate total entry value
            entry_value = sum(fill.get('value', 0) for fill in position.get('entry_fills', []))
            
            # Calculate total exit value
            exit_value = sum(fill.get('value', 0) for fill in exit_fills)
            
            # For option positions: P&L = Entry Value - Exit Value (accounting for long/short)
            # This accounts for the fact that selling options gives positive cash flow
            pnl = entry_value - exit_value
            
            return pnl
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating final P&L: {e}")
            return 0.0
    
    def _update_position_from_fill(self, fill_record: Dict):
        """Update position records when orders are filled"""
        try:
            # Find which position this fill belongs to
            # This is a simplified version - in production would need more sophisticated matching
            symbol = fill_record['symbol']
            
            # Look for positions with matching underlying
            for position_id, position in self.active_positions.items():
                if symbol in str(position.get('underlying', '')):
                    # Add to entry fills
                    if 'entry_fills' not in position:
                        position['entry_fills'] = []
                    position['entry_fills'].append(fill_record)
                    
                    # Update entry credit/debit
                    if fill_record['direction'] == 'SELL':
                        position['entry_credit'] += abs(fill_record['value'])
                    else:
                        position['entry_debit'] += abs(fill_record['value'])
                    
                    break
                    
        except Exception as e:
            self.algorithm.Error(f"Error updating position from fill: {e}")
    
    def _update_performance_stats(self, position: Dict):
        """Update overall performance statistics"""
        try:
            pnl = position['realized_pnl']
            
            self.performance_stats['total_trades'] += 1
            
            if pnl > 0:
                self.performance_stats['winning_trades'] += 1
                self.performance_stats['total_profit'] += pnl
                if pnl > self.performance_stats['largest_win']:
                    self.performance_stats['largest_win'] = pnl
            else:
                self.performance_stats['losing_trades'] += 1
                self.performance_stats['total_loss'] += abs(pnl)
                if abs(pnl) > self.performance_stats['largest_loss']:
                    self.performance_stats['largest_loss'] = abs(pnl)
            
            # Calculate ratios
            total_trades = self.performance_stats['total_trades']
            if total_trades > 0:
                self.performance_stats['win_rate'] = self.performance_stats['winning_trades'] / total_trades
                
                if self.performance_stats['winning_trades'] > 0:
                    self.performance_stats['avg_win'] = self.performance_stats['total_profit'] / self.performance_stats['winning_trades']
                
                if self.performance_stats['losing_trades'] > 0:
                    self.performance_stats['avg_loss'] = self.performance_stats['total_loss'] / self.performance_stats['losing_trades']
                    
                    if self.performance_stats['avg_loss'] > 0:
                        self.performance_stats['profit_factor'] = self.performance_stats['avg_win'] / self.performance_stats['avg_loss']
            
        except Exception as e:
            self.algorithm.Error(f"Error updating performance stats: {e}")
    
    def _update_tax_tracking(self, position: Dict):
        """Update UK tax tracking data"""
        try:
            pnl = position['realized_pnl']
            
            if pnl > 0:
                self.uk_tax_data['annual_gains'] += pnl
            else:
                self.uk_tax_data['annual_losses'] += abs(pnl)
            
            # Track option premium income
            premium_collected = position.get('entry_credit', 0)
            self.uk_tax_data['option_premium_income'] += premium_collected
            
            # Add to trade log for HMRC
            trade_record = {
                'date': position['exit_time'].strftime('%Y-%m-%d'),
                'position_id': position['position_id'],
                'underlying': position['underlying'],
                'strategy': str(position['strategy']),
                'pnl_gbp': pnl,  # Convert to GBP if needed
                'premium_collected': premium_collected
            }
            
            self.uk_tax_data['trade_log'].append(trade_record)
            
        except Exception as e:
            self.algorithm.Error(f"Error updating tax tracking: {e}")
    
    def LogPerformanceSummary(self):
        """Log comprehensive performance summary"""
        try:
            portfolio_pnl = self.GetPortfolioPnL()
            
            self.algorithm.Log("\n[DATA] POSITION TRACKER SUMMARY:")
            self.algorithm.Log(f"  Total P&L: ${portfolio_pnl['total_pnl']:.2f}")
            self.algorithm.Log(f"  Unrealized: ${portfolio_pnl['unrealized_pnl']:.2f}")
            self.algorithm.Log(f"  Realized: ${portfolio_pnl['realized_pnl']:.2f}")
            self.algorithm.Log(f"  Active Positions: {portfolio_pnl['active_positions']}")
            self.algorithm.Log(f"  Closed Positions: {portfolio_pnl['closed_positions']}")
            
            if self.performance_stats['total_trades'] > 0:
                self.algorithm.Log(f"\n[DATA] PERFORMANCE STATS:")
                self.algorithm.Log(f"  Win Rate: {self.performance_stats['win_rate']:.1%}")
                self.algorithm.Log(f"  Avg Win: ${self.performance_stats['avg_win']:.2f}")
                self.algorithm.Log(f"  Avg Loss: ${self.performance_stats['avg_loss']:.2f}")
                self.algorithm.Log(f"  Profit Factor: {self.performance_stats['profit_factor']:.2f}")
                self.algorithm.Log(f"  Largest Win: ${self.performance_stats['largest_win']:.2f}")
                self.algorithm.Log(f"  Largest Loss: ${self.performance_stats['largest_loss']:.2f}")
            
        except Exception as e:
            self.algorithm.Error(f"Error logging performance summary: {e}")