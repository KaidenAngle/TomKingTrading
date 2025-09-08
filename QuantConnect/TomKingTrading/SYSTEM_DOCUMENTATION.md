# Tom King Trading System v17 - Production Documentation

## System Status: ✅ PRODUCTION READY

### Quick Start
```bash
# Set API token
export QC_API_TOKEN="your-quantconnect-token"

# Run backtest
python deploy_backtest.py
```

### Core Components
- **5 Trading Strategies**: 0DTE, LT112, Futures Strangle, IPMCC, LEAP Ladders
- **Risk Management**: August 2024 protection, VIX regimes, circuit breakers
- **Integration**: TastyTrade API, QuantConnect fallback
- **Exit Rules**: 50% profit targets, 21 DTE management

### Performance Targets
- Monthly Return: 8-9%
- Win Rate: 70%+
- Max Drawdown: <20%
- Sharpe Ratio: >2.0

### Latest Audit Results
- All strategies implemented ✅
- Risk controls active ✅
- Exit rules systematic ✅
- No critical issues ✅

See `main.py` for implementation details.