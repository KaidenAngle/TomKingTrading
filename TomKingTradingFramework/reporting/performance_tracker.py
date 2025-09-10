# Performance Tracking and Reporting Module for LEAN
# Comprehensive metrics tracking per Tom King methodology
from AlgorithmImports import *
from datetime import datetime, timedelta
import json

class PerformanceTracker:
    def __init__(self, algorithm):
        self.algo = algorithm
        self.start_date = algorithm.Time
        self.starting_capital = algorithm.Portfolio.TotalPortfolioValue
        
        # Trade tracking
        self.trades = []
        self.monthly_returns = {}
        self.daily_pnl = {}
        self.win_streaks = []
        self.loss_streaks = []
        self.current_streak = 0
        self.max_drawdown = 0
        self.peak_value = self.starting_capital
        
        # Strategy performance
        self.strategy_performance = {
            'FRIDAY_0DTE': {'wins': 0, 'losses': 0, 'total_pnl': 0},
            'LONG_TERM_112': {'wins': 0, 'losses': 0, 'total_pnl': 0},
            'FUTURES_STRANGLES': {'wins': 0, 'losses': 0, 'total_pnl': 0},
            'IPMCC': {'wins': 0, 'losses': 0, 'total_pnl': 0},
            'LEAP_PUT_LADDERS': {'wins': 0, 'losses': 0, 'total_pnl': 0}
        }
    
    def RecordTrade(self, trade_info: dict):
        """Record completed trade for analysis"""
        trade = {
            'entry_time': trade_info.get('entry_time'),
            'exit_time': self.algo.Time,
            'symbol': trade_info.get('symbol'),
            'strategy': trade_info.get('strategy'),
            'entry_price': trade_info.get('entry_price'),
            'exit_price': trade_info.get('exit_price'),
            'quantity': trade_info.get('quantity', 1),
            'pnl': trade_info.get('pnl', 0),
            'pnl_pct': trade_info.get('pnl_pct', 0),
            'win': trade_info.get('pnl', 0) > 0,
            'dte_at_entry': trade_info.get('dte_at_entry'),
            'dte_at_exit': trade_info.get('dte_at_exit'),
            'vix_at_entry': trade_info.get('vix_at_entry'),
            'vix_at_exit': self.algo.Securities["VIX"].Price
        }
        
        self.trades.append(trade)
        
        # Update strategy performance
        strategy = trade['strategy']
        if strategy in self.strategy_performance:
            if trade['win']:
                self.strategy_performance[strategy]['wins'] += 1
            else:
                self.strategy_performance[strategy]['losses'] += 1
            self.strategy_performance[strategy]['total_pnl'] += trade['pnl']
        
        # Update streaks
        if trade['win']:
            if self.current_streak >= 0:
                self.current_streak += 1
            else:
                self.loss_streaks.append(abs(self.current_streak))
                self.current_streak = 1
        else:
            if self.current_streak <= 0:
                self.current_streak -= 1
            else:
                self.win_streaks.append(self.current_streak)
                self.current_streak = -1
    
    def UpdateDaily(self):
        """Update daily performance metrics"""
        current_value = self.algo.Portfolio.TotalPortfolioValue
        date_str = self.algo.Time.strftime('%Y-%m-%d')
        
        # Calculate daily P&L
        if len(self.daily_pnl) > 0:
            last_value = list(self.daily_pnl.values())[-1]['portfolio_value']
            daily_change = current_value - last_value
            daily_pct = (daily_change / last_value) * 100
        else:
            daily_change = current_value - self.starting_capital
            daily_pct = (daily_change / self.starting_capital) * 100
        
        self.daily_pnl[date_str] = {
            'portfolio_value': current_value,
            'daily_pnl': daily_change,
            'daily_pct': daily_pct,
            'cumulative_pnl': current_value - self.starting_capital
        }
        
        # Update drawdown
        if current_value > self.peak_value:
            self.peak_value = current_value
        else:
            drawdown = (self.peak_value - current_value) / self.peak_value
            if drawdown > self.max_drawdown:
                self.max_drawdown = drawdown
    
    def UpdateMonthly(self):
        """Calculate monthly returns"""
        current_value = self.algo.Portfolio.TotalPortfolioValue
        month_str = self.algo.Time.strftime('%Y-%m')
        
        # Get starting value for the month
        if month_str not in self.monthly_returns:
            if len(self.monthly_returns) > 0:
                # Use last month's ending value
                last_month = list(self.monthly_returns.values())[-1]
                month_start = last_month['ending_value']
            else:
                month_start = self.starting_capital
            
            self.monthly_returns[month_str] = {
                'starting_value': month_start,
                'ending_value': current_value,
                'return_pct': ((current_value - month_start) / month_start) * 100,
                'trades': 0,
                'wins': 0,
                'losses': 0
            }
        else:
            # Update existing month
            self.monthly_returns[month_str]['ending_value'] = current_value
            month_start = self.monthly_returns[month_str]['starting_value']
            self.monthly_returns[month_str]['return_pct'] = ((current_value - month_start) / month_start) * 100
    
    def GetPerformanceMetrics(self) -> dict:
        """Get comprehensive performance metrics"""
        current_value = self.algo.Portfolio.TotalPortfolioValue
        total_return = ((current_value - self.starting_capital) / self.starting_capital) * 100
        
        # Calculate win rate
        total_trades = len(self.trades)
        winning_trades = sum(1 for t in self.trades if t['win'])
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # Calculate average win/loss
        wins = [t['pnl'] for t in self.trades if t['win']]
        losses = [t['pnl'] for t in self.trades if not t['win']]
        avg_win = sum(wins) / len(wins) if wins else 0
        avg_loss = sum(losses) / len(losses) if losses else 0
        
        # Calculate profit factor
        gross_profit = sum(wins) if wins else 0
        gross_loss = abs(sum(losses)) if losses else 1
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else 0
        
        # Calculate Sharpe ratio (simplified)
        if len(self.daily_pnl) > 1:
            daily_returns = [d['daily_pct'] for d in self.daily_pnl.values()]
            avg_daily_return = sum(daily_returns) / len(daily_returns)
            daily_std = self.CalculateStdDev(daily_returns)
            sharpe_ratio = (avg_daily_return * 252) / (daily_std * (252 ** 0.5)) if daily_std > 0 else 0
        else:
            sharpe_ratio = 0
        
        return {
            'total_return_pct': total_return,
            'total_return_dollars': current_value - self.starting_capital,
            'current_value': current_value,
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': total_trades - winning_trades,
            'win_rate': win_rate,
            'average_win': avg_win,
            'average_loss': avg_loss,
            'profit_factor': profit_factor,
            'max_drawdown_pct': self.max_drawdown * 100,
            'sharpe_ratio': sharpe_ratio,
            'best_streak': max(self.win_streaks) if self.win_streaks else 0,
            'worst_streak': max(self.loss_streaks) if self.loss_streaks else 0,
            'current_streak': self.current_streak
        }
    
    def CalculateStdDev(self, values: list) -> float:
        """Calculate standard deviation"""
        if len(values) < 2:
            return 0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        return variance ** 0.5
    
    def GetStrategyReport(self) -> dict:
        """Get performance by strategy"""
        report = {}
        
        for strategy, data in self.strategy_performance.items():
            total = data['wins'] + data['losses']
            if total > 0:
                win_rate = (data['wins'] / total) * 100
                avg_pnl = data['total_pnl'] / total
            else:
                win_rate = 0
                avg_pnl = 0
            
            report[strategy] = {
                'total_trades': total,
                'wins': data['wins'],
                'losses': data['losses'],
                'win_rate': win_rate,
                'total_pnl': data['total_pnl'],
                'average_pnl': avg_pnl
            }
        
        return report
    
    def GenerateReport(self) -> str:
        """Generate comprehensive performance report"""
        metrics = self.GetPerformanceMetrics()
        strategy_report = self.GetStrategyReport()
        
        report = []
        report.append("=" * 60)
        report.append("TOM KING TRADING - PERFORMANCE REPORT")
        report.append("=" * 60)
        report.append(f"Report Date: {self.algo.Time}")
        report.append(f"Starting Capital: ${self.starting_capital:,.2f}")
        report.append(f"Current Value: ${metrics['current_value']:,.2f}")
        report.append(f"Total Return: {metrics['total_return_pct']:.2f}% (${metrics['total_return_dollars']:,.2f})")
        report.append("")
        
        report.append("TRADING STATISTICS:")
        report.append(f"Total Trades: {metrics['total_trades']}")
        report.append(f"Win Rate: {metrics['win_rate']:.1f}%")
        report.append(f"Profit Factor: {metrics['profit_factor']:.2f}")
        report.append(f"Max Drawdown: {metrics['max_drawdown_pct']:.2f}%")
        report.append(f"Sharpe Ratio: {metrics['sharpe_ratio']:.2f}")
        report.append("")
        
        report.append("STRATEGY PERFORMANCE:")
        for strategy, data in strategy_report.items():
            if data['total_trades'] > 0:
                report.append(f"  {strategy}:")
                report.append(f"    Trades: {data['total_trades']} (Win Rate: {data['win_rate']:.1f}%)")
                report.append(f"    Total P&L: ${data['total_pnl']:,.2f}")
        
        report.append("")
        report.append("MONTHLY RETURNS:")
        for month, data in self.monthly_returns.items():
            report.append(f"  {month}: {data['return_pct']:.2f}%")
        
        report.append("=" * 60)
        
        return "\n".join(report)
    
    def SaveTradeJournal(self):
        """Save detailed trade journal"""
        journal = {
            'generated': self.algo.Time.strftime('%Y-%m-%d %H:%M:%S'),
            'performance_metrics': self.GetPerformanceMetrics(),
            'strategy_performance': self.GetStrategyReport(),
            'monthly_returns': self.monthly_returns,
            'trades': self.trades[-100:],  # Last 100 trades
            'current_positions': self.GetCurrentPositions()
        }
        
        # Log journal summary
        self.algo.Log(f"Trade Journal: {len(self.trades)} trades, {journal['performance_metrics']['win_rate']:.1f}% win rate")
        
        return journal
    
    def GetCurrentPositions(self) -> list:
        """Get current open positions"""
        positions = []
        
        for holding in self.algo.Portfolio.Values:
            if holding.Invested:
                positions.append({
                    'symbol': str(holding.Symbol),
                    'quantity': holding.Quantity,
                    'average_price': holding.AveragePrice,
                    'current_price': holding.Price,
                    'unrealized_pnl': holding.UnrealizedProfit,
                    'type': str(holding.Type)
                })
        
        return positions
