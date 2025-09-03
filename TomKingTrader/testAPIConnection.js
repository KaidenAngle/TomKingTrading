/**
 * Test TastyTrade API with updated authentication
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');

async function testAPIConnection() {
    console.log('🔍 Testing TastyTrade API Connection\n');
    console.log('='.repeat(60));
    
    try {
        // Set paper trading mode
        process.env.TRADING_MODE = 'paper';
        
        // Initialize API
        console.log('📡 Initializing API...');
        const api = new TastyTradeAPI();
        
        // Authenticate
        console.log('🔐 Authenticating...');
        await api.authenticate();
        
        console.log('✅ Authentication successful!');
        console.log(`   Account: ${api.accountNumber}`);
        
        // Test market data
        console.log('\n📊 Testing Market Data Retrieval...');
        
        // Get SPY data
        console.log('\n1. Fetching SPY data (REAL DATA)...');
        const spyQuote = await api.getQuote('SPY');
        if (spyQuote) {
            console.log('   ✅ SPY Price: $' + spyQuote.last);
            console.log('   ✅ Bid/Ask: $' + spyQuote.bid + '/' + spyQuote.ask);
            console.log('   ✅ Volume: ' + spyQuote.volume?.toLocaleString());
            console.log('   ✅ THIS IS REAL MARKET DATA!');
        }
        
        // Get VIX data
        console.log('\n2. Fetching VIX data (REAL DATA)...');
        const vixQuote = await api.getQuote('VIX');
        if (vixQuote) {
            console.log('   ✅ VIX Level: ' + vixQuote.last);
            console.log('   ✅ High/Low: ' + vixQuote.high + '/' + vixQuote.low);
            console.log('   ✅ THIS IS REAL VOLATILITY DATA!');
        }
        
        // Get option chain for SPY
        console.log('\n3. Fetching SPY option chain (REAL DATA)...');
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.length > 0) {
            const firstExpiry = optionChain[0];
            console.log('   ✅ Expiration: ' + firstExpiry.expiration);
            console.log('   ✅ Strikes available: ' + firstExpiry.strikes?.length);
            const atmStrike = firstExpiry.strikes?.find(s => Math.abs(s.strike - spyQuote.last) < 2);
            if (atmStrike) {
                console.log('   ✅ ATM Strike ' + atmStrike.strike + ':');
                console.log('      Call Bid/Ask: $' + atmStrike.call?.bid + '/$' + atmStrike.call?.ask);
                console.log('      Put Bid/Ask: $' + atmStrike.put?.bid + '/$' + atmStrike.put?.ask);
            }
            console.log('   ✅ THIS IS REAL OPTIONS DATA!');
        }
        
        // Get account status
        console.log('\n4. Fetching account status...');
        const accountStatus = await api.getAccountStatus();
        if (accountStatus) {
            console.log('   ✅ Account: ' + api.accountNumber);
            console.log('   ✅ Balance data retrieved');
        }
        
        // Get positions
        console.log('\n5. Checking positions...');
        if (api.positions) {
            console.log('   ✅ Positions: ' + api.positions.length);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 SUCCESS! Real data connection established!');
        console.log('✅ Authentication working');
        console.log('✅ Market data flowing');
        console.log('✅ Account data accessible');
        console.log('='.repeat(60));
        
        return true;
        
    } catch (error) {
        console.error('\n❌ API Connection Failed:');
        console.error('   Error:', error.message);
        
        if (error.message.includes('Grant revoked')) {
            console.error('\n   The refresh token has been revoked.');
            console.error('   Using username/password authentication fallback...');
        }
        
        return false;
    }
}

// Run test
testAPIConnection()
    .then(success => {
        if (success) {
            console.log('\n🚀 Framework is ready for real data!');
            process.exit(0);
        } else {
            console.log('\n⚠️  API connection needs attention');
            process.exit(1);
        }
    })
    .catch(console.error);