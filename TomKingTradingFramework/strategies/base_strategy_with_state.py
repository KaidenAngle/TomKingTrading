# Base Strategy with State Machine Integration  
# PHASE 3 OPTIMIZATION: Integrated with UnifiedStateManager coordination

from AlgorithmImports import *
from core.state_machine import StrategyStateMachine, StrategyState, TransitionTrigger
from config.constants import TradingConstants
from typing import Dict, Optional, Any
from datetime import time, timedelta
from abc import ABC, abstractmethod

class BaseStrategyWithState(ABC):
    """
    Base class for strategies with individual state machines
    Integrates with UnifiedStateManager for system-wide coordination
    Each strategy maintains its own StrategyStateMachine (CRITICAL_DO_NOT_CHANGE.md compliance)
    """
    
    def __init__(self, algorithm, strategy_name: str):
        self.algo = algorithm
        self.strategy_name = strategy_name
        
        # CREATE INDIVIDUAL STATE MACHINE (CRITICAL_DO_NOT_CHANGE.md compliance)
        # Each strategy gets its own state machine for unique lifecycle management  
        self.state_machine = StrategyStateMachine(algorithm, strategy_name)
        
        # Register with UnifiedStateManager for system coordination
        if hasattr(algorithm, 'state_manager'):
            algorithm.state_manager.register_strategy(strategy_name, self.state_machine)
        else:
            self.algo.Error(f"[{strategy_name}] WARNING: UnifiedStateManager not available")
        
        # Setup basic state transitions (required for all strategies)
        self._setup_basic_transitions()
        
        # Setup state callbacks
        self._setup_state_callbacks()
        
        # Strategy-specific configuration (override in subclasses)
        self.entry_time = None
        self.exit_time = None
        self.target_profit = TradingConstants.FRIDAY_0DTE_PROFIT_TARGET  # Tom King standard 50%
        self.stop_loss = TradingConstants.FRIDAY_0DTE_STOP_LOSS     # Tom King standard -200%
        
        # Position tracking
        self.current_position = None
        self.entry_price = 0
        self.position_pnl = 0
        
        # Performance tracking
        self.trades_completed = 0
        self.wins = 0
        self.losses = 0
        
        self.algo.Debug(f"[{strategy_name}] Initialized with state machine")
    
    def _setup_state_callbacks(self):
        """Setup callbacks for state entry/exit with individual state machine"""
        
        # Standard state machine callback registration
        self.state_machine.set_on_enter(StrategyState.READY, lambda ctx: self._on_ready(ctx))
        self.state_machine.set_on_enter(StrategyState.ANALYZING, lambda ctx: self._on_start_analysis(ctx))
        self.state_machine.set_on_enter(StrategyState.ENTERING, lambda ctx: self._on_entering_position(ctx))
        self.state_machine.set_on_enter(StrategyState.POSITION_OPEN, lambda ctx: self._on_position_opened(ctx))
        self.state_machine.set_on_enter(StrategyState.MANAGING, lambda ctx: self._on_managing_position(ctx))
        self.state_machine.set_on_enter(StrategyState.EXITING, lambda ctx: self._on_exiting_position(ctx))
        self.state_machine.set_on_enter(StrategyState.CLOSED, lambda ctx: self._on_position_closed(ctx))
        self.state_machine.set_on_enter(StrategyState.ERROR, lambda ctx: self._on_error(ctx))
    
    def _setup_basic_transitions(self):
        """Setup fundamental state transitions with individual state machine"""
        
        from core.state_machine import StateTransition
        
        # CRITICAL: INITIALIZING -> READY transition (without this, strategies never trade)
        self.state_machine.add_transition(
            StrategyState.INITIALIZING, StrategyState.READY, TransitionTrigger.MARKET_OPEN
        )
        
        # READY -> ANALYZING transition (when entry window opens)
        self.state_machine.add_transition(
            StrategyState.READY, StrategyState.ANALYZING, TransitionTrigger.TIME_WINDOW_START
        )
        
        # ANALYZING -> ENTERING transition (when conditions met)
        self.state_machine.add_transition(
            StrategyState.ANALYZING, StrategyState.ENTERING, TransitionTrigger.ENTRY_CONDITIONS_MET
        )
        
        # ENTERING -> POSITION_OPEN transition (when order filled)
        self.state_machine.add_transition(
            StrategyState.ENTERING, StrategyState.POSITION_OPEN, TransitionTrigger.ORDER_FILLED
        )
        
        # POSITION_OPEN -> MANAGING transition (automatic)
        self.state_machine.add_transition(
            StrategyState.POSITION_OPEN, StrategyState.MANAGING, TransitionTrigger.MARKET_OPEN
        )
        
        # MANAGING -> EXITING transition (when exit conditions met)
        self.state_machine.add_transition(
            StrategyState.MANAGING, StrategyState.EXITING, TransitionTrigger.TIME_WINDOW_END
        )
        
        # EXITING -> CLOSED transition (when position closed)
        self.state_machine.add_transition(
            StrategyState.EXITING, StrategyState.CLOSED, TransitionTrigger.ORDER_FILLED
        )
        
        # CLOSED -> READY transition (ready for next trade)
        self.state_machine.add_transition(
            StrategyState.CLOSED, StrategyState.READY, TransitionTrigger.MARKET_OPEN
        )
        
        self.algo.Debug(f"[{self.strategy_name}] Basic transitions setup completed")
    
    def execute(self):
        """Main execution method called by algorithm"""

        try:
            # Get current state from individual state machine
            state = self.state_machine.current_state

            # Track state execution (only in backtest mode)
            if not self.algo.LiveMode:
                self.algo.Debug(f"[{self.strategy_name}] State: {state.name if state else 'None'}")

            if state == StrategyState.INITIALIZING:
                self._check_initialization()

            elif state == StrategyState.READY:
                self._check_entry_window()

            elif state == StrategyState.ANALYZING:
                self._analyze_market()

            elif state == StrategyState.PENDING_ENTRY:
                self._prepare_entry()

            elif state == StrategyState.ENTERING:
                self._execute_entry()

            elif state == StrategyState.POSITION_OPEN:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Checking position status...")
                self._check_position_status()

            elif state == StrategyState.MANAGING:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Managing position...")
                self._manage_position()

            elif state == StrategyState.ADJUSTING:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Adjusting position...")
                self._adjust_position()

            elif state == StrategyState.PENDING_EXIT:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Preparing exit...")
                self._prepare_exit()

            elif state == StrategyState.EXITING:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Executing exit...")
                self._execute_exit()

            elif state == StrategyState.CLOSED:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Cleaning up after close...")
                self._cleanup_after_close()

            elif state == StrategyState.ERROR:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Handling error state...")
                self._handle_error_state()

            elif state == StrategyState.SUSPENDED:
                self.algo.Debug(f"[{self.strategy_name}] TRACE: Checking suspension conditions...")
                self._check_suspension_conditions()

            else:
                self.algo.Error(f"[{self.strategy_name}] UNKNOWN STATE: {state.name}")

        except Exception as e:
            self.algo.Error(f"[{self.strategy_name}] Execution error: {e}")
            self.state_machine.trigger(TransitionTrigger.SYSTEM_ERROR, {'error': str(e)})
    
    # State transition methods (override in subclasses)
    
    def _check_initialization(self):
        """Check if strategy is ready to start"""
        # Market open check
        market_open = self.algo.IsMarketOpen(self.algo.spy)
        self.algo.Debug(f"[{self.strategy_name}] INIT CHECK: Market open = {market_open}, SPY = {self.algo.spy}")
        
        if market_open:
            self.algo.Debug(f"[{self.strategy_name}] INIT TRIGGER: Market is open, triggering MARKET_OPEN")
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
        else:
            self.algo.Debug(f"[{self.strategy_name}] INIT WAIT: Market is closed, staying in INITIALIZING")
    
    def _check_entry_window(self):
        """Check if we're in the entry time window"""
        current_time = self.algo.Time.time()
        
        self.algo.Debug(f"[{self.strategy_name}] ENTRY WINDOW CHECK: Current time = {current_time}, Entry time = {self.entry_time}")
        
        if self.entry_time and current_time >= self.entry_time:
            self.algo.Debug(f"[{self.strategy_name}] ENTRY TRIGGER: Entry window open, triggering TIME_WINDOW_START")
            self.state_machine.trigger(TransitionTrigger.TIME_WINDOW_START)
        else:
            if not self.entry_time:
                self.algo.Debug(f"[{self.strategy_name}] ENTRY WAIT: No entry time configured")
            else:
                self.algo.Debug(f"[{self.strategy_name}] ENTRY WAIT: Current time {current_time} < entry time {self.entry_time}")
    
    def _analyze_market(self):
        """Analyze market conditions for entry (OVERRIDE IN SUBCLASS)"""
        # This is where strategy-specific analysis goes
        # Example structure:
        self.algo.Debug(f"[{self.strategy_name}] ANALYSIS: Checking entry conditions...")
        conditions_met = self._check_entry_conditions()
        
        self.algo.Debug(f"[{self.strategy_name}] ANALYSIS RESULT: Entry conditions met = {conditions_met}")
        
        if conditions_met:
            self.algo.Debug(f"[{self.strategy_name}] ANALYSIS TRIGGER: Entry conditions met, triggering ENTRY_CONDITIONS_MET")
            self.state_machine.trigger(
                TransitionTrigger.ENTRY_CONDITIONS_MET,
                {'analysis': self._get_analysis_data()}
            )
        else:
            # Check if window expired
            window_expired = self._is_entry_window_expired()
            self.algo.Debug(f"[{self.strategy_name}] ANALYSIS CHECK: Entry window expired = {window_expired}")
            
            if window_expired:
                self.algo.Debug(f"[{self.strategy_name}] ANALYSIS TRIGGER: Entry window expired, triggering ENTRY_CONDITIONS_FAILED")
                self.state_machine.trigger(TransitionTrigger.ENTRY_CONDITIONS_FAILED)
            else:
                self.algo.Debug(f"[{self.strategy_name}] ANALYSIS WAIT: Conditions not met, waiting...")
    
    def _prepare_entry(self):
        """Prepare to enter position"""
        # Validate everything before entry
        if self._validate_entry():
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _execute_entry(self):
        """Execute entry orders (OVERRIDE IN SUBCLASS)"""
        # Place orders
        order_placed = self._place_entry_orders()
        
        if order_placed:
            # Will transition to POSITION_OPEN when filled
            pass
        else:
            self.state_machine.trigger(TransitionTrigger.ORDER_REJECTED)
    
    def _check_position_status(self):
        """Check if position needs management"""
        if self.current_position:
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _manage_position(self):
        """Manage open position (OVERRIDE IN SUBCLASS)"""
        
        # Check profit target
        if self._check_profit_target():
            self.state_machine.trigger(TransitionTrigger.PROFIT_TARGET_HIT)
            return
        
        # Check stop loss
        if self._check_stop_loss():
            self.state_machine.trigger(TransitionTrigger.STOP_LOSS_HIT)
            return
        
        # Check defensive exit (TradingConstants.DEFENSIVE_EXIT_DTE DTE)
        if self._check_defensive_exit():
            self.state_machine.trigger(TransitionTrigger.DEFENSIVE_EXIT_DTE)
            return
        
        # Check if adjustment needed
        if self._needs_adjustment():
            self.state_machine.trigger(TransitionTrigger.ADJUSTMENT_NEEDED)
    
    def _adjust_position(self):
        """Adjust position (OVERRIDE IN SUBCLASS)"""
        adjustment_complete = self._execute_adjustment()
        
        if adjustment_complete:
            self.state_machine.trigger(TransitionTrigger.ORDER_FILLED)
    
    def _prepare_exit(self):
        """Prepare to exit position"""
        if self._validate_exit():
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _execute_exit(self):
        """Execute exit orders (OVERRIDE IN SUBCLASS)"""
        exit_complete = self._place_exit_orders()
        
        if exit_complete:
            # Will transition to CLOSED when filled
            pass
    
    def _cleanup_after_close(self):
        """Clean up after position closed"""
        self.current_position = None
        self.entry_price = 0
        
        # Reset to READY for next opportunity
        if self._can_trade_again_today():
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _handle_error_state(self):
        """Handle error state"""
        # Try to recover or shut down
        if self._can_recover():
            self.state_machine.reset()
        else:
            self.algo.Error(f"[{self.strategy_name}] Cannot recover from error state")
    
    def _check_suspension_conditions(self):
        """Check if suspension can be lifted"""
        if self._suspension_cleared():
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    # Callback methods
    
    def _on_ready(self, context):
        """Called when entering READY state"""
        self.algo.Debug(f"[{self.strategy_name}] Ready to trade")
    
    def _on_start_analysis(self, context):
        """Called when starting analysis"""
        self.algo.Debug(f"[{self.strategy_name}] Starting market analysis")
    
    def _on_entering_position(self, context):
        """Called when entering position"""
        self.algo.Debug(f"[{self.strategy_name}] Entering position")
    
    def _on_position_opened(self, context):
        """Called when position opened"""
        self.trades_completed += 1
        self.algo.Debug(f"[{self.strategy_name}] Position opened (trade #{self.trades_completed})")
    
    def _on_managing_position(self, context):
        """Called when managing position"""
        # IMPLEMENTATION NOTE: Basic implementation - customize as needed
        pass# Silent, happens frequently
    
    def _on_exiting_position(self, context):
        """Called when exiting position"""
        self.algo.Debug(f"[{self.strategy_name}] Exiting position")
    
    def _on_position_closed(self, context):
        """Called when position closed"""
        # Update win/loss stats
        if self.position_pnl > 0:
            self.wins += 1
            self.algo.Debug(f"[{self.strategy_name}] WIN - P&L: ${self.position_pnl:.2f}")
        else:
            self.losses += 1
            self.algo.Debug(f"[{self.strategy_name}] LOSS - P&L: ${self.position_pnl:.2f}")
        
        win_rate = self.wins / max(1, self.wins + self.losses)
        self.algo.Debug(f"[{self.strategy_name}] Win rate: {win_rate:.1%}")
    
    def _on_error(self, context):
        """Called when entering error state"""
        self.algo.Error(f"[{self.strategy_name}] ERROR: {context.message}")
    
    # Helper methods (implement in subclasses)
    
    @abstractmethod
    def _check_entry_conditions(self) -> bool:
        """Check if entry conditions are met - Must be implemented by subclass"""
        raise NotImplementedError(f"[{self.strategy_name}] _check_entry_conditions() must be implemented by strategy subclass")
    
    def _get_analysis_data(self) -> Dict:
        """Get analysis data for logging"""
        return {}
    
    def _is_entry_window_expired(self) -> bool:
        """Check if entry window has expired"""
        return False
    
    def _validate_entry(self) -> bool:
        """Validate entry is safe"""
        return True
    
    @abstractmethod
    def _place_entry_orders(self) -> bool:
        """Place entry orders - Must be implemented by subclass"""
        raise NotImplementedError(f"[{self.strategy_name}] _place_entry_orders() must be implemented by strategy subclass")
    
    def _check_profit_target(self) -> bool:
        """Check if profit target hit"""
        if not self.current_position:
            return False
        # Fix: profit target should be based on percentage of entry credit/debit
        if hasattr(self, 'entry_credit') and self.entry_credit > 0:
            # For credit strategies: Check if can buy back at target profit
            current_cost = self._get_position_value()
            profit_pct = (self.entry_credit - current_cost) / self.entry_credit
            return profit_pct >= self.target_profit
        elif hasattr(self, 'entry_price') and self.entry_price > 0:
            # For debit strategies: Check if position gained target %
            return self.position_pnl >= self.entry_price * self.target_profit
        return False
    
    def _check_stop_loss(self) -> bool:
        """Check if stop loss hit"""
        if not self.current_position:
            return False
        # Fix: stop loss should be based on percentage of entry credit/debit
        if hasattr(self, 'entry_credit') and self.entry_credit > 0:
            # For credit strategies: Check if loss exceeds stop loss %
            current_cost = self._get_position_value()
            loss_pct = (current_cost - self.entry_credit) / self.entry_credit
            return loss_pct >= abs(self.stop_loss)  # stop_loss is negative
        elif hasattr(self, 'entry_price') and self.entry_price > 0:
            # For debit strategies: Check if position lost stop loss %
            return self.position_pnl <= self.entry_price * self.stop_loss
        return False
    
    def _check_defensive_exit(self) -> bool:
        """Check Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit"""
        # Override in options strategies
        return False
    
    def _needs_adjustment(self) -> bool:
        """Check if position needs adjustment"""
        return False
    
    def _execute_adjustment(self) -> bool:
        """Execute position adjustment"""
        return False
    
    def _validate_exit(self) -> bool:
        """Validate exit is safe"""
        return True
    
    @abstractmethod  
    def _place_exit_orders(self) -> bool:
        """Place exit orders - Must be implemented by subclass"""
        raise NotImplementedError(f"[{self.strategy_name}] _place_exit_orders() must be implemented by strategy subclass")
    
    def _can_trade_again_today(self) -> bool:
        """Check if can trade again today"""
        return False  # Most strategies are once per day
    
    def _can_recover(self) -> bool:
        """Check if can recover from error"""
        return self.state_machine.error_count < 3
    
    def _suspension_cleared(self) -> bool:
        """Check if suspension conditions cleared"""
        return False
    
    def _get_position_value(self) -> float:
        """Get current value of position for P&L calculations"""
        if not self.current_position:
            return 0.0
        
        total_value = 0.0
        
        # Sum up all option positions
        if hasattr(self, 'current_position') and isinstance(self.current_position, dict):
            for key, symbol in self.current_position.items():
                if symbol and symbol in self.algo.Securities:
                    quantity = self.algo.Securities[symbol].Holdings.Quantity
                    price = self.algo.Securities[symbol].Price
                    # Options have 100 multiplier
                    if self.algo.Securities[symbol].Type == SecurityType.Option:
                        total_value += price * quantity * 100
                    else:
                        total_value += price * quantity
        
        return abs(total_value)  # Return absolute value for comparison
    
    def get_statistics(self) -> Dict:
        """Get strategy statistics"""
        stats = {
            'strategy': self.strategy_name,
            'trades': self.trades_completed,
            'wins': self.wins,
            'losses': self.losses,
            'win_rate': self.wins / max(1, self.wins + self.losses),
            'state_machine': self.state_machine.get_statistics()
        }
        return stats