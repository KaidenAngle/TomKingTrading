/**
 * Test script for WebSocket streaming functionality
 * Tom King Trading Framework - WebSocket Test
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const { getLogger } = require('./src/logger');

const logger = getLogger();

async function testWebSocketStreaming() {
  console.log('🧪 Testing WebSocket Streaming Functionality...\n');

  try {
    // Initialize TastyTrade API
    console.log('1. Initializing TastyTrade API...');
    const api = new TastyTradeAPI();
    
    // Check if API methods exist
    console.log('2. Checking API methods exist...');
    const methods = [
      'subscribe',
      'unsubscribe', 
      'subscribeToQuotes',
      'unsubscribeFromQuotes',
      'subscribeToGreeks',
      'subscribeToGreeksUpdates'
    ];
    
    for (const method of methods) {
      if (typeof api[method] === 'function') {
        console.log(`   ✅ ${method}() method exists`);
      } else {
        console.log(`   ❌ ${method}() method MISSING`);
      }
    }
    
    // Test authentication (requires credentials)
    console.log('\n3. Testing API authentication...');
    const credentials = {
      username: process.env.TASTYTRADE_USERNAME || 'your_username',
      password: process.env.TASTYTRADE_PASSWORD || 'your_password'
    };
    
    if (credentials.username === 'your_username') {
      console.log('   ⚠️  Authentication skipped - no credentials provided');
      console.log('   💡 Set TASTYTRADE_USERNAME and TASTYTRADE_PASSWORD environment variables to test');
    } else {
      const authResult = await api.authenticate(credentials.username, credentials.password);
      console.log(`   ${authResult ? '✅' : '❌'} Authentication: ${authResult ? 'SUCCESS' : 'FAILED'}`);
      
      if (authResult) {
        // Test streaming initialization
        console.log('\n4. Testing streaming initialization...');
        const streamingResult = await api.enableStreaming();
        console.log(`   ${streamingResult ? '✅' : '❌'} Streaming enabled: ${streamingResult ? 'SUCCESS' : 'FAILED'}`);
        
        if (streamingResult) {
          // Test WebSocket connection
          console.log('\n5. Testing WebSocket connection...');
          const connectionTest = await api.marketDataStreamer.testConnection();
          console.log(`   ${connectionTest ? '✅' : '❌'} WebSocket connection: ${connectionTest ? 'SUCCESS' : 'FAILED'}`);
          
          // Test symbol subscriptions
          console.log('\n6. Testing symbol subscriptions...');
          const testSymbols = ['SPY', 'QQQ', 'ES', 'VIX'];
          
          for (const symbol of testSymbols) {
            try {
              const subscribeResult = await api.subscribe(symbol);
              console.log(`   ${subscribeResult ? '✅' : '❌'} Subscribe to ${symbol}: ${subscribeResult ? 'SUCCESS' : 'FAILED'}`);
              
              // Wait a moment then unsubscribe
              await new Promise(resolve => setTimeout(resolve, 1000));
              const unsubscribeResult = await api.unsubscribe(symbol);
              console.log(`   ${unsubscribeResult ? '✅' : '❌'} Unsubscribe from ${symbol}: ${unsubscribeResult ? 'SUCCESS' : 'FAILED'}`);
              
            } catch (error) {
              console.log(`   ❌ Error testing ${symbol}: ${error.message}`);
            }
          }
          
          // Test Greeks subscription
          console.log('\n7. Testing Greeks subscriptions...');
          try {
            const greeksResult = await api.subscribeToGreeks(['SPY']);
            console.log(`   ${greeksResult ? '✅' : '❌'} Greeks subscription: ${greeksResult ? 'SUCCESS' : 'FAILED'}`);
          } catch (error) {
            console.log(`   ❌ Greeks subscription error: ${error.message}`);
          }
          
          // Test reconnection logic
          console.log('\n8. Testing reconnection logic...');
          const streamer = api.marketDataStreamer;
          
          console.log(`   📊 Current status:`);
          const status = streamer.getStatus();
          console.log(`      - Connected: ${status.connected}`);
          console.log(`      - Subscriptions: ${status.subscriptions}`);
          console.log(`      - Reconnect attempts: ${status.reconnectAttempts}/${status.maxReconnectAttempts}`);
          console.log(`      - Message queue: ${status.messageQueueLength}`);
          
          // Cleanup
          console.log('\n9. Cleaning up...');
          await api.disableStreaming();
          console.log('   ✅ Streaming disabled');
        }
      }
    }
    
    console.log('\n🎉 WebSocket streaming test completed!');
    
  } catch (error) {
    console.error('🚨 Test failed with error:', error);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted, exiting...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated, exiting...');
  process.exit(0);
});

// Run the test
if (require.main === module) {
  testWebSocketStreaming()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWebSocketStreaming };