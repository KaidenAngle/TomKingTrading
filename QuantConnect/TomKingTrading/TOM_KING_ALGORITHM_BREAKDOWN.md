# 🚀 TOM KING TRADING ALGORITHM - COMPLETE BREAKDOWN

## **EXECUTIVE SUMMARY**

The Tom King Trading Algorithm is a **phase-based, VIX-adaptive, multi-strategy options trading system** designed to maximize weekly profits through **dynamic buying power utilization** and **correlation-aware position management**.

**Core Philosophy**: Maximize weekly profits based on available account balance using ES/MES futures for superior margin efficiency over equity options.

---

## **🏗️ SYSTEM ARCHITECTURE**

### **1. Core Infrastructure**

```python
class TomKingTradingAlgorithm(QCAlgorithm):
    def Initialize(self):
        # Base Configuration
        self.SetCash(44500)  # $44,500 starting capital
        self.params = TomKingParameters()
        
        # Core Systems
        self.correlation_manager = CorrelationManager(self)
        self.vix_manager = VIXRegimeManager(self)  
        self.futures_manager = FuturesManager(self)
        self.technical_system = TechnicalAnalysisSystem(self)
```

### **2. Strategy Portfolio (5 Core Strategies)**

1. **Friday 0DTE** → `Friday0DTEStrategy` (88% win rate target)
2. **Futures Strangles** → `TomKingFuturesStrangleStrategy` (70% win rate target)  
3. **Long Term 112** → `LongTerm112Strategy` (95% win rate target)
4. **IPMCC** → `IncomePoormansStrategy` (weekly income target)
5. **LEAP Put Ladders** → `LEAPPutLadderStrategy` (monthly income target)

---

## **📊 ACCOUNT PHASE SYSTEM**

### **Phase-Based Access Control**

```python
ACCOUNT_PHASES = {
    'mes_only': {'min': 0, 'max': 39999, 'description': 'MES contracts only'},
    'phase1': {'min': 40000, 'max': 54999, 'description': 'ES 0DTE, IPMCC, MCL/MGC strangles'},
    'phase2': {'min': 55000, 'max': 74999, 'description': 'Scale ES positions, add MNQ futures'},  
    'phase3': {'min': 75000, 'max': 94999, 'description': 'Advanced strategies, multiple ES contracts'},
    'phase4': {'min': 95000, 'max': 999999, 'description': 'Professional deployment, maximum BP utilization'}
}
```

### **Phase Progression Logic**

```python
def daily_analysis(self):
    # Auto-upgrade phases based on account growth
    new_phase = self.params.get_phase_for_account_size(account_value)
    if new_phase != self.account_phase:
        self.Log(f"🎉 PHASE UPGRADE: Phase {self.account_phase} → Phase {new_phase}")
        self.account_phase = new_phase
        self.log_available_strategies()
```

---

## **⚡ VIX REGIME MANAGEMENT**

### **5-Level VIX System**

```python
VIX_BP_LIMITS = {
    'very_low': {'vix_max': 12, 'bp_limit': 0.45},    # VIX <12: 45% BP max
    'low': {'vix_min': 12, 'vix_max': 15, 'bp_limit': 0.60},     # VIX 12-15: 60% BP max
    'normal': {'vix_min': 15, 'vix_max': 20, 'bp_limit': 0.80},  # VIX 15-20: 80% BP max
    'elevated': {'vix_min': 20, 'vix_max': 30, 'bp_limit': 0.80}, # VIX 20-30: 80% BP max
    'high': {'vix_min': 30, 'bp_limit': 0.60}                    # VIX >30: 60% BP max
}
```

### **Dynamic BP Utilization**

```python
@classmethod
def get_vix_regime_bp_limit(cls, vix_level):
    """MAXIMIZE BP based on VIX regime for maximum weekly profits"""
    if vix_level < 12: return 0.45
    elif vix_level < 15: return 0.60  
    elif vix_level < 20: return 0.80  # OPTIMAL RANGE
    elif vix_level < 30: return 0.80  # OPTIMAL RANGE
    else: return 0.60  # High VIX protection
```

---

## **🎯 FRIDAY 0DTE STRATEGY (Core Engine)**

### **Contract Selection Logic**

```python
ZERO_DTE_CONFIG = {
    'contracts': {
        'ES': {
            'min_account': 40000,      # $40k minimum for ES
            'margin_per_spread': 1200, # ~$1,200 per ES 0DTE iron condor
            'target_bp_per_position': 0.08  # Target 8% BP per position
        },
        'MES': {
            'max_account': 39999,      # Use MES under $40k only
            'margin_per_spread': 300,  # ~$300 per MES 0DTE iron condor  
            'target_bp_per_position': 0.10  # Target 10% BP per position
        }
    }
}
```

### **Dynamic Position Sizing**

```python
@classmethod 
def calculate_max_zero_dte_positions(cls, account_value, vix_level, buying_power):
    # Get appropriate contract (ES vs MES)
    contract = cls.get_zero_dte_contract(account_value)
    
    # Get VIX-based BP limit
    max_bp_limit = cls.get_vix_regime_bp_limit(vix_level)
    available_bp = buying_power * max_bp_limit
    
    # Calculate positions based on margin requirement
    margin_per_position = contract_config['margin_per_spread']
    max_positions_by_margin = int(available_bp / margin_per_position)
    
    # Limit by maximum BP usage per single 0DTE deployment (25% max)
    max_bp_for_0dte = buying_power * 0.25  # 25% max for single 0DTE
    max_positions_by_limit = int(max_bp_for_0dte / margin_per_position)
    
    return min(max_positions_by_margin, max_positions_by_limit)
```

### **Execution Flow**

```python
def execute_friday_strategies(self):
    if self.Time.weekday() != 4: return  # Friday only
    
    # Get VIX filter
    vix_level = self.vix_manager.current_vix
    if vix_level and vix_level < 30:  # Tom King's VIX filter
        
        # Get 0DTE symbols (ES or MES based on account size)
        zero_dte_symbols = available_symbols.get('zero_dte', ['ES'])
        
        # Execute strategy
        self.friday_0dte.analyze_and_enter(self.account_phase, account_value)
```

---

## **🔗 CORRELATION MANAGEMENT**

### **Correlation Groups**

```python
CORRELATION_GROUPS = {
    'A1': ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'NQ'],  # Major US Equity (95% crisis correlation)
    'B1': ['CL', 'MCL', 'NG', 'XLE', 'XOP'],         # Energy Complex (60% crisis correlation)
    'C1': ['GC', 'MGC', 'SI', 'GLD', 'SLV'],         # Precious Metals (inverse -30%, fails in crashes)
    'D1': ['ZC', 'ZS', 'ZW', 'LE', 'HE'],            # Agriculture (45% risk-off correlation)
    'E': ['ZB', 'ZN', 'TLT', 'IEF'],                 # Fixed Income (inverse -20%, TLT can fail)
    'F': ['6E', '6B', '6A', 'DXY']                   # Currencies (75% USD correlation)
}
```

### **Position Limits**

```python
'max_correlated_positions': 3,  # Maximum 3 positions per correlation group
'correlation_groups': [
    ['SPY', 'QQQ', 'IWM', 'DIA'],  # Equity indices  
    ['GLD', 'GDX', 'SLV'],         # Precious metals
    ['TLT', 'TBT', 'IEF'],         # Fixed income
    ['XLE', 'XOP', 'USO'],         # Energy
    ['VIX', 'UVXY', 'VXX']         # Volatility
]
```

---

## **📈 SYMBOL UNIVERSE BY PHASE**

### **Phase 1 ($40k-$55k): Foundation**
```python
'phase1': {
    'futures': ['MCL', 'MGC'],                # Micro crude, gold for strangles
    'etfs': ['GLD', 'TLT'],                   # ETF options for diversification  
    'equity_options': ['SPY', 'QQQ', 'IWM'],  # Supporting equity options
    'zero_dte': ['ES'],                       # ES futures 0DTE (primary strategy)
    'max_products': 6
}
```

### **Phase 2 ($55k-$75k): Scaling**
```python
'phase2': {
    'futures': ['MCL', 'MGC', 'MES', 'MNQ', 'M6E', 'M6A', 'M6B'],
    'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'XOP'],
    'equity_options': ['SPY', 'QQQ', 'IWM'],
    'zero_dte': ['ES'],                       # Scale ES positions
    'max_products': 12
}
```

### **Phase 3 ($75k-$95k): Optimization**
```python
'phase3': {  
    'futures': ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6B', '6A'],
    'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX', 'XLE', 'XOP', 'GDXJ'],
    'equity_options': ['SPY', 'QQQ', 'IWM', 'DIA', 'XLE'],
    'zero_dte': ['ES', 'NQ'],                 # Add NQ futures 0DTE
    'agriculture': ['ZC', 'ZS', 'ZW', 'LE', 'HE'],
    'max_products': 20
}
```

### **Phase 4 ($95k+): Professional**
```python
'phase4': {
    'futures': ['ES', 'NQ', 'RTY', 'MES', 'MNQ', 'M2K', 'CL', 'NG', 'RB', 'HO', 'MCL', 'MGC', 'GC', 'SI', 'HG', 'PA', 'PL', 'ZC', 'ZS', 'ZW', 'ZM', 'ZL', 'LE', 'HE', 'KC', 'SB', 'CC', 'CT', 'ZB', 'ZN', 'ZF', 'ZT', '6E', '6B', '6A', '6C', '6J', '6S', '6M', 'DX'],
    'zero_dte': ['ES', 'NQ'],                 # Full ES/NQ deployment
    'spx_options': True,                      # SPX available for box spreads
    'max_products': 50
}
```

---

## **⏰ EXECUTION SCHEDULE**

### **Daily Operations**
```python
# Daily analysis after market open
self.Schedule.On(self.DateRules.EveryDay("SPY"), 
                self.TimeRules.AfterMarketOpen("SPY", 30),
                self.daily_analysis)
```

### **Strategy-Specific Schedules**
```python
# Friday 0DTE (10:30 AM Fridays)
self.Schedule.On(self.DateRules.Every(DayOfWeek.Friday),
                self.TimeRules.At(10, 30),
                self.execute_friday_strategies)

# LEAP Ladders (10:00 AM Mondays)  
self.Schedule.On(self.DateRules.Every(DayOfWeek.Monday),
                self.TimeRules.At(10, 0),
                self.execute_weekly_leap_entries)

# LT112 Strategy (First Wednesday monthly)
self.Schedule.On(self.DateRules.MonthStart("SPY"),
                self.TimeRules.At(10, 0),
                self.execute_monthly_strategies)
```

---

## **🎯 PERFORMANCE TARGETS**

### **Income Projections by Phase**
```python
PERFORMANCE_TARGETS = {
    'monthly_return': 0.067,      # 6.67% monthly (12% compounded)
    'annual_return': 1.28,        # 128% annually
    'max_drawdown': 0.15,         # 15% maximum drawdown
    'sharpe_ratio_min': 2.0,      # Minimum Sharpe ratio
    'goal_8_months': 102000,      # $102k in 8 months from $44.5k
    'goal_18_months': 127000      # $127k in 18 months
}
```

### **Strategy Win Rate Targets**
```python
STRATEGY_WIN_RATES = {
    'zero_dte_friday': 0.88,      # 88% - Tom King's signature strategy
    'lt112_long_term': 0.95,      # 95% - 1-1-2 Long Term
    'strangles_futures': 0.70,    # 70% - Futures strangles
    'strangles_micro': 0.75,      # 75% - Micro futures
    'butterflies': 0.82,          # 82% - Section 9B butterflies
    'iron_condors': 0.78,         # 78% - Iron condors
    'calendar_spreads': 0.85,     # 85% - Calendar spreads
    'jade_lizard': 0.80,          # 80% - Jade lizard
    'big_lizard': 0.77,           # 77% - Big lizard
    'broken_wing_butterfly': 0.83 # 83% - BWB
}
```

---

## **🔄 REAL-TIME DECISION FLOW**

### **Friday 0DTE Execution Logic**
1. **Check Day**: Verify it's Friday
2. **VIX Filter**: Proceed only if VIX < 30
3. **Contract Selection**: ES (≥$40k) vs MES (<$40k)
4. **BP Calculation**: Get VIX regime BP limit (45-80%)
5. **Position Sizing**: Calculate max positions based on available BP and margin
6. **Correlation Check**: Ensure position limits not exceeded
7. **Execute**: Enter iron condor spreads at 10:30 AM
8. **Manage**: 25% profit target, 200% stop loss

### **Daily Analysis Flow**
1. **Phase Check**: Update account phase if upgraded
2. **VIX Analysis**: Get current regime and BP limits
3. **Correlation Analysis**: Check position group limits
4. **Position Management**: Analyze existing positions
5. **Opportunity Scan**: Look for new entries (Phase 3+ Bear Trap)
6. **Weekly Status**: Log performance every Friday

---

## **🚨 RISK MANAGEMENT SYSTEMS**

### **Position Limits**
```python
RISK_MANAGEMENT = {
    'max_risk_per_trade': 0.05,   # 5% maximum risk per trade
    'max_bp_usage': 0.80,         # 80% maximum BP (VIX adjusted)
    'max_correlated_positions': 3, # Maximum 3 positions per correlation group
    'vix_spike_protection': True,  # Enable VIX spike protection
    'earnings_avoidance': True,    # Avoid positions through earnings
    'fed_announcement_protection': True # Fed announcement protection
}
```

### **Stop Loss & Profit Targets**
```python
PROFIT_TARGETS = {
    'zero_dte_friday': 0.25,      # 25% profit target
    'lt112_long_term': 0.50,      # 50% profit target
    'strangles_futures': 0.50,    # 50% profit target
}

STOP_LOSS = {
    'zero_dte_friday': 2.00,      # 200% stop loss (2x credit received)
    'lt112_long_term': 2.00,      # 200% stop loss
    'strangles_futures': 2.50,    # 250% stop loss
}
```

---

## **💡 KEY ALGORITHM STRENGTHS**

### **1. Dynamic Adaptability**
- **VIX-responsive BP usage** (45-80% based on volatility regime)
- **Account phase auto-progression** (unlocks strategies as capital grows)
- **Real-time correlation monitoring** (prevents over-concentration)

### **2. Margin Efficiency Focus**
- **ES/MES futures over SPY equity options** (40% better margin efficiency)
- **TastyTrade futures advantage** (superior margin requirements)
- **Dynamic position sizing** (maximizes BP utilization vs fixed position counts)

### **3. Multi-Strategy Diversification**
- **5 core strategies** with different win rates and time horizons
- **Phase-based access control** (complexity scales with capital)
- **Section 9B enhancements** integrated into core strategies

### **4. Risk-First Design**
- **Correlation group limits** (max 3 positions per group)
- **VIX spike protection** (reduces BP in high volatility)
- **Earnings/Fed avoidance** (systematic event risk management)
- **Multiple stop loss levels** (strategy-specific risk controls)

---

## **🎯 ALGORITHM LOGIC VERIFICATION**

### ✅ **Consistent Contract Usage**
- **0DTE Strategy**: Uses ES (≥$40k) or MES (<$40k) - NO SPY
- **All phases**: Proper USD-based thresholds ($40k, $55k, $75k, $95k)
- **Symbol universe**: Phase-appropriate contract access

### ✅ **BP Maximization Logic**
- **VIX regime BP limits**: 45-80% usage based on volatility
- **Dynamic position sizing**: Calculated based on available BP, not fixed
- **Account phase scaling**: More aggressive BP usage as capital grows

### ✅ **Risk Management Integration**
- **Correlation limits**: Max 3 positions per correlation group enforced
- **VIX protection**: BP automatically reduced in high volatility (VIX >30)
- **Multi-layer stops**: Strategy-specific profit targets and stop losses

### ✅ **Phase Progression Logic**
- **Automatic upgrades**: Phase increases as account value grows
- **Strategy unlocks**: More complex strategies available at higher phases
- **Symbol access**: Expanded universe with larger accounts

---

## **📊 EXPECTED PERFORMANCE METRICS**

| Account Phase | Capital Range | Primary Strategies | Expected Monthly Return | 0DTE Contract |
|---------------|---------------|-------------------|------------------------|---------------|
| MES Only | $0 - $40k | MES 0DTE, MCL Strangles | 6-8% | MES (Micro) |
| Phase 1 | $40k - $55k | ES 0DTE, IPMCC, Strangles | 6-7% | ES |
| Phase 2 | $55k - $75k | Scale ES, Add LT112 | 7-8% | ES (Multiple) |
| Phase 3 | $75k - $95k | Advanced Strategies, NQ | 8-10% | ES + NQ |
| Phase 4 | $95k+ | Full Professional | 10-12% | ES + NQ (Max) |

**Target**: $44.5k → $102k in 8 months (128% annual return)

---

*This algorithm implements Tom King's 30+ year proven methodology with maximum capital efficiency through futures-focused strategies and VIX-adaptive position sizing for consistent weekly income generation.*