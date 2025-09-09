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

## Summary

In QuantConnect:
- **Trust the platform** - APIs are always available
- **Fail fast** - If data is missing, stop trading
- **Use real data** - Never approximate market events
- **Keep it simple** - Direct API calls without defensive checks

The QuantConnect platform is robust. If these APIs aren't available, the system has bigger problems than your algorithm.