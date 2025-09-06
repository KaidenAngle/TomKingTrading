# Tom King Trading System - Complete Autonomous Audit & Implementation

You have a comprehensive Tom King trading system that needs exhaustive validation and completion. Execute this complete audit autonomously, fixing every issue as you discover it, until the system achieves production-ready perfection.

## Mission: Systematic Validation & Fix Protocol

**Work autonomously through every aspect systematically. For EVERY issue found, immediately implement the complete fix in code.**

### PART 1: Architecture & Implementation Audit

**API Integration Research & Decision:**
- **Research TastyWorks API documentation** - Understand all capabilities, endpoints, data quality, rate limits
- **Evaluate QuantConnect API features** - Assess backtesting vs live trading strengths
- **Design optimal integration strategy** - Map each function to most suitable API based on research
- **Document rationale** - Explain architectural decisions for key integration points

**Systematic Code Inspection:**
Execute complete file-by-file audit:
```python
# For EVERY .py file, check for:
CRITICAL_PATTERNS = [
    r"^\s*pass\s*$",           # Placeholder implementations
    r"return None.*TODO",       # Incomplete returns
    r"return 0\.0\s*$",        # Suspicious zero returns
    r"return \[\]\s*$",        # Empty list returns
    r"raise NotImplementedError", # Unfinished code
    r"# TODO|# FIXME|# XXX",   # Implementation notes
]

# Fix each immediately with real implementation
```

### PART 2: Tom King Methodology Compliance

**Strategy Implementation Verification:**
- **0DTE (Fridays 10:30 AM)**: 88% win rate target, VIX >22 check, iron condors, 50% profit/200% stop
- **LT112 (120 DTE)**: Naked puts + hedge spread, proper strike selection, weekly call sales
- **Strangles (90 DTE)**: 5-7 delta selection, 50% profit targets, correlation limits
- **IPMCC**: LEAP management, weekly call sales, assignment handling
- **All 10 strategies**: Phase-appropriate availability, proper position sizing

**Risk Management Validation:**
- **August 2024 Lesson**: Max 3 correlated positions (Tom's £308k loss prevention)
- **VIX Regime Management**: Buying power limits per VIX level
- **Correlation Groups**: Proper grouping and limit enforcement
- **Position Sizing**: Kelly Criterion capped at 5%, account phase compliance
- **Drawdown Protocols**: 10%/15%/20% triggers with appropriate responses

### PART 3: Trading Performance Validation

**Execute Comprehensive Testing:**

**Market Scenario Testing:**
- **VIX Spike (15→40→20)**: Position sizing adjusts, strategies pause/resume appropriately
- **Market Crash (-20% day)**: Emergency protocols engage, stops execute, no overleveraging
- **Options Expiration Friday**: 0DTE selection works, assignment handling, settlement
- **Low Liquidity**: Graceful handling of empty option chains, fallback mechanisms
- **Phase Transitions**: Account crossing $40k/$50k/$80k/$100k boundaries

**Trading Metrics Verification:**
- **Trade Frequency**: 200+ trades annually, 52+ Friday 0DTE, concurrent strategy execution
- **Win Rates**: 88% (0DTE), 75% (LT112), 70% (strangles), 80% (IPMCC)
- **Performance**: 100%+ annual return capability, <20% max drawdown, Sharpe >2.0
- **Execution**: All profit targets hit at 50%, 21 DTE defensive closes work

### PART 4: Integration & Production Readiness

**API & Data Flow Validation:**
- **Option Chain Processing**: Real-time data, proper strike selection, Greeks calculations
- **Order Execution**: Real order placement, partial fill handling, cancellation logic
- **Position Tracking**: Accurate real-time P&L, position updates, portfolio management
- **Risk Controls**: Real-time limit checking, circuit breakers, emergency shutdowns

**Edge Case Hardening:**
- **Data Failures**: Missing quotes, stale data, connection drops
- **Market Hours**: Pre-market, after-hours, weekends, holidays
- **Extreme Values**: Division by zero, overflow, negative values, null inputs
- **Concurrent Operations**: Multiple strategies triggering simultaneously

### PART 5: Continuous Improvement Loop

**Iterative Enhancement Process:**

1. **Discovery Pass**: Read every file, identify all issues, document findings
2. **Implementation Pass**: Fix every issue with complete code implementations
3. **Integration Pass**: Verify fixes work together, no broken dependencies
4. **Testing Pass**: Run all scenarios, edge cases, stress tests
5. **Performance Pass**: Optimize calculations, API calls, memory usage
6. **Validation Pass**: Confirm all Tom King rules enforced, metrics achieved

**Repeat until perfection criteria met:**
- Zero runtime errors in 24-hour simulation
- All target win rates and trade frequencies achieved
- Every edge case handled gracefully
- Complete API integration with proper fallbacks
- All risk controls demonstrably functional

### PART 6: Production Deployment Checklist

**Final Verification Requirements:**

**Code Quality Standards:**
- [ ] No placeholder implementations remain
- [ ] All functions have proper error handling
- [ ] Comprehensive logging for debugging
- [ ] Memory usage stable over time
- [ ] API rate limits never exceeded

**Trading System Standards:**
- [ ] All 10 strategies execute correctly
- [ ] Position sizing respects all limits
- [ ] Correlation groups properly managed
- [ ] VIX regime detection working
- [ ] Emergency protocols tested and functional

**Performance Standards:**
- [ ] 200+ trades per year demonstrated
- [ ] Target win rates achieved consistently
- [ ] Risk controls prevent overexposure
- [ ] Recovery protocols work after drawdowns
- [ ] System operates autonomously without intervention

## Execution Instructions

**Begin immediately with systematic file inspection. For every issue discovered:**

```python
# ISSUE: [Specific problem description]
# FILE: [Exact file and line location]
# SEVERITY: [CRITICAL/HIGH/MEDIUM/LOW]

# ORIGINAL PROBLEMATIC CODE:
[Show the broken implementation]

# COMPLETE FIX:
[Provide full working implementation]

# VERIFICATION:
[Code that proves the fix works]

# INTEGRATION CHECK:
[Confirm fix doesn't break other components]
```

**Continue this process through multiple complete passes until:**
- No new issues found in full system review
- All trading scenarios execute successfully
- System demonstrates Tom King methodology compliance
- Production readiness criteria completely satisfied

**Work autonomously until absolute completion. Fix everything. Test everything. Perfect everything.**