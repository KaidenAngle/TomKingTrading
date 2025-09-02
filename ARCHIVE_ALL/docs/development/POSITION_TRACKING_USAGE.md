# Tom King Trading Framework - Position Tracking & P&L System

## Overview

This comprehensive position tracking and P&L reporting system provides complete monitoring and analysis capabilities for the Tom King Trading Framework, helping traders progress from £35k to £80k while maintaining strict risk management.

## Key Features

### 1. **Position Tracking System**
- Real-time position monitoring with health scoring
- Automatic correlation group assignment
- DTE alerts and management triggers
- Strategy-specific tracking (0DTE, Strangle, LT112, etc.)

### 2. **P&L Calculation Engine**
- Real-time unrealized P&L calculations
- Historical P&L tracking (daily, weekly, monthly, yearly)
- Strategy and correlation group P&L breakdown
- Win rate and performance metrics

### 3. **Performance Dashboard**
- Live HTML dashboard with charts
- Account growth visualization
- Strategy performance comparison
- Progress toward £80k goal

### 4. **Trade Journal**
- Automatic trade logging
- Entry/exit reasoning tracking
- Pattern recognition logging
- CSV export functionality

### 5. **Tom King Specific Features**
- Friday 0DTE performance tracking (92% win rate target)
- Buying power usage optimization (35% target)
- Phase progression tracking (4 phases from £30k-£75k+)
- August 2024 correlation risk prevention

## API Endpoints

### System Status
```
GET /api/system/status
```
Returns comprehensive system health and status information.

### Dashboard
```
GET /api/dashboard        # JSON dashboard data
GET /dashboard           # HTML dashboard
```

### Position Management
```
GET /api/positions                    # Get all positions
POST /api/positions                   # Add new position
PUT /api/positions/:id               # Update position
DELETE /api/positions/:id            # Close position
POST /api/market-data/update         # Update with market data
```

### P&L and Analytics
```
GET /api/pl/current                  # Current P&L
GET /api/analytics                   # Trade analytics
GET /api/tom-king/metrics           # Tom King specific metrics
GET /api/reports/comprehensive      # Full system report
```

### Export Functions
```
POST /api/export/trades             # Export trades to CSV
POST /api/export/analytics          # Export analytics report
```

## Usage Examples

### 1. Adding a New Position

```javascript
// Add a Friday 0DTE position
const positionData = {
    ticker: 'SPY',
    strategy: '0DTE',
    type: 'OPTIONS',
    quantity: 1,
    entryPrice: 2.50,
    strike: 4580,
    optionType: 'PUT',
    expiration: '2024-01-05',
    entryReason: 'Friday 0DTE - put spread under key support',
    marketConditions: {
        vix: 14.2,
        spyPrice: 4582.15,
        trend: 'BEARISH'
    },
    fridayODTE: true,
    phase: 2
};

const response = await fetch('/api/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(positionData)
});
```

### 2. Monitoring System Health

```javascript
const status = await fetch('/api/system/status').then(r => r.json());

console.log(`System Health: ${status.systemHealth}`);
console.log(`Active Positions: ${status.summary.totalPositions}`);
console.log(`Current Phase: ${status.tomKing.currentPhase}`);
console.log(`Goal Progress: ${status.tomKing.goalProgress}%`);
console.log(`Friday 0DTE Win Rate: ${status.tomKing.friday0DTEWinRate}%`);
```

### 3. Getting Tom King Metrics

```javascript
const metrics = await fetch('/api/tom-king/metrics').then(r => r.json());

// Friday 0DTE Performance
const friday0DTE = metrics.metrics.friday0DTE;
console.log(`Friday Sessions: ${friday0DTE.totalFridaySessions}`);
console.log(`Win Rate: ${friday0DTE.currentWinRate}% (Target: 92%)`);
console.log(`Current Streak: ${friday0DTE.streaks.currentWinStreak} wins`);

// Buying Power Usage
const bpUsage = metrics.metrics.buyingPower;
console.log(`BP Usage: ${bpUsage.current.usagePercent}% (Target: 35%)`);
console.log(`Risk Level: ${bpUsage.riskLevel.level}`);

// Phase Progression
const phase = metrics.metrics.phaseProgression;
console.log(`Current Balance: £${phase.currentBalance.toLocaleString()}`);
console.log(`Phase ${phase.currentPhase}: ${phase.currentMilestone.description}`);
console.log(`Goal Progress: ${phase.totalProgress.toFixed(1)}%`);
```

### 4. Exporting Trade Data

```javascript
// Export all Friday 0DTE trades
const exportData = {
    filters: {
        strategy: '0DTE',
        tags: ['FRIDAY_0DTE']
    },
    filename: 'friday_0dte_trades.csv'
};

const response = await fetch('/api/export/trades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exportData)
});

const result = await response.json();
console.log(`Exported to: ${result.filePath}`);
```

## Key Alerts and Notifications

### Position Alerts
- **0 DTE Alert**: Position expires today - immediate action required
- **21 DTE Alert**: Position at management threshold - review required
- **50% Profit Alert**: Profit target achieved - consider closing
- **Major Loss Alert**: Significant loss - implement defense

### System Alerts
- **Correlation Violation**: Too many positions in same group
- **BP Exceeded**: Buying power usage above safe limits
- **August 5 Risk**: High correlation exposure detected

### Tom King Alerts
- **Friday 0DTE Below Target**: Win rate below 92%
- **Phase Progression**: Ready for next phase upgrade
- **Goal Tracking**: Behind schedule for £80k target

## Dashboard Features

The HTML dashboard (`/dashboard`) provides:

### Real-time Metrics
- Current account value and P&L
- Active positions with health scores
- Alert notifications
- Progress toward £80k goal

### Performance Charts
- Account growth over time
- Strategy performance comparison
- Monthly income progression
- Win rate by strategy
- Correlation group exposure

### Tom King Tracking
- Friday 0DTE session results
- Phase progression status
- Buying power utilization
- Goal achievement timeline

## Risk Management Integration

### Correlation Limits
- Maximum 2 positions per correlation group (Phase 1-3)
- Maximum 3 positions per correlation group (Phase 4)
- Real-time correlation monitoring
- August 2024 risk prevention

### Position Health Scoring
- Health scores from 0-100 based on:
  - Days to expiration
  - P&L percentage
  - Strategy-specific factors
  - Risk metrics

### Buying Power Management
- Target 35% usage with 50% maximum
- Strategy-specific BP allocation
- Phase-appropriate recommendations
- VIX-adjusted position sizing

## Data Export and Backup

### Automated Features
- Auto-save every 5 minutes
- Daily P&L snapshots
- Trade completion logging
- Position status updates

### Manual Export Options
- CSV trade exports with custom filters
- Analytics reports in JSON format
- Comprehensive system reports
- Historical P&L data

## Integration with Existing Framework

This system integrates seamlessly with:
- **TastyTrade API**: Real-time position updates
- **Pattern Analysis Engine**: Trade entry signals
- **Greeks Integration**: Options-specific monitoring
- **Risk Manager**: Position sizing and limits
- **Signal Generator**: Entry/exit notifications

## Getting Started

1. **Start the Server**
   ```bash
   npm run server
   ```

2. **Access Dashboard**
   - Navigate to `http://localhost:3000/dashboard`
   - View comprehensive trading metrics

3. **Add Your First Position**
   - Use the API or integrate with your existing entry system
   - Monitor through the dashboard

4. **Track Your Progress**
   - Daily review of Friday 0DTE performance
   - Weekly assessment of goal progress
   - Monthly export and analysis

## Support and Troubleshooting

### Common Issues
- **System not initialized**: Ensure unified system is properly initialized
- **Missing market data**: Check API connectivity and data updates
- **Export failures**: Verify file permissions and disk space

### Log Monitoring
- Check application logs for system errors
- Monitor WebSocket connections for real-time updates
- Review P&L calculation warnings

This system provides the foundation for systematic trading success, ensuring disciplined execution of Tom King's proven strategies while maintaining strict risk management toward the £35k → £80k goal.