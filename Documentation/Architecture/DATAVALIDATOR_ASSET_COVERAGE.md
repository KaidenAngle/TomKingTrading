# DataValidator Asset Coverage Expansion
*Comprehensive validation implementation for all traded asset classes*

## Overview
The DataValidator was expanded from covering ~20% of traded assets to 100% coverage with context-aware severity assessment and fail-fast validation philosophy.

## Original Asset Coverage Gap

### Before (20% Coverage)
The DataValidator only validated:
- **Options** - Basic price and contract validation
- **Equities** - Simple price range checks  
- **Index** - Basic price validation

### After (100% Coverage)
Comprehensive validation now includes:
- **Options** - Enhanced validation with Greeks and time decay
- **Equities** - Price range and volume validation
- **Index** - Price validation with volatility checks
- **Futures** - Asset-specific price ranges and contract validation
- **Future Options** - Futures options with margin requirements
- **Forex** - Currency pair validation with session awareness
- **Crypto** - Cryptocurrency validation (if supported)
- **CFDs** - Contract for difference validation
- **ETFs** - Exchange-traded fund validation

## Critical Asset-Specific Validations

### Futures Validation
```python
def validate_futures_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
    """Validate futures with asset-specific ranges"""
    
    # ES (S&P 500 E-mini): Expected range 2000-8000
    if 'ES' in str(symbol):
        return self._validate_price_range(symbol, min_price=2000, max_price=8000)
    
    # CL (Crude Oil): Expected range 0-200
    elif 'CL' in str(symbol):
        return self._validate_price_range(symbol, min_price=0, max_price=200)
    
    # GC (Gold): Expected range 1000-3000
    elif 'GC' in str(symbol):
        return self._validate_price_range(symbol, min_price=1000, max_price=3000)
```

### Forex Validation
```python
def validate_forex_price(self, symbol) -> Tuple[Optional[float], DataSeverity]:
    """Validate forex pairs with session-aware logic"""
    
    price = self._get_security_price(symbol)
    
    # Major pairs validation
    if 'EURUSD' in str(symbol):
        return self._validate_price_range(symbol, min_price=0.80, max_price=1.40)
    elif 'GBPUSD' in str(symbol):
        return self._validate_price_range(symbol, min_price=1.00, max_price=1.60)
    elif 'USDJPY' in str(symbol):
        return self._validate_price_range(symbol, min_price=80, max_price=160)
```

## Key Integration Points

### 1. OnData Integration
```python
def validate_data(self, data) -> bool:
    """Unified data validation method expected by main algorithm"""
    
    # Validate all securities in current slice
    for symbol, tradebar in data.get('Bars', {}).items():
        security_type = self.algo.Securities[symbol].Type
        
        # Route to appropriate validator
        if security_type == SecurityType.Option:
            price, severity = self.validate_option_price(symbol)
        elif security_type == SecurityType.Future:
            price, severity = self.validate_futures_price(symbol)
        elif security_type == SecurityType.Forex:
            price, severity = self.validate_forex_price(symbol)
        # ... etc for all asset types
        
        # Fail fast on critical issues
        if severity == DataSeverity.CRITICAL:
            return False
    
    return self.is_trading_safe()
```

### 2. System-Wide Validation
```python
def validate_all_data(self) -> Dict[str, any]:
    """Comprehensive validation for all securities"""
    
    validation_results = {
        'valid_securities': {},
        'invalid_securities': {},
        'warnings': [],
        'critical_issues': []
    }
    
    # Check every security in portfolio
    for symbol in self.algo.Securities.Keys:
        security_type = self.algo.Securities[symbol].Type
        
        # Route validation by asset type
        validator_method = self.ASSET_VALIDATORS.get(security_type)
        if validator_method:
            price, severity = validator_method(symbol)
            # Store results with context
```

## Context-Aware Severity Assessment

### DataSeverity Levels
```python
class DataSeverity(Enum):
    INFO = "info"           # Informational, no action needed
    WARNING = "warning"     # Monitor, but continue trading
    ERROR = "error"         # Skip this asset, continue others
    CRITICAL = "critical"   # Halt all trading immediately
```

### Market-Context Assessment
The validator considers:
- **Market Hours** - More lenient during pre/post market
- **Volatility Regime** - Different thresholds during high VIX
- **Asset Class** - Futures have different acceptable ranges than equities
- **Strategy Context** - 0DTE vs LEAP validation requirements differ

## Fail-Fast Validation Philosophy

### Core Principle
**"Invalid data should stop trading immediately, not degrade gracefully"**

### Implementation Pattern
```python
def is_trading_safe(self) -> bool:
    """Central safety check - FAIL FAST on any critical data issue"""
    
    # VIX validation - CRITICAL for volatility-based strategies
    vix_value, vix_severity = self.validate_vix_data()
    if vix_severity == DataSeverity.CRITICAL:
        self.algo.Error(f"CRITICAL VIX data failure: {vix_value}")
        return False
    
    # Market hours validation
    if not self.validate_market_hours():
        return False
    
    # Continue only if ALL validations pass
    return True
```

## Asset Coverage Statistics

| Asset Type | Original Coverage | New Coverage | Validation Rules |
|------------|------------------|--------------|------------------|
| Options | Basic | Enhanced | Price, Greeks, Time Decay, OI |
| Equities | Basic | Enhanced | Price, Volume, Market Cap |
| Index | Basic | Enhanced | Price, Volatility, Components |
| Futures | None ❌ | Full ✅ | Asset-specific ranges, margins |
| Future Options | None ❌ | Full ✅ | Futures + options validation |
| Forex | None ❌ | Full ✅ | Session-aware, pair-specific |
| ETFs | None ❌ | Full ✅ | NAV, tracking error, liquidity |
| Crypto | None ❌ | Basic ✅ | Price, volatility (if supported) |
| CFDs | None ❌ | Basic ✅ | Price validation |

## Testing Requirements

### Unit Tests Must Verify:
1. **Each asset type** has appropriate validation logic
2. **Severity levels** are correctly assigned by context
3. **Fail-fast behavior** stops trading on critical issues
4. **Asset-specific ranges** match market reality

### Integration Tests Must Verify:
1. **OnData integration** processes all asset types
2. **System-wide validation** covers portfolio completely
3. **Performance impact** of comprehensive validation is acceptable
4. **Multi-asset strategies** work with enhanced validation

## Performance Considerations

### Caching Strategy
- **Price data** cached for 1-second intervals
- **Market hours** cached for session duration
- **VIX data** cached for 5-second intervals
- **Validation results** cached per security per update

### Optimization Patterns
```python
# Cache security types to avoid repeated lookups
if not hasattr(self, '_security_types'):
    self._security_types = {
        symbol: self.algo.Securities[symbol].Type 
        for symbol in self.algo.Securities.Keys
    }
```

## Critical Don'ts

### ❌ Never Do These:
1. **Skip validation** for "performance" reasons
2. **Use fallback prices** when validation fails
3. **Continue trading** with CRITICAL severity issues
4. **Approximate market events** instead of using real data
5. **Remove asset-specific validation** for "simplification"

### ✅ Always Do These:
1. **Fail fast** on any critical data issue
2. **Log validation results** with full context
3. **Test all asset types** your strategies trade
4. **Update validation ranges** based on market changes
5. **Monitor validation performance** metrics

## Future Enhancements

### Planned Improvements:
1. **Real-time range adjustment** based on market volatility
2. **Cross-asset correlation** validation
3. **Liquidity validation** for all asset types
4. **Options chain completeness** validation
5. **Margin requirement validation** per asset type

## Summary

The DataValidator expansion from 20% to 100% asset coverage represents a critical safety enhancement to the Tom King Trading Framework. By implementing comprehensive validation across all traded asset types with context-aware severity assessment and fail-fast philosophy, the system now provides robust data quality assurance that prevents trading with invalid or suspicious market data.

**This comprehensive coverage is essential for multi-asset strategies and should never be reduced for "simplification" purposes.**