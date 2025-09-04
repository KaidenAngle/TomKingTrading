/**
 * Test Tom King Strategy Recommendations with Live Market Data
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const RecommendationEngine = require('./src/enhancedRecommendationEngine');

async function testStrategyRecommendations() {
    console.log('\n' + '='.repeat(70));
    console.log('🎯 TOM KING STRATEGY RECOMMENDATIONS - LIVE DATA');
    console.log('='.repeat(70));
    
    const ukTime = new Date().toLocaleTimeString('en-GB');
    const etTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: false 
    });
    
    console.log(`📅 Time: ${ukTime} UK / ${etTime} ET`);
    console.log('📊 US Markets: OPEN\n');
    
    try {
        process.env.TRADING_MODE = 'paper';
        const api = new TastyTradeAPI();
        
        console.log('🔐 Connecting to API...');
        await api.authenticate();
        console.log(`✅ Connected! Account: ${api.accountNumber}\n`);
        
        // Get current market data
        console.log('📊 Current Market Conditions:');
        console.log('-'.repeat(40));
        
        const spyQuote = await api.getQuote('SPY');
        const vixQuote = await api.getQuote('VIX');
        const qqqQuote = await api.getQuote('QQQ');
        
        console.log(`SPY: $${spyQuote.last} (Volume: ${spyQuote.volume?.toLocaleString()})`);
        console.log(`VIX: ${vixQuote.last}`);
        console.log(`QQQ: $${qqqQuote.last}`);
        
        // Check day of week for strategies
        const today = new Date();
        const dayOfWeek = today.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        console.log(`\nDay: ${dayNames[dayOfWeek]}`);
        
        // Initialize recommendation engine
        console.log('\n🤖 Analyzing Tom King Strategies...');
        console.log('='.repeat(40));
        
        const searchedData = {
            ES: { price: spyQuote.last * 10, ATR: 20 },
            SPY: { price: spyQuote.last },
            VIX: { price: vixQuote.last },
            TIME: { 
                currentEST: etTime,
                marketStatus: 'OPEN'
            }
        };
        
        const engine = new RecommendationEngine({
            mockMode: false,
            api: api
        });
        
        // Test each strategy type
        console.log('\n1️⃣ FRIDAY 0DTE STRATEGY:');
        if (dayOfWeek === 5) {
            console.log('✅ IT\'S FRIDAY! 0DTE strategy available');
            console.log('   - Target: 88% win rate');
            console.log('   - Entry after 10:30 AM ET');
            console.log('   - 10-20 point wide spreads');
            
            const currentHour = parseInt(etTime.split(':')[0]);
            const currentMinute = parseInt(etTime.split(':')[1]);
            if (currentHour > 10 || (currentHour === 10 && currentMinute >= 30)) {
                console.log('   ✅ Entry time window OPEN');
            } else {
                console.log('   ⏰ Wait until 10:30 AM ET');
            }
        } else {
            console.log(`❌ Not Friday (it's ${dayNames[dayOfWeek]})`);
            const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
            console.log(`   Next opportunity in ${daysUntilFriday} days`);
        }
        
        console.log('\n2️⃣ LONG-TERM 1-1-2 STRATEGY:');
        console.log('✅ Available any day');
        console.log(`   SPY at $${spyQuote.last}`);
        console.log('   - 45-60 DTE optimal');
        console.log('   - Sell 1 ATM, Buy 1 OTM put, Buy 2 further OTM puts');
        
        // Get option chain for strategy analysis
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.length > 0) {
            // Find 45-60 DTE expiration
            const targetDTE = 45;
            let bestExpiry = null;
            
            for (const expiry of optionChain) {
                const expiryDate = new Date(expiry.expiration);
                const dte = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (dte >= targetDTE && dte <= 60) {
                    bestExpiry = expiry;
                    console.log(`   Found expiration: ${expiry.expiration} (${dte} DTE)`);
                    break;
                }
            }
        }
        
        console.log('\n3️⃣ FUTURES STRANGLES:');
        console.log('✅ Available for micro futures');
        const vixLevel = parseFloat(vixQuote.last);
        
        let regime, bpUsage;
        if (vixLevel < 15) {
            regime = 'Ultra Low';
            bpUsage = 80;
        } else if (vixLevel < 20) {
            regime = 'Low';
            bpUsage = 65;
        } else if (vixLevel < 25) {
            regime = 'Normal';
            bpUsage = 55;
        } else if (vixLevel < 30) {
            regime = 'Elevated';
            bpUsage = 50;
        } else {
            regime = 'High';
            bpUsage = 45;
        }
        
        console.log(`   VIX: ${vixLevel} (${regime} regime)`);
        console.log(`   Max BP Usage: ${bpUsage}%`);
        console.log('   Recommended: MCL, MGC, M2K strangles');
        console.log('   Target: 16-20 delta, 45-90 DTE');
        
        console.log('\n4️⃣ CURRENT RECOMMENDATIONS:');
        console.log('-'.repeat(40));
        
        // Generate actual recommendations
        const recommendations = await engine.generateRecommendations(searchedData);
        
        if (recommendations && recommendations.length > 0) {
            recommendations.forEach((rec, idx) => {
                console.log(`\n${idx + 1}. ${rec.strategy}:`);
                console.log(`   Symbol: ${rec.ticker}`);
                console.log(`   Entry: ${rec.entry}`);
                console.log(`   Target: ${rec.target}`);
                console.log(`   Risk: ${rec.risk}`);
                console.log(`   Confidence: ${rec.confidence}/10`);
            });
        } else {
            console.log('No immediate setups found - market conditions not optimal');
        }
        
        // Account status for position sizing
        console.log('\n💰 POSITION SIZING:');
        console.log('-'.repeat(40));
        const balance = 35000; // Paper trading balance
        console.log(`Account Balance: £${balance.toLocaleString()}`);
        console.log(`Max BP Usage (${regime}): ${bpUsage}%`);
        console.log(`Available for Trading: £${(balance * bpUsage / 100).toLocaleString()}`);
        console.log(`Max per Trade (5%): £${(balance * 0.05).toLocaleString()}`);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ Strategy analysis complete with live data!');
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run test
testStrategyRecommendations().catch(console.error);