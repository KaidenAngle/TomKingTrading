# IPMCC Execution Manager Logic
*Fixed execution system for Poor Man's Covered Call strategy*

## Overview
The IPMCC (Inverse Poor Man's Covered Call) Execution Manager handles the complex logic of creating and managing LEAP + weekly call combinations while properly managing existing positions to prevent duplicate LEAPs.

## Critical Problem Solved

### The Core Issue
The original IPMCC strategy had a critical flaw: it would create new LEAP positions even when active LEAPs already existed for the same symbol, leading to:
- **Over-leverage** - Multiple LEAPs for single symbol
- **Capital inefficiency** - Unnecessary LEAP purchases  
- **Risk concentration** - Excessive exposure to single underlying
- **Strategy breakdown** - Poor man's covered call became poor man's multiple calls

### The Fix: Dual-Path Execution Logic
```python
def execute_ipmcc_strategy(self, symbol: str, account_value: float, vix_level: float = None) -> Tuple[bool, str]:
    """
    FIXED IPMCC execution - checks for existing LEAPs first!
    
    Logic:
    1. Check if we have an active LEAP for this symbol
    2. If YES: Only add weekly call against existing LEAP
    3. If NO: Create new LEAP + weekly call position
    """
    # CRITICAL CHECK: Do we already have an active LEAP for this symbol?
    existing_leap = self.psm.has_active_leap(symbol)
    
    if existing_leap:
        # SCENARIO 1: We have an active LEAP - only add weekly call
        return self._add_weekly_call_to_existing_leap(symbol, existing_leap)
    else:
        # SCENARIO 2: No active LEAP - create complete new IPMCC position
        return self._create_new_ipmcc_position(symbol, account_value, vix_level)
```

## Execution Scenarios

### Scenario 1: Add Weekly Call to Existing LEAP
**When**: Active LEAP already exists for symbol
**Action**: Sell weekly call only
**Rationale**: Maintain proper Poor Man's Covered Call structure

```python
def _add_weekly_call_to_existing_leap(self, symbol: str, existing_leap) -> Tuple[bool, str]:
    """Add weekly call to existing LEAP position"""
    
    # Calculate weekly call strike (above current price, below LEAP strike)
    current_price = float(self.algo.Securities[symbol].Price)
    weekly_strike = self._calculate_weekly_call_strike(current_price, existing_leap.strike)
    
    # Find suitable weekly call contract
    weekly_expiry = self._get_next_weekly_expiry()
    weekly_call = self._find_best_weekly_call(symbol, weekly_strike, weekly_expiry)
    
    # Match existing LEAP quantity
    quantity = abs(existing_leap.quantity)
    
    # Sell weekly call against existing LEAP
    weekly_order = self.algo.MarketOrder(weekly_call, -quantity)
    
    # Track new weekly component
    self.psm.add_ipmcc_weekly_call(symbol, weekly_call, quantity, weekly_strike, weekly_expiry)
```

### Scenario 2: Create New IPMCC Position
**When**: No active LEAP exists for symbol
**Action**: Buy LEAP + sell weekly call
**Rationale**: Establish complete Poor Man's Covered Call position

```python
def _create_new_ipmcc_position(self, symbol: str, account_value: float, vix_level: float) -> Tuple[bool, str]:
    """Create brand new IPMCC position (LEAP + weekly call)"""
    
    # Find suitable LEAP (365 DTE, ~80 delta)
    leap_contract = self._find_suitable_leap(symbol, current_price)
    
    # Find suitable weekly call (7 DTE, above current price)
    weekly_call = self._find_suitable_weekly_call(symbol, current_price, leap_contract.strike)
    
    # Calculate position size (8% of account value)
    quantity = self._calculate_position_size(account_value, current_price, leap_contract.strike)
    
    # Execute both legs
    leap_order = self.algo.MarketOrder(leap_contract, quantity)      # Buy LEAP
    weekly_order = self.algo.MarketOrder(weekly_call, -quantity)     # Sell weekly
    
    # Create position tracking
    position_id = self.psm.create_ipmcc_position(symbol)
    self.psm.add_ipmcc_leap(position_id, leap_contract, quantity, leap_contract.strike, leap_contract.expiry)
    self.psm.add_ipmcc_weekly_call(symbol, weekly_call, quantity, weekly_call.strike, weekly_call.expiry)
```

## Strike Selection Logic

### LEAP Strike Selection (~80 Delta)
```python
def _find_suitable_leap(self, symbol: str, current_price: float) -> Tuple[Optional[object], Optional[Dict]]:
    """Find suitable LEAP contract (365+ DTE, ~80 delta)"""
    
    # Filter for LEAP calls (300+ DTE)
    leap_candidates = [c for c in option_chain 
                      if c.ID.OptionRight == OptionRight.Call and 
                      (c.ID.Date - self.algo.Time).days >= 300]
    
    # Find ~80 delta strike (roughly 15-20% OTM)
    target_leap_strike = current_price * 0.82  # Rough 80 delta approximation
    best_leap = min(leap_candidates, key=lambda c: abs(c.ID.StrikePrice - target_leap_strike))
    
    return best_leap
```

### Weekly Call Strike Selection (Safety-First)
```python
def _calculate_weekly_call_strike(self, current_price: float, leap_strike: float) -> float:
    """Calculate appropriate weekly call strike"""
    
    # Weekly call should be:
    # 1. Above current price (OTM)
    # 2. Below LEAP strike (for safety)
    # 3. Typically 2-5% OTM
    
    otm_target = current_price * 1.03  # 3% OTM
    safety_max = leap_strike * 0.95    # 5% below LEAP strike
    
    return min(otm_target, safety_max)  # Safety first
```

## Position Tracking Integration

### State Management
The execution manager integrates with the Position State Manager to track:
- **LEAP components** - Long-term protective positions
- **Weekly call components** - Short-term income generation
- **Position relationships** - Which weeklies belong to which LEAPs
- **Roll tracking** - Weekly call expirations and rolls

```python
# Position creation tracking
position_id = self.psm.create_ipmcc_position(symbol)

# LEAP component tracking  
self.psm.add_ipmcc_leap(
    position_id=position_id,
    leap_contract=str(leap_contract),
    quantity=quantity,
    strike=leap_contract.ID.StrikePrice,
    expiry=leap_contract.ID.Date
)

# Weekly call component tracking
self.psm.add_ipmcc_weekly_call(
    symbol=symbol,
    weekly_contract=str(weekly_call),
    quantity=quantity,
    strike=weekly_call.ID.StrikePrice,
    expiry=weekly_call.ID.Date
)
```

## Weekly Call Roll Management

### Automatic Rolling Logic
```python
def roll_weekly_call(self, symbol: str, component_id: str) -> Tuple[bool, str]:
    """Roll an expiring weekly call to next week"""
    
    # Close existing weekly call
    success = self.psm.close_ipmcc_weekly_call(symbol, component_id)
    if not success:
        return False, "Failed to close existing weekly call"
    
    # Add new weekly call for next week
    existing_leap = self.psm.has_active_leap(symbol)
    if existing_leap:
        return self._add_weekly_call_to_existing_leap(symbol, existing_leap)
    else:
        return False, "No active LEAP found for rolling"
```

## Position Sizing Logic

### 8% Account Allocation
```python
def _calculate_position_size(self, account_value: float, current_price: float, leap_strike: float) -> int:
    """Calculate appropriate position size for IPMCC"""
    
    # 8% of account value per IPMCC position
    max_bp_usage = account_value * 0.08
    
    # Estimate LEAP cost (intrinsic + some extrinsic)
    leap_intrinsic = max(0, current_price - leap_strike)
    estimated_leap_cost = leap_intrinsic + (current_price * 0.05)  # 5% extrinsic estimate
    
    # Calculate quantity
    quantity = max(1, int(max_bp_usage / (estimated_leap_cost * 100)))
    
    return min(quantity, 5)  # Cap at 5 contracts for safety
```

## Risk Management Features

### 1. Strike Relationship Validation
- Weekly call strike always below LEAP strike
- Prevents assignment risk above LEAP protection
- Maintains proper Poor Man's Covered Call structure

### 2. Position Size Limits
- Maximum 8% account allocation per position
- Maximum 5 contracts per symbol
- Prevents over-concentration in single underlying

### 3. Time Decay Management  
- LEAP minimum 300 DTE at entry
- Weekly calls 7 DTE maximum
- Proper time spread for income generation

### 4. Existing Position Prevention
- Always checks for existing LEAPs before creating new ones
- Prevents duplicate LEAP purchases
- Maintains capital efficiency

## Common Usage Patterns

### Integration with Main Strategy
```python
# In main.py monthly strategy execution:
# REPLACE broken line:
# success, result = self.ipmcc_strategy.execute_ipmcc_entry(symbol, account_value, current_vix)

# WITH fixed line:
success, result = self.fixed_ipmcc.execute_ipmcc_strategy(symbol, account_value, current_vix)

if success:
    self.Log(f"[IPMCC] Successfully executed: {result}")
else:
    self.Log(f"[IPMCC] Execution failed: {result}")
```

### Weekly Call Management
```python
# Check for expiring weekly calls
for symbol, components in self.psm.get_expiring_weekly_calls().items():
    for component_id in components:
        success, result = self.fixed_ipmcc.roll_weekly_call(symbol, component_id)
        if not success:
            self.Error(f"[IPMCC] Failed to roll weekly: {result}")
```

## Testing Considerations

### Unit Tests Should Verify:
1. **Existing LEAP detection** works correctly
2. **Strike selection logic** follows safety rules  
3. **Position sizing** respects account limits
4. **Dual-path execution** routes correctly

### Integration Tests Should Verify:
1. **No duplicate LEAPs** are created
2. **Weekly calls** properly track to LEAPs
3. **Roll mechanics** work seamlessly
4. **Position state persistence** survives restarts

## Performance Impact

### Optimization Features:
- **LEAP existence check** cached per update cycle
- **Option chain filtering** minimizes contract searches
- **Strike calculations** use efficient approximations
- **Position tracking** uses indexed lookups

## Critical Don'ts

### ❌ Never Do These:
1. **Skip LEAP existence check** - Creates duplicate positions
2. **Use weekly strike above LEAP strike** - Breaks Poor Man's structure
3. **Exceed position size limits** - Risk management failure
4. **Create LEAP without tracking** - State management breakdown
5. **Roll without closing existing** - Position confusion

### ✅ Always Do These:
1. **Check existing LEAPs first** before creating new positions
2. **Validate strike relationships** for proper structure
3. **Track all components** in position state manager
4. **Respect position size limits** for risk management
5. **Log all execution results** with full context

## Summary

The IPMCC Execution Manager solves the critical flaw in the original Poor Man's Covered Call implementation by implementing intelligent dual-path logic that distinguishes between adding weekly calls to existing LEAPs versus creating entirely new IPMCC positions. This prevents over-leverage, maintains capital efficiency, and ensures proper Poor Man's Covered Call structure at all times.

**The dual-path execution logic is essential and should never be simplified to single-path execution.**