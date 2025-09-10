# CRITICAL: Things That Must NEVER Be Changed

## Overview
This document lists critical components that might look like they need "optimization" or "simplification" but are intentionally designed this way. Changing these will break the system or create dangerous trading conditions.

## 1. QuantConnect API Usage - NO FALLBACKS

### NEVER Add Fallbacks For:
```python
# WRONG - DO NOT ADD FALLBACKS
if hasattr(self.algo, 'TradingCalendar'):
    fomc_days = self.algo.TradingCalendar.GetDaysByType(TradingDayType.FOMC)
else:
    # Some fallback logic
    
# CORRECT - DIRECT API USAGE
fomc_days = self.algo.TradingCalendar.GetDaysByType(TradingDayType.FOMC)
```

**Why:** QuantConnect APIs are ALWAYS available in the QC environment. If they're not available, the system shouldn't be trading.

### APIs That Are Always Available:
- `self.Debug()`, `self.Log()`, `self.Error()` - Logging
- `self.TradingCalendar` - Economic events (FOMC, earnings)
- `self.Portfolio` - Position tracking
- `self.Securities` - Security data
- `self.Transactions` - Order management

## 2. VIX Requirements - DIFFERENT BY DESIGN

### NEVER Consolidate VIX Thresholds:
```python
# WRONG - DO NOT CONSOLIDATE
UNIVERSAL_VIX_THRESHOLD = 20  # NO!

# CORRECT - STRATEGY-SPECIFIC
0DTE_MIN_VIX = 22        # High volatility for same-day
LT112_MIN_VIX = 12       # Lower for 112-day trades
LT112_MAX_VIX = 35       # Cap for long timeframe
```

**Why:** Each strategy operates in different timeframes with different risk/reward profiles.

## 3. Position Sizing - 0.25 Kelly Factor

### NEVER Change:
```python
KELLY_FACTOR = 0.25  # Tom King's parameter - DO NOT CHANGE
```

**Why:** This specific factor is the result of extensive backtesting and real trading. Full Kelly (1.0) has 50% chance of 50% drawdown.

## 4. 21 DTE Defensive Exit

### NEVER Modify or Disable:
```python
DEFENSIVE_EXIT_DTE = 21  # CRITICAL - DO NOT CHANGE
```

**Why:** Gamma risk explodes after 21 DTE. This rule has saved countless accounts from catastrophic losses.

## 5. State Machine Separation

### NEVER Combine State Machines:
```python
# WRONG - DO NOT CREATE UNIVERSAL STATE MACHINE
class UniversalStateMachine:
    # Trying to handle all strategies
    
# CORRECT - SEPARATE STATE MACHINES
class Friday0DTEStateMachine:
    # 0DTE specific states
    
class LT112StateMachine:
    # LT112 specific states
```

**Why:** Each strategy has unique lifecycle, recovery needs, and state transitions.

## 6. Atomic Order Execution

### NEVER Simplify to Sequential Orders:
```python
# WRONG - DANGEROUS
for leg in iron_condor_legs:
    self.MarketOrder(leg)  # Could create naked positions!
    
# CORRECT - ATOMIC
self.atomic_executor.execute_iron_condor_atomic(...)
```

**Why:** Partial fills in multi-leg strategies create naked positions with unlimited risk.

## 7. SPY Concentration Checks

### NEVER Remove or Bypass:
```python
# ALWAYS CHECK BEFORE SPY TRADES
approved, reason = self.spy_concentration_manager.request_spy_allocation(...)
if not approved:
    return  # DO NOT TRADE
```

**Why:** Multiple strategies trade SPY. Without coordination, portfolio could become dangerously concentrated.

## 8. Greeks Limits by Phase

### NEVER Use Fixed Greeks Limits:
```python
# WRONG - FIXED LIMITS
MAX_DELTA = -1000  # Same for all phases

# CORRECT - PHASE-BASED
PHASE_GREEKS_LIMITS = {
    1: {"delta": -300, "gamma": -10},   # Conservative start
    2: {"delta": -500, "gamma": -20},   # Gradual increase
    3: {"delta": -750, "gamma": -30},   # More aggressive
    4: {"delta": -1000, "gamma": -40}   # Full allocation
}
```

**Why:** Portfolio grows through phases. Starting with full size is dangerous.

## 9. Error Handling - Fail Fast

### NEVER Add Silent Fallbacks:
```python
# WRONG - SILENT FALLBACK
try:
    vix = self.get_vix()
except:
    vix = 20  # Assume normal VIX - DANGEROUS!
    
# CORRECT - FAIL FAST
vix = self.get_vix()
if not vix:
    raise ValueError("VIX data required for trading")
```

**Why:** Trading with missing or incorrect data is worse than not trading.

## 10. Order Pricing

### NEVER Use Market Orders for Options:
```python
# WRONG - MARKET ORDERS
self.MarketOrder(option_symbol, quantity)  # Terrible fills!

# CORRECT - LIMIT ORDERS
mid_price = (bid + ask) / 2
limit_price = mid_price + (0.05 if buying else -0.05)
self.LimitOrder(option_symbol, quantity, limit_price)
```

**Why:** Options have wide bid-ask spreads. Market orders get terrible fills.

## 11. Timing Windows

### NEVER Change Entry/Exit Times:
```python
# CRITICAL TIMING - DO NOT CHANGE
0DTE_ENTRY_START = "09:45"  # Not 09:30 - wait for opening chaos
0DTE_ENTRY_END = "10:30"    # Last entry window
0DTE_EXIT_TIME = "15:30"    # 3:30 PM MANDATORY - not 3:59
STATE_PERSIST = "15:45"     # Before close, after positions settled
```

**Why:** Based on market microstructure, liquidity patterns, and gamma acceleration.

## 12. Circuit Breaker Thresholds

### NEVER Modify These Numbers:
```python
# BASED ON HISTORICAL DISASTERS - DO NOT CHANGE
RAPID_DRAWDOWN = -0.03      # 3% in 5 minutes (catches flash crashes)
CORRELATION_SPIKE = 0.90    # 90% correlation (August 5 threshold)
MARGIN_SPIKE = 0.80         # 80% margin (20% buffer before call)
CONSECUTIVE_LOSSES = 3      # Statistical anomaly at 65% win rate
```

**Why:** Each threshold validated against 20+ market crashes including August 5, 2024.

## 13. Position Limits

### NEVER Exceed Phase Limits:
```python
# HARD LIMITS BY PHASE - DO NOT OVERRIDE
MAX_POSITIONS = {
    1: 3,   # Beginners
    2: 5,   # Learning
    3: 7,   # Experienced
    4: 10   # Professional (Tom had 14 on Aug 5 - disaster)
}
```

**Why:** August 5, 2024: 14 positions led to £308,000 loss. Limit prevents repeat.

## 14. Integration Verification - MANDATORY

### NEVER Skip Integration Verification:
```python
def Initialize(self):
    # Setup all components
    self.setup_managers()
    self.setup_strategies() 
    self.setup_optimizations()
    
    # MANDATORY - DO NOT SKIP
    if not self.run_complete_integration_verification():
        raise ValueError("Integration verification failed")
    
    self.Log("[Critical] Integration verification PASSED - system ready")
```

**Why:** "Forgotten integrations" are the #1 cause of production failures. Components can be added but not properly integrated, or optimizations can accidentally disable critical functionality.

### NEVER Assume Integration Worked:
```python
# WRONG - DANGEROUS ASSUMPTION
self.new_manager = NewManager(self)
# Assume it worked - NO VERIFICATION!

# CORRECT - EXPLICIT VERIFICATION
self.new_manager = NewManager(self)
if not hasattr(self.new_manager, 'required_method'):
    raise ValueError(f"Integration failed: missing required_method")
```

**Why:** Silent integration failures can go undetected until live trading when they cause catastrophic losses.

## Common "Optimization" Traps to Avoid

### Trap 1: "Simplify by removing safety checks"
**Reality:** Safety checks prevent account destruction

### Trap 2: "Consolidate similar-looking code"
**Reality:** Similar-looking code often has critical differences

### Trap 3: "Remove 'redundant' state tracking"
**Reality:** State tracking enables crash recovery

### Trap 4: "Use approximations instead of real data"
**Reality:** Real market data is always better than approximations

### Trap 5: "Optimize for speed over safety"
**Reality:** A fast system that loses money is worthless

## Testing Changes

Before changing ANYTHING listed above:
1. Run full backtest (minimum 1 year)
2. Compare max drawdown (must not increase)
3. Check worst-case scenarios
4. Verify all safety systems still work
5. Document why change is necessary

## Summary

These "complex" systems exist because options trading is dangerous. Every safety system represents a lesson learned from real losses. The framework prioritizes:

1. **Safety over simplicity**
2. **Explicit over implicit**
3. **Fail-fast over silent errors**
4. **Real data over approximations**
5. **Proven parameters over optimization**

**When in doubt, DO NOT CHANGE.**