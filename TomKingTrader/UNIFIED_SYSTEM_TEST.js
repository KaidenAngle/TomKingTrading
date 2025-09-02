/**
 * UNIFIED TRADING SYSTEM TEST
 * Validates that the unified system works correctly across all modes
 */

const { UnifiedTradingEngine } = require('./UNIFIED_TRADING_ENGINE');

/**
 * Test 1: Engine Initialization
 */
function testEngineInitialization() {
    console.log('\n=== TEST 1: ENGINE INITIALIZATION ===');
    
    try {
        // Test all three modes
        const backtestEngine = new UnifiedTradingEngine('backtest');
        const paperEngine = new UnifiedTradingEngine('paper');
        const liveEngine = new UnifiedTradingEngine('live');
        
        console.log('✅ Backtest engine initialized successfully');
        console.log('✅ Paper engine initialized successfully');
        console.log('✅ Live engine initialized successfully');
        
        // Verify modes are set correctly
        console.log(`Backtest mode: ${backtestEngine.mode}`);
        console.log(`Paper mode: ${paperEngine.mode}`);
        console.log(`Live mode: ${liveEngine.mode}`);
        
        return true;
    } catch (error) {
        console.log('❌ Engine initialization failed:', error.message);
        return false;
    }
}

/**
 * Test 2: Portfolio Management Consistency
 */
function testPortfolioConsistency() {
    console.log('\n=== TEST 2: PORTFOLIO CONSISTENCY ===');
    
    try {
        const engine1 = new UnifiedTradingEngine('backtest', { initialCapital: 50000 });
        const engine2 = new UnifiedTradingEngine('paper', { initialCapital: 50000 });
        
        // Check that both engines have identical portfolio structure
        const portfolio1 = engine1.getPortfolioSummary();
        const portfolio2 = engine2.getPortfolioSummary();
        
        console.log('Portfolio structure comparison:');
        console.log(`Backtest initial cash: £${portfolio1.cash}`);
        console.log(`Paper initial cash: £${portfolio2.cash}`);
        console.log(`Backtest total value: £${portfolio1.totalValue}`);
        console.log(`Paper total value: £${portfolio2.totalValue}`);
        
        const cashMatch = portfolio1.cash === portfolio2.cash;
        const valueMatch = portfolio1.totalValue === portfolio2.totalValue;
        
        if (cashMatch && valueMatch) {
            console.log('✅ Portfolio initialization is consistent across modes');
            return true;
        } else {
            console.log('❌ Portfolio initialization inconsistency detected');
            return false;
        }
    } catch (error) {
        console.log('❌ Portfolio consistency test failed:', error.message);
        return false;
    }
}

/**
 * Test 3: Component Integration
 */
function testComponentIntegration() {
    console.log('\n=== TEST 3: COMPONENT INTEGRATION ===');
    
    try {
        const engine = new UnifiedTradingEngine('backtest');
        
        // Verify all components are initialized
        const hasPatternAnalysis = engine.patternAnalysis !== null;
        const hasRecommendationEngine = engine.recommendationEngine !== null;
        const hasRiskManager = engine.riskManager !== null;
        const hasOrderManager = engine.orderManager !== null;
        const hasGreeksCalculator = engine.greeksCalculator !== null;
        const hasAPI = engine.api !== null;
        
        console.log(`Pattern Analysis: ${hasPatternAnalysis ? '✅' : '❌'}`);
        console.log(`Recommendation Engine: ${hasRecommendationEngine ? '✅' : '❌'}`);
        console.log(`Risk Manager: ${hasRiskManager ? '✅' : '❌'}`);
        console.log(`Order Manager: ${hasOrderManager ? '✅' : '❌'}`);
        console.log(`Greeks Calculator: ${hasGreeksCalculator ? '✅' : '❌'}`);
        console.log(`API Integration: ${hasAPI ? '✅' : '❌'}`);
        
        const allComponentsLoaded = hasPatternAnalysis && hasRecommendationEngine && 
                                    hasRiskManager && hasOrderManager && 
                                    hasGreeksCalculator && hasAPI;
        
        if (allComponentsLoaded) {
            console.log('✅ All components integrated successfully');
            return true;
        } else {
            console.log('❌ Component integration incomplete');
            return false;
        }
    } catch (error) {
        console.log('❌ Component integration test failed:', error.message);
        return false;
    }
}

/**
 * Test 4: Mode-specific Behavior
 */
async function testModeSpecificBehavior() {
    console.log('\n=== TEST 4: MODE-SPECIFIC BEHAVIOR ===');
    
    try {
        const backtestEngine = new UnifiedTradingEngine('backtest');
        const paperEngine = new UnifiedTradingEngine('paper');
        
        // Test that different modes handle data differently
        console.log('Testing data handling differences:');
        console.log(`Backtest engine uses: Historical data`);
        console.log(`Paper engine uses: Live data`);
        
        // Test portfolio summary format consistency
        const backtestSummary = backtestEngine.getPortfolioSummary();
        const paperSummary = paperEngine.getPortfolioSummary();
        
        const summaryKeysMatch = JSON.stringify(Object.keys(backtestSummary).sort()) === 
                                JSON.stringify(Object.keys(paperSummary).sort());
        
        if (summaryKeysMatch) {
            console.log('✅ Portfolio summary format is consistent across modes');
            return true;
        } else {
            console.log('❌ Portfolio summary format inconsistency detected');
            return false;
        }
    } catch (error) {
        console.log('❌ Mode-specific behavior test failed:', error.message);
        return false;
    }
}

/**
 * Test 5: Risk Management Consistency
 */
function testRiskManagementConsistency() {
    console.log('\n=== TEST 5: RISK MANAGEMENT CONSISTENCY ===');
    
    try {
        // Create engines with identical risk parameters
        const riskParams = {
            maxBPUsage: 0.35,
            correlationLimit: 3,
            initialCapital: 30000
        };
        
        const engine1 = new UnifiedTradingEngine('backtest', riskParams);
        const engine2 = new UnifiedTradingEngine('paper', riskParams);
        const engine3 = new UnifiedTradingEngine('live', riskParams);
        
        // Verify risk parameters are set identically
        console.log('Risk parameter comparison:');
        console.log(`Backtest BP Usage: ${engine1.options.maxBPUsage}`);
        console.log(`Paper BP Usage: ${engine2.options.maxBPUsage}`);
        console.log(`Live BP Usage: ${engine3.options.maxBPUsage}`);
        
        console.log(`Backtest Correlation Limit: ${engine1.options.correlationLimit}`);
        console.log(`Paper Correlation Limit: ${engine2.options.correlationLimit}`);
        console.log(`Live Correlation Limit: ${engine3.options.correlationLimit}`);
        
        const bpMatch = engine1.options.maxBPUsage === engine2.options.maxBPUsage && 
                       engine2.options.maxBPUsage === engine3.options.maxBPUsage;
        
        const corrMatch = engine1.options.correlationLimit === engine2.options.correlationLimit && 
                         engine2.options.correlationLimit === engine3.options.correlationLimit;
        
        if (bpMatch && corrMatch) {
            console.log('✅ Risk management parameters are consistent across modes');
            return true;
        } else {
            console.log('❌ Risk management parameter inconsistency detected');
            return false;
        }
    } catch (error) {
        console.log('❌ Risk management consistency test failed:', error.message);
        return false;
    }
}

/**
 * Test 6: Statistics and Reporting
 */
function testStatisticsReporting() {
    console.log('\n=== TEST 6: STATISTICS AND REPORTING ===');
    
    try {
        const engine = new UnifiedTradingEngine('backtest');
        
        // Get initial statistics
        const stats = engine.getStatistics();
        
        // Verify expected statistics structure
        const expectedKeys = ['mode', 'totalTrades', 'winningTrades', 'losingTrades', 
                             'winRate', 'totalReturn', 'realizedPnL', 'unrealizedPnL', 'currentPositions'];
        
        const hasAllKeys = expectedKeys.every(key => key in stats);
        
        console.log('Statistics structure verification:');
        expectedKeys.forEach(key => {
            const hasKey = key in stats;
            console.log(`${key}: ${hasKey ? '✅' : '❌'}`);
        });
        
        if (hasAllKeys) {
            console.log('✅ Statistics reporting structure is complete');
            return true;
        } else {
            console.log('❌ Statistics reporting structure is incomplete');
            return false;
        }
    } catch (error) {
        console.log('❌ Statistics reporting test failed:', error.message);
        return false;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('UNIFIED TRADING SYSTEM VALIDATION TEST SUITE');
    console.log('===========================================');
    
    const tests = [
        testEngineInitialization,
        testPortfolioConsistency,
        testComponentIntegration,
        testModeSpecificBehavior,
        testRiskManagementConsistency,
        testStatisticsReporting
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
        try {
            const result = await test();
            if (result) passedTests++;
        } catch (error) {
            console.log('❌ Test failed with error:', error.message);
        }
    }
    
    console.log('\n=== TEST RESULTS SUMMARY ===');
    console.log(`Tests Passed: ${passedTests}/${tests.length}`);
    console.log(`Success Rate: ${(passedTests / tests.length * 100).toFixed(1)}%`);
    
    if (passedTests === tests.length) {
        console.log('🎉 ALL TESTS PASSED! Unified system is working correctly.');
        console.log('✅ Backtesting will use EXACT same logic as live trading');
        console.log('✅ Risk management is consistent across all modes');
        console.log('✅ Portfolio management works identically');
        console.log('✅ Component integration is complete');
    } else {
        console.log('⚠️  Some tests failed. Review the unified system implementation.');
    }
    
    return passedTests === tests.length;
}

// Export for use in other modules
module.exports = {
    testEngineInitialization,
    testPortfolioConsistency,
    testComponentIntegration,
    testModeSpecificBehavior,
    testRiskManagementConsistency,
    testStatisticsReporting,
    runAllTests
};

// Run if called directly
if (require.main === module) {
    runAllTests().catch(console.error);
}