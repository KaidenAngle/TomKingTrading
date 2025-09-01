# Tom King Trading Framework - Comprehensive Test Suite

## Overview

The Comprehensive Test Suite validates the entire Tom King Trading Framework v17 across all account phases, market conditions, and edge cases. This is a complete plug-and-play testing system that ensures the framework performs correctly under all scenarios.

**🚨 IMPORTANT: This system generates RECOMMENDATIONS ONLY - NO LIVE TRADING occurs**

## Test Coverage

### 1. Account Size Scenarios (£30k-£75k+)
- **Phase 1** (£30k-40k): Limited strategies, micro futures only
- **Phase 2** (£40k-60k): MES/MNQ access, enhanced strategies  
- **Phase 3** (£60k-75k): Full futures access, advanced strategies
- **Phase 4** (£75k+): Professional deployment, all strategies

### 2. BP Utilization Scenarios (0%-95%)
- **0% BP**: Fresh deployment opportunities
- **30% BP**: Moderate deployment with room for growth
- **65% BP**: Maximum safe deployment (Tom King limit)
- **80% BP**: High risk warning scenarios
- **95% BP**: Disaster mode scenarios

### 3. Position Scenarios
- No positions (fresh start)
- Single positions (room for expansion)
- Three positions (under correlation limits)
- Max correlation group (energy warning)
- Mixed strategies (optimal deployment)
- 21 DTE management triggers
- Correlation violations (August 2024 prevention)

### 4. Market Condition Scenarios
- **VIX Regimes**: Extreme low (10), Normal (16), High (25), Crisis (40+)
- **August 5, 2024**: Disaster scenario recreation
- **Post-crisis recovery**: Cautious re-entry protocols

### 5. Day/Time Scenarios
- **Monday**: LEAP day strategies
- **Tuesday**: Strangle deployment day
- **Wednesday**: LT112 strategy day
- **Thursday**: Mid-week review
- **Friday**: Complete 0DTE analysis (9:00 AM - 3:00 PM)
- **Weekend**: Position review and planning

### 6. Edge Cases
- API failures with fallback
- Missing market data handling
- Invalid position data
- Extreme correlation violations
- Risk limit breaches
- Market closed scenarios
- Data validation errors

## Quick Start

### 1. Quick Demo (Fastest)
```bash
node runTests.js
```
Runs a quick validation test with key scenarios.

### 2. Quick Validation (Critical scenarios only)
```bash
node masterTestRunner.js quick
```

### 3. Complete Test Suite (All scenarios)
```bash
node masterTestRunner.js complete
```

### 4. Specific Categories
```bash
node masterTestRunner.js categories account_size bp_utilization
```

### 5. With Real API Data
```bash
node masterTestRunner.js complete --api
```

## Available Commands

### Master Test Runner
```bash
# Complete comprehensive testing
node masterTestRunner.js complete [--api] [--quiet] [--no-reports]

# Test specific categories  
node masterTestRunner.js categories [category1] [category2] [--api]

# Quick validation (critical scenarios)
node masterTestRunner.js quick [--api]

# List all scenarios
node masterTestRunner.js list
```

### Test Categories
- `account_size` - Account phase testing (£30k-£75k+)
- `bp_utilization` - BP usage scenarios (0%-95%)
- `position_scenarios` - Position management testing
- `market_conditions` - VIX regimes and market conditions
- `time_scenarios` - Day/time specific strategies
- `edge_cases` - Error handling and edge cases

### Original Test Runner (Legacy)
```bash
# List available scenarios
node testRunner.js list

# Run specific scenario
node testRunner.js run "Phase 1"

# Run all legacy scenarios
node testRunner.js all
```

## Test Output

### Console Output
- Real-time test execution progress
- Detailed scenario results
- Warning and error detection
- Performance metrics
- Final validation summary

### Generated Reports
All reports are saved to `test-reports/` directory:

- **`session-id-full-report.json`**: Complete machine-readable results
- **`session-id-results.csv`**: Spreadsheet-friendly format
- **`session-id-report.md`**: Human-readable summary
- **`session-id-performance.json`**: Performance analysis
- **`session-id-risk-analysis.json`**: Risk management validation
- **`session-id-recommendations.json`**: Strategy recommendation analysis

## Key Validations

### ✅ Framework Health Checks
- Strategy recommendation accuracy
- Risk rule compliance (correlation limits, BP usage)
- August 2024 disaster prevention protocols
- 21 DTE management rule enforcement
- Friday 0DTE timing validation

### ✅ Data Handling
- API failure graceful fallback
- Missing data error handling
- Invalid input validation
- Market hours compliance

### ✅ Phase-Appropriate Recommendations
- Phase 1: MCL/MGC strangles, conservative sizing
- Phase 2: MES LT112, enhanced strategies
- Phase 3: ES LT112, advanced strategies 
- Phase 4: Professional deployment, all strategies

### ✅ Risk Management
- Correlation group limits (max 3 per group)
- BP usage warnings (>50% high, >65% critical)
- VIX regime appropriate sizing
- Portfolio margin calculations

## Interpreting Results

### Success Criteria
- **95%+ Success Rate**: Excellent - Ready for production
- **90-95% Success Rate**: Good - Ready with minor issues
- **80-90% Success Rate**: Acceptable - Needs attention
- **<80% Success Rate**: Poor - Not ready for production

### Key Metrics
- **Strategy Match Rate**: How well recommendations match expected strategies
- **Warning Detection**: Critical risk warnings properly triggered
- **August 2024 Prevention**: Correlation disaster detection active
- **0DTE Coverage**: Friday analysis completeness
- **Performance**: Average execution time per test

### Warning Analysis
- **CRITICAL**: Correlation violations, account blow-up scenarios
- **HIGH**: BP usage >50%, large position losses
- **INFO**: Market closed, position reviews

## Customization

### Adding New Scenarios
Add scenarios to `src/comprehensiveTestSuite.js`:

```javascript
{
    name: "Custom Scenario Name",
    category: "custom_category", 
    input: "£50000 | positions | 30% | Tuesday Jan 7 11:00 AM EST | VIX 16.5 | No",
    expectedStrategies: ["Expected", "Strategies"],
    phase: 2,
    description: "Description of what this tests"
}
```

### Custom Categories
Add new test categories by extending the `testCategories` array and implementing corresponding getter methods.

## Troubleshooting

### Common Issues
1. **Tests failing**: Check API connectivity or run with `--no-api` flag
2. **Missing reports**: Ensure write permissions to `test-reports/` directory
3. **Slow execution**: Reduce test scope or check system resources

### Debug Mode
For detailed debugging, modify the test files to enable verbose logging:
```javascript
this.options.verbose = true;
```

## Integration

### CI/CD Integration
```bash
# Exit with error code if tests fail
node masterTestRunner.js quick --quiet && echo "Tests passed" || exit 1
```

### Scheduled Testing
```bash
# Daily validation
0 9 * * * cd /path/to/TomKingTrader && node masterTestRunner.js quick --no-reports
```

## Safety Features

### Built-in Safeguards
- **NO LIVE TRADING**: Framework operates in recommendation-only mode
- **Data Validation**: Input validation and error handling
- **Fallback Modes**: API failure graceful degradation
- **Risk Limits**: Hard-coded risk management rules

### August 2024 Disaster Prevention
The test suite specifically validates the correlation risk detection that would have prevented the £308k loss on August 5, 2024. Tests ensure the system properly warns when too many positions exist in the same correlation group.

## Performance

### Typical Performance
- **Quick Validation**: 5-15 seconds
- **Single Category**: 30-60 seconds  
- **Complete Suite**: 2-5 minutes
- **Memory Usage**: <100MB RAM

### Optimization
- Tests run in sequence to avoid resource conflicts
- Simulated data mode for faster execution
- Brief pauses between tests prevent overwhelming the system

## Support

### Getting Help
1. Review console output for specific error messages
2. Check generated reports in `test-reports/` directory
3. Validate input format matches expected patterns
4. Ensure all dependencies are installed (`npm install`)

### Reporting Issues
Include:
- Test command used
- Console output
- Generated report files
- System environment details

## Conclusion

This comprehensive test suite provides complete validation of the Tom King Trading Framework across all scenarios, ensuring robust and reliable recommendation generation. The system is designed to catch edge cases, validate risk management, and ensure the framework performs correctly under all market conditions while maintaining the critical safety feature of generating recommendations only - never executing live trades.

The test suite serves as both a validation tool and documentation of how the framework should behave in different scenarios, making it an essential component for maintaining system reliability and user confidence.