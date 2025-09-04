/**
 * Test Section 9B Advanced Strategies
 */

const { Section9BStrategies } = require('./src/section9BStrategies');

async function testSection9B() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TESTING SECTION 9B ADVANCED STRATEGIES');
    console.log('='.repeat(60));
    
    const strategies = new Section9BStrategies();
    
    // Create mock market data
    const marketData = {
        VIX: { currentPrice: 18.5, open: 17.8 },
        SPY: { 
            currentPrice: 643.50, 
            open: 638.20, // ~0.8% up move
            high: 644.10,
            low: 637.90,
            volume: 50000000
        },
        ES: {
            currentPrice: 6435,
            open: 6382, // Similar move
            high: 6441,
            low: 6379
        },
        optionChain: {
            SPY: {
                '2025-09-03': { // 0 DTE
                    CALL: {
                        640: { bid: 3.80, ask: 3.85, iv: 0.16 },
                        645: { bid: 1.20, ask: 1.25, iv: 0.15 },
                        650: { bid: 0.35, ask: 0.40, iv: 0.14 }
                    },
                    PUT: {
                        635: { bid: 0.30, ask: 0.35, iv: 0.14 },
                        640: { bid: 0.95, ask: 1.00, iv: 0.15 },
                        645: { bid: 2.80, ask: 2.85, iv: 0.16 }
                    }
                },
                '2025-09-10': { // 7 DTE
                    CALL: {
                        640: { bid: 6.20, ask: 6.30, iv: 0.17 },
                        645: { bid: 3.80, ask: 3.90, iv: 0.16 },
                        650: { bid: 2.10, ask: 2.20, iv: 0.15 }
                    },
                    PUT: {
                        635: { bid: 1.90, ask: 2.00, iv: 0.15 },
                        640: { bid: 3.20, ask: 3.30, iv: 0.16 },
                        645: { bid: 5.40, ask: 5.50, iv: 0.17 }
                    }
                },
                '2025-10-03': { // 30 DTE
                    CALL: {
                        640: { bid: 12.50, ask: 12.70, iv: 0.18 },
                        645: { bid: 9.80, ask: 10.00, iv: 0.17 },
                        650: { bid: 7.60, ask: 7.80, iv: 0.16 },
                        655: { bid: 5.70, ask: 5.90, iv: 0.15 },
                        660: { bid: 4.20, ask: 4.40, iv: 0.14 }
                    },
                    PUT: {
                        625: { bid: 3.90, ask: 4.10, iv: 0.14 },
                        630: { bid: 5.30, ask: 5.50, iv: 0.15 },
                        635: { bid: 7.10, ask: 7.30, iv: 0.16 },
                        640: { bid: 9.40, ask: 9.60, iv: 0.17 },
                        645: { bid: 12.20, ask: 12.40, iv: 0.18 }
                    }
                },
                '2025-10-17': { // 44 DTE
                    CALL: {
                        640: { bid: 15.20, ask: 15.40, iv: 0.19 },
                        645: { bid: 12.30, ask: 12.50, iv: 0.18 },
                        650: { bid: 9.80, ask: 10.00, iv: 0.17 },
                        655: { bid: 7.70, ask: 7.90, iv: 0.16 },
                        660: { bid: 5.90, ask: 6.10, iv: 0.15 }
                    },
                    PUT: {
                        625: { bid: 5.60, ask: 5.80, iv: 0.15 },
                        630: { bid: 7.30, ask: 7.50, iv: 0.16 },
                        635: { bid: 9.40, ask: 9.60, iv: 0.17 },
                        640: { bid: 12.00, ask: 12.20, iv: 0.18 },
                        645: { bid: 15.10, ask: 15.30, iv: 0.19 }
                    }
                }
            }
        }
    };
    
    const accountData = {
        netLiq: 35000,
        buyingPower: 25000,
        positions: []
    };
    
    // Test on different days and times
    const testScenarios = [
        { 
            date: new Date('2025-09-06T10:40:00'), // Friday 10:40 AM
            description: 'Friday after 10:35 AM - Butterfly Entry Time'
        },
        {
            date: new Date('2025-09-04T10:00:00'), // Thursday
            description: 'Thursday - Not butterfly day'
        },
        {
            date: new Date('2025-09-06T09:30:00'), // Friday 9:30 AM
            description: 'Friday before 10:35 AM - Too early'
        }
    ];
    
    for (const scenario of testScenarios) {
        console.log('\n' + '-'.repeat(60));
        console.log(`📅 ${scenario.description}`);
        console.log(`   Time: ${scenario.date.toLocaleString()}`);
        console.log('-'.repeat(60));
        
        // Adjust market data for different scenarios
        const testMarketData = { ...marketData };
        
        // For Friday after movement, increase the day's move
        if (scenario.date.getDay() === 5 && scenario.date.getHours() >= 10) {
            testMarketData.SPY.currentPrice = 646.50; // 1.3% move
            testMarketData.ES.currentPrice = 6465;
        }
        
        const analysis = strategies.analyzeSection9B(testMarketData, accountData, scenario.date);
        
        console.log(`\n🔍 Found ${analysis.opportunities.length} opportunities:`);
        
        for (const opp of analysis.opportunities) {
            console.log(`\n✅ ${opp.strategy}:`);
            console.log(`   Score: ${opp.score}/100`);
            console.log(`   Can Trade: ${opp.canTrade}`);
            console.log(`   Recommendation: ${opp.recommendation}`);
            
            if (opp.setup) {
                console.log('   Setup Details:');
                console.log(`   - Required BP: $${opp.setup.requiredBP}`);
                if (opp.setup.strikes) {
                    console.log(`   - Strikes: ${JSON.stringify(opp.setup.strikes)}`);
                }
                if (opp.setup.netCredit !== undefined) {
                    console.log(`   - Net Credit: $${opp.setup.netCredit.toFixed(2)}`);
                }
                if (opp.setup.maxLoss !== undefined) {
                    console.log(`   - Max Loss: $${opp.setup.maxLoss.toFixed(2)}`);
                }
            }
        }
        
        if (analysis.opportunities.length === 0) {
            console.log('   No viable opportunities at this time');
        }
    }
    
    // Test individual strategies
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTING INDIVIDUAL STRATEGIES');
    console.log('='.repeat(60));
    
    // Test Enhanced Butterfly
    console.log('\n1. Enhanced Butterfly:');
    const butterflyResult = strategies.analyzeEnhancedButterfly(
        marketData, 
        accountData,
        new Date('2025-09-06T10:40:00')
    );
    console.log(`   Can Trade: ${butterflyResult.canTrade}`);
    console.log(`   Score: ${butterflyResult.score}`);
    console.log(`   Recommendation: ${butterflyResult.recommendation}`);
    
    // Test Iron Condor
    console.log('\n2. Iron Condor:');
    const condorResult = strategies.analyzeIronCondor(marketData, accountData);
    console.log(`   Can Trade: ${condorResult.canTrade}`);
    console.log(`   Score: ${condorResult.score}`);
    console.log(`   Recommendation: ${condorResult.recommendation}`);
    
    // Test Diagonal Spread
    console.log('\n3. Diagonal Spread:');
    const diagonalResult = strategies.analyzeDiagonalSpreads(marketData, accountData);
    console.log(`   Can Trade: ${diagonalResult.canTrade}`);
    console.log(`   Score: ${diagonalResult.score}`);
    console.log(`   Recommendation: ${diagonalResult.recommendation}`);
    
    // Test Ratio Spread
    console.log('\n4. Ratio Spread:');
    const ratioResult = strategies.analyzeRatioSpreads(marketData, accountData);
    console.log(`   Can Trade: ${ratioResult.canTrade}`);
    console.log(`   Score: ${ratioResult.score}`);
    console.log(`   Recommendation: ${ratioResult.recommendation}`);
    
    // Test Broken Wing Butterfly
    console.log('\n5. Broken Wing Butterfly:');
    const brokenWingResult = strategies.analyzeBrokenWingButterfly(marketData, accountData);
    console.log(`   Can Trade: ${brokenWingResult.canTrade}`);
    console.log(`   Score: ${brokenWingResult.score}`);
    console.log(`   Recommendation: ${brokenWingResult.recommendation}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ SECTION 9B TESTING COMPLETE');
    console.log('='.repeat(60));
}

// Run the test
testSection9B().catch(console.error);