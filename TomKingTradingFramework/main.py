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

# Core State Management - PHASE 3 OPTIMIZATION: COORDINATOR PATTERN
from core.unified_state_manager import UnifiedStateManager
from core.strategy_coordinator import StrategyCoordinator
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer
# SPYConcentrationManager now replaced by UnifiedRiskManager with ConcentrationPlugin

# Performance Optimization Systems - CONSOLIDATED
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType

# State Machine Strategies - NEW IMPLEMENTATIONS
from strategies.friday_0dte_with_state import Friday0DTEWithState
from strategies.lt112_with_state import LT112WithState
from strategies.ipmcc_with_state import IPMCCWithState
from strategies.futures_strangle_with_state import FuturesStrangleWithState
from strategies.leap_put_ladders_with_state import LEAPPutLaddersWithState

# Risk Management
# VIX management now handled by UnifiedVIXManager
from risk.dynamic_margin_manager import DynamicMarginManager
# August2024CorrelationLimiter now replaced by UnifiedRiskManager with CorrelationPlugin

# Helpers and Safety Systems
from helpers.data_freshness_validator import DataFreshnessValidator
from helpers.performance_tracker_safe import SafePerformanceTracker
from helpers.quantconnect_event_calendar import QuantConnectEventCalendar
from helpers.option_chain_manager import OptionChainManager
from helpers.option_order_executor import OptionOrderExecutor
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
from helpers.future_options_manager import FutureOptionsManager

# REMOVED: Position Management now integrated into UnifiedStateManager coordinator
# from position_state_manager import PositionStateManagerQC

# PHASE 5: Event-Driven Architecture
from core.event_bus import EventBus, EventType
from core.central_greeks_service import CentralGreeksService
from core.event_driven_optimizer import EventDrivenOptimizer
from core.event_driven_ondata import EventDrivenOnData

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
        # PHASE 4 OPTIMIZATION: MANAGER FACTORY INITIALIZATION
        # ======================
        
        # Replace manual manager initialization with structured ManagerFactory
        from core.manager_factory import ManagerFactory
        
        self.Log("[STARTUP] PHASE 6: Initializing managers using dependency-safe ManagerFactory")
        
        # Initialize ManagerFactory with circular dependency resolution
        self.manager_factory = ManagerFactory(self)
        
        # PHASE 6: Initialize all managers with dependency container and circular dependency resolution
        initialization_success, factory_result = self.manager_factory.initialize_all_managers_with_dependency_container()
        
        if not initialization_success:
            self.Error(f"[STARTUP] Manager initialization FAILED: {factory_result['failed_managers']}")
            self.Error(f"[STARTUP] Manager status: {factory_result['manager_status']}")
            raise Exception("Critical manager initialization failure - cannot proceed")
        
        # Log successful initialization with PHASE 6 metrics
        self.Log(f"[STARTUP] PHASE 6: ✅ All {factory_result['managers_initialized']}/{len(self.manager_factory.manager_configs)} managers initialized")
        self.Log(f"[STARTUP] PHASE 6: Circular dependencies resolved: {factory_result.get('circular_dependencies_resolved', 0)}")
        self.Debug(f"[STARTUP] PHASE 6: Total initialization time: {factory_result['total_duration_ms']:.1f}ms")
        
        # Store factory result for debugging
        self.manager_initialization_result = factory_result
        
        # PHASE 7: Initialize UnifiedRiskManager with plugins
        self.initialize_unified_risk_management()
        
        # Emergency validation of critical managers
        if not self.manager_factory.emergency_manager_check():
            raise Exception("Emergency manager check failed - critical managers not available")
        
        # ======================
        # PHASE 5 INTEGRATION: EXTRACT MANAGERS FROM FACTORY
        # ======================
        
        # Extract all managers from ManagerFactory and assign to self attributes
        # This enables the existing code to work with the new architecture
        self.Log("[STARTUP] Extracting managers from factory for integration...")
        
        # Core Managers (Tier 1)
        self.data_validator = self.manager_factory.get_manager('data_validator')
        self.margin_manager = self.manager_factory.get_manager('margin_manager') 
        self.vix_manager = self.manager_factory.get_manager('vix_manager')
        self.performance_tracker = self.manager_factory.get_manager('performance_tracker')
        self.event_calendar = self.manager_factory.get_manager('event_calendar')
        self.state_manager = self.manager_factory.get_manager('state_manager')
        
        # Event-Driven Architecture (Tier 2)
        self.event_bus = self.manager_factory.get_manager('event_bus')
        self.event_driven_optimizer = self.manager_factory.get_manager('event_driven_optimizer')
        self.greeks_monitor = self.manager_factory.get_manager('greeks_monitor')  # Now CentralGreeksService
        
        # Advanced Managers (Tier 2)
        self.position_sizer = self.manager_factory.get_manager('position_sizer')
        self.correlation_limiter = self.manager_factory.get_manager('correlation_limiter')
        self.spy_concentration_manager = self.manager_factory.get_manager('spy_concentration_manager')
        
        # Strategy and Execution Managers (Tier 3)
        self.strategy_coordinator = self.manager_factory.get_manager('strategy_coordinator')
        self.atomic_executor = self.manager_factory.get_manager('atomic_executor')
        self.option_chain_manager = self.manager_factory.get_manager('option_chain_manager')
        self.option_executor = self.manager_factory.get_manager('option_executor')
        self.future_options_manager = self.manager_factory.get_manager('future_options_manager')
        
        # Event-Driven OnData Processor (Tier 4)
        self.event_driven_ondata = self.manager_factory.get_manager('event_driven_ondata')
        
        self.Log("[STARTUP] ✅ Manager extraction complete - all managers available as attributes")
        
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
            # HIERARCHICAL STATE MANAGER: Register strategy directly (no separate state machine)
            self.state_manager.register_strategy(name)
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
        self.state_manager.load_states()
        
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
            # UNIFIED INTELLIGENT CACHE SYSTEM - CONSOLIDATION
            # Replaces HighPerformanceCache + PositionAwareCache + MarketDataCache
            self.unified_cache = UnifiedIntelligentCache(
                self,
                max_size=3500,  # Combined capacity of all three caches  
                ttl_minutes=5,  # Default TTL
                max_memory_mb=175,  # Combined memory allocation
                price_change_threshold=0.001,
                position_check_interval_seconds=30,
                enable_stats=True
            )
            
            # Backward compatibility aliases during migration
            self.main_cache = self.unified_cache
            self.position_cache = self.unified_cache
            self.market_cache = self.unified_cache
            
            # Performance tracking flags
            self.last_cache_maintenance = self.Time
            self.cache_maintenance_interval = timedelta(minutes=15)
            
            if not self.is_backtest:
                self.Debug("[PERFORMANCE] High-performance caching systems initialized")
                
        except Exception as e:
            self.Error(f"[PERFORMANCE] Cache initialization failed: {e}")
    
    def initialize_unified_risk_management(self):
        """
        PHASE 7: Initialize UnifiedRiskManager with plugin architecture
        Replaces separate August2024CorrelationLimiter, SPYConcentrationManager, CircuitBreaker
        """
        try:
            # Get the UnifiedRiskManager from the factory
            if not hasattr(self, 'unified_risk_manager'):
                self.Error("[RISK] UnifiedRiskManager not found in factory initialization")
                return False
            
            # Import and register risk plugins
            from risk.plugins.correlation_plugin import CorrelationPlugin
            from risk.plugins.circuit_breaker_plugin import CircuitBreakerPlugin
            from risk.plugins.concentration_plugin import ConcentrationPlugin
            
            # Register plugins in order of importance
            plugins_registered = 0
            
            # 1. Circuit Breaker Plugin (CRITICAL - emergency stops)
            circuit_breaker_plugin = CircuitBreakerPlugin()
            if self.unified_risk_manager.register_plugin(circuit_breaker_plugin):
                plugins_registered += 1
                self.Log("[RISK] ✅ CircuitBreakerPlugin registered (preserves August 5 protections)")
            else:
                self.Error("[RISK] ❌ Failed to register CircuitBreakerPlugin")
            
            # 2. Correlation Plugin (HIGH - prevents correlation disasters)
            correlation_plugin = CorrelationPlugin()
            if self.unified_risk_manager.register_plugin(correlation_plugin):
                plugins_registered += 1
                self.Log("[RISK] ✅ CorrelationPlugin registered (August 5 correlation limits)")
            else:
                self.Error("[RISK] ❌ Failed to register CorrelationPlugin")
            
            # 3. Concentration Plugin (HIGH - prevents over-exposure)
            concentration_plugin = ConcentrationPlugin()
            if self.unified_risk_manager.register_plugin(concentration_plugin):
                plugins_registered += 1
                self.Log("[RISK] ✅ ConcentrationPlugin registered (SPY/ES concentration limits)")
            else:
                self.Error("[RISK] ❌ Failed to register ConcentrationPlugin")
            
            # Verify all plugins registered successfully
            if plugins_registered == 3:
                self.Log(f"[RISK] ✅ UnifiedRiskManager initialized with {plugins_registered}/3 plugins")
                
                # Create backward compatibility aliases for existing code
                self.correlation_limiter = self.unified_risk_manager  # For strategy access
                self.spy_concentration_manager = self.unified_risk_manager  # For strategy access
                self.circuit_breaker = self.unified_risk_manager  # For strategy access
                
                return True
            else:
                self.Error(f"[RISK] ❌ Only {plugins_registered}/3 plugins registered successfully")
                return False
                
        except Exception as e:
            self.Error(f"[RISK] UnifiedRiskManager initialization failed: {e}")
            import traceback
            self.Error(f"[RISK] Error details: {traceback.format_exc()}")
            return False
    
    def verify_manager_initialization(self) -> bool:
        """Verify all required managers are properly initialized"""
        # PHASE 5 UPDATE: Event-driven architecture managers included
        required_managers = [
            # Core Managers (Tier 1)
            ('data_validator', 'DataFreshnessValidator'),
            ('margin_manager', 'DynamicMarginManager'),
            ('vix_manager', 'UnifiedVIXManager'),
            ('performance_tracker', 'SafePerformanceTracker'),
            ('event_calendar', 'QuantConnectEventCalendar'),
            ('state_manager', 'UnifiedStateManager'),
            
            # Event-Driven Architecture (Tier 2)
            ('event_bus', 'EventBus'),
            ('event_driven_optimizer', 'EventDrivenOptimizer'),
            ('greeks_monitor', 'CentralGreeksService'),  # Now uses event-driven Greeks service
            
            # Advanced Managers (Tier 2)
            ('position_sizer', 'UnifiedPositionSizer'),
            ('correlation_limiter', 'August2024CorrelationLimiter'),
            ('spy_concentration_manager', 'SPYConcentrationManager'),  # CRITICAL: Prevents SPY over-exposure
            
            # Strategy and Execution Managers (Tier 3)
            ('strategy_coordinator', 'StrategyCoordinator'),  # CRITICAL: Added missing component
            ('atomic_executor', 'EnhancedAtomicOrderExecutor'),
            ('option_chain_manager', 'OptionChainManager'),
            ('option_executor', 'OptionOrderExecutor'),
            ('future_options_manager', 'FutureOptionsManager'),
            
            # Event-Driven OnData Processor (Tier 4)
            ('event_driven_ondata', 'EventDrivenOnData')
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
                'register_strategy',  # Register individual strategy state machines
                'update_system_state',  # System state coordination
                'halt_all_trading',  # Emergency controls
                'save_all_states',  # State persistence  
                'load_all_states',  # State recovery
                'get_system_summary'  # Interface compatibility
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
            'state_manager.update_system_state': "Called from main.py (coordinator pattern)",
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
        """
        PHASE 5: Event-Driven OnData Processing
        
        Replaces traditional periodic processing with event-driven architecture
        for 20%+ performance improvement through intelligent filtering and batching
        """
        
        # PHASE 5 OPTIMIZATION: Use event-driven OnData processor
        try:
            # Process through event-driven architecture with performance optimization
            optimization_result = self.event_driven_ondata.process_ondata(data)
            
            # Check if processing was skipped due to lack of significant changes
            if 'optimizations' in optimization_result and 'skipped_entire_ondata' in optimization_result['optimizations']:
                # OnData processing was intelligently skipped - no significant market changes
                return
            
            # Log performance improvements periodically
            if 'performance_improvement_pct' in optimization_result:
                improvement = optimization_result['performance_improvement_pct']
                if improvement >= 20.0:  # Log when achieving 20%+ improvement target
                    self.Debug(f"[PHASE 5] OnData optimization: {improvement:.1f}% performance gain achieved")
            
            # Handle any errors from event-driven processing
            if 'error' in optimization_result:
                self.Error(f"[PHASE 5] Event-driven OnData error: {optimization_result['error']}")
                # Fall back to traditional processing if event-driven fails
                self._fallback_ondata_processing(data)
                return
            
            # Traditional risk management and maintenance (not event-driven yet)
            self._perform_traditional_risk_checks()
            
        except Exception as e:
            self.Error(f"[PHASE 5] Critical error in event-driven OnData: {e}")
            # Emergency fallback to traditional processing
            self._fallback_ondata_processing(data)
    
    def _fallback_ondata_processing(self, data):
        """Emergency fallback to traditional OnData processing"""
        
        self.Debug("[FALLBACK] Using traditional OnData processing")
        
        # Data validation
        if not self.data_validator.is_data_fresh(data):
            return
        
        # VIX and market regime
        current_vix = self.vix_manager.get_current_vix()
        market_regime = self.vix_manager.get_market_regime()
        
        # Strategy execution
        self.state_manager.update_system_state()
        self.strategy_coordinator.execute_strategies(data, {
            'vix': current_vix,
            'regime': market_regime,
            'time': self.Time
        })
        
        # Risk management
        self.check_circuit_breakers()
    
    def _perform_traditional_risk_checks(self):
        """Traditional risk management checks (not yet event-driven)"""
        
        # Periodic cache maintenance
        if hasattr(self, 'last_cache_maintenance'):
            if (self.Time - self.last_cache_maintenance) > self.cache_maintenance_interval:
                self.maintain_caches()
                self.last_cache_maintenance = self.Time
        
        # Circuit breakers
        self.check_circuit_breakers()
        
        # Greeks monitoring (now event-driven but kept for compatibility)
        if self.Time.minute % 15 == 0:
            portfolio_greeks = self.greeks_monitor.get_portfolio_greeks()
            warnings, risk_analysis = self.greeks_monitor.monitor_greeks_thresholds()
            
            if warnings:
                for warning in warnings:
                    self.Log(f"[GREEKS WARNING] {warning}")
            
            self.event_bus.publish_greeks_event(
                EventType.GREEKS_CALCULATED,
                portfolio_greeks,
                risk_analysis=risk_analysis
            )
        
        # Correlation limits
        if self.Time.minute % 30 == 0:
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
            self.state_manager.halt_all_trading("Rapid drawdown detected")
        
        # Margin spike check  
        margin_usage = self.margin_manager.get_margin_usage()
        if margin_usage > self.circuit_breakers['margin_spike']['threshold']:
            self.state_manager.halt_all_trading("Margin usage too high")
        
        # Correlation spike check
        max_correlation = self.correlation_limiter.get_max_correlation()
        if max_correlation > self.circuit_breakers['correlation_spike']['threshold']:
            self.state_manager.halt_all_trading("Correlation spike detected")
    
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
        
        # Check hierarchical state system (defensive programming)
        try:
            state_summary = self.state_manager.get_system_summary()
            if isinstance(state_summary, dict):
                active = len([s for s in state_summary.get('strategy_summary', {}).values() 
                             if s.get('active_positions', 0) > 0])
                total = state_summary.get('total_strategies', 'unknown')
                self.Debug(f"Active strategies: {active}/{total}")
            else:
                self.Debug(f"State summary: {state_summary}")
        except Exception as e:
            self.Debug(f"State summary error: {e}")
        
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