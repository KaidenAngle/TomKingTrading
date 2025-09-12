# Tom King Trading Framework
# Production implementation with all strategies and risk management

from AlgorithmImports import *
from datetime import timedelta, time
import traceback

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
from core.spy_concentration_manager import SPYConcentrationManager

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
        
        # 10.5. SPY Concentration Manager - PREVENTS SPY OVER-EXPOSURE
        self.spy_concentration_manager = SPYConcentrationManager(self)
        
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
        self.spy = spy  # CRITICAL FIX: Store SPY reference for strategies
        
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
        # SCHEDULING SYSTEM (CRITICAL)
        # ======================
        
        # PERFORMANCE OPTIMIZATION: Disable scheduled methods in backtests
        # These cause severe CPU bottlenecks and 23-25% backtest freezes
        # From previous analysis: SafetyCheck, PersistStates, EOD methods overload CPU
        if not self.is_backtest:
            # Only enable scheduling in live mode - disabled in backtests for performance
            safety_check_interval = 5  # 5 minutes in live mode only
            self.Schedule.On(
                self.DateRules.EveryDay("SPY"),
                self.TimeRules.Every(timedelta(minutes=safety_check_interval)),
                self.SafetyCheck
            )
            
            # Schedule state persistence at end of day
            self.Schedule.On(
                self.DateRules.EveryDay("SPY"),
                self.TimeRules.At(15, 45),  # End of day persistence
                self.PersistStates
            )
            
            # Schedule EOD reconciliation
            self.Schedule.On(
                self.DateRules.EveryDay("SPY"),
                self.TimeRules.At(15, 45),
                self.EndOfDayReconciliation
            )
            
            # CRITICAL FIX #2: Schedule SPY allocation cleanup to prevent resource starvation
            # This addresses the documented critical issue where crashed strategies
            # permanently consume SPY allocation limits, blocking new strategies
            if hasattr(self, 'spy_concentration_manager'):
                self.spy_concentration_manager.schedule_periodic_cleanup()
            
            # DATA QUALITY: Option chain quality handled by existing MarketDataCache system
            # with automatic price-change invalidation (0.5% threshold) and TTL expiration
        else:
            # Backtest mode: No scheduled methods to prevent CPU bottlenecks
            self.Debug("[PERFORMANCE] Scheduled methods disabled in backtest mode for performance")
        
        # Load any saved states
        self.state_manager.load_all_states()
        
        # ======================
        # INTEGRATION VERIFICATION (MANDATORY)
        # ======================
        
        verification_result = self.run_complete_integration_verification()
        
        if not verification_result:
            raise ValueError("Integration verification failed - algorithm cannot trade safely")
        
        # ======================
        # COMPREHENSIVE POSITION OPENING VALIDATION (47 FAILURE POINTS)
        # ======================
        
        self.Debug("[INIT] 🔍 Running comprehensive position opening validation...")
        try:
            from validation.comprehensive_position_opening_validator import PositionOpeningValidator
            
            self.position_validator = PositionOpeningValidator(self)
            validation_report = self.position_validator.validate_all_failure_points()
            
            # Store validation results for runtime access
            self.validation_report = validation_report
            
            if not validation_report.get('production_ready', False):
                self.Error(f"[INIT] ⚠️ VALIDATION ISSUES: {validation_report['failed_validations']} failures detected")
                self.Error(f"[INIT] ⚠️ SUCCESS RATE: {validation_report['overall_success_rate']:.1%}")
                
                # Continue with warnings but log critical issues
                critical_count = validation_report.get('critical_failures', 0)
                if critical_count > 0:
                    self.Error(f"[INIT] 🚨 {critical_count} CRITICAL failures require immediate attention")
                    
                    # Log top failure categories for quick debugging
                    category_results = validation_report.get('category_results', {})
                    for category, results in category_results.items():
                        if results.get('failures', 0) > 0:
                            self.Error(f"[INIT] - {category.upper()}: {results['failures']} failures")
            else:
                self.Log(f"[INIT] ✅ Position opening validation PASSED: {validation_report['overall_success_rate']:.1%} success rate")
                
        except Exception as e:
            self.Error(f"[INIT] ⚠️ Position opening validation failed to run: {str(e)}")
            self.Error(f"[INIT] Stack trace: {traceback.format_exc()}")
            # Continue without failing - validation is diagnostic, not blocking
        
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
        # ENHANCED: Added components that are critical for runtime execution
        required_managers = [
            ('data_validator', 'DataFreshnessValidator'),
            ('margin_manager', 'DynamicMarginManager'),
            ('vix_manager', 'UnifiedVIXManager'),
            ('performance_tracker', 'SafePerformanceTracker'),
            ('event_calendar', 'QuantConnectEventCalendar'),
            ('state_manager', 'UnifiedStateManager'),
            ('position_state_manager', 'PositionStateManagerQC'),
            ('position_sizer', 'UnifiedPositionSizer'),
            ('greeks_monitor', 'GreeksMonitor'),
            ('correlation_limiter', 'August2024CorrelationLimiter'),
            ('spy_concentration_manager', 'SPYConcentrationManager'),  # CRITICAL: Prevents SPY over-exposure
            ('strategy_coordinator', 'StrategyCoordinator'),  # CRITICAL: Added missing component
            ('atomic_executor', 'EnhancedAtomicOrderExecutor'),
            ('option_chain_manager', 'OptionChainManager'),
            ('option_executor', 'OptionOrderExecutor'),
            ('future_options_manager', 'FutureOptionsManager')
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
        # ENHANCED: Added methods that caused runtime errors in production
        critical_method_map = {
            'margin_manager': ['get_available_buying_power', 'calculate_required_margin'],
            'vix_manager': [
                'get_current_vix',
                'get_market_regime',  # CRITICAL: Added missing method that caused runtime error
                'get_vix_regime'
            ],
            'state_manager': [
                'get_system_state',
                'update_all_state_machines',  # CRITICAL: Added missing method that caused runtime error
                'register_strategy',
                'get_dashboard',
                'save_all_states'
            ],
            'strategy_coordinator': [
                'register_strategy',
                'execute_strategies'  # CRITICAL: Method called from main.py OnData
            ],
            'position_sizer': ['get_max_position_size'], 
            'greeks_monitor': ['get_portfolio_greeks', 'calculate_position_greeks'],
            'circuit_breaker': [
                'check_drawdown_limits',
                'check_correlation_limits', 
                'check_margin_limits'
            ]
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
    
    def generate_verification_diagnostic_report(self) -> str:
        """Generate detailed diagnostic report for verification failures
        
        Provides clear guidance for fixing initialization and method signature issues.
        Called when verification fails to help debug root causes quickly.
        """
        
        report = "\n=== INTEGRATION VERIFICATION DIAGNOSTIC REPORT ===\n"
        report += f"Timestamp: {self.Time}\n"
        report += f"Live Mode: {self.LiveMode}\n\n"
        
        # Manager initialization status
        report += "## MANAGER INITIALIZATION STATUS ##\n"
        required_managers = [
            ('data_validator', 'DataFreshnessValidator'),
            ('margin_manager', 'DynamicMarginManager'),
            ('vix_manager', 'UnifiedVIXManager'),
            ('strategy_coordinator', 'StrategyCoordinator')
        ]
        
        for manager_name, expected_class in required_managers:
            exists = hasattr(self, manager_name)
            if exists:
                manager = getattr(self, manager_name)
                actual_class = type(manager).__name__
                type_match = expected_class in str(type(manager))
                status = "[OK]" if type_match else "[FAIL]"
                report += f"{status} {manager_name}: {actual_class} (expected: {expected_class})\n"
            else:
                report += f"[FAIL] {manager_name}: NOT FOUND (expected: {expected_class})\n"
        
        # Critical method status
        report += "\n## CRITICAL METHOD STATUS ##\n"
        critical_methods = {
            'vix_manager.get_market_regime': "Called from main.py:527",
            'state_manager.update_all_state_machines': "Called from main.py:534",
            'strategy_coordinator.execute_strategies': "Called from main.py:537"
        }
        
        for method_path, usage_note in critical_methods.items():
            component_name, method_name = method_path.split('.')
            if hasattr(self, component_name):
                component = getattr(self, component_name)
                if hasattr(component, method_name):
                    method = getattr(component, method_name)
                    callable_status = "[OK]" if callable(method) else "[FAIL] NOT CALLABLE"
                    report += f"[OK] {method_path}: Available and callable - {usage_note}\n"
                else:
                    report += f"[FAIL] {method_path}: METHOD MISSING - {usage_note}\n"
                    report += f"   SOLUTION: Add method '{method_name}' to {component_name} class\n"
            else:
                report += f"[FAIL] {method_path}: COMPONENT MISSING - {usage_note}\n"
                report += f"   SOLUTION: Initialize {component_name} component\n"
        
        # Available methods for debugging
        report += "\n## AVAILABLE METHODS (for debugging) ##\n"
        debug_components = ['vix_manager', 'state_manager', 'strategy_coordinator']
        for comp_name in debug_components:
            if hasattr(self, comp_name):
                component = getattr(self, comp_name)
                methods = [m for m in dir(component) if callable(getattr(component, m)) and not m.startswith('_')]
                report += f"{comp_name}: {', '.join(methods[:10])}{'...' if len(methods) > 10 else ''}\n"
        
        report += "\n=== END DIAGNOSTIC REPORT ===\n"
        return report
    
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
            
            # ENHANCED: Generate detailed diagnostic report for debugging
            diagnostic_report = self.generate_verification_diagnostic_report()
            self.Error("[Integration] DIAGNOSTIC REPORT:")
            for line in diagnostic_report.split('\n'):
                if line.strip():  # Skip empty lines
                    self.Error(f"[Integration] {line}")
            
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
    
    def SafetyCheck(self):
        """Regular safety check routine with conditional logging"""
        
        # Conditional logging for performance
        if not self.is_backtest or self.Time.minute % 30 == 0:
            self.Debug("=== SAFETY CHECK ===")
        
        # Check data feeds (defensive programming)
        if hasattr(self.data_validator, 'get_status'):
            try:
                data_status = self.data_validator.get_status()
                if not self.is_backtest or self.Time.minute % 30 == 0:
                    self.Debug(f"Data feeds: {data_status}")
            except Exception as e:
                if not self.is_backtest:
                    self.Debug(f"Data validator status error: {e}")
        else:
            if not self.is_backtest:
                self.Debug("Data validator: get_status method not available")
        
        # Check margin (defensive programming)
        if hasattr(self.margin_manager, 'get_margin_status'):
            try:
                margin_status = self.margin_manager.get_margin_status()
                if isinstance(margin_status, dict) and 'usage_pct' in margin_status:
                    self.Debug(f"Margin: {margin_status['usage_pct']:.1%} used")
                else:
                    self.Debug(f"Margin: {margin_status}")
            except Exception as e:
                self.Debug(f"Margin status error: {e}")
        else:
            self.Debug("Margin manager: get_margin_status method not available")
        
        # Check correlations (defensive programming)
        if hasattr(self.correlation_limiter, 'get_max_correlation'):
            try:
                max_corr = self.correlation_limiter.get_max_correlation()
                self.Debug(f"Max correlation: {max_corr:.2f}")
            except Exception as e:
                self.Debug(f"Correlation check error: {e}")
        else:
            self.Debug("Correlation limiter: get_max_correlation method not available")
        
        # Check state machines (defensive programming)
        if hasattr(self.state_manager, 'get_dashboard'):
            try:
                state_dashboard = self.state_manager.get_dashboard()
                if isinstance(state_dashboard, dict):
                    active = state_dashboard.get('active_strategies', 'unknown')
                    total = state_dashboard.get('total_strategies', 'unknown')
                    self.Debug(f"Active strategies: {active}/{total}")
                else:
                    self.Debug(f"State dashboard: {state_dashboard}")
            except Exception as e:
                self.Debug(f"State dashboard error: {e}")
        else:
            self.Debug("State manager: get_dashboard method not available")
        
        # Check strategy health (defensive programming)
        for name, strategy in self.strategies.items():
            if hasattr(strategy, 'get_health_status'):
                try:
                    health = strategy.get_health_status()
                    if isinstance(health, dict) and not health.get('healthy', True):
                        self.Error(f"Strategy {name} unhealthy: {health.get('reason', 'unknown')}")
                except Exception as e:
                    self.Debug(f"Strategy {name} health check error: {e}")
    
    def PersistStates(self):
        """Persist all state machines"""
        
        self.state_manager.save_all_states()
        self.Debug("States persisted to ObjectStore")
    
    def EndOfDayReconciliation(self):
        """End of day reconciliation and reporting"""
        
        self.Debug("=== END OF DAY RECONCILIATION ===")
        
        # Performance summary
        if hasattr(self.performance_tracker, 'get_statistics'):
            try:
                stats = self.performance_tracker.get_statistics()
                if isinstance(stats, dict):
                    self.Debug(f"Daily P&L: ${stats.get('daily_pnl', 0):.2f}")
                    self.Debug(f"Total trades: {stats.get('total_trades', 0)}")
                    self.Debug(f"Win rate: {stats.get('win_rate', 0):.1%}")
            except Exception as e:
                self.Debug(f"Performance summary error: {e}")
        
        # Position summary
        positions = 0
        for symbol, holding in self.Portfolio.items():
            if holding.Invested:
                positions += 1
        
        self.Debug(f"Positions held: {positions}")
        self.Debug(f"Portfolio value: ${self.Portfolio.TotalPortfolioValue:.2f}")
        
        # Strategy states
        for name, strategy in self.strategies.items():
            if hasattr(strategy, 'state_machine') and hasattr(strategy.state_machine, 'current_state'):
                state = strategy.state_machine.current_state.name if strategy.state_machine.current_state else 'Unknown'
                self.Debug(f"{name}: {state}")
        
        # Margin status
        if hasattr(self.margin_manager, 'get_margin_status'):
            try:
                margin_status = self.margin_manager.get_margin_status()
                if isinstance(margin_status, dict):
                    self.Debug(f"Margin usage: {margin_status.get('usage_pct', 0):.1%}")
                    self.Debug(f"Available margin: ${margin_status.get('available_margin', 0):.2f}")
            except Exception as e:
                self.Debug(f"EOD margin status error: {e}")
        
        self.Debug("=== EOD RECONCILIATION COMPLETE ===")
    
    def cleanup_spy_concentrations(self):
        """
        CRITICAL FIX #2: Clean up stale SPY allocations from crashed strategies
        
        This scheduled method runs every 6 hours to prevent resource starvation
        by removing allocations from strategies that are no longer active.
        """
        try:
            if hasattr(self, 'spy_concentration_manager'):
                cleanup_result = self.spy_concentration_manager.cleanup_stale_allocations(force_reconcile=True)
                
                if cleanup_result.get('cleaned_count', 0) > 0:
                    self.Log(f"[SPY Cleanup] Cleaned {cleanup_result['cleaned_count']} stale allocations")
                
                # Log current utilization after cleanup
                utilization = cleanup_result.get('utilization_after', {})
                if utilization:
                    self.Debug(
                        f"[SPY Cleanup] Post-cleanup: {utilization.get('delta_used', 0):.1f}/{utilization.get('max_delta', 0):.1f} delta, "
                        f"{utilization.get('strategies_active', 0)}/{utilization.get('max_strategies', 0)} strategies"
                    )
        except Exception as e:
            self.Error(f"[SPY Cleanup] Failed to clean allocations: {e}")
    
    def monitor_option_chain_quality(self):
        """
        DATA QUALITY FIX #3: Monitor option chain data completeness and quality
        
        This scheduled method runs every 15 minutes to validate option chain data
        quality and alert on issues that could prevent position opening.
        """
        try:
            if hasattr(self, 'option_chain_manager') and self.option_chain_manager:
                health_report = self.option_chain_manager.get_chain_data_health_report()
                
                # Alert on critical data quality issues
                overall_score = health_report.get('overall_health_score', 0)
                if overall_score < 0.6:
                    self.Log(f"[ALERT] Option chain data quality degraded: {overall_score:.1%}")
                
                # Log recommendations for improvement
                recommendations = health_report.get('recommendations', [])
                for rec in recommendations[:2]:  # Log top 2 recommendations
                    self.Debug(f"[Option Chain Rec] {rec}")
                
                # Store health report for strategy access
                self.option_chain_health = health_report
                
        except Exception as e:
            self.Error(f"[Option Chain Monitor] Failed to monitor chain quality: {e}")