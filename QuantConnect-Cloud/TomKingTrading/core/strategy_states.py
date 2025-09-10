# Strategy States - QuantConnect Compatible Implementation
# Simple constants approach to avoid enum compatibility issues

from AlgorithmImports import *
from typing import Dict, Set, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

class StrategyStates:
    """Strategy state constants - QuantConnect compatible approach"""
    
    # Core operational states
    INITIALIZING = "INITIALIZING"
    READY = "READY"
    ANALYZING = "ANALYZING"
    PENDING_ENTRY = "PENDING_ENTRY"
    ENTERING = "ENTERING"
    POSITION_OPEN = "POSITION_OPEN"
    MANAGING = "MANAGING"
    ADJUSTING = "ADJUSTING"
    PENDING_EXIT = "PENDING_EXIT"
    EXITING = "EXITING"
    PARTIAL_EXIT = "PARTIAL_EXIT"
    CLOSED = "CLOSED"
    ERROR = "ERROR"
    SUSPENDED = "SUSPENDED"
    TERMINATED = "TERMINATED"
    
    # Valid state transitions map
    TRANSITIONS = {
        INITIALIZING: [READY, ERROR],
        READY: [ANALYZING, SUSPENDED, ERROR],
        ANALYZING: [PENDING_ENTRY, READY, ERROR],
        PENDING_ENTRY: [ENTERING, READY, SUSPENDED, ERROR],
        ENTERING: [POSITION_OPEN, ERROR],
        POSITION_OPEN: [MANAGING, PENDING_EXIT, ERROR],
        MANAGING: [ADJUSTING, PENDING_EXIT, ERROR],
        ADJUSTING: [MANAGING, PENDING_EXIT, ERROR],
        PENDING_EXIT: [EXITING, PARTIAL_EXIT, ERROR],
        EXITING: [CLOSED, PARTIAL_EXIT, ERROR],
        PARTIAL_EXIT: [MANAGING, EXITING, ERROR],
        CLOSED: [READY, TERMINATED],
        ERROR: [READY, TERMINATED],
        SUSPENDED: [READY, TERMINATED],
        TERMINATED: []
    }
    
    # State categories for easier management
    ENTRY_STATES = {READY, ANALYZING, PENDING_ENTRY, ENTERING}
    POSITION_STATES = {POSITION_OPEN, MANAGING, ADJUSTING}
    EXIT_STATES = {PENDING_EXIT, EXITING, PARTIAL_EXIT}
    FINAL_STATES = {CLOSED, ERROR, SUSPENDED, TERMINATED}
    ACTIVE_STATES = ENTRY_STATES | POSITION_STATES | EXIT_STATES
    
    @classmethod
    def is_valid_state(cls, state: str) -> bool:
        """Check if state is valid"""
        return hasattr(cls, state) and state.isupper()
    
    @classmethod
    def can_transition(cls, from_state: str, to_state: str) -> bool:
        """Check if transition is valid"""
        return to_state in cls.TRANSITIONS.get(from_state, [])
    
    @classmethod
    def get_valid_transitions(cls, from_state: str) -> List[str]:
        """Get valid transitions from current state"""
        return cls.TRANSITIONS.get(from_state, [])

class TransitionTriggers:
    """Transition trigger constants"""
    
    # Market triggers
    MARKET_OPEN = "MARKET_OPEN"
    MARKET_CLOSE = "MARKET_CLOSE"
    TIME_WINDOW_START = "TIME_WINDOW_START"
    TIME_WINDOW_END = "TIME_WINDOW_END"
    
    # Entry triggers
    ENTRY_CONDITIONS_MET = "ENTRY_CONDITIONS_MET"
    ENTRY_CONDITIONS_FAILED = "ENTRY_CONDITIONS_FAILED"
    ORDER_FILLED = "ORDER_FILLED"
    ORDER_REJECTED = "ORDER_REJECTED"
    PARTIAL_FILL = "PARTIAL_FILL"
    
    # Management triggers
    PROFIT_TARGET_HIT = "PROFIT_TARGET_HIT"
    STOP_LOSS_HIT = "STOP_LOSS_HIT"
    DEFENSIVE_EXIT_DTE = "DEFENSIVE_EXIT_DTE"
    ADJUSTMENT_NEEDED = "ADJUSTMENT_NEEDED"
    
    # Risk triggers
    MARGIN_CALL = "MARGIN_CALL"
    RISK_LIMIT_EXCEEDED = "RISK_LIMIT_EXCEEDED"
    CORRELATION_LIMIT = "CORRELATION_LIMIT"
    VIX_SPIKE = "VIX_SPIKE"
    
    # Event triggers
    EARNINGS_APPROACHING = "EARNINGS_APPROACHING"
    DIVIDEND_APPROACHING = "DIVIDEND_APPROACHING"
    FOMC_MEETING = "FOMC_MEETING"
    
    # System triggers
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"
    SYSTEM_ERROR = "SYSTEM_ERROR"
    DATA_STALE = "DATA_STALE"
    EMERGENCY_EXIT = "EMERGENCY_EXIT"
    RESET = "RESET"

@dataclass
class StateTransition:
    """Represents a state transition event"""
    timestamp: datetime
    from_state: str
    to_state: str
    trigger: str
    data: Dict = None
    message: str = ""
    
    def __post_init__(self):
        if self.data is None:
            self.data = {}
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for logging"""
        return {
            'timestamp': str(self.timestamp),
            'from_state': self.from_state,
            'to_state': self.to_state,
            'trigger': self.trigger,
            'data': self.data,
            'message': self.message
        }

class SimpleStateMachine:
    """
    Simplified state machine using string constants
    Designed for QuantConnect compatibility
    """
    
    def __init__(self, algorithm, strategy_name: str):
        self.algorithm = algorithm
        self.strategy_name = strategy_name
        self.current_state = StrategyStates.INITIALIZING
        self.transition_history: List[StateTransition] = []
        
        # State callbacks
        self.on_enter_callbacks: Dict[str, callable] = {}
        self.on_exit_callbacks: Dict[str, callable] = {}
        
        # Error handling
        self.error_count = 0
        self.max_errors = 3
        self.error_recovery_timeout = timedelta(minutes=30)
        self.error_state_entry_time: Optional[datetime] = None
        
        self.algorithm.Debug(f"[StateMachine] {strategy_name} initialized in {self.current_state}")
    
    def transition_to(self, new_state: str, trigger: str, data: Dict = None, message: str = "") -> bool:
        """
        Attempt to transition to new state
        Returns True if successful
        """
        
        # Validate states
        if not StrategyStates.is_valid_state(new_state):
            self.algorithm.Error(f"[StateMachine] Invalid target state: {new_state}")
            return False
        
        # Check if transition is valid
        if not StrategyStates.can_transition(self.current_state, new_state):
            self.algorithm.Debug(
                f"[StateMachine] Invalid transition: {self.current_state} -> {new_state} "
                f"(trigger: {trigger})"
            )
            return False
        
        # Create transition record
        transition = StateTransition(
            timestamp=self.algorithm.Time,
            from_state=self.current_state,
            to_state=new_state,
            trigger=trigger,
            data=data or {},
            message=message or f"Transition: {self.current_state} -> {new_state}"
        )
        
        # Execute exit callback for current state
        if self.current_state in self.on_exit_callbacks:
            try:
                self.on_exit_callbacks[self.current_state](transition)
            except Exception as e:
                self.algorithm.Error(f"[StateMachine] Exit callback error: {e}")
        
        # Update state
        previous_state = self.current_state
        self.current_state = new_state
        
        # Execute enter callback for new state
        if self.current_state in self.on_enter_callbacks:
            try:
                self.on_enter_callbacks[self.current_state](transition)
            except Exception as e:
                self.algorithm.Error(f"[StateMachine] Enter callback error: {e}")
                self.error_count += 1
                if self.error_count >= self.max_errors:
                    self._force_error_state()
                return False
        
        # Record transition
        self.transition_history.append(transition)
        
        # Log successful transition
        self.algorithm.Debug(
            f"[StateMachine] {self.strategy_name}: {previous_state} -> "
            f"{self.current_state} (trigger: {trigger})"
        )
        
        return True
    
    def is_in_state(self, state: str) -> bool:
        """Check if currently in specific state"""
        return self.current_state == state
    
    def is_in_any_state(self, states: Set[str]) -> bool:
        """Check if currently in any of the specified states"""
        return self.current_state in states
    
    def can_transition_to(self, state: str) -> bool:
        """Check if can transition to specified state"""
        return StrategyStates.can_transition(self.current_state, state)
    
    def get_valid_transitions(self) -> List[str]:
        """Get valid transitions from current state"""
        return StrategyStates.get_valid_transitions(self.current_state)
    
    def set_on_enter(self, state: str, callback: callable):
        """Set callback for entering a state"""
        self.on_enter_callbacks[state] = callback
    
    def set_on_exit(self, state: str, callback: callable):
        """Set callback for exiting a state"""
        self.on_exit_callbacks[state] = callback
    
    def get_state_duration(self) -> timedelta:
        """Get duration in current state"""
        if not self.transition_history:
            return timedelta(0)
        
        last_transition = self.transition_history[-1]
        return self.algorithm.Time - last_transition.timestamp
    
    def _force_error_state(self):
        """Force transition to error state"""
        self.current_state = StrategyStates.ERROR
        self.error_state_entry_time = self.algorithm.Time
        
        transition = StateTransition(
            timestamp=self.algorithm.Time,
            from_state=self.current_state,
            to_state=StrategyStates.ERROR,
            trigger=TransitionTriggers.SYSTEM_ERROR,
            message=f"Forced error state after {self.max_errors} errors"
        )
        self.transition_history.append(transition)
        
        self.algorithm.Error(
            f"[StateMachine] {self.strategy_name} forced to ERROR state - "
            f"will auto-recover in 30 minutes"
        )
    
    def check_error_recovery(self):
        """Check if ERROR state should auto-recover after timeout"""
        if (self.current_state == StrategyStates.ERROR and 
            self.error_state_entry_time):
            
            time_in_error = self.algorithm.Time - self.error_state_entry_time
            
            if time_in_error >= self.error_recovery_timeout:
                self.algorithm.Log(
                    f"[StateMachine] {self.strategy_name} auto-recovering "
                    f"from ERROR state after {time_in_error}"
                )
                
                # Transition to READY state
                if self.transition_to(StrategyStates.READY, TransitionTriggers.RESET):
                    self.error_count = 0
                    self.error_state_entry_time = None
                    self.algorithm.Log(
                        f"[StateMachine] {self.strategy_name} recovered to {self.current_state}"
                    )
                    return True
        return False
    
    def reset(self):
        """Reset state machine to initial state"""
        self.current_state = StrategyStates.INITIALIZING
        self.transition_history = []
        self.error_count = 0
        self.error_state_entry_time = None
        self.algorithm.Debug(f"[StateMachine] {self.strategy_name} reset to INITIALIZING")
    
    def get_statistics(self) -> Dict:
        """Get state machine statistics"""
        stats = {
            'current_state': self.current_state,
            'state_duration': str(self.get_state_duration()),
            'total_transitions': len(self.transition_history),
            'error_count': self.error_count
        }
        
        # Count time in each state
        state_times = {}
        for i, transition in enumerate(self.transition_history):
            if i > 0:
                duration = transition.timestamp - self.transition_history[i-1].timestamp
                state = self.transition_history[i-1].to_state
                if state not in state_times:
                    state_times[state] = timedelta(0)
                state_times[state] += duration
        
        stats['state_times'] = {
            state: str(time) for state, time in state_times.items()
        }
        
        return stats