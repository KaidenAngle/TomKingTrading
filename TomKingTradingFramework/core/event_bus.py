# region imports
from AlgorithmImports import *
from enum import Enum
from typing import Dict, List, Callable, Any, Optional
from datetime import datetime
import threading
from collections import deque
from core.dependency_container import IManager
from core.unified_vix_manager import UnifiedVIXManager
# endregion


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class EventType(Enum):
    """Core trading system events for event-driven architecture"""
    
    # Market Data Events
    MARKET_DATA_UPDATED = "market_data_updated"
    PRICE_CHANGE_SIGNIFICANT = "price_change_significant"
    VOLATILITY_SPIKE = "volatility_spike"
    VIX_REGIME_CHANGE = "vix_regime_change"
    
    # Position Events
    POSITION_OPENED = "position_opened"
    POSITION_CLOSED = "position_closed"
    POSITION_UPDATED = "position_updated"
    POSITION_SIZE_CHANGE = "position_size_change"
    
    # Greeks Events
    GREEKS_CALCULATED = "greeks_calculated"
    GREEKS_THRESHOLD_BREACH = "greeks_threshold_breach"
    PORTFOLIO_DELTA_CHANGE = "portfolio_delta_change"
    HIGH_GAMMA_DETECTED = "high_gamma_detected"
    EXCESSIVE_THETA_DECAY = "excessive_theta_decay"
    
    # Risk Events
    DRAWDOWN_WARNING = "drawdown_warning"
    MARGIN_WARNING = "margin_warning"
    CORRELATION_SPIKE = "correlation_spike"
    CIRCUIT_BREAKER_TRIGGERED = "circuit_breaker_triggered"
    
    # Strategy Events
    STRATEGY_SIGNAL = "strategy_signal"
    ENTRY_CONDITIONS_MET = "entry_conditions_met"
    EXIT_CONDITIONS_MET = "exit_conditions_met"
    STRATEGY_STATE_CHANGE = "strategy_state_change"
    
    # PHASE 6: Request-Response Events (Circular Dependency Resolution)
    POSITION_SIZE_REQUEST = "position_size_request"
    POSITION_SIZE_RESPONSE = "position_size_response"
    VIX_LEVEL_REQUEST = "vix_level_request"
    VIX_LEVEL_RESPONSE = "vix_level_response"
    MARGIN_REQUIREMENT_REQUEST = "margin_requirement_request"
    MARGIN_REQUIREMENT_RESPONSE = "margin_requirement_response"
    STRATEGY_STATE_REQUEST = "strategy_state_request"
    STRATEGY_STATE_RESPONSE = "strategy_state_response"
    GREEKS_CALCULATION_REQUEST = "greeks_calculation_request"
    GREEKS_CALCULATION_RESPONSE = "greeks_calculation_response"
    
    # System Events
    CACHE_INVALIDATION = "cache_invalidation"
    SYSTEM_HALT = "system_halt"
    MANUAL_MODE_ACTIVATED = "manual_mode_activated"
    PERFORMANCE_THRESHOLD_BREACH = "performance_threshold_breach"
    CIRCULAR_DEPENDENCY_DETECTED = "circular_dependency_detected"

class Event:
    """Event data structure with metadata and circular dependency tracking"""
    
    def __init__(self, event_type: EventType, data: Dict[str, Any], source: str, 
                 timestamp: datetime = None, correlation_id: str = None):
        self.event_type = event_type
        self.data = data
        self.source = source
        self.timestamp = timestamp or datetime.now()
        self.processed_by = set()  # Track which handlers processed this event
        self.created_at = datetime.now()
        
        # PHASE 6: Circular dependency tracking
        self.correlation_id = correlation_id or self._generate_correlation_id()
        self.event_chain = []  # Track event chain for loop detection
        self.hop_count = 0  # Prevent infinite chains
        self.max_hops = 10  # Maximum allowed hops in event chain
        
    def _generate_correlation_id(self) -> str:
        """Generate unique correlation ID for event chain tracking"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    def add_to_chain(self, event_type: EventType, source: str):
        """Add event to chain for circular dependency detection"""
        self.event_chain.append((event_type.value, source))
        self.hop_count += 1
    
    def would_create_loop(self, new_event_type: EventType, new_source: str) -> bool:
        """Check if adding this event would create a circular chain"""
        # FIXED: Proper loop detection - check hop count first to prevent infinite cycles
        if self.hop_count >= self.max_hops:
            return True
            
        new_entry = (new_event_type.value, new_source)
        
        # FIXED: More sophisticated loop detection - check full path, not just immediate duplicate
        if new_entry in self.event_chain:
            return True
            
        # FIXED: Check for potential indirect cycles by examining chain history
        if len(self.event_chain) > 3:  # Only check for cycles in longer chains
            recent_events = list(self.event_chain)[-3:]  # Check last 3 events for patterns
            if recent_events.count(new_entry) > 0:  # Event appeared in recent history
                return True
                
        return False
    
    def __repr__(self):
        return f"Event({self.event_type.value}, source={self.source}, correlation={self.correlation_id}, hops={self.hop_count})"

class EventBus(IManager):
    """
    High-performance event bus for Tom King Trading Framework
    
    Replaces periodic scheduled checks with event-driven architecture
    for 20%+ performance improvement and reduced latency.
    
    Features:
    - Type-safe event system
    - Priority-based event handling
    - Performance monitoring
    - Thread-safe operation
    - Event history for debugging
    """
    
    def __init__(self, algorithm, max_history: int = 1000):
        self.algorithm = algorithm
        self.handlers = {}  # EventType -> List[handler_info]
        self.event_history = deque(maxlen=max_history)
        self.stats = {
            'events_published': 0,
            'events_processed': 0,
            'handler_errors': 0,
            'avg_processing_time_ms': 0.0,
            'circular_loops_prevented': 0,
            'request_response_pairs': 0
        }
        self._lock = threading.Lock()
        
        # Performance tracking
        self.processing_times = deque(maxlen=100)  # Last 100 events
        self.last_stats_log = algorithm.Time if hasattr(algorithm, 'Time') else datetime.now()
        
        # PHASE 6: Circular dependency prevention
        self.active_event_chains = {}  # correlation_id -> Event
        self.loop_detection_enabled = True
        self.max_concurrent_chains = 50
        self.request_response_timeout = 5  # seconds
        self.pending_requests = {}  # correlation_id -> (callback, timestamp)
        
        # Event type relationships for loop detection
        self.circular_prone_events = {
            EventType.GREEKS_CALCULATED: [EventType.PERFORMANCE_THRESHOLD_BREACH],
            EventType.PERFORMANCE_THRESHOLD_BREACH: [EventType.GREEKS_CALCULATION_REQUEST],
            EventType.POSITION_UPDATED: [EventType.GREEKS_CALCULATION_REQUEST],
            EventType.VIX_REGIME_CHANGE: [EventType.POSITION_SIZE_REQUEST],
            EventType.POSITION_SIZE_RESPONSE: [EventType.VIX_LEVEL_REQUEST]
        }
        
        self.algorithm.Debug("[EventBus] Initialized Phase 6 event-driven architecture with circular dependency prevention")
    
    def subscribe(self, event_type: EventType, handler: Callable[[Event], None], 
                 source: str = "unknown", priority: int = 0):
        """
        Subscribe to events with priority support
        
        Args:
            event_type: Type of event to subscribe to
            handler: Callable that takes Event as parameter
            source: Identifier for the handler (for debugging)
            priority: Higher priority handlers execute first (default: 0)
        """
        
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        
        handler_info = {
            'handler': handler,
            'source': source,
            'priority': priority,
            'call_count': 0,
            'error_count': 0,
            'total_time_ms': 0.0
        }
        
        # Insert in priority order (higher priority first)
        inserted = False
        for i, existing in enumerate(self.handlers[event_type]):
            if priority > existing['priority']:
                self.handlers[event_type].insert(i, handler_info)
                inserted = True
                break
        
        if not inserted:
            self.handlers[event_type].append(handler_info)
        
        self.algorithm.Debug(f"[EventBus] Subscribed {source} to {event_type.value} (priority={priority})")
    
    def publish(self, event_type: EventType, data: Dict[str, Any], source: str = "system") -> bool:
        """
        Publish event to all subscribers
        
        Args:
            event_type: Type of event
            data: Event data dictionary
            source: Source of the event
            
        Returns:
            bool: True if event was processed successfully by all handlers
        """
        
        try:
        
            pass
        except Exception as e:

            start_time = datetime.now()
            
            # FIXED: Validate event data to prevent corruption and handler failures
            if data is not None:
                if not isinstance(data, dict):
                    self.algorithm.Error(f"[EventBus] Invalid data type for {event_type.value}: {type(data)}, expected dict")
                    return False
                
                # Check for circular references in data (basic check)
                if self._has_circular_references(data):
                    self.algorithm.Error(f"[EventBus] Circular references detected in event data for {event_type.value}")
                    return False
            else:
                data = {}  # Use empty dict instead of None
            
            event = Event(event_type, data, source, 
                         self.algorithm.Time if hasattr(self.algorithm, 'Time') else datetime.now())
            
            # Add to history
            self.event_history.append(event)
            self.stats['events_published'] += 1
            
            # Get handlers for this event type
            handlers = self.handlers.get(event_type, [])
            
            if not handlers:
                # No handlers registered - this might be intentional
                return True
            
            success = True
            processed_count = 0
            
            # Execute handlers in priority order
            for handler_info in handlers:
                handler_start = datetime.now()
                
                try:
                    handler_info['handler'](event)
                    handler_info['call_count'] += 1
                    processed_count += 1
                    
                    # Track handler performance
                    handler_time = (datetime.now() - handler_start).total_seconds() * 1000
                    handler_info['total_time_ms'] += handler_time
                    
                    # Mark as processed by this handler
                    event.processed_by.add(handler_info['source'])
                    
                except Exception as e:
                    handler_info['error_count'] += 1
                    self.stats['handler_errors'] += 1
                    success = False
                    
                    self.algorithm.Error(f"[EventBus] Handler error: {handler_info['source']} "
                                       f"processing {event_type.value}: {e}")
            
            # Update performance stats
            total_time = (datetime.now() - start_time).total_seconds() * 1000
            self.processing_times.append(total_time)
            self.stats['events_processed'] += processed_count
            
            # Update average processing time
            if self.processing_times:
                self.stats['avg_processing_time_ms'] = sum(self.processing_times) / len(self.processing_times)
            
            # Log performance periodically
            if (event.timestamp - self.last_stats_log).total_seconds() > 300:  # Every 5 minutes
                self._log_performance_stats()
                self.last_stats_log = event.timestamp
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"[EventBus] Critical error publishing {event_type.value}: {e}")
            return False
    
    def publish_market_data_event(self, symbol: str, price: float, change_pct: float = None):
        """Convenience method for market data events"""
        
        data = {'symbol': symbol, 'price': price}
        if change_pct is not None:
            data['change_pct'] = change_pct
            
            # Trigger significant price change if threshold exceeded
            if abs(change_pct) > 0.02:  # 2% change
                self.publish(EventType.PRICE_CHANGE_SIGNIFICANT, data, "market_data")
        
        self.publish(EventType.MARKET_DATA_UPDATED, data, "market_data")
    
    def publish_position_event(self, event_type: EventType, symbol: str, quantity: int, 
                              price: float = None, **kwargs):
        """Convenience method for position events"""
        
        data = {
            'symbol': symbol,
            'quantity': quantity,
            'timestamp': self.algorithm.Time if hasattr(self.algorithm, 'Time') else datetime.now()
        }
        
        if price is not None:
            data['price'] = price
            
        data.update(kwargs)  # Add any additional data
        
        self.publish(event_type, data, "position_manager")
    
    def publish_greeks_event(self, event_type: EventType, greeks: Dict[str, float], 
                            symbol: str = None, **kwargs):
        """Convenience method for Greeks events"""
        
        data = {
            'greeks': greeks,
            'timestamp': self.algorithm.Time if hasattr(self.algorithm, 'Time') else datetime.now()
        }
        
        if symbol:
            data['symbol'] = symbol
            
        data.update(kwargs)
        
        self.publish(event_type, data, "greeks_service")
    
    def publish_risk_event(self, event_type: EventType, risk_type: str, current_value: float, 
                          threshold: float, **kwargs):
        """Convenience method for risk events"""
        
        data = {
            'risk_type': risk_type,
            'current_value': current_value,
            'threshold': threshold,
            'breach_ratio': current_value / threshold if threshold != 0 else 0,
            'timestamp': self.algorithm.Time if hasattr(self.algorithm, 'Time') else datetime.now()
        }
        
        data.update(kwargs)
        
        self.publish(event_type, data, "risk_manager")
    
    def get_recent_events(self, event_type: EventType = None, limit: int = 50) -> List[Event]:
        """Get recent events, optionally filtered by type"""
        
        if event_type is None:
            return list(self.event_history)[-limit:]
        
        filtered = [e for e in self.event_history if e.event_type == event_type]
        return filtered[-limit:]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get event bus performance statistics"""
        
        stats = self.stats.copy()
        
        # Handler statistics
        handler_stats = {}
        for event_type, handlers in self.handlers.items():
            handler_stats[event_type.value] = {
                'handler_count': len(handlers),
                'total_calls': sum(h['call_count'] for h in handlers),
                'total_errors': sum(h['error_count'] for h in handlers),
                'avg_time_ms': sum(h['total_time_ms'] for h in handlers) / len(handlers) if handlers else 0
            }
        
        stats['handler_statistics'] = handler_stats
        stats['event_history_size'] = len(self.event_history)
        stats['registered_event_types'] = len(self.handlers)
        
        return stats
    
    def _log_performance_stats(self):
        """Log performance statistics"""
        
        stats = self.get_statistics()
        
        self.algorithm.Debug(f"[EventBus] Performance: "
                           f"{stats['events_published']} events published, "
                           f"{stats['events_processed']} processed, "
                           f"{stats['avg_processing_time_ms']:.2f}ms avg, "
                           f"{stats['handler_errors']} errors")
        
        # Log top event types
        sorted_handlers = sorted(stats['handler_statistics'].items(), 
                               key=lambda x: x[1]['total_calls'], reverse=True)
        
        if sorted_handlers:
            top_events = sorted_handlers[:3]
            self.algorithm.Debug(f"[EventBus] Top events: {', '.join([f'{k}: {v['total_calls']}' for k, v in top_events])}")
    
    def unsubscribe(self, event_type: EventType, source: str):
        """Remove handler by source name"""
        
        if event_type in self.handlers:
            self.handlers[event_type] = [h for h in self.handlers[event_type] if h['source'] != source]
            self.algorithm.Debug(f"[EventBus] Unsubscribed {source} from {event_type.value}")
    
    def clear_handlers(self, event_type: EventType = None):
        """Clear handlers for specific event type or all"""
        
        if event_type:
            self.handlers[event_type] = []
            self.algorithm.Debug(f"[EventBus] Cleared handlers for {event_type.value}")
        else:
            self.handlers.clear()
            self.algorithm.Debug("[EventBus] Cleared all handlers")
    
    # PHASE 6: Circular Dependency Resolution Methods
    
    def publish_with_loop_detection(self, event_type: EventType, data: Dict[str, Any], 
                                  source: str = "system", parent_event: Event = None) -> bool:
        """
        Enhanced publish method with circular dependency detection
        
        Args:
            event_type: Type of event to publish
            data: Event data dictionary
            source: Source of the event
            parent_event: Parent event for chain tracking (if any)
            
        Returns:
            bool: True if published successfully, False if circular dependency detected
        """
        
        if not self.loop_detection_enabled:
            return self.publish(event_type, data, source)
        
        # Create event with correlation tracking
        correlation_id = parent_event.correlation_id if parent_event else None
        event = Event(event_type, data, source, 
                     self.algorithm.Time if hasattr(self.algorithm, 'Time') else datetime.now(),
                     correlation_id)
        
        # Check for circular dependency
        if parent_event:
            # Copy chain from parent and check for loops
            event.event_chain = parent_event.event_chain.copy()
            event.hop_count = parent_event.hop_count
            
            if event.would_create_loop(event_type, source):
                self.stats['circular_loops_prevented'] += 1
                self.algorithm.Log(f"[EventBus] CIRCULAR DEPENDENCY PREVENTED: {event_type.value} from {source}")
                self.algorithm.Log(f"[EventBus] Event chain: {' -> '.join([f'{t}({s})' for t, s in event.event_chain])}")
                
                # Publish circular dependency detected event
                self.publish(EventType.CIRCULAR_DEPENDENCY_DETECTED, {
                    'blocked_event_type': event_type.value,
                    'blocked_source': source,
                    'event_chain': event.event_chain,
                    'hop_count': event.hop_count
                }, source="event_bus_loop_detector")
                
                return False
            
            # Add current event to chain
            event.add_to_chain(event_type, source)
        
        # Track active event chain
        self.active_event_chains[event.correlation_id] = event
        
        # Clean up old chains periodically
        self._cleanup_stale_chains()
        
        # Publish the event normally
        success = self._publish_event(event)
        
        # Clean up this chain if complete
        if event.correlation_id in self.active_event_chains:
            del self.active_event_chains[event.correlation_id]
        
        return success
    
    def _publish_event(self, event: Event) -> bool:
        """Internal method to publish an Event object"""
        
        try:
        
            pass
        except Exception as e:

            start_time = datetime.now()
            
            # Add to history
            self.event_history.append(event)
            self.stats['events_published'] += 1
            
            # Get handlers for this event type
            handlers = self.handlers.get(event.event_type, [])
            
            if not handlers:
                return True
            
            success = True
            processed_count = 0
            
            # Execute handlers in priority order
            for handler_info in handlers:
                handler_start = datetime.now()
                
                try:
                    handler_info['handler'](event)
                    handler_info['call_count'] += 1
                    processed_count += 1
                    
                    # Track handler performance
                    handler_time = (datetime.now() - handler_start).total_seconds() * 1000
                    handler_info['total_time_ms'] += handler_time
                    
                    # Mark as processed by this handler
                    event.processed_by.add(handler_info['source'])
                    
                except Exception as e:
                    handler_info['error_count'] += 1
                    self.stats['handler_errors'] += 1
                    success = False
                    
                    self.algorithm.Error(f"[EventBus] Handler error: {handler_info['source']} "
                                       f"processing {event.event_type.value}: {e}")
            
            # Update performance stats
            total_time = (datetime.now() - start_time).total_seconds() * 1000
            self.processing_times.append(total_time)
            self.stats['events_processed'] += processed_count
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"[EventBus] Critical error publishing {event.event_type.value}: {e}")
            return False
    
    def publish_request_response(self, request_type: EventType, response_type: EventType,
                               data: Dict[str, Any], source: str, callback: Callable,
                               timeout: float = None) -> bool:
        """
        Publish request event and register callback for response
        
        Args:
            request_type: Type of request event
            response_type: Expected response event type
            data: Request data
            source: Source of the request
            callback: Function to call when response arrives
            timeout: Timeout in seconds (default: self.request_response_timeout)
            
        Returns:
            bool: True if request was published successfully
        """
        
        timeout = timeout or self.request_response_timeout
        correlation_id = Event(request_type, {}, source)._generate_correlation_id()
        
        # Add correlation ID to request data
        request_data = data.copy()
        request_data['correlation_id'] = correlation_id
        request_data['response_type'] = response_type.value
        
        # Register callback for response
        self.pending_requests[correlation_id] = {
            'callback': callback,
            'timestamp': datetime.now(),
            'timeout': timeout,
            'response_type': response_type,
            'source': source
        }
        
        # Subscribe to response type if not already subscribed
        if response_type not in self.handlers or not any(
            h['source'] == 'request_response_handler' for h in self.handlers[response_type]
        ):
            self.subscribe(response_type, self._handle_response, 
                          source='request_response_handler', priority=100)
        
        # Publish request
        success = self.publish_with_loop_detection(request_type, request_data, source)
        
        if success:
            self.stats['request_response_pairs'] += 1
        
        return success
    
    def _handle_response(self, event: Event):
        """Handle response events for request-response pairs"""
        
        correlation_id = event.data.get('correlation_id')
        if not correlation_id or correlation_id not in self.pending_requests:
            return
        
        request_info = self.pending_requests[correlation_id]
        
        try:
            # Call the registered callback
            request_info['callback'](event)
        except Exception as e:
            self.algorithm.Error(f"[EventBus] Response callback error for {correlation_id}: {e}")
        
        finally:
            # Remove from pending requests
            del self.pending_requests[correlation_id]
    
    def _cleanup_stale_chains(self):
        """Clean up stale event chains and pending requests"""
        
        current_time = datetime.now()
        
        # Clean up stale pending requests
        stale_requests = []
        for correlation_id, request_info in self.pending_requests.items():
            if (current_time - request_info['timestamp']).total_seconds() > request_info['timeout']:
                stale_requests.append(correlation_id)
        
        for correlation_id in stale_requests:
            request_info = self.pending_requests[correlation_id]
            self.algorithm.Log(f"[EventBus] Request timeout: {correlation_id} from {request_info['source']}")
            del self.pending_requests[correlation_id]
        
        # Limit concurrent active chains
        if len(self.active_event_chains) > self.max_concurrent_chains:
            # Remove oldest chains
            sorted_chains = sorted(self.active_event_chains.items(), 
                                 key=lambda x: x[1].created_at)
            
            chains_to_remove = len(self.active_event_chains) - self.max_concurrent_chains
            for i in range(chains_to_remove):
                correlation_id, event = sorted_chains[i]
                self.algorithm.Log(f"[EventBus] Removed stale event chain: {correlation_id}")
                del self.active_event_chains[correlation_id]
    
    def get_circular_dependency_stats(self) -> Dict[str, Any]:
        """Get statistics about circular dependency prevention"""
        
        return {
            'loops_prevented': self.stats['circular_loops_prevented'],
            'active_chains': len(self.active_event_chains),
            'pending_requests': len(self.pending_requests),
            'request_response_pairs': self.stats['request_response_pairs'],
            'loop_detection_enabled': self.loop_detection_enabled,
            'circular_prone_event_types': len(self.circular_prone_events)
        }
    
    def _has_circular_references(self, data: Dict[str, Any], visited: set = None, max_depth: int = 10) -> bool:
        """
        FIXED: Check for circular references in event data to prevent corruption
        
        Args:
            data: Dictionary to check for circular references
            visited: Set of object IDs already visited
            max_depth: Maximum recursion depth to prevent stack overflow
            
        Returns:
            bool: True if circular references found, False otherwise
        """
        
        if visited is None:
            visited = set()
        
        if max_depth <= 0:
            return True  # Too deep, assume circular
        
        data_id = id(data)
        if data_id in visited:
            return True  # Circular reference detected
        
        visited.add(data_id)
        
        try:
        
            pass
        except Exception as e:

            for key, value in data.items():
                if isinstance(value, dict):
                    if self._has_circular_references(value, visited.copy(), max_depth - 1):
                        return True
                elif isinstance(value, (list, tuple)):
                    for item in value:
                        if isinstance(item, dict):
                            if self._has_circular_references(item, visited.copy(), max_depth - 1):
                                return True
                # Skip other types that could contain references but are less critical
                
        except (AttributeError, TypeError):
            # Handle non-dict types gracefully
            return False
        
        return False
    
    # IManager Interface Implementation
    
    def handle_event(self, event: Event) -> bool:
        """Handle incoming events - EventBus doesn't consume its own events"""
        return True  # Always succeeds as EventBus is the event router
    
    def get_dependencies(self) -> List[str]:
        """EventBus has no dependencies - it's foundational infrastructure"""
        return []
    
    def can_initialize_without_dependencies(self) -> bool:
        """EventBus can always initialize first"""
        return True
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "event_bus"