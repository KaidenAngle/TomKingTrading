# Tom King Trading Framework
# Production implementation with all strategies and risk management

from AlgorithmImports import *
from datetime import timedelta, time

# Fee models
from optimization.fee_models import TastyTradeFeeModel

# Configuration and Constants
from config.strategy_parameters import TomKingParameters
from config.constants import TradingConstants
from config.strategy_validator import StrategyValidator

# Core State Management - CRITICAL INTEGRATION
from core.unified_state_manager import UnifiedStateManager
from core.strategy_coordinator import StrategyCoordinator
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer

# Performance Optimization Systems
from core.performance_cache import HighPerformanceCache, PositionAwareCache, MarketDataCache

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
from helpers.future_options_manager import FutureOptionsManager

# Position Management
from position_state_manager import PositionStateManagerQC

# Greeks and Analytics
from greeks.greeks_monitor import GreeksMonitor

class TomKingTradingIntegrated(QCAlgorithm):
    """
    PRODUCTION-READY Tom King Trading Framework
    All safety systems integrated, state machines active, performance optimized
    """
    
    def Initialize(self):
        """Initialize with all safety systems properly wired"""
        
        # Core configuration - Using backtest config
        from config.backtest_config import BacktestConfig
        self.SetStartDate(BacktestConfig.BACKTEST_START_DATE)
        self.SetEndDate(BacktestConfig.BACKTEST_END_DATE)
        self.SetCash(BacktestConfig.STARTING_CASH)
        
        # Timezone
        self.SetTimeZone("America/New_York")
        
        # Performance optimization flags
        self.is_backtest = not self.LiveMode
        
        # Initialize performance optimizations
        self.initialize_performance_optimizations()
        
        # Initialize caching for performance
        self.last_safety_check = None
        self.last_margin_check = None
        self.last_correlation_check = None
        
        # Data resolution
        self.UniverseSettings.Resolution = Resolution.Minute
        
        # Set warmup period for indicators and data initialization
        self.SetWarmUp(timedelta(days=60))
        
        # Log mode
        self.Error(f"[STARTUP] Tom King Trading Framework - Live: {self.LiveMode}")
        
        # ======================
        # MANAGER INITIALIZATION (PROPER ORDER)
        # ======================
        
        # 1. Data Freshness - FIRST PRIORITY
        self.data_validator = DataFreshnessValidator(self)
        
        # 2. Margin Management - CRITICAL FOR POSITION SIZING
        self.margin_manager = DynamicMarginManager(self)
        
        # 3. Unified VIX Manager - MARKET REGIME DETECTION
        self.vix_manager = UnifiedVIXManager(self)
        
        # 4. Performance Tracker - OVERFLOW PROTECTED
        self.performance_tracker = SafePerformanceTracker(self)
        
        # 5. Event Calendar - REAL-TIME QUANTCONNECT API DATA
        self.event_calendar = QuantConnectEventCalendar(self)
        
        # 6. Unified State Manager - SYSTEM-WIDE STATE CONTROL
        self.state_manager = UnifiedStateManager(self)
        
        # 6.5 Order State Recovery - CRASH RECOVERY FOR MULTI-LEG ORDERS
        from helpers.order_state_recovery import OrderStateRecovery
        self.order_recovery = OrderStateRecovery(self)
        
        # 7. Position State Manager - REAL-TIME POSITION TRACKING
        self.position_state_manager = PositionStateManagerQC(self)
        
        # 8. Unified Position Sizer - DYNAMIC SIZING
        self.position_sizer = UnifiedPositionSizer(self)
        
        # 9. Greeks Monitor - RISK ANALYTICS
        self.greeks_monitor = GreeksMonitor(self)
        
        # 10. Correlation Group Limiter - PORTFOLIO RISK
        self.correlation_limiter = August2024CorrelationLimiter(self)
        
        # 11. Strategy Coordinator - MASTER CONTROL
        self.strategy_coordinator = StrategyCoordinator(self)
        
        # 12. Atomic Order Executor - BULLETPROOF ORDERS
        self.atomic_executor = EnhancedAtomicOrderExecutor(self)
        
        # 13. Option Chain Manager - OPTIMIZED OPTION DATA
        self.option_chain_manager = OptionChainManager(self)
        
        # 14. Option Order Executor - SPREAD EXECUTION
        self.option_executor = OptionOrderExecutor(self)
        
        # 15. Future Options Manager - FUTURES OPTIONS SUPPORT
        self.future_options_manager = FutureOptionsManager(self)
        
        # ======================
        # SECURITIES INITIALIZATION
        # ======================
        
        # Add equity benchmark
        spy = self.AddEquity("SPY", Resolution.Minute)
        spy.SetFeeModel(TastyTradeFeeModel())
        
        # Add VIX for volatility regime detection
        vix = self.AddIndex("VIX", Resolution.Minute)
        
        # Add core equity index options (for 0DTE and LT112)
        spy_options = self.AddOption("SPY", Resolution.Minute)
        spy_options.SetFilter(-50, 50, timedelta(0), timedelta(days=60))
        spy_options.SetFeeModel(TastyTradeFeeModel())
        
        qqq_options = self.AddOption("QQQ", Resolution.Minute) 
        qqq_options.SetFilter(-30, 30, timedelta(0), timedelta(days=60))
        qqq_options.SetFeeModel(TastyTradeFeeModel())
        
        iwm_options = self.AddOption("IWM", Resolution.Minute)
        iwm_options.SetFilter(-20, 20, timedelta(0), timedelta(days=60))
        iwm_options.SetFeeModel(TastyTradeFeeModel())
        
        # Add core futures for futures strangles
        es_future = self.AddFuture("ES", Resolution.Minute)
        es_future.SetFilter(timedelta(0), timedelta(days=90))
        es_future.SetFeeModel(TastyTradeFeeModel())
        
        # Add futures options if supported
        es_option_info = self.future_options_manager.add_future_option_safely(
            "ES", 
            lambda u: u.Strikes(-20, 20).Expiration(timedelta(0), timedelta(days=90))
        )
        
        nq_future = self.AddFuture("NQ", Resolution.Minute)
        nq_future.SetFilter(timedelta(0), timedelta(days=90))  
        nq_future.SetFeeModel(TastyTradeFeeModel())
        
        nq_option_info = self.future_options_manager.add_future_option_safely(
            "NQ",
            lambda u: u.Strikes(-10, 10).Expiration(timedelta(0), timedelta(days=90))
        )
        
        # ======================
        # STRATEGY INITIALIZATION
        # ======================
        
        # Initialize all strategies with state machines
        self.strategies = {
            "0DTE": Friday0DTEWithState(self),
            "LT112": LT112WithState(self), 
            "IPMCC": IPMCCWithState(self),
            "FuturesStrangle": FuturesStrangleWithState(self),
            "LEAPLadders": LEAPPutLaddersWithState(self)
        }
        
        # Register strategies with coordinator
        from core.strategy_coordinator import StrategyPriority
        strategy_priorities = {
            '0DTE': StrategyPriority.HIGH,         # Friday 0DTE - highest priority
            'LT112': StrategyPriority.MEDIUM,     # Monthly LT112
            'IPMCC': StrategyPriority.MEDIUM,     # Regular PMCC management  
            'FuturesStrangle': StrategyPriority.MEDIUM,  # Regular futures strategy
            'LEAPLadders': StrategyPriority.LOW   # Long-term position management
        }
        
        for name, strategy in self.strategies.items():
            self.state_manager.register_strategy(name, strategy.state_machine)
            priority = strategy_priorities.get(name, StrategyPriority.MEDIUM)
            self.strategy_coordinator.register_strategy(name, priority=priority)
            self.Error(f"[MAIN] REGISTERED STRATEGY: {name} with priority {priority}")
        
        # ======================
        # CIRCUIT BREAKERS
        # ======================
        
        self.circuit_breakers = {
            'rapid_drawdown': {'threshold': -0.03, 'window': timedelta(minutes=5)},
            'correlation_spike': {'threshold': 0.90},
            'margin_spike': {'threshold': 0.80},
            'consecutive_losses': {'threshold': 3}
        }
        
        # ======================
        # ORDER RECOVERY AND MANUAL INTERVENTION
        # ======================
        
        # Check for incomplete multi-leg orders on startup
        if hasattr(self, 'order_recovery'):
            try:
                incomplete_orders = self.order_recovery.scan_incomplete_orders()
                if incomplete_orders:
                    self.Error(f"[STARTUP] Found {len(incomplete_orders)} incomplete orders requiring review")
                    for order_id, details in incomplete_orders.items():
                        self.Error(f"  Order {order_id}: {details['status']} - {details['description']}")
                
                # Check for manual intervention requirements
                manual_intervention = self.order_recovery.check_manual_intervention_required()
                if manual_intervention:
                    self.Error(f"MANUAL INTERVENTION REQUIRED: {len(manual_intervention)} incomplete order groups")
                    for issue in manual_intervention:
                        self.Error(f"  - {issue['group_id']}: {issue['issue']}")
            except Exception as e:
                self.Error(f"[STARTUP] Order recovery check failed: {e}")
        
        # ======================
        # INTEGRATION VERIFICATION (MANDATORY)
        # ======================
        
        verification_result = self.run_complete_integration_verification()
        
        if not verification_result:
            raise ValueError("Integration verification failed - algorithm cannot trade safely")
        
        # Always log successful initialization 
        if not self.is_backtest:
            self.Debug("=== TOM KING TRADING FRAMEWORK INITIALIZED ===")
            self.Debug("All safety systems: ACTIVE")
            self.Debug("Integration verification: PASSED")
        
        self.Error("[PRODUCTION] Tom King Trading Framework initialized successfully")
        self.Error("[PRODUCTION] All performance optimizations active")
    
    def initialize_performance_optimizations(self):
        """Initialize all performance optimization systems"""
        try:
            # High-performance caching systems
            self.main_cache = HighPerformanceCache(
                self, 
                max_size=2000,
                ttl_minutes=5,
                max_memory_mb=100
            )
            
            self.position_cache = PositionAwareCache(
                self,
                max_size=500, 
                ttl_minutes=2,
                max_memory_mb=25
            )
            
            self.market_cache = MarketDataCache(
                self,
                price_change_threshold=0.001,
                max_size=1000,
                ttl_minutes=1,
                max_memory_mb=50
            )
            
            # Performance tracking flags
            self.last_cache_maintenance = self.Time
            self.cache_maintenance_interval = timedelta(minutes=15)
            
            if not self.is_backtest:
                self.Debug("[PERFORMANCE] High-performance caching systems initialized")
                
        except Exception as e:
            self.Error(f"[PERFORMANCE] Cache initialization failed: {e}")
    
    def verify_manager_initialization(self) -> bool:
        """Verify all required managers are properly initialized"""
        required_managers = [
            ('margin_manager', 'DynamicMarginManager'),
            ('vix_manager', 'UnifiedVIXManager'),
            ('state_manager', 'UnifiedStateManager'),
            ('position_sizer', 'UnifiedPositionSizer'),
            ('greeks_monitor', 'GreeksMonitor')
        ]
        
        verification_results = {}
        
        for manager_name, expected_class in required_managers:
            # Check if manager exists
            has_manager = hasattr(self, manager_name)
            verification_results[f"{manager_name}_exists"] = has_manager
            
            if has_manager:
                manager = getattr(self, manager_name)
                # Check type (class name verification)
                correct_type = expected_class in str(type(manager))
                verification_results[f"{manager_name}_type"] = correct_type
                
                # Check not None
                not_none = manager is not None
                verification_results[f"{manager_name}_not_none"] = not_none
                
                if not (correct_type and not_none):
                    self.Error(f"[Integration] Manager verification failed: {manager_name}")
        
        # Check results
        failed_checks = [k for k, v in verification_results.items() if not v]
        
        if failed_checks:
            self.Error(f"[Integration] Failed manager checks: {failed_checks}")
            return False
        
        return True
    
    def verify_strategy_loading(self) -> bool:
        """Verify all strategies loaded properly with state machines"""
        required_strategies = [
            '0DTE', 'LT112', 'IPMCC', 'FuturesStrangle', 'LEAPLadders'
        ]
        
        verification_results = {}
        
        for strategy_key in required_strategies:
            # Check if strategy exists
            has_strategy = strategy_key in self.strategies
            verification_results[f"{strategy_key}_exists"] = has_strategy
            
            if has_strategy:
                strategy = self.strategies[strategy_key]
                # Check strategy type
                correct_type = hasattr(strategy, '__class__') and 'WithState' in strategy.__class__.__name__
                verification_results[f"{strategy_key}_type"] = correct_type
                
                # Check state machine
                has_state_machine = hasattr(strategy, 'state_machine')
                verification_results[f"{strategy_key}_state_machine"] = has_state_machine
                
                # Check required methods
                required_methods = ['should_enter_position', 'enter_position']
                for method in required_methods:
                    has_method = hasattr(strategy, method)
                    verification_results[f"{strategy_key}.{method}"] = has_method
        
        # Summary
        passed_checks = sum(1 for v in verification_results.values() if v)
        total_expected = len(required_strategies) * 4  # Each strategy has 4 checks + methods
        
        self.Debug(f"[Integration] Strategy verification: {passed_checks}/{total_expected}")
        
        # Check for failures
        failed_checks = [k for k, v in verification_results.items() if not v]
        
        if failed_checks:
            self.Error(f"[Integration] Failed strategy checks: {failed_checks}")
            return False
        
        return True
    
    def verify_critical_methods(self) -> bool:
        """Verify all critical methods exist and are callable"""
        
        # Define critical methods that integration verification requires
        critical_method_map = {
            'margin_manager': ['get_available_buying_power', 'calculate_required_margin'],
            'state_manager': ['get_system_state'],
            'position_sizer': ['get_max_position_size'], 
            'greeks_monitor': ['get_portfolio_greeks', 'calculate_position_greeks']
        }
        
        verification_results = {}
        
        for manager_name, methods in critical_method_map.items():
            if hasattr(self, manager_name):
                manager = getattr(self, manager_name)
                
                for method_name in methods:
                    # Check if method exists
                    has_method = hasattr(manager, method_name)
                    verification_results[f"{manager_name}.{method_name}"] = has_method
                    
                    if has_method:
                        # Check method is callable
                        method = getattr(manager, method_name)
                        is_callable = callable(method)
                        verification_results[f"{manager_name}.{method_name}_callable"] = is_callable
                        
                        if not is_callable:
                            self.Error(f"[Integration] Method not callable: {manager_name}.{method_name}")
                    else:
                        self.Error(f"[Integration] Missing method: {manager_name}.{method_name}")
            else:
                self.Error(f"[Integration] Manager not found for method check: {manager_name}")
        
        # Check results
        failed_methods = [k for k, v in verification_results.items() if not v]
        
        if failed_methods:
            self.Error(f"[Integration] Failed method verifications: {failed_methods}")
            return False
        
        return True
    
    def run_complete_integration_verification(self) -> bool:
        """Run complete integration verification suite"""
        
        verification_stages = [
            ("Manager Initialization", self.verify_manager_initialization),
            ("Strategy Loading", self.verify_strategy_loading), 
            ("Critical Methods", self.verify_critical_methods)
        ]
        
        results = {}
        
        for stage_name, verification_func in verification_stages:
            try:
                result = verification_func()
                results[stage_name] = result
                
                status = "PASS" if result else "FAIL"
                if not self.is_backtest:
                    self.Debug(f"[Integration] {stage_name}: {status}")
                
            except Exception as e:
                self.Error(f"[Integration] {stage_name} verification error: {e}")
                results[stage_name] = False
        
        # Final summary
        passed_stages = sum(1 for r in results.values() if r)
        total_stages = len(results)
        
        if passed_stages == total_stages:
            if not self.is_backtest:
                self.Log(f"[Integration] COMPLETE SUCCESS: {passed_stages}/{total_stages} stages passed")
            return True
        else:
            self.Error(f"[Integration] VERIFICATION FAILED: {passed_stages}/{total_stages} stages passed")
            
            # List failed stages
            failed_stages = [name for name, result in results.items() if not result]
            self.Error(f"[Integration] Failed stages: {failed_stages}")
            
            return False
    
    def OnData(self, data):
        """Main data handler with full safety integration"""
        
        # Conditional OnData logging for performance
        if not self.is_backtest or self.Time.hour == 9 and self.Time.minute < 5:
            self.Debug(f"[MINIMAL] OnData called at {self.Time} - data keys: {list(data.Keys)}")
        
        # ======================
        # PERFORMANCE CACHING
        # ======================
        
        # Periodic cache maintenance
        if (self.Time - self.last_cache_maintenance) > self.cache_maintenance_interval:
            self.maintain_caches()
            self.last_cache_maintenance = self.Time
        
        # ======================
        # DATA VALIDATION
        # ======================
        
        if not self.data_validator.is_data_fresh(data):
            return
        
        # ======================
        # VIX AND MARKET REGIME
        # ======================
        
        current_vix = self.vix_manager.get_current_vix()
        market_regime = self.vix_manager.get_market_regime()
        
        # ======================
        # STRATEGY EXECUTION
        # ======================
        
        # Update all state machines first
        self.state_manager.update_all_state_machines(data)
        
        # Execute strategies through coordinator
        self.strategy_coordinator.execute_strategies(data, {
            'vix': current_vix,
            'regime': market_regime,
            'time': self.Time
        })
        
        # ======================
        # RISK MANAGEMENT
        # ======================
        
        # Check circuit breakers
        self.check_circuit_breakers()
        
        # Update Greeks and portfolio risk
        if self.Time.minute % 15 == 0:  # Every 15 minutes
            self.greeks_monitor.update_portfolio_greeks()
            
        # Check correlation limits
        if self.Time.minute % 30 == 0:  # Every 30 minutes
            self.correlation_limiter.check_and_enforce_limits()
    
    def maintain_caches(self):
        """Perform cache maintenance for optimal performance"""
        try:
            # Run periodic maintenance on all caches
            self.main_cache.periodic_maintenance()
            self.position_cache.periodic_maintenance()
            self.market_cache.periodic_maintenance()
            
            # Log cache statistics periodically (every hour in backtest)
            if not self.is_backtest or self.Time.minute == 0:
                self.main_cache.log_stats()
                
        except Exception as e:
            self.Error(f"[CACHE] Maintenance error: {e}")
    
    def check_circuit_breakers(self):
        """Check all circuit breaker conditions"""
        
        # Rapid drawdown check
        if self.performance_tracker.get_current_drawdown() < self.circuit_breakers['rapid_drawdown']['threshold']:
            self.state_manager.trigger_emergency_halt("Rapid drawdown detected")
        
        # Margin spike check  
        margin_usage = self.margin_manager.get_margin_usage()
        if margin_usage > self.circuit_breakers['margin_spike']['threshold']:
            self.state_manager.trigger_emergency_halt("Margin usage too high")
        
        # Correlation spike check
        max_correlation = self.correlation_limiter.get_max_correlation()
        if max_correlation > self.circuit_breakers['correlation_spike']['threshold']:
            self.state_manager.trigger_emergency_halt("Correlation spike detected")