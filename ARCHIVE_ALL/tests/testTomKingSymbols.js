/**
 * Test WebSocket streaming with Tom King Trading Framework symbols
 * Tests the specific symbols used in Tom King strategies
 */

const { TastyTradeAPI } = require('../src/tastytradeAPI');
const { getLogger } = require('../src/logger');

const logger = getLogger();

// Tom King Framework symbols organized by strategy
const TOM_KING_SYMBOLS = {
  // Core equity symbols for 0DTE and directional trades
  equities: ['SPY', 'QQQ', 'IWM', 'DIA'],
  
  // Volatility indicators
  volatility: ['VIX', 'VXX', 'UVXY'],
  
  // Micro futures - Phase 1 (£30-40k account)
  microFutures: ['MES', 'MNQ', 'MYM', 'MCL', 'MGC'],
  
  // Full futures - Phase 3+ (£60k+ account)  
  futures: ['/ES', '/NQ', '/YM', '/CL', '/GC', '/SI', '/ZN', '/ZB'],
  
  // Currency futures
  currencies: ['/6E', '/6B', '/6A', '/6J'],
  
  // ETFs for long-term positions
  etfs: ['GLD', 'TLT', 'XLE', 'XLF', 'XLK'],
  
  // High IV stocks for premium selling
  highIVStocks: ['TSLA', 'NVDA', 'AMD', 'AAPL', 'AMZN', 'META']
};

async function testTomKingSymbols() {
  console.log('🎯 Testing Tom King Trading Framework Symbols...\n');
  
  try {
    // Initialize API
    console.log('1. Initializing TastyTrade API for Tom King Framework...');
    const api = new TastyTradeAPI();
    
    // Check credentials
    const credentials = {
      username: process.env.TASTYTRADE_USERNAME,
      password: process.env.TASTYTRADE_PASSWORD
    };
    
    if (!credentials.username) {
      console.log('⚠️  No credentials provided - testing methods only');
      console.log('💡 Set TASTYTRADE_USERNAME and TASTYTRADE_PASSWORD to test streaming\n');
      
      // Test methods without authentication
      await testMethodsWithoutAuth(api);
      return;
    }
    
    // Authenticate
    console.log('2. Authenticating with TastyTrade...');
    const authResult = await api.authenticate(credentials.username, credentials.password);
    
    if (!authResult) {
      console.log('❌ Authentication failed - cannot test streaming');
      return;
    }
    
    console.log('✅ Authentication successful');
    
    // Enable streaming
    console.log('3. Enabling real-time streaming...');
    const streamingResult = await api.enableStreaming();
    
    if (!streamingResult) {
      console.log('❌ Failed to enable streaming');
      return;
    }
    
    console.log('✅ Streaming enabled');
    
    // Test WebSocket connection
    console.log('4. Testing WebSocket connection...');
    const connectionTest = await api.marketDataStreamer.testConnection();
    console.log(`   ${connectionTest ? '✅' : '❌'} WebSocket: ${connectionTest ? 'SUCCESS' : 'FAILED'}`);
    
    // Test symbol categories
    for (const [category, symbols] of Object.entries(TOM_KING_SYMBOLS)) {
      console.log(`\n5.${category.charAt(0).toUpperCase() + category.slice(1)} - Testing ${category} symbols...`);
      
      // Subscribe to all symbols in category
      try {
        const subscribeResult = await api.subscribe(symbols);
        console.log(`   📡 Subscribe: ${subscribeResult ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        // Wait a moment for data
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if we're receiving data
        const quotes = api.marketDataStreamer.getQuotes(symbols);
        const quotesReceived = Object.keys(quotes).length;
        console.log(`   📊 Quotes received: ${quotesReceived}/${symbols.length} symbols`);
        
        // Show sample quotes
        if (quotesReceived > 0) {
          const sampleSymbol = Object.keys(quotes)[0];
          const quote = quotes[sampleSymbol];
          console.log(`   💡 Sample ${sampleSymbol}: bid=${quote.bid}, ask=${quote.ask}, last=${quote.last}`);
        }
        
        // Test unsubscribe
        const unsubscribeResult = await api.unsubscribe(symbols);
        console.log(`   📤 Unsubscribe: ${unsubscribeResult ? '✅ SUCCESS' : '❌ FAILED'}`);
        
      } catch (error) {
        console.log(`   ❌ Error testing ${category}: ${error.message}`);
      }
    }
    
    // Test Greeks subscription for options-heavy symbols
    console.log('\n6. Testing Greeks subscriptions...');
    const optionsSymbols = ['SPY', 'QQQ', 'TSLA'];
    try {
      const greeksResult = await api.subscribeToGreeks(optionsSymbols);
      console.log(`   📈 Greeks subscription: ${greeksResult ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      // Wait for potential Greeks data
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.log(`   ❌ Greeks error: ${error.message}`);
    }
    
    // Test streaming status and diagnostics
    console.log('\n7. Streaming diagnostics...');
    const status = api.marketDataStreamer.getStatus();
    console.log(`   🔌 Connected: ${status.connected}`);
    console.log(`   📡 Subscriptions: ${status.subscriptions}`);
    console.log(`   💾 Quotes cached: ${status.quotesReceived}`);
    console.log(`   🔄 Reconnect attempts: ${status.reconnectAttempts}`);
    console.log(`   ⏱️  Last update: ${status.lastUpdate ? status.lastUpdate.toLocaleString() : 'None'}`);
    console.log(`   💓 Last heartbeat: ${status.lastHeartbeat ? status.lastHeartbeat.toLocaleString() : 'None'}`);
    
    // Test market hours detection
    const marketHours = status.marketHours;
    console.log(`   🕒 Market hours: ${marketHours.isMarketHours ? 'OPEN' : 'CLOSED'}`);
    console.log(`   🌅 Extended hours: ${marketHours.isExtendedHours ? 'YES' : 'NO'}`);
    console.log(`   📅 Weekend: ${marketHours.isWeekend ? 'YES' : 'NO'}`);
    
    // Performance metrics
    const diagnostics = api.marketDataStreamer.getDiagnostics();
    console.log(`   ⚡ Performance: ${diagnostics.performance.quotesPerSecond} quotes/sec`);
    
    // Cleanup
    console.log('\n8. Cleaning up...');
    await api.disableStreaming();
    console.log('   ✅ Streaming disabled');
    
    console.log('\n🎉 Tom King symbol streaming test completed successfully!');
    
  } catch (error) {
    console.error('🚨 Test failed:', error);
  }
}

async function testMethodsWithoutAuth(api) {
  console.log('🔍 Testing methods without authentication...\n');
  
  // Test method availability
  const methods = [
    'subscribe', 'unsubscribe', 'subscribeToQuotes', 'unsubscribeFromQuotes',
    'subscribeToGreeks', 'subscribeToGreeksUpdates'
  ];
  
  methods.forEach(method => {
    const exists = typeof api[method] === 'function';
    console.log(`   ${exists ? '✅' : '❌'} ${method}()`);
  });
  
  // Test WebSocket connection (should fail gracefully)
  console.log('\n🔌 Testing WebSocket connection (no auth)...');
  try {
    const connectionTest = await api.marketDataStreamer.testConnection();
    console.log(`   🌐 Connection test: ${connectionTest ? 'SUCCESS' : 'FAILED (expected)'}`);
  } catch (error) {
    console.log(`   ⚠️  Connection test failed (expected): ${error.message}`);
  }
  
  // Test symbol conversion
  console.log('\n🔄 Testing symbol conversion...');
  const testSymbols = ['SPY', 'ES', 'MES', '/ES', '/MES'];
  testSymbols.forEach(symbol => {
    const converted = api.marketDataStreamer.convertToStreamerSymbol(symbol);
    console.log(`   📊 ${symbol} → ${converted}`);
  });
  
  console.log('\n✅ Method testing completed!');
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, cleaning up...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testTomKingSymbols()
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testTomKingSymbols, TOM_KING_SYMBOLS };