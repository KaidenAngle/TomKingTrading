# TomKingTrader - Complete Systematic Trading System

A comprehensive automated trading system implementing Tom King's proven methodology with real-time TastyTrade API integration, advanced pattern analysis, robust risk management, and professional web dashboard.

## 🎯 Project Goal
Transform £35,000 into £80,000 within 8 months using Tom King's systematic options and futures strategies, achieving financial freedom with £10,000 monthly income through 12% monthly compounding while maintaining 52-65% buying power usage and strict risk protocols.

## ✨ Key Features

### 🌐 **Professional Web Dashboard**
- **Real-time Trading Dashboard** with WebSocket updates
- **Signal Alerts System** with priority notifications
- **Position Health Monitoring** with Greeks visualization
- **Pattern Analysis Display** with quality scoring
- **Risk Metrics Visualization** with correlation tracking
- **Manual/API Mode Toggle** for flexible operation
- **Chart Integration** for P&L, Greeks, and risk analysis

### 📊 **Complete API Integration**
- **OAuth2 Authentication** with automatic token refresh
- **Real-time Market Data** streaming via TastyTrade API
- **Position Management** with live Greeks monitoring  
- **Order Preparation** (manual submission for safety)
- **WebSocket Support** for live data feeds
- **Automatic Fallback** to manual mode if API fails

### 🎯 **Real-time Signal Generation**
- **Entry Signal Detection** for all 10 strategies
- **Exit Signal Management** with health-based triggers
- **Opportunity Ranking** by expected value
- **Time-sensitive Alerts** (0DTE Friday, Tuesday strangles)
- **VIX Opportunity Detection** for generational trades
- **Risk Alert System** with emergency protocols

### 🧠 **Advanced Pattern Analysis**
- **2000+ Line Analysis Engine** with comprehensive pattern recognition
- **Technical Indicators**: RSI, EMA, ATR, VWAP calculations
- **Range Analysis**: 5-day and 20-day range positioning
- **IV Analysis**: IV Rank/Percentile with premium environment assessment
- **Quality Scoring**: EXCELLENT/GOOD/FAIR/POOR pattern ratings
- **Strike Calculations**: Precise 5-delta strike selection for all strategies

### 📈 **Position Management**
- **Health Scoring**: Comprehensive position health with 100-point scale
- **Correlation Tracking**: Prevents August 5, 2024 type disasters
- **Exit Management**: Automated exit trigger detection (50% rule, 21 DTE, etc.)
- **BP Optimization**: Phase-based buying power allocation
- **Real-time Monitoring**: Continuous position health assessment

### ⚠️ **Risk Management**
- **VIX Regime Detection**: 6-level VIX analysis with BP adjustments
- **August 5 Prevention**: Specific protocols to prevent £308k loss scenarios
- **Emergency Protocols**: Automatic risk escalation and alert systems
- **Correlation Limits**: Maximum 2-3 positions per correlation group
- **Phase-based Limits**: Account value-driven position sizing

## 🏗️ System Architecture

```
TomKingTrader/
├── src/
│   ├── app.js                # Express server & main application entry point
│   ├── index.js              # Main system orchestrator & integration module
│   ├── signalGenerator.js    # Real-time signal generation engine
│   ├── tastytradeAPI.js      # Complete TastyTrade API integration
│   ├── patternAnalysis.js    # Pattern recognition engine (2000+ lines)
│   ├── positionManager.js    # Position health and correlation tracking
│   ├── riskManager.js        # VIX regime and risk management
│   ├── greeksCalculator.js   # Options Greeks calculations
│   ├── strategies.js         # All 10 Tom King strategies
│   └── config.js             # Centralized configuration management
├── public/
│   ├── index.html           # Professional trading dashboard
│   ├── css/dashboard.css    # Dashboard styling
│   └── js/dashboard.js      # WebSocket client & UI interactions
├── test/                    # Comprehensive test suite
├── docs/                    # Documentation
├── data/                    # Data storage & cache
└── logs/                    # Application logs
```

## 🚀 Quick Start

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/tom-king-trader.git
cd tom-king-trader
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your TastyTrade API credentials (optional for manual mode)
```

4. **Start the application:**
```bash
# Production mode
npm start

# Development mode with auto-restart
npm run dev
```

5. **Open the dashboard:**
```
http://localhost:3000
```

### Web Dashboard Usage

#### 1. Initialize the System
- Access the dashboard at `http://localhost:3000`
- Choose **API Mode** (with TastyTrade credentials) or **Manual Mode**
- Select your account phase (1-4) and enter account value
- Click **Initialize System**

#### 2. Manual Mode Operation
If using manual mode (no API):
- Go to **Manual Data Input** tab
- Enter VIX level and market data (JSON format)
- Input current positions (JSON array)
- Click **Run Complete Analysis**

#### 3. API Mode Operation  
If using API mode:
- System automatically collects market data
- Positions are updated from your TastyTrade account
- Analysis runs automatically every 15 minutes
- Real-time signals are generated and displayed

#### 4. Monitor Signals
- View active signals in the **Signal Alerts** panel
- Signals are categorized: Entry, Exit, Risk, VIX Opportunities
- High-priority signals show desktop notifications
- Click refresh to manually update signals

#### 5. Track Positions
- Monitor position health in the **Active Positions** panel
- View Greeks, P&L, and health scores
- Exit triggers are clearly highlighted
- Correlation violations are immediately flagged

### Programmatic Usage

#### Basic API Integration
```javascript
const { TomKingTrader } = require('./src/index');

// Initialize system
const trader = new TomKingTrader({
  apiMode: true,           // Use TastyTrade API
  phase: 2,               // Account phase (£40-60k)
  accountValue: 45000,    // Current account value
  environment: 'production'
});

// Initialize and run analysis
async function runTrading() {
  // Initialize system
  await trader.initialize();
  
  // Collect market data
  await trader.collectMarketData();
  
  // Update positions
  await trader.updatePositions();
  
  // Run comprehensive analysis
  const analysis = await trader.runAnalysis({
    vixLevel: 18.5,
    phase: 2,
    accountValue: 45000
  });
  
  console.log('📊 Analysis Results:');
  console.log(`Risk Level: ${analysis.risk.overallRisk.level}`);
  console.log(`Excellent Patterns: ${analysis.summary.excellentPatterns}`);
  console.log(`BP Usage: ${analysis.positions.bpUsage.totalBP}%`);
  
  // Display recommendations
  analysis.recommendations.forEach(rec => {
    console.log(`${rec.priority}: ${rec.title}`);
  });
}

runTrading().catch(console.error);
```

#### Signal Generation Usage
```javascript
const { SignalGenerator } = require('./src/signalGenerator');

// Initialize signal generator
const signalGen = new SignalGenerator({
  enableRealTime: true,
  signalCooldown: 300000, // 5 minutes
  maxSignalsPerHour: 20,
  minSignalQuality: 70
});

// Generate signals
const signals = await signalGen.generateSignals({
  vixLevel: 18.5,
  phase: 2,
  accountValue: 45000,
  timeOfDay: '10:45'
});

console.log(`Generated ${signals.signals.length} signals`);
signals.signals.forEach(signal => {
  console.log(`${signal.priority}: ${signal.ticker} ${signal.strategy}`);
});
```

#### Manual Mode Usage
```javascript
// For manual data input (no API)
const trader = new TomKingTrader({
  apiMode: false,
  phase: 1,
  accountValue: 35000
});

await trader.initialize();

// Provide manual market data
const marketData = {
  ES: {
    currentPrice: 5420,
    openPrice: 5415,
    high5d: 5450,
    low5d: 5380,
    rsi: 45.2,
    ema8: 5415,
    ema21: 5405,
    ivRank: 25,
    ivPercentile: 30
  },
  VIX: { currentLevel: 16.2, regime: 'NORMAL' },
  DXY: { currentPrice: 103.45, trend: 'UP' }
};

// Provide manual positions
const positions = [
  {
    ticker: 'ES',
    strategy: 'STRANGLE',
    dte: 45,
    unrealizedPnL: 120,
    entry: 2.80,
    currentValue: 2.20,
    quantity: 2,
    strikes: { call: 5500, put: 5350 }
  }
];

const analysis = await trader.runAnalysis({
  marketData,
  positions,
  vixLevel: 16.2
});
```

## 📡 REST API Documentation

### Base URL
```
http://localhost:3000/api
```

### Endpoints

#### `GET /health`
System health check
```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "initialized": true,
  "mode": "API",
  "uptime": 3600
}
```

#### `POST /api/initialize`
Initialize the trading system
```bash
curl -X POST http://localhost:3000/api/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "apiMode": true,
    "phase": 2,
    "accountValue": 45000
  }'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "mode": "API",
    "phase": 2,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

#### `POST /api/analyze`
Run comprehensive analysis
```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "vixLevel": 18.5,
    "phase": 2,
    "accountValue": 45000
  }'
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "phase": 2,
    "vixLevel": 18.5,
    "patterns": { /* Pattern analysis results */ },
    "positions": { /* Position health data */ },
    "risk": { /* Risk assessment */ },
    "recommendations": [ /* Trading recommendations */ ]
  },
  "signals": [ /* Generated signals */ ],
  "signalSummary": {
    "totalGenerated": 5,
    "highQuality": 3,
    "entrySignals": 2,
    "exitSignals": 1
  }
}
```

#### `GET /api/status`
Get current system status
```bash
curl http://localhost:3000/api/status
```

#### `GET /api/signals`
Get active signals
```bash
curl http://localhost:3000/api/signals
```

#### `POST /api/market-data`
Update market data (manual mode)
```bash
curl -X POST http://localhost:3000/api/market-data \
  -H "Content-Type: application/json" \
  -d '{
    "marketData": {
      "ES": { "currentPrice": 5420, "ivRank": 25 },
      "VIX": { "currentLevel": 18.5 }
    }
  }'
```

#### `POST /api/positions`
Update positions (manual mode)
```bash
curl -X POST http://localhost:3000/api/positions \
  -H "Content-Type: application/json" \
  -d '{
    "positions": [
      {
        "ticker": "ES",
        "strategy": "STRANGLE",
        "dte": 45,
        "unrealizedPnL": 120
      }
    ]
  }'
```

#### `POST /api/report`
Generate comprehensive report
```bash
curl -X POST http://localhost:3000/api/report \
  -H "Content-Type: application/json" \
  -d '{
    "vixLevel": 18.5,
    "includeCharts": true
  }'
```

#### `GET /api/config`
Get system configuration
```bash
curl http://localhost:3000/api/config
```

### WebSocket API

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onopen = function(event) {
  console.log('Connected to TomKingTrader WebSocket');
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log('Message type:', data.type);
  console.log('Data:', data.data);
};
```

#### Message Types
- `welcome`: Initial connection message
- `system_status`: System status updates
- `analysis_complete`: Analysis results
- `signal`: New trading signal
- `active_signals`: Current active signals
- `market_data_updated`: Market data refresh
- `positions_updated`: Position data refresh
- `error`: Error messages

## 📋 Trading Strategies Implemented

### Phase 1 (£30-40k) - Foundation
- **MCL/MGC Strangles**: 90 DTE, 5-delta strikes
- **0DTE Friday**: After 10:30 AM only  
- **IPMCC**: Income generation with defined risk
- **Maximum**: 3 total positions, 1 per correlation group

### Phase 2 (£40-60k) - Scaling  
- **MES LT112**: Long-term 112 DTE strategy
- **Enhanced 0DTE**: Multiple structures (standard, broken wing, batman)
- **LEAP Positioning**: Long-term income generation
- **Ratio Spreads**: Advanced income strategies
- **Maximum**: 8 total positions, 2 per correlation group

### Phase 3 (£60-75k) - Optimization
- **ES Upgrade**: Full-size futures contracts
- **Butterfly Systems**: Range-bound optimization
- **Advanced Strangles**: Multi-expiration management
- **Diagonal Spreads**: Time decay optimization
- **Maximum**: 12 total positions, 2 per correlation group

### Phase 4 (£75k+) - Professional Deployment
- **Complete LEAP Ladder**: 10+ position system
- **Box Spreads**: Risk-free income generation
- **Multi-Asset Diversification**: All product classes
- **Advanced Section 9B**: Complete strategy arsenal
- **Maximum**: 20+ total positions, 3 per correlation group

## ⚠️ Risk Management Features

### VIX Regime System
- **EXTREMELY LOW** (<12): Reduce exposure, complacency risk
- **LOW** (12-16): Selective premium selling
- **NORMAL** (16-20): Optimal trading environment  
- **ELEVATED** (20-25): Rich premiums, increased monitoring
- **HIGH** (25-30): Excellent opportunities, reduced size
- **EXTREME** (30+): Generational opportunity, crisis mode

### August 5, 2024 Prevention Protocols
The system implements specific safeguards to prevent the £308k loss that occurred on August 5, 2024:

- **Correlation Limits**: Maximum 2 positions per group (3 for Phase 4)
- **Real-time Monitoring**: Continuous correlation exposure tracking
- **Automatic Alerts**: Immediate warnings when limits approached
- **Emergency Protocols**: Forced position closure if limits exceeded
- **Historical Context**: References to previous correlation disasters

## 📊 Pattern Analysis Features

### Technical Analysis
- **RSI Calculation**: 14-period momentum oscillator
- **EMA Analysis**: 8-day and 21-day exponential moving averages
- **ATR Calculation**: Average True Range for volatility measurement
- **VWAP Analysis**: Volume-weighted average price calculations

### Range Analysis  
- **5-Day Range**: Short-term positioning analysis
- **20-Day Range**: Medium-term trend assessment
- **Position Scoring**: Optimal entry point identification
- **Breakout Detection**: Range expansion/contraction signals

### IV Environment Analysis
- **IV Rank/Percentile**: Historical volatility context
- **Premium Assessment**: Rich/cheap premium identification
- **Selling Signals**: Optimal premium selling opportunities
- **Buying Signals**: Premium buying opportunity detection

## 🔧 API Integration Details

### TastyTrade API Features
- **OAuth2 Authentication**: Secure token-based authentication
- **Real-time Quotes**: Live market data for all instruments
- **Option Chains**: Complete option chain data with Greeks
- **Position Tracking**: Live position and P&L monitoring
- **Order Preparation**: Complete order building (manual submission)
- **WebSocket Streaming**: Real-time data feeds via DXLink

### Error Handling
- **Progressive Backoff**: Intelligent retry mechanisms
- **Fallback Systems**: Automatic switch to manual mode
- **Rate Limit Management**: Automatic rate limiting compliance
- **Connection Recovery**: Automatic reconnection handling

## 🧪 Testing

```bash
# Run complete test suite
npm test

# Test individual modules
npm run test-api        # TastyTrade API integration
npm run test-patterns   # Pattern analysis engine
npm run test-positions  # Position management
npm run test-risk      # Risk management systems
```

## 📖 Documentation

### API Documentation
Each module is fully documented with JSDoc:
```bash
npm run docs  # Generate API documentation
```

### Examples
See the `examples/` directory for:
- Basic trading setup
- Manual mode configuration  
- API integration examples
- Risk management scenarios
- Pattern analysis demonstrations

## 🔐 Security & Configuration

### API Credentials
Store credentials securely using environment variables:
```javascript
const trader = new TomKingTrader({
  clientSecret: process.env.TASTYTRADE_CLIENT_SECRET,
  refreshToken: process.env.TASTYTRADE_REFRESH_TOKEN,
  environment: 'production'
});
```

### Environment Variables
```bash
TASTYTRADE_CLIENT_SECRET=your_client_secret
TASTYTRADE_REFRESH_TOKEN=your_refresh_token  
NODE_ENV=production
DEBUG=false
```

## 📈 Performance Metrics

### Target Returns (Per PDF Documentation)
- **Phase 1**: 6.67% monthly (£30k → £40k in 5 months)
- **Phase 2**: 6.67% monthly (£40k → £60k in 7 months)  
- **Phase 3**: 6.67% monthly (£60k → £75k in 4 months)
- **Phase 4**: 3% monthly sustainable (£75k → £100k in 9 months)

### Risk Metrics
- **Maximum BP Usage**: 35-85% depending on phase and VIX regime
- **Correlation Limits**: 2-3 positions per group maximum
- **Win Rate Targets**: 65-85% depending on strategy
- **Maximum Drawdown**: <15% per phase requirements

## 🚨 Important Disclaimers

1. **No Auto-Execution**: System prepares orders but requires manual submission for safety
2. **Paper Trading**: Test thoroughly in development environment before live trading
3. **Risk Warning**: Options and futures trading involves substantial risk of loss
4. **Education**: This system is for educational and systematic trading purposes
5. **Compliance**: Ensure compliance with local regulations and broker requirements

## 🔧 Configuration & Environment Setup

### Environment Variables
Create a `.env` file with your configuration:
```env
# Server Configuration
PORT=3000
WS_PORT=3001
NODE_ENV=production

# TastyTrade API (Optional - for API mode)
TASTYTRADE_CLIENT_ID=your-client-id
TASTYTRADE_CLIENT_SECRET=your-client-secret
TASTYTRADE_REFRESH_TOKEN=your-refresh-token

# Application Settings
SCHEDULER_ENABLED=true
LOG_LEVEL=info
ENABLE_RATE_LIMITING=true
```

### System Configuration
The system can be configured via `src/config.js`:
- **Phase Requirements**: Account value thresholds and strategy access
- **Risk Limits**: Maximum BP usage, correlation limits, emergency triggers  
- **Strategy Parameters**: Win rates, returns, BP requirements for all 10 strategies
- **VIX Regimes**: 6-level VIX analysis with automatic BP adjustments
- **Technical Indicators**: RSI, EMA, ATR, VWAP calculation parameters

## 🧪 Testing & Validation

### Automated Testing
```bash
# Run complete test suite
npm test

# Run specific test categories  
npm run test-api        # TastyTrade API integration
npm run test-patterns   # Pattern analysis engine
npm run test-positions  # Position health calculations
npm run test-risk       # Risk management protocols
npm run test-signals    # Signal generation algorithms
```

### Manual Testing Scenarios
1. **August 5, 2024 Prevention**: Test correlation limit enforcement
2. **VIX Spike Response**: Input VIX levels 35+ for emergency protocols
3. **Phase Progression**: Test account value transitions between phases
4. **0DTE Restrictions**: Verify Friday after 10:30 AM only trading
5. **Greeks Monitoring**: Validate delta, gamma, theta, vega calculations

### Performance Benchmarks
- **Analysis Speed**: <2 seconds for complete analysis
- **Signal Generation**: <1 second for all strategies
- **Memory Usage**: <500MB under normal operation  
- **API Response**: <500ms for most endpoints
- **WebSocket Latency**: <100ms for real-time updates

## 🚨 Troubleshooting Guide

### Common Issues

#### 1. Dashboard Connection Problems
```bash
# Check server status
curl http://localhost:3000/health

# Verify WebSocket connection
curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     -H "Sec-WebSocket-Version: 13" \
     http://localhost:3001/
```

#### 2. API Authentication Failures  
- Verify credentials in `.env` file
- Check token expiration (auto-refresh should handle this)
- Test connection with production environment first
- Review TastyTrade API documentation for changes

#### 3. Memory or Performance Issues
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 src/app.js

# Clear application cache
rm -rf data/cache/*
rm -rf logs/*.log

# Monitor resource usage
top -p $(pgrep -f "node.*app.js")
```

#### 4. Signal Generation Problems
- Check market data freshness (should be <5 minutes old)
- Verify VIX level is within expected range (10-80)
- Ensure position data is properly formatted
- Review correlation group assignments

### Debug Mode
Enable comprehensive logging:
```bash
NODE_ENV=development LOG_LEVEL=debug npm start
```

### Log Analysis
```bash
# View recent errors
tail -f logs/error.log

# Monitor trading activity
tail -f logs/trading.log

# Search for specific issues
grep -i "correlation" logs/combined.log
```

## 📊 Performance Monitoring

### Key Metrics to Track
1. **Signal Quality**: Percentage of EXCELLENT vs POOR patterns
2. **Response Time**: API endpoint and analysis speed
3. **Memory Usage**: Prevent memory leaks in long-running processes
4. **WebSocket Stability**: Connection uptime and reconnection frequency
5. **Error Rates**: Failed analysis attempts and API timeouts

### Health Checks
The system provides multiple health monitoring endpoints:
- `GET /health`: Basic system status
- `GET /api/status`: Detailed component status  
- WebSocket heartbeat every 30 seconds
- Automated scheduler health monitoring

## 🔐 Security & Best Practices

### API Security
- Store credentials in environment variables only
- Use HTTPS in production deployments
- Enable rate limiting to prevent abuse
- Regular token rotation (handled automatically)
- Input validation on all endpoints

### Data Protection
- No sensitive information in logs
- Position data encrypted at rest
- Secure WebSocket connections
- CORS properly configured

### Operational Security
- Regular updates of dependencies
- Monitor for security vulnerabilities
- Backup configuration and data
- Use process management (PM2) in production

## 🚀 Deployment Guide

### Production Deployment
1. **Server Setup**:
```bash
# Install Node.js 14+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2
```

2. **Application Deployment**:
```bash
# Clone and setup
git clone [repository-url]
cd tom-king-trader
npm ci --production

# Configure environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

3. **Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3000 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Tom King** - Original trading methodology and systematic approach
- **TastyTrade** - API integration and market data
- **Framework Contributors** - System development and testing

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/tom-king-trader/issues)
- **Documentation**: [API Docs](https://your-username.github.io/tom-king-trader/)
- **Examples**: See `examples/` directory

---

**Built with ❤️ for systematic traders who value precision, risk management, and consistent profitability.**