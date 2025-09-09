# Backtest Scenarios for Tom King Trading Framework

## Overview
Critical backtest scenarios that must be validated before production deployment. Each scenario tests specific risk conditions and strategy behaviors.

## Historical Event Backtests

### 1. August 5, 2024 - VIX Spike Scenario
```python
AUGUST_5_BACKTEST = {
    "start_date": "2024-07-01",
    "end_date": "2024-08-31",
    "focus_date": "2024-08-05",
    "expected_behavior": {
        "pre_spike": "Normal position entry",
        "spike_day": "Circuit breakers activate",
        "max_loss": "< 20% with protections",
        "recovery": "Gradual re-entry"
    }
}
```

### 2. March 2020 - COVID Crash
```python
COVID_CRASH_BACKTEST = {
    "start_date": "2020-02-01",
    "end_date": "2020-04-30",
    "expected_behavior": {
        "vix_spike_response": "Halt at VIX > 50",
        "position_reduction": "Automatic scaling down",
        "leap_protection": "Should limit losses",
        "recovery_entry": "Phase 1 restart"
    }
}
```

### 3. December 2018 - Fed Tightening
```python
FED_TIGHTENING_BACKTEST = {
    "start_date": "2018-11-01",
    "end_date": "2019-01-31",
    "expected_behavior": {
        "gradual_decline": "21 DTE exits save capital",
        "correlation_protection": "Limit related positions",
        "phase_demotion": "Reduce risk automatically"
    }
}
```

## Strategy-Specific Backtests

### 0DTE Friday Iron Condor
```python
def backtest_0dte_scenarios():
    """Test 0DTE in various market conditions"""
    
    scenarios = [
        {
            "name": "Trending Friday",
            "condition": "SPY +2% by noon",
            "expected": "Defensive exit triggered",
            "max_loss": "200% of credit"
        },
        {
            "name": "Flat Friday",
            "condition": "SPY ±0.5% all day",
            "expected": "Profit target hit",
            "profit": "50% of credit"
        },
        {
            "name": "Gap Open Friday",
            "condition": "SPY gaps 1.5%",
            "expected": "Skip entry",
            "action": "No trade"
        },
        {
            "name": "VIX < 22 Friday",
            "condition": "Low volatility",
            "expected": "No entry allowed",
            "action": "Strategy skipped"
        }
    ]
```

### LT112 Put Spreads
```python
def backtest_lt112_scenarios():
    """Test LT112 management rules"""
    
    scenarios = [
        {
            "name": "Profitable at 45 DTE",
            "condition": "50% profit at 45 DTE",
            "expected": "Close position",
            "result": "Target achieved"
        },
        {
            "name": "Underwater at 21 DTE",
            "condition": "-30% at 21 DTE",
            "expected": "MANDATORY EXIT",
            "result": "Loss limited by rule"
        },
        {
            "name": "Market crash at 60 DTE",
            "condition": "SPY -10% move",
            "expected": "Hold unless -100% loss",
            "result": "Weather the storm"
        }
    ]
```

### Futures Strangles
```python
def backtest_strangle_scenarios():
    """Test strangle management"""
    
    scenarios = [
        {
            "name": "Oil spike",
            "condition": "/CL +15% in week",
            "expected": "Defend put side",
            "action": "Roll or close puts"
        },
        {
            "name": "Range bound",
            "condition": "No movement 30 days",
            "expected": "Collect full premium",
            "profit": "Maximum theta decay"
        },
        {
            "name": "Volatility collapse",
            "condition": "IV drops 50%",
            "expected": "Quick profit",
            "action": "Close at 50% profit"
        }
    ]
```

## Risk Scenario Backtests

### Correlation Event Testing
```python
def backtest_correlation_events():
    """Test correlation protection"""
    
    test_dates = [
        "2024-08-05",  # August 5 disaster
        "2020-03-16",  # COVID crash
        "2018-02-05",  # Volmageddon
        "2015-08-24",  # China devaluation
    ]
    
    for date in test_dates:
        results = run_backtest(
            date=date,
            window=(-5, +5)  # 5 days before/after
        )
        
        assert results['correlation_protection_triggered'] == True
        assert results['max_positions_during_event'] <= 5
        assert results['portfolio_loss'] < 0.30  # Max 30% loss
```

### Phase Transition Testing
```python
def backtest_phase_progression():
    """Test phase advancement and demotion"""
    
    # Start with $30k in Phase 1
    initial_capital = 30000
    
    scenarios = [
        {
            "performance": "winning_streak",
            "expected_path": [1, 1, 2, 2, 3, 3, 4],
            "time_frame": "12 months"
        },
        {
            "performance": "mixed_results",
            "expected_path": [1, 1, 2, 2, 2, 3, 3],
            "time_frame": "12 months"
        },
        {
            "performance": "drawdown_event",
            "expected_path": [1, 2, 2, 1, 1, 2, 2],
            "time_frame": "12 months"
        }
    ]
```

### Greeks Limit Testing
```python
def backtest_greeks_limits():
    """Test Greeks-based risk limits"""
    
    test_scenarios = [
        {
            "setup": "Low VIX environment",
            "vix": 12,
            "expected": "Reduced position sizes",
            "max_vega": -500
        },
        {
            "setup": "High VIX environment",
            "vix": 35,
            "expected": "Vega limits enforced",
            "max_vega": -1500
        },
        {
            "setup": "21 DTE gamma bomb",
            "position_dte": 21,
            "expected": "Force exit",
            "gamma_limit": -5
        }
    ]
```

## Performance Validation Backtests

### Expected Metrics by Phase
```python
PHASE_PERFORMANCE_TARGETS = {
    "Phase 1": {
        "win_rate": 0.60,
        "avg_monthly": 0.02,  # 2%
        "max_drawdown": 0.10,
        "sharpe_ratio": 0.8
    },
    "Phase 2": {
        "win_rate": 0.65,
        "avg_monthly": 0.025,  # 2.5%
        "max_drawdown": 0.12,
        "sharpe_ratio": 1.0
    },
    "Phase 3": {
        "win_rate": 0.70,
        "avg_monthly": 0.03,  # 3%
        "max_drawdown": 0.15,
        "sharpe_ratio": 1.2
    },
    "Phase 4": {
        "win_rate": 0.70,
        "avg_monthly": 0.03,  # 3%
        "max_drawdown": 0.20,
        "sharpe_ratio": 1.5
    }
}
```

### Long-Term Performance Test
```python
def backtest_five_year_performance():
    """Test 5-year performance expectations"""
    
    results = run_backtest(
        start="2019-01-01",
        end="2024-01-01",
        initial_capital=30000
    )
    
    assert results['total_return'] > 2.0  # 100%+ over 5 years
    assert results['max_drawdown'] < 0.25  # Never exceed 25%
    assert results['win_rate'] >= 0.65
    assert results['phase_achieved'] >= 3  # Should reach Phase 3+
```

## Backtest Configuration

### Required Data
```python
BACKTEST_DATA_REQUIREMENTS = {
    "price_data": ["SPY", "ES", "CL", "GC", "VIX"],
    "options_data": "Full chain with Greeks",
    "resolution": "Minute bars minimum",
    "history": "5 years minimum",
    "events": "FOMC, earnings, economic calendar"
}
```

### Slippage and Fees
```python
REALISTIC_COSTS = {
    "option_commission": 0.65,  # Per contract
    "slippage": {
        "SPY": 0.05,  # $0.05 per contract
        "ES": 0.25,   # $0.25 per contract
        "Futures": 0.10  # Ticks
    },
    "assignment_fee": 15.00,
    "exercise_fee": 15.00
}
```

## Validation Criteria

### Must Pass All Scenarios
1. **No single day loss > 30%** - Circuit breakers work
2. **Win rate >= 60%** - Strategy edge maintained
3. **Max drawdown < 25%** - Risk management effective
4. **Recovery time < 6 months** - Can bounce back
5. **All safety rules triggered** - 21 DTE, correlation, etc.

### Red Flags in Backtesting
- Win rate > 90% - Likely overfit
- No losing months - Unrealistic
- Smooth equity curve - Missing volatility
- Better than expected - Check for bugs

## Running the Backtests

### Priority Order
1. **August 5, 2024** - Most recent disaster
2. **COVID Crash** - Extreme volatility test
3. **5-Year Performance** - Long-term validation
4. **Phase Progression** - Growth simulation
5. **Strategy-Specific** - Individual validation

### Interpretation Guidelines
```python
def interpret_backtest_results(results):
    """How to interpret backtest results"""
    
    if results['max_drawdown'] > 0.25:
        return "FAIL: Risk management inadequate"
    
    if results['win_rate'] < 0.60:
        return "FAIL: Strategy edge insufficient"
    
    if results['august_5_loss'] > 0.30:
        return "FAIL: Correlation protection failed"
    
    if results['phase_4_achieved'] and results['ending_capital'] > 75000:
        return "PASS: System performs as designed"
    
    return "REVIEW: Check specific metrics"
```

## Summary

Backtesting must validate:
1. **Safety systems work** - Circuit breakers, limits, rules
2. **Strategies profitable** - Each strategy has positive expectancy
3. **Risk managed** - Drawdowns contained, recovery possible
4. **Phases progress** - Natural growth through phases
5. **Disasters survived** - August 5, COVID, etc.

**Never trust a backtest that looks too good. The market is harder than any backtest.**