# Futures Strangles Strategy - Tom King's High-Efficiency Strategy
# 90 DTE on ES, CL, ZB futures with phase-based symbol selection

from AlgorithmImports import *

class FuturesStrangleStrategy:
    """
    Tom King's Futures Strangles strategy for capital efficient premium selling.
    90 DTE entry on ES, CL, ZB futures with 5-delta strikes for high win rate.
    Phase-based symbol progression: Phase 1 (micro), Phase 2+ (mini/full).
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.target_dte = 90  # 90 DTE entry
        self.management_dte = 21  # 21 DTE management
        self.target_profit = 0.50  # 50% profit target
        self.max_risk_per_trade = 0.025  # 2.5% max risk per trade (lower for futures)
        
        # Phase-based symbol selection
        self.symbol_config = self.GetPhaseSymbols()
        
        # Track performance
        self.trades = []
        self.wins = 0
        self.losses = 0
        
        # Initialize futures symbols
        self.InitializeFuturesSymbols()
    
    def GetPhaseSymbols(self):
        """Get futures symbols based on account phase"""
        account_value = self.algo.Portfolio.TotalPortfolioValue
        
        if account_value < 40000:  # Phase 1: £30-40k
            return {
                'ES': 'MES',  # Micro E-mini S&P 500
                'CL': 'MCL',  # Micro Crude Oil
                'ZB': None,   # No bonds in Phase 1
                'max_positions': 2
            }
        elif account_value < 60000:  # Phase 2: £40-60k
            return {
                'ES': 'MES',  # Still micro for risk management
                'CL': 'MCL',  # Still micro
                'ZB': 'ZB',   # Add full bonds
                'max_positions': 3
            }
        elif account_value < 75000:  # Phase 3: £60-75k
            return {
                'ES': 'ES',   # Upgrade to mini
                'CL': 'CL',   # Upgrade to full
                'ZB': 'ZB',   # Keep full bonds
                'max_positions': 4
            }
        else:  # Phase 4: £75k+
            return {
                'ES': 'ES',
                'CL': 'CL',
                'ZB': 'ZB',
                'max_positions': 5
            }
    
    def InitializeFuturesSymbols(self):
        """Initialize futures symbols for the current phase"""
        for underlying, symbol in self.symbol_config.items():
            if symbol and underlying != 'max_positions':
                try:
                    # Add futures contract
                    future = self.algo.AddFuture(symbol)
                    future.SetFilter(0, 180)  # 0 to 180 days to expiration
                    
                    # Set data normalization
                    future.SetData(DataNormalizationMode.Raw)
                    
                    self.algo.Log(f"Initialized futures symbol: {symbol} for {underlying}")
                except Exception as e:
                    self.algo.Log(f"Error initializing {symbol}: {str(e)}")
    
    def Execute(self):
        """Execute Futures Strangles strategy"""
        # Only enter new positions on specific entry days (Mondays and Thursdays)
        if not self.IsEntryDay():
            self.CheckExistingPositions()
            return
        
        self.algo.Log("Evaluating Futures Strangles Strategy")
        
        # Check each available symbol for entry
        active_positions = len([t for t in self.trades if t['status'] == 'open'])
        max_positions = self.symbol_config['max_positions']
        
        if active_positions >= max_positions:
            self.algo.Log(f"Max positions reached: {active_positions}/{max_positions}")
            return
        
        # Prioritize symbols by volatility and opportunity
        symbols_to_check = self.PrioritizeSymbols()
        
        for underlying, symbol in symbols_to_check:
            if active_positions >= max_positions:
                break
            
            if self.ShouldTradeSymbol(underlying, symbol):
                if self.EnterFuturesStrangle(underlying, symbol):
                    active_positions += 1
    
    def IsEntryDay(self):
        """Check if today is a valid entry day"""
        today = self.algo.Time
        weekday = today.weekday()  # Monday = 0, Sunday = 6
        
        # Enter on Mondays (0) and Thursdays (3)
        if weekday not in [0, 3]:
            return False
        
        # Only after market open
        market_open = time(9, 30)
        if today.time() < market_open:
            return False
        
        return True
    
    def PrioritizeSymbols(self):
        """Prioritize symbols based on volatility and opportunity"""
        priorities = []
        
        for underlying, symbol in self.symbol_config.items():
            if symbol and underlying != 'max_positions':
                # Skip if we already have a position
                if self.HasActivePosition(symbol):
                    continue
                
                # Calculate priority score based on IV rank and other factors
                priority_score = self.CalculatePriorityScore(underlying, symbol)
                priorities.append((underlying, symbol, priority_score))
        
        # Sort by priority score (highest first)
        priorities.sort(key=lambda x: x[2], reverse=True)
        
        return [(underlying, symbol) for underlying, symbol, score in priorities]
    
    def CalculatePriorityScore(self, underlying, symbol):
        """Calculate priority score for symbol selection"""
        score = 0
        
        try:
            # Base scoring by underlying type
            underlying_scores = {
                'ES': 100,  # Highest priority - most liquid
                'CL': 80,   # Good volatility
                'ZB': 60    # Lower priority but good diversification
            }
            score += underlying_scores.get(underlying, 50)
            
            # Add volatility bonus (higher IV rank = higher score)
            iv_rank = self.GetIVRank(underlying)
            score += iv_rank
            
            # Reduce score if VIX is too low (bad for premium selling)
            vix_price = self.algo.Securities["VIX"].Price
            if vix_price < 12:
                score -= 30
            elif vix_price > 30:
                score += 20  # Bonus for elevated volatility
            
        except Exception as e:
            self.algo.Log(f"Error calculating priority for {symbol}: {str(e)}")
            score = 10  # Low default score
        
        return score
    
    def ShouldTradeSymbol(self, underlying, symbol):
        """Determine if we should enter strangle on this futures symbol"""
        # Check buying power
        if not self.algo.HasCapacity():
            return False
        
        # Check correlation limits
        correlation_group = self.GetCorrelationGroup(underlying)
        if not self.algo.correlation_manager.CanAddToGroup(correlation_group):
            return False
        
        # Check if market conditions are suitable
        if not self.AreFuturesConditionsSuitable(underlying):
            return False
        
        # Check IV rank threshold
        iv_rank = self.GetIVRank(underlying)
        if iv_rank < 40:  # Below 40th percentile
            self.algo.Log(f"Skipping {symbol} - IV rank too low: {iv_rank}")
            return False
        
        return True
    
    def GetCorrelationGroup(self, underlying):
        """Get correlation group for underlying"""
        correlation_groups = {
            'ES': 'EQUITY_INDEX',
            'CL': 'ENERGY',
            'ZB': 'TREASURIES'
        }
        return correlation_groups.get(underlying, 'OTHER')
    
    def AreFuturesConditionsSuitable(self, underlying):
        """Check if market conditions are suitable for futures strangles"""
        # Check VIX for equity futures
        if underlying == 'ES':
            vix_price = self.algo.Securities["VIX"].Price
            if vix_price > 40:  # Avoid extremely high volatility
                return False
        
        # Check for major economic events (simplified)
        # In practice, this would integrate with economic calendar
        current_time = self.algo.Time
        
        # Avoid first Friday of month (NFP) for all symbols
        if (current_time.weekday() == 4 and  # Friday
            current_time.day <= 7):  # First week
            return False
        
        # Avoid FOMC meeting days (typically 8 times per year)
        # This is a simplified check - full implementation would use economic calendar
        
        return True
    
    def EnterFuturesStrangle(self, underlying, symbol):
        """Enter futures strangle position"""
        try:
            # Get futures option chain
            chain = self.GetFuturesOptionChain(symbol)
            
            if not chain:
                self.algo.Log(f"No options chain available for {symbol}")
                return False
            
            # Get current futures price
            futures_price = self.GetFuturesPrice(symbol)
            if futures_price <= 0:
                self.algo.Log(f"Could not get futures price for {symbol}")
                return False
            
            # Calculate 5-delta strikes for high win rate
            strikes = self.Calculate5DeltaStrikes(chain, futures_price, underlying)
            
            if not strikes:
                self.algo.Log(f"Could not calculate 5-delta strikes for {symbol}")
                return False
            
            # Find actual contracts
            contracts = self.SelectStrangleContracts(chain, strikes)
            
            if not self.ValidateStrangleContracts(contracts):
                self.algo.Log(f"Could not find valid strangle contracts for {symbol}")
                return False
            
            # Calculate position size
            position_size = self.CalculatePositionSize(contracts, futures_price)
            
            if position_size <= 0:
                self.algo.Log(f"Insufficient buying power for {symbol} strangle")
                return False
            
            # Place strangle order
            self.PlaceStrangleOrder(contracts, position_size, underlying, symbol)
            return True
            
        except Exception as e:
            self.algo.Log(f"Error entering strangle for {symbol}: {str(e)}")
            return False
    
    def GetFuturesOptionChain(self, symbol):
        """Get futures option chain for 90 DTE"""
        option_chains = self.algo.CurrentSlice.OptionChains
        
        for kvp in option_chains:
            chain = kvp.Value
            
            # Check if this is our futures symbol
            if chain.Underlying.Symbol.Value == symbol:
                # Filter for target DTE (90 +/- 14 days tolerance)
                filtered = [x for x in chain 
                           if abs(self.GetDTE(x) - self.target_dte) <= 14]
                
                # Further filter for good liquidity
                liquid_contracts = [x for x in filtered 
                                  if x.BidPrice > 0 and x.AskPrice > 0 and 
                                     (x.AskPrice - x.BidPrice) / ((x.AskPrice + x.BidPrice) / 2) < 0.20]
                
                return liquid_contracts
        
        return None
    
    def GetFuturesPrice(self, symbol):
        """Get current futures price"""
        try:
            futures_contracts = self.algo.CurrentSlice.FutureChains
            
            for kvp in futures_contracts:
                chain = kvp.Value
                if chain.Symbol.Value == symbol:
                    # Get the front month contract
                    front_month = min(chain, key=lambda x: x.Expiry)
                    return front_month.Price
                    
            return 0
        except:
            return 0
    
    def Calculate5DeltaStrikes(self, chain, futures_price, underlying):
        """Calculate 5-delta strikes for strangles"""
        # Get ATM implied volatility
        atm_iv = self.GetATMIV(chain, futures_price)
        if atm_iv <= 0:
            return None
        
        # Calculate time to expiry
        time_to_expiry = self.target_dte / 365.0
        
        # 5-delta approximation using simplified Black-Scholes
        # 5-delta is approximately 1.65 standard deviations away
        vol_sqrt_t = atm_iv * math.sqrt(time_to_expiry)
        delta_5_distance = 1.65 * futures_price * vol_sqrt_t
        
        # Calculate strikes
        call_strike = futures_price + delta_5_distance
        put_strike = futures_price - delta_5_distance
        
        # Adjust for symbol-specific increment
        increment = self.GetStrikeIncrement(underlying, futures_price)
        
        return {
            'call_strike': self.RoundToStrike(call_strike, increment),
            'put_strike': self.RoundToStrike(put_strike, increment)
        }
    
    def GetStrikeIncrement(self, underlying, price):
        """Get strike increment for different futures"""
        if underlying == 'ES':
            return 5 if price > 4000 else 1  # ES: 5-point increments typically
        elif underlying == 'CL':
            return 0.5  # CL: 50-cent increments
        elif underlying == 'ZB':
            return 0.5  # ZB: 1/2 point increments
        else:
            return 1  # Default
    
    def RoundToStrike(self, price, increment):
        """Round to nearest strike increment"""
        return round(price / increment) * increment
    
    def SelectStrangleContracts(self, chain, strikes):
        """Select actual contracts for strangle"""
        calls = [x for x in chain if x.Right == OptionRight.Call]
        puts = [x for x in chain if x.Right == OptionRight.Put]
        
        if not calls or not puts:
            return None
        
        # Find closest strikes to calculated 5-delta strikes
        call_contract = min(calls, key=lambda x: abs(x.Strike - strikes['call_strike']))
        put_contract = min(puts, key=lambda x: abs(x.Strike - strikes['put_strike']))
        
        return {
            'call': call_contract,
            'put': put_contract
        }
    
    def ValidateStrangleContracts(self, contracts):
        """Validate strangle contracts"""
        if not contracts or len(contracts) != 2:
            return False
        
        if 'call' not in contracts or 'put' not in contracts:
            return False
        
        # Check for valid pricing
        call_contract = contracts['call']
        put_contract = contracts['put']
        
        if (call_contract.BidPrice <= 0 or put_contract.BidPrice <= 0 or
            call_contract.AskPrice <= 0 or put_contract.AskPrice <= 0):
            return False
        
        # Check spreads are reasonable
        call_spread = call_contract.AskPrice - call_contract.BidPrice
        put_spread = put_contract.AskPrice - put_contract.BidPrice
        
        call_mid = (call_contract.BidPrice + call_contract.AskPrice) / 2
        put_mid = (put_contract.BidPrice + put_contract.AskPrice) / 2
        
        if call_mid > 0 and (call_spread / call_mid) > 0.20:  # 20% max spread
            return False
        if put_mid > 0 and (put_spread / put_mid) > 0.20:
            return False
        
        # Minimum credit check
        credit = call_contract.BidPrice + put_contract.BidPrice
        if credit < 0.10:  # Minimum total credit
            return False
        
        return True
    
    def CalculatePositionSize(self, contracts, futures_price):
        """Calculate position size for futures strangles"""
        # For futures, calculate based on margin requirement
        # Simplified calculation - real implementation would use exact margin requirements
        
        call_strike = contracts['call'].Strike
        put_strike = contracts['put'].Strike
        
        # Estimate margin requirement (varies by broker and symbol)
        # This is a simplified calculation
        strike_width = call_strike - put_strike
        estimated_margin = strike_width * 100 * 0.15  # Rough 15% of notional
        
        # Account risk limit
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        max_risk = portfolio_value * self.max_risk_per_trade
        
        # Position size based on margin requirement
        if estimated_margin > 0:
            position_size = int(max_risk / estimated_margin)
        else:
            position_size = 1
        
        # Apply constraints (futures can be more volatile)
        position_size = max(1, min(position_size, 3))  # 1-3 contracts max
        
        return position_size
    
    def PlaceStrangleOrder(self, contracts, quantity, underlying, symbol):
        """Place futures strangle order"""
        # Create strangle legs
        legs = [
            Leg.Create(contracts['call'].Symbol, -quantity),  # Sell call
            Leg.Create(contracts['put'].Symbol, -quantity)    # Sell put
        ]
        
        # Submit combo order
        order_ticket = self.algo.ComboMarketOrder(legs, quantity, asynchronous=False)
        
        # Calculate entry credit
        credit = (contracts['call'].BidPrice + contracts['put'].BidPrice) * quantity * 100
        
        self.algo.Log(f"Futures Strangle entered on {symbol} ({underlying}):")
        self.algo.Log(f"  Call Strike: {contracts['call'].Strike}")
        self.algo.Log(f"  Put Strike: {contracts['put'].Strike}")
        self.algo.Log(f"  Quantity: {quantity}")
        self.algo.Log(f"  Credit: ${credit:.2f}")
        
        # Track the trade
        self.trades.append({
            'underlying': underlying,
            'symbol': symbol,
            'entry_time': self.algo.Time,
            'contracts': contracts,
            'quantity': quantity,
            'credit': credit,
            'status': 'open',
            'entry_dte': self.target_dte,
            'correlation_group': self.GetCorrelationGroup(underlying)
        })
    
    def CheckExistingPositions(self):
        """Monitor existing strangle positions"""
        for trade in [t for t in self.trades if t['status'] == 'open']:
            current_dte = self.GetCurrentDTE(trade)
            current_pnl = self.GetPositionPnL(trade)
            pnl_percentage = (current_pnl / abs(trade['credit'])) if trade['credit'] != 0 else 0
            
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
                if current_pnl > 0:
                    self.wins += 1
                else:
                    self.losses += 1
            
            # Check for defensive conditions
            elif self.NeedsDefensiveAction(trade):
                should_close = True
                close_reason = "DEFENSIVE_MANAGEMENT"
                self.losses += 1
            
            if should_close:
                self.CloseStranglePosition(trade, close_reason, pnl_percentage)
    
    def NeedsDefensiveAction(self, trade):
        """Check if strangle needs defensive management"""
        try:
            # Get current futures price
            current_price = self.GetFuturesPrice(trade['symbol'])
            if current_price <= 0:
                return False
            
            call_strike = trade['contracts']['call'].Strike
            put_strike = trade['contracts']['put'].Strike
            
            # Check if price is too close to either strike (within 3%)
            distance_to_call = abs(current_price - call_strike) / current_price
            distance_to_put = abs(current_price - put_strike) / current_price
            
            return min(distance_to_call, distance_to_put) < 0.03
            
        except:
            return False
    
    def CloseStranglePosition(self, trade, reason, pnl_pct):
        """Close futures strangle position"""
        # Create closing order (buy back the sold options)
        legs = [
            Leg.Create(trade['contracts']['call'].Symbol, trade['quantity']),   # Buy back call
            Leg.Create(trade['contracts']['put'].Symbol, trade['quantity'])     # Buy back put
        ]
        
        # Submit closing combo order
        self.algo.ComboMarketOrder(legs, trade['quantity'], asynchronous=False)
        
        # Update trade record
        trade['status'] = 'closed'
        trade['exit_time'] = self.algo.Time
        trade['exit_reason'] = reason
        trade['pnl_pct'] = pnl_pct
        
        self.algo.Log(f"Futures Strangle Closed - {trade['symbol']}: {reason} at {pnl_pct:.1%}")
    
    def GetCurrentDTE(self, trade):
        """Get current days to expiration"""
        # Use call contract expiry (same for both legs)
        expiry = trade['contracts']['call'].Expiry
        return (expiry.date() - self.algo.Time.date()).days
    
    def GetPositionPnL(self, trade):
        """Get current P&L of strangle position"""
        pnl = trade['credit']  # Start with credit received
        
        try:
            # Subtract current value of sold options
            call_security = self.algo.Securities.get(trade['contracts']['call'].Symbol)
            if call_security:
                pnl -= call_security.Price * trade['quantity'] * 100
            
            put_security = self.algo.Securities.get(trade['contracts']['put'].Symbol)
            if put_security:
                pnl -= put_security.Price * trade['quantity'] * 100
                
        except:
            pnl = 0
        
        return pnl
    
    def GetDTE(self, contract):
        """Calculate days to expiration"""
        return (contract.Expiry.date() - self.algo.Time.date()).days
    
    def GetATMIV(self, chain, futures_price):
        """Get at-the-money implied volatility"""
        calls = [x for x in chain if x.Right == OptionRight.Call]
        if not calls:
            return 0.20  # Default 20%
        
        atm_call = min(calls, key=lambda x: abs(x.Strike - futures_price))
        return max(atm_call.ImpliedVolatility, 0.10)  # Minimum 10%
    
    def GetIVRank(self, underlying):
        """Get IV rank for futures underlying"""
        # Simplified IV rank based on VIX and underlying type
        vix = self.algo.Securities["VIX"].Price
        
        # Adjust based on underlying correlation to VIX
        if underlying == 'ES':
            multiplier = 1.0  # ES closely correlated to VIX
        elif underlying == 'CL':
            multiplier = 0.7  # Oil has some correlation
        elif underlying == 'ZB':
            multiplier = 0.4  # Bonds inverse correlation
        else:
            multiplier = 0.6
        
        adjusted_vix = vix * multiplier
        
        # Map to IV rank
        if adjusted_vix < 12:
            return 15
        elif adjusted_vix < 16:
            return 40
        elif adjusted_vix < 25:
            return 70
        else:
            return 85
    
    def HasActivePosition(self, symbol):
        """Check if we have active position on this symbol"""
        for trade in self.trades:
            if trade['symbol'] == symbol and trade['status'] == 'open':
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
            'target_win_rate': 85.0,  # High win rate expected for 5-delta strangles
            'target_dte': self.target_dte,
            'management_dte': self.management_dte
        }