# Autonomous Testing & Development Protocol for Tom King Trading Framework

## Purpose
This protocol ensures comprehensive, autonomous testing and development of the Tom King Trading Framework without requiring constant user input. Follow this systematically to maximize development progress.

## 1. CONSTANT VERIFICATION CHECKLIST
Run these checks after EVERY significant change:

### Core Parameter Verification
```bash
# Check BP usage is VIX-based (45-80%), not fixed 35%
grep -r "maxBPUsage.*0\.35" --include="*.js" | wc -l  # Should be 0

# Check win rates match Tom King's actual rates
grep -r "winRate.*92" --include="*.js" | wc -l  # Should be 0 (88% for 0DTE)

# Check correlation limits are phase-based
grep -r "maxCorrelatedPositions" src/config.js  # Should show phase logic
```

### File System Health
```bash
# No redundant files in root
ls *.js | grep -E "FINAL|COMPLETE|TEST|BACKTEST" | wc -l  # Should be 0

# Core modules exist
ls src/{strategies,riskManager,tastytradeAPI,backtestingEngine}.js | wc -l  # Should be 4

# No test files in src
ls src/*test*.js src/*Test*.js 2>/dev/null | wc -l  # Should be 0
```

### Integration Verification
```bash
# Test paper trading server
cd TomKingTrader && timeout 10 node paperTradingServer.js

# Test main entry point
node index.js --test-mode

# Check dashboard accessibility
curl -s http://localhost:3000 | grep -q "Tom King" && echo "Dashboard OK"
```

## 2. CRITICAL GOTCHAS TO WATCH

### Common Breaking Points
1. **VIX-based BP calculation** - Often reverts to fixed 35%
2. **Win rates** - Keep getting set to incorrect values
3. **File duplication** - New files created instead of editing existing
4. **Import paths** - Relative vs absolute path issues
5. **Async/await** - Missing await causes race conditions
6. **WebSocket connections** - Port conflicts and cleanup issues
7. **Option chain data** - Null checks needed everywhere
8. **Date calculations** - DTE calculation off by 1 errors
9. **Greeks calculations** - IV conversion (decimal vs percentage)
10. **Correlation groups** - Phase-based limits not enforced

### Prevention Steps
- ALWAYS check existing files before creating new ones
- ALWAYS verify parameters from Tom King documentation
- ALWAYS handle null/undefined in option chains
- ALWAYS use try-catch in async functions
- ALWAYS clean up resources (WebSockets, intervals)

## 3. STRATEGY IMPLEMENTATION CHECKLIST

### For Each Strategy Implementation:
1. **Read Tom King documentation** for exact parameters
2. **Check if strategy already exists** in src/strategies.js
3. **Implement with correct parameters**:
   - Entry criteria (VIX levels, DTE, deltas)
   - Exit criteria (profit targets, stop losses)
   - Risk management (BP usage, correlation limits)
   - Defensive adjustments (21 DTE rules)
4. **Add to testing framework** with scenarios
5. **Validate with paper trading**
6. **Add performance tracking**

### Current Strategy Status:
- ✅ Friday 0DTE (Tom's signature strategy)
- ✅ Long-Term 112 (Standard)
- ✅ Calendarized 112 (Advanced variant)
- ⏳ IPMCC (Incomplete)
- ⏳ Butterflies (Section 9B)
- ⏳ LEAP Put Ladders
- ✅ Futures Strangles (Basic)
- ⏳ Advanced Spreads (Section 9B)

## 4. DEVELOPMENT TASK SEQUENCE

### Phase 1: Complete Core Strategies
1. Implement remaining Section 9B strategies
2. Complete IPMCC with proper risk rules
3. Add LEAP put ladder for protection
4. Validate each with paper trading

### Phase 2: Risk Management Enhancement
1. Implement August 2024 crash prevention
2. Add VIX spike protection (>30 protocols)
3. Enhance correlation monitoring
4. Add defensive automation at 21 DTE

### Phase 3: Performance & Tracking
1. Monthly income generation tracking
2. 12% compounding verification
3. Win rate validation system
4. Tax optimization for UK traders

### Phase 4: Production Readiness
1. Stress testing under extreme volatility
2. Order preparation system with safeguards
3. Production deployment checklist
4. Monitoring and alerting setup

## 5. SUCCESS CRITERIA

### Minimum Viable Product (MVP)
- [ ] All 10 Tom King strategies implemented
- [ ] Paper trading validates 85%+ win rate
- [ ] Risk management prevents >5% drawdown
- [ ] Dashboard shows real-time P&L
- [ ] Correlation limits enforced

### Production Ready
- [ ] 1 week paper trading with profit
- [ ] Extreme volatility tests passed
- [ ] August 2024 scenario prevented
- [ ] Order preparation (not execution) working
- [ ] All parameters match Tom King docs

### Fully Optimized
- [ ] 12% monthly returns achievable
- [ ] Tax tracking for UK implemented
- [ ] Greeks streaming in real-time
- [ ] Account phase progression automated
- [ ] Complete Section 9B strategies

## 6. STRESS TEST SCENARIOS

### Market Conditions
1. **Normal Market** (VIX 15-20)
2. **Elevated Volatility** (VIX 20-25)
3. **High Volatility** (VIX 25-30)
4. **Extreme Spike** (VIX >30)
5. **Flash Crash** (5% drop in minutes)
6. **Correlation Crisis** (all positions move together)

### Test Each Scenario:
```javascript
// Run comprehensive stress test
node src/testingFramework.js --scenario="extreme"
node src/backtestingEngine.js --date="2024-08-05"
node paperTradingSimulator.js --volatility="high"
```

## 7. AUTOMATED VERIFICATION SCRIPT

Create and run this verification continuously:

```javascript
// verifySystem.js
async function verifySystem() {
    const checks = {
        bpUsage: await checkBPImplementation(),
        winRates: await checkWinRates(),
        strategies: await checkStrategyImplementation(),
        riskLimits: await checkRiskManagement(),
        paperTrading: await checkPaperTrading(),
        dashboard: await checkDashboard()
    };
    
    const issues = Object.entries(checks)
        .filter(([k,v]) => !v.passed)
        .map(([k,v]) => `${k}: ${v.error}`);
    
    if (issues.length > 0) {
        console.log('🚨 Issues found:', issues);
        // Auto-fix if possible
        await attemptAutoFix(issues);
    } else {
        console.log('✅ All systems operational');
    }
}

// Run every 30 minutes
setInterval(verifySystem, 30 * 60 * 1000);
```

## 8. CONTINUOUS IMPROVEMENT LOOP

1. **Test** → Run verification script
2. **Identify** → Find failing tests or missing features
3. **Implement** → Fix issues or add features
4. **Validate** → Run paper trading test
5. **Document** → Update this protocol with findings
6. **Repeat** → Continue until all tasks complete

## 9. PRIORITY ORDER FOR REMAINING TASKS

### Critical (Do First)
1. Complete Section 9B strategies (revenue generation)
2. Implement crash prevention (risk protection)
3. Fix VIX-based BP sizing (core functionality)

### Important (Do Second)
4. IPMCC strategy (additional income)
5. Performance tracking (measure success)
6. Defensive automation (risk management)

### Nice to Have (Do Last)
7. Tax optimization (efficiency)
8. Greeks streaming (advanced features)
9. Production monitoring (deployment)

## 10. EXECUTION COMMANDS

### Start Development Session
```bash
# 1. Verify current state
cd TomKingTrader
git status
ls src/*.js | wc -l

# 2. Run tests
node src/testingFramework.js
node validatePaperTradingLiveData.js

# 3. Start paper trading
node paperTradingServer.js &

# 4. Monitor logs
tail -f logs/*.log
```

### After Each Implementation
```bash
# 1. Syntax check
node -c src/*.js

# 2. Run specific strategy test
node testCalendarized112LiveData.js

# 3. Paper trade validation
node paperTradingSimulator.js --strategy="new_strategy"

# 4. Update documentation
echo "Strategy implemented: $(date)" >> PROGRESS.log
```

## AUTONOMOUS EXECUTION BEGINS NOW

Following this protocol, I will now:
1. Implement all remaining strategies
2. Fix all parameter issues
3. Validate through paper trading
4. Create comprehensive tests
5. Ensure production readiness

No user input needed until all tasks complete or critical blocker encountered.