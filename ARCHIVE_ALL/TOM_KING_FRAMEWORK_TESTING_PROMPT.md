# Tom King Trading Framework - Comprehensive Testing & Development Prompt

## 🎯 PRIMARY OBJECTIVE
Ensure the Tom King Trading Framework is 100% production-ready for the £35,000 → £80,000 journey in 8 months with 12% monthly compounding.

---

## 🔍 CONSTANT VERIFICATION CHECKLIST (Run After EVERY Change)

### 1. API Connection Health
```bash
# Check if API credentials are loaded
grep -n "TASTYTRADE" TomKingTrader/.env

# Verify server startup
cd TomKingTrader && node start.js
# MUST SEE: "✅ Access token obtained" 
# MUST SEE: "✅ Connected to account: [account_number]"
# MUST NOT SEE: "undefined" in any API path
```

### 2. Critical Error Patterns to Monitor
```bash
# Check for undefined errors (THE #1 ISSUE!)
grep -r "undefined" --include="*.js" TomKingTrader/src/ | grep -v "typeof.*undefined"

# Check for missing null checks
grep -r "ivRank\|ivPercentile\|trendAnalysis" --include="*.js" TomKingTrader/src/ | grep -v "&&"

# Verify all module exports match imports
grep -r "module.exports" --include="*.js" TomKingTrader/src/
grep -r "require(" --include="*.js" TomKingTrader/src/
```

### 3. Dashboard Functionality Test
```javascript
// Run in browser console after initialization
console.log('API Status:', window.apiConnected);
console.log('Positions:', window.currentPositions);
console.log('Signals:', window.activeSignals);
```

---

## ⚠️ KNOWN GOTCHAS & FIXES

### GOTCHA #1: Account Number Undefined
**Problem**: `/accounts/undefined/positions` errors
**Root Cause**: API trying to fetch positions before getting account number
**Fix Applied**: Added proper sequencing in initialize()
**Verification**:
```javascript
// In tastytradeAPI.js initialize()
console.log(`✅ Connected to account: ${this.accountNumber}`);
// MUST show actual account number, not undefined
```

### GOTCHA #2: Missing Environment Variables
**Problem**: API credentials not loading from .env
**Root Cause**: dotenv not configured or .env in wrong location
**Fix Applied**: Added `require('dotenv').config()` at top of app.js
**Verification**:
```bash
node -e "require('dotenv').config(); console.log(process.env.TASTYTRADE_CLIENT_SECRET ? 'LOADED' : 'MISSING')"
```

### GOTCHA #3: OAuth Token Format Issues
**Problem**: Token refresh fails with 401/403
**Root Cause**: Wrong Content-Type or malformed request
**Fix Applied**: Use application/json for TastyTrade OAuth
**Verification**: Watch for "✅ Access token obtained" in logs

### GOTCHA #4: Correlation Groups Mismatch
**Problem**: Tests fail expecting 'EQUITIES' but code has 'EQUITY_INDICES'
**Fix Applied**: Added both as aliases in config.js
**Verification**:
```bash
grep "EQUITIES\|EQUITY_INDICES" TomKingTrader/src/config.js
```

### GOTCHA #5: Module Export/Import Mismatches
**Problem**: "X is not a constructor" errors
**Root Cause**: Inconsistent export styles (default vs named)
**Fix Applied**: Standardized exports/imports
**Verification**: Run test-runner.js without constructor errors

---

## ✅ SUCCESS CRITERIA

### Level 1: Basic Functionality (CURRENT FOCUS)
- [ ] Server starts without errors
- [ ] Dashboard loads at http://localhost:3000
- [ ] Initialize button works with £35,000
- [ ] API connects and fetches account data
- [ ] No "undefined" errors in console
- [ ] WebSocket connects and stays connected

### Level 2: Trading Operations
- [ ] Market data fetches successfully
- [ ] Pattern analysis runs without errors
- [ ] Signals generate with specific strikes
- [ ] Risk management enforces limits
- [ ] Position sizing calculates correctly

### Level 3: Production Ready
- [ ] All production tests pass (8/8)
- [ ] Unit tests pass (18/18)
- [ ] 0DTE Friday logic works correctly
- [ ] Correlation limits enforced
- [ ] BP usage tracked accurately
- [ ] Manual fallback mode works

---

## 🧪 STRESS TESTS

### Test 1: API Failure Recovery
```javascript
// Simulate API failure
// Kill network connection
// System should switch to manual mode
// Verify: "🚨 Multiple server failures - activating emergency manual mode"
```

### Test 2: Maximum Positions
```javascript
// Add 3 EQUITIES positions
// Try to add 4th
// MUST BLOCK with correlation limit message
```

### Test 3: VIX Regime Changes
```javascript
// Test with VIX = 10 (Very Low)
// Test with VIX = 35 (Extreme)
// Verify position sizing adjusts
```

### Test 4: Friday 0DTE Timing
```javascript
// Set time to Friday 9:00 AM - MUST BLOCK
// Set time to Friday 10:31 AM - MUST ALLOW
// Set time to Monday 10:31 AM - MUST BLOCK
```

---

## 🔧 IMMEDIATE FIXES NEEDED

1. **API Authentication Flow**
   - Read `api docs/accounts-and-customers (1).json` for correct account structure
   - Update account number extraction logic
   - Add proper error handling for token refresh

2. **Signal Generation**
   - Ensure signals have actual strike prices, not placeholders
   - Connect pattern analysis to signal generator
   - Verify recommendations include entry/exit prices

3. **Dashboard Updates**
   - Fix system status not updating
   - Ensure positions display correctly
   - Make signals show actual recommendations

---

## 📝 TEST COMMANDS TO RUN NOW

```bash
# 1. Clean restart
cd TomKingTrader
npm install
node start.js

# 2. In another terminal, run tests
node test-runner.js
node production-test.js

# 3. Check for issues
grep -r "undefined" --include="*.js" src/ | grep -v "typeof"
grep -r "TODO\|FIXME\|XXX" --include="*.js" src/

# 4. Test API connection
curl -X POST http://localhost:3000/api/initialize \
  -H "Content-Type: application/json" \
  -d '{"accountValue": 35000, "phase": 1}'

# 5. Check health
curl http://localhost:3000/api/health
```

---

## 🚀 EXECUTION PLAN

### Phase 1: Fix Critical Issues (NOW)
1. Fix API account number fetching using api docs structure
2. Ensure OAuth token refresh works
3. Verify dashboard shows real data

### Phase 2: Complete Integration (NEXT)
1. Connect all data flows
2. Generate real trading signals
3. Test with live market data

### Phase 3: Production Validation (FINAL)
1. Run all test suites
2. Simulate full trading day
3. Verify £35k → £80k calculations

---

## REMEMBER:
- **ALWAYS CHECK FOR "undefined"** - It's the #1 source of errors
- **TEST AFTER EVERY CHANGE** - Don't accumulate problems
- **WATCH THE CONSOLE** - Enhanced logging shows everything
- **USE THE API DOCS** - They have the correct response structures
- **VERIFY WITH REAL DATA** - No placeholders or [LOADING] values

This framework MUST work flawlessly for the £35,000 → £80,000 journey!