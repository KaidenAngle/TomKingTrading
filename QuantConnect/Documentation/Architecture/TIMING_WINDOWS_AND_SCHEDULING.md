# Timing Windows and Scheduling Logic

## Overview
Specific timing windows exist for good reasons based on market microstructure, liquidity patterns, and years of trading experience. These are NOT arbitrary times.

## Critical Timing Windows

### 0DTE Entry Window: 9:45-10:30 AM EST

#### Why Not 9:30 AM (Market Open)?
```python
# WRONG - Trading at open
if self.Time.hour == 9 and self.Time.minute == 30:
    enter_0dte()  # DANGEROUS

# CORRECT - Wait 15 minutes
if self.Time.hour == 9 and self.Time.minute >= 45:
    enter_0dte()  # Safe entry
```

**Reasons:**
1. **Opening Volatility** - First 15 minutes are chaos
2. **Wide Bid-Ask Spreads** - Options spreads take time to tighten
3. **Price Discovery** - Market finding true levels
4. **Overnight Gap Adjustments** - Positions unwinding

#### Why Stop at 10:30 AM?
- After 10:30, too much of the day's move may have occurred
- Theta decay accelerates after morning
- Less time for position to recover if wrong

### 0DTE Exit: 3:30 PM EST MANDATORY

#### Why Not 3:59 PM?
```python
# WRONG - Waiting until close
if self.Time.hour == 15 and self.Time.minute == 59:
    close_0dte()  # TOO LATE!

# CORRECT - Exit at 3:30
if self.Time.hour == 15 and self.Time.minute == 30:
    close_0dte()  # MANDATORY
```

**Reasons:**
1. **Liquidity Dries Up** - After 3:30, spreads widen dramatically
2. **Pin Risk** - Final 30 minutes can pin to strikes
3. **Assignment Risk** - Need time to handle any issues
4. **Gamma Explosion** - Final hour gamma is unmanageable

### State Persistence: 3:45 PM EST

#### Why 3:45 PM, Not 4:00 PM?
```python
self.Schedule.On(
    self.DateRules.EveryDay(self.spy),
    self.TimeRules.At(15, 45),  # 3:45 PM, not 4:00 PM
    self.PersistStates
)
```

**Reasons:**
1. **Before Market Close** - Ensures data is saved while systems active
2. **After 0DTE Exit** - All positions settled
3. **Buffer Time** - 15 minutes before close for any issues
4. **EOD Reconciliation** - Time to verify everything

## Market Microstructure Timing

### Why Check IsMarketOpen() During Market Hours?
```python
# Looks redundant but ISN'T
if not self.IsMarketOpen(self.spy):
    return  # Skip even during "market hours"
```

**Reasons:**
1. **Half Days** - Markets close early several times per year
2. **Holidays** - Market holidays aren't always obvious
3. **Circuit Breakers** - Market-wide halts
4. **Special Circumstances** - Emergencies, system issues

### Option Check Interval: Every 15 Minutes
```python
self.option_check_interval = timedelta(minutes=15)
```

**Why 15 Minutes?**
- **Too Frequent (5 min)** - Overtrading, excessive fees
- **Too Rare (60 min)** - Miss opportunities, late reactions
- **15 Minutes** - Balance between responsiveness and stability

## Weekly Patterns

### Why Friday-Only for 0DTE?
```python
if self.Time.weekday() == 4:  # Friday only
    check_0dte_setup()
```

**Reasons:**
1. **Weekly Options Expiry** - Most liquid expiration
2. **Weekend Theta** - Captures weekend time decay
3. **Predictable Volume** - Highest option volume day
4. **Tom King's Rule** - "I only trade 0DTE on Fridays"

### Monday Avoidance for New Positions
```python
if self.Time.weekday() == 0:  # Monday
    # Be extra careful
    reduce_position_sizes(0.5)
```

**Why Reduce Monday Risk?**
- Weekend news gaps
- Lower Monday liquidity
- Higher Monday volatility
- Weekend position adjustments

## Intraday Critical Times

### 10:30 AM - First Decision Point
```python
if self.Time.hour == 10 and self.Time.minute == 30:
    evaluate_morning_positions()
```

**Why 10:30?**
- Opening volatility settled
- First hour range established
- European markets fully open
- Economic data released (10:00 AM)

### 12:00 PM - Midday Check
```python
if self.Time.hour == 12:
    check_lunch_liquidity()
```

**Why Noon?**
- Lunch hour liquidity drop
- European close approaching (11:30 AM EST)
- Half-day position assessment
- Gamma adjustment time

### 2:00 PM - Final Entry Window
```python
if self.Time.hour == 14:
    last_chance_entries()  # No new entries after 2 PM
```

**Why 2:00 PM Cutoff?**
- Need 2 hours minimum for theta decay
- Avoid end-of-day volatility
- Time to manage if goes wrong
- Margin requirements increase after 2:30

### 3:00 PM - Defensive Mode
```python
if self.Time.hour == 15:
    enter_defensive_mode()  # Start closing positions
```

**Why 3:00 PM?**
- Final hour acceleration
- Institutional rebalancing
- Index rebalancing
- Option dealer hedging

## Economic Data Windows

### 8:30 AM EST - Major Data
```python
if self.Time.hour == 8 and self.Time.minute == 30:
    # DON'T TRADE YET
    wait_for_data_reaction()
```

**Data Released:**
- NFP (First Friday)
- CPI/PPI
- Jobless Claims (Thursday)
- GDP

### 10:00 AM EST - Secondary Data
```python
if self.Time.hour == 10 and self.Time.minute == 0:
    check_data_impact()
```

**Data Released:**
- Consumer Confidence
- Housing Data
- Manufacturing Data
- Oil Inventories (10:30 Wed)

### 2:00 PM EST - FOMC Days
```python
if is_fomc_day and self.Time.hour == 14:
    # FOMC announcement
    halt_all_trading()
```

**Why Halt?**
- Massive volatility spike
- Unpredictable direction
- Wide spreads
- Better to wait

## Futures-Specific Timing

### Sunday 6:00 PM - Futures Open
```python
if self.Time.weekday() == 6 and self.Time.hour == 18:
    check_futures_gap()  # /ES opens Sunday evening
```

**Important:**
- Futures trade Sunday night
- Gap from Friday close
- Thin liquidity initially
- Sets Monday tone

### Futures Roll Dates
```python
# Quarterly expiration - Third Friday of March, June, Sept, Dec
if is_futures_roll_week():
    avoid_new_futures_positions()
```

**Why Avoid Roll Week?**
- Volume shifts to next contract
- Spread widening
- Basis risk
- Confusing price action

## Safety Check Scheduling

### Every 5 Minutes
```python
self.Schedule.On(
    self.DateRules.EveryDay(self.spy),
    self.TimeRules.Every(timedelta(minutes=5)),
    self.SafetyCheck
)
```

**Why 5 Minutes?**
- Fast enough to catch problems
- Not so fast it impacts performance
- Allows quick circuit breaker activation
- Standard monitoring interval

## Special Timing Considerations

### Triple Witching (Third Friday of Mar/Jun/Sep/Dec)
```python
if is_triple_witching():
    # Extreme volatility day
    reduce_all_positions()
    exit_early()  # 3:00 PM instead of 3:30
```

### Half Days (Day Before Holidays)
```python
HALF_DAYS = [
    "Day before Thanksgiving",
    "Christmas Eve",
    "Day before July 4th"
]
# Market closes at 1:00 PM EST
```

### Year-End Window Dressing
```python
if self.Time.month == 12 and self.Time.day >= 20:
    # Institutional rebalancing
    expect_unusual_flows()
```

## Common Timing Mistakes

### Mistake 1: Trading the Open
**Problem**: Chaos, wide spreads, gaps
**Solution**: Wait 15+ minutes

### Mistake 2: Holding Until Close
**Problem**: No liquidity, pin risk
**Solution**: Exit by 3:30 PM

### Mistake 3: Ignoring Half Days
**Problem**: Caught in illiquid market
**Solution**: Check holiday calendar

### Mistake 4: Fixed Time Assumptions
**Problem**: Markets change (DST, holidays)
**Solution**: Use market-aware scheduling

## Summary

Every timing window is based on:
1. **Market Microstructure** - How markets actually work
2. **Liquidity Patterns** - When you can actually trade
3. **Risk Windows** - When risk changes dramatically
4. **Tom King's Experience** - 40 years of lessons

**These times are not suggestions - they're survival rules.**

Never change these windows without understanding WHY they exist. Each represents expensive lessons learned from real losses.