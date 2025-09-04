# QuantConnect LEAN - Tom King Trading Framework

## 🚀 Professional Migration from JavaScript to QuantConnect

### Project Overview
This is the new home for the Tom King Trading Framework, migrated to QuantConnect LEAN for professional-grade infrastructure. Complete separation from the JavaScript implementation ensures clean development and parallel testing.

### Why QuantConnect LEAN?
- ✅ **Full TastyTrade Integration** - Both data and live trading
- ✅ **20+ Years Historical Data** - Professional backtesting
- ✅ **Built-in Dashboard** - No custom UI needed
- ✅ **Cloud Deployment** - 24/7 execution
- ✅ **Institutional Infrastructure** - Hedge fund grade

### Project Structure
```
QuantConnectLEAN/
├── main.py                    # Main algorithm entry point
├── strategies/                # Tom King strategies
│   ├── friday_0dte.py        # Friday 0DTE (88% win rate)
│   ├── long_term_112.py      # 45 DTE Long Term 112
│   ├── futures_strangle.py   # Futures strangles
│   └── defensive.py          # 21 DTE adjustments
├── risk/                      # Risk management
│   ├── position_sizing.py    # VIX-based BP (45-80%)
│   ├── correlation.py        # Max 3 per group
│   └── vix_regime.py         # 5 volatility regimes
├── config/                    # Configuration
│   ├── parameters.py         # Tom King parameters
│   ├── symbols.py            # Trading symbols
│   └── account_phases.py     # £30k-80k phases
├── tests/                     # Testing
├── research/                  # Strategy research
├── backtests/                 # Backtest results
└── live/                      # Live trading logs
```

### Quick Start

#### 1. Install LEAN CLI
```bash
pip install lean
lean login
```

#### 2. Create Project
```bash
lean project-create "TomKingTrading"
cd TomKingTrading
```

#### 3. Connect TastyTrade
```bash
lean cloud pull --project "TomKingTrading"
lean cloud live "TomKingTrading" \
  --brokerage "Tastytrade" \
  --data-feed "Tastytrade" \
  --node "L-MICRO" \
  --auto-restart yes
```

### Migration Timeline
- **Phase 1** (Days 1-5): Setup & Foundation
- **Phase 2** (Days 6-15): Strategy Migration
- **Phase 3** (Days 16-20): Backtesting
- **Phase 4** (Days 21-25): Parallel Testing
- **Phase 5** (Days 26-30): Production Cutover

### Key Parameters

#### Account Phases
- **Phase 1** (£30-40k): MCL, MGC, GLD, TLT, 0DTE
- **Phase 2** (£40-60k): +MES, MNQ, currencies
- **Phase 3** (£60-75k): Full futures upgrade
- **Phase 4** (£75k+): All strategies active

#### VIX-Based Position Sizing
- VIX < 15: 45% max BP
- VIX 15-20: 52% max BP
- VIX 20-25: 65% max BP
- VIX 25-35: 75% max BP
- VIX > 35: 80% max BP

#### Strategy Targets
- Friday 0DTE: 88% win rate
- Long Term 112: 60%+ win rate
- Futures Strangles: 70%+ win rate
- Monthly Return: 6-12%
- Max Drawdown: <15%

### Development Status
- [x] Project structure created
- [ ] LEAN CLI installed
- [ ] QuantConnect account created
- [ ] TastyTrade connected
- [ ] Friday 0DTE ported
- [ ] Long Term 112 ported
- [ ] Futures Strangles ported
- [ ] 2-year backtest complete
- [ ] Paper trading active
- [ ] Live trading ready

### Resources
- [QuantConnect Documentation](https://www.quantconnect.com/docs)
- [LEAN GitHub](https://github.com/QuantConnect/Lean)
- [TastyTrade Integration](https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/brokerages/tastytrade)
- [Algorithm Examples](https://github.com/QuantConnect/Lean/tree/master/Algorithm.Python)

### Contact & Support
- QuantConnect Forum: [quantconnect.com/forum](https://www.quantconnect.com/forum)
- TastyTrade Support: api.support@tastytrade.com
- Project Status: See MIGRATION_STATUS.md

---

**Goal:** Transform £35,000 → £80,000 in 8 months using Tom King's proven strategies with institutional infrastructure.

**Start Date:** September 4, 2025
**Target Date:** October 4, 2025 (Migration Complete)
**Production Date:** October 5, 2025 (Live Trading)