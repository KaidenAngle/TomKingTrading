# Micro vs Full Futures Contracts

## Overview
The framework uses both micro (/M) and full-size (/) futures contracts at different phases. This is NOT about being cheap - it's about proper position sizing and risk management during the learning curve.

## Contract Size Comparison

### S&P 500 Futures
```
/ES (E-mini S&P 500):
- Multiplier: $50 per point
- At 4500: $225,000 notional
- 1 point move = $50 P&L
- Margin required: ~$13,000

/MES (Micro E-mini S&P 500):
- Multiplier: $5 per point
- At 4500: $22,500 notional
- 1 point move = $5 P&L
- Margin required: ~$1,300

Size ratio: /ES = 10 × /MES
```

### Crude Oil Futures
```
/CL (Crude Oil):
- Multiplier: 1,000 barrels
- At $75: $75,000 notional
- $1 move = $1,000 P&L
- Margin required: ~$6,000

/MCL (Micro Crude Oil):
- Multiplier: 100 barrels
- At $75: $7,500 notional
- $1 move = $100 P&L
- Margin required: ~$600

Size ratio: /CL = 10 × /MCL
```

### Gold Futures
```
/GC (Gold):
- Multiplier: 100 troy oz
- At $2000: $200,000 notional
- $1 move = $100 P&L
- Margin required: ~$10,000

/MGC (Micro Gold):
- Multiplier: 10 troy oz
- At $2000: $20,000 notional
- $1 move = $10 P&L
- Margin required: ~$1,000

Size ratio: /GC = 10 × /MGC
```

## Phase-Based Progression

### Phase 1: Micro Only
```python
PHASE_1_FUTURES = {
    "allowed": ["/MES", "/MCL", "/MGC"],
    "forbidden": ["/ES", "/CL", "/GC"],
    "max_contracts": {
        "/MES": 5,
        "/MCL": 3,
        "/MGC": 3
    }
}
```

**Why Micros in Phase 1:**
- Learning curve with real money
- Mistakes are 10x less expensive
- Can trade multiple contracts for better scaling
- Total risk equivalent to 0.5 full contracts

### Phase 2: Mostly Micro
```python
PHASE_2_FUTURES = {
    "primary": ["/MES", "/MCL", "/MGC"],
    "occasional": ["/CL"],  # Maybe 1 contract
    "max_contracts": {
        "/MES": 10,  # = 1 /ES
        "/MCL": 5,
        "/MGC": 5,
        "/CL": 1    # Full size oil only
    }
}
```

### Phase 3: Transition Period
```python
PHASE_3_FUTURES = {
    "available": ["/MES", "/ES", "/MCL", "/CL", "/MGC", "/GC"],
    "preferred": "Full size for liquidity",
    "max_contracts": {
        "/ES": 1,
        "/MES": 5,  # For fine-tuning
        "/CL": 2,
        "/GC": 1
    }
}
```

### Phase 4: Full Size Primary
```python
PHASE_4_FUTURES = {
    "primary": ["/ES", "/CL", "/GC", "/SI"],
    "scaling": ["/MES", "/MCL", "/MGC"],  # For precision
    "max_contracts": {
        "/ES": 3,
        "/CL": 5,
        "/GC": 2,
        "micros": "As needed for scaling"
    }
}
```

## Why Not Jump to Full Size?

### The $50,000 Account Example
```
Scenario: $50,000 account wants to trade futures strangles

With Full /ES:
- 1 strangle = $13,000 margin (26% of account)
- 100 point move = $5,000 loss (10% of account)
- 2 positions = 52% margin (dangerous)

With Micro /MES:
- 10 strangles = $13,000 margin (26% of account)
- 100 point move = $5,000 loss (same risk)
- But can scale: trade 5 instead of 0 or 10
- Better position management
```

### Real Loss Comparison
```
Mistake Scenario: Entered strangle at wrong strikes

Full /CL Loss:
- Sold strangle at bad strikes
- Oil moves $5 overnight
- Loss: $5,000 (10% of $50k account)

Micro /MCL Loss:
- Same mistake
- Loss: $500 (1% of account)
- Lesson learned for 1/10th the cost
```

## Liquidity Considerations

### When Micros Are Fine
```
Good for Micros:
- Entry/exit at market hours
- Standard strikes
- 1-10 contracts
- Monthly expirations
- Tight markets (/MES, /MCL)
```

### When You Need Full Size
```
Need Full Size:
- Trading 50+ micro contracts
- Complex spreads
- Weekly options
- Off-hours trading
- Illiquid strikes
```

## Scaling Strategies

### Mixed Sizing for Precision
```python
def calculate_futures_position(target_delta: float) -> Dict:
    """Use mix of micro and full for exact sizing
    
    Example: Want 35 deltas in /ES
    """
    es_delta = 50  # 1 /ES = 50 deltas
    mes_delta = 5  # 1 /MES = 5 deltas
    
    # Calculate optimal mix
    full_contracts = target_delta // es_delta  # 0
    remaining = target_delta % es_delta        # 35
    micro_contracts = remaining // mes_delta   # 7
    
    return {
        "/ES": 0,
        "/MES": 7  # Exactly 35 deltas
    }
```

### Gradual Scaling Example
```
Month 1: 10 /MES (equivalent to 1 /ES)
Month 2: 5 /MES + 1 /ES (1.5 /ES equivalent)
Month 3: 2 /ES (comfort with full size)
Month 4: 2 /ES + 5 /MES (2.5 /ES for precision)
```

## Options on Futures

### Micro Options Availability
```
/MES Options: ✅ Available (liquid)
/MCL Options: ✅ Available (decent liquidity)
/MGC Options: ⚠️ Available but thin

/M2K Options: ❌ Very illiquid
/MNQ Options: ⚠️ Available but wide spreads
```

### Strike Selection Differences
```python
# Full /ES Options
es_strikes = [4400, 4425, 4450, 4475, 4500]  # $25 wide

# Micro /MES Options  
mes_strikes = [4400, 4410, 4420, 4430, 4440]  # $10 wide initially
# But at monthly expiration: same as /ES
```

## Common Mistakes to Avoid

### Mistake 1: "Micros are for beginners"
**Reality**: Micros are for precise position sizing. Pros use them too.

### Mistake 2: "Full size is more professional"
**Reality**: Using inappropriate size for your account is unprofessional.

### Mistake 3: "Micros have bad fills"
**Reality**: /MES and /MCL have excellent liquidity during market hours.

### Mistake 4: "Can't make money with micros"
**Reality**: 10 /MES = 1 /ES. Same P&L, better risk management.

## Transition Guidelines

### When to Move from Micro to Full
```python
def ready_for_full_size() -> bool:
    """Check if ready for full-size futures"""
    
    criteria = {
        "account_size": account_value > 75000,
        "phase": current_phase >= 3,
        "experience": total_futures_trades > 50,
        "win_rate": futures_win_rate > 0.65,
        "proven_management": handled_drawdown_well,
        "micros_maxed": trading_50_plus_micros
    }
    
    return all(criteria.values())
```

### Hybrid Approach (Recommended)
```python
def optimal_futures_allocation():
    """Use both for maximum flexibility"""
    
    # Core positions in full size (liquidity)
    core_positions = {
        "/ES": 1,  # Main S&P exposure
        "/CL": 2   # Oil strangles
    }
    
    # Fine-tuning with micros
    adjustments = {
        "/MES": 5,  # Add 25 deltas S&P
        "/MCL": 3   # Small oil addition
    }
    
    return {**core_positions, **adjustments}
```

## Tax Considerations

### Section 1256 Contracts (Both Micro and Full)
```
Tax Treatment (US):
- 60% long-term capital gains
- 40% short-term capital gains
- Applies to both /ES and /MES
- Mark-to-market at year-end
- Better than stock options tax treatment
```

## Summary

Micro vs Full Futures Decision Tree:
```
Account < $40k → Micros only
Account $40-60k → Mostly micros
Account $60-75k → Mix based on strategy
Account > $75k → Full size primary, micros for scaling

Experience < 6 months → Micros only
Experience 6-12 months → Begin mixing
Experience > 1 year → Based on performance

Position size < $5k risk → Micros
Position size > $5k risk → Full size
Need precise scaling → Use both
```

Key Points:
1. **Micros are risk management tools**, not training wheels
2. **10 micros = 1 full contract** in P&L and margin
3. **Phase progression** determines available contracts
4. **Liquidity is excellent** in major micros (/MES, /MCL)
5. **Tax treatment identical** for micro and full futures

**Start with micros, prove profitability, then scale. The market doesn't care about your ego - it cares about your risk management.**