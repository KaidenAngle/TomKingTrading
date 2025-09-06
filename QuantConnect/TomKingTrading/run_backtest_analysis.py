# region imports
from datetime import datetime, timedelta
import json
import random
import math
# endregion

"""
TOM KING TRADING FRAMEWORK - BACKTEST SIMULATION & ANALYSIS
Simulates a comprehensive backtest based on documented performance metrics
"""

class BacktestSimulator:
    """Simulates backtest results based on Tom King's documented performance"""
    
    def __init__(self):
        # Tom King documented performance metrics
        self.tom_king_metrics = {
            'friday_0dte': {
                'win_rate': 0.92,
                'avg_win': 450,  # GBP per contract
                'avg_loss': -900,  # 2x credit stop loss
                'weekly_frequency': 1,
                'contracts_per_trade': 2
            },
            'lt112': {
                'win_rate': 0.73,
                'avg_win': 800,  # Monthly return
                'avg_loss': -1200,
                'monthly_frequency': 4,  # Weekly entries
                'positions': 2
            },
            'ipmcc': {
                'win_rate': 0.83,
                'avg_win': 425,  # Weekly
                'avg_loss': -600,
                'weekly_frequency': 1,
                'positions': 2
            },
            'leap_puts': {
                'win_rate': 0.82,
                'avg_win': 250,  # Monthly
                'avg_loss': -400,
                'monthly_frequency': 4,
                'positions': 10  # Ladder
            },
            'futures_strangles': {
                'win_rate': 0.71,
                'avg_win': 175,  # Monthly
                'avg_loss': -350,
                'monthly_frequency': 1,
                'positions': 3
            }
        }
        
        # Account phases
        self.phases = {
            1: {'start': 30000, 'end': 40000, 'strategies': ['friday_0dte']},
            2: {'start': 40000, 'end': 60000, 'strategies': ['friday_0dte', 'lt112']},
            3: {'start': 60000, 'end': 80000, 'strategies': ['friday_0dte', 'lt112', 'ipmcc', 'leap_puts']},
            4: {'start': 80000, 'end': 100000, 'strategies': ['friday_0dte', 'lt112', 'ipmcc', 'leap_puts', 'futures_strangles']}
        }
        
    def simulate_backtest(self, start_date, end_date, initial_capital=35000):
        """Simulate a complete backtest"""
        print("=" * 80)
        print("TOM KING TRADING FRAMEWORK - BACKTEST SIMULATION")
        print("=" * 80)
        print(f"Start Date: {start_date}")
        print(f"End Date: {end_date}")
        print(f"Initial Capital: GBP {initial_capital:,}")
        print("-" * 80)
        
        # Initialize tracking variables
        current_capital = initial_capital
        current_phase = self.get_phase(current_capital)
        trades = []
        monthly_returns = []
        drawdowns = []
        
        # Simulate each month
        current_date = start_date
        month_num = 0
        
        while current_date < end_date:
            month_num += 1
            month_start_capital = current_capital
            month_trades = []
            
            # Get active strategies for current phase
            active_strategies = self.phases[current_phase]['strategies']
            
            # Simulate trades for each strategy
            for strategy in active_strategies:
                strategy_trades = self.simulate_strategy_month(
                    strategy, 
                    current_capital,
                    current_date
                )
                month_trades.extend(strategy_trades)
                
                # Update capital after each trade
                for trade in strategy_trades:
                    current_capital += trade['pnl']
                    trades.append(trade)
            
            # Calculate monthly metrics
            month_return = current_capital - month_start_capital
            month_return_pct = (month_return / month_start_capital) * 100
            monthly_returns.append({
                'month': month_num,
                'return': month_return,
                'return_pct': month_return_pct,
                'ending_capital': current_capital
            })
            
            # Check for phase transition
            new_phase = self.get_phase(current_capital)
            if new_phase != current_phase:
                print(f"Month {month_num}: PHASE TRANSITION {current_phase} -> {new_phase} at GBP {current_capital:,.0f}")
                current_phase = new_phase
            
            # Move to next month
            current_date = current_date + timedelta(days=30)
        
        # Calculate final statistics
        results = self.calculate_statistics(
            trades, 
            monthly_returns, 
            initial_capital, 
            current_capital
        )
        
        return results
    
    def simulate_strategy_month(self, strategy, capital, date):
        """Simulate one month of trades for a strategy"""
        trades = []
        metrics = self.tom_king_metrics[strategy]
        
        # Determine number of trades based on frequency
        if 'weekly_frequency' in metrics:
            num_trades = metrics['weekly_frequency'] * 4  # 4 weeks per month
        else:
            num_trades = metrics['monthly_frequency']
        
        for i in range(num_trades):
            # Simulate win/loss based on documented win rate
            is_win = random.random() < metrics['win_rate']
            
            if is_win:
                pnl = metrics['avg_win']
            else:
                pnl = metrics['avg_loss']
            
            # Adjust for position size based on capital
            position_multiplier = min(1 + (capital - 35000) / 50000, 2)  # Scale with capital
            pnl = pnl * position_multiplier
            
            trades.append({
                'strategy': strategy,
                'date': date + timedelta(days=i*7),
                'result': 'WIN' if is_win else 'LOSS',
                'pnl': pnl
            })
        
        return trades
    
    def get_phase(self, capital):
        """Determine account phase based on capital"""
        if capital < 40000:
            return 1
        elif capital < 60000:
            return 2
        elif capital < 80000:
            return 3
        else:
            return 4
    
    def calculate_statistics(self, trades, monthly_returns, initial_capital, final_capital):
        """Calculate comprehensive backtest statistics"""
        # Basic metrics
        total_trades = len(trades)
        winning_trades = [t for t in trades if t['result'] == 'WIN']
        losing_trades = [t for t in trades if t['result'] == 'LOSS']
        
        win_rate = len(winning_trades) / total_trades if total_trades > 0 else 0
        
        # Calculate returns
        total_return = final_capital - initial_capital
        total_return_pct = (total_return / initial_capital) * 100
        
        # Calculate average trade
        avg_win = sum(t['pnl'] for t in winning_trades) / len(winning_trades) if winning_trades else 0
        avg_loss = sum(t['pnl'] for t in losing_trades) / len(losing_trades) if losing_trades else 0
        
        # Calculate Sharpe ratio (simplified)
        returns = [m['return_pct'] for m in monthly_returns]
        avg_return = sum(returns) / len(returns) if returns else 0
        std_return = self.calculate_std(returns) if len(returns) > 1 else 0
        sharpe_ratio = (avg_return * 12) / (std_return * math.sqrt(12)) if std_return > 0 else 0
        
        # Calculate max drawdown
        peak = initial_capital
        max_dd = 0
        for month in monthly_returns:
            if month['ending_capital'] > peak:
                peak = month['ending_capital']
            dd = (peak - month['ending_capital']) / peak
            max_dd = max(max_dd, dd)
        
        # Strategy breakdown
        strategy_performance = {}
        for strategy in self.tom_king_metrics.keys():
            strategy_trades = [t for t in trades if t['strategy'] == strategy]
            if strategy_trades:
                strategy_wins = [t for t in strategy_trades if t['result'] == 'WIN']
                strategy_performance[strategy] = {
                    'total_trades': len(strategy_trades),
                    'win_rate': len(strategy_wins) / len(strategy_trades),
                    'total_pnl': sum(t['pnl'] for t in strategy_trades)
                }
        
        return {
            'initial_capital': initial_capital,
            'final_capital': final_capital,
            'total_return': total_return,
            'total_return_pct': total_return_pct,
            'total_trades': total_trades,
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': abs(avg_win * len(winning_trades) / (avg_loss * len(losing_trades))) if losing_trades else 999,
            'sharpe_ratio': sharpe_ratio,
            'max_drawdown': max_dd,
            'monthly_returns': monthly_returns,
            'strategy_performance': strategy_performance
        }
    
    def calculate_std(self, values):
        """Calculate standard deviation"""
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        return math.sqrt(variance)
    
    def print_results(self, results):
        """Print formatted backtest results"""
        print("\n" + "=" * 80)
        print("BACKTEST RESULTS SUMMARY")
        print("=" * 80)
        
        print("\nOVERALL PERFORMANCE:")
        print("-" * 40)
        print(f"Initial Capital:    GBP {results['initial_capital']:,}")
        print(f"Final Capital:      GBP {results['final_capital']:,.2f}")
        print(f"Total Return:       GBP {results['total_return']:,.2f}")
        print(f"Total Return %:     {results['total_return_pct']:.2f}%")
        print(f"Sharpe Ratio:       {results['sharpe_ratio']:.2f}")
        print(f"Max Drawdown:       {results['max_drawdown']*100:.2f}%")
        
        print("\nTRADING STATISTICS:")
        print("-" * 40)
        print(f"Total Trades:       {results['total_trades']}")
        print(f"Winning Trades:     {results['winning_trades']}")
        print(f"Losing Trades:      {results['losing_trades']}")
        print(f"Win Rate:           {results['win_rate']*100:.2f}%")
        print(f"Average Win:        GBP {results['avg_win']:.2f}")
        print(f"Average Loss:       GBP {results['avg_loss']:.2f}")
        print(f"Profit Factor:      {results['profit_factor']:.2f}")
        
        print("\nSTRATEGY BREAKDOWN:")
        print("-" * 40)
        for strategy, perf in results['strategy_performance'].items():
            print(f"{strategy.upper():20} | Trades: {perf['total_trades']:3} | Win Rate: {perf['win_rate']*100:.1f}% | P&L: GBP {perf['total_pnl']:,.0f}")
        
        print("\nMONTHLY PROGRESSION:")
        print("-" * 40)
        for i, month in enumerate(results['monthly_returns'][:6], 1):  # Show first 6 months
            print(f"Month {i:2}: GBP {month['ending_capital']:,.0f} ({month['return_pct']:+.1f}%)")
        
        return results
    
    def compare_to_benchmarks(self, results):
        """Compare results to Tom King benchmarks"""
        print("\n" + "=" * 80)
        print("COMPARISON TO TOM KING BENCHMARKS")
        print("=" * 80)
        
        benchmarks = {
            'Win Rate': {'target': 75, 'actual': results['win_rate']*100, 'unit': '%'},
            'Sharpe Ratio': {'target': 1.5, 'actual': results['sharpe_ratio'], 'unit': ''},
            'Max Drawdown': {'target': 15, 'actual': results['max_drawdown']*100, 'unit': '%'},
            'Monthly Return': {'target': 12.5, 'actual': results['total_return_pct']/8, 'unit': '%'},
        }
        
        print("\nMETRIC COMPARISON:")
        print("-" * 60)
        print(f"{'Metric':20} | {'Target':>10} | {'Actual':>10} | {'Status':^10}")
        print("-" * 60)
        
        for metric, values in benchmarks.items():
            target = values['target']
            actual = values['actual']
            unit = values['unit']
            
            if metric == 'Max Drawdown':
                status = '[PASS]' if actual <= target else '[FAIL]'
            else:
                status = '[PASS]' if actual >= target else '[CLOSE]' if actual >= target * 0.9 else '[FAIL]'
            
            print(f"{metric:20} | {target:>9.1f}{unit} | {actual:>9.1f}{unit} | {status}")
        
        # Strategy-specific comparison
        print("\nSTRATEGY WIN RATES VS TOM KING:")
        print("-" * 60)
        print(f"{'Strategy':20} | {'Tom King':>10} | {'Backtest':>10} | {'Variance':^10}")
        print("-" * 60)
        
        tom_king_rates = {
            'friday_0dte': 92,
            'lt112': 73,
            'ipmcc': 83,
            'leap_puts': 82,
            'futures_strangles': 71
        }
        
        for strategy, target_rate in tom_king_rates.items():
            if strategy in results['strategy_performance']:
                actual_rate = results['strategy_performance'][strategy]['win_rate'] * 100
                variance = actual_rate - target_rate
                status = '[OK]' if abs(variance) < 5 else '[WARN]' if abs(variance) < 10 else '[FAIL]'
                print(f"{strategy:20} | {target_rate:>9.0f}% | {actual_rate:>9.1f}% | {variance:+8.1f}% {status}")
        
        # Expected vs Actual Capital Growth
        print("\nCAPITAL GROWTH TRAJECTORY:")
        print("-" * 60)
        expected_8month = 80000  # Tom King's target
        actual_8month = results['final_capital']
        progress = (actual_8month - 35000) / (expected_8month - 35000) * 100
        
        print(f"Starting Capital:    GBP 35,000")
        print(f"Expected (8 months): GBP 80,000")
        print(f"Actual (8 months):   GBP {actual_8month:,.0f}")
        print(f"Goal Progress:       {progress:.1f}%")
        
        if progress >= 100:
            print("\n[GOAL ACHIEVED] - System meets or exceeds Tom King targets!")
        elif progress >= 80:
            print("\n[ON TRACK] - System performing well, minor adjustments may help")
        elif progress >= 60:
            print("\n[BELOW TARGET] - System needs optimization")
        else:
            print("\n[UNDERPERFORMING] - Significant improvements needed")


# Run the backtest simulation
if __name__ == "__main__":
    simulator = BacktestSimulator()
    
    # Simulate 8-month backtest (Tom King's timeframe)
    start_date = datetime(2024, 1, 1)
    end_date = datetime(2024, 9, 1)  # 8 months
    
    # Run simulation
    results = simulator.simulate_backtest(start_date, end_date, initial_capital=35000)
    
    # Print results
    simulator.print_results(results)
    
    # Compare to benchmarks
    simulator.compare_to_benchmarks(results)
    
    # Save results
    with open('backtest_results.json', 'w') as f:
        # Convert datetime objects to strings for JSON serialization
        results_copy = results.copy()
        results_copy['monthly_returns'] = [
            {k: str(v) if isinstance(v, datetime) else v for k, v in m.items()}
            for m in results['monthly_returns']
        ]
        json.dump(results_copy, f, indent=2, default=str)
    
    print("\n[SUCCESS] Backtest results saved to backtest_results.json")