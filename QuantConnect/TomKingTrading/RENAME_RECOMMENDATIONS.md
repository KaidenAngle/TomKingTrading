# Tom King Trading System - Rename Recommendations

## Priority 1: Eliminate Confusing "Simple_" Prefix (5 files)

These renames remove ambiguity about what makes something "simple":

1. **greeks/simple_greeks_signals.py** → **greeks/greeks_signal_generator.py**
   - Clear purpose: Generates trading signals from Greeks

2. **helpers/simple_order_helpers.py** → **helpers/option_order_executor.py**
   - Clear purpose: Executes option orders

3. **risk/simple_production_features.py** → **risk/live_trading_components.py**
   - Clear purpose: Components for live trading

4. **risk/simple_safety_checks.py** → **risk/position_safety_validator.py**
   - Clear purpose: Validates position safety

5. **strategies/simple_exit_manager.py** → **strategies/tom_king_exit_rules.py**
   - Clear purpose: Tom King's specific exit rules implementation

## Priority 2: Disambiguate Duplicate "Parameters" Files

1. **config/parameters.py** → **config/strategy_parameters.py**
   - Clear purpose: Strategy-specific parameters

2. **risk/parameters.py** → **risk/risk_limits_and_thresholds.py**
   - Clear purpose: Risk management limits and thresholds

## Priority 3: Clarify Strategy Names

1. **strategies/lt112_core_strategy.py** → **strategies/long_term_112_put_selling.py**
   - Explains what LT112 means

2. **strategies/ipmcc_strategy.py** → **strategies/in_perpetuity_covered_calls.py**
   - Explains what IPMCC means

3. **strategies/friday_0dte.py** → **strategies/friday_zero_day_options.py**
   - Spells out 0DTE for clarity

## Priority 4: Fix Ambiguous Risk Files

1. **risk/correlation.py** → **risk/august_2024_correlation_limiter.py**
   - Specific purpose: Enforces August 2024 lesson (max 3 correlated)

2. **risk/defensive.py** → **risk/portfolio_protection_rules.py**
   - Clear defensive purpose

3. **risk/critical_validations.py** → **risk/pre_trade_validators.py**
   - Clear when validations occur

## Priority 5: Clean Up Integration Files

1. **brokers/tastytrade_integration_fixed.py** → **brokers/tastytrade_api_client.py**
   - Remove "fixed" suffix, clear API client purpose

2. **brokers/hybrid_sandbox_integration.py** → **brokers/paper_trading_adapter.py**
   - Clear paper trading purpose

## Priority 6: Improve Helper/Utility Names

1. **analysis/progressive_friday_analysis.py** → **analysis/friday_strategy_optimizer.py**
   - Clear optimization purpose

2. **reporting/enhanced_trade_logger.py** → **reporting/trade_execution_logger.py**
   - Clear logging purpose

## Folder Structure Recommendation

Consider reorganizing into clearer structure:

```
QuantConnect/TomKingTrading/
├── core/
│   ├── main.py
│   ├── fee_models.py
│   └── tom_king_exit_rules.py (from simple_exit_manager)
├── strategies/
│   ├── friday_zero_day_options.py
│   ├── long_term_112_put_selling.py
│   ├── futures_strangle.py
│   ├── in_perpetuity_covered_calls.py
│   └── leap_put_ladders.py
├── risk_management/
│   ├── august_2024_correlation_limiter.py
│   ├── position_sizing.py
│   ├── vix_regime.py
│   ├── risk_limits_and_thresholds.py
│   └── portfolio_protection_rules.py
├── live_trading/
│   ├── live_trading_components.py
│   ├── position_safety_validator.py
│   └── pre_trade_validators.py
├── brokers/
│   ├── tastytrade_api_client.py
│   └── paper_trading_adapter.py
└── configuration/
    ├── strategy_parameters.py
    ├── trading_constants.py
    └── tastytrade_credentials.py

```

## Benefits of These Renames

1. **No more guessing** what "simple" means
2. **Clear differentiation** between similar files
3. **Acronyms explained** (LT112, IPMCC, 0DTE)
4. **Purpose-driven names** instead of generic ones
5. **Consistent naming pattern** across the codebase

## Implementation Priority

Start with:
1. Remove all "simple_" prefixes (5 files)
2. Disambiguate the two parameters.py files
3. Clarify strategy acronyms

These changes will make the biggest impact on clarity with minimal disruption.