# Tom King Trading System - QuantConnect

## Clean Project Structure

### Main Folders
- **QuantConnect/** - All QuantConnect/LEAN files
  - **TomKingTrading/** - Main trading algorithm project
  - **Documentation/** - Strategy docs and PDFs
  - **data/** - Market data files
- **TomKingTrader/** - Original JavaScript implementation (reference)

## Quick Start Commands

```bash
# Navigate to project
cd D:\OneDrive\Trading\Claude\QuantConnect\TomKingTrading

# Run simple test
lean backtest simple_test.py

# Run full Tom King system
lean backtest main.py
```

## Docker Setup
```powershell
# Pull the foundation image (NOT :latest)
docker pull quantconnect/lean:foundation
```