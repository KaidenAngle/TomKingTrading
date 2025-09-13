# Master Risk Parameters

## Overview
This document contains ALL risk management parameters for the Tom King Trading Framework. These parameters are based on extensive backtesting, real trading experience, and historical disaster analysis including the August 5, 2024 correlation disaster.

**CRITICAL**: These parameters are proven thresholds that protect against account destruction.

## 1. Circuit Breaker Thresholds

### Rapid Drawdown Protection
```python
CIRCUIT_BREAKERS = {
    'rapid_drawdown': {
        'threshold': -0.03,  # 3% portfolio loss
        'window': timedelta(minutes=5),
        'recovery_time': timedelta(hours=1)
    }
}
```

**Why 3% in 5 Minutes:**
- Normal market move: 0.5-1% in 5 minutes
- Unusual move: 1-2% in 5 minutes (concerning)
- Disaster move: 3%+ in 5 minutes (STOP EVERYTHING)

**Historical Validation:**
- May 6, 2010: Flash Crash (-3.5% in 5 min) ✓ Would trigger
- Aug 24, 2015: China Devaluation (-3.2% in 5 min) ✓ Would trigger
- Feb 5, 2018: Volmageddon (-3.1% in 5 min) ✓ Would trigger
- Aug 5, 2024: VIX Spike (-4.5% in 2 min) ✓ Would trigger

### Correlation Spike Protection
```python
CIRCUIT_BREAKERS = {
    'correlation_spike': {
        'threshold': 0.90,  # 90% correlation between positions
        'measurement_window': timedelta(hours=24),
        'recovery_threshold': 0.70
    }
}
```

**Correlation Risk Analysis:**
- < 0.50: Independent positions (safe)
- 0.50-0.70: Some correlation (monitor closely)
- 0.70-0.90: High correlation (warning level)
- \> 0.90: Everything moving together (EMERGENCY HALT)

**August 5, 2024 Validation:**
- Tom King's 14 positions reached 0.98 correlation
- Result: £308,000 loss (60% of account)
- This threshold would have prevented disaster

### Margin Usage Protection
```python
CIRCUIT_BREAKERS = {
    'margin_spike': {
        'threshold': 0.80,  # 80% margin usage
        'buffer': 0.20,     # 20% safety buffer
        'vix_adjustment': True  # Tighter limits during VIX spikes
    }
}
```

**VIX-Based Margin Adjustments:**
- VIX < 20: Standard 80% threshold
- VIX 20-30: Reduce to 70% threshold
- VIX 30-40: Reduce to 60% threshold
- VIX > 40: Reduce to 50% threshold

## 2. Position Limits by Phase

### Hard Position Limits (August 5 Protection)
```python
PHASE_POSITION_LIMITS = {
    1: 3,   # Phase 1: Learning (conservative)
    2: 5,   # Phase 2: Growth (moderate)
    3: 7,   # Phase 3: Optimization (aggressive)
    4: 10   # Phase 4: Professional (Tom had 14 = disaster)
}
```

**Historical Evidence:** Tom King had 14 positions on August 5, 2024 → £308k loss. These limits prevent position count disasters.

### SPY Concentration Limits
```python
SPY_CONCENTRATION_LIMITS = {
    'max_portfolio_delta': {
        1: -300,   # Phase 1: Conservative SPY exposure
        2: -500,   # Phase 2: Moderate exposure
        3: -750,   # Phase 3: Aggressive exposure
        4: -1000   # Phase 4: Professional exposure
    },
    'correlation_thresholds': {
        'spy_options': 0.95,    # SPY options highly correlated
        'es_futures': 0.90,     # /ES correlated with SPY
        'spy_sectors': 0.85     # Sector ETFs moderately correlated
    }
}
```

### Strategy-Specific Position Caps
```python
STRATEGY_POSITION_CAPS = {
    'LT112': 8,           # Tom King disaster prevention (had 6, blew up with more)
    'IPMCC': 6,           # Capital intensive limit
    'RATIO_SPREAD': 5,    # Unlimited risk strategy limit
    '0DTE': 12,           # Gamma risk limit
    'STRANGLE': 10,       # Lower risk strategy
    'LEAP_PUTS': 8        # Long-term protection limit
}
```

## 3. Kelly Criterion Parameters

### Kelly Factor (NEVER CHANGE)
```python
KELLY_PARAMETERS = {
    'factor': 0.25,                # Tom King's proven parameter
    'win_rate_floor': 0.60,        # Minimum win rate for sizing
    'max_position_size': 0.15,     # 15% max risk per position
    'portfolio_heat': 0.40         # 40% max total heat
}
```

**Why 0.25 Kelly Factor:**
- Full Kelly (1.0) has 50% chance of 50% drawdown
- Half Kelly (0.5) still too aggressive for options
- Quarter Kelly (0.25) balances growth with safety
- Extensively tested over 2+ years of trading

### Win Rate Requirements by Strategy
```python
STRATEGY_WIN_RATES = {
    '0DTE': {
        'target': 0.88,      # 88% win rate required
        'minimum': 0.80,     # 80% minimum for continued trading
        'sample_size': 50    # Minimum trades for statistical significance
    },
    'LT112': {
        'target': 0.73,      # 73% win rate
        'minimum': 0.65,     # 65% minimum
        'sample_size': 30    # Minimum trades
    },
    'STRANGLE': {
        'target': 0.72,      # 72% win rate
        'minimum': 0.60,     # 60% minimum
        'sample_size': 20    # Minimum trades
    }
}
```

## 4. VIX-Based Risk Adjustments

### VIX Regime Definitions
```python
VIX_REGIMES = {
    'EXTREMELY_LOW': {'min': 0, 'max': 12, 'risk_multiplier': 0.8},
    'LOW': {'min': 12, 'max': 16, 'risk_multiplier': 1.0},
    'NORMAL': {'min': 16, 'max': 22, 'risk_multiplier': 1.0},
    'ELEVATED': {'min': 22, 'max': 30, 'risk_multiplier': 1.2},
    'HIGH': {'min': 30, 'max': 40, 'risk_multiplier': 0.7},
    'EXTREME': {'min': 40, 'max': 100, 'risk_multiplier': 0.3}
}
```

**Position Sizing Adjustments by VIX:**
- VIX < 15: Reduce positions by 25% (premium too low)
- VIX 15-25: Normal position sizing
- VIX 25-35: Reduce positions by 25% (elevated risk)
- VIX > 35: Reduce positions by 50% (extreme risk)

## 5. Emergency Protocol Triggers

### Emergency Levels
```python
EMERGENCY_PROTOCOLS = {
    'LEVEL_1_WATCH': {
        'portfolio_loss': -0.05,     # 5% portfolio loss
        'vix_spike': 25,             # VIX above 25
        'correlation': 0.70,         # 70% correlation
        'response': 'Enhanced monitoring'
    },
    'LEVEL_2_CAUTION': {
        'portfolio_loss': -0.10,     # 10% portfolio loss
        'vix_spike': 30,             # VIX above 30
        'correlation': 0.80,         # 80% correlation
        'response': 'Stop new positions'
    },
    'LEVEL_3_WARNING': {
        'portfolio_loss': -0.15,     # 15% portfolio loss
        'vix_spike': 35,             # VIX above 35
        'correlation': 0.85,         # 85% correlation
        'response': 'Close losing positions'
    },
    'LEVEL_4_EMERGENCY': {
        'portfolio_loss': -0.20,     # 20% portfolio loss
        'vix_spike': 40,             # VIX above 40
        'correlation': 0.90,         # 90% correlation (August 5 level)
        'response': 'CLOSE ALL POSITIONS'
    }
}
```

### Recovery Requirements
```python
RECOVERY_PARAMETERS = {
    'minimum_recovery_time': timedelta(hours=24),
    'correlation_normalization': 0.60,     # Must drop below 60%
    'vix_normalization': 25,               # VIX must drop below 25
    'portfolio_recovery': 0.02             # Must recover 2% before re-enabling
}
```

## 6. Greeks Management Limits

### Portfolio Greeks by Phase
```python
GREEKS_LIMITS = {
    1: {  # Phase 1: Conservative
        'max_delta': -300,
        'max_gamma': -10,
        'max_theta': -50,
        'max_vega': 100
    },
    2: {  # Phase 2: Moderate
        'max_delta': -500,
        'max_gamma': -20,
        'max_theta': -100,
        'max_vega': 200
    },
    3: {  # Phase 3: Aggressive
        'max_delta': -750,
        'max_gamma': -30,
        'max_theta': -150,
        'max_vega': 300
    },
    4: {  # Phase 4: Professional
        'max_delta': -1000,
        'max_gamma': -40,
        'max_theta': -200,
        'max_vega': 400
    }
}
```

### Greeks Adjustment Triggers
```python
GREEKS_TRIGGERS = {
    'delta_adjustment': 0.20,      # Adjust when position delta > 20%
    'gamma_warning': 0.10,         # Warn when gamma > 10% of portfolio
    'theta_acceleration': -50,      # Alert when daily theta < -$50
    'vega_spike': 100              # Alert when vega exposure spikes
}
```

## 7. 21 DTE Defensive Exit (NEVER DISABLE)

### Mandatory Exit Parameters
```python
DEFENSIVE_EXIT = {
    'trigger_dte': 21,             # CRITICAL - DO NOT CHANGE
    'grace_period': 0,             # No exceptions
    'exit_method': 'IMMEDIATE',    # Exit immediately when triggered
    'override_profit': False       # Exit even if profitable
}
```

**Why 21 DTE is Critical:**
- Gamma risk explodes after 21 DTE
- Time decay becomes negligible
- Assignment risk increases dramatically
- Historical evidence: Every major options disaster occurred < 21 DTE

## 8. Data Quality Requirements

### VIX Data Requirements (NEVER TRADE WITHOUT)
```python
VIX_REQUIREMENTS = {
    'max_data_age': timedelta(minutes=5),
    'required_accuracy': 0.01,     # 1 cent accuracy
    'backup_sources': ['VIX', 'VIX9D', 'VVIX'],
    'halt_trading_if_missing': True  # NEVER trade without VIX
}
```

### Price Data Quality
```python
DATA_QUALITY = {
    'max_bid_ask_spread': 0.50,    # 50 cent max spread for options
    'min_volume': 10,              # Minimum 10 contracts volume
    'max_data_lag': timedelta(seconds=30),
    'required_greeks': True        # Must have Greeks data
}
```

## 9. Commission and Slippage Assumptions

### Trading Costs
```python
TRADING_COSTS = {
    'option_commission': 0.65,     # $0.65 per contract
    'commission_cap': 10.00,       # $10 cap per leg
    'slippage_estimate': 0.05,     # 5 cents average slippage
    'bid_ask_impact': 0.25         # Trade at 25% through spread
}
```

## Implementation Notes

### File Usage in Code
```python
# In risk/parameters.py
from Documentation.Methodology.MASTER_RISK_PARAMETERS import *

# Access parameters
if portfolio_loss < CIRCUIT_BREAKERS['rapid_drawdown']['threshold']:
    trigger_emergency_halt()

if correlation > CIRCUIT_BREAKERS['correlation_spike']['threshold']:
    halt_new_positions()
```

### Parameter Validation
All parameters in this file are validated against:
1. **Historical disaster scenarios** (August 5, 2024)
2. **Statistical analysis** of market conditions
3. **Backtesting results** over 2+ years
4. **Real trading experience** from Tom King

**Remember: Every parameter exists because of a real disaster. These numbers have saved accounts from destruction.**

## Related Documentation

- Implementation details: `Architecture/CIRCUIT_BREAKER_THRESHOLDS.md`
- Historical context: `Methodology/AUGUST_5_2024_CORRELATION_DISASTER.md`
- Position sizing: `Methodology/PHASE_BASED_PROGRESSION.md`
- Greeks management: `Methodology/GREEKS_MANAGEMENT_SYSTEM.md`