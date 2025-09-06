# COMPLETE STRATEGY EXECUTION CRITERIA AUDIT
## Tom King Trading Framework - All Decision Factors

Generated: 2025-09-06
Status: **COMPREHENSIVE AUDIT OF ALL 10 STRATEGIES**

---

## MASTER EXECUTION DECISION TREE

Every strategy must pass through multiple gates before execution. Here's the COMPLETE list of criteria:

### 🚦 UNIVERSAL GATES (Apply to ALL Strategies)

#### 1. **MARKET HOURS & TIMING**
- **Regular Trading Hours**: 9:30 AM - 4:00 PM ET
- **Extended Hours**: Some futures strategies trade 6:00 PM - 5:00 PM ET
- **Day of Week Restrictions**:
  - Friday 0DTE: FRIDAY ONLY
  - Long Term 112: WEDNESDAY ONLY (10:00 AM)
  - Futures Strangle: THURSDAY ONLY (10:15 AM)
  - Batman Spread: FRIDAY ONLY
  - Progressive Friday: FRIDAY ONLY
- **Time Window Cutoffs**:
  - 0DTE: No entries after 2:00 PM
  - Advanced 0DTE: Entry window 10:35 AM - 2:00 PM
  - Bear Trap: Must enter before 11:00 AM

#### 2. **MARKET HOLIDAYS & SPECIAL EVENTS**
- **Holidays**: No trading on market holidays
- **Early Close Days**: Adjust cutoff times (Christmas Eve, etc.)
- **Triple/Quad Witching**: Enhanced volatility checks
- **FOMC Days**: Reduced position sizes or skip
- **NFP/CPI Release**: Hold existing, no new entries 30 min before/after
- **Earnings Season**: Individual stock restrictions

#### 3. **ACCOUNT PHASE GATES**
```python
Phase 1 (£35k-40k): Friday 0DTE, LT112, Futures Strangle (micro)
Phase 2 (£40k-60k): + Advanced 0DTE, Bear Trap preparation
Phase 3 (£60k-75k): + Bear Trap active, IPMCC, LEAP Ladders, Section 9B
Phase 4 (£75k+): All strategies + professional enhancements
```

#### 4. **BUYING POWER & MARGIN**
- **Minimum BP Required**: Each strategy has specific BP%
- **BP Utilization Limits by VIX**:
  ```
  VIX < 12: 30-45% max BP
  VIX 12-16: 45-60% max BP
  VIX 16-20: 50-70% max BP
  VIX 20-25: 40-60% max BP
  VIX 25-30: 30-45% max BP
  VIX 30+: 60-80% max BP (crisis opportunity)
  ```
- **Maintenance Margin Buffer**: Keep 20% buffer minimum
- **Margin Call Prevention**: Stop new trades if BP < 15%

#### 5. **POSITION & CORRELATION LIMITS**
- **Max Positions by Phase**:
  - Phase 1: 3 total
  - Phase 2: 8 total
  - Phase 3: 12 total
  - Phase 4: 20 total
- **Correlation Groups** (Max 3 per group):
  - A1: Equity Index (SPY, QQQ, IWM, /ES, /NQ, /RTY)
  - B1: Energy (/CL, /NG, /RB, /HO)
  - C1: Metals (/GC, /SI, /HG, /PA, /PL)
  - D1: Agriculture (/ZC, /ZW, /ZS, /KC, /SB, /CC)
  - E: Bonds (/ZB, /ZN, /ZF, /ZT)
  - F: Currencies (/6E, /6A, /6B, /6J, /6C, /6S)
- **Ticker Concentration**: Max 5 positions same underlying

#### 6. **VIX REGIME GATES**
- **Skip Conditions**:
  - Friday 0DTE: Skip if VIX > 40
  - Futures Strangle: Skip if VIX < 15
  - Bear Trap: Skip if VIX < 20 or > 35
  - IPMCC: Skip if VIX > 35
  - Iron Condor: Skip if VIX < 12 or > 25
  - Ratio Spreads: Skip if VIX < 20
  - Batman: Skip if VIX < 22

#### 7. **LIQUIDITY REQUIREMENTS**
- **Options Volume**: Minimum 10 contracts/day
- **Options Open Interest**: Minimum 50 contracts
- **Bid-Ask Spread Limits**:
  - SPY/QQQ/IWM: Max 0.05 (5 cents)
  - Futures options: Max 0.10
  - Individual stocks: Max 0.15
- **Wide Spread Rejection**: Skip if spread > 2% of mid price

#### 8. **DRAWDOWN & RISK LIMITS**
- **Max Portfolio Drawdown**: -15% triggers defensive mode
- **Daily Loss Limit**: -3% stops new trades for day
- **Weekly Loss Limit**: -7% reduces position sizes by 50%
- **Monthly Loss Limit**: -10% triggers review period
- **Consecutive Losses**: 3 losses = reduce size, 5 losses = pause strategy

#### 9. **WIN/LOSS STREAKS**
- **Win Streak Management**: After 5 wins, reduce size by 25% (mean reversion)
- **Loss Streak Protection**: After 3 losses, cooling period 24 hours
- **Strategy-Specific Performance**:
  - If strategy win rate < 50% over 20 trades: pause for review
  - If strategy profit factor < 1.0 over month: reduce allocation

#### 10. **SETTLEMENT & ASSIGNMENT RISK**
- **SPX/NDX Settlement**: AM settlement awareness (Friday morning)
- **Assignment Protection**: Close ITM shorts before 3:00 PM Friday
- **Ex-Dividend Dates**: Avoid new positions 3 days before
- **Quarterly Expiration**: Enhanced liquidity but higher gamma risk
- **Pin Risk Management**: Close near-ATM positions by 3:30 PM expiry day

#### 11. **CIRCUIT BREAKERS & HALTS**
- **Market-Wide Circuit Breakers**:
  - Level 1 (7% decline): Pause 15 minutes
  - Level 2 (13% decline): Pause 15 minutes
  - Level 3 (20% decline): Close for day
- **Individual Stock Halts**: Cancel orders, wait for resume
- **Futures Lock Limits**: Respect daily price limits

#### 12. **PATTERN DAY TRADER (PDT) RULES**
- **Accounts < $25k**: Max 3 day trades per 5 days
- **PDT Flag Risk**: Track day trade count
- **Swing Trade Preference**: Hold overnight when possible

#### 13. **ECONOMIC CALENDAR AWARENESS**
- **High Impact Events** (no new trades 30 min before/after):
  - FOMC Minutes/Decisions
  - Non-Farm Payrolls
  - CPI/PPI Releases
  - GDP Reports
  - Unemployment Claims (if > expected volatility)
- **Medium Impact** (reduce size 50%):
  - Consumer Confidence
  - PMI Data
  - Retail Sales

#### 14. **OPTIONS EXPIRATION CYCLES**
- **Monthly Expiration** (3rd Friday): Higher volume, better fills
- **Weekly Expiration**: Standard for most strategies
- **Daily Expiration** (0DTE): SPY, QQQ, IWM only
- **Quarterly Expiration**: Avoid due to assignment risk

#### 15. **TECHNICAL INDICATORS & SIGNALS**
- **RSI Extremes**: Skip entries if RSI < 20 or > 80
- **Bollinger Band Breaks**: Pause on 3-sigma moves
- **Moving Average Filters**:
  - Below 200 DMA: Bearish bias, reduce call spreads
  - Above 200 DMA: Bullish bias, reduce put spreads
- **Volume Spikes**: 3x average volume = potential news event

#### 16. **MARKET INTERNALS**
- **Breadth Indicators**:
  - NYSE TICK extremes (> ±1000): Wait for normalization
  - Advance/Decline < 0.3 or > 3.0: Extreme breadth
- **Put/Call Ratio**:
  - > 1.3: Extreme fear, reduce put selling
  - < 0.6: Extreme greed, reduce call selling

#### 17. **BROKER & API HEALTH**
- **API Response Time**: > 1 second latency = pause automation
- **Connection Stability**: 3 failures = switch to manual mode
- **Order Rejection Rate**: > 10% = investigate issues
- **Fill Quality**: Slippage > $0.10 consistently = review routing

#### 18. **MANUAL MODE TRIGGERS**
- **Automatic Activation**:
  - API errors > 3 in 30 minutes
  - VIX > 50 (extreme crisis)
  - Portfolio Delta > 100
  - System resource issues
  - Circuit breaker detection
- **Suggests But Doesn't Execute**: All trades logged for manual review

---

## STRATEGY-SPECIFIC UNIQUE CRITERIA

### 1. **Friday 0DTE Strategy**
- **UNIQUE**: Must detect "Progressive Friday" pattern for +5% win rate
- **UNIQUE**: 10:30 AM exact entry (not before, not after)
- **UNIQUE**: Synthetic option generation when actual chains unavailable
- **UNIQUE**: 88% win rate threshold monitoring

### 2. **Long Term 112 Strategy**
- **UNIQUE**: ATR-based strikes (NOT IV-based) - ATR × 0.7
- **UNIQUE**: 120 DTE requirement (not 45 DTE)
- **UNIQUE**: Wednesday-only entry at 10:00 AM
- **UNIQUE**: Hedge monetization at 50% profit

### 3. **Futures Strangle Strategy**
- **UNIQUE**: 90 DTE (not 45-60)
- **UNIQUE**: Thursday 10:15 AM entry only
- **UNIQUE**: Micro/Full size transition at Phase 3
- **UNIQUE**: 16-20 delta targeting (1 standard deviation)

### 4. **Advanced 0DTE Strategy**
- **UNIQUE**: Requires 0.5%+ move from open to trigger
- **UNIQUE**: Post-10:35 AM only (after initial 0DTE window)
- **UNIQUE**: Max 2 additional entries per day
- **UNIQUE**: Butterfly structure (not condor)

### 5. **Bear Trap 11x Strategy**
- **UNIQUE**: 1-1-11 structure requirement
- **UNIQUE**: VIX sweet spot 20-35 (not below, not above)
- **UNIQUE**: 65% win rate acceptance (lower than others)
- **UNIQUE**: Emergency unwind if VIX > 35 after entry

### 6. **IPMCC Strategy**
- **UNIQUE**: LEAP must be 80+ delta
- **UNIQUE**: LEAP must have < 5% extrinsic value
- **UNIQUE**: Weekly call sales on Monday/Tuesday only
- **UNIQUE**: 2.5% weekly target (aggressive)

### 7. **LEAP Put Ladders**
- **UNIQUE**: Defensive activation in market corrections
- **UNIQUE**: Ladder structure with 3+ expirations
- **UNIQUE**: Monetization triggers at specific VIX levels

### 8. **Section 9B Strategies**
- **UNIQUE**: Phase 3+ requirement (advanced traders only)
- **UNIQUE**: Batman requires Friday + VIX 22+
- **UNIQUE**: Diagonal requires IV backwardation
- **UNIQUE**: Broken Wing requires asymmetric market move

### 9. **Earnings Avoidance System**
- **UNIQUE**: 3-day pre-earnings blackout
- **UNIQUE**: 2-day pre-dividend blackout
- **UNIQUE**: Stock-specific (ETFs usually exempt)

### 10. **Progressive Friday Analysis**
- **UNIQUE**: Historical pattern matching requirement
- **UNIQUE**: Momentum indicator confluence (3+ signals)
- **UNIQUE**: Entry timing optimization based on pattern phase

---

## RISK OVERLAYS & SAFETY SYSTEMS

### **Greeks Monitoring (Real-time)**
- **Portfolio Delta Limit**: ±100
- **Portfolio Gamma Limit**: ±20
- **Portfolio Theta Target**: $200-500/day
- **Portfolio Vega Limit**: ±1000
- **Alert Escalation**: Warning → Reduce → Halt

### **August 2024 Protection**
- **Historical Awareness**: Increased volatility in August
- **Yen Carry Unwind**: Monitor USDJPY for < 140
- **Global Correlation**: Check international markets before US open

### **Kelly Criterion Sizing**
- **Optimal F Calculation**: Based on win rate and avg win/loss
- **Conservative Adjustment**: Use 25% of Kelly suggestion
- **Dynamic Adjustment**: Recalculate weekly

### **Emergency Protocols**
- **Black Swan Detection**: VIX > 50, SPY -5% day
- **Systematic Unwind**: Predetermined exit order
- **Capital Preservation Mode**: No new trades, close losing positions

---

## EXECUTION DECISION MATRIX

For a trade to execute, it must pass:

1. ✅ Time/Day requirements
2. ✅ Market hours check
3. ✅ Holiday calendar
4. ✅ Account phase qualification
5. ✅ Buying power availability
6. ✅ Correlation limits
7. ✅ VIX regime appropriate
8. ✅ Liquidity requirements met
9. ✅ No drawdown violations
10. ✅ No streak limitations
11. ✅ Settlement risk acceptable
12. ✅ No circuit breakers
13. ✅ PDT compliance
14. ✅ Economic calendar clear
15. ✅ Expiration cycle appropriate
16. ✅ Technical signals aligned
17. ✅ Market internals stable
18. ✅ Broker connection healthy
19. ✅ Greeks within limits
20. ✅ Strategy-specific criteria met

**ANY SINGLE FAILURE = NO TRADE**

---

## CRITICAL FINDINGS

### ✅ **PROPERLY IMPLEMENTED**
- All time/day restrictions
- Account phase gates
- VIX regime integration
- BP% utilization
- Correlation management
- Greeks monitoring
- Manual mode fallback

### ⚠️ **NEEDS VERIFICATION**
- Economic calendar integration (external data source needed)
- Real-time market internals (TICK, A/D, P/C ratio)
- Holiday calendar updates
- Circuit breaker detection (real-time feed required)
- PDT tracking (broker-specific)

### 🔴 **RECOMMENDATIONS**
1. Add economic calendar API integration
2. Implement market internals monitoring
3. Add holiday calendar automatic updates
4. Create PDT tracking system for small accounts
5. Add fill quality monitoring system

---

## CONCLUSION

The Tom King Trading Framework implements **20 major categories** of execution criteria with **over 100 individual checks** before any trade executes. This multi-layered approach ensures:

1. **Capital Preservation**: Multiple safety nets prevent catastrophic losses
2. **Regulatory Compliance**: PDT, settlement, assignment rules
3. **Optimal Execution**: Time, liquidity, and market condition filters
4. **Risk Management**: Greeks, correlation, and drawdown limits
5. **Strategy Integrity**: Each strategy's unique edge is preserved

**AUDIT RESULT**: System shows exceptional comprehensiveness with minor areas for enhancement in external data integration.

---

*End of Comprehensive Execution Criteria Audit*