# Tom King Trading Framework - User Operations Manual
## Complete Guide for Trading System Operation

> **Target Audience**: Traders, System Operators, End Users  
> **Purpose**: Day-to-day operations and trading procedures  
> **Goal**: Transform £35k → £80k in 8 months using systematic trading  

---

## 🎯 Quick Start Guide

### **System Overview**
The Tom King Trading Framework is a complete automated trading system implementing Tom King's proven methodology. The system handles:
- **Strategy Selection**: Automated selection of optimal Tom King strategies
- **Risk Management**: VIX-adaptive buying power and correlation limits
- **Order Execution**: Professional-grade order management and execution
- **Performance Tracking**: Real-time P&L and goal progress monitoring
- **Emergency Protection**: Automated circuit breakers and risk controls

### **Daily Workflow**
1. **Morning Startup** (Before 9:30 AM ET)
   - System health check
   - Market analysis review
   - Position status verification
   
2. **Trading Session** (9:30 AM - 4:00 PM ET)
   - Automated opportunity scanning
   - Position monitoring
   - Risk assessment
   
3. **Evening Review** (After 4:00 PM ET)
   - Performance analysis
   - Next day preparation
   - System backup verification

---

## 🖥️ Dashboard Interface

### **Main Dashboard Components**

#### **Position Overview Panel**
```
┌─────────────── POSITIONS ───────────────┐
│ Symbol │ Strategy │ DTE │ P&L  │ Risk   │
│ SPY    │ 0DTE     │  0  │ +£85 │ LOW    │
│ QQQ    │ Strangle │ 25  │ +£42 │ MED    │
│ IWM    │ LT112    │ 38  │ +£67 │ LOW    │
└─────────────────────────────────────────┘
```

#### **Performance Summary**
```
┌─────────── PERFORMANCE TODAY ───────────┐
│ Daily P&L:        +£194                 │
│ Win Rate:         87.5% (7/8 trades)    │
│ BP Usage:         52% (VIX: 16.2)       │
│ Goal Progress:    £38,194 / £80,000     │
└─────────────────────────────────────────┘
```

#### **System Status Indicators**
```
┌────────── SYSTEM STATUS ────────────────┐
│ 🟢 Trading System:    ACTIVE           │
│ 🟢 API Connection:    CONNECTED         │
│ 🟡 Emergency Level:   YELLOW            │
│ 🟢 Backup System:     OPERATIONAL       │
└─────────────────────────────────────────┘
```

### **Accessing the Dashboard**
```bash
# Start the trading system
cd TomKingTrader
npm start

# Open dashboard in browser
# Navigate to: http://localhost:3000
```

---

## 📈 Tom King Strategies Guide

### **Strategy 1: Friday 0DTE** (88% Win Rate)
**When**: Fridays only, 10:30 AM - 1:30 PM ET  
**What**: Short puts or calls on SPY/QQQ at 5-15 delta  
**Target**: 50% profit or expiration  
**Risk**: Maximum 20% buying power  

#### **Usage Instructions**
1. **Setup**: System automatically scans for 0DTE opportunities on Fridays
2. **Entry**: Positions entered only between 10:30 AM - 1:30 PM ET
3. **Management**: Automated 50% profit taking or 3:30 PM closure
4. **Override**: Manual closure available via dashboard

#### **Success Indicators**
- IV Percentile > 30
- RSI extreme readings (>70 or <30)
- VIX regime appropriate for strategy
- Clear technical levels for strike selection

### **Strategy 2: Long-Term 112** (73% Win Rate)
**When**: 35-50 DTE, any trading day  
**What**: Put credit spreads with call protection  
**Target**: 50% profit or 21 DTE management  
**Risk**: Maximum 30% buying power  

#### **Entry Criteria**
- DTE between 35-50 days
- IV Rank > 25th percentile
- Put delta around 12-16
- Clear support levels below strikes

#### **Management Rules**
- Take profits at 50% max gain
- Defensive management at 21 DTE
- Close or roll if strikes threatened
- Maximum hold to 7 DTE

### **Strategy 3: Strangles** (72% Win Rate)
**When**: 30-45 DTE, high IV environments  
**What**: Short put and call strangles  
**Target**: 50% profit or 21 DTE management  
**Risk**: Maximum 25% buying power  

#### **Setup Requirements**
- IV Rank > 20th percentile
- 16-20 delta on both sides
- Liquid underlying (SPY, QQQ, IWM)
- Neutral market outlook

#### **Advanced Strategy Variants**
- **Equity Strangles**: SPY, QQQ, IWM
- **Futures Strangles**: /ES, /NQ, /RTY
- **Micro Futures**: /MES, /MNQ for smaller accounts

### **Strategy 4: Butterfly Spreads**
**When**: Low volatility environments  
**What**: Call or put butterflies centered at current price  
**Target**: Maximum profit at expiration  
**Risk**: Limited to net debit paid  

### **Strategy 5: Income Producing Monthly Covered Calls (IPMCC)**
**When**: Monthly, against long equity positions  
**What**: Short calls against stock holdings  
**Target**: Monthly premium collection  
**Risk**: Upside limitation  

---

## ⚙️ System Configuration

### **Trading Preferences**
Access via Dashboard → Settings → Trading Preferences

#### **Risk Settings**
```
Maximum Daily Loss:        £500
Maximum Position Size:     5% of account
Correlation Limit:         3 positions per group
VIX Emergency Level:       35
Buying Power Limit:        Dynamic (VIX-based)
```

#### **Strategy Settings**
```
0DTE Enabled:             Yes (Friday only)
LT112 Enabled:            Yes
Strangles Enabled:        Yes
Butterflies Enabled:      Yes
IPMCC Enabled:           Yes
Automation Level:         Semi-Automatic
```

#### **Time Restrictions**
```
Trading Hours:            9:30 AM - 4:00 PM ET
0DTE Window:             10:30 AM - 1:30 PM ET
Friday Cutoff:           1:30 PM ET
Weekend Trading:         Disabled
```

### **Account Phase Configuration**
The system automatically adjusts based on account size:

#### **Phase 1: £30k - £40k**
- **Strategies**: MCL, MGC, GLD, TLT strangles + 0DTE Friday
- **Max BP**: 50% with VIX adjustments
- **Max Positions**: 3-4 concurrent positions

#### **Phase 2: £40k - £60k**
- **Strategies**: Add MES, MNQ, currency futures
- **Max BP**: 65% with VIX adjustments
- **Max Positions**: 5-6 concurrent positions

#### **Phase 3: £60k - £75k**
- **Strategies**: Full futures, butterflies, complex spreads
- **Max BP**: 75% with VIX adjustments
- **Max Positions**: 6-8 concurrent positions

#### **Phase 4: £75k+**
- **Strategies**: All strategies available
- **Max BP**: 80% with VIX adjustments
- **Max Positions**: 8-10 concurrent positions

---

## 🛡️ Risk Management Interface

### **Real-Time Risk Dashboard**
```
┌─────────── RISK METRICS ─────────────┐
│ Portfolio Delta:    +245             │
│ Portfolio Gamma:    +18              │
│ Portfolio Theta:    +£67/day         │
│ Portfolio Vega:     -£89/vol point   │
│                                      │
│ Correlation Groups:                  │
│ SPY Group:         2/3 positions     │
│ Tech Group:        1/3 positions     │
│ Futures Group:     2/3 positions     │
│                                      │
│ VIX Level:         16.2 (NORMAL)     │
│ Max BP Allowed:    65%               │
│ Current BP Usage:  52%               │
└──────────────────────────────────────┘
```

### **Risk Alert System**
The system provides visual and logged alerts (NO notifications per user preference):

#### **Alert Levels**
- 🟢 **GREEN**: Normal operations, all systems healthy
- 🟡 **YELLOW**: Caution level, increased monitoring
- 🟠 **ORANGE**: Warning level, active risk reduction
- 🔴 **RED**: Emergency level, immediate action required

#### **Automatic Responses**
- **YELLOW**: Stop new automated positions, tighten stops
- **ORANGE**: Reduce buying power usage, close riskiest positions
- **RED**: Stop all trading, emergency position unwinding

### **Manual Risk Controls**
Available via Dashboard → Risk → Manual Controls

#### **Emergency Actions**
```
[STOP ALL TRADING]      # Immediately halt all trading
[CLOSE ALL POSITIONS]   # Emergency position liquidation
[REDUCE BP USAGE]       # Lower buying power utilization
[HEDGE PORTFOLIO]       # Add protective hedges
```

#### **Position Management**
```
[CLOSE POSITION]        # Close individual position
[TIGHTEN STOPS]         # Reduce stop-loss distances
[TAKE PROFITS]          # Close profitable positions
[DEFENSIVE ROLL]        # Roll threatened positions
```

---

## 📊 Performance Monitoring

### **Daily Performance Review**

#### **P&L Analysis**
```
┌──────── TODAY'S PERFORMANCE ────────┐
│ Gross P&L:           +£194          │
│ Commissions:         -£12           │
│ Net P&L:             +£182          │
│                                     │
│ Winning Trades:      7              │
│ Losing Trades:       1              │
│ Win Rate:            87.5%          │
│                                     │
│ Largest Winner:      +£67           │
│ Largest Loser:       -£23           │
│ Average Trade:       +£22.75        │
└─────────────────────────────────────┘
```

#### **Goal Progress Tracking**
```
┌─────── GOAL PROGRESS (Month 3) ──────┐
│ Starting Balance:    £35,000         │
│ Current Balance:     £47,892         │
│ Monthly Gain:        £4,234 (9.7%)   │
│ Target This Month:   £4,410 (10%)    │
│ Goal Progress:       96.0%           │
│                                      │
│ Projected Final:     £82,450         │
│ Target Final:        £80,000         │
│ On Track:           ✅ YES           │
└──────────────────────────────────────┘
```

### **Strategy Performance Breakdown**
```
┌──── STRATEGY PERFORMANCE (30 DAYS) ────┐
│ Strategy    │ Trades │ Win % │ P&L     │
│ 0DTE        │   12   │  92%  │ +£1,245 │
│ LT112       │    8   │  75%  │ +£967   │
│ Strangles   │   15   │  73%  │ +£1,456 │
│ Butterflies │    4   │  75%  │ +£234   │
│ IPMCC       │    6   │  83%  │ +£445   │
│                                        │
│ Total       │   45   │  80%  │ +£4,347 │
└────────────────────────────────────────┘
```

### **Monthly Review Process**
1. **Access**: Dashboard → Reports → Monthly Review
2. **Analysis**: Review all performance metrics
3. **Adjustments**: Make strategy allocation changes if needed
4. **Goals**: Update targets based on progress
5. **Risk**: Adjust risk parameters if necessary

---

## 🔧 System Operations

### **Starting the Trading System**

#### **Daily Startup Checklist**
```bash
# 1. Navigate to system directory
cd TomKingTrader

# 2. Start the trading system
npm run start

# 3. Verify system startup
# Check that all services are running:
# ✅ Trading Engine Started
# ✅ API Connection Established
# ✅ Risk Manager Active
# ✅ Pattern Analysis Running
# ✅ Dashboard Available
```

#### **Pre-Market Checklist** (Before 9:30 AM ET)
- [ ] System health check completed
- [ ] API connection verified
- [ ] Position reconciliation completed
- [ ] Risk parameters validated
- [ ] Market data feeds active
- [ ] Dashboard accessible

### **Automation Controls**

#### **Automation Levels**
```
OFF:           Manual trading only
SEMI-AUTO:     Signals provided, manual execution
FULL-AUTO:     Automated trading with oversight
```

#### **Enabling/Disabling Automation**
```javascript
// Via Dashboard
Dashboard → Settings → Automation → Enable/Disable

// Via Command Line
npm run automation:enable
npm run automation:disable
npm run automation:status
```

#### **Strategy-Specific Automation**
```
0DTE Automation:       [ ON ] Friday only
LT112 Automation:      [ ON ] All trading days
Strangle Automation:   [ ON ] High IV days
Butterfly Automation:  [OFF] Manual only
IPMCC Automation:      [ ON ] Monthly cycle
```

### **Position Management**

#### **Opening Positions**
1. **Automated**: System scans for opportunities and presents for approval
2. **Manual**: Use Dashboard → Trading → New Position
3. **Review**: All positions reviewed before execution
4. **Execute**: Confirm order details and submit

#### **Managing Positions**
```
┌─────── POSITION ACTIONS ───────┐
│ [CLOSE AT MARKET]              │
│ [CLOSE AT LIMIT]               │
│ [SET STOP LOSS]                │
│ [TAKE PROFITS]                 │
│ [DEFENSIVE ROLL]               │
│ [ADD PROTECTION]               │
└────────────────────────────────┘
```

#### **Closing Positions**
- **Automatic**: 50% profit target or defensive management
- **Manual**: Via position management interface
- **Emergency**: Immediate closure via emergency controls

---

## 📋 Daily Operating Procedures

### **Pre-Market Routine** (8:00 - 9:30 AM ET)

#### **System Checks**
1. **Health Status**: Verify all system components operational
2. **API Status**: Confirm TastyTrade API connectivity
3. **Data Feeds**: Ensure market data streaming properly
4. **Position Status**: Review overnight positions and changes
5. **Risk Review**: Check current risk metrics and limits

#### **Market Analysis**
1. **VIX Level**: Check current VIX and regime classification
2. **Market Trend**: Review overnight futures and pre-market indicators
3. **Economic Events**: Check calendar for market-moving events
4. **Strategy Outlook**: Identify probable strategies for the day

### **Market Hours Routine** (9:30 AM - 4:00 PM ET)

#### **Opening Bell** (9:30 - 10:00 AM ET)
1. **Market Open**: Monitor for opening volatility
2. **Position Adjustment**: Handle overnight gap adjustments
3. **New Opportunities**: Scan for immediate trading opportunities
4. **Risk Assessment**: Update risk metrics with new data

#### **Mid-Morning** (10:00 AM - 12:00 PM ET)
1. **0DTE Preparation**: Prepare for 0DTE window on Fridays
2. **Pattern Recognition**: Monitor for strategy entry signals
3. **Position Monitoring**: Track existing positions and adjustments
4. **Performance Update**: Update P&L and metrics

#### **0DTE Window** (10:30 AM - 1:30 PM ET - Fridays Only)
1. **Signal Generation**: Automated 0DTE opportunity scanning
2. **Entry Execution**: Execute approved 0DTE positions
3. **Intensive Monitoring**: Close position monitoring during 0DTE
4. **Profit Taking**: Automated 50% profit taking

#### **Afternoon** (1:30 - 4:00 PM ET)
1. **Position Management**: Manage existing positions
2. **Defensive Actions**: Handle 21 DTE defensive management
3. **Profit Taking**: Close profitable positions approaching targets
4. **Risk Reduction**: Reduce risk ahead of close if needed

### **Post-Market Routine** (4:00 - 6:00 PM ET)

#### **Performance Review**
1. **Daily P&L**: Review day's performance
2. **Trade Analysis**: Analyze individual trade performance
3. **Strategy Performance**: Evaluate strategy effectiveness
4. **Goal Progress**: Update progress toward £80k goal

#### **Risk Assessment**
1. **Position Risk**: Assess overnight position risk
2. **Market Risk**: Review upcoming market events
3. **Correlation Risk**: Check position correlation levels
4. **Buying Power**: Evaluate buying power usage

#### **System Maintenance**
1. **Backup Verification**: Confirm daily backup completion
2. **Log Review**: Review system logs for issues
3. **Performance Metrics**: Check system performance stats
4. **Next Day Prep**: Prepare for next trading day

---

## 🚨 Emergency Procedures

### **Emergency Situations**

#### **Market Crisis** (Flash Crash, VIX Spike >35)
1. **Immediate Action**: System automatically triggers emergency protocols
2. **Manual Override**: Use emergency controls if needed
3. **Position Assessment**: Evaluate position risk immediately
4. **Risk Reduction**: Close or hedge riskiest positions
5. **Wait and Assess**: Avoid panic trading, let systems work

#### **System Failure** (Technical Issues)
1. **Backup Systems**: Activate backup trading interface
2. **Manual Trading**: Switch to manual broker platform if needed
3. **Position Protection**: Protect existing positions first
4. **System Recovery**: Follow recovery procedures
5. **Post-Recovery**: Verify all systems before resuming

#### **Large Loss Day** (Daily Loss >£500)
1. **Stop Trading**: Immediately halt new position opening
2. **Assess Damage**: Review what went wrong
3. **Risk Reduction**: Close losing positions if appropriate
4. **System Review**: Check if system functioned properly
5. **Plan Recovery**: Develop plan for next trading day

### **Emergency Contact Procedures**
**Note**: User has requested NO alerts or notifications

All emergency events are logged to:
- Dashboard emergency panel
- System logs in `/logs/emergency/`
- Backup systems for historical review

### **Recovery Procedures**

#### **Position Recovery**
1. **Assess Current State**: Review all positions and their status
2. **Risk Evaluation**: Evaluate immediate and ongoing risks
3. **Priority Actions**: Close or hedge highest-risk positions first
4. **Systematic Recovery**: Follow predetermined recovery procedures
5. **Performance Impact**: Minimize impact on overall performance

#### **System Recovery**
1. **Identify Issue**: Determine cause of system problems
2. **Backup Recovery**: Restore from most recent backup if needed
3. **Data Verification**: Verify all data integrity
4. **Component Testing**: Test all system components
5. **Gradual Restart**: Gradually restore full functionality

---

## 🎯 Goal Achievement Strategy

### **The £35k → £80k Journey**

#### **Monthly Targets**
```
Month 1: £35,000 → £39,200  (12.0% gain = £4,200)
Month 2: £39,200 → £43,904  (12.0% gain = £4,704)
Month 3: £43,904 → £49,173  (12.0% gain = £5,269)
Month 4: £49,173 → £55,073  (12.0% gain = £5,900)
Month 5: £55,073 → £61,682  (12.0% gain = £6,609)
Month 6: £61,682 → £69,084  (12.0% gain = £7,402)
Month 7: £69,084 → £77,374  (12.0% gain = £8,290)
Month 8: £77,374 → £86,659  (12.0% gain = £9,285)

Target Achievement: £86,659 (£6,659 above £80k goal)
```

#### **Success Milestones**
- **Month 2**: £40k (Phase 2 strategies unlock)
- **Month 4**: £50k (Halfway to goal)
- **Month 6**: £60k (Phase 3 strategies unlock)
- **Month 8**: £80k (PRIMARY GOAL ACHIEVED)

#### **Risk Management During Growth**
- **Consistent BP Usage**: Maintain VIX-adaptive buying power limits
- **Strategy Diversification**: Increase strategy variety as account grows
- **Risk Scaling**: Keep risk per trade at 5% maximum
- **Correlation Control**: Maintain 3-position correlation limits

### **Performance Monitoring**
```
Weekly Reviews:     Track progress vs. targets
Monthly Assessments: Adjust strategies if needed
Quarterly Reviews:  Major strategy and risk adjustments
Goal Tracking:      Continuous progress toward £80k
```

---

## 📞 Support and Troubleshooting

### **Common Issues and Solutions**

#### **"System Won't Start"**
```
Symptoms: Application fails to launch
Causes:   Port conflicts, missing dependencies, configuration errors
Solutions:
1. Check if port 3000 is available
2. Verify all dependencies installed (npm install)
3. Check configuration files
4. Review startup logs for specific errors
```

#### **"No Trading Opportunities Found"**
```
Symptoms: System not finding trades
Causes:   Market conditions, strict filters, system issues
Solutions:
1. Check VIX level and market conditions
2. Review strategy filters and criteria
3. Verify market data feeds working
4. Check system logs for errors
```

#### **"Positions Not Updating"**
```
Symptoms: Position data not refreshing
Causes:   API connection issues, data feed problems
Solutions:
1. Check API connection status
2. Verify TastyTrade API credentials
3. Restart data streaming services
4. Check network connectivity
```

#### **"Risk Limits Exceeded"**
```
Symptoms: Cannot open new positions
Causes:   Buying power limits, correlation limits, risk limits
Solutions:
1. Check current buying power usage
2. Review correlation group positions
3. Assess individual position sizes
4. Close positions to free up capacity
```

### **Performance Issues**

#### **"System Running Slowly"**
```
Causes:   High CPU usage, memory leaks, network issues
Solutions:
1. Check system resource usage
2. Restart the application
3. Check network connectivity
4. Review system logs for bottlenecks
```

#### **"Dashboard Not Loading"**
```
Causes:   Browser issues, server problems, network connectivity
Solutions:
1. Refresh browser page
2. Clear browser cache
3. Try different browser
4. Check server status
```

### **Data Issues**

#### **"Incorrect P&L Calculations"**
```
Causes:   Data synchronization issues, calculation errors
Solutions:
1. Force position reconciliation
2. Check market data accuracy
3. Verify option chain data
4. Contact support if persistent
```

#### **"Missing Market Data"**
```
Causes:   API issues, subscription problems, network issues
Solutions:
1. Check API connection status
2. Verify data subscriptions active
3. Restart data streaming
4. Check market hours (data may not be available)
```

---

## 📖 Best Practices

### **Trading Best Practices**

#### **Strategy Selection**
- **Follow Tom King Rules**: Stick to proven methodology
- **Market Conditions**: Match strategies to market environment
- **Account Phase**: Use appropriate strategies for account size
- **Risk Management**: Never exceed position size limits

#### **Position Management**
- **Defensive Management**: Take action at 21 DTE
- **Profit Taking**: Take profits at 50% max gain
- **Loss Management**: Cut losses early if fundamentally wrong
- **Time Management**: Close positions before expiration issues

#### **Risk Management**
- **Position Sizing**: Never risk more than 5% per trade
- **Correlation Limits**: Maximum 3 positions per correlation group
- **Buying Power**: Follow VIX-adaptive buying power limits
- **Emergency Planning**: Know your emergency procedures

### **System Operation Best Practices**

#### **Daily Operations**
- **Consistent Routine**: Follow the same procedures daily
- **System Checks**: Always verify system health before trading
- **Documentation**: Log any unusual events or changes
- **Performance Review**: Review performance regularly

#### **Risk Management**
- **Continuous Monitoring**: Monitor positions and risk throughout day
- **Alert Response**: Respond promptly to system alerts
- **Emergency Preparedness**: Know emergency procedures
- **Backup Systems**: Ensure backup systems are ready

#### **Performance Optimization**
- **Strategy Analysis**: Regularly analyze strategy performance
- **System Tuning**: Optimize system parameters based on results
- **Goal Tracking**: Continuously track progress toward goals
- **Continuous Learning**: Learn from both successes and failures

---

## 🎓 Training and Education

### **Required Knowledge**

#### **Tom King Methodology**
- Understanding of all 10 strategies
- Knowledge of risk management principles
- Familiarity with VIX-based adaptations
- Experience with defensive management

#### **System Operation**
- Dashboard navigation and usage
- Risk management interface
- Emergency procedures
- Performance monitoring tools

#### **Options Trading**
- Basic options knowledge
- Greeks understanding
- Time decay concepts
- Volatility principles

### **Recommended Learning Path**

#### **Week 1: System Familiarization**
- Install and configure system
- Navigate dashboard interface
- Understand risk management tools
- Practice with paper trading

#### **Week 2: Strategy Understanding**
- Study Tom King strategies
- Practice strategy identification
- Learn entry and exit criteria
- Understand profit targets

#### **Week 3: Risk Management**
- Master risk management interface
- Practice emergency procedures
- Understand correlation limits
- Learn buying power management

#### **Week 4: Performance Optimization**
- Analyze performance metrics
- Optimize strategy selection
- Fine-tune risk parameters
- Plan for account growth

---

**The Tom King Trading Framework User Operations Manual provides comprehensive guidance for successful daily operation of the trading system. Following these procedures and best practices will help achieve the £35k → £80k transformation goal through systematic, disciplined trading.**

---

**Document Status**: COMPLETE - User Operations Manual  
**Target Users**: Traders, System Operators, End Users  
**Version**: 2.0 Production Ready  
**Last Updated**: September 3, 2025