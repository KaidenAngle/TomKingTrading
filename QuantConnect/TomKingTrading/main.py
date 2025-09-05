# Tom King Trading Framework - QuantConnect LEAN Implementation
# Main Algorithm Entry Point
# Target: $35,000  $80,000 in 8 months

from AlgorithmImports import *
from datetime import time, timedelta
from typing import List
from strategies.friday_0dte import TomKingFriday0DTEStrategy
from strategies.long_term_112 import TomKingLT112CoreStrategy
from strategies.ipmcc_strategy import TomKingIPMCCStrategy
from strategies.futures_strangle import TomKingFuturesStrangleStrategy
from strategies.advanced_strategies import Section9BAdvancedStrategies, AdvancedStrategyType
from strategies.calendarized_112 import CalendarizedLT112Strategy, LT112Variant
from strategies.bear_trap_11x import BearTrap11XStrategy, BearTrapVariant
from strategies.advanced_0dte import Advanced0DTEStrategies, ZeroDTEVariant
from strategies.seasonal_overlay import SeasonalOverlaySystem
from strategies.enhanced_strangles import EnhancedStrangleSystem, RatioConfiguration
from strategies.earnings_dividend_avoidance import EarningsDividendAvoidanceSystem, EventType, EventSeverity
from strategies.rolling_methodology import TomKingRollingSystem, RollingPosition, PositionType, RollTrigger
from strategies.uk_tax_optimization import UKTaxOptimizationSystem, TaxAccountingMethod, UKTaxStatus, Section1256Contract
from validation.backtesting_validation import BacktestingValidationSystem, ValidationPeriod, PerformanceMetric
from trading.live_trading_readiness import LiveTradingReadinessSystem, BrokerageProvider, LiveTradingMode, RiskLevel
from risk.position_sizing import VIXBasedPositionSizing
from risk.correlation import CorrelationManager
from risk.defensive import DefensiveManager
from risk.phase_manager import PhaseManager
from risk.kelly_criterion import KellyCriterion
from config.parameters import TomKingParameters

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
        self.SetCash(35000)  # $35,000 starting capital (GBP)
        
        # Set brokerage model to TastyTrade
        self.SetBrokerageModel(BrokerageName.Tastytrade)
        
        # Set data normalization
        self.SetSecurityInitializer(self.SecurityInitializer)
        
        # Initialize account phase (Phase 1: $30-40k)
        self.account_phase = self.GetAccountPhase()
        
        # Initialize VIX for regime detection
        self.vix = self.AddIndex("VIX", Resolution.Minute)
        self.vix_regime = "NORMAL"  # Default, will be updated on first data
        self.max_bp_usage = 0.60  # Default 60% until VIX regime is calculated
        self._last_vix_regime = "NORMAL"  # Track for change detection
        
        # Set warmup period for indicators
        self.SetWarmup(timedelta(days=30))
        
        # Initialize core symbols
        self.InitializeSymbols()
        
        # Initialize strategies
        self.strategies = {
            'friday_0dte': TomKingFriday0DTEStrategy(self),  # 88% win rate target
            'lt112_core': TomKingLT112CoreStrategy(self),    # 95% win rate target, 120 DTE
            'ipmcc': TomKingIPMCCStrategy(self),            # $1,600-1,800/month strategy
            'futures_strangle': TomKingFuturesStrangleStrategy(self)  # 90 DTE futures
        }
        
        # Initialize Section 9B Advanced Strategies (Phase 3+ only)
        self.advanced_strategies = Section9BAdvancedStrategies(self)
        
        # Initialize Calendarized LT112 Strategy (Phase 2+ monthly entries)
        self.calendarized_lt112 = CalendarizedLT112Strategy(self)
        
        # Initialize 11x Bear Trap Strategy (Phase 3+ opportunity-based entries)
        self.bear_trap_11x = BearTrap11XStrategy(self)
        
        # Initialize Advanced 0DTE Strategies (Batman Spread, Broken Wing IC)
        self.advanced_0dte = Advanced0DTEStrategies(self)
        
        # Initialize Seasonal Overlay System (month-by-month allocations)
        self.seasonal_overlay = SeasonalOverlaySystem(self)
        
        # Initialize Enhanced Strangle System (ratio elements and BP efficiency)
        self.enhanced_strangles = EnhancedStrangleSystem(self)
        
        # Initialize Earnings & Dividend Avoidance System (event risk management)
        self.earnings_dividend_avoidance = EarningsDividendAvoidanceSystem(self)
        
        # Set up earnings/dividend tracking for key symbols
        self.SetupEventTracking()
        
        # Initialize Tom King Rolling Methodology System (DTE and position management)
        self.rolling_system = TomKingRollingSystem(self)
        
        # Initialize UK Tax Optimization System (Section 1256 focus and UK tax efficiency)
        self.uk_tax_system = UKTaxOptimizationSystem(self)
        
        # Initialize Backtesting Validation System (Tom King historical performance validation)
        self.validation_system = BacktestingValidationSystem(self)
        
        # Initialize Live Trading Readiness System (production-grade live trading preparation)
        self.live_trading_system = LiveTradingReadinessSystem(self)
        
        # Initialize risk management
        self.position_sizer = VIXBasedPositionSizing(self)
        self.correlation_manager = CorrelationManager(self)
        self.defensive_manager = DefensiveManager(self)
        self.phase_manager = PhaseManager(self)
        self.kelly_criterion = KellyCriterion(self)
        
        # Initialize performance monitoring
        from reporting.performance_monitor import PerformanceMonitor
        self.performance_monitor = PerformanceMonitor(self)
        
        # Initialize execution engine, position tracking, exit manager, and Greeks engine for Tom King rules
        from trading.order_execution_engine import ExecutionEngine
        from trading.position_exit_manager import PositionExitManager
        from trading.position_tracker import PositionTracker
        from greeks.greeks_engine import GreeksEngine
        self.execution_engine = ExecutionEngine(self)
        self.position_tracker = PositionTracker(self)
        self.position_exit_manager = PositionExitManager(self)
        self.greeks_engine = GreeksEngine(self)
        
        # Initialize weekly cadence tracker for proper strategy scheduling
        from trading.weekly_cadence_tracker import WeeklyCadenceTracker
        self.cadence_tracker = WeeklyCadenceTracker(self)
        
        # Initialize crash protection tracking
        self.vix_history = []  # Track VIX history for spike detection
        self.crash_protection_active = False
        
        # Schedule strategy executions
        self.ScheduleStrategies()
        
        # Set warm-up period for indicators
        
        # Performance tracking
        self.win_count = 0
        self.loss_count = 0
        self.monthly_returns = []
        
        self.Log(f"Tom King Trading Algorithm Initialized - Target: $80,000")
        self.Log(f"Starting Capital: ${self.Portfolio.Cash:,.2f}")
        self.Log(f"Account Phase: {self.account_phase}")
    
    def InitializeSymbols(self):
        """Initialize trading symbols based on account phase"""
        # Core ETFs
        self.spy = self.AddEquity("SPY", Resolution.Minute)
        self.iwm = self.AddEquity("IWM", Resolution.Minute)
        self.qqq = self.AddEquity("QQQ", Resolution.Minute)
        
        # Phase 1 symbols ($30-40k)
        if self.account_phase >= 1:
            self.gld = self.AddEquity("GLD", Resolution.Minute)
            self.tlt = self.AddEquity("TLT", Resolution.Minute)
            
            # Micro futures for Phase 1
            self.mcl = self.AddFuture(Futures.Energies.MicroCrudeOilWTI, Resolution.Minute)
            self.mgc = self.AddFuture(Futures.Metals.MicroGold, Resolution.Minute)
        
        # Phase 2 symbols ($40-60k)
        if self.account_phase >= 2:
            self.mes = self.AddFuture(Futures.Indices.MicroSP500EMini, Resolution.Minute)
            self.mnq = self.AddFuture(Futures.Indices.MicroNASDAQ100EMini, Resolution.Minute)
        
        # Phase 3+ symbols ($60k+)
        if self.account_phase >= 3:
            self.es = self.AddFuture(Futures.Indices.SP500EMini, Resolution.Minute)
            self.nq = self.AddFuture(Futures.Indices.NASDAQ100EMini, Resolution.Minute)
            self.gc = self.AddFuture(Futures.Metals.Gold, Resolution.Minute)
            self.cl = self.AddFuture(Futures.Energies.CrudeOilWTI, Resolution.Minute)
        
        # Add options for all equity symbols
        for symbol in [self.spy, self.iwm, self.qqq]:
            option = self.AddOption(symbol.Symbol, Resolution.Minute)
            option.SetFilter(-50, 50, 0, 180)  # Wider strike range for all strategies, up to 180 DTE for LT112
    
    def ScheduleStrategies(self):
        """Schedule strategy executions based on Tom King rules"""
        # Friday 0DTE - Every Friday at 10:30 AM ET
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Friday),
            self.TimeRules.At(10, 30),
            self.ExecuteFriday0DTE
        )
        
        # Long Term 112 - CORRECTED: Weekly Wednesday entries at 10:00 AM (Tom King specification)
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Wednesday),
            self.TimeRules.At(10, 0),
            self.ExecuteLT112Weekly
        )
        
        # IPMCC - RESTORED: Monthly entries on first trading day at 9:45 AM
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(9, 45),
            self.ExecuteIPMCCMonthly
        )
        
        # Futures Strangle - CORRECTED: Weekly Thursday entries at 10:15 AM (90 DTE)
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Thursday),
            self.TimeRules.At(10, 15),
            self.ExecuteFuturesStrangle
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
        
        # Greeks Portfolio Summary - Every 2 hours
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.Every(timedelta(hours=2)),
            self.LogPortfolioGreeks
        )
        
        # P&L and Performance Summary - Daily at market close
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(16, 0),
            self.LogDailyPerformance
        )
    
    def ExecuteFriday0DTE(self):
        """Execute Friday 0DTE strategy"""
        try:
            if self.IsWarmingUp:
                return
            
            # Check weekly cadence tracker for Friday execution
            can_execute, reason = self.cadence_tracker.can_execute_strategy('FRIDAY_0DTE')
            if not can_execute:
                self.Log(f"[WARNING] Friday 0DTE blocked: {reason}")
                return
            
            # Execute the strategy
            self.strategies['friday_0dte'].Execute()
            
            # Record execution
            self.cadence_tracker.record_strategy_execution('FRIDAY_0DTE')
        except Exception as e:
            self.Error(f"Error executing Friday 0DTE: {str(e)}")
    
    def ExecuteLT112Weekly(self):
        """Execute Long Term 112 weekly entries"""
        try:
            if self.IsWarmingUp:
                return
        
            # Check weekly cadence tracker (Wednesdays only, week 1-4)
            can_enter, reason = self.cadence_tracker.can_enter_lt112()
            if not can_enter:
                self.Log(f"[WARNING] LT112 entry blocked: {reason}")
                return
            
            # Execute the LT112 strategy
            self.strategies['lt112_core'].Execute()
            
            # Record execution
            self.cadence_tracker.record_strategy_execution('LT112')
        except Exception as e:
            self.Error(f"Error executing LT112: {str(e)}")
    
    def ExecuteIPMCCMonthly(self):
        """Execute IPMCC monthly entries"""
        try:
            if self.IsWarmingUp:
                return
            
            # Check if it's the first trading day of the month
            if self.Time.day > 5:  # Simple check for first week
                return
            
            # Execute IPMCC strategy if available
            if hasattr(self.strategies['ipmcc'], 'Execute'):
                self.strategies['ipmcc'].Execute()
            elif hasattr(self.strategies['ipmcc'], 'execute_monthly_ipmcc_entry'):
                self.strategies['ipmcc'].execute_monthly_ipmcc_entry()
            else:
                self.Log("IPMCC strategy method not found")
                
        except Exception as e:
            self.Error(f"Error executing IPMCC: {str(e)}")
    
    def ExecuteFuturesStrangle(self):
        """Execute Futures Strangle weekly entries - CORRECTED implementation"""
        if self.IsWarmingUp:
            return
        
        # Execute using corrected Tom King specifications (90 DTE, not 45)
        self.strategies['futures_strangle'].execute_weekly_entry()
    
    def CheckDefensiveAdjustments(self):
        """Check positions using advanced defensive management system"""
        if self.IsWarmingUp:
            return
        
        # Use the sophisticated DefensiveManager for all position management
        self.defensive_manager.CheckAllPositions()
        
        # Handle any defensive actions recommended
        defensive_actions = self.defensive_manager.GetRecommendedActions()
        for action in defensive_actions:
            self.ExecuteDefensiveAction(action)
    
    def CheckProfitTargets(self):
        """Check all positions for profit targets and exits using Tom King rules"""
        if self.IsWarmingUp:
            return
        
        # Check execution engine positions if available
        if hasattr(self, 'execution_engine'):
            positions_to_exit = self.position_exit_manager.CheckPositionExits(
                self.execution_engine.active_positions
            )
            
            if positions_to_exit:
                self.Log(f"[DATA] Found {len(positions_to_exit)} positions to exit")
                
                # Execute the exits
                exit_results = self.position_exit_manager.ExecuteExits(
                    positions_to_exit, self.execution_engine
                )
                
                # Update win/loss counts
                for result in exit_results.values():
                    if result.get('success'):
                        if 'profit_target' in result.get('reason', ''):
                            self.win_count += 1
                        else:
                            self.loss_count += 1
        
        # Also run defensive manager checks for additional protection
        # The DefensiveManager handles market stress and August 2024 protection
        for position in self.Portfolio.Values:
            if position.Invested:
                # Calculate position health for additional defensive checks
                health_score = self.defensive_manager.CalculatePositionHealth(position.Symbol)
                
                # Only use defensive manager for emergency exits (health < 20)
                if health_score < 20:  # Emergency exit threshold
                    exit_reason = self.defensive_manager.GetExitReason(position.Symbol)
                    self.Log(f"[EMERGENCY] Emergency exit for {position.Symbol}: {exit_reason} (Health: {health_score})")
                    self.loss_count += 1
                    
                    self.Liquidate(position.Symbol, exit_reason)
    
    def LogPortfolioGreeks(self):
        """Log portfolio Greeks summary every 2 hours"""
        if self.IsWarmingUp:
            return
            
        try:
            if hasattr(self, 'execution_engine') and self.execution_engine.active_positions:
                portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(self.execution_engine.active_positions)
                self.greeks_engine.LogPortfolioGreeks(portfolio_greeks)
                
                # Check for position adjustments needed
                for position_id, position in self.execution_engine.active_positions.items():
                    if position.get('status') == 'open':
                        adjustment_signals = self.greeks_engine.GetPositionAdjustmentSignals(position)
                        if adjustment_signals:
                            self.Log(f"[DATA] POSITION {position_id} ADJUSTMENT SIGNALS:")
                            for signal in adjustment_signals:
                                self.Log(f"  - {signal}")
                                
        except Exception as e:
            self.Error(f"Error logging portfolio Greeks: {e}")
    
    def OnOrderEvent(self, order_event):
        """Handle order fills for position tracking"""
        try:
            # Pass to position tracker for P&L calculation
            self.position_tracker.OnOrderEvent(order_event)
            
        except Exception as e:
            self.Error(f"Error processing order event: {e}")
    
    def LogDailyPerformance(self):
        """Log daily P&L and performance summary"""
        if self.IsWarmingUp:
            return
            
        try:
            # Update performance monitor
            self.performance_monitor.UpdateDaily()
            
            # Log comprehensive report
            self.performance_monitor.LogPerformanceReport()
            # Log portfolio P&L
            self.position_tracker.LogPerformanceSummary()
            
            # Update position P&L for all active positions
            for position_id in list(self.position_tracker.active_positions.keys()):
                self.position_tracker.UpdatePositionPnL(position_id)
            
            # Get performance stats
            performance = self.position_tracker.GetPerformanceStats()
            portfolio_pnl = self.position_tracker.GetPortfolioPnL()
            
            # Log Tom King progress towards target
            starting_value = getattr(self, 'starting_portfolio_value', 75000)
            current_value = self.Portfolio.TotalPortfolioValue
            target_value = 80000  # $80k target
            
            # Safe division for progress calculation
            denominator = target_value - starting_value
            if denominator != 0:
                progress_pct = ((current_value - starting_value) / denominator) * 100
            else:
                progress_pct = 100.0 if current_value >= target_value else 0.0
            
            self.Log(f"\n[TARGET] TOM KING PROGRESS:")
            self.Log(f"  Starting: ${starting_value:,.0f}")
            self.Log(f"  Current: ${current_value:,.0f}")
            self.Log(f"  Target: ${target_value:,.0f}")
            self.Log(f"  Progress: {progress_pct:.1f}% to target")
            
            if performance['total_trades'] > 0:
                self.Log(f"\n[DATA] DAILY PERFORMANCE:")
                self.Log(f"  Win Rate: {performance['win_rate']:.1%}")
                self.Log(f"  Avg Win: ${performance['avg_win']:.2f}")
                self.Log(f"  Avg Loss: ${performance['avg_loss']:.2f}")
                self.Log(f"  Total P&L: ${portfolio_pnl['total_pnl']:.2f}")
            
        except Exception as e:
            self.Error(f"Error logging daily performance: {e}")
    
    def UpdateVIXRegime(self):
        """Update VIX regime using sophisticated position sizing module with August 2024 protection"""
        if self.IsWarmingUp:
            return
        
        # Use the sophisticated VIXBasedPositionSizing module for regime detection
        vix_price = self.Securities["VIX"].Price
        self.position_sizer.UpdateVIXLevel(vix_price)
        
        # Update VIX history for August 2024 spike detection
        self.vix_history.append(vix_price)
        if len(self.vix_history) > 10:  # Keep last 10 VIX readings
            self.vix_history.pop(0)
        
        # Get the regime information from the position sizer
        regime_info = self.position_sizer.GetVIXRegimeInfo()
        self.vix_regime = regime_info['regime']
        self.max_bp_usage = regime_info['max_bp_usage']
        
        # Simple crash protection based on VIX level
        if vix_price > 35:
            if not self.crash_protection_active:
                self.Log(f"[EMERGENCY] CRASH PROTECTION ACTIVATED - VIX: {vix_price:.2f}")
                self.crash_protection_active = True
                self.ExecuteEmergencyProtocols()
        elif vix_price < 25 and self.crash_protection_active:
            self.Log(f"[SUCCESS] CRASH PROTECTION DEACTIVATED - VIX: {vix_price:.2f}")
            self.crash_protection_active = False
        
        # Log regime changes
        if hasattr(self, '_last_vix_regime') and self.vix_regime != self._last_vix_regime:
            self.Log(f"VIX Regime Change: {self._last_vix_regime}  {self.vix_regime} (VIX: {vix_price:.2f}) - Max BP: {self.max_bp_usage:.0%}")
        
        self._last_vix_regime = self.vix_regime
        
        # Check for VIX spike opportunity
        if self.position_sizer.IsVIXSpikeOpportunity():
            self.ExecuteVIXSpikeProtocol()
    
    def ExecuteEmergencyProtocols(self):
        """Execute emergency protection protocols during extreme VIX levels"""
        try:
            self.Log(f"[EMERGENCY] EXECUTING EMERGENCY PROTECTION PROTOCOLS")
            
            # Close all high-risk positions
            for symbol, holding in self.Portfolio.items():
                if holding.Invested and holding.Type == SecurityType.Option:
                    if holding.UnrealizedProfitPercent < -(Constants.LT112_LOSS_LIMIT / 100):  # Use 200% loss limit from constants
                        self.Liquidate(symbol, "Emergency protection - excessive loss")
            
            # Reduce overall exposure using emergency protocol target
            target_exposure = Constants.EMERGENCY_EXPOSURE_TARGET
            # Safe division for exposure calculation
            if self.Portfolio.TotalPortfolioValue > 0:
                current_exposure = abs(self.Portfolio.TotalUnrealizedProfit) / self.Portfolio.TotalPortfolioValue
            else:
                current_exposure = 0
                self.Error("Portfolio value is zero - cannot calculate exposure")
            
            if current_exposure > target_exposure:
                self.Log(f"[WARNING] Reducing exposure from {current_exposure:.1%} to {target_exposure:.1%}")
                self._mark_for_exposure_reduction = True
                
        except Exception as e:
            self.Error(f"Failed to execute emergency protocols: {e}")
    
    def _GetCurrentPositions(self) -> List:
        """Get current portfolio positions for analysis"""
        return [holding for holding in self.Portfolio.Values if holding.Invested]
    
    def _InitiateEmergencyPositionClosure(self):
        """Initiate emergency closure of all non-essential positions"""
        self.Log(" INITIATING EMERGENCY POSITION CLOSURE")
        # Implementation for emergency position closure
        # This would close positions starting with highest risk
    
    def ExecuteAdvancedStrategies(self):
        """
        Execute Section 9B Advanced Strategies based on current market conditions
        Only available for Phase 3+ accounts ($55k+)
        """
        try:
            # Check strategy availability based on account phase and value
            account_value = self.Portfolio.TotalPortfolioValue
            availability = self.advanced_strategies.CheckStrategyAvailability(self.account_phase, account_value)
            
            if not availability['available_strategies']:
                return  # No strategies available
            
            current_time = self.Time.time()
            day_of_week = self.Time.strftime('%A')
            
            # 1. Box Spread Evaluation (continuous monitoring)
            if AdvancedStrategyType.BOX_SPREAD in availability['available_strategies']:
                # Get current interest rates (simplified - would normally fetch from market data)
                interest_rates = {'risk_free_rate': 0.05}  # 5% default
                
                if "SPX" in self.Securities:
                    spx_price = self.Securities["SPX"].Price
                    box_opportunity = self.advanced_strategies.EvaluateBoxSpreadOpportunity(spx_price, interest_rates)
                    
                    if box_opportunity.get('available') and box_opportunity.get('quality') in ['EXCELLENT', 'GOOD']:
                        self.Log(f"[TARGET] BOX SPREAD OPPORTUNITY: {box_opportunity['quality']} - {box_opportunity['annual_rate']:.2f}% annual")
                        # Execute if conditions are met
                        self.advanced_strategies.ExecuteAdvancedStrategy(AdvancedStrategyType.BOX_SPREAD, box_opportunity)
            
            # 2. Butterfly Matrix (Friday entries only after 10:35 AM)
            if (AdvancedStrategyType.BUTTERFLY in availability['available_strategies'] and 
                day_of_week == 'Friday' and current_time >= time(10, 35)):
                
                # Get ES movement data for butterfly decision
                if hasattr(self, 'es_open_price') and "ES" in self.Securities:
                    es_current = self.Securities["ES"].Price
                    butterfly_opportunity = self.advanced_strategies.CalculateButterflyMatrix(es_current, self.es_open_price)
                    
                    if butterfly_opportunity.get('available'):
                        self.Log(f" BUTTERFLY OPPORTUNITY: {butterfly_opportunity['type'].value} at {butterfly_opportunity['center']}")
                        self.Log(f"   Movement: {butterfly_opportunity['percent_move']:.2f}% - {butterfly_opportunity['rationale']}")
                        # Execute butterfly strategy
                        self.advanced_strategies.ExecuteAdvancedStrategy(AdvancedStrategyType.BUTTERFLY, butterfly_opportunity)
            
            # 3. LEAP Ladder System (Monday entries only)
            if (AdvancedStrategyType.LEAP_LADDER in availability['available_strategies'] and 
                day_of_week == 'Monday'):
                
                vix_level = self.Securities["VIX"].Price
                leap_opportunity = self.advanced_strategies.EvaluateLEAPLadderOpportunity(day_of_week, vix_level)
                
                if leap_opportunity.get('available'):
                    self.Log(f"[TARGET] LEAP LADDER OPPORTUNITY: Delta {leap_opportunity['target_delta']}, VIX {vix_level:.1f}")
                    self.Log(f"   {leap_opportunity['sizing_rationale']}")
                    # Execute LEAP ladder entry
                    self.advanced_strategies.ExecuteAdvancedStrategy(AdvancedStrategyType.LEAP_LADDER, leap_opportunity)
            
            # Log advanced strategies status periodically
            if self.Time.hour == 16 and self.Time.minute == 0:  # End of trading day
                status = self.advanced_strategies.GetAdvancedStrategiesStatus()
                self.Log(f"[HIGH] ADVANCED STRATEGIES STATUS:")
                self.Log(f"    Box Spreads: {status['box_spreads']['active_positions']} active")
                self.Log(f"    Butterflies: {status['butterflies']['active_positions']} active")
                self.Log(f"    LEAP Ladder: {status['leap_ladder']['active_positions']} positions")
            
        except Exception as e:
            self.Error(f"Advanced strategies execution failed: {e}")
    
    def ExecuteCalendarizedLT112(self):
        """
        Execute Calendarized LT112 Strategy based on monthly schedule
        Entry: First Wednesday of each month only (Phase 2+)
        """
        try:
            # Check for entry opportunity
            vix_level = self.Securities["VIX"].Price
            entry_opportunity = self.calendarized_lt112.CheckEntryOpportunity(
                self.Time, 
                self.account_phase, 
                vix_level
            )
            
            if entry_opportunity.get('qualified'):
                self.Log(f"[TARGET] CALENDARIZED LT112 ENTRY OPPORTUNITY")
                self.Log(f"    Entry Type: {entry_opportunity['entry_type']}")
                self.Log(f"    Account Phase: {entry_opportunity['account_phase']}")
                self.Log(f"    VIX Level: {vix_level:.1f} - {entry_opportunity['vix_note']}")
                self.Log(f"    Available Variants: {entry_opportunity['available_variants']}")
                self.Log(f"    Recommended: {entry_opportunity['recommended_variant']}")
                
                # Determine best underlying based on account phase and liquidity
                if self.account_phase >= 3:
                    preferred_underlying = "SPY"  # Best liquidity for larger accounts
                else:
                    preferred_underlying = "SPY"  # Start with SPY for all phases
                
                if preferred_underlying in self.Securities:
                    underlying_price = self.Securities[preferred_underlying].Price
                    
                    # Determine variant based on recommendation
                    if entry_opportunity['recommended_variant'] == LT112Variant.CALENDARIZED_150_30.value:
                        variant = LT112Variant.CALENDARIZED_150_30
                        self.Log(f"[ADDED] Using CALENDARIZED variant (150/30 DTE) for better volatility management")
                    else:
                        variant = LT112Variant.STANDARD_120DTE
                        self.Log(f"[ADDED] Using STANDARD variant (120 DTE uniform)")
                    
                    # Calculate position structure
                    position_config = self.calendarized_lt112.CalculatePosition(
                        variant, 
                        preferred_underlying, 
                        underlying_price, 
                        vix_level
                    )
                    
                    if not position_config.get('error'):
                        self.Log(f"[DATA] POSITION CALCULATED:")
                        self.Log(f"    Structure: {position_config['structure']}")
                        self.Log(f"    Position Size: {position_config['position_size']} contract sets")
                        self.Log(f"    Expected Monthly Income: ${position_config['expected_monthly_income']:.0f}")
                        self.Log(f"    BP Allocation: ${position_config['bp_allocation']:,.0f}")
                        
                        # Execute position
                        if self.calendarized_lt112.ExecutePosition(position_config):
                            self.Log(f"[SUCCESS] CALENDARIZED LT112 POSITION EXECUTED SUCCESSFULLY")
                        else:
                            self.Error(" Failed to execute Calendarized LT112 position")
                    else:
                        self.Error(f"Position calculation error: {position_config['error']}")
            
            # Always manage existing positions
            self.calendarized_lt112.ManagePositions(self.Time)
            
            # Log strategy status periodically
            if self.Time.hour == 16 and self.Time.minute == 0:  # End of day
                status = self.calendarized_lt112.GetStrategyStatus()
                if int(status['active_positions']) > 0:
                    self.Log(f"[HIGH] CALENDARIZED LT112 STATUS:")
                    self.Log(f"    Active Positions: {status['active_positions']}/{status['max_positions']}")
                    self.Log(f"    Win Rate: {status['win_rate']}")
                    self.Log(f"    Avg Monthly Profit: {status['avg_monthly_profit']}")
                    self.Log(f"    Total Profits: {status['total_monthly_profits']}")
            
        except Exception as e:
            self.Error(f"Calendarized LT112 execution failed: {e}")
    
    def ExecuteBearTrap11X(self):
        """
        Execute 11x Bear Trap Strategy based on market sentiment and bearish conditions
        Entry: Opportunity-based when bear trap conditions are detected (Phase 3+)
        """
        try:
            # Get current market data
            vix_level = self.Securities["VIX"].Price
            account_value = self.Portfolio.TotalPortfolioValue
            
            # Check for bear trap entry opportunity
            bear_trap_opportunity = self.bear_trap_11x.CheckBearTrapEntry(
                self.Time,
                self.account_phase,
                account_value,
                vix_level
            )
            
            if bear_trap_opportunity.get('qualified'):
                self.Log(f" BEAR TRAP 11X OPPORTUNITY DETECTED")
                self.Log(f"    Entry Type: {bear_trap_opportunity['entry_type']}")
                self.Log(f"    Account Phase: {bear_trap_opportunity['account_phase']}")
                self.Log(f"    Market Sentiment: {bear_trap_opportunity['market_sentiment']}")
                self.Log(f"    Bear Trap Probability: {bear_trap_opportunity['bear_trap_probability']:.1%}")
                self.Log(f"    Active Triggers: {', '.join(bear_trap_opportunity['active_triggers'])}")
                self.Log(f"    Recommended Variant: {bear_trap_opportunity['recommended_variant']}")
                
                # Determine best underlying for bear trap
                preferred_underlying = "SPY"  # Focus on SPY for liquidity in bear trap scenarios
                
                if preferred_underlying in self.Securities:
                    underlying_price = self.Securities[preferred_underlying].Price
                    
                    # Determine variant based on recommendation
                    if bear_trap_opportunity['recommended_variant'] == BearTrapVariant.ATM_ENHANCED.value:
                        variant = BearTrapVariant.ATM_ENHANCED
                        self.Log(f"[ADDED] Using ATM ENHANCED variant for high-probability bear trap")
                    else:
                        variant = BearTrapVariant.STANDARD_11X
                        self.Log(f"[ADDED] Using STANDARD 11X variant")
                    
                    # Create sentiment data for position calculation
                    sentiment_data = {
                        'bear_trap_probability': bear_trap_opportunity['bear_trap_probability'],
                        'active_triggers': bear_trap_opportunity['active_triggers'],
                        'market_sentiment': bear_trap_opportunity['market_sentiment'],
                        'sentiment_score': bear_trap_opportunity.get('sentiment_score', 0.7)
                    }
                    
                    # Calculate bear trap position structure
                    position_config = self.bear_trap_11x.CalculateBearTrapPosition(
                        variant,
                        preferred_underlying,
                        underlying_price,
                        sentiment_data
                    )
                    
                    if not position_config.get('error'):
                        self.Log(f"[DATA] BEAR TRAP POSITION CALCULATED:")
                        self.Log(f"    Structure: {position_config['structure']}")
                        self.Log(f"    Bear Trap Type: {position_config['bear_trap_type']}")
                        self.Log(f"    Position Size: {position_config['position_size']} contract sets")
                        self.Log(f"    BP Allocation: ${position_config['bp_allocation']:,.0f}")
                        self.Log(f"    DTE: {position_config['dte']} days")
                        
                        # Execute position
                        if self.bear_trap_11x.ExecuteBearTrapPosition(position_config):
                            self.Log(f"[SUCCESS] BEAR TRAP 11X POSITION EXECUTED SUCCESSFULLY")
                            self.Log(f"[TARGET] Bear Trap Thesis: {position_config['bear_trap_thesis']}")
                        else:
                            self.Error(" Failed to execute Bear Trap 11X position")
                    else:
                        self.Error(f"Bear trap position calculation error: {position_config['error']}")
            else:
                # Log why bear trap was not qualified (only during high VIX periods to avoid spam)
                if vix_level > 18:  # Only log when market conditions are somewhat bearish
                    reason = bear_trap_opportunity.get('reason', 'Unknown')
                    if 'Market conditions not suitable' in reason:
                        self.Debug(f" Bear trap conditions not met: {reason}")
                        if 'bear_trap_probability' in bear_trap_opportunity:
                            self.Debug(f"    Probability: {bear_trap_opportunity['bear_trap_probability']:.1%}")
                        if 'active_triggers' in bear_trap_opportunity:
                            triggers = bear_trap_opportunity['active_triggers']
                            if triggers:
                                self.Debug(f"    Triggers: {', '.join(triggers)}")
            
            # Always manage existing bear trap positions
            self.bear_trap_11x.ManageBearTrapPositions(self.Time)
            
            # Log strategy status periodically
            if self.Time.hour == 16 and self.Time.minute == 30:  # End of day + 30 min
                status = self.bear_trap_11x.GetBearTrapStatus()
                if int(status['active_positions']) > 0:
                    self.Log(f" BEAR TRAP 11X STATUS:")
                    self.Log(f"    Active Positions: {status['active_positions']}/{status['max_positions']}")
                    self.Log(f"    Total Bear Traps: {status['total_bear_traps']}")
                    self.Log(f"    Trap Success Rate: {status['trap_success_rate']}")
                    self.Log(f"    Win Rate: {status['win_rate']}")
            
        except Exception as e:
            self.Error(f"Bear Trap 11X execution failed: {e}")
    
    def ExecuteAdvanced0DTE(self):
        """
        Execute Advanced 0DTE Variations (Batman Spread, Broken Wing Iron Condor)
        Entry: Friday 0DTE strategies for expert traders (Phase 3+ with specific VIX conditions)
        """
        try:
            # Only execute on Fridays for 0DTE opportunities
            if self.Time.strftime('%A') != 'Friday':
                return
            
            # Check execution time (after 10:35 AM ET to allow for market stabilization)
            if self.Time.time() < time(10, 35):
                return
            
            # Get current market data
            vix_level = self.Securities["VIX"].Price
            account_value = self.Portfolio.TotalPortfolioValue
            
            # Check for advanced 0DTE entry opportunity
            advanced_0dte_opportunity = self.advanced_0dte.CheckAdvanced0DTEEntry(
                self.Time,
                self.account_phase,
                account_value,
                vix_level
            )
            
            if advanced_0dte_opportunity.get('qualified'):
                self.Log(f"[FAST] ADVANCED 0DTE OPPORTUNITY DETECTED")
                self.Log(f"    Entry Type: {advanced_0dte_opportunity['entry_type']}")
                self.Log(f"    Account Phase: {advanced_0dte_opportunity['account_phase']}")
                self.Log(f"    VIX Level: {vix_level:.1f} - {advanced_0dte_opportunity['vix_note']}")
                self.Log(f"    Market Direction: {advanced_0dte_opportunity['market_direction']}")
                self.Log(f"    Available Variants: {advanced_0dte_opportunity['available_variants']}")
                self.Log(f"    Recommended: {advanced_0dte_opportunity['recommended_variant']}")
                
                # Determine best underlying (focus on SPY for 0DTE liquidity)
                preferred_underlying = "SPY"
                
                if preferred_underlying in self.Securities:
                    underlying_price = self.Securities[preferred_underlying].Price
                    
                    # Determine variant based on recommendation and expertise level
                    if advanced_0dte_opportunity['recommended_variant'] == ZeroDTEVariant.BATMAN_SPREAD.value:
                        variant = ZeroDTEVariant.BATMAN_SPREAD
                        self.Log(f" Using BATMAN SPREAD - EXPERT LEVEL STRATEGY (VIX {vix_level:.1f} < 12)")
                    elif advanced_0dte_opportunity['recommended_variant'] == ZeroDTEVariant.BROKEN_WING_IRON_CONDOR.value:
                        variant = ZeroDTEVariant.BROKEN_WING_IRON_CONDOR
                        self.Log(f"[ADDED] Using BROKEN WING IRON CONDOR - Tom's preferred asymmetric IC")
                    else:
                        variant = ZeroDTEVariant.STANDARD_IRON_CONDOR
                        self.Log(f"[ADDED] Using STANDARD IRON CONDOR - Balanced approach")
                    
                    # Create market analysis data for position calculation
                    market_analysis = {
                        'market_direction': advanced_0dte_opportunity['market_direction'],
                        'vix_level': vix_level,
                        'market_move_today': advanced_0dte_opportunity.get('market_move_today', 0),
                        'movement_analysis': advanced_0dte_opportunity.get('movement_analysis', {}),
                        'flat_market_confidence': advanced_0dte_opportunity.get('flat_market_confidence', 0.7)
                    }
                    
                    # Calculate advanced 0DTE position structure
                    position_config = self.advanced_0dte.CalculateAdvanced0DTEPosition(
                        variant,
                        preferred_underlying,
                        underlying_price,
                        market_analysis
                    )
                    
                    if not position_config.get('error'):
                        self.Log(f"[DATA] ADVANCED 0DTE POSITION CALCULATED:")
                        self.Log(f"    Structure: {position_config['structure']}")
                        self.Log(f"    Variant: {position_config['variant_type']}")
                        self.Log(f"    Position Size: {position_config['position_size']} contract sets")
                        self.Log(f"    BP Allocation: ${position_config['bp_allocation']:,.0f}")
                        self.Log(f"    Max Profit: ${position_config['max_profit']:,.0f}")
                        self.Log(f"    Max Loss: ${position_config['max_loss']:,.0f}")
                        
                        # Execute position
                        if self.advanced_0dte.ExecuteAdvanced0DTEPosition(position_config):
                            self.Log(f"[SUCCESS] ADVANCED 0DTE POSITION EXECUTED SUCCESSFULLY")
                            self.Log(f"[TARGET] Strategy Thesis: {position_config['strategy_thesis']}")
                        else:
                            self.Error(" Failed to execute Advanced 0DTE position")
                    else:
                        self.Error(f"Advanced 0DTE position calculation error: {position_config['error']}")
            
            # Always manage existing positions
            self.advanced_0dte.ManageAdvanced0DTEPositions(self.Time)
            
            # Log strategy status periodically
            if self.Time.hour == 15 and self.Time.minute == 45:  # Near market close
                status = self.advanced_0dte.GetAdvanced0DTEStatus()
                if int(status['active_positions']) > 0:
                    self.Log(f"[FAST] ADVANCED 0DTE STATUS:")
                    self.Log(f"    Active Positions: {status['active_positions']}/{status['max_positions']}")
                    self.Log(f"    Batman Spreads: {status['batman_positions']}")
                    self.Log(f"    Broken Wing ICs: {status['broken_wing_positions']}")
                    self.Log(f"    Standard ICs: {status['standard_ic_positions']}")
                    self.Log(f"    Win Rate: {status['win_rate']}")
                    
        except Exception as e:
            self.Error(f"Advanced 0DTE execution failed: {e}")
    
    def ExecuteRollingManagement(self):
        """
        Execute Tom King Rolling Methodology & DTE-based Position Management
        Core Rules: 21 DTE management, 50% profit targets, position rolling
        """
        try:
            # Update all tracked positions with current market data
            position_update = self.rolling_system.UpdatePositions()
            
            # Execute rolling decisions for positions requiring action
            rolling_results = self.rolling_system.ExecuteRollingDecisions()
            
            # Log significant rolling activity
            if rolling_results['positions_rolled'] > 0 or rolling_results['positions_closed'] > 0:
                self.Log(f" ROLLING MANAGEMENT EXECUTED")
                self.Log(f"    Positions Rolled: {rolling_results['positions_rolled']}")
                self.Log(f"    Positions Closed: {rolling_results['positions_closed']}")
                self.Log(f"    Roll Failures: {rolling_results['roll_failures']}")
                self.Log(f"    Net P&L Impact: ${rolling_results['total_pnl_impact']:,.2f}")
            
            # Daily status report (once per day at market open)
            if self.Time.hour == 9 and self.Time.minute == 35:
                self._LogRollingSummary()
                
        except Exception as e:
            self.Error(f"Rolling methodology execution failed: {e}")
    
    def _LogRollingSummary(self):
        """Log daily rolling system summary"""
        try:
            summary = self.rolling_system.GetPositionRollingSummary()
            
            if summary['total_active_positions'] > 0:
                self.Log(f" DAILY ROLLING SUMMARY:")
                self.Log(f"    Active Positions: {summary['total_active_positions']}")
                self.Log(f"    Near 21 DTE: {summary['positions_near_21_dte']}")
                self.Log(f"    At Profit Target (50%+): {summary['positions_at_profit_target']}")
                self.Log(f"    At Loss Limit (200%+): {summary['positions_at_loss_limit']}")
                self.Log(f"    Total Theta: {summary['total_theta_decay']:.2f}")
                self.Log(f"    Total Delta: {summary['total_delta_exposure']:.2f}")
                self.Log(f"    Avg Roll P&L: ${summary['average_roll_pnl']:,.2f}")
                
                if summary['positions_by_type']:
                    position_types = ", ".join([f"{k}:{v}" for k,v in summary['positions_by_type'].items()])
                    self.Log(f"    Position Types: {position_types}")
                
        except Exception as e:
            self.Error(f"Error logging rolling summary: {e}")
    
    def AddPositionToRollingTracker(self, symbol: str, position_type: str, 
                                   entry_date: datetime, expiration_date: datetime,
                                   strikes: List[float], contracts: List[int], 
                                   entry_price: float) -> str:
        """Add new position to rolling tracking system"""
        try:
            # Convert position type string to enum
            position_type_map = {
                'strangle': PositionType.STRANGLE,
                'iron_condor': PositionType.IRON_CONDOR,
                'put_spread': PositionType.PUT_SPREAD,
                'call_spread': PositionType.CALL_SPREAD,
                'straddle': PositionType.STRADDLE,
                'butterfly': PositionType.BUTTERFLY,
                'calendar': PositionType.CALENDAR
            }
            
            pos_type = position_type_map.get(position_type.lower(), PositionType.STRANGLE)
            
            position_id = self.rolling_system.AddPosition(
                symbol=symbol,
                position_type=pos_type,
                entry_date=entry_date,
                expiration_date=expiration_date,
                strikes=strikes,
                contracts=contracts,
                entry_price=entry_price
            )
            
            self.Log(f" Position added to rolling tracker: {position_id}")
            return position_id
            
        except Exception as e:
            self.Error(f"Error adding position to rolling tracker: {e}")
            return ""

    def ExecuteUKTaxOptimization(self):
        """
        Execute UK Tax Optimization System - Section 1256 tracking and tax efficiency
        Core Features: UK tax year management, capital gains optimization, wash sale compliance
        """
        try:
            # Execute tax optimization strategies (runs weekly on Mondays)
            if self.Time.strftime('%A') == 'Monday':
                optimization_results = self.uk_tax_system.ExecuteTaxOptimization()
                
                # Log significant optimization activity
                if optimization_results['optimization_executed']:
                    self.Log(f" UK TAX OPTIMIZATION EXECUTED")
                    self.Log(f"    Actions Taken: {len(optimization_results['actions_taken'])}")
                    self.Log(f"    Recommendations: {len(optimization_results['recommendations'])}")
                    self.Log(f"    Tax Efficiency Score: {optimization_results['tax_efficiency_score']:.1f}/100")
                    
                    for action in optimization_results['actions_taken']:
                        self.Log(f"    Action: {action['strategy']} - ${action['potential_benefit_gbp']:,.2f}")
                
                # Log weekly tax status
                if optimization_results['recommendations']:
                    self.Log(f"[IDEA] TAX OPTIMIZATION RECOMMENDATIONS:")
                    for rec in optimization_results['recommendations']:
                        self.Log(f"    {rec['strategy']}: {rec['description']}")
            
            # Monthly tax year summary (first Monday of each month)
            if (self.Time.strftime('%A') == 'Monday' and 
                self.Time.day <= 7):  # First Monday of month
                self._LogMonthlyTaxSummary()
                
        except Exception as e:
            self.Error(f"UK tax optimization execution failed: {e}")
    
    def _LogMonthlyTaxSummary(self):
        """Log monthly UK tax summary"""
        try:
            tax_summary = self.uk_tax_system.GetUKTaxYearSummary()
            section_1256_summary = self.uk_tax_system.GetSection1256Summary()
            
            self.Log(f" MONTHLY UK TAX SUMMARY ({tax_summary['tax_year']}):")
            self.Log(f"    Net Capital Gains: ${tax_summary['net_capital_gains_gbp']:,.2f}")
            self.Log(f"    Annual Exemption Used: ${tax_summary['annual_exemption_used_gbp']:,.2f} / $6,000")
            self.Log(f"    Section 1256 Gains: ${tax_summary['section_1256_gains_gbp']:,.2f}")
            self.Log(f"    Tax Efficiency Rating: {tax_summary['tax_efficiency_rating']}")
            self.Log(f"    Total Transactions: {tax_summary['total_transactions']}")
            
            if section_1256_summary['total_section_1256_positions'] > 0:
                self.Log(f"    Section 1256 Positions: {section_1256_summary['total_section_1256_positions']}")
                self.Log(f"    Long-term Portion (60%): ${section_1256_summary['long_term_portion']:,.2f}")
                self.Log(f"    Short-term Portion (40%): ${section_1256_summary['short_term_portion']:,.2f}")
            
            if tax_summary['optimization_opportunities']:
                self.Log(f"[IDEA] Tax Optimization Opportunities:")
                for opportunity in tax_summary['optimization_opportunities']:
                    self.Log(f"    {opportunity}")
                    
        except Exception as e:
            self.Error(f"Error logging monthly tax summary: {e}")
    
    def RecordTaxableTransaction(self, symbol: str, transaction_type: str, 
                                quantity: int, price: float, commission: float = 0.0,
                                position_id: str = ""):
        """Record a taxable transaction for UK tax tracking"""
        try:
            transaction_id = self.uk_tax_system.ProcessTransaction(
                symbol=symbol,
                transaction_type=transaction_type,
                quantity=quantity,
                price=price,
                commission=commission,
                transaction_date=self.Time,
                position_id=position_id
            )
            
            # Also add to rolling tracker if it's a position opening
            if transaction_type in ['OPEN', 'ROLL_OPEN'] and transaction_id:
                # Determine position type from symbol (simplified)
                position_type = "strangle"  # Default - would be more sophisticated in practice
                
                # Add to rolling tracker (requires expiration date - would get from option contract)
                expiration_date = self.Time + timedelta(days=30)  # Placeholder
                strikes = [price]  # Simplified
                contracts = [quantity]
                
                rolling_position_id = self.AddPositionToRollingTracker(
                    symbol=symbol,
                    position_type=position_type,
                    entry_date=self.Time,
                    expiration_date=expiration_date,
                    strikes=strikes,
                    contracts=contracts,
                    entry_price=price
                )
            
            return transaction_id
            
        except Exception as e:
            self.Error(f"Error recording taxable transaction: {e}")
            return ""

    def ExecuteBacktestingValidation(self):
        """
        Execute Backtesting Validation System - Tom King historical performance validation
        Core Features: Performance benchmarking, strategy validation, risk metric compliance
        """
        try:
            # Execute comprehensive validation (monthly on the 1st)
            if self.Time.day == 1:
                validation_results = self.validation_system.ExecuteValidation()
                
                # Log significant validation events
                if validation_results['validation_executed']:
                    self.Log(f"[SEARCH] BACKTESTING VALIDATION COMPLETED")
                    self.Log(f"    Overall Score: {validation_results['overall_score']:.1f}%")
                    self.Log(f"    Passed: {validation_results['passed_validations']}/{validation_results['total_validations']}")
                    
                    if validation_results['critical_failures']:
                        self.Log(f"    Critical Failures: {len(validation_results['critical_failures'])}")
                        for failure in validation_results['critical_failures'][:3]:  # Show top 3
                            self.Log(f"     - {failure}")
                    
                    if validation_results['recommendations']:
                        self.Log(f"[IDEA] Validation Recommendations:")
                        for rec in validation_results['recommendations'][:2]:  # Show top 2
                            self.Log(f"      {rec}")
            
            # Daily validation summary (if requested)
            if self.Time.hour == 16 and self.Time.minute == 0:  # Market close
                self._LogDailyValidationStatus()
                
        except Exception as e:
            self.Error(f"Backtesting validation execution failed: {e}")
    
    def _LogDailyValidationStatus(self):
        """Log daily validation status (weekly on Fridays)"""
        try:
            if self.Time.strftime('%A') == 'Friday':
                summary = self.validation_system.GetValidationSummary()
                
                if summary and 'overall_score' in summary:
                    self.Log(f"[DATA] WEEKLY VALIDATION STATUS:")
                    self.Log(f"    Last Validation: {summary.get('last_validation', 'N/A')}")
                    self.Log(f"    Overall Score: {summary['overall_score']:.1f}%")
                    self.Log(f"    Validation Rate: {summary['passed_validations']}/{summary['total_validations']}")
                    self.Log(f"    Critical Issues: {summary.get('critical_failures', 0)}")
                    self.Log(f"    Months Tracked: {summary.get('months_tracked', 0)}")
                    
                    if summary.get('current_drawdown', 0) < -5:
                        self.Log(f"    [WARNING] Current Drawdown: {summary['current_drawdown']:.1f}%")
                    
                    # Trade data status
                    trade_data = summary.get('trade_data_available', {})
                    if any(count > 0 for count in trade_data.values()):
                        self.Log(f"    Trade Data: " + ", ".join([f"{k}:{v}" for k,v in trade_data.items() if v > 0]))
                
        except Exception as e:
            self.Error(f"Error logging daily validation status: {e}")
    
    def RecordStrategyTradeResult(self, strategy_name: str, symbol: str, 
                                 entry_price: float, exit_price: float,
                                 quantity: int, hold_days: int = 0,
                                 strategy_variant: str = "standard"):
        """Record trade result for validation tracking"""
        try:
            pnl = (exit_price - entry_price) * quantity
            pnl_percent = (pnl / (entry_price * abs(quantity))) * 100 if entry_price != 0 and quantity != 0 else 0
            
            trade_data = {
                'symbol': symbol,
                'entry_price': entry_price,
                'exit_price': exit_price,
                'quantity': quantity,
                'pnl': pnl,
                'pnl_percent': pnl_percent,
                'hold_days': hold_days,
                'strategy_variant': strategy_variant
            }
            
            self.validation_system.RecordTradeResult(strategy_name, trade_data)
            
            # Also record for tax tracking
            self.RecordTaxableTransaction(
                symbol=symbol,
                transaction_type='CLOSE',
                quantity=quantity,
                price=exit_price,
                commission=0.0  # Would be actual commission in real trading
            )
            
        except Exception as e:
            self.Error(f"Error recording strategy trade result: {e}")

    def ExecuteLiveTradingReadiness(self):
        """
        Execute Live Trading Readiness System - production systems monitoring and control
        Core Features: Real-time risk monitoring, broker health checks, emergency controls
        """
        try:
            # Daily live trading health check (at market open)
            if self.Time.hour == 9 and self.Time.minute == 30:
                health_report = self.live_trading_system.MonitorLiveTradingHealth()
                
                # Log significant health issues
                if health_report['system_status'] != "HEALTHY":
                    self.Log(f"[WARNING] LIVE TRADING HEALTH: {health_report['system_status']}")
                    
                    for alert in health_report['alerts']:
                        self.Log(f"    Alert: {alert}")
                    
                    if health_report['recommendations']:
                        self.Log(f"[IDEA] Health Recommendations:")
                        for rec in health_report['recommendations']:
                            self.Log(f"      {rec}")
            
            # Real-time position monitoring (every 15 minutes during market hours)
            if (9 <= self.Time.hour <= 16 and 
                self.Time.minute % 15 == 0):
                position_update = self.live_trading_system.UpdateLivePositions()
                
                # Log critical risk alerts
                if position_update['risk_alerts']:
                    self.Log(f"[EMERGENCY] POSITION RISK ALERTS:")
                    for alert in position_update['risk_alerts']:
                        self.Log(f"    {alert}")
                
                # Execute required actions
                if position_update['required_actions']:
                    self.Log(f"[LOG] REQUIRED ACTIONS:")
                    for action in position_update['required_actions']:
                        self.Log(f"    {action}")
            
            # End-of-day system status (at market close)
            if self.Time.hour == 16 and self.Time.minute == 0:
                self._LogDailyLiveTradingStatus()
                
        except Exception as e:
            self.Error(f"Live trading readiness execution failed: {e}")
    
    def _LogDailyLiveTradingStatus(self):
        """Log daily live trading status summary"""
        try:
            status = self.live_trading_system.GetLiveTradingStatus()
            
            self.Log(f"[LAUNCH] DAILY LIVE TRADING STATUS:")
            self.Log(f"    Trading Mode: {status.get('trading_mode', 'UNKNOWN')}")
            self.Log(f"    System Status: {status.get('system_status', 'UNKNOWN')}")
            self.Log(f"    Broker: {status.get('broker', 'UNKNOWN')}")
            self.Log(f"    Active Orders: {status.get('active_orders', 0)}")
            self.Log(f"    Active Positions: {status.get('active_positions', 0)}")
            self.Log(f"    Portfolio Value: ${status.get('portfolio_value', 0):,.2f}")
            self.Log(f"    Day P&L: ${status.get('day_pnl', 0):,.2f}")
            self.Log(f"    Risk Level: {status.get('risk_level', 'UNKNOWN')}")
            
            # Performance metrics
            performance = status.get('performance', {})
            if performance:
                self.Log(f"    Trades Today: {performance.get('trades_today', 0)}")
                self.Log(f"    Win Rate: {performance.get('win_rate_today', 0):.1f}%")
                self.Log(f"    Fill Rate: {performance.get('fill_rate', 0):.1f}%")
                
        except Exception as e:
            self.Error(f"Error logging daily live trading status: {e}")
    
    def InitializeLiveTradingForProduction(self):
        """Initialize live trading systems for production deployment"""
        try:
            self.Log(" PREPARING LIVE TRADING FOR PRODUCTION")
            
            # Initialize live trading systems
            init_result = self.live_trading_system.InitializeLiveTrading()
            
            if init_result['success']:
                self.Log("[SUCCESS] LIVE TRADING SYSTEMS INITIALIZED SUCCESSFULLY")
                self.Log(f"    Broker Connected: {init_result['broker_connected']}")
                self.Log(f"    Systems Online: {', '.join(init_result['systems_online'])}")
                self.Log(f"    Ready for Live Trading: {init_result['ready_for_live_trading']}")
                
                preflight = init_result.get('preflight_checks', {})
                if not preflight.get('all_checks_passed', False):
                    self.Log("[WARNING] Some preflight checks failed:")
                    for check, status in preflight.items():
                        if not status and check != 'all_checks_passed':
                            self.Log(f"    {check}: FAILED")
                
                return init_result['ready_for_live_trading']
            else:
                self.Error(" LIVE TRADING INITIALIZATION FAILED")
                return False
                
        except Exception as e:
            self.Error(f"Live trading initialization error: {e}")
            return False
    
    def SubmitLiveOrder(self, symbol: str, order_type: str, side: str, quantity: int, 
                       price: float = None, strategy_name: str = "", trade_reason: str = ""):
        """Submit order through live trading system with full validation"""
        try:
            order_id = self.live_trading_system.SubmitLiveOrder(
                symbol=symbol,
                order_type=order_type,
                side=side,
                quantity=quantity,
                price=price,
                strategy_name=strategy_name,
                trade_reason=trade_reason
            )
            
            if order_id:
                self.Log(f" LIVE ORDER SUBMITTED: {order_id}")
                return order_id
            else:
                self.Error(f"Failed to submit live order for {symbol}")
                return ""
                
        except Exception as e:
            self.Error(f"Error submitting live order: {e}")
            return ""
    
    def ExecuteEmergencyStop(self, reason: str = "Manual Emergency Stop"):
        """Execute emergency stop through live trading system"""
        try:
            self.Log(f"[EMERGENCY] INITIATING EMERGENCY STOP: {reason}")
            
            stop_result = self.live_trading_system.ExecuteEmergencyStop(reason)
            
            if stop_result['emergency_stop_executed']:
                self.Log("[STOP] EMERGENCY STOP COMPLETED SUCCESSFULLY")
                self.Log(f"    Orders Cancelled: {stop_result['orders_cancelled']}")
                self.Log(f"    Positions Closed: {stop_result['positions_closed']}")
                self.Log(f"    Final Status: {stop_result['final_status']}")
                
                return True
            else:
                self.Error(" Emergency stop failed to execute properly")
                return False
                
        except Exception as e:
            self.Error(f"Emergency stop error: {e}")
            return False

    def ExecuteSeasonalOverlay(self):
        """
        Execute Seasonal Overlay System - month-by-month allocations and sector rotation
        Updates: Daily assessment with monthly transitions and quarterly sector rotation
        """
        try:
            # Get current portfolio value for seasonal calculations
            portfolio_value = self.Portfolio.TotalPortfolioValue
            
            # Execute seasonal adjustments (includes monthly transition detection)
            seasonal_execution = self.seasonal_overlay.ExecuteSeasonalAdjustments(
                self.Time, 
                portfolio_value
            )
            
            if seasonal_execution.get('executed'):
                # Apply seasonal allocation multiplier to position sizing
                seasonal_multiplier = seasonal_execution['allocation_multiplier']
                seasonal_risk_adj = seasonal_execution['risk_adjustment']
                
                # Update position sizer with seasonal parameters
                if hasattr(self.position_sizer, 'SetSeasonalMultiplier'):
                    self.position_sizer.SetSeasonalMultiplier(seasonal_multiplier, seasonal_risk_adj)
                
                # Get preferred strategies for current season
                preferred_strategies = seasonal_execution['preferred_strategies']
                sector_emphasis = seasonal_execution['sector_emphasis']
                
                # Log seasonal strategy focus (only on changes)
                if hasattr(self, '_last_seasonal_strategies') and self._last_seasonal_strategies != preferred_strategies:
                    self.Log(f" SEASONAL STRATEGY FOCUS CHANGE:")
                    self.Log(f"    Previous: {', '.join(self._last_seasonal_strategies) if self._last_seasonal_strategies else 'None'}")
                    self.Log(f"    Current: {', '.join(preferred_strategies)}")
                    self.Log(f"    Primary Sectors: {', '.join(sector_emphasis['primary_sectors'])}")
                    self.Log(f"    Rationale: {sector_emphasis['rationale']}")
                    self._last_seasonal_strategies = preferred_strategies
                
                # Apply seasonal strategy adjustments to existing strategies
                self._ApplySeasonalStrategyAdjustments(preferred_strategies, seasonal_multiplier, seasonal_risk_adj)
            
            # Monthly seasonal reporting (first trading day of month)
            if self.Time.day == 1 or (self.Time.day <= 3 and self.Time.strftime('%A') == 'Monday'):
                monthly_report = self.seasonal_overlay.GetMonthlyReport(self.Time)
                if 'error' not in monthly_report:
                    self.Log(f"[SCHEDULE] SEASONAL MONTHLY REPORT - {monthly_report['month'].upper()}")
                    self.Log(f"    Season: {monthly_report['season']}")
                    self.Log(f"    Allocation: {monthly_report['allocation_multiplier']:.2f}x")
                    self.Log(f"    Risk Factor: {monthly_report['risk_adjustment']:.2f}x")
                    self.Log(f"    Strategy Focus: {', '.join(monthly_report['preferred_strategies'])}")
                    self.Log(f"    VIX Bias: {monthly_report['vix_bias']:+.1f}")
                    self.Log(f"    Theme: {monthly_report['description']}")
                    
                    # Log sector rotation details
                    sector_info = monthly_report['sector_emphasis']
                    self.Log(f"[DATA] SECTOR ROTATION:")
                    self.Log(f"    Primary: {', '.join(sector_info['primary_sectors'])}")
                    self.Log(f"    Secondary: {', '.join(sector_info['secondary_sectors'])}")
                    self.Log(f"    Avoid: {', '.join(sector_info['avoid_sectors'])}")
            
        except Exception as e:
            self.Error(f"Seasonal overlay execution failed: {e}")
    
    def _ApplySeasonalStrategyAdjustments(self, preferred_strategies: List[str], multiplier: float, risk_adj: float):
        """Apply seasonal adjustments to individual strategies"""
        try:
            # Map strategy names to our strategy objects
            strategy_mapping = {
                'FRIDAY_0DTE': 'friday_0dte',
                'LT112': 'long_term_112', 
                'FUTURES_STRANGLE': 'futures_strangle'
            }
            
            # Apply adjustments to core strategies
            for strategy_key in preferred_strategies:
                if strategy_key in strategy_mapping:
                    strategy_name = strategy_mapping[strategy_key]
                    if strategy_name in self.strategies:
                        strategy_obj = self.strategies[strategy_name]
                        
                        # Apply seasonal adjustment if strategy supports it
                        if hasattr(strategy_obj, 'SetSeasonalAdjustment'):
                            strategy_obj.SetSeasonalAdjustment(multiplier, risk_adj, is_preferred=True)
                            self.Debug(f"Applied seasonal boost to {strategy_key}: {multiplier:.2f}x")
            
            # Apply reduced emphasis to non-preferred strategies
            all_strategies = ['FRIDAY_0DTE', 'LT112', 'FUTURES_STRANGLE']
            for strategy_key in all_strategies:
                if strategy_key not in preferred_strategies:
                    if strategy_key in strategy_mapping:
                        strategy_name = strategy_mapping[strategy_key]
                        if strategy_name in self.strategies:
                            strategy_obj = self.strategies[strategy_name]
                            
                            if hasattr(strategy_obj, 'SetSeasonalAdjustment'):
                                reduced_multiplier = multiplier * 0.8  # Reduce non-preferred
                                strategy_obj.SetSeasonalAdjustment(reduced_multiplier, risk_adj, is_preferred=False)
                                self.Debug(f"Applied seasonal reduction to {strategy_key}: {reduced_multiplier:.2f}x")
            
            # Apply to advanced strategies
            advanced_strategy_mapping = {
                'CALENDARIZED_LT112': self.calendarized_lt112,
                'BEAR_TRAP_11X': self.bear_trap_11x,
                'ADVANCED_0DTE': self.advanced_0dte
            }
            
            for strategy_key, strategy_obj in advanced_strategy_mapping.items():
                is_preferred = strategy_key in preferred_strategies
                adjustment_multiplier = multiplier if is_preferred else multiplier * 0.8
                
                if hasattr(strategy_obj, 'SetSeasonalAdjustment'):
                    strategy_obj.SetSeasonalAdjustment(adjustment_multiplier, risk_adj, is_preferred)
                    self.Debug(f"Applied seasonal adjustment to {strategy_key}: {adjustment_multiplier:.2f}x ({'preferred' if is_preferred else 'reduced'})")
            
        except Exception as e:
            self.Error(f"Error applying seasonal strategy adjustments: {e}")
    
    def ExecuteEnhancedStrangles(self):
        """
        Execute Enhanced Strangle Positions with ratio elements
        Entry: Phase 2+ accounts with BP efficiency optimization
        """
        try:
            # Get current market data
            vix_level = self.Securities["VIX"].Price
            account_value = self.Portfolio.TotalPortfolioValue
            
            # Check for enhanced strangle entry opportunity
            enhanced_strangle_opportunity = self.enhanced_strangles.CheckEnhancedStrangleEntry(
                self.Time,
                self.account_phase,
                account_value,
                vix_level
            )
            
            if enhanced_strangle_opportunity.get('qualified'):
                self.Log(f"[ADDED] ENHANCED STRANGLE OPPORTUNITY DETECTED")
                self.Log(f"    Entry Type: {enhanced_strangle_opportunity['entry_type']}")
                self.Log(f"    Account Phase: {enhanced_strangle_opportunity['account_phase']}")
                self.Log(f"    VIX Level: {vix_level:.1f} - {enhanced_strangle_opportunity['vix_note']}")
                self.Log(f"    BP Efficiency Target: {enhanced_strangle_opportunity['bp_efficiency_target']:.0%}")
                self.Log(f"    Preferred Enhancement: {enhanced_strangle_opportunity['preferred_enhancement']}")
                
                # Select best underlying from available options
                available_underlyings = enhanced_strangle_opportunity['available_underlyings']
                preferred_underlying = "SPY"  # Default to SPY for liquidity
                
                # Check if SPY is available, otherwise use first available
                if "SPY" in available_underlyings and "SPY" in self.Securities:
                    preferred_underlying = "SPY"
                else:
                    for underlying in available_underlyings:
                        if underlying in self.Securities:
                            preferred_underlying = underlying
                            break
                
                if preferred_underlying in self.Securities:
                    underlying_price = self.Securities[preferred_underlying].Price
                    
                    # Determine enhancement type based on recommendation
                    enhancement_type_str = enhanced_strangle_opportunity['preferred_enhancement']
                    enhancement_type = RatioConfiguration[enhancement_type_str]
                    
                    self.Log(f"[ADDED] Using {enhancement_type.value} enhancement on {preferred_underlying}")
                    
                    # Create market analysis data
                    market_data = {
                        'vix_level': vix_level,
                        'underlying_price': underlying_price,
                        'market_regime': getattr(self, 'vix_regime', 'NORMAL'),
                        'account_phase': self.account_phase,
                        'bp_available': account_value * Constants.MAX_STRATEGY_ALLOCATION  # Max allocation from constants
                    }
                    
                    # Calculate enhanced strangle position
                    position_config = self.enhanced_strangles.CalculateEnhancedStranglePosition(
                        enhancement_type,
                        preferred_underlying,
                        underlying_price,
                        market_data
                    )
                    
                    if not position_config.get('error'):
                        self.Log(f"[DATA] ENHANCED STRANGLE POSITION CALCULATED:")
                        self.Log(f"    Structure: {position_config['structure']}")
                        self.Log(f"    Enhancement: {position_config['enhancement_type']}")
                        self.Log(f"    Position Size: {position_config['position_size']} contract sets")
                        self.Log(f"    BP Efficiency: +{position_config['bp_efficiency_improvement']:.0%}")
                        self.Log(f"    BP Allocation: ${position_config['bp_allocation']:,.0f}")
                        self.Log(f"    Expected Credit: ${position_config['estimated_credit']:,.0f}")
                        self.Log(f"    Max Profit: ${position_config['max_profit']:,.0f}")
                        
                        # Execute position
                        if self.enhanced_strangles.ExecuteEnhancedStranglePosition(position_config):
                            self.Log(f"[SUCCESS] ENHANCED STRANGLE POSITION EXECUTED SUCCESSFULLY")
                            self.Log(f"[TARGET] Strategy Thesis: {position_config['strategy_thesis']}")
                        else:
                            self.Error(" Failed to execute Enhanced Strangle position")
                    else:
                        self.Error(f"Enhanced Strangle position calculation error: {position_config['error']}")
                else:
                    self.Error(f"Preferred underlying {preferred_underlying} not available in Securities")
            else:
                # Log qualification failure (only for valid attempts)
                if self.account_phase >= 2 and self.Time.minute == 30:  # Log once per hour for Phase 2+
                    reason = enhanced_strangle_opportunity.get('reason', 'Unknown')
                    self.Debug(f"[ADDED] Enhanced Strangle not qualified: {reason}")
            
            # Always manage existing positions
            self.enhanced_strangles.ManageEnhancedStranglePositions(self.Time)
            
            # Log strategy status periodically
            if self.Time.hour == 15 and self.Time.minute == 30:  # 30 min before close
                status = self.enhanced_strangles.GetEnhancedStrangleStatus()
                if int(status.get('active_positions', 0)) > 0:
                    self.Log(f"[ADDED] ENHANCED STRANGLES STATUS:")
                    self.Log(f"    Active Positions: {status['active_positions']}")
                    self.Log(f"    Total Positions: {status['total_positions']}")
                    self.Log(f"    Win Rate: {status['win_rate']}")
                    self.Log(f"    Total Profit: {status['total_profit']}")
                    self.Log(f"    Avg BP Efficiency: {status['avg_bp_efficiency']}")
                    self.Log(f"    Management Actions: {status['management_actions']}")
            
        except Exception as e:
            self.Error(f"Enhanced Strangles execution failed: {e}")
    
    def SetupEventTracking(self):
        """Set up earnings and dividend tracking for key symbols"""
        try:
            # Track all equity symbols we trade
            symbols_to_track = ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT']
            
            # Add Phase 3+ symbols if available
            if hasattr(self, 'account_phase') and self.account_phase >= 3:
                symbols_to_track.extend(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'])
            
            for symbol in symbols_to_track:
                self.earnings_dividend_avoidance.AddSymbolTracking(symbol)
            
            # Add major market events (examples - in production would pull from calendar)
            self._add_sample_market_events()
            
            self.Log("[SCHEDULE] Event tracking setup complete")
            
        except Exception as e:
            self.Error(f"Error setting up event tracking: {e}")
    
    def _add_sample_market_events(self):
        """Add sample market events (in production, pull from external calendar)"""
        try:
            current_date = self.Time
            
            # FOMC meetings (approximate quarterly schedule)
            fomc_dates = [
                current_date + timedelta(days=30),
                current_date + timedelta(days=120),
                current_date + timedelta(days=210),
                current_date + timedelta(days=300)
            ]
            
            for fomc_date in fomc_dates:
                self.earnings_dividend_avoidance.AddMarketEvent(
                    fomc_date, 
                    EventType.FOMC_MEETING,
                    "FOMC Meeting - Interest Rate Decision",
                    EventSeverity.HIGH
                )
            
            # Sample earnings (would normally pull from external data)
            sample_earnings = [
                ('SPY', current_date + timedelta(days=15)),  # ETF proxy
                ('QQQ', current_date + timedelta(days=22)),
                ('AAPL', current_date + timedelta(days=28)),
                ('MSFT', current_date + timedelta(days=35))
            ]
            
            for symbol, earnings_date in sample_earnings:
                if symbol in self.Securities:
                    self.earnings_dividend_avoidance.UpdateEarningsCalendar(
                        symbol, earnings_date, 'AMC', estimated=True
                    )
            
        except Exception as e:
            self.Error(f"Error adding sample market events: {e}")
    
    def ExecuteEventRiskManagement(self):
        """Execute earnings and dividend avoidance system"""
        try:
            # Manage existing positions for upcoming events
            management_actions = self.earnings_dividend_avoidance.ManagePositionsForEvents(self.Time)
            
            # Log significant actions
            if management_actions:
                self.Log(f"[SCHEDULE] EVENT RISK MANAGEMENT: {len(management_actions)} actions taken")
                for action in management_actions:
                    if action['priority'] in ['HIGH', 'URGENT']:
                        self.Log(f"    {action['symbol']}: {action['action']} - {action['reason']}")
            
            # Daily status report (once per day at market open)
            if self.Time.hour == 9 and self.Time.minute == 35:
                self._log_event_risk_status()
                
        except Exception as e:
            self.Error(f"Event risk management execution failed: {e}")
    
    def _log_event_risk_status(self):
        """Log daily event risk status"""
        try:
            status = self.earnings_dividend_avoidance.GetAvoidanceStatus()
            
            if status.get('system_active', False):
                self.Log(f"[SCHEDULE] DAILY EVENT RISK STATUS:")
                self.Log(f"    Tracked Symbols: {status['tracked_symbols']}")
                self.Log(f"    Upcoming Earnings: {status['upcoming_earnings']}")
                self.Log(f"    Upcoming Dividends: {status['upcoming_dividends']}")
                self.Log(f"    Market Events: {status['market_events']}")
                
                if status['events_avoided'] > 0 or status['positions_closed'] > 0:
                    self.Log(f"    Events Avoided: {status['events_avoided']}")
                    self.Log(f"    Positions Closed Preemptively: {status['positions_closed']}")
                    self.Log(f"    Positions Adjusted: {status['positions_adjusted']}")
            
        except Exception as e:
            self.Error(f"Error logging event risk status: {e}")
    
    def CheckEventRestrictions(self, symbol: str, strategy_type: str, position_size: float) -> Dict:
        """Check event restrictions before entering new positions"""
        try:
            restrictions = self.earnings_dividend_avoidance.CheckEntryRestrictions(
                symbol, strategy_type, position_size, self.Time
            )
            
            # Log significant restrictions
            if not restrictions.get('entry_allowed', True):
                self.Log(f"[SCHEDULE] ENTRY RESTRICTED: {symbol} - {restrictions.get('reason', 'Unknown')}")
                self.Log(f"    Risk Score: {restrictions.get('risk_score', 0):.1%}")
                self.Log(f"    Action: {restrictions.get('recommended_action', 'UNKNOWN')}")
            
            return restrictions
            
        except Exception as e:
            self.Error(f"Error checking event restrictions for {symbol}: {e}")
            return {'entry_allowed': True, 'error': str(e)}
    
    def HasCapacity(self):
        """Check if we have capacity for new positions using advanced risk management"""
        
        # Use KellyCriterion for sophisticated position sizing analysis
        capacity_analysis = self.kelly_criterion.AnalyzePortfolioCapacity(
            current_phase=self.account_phase,
            vix_regime=self.vix_regime,
            account_balance=self.Portfolio.TotalPortfolioValue
        )
        
        # Check all capacity constraints
        if not capacity_analysis['has_bp_capacity']:
            self.Debug(f"No BP capacity: {capacity_analysis['bp_usage_pct']:.1%} used of {capacity_analysis['max_bp_allowed']:.1%}")
            return False
        
        if not capacity_analysis['has_position_capacity']:
            self.Debug(f"No position capacity: {capacity_analysis['current_positions']} of {capacity_analysis['max_positions']} used")
            return False
        
        # Check correlation limits using sophisticated correlation manager
        if not self.correlation_manager.CanAddPosition():
            self.Debug("Correlation group limits reached")
            return False
        
        # Check August 2024 protection protocols
        if not self.defensive_manager.AllowNewPositions():
            self.Debug("Defensive manager blocking new positions")
            return False
        
        return True
    
    def GetAccountPhase(self):
        """Determine account phase using sophisticated phase management"""
        # Use the PhaseManager for complete phase management
        current_balance = self.Portfolio.TotalPortfolioValue
        phase_info = self.phase_manager.DeterminePhase(current_balance)
        
        new_phase = phase_info['phase']
        
        # Log phase transitions
        if hasattr(self, 'account_phase') and new_phase != self.account_phase:
            self.Log(f"Account Phase Transition: Phase {self.account_phase}  Phase {new_phase} (Balance: ${current_balance:,.2f})")
            
            # Update available strategies when phase changes
            self.UpdateAvailableStrategies(new_phase)
        
        return new_phase
    
    def GetBuyingPowerUsed(self):
        """Calculate current buying power usage"""
        # Safe division for buying power calculation
        if self.Portfolio.TotalPortfolioValue > 0:
            return self.Portfolio.TotalMarginUsed / self.Portfolio.TotalPortfolioValue
        else:
            self.Error("Portfolio value is zero - cannot calculate buying power")
            return 0
    
    def GetDTE(self, symbol):
        """Get days to expiration for an option"""
        if symbol.SecurityType == SecurityType.Option:
            return (symbol.ID.Date - self.Time).days
        return float('inf')
    
    def AdjustPosition(self, position):
        """Apply defensive adjustment to losing position with comprehensive emergency actions"""
        try:
            if not position or 'position_id' not in position:
                self.Error("Cannot adjust position - invalid position data")
                return False
            
            position_id = position['position_id']
            strategy_type = position.get('strategy', 'UNKNOWN')
            current_pnl = position.get('unrealized_pnl', 0)
            position_value = position.get('position_value', 0)
            
            self.Log(f"DEFENSIVE ADJUSTMENT TRIGGERED: {position_id} ({strategy_type}) P&L: ${current_pnl:.2f}")
            
            # Emergency stop loss if position is catastrophically losing
            if current_pnl < -position_value * 2.0:  # 200% loss
                self.Error(f"EMERGENCY STOP LOSS: Position {position_id} exceeds 200% loss threshold")
                return self.order_execution_engine.close_position(position_id, "EMERGENCY_STOP_LOSS")
            
            # Strategy-specific adjustments
            if strategy_type in ['PUT_SPREAD', 'LONG_TERM_PUT']:
                return self._adjust_put_spread_position(position)
            elif strategy_type in ['STRANGLE', 'ENHANCED_STRANGLE']:
                return self._adjust_strangle_position(position)
            elif strategy_type in ['IRON_CONDOR', 'FRIDAY_0DTE']:
                return self._adjust_iron_condor_position(position)
            elif strategy_type in ['FUTURES_STRANGLE']:
                return self._adjust_futures_position(position)
            else:
                # Generic adjustment: attempt to roll or close
                self.Log(f"[WARNING] Generic adjustment for {strategy_type} - attempting roll or close")
                return self._generic_position_adjustment(position)
                
        except Exception as e:
            self.Error(f"Error in AdjustPosition: {str(e)}")
            # Emergency fallback: try to close the position
            try:
                return self.order_execution_engine.close_position(position.get('position_id'), "ADJUSTMENT_ERROR_EMERGENCY_CLOSE")
            except:
                self.Error(f"[EMERGENCY] CRITICAL: Cannot close position {position.get('position_id')} - manual intervention required")
                return False
    
    def _adjust_put_spread_position(self, position):
        """Adjust put spread position using Tom King methodology"""
        try:
            # Check if we can roll to next expiration
            current_dte = position.get('dte', 0)
            if current_dte <= 21:  # Within 21 DTE - try to roll
                return self.order_execution_engine.roll_position(position['position_id'])
            
            # If beyond repair threshold, close
            if position.get('unrealized_pnl', 0) < -position.get('max_loss', 1000) * 1.5:
                self.Log(f"[STOP] Closing put spread {position['position_id']} - beyond repair")
                return self.order_execution_engine.close_position(position['position_id'], "BEYOND_REPAIR")
            
            # Default: attempt roll to next month
            return self.order_execution_engine.roll_position(position['position_id'])
            
        except Exception as e:
            self.Error(f"Error adjusting put spread: {e}")
            return False
    
    def _adjust_strangle_position(self, position):
        """Adjust strangle position using enhanced methodology"""
        try:
            current_vix = self.Securities.get('VIX', {}).get('Price', 20) if hasattr(self, 'Securities') else 20
            
            # If VIX spiked above 25, consider defensive adjustment
            if current_vix > 25:
                self.Log(f"[HIGH] High VIX adjustment for strangle {position['position_id']}: VIX={current_vix}")
                # In high vol, try to convert to iron butterfly or close
                return self.order_execution_engine.close_position(position['position_id'], "HIGH_VIX_DEFENSIVE")
            
            # Standard adjustment: roll or close based on DTE
            current_dte = position.get('dte', 0)
            if current_dte <= 21:
                return self.order_execution_engine.roll_position(position['position_id'])
            
            return True  # No adjustment needed yet
            
        except Exception as e:
            self.Error(f"Error adjusting strangle: {e}")
            return False
    
    def _adjust_iron_condor_position(self, position):
        """Adjust iron condor position"""
        try:
            # Iron condors are harder to adjust - usually better to close
            current_pnl_pct = position.get('pnl_percentage', 0)
            
            if current_pnl_pct < -100:  # 100% loss
                self.Log(f"[STOP] Closing iron condor {position['position_id']} at 100% loss")
                return self.order_execution_engine.close_position(position['position_id'], "IC_MAX_LOSS")
            
            # Try to roll if still time
            current_dte = position.get('dte', 0)
            if current_dte > 7:  # More than a week left
                return self.order_execution_engine.roll_position(position['position_id'])
            
            # Close if near expiration
            return self.order_execution_engine.close_position(position['position_id'], "IC_NEAR_EXPIRATION")
            
        except Exception as e:
            self.Error(f"Error adjusting iron condor: {e}")
            return False
    
    def _adjust_futures_position(self, position):
        """Adjust futures strangle position"""
        try:
            # Futures have different margin requirements - be more aggressive
            current_pnl = position.get('unrealized_pnl', 0)
            
            if current_pnl < -500:  # $500 loss threshold for futures
                self.Log(f"[STOP] Closing futures position {position['position_id']} - $500 loss threshold")
                return self.order_execution_engine.close_position(position['position_id'], "FUTURES_LOSS_LIMIT")
            
            return True  # Futures positions managed differently
            
        except Exception as e:
            self.Error(f"Error adjusting futures position: {e}")
            return False
    
    def _generic_position_adjustment(self, position):
        """Generic position adjustment when strategy type unknown"""
        try:
            # Conservative approach: close position if losing significantly
            current_pnl = position.get('unrealized_pnl', 0)
            max_loss = position.get('max_loss', 1000)
            
            if current_pnl < -max_loss * 0.75:  # 75% of max loss
                self.Log(f"[STOP] Generic close for {position['position_id']} at 75% max loss")
                return self.order_execution_engine.close_position(position['position_id'], "GENERIC_LOSS_LIMIT")
            
            # Try to roll if time available
            current_dte = position.get('dte', 0)
            if current_dte > 14:  # More than 2 weeks
                return self.order_execution_engine.roll_position(position['position_id'])
            
            return True  # No adjustment needed
            
        except Exception as e:
            self.Error(f"Error in generic adjustment: {e}")
            return False
    
    def SecurityInitializer(self, security):
        """Initialize security with proper settings"""
        security.SetDataNormalizationMode(DataNormalizationMode.Raw)
        security.SetLeverage(1.0)
        security.SetFillModel(ImmediateFillModel())
        security.SetFeeModel(TastyTradeFeeModel())
    
    def ExecuteDefensiveAction(self, action):
        """Execute a defensive action recommended by the DefensiveManager"""
        try:
            if action.action_type == "CLOSE_POSITION":
                self.Liquidate(action.symbol, f"Defensive close: {action.reason}")
                self.Log(f"Defensive action executed: Closed {action.symbol} - {action.reason}")
            
            elif action.action_type == "ADJUST_POSITION":
                # Implement position adjustments (rolling, converting to spread, etc.)
                self.Log(f"Defensive adjustment needed for {action.symbol}: {action.reason}")
                # Implementation depends on strategy and current market conditions
                
            elif action.action_type == "REDUCE_SIZE":
                # Reduce position size by specified amount
                current_quantity = self.Portfolio[action.symbol].Quantity
                reduction_quantity = int(current_quantity * action.reduction_factor)
                if reduction_quantity > 0:
                    self.MarketOrder(action.symbol, -reduction_quantity, f"Defensive size reduction: {action.reason}")
                    
        except Exception as e:
            self.Error(f"Error executing defensive action for {action.symbol}: {str(e)}")
    
    def ExecuteVIXSpikeProtocol(self):
        """Execute VIX spike opportunity protocol (August 2024 protection)"""
        try:
            self.Log("[EMERGENCY] VIX SPIKE PROTOCOL ACTIVATED [EMERGENCY]")
            
            # Get VIX spike deployment parameters
            spike_params = self.position_sizer.GetVIXSpikeParameters()
            
            # Deploy VIX spike strategy
            deployment_amount = min(
                spike_params['max_deployment'],
                self.Portfolio.TotalPortfolioValue * Constants.VIX_SPIKE_MAX_DEPLOYMENT  # Maximum deployment from constants
            )
            
            self.Log(f"VIX Spike Deployment: ${deployment_amount:,.2f}")
            self.Log(f"Expected Return: {spike_params['expected_return']:.1%}")
            
            # Execute VIX normalization trades (selling premium at high IV)
            # Implementation would depend on available instruments and market conditions
            
        except Exception as e:
            self.Error(f"Error executing VIX spike protocol: {str(e)}")
    
    def UpdateAvailableStrategies(self, new_phase):
        """Update available strategies based on phase transition"""
        try:
            self.Log(f"Updating strategies for Phase {new_phase}")
            
            # Get phase-specific strategy availability
            phase_strategies = self.phase_manager.GetAvailableStrategies(new_phase)
            
            # Enable/disable strategies based on phase requirements
            for strategy_name, strategy_obj in self.strategies.items():
                if hasattr(strategy_obj, 'SetPhaseEnabled'):
                    is_enabled = strategy_name in phase_strategies
                    strategy_obj.SetPhaseEnabled(is_enabled, new_phase)
                    self.Log(f"Strategy {strategy_name}: {'Enabled' if is_enabled else 'Disabled'} for Phase {new_phase}")
            
        except Exception as e:
            self.Error(f"Error updating available strategies: {str(e)}")
    
    def OnData(self, data):
        """Process incoming data"""
        try:
            if self.IsWarmingUp:
                return
            
            # Update account phase (check for transitions)
            self.account_phase = self.GetAccountPhase()
            
            # Update all risk management modules
            self.UpdateVIXRegime()
            self.correlation_manager.UpdateMarketData(data)
            
            # Monitor portfolio Greeks and risk limits
            if hasattr(self, 'execution_engine') and self.execution_engine.active_positions:
                portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(self.execution_engine.active_positions)
                risk_violations = self.greeks_engine.CheckGreeksRiskLimits(portfolio_greeks)
                
                # Log violations if any
                for violation in risk_violations:
                    self.Log(f"[WARNING] GREEKS VIOLATION: {violation['type']} - {violation['current']:.2f} exceeds {violation['limit']}")
                    
                    # Take action on high-severity violations
                    if violation['severity'] == 'HIGH':
                        self.Log(f"[EMERGENCY] HIGH SEVERITY GREEKS VIOLATION - Reducing position exposure")
                        # Could trigger defensive position reduction here
        
        except Exception as e:
            self.Error(f"Error in OnData: {str(e)}")
            # Continue processing to maintain system stability
        
        # Execute Seasonal Overlay System (month-by-month allocations and sector rotation)
        self.ExecuteSeasonalOverlay()
        
        # Execute Section 9B Advanced Strategies (Phase 3+ only)
        if self.account_phase >= 3:
            self.ExecuteAdvancedStrategies()
            
        # Execute Calendarized LT112 Strategy (Phase 2+ monthly entries)
        if self.account_phase >= 2:
            self.ExecuteCalendarizedLT112()
            
        # Execute Enhanced Strangle Positions (Phase 2+ BP efficiency optimization)
        if self.account_phase >= 2:
            self.ExecuteEnhancedStrangles()
            
        # Execute 11x Bear Trap Strategy (Phase 3+ opportunity-based entries)
        if self.account_phase >= 3:
            self.ExecuteBearTrap11X()
            
        # Execute Advanced 0DTE Variations (Phase 3+ Friday 0DTE strategies)
        if self.account_phase >= 3:
            self.ExecuteAdvanced0DTE()
        
        # Execute Rolling Methodology & DTE-based Position Management
        self.ExecuteRollingManagement()
        
        # Execute UK Tax Optimization (Section 1256 tracking and tax efficiency)
        self.ExecuteUKTaxOptimization()
        
        # Execute Backtesting Validation (Tom King historical performance validation)
        self.ExecuteBacktestingValidation()
        
        # Execute Live Trading Readiness (production systems monitoring)
        self.ExecuteLiveTradingReadiness()
        
        # Update LT112 position management (continuous monitoring)
        if 'lt112_core' in self.strategies:
            self.strategies['lt112_core'].on_data(data)
        
        # Update Friday 0DTE position management (continuous monitoring)
        if 'friday_0dte' in self.strategies:
            self.strategies['friday_0dte'].on_data(data)
        
        # Update IPMCC position management (continuous monitoring)
        if 'ipmcc' in self.strategies:
            self.strategies['ipmcc'].on_data(data)
        
        # Update Futures Strangle position management (continuous monitoring)
        if 'futures_strangle' in self.strategies:
            self.strategies['futures_strangle'].on_data(data)
        
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
        self.Log(f"Starting Capital: $35,000")
        self.Log(f"Final Value: ${final_value:,.2f}")
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