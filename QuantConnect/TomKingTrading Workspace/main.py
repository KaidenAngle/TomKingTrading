# Tom King Trading Framework
# Production implementation with all strategies and risk management

from AlgorithmImports import *
from datetime import timedelta, time

# Fee models
from fee_models import TastyTradeFeeModel

# Configuration and Constants
from config.strategy_parameters import TomKingParameters
from config.constants import TradingConstants
from config.strategy_validator import StrategyValidator

# Core State Management - CRITICAL INTEGRATION
from core.unified_state_manager import UnifiedStateManager
from core.strategy_coordinator import StrategyCoordinator
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer

# State Machine Strategies - NEW IMPLEMENTATIONS
from strategies.friday_0dte_with_state import Friday0DTEWithState
from strategies.lt112_with_state import LT112WithState
from strategies.ipmcc_with_state import IPMCCWithState
from strategies.futures_strangle_with_state import FuturesStrangleWithState
from strategies.leap_put_ladders_with_state import LEAPPutLaddersWithState

# Risk Management
# VIX management now handled by UnifiedVIXManager
from risk.dynamic_margin_manager import DynamicMarginManager
from risk.correlation_group_limiter import August2024CorrelationLimiter

# Helpers and Safety Systems
from helpers.data_freshness_validator import DataFreshnessValidator
from helpers.performance_tracker_safe import SafePerformanceTracker
from helpers.quantconnect_event_calendar import QuantConnectEventCalendar
from helpers.option_chain_manager import OptionChainManager
from helpers.option_order_executor import OptionOrderExecutor
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor

# Position Management
from position_state_manager import QuantConnectPositionStateManager

# Greeks and Analytics
from greeks.greeks_monitor import GreeksMonitor

class TomKingTradingIntegrated(QCAlgorithm):
    """
    PRODUCTION-READY Tom King Trading Framework
    All safety systems integrated, state machines active
    """
    
    def Initialize(self):
        """Initialize with all safety systems properly wired"""
        
        # Core configuration - Using backtest config
        from config.backtest_config import BacktestConfig
        self.SetStartDate(BacktestConfig.BACKTEST_START_DATE)
        self.SetEndDate(BacktestConfig.BACKTEST_END_DATE)
        self.SetCash(BacktestConfig.STARTING_CASH)  # $30,000 for faster backtesting
        
        # Timezone
        self.SetTimeZone("America/New_York")
        
        # Set brokerage model for proper API initialization
        # Using Default model since Tastytrade is handled via custom API client
        from AlgorithmImports import BrokerageModel, BrokerageModelSecurityInitializer, FuncSecuritySeeder
        self.SetBrokerageModel(BrokerageModel.Default)
        
        # Set security initializer to properly configure securities when added
        self.SetSecurityInitializer(
            BrokerageModelSecurityInitializer(
                self.BrokerageModel, 
                FuncSecuritySeeder(self.GetLastKnownPrices)
            )
        )
        
        # Performance optimization flag
        self.is_backtest = not self.LiveMode
        
        # Data resolution
        self.UniverseSettings.Resolution = Resolution.Minute
        
        # Set warmup period for indicators and data initialization
        self.SetWarmUp(timedelta(days=30))
        
        # Add core symbols
        self.spy = self.AddEquity("SPY", Resolution.Minute).Symbol
        self.vix = self.AddIndex("VIX", Resolution.Minute).Symbol
        
        # Options configuration with Tastytrade fee model
        option = self.AddOption("SPY", Resolution.Minute)
        option.SetFilter(lambda x: x.Strikes(-50, 50)
                                   .Expiration(timedelta(0), timedelta(180)))
        
        # Set Tastytrade fee model for all securities
        for security in self.Securities.Values:
            security.SetFeeModel(TastyTradeFeeModel())
        
        # ======================
        # CRITICAL SAFETY SYSTEMS
        # ======================
        
        # 1. Data Freshness Validator - PREVENTS STALE DATA TRADING
        self.data_validator = DataFreshnessValidator(self)
        
        # 2. Dynamic Margin Manager - VIX-BASED MARGIN CONTROL
        self.margin_manager = DynamicMarginManager(self)
        
        # 3. Strategy Coordinator - PRIORITY EXECUTION QUEUE
        self.strategy_coordinator = StrategyCoordinator(self)
        
        # 3.5 SPY Concentration Manager - PREVENT OVER-EXPOSURE
        from core.spy_concentration_manager import SPYConcentrationManager
        self.spy_concentration_manager = SPYConcentrationManager(self)
        
        # 4. Performance Tracker - OVERFLOW PROTECTED
        self.performance_tracker = SafePerformanceTracker(self)
        
        # 5. Event Calendar - REAL-TIME QUANTCONNECT API DATA
        self.event_calendar = QuantConnectEventCalendar(self)
        
        # 6. Unified State Manager - SYSTEM-WIDE STATE CONTROL
        self.state_manager = UnifiedStateManager(self)
        
        # 6.5 Order State Recovery - CRASH RECOVERY FOR MULTI-LEG ORDERS
        from helpers.order_state_recovery import OrderStateRecovery
        self.order_recovery = OrderStateRecovery(self)
        
        # ======================
        # RISK MANAGEMENT
        # ======================
        
        # Unified VIX Manager - Single source of truth
        self.vix_manager = UnifiedVIXManager(self)
        
        # Unified Position Sizer - Single source of truth
        self.position_sizer = UnifiedPositionSizer(self)
        
        # Correlation Limiter
        self.correlation_limiter = August2024CorrelationLimiter(self)
        
        # Position Manager
        self.position_manager = QuantConnectPositionStateManager(self)
        
        # Greeks Monitor
        self.greeks_monitor = GreeksMonitor(self)
        
        # ======================
        # HELPER SYSTEMS
        # ======================
        
        # Option chain manager
        self.option_chain_manager = OptionChainManager(self)
        
        # Order executor
        self.order_executor = OptionOrderExecutor(self)
        
        # Atomic order executor for multi-leg strategies
        self.atomic_executor = EnhancedAtomicOrderExecutor(self)
        
        # Unified order pricing - Single source for limit order pricing
        from helpers.unified_order_pricing import UnifiedOrderPricing
        self.unified_pricing = UnifiedOrderPricing(self)
        
        # Strategy validator
        self.strategy_validator = StrategyValidator(self)
        
        # ======================
        # STATE MACHINE STRATEGIES
        # ======================
        
        # Initialize strategies with state machines
        self.strategies = {
            '0DTE': Friday0DTEWithState(self),
            'LT112': LT112WithState(self),
            'IPMCC': IPMCCWithState(self),
            'FuturesStrangle': FuturesStrangleWithState(self),
            'LEAPLadders': LEAPPutLaddersWithState(self)
        }
        
        # Register all strategies with state manager
        for name, strategy in self.strategies.items():
            self.state_manager.register_strategy(name, strategy.state_machine)
            self.strategy_coordinator.register_strategy(name, priority=strategy.priority)
        
        # ======================
        # CIRCUIT BREAKERS
        # ======================
        
        self.circuit_breakers = {
            'rapid_drawdown': {'threshold': -0.03, 'window': timedelta(minutes=5)},
            'correlation_spike': {'threshold': 0.90},
            'margin_spike': {'threshold': 0.80},
            'consecutive_losses': {'threshold': 3}
        }
        
        self.drawdown_window = []
        self.consecutive_losses = 0
        
        # ======================
        # TRACKING VARIABLES
        # ======================
        
        self.last_option_check = self.Time
        self.option_check_interval = timedelta(minutes=15)
        
        self.trades_today = 0
        self.daily_trade_limit = 10
        
        self.current_phase = 1  # Start in Phase 1
        
        # Performance tracking
        self.winning_trades = 0
        self.losing_trades = 0
        self.total_pnl = 0
        
        # Performance optimization: Track invested positions
        self.invested_positions = set()
        
        # ======================
        # SCHEDULING
        # ======================
        
        # Schedule regular safety checks (less frequent in backtest)
        safety_check_interval = 30 if self.is_backtest else 5
        self.Schedule.On(
            self.DateRules.EveryDay(self.spy),
            self.TimeRules.Every(timedelta(minutes=safety_check_interval)),
            self.SafetyCheck
        )
        
        # Schedule state persistence at end of day
        self.Schedule.On(
            self.DateRules.EveryDay(self.spy),
            self.TimeRules.At(15, 45),  # End of day persistence
            self.PersistStates
        )
        
        # Schedule EOD reconciliation
        self.Schedule.On(
            self.DateRules.EveryDay(self.spy),
            self.TimeRules.At(15, 45),
            self.EndOfDayReconciliation
        )
        
        # Load any saved states
        self.state_manager.load_all_states()
        
        # Check for incomplete orders from previous session
        if hasattr(self, 'order_recovery'):
            manual_intervention = self.order_recovery.check_and_recover_incomplete_orders()
            if manual_intervention:
                self.Error(f"MANUAL INTERVENTION REQUIRED: {len(manual_intervention)} incomplete order groups")
                for issue in manual_intervention:
                    self.Error(f"  - {issue['group_id']}: {issue['issue']}")
        
        self.Debug("=== TOM KING TRADING FRAMEWORK INITIALIZED ===")
        self.Debug("All safety systems: ACTIVE")
        self.Debug("State machines: REGISTERED")
        self.Debug("Circuit breakers: ARMED")
    
    def OnData(self, data):
        """Main data handler with full safety integration"""
        
        # ======================
        # PERFORMANCE CACHING
        # ======================
        
        # Cache frequently accessed values for this cycle
        self.current_portfolio_value = self.Portfolio.TotalPortfolioValue
        self.current_margin_used = self.Portfolio.TotalMarginUsed
        self.current_margin_remaining = self.Portfolio.MarginRemaining
        
        # Cache current prices
        self.current_prices = {}
        for symbol in [self.spy, self.vix]:
            if symbol in self.Securities:
                self.current_prices[symbol] = self.Securities[symbol].Price
        
        # Initialize option chain cache if needed (time-based expiry)
        if not hasattr(self, 'option_chain_cache'):
            self.option_chain_cache = {}
            self.option_cache_expiry = {}
        
        # ======================
        # SAFETY CHECKS FIRST
        # ======================
        
        # 1. Validate data freshness
        if not self.data_validator.validate_all_data():
            self.Debug("Data validation failed, skipping cycle")
            return
        
        # 2. Check circuit breakers
        if self._check_circuit_breakers():
            self.Debug("Circuit breaker triggered, halting trading")
            self.state_manager.halt_all_trading("Circuit breaker triggered")
            return
        
        # 3. Update system state
        self.state_manager.update_system_state()
        
        # 4. Check if we can trade
        if not self.IsMarketOpen(self.spy):
            return
        
        # 5. Check margin availability
        if not self.margin_manager.check_margin_available():
            self.Debug("Insufficient margin, skipping cycle")
            return
        
        # 6. Check correlation limits
        if self.correlation_limiter.positions_at_limit():
            self.Debug("Correlation limit reached")
            return
        
        # ======================
        # STRATEGY EXECUTION
        # ======================
        
        # Update VIX status (only log periodically to avoid overhead)
        if not self.is_backtest or self.Time.minute % 30 == 0:
            if hasattr(self.vix_manager, 'log_vix_status'):
                self.vix_manager.log_vix_status()
        
        # Update Greeks (only when positions change)
        if hasattr(self, 'greeks_monitor') and hasattr(self.greeks_monitor, 'update'):
            self.greeks_monitor.update()
        
        # Get execution order from coordinator
        execution_order = self.strategy_coordinator.get_execution_order()
        
        for strategy_name in execution_order:
            # Check if strategy can execute
            if not self.state_manager.can_enter_new_position(strategy_name):
                continue
            
            # Check daily trade limit
            if self.trades_today >= self.daily_trade_limit:
                self.Debug("Daily trade limit reached")
                break
            
            # Check strategy-specific conditions
            strategy = self.strategies.get(strategy_name)
            if strategy:
                try:
                    # Execute through state machine
                    strategy.execute()
                    
                    # Update coordinator
                    self.strategy_coordinator.record_execution(strategy_name)
                    
                except Exception as e:
                    self.Error(f"Strategy {strategy_name} error: {e}")
                    self.state_manager.force_strategy_exit(strategy_name, str(e))
        
        # ======================
        # POSITION MANAGEMENT
        # ======================
        
        # Check existing positions
        self._manage_existing_positions()
        
        # Update performance tracking
        self.performance_tracker.update()
    
    def _check_circuit_breakers(self) -> bool:
        """Check all circuit breakers"""
        
        # Rapid drawdown check
        current_value = self.Portfolio.TotalPortfolioValue
        self.drawdown_window.append((self.Time, current_value))
        
        # Remove old entries
        cutoff_time = self.Time - self.circuit_breakers['rapid_drawdown']['window']
        self.drawdown_window = [(t, v) for t, v in self.drawdown_window if t > cutoff_time]
        
        if len(self.drawdown_window) > 1:
            max_value = max(v for _, v in self.drawdown_window)
            drawdown = (current_value - max_value) / max_value if max_value > 0 else 0
            
            if drawdown < self.circuit_breakers['rapid_drawdown']['threshold']:
                self.Error(f"CIRCUIT BREAKER: Rapid drawdown {drawdown:.2%}")
                return True
        
        # Correlation spike check
        if hasattr(self, 'correlation_limiter'):
            if self.correlation_limiter.get_max_correlation() > self.circuit_breakers['correlation_spike']['threshold']:
                self.Error("CIRCUIT BREAKER: Correlation spike")
                return True
        
        # Margin spike check
        margin_usage = self.Portfolio.TotalMarginUsed / self.Portfolio.TotalPortfolioValue if self.Portfolio.TotalPortfolioValue > 0 else 0
        if margin_usage > self.circuit_breakers['margin_spike']['threshold']:
            self.Error(f"CIRCUIT BREAKER: Margin spike {margin_usage:.2%}")
            return True
        
        # Consecutive losses check
        if self.consecutive_losses >= self.circuit_breakers['consecutive_losses']['threshold']:
            self.Error(f"CIRCUIT BREAKER: {self.consecutive_losses} consecutive losses")
            return True
        
        return False
    
    def _manage_existing_positions(self):
        """Manage all existing positions"""
        
        for symbol in self.Portfolio.Keys:
            holding = self.Portfolio[symbol]
            
            if holding.Invested and symbol.SecurityType == SecurityType.Option:
                # Let strategies manage their own positions through state machines
                strategy_name = self.position_manager.get_strategy_for_symbol(symbol)
                
                if strategy_name and strategy_name in self.strategies:
                    strategy = self.strategies[strategy_name]
                    strategy.check_position_management()
    
    def SafetyCheck(self):
        """Regular safety check routine"""
        
        self.Debug("=== SAFETY CHECK ===")
        
        # Check data feeds
        data_status = self.data_validator.get_status()
        self.Debug(f"Data feeds: {data_status}")
        
        # Check margin
        margin_status = self.margin_manager.get_margin_status()
        self.Debug(f"Margin: {margin_status['usage_pct']:.1%} used")
        
        # Check correlations
        max_corr = self.correlation_limiter.get_max_correlation()
        self.Debug(f"Max correlation: {max_corr:.2f}")
        
        # Check state machines
        state_dashboard = self.state_manager.get_dashboard()
        self.Debug(f"Active strategies: {state_dashboard['active_strategies']}/{state_dashboard['total_strategies']}")
        
        # Check for stuck positions
        for name, strategy in self.strategies.items():
            if hasattr(strategy, 'check_health'):
                health = strategy.check_health()
                if not health['healthy']:
                    self.Error(f"Strategy {name} unhealthy: {health['reason']}")
    
    def PersistStates(self):
        """Persist all state machines"""
        
        self.state_manager.save_all_states()
        self.Debug("States persisted to ObjectStore")
    
    def EndOfDayReconciliation(self):
        """End of day reconciliation and reporting"""
        
        self.Debug("=== END OF DAY RECONCILIATION ===")
        
        # Performance summary
        daily_pnl = self.performance_tracker.get_daily_pnl()
        self.Debug(f"Daily P&L: ${daily_pnl:.2f}")
        self.Debug(f"Win rate: {self.winning_trades}/{self.winning_trades + self.losing_trades}")
        
        # Position summary
        open_positions = self.state_manager.get_active_strategies()
        self.Debug(f"Open positions: {open_positions}")
        
        # Risk summary
        portfolio_greeks = self.greeks_monitor.get_portfolio_greeks()
        self.Debug(f"Portfolio Greeks: Delta={portfolio_greeks['delta']:.2f}, Gamma={portfolio_greeks['gamma']:.4f}")
        
        # Reset daily counters
        self.trades_today = 0
        self.consecutive_losses = 0 if daily_pnl > 0 else self.consecutive_losses
        
        # Check for phase advancement
        self._check_phase_advancement()
    
    def _check_phase_advancement(self):
        """Check if ready to advance to next phase"""
        
        # Simple phase advancement based on performance
        total_trades = self.winning_trades + self.losing_trades
        
        if total_trades >= 20:  # Minimum trades for phase advancement
            win_rate = self.winning_trades / total_trades if total_trades > 0 else 0
            
            if self.current_phase == 1 and win_rate > 0.60:
                self.current_phase = 2
                self.Debug("ADVANCED TO PHASE 2")
            elif self.current_phase == 2 and win_rate > 0.65 and total_trades >= 50:
                self.current_phase = 3
                self.Debug("ADVANCED TO PHASE 3")
            elif self.current_phase == 3 and win_rate > 0.70 and total_trades >= 100:
                self.current_phase = 4
                self.Debug("ADVANCED TO PHASE 4")
    
    def OnOrderEvent(self, orderEvent):
        """Handle order events with safety checks"""
        
        if orderEvent.Status == OrderStatus.Filled:
            # Update trades today
            self.trades_today += 1
            
            # Track performance
            symbol = orderEvent.Symbol
            fill_price = orderEvent.FillPrice
            quantity = orderEvent.FillQuantity
            
            # Let performance tracker handle it
            self.performance_tracker.record_trade(orderEvent)
            
            # Update invested positions tracking for performance
            if self.Portfolio[symbol].Quantity != 0:
                self.invested_positions.add(symbol)
            else:
                self.invested_positions.discard(symbol)
            
            # Persist states on position changes (more important than time-based)
            self.PersistStates()
            
            # Update consecutive losses if needed
            if orderEvent.Direction == OrderDirection.Sell and quantity < 0:
                # Opening position
                pass
            elif orderEvent.Direction == OrderDirection.Buy and quantity > 0:
                # Closing position - check P&L
                pnl = self.position_manager.calculate_position_pnl(symbol)
                
                if pnl < 0:
                    self.consecutive_losses += 1
                else:
                    self.consecutive_losses = 0
    
    def GetCachedOptionChain(self, symbol):
        """Get option chain with time-based caching to avoid duplicate API calls"""
        # Check if cache exists and is still fresh (5-minute expiry)
        cache_duration = timedelta(minutes=5)
        
        if (symbol not in self.option_chain_cache or 
            symbol not in self.option_cache_expiry or
            self.Time > self.option_cache_expiry[symbol]):
            
            # Fetch fresh option chain
            self.option_chain_cache[symbol] = self.OptionChainProvider.GetOptionContractList(symbol, self.Time)
            self.option_cache_expiry[symbol] = self.Time + cache_duration
            
        return self.option_chain_cache[symbol]
    
    def OnEndOfAlgorithm(self):
        """Clean shutdown with state persistence"""
        
        self.Debug("=== ALGORITHM SHUTDOWN ===")
        
        # Shutdown state manager
        self.state_manager.shutdown()
        
        # Final performance report
        self.performance_tracker.generate_final_report()
        
        # Save final states
        self.PersistStates()
        
        self.Debug("Shutdown complete")