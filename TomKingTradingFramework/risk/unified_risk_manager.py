# Unified Risk Management System with Plugin Architecture
# Implements FRAMEWORK_OPTIMIZATION_PROTOCOL.md Phase 7 requirements
# Consolidates 4 separate risk management components into unified system

from AlgorithmImports import *
from typing import Dict, List, Optional, Any, Protocol
from abc import ABC, abstractmethod
from enum import Enum
import traceback
from datetime import datetime, timedelta
from core.dependency_container import IManager
from config.constants import TradingConstants

class RiskEventType(Enum):
    """Types of risk events that can occur"""
    CIRCUIT_BREAKER_TRIGGERED = "circuit_breaker_triggered"
    CORRELATION_LIMIT_EXCEEDED = "correlation_limit_exceeded"
    CONCENTRATION_LIMIT_EXCEEDED = "concentration_limit_exceeded"
    MARGIN_THRESHOLD_EXCEEDED = "margin_threshold_exceeded"
    POSITION_SIZE_VIOLATION = "position_size_violation"
    VIX_EMERGENCY = "vix_emergency"
    PORTFOLIO_DRAWDOWN = "portfolio_drawdown"
    RECOVERY_CONDITIONS_MET = "recovery_conditions_met"

class RiskLevel(Enum):
    """Risk severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"

class RiskEvent:
    """Standardized risk event for plugin communication"""
    
    def __init__(self, event_type: RiskEventType, level: RiskLevel, 
                 message: str, data: Dict[str, Any] = None):
        self.event_type = event_type
        self.level = level
        self.message = message
        self.data = data or {}
        self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'event_type': self.event_type.value,
            'level': self.level.value,
            'message': self.message,
            'data': self.data,
            'timestamp': self.timestamp.isoformat()
        }

class IRiskPlugin(Protocol):
    """Interface that all risk plugins must implement"""
    
    @property
    def plugin_name(self) -> str:
        """Unique name for this plugin"""
        ...
    
    @property
    def plugin_version(self) -> str:
        """Version of this plugin"""
        ...
    
    def initialize(self, algorithm, event_bus) -> bool:
        """Initialize the plugin with algorithm reference and event bus"""
        ...
    
    def can_open_position(self, symbol: str, quantity: int, 
                         context: Dict[str, Any] = None) -> tuple[bool, str]:
        """Check if position can be opened"""
        ...
    
    def on_position_opened(self, symbol: str, quantity: int, 
                          fill_price: float, context: Dict[str, Any] = None):
        """Handle position opened event"""
        ...
    
    def on_position_closed(self, symbol: str, quantity: int, 
                          fill_price: float, pnl: float, context: Dict[str, Any] = None):
        """Handle position closed event"""
        ...
    
    def on_market_data(self, symbol: str, data: Any):
        """Handle new market data"""
        ...
    
    def periodic_check(self) -> List[RiskEvent]:
        """Perform periodic risk checks, return any events"""
        ...
    
    def get_risk_metrics(self) -> Dict[str, Any]:
        """Get current risk metrics from this plugin"""
        ...
    
    def shutdown(self):
        """Clean shutdown of plugin"""
        ...

class BaseRiskPlugin(ABC):
    """Base class for risk plugins with common functionality"""
    
    def __init__(self):
        self._initialized = False
        self._enabled = True
        self._algorithm = None
        self._event_bus = None
        self._last_check_time = None
        self._error_count = 0
        self._max_errors = 10
    
    @property
    @abstractmethod
    def plugin_name(self) -> str:
        ...
    
    @property
    @abstractmethod
    def plugin_version(self) -> str:
        ...
    
    def initialize(self, algorithm, event_bus) -> bool:
        """Base initialization"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
self._algorithm = algorithm
            self._event_bus = event_bus
            self._initialized = self._plugin_initialize()
            
            if self._initialized:
                self._algorithm.Log(f"[Risk Plugin] {self.plugin_name} v{self.plugin_version} initialized")
            else:
                self._algorithm.Error(f"[Risk Plugin] {self.plugin_name} initialization failed")
            
            return self._initialized
        except Exception as e:
            self._algorithm.Error(f"[Risk Plugin] {self.plugin_name} initialization error: {e}")
            return False
    
    @abstractmethod
    def _plugin_initialize(self) -> bool:
        """Plugin-specific initialization"""
        ...
    
    def _safe_execute(self, operation_name: str, operation):
        """Safely execute plugin operation with error handling"""
        if not self._enabled:
            return None
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
return operation()
        except Exception as e:
            self._error_count += 1
            self._algorithm.Error(
                f"[Risk Plugin] {self.plugin_name} error in {operation_name}: {e}"
            )
            
            # Disable plugin if too many errors
            if self._error_count >= self._max_errors:
                self._enabled = False
                self._algorithm.Error(
                    f"[Risk Plugin] {self.plugin_name} disabled due to excessive errors"
                )
            
            return None
    
    def _emit_event(self, event_type: RiskEventType, level: RiskLevel, 
                   message: str, data: Dict[str, Any] = None):
        """Emit risk event through event bus"""
        if self._event_bus:
            event = RiskEvent(event_type, level, message, data)
            self._event_bus.emit_risk_event(event)

class UnifiedRiskManager(IManager):
    """
    Unified Risk Management System implementing plugin architecture.
    Replaces separate August2024CorrelationLimiter, SPYConcentrationManager, 
    CircuitBreaker, and other risk components per FRAMEWORK_OPTIMIZATION_PROTOCOL.md
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.plugins: List[IRiskPlugin] = []
        self.plugin_registry: Dict[str, IRiskPlugin] = {}
        
        # Event bus for plugin communication
        self.event_bus = RiskEventBus(algorithm)
        
        # Consolidated risk metrics
        self.risk_metrics = {
            'overall_risk_score': 0.0,
            'position_count': 0,
            'correlation_risk': 0.0,
            'concentration_risk': 0.0,
            'circuit_breaker_status': 'enabled',
            'margin_utilization': 0.0,
            'portfolio_value': 0.0,
            'drawdown': 0.0,
            'last_update': algorithm.Time
        }
        
        # System status
        self.enabled = True
        self.emergency_mode = False
        self.emergency_reason = ""
        self.last_emergency_time = None
        
        # Performance tracking
        self.check_count = 0
        self.total_check_time = 0.0
        self.average_check_time_ms = 0.0
        
        algorithm.Log("[Unified Risk] Risk management system initialized with plugin architecture")
    
    def register_plugin(self, plugin: IRiskPlugin) -> bool:
        """Register a risk plugin"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
if plugin.plugin_name in self.plugin_registry:
                self.algorithm.Error(
                    f"[Unified Risk] Plugin {plugin.plugin_name} already registered"
                )
                return False
            
            # Initialize plugin
            if plugin.initialize(self.algorithm, self.event_bus):
                self.plugins.append(plugin)
                self.plugin_registry[plugin.plugin_name] = plugin
                
                self.algorithm.Log(
                    f"[Unified Risk] Registered plugin: {plugin.plugin_name} v{plugin.plugin_version}"
                )
                return True
            else:
                self.algorithm.Error(
                    f"[Unified Risk] Failed to initialize plugin: {plugin.plugin_name}"
                )
                return False
                
        except Exception as e:
            self.algorithm.Error(f"[Unified Risk] Error registering plugin {plugin.plugin_name}: {e}")
            return False
    
    def can_open_position(self, symbol: str, quantity: int, 
                         context: Dict[str, Any] = None) -> tuple[bool, str]:
        """
        Check if position can be opened across all risk plugins.
        ALL plugins must approve for position to be allowed.
        """
        if not self.enabled:
            return False, "Risk management system disabled"
        
        if self.emergency_mode:
            return False, f"Emergency mode active: {self.emergency_reason}"
        
        start_time = datetime.now()
        
        try:
        for plugin in self.plugins:
        try:
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Check each plugin
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
can_open, reason = plugin.can_open_position(symbol, quantity, context)
                    if not can_open:
                        self.algorithm.Debug(
                            f"[Unified Risk] Position blocked by {plugin.plugin_name}: {reason}"
                        )
                        return False, f"{plugin.plugin_name}: {reason}"
                
                except Exception as e:
                    self.algorithm.Error(
                        f"[Unified Risk] Error in {plugin.plugin_name}.can_open_position: {e}"
                    )
                    # Fail safe - block position on plugin error
                    return False, f"{plugin.plugin_name}: Plugin error"
            
            # All plugins approved
            return True, "All risk checks passed"
            
        finally:
            # Track performance
            end_time = datetime.now()
            check_time_ms = (end_time - start_time).total_seconds() * 1000
            self.check_count += 1
            self.total_check_time += check_time_ms
            self.average_check_time_ms = self.total_check_time / self.check_count
    
    def on_position_opened(self, symbol: str, quantity: int, 
                          fill_price: float, context: Dict[str, Any] = None):
        """Notify all plugins that a position was opened"""
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
plugin.on_position_opened(symbol, quantity, fill_price, context)
            except Exception as e:
                self.algorithm.Error(
                    f"[Unified Risk] Error in {plugin.plugin_name}.on_position_opened: {e}"
                )
    
    def on_position_closed(self, symbol: str, quantity: int, 
                          fill_price: float, pnl: float, context: Dict[str, Any] = None):
        """Notify all plugins that a position was closed"""
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
plugin.on_position_closed(symbol, quantity, fill_price, pnl, context)
            except Exception as e:
                self.algorithm.Error(
                    f"[Unified Risk] Error in {plugin.plugin_name}.on_position_closed: {e}"
                )
    
    def on_market_data(self, symbol: str, data: Any):
        """Forward market data to all plugins"""
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
plugin.on_market_data(symbol, data)
            except Exception as e:
                self.algorithm.Debug(
                    f"[Unified Risk] Error in {plugin.plugin_name}.on_market_data: {e}"
                )
    
    def perform_periodic_checks(self) -> List[RiskEvent]:
        """Perform periodic risk checks across all plugins"""
        all_events = []
        
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
events = plugin.periodic_check()
                if events:
                    all_events.extend(events)
                    
                    # Handle critical events
                    for event in events:
                        if event.level == RiskLevel.EMERGENCY:
                            self._handle_emergency_event(event)
                        elif event.level == RiskLevel.CRITICAL:
                            self._handle_critical_event(event)
                            
            except Exception as e:
                self.algorithm.Error(
                    f"[Unified Risk] Error in {plugin.plugin_name}.periodic_check: {e}"
                )
        
        # Update consolidated risk metrics
        self._update_risk_metrics()
        
        return all_events
    
    def _handle_emergency_event(self, event: RiskEvent):
        """Handle emergency risk event"""
        self.emergency_mode = True
        self.emergency_reason = event.message
        self.last_emergency_time = self.algorithm.Time
        
        self.algorithm.Error(f"[Unified Risk] EMERGENCY: {event.message}")
        
        # Notify all plugins of emergency
        self.event_bus.emit_risk_event(event)
        
        # Cancel all pending orders
        self._cancel_all_orders()
        
        # Close risky positions if needed
        if event.event_type == RiskEventType.CIRCUIT_BREAKER_TRIGGERED:
            self._close_risky_positions()
    
    def _handle_critical_event(self, event: RiskEvent):
        """Handle critical risk event"""
        self.algorithm.Log(f"[Unified Risk] CRITICAL: {event.message}")
        
        # Emit event to all plugins
        self.event_bus.emit_risk_event(event)
    
    def _cancel_all_orders(self):
        """Cancel all pending orders"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
open_orders = self.algorithm.Transactions.GetOpenOrders()
            for order in open_orders:
                self.algorithm.Transactions.CancelOrder(order.Id)
                self.algorithm.Log(f"[Unified Risk] Cancelled order: {order.Id}")
        except Exception as e:
            self.algorithm.Error(f"[Unified Risk] Error cancelling orders: {e}")
    
    def _close_risky_positions(self):
        """Close positions deemed risky during emergency"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
for symbol, holding in self.algorithm.Portfolio.items():
                if holding.Invested:
                    # Close short options (unlimited risk)
                    if (holding.Type == SecurityType.Option and 
                        holding.IsShort):
                        self.algorithm.Liquidate(symbol, "EMERGENCY_RISK_CLOSURE")
                        self.algorithm.Log(f"[Unified Risk] Emergency closure: {symbol}")
        except Exception as e:
            self.algorithm.Error(f"[Unified Risk] Error closing risky positions: {e}")
    
    def _update_risk_metrics(self):
        """Update consolidated risk metrics from all plugins"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
consolidated_metrics = {
                'overall_risk_score': 0.0,
                'position_count': len([h for h in self.algorithm.Portfolio.Values if h.Invested]),
                'portfolio_value': self.algorithm.Portfolio.TotalPortfolioValue,
                'margin_utilization': (self.algorithm.Portfolio.TotalMarginUsed / 
                                     max(self.algorithm.Portfolio.TotalPortfolioValue, 1)),
                'last_update': self.algorithm.Time
            }
            
            # Collect metrics from all plugins
            plugin_metrics = {}
            for plugin in self.plugins:
                try:
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
metrics = plugin.get_risk_metrics()
                    if metrics:
                        plugin_metrics[plugin.plugin_name] = metrics
                except Exception as e:
                    self.algorithm.Debug(
                        f"[Unified Risk] Error getting metrics from {plugin.plugin_name}: {e}"
                    )
            
            consolidated_metrics['plugin_metrics'] = plugin_metrics
            
            # Calculate overall risk score
            risk_scores = []
            for plugin_name, metrics in plugin_metrics.items():
                if 'risk_score' in metrics:
                    risk_scores.append(metrics['risk_score'])
            
            if risk_scores:
                consolidated_metrics['overall_risk_score'] = max(risk_scores)
            
            self.risk_metrics = consolidated_metrics
            
        except Exception as e:
            self.algorithm.Error(f"[Unified Risk] Error updating risk metrics: {e}")
    
    def get_risk_status(self) -> Dict[str, Any]:
        """Get comprehensive risk status"""
        plugin_status = {}
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
plugin_status[plugin.plugin_name] = {
                    'version': plugin.plugin_version,
                    'metrics': plugin.get_risk_metrics()
                }
            except Exception as e:
                plugin_status[plugin.plugin_name] = {
                    'error': str(e)
                }
        
        return {
            'enabled': self.enabled,
            'emergency_mode': self.emergency_mode,
            'emergency_reason': self.emergency_reason,
            'plugin_count': len(self.plugins),
            'plugins': plugin_status,
            'performance': {
                'check_count': self.check_count,
                'average_check_time_ms': round(self.average_check_time_ms, 2)
            },
            'consolidated_metrics': self.risk_metrics
        }
    
    def reset_emergency_mode(self, reason: str = "Manual reset"):
        """Reset emergency mode (use with caution)"""
        self.emergency_mode = False
        self.emergency_reason = ""
        
        # Emit recovery event
        recovery_event = RiskEvent(
            RiskEventType.RECOVERY_CONDITIONS_MET,
            RiskLevel.INFO,
            f"Emergency mode reset: {reason}"
        )
        self.event_bus.emit_risk_event(recovery_event)
        
        self.algorithm.Log(f"[Unified Risk] Emergency mode reset: {reason}")
    
    # ========================================
    # BACKWARD COMPATIBILITY METHODS
    # For strategies that call old manager methods directly
    # ========================================
    
    def request_spy_allocation(self, strategy_name: str, position_type: str, 
                              requested_delta: float, requested_contracts: int = 0):
        """
        BACKWARD COMPATIBILITY: Delegate to ConcentrationPlugin
        """
        concentration_plugin = self.plugin_registry.get("ConcentrationPlugin")
        if concentration_plugin and hasattr(concentration_plugin, 'request_spy_allocation'):
            return concentration_plugin.request_spy_allocation(
                strategy_name, position_type, requested_delta, requested_contracts
            )
        
        # Fallback using can_open_position logic
        can_open, reason = self.can_open_position("SPY", requested_contracts, {
            'strategy_name': strategy_name,
            'position_type': position_type,
            'requested_delta': requested_delta
        })
        
        return can_open, reason
    
    def release_spy_allocation(self, strategy_name: str):
        """
        BACKWARD COMPATIBILITY: Delegate to ConcentrationPlugin
        """
        concentration_plugin = self.plugin_registry.get("ConcentrationPlugin")
        if concentration_plugin and hasattr(concentration_plugin, 'release_spy_allocation'):
            return concentration_plugin.release_spy_allocation(strategy_name)
        
        self.algorithm.Debug(f"[Unified Risk] Release allocation for {strategy_name}")
        return True
    
    def ShouldDefend(self, position_info: Dict) -> bool:
        """
        BACKWARD COMPATIBILITY: Delegate to CorrelationPlugin
        """
        correlation_plugin = self.plugin_registry.get("CorrelationRiskPlugin")
        if correlation_plugin and hasattr(correlation_plugin, 'ShouldDefend'):
            return correlation_plugin.ShouldDefend(position_info)
        
        # Fallback: Check TradingConstants.DEFENSIVE_EXIT_DTE DTE rule directly
        days_to_expiry = position_info.get('dte', 999)
        return days_to_expiry <= 21
    
    def shutdown(self):
        """Shutdown all plugins"""
        for plugin in self.plugins:
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
plugin.shutdown()
            except Exception as e:
                self.algorithm.Error(
                    f"[Unified Risk] Error shutting down {plugin.plugin_name}: {e}"
                )
        
        self.algorithm.Log("[Unified Risk] Risk management system shutdown")

class RiskEventBus:
    """Event bus for risk plugin communication"""
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.event_history: List[RiskEvent] = []
        self.max_history_size = 1000
        self.subscribers: Dict[RiskEventType, List[callable]] = {}
    
    def emit_risk_event(self, event: RiskEvent):
        """Emit a risk event to all subscribers"""
        # Add to history
        self.event_history.append(event)
        if len(self.event_history) > self.max_history_size:
            self.event_history.pop(0)
        
        # Notify subscribers
        if event.event_type in self.subscribers:
            for callback in self.subscribers[event.event_type]:
                try:
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
callback(event)
                except Exception as e:
                    self.algorithm.Error(f"[Risk Event Bus] Error in event callback: {e}")
    
    def subscribe(self, event_type: RiskEventType, callback: callable):
        """Subscribe to risk events"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)
    
    def get_recent_events(self, event_type: RiskEventType = None, 
                         limit: int = 50) -> List[RiskEvent]:
        """Get recent risk events"""
        events = self.event_history
        
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        
        return events[-limit:]
    
    # IManager Interface Implementation
    
    def handle_event(self, event) -> bool:
        """Handle incoming events from the event bus"""
        try:
        return True
        except Exception as e:
        self.algo.Error(f"[UnifiedRiskManager] Error handling event: {e}")
        return False
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Risk manager processes position updates, market events, etc.
            # Could trigger risk checks based on event type
    
    def get_dependencies(self) -> List[str]:
        """Return list of manager names this manager depends on"""
        return ['vix_manager', 'greeks_monitor']  # Depends on market data
    
    def can_initialize_without_dependencies(self) -> bool:
        """Return True if this manager can initialize before its dependencies are ready"""
        return False  # Risk manager needs market data to function
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "unified_risk_manager"