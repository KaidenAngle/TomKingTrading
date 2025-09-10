# State Machine Pattern Implementation for Tom King Trading Framework
# Provides clean, maintainable state transitions for trading strategies

from AlgorithmImports import *
from enum import Enum, auto
from typing import Dict, Optional, Callable, Any, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json

class StrategyState(Enum):
    """Universal strategy states for all trading strategies"""
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
    PARTIAL_FILL = auto()
    
    # Management triggers
    PROFIT_TARGET_HIT = auto()
    STOP_LOSS_HIT = auto()
    DEFENSIVE_EXIT_DTE = auto()  # Tom King's 21 DTE rule
    ADJUSTMENT_NEEDED = auto()
    
    # Risk triggers
    MARGIN_CALL = auto()
    RISK_LIMIT_EXCEEDED = auto()
    CORRELATION_LIMIT = auto()
    VIX_SPIKE = auto()
    
    # Event triggers
    EARNINGS_APPROACHING = auto()
    DIVIDEND_APPROACHING = auto()
    FOMC_MEETING = auto()
    
    # System triggers
    MANUAL_OVERRIDE = auto()
    SYSTEM_ERROR = auto()
    DATA_STALE = auto()
    EMERGENCY_EXIT = auto()

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

class StateTransition:
    """Defines a valid state transition"""
    def __init__(self, 
                 from_state: StrategyState,
                 to_state: StrategyState,
                 trigger: TransitionTrigger,
                 condition: Optional[Callable] = None,
                 action: Optional[Callable] = None):
        self.from_state = from_state
        self.to_state = to_state
        self.trigger = trigger
        self.condition = condition  # Optional condition check
        self.action = action        # Optional action to execute

class StrategyStateMachine:
    """
    State machine for managing strategy lifecycle
    Ensures clean, predictable state transitions
    """
    
    def __init__(self, algorithm, strategy_name: str):
        self.algorithm = algorithm
        self.strategy_name = strategy_name
        self.current_state = StrategyState.INITIALIZING
        self.state_history = []
        self.transitions = {}
        self.state_actions = {}
        
        # State entry/exit callbacks
        self.on_enter_callbacks = {}
        self.on_exit_callbacks = {}
        
        # Error handling
        self.error_count = 0
        self.max_errors = 3
        self.error_recovery_timeout = timedelta(minutes=30)  # Auto-recover after 30 minutes
        self.error_state_entry_time = None
        
        # Initialize standard transitions
        self._setup_standard_transitions()
        
        self.algorithm.Debug(f"[StateMachine] {strategy_name} initialized in {self.current_state.name}")
    
    def _setup_standard_transitions(self):
        """Setup standard state transitions common to all strategies"""
        
        # Initialization transitions
        self.add_transition(
            StrategyState.INITIALIZING,
            StrategyState.READY,
            TransitionTrigger.MARKET_OPEN
        )
        
        # Entry transitions
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
        
        self.add_transition(
            StrategyState.ANALYZING,
            StrategyState.READY,
            TransitionTrigger.ENTRY_CONDITIONS_FAILED
        )
        
        self.add_transition(
            StrategyState.PENDING_ENTRY,
            StrategyState.ENTERING,
            TransitionTrigger.MARKET_OPEN
        )
        
        self.add_transition(
            StrategyState.ENTERING,
            StrategyState.POSITION_OPEN,
            TransitionTrigger.ORDER_FILLED
        )
        
        # Management transitions
        self.add_transition(
            StrategyState.POSITION_OPEN,
            StrategyState.MANAGING,
            TransitionTrigger.MARKET_OPEN
        )
        
        self.add_transition(
            StrategyState.MANAGING,
            StrategyState.ADJUSTING,
            TransitionTrigger.ADJUSTMENT_NEEDED
        )
        
        self.add_transition(
            StrategyState.ADJUSTING,
            StrategyState.MANAGING,
            TransitionTrigger.ORDER_FILLED
        )
        
        # Exit transitions
        self.add_transition(
            StrategyState.MANAGING,
            StrategyState.PENDING_EXIT,
            TransitionTrigger.PROFIT_TARGET_HIT
        )
        
        self.add_transition(
            StrategyState.MANAGING,
            StrategyState.PENDING_EXIT,
            TransitionTrigger.STOP_LOSS_HIT
        )
        
        self.add_transition(
            StrategyState.MANAGING,
            StrategyState.PENDING_EXIT,
            TransitionTrigger.DEFENSIVE_EXIT_DTE
        )
        
        self.add_transition(
            StrategyState.PENDING_EXIT,
            StrategyState.EXITING,
            TransitionTrigger.MARKET_OPEN
        )
        
        self.add_transition(
            StrategyState.EXITING,
            StrategyState.CLOSED,
            TransitionTrigger.ORDER_FILLED
        )
        
        # Error transitions (from any state)
        for state in StrategyState:
            if state not in [StrategyState.ERROR, StrategyState.TERMINATED]:
                self.add_transition(
                    state,
                    StrategyState.ERROR,
                    TransitionTrigger.SYSTEM_ERROR
                )
        
        # Error recovery transition
        self.add_transition(
            StrategyState.ERROR,
            StrategyState.READY,
            TransitionTrigger.RESET
        )
        
        # Suspension transitions (from operational states)
        for state in [StrategyState.READY, StrategyState.ANALYZING, StrategyState.PENDING_ENTRY]:
            self.add_transition(
                state,
                StrategyState.SUSPENDED,
                TransitionTrigger.EARNINGS_APPROACHING
            )
            
            self.add_transition(
                state,
                StrategyState.EXITING,
                TransitionTrigger.EMERGENCY_EXIT
            )
    
    def add_transition(self,
                       from_state: StrategyState,
                       to_state: StrategyState,
                       trigger: TransitionTrigger,
                       condition: Optional[Callable] = None,
                       action: Optional[Callable] = None):
        """Add a valid state transition"""
        
        key = (from_state, trigger)
        if key not in self.transitions:
            self.transitions[key] = []
        
        self.transitions[key].append(StateTransition(
            from_state, to_state, trigger, condition, action
        ))
    
    def trigger(self, trigger: TransitionTrigger, data: Dict[str, Any] = None) -> bool:
        """
        Trigger a state transition
        Returns True if transition successful
        """
        
        key = (self.current_state, trigger)
        
        # Check if transition exists
        if key not in self.transitions:
            self.algorithm.Debug(
                f"[StateMachine] No transition from {self.current_state.name} "
                f"with trigger {trigger.name}"
            )
            return False
        
        # Get possible transitions
        possible_transitions = self.transitions[key]
        
        # Find valid transition (check conditions)
        valid_transition = None
        for transition in possible_transitions:
            if transition.condition is None or transition.condition(data):
                valid_transition = transition
                break
        
        if not valid_transition:
            self.algorithm.Debug(
                f"[StateMachine] No valid transition from {self.current_state.name} "
                f"with trigger {trigger.name} (conditions not met)"
            )
            return False
        
        # Create context
        context = StateContext(
            timestamp=self.algorithm.Time,
            previous_state=self.current_state,
            current_state=valid_transition.to_state,
            trigger=trigger,
            data=data or {},
            message=f"Transition: {self.current_state.name} -> {valid_transition.to_state.name}"
        )
        
        # Execute exit callback for current state
        if self.current_state in self.on_exit_callbacks:
            try:
                self.on_exit_callbacks[self.current_state](context)
            except Exception as e:
                self.algorithm.Error(f"[StateMachine] Exit callback error: {e}")
        
        # Execute transition action if defined
        if valid_transition.action:
            try:
                valid_transition.action(context)
            except Exception as e:
                self.algorithm.Error(f"[StateMachine] Transition action error: {e}")
                self.error_count += 1
                if self.error_count >= self.max_errors:
                    self._force_error_state()
                return False
        
        # Update state
        previous_state = self.current_state
        self.current_state = valid_transition.to_state
        
        # Execute enter callback for new state
        if self.current_state in self.on_enter_callbacks:
            try:
                self.on_enter_callbacks[self.current_state](context)
            except Exception as e:
                self.algorithm.Error(f"[StateMachine] Enter callback error: {e}")
        
        # Log transition
        self.state_history.append(context)
        self.algorithm.Debug(
            f"[StateMachine] {self.strategy_name}: {previous_state.name} -> "
            f"{self.current_state.name} (trigger: {trigger.name})"
        )
        
        return True
    
    def set_on_enter(self, state: StrategyState, callback: Callable):
        """Set callback for entering a state"""
        self.on_enter_callbacks[state] = callback
    
    def set_on_exit(self, state: StrategyState, callback: Callable):
        """Set callback for exiting a state"""
        self.on_exit_callbacks[state] = callback
    
    def is_in_state(self, state: StrategyState) -> bool:
        """Check if currently in a specific state"""
        return self.current_state == state
    
    def is_in_any_state(self, states: List[StrategyState]) -> bool:
        """Check if currently in any of the specified states"""
        return self.current_state in states
    
    def can_transition(self, trigger: TransitionTrigger) -> bool:
        """Check if a transition is possible with given trigger"""
        key = (self.current_state, trigger)
        return key in self.transitions
    
    def get_state_duration(self) -> timedelta:
        """Get duration in current state"""
        if not self.state_history:
            return timedelta(0)
        
        last_transition = self.state_history[-1]
        return self.algorithm.Time - last_transition.timestamp
    
    def _force_error_state(self):
        """Force transition to error state"""
        self.current_state = StrategyState.ERROR
        self.error_state_entry_time = self.algorithm.Time  # Track entry time for auto-recovery
        context = StateContext(
            timestamp=self.algorithm.Time,
            previous_state=self.current_state,
            current_state=StrategyState.ERROR,
            trigger=TransitionTrigger.SYSTEM_ERROR,
            message=f"Forced error state after {self.max_errors} errors"
        )
        self.state_history.append(context)
        self.algorithm.Error(f"[StateMachine] {self.strategy_name} forced to ERROR state - will auto-recover in 30 minutes")
    
    def check_error_recovery(self):
        """Check if ERROR state should auto-recover after timeout"""
        if self.current_state == StrategyState.ERROR and self.error_state_entry_time:
            time_in_error = self.algorithm.Time - self.error_state_entry_time
            
            if time_in_error >= self.error_recovery_timeout:
                self.algorithm.Log(f"[StateMachine] {self.strategy_name} auto-recovering from ERROR state after {time_in_error}")
                
                # Transition to READY state
                self.transition(TransitionTrigger.RESET)
                self.error_count = 0  # Reset error count
                self.error_state_entry_time = None
                
                # Log recovery
                self.algorithm.Log(f"[StateMachine] {self.strategy_name} recovered to {self.current_state.name}")
                return True
        return False
    
    def reset(self):
        """Reset state machine to initial state"""
        self.current_state = StrategyState.INITIALIZING
        self.state_history = []
        self.error_count = 0
        self.error_state_entry_time = None
        self.algorithm.Debug(f"[StateMachine] {self.strategy_name} reset to INITIALIZING")
    
    def get_statistics(self) -> Dict:
        """Get state machine statistics"""
        stats = {
            'current_state': self.current_state.name,
            'state_duration': str(self.get_state_duration()),
            'total_transitions': len(self.state_history),
            'error_count': self.error_count
        }
        
        # Count time in each state
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