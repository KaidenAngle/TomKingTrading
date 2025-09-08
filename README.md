# Tom King Trading Framework

A professional options trading system implementing Tom King's complete trading methodology on QuantConnect.

## System Overview

This framework implements a multi-strategy options trading system with sophisticated risk management, phase-based progression, and intelligent position sizing.

### Core Strategies

1. **Friday 0DTE** - Zero days to expiration options on Fridays
2. **LT112** - Long-term 112 DTE put selling strategy
3. **IPMCC** - In-perpetuity monthly covered calls
4. **Futures Strangle** - 45-60 DTE strangles on futures
5. **LEAP Put Ladders** - Portfolio protection with long-dated puts

## Key Features

### Risk Management
- **Phase-Based Progression**: 4 phases based on account size and experience
- **Greeks Monitoring**: Real-time Greeks calculation with phase-specific limits
- **Correlation Management**: Prevents concentration risk across strategies
- **VIX-Based Adjustments**: Dynamic position sizing based on market volatility

### Safety Systems
- **Circuit Breakers**: Automatic trading halt on excessive losses
- **Margin Management**: Prevents over-leveraging
- **SPY Concentration Limits**: Controls overall market exposure
- **Data Validation**: Ensures data freshness before trading

### Performance Optimizations
- **Smart Caching**: 45-55% faster backtesting
- **Conditional Execution**: Different behavior for backtest vs live
- **Greeks Caching**: Only recalculates on position changes
- **Option Chain Caching**: 5-minute time-based caching

## Directory Structure

```
TomKingTrading/
├── main.py                    # Main algorithm entry point
├── config/                    # Configuration and constants
│   ├── constants.py          # Trading constants and parameters
│   └── strategy_validator.py # Strategy validation rules
├── core/                      # Core system components
│   ├── state_machine.py      # State management system
│   ├── strategy_coordinator.py # Strategy execution coordination
│   └── unified_vix_manager.py # VIX management with caching
├── strategies/                # Trading strategies
│   ├── friday_0dte_with_state.py
│   ├── lt112_with_state.py
│   ├── ipmcc_with_state.py
│   ├── futures_strangle_with_state.py
│   └── leap_put_ladders_with_state.py
├── risk/                      # Risk management
│   ├── phase_manager.py      # Phase progression system
│   ├── margin_manager.py     # Margin monitoring
│   ├── correlation_group_limiter.py # Correlation limits
│   └── vix_regime.py         # Advanced VIX regime analysis
├── greeks/                    # Greeks management
│   ├── greeks_monitor.py     # Real-time Greeks calculation
│   └── phase_based_greeks_limits.py # Phase-specific limits
├── helpers/                   # Utility functions
│   ├── atomic_order_executor.py # Multi-leg order execution
│   ├── order_executor.py     # Standard order execution
│   └── performance_tracker_safe.py # Performance tracking
└── tests/                     # Test suite

```

## Quick Start

### Prerequisites
- QuantConnect account
- Python 3.8+
- Minimum $38,000 account for Phase 1

### Installation

1. Clone to your QuantConnect project:
```bash
git clone [repository] /QuantConnect/TomKingTrading
```

2. Deploy to QuantConnect:
```python
python deploy_backtest.py
```

### Configuration

Edit `config/constants.py` to adjust:
- Position sizing parameters
- Profit targets and stop losses
- DTE targets for each strategy
- Risk thresholds

## Trading Rules

### Phase Progression
- **Phase 1** ($38-51k): Max 6 positions, conservative Greeks
- **Phase 2** ($51-76k): Max 10 positions, moderate Greeks
- **Phase 3** ($76-95k): Max 12 positions, standard Greeks
- **Phase 4** ($95k+): Max 15 positions, advanced Greeks

### Greeks Limits (by Phase)
- **Phase 1**: Delta ±50, Gamma ±10
- **Phase 2**: Delta ±75, Gamma ±15
- **Phase 3**: Delta ±100, Gamma ±20
- **Phase 4**: Delta ±150, Gamma ±30

### Key Safety Rules
- **21 DTE Rule**: Exit all positions at 21 DTE
- **VIX > 22**: Required for 0DTE trading
- **Kelly Factor**: 0.25 (conservative position sizing)
- **Max Correlation**: 3 positions in same group

## Performance

### Backtest Optimizations
- Backtest mode flag reduces non-critical operations
- Greeks only recalculate on position changes
- Option chains cached for 5 minutes
- Safety checks run every 30 minutes (vs 5 in live)

### Expected Performance
- **Backtest Speed**: 45-55% faster than unoptimized
- **Memory Usage**: 20% reduction
- **CPU Usage**: 30-40% reduction

## System Components

### VIX Management (Two Systems)
1. **UnifiedVIXManager**: Fast cached access (5-second cache)
2. **VIXRegimeManager**: Advanced 6-level regime analysis

These are complementary, not redundant:
- Use Unified for quick VIX checks
- Use Regime for strategic decisions

### Position Sizing (Two Systems)
1. **UnifiedPositionSizer**: Simple Kelly Criterion
2. **PositionSizer**: Complex VIX-regime-based sizing

These serve different purposes:
- Use Unified for standard sizing
- Use PositionSizer for regime adjustments

## Documentation

### Key Documents
- `SYSTEM_DOCUMENTATION.md` - Complete system architecture
- `VIX_STRATEGY_REQUIREMENTS.md` - VIX-based trading rules
- `BACKTEST_RESULTS_ANALYSIS.md` - Performance analysis
- `PERFORMANCE_OPTIMIZATIONS_APPLIED.md` - Optimization details

### Strategy-Specific Docs
Each strategy has detailed documentation in the `Documentation/Strategies/` folder.

## Testing

Run the validation suite:
```python
python validate_production.py
```

Run unit tests:
```python
python -m pytest tests/
```

## Support

For issues or questions, refer to:
- `Documentation/` folder for detailed guides
- Tom King's original methodology documentation
- QuantConnect forums for platform-specific issues

## License

Proprietary - Based on Tom King Trading System

## Version

v1.0.0 - Production Ready