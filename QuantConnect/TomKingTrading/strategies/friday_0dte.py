# Friday 0DTE Iron Condors - Tom King's Signature Strategy
# 88% Win Rate Target with ATR-Based Strike Selection
# Entry: Exactly 10:30 AM EST on Fridays only
# VIX Filter: Only trade if VIX > 22

from AlgorithmImports import *
from datetime import datetime, timedelta, time
import math

class Friday0DTEIronCondorsStrategy:
    """
    Tom King Framework v17 - Friday 0DTE Iron Condors Strategy
    
    This is Tom King's signature strategy with 88% historical win rate.
    
    Key Specifications:
    - Entry Time: Exactly 10:30 AM EST on Fridays ONLY
    - VIX Filter: Only trade if VIX > 22 (critical requirement)
    - Strike Selection: ATR × 0.7 calculation for width
    - Position Sizing: Kelly Criterion-based (25% fractional)
    - Profit Target: 50% of credit received
    - Stop Loss: 2x credit received (200%)
    - Products: SPY, IWM, QQQ options
    - Correlation Group: A1 (Equities) - max 2-3 positions
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Tom King Framework Parameters
        self.entry_time = time(10, 30, 0)  # EXACTLY 10:30:00 AM EST
        self.entry_window_minutes = 5      # 5-minute entry window
        self.vix_threshold = 22.0          # Critical VIX filter
        self.atr_multiplier = 0.7          # ATR × 0.7 for strike width
        self.atr_periods = 14              # 14-period ATR
        
        # Target symbols (correlation group A1)
        self.target_symbols = ['SPY', 'IWM', 'QQQ']
        self.symbol_priorities = {'SPY': 1, 'QQQ': 2, 'IWM': 3}  # Trade priority
        
        # Risk management
        self.profit_target = 0.50          # 50% profit target
        self.stop_loss_multiplier = 2.0    # 200% of credit received
        self.max_positions_per_friday = 3  # All three symbols max
        self.kelly_fraction = 0.25         # 25% fractional Kelly
        
        # Position tracking
        self.active_positions = {}         # Current Friday positions
        self.position_entry_credits = {}   # Entry credits for P&L calculation
        self.positions_today = 0           # Count for today
        self.entry_attempted_today = False
        
        # Performance tracking
        self.total_friday_trades = 0
        self.winning_friday_trades = 0
        self.total_friday_pnl = 0
        self.friday_trade_log = []         # Detailed trade history
        
        # ATR tracking for each symbol
        self.atr_indicators = {}
        self.price_history = {}            # For ATR calculation
        
        self.InitializeATRIndicators()
        
        self.algo.Log("Friday 0DTE Iron Condors Strategy Initialized")
        self.algo.Log(f"  Entry Time: {self.entry_time} EST (5-minute window)")
        self.algo.Log(f"  VIX Threshold: >{self.vix_threshold} (CRITICAL)")
        self.algo.Log(f"  ATR Multiplier: {self.atr_multiplier}x for strike width")
        self.algo.Log(f"  Target Win Rate: 88%+ (Tom King historical)")
    
    def InitializeATRIndicators(self):
        """Initialize ATR indicators for strike calculation"""
        for symbol_str in self.target_symbols:
            # Initialize price history for ATR calculation
            self.price_history[symbol_str] = []
            
            # Create simple ATR tracking
            self.atr_indicators[symbol_str] = {
                'values': [],
                'current_atr': 0,
                'last_close': 0
            }
    
    def CheckFridayEntry(self):
        """Check for Friday 0DTE entry opportunity at exactly 10:30 AM"""
        # CRITICAL: Only execute on Fridays
        if self.algo.Time.weekday() != 4:  # 4 = Friday
            return
        
        # CRITICAL: Only within entry time window (10:30-10:35 AM)
        current_time = self.algo.Time.time()
        entry_end = time(10, 35, 0)
        
        if not (self.entry_time <= current_time <= entry_end):
            return
        
        # Prevent multiple entries on same day
        today = self.algo.Time.date()
        if hasattr(self, 'last_entry_date') and self.last_entry_date == today:
            if self.entry_attempted_today:
                return
        else:
            self.last_entry_date = today
            self.entry_attempted_today = False
            self.positions_today = 0
        
        self.entry_attempted_today = True
        
        # CRITICAL VIX CHECK: Only trade if VIX > 22
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix <= self.vix_threshold:
            self.algo.Log(f"Friday 0DTE SKIPPED - VIX too low: {current_vix:.2f} (need >{self.vix_threshold})")
            return
        
        # Phase and buying power checks
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase < 2:  # Need at least Phase 2 for 0DTE
            self.algo.Log(f"Friday 0DTE SKIPPED - Phase {current_phase} too low (need Phase 2+)")
            return
        
        # Check correlation group limits (A1 - Equities)
        if hasattr(self.algo, 'CheckCorrelationLimits'):
            if not self.algo.CheckCorrelationLimits('A1'):
                self.algo.Log("Friday 0DTE SKIPPED - Correlation group A1 at limit")
                return
        
        # Buying power check
        max_bp = getattr(self.algo, 'GetMaxBPForVIX', lambda: 0.75)()
        current_bp = getattr(self.algo, 'GetBuyingPowerUsedPercent', lambda: 0.5)()
        
        if current_bp > max_bp * 0.85:  # Leave 15% buffer
            self.algo.Log(f"Friday 0DTE SKIPPED - BP used: {current_bp:.1%} (max: {max_bp:.1%})")
            return
        
        # August 2024 crash protection
        portfolio_heat = getattr(self.algo, 'portfolio_heat', 0.3)
        if portfolio_heat > 0.60:
            self.algo.Log(f"Friday 0DTE SKIPPED - Portfolio heat too high: {portfolio_heat:.1%}")
            return
        
        self.algo.Log(f"Friday 0DTE CONDITIONS MET - VIX: {current_vix:.1f} | Phase: {current_phase} | BP: {current_bp:.1%}")
        
        # Evaluate symbols in priority order
        self.EvaluateSymbolsForEntry()
    
    def EvaluateSymbolsForEntry(self):
        """Evaluate symbols for 0DTE Iron Condor entry in priority order"""
        # Sort symbols by priority (SPY first, then QQQ, then IWM)
        sorted_symbols = sorted(self.target_symbols, key=lambda s: self.symbol_priorities.get(s, 99))
        
        for symbol_str in sorted_symbols:
            if self.positions_today >= self.max_positions_per_friday:
                self.algo.Log(f"Friday 0DTE - Max positions reached: {self.positions_today}")
                break
            
            # Skip if already have position
            if symbol_str in self.active_positions:
                continue
            
            # Update ATR for this symbol
            self.UpdateATR(symbol_str)
            
            # Attempt entry
            success = self.AttemptIronCondorEntry(symbol_str)
            if success:
                self.positions_today += 1
                # Continue to potentially trade other symbols
    
    def UpdateATR(self, symbol_str):
        """Update ATR calculation for strike width determination"""
        if symbol_str not in self.algo.Securities:
            return
        
        current_price = self.algo.Securities[symbol_str].Price
        if current_price <= 0:
            return
        
        atr_data = self.atr_indicators[symbol_str]
        
        # Get historical data if we don't have enough
        if len(atr_data['values']) < self.atr_periods:
            try:
                # Get recent daily data for ATR calculation
                history = self.algo.History(self.algo.Securities[symbol_str].Symbol, 
                                          self.atr_periods + 5, Resolution.Daily)
                
                if not history.empty and 'high' in history.columns:
                    for index, row in history.iterrows():
                        high = row['high']
                        low = row['low']
                        close = row['close']
                        prev_close = atr_data['last_close'] if atr_data['last_close'] > 0 else close
                        
                        # Calculate True Range
                        tr1 = high - low
                        tr2 = abs(high - prev_close)
                        tr3 = abs(low - prev_close)
                        true_range = max(tr1, tr2, tr3)
                        
                        atr_data['values'].append(true_range)
                        atr_data['last_close'] = close
                        
                        # Keep only last N periods
                        if len(atr_data['values']) > self.atr_periods:
                            atr_data['values'].pop(0)
            
            except Exception as e:
                self.algo.Log(f"ATR calculation error for {symbol_str}: {str(e)}")
        
        # Calculate current ATR
        if len(atr_data['values']) >= self.atr_periods:
            atr_data['current_atr'] = sum(atr_data['values']) / len(atr_data['values'])
        else:
            # Fallback: use 2% of current price as ATR estimate
            atr_data['current_atr'] = current_price * 0.02
    
    def AttemptIronCondorEntry(self, symbol_str):
        """Attempt to enter Iron Condor with ATR-based strike selection"""
        try:
            # Get option chain for 0DTE
            underlying = self.algo.Securities[symbol_str]
            contracts = self.algo.OptionChainProvider.GetOptionContractList(
                underlying.Symbol, self.algo.Time
            )
            
            # Filter for 0DTE (same day expiration)
            expiry_date = self.algo.Time.date()
            zero_dte_contracts = [c for c in contracts 
                                 if c.ID.Date.date() == expiry_date]
            
            if len(zero_dte_contracts) < 4:
                self.algo.Log(f"Insufficient 0DTE contracts for {symbol_str}: {len(zero_dte_contracts)}")
                return False
            
            # Get current price and ATR
            current_price = underlying.Price
            current_atr = self.atr_indicators[symbol_str]['current_atr']
            
            if current_atr <= 0:
                current_atr = current_price * 0.02  # Fallback 2%
            
            # Tom King ATR-based strike selection (ATR × 0.7)
            strike_width = current_atr * self.atr_multiplier
            
            # Iron Condor strike selection
            # Short strikes: +/- 0.5 * strike_width from current price
            # Long strikes: +/- 1.5 * strike_width from current price
            
            put_short_strike = current_price - (strike_width * 0.5)
            put_long_strike = current_price - (strike_width * 1.5)
            call_short_strike = current_price + (strike_width * 0.5)
            call_long_strike = current_price + (strike_width * 1.5)
            
            # Find actual option contracts
            puts = [c for c in zero_dte_contracts if c.ID.OptionRight == OptionRight.Put]
            calls = [c for c in zero_dte_contracts if c.ID.OptionRight == OptionRight.Call]
            
            if len(puts) < 2 or len(calls) < 2:
                self.algo.Log(f"Insufficient put/call contracts for {symbol_str}")
                return False
            
            # Select closest strikes
            puts.sort(key=lambda x: x.ID.StrikePrice)
            calls.sort(key=lambda x: x.ID.StrikePrice)
            
            put_short = min(puts, key=lambda x: abs(x.ID.StrikePrice - put_short_strike))
            put_long = min(puts, key=lambda x: abs(x.ID.StrikePrice - put_long_strike))
            call_short = min(calls, key=lambda x: abs(x.ID.StrikePrice - call_short_strike))
            call_long = min(calls, key=lambda x: abs(x.ID.StrikePrice - call_long_strike))
            
            # Validate Iron Condor structure
            if not self.ValidateIronCondorStructure(put_long, put_short, call_short, call_long, current_price):
                self.algo.Log(f"Invalid Iron Condor structure for {symbol_str}")
                return False
            
            # Calculate position size using enhanced Kelly Criterion
            position_size = self.CalculateKellyPositionSize(symbol_str, current_price)
            
            if position_size <= 0:
                self.algo.Log(f"Position size calculation failed for {symbol_str}")
                return False
            
            # Execute Iron Condor
            success = self.ExecuteIronCondor(
                symbol_str, put_long, put_short, call_short, call_long, 
                position_size, current_price, strike_width
            )
            
            return success
            
        except Exception as e:
            self.algo.Log(f"Error attempting Iron Condor entry for {symbol_str}: {str(e)}")
            return False
    
    def ValidateIronCondorStructure(self, put_long, put_short, call_short, call_long, current_price):
        """Validate Iron Condor has proper structure and reasonable strikes"""
        # Check strike ordering
        if not (put_long.ID.StrikePrice < put_short.ID.StrikePrice < current_price < 
                call_short.ID.StrikePrice < call_long.ID.StrikePrice):
            return False
        
        # Check minimum strike separation (at least $1 for SPY/QQQ, $0.50 for IWM)
        min_separation = 0.50 if 'IWM' in str(put_long.Symbol) else 1.00
        
        put_spread_width = put_short.ID.StrikePrice - put_long.ID.StrikePrice
        call_spread_width = call_long.ID.StrikePrice - call_short.ID.StrikePrice
        
        if put_spread_width < min_separation or call_spread_width < min_separation:
            return False
        
        # Check maximum spread width (avoid excessive risk)
        max_width = current_price * 0.05  # 5% of underlying price
        if put_spread_width > max_width or call_spread_width > max_width:
            return False
        
        # Check strike reasonableness (not too far OTM)
        put_distance = (current_price - put_short.ID.StrikePrice) / current_price
        call_distance = (call_short.ID.StrikePrice - current_price) / current_price
        
        if put_distance > 0.05 or call_distance > 0.05:  # More than 5% OTM
            return False
        
        return True
    
    def CalculateKellyPositionSize(self, symbol_str, current_price):
        """Calculate position size using Kelly Criterion with Tom King parameters"""
        # Tom King Kelly parameters for 0DTE
        win_rate = 0.88  # 88% historical win rate
        avg_win = 0.50   # 50% profit target
        avg_loss = 2.00  # 200% stop loss
        
        # Kelly calculation: f = (p * b - q) / b
        p = win_rate
        q = 1 - win_rate
        b = avg_win / avg_loss  # win/loss ratio
        
        if b <= 0:
            return 0
        
        kelly = (p * b - q) / b
        
        # Apply 25% fractional Kelly (Tom King specification)
        kelly_fraction = kelly * self.kelly_fraction
        
        # Phase-based adjustments
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase <= 2:
            kelly_fraction *= 0.8  # More conservative for smaller accounts
        
        # VIX-based adjustments
        current_vix = getattr(self.algo, 'current_vix', 22)
        if current_vix > 30:
            kelly_fraction *= 0.7  # More conservative in high vol
        elif current_vix > 25:
            kelly_fraction *= 0.85
        
        # Convert to contract count
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        position_value = portfolio_value * kelly_fraction
        
        # Estimate capital requirement per contract (simplified)
        margin_per_contract = current_price * 0.20  # Rough estimate
        contracts = max(1, min(int(position_value / margin_per_contract), 15))  # Cap at 15
        
        return contracts
    
    def ExecuteIronCondor(self, symbol_str, put_long, put_short, call_short, call_long, 
                         contracts, current_price, strike_width):
        """Execute the Iron Condor trade"""
        try:
            # Place individual leg orders for better fill control
            put_short_ticket = self.algo.Sell(put_short.Symbol, contracts)
            put_long_ticket = self.algo.Buy(put_long.Symbol, contracts)
            call_short_ticket = self.algo.Sell(call_short.Symbol, contracts)
            call_long_ticket = self.algo.Buy(call_long.Symbol, contracts)
            
            # Verify all orders were placed
            if not all([put_short_ticket, put_long_ticket, call_short_ticket, call_long_ticket]):
                self.algo.Log(f"Failed to place all Iron Condor orders for {symbol_str}")
                return False
            
            # Calculate entry credit (estimated)
            entry_credit = self.EstimateEntryCredit(
                put_short, put_long, call_short, call_long, contracts
            )
            
            # Create position tracking
            position_id = f"{symbol_str}_IC_0DTE_{self.algo.Time.strftime('%Y%m%d_%H%M')}"
            
            self.active_positions[position_id] = {
                'symbol': symbol_str,
                'put_short': put_short.Symbol,
                'put_long': put_long.Symbol,
                'call_short': call_short.Symbol,
                'call_long': call_long.Symbol,
                'contracts': contracts,
                'entry_time': self.algo.Time,
                'entry_price': current_price,
                'strike_width': strike_width,
                'atr_used': self.atr_indicators[symbol_str]['current_atr'],
                'profit_target': entry_credit * self.profit_target,
                'stop_loss': entry_credit * self.stop_loss_multiplier,
                'status': 'open'
            }
            
            self.position_entry_credits[position_id] = entry_credit
            
            # Update correlation tracking
            if hasattr(self.algo, 'correlation_positions'):
                self.algo.correlation_positions['A1'].append(position_id)
            
            # Update performance tracking
            self.total_friday_trades += 1
            if hasattr(self.algo, 'strategy_performance'):
                self.algo.strategy_performance['IRON_CONDOR_0DTE']['trades'] += 1
            
            # Log successful entry
            self.LogSuccessfulEntry(symbol_str, position_id, put_long, put_short, 
                                  call_short, call_long, contracts, current_price, 
                                  strike_width, entry_credit)
            
            return True
            
        except Exception as e:
            self.algo.Log(f"Error executing Iron Condor for {symbol_str}: {str(e)}")
            return False
    
    def EstimateEntryCredit(self, put_short, put_long, call_short, call_long, contracts):
        """Estimate entry credit for the Iron Condor"""
        try:
            # Calculate net credit (what we receive)
            credit = 0
            
            # Add premiums received (short positions)
            if put_short.Symbol in self.algo.Securities:
                credit += self.algo.Securities[put_short.Symbol].BidPrice
            if call_short.Symbol in self.algo.Securities:
                credit += self.algo.Securities[call_short.Symbol].BidPrice
            
            # Subtract premiums paid (long positions)
            if put_long.Symbol in self.algo.Securities:
                credit -= self.algo.Securities[put_long.Symbol].AskPrice
            if call_long.Symbol in self.algo.Securities:
                credit -= self.algo.Securities[call_long.Symbol].AskPrice
            
            # Convert to total dollar credit
            total_credit = credit * contracts * 100  # Options multiplier
            
            return max(0, total_credit)  # Ensure non-negative
            
        except:
            # Fallback estimate
            return contracts * 50  # $50 per contract estimate
    
    def LogSuccessfulEntry(self, symbol_str, position_id, put_long, put_short, 
                          call_short, call_long, contracts, current_price, 
                          strike_width, entry_credit):
        """Log detailed entry information"""
        current_vix = getattr(self.algo, 'current_vix', 22)
        
        self.algo.Log(f"FRIDAY 0DTE IRON CONDOR EXECUTED: {symbol_str}")
        self.algo.Log(f"  Position ID: {position_id}")
        self.algo.Log(f"  Underlying Price: ${current_price:.2f}")
        self.algo.Log(f"  ATR-Based Width: ${strike_width:.2f} (ATR × {self.atr_multiplier})")
        self.algo.Log(f"  Put Spread: ${put_short.ID.StrikePrice:.0f}/${put_long.ID.StrikePrice:.0f}")
        self.algo.Log(f"  Call Spread: ${call_short.ID.StrikePrice:.0f}/${call_long.ID.StrikePrice:.0f}")
        self.algo.Log(f"  Contracts: {contracts}")
        self.algo.Log(f"  Entry Credit: ${entry_credit:.2f}")
        self.algo.Log(f"  VIX: {current_vix:.1f} | Entry Time: {self.algo.Time.strftime('%H:%M:%S')}")
        self.algo.Log(f"  Profit Target: ${entry_credit * self.profit_target:.2f} (50%)")
        self.algo.Log(f"  Stop Loss: ${entry_credit * self.stop_loss_multiplier:.2f} (200%)")
    
    def CheckPositionManagement(self):
        """Check all 0DTE positions for profit/loss management"""
        for position_id, position_data in list(self.active_positions.items()):
            if position_data['status'] != 'open':
                continue
            
            # Check if position has expired (EOD for 0DTE)
            if self.algo.Time.hour >= 16:  # 4 PM ET - market close
                self.ClosePosition(position_id, position_data, "Market Close - 0DTE Expiry")
                continue
            
            # Check profit/loss targets
            self.CheckPositionProfitLoss(position_id, position_data)
    
    def CheckPositionProfitLoss(self, position_id, position_data):
        """Check individual position for profit/loss targets"""
        try:
            # Calculate current position value
            current_value = self.GetCurrentPositionValue(position_data)
            entry_credit = self.position_entry_credits.get(position_id, 0)
            
            if entry_credit <= 0:
                return
            
            # Calculate P&L
            current_pnl = entry_credit - current_value
            pnl_percentage = current_pnl / entry_credit
            
            # Check 50% profit target
            if pnl_percentage >= self.profit_target:
                self.ClosePosition(position_id, position_data, 
                                 f"Profit Target Hit ({pnl_percentage:.1%})")
                self.winning_friday_trades += 1
                self.total_friday_pnl += current_pnl
                
                # Update strategy performance
                if hasattr(self.algo, 'strategy_performance'):
                    self.algo.strategy_performance['IRON_CONDOR_0DTE']['wins'] += 1
                    self.algo.strategy_performance['IRON_CONDOR_0DTE']['total_pnl'] += current_pnl
            
            # Check 200% stop loss
            elif current_pnl <= -(entry_credit * self.stop_loss_multiplier):
                self.ClosePosition(position_id, position_data, 
                                 f"Stop Loss Hit ({pnl_percentage:.1%})")
                self.total_friday_pnl += current_pnl
            
            # Log position status every hour
            elif self.algo.Time.minute == 0:  # Top of each hour
                self.algo.Log(f"0DTE Position {position_id}: P&L {pnl_percentage:.1%} | Target: {self.profit_target:.0%}")
                
        except Exception as e:
            self.algo.Log(f"Error checking P&L for {position_id}: {str(e)}")
    
    def GetCurrentPositionValue(self, position_data):
        """Calculate current value of Iron Condor position"""
        try:
            value = 0
            contracts = position_data['contracts']
            
            # Short put value (we owe this)
            if position_data['put_short'] in self.algo.Securities:
                value += self.algo.Securities[position_data['put_short']].AskPrice * contracts * 100
            
            # Long put value (we own this)
            if position_data['put_long'] in self.algo.Securities:
                value -= self.algo.Securities[position_data['put_long']].BidPrice * contracts * 100
            
            # Short call value (we owe this)
            if position_data['call_short'] in self.algo.Securities:
                value += self.algo.Securities[position_data['call_short']].AskPrice * contracts * 100
            
            # Long call value (we own this)
            if position_data['call_long'] in self.algo.Securities:
                value -= self.algo.Securities[position_data['call_long']].BidPrice * contracts * 100
            
            return max(0, value)  # Cost to close position
            
        except Exception as e:
            self.algo.Log(f"Error calculating position value: {str(e)}")
            return 0
    
    def ClosePosition(self, position_id, position_data, reason):
        """Close Iron Condor position"""
        try:
            contracts = position_data['contracts']
            
            # Close all legs (opposite of opening)
            self.algo.Buy(position_data['put_short'], contracts)   # Buy back short put
            self.algo.Sell(position_data['put_long'], contracts)   # Sell long put
            self.algo.Buy(position_data['call_short'], contracts)  # Buy back short call
            self.algo.Sell(position_data['call_long'], contracts)  # Sell long call
            
            # Calculate final P&L
            entry_credit = self.position_entry_credits.get(position_id, 0)
            exit_cost = self.GetCurrentPositionValue(position_data)
            final_pnl = entry_credit - exit_cost
            
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
            days_held = (self.algo.Time - position_data['entry_time']).total_seconds() / 3600  # Hours
            self.algo.Log(f"FRIDAY 0DTE CLOSED: {position_id}")
            self.algo.Log(f"  Reason: {reason}")
            self.algo.Log(f"  Final P&L: ${final_pnl:+.2f}")
            self.algo.Log(f"  Hours Held: {days_held:.1f}")
            self.algo.Log(f"  Underlying Final: ${self.algo.Securities[position_data['symbol']].Price:.2f}")
            
            # Add to trade log
            self.friday_trade_log.append({
                'position_id': position_id,
                'symbol': position_data['symbol'],
                'entry_time': position_data['entry_time'],
                'exit_time': position_data['exit_time'],
                'reason': reason,
                'pnl': final_pnl,
                'hours_held': days_held
            })
            
        except Exception as e:
            self.algo.Log(f"Error closing position {position_id}: {str(e)}")
    
    def GetFridayPerformanceReport(self):
        """Generate comprehensive Friday 0DTE performance report"""
        total_trades = self.total_friday_trades
        win_rate = (self.winning_friday_trades / max(1, total_trades)) * 100
        avg_pnl = self.total_friday_pnl / max(1, total_trades)
        
        return {
            'strategy': 'FRIDAY_0DTE_IRON_CONDORS',
            'total_trades': total_trades,
            'winning_trades': self.winning_friday_trades,
            'losing_trades': total_trades - self.winning_friday_trades,
            'win_rate': win_rate,
            'target_win_rate': 88.0,
            'win_rate_vs_target': win_rate - 88.0,
            'total_pnl': self.total_friday_pnl,
            'avg_pnl_per_trade': avg_pnl,
            'active_positions': len([p for p in self.active_positions.values() if p['status'] == 'open']),
            'positions_today': self.positions_today
        }
