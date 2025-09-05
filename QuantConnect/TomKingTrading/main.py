# Tom King Trading Framework - QuantConnect LEAN Implementation
# Main Algorithm Entry Point
# Target: £35,000 → £80,000 in 8 months

from AlgorithmImports import *
from strategies.friday_0dte import Friday0DTEStrategy
from strategies.long_term_112 import LongTerm112Strategy
from strategies.futures_strangle import FuturesStrangleStrategy
from risk.position_sizing import VIXBasedPositionSizing
from risk.correlation import CorrelationManager
from config.parameters import TOM_KING_PARAMETERS

class TomKingTradingAlgorithm(QCAlgorithm):
    """
    Professional implementation of Tom King's proven trading methodology.
    Combines Friday 0DTE, Long Term 112, and Futures Strangles with
    sophisticated risk management and VIX-based position sizing.
    """
    
    def Initialize(self):
        """Initialize algorithm with Tom King parameters"""
        # Set dates and capital
        self.SetStartDate(2023, 1, 1)  # 2-year backtest period
        self.SetEndDate(2025, 1, 1)
        self.SetCash(35000)  # £35,000 starting capital (GBP)
        
        # Set brokerage model to TastyTrade
        self.SetBrokerageModel(BrokerageName.Tastytrade)
        
        # Set data normalization
        self.SetSecurityInitializer(self.SecurityInitializer)
        
        # Initialize account phase (Phase 1: £30-40k)
        self.account_phase = self.GetAccountPhase()
        
        # Initialize VIX for regime detection
        self.vix = self.AddIndex("VIX", Resolution.Minute)
        self.vix_regime = "NORMAL"
        
        # Initialize core symbols
        self.InitializeSymbols()
        
        # Initialize strategies
        self.strategies = {
            'friday_0dte': Friday0DTEStrategy(self),
            'long_term_112': LongTerm112Strategy(self),
            'futures_strangle': FuturesStrangleStrategy(self)
        }
        
        # Initialize risk management
        self.position_sizer = VIXBasedPositionSizing(self)
        self.correlation_manager = CorrelationManager(self)
        
        # Schedule strategy executions
        self.ScheduleStrategies()
        
        # Set warm-up period for indicators
        self.SetWarmUp(timedelta(days=30))
        
        # Performance tracking
        self.win_count = 0
        self.loss_count = 0
        self.monthly_returns = []
        
        self.Log(f"Tom King Trading Algorithm Initialized - Target: £80,000")
        self.Log(f"Starting Capital: £{self.Portfolio.Cash:,.2f}")
        self.Log(f"Account Phase: {self.account_phase}")
    
    def InitializeSymbols(self):
        """Initialize trading symbols based on account phase"""
        # Core ETFs
        self.spy = self.AddEquity("SPY", Resolution.Minute)
        self.iwm = self.AddEquity("IWM", Resolution.Minute)
        self.qqq = self.AddEquity("QQQ", Resolution.Minute)
        
        # Phase 1 symbols (£30-40k)
        if self.account_phase >= 1:
            self.gld = self.AddEquity("GLD", Resolution.Minute)
            self.tlt = self.AddEquity("TLT", Resolution.Minute)
            
            # Micro futures for Phase 1
            self.mcl = self.AddFuture(Futures.Energies.MicroCrudeOilWTI, Resolution.Minute)
            self.mgc = self.AddFuture(Futures.Metals.MicroGold, Resolution.Minute)
        
        # Phase 2 symbols (£40-60k)
        if self.account_phase >= 2:
            self.mes = self.AddFuture(Futures.Indices.MicroSP500EMini, Resolution.Minute)
            self.mnq = self.AddFuture(Futures.Indices.MicroNASDAQ100EMini, Resolution.Minute)
        
        # Phase 3+ symbols (£60k+)
        if self.account_phase >= 3:
            self.es = self.AddFuture(Futures.Indices.SP500EMini, Resolution.Minute)
            self.nq = self.AddFuture(Futures.Indices.NASDAQ100EMini, Resolution.Minute)
            self.gc = self.AddFuture(Futures.Metals.Gold, Resolution.Minute)
            self.cl = self.AddFuture(Futures.Energies.CrudeOilWTI, Resolution.Minute)
        
        # Add options for all equity symbols
        for symbol in [self.spy, self.iwm, self.qqq]:
            option = self.AddOption(symbol.Symbol, Resolution.Minute)
            option.SetFilter(-10, 10, 0, 45)  # Strike range and DTE
    
    def ScheduleStrategies(self):
        """Schedule strategy executions based on Tom King rules"""
        # Friday 0DTE - Every Friday at 10:30 AM ET
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Friday),
            self.TimeRules.At(10, 30),
            self.ExecuteFriday0DTE
        )
        
        # Long Term 112 - Check daily at market open
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(9, 35),
            self.CheckLongTerm112
        )
        
        # Defensive Management - Check at 21 DTE
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(10, 0),
            self.CheckDefensiveAdjustments
        )
        
        # Profit Target Check - Every 30 minutes
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.Every(timedelta(minutes=30)),
            self.CheckProfitTargets
        )
        
        # VIX Regime Update - Every hour
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.Every(timedelta(hours=1)),
            self.UpdateVIXRegime
        )
    
    def ExecuteFriday0DTE(self):
        """Execute Friday 0DTE strategy"""
        if self.IsWarmingUp:
            return
        
        # Check if we have capacity
        if not self.HasCapacity():
            self.Log("Friday 0DTE: No capacity available")
            return
        
        # Execute strategy
        self.strategies['friday_0dte'].Execute()
    
    def CheckLongTerm112(self):
        """Check for Long Term 112 opportunities"""
        if self.IsWarmingUp:
            return
        
        # Only enter if we have 45+ DTE available
        self.strategies['long_term_112'].CheckEntry()
    
    def CheckDefensiveAdjustments(self):
        """Check positions at 21 DTE for defensive adjustments"""
        for position in self.Portfolio.Values:
            if position.Invested:
                # Check DTE
                if self.GetDTE(position.Symbol) <= 21:
                    # Apply defensive adjustment if losing
                    if position.UnrealizedProfitPercent < 0:
                        self.Log(f"Defensive adjustment needed for {position.Symbol}")
                        self.AdjustPosition(position)
    
    def CheckProfitTargets(self):
        """Check all positions for profit targets"""
        for position in self.Portfolio.Values:
            if position.Invested:
                # 50% profit target for most strategies
                if position.UnrealizedProfitPercent >= 0.50:
                    self.Log(f"Profit target reached for {position.Symbol}: {position.UnrealizedProfitPercent:.1%}")
                    self.Liquidate(position.Symbol, "50% Profit Target")
                    self.win_count += 1
                
                # 200% stop loss
                elif position.UnrealizedProfitPercent <= -2.0:
                    self.Log(f"Stop loss triggered for {position.Symbol}: {position.UnrealizedProfitPercent:.1%}")
                    self.Liquidate(position.Symbol, "200% Stop Loss")
                    self.loss_count += 1
    
    def UpdateVIXRegime(self):
        """Update VIX regime for position sizing"""
        if self.IsWarmingUp:
            return
        
        vix_price = self.Securities["VIX"].Price
        
        # Determine regime
        if vix_price < 15:
            self.vix_regime = "LOW"
            self.max_bp_usage = 0.45
        elif vix_price < 20:
            self.vix_regime = "NORMAL" 
            self.max_bp_usage = 0.52
        elif vix_price < 25:
            self.vix_regime = "ELEVATED"
            self.max_bp_usage = 0.65
        elif vix_price < 35:
            self.vix_regime = "HIGH"
            self.max_bp_usage = 0.75
        else:
            self.vix_regime = "EXTREME"
            self.max_bp_usage = 0.80
        
        self.Debug(f"VIX Regime: {self.vix_regime} ({vix_price:.2f}) - Max BP: {self.max_bp_usage:.0%}")
    
    def HasCapacity(self):
        """Check if we have capacity for new positions"""
        # Check buying power usage
        bp_used = self.GetBuyingPowerUsed()
        if bp_used >= self.max_bp_usage:
            return False
        
        # Check position count by phase
        position_count = len([p for p in self.Portfolio.Values if p.Invested])
        max_positions = [3, 8, 12, 20][self.account_phase - 1]
        
        if position_count >= max_positions:
            return False
        
        # Check correlation limits
        return self.correlation_manager.CanAddPosition()
    
    def GetAccountPhase(self):
        """Determine account phase based on balance"""
        balance = self.Portfolio.TotalPortfolioValue
        
        if balance < 40000:
            return 1  # Phase 1: £30-40k
        elif balance < 60000:
            return 2  # Phase 2: £40-60k
        elif balance < 75000:
            return 3  # Phase 3: £60-75k
        else:
            return 4  # Phase 4: £75k+
    
    def GetBuyingPowerUsed(self):
        """Calculate current buying power usage"""
        return self.Portfolio.TotalMarginUsed / self.Portfolio.TotalPortfolioValue
    
    def GetDTE(self, symbol):
        """Get days to expiration for an option"""
        if symbol.SecurityType == SecurityType.Option:
            return (symbol.ID.Date - self.Time).days
        return float('inf')
    
    def AdjustPosition(self, position):
        """Apply defensive adjustment to losing position"""
        # Implementation depends on strategy type
        # Roll to next expiration, convert to butterfly, etc.
        pass
    
    def SecurityInitializer(self, security):
        """Initialize security with proper settings"""
        security.SetDataNormalizationMode(DataNormalizationMode.Raw)
        security.SetLeverage(1.0)
        security.SetFillModel(ImmediateFillModel())
        security.SetFeeModel(TastyTradeFeeModel())
    
    def OnData(self, data):
        """Process incoming data"""
        if self.IsWarmingUp:
            return
        
        # Strategies handle their own data processing
        for strategy in self.strategies.values():
            if hasattr(strategy, 'OnData'):
                strategy.OnData(data)
    
    def OnEndOfAlgorithm(self):
        """Final reporting"""
        final_value = self.Portfolio.TotalPortfolioValue
        total_return = (final_value - 35000) / 35000 * 100
        win_rate = self.win_count / (self.win_count + self.loss_count) * 100 if (self.win_count + self.loss_count) > 0 else 0
        
        self.Log("=" * 50)
        self.Log("TOM KING TRADING - FINAL RESULTS")
        self.Log("=" * 50)
        self.Log(f"Starting Capital: £35,000")
        self.Log(f"Final Value: £{final_value:,.2f}")
        self.Log(f"Total Return: {total_return:.2f}%")
        self.Log(f"Win Rate: {win_rate:.1f}%")
        self.Log(f"Wins: {self.win_count}, Losses: {self.loss_count}")
        self.Log(f"Target Achieved: {'YES' if final_value >= 80000 else 'NO'}")
        self.Log("=" * 50)


class TastyTradeFeeModel(FeeModel):
    """TastyTrade fee model for accurate cost simulation"""
    def GetOrderFee(self, parameters):
        fee = 0
        
        if parameters.Security.Type == SecurityType.Option:
            # $1 per contract, capped at $10 per leg
            fee = min(parameters.Order.AbsoluteQuantity, 10)
        elif parameters.Security.Type == SecurityType.Future:
            # $2.25 per contract
            fee = parameters.Order.AbsoluteQuantity * 2.25
        else:
            # Free stock trades
            fee = 0
        
        return OrderFee(CashAmount(fee, "USD"))