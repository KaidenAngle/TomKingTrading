# Tom King Trading Framework v17 - Professional Excel Reporting System
# 11-worksheet comprehensive reporting matching framework specifications
# Target: Complete professional reporting for performance tracking and analysis

from AlgorithmImports import *
from datetime import datetime, timedelta
import json
from collections import defaultdict, OrderedDict

class ExcelReporter:
    """Professional 11-worksheet Excel reporting system for Tom King Framework"""
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.report_data = {}
        self.daily_snapshots = []
        self.trade_history = []
        self.position_history = []
        self.risk_events = []
        self.performance_metrics = {}
        self.last_report_date = None
        
        # Initialize worksheet structure
        self.worksheet_structure = {
            'Executive_Dashboard': self.GenerateExecutiveDashboard,
            'Position_Tracking': self.GeneratePositionTracking,
            'Trade_History': self.GenerateTradeHistory,
            'Strategy_Performance': self.GenerateStrategyPerformance,
            'Risk_Management': self.GenerateRiskManagement,
            'Greeks_Analysis': self.GenerateGreeksAnalysis,
            'VIX_Regime_Analysis': self.GenerateVIXRegimeAnalysis,
            'Correlation_Tracking': self.GenerateCorrelationTracking,
            'Phase_Progression': self.GeneratePhaseProgression,
            'Kelly_Sizing_Analysis': self.GenerateKellySizingAnalysis,
            'Monthly_Summary': self.GenerateMonthlySummary
        }
    
    def UpdateReportData(self):
        """Update all reporting data structures with current algorithm state"""
        current_time = self.algo.Time
        
        # Daily snapshot
        daily_snapshot = {
            'date': current_time.date(),
            'portfolio_value': float(self.algo.Portfolio.TotalPortfolioValue),
            'cash': float(self.algo.Portfolio.Cash),
            'margin_used': float(self.algo.Portfolio.TotalMarginUsed),
            'unrealized_pnl': float(self.algo.Portfolio.TotalUnrealizedProfit),
            'realized_pnl': float(self.algo.Portfolio.TotalProfit),
            'positions_count': len(self.algo.active_positions),
            'vix': getattr(self.algo, 'current_vix', 20),
            'vix_regime': getattr(self.algo, 'volatility_regime', 'NORMAL'),
            'account_phase': getattr(self.algo, 'current_phase', 4),
            'correlation_heat': getattr(self.algo, 'portfolio_heat', 0),
            'kelly_fraction': getattr(self.algo, 'current_kelly_fraction', 0.25)
        }
        
        # Add Greeks data if available
        if hasattr(self.algo, 'greeks_engine'):
            greeks_summary = self.algo.greeks_engine.GetGreeksSummary()
            daily_snapshot.update({
                'total_delta': greeks_summary['portfolio_greeks']['total_delta'],
                'total_gamma': greeks_summary['portfolio_greeks']['total_gamma'],
                'total_theta': greeks_summary['portfolio_greeks']['total_theta'],
                'total_vega': greeks_summary['portfolio_greeks']['total_vega'],
                'neutrality_score': greeks_summary['neutrality_score'],
                'greeks_risk_status': greeks_summary['risk_status']
            })
        
        # Avoid duplicates
        if not self.daily_snapshots or self.daily_snapshots[-1]['date'] != current_time.date():
            self.daily_snapshots.append(daily_snapshot)
            
        # Keep only last 90 days
        cutoff_date = current_time - timedelta(days=90)
        self.daily_snapshots = [s for s in self.daily_snapshots if s['date'] >= cutoff_date.date()]
        
        # Update position tracking
        self.UpdatePositionTracking()
        
        # Update performance metrics
        self.UpdatePerformanceMetrics()
        
        self.last_report_date = current_time
    
    def UpdatePositionTracking(self):
        """Update position tracking data"""
        for position_id, position_data in self.algo.active_positions.items():
            # Calculate current position metrics
            position_snapshot = {
                'timestamp': self.algo.Time,
                'position_id': position_id,
                'strategy': position_data.get('strategy', 'UNKNOWN'),
                'symbol': position_data.get('symbol', ''),
                'entry_time': position_data.get('entry_time', self.algo.Time),
                'dte': self.CalculateCurrentDTE(position_data),
                'contracts': position_data.get('contracts', 0),
                'correlation_group': position_data.get('correlation_group', 'UNKNOWN'),
                'health_score': self.algo.position_health_scores.get(position_id, 100)
            }
            
            # Add to position history
            self.position_history.append(position_snapshot)
        
        # Keep only last 30 days
        cutoff_date = self.algo.Time - timedelta(days=30)
        self.position_history = [p for p in self.position_history if p['timestamp'] >= cutoff_date]
    
    def UpdatePerformanceMetrics(self):
        """Update comprehensive performance metrics"""
        if not self.daily_snapshots:
            return
        
        current_value = self.daily_snapshots[-1]['portfolio_value']
        starting_value = 75000  # Framework starting capital
        
        # Calculate returns
        total_return = (current_value - starting_value) / starting_value
        
        # Calculate daily returns
        daily_returns = []
        for i in range(1, len(self.daily_snapshots)):
            prev_val = self.daily_snapshots[i-1]['portfolio_value']
            curr_val = self.daily_snapshots[i]['portfolio_value']
            daily_return = (curr_val - prev_val) / prev_val if prev_val > 0 else 0
            daily_returns.append(daily_return)
        
        # Performance calculations
        self.performance_metrics = {
            'total_return': total_return,
            'current_value': current_value,
            'starting_value': starting_value,
            'days_active': len(self.daily_snapshots),
            'daily_returns': daily_returns,
            'avg_daily_return': sum(daily_returns) / len(daily_returns) if daily_returns else 0,
            'volatility': self.CalculateVolatility(daily_returns),
            'sharpe_ratio': self.CalculateSharpeRatio(daily_returns),
            'max_drawdown': self.CalculateMaxDrawdown(),
            'win_rate': self.CalculateWinRate(),
            'profit_factor': self.CalculateProfitFactor()
        }
    
    def CalculateCurrentDTE(self, position_data):
        """Calculate current days to expiration for a position"""
        entry_dte = position_data.get('dte', 45)
        days_held = (self.algo.Time - position_data.get('entry_time', self.algo.Time)).days
        return max(0, entry_dte - days_held)
    
    def CalculateVolatility(self, returns):
        """Calculate annualized volatility"""
        if len(returns) < 2:
            return 0
        
        import math
        mean_return = sum(returns) / len(returns)
        variance = sum([(r - mean_return) ** 2 for r in returns]) / (len(returns) - 1)
        daily_vol = math.sqrt(variance)
        return daily_vol * math.sqrt(252)  # Annualized
    
    def CalculateSharpeRatio(self, returns):
        """Calculate Sharpe ratio (assuming 5% risk-free rate)"""
        if not returns:
            return 0
        
        avg_return = sum(returns) / len(returns)
        volatility = self.CalculateVolatility(returns)
        
        if volatility == 0:
            return 0
        
        # Annualized excess return / volatility
        annual_return = (1 + avg_return) ** 252 - 1
        excess_return = annual_return - 0.05  # 5% risk-free rate
        
        return excess_return / volatility if volatility > 0 else 0
    
    def CalculateMaxDrawdown(self):
        """Calculate maximum drawdown from daily snapshots"""
        if len(self.daily_snapshots) < 2:
            return 0
        
        peak = self.daily_snapshots[0]['portfolio_value']
        max_drawdown = 0
        
        for snapshot in self.daily_snapshots[1:]:
            value = snapshot['portfolio_value']
            if value > peak:
                peak = value
            else:
                drawdown = (peak - value) / peak
                max_drawdown = max(max_drawdown, drawdown)
        
        return max_drawdown
    
    def CalculateWinRate(self):
        """Calculate overall win rate from strategy performance"""
        total_trades = sum(perf['trades'] for perf in self.algo.strategy_performance.values())
        total_wins = sum(perf['wins'] for perf in self.algo.strategy_performance.values())
        
        return total_wins / total_trades if total_trades > 0 else 0
    
    def CalculateProfitFactor(self):
        """Calculate profit factor (gross profit / gross loss)"""
        # Simplified calculation from daily returns
        if not self.daily_snapshots:
            return 1
        
        gross_profit = sum(max(0, (s2['portfolio_value'] - s1['portfolio_value'])) 
                          for s1, s2 in zip(self.daily_snapshots[:-1], self.daily_snapshots[1:]))
        
        gross_loss = sum(abs(min(0, (s2['portfolio_value'] - s1['portfolio_value']))) 
                        for s1, s2 in zip(self.daily_snapshots[:-1], self.daily_snapshots[1:]))
        
        return gross_profit / gross_loss if gross_loss > 0 else float('inf')
    
    def GenerateExecutiveDashboard(self):
        """Worksheet 1: Executive Dashboard - High-level KPIs"""
        if not self.performance_metrics:
            return {'error': 'No performance data available'}
        
        # Key Performance Indicators
        kpis = {
            'Portfolio_Value': self.performance_metrics['current_value'],
            'Total_Return_Pct': self.performance_metrics['total_return'] * 100,
            'Days_Active': self.performance_metrics['days_active'],
            'Sharpe_Ratio': self.performance_metrics['sharpe_ratio'],
            'Max_Drawdown_Pct': self.performance_metrics['max_drawdown'] * 100,
            'Win_Rate_Pct': self.performance_metrics['win_rate'] * 100,
            'Profit_Factor': self.performance_metrics['profit_factor'],
            'Current_Phase': self.daily_snapshots[-1]['account_phase'] if self.daily_snapshots else 4,
            'VIX_Regime': self.daily_snapshots[-1]['vix_regime'] if self.daily_snapshots else 'NORMAL'
        }
        
        # Goal Progress (£35k → £80k)
        target_value = 107000  # £80k ≈ $107k
        starting_value = 75000
        progress_pct = (self.performance_metrics['current_value'] - starting_value) / (target_value - starting_value) * 100
        
        kpis['Goal_Progress_Pct'] = min(100, max(0, progress_pct))
        kpis['Remaining_to_Goal'] = max(0, target_value - self.performance_metrics['current_value'])
        
        # Monthly performance (last 12 months)
        monthly_performance = self.GetMonthlyPerformance()
        
        return {
            'KPIs': kpis,
            'Monthly_Performance': monthly_performance,
            'Current_Positions': len(self.algo.active_positions),
            'Greeks_Summary': self.GetGreeksSummaryForDashboard()
        }
    
    def GeneratePositionTracking(self):
        """Worksheet 2: Current Position Tracking"""
        positions = []
        
        for position_id, position_data in self.algo.active_positions.items():
            current_dte = self.CalculateCurrentDTE(position_data)
            health_score = self.algo.position_health_scores.get(position_id, 100)
            
            position_record = {
                'Position_ID': position_id,
                'Strategy': position_data.get('strategy', ''),
                'Symbol': position_data.get('symbol', ''),
                'Entry_Date': position_data.get('entry_time', self.algo.Time).strftime('%Y-%m-%d'),
                'DTE': current_dte,
                'Contracts': position_data.get('contracts', 0),
                'Correlation_Group': position_data.get('correlation_group', ''),
                'Health_Score': health_score,
                'Status': self.GetPositionStatus(health_score, current_dte),
                'Profit_Target': position_data.get('profit_target', 0) * 100,
                'Stop_Loss': position_data.get('stop_loss', 0) * 100
            }
            
            positions.append(position_record)
        
        # Sort by health score (worst first)
        positions.sort(key=lambda x: x['Health_Score'])
        
        return {
            'Active_Positions': positions,
            'Total_Positions': len(positions),
            'Unhealthy_Positions': len([p for p in positions if p['Health_Score'] < 50]),
            'Expiring_Soon': len([p for p in positions if p['DTE'] <= 21])
        }
    
    def GenerateTradeHistory(self):
        """Worksheet 3: Complete Trade History"""
        trades = []
        
        # Get closed trades from strategy performance
        for strategy, perf in self.algo.strategy_performance.items():
            if perf['trades'] > 0:
                # This is simplified - in production would track individual trades
                avg_pnl = perf['total_pnl'] / perf['trades'] if perf['trades'] > 0 else 0
                win_rate = perf['wins'] / perf['trades'] if perf['trades'] > 0 else 0
                
                trade_summary = {
                    'Strategy': strategy,
                    'Total_Trades': perf['trades'],
                    'Winning_Trades': perf['wins'],
                    'Losing_Trades': perf['trades'] - perf['wins'],
                    'Win_Rate_Pct': win_rate * 100,
                    'Total_PnL': perf['total_pnl'],
                    'Avg_PnL_Per_Trade': avg_pnl
                }
                
                trades.append(trade_summary)
        
        return {
            'Trade_Summary_By_Strategy': trades,
            'Total_Trades_All': sum(t['Total_Trades'] for t in trades),
            'Overall_Win_Rate': self.performance_metrics.get('win_rate', 0) * 100
        }
    
    def GenerateStrategyPerformance(self):
        """Worksheet 4: Individual Strategy Performance Analysis"""
        strategy_analysis = {}
        
        for strategy, perf in self.algo.strategy_performance.items():
            if perf['trades'] > 0:
                win_rate = perf['wins'] / perf['trades']
                avg_pnl = perf['total_pnl'] / perf['trades']
                
                # Strategy-specific targets
                targets = self.GetStrategyTargets(strategy)
                
                analysis = {
                    'Strategy_Name': strategy,
                    'Total_Trades': perf['trades'],
                    'Win_Rate_Pct': win_rate * 100,
                    'Target_Win_Rate_Pct': targets['win_rate'] * 100,
                    'Win_Rate_vs_Target': (win_rate - targets['win_rate']) * 100,
                    'Total_PnL': perf['total_pnl'],
                    'Avg_PnL_Per_Trade': avg_pnl,
                    'ROI_Contribution_Pct': (perf['total_pnl'] / 75000) * 100 if perf['total_pnl'] != 0 else 0,
                    'Performance_Rating': self.GetPerformanceRating(win_rate, targets['win_rate'])
                }
                
                strategy_analysis[strategy] = analysis
        
        return strategy_analysis
    
    def GenerateRiskManagement(self):
        """Worksheet 5: Risk Management Analysis"""
        risk_metrics = {
            'Current_Portfolio_Heat': getattr(self.algo, 'portfolio_heat', 0) * 100,
            'Max_Drawdown_Pct': self.performance_metrics.get('max_drawdown', 0) * 100,
            'VIX_Current': getattr(self.algo, 'current_vix', 20),
            'VIX_Regime': getattr(self.algo, 'volatility_regime', 'NORMAL'),
            'Buying_Power_Used_Pct': self.algo.GetBuyingPowerUsedPercent() * 100,
            'Max_BP_Allowed_Pct': self.algo.GetMaxBPForVIX() * 100,
            'Emergency_Exits': len(getattr(self.algo, 'emergency_exits', [])),
            'Position_Warnings': len(getattr(self.algo, 'position_warnings', [])),
            'Crash_Protection_Active': getattr(self.algo, 'crash_protection_active', True)
        }
        
        # Correlation group analysis
        correlation_analysis = {}
        for group, positions in self.algo.correlation_positions.items():
            correlation_analysis[group] = {
                'Active_Positions': len(positions),
                'Max_Allowed': self.algo.max_correlation_positions,
                'Utilization_Pct': (len(positions) / self.algo.max_correlation_positions) * 100,
                'Available_Slots': self.algo.max_correlation_positions - len(positions)
            }
        
        return {
            'Risk_Metrics': risk_metrics,
            'Correlation_Analysis': correlation_analysis,
            'Risk_History': self.GetRiskHistory()
        }
    
    def GenerateGreeksAnalysis(self):
        """Worksheet 6: Greeks Portfolio Analysis"""
        if not hasattr(self.algo, 'greeks_engine'):
            return {'error': 'Greeks engine not available'}
        
        greeks_summary = self.algo.greeks_engine.GetGreeksSummary()
        
        # Portfolio Greeks
        portfolio_greeks = {
            'Total_Delta': greeks_summary['portfolio_greeks']['total_delta'],
            'Total_Gamma': greeks_summary['portfolio_greeks']['total_gamma'],
            'Daily_Theta': greeks_summary['portfolio_greeks']['total_theta'],
            'Total_Vega': greeks_summary['portfolio_greeks']['total_vega'],
            'Delta_Dollar_Exposure': greeks_summary['delta_dollar'],
            'Annualized_Theta': greeks_summary['theta_annualized'],
            'Neutrality_Score': greeks_summary['neutrality_score'],
            'Risk_Status': greeks_summary['risk_status']
        }
        
        # Strategy breakdown
        strategy_greeks = greeks_summary.get('strategy_breakdown', {})
        
        # Risk levels
        risk_assessment = {
            'Delta_Risk': 'HIGH' if abs(portfolio_greeks['Total_Delta']) > 75 else 'MEDIUM' if abs(portfolio_greeks['Total_Delta']) > 40 else 'LOW',
            'Gamma_Risk': greeks_summary.get('gamma_risk_level', 'LOW'),
            'Vega_Risk': greeks_summary.get('vega_risk_level', 'LOW'),
            'Theta_Income_Level': 'HIGH' if portfolio_greeks['Daily_Theta'] > 150 else 'MEDIUM' if portfolio_greeks['Daily_Theta'] > 75 else 'LOW'
        }
        
        return {
            'Portfolio_Greeks': portfolio_greeks,
            'Strategy_Greeks': strategy_greeks,
            'Risk_Assessment': risk_assessment,
            'Active_Alerts': len(greeks_summary.get('alerts', [])),
            'Adjustment_Suggestions': self.algo.greeks_engine.SuggestGreeksAdjustments()[:3]  # Top 3
        }
    
    def GenerateVIXRegimeAnalysis(self):
        """Worksheet 7: VIX Regime Analysis"""
        vix_history = getattr(self.algo, 'vix_history', [20] * 10)
        current_vix = getattr(self.algo, 'current_vix', 20)
        current_regime = getattr(self.algo, 'volatility_regime', 'NORMAL')
        
        # VIX statistics
        vix_stats = {
            'Current_VIX': current_vix,
            'Current_Regime': current_regime,
            'VIX_30_Day_Avg': sum(vix_history[-30:]) / min(30, len(vix_history)) if vix_history else 20,
            'VIX_High_30_Day': max(vix_history[-30:]) if vix_history else current_vix,
            'VIX_Low_30_Day': min(vix_history[-30:]) if vix_history else current_vix,
            'Regime_Changes': getattr(self.algo, 'regime_change_count', 0)
        }
        
        # Regime-based position limits
        regime_limits = {
            'Current_Max_BP_Pct': self.algo.GetMaxBPForVIX() * 100,
            'Position_Multiplier': self.algo.GetVIXPositionMultiplier(),
            'Emergency_Threshold': getattr(self.algo, 'emergency_vix_threshold', 35)
        }
        
        # Performance by regime (simplified)
        regime_performance = self.GetPerformanceByRegime()
        
        return {
            'VIX_Statistics': vix_stats,
            'Regime_Limits': regime_limits,
            'Performance_By_Regime': regime_performance
        }
    
    def GenerateCorrelationTracking(self):
        """Worksheet 8: Correlation Group Tracking"""
        correlation_data = {}
        
        for group, positions in self.algo.correlation_positions.items():
            group_symbols = self.algo.CORRELATION_GROUPS.get(group, [])
            
            correlation_data[group] = {
                'Group_Name': group,
                'Symbols_In_Group': group_symbols,
                'Active_Positions': len(positions),
                'Max_Allowed': self.algo.max_correlation_positions,
                'Available_Slots': self.algo.max_correlation_positions - len(positions),
                'Utilization_Pct': (len(positions) / self.algo.max_correlation_positions) * 100,
                'Status': 'FULL' if len(positions) >= self.algo.max_correlation_positions else 'AVAILABLE',
                'Position_IDs': positions
            }
        
        # Overall correlation health
        total_violations = getattr(self.algo, 'correlation_violations', 0)
        
        return {
            'Correlation_Groups': correlation_data,
            'Total_Violations': total_violations,
            'August_2024_Protection': getattr(self.algo, 'crash_protection_active', True)
        }
    
    def GeneratePhaseProgression(self):
        """Worksheet 9: Account Phase Progression Analysis"""
        current_phase = getattr(self.algo, 'current_phase', 4)
        current_value = self.performance_metrics.get('current_value', 75000)
        
        # Phase definitions
        phases = {
            1: {'min': 30000, 'max': 40000, 'label': 'Phase 1 (£30-40k)', 'usd_max': 53000},
            2: {'min': 40000, 'max': 60000, 'label': 'Phase 2 (£40-60k)', 'usd_max': 80000},
            3: {'min': 60000, 'max': 75000, 'label': 'Phase 3 (£60-75k)', 'usd_max': 100000},
            4: {'min': 75000, 'max': 1000000, 'label': 'Phase 4 (£75k+)', 'usd_max': float('inf')}
        }
        
        phase_analysis = {
            'Current_Phase': current_phase,
            'Current_Phase_Label': phases[current_phase]['label'],
            'Portfolio_Value': current_value,
            'Next_Phase_Requirement': phases[min(4, current_phase + 1)]['min'] if current_phase < 4 else None,
            'Progress_In_Current_Phase': self.CalculatePhaseProgress(current_value, current_phase, phases)
        }
        
        # Strategy availability by phase
        strategy_availability = {
            'Phase_1': ['IRON_CONDOR_0DTE', 'LT112'],
            'Phase_2': ['IRON_CONDOR_0DTE', 'LT112', 'FUTURES_STRANGLE'],
            'Phase_3': ['IRON_CONDOR_0DTE', 'LT112', 'FUTURES_STRANGLE', 'IPMCC'],
            'Phase_4': ['IRON_CONDOR_0DTE', 'LT112', 'FUTURES_STRANGLE', 'IPMCC', 'LEAP_LADDER']
        }
        
        return {
            'Phase_Analysis': phase_analysis,
            'Phase_Definitions': phases,
            'Available_Strategies': strategy_availability[f'Phase_{current_phase}'],
            'Goal_Progress': {
                'Target_Value': 107000,  # £80k
                'Current_Value': current_value,
                'Remaining': 107000 - current_value,
                'Progress_Pct': min(100, (current_value - 75000) / (107000 - 75000) * 100)
            }
        }
    
    def GenerateKellySizingAnalysis(self):
        """Worksheet 10: Kelly Criterion Sizing Analysis"""
        current_kelly = getattr(self.algo, 'current_kelly_fraction', 0.25)
        
        # Kelly analysis by strategy
        kelly_analysis = {}
        
        for strategy, perf in self.algo.strategy_performance.items():
            if perf['trades'] > 0:
                win_rate = perf['wins'] / perf['trades']
                # Calculate actual average win/loss from performance data
                avg_win = perf.get('avg_win_percent', 0.50)  # Use actual data or Tom King's typical 50%
                avg_loss = abs(perf.get('avg_loss_percent', -0.30))  # Use actual data or typical 30%
                win_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 0
                
                # Kelly calculation
                kelly_full = self.CalculateKellyFraction(win_rate, win_loss_ratio)
                kelly_fractional = kelly_full * 0.25  # 25% fractional Kelly
                
                kelly_analysis[strategy] = {
                    'Win_Rate': win_rate * 100,
                    'Win_Loss_Ratio': win_loss_ratio,
                    'Kelly_Full_Pct': kelly_full * 100,
                    'Kelly_Fractional_Pct': kelly_fractional * 100,
                    'Current_Usage_Pct': self.GetCurrentKellyUsage(strategy) * 100,
                    'Recommendation': self.GetKellySizingRecommendation(strategy, kelly_fractional)
                }
        
        return {
            'Kelly_Analysis_By_Strategy': kelly_analysis,
            'Current_Kelly_Fraction': current_kelly,
            'Portfolio_Kelly_Health': self.AssessKellyHealth()
        }
    
    def GenerateMonthlySummary(self):
        """Worksheet 11: Monthly Performance Summary"""
        monthly_data = self.GetMonthlyPerformance()
        
        # Calculate monthly statistics
        monthly_returns = [month['return_pct'] for month in monthly_data if 'return_pct' in month]
        
        monthly_stats = {
            'Total_Months': len(monthly_data),
            'Positive_Months': len([r for r in monthly_returns if r > 0]),
            'Negative_Months': len([r for r in monthly_returns if r < 0]),
            'Best_Month_Pct': max(monthly_returns) if monthly_returns else 0,
            'Worst_Month_Pct': min(monthly_returns) if monthly_returns else 0,
            'Avg_Monthly_Return_Pct': sum(monthly_returns) / len(monthly_returns) if monthly_returns else 0,
            'Monthly_Win_Rate_Pct': (len([r for r in monthly_returns if r > 0]) / len(monthly_returns)) * 100 if monthly_returns else 0
        }
        
        return {
            'Monthly_Data': monthly_data,
            'Monthly_Statistics': monthly_stats,
            'Target_Monthly_Return_Pct': 10,  # Tom King target: 8-12%
            'Months_Above_Target': len([r for r in monthly_returns if r >= 8])
        }
    
    def GetFullReport(self):
        """Generate complete 11-worksheet report"""
        self.UpdateReportData()
        
        full_report = {
            'Report_Generated': self.algo.Time.strftime('%Y-%m-%d %H:%M:%S'),
            'Framework_Version': 'Tom King v17 Enhanced',
            'Account_Status': {
                'Portfolio_Value': self.performance_metrics.get('current_value', 75000),
                'Phase': getattr(self.algo, 'current_phase', 4),
                'VIX_Regime': getattr(self.algo, 'volatility_regime', 'NORMAL')
            }
        }
        
        # Generate all worksheets
        for worksheet_name, generator_func in self.worksheet_structure.items():
            try:
                full_report[worksheet_name] = generator_func()
            except Exception as e:
                full_report[worksheet_name] = {'error': f'Failed to generate {worksheet_name}: {str(e)}'}
        
        return full_report
    
    # Helper methods
    def GetPositionStatus(self, health_score, dte):
        """Determine position status based on health and DTE"""
        if health_score < 25:
            return 'CRITICAL'
        elif health_score < 50:
            return 'WARNING'
        elif dte <= 21:
            return 'EXPIRING_SOON'
        else:
            return 'HEALTHY'
    
    def GetStrategyTargets(self, strategy):
        """Get target metrics for each strategy"""
        targets = {
            'IRON_CONDOR_0DTE': {'win_rate': 0.88},
            'LT112': {'win_rate': 0.75},
            'FUTURES_STRANGLE': {'win_rate': 0.70},
            'IPMCC': {'win_rate': 0.80},
            'LEAP_LADDER': {'win_rate': 0.65}
        }
        return targets.get(strategy, {'win_rate': 0.70})
    
    def GetPerformanceRating(self, actual_wr, target_wr):
        """Rate strategy performance"""
        if actual_wr >= target_wr:
            return 'EXCELLENT' if actual_wr >= target_wr * 1.1 else 'GOOD'
        else:
            return 'POOR' if actual_wr < target_wr * 0.8 else 'FAIR'
    
    def GetMonthlyPerformance(self):
        """Calculate monthly performance data"""
        if not self.daily_snapshots:
            return []
        
        monthly_data = []
        current_month = None
        month_start_value = None
        
        for snapshot in self.daily_snapshots:
            month_key = f"{snapshot['date'].year}-{snapshot['date'].month:02d}"
            
            if current_month != month_key:
                # Close previous month
                if current_month and month_start_value:
                    month_end_value = prev_snapshot['portfolio_value']
                    return_pct = (month_end_value - month_start_value) / month_start_value * 100
                    monthly_data[-1]['return_pct'] = return_pct
                    monthly_data[-1]['end_value'] = month_end_value
                
                # Start new month
                current_month = month_key
                month_start_value = snapshot['portfolio_value']
                monthly_data.append({
                    'month': month_key,
                    'start_value': month_start_value
                })
            
            prev_snapshot = snapshot
        
        # Close final month
        if monthly_data and month_start_value:
            final_value = self.daily_snapshots[-1]['portfolio_value']
            return_pct = (final_value - month_start_value) / month_start_value * 100
            monthly_data[-1]['return_pct'] = return_pct
            monthly_data[-1]['end_value'] = final_value
        
        return monthly_data
    
    def GetGreeksSummaryForDashboard(self):
        """Get Greeks summary for dashboard"""
        if not hasattr(self.algo, 'greeks_engine'):
            return {'status': 'Not Available'}
        
        greeks_summary = self.algo.greeks_engine.GetGreeksSummary()
        pg = greeks_summary['portfolio_greeks']
        
        return {
            'Delta': round(pg['total_delta'], 1),
            'Gamma': round(pg['total_gamma'], 1),
            'Theta_Daily': round(pg['total_theta'], 2),
            'Vega': round(pg['total_vega'], 1),
            'Risk_Status': greeks_summary['risk_status'],
            'Neutrality_Score': round(greeks_summary['neutrality_score'], 1)
        }
    
    def GetRiskHistory(self):
        """Get risk history data"""
        return [{
            'date': snapshot['date'].strftime('%Y-%m-%d'),
            'portfolio_heat': snapshot.get('correlation_heat', 0) * 100,
            'vix': snapshot.get('vix', 20),
            'margin_used_pct': (snapshot.get('margin_used', 0) / snapshot.get('portfolio_value', 75000)) * 100
        } for snapshot in self.daily_snapshots[-30:]]  # Last 30 days
    
    def GetPerformanceByRegime(self):
        """Get performance breakdown by VIX regime"""
        # Simplified - would need detailed regime tracking
        return {
            'EXTREMELY_LOW': {'trades': 0, 'win_rate': 0, 'avg_return': 0},
            'LOW': {'trades': 0, 'win_rate': 0, 'avg_return': 0},
            'NORMAL': {'trades': 0, 'win_rate': 0, 'avg_return': 0},
            'ELEVATED': {'trades': 0, 'win_rate': 0, 'avg_return': 0},
            'HIGH': {'trades': 0, 'win_rate': 0, 'avg_return': 0},
            'EXTREME': {'trades': 0, 'win_rate': 0, 'avg_return': 0}
        }
    
    def CalculatePhaseProgress(self, current_value, phase, phases):
        """Calculate progress within current phase"""
        phase_info = phases[phase]
        if phase == 4:  # No upper limit for phase 4
            return 100  # Consider it complete
        
        phase_range = phase_info['max'] - phase_info['min']
        progress = (current_value - phase_info['min']) / phase_range * 100
        return max(0, min(100, progress))
    
    def CalculateKellyFraction(self, win_rate, win_loss_ratio):
        """Calculate Kelly fraction"""
        if win_loss_ratio <= 0:
            return 0
        
        p = win_rate
        q = 1 - win_rate
        b = win_loss_ratio
        
        kelly = (p * b - q) / b
        return max(0, min(kelly, 1))  # Cap at 100%
    
    def GetCurrentKellyUsage(self, strategy):
        """Get current Kelly usage for strategy"""
        # Simplified - would need detailed position tracking
        return getattr(self.algo, 'current_kelly_fraction', 0.25)
    
    def GetKellySizingRecommendation(self, strategy, optimal_kelly):
        """Get Kelly sizing recommendation"""
        current_usage = self.GetCurrentKellyUsage(strategy)
        
        if current_usage < optimal_kelly * 0.8:
            return 'INCREASE_SIZE'
        elif current_usage > optimal_kelly * 1.2:
            return 'DECREASE_SIZE'
        else:
            return 'MAINTAIN_SIZE'
    
    def AssessKellyHealth(self):
        """Assess overall Kelly sizing health"""
        # Simplified assessment
        return 'HEALTHY'  # Would implement proper logic

