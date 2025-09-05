# Long Term 112 Strategy - Tom King's High Win Rate Strategy
# 95% Win Rate Target, 3% Monthly Returns

from AlgorithmImports import *

class LongTerm112Strategy:
    """
    Tom King's Long Term 112 strategy (1-1-2 structure).
    Structure: 1 long put + 1 short put below + 2 short puts further OTM.
    45 DTE entry, 21 DTE defensive management, 50% profit target.
    95% theoretical win rate with shorts positioned at 5-delta.
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.symbols = ['SPY', 'IWM', 'QQQ']  # Phase 1 symbols
        self.target_dte = 45  # 45 DTE entry
        self.management_dte = 21  # 21 DTE management
        self.target_profit = 0.50  # 50% profit target
        self.max_risk_per_trade = 0.05  # 5% max risk per trade
        
        # Track performance
        self.trades = []
        self.wins = 0
        self.losses = 0
        self.monthly_target_return = 0.03  # 3% monthly target
    
    def Execute(self):
        """Execute Long Term 112 strategy"""
        # Only enter on first Wednesday of month (Tom King timing)
        if not self.IsFirstWednesday():
            self.CheckExistingPositions()
            return
        
        self.algo.Log("Evaluating Long Term 112 Strategy Entry")
        
        # Check each symbol for entry opportunities
        for symbol_str in self.symbols:
            if self.ShouldTradeSymbol(symbol_str):
                self.EnterLongTerm112(symbol_str)
    
    def IsFirstWednesday(self):
        """Check if today is first Wednesday of the month"""
        today = self.algo.Time
        
        # Must be Wednesday (weekday 2)
        if today.weekday() != 2:
            return False
        
        # Must be between 1st and 7th of month
        if today.day < 1 or today.day > 7:
            return False
        
        # Only after market open
        market_open = time(9, 30)
        if today.time() < market_open:
            return False
        
        return True
    
    def ShouldTradeSymbol(self, symbol_str):
        """Determine if we should enter LT112 on this symbol"""
        # Check if we already have a position
        if self.HasActivePosition(symbol_str):
            return False
        
        # Check buying power capacity
        if not self.algo.HasCapacity():
            return False
        
        # Check correlation limits (all equity index group)
        if not self.algo.correlation_manager.CanAddToGroup('EQUITY_INDEX'):
            return False
        
        # Check VIX regime - avoid in extreme volatility
        vix_price = self.algo.Securities["VIX"].Price
        if vix_price > 35:
            self.algo.Log(f"Skipping LT112 {symbol_str} - VIX too high: {vix_price}")
            return False
        
        # Check IV rank - prefer high IV for selling premium
        iv_rank = self.GetIVRank(symbol_str)
        if iv_rank < 30:  # Below 30th percentile
            self.algo.Log(f"Skipping LT112 {symbol_str} - IV rank too low: {iv_rank}")
            return False
        
        return True
    
    def EnterLongTerm112(self, symbol_str):
        """Enter Long Term 112 position (1 long + 1 short + 2 short structure)"""
        # Get option chain for target DTE
        chain = self.GetOptionChain(symbol_str, self.target_dte)
        
        if not chain:
            self.algo.Log(f"No {self.target_dte} DTE options available for {symbol_str}")
            return
        
        # Get current underlying price
        underlying_price = self.algo.Securities[symbol_str].Price
        
        # Calculate strikes for LT112 structure
        strikes = self.CalculateLT112Strikes(chain, underlying_price)
        
        if not strikes:
            self.algo.Log(f"Could not calculate valid LT112 strikes for {symbol_str}")
            return
        
        # Find the actual contracts
        contracts = self.SelectLT112Contracts(chain, strikes)
        
        if not self.ValidateLT112Contracts(contracts):
            self.algo.Log(f"Could not find valid LT112 contracts for {symbol_str}")
            return
        
        # Calculate position size
        position_size = self.CalculatePositionSize(contracts, underlying_price)
        
        if position_size <= 0:
            self.algo.Log(f"Insufficient buying power for LT112 {symbol_str}")
            return
        
        # Place the LT112 order
        self.PlaceLT112Order(contracts, position_size, symbol_str)
    
    def CalculateLT112Strikes(self, chain, underlying_price):
        """Calculate strikes for 1-1-2 structure using 5-delta positioning"""
        # Get ATM implied volatility for calculations
        atm_iv = self.GetATMIV(chain, underlying_price)
        if atm_iv <= 0:
            return None
        
        # Calculate expected move for strike spacing
        # Using approximate delta to strike conversion
        time_to_expiry = self.target_dte / 365.0
        
        # Target 5-delta for short strikes (high win rate)
        # Approximate 5-delta strikes using Black-Scholes approximation
        vol_sqrt_t = atm_iv * math.sqrt(time_to_expiry)
        
        # 5-delta put is approximately 1.65 standard deviations OTM
        delta_5_offset = 1.65 * underlying_price * vol_sqrt_t
        
        # Strike structure (all puts):
        # 1. Long put: Protective hedge (further OTM)
        # 2. Short put 1: Primary income (5-delta)
        # 3. Short put 2: Additional income (closer to ATM, 10-delta approx)
        
        long_put_strike = underlying_price - (delta_5_offset * 1.3)  # Extra protection
        short_put_1_strike = underlying_price - delta_5_offset  # 5-delta
        short_put_2_strike = underlying_price - (delta_5_offset * 0.7)  # ~10-delta
        
        # Round to nearest strike (typically $1 or $5 increments)
        strike_increment = 1 if underlying_price < 100 else 5
        
        return {
            'long_put': self.RoundToStrike(long_put_strike, strike_increment),
            'short_put_1': self.RoundToStrike(short_put_1_strike, strike_increment),
            'short_put_2': self.RoundToStrike(short_put_2_strike, strike_increment)
        }
    
    def RoundToStrike(self, price, increment):
        """Round price to nearest strike increment"""
        return round(price / increment) * increment
    
    def SelectLT112Contracts(self, chain, strikes):
        """Select actual contracts for LT112 structure"""
        puts = [x for x in chain if x.Right == OptionRight.Put]
        
        if not puts:
            return None
        
        # Find closest contracts to calculated strikes
        long_put = min(puts, key=lambda x: abs(x.Strike - strikes['long_put']))
        short_put_1 = min(puts, key=lambda x: abs(x.Strike - strikes['short_put_1']))
        short_put_2 = min(puts, key=lambda x: abs(x.Strike - strikes['short_put_2']))
        
        return {
            'long_put': long_put,
            'short_put_1': short_put_1,
            'short_put_2': short_put_2
        }
    
    def ValidateLT112Contracts(self, contracts):
        """Validate LT112 contract structure"""
        if not contracts or len(contracts) != 3:
            return False
        
        # Verify we have all legs
        required_legs = ['long_put', 'short_put_1', 'short_put_2']
        if not all(leg in contracts for leg in required_legs):
            return False
        
        # Verify strike order (long put should be lowest strike)
        long_strike = contracts['long_put'].Strike
        short_1_strike = contracts['short_put_1'].Strike
        short_2_strike = contracts['short_put_2'].Strike
        
        if not (long_strike < short_1_strike < short_2_strike):
            return False
        
        # Check for sufficient liquidity (bid-ask spreads)
        for contract in contracts.values():
            spread = contract.AskPrice - contract.BidPrice
            mid_price = (contract.BidPrice + contract.AskPrice) / 2
            if mid_price > 0 and (spread / mid_price) > 0.15:  # 15% spread maximum
                return False
        
        # Check for net credit (LT112 should be net credit)
        net_credit = self.CalculateLT112Credit(contracts)
        if net_credit <= 0.05:  # Minimum $0.05 credit
            return False
        
        return True
    
    def CalculateLT112Credit(self, contracts):
        """Calculate net credit for LT112 structure"""
        credit = 0
        
        # Pay for long put
        credit -= contracts['long_put'].AskPrice
        
        # Receive premium for short puts
        credit += contracts['short_put_1'].BidPrice
        credit += contracts['short_put_2'].BidPrice
        
        return credit
    
    def CalculatePositionSize(self, contracts, underlying_price):
        """Calculate position size based on risk management"""
        # Calculate maximum risk per contract
        # Max risk = difference between strikes minus credit received
        long_strike = contracts['long_put'].Strike
        short_1_strike = contracts['short_put_1'].Strike
        
        # Worst case: assignment on both short puts, long put worthless
        max_loss_per_contract = (short_1_strike - long_strike) * 2 * 100  # *2 for two short puts
        
        net_credit = self.CalculateLT112Credit(contracts) * 100
        max_risk_per_contract = max_loss_per_contract - net_credit
        
        # Position size based on 5% account risk
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        max_account_risk = portfolio_value * self.max_risk_per_trade
        
        if max_risk_per_contract <= 0:
            return 0
        
        position_size = int(max_account_risk / max_risk_per_contract)
        
        # Apply minimum and maximum constraints
        position_size = max(1, min(position_size, 5))  # 1-5 contracts maximum
        
        return position_size
    
    def PlaceLT112Order(self, contracts, quantity, symbol_str):
        """Place Long Term 112 combo order"""
        # Create legs for LT112 structure
        legs = [
            Leg.Create(contracts['long_put'].Symbol, quantity),      # Buy 1 long put
            Leg.Create(contracts['short_put_1'].Symbol, -quantity),  # Sell 1 short put
            Leg.Create(contracts['short_put_2'].Symbol, -quantity)   # Sell 1 more short put
        ]
        
        # Submit combo order
        order_ticket = self.algo.ComboMarketOrder(legs, quantity, asynchronous=False)
        
        # Calculate entry credit
        net_credit = self.CalculateLT112Credit(contracts) * quantity * 100
        
        self.algo.Log(f"Long Term 112 entered on {symbol_str}:")
        self.algo.Log(f"  Long Put: {contracts['long_put'].Strike}")
        self.algo.Log(f"  Short Put 1: {contracts['short_put_1'].Strike}")
        self.algo.Log(f"  Short Put 2: {contracts['short_put_2'].Strike}")
        self.algo.Log(f"  Quantity: {quantity}")
        self.algo.Log(f"  Net Credit: ${net_credit:.2f}")
        
        # Track the trade
        self.trades.append({
            'symbol': symbol_str,
            'entry_time': self.algo.Time,
            'contracts': contracts,
            'quantity': quantity,
            'net_credit': net_credit,
            'status': 'open',
            'entry_dte': self.target_dte,
            'target_profit': net_credit * self.target_profit
        })
    
    def CheckExistingPositions(self):
        """Monitor existing LT112 positions for management"""
        for trade in [t for t in self.trades if t['status'] == 'open']:
            current_dte = self.GetCurrentDTE(trade)
            current_pnl = self.GetPositionPnL(trade)
            pnl_percentage = (current_pnl / abs(trade['net_credit'])) if trade['net_credit'] != 0 else 0
            
            should_close = False
            close_reason = ""
            
            # Check profit target (50%)
            if pnl_percentage >= self.target_profit:
                should_close = True
                close_reason = "PROFIT_TARGET"
                self.wins += 1
            
            # Check DTE management (21 DTE)
            elif current_dte <= self.management_dte:
                should_close = True
                close_reason = "DTE_MANAGEMENT"
                # Determine win/loss based on P&L
                if current_pnl > 0:
                    self.wins += 1
                else:
                    self.losses += 1
            
            # Check for defensive adjustment needed
            elif self.NeedsDefensiveAdjustment(trade):
                should_close = True
                close_reason = "DEFENSIVE_ADJUSTMENT"
                self.losses += 1
            
            if should_close:
                self.CloseLT112Position(trade, close_reason, pnl_percentage)
    
    def NeedsDefensiveAdjustment(self, trade):
        """Check if position needs defensive management"""
        # Check if underlying has moved too close to short strikes
        symbol_str = trade['symbol']
        current_price = self.algo.Securities[symbol_str].Price
        
        # Check distance to short strikes
        short_put_1_strike = trade['contracts']['short_put_1'].Strike
        short_put_2_strike = trade['contracts']['short_put_2'].Strike
        
        # If underlying is within 5% of higher short strike, consider defensive action
        distance_to_danger = (current_price - short_put_2_strike) / current_price
        
        return distance_to_danger < 0.05  # Within 5% of short strike
    
    def CloseLT112Position(self, trade, reason, pnl_pct):
        """Close Long Term 112 position"""
        # Create closing order (opposite of entry)
        legs = [
            Leg.Create(trade['contracts']['long_put'].Symbol, -trade['quantity']),    # Sell long put
            Leg.Create(trade['contracts']['short_put_1'].Symbol, trade['quantity']),  # Buy back short put
            Leg.Create(trade['contracts']['short_put_2'].Symbol, trade['quantity'])   # Buy back short put
        ]
        
        # Submit closing combo order
        self.algo.ComboMarketOrder(legs, trade['quantity'], asynchronous=False)
        
        # Update trade record
        trade['status'] = 'closed'
        trade['exit_time'] = self.algo.Time
        trade['exit_reason'] = reason
        trade['pnl_pct'] = pnl_pct
        
        self.algo.Log(f"LT112 Closed - {trade['symbol']}: {reason} at {pnl_pct:.1%}")
    
    def GetCurrentDTE(self, trade):
        """Calculate current days to expiration"""
        expiry = trade['contracts']['long_put'].Expiry
        return (expiry.date() - self.algo.Time.date()).days
    
    def GetPositionPnL(self, trade):
        """Get current P&L of LT112 position"""
        pnl = 0
        
        # Long put value (we own it)
        long_put_security = self.algo.Securities.get(trade['contracts']['long_put'].Symbol)
        if long_put_security:
            pnl += long_put_security.Price * trade['quantity'] * 100
        
        # Short put values (we owe them)
        short_put_1_security = self.algo.Securities.get(trade['contracts']['short_put_1'].Symbol)
        if short_put_1_security:
            pnl -= short_put_1_security.Price * trade['quantity'] * 100
        
        short_put_2_security = self.algo.Securities.get(trade['contracts']['short_put_2'].Symbol)
        if short_put_2_security:
            pnl -= short_put_2_security.Price * trade['quantity'] * 100
        
        # Add initial credit received
        pnl += trade['net_credit']
        
        return pnl
    
    def GetOptionChain(self, symbol_str, target_dte):
        """Get option chain for specific DTE"""
        option_chains = self.algo.CurrentSlice.OptionChains
        
        for kvp in option_chains:
            chain = kvp.Value
            underlying_symbol = chain.Underlying.Symbol.Value
            
            if underlying_symbol == symbol_str:
                # Filter for target DTE (allow +/- 7 days tolerance)
                filtered = [x for x in chain 
                           if abs(self.GetDTE(x) - target_dte) <= 7]
                return filtered
        
        return None
    
    def GetDTE(self, contract):
        """Calculate days to expiration"""
        return (contract.Expiry.date() - self.algo.Time.date()).days
    
    def GetATMIV(self, chain, underlying_price):
        """Get at-the-money implied volatility"""
        calls = [x for x in chain if x.Right == OptionRight.Call]
        if not calls:
            return 0.20  # Default 20% IV
        
        atm_call = min(calls, key=lambda x: abs(x.Strike - underlying_price))
        return max(atm_call.ImpliedVolatility, 0.10)  # Minimum 10% IV
    
    def GetIVRank(self, symbol_str):
        """Get IV rank for the symbol (simplified implementation)"""
        # In a full implementation, this would calculate IV rank over 252 days
        # For now, return a reasonable estimate based on VIX
        vix = self.algo.Securities["VIX"].Price
        
        # Map VIX to approximate IV rank
        if vix < 12:
            return 10  # Low volatility
        elif vix < 16:
            return 35  # Normal volatility
        elif vix < 25:
            return 65  # Elevated volatility
        else:
            return 90  # High volatility
    
    def HasActivePosition(self, symbol_str):
        """Check if we have an active LT112 position on this symbol"""
        for trade in self.trades:
            if trade['symbol'] == symbol_str and trade['status'] == 'open':
                return True
        return False
    
    def GetStatistics(self):
        """Get strategy performance statistics"""
        total_trades = self.wins + self.losses
        win_rate = (self.wins / total_trades * 100) if total_trades > 0 else 0
        
        return {
            'total_trades': total_trades,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': win_rate,
            'target_win_rate': 95.0,
            'monthly_target_return': self.monthly_target_return * 100
        }