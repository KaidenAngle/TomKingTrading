# State Machine Architecture

## Overview
Each strategy uses a state machine to manage its lifecycle. This looks like over-engineering but is critical for multi-strategy coordination and crash recovery.

## Why State Machines for Options Trading?

### The Problem Without State Machines:
```python
# DANGEROUS - No state tracking
if should_enter_trade():
    place_order()
# What if system crashes here?
# What if order partially fills?
# What if we need to exit urgently?
```

### With State Machines:
```python
# SAFE - Full state tracking
state = self.state_machine.get_current_state()
if state == "WAITING" and should_enter_trade():
    self.state_machine.transition_to("ENTERING")
    # State persisted, recoverable after crash
```

## State Flow for Each Strategy

### Base States (All Strategies)
```
WAITING → ENTERING → ACTIVE → MANAGING → EXITING → COMPLETE
   ↑                              ↓
   └──────── ERROR ←──────────────┘
```

### Strategy-Specific States

#### 0DTE Friday Strategy
```
WAITING (VIX check) 
    → ENTERING (place iron condor atomically)
    → ACTIVE (monitor position)
    → DEFENSIVE_EXIT (if breached) or MANAGING (3:30 PM)
    → EXITING (close all legs)
    → COMPLETE
```

#### LT112 Strategy
```
WAITING (112 DTE check)
    → ENTERING (place put spread)
    → ACTIVE (monitor for 91 days)
    → DEFENSIVE_21DTE (if still open at 21 DTE)
    → EXITING (close spread)
    → COMPLETE
```

## Why Each Strategy Needs Its Own State Machine

### 1. Different Lifecycles
- **0DTE**: Lives for hours (9:30 AM - 4:00 PM)
- **LT112**: Lives for months (112 days max)
- **LEAP Ladders**: Lives for years (building over time)

### 2. Different Exit Conditions
- **0DTE**: Time-based (3:30 PM) or loss-based (defensive exit)
- **LT112**: DTE-based (21 DTE rule) or profit target
- **IPMCC**: Assignment-based or profit target

### 3. Different Recovery Needs
- **0DTE**: If crashed during iron condor entry, must check all 4 legs
- **LT112**: If crashed during management, must check DTE
- **Futures Strangle**: If crashed during roll, must verify both sides

## State Persistence and Recovery

### Why Persist States?
```python
# Scenario: System crashes at 10:30 AM
# 0DTE has open iron condor
# LT112 has 45 DTE position
# LEAP ladder partially built

# On restart:
for strategy_name, state_machine in self.state_machines.items():
    state = self.load_state(strategy_name)
    state_machine.restore(state)
    # Each strategy knows exactly where it was
```

### ObjectStore Schema
```json
{
    "strategy": "LT112",
    "state": "ACTIVE",
    "entry_time": "2024-01-15T10:30:00",
    "position": {
        "short_put": "SPY_240501P450",
        "long_put": "SPY_240501P445",
        "contracts": 3
    },
    "management": {
        "dte_at_entry": 112,
        "current_dte": 45,
        "defensive_triggered": false
    }
}
```

## State Coordination Between Strategies

### The UnifiedStateManager
```python
class UnifiedStateManager:
    def can_enter_new_position(self, strategy_name: str) -> bool:
        # Check if any strategy is in critical state
        if self.any_strategy_in_state(["ERROR", "EMERGENCY_EXIT"]):
            return False
        
        # Check strategy-specific conditions
        if strategy_name == "0DTE":
            # Can't enter if LT112 is in DEFENSIVE_21DTE
            if self.get_strategy_state("LT112") == "DEFENSIVE_21DTE":
                return False
```

### Why Strategies Need to Know About Each Other
1. **Capital allocation** - Can't enter new positions if another is in trouble
2. **Risk coordination** - Multiple strategies might need emergency exit
3. **SPY concentration** - Total exposure across all strategies

## Common State Patterns

### Pattern 1: Atomic Entry
```
WAITING → ENTERING (atomic) → ACTIVE or WAITING (rollback)
```
Used by: 0DTE, Futures Strangle

### Pattern 2: Time-Based Management
```
ACTIVE → MANAGING (at specific time) → EXITING
```
Used by: 0DTE (3:30 PM), IPMCC (expiration approach)

### Pattern 3: Defensive Exit
```
ACTIVE → DEFENSIVE_EXIT (risk triggered) → COMPLETE
```
Used by: All strategies (different triggers)

## Why Not Simplify?

### Bad Idea 1: "Just use flags instead of states"
**Problem**: Flags don't capture transitions, history, or complex states

### Bad Idea 2: "Use one state machine for all strategies"
**Problem**: Each strategy has unique lifecycle, would create massive complexity

### Bad Idea 3: "Don't persist states"
**Problem**: System crash would lose all position context

## Testing State Machines

### Unit Tests Required:
- Valid transitions succeed
- Invalid transitions blocked
- State persistence works
- Recovery from each state

### Integration Tests Required:
- Multiple strategies transitioning simultaneously
- Coordinator blocking based on states
- Emergency halt affects all states

## Configuration

### State Machine Settings
```python
# In each strategy
VALID_TRANSITIONS = {
    "WAITING": ["ENTERING", "ERROR"],
    "ENTERING": ["ACTIVE", "WAITING", "ERROR"],
    "ACTIVE": ["MANAGING", "DEFENSIVE_EXIT", "EXITING", "ERROR"],
    # ...
}

STATE_TIMEOUT = {
    "ENTERING": timedelta(minutes=5),  # Must complete entry
    "EXITING": timedelta(minutes=5),   # Must complete exit
}
```

## Enhanced Production State Machine Patterns

### Beyond Basic State Tracking

The production implementation extends basic state management with comprehensive error handling, automatic recovery, and transition validation:

```python
class StrategyStateMachine:
    def __init__(self, algorithm, strategy_name):
        self.current_state = StrategyState.INITIALIZING
        self.state_history = []  # Complete audit trail
        self.error_recovery_timeout = timedelta(minutes=30)
        self.max_errors = 3      # Automatic error handling
        self._setup_standard_transitions()  # Universal patterns
```

### Universal Strategy States (Enhanced)

```python
class StrategyState(Enum):
    INITIALIZING = "INITIALIZING"      # Enhanced: System startup validation
    WAITING = "WAITING"                # Base: Ready for entry signal
    VALIDATION = "VALIDATION"          # Enhanced: Pre-trade validation
    ENTERING = "ENTERING"              # Base: Atomic order placement
    ACTIVE = "ACTIVE"                  # Base: Position monitoring
    MANAGING = "MANAGING"              # Base: Active position management
    DEFENSIVE_EXIT = "DEFENSIVE_EXIT"  # Base: Risk-triggered exit
    EXITING = "EXITING"               # Base: Normal position exit
    COMPLETE = "COMPLETE"             # Base: Strategy cycle finished
    ERROR = "ERROR"                   # Enhanced: Error handling with recovery
    RECOVERY = "RECOVERY"             # Enhanced: Automatic error recovery
```

### Production Error Handling

```python
def handle_state_error(self, error: Exception, context: Dict):
    """Enhanced error handling with automatic recovery"""

    # Log error with complete context
    error_record = {
        'timestamp': self.algo.Time,
        'current_state': self.current_state,
        'error_type': type(error).__name__,
        'error_message': str(error),
        'context': context,
        'position_details': self.get_position_snapshot()
    }

    # Increment error count for circuit breaker
    self.error_count += 1

    # Enhanced: Determine recovery strategy
    recovery_action = self._determine_recovery_action(error, context)

    if recovery_action == RecoveryAction.AUTOMATIC_RETRY:
        self.transition_to(StrategyState.RECOVERY)
    elif recovery_action == RecoveryAction.DEFENSIVE_EXIT:
        self.transition_to(StrategyState.DEFENSIVE_EXIT)
    else:
        self.transition_to(StrategyState.ERROR)
```

### Enhanced Transition Validation

```python
def validate_transition(self, from_state: StrategyState, to_state: StrategyState) -> bool:
    """Enhanced transition validation with context awareness"""

    # Standard transition validation
    if to_state not in self.valid_transitions.get(from_state, []):
        return False

    # Enhanced: Market condition validation
    if to_state == StrategyState.ENTERING:
        if not self._validate_market_conditions():
            return False

    # Enhanced: Resource availability validation
    if to_state in [StrategyState.ENTERING, StrategyState.MANAGING]:
        if not self._validate_system_resources():
            return False

    # Enhanced: Risk limit validation
    if not self._validate_risk_limits(to_state):
        return False

    return True
```

### Automatic Recovery Patterns

```python
class RecoveryManager:
    """Enhanced recovery manager for automatic error handling"""

    def __init__(self):
        self.recovery_strategies = {
            ConnectionError: self._handle_connection_recovery,
            TimeoutError: self._handle_timeout_recovery,
            MarketDataError: self._handle_data_recovery,
            OrderRejection: self._handle_order_recovery
        }

    def execute_recovery(self, state_machine, error_type, context):
        """Execute appropriate recovery strategy"""
        recovery_func = self.recovery_strategies.get(error_type)
        if recovery_func:
            return recovery_func(state_machine, context)
        else:
            return self._handle_generic_recovery(state_machine, context)
```

### Enhanced Implementation

**Production Features:**
- Error handling patterns from production trading experience
- Automatic recovery mechanisms for common failure scenarios
- Enhanced validation for complex multi-strategy coordination
- Complete state audit trails and transition history

## Summary

State machines are **essential infrastructure** for multi-strategy options trading:

1. **Lifecycle Management** - Each strategy has distinct phases
2. **Crash Recovery** - Know exactly where to resume
3. **Risk Coordination** - Strategies aware of system state
4. **Audit Trail** - Complete history of state transitions
5. **Enhanced Error Handling** - Automatic recovery from common failures
6. **Production Resilience** - Battle-tested patterns from live trading

The complexity is justified by:
- Preventing orphaned positions after crashes
- Coordinating multiple strategies safely
- Providing clear recovery paths
- Enabling proper risk management
- Handling real-world trading failures gracefully

**This is sophisticated system design, not over-engineering.**