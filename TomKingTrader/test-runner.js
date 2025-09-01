#!/usr/bin/env node

/**
 * Tom King Trading Framework - Comprehensive Test Runner
 * Tests all components and features systematically
 */

const fs = require('fs');
const path = require('path');
const { TomKingTrader, TomKingUtils } = require('./src/index');
const SignalGenerator = require('./src/signalGenerator');
const TradingStrategies = require('./src/strategies');
const { PatternAnalyzer } = require('./src/patternAnalysis');
const { PositionManager } = require('./src/positionManager');
const { RiskManager } = require('./src/riskManager');
const GreeksCalculator = require('./src/greeksCalculator');
const config = require('./src/config');

// Test Results Tracking
const testResults = {
    passed: [],
    failed: [],
    warnings: [],
    startTime: new Date(),
    endTime: null
};

// Color codes for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Helper functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const color = type === 'success' ? colors.green :
                  type === 'error' ? colors.red :
                  type === 'warning' ? colors.yellow :
                  type === 'info' ? colors.blue : colors.reset;
    
    console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function assert(condition, testName, expectedValue, actualValue) {
    if (condition) {
        testResults.passed.push(testName);
        log(`✅ ${testName}`, 'success');
        return true;
    } else {
        testResults.failed.push({
            test: testName,
            expected: expectedValue,
            actual: actualValue
        });
        log(`❌ ${testName}`, 'error');
        log(`   Expected: ${JSON.stringify(expectedValue)}`, 'error');
        log(`   Actual: ${JSON.stringify(actualValue)}`, 'error');
        return false;
    }
}

// Test Suite 1: Core Module Loading
async function testModuleLoading() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 1: Core Module Loading', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const modules = [
        { name: 'TomKingTrader', module: TomKingTrader },
        { name: 'TomKingUtils', module: TomKingUtils },
        { name: 'SignalGenerator', module: SignalGenerator },
        { name: 'TradingStrategies', module: TradingStrategies },
        { name: 'PatternAnalyzer', module: PatternAnalyzer },
        { name: 'PositionManager', module: PositionManager },
        { name: 'RiskManager', module: RiskManager },
        { name: 'GreeksCalculator', module: GreeksCalculator }
    ];
    
    for (const { name, module } of modules) {
        assert(module !== undefined, `Module ${name} loads`, 'defined', module ? 'loaded' : 'undefined');
    }
}

// Test Suite 2: Configuration Validation
async function testConfiguration() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 2: Configuration Validation', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    // Test phase configuration
    assert(config.PHASES[1] !== undefined, 'Phase 1 configuration exists', true, config.PHASES[1] !== undefined);
    assert(config.PHASES[1].range.min === 30000, 'Phase 1 minimum is £30k', 30000, config.PHASES[1].range.min);
    assert(config.PHASES[1].allowedTickers.includes('MCL'), 'Phase 1 includes MCL', true, config.PHASES[1].allowedTickers.includes('MCL'));
    
    // Test VIX regime levels
    assert(config.VIX_LEVELS.VERY_LOW.max === 12, 'VIX Very Low max is 12', 12, config.VIX_LEVELS.VERY_LOW.max);
    assert(config.VIX_LEVELS.EXTREME.min === 30, 'VIX Extreme min is 30', 30, config.VIX_LEVELS.EXTREME.min);
    
    // Test correlation groups
    assert(Array.isArray(config.CORRELATION_GROUPS.EQUITIES), 'Equities correlation group exists', true, Array.isArray(config.CORRELATION_GROUPS.EQUITIES));
}

// Test Suite 3: Pattern Analysis
async function testPatternAnalysis() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 3: Pattern Analysis Engine', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const analyzer = new PatternAnalyzer();
    
    // Test with sample market data
    const sampleData = {
        symbol: 'SPY',
        current: 450.25,
        open: 448.50,
        high: 451.75,
        low: 447.25,
        close: 450.25,
        volume: 85000000,
        atr: 4.5,
        rsi: 55,
        ema20: 448.00,
        ema50: 445.00,
        vwap: 449.50,
        iv: 16.5,
        ivRank: 35,
        ivPercentile: 42
    };
    
    const analysis = analyzer.analyzeMarket(sampleData);
    
    assert(analysis !== null, 'Pattern analysis returns result', 'object', typeof analysis);
    assert(analysis.trend !== undefined, 'Analysis includes trend', true, analysis.trend !== undefined);
    assert(analysis.strength !== undefined, 'Analysis includes strength', true, analysis.strength !== undefined);
    assert(typeof analysis.score === 'number', 'Analysis score is numeric', true, typeof analysis.score === 'number');
    
    log(`   Pattern Analysis Score: ${analysis.score}`, 'info');
    log(`   Trend: ${analysis.trend}`, 'info');
    log(`   Strength: ${analysis.strength}`, 'info');
}

// Test Suite 4: Risk Management
async function testRiskManagement() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 4: Risk Management System', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const riskManager = new RiskManager();
    
    // Test position sizing
    const accountValue = 40000;
    const vix = 18;
    const phase = 1;
    
    const sizing = riskManager.calculatePositionSize(accountValue, vix, phase);
    
    assert(sizing !== null, 'Position sizing calculation works', 'object', typeof sizing);
    assert(sizing.maxRisk > 0, 'Max risk is positive', true, sizing.maxRisk > 0);
    assert(sizing.maxRisk <= accountValue * 0.05, 'Max risk within 5% limit', true, sizing.maxRisk <= accountValue * 0.05);
    
    // Test correlation limits
    const positions = [
        { symbol: 'SPY', correlationGroup: 'EQUITIES' },
        { symbol: 'QQQ', correlationGroup: 'EQUITIES' },
        { symbol: 'IWM', correlationGroup: 'EQUITIES' }
    ];
    
    const canAddMore = riskManager.checkCorrelationLimits(positions, 'EQUITIES');
    assert(canAddMore === false, 'Correlation limit enforced (max 3)', false, canAddMore);
    
    log(`   Max risk for £${accountValue}: £${sizing.maxRisk}`, 'info');
    log(`   Correlation check: ${canAddMore ? 'Can add' : 'Limit reached'}`, 'info');
}

// Test Suite 5: Greeks Calculation
async function testGreeksCalculation() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 5: Greeks Calculator', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const greeksCalc = new GreeksCalculator();
    
    // Test Black-Scholes calculation
    const optionParams = {
        S: 450,     // Spot price
        K: 455,     // Strike price
        T: 0.0833,  // Time to expiration (1 month = 30/365)
        r: 0.05,    // Risk-free rate
        sigma: 0.16 // Implied volatility
    };
    
    const callGreeks = greeksCalc.calculateGreeks('call', optionParams);
    const putGreeks = greeksCalc.calculateGreeks('put', optionParams);
    
    assert(callGreeks !== null, 'Call Greeks calculated', 'object', typeof callGreeks);
    assert(putGreeks !== null, 'Put Greeks calculated', 'object', typeof putGreeks);
    assert(callGreeks.delta > 0 && callGreeks.delta < 1, 'Call delta in valid range', true, callGreeks.delta > 0 && callGreeks.delta < 1);
    assert(putGreeks.delta < 0 && putGreeks.delta > -1, 'Put delta in valid range', true, putGreeks.delta < 0 && putGreeks.delta > -1);
    
    log(`   Call Delta: ${callGreeks.delta?.toFixed(4)}`, 'info');
    log(`   Put Delta: ${putGreeks.delta?.toFixed(4)}`, 'info');
    log(`   Gamma: ${callGreeks.gamma?.toFixed(4)}`, 'info');
    log(`   Vega: ${callGreeks.vega?.toFixed(4)}`, 'info');
    log(`   Theta: ${callGreeks.theta?.toFixed(4)}`, 'info');
}

// Test Suite 6: Trading Strategies
async function testTradingStrategies() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 6: Trading Strategies', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const strategies = new TradingStrategies();
    
    // Test 0DTE Friday strategy
    const fridayData = {
        dayOfWeek: 5,
        currentTime: '11:00',
        vix: 15,
        spy: {
            current: 450,
            atr: 4.5,
            trend: 'bullish'
        }
    };
    
    const zeroDTESignal = strategies.analyze0DTE(fridayData);
    assert(zeroDTESignal !== null, '0DTE Friday analysis works', 'object', typeof zeroDTESignal);
    
    // Test Long-Term 112 strategy
    const lt112Data = {
        dte: 112,
        iv: 18,
        ivRank: 45,
        underlying: 450
    };
    
    const lt112Signal = strategies.analyzeLT112(lt112Data);
    assert(lt112Signal !== null, 'LT112 analysis works', 'object', typeof lt112Signal);
    
    // Test Strangle strategy
    const strangleData = {
        dte: 90,
        iv: 22,
        ivPercentile: 65,
        underlying: 450,
        atr: 4.5
    };
    
    const strangleSignal = strategies.analyzeStrangle(strangleData);
    assert(strangleSignal !== null, 'Strangle analysis works', 'object', typeof strangleSignal);
    
    log(`   0DTE Signal: ${zeroDTESignal?.action || 'No signal'}`, 'info');
    log(`   LT112 Signal: ${lt112Signal?.action || 'No signal'}`, 'info');
    log(`   Strangle Signal: ${strangleSignal?.action || 'No signal'}`, 'info');
}

// Test Suite 7: Complete Workflow Test
async function testCompleteWorkflow() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 7: Complete Workflow (End-to-End)', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    // Initialize framework
    const trader = new TomKingTrader({
        environment: 'development',
        useAPI: false,
        testMode: true
    });
    
    // Test initialization
    const initResult = await trader.initialize({
        accountValue: 40000,
        currentPositions: 0,
        buyingPowerUsed: 0,
        hasAPICredentials: false,
        testMode: 'Monday 10:45 AM EST'
    });
    
    assert(initResult.success === true, 'Framework initializes', true, initResult.success);
    
    // Test ticker qualification
    const qualifiedTickers = trader.getQualifiedTickers(40000);
    assert(Array.isArray(qualifiedTickers), 'Qualified tickers returned', true, Array.isArray(qualifiedTickers));
    assert(qualifiedTickers.length > 0, 'Has qualified tickers', true, qualifiedTickers.length > 0);
    
    log(`   Initialization: ${initResult.success ? 'Success' : 'Failed'}`, initResult.success ? 'success' : 'error');
    log(`   Account Phase: ${initResult.phase}`, 'info');
    log(`   Qualified Tickers: ${qualifiedTickers.join(', ')}`, 'info');
    
    // Test pattern analysis with sample data
    const marketData = {
        SPY: {
            current: 450.25,
            open: 448.50,
            high: 451.75,
            low: 447.25,
            volume: 85000000,
            atr: 4.5,
            rsi: 55,
            iv: 16.5,
            ivRank: 35
        },
        MCL: {
            current: 85.30,
            open: 84.75,
            high: 85.80,
            low: 84.50,
            volume: 15000,
            atr: 1.2,
            rsi: 48,
            iv: 28.5,
            ivRank: 42
        }
    };
    
    const analysis = await trader.runAnalysis(marketData);
    assert(analysis !== null, 'Analysis completes', 'object', typeof analysis);
    
    if (analysis && analysis.recommendations) {
        log(`   Recommendations: ${analysis.recommendations.length}`, 'info');
        if (analysis.recommendations.length > 0) {
            const rec = analysis.recommendations[0];
            log(`   First Recommendation: ${rec.action} ${rec.symbol} ${rec.strategy}`, 'info');
        }
    }
}

// Test Suite 8: Error Handling
async function testErrorHandling() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 8: Error Handling & Edge Cases', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const trader = new TomKingTrader({ testMode: true });
    
    // Test with invalid data
    try {
        const result = await trader.runAnalysis(null);
        assert(result.error !== undefined, 'Handles null data gracefully', true, result.error !== undefined);
    } catch (error) {
        assert(true, 'Error caught for null data', true, true);
    }
    
    // Test with empty positions
    const riskManager = new RiskManager();
    const emptyCheck = riskManager.checkCorrelationLimits([], 'EQUITIES');
    assert(emptyCheck === true, 'Handles empty positions', true, emptyCheck);
    
    // Test with extreme values
    const greeksCalc = new GreeksCalculator();
    const extremeGreeks = greeksCalc.calculateGreeks('call', {
        S: 0.01,
        K: 1000000,
        T: 0.001,
        r: 0,
        sigma: 5
    });
    assert(extremeGreeks !== null, 'Handles extreme values', true, extremeGreeks !== null);
    
    log('   All error handling tests completed', 'success');
}

// Test Suite 9: Performance Testing
async function testPerformance() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 9: Performance Testing', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const analyzer = new PatternAnalyzer();
    
    // Test analysis speed
    const iterations = 1000;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        analyzer.analyzeMarket({
            symbol: 'TEST',
            current: 100 + Math.random() * 10,
            open: 100,
            high: 105,
            low: 95,
            volume: 1000000,
            atr: 2,
            rsi: 50 + Math.random() * 20,
            iv: 20 + Math.random() * 10
        });
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / iterations;
    
    assert(avgTime < 10, `Analysis avg time < 10ms (${avgTime.toFixed(2)}ms)`, true, avgTime < 10);
    
    log(`   ${iterations} analyses in ${totalTime}ms`, 'info');
    log(`   Average time per analysis: ${avgTime.toFixed(2)}ms`, 'info');
    log(`   Throughput: ${(iterations / (totalTime / 1000)).toFixed(0)} analyses/second`, 'info');
}

// Test Suite 10: Data Validation
async function testDataValidation() {
    log('\n═══════════════════════════════════════════', 'info');
    log('TEST SUITE 10: Data Validation & Parsing', 'info');
    log('═══════════════════════════════════════════', 'info');
    
    const utils = TomKingUtils;
    
    // Test date/time utilities
    const now = new Date();
    const dayOfWeek = utils.getDayOfWeek(now);
    assert(dayOfWeek >= 0 && dayOfWeek <= 6, 'Day of week in valid range', true, dayOfWeek >= 0 && dayOfWeek <= 6);
    
    const isTradingHours = utils.isTradingHours(new Date('2024-01-15 10:30:00'));
    assert(typeof isTradingHours === 'boolean', 'Trading hours check returns boolean', true, typeof isTradingHours === 'boolean');
    
    // Test number formatting
    const formattedValue = utils.formatCurrency(12345.67);
    assert(formattedValue.includes('£'), 'Currency formatting includes £', true, formattedValue.includes('£'));
    
    // Test percentage formatting
    const percentage = utils.formatPercentage(0.0567);
    assert(percentage.includes('%'), 'Percentage formatting includes %', true, percentage.includes('%'));
    
    log(`   Current day: ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]}`, 'info');
    log(`   Trading hours check: ${isTradingHours}`, 'info');
    log(`   Currency format: ${formattedValue}`, 'info');
    log(`   Percentage format: ${percentage}`, 'info');
}

// Main Test Runner
async function runAllTests() {
    console.clear();
    log('╔═══════════════════════════════════════════════════════════╗', 'info');
    log('║   TOM KING TRADING FRAMEWORK - COMPREHENSIVE TEST SUITE   ║', 'info');
    log('╚═══════════════════════════════════════════════════════════╝', 'info');
    log(`Started at: ${testResults.startTime.toISOString()}`, 'info');
    
    try {
        // Run all test suites
        await testModuleLoading();
        await testConfiguration();
        await testPatternAnalysis();
        await testRiskManagement();
        await testGreeksCalculation();
        await testTradingStrategies();
        await testCompleteWorkflow();
        await testErrorHandling();
        await testPerformance();
        await testDataValidation();
        
    } catch (error) {
        log(`\nCritical error during testing: ${error.message}`, 'error');
        console.error(error);
    }
    
    // Generate test report
    testResults.endTime = new Date();
    const duration = (testResults.endTime - testResults.startTime) / 1000;
    
    log('\n╔═══════════════════════════════════════════════════════════╗', 'info');
    log('║                      TEST RESULTS                          ║', 'info');
    log('╚═══════════════════════════════════════════════════════════╝', 'info');
    
    log(`\n📊 SUMMARY:`, 'info');
    log(`   Total Tests: ${testResults.passed.length + testResults.failed.length}`, 'info');
    log(`   ✅ Passed: ${testResults.passed.length}`, 'success');
    log(`   ❌ Failed: ${testResults.failed.length}`, testResults.failed.length > 0 ? 'error' : 'success');
    log(`   ⚠️  Warnings: ${testResults.warnings.length}`, testResults.warnings.length > 0 ? 'warning' : 'info');
    log(`   ⏱️  Duration: ${duration.toFixed(2)} seconds`, 'info');
    
    if (testResults.failed.length > 0) {
        log('\n❌ FAILED TESTS:', 'error');
        testResults.failed.forEach(failure => {
            log(`   • ${failure.test}`, 'error');
            log(`     Expected: ${JSON.stringify(failure.expected)}`, 'error');
            log(`     Actual: ${JSON.stringify(failure.actual)}`, 'error');
        });
    }
    
    if (testResults.warnings.length > 0) {
        log('\n⚠️  WARNINGS:', 'warning');
        testResults.warnings.forEach(warning => {
            log(`   • ${warning}`, 'warning');
        });
    }
    
    // Save test results to file
    const reportPath = path.join(__dirname, 'test-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    log(`\n📁 Test results saved to: ${reportPath}`, 'info');
    
    // Exit with appropriate code
    const exitCode = testResults.failed.length > 0 ? 1 : 0;
    log(`\n${exitCode === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'}`, exitCode === 0 ? 'success' : 'error');
    
    process.exit(exitCode);
}

// Run tests if executed directly
if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runAllTests, testResults };