# Plugin Architecture Patterns

## Overview
Plugin architecture patterns for creating extensible, type-safe component systems using Python Protocols. This methodology consolidates multiple similar components into unified plugin-based systems while maintaining complete backward compatibility.

**Use Case:** When you need to unify multiple similar components (risk managers, validators, processors) into a single coordinated system with standardized interfaces.

## Core Pattern: Protocol-Based Plugin Interface

### The Plugin Protocol
```python
from typing import Protocol, Dict, List, Optional, Any
from abc import abstractmethod

class IRiskPlugin(Protocol):
    """Protocol defining the interface all risk plugins must implement"""
    
    @property
    def plugin_name(self) -> str:
        """Unique name identifying this plugin"""
        ...
    
    @property  
    def plugin_version(self) -> str:
        """Version string for compatibility checking"""
        ...
    
    def initialize(self, algorithm, config: Dict[str, Any] = None) -> bool:
        """Initialize plugin with algorithm instance and configuration"""
        ...
    
    def can_open_position(self, symbol: str, strategy_name: str, 
                         position_details: Dict[str, Any]) -> tuple[bool, str]:
        """Check if position can be opened based on this plugin's rules"""
        ...
    
    def on_position_opened(self, symbol: str, strategy_name: str,
                          position_details: Dict[str, Any]) -> None:
        """Notification when position is successfully opened"""
        ...
    
    def on_position_closed(self, symbol: str, strategy_name: str,
                          position_details: Dict[str, Any]) -> None:
        """Notification when position is closed"""
        ...
    
    def get_status(self) -> Dict[str, Any]:
        """Get current plugin status and metrics"""
        ...
```

**Why Protocol Instead of ABC:** 
- Structural typing - any class implementing these methods satisfies the protocol
- No inheritance required - plugins can inherit from domain-specific base classes
- Type checker support for interface compliance verification
- Runtime flexibility for dynamic plugin loading

### Base Plugin Implementation

```python
from abc import ABC, abstractmethod

class BaseRiskPlugin(ABC):
    """Abstract base class providing shared plugin functionality"""
    
    def __init__(self):
        self.algorithm = None
        self.is_initialized = False
        self.last_error = None
        
    def initialize(self, algorithm, config: Dict[str, Any] = None) -> bool:
        """Template method for plugin initialization"""
        try:
            self.algorithm = algorithm
            success = self._plugin_initialize(config or {})
            self.is_initialized = success
            return success
        except Exception as e:
            self.last_error = str(e)
            self.algorithm.Log(f"Plugin {self.plugin_name} initialization failed: {e}")
            return False
    
    @abstractmethod
    def _plugin_initialize(self, config: Dict[str, Any]) -> bool:
        """Concrete plugins override this for specific initialization logic"""
        pass
    
    @abstractmethod
    def plugin_name(self) -> str:
        """Each plugin must provide its unique name"""
        pass
    
    @abstractmethod
    def plugin_version(self) -> str:
        """Each plugin must provide version for compatibility"""
        pass
    
    # Standard error handling and logging methods
    def _log_error(self, message: str, exception: Exception = None):
        """Standardized error logging with plugin context"""
        full_message = f"[{self.plugin_name}] {message}"
        if exception:
            full_message += f" - {str(exception)}"
        self.algorithm.Log(full_message)
        self.last_error = full_message
```

**Template Method Pattern:** `initialize()` provides the framework, `_plugin_initialize()` allows customization.

## Event-Driven Plugin Communication

### Risk Event System
```python
from enum import Enum
from datetime import datetime

class RiskEventType(Enum):
    """Standardized event types for cross-plugin communication"""
    CIRCUIT_BREAKER_TRIGGERED = "circuit_breaker_triggered"
    CORRELATION_LIMIT_EXCEEDED = "correlation_limit_exceeded" 
    CONCENTRATION_LIMIT_EXCEEDED = "concentration_limit_exceeded"
    RECOVERY_CONDITIONS_MET = "recovery_conditions_met"

class RiskLevel(Enum):
    """Risk severity levels for event priority"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

class RiskEvent:
    """Standardized event object for plugin communication"""
    
    def __init__(self, event_type: RiskEventType, level: RiskLevel,
                 message: str, data: Dict[str, Any] = None):
        self.event_type = event_type
        self.level = level 
        self.message = message
        self.data = data or {}
        self.timestamp = datetime.utcnow()
        
    def to_dict(self) -> Dict[str, Any]:
        """Serializable representation for logging/storage"""
        return {
            'event_type': self.event_type.value,
            'level': self.level.value,
            'message': self.message,
            'data': self.data,
            'timestamp': self.timestamp.isoformat()
        }
```

### Event Bus Implementation
```python
class RiskEventBus:
    """Mediates communication between plugins without direct coupling"""
    
    def __init__(self):
        self._subscribers: Dict[RiskEventType, List[callable]] = {}
        self._all_subscribers: List[callable] = []  # Listen to all events
        
    def subscribe(self, event_type: RiskEventType, handler: callable):
        """Subscribe to specific event type"""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        
    def subscribe_all(self, handler: callable):
        """Subscribe to all events (useful for logging)"""
        self._all_subscribers.append(handler)
        
    def publish(self, event: RiskEvent):
        """Publish event to all subscribers"""
        # Notify specific event subscribers
        if event.event_type in self._subscribers:
            for handler in self._subscribers[event.event_type]:
                try:
                    handler(event)
                except Exception as e:
                    # Don't let subscriber errors break the bus
                    print(f"Event handler error: {e}")
        
        # Notify all-event subscribers  
        for handler in self._all_subscribers:
            try:
                handler(event)
            except Exception as e:
                print(f"All-event handler error: {e}")
```

## Unified Manager with Plugin Coordination

### Manager Implementation
```python
class UnifiedRiskManager:
    """Coordinates multiple risk plugins through standardized interface"""
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.plugins: List[IRiskPlugin] = []
        self.event_bus = RiskEventBus()
        
        # Subscribe to all events for centralized logging
        self.event_bus.subscribe_all(self._log_risk_event)
    
    def register_plugin(self, plugin: IRiskPlugin) -> bool:
        """Register and initialize a risk plugin"""
        if not plugin.initialize(self.algorithm):
            self.algorithm.Log(f"Failed to initialize plugin: {plugin.plugin_name}")
            return False
            
        self.plugins.append(plugin)
        self.algorithm.Log(f"Registered risk plugin: {plugin.plugin_name} v{plugin.plugin_version}")
        return True
    
    def can_open_position(self, symbol: str, strategy_name: str,
                         position_details: Dict[str, Any]) -> tuple[bool, str]:
        """Check all plugins - ANY plugin can veto position opening"""
        
        for plugin in self.plugins:
            try:
                can_open, reason = plugin.can_open_position(symbol, strategy_name, position_details)
                if not can_open:
                    # Plugin rejected - create warning event
                    event = RiskEvent(
                        event_type=RiskEventType.POSITION_BLOCKED,
                        level=RiskLevel.WARNING,
                        message=f"Position blocked by {plugin.plugin_name}: {reason}",
                        data={'symbol': symbol, 'strategy': strategy_name, 'reason': reason}
                    )
                    self.event_bus.publish(event)
                    return False, f"{plugin.plugin_name}: {reason}"
                    
            except Exception as e:
                # Plugin error - fail safe by rejecting position
                error_msg = f"Plugin {plugin.plugin_name} error during position check: {e}"
                self.algorithm.Log(error_msg)
                return False, error_msg
        
        return True, "All risk checks passed"
    
    def on_position_opened(self, symbol: str, strategy_name: str,
                          position_details: Dict[str, Any]) -> None:
        """Notify all plugins of successful position opening"""
        for plugin in self.plugins:
            try:
                plugin.on_position_opened(symbol, strategy_name, position_details)
            except Exception as e:
                self.algorithm.Log(f"Plugin {plugin.plugin_name} error in on_position_opened: {e}")
    
    def _log_risk_event(self, event: RiskEvent):
        """Centralized risk event logging"""
        self.algorithm.Log(f"[RISK EVENT] {event.level.value.upper()}: {event.message}")
```

## Plugin Implementation Example

### Concrete Plugin Implementation
```python
class CorrelationPlugin(BaseRiskPlugin):
    """Correlation risk management plugin"""
    
    @property
    def plugin_name(self) -> str:
        return "CorrelationRiskPlugin"
    
    @property 
    def plugin_version(self) -> str:
        return "2.0.0"
    
    def _plugin_initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize correlation groups and limits"""
        self.correlation_groups = {
            'A1': ['ES', 'MES', 'NQ', 'MNQ'],  # Equity Indices
            'A2': ['SPY', 'QQQ', 'IWM'],      # Equity ETFs
        }
        self.max_positions_per_group = config.get('max_positions_per_group', 3)
        self.current_positions = {}  # Track active positions per group
        return True
    
    def can_open_position(self, symbol: str, strategy_name: str,
                         position_details: Dict[str, Any]) -> tuple[bool, str]:
        """Check correlation limits before position opening"""
        correlation_group = self._get_correlation_group(symbol)
        if not correlation_group:
            return True, "Symbol not in correlation groups"
        
        current_count = len(self.current_positions.get(correlation_group, set()))
        if current_count >= self.max_positions_per_group:
            return False, f"Correlation limit reached: {current_count}/{self.max_positions_per_group} in group {correlation_group}"
        
        return True, "Correlation check passed"
    
    def on_position_opened(self, symbol: str, strategy_name: str,
                          position_details: Dict[str, Any]) -> None:
        """Track new position in correlation groups"""
        correlation_group = self._get_correlation_group(symbol)
        if correlation_group:
            if correlation_group not in self.current_positions:
                self.current_positions[correlation_group] = set()
            self.current_positions[correlation_group].add(symbol)
    
    def _get_correlation_group(self, symbol: str) -> Optional[str]:
        """Find which correlation group a symbol belongs to"""
        for group_name, symbols in self.correlation_groups.items():
            if symbol in symbols:
                return group_name
        return None
```

## Backward Compatibility Strategies

### Compatibility Layer Pattern
```python
class UnifiedRiskManager:
    # ... existing code ...
    
    # CRITICAL: Backward compatibility methods for existing strategies
    def check_correlation_limits(self, symbol: str, strategy_name: str) -> tuple[bool, str]:
        """Legacy method - delegates to modern plugin system"""
        return self.can_open_position(symbol, strategy_name, {'legacy_call': True})
    
    def request_spy_allocation(self, strategy_name: str, requested_delta: float) -> tuple[bool, str]:
        """Legacy SPY concentration method - delegates to concentration plugin"""
        concentration_plugin = self._get_plugin('ConcentrationPlugin')
        if concentration_plugin and hasattr(concentration_plugin, 'request_spy_allocation'):
            return concentration_plugin.request_spy_allocation(strategy_name, requested_delta)
        return True, "No concentration plugin active"
    
    def ShouldDefend(self, position_info: Dict) -> bool:
        """Legacy defense method - delegates to correlation plugin"""
        correlation_plugin = self._get_plugin('CorrelationRiskPlugin') 
        if correlation_plugin and hasattr(correlation_plugin, 'ShouldDefend'):
            return correlation_plugin.ShouldDefend(position_info)
        return False  # Safe default
    
    def _get_plugin(self, plugin_name: str) -> Optional[IRiskPlugin]:
        """Find plugin by name for compatibility delegation"""
        for plugin in self.plugins:
            if plugin.plugin_name == plugin_name:
                return plugin
        return None
```

**Why This Approach:** Existing strategies can continue using familiar method names while benefiting from the new plugin architecture underneath.

## Integration Pattern

### Manager Factory Integration
```python
# OLD: Multiple separate risk managers
'correlation_limiter': ManagerConfig(
    name='correlation_limiter',
    class_type=August2024CorrelationLimiter,
    dependencies=['performance_tracker'],
    required_methods=['check_correlation_limits'],
    initialization_args=(self.algo,),
    critical=False,
    tier=2
),

'spy_concentration_manager': ManagerConfig(
    name='spy_concentration_manager', 
    class_type=SPYConcentrationManager,
    dependencies=['position_sizer'],
    required_methods=['request_spy_allocation'],
    initialization_args=(self.algo,),
    critical=True,
    tier=4
),

# NEW: Single unified risk manager with plugins
'unified_risk_manager': ManagerConfig(
    name='unified_risk_manager',
    class_type=UnifiedRiskManager,
    dependencies=['performance_tracker'],
    required_methods=['can_open_position', 'on_position_opened', 'on_position_closed'],
    initialization_args=(self.algo,),
    critical=True,  # Risk management is always critical
    tier=2
)
```

### Plugin Registration in main.py
```python
def initialize_unified_risk_management(self):
    """Initialize unified risk management with all plugins"""
    risk_manager = self.unified_risk_manager
    
    # Register all risk plugins
    from risk.plugins.correlation_plugin import CorrelationPlugin
    from risk.plugins.circuit_breaker_plugin import CircuitBreakerPlugin  
    from risk.plugins.concentration_plugin import ConcentrationPlugin
    
    plugins = [
        CorrelationPlugin(),
        CircuitBreakerPlugin(), 
        ConcentrationPlugin()
    ]
    
    for plugin in plugins:
        success = risk_manager.register_plugin(plugin)
        if not success:
            self.Log(f"CRITICAL: Failed to register {plugin.plugin_name}")
            raise Exception(f"Risk plugin registration failed: {plugin.plugin_name}")
    
    self.Log(f"Risk management initialized with {len(plugins)} plugins")
    
    # Create backward compatibility aliases
    self.correlation_limiter = risk_manager  # Strategies can still call self.correlation_limiter.check_correlation_limits()
    self.spy_concentration_manager = risk_manager  # Strategies can still call self.spy_concentration_manager.request_spy_allocation()
    self.circuit_breaker = risk_manager
```

## When to Use This Pattern

### ✅ GOOD USE CASES:
- **Multiple similar components** (risk managers, validators, processors)
- **Need for uniform interface** across different implementations
- **Extensibility requirements** - adding new plugins without core changes
- **Cross-component communication** via event system
- **Backward compatibility** during architectural transitions

### ❌ AVOID FOR:
- **Single-purpose components** - Protocol overhead not worth it
- **Simple delegation** - Direct composition is cleaner
- **Performance-critical code** - Plugin dispatch adds overhead
- **Components with vastly different interfaces** - Protocol becomes unwieldy

## Benefits

### 🎯 **Type Safety**
- Protocol interface ensures compile-time method checking
- Generic typing support: `List[IRiskPlugin]`
- IDE autocomplete for plugin methods

### 🔧 **Extensibility** 
- Add new plugins without changing core manager
- Plugins can be developed independently
- Easy A/B testing of different risk approaches

### 🔗 **Decoupling**
- Plugins don't know about each other directly
- Event bus provides indirect communication
- Easy to disable/enable individual plugins

### ⚖️ **Consistency**
- Standardized lifecycle (initialize, process, cleanup)
- Uniform error handling across all plugins
- Centralized logging and monitoring

## Anti-Patterns to Avoid

### ❌ WRONG: Inheritance-Heavy Hierarchies
```python
# Don't do this - creates tight coupling
class RiskManager:
    pass

class CorrelationManager(RiskManager):
    pass
    
class CircuitBreaker(RiskManager): 
    pass
```

### ✅ CORRECT: Protocol-Based Composition
```python
# Plugin implements Protocol, inherits domain logic if needed
class CorrelationPlugin(BaseRiskPlugin):  # Protocol satisfaction + shared utilities
    pass
```

### ❌ WRONG: Direct Plugin-to-Plugin Communication
```python
# Don't let plugins call each other directly
def can_open_position(self, ...):
    if self.manager.circuit_breaker_plugin.is_triggered():  # BAD
        return False
```

### ✅ CORRECT: Event-Driven Communication
```python
# Publish events, let interested plugins subscribe
def can_open_position(self, ...):
    event = RiskEvent(RiskEventType.POSITION_CHECK, ...)
    self.manager.event_bus.publish(event)
```

## Production Lessons

### 🚨 **Critical Discovery: Missing Backward Compatibility**
Systematic testing revealed that existing strategies were calling methods like `ShouldDefend()` and `request_spy_allocation()` that didn't exist in the new plugin system. 

**Solution:** Backward compatibility layer in the unified manager that delegates to plugins using familiar method names.

**Lesson:** Always audit existing callers before changing public interfaces, even during internal refactoring.

### 📊 **Plugin Registration Validation**
```python
def register_plugin(self, plugin: IRiskPlugin) -> bool:
    # CRITICAL: Validate plugin satisfies protocol
    required_methods = ['can_open_position', 'on_position_opened', 'on_position_closed']
    for method_name in required_methods:
        if not hasattr(plugin, method_name):
            self.algorithm.Log(f"Plugin {plugin.plugin_name} missing required method: {method_name}")
            return False
    
    # Initialize and validate
    if not plugin.initialize(self.algorithm):
        return False
        
    self.plugins.append(plugin)
    return True
```

**Lesson:** Fail fast during plugin registration rather than during runtime risk checks.

## File Organization Pattern

```
risk/
├── unified_risk_manager.py          # Main coordinator
├── plugins/
│   ├── __init__.py                  # Plugin discovery
│   ├── correlation_plugin.py        # Correlation limits
│   ├── circuit_breaker_plugin.py    # Emergency stops
│   └── concentration_plugin.py      # Position concentration
└── BACKUP_PHASE7_OLD_RISK_MANAGERS/ # Preserved originals
    ├── correlation_manager.py.backup
    ├── circuit_breaker.py.backup
    └── spy_concentration_manager.py.backup
```

**Backup Strategy:** Always preserve original implementations during major architectural changes. Git history alone isn't sufficient - explicit backup directories provide immediate rollback capability.

## Summary

The Plugin Architecture Pattern provides a systematic way to unify multiple similar components while maintaining type safety, extensibility, and backward compatibility. Use it when you need to consolidate multiple managers/processors into a coordinated system with uniform interfaces.

**Key Success Factors:**
1. **Protocol-first design** for interface contracts
2. **Event-driven communication** for decoupling  
3. **Backward compatibility layer** for seamless migration
4. **Comprehensive error handling** at plugin boundaries
5. **Systematic testing** of existing integration points

This pattern consolidates multiple separate risk managers into unified systems while preserving all August 5, 2024 safety protections and maintaining complete backward compatibility.