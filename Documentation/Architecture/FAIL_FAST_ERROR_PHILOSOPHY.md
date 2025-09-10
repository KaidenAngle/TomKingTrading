# Fail-Fast Error Philosophy

## Overview
The framework uses a FAIL-FAST approach during trading hours. This means errors stop execution immediately rather than attempting recovery. This is intentional and critical for safety.

## Why Fail-Fast for Trading?

### The Hidden Risk of Silent Failures
```python
# WRONG - Silent failure
try:
    vix = self.get_vix()
except:
    vix = 20  # Assume "normal" VIX
    self.Debug("Using default VIX")
    
# Now trading with FAKE data - EXTREMELY DANGEROUS
```

**What happens:**
1. VIX data fails (maybe 0, maybe None)
2. System assumes VIX = 20
3. Enters trades thinking volatility is normal
4. Real VIX could be 40 (high risk) or 12 (no edge)
5. **Result: Catastrophic losses from wrong position sizing**

### The Fail-Fast Approach
```python
# CORRECT - Fail immediately
vix = self.get_vix()
if not vix or vix <= 0:
    raise ValueError("VIX data required for trading")
    # System stops - no trades with bad data
```

**What happens:**
1. VIX data fails
2. System raises error
3. No trades executed
4. **Result: No losses from bad data**

## Where We Use Fail-Fast

### 1. Market Data
```python
def get_current_price(self, symbol: Symbol) -> float:
    """Get price - fail if unavailable
    
    NEVER return a default price
    Bad price = wrong position size = massive loss
    """
    price = self.Securities[symbol].Price
    
    if not price or price <= 0:
        raise ValueError(f"Invalid price for {symbol}: {price}")
    
    return price
```

### 2. VIX Data (CRITICAL)
```python
def get_vix_value(self) -> float:
    """Get VIX - NEVER use fallback
    
    VIX determines:
    - Position sizing
    - Strategy selection  
    - Risk limits
    
    Wrong VIX = Account destruction
    """
    vix = self.Securities['VIX'].Price
    
    if not vix or vix <= 0:
        # DO NOT return 20 or any default
        raise ValueError("VIX data failure - cannot trade")
```

### 3. Options Data
```python
def get_option_chain(self) -> OptionChain:
    """Get option chain - fail if unavailable
    
    No chain = can't price options = can't trade
    """
    chain = self.CurrentSlice.OptionChains.get(self.underlying)
    
    if not chain or len(chain) == 0:
        raise ValueError("Option chain unavailable")
    
    return chain
```

## Where We DO Use Error Handling

### 1. State Persistence (Non-Critical)
```python
def save_state(self):
    """Save state - OK to fail
    
    State saving is important but not critical
    Better to trade without saved state than not trade
    """
    try:
        self.ObjectStore.Save("state", self.state)
    except Exception as e:
        self.Debug(f"State save failed: {e}")
        # Continue trading - not critical
```

### 2. Logging and Debugging
```python
def log_trade_details(self, trade):
    """Log details - OK to fail
    
    Logging helps debugging but isn't critical
    """
    try:
        self.Debug(f"Trade: {trade}")
    except:
        pass  # Logging failure doesn't affect trading
```

### 3. Performance Metrics
```python
def update_metrics(self):
    """Update metrics - OK to fail
    
    Nice to have but not required for safety
    """
    try:
        self.performance_tracker.update()
    except Exception as e:
        self.Debug(f"Metrics update failed: {e}")
        # Continue without metrics
```

## The Decision Framework

### When to Fail-Fast (Raise Errors)
```python
# These MUST fail fast:
- Market data (prices, volumes)
- VIX values
- Option chains
- Position information
- Order execution
- Margin calculations
- Greeks calculations
- Calendar data (FOMC dates)
```

### When to Handle Errors (Try-Catch)
```python
# These can handle errors:
- State persistence
- Logging
- Metrics/statistics
- Visualizations
- Debug output
- Non-critical calculations
```

## Real Examples of Why This Matters

### Example 1: VIX Data Failure
```python
# Scenario: VIX feed drops, returns 0
# With fallback: System thinks VIX = 20, enters huge position
# Market crashes, VIX actually 45
# Loss: $50,000

# With fail-fast: System stops, no trade
# Loss: $0
```

### Example 2: Option Price Failure
```python
# Scenario: Option bid/ask unavailable
# With fallback: Use "estimated" price
# Real price 2x higher
# Loss: $10,000 on entry

# With fail-fast: No trade
# Loss: $0
```

### Example 3: Position Size Failure
```python
# Scenario: Can't calculate position size
# With fallback: Use "standard" size
# Size 10x too large for account
# Loss: Entire account on one move

# With fail-fast: No trade
# Loss: $0
```

## Common Anti-Patterns to AVOID

### Anti-Pattern 1: Catch-All Error Handling
```python
# NEVER DO THIS
try:
    # Entire trading logic
    execute_trades()
except Exception as e:
    self.Debug(f"Error: {e}")
    # Continue with default values
```

### Anti-Pattern 2: Default Values for Critical Data
```python
# NEVER DO THIS
vix = self.get_vix() or 20  # NO!
price = self.get_price() or 100  # NO!
margin = self.get_margin() or 10000  # NO!
```

### Anti-Pattern 3: Silencing Errors
```python
# NEVER DO THIS
try:
    critical_calculation()
except:
    pass  # Silent failure = hidden disaster
```

## The Right Way to Handle Errors

### Pattern 1: Explicit Validation
```python
def validate_and_trade(self):
    """Validate everything BEFORE trading"""
    
    # Check all data first
    vix = self.get_vix()
    if not vix or vix <= 0:
        raise ValueError("Invalid VIX")
    
    price = self.get_price()
    if not price or price <= 0:
        raise ValueError("Invalid price")
    
    # Only trade if ALL data valid
    self.execute_trade(vix, price)
```

### Pattern 2: Circuit Breakers
```python
def on_error(self, error):
    """When error occurs, halt safely"""
    
    self.Error(f"CRITICAL ERROR: {error}")
    
    # Halt all trading
    self.halt_all_trading()
    
    # Close risky positions
    self.enter_defensive_mode()
    
    # Alert operator
    self.send_alert("System error - manual intervention required")
```

### Pattern 3: Graceful Degradation (Only for Non-Critical)
```python
def update_dashboard(self):
    """Dashboard can fail gracefully"""
    
    try:
        self.generate_html_dashboard()
    except Exception as e:
        # Dashboard isn't critical
        self.Debug(f"Dashboard failed: {e}")
        # Trading continues without dashboard
```

## Testing Fail-Fast Behavior

### Test Data Failures
```python
def test_vix_failure():
    """Test system stops on VIX failure"""
    
    set_vix(None)
    result = attempt_trade()
    
    assert result == "ERROR"
    assert no_positions_opened()
```

### Test Partial Failures
```python
def test_partial_data_failure():
    """Test system stops if ANY critical data missing"""
    
    set_valid_price()
    set_invalid_vix()  # One bad data point
    
    result = attempt_trade()
    
    assert result == "ERROR"  # Must fail
```

## Summary

Fail-Fast philosophy means:
1. **No trading with bad data** - Ever
2. **Errors stop execution** - Immediately  
3. **No silent failures** - All errors logged
4. **No default values** - For critical data
5. **Clear error messages** - Know what failed

**Remember:**
- **A stopped system loses nothing**
- **A system trading with bad data loses everything**

In trading, the biggest losses come from unknown unknowns. Fail-fast ensures unknowns become known immediately.

**It's better to miss profits than to take losses from bad data.**