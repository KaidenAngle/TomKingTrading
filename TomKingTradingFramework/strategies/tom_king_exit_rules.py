# Tom King Exit Rules - Official exit management system
# Based on complete methodology documentation

from AlgorithmImports import *
from config.constants import TradingConstants
from datetime import timedelta
from helpers.timezone_handler import TimezoneHandler

class TomKingExitRules:
    """
    Manages exits for all strategies based on Tom King's rules:
        - 0DTE: 50% profit or 3:00 PM time exit
    - Strangles: 50% profit or TradingConstants.DEFENSIVE_EXIT_DTE DTE
    - LT112: 50% profit or TradingConstants.DEFENSIVE_EXIT_DTE DTE
    - IPMCC: Roll short at TradingConstants.DEFENSIVE_EXIT_DTE DTE
    - LEAP: 30% profit or roll at 150 DTE
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.timezone_handler = TimezoneHandler(algorithm)
        
        # Tom King's actual profit targets (from documentation)
        self.profit_targets = {
            '0DTE': TradingConstants.FRIDAY_0DTE_PROFIT_TARGET,           # 50% of credit received
            'Strangle': TradingConstants.FUTURES_STRANGLE_PROFIT_TARGET,       # 50% of credit (not 25%!)
            'Futures_Strangle': TradingConstants.FUTURES_STRANGLE_PROFIT_TARGET,  # Same as regular strangles
            'LT112': TradingConstants.LT112_PROFIT_TARGET,          # 50% profit target
            'IPMCC': TradingConstants.IPMCC_PROFIT_TARGET,          # Roll short call at 50% or TradingConstants.DEFENSIVE_EXIT_DTE DTE
            'LEAP': 0.30            # 30% profit target (longer term)
        }
        
        # Stop loss multiples (2x credit for most)
        self.stop_loss_multiples = {
            '0DTE': 2.0,            # 2x credit received
            'Strangle': 2.0,        # 2x credit
            'Futures_Strangle': 2.0,
            'LT112': 2.0,
            'IPMCC': None,          # No stop, just roll
            'LEAP': None            # Hold through drawdowns
        }
        
        # DTE management rules
        self.dte_rules = {
            '0DTE': 0,              # Same day exit
            'Strangle': TradingConstants.DEFENSIVE_EXIT_DTE,         # Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE rule
            'Futures_Strangle': TradingConstants.DEFENSIVE_EXIT_DTE,
            'LT112': TradingConstants.DEFENSIVE_EXIT_DTE,            # Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE rule
            'IPMCC': TradingConstants.DEFENSIVE_EXIT_DTE,            # Roll short call at TradingConstants.DEFENSIVE_EXIT_DTE DTE
            'LEAP': 150             # Roll at 150 DTE
        }
        
        # Time-based exits (for 0DTE)
        self.time_exits = {
            '0DTE': (15, 0),        # 3:00 PM EST exit
            'defensive': (15, 30)    # 3:30 PM defensive exit
        }
    
    def check_exits(self, position) -> tuple:
        """
        Check if position should be exited
        Returns: (should_exit, reason, action)
        """
        strategy = position.get('strategy', '')
        
        # Check profit target
        profit_check = self.check_profit_target(position)
        if profit_check[0]:
            return profit_check
        
        # Check stop loss
        stop_check = self.check_stop_loss(position)
        if stop_check[0]:
            return stop_check
        
        # Check DTE rule
        dte_check = self.check_dte_rule(position)
        if dte_check[0]:
            return dte_check
        
        # Check time-based exit (0DTE)
        if strategy == '0DTE':
            time_check = self.check_time_exit(position)
            if time_check[0]:
                return time_check
        
        # Check defensive conditions
        defensive_check = self.check_defensive_exit(position)
        if defensive_check[0]:
            return defensive_check
        
        return (False, None, None)
    
    def check_profit_target(self, position) -> tuple:
        """
        Check if position hit profit target
        """
        strategy = position.get('strategy', '')
        if strategy not in self.profit_targets:
            return (False, None, None)
        
        entry_credit = position.get('entry_credit', 0)
        current_value = position.get('current_value', 0)
        
        if entry_credit <= 0:
            return (False, None, None)
        
        # Calculate profit percentage
        # For credit strategies: profit = (entry_credit - current_value) / entry_credit
        profit_pct = (entry_credit - current_value) / entry_credit
        
        target = self.profit_targets[strategy]
        
        if profit_pct >= target:
            self.algo.Log(f"[EXIT] {strategy} hit {target*TradingConstants.FULL_PERCENTAGE:.0f}% profit target: {profit_pct*TradingConstants.FULL_PERCENTAGE:.1f}%")
            return (True, f"Profit target {target*TradingConstants.FULL_PERCENTAGE:.0f}%", "close")
        
        return (False, None, None)
    
    def check_stop_loss(self, position) -> tuple:
        """
        Check if position hit stop loss (2x credit for most strategies)
        """
        strategy = position.get('strategy', '')
        if strategy not in self.stop_loss_multiples:
            return (False, None, None)
        
        multiple = self.stop_loss_multiples[strategy]
        if multiple is None:
            return (False, None, None)
        
        entry_credit = position.get('entry_credit', 0)
        current_value = position.get('current_value', 0)
        
        if entry_credit <= 0:
            return (False, None, None)
        
        # Loss occurs when current value > entry credit
        # Stop at 2x means current_value >= entry_credit * (1 + multiple)
        max_loss_value = entry_credit * (1 + multiple)
        
        if current_value >= max_loss_value:
            loss_pct = ((current_value - entry_credit) / entry_credit) * 100
            self.algo.Log(f"[STOP] {strategy} hit stop loss: -{loss_pct:.1f}%")
            return (True, f"Stop loss at {multiple}x credit", "close")
        
        return (False, None, None)
    
    def check_dte_rule(self, position) -> tuple:
        """
        Check if position needs management based on DTE
        """
        strategy = position.get('strategy', '')
        if strategy not in self.dte_rules:
            return (False, None, None)
        
        dte_threshold = self.dte_rules[strategy]
        current_dte = position.get('dte', 999)
        
        if current_dte <= dte_threshold and current_dte > 0:
            # Different actions based on strategy
            if strategy in ['IPMCC', 'LEAP']:
                action = 'roll'
                reason = f"Roll at {dte_threshold} DTE"
            else:
                action = 'close'
                reason = f"{TradingConstants.DEFENSIVE_EXIT_DTE} DTE rule"
            
            self.algo.Log(f"[DTE] {strategy} at {current_dte} DTE - {action}")
            return (True, reason, action)
        
        return (False, None, None)
    
    def check_time_exit(self, position) -> tuple:
        """
        Check time-based exit for 0DTE
        """
        strategy = position.get('strategy', '')
        if strategy != '0DTE':
            return (False, None, None)
        
        exit_hour, exit_minute = self.time_exits['0DTE']
        
        # Check if past exit time using timezone handler (Eastern Time with DST)
        if self.timezone_handler.is_past_time(exit_hour, exit_minute):
            time_str = self.timezone_handler.format_time()
            self.algo.Log(f"[TIME] 0DTE time exit at {time_str}")
            return (True, "3:00 PM ET time exit", "close")
        
        return (False, None, None)
    
    def check_defensive_exit(self, position) -> tuple:
        """
        Check defensive conditions (VIX spike, correlation breach, etc.)
        """
        # VIX defensive check
        vix = self.algo.Securities["VIX"].Price if "VIX" in self.algo.Securities else 16
        
        # August 2024 lesson: Exit strangles if VIX spikes
        if vix > 30 and position.get('strategy') in ['Strangle', 'Futures_Strangle']:
            # Tom King says close strangles at 200-300% profit during VIX spikes
            current_value = position.get('current_value', 0)
            entry_credit = position.get('entry_credit', 1)
            
            if entry_credit > 0:
                loss_pct = ((current_value - entry_credit) / entry_credit) * 100
                
                # If losing more than 200%, close defensively
                if loss_pct > 200:
                    self.algo.Log(f"[DEFENSIVE] Closing strangle - VIX at {vix:.1f}, loss at {loss_pct:.0f}%")
                    return (True, "Defensive VIX exit", "close")
        
        # Correlation breach check
        if hasattr(self.algo, 'correlation_manager'):
            correlation_breach = self.algo.correlation_manager.check_correlation_breach()
            if correlation_breach and position.get('strategy') != 'LEAP':
                self.algo.Log(f"[DEFENSIVE] Correlation breach detected")
                return (True, "Correlation breach", "close")
        
        # Margin pressure check (close lowest performing)
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        margin_used = self.algo.Portfolio.TotalMarginUsed
        
        if margin_used > portfolio_value * 0.85:  # 85% margin usage
            # Close if this is a losing position
            if position.get('unrealized_pnl', 0) < 0:
                self.algo.Log(f"[DEFENSIVE] Margin pressure - closing losing position")
                return (True, "Margin pressure", "close")
        
        return (False, None, None)
    
    def get_exit_summary(self) -> str:
        """
        Get summary of exit rules for logging
        """
        summary = []
        summary.append("=" * 60)
        summary.append("EXIT RULES (Tom King Methodology)")
        summary.append("-" * 60)
        
        for strategy, target in self.profit_targets.items():
            stop = self.stop_loss_multiples.get(strategy)
            dte = self.dte_rules.get(strategy)
            
            summary.append(f"{strategy:15} | Profit: {target*TradingConstants.FULL_PERCENTAGE:.0f}% | "
                         f"Stop: {f'{stop}x' if stop else 'None':5} | "
                         f"DTE: {dte}")
        
        summary.append("-" * 60)
        summary.append("Special Rules:")
        summary.append("- 0DTE: Exit at 3:00 PM if not at profit")
        summary.append("- Strangles: Close at 200-300% loss if VIX > 30")
        summary.append("- IPMCC/LEAP: Roll, don't close")
        summary.append("- All: Exit on correlation breach")
        summary.append("=" * 60)
        
        return "\n".join(summary)
    
    def calculate_monthly_expectation(self, account_value: float) -> dict:
        """
        Calculate expected monthly profit based on Tom King's targets
        """
        # From documentation: 
        # £30k account: £2,500 realistic (8.3%)
        # £50k account: £4,500 realistic (9%)
        # £75k account: £6,750 realistic (9%)
        
        if account_value < 40000:
            monthly_target_pct = 0.083  # 8.3%
        elif account_value < 60000:
            monthly_target_pct = 0.09   # 9%
        else:
            monthly_target_pct = 0.09   # 9%
        
        monthly_target = account_value * monthly_target_pct
        
        # Break down by strategy (approximate allocation)
        strategy_allocation = {
            '0DTE': 0.25,           # 25% from 0DTE
            'Strangle': 0.20,       # 20% from strangles
            'LT112': 0.30,          # 30% from LT112 (core)
            'IPMCC': 0.15,          # 15% from IPMCC
            'LEAP': 0.10            # 10% from LEAP
        }
        
        breakdown = {}
        for strategy, allocation in strategy_allocation.items():
            breakdown[strategy] = monthly_target * allocation
        
        return {
            'monthly_target': monthly_target,
            'monthly_target_pct': monthly_target_pct * 100,
            'strategy_breakdown': breakdown,
            'note': 'Based on 50% profit targets with proper position sizing'
        }


# Usage in main algorithm:
#