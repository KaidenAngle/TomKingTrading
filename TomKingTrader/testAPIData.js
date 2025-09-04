/**
 * API Data Test Script
 * Tests that the TastyTrade API is properly retrieving real market data
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const { DataManager } = require('./src/dataManager');
const { getLogger } = require('./src/logger');

const logger = getLogger();

async function testAPIConnection() {
    logger.info('TEST', '🚀 Starting API Data Test...');
    
    let api;
    let dataManager;
    
    try {
        // Initialize API
        logger.info('TEST', '📡 Initializing TastyTrade API...');
        api = new TastyTradeAPI();
        
        // Authenticate
        logger.info('TEST', '🔐 Authenticating...');
        const authResult = await api.authenticate();
        
        if (!authResult) {
            throw new Error('Authentication failed');
        }
        
        logger.info('TEST', '✅ Authentication successful');
        
        // Initialize DataManager with API
        dataManager = new DataManager(api);
        
        // Test market data retrieval
        logger.info('TEST', '\n📊 Testing Market Data Retrieval...');
        
        // Test SPY
        logger.info('TEST', '🔍 Fetching SPY data...');
        const spyQuote = await api.getQuote('SPY');
        if (spyQuote) {
            logger.info('TEST', '✅ SPY Quote:', {
                last: spyQuote.last,
                bid: spyQuote.bid,
                ask: spyQuote.ask,
                volume: spyQuote.volume
            });
        } else {
            logger.error('TEST', '❌ Failed to get SPY quote');
        }
        
        // Test VIX
        logger.info('TEST', '🔍 Fetching VIX data...');
        const vixData = await api.getVIXData();
        if (vixData) {
            logger.info('TEST', '✅ VIX Data:', {
                currentLevel: vixData.currentLevel,
                change24h: vixData.change24h,
                percentChange: vixData.percentChange,
                regime: vixData.regime
            });
        } else {
            logger.error('TEST', '❌ Failed to get VIX data');
        }
        
        // Test multiple symbols
        logger.info('TEST', '🔍 Fetching multiple symbols...');
        const symbols = ['QQQ', 'IWM', 'GLD', 'TLT'];
        const quotes = await api.getMarketData(symbols);
        
        for (const symbol of symbols) {
            if (quotes[symbol]) {
                logger.info('TEST', `✅ ${symbol}: $${quotes[symbol].last || quotes[symbol].mark}`);
            } else {
                logger.error('TEST', `❌ Failed to get ${symbol} quote`);
            }
        }
        
        // Test futures
        logger.info('TEST', '\n📊 Testing Futures Data...');
        const futuresSymbols = ['/ES', '/MES', '/CL', '/GC'];
        
        for (const symbol of futuresSymbols) {
            try {
                const quote = await api.getQuote(symbol);
                if (quote) {
                    logger.info('TEST', `✅ ${symbol}: $${quote.last || quote.mark}`);
                } else {
                    logger.warn('TEST', `⚠️ No data for ${symbol}`);
                }
            } catch (error) {
                logger.error('TEST', `❌ Error fetching ${symbol}:`, error.message);
            }
        }
        
        // Test option chain
        logger.info('TEST', '\n📊 Testing Option Chain...');
        const optionChain = await api.getOptionChain('SPY');
        if (optionChain && optionChain.expirations) {
            logger.info('TEST', '✅ SPY Option Chain:', {
                expirations: optionChain.expirations.length,
                firstExpiration: optionChain.expirations[0]
            });
        } else {
            logger.error('TEST', '❌ Failed to get SPY option chain');
        }
        
        // Test DataManager integration
        logger.info('TEST', '\n📊 Testing DataManager Integration...');
        const dmSPY = await dataManager.getMarketData('SPY');
        if (dmSPY) {
            logger.info('TEST', '✅ DataManager SPY:', {
                currentPrice: dmSPY.currentPrice,
                volume: dmSPY.volume,
                iv: dmSPY.iv
            });
        } else {
            logger.error('TEST', '❌ DataManager failed to get SPY');
        }
        
        // Test VIX through DataManager
        const dmVIX = await dataManager.getVIXData();
        if (dmVIX) {
            logger.info('TEST', '✅ DataManager VIX:', {
                currentLevel: dmVIX.currentLevel,
                regime: dmVIX.regime
            });
        } else {
            logger.error('TEST', '❌ DataManager failed to get VIX');
        }
        
        logger.info('TEST', '\n✨ API Data Test Complete!');
        
        // Summary
        const summary = {
            authentication: '✅',
            marketData: spyQuote ? '✅' : '❌',
            vixData: vixData ? '✅' : '❌',
            optionChains: optionChain ? '✅' : '❌',
            dataManager: dmSPY ? '✅' : '❌'
        };
        
        logger.info('TEST', '\n📋 Summary:', summary);
        
        // Check for any failures
        const hasFailures = Object.values(summary).some(v => v === '❌');
        if (hasFailures) {
            logger.warn('TEST', '⚠️ Some tests failed - check configuration and credentials');
        } else {
            logger.info('TEST', '🎉 All tests passed! API is working correctly.');
        }
        
    } catch (error) {
        logger.error('TEST', '💥 Test failed:', error);
        logger.error('TEST', 'Stack:', error.stack);
        
        // Provide helpful troubleshooting
        logger.info('TEST', '\n🔧 Troubleshooting Tips:');
        logger.info('TEST', '1. Check credentials.config.js exists and has valid credentials');
        logger.info('TEST', '2. Ensure you have network connectivity');
        logger.info('TEST', '3. Verify API credentials are for the correct environment (sandbox/production)');
        logger.info('TEST', '4. Check if market is open (some data may be limited outside market hours)');
        
        process.exit(1);
    }
}

// Run the test
testAPIConnection().catch(error => {
    logger.error('TEST', 'Unhandled error:', error);
    process.exit(1);
});