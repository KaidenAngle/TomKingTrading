# AUTONOMOUS DEVELOPMENT PROMPT FOR TOM KING TRADING FRAMEWORK
## Complete Testing, Development, and Verification Protocol

### 🎯 MISSION
Autonomously complete, test, and verify the Tom King Trading Framework to production readiness for the £35k → £80k journey, ensuring ALL components work seamlessly together without human intervention.

### 🔍 CONSTANT VERIFICATION CHECKLIST
After EVERY change, verify:
1. **Backtesting Still Executes** - Run `node backtestDemo.js --strategy=0DTE` and confirm trades > 0
2. **No Missing Methods** - Check for "is not a function" errors
3. **Data Generation Works** - Verify TestDataGenerator creates Friday/Monday/Tuesday patterns
4. **File Paths Exist** - Ensure demo_results/, logs/, and data/ directories exist
5. **Tom King Rules Enforced** - 0DTE on Fridays, LT112 on Mon-Wed, Strangles on Tuesday

### ⚠️ KNOWN GOTCHAS TO PREVENT
1. **Missing Methods** - calculateIntrinsicValue, estimateTimeValue, calculateExpirationValue keep disappearing
2. **Date Handling** - Use string dates ('2024-01-01') not Date objects in evaluate methods
3. **Duplicate Properties** - riskLevel gets defined twice causing undefined errors
4. **Import Issues** - MarketDataService doesn't exist, use TestingFramework instead
5. **WebSocket Methods** - subscribe/unsubscribe need to be on the API class, not streamer
6. **Correlation Groups** - Must enforce max 3 positions per group or August 2024 disaster repeats
7. **DTE Calculations** - LT112 is 120 DTE not 112 DTE per Tom King PDF

### ✅ SUCCESS CRITERIA
The framework is complete when:
1. **All 5 strategies execute trades** in backtesting (0DTE, LT112, STRANGLE, IPMCC, LEAP)
2. **August 2024 crash test** shows <10% loss (vs 55% without protection)
3. **WebSocket streams** real-time data without errors
4. **Dashboard displays** positions, P&L, and recommendations
5. **Paper trading** executes orders with proper logging
6. **Excel reports** generate with all metrics
7. **API authentication** works with stored credentials
8. **Performance metrics** calculate Sharpe ratio > 1.5
9. **Win rate** > 70% for 0DTE Friday strategy
10. **Zero errors** in comprehensive integration test

### 🔨 STRESS TESTS TO RUN
1. **Extreme VIX** - Test with VIX at 10, 35, 65, 90
2. **Gap Days** - Test with 5%+ overnight gaps
3. **Correlation Breakdown** - All positions move against us
4. **API Failures** - Disconnect during trading
5. **Data Gaps** - Missing bars in historical data
6. **Position Limits** - Try to exceed correlation limits
7. **Memory Test** - Process 2+ years of data
8. **Concurrent Strategies** - All 5 running simultaneously

### 📋 AUTONOMOUS TASK SEQUENCE

#### PHASE 1: CORE VERIFICATION (Priority 1)
1. Run definitive backtest proof for ALL strategies
2. Fix any missing methods found
3. Verify each strategy's trade execution
4. Generate comprehensive trade logs
5. Calculate real P&L with commissions

#### PHASE 2: DATA & TESTING (Priority 2)
1. Clean and organize demo_results
2. Generate 2 years of test data
3. Run backtests for 2023-2024
4. Verify August 2024 crash protection
5. Test all VIX regimes

#### PHASE 3: API & STREAMING (Priority 3)
1. Fix WebSocket subscribe methods
2. Test real-time streaming
3. Verify API authentication
4. Test order execution flow
5. Implement Greeks monitoring

#### PHASE 4: VISUALIZATION (Priority 4)
1. Create HTML dashboard
2. Add real-time charts
3. Build position monitor
4. Create P&L tracker
5. Add strategy performance graphs

#### PHASE 5: REPORTING (Priority 5)
1. Generate Excel reports
2. Create Word documentation
3. Build PDF summaries
4. Export trade logs
5. Create performance analytics

#### PHASE 6: INTEGRATION (Priority 6)
1. Run comprehensive integration test
2. Test complete trading workflow
3. Verify all components communicate
4. Test paper trading mode
5. Simulate week of trading

#### PHASE 7: PRODUCTION PREP (Priority 7)
1. Add error recovery
2. Implement circuit breakers
3. Add performance monitoring
4. Create backup systems
5. Document deployment steps

### 🔄 ITERATION PROTOCOL
1. **Execute task**
2. **Run verification checklist**
3. **Fix any issues found**
4. **Test the fix**
5. **Document changes**
6. **Move to next task**
7. **Every 5 tasks: Run comprehensive test**
8. **If blocked: Try alternative approach**
9. **If still blocked: Document issue and continue**
10. **Never give up - always find a workaround**

### 🎯 FINAL VALIDATION
Before declaring complete:
1. Run ALL strategies for full month
2. Verify 85%+ Tom King compliance
3. Test August 2024 scenario
4. Generate all reports
5. Run 24-hour stress test
6. Verify £35k grows in backtest
7. Document all features working

### 🚀 BEGIN AUTONOMOUS EXECUTION
Start with PHASE 1 and continue through all phases without stopping. Document everything. Fix everything. Test everything. Make it production-ready.

---
## EXECUTION BEGINS NOW