# 🚀 TOM KING TRADING FRAMEWORK v17.4
## DEPLOYMENT & OPERATIONS GUIDE

---

## 📋 TABLE OF CONTENTS
1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Framework](#running-the-framework)
6. [Trading Phases](#trading-phases)
7. [Safety Systems](#safety-systems)
8. [Daily Operations](#daily-operations)
9. [Troubleshooting](#troubleshooting)
10. [Emergency Procedures](#emergency-procedures)

---

## 🎯 QUICK START

### Launch Trading System
```bash
# Navigate to framework directory
cd D:/OneDrive/Trading/Claude/TomKingTrader

# Run production launcher
node PRODUCTION_LAUNCHER.js

# Select mode:
# 1 - SANDBOX (testing)
# 2 - PAPER (paper trading)
# 3 - PRODUCTION (live trading)
# 4 - TEST (run tests only)
```

### Quick Commands
```bash
# Run system tests
node src/systemIntegrationTest.js

# Start app server (with dashboard)
node src/app.js

# Run backtesting
node src/backtestingEngine.js
```

---

## 💻 SYSTEM REQUIREMENTS

### Software Requirements
- **Node.js**: v18.0.0 or higher
- **NPM**: v8.0.0 or higher
- **Git**: For version control
- **Browser**: Chrome/Firefox for dashboard

### Hardware Requirements
- **RAM**: Minimum 4GB (8GB recommended)
- **CPU**: Dual-core minimum
- **Network**: Stable internet connection
- **Storage**: 500MB free space

### Account Requirements
- **TastyTrade Account**: Active account required
- **API Access**: Enabled in account settings
- **Minimum Capital**: £30,000 (Phase 1)
- **Target Capital**: £100,000 (Financial freedom)

---

## 📦 INSTALLATION

### 1. Clone Repository
```bash
git clone [repository-url]
cd TomKingTrader
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Credentials
Create `.env` file in root directory:
```env
# TastyTrade API Credentials
TASTYWORKS_USERNAME=your_username
TASTYWORKS_PASSWORD=your_password
TASTYWORKS_ACCOUNT_NUMBER=your_account

# Environment Settings
NODE_ENV=production
LOG_LEVEL=info

# Risk Settings (optional overrides)
MAX_BP_USAGE=0.65
MAX_POSITIONS=10
MAX_RISK_PER_TRADE=0.05
```

### 4. Verify Installation
```bash
# Run system integration test
node src/systemIntegrationTest.js

# Should see: "92% success rate"
```

---

## ⚙️ CONFIGURATION

### Trading Modes

#### SANDBOX Mode (Testing)
- Uses TastyTrade sandbox environment
- Simulated fills at $1.00
- No real money at risk
- Perfect for testing strategies

#### PAPER Mode
- Real market data
- Simulated execution
- Track performance without risk
- Recommended before live trading

#### PRODUCTION Mode
- **LIVE TRADING WITH REAL MONEY**
- All safety systems active
- Requires confirmation
- Full automation enabled

### Key Configuration Files

#### `src/config.js`
- Trading phases configuration
- Risk limits and parameters
- Strategy settings
- Wisdom rules enforcement

#### `src/riskManager.js`
- VIX-based BP limits (45-80%)
- Correlation limits (2-3 positions)
- Position sizing algorithms
- Emergency triggers

#### `src/strategies.js`
- All 10 Tom King strategies
- Win rates and parameters
- Entry/exit criteria
- Defensive management rules

---

## 🎮 RUNNING THE FRAMEWORK

### Production Launch Sequence

1. **Start Production Launcher**
```bash
node PRODUCTION_LAUNCHER.js
```

2. **Select Trading Mode**
- Enter 1-4 for mode selection
- Confirm PRODUCTION if selected

3. **Verify Account Details**
- Enter current balance (default £35,000)
- Enter target balance (default £80,000)
- System determines phase automatically

4. **Pre-Flight Checks**
System verifies:
- ✅ API Connection
- ✅ Risk Parameters
- ✅ Wisdom Rules (15+)
- ✅ Emergency Systems
- ✅ Market Hours
- ✅ Account Phase
- ✅ VIX Level

5. **System Initialization**
- Master controller starts
- All 44 modules load
- Protection systems arm
- Trading begins

### Dashboard Access
```bash
# Start app server
node src/app.js

# Open browser to:
http://localhost:3000
```

### Available Commands
While system is running:
- `status` - Display system status
- `pause` - Pause trading
- `resume` - Resume trading
- `income` - Show income report
- `risk` - Show risk analysis
- `exit` - Shutdown system

---

## 📊 TRADING PHASES

### Phase 1: Foundation (£30-40k)
```javascript
// Configuration
- Strategies: MCL, MGC, GLD, TLT strangles, Friday 0DTE
- Max BP: 45-65% (VIX-based)
- Correlation: Max 2 per group
- Income: Full compounding (no withdrawals)
- Focus: Building capital base
```

### Phase 2: Expansion (£40-60k)
```javascript
// Configuration
- Add: MES, MNQ strangles, LT-112
- Max BP: 55-75% (VIX-based)
- Correlation: Max 2 per group
- Income: Limited withdrawals (25%)
- Focus: Accelerated growth
```

### Phase 3: Optimization (£60-75k)
```javascript
// Configuration
- Add: Full-size futures, Section 9B
- Max BP: 65-80% (VIX-based)
- Correlation: Max 3 per group
- Income: Balanced (50% withdrawal)
- Focus: Income generation begins
```

### Phase 4: Professional (£75k+)
```javascript
// Configuration
- All strategies enabled
- Max BP: 75-80% (VIX-based)
- Correlation: Max 4 per group
- Income: £10k/month target
- Focus: Financial freedom
```

---

## 🛡️ SAFETY SYSTEMS

### 1. Emergency Protocol
- **Drawdown Protection**: Stops at 15% loss
- **VIX Spike Defense**: Reduces on 50% spike
- **Correlation Monitoring**: Max 3 positions/group
- **Rapid Loss Protection**: 5% in 1 hour triggers stop
- **Margin Call Prevention**: Stops at 90% BP usage

### 2. Disaster Recovery
- **Automatic Backups**: Every hour
- **Recovery Points**: 24-hour history
- **Crash Handlers**: Auto-save on crash
- **Gradual Restart**: Phased recovery
- **Last Resort**: Close all & lock

### 3. Mistake Prevention
- **18 Common Mistakes**: Actively prevented
- **August 5 Pattern**: Correlation protection
- **Revenge Trading**: Blocked after losses
- **FOMO Protection**: Prevents chasing
- **Never Trade List**: Blacklisted symbols

### 4. Tom King Wisdom Rules
- **Friday 0DTE**: Only Fridays, VIX > 22, after 10:30
- **21 DTE Management**: All positions reviewed
- **50% Profit Target**: Mechanical exits
- **BP Discipline**: VIX-based limits enforced
- **Quality Over Quantity**: Max 5 trades/day

---

## 📅 DAILY OPERATIONS

### Morning Routine (9:00 AM)
1. **Check Pre-Market**
```bash
# Review overnight futures
# Check VIX level
# Review economic calendar
# Check earnings calendar
```

2. **System Startup**
```bash
node PRODUCTION_LAUNCHER.js
# Select appropriate mode
# Verify all checks pass
```

3. **Position Review**
- Check 21 DTE positions
- Review 50% profit targets
- Assess correlation groups
- Plan day's trades

### Market Hours (9:30 AM - 4:00 PM)
- System runs autonomously
- Monitor dashboard periodically
- Review notifications
- Adjust if needed

### End of Day (4:00 PM)
1. **Daily Report**
- Review P&L
- Check positions
- Note lessons learned
- Plan tomorrow

2. **System Check**
```bash
# Check logs for errors
# Review risk metrics
# Verify backups complete
```

### Friday Special (0DTE Day)
```javascript
// After 10:30 AM only
// VIX must be > 22
// 88% win rate strategy
// Maximum 2% risk
```

---

## 🔧 TROUBLESHOOTING

### Common Issues

#### API Connection Failed
```bash
# Check credentials in .env
# Verify account is active
# Check network connection
# Try sandbox mode first
```

#### High Memory Usage
```bash
# Restart system
# Check for memory leaks
# Reduce position monitoring frequency
# Clear old logs
```

#### Orders Not Executing
```bash
# Check market hours
# Verify API connection
# Check buying power
# Review risk limits
```

### Error Codes
- `ERR_401`: Authentication failed
- `ERR_402`: Insufficient buying power
- `ERR_403`: Risk limit exceeded
- `ERR_404`: Symbol not found
- `ERR_500`: System error (check logs)

### Log Files
```bash
# View recent logs
tail -f logs/app.log

# Search for errors
grep ERROR logs/*.log

# Check specific module
grep "RISK" logs/app.log
```

---

## 🚨 EMERGENCY PROCEDURES

### Market Crash Protocol
1. **Immediate Actions**
```bash
# System auto-triggers at:
# - 7% market decline (Level 1)
# - 13% market decline (Level 2)
# - 20% market decline (Level 3)
```

2. **Manual Override**
```bash
# Press Ctrl+C twice
# Type 'emergency' command
# All positions close
```

### System Failure
1. **Disaster Recovery**
```bash
# Automatic recovery from last checkpoint
# If fails, restore from backup:
node src/emergencyProtocol.js --recover
```

2. **Manual Recovery**
```bash
# List recovery points
ls backups/

# Restore specific point
node src/emergencyProtocol.js --restore [recovery_id]
```

### Account Emergency
```bash
# Complete shutdown
node src/emergencyProtocol.js --shutdown

# Close all positions
node src/emergencyProtocol.js --close-all

# Lock trading
node src/emergencyProtocol.js --lock
```

---

## 📈 PERFORMANCE TRACKING

### Key Metrics
- **Monthly Target**: 12% growth
- **Win Rate Target**: 88% (0DTE)
- **Max Drawdown**: 15%
- **BP Usage**: 45-80% (VIX-based)
- **Time to £100k**: 8-12 months

### Reports
```bash
# Generate performance report
node reporting/performanceReport.js

# Income analysis
node src/incomeGenerator.js --report

# Risk assessment
node src/riskManager.js --analyze
```

---

## 💰 PATH TO FINANCIAL FREEDOM

### Month-by-Month Projection
```
Month 1: £35,000 → £39,200 (Phase 1)
Month 2: £39,200 → £43,904 (Phase 2)
Month 3: £43,904 → £49,172 (Phase 2)
Month 4: £49,172 → £55,073 (Phase 2)
Month 5: £55,073 → £61,682 (Phase 3)
Month 6: £61,682 → £69,084 (Phase 3)
Month 7: £69,084 → £77,374 (Phase 4)
Month 8: £77,374 → £86,659 (Phase 4)

TARGET ACHIEVED: £80,000+ ✅
Monthly Income: £10,000+ 💰
```

---

## 📞 SUPPORT & RESOURCES

### Documentation
- Framework Docs: `/docs`
- Tom King Strategies: `Tom King Complete Trading System Documentation*.txt`
- API Reference: `/API Documentation`

### Community
- GitHub Issues: Report bugs
- Discord: Trading community
- YouTube: Tom King videos

### Emergency Contact
- System Critical: Check logs first
- Account Issues: Contact TastyTrade
- Framework Bugs: GitHub issues

---

## ✅ FINAL CHECKLIST

Before going live:
- [ ] Completed paper trading (minimum 1 month)
- [ ] Understood all 10 strategies
- [ ] Read Tom King documentation
- [ ] Tested emergency procedures
- [ ] Verified API connection
- [ ] Set up monitoring alerts
- [ ] Backed up configuration
- [ ] Understood risk parameters
- [ ] Prepared for drawdowns
- [ ] Committed to the plan

---

**DISCLAIMER**: Trading involves substantial risk of loss. Past performance does not guarantee future results. Only trade with capital you can afford to lose. The framework is provided as-is without warranties.

---

*Tom King Trading Framework v17.4 - Path to Financial Freedom*
*Target: £35k → £100k | Strategy: 12% Monthly | Protection: 10+ Systems*