# Enhanced Long Term 1-1-2 Put Spreads - Tom King Framework v17
# 120 DTE with Hedge Monetization System
# Entry: First Wednesday of month | Win Rate Target: 75%

from AlgorithmImports import *
from datetime import datetime, timedelta
import math

class EnhancedLT112Strategy:
    """
    Enhanced Long Term 1-1-2 Put Spreads - Tom King Framework v17
    
    Key Enhancements:
    - DTE: 120 days (optimized from standard 45-60)
    - Entry Schedule: First Wednesday of month
    - Structure: 1 put debit spread + 2 naked puts
    - Delta Targets: 7% OTM debit spread, 12% OTM naked puts
    - Hedge Monetization: Weekly calls sold against long put after day 30
    - Management: 90% credit target on naked puts
    - Win Rate Target: 75%
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Enhanced Tom King Framework Parameters
        self.target_dte = 120           # Enhanced: 120 days vs standard 45-60
        self.management_dte = 21        # Tom King 21 DTE rule
        self.profit_target = 0.50       # 50% profit target on spread
        self.naked_put_target = 0.90    # 90% credit target on naked puts
        self.hedge_start_day = 30       # Start hedge monetization after 30 days
        
        # Delta targets for strike selection
        self.debit_spread_otm = 0.07    # 7% OTM for debit spread
        self.naked_puts_otm = 0.12      # 12% OTM for naked puts
        
        # Entry timing
        self.entry_day = 2              # Wednesday (0=Monday, 2=Wednesday)
        self.max_entry_week = 1         # First week of month only
        
        # Position tracking
        self.active_positions = {}      # Active LT112 positions
        self.hedge_positions = {}       # Active hedge call positions
        self.position_entry_data = {}   # Entry data for management
        
        # Performance tracking
        self.total_lt112_trades = 0
        self.profitable_lt112_trades = 0
        self.total_lt112_pnl = 0
        self.hedge_pnl = 0             # P&L from hedge monetization
        self.monthly_entries = 0        # Track monthly entry count
        
        # Risk management
        self.max_positions_per_symbol = 2  # Maximum 2 LT112 per symbol
        self.position_allocation = 0.08     # 8% of portfolio per LT112
        
        self.algo.Log("Enhanced LT112 Strategy Initialized")
        self.algo.Log(f"  Enhanced DTE: {self.target_dte} days (vs standard 45-60)")
        self.algo.Log(f"  Entry: First Wednesday of month")
        self.algo.Log(f"  Structure: 1 debit spread + 2 naked puts")
        self.algo.Log(f"  Hedge Monetization: After day {self.hedge_start_day}")
        self.algo.Log(f"  Target Win Rate: 75%")
    
    def CheckMonthlyEntry(self):
        """Check for LT112 entry on first Wednesday of month"""
        # Only execute on Wednesdays
        if self.algo.Time.weekday() != self.entry_day:
            return
        
        # Only in first week of month
        if self.algo.Time.day > 7:
            return
        
        # Reset monthly tracking if new month
        current_month = self.algo.Time.month
        if not hasattr(self, 'last_entry_month') or self.last_entry_month != current_month:
            self.last_entry_month = current_month
            self.monthly_entries = 0
        
        # Prevent multiple entries same month
        if self.monthly_entries >= 3:  # Max 3 entries per month
            return
        
        # Phase requirement (Phase 2+ for LT112)
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase < 2:
            self.algo.Log(f"LT112 SKIPPED - Phase {current_phase} < required Phase 2")
            return
        
        # VIX regime check - prefer normal to elevated volatility
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix < 16:
            self.algo.Log(f"LT112 SKIPPED - VIX too low: {current_vix:.1f} (need >16 for put premiums)")
            return
        
        if current_vix > 35:
            self.algo.Log(f"LT112 SKIPPED - VIX too high: {current_vix:.1f} (avoid extreme volatility)")
            return
        
        # Correlation group check (A1 - Equities)
        if hasattr(self.algo, 'CheckCorrelationLimits'):
            if not self.algo.CheckCorrelationLimits('A1'):
                self.algo.Log("LT112 SKIPPED - Correlation group A1 at limit")
                return
        
        # Buying power check
        bp_used = getattr(self.algo, 'GetBuyingPowerUsedPercent', lambda: 0.5)()
        if bp_used > 0.75:
            self.algo.Log(f"LT112 SKIPPED - BP used: {bp_used:.1%} (need <75%)")
            return
        
        self.algo.Log(f"LT112 Entry Conditions Met - VIX: {current_vix:.1f} | Phase: {current_phase}")
        
        # Evaluate symbols for entry
        self.EvaluateSymbolsForEntry()
    
    def EvaluateSymbolsForEntry(self):
        """Evaluate symbols for LT112 entry"""
        # Primary symbols for LT112
        target_symbols = ['SPY', 'IWM']  # Focus on SPY and IWM
        
        for symbol_str in target_symbols:
            # Check position limits
            current_positions = sum(1 for pos_id, pos_data in self.active_positions.items() 
                                   if pos_data.get('symbol') == symbol_str)
            
            if current_positions >= self.max_positions_per_symbol:
                continue
            
            # Attempt entry
            success = self.AttemptLT112Entry(symbol_str)
            if success:
                self.monthly_entries += 1
                # Continue to potentially add more positions
    
    def AttemptLT112Entry(self, symbol_str):
        """Attempt to enter Enhanced LT112 position with hedge monetization"""
        try:
            # Get options chain
            underlying = self.algo.Securities[symbol_str]
            contracts = self.algo.OptionChainProvider.GetOptionContractList(
                underlying.Symbol, self.algo.Time
            )
            
            # Filter for 120 DTE target (110-130 days)
            target_expiry = self.algo.Time + timedelta(days=self.target_dte)
            suitable_contracts = [c for c in contracts 
                                 if 110 <= (c.ID.Date - self.algo.Time).days <= 130]
            
            if len(suitable_contracts) < 6:
                self.algo.Log(f"Insufficient contracts for {symbol_str} LT112 (need 6+, found {len(suitable_contracts)})")
                return False
            
            # Get puts only
            puts = [c for c in suitable_contracts if c.ID.OptionRight == OptionRight.Put]
            
            if len(puts) < 4:
                self.algo.Log(f"Insufficient puts for {symbol_str} LT112 (need 4+, found {len(puts)})")
                return False
            
            # Get current price for delta calculations
            current_price = underlying.Price
            
            # Enhanced strike selection with Tom King delta targets
            strikes = self.SelectLT112Strikes(puts, current_price)
            
            if not strikes:
                self.algo.Log(f"Could not select appropriate strikes for {symbol_str} LT112")
                return False
            
            # Calculate position size
            position_size = self.CalculateLT112PositionSize(symbol_str, current_price)
            
            if position_size <= 0:
                self.algo.Log(f"Position size calculation failed for {symbol_str} LT112")
                return False
            
            # Execute Enhanced LT112 structure
            success = self.ExecuteEnhancedLT112(
                symbol_str, strikes, position_size, current_price
            )
            
            return success
            
        except Exception as e:
            self.algo.Log(f"Error attempting LT112 entry for {symbol_str}: {str(e)}")
            return False
    
    def SelectLT112Strikes(self, puts, current_price):
        """Select strikes using Tom King delta targets"""
        puts.sort(key=lambda x: x.ID.StrikePrice, reverse=True)  # Highest to lowest
        
        # Calculate target strikes based on delta approximations
        # 7% OTM for debit spread
        debit_long_strike = current_price * (1 - self.debit_spread_otm)   # 7% OTM
        debit_short_strike = current_price * (1 - self.debit_spread_otm - 0.05)  # 12% OTM
        
        # 12% OTM for naked puts
        naked_put_strike = current_price * (1 - self.naked_puts_otm)      # 12% OTM
        
        # Find closest actual strikes
        try:
            debit_long = min(puts, key=lambda x: abs(x.ID.StrikePrice - debit_long_strike))
            debit_short = min(puts, key=lambda x: abs(x.ID.StrikePrice - debit_short_strike))
            naked_put = min(puts, key=lambda x: abs(x.ID.StrikePrice - naked_put_strike))
            
            # Validate strike relationships
            if not (debit_short.ID.StrikePrice < debit_long.ID.StrikePrice < current_price):
                self.algo.Log("Invalid debit spread strike relationship")
                return None
            
            if naked_put.ID.StrikePrice >= debit_long.ID.StrikePrice:
                self.algo.Log("Naked put strike too high relative to debit spread")
                return None
            
            # Ensure minimum separation (at least $2 for SPY, $1 for IWM)
            min_separation = 1.00 if 'IWM' in symbol_str else 2.00
            
            if (debit_long.ID.StrikePrice - debit_short.ID.StrikePrice) < min_separation:
                self.algo.Log(f"Debit spread width too narrow: ${debit_long.ID.StrikePrice - debit_short.ID.StrikePrice:.2f}")
                return None
            
            return {
                'debit_long': debit_long,      # Buy this put (higher strike)
                'debit_short': debit_short,    # Sell this put (lower strike)
                'naked_put': naked_put         # Sell this put (standalone)
            }
            
        except Exception as e:
            self.algo.Log(f"Error selecting LT112 strikes: {str(e)}")
            return None
    
    def CalculateLT112PositionSize(self, symbol_str, current_price):
        """Calculate position size for LT112 using portfolio allocation"""
        # Base allocation: 8% of portfolio per LT112
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        position_value = portfolio_value * self.position_allocation
        
        # Phase-based adjustments
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase <= 2:
            position_value *= 0.7  # More conservative for smaller accounts
        
        # VIX-based adjustments
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix > 25:
            position_value *= 0.8  # More conservative in high vol
        
        # Convert to contract count (simplified)
        # Estimate margin requirement (varies by broker)
        margin_per_contract = current_price * 0.25  # Rough estimate
        contracts = max(1, min(int(position_value / margin_per_contract), 8))  # Cap at 8
        
        return contracts
    
    def ExecuteEnhancedLT112(self, symbol_str, strikes, contracts, current_price):
        """Execute Enhanced LT112: 1 debit spread + 2 naked puts"""
        try:
            # Enhanced LT112 Structure:
            # 1. Buy 1 long put (debit spread long leg)
            # 2. Sell 1 short put (debit spread short leg) 
            # 3. Sell 2 additional naked puts (same strike as debit short or different)
            
            # Execute debit spread
            long_ticket = self.algo.Buy(strikes['debit_long'].Symbol, contracts)
            short_ticket = self.algo.Sell(strikes['debit_short'].Symbol, contracts)
            
            # Execute 2 naked puts
            naked_ticket = self.algo.Sell(strikes['naked_put'].Symbol, contracts * 2)
            
            # Verify all orders placed
            if not all([long_ticket, short_ticket, naked_ticket]):
                self.algo.Log(f"Failed to place all LT112 orders for {symbol_str}")
                return False
            
            # Calculate entry metrics
            debit_paid = self.EstimateDebitPaid(strikes['debit_long'], strikes['debit_short'], contracts)
            naked_credit = self.EstimateCreditReceived(strikes['naked_put'], contracts * 2)
            net_credit = naked_credit - debit_paid
            
            # Create position tracking
            position_id = f"{symbol_str}_LT112_{self.algo.Time.strftime('%Y%m%d')}"
            
            self.active_positions[position_id] = {
                'symbol': symbol_str,
                'debit_long': strikes['debit_long'].Symbol,
                'debit_short': strikes['debit_short'].Symbol,
                'naked_put': strikes['naked_put'].Symbol,
                'contracts': contracts,
                'entry_time': self.algo.Time,
                'expiry': strikes['debit_long'].ID.Date.date(),
                'entry_price': current_price,
                'dte_at_entry': (strikes['debit_long'].ID.Date - self.algo.Time).days,
                'debit_paid': debit_paid,
                'naked_credit': naked_credit,
                'net_credit': net_credit,
                'hedge_eligible': True,  # Can monetize after 30 days
                'hedge_active': False,   # No hedge yet
                'status': 'open'
            }
            
            self.position_entry_data[position_id] = {
                'debit_long_strike': strikes['debit_long'].ID.StrikePrice,
                'debit_short_strike': strikes['debit_short'].ID.StrikePrice,
                'naked_put_strike': strikes['naked_put'].ID.StrikePrice,
                'entry_vix': getattr(self.algo, 'current_vix', 20)
            }
            
            # Update tracking
            self.total_lt112_trades += 1
            
            # Update correlation tracking
            if hasattr(self.algo, 'correlation_positions'):
                self.algo.correlation_positions['A1'].append(position_id)
            
            # Update strategy performance
            if hasattr(self.algo, 'strategy_performance'):
                self.algo.strategy_performance['LT112']['trades'] += 1
            
            # Log successful entry
            self.LogLT112Entry(symbol_str, position_id, strikes, contracts, 
                              current_price, debit_paid, naked_credit, net_credit)
            
            return True
            
        except Exception as e:
            self.algo.Log(f"Error executing Enhanced LT112 for {symbol_str}: {str(e)}")
            return False
    
    def EstimateDebitPaid(self, long_put, short_put, contracts):
        """Estimate debit paid for put spread"""
        try:
            long_price = self.algo.Securities.get(long_put.Symbol)
            short_price = self.algo.Securities.get(short_put.Symbol)
            
            if long_price and short_price:
                debit_per_contract = long_price.AskPrice - short_price.BidPrice
                return max(0, debit_per_contract * contracts * 100)
            else:
                # Fallback estimate
                spread_width = long_put.ID.StrikePrice - short_put.ID.StrikePrice
                return spread_width * contracts * 100 * 0.3  # Estimate 30% of width
                
        except:
            return contracts * 200  # Conservative fallback
    
    def EstimateCreditReceived(self, put_option, contracts):
        """Estimate credit received from naked puts"""
        try:
            put_price = self.algo.Securities.get(put_option.Symbol)
            if put_price:
                return put_price.BidPrice * contracts * 100
            else:
                # Fallback estimate based on strike distance
                return contracts * 150  # Conservative estimate
        except:
            return contracts * 100  # Very conservative fallback
    
    def LogLT112Entry(self, symbol_str, position_id, strikes, contracts, current_price, 
                     debit_paid, naked_credit, net_credit):
        """Log detailed LT112 entry information"""
        current_vix = getattr(self.algo, 'current_vix', 20)
        dte = (strikes['debit_long'].ID.Date - self.algo.Time).days
        
        self.algo.Log(f"ENHANCED LT112 EXECUTED: {symbol_str}")
        self.algo.Log(f"  Position ID: {position_id}")
        self.algo.Log(f"  Enhanced DTE: {dte} days (120 target)")
        self.algo.Log(f"  Underlying Price: ${current_price:.2f}")
        self.algo.Log(f"  Debit Spread: Buy ${strikes['debit_long'].ID.StrikePrice:.0f} / Sell ${strikes['debit_short'].ID.StrikePrice:.0f}")
        self.algo.Log(f"  Naked Puts: Sell 2x ${strikes['naked_put'].ID.StrikePrice:.0f}")
        self.algo.Log(f"  Contracts: {contracts} (2x naked puts = {contracts * 2})")
        self.algo.Log(f"  Debit Paid: ${debit_paid:.2f} | Naked Credit: ${naked_credit:.2f}")
        self.algo.Log(f"  Net Credit: ${net_credit:.2f} | VIX: {current_vix:.1f}")
        self.algo.Log(f"  Hedge Eligible: Day 30+ (monetization system)")
    
    def CheckLT112Management(self):
        """Check all LT112 positions for management opportunities"""
        for position_id, position_data in list(self.active_positions.items()):
            if position_data['status'] != 'open':
                continue
            
            # Check hedge monetization opportunity
            self.CheckHedgeMonetization(position_id, position_data)
            
            # Check position exit conditions
            self.CheckLT112Exit(position_id, position_data)
    
    def CheckHedgeMonetization(self, position_id, position_data):
        """Check if position is eligible for hedge monetization (weekly calls)"""
        if not position_data['hedge_eligible'] or position_data['hedge_active']:
            return
        
        # Must be at least 30 days old
        days_held = (self.algo.Time - position_data['entry_time']).days
        if days_held < self.hedge_start_day:
            return
        
        # Only monetize on Fridays (weekly options expiration)
        if self.algo.Time.weekday() != 4:  # Not Friday
            return
        
        # Only if position is profitable on naked puts
        current_naked_value = self.GetNakedPutsValue(position_data)
        if current_naked_value > position_data['naked_credit'] * 0.5:  # Less than 50% profit
            return
        
        self.ExecuteHedgeMonetization(position_id, position_data)
    
    def GetNakedPutsValue(self, position_data):
        """Get current value of naked puts (cost to buy back)"""
        try:
            if position_data['naked_put'] in self.algo.Securities:
                put_price = self.algo.Securities[position_data['naked_put']].AskPrice
                return put_price * position_data['contracts'] * 2 * 100  # 2x naked puts
            return position_data['naked_credit']  # Fallback
        except:
            return position_data['naked_credit']  # Conservative fallback
    
    def ExecuteHedgeMonetization(self, position_id, position_data):
        """Execute hedge monetization by selling weekly calls against long put"""
        try:
            symbol_str = position_data['symbol']
            underlying = self.algo.Securities[symbol_str]
            current_price = underlying.Price
            
            # Get weekly call options (7-14 DTE)
            contracts = self.algo.OptionChainProvider.GetOptionContractList(
                underlying.Symbol, self.algo.Time
            )
            
            # Filter for weekly calls
            weekly_calls = [c for c in contracts 
                           if c.ID.OptionRight == OptionRight.Call and 
                           7 <= (c.ID.Date - self.algo.Time).days <= 14]
            
            if not weekly_calls:
                return
            
            # Select ATM or slightly OTM call
            target_strike = current_price * 1.02  # 2% OTM
            selected_call = min(weekly_calls, key=lambda x: abs(x.ID.StrikePrice - target_strike))
            
            # Sell calls (same quantity as long puts for protection)
            hedge_ticket = self.algo.Sell(selected_call.Symbol, position_data['contracts'])
            
            if hedge_ticket:
                # Track hedge position
                hedge_id = f"{position_id}_HEDGE_{self.algo.Time.strftime('%m%d')}"
                self.hedge_positions[hedge_id] = {
                    'parent_position': position_id,
                    'call_symbol': selected_call.Symbol,
                    'contracts': position_data['contracts'],
                    'entry_time': self.algo.Time,
                    'expiry': selected_call.ID.Date.date(),
                    'strike': selected_call.ID.StrikePrice
                }
                
                position_data['hedge_active'] = True
                
                self.algo.Log(f"HEDGE MONETIZATION: {position_id}")
                self.algo.Log(f"  Sold {position_data['contracts']} weekly calls at ${selected_call.ID.StrikePrice:.0f}")
                self.algo.Log(f"  Hedge expires: {selected_call.ID.Date.date()}")
                
        except Exception as e:
            self.algo.Log(f"Error executing hedge monetization for {position_id}: {str(e)}")
    
    def CheckLT112Exit(self, position_id, position_data):
        """Check LT112 position for exit conditions"""
        # Calculate current DTE
        current_dte = (position_data['expiry'] - self.algo.Time.date()).days
        
        # Tom King 21 DTE rule
        if current_dte <= self.management_dte:
            self.CloseLT112Position(position_id, position_data, "21 DTE Management Rule")
            return
        
        # Check 90% profit target on naked puts
        current_naked_value = self.GetNakedPutsValue(position_data)
        naked_profit_pct = (position_data['naked_credit'] - current_naked_value) / position_data['naked_credit']
        
        if naked_profit_pct >= self.naked_put_target:
            self.CloseLT112Position(position_id, position_data, 
                                   f"90% Naked Put Target ({naked_profit_pct:.1%})")
            return
        
        # Check overall position profit (50% target)
        total_pnl = self.CalculateLT112PnL(position_data)
        if total_pnl > 0 and total_pnl >= position_data['net_credit'] * self.profit_target:
            self.CloseLT112Position(position_id, position_data, 
                                   f"50% Overall Profit Target")
            return
        
        # Emergency management for significant underlying moves
        current_price = self.algo.Securities[position_data['symbol']].Price
        price_change = (current_price - position_data['entry_price']) / position_data['entry_price']
        
        # Close if underlying drops significantly toward short strikes
        entry_data = self.position_entry_data.get(position_id, {})
        naked_put_strike = entry_data.get('naked_put_strike', 0)
        
        if naked_put_strike > 0:
            strike_distance = (current_price - naked_put_strike) / current_price
            if strike_distance < 0.05 and current_dte < 60:  # Within 5% of strike with <60 DTE
                self.CloseLT112Position(position_id, position_data, "Emergency - ITM Risk")
    
    def CalculateLT112PnL(self, position_data):
        """Calculate current P&L for LT112 position"""
        try:
            pnl = 0
            contracts = position_data['contracts']
            
            # Debit spread P&L
            if position_data['debit_long'] in self.algo.Securities:
                long_value = self.algo.Securities[position_data['debit_long']].BidPrice * contracts * 100
                pnl += long_value
            
            if position_data['debit_short'] in self.algo.Securities:
                short_value = self.algo.Securities[position_data['debit_short']].AskPrice * contracts * 100
                pnl -= short_value
            
            # Naked puts P&L
            if position_data['naked_put'] in self.algo.Securities:
                naked_value = self.algo.Securities[position_data['naked_put']].AskPrice * contracts * 2 * 100
                pnl -= naked_value
            
            # Subtract initial debit and add initial credit
            pnl -= position_data['debit_paid']
            pnl += position_data['naked_credit']
            
            return pnl
            
        except Exception as e:
            self.algo.Log(f"Error calculating LT112 P&L: {str(e)}")
            return 0
    
    def CloseLT112Position(self, position_id, position_data, reason):
        """Close LT112 position and any associated hedges"""
        try:
            contracts = position_data['contracts']
            
            # Close main LT112 position
            self.algo.Sell(position_data['debit_long'], contracts)    # Sell long put
            self.algo.Buy(position_data['debit_short'], contracts)    # Buy back short put
            self.algo.Buy(position_data['naked_put'], contracts * 2) # Buy back 2 naked puts
            
            # Close any associated hedges
            hedges_to_close = [hedge_id for hedge_id, hedge_data in self.hedge_positions.items() 
                              if hedge_data['parent_position'] == position_id]
            
            for hedge_id in hedges_to_close:
                hedge_data = self.hedge_positions[hedge_id]
                self.algo.Buy(hedge_data['call_symbol'], hedge_data['contracts'])  # Buy back calls
                self.algo.Log(f"  Closed associated hedge: {hedge_id}")
                del self.hedge_positions[hedge_id]
            
            # Calculate final P&L
            final_pnl = self.CalculateLT112PnL(position_data)
            self.total_lt112_pnl += final_pnl
            
            if final_pnl > 0:
                self.profitable_lt112_trades += 1
                
                # Update strategy performance
                if hasattr(self.algo, 'strategy_performance'):
                    self.algo.strategy_performance['LT112']['wins'] += 1
                    self.algo.strategy_performance['LT112']['total_pnl'] += final_pnl
            
            # Update position status
            position_data['status'] = 'closed'
            position_data['exit_time'] = self.algo.Time
            position_data['exit_reason'] = reason
            position_data['final_pnl'] = final_pnl
            
            # Clean up correlation tracking
            if hasattr(self.algo, 'correlation_positions'):
                if position_id in self.algo.correlation_positions['A1']:
                    self.algo.correlation_positions['A1'].remove(position_id)
            
            # Log closure
            days_held = (self.algo.Time - position_data['entry_time']).days
            current_price = self.algo.Securities[position_data['symbol']].Price
            
            self.algo.Log(f"ENHANCED LT112 CLOSED: {position_id}")
            self.algo.Log(f"  Reason: {reason}")
            self.algo.Log(f"  Final P&L: ${final_pnl:+.2f}")
            self.algo.Log(f"  Days Held: {days_held} | Entry: ${position_data['entry_price']:.2f} | Exit: ${current_price:.2f}")
            self.algo.Log(f"  DTE Remaining: {(position_data['expiry'] - self.algo.Time.date()).days}")
            
        except Exception as e:
            self.algo.Log(f"Error closing LT112 position {position_id}: {str(e)}")
    
    def GetLT112PerformanceReport(self):
        """Generate comprehensive LT112 performance report"""
        total_trades = self.total_lt112_trades
        win_rate = (self.profitable_lt112_trades / max(1, total_trades)) * 100
        avg_pnl = self.total_lt112_pnl / max(1, total_trades)
        
        active_positions = len([p for p in self.active_positions.values() if p['status'] == 'open'])
        active_hedges = len(self.hedge_positions)
        
        return {
            'strategy': 'ENHANCED_LT112',
            'total_trades': total_trades,
            'profitable_trades': self.profitable_lt112_trades,
            'win_rate': win_rate,
            'target_win_rate': 75.0,
            'win_rate_vs_target': win_rate - 75.0,
            'total_pnl': self.total_lt112_pnl,
            'avg_pnl_per_trade': avg_pnl,
            'hedge_pnl': self.hedge_pnl,
            'active_positions': active_positions,
            'active_hedges': active_hedges,
            'monthly_entries': self.monthly_entries,
            'enhanced_features': [
                '120 DTE (vs standard 45-60)',
                'Hedge monetization system',
                'Delta-based strike selection',
                '90% naked put profit target'
            ]
        }
