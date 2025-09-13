# Testing Requirements for Tom King Trading Framework

## Overview
Comprehensive testing requirements to ensure the framework operates safely and correctly before production deployment.

## Unit Testing Requirements

### 1. State Machine Tests
Each strategy's state machine must be tested for:

#### Valid Transitions
```python
def test_valid_state_transitions():
    """Test all allowed state transitions"""
    # 0DTE State Machine
    assert can_transition("WAITING", "ENTERING")
    assert can_transition("ENTERING", "ACTIVE")
    assert can_transition("ACTIVE", "DEFENSIVE_EXIT")
    assert can_transition("ACTIVE", "MANAGING")
    assert can_transition("MANAGING", "EXITING")
    assert can_transition("EXITING", "COMPLETE")
```

#### Invalid Transitions
```python
def test_invalid_state_transitions():
    """Test blocked state transitions"""
    # Cannot skip states
    assert not can_transition("WAITING", "ACTIVE")
    assert not can_transition("WAITING", "COMPLETE")
    # Cannot go backwards (except ERROR)
    assert not can_transition("ACTIVE", "WAITING")
```

#### Error Recovery
```python
def test_error_state_recovery():
    """Test recovery from ERROR state"""
    # Any state can transition to ERROR
    for state in ALL_STATES:
        assert can_transition(state, "ERROR")
    # ERROR can transition to WAITING (reset)
    assert can_transition("ERROR", "WAITING")
```

### 2. Position Sizing Tests

#### Kelly Criterion Calculation
```python
def test_kelly_position_sizing():
    """Test Kelly Criterion with 0.25 factor"""
    metrics = {
        'win_rate': 0.70,
        'avg_win': 300,
        'avg_loss': 200
    }
    
    size = calculate_kelly_position_size(metrics)
    
    # Verify 0.25 factor applied
    assert size <= 0.10  # Max 10% per position
    assert size > 0  # Must be positive
```

#### Phase-Based Limits
```python
def test_phase_based_sizing():
    """Test position size limits by phase"""
    # Phase 1: Max 5%
    assert get_max_position_size(phase=1) == 0.05
    # Phase 2: Max 7%
    assert get_max_position_size(phase=2) == 0.07
    # Phase 3: Max 10%
    assert get_max_position_size(phase=3) == 0.10
    # Phase 4: Max 15%
    assert get_max_position_size(phase=4) == 0.15
```

### 3. Greeks Management Tests

#### Greeks Aggregation
```python
def test_greeks_aggregation():
    """Test portfolio Greeks calculation"""
    positions = [
        {'delta': -100, 'gamma': -5, 'theta': 50, 'vega': -100},
        {'delta': -50, 'gamma': -3, 'theta': 30, 'vega': -50}
    ]
    
    total = aggregate_greeks(positions)
    
    assert total['delta'] == -150
    assert total['gamma'] == -8
    assert total['theta'] == 80
    assert total['vega'] == -150
```

#### Phase-Based Greeks Limits
```python
def test_greeks_limits_by_phase():
    """Test Greeks limits enforcement"""
    # Phase 1 limits
    assert check_greeks_limit(phase=1, delta=-400) == False  # Exceeds -300
    assert check_greeks_limit(phase=1, delta=-250) == True   # Within limit
    
    # Phase 4 limits
    assert check_greeks_limit(phase=4, delta=-1100) == False  # Exceeds -1000
    assert check_greeks_limit(phase=4, delta=-900) == True    # Within limit
```

### 4. Risk Management Tests

#### 21 DTE Rule
```python
def test_21_dte_defensive_exit():
    """Test mandatory 21 DTE exit"""
    position = create_lt112_position(dte=22)
    assert should_exit(position) == False
    
    position = create_lt112_position(dte=21)
    assert should_exit(position) == True  # MUST EXIT
    
    position = create_lt112_position(dte=20)
    assert should_exit(position) == True  # MUST EXIT
```

#### SPY Concentration
```python
def test_spy_concentration_limits():
    """Test SPY exposure limits"""
    # Add positions until limit
    add_spy_position(delta=-300)
    add_spy_position(delta=-300)
    add_spy_position(delta=-300)
    
    # Next position should be blocked
    result = try_add_spy_position(delta=-300)
    assert result == False  # Blocked by concentration limit
```

#### Correlation Limits
```python
def test_correlation_limiter():
    """Test August 5 correlation protection"""
    # Add correlated positions
    add_position("SPY_put")
    add_position("ES_strangle")
    add_position("IWM_put")
    add_position("QQQ_put")
    add_position("SPX_put")
    
    # 6th position should be blocked
    result = add_position("another_equity_put")
    assert result == False  # Blocked by correlation limit
```

## Integration Testing Requirements

### 1. Multi-Strategy Coordination
```python
def test_strategy_coordination():
    """Test strategies coordinate properly"""
    # Initialize all strategies
    strategies = initialize_all_strategies()
    
    # Verify priority execution
    order = get_execution_order()
    assert order[0] == "0DTE"  # Highest priority
    assert order[-1] == "LEAPLadders"  # Lowest priority
    
    # Test resource allocation
    allocations = get_buying_power_allocation()
    assert sum(allocations.values()) <= 1.0  # Cannot exceed 100%
```

### 2. Atomic Order Execution
```python
def test_atomic_iron_condor():
    """Test all-or-nothing execution"""
    legs = [
        ("SPY_CALL_450", -10),
        ("SPY_CALL_455", 10),
        ("SPY_PUT_440", -10),
        ("SPY_PUT_435", 10)
    ]
    
    # Simulate partial fill scenario
    simulate_partial_fill(legs[0:2])  # Only 2 legs fill
    
    # Verify rollback occurred
    assert get_position_count() == 0  # All positions reversed
```

### 3. Emergency Procedures
```python
def test_circuit_breaker_activation():
    """Test circuit breakers halt trading"""
    # Simulate rapid drawdown
    simulate_portfolio_loss(0.04)  # 4% loss in 5 minutes
    
    # Verify trading halted
    assert is_trading_halted() == True
    assert get_system_state() == "EMERGENCY"
    
    # Verify all strategies stopped
    for strategy in get_all_strategies():
        assert strategy.state == "ERROR"
```

## Scenario Testing Requirements

### 1. August 5 Replay Test
```python
def test_august_5_scenario():
    """Test protection against August 5 repeat"""
    # Setup calm market
    set_vix(15)
    
    # Try to enter 14 positions
    for i in range(14):
        result = enter_position(f"position_{i}")
        if i >= 10:
            assert result == False  # Blocked by limits
    
    # Simulate VIX spike
    set_vix(65)
    
    # Verify emergency procedures
    assert is_trading_halted() == True
    assert positions_reduced() == True
```

### 2. Crash Recovery Test
```python
def test_crash_recovery():
    """Test recovery after system crash"""
    # Create positions
    create_active_positions()
    
    # Simulate crash
    crash_system()
    
    # Restart and verify recovery
    restart_system()
    
    # Check states restored
    for strategy in get_all_strategies():
        assert strategy.state != None  # State recovered
    
    # Check for partial fills
    incomplete = check_incomplete_orders()
    assert len(incomplete) == 0  # All cleaned up
```

### 3. Phase Transition Test
```python
def test_phase_advancement():
    """Test phase progression rules"""
    # Start Phase 1
    set_portfolio_value(35000)
    set_metrics(trades=19, win_rate=0.59)
    assert get_current_phase() == 1  # Not ready
    
    # Meet requirements
    set_portfolio_value(40000)
    set_metrics(trades=20, win_rate=0.60)
    assert get_current_phase() == 2  # Advanced
    
    # Test demotion on drawdown
    simulate_drawdown(0.25)
    assert get_current_phase() == 1  # Demoted
```

## Performance Testing Requirements

### 1. Backtest Validation
```python
def test_backtest_performance():
    """Validate strategy performance metrics"""
    results = run_backtest(
        start_date="2023-01-01",
        end_date="2024-01-01"
    )
    
    # Verify expected metrics
    assert results['win_rate'] >= 0.60
    assert results['max_drawdown'] <= 0.20
    assert results['sharpe_ratio'] >= 1.0
```

### 2. Stress Testing
```python
def test_stress_scenarios():
    """Test extreme market conditions"""
    scenarios = [
        "flash_crash",  # -5% in 5 minutes
        "vix_spike",    # VIX 15 to 50
        "correlation_1", # All positions correlate
        "liquidity_crisis"  # Wide bid-ask spreads
    ]
    
    for scenario in scenarios:
        result = run_stress_test(scenario)
        assert result['survived'] == True
        assert result['max_loss'] <= 0.30  # Max 30% loss
```

## Test Execution Checklist

### Before Production
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Scenario tests complete
- [ ] Backtest validation done
- [ ] Stress tests passed
- [ ] Paper trading for 30 days
- [ ] Manual code review
- [ ] Documentation complete

### Daily Testing (Production)
- [ ] State machine health check
- [ ] Greeks aggregation verify
- [ ] Position limits check
- [ ] Correlation monitor
- [ ] Circuit breaker test

## Test Coverage Requirements

### Minimum Coverage Targets
- State Machines: 100%
- Risk Management: 100%
- Position Sizing: 95%
- Order Execution: 95%
- Greeks Calculation: 90%
- Strategy Logic: 85%
- Overall: 90%

## Summary

Testing is critical for options trading systems where bugs can mean significant financial losses. Every test represents a potential disaster prevented.

Key testing principles:
1. **Test safety systems extensively** - They prevent account destruction
2. **Simulate real disasters** - August 5, flash crashes, etc.
3. **Verify all limits work** - Position, Greeks, correlation
4. **Test recovery procedures** - Crashes will happen
5. **Validate with real data** - Backtest with actual market data

**Never deploy without comprehensive testing. One bug can destroy years of profits.**