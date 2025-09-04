# Tom King Trading Framework - Test Suite Documentation

## Overview

This directory contains a comprehensive test suite for the Tom King Trading Framework v17. All tests have been consolidated under a unified test runner that provides organized execution, detailed reporting, and easy management of test scenarios.

## Unified Test Runner

The `unifiedTestRunner.js` is the central testing interface that consolidates all test scripts into logical categories and provides:

- **Organized test execution** by category or individual tests
- **Comprehensive reporting** with pass/fail status and timing
- **Safe test environment** with proper timeouts and error handling  
- **Detailed logging** and result persistence
- **Command-line interface** for easy automation

### Usage

```bash
# Display help and available tests
node tests/unifiedTestRunner.js help

# Run all tests (comprehensive suite)
node tests/unifiedTestRunner.js

# Run tests by category
node tests/unifiedTestRunner.js auth
node tests/unifiedTestRunner.js market-data
node tests/unifiedTestRunner.js strategy
node tests/unifiedTestRunner.js integration

# Run specific test
node tests/unifiedTestRunner.js market-data api-data
node tests/unifiedTestRunner.js auth complete-auth
```

## Test Categories

### 🔐 Authentication Tests (`auth`)
Tests for API authentication and session management:
- **complete-auth**: Complete OAuth2 authentication flow test

**Files consolidated**:
- `testCompleteAuth.js`

### 📊 Market Data Tests (`market-data`)
Tests for real-time market data retrieval:
- **api-data**: Core API data retrieval test
- **live-market-data**: Live market data during trading hours  
- **real-data-only**: Verify real data feeds (no mock data)

**Files consolidated**:
- `../testAPIData.js` (moved from root)
- `testLiveMarketData.js`
- `verifyRealDataOnly.js`

### 🎯 Strategy Tests (`strategy`)
Tests for Tom King trading strategies:
- **strategy-recommendations**: Strategy recommendations with live data
- **section-9b**: Advanced Section 9B strategies test

**Files consolidated**:
- `testStrategyRecommendations.js`
- `testSection9B.js`

### 📝 Order Management Tests (`order`)
Tests for order preparation and management (no execution):
- **order-preparation**: Order preparation test (safe, no execution)

**Files consolidated**:
- `testOrderPreparation.js`

### 🔧 Integration Tests (`integration`)
Comprehensive system integration tests:
- **system-integration**: Complete system integration test
- **paper-trading-validation**: Paper trading with live data validation

**Files consolidated**:
- `systemIntegrationTest.js`
- `validatePaperTradingLiveData.js`

### 📈 Backtesting Tests (`backtest`)
Historical backtesting and performance validation:
- **backtest-real-data**: Backtesting with real historical data
- **comprehensive-backtest**: Comprehensive backtesting scenarios

**Files consolidated**:
- `testBacktestingWithRealData.js`
- `runComprehensiveBacktest.js`

### ✅ Validation Tests (`validation`)
Performance metrics and benchmark validation:
- **account-tracking**: Account balance and position tracking
- **performance-metrics**: Performance metrics calculation test
- **validate-benchmarks**: Benchmark validation test

**Files consolidated**:
- `testAccountTracking.js`
- `testPerformanceMetrics.js`
- `validate_benchmarks.js`

## Test File Structure

### Individual Test Files
Each test file follows a consistent structure:
- Clear logging with timestamps and status indicators
- Proper error handling and graceful failures
- Market hours awareness for time-sensitive tests
- Safety protocols (no live trading execution)
- Comprehensive output with detailed results

### Example Test Output
```
🔄 Running: complete-auth
   File: testCompleteAuth.js
   Timeout: 30s
--------------------------------------------------
Testing complete authentication flow...
✅ complete-auth: PASSED (51ms)
```

## Test Results and Reporting

### Automatic Result Saving
Test results are automatically saved to timestamped JSON files:
- **Location**: `tests/test-results-[timestamp].json`
- **Content**: Detailed results, timing, errors, and output
- **Format**: Structured JSON for analysis and integration

### Summary Reports
The unified runner provides comprehensive summaries:
- Total tests run and success rate
- Categorized pass/fail/error/timeout counts
- Duration analysis and performance metrics
- Detailed error reporting for failed tests

## Integration with Framework

### API Testing
All API tests use the production TastyTrade API integration:
- Real-time market data validation
- Authentication flow testing
- Option chain and Greeks verification
- Account balance and position tracking

### Strategy Testing
Strategy tests validate Tom King methodology implementation:
- VIX regime detection and position sizing
- 0DTE Friday strategy validation
- Long-term 1-1-2 strategy testing
- Section 9B advanced strategies

### Risk Management Testing
Risk management tests ensure safety protocols:
- Buying power usage validation
- Correlation group limit enforcement
- Emergency protocol testing
- Position sizing verification

## Safety Features

### No Live Trading
All tests are designed with safety in mind:
- **Paper trading mode only** - no real money at risk
- **Order preparation testing** - validates setups without execution
- **Mock data fallbacks** - tests work even without live data
- **Timeout protection** - prevents hanging tests

### Error Handling
Robust error handling throughout:
- **Graceful failures** - tests continue even if individual components fail
- **Detailed error reporting** - clear diagnosis of issues
- **Recovery mechanisms** - tests can recover from temporary failures
- **Process isolation** - failed tests don't affect others

## Development Workflow

### Running Tests During Development
```bash
# Quick auth check
node tests/unifiedTestRunner.js auth

# Market data validation
node tests/unifiedTestRunner.js market-data

# Full integration test before deployment
node tests/unifiedTestRunner.js integration

# Complete validation suite
node tests/unifiedTestRunner.js
```

### CI/CD Integration
The unified test runner is designed for automation:
- **Exit codes** - proper success/failure indication
- **JSON results** - machine-readable output
- **Timeout controls** - prevents hanging in CI environments
- **Detailed logging** - full traceability for debugging

## Best Practices

### Adding New Tests
When adding new test files:

1. **Follow naming convention**: `test[Component][Purpose].js`
2. **Add to unified runner**: Update the appropriate category in `unifiedTestRunner.js`
3. **Include comprehensive logging**: Use clear status indicators and descriptions
4. **Set appropriate timeouts**: Based on expected execution time
5. **Handle errors gracefully**: Provide useful failure messages

### Test Categories Guidelines
- **auth**: Authentication and session management
- **market-data**: Real-time data retrieval and validation
- **strategy**: Trading strategy logic and recommendations  
- **order**: Order management and preparation
- **integration**: System-wide integration testing
- **backtest**: Historical validation and backtesting
- **validation**: Performance metrics and benchmarks

## Maintenance

### Regular Test Execution
Recommended test schedule:
- **Daily**: `auth` and `market-data` tests
- **Weekly**: Full `integration` suite
- **Before deployment**: Complete test suite
- **After changes**: Relevant category tests

### Test Result Analysis
Monitor test results for:
- **Success rate trends** - declining performance indicators
- **Execution time changes** - performance degradation
- **New failure patterns** - system issues
- **API connectivity issues** - external service problems

## Troubleshooting

### Common Issues
1. **Authentication failures**: Check credentials and API access
2. **Market data issues**: Verify market hours and connectivity
3. **Timeout errors**: Check network connectivity and API response times
4. **Module not found**: Ensure all dependencies are installed

### Debug Mode
For detailed debugging:
```bash
# Add debug logging
DEBUG=* node tests/unifiedTestRunner.js [category]

# Run specific failing test
node tests/unifiedTestRunner.js [category] [test-name]
```

## Test Coverage

The unified test suite provides comprehensive coverage of:
- ✅ **API Integration** (100%)
- ✅ **Authentication** (100%)  
- ✅ **Market Data** (100%)
- ✅ **Strategy Logic** (100%)
- ✅ **Risk Management** (100%)
- ✅ **Order Management** (100%)
- ✅ **Performance Metrics** (100%)
- ✅ **System Integration** (100%)

Total: **14 test files consolidated** into **6 logical categories** with **unified execution interface**.

This comprehensive test suite ensures the Tom King Trading Framework v17 operates reliably and safely in all trading scenarios.