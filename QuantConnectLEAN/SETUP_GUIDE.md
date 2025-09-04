# QuantConnect LEAN Setup Guide - Tom King Trading Framework v17

## Quick Start Installation

### Prerequisites
- Windows 10/11, macOS, or Linux
- Python 3.8+ installed
- Docker Desktop
- QuantConnect account (free)
- TastyTrade account for live trading

---

## 1. Docker Desktop Installation

### Windows/Mac:
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Install and restart system
3. Start Docker Desktop
4. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

### Linux (Ubuntu):
```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
```

---

## 2. LEAN CLI Installation

### Install LEAN CLI:
```bash
pip install lean
```

### Verify Installation:
```bash
lean --version
# Should show: LEAN CLI version X.X.X
```

### Initialize LEAN Project:
```bash
# Navigate to your trading directory
cd D:\OneDrive\Trading\Claude\QuantConnectLEAN

# Initialize LEAN project
lean init

# This creates:
# - config/
# - data/
# - library/
# - notebooks/
# - README.md
```

---

## 3. QuantConnect Account Setup

### Create Account:
1. Visit: https://www.quantconnect.com/
2. Sign up for free account
3. Verify email address
4. Note your User ID and API Token

### Configure Authentication:
```bash
# Set up QuantConnect credentials
lean login

# Enter your:
# - User ID (from QuantConnect profile)
# - API Token (from QuantConnect profile)
```

### Alternative Manual Config:
Edit `~/.lean/credentials` file:
```json
{
  "quantconnect-user-id": "YOUR_USER_ID",
  "quantconnect-api-token": "YOUR_API_TOKEN"
}
```

---

## 4. TastyTrade Connection Setup

### Get TastyTrade Credentials:
1. Log into TastyTrade account
2. Navigate to API section
3. Generate API credentials
4. Note: Username, Password, and Account Number

### Configure Brokerage:
```bash
# Set up TastyTrade connection
lean config set default-brokerage tastyworks

# Configure credentials
lean config set tastyworks-username "YOUR_USERNAME"
lean config set tastyworks-password "YOUR_PASSWORD"
lean config set tastyworks-account-number "YOUR_ACCOUNT_NUMBER"
```

### Security Note:
Store sensitive credentials in environment variables:
```bash
# Windows
set TASTYWORKS_USERNAME=your_username
set TASTYWORKS_PASSWORD=your_password

# Linux/Mac
export TASTYWORKS_USERNAME=your_username
export TASTYWORKS_PASSWORD=your_password
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