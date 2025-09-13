# August 5, 2024 - The £308,000 Correlation Disaster

## Overview
On August 5, 2024, Tom King lost £308,000 in a single day due to correlation risk. This document explains what happened, why it happened, and how the framework prevents it.

## What Happened

### The Setup (August 2, 2024 - Friday)
```
Positions Entered:
├─ 6x SPX 112 DTE naked puts
├─ 2x /ES strangles  
├─ 3x /CL strangles
├─ 2x /GC strangles
├─ 1x IWM iron condor
└─ Total: 14 positions, all short volatility
```

### The Disaster (August 5, 2024 - Monday)
```
Market Opens:
├─ VIX: 16 → 65 (largest spike in history)
├─ SPX: -4.5% gap down
├─ /ES: Limit down
├─ /CL: -8% (oil crash)
├─ /GC: +3% (flight to safety)
└─ Result: £308,000 loss (60% of account)
```

## Why It Happened

### 1. Hidden Correlation
All positions were effectively the same trade:
- **Short volatility** across different products
- When VIX spiked, ALL positions lost
- Diversification was an illusion

### 2. No Position Limits
```python
# What Tom had (WRONG)
if margin_available:
    place_trade()  # No limit on number of positions
```

### 3. No Correlation Checking
```python
# What was missing
correlation_check = calculate_correlation(new_position, existing_positions)
# Current correlation thresholds are in MASTER_RISK_PARAMETERS.md
if correlation_check > CORRELATION_THRESHOLD:
    reject_trade()  # This would have saved £200k+
```

### 4. Overleveraging
- 6 positions in same product (SPX)
- 80% of buying power used
- No reserve for defense

## The Lesson Learned

### Tom's Quote
> "The 112 wasn't the problem - I had 6 positions on. Overleveraging was the problem. If I had 2 positions, I'd have lost £100k, not £308k. Still bad, but recoverable."

### Key Realizations
1. **Correlation kills** - Different products can move together
2. **Position limits matter** - More than risk per trade
3. **VIX spikes are violent** - 16 to 65 in minutes
4. **Reserve capital essential** - Need dry powder for defense

## How The Framework Prevents This

### 1. August2024CorrelationLimiter
```python
class August2024CorrelationLimiter:
    """Prevents correlation disasters
    
    Named after August 5, 2024 disaster
    Never forget: £308,000 lost to correlation
    """
    
    def check_correlation(self, new_position: str) -> bool:
        # Count similar positions
        equity_positions = self.count_equity_positions()  # SPY, IWM, QQQ
        futures_positions = self.count_futures_positions()  # /ES, /MES
        volatility_positions = self.count_vol_positions()  # All short vol
        
        # HARD LIMITS - Based on August 5 lesson
        if equity_positions >= 3:
            self.Error("CORRELATION LIMIT: Too many equity positions")
            return False
            
        if volatility_positions >= 5:
            self.Error("CORRELATION LIMIT: Too many short vol positions")
            return False
            
        return True
```

### 2. SPY Concentration Manager
```python
def check_spy_concentration(self) -> bool:
    """Prevent SPX/SPY/ES concentration
    
    August 5: 6 SPX positions = disaster
    Limit: 3 maximum across all SPY products
    """
    spy_equivalent_positions = (
        self.count_spy_positions() +
        self.count_spx_positions() +
        self.count_es_positions()
    )
    
    if spy_equivalent_positions >= 3:
        self.Error("SPY CONCENTRATION: August 5 protection triggered")
        return False
```

### 3. Position Count Limits
```python
# HARD CODED LIMITS - August 5 protection
MAX_POSITIONS_BY_PHASE = {
    1: 3,   # Beginners: very limited
    2: 5,   # Learning: controlled growth
    3: 7,   # Experienced: still limited
    4: 10   # Professional: even pros have limits
}

# NEVER allow more than 10 positions
# Tom had 14 on August 5
```

### 4. Volatility Regime Detection
```python
def detect_volatility_regime(self) -> str:
    """Detect market regime to prevent August 5 scenarios
    
    When VIX is calm, risk builds silently
    When VIX spikes, everything correlates
    """
    vix = self.vix_manager.get_current_vix()
    vix_change = self.calculate_vix_change_rate()
    
    if vix < 15 and vix_change < 0.1:
        # DANGER ZONE - August 5 started here
        self.Warning("Low VIX regime - correlation risk building")
        return "COMPLACENT"
        
    elif vix_change > 0.5:  # 50% spike
        # PANIC MODE - August 5 spike
        self.Error("VIX SPIKE DETECTED - HALT ALL TRADING")
        return "PANIC"
```

### 5. Emergency Procedures
```python
def handle_correlation_event(self):
    """Emergency response to correlation spike
    
    Based on August 5 playbook
    Goal: Stop the bleeding immediately
    """
    
    # 1. HALT all new trades
    self.halt_all_trading("Correlation event detected")
    
    # 2. Close highest risk positions first
    positions_by_risk = self.sort_positions_by_risk()
    for position in positions_by_risk[:3]:  # Close top 3
        self.emergency_close(position)
    
    # 3. Reduce all position sizes
    for position in self.get_remaining_positions():
        self.reduce_position_size(position, 0.5)  # Cut in half
    
    # 4. Alert operator
    self.send_emergency_alert("AUGUST 5 SCENARIO DETECTED")
```

## Configuration Changes After August 5

### Before (What Caused Disaster)
```python
# No limits, no correlation checks
MAX_POSITIONS = None
CORRELATION_CHECK = False
CONCENTRATION_LIMITS = None
```

### After (Current Framework)
```python
# AUGUST 5 PROTECTION PARAMETERS
MAX_POSITIONS = 10  # Hard limit
MAX_SPY_EQUIVALENT = 3  # SPY/SPX/ES combined
MAX_SHORT_VOL = 5  # Total short volatility positions
CORRELATION_THRESHOLD = 0.70  # Block correlated trades
MIN_RESERVE_CAPITAL = 0.20  # Always keep 20% dry powder
```

## Testing for August 5 Scenarios

### Backtest Requirements
```python
def test_august_5_scenario(self):
    """Test framework handles August 5 repeat
    
    Must verify protection works
    """
    # Setup: Calm market
    self.set_vix(15)
    
    # Try to enter 14 positions like August 5
    for i in range(14):
        success = self.enter_position(f"position_{i}")
        
        if i >= 10:
            # Should be blocked by position limits
            assert not success, "Position limit failed!"
    
    # Simulate VIX spike
    self.set_vix(65)
    
    # Verify emergency procedures triggered
    assert self.trading_halted, "Emergency halt failed!"
    assert self.positions_reduced, "Position reduction failed!"
```

## Visual Reminder

### The August 5 Chart
```
VIX Level
65 |                    ★ DISASTER
   |                   /│
   |                  / │
   |                 /  │
30 |                /   │
   |               /    │
16 |──────────────     │
   └────────────────────┴──
   Aug 2      Aug 5    Aug 6

Portfolio Value
£500k |─────────
      |         \
      |          \★ -£308k
£200k |           \____
      └──────────────────
      Aug 2   Aug 5   Aug 6
```

## Tom's Rules After August 5

1. **"Never more than 2 positions in same underlying"**
2. **"Count your short volatility exposure"**
3. **"When everyone is calm, risk is highest"**
4. **"Correlation is invisible until it isn't"**
5. **"Keep dry powder for defense"**

## Summary

August 5, 2024 was Tom King's most expensive lesson:
- **£308,000 lost** to correlation risk
- **14 positions** all moved together
- **VIX quadrupled** in hours
- **No defense** possible without reserves

The framework now has FIVE systems preventing August 5 repeats:
1. August2024CorrelationLimiter
2. SPYConcentrationManager
3. Hard position limits
4. Volatility regime detection
5. Emergency procedures

**Every safety system exists because of a real disaster. August 5 created five of them.**

Never disable these protections. The market will test them again.