# Unified State Manager for All Strategies
# Coordinates state machines across the entire framework

from AlgorithmImports import *
from core.state_machine import StrategyStateMachine, StrategyState, TransitionTrigger
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

class UnifiedStateManager:
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
        
        # State persistence
        self.state_file = "state_machines.json"
        self.last_save = datetime.min
        self.save_interval = timedelta(minutes=5)
        
        # Emergency controls
        self.emergency_mode = False
        self.halt_reasons = []
        
        # Performance tracking
        self.state_statistics = {}
        
        # Initialize system transitions
        self._setup_system_transitions()
        
        self.algo.Debug("[StateManager] Unified state manager initialized")
    
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
        """Update overall system state based on market conditions"""
        
        current_time = self.algo.Time
        
        # Check market hours
        if not self.algo.IsMarketOpen(self.algo.spy):
            if current_time.hour < 9:
                self._transition_system(SystemState.PRE_MARKET)
            else:
                self._transition_system(SystemState.MARKET_CLOSED)
        else:
            if not self.emergency_mode:
                self._transition_system(SystemState.MARKET_OPEN)
            else:
                self._transition_system(SystemState.EMERGENCY)
        
        # Check for system-wide triggers
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
        """Check if strategy can enter new position"""
        
        # Check system state
        if self.system_state not in [SystemState.MARKET_OPEN]:
            return False
        
        # Check emergency mode
        if self.emergency_mode:
            return False
        
        # Check strategy state
        machine = self.strategy_machines.get(strategy_name)
        if not machine:
            return False
        
        return machine.is_in_any_state([
            StrategyState.READY,
            StrategyState.ANALYZING
        ])
    
    def force_strategy_exit(self, strategy_name: str, reason: str):
        """Force a strategy to exit its position"""
        
        machine = self.strategy_machines.get(strategy_name)
        if machine:
            self.algo.Error(f"[StateManager] Forcing {strategy_name} exit: {reason}")
            machine.trigger(TransitionTrigger.EMERGENCY_EXIT, {'reason': reason})
    
    def halt_all_trading(self, reason: str):
        """Halt all trading activity"""
        
        self.emergency_mode = True
        self.halt_reasons.append({
            'time': self.algo.Time,
            'reason': reason
        })
        
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
        """Check for VIX spike"""
        
        try:
            vix = self.algo.vix
            if vix in self.algo.Securities:
                return self.algo.Securities[vix].Price > 35
        except Exception as e:
            self.algo.Debug(f"[StateManager] High volatility check error: {e}")
        
        return False
    
    def _check_margin_call(self) -> bool:
        """Check for margin call risk"""
        
        margin_used = self.algo.Portfolio.TotalMarginUsed
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        if portfolio_value > 0:
            margin_ratio = margin_used / portfolio_value
            return margin_ratio > 0.8  # 80% margin usage
        
        return False
    
    def _check_correlation_breach(self) -> bool:
        """Check if correlation limits breached"""
        
        # Would check actual correlation
        # For now, return False
        return False
    
    def _check_data_stale(self) -> bool:
        """Check if data is stale"""
        
        # Would check data freshness
        # For now, return False
        return False
    
    def get_dashboard(self) -> Dict:
        """Get state management dashboard data"""
        
        dashboard = {
            'system_state': self.system_state.name,
            'emergency_mode': self.emergency_mode,
            'active_strategies': len(self.get_active_strategies()),
            'total_strategies': len(self.strategy_machines),
            'strategy_states': self.get_strategy_states(),
            'statistics': {}
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
    
    def shutdown(self):
        """Graceful shutdown of state management"""
        
        self.algo.Debug("[StateManager] Shutting down state management")
        
        # Save final states
        self.save_all_states()
        
        # Close all positions
        for name in self.get_active_strategies():
            self.force_strategy_exit(name, "System shutdown")
        
        self._transition_system(SystemState.SHUTTING_DOWN)