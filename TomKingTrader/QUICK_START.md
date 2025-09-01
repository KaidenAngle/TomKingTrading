# TomKingTrader - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 14+ installed
- TastyTrade account (optional, for API mode)
- Web browser for dashboard access

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy environment template
npm run setup

# Edit .env file with your configuration
# For manual mode, you only need basic settings
# For API mode, add your TastyTrade credentials
```

### 3. Start the Application
```bash
# Development mode
npm run dev

# Production mode  
npm run prod

# Or simply
npm start
```

### 4. Access Dashboard
Open your browser to: http://localhost:3000

## 🎯 Application Features

### Two Operation Modes

#### Manual Mode (Default)
- ✅ No API credentials required
- ✅ Input market data manually or via search parsing
- ✅ Upload positions as JSON
- ✅ Complete pattern analysis and risk management
- ✅ Real-time dashboard updates

#### API Mode (Advanced)
- 🔗 Real-time TastyTrade integration  
- 📊 Automatic market data collection
- 📋 Position synchronization
- ⏰ Scheduled analysis every 15 minutes
- 🎯 Order preparation (review before execution)

### Core Capabilities
- **Pattern Analysis**: 2000+ line JavaScript engine analyzing market patterns
- **Tom King Strategies**: 0DTE Friday, LT112, Futures Strangles, IPMCC, LEAPs
- **Risk Management**: VIX regime analysis, correlation limits, emergency protocols
- **Progressive Phases**: Automatic strategy unlock based on account growth
- **August 5 Prevention**: Built-in safeguards against correlation disasters

## 📋 Usage Instructions

### Initialize System
1. Select trading mode (Manual or API)
2. Choose account phase (1-4) or let system auto-detect
3. Enter account value in GBP (£)
4. Click "Initialize System"

### Manual Mode Workflow
1. **Market Data**: Paste JSON data or use search parsing instructions
2. **Positions**: Upload current positions as JSON array
3. **Analysis**: Run comprehensive analysis to generate signals
4. **Monitor**: Real-time dashboard updates with WebSocket connection

### API Mode Workflow
1. **Credentials**: Configure TastyTrade API credentials in .env
2. **Auto Mode**: System automatically collects data every 15 minutes
3. **Review**: Monitor signals and recommendations via dashboard
4. **Execute**: Orders prepared for your review (manual execution)

## 🎯 Tom King Strategy Implementation

### Phase 1 (£30k-£40k) - Foundation
- **Allowed**: MCL, MGC, GLD, TLT
- **Strategies**: 0DTE Friday, Basic Strangles, LT112
- **Risk**: 30% max BP usage, 5% per trade limit

### Phase 2 (£40k-£60k) - Expansion  
- **Added**: MES, MNQ, SLV, XOP
- **Strategies**: Add IPMCC, LEAPs
- **Risk**: 35% max BP usage, 4% per trade limit

### Phase 3 (£60k-£75k) - Diversification
- **Upgrade**: Full futures (ES, CL, GC, etc.)
- **Strategies**: Add Butterflies, Ratios, Diagonals
- **Risk**: 40% max BP usage, 3% per trade limit

### Phase 4 (£75k+) - Professional
- **Full Access**: All tickers and strategies
- **Advanced**: Box spreads, complex multi-leg strategies
- **Risk**: 50% max BP usage, 2.5% per trade limit

## 🚨 Risk Management

### Built-in Safeguards
- **Correlation Limits**: Max 3 positions per correlation group
- **VIX Regime Detection**: 5-level system with position sizing adjustments
- **Emergency Protocols**: Automatic risk reduction at 20% drawdown
- **August 5 Prevention**: Multi-layer protection against correlation disasters

### Daily Operations
1. **Pre-Market**: Check VIX regime and overnight developments
2. **10:30 AM**: 0DTE signals become active (Friday only)
3. **Market Hours**: Real-time position monitoring
4. **21 DTE**: Automatic management signals for adjustments
5. **50% Profit**: Target profit taking recommendations

## 📊 Dashboard Overview

### System Status Panel
- Account phase and value
- Position count and BP usage
- Risk level and VIX regime
- Connection status and last update

### Signal Alerts
- Entry signals with reasoning
- Exit signals for existing positions
- Risk alerts and emergency notifications
- Time-sensitive opportunities

### Position Management
- Real-time P&L tracking
- Greeks exposure monitoring
- Exit recommendations with timing
- Health scores for each position

### Pattern Analysis
- Technical indicator analysis
- Quality scoring (Excellent/Good/Fair/Poor)
- Strike recommendations
- Expected returns and probabilities

## 🔧 Troubleshooting

### Common Issues
- **Connection Failed**: Check WebSocket port (3001) availability
- **API Errors**: Verify TastyTrade credentials and environment
- **Missing Data**: Ensure market data format matches expected structure
- **Permission Errors**: Check file system permissions for logs directory

### Support
- Review console logs for detailed error messages
- Check `logs/trading.log` for system events
- Verify `.env` configuration matches `.env.example`
- Ensure all dependencies installed with `npm install`

## 🎯 Success Metrics

### Month 1-6: Foundation Building
- Target: 5% monthly returns
- Focus: Risk management and position sizing
- Goal: Reach £45k (Phase 2 unlock)

### Month 7-12: Expansion Phase
- Target: 6% monthly returns
- Focus: Strategy diversification
- Goal: Reach £65k (Phase 3 unlock)

### Month 13-18: Professional Deployment
- Target: 7% monthly returns
- Focus: Advanced strategies and optimization
- Goal: Reach £100k (Financial independence)

**Remember**: This system implements Tom King's proven methodology. Trust the process, follow the signals, and maintain strict risk discipline to achieve the £30k → £100k transformation in 18 months.