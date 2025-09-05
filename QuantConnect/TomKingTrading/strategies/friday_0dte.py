# Friday 0DTE Strategy - Tom King's Signature Strategy
# 88% Win Rate Target

from AlgorithmImports import *

class Friday0DTEStrategy:
    """
    Tom King's Friday 0DTE strategy with 88% historical win rate.
    Enters iron condors on SPY/IWM/QQQ at 10:30 AM on Fridays only.
    Targets 50% profit with 200% stop loss.
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.symbols = ['SPY', 'IWM', 'QQQ']
        self.target_profit = 0.50  # 50% profit target
        self.stop_loss = -2.00     # 200% stop loss
        self.entry_time = time(10, 30)  # 10:30 AM ET
        
        # Track performance
        self.trades = []
        self.wins = 0
        self.losses = 0
    
    def Execute(self):
        """Execute Friday 0DTE iron condor strategy"""
        # Verify it's Friday and after 10:30 AM
        if self.algo.Time.weekday() != 4:  # 4 = Friday
            return
        
        if self.algo.Time.time() < self.entry_time:
            return
        
        self.algo.Log("Executing Friday 0DTE Strategy")
        
        # Check each symbol
        for symbol_str in self.symbols:
            if self.ShouldTradeSymbol(symbol_str):
                self.EnterIronCondor(symbol_str)
    
    def ShouldTradeSymbol(self, symbol_str):
        """Determine if we should trade this symbol today"""
        # Check if we already have a position
        if self.HasPosition(symbol_str):
            return False
        
        # Check buying power
        if not self.algo.HasCapacity():
            return False
        
        # Check correlation limits
        # All three symbols are in EQUITY_INDEX group
        if not self.algo.correlation_manager.CanAddToGroup('EQUITY_INDEX'):
            return False
        
        # Check VIX for extreme conditions
        vix_price = self.algo.Securities["VIX"].Price
        if vix_price > 40:  # Skip in extreme volatility
            self.algo.Log(f"Skipping {symbol_str} - VIX too high: {vix_price}")
            return False
        
        return True
    
    def EnterIronCondor(self, symbol_str):
        """Enter 0DTE iron condor on the symbol"""
        # Get the option chain
        chain = self.GetOptionChain(symbol_str, 0)  # 0 DTE
        
        if not chain:
            self.algo.Log(f"No 0DTE options available for {symbol_str}")
            return
        
        # Get current price
        underlying_price = self.algo.Securities[symbol_str].Price
        
        # Calculate strikes for iron condor
        # Typical setup: sell strikes at ~1 standard deviation
        # Buy protection at ~2 standard deviations
        
        # Get ATM IV to calculate expected move
        atm_iv = self.GetATMIV(chain, underlying_price)
        daily_move = underlying_price * atm_iv * 0.0397  # 1-day expected move
        
        # Iron Condor strikes
        short_call_strike = underlying_price + daily_move * 1.0
        long_call_strike = underlying_price + daily_move * 2.0
        short_put_strike = underlying_price - daily_move * 1.0
        long_put_strike = underlying_price - daily_move * 2.0
        
        # Find the actual contracts
        contracts = self.SelectContracts(
            chain,
            short_call_strike,
            long_call_strike,
            short_put_strike,
            long_put_strike
        )
        
        if not self.ValidateContracts(contracts):
            self.algo.Log(f"Could not find valid contracts for {symbol_str}")
            return
        
        # Calculate position size based on buying power
        position_size = self.CalculatePositionSize(contracts)
        
        if position_size <= 0:
            self.algo.Log(f"Insufficient buying power for {symbol_str}")
            return
        
        # Place the iron condor order
        self.PlaceIronCondorOrder(contracts, position_size, symbol_str)
    
    def GetOptionChain(self, symbol_str, target_dte):
        """Get option chain for specific DTE"""
        option_chains = self.algo.CurrentSlice.OptionChains
        
        for kvp in option_chains:
            chain = kvp.Value
            underlying_symbol = chain.Underlying.Symbol.Value
            
            if underlying_symbol == symbol_str:
                # Filter for target DTE
                filtered = [x for x in chain if self.GetDTE(x) == target_dte]
                return filtered
        
        return None
    
    def GetDTE(self, contract):
        """Calculate days to expiration"""
        return (contract.Expiry.date() - self.algo.Time.date()).days
    
    def GetATMIV(self, chain, underlying_price):
        """Get at-the-money implied volatility"""
        # Find ATM call
        calls = [x for x in chain if x.Right == OptionRight.Call]
        if not calls:
            return 0.20  # Default 20% IV
        
        atm_call = min(calls, key=lambda x: abs(x.Strike - underlying_price))
        return atm_call.ImpliedVolatility
    
    def SelectContracts(self, chain, sc_strike, lc_strike, sp_strike, lp_strike):
        """Select the actual contracts closest to target strikes"""
        calls = [x for x in chain if x.Right == OptionRight.Call]
        puts = [x for x in chain if x.Right == OptionRight.Put]
        
        if not calls or not puts:
            return None
        
        # Find closest strikes
        short_call = min(calls, key=lambda x: abs(x.Strike - sc_strike))
        long_call = min(calls, key=lambda x: abs(x.Strike - lc_strike))
        short_put = min(puts, key=lambda x: abs(x.Strike - sp_strike))
        long_put = min(puts, key=lambda x: abs(x.Strike - lp_strike))
        
        return {
            'short_call': short_call,
            'long_call': long_call,
            'short_put': short_put,
            'long_put': long_put
        }
    
    def ValidateContracts(self, contracts):
        """Validate iron condor setup"""
        if not contracts:
            return False
        
        # Verify we have all legs
        if not all(k in contracts for k in ['short_call', 'long_call', 'short_put', 'long_put']):
            return False
        
        # Verify strike relationships
        if contracts['short_call'].Strike <= contracts['long_put'].Strike:
            return False  # Strikes too narrow
        
        if contracts['long_call'].Strike <= contracts['short_call'].Strike:
            return False  # Invalid call spread
        
        if contracts['short_put'].Strike <= contracts['long_put'].Strike:
            return False  # Invalid put spread
        
        # Check for sufficient credit
        credit = self.CalculateCredit(contracts)
        if credit < 0.10:  # Minimum $0.10 credit
            return False
        
        return True
    
    def CalculateCredit(self, contracts):
        """Calculate net credit for iron condor"""
        credit = 0
        credit += contracts['short_call'].BidPrice
        credit += contracts['short_put'].BidPrice
        credit -= contracts['long_call'].AskPrice
        credit -= contracts['long_put'].AskPrice
        return credit
    
    def CalculatePositionSize(self, contracts):
        """Calculate position size based on risk and buying power"""
        # Maximum risk is the width of wider spread minus credit
        call_width = contracts['long_call'].Strike - contracts['short_call'].Strike
        put_width = contracts['short_put'].Strike - contracts['long_put'].Strike
        max_width = max(call_width, put_width)
        
        credit = self.CalculateCredit(contracts)
        max_risk_per_contract = (max_width - credit) * 100  # Convert to dollars
        
        # Position size based on 5% risk per trade
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        max_risk = portfolio_value * 0.05
        
        position_size = int(max_risk / max_risk_per_contract)
        
        # Apply minimum and maximum constraints
        position_size = max(1, min(position_size, 10))  # 1-10 contracts
        
        return position_size
    
    def PlaceIronCondorOrder(self, contracts, quantity, symbol_str):
        """Place the iron condor order"""
        # Create combo order
        legs = [
            Leg.Create(contracts['short_call'].Symbol, -quantity),  # Sell call
            Leg.Create(contracts['long_call'].Symbol, quantity),    # Buy call
            Leg.Create(contracts['short_put'].Symbol, -quantity),   # Sell put
            Leg.Create(contracts['long_put'].Symbol, quantity)      # Buy put
        ]
        
        # Submit combo order
        self.algo.ComboMarketOrder(legs, quantity, asynchronous=False)
        
        # Calculate entry credit
        credit = self.CalculateCredit(contracts) * quantity * 100
        
        self.algo.Log(f"Friday 0DTE Iron Condor entered on {symbol_str}:")
        self.algo.Log(f"  Short Call: {contracts['short_call'].Strike}")
        self.algo.Log(f"  Long Call: {contracts['long_call'].Strike}")
        self.algo.Log(f"  Short Put: {contracts['short_put'].Strike}")
        self.algo.Log(f"  Long Put: {contracts['long_put'].Strike}")
        self.algo.Log(f"  Quantity: {quantity}")
        self.algo.Log(f"  Credit: ${credit:.2f}")
        
        # Track the trade
        self.trades.append({
            'symbol': symbol_str,
            'entry_time': self.algo.Time,
            'contracts': contracts,
            'quantity': quantity,
            'credit': credit,
            'status': 'open'
        })
    
    def HasPosition(self, symbol_str):
        """Check if we have an open position on this symbol"""
        for trade in self.trades:
            if trade['symbol'] == symbol_str and trade['status'] == 'open':
                return True
        return False
    
    def CheckProfitTargets(self):
        """Check all positions for profit/loss targets"""
        for trade in self.trades:
            if trade['status'] != 'open':
                continue
            
            # Calculate current P&L
            current_value = self.GetPositionValue(trade)
            entry_credit = trade['credit']
            
            # P&L percentage
            if entry_credit > 0:
                pnl_pct = (entry_credit - current_value) / entry_credit
                
                # Check profit target (50%)
                if pnl_pct >= self.target_profit:
                    self.ClosePosition(trade, 'PROFIT_TARGET', pnl_pct)
                    self.wins += 1
                
                # Check stop loss (200%)
                elif pnl_pct <= self.stop_loss:
                    self.ClosePosition(trade, 'STOP_LOSS', pnl_pct)
                    self.losses += 1
    
    def GetPositionValue(self, trade):
        """Get current value of position"""
        value = 0
        
        for leg_type, contract in trade['contracts'].items():
            security = self.algo.Securities.get(contract.Symbol)
            if security:
                if 'short' in leg_type:
                    value -= security.BidPrice * trade['quantity'] * 100
                else:
                    value += security.AskPrice * trade['quantity'] * 100
        
        return value
    
    def ClosePosition(self, trade, reason, pnl_pct):
        """Close the iron condor position"""
        # Create closing order (opposite of entry)
        legs = [
            Leg.Create(trade['contracts']['short_call'].Symbol, trade['quantity']),   # Buy back call
            Leg.Create(trade['contracts']['long_call'].Symbol, -trade['quantity']),   # Sell call
            Leg.Create(trade['contracts']['short_put'].Symbol, trade['quantity']),    # Buy back put  
            Leg.Create(trade['contracts']['long_put'].Symbol, -trade['quantity'])     # Sell put
        ]
        
        self.algo.ComboMarketOrder(legs, trade['quantity'], asynchronous=False)
        
        # Update trade status
        trade['status'] = 'closed'
        trade['exit_time'] = self.algo.Time
        trade['exit_reason'] = reason
        trade['pnl_pct'] = pnl_pct
        
        self.algo.Log(f"Friday 0DTE Closed - {trade['symbol']}: {reason} at {pnl_pct:.1%}")
    
    def GetStatistics(self):
        """Get strategy statistics"""
        total_trades = self.wins + self.losses
        win_rate = (self.wins / total_trades * 100) if total_trades > 0 else 0
        
        return {
            'total_trades': total_trades,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': win_rate,
            'target_win_rate': 88.0
        }