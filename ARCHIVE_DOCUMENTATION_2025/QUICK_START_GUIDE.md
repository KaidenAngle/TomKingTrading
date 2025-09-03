# 🚀 QUICK START GUIDE
## Tom King Trading Framework - Paper Trading Edition

**Perfect for testing without real money!** Start here to learn the system before funding your account.

---

## ✅ IMMEDIATE STEPS (5 Minutes)

### 1. **Test Paper Trading Simulator**
```bash
cd TomKingTrader
node paperTradingSimulator.js
```

This will:
- Start with £35,000 pretend money
- Run a daily simulation
- Show you exactly how trades would work
- Track your progress toward £80,000

### 2. **Run 8-Month Simulation**
```javascript
// In Node.js console:
cd TomKingTrader
node

// Then run:
const { PaperTradingSimulator } = require('./paperTradingSimulator');
const sim = new PaperTradingSimulator(35000);
sim.simulate8MonthJourney();
```

This shows if the £35k→£80k transformation is achievable!

### 3. **View Dashboard** (Optional)
```bash
cd TomKingTrader
node src/app.js
# Open browser to http://localhost:3000
```

---

## 📊 UNDERSTANDING THE SYSTEM

### **What It Does**
The framework implements Tom King's proven trading strategies:
- **0DTE Friday**: 88% win rate strategy (Fridays only)
- **LT112**: 73% win rate long-term positions
- **Strangles**: 72% win rate on futures

### **Monthly Income Targets**
| Your Balance | Monthly Target | Daily Average |
|-------------|---------------|--------------|
| £30-40k | £3,000 | £150 |
| £40-60k | £5,000 | £250 |
| £60-75k | £7,500 | £375 |
| £75k+ | £10,000 | £500 |

### **The Math**
- Start: £35,000
- Growth: 12% monthly
- Timeline: 8 months
- Target: £86,659 (£80k+)

---

## 🎮 PAPER TRADING WORKFLOW

### **Daily Routine (5 mins)**
```bash
# Morning check
node paperTradingSimulator.js

# Review output:
# - Current balance
# - Today's strategies
# - Simulated trades
# - P&L update
```

### **Weekly Review**
```javascript
// Track your progress
const sim = new PaperTradingSimulator(35000);
sim.runMonthlyAnalysis();
```

### **What to Track**
- [ ] Win rate (should be ~75-80%)
- [ ] Monthly return (target 12%)
- [ ] Phase transitions (1→2→3→4)
- [ ] Tax implications (UK CGT)

---

## 💡 KEY CONCEPTS

### **Position Sizing**
The system automatically calculates:
- How many contracts to trade
- How much buying power to use
- Risk per trade (max 5%)

### **Risk Management**
- Max 35% buying power usage
- Max 3 positions per correlation group
- Exit at 21 DTE or 2x loss

### **UK Tax Considerations**
- £3,000 annual CGT allowance
- Track gains in GBP
- Tax year: April 6 - April 5

---

## 📈 PROGRESSION PATH

### **Week 1-2: Learn**
- Run paper trades daily
- Understand the calculations
- Track simulated P&L

### **Week 3-4: Practice**
- Follow real market moves
- Paper trade actual setups
- Compare to simulator

### **Month 2: Refine**
- Adjust for your risk tolerance
- Understand tax implications
- Build confidence

### **When Ready: Go Live**
- Fund account with £30k+
- Start with 50% position sizes
- Scale up gradually

---

## 🛠️ USEFUL COMMANDS

### **Test Individual Components**
```javascript
// Test monthly income calculator
const { MonthlyIncomeCalculator } = require('./src/monthlyIncomeCalculator');
const calc = new MonthlyIncomeCalculator();
calc.calculateMonthlyIncome(35000);

// Test compounding
const { CompoundingCalculator } = require('./src/compoundingCalculator');
const compound = new CompoundingCalculator();
compound.calculateCompoundTargets(35000, 8);

// Test UK tax
const { UKTaxOptimizer } = require('./src/ukTaxOptimizer');
const tax = new UKTaxOptimizer();
tax.calculateUKTaxLiability([], 50000);
```

### **Run Tests**
```bash
# Run comprehensive tests
node RUN_COMPREHENSIVE_TESTS.js

# Test specific component
node tests/comprehensiveTestSuite.js
```

---

## ❓ COMMON QUESTIONS

### **Q: Do I need a funded account?**
A: No! Use the paper trading simulator until you're ready.

### **Q: How accurate is the simulator?**
A: It uses Tom King's exact win rates (88%, 73%, 72%) for realistic results.

### **Q: When should I go live?**
A: After 4+ weeks of consistent paper trading success.

### **Q: What if I have less than £30k?**
A: Keep paper trading and saving. The system needs £30k minimum for Phase 1.

### **Q: Do I pay US taxes?**
A: No, as a UK citizen you only pay UK CGT on gains.

---

## 🚨 REMEMBER

**This is paper trading with pretend money!**
- No real risk
- Perfect for learning
- Build confidence first
- Fund account only when ready

---

## 📞 NEXT STEPS

1. **Run the simulator daily** for 2 weeks
2. **Track your results** in a spreadsheet
3. **Join paper trading** until confident
4. **Fund account** when ready (£30k+)
5. **Start small** with 50% positions
6. **Scale up** as you gain experience

---

*"Master the system with paper trades before risking real money."*

**Ready to start?** Run: `node paperTradingSimulator.js`

---

**Framework Version**: v17.5  
**Last Updated**: September 2, 2025  
**Status**: PAPER TRADING READY ✅