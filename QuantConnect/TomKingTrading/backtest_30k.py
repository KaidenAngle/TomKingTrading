"""
Tom King Trading Framework - $30,000 Backtest Configuration
Ready for QuantConnect Platform

INSTRUCTIONS:
1. Upload this entire TomKingTrading folder to QuantConnect
2. Set main.py as the primary algorithm file
3. Run backtest with these settings

BACKTEST PARAMETERS:
- Starting Capital: $30,000
- Period: 2023-01-01 to 2025-01-01 (2 years)
- Resolution: Minute data
- Account Type: Margin (for options trading)

EXPECTED BEHAVIOR WITH $30K:
- Phase 1 Account (Conservative positioning)
- 1-2 positions max per strategy initially
- Focus on high-probability setups
- Lower margin usage (safer)

STRATEGY ACTIVATION:
- 0DTE: Fridays only, after 10:30 AM, VIX > 22
- LT112: Wednesdays, 112 DTE puts
- IPMCC: When assigned SPY shares
- Futures Strangles: 45 DTE on /MES (micro futures for small account)
- LEAP Ladders: Building protection when VIX < 20

KEY METRICS TO WATCH:
1. Sharpe Ratio (target > 1.5)
2. Max Drawdown (should stay under 15%)
3. Win Rate (expect 65-75%)
4. Annual Return (target 20-30%)
5. Number of Trades (fewer with $30k)

RISK MANAGEMENT:
- Position sizing via Kelly Criterion (0.25 factor)
- VIX-based regime detection
- 21 DTE defensive exits
- State machine error recovery (30 min timeout)

RECENT FIXES APPLIED:
✓ VIX thresholds corrected (HIGH=30, EXTREME=35)
✓ State machine auto-recovery added
✓ Kelly calculation safety (no fallback values)
✓ VIX spike deployment scaled by account size
✓ API properly initialized for Tastytrade

OPTIMIZATION NOTES:
With $30k starting capital:
- Expect 50-100 trades over 2 years
- Lower position counts = faster backtest
- Focus on quality over quantity
- Compound growth should reach ~$40-50k by end

TO RUN IN QUANTCONNECT:
1. Click "Create New Algorithm"
2. Choose "Python" 
3. Replace default code with main.py content
4. Upload all supporting files
5. Click "Backtest"
6. Review results in the dashboard
"""

# This file is documentation only - the actual algorithm is in main.py
print("Please run main.py as your QuantConnect algorithm")
print("Starting capital: $30,000")
print("Backtest period: 2023-01-01 to 2025-01-01")