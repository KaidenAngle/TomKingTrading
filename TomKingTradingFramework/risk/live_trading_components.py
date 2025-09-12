# Simple Production Features - No over-engineering
# Essential components for live trading without complexity

from AlgorithmImports import *
from datetime import datetime, timedelta
import json
from core.unified_state_manager import UnifiedStateManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage state_manager from unified system
# Consider delegating to: self.algo.state_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class LivePositionRecovery:
    """
    Simple position state persistence using ObjectStore
    Saves essential position data for recovery after restart
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.storage_key = "position_state"
        
    def save_positions(self):
        """Save current positions to ObjectStore"""
        try:
            pass
        except Exception as e:

            positions = []
            for symbol, holding in self.algo.Portfolio.items():
                if holding.Invested:
                    positions.append({
                        'symbol': str(symbol),
                        'quantity': holding.Quantity,
                        'average_price': holding.AveragePrice,
                        'unrealized_pnl': holding.UnrealizedProfit
                    })
            
            state = {
                'positions': positions,
                'timestamp': str(self.algo.Time),
                'account_value': self.algo.Portfolio.TotalPortfolioValue,
                'phase': getattr(self.algo, 'current_phase', 1)
            }
            
            # Save to ObjectStore
            json_state = json.dumps(state)
            self.algo.ObjectStore.Save(self.storage_key, json_state)
            
        except Exception as e:
            self.algo.Log(f"Failed to save positions: {str(e)}")
    
    def recover_positions(self):
        """Recover positions from ObjectStore on restart"""
        try:
            pass
        except Exception as e:

            if self.algo.ObjectStore.ContainsKey(self.storage_key):
                json_state = self.algo.ObjectStore.Read(self.storage_key)
                state = json.loads(json_state)
                
                # Check if state is recent (within 24 hours)
                saved_time = datetime.strptime(state['timestamp'], '%Y-%m-%d %H:%M:%S')
                time_diff = (self.algo.Time - saved_time).total_seconds() / TradingConstants.SECONDS_PER_HOUR
                
                if time_diff < 24:
                    self.algo.Log(f"Recovering {len(state['positions'])} positions from {state['timestamp']}")
                    return state
                else:
                    self.algo.Log(f"Saved state too old ({time_diff:.1f} hours), starting fresh")
            
        except Exception as e:
            self.algo.Log(f"Failed to recover positions: {str(e)}")
        
        return None


class LivePerformanceTracker:
    """
    Simple performance tracking - just win rate and P&L
    No complex Sharpe ratios or attribution
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Simple counters
        self.trades_today = 0
        self.wins_today = 0
        self.total_pnl_today = 0
        
        # By strategy tracking
        self.strategy_stats = {}
        
    def record_trade(self, strategy_name: str, pnl: float):
        """Record a completed trade"""
        self.trades_today += 1
        if pnl > 0:
            self.wins_today += 1
        self.total_pnl_today += pnl
        
        # Track by strategy
        if strategy_name not in self.strategy_stats:
            self.strategy_stats[strategy_name] = {'trades': 0, 'wins': 0, 'pnl': 0}
        
        self.strategy_stats[strategy_name]['trades'] += 1
        if pnl > 0:
            self.strategy_stats[strategy_name]['wins'] += 1
        self.strategy_stats[strategy_name]['pnl'] += pnl
    
    def get_win_rate(self) -> float:
        """Get today's win rate"""
        if self.trades_today == 0:
            return 0
        return (self.wins_today / self.trades_today) * 100
    
    def get_strategy_performance(self, strategy_name: str) -> dict:
        """Get performance for specific strategy"""
        if strategy_name not in self.strategy_stats:
            return {'win_rate': 0, 'pnl': 0, 'trades': 0}
        
        stats = self.strategy_stats[strategy_name]
        win_rate = (stats['wins'] / stats['trades'] * 100) if stats['trades'] > 0 else 0
        
        return {
            'win_rate': win_rate,
            'pnl': stats['pnl'],
            'trades': stats['trades']
        }
    
    def reset_daily(self):
        """Reset daily counters"""
        self.trades_today = 0
        self.wins_today = 0
        self.total_pnl_today = 0
        self.strategy_stats = {}


class LiveFuturesRoller:
    """
    Simple futures roll management
    Roll 5 days before expiry to next month
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.roll_days_before_expiry = 5
        
    def check_and_roll_futures(self):
        """Check all futures positions and roll if needed"""
        for symbol, holding in self.algo.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Future:
                security = self.algo.Securities[symbol]
                days_to_expiry = (security.Expiry - self.algo.Time).days
                
                if days_to_expiry <= self.roll_days_before_expiry:
                    self.roll_position(symbol, holding)
    
    def roll_position(self, current_symbol, holding):
        """Roll a futures position to next month"""
        try:
            next_contract = self.get_next_month_contract(current_symbol)
        except Exception as e:

            # Get next month contract
            
            if next_contract:
                # Close current position
                self.algo.Liquidate(current_symbol, "FUTURES_ROLL")
                
                # Open new position in next month
                self.algo.MarketOrder(next_contract, holding.Quantity)
                
                self.algo.Log(f"Rolled {current_symbol} to {next_contract}")
        
        except Exception as e:
            self.algo.Log(f"Failed to roll {current_symbol}: {str(e)}")
    
    def get_next_month_contract(self, current_symbol):
        """Get the next month's contract"""
        # This would use FuturesChainProvider in real implementation
        # Simplified version here
        underlying = current_symbol.Underlying
        
        # Get futures chain
        futures_chain = self.algo.FuturesChainProvider.GetFuturesContractList(underlying, self.algo.Time)
        
        # Find next expiry after current
        current_expiry = self.algo.Securities[current_symbol].Expiry
        next_contracts = [f for f in futures_chain if f.Expiry > current_expiry]
        
        if next_contracts:
            # Return nearest expiry
            return min(next_contracts, key=lambda x: x.Expiry)
        
        return None


class LiveBrokerFailover:
    """
    Simple broker failover - try primary, fallback to secondary
    No complex queuing or retry logic
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.use_tastytrade = True  # Primary broker
        
    def place_order_with_failover(self, symbol, quantity, order_type='MARKET'):
        """Place order with automatic failover"""
        try:
            pass
        except Exception as e:

            if self.use_tastytrade and hasattr(self.algo, 'tastytrade_api'):
                # Try TastyTrade first
                result = self.place_tastytrade_order(symbol, quantity, order_type)
                if result:
                    return result
        except Exception as e:
            self.algo.Log(f"TastyTrade order failed: {str(e)}, using QuantConnect")
        
        # Fallback to QuantConnect
        if order_type == 'MARKET':
            return self.algo.MarketOrder(symbol, quantity)
        else:
            # Use mid price for limit
            security = self.algo.Securities[symbol]
            limit_price = (security.BidPrice + security.AskPrice) / 2
            return self.algo.LimitOrder(symbol, quantity, limit_price)
    
    def place_tastytrade_order(self, symbol, quantity, order_type):
        """Place order through TastyTrade API"""
        # Use the TastyTrade integration if available
        if hasattr(self.algo, 'tastytrade') and self.algo.tastytrade:
            try:
                limit_price = None
            if order_type == 'LIMIT':
                security = self.algo.Securities[symbol]
            # Use mid price for limit orders
            limit_price = (security.BidPrice + security.AskPrice) / 2
            except Exception as e:

                # Determine limit price if needed
                
                # Place the order through TastyTrade
                result = self.algo.tastytrade.place_order(
                    symbol=str(symbol),
                    quantity=quantity,
                    order_type=order_type,
                    limit_price=limit_price
                )
                
                if result:
                    self.algo.Log(f"TastyTrade order placed: {symbol} x{quantity}")
                    return result
                else:
                    self.algo.Log(f"TastyTrade order failed for {symbol}")
                    return None
                    
            except Exception as e:
                self.algo.Log(f"Error placing TastyTrade order: {str(e)}")
                return None
        else:
            # TastyTrade not available
            self.algo.Log("TastyTrade integration not available")
            return None


class LiveCommissionModel:
    """Commission and slippage model wrapper for TastyWorks"""
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Import and use the centralized fee model
        from optimization.fee_models import TastyTradeFeeModel
        self.fee_model = TastyTradeFeeModel()
        
        # Map old attributes to fee model for compatibility
        self.option_commission = self.fee_model.option_commission
        self.option_close_commission = 0.00  # TastyWorks free to close
        self.futures_commission = self.fee_model.futures_commission
        self.option_fee = self.fee_model.option_fee
        
        # Simple slippage estimates (kept local as not in fee_models)
        self.option_slippage_percent = 0.01  # 1% of price
        self.futures_slippage_ticks = 1  # 1 tick slippage
        
    def calculate_entry_cost(self, symbol, quantity, price):
        """Calculate total cost including commission and slippage"""
        security = self.algo.Securities.get(symbol)
        
        # Simplified commission calculation using fee model rates
        if security.Type == SecurityType.Option:
            commission = abs(quantity) * (self.option_commission + self.option_fee)
            slippage = price * self.option_slippage_percent * abs(quantity) * 100
        elif security.Type == SecurityType.Future:
            commission = abs(quantity) * self.futures_commission
            # Assume $12.50 per tick for ES
            slippage = 12.50 * self.futures_slippage_ticks * abs(quantity)
        else:
            commission = 0
            slippage = 0
        
        return commission + slippage
    
    def adjust_profit_target(self, original_target, symbol, quantity):
        """Adjust profit target to account for costs"""
        entry_cost = self.calculate_entry_cost(symbol, quantity, 0)
        # Double the cost (entry + exit)
        total_cost = entry_cost * 2
        
        # Add to profit target
        return original_target + total_cost


class LiveDailySummary:
    """
    Simple daily summary reporting
    Logs key metrics at end of day
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
    def generate_daily_summary(self):
        """Generate and log daily summary"""
        portfolio = self.algo.Portfolio
        
        # Calculate daily metrics
        starting_value = getattr(self.algo, 'daily_start_value', portfolio.TotalPortfolioValue)
        ending_value = portfolio.TotalPortfolioValue
        daily_pnl = ending_value - starting_value
        daily_return = (daily_pnl / starting_value) * 100 if starting_value > 0 else 0
        
        # Count positions
        open_positions = sum(1 for h in portfolio.Values if h.Invested)
        
        # Get performance tracker stats if available
        win_rate = 0
        trades_today = 0
        if hasattr(self.algo, 'performance_tracker'):
            win_rate = self.algo.performance_tracker.get_win_rate()
            trades_today = self.algo.performance_tracker.trades_today
        
        # Generate summary
        summary = f"""
========================================
DAILY SUMMARY - {self.algo.Time.date()}
========================================
Account Value: ${ending_value:,.2f}
Daily P&L: ${daily_pnl:,.2f} ({daily_return:+.2f}%)
Open Positions: {open_positions}
Trades Today: {trades_today}
Win Rate: {win_rate:.1f}%
========================================
"""
        
        # Log it
        self.algo.Log(summary)
        
        # Also log strategy-specific performance if available
        if hasattr(self.algo, 'performance_tracker'):
            self.algo.Log("Strategy Performance:")
            for strategy in ['0DTE', 'Futures_Strangle', 'LT112', 'IPMCC', 'LEAP_Ladders']:
                stats = self.algo.performance_tracker.get_strategy_performance(strategy)
                if stats['trades'] > 0:
                    self.algo.Log(f"  {strategy}: {stats['trades']} trades, {stats['win_rate']:.1f}% win rate, ${stats['pnl']:,.2f} P&L")
        
        # Save state for recovery
        if hasattr(self.algo, 'position_recovery'):
            self.algo.position_recovery.save_positions()


# USAGE EXAMPLE:
#