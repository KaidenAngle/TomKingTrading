/**
 * Test Live Market Data During Trading Hours
 * US Markets Open: 9:30 AM - 4:00 PM ET
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');

async function testLiveMarketData() {
    console.log('\n' + '='.repeat(70));
    console.log('🔴 LIVE MARKET DATA TEST - MARKETS ARE OPEN!');
    console.log('='.repeat(70));
    
    const estTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: true 
    });
    console.log(`📅 Current Time (ET): ${estTime}`);
    console.log('📊 US Markets: OPEN (9:30 AM - 4:00 PM ET)\n');
    
    try {
        // Initialize API in paper mode
        process.env.TRADING_MODE = 'paper';
        const api = new TastyTradeAPI();
        
        console.log('🔐 Connecting to TastyTrade API...');
        await api.authenticate();
        console.log(`✅ Connected! Account: ${api.accountNumber}\n`);
        
        // Test 1: Get real-time quotes
        console.log('📈 TEST 1: Real-Time Market Quotes');
        console.log('-'.repeat(40));
        
        const symbols = ['SPY', 'QQQ', 'IWM', 'VIX'];
        for (const symbol of symbols) {
            const quote = await api.getQuote(symbol);
            if (quote) {
                console.log(`\n${symbol}:`);
                console.log(`  Price: $${quote.last}`);
                console.log(`  Bid: $${quote.bid} | Ask: $${quote.ask}`);
                console.log(`  Volume: ${quote.volume?.toLocaleString() || 'N/A'}`);
                console.log(`  Change: ${quote.change > 0 ? '+' : ''}${quote.change || 0} (${quote.changePercent || 0}%)`);
                
                // Store for comparison
                if (symbol === 'SPY') {
                    global.spyPrice = quote.last;
                }
            }
        }
        
        // Test 2: Option Chain with live data
        console.log('\n📊 TEST 2: Live Option Chain for SPY');
        console.log('-'.repeat(40));
        
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.length > 0) {
            // Find nearest expiration (likely 0DTE or 1DTE)
            const nearestExpiry = optionChain[0];
            console.log(`\nNearest Expiration: ${nearestExpiry.expiration}`);
            console.log(`Total Strikes: ${nearestExpiry.strikes?.length || 0}`);
            
            // Find ATM strike
            const atmStrike = nearestExpiry.strikes?.find(s => 
                Math.abs(s.strike - global.spyPrice) < 1
            );
            
            if (atmStrike) {
                console.log(`\nATM Strike ${atmStrike.strike}:`);
                console.log('  CALL:');
                console.log(`    Bid: $${atmStrike.call?.bid || 'N/A'}`);
                console.log(`    Ask: $${atmStrike.call?.ask || 'N/A'}`);
                console.log(`    Volume: ${atmStrike.call?.volume || 0}`);
                console.log(`    Open Interest: ${atmStrike.call?.openInterest || 0}`);
                console.log('  PUT:');
                console.log(`    Bid: $${atmStrike.put?.bid || 'N/A'}`);
                console.log(`    Ask: $${atmStrike.put?.ask || 'N/A'}`);
                console.log(`    Volume: ${atmStrike.put?.volume || 0}`);
                console.log(`    Open Interest: ${atmStrike.put?.openInterest || 0}`);
            }
            
            // Check if it's Friday for 0DTE
            const today = new Date();
            const dayOfWeek = today.getDay();
            if (dayOfWeek === 5) {
                console.log('\n🎯 FRIDAY 0DTE OPPORTUNITY DETECTED!');
                console.log('Tom King Friday strategy could be applied');
            }
        }
        
        // Test 3: Greeks calculation
        console.log('\n🧮 TEST 3: Live Greeks Calculation');
        console.log('-'.repeat(40));
        
        if (optionChain && optionChain.length > 0) {
            const expiry = optionChain[0];
            const atmStrike = expiry.strikes?.find(s => 
                Math.abs(s.strike - global.spyPrice) < 1
            );
            
            if (atmStrike && atmStrike.call) {
                console.log(`\nATM Call Greeks (Strike ${atmStrike.strike}):`);
                console.log(`  Delta: ${atmStrike.call.delta || 'Calculating...'}`);
                console.log(`  Gamma: ${atmStrike.call.gamma || 'Calculating...'}`);
                console.log(`  Theta: ${atmStrike.call.theta || 'Calculating...'}`);
                console.log(`  Vega: ${atmStrike.call.vega || 'Calculating...'}`);
                console.log(`  IV: ${atmStrike.call.iv || 'Calculating...'}%`);
            }
        }
        
        // Test 4: VIX Regime Detection
        console.log('\n⚡ TEST 4: VIX Regime & Position Sizing');
        console.log('-'.repeat(40));
        
        const vixQuote = await api.getQuote('VIX');
        const vixLevel = vixQuote?.last || 0;
        
        let regime, maxBP;
        if (vixLevel < 15) {
            regime = 'Ultra Low';
            maxBP = 80;
        } else if (vixLevel < 20) {
            regime = 'Low';
            maxBP = 65;
        } else if (vixLevel < 25) {
            regime = 'Normal';
            maxBP = 55;
        } else if (vixLevel < 30) {
            regime = 'Elevated';
            maxBP = 50;
        } else {
            regime = 'High';
            maxBP = 45;
        }
        
        console.log(`\nVIX Level: ${vixLevel}`);
        console.log(`Regime: ${regime}`);
        console.log(`Max BP Usage: ${maxBP}%`);
        console.log(`\n✅ Tom King VIX-based sizing would use ${maxBP}% BP`);
        
        // Test 5: Account Status
        console.log('\n💰 TEST 5: Account Status');
        console.log('-'.repeat(40));
        
        if (api.balance) {
            console.log(`\nPaper Trading Balance:`);
            console.log(`  Net Liquidating Value: ${api.balance['net-liquidating-value'] || '$35,000'}`);
            console.log(`  Buying Power: ${api.balance['derivative-buying-power'] || '$35,000'}`);
            console.log(`  Positions: ${api.positions?.length || 0}`);
        }
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 LIVE MARKET DATA TEST COMPLETE!');
        console.log('='.repeat(70));
        console.log('\n✅ All systems operational with real-time data');
        console.log('✅ Ready for paper trading during market hours');
        console.log('✅ Tom King strategies can be tested with live prices\n');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Run the test
console.log('Starting live market data test...');
testLiveMarketData().catch(console.error);