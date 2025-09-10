# ObjectStore State Persistence

## Overview
The framework uses QuantConnect's ObjectStore for state persistence, not in-memory variables. This enables crash recovery and state continuity across sessions.

## Why ObjectStore Instead of Variables?

### The Problem with In-Memory State
```python
# WRONG - Memory only
class Strategy:
    def __init__(self):
        self.state = "WAITING"  # Lost on crash
        self.entry_price = None  # Gone on restart
        self.position_id = None  # No recovery possible
```

**What happens on crash:**
1. System restarts
2. All variables reset to initial values
3. No knowledge of open positions
4. No idea what state strategies were in
5. **Result: Orphaned positions, wrong decisions**

### The ObjectStore Solution
```python
# CORRECT - Persistent storage
class Strategy:
    def save_state(self):
        state_data = {
            "state": self.state,
            "entry_price": self.entry_price,
            "position_id": self.position_id,
            "timestamp": self.Time
        }
        self.ObjectStore.Save(f"{self.name}_state", state_data)
    
    def load_state(self):
        if self.ObjectStore.ContainsKey(f"{self.name}_state"):
            return self.ObjectStore.Read(f"{self.name}_state")
```

**What happens on crash:**
1. System restarts
2. Loads state from ObjectStore
3. Knows exactly where it was
4. Can manage existing positions correctly
5. **Result: Seamless recovery**

## What Gets Persisted and Why

### 1. State Machine States
```python
# MUST persist - determines strategy behavior
state_data = {
    "current_state": "ACTIVE",
    "previous_state": "ENTERING",
    "state_transition_time": "2024-01-15T10:30:00",
    "state_history": ["WAITING", "ENTERING", "ACTIVE"]
}
```

**Why Critical:**
- Determines what actions are allowed
- Prevents duplicate entries
- Enables proper exit logic

### 2. Position Metadata
```python
# MUST persist - position management info
position_data = {
    "entry_time": "2024-01-15T10:00:00",
    "entry_price": 450.50,
    "contracts": 3,
    "strategy": "LT112",
    "expiration": "2024-05-01",
    "strikes": {"short": 445, "long": 440},
    "entry_vix": 18.5,
    "target_profit": 500,
    "max_loss": -1000
}
```

**Why Critical:**
- Need entry price for P&L calculations
- Need expiration for DTE calculations
- Need strikes for position management
- Need targets for exit decisions

### 3. Risk Tracking
```python
# MUST persist - risk management data
risk_data = {
    "max_portfolio_value": 100000,
    "current_drawdown": -0.05,
    "consecutive_losses": 2,
    "daily_loss": -500,
    "correlation_score": 0.65
}
```

**Why Critical:**
- Circuit breakers need historical data
- Drawdown calculations need peak value
- Loss streaks affect position sizing

### 4. Order Groups (Atomic Execution)
```python
# MUST persist - multi-leg order tracking
order_group = {
    "group_id": "abc-123-def",
    "strategy": "0DTE",
    "legs": [
        {"symbol": "SPY_CALL_450", "quantity": -10, "status": "FILLED"},
        {"symbol": "SPY_CALL_455", "quantity": 10, "status": "PENDING"}
    ],
    "status": "INCOMPLETE",
    "timestamp": "2024-01-15T10:30:00"
}
```

**Why Critical:**
- Detect partial fills after crash
- Enable rollback of incomplete orders
- Prevent naked positions

## When State Gets Saved

### 1. On State Transitions
```python
def transition_to(self, new_state: str):
    """State changes MUST be persisted immediately"""
    
    old_state = self.current_state
    self.current_state = new_state
    
    # Save IMMEDIATELY - don't wait
    self.save_state()
    
    self.Debug(f"State transition: {old_state} → {new_state}")
```

### 2. On Position Changes
```python
def on_order_filled(self, order_event):
    """Position changes trigger save"""
    
    if order_event.Status == OrderStatus.Filled:
        self.update_position_tracking(order_event)
        
        # Save immediately - position state critical
        self.save_state()
```

### 3. Scheduled Persistence (Backup)
```python
# Every 5 minutes as backup
self.Schedule.On(
    self.DateRules.EveryDay(),
    self.TimeRules.Every(timedelta(minutes=5)),
    self.save_all_states
)

# End of day mandatory
self.Schedule.On(
    self.DateRules.EveryDay(),
    self.TimeRules.At(15, 45),
    self.persist_final_state
)
```

## ObjectStore vs Database vs Files

### Why ObjectStore?
```python
# ObjectStore advantages:
- Built into QuantConnect
- Survives algorithm restarts
- Accessible across sessions
- No external dependencies
- Fast key-value access
- Automatic serialization
```

### Why Not Database?
```python
# Database disadvantages:
- External dependency
- Connection management
- Latency concerns
- Complexity overhead
- Not needed for state data
```

### Why Not Local Files?
```python
# File system disadvantages:
- Not available in QC cloud
- File I/O slower
- Path management issues
- No built-in serialization
- Cleanup complexity
```

## Recovery Procedures

### On Algorithm Start
```python
def Initialize(self):
    """First thing: check for saved state"""
    
    # Load any saved states
    self.state_manager.load_all_states()
    
    # Check for incomplete orders
    incomplete = self.check_incomplete_orders()
    if incomplete:
        self.handle_incomplete_orders(incomplete)
    
    # Verify position consistency
    self.reconcile_positions_with_state()
```

### Incomplete Order Recovery
```python
def check_and_recover_incomplete_orders(self):
    """Detect and handle partial fills from crash"""
    
    for group_id in self.get_saved_order_groups():
        group = self.ObjectStore.Read(group_id)
        
        if group['status'] == 'INCOMPLETE':
            filled = [leg for leg in group['legs'] if leg['status'] == 'FILLED']
            pending = [leg for leg in group['legs'] if leg['status'] == 'PENDING']
            
            if filled and pending:
                # DANGEROUS - partial fill detected
                self.Error(f"PARTIAL FILL DETECTED: {group_id}")
                
                # Immediate action required
                if self.can_complete_order_group(pending):
                    self.complete_order_group(pending)
                else:
                    self.rollback_order_group(filled)
```

### State Consistency Verification
```python
def reconcile_positions_with_state(self):
    """Ensure saved state matches actual positions"""
    
    saved_positions = self.load_saved_positions()
    actual_positions = self.get_actual_positions()
    
    for saved in saved_positions:
        if saved not in actual_positions:
            self.Error(f"ORPHANED STATE: {saved}")
            # State shows position that doesn't exist
            self.clean_orphaned_state(saved)
    
    for actual in actual_positions:
        if actual not in saved_positions:
            self.Error(f"UNTRACKED POSITION: {actual}")
            # Position exists without state
            self.create_recovery_state(actual)
```

## What NOT to Persist

### Don't Persist Calculated Values
```python
# WRONG - Persisting calculations
state = {
    "current_price": 450.50,  # Will be stale
    "current_vix": 18.5,      # Will be stale
    "portfolio_value": 100000, # Will be stale
    "buying_power": 50000     # Will be stale
}

# CORRECT - Persist only facts
state = {
    "entry_price": 450.50,     # Historical fact
    "entry_vix": 18.5,         # Historical fact
    "position_size": 3,        # Actual position
    "strategy_name": "LT112"   # Configuration
}
```

### Don't Persist Temporary Data
```python
# WRONG - Temporary calculations
state = {
    "last_tick_price": 450.50,
    "ticks_processed": 12345,
    "debug_counter": 67
}

# CORRECT - Only persist what matters for recovery
state = {
    "position_id": "LT112_2024_01_15",
    "state": "ACTIVE",
    "entry_data": {...}
}
```

## Testing State Persistence

### Test Crash Recovery
```python
def test_crash_recovery():
    """Simulate crash and recovery"""
    
    # Create position and save state
    create_position()
    save_state({"state": "ACTIVE", "position": "SPY_PUT_440"})
    
    # Simulate crash
    restart_algorithm()
    
    # Verify recovery
    loaded_state = load_state()
    assert loaded_state["state"] == "ACTIVE"
    assert loaded_state["position"] == "SPY_PUT_440"
```

### Test Partial Fill Recovery
```python
def test_partial_fill_recovery():
    """Test incomplete order detection"""
    
    # Save incomplete order group
    save_order_group({
        "group_id": "test-123",
        "legs": [
            {"status": "FILLED"},
            {"status": "PENDING"}
        ],
        "status": "INCOMPLETE"
    })
    
    # Restart and check detection
    restart_algorithm()
    incomplete = check_incomplete_orders()
    
    assert len(incomplete) == 1
    assert incomplete[0]["group_id"] == "test-123"
```

## Summary

ObjectStore persistence is **critical infrastructure** for:

1. **Crash Recovery** - Resume exactly where left off
2. **Partial Fill Detection** - Find dangerous positions
3. **State Continuity** - Maintain strategy state across sessions
4. **Risk Tracking** - Remember drawdowns and losses
5. **Audit Trail** - Complete history of decisions

Without ObjectStore:
- Crashes create orphaned positions
- Partial fills go undetected
- Strategies restart from scratch
- Risk limits reset
- No recovery possible

**The market doesn't pause for your restart. ObjectStore ensures you don't lose track of anything.**