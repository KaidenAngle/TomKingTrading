# Tom King Trading Framework Documentation

## Quick Start
- 📋 [SESSION STARTUP PROTOCOL](SESSION_STARTUP_PROTOCOL.md) - **🚀 START HERE FOR NEW SESSIONS** - Essential docs to read first
- 🚫 [CRITICAL: Do Not Change](CRITICAL_DO_NOT_CHANGE.md) - Things that must NEVER be modified (includes systematic methodology)
- 🔧 [TROUBLESHOOTING GUIDE](TROUBLESHOOTING_GUIDE.md) - Common issues and development best practices
- 🛠️ [Implementation Audit Protocol](Development/implementation-audit-protocol.md) - **MANDATORY** systematic development approach
- 📄 [Quick Reference](Development/quick-reference.md) - Instant consultation guide

## Architecture Documentation

### Core Systems
- [State Machine Architecture](Architecture/STATE_MACHINE_ARCHITECTURE.md) - Complete state management with enhanced patterns and error recovery
- [Multi-Strategy Coordination](Architecture/MULTI_STRATEGY_COORDINATION.md) - How strategies work together
- [VIX Management Design](Architecture/VIX_MANAGEMENT_DESIGN.md) - Central data, strategy-specific filters
- [SPY Concentration Management](Architecture/SPY_CONCENTRATION_MANAGEMENT.md) - Preventing over-exposure
- [Atomic Order Execution](Architecture/ATOMIC_ORDER_EXECUTION.md) - All-or-nothing multi-leg orders

### Advanced Architecture Patterns
- [Event-Driven Circular Dependency Resolution](Architecture/EVENT_DRIVEN_CIRCULAR_DEPENDENCY_RESOLUTION.md) - EventBus + LazyProxy patterns for eliminating circular dependencies
- [Manager Initialization Patterns](Architecture/MANAGER_INITIALIZATION_PATTERNS.md) - 5-stage deterministic initialization with comprehensive validation
- [Plugin Architecture Patterns](Architecture/PLUGIN_ARCHITECTURE_PATTERNS.md) - Protocol-based plugin systems with event-driven communication for extensible component architectures
- [Safe Component Migration Patterns](Architecture/SAFE_COMPONENT_MIGRATION_PATTERNS.md) - Systematic methodology for safely replacing critical system components with git history preservation and rollback capability
- [Performance Optimization Patterns](Architecture/PERFORMANCE_OPTIMIZATION_PATTERNS.md) - 80% API reduction, intelligent caching
- [Unified Caching Architecture](Architecture/UNIFIED_CACHING_ARCHITECTURE.md) - Type-aware intelligent caching system consolidating multiple cache implementations

### Development & Quality Assurance
- [Unified System Verification Methodology](Architecture/UNIFIED_SYSTEM_VERIFICATION_METHODOLOGY.md) - Comprehensive verification methodology combining syntax validation, interface auditing, integrity testing, integration verification, and zero-tolerance validation
- [Comprehensive Redundancy Elimination Methodology](Architecture/COMPREHENSIVE_REDUNDANCY_ELIMINATION_METHODOLOGY.md) - Complete methodology for eliminating redundancy at strategy, configuration, and implementation levels
- [Framework Organization Patterns](Architecture/FRAMEWORK_ORGANIZATION_PATTERNS.md) - Directory structure and git history preservation patterns
- [Timing Windows and Scheduling](Architecture/TIMING_WINDOWS_AND_SCHEDULING.md) - Why specific times matter
- [Fail-Fast Error Philosophy](Architecture/FAIL_FAST_ERROR_PHILOSOPHY.md) - Why we don't use try/catch everywhere
- [ObjectStore State Persistence](Architecture/OBJECTSTORE_STATE_PERSISTENCE.md) - Crash recovery and state management
- [Circuit Breaker Implementation](Architecture/CIRCUIT_BREAKER_THRESHOLDS.md) - Technical implementation details
- [Dynamic Position Scaling Patterns](Architecture/DYNAMIC_POSITION_SCALING_PATTERNS.md) - Intelligent scaling that preserves risk tolerance
- [Systematic Failure Pattern Resolution](Architecture/SYSTEMATIC_FAILURE_PATTERN_RESOLUTION.md) - Production methodology for diagnosing and resolving position opening failures through pattern classification

## Methodology Documentation

### Trading Rules & Risk Management
- [Master Risk Parameters](Methodology/MASTER_RISK_PARAMETERS.md) - All risk thresholds and parameters
- [Phase-Based Progression](Methodology/PHASE_BASED_PROGRESSION.md) - Portfolio phases and Kelly Criterion position sizing
- [21 DTE Defensive Exit Rule](Methodology/21_DTE_DEFENSIVE_EXIT_RULE.md) - Critical gamma risk management
- [Greeks Management System](Methodology/GREEKS_MANAGEMENT_SYSTEM.md) - Phase-based Greeks limits
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

## Development Process Documentation

### Development Methodology
- [Implementation Audit Protocol](Development/implementation-audit-protocol.md) - Systematic development approach
- [Production Change Management](Development/PRODUCTION_CHANGE_MANAGEMENT.md) - Comprehensive change documentation methodology
- [Systematic Framework Optimization Methodology](Development/SYSTEMATIC_FRAMEWORK_OPTIMIZATION_METHODOLOGY.md) - 10-phase optimization framework for large-scale trading systems
- [GitHub Integration Setup](Development/GITHUB_INTEGRATION_SETUP.md) - Version control integration
- [Quick Reference](Development/quick-reference.md) - Development quick reference guide

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
├── ⚠️ CRITICAL_DO_NOT_CHANGE.md    # Must read - never modify these
├── 🚀 SESSION_STARTUP_PROTOCOL.md  # START HERE - Essential docs to read first
├── 🔧 TROUBLESHOOTING_GUIDE.md     # Common issues and best practices
├── Architecture/                   # System design patterns and methodologies
├── Methodology/                    # Trading rules & risk
├── Strategies/                     # All 10 strategies detailed
├── Development/                    # Development process & change management
├── Testing/                        # Test requirements
├── Backtesting/                    # Historical scenarios
├── Archive/                        # Historical documentation and analysis reports
├── QuantConnect/                   # QC platform docs
├── TastyTrade/                     # API documentation
└── TomKingMethodology/             # Tom King's methodology
```

## Quick Navigation

### "I need to understand..."

#### **Critical file protection:**
→ Read [CRITICAL: Do Not Change](CRITICAL_DO_NOT_CHANGE.md) Section 12 - Essential files that must never be deleted

#### **Why something looks complex:**
→ Read [CRITICAL_DO_NOT_CHANGE.md](CRITICAL_DO_NOT_CHANGE.md) first

#### **How strategies work together:**
→ [Multi-Strategy Coordination](Architecture/MULTI_STRATEGY_COORDINATION.md)

#### **Why VIX requirements differ:**
→ [VIX Management Design](Architecture/VIX_MANAGEMENT_DESIGN.md)

#### **How position scaling preserves risk tolerance:**
→ [Dynamic Position Scaling Patterns](Architecture/DYNAMIC_POSITION_SCALING_PATTERNS.md)

#### **The August 5 disaster:**
→ [August 5, 2024 Correlation Disaster](Methodology/AUGUST_5_2024_CORRELATION_DISASTER.md)

#### **How to test the system:**
→ [Testing Requirements](Testing/TESTING_REQUIREMENTS.md)

#### **How to clean up redundant code safely:**
→ [Comprehensive Redundancy Elimination Methodology](Architecture/COMPREHENSIVE_REDUNDANCY_ELIMINATION_METHODOLOGY.md) - Methodology for eliminating redundancy at strategy, configuration, and implementation levels

#### **How to deploy to QuantConnect cloud:**
→ See QuantConnect API patterns in [CRITICAL: Do Not Change](CRITICAL_DO_NOT_CHANGE.md) Section 1 - Direct API usage without fallbacks

#### **How to manage production changes:**
→ [Production Change Management](Development/PRODUCTION_CHANGE_MANAGEMENT.md) - Change documentation and audit trails

#### **How to develop safely and systematically:**
→ [Unified System Verification Methodology](Architecture/UNIFIED_SYSTEM_VERIFICATION_METHODOLOGY.md) - Verification combining interface auditing, integrity testing, and zero-tolerance validation  
→ [Framework Organization Patterns](Architecture/FRAMEWORK_ORGANIZATION_PATTERNS.md) - Directory structure with history preservation  
→ [Implementation Audit Protocol](Development/implementation-audit-protocol.md) - Prevents redundant implementations

#### **How to create plugin-based architectures:**
→ [Plugin Architecture Patterns](Architecture/PLUGIN_ARCHITECTURE_PATTERNS.md) - Protocol-based plugin systems with event-driven communication

#### **How to safely migrate critical system components:**
→ [Safe Component Migration Patterns](Architecture/SAFE_COMPONENT_MIGRATION_PATTERNS.md) - Backup-first methodology with history preservation and rollback capability

## Support

For questions about specific architectural decisions, refer to the Architecture documentation. Each document explains why seemingly complex systems are necessary for safe options trading.

**Remember: Every safety system exists because of a real disaster. Never disable them.**