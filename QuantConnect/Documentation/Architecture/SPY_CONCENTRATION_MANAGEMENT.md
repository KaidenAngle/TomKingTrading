# SPY Concentration Management

## Overview
Multiple strategies trade SPY/ES derivatives. Without coordination, the portfolio could become dangerously concentrated in S&P 500 exposure.

## Why This Looks Like Over-Engineering (But Isn't)

### What You Might Think:
"Each strategy already has position sizing, why need another layer?"

### The Reality:
- **Friday 0DTE**: Trades SPY options
- **LT112**: Trades SPY put spreads  
- **LEAP Ladders**: Builds SPY put positions
- **IPMCC**: May sell calls on SPY shares

Without coordination, you could have:
- 0DTE: -500 delta
- LT112: -300 delta
- LEAP: -400 delta
- **Total**: -1200 delta (way over-exposed!)

## Architecture

### SPYConcentrationManager
```python
class SPYConcentrationManager:
    def request_spy_allocation(self, 
                              strategy_name: str,
                              position_type: str,
                              requested_delta: float,
                              requested_contracts: int) -> Tuple[bool, str]:
        """
        Centralized approval for SPY/ES exposure
        Tracks total portfolio delta across all strategies
        """
```

## How It Works

### 1. Strategy Requests Allocation
```python
# In each strategy before placing orders:
approved, reason = self.algo.spy_concentration_manager.request_spy_allocation(
    strategy_name="LT112",
    position_type="put_spread",
    requested_delta=-300,  # Estimated
    requested_contracts=3
)
```

### 2. Manager Checks Total Exposure
```python
# Inside SPYConcentrationManager:
current_total_delta = sum(all_spy_positions)
if current_total_delta + requested_delta > MAX_DELTA:
    return False, "Would exceed maximum SPY exposure"
```

### 3. Tracking Across Strategies
```
Current SPY Exposure:
├─ 0DTE: -200 delta (2 iron condors)
├─ LT112: -150 delta (1 put spread)
├─ LEAP: -100 delta (protective puts)
└─ Total: -450 delta

New Request: LT112 wants -300 delta
Decision: APPROVED (total would be -750, under -1000 limit)
```

## Maximum Exposure Limits

### Portfolio-Based Limits
- **Conservative** (<$100k): Max -500 delta
- **Moderate** ($100k-$500k): Max -1000 delta
- **Aggressive** (>$500k): Max -2000 delta

### Why These Limits?
- SPY delta of -1000 ≈ being short 10 SPY shares
- At SPY $450, that's $4,500 per 1% move
- Prevents catastrophic loss from SPY rally

## Common Patterns

### Pattern 1: Friday Morning Coordination
```
9:30 AM: LEAP Ladders checks for adjustments
- Requests -200 delta for new protective put
- APPROVED

10:30 AM: 0DTE wants to enter iron condor
- Requests -400 delta
- Manager sees -200 already used
- Checks if -600 total is acceptable
- APPROVED or DENIED based on limits
```

### Pattern 2: Risk Event Reduction
```
FOMC Day Detected:
- SPYConcentrationManager reduces limits by 50%
- Normal limit: -1000 delta
- FOMC limit: -500 delta
- Strategies automatically prevented from over-exposing
```

## Integration Points

### Where It's Checked:
1. **Before Order Placement**: Every SPY-related order
2. **Position Adjustments**: When rolling or adjusting
3. **Emergency Exits**: Bypasses checks for risk reduction

### Strategies That Must Check:
- ✅ Friday 0DTE (always trades SPY)
- ✅ LT112 (always trades SPY)
- ✅ LEAP Ladders (always trades SPY)
- ✅ IPMCC (when symbol is SPY)
- ❌ Futures Strangle (trades /ES, tracked separately)

## Why Not Simplify?

### Bad Idea 1: "Just limit each strategy individually"
**Problem**: Strategies don't know about each other. Could all max out simultaneously.

### Bad Idea 2: "Use fixed position sizes"
**Problem**: Ignores market conditions and cumulative exposure.

### Bad Idea 3: "Only one strategy trades SPY at a time"
**Problem**: Destroys the diversification benefit of multiple strategies.

## Error Messages and Debugging

### Common Denial Reasons:
```
"Would exceed maximum SPY exposure"
"SPY exposure at 90% of limit"  
"Market event - reduced limits in effect"
"Delta calculation unavailable"
```

### Debug Information:
```python
self.algo.Debug(f"[SPY Manager] Current: {current_delta}, "
                f"Requested: {requested_delta}, "
                f"Would be: {current_delta + requested_delta}, "
                f"Limit: {max_delta}")
```

## Testing Scenarios

### Scenario 1: All Strategies Want In
- 0DTE requests -400 delta → Approved
- LT112 requests -300 delta → Approved  
- LEAP requests -400 delta → DENIED (would exceed -1000)

### Scenario 2: Emergency Unwind
- Total exposure: -900 delta
- Market rallying strongly
- Emergency exit triggered
- Manager allows closing trades regardless of limits

## Configuration

### Settings in constants.py:
```python
MAX_SPY_DELTA_CONSERVATIVE = -500
MAX_SPY_DELTA_MODERATE = -1000
MAX_SPY_DELTA_AGGRESSIVE = -2000
SPY_CONCENTRATION_WARNING = 0.75  # Warn at 75% of limit
```

## Summary

SPY Concentration Management is **critical risk infrastructure**, not over-engineering. Without it, multiple strategies could accidentally create massive directional exposure. 

The system:
1. Tracks total SPY/ES exposure across all strategies
2. Prevents any single strategy from over-allocating
3. Coordinates between strategies that don't know about each other
4. Adjusts limits based on market conditions

**This is sophisticated portfolio risk management, not redundancy.**