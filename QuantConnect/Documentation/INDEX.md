# 📚 Documentation Index - Quick Access Guide

## 🌟 Most Important Documents

### For QuantConnect Migration:
1. 📘 **QuantConnect Setup**
   - `QuantConnect/Quantconnect-Local-Platform-Python.pdf` - Local development setup
   - `QuantConnect/Quantconnect-Writing-Algorithms-Python.pdf` - Algorithm development
   - `/QuantConnectLEAN/SETUP_GUIDE.md` - Our custom setup guide
   - `/QuantConnectLEAN/QUANTCONNECT_MIGRATION_PLAN.md` - 30-day migration timeline

2. 🎯 **Tom King Strategies**
   - `TomKingMethodology/TOM KING TRADING FRAMEWORK v17.txt` - Complete framework
   - `TomKingMethodology/Tom King Complete Trading System Documentation 2025 Updated.txt` - Latest strategies
   - `TomKingMethodology/Comprehensive Tom King Trading Research Report.txt` - Research analysis
   - `TomKingMethodology/CORE_FRAMEWORK.txt` - Core framework components
   - `TomKingMethodology/ADVANCED_STRATEGIES.txt` - Section 9B strategies
   - `TomKingMethodology/HTML_DASHBOARD.txt` - Dashboard implementation

3. 🔗 **TastyTrade Integration**
   - `TastyTrade/Getting Started.txt` - Initial setup
   - `TastyTrade/The 0Auth 2.0 Authorization Framework.txt` - Authentication
   - `TastyTrade/API_INTEGRATION.txt` - Integration guide
   - `TastyTrade/API_Reference/` - Complete API documentation
   - `TastyTrade/tastytrade-api-js-master/` - JavaScript SDK
   - `TastyTrade/tastytrade-sdk-python-master/` - Python SDK

---

## 📋 Task-Based Navigation

### "I need to..."

#### **Set up QuantConnect LEAN:**
1. Read: `QuantConnect/Quantconnect-Local-Platform-Python.pdf`
2. Follow: `/QuantConnectLEAN/SETUP_GUIDE.md`
3. Reference: `QuantConnect/Quantconnect-Writing-Algorithms-Python.pdf`

#### **Understand Tom King's strategies:**
1. Overview: `TomKingMethodology/Comprehensive Tom King Trading Research Report.txt`
2. Details: `TomKingMethodology/TOM KING TRADING FRAMEWORK v17.txt`
3. Implementation: `/QuantConnectLEAN/strategies/friday_0dte.py`

#### **Connect to TastyTrade API:**
1. Start: `TastyTrade/Getting Started.txt`
2. Auth: `TastyTrade/The 0Auth 2.0 Authorization Framework.txt`
3. Endpoints: `TastyTrade/API_Reference/`

#### **Stream market data:**
1. WebSocket: `TastyTrade/Streaming Market Data.txt`
2. Account data: `TastyTrade/Streaming Account Data.txt`
3. Implementation: See `/TomKingTrader/src/marketDataStreamer.js`

#### **Place orders:**
1. Overview: `TastyTrade/Order Flow.txt`
2. Submission: `TastyTrade/Order Submission.txt`
3. Management: `TastyTrade/Order Management.txt`

#### **Test in sandbox:**
1. Setup: `TastyTrade/Sandbox.txt`
2. FAQ: `TastyTrade/FAQ.txt`

---

## 📂 Complete Directory Structure

```
Documentation/
├── README_ORGANIZATION.md     # Organization guide
├── INDEX.md                  # This file
│
├── QuantConnect/
│   ├── Quantconnect-Local-Platform-Python.pdf
│   └── Quantconnect-Writing-Algorithms-Python.pdf
│
├── TastyTrade/
│   ├── Getting Started.txt
│   ├── Order Flow.txt
│   ├── Order Management.txt
│   ├── Order Submission.txt
│   ├── Sandbox.txt
│   ├── FAQ.txt
│   ├── Streaming Account Data.txt
│   ├── Streaming Market Data.txt
│   ├── TastyTrade API OverView.txt
│   ├── The 0Auth 2.0 Authorization Framework.txt
│   ├── API_INTEGRATION.txt
│   ├── Websites to search for further information.txt
│   ├── tastytrade-api-js-master/      # JavaScript SDK
│   ├── tastytrade-sdk-python-master/  # Python SDK
│   └── API_Reference/
│       ├── 0auth2.txt
│       ├── Account Balances.txt
│       ├── Account Positions.txt
│       ├── Account Status.txt
│       ├── Account Transactions.txt
│       ├── account-status.json
│       ├── accounts-and-customers.json
│       ├── BackTesting API.txt
│       ├── balances-and-positions_20240430.json
│       ├── Customer Account Info.txt
│       ├── instruments_20250714.json
│       ├── Instruments.txt
│       ├── margin-requirements.json
│       ├── Margin Requirements.txt
│       ├── Market Data.txt
│       ├── market-metrics.json
│       ├── market-sessions.json
│       ├── Net Liquidating Value History.txt
│       ├── orders_20250812.json
│       ├── risk-parameters.json
│       ├── Sessions.txt
│       ├── symbol-search.json
│       ├── Tastytrade Api.postman_collection.json
│       ├── Tastytrade API Setup Reference.txt
│       ├── transactions.json
│       └── watchlists.json
│
└── TomKingMethodology/
    ├── Comprehensive Tom King Trading Research Report.txt
    ├── TOM KING TRADING FRAMEWORK v17.txt
    ├── Tom King Complete Trading System Documentation 2025 Updated.txt
    ├── CORE_FRAMEWORK.txt
    ├── ADVANCED_STRATEGIES.txt
    └── HTML_DASHBOARD.txt
```

---

## 🎯 Key Parameters Reference

### Account Phases:
- **Phase 1** (£30-40k): MCL, MGC, GLD, TLT
- **Phase 2** (£40-60k): +MES, MNQ
- **Phase 3** (£60-75k): Full futures
- **Phase 4** (£75k+): All strategies

### VIX-Based BP Usage:
- VIX < 15: 45% max
- VIX 15-20: 52% max
- VIX 20-25: 65% max
- VIX 25-35: 75% max
- VIX > 35: 80% max

### Strategy Targets:
- Friday 0DTE: 88% win rate
- Long Term 112: 60%+ win rate
- Futures Strangles: 70%+ win rate
- Profit Target: 50%
- Stop Loss: 200%
- Defensive: 21 DTE

---

## 🔍 Quick Search Tips

### By Topic:
- **Authentication**: Search "OAuth" or "auth"
- **WebSocket**: Search "streaming" or "websocket"
- **Options**: Search "option" or "contract"
- **Risk**: Search "risk" or "BP" or "buying power"
- **VIX**: Search "VIX" or "volatility"

### By File Type:
- **PDFs**: `QuantConnect/*.pdf`
- **JSON**: `TastyTrade/API_Reference/*.json`
- **Text**: `TastyTrade/*.txt`

---

## 📌 Important Notes

1. **QuantConnect PDFs** are large (39MB+) - open with appropriate viewer
2. **TastyTrade API** requires authentication - see OAuth guide first
3. **Tom King docs** contain the proven strategies - follow exactly
4. **API_Reference folder** has Postman collection for testing

---

## 🆘 Help & Support

- **QuantConnect Forum**: quantconnect.com/forum
- **TastyTrade API**: api.support@tastytrade.com
- **This Project**: See `/QuantConnectLEAN/README.md`

---

*Last Updated: September 4, 2025*
*Use this index to quickly find any documentation you need!*