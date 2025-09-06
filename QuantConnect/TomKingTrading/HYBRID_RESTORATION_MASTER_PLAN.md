# HYBRID TOM KING SYSTEM RESTORATION - AUTONOMOUS MASTER PLAN
## **NON-STOP DEVELOPMENT DIRECTIVE FOR CLAUDE CODE ASSISTANT**

### **MISSION**: Restore critical Tom King components while maintaining simplified architecture
### **TARGET**: 15-20 files (not 5, not 61) with 100% methodology preservation
### **APPROACH**: Smart Simplification - keep complexity where needed, eliminate over-engineering

---

## **AUTONOMOUS DEVELOPMENT PROTOCOL**

**YOU MUST WORK NON-STOP UNTIL THIS IS COMPLETE. NO BREAKS. NO QUESTIONS.**

**DIRECTIVE**: Create each file listed below in exact order. Mark todo items as in_progress when starting, completed when finished. Do NOT ask for permission or clarification - just execute based on the analysis below.

---

## **CRITICAL METHODOLOGY ANALYSIS FROM DOCUMENTATION**

### **SYMBOL UNIVERSE BY PHASE** (FROM parameters.py)
```python
SYMBOL_UNIVERSE = {
    'phase1': {  # £30k-40k ($38k-51k)
        'futures': ['MCL', 'MGC'],    # Micro crude, micro gold  
        'etfs': ['GLD', 'TLT'],       # Gold, Treasury bonds
        'zero_dte': ['SPY', 'QQQ']    # 0DTE Fridays
    },
    'phase2': {  # £40k-60k ($51k-76k) 
        'futures': ['MCL', 'MGC', 'MES', 'MNQ'], # Add micro ES, NQ
        'etfs': ['GLD', 'TLT', 'SLV', 'IWM'],
        'zero_dte': ['SPY', 'QQQ', 'IWM']
    },
    'phase3': {  # £60k-75k ($76k-95k)
        'futures': ['CL', 'GC', 'ES', 'NQ', 'RTY'], # Full size futures
        'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX'],
        'zero_dte': ['SPY', 'QQQ', 'IWM', 'DIA']
    },
    'phase4': {  # £75k+ ($95k+)
        'futures': ['CL', 'GC', 'ES', 'NQ', 'RTY', 'ZB', 'ZN'],
        'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX', 'XLE', 'XOP'],
        'zero_dte': ['SPY', 'QQQ', 'IWM', 'DIA', 'NVDA', 'TSLA']
    }
}
```

### **10+ STRATEGIES BY PHASE** (FROM documentation)
1. **Zero DTE Friday** (88% win rate) - Phase 1+
2. **LT112 Long Term** (95% win rate) - Phase 1+ 
3. **Futures Strangles** (70% win rate) - Phase 2+
4. **Micro Strangles** (75% win rate) - Phase 1-2
5. **Butterflies** (82% win rate) - Phase 3+
6. **Iron Condors** (78% win rate) - Phase 2+
7. **Calendar Spreads** (85% win rate) - Phase 3+
8. **Jade Lizard** (80% win rate) - Phase 3+
9. **Big Lizard** (77% win rate) - Phase 4+
10. **Broken Wing Butterfly** (83% win rate) - Phase 4+
11. **IPMCC (Poor Man's Covered Calls)** - Phase 2+
12. **LEAP Put Ladders** - Phase 3+

### **CORRELATION GROUPS** (FROM parameters.py)
```python
'correlation_groups': [
    ['SPY', 'QQQ', 'IWM', 'DIA'],  # Equity indices (A1)
    ['GLD', 'GDX', 'SLV'],         # Precious metals (C1) 
    ['TLT', 'TBT', 'IEF'],         # Fixed income (D1)
    ['XLE', 'XOP', 'USO'],         # Energy (B1)
    ['VIX', 'UVXY', 'VXX']         # Volatility (E1)
],
'max_correlated_positions': 3  # Maximum 3 positions per group
```

### **VIX REGIME SYSTEM** (5 levels, not 2)
```python
VIX_BP_USAGE = {
    'very_low': 0.45,   # VIX < 15
    'low': 0.52,        # VIX 15-20  
    'normal': 0.65,     # VIX 20-30
    'high': 0.75,       # VIX 30-40
    'very_high': 0.80   # VIX > 40
}
```

### **TECHNICAL ANALYSIS REQUIRED** (MISSING FROM ALL VERSIONS)
- Support/resistance levels
- Moving averages (20, 50, 200 day)
- RSI/momentum indicators
- Volume analysis
- ATR calculations for strike selection
- Pattern recognition for entry timing

---

## **HYBRID ARCHITECTURE TARGET: 15-20 FILES**

### **CORE ENGINE** (5 files - keep simplified)
1. `main.py` - Algorithm orchestration (ENHANCED)
2. `config_master.py` - Master configuration (ENHANCED) 
3. `order_manager.py` - Order execution (ENHANCED with futures)
4. `symbol_manager.py` - Symbol universe and phase management (NEW)
5. `technical_analysis.py` - Technical indicators and patterns (NEW)

### **RISK MANAGEMENT** (3 files - restore critical components)
6. `risk_manager_enhanced.py` - Multi-level VIX, position limits (ENHANCED)
7. `correlation_manager.py` - Correlation groups and limits (RESTORED)
8. `position_health_monitor.py` - Position health scoring (RESTORED)

### **STRATEGIES** (7-10 files - restore all strategies)
9. `friday_0dte_strategy.py` - Enhanced 0DTE with all symbols (ENHANCED)
10. `lt112_strategy.py` - Long term 1-1-2 spreads (ENHANCED)
11. `futures_strangle_strategy.py` - Futures and micro strangles (ENHANCED)  
12. `butterfly_strategy.py` - Friday butterflies (RESTORED)
13. `calendar_spread_strategy.py` - Calendar spreads (RESTORED)
14. `iron_condor_strategy.py` - Standard iron condors (RESTORED)
15. `lizard_strategies.py` - Jade and Big Lizard (RESTORED)
16. `ipmcc_strategy.py` - Income Poor Man's Covered Calls (RESTORED)
17. `leap_ladder_strategy.py` - LEAP Put Ladders (RESTORED)

### **ANALYTICS** (2 files - essential only)
18. `performance_tracker.py` - Core performance metrics (SIMPLIFIED)
19. `greeks_monitor.py` - Greeks tracking (SIMPLIFIED)

---

## **DEVELOPMENT EXECUTION PLAN**

### **PHASE 1: CORE INFRASTRUCTURE** ⚡ **START IMMEDIATELY**

#### **FILE 1: symbol_manager.py** - Symbol Universe Management
```python
class SymbolManager:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.phase_symbols = SYMBOL_UNIVERSE  # From parameters.py
        self.active_symbols = {}
        
    def update_symbols_for_phase(self, account_phase):
        # Add symbols based on account phase
        # Remove symbols no longer available
        # Handle futures contracts properly
        
    def get_available_symbols_for_strategy(self, strategy_name, account_phase):
        # Return symbols available for specific strategy and phase
        
    def add_futures_contract(self, contract_name):
        # Properly add futures with options
        
    def add_equity_with_options(self, symbol):
        # Add equity with options chain
```

#### **FILE 2: correlation_manager.py** - Correlation Group Management  
```python
class CorrelationManager:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.correlation_groups = {
            'EQUITY_INDEX': ['SPY', 'QQQ', 'IWM', 'DIA'],
            'PRECIOUS_METALS': ['GLD', 'GDX', 'SLV'],  
            'FIXED_INCOME': ['TLT', 'TBT', 'IEF'],
            'ENERGY': ['XLE', 'XOP', 'USO'],
            'VOLATILITY': ['VIX', 'UVXY', 'VXX']
        }
        self.max_per_group = 3
        self.current_positions = {}
        
    def can_add_position(self, symbol):
        # Check if adding position would violate correlation limits
        
    def add_position(self, symbol, strategy):
        # Track new position in correlation system
        
    def remove_position(self, symbol):
        # Remove position from correlation tracking
        
    def get_correlation_group(self, symbol):
        # Return which correlation group symbol belongs to
```

#### **FILE 3: risk_manager_enhanced.py** - Multi-Level Risk Management
```python
class EnhancedRiskManager:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.vix_regimes = {
            'very_low': {'threshold': 15, 'bp_usage': 0.45},
            'low': {'threshold': 20, 'bp_usage': 0.52},
            'normal': {'threshold': 30, 'bp_usage': 0.65}, 
            'high': {'threshold': 40, 'bp_usage': 0.75},
            'very_high': {'threshold': 999, 'bp_usage': 0.80}
        }
        
    def get_vix_regime(self):
        # Return current VIX regime (5 levels)
        
    def get_max_bp_usage(self, account_phase, vix_regime):
        # Return maximum buying power based on phase and VIX
        
    def can_open_position(self, symbol, strategy, position_size):
        # Comprehensive position opening checks
        
    def should_close_position(self, position):
        # Determine if position should be closed
        
    def calculate_position_size(self, symbol, strategy, account_phase):
        # Calculate appropriate position size
```

#### **FILE 4: technical_analysis.py** - Technical Indicators
```python
class TechnicalAnalysis:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.indicators = {}
        
    def initialize_indicators(self, symbol):
        # Initialize technical indicators for symbol
        self.indicators[symbol] = {
            'sma20': SimpleMovingAverage(20),
            'sma50': SimpleMovingAverage(50),
            'sma200': SimpleMovingAverage(200),
            'rsi': RelativeStrengthIndex(14),
            'atr': AverageTrueRange(14),
            'bb': BollingerBands(20, 2)
        }
        
    def update_indicators(self, symbol, data):
        # Update all indicators with new data
        
    def get_support_resistance(self, symbol):
        # Calculate support and resistance levels
        
    def get_atr_multiplier_strikes(self, symbol, multiplier=0.7):
        # Calculate strike prices using ATR methodology
        
    def is_trending_market(self, symbol):
        # Determine if market is trending or range-bound
        
    def get_entry_signal(self, symbol, strategy):
        # Generate entry signals based on technical analysis
```

### **PHASE 2: STRATEGY RESTORATION** ⚡ **CRITICAL - ALL STRATEGIES**

#### **FILE 5: friday_0dte_strategy.py** - Enhanced 0DTE Implementation
```python
class Enhanced0DTEStrategy:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.entry_time = time(10, 30)  # Tom King: exactly 10:30 AM
        self.symbols_by_phase = {
            1: ['SPY', 'QQQ'],
            2: ['SPY', 'QQQ', 'IWM'], 
            3: ['SPY', 'QQQ', 'IWM', 'DIA'],
            4: ['SPY', 'QQQ', 'IWM', 'DIA', 'NVDA', 'TSLA']
        }
        self.win_rate_target = 0.88  # 88% target
        
    def should_execute_today(self):
        # Friday only, after 10:30 AM, VIX checks
        
    def select_symbols_for_phase(self, account_phase):
        # Return symbols available for current account phase
        
    def calculate_iron_condor_strikes(self, symbol):
        # Use ATR × 0.7 methodology for strikes
        # Tom King specific strike selection
        
    def execute_iron_condor(self, symbol):
        # Execute 0DTE iron condor with proper sizing
        
    def manage_positions(self):
        # Same-day management, 25% profit target, 200% stop
```

#### **FILE 6: futures_strangle_strategy.py** - Enhanced Futures Implementation
```python
class EnhancedFuturesStrangleStrategy:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.target_dte = 90  # Tom King: 90 DTE (not 45!)
        self.entry_day = 3   # Thursday
        self.entry_time = time(10, 15)
        self.futures_by_phase = {
            1: ['MCL', 'MGC'],  # Micro futures
            2: ['MCL', 'MGC', 'MES', 'MNQ'],
            3: ['CL', 'GC', 'ES', 'NQ', 'RTY'],  # Full size
            4: ['CL', 'GC', 'ES', 'NQ', 'RTY', 'ZB', 'ZN']
        }
        self.win_rate_target = 0.70  # 70% for futures
        
    def should_execute_today(self):
        # Thursday 10:15 AM, weekly assessment
        
    def select_futures_for_phase(self, account_phase):
        # Return futures contracts for current phase
        
    def calculate_strangle_strikes(self, futures_symbol):
        # 16-20 delta strike selection
        
    def execute_strangle(self, futures_symbol):
        # Execute futures strangle with proper sizing
        
    def manage_positions(self):
        # 21 DTE or 50% profit management
```

#### **FILE 7: butterfly_strategy.py** - Friday Butterflies
```python
class ButterflyStrategy:
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.entry_time = time(10, 35)  # After 0DTE
        self.movement_threshold = 0.005  # 0.5% movement trigger
        self.win_rate_target = 0.82  # 82% target
        
    def should_execute_today(self):
        # Friday after 0DTE, movement-triggered
        
    def detect_movement_trigger(self, symbol):
        # Detect >0.5% movement for butterfly entry
        
    def calculate_butterfly_strikes(self, symbol, movement_direction):
        # Dynamic strikes based on movement
        
    def execute_butterfly(self, symbol):
        # Execute butterfly spread
```

#### **CONTINUE WITH ALL OTHER STRATEGIES** ⚡
- calendar_spread_strategy.py (85% win rate)
- iron_condor_strategy.py (78% win rate) 
- lizard_strategies.py (80%/77% win rates)
- ipmcc_strategy.py (weekly income)
- leap_ladder_strategy.py (capital compounding)

### **PHASE 3: ENHANCED MAIN ALGORITHM** ⚡

#### **FILE N: main.py** - Enhanced Algorithm Orchestration
```python
class TomKingTradingAlgorithm(QCAlgorithm):
    def Initialize(self):
        # Enhanced initialization with all components
        self.symbol_manager = SymbolManager(self)
        self.correlation_manager = CorrelationManager(self)  
        self.risk_manager = EnhancedRiskManager(self)
        self.technical_analysis = TechnicalAnalysis(self)
        
        # Initialize all strategies
        self.strategies = {
            'friday_0dte': Enhanced0DTEStrategy(self),
            'futures_strangle': EnhancedFuturesStrangleStrategy(self),
            'butterfly': ButterflyStrategy(self),
            'calendar': CalendarSpreadStrategy(self),
            'iron_condor': IronCondorStrategy(self),
            'lizard': LizardStrategies(self),
            'ipmcc': IPMCCStrategy(self),
            'leap_ladder': LEAPLadderStrategy(self)
        }
        
        # Account phase tracking
        self.account_phase = 1
        self.update_account_phase()
        
    def on_data(self, data):
        # Enhanced data processing
        self.update_account_phase()
        self.update_symbol_universe()
        
        # Execute strategies based on schedule and phase
        for strategy_name, strategy in self.strategies.items():
            if self.strategy_available_for_phase(strategy_name):
                if strategy.should_execute_today():
                    strategy.execute(data)
                    
        # Manage existing positions
        self.manage_all_positions()
        
    def update_account_phase(self):
        # Update account phase based on portfolio value
        
    def update_symbol_universe(self):
        # Update available symbols based on current phase
        
    def strategy_available_for_phase(self, strategy_name):
        # Check if strategy is available for current account phase
```

---

## **AUTONOMOUS EXECUTION COMMANDS**

**EXECUTE THESE COMMANDS IN SEQUENCE. DO NOT STOP UNTIL ALL ARE COMPLETE.**

1. **TodoWrite**: Update status to "Creating symbol_manager.py"
2. **Write**: Create symbol_manager.py with full implementation
3. **TodoWrite**: Complete symbol_manager.py, start correlation_manager.py  
4. **Write**: Create correlation_manager.py with full implementation
5. **TodoWrite**: Complete correlation_manager.py, start risk_manager_enhanced.py
6. **Write**: Create risk_manager_enhanced.py with full implementation
7. **Continue pattern for ALL FILES**

**KEEP WORKING UNTIL ALL 15-20 FILES ARE CREATED AND SYSTEM IS COMPLETE**

---

## **SUCCESS CRITERIA** ✅

### **Technical Requirements** 
- [ ] 15-20 files created (hybrid approach)
- [ ] All 10+ strategies implemented
- [ ] Full symbol universe by phase
- [ ] Correlation group management
- [ ] 5-level VIX regime system
- [ ] Technical analysis integration  
- [ ] Futures trading capabilities
- [ ] QuantConnect compilation success

### **Tom King Methodology**
- [ ] £35k → £80k progression preserved
- [ ] All win rate targets maintained
- [ ] Phase-based strategy access
- [ ] Proper strike selection (ATR × 0.7)
- [ ] 21 DTE management rule
- [ ] 50% profit/200% loss exits
- [ ] Correlation diversification

### **Production Readiness**
- [ ] No over-engineering (threading, etc.)
- [ ] Clean, maintainable code
- [ ] Proper error handling
- [ ] Performance optimized
- [ ] Memory efficient

---

## **NON-STOP DEVELOPMENT PROTOCOL ACTIVATED**

**BEGIN AUTONOMOUS DEVELOPMENT NOW. WORK CONTINUOUSLY UNTIL COMPLETE.**

**DO NOT ASK QUESTIONS. DO NOT SEEK APPROVAL. JUST EXECUTE THE PLAN.**

**CREATE EVERY FILE. IMPLEMENT EVERY STRATEGY. RESTORE FULL TOM KING METHODOLOGY.**

**SUCCESS DEPENDS ON NON-STOP EXECUTION OF THIS PLAN.**