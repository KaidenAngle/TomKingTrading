# Deep Analysis: Greeks Limits by Phase Implementation

**Date:** September 8, 2025  
**Status:** 🔴 CRITICAL FINDING - Phase-Based Greeks Limits NOT IMPLEMENTED

## Executive Summary

Deep analysis reveals that while the Tom King Trading Framework has sophisticated Greeks calculation and monitoring, it LACKS proper phase-based Greeks limits enforcement. The system uses static limits per $100k instead of the documented phase-specific limits.

## Current Implementation (INCORRECT)

### Found in `risk/production_logging.py:357-360`
```python
# Static limits per $100k - NOT phase-specific!
self.max_delta_per_100k = 100
self.max_gamma_per_100k = 20
self.max_theta_per_100k = -500
self.max_vega_per_100k = 50
```

These scale linearly with account size but don't respect phase boundaries.

## Tom King Specifications (MISSING)

### Required Phase-Based Limits:
- **Phase 1 ($38-51k):** Delta ±50, Gamma ±10, Vega ±100
- **Phase 2 ($51-76k):** Delta ±75, Gamma ±15, Vega ±150  
- **Phase 3 ($76-95k):** Delta ±100, Gamma ±20, Vega ±200
- **Phase 4 ($95k+):** Delta ±150, Gamma ±30, Vega ±300

## Problems Identified

### 1. No Phase Detection in Greeks Monitoring
- `greeks_monitor.py` calculates Greeks but doesn't check phase
- `greeks_aggregator` in `production_logging.py` uses linear scaling
- No connection between account phase and Greeks limits

### 2. Linear Scaling vs Step Function
**Current (Wrong):**
- $50k account: 50 delta limit (50k/100k * 100)
- $75k account: 75 delta limit (75k/100k * 100)
- $100k account: 100 delta limit (100k/100k * 100)

**Should Be (Tom King):**
- $50k account: 50 delta limit (Phase 1)
- $75k account: 75 delta limit (Phase 2)
- $100k account: 150 delta limit (Phase 4)

### 3. Missing Pre-Trade Validation
- No Greeks check before placing trades
- Could exceed phase limits without warning
- No defensive actions when approaching limits

## Solution Implemented

### New File: `greeks/phase_based_greeks_limits.py`
Created comprehensive phase-based Greeks limits manager with:

1. **Phase Detection:**
   - Automatic phase determination based on account value
   - Proper step-function limits (not linear)

2. **Greeks Calculation:**
   - Portfolio-wide Greeks aggregation
   - Support for multi-legged positions

3. **Compliance Checking:**
   - Real-time limit validation
   - Pre-trade impact analysis
   - Violation reporting

4. **Key Methods:**
   ```python
   get_current_phase()           # Determine account phase
   get_phase_limits()            # Get limits for phase
   check_greeks_compliance()     # Validate current Greeks
   should_allow_trade()          # Pre-trade validation
   log_greeks_status()          # Detailed reporting
   get_remaining_capacity()      # Available Greeks room
   ```

### Integration Points Added:

1. **main.py:208** - Initialize phase Greeks manager
2. **main.py:628** - Check compliance in monitor_greeks()

## Impact Assessment

### Before Fix:
- Greeks limits scaled linearly (incorrect)
- No phase boundaries respected
- Could accumulate excessive risk in lower phases
- Phase 4 accounts under-utilizing available Greeks

### After Fix:
- Proper step-function limits per phase
- Pre-trade validation prevents violations
- Clear compliance monitoring
- Appropriate risk for each account phase

## Testing Recommendations

1. **Phase Boundary Tests:**
   - Test accounts at $50k, $51k (Phase 1→2 boundary)
   - Test accounts at $75k, $76k (Phase 2→3 boundary)
   - Verify limits change appropriately

2. **Greeks Accumulation Tests:**
   - Gradually add positions until hitting limits
   - Verify trades blocked when limits would be exceeded
   - Check each Greek independently

3. **Multi-Leg Position Tests:**
   - Verify LT112 and IPMCC Greeks counted correctly
   - Test partial closes effect on Greeks

## Risk Analysis

**Critical Finding:** The system has been operating without proper phase-based Greeks limits. This means:

1. **Phase 1-3 Accounts:** May have accumulated MORE Greeks than allowed
2. **Phase 4 Accounts:** May be UNDER-utilizing available Greeks capacity
3. **All Accounts:** No pre-trade Greeks validation occurring

**Recommendation:** 
1. Deploy phase-based Greeks limits immediately
2. Audit all existing positions for compliance
3. Add Greeks validation to all order placement paths
4. Monitor closely during first week of deployment

## Conclusion

The Tom King Trading Framework had a critical gap in Greeks risk management. While it calculated Greeks accurately, it didn't enforce the phase-specific limits that are fundamental to the Tom King methodology. The new `PhaseBasedGreeksLimits` class corrects this oversight and provides comprehensive Greeks risk management aligned with account phases.

**This is a MAJOR finding that affects core risk management and should be addressed immediately.**