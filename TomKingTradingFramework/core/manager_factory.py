# Manager Factory - PHASE 4 OPTIMIZATION: Unified Manager Initialization with Dependency Injection
# Consolidates 16 managers from main.py into structured, dependency-aware initialization

from AlgorithmImports import *
from typing import Dict, List, Tuple, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum, auto
import traceback

class ManagerStatus(Enum):
    """Manager initialization status"""
    NOT_STARTED = auto()
    IN_PROGRESS = auto()
    COMPLETED = auto()
    FAILED = auto()
    DEPENDENCY_FAILED = auto()

@dataclass
class ManagerConfig:
    """Configuration for a single manager component"""
    name: str
    class_type: type
    dependencies: List[str]
    required_methods: List[str]
    initialization_args: Tuple = ()
    initialization_kwargs: Dict = None
    critical: bool = True  # If True, failure stops algorithm
    tier: int = 1  # Initialization tier (1=foundation, 2=core, 3=advanced, 4=coordination)
    
    def __post_init__(self):
        if self.initialization_kwargs is None:
            self.initialization_kwargs = {}

class ManagerFactory:
    """
    PHASE 4 OPTIMIZATION: Unified Manager Factory with Dependency Injection
    
    Consolidates manual manager initialization from main.py into structured system:
    - 16 managers organized by dependency tiers
    - Automatic dependency resolution
    - Interface validation for all managers
    - Fail-fast critical path protection
    - Performance optimization through parallel initialization
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.managers = {}
        self.manager_configs = {}
        self.initialization_order = []
        self.status_map = {}
        
        # Results tracking
        self.initialization_successful = False
        self.failed_managers = []
        self.initialization_log = []
        self.performance_metrics = {}
        
    def define_all_managers(self):
        """Define all 16 managers from main.py with proper dependencies"""
        
        # Import all required classes
        from helpers.data_freshness_validator import DataFreshnessValidator
        from risk.dynamic_margin_manager import DynamicMarginManager
        from core.unified_vix_manager import UnifiedVIXManager
        from helpers.performance_tracker_safe import SafePerformanceTracker
        from helpers.quantconnect_event_calendar import QuantConnectEventCalendar
        from core.unified_state_manager import UnifiedStateManager
        from helpers.order_state_recovery import OrderStateRecovery
        from core.unified_position_sizer import UnifiedPositionSizer
        from risk.correlation_group_limiter import August2024CorrelationLimiter
        from core.spy_concentration_manager import SPYConcentrationManager
        from core.strategy_coordinator import StrategyCoordinator
        from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
        from helpers.option_chain_manager import OptionChainManager
        from helpers.option_order_executor import OptionOrderExecutor
        from helpers.future_options_manager import FutureOptionsManager
        
        # PHASE 5 OPTIMIZATION: Event-Driven Architecture Components
        from core.event_bus import EventBus
        from core.central_greeks_service import CentralGreeksService
        from core.event_driven_optimizer import EventDrivenOptimizer
        
        # TIER 1: FOUNDATION MANAGERS (No dependencies - can initialize in parallel)
        foundation_managers = {
            'data_validator': ManagerConfig(
                name='data_validator',
                class_type=DataFreshnessValidator,
                dependencies=[],
                required_methods=['is_data_fresh', 'validate_market_data'],
                initialization_args=(self.algo,),
                critical=True,
                tier=1
            ),
            
            'margin_manager': ManagerConfig(
                name='margin_manager',
                class_type=DynamicMarginManager,
                dependencies=[],
                required_methods=['get_available_margin', 'check_margin_requirements'],
                initialization_args=(self.algo,),
                critical=True,
                tier=1
            ),
            
            'performance_tracker': ManagerConfig(
                name='performance_tracker',
                class_type=SafePerformanceTracker,
                dependencies=[],
                required_methods=['add_trade_pnl', 'get_statistics'],
                initialization_args=(self.algo,),
                critical=False,
                tier=1
            ),
            
            'event_calendar': ManagerConfig(
                name='event_calendar',
                class_type=QuantConnectEventCalendar,
                dependencies=[],
                required_methods=['is_earnings_week', 'get_next_expiration'],
                initialization_args=(self.algo,),
                critical=False,
                tier=1
            ),
            
            
            # PHASE 5 OPTIMIZATION: Event-Driven Architecture Foundation
            'event_bus': ManagerConfig(
                name='event_bus',
                class_type=EventBus,
                dependencies=[],  # Foundation component - no dependencies
                required_methods=['subscribe', 'publish', 'get_statistics'],
                initialization_args=(self.algo,),
                critical=True,
                tier=1  # Foundation tier - needed by other event-driven components
            )
        }
        
        # TIER 2: CORE MANAGERS (Depend on foundation)
        core_managers = {
            'vix_manager': ManagerConfig(
                name='vix_manager',
                class_type=UnifiedVIXManager,
                dependencies=['data_validator'],  # Needs data validation
                required_methods=['get_current_vix', 'get_market_regime', 'get_vix_regime'],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'state_manager': ManagerConfig(
                name='state_manager',
                class_type=UnifiedStateManager,
                dependencies=['vix_manager'],  # Needs VIX for state decisions
                required_methods=[
                    'register_strategy',
                    'update_system_state', 
                    'get_system_summary',
                    'save_all_states'
                ],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'order_recovery': ManagerConfig(
                name='order_recovery',
                class_type=OrderStateRecovery,
                dependencies=['state_manager'],  # Needs state coordination
                required_methods=['recover_pending_orders', 'save_order_state'],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'correlation_limiter': ManagerConfig(
                name='correlation_limiter', 
                class_type=August2024CorrelationLimiter,
                dependencies=['performance_tracker'],  # Needs performance data
                required_methods=['check_correlation_limits', 'get_correlation_exposure'],
                initialization_args=(self.algo,),
                critical=False,
                tier=2
            ),
            
            # PHASE 5 OPTIMIZATION: Centralized Greeks Service (replaces GreeksMonitor)
            'greeks_monitor': ManagerConfig(
                name='greeks_monitor',  # Keep same name for compatibility
                class_type=CentralGreeksService,  # Use new event-driven service
                dependencies=['event_bus', 'data_validator'],  # Needs event bus and data validation
                required_methods=['get_portfolio_greeks', 'monitor_greeks_thresholds'],
                initialization_args=(self.algo, None),  # Will pass event_bus in kwargs
                initialization_kwargs={'event_bus': 'event_bus'},  # Reference to event_bus manager
                critical=True,  # Critical for Greeks monitoring
                tier=2
            )
        }
        
        # TIER 3: ADVANCED MANAGERS (Depend on core systems)
        advanced_managers = {
            'position_sizer': ManagerConfig(
                name='position_sizer',
                class_type=UnifiedPositionSizer,
                dependencies=['vix_manager', 'margin_manager'],  # Needs VIX regime and margin
                required_methods=['calculate_position_size', 'get_strategy_limits'],  # get_strategy_limits exists, get_available_buying_power does not
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'spy_concentration_manager': ManagerConfig(
                name='spy_concentration_manager',
                class_type=SPYConcentrationManager,
                dependencies=['position_sizer'],  # Needs position sizing
                required_methods=['request_spy_allocation', 'update_position_delta'],  # Use actual method names from SPYConcentrationManager
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'atomic_executor': ManagerConfig(
                name='atomic_executor',
                class_type=EnhancedAtomicOrderExecutor,
                dependencies=['order_recovery', 'margin_manager'],  # Needs recovery and margin
                required_methods=['execute_atomic_order', 'validate_order_feasibility'],
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'option_chain_manager': ManagerConfig(
                name='option_chain_manager',
                class_type=OptionChainManager,
                dependencies=['data_validator'],  # Needs data validation
                required_methods=['get_option_chain', 'filter_liquid_options'],
                initialization_args=(self.algo,),
                critical=False,
                tier=3
            ),
            
            'option_executor': ManagerConfig(
                name='option_executor',
                class_type=OptionOrderExecutor,
                dependencies=['atomic_executor', 'option_chain_manager'],  # Needs atomic execution and chains
                required_methods=['place_option_limit_order', 'place_iron_condor_orders'],  # Use actual method names from OptionOrderExecutor
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'future_options_manager': ManagerConfig(
                name='future_options_manager',
                class_type=FutureOptionsManager,
                dependencies=['option_chain_manager'],  # Needs option chain access
                required_methods=['add_future_option_safely', 'get_option_chain_safely'],  # Use actual method names from FutureOptionsManager
                initialization_args=(self.algo,),
                critical=False,
                tier=3
            )
        }
        
        # TIER 4: COORDINATION MANAGERS (Depend on all core systems)
        coordination_managers = {
            'strategy_coordinator': ManagerConfig(
                name='strategy_coordinator',
                class_type=StrategyCoordinator,
                dependencies=[
                    'state_manager',
                    'position_sizer', 
                    'vix_manager',
                    'spy_concentration_manager'
                ],
                required_methods=[
                    'register_strategy',
                    'execute_strategies',
                    'emergency_halt_all'
                ],
                initialization_args=(self.algo,),
                critical=True,
                tier=4
            ),
            
            # PHASE 5 OPTIMIZATION: Event-Driven Performance Optimizer
            'event_driven_optimizer': ManagerConfig(
                name='event_driven_optimizer',
                class_type=EventDrivenOptimizer,
                dependencies=['event_bus', 'central_greeks_service'],  # Needs event bus and centralized Greeks
                required_methods=['optimize_ondata_performance', 'get_optimization_statistics'],
                initialization_args=(self.algo, None, None),  # Will pass event_bus and greeks_service in kwargs
                initialization_kwargs={
                    'event_bus': 'event_bus',
                    'greeks_service': 'central_greeks_service'
                },
                critical=True,  # Critical for performance optimization
                tier=4
            )
        }
        
        # Combine all manager configurations
        self.manager_configs = {
            **foundation_managers,
            **core_managers,
            **advanced_managers,
            **coordination_managers
        }
        
        self.algo.Debug(f"[ManagerFactory] Defined {len(self.manager_configs)} managers across 4 tiers")
        
        # Log tier distribution
        tier_counts = {}
        for config in self.manager_configs.values():
            tier_counts[config.tier] = tier_counts.get(config.tier, 0) + 1
        
        self.algo.Debug(f"[ManagerFactory] Tier distribution: {dict(sorted(tier_counts.items()))}")
    
    def resolve_initialization_order(self) -> List[str]:
        """Resolve manager initialization order using tier-based + dependency resolution"""
        
        ordered = []
        
        # Process by tier to ensure proper layering
        for tier in sorted(set(config.tier for config in self.manager_configs.values())):
            tier_managers = [name for name, config in self.manager_configs.items() if config.tier == tier]
            
            # Within each tier, resolve dependencies
            tier_ordered = []
            remaining = set(tier_managers)
            
            while remaining:
                # Find managers with no unresolved dependencies in this tier
                ready = []
                for name in remaining:
                    config = self.manager_configs[name]
                    deps_resolved = all(dep in ordered for dep in config.dependencies)
                    if deps_resolved:
                        ready.append(name)
                
                if not ready:
                    # Circular dependency within tier
                    self.algo.Error(f"[ManagerFactory] Circular dependency in tier {tier}: {remaining}")
                    # Add remaining in alphabetical order to break deadlock
                    ready = sorted(list(remaining))
                
                # Add ready managers to tier order
                for name in sorted(ready):
                    tier_ordered.append(name)
                    remaining.discard(name)
            
            ordered.extend(tier_ordered)
            self.algo.Debug(f"[ManagerFactory] Tier {tier} order: {' -> '.join(tier_ordered)}")
        
        self.initialization_order = ordered
        self.algo.Log(f"[ManagerFactory] Complete initialization order: {' -> '.join(ordered)}")
        return ordered
    
    def initialize_all_managers(self) -> Tuple[bool, Dict]:
        """Initialize all managers in dependency order with performance tracking"""
        
        import time
        start_time = time.time()
        
        self.algo.Log("[ManagerFactory] Starting unified manager initialization")
        
        # Define managers and resolve order
        self.define_all_managers()
        self.resolve_initialization_order()
        
        success_count = 0
        total_count = len(self.initialization_order)
        tier_performance = {}
        
        current_tier = None
        tier_start_time = None
        
        for manager_name in self.initialization_order:
            config = self.manager_configs[manager_name]
            
            # Track tier performance
            if current_tier != config.tier:
                if current_tier is not None:
                    tier_performance[current_tier] = time.time() - tier_start_time
                current_tier = config.tier
                tier_start_time = time.time()
                self.algo.Debug(f"[ManagerFactory] Starting Tier {current_tier} initialization")
            
            self.status_map[manager_name] = ManagerStatus.IN_PROGRESS
            
            manager_start_time = time.time()
            success = self._initialize_single_manager(manager_name)
            manager_duration = time.time() - manager_start_time
            
            self.performance_metrics[manager_name] = {
                'duration_ms': manager_duration * 1000,
                'tier': config.tier,
                'critical': config.critical
            }
            
            if success:
                self.status_map[manager_name] = ManagerStatus.COMPLETED
                success_count += 1
                self.algo.Log(f"[ManagerFactory] ✅ {manager_name} ({success_count}/{total_count}) - {manager_duration*1000:.1f}ms")
            else:
                self.status_map[manager_name] = ManagerStatus.FAILED
                self.failed_managers.append(manager_name)
                
                if config.critical:
                    self.algo.Error(f"[ManagerFactory] ❌ CRITICAL manager {manager_name} failed - STOPPING")
                    self._mark_dependent_managers_failed(manager_name)
                    break
                else:
                    self.algo.Log(f"[ManagerFactory] ⚠️ Non-critical manager {manager_name} failed - continuing")
        
        # Final tier performance
        if current_tier is not None:
            tier_performance[current_tier] = time.time() - tier_start_time
        
        total_duration = time.time() - start_time
        
        self.initialization_successful = success_count == total_count and len(self.failed_managers) == 0
        
        # Performance summary
        self.algo.Debug(f"[ManagerFactory] Tier Performance: {tier_performance}")
        self.algo.Debug(f"[ManagerFactory] Total Duration: {total_duration*1000:.1f}ms")
        
        result = {
            'success': self.initialization_successful,
            'total_managers': total_count,
            'successful_managers': success_count,
            'failed_managers': self.failed_managers,
            'manager_status': {name: status.name for name, status in self.status_map.items()},
            'initialization_log': self.initialization_log,
            'performance_metrics': self.performance_metrics,
            'tier_performance': tier_performance,
            'total_duration_ms': total_duration * 1000
        }
        
        if self.initialization_successful:
            self.algo.Log(f"[ManagerFactory] 🎉 All {total_count} managers initialized in {total_duration*1000:.1f}ms")
        else:
            self.algo.Error(f"[ManagerFactory] 💥 Manager initialization FAILED - {len(self.failed_managers)} failures")
        
        return self.initialization_successful, result
    
    def _initialize_single_manager(self, manager_name: str) -> bool:
        """Initialize a single manager with comprehensive error handling"""
        
        config = self.manager_configs[manager_name]
        
        try:
            # Verify dependencies are available
            for dep_name in config.dependencies:
                if dep_name not in self.managers:
                    self.algo.Error(f"[ManagerFactory] {manager_name}: dependency '{dep_name}' not available")
                    return False
                    
                # Verify dependency is healthy
                dep_status = self.status_map.get(dep_name)
                if dep_status != ManagerStatus.COMPLETED:
                    self.algo.Error(f"[ManagerFactory] {manager_name}: dependency '{dep_name}' not in COMPLETED state ({dep_status})")
                    return False
            
            # Resolve manager references in kwargs
            resolved_kwargs = config.initialization_kwargs.copy()
            for key, value in resolved_kwargs.items():
                if isinstance(value, str) and value in self.managers:
                    # Replace string reference with actual manager instance
                    resolved_kwargs[key] = self.managers[value]
                    self.algo.Debug(f"[ManagerFactory] {manager_name}: resolved {key} -> {value}")
            
            # Initialize manager instance
            manager = config.class_type(*config.initialization_args, **resolved_kwargs)
            
            # Validate required methods exist and are callable
            missing_methods = []
            for method_name in config.required_methods:
                if not hasattr(manager, method_name):
                    missing_methods.append(method_name)
                elif not callable(getattr(manager, method_name)):
                    missing_methods.append(f"{method_name} (not callable)")
            
            if missing_methods:
                self.algo.Error(f"[ManagerFactory] {manager_name}: missing methods {missing_methods}")
                return False
            
            # Store manager and attach to algorithm
            self.managers[manager_name] = manager
            setattr(self.algo, manager_name, manager)
            
            # Log success with method validation
            log_entry = f"{manager_name}: initialized with methods {config.required_methods}"
            self.initialization_log.append(log_entry)
            
            return True
            
        except Exception as e:
            error_msg = f"{manager_name}: initialization failed - {str(e)}"
            self.algo.Error(f"[ManagerFactory] {error_msg}")
            self.algo.Error(f"[ManagerFactory] {manager_name}: traceback - {traceback.format_exc()}")
            self.initialization_log.append(error_msg)
            return False
    
    def _mark_dependent_managers_failed(self, failed_manager: str):
        """Mark all managers that depend on failed manager as failed"""
        
        for name, config in self.manager_configs.items():
            if failed_manager in config.dependencies and name not in self.failed_managers:
                self.status_map[name] = ManagerStatus.DEPENDENCY_FAILED
                self.failed_managers.append(name)
                self.algo.Error(f"[ManagerFactory] {name}: failed due to dependency '{failed_manager}'")
    
    def get_manager(self, manager_name: str) -> Any:
        """Get initialized manager by name"""
        return self.managers.get(manager_name)
    
    def get_initialization_status(self) -> Dict:
        """Get comprehensive initialization status"""
        
        return {
            'successful': self.initialization_successful,
            'manager_count': len(self.manager_configs),
            'success_count': len([s for s in self.status_map.values() if s == ManagerStatus.COMPLETED]),
            'failed_count': len(self.failed_managers),
            'manager_status': {name: status.name for name, status in self.status_map.items()},
            'failed_managers': self.failed_managers,
            'initialization_order': self.initialization_order,
            'available_managers': list(self.managers.keys()),
            'performance_metrics': self.performance_metrics
        }
    
    def emergency_manager_check(self) -> bool:
        """Emergency validation of critical managers"""
        
        critical_managers = [
            'vix_manager', 'state_manager', 'strategy_coordinator', 
            'position_sizer', 'atomic_executor', 'margin_manager'
        ]
        
        for name in critical_managers:
            if name not in self.managers:
                self.algo.Error(f"[ManagerFactory] EMERGENCY: Critical manager '{name}' not available")
                return False
            
            manager = self.managers[name]
            config = self.manager_configs.get(name)
            
            if config:
                for method_name in config.required_methods:
                    if not hasattr(manager, method_name):
                        self.algo.Error(f"[ManagerFactory] EMERGENCY: {name}.{method_name} not available")
                        return False
        
        self.algo.Log("[ManagerFactory] Emergency manager check passed")
        return True
    
    def get_performance_summary(self) -> Dict:
        """Get manager initialization performance summary"""
        
        if not self.performance_metrics:
            return {}
        
        total_time = sum(m['duration_ms'] for m in self.performance_metrics.values())
        critical_time = sum(m['duration_ms'] for m in self.performance_metrics.values() if m['critical'])
        
        return {
            'total_initialization_time_ms': total_time,
            'critical_manager_time_ms': critical_time,
            'average_time_per_manager_ms': total_time / len(self.performance_metrics),
            'slowest_manager': max(self.performance_metrics.items(), key=lambda x: x[1]['duration_ms']),
            'fastest_manager': min(self.performance_metrics.items(), key=lambda x: x[1]['duration_ms']),
            'managers_by_tier': {
                tier: [name for name, metrics in self.performance_metrics.items() if metrics['tier'] == tier]
                for tier in sorted(set(m['tier'] for m in self.performance_metrics.values()))
            }
        }