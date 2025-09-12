# Manager Factory - PHASE 4 OPTIMIZATION: Unified Manager Initialization with Dependency Injection
# Consolidates 16 managers from main.py into structured, dependency-aware initialization

from AlgorithmImports import *
from typing import Dict, List, Tuple, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum, auto
import traceback

# PHASE 6: Circular Dependency Resolution
from core.dependency_container import DependencyContainer, IManager
from core.event_bus import EventBus

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
    PHASE 6 OPTIMIZATION: Circular Dependency Resolution with Event-Driven Architecture
    
    Enhanced manager factory with circular dependency prevention:
    - 5-stage initialization system (eliminates deadlocks)
    - Event bus integration for manager communication
    - Lazy loading proxies for circular dependency resolution
    - Enhanced IManager interface standardization
    - Dependency injection container integration
    - 16 managers organized by dependency-safe stages
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.managers = {}
        self.manager_configs = {}
        self.initialization_order = []
        self.status_map = {}
        
        # PHASE 6: Dependency injection container
        self.event_bus = None  # Will be initialized first
        self.dependency_container = None  # Will be created after event bus
        
        # Results tracking
        self.initialization_successful = False
        self.failed_managers = []
        self.initialization_log = []
        self.performance_metrics = {}
        
        # PHASE 6: Circular dependency prevention
        self.circular_dependencies_resolved = 0
        self.stage_initialization_times = {}
        
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
        # PHASE 7 OPTIMIZATION: UnifiedRiskManager replaces separate risk components
        from risk.unified_risk_manager import UnifiedRiskManager
        from core.strategy_coordinator import StrategyCoordinator
        from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
        from helpers.option_chain_manager import OptionChainManager
        from helpers.option_order_executor import OptionOrderExecutor
        from helpers.future_options_manager import FutureOptionsManager
        # PHASE 6: Additional imports for proper cache manager
        from core.market_data_cache import MarketDataCacheManager
        
        # PHASE 5 OPTIMIZATION: Event-Driven Architecture Components
        from core.event_bus import EventBus
        from core.central_greeks_service import CentralGreeksService
        from core.event_driven_optimizer import EventDrivenOptimizer
        
        # PHASE 6: 5-STAGE INITIALIZATION SYSTEM (Circular Dependency Safe)
        # Stage 1: Independent components (no dependencies)
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
            
            
            
            'event_calendar': ManagerConfig(
                name='event_calendar',
                class_type=QuantConnectEventCalendar,
                dependencies=[],
                required_methods=['is_earnings_week', 'get_next_expiration'],
                initialization_args=(self.algo,),
                critical=False,
                tier=1
            ),
            
            # PHASE 6: Event Bus - Foundation for circular dependency resolution
            'event_bus': ManagerConfig(
                name='event_bus',
                class_type=EventBus,
                dependencies=[],  # Stage 1: No dependencies
                required_methods=['subscribe', 'publish', 'get_statistics', 'publish_with_loop_detection'],
                initialization_args=(self.algo,),
                critical=True,
                tier=1  # Stage 1: Foundation component
            ),
            
            # PHASE 6: Performance tracker for metrics
            'performance_tracker': ManagerConfig(
                name='performance_tracker',
                class_type=SafePerformanceTracker,
                dependencies=[],  # Stage 1: Independent
                required_methods=['add_trade_pnl', 'get_statistics'],
                initialization_args=(self.algo,),
                critical=False,
                tier=1  # Stage 1
            )
        }
        
        # Stage 2: Foundation services (depend on Stage 1)
        core_managers = {
            'vix_manager': ManagerConfig(
                name='vix_manager',
                class_type=UnifiedVIXManager,
                dependencies=['data_validator'],  # Stage 2: Needs data validation
                required_methods=['get_current_vix', 'get_market_regime', 'get_vix_regime'],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'margin_manager': ManagerConfig(
                name='margin_manager',
                class_type=DynamicMarginManager,
                dependencies=[],  # Stage 2: Foundation service
                required_methods=['get_available_margin', 'check_margin_requirements'],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'cache_manager': ManagerConfig(
                name='cache_manager',
                class_type=MarketDataCacheManager,  # FIXED: Using proper cache manager
                dependencies=[],  # Stage 2: Foundation service  
                required_methods=['get_cached_price', 'get_market_conditions', 'cache_market_data'],
                initialization_args=(self.algo,),
                critical=False,
                tier=2
            ),
            
            'order_recovery': ManagerConfig(
                name='order_recovery',
                class_type=OrderStateRecovery,
                dependencies=[],  # Stage 2: Foundation service, state coordination via events
                required_methods=['recover_pending_orders', 'save_order_state'],
                initialization_args=(self.algo,),
                critical=True,
                tier=2
            ),
            
            'unified_risk_manager': ManagerConfig(
                name='unified_risk_manager',
                class_type=UnifiedRiskManager,
                dependencies=['performance_tracker'],  # Stage 2: Needs performance data from stage 1
                required_methods=['can_open_position', 'on_position_opened', 'on_position_closed', 'get_risk_status'],
                initialization_args=(self.algo,),
                critical=True,  # Risk management is always critical
                tier=2
            )
        }
        
        # Stage 3: Core managers (depend on Stage 2 foundation services)
        advanced_managers = {
            'position_sizer': ManagerConfig(
                name='position_sizer',
                class_type=UnifiedPositionSizer,
                dependencies=['vix_manager', 'margin_manager'],  # Stage 3: Needs VIX and margin
                required_methods=['calculate_position_size', 'get_strategy_limits'],
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'state_manager': ManagerConfig(
                name='state_manager',
                class_type=UnifiedStateManager,
                dependencies=['vix_manager'],  # Stage 3: Needs VIX for state decisions (moved from stage 2)
                required_methods=[
                    'register_strategy',
                    'update_system_state', 
                    'get_system_summary',
                    'save_all_states'
                ],
                initialization_args=(self.algo,),
                critical=True,
                tier=3
            ),
            
            'greeks_monitor': ManagerConfig(
                name='greeks_monitor',
                class_type=CentralGreeksService,
                dependencies=['event_bus', 'data_validator'],  # Stage 3: Needs event bus and data validation
                required_methods=['get_portfolio_greeks', 'monitor_greeks_thresholds'],
                initialization_args=(self.algo, None),
                initialization_kwargs={'event_bus': 'event_bus'},
                critical=True,
                tier=3
            ),
            
            'option_chain_manager': ManagerConfig(
                name='option_chain_manager',
                class_type=OptionChainManager,
                dependencies=['data_validator'],  # Stage 3: Needs data validation
                required_methods=['get_option_chain', 'filter_liquid_options'],
                initialization_args=(self.algo,),
                critical=False,
                tier=3
            )
        }
        
        # Stage 4: Integration managers (depend on Stage 3 core managers)
        coordination_managers = {
            'strategy_coordinator': ManagerConfig(
                name='strategy_coordinator',
                class_type=StrategyCoordinator,
                dependencies=[
                    'state_manager',
                    'position_sizer', 
                    'unified_risk_manager'
                ],  # Stage 4: Integration level dependencies
                required_methods=[
                    'register_strategy',
                    'execute_strategies',
                    'emergency_halt_all'
                ],
                initialization_args=(self.algo,),
                critical=True,
                tier=4
            ),
            
            
            # PHASE 6: Event-Driven Performance Optimizer
            'event_driven_optimizer': ManagerConfig(
                name='event_driven_optimizer',
                class_type=EventDrivenOptimizer,
                dependencies=['event_bus', 'greeks_monitor'],  # Stage 4: Needs event bus and Greeks service
                required_methods=['optimize_ondata_performance', 'get_optimization_statistics'],
                initialization_args=(self.algo, None, None),
                initialization_kwargs={
                    'event_bus': 'event_bus',
                    'greeks_service': 'greeks_monitor'
                },
                critical=True,
                tier=4
            )
        }
        
        # Stage 5: Execution managers (final tier - depend on all previous stages)
        execution_managers = {
            # FIXED: atomic_executor must be in earlier stage since option_executor depends on it
            'atomic_executor': ManagerConfig(
                name='atomic_executor',
                class_type=EnhancedAtomicOrderExecutor,
                dependencies=['order_recovery', 'margin_manager'],  # Stage 5: Final execution layer
                required_methods=['execute_atomic_order', 'validate_order_feasibility'],
                initialization_args=(self.algo,),
                critical=True,
                tier=5
            ),
            
            # FIXED: option_executor in later stage since it depends on atomic_executor
            'option_executor': ManagerConfig(
                name='option_executor',
                class_type=OptionOrderExecutor,
                dependencies=['atomic_executor', 'option_chain_manager'],  # Stage 5: Needs atomic execution (now properly ordered)
                required_methods=['place_option_limit_order', 'place_iron_condor_orders'],
                initialization_args=(self.algo,),
                critical=True,
                tier=5
            ),
            
            'futures_manager': ManagerConfig(
                name='futures_manager',
                class_type=FutureOptionsManager,
                dependencies=['option_chain_manager'],  # Stage 5: Future options execution
                required_methods=['add_future_option_safely', 'get_option_chain_safely'],
                initialization_args=(self.algo,),
                critical=False,
                tier=5
            )
        }
        
        # Combine all manager configurations (5-stage system)
        self.manager_configs = {
            **foundation_managers,      # Stage 1
            **core_managers,           # Stage 2  
            **advanced_managers,       # Stage 3
            **coordination_managers,   # Stage 4
            **execution_managers       # Stage 5
        }
        
        self.algo.Debug(f"[ManagerFactory] Defined {len(self.manager_configs)} managers across 5 stages")
        
        # Log stage distribution  
        stage_counts = {}
        for config in self.manager_configs.values():
            stage_counts[config.tier] = stage_counts.get(config.tier, 0) + 1
        
        self.algo.Debug(f"[ManagerFactory] Stage distribution: {dict(sorted(stage_counts.items()))}")
    
    def resolve_initialization_order(self) -> List[str]:
        """Resolve manager initialization order using tier-based + dependency resolution"""
        
        ordered = []
        
        # Process by tier to ensure proper layering
        # Convert ordered to set for O(1) lookups instead of O(n)
        ordered_set = set(ordered)
        
        for tier in sorted(set(config.tier for config in self.manager_configs.values())):
            tier_managers = [name for name, config in self.manager_configs.items() if config.tier == tier]
            
            # Within each tier, resolve dependencies
            tier_ordered = []
            remaining = set(tier_managers)
            
            # Pre-compute dependencies for each manager to avoid repeated access
            manager_deps = {name: set(self.manager_configs[name].dependencies) for name in remaining}
            
            while remaining:
                # Find managers with no unresolved dependencies in this tier (O(n) instead of O(n²))
                ready = [name for name in remaining 
                        if manager_deps[name].issubset(ordered_set)]
                
                if not ready:
                    # Circular dependency within tier
                    self.algo.Error(f"[ManagerFactory] Circular dependency in tier {tier}: {remaining}")
                    # Add remaining in alphabetical order to break deadlock
                    ready = sorted(list(remaining))
                
                # Add ready managers to tier order (batch update ordered_set)
                ready_sorted = sorted(ready)
                for name in ready_sorted:
                    tier_ordered.append(name)
                    remaining.discard(name)
                    ordered_set.add(name)  # Keep ordered_set synchronized
            
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
    
    def initialize_all_managers_with_dependency_container(self) -> Tuple[bool, Dict]:
        """
        PHASE 6: Initialize all managers using dependency container with circular dependency resolution
        
        Uses 5-stage initialization system to prevent deadlocks and circular dependencies
        """
        
        import time
        start_time = time.time()
        
        self.algo.Log("[ManagerFactory] PHASE 6: Starting dependency-safe 5-stage initialization")
        
        # Define managers
        self.define_all_managers()
        
        # Initialize event bus first (foundation for dependency resolution)
        if not self._initialize_event_bus():
            self.algo.Error("[ManagerFactory] PHASE 6: Event bus initialization FAILED - cannot continue")
            return False, {'error': 'Event bus initialization failed'}
        
        # Create dependency container
        self.dependency_container = DependencyContainer(self.algo, self.event_bus)
        
        # Register all manager factories with dependency container
        self._register_manager_factories()
        
        # Validate dependency graph
        validation_result = self.dependency_container.validate_dependency_graph()
        if not validation_result['valid']:
            self.algo.Error(f"[ManagerFactory] PHASE 6: Invalid dependency graph: {validation_result}")
            return False, {'error': 'Invalid dependency graph', 'details': validation_result}
        
        # Initialize managers using dependency container's 5-stage system
        initialization_success = self.dependency_container.initialize_all_managers()
        
        if initialization_success:
            # Transfer managers from dependency container to algorithm
            self._attach_managers_to_algorithm()
            
            # Verify critical managers
            critical_check = self.emergency_manager_check()
            if not critical_check:
                self.algo.Error("[ManagerFactory] PHASE 6: Critical manager validation FAILED")
                initialization_success = False
        
        total_duration = time.time() - start_time
        
        # Get comprehensive results
        container_stats = self.dependency_container.get_container_statistics()
        health_report = self.dependency_container.get_manager_health_report()
        
        result = {
            'success': initialization_success,
            'initialization_method': 'dependency_container_5_stage',
            'total_duration_ms': total_duration * 1000,
            'container_statistics': container_stats,
            'health_report': health_report,
            'circular_dependencies_resolved': container_stats.get('circular_dependencies_resolved', 0),
            'stage_performance': getattr(self.dependency_container, 'stage_initialization_times', {}),
            'managers_initialized': len(self.dependency_container.managers),
            'failed_managers': list(self.dependency_container.failed_initializations.keys())
        }
        
        if initialization_success:
            self.algo.Log(f"[ManagerFactory] PHASE 6: ✅ All managers initialized successfully in {total_duration*1000:.1f}ms")
            self.algo.Log(f"[ManagerFactory] PHASE 6: Circular dependencies resolved: {result['circular_dependencies_resolved']}")
        else:
            self.algo.Error(f"[ManagerFactory] PHASE 6: ❌ Manager initialization FAILED in {total_duration*1000:.1f}ms")
        
        self.initialization_successful = initialization_success
        return initialization_success, result
    
    def _initialize_event_bus(self) -> bool:
        """Initialize event bus as foundation component"""
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
self.event_bus = EventBus(self.algo)
            setattr(self.algo, 'event_bus', self.event_bus)
            self.managers['event_bus'] = self.event_bus
            
            # Verify event bus methods
            required_methods = ['subscribe', 'publish', 'get_statistics', 'publish_with_loop_detection']
            for method_name in required_methods:
                if not hasattr(self.event_bus, method_name) or not callable(getattr(self.event_bus, method_name)):
                    self.algo.Error(f"[ManagerFactory] Event bus missing method: {method_name}")
                    return False
            
            self.algo.Debug("[ManagerFactory] PHASE 6: Event bus initialized successfully")
            return True
            
        except Exception as e:
            self.algo.Error(f"[ManagerFactory] PHASE 6: Event bus initialization failed: {e}")
            return False
    
    def _register_manager_factories(self):
        """Register all manager factories with the dependency container"""
        
        for name, config in self.manager_configs.items():
            if name == 'event_bus':
                continue  # Already initialized
            
            # Create factory function that captures the config
            def create_manager_factory(manager_config):
                def factory():
                    try:
                    resolved_kwargs = manager_config.initialization_kwargs.copy()
                    for key, value in resolved_kwargs.items():
                    if isinstance(value, str) and value in self.dependency_container.managers:
                    resolved_kwargs[key] = self.dependency_container.managers[value]
                    except Exception as e:

                        # Log and handle unexpected exception

                        print(f'Unexpected exception: {e}')

                        raise
# Resolve kwargs with actual manager instances
                        
                        # Create manager instance
                        manager = manager_config.class_type(
                            *manager_config.initialization_args, 
                            **resolved_kwargs
                        )
                        
                        return manager
                        
                    except Exception as e:
                        self.algo.Error(f"[ManagerFactory] Factory for {manager_config.name} failed: {e}")
                        raise
                
                return factory
            
            # Register factory with dependency container
            factory = create_manager_factory(config)
            self.dependency_container.register_manager_factory(
                name, factory, config.dependencies
            )
        
        self.algo.Debug(f"[ManagerFactory] PHASE 6: Registered {len(self.manager_configs) - 1} manager factories")
    
    def _attach_managers_to_algorithm(self):
        """Attach successfully initialized managers to the algorithm"""
        
        for name, manager in self.dependency_container.managers.items():
            if not hasattr(self.algo, name):  # Don't override event_bus
                setattr(self.algo, name, manager)
                self.managers[name] = manager
        
        self.algo.Debug(f"[ManagerFactory] PHASE 6: Attached {len(self.dependency_container.managers)} managers to algorithm")
    
    def _initialize_single_manager(self, manager_name: str) -> bool:
        """Initialize a single manager with comprehensive error handling"""
        
        config = self.manager_configs[manager_name]
        
        try:
        for dep_name in config.dependencies:
        if dep_name not in self.managers:
        self.algo.Error(f"[ManagerFactory] {manager_name}: dependency '{dep_name}' not available")
        return False
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Verify dependencies are available
                    
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