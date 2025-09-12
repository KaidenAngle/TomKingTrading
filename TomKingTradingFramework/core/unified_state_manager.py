# Unified State Manager for All Strategies
# Coordinates state machines across the entire framework

from AlgorithmImports import *
from core.state_machine import StrategyStateMachine, StrategyState, TransitionTrigger
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
from core.dependency_container import IManager
from core.event_bus import EventBus, EventType, Event
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from enum import Enum, auto

class SystemState(Enum):
    """Overall system states"""
    INITIALIZING = auto()
    MARKET_CLOSED = auto()
    PRE_MARKET = auto()
    MARKET_OPEN = auto()
    EMERGENCY = auto()
    HALTED = auto()
    SHUTTING_DOWN = auto()

class UnifiedStateManager(IManager):
    """
    Manages state machines for all strategies
    Provides system-wide coordination and monitoring
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.system_state = SystemState.INITIALIZING
        
        # Strategy state machines
        self.strategy_machines = {}
        
        # System-wide triggers
        self.global_triggers = []
        
        # UNIFIED INTELLIGENT CACHE: State validation and condition caching
        # Uses the main unified cache with appropriate cache types for intelligent invalidation
        self.state_cache = algorithm.unified_cache
        self.condition_cache = algorithm.unified_cache
        
        # State persistence
        self.state_file = "state_machines.json"
        self.last_save = datetime.min
        self.save_interval = timedelta(minutes=5)
        
        # Emergency controls
        self.emergency_mode = False
        self.halt_reasons = []  # FIXED: Will be size-limited to prevent unbounded memory growth
        self.MAX_HALT_REASONS = 100  # Maximum number of halt reasons to keep
        
        # Performance tracking
        self.state_statistics = {}
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=30 if algorithm.LiveMode else 60)
        self.last_cache_stats_log = algorithm.Time
        
        # Initialize system transitions
        self._setup_system_transitions()
        
        self.algo.Debug("[StateManager] Unified state manager initialized")
    
    def _setup_system_transitions(self):
        """Set up system-level state transitions and triggers"""
        
        # Initialize global triggers list
        self.global_triggers = [
            # Market hours triggers
            {
                'name': 'market_open',
                'condition': lambda: self.algo.IsMarketOpen(self.algo.spy),
                'target_state': SystemState.MARKET_OPEN
            },
            {
                'name': 'market_close', 
                'condition': lambda: not self.algo.IsMarketOpen(self.algo.spy),
                'target_state': SystemState.MARKET_CLOSED
            },
            # Emergency triggers
            {
                'name': 'high_vix',
                'condition': self._check_vix_spike,
                'target_state': SystemState.EMERGENCY
            },
            {
                'name': 'margin_call',
                'condition': self._check_margin_call,
                'target_state': SystemState.EMERGENCY
            }
        ]
        
        self.algo.Debug("[StateManager] System transitions configured")
    
    def register_strategy(self, name: str, state_machine: StrategyStateMachine):
        """Register a strategy's state machine"""
        
        self.strategy_machines[name] = state_machine
        self.state_statistics[name] = {
            'transitions': 0,
            'errors': 0,
            'last_state_change': self.algo.Time
        }
        
        # Hook into state machine events
        self._hook_strategy_events(name, state_machine)
        
        self.algo.Debug(f"[StateManager] Registered strategy: {name}")
    
    def _hook_strategy_events(self, name: str, machine: StrategyStateMachine):
        """Hook into strategy state machine events"""
        
        # Monitor error states
        machine.set_on_enter(
            StrategyState.ERROR,
            lambda ctx: self._handle_strategy_error(name, ctx)
        )
        
        # Monitor suspended states
        machine.set_on_enter(
            StrategyState.SUSPENDED,
            lambda ctx: self._handle_strategy_suspension(name, ctx)
        )
    
    def update_system_state(self):
        """Update overall system state with caching optimization"""
        
        current_time = self.algo.Time
        
        # Run unified cache maintenance (handles all cache types)
        self.state_cache.periodic_maintenance()
        
        # Log cache statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_performance()
            self.last_cache_stats_log = current_time
        
        # Check market hours with caching
        market_state = self._get_cached_market_state()
        
        if market_state == 'closed':
            if current_time.hour < 9:
                self._transition_system(SystemState.PRE_MARKET)
            else:
                self._transition_system(SystemState.MARKET_CLOSED)
        else:
            if not self.emergency_mode:
                self._transition_system(SystemState.MARKET_OPEN)
            else:
                self._transition_system(SystemState.EMERGENCY)
        
        # Check for system-wide triggers with caching
        self._check_global_triggers()
        
        # Save state periodically
        if current_time - self.last_save > self.save_interval:
            self.save_all_states()
    
    def _transition_system(self, new_state: SystemState):
        """Transition system to new state"""
        
        if self.system_state == new_state:
            return
        
        old_state = self.system_state
        self.system_state = new_state
        
        self.algo.Debug(f"[StateManager] System: {old_state.name} -> {new_state.name}")
        
        # Handle system state changes
        if new_state == SystemState.MARKET_OPEN:
            self._on_market_open()
        elif new_state == SystemState.MARKET_CLOSED:
            self._on_market_close()
        elif new_state == SystemState.EMERGENCY:
            self._on_emergency()
    
    def _on_market_open(self):
        """Handle market open"""
        
        # Trigger market open for all ready strategies
        for name, machine in self.strategy_machines.items():
            if machine.is_in_state(StrategyState.READY):
                machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _on_market_close(self):
        """Handle market close"""
        
        # Trigger market close for all strategies
        for name, machine in self.strategy_machines.items():
            if machine.is_in_state(StrategyState.MANAGING):
                machine.trigger(TransitionTrigger.MARKET_CLOSE)
    
    def _on_emergency(self):
        """Handle emergency mode"""
        
        self.algo.Error("[StateManager] EMERGENCY MODE ACTIVATED")
        
        # Force all strategies to exit
        for name, machine in self.strategy_machines.items():
            if machine.is_in_any_state([
                StrategyState.POSITION_OPEN,
                StrategyState.MANAGING,
                StrategyState.ADJUSTING
            ]):
                machine.trigger(TransitionTrigger.EMERGENCY_EXIT)
    
    def _check_global_triggers(self):
        """Check for system-wide trigger conditions"""
        
        # Check VIX spike
        if self._check_vix_spike():
            self.broadcast_trigger(TransitionTrigger.VIX_SPIKE)
        
        # Check margin call
        if self._check_margin_call():
            self.broadcast_trigger(TransitionTrigger.MARGIN_CALL)
        
        # Check correlation limits
        if self._check_correlation_breach():
            self.broadcast_trigger(TransitionTrigger.CORRELATION_LIMIT)
        
        # Check data staleness
        if self._check_data_stale():
            self.broadcast_trigger(TransitionTrigger.DATA_STALE)
    
    def broadcast_trigger(self, trigger: TransitionTrigger, data: Dict = None):
        """Broadcast a trigger to all strategies"""
        
        self.algo.Debug(f"[StateManager] Broadcasting trigger: {trigger.name}")
        
        for name, machine in self.strategy_machines.items():
            if machine.can_transition(trigger):
                machine.trigger(trigger, data)
    
    def get_strategy_states(self) -> Dict[str, str]:
        """Get current state of all strategies"""
        
        states = {}
        for name, machine in self.strategy_machines.items():
            states[name] = machine.current_state.name
        
        return states
    
    def get_active_strategies(self) -> List[str]:
        """Get list of strategies with open positions"""
        
        active = []
        for name, machine in self.strategy_machines.items():
            if machine.is_in_any_state([
                StrategyState.POSITION_OPEN,
                StrategyState.MANAGING,
                StrategyState.ADJUSTING
            ]):
                active.append(name)
        
        return active
    
    def can_enter_new_position(self, strategy_name: str) -> bool:
        """Check if strategy can enter new position with caching"""
        
        # Create cache key for this position check
        cache_key = f'can_enter_{strategy_name}_{self.system_state.name}_{self.emergency_mode}'
        
        # Try to get cached result using STATE cache type
        cached_result = self.state_cache.get(
            cache_key,
            lambda: self._check_position_entry_internal(strategy_name),
            cache_type=CacheType.STATE
        )
        
        return cached_result if cached_result is not None else False
    
    def _check_position_entry_internal(self, strategy_name: str) -> bool:
        """Internal position entry check (cached by can_enter_new_position)"""
        
        # Check system state
        if self.system_state not in [SystemState.MARKET_OPEN]:
            self.algo.Debug(f"[StateManager] {strategy_name} BLOCKED: System state = {self.system_state.name} (need MARKET_OPEN)")
            return False
        
        # Check emergency mode
        if self.emergency_mode:
            self.algo.Debug(f"[StateManager] {strategy_name} BLOCKED: Emergency mode active")
            return False
        
        # Check strategy state
        machine = self.strategy_machines.get(strategy_name)
        if not machine:
            self.algo.Debug(f"[StateManager] {strategy_name} BLOCKED: Strategy machine not found")
            return False
        
        current_state = machine.current_state
        can_trade = machine.is_in_any_state([
            StrategyState.READY,
            StrategyState.ANALYZING
        ])
        
        self.algo.Debug(f"[StateManager] {strategy_name} STATE CHECK: Current={current_state.name}, Can trade={can_trade}")
        
        return can_trade
    
    def force_strategy_exit(self, strategy_name: str, reason: str):
        """Force a strategy to exit its position"""
        
        machine = self.strategy_machines.get(strategy_name)
        if machine:
            self.algo.Error(f"[StateManager] Forcing {strategy_name} exit: {reason}")
            machine.trigger(TransitionTrigger.EMERGENCY_EXIT, {'reason': reason})
    
    def halt_all_trading(self, reason: str):
        """Halt all trading activity"""
        
        self.emergency_mode = True
        
        # FIXED: Prevent unbounded memory growth by enforcing size limit
        halt_entry = {
            'time': self.algo.Time,
            'reason': reason
        }
        self.halt_reasons.append(halt_entry)
        
        # Keep only the most recent halt reasons to prevent memory growth
        if len(self.halt_reasons) > self.MAX_HALT_REASONS:
            self.halt_reasons = self.halt_reasons[-self.MAX_HALT_REASONS:]
            self.algo.Debug(f"[StateManager] Trimmed halt_reasons to {self.MAX_HALT_REASONS} entries")
        
        self._transition_system(SystemState.HALTED)
        
        # Stop all strategies
        for name in self.strategy_machines:
            self.force_strategy_exit(name, f"System halt: {reason}")
    
    def resume_trading(self):
        """Resume trading after halt"""
        
        if not self.emergency_mode:
            return
        
        self.emergency_mode = False
        self.algo.Debug("[StateManager] Trading resumed")
        
        # Reset strategies to ready
        for machine in self.strategy_machines.values():
            if machine.is_in_state(StrategyState.SUSPENDED):
                machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def save_all_states(self):
        """Save all state machines to persistent storage"""
        
        try:
        
            pass
        except Exception as e:

            state_data = {
                'timestamp': str(self.algo.Time),
                'system_state': self.system_state.name,
                'emergency_mode': self.emergency_mode,
                'strategies': {}
            }
            
            for name, machine in self.strategy_machines.items():
                state_data['strategies'][name] = {
                    'current_state': machine.current_state.name,
                    'error_count': machine.error_count,
                    'statistics': machine.get_statistics()
                }
            
            # Save to ObjectStore
            import json
            self.algo.ObjectStore.Save(
                self.state_file,
                json.dumps(state_data)
            )
            
            self.last_save = self.algo.Time
            
        except Exception as e:
            self.algo.Error(f"[StateManager] Failed to save states: {e}")
    
    def load_all_states(self):
        """Load all state machines from persistent storage"""
        
        try:
        
            pass
        except Exception as e:

            if not self.algo.ObjectStore.ContainsKey(self.state_file):
                return
            
            import json
            state_data = json.loads(
                self.algo.ObjectStore.Read(self.state_file)
            )
            
            # Restore system state
            self.system_state = SystemState[state_data['system_state']]
            self.emergency_mode = state_data['emergency_mode']
            
            # Restore strategy states
            for name, data in state_data['strategies'].items():
                if name in self.strategy_machines:
                    machine = self.strategy_machines[name]
                    # Would need to implement state restoration in machine
                    self.algo.Debug(f"[StateManager] Restored {name} state: {data['current_state']}")
            
        except Exception as e:
            self.algo.Error(f"[StateManager] Failed to load states: {e}")
    
    def _handle_strategy_error(self, name: str, context):
        """Handle strategy entering error state"""
        
        self.state_statistics[name]['errors'] += 1
        
        # Check if too many errors
        if self.state_statistics[name]['errors'] > 5:
            self.algo.Error(f"[StateManager] {name} has too many errors, halting")
            self.force_strategy_exit(name, "Excessive errors")
    
    def _handle_strategy_suspension(self, name: str, context):
        """Handle strategy suspension"""
        
        self.algo.Debug(f"[StateManager] {name} suspended: {context.message}")
    
    def _check_vix_spike(self) -> bool:
        """Check for VIX spike with caching"""
        
        cache_key = 'vix_spike_check'
        return self.condition_cache.get(
            cache_key,
            lambda: self._check_vix_spike_internal(),
            cache_type=CacheType.MARKET_DATA
        )
    
    def _check_vix_spike_internal(self) -> bool:
        """Internal VIX spike check (cached)"""
        try:
            pass
        except Exception as e:

            vix = self.algo.vix
            if vix in self.algo.Securities:
                return self.algo.Securities[vix].Price > 35
        except Exception as e:
            self.algo.Debug(f"[StateManager] High volatility check error: {e}")
        
        return False
    
    def _check_margin_call(self) -> bool:
        """Check for margin call risk with caching"""
        
        cache_key = 'margin_call_check'
        return self.condition_cache.get(
            cache_key,
            lambda: self._check_margin_call_internal(),
            cache_type=CacheType.GENERAL
        )
    
    def _check_margin_call_internal(self) -> bool:
        """Internal margin call check (cached)"""
        margin_used = self.algo.Portfolio.TotalMarginUsed
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        if portfolio_value > 0:
            margin_ratio = margin_used / portfolio_value
            return margin_ratio > 0.8  # 80% margin usage
        
        return False
    
    def _check_correlation_breach(self) -> bool:
        """Check if correlation limits breached with caching"""
        
        cache_key = 'correlation_check'
        return self.condition_cache.get(
            cache_key,
            lambda: self._check_correlation_breach_internal(),
            cache_type=CacheType.GENERAL
        )
    
    def _check_correlation_breach_internal(self) -> bool:
        """Internal correlation check (cached)"""
        # Would check actual correlation
        # For now, return False
        return False
    
    def _check_data_stale(self) -> bool:
        """Check if data is stale with caching"""
        
        cache_key = 'data_stale_check'
        return self.condition_cache.get(
            cache_key,
            lambda: self._check_data_stale_internal(),
            cache_type=CacheType.GENERAL
        )
    
    def _check_data_stale_internal(self) -> bool:
        """Internal data staleness check (cached)"""
        # Would check data freshness
        # For now, return False
        return False
    
    def _get_cached_market_state(self) -> str:
        """Get market state with caching"""
        
        cache_key = 'market_state'
        return self.condition_cache.get(
            cache_key,
            lambda: 'open' if self.algo.IsMarketOpen(self.algo.spy) else 'closed',
            cache_type=CacheType.MARKET_DATA
        )
    
    def _log_cache_performance(self):
        """Log unified state management cache performance"""
        try:
            pass
        except Exception as e:

            unified_stats = self.state_cache.get_statistics()
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[State Cache] Unified Hit Rate: {unified_stats['hit_rate']:.1%} | "
                    f"Size: {unified_stats['cache_size']}/{unified_stats['max_size']} | "
                    f"Memory: {unified_stats['memory_usage_mb']:.1f}MB | "
                    f"State: {unified_stats.get('state_entries', 0)} | "
                    f"Market-Data: {unified_stats.get('market_data_entries', 0)}"
                )
            
            # Performance warnings
            if unified_stats['hit_rate'] < 0.3:  # Less than 30% hit rate
                self.algo.Log(f"[Performance Warning] State cache hit rate low: {unified_stats['hit_rate']:.1%}")
                
        except Exception as e:
            self.algo.Debug(f"[State Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> Dict:
        """Get unified state management cache statistics"""
        try:
            pass
        except Exception as e:

            unified_stats = self.state_cache.get_statistics()
            return {
                'unified_cache': unified_stats,
                'state_specific_entries': {
                    'state_entries': unified_stats.get('state_entries', 0),
                    'market_data_entries': unified_stats.get('market_data_entries', 0),
                    'general_entries': unified_stats.get('general_entries', 0)
                },
                'total_memory_mb': unified_stats['memory_usage_mb']
            }
        except Exception as e:
            self.algo.Error(f"[State Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_state_cache(self, reason: str = "manual"):
        """Manually invalidate state management caches"""
        try:
            state_count = self.state_cache.invalidate_by_cache_type(CacheType.STATE)
        market_count = self.state_cache.invalidate_by_cache_type(CacheType.MARKET_DATA)
        general_count = self.state_cache.invalidate_by_cache_type(CacheType.GENERAL)
        except Exception as e:

            # Invalidate state and market data cache types used by state manager
            
            self.algo.Debug(
                f"[State Cache] Invalidated {state_count} state + {market_count} market + {general_count} general entries. Reason: {reason}"
            )
        except Exception as e:
            self.algo.Error(f"[State Cache] Error invalidating cache: {e}")
    
    def get_dashboard(self) -> Dict:
        """Get state management dashboard data with cache performance"""
        
        dashboard = {
            'system_state': self.system_state.name,
            'emergency_mode': self.emergency_mode,
            'active_strategies': len(self.get_active_strategies()),
            'total_strategies': len(self.strategy_machines),
            'strategy_states': self.get_strategy_states(),
            'statistics': {},
            'cache_performance': self.get_cache_statistics()
        }
        
        # Add statistics
        for name, stats in self.state_statistics.items():
            machine = self.strategy_machines[name]
            dashboard['statistics'][name] = {
                'current_state': machine.current_state.name,
                'transitions': stats['transitions'],
                'errors': stats['errors'],
                'uptime': str(self.algo.Time - stats['last_state_change'])
            }
        
        return dashboard
    
    def get_system_state(self) -> Dict[str, Any]:
        """Get comprehensive system state information
        
        Critical method for monitoring and debugging - provides complete system status
        including states, health metrics, and operational conditions.
        
        Returns:
            Dict: Complete system state information with structure:
                {
                    'system_state': str,
                    'emergency_mode': bool,
                    'market_state': str,
                    'strategies': dict,
                    'active_count': int,
                    'halt_reasons': list,
                    'health_indicators': dict,
                    'cache_performance': dict,
                    'timestamp': str
                }
        """
        try:
            pass
        except Exception as e:

            current_time = self.algo.Time
            
            # Get basic system state
            system_info = {
                'system_state': self.system_state.name,
                'emergency_mode': self.emergency_mode,
                'market_state': self._get_cached_market_state(),
                'timestamp': str(current_time)
            }
            
            # Get strategy information
            strategy_states = {}
            active_count = 0
            
            for name, machine in self.strategy_machines.items():
                state_info = {
                    'current_state': machine.current_state.name,
                    'can_trade': machine.is_in_any_state([
                        StrategyState.READY,
                        StrategyState.ANALYZING
                    ]),
                    'has_position': machine.is_in_any_state([
                        StrategyState.POSITION_OPEN,
                        StrategyState.MANAGING,
                        StrategyState.ADJUSTING
                    ]),
                    'error_count': machine.error_count,
                    'statistics': machine.get_statistics() if hasattr(machine, 'get_statistics') else {}
                }
                
                if state_info['has_position']:
                    active_count += 1
                    
                strategy_states[name] = state_info
            
            system_info.update({
                'strategies': strategy_states,
                'active_count': active_count,
                'total_strategies': len(self.strategy_machines)
            })
            
            # Add halt reasons if any
            system_info['halt_reasons'] = self.halt_reasons
            
            # Add health indicators
            health_indicators = {
                'vix_spike': self._check_vix_spike(),
                'margin_risk': self._check_margin_call(), 
                'correlation_breach': self._check_correlation_breach(),
                'data_stale': self._check_data_stale(),
                'can_enter_positions': not self.emergency_mode and self.system_state == SystemState.MARKET_OPEN
            }
            system_info['health_indicators'] = health_indicators
            
            # Add cache performance
            system_info['cache_performance'] = self.get_cache_statistics()
            
            # Add operational metrics
            system_info['operational_metrics'] = {
                'last_save': str(self.last_save),
                'save_interval_minutes': self.save_interval.total_seconds() / 60,
                'total_transitions': sum(stats['transitions'] for stats in self.state_statistics.values()),
                'total_errors': sum(stats['errors'] for stats in self.state_statistics.values())
            }
            
            return system_info
            
        except Exception as e:
            self.algo.Error(f"[StateManager] Error getting system state: {e}")
            # Return minimal safe state
            return {
                'system_state': self.system_state.name if hasattr(self, 'system_state') else 'UNKNOWN',
                'emergency_mode': getattr(self, 'emergency_mode', True),
                'market_state': 'unknown',
                'strategies': {},
                'active_count': 0,
                'total_strategies': 0,
                'halt_reasons': [],
                'health_indicators': {},
                'cache_performance': {},
                'timestamp': str(self.algo.Time),
                'error': str(e)
            }

    def shutdown(self):
        """Graceful shutdown of state management"""
        
        self.algo.Debug("[StateManager] Shutting down state management")
        
        # Save final states
        self.save_all_states()
        
        # Close all positions
        for name in self.get_active_strategies():
            self.force_strategy_exit(name, "System shutdown")
        
        self._transition_system(SystemState.SHUTTING_DOWN)
    
    def get_system_summary(self) -> Dict[str, Any]:
        """Get system summary - alias for get_system_state() for interface compatibility"""
        return self.get_system_state()
    
    # IManager interface implementation
    def handle_event(self, event: Event) -> bool:
        """Handle incoming events from the event bus"""
        try:
            if event.event_type == EventType.PORTFOLIO_UPDATE:
                self._update_portfolio_state(event.data)
        return True
        elif event.event_type == EventType.POSITION_OPENED:
            self._handle_position_opened(event.data)
        return True
        elif event.event_type == EventType.POSITION_CLOSED:
            self._handle_position_closed(event.data)
        return True
        elif event.event_type == EventType.SYSTEM_HALT:
            self._transition_system(SystemState.EMERGENCY)
        return True
        except Exception as e:

            # Handle system-level events that affect state management
            
            return False
        except Exception as e:
            self.algo.Error(f"[StateManager] Error handling event {event.event_type}: {e}")
            return False
    
    def get_dependencies(self) -> List[str]:
        """Return list of manager names this manager depends on"""
        return ['event_bus', 'cache_manager']  # State manager depends on event bus and caching
    
    def can_initialize_without_dependencies(self) -> bool:
        """Return True if this manager can initialize before its dependencies are ready"""
        return False  # State manager needs event bus and cache to function properly
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "state_manager"
    
    def _update_portfolio_state(self, data: Dict[str, Any]):
        """Update portfolio-related state information"""
        if 'portfolio_value' in data:
            self._portfolio_value = data['portfolio_value']
    
    def _handle_position_opened(self, data: Dict[str, Any]):
        """Handle position opened event for state tracking"""
        if 'symbol' in data and 'strategy' in data:
            strategy_name = data['strategy']
            if strategy_name in self.strategy_machines:
                self.algo.Debug(f"[StateManager] Position opened for {strategy_name}: {data['symbol']}")
    
    def _handle_position_closed(self, data: Dict[str, Any]):
        """Handle position closed event for state tracking"""
        if 'symbol' in data and 'strategy' in data:
            strategy_name = data['strategy']
            if strategy_name in self.strategy_machines:
                self.algo.Debug(f"[StateManager] Position closed for {strategy_name}: {data['symbol']}")
    
    # Cache refresh marker - ensures QuantConnect sees latest method definitions
    def _cache_refresh_marker(self):
        """Internal marker method to force cache refresh - do not remove"""
        return "cache_refresh_2025_09_12"