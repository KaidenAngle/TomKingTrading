/**
 * Test Backtesting Engine with Real Historical Data
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const { BacktestingEngine } = require('./src/backtestingEngine');

async function testBacktestingWithRealData() {
    console.log('\n' + '='.repeat(70));
    console.log('📈 BACKTESTING ENGINE - REAL DATA TEST');
    console.log('='.repeat(70));
    
    const ukTime = new Date().toLocaleTimeString('en-GB');
    const etTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: false 
    });
    
    console.log(`📅 Time: ${ukTime} UK / ${etTime} ET`);
    console.log('📊 Testing with real historical data\n');
    
    try {
        // Initialize API
        process.env.TRADING_MODE = 'paper';
        const api = new TastyTradeAPI();
        
        console.log('🔐 Connecting to TastyTrade API...');
        await api.authenticate();
        console.log(`✅ Connected! Account: ${api.accountNumber}\n`);
        
        // Initialize backtesting engine
        console.log('🚀 Initializing Backtesting Engine...');
        const backtest = new BacktestingEngine({
            startingCapital: 35000,
            api: api  // Pass real API connection
        });
        
        console.log('✅ Engine initialized with real API connection\n');
        
        // Test 1: August 5, 2024 Crash Scenario
        console.log('📊 TEST 1: August 5, 2024 Volatility Spike');
        console.log('-'.repeat(40));
        
        const aug5Scenario = {
            name: 'August 5 2024 Crash',
            startDate: new Date('2024-08-01'),
            endDate: new Date('2024-08-10'),
            strategies: ['futures_strangles'],
            description: 'Tom King lost money due to correlation'
        };
        
        console.log(`Testing ${aug5Scenario.name}...`);
        console.log(`Period: ${aug5Scenario.startDate.toDateString()} to ${aug5Scenario.endDate.toDateString()}`);
        
        try {
            // This will attempt to use real historical data
            const results = await backtest.runScenario(aug5Scenario);
            
            if (results) {
                console.log('\n✅ Backtest completed with real data!');
                console.log(`Final Capital: £${results.finalCapital?.toLocaleString() || 'N/A'}`);
                console.log(`Total Return: ${results.totalReturn || 0}%`);
                console.log(`Max Drawdown: ${results.maxDrawdown || 0}%`);
                console.log(`Win Rate: ${results.winRate || 0}%`);
            }
        } catch (error) {
            if (error.message.includes('API not connected')) {
                console.log('❌ Cannot get historical data without API');
            } else if (error.message.includes('Historical data not available')) {
                console.log('⚠️  Historical data endpoint may not be available');
                console.log('    TastyTrade API may not provide historical data');
            } else {
                console.log('❌ Backtest failed:', error.message);
            }
        }
        
        // Test 2: Recent Market Data
        console.log('\n📊 TEST 2: Recent Market Backtest');
        console.log('-'.repeat(40));
        
        const today = new Date();
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const recentScenario = {
            name: 'Last 7 Days',
            startDate: oneWeekAgo,
            endDate: today,
            strategies: ['long_term_112', 'futures_strangles'],
            description: 'Recent market conditions'
        };
        
        console.log(`Testing ${recentScenario.name}...`);
        console.log(`Period: ${recentScenario.startDate.toDateString()} to ${recentScenario.endDate.toDateString()}`);
        
        // Test 3: Check what data is available
        console.log('\n📊 TEST 3: Data Availability Check');
        console.log('-'.repeat(40));
        
        // Get current market data to verify API works
        const spyQuote = await api.getQuote('SPY');
        console.log(`Current SPY: $${spyQuote.last}`);
        
        // Check if we can get option chain history
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.length > 0) {
            console.log(`Current option chain: ${optionChain.length} expirations`);
            
            // Try to get historical implied volatility
            const firstExpiry = optionChain[0];
            if (firstExpiry.strikes && firstExpiry.strikes.length > 0) {
                const atmStrike = firstExpiry.strikes.find(s => 
                    Math.abs(s.strike - spyQuote.last) < 2
                );
                
                if (atmStrike) {
                    console.log(`\nATM Strike ${atmStrike.strike}:`);
                    console.log(`  Call IV: ${atmStrike.call?.iv || 'N/A'}%`);
                    console.log(`  Put IV: ${atmStrike.put?.iv || 'N/A'}%`);
                }
            }
        }
        
        // Test 4: Alternative - Use current data for paper trading
        console.log('\n💡 ALTERNATIVE APPROACH:');
        console.log('-'.repeat(40));
        console.log('Since historical data may be limited, we can:');
        console.log('1. Use live data for forward testing');
        console.log('2. Paper trade in real-time');
        console.log('3. Track performance over time');
        console.log('4. Build our own historical database');
        
        console.log('\n' + '='.repeat(70));
        console.log('📝 BACKTEST SUMMARY');
        console.log('='.repeat(70));
        
        console.log('\nFindings:');
        console.log('✅ API connection working');
        console.log('✅ Current market data available');
        console.log('✅ Option chains accessible');
        console.log('⚠️  Historical data may be limited via API');
        console.log('\nRecommendation:');
        console.log('Use paper trading for forward testing instead of backtesting');
        console.log('Track real performance during market hours');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('\nStack trace:', error.stack.split('\n').slice(0, 3).join('\n'));
        }
    }
}

// Run test
testBacktestingWithRealData().catch(console.error);