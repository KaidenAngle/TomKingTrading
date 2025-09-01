#!/usr/bin/env node

/**
 * TEST SCRIPT FOR V14 COMPLETE FUNCTIONALITY
 * Tests all missing features from original framework
 */

const V14CompleteFunctionality = require('./src/v14CompleteFunctionality');

// Test data simulating a Friday at 10:15 AM with Phase 2 account
const testUserData = {
    accountValue: 45000,
    phase: 2,
    bpUsed: 28,
    dayOfWeek: 'Friday',
    timeStr: '10:15 AM',
    vixLevel: 16.5,
    positions: [
        { ticker: 'MES', strategy: 'STRANGLE', dte: 45, pl: 15, entry: 2.80 },
        { ticker: 'GLD', strategy: 'LT112', dte: 112, pl: 8, entry: 195 },
        { ticker: 'MCL', strategy: 'STRANGLE', dte: 21, pl: 48, entry: 3.20 }, // Near exit
        { ticker: 'TLT', strategy: 'IPMCC', dte: 280, pl: -5, entry: 95 }
    ]
};

// Simulated market data
const testMarketData = {
    ES: {
        currentPrice: 5468.50,
        openPrice: 5450.00,
        previousClose: 5445.00,
        overnightHigh: 5475.00,
        overnightLow: 5440.00,
        high30min: 5470.00,
        low30min: 5448.00,
        vwap: 5459.00,
        orderFlow: 'Balanced',
        buyingPressure: 'Moderate',
        globexVolume: 125000
    }
};

async function runTests() {
    console.log('================================================================================');
    console.log('                     V14 COMPLETE FUNCTIONALITY TEST SUITE                      ');
    console.log('================================================================================\n');
    
    const v14 = new V14CompleteFunctionality();
    
    // Run comprehensive analysis
    const results = await v14.runComprehensiveAnalysis(testUserData, testMarketData);
    
    // Additional specific tests
    console.log('\n🔍 SPECIFIC FEATURE TESTS');
    console.log('────────────────────────────────────────────────────────────────────────────');
    
    // Test 1: Never Trade List
    console.log('\n1️⃣ NEVER TRADE LIST CHECK:');
    const neverTrade = ['OJ', 'NG', 'VX'];
    neverTrade.forEach(ticker => {
        const allowed = !v14.neverTradeList.includes(ticker);
        console.log(`   ${ticker}: ${allowed ? '✅ Allowed' : '🚫 BLOCKED (Never Trade List)'}`);
    });
    
    // Test 2: New Position Correlation Check
    console.log('\n2️⃣ NEW POSITION CORRELATION CHECK:');
    const testTickers = ['ES', 'SPY', 'GC', 'CL'];
    testTickers.forEach(ticker => {
        const result = v14.checkAugust2024Rules(testUserData.positions, ticker);
        if (result.allowed === false) {
            console.log(`   ${ticker}: 🚫 ${result.reason}`);
        } else {
            console.log(`   ${ticker}: ✅ Allowed to add`);
        }
    });
    
    // Test 3: Position Health Scores
    console.log('\n3️⃣ POSITION HEALTH ANALYSIS:');
    testUserData.positions.forEach(pos => {
        const health = v14.analyzePositionHealth(pos);
        const icon = health.exitTrigger ? '🚨' : health.score > 75 ? '✅' : health.score > 50 ? '⚠️' : '📉';
        console.log(`   ${pos.ticker} ${pos.strategy}: Score ${health.score} ${icon}`);
        console.log(`      Action: ${health.action}`);
    });
    
    // Test 4: Day-Specific Strategy Check
    console.log('\n4️⃣ DAY-SPECIFIC STRATEGY PERMISSIONS:');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    days.forEach(day => {
        const allowed = v14.dayStrategyMap[day];
        console.log(`   ${day}: ${allowed.join(', ')}`);
    });
    
    // Test 5: VIX Scenarios
    console.log('\n5️⃣ VIX REGIME SCENARIOS:');
    const vixScenarios = [10, 16, 22, 28, 35];
    vixScenarios.forEach(vix => {
        const regime = v14.getVIXRegimeLimits(vix);
        const spike = v14.checkVIXSpikeProtocol(vix, testUserData.accountValue);
        if (spike.triggered) {
            console.log(`   VIX ${vix}: 🚨 SPIKE PROTOCOL - Deploy £${spike.deployment.toLocaleString()}`);
        } else {
            console.log(`   VIX ${vix}: ${regime.regime} regime (${regime.min}-${regime.max}% BP)`);
        }
    });
    
    console.log('\n================================================================================');
    console.log('                            TEST SUITE COMPLETE                                 ');
    console.log('================================================================================\n');
    
    // Summary
    console.log('📊 TEST SUMMARY:');
    console.log(`   ✅ Friday Pre-Market Analysis: ${results.fridayAnalysis ? 'PASSED' : 'N/A'}`);
    console.log(`   ✅ Position Allocation Table: ${results.allocationTable ? 'GENERATED' : 'FAILED'}`);
    console.log(`   ✅ Correlation Checks: ${results.correlationCheck.allowed ? 'PASSED' : 'VIOLATIONS FOUND'}`);
    console.log(`   ✅ Capital Recycling: ${results.capitalRecycling.totalBPFreed}% BP available`);
    console.log(`   ✅ VIX Spike Protocol: ${results.vixSpike.triggered ? 'TRIGGERED' : 'Normal'}`);
}

// Run tests
runTests().catch(error => {
    console.error('❌ Test Error:', error);
});