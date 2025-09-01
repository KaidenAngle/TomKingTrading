# TOM KING TRADING FRAMEWORK - DETAILED NEXT STEPS

## 📊 DATA AVAILABILITY CLARIFICATION

### API Data Access Times:
- **Futures (/ES, /MES, /CL, etc.)**: Available Sunday 6PM - Friday 5PM EST (nearly 24/5)
- **Equities (SPY, GLD, TLT)**: Last close price always available, after-hours quotes until 8PM EST
- **Options**: Chain structure available 24/7, prices from last trading session
- **Greeks**: Live during market hours (9:30AM-4PM EST), cached values otherwise
- **Account Data**: Always available 24/7

### UK Time Implications:
- **9PM UK = 4PM EST**: Market just closed, after-hours data available
- **2AM UK = 9PM EST**: After-hours closed, using close prices
- **2:30PM UK = 9:30AM EST**: Market opens, live data begins

## 🎯 IMMEDIATE NEXT STEPS (BROKEN DOWN)

### Step 1: Implement Data Fallback System (TODAY)
```javascript
// Create dataManager.js with:
class DataManager {
    constructor(api) {
        this.api = api;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }
    
    async getMarketData(ticker) {
        // 1. Try live API
        // 2. Fall back to cache if recent
        // 3. Use last close if market closed
        // 4. Return simulated data for testing
    }
}
```

**Actions:**
1. Create `src/dataManager.js`
2. Implement caching logic
3. Add fallback hierarchy
4. Test with current UK time

### Step 2: Fix API Symbol Format (CRITICAL)
The API expects specific formats:
- Futures: `/ES`, `/MES` (with forward slash)
- Equities: `SPY`, `QQQ` (no slash)
- Options: `SPY 250428P00355000` (OCC format)

**Actions:**
1. Update `tastytradeAPI.js` quote methods
2. Add symbol format validation
3. Create symbol conversion utility

### Step 3: Order Execution Module (SAFETY CRITICAL)
```javascript
// orderManager.js additions needed:
class OrderManager {
    async submitOrder(order) {
        // 1. Validate order parameters
        if (!this.validateOrder(order)) {
            throw new Error('Order validation failed');
        }
        
        // 2. Check risk limits
        if (!this.checkRiskLimits(order)) {
            throw new Error('Risk limits exceeded');
        }
        
        // 3. Get user confirmation
        const confirmed = await this.getUserConfirmation(order);
        if (!confirmed) {
            return { status: 'cancelled', reason: 'User cancelled' };
        }
        
        // 4. Submit to API
        return await this.api.submitOrder(order);
    }
}
```

**Safety Checks Required:**
- [ ] Max position size check (based on phase)
- [ ] BP limit enforcement (never exceed phase limits)
- [ ] Correlation group validation
- [ ] Day-specific strategy check
- [ ] Double confirmation for orders > £1000

### Step 4: Real-Time Position Monitoring
```javascript
// positionMonitor.js structure:
class PositionMonitor {
    constructor() {
        this.positions = [];
        this.alerts = [];
    }
    
    startMonitoring() {
        // Check every 5 minutes
        setInterval(() => {
            this.checkPositionHealth();
            this.check21DTERule();
            this.check50PercentProfit();
            this.checkVIXSpike();
        }, 5 * 60 * 1000);
    }
}
```

**Alerts to Implement:**
- 21 DTE exit rule
- 50% profit target
- VIX spike > 30
- Correlation group violations
- 0 DTE positions (urgent)

### Step 5: Production API Setup
1. **Update .env file:**
```env
TASTYTRADE_ENV=production
TASTYTRADE_CLIENT_SECRET=your_real_secret
TASTYTRADE_REFRESH_TOKEN=your_real_token
```

2. **Test with real account:**
```bash
node testLiveAPI.js
```

3. **Verify data access:**
```bash
node testDataAvailability.js
```

## 📅 DAILY WORKFLOW (UK TIMES)

### Morning Routine (7:00 AM UK / 2:00 AM EST)
```bash
# Run overnight analysis
node textAnalysis.js --mode=overnight

# Check positions that need attention
node src/positionMonitor.js --check-health
```

### Pre-Market (2:00 PM UK / 9:00 AM EST)
```bash
# Friday only: Start pre-market analysis
node textAnalysis.js --mode=premarket

# Check for day's opportunities
node app.js
# Open http://localhost:3000/testing.html
```

### Market Open (2:30 PM UK / 9:30 AM EST)
```bash
# Run full analysis with live data
node textAnalysis.js --mode=live

# Monitor dashboard
# Execute any 0DTE setups (Friday 3:30 PM UK)
```

### End of Day (9:00 PM UK / 4:00 PM EST)
```bash
# Daily P&L report
node src/reports/dailyReport.js

# Check tomorrow's opportunities
node textAnalysis.js --mode=tomorrow
```

## 🚨 CRITICAL SAFETY RULES

### Never Override These:
1. **Max BP Usage**: 
   - Phase 1: 50%
   - Phase 2: 65%
   - Phase 3: 75%
   - Phase 4: 80%

2. **Correlation Groups**: Max 2-3 positions per group

3. **Day Restrictions**:
   - 0DTE: Friday only after 10:30 AM EST
   - LT112: Wednesday primary entry
   - Strangles: Tuesday preferred

4. **Exit Rules**:
   - 21 DTE: Must exit/roll
   - 50% profit: Take it
   - 0 DTE: Exit by 3:00 PM EST

## 📊 TESTING CHECKLIST

Before going live with real money:

- [ ] Test with paper account first
- [ ] Verify all position sizing calculations
- [ ] Test correlation group limits
- [ ] Verify 21 DTE exit triggers
- [ ] Test VIX spike protocol
- [ ] Validate BP calculations
- [ ] Test order confirmation flow
- [ ] Verify API error handling
- [ ] Test data fallback system
- [ ] Run through Friday 0DTE scenario

## 🎯 SUCCESS METRICS

Track these daily:
- Positions opened/closed
- P&L (daily, weekly, monthly)
- BP usage %
- Win rate by strategy
- Average days in trade
- Correlation group distribution

## 💡 QUICK START COMMANDS

```bash
# Test everything is working
npm test

# Run analysis (auto-detects market state)
node textAnalysis.js

# Start dashboard
node app.js

# Check position health
node src/positionMonitor.js

# Generate daily report
node src/reports/dailyReport.js
```

## 📝 NOTES

- The framework works 24/7 using cached/last close data
- Futures data is available almost 24 hours
- Greeks are approximated outside market hours
- All safety checks must pass before order execution
- Start with paper trading until confident

Remember: The goal is £35k → £80k in 8 months through disciplined, systematic trading following Tom King's rules.