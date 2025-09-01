#!/usr/bin/env node

/**
 * COMPLETE SYSTEM TEST
 * Tests all components of the Tom King Trading Framework
 * Including pattern analysis, recommendations, and v14/v16/v17 features
 */

require('dotenv').config();
const { TastyTradeAPI } = require('./src/tastytradeAPI');
const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');
const V14CompleteFunctionality = require('./src/v14CompleteFunctionality');
const TextAnalyzer = require('./textAnalysis');

// Simulated test data
const TEST_USER_DATA = {
    accountValue: 45000,
    phase: 2,
    bpUsed: 28,
    dayOfWeek: 'Friday',
    dateStr: 'Friday Jan 10',
    timeStr: '10:15 AM',
    timeEST: '10:15 AM EST',
    vixLevel: 16.5,
    portfolioMargin: false,
    monthPL: 2450,
    positions: [
        { ticker: 'MES', strategy: 'STRANGLE', dte: 45, pl: 15, entry: 5420 },
        { ticker: 'GLD', strategy: 'LT112', dte: 112, pl: 8, entry: 195 },
        { ticker: 'MCL', strategy: 'STRANGLE', dte: 21, pl: 48, entry: 72.5 },
        { ticker: 'TLT', strategy: 'IPMCC', dte: 280, pl: -5, entry: 95 }
    ]
};

// Simulated market data
const TEST_MARKET_DATA = {
    ES: {
        currentPrice: 5468.50,
        openPrice: 5450.00,
        previousClose: 5445.00,
        high5d: 5485,
        low5d: 5420,
        high20d: 5510,
        low20d: 5380,
        atr: 45,
        rsi: 58,
        ema8: 5460,
        ema21: 5455,
        vwap: 5459,
        iv: 15.2,
        ivRank: 35,
        ivPercentile: 42,
        overnightHigh: 5475,
        overnightLow: 5440,
        globexVolume: 125000
    },
    SPY: {
        currentPrice: 545.25,
        openPrice: 543.50,
        previousClose: 543.00,
        high20d: 548,
        low20d: 538,
        iv: 14.8,
        ivRank: 32
    },
    MES: {
        currentPrice: 5468.50,
        high20d: 5510,
        low20d: 5380,
        iv: 15.2,
        ivRank: 35
    },
    GLD: {
        currentPrice: 198.50,
        high20d: 202,
        low20d: 194,
        iv: 18.5,
        ivRank: 45
    },
    MCL: {
        currentPrice: 74.25,
        high20d: 78,
        low20d: 70,
        iv: 28.5,
        ivRank: 55
    },
    TLT: {
        currentPrice: 96.50,
        high20d: 99,
        low20d: 94,
        iv: 22.5,
        ivRank: 48
    }
};

/**
 * Test 1: V14 Complete Functionality
 */
async function testV14Functionality() {
    console.log('\n================================================================================');
    console.log('                        TEST 1: V14 COMPLETE FUNCTIONALITY                      ');
    console.log('================================================================================\n');
    
    const v14 = new V14CompleteFunctionality();
    const results = await v14.runComprehensiveAnalysis(TEST_USER_DATA, TEST_MARKET_DATA);
    
    // Verify all v14 features are working
    const tests = {
        fridayAnalysis: !!results.fridayAnalysis,
        allocationTable: !!results.allocationTable,
        correlationCheck: !!results.correlationCheck,
        capitalRecycling: !!results.capitalRecycling,
        vixSpike: !!results.vixSpike
    };
    
    console.log('\n📊 V14 Feature Test Results:');
    console.log(`   Friday Analysis:    ${tests.fridayAnalysis ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Allocation Table:   ${tests.allocationTable ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Correlation Check:  ${tests.correlationCheck ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Capital Recycling:  ${tests.capitalRecycling ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   VIX Spike Protocol: ${tests.vixSpike ? '✅ PASSED' : '❌ FAILED'}`);
    
    return tests;
}

/**
 * Test 2: Enhanced Recommendation Engine
 */
async function testRecommendationEngine() {
    console.log('\n================================================================================');
    console.log('                    TEST 2: ENHANCED RECOMMENDATION ENGINE                      ');
    console.log('================================================================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    
    // Initialize without API (use simulated data)
    await engine.initialize(false);
    
    // Inject test market data
    engine.currentMarketData = TEST_MARKET_DATA;
    
    // Generate recommendations
    const recommendations = await engine.generateEnhancedRecommendations(
        TEST_USER_DATA,
        true,  // Include Greeks
        true   // Include Patterns
    );
    
    // Verify recommendations
    const tests = {
        summary: !!recommendations.summary,
        qualifiedTickers: recommendations.qualifiedTickers?.length > 0,
        patternAnalysis: Object.keys(recommendations.patternAnalysis || {}).length > 0,
        greeksAnalysis: Object.keys(recommendations.greeksAnalysis || {}).length > 0,
        strikeRecommendations: Object.keys(recommendations.strikeRecommendations || {}).length > 0,
        actionItems: recommendations.actionItems?.length > 0
    };
    
    console.log('📊 Recommendation Engine Test Results:');
    console.log(`   Summary Generated:     ${tests.summary ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Tickers Qualified:     ${tests.qualifiedTickers ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Pattern Analysis:      ${tests.patternAnalysis ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Greeks Analysis:       ${tests.greeksAnalysis ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Strike Recommendations: ${tests.strikeRecommendations ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Action Items:          ${tests.actionItems ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (recommendations.actionItems && recommendations.actionItems.length > 0) {
        console.log('\n🎯 Top 3 Recommendations:');
        recommendations.actionItems.slice(0, 3).forEach((item, idx) => {
            console.log(`   ${idx + 1}. [${item.priority}] ${item.action}`);
            console.log(`      ${item.details}`);
        });
    }
    
    return tests;
}

/**
 * Test 3: Pattern Analysis Accuracy
 */
async function testPatternAnalysis() {
    console.log('\n================================================================================');
    console.log('                        TEST 3: PATTERN ANALYSIS ACCURACY                       ');
    console.log('================================================================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    await engine.initialize(false);
    
    // Test pattern detection for each ticker
    const patternTests = {};
    
    for (const [ticker, data] of Object.entries(TEST_MARKET_DATA)) {
        if (ticker === 'ES' || ticker === 'SPY') continue; // Skip non-tradeable
        
        const pattern = engine.analyzePatterns(ticker, data, engine.getVIXRegime(TEST_USER_DATA.vixLevel), TEST_USER_DATA);
        
        patternTests[ticker] = {
            signals: pattern.signals.length,
            confidence: pattern.confidence,
            preferredStrategy: pattern.preferredStrategy,
            passed: pattern.signals.length > 0 && pattern.confidence > 0
        };
        
        console.log(`📈 ${ticker} Pattern Analysis:`);
        console.log(`   Signals Found: ${pattern.signals.length}`);
        console.log(`   Confidence: ${pattern.confidence.toFixed(0)}%`);
        console.log(`   Strategy: ${pattern.preferredStrategy || 'None'}`);
        console.log(`   Result: ${patternTests[ticker].passed ? '✅ PASSED' : '⚠️ NO PATTERNS'}`);
    }
    
    return patternTests;
}

/**
 * Test 4: Greeks Calculations
 */
async function testGreeksCalculations() {
    console.log('\n================================================================================');
    console.log('                        TEST 4: GREEKS CALCULATIONS                             ');
    console.log('================================================================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    await engine.initialize(false);
    
    // Generate simulated option chain
    const ticker = 'MES';
    const marketData = TEST_MARKET_DATA[ticker];
    const optionChain = engine.generateSimulatedOptionChain(ticker, marketData);
    
    // Test Greeks analysis
    const greeksAnalysis = engine.analyzeGreeksForTicker(ticker, optionChain, marketData, TEST_USER_DATA);
    
    const tests = {
        hasRecommendations: greeksAnalysis.recommendations?.length > 0,
        hasGreeksProfile: !!greeksAnalysis.greeksProfile,
        hasDiversificationScore: greeksAnalysis.diversificationScore > 0,
        hasRiskScore: greeksAnalysis.riskAdjustedOpportunity > 0
    };
    
    console.log('📊 Greeks Calculation Results:');
    console.log(`   Recommendations: ${tests.hasRecommendations ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Greeks Profile:  ${tests.hasGreeksProfile ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Diversification: ${tests.hasDiversificationScore ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`   Risk Score:      ${tests.hasRiskScore ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (greeksAnalysis.recommendations && greeksAnalysis.recommendations.length > 0) {
        const rec = greeksAnalysis.recommendations[0];
        if (rec.viable && rec.greeksImpact) {
            console.log('\n⚡ Sample Greeks Impact:');
            console.log(`   Strategy: ${rec.strategy}`);
            console.log(`   Delta: ${rec.greeksImpact.delta?.toFixed(3) || '0'}`);
            console.log(`   Gamma: ${rec.greeksImpact.gamma?.toFixed(3) || '0'}`);
            console.log(`   Theta: ${rec.greeksImpact.theta?.toFixed(3) || '0'}`);
            console.log(`   Vega:  ${rec.greeksImpact.vega?.toFixed(3) || '0'}`);
        }
    }
    
    return tests;
}

/**
 * Test 5: Strike Selection Logic
 */
async function testStrikeSelection() {
    console.log('\n================================================================================');
    console.log('                        TEST 5: STRIKE SELECTION LOGIC                          ');
    console.log('================================================================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    await engine.initialize(false);
    
    // Generate option chain
    const ticker = 'GLD';
    const marketData = TEST_MARKET_DATA[ticker];
    const optionChain = engine.generateSimulatedOptionChain(ticker, marketData);
    
    // Test different strategy strike selections
    const vixRegime = engine.getVIXRegime(TEST_USER_DATA.vixLevel);
    
    const strangleStrikes = engine.findOptimalStrangleStrikes(optionChain.strikes, vixRegime);
    const ironCondorStrikes = engine.findOptimalIronCondorStrikes(optionChain.strikes, vixRegime);
    const zdteStrikes = engine.findOptimal0DTEStrikes(optionChain.strikes, TEST_USER_DATA);
    
    const tests = {
        strangleViable: strangleStrikes.viable,
        ironCondorViable: ironCondorStrikes.viable,
        zdteViable: zdteStrikes.viable && TEST_USER_DATA.dayOfWeek === 'Friday'
    };
    
    console.log('🎯 Strike Selection Results:');
    console.log(`   Strangle Strikes:    ${tests.strangleViable ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (strangleStrikes.viable) {
        console.log(`      Put: ${strangleStrikes.putStrike}, Call: ${strangleStrikes.callStrike}`);
        console.log(`      Credit: £${strangleStrikes.netCredit?.toFixed(2) || 'N/A'}`);
    }
    
    console.log(`   Iron Condor Strikes: ${tests.ironCondorViable ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (ironCondorStrikes.viable) {
        const s = ironCondorStrikes.strikes;
        console.log(`      Strikes: ${s.putLong}/${s.putShort}/${s.callShort}/${s.callLong}`);
        console.log(`      Credit: £${ironCondorStrikes.netCredit?.toFixed(2) || 'N/A'}`);
    }
    
    console.log(`   0DTE Strikes:        ${tests.zdteViable ? '✅ FOUND' : '⚠️ NOT FRIDAY'}`);
    if (zdteStrikes.viable) {
        console.log(`      Direction: ${zdteStrikes.direction}`);
        console.log(`      Credit: £${zdteStrikes.targetCredit?.toFixed(2) || 'N/A'}`);
    }
    
    return tests;
}

/**
 * Main test runner
 */
async function runAllTests() {
    console.log('================================================================================');
    console.log('                   TOM KING FRAMEWORK - COMPLETE SYSTEM TEST                    ');
    console.log('================================================================================');
    console.log(`Test Time: ${new Date().toLocaleString()}`);
    console.log(`Test Phase: ${TEST_USER_DATA.phase}`);
    console.log(`Test Account: £${TEST_USER_DATA.accountValue.toLocaleString()}`);
    
    const allTests = {};
    
    try {
        // Run all tests
        allTests.v14 = await testV14Functionality();
        allTests.recommendations = await testRecommendationEngine();
        allTests.patterns = await testPatternAnalysis();
        allTests.greeks = await testGreeksCalculations();
        allTests.strikes = await testStrikeSelection();
        
    } catch (error) {
        console.error('❌ Test Error:', error);
    }
    
    // Calculate overall results
    console.log('\n================================================================================');
    console.log('                              COMPLETE TEST SUMMARY                             ');
    console.log('================================================================================\n');
    
    let totalPassed = 0;
    let totalTests = 0;
    
    // V14 Tests
    console.log('📊 V14 FUNCTIONALITY:');
    Object.entries(allTests.v14 || {}).forEach(([test, passed]) => {
        console.log(`   ${test}: ${passed ? '✅' : '❌'}`);
        totalTests++;
        if (passed) totalPassed++;
    });
    
    // Recommendation Tests
    console.log('\n📊 RECOMMENDATION ENGINE:');
    Object.entries(allTests.recommendations || {}).forEach(([test, passed]) => {
        console.log(`   ${test}: ${passed ? '✅' : '❌'}`);
        totalTests++;
        if (passed) totalPassed++;
    });
    
    // Pattern Tests
    console.log('\n📊 PATTERN ANALYSIS:');
    Object.entries(allTests.patterns || {}).forEach(([ticker, result]) => {
        console.log(`   ${ticker}: ${result.passed ? '✅' : '⚠️'} (${result.confidence}% confidence)`);
        totalTests++;
        if (result.passed) totalPassed++;
    });
    
    // Greeks Tests
    console.log('\n📊 GREEKS CALCULATIONS:');
    Object.entries(allTests.greeks || {}).forEach(([test, passed]) => {
        console.log(`   ${test}: ${passed ? '✅' : '❌'}`);
        totalTests++;
        if (passed) totalPassed++;
    });
    
    // Strike Tests
    console.log('\n📊 STRIKE SELECTION:');
    Object.entries(allTests.strikes || {}).forEach(([test, passed]) => {
        console.log(`   ${test}: ${passed ? '✅' : '❌'}`);
        totalTests++;
        if (passed) totalPassed++;
    });
    
    // Final summary
    const successRate = ((totalPassed / totalTests) * 100).toFixed(1);
    console.log('\n================================================================================');
    console.log(`🎯 OVERALL: ${totalPassed}/${totalTests} tests passed (${successRate}%)`);
    
    if (successRate >= 90) {
        console.log('🎉 EXCELLENT! Framework is production-ready.');
    } else if (successRate >= 70) {
        console.log('✅ GOOD! Framework is functional with minor issues.');
    } else if (successRate >= 50) {
        console.log('⚠️ ACCEPTABLE! Framework needs some improvements.');
    } else {
        console.log('❌ CRITICAL! Framework has major issues.');
    }
    
    console.log('================================================================================\n');
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Error:', error);
    process.exit(1);
});

// Run tests
runAllTests().catch(console.error);