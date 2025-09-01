/**
 * Test script for market data fixes
 */

const { TastyTradeAPI, MarketDataCollector } = require('./src/tastytradeAPI');

async function testMarketDataFix() {
    console.log('🎯 Testing market data fixes...');
    
    try {
        const api = new TastyTradeAPI();
        await api.initialize();
        console.log('✅ API initialized');
        
        // Test the working quotes we confirmed earlier
        console.log('\n📊 Testing confirmed working symbols...');
        
        const testSymbols = ['VIX', 'GLD', 'TLT', 'SLV'];
        const quotes = await api.getQuotes(testSymbols);
        
        testSymbols.forEach(symbol => {
            const quote = quotes[symbol];
            if (quote) {
                const price = parseFloat(quote.last || quote.mark || quote.close || 0);
                const type = quote['instrument-type'] || 'Unknown';
                console.log(`✅ ${symbol}: $${price} (${type})`);
            } else {
                console.log(`❌ ${symbol}: NO DATA`);
            }
        });
        
        // Test the MarketDataCollector
        console.log('\n📊 Testing MarketDataCollector...');
        const collector = new MarketDataCollector(api);
        
        const vixData = await collector.getVIXData();
        console.log(`VIX: ${vixData.currentLevel} (Regime: ${vixData.regime})`);
        
        // Test phase tickers (ETFs should work)
        const phaseTickers = await collector.getPhaseSpecificTickers();
        const workingTickers = Object.keys(phaseTickers).filter(t => 
            phaseTickers[t].currentPrice > 0
        );
        
        console.log(`Working tickers (${workingTickers.length}): ${workingTickers.join(', ')}`);
        
        // Show actual prices for first 3
        workingTickers.slice(0, 3).forEach(ticker => {
            const data = phaseTickers[ticker];
            console.log(`  ${ticker}: $${data.currentPrice} (IV: ${data.iv}%)`);
        });
        
        console.log('\n✅ Market data fix test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testMarketDataFix();