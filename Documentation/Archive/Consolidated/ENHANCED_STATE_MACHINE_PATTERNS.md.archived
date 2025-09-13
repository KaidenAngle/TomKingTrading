# Enhanced State Machine Patterns

## Overview
Production-ready state machine implementation patterns for trading strategy lifecycle management, featuring comprehensive error handling, automatic recovery, transition validation, and crash resilience. These patterns extend basic state management to handle real-world trading complexities and failure scenarios.

## Beyond Basic State Machines

### Basic State Machine (Existing Documentation):
```python
# Simple state tracking
state = "WAITING"
if should_enter_trade():
    state = "ENTERING"
```

### Production State Machine (Enhanced Implementation):
```python
# Comprehensive lifecycle management
class StrategyStateMachine:
    def __init__(self, algorithm, strategy_name):
        self.current_state = StrategyState.INITIALIZING
        self.state_history = []  # Complete audit trail
        self.error_recovery_timeout = timedelta(minutes=30)
        self.max_errors = 3      # Automatic error handling
        self._setup_standard_transitions()  # Universal patterns
```

## Enhanced State Architecture

### Universal Strategy States
```python
class StrategyState(Enum):
    """Universal states for all trading strategies"""
    
    # Initialization states
    INITIALIZING = auto()      # Strategy being configured  
    READY = auto()             # Ready to trade, waiting for entry conditions
    
    # Entry states
    ANALYZING = auto()         # Analyzing market conditions
    PENDING_ENTRY = auto()     # Entry conditions met, awaiting execution
    ENTERING = auto()          # Actively entering position
    
    # Position management states
    POSITION_OPEN = auto()     # Position successfully opened
    MANAGING = auto()          # Actively managing position
    ADJUSTING = auto()         # Making adjustments to position
    
    # Exit states
    PENDING_EXIT = auto()      # Exit conditions met, awaiting execution
    EXITING = auto()           # Actively exiting position
    PARTIAL_EXIT = auto()      # Partially exiting position
    
    # Terminal states
    CLOSED = auto()            # Position closed successfully
    ERROR = auto()             # Error state requiring intervention
    SUSPENDED = auto()         # Temporarily suspended (e.g., due to events)
    TERMINATED = auto()        # Strategy terminated
```

**Design Rationale**: Each state represents a distinct algorithmic responsibility, enabling precise crash recovery and coordination between strategies.

### Comprehensive Transition Triggers
```python
class TransitionTrigger(Enum):
    """Events that trigger state transitions"""
    
    # Market triggers
    MARKET_OPEN = auto()
    MARKET_CLOSE = auto()
    TIME_WINDOW_START = auto()
    TIME_WINDOW_END = auto()
    
    # Entry triggers  
    ENTRY_CONDITIONS_MET = auto()
    ENTRY_CONDITIONS_FAILED = auto()
    ORDER_FILLED = auto()
    ORDER_REJECTED = auto()
    
    # Risk triggers
    VIX_SPIKE = auto()
    MARGIN_CALL = auto()
    RISK_LIMIT_EXCEEDED = auto()
    CORRELATION_LIMIT = auto()
    
    # Tom King specific triggers
    DEFENSIVE_EXIT_DTE = auto()      # 21 DTE rule
    EARNINGS_APPROACHING = auto()
    FOMC_MEETING = auto()
    
    # System triggers
    MANUAL_OVERRIDE = auto()
    SYSTEM_ERROR = auto()
    EMERGENCY_EXIT = auto()
```

## Advanced Error Handling Patterns

### Automatic Error Recovery
```python
class StrategyStateMachine:
    def __init__(self):
        self.error_count = 0
        self.max_errors = 3
        self.error_recovery_timeout = timedelta(minutes=30)
        self.error_state_entry_time = None
    
    def _force_error_state(self):
        """Force transition to error state after max errors reached"""
        self.current_state = StrategyState.ERROR
        self.error_state_entry_time = self.algorithm.Time
        self.algorithm.Error(
            f"[StateMachine] {self.strategy_name} forced to ERROR state - "
            f"will auto-recover in 30 minutes"
        )
    
    def check_error_recovery(self):
        """Check if ERROR state should auto-recover after timeout"""
        if (self.current_state == StrategyState.ERROR and 
            self.error_state_entry_time):
            
            time_in_error = self.algorithm.Time - self.error_state_entry_time
            
            if time_in_error >= self.error_recovery_timeout:
                self.algorithm.Log(
                    f"[StateMachine] {self.strategy_name} auto-recovering "
                    f"from ERROR state after {time_in_error}"
                )
                
                self.trigger(TransitionTrigger.RESET)
                self.error_count = 0
                self.error_state_entry_time = None
                return True
        return False
```

**Pattern Benefits**: Prevents strategy lockup from transient errors while maintaining safety boundaries.

### Transition Validation and Context
```python
@dataclass
class StateContext:
    """Context information for state transitions"""
    timestamp: datetime
    previous_state: StrategyState
    current_state: StrategyState
    trigger: TransitionTrigger
    data: Dict[str, Any] = field(default_factory=dict)
    message: str = ""
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for logging"""
        return {
            'timestamp': str(self.timestamp),
            'previous_state': self.previous_state.name,
            'current_state': self.current_state.name,
            'trigger': self.trigger.name,
            'data': self.data,
            'message': self.message
        }

def trigger(self, trigger: TransitionTrigger, data: Dict[str, Any] = None) -> bool:
    """Trigger state transition with comprehensive validation"""
    
    key = (self.current_state, trigger)
    
    # Check if transition exists
    if key not in self.transitions:
        self.algorithm.Debug(
            f"[StateMachine] No transition from {self.current_state.name} "
            f"with trigger {trigger.name}"
        )
        return False
    
    # Find valid transition (check conditions)
    valid_transition = None
    for transition in self.transitions[key]:
        if transition.condition is None or transition.condition(data):
            valid_transition = transition
            break
    
    if not valid_transition:
        self.algorithm.Debug(
            f"[StateMachine] No valid transition from {self.current_state.name} "
            f"with trigger {trigger.name} (conditions not met)"
        )
        return False
    
    # Create context for callbacks and logging
    context = StateContext(
        timestamp=self.algorithm.Time,
        previous_state=self.current_state,
        current_state=valid_transition.to_state,
        trigger=trigger,
        data=data or {},
        message=f"Transition: {self.current_state.name} -> {valid_transition.to_state.name}"
    )
    
    # Execute transition with error handling
    try:
        # Exit callback for current state
        if self.current_state in self.on_exit_callbacks:
            self.on_exit_callbacks[self.current_state](context)
        
        # Transition action
        if valid_transition.action:
            valid_transition.action(context)
        
        # Update state
        self.current_state = valid_transition.to_state
        
        # Enter callback for new state
        if self.current_state in self.on_enter_callbacks:
            self.on_enter_callbacks[self.current_state](context)
        
        # Log successful transition
        self.state_history.append(context)
        self.algorithm.Debug(
            f"[StateMachine] {self.strategy_name}: {previous_state.name} -> "
            f"{self.current_state.name} (trigger: {trigger.name})"
        )
        
        return True
        
    except Exception as e:
        self.algorithm.Error(f"[StateMachine] Transition error: {e}")
        self.error_count += 1
        
        if self.error_count >= self.max_errors:
            self._force_error_state()
        
        return False
```

## Standard Transition Patterns

### Universal Trading Strategy Flow
```python
def _setup_standard_transitions(self):
    """Setup standard state transitions common to all strategies"""
    
    # Initialization flow
    self.add_transition(
        StrategyState.INITIALIZING,
        StrategyState.READY,
        TransitionTrigger.MARKET_OPEN
    )
    
    # Entry analysis flow
    self.add_transition(
        StrategyState.READY,
        StrategyState.ANALYZING,
        TransitionTrigger.TIME_WINDOW_START
    )
    
    self.add_transition(
        StrategyState.ANALYZING,
        StrategyState.PENDING_ENTRY,
        TransitionTrigger.ENTRY_CONDITIONS_MET
    )
    
    # Position management flow
    self.add_transition(
        StrategyState.ENTERING,
        StrategyState.POSITION_OPEN,
        TransitionTrigger.ORDER_FILLED
    )
    
    self.add_transition(
        StrategyState.POSITION_OPEN,
        StrategyState.MANAGING,
        TransitionTrigger.MARKET_OPEN
    )
    
    # Tom King specific: 21 DTE defensive exit
    self.add_transition(
        StrategyState.MANAGING,
        StrategyState.PENDING_EXIT,
        TransitionTrigger.DEFENSIVE_EXIT_DTE
    )
    
    # Emergency exits from any operational state
    for state in [StrategyState.ANALYZING, StrategyState.MANAGING, StrategyState.ADJUSTING]:
        self.add_transition(
            state,
            StrategyState.EXITING,
            TransitionTrigger.EMERGENCY_EXIT
        )
    
    # Error transitions from any non-terminal state
    for state in StrategyState:
        if state not in [StrategyState.ERROR, StrategyState.TERMINATED]:
            self.add_transition(
                state,
                StrategyState.ERROR,
                TransitionTrigger.SYSTEM_ERROR
            )
```

## Production Monitoring and Analytics

### State Duration Tracking
```python
def get_state_duration(self) -> timedelta:
    """Get duration in current state"""
    if not self.state_history:
        return timedelta(0)
    
    last_transition = self.state_history[-1]
    return self.algorithm.Time - last_transition.timestamp

def get_statistics(self) -> Dict:
    """Get comprehensive state machine statistics"""
    stats = {
        'current_state': self.current_state.name,
        'state_duration': str(self.get_state_duration()),
        'total_transitions': len(self.state_history),
        'error_count': self.error_count
    }
    
    # Time spent in each state
    state_times = {}
    for i, transition in enumerate(self.state_history):
        if i > 0:
            duration = transition.timestamp - self.state_history[i-1].timestamp
            state = self.state_history[i-1].current_state
            if state not in state_times:
                state_times[state] = timedelta(0)
            state_times[state] += duration
    
    stats['state_times'] = {
        state.name: str(time) for state, time in state_times.items()
    }
    
    return stats
```

### Callback Pattern for State Actions
```python
def set_state_callbacks(self):
    """Setup strategy-specific state callbacks"""
    
    # Entry state: Validate market conditions
    self.state_machine.set_on_enter(StrategyState.ANALYZING, self._analyze_entry_conditions)
    
    # Position management: Monitor Greeks and risk
    self.state_machine.set_on_enter(StrategyState.MANAGING, self._start_position_monitoring)
    self.state_machine.set_on_exit(StrategyState.MANAGING, self._stop_position_monitoring)
    
    # Error state: Log diagnostics and alert
    self.state_machine.set_on_enter(StrategyState.ERROR, self._handle_error_state)

def _analyze_entry_conditions(self, context: StateContext):
    """Callback for entering ANALYZING state"""
    # Validate VIX conditions
    # Check correlation limits
    # Verify margin availability
    # Tom King specific: Check 21 DTE rule
    
def _handle_error_state(self, context: StateContext):
    """Callback for entering ERROR state"""
    # Log detailed error diagnostics
    # Send alert notifications
    # Preserve state for manual investigation
    # Schedule automatic recovery
```

## Integration with Multi-Strategy Coordination

### Strategy State Aggregation
```python
def get_system_state_summary(self) -> Dict:
    """Get state summary across all strategies"""
    summary = {
        'total_strategies': len(self.strategy_state_machines),
        'active_strategies': 0,
        'error_strategies': 0,
        'suspended_strategies': 0
    }
    
    for strategy_name, state_machine in self.strategy_state_machines.items():
        state = state_machine.current_state
        
        if state in [StrategyState.MANAGING, StrategyState.ADJUSTING]:
            summary['active_strategies'] += 1
        elif state == StrategyState.ERROR:
            summary['error_strategies'] += 1
        elif state == StrategyState.SUSPENDED:
            summary['suspended_strategies'] += 1
    
    return summary
```

### Coordinated State Transitions
```python
def trigger_system_wide_suspension(self):
    """Suspend all strategies for system-wide events"""
    
    for strategy_name, state_machine in self.strategy_state_machines.items():
        if state_machine.can_transition(TransitionTrigger.EARNINGS_APPROACHING):
            state_machine.trigger(
                TransitionTrigger.EARNINGS_APPROACHING,
                {'reason': 'System-wide earnings suspension'}
            )
```

## Benefits of Enhanced Patterns

### Reliability Benefits:
- **Automatic Recovery**: Strategies recover from transient errors automatically
- **Complete Audit Trail**: Every state transition logged with context
- **Crash Resilience**: State persisted across algorithm restarts
- **Error Isolation**: Single strategy errors don't affect system

### Operational Benefits:
- **Production Monitoring**: Real-time state visibility across all strategies
- **Debugging Support**: Complete transition history for issue diagnosis
- **Coordinated Management**: System-wide state coordination for events
- **Performance Analytics**: Time-in-state analysis for optimization

### Development Benefits:
- **Consistent Patterns**: Universal state flow across all strategies
- **Callback Architecture**: Clean separation of state logic and strategy logic
- **Testing Support**: State machine behavior easily testable in isolation
- **Documentation**: States and transitions serve as strategy documentation

This enhanced state machine architecture transforms simple state tracking into a robust, production-ready strategy lifecycle management system that handles real-world trading complexities and failure scenarios.

## Related Documentation
- [State Machine Architecture](STATE_MACHINE_ARCHITECTURE.md) - Basic state machine concepts
- [Multi-Strategy Coordination](MULTI_STRATEGY_COORDINATION.md) - How state machines coordinate strategies
- [Integration Verification Patterns](INTEGRATION_VERIFICATION_PATTERNS.md) - Verification of state machine integration