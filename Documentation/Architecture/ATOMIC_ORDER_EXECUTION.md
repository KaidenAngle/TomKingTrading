# Atomic Order Execution

## Overview
Multi-leg option strategies require ALL legs to be filled or NONE. Partial fills create dangerous naked positions.

## The Problem It Solves

### Without Atomic Execution:
```python
# DANGEROUS - Could create naked positions
self.algo.MarketOrder(short_call, -10)  # FILLS
self.algo.MarketOrder(long_call, 10)    # REJECTED - no buying power
# Result: NAKED SHORT CALLS (unlimited risk!)
```

### With Atomic Execution:
```python
# SAFE - All or nothing
success = self.algo.atomic_executor.execute_iron_condor_atomic(
    short_call, long_call, short_put, long_put, quantity
)
# Result: Either complete iron condor or no position
```

## Multi-Leg Strategies That Require Atomic Execution

### 1. Iron Condor (4 legs)
```
Required Fills:
├─ Short Call (sell)
├─ Long Call (buy)  
├─ Short Put (sell)
└─ Long Put (buy)

Partial Fill Dangers:
- Only shorts filled = Naked straddle (unlimited risk)
- Only longs filled = Paid premium with no income
- Mixed fills = Unknown risk profile
```

### 2. Put Spread (2 legs)
```
Required Fills:
├─ Short Put (sell) - Higher strike
└─ Long Put (buy) - Lower strike

Partial Fill Dangers:
- Only short filled = Naked put (high risk)
- Only long filled = Paid premium with no income
```

### 3. Strangle (2 legs)
```
Required Fills:
├─ Short Call (sell)
└─ Short Put (sell)

Partial Fill Dangers:
- Only one side = Directional risk
- Imbalanced position
```

## Architecture

### AtomicOrderExecutor Components

```python
class EnhancedAtomicOrderExecutor:
    def __init__(self):
        self.orders = []           # Track all orders
        self.filled_legs = []      # Successfully filled
        self.pending_legs = []     # Awaiting fill
        self.failed_legs = []      # Failed orders
        
    def execute_atomic(self, legs: List[Tuple]):
        """All-or-nothing execution with rollback"""
```

### Execution Flow

```
1. START TRANSACTION
   ├─ Generate unique group_id
   ├─ Persist order group to ObjectStore
   └─ Set status: PENDING

2. PLACE ORDERS
   ├─ Place each leg with group_id tag
   ├─ Monitor fills (with timeout)
   └─ Track fill status

3. VERIFY COMPLETION
   ├─ All filled? → SUCCESS
   ├─ Any failed? → ROLLBACK
   └─ Timeout? → ROLLBACK

4. ROLLBACK (if needed)
   ├─ Cancel pending orders
   ├─ Reverse filled orders
   └─ Clean up state
```

## Implementation Details

### Order Group Tracking
```python
def execute_iron_condor_atomic(self, short_call, long_call, 
                              short_put, long_put, quantity):
    group_id = str(uuid.uuid4())
    
    # Persist for crash recovery
    self.persist_order_group(group_id, [
        (short_call, -quantity),
        (long_call, quantity),
        (short_put, -quantity),
        (long_put, quantity)
    ])
    
    # Place all orders
    for symbol, qty in legs:
        order = self.place_order_with_tag(symbol, qty, group_id)
        self.track_order(order)
    
    # Monitor and verify
    if not self.wait_for_fills(timeout=5):
        self.rollback_group(group_id)
        return False
        
    return True
```

### Rollback Mechanism
```python
def rollback_group(self, group_id):
    """Reverse any partial fills"""
    
    # Cancel pending
    for order in self.pending_legs:
        self.algo.Transactions.CancelOrder(order.Id)
    
    # Reverse filled
    for symbol, quantity, order in self.filled_legs:
        # Place opposite order to flatten
        self.algo.MarketOrder(symbol, -quantity)
    
    # Mark group as rolled back
    self.update_group_status(group_id, "ROLLED_BACK")
```

## Crash Recovery

### Problem: What if system crashes mid-execution?

### Solution: Order State Persistence
```python
# On startup:
def check_and_recover_incomplete_orders(self):
    incomplete = self.get_incomplete_order_groups()
    
    for group in incomplete:
        if self.is_partially_filled(group):
            # Dangerous partial fill - immediate action
            self.emergency_flatten(group)
            self.alert_operator(f"Partial fill recovered: {group}")
```

### ObjectStore Schema
```json
{
    "group_id": "abc-123",
    "strategy": "Friday_0DTE",
    "timestamp": "2024-01-15T10:30:00",
    "status": "PENDING",
    "legs": [
        {"symbol": "SPY_CALL_450", "quantity": -10, "status": "FILLED"},
        {"symbol": "SPY_CALL_455", "quantity": 10, "status": "PENDING"}
    ]
}
```

## Why This Looks Complex (But Is Necessary)

### Complexity You See:
- Order tracking
- State persistence  
- Rollback logic
- Timeout monitoring

### Risk It Prevents:
- **Naked Options**: Unlimited loss potential
- **Margin Calls**: From unexpected positions
- **Strategy Corruption**: Half-executed trades
- **Capital Loss**: From unhedged positions

## Common Failure Scenarios

### Scenario 1: Rapid Market Move
```
10:30:00 - Place iron condor orders
10:30:01 - Short call fills at good price
10:30:02 - Market spikes up
10:30:03 - Long call rejected (price moved)
ROLLBACK - Buy back short call immediately
```

### Scenario 2: Insufficient Buying Power
```
Place 4-leg iron condor
Legs 1-3 fill, depleting buying power
Leg 4 rejected
ROLLBACK - Reverse legs 1-3
```

### Scenario 3: System Crash
```
10:30:00 - Orders placed, system crashes
10:31:00 - System restarts
10:31:01 - Recovery checks ObjectStore
10:31:02 - Finds partial fill
10:31:03 - Completes or reverses position
```

## Configuration

### Timeout Settings
```python
ATOMIC_ORDER_TIMEOUT = 5  # seconds
MAX_ROLLBACK_ATTEMPTS = 3
FILL_CHECK_INTERVAL = 0.5  # seconds
```

### Risk Limits
```python
MAX_ATOMIC_GROUP_SIZE = 6  # legs
MAX_PENDING_GROUPS = 2
EMERGENCY_FLATTEN_MODE = True  # In crashes
```

## DO NOT SIMPLIFY

### Never Do This:
```python
# DANGEROUS - No atomicity
for leg in iron_condor_legs:
    self.algo.MarketOrder(leg.symbol, leg.quantity)
```

### Always Do This:
```python
# SAFE - Atomic execution
self.algo.atomic_executor.execute_iron_condor_atomic(...)
```

## Testing Requirements

### Unit Tests:
- All legs fill → Success
- One leg fails → Rollback
- Timeout → Rollback
- Crash recovery → Proper state restoration

### Integration Tests:
- Multiple strategies using atomic executor simultaneously
- Rollback doesn't affect other positions
- State persistence through restart

## Summary

Atomic Order Execution is **critical safety infrastructure** for multi-leg options trading. It ensures:

1. **All-or-nothing fills** - No partial positions
2. **Automatic rollback** - Reverses dangerous partials
3. **Crash recovery** - Handles system failures
4. **State tracking** - Full audit trail

The complexity is justified by the catastrophic risks it prevents. A single naked option position from a partial fill could destroy an account.

**This is essential risk management, not over-engineering.**