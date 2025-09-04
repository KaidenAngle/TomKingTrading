# QuantConnect LEAN Setup Guide for Tom King Trading

## 📚 Available Documentation

### PDFs We Have:
1. **Quantconnect-Writing-Algorithms-Python.pdf** - Algorithm development guide
2. **Quantconnect-Local-Platform-Python.pdf** - Local setup and development

### Recommended PDFs to Download:
1. **LEAN CLI Documentation**
   - URL: https://www.quantconnect.com/docs/v2/lean-cli
   - Click "Download PDF" button on the page
   - Contains complete CLI setup instructions

2. **TastyTrade Integration Guide**
   - GitHub: https://github.com/QuantConnect/Lean.Brokerages.Tastytrade
   - Contains implementation details and setup

3. **Algorithm Framework Guide**
   - URL: https://www.quantconnect.com/docs/v2/writing-algorithms/algorithm-framework
   - Covers options strategies implementation

## 🚀 Step-by-Step Setup Instructions

### Step 1: Install Prerequisites
```bash
# Install Python 3.11+
python --version

# Install pip
pip --version

# Install .NET 6.0 SDK (required for LEAN)
# Download from: https://dotnet.microsoft.com/download/dotnet/6.0
```

### Step 2: Install LEAN CLI
```bash
# Install LEAN CLI via pip
pip install lean

# Verify installation
lean --version

# Login to QuantConnect (create account first at quantconnect.com)
lean login
# Enter your QuantConnect user ID and API token
```

### Step 3: Initialize Project
```bash
# Navigate to our new project folder
cd D:/OneDrive/Trading/Claude/QuantConnectLEAN

# Initialize LEAN project
lean init

# Create new algorithm
lean project-create "TomKingTrading" --language python
```

### Step 4: Configure TastyTrade
```bash
# Pull cloud configuration
lean cloud pull

# Configure live trading with TastyTrade
lean live deploy "TomKingTrading"
# Select option 17: TastyTrade
# Enter TastyTrade credentials when prompted
```

### Step 5: Local Development Setup
```python
# config.json configuration for TastyTrade
{
    "environment": "live-tastytrade",
    "algorithm-type-name": "TomKingTradingAlgorithm",
    "algorithm-language": "Python",
    "algorithm-location": "../../../Algorithm.Python/TomKingTradingAlgorithm.py",
    
    "live-mode-brokerage": "TastyTradeBrokerage",
    "data-queue-handler": "TastyTradeBrokerage",
    
    "setup-handler": "QuantConnect.Lean.Engine.Setup.BrokerageSetupHandler",
    "result-handler": "QuantConnect.Lean.Engine.Results.LiveTradingResultHandler",
    "data-feed-handler": "QuantConnect.Lean.Engine.DataFeeds.LiveTradingDataFeed",
    "real-time-handler": "QuantConnect.Lean.Engine.RealTime.LiveTradingRealTimeHandler",
    "transaction-handler": "QuantConnect.Lean.Engine.TransactionHandlers.BrokerageTransactionHandler",
    
    "tastytrade-username": "your-username",
    "tastytrade-password": "your-password",
    "tastytrade-account-number": "your-account",
    "tastytrade-use-sandbox": false
}
```

### Step 6: Test Connection
```python
# test_connection.py
from lean.components.api.api_client import APIClient

def test_tastytrade_connection():
    """Test TastyTrade API connection"""
    client = APIClient()
    
    # Authenticate
    response = client.authenticate()
    print(f"Authentication: {response}")
    
    # Get account info
    accounts = client.get_accounts()
    print(f"Accounts: {accounts}")
    
    # Get market data
    quote = client.get_quote("SPY")
    print(f"SPY Quote: {quote}")

if __name__ == "__main__":
    test_tastytrade_connection()
```

### Step 7: Backtest Locally
```bash
# Run backtest on local LEAN engine
lean backtest "TomKingTrading" \
    --start 20230101 \
    --end 20250101 \
    --cash 35000 \
    --data-provider "TastyTrade"

# View results
lean report
```

### Step 8: Paper Trading
```bash
# Deploy for paper trading
lean live deploy "TomKingTrading" \
    --brokerage "QuantConnectPaperTrading" \
    --data-feed "TastyTrade" \
    --notify-email "your-email@example.com"
```

### Step 9: Live Trading
```bash
# Deploy for live trading (after successful paper trading)
lean live deploy "TomKingTrading" \
    --brokerage "TastyTrade" \
    --data-feed "TastyTrade" \
    --node "L-MICRO" \
    --auto-restart yes \
    --notify-email "your-email@example.com"
```

## 📝 Configuration Files

### lean.json (Project Configuration)
```json
{
    "data-folder": "data",
    "algorithm-language": "Python",
    "engine-version": "latest",
    "parameters": {
        "starting-capital": 35000,
        "target-capital": 80000,
        "max-bp-usage": 0.65,
        "vix-regime-enabled": true
    }
}
```

### requirements.txt (Python Dependencies)
```
quantconnect-stubs
numpy
pandas
scipy
matplotlib
```

## 🎯 Key Commands Reference

```bash
# Project Management
lean create-project <name>     # Create new project
lean cloud pull                # Pull from cloud
lean cloud push                # Push to cloud

# Backtesting
lean backtest <project>        # Run backtest
lean optimize <project>        # Run optimization
lean report                    # Generate report

# Live Trading
lean live deploy <project>     # Deploy live
lean live stop <deployment>    # Stop deployment
lean live liquidate <deployment> # Close all positions

# Data
lean data download             # Download historical data
lean data generate             # Generate random data

# Debugging
lean logs <deployment>         # View logs
lean live status              # Check status
```

## 🔧 Troubleshooting

### Common Issues:

1. **"TastyTrade authentication failed"**
   - Verify credentials in config.json
   - Check if using correct account number
   - Ensure not in sandbox mode for live trading

2. **"No market data available"**
   - Confirm TastyTrade account is funded
   - Check market hours (9:30 AM - 4:00 PM ET)
   - Verify data subscription

3. **"Module not found" errors**
   - Run: `pip install -r requirements.txt`
   - Ensure Python 3.11+ is installed
   - Check PYTHONPATH includes project directory

4. **"LEAN engine not starting"**
   - Verify .NET 6.0 SDK installed
   - Check Docker is running (if using Docker mode)
   - Review logs: `lean logs`

## 📞 Support Resources

- **QuantConnect Forum**: https://www.quantconnect.com/forum
- **Discord**: https://discord.gg/quantconnect
- **TastyTrade API Support**: api.support@tastytrade.com
- **GitHub Issues**: https://github.com/QuantConnect/Lean/issues

## ✅ Setup Checklist

- [ ] Python 3.11+ installed
- [ ] .NET 6.0 SDK installed
- [ ] LEAN CLI installed via pip
- [ ] QuantConnect account created
- [ ] TastyTrade account connected
- [ ] Project initialized
- [ ] main.py created
- [ ] Friday 0DTE strategy ported
- [ ] Backtest successful
- [ ] Paper trading active
- [ ] Live trading ready

## 💡 Next Steps

1. Complete the setup checklist above
2. Port remaining strategies (Long Term 112, Futures Strangles)
3. Run 2-year backtest to validate performance
4. Paper trade for 1-2 weeks
5. Begin live trading with small positions
6. Scale up as confidence builds

---

**Remember**: The goal is professional infrastructure for the £35k→£80k journey. Take time to set up properly!