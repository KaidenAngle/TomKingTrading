# Enhanced Futures Strangles Strategy - Tom King Framework v17
# Multi-product diversification with phase-based allocation
# Products: MCL, MGC, 6E, M6A, TLT, GLD (90 DTE standard)

from AlgorithmImports import *
import math
from datetime import datetime, timedelta

class EnhancedFuturesStranglesStrategy:
    """
    Enhanced Futures Strangles Strategy for Tom King Framework v17
    - Multi-product diversification engine
    - 90 DTE standard (vs 45 DTE in basic version)
    - Delta-based strike selection (5-7 delta puts, 5-6 delta calls)
    - Phase-based product allocation
    - VIX regime integration
    - Correlation group compliance
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Tom King Framework Parameters
        self.target_dte = 90  # Enhanced: 90 days vs 45
        self.management_dte = 21
        self.profit_target = 0.50  # 50% profit target
        self.stop_loss = 1.50      # 150% stop loss
        
        # Delta targets for strike selection
        self.target_put_delta = 6   # 5-7 delta puts
        self.target_call_delta = 6  # 5-6 delta calls
        
        # Position tracking
        self.positions = {}
        self.entry_credits = {}
        self.position_health = {}
        
        # Performance tracking
        self.total_trades = 0
        self.winning_trades = 0
        self.total_pnl = 0
        
        # Initialize futures symbols based on account phase
        self.InitializeFuturesProducts()
        
    def InitializeFuturesProducts(self):
        """Initialize futures products based on account phase"""
        self.futures_products = {}
        self.correlation_groups = {}
        
        current_phase = self.algo.GetAccountPhase() if hasattr(self.algo, 'GetAccountPhase') else 4
        
        # Phase 2+: Micro futures
        if current_phase >= 2:
            # Micro Crude Oil (Energy correlation group B1)
            mcl = self.algo.AddFuture(
                Futures.Energies.MicroCrudeOilWTI,
                Resolution.Minute
            )
            mcl.SetFilter(0, 120)
            self.futures_products['MCL'] = mcl.Symbol
            self.correlation_groups['MCL'] = 'B1'
            
            # Micro Gold (Metals correlation group C1)
            mgc = self.algo.AddFuture(
                Futures.Metals.MicroGold,
                Resolution.Minute
            )
            mgc.SetFilter(0, 120)
            self.futures_products['MGC'] = mgc.Symbol
            self.correlation_groups['MGC'] = 'C1'
            
            # Micro S&P 500 (Equities correlation group A1)
            mes = self.algo.AddFuture(
                Futures.Indices.MicroSP500EMini,
                Resolution.Minute
            )
            mes.SetFilter(0, 120)
            self.futures_products['MES'] = mes.Symbol
            self.correlation_groups['MES'] = 'A1'
        
        # Phase 3+: Full size futures
        if current_phase >= 3:
            # Crude Oil WTI (Energy correlation group B1)
            cl = self.algo.AddFuture(
                Futures.Energies.CrudeOilWTI,
                Resolution.Minute
            )
            cl.SetFilter(0, 120)
            self.futures_products['CL'] = cl.Symbol
            self.correlation_groups['CL'] = 'B1'
            
            # Gold (Metals correlation group C1)
            gc = self.algo.AddFuture(
                Futures.Metals.Gold,
                Resolution.Minute
            )
            gc.SetFilter(0, 120)
            self.futures_products['GC'] = gc.Symbol
            self.correlation_groups['GC'] = 'C1'
            
            # S&P 500 E-mini (Equities correlation group A1)
            es = self.algo.AddFuture(
                Futures.Indices.SP500EMini,
                Resolution.Minute
            )
            es.SetFilter(0, 120)
            self.futures_products['ES'] = es.Symbol
            self.correlation_groups['ES'] = 'A1'
        
        # Phase 4+: Currency futures
        if current_phase >= 4:
            # Euro (Currency correlation group E1)
            try:
                eur = self.algo.AddFuture(
                    Futures.Currencies.EUR,
                    Resolution.Minute
                )
                eur.SetFilter(0, 120)
                self.futures_products['6E'] = eur.Symbol
                self.correlation_groups['6E'] = 'E1'
            except:
                self.algo.Log("EUR futures not available")
            
            # Australian Dollar (Currency correlation group E1)
            try:
                aud = self.algo.AddFuture(
                    Futures.Currencies.AUD,
                    Resolution.Minute
                )
                aud.SetFilter(0, 120)
                self.futures_products['6A'] = aud.Symbol
                self.correlation_groups['6A'] = 'E1'
            except:
                self.algo.Log("AUD futures not available")
        
        self.algo.Log(f"Futures Strangles: Initialized {len(self.futures_products)} products for Phase {current_phase}")
        for product, symbol in self.futures_products.items():
            self.algo.Log(f"  {product}: {self.correlation_groups[product]} correlation group")
    
    def CheckEntryOpportunities(self):
        """Check for futures strangle entry opportunities (Second Tuesday logic)"""
        # Tom King Entry Schedule: Second Tuesday of each month
        if not self.IsSecondTuesday():
            return
        
        # VIX regime check - don't trade in extreme volatility
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix > 30:
            self.algo.Log(f"Futures Strangles SKIPPED - VIX too high: {current_vix:.1f}")
            return
        
        # Check buying power availability
        bp_used = self.algo.GetBuyingPowerUsedPercent() if hasattr(self.algo, 'GetBuyingPowerUsedPercent') else 0.5
        max_bp = self.algo.GetMaxBPForVIX() if hasattr(self.algo, 'GetMaxBPForVIX') else 0.75
        
        if bp_used > max_bp * 0.8:  # Leave 20% buffer
            self.algo.Log(f"Futures Strangles SKIPPED - BP used: {bp_used:.1%}")
            return
        
        # Evaluate each futures product
        for product_name, symbol in self.futures_products.items():
            if product_name not in self.positions:
                self.EvaluateStrangleEntry(product_name, symbol)
    
    def IsSecondTuesday(self):
        """Check if current date is the second Tuesday of the month"""
        if self.algo.Time.weekday() != 1:  # Not Tuesday
            return False
        
        # Count Tuesdays in the month so far
        tuesday_count = 0
        current_day = self.algo.Time.day
        
        for day in range(1, current_day + 1):
            test_date = datetime(self.algo.Time.year, self.algo.Time.month, day)
            if test_date.weekday() == 1:  # Tuesday
                tuesday_count += 1
        
        return tuesday_count == 2
    
    def EvaluateStrangleEntry(self, product_name, symbol):
        """Evaluate strangle entry for a specific futures product"""
        # Check correlation group limits
        corr_group = self.correlation_groups[product_name]
        if hasattr(self.algo, 'CheckCorrelationLimits'):
            if not self.algo.CheckCorrelationLimits(corr_group):
                self.algo.Log(f"Futures Strangle SKIPPED - {product_name}: Correlation group {corr_group} at limit")
                return
        
        # Get futures chain
        if symbol not in self.algo.CurrentSlice.FutureChains:
            return
        
        chain = self.algo.CurrentSlice.FutureChains[symbol]
        if not chain:
            return
        
        # Get front month contract with sufficient DTE
        contracts = sorted([c for c in chain], key=lambda x: x.Expiry)
        suitable_contracts = [c for c in contracts 
                             if (c.Expiry.date() - self.algo.Time.date()).days >= 60]
        
        if not suitable_contracts:
            self.algo.Log(f"No suitable {product_name} contracts with sufficient DTE")
            return
        
        front_month = suitable_contracts[0]
        self.InitializeFuturesOptions(front_month, product_name)
    
    def InitializeFuturesOptions(self, futures_contract, product_name):
        """Initialize options for futures contract and attempt strangle entry"""
        try:
            # Add futures options
            option = self.algo.AddFutureOption(futures_contract.Symbol, Resolution.Minute)
            option.SetFilter(
                lambda x: x.Strikes(-15, 15)
                          .Expiration(80, 100)  # Target 90 DTE
            )
            
            self.algo.Log(f"Initialized futures options for {product_name}")
            
            # Schedule strangle entry for next bar (after options data loads)
            self.algo.Schedule.On(
                self.algo.DateRules.Tomorrow,
                self.algo.TimeRules.At(10, 0),
                lambda: self.ExecuteStrangleEntry(product_name, futures_contract)
            )
            
        except Exception as e:
            self.algo.Log(f"Error initializing options for {product_name}: {str(e)}")
    
    def ExecuteStrangleEntry(self, product_name, futures_contract):
        """Execute strangle entry with proper delta-based strike selection"""
        if product_name in self.positions:
            return  # Already have position
        
        # Get options chain
        option_chains = self.algo.CurrentSlice.OptionChains
        option_chain = None
        
        for symbol, chain in option_chains.items():
            if chain and len(chain) > 0:
                if any(c.UnderlyingSymbol == futures_contract.Symbol for c in chain):
                    option_chain = chain
                    break
        
        if not option_chain:
            self.algo.Log(f"No option chain available for {product_name}")
            return
        
        # Filter for target DTE (85-95 days)
        target_expiry = self.algo.Time + timedelta(days=90)
        option_contracts = [c for c in option_chain 
                          if 85 <= (c.Expiry.date() - self.algo.Time.date()).days <= 95]
        
        if len(option_contracts) < 4:
            self.algo.Log(f"Insufficient option contracts for {product_name} with target DTE")
            return
        
        # Separate puts and calls
        calls = [c for c in option_contracts if c.Right == OptionRight.Call]
        puts = [c for c in option_contracts if c.Right == OptionRight.Put]
        
        if len(calls) < 2 or len(puts) < 2:
            self.algo.Log(f"Insufficient put/call options for {product_name} strangle")
            return
        
        # Get underlying price
        underlying_price = futures_contract.Price
        
        # Enhanced delta-based strike selection
        selected_call = self.SelectDeltaBasedStrike(calls, underlying_price, self.target_call_delta, OptionRight.Call)
        selected_put = self.SelectDeltaBasedStrike(puts, underlying_price, self.target_put_delta, OptionRight.Put)
        
        if not selected_call or not selected_put:
            self.algo.Log(f"Could not select appropriate strikes for {product_name} strangle")
            return
        
        # Calculate position size using Kelly Criterion
        kelly_size = self.CalculatePositionSize(product_name)
        contracts = max(1, int(kelly_size))  # Minimum 1 contract
        
        # Execute strangle (sell both puts and calls)
        call_ticket = self.algo.Sell(selected_call.Symbol, contracts)
        put_ticket = self.algo.Sell(selected_put.Symbol, contracts)
        
        if call_ticket and put_ticket:
            # Calculate entry credit
            entry_credit = (selected_call.BidPrice + selected_put.BidPrice) * contracts
            
            # Track position
            position_id = f"{product_name}_STRANGLE_{self.algo.Time.strftime('%Y%m%d')}"
            self.positions[product_name] = {
                'position_id': position_id,
                'call_symbol': selected_call.Symbol,
                'put_symbol': selected_put.Symbol,
                'call_strike': selected_call.Strike,
                'put_strike': selected_put.Strike,
                'contracts': contracts,
                'entry_time': self.algo.Time,
                'expiry': selected_call.Expiry.date(),
                'underlying_symbol': futures_contract.Symbol,
                'underlying_price_at_entry': underlying_price,
                'entry_credit': entry_credit,
                'correlation_group': self.correlation_groups[product_name]
            }
            
            self.entry_credits[product_name] = entry_credit
            
            # Update tracking
            self.total_trades += 1
            
            # Update correlation group tracking
            if hasattr(self.algo, 'correlation_positions'):
                corr_group = self.correlation_groups[product_name]
                self.algo.correlation_positions[corr_group].append(position_id)
            
            self.algo.Log(f"FUTURES STRANGLE EXECUTED: {product_name}")
            self.algo.Log(f"  Call: ${selected_call.Strike:.2f} ({selected_call.Symbol})")
            self.algo.Log(f"  Put: ${selected_put.Strike:.2f} ({selected_put.Symbol})")
            self.algo.Log(f"  Contracts: {contracts} | Entry Credit: ${entry_credit:.2f}")
            self.algo.Log(f"  Underlying: ${underlying_price:.2f} | DTE: {(selected_call.Expiry.date() - self.algo.Time.date()).days}")
            
            # Update strategy performance tracking
            if hasattr(self.algo, 'strategy_performance'):
                self.algo.strategy_performance['FUTURES_STRANGLE']['trades'] += 1
        else:
            self.algo.Log(f"Failed to execute strangle orders for {product_name}")
    
    def SelectDeltaBasedStrike(self, options, underlying_price, target_delta, option_right):
        """Select strike based on target delta (5-7 for puts, 5-6 for calls)"""
        if not options:
            return None
        
        # For futures options, approximate delta based on moneyness
        # This is a simplified approach - in production would use proper Greeks
        best_option = None
        best_delta_diff = float('inf')
        
        for option in options:
            # Approximate delta based on strike vs underlying price
            if option_right == OptionRight.Call:
                # Calls: delta decreases as strike increases (OTM)
                moneyness = option.Strike / underlying_price
                if moneyness > 1.05:  # At least 5% OTM
                    # Approximate delta for OTM calls
                    estimated_delta = max(1, 50 * (1.20 - moneyness))  # Rough approximation
                    delta_diff = abs(estimated_delta - target_delta)
                    
                    if delta_diff < best_delta_diff:
                        best_delta_diff = delta_diff
                        best_option = option
            
            else:  # Put
                # Puts: delta increases (absolute value) as strike decreases (OTM)
                moneyness = option.Strike / underlying_price
                if moneyness < 0.95:  # At least 5% OTM
                    # Approximate delta for OTM puts
                    estimated_delta = max(1, 50 * (0.80 - moneyness))  # Rough approximation
                    delta_diff = abs(estimated_delta - target_delta)
                    
                    if delta_diff < best_delta_diff:
                        best_delta_diff = delta_diff
                        best_option = option
        
        return best_option
    
    def CalculatePositionSize(self, product_name):
        """Calculate position size using Kelly Criterion for futures"""
        # Conservative Kelly sizing for futures
        base_kelly = 0.15  # 15% base allocation
        
        # Account phase adjustments
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase <= 2:
            base_kelly *= 0.8  # More conservative for smaller accounts
        
        # VIX regime adjustments
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix > 25:
            base_kelly *= 0.6  # Much more conservative in high vol
        elif current_vix < 15:
            base_kelly *= 1.2  # Slightly more aggressive in low vol
        
        # Convert to contract count (simplified)
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        position_value = portfolio_value * base_kelly
        
        # Estimate margin per contract (varies by product)
        margin_per_contract = self.GetEstimatedMargin(product_name)
        contracts = max(1, min(5, int(position_value / margin_per_contract)))
        
        return contracts
    
    def GetEstimatedMargin(self, product_name):
        """Get estimated margin requirement per contract"""
        margin_estimates = {
            'MCL': 3000,   # Micro Crude Oil
            'MGC': 4000,   # Micro Gold
            'MES': 1200,   # Micro S&P 500
            'CL': 15000,   # Crude Oil
            'GC': 20000,   # Gold
            'ES': 6000,    # S&P 500 E-mini
            '6E': 2000,    # Euro
            '6A': 2000     # Australian Dollar
        }
        return margin_estimates.get(product_name, 5000)  # Default 5k
    
    def CheckPositionManagement(self):
        """Check all positions for management opportunities"""
        for product_name, position in list(self.positions.items()):
            self.CheckPositionExit(product_name, position)
            self.UpdatePositionHealth(product_name, position)
    
    def CheckPositionExit(self, product_name, position):
        """Check individual position for exit conditions"""
        # Calculate DTE
        dte = (position['expiry'] - self.algo.Time.date()).days
        
        # Tom King 21 DTE rule
        if dte <= self.management_dte:
            self.ClosePosition(product_name, "21 DTE Management")
            return
        
        # Check profit target (50%)
        current_call_price = self.algo.Securities[position['call_symbol']].Price
        current_put_price = self.algo.Securities[position['put_symbol']].Price
        current_value = (current_call_price + current_put_price) * position['contracts']
        
        entry_credit = self.entry_credits.get(product_name, 0)
        if entry_credit > 0:
            profit_percent = (entry_credit - current_value) / entry_credit
            
            # 50% profit target
            if profit_percent >= self.profit_target:
                self.ClosePosition(product_name, f"Profit Target Hit ({profit_percent:.1%})")
                return
            
            # Stop loss (150% of credit received)
            elif current_value >= entry_credit * self.stop_loss:
                self.ClosePosition(product_name, f"Stop Loss Hit ({profit_percent:.1%})")
                return
        
        # VIX spike protection (August 2024 scenario)
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix > 40:  # Emergency VIX spike
            self.ClosePosition(product_name, f"VIX Spike Protection ({current_vix:.1f})")
            return
    
    def UpdatePositionHealth(self, product_name, position):
        """Update position health score (0-100)"""
        health_score = 100
        
        # DTE penalty
        dte = (position['expiry'] - self.algo.Time.date()).days
        if dte <= 5:
            health_score -= 40
        elif dte <= 21:
            health_score -= 20
        elif dte <= 45:
            health_score -= 10
        
        # P&L impact
        try:
            current_call_price = self.algo.Securities[position['call_symbol']].Price
            current_put_price = self.algo.Securities[position['put_symbol']].Price
            current_value = (current_call_price + current_put_price) * position['contracts']
            entry_credit = self.entry_credits.get(product_name, 0)
            
            if entry_credit > 0:
                profit_percent = (entry_credit - current_value) / entry_credit
                if profit_percent < -0.5:  # Losing more than 50%
                    health_score -= 25
                elif profit_percent < -0.25:  # Losing more than 25%
                    health_score -= 15
                elif profit_percent > 0.25:  # Winning more than 25%
                    health_score += 10
        except:
            health_score -= 10  # Penalty for pricing errors
        
        # VIX impact
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix > 30:
            health_score -= 15
        
        self.position_health[product_name] = max(0, min(100, health_score))
        
        # Log warnings for low health
        if health_score < 25:
            self.algo.Log(f"FUTURES STRANGLE HEALTH WARNING: {product_name} score: {health_score:.0f}")
    
    def ClosePosition(self, product_name, reason):
        """Close futures strangle position"""
        if product_name not in self.positions:
            return
        
        position = self.positions[product_name]
        
        try:
            # Buy back short positions
            call_ticket = self.algo.Buy(position['call_symbol'], position['contracts'])
            put_ticket = self.algo.Buy(position['put_symbol'], position['contracts'])
            
            if call_ticket and put_ticket:
                # Calculate final P&L
                current_call_price = self.algo.Securities[position['call_symbol']].Price
                current_put_price = self.algo.Securities[position['put_symbol']].Price
                exit_cost = (current_call_price + current_put_price) * position['contracts']
                entry_credit = self.entry_credits.get(product_name, 0)
                
                pnl = entry_credit - exit_cost
                self.total_pnl += pnl
                
                if pnl > 0:
                    self.winning_trades += 1
                
                # Update strategy performance
                if hasattr(self.algo, 'strategy_performance'):
                    if pnl > 0:
                        self.algo.strategy_performance['FUTURES_STRANGLE']['wins'] += 1
                    self.algo.strategy_performance['FUTURES_STRANGLE']['total_pnl'] += pnl
                
                # Clean up correlation tracking
                if hasattr(self.algo, 'correlation_positions'):
                    corr_group = position['correlation_group']
                    if position['position_id'] in self.algo.correlation_positions[corr_group]:
                        self.algo.correlation_positions[corr_group].remove(position['position_id'])
                
                self.algo.Log(f"FUTURES STRANGLE CLOSED: {product_name}")
                self.algo.Log(f"  Reason: {reason}")
                self.algo.Log(f"  P&L: ${pnl:+.2f} | Entry Credit: ${entry_credit:.2f} | Exit Cost: ${exit_cost:.2f}")
                self.algo.Log(f"  Days Held: {(self.algo.Time - position['entry_time']).days}")
                
                # Clean up tracking
                del self.positions[product_name]
                if product_name in self.entry_credits:
                    del self.entry_credits[product_name]
                if product_name in self.position_health:
                    del self.position_health[product_name]
                
            else:
                self.algo.Log(f"Failed to close strangle for {product_name}")
                
        except Exception as e:
            self.algo.Log(f"Error closing position {product_name}: {str(e)}")
    
    def GetPerformanceReport(self):
        """Get performance summary for futures strangles"""
        win_rate = (self.winning_trades / max(1, self.total_trades)) * 100
        avg_pnl = self.total_pnl / max(1, self.total_trades)
        
        report = {
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'win_rate': win_rate,
            'total_pnl': self.total_pnl,
            'avg_pnl': avg_pnl,
            'active_positions': len(self.positions)
        }
        
        return report
