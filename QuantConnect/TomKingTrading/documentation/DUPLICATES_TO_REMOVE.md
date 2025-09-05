# Duplicate Files and Functions to Remove/Consolidate

## Status: CRITICAL - System has multiple duplicate implementations

### 1. LT112 Strategy (3 versions!)
- **KEEP**: `strategies/lt112_core_strategy.py` - Correct Tom King specs (120 DTE, weekly entries)
- **REMOVE**: `strategies/long_term_112.py` - Old wrong implementation (45 DTE)
- **UPDATE**: `strategies/calendarized_112.py` - Needs to use real execution engine

### 2. VIX Regime Detection (Multiple implementations)
- **KEEP**: `risk/position_sizing.py` - VIXBasedPositionSizing class (comprehensive)
- **CHECK**: Main.py has inline VIX regime code that duplicates position_sizing.py

### 3. August 2024 Protection (Already implemented!)
- **EXISTS**: `risk/august_2024_protection.py` - Full implementation
- **EXISTS**: Already integrated in main.py lines 114-116, 280-410
- **STATUS**: ✅ No action needed - already complete

### 4. Position Health Scoring (Already implemented!)
- **EXISTS**: `risk/defensive.py` - DefensiveManager with health scoring
- **EXISTS**: Main.py uses it in CheckDefensiveAdjustments()
- **STATUS**: ✅ No action needed - already complete

### 5. Weekly Rhythm System (Partially exists)
- **NEW**: `trading/weekly_cadence_tracker.py` - Just created
- **EXISTS**: Main.py has scheduling but not weekly rhythm enforcement
- **ACTION**: Need to integrate weekly_cadence_tracker into main.py

### 6. Correlation Groups (Already implemented!)
- **EXISTS**: `risk/correlation.py` - CorrelationManager class
- **EXISTS**: Main.py uses it in HasCapacity() line 1558
- **STATUS**: ✅ Working but needs enforcement in execution engine

### 7. 50% Profit Target (Already implemented!)
- **EXISTS**: Main.py CheckProfitTargets() lines 245-269
- **EXISTS**: References "50% rule" throughout
- **STATUS**: ✅ No action needed - already complete

### 8. VIX Spike Opportunity (Already implemented!)
- **EXISTS**: Main.py lines 302-305, 1632-1653
- **EXISTS**: `risk/position_sizing.py` has IsVIXSpikeOpportunity()
- **STATUS**: ✅ No action needed - already complete

### 9. Phase Transition Detection (Already implemented!)
- **EXISTS**: `risk/phase_manager.py` - PhaseManager class
- **EXISTS**: Main.py GetAccountPhase() lines 1569-1585
- **STATUS**: ✅ No action needed - already complete

### 10. Order Execution
- **NEW**: `trading/order_execution_engine.py` - Real execution with ComboMarketOrder
- **NEW**: `trading/option_chain_processor.py` - Real option chain processing
- **ACTION**: Need to integrate these into strategies that still use placeholders

## ACTIONS REQUIRED:

1. **DELETE** `strategies/long_term_112.py` - obsolete
2. **UPDATE** `strategies/calendarized_112.py` - use ExecutionEngine
3. **UPDATE** `strategies/bear_trap_11x.py` - use ExecutionEngine  
4. **INTEGRATE** weekly_cadence_tracker into main.py
5. **CONNECT** correlation limits to execution engine

## ALREADY COMPLETE (No action needed):
- ✅ August 2024 Protection
- ✅ Position Health Scoring
- ✅ 50% Profit Target
- ✅ VIX Spike Opportunity Detection
- ✅ Phase Transition Detection
- ✅ Correlation Group Tracking

## Test Results:
- TastyTrade API: Created test file `test_tastytrade_api.py`
- Brokerage Model: Correctly set to TastyTrade
- Fee Model: TastyTradeFeeModel implemented (lines 1754-1769 main.py)
- Option Chains: OptionChainProcessor handles this
- Combo Orders: ExecutionEngine uses ComboMarketOrder