#!/usr/bin/env node

/**
 * LIVE API TEST SUITE
 * Tests the complete framework with real TastyTrade API data
 */

require('dotenv').config();
const { TastyTradeAPI } = require('./src/tastytradeAPI');
const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');
const V14CompleteFunctionality = require('./src/v14CompleteFunctionality');

// Test configuration
const TEST_CONFIG = {
    useRealAPI: true,
    testTickers: ['ES', 'SPY', 'GLD', 'TLT', 'MES'],
    testPhase: 2,
    testAccountValue: 45000,
    testVIX: 16.5
};

async function testAPIConnection() {
    console.log('\n===========================================');
    console.log('     TESTING TASTYTRADE API CONNECTION     ');
    console.log('===========================================\n');
    
    const api = new TastyTradeAPI();
    
    try {
        // Test authentication
        console.log('1️⃣ Testing Authentication...');
        const authResult = await api.initialize();
        if (authResult) {
            console.log('   ✅ Authentication successful');
            console.log(`   Session Token: ${api.sessionToken ? 'Present' : 'Missing'}`);
        } else {
            console.log('   ❌ Authentication failed');
            return false;
        }
        
        // Test account data
        console.log('\n2️⃣ Testing Account Data Fetch...');
        const accountData = await api.getAccountBalances();
        if (accountData) {
            console.log('   ✅ Account data retrieved');
            console.log(`   Net Liq: £${accountData.netLiquidatingValue?.toLocaleString() || 'N/A'}`);
            console.log(`   BP Used: ${accountData.buyingPowerUsed || 0}%`);
        } else {
            console.log('   ⚠️ No account data available');
        }
        
        // Test positions
        console.log('\n3️⃣ Testing Position Fetch...');
        const positions = await api.getPositions();
        if (positions) {
            console.log(`   ✅ Found ${positions.length} positions`);
            positions.slice(0, 3).forEach(pos => {
                console.log(`   • ${pos.symbol}: ${pos.quantity} @ ${pos.averagePrice}`);
            });
        } else {
            console.log('   ⚠️ No positions found');
        }
        
        return api;
        
    } catch (error) {
        console.error('❌ API Test Error:', error.message);
        return null;
    }
}

async function testMarketData(api) {
    console.log('\n===========================================');
    console.log('       TESTING MARKET DATA COLLECTION      ');
    console.log('===========================================\n');
    
    const marketData = {};
    
    for (const ticker of TEST_CONFIG.testTickers) {
        console.log(`📊 Fetching data for ${ticker}...`);
        
        try {
            // Get quote data
            const quote = await api.getQuote(ticker);
            if (quote) {
                marketData[ticker] = {
                    currentPrice: quote.last || quote.mark,
                    bid: quote.bid,
                    ask: quote.ask,
                    volume: quote.volume,
                    openInterest: quote.openInterest
                };
                console.log(`   ✅ ${ticker}: $${marketData[ticker].currentPrice}`);
            } else {
                console.log(`   ⚠️ ${ticker}: No data available`);
            }
        } catch (error) {
            console.log(`   ❌ ${ticker}: ${error.message}`);
        }
    }
    
    return marketData;
}

async function testPatternAnalysis(marketData) {
    console.log('\n===========================================');
    console.log('       TESTING PATTERN ANALYSIS ENGINE     ');
    console.log('===========================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    
    // Create user data for testing
    const userData = {
        accountValue: TEST_CONFIG.testAccountValue,
        phase: TEST_CONFIG.testPhase,
        bpUsed: 28,
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        timeEST: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        vixLevel: TEST_CONFIG.testVIX,
        positions: [
            { ticker: 'MES', strategy: 'STRANGLE', dte: 45, pl: 15 },
            { ticker: 'GLD', strategy: 'LT112', dte: 112, pl: 8 }
        ]
    };
    
    console.log('📈 Running Pattern Analysis...');
    console.log(`   Phase: ${userData.phase}`);
    console.log(`   Account: £${userData.accountValue.toLocaleString()}`);
    console.log(`   BP Used: ${userData.bpUsed}%`);
    
    try {
        // Initialize engine with API
        await engine.initialize(true);
        
        // Generate recommendations
        const recommendations = await engine.generateEnhancedRecommendations(
            userData,
            true,  // Include Greeks
            true   // Include Patterns
        );
        
        console.log('\n📊 Analysis Results:');
        console.log(`   Qualified Tickers: ${recommendations.summary.qualifiedTickersCount}`);
        console.log(`   Pattern Opportunities: ${recommendations.summary.patternOpportunities}`);
        console.log(`   Strike Recommendations: ${recommendations.summary.strikeRecommendations}`);
        
        // Display top recommendations
        if (recommendations.actionItems && recommendations.actionItems.length > 0) {
            console.log('\n🎯 Top Recommendations:');
            recommendations.actionItems.slice(0, 3).forEach((item, idx) => {
                console.log(`   ${idx + 1}. [${item.priority}] ${item.action}`);
                console.log(`      ${item.details}`);
            });
        }
        
        return recommendations;
        
    } catch (error) {
        console.error('❌ Pattern Analysis Error:', error.message);
        return null;
    }
}

async function testV14Functionality(api) {
    console.log('\n===========================================');
    console.log('       TESTING V14 COMPLETE FEATURES       ');
    console.log('===========================================\n');
    
    const v14 = new V14CompleteFunctionality();
    
    // Create test data
    const userData = {
        accountValue: TEST_CONFIG.testAccountValue,
        phase: TEST_CONFIG.testPhase,
        bpUsed: 28,
        dayOfWeek: 'Friday',
        timeStr: '10:15 AM',
        vixLevel: TEST_CONFIG.testVIX,
        positions: [
            { ticker: 'MES', strategy: 'STRANGLE', dte: 45, pl: 15 },
            { ticker: 'MCL', strategy: 'STRANGLE', dte: 21, pl: 48 }
        ]
    };
    
    // Test Friday analysis if it's Friday
    if (userData.dayOfWeek === 'Friday') {
        console.log('📅 Testing Friday Pre-Market Analysis...');
        const marketData = { ES: { currentPrice: 5450, openPrice: 5440 } };
        const fridayAnalysis = await v14.runFridayPreMarketAnalysis(marketData, userData.timeStr);
        console.log(`   Phase: ${fridayAnalysis.phase}`);
        if (fridayAnalysis.triggers) {
            console.log(`   Call Trigger: $${fridayAnalysis.triggers.callTrigger?.toFixed(2) || 'N/A'}`);
            console.log(`   Put Trigger: $${fridayAnalysis.triggers.putTrigger?.toFixed(2) || 'N/A'}`);
        }
    }
    
    // Test correlation checks
    console.log('\n🔗 Testing Correlation Group Management...');
    const correlationCheck = v14.checkAugust2024Rules(userData.positions);
    console.log(`   Warnings: ${correlationCheck.warnings.length}`);
    console.log(`   Violations: ${correlationCheck.violations.length}`);
    
    // Test capital recycling
    console.log('\n♻️ Testing Capital Recycling...');
    const recycling = v14.identifyCapitalRecycling(userData.positions);
    console.log(`   Recyclable Positions: ${recycling.recyclable.length}`);
    console.log(`   BP to Free: ${recycling.totalBPFreed}%`);
    
    // Test VIX scenarios
    console.log('\n📊 Testing VIX Regime Detection...');
    const vixRegime = v14.getVIXRegimeLimits(userData.vixLevel);
    console.log(`   VIX ${userData.vixLevel}: ${vixRegime.regime} (${vixRegime.min}-${vixRegime.max}% BP)`);
    
    return true;
}

async function testWebSocketStreaming(api) {
    console.log('\n===========================================');
    console.log('       TESTING WEBSOCKET STREAMING         ');
    console.log('===========================================\n');
    
    if (!api || !api.marketDataStreamer) {
        console.log('⚠️ WebSocket not available in current configuration');
        return false;
    }
    
    try {
        console.log('🔌 Connecting to WebSocket...');
        await api.marketDataStreamer.connect();
        console.log('   ✅ WebSocket connected');
        
        // Subscribe to test ticker
        console.log('\n📡 Subscribing to ES quotes...');
        api.marketDataStreamer.subscribeToQuotes(['ES']);
        
        // Listen for a few seconds
        return new Promise((resolve) => {
            let messageCount = 0;
            api.marketDataStreamer.on('quote', (data) => {
                messageCount++;
                if (messageCount === 1) {
                    console.log(`   ✅ Receiving quotes: ${data.symbol} @ ${data.price}`);
                }
            });
            
            setTimeout(() => {
                console.log(`   📊 Received ${messageCount} messages in 5 seconds`);
                api.marketDataStreamer.disconnect();
                resolve(true);
            }, 5000);
        });
        
    } catch (error) {
        console.error('❌ WebSocket Error:', error.message);
        return false;
    }
}

// Main test runner
async function runAllTests() {
    console.log('================================================================================');
    console.log('                    TOM KING FRAMEWORK - LIVE API TEST SUITE                    ');
    console.log('================================================================================');
    console.log(`Test Time: ${new Date().toLocaleString()}`);
    console.log(`API Mode: ${process.env.TASTYTRADE_ENV || 'sandbox'}`);
    
    const results = {
        apiConnection: false,
        marketData: false,
        patternAnalysis: false,
        v14Features: false,
        webSocket: false
    };
    
    // Test 1: API Connection
    const api = await testAPIConnection();
    results.apiConnection = !!api;
    
    if (api) {
        // Test 2: Market Data
        const marketData = await testMarketData(api);
        results.marketData = Object.keys(marketData).length > 0;
        
        // Test 3: Pattern Analysis
        const patterns = await testPatternAnalysis(marketData);
        results.patternAnalysis = !!patterns;
        
        // Test 4: V14 Features
        results.v14Features = await testV14Functionality(api);
        
        // Test 5: WebSocket (optional)
        // results.webSocket = await testWebSocketStreaming(api);
    }
    
    // Summary
    console.log('\n================================================================================');
    console.log('                                TEST SUMMARY                                    ');
    console.log('================================================================================');
    console.log(`✅ API Connection:    ${results.apiConnection ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Market Data:       ${results.marketData ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Pattern Analysis:  ${results.patternAnalysis ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ V14 Features:      ${results.v14Features ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ WebSocket Stream:  ${results.webSocket ? 'PASSED' : 'N/A'}`);
    
    const passedTests = Object.values(results).filter(r => r).length;
    const totalTests = Object.values(results).length;
    console.log(`\n📊 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Framework is ready for production.');
    } else {
        console.log('⚠️ Some tests failed. Review the output above for details.');
    }
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Error:', error);
    process.exit(1);
});

// Run tests
runAllTests().catch(console.error);