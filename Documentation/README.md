# Tom King Trading Framework Documentation

## Quick Start
- 📋 [COMPLETE REFERENCE GUIDE](COMPLETE_REFERENCE_GUIDE.md) - **⚠️ START HERE** - Quick answers to all questions
- 🔧 [TROUBLESHOOTING GUIDE](TROUBLESHOOTING_GUIDE.md) - Common issues and solutions
- 🚫 [CRITICAL: Do Not Change](CRITICAL_DO_NOT_CHANGE.md) - Things that must NEVER be modified
- 📊 [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - Complete framework overview
- 📄 [System Documentation](../TomKingTrading/SYSTEM_DOCUMENTATION.md) - Technical details

## Architecture Documentation

### Core Systems
- [State Machine Architecture](Architecture/STATE_MACHINE_ARCHITECTURE.md) - Why each strategy needs states
- [Multi-Strategy Coordination](Architecture/MULTI_STRATEGY_COORDINATION.md) - How strategies work together
- [VIX Management Design](Architecture/VIX_MANAGEMENT_DESIGN.md) - Central data, strategy-specific filters
- [SPY Concentration Management](Architecture/SPY_CONCENTRATION_MANAGEMENT.md) - Preventing over-exposure
- [Atomic Order Execution](Architecture/ATOMIC_ORDER_EXECUTION.md) - All-or-nothing multi-leg orders
- [QuantConnect API Patterns](Architecture/QUANTCONNECT_API_PATTERNS.md) - Proper QC API usage without fallbacks
- [Performance Optimization Patterns](Architecture/PERFORMANCE_OPTIMIZATION_PATTERNS.md) - 80% API reduction, intelligent caching
- [Integration Verification Patterns](Architecture/INTEGRATION_VERIFICATION_PATTERNS.md) - Systematic integration verification methodology
- [Timing Windows and Scheduling](Architecture/TIMING_WINDOWS_AND_SCHEDULING.md) - Why specific times matter
- [Fail-Fast Error Philosophy](Architecture/FAIL_FAST_ERROR_PHILOSOPHY.md) - Why we don't use try/catch everywhere
- [ObjectStore State Persistence](Architecture/OBJECTSTORE_STATE_PERSISTENCE.md) - Crash recovery and state management
- [Circuit Breaker Thresholds](Architecture/CIRCUIT_BREAKER_THRESHOLDS.md) - Why these specific numbers

## Methodology Documentation

### Trading Rules & Risk Management
- [Kelly Criterion Position Sizing](Methodology/KELLY_CRITERION_POSITION_SIZING.md) - Why 0.25 factor
- [21 DTE Defensive Exit Rule](Methodology/21_DTE_DEFENSIVE_EXIT_RULE.md) - Critical gamma risk management
- [Greeks Management System](Methodology/GREEKS_MANAGEMENT_SYSTEM.md) - Phase-based Greeks limits
- [Phase-Based Progression](Methodology/PHASE_BASED_PROGRESSION.md) - How to advance through portfolio phases
- [August 5, 2024 Correlation Disaster](Methodology/AUGUST_5_2024_CORRELATION_DISASTER.md) - £308k lesson in correlation risk
- [Micro vs Full Futures Contracts](Methodology/MICRO_VS_FULL_FUTURES_CONTRACTS.md) - Why we use both sizes

## Strategy Documentation

### Complete Specifications
- [All Strategy Specifications](Strategies/COMPLETE_STRATEGY_SPECIFICATIONS.md) - Detailed specs for all 10 strategies

## Key Files

### Main Implementation
- `main.py` - Production-ready framework with all strategies
- `config/constants.py` - All system constants and limits
- `config/strategy_parameters.py` - Strategy-specific parameters

### Core Managers
- `core/unified_state_manager.py` - System-wide state control
- `core/unified_vix_manager.py` - Central VIX data source
- `core/unified_position_sizer.py` - Kelly Criterion sizing
- `core/spy_concentration_manager.py` - SPY exposure limits
- `core/strategy_coordinator.py` - Multi-strategy coordination

### Strategies (with State Machines)
- `strategies/friday_0dte_with_state.py` - 0DTE Friday iron condors
- `strategies/lt112_with_state.py` - 112 DTE put spreads
- `strategies/ipmcc_with_state.py` - Covered calls (IPMCC)
- `strategies/futures_strangle_with_state.py` - /ES strangles
- `strategies/leap_put_ladders_with_state.py` - Long-term protection

### Safety Systems
- `helpers/atomic_order_executor.py` - Prevents partial fills
- `helpers/data_freshness_validator.py` - Prevents stale data trading
- `risk/dynamic_margin_manager.py` - VIX-based margin control
- `risk/august_2024_correlation_limiter.py` - Correlation risk management

## Important Design Decisions

### Things That Look Like Redundancy But Aren't

1. **Different VIX Requirements**
   - 0DTE: VIX > 22 (needs high volatility for same-day)
   - LT112: 12 < VIX < 35 (moderate for 112-day trades)
   - Each strategy has different optimal conditions

2. **Separate State Machines**
   - 0DTE: Hours-long lifecycle
   - LT112: Months-long lifecycle
   - Different states, transitions, and recovery needs

3. **SPY Concentration Checks**
   - Multiple strategies trade SPY
   - Without coordination = accidental over-exposure
   - Critical risk infrastructure

4. **Atomic Execution Complexity**
   - Multi-leg options need all-or-nothing
   - Partial fills create naked positions
   - Rollback mechanism prevents disasters

5. **0.25 Kelly Factor**
   - Tom King's specific parameter
   - Extensively tested
   - DO NOT CHANGE

## Critical Rules (Never Disable)

1. **21 DTE Defensive Exit** - Prevents gamma disasters
2. **VIX Data Requirements** - No trading without volatility data
3. **Atomic Execution** - All legs or none for multi-leg
4. **SPY Concentration Limits** - Maximum exposure across strategies
5. **Circuit Breakers** - Emergency halt on rapid losses
6. **Integration Verification** - Mandatory verification of all component integrations

## Production Status

✅ **100% PRODUCTION READY**

- All strategies implemented with state machines
- All safety systems integrated and active
- All risk controls enforced
- Crash recovery implemented
- No unnecessary fallbacks or redundancies
- Clean, documented code

## Testing & Validation

### Testing Requirements
- [Testing Requirements](Testing/TESTING_REQUIREMENTS.md) - Comprehensive test scenarios
- [Backtest Scenarios](Backtesting/BACKTEST_SCENARIOS.md) - Historical validation tests

## Reference Documentation

### External Resources
- **QuantConnect Documentation** - `/QuantConnect/` folder
  - Writing Algorithms guide (PDF and TXT)
  - Local Platform setup guide
- **TastyTrade API** - `/TastyTrade/` folder
  - API SDKs (Python and JavaScript)
  - OAuth documentation
- **Tom King Methodology** - `/TomKingMethodology/` folder
  - Complete trading system documentation
  - Core framework and advanced strategies

## Folder Structure
```
Documentation/
├── 📋 COMPLETE_REFERENCE_GUIDE.md  # START HERE - Quick answers
├── ⚠️ CRITICAL_DO_NOT_CHANGE.md    # Must read - never modify these
├── 📊 IMPLEMENTATION_SUMMARY.md    # Framework overview & status
├── Architecture/ (12 docs)         # System design patterns (NEW: Performance & Integration)
├── Methodology/ (6 docs)           # Trading rules & risk
├── Strategies/ (1 doc)             # All 10 strategies detailed
├── Testing/ (1 doc)                # Test requirements
├── Backtesting/ (1 doc)            # Historical scenarios
├── QuantConnect/                   # QC platform docs
├── TastyTrade/                     # API documentation
├── TomKingMethodology/             # Tom King's methodology
└── Archive/                        # Old documentation
```

## Quick Navigation

### "I need to understand..."

#### **Why something looks complex:**
→ Read [CRITICAL_DO_NOT_CHANGE.md](CRITICAL_DO_NOT_CHANGE.md) first

#### **How strategies work together:**
→ [Multi-Strategy Coordination](Architecture/MULTI_STRATEGY_COORDINATION.md)

#### **Why VIX requirements differ:**
→ [VIX Management Design](Architecture/VIX_MANAGEMENT_DESIGN.md)

#### **The August 5 disaster:**
→ [August 5, 2024 Correlation Disaster](Methodology/AUGUST_5_2024_CORRELATION_DISASTER.md)

#### **How to test the system:**
→ [Testing Requirements](Testing/TESTING_REQUIREMENTS.md)

## Support

For questions about specific architectural decisions, refer to the Architecture documentation. Each document explains why seemingly complex systems are necessary for safe options trading.

**Remember: Every safety system exists because of a real disaster. Never disable them.**