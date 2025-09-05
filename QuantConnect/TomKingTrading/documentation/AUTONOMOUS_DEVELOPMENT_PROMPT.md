# TOM KING TRADING FRAMEWORK - AUTONOMOUS DEVELOPMENT PROMPT

## CRITICAL MISSION: Complete and Perfect the Tom King Trading Framework

You are tasked with autonomously iterating on the Tom King Trading Framework until it reaches production-level perfection. This is a comprehensive £35,000 → £80,000 trading system that MUST be thoroughly tested, validated, and optimized.

## 1. WHAT NEEDS CONSTANT CHECKING

### Option Contract Registration (CRITICAL)
- **ALWAYS** check that `AddOptionContract()` or `AddOption()` is called before ANY option trading
- Every strategy that trades options MUST register contracts first
- Look for patterns: `self.algo.AddOptionContract(option_contract.Symbol)`

### Symbol Object Handling (CRITICAL)  
- Never use `.Symbol` on a Symbol object - it's redundant
- Check: `self.Buy(option_symbol, quantity)` NOT `self.Buy(option_symbol.Symbol, quantity)`
- Verify all Buy/Sell calls use correct symbol references

### Portfolio Dictionary Iteration (CRITICAL)
- QuantConnect portfolios iterate differently than standard Python dicts
- Use: `for kvp in self.Portfolio:` then `symbol = kvp.Key` and `holding = kvp.Value`
- NOT: `for symbol, holding in self.Portfolio.items()`

### Tom King Specification Compliance
- **LT112 Strategy**: 120 DTE (NOT 45 DTE), weekly Wednesday entries, ATR × 0.7 strikes
- **Friday 0DTE**: 88% win rate target, 25% profit target (NOT 50%), ES futures preferred
- **Futures Strangles**: 90 DTE (NOT 45 DTE), correlation group enforcement
- **IPMCC Strategy**: £1,600-1,800/month income target, proper LEAP structure

## 2. VERIFICATION STEPS AFTER EVERY CHANGE

### Immediate Syntax Check
1. Run: `mcp__quantconnect__check_syntax` on ALL modified files
2. Fix any Python syntax errors immediately
3. Ensure all imports are correct and available

### Strategy Execution Test  
1. Run: `test_all_strategies.py` to verify each strategy can execute
2. Check: No runtime errors in strategy initialization  
3. Verify: All strategies can access their required data feeds

### Risk Management Validation
1. Test correlation group enforcement (max 2-3 positions per group)
2. Verify VIX-based position sizing is working
3. Check phase-based position limits are enforced
4. Validate August 2024 protection protocols

### Option Trading Verification
1. Ensure ALL option contracts are registered before trading
2. Test option chain selection logic
3. Verify Greeks calculations are working
4. Check option expiration and assignment handling

### Compilation Test
1. Run: `mcp__quantconnect__create_compile` for the project
2. Wait for completion with: `mcp__quantconnect__read_compile`
3. Fix ALL compilation errors before proceeding
4. Ensure 100% successful compilation

## 3. THE GOTCHAS - THINGS THAT KEEP BREAKING

### Data Feed Issues
- **Problem**: Strategies try to access data for symbols not added to the algorithm
- **Fix**: Always call `AddEquity()`, `AddOption()`, `AddFuture()` before using symbols
- **Check**: Verify all symbols in strategies are properly initialized in `Initialize()`

### Tom King Parameter Deviations
- **Problem**: Strategies using wrong DTE values (45 instead of 120 for LT112)
- **Fix**: Always reference `TOM_KING_PARAMETERS` for authoritative values
- **Check**: Cross-reference every DTE, strike selection, and entry timing

### Missing Strategy Implementations
- **Problem**: IPMCC strategy is incomplete (missing £1,600-1,800/month potential)
- **Fix**: Complete all strategy implementations with proper Tom King methodology
- **Check**: Ensure every strategy has full entry, management, and exit logic

### Correlation Group Violations  
- **Problem**: Multiple positions in same correlation group (causes August 2024 disasters)
- **Fix**: Enforce strict correlation limits before any new position entry
- **Check**: Validate correlation group assignment and position counting

### Phase-Based Strategy Access
- **Problem**: Advanced strategies available in wrong account phases
- **Fix**: Implement proper phase gates (e.g., Bear Trap 11x only in Phase 3+)
- **Check**: Verify phase requirements for every strategy activation

### VIX Regime Detection Failures
- **Problem**: Strategies not adapting to VIX regime changes
- **Fix**: Implement proper VIX level checking and strategy adjustments  
- **Check**: Verify VIX-based position sizing and defensive protocols

## 4. SUCCESS CRITERIA - HOW TO KNOW IT'S TRULY COMPLETE

### Compilation Success
- ✅ 100% successful compilation with zero errors
- ✅ All imports resolve correctly
- ✅ No missing dependencies or modules

### Strategy Completeness  
- ✅ All 18 strategy files are complete and functional
- ✅ IPMCC strategy fully implemented (currently incomplete)
- ✅ LEAP Put Ladders fully implemented (currently minimal)
- ✅ All strategies follow exact Tom King specifications

### Risk Management Validation
- ✅ Correlation enforcement prevents >2-3 positions per group
- ✅ VIX-based position sizing responds to market conditions
- ✅ Phase-based limits are enforced automatically
- ✅ August 2024 protection protocols are active

### Backtest Success
- ✅ Backtests run without runtime errors
- ✅ Options contracts are properly registered and traded
- ✅ Position tracking and P&L calculation work correctly
- ✅ Exit rules trigger appropriately (50% profit, 200% stop, 21 DTE)

### Performance Validation
- ✅ Friday 0DTE achieves 88% win rate in backtests
- ✅ LT112 shows 73% win rate with correct 120 DTE
- ✅ Futures Strangles demonstrate proper 90 DTE management
- ✅ IPMCC generates expected £1,600-1,800/month income simulation

### Integration Testing
- ✅ All strategies work together without conflicts
- ✅ Position limits prevent over-leverage
- ✅ Greeks calculations aggregate correctly across positions
- ✅ Tax reporting captures all positions for HMRC compliance

## 5. STRESS TESTS - EDGE CASES THAT BREAK THINGS

### Market Regime Stress Tests
- **VIX Spike Test**: Simulate VIX >30 and verify defensive protocols activate
- **Low VIX Test**: Test VIX <12 and ensure advanced strategies (Batman, BWIC) activate
- **Correlation Breakdown**: Test market conditions where correlations spike to 1.0

### Option Expiration Stress Tests  
- **Assignment Risk**: Test positions approaching expiration with assignment risk
- **Liquidity Stress**: Test option chains with wide bid-ask spreads
- **Early Assignment**: Test American-style option early assignment scenarios

### Position Limit Stress Tests
- **Correlation Overload**: Try to enter 4+ positions in same correlation group
- **Phase Limit Test**: Test strategy access beyond account phase limitations  
- **Capital Stress**: Test position sizing when account approaches margin limits

### Data Feed Failure Tests
- **Missing VIX Data**: Test behavior when VIX data is unavailable
- **Option Chain Gaps**: Test when specific strikes/expirations are missing
- **Market Closure**: Test behavior during holidays and extended closures

### Integration Failure Tests
- **Strategy Conflict**: Test when multiple strategies want same underlying
- **Risk Override**: Test when risk limits conflict with strategy signals
- **Exit Collision**: Test when multiple exit rules trigger simultaneously

## 6. AUTONOMOUS EXECUTION WORKFLOW

### Phase 1: Foundation Validation (Always Start Here)
```python
# 1. Syntax and compilation check
for file in all_strategy_files:
    check_syntax(file)
    fix_any_errors()

# 2. Tom King specification audit  
verify_lt112_uses_120_dte()
verify_friday_0dte_uses_25_percent_profit()
verify_futures_strangle_uses_90_dte()

# 3. Option registration audit
ensure_all_options_registered_before_trading()
```

### Phase 2: Strategy Completion (Fill the Gaps)
```python
# 1. Complete incomplete strategies
complete_ipmcc_strategy()  # Currently at 245 lines, needs 500+
complete_leap_put_ladders()  # Currently at 161 lines, needs 400+

# 2. Validate all strategy imports and dependencies
test_all_strategy_initializations()

# 3. Test individual strategy execution paths
for strategy in all_strategies:
    test_strategy_execution(strategy)
```

### Phase 3: Integration Testing (Make Them Work Together)
```python
# 1. Test correlation enforcement
test_max_positions_per_correlation_group()

# 2. Test phase-based strategy access  
test_strategy_availability_by_phase()

# 3. Test VIX regime responses
test_vix_based_position_sizing()
test_defensive_protocol_activation()
```

### Phase 4: Risk Management Validation (Prevent Disasters)
```python
# 1. Test August 2024 protection protocols
simulate_market_stress_august_2024()

# 2. Test position exit rules
test_50_percent_profit_targets()
test_200_percent_stop_losses() 
test_21_dte_mandatory_exits()

# 3. Test Greeks aggregation and limits
test_portfolio_delta_neutral_management()
test_gamma_risk_monitoring()
```

### Phase 5: Performance Optimization (Make It Profitable) 
```python
# 1. Backtest performance validation
run_2_year_comprehensive_backtest()
verify_win_rates_meet_tom_king_targets()

# 2. Tax optimization testing
test_section_1256_election_benefits()
test_uk_tax_efficiency()

# 3. Live trading readiness
test_tastytrade_integration()
test_order_execution_engine()
```

### Phase 6: Final Production Readiness (Ship It)
```python
# 1. Stress test all edge cases
run_all_stress_tests()

# 2. Final compilation and deployment test
compile_for_production()
test_live_trading_mode()

# 3. Documentation and monitoring setup  
generate_performance_reports()
setup_monitoring_alerts()
```

## 7. AUTONOMOUS TASK EXECUTION RULES

### Always Batch Tasks to Minimize User Interruption
- Group related fixes together (e.g., all syntax errors at once)
- Complete entire strategy implementations in one go
- Test multiple strategies in parallel where possible

### Always Fix Root Causes, Not Symptoms
- If option registration fails, fix ALL option registration, not just one instance
- If Tom King parameters are wrong, audit ALL parameters across ALL strategies
- If correlation limits fail, fix the entire correlation management system

### Always Validate Fixes Before Moving On
- After every fix, run compilation test
- After strategy changes, run strategy execution test  
- After risk changes, run risk management validation

### Always Document Critical Findings
- Log every Tom King specification deviation found and fixed
- Document every breaking change and its resolution
- Track performance improvements and regressions

## EXECUTE THIS WORKFLOW IMMEDIATELY

Start with Phase 1 and work systematically through all phases. Do not skip steps. Do not assume anything works without testing. Be obsessively thorough.

The Tom King Trading Framework represents potentially £45,000+ in annual returns. Every bug you miss, every specification deviation you ignore, every edge case you don't test could cost real money in live trading.

**MAKE IT PERFECT.**