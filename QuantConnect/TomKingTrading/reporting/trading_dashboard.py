# Trading Dashboard - TastyTrade-Style Interface
# Comprehensive position tracking, strategy grouping, and performance analytics

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json
from collections import defaultdict

class TradingDashboard:
    """
    Complete trading dashboard with TastyTrade-style features
    Groups positions by strategy, tracks performance, shows concentrations
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Position tracking by strategy
        self.positions_by_strategy = defaultdict(list)
        
        # Performance tracking
        self.strategy_performance = defaultdict(lambda: {
            'total_trades': 0,
            'winning_trades': 0,
            'losing_trades': 0,
            'total_pnl': 0,
            'best_trade': 0,
            'worst_trade': 0,
            'avg_win': 0,
            'avg_loss': 0,
            'current_positions': [],
            'closed_positions': []
        })
        
        # Stage tracking for decision process
        self.decision_stages = []
        
        # Concentration tracking
        self.concentration_data = {
            'by_underlying': defaultdict(float),
            'by_strategy': defaultdict(float),
            'by_correlation_group': defaultdict(float),
            'by_expiry': defaultdict(float)
        }
        
        self.algo.Log("📊 TRADING DASHBOARD INITIALIZED")
    
    def record_decision_stage(self, stage: str, details: Dict, passed: bool):
        """Record each stage of the decision process"""
        self.decision_stages.append({
            'timestamp': str(self.algo.Time),
            'stage': stage,
            'details': details,
            'passed': passed,
            'icon': '✅' if passed else '❌'
        })
    
    def add_position(self, strategy_name: str, position_data: Dict):
        """Add a new position to tracking"""
        position = {
            'id': f"{strategy_name}_{self.algo.Time.timestamp()}",
            'strategy': strategy_name,
            'symbol': position_data.get('symbol'),
            'entry_time': str(self.algo.Time),
            'entry_price': position_data.get('entry_price', 0),
            'quantity': position_data.get('quantity', 0),
            'position_type': position_data.get('type', 'Unknown'),  # IC, Strangle, etc.
            'expiry': position_data.get('expiry'),
            'strikes': position_data.get('strikes', []),
            'greeks': position_data.get('greeks', {}),
            'margin_used': position_data.get('margin_used', 0),
            'max_profit': position_data.get('max_profit', 0),
            'max_loss': position_data.get('max_loss', 0),
            'status': 'OPEN',
            'unrealized_pnl': 0,
            'days_in_trade': 0,
            'correlation_group': position_data.get('correlation_group', 'Unknown'),
            'vix_at_entry': self.algo.vix_manager.current_vix if hasattr(self.algo, 'vix_manager') else 0
        }
        
        self.positions_by_strategy[strategy_name].append(position)
        self.strategy_performance[strategy_name]['current_positions'].append(position)
        
        # Update concentration data
        self.update_concentration_data()
        
        return position['id']
    
    def update_position(self, position_id: str, updates: Dict):
        """Update an existing position"""
        for strategy_positions in self.positions_by_strategy.values():
            for position in strategy_positions:
                if position['id'] == position_id:
                    position.update(updates)
                    
                    # Update days in trade
                    entry_time = datetime.strptime(position['entry_time'][:19], '%Y-%m-%d %H:%M:%S')
                    position['days_in_trade'] = (self.algo.Time - entry_time).days
                    
                    # Update unrealized P&L if price provided
                    if 'current_price' in updates:
                        position['unrealized_pnl'] = (updates['current_price'] - position['entry_price']) * position['quantity']
                    
                    return True
        return False
    
    def close_position(self, position_id: str, exit_price: float, pnl: float, reason: str = ""):
        """Close a position and move to history"""
        for strategy_name, positions in self.positions_by_strategy.items():
            for i, position in enumerate(positions):
                if position['id'] == position_id:
                    # Update position data
                    position['status'] = 'CLOSED'
                    position['exit_time'] = str(self.algo.Time)
                    position['exit_price'] = exit_price
                    position['realized_pnl'] = pnl
                    position['exit_reason'] = reason
                    
                    # Update strategy performance
                    perf = self.strategy_performance[strategy_name]
                    perf['total_trades'] += 1
                    perf['total_pnl'] += pnl
                    
                    if pnl > 0:
                        perf['winning_trades'] += 1
                        perf['best_trade'] = max(perf['best_trade'], pnl)
                    else:
                        perf['losing_trades'] += 1
                        perf['worst_trade'] = min(perf['worst_trade'], pnl)
                    
                    # Move to closed positions
                    perf['closed_positions'].append(position)
                    perf['current_positions'].remove(position)
                    positions.pop(i)
                    
                    # Update averages
                    if perf['winning_trades'] > 0:
                        total_wins = sum(p['realized_pnl'] for p in perf['closed_positions'] if p['realized_pnl'] > 0)
                        perf['avg_win'] = total_wins / perf['winning_trades']
                    
                    if perf['losing_trades'] > 0:
                        total_losses = sum(p['realized_pnl'] for p in perf['closed_positions'] if p['realized_pnl'] < 0)
                        perf['avg_loss'] = total_losses / perf['losing_trades']
                    
                    return True
        return False
    
    def update_concentration_data(self):
        """Update concentration metrics"""
        # Reset concentrations
        self.concentration_data = {
            'by_underlying': defaultdict(float),
            'by_strategy': defaultdict(float),
            'by_correlation_group': defaultdict(float),
            'by_expiry': defaultdict(float)
        }
        
        total_margin = 0
        
        # Calculate concentrations
        for strategy_name, positions in self.positions_by_strategy.items():
            for position in positions:
                if position['status'] == 'OPEN':
                    margin = position.get('margin_used', 0)
                    total_margin += margin
                    
                    # By strategy
                    self.concentration_data['by_strategy'][strategy_name] += margin
                    
                    # By underlying
                    symbol = str(position.get('symbol', 'Unknown'))
                    underlying = symbol.split(' ')[0] if ' ' in symbol else symbol
                    self.concentration_data['by_underlying'][underlying] += margin
                    
                    # By correlation group
                    group = position.get('correlation_group', 'Unknown')
                    self.concentration_data['by_correlation_group'][group] += margin
                    
                    # By expiry
                    expiry = position.get('expiry', 'Unknown')
                    if expiry != 'Unknown':
                        expiry_bucket = self.get_expiry_bucket(expiry)
                        self.concentration_data['by_expiry'][expiry_bucket] += margin
        
        # Convert to percentages
        if total_margin > 0:
            for category in self.concentration_data:
                for key in self.concentration_data[category]:
                    self.concentration_data[category][key] = (self.concentration_data[category][key] / total_margin) * 100
    
    def get_expiry_bucket(self, expiry):
        """Categorize expiry into buckets"""
        if isinstance(expiry, str):
            try:
                expiry_date = datetime.strptime(expiry[:10], '%Y-%m-%d')
            except:
                return "Unknown"
        else:
            expiry_date = expiry
        
        days_to_expiry = (expiry_date - self.algo.Time).days
        
        if days_to_expiry <= 0:
            return "Expired"
        elif days_to_expiry <= 7:
            return "0-7 DTE"
        elif days_to_expiry <= 30:
            return "8-30 DTE"
        elif days_to_expiry <= 60:
            return "31-60 DTE"
        elif days_to_expiry <= 120:
            return "61-120 DTE"
        else:
            return "120+ DTE"
    
    def get_dashboard_summary(self) -> str:
        """Generate main dashboard summary"""
        account_value = self.algo.Portfolio.TotalPortfolioValue
        total_positions = sum(len(p) for p in self.positions_by_strategy.values())
        
        # Calculate totals
        total_unrealized = 0
        total_margin_used = 0
        
        for positions in self.positions_by_strategy.values():
            for position in positions:
                if position['status'] == 'OPEN':
                    total_unrealized += position.get('unrealized_pnl', 0)
                    total_margin_used += position.get('margin_used', 0)
        
        # Calculate daily P&L
        daily_pnl = getattr(self.algo, 'daily_pnl', 0)
        
        summary = f"""
╔══════════════════════════════════════════════════════════════╗
║               TOM KING TRADING DASHBOARD                      ║
║                   {self.algo.Time.strftime('%Y-%m-%d %H:%M')}                       ║
╠══════════════════════════════════════════════════════════════╣
║ ACCOUNT OVERVIEW                                              ║
║ ├─ Account Value: ${account_value:,.2f}                       ║
║ ├─ Daily P&L: ${daily_pnl:+,.2f}                             ║
║ ├─ Unrealized P&L: ${total_unrealized:+,.2f}                ║
║ ├─ Margin Used: ${total_margin_used:,.2f} ({total_margin_used/account_value*100:.1f}%)
║ └─ Open Positions: {total_positions}                          ║
╚══════════════════════════════════════════════════════════════╝
"""
        return summary
    
    def get_positions_by_strategy_view(self) -> str:
        """Generate positions grouped by strategy view"""
        view = """
╔══════════════════════════════════════════════════════════════╗
║                    POSITIONS BY STRATEGY                      ║
╚══════════════════════════════════════════════════════════════╝
"""
        
        for strategy_name in ['0DTE', 'Futures_Strangle', 'LT112', 'IPMCC', 'LEAP_Ladders']:
            positions = self.positions_by_strategy.get(strategy_name, [])
            open_positions = [p for p in positions if p['status'] == 'OPEN']
            
            if open_positions:
                perf = self.strategy_performance[strategy_name]
                win_rate = (perf['winning_trades'] / perf['total_trades'] * 100) if perf['total_trades'] > 0 else 0
                
                view += f"""
┌─ {strategy_name} ─────────────────────────────────────────────┐
│ Positions: {len(open_positions)} | Win Rate: {win_rate:.1f}% | P&L: ${perf['total_pnl']:+,.2f}
"""
                
                for position in open_positions:
                    days = position.get('days_in_trade', 0)
                    pnl = position.get('unrealized_pnl', 0)
                    pnl_color = '🟢' if pnl >= 0 else '🔴'
                    
                    view += f"""│ {pnl_color} {position['symbol']} | {position['position_type']} | Day {days} | P&L: ${pnl:+,.2f}
"""
                
                view += "└" + "─" * 63 + "┘\n"
        
        return view
    
    def get_concentration_view(self) -> str:
        """Generate concentration analysis view"""
        view = """
╔══════════════════════════════════════════════════════════════╗
║                    CONCENTRATION ANALYSIS                     ║
╚══════════════════════════════════════════════════════════════╝
"""
        
        # By Strategy
        view += "\n📊 BY STRATEGY:\n"
        for strategy, percent in sorted(self.concentration_data['by_strategy'].items(), key=lambda x: x[1], reverse=True):
            if percent > 0:
                bar = '█' * int(percent / 5)
                view += f"   {strategy:20} {bar} {percent:.1f}%\n"
        
        # By Correlation Group
        view += "\n🔗 BY CORRELATION GROUP:\n"
        for group, percent in sorted(self.concentration_data['by_correlation_group'].items(), key=lambda x: x[1], reverse=True):
            if percent > 0:
                bar = '█' * int(percent / 5)
                warning = ' ⚠️' if percent > 30 else ''
                view += f"   {group:20} {bar} {percent:.1f}%{warning}\n"
        
        # By Expiry
        view += "\n📅 BY EXPIRY:\n"
        expiry_order = ["0-7 DTE", "8-30 DTE", "31-60 DTE", "61-120 DTE", "120+ DTE"]
        for expiry in expiry_order:
            percent = self.concentration_data['by_expiry'].get(expiry, 0)
            if percent > 0:
                bar = '█' * int(percent / 5)
                view += f"   {expiry:20} {bar} {percent:.1f}%\n"
        
        return view
    
    def get_performance_metrics_view(self) -> str:
        """Generate detailed performance metrics view"""
        view = """
╔══════════════════════════════════════════════════════════════╗
║                    PERFORMANCE METRICS                        ║
╚══════════════════════════════════════════════════════════════╝
"""
        
        # Overall statistics
        total_trades = sum(s['total_trades'] for s in self.strategy_performance.values())
        total_wins = sum(s['winning_trades'] for s in self.strategy_performance.values())
        total_pnl = sum(s['total_pnl'] for s in self.strategy_performance.values())
        overall_win_rate = (total_wins / total_trades * 100) if total_trades > 0 else 0
        
        view += f"""
📈 OVERALL STATISTICS:
   Total Trades: {total_trades}
   Win Rate: {overall_win_rate:.1f}%
   Total P&L: ${total_pnl:+,.2f}
"""
        
        # Best and worst trades
        all_closed = []
        for perf in self.strategy_performance.values():
            all_closed.extend(perf['closed_positions'])
        
        if all_closed:
            best_trade = max(all_closed, key=lambda x: x.get('realized_pnl', 0))
            worst_trade = min(all_closed, key=lambda x: x.get('realized_pnl', 0))
            
            view += f"""
🏆 BEST TRADE:
   {best_trade['strategy']} - {best_trade['symbol']}
   P&L: ${best_trade['realized_pnl']:+,.2f}
   
😰 WORST TRADE:
   {worst_trade['strategy']} - {worst_trade['symbol']}
   P&L: ${worst_trade['realized_pnl']:+,.2f}
"""
        
        # Strategy breakdown
        view += "\n📊 STRATEGY BREAKDOWN:\n"
        for strategy_name, perf in self.strategy_performance.items():
            if perf['total_trades'] > 0:
                win_rate = (perf['winning_trades'] / perf['total_trades'] * 100)
                avg_win = perf['avg_win']
                avg_loss = perf['avg_loss']
                profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0
                
                view += f"""
┌─ {strategy_name} ─────────────────────────────────────────────┐
│ Trades: {perf['total_trades']} | Wins: {perf['winning_trades']} | Losses: {perf['losing_trades']}
│ Win Rate: {win_rate:.1f}% | P&L: ${perf['total_pnl']:+,.2f}
│ Avg Win: ${avg_win:+,.2f} | Avg Loss: ${avg_loss:+,.2f}
│ Profit Factor: {profit_factor:.2f}
└───────────────────────────────────────────────────────────────┘
"""
        
        return view
    
    def get_decision_log_view(self) -> str:
        """Generate decision process log view"""
        view = """
╔══════════════════════════════════════════════════════════════╗
║                    DECISION PROCESS LOG                       ║
╚══════════════════════════════════════════════════════════════╝
"""
        
        # Get last 10 decision stages
        recent_stages = self.decision_stages[-10:] if len(self.decision_stages) > 10 else self.decision_stages
        
        for stage in recent_stages:
            view += f"""
{stage['icon']} {stage['timestamp'][-8:]} - {stage['stage']}
   {json.dumps(stage['details'], indent=3)[:100]}...
"""
        
        return view
    
    def get_greeks_summary_view(self) -> str:
        """Generate Greeks summary for all positions"""
        view = """
╔══════════════════════════════════════════════════════════════╗
║                       GREEKS SUMMARY                          ║
╚══════════════════════════════════════════════════════════════╝
"""
        
        # Aggregate Greeks
        total_delta = 0
        total_gamma = 0
        total_theta = 0
        total_vega = 0
        
        for positions in self.positions_by_strategy.values():
            for position in positions:
                if position['status'] == 'OPEN' and 'greeks' in position:
                    greeks = position['greeks']
                    total_delta += greeks.get('delta', 0)
                    total_gamma += greeks.get('gamma', 0)
                    total_theta += greeks.get('theta', 0)
                    total_vega += greeks.get('vega', 0)
        
        # Display with visual indicators
        delta_bar = '█' * min(int(abs(total_delta) / 10), 20)
        gamma_bar = '█' * min(int(abs(total_gamma) / 5), 20)
        theta_bar = '█' * min(int(abs(total_theta) / 50), 20)
        vega_bar = '█' * min(int(abs(total_vega) / 10), 20)
        
        view += f"""
Δ DELTA:  {total_delta:+.1f} {delta_bar}
Γ GAMMA:  {total_gamma:+.1f} {gamma_bar}
Θ THETA:  {total_theta:+.1f} {theta_bar} (${total_theta:.2f}/day)
ν VEGA:   {total_vega:+.1f} {vega_bar}
"""
        
        # Greeks by strategy
        view += "\nBY STRATEGY:\n"
        for strategy_name, positions in self.positions_by_strategy.items():
            strategy_delta = sum(p.get('greeks', {}).get('delta', 0) for p in positions if p['status'] == 'OPEN')
            strategy_theta = sum(p.get('greeks', {}).get('theta', 0) for p in positions if p['status'] == 'OPEN')
            
            if strategy_delta != 0 or strategy_theta != 0:
                view += f"   {strategy_name:20} Δ:{strategy_delta:+.1f} Θ:{strategy_theta:+.1f}\n"
        
        return view
    
    def generate_full_report(self):
        """Generate complete dashboard report"""
        report = ""
        
        # Main summary
        report += self.get_dashboard_summary()
        report += "\n"
        
        # Positions by strategy
        report += self.get_positions_by_strategy_view()
        report += "\n"
        
        # Concentration analysis
        report += self.get_concentration_view()
        report += "\n"
        
        # Performance metrics
        report += self.get_performance_metrics_view()
        report += "\n"
        
        # Greeks summary
        report += self.get_greeks_summary_view()
        report += "\n"
        
        # Decision log (if recent)
        if self.decision_stages and len(self.decision_stages) > 0:
            recent_time = datetime.strptime(self.decision_stages[-1]['timestamp'][:19], '%Y-%m-%d %H:%M:%S')
            if (self.algo.Time - recent_time).seconds < 3600:  # Within last hour
                report += self.get_decision_log_view()
        
        return report
    
    def save_dashboard_state(self):
        """Save dashboard state to ObjectStore"""
        state = {
            'positions_by_strategy': dict(self.positions_by_strategy),
            'strategy_performance': dict(self.strategy_performance),
            'concentration_data': dict(self.concentration_data),
            'decision_stages': self.decision_stages[-100:],  # Keep last 100
            'timestamp': str(self.algo.Time)
        }
        
        self.algo.ObjectStore.Save('dashboard_state', json.dumps(state))
    
    def load_dashboard_state(self):
        """Load dashboard state from ObjectStore"""
        try:
            if self.algo.ObjectStore.ContainsKey('dashboard_state'):
                state = json.loads(self.algo.ObjectStore.Read('dashboard_state'))
                
                self.positions_by_strategy = defaultdict(list, state.get('positions_by_strategy', {}))
                self.strategy_performance = defaultdict(dict, state.get('strategy_performance', {}))
                self.concentration_data = state.get('concentration_data', {})
                self.decision_stages = state.get('decision_stages', [])
                
                self.algo.Log(f"Dashboard state loaded from {state.get('timestamp')}")
                return True
        except Exception as e:
            self.algo.Error(f"Failed to load dashboard state: {str(e)}")
        
        return False


# USAGE IN MAIN.PY:
#
# def Initialize(self):
#     self.dashboard = TradingDashboard(self)
#     
#     # Load previous state if exists
#     self.dashboard.load_dashboard_state()
#
# def execute_friday_strategies(self):
#     # Record decision stages
#     self.dashboard.record_decision_stage(
#         "VIX_CHECK",
#         {"vix": vix_level, "threshold": 30},
#         passed=vix_level < 30
#     )
#     
#     # When opening position
#     position_id = self.dashboard.add_position(
#         "0DTE",
#         {
#             'symbol': symbol,
#             'entry_price': price,
#             'quantity': quantity,
#             'type': 'Iron Condor',
#             'strikes': [450, 455, 445, 440],
#             'greeks': {'delta': 5, 'theta': -50},
#             'margin_used': 2000,
#             'correlation_group': 'A1'
#         }
#     )
#
# def OnEndOfDay(self):
#     # Generate and log full dashboard
#     dashboard_report = self.dashboard.generate_full_report()
#     self.Log(dashboard_report)
#     
#     # Save state
#     self.dashboard.save_dashboard_state()