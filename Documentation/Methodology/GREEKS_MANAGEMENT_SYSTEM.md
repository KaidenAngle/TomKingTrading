# Greeks Management System

## Overview
Greeks limits are PHASE-BASED, not fixed. As the portfolio grows and proves success, Greeks limits expand. This prevents overexposure during learning phases.

## Phase-Based Greeks Limits

### Phase 1: Foundation (£30-40k / $30-40k)
```python
PHASE_1_GREEKS = {
    "delta": -300,   # Conservative directional exposure
    "gamma": -10,    # Minimal acceleration risk
    "theta": +100,   # Small daily decay income
    "vega": -500     # Limited volatility exposure
}
```

### Phase 2: Scaling (£40-60k / $40-60k)
```python
PHASE_2_GREEKS = {
    "delta": -500,   # Moderate directional exposure
    "gamma": -20,    # Controlled acceleration
    "theta": +200,   # Growing decay income
    "vega": -750     # Increased vol exposure
}
```

### Phase 3: Optimization (£60-75k / $60-75k)
```python
PHASE_3_GREEKS = {
    "delta": -750,   # Aggressive directional trades
    "gamma": -30,    # Higher gamma tolerance
    "theta": +350,   # Significant decay income
    "vega": -1000    # Full volatility trading
}
```

### Phase 4: Professional (£75k+ / $75k+)
```python
PHASE_4_GREEKS = {
    "delta": -1000,  # Maximum directional exposure
    "gamma": -40,    # Full gamma utilization
    "theta": +500,   # Maximum decay harvesting
    "vega": -1500    # Complete vol strategies
}
```

## Why Phase-Based Limits?

### The Problem with Fixed Limits
```python
# WRONG - Fixed limits regardless of experience
MAX_DELTA = -1000  # Too much for beginners, too little for pros
```

### The Solution: Progressive Limits
```python
def get_greeks_limits(self) -> Dict:
    """Get current phase Greeks limits
    
    IMPORTANT: Phase-based limits prevent overexposure during learning
    DO NOT SKIP PHASES - Each phase teaches critical lessons
    """
    portfolio_value = self.Portfolio.TotalPortfolioValue
    
    if portfolio_value < 40000:
        return PHASE_1_GREEKS
    elif portfolio_value < 60000:
        return PHASE_2_GREEKS
    elif portfolio_value < 75000:
        return PHASE_3_GREEKS
    else:
        return PHASE_4_GREEKS
```

## Greeks by Strategy

### 0DTE Friday Iron Condor
```
Typical Greeks (per IC):
├─ Delta: -10 to +10 (neutral)
├─ Gamma: -5 to -10 (negative)
├─ Theta: +50 to +100 (positive)
└─ Vega: -100 to -200 (negative)

Why: Theta harvesting strategy, needs negative gamma
```

### LT112 Put Spreads
```
Typical Greeks (per spread):
├─ Delta: -100 to -150 (bullish)
├─ Gamma: -2 to -5 (slightly negative)
├─ Theta: +20 to +40 (positive)
└─ Vega: -50 to -100 (negative)

Why: Long-term bullish bias with theta collection
```

### Futures Strangles
```
Typical Greeks (per strangle):
├─ Delta: -20 to +20 (neutral)
├─ Gamma: -10 to -15 (negative)
├─ Theta: +30 to +60 (positive)
└─ Vega: -200 to -400 (very negative)

Why: Premium collection in high IV environments
```

## Greeks Risk Management

### Delta Risk (Directional)
```python
def check_delta_risk(self) -> bool:
    """Monitor directional exposure
    
    Delta measures directional risk
    Too much delta = market moves hurt badly
    """
    total_delta = self.greeks_monitor.get_portfolio_delta()
    limit = self.get_greeks_limits()['delta']
    
    if abs(total_delta) > abs(limit):
        self.Error(f"DELTA LIMIT EXCEEDED: {total_delta} vs {limit}")
        return False
    
    # Warning at 80%
    if abs(total_delta) > abs(limit) * 0.8:
        self.Debug(f"Delta warning: {total_delta} approaching {limit}")
    
    return True
```

### Gamma Risk (Acceleration)
```python
def check_gamma_risk(self) -> bool:
    """Monitor gamma exposure
    
    Gamma is the KILLER in final week
    After 21 DTE, gamma explodes
    """
    # Check individual positions for gamma bombs
    for symbol, position in self.Portfolio.items():
        if position.Symbol.SecurityType == SecurityType.Option:
            dte = self.calculate_dte(position.Symbol)
            
            if dte <= 21 and position.Greeks.Gamma < -5:
                self.Error(f"GAMMA BOMB: {symbol} at {dte} DTE")
                # Force exit - Tom King's 21 DTE rule
                return False
    
    return True
```

### Theta Harvesting
```python
def calculate_daily_theta(self) -> float:
    """Calculate expected daily decay income
    
    Theta is our income engine
    But too much theta means too much risk
    """
    total_theta = self.greeks_monitor.get_portfolio_theta()
    
    # Theta/Delta ratio check
    total_delta = self.greeks_monitor.get_portfolio_delta()
    if total_delta != 0:
        theta_delta_ratio = total_theta / abs(total_delta)
        
        if theta_delta_ratio < 0.2:
            self.Debug("Warning: Poor theta/delta ratio")
    
    return total_theta
```

### Vega Management
```python
def check_vega_exposure(self) -> bool:
    """Monitor volatility exposure
    
    Negative vega = hurt by volatility spike
    Critical during market events
    """
    total_vega = self.greeks_monitor.get_portfolio_vega()
    vix = self.vix_manager.get_current_vix()
    
    # Reduce vega exposure when VIX is low
    if vix < 15 and total_vega < -1000:
        self.Error("High vega risk in low VIX environment")
        return False
    
    return True
```

## Greeks Aggregation Across Strategies

### Portfolio-Level Monitoring
```python
class GreeksMonitor:
    def get_portfolio_greeks(self) -> Dict:
        """Aggregate Greeks across all positions
        
        IMPORTANT: Sum ALL positions, not just active strategies
        Forgotten positions can blow up accounts
        """
        greeks = {
            'delta': 0,
            'gamma': 0,
            'theta': 0,
            'vega': 0
        }
        
        for symbol in self.algo.Portfolio.Keys:
            holding = self.algo.Portfolio[symbol]
            
            if holding.Invested and symbol.SecurityType == SecurityType.Option:
                contract = self.algo.Securities[symbol]
                
                # Multiply by position size and multiplier
                quantity = holding.Quantity
                multiplier = 100  # Standard option multiplier
                
                greeks['delta'] += contract.Greeks.Delta * quantity * multiplier
                greeks['gamma'] += contract.Greeks.Gamma * quantity * multiplier
                greeks['theta'] += contract.Greeks.Theta * quantity * multiplier
                greeks['vega'] += contract.Greeks.Vega * quantity * multiplier
        
        return greeks
```

## Common Greeks Mistakes

### Mistake 1: Ignoring Gamma After 21 DTE
**Reality**: Gamma doubles every few days in final weeks

### Mistake 2: Chasing Theta Without Checking Delta
**Reality**: High theta usually means high directional risk

### Mistake 3: Fixed Greeks Limits
**Reality**: Beginners can't handle same Greeks as professionals

### Mistake 4: Not Aggregating Across Strategies
**Reality**: Total portfolio Greeks is what matters

## Greeks Dashboard Display

### What to Show
```python
def format_greeks_display(self) -> str:
    """Format Greeks for dashboard
    
    Show both current and limits
    Color code by risk level
    """
    greeks = self.get_portfolio_greeks()
    limits = self.get_greeks_limits()
    
    display = "Portfolio Greeks:\n"
    
    for greek in ['delta', 'gamma', 'theta', 'vega']:
        current = greeks[greek]
        limit = limits[greek]
        usage = abs(current / limit) if limit != 0 else 0
        
        # Color coding
        if usage > 0.9:
            status = "🔴"  # Red - at limit
        elif usage > 0.7:
            status = "🟡"  # Yellow - warning
        else:
            status = "🟢"  # Green - safe
        
        display += f"{status} {greek.title()}: {current:.1f} / {limit} ({usage:.0%})\n"
    
    return display
```

## Testing Greeks Management

### Unit Tests Required
- Greeks calculation accuracy
- Aggregation across positions
- Phase-based limit transitions
- Warning triggers at 80%
- Forced exits at limits

### Scenarios to Test
1. **Gamma explosion** - Position approaching 21 DTE
2. **Delta concentration** - Multiple bullish positions
3. **Vega spike** - VIX jumps with negative vega
4. **Phase transition** - Limits adjust with portfolio growth

## Summary

Greeks management is **critical risk infrastructure** that:

1. **Prevents overexposure** through phase-based limits
2. **Monitors acceleration risk** (gamma bombs)
3. **Tracks income generation** (theta harvesting)
4. **Manages volatility exposure** (vega risk)
5. **Aggregates across strategies** (total portfolio risk)

The phase-based approach ensures traders don't take professional-level risk with beginner-level experience.

**Greeks limits are guardrails, not suggestions.**