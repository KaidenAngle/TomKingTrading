# Tom King Trading Framework - Performance Monitoring System
# Real-time performance metrics and KPI tracking

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import numpy as np
from collections import deque, defaultdict

class PerformanceMonitor:
    """
    Comprehensive performance monitoring for Tom King Trading Framework
    
    Key Metrics:
    - Win rate by strategy (target: 88% for 0DTE, 95% for LT112)
    - Monthly income tracking (target: £1,600-1,800)
    - Drawdown monitoring (max 15%)
    - Sharpe ratio tracking (target: 2.0+)
    - VIX regime performance analysis
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Performance tracking by strategy
        self.strategy_performance = {
            'friday_0dte': {'wins': 0, 'losses': 0, 'pnl': 0.0, 'win_rate': 0.0},
            'lt112': {'wins': 0, 'losses': 0, 'pnl': 0.0, 'win_rate': 0.0},
            'ipmcc': {'wins': 0, 'losses': 0, 'pnl': 0.0, 'win_rate': 0.0},
            'futures_strangle': {'wins': 0, 'losses': 0, 'pnl': 0.0, 'win_rate': 0.0}
        }
        
        # Monthly income tracking
        self.monthly_income = defaultdict(float)
        self.current_month = None
        
        # Drawdown tracking
        self.peak_value = 0.0
        self.current_drawdown = 0.0
        self.max_drawdown = 0.0
        self.drawdown_history = deque(maxlen=252)  # 1 year of daily data
        
        # Daily returns for Sharpe calculation
        self.daily_returns = deque(maxlen=252)
        self.last_portfolio_value = None
        
        # VIX regime performance
        self.vix_regime_performance = {
            'EXTREMELY_LOW': {'trades': 0, 'pnl': 0.0},
            'LOW': {'trades': 0, 'pnl': 0.0},
            'NORMAL': {'trades': 0, 'pnl': 0.0},
            'ELEVATED': {'trades': 0, 'pnl': 0.0},
            'HIGH': {'trades': 0, 'pnl': 0.0},
            'EXTREME': {'trades': 0, 'pnl': 0.0}
        }
        
        # Real-time metrics
        self.metrics_cache = {
            'total_pnl': 0.0,
            'win_rate': 0.0,
            'sharpe_ratio': 0.0,
            'sortino_ratio': 0.0,
            'profit_factor': 0.0,
            'average_win': 0.0,
            'average_loss': 0.0,
            'largest_win': 0.0,
            'largest_loss': 0.0,
            'consecutive_wins': 0,
            'consecutive_losses': 0,
            'max_consecutive_wins': 0,
            'max_consecutive_losses': 0
        }
        
        # Performance targets (Tom King specifications)
        self.targets = {
            'monthly_income': 1700,  # £1,700 target (middle of £1,600-1,800)
            'win_rate_0dte': 0.88,
            'win_rate_lt112': 0.95,
            'max_drawdown': 0.15,
            'sharpe_ratio': 2.0,
            'annual_return': 1.28  # 128% annual target
        }
        
        self.algorithm.Log("✅ PERFORMANCE MONITOR INITIALIZED")
    
    def UpdateTrade(self, strategy: str, pnl: float, is_win: bool):
        """Update performance metrics for a completed trade"""
        try:
            # Update strategy performance
            if strategy in self.strategy_performance:
                if is_win:
                    self.strategy_performance[strategy]['wins'] += 1
                    self.metrics_cache['consecutive_wins'] += 1
                    self.metrics_cache['consecutive_losses'] = 0
                else:
                    self.strategy_performance[strategy]['losses'] += 1
                    self.metrics_cache['consecutive_losses'] += 1
                    self.metrics_cache['consecutive_wins'] = 0
                
                self.strategy_performance[strategy]['pnl'] += pnl
                
                # Update win rate
                total_trades = (self.strategy_performance[strategy]['wins'] + 
                              self.strategy_performance[strategy]['losses'])
                if total_trades > 0:
                    self.strategy_performance[strategy]['win_rate'] = (
                        self.strategy_performance[strategy]['wins'] / total_trades
                    )
            
            # Update overall metrics
            self.metrics_cache['total_pnl'] += pnl
            
            # Update largest win/loss
            if pnl > 0:
                self.metrics_cache['largest_win'] = max(
                    self.metrics_cache['largest_win'], pnl
                )
            else:
                self.metrics_cache['largest_loss'] = min(
                    self.metrics_cache['largest_loss'], pnl
                )
            
            # Update consecutive records
            self.metrics_cache['max_consecutive_wins'] = max(
                self.metrics_cache['max_consecutive_wins'],
                self.metrics_cache['consecutive_wins']
            )
            self.metrics_cache['max_consecutive_losses'] = max(
                self.metrics_cache['max_consecutive_losses'],
                self.metrics_cache['consecutive_losses']
            )
            
            # Update monthly income
            current_month = self.algorithm.Time.strftime('%Y-%m')
            self.monthly_income[current_month] += pnl
            
            # Update VIX regime performance
            vix_regime = self._get_current_vix_regime()
            if vix_regime in self.vix_regime_performance:
                self.vix_regime_performance[vix_regime]['trades'] += 1
                self.vix_regime_performance[vix_regime]['pnl'] += pnl
            
        except Exception as e:
            self.algorithm.Error(f"Error updating trade performance: {str(e)}")
    
    def UpdateDaily(self):
        """Update daily performance metrics"""
        try:
            current_value = self.algorithm.Portfolio.TotalPortfolioValue
            
            # Update drawdown
            if current_value > self.peak_value:
                self.peak_value = current_value
            
            if self.peak_value > 0:
                self.current_drawdown = (self.peak_value - current_value) / self.peak_value
                self.max_drawdown = max(self.max_drawdown, self.current_drawdown)
                self.drawdown_history.append(self.current_drawdown)
            
            # Calculate daily return
            if self.last_portfolio_value is not None and self.last_portfolio_value > 0:
                daily_return = (current_value - self.last_portfolio_value) / self.last_portfolio_value
                self.daily_returns.append(daily_return)
                
                # Update Sharpe ratio
                if len(self.daily_returns) >= 20:  # Need at least 20 days
                    self._calculate_risk_metrics()
            
            self.last_portfolio_value = current_value
            
            # Calculate overall win rate
            self._calculate_overall_metrics()
            
        except Exception as e:
            self.algorithm.Error(f"Error updating daily performance: {str(e)}")
    
    def _calculate_risk_metrics(self):
        """Calculate Sharpe and Sortino ratios"""
        try:
            returns = np.array(self.daily_returns)
            
            # Sharpe Ratio (annualized)
            if len(returns) > 0:
                mean_return = np.mean(returns)
                std_return = np.std(returns)
                if std_return > 0:
                    self.metrics_cache['sharpe_ratio'] = (
                        np.sqrt(252) * mean_return / std_return
                    )
                
                # Sortino Ratio (downside deviation)
                negative_returns = returns[returns < 0]
                if len(negative_returns) > 0:
                    downside_std = np.std(negative_returns)
                    if downside_std > 0:
                        self.metrics_cache['sortino_ratio'] = (
                            np.sqrt(252) * mean_return / downside_std
                        )
        except Exception as e:
            self.algorithm.Error(f"Error calculating risk metrics: {str(e)}")
    
    def _calculate_overall_metrics(self):
        """Calculate overall performance metrics"""
        try:
            total_wins = sum(s['wins'] for s in self.strategy_performance.values())
            total_losses = sum(s['losses'] for s in self.strategy_performance.values())
            total_trades = total_wins + total_losses
            
            if total_trades > 0:
                self.metrics_cache['win_rate'] = total_wins / total_trades
            
            # Calculate profit factor
            total_win_pnl = sum(
                s['pnl'] for s in self.strategy_performance.values() 
                if s['pnl'] > 0
            )
            total_loss_pnl = abs(sum(
                s['pnl'] for s in self.strategy_performance.values() 
                if s['pnl'] < 0
            ))
            
            if total_loss_pnl > 0:
                self.metrics_cache['profit_factor'] = total_win_pnl / total_loss_pnl
            
            # Calculate average win/loss
            if total_wins > 0:
                self.metrics_cache['average_win'] = total_win_pnl / total_wins
            
            if total_losses > 0:
                self.metrics_cache['average_loss'] = total_loss_pnl / total_losses
                
        except Exception as e:
            self.algorithm.Error(f"Error calculating overall metrics: {str(e)}")
    
    def _get_current_vix_regime(self) -> str:
        """Get current VIX regime"""
        try:
            if "VIX" in self.algorithm.Securities:
                vix = self.algorithm.Securities["VIX"].Price
                if vix < 12:
                    return "EXTREMELY_LOW"
                elif vix < 16:
                    return "LOW"
                elif vix < 20:
                    return "NORMAL"
                elif vix < 25:
                    return "ELEVATED"
                elif vix < 35:
                    return "HIGH"
                else:
                    return "EXTREME"
        except Exception as e:
            self.algorithm.Debug(f"Error getting VIX regime: {str(e)}")
            # Return default regime on error
        return "NORMAL"
    
    def GetPerformanceSummary(self) -> Dict:
        """Get comprehensive performance summary"""
        return {
            'strategies': self.strategy_performance,
            'metrics': self.metrics_cache,
            'drawdown': {
                'current': self.current_drawdown,
                'maximum': self.max_drawdown
            },
            'monthly_income': dict(self.monthly_income),
            'vix_regime_performance': self.vix_regime_performance,
            'target_comparison': self._compare_to_targets()
        }
    
    def _compare_to_targets(self) -> Dict:
        """Compare current performance to targets"""
        current_month = self.algorithm.Time.strftime('%Y-%m')
        
        return {
            'monthly_income_vs_target': {
                'current': self.monthly_income.get(current_month, 0),
                'target': self.targets['monthly_income'],
                'on_track': self.monthly_income.get(current_month, 0) >= self.targets['monthly_income']
            },
            'win_rate_0dte': {
                'current': self.strategy_performance['friday_0dte']['win_rate'],
                'target': self.targets['win_rate_0dte'],
                'on_track': self.strategy_performance['friday_0dte']['win_rate'] >= self.targets['win_rate_0dte']
            },
            'win_rate_lt112': {
                'current': self.strategy_performance['lt112']['win_rate'],
                'target': self.targets['win_rate_lt112'],
                'on_track': self.strategy_performance['lt112']['win_rate'] >= self.targets['win_rate_lt112']
            },
            'drawdown': {
                'current': self.current_drawdown,
                'maximum': self.max_drawdown,
                'limit': self.targets['max_drawdown'],
                'within_limit': self.max_drawdown <= self.targets['max_drawdown']
            },
            'sharpe_ratio': {
                'current': self.metrics_cache['sharpe_ratio'],
                'target': self.targets['sharpe_ratio'],
                'on_track': self.metrics_cache['sharpe_ratio'] >= self.targets['sharpe_ratio']
            }
        }
    
    def LogPerformanceReport(self):
        """Log detailed performance report"""
        try:
            summary = self.GetPerformanceSummary()
            
            self.algorithm.Log("=" * 60)
            self.algorithm.Log("PERFORMANCE MONITOR REPORT")
            self.algorithm.Log("=" * 60)
            
            # Strategy Performance
            self.algorithm.Log("STRATEGY PERFORMANCE:")
            for strategy, perf in summary['strategies'].items():
                self.algorithm.Log(f"  {strategy}:")
                self.algorithm.Log(f"    Win Rate: {perf['win_rate']:.1%}")
                self.algorithm.Log(f"    P&L: £{perf['pnl']:.2f}")
                self.algorithm.Log(f"    Trades: {perf['wins'] + perf['losses']}")
            
            # Overall Metrics
            self.algorithm.Log("\nOVERALL METRICS:")
            self.algorithm.Log(f"  Total P&L: £{summary['metrics']['total_pnl']:.2f}")
            self.algorithm.Log(f"  Win Rate: {summary['metrics']['win_rate']:.1%}")
            self.algorithm.Log(f"  Sharpe Ratio: {summary['metrics']['sharpe_ratio']:.2f}")
            self.algorithm.Log(f"  Profit Factor: {summary['metrics']['profit_factor']:.2f}")
            self.algorithm.Log(f"  Current Drawdown: {summary['drawdown']['current']:.1%}")
            self.algorithm.Log(f"  Max Drawdown: {summary['drawdown']['maximum']:.1%}")
            
            # Target Comparison
            self.algorithm.Log("\nTARGET COMPARISON:")
            comparison = summary['target_comparison']
            
            # Monthly Income
            income_comp = comparison['monthly_income_vs_target']
            status = "✅" if income_comp['on_track'] else "⚠️"
            self.algorithm.Log(f"  {status} Monthly Income: £{income_comp['current']:.2f} / £{income_comp['target']:.2f}")
            
            # Win Rates
            dte_comp = comparison['win_rate_0dte']
            status = "✅" if dte_comp['on_track'] else "⚠️"
            self.algorithm.Log(f"  {status} 0DTE Win Rate: {dte_comp['current']:.1%} / {dte_comp['target']:.1%}")
            
            lt112_comp = comparison['win_rate_lt112']
            status = "✅" if lt112_comp['on_track'] else "⚠️"
            self.algorithm.Log(f"  {status} LT112 Win Rate: {lt112_comp['current']:.1%} / {lt112_comp['target']:.1%}")
            
            # Risk Metrics
            dd_comp = comparison['drawdown']
            status = "✅" if dd_comp['within_limit'] else "🚨"
            self.algorithm.Log(f"  {status} Drawdown: {dd_comp['current']:.1%} / {dd_comp['limit']:.1%} limit")
            
            sharpe_comp = comparison['sharpe_ratio']
            status = "✅" if sharpe_comp['on_track'] else "⚠️"
            self.algorithm.Log(f"  {status} Sharpe Ratio: {sharpe_comp['current']:.2f} / {sharpe_comp['target']:.2f}")
            
            self.algorithm.Log("=" * 60)
            
        except Exception as e:
            self.algorithm.Error(f"Error logging performance report: {str(e)}")