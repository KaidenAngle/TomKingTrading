# Tom King Trading Framework - Backtesting System Usage Guide

## Overview

The Tom King Trading Framework now includes a comprehensive backtesting system that validates pattern accuracy, tests strategy performance, and provides actionable insights for optimization. This system implements exact Tom King rules including 21 DTE exits, 50% profit targets, correlation limits, and day-specific trading restrictions.

## Key Features

### 1. **Historical Data Management**
- Integrates with TastyTrade API and alternative sources (Yahoo Finance, Alpha Vantage)
- Supports stocks, ETFs, futures, and options data
- Automatic caching and data validation
- Corporate action adjustments

### 2. **Strategy Backtesting**
- Tests all 10 Tom King strategies with exact rules
- Enforces phase-based restrictions (£30k-£75k+ account progression)
- Validates correlation group limits (max 3 per group)
- Implements proper position sizing and BP usage limits

### 3. **Performance Metrics**
- Comprehensive risk-adjusted returns (Sharpe, Sortino, Calmar)
- Drawdown analysis with recovery periods
- Win rate, profit factor, and expectancy calculations
- Monthly/quarterly return breakdowns

### 4. **Pattern Validation**
- Validates 10+ pattern types against historical data
- Machine learning integration potential
- Parameter optimization using genetic algorithms
- Cross-validation with confidence intervals

### 5. **Professional Reporting**
- HTML reports with interactive charts
- CSV exports for further analysis
- Executive summaries with key insights
- Strategy-specific recommendations

## API Endpoints

### Core Backtesting

```javascript
// Run comprehensive backtest (all strategies)
POST /api/backtest/run
{
  "symbols": ["ES", "SPY", "QQQ"],
  "startDate": "2020-01-01",
  "endDate": "2024-12-31",
  "initialCapital": 30000
}

// Test specific strategy
POST /api/backtest/strategy/0DTE
{
  "symbols": ["ES"],
  "startDate": "2023-01-01",
  "endDate": "2024-01-01",
  "initialCapital": 45000
}
```

### Pattern Validation

```javascript
// Validate pattern accuracy
POST /api/backtest/validate-patterns
{
  "symbols": ["ES", "SPY"],
  "startDate": "2020-01-01",
  "endDate": "2024-01-01"
}

// Optimize strategy parameters
POST /api/backtest/optimize/STRANGLE
{
  "symbols": ["ES", "SPY"],
  "startDate": "2022-01-01",
  "endDate": "2024-01-01"
}
```

### Reports and Data

```javascript
// Generate comprehensive report
POST /api/backtest/report
{
  "backtestResults": { /* backtest results object */ },
  "includePatterns": true,
  "includeOptimization": false
}

// Get historical data
GET /api/backtest/data/ES?startDate=2020-01-01&endDate=2024-01-01&interval=daily

// Calculate custom metrics
POST /api/backtest/metrics
{
  "trades": [ /* trades array */ ],
  "dailyPnL": [ /* daily P&L array */ ],
  "initialCapital": 30000
}
```

## Usage Examples

### 1. Complete Strategy Validation

```javascript
const axios = require('axios');
const baseURL = 'http://localhost:3000';

async function validateTomKingStrategies() {
    try {
        // Step 1: Check backtesting capabilities
        const status = await axios.get(`${baseURL}/api/backtest/status`);
        console.log('Backtesting capabilities:', status.data.capabilities);

        // Step 2: Run comprehensive backtest
        const backtest = await axios.post(`${baseURL}/api/backtest/run`, {
            symbols: ['ES', 'MES', 'SPY', 'QQQ'],
            startDate: '2020-01-01',
            endDate: '2024-01-01',
            initialCapital: 35000
        });

        console.log('Backtest Summary:');
        console.log(`Total Return: ${backtest.data.summary.totalReturn.toFixed(2)}%`);
        console.log(`Sharpe Ratio: ${backtest.data.summary.sharpeRatio.toFixed(2)}`);
        console.log(`Max Drawdown: ${backtest.data.summary.maxDrawdown.toFixed(2)}%`);
        console.log(`Win Rate: ${backtest.data.summary.winRate.toFixed(1)}%`);

        // Step 3: Generate detailed report
        const report = await axios.post(`${baseURL}/api/backtest/report`, {
            backtestResults: backtest.data.results,
            includePatterns: true,
            includeOptimization: true
        });

        console.log(`Report generated: ${report.data.report.htmlPath}`);

        return backtest.data.results;

    } catch (error) {
        console.error('Validation failed:', error.response?.data || error.message);
    }
}

validateTomKingStrategies();
```

### 2. Strategy-Specific Analysis

```javascript
async function analyze0DTEStrategy() {
    try {
        // Backtest 0DTE strategy specifically
        const result = await axios.post(`${baseURL}/api/backtest/strategy/0DTE`, {
            symbols: ['ES'],
            startDate: '2023-01-01',
            endDate: '2024-01-01',
            initialCapital: 50000
        });

        const metrics = result.data.results.metrics;
        
        console.log('0DTE Strategy Results:');
        console.log(`Trades: ${metrics.basic.totalTrades}`);
        console.log(`Win Rate: ${metrics.basic.winRate.toFixed(1)}%`);
        console.log(`Avg Win: £${metrics.basic.avgWin}`);
        console.log(`Avg Loss: £${metrics.basic.avgLoss}`);
        console.log(`Profit Factor: ${metrics.basic.profitFactor.toFixed(2)}`);

        return result.data;

    } catch (error) {
        console.error('0DTE analysis failed:', error.response?.data || error.message);
    }
}
```

### 3. Pattern Validation Workflow

```javascript
async function validatePatterns() {
    try {
        // Validate all patterns
        const validation = await axios.post(`${baseURL}/api/backtest/validate-patterns`, {
            symbols: ['ES', 'SPY', 'QQQ'],
            startDate: '2021-01-01',
            endDate: '2024-01-01'
        });

        console.log('Pattern Validation Results:');
        console.log(`Average Accuracy: ${validation.data.summary.averageAccuracy.toFixed(1)}%`);
        console.log(`Best Pattern: ${validation.data.summary.bestPattern}`);
        console.log(`Worst Pattern: ${validation.data.summary.worstPattern}`);

        // Show recommendations
        validation.data.recommendations.forEach(rec => {
            console.log(`• ${rec}`);
        });

        return validation.data;

    } catch (error) {
        console.error('Pattern validation failed:', error.response?.data || error.message);
    }
}
```

## Key Metrics Explained

### Performance Metrics
- **Total Return**: Absolute percentage gain/loss over the period
- **Sharpe Ratio**: Risk-adjusted return (>1.0 is good, >1.5 is excellent)
- **Sortino Ratio**: Downside risk-adjusted return
- **Calmar Ratio**: Annual return divided by maximum drawdown

### Risk Metrics
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Value at Risk (VaR)**: Maximum expected loss at 95% confidence
- **Ulcer Index**: Measure of downside volatility
- **Recovery Factor**: Total return divided by max drawdown

### Trading Metrics
- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Gross profit divided by gross loss
- **Expectancy**: Average profit per trade
- **Payoff Ratio**: Average win divided by average loss

## Strategy-Specific Rules

### 0DTE Friday
- **Days**: Friday only after 10:30 AM EST
- **Exit**: Let expire if OTM, close by 3:30 PM if ITM
- **Stop**: 2x credit received
- **Target**: Full credit retention

### LT112 (Long-Term 112)
- **Days**: Monday-Wednesday entry only
- **DTE**: 112 days (16 weeks)
- **Management**: Week 8 hedge monetization, Week 14 profit taking
- **Target**: 75% of credit at Week 14

### Strangles (90 DTE)
- **Days**: Tuesday entry only
- **DTE**: 90 days
- **Delta**: 5-delta strikes
- **Target**: 50% of credit
- **Stop**: 2x credit received
- **Management**: Roll at 21 DTE

### IPMCC (Income Producing Married Call)
- **Days**: Any day
- **LEAP**: 75-delta call (1 year)
- **Weekly**: 30-delta call
- **Management**: Roll weekly up and out if tested

### LEAP Ladder
- **Days**: Wednesday entry only
- **Structure**: 10 positions, 5% apart
- **Target**: 50% profit on individual positions
- **Management**: Continuous rebalancing

## Risk Management Rules

### Account Phases
1. **Phase 1 (£30-40k)**: MCL, MGC, GLD, TLT, limited strategies
2. **Phase 2 (£40-60k)**: Add MES, MNQ, expanded opportunities
3. **Phase 3 (£60-75k)**: Full futures, butterflies, complex spreads
4. **Phase 4 (£75k+)**: All strategies available, professional deployment

### Position Limits
- **Max BP Usage**: 35% of account value
- **Correlation Limit**: Max 3 positions per correlation group
- **Position Size**: 5% max risk per individual position
- **Daily Limit**: Max 5 new positions per day

### Correlation Groups
- **Equities**: ES, MES, NQ, MNQ, SPY, QQQ, IWM
- **Energy**: CL, MCL, XLE
- **Metals**: GC, MGC, GLD, SLV, HG
- **Bonds**: TLT, ZB
- **Currencies**: 6A, 6E, 6J

## File Structure

```
TomKingTrader/
├── src/
│   ├── backtestingEngine.js          # Main backtesting engine
│   ├── historicalDataManager.js      # Data fetching and caching
│   ├── performanceMetrics.js         # Comprehensive metrics calculation
│   ├── patternValidation.js          # Pattern validation and optimization
│   ├── backtestReporting.js          # Report generation
│   └── app.js                        # Updated with backtesting endpoints
├── data/
│   └── historical/                   # Cached historical data
├── reports/                          # Generated reports
└── templates/                        # Report templates
```

## Best Practices

### 1. **Data Quality**
- Always validate historical data before backtesting
- Use multiple data sources for cross-verification
- Account for survivorship bias in stock selection

### 2. **Backtesting Period**
- Use at least 2-3 years of data for robust results
- Include different market regimes (bull, bear, sideways)
- Test across various VIX environments

### 3. **Strategy Validation**
- Never backtest on the same data used for optimization
- Use walk-forward analysis for parameter stability
- Validate correlation assumptions regularly

### 4. **Risk Management**
- Always enforce Tom King's correlation limits
- Test extreme scenarios (Black Swan events)
- Validate position sizing calculations

### 5. **Reporting**
- Generate comprehensive reports for documentation
- Track strategy evolution over time
- Maintain detailed trade logs for audit trails

## Limitations and Disclaimers

⚠️ **Important Disclaimers**:

1. **Past Performance**: Historical results do not guarantee future performance
2. **Market Conditions**: Future market regimes may differ significantly from historical periods
3. **Execution Assumptions**: Perfect fills and no overnight gaps assumed
4. **Data Limitations**: Historical data may contain errors or gaps
5. **Strategy Evolution**: Tom King strategies may be updated based on market conditions

## Support and Updates

For issues, updates, or feature requests related to the backtesting system:

1. Check the system logs in the application
2. Verify data connectivity with `/api/backtest/status`
3. Review error messages in API responses
4. Generate diagnostic reports using `/api/backtest/metrics`

The backtesting system is designed to evolve with the Tom King Trading Framework and will be updated as new strategies and market insights are developed.

---

**Remember**: Backtesting is a tool for validation and optimization, not a guarantee of future performance. Always combine backtesting insights with current market analysis and risk management principles.