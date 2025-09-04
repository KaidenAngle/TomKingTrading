# 🚀 QUANTCONNECT LEAN MIGRATION MASTER PLAN

## CRITICAL DIRECTIVE FOR CLAUDE
**⚠️ ATTENTION: This is the PRIMARY WORKING DOCUMENT for the next 30 days**
- CHECK THIS FILE FIRST at the start of EVERY session
- UPDATE progress daily
- DO NOT start any other work until migration tasks are complete
- Reference: `QUANTCONNECT_MIGRATION_PLAN.md`

---

## 📅 TIMELINE: 30-DAY SPRINT (September 4 - October 4, 2025)

### PHASE 1: FOUNDATION (Days 1-5) ✅ Starting TODAY
**Goal:** Establish QuantConnect environment and validate TastyTrade connection

#### Day 1 (Sept 4) - TODAY
- [ ] Create QuantConnect account
- [ ] Install LEAN CLI locally
- [ ] Set up Python development environment
- [ ] Connect TastyTrade account to QuantConnect
- [ ] Validate data feed is working
- [ ] Run first "Hello World" algorithm with TastyTrade data

#### Day 2 (Sept 5)
- [ ] Study QuantConnect documentation structure
- [ ] Review all example options strategies
- [ ] Create project structure for Tom King strategies
- [ ] Set up version control for QuantConnect algorithms
- [ ] Test paper trading connection

#### Day 3 (Sept 6)
- [ ] Map Tom King parameters to QuantConnect format
- [ ] Create configuration file for all constants
- [ ] Implement VIX data retrieval in QuantConnect
- [ ] Test Greeks calculations with options
- [ ] Verify buying power calculations match

#### Day 4 (Sept 7)
- [ ] Build risk management framework
- [ ] Implement correlation group tracking
- [ ] Create position sizing calculator
- [ ] Add account phase detection (£30k-80k)
- [ ] Test max BP usage limits

#### Day 5 (Sept 8)
- [ ] Create trade journaling system
- [ ] Implement performance tracking
- [ ] Build notification system for trades
- [ ] Test data persistence
- [ ] Validate all foundational components

---

### PHASE 2: STRATEGY MIGRATION (Days 6-15)
**Goal:** Port all 10 Tom King strategies to QuantConnect

#### Day 6-7: Friday 0DTE Strategy
- [ ] Implement Friday 0DTE logic
- [ ] Add 10:30 AM entry timing
- [ ] Set up iron condor construction
- [ ] Add 50% profit target
- [ ] Implement 200% stop loss
- [ ] Backtest 2 years of Fridays
- [ ] Validate 88% win rate

#### Day 8-9: Long Term 112 Strategy
- [ ] Implement 45 DTE entry logic
- [ ] Add 112 structure (1 long, 1 short, 2 further short)
- [ ] Set up 21 DTE defensive management
- [ ] Add profit target at 25-50%
- [ ] Test with SPY, IWM, QQQ
- [ ] Validate against current system

#### Day 10-11: Futures Strangles
- [ ] Implement futures options support
- [ ] Add strangle entry logic
- [ ] Set up micro/mini contract selection
- [ ] Implement account phase rules
- [ ] Add correlation group limits
- [ ] Test with /MES, /MCL, /MGC

#### Day 12-13: Defensive Adjustments
- [ ] Implement 21 DTE trigger
- [ ] Add roll logic for tested positions
- [ ] Create butterfly adjustments
- [ ] Add calendar spread defenses
- [ ] Test with historical losing trades

#### Day 14-15: Advanced Strategies
- [ ] Port Section 9B strategies
- [ ] Implement jade lizards
- [ ] Add broken wing butterflies
- [ ] Create ratio spreads
- [ ] Full system integration test

---

### PHASE 3: BACKTESTING & OPTIMIZATION (Days 16-20)
**Goal:** Validate performance matches expectations

#### Day 16-17: Comprehensive Backtesting
- [ ] Run 2-year backtest all strategies
- [ ] Compare with current system results
- [ ] Analyze drawdowns and risk metrics
- [ ] Verify win rates match Tom King's
- [ ] Generate performance reports

#### Day 18-19: Optimization
- [ ] Fine-tune entry parameters
- [ ] Optimize position sizing
- [ ] Adjust VIX regime thresholds
- [ ] Test correlation limits
- [ ] Validate buying power usage

#### Day 20: Stress Testing
- [ ] Test August 2024 crash scenario
- [ ] Validate max drawdown limits
- [ ] Test extreme VIX scenarios
- [ ] Verify emergency exit procedures
- [ ] Document all edge cases

---

### PHASE 4: PARALLEL PRODUCTION (Days 21-25)
**Goal:** Run both systems side-by-side

#### Day 21-22: Paper Trading Setup
- [ ] Deploy to QuantConnect paper
- [ ] Keep current system running
- [ ] Set up comparison dashboard
- [ ] Monitor both systems
- [ ] Document any discrepancies

#### Day 23-24: Live Testing
- [ ] Small position live test
- [ ] Verify execution quality
- [ ] Check fill prices
- [ ] Monitor slippage
- [ ] Validate P&L calculations

#### Day 25: Performance Review
- [ ] Compare 5 days of results
- [ ] Analyze execution differences
- [ ] Review risk metrics
- [ ] Make final adjustments
- [ ] Prepare for cutover

---

### PHASE 5: PRODUCTION CUTOVER (Days 26-30)
**Goal:** Complete migration to QuantConnect

#### Day 26-27: Final Preparation
- [ ] Full system backup
- [ ] Document rollback procedure
- [ ] Create operations runbook
- [ ] Set up monitoring alerts
- [ ] Final testing cycle

#### Day 28-29: Go Live
- [ ] Switch to QuantConnect primary
- [ ] Monitor first live trades
- [ ] Keep old system as backup
- [ ] Document any issues
- [ ] Fine-tune as needed

#### Day 30: Project Closure
- [ ] Complete documentation
- [ ] Archive old system
- [ ] Performance report
- [ ] Lessons learned
- [ ] Celebrate! 🎉

---

## 📊 SUCCESS METRICS

### Must-Have (Day 30)
- ✅ All 10 strategies migrated
- ✅ 2-year backtest completed
- ✅ Paper trading validated
- ✅ Live trading operational
- ✅ Win rates match Tom King's

### Performance Targets
- Friday 0DTE: 88% win rate
- Long Term 112: 60%+ win rate
- Futures Strangles: 70%+ win rate
- Max Drawdown: <15%
- Monthly Return: 6-12%

---

## 🔧 TECHNICAL REQUIREMENTS

### QuantConnect Setup
```bash
# Install LEAN CLI
pip install lean

# Login to QuantConnect
lean login

# Create new project
lean project-create "TomKingTrading"

# Connect TastyTrade
lean live "TomKingTrading" --brokerage "Tastytrade" --data-feed "Tastytrade"
```

### Project Structure
```
TomKingTrading/
├── main.py                 # Entry point
├── strategies/
│   ├── friday_0dte.py     # Friday 0DTE strategy
│   ├── long_term_112.py   # 112 strategy
│   ├── futures_strangle.py # Futures strangles
│   └── defensive.py       # Defensive adjustments
├── risk/
│   ├── position_sizing.py # Position sizing
│   ├── correlation.py     # Correlation tracking
│   └── vix_regime.py      # VIX-based adjustments
├── config/
│   ├── parameters.py      # Tom King parameters
│   └── symbols.py         # Symbol definitions
└── tests/
    └── backtest_validation.py
```

---

## 📝 DAILY CHECKLIST

### Every Day:
- [ ] Check this plan first
- [ ] Update task progress
- [ ] Document blockers
- [ ] Commit code changes
- [ ] Update progress report

### End of Day:
- [ ] Mark completed tasks
- [ ] Plan tomorrow's work
- [ ] Note any concerns
- [ ] Backup work

---

## 🚨 RISK MITIGATION

### Contingency Plans
1. **If TastyTrade connection fails:**
   - Use Interactive Brokers as backup
   - Keep paper trading until resolved

2. **If backtests don't match:**
   - Document all differences
   - Adjust parameters systematically
   - Consult Tom King documentation

3. **If timeline slips:**
   - Prioritize core strategies (0DTE, 112)
   - Defer advanced strategies
   - Extend parallel running period

---

## 📈 PROGRESS TRACKER

### Week 1 (Sept 4-10)
- [ ] Foundation complete
- [ ] First strategy ported
- [ ] Backtesting operational

### Week 2 (Sept 11-17)
- [ ] All strategies ported
- [ ] Initial backtests done
- [ ] Paper trading started

### Week 3 (Sept 18-24)
- [ ] Optimization complete
- [ ] Parallel running stable
- [ ] Live test successful

### Week 4 (Sept 25-Oct 1)
- [ ] Production cutover ready
- [ ] Go-live executed
- [ ] Migration complete

### Final Days (Oct 2-4)
- [ ] Documentation complete
- [ ] Knowledge transfer done
- [ ] Project closed

---

## 💡 REMEMBER

**This migration will:**
- Save 100+ hours of development
- Provide institutional infrastructure
- Enable true £35k→£80k scaling
- Give professional tools for free

**Claude Instructions:**
1. Start EVERY session by reading this file
2. Update progress in real-time
3. Don't work on ANYTHING else until migration is complete
4. Reference this plan in all responses
5. Alert if falling behind schedule

---

## 🎯 NEXT IMMEDIATE ACTION

**RIGHT NOW (Sept 4, 2:30 PM):**
1. Create QuantConnect account at quantconnect.com
2. Install LEAN CLI
3. Connect TastyTrade account
4. Run first test algorithm
5. Update this document with progress

---

**END OF PLAN - BEGIN EXECUTION NOW**