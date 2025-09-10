# Complete Strategy Specifications

## Overview
Detailed specifications for all 10 strategies in the Tom King Trading Framework. Each strategy has specific entry criteria, position sizing, management rules, and exit conditions.

## 1. Friday 0DTE Iron Condor

### Specifications
```python
STRATEGY_0DTE = {
    "name": "Friday 0DTE Iron Condor",
    "underlying": "SPY",
    "frequency": "Friday only",
    "entry_time": "9:45-10:30 AM EST",
    "exit_time": "3:30 PM EST mandatory",
    "DTE": 0,
    "structure": "Iron Condor or Broken Wing",
    "min_vix": 22,
    "max_positions": {1: 2, 2: 3, 3: 4, 4: "unlimited"},
    "position_size": "5% of account max",
    "profit_target": "50% of credit",
    "stop_loss": "200% of credit",
    "management": "Let theta work, defend if breached"
}
```

### Entry Criteria
- Friday only (weekly expiration)
- VIX > 22
- Market open 15+ minutes (avoid opening chaos)
- No major economic events within 2 hours
- SPY concentration check passed

### Strike Selection
```python
# Standard Iron Condor
call_short = current_price + (ATR * 0.7)
call_long = call_short + 30  # Always 30 points
put_short = current_price - (ATR * 0.7)
put_long = put_short - 30    # Always 30 points

# Broken Wing (if directional bias)
if bullish_bias:
    put_wing = 50  # Wider put protection
    call_wing = 30  # Standard call side
```

### Management Rules
- **10:30 AM**: Check if adjustment needed
- **12:00 PM**: Reduce if at profit target
- **2:00 PM**: Consider defensive exit if threatened
- **3:30 PM**: MANDATORY CLOSE ALL

## 2. LT112 Put Spreads

### Specifications
```python
STRATEGY_LT112 = {
    "name": "LT112 Put Spread",
    "underlying": "SPY",
    "target_DTE": 112,
    "structure": "Bull Put Spread",
    "min_vix": 12,
    "max_vix": 35,
    "max_positions": {1: 0, 2: 2, 3: 3, 4: "3+"},
    "position_size": "10% of account max",
    "profit_target": "50% of credit at 45 DTE",
    "defensive_exit": "21 DTE mandatory",
    "management": "Monitor weekly, exit at 21 DTE"
}
```

### Entry Criteria
- Find expiration closest to 112 DTE
- 12 < VIX < 35 (moderate volatility)
- SPY not in downtrend (8 EMA > 21 EMA)
- No similar position already open
- Buying power available

### Strike Selection
```python
# Put spread strikes
short_put = current_price * 0.90  # 10% OTM
long_put = short_put - 5          # $5 wide spread

# Minimum credit requirement
min_credit = spread_width * 0.20  # 20% of width
if credit < min_credit:
    skip_trade()  # Not enough premium
```

### 21 DTE Rule (MANDATORY)
```python
if dte <= 21:
    # NO EXCEPTIONS - Tom King's #1 rule
    close_position_immediately()
    # Gamma risk explodes after 21 DTE
```

## 3. IPMCC (In-the-Money Protective Collar)

### Specifications
```python
STRATEGY_IPMCC = {
    "name": "IPMCC Weekly Calls",
    "underlying": ["SPY", "QQQ", "IWM", "AAPL", "MSFT"],
    "shares_required": 100,
    "call_frequency": "Weekly",
    "call_DTE": "5-7 days",
    "structure": "Covered Call",
    "position_size": "Shares + margin for protective put",
    "profit_target": "90% of extrinsic value",
    "management": "Roll if assigned, sell weekly"
}
```

### Entry Criteria
- Own 100 shares of underlying
- Stock not in strong downtrend
- Earnings not within expiration period
- IV rank > 30% (decent premium)

### Strike Selection
```python
# Based on trend
if ema8 > ema21:  # Uptrend
    call_strike = current * 1.005  # 0.5% OTM
elif ema8 == ema21:  # Flat
    call_strike = current * 1.000  # ATM
else:  # Downtrend
    call_strike = current * 0.995  # 0.5% ITM
```

## 4. Futures Strangles

### Specifications
```python
STRATEGY_FUTURES_STRANGLE = {
    "name": "Futures Strangles",
    "underlyings": {
        "Phase 1": ["/MCL"],  # Micro crude only
        "Phase 2": ["/MCL", "/MGC"],  # Add micro gold
        "Phase 3": ["/MES", "/MCL", "/MGC"],  # Add micro S&P
        "Phase 4": ["/ES", "/CL", "/GC", "/SI"]  # Full size
    },
    "target_DTE": "45-60",
    "min_vix": 15,
    "max_vix": 40,
    "position_size": "7% of account max",
    "profit_target": "50% of credit",
    "stop_loss": "200% of credit",
    "management": "Defend tested side, close at 21 DTE"
}
```

### Entry Criteria
- 15 < VIX < 40
- Product has decent IV (check percentile)
- No existing strangle in same product
- Liquidity check (bid-ask < 10% of mid)

### Strike Selection
```python
# Strangle strikes using expected move
expected_move = underlying_price * (iv * sqrt(dte/365))

put_strike = underlying_price - (expected_move * 0.5)
call_strike = underlying_price + (expected_move * 0.4)

# Slightly closer calls (0.4 vs 0.5) because markets drift up
```

## 5. LEAP Put Ladders

### Specifications
```python
STRATEGY_LEAP_LADDERS = {
    "name": "LEAP Protective Put Ladder",
    "underlying": "SPY",
    "min_DTE": 365,
    "max_vix_entry": 40,
    "structure": "Long puts at different strikes",
    "position_size": "2-3% per rung",
    "total_allocation": "10-15% of portfolio",
    "management": "Hold as insurance, roll at 90 DTE",
    "purpose": "Portfolio protection"
}
```

### Entry Criteria
- VIX < 40 (don't buy expensive protection)
- Market not in panic mode
- Building gradually, not all at once
- Part of Phase 1+ requirements

### Ladder Structure
```python
# Build ladder over time
ladder_strikes = [
    current * 0.95,  # 5% OTM
    current * 0.90,  # 10% OTM
    current * 0.85,  # 15% OTM
    current * 0.80   # 20% OTM (disaster insurance)
]

# Add one rung per month
# Don't rush - this is long-term protection
```

## 6. Butterflies (Phase 3+)

### Specifications
```python
STRATEGY_BUTTERFLY = {
    "name": "Iron Butterfly",
    "underlying": "SPY",
    "target_DTE": "30-45",
    "min_phase": 3,
    "structure": "ATM butterfly",
    "max_debit": "$500 or 0.3% of account",
    "position_size": "One butterfly max",
    "profit_target": "Hold to expiration",
    "management": "Adjust wings if necessary"
}
```

### Setup
```python
# Iron butterfly structure
sell_atm_call = current_price
sell_atm_put = current_price
buy_otm_call = current_price + 10
buy_otm_put = current_price - 10

# Pin risk strategy - profit if SPY stays near current price
```

## 7. Calendar Spreads (Phase 3+)

### Specifications
```python
STRATEGY_CALENDAR = {
    "name": "Calendar Spread",
    "underlying": "SPY, IWM",
    "structure": "Long back month, short front month",
    "min_phase": 3,
    "ideal_vix": "< 20",
    "position_size": "5% of account",
    "management": "Roll short strike weekly"
}
```

## 8. Ratio Spreads (Phase 2+)

### Specifications
```python
STRATEGY_RATIO = {
    "name": "Put Ratio Spread",
    "ratios": {
        "Phase 2": "1:2",  # Buy 1, sell 2
        "Phase 3": "1:3",  # Buy 1, sell 3
        "Phase 4": "2:3"   # Buy 2, sell 3
    },
    "underlying": "SPY",
    "target_DTE": "45-60",
    "management": "Close if underlying approaches short strikes"
}
```

## 9. Diagonal Spreads (Phase 4)

### Specifications
```python
STRATEGY_DIAGONAL = {
    "name": "Diagonal Spread",
    "structure": "LEAP long, weekly short",
    "min_phase": 4,
    "underlying": "High IV stocks",
    "management": "Sell weekly against LEAP"
}
```

## 10. Emergency Hedges

### Specifications
```python
STRATEGY_EMERGENCY = {
    "name": "Emergency VIX Calls",
    "trigger": "VIX < 13 or major event coming",
    "structure": "Long VIX calls",
    "allocation": "1-2% of portfolio",
    "purpose": "Disaster insurance"
}
```

## Strategy Selection Logic

### Daily Decision Tree
```python
def select_todays_strategies(self):
    """Determine which strategies to trade today
    
    Not all strategies trade every day
    Selection based on market conditions
    """
    strategies_to_trade = []
    
    # Day of week check
    if self.is_friday():
        if self.vix > 22:
            strategies_to_trade.append("0DTE")
    
    # DTE checks for existing positions
    if self.check_lt112_opportunities():
        strategies_to_trade.append("LT112")
    
    # VIX regime checks
    if 15 < self.vix < 40:
        strategies_to_trade.append("FuturesStrangle")
    
    # IPMCC trades weekly regardless
    if self.has_shares_for_calls():
        strategies_to_trade.append("IPMCC")
    
    # Defensive checks
    if self.vix < 40 and self.need_more_protection():
        strategies_to_trade.append("LEAPLadder")
    
    return strategies_to_trade
```

## Summary

Each strategy has:
1. **Specific entry criteria** - Not forced, wait for setup
2. **Position sizing rules** - Based on risk and phase
3. **Management protocols** - Clear rules for adjustments
4. **Exit conditions** - Both profit and defensive
5. **Phase requirements** - Earned access to complexity

These specifications come from Tom King's 40 years of trading experience. Every rule exists because of a lesson learned, usually an expensive one.

**Follow the specifications exactly. They're written in lost money.**