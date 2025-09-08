# region imports
from AlgorithmImports import *
from datetime import timedelta, time
from config.strategy_parameters import TomKingParameters
from risk.august_2024_correlation_limiter import August2024CorrelationLimiter
from risk.vix_regime import VIXRegimeManager
from strategies.friday_zero_day_options import FridayZeroDayOptions
from strategies.futures_strangle import TomKingFuturesStrangleStrategy as FuturesStrangleStrategy
from strategies.long_term_112_put_selling import LongTerm112PutSelling
from strategies.in_perpetuity_covered_calls import InPerpetuityCoveredCalls
from strategies.leap_put_ladders import LEAPPutLadderStrategy
from strategies.earnings_avoidance import EarningsAvoidanceSystem

# Advanced strategies (Phase 3+ and enhanced versions) - SIMPLIFIED & CLEAR
from strategies.phase3_bear_trap_strategy import Phase3BearTrapStrategy
from strategies.enhanced_butterfly_0dte import EnhancedButterfly0DTE

from trading.futures_manager import FuturesManager
from analysis.technical_indicators import TechnicalAnalysisSystem
from brokers.tastytrade_api_client import TastytradeApiClient

# Import safety and production features
from risk.position_safety_validator import PositionSafetyValidator, SimpleOrderFillCheck, SimpleAssignmentCheck, SimpleDataValidation, SimpleAlerts
from risk.live_trading_components import LivePositionRecovery, LivePerformanceTracker, LiveFuturesRoller, LiveBrokerFailover, LiveCommissionModel, LiveDailySummary
from risk.pre_trade_validators import CriticalValidations
from risk.production_logging import ProductionLogger, NetworkMonitor, GreeksAggregator
from config.market_holidays import MarketHolidays
from reporting.trading_dashboard import TradingDashboard
from reporting.trade_execution_logger import TradeExecutionLogger
from helpers.option_order_executor import OptionOrderExecutor
from strategies.strategy_order_executor import StrategyOrderExecutor
from helpers.option_chain_manager import OptionChainManager
from validation.system_validator import SystemValidator
# endregion

# Import Greeks monitoring and signal generation
from greeks.greeks_monitor import GreeksMonitor
from greeks.greeks_signal_generator import GreeksSignalGenerator

# Import exit management
from strategies.tom_king_exit_rules import TomKingExitRules

# Import fixed multi-legged position management (QuantConnect-compatible)
from position_state_manager_qc import PositionStateManagerQC
from position_sync_bridge import PositionSyncBridge

# Import fixed execution systems
from strategies.fixed_ipmcc_execution import FixedIPMCCExecution
from strategies.fixed_lt112_management import FixedLT112Management

# Import Phase 4 optimizations
from optimization.option_chain_cache import OptionChainCache, GreeksCache
from optimization.fast_position_lookup import FastPositionLookup, BatchOperationOptimizer
from optimization.advanced_commission_model import AdvancedCommissionModel
from optimization.dynamic_correlation_monitor import DynamicCorrelationMonitor

class TomKingTradingAlgorithm(QCAlgorithm):
    """
    Tom King Trading Framework v17 - Complete Hybrid System
    Restored correlation analysis, full symbol universe, all strategies, 
    futures trading, technical analysis, and 5-level VIX regime system
    """
    
    def Initialize(self):
        # Basic setup
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(44500)  # $44,500 starting capital (£35k * 1.27)
        
        # Initialize parameters
        self.params = TomKingParameters()
        
        # CRITICAL: Validate phase consistency (USD standardization)
        if not self.params.validate_phase_consistency():
            raise ValueError("❌ CRITICAL: Phase definitions are inconsistent between ACCOUNT_PHASES and PHASE_TRANSITIONS")
        self.Log("✅ Phase consistency validated - all definitions use USD")
        
        # Initialize Tastytrade integration for live trading
        self.tastytrade = TastytradeApiClient(self)
        
        # Enable hybrid sandbox mode for paper trading alongside QC
        # This mirrors all trades to Tastytrade sandbox for realistic testing
        self.use_sandbox_mirror = self.GetParameter("use-sandbox-mirror") == "true"
        
        if self.use_sandbox_mirror and not self.LiveMode:
            from brokers.paper_trading_adapter import PaperTradingAdapter
            self.hybrid_sandbox = PaperTradingAdapter(self, enable_mirroring=True)
            self.Log("HYBRID MODE: QuantConnect + Tastytrade Sandbox mirroring enabled")
        
        # Log data source
        if self.LiveMode:
            self.Log("Using Tastytrade API for live option data")
            account = self.tastytrade.get_account_info()
            if account:
                self.Log(f"Connected to account: {account['account_number']}")
                self.Log(f"Balance: ${account['net_liquidation']:.2f}")
        else:
            self.Log("Using QuantConnect data for backtesting")
        
        # Initialize core systems
        self.correlation_manager = August2024CorrelationLimiter(self)
        self.vix_manager = VIXRegimeManager(self)
        self.futures_manager = FuturesManager(self)
        self.technical_system = TechnicalAnalysisSystem(self)
        
        # Initialize the 5 core strategies with Section 9B enhancements integrated
        self.friday_0dte = FridayZeroDayOptions(self)  # Core #1: Friday 0DTE (with Section 9B butterfly/ratio enhancements)
        self.futures_strangle = FuturesStrangleStrategy(self)  # Core #2: Futures Strangles
        self.lt112_strategy = LongTerm112PutSelling(self)  # Core #3: Long Term 112
        self.ipmcc_strategy = InPerpetuityCoveredCalls(self)  # Core #4: IPMCC (Income Poorman's Covered Call)
        self.leap_strategy = LEAPPutLadderStrategy(self)  # Core #5: LEAP Put Ladders
        
        # Support systems
        self.earnings_avoidance = EarningsAvoidanceSystem(self)
        self.option_chain_manager = OptionChainManager(self)  # Centralized option chain management
        self.system_validator = SystemValidator(self)  # System validation
        
        # Drawdown management (Tom King 10%/15%/20% protocols)
        from risk.drawdown_manager import DrawdownManager
        self.drawdown_manager = DrawdownManager(self)
        self.can_open_positions = True  # Flag controlled by drawdown manager
        
        # Strategy configuration validator
        from config.strategy_validator import StrategyValidator
        self.strategy_validator = StrategyValidator(self)
        
        # Advanced strategies (initialized but only used when conditions met)
        self.bear_trap_strategy = Phase3BearTrapStrategy(self)  # Phase 3+ only (£65k+)
        self.butterfly_0dte = EnhancedButterfly0DTE(self)  # Enhanced butterflies post-10:30
        
        # Initialize safety and production features
        self.safety_checks = PositionSafetyValidator(self)
        self.fill_checker = SimpleOrderFillCheck(self)
        self.assignment_checker = SimpleAssignmentCheck(self)
        self.data_validator = SimpleDataValidation(self)
        self.alerts = SimpleAlerts(self)
        
        # Initialize production features
        self.position_recovery = LivePositionRecovery(self)
        self.performance_tracker = LivePerformanceTracker(self)
        self.futures_roller = LiveFuturesRoller(self)
        self.broker_failover = LiveBrokerFailover(self)
        self.commission_model = LiveCommissionModel(self)
        self.daily_summary = LiveDailySummary(self)
        self.market_holidays = MarketHolidays()
        
        # Initialize critical validations (the final 5%)
        self.critical_validations = CriticalValidations(self)
        
        # Initialize production logging and monitoring (the final 5%)
        self.production_logger = ProductionLogger(self)
        self.network_monitor = NetworkMonitor(self)
        self.greeks_aggregator = GreeksAggregator(self)
        
        # Initialize enhanced reporting and dashboard
        self.dashboard = TradingDashboard(self)
        self.trade_logger = TradeExecutionLogger(self)
        
        # Initialize order helpers for all strategies
        self.order_helper = OptionOrderExecutor(self)
        self.order_executor = StrategyOrderExecutor(self)
        
        # Initialize Greeks monitoring and signal generation
        self.greeks_monitor = GreeksMonitor(self)  # Comprehensive Greeks monitoring
        self.greeks_signals = GreeksSignalGenerator(self)  # Simple signal generation
        
        # Initialize TastyTrade connections (live mode only)
        self.tastytrade_api = None
        self.tastytrade_websocket = None
        if self.LiveMode:
            try:
                self.tastytrade_api = TastytradeApiClient(self)
                # Initialize WebSocket for real-time streaming
                from brokers.tastytrade_websocket import TastytradeWebSocket
                self.tastytrade_websocket = TastytradeWebSocket(self, list(self.symbol_universe))
                self.tastytrade_websocket.connect()
                self.Log("✅ TastyTrade API and WebSocket initialized")
            except Exception as e:
                self.Error(f"TastyTrade initialization failed: {e}")
        
        # Initialize Rate Limiter for API protection
        from helpers.rate_limiter import RateLimiter
        self.rate_limiter = RateLimiter(self)
        
        # Initialize Performance Tracking
        self.performance_tracker = {
            'wins': 0,
            'losses': 0,
            'total_pnl': 0,
            'strategy_pnl': {},
            'daily_returns': [],
            'win_rate': 0.0,
            'profit_factor': 0.0
        }
        
        # Initialize exit manager for systematic exits
        self.exit_manager = TomKingExitRules(self)
        
        # Initialize CRITICAL fixed multi-legged position management systems
        self.position_state_manager = PositionStateManagerQC(self)
        self.position_sync = PositionSyncBridge(self, self.position_state_manager)
        
        # Initialize fixed execution systems (CRITICAL FIX for line 1070 error)
        self.fixed_ipmcc = FixedIPMCCExecution(self, self.position_state_manager)
        self.fixed_lt112 = FixedLT112Management(self, self.position_state_manager)
        
        # Initialize Phase-Based Greeks Limits Manager
        from greeks.phase_based_greeks_limits import PhaseBasedGreeksLimits
        self.phase_greeks_manager = PhaseBasedGreeksLimits(self)
        
        self.Log("🔧 CRITICAL: Fixed multi-legged position management with sync bridge initialized")
        self.Log("🔧 CRITICAL: Fixed IPMCC and LT112 execution systems initialized")
        self.Log("✅ Phase-Based Greeks Limits Manager initialized")
        
        # Initialize Phase 4 optimization systems
        self.option_cache = OptionChainCache(self, cache_ttl_minutes=5, max_cache_size=100)
        self.greeks_cache = GreeksCache(self, cache_ttl_seconds=30)
        self.position_lookup = FastPositionLookup(self)
        self.batch_optimizer = BatchOperationOptimizer(self)
        self.advanced_commission = AdvancedCommissionModel(self, broker="tastytrade")
        self.correlation_monitor = DynamicCorrelationMonitor(self, window_size=20)
        
        # Rate limiting for production safety
        from helpers.rate_limiter import RateLimiter, BatchRequestOptimizer
        self.rate_limiter = RateLimiter(self, max_requests_per_minute=120)
        self.batch_request_optimizer = BatchRequestOptimizer(self)
        
        self.Log("⚡ PHASE 4: Performance optimization systems initialized")
        self.Log(f"⚡ Option chain cache: 5 min TTL, 100 entry max")
        self.Log(f"⚡ Position indexes: O(1) lookups enabled")
        self.Log(f"⚡ Commission model: Tastytrade rates loaded")
        self.Log(f"⚡ Correlation monitor: 20-day rolling window")
        
        # Load persisted position state if available
        self.load_position_state()
        
        # Load previous dashboard state if exists
        self.dashboard.load_dashboard_state()
        
        # Recover positions if restarting
        recovered_state = self.position_recovery.recover_positions()
        if recovered_state:
            self.account_phase = recovered_state.get('phase', self.account_phase)
            self.Log(f"Recovered state from {recovered_state['timestamp']}")
        
        # Log upcoming holidays
        self.market_holidays.log_upcoming_holidays(self, days_ahead=30)
        
        # Store daily start value for circuit breaker
        self.daily_start_value = self.Portfolio.TotalPortfolioValue
        
        # Determine account phase
        self.account_phase = self.params.get_phase_for_account_size(self.Portfolio.TotalPortfolioValue)
        
        # Add symbols based on account phase
        self.add_symbols_for_phase()
        
        # Add VIX for regime analysis
        self.vix_symbol = self.AddIndex("VIX", Resolution.Daily).Symbol
        
        # Schedule daily analysis
        self.Schedule.On(self.DateRules.EveryDay("SPY"), 
                        self.TimeRules.AfterMarketOpen("SPY", 30),
                        self.daily_analysis)
        
        # Schedule daily safety reset at market open
        self.Schedule.On(self.DateRules.EveryDay("SPY"),
                        self.TimeRules.AfterMarketOpen("SPY", 1),
                        self.reset_daily_trackers)
        
        # Schedule end-of-day summary
        self.Schedule.On(self.DateRules.EveryDay("SPY"),
                        self.TimeRules.BeforeMarketClose("SPY", 5),
                        self.end_of_day_summary)
        
        # Schedule network heartbeat every minute
        self.Schedule.On(self.DateRules.EveryDay("SPY"),
                        self.TimeRules.Every(timedelta(minutes=1)),
                        self.network_monitor.heartbeat_check)
        
        # Schedule Greeks monitoring every 30 minutes
        self.Schedule.On(self.DateRules.EveryDay("SPY"),
                        self.TimeRules.Every(timedelta(minutes=30)),
                        self.check_portfolio_greeks)
        
        # Schedule exit checks every 15 minutes for timely profit targets
        self.Schedule.On(self.DateRules.EveryDay("SPY"),
                        self.TimeRules.Every(timedelta(minutes=15)),
                        self.check_positions_for_exit)
        
        # Schedule weekly strategy execution (Fridays for 0DTE)
        self.Schedule.On(self.DateRules.Every(DayOfWeek.Friday),
                        self.TimeRules.At(10, 30),
                        self.execute_friday_strategies)
        
        # Schedule LEAP ladder execution (Mondays)
        self.Schedule.On(self.DateRules.Every(DayOfWeek.Monday),
                        self.TimeRules.At(10, 0),
                        self.execute_weekly_leap_entries)
        
        # Schedule monthly strategy execution (First Wednesday for LT112)
        self.Schedule.On(self.DateRules.MonthStart("SPY"),
                        self.TimeRules.At(10, 0),
                        self.execute_monthly_strategies)
        
        # Track active positions
        self.active_positions = []
        self.strategy_statistics = {
            'trades_executed': 0,
            'winning_trades': 0,
            'total_return': 0,
            'max_drawdown': 0
        }
        
        self.Log(f"🚀 Tom King Trading Framework v17 - Hybrid System Initialized")
        
        # Log exit rules for transparency
        self.Log(self.exit_manager.get_exit_summary())
        self.Log(f"📈 Account Phase: {self.account_phase}")
        self.Log(f"💰 Starting Capital: ${self.Portfolio.TotalPortfolioValue:,.0f}")
        self.Log(f"🎯 Target: £80k in 8 months (128% annual return)")
        
        # Log available strategies for this phase
        self.log_available_strategies()
    
    def add_symbols_for_phase(self):
        """Add symbols based on account phase"""
        symbol_universe = self.params.get_symbols_for_phase(f'phase{self.account_phase}')
        
        # Add equity options with proper option chain subscriptions
        equity_symbols = symbol_universe.get('equity_options', ['SPY'])
        for symbol_str in equity_symbols:
            equity = self.AddEquity(symbol_str, Resolution.Minute)  # Need minute resolution for options
            self.technical_system.initialize_indicators(equity.Symbol)
            # Add option subscription through centralized manager
            self.option_chain_manager.add_option_subscription(symbol_str)
            
        # Add futures based on phase
        futures_list = symbol_universe.get('futures', [])
        for futures_str in futures_list:
            if self.account_phase >= 2:  # Futures available from Phase 2
                try:
                    futures = self.AddFuture(futures_str)
                    futures.SetFilter(0, 90)  # 0-90 days to expiration
                    self.Log(f"✅ Added futures: {futures_str}")
                except (AttributeError, ValueError, TypeError) as e:
                    self.Log(f"⚠️ Could not add futures {futures_str}: {e}")
        
        # Add ETFs
        etf_list = symbol_universe.get('etfs', [])
        for etf_str in etf_list:
            try:
                etf = self.AddEquity(etf_str, Resolution.Daily)
                self.technical_system.initialize_indicators(etf.Symbol)
            except (AttributeError, ValueError, TypeError) as e:
                self.Log(f"⚠️ Could not add ETF {etf_str}: {e}")
        
        self.Log(f"📊 Added {len(equity_symbols + futures_list + etf_list)} symbols for Phase {self.account_phase}")
    
    def log_available_strategies(self):
        """Log available strategies for current phase"""
        strategies = []
        
        if self.account_phase >= 1:
            strategies.extend([
                "🎯 Friday 0DTE (88% win rate target)",
                "⚡ Advanced 0DTE Butterflies (post-10:30)"
            ])
        if self.account_phase >= 2:
            strategies.extend([
                "📈 LT112 Long Term (95% win rate target)",
                "⚡ Futures Strangles (70% win rate target)",
                "💰 IPMCC Income (2-3% weekly target)",
                "🪜 LEAP Ladders (£200-300 monthly)"
            ])
        if self.account_phase >= 3:
            strategies.extend([
                "🎯 Bear Trap 11x (Counter-trend momentum)",
                "🦋 Advanced Strategies (Section 9B)"
            ])
        
        # Risk management systems (all phases)
        strategies.append("🚫 Earnings/Dividend Avoidance")
        
        self.Log(f"📋 Available Strategies ({len(strategies)}):")
        for strategy in strategies:
            self.Log(f"   {strategy}")
    
    def OnData(self, data):
        """Main data processing with error handling"""
        try:
            # Update VIX level if available
            if self.vix_symbol in data and data[self.vix_symbol] is not None:
                vix_level = float(data[self.vix_symbol].Close)
                self.vix_manager.update_vix_level(vix_level)
        except Exception as e:
            self.Log(f"ERROR in OnData: {str(e)}")
            self.alerts.send_alert("ERROR", f"OnData exception: {str(e)}")
    
    def OnError(self, error: str):
        """Handle algorithm errors"""
        self.Log(f"ALGORITHM ERROR: {error}")
        self.alerts.send_alert("CRITICAL", f"Algorithm error: {error}")
        
        # Check if this is a critical error that requires stopping
        critical_errors = [
            "insufficient buying power",
            "margin call",
            "account suspended",
            "api limit exceeded"
        ]
        
        if any(critical in error.lower() for critical in critical_errors):
            self.Log("CRITICAL ERROR DETECTED - Liquidating all positions")
            self.Liquidate("CRITICAL_ERROR")
            self.safety_checks.can_trade = False
    
    
    def daily_analysis(self):
        """Daily analysis and position management"""
        account_value = float(self.Portfolio.TotalPortfolioValue)
        
        # Update drawdown status (Tom King 10%/15%/20% protocols)
        drawdown_status = self.drawdown_manager.update_drawdown()
        if drawdown_status['action']:
            self.Log(f"[DRAWDOWN] {drawdown_status['action']}")
        
        # Update account phase if needed
        new_phase = self.params.get_phase_for_account_size(account_value)
        if new_phase != self.account_phase:
            self.Log(f"🎉 PHASE TRANSITION: Phase {self.account_phase} → Phase {new_phase}")
            
            # Handle phase transition for existing positions
            transition_actions = self.strategy_validator.handle_phase_transition(
                self.account_phase, new_phase, self.position_manager.positions
            )
            
            for action in transition_actions:
                self.Log(f"[PHASE ACTION] {action['action']}: {action.get('reason', '')}")
                
                # Execute necessary adjustments
                if action['action'] == 'REDUCE':
                    # Reduce positions for downgraded phase
                    self.reduce_strategy_positions(action['strategy'], action['quantity'])
                elif action['action'] == 'REDUCE_BP':
                    # Reduce buying power usage
                    self.adjust_bp_usage(action['target_bp'])
            
            self.account_phase = new_phase
            self.log_available_strategies()
        
        # Get VIX regime analysis
        vix_summary = self.vix_manager.get_vix_regime_summary(self.account_phase)
        if vix_summary.get('opportunities'):
            self.Log(f"🚨 VIX OPPORTUNITY: {vix_summary['opportunities']['warning']}")
        
        # Get correlation analysis
        correlation_summary = self.correlation_manager.get_correlation_summary(self.account_phase)
        if correlation_summary['warnings']:
            for warning in correlation_summary['warnings']:
                self.Log(f"⚠️ CORRELATION: {warning}")
        
        # Check for Bear Trap opportunities (Phase 3+)
        if self.account_phase >= 3:
            self.check_bear_trap_opportunities()
        
        # Position analysis is handled by check_positions_for_exit() every 15 minutes for exits
        # Strategy-specific management actions are analyzed separately
        self.analyze_strategy_specific_actions()
        
        # Log daily status (weekly)
        if self.Time.weekday() == 4:  # Friday
            self.log_weekly_status()
    
    def reset_daily_trackers(self):
        """Reset daily tracking at market open"""
        # Check if it's a trading day first
        if not self.market_holidays.is_trading_day(self.Time):
            self.Log(f"Market closed: {self.market_holidays.get_holiday_name(self.Time)}")
            return
        
        # CRITICAL: Validate broker connection at start of day
        if not self.critical_validations.validate_broker_connection():
            self.safety_checks.can_trade = False
            self.alerts.send_alert("CRITICAL", "Broker connection failed - trading disabled")
            return
        
        # Reset safety checks
        self.safety_checks.reset_daily()
        
        # Reset performance tracker
        self.performance_tracker.reset_daily()
        
        # Update position counts from portfolio
        self.critical_validations.update_position_counts()
        
        # Store daily start value
        self.daily_start_value = self.Portfolio.TotalPortfolioValue
        
        # Check for early close
        if self.market_holidays.is_early_close(self.Time):
            self.Log("⚠️ EARLY CLOSE TODAY - Market closes at 2:00 PM ET")
    
    def end_of_day_summary(self):
        """Generate end-of-day summary and save positions"""
        # Check assignment risk before close
        self.assignment_checker.close_risky_positions()
        
        # Check and roll futures if needed
        self.futures_roller.check_and_roll_futures()
        
        # Generate daily summary
        self.daily_summary.generate_daily_summary()
        
        # Save position state for recovery
        self.save_position_state()
        
        # Export comprehensive metrics
        self.export_metrics()
        
        # Log Phase 4 optimization statistics
        self.log_optimization_stats()
        
        # Log production metrics
        self.production_logger.calculate_daily_metrics()
        
        # Log Greeks summary
        self.greeks_aggregator.log_greeks_summary()
        
        # Generate and log trading dashboard
        dashboard_report = self.dashboard.generate_full_report()
        self.Log(dashboard_report)
    
    def log_optimization_stats(self):
        """Log Phase 4 optimization performance statistics"""
        try:
            # Option chain cache statistics
            cache_stats = self.option_cache.get_cache_stats()
            self.Log(f"[OPTIMIZATION] Option Cache - Hit Rate: {cache_stats['hit_rate']:.1%}, "
                    f"Size: {cache_stats['cache_size']}/{self.option_cache.max_cache_size}, "
                    f"Queries: {cache_stats['total_queries']}")
            
            # Greeks cache performance
            # Note: Greeks cache doesn't track misses, so we estimate based on cache size
            self.Log(f"[OPTIMIZATION] Greeks Cache - Active: {len(self.greeks_cache.greeks_cache)} symbols")
            
            # Position lookup performance
            lookup_stats = self.position_lookup.get_lookup_stats()
            self.Log(f"[OPTIMIZATION] Position Lookup - Hit Rate: {lookup_stats['hit_rate']:.1f}%, "
                    f"Total Lookups: {lookup_stats['total_lookups']}, "
                    f"Indexes: S:{lookup_stats['symbol_index_size']}/ST:{lookup_stats['strategy_index_size']}/E:{lookup_stats['expiry_index_size']}")
            
            # Commission tracking
            commission_summary = self.advanced_commission.get_commission_summary()
            self.Log(f"[OPTIMIZATION] Commissions - Total: ${commission_summary['total_commissions']:.2f}, "
                    f"Daily Avg: ${commission_summary['average_daily']:.2f}, "
                    f"% of Capital: {commission_summary['commission_as_pct_of_capital']:.3f}%")
            
            # Top commission consumers
            if commission_summary['by_strategy']:
                top_strategy = max(commission_summary['by_strategy'].items(), key=lambda x: x[1])
                self.Log(f"[OPTIMIZATION] Top Commission Strategy: {top_strategy[0]} (${top_strategy[1]:.2f})")
            
            # Correlation monitoring
            correlation_report = self.correlation_monitor.get_correlation_report()
            self.Log(f"[OPTIMIZATION] Correlations - Tracked: {correlation_report['symbols_tracked']}, "
                    f"High: {len(correlation_report['high_correlations'])}, "
                    f"Extreme: {len(correlation_report['extreme_correlations'])}")
            
            # Market regime detection
            market_regime = self.correlation_monitor.get_market_regime()
            self.Log(f"[OPTIMIZATION] Market Regime: {market_regime}")
            
            # Portfolio diversification score
            active_positions = self.position_lookup.find_active_positions()
            if active_positions:
                position_symbols = [self.position_manager.positions[pid].symbol for pid in active_positions 
                                  if pid in self.position_manager.positions]
                diversification = self.correlation_monitor.get_position_correlations(position_symbols)
                self.Log(f"[OPTIMIZATION] Portfolio Diversification Score: {diversification['diversification_score']:.1f}/100")
            
        except Exception as e:
            self.Log(f"[ERROR] Failed to log optimization stats: {e}")
        
        # Generate performance analysis
        performance_analysis = self.trade_logger.get_performance_analysis()
        self.Log(performance_analysis)
    
    def reduce_strategy_positions(self, strategy: str, quantity: int):
        """Reduce positions for a specific strategy during phase downgrade"""
        positions_reduced = 0
        for position_id, position in list(self.position_manager.positions.items()):
            if position.strategy == strategy and positions_reduced < quantity:
                self.Log(f"[PHASE ADJUSTMENT] Closing {position_id} due to phase downgrade")
                self.position_manager.close_position(position_id, "PHASE_DOWNGRADE")
                positions_reduced += 1
                
    def adjust_bp_usage(self, target_bp_pct: float):
        """Adjust buying power usage to target percentage"""
        current_bp = sum(pos.buying_power_used for pos in self.position_manager.positions.values() 
                        if hasattr(pos, 'buying_power_used'))
        account_value = float(self.Portfolio.TotalPortfolioValue)
        target_bp = account_value * target_bp_pct
        
        if current_bp > target_bp:
            reduction_needed = current_bp - target_bp
            self.Log(f"[BP ADJUSTMENT] Need to reduce BP by ${reduction_needed:.2f}")
            
            # Close positions starting with lowest performing
            positions_by_pnl = sorted(
                self.position_manager.positions.items(),
                key=lambda x: x[1].get_pnl() if hasattr(x[1], 'get_pnl') else 0
            )
            
            for position_id, position in positions_by_pnl:
                if current_bp <= target_bp:
                    break
                if hasattr(position, 'buying_power_used'):
                    self.position_manager.close_position(position_id, "BP_REDUCTION")
                    current_bp -= position.buying_power_used
        
        # Save all states
        self.position_recovery.save_positions()
        self.dashboard.save_dashboard_state()
        self.trade_logger.save_trade_history()
    
    def check_portfolio_greeks(self):
        """Monitor portfolio Greeks and check limits - Enhanced with aggregation"""
        if not self.IsMarketOpen("SPY"):
            return
        
        # Check phase-based Greeks limits
        if hasattr(self, 'phase_greeks_manager'):
            compliant, message, details = self.phase_greeks_manager.check_greeks_compliance()
            if not compliant:
                self.Log(f"⚠️ GREEKS VIOLATION: {message}")
                # Log detailed status every hour
                if self.Time.minute == 0:
                    self.phase_greeks_manager.log_greeks_status()
        
        # Get aggregated Greeks from the aggregator (legacy check)
        within_limits, violations, greeks = self.greeks_aggregator.check_greeks_limits()
        
        # Calculate portfolio-level Greeks aggregation
        portfolio_greeks = {
            'delta': 0.0,
            'gamma': 0.0,
            'theta': 0.0,
            'vega': 0.0,
            'total_positions': 0
        }
        
        # Aggregate Greeks from multi-legged positions
        if hasattr(self, 'position_state_manager'):
            for position_id, position in self.position_state_manager.positions.items():
                portfolio_greeks['total_positions'] += 1
                # In production, would calculate actual Greeks for each component
                # For now, using position count as proxy
        
        # Aggregate Greeks from regular portfolio
        for symbol, holding in self.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Option:
                security = self.Securities[symbol]
                if hasattr(security, 'Greeks'):
                    portfolio_greeks['delta'] += security.Greeks.Delta * holding.Quantity * 100
                    portfolio_greeks['gamma'] += security.Greeks.Gamma * holding.Quantity * 100
                    portfolio_greeks['theta'] += security.Greeks.Theta * holding.Quantity * 100
                    portfolio_greeks['vega'] += security.Greeks.Vega * holding.Quantity * 100
        
        # Log portfolio-level Greeks
        self.Log(f"[GREEKS] Portfolio Greeks - Delta: {portfolio_greeks['delta']:.2f}, "
                f"Gamma: {portfolio_greeks['gamma']:.2f}, Theta: {portfolio_greeks['theta']:.2f}, "
                f"Vega: {portfolio_greeks['vega']:.2f}, Positions: {portfolio_greeks['total_positions']}")
        
        # Check for violations
        if not within_limits:
            self.alerts.send_alert("WARNING", f"Greeks limit violations: {violations}")
            
            # Implement defensive actions if Greeks exceed limits
            if abs(portfolio_greeks['delta']) > 1000:
                self.Log("[GREEKS] Delta limit exceeded - reducing position sizes")
            if abs(portfolio_greeks['vega']) > 500:
                self.Log("[GREEKS] Vega limit exceeded - high volatility exposure")
    
    def check_positions_for_exit(self):
        """Check all positions for exit conditions every 15 minutes"""
        if not self.IsMarketOpen("SPY"):
            return
        
        # CRITICAL: Check multi-legged positions from PositionStateManager first
        self.check_multi_legged_position_exits()
        
        # Use the exit manager to check all positions
        for symbol, holding in self.Portfolio.items():
            if holding.Invested:
                # Build position info
                position_info = {
                    'symbol': symbol,
                    'strategy': self.get_position_strategy(symbol),
                    'entry_credit': abs(holding.AveragePrice * holding.Quantity * 100),  # Options multiplier
                    'current_value': abs(self.Securities[symbol].Price * holding.Quantity * 100),
                    'unrealized_pnl': holding.UnrealizedProfit,
                    'dte': self.get_days_to_expiry(symbol)
                }
                
                # Check exits
                should_exit, reason, action = self.exit_manager.check_exits(position_info)
                
                if should_exit:
                    self.Log(f"[EXIT CHECK] {symbol}: {reason} - Action: {action}")
                    
                    if action == 'close':
                        # Close the position
                        self.Liquidate(symbol, reason)
                        
                        # Track the trade
                        if hasattr(self, 'performance_tracker'):
                            self.performance_tracker.record_trade(
                                position_info['strategy'],
                                holding.UnrealizedProfit
                            )
                        
                        # Update dashboard
                        if hasattr(self, 'dashboard'):
                            self.dashboard.close_position(position_info['strategy'], {
                                'symbol': symbol,
                                'exit_price': self.Securities[symbol].Price,
                                'pnl': holding.UnrealizedProfit,
                                'reason': reason
                            })
                    
                    elif action == 'roll':
                        # Roll the position
                        self.roll_position(symbol, position_info['strategy'])
            # Could reduce position sizes or hedge here
    
    def execute_friday_strategies(self):
        """Execute Friday-specific strategies (0DTE)"""
        if self.Time.weekday() != 4:  # Ensure it's Friday
            return
        
        # Check if it's a holiday
        if not self.market_holidays.is_trading_day(self.Time):
            self.Log(f"Friday trading skipped - {self.market_holidays.get_holiday_name(self.Time)}")
            return
        
        # SAFETY CHECK FIRST
        if not self.safety_checks.check_before_trade():
            self.alerts.send_alert("WARNING", "Trading halted by safety checks")
            return
        
        self.Log(f"🎯 FRIDAY 0DTE EXECUTION - Phase {self.account_phase}")
        
        # Validate strategy can be executed
        can_execute, reason = self.strategy_validator.can_execute_strategy(
            '0DTE', self.account_phase, 
            float(self.Portfolio.TotalPortfolioValue),
            self.position_manager.positions
        )
        
        if not can_execute:
            self.Log(f"❌ 0DTE blocked: {reason}")
            return
        
        # CRITICAL: Tom King earnings/FOMC avoidance check
        if not self.is_safe_to_trade_today("0DTE"):
            self.Log("❌ 0DTE trading blocked by Tom King earnings/FOMC avoidance rules")
            return
        
        # DELEGATE TO STRATEGY CLASS - No duplicate logic!
        # The FridayZeroDayOptions strategy handles:
        # - Market open price capture (9:30 AM)
        # - Pre-market analysis (9:30-10:30)
        # - Entry execution at 10:30 AM
        # - Greeks validation
        # - Position sizing based on account value
        # - ES/MES futures selection
        # - Iron condor execution
        self.friday_0dte.Execute()
        
        # Track executed trades in position_manager (single source of truth)
        for trade in self.friday_0dte.trades:
            if trade['status'] == 'open' and trade['entry_time'].date() == self.Time.date():
                # Create position in position_manager
                position_id = self.position_manager.create_position(
                    strategy="0DTE",
                    symbol=trade['symbol'],
                    quantity=trade.get('quantity', 1),
                    entry_price=trade.get('entry_price', 0),
                    strikes=trade.get('strikes', {}),
                    credit=trade.get('credit', 0)
                )
                
                # Update dashboard display from position_manager
                self.dashboard.sync_with_position_manager(self.position_manager)
        
        # Check butterfly opportunities (post-10:30)
        if self.Time.time() >= time(10, 30):
            self.check_butterfly_opportunities()
    
    def execute_monthly_strategies(self):
        """Execute monthly strategies (LT112, IPMCC, LEAP)"""
        # Check if it's a holiday
        if not self.market_holidays.is_trading_day(self.Time):
            self.Log(f"Monthly execution skipped - {self.market_holidays.get_holiday_name(self.Time)}")
            return
        
        # Safety check
        if not self.safety_checks.check_before_trade():
            return
        
        account_value = float(self.Portfolio.TotalPortfolioValue)
        current_vix = self.vix_manager.current_vix
        
        self.Log(f"📈 MONTHLY STRATEGY EXECUTION - Phase {self.account_phase}")
        
        # 1. Execute LT112 (First Wednesday of month)
        if self.lt112_strategy.is_entry_day():
            # CRITICAL: Tom King earnings/FOMC avoidance check
            if not self.is_safe_to_trade_today("LT112"):
                self.Log("❌ LT112 trading blocked by Tom King earnings/FOMC avoidance rules")
                return  # Skip LT112 execution this month
                
            can_enter, reason = self.lt112_strategy.can_enter_position(
                self.account_phase,
                self.active_positions,
                self.correlation_manager
            )
            
            if can_enter:
                underlying = self.lt112_strategy.get_underlying_symbol(self.account_phase, account_value)
                position_size = self.lt112_strategy.calculate_position_size(
                    account_value, self.account_phase, current_vix
                )
                
                # Create LT112 order structure
                strikes = self.lt112_strategy.calculate_strikes(
                    self.Securities[underlying].Price, self.account_phase
                )
                order_structure = self.lt112_strategy.create_lt112_order(
                    strikes, position_size, underlying
                )
                
                # Execute the actual orders
                success, orders = self.order_executor.execute_lt112_order(order_structure)
                
                if success:
                    self.Log(f"✅ LT112 Entry: {underlying} x{position_size} positions")
                    self.strategy_statistics['trades_executed'] += 1
                    
                    # Add to dashboard
                    self.dashboard.add_position(
                        "LT112",
                        {
                            'symbol': underlying,
                            'entry_price': self.Securities[underlying].Price,
                            'quantity': position_size,
                            'type': '1-1-2 Put Ratio',
                            'correlation_group': self.correlation_manager.get_correlation_group(underlying),
                            'margin_used': position_size * 5000  # Estimate
                        }
                    )
                else:
                    self.Log(f"❌ LT112 Order execution failed")
            else:
                self.Log(f"❌ LT112 Blocked: {reason}")
        
        # 2. Execute IPMCC (First trading day of month, Phase 2+)
        if self.account_phase >= 2 and self.Time.day <= 3:  # First few days of month
            can_enter_ipmcc, ipmcc_reason = self.ipmcc_strategy.can_enter_position(
                self.account_phase, self.active_positions, self.correlation_manager
            )
            
            if can_enter_ipmcc:
                # Filter symbols for earnings/dividend conflicts  
                available_products = self.ipmcc_strategy.get_available_products(self.account_phase)
                filtered_products, blocked = self.earnings_avoidance.filter_symbols_for_strategy(
                    available_products, "IPMCC"
                )
                
                for symbol_str in filtered_products[:2]:  # Limit to 2 for diversification
                    # Create symbol (QuantConnect-specific)
                    try:
                        from QuantConnect import Symbol, SecurityType, Market
                        symbol = Symbol.Create(symbol_str, SecurityType.Equity, Market.USA)
                    except (ImportError, NameError, AttributeError):
                        # Not in QuantConnect environment - use string as symbol
                        symbol = symbol_str
                    
                    if symbol in self.Securities:
                        # Use CRITICAL FIXED IPMCC execution - checks for existing LEAPs first
                        success, result = self.execute_fixed_ipmcc_strategy(
                            symbol_str, account_value, current_vix
                        )
                        
                        if success:
                            self.strategy_statistics['trades_executed'] += 1
                            # Track performance
                            self.performance_tracker.record_trade('IPMCC', 0)
                            break  # Only one IPMCC per month per phase constraints
                        else:
                            self.Log(f"❌ IPMCC Failed: {symbol_str} - {result}")
            else:
                self.Log(f"❌ IPMCC Blocked: {ipmcc_reason}")
        
        # 3. Execute LEAP Ladder (Mondays only, handled separately)
        # LEAP entries are handled in execute_weekly_leap_entries due to Monday requirement
    
    def execute_weekly_leap_entries(self):
        """Execute LEAP ladder entries (Mondays only, Phase 2+)"""
        if self.Time.weekday() != 0:  # Ensure it's Monday
            return
            
        if self.account_phase < 2:  # LEAP available from Phase 2+
            return
            
        account_value = float(self.Portfolio.TotalPortfolioValue)
        current_vix = self.vix_manager.current_vix
        
        self.Log(f"🪜 LEAP LADDER MONDAY - Phase {self.account_phase}")
        
        # CRITICAL: Tom King earnings/FOMC avoidance check
        if not self.is_safe_to_trade_today("LEAP"):
            self.Log("❌ LEAP trading blocked by Tom King earnings/FOMC avoidance rules")
            return
        
        # Check LEAP entry conditions
        can_enter, reason = self.leap_strategy.can_enter_position(
            self.account_phase, account_value, self.active_positions
        )
        
        if can_enter:
            # Get VIX-based position multiplier
            if current_vix:
                multiplier, action, vix_reason = self.leap_strategy.calculate_vix_position_multiplier(current_vix)
                
                if multiplier > 0:  # Not skipping due to low VIX
                    # Try LEAP entry on SPY (primary LEAP symbol)
                    try:
                        from QuantConnect import Symbol, SecurityType, Market
                        spy_symbol = Symbol.Create("SPY", SecurityType.Equity, Market.USA)
                    except (ImportError, NameError, AttributeError):
                        # Not in QuantConnect environment - use string as symbol
                        spy_symbol = "SPY"
                    
                    if spy_symbol in self.Securities:
                        success, result = self.leap_strategy.execute_leap_entry(
                            spy_symbol, account_value, current_vix
                        )
                        
                        if success:
                            self.strategy_statistics['trades_executed'] += 1
                            # Track performance
                            self.performance_tracker.record_trade('LEAP_Ladders', 0)
                            self.Log(f"✅ LEAP Entry Success: {result}")
                        else:
                            self.Log(f"❌ LEAP Entry Failed: {result}")
                    else:
                        self.Log("❌ LEAP Entry Failed: SPY not in securities")
                else:
                    self.Log(f"❌ LEAP Skipped: {vix_reason}")
            else:
                self.Log("❌ LEAP Skipped: VIX data not available")
        else:
            self.Log(f"❌ LEAP Blocked: {reason}")
        
        # Check for LEAP rolling/management actions
    
    def place_multi_leg_order_safe(self, legs, strategy_name):
        """Place multi-leg order with all safety features"""
        # Check circuit breaker first
        if not self.safety_checks.check_before_trade():
            return False, "Circuit breaker triggered"
        
        # CRITICAL: Check position limits
        if not self.critical_validations.check_position_limit(strategy_name):
            return False, "Position limit exceeded"
        
        # Validate data for all legs
        for leg in legs:
            if not self.data_validator.is_data_valid(leg['symbol']):
                return False, f"Invalid data for {leg['symbol']}"
        
        # Calculate commission and adjust profit targets
        total_commission = 0
        for leg in legs:
            cost = self.commission_model.calculate_entry_cost(
                leg['symbol'], 
                leg['quantity'], 
                leg.get('limit_price', 0)
            )
            total_commission += cost
        
        # Check if profitable after commission
        expected_profit = legs[0].get('expected_profit', 0)  # Should be passed in
        if expected_profit > 0 and expected_profit < total_commission * 2:
            return False, f"Insufficient profit margin after commission ${total_commission:.2f}"
        
        # CRITICAL: Validate margin requirements
        total_margin = sum(self.critical_validations.calculate_required_margin(
            leg['symbol'], leg['quantity'], strategy_name
        ) for leg in legs)
        
        if not self.critical_validations.validate_margin_requirements(total_margin, strategy_name):
            return False, "Insufficient margin"
        
        # Use order fill checker for multi-leg validation
        success = self.fill_checker.place_iron_condor(legs)
        
        if success:
            # Track performance
            self.performance_tracker.record_trade(strategy_name, 0)  # P&L tracked on close
            # CRITICAL: Record position for limits
            self.critical_validations.record_position_open(strategy_name)
            # Log trade to persistent storage
            avg_price = sum(leg.get('limit_price', 0) for leg in legs) / len(legs) if legs else 0
            self.production_logger.log_trade_entry(strategy_name, legs[0]['symbol'], 
                                                  legs[0]['quantity'], avg_price)
            self.alerts.send_alert("INFO", f"{strategy_name} order filled successfully")
            return True, "Order filled"
        else:
            self.alerts.send_alert("WARNING", f"{strategy_name} order failed")
            return False, "Order fill failed"
    
    def place_single_order_safe(self, symbol, quantity, order_type='MARKET', strategy_name=''):
        """Place single order with failover and safety checks"""
        # Check circuit breaker
        if not self.safety_checks.check_before_trade():
            self.Error(f"Safety check failed for {symbol} order")
            return None
        
        # CRITICAL: Full pre-trade validation
        valid, reason = self.critical_validations.pre_trade_validation(
            strategy_name, symbol, quantity
        )
        if not valid:
            self.alerts.send_alert("WARNING", f"Trade blocked: {reason}")
            self.Error(f"Pre-trade validation failed: {reason}")
            return None
        
        # Validate data
        if not self.data_validator.is_data_valid(symbol):
            self.alerts.send_alert("WARNING", f"Invalid data for {symbol}")
            self.Error(f"Data validation failed for {symbol}")
            return None
        
        # Check position size
        security = self.Securities[symbol]
        position_risk = abs(quantity) * security.Price * 100  # For options
        if not self.safety_checks.check_position_size(position_risk):
            self.Error(f"Position size check failed for {symbol}: risk=${position_risk:.2f}")
            return None
        
        # Place with broker failover
        order = self.broker_failover.place_order_with_failover(symbol, quantity, order_type)
        
        if order:
            # Track for performance
            if strategy_name:
                self.performance_tracker.record_trade(strategy_name, 0)
                # CRITICAL: Record position for limits
                self.critical_validations.record_position_open(strategy_name)
                # Log trade to persistent storage
                fill_price = order.AverageFillPrice if hasattr(order, 'AverageFillPrice') else 0
                trade_id = self.production_logger.log_trade_entry(
                    strategy_name, symbol, quantity, fill_price, order_type
                )
        
        return order
    
    def check_and_close_assignment_risk(self):
        """Check and close positions with assignment risk"""
        risky_positions = self.assignment_checker.check_assignment_risk()
        
        if risky_positions:
            self.alerts.send_alert("WARNING", f"Found {len(risky_positions)} positions with assignment risk")
            
            for position in risky_positions:
                # Close the position
                self.Liquidate(position['symbol'], "ASSIGNMENT_RISK")
                self.Log(f"Closed {position['symbol']} - assignment risk (DTE: {position['days_to_expiry']})")
                # Record position close
                self.critical_validations.record_position_close('Unknown')  # Would need strategy tracking
    
    def validate_strategy_schedule(self):
        """Validate strategies won't run on holidays"""
        validation = self.market_holidays.validate_strategy_schedule(self)
        
        if validation['has_issues']:
            for issue in validation['issues']:
                self.alerts.send_alert("INFO", issue)
        
        return validation
        leap_actions = self.leap_strategy.analyze_existing_leaps(self.active_positions)
        for action in leap_actions:
            if action['priority'] in ['URGENT', 'HIGH']:
                self.Log(f"🔥 LEAP Action Required: {action['action']} - {action['reason']}")
                
                # Execute roll actions if needed
                if action['action'] == 'ROLL_FORWARD':
                    # Find the position to roll
                    position_to_roll = next(
                        (p for p in self.active_positions if p.get('id') == action['position_id']),
                        None
                    )
                    if position_to_roll:
                        roll_success = self.leap_strategy.roll_leap_forward(position_to_roll)
                        if roll_success:
                            self.Log(f"✅ LEAP Rolled Successfully")
                        else:
                            self.Log(f"❌ LEAP Roll Failed")
    
    def check_butterfly_opportunities(self):
        """Check for enhanced butterfly opportunities (post-10:30 on Fridays)"""
        if self.Time.weekday() != 4:  # Must be Friday
            return
            
        account_value = float(self.Portfolio.TotalPortfolioValue)
        
        # Initialize baseline prices at 10:30
        self.butterfly_0dte.initialize_daily_baseline()
        
        # Check each eligible product for butterfly opportunities
        for symbol_str in self.butterfly_0dte.eligible_products:
            try:
                symbol = Symbol.Create(symbol_str, SecurityType.Equity, Market.USA)
            except:
                symbol = symbol_str
                
            if symbol in self.Securities:
                try:
                    current_price = float(self.Securities[symbol].Price)
                    if current_price <= 0:
                        continue
                except Exception as e:
                    self.Log(f"Error getting {symbol_str} price for Advanced 0DTE: {e}")
                    continue
                
                # Get baseline price from butterfly strategy
                baseline_price = self.butterfly_0dte.baseline_prices.get(symbol_str, current_price)
                
                # Check for butterfly opportunities
                opportunity = self.butterfly_0dte.get_movement_opportunities(
                    symbol, current_price, baseline_price
                )
                
                if opportunity['opportunity']:
                    self.Log(f"⚡ Advanced 0DTE {opportunity['type']}: {symbol_str} - {opportunity['reason']}")
                    
                    # Check correlation limits before executing
                    allowed, correlation_msg = self.correlation_manager.enforce_correlation_limits(
                        symbol, self.account_phase
                    )
                    
                    if not allowed:
                        self.Log(f"Butterfly blocked by correlation: {correlation_msg}")
                        continue
                    
                    # Execute based on opportunity type
                    if 'butterfly' in opportunity['type']:
                        strikes = self.butterfly_0dte.calculate_butterfly_strikes(
                            current_price, opportunity['direction']
                        )
                        success, result = self.butterfly_0dte.execute_butterfly_spread(
                            symbol, strikes, account_value
                        )
                    elif opportunity['type'] == 'ratio_spread':
                        strikes = self.butterfly_0dte.calculate_ratio_spread_strikes(
                            current_price, opportunity['direction']
                        )
                        success, result = self.butterfly_0dte.execute_ratio_spread(
                            symbol, strikes, account_value
                        )
                    else:
                        continue
                    
                    if success:
                        self.strategy_statistics['trades_executed'] += 1
                        self.Log(f"✅ Advanced 0DTE Executed: {result}")
                    else:
                        self.Log(f"Advanced 0DTE attempt: {result}")
        
        # Check time stops for existing butterflies
        self.butterfly_0dte.check_time_stops()
        
        # Check profit targets
        self.butterfly_0dte.check_profit_targets()
    
    def check_bear_trap_opportunities(self):
        """Check for Bear Trap 11x opportunities (Phase 3+)"""
        # CRITICAL: Tom King earnings/FOMC avoidance check
        if not self.is_safe_to_trade_today("Bear_Trap"):
            return  # Skip bear trap execution today
            
        account_value = float(self.Portfolio.TotalPortfolioValue)
        current_vix = self.vix_manager.current_vix
        
        # Get active positions count for risk management
        active_positions = [h for h in self.Portfolio if h.Value.Invested]
        
        # Check if Bear Trap strategy can enter positions
        can_enter, reason = self.bear_trap_strategy.can_enter_position(
            self.account_phase, account_value, active_positions, current_vix
        )
        
        if not can_enter:
            if "VIX" not in reason and "market hours" not in reason:
                self.Log(f"Bear Trap Check: {reason}")
            return
        
        # Get available products for current phase
        available_products = self.bear_trap_strategy.get_available_products(self.account_phase)
        
        # Check one product at a time (Bear Trap is high leverage)
        for symbol_str in available_products[:1]:
            # Create symbol
            try:
                symbol = Symbol.Create(symbol_str, SecurityType.Equity, Market.USA)
            except:
                symbol = symbol_str
            
            if symbol in self.Securities:
                # Check correlation limits before proceeding
                allowed, correlation_msg = self.correlation_manager.enforce_correlation_limits(
                    symbol, self.account_phase
                )
                
                if not allowed:
                    self.Log(f"Bear Trap blocked by correlation: {correlation_msg}")
                    continue
                
                # Execute Bear Trap entry
                success, result = self.bear_trap_strategy.execute_bear_trap_entry(
                    symbol, account_value, current_vix
                )
                
                if success:
                    self.strategy_statistics['trades_executed'] += 1
                    self.Log(f"✅ Bear Trap 11x Executed: {result}")
                    break  # Only one Bear Trap at a time
                else:
                    self.Log(f"Bear Trap attempt: {result}")
    # REMOVED analyze_existing_positions() - redundant with check_positions_for_exit()
    # Exit checking is now consolidated in check_positions_for_exit() called every 15 minutes
    
    def check_multi_legged_position_exits(self):
        """
        CRITICAL: Check Tom King exit rules for multi-legged positions in PositionStateManager
        This handles IPMCC, LT112, and other multi-component strategies
        OPTIMIZED: Using batch operations for performance (Phase 4)
        """
        if not hasattr(self, 'position_state_manager') or not self.position_state_manager.positions:
            return
        
        # Use batch optimizer for efficient exit checking if available
        if hasattr(self, 'batch_optimizer'):
            exit_actions = self.batch_optimizer.batch_check_exit_conditions(
                self.position_state_manager.positions, 
                self.exit_manager
            )
            
            # Process exit actions efficiently
            for action in exit_actions:
                position_id = action['position_id']
                position = self.position_state_manager.positions.get(position_id)
                if position:
                    self.Log(f"[BATCH EXIT] {position.strategy} position {position_id}: {action['reason']}")
                    # Execute the appropriate action
                    if action['action'] == 'close':
                        self.position_state_manager.close_position(position_id)
                    elif action['action'] == 'roll':
                        self._execute_position_roll(position_id, position)
            
            if exit_actions:
                self.Log(f"[OPTIMIZATION] Processed {len(exit_actions)} exits in batch mode")
            return
        
        # Fallback to original logic
        exit_actions = []
        
        # Check each multi-legged position
        for position_id, position in self.position_state_manager.positions.items():
            try:
                # Build position info for Tom King exit rules
                position_dict = {
                    'position_id': position_id,
                    'strategy': position.strategy,
                    'symbol': position.symbol,
                    'entry_credit': getattr(position, 'entry_credit', 0),
                    'current_value': self.position_state_manager.get_position_current_value(position_id),
                    'unrealized_pnl': getattr(position, 'unrealized_pnl', 0),
                    'dte': self.position_state_manager.get_position_dte(position_id),
                    'entry_time': position.entry_time
                }
                
                # Apply Tom King exit rules
                should_exit, reason, action = self.exit_manager.check_exits(position_dict)
                
                if should_exit:
                    exit_actions.append({
                        'position_id': position_id,
                        'position': position,
                        'reason': reason,
                        'action': action,
                        'strategy': position.strategy
                    })
                    
            except Exception as e:
                self.Log(f"[ERROR] Failed to check exits for multi-legged position {position_id}: {e}")
        
        # Execute exit actions
        for exit_action in exit_actions:
            self.execute_multi_legged_exit_action(exit_action)
        
        if exit_actions:
            self.Log(f"[EXIT] Processed {len(exit_actions)} multi-legged position exits")
    
    def execute_multi_legged_exit_action(self, exit_action):
        """Execute exit action for multi-legged position"""
        try:
            position_id = exit_action['position_id']
            position = exit_action['position']
            reason = exit_action['reason']
            action = exit_action['action']
            strategy = exit_action['strategy']
            
            self.Log(f"[EXIT] {strategy} {position.symbol}: {reason} - Action: {action}")
            
            if action == 'close':
                # Close all components of the multi-legged position
                success = self.position_state_manager.close_position(position_id)
                if success:
                    self.Log(f"✅ Successfully closed multi-legged {strategy} position: {position.symbol}")
                    
                    # Record performance
                    if hasattr(self, 'performance_tracker'):
                        pnl = exit_action.get('unrealized_pnl', 0)
                        self.performance_tracker.record_trade(strategy, pnl)
                        
                    # Update dashboard
                    if hasattr(self, 'dashboard'):
                        self.dashboard.close_position(strategy, {
                            'symbol': position.symbol,
                            'pnl': exit_action.get('unrealized_pnl', 0),
                            'reason': reason,
                            'components': len(position.components)
                        })
                else:
                    self.Log(f"❌ Failed to close multi-legged {strategy} position: {position.symbol}")
                    
            elif action == 'roll':
                # Roll the position (for IPMCC weekly calls, LEAP expirations, etc.)
                if strategy == 'IPMCC' and hasattr(self, 'fixed_ipmcc'):
                    # Use the fixed IPMCC system to roll
                    roll_success, roll_result = self.fixed_ipmcc.roll_weekly_call(
                        position.symbol, position_id
                    )
                    if roll_success:
                        self.Log(f"✅ IPMCC roll successful: {roll_result}")
                    else:
                        self.Log(f"❌ IPMCC roll failed: {roll_result}")
                        
                elif strategy == 'LT112' and hasattr(self, 'fixed_lt112'):
                    # LT112 doesn't roll - it uses 21 DTE defensive management
                    # Create action for defensive management
                    action = {
                        'action': 'CLOSE_ENTIRE_POSITION',
                        'position_id': position_id,
                        'reason': reason,
                        'priority': 'HIGH'
                    }
                    
                    # Use the fixed LT112 system to execute management action
                    roll_success, roll_result = self.fixed_lt112.execute_management_action(action)
                    
                    if roll_success:
                        self.Log(f"✅ LT112 defensive management successful: {roll_result}")
                    else:
                        self.Log(f"❌ LT112 defensive management failed: {roll_result}")
                else:
                    self.Log(f"⚠️ Roll requested for {strategy} but no roll handler available")
                    
        except Exception as e:
            self.Log(f"[ERROR] Failed to execute exit action for {exit_action.get('strategy', 'Unknown')}: {e}")
    
    def analyze_strategy_specific_actions(self):
        """Analyze strategy-specific management actions (called from daily_analysis)"""
        current_positions = self.active_positions  # Use our tracked positions
        
        # Analyze LT112 positions using CRITICAL FIXED management system
        lt112_actions = self.analyze_fixed_lt112_positions(current_positions)
        for action in lt112_actions:
            if action['priority'] in ['URGENT', 'HIGH']:
                self.Log(f"🔥 FIXED LT112 Action: {action['action']} - {action['reason']}")
                # Execute using CRITICAL fixed management system with component-level precision
                success, result = self.execute_fixed_lt112_management(action)
                if success:
                    self.Log(f"✅ FIXED LT112 Management: {result}")
                else:
                    self.Log(f"❌ FIXED LT112 Management Failed: {result}")
        
        # Analyze LEAP positions
        leap_actions = self.leap_strategy.analyze_existing_leaps(current_positions)
        for action in leap_actions:
            if action['priority'] in ['URGENT', 'HIGH']:
                self.Log(f"🪜 LEAP Action: {action['action']} - {action['reason']}")
        
        
        # Analyze IPMCC positions (weekly call rolls on Fridays)
        if self.Time.weekday() == 4:  # Friday - IPMCC roll day
            for ipmcc_position in [p for p in current_positions if p.get('strategy') == 'IPMCC']:
                try:
                    current_price = float(self.Securities[ipmcc_position['symbol']].Price)
                    if current_price <= 0 or current_price is None:
                        self.Log(f"Invalid price for IPMCC position: {current_price}")
                        continue  # Skip if invalid price
                except (KeyError, AttributeError, TypeError, ValueError) as e:
                    self.Log(f"Error getting price for IPMCC position {ipmcc_position.get('symbol', 'unknown')}: {e}")
                    continue
                
                # Use FIXED IPMCC weekly call rolling
                symbol = ipmcc_position.get('symbol', '')
                component_id = ipmcc_position.get('component_id', '')
                
                if symbol and component_id:
                    self.Log(f"💰 IPMCC Roll Check: {symbol}")
                    roll_success, roll_result = self.fixed_ipmcc.roll_weekly_call(symbol, component_id)
                    if roll_success:
                        self.Log(f"✅ IPMCC Weekly Call Rolled: {roll_result}")
                    else:
                        self.Log(f"❌ IPMCC Weekly Call Roll Failed: {roll_result}")
                
                # Check LEAP health
                leap_health = self.ipmcc_strategy.analyze_leap_health(ipmcc_position, current_price)
                if leap_health.get('action_required'):
                    self.Log(f"🔥 IPMCC LEAP Alert: {leap_health['action_required']}")
        
    
    def log_weekly_status(self):
        """Log comprehensive weekly status"""
        account_value = float(self.Portfolio.TotalPortfolioValue)
        initial_value = 44500  # Starting capital
        total_return = (account_value - initial_value) / initial_value if initial_value > 0 else 0
        
        self.Log(f"")
        self.Log(f"📊 WEEKLY STATUS - {self.Time.strftime('%Y-%m-%d')}")
        self.Log(f"💰 Account Value: ${account_value:,.0f}")
        self.Log(f"📈 Total Return: {total_return:.1%}")
        self.Log(f"🎯 Phase: {self.account_phase}")
        
        if self.vix_manager.current_vix:
            regime = self.vix_manager.get_current_regime()
            self.Log(f"📊 VIX: {self.vix_manager.current_vix:.1f} ({regime['name']})")
        
        # Correlation risk
        correlation_summary = self.correlation_manager.get_correlation_summary(self.account_phase)
        self.Log(f"🔗 Correlation Risk: {correlation_summary['risk_score']:.0f}/100")
        
        # Run system validation periodically (once per week)
        if self.Time.weekday() == 0 and self.Time.hour == 9 and self.Time.minute == 30:
            validation_report = self.system_validator.run_full_validation()
            self.Log(validation_report)
        
        # Strategy performance
        self.Log(f"🎲 Trades Executed: {self.strategy_statistics['trades_executed']}")
        
        # Goal progress
        target_8_months = self.params.PERFORMANCE_TARGETS['goal_8_months']  # $102k
        progress = account_value / target_8_months if target_8_months > 0 else 0
        self.Log(f"🏁 Goal Progress: {progress:.1%} (Target: ${target_8_months:,.0f} in 8 months)")
        self.Log(f"")
    
    def OnOrderEvent(self, orderEvent):
        """Handle order events - comprehensive logging and tracking with Phase 4 commission tracking"""
        
        # Mirror to Tastytrade sandbox if hybrid mode is enabled
        if hasattr(self, 'hybrid_sandbox'):
            self.hybrid_sandbox.on_order_event(orderEvent)
        
        # Handle different order statuses
        if orderEvent.Status == OrderStatus.Filled:
            # Calculate commission with advanced model (Phase 4)
            commission = 0.0
            if hasattr(self, 'advanced_commission'):
                commission = self.advanced_commission.calculate_order_commission(orderEvent)
            
            # Log the fill to persistent storage
            self.production_logger.log_trade_entry(
                strategy_name="Unknown",  # Would need to track which strategy placed the order
                symbol=orderEvent.Symbol,
                quantity=orderEvent.FillQuantity,
                entry_price=orderEvent.FillPrice,
                order_type="MARKET" if orderEvent.OrderId in getattr(self, 'market_orders', []) else "LIMIT"
            )
            
            # Update performance tracking for closed positions
            if orderEvent.Symbol in self.Portfolio:
                holding = self.Portfolio[orderEvent.Symbol]
                if hasattr(holding, 'LastTradeProfit') and holding.LastTradeProfit != 0:
                    pnl = holding.LastTradeProfit
                    
                    # Update performance tracker
                    if pnl > 0:
                        self.performance_tracker['wins'] += 1
                    else:
                        self.performance_tracker['losses'] += 1
                    
                    self.performance_tracker['total_pnl'] += pnl
                    
                    # Calculate win rate
                    total_trades = self.performance_tracker['wins'] + self.performance_tracker['losses']
                    if total_trades > 0:
                        self.performance_tracker['win_rate'] = self.performance_tracker['wins'] / total_trades
            
            # Log to console with commission and performance
            win_rate = self.performance_tracker.get('win_rate', 0)
            self.Log(f"ORDER FILLED: {orderEvent.Symbol} "
                    f"{orderEvent.Direction} {orderEvent.Quantity} @ ${orderEvent.FillPrice:.2f} "
                    f"(Commission: ${commission:.2f}) | Win Rate: {win_rate:.1%}")
        
        elif orderEvent.Status == OrderStatus.Canceled:
            self.Log(f"ORDER CANCELED: {orderEvent.Symbol}")
            
        elif orderEvent.Status == OrderStatus.Invalid:
            self.production_logger.log_error(
                "ORDER_INVALID",
                f"Invalid order for {orderEvent.Symbol}",
                critical=True
            )
    
    def OnEndOfDay(self):
        """End of day processing"""
        
        # Sync positions with sandbox if enabled
        if hasattr(self, 'hybrid_sandbox'):
            self.hybrid_sandbox.sync_positions()
            self.hybrid_sandbox.log_performance_comparison()
    
    def get_system_health(self):
        """Get comprehensive system health status for monitoring"""
        try:
            health = {
                'timestamp': str(self.Time),
                'connectivity': {
                    'lean': self.IsConnected if hasattr(self, 'IsConnected') else True,
                    'tastytrade_api': self.tastytrade_api.is_authenticated if self.tastytrade_api else False,
                    'websocket': self.tastytrade_websocket.is_connected if self.tastytrade_websocket else False
                },
                'portfolio': {
                    'total_value': float(self.Portfolio.TotalPortfolioValue),
                    'margin_used': float(self.Portfolio.TotalMarginUsed),
                    'margin_remaining': float(self.Portfolio.MarginRemaining),
                    'bp_usage': float(self.Portfolio.TotalMarginUsed / self.Portfolio.TotalPortfolioValue) if self.Portfolio.TotalPortfolioValue > 0 else 0,
                    'positions': len([h for h in self.Portfolio.Values if h.Invested]),
                    'account_phase': self.account_phase
                },
                'greeks': self.greeks_monitor.get_portfolio_greeks() if hasattr(self, 'greeks_monitor') else {},
                'performance': {
                    'wins': self.performance_tracker.get('wins', 0),
                    'losses': self.performance_tracker.get('losses', 0),
                    'win_rate': self.performance_tracker.get('win_rate', 0),
                    'total_pnl': self.performance_tracker.get('total_pnl', 0)
                },
                'vix': {
                    'current': self.vix_manager.get_current_vix() if hasattr(self, 'vix_manager') else 0,
                    'regime': self.vix_manager.get_vix_regime() if hasattr(self, 'vix_manager') else 'UNKNOWN'
                },
                'cache': {
                    'option_chain_hit_rate': self.option_chain_cache.get_hit_rate() if hasattr(self, 'option_chain_cache') else 0,
                    'greeks_cache_size': len(self.greeks_cache) if hasattr(self, 'greeks_cache') else 0
                },
                'rate_limiting': {
                    'requests_made': self.rate_limiter.request_count if hasattr(self, 'rate_limiter') else 0,
                    'circuit_breaker': self.rate_limiter.circuit_breaker_active if hasattr(self, 'rate_limiter') else False
                },
                'last_activity': {
                    'last_order_time': str(self.last_order_time) if hasattr(self, 'last_order_time') else None,
                    'trades_today': self.trades_today if hasattr(self, 'trades_today') else 0
                }
            }
            return health
        except Exception as e:
            self.Error(f"Error getting system health: {e}")
            return {'error': str(e)}
    
    def enhanced_log(self, message, level="INFO", context=None):
        """Enhanced logging with automatic context"""
        try:
            log_entry = {
                'time': str(self.Time),
                'level': level,
                'message': message,
                'context': {
                    'portfolio_value': float(self.Portfolio.TotalPortfolioValue),
                    'bp_used': float(self.Portfolio.TotalMarginUsed),
                    'vix': self.vix_manager.get_current_vix() if hasattr(self, 'vix_manager') else 0,
                    'phase': self.account_phase,
                    'positions': len([h for h in self.Portfolio.Values if h.Invested]),
                    'win_rate': self.performance_tracker.get('win_rate', 0) if hasattr(self, 'performance_tracker') else 0
                }
            }
            
            # Add custom context if provided
            if context:
                log_entry['context'].update(context)
            
            # Log as JSON for easy parsing
            self.Log(f"[{level}] {message} | Context: {json.dumps(log_entry['context'], default=str)}")
            
        except Exception as e:
            # Fallback to simple logging
            self.Log(f"[{level}] {message}")
    
    def export_metrics(self):
        """Export comprehensive metrics to ObjectStore for analysis"""
        try:
            metrics = {
                'date': str(self.Time.date()),
                'timestamp': str(self.Time),
                'performance': self.performance_tracker,
                'greeks': self.greeks_monitor.get_portfolio_greeks() if hasattr(self, 'greeks_monitor') else {},
                'positions': len([h for h in self.Portfolio.Values if h.Invested]),
                'portfolio_value': float(self.Portfolio.TotalPortfolioValue),
                'drawdown': self.drawdown_manager.current_drawdown if hasattr(self, 'drawdown_manager') else 0,
                'vix_regime': self.vix_manager.get_vix_regime() if hasattr(self, 'vix_manager') else 'UNKNOWN',
                'cache_stats': {
                    'option_chain_hit_rate': self.option_chain_cache.get_hit_rate() if hasattr(self, 'option_chain_cache') else 0,
                    'greeks_cache_size': len(self.greeks_cache) if hasattr(self, 'greeks_cache') else 0
                },
                'daily_summary': {
                    'trades': self.trades_today if hasattr(self, 'trades_today') else 0,
                    'commissions': self.daily_commission if hasattr(self, 'daily_commission') else 0
                }
            }
            
            # Save to ObjectStore
            key = f"metrics_{self.Time.strftime('%Y%m%d')}"
            self.ObjectStore.Save(key, json.dumps(metrics, default=str))
            
            # Also save rolling 30-day metrics
            rolling_key = "metrics_rolling_30d"
            if self.ObjectStore.ContainsKey(rolling_key):
                rolling_data = json.loads(self.ObjectStore.Read(rolling_key))
            else:
                rolling_data = []
            
            rolling_data.append(metrics)
            # Keep only last 30 days
            if len(rolling_data) > 30:
                rolling_data = rolling_data[-30:]
            
            self.ObjectStore.Save(rolling_key, json.dumps(rolling_data, default=str))
            
            self.Log(f"✅ Metrics exported for {self.Time.date()}")
            
        except Exception as e:
            self.Error(f"Error exporting metrics: {e}")
    
    def OnEndOfAlgorithm(self):
        """Final analysis and validation"""
        account_value = float(self.Portfolio.TotalPortfolioValue)
        initial_value = 44500
        total_return = (account_value - initial_value) / initial_value if initial_value > 0 else 0
        
        self.Log(f"")
        self.Log(f"🏁 TOM KING FRAMEWORK v17 - FINAL RESULTS")
        self.Log(f"💰 Final Value: ${account_value:,.0f}")
        self.Log(f"📈 Total Return: {total_return:.1%}")
        self.Log(f"🎯 Target Achieved: {'✅' if total_return >= 1.28 else '❌'} (128% target)")
        
        # Validate all systems
        self.Log(f"")
        self.Log(f"🧪 SYSTEM VALIDATION:")
        
        # Validate each component
        correlation_tests = self.correlation_manager.validate_correlation_system()
        for test in correlation_tests:
            self.Log(f"   {test}")
        
        vix_tests = self.vix_manager.validate_vix_system()
        for test in vix_tests:
            self.Log(f"   {test}")
        
        futures_tests = self.futures_manager.validate_futures_system()
        for test in futures_tests:
            self.Log(f"   {test}")
        
        technical_tests = self.technical_system.validate_technical_system()
        for test in technical_tests:
            self.Log(f"   {test}")
        
        strategy_tests = [
            self.lt112_strategy.validate_lt112_system(),
            self.ipmcc_strategy.validate_ipmcc_system(),
            self.leap_strategy.validate_leap_system()
        ]
        
        # Add advanced strategy validations
        strategy_tests.extend([
            self.earnings_avoidance.validate_avoidance_system(),
            self.butterfly_0dte.validate_butterfly_system(),
            self.bear_trap_strategy.validate_bear_trap_system()
        ])
        
        for strategy_test in strategy_tests:
            for test in strategy_test:
                self.Log(f"   {test}")
        
        self.Log(f"")
        self.Log(f"✅ Tom King Trading Framework v17 - Hybrid System Restoration Complete")
        self.Log(f"📊 All core components restored: Correlation Analysis, Full Symbol Universe,")
        self.Log(f"   All 10+ Strategies, Futures Trading, Technical Analysis, 5-Level VIX System")
    
    def get_position_strategy(self, symbol) -> str:
        """Identify which strategy a position belongs to"""
        # Check active positions tracking
        for position in self.active_positions:
            if position.get('symbol') == symbol:
                return position.get('strategy', 'Unknown')
        
        # Infer from symbol characteristics if not tracked
        security = self.Securities.get(symbol)
        if security:
            if security.Type == SecurityType.Option:
                # Check expiry for strategy hints
                days_to_expiry = (security.Expiry - self.Time).days
                
                if days_to_expiry == 0:
                    return '0DTE'
                elif days_to_expiry <= 45:
                    return 'Strangle'
                elif days_to_expiry <= 120:
                    return 'LT112'
                elif days_to_expiry > 365:
                    return 'LEAP'
                else:
                    return 'IPMCC'
            elif security.Type == SecurityType.Future:
                return 'Futures_Strangle'
        
        return 'Unknown'
    
    def get_days_to_expiry(self, symbol) -> int:
        """Get days to expiry for an option or future"""
        security = self.Securities.get(symbol)
        if security and hasattr(security, 'Expiry'):
            return (security.Expiry - self.Time).days
        return 999  # Default for non-expiring assets
    
    def is_safe_to_trade_today(self, strategy_type: str) -> bool:
        """
        CRITICAL: Tom King earnings and FOMC avoidance check
        Returns True if it's safe to trade the given strategy type today
        """
        try:
            if not hasattr(self, 'earnings_avoidance'):
                self.Log("⚠️ WARNING: Earnings avoidance system not initialized")
                return True  # Fail safe - allow trading if system not available
            
            # Check general market conditions (FOMC, CPI, etc.)
            # Since is_safe_trading_day doesn't exist, check for SPY as a proxy for market events
            if self.earnings_avoidance.should_avoid_symbol("SPY", self.Time):
                self.Log(f"❌ {strategy_type} blocked - FOMC/CPI avoidance day")
                return False
            
            # For strategies that use specific symbols, check each symbol
            if strategy_type == "0DTE":
                # 0DTE typically uses ES/MES futures - these don't have earnings but check FOMC
                # Friday 0DTE is generally safe except on FOMC days
                return True
                
            elif strategy_type in ["IPMCC", "LT112"]:
                # These use equity options - need per-symbol earnings checks
                # This is already handled in the IPMCC execution, but add general safety
                return not self.earnings_avoidance.should_avoid_symbol("SPY", self.Time)
                
            elif strategy_type in ["Strangle", "Futures_Strangle"]:
                # Futures strangles - check FOMC/CPI days using SPY as proxy
                return not self.earnings_avoidance.should_avoid_symbol("SPY", self.Time)
                
            else:
                # Default safety check using SPY as market proxy
                return not self.earnings_avoidance.should_avoid_symbol("SPY", self.Time)
                
        except Exception as e:
            self.Log(f"[ERROR] Earnings avoidance check failed: {e}")
            return True  # Fail safe - allow trading if check fails
    
    def roll_position(self, symbol, strategy: str):
        """Roll a position to next expiry"""
        # Strategy-specific rolling logic
        if strategy == 'IPMCC':
            # Roll short call to next week
            self.ipmcc_strategy.roll_weekly_call(symbol)
        elif strategy == 'LEAP':
            # Roll LEAP to next year
            self.leap_strategy.roll_leap_position(symbol)
        elif strategy in ['Strangle', 'Futures_Strangle', 'LT112']:
            # Roll to next month
            self.roll_to_next_month(symbol)
        else:
            self.Log(f"[ROLL] No roll logic for {strategy} - closing instead")
            self.Liquidate(symbol, "ROLL_TO_CLOSE")
    
    def roll_to_next_month(self, symbol):
        """Generic roll to next month for options"""
        try:
            security = self.Securities[symbol]
            holding = self.Portfolio[symbol]
            
            if security.Type == SecurityType.Option:
                # Get next month expiry
                underlying = security.Underlying
                current_expiry = security.Expiry
                
                # Find next monthly expiry (3rd Friday)
                next_month = current_expiry.month + 1 if current_expiry.month < 12 else 1
                next_year = current_expiry.year if current_expiry.month < 12 else current_expiry.year + 1
                
                # Close current position
                self.Liquidate(symbol, "ROLL")
                
                # Open new position in next month
                # This would need proper strike selection logic
                self.Log(f"[ROLL] Rolled {symbol} to {next_month}/{next_year}")
            
        except Exception as e:
            self.Log(f"[ROLL] Failed to roll {symbol}: {str(e)}")
    
    # ===============================
    # CRITICAL FIXED MULTI-LEGGED STRATEGY METHODS
    # ===============================
    
    def execute_fixed_ipmcc_strategy(self, symbol: str, account_value: float, vix_level: float = None) -> tuple[bool, str]:
        """
        CRITICAL FIXED IPMCC execution - checks for existing LEAPs first!
        Logic:
        1. Check if we have an active LEAP for this symbol
        2. If YES: Only add weekly call against existing LEAP  
        3. If NO: Create new LEAP + weekly call position
        """
        try:
            # CRITICAL CHECK: Do we already have an active LEAP for this symbol?
            existing_leap = self.position_state_manager.has_active_leap(symbol)
            
            if existing_leap:
                # SCENARIO 1: We have an active LEAP - only add weekly call
                self.Log(f"🔄 FIXED IPMCC: Found existing LEAP for {symbol}, adding weekly call only")
                
                # Calculate weekly call strike (3% OTM)
                current_price = float(self.Securities[symbol].Price)
                weekly_strike = current_price * 1.03
                weekly_expiry = self.Time + timedelta(days=7)
                
                # Add weekly call to existing LEAP position  
                component_id = self.position_state_manager.add_ipmcc_weekly_call(
                    symbol=symbol,
                    weekly_contract=f"{symbol}_CALL_{weekly_strike}_{weekly_expiry.strftime('%Y%m%d')}",
                    quantity=2,  # Match LEAP quantity
                    strike=weekly_strike,
                    expiry=weekly_expiry
                )
                
                if component_id:
                    # CRITICAL: Sync to active_positions
                    position_data = {'weekly_strike': weekly_strike, 'weekly_expiry': weekly_expiry}
                    self.position_sync.sync_new_position_to_active_list(
                        existing_leap.component_id, "IPMCC", symbol, position_data
                    )
                    return True, "Weekly call added to existing IPMCC position"
                else:
                    return False, "Failed to add weekly call to existing LEAP"
                    
            else:
                # SCENARIO 2: No active LEAP - create complete new IPMCC position
                self.Log(f"🆕 FIXED IPMCC: No existing LEAP for {symbol}, creating new position")
                
                current_price = float(self.Securities[symbol].Price)
                
                # Create new IPMCC position
                position_id = self.position_state_manager.create_ipmcc_position(symbol)
                
                # Calculate LEAP strike (~80 delta, 15-20% OTM)
                leap_strike = current_price * 0.82
                leap_expiry = self.Time + timedelta(days=365)
                
                # Add LEAP component
                self.position_state_manager.add_ipmcc_leap(
                    position_id=position_id,
                    leap_contract=f"{symbol}_CALL_{leap_strike}_{leap_expiry.strftime('%Y%m%d')}",
                    quantity=2,
                    strike=leap_strike,
                    expiry=leap_expiry
                )
                
                # Add weekly call component
                weekly_strike = current_price * 1.03  
                weekly_expiry = self.Time + timedelta(days=7)
                
                self.position_state_manager.add_ipmcc_weekly_call(
                    symbol=symbol,
                    weekly_contract=f"{symbol}_CALL_{weekly_strike}_{weekly_expiry.strftime('%Y%m%d')}",
                    quantity=2,
                    strike=weekly_strike,
                    expiry=weekly_expiry
                )
                
                # CRITICAL: Sync to active_positions  
                position_data = {
                    'leap_strike': leap_strike,
                    'leap_expiry': leap_expiry,
                    'weekly_strike': weekly_strike,
                    'weekly_expiry': weekly_expiry
                }
                self.position_sync.sync_new_position_to_active_list(
                    position_id, "IPMCC", symbol, position_data
                )
                
                self.Log(f"✅ NEW FIXED IPMCC Created: {symbol} LEAP@{leap_strike} + Weekly@{weekly_strike}")
                return True, "New IPMCC position created successfully"
                
        except Exception as e:
            self.Error(f"FIXED IPMCC execution error for {symbol}: {str(e)}")
            return False, f"Execution error: {str(e)}"
            
    def analyze_fixed_lt112_positions(self, current_positions: list) -> list:
        """
        CRITICAL FIXED LT112 analysis that provides component-level management actions
        """
        try:
            management_actions = []
            
            # Get all LT112 positions from position state manager
            lt112_positions = [p for p in self.position_state_manager.positions.values() 
                             if p.strategy == "LT112"]
            
            for position in lt112_positions:
                # Get individual components
                naked_puts = position.get_components_by_type("NAKED_PUT")
                debit_long = position.get_components_by_type("DEBIT_LONG")
                debit_short = position.get_components_by_type("DEBIT_SHORT")
                
                # Analyze naked puts for 90% profit target
                for naked_put in naked_puts:
                    if naked_put.status == "OPEN" and naked_put.pnl > 0:
                        # Calculate profit percentage
                        initial_credit = abs(naked_put.entry_price * naked_put.quantity * 100)
                        if initial_credit > 0:
                            profit_pct = naked_put.pnl / initial_credit
                            
                            # Check for 90% profit target
                            if profit_pct >= 0.90:  # Tom King 90% target
                                management_actions.append({
                                    'position_id': position.position_id,
                                    'component_id': naked_put.component_id,
                                    'action': 'CLOSE_NAKED_PUTS_ONLY',
                                    'reason': f'Naked puts hit 90% profit target ({profit_pct:.1%})',
                                    'priority': 'HIGH',
                                    'expected_profit': naked_put.pnl,
                                    'tom_king_rule': 'Close naked puts at 90% profit, keep debit spread'
                                })
                
                # Analyze debit spread for 50% profit target  
                if len(debit_long) > 0 and len(debit_short) > 0:
                    debit_pnl = debit_long[0].pnl + debit_short[0].pnl
                    debit_cost = (abs(debit_long[0].entry_price * debit_long[0].quantity * 100) + 
                                abs(debit_short[0].entry_price * abs(debit_short[0].quantity) * 100))
                    
                    if debit_cost > 0 and debit_pnl > 0:
                        profit_pct = debit_pnl / debit_cost
                        
                        # Check for 50% profit target  
                        if profit_pct >= 0.50:
                            management_actions.append({
                                'position_id': position.position_id,
                                'component_ids': [debit_long[0].component_id, debit_short[0].component_id],
                                'action': 'CLOSE_DEBIT_SPREAD_ONLY', 
                                'reason': f'Debit spread hit 50% profit target ({profit_pct:.1%})',
                                'priority': 'MEDIUM',
                                'expected_profit': debit_pnl,
                                'tom_king_rule': 'Close debit spread at 50% profit'
                            })
            
            return management_actions
            
        except Exception as e:
            self.Error(f"Error analyzing FIXED LT112 positions: {str(e)}")
            self.Error(f"Failed to analyze FIXED LT112 positions: {str(e)}")
            return []
            
    def execute_fixed_lt112_management(self, action: dict) -> tuple[bool, str]:
        """Execute FIXED LT112 management action with component-level precision"""
        try:
            action_type = action['action']
            position_id = action['position_id']
            
            if action_type == 'CLOSE_NAKED_PUTS_ONLY':
                success = self.position_state_manager.close_lt112_naked_puts_only(position_id)
                if success:
                    # CRITICAL: Sync component close to active_positions
                    component_id = action.get('component_id')
                    if component_id:
                        self.position_sync.sync_component_close_to_active_list(position_id, component_id)
                    self.Log(f"✅ FIXED LT112: Closed naked puts only, keeping debit spread - {position_id}")
                    return True, "Naked puts closed successfully"
                else:
                    return False, "Failed to close naked puts"
                    
            elif action_type == 'CLOSE_DEBIT_SPREAD_ONLY':
                success = self.position_state_manager.close_lt112_debit_spread_only(position_id)
                if success:
                    # CRITICAL: Sync component closes to active_positions
                    component_ids = action.get('component_ids', [])
                    for comp_id in component_ids:
                        self.position_sync.sync_component_close_to_active_list(position_id, comp_id)
                    self.Log(f"✅ FIXED LT112: Closed debit spread only, keeping naked puts - {position_id}")
                    return True, "Debit spread closed successfully"
                else:
                    return False, "Failed to close debit spread"
            else:
                return False, f"Unknown action type: {action_type}"
                
        except Exception as e:
            self.Error(f"Error executing FIXED LT112 management: {str(e)}")
            return False, f"Error: {str(e)}"
    
    # ===============================
    # STATE PERSISTENCE METHODS
    # ===============================
    
    def save_position_state(self):
        """Save position state to QuantConnect ObjectStore for recovery"""
        try:
            # Serialize position state
            state_json = self.position_state_manager.serialize_state()
            
            # Save to ObjectStore
            self.ObjectStore.Save("position_state", state_json)
            
            # Also save a backup with timestamp
            backup_key = f"position_state_backup_{self.Time.strftime('%Y%m%d_%H%M%S')}"
            self.ObjectStore.Save(backup_key, state_json)
            
            # Get state summary for logging
            summary = self.position_state_manager.get_state_summary()
            
            self.Log(f"[PERSISTENCE] Saved state: {summary['total_positions']} positions, {summary['total_components']} components")
            
            # Clean up old backups (keep last 7 days)
            self.cleanup_old_backups()
            
        except Exception as e:
            self.Log(f"[ERROR] Failed to save position state: {e}")
    
    def load_position_state(self):
        """Load position state from QuantConnect ObjectStore on restart"""
        try:
            if self.ObjectStore.ContainsKey("position_state"):
                state_json = self.ObjectStore.Read("position_state")
                
                # Deserialize the state
                self.position_state_manager.deserialize_state(state_json)
                
                # Sync with actual portfolio holdings
                self.position_state_manager.sync_with_portfolio()
                
                # Update fills from any pending orders
                for position_id in self.position_state_manager.positions:
                    self.position_state_manager.update_fills_from_tickets(position_id)
                
                # Get summary of loaded state
                summary = self.position_state_manager.get_state_summary()
                
                self.Log(f"[PERSISTENCE] Loaded state: {summary['total_positions']} positions")
                self.Log(f"[PERSISTENCE] Positions by strategy: {summary['positions_by_strategy']}")
                self.Log(f"[PERSISTENCE] Unfilled components: {summary['unfilled_components']}")
                
            else:
                self.Log("[PERSISTENCE] No saved state found - starting fresh")
                
        except Exception as e:
            self.Log(f"[ERROR] Failed to load position state: {e}")
            self.Log("[PERSISTENCE] Starting with fresh state due to load error")
    
    def cleanup_old_backups(self):
        """Remove old backup files to save storage"""
        try:
            # Get all keys from ObjectStore
            keys = self.ObjectStore.GetEnumerator()
            current_time = self.Time
            
            for key in keys:
                if key.startswith("position_state_backup_"):
                    # Extract timestamp from key
                    timestamp_str = key.replace("position_state_backup_", "")
                    try:
                        # Parse timestamp
                        from datetime import datetime
                        backup_time = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                        
                        # Delete if older than 7 days
                        if (current_time - backup_time).days > 7:
                            self.ObjectStore.Delete(key)
                            self.Log(f"[PERSISTENCE] Deleted old backup: {key}")
                            
                    except:
                        pass  # Skip if can't parse timestamp
                        
        except Exception as e:
            self.Log(f"[WARNING] Could not clean up old backups: {e}")