#!/usr/bin/env node

/**
 * PRODUCTION DATA TEST
 * Tests the complete framework with real TastyTrade production data
 * Order execution is DISABLED - only analysis and preparation
 */

require('dotenv').config();
const { TastyTradeAPI } = require('./src/tastytradeAPI');
const DataManager = require('./src/dataManager');
const OrderPreparation = require('./src/orderPreparation');
const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');
const V14CompleteFunctionality = require('./src/v14CompleteFunctionality');

async function testProductionData() {
    console.log('================================================================================');
    console.log('                    TOM KING FRAMEWORK - PRODUCTION DATA TEST                   ');
    console.log('================================================================================\n');
    
    const now = new Date();
    console.log(`📅 Test Time: ${now.toLocaleString()}`);
    console.log(`   UK:  ${now.toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
    console.log(`   EST: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    console.log(`   Environment: ${process.env.TASTYTRADE_ENV || 'sandbox'}`);
    console.log(`   Order Execution: ${process.env.ORDER_EXECUTION || 'disabled'}\n`);
    
    // Initialize API
    console.log('🔌 Initializing TastyTrade API...');
    const api = new TastyTradeAPI();
    
    try {
        await api.initialize();
        console.log('   ✅ API Connected\n');
    } catch (error) {
        console.error('   ❌ API Connection Failed:', error.message);
        console.log('   Continuing with simulated data...\n');
    }
    
    // Initialize Data Manager
    const dataManager = new DataManager(api);
    console.log('📊 Data Manager initialized');
    console.log(`   Market Status: ${dataManager.isMarketOpen() ? '🟢 OPEN' : '🔴 CLOSED'}`);
    console.log(`   Futures Status: ${dataManager.isFuturesMarketOpen() ? '🟢 OPEN' : '🔴 CLOSED'}\n`);
    
    // Test 1: Fetch Market Data
    console.log('================================================================================');
    console.log('                          TEST 1: MARKET DATA FETCHING                          ');
    console.log('================================================================================\n');
    
    const testTickers = ['ES', 'SPY', 'GLD', 'TLT', 'MES', 'MCL'];
    const marketData = {};
    
    for (const ticker of testTickers) {
        console.log(`📈 Fetching ${ticker}...`);
        const data = await dataManager.getMarketData(ticker);
        
        if (data) {
            marketData[ticker] = data;
            console.log(`   Current: $${data.currentPrice?.toFixed(2) || 'N/A'}`);
            console.log(`   Change: ${((data.currentPrice - data.previousClose) / data.previousClose * 100).toFixed(2)}%`);
            console.log(`   Updated: ${data.updatedAt || 'Simulated'}`);
        } else {
            console.log(`   ⚠️ No data available`);
        }
    }
    
    // Test 2: Run Pattern Analysis
    console.log('\n================================================================================');
    console.log('                        TEST 2: PATTERN ANALYSIS ENGINE                         ');
    console.log('================================================================================\n');
    
    const engine = new EnhancedRecommendationEngine();
    await engine.initialize(false); // Don't use API, use our data manager
    
    // Inject market data
    engine.currentMarketData = marketData;
    
    // Create user data
    const userData = {
        accountValue: 35000,
        phase: 2,
        bpUsed: 0,
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        timeEST: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        vixLevel: marketData.VIX?.currentPrice || 16.5,
        positions: []
    };
    
    console.log(`📊 Account Status:`);
    console.log(`   Value: £${userData.accountValue.toLocaleString()}`);
    console.log(`   Phase: ${userData.phase}`);
    console.log(`   BP Used: ${userData.bpUsed}%`);
    console.log(`   Day: ${userData.dayOfWeek}\n`);
    
    // Generate recommendations
    const recommendations = await engine.generateEnhancedRecommendations(
        userData,
        true,  // Include Greeks
        true   // Include Patterns
    );
    
    console.log('📈 Analysis Results:');
    console.log(`   Qualified Tickers: ${recommendations.summary.qualifiedTickersCount}`);
    console.log(`   Pattern Opportunities: ${recommendations.summary.patternOpportunities}`);
    console.log(`   Action Items: ${recommendations.actionItems?.length || 0}\n`);
    
    // Display top recommendations
    if (recommendations.actionItems && recommendations.actionItems.length > 0) {
        console.log('🎯 Top Recommendations:');
        recommendations.actionItems.slice(0, 3).forEach((item, idx) => {
            console.log(`   ${idx + 1}. [${item.priority}] ${item.action}`);
            console.log(`      ${item.details}`);
        });
    }
    
    // Test 3: V14 Functionality
    console.log('\n================================================================================');
    console.log('                       TEST 3: V14 COMPLETE FUNCTIONALITY                       ');
    console.log('================================================================================\n');
    
    const v14 = new V14CompleteFunctionality();
    
    // Position Allocation Table
    const allocation = v14.generatePositionAllocationTable(userData);
    
    // Check for Friday 0DTE
    if (userData.dayOfWeek === 'Friday') {
        const fridayAnalysis = await v14.runFridayPreMarketAnalysis(marketData, userData.timeEST);
        if (fridayAnalysis.triggers) {
            console.log('🎯 Friday 0DTE Triggers:');
            console.log(`   Call: ES > $${fridayAnalysis.triggers.callTrigger?.toFixed(2) || 'N/A'}`);
            console.log(`   Put: ES < $${fridayAnalysis.triggers.putTrigger?.toFixed(2) || 'N/A'}`);
            console.log(`   Current Direction: ${fridayAnalysis.triggers.direction}\n`);
        }
    }
    
    // Test 4: Order Preparation
    console.log('\n================================================================================');
    console.log('                        TEST 4: ORDER PREPARATION (NO EXECUTION)                ');
    console.log('================================================================================\n');
    
    const orderPrep = new OrderPreparation(api);
    
    // Prepare a sample strangle order
    if (userData.dayOfWeek === 'Tuesday' || true) { // Always test for demo
        const sampleOrder = {
            strategy: 'STRANGLE',
            ticker: 'TLT',
            direction: 'NEUTRAL',
            dte: 45,
            autoExecute: false // Never auto-execute in test
        };
        
        console.log('📝 Preparing sample STRANGLE order...');
        const prepared = await orderPrep.prepareOrder(sampleOrder, userData);
        
        if (prepared.success) {
            console.log('   ✅ Order prepared successfully');
            console.log(`   Order ID: ${prepared.order.id}`);
        } else {
            console.log('   ❌ Order preparation failed');
            prepared.errors?.forEach(err => console.log(`      • ${err}`));
        }
    }
    
    // Test 5: Option Chain Data
    console.log('\n================================================================================');
    console.log('                          TEST 5: OPTION CHAIN DATA                             ');
    console.log('================================================================================\n');
    
    console.log('⚙️ Fetching option chains...');
    const spyChain = await dataManager.getOptionChain('SPY');
    
    if (spyChain) {
        console.log(`   SPY Option Chain:`);
        console.log(`   Expirations: ${spyChain.expirations?.length || 0}`);
        console.log(`   Strikes: ${spyChain.strikes?.length || 0}`);
        
        if (spyChain.strikes && spyChain.strikes.length > 0) {
            const atmStrike = spyChain.strikes[Math.floor(spyChain.strikes.length / 2)];
            console.log(`   ATM Strike: ${atmStrike.strike || 'N/A'}`);
            console.log(`   ATM IV: ${atmStrike.iv || 'N/A'}%`);
        }
    }
    
    // Summary
    console.log('\n================================================================================');
    console.log('                                    SUMMARY                                     ');
    console.log('================================================================================\n');
    
    const cacheStatus = dataManager.getCacheStatus();
    console.log('📊 System Status:');
    console.log(`   API Connected: ${api.accountNumber ? '✅' : '❌'}`);
    console.log(`   Data Cache: ${cacheStatus.cacheSize} items`);
    console.log(`   Market Open: ${cacheStatus.marketOpen ? '✅' : '❌'}`);
    console.log(`   Futures Open: ${cacheStatus.futuresOpen ? '✅' : '❌'}`);
    console.log(`   Order Execution: ${process.env.ORDER_EXECUTION === 'enabled' ? '⚠️ ENABLED' : '✅ DISABLED'}\n`);
    
    console.log('💡 Next Steps:');
    console.log('   1. Review the recommendations above');
    console.log('   2. Manually enter any trades in TastyTrade');
    console.log('   3. Log positions in the framework');
    console.log('   4. Run daily monitoring scripts\n');
    
    // Show recent prepared orders
    const recentOrders = orderPrep.getLoggedOrders(5);
    if (recentOrders.length > 0) {
        console.log('📋 Recent Prepared Orders:');
        recentOrders.forEach(order => {
            console.log(`   ${order.timestamp}: ${order.strategy} ${order.ticker} - ${order.status}`);
        });
    }
    
    console.log('\n================================================================================');
    console.log('                            PRODUCTION TEST COMPLETE                            ');
    console.log('================================================================================\n');
}

// Run test
testProductionData().catch(error => {
    console.error('❌ Test Error:', error);
    console.error(error.stack);
});