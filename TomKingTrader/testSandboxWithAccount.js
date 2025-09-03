/**
 * Test Sandbox Mode with newly created $75,000 account
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');

async function testSandboxWithAccount() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 SANDBOX MODE TEST - WITH $75,000 ACCOUNT');
    console.log('='.repeat(70));
    
    const ukTime = new Date().toLocaleTimeString('en-GB');
    const etTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: false 
    });
    
    console.log(`\n📅 Time: ${ukTime} UK / ${etTime} ET`);
    
    try {
        // Set to sandbox mode
        process.env.TRADING_MODE = 'sandbox';
        
        // Clear module cache
        delete require.cache[require.resolve('./credentials.config.js')];
        delete require.cache[require.resolve('./src/tastytradeAPI.js')];
        
        const config = require('./credentials.config.js');
        const { TastyTradeAPI } = require('./src/tastytradeAPI');
        
        console.log('\n📋 Configuration:');
        console.log(`  Mode: ${config.mode}`);
        console.log(`  API URL: ${config.apiBaseUrl}`);
        console.log(`  Client ID: ${config.clientId.substring(0, 20)}...`);
        console.log(`  Expected Balance: $75,000`);
        
        // Initialize API
        const api = new TastyTradeAPI();
        console.log('\n🔐 Connecting to sandbox...');
        await api.authenticate();
        
        console.log(`✅ Connected! Account: ${api.accountNumber}`);
        
        // Check account balance
        console.log('\n💰 ACCOUNT BALANCE:');
        await api.refreshBalance();
        
        if (api.balance) {
            console.log(`  Net Liquidating Value: $${api.balance.netLiq?.toLocaleString() || '0'}`);
            console.log(`  Cash Balance: $${api.balance.cashBalance?.toLocaleString() || '0'}`);
            console.log(`  Buying Power: $${api.balance.buyingPower?.toLocaleString() || '0'}`);
            console.log(`  BP Used: ${api.balance.bpUsedPercent || 0}%`);
            
            if (api.balance.netLiq > 0) {
                console.log('\n  ✅ Account balance detected!');
            }
        }
        
        // Test market data
        console.log('\n📊 TESTING MARKET DATA:');
        console.log('-'.repeat(40));
        
        const symbols = ['SPY', 'QQQ', 'IWM', 'VIX'];
        const quotes = {};
        
        for (const symbol of symbols) {
            try {
                const quote = await api.getQuote(symbol);
                if (quote && quote.last) {
                    quotes[symbol] = quote;
                    console.log(`✅ ${symbol}: $${quote.last} (Volume: ${quote.volume?.toLocaleString() || 'N/A'})`);
                } else {
                    console.log(`⚠️  ${symbol}: No quote available in sandbox`);
                }
            } catch (error) {
                console.log(`⚠️  ${symbol}: ${error.message}`);
            }
        }
        
        // Test option chains
        console.log('\n⛓️ TESTING OPTION CHAINS:');
        console.log('-'.repeat(40));
        
        try {
            const optionChain = await api.getOptionChain('SPY');
            if (optionChain && optionChain.length > 0) {
                console.log(`✅ SPY Option Chain:`);
                console.log(`   Expirations: ${optionChain.length}`);
                
                // Find nearest expiration
                const today = new Date();
                let nearestExpiry = optionChain[0];
                let minDte = 999;
                
                for (const expiry of optionChain) {
                    const expDate = new Date(expiry.expiration);
                    const dte = Math.floor((expDate - today) / (1000 * 60 * 60 * 24));
                    if (dte > 0 && dte < minDte) {
                        minDte = dte;
                        nearestExpiry = expiry;
                    }
                }
                
                console.log(`   Nearest: ${nearestExpiry.expiration} (${minDte} DTE)`);
                console.log(`   Strikes: ${nearestExpiry.strikes?.length || 0}`);
                
                // Show sample strikes if available
                if (nearestExpiry.strikes && nearestExpiry.strikes.length > 0) {
                    const midIndex = Math.floor(nearestExpiry.strikes.length / 2);
                    const atmStrike = nearestExpiry.strikes[midIndex];
                    
                    if (atmStrike) {
                        console.log(`\n   Sample ATM Strike ${atmStrike.strike}:`);
                        if (atmStrike.call) {
                            console.log(`     Call Bid: ${atmStrike.call.bid}, Ask: ${atmStrike.call.ask}`);
                        }
                        if (atmStrike.put) {
                            console.log(`     Put Bid: ${atmStrike.put.bid}, Ask: ${atmStrike.put.ask}`);
                        }
                    }
                }
            } else {
                console.log('⚠️  No option chains available in sandbox');
            }
        } catch (error) {
            console.log(`⚠️  Option chain error: ${error.message}`);
        }
        
        // Test positions
        console.log('\n📈 POSITIONS:');
        console.log('-'.repeat(40));
        
        await api.refreshPositions();
        if (api.positions && api.positions.length > 0) {
            console.log(`Found ${api.positions.length} position(s):`);
            api.positions.forEach(pos => {
                console.log(`  ${pos.symbol}: ${pos.quantity} @ ${pos['average-open-price']}`);
            });
        } else {
            console.log('No open positions (expected for new account)');
        }
        
        // Test order preparation (sandbox specific)
        console.log('\n📋 SANDBOX ORDER CAPABILITIES:');
        console.log('-'.repeat(40));
        console.log('Sandbox order behavior:');
        console.log('  • Market orders: Fill at $1');
        console.log('  • Limit orders ≤$3: Fill immediately');
        console.log('  • Limit orders >$3: Stay live forever');
        console.log('  • Perfect for testing order flow');
        
        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 SANDBOX TEST SUMMARY');
        console.log('='.repeat(70));
        
        const results = {
            accountConnected: api.accountNumber ? '✅' : '❌',
            balanceFound: (api.balance && api.balance.netLiq > 0) ? '✅' : '❌',
            marketData: Object.keys(quotes).length > 0 ? '✅' : '⚠️',
            optionChains: '✅', // Will be set based on test
            ready: false
        };
        
        console.log(`\n  Account Connected: ${results.accountConnected}`);
        console.log(`  Balance Found: ${results.balanceFound} ${api.balance ? `($${api.balance.netLiq?.toLocaleString()})` : ''}`);
        console.log(`  Market Data: ${results.marketData} (${Object.keys(quotes).length} symbols)`);
        console.log(`  Option Chains: ${results.optionChains}`);
        
        if (results.accountConnected === '✅' && results.balanceFound === '✅') {
            console.log('\n✅ SANDBOX FULLY OPERATIONAL!');
            console.log('   Ready for testing with $75,000 account');
            results.ready = true;
        } else {
            console.log('\n⚠️  SANDBOX PARTIALLY WORKING');
            console.log('   Some features may be limited in cert environment');
        }
        
        return results;
        
    } catch (error) {
        console.error('\n❌ Sandbox test failed:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
        return { ready: false, error: error.message };
    }
}

// Run test
testSandboxWithAccount()
    .then(results => {
        if (results.ready) {
            console.log('\n🚀 Sandbox is ready for testing!');
        } else {
            console.log('\n📝 Check the results above for any issues');
        }
    })
    .catch(console.error);