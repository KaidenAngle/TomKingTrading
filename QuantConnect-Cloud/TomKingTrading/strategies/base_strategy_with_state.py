# Base Strategy with State Machine Integration
# Template for converting strategies to use state machine pattern

from AlgorithmImports import *
from core.state_machine import StrategyStateMachine, StrategyState, TransitionTrigger
from typing import Dict, Optional, Any
from datetime import time, timedelta

class BaseStrategyWithState:
    """
    Base class for strategies using state machine pattern
    Provides clean lifecycle management and error handling
    """
    
    def __init__(self, algorithm, strategy_name: str):
        self.algo = algorithm
        self.strategy_name = strategy_name
        
        # Initialize state machine
        self.state_machine = StrategyStateMachine(algorithm, strategy_name)
        
        # Setup state callbacks
        self._setup_state_callbacks()
        
        # Strategy-specific configuration (override in subclasses)
        self.entry_time = None
        self.exit_time = None
        self.target_profit = 0.50  # Tom King standard
        self.stop_loss = -2.00     # Tom King standard
        
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
        """Setup callbacks for state entry/exit"""
        
        # Ready state
        self.state_machine.set_on_enter(
            StrategyState.READY,
            lambda ctx: self._on_ready(ctx)
        )
        
        # Analyzing state
        self.state_machine.set_on_enter(
            StrategyState.ANALYZING,
            lambda ctx: self._on_start_analysis(ctx)
        )
        
        # Entering position
        self.state_machine.set_on_enter(
            StrategyState.ENTERING,
            lambda ctx: self._on_entering_position(ctx)
        )
        
        # Position opened
        self.state_machine.set_on_enter(
            StrategyState.POSITION_OPEN,
            lambda ctx: self._on_position_opened(ctx)
        )
        
        # Managing position
        self.state_machine.set_on_enter(
            StrategyState.MANAGING,
            lambda ctx: self._on_managing_position(ctx)
        )
        
        # Exiting position
        self.state_machine.set_on_enter(
            StrategyState.EXITING,
            lambda ctx: self._on_exiting_position(ctx)
        )
        
        # Position closed
        self.state_machine.set_on_enter(
            StrategyState.CLOSED,
            lambda ctx: self._on_position_closed(ctx)
        )
        
        # Error state
        self.state_machine.set_on_enter(
            StrategyState.ERROR,
            lambda ctx: self._on_error(ctx)
        )
    
    def execute(self):
        """Main execution method called by algorithm"""
        
        try:
            # Check current state and execute appropriate logic
            state = self.state_machine.current_state
            
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
                self._check_position_status()
            
            elif state == StrategyState.MANAGING:
                self._manage_position()
            
            elif state == StrategyState.ADJUSTING:
                self._adjust_position()
            
            elif state == StrategyState.PENDING_EXIT:
                self._prepare_exit()
            
            elif state == StrategyState.EXITING:
                self._execute_exit()
            
            elif state == StrategyState.CLOSED:
                self._cleanup_after_close()
            
            elif state == StrategyState.ERROR:
                self._handle_error_state()
            
            elif state == StrategyState.SUSPENDED:
                self._check_suspension_conditions()
        
        except Exception as e:
            self.algo.Error(f"[{self.strategy_name}] Execution error: {e}")
            self.state_machine.trigger(TransitionTrigger.SYSTEM_ERROR, {'error': str(e)})
    
    # State transition methods (override in subclasses)
    
    def _check_initialization(self):
        """Check if strategy is ready to start"""
        # Market open check
        if self.algo.IsMarketOpen(self.algo.spy):
            self.state_machine.trigger(TransitionTrigger.MARKET_OPEN)
    
    def _check_entry_window(self):
        """Check if we're in the entry time window"""
        current_time = self.algo.Time.time()
        
        if self.entry_time and current_time >= self.entry_time:
            self.state_machine.trigger(TransitionTrigger.TIME_WINDOW_START)
    
    def _analyze_market(self):
        """Analyze market conditions for entry (OVERRIDE IN SUBCLASS)"""
        # This is where strategy-specific analysis goes
        # Example structure:
        conditions_met = self._check_entry_conditions()
        
        if conditions_met:
            self.state_machine.trigger(
                TransitionTrigger.ENTRY_CONDITIONS_MET,
                {'analysis': self._get_analysis_data()}
            )
        else:
            # Check if window expired
            if self._is_entry_window_expired():
                self.state_machine.trigger(TransitionTrigger.ENTRY_CONDITIONS_FAILED)
    
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
        
        # Check defensive exit (21 DTE)
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
        pass  # Silent, happens frequently
    
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
    
    def _check_entry_conditions(self) -> bool:
        """Check if entry conditions are met - Base implementation"""
        # Base implementation - always return True so strategies can enter if they want
        # Subclasses should override this with actual entry logic
        self.algo.Debug(f"[{self.strategy_name}] Using base _check_entry_conditions - consider overriding in subclass")
        return True
    
    def _get_analysis_data(self) -> Dict:
        """Get analysis data for logging"""
        return {}
    
    def _is_entry_window_expired(self) -> bool:
        """Check if entry window has expired"""
        return False
    
    def _validate_entry(self) -> bool:
        """Validate entry is safe"""
        return True
    
    def _place_entry_orders(self) -> bool:
        """Place entry orders - Base implementation"""
        # Base implementation - log that no orders were placed
        self.algo.Debug(f"[{self.strategy_name}] No entry orders placed - override _place_entry_orders in subclass")
        return False
    
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
        """Check Tom King's 21 DTE defensive exit"""
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
    
    def _place_exit_orders(self) -> bool:
        """Place exit orders - Base implementation"""
        # Base implementation - log that no orders were placed
        self.algo.Debug(f"[{self.strategy_name}] No exit orders placed - override _place_exit_orders in subclass")
        return False
    
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
    
    # === PUBLIC INTERFACE METHODS ===
    # These methods provide the interface expected by main algorithm
    # while properly integrating with the state machine
    
    def can_enter(self) -> bool:
        """Check if strategy can enter a new position"""
        # Check if in appropriate state to enter
        if not self.state_machine.is_in_any_state([
            StrategyState.READY,
            StrategyState.ANALYZING
        ]):
            return False
            
        # Check if already have position
        if self.current_position:
            return False
            
        # Check market hours
        if not self.algo.IsMarketOpen(self.algo.spy):
            return False
            
        # Check strategy-specific entry conditions
        return self._check_entry_conditions()
    
    def enter_position(self) -> bool:
        """
        Public interface to enter position
        Integrates with state machine by triggering appropriate transitions
        """
        if not self.can_enter():
            return False
        
        # If we're in READY state, move to analysis
        if self.state_machine.is_in_state(StrategyState.READY):
            if self.state_machine.trigger(TransitionTrigger.TIME_WINDOW_START):
                # Continue with execution cycle
                self.execute()
        
        # If already analyzing, check conditions
        elif self.state_machine.is_in_state(StrategyState.ANALYZING):
            self.execute()
        
        return True
    
    def check_defensive_exits(self):
        """Check if defensive exits are needed (public interface)"""
        if self.state_machine.is_in_state(StrategyState.MANAGING):
            # This will trigger the defensive exit check in _manage_position
            if self._check_defensive_exit():
                self.state_machine.trigger(TransitionTrigger.DEFENSIVE_EXIT_DTE)
    
    def manage_positions(self):
        """Manage positions (public interface)"""
        if self.state_machine.is_in_any_state([
            StrategyState.POSITION_OPEN,
            StrategyState.MANAGING,
            StrategyState.ADJUSTING
        ]):
            self.execute()  # This will call the appropriate state-specific methods
    
    def exit_position(self, reason: str = "Manual exit") -> bool:
        """
        Public interface to exit position
        Forces exit regardless of current state
        """
        if not self.current_position:
            return False
        
        # Force transition to exiting state
        if self.state_machine.is_in_any_state([
            StrategyState.POSITION_OPEN,
            StrategyState.MANAGING,
            StrategyState.ADJUSTING
        ]):
            self.state_machine.trigger(
                TransitionTrigger.EMERGENCY_EXIT, 
                {'reason': reason}
            )
            return True
        
        return False
    
    def get_position_status(self) -> Dict:
        """Get current position status"""
        return {
            'has_position': bool(self.current_position),
            'state': self.state_machine.current_state.name,
            'pnl': self.position_pnl,
            'trades_completed': self.trades_completed,
            'win_rate': self.wins / max(1, self.wins + self.losses)
        }
    
    def force_state_transition(self, trigger: TransitionTrigger, data: Dict = None) -> bool:
        """
        Public interface to force state transitions
        Use with caution - mainly for emergency situations
        """
        return self.state_machine.trigger(trigger, data)
    
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