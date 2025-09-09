# Enhanced Trade Logger with Full Feature Set
# Tracks trades through entire lifecycle with detailed metrics

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

class TradeExecutionLogger:
    """
    Comprehensive trade logging with stage tracking
    Records every decision point and tracks performance metrics
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Trade lifecycle tracking
        self.active_trades = {}
        self.completed_trades = []
        
        # Stage tracking for each trade
        self.trade_stages = {}
        
        # Performance tracking
        self.performance_by_hour = defaultdict(lambda: {'trades': 0, 'wins': 0, 'pnl': 0})
        self.performance_by_day = defaultdict(lambda: {'trades': 0, 'wins': 0, 'pnl': 0})
        self.performance_by_pattern = defaultdict(lambda: {'trades': 0, 'wins': 0, 'pnl': 0})
        
        self.algo.Log("[WARNING] ENHANCED TRADE LOGGER INITIALIZED")
    
    def start_trade_evaluation(self, strategy_name: str, symbol) -> str:
        """Start tracking a new trade evaluation"""
        trade_id = f"{strategy_name}_{symbol}_{self.algo.Time.timestamp()}"
        
        self.trade_stages[trade_id] = {
            'strategy': strategy_name,
            'symbol': str(symbol),
            'start_time': str(self.algo.Time),
            'stages': [],
            'decision': 'PENDING',
            'rejection_reason': None
        }
        
        return trade_id
    
    def log_evaluation_stage(self, trade_id: str, stage_name: str, data: Dict, passed: bool, notes: str = ""):
        """Log an evaluation stage for a trade"""
        if trade_id not in self.trade_stages:
            return
        
        stage_record = {
            'stage': stage_name,
            'timestamp': str(self.algo.Time),
            'data': data,
            'passed': passed,
            'notes': notes,
            'icon': self.get_stage_icon(stage_name, passed)
        }
        
        self.trade_stages[trade_id]['stages'].append(stage_record)
        
        # Log to console with formatting
        icon = stage_record['icon']
        status = "PASS" if passed else "FAIL"
        self.algo.Log(f"{icon} {stage_name}: {status} - {notes[:50]}")
        
        # If failed, mark trade as rejected
        if not passed:
            self.trade_stages[trade_id]['decision'] = 'REJECTED'
            self.trade_stages[trade_id]['rejection_reason'] = f"{stage_name}: {notes}"
    
    def get_stage_icon(self, stage_name: str, passed: bool) -> str:
        """Get icon for stage visualization"""
        stage_icons = {
            'MARKET_CHECK': '[WARNING]',
            'CORRELATION_CHECK': '[WARNING]',
            'VIX_CHECK': '[WARNING]',
            'PATTERN_ANALYSIS': '[WARNING]',
            'GREEKS_EVALUATION': 'Δ',
            'MARGIN_CHECK': '[WARNING]',
            'POSITION_LIMIT': '[WARNING]',
            'ENTRY_TIMING': '⏰',
            'PRICE_VALIDATION': '[WARNING]',
            'ORDER_PLACEMENT': '[WARNING]'
        }
        
        base_icon = stage_icons.get(stage_name, '•')
        return f"{base_icon}[WARNING]" if passed else f"{base_icon}[WARNING]"
    
    def complete_evaluation(self, trade_id: str, executed: bool, entry_data: Dict = None):
        """Complete the evaluation process"""
        if trade_id not in self.trade_stages:
            return
        
        evaluation = self.trade_stages[trade_id]
        evaluation['end_time'] = str(self.algo.Time)
        evaluation['decision'] = 'EXECUTED' if executed else evaluation.get('decision', 'REJECTED')
        
        if executed and entry_data:
            # Create active trade record
            self.active_trades[trade_id] = {
                'id': trade_id,
                'strategy': evaluation['strategy'],
                'symbol': evaluation['symbol'],
                'entry_time': str(self.algo.Time),
                'entry_price': entry_data.get('price', 0),
                'quantity': entry_data.get('quantity', 0),
                'position_type': entry_data.get('type', 'Unknown'),
                'max_profit': entry_data.get('max_profit', 0),
                'max_loss': entry_data.get('max_loss', 0),
                'stop_loss': entry_data.get('stop_loss'),
                'profit_target': entry_data.get('profit_target'),
                'stages': evaluation['stages'],
                'pattern_detected': entry_data.get('pattern'),
                'vix_at_entry': entry_data.get('vix', 0),
                'greeks_at_entry': entry_data.get('greeks', {}),
                'correlation_group': entry_data.get('correlation_group'),
                'updates': []
            }
            
            # Log execution summary
            self.log_execution_summary(trade_id)
    
    def log_execution_summary(self, trade_id: str):
        """Log a summary of the execution decision process"""
        if trade_id not in self.active_trades:
            return
        
        trade = self.active_trades[trade_id]
        stages = trade.get('stages', [])
        
        summary = f"""
[WARNING]
[WARNING] TRADE EXECUTION: {trade['strategy']} - {trade['symbol']}
[WARNING]
"""
        
        # Show all stages
        for stage in stages:
            status = "[WARNING]" if stage['passed'] else "[WARNING]"
            summary += f"[WARNING] {status} {stage['stage']:20} {stage['notes'][:30]}\n"
        
        summary += f"""[WARNING]
[WARNING] Entry Price: ${trade['entry_price']:.2f}
[WARNING] Position Type: {trade['position_type']}
[WARNING] Max Profit: ${trade['max_profit']:.2f} | Max Loss: ${trade['max_loss']:.2f}
[WARNING]
"""
        
        self.algo.Log(summary)
    
    def update_trade(self, trade_id: str, update_type: str, data: Dict):
        """Update an active trade with new information"""
        if trade_id not in self.active_trades:
            return
        
        update_record = {
            'timestamp': str(self.algo.Time),
            'type': update_type,
            'data': data
        }
        
        self.active_trades[trade_id]['updates'].append(update_record)
        
        # Update specific fields based on update type
        if update_type == 'PRICE_UPDATE':
            current_price = data.get('current_price', 0)
            entry_price = self.active_trades[trade_id]['entry_price']
            quantity = self.active_trades[trade_id]['quantity']
            
            unrealized_pnl = (current_price - entry_price) * quantity
            self.active_trades[trade_id]['unrealized_pnl'] = unrealized_pnl
            self.active_trades[trade_id]['current_price'] = current_price
            
        elif update_type == 'GREEKS_UPDATE':
            self.active_trades[trade_id]['current_greeks'] = data.get('greeks', {})
            
        elif update_type == 'ADJUSTMENT':
            self.active_trades[trade_id]['adjustments'] = self.active_trades[trade_id].get('adjustments', [])
            self.active_trades[trade_id]['adjustments'].append(data)
    
    def close_trade(self, trade_id: str, exit_price: float, exit_reason: str):
        """Close a trade and calculate final metrics"""
        if trade_id not in self.active_trades:
            return
        
        trade = self.active_trades[trade_id]
        
        # Calculate metrics
        entry_price = trade['entry_price']
        quantity = trade['quantity']
        realized_pnl = (exit_price - entry_price) * quantity
        
        # Calculate hold time
        entry_time = datetime.strptime(trade['entry_time'][:19], '%Y-%m-%d %H:%M:%S')
        hold_time = (self.algo.Time - entry_time)
        
        # Create completed trade record
        completed_trade = {
            **trade,
            'exit_time': str(self.algo.Time),
            'exit_price': exit_price,
            'exit_reason': exit_reason,
            'realized_pnl': realized_pnl,
            'hold_time_hours': hold_time.total_seconds() / 3600,
            'hold_time_days': hold_time.days,
            'win': realized_pnl > 0,
            'return_percent': (realized_pnl / (entry_price * abs(quantity))) * 100 if entry_price > 0 else 0
        }
        
        # Move to completed trades
        self.completed_trades.append(completed_trade)
        del self.active_trades[trade_id]
        
        # Update performance tracking
        self.update_performance_metrics(completed_trade)
        
        # Log closure
        self.log_trade_closure(completed_trade)
    
    def update_performance_metrics(self, trade: Dict):
        """Update various performance metrics"""
        # By hour of day
        hour = datetime.strptime(trade['entry_time'][:19], '%Y-%m-%d %H:%M:%S').hour
        self.performance_by_hour[hour]['trades'] += 1
        if trade['win']:
            self.performance_by_hour[hour]['wins'] += 1
        self.performance_by_hour[hour]['pnl'] += trade['realized_pnl']
        
        # By day of week
        day = datetime.strptime(trade['entry_time'][:10], '%Y-%m-%d').weekday()
        self.performance_by_day[day]['trades'] += 1
        if trade['win']:
            self.performance_by_day[day]['wins'] += 1
        self.performance_by_day[day]['pnl'] += trade['realized_pnl']
        
        # By pattern
        pattern = trade.get('pattern_detected', 'No Pattern')
        self.performance_by_pattern[pattern]['trades'] += 1
        if trade['win']:
            self.performance_by_pattern[pattern]['wins'] += 1
        self.performance_by_pattern[pattern]['pnl'] += trade['realized_pnl']
    
    def log_trade_closure(self, trade: Dict):
        """Log trade closure with summary"""
        emoji = "[WARNING]" if trade['win'] else "[WARNING]"
        
        summary = f"""
{emoji} TRADE CLOSED: {trade['strategy']} - {trade['symbol']}
   Entry: ${trade['entry_price']:.2f} → Exit: ${trade['exit_price']:.2f}
   P&L: ${trade['realized_pnl']:+,.2f} ({trade['return_percent']:+.2f}%)
   Hold Time: {trade['hold_time_days']}d {trade['hold_time_hours']%24:.1f}h
   Exit Reason: {trade['exit_reason']}
"""
        
        self.algo.Log(summary)
    
    def get_active_trades_summary(self) -> str:
        """Get summary of all active trades"""
        if not self.active_trades:
            return "No active trades"
        
        summary = "[WARNING] ACTIVE TRADES:\n"
        
        for trade_id, trade in self.active_trades.items():
            unrealized = trade.get('unrealized_pnl', 0)
            pnl_emoji = "[PROFIT]" if unrealized >= 0 else "[LOSS]"
            
            summary += f"""
{pnl_emoji} {trade['strategy']} - {trade['symbol']}
   Entry: ${trade['entry_price']:.2f} | Current: ${trade.get('current_price', 0):.2f}
   Unrealized P&L: ${unrealized:+,.2f}
   Pattern: {trade.get('pattern_detected', 'None')}
"""
        
        return summary
    
    def get_performance_analysis(self) -> str:
        """Get detailed performance analysis"""
        analysis = """
[WARNING]
[WARNING]                   PERFORMANCE ANALYSIS                        [WARNING]
[WARNING]
"""
        
        # Best hours to trade
        analysis += "\n[WARNING] PERFORMANCE BY HOUR:\n"
        best_hours = sorted(self.performance_by_hour.items(), 
                          key=lambda x: x[1]['pnl'], reverse=True)[:3]
        
        for hour, metrics in best_hours:
            if metrics['trades'] > 0:
                win_rate = (metrics['wins'] / metrics['trades']) * 100
                analysis += f"   {hour:02d}:00 - Win Rate: {win_rate:.1f}% | P&L: ${metrics['pnl']:+,.2f}\n"
        
        # Best days to trade
        analysis += "\n[WARNING] PERFORMANCE BY DAY:\n"
        days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
        for day_num, day_name in enumerate(days):
            if day_num in self.performance_by_day:
                metrics = self.performance_by_day[day_num]
                if metrics['trades'] > 0:
                    win_rate = (metrics['wins'] / metrics['trades']) * 100
                    analysis += f"   {day_name}: Win Rate: {win_rate:.1f}% | P&L: ${metrics['pnl']:+,.2f}\n"
        
        # Best patterns
        analysis += "\n[WARNING] PERFORMANCE BY PATTERN:\n"
        best_patterns = sorted(self.performance_by_pattern.items(),
                             key=lambda x: x[1]['pnl'], reverse=True)[:3]
        
        for pattern, metrics in best_patterns:
            if metrics['trades'] > 0:
                win_rate = (metrics['wins'] / metrics['trades']) * 100
                analysis += f"   {pattern}: Win Rate: {win_rate:.1f}% | P&L: ${metrics['pnl']:+,.2f}\n"
        
        return analysis
    
    def get_rejection_analysis(self) -> str:
        """Analyze why trades were rejected"""
        rejections = defaultdict(int)
        
        for evaluation in self.trade_stages.values():
            if evaluation['decision'] == 'REJECTED':
                reason = evaluation.get('rejection_reason', 'Unknown')
                stage = reason.split(':')[0] if ':' in reason else reason
                rejections[stage] += 1
        
        if not rejections:
            return "No rejected trades to analyze"
        
        analysis = "[WARNING] REJECTION ANALYSIS:\n"
        for reason, count in sorted(rejections.items(), key=lambda x: x[1], reverse=True):
            analysis += f"   {reason}: {count} rejections\n"
        
        return analysis
    
    def save_trade_history(self):
        """Save trade history to ObjectStore"""
        history = {
            'active_trades': self.active_trades,
            'completed_trades': self.completed_trades[-100:],  # Keep last 100
            'performance_by_hour': dict(self.performance_by_hour),
            'performance_by_day': dict(self.performance_by_day),
            'performance_by_pattern': dict(self.performance_by_pattern),
            'timestamp': str(self.algo.Time)
        }
        
        self.algo.ObjectStore.Save('trade_history', json.dumps(history))


# USAGE:
# def execute_strategy(self):
#     trade_id = self.trade_logger.start_trade_evaluation("0DTE", symbol)
#     
#     # Log each evaluation stage
#     self.trade_logger.log_evaluation_stage(
#         trade_id, "MARKET_CHECK", 
#         {"is_open": True}, 
#         passed=True,
#         notes="Market is open"
#     )
#     
#     self.trade_logger.log_evaluation_stage(
#         trade_id, "VIX_CHECK",
#         {"vix": 18, "threshold": 30},
#         passed=True,
#         notes="VIX below threshold"
#     )
#     
#     # Complete evaluation
#     self.trade_logger.complete_evaluation(
#         trade_id, 
#         executed=True,
#         entry_data={'price': 450, 'quantity': 1, 'type': 'Iron Condor'}
#     )