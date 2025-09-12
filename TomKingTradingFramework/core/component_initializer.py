# Component Initialization System - Structured and Validated Component Setup
# Prevents initialization order issues and ensures all interfaces are available

from AlgorithmImports import *
from typing import Dict, List, Tuple, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum, auto

class ComponentStatus(Enum):
    """Component initialization status"""
    NOT_STARTED = auto()
    IN_PROGRESS = auto()
    COMPLETED = auto()
    FAILED = auto()
    DEPENDENCY_FAILED = auto()

@dataclass
class ComponentConfig:
    """Configuration for a single component"""
    name: str
    class_type: type
    dependencies: List[str]
    required_methods: List[str]
    initialization_args: Tuple = ()
    initialization_kwargs: Dict = None
    critical: bool = True  # If True, failure stops algorithm
    
    def __post_init__(self):
        if self.initialization_kwargs is None:
            self.initialization_kwargs = {}

class ComponentInitializer:
    """
    Manages structured component initialization with dependency resolution
    Ensures proper order and interface validation
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.components = {}
        self.component_configs = {}
        self.initialization_order = []
        self.status_map = {}
        
        # Initialization results
        self.initialization_successful = False
        self.failed_components = []
        self.initialization_log = []
        
    def define_components(self):
        """Define all components and their dependencies"""
        
        # Import all required classes
        from core.unified_vix_manager import UnifiedVIXManager
        from core.unified_state_manager import UnifiedStateManager
        from core.strategy_coordinator import StrategyCoordinator
        from core.unified_position_sizer import UnifiedPositionSizer
        from risk.circuit_breaker import CircuitBreaker
        from risk.dynamic_margin_manager import DynamicMarginManager
        from helpers.performance_tracker_safe import SafePerformanceTracker
        from helpers.quantconnect_event_calendar import QuantConnectEventCalendar
        from position_state_manager import PositionStateManagerQC
        from greeks.greeks_monitor import GreeksMonitor
        from risk.correlation_group_limiter import CorrelationGroupLimiter
        from validation.interface_validator import InterfaceValidator
        
        # Define component configurations with dependencies
        self.component_configs = {
            # TIER 1: Foundation components (no dependencies)
            'interface_validator': ComponentConfig(
                name='interface_validator',
                class_type=InterfaceValidator,
                dependencies=[],
                required_methods=['validate_all_interfaces', 'emergency_interface_check'],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'margin_manager': ComponentConfig(
                name='margin_manager', 
                class_type=DynamicMarginManager,
                dependencies=[],
                required_methods=['get_available_margin', 'check_margin_requirements'],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'event_calendar': ComponentConfig(
                name='event_calendar',
                class_type=QuantConnectEventCalendar,
                dependencies=[],
                required_methods=['is_earnings_week', 'get_next_expiration'],
                initialization_args=(self.algo,),
                critical=False
            ),
            
            # TIER 2: Core managers (depend on foundation)
            'vix_manager': ComponentConfig(
                name='vix_manager',
                class_type=UnifiedVIXManager,
                dependencies=['margin_manager'],
                required_methods=['get_current_vix', 'get_market_regime', 'get_vix_regime'],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'performance_tracker': ComponentConfig(
                name='performance_tracker',
                class_type=SafePerformanceTracker,
                dependencies=[],
                required_methods=['add_trade_pnl', 'get_statistics'],
                initialization_args=(self.algo,),
                critical=False
            ),
            
            'state_manager': ComponentConfig(
                name='state_manager',
                class_type=UnifiedStateManager,
                dependencies=['vix_manager'],
                required_methods=[
                    'register_strategy', 
                    'update_all_state_machines',  # This was the missing method!
                    'get_dashboard',
                    'save_all_states'
                ],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'position_state_manager': ComponentConfig(
                name='position_state_manager',
                class_type=PositionStateManagerQC,
                dependencies=[],
                required_methods=['update_positions', 'get_position_summary'],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'greeks_monitor': ComponentConfig(
                name='greeks_monitor',
                class_type=GreeksMonitor,
                dependencies=[],
                required_methods=['calculate_portfolio_greeks', 'get_position_greeks'],
                initialization_args=(self.algo,),
                critical=False
            ),
            
            # TIER 3: Advanced components (depend on core managers)
            'position_sizer': ComponentConfig(
                name='position_sizer',
                class_type=UnifiedPositionSizer,
                dependencies=['vix_manager', 'margin_manager'],
                required_methods=['calculate_position_size', 'get_available_buying_power'],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'circuit_breaker': ComponentConfig(
                name='circuit_breaker',
                class_type=CircuitBreaker,
                dependencies=['state_manager', 'performance_tracker'],
                required_methods=[
                    'check_drawdown_limits', 
                    'check_correlation_limits', 
                    'check_margin_limits'
                ],
                initialization_args=(self.algo,),
                critical=True
            ),
            
            'correlation_limiter': ComponentConfig(
                name='correlation_limiter',
                class_type=CorrelationGroupLimiter,
                dependencies=['position_state_manager'],
                required_methods=['check_correlation_limits', 'get_correlation_groups'],
                initialization_args=(self.algo,),
                critical=False
            ),
            
            # TIER 4: Strategy coordination (depends on all core systems)
            'strategy_coordinator': ComponentConfig(
                name='strategy_coordinator',
                class_type=StrategyCoordinator,
                dependencies=[
                    'state_manager', 
                    'position_sizer', 
                    'circuit_breaker',
                    'vix_manager'
                ],
                required_methods=[
                    'register_strategy',
                    'execute_strategies'  # This was called but interface never validated
                ],
                initialization_args=(self.algo,),
                critical=True
            )
        }
        
        self.algo.Log(f"[ComponentInitializer] Defined {len(self.component_configs)} components")
    
    def resolve_initialization_order(self) -> List[str]:
        """Resolve component initialization order based on dependencies"""
        
        ordered = []
        remaining = set(self.component_configs.keys())
        
        while remaining:
            # Find components with no unresolved dependencies
            ready = []
            for name in remaining:
                config = self.component_configs[name]
                deps_resolved = all(dep in ordered for dep in config.dependencies)
                if deps_resolved:
                    ready.append(name)
            
            if not ready:
                # Circular dependency detected
                self.algo.Error(f"[ComponentInitializer] Circular dependency detected in: {remaining}")
                break
            
            # Add ready components to order
            for name in sorted(ready):  # Sort for deterministic order
                ordered.append(name)
                remaining.remove(name)
        
        self.initialization_order = ordered
        self.algo.Log(f"[ComponentInitializer] Initialization order: {' -> '.join(ordered)}")
        return ordered
    
    def initialize_all_components(self) -> Tuple[bool, Dict]:
        """Initialize all components in dependency order"""
        
        self.algo.Log("[ComponentInitializer] Starting structured component initialization")
        
        # Define components and resolve order
        self.define_components()
        self.resolve_initialization_order()
        
        success_count = 0
        total_count = len(self.initialization_order)
        
        for component_name in self.initialization_order:
            self.status_map[component_name] = ComponentStatus.IN_PROGRESS
            
            success = self._initialize_single_component(component_name)
            
            if success:
                self.status_map[component_name] = ComponentStatus.COMPLETED
                success_count += 1
                self.algo.Log(f"[ComponentInitializer] ✅ {component_name} initialized ({success_count}/{total_count})")
            else:
                self.status_map[component_name] = ComponentStatus.FAILED
                self.failed_components.append(component_name)
                
                config = self.component_configs[component_name]
                if config.critical:
                    self.algo.Error(f"[ComponentInitializer] ❌ CRITICAL component {component_name} failed")
                    self._mark_dependent_components_failed(component_name)
                    break
                else:
                    self.algo.Log(f"[ComponentInitializer] ⚠️ Non-critical component {component_name} failed")
        
        self.initialization_successful = success_count == total_count and len(self.failed_components) == 0
        
        # Final validation using InterfaceValidator
        if self.initialization_successful and 'interface_validator' in self.components:
            validator = self.components['interface_validator']
            all_valid, errors = validator.validate_all_interfaces()
            
            if not all_valid:
                self.algo.Error(f"[ComponentInitializer] Interface validation failed: {errors}")
                self.initialization_successful = False
        
        result = {
            'success': self.initialization_successful,
            'total_components': total_count,
            'successful_components': success_count,
            'failed_components': self.failed_components,
            'component_status': {name: status.name for name, status in self.status_map.items()},
            'initialization_log': self.initialization_log
        }
        
        if self.initialization_successful:
            self.algo.Log(f"[ComponentInitializer] 🎉 All components initialized successfully!")
        else:
            self.algo.Error(f"[ComponentInitializer] 💥 Component initialization FAILED")
        
        return self.initialization_successful, result
    
    def _initialize_single_component(self, component_name: str) -> bool:
        """Initialize a single component with error handling"""
        
        config = self.component_configs[component_name]
        
        try:
            for dep_name in config.dependencies:
                if dep_name not in self.components:
                    self.algo.Error(f"[ComponentInitializer] {component_name}: dependency {dep_name} not available")
        return False
        except Exception as e:

            # Check dependencies are available
            
            # Initialize component
            component = config.class_type(*config.initialization_args, **config.initialization_kwargs)
            
            # Validate required methods exist
            missing_methods = []
            for method_name in config.required_methods:
                if not hasattr(component, method_name):
                    missing_methods.append(method_name)
                elif not callable(getattr(component, method_name)):
                    missing_methods.append(f"{method_name} (not callable)")
            
            if missing_methods:
                self.algo.Error(f"[ComponentInitializer] {component_name}: missing methods {missing_methods}")
                return False
            
            # Store component
            self.components[component_name] = component
            setattr(self.algo, component_name, component)
            
            # Log success
            log_entry = f"{component_name}: initialized with methods {config.required_methods}"
            self.initialization_log.append(log_entry)
            
            return True
            
        except Exception as e:
            error_msg = f"{component_name}: initialization failed - {str(e)}"
            self.algo.Error(f"[ComponentInitializer] {error_msg}")
            self.initialization_log.append(error_msg)
            return False
    
    def _mark_dependent_components_failed(self, failed_component: str):
        """Mark all components that depend on failed component as failed"""
        
        for name, config in self.component_configs.items():
            if failed_component in config.dependencies:
                self.status_map[name] = ComponentStatus.DEPENDENCY_FAILED
                self.failed_components.append(name)
                self.algo.Error(f"[ComponentInitializer] {name}: failed due to dependency {failed_component}")
    
    def get_initialization_status(self) -> Dict:
        """Get comprehensive initialization status"""
        
        return {
            'successful': self.initialization_successful,
            'component_count': len(self.component_configs),
            'success_count': len([s for s in self.status_map.values() if s == ComponentStatus.COMPLETED]),
            'failed_count': len(self.failed_components),
            'component_status': {name: status.name for name, status in self.status_map.items()},
            'failed_components': self.failed_components,
            'initialization_order': self.initialization_order,
            'available_components': list(self.components.keys())
        }
    
    def emergency_component_check(self) -> bool:
        """Quick emergency check for critical components"""
        
        critical_components = ['vix_manager', 'state_manager', 'strategy_coordinator']
        
        for name in critical_components:
            if name not in self.components:
                self.algo.Error(f"[ComponentInitializer] EMERGENCY: Critical component {name} not available")
                return False
                
            component = self.components[name]
            config = self.component_configs.get(name)
            
            if config:
                for method_name in config.required_methods:
                    if not hasattr(component, method_name):
                        self.algo.Error(f"[ComponentInitializer] EMERGENCY: {name}.{method_name} not available")
                        return False
        
        self.algo.Log("[ComponentInitializer] Emergency component check passed")
        return True