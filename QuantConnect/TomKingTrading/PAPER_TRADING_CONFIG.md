# Paper Trading Configuration

## QuantConnect Paper Trading Setup

### Project Details
- **Project ID**: 24926818
- **Project Name**: TomKingTrading
- **Compile ID**: 379e3fcd374bcf610e04ce9f4d279c46-b643304563811b26d167e6c4165e17e7
- **Compilation Status**: ✅ BuildSuccess

### Paper Trading Parameters

```python
# Recommended initial paper trading settings
PAPER_TRADING_CONFIG = {
    # Reduced position sizes for safety
    "position_multiplier": 0.25,  # Start with 25% of normal size
    
    # Capital allocation
    "starting_capital": 100000,  # Paper money
    
    # Strategy allocations (% of capital)
    "strategy_allocations": {
        "0DTE": 10,      # High risk, small allocation
        "Futures": 20,   # Moderate risk
        "LT112": 30,     # Core strategy
        "IPMCC": 20,     # Income strategy
        "LEAP": 20       # Long-term hedges
    },
    
    # Risk limits (more conservative for paper)
    "max_drawdown": 0.05,  # 5% max drawdown
    "max_vix": 25,         # Lower VIX threshold
    "min_correlation": 0.5, # Tighter correlation
    
    # Order settings
    "use_limit_orders": True,
    "limit_order_offset": 0.40,  # 40% into spread
    
    # Monitoring
    "log_all_trades": True,
    "dashboard_update_frequency": 60,  # seconds
    "heartbeat_frequency": 300,  # 5 minutes
}
```

### Deployment Steps

1. **Upload Latest Code**
   - All files synced with CompileID: 379e3fcd374bcf610e04ce9f4d279c46
   
2. **Create Paper Trading Node**
   ```python
   # In QuantConnect UI:
   # 1. Go to Live Trading
   # 2. Select "Paper Trading"
   # 3. Choose "QuantConnect Paper Brokerage"
   # 4. Set starting capital: $100,000
   ```

3. **Connect Data Feeds**
   - Primary: QuantConnect Data
   - Options: QuantConnect Options Feed
   - Futures: QuantConnect Futures Feed

4. **Launch Algorithm**
   - Use latest compiled version
   - Monitor initial startup
   - Check all circuit breakers activate

### Monitoring Checklist

#### First Hour
- [ ] Algorithm starts without errors
- [ ] Dashboard initializes
- [ ] Trade logger creates first entries
- [ ] Circuit breakers show green
- [ ] Heartbeat active

#### First Day
- [ ] At least one strategy attempts trade
- [ ] Limit orders placed correctly
- [ ] Greeks calculated for positions
- [ ] No critical errors in logs
- [ ] Position recovery tested

#### First Week
- [ ] All strategies have traded
- [ ] Risk metrics stay within bounds
- [ ] Dashboard accurately tracks P&L
- [ ] Circuit breakers activate when needed
- [ ] No memory leaks or crashes

### Success Criteria

1. **Technical Success**
   - Zero critical errors
   - All strategies execute
   - Orders fill reasonably
   - Dashboard tracks accurately

2. **Trading Success**
   - Drawdown < 5%
   - All strategies profitable or neutral
   - Greeks balanced
   - Correlation maintained

3. **Ready for Live**
   - 30 days paper trading
   - Consistent performance
   - All edge cases handled
   - Risk management proven

---

## Status: READY FOR PAPER DEPLOYMENT ✅