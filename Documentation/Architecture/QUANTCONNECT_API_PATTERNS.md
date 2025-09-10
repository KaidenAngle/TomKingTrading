# QuantConnect API Patterns

## Overview
This document explains how to properly use QuantConnect APIs without adding unnecessary defensive code or fallbacks.

## Core Principle: QC APIs Are Always Available

In the QuantConnect environment, certain APIs are GUARANTEED to be available. Adding fallbacks or defensive checks is not just unnecessary - it's wrong because it could mask real problems.

## Economic Calendar API

### CORRECT Usage:
```python
def check_fomc_day(self) -> bool:
    """Check if today is FOMC day using QC API
    
    NOTE: Uses QuantConnect's economic calendar - always available in QC environment
    Direct API call - QC calendar is always available
    """
    # DIRECT API CALL - NO FALLBACKS NEEDED
    fomc_days = self.TradingCalendar.GetDaysByType(
        TradingDayType.FOMC, 
        self.Time.date(), 
        self.Time.date()
    )
    return len(fomc_days) > 0
```

### WRONG - Never Do This:
```python
def check_fomc_day(self) -> bool:
    try:
        # Unnecessary defensive coding
        if hasattr(self, 'TradingCalendar'):
            fomc_days = self.TradingCalendar.GetDaysByType(...)
            return len(fomc_days) > 0
    except:
        # WRONG - Creating approximation
        # FOMC is usually 3rd Wednesday
        return self.Time.day > 14 and self.Time.day < 22 and self.Time.weekday() == 2
```

### Available Calendar Event Types:
- `TradingDayType.FOMC` - Federal Reserve meetings
- `TradingDayType.Earnings` - Company earnings
- `TradingDayType.EconomicEvents` - Economic data releases
- `TradingDayType.OptionExpiration` - Option expiration dates

## Options Chain Data

### CORRECT Usage:
```python
def get_option_chain(self, underlying: Symbol) -> OptionChain:
    """Get option chain for underlying
    
    QC provides real-time option chains
    No need for fallbacks or mock data
    """
    # Direct API usage
    chain = self.CurrentSlice.OptionChains.get(underlying)
    
    if not chain:
        # No chain available is valid - market might be closed
        return None
    
    return chain
```

### WRONG - Never Create Fake Data:
```python
def get_option_chain(self, underlying: Symbol):
    chain = self.CurrentSlice.OptionChains.get(underlying)
    
    if not chain:
        # WRONG - Never create synthetic option data!
        return self.create_synthetic_chain(underlying)
```

## Portfolio and Holdings

### CORRECT Usage:
```python
def get_position_size(self, symbol: Symbol) -> int:
    """Get current position size
    
    Portfolio API is always available
    """
    # Direct access - no checks needed
    return self.Portfolio[symbol].Quantity
```

### These Properties Are ALWAYS Available:
- `self.Portfolio.TotalPortfolioValue`
- `self.Portfolio.Cash`
- `self.Portfolio.TotalMarginUsed`
- `self.Portfolio[symbol].Quantity`
- `self.Portfolio[symbol].AveragePrice`
- `self.Portfolio[symbol].UnrealizedProfit`

## Order Management

### CORRECT Usage:
```python
def place_limit_order(self, symbol: Symbol, quantity: int, limit_price: float):
    """Place limit order using QC API
    
    Order methods always available
    """
    # Direct API call
    ticket = self.LimitOrder(symbol, quantity, limit_price)
    
    # Ticket is always returned, check if filled
    if ticket.Status == OrderStatus.Filled:
        self.Debug(f"Order filled immediately")
```

### Available Order Types (Always):
- `self.MarketOrder(symbol, quantity)`
- `self.LimitOrder(symbol, quantity, limit_price)`
- `self.StopMarketOrder(symbol, quantity, stop_price)`
- `self.StopLimitOrder(symbol, quantity, stop_price, limit_price)`

## Data Access

### CORRECT Usage:
```python
def get_current_price(self, symbol: Symbol) -> float:
    """Get current price for symbol
    
    Securities collection always available
    """
    # Direct access
    return self.Securities[symbol].Price
```

### WRONG - Don't Add Unnecessary Checks:
```python
def get_current_price(self, symbol: Symbol) -> float:
    # UNNECESSARY - Securities always exists
    if hasattr(self, 'Securities') and symbol in self.Securities:
        return self.Securities[symbol].Price
    else:
        # WRONG - Don't provide fallback prices
        return 100.0  # Assume some price
```

## Logging

### CORRECT Usage:
```python
# These are ALWAYS available - no checks needed
self.Debug("Debug message")
self.Log("Log message")  
self.Error("Error message")

# WRONG - Don't check if methods exist
if hasattr(self, 'Debug'):  # UNNECESSARY
    self.Debug("Message")
```

## Time and Schedule

### CORRECT Usage:
```python
def is_market_open(self) -> bool:
    """Check if market is open
    
    Market hours API always available
    """
    # Direct API usage
    return self.IsMarketOpen(self.spy)
```

### Always Available Time APIs:
- `self.Time` - Current algorithm time
- `self.StartDate` - Algorithm start date
- `self.EndDate` - Algorithm end date
- `self.IsMarketOpen(symbol)` - Market hours check
- `self.Schedule` - Scheduling API

## Greeks Calculation

### CORRECT Usage:
```python
def calculate_option_greeks(self, option_symbol: Symbol) -> Greeks:
    """Calculate Greeks using QC's built-in models
    
    Greeks models always available
    """
    # Use QC's Greeks calculation
    contract = self.Securities[option_symbol]
    
    # These are always populated by QC
    return {
        'delta': contract.Greeks.Delta,
        'gamma': contract.Greeks.Gamma,
        'theta': contract.Greeks.Theta,
        'vega': contract.Greeks.Vega
    }
```

## Common Mistakes to Avoid

### Mistake 1: Checking if Standard Methods Exist
```python
# WRONG
if hasattr(self, 'Portfolio'):
    value = self.Portfolio.TotalPortfolioValue

# CORRECT  
value = self.Portfolio.TotalPortfolioValue
```

### Mistake 2: Providing Fallback Data
```python
# WRONG
vix = self.Securities.get('VIX', {}).get('Price', 20)  # Default VIX

# CORRECT
vix = self.Securities['VIX'].Price
if not vix:
    raise ValueError("VIX data required")
```

### Mistake 3: Approximating Market Events
```python
# WRONG
is_fomc = self.Time.day > 14 and self.Time.day < 22  # Approximate

# CORRECT
fomc_days = self.TradingCalendar.GetDaysByType(TradingDayType.FOMC, ...)
is_fomc = len(fomc_days) > 0
```

## Why This Matters

1. **Reliability**: QC APIs provide real market data, not approximations
2. **Backtesting**: Approximations make backtests worthless
3. **Safety**: Fallback values can hide critical failures
4. **Simplicity**: Direct API usage is cleaner and clearer

## Interface Compatibility Issues (Updated January 2025)

### Securities Collection Access Pattern

#### ISSUE: ContainsKey Parameter Type Mismatch
```python
# BROKEN - Causes parameter type mismatch error
vix_symbol = self.algo.vix  # Symbol object
if self.algo.Securities.ContainsKey(vix_symbol):
    price = self.algo.Securities[vix_symbol].Price
```

**Error**: `TypeError: parameter type mismatch for ContainsKey method`

#### SOLUTION: Use Python 'in' Operator
```python
# FIXED - Use Python 'in' operator instead
vix_symbol = self.algo.vix  # Symbol object  
if vix_symbol in self.algo.Securities:
    price = self.algo.Securities[vix_symbol].Price
```

**Why This Happens**: QuantConnect's `ContainsKey()` method has strict parameter type requirements that don't match Python Symbol objects in all contexts.

**Best Practice**: Always use Python's native `in` operator for Securities collection membership testing.

### TradingCalendar API Deprecation Issues

#### ISSUE: GetEconomicEvents Method Not Available
```python
# BROKEN - Method not found in current QC version
fomc_events = self.TradingCalendar.GetEconomicEvents(
    TradingDayType.FOMC, 
    start_date, 
    end_date
)
```

**Error**: `AttributeError: 'TradingCalendar' object has no attribute 'GetEconomicEvents'`

#### SOLUTION: Use GetDaysByType Method
```python
# FIXED - Use available GetDaysByType method
fomc_days = self.TradingCalendar.GetDaysByType(
    TradingDayType.FOMC,
    start_date,
    end_date  
)

# Convert to boolean check
is_fomc_day = len(fomc_days) > 0
```

**Why This Happens**: QuantConnect API methods can be deprecated or renamed between versions. Always verify method availability in current documentation.

#### ROBUST FOMC Detection Pattern
```python
def is_fomc_day_safe(self) -> bool:
    """Safe FOMC detection with fallback logic"""
    
    try:
        # Primary: Use QC TradingCalendar if available
        fomc_days = self.TradingCalendar.GetDaysByType(
            TradingDayType.FOMC,
            self.Time.date(),
            self.Time.date()
        )
        return len(fomc_days) > 0
        
    except (AttributeError, Exception) as e:
        # Fallback: Calendar heuristics for FOMC
        self.Debug(f"[FOMC] Using calendar heuristics: {e}")
        return self._fomc_calendar_heuristic()
    
def _fomc_calendar_heuristic(self) -> bool:
    """Backup FOMC detection using calendar patterns"""
    
    # FOMC meets 8 times per year, typically:
    # - January/March/May/July/September/November: 3rd Wednesday
    # - December: 2nd Wednesday  
    # - June: Sometimes 2nd Wednesday
    
    current_date = self.Time.date()
    
    # Check if it's a Wednesday
    if current_date.weekday() != 2:  # 0=Monday, 2=Wednesday
        return False
    
    # Get the week of the month (1-5)
    week_of_month = (current_date.day - 1) // 7 + 1
    
    # FOMC months and typical weeks
    fomc_schedule = {
        1: 3,   # January: 3rd Wednesday
        3: 3,   # March: 3rd Wednesday  
        5: 3,   # May: 3rd Wednesday
        6: [2, 3],  # June: 2nd or 3rd Wednesday
        7: 3,   # July: 3rd Wednesday
        9: 3,   # September: 3rd Wednesday
        11: 3,  # November: 3rd Wednesday
        12: 2   # December: 2nd Wednesday
    }
    
    month = current_date.month
    if month not in fomc_schedule:
        return False
    
    expected_week = fomc_schedule[month]
    if isinstance(expected_week, list):
        return week_of_month in expected_week
    else:
        return week_of_month == expected_week
```

**Best Practice**: Always provide fallback logic for critical calendar-dependent functionality.

### Symbol Value Access Pattern

#### ISSUE: Symbol.Value Attribute Not Available
```python
# BROKEN - Index symbols don't have .Value attribute
vix_symbol = self.AddIndex("VIX", Resolution.Minute).Symbol
vix_value = vix_symbol.Value  # AttributeError: 'Index' object has no attribute 'Value'
```

#### SOLUTION: Access Price Through Securities Collection
```python
# FIXED - Access price through Securities
vix_symbol = self.AddIndex("VIX", Resolution.Minute).Symbol
if vix_symbol in self.Securities:
    vix_value = self.Securities[vix_symbol].Price
```

**Why This Happens**: Different security types (Index vs Equity vs Option) have different attribute structures in QuantConnect.

**Best Practice**: Always access current prices through `self.Securities[symbol].Price` regardless of security type.

### Pattern Summary for Securities Access

```python
def get_security_price(self, symbol: Symbol) -> float:
    """Robust pattern for any security type"""
    
    # CORRECT: Use 'in' operator, not ContainsKey()
    if symbol in self.Securities:
        security = self.Securities[symbol]
        
        # CORRECT: Check for valid price
        if security.Price > 0:
            return float(security.Price)
        else:
            raise ValueError(f"Invalid price for {symbol}: {security.Price}")
    else:
        raise KeyError(f"Security {symbol} not found in portfolio")
```

## Summary

In QuantConnect:
- **Trust the platform** - APIs are always available
- **Fail fast** - If data is missing, stop trading
- **Use real data** - Never approximate market events
- **Keep it simple** - Direct API calls without defensive checks
- **Use Python patterns** - 'in' operator instead of ContainsKey()
- **Access prices consistently** - Through Securities[symbol].Price

The QuantConnect platform is robust. If these APIs aren't available, the system has bigger problems than your algorithm.