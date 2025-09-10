# Implementation Audit Quick Reference

## Before Making ANY Changes

```bash
# 1. Audit existing implementations
cd Documentation/Development
./audit-tools.sh audit <concept>

# 2. Map system architecture  
./audit-tools.sh map

# 3. Check interface compatibility
./audit-tools.sh interfaces
```

## Quality Gates Checklist

- [ ] **System doesn't already exist** - Searched codebase comprehensively
- [ ] **Understand existing patterns** - Reviewed how other strategies handle this
- [ ] **Check intentional redundancy** - Verified "duplication" isn't actually safety
- [ ] **Review design philosophy** - Confirmed change fits the architecture
- [ ] **Identify integration points** - Mapped what systems this interacts with

## Approved Patterns

### ✅ CORRECT: Layered Fallback System
```python
def _calculate_position_size(self):
    # 1. Try unified system first
    if hasattr(self.algo, 'position_sizer'):
        return self.algo.position_sizer.calculate_0dte_size()
    
    # 2. Try specialized calculator
    if hasattr(self.algo, 'kelly_calculator'):
        return self._use_kelly_calculator()
    
    # 3. Conservative fallback
    return self._minimum_safe_size()
```

### ❌ WRONG: Duplicate Implementation
```python
def _calculate_position_size(self):
    # Implementing Kelly formula again (WRONG - already exists)
    win_rate = 0.88
    kelly_pct = (win_rate * b - q) / b  # REDUNDANT
```

## System Architecture Map

```
CORE SYSTEMS:
├── risk/kelly_criterion.py          - Kelly calculations (COMPLETE)
├── core/unified_position_sizer.py   - Position sizing (uses Kelly)
├── core/unified_vix_manager.py      - VIX management (multiple sources)
├── core/unified_state_manager.py    - State persistence
├── helpers/data_validation.py       - Data quality checking
└── greeks/greeks_monitor.py         - Greeks calculations

STRATEGY IMPLEMENTATIONS:
├── strategies/base_strategy_with_state.py - Base class
├── strategies/friday_0dte_with_state.py   - 0DTE strategy  
├── strategies/lt112_with_state.py         - LT112 strategy
└── strategies/ipmcc_with_state.py         - PMCC strategy
```

## Common Redundancies to AVOID

1. **Data Validation** - Should use single validation framework
2. **Option Pricing** - Should use QuantConnect APIs consistently  
3. **Greeks Calculations** - Should use unified Greeks monitor
4. **Error Handling** - Should use consistent patterns

## After Changes

```bash
# Validate no redundancy created
./audit-tools.sh validate <function_name>

# Health check
./audit-tools.sh health
```