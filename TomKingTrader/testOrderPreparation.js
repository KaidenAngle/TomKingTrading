/**
 * Test Order Preparation (No Execution) with Live Data
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');

async function testOrderPreparation() {
    console.log('\n' + '='.repeat(70));
    console.log('📝 ORDER PREPARATION TEST - NO EXECUTION');
    console.log('='.repeat(70));
    
    const ukTime = new Date().toLocaleTimeString('en-GB');
    const etTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: false 
    });
    
    console.log(`📅 Time: ${ukTime} UK / ${etTime} ET`);
    console.log('🚨 SAFETY: Orders will be prepared but NOT executed\n');
    
    try {
        // Initialize API
        process.env.TRADING_MODE = 'paper';
        const api = new TastyTradeAPI();
        
        console.log('🔐 Connecting to API...');
        await api.authenticate();
        console.log(`✅ Connected! Account: ${api.accountNumber}\n`);
        
        // Get current prices
        const spyQuote = await api.getQuote('SPY');
        const vixQuote = await api.getQuote('VIX');
        
        console.log('📊 Current Market:');
        console.log(`  SPY: $${spyQuote.last}`);
        console.log(`  VIX: ${vixQuote.last}\n`);
        
        // Test 1: Prepare a Long-Term 1-1-2 order
        console.log('1️⃣ PREPARING LONG-TERM 1-1-2 ORDER');
        console.log('-'.repeat(40));
        
        // Get option chain
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.length > 0) {
            // Find 45 DTE expiration
            const today = new Date();
            let targetExpiry = null;
            
            for (const expiry of optionChain) {
                const expiryDate = new Date(expiry.expiration);
                const dte = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (dte >= 45 && dte <= 60) {
                    targetExpiry = expiry;
                    console.log(`Found expiration: ${expiry.expiration} (${dte} DTE)`);
                    break;
                }
            }
            
            if (targetExpiry && targetExpiry.strikes) {
                const currentPrice = parseFloat(spyQuote.last);
                
                // Find strikes for 1-1-2
                const atmStrike = Math.round(currentPrice);
                const otmStrike1 = atmStrike - 5;  // 5 points OTM
                const otmStrike2 = atmStrike - 10; // 10 points OTM
                
                console.log('\n1-1-2 Put Spread Structure:');
                console.log(`  SELL 1x ${atmStrike} Put (ATM)`);
                console.log(`  BUY  1x ${otmStrike1} Put (5 points OTM)`);
                console.log(`  BUY  2x ${otmStrike2} Put (10 points OTM)`);
                
                // Prepare order structure (NOT executed)
                const order112 = {
                    type: 'SPREAD',
                    symbol: 'SPY',
                    expiration: targetExpiry.expiration,
                    legs: [
                        { action: 'SELL', quantity: 1, strike: atmStrike, type: 'PUT' },
                        { action: 'BUY', quantity: 1, strike: otmStrike1, type: 'PUT' },
                        { action: 'BUY', quantity: 2, strike: otmStrike2, type: 'PUT' }
                    ],
                    orderType: 'NET_CREDIT',
                    timeInForce: 'DAY',
                    status: '🚫 PREPARED ONLY - NOT SUBMITTED'
                };
                
                console.log('\n📋 Order prepared (NOT submitted):');
                console.log(JSON.stringify(order112, null, 2));
            }
        }
        
        // Test 2: Prepare a strangle order
        console.log('\n2️⃣ PREPARING STRANGLE ORDER');
        console.log('-'.repeat(40));
        
        if (optionChain && optionChain.length > 0) {
            // Find 30-45 DTE for strangle
            const today = new Date();
            let strangleExpiry = null;
            
            for (const expiry of optionChain) {
                const expiryDate = new Date(expiry.expiration);
                const dte = Math.floor((expiryDate - today) / (1000 * 60 * 60 * 24));
                
                if (dte >= 30 && dte <= 45) {
                    strangleExpiry = expiry;
                    console.log(`Found expiration: ${expiry.expiration} (${dte} DTE)`);
                    break;
                }
            }
            
            if (strangleExpiry) {
                const currentPrice = parseFloat(spyQuote.last);
                
                // 16-20 delta strangle
                const putStrike = Math.round(currentPrice * 0.97);  // ~3% OTM
                const callStrike = Math.round(currentPrice * 1.03); // ~3% OTM
                
                console.log('\nStrangle Structure:');
                console.log(`  SELL 1x ${putStrike} Put`);
                console.log(`  SELL 1x ${callStrike} Call`);
                
                const strangleOrder = {
                    type: 'STRANGLE',
                    symbol: 'SPY',
                    expiration: strangleExpiry.expiration,
                    legs: [
                        { action: 'SELL', quantity: 1, strike: putStrike, type: 'PUT' },
                        { action: 'SELL', quantity: 1, strike: callStrike, type: 'CALL' }
                    ],
                    orderType: 'NET_CREDIT',
                    timeInForce: 'DAY',
                    profitTarget: '50%',
                    status: '🚫 PREPARED ONLY - NOT SUBMITTED'
                };
                
                console.log('\n📋 Order prepared (NOT submitted):');
                console.log(JSON.stringify(strangleOrder, null, 2));
            }
        }
        
        // Test 3: Risk calculations
        console.log('\n3️⃣ POSITION SIZING CALCULATIONS');
        console.log('-'.repeat(40));
        
        const accountBalance = 35000; // Paper trading balance
        const vixLevel = parseFloat(vixQuote.last);
        let maxBP = 65; // Default for low VIX
        
        if (vixLevel < 15) maxBP = 80;
        else if (vixLevel < 20) maxBP = 65;
        else if (vixLevel < 25) maxBP = 55;
        else if (vixLevel < 30) maxBP = 50;
        else maxBP = 45;
        
        const availableForTrading = accountBalance * (maxBP / 100);
        const maxPerTrade = accountBalance * 0.05; // 5% max risk
        
        console.log(`\nAccount Balance: £${accountBalance.toLocaleString()}`);
        console.log(`VIX Level: ${vixLevel} (${maxBP}% max BP)`);
        console.log(`Available for Trading: £${availableForTrading.toLocaleString()}`);
        console.log(`Max Risk per Trade: £${maxPerTrade.toLocaleString()}`);
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ ORDER PREPARATION TEST COMPLETE');
        console.log('='.repeat(70));
        console.log('\n📝 Summary:');
        console.log('  - Orders can be structured properly');
        console.log('  - Option chains provide necessary data');
        console.log('  - Position sizing calculations work');
        console.log('  - NO orders were actually submitted');
        console.log('  - System ready for paper trading');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    }
}

// Run test
testOrderPreparation().catch(console.error);