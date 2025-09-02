# AUTONOMOUS SYSTEMATIC CLEANUP & VERIFICATION PROMPT
## For Tom King Trading Framework v17.2
## Date: September 2, 2025

---

## 🎯 MISSION STATEMENT
Systematically clean, verify, and prepare the Tom King Trading Framework for production deployment with 100% accuracy and zero tolerance for inconsistencies.

---

## 📋 MASTER TASK LIST (Execute Sequentially)

### PHASE 1: ARCHIVE ALL REDUNDANT FILES
```
FILES TO ARCHIVE (Move to ARCHIVE_REDUNDANT):
1. COMPREHENSIVE_2YEAR_BACKTEST.js
2. FINAL_PRODUCTION_BACKTEST.js  
3. PHASE9_COMPLETE_VALIDATION.js
4. PHASE9_COMPREHENSIVE_TEST.js
5. RUN_PHASE9_VALIDATION.js
6. RUN_PROFESSIONAL_BACKTEST.js
7. TEST_INTEGRATED_SYSTEM.js
8. UNIFIED_SYSTEM_EXAMPLE.js
9. UNIFIED_SYSTEM_TEST.js
10. verifyAllStrategiesBacktest.js
11. runReportDemo.js
12. IntradayDataGenerator.js (if duplicate)
13. MarketMicrostructure.js (if duplicate)
14. OptionPricingEngine.js (if duplicate)
15. Any file with "test", "demo", "example" in name (unless in test folder)
```

**Verification After Phase 1:**
- Count files in root: Should be <15 .js files
- Check ARCHIVE_REDUNDANT: Should have 20+ files
- No test/demo files in root directory

### PHASE 2: FIX ALL BP USAGE (CRITICAL)
**Tom King's Actual BP System:**
```javascript
function getMaxBPUsage(vixLevel) {
    if (vixLevel < 13) return 0.45; // 45%
    if (vixLevel < 18) return 0.65; // 65%
    if (vixLevel < 25) return 0.75; // 75%
    if (vixLevel < 30) return 0.50; // 50%
    return 0.80; // 80% (puts only for VIX >30)
}
```

**Files That MUST Be Fixed:**
1. UNIFIED_TRADING_ENGINE.js - Line 41
2. DAILY_TRADING_ANALYSIS.js
3. LIVE_PAPER_TRADING.js
4. src/backtestingEngine.js
5. src/orderManager.js
6. src/positionManager.js
7. src/enhancedPatternIntegration.js
8. src/tomKingTracker.js
9. src/excelExporter.js
10. generateAllReports.js
11. ALL documentation files
12. ALL test files that reference BP

**Replace ALL instances of:**
- `0.35` or `35%` BP limits
- `MAX_BP_USAGE: 0.35`
- `maxBPUsage: 0.35`
- Any fixed BP percentage

**With:**
- Reference to `getMaxBPUsage(vixLevel)` function
- Or import from riskManager/config

**Verification After Phase 2:**
```bash
# Should return 0 results:
grep -r "0\.35.*BP\|35%.*BP\|maxBPUsage.*0\.35" --include="*.js"
```

### PHASE 3: STANDARDIZE WIN RATES
**Tom King's ACTUAL Win Rates:**
- 0DTE: 88% (NOT 92%)
- LT112: 73% (NOT 85%)
- Strangles: 72% (NOT 80%)
- IPMCC: 83% (NOT 75%)
- LEAP: 82% (NOT 70%)

**Fix in ALL files:**
- *.js files
- *.md documentation
- *.json data files
- *.html reports

**Verification After Phase 3:**
```bash
# Should return 0 results:
grep -r "92%.*win\|winRate.*92\|winRate.*0\.92" 
grep -r "85%.*win\|winRate.*85\|winRate.*0\.85" # For LT112
```

### PHASE 4: VERIFY STRATEGY PARAMETERS
**Check Against Tom King Documentation:**
1. **0DTE Friday:**
   - Day: Friday ONLY
   - Time: After 10:30 AM EST
   - DTE: 0
   - Profit: Let expire if profitable
   - VIX limit: <40

2. **LT112:**
   - Days: Monday-Wednesday (Wed preferred)
   - DTE: 112-120
   - Profit: 90% of credit
   - Management: 21 DTE

3. **Strangles:**
   - Day: Tuesday
   - DTE: 90
   - Profit: 50%
   - Delta: 15-20

4. **IPMCC:**
   - Roll: Friday 9:15 AM
   - LEAP: 365 DTE, 80 delta
   - Short: Weekly, 30 delta

5. **LEAP Ladder:**
   - Day: Monday
   - DTE: 365
   - Delta: 12-14
   - Size: 10 positions max

**Verification After Phase 4:**
- All strategy objects match above specs
- DTE values consistent across files
- Profit targets correct per strategy

### PHASE 5: FIX CORRELATION LIMITS
**Correct Implementation:**
- Phase 1-2: Max 2 positions per group
- Phase 3-4: Max 3 positions per group
- NOT fixed "3" everywhere

**Verification After Phase 5:**
- Check phase-based logic in riskManager
- Verify positionManager respects phases

### PHASE 6: CLEAN FILE STRUCTURE
```
FINAL STRUCTURE:
TomKingTrader/
├── src/               # Core production code ONLY
├── public/            # Single dashboard (index.html + js/dashboard.js)
├── tests/             # ALL test files here
├── docs/              # Documentation
├── data/              # Historical data
├── exports/           # Reports
├── config/            # Configuration files
├── ARCHIVE_REDUNDANT/ # All redundant files
├── PRODUCTION_LAUNCHER.js
├── runCompleteFramework.js
├── package.json
└── README.md
```

**Move to tests/ folder:**
- Any file with test logic
- Any file with demo/example code

**Verification After Phase 6:**
- Root has <10 .js files
- All tests in tests/ folder
- Clean, logical structure

### PHASE 7: UPDATE ALL DOCUMENTATION
1. Fix dates (September 2, 2025)
2. Fix BP descriptions (45-80%, not 35%)
3. Fix win rates (88%, not 92%)
4. Fix file counts
5. Remove references to deleted files
6. Update architecture descriptions

**Files to Update:**
- COMPLETE_SYSTEM_DOCUMENTATION.md
- README.md
- FINAL_VERIFICATION_REPORT.md
- All other .md files

### PHASE 8: COMPREHENSIVE TESTING
```javascript
// Test BP calculation
assert(getMaxBPUsage(10) === 0.45);  // VIX 10
assert(getMaxBPUsage(15) === 0.65);  // VIX 15
assert(getMaxBPUsage(22) === 0.75);  // VIX 22
assert(getMaxBPUsage(28) === 0.50);  // VIX 28
assert(getMaxBPUsage(35) === 0.80);  // VIX 35

// Test win rates
assert(strategies['0DTE'].winRate === 88);
assert(strategies['LT112'].winRate === 73);

// Test file structure
assert(!fs.existsSync('COMPREHENSIVE_2YEAR_BACKTEST.js'));
assert(fs.existsSync('ARCHIVE_REDUNDANT/COMPREHENSIVE_2YEAR_BACKTEST.js'));
```

---

## 🔍 CONSTANT VERIFICATION CHECKS

### After EVERY Major Change:
1. **BP Check:**
   ```bash
   grep -r "0\.35\|35%" --include="*.js" | grep -i "bp\|buying"
   # Should return 0 results
   ```

2. **Win Rate Check:**
   ```bash
   grep -r "92%\|85%" --include="*.js" | grep -i "win"
   # Should return 0 results for wrong rates
   ```

3. **File Count Check:**
   ```bash
   ls *.js | wc -l
   # Root should have <10 files
   ```

4. **Import Check:**
   ```bash
   # Ensure no broken imports after moving files
   node -c src/*.js
   ```

---

## ⚠️ COMMON GOTCHAS TO AVOID

1. **Don't just update 1-2 files** - Use grep to find ALL instances
2. **Don't trust file names** - Read content to verify redundancy
3. **Don't assume exports match** - Check both module.exports and exports
4. **Don't forget JSON files** - They have parameters too
5. **Don't skip verification** - Run checks after EVERY phase
6. **Don't claim completion** without running ALL tests
7. **Watch for:**
   - Files importing from moved/deleted files
   - Hardcoded paths that break after moves
   - Config files with wrong values
   - Documentation that references old structure

---

## ✅ SUCCESS CRITERIA (ALL Must Pass)

### Code Criteria:
- [ ] Zero instances of 35% BP in code
- [ ] Zero instances of 92% win rate for 0DTE
- [ ] Zero instances of 85% win rate for LT112
- [ ] All BP usage is VIX-dynamic (45-80%)
- [ ] All win rates match Tom King's actual
- [ ] <10 .js files in root directory
- [ ] ALL test files in tests/ folder
- [ ] ALL redundant files in ARCHIVE_REDUNDANT/

### Functional Criteria:
- [ ] PRODUCTION_LAUNCHER.js runs without errors
- [ ] runCompleteFramework.js executes successfully
- [ ] No broken imports after file moves
- [ ] Dashboard loads without console errors
- [ ] Backtest engine uses correct BP
- [ ] Order manager calculates correct sizing

### Documentation Criteria:
- [ ] All dates show September 2, 2025
- [ ] All BP descriptions show 45-80% VIX-based
- [ ] All win rates match implementation
- [ ] File structure documentation matches reality
- [ ] No references to deleted/moved files

---

## 🧪 STRESS TEST SCENARIOS

### Test 1: VIX Regime Changes
```javascript
// Test BP adjusts correctly
testVIX(8);   // Should use 45% BP
testVIX(15);  // Should use 65% BP
testVIX(22);  // Should use 75% BP
testVIX(28);  // Should use 50% BP
testVIX(40);  // Should use 80% BP
```

### Test 2: Import Resolution
```bash
# After moving files, test all imports
node -e "require('./src/index.js')"
node -e "require('./PRODUCTION_LAUNCHER.js')"
node -e "require('./runCompleteFramework.js')"
```

### Test 3: Strategy Validation
```javascript
// Verify each strategy has correct parameters
for (const [name, strategy] of Object.entries(strategies)) {
    console.log(`${name}: WR=${strategy.winRate}, DTE=${strategy.targetDTE}`);
}
```

### Test 4: File Structure
```bash
# Verify clean structure
find . -name "*.js" -not -path "./node_modules/*" -not -path "./tests/*" -not -path "./src/*" -not -path "./public/*" -not -path "./ARCHIVE_REDUNDANT/*" | wc -l
# Should be <10
```

---

## 🔄 ITERATION PROTOCOL

1. **Execute Phase 1** → Run Phase 1 Verification
2. **Execute Phase 2** → Run Phase 2 Verification + Constant Checks
3. **Execute Phase 3** → Run Phase 3 Verification + Constant Checks
4. **Continue through all 8 phases**
5. **Run ALL Success Criteria checks**
6. **Run ALL Stress Tests**
7. **If ANY fail:** Debug, fix, and restart verification
8. **If ALL pass:** Create final report with evidence

---

## 📊 FINAL VALIDATION

### Create Final Report Including:
1. Screenshot of file structure
2. Grep results showing no 35% BP
3. Grep results showing correct win rates
4. Test execution results
5. List of all moved files
6. List of all fixed files
7. Diff of key changes

### Final Checklist:
- [ ] Would Tom King recognize this as his system?
- [ ] Are BP limits exactly as Tom uses them?
- [ ] Are win rates realistic, not inflated?
- [ ] Is file structure clean and logical?
- [ ] Can this run in production without issues?
- [ ] Is documentation 100% accurate?

---

## 🚀 EXECUTION INSTRUCTIONS

1. Start with Phase 1 immediately
2. Complete ALL tasks in each phase before moving to next
3. Run verification after EACH phase
4. Document issues found and fixes applied
5. Do NOT claim completion until ALL criteria pass
6. Be HONEST about what's done and what isn't
7. If uncertain, verify against Tom King documentation

**BEGIN EXECUTION NOW - COMPLETE ALL 8 PHASES AUTONOMOUSLY**