/**
 * WebSocket Streaming Integration Example
 * Tom King Trading Framework v17
 * 
 * This example shows how to integrate real-time WebSocket streaming
 * with the existing TastyTrade API and market data service
 */

const TastyTradeAPI = require('../src/tastytradeAPI');
const MarketDataStreamer = require('../src/marketDataStreamer');
const MarketDataService = require('../src/marketDataService');
const { getLogger } = require('../src/logger');

const logger = getLogger();

class StreamingIntegrationExample {
  constructor() {
    this.api = null;
    this.streamer = null;
    this.fallbackService = MarketDataService;
    this.isUsingFallback = false;
    
    // Symbols to watch
    this.watchedSymbols = [
      'SPY', 'QQQ', 'IWM', 'VIX',  // Equities and volatility
      '/ES', '/NQ', '/RTY',        // Futures
      '/GC', '/CL', '/ZN'          // Commodities and bonds
    ];
    
    // Quote cache for comparison
    this.lastQuotes = new Map();
    
    logger.info('EXAMPLE', '📊 StreamingIntegrationExample initialized');
  }
  
  /**
   * Initialize the streaming system
   */
  async initialize() {
    try {
      logger.info('EXAMPLE', '🚀 Starting WebSocket streaming integration...');
      
      // Initialize TastyTrade API
      this.api = new TastyTradeAPI();
      await this.api.authenticate();
      
      // Initialize WebSocket streamer
      this.streamer = new MarketDataStreamer(this.api);
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Initialize streaming connection
      const connected = await this.streamer.initialize();
      
      if (connected) {
        logger.info('EXAMPLE', '✅ WebSocket streaming connected successfully');
        await this.subscribeToSymbols();
      } else {
        logger.warn('EXAMPLE', '⚠️ WebSocket failed, falling back to polling');
        this.enableFallback();
      }
      
      return true;
      
    } catch (error) {
      logger.error('EXAMPLE', '🚨 Failed to initialize streaming', error);
      this.enableFallback();
      return false;
    }
  }
  
  /**
   * Set up event listeners for the streamer
   */
  setupEventListeners() {
    // Connection events
    this.streamer.on('connected', (data) => {
      logger.info('EXAMPLE', '🔗 Streamer connected', data);
      this.isUsingFallback = false;
    });
    
    this.streamer.on('disconnected', (data) => {
      logger.warn('EXAMPLE', '🔌 Streamer disconnected', data);
      // Don't immediately fall back - let reconnection happen
    });
    
    this.streamer.on('failed', (data) => {
      logger.error('EXAMPLE', '🚨 Streamer failed permanently', data);
      this.enableFallback();
    });
    
    this.streamer.on('fallback', (data) => {
      logger.info('EXAMPLE', '🔄 Falling back to polling mode', data);
      this.enableFallback();
    });
    
    // Market data events
    this.streamer.on('quotes', (data) => {
      this.handleRealTimeQuotes(data);
    });
    
    // Legacy callback support
    this.streamer.addListener((event, data) => {
      if (event === 'quotes') {
        logger.trace('EXAMPLE', '📊 Legacy callback triggered', {
          symbols: Object.keys(data.updates).length
        });
      }
    });
  }
  
  /**
   * Subscribe to market data for watched symbols
   */
  async subscribeToSymbols() {
    try {
      logger.info('EXAMPLE', `📡 Subscribing to ${this.watchedSymbols.length} symbols...`);
      
      const success = await this.streamer.subscribeToQuotes(this.watchedSymbols);
      
      if (success) {
        logger.info('EXAMPLE', '✅ Successfully subscribed to all symbols');
      } else {
        logger.warn('EXAMPLE', '⚠️ Some subscriptions may have failed');
      }
      
      // Display subscription status
      const subscriptions = this.streamer.getSubscriptions();
      logger.info('EXAMPLE', '📋 Subscription status:', subscriptions);
      
    } catch (error) {
      logger.error('EXAMPLE', '🚨 Failed to subscribe to symbols', error);
    }
  }
  
  /**
   * Handle real-time quote updates
   */
  handleRealTimeQuotes(data) {
    const { updates, timestamp } = data;
    const symbolCount = Object.keys(updates).length;
    
    logger.debug('EXAMPLE', `📊 Received quotes for ${symbolCount} symbols at ${timestamp.toISOString()}`);
    
    // Process each symbol update
    Object.entries(updates).forEach(([symbol, quote]) => {
      this.processQuoteUpdate(symbol, quote);
    });
    
    // Update performance metrics
    this.updatePerformanceMetrics(symbolCount);
  }
  
  /**
   * Process individual quote update
   */
  processQuoteUpdate(symbol, quote) {
    const lastQuote = this.lastQuotes.get(symbol);
    
    // Check for significant price movement
    if (lastQuote && quote.last && lastQuote.last) {
      const priceChange = ((quote.last - lastQuote.last) / lastQuote.last) * 100;
      
      if (Math.abs(priceChange) > 1.0) { // More than 1% change
        logger.info('EXAMPLE', `🎯 Significant move in ${symbol}`, {
          oldPrice: lastQuote.last,
          newPrice: quote.last,
          change: `${priceChange.toFixed(2)}%`,
          bid: quote.bid,
          ask: quote.ask,
          spread: quote.spread
        });
      }
    }
    
    // Store for comparison
    this.lastQuotes.set(symbol, { ...quote });
    
    // Example: Check for trading opportunities
    this.checkTradingSignals(symbol, quote);
  }
  
  /**
   * Check for trading signals based on real-time data
   */
  checkTradingSignals(symbol, quote) {
    // Example signal detection logic
    if (quote.bid && quote.ask && quote.spread) {
      const spreadPercent = quote.spreadPercent || 0;\n      \n      // Wide spread opportunity\n      if (spreadPercent > 2.0) {\n        logger.debug('EXAMPLE', `📈 Wide spread detected in ${symbol}`, {\n          spread: quote.spread,\n          spreadPercent: `${spreadPercent.toFixed(2)}%`,\n          mid: quote.mid\n        });\n      }\n      \n      // VIX regime changes\n      if (symbol === 'VIX' && quote.last) {\n        const vixLevel = quote.last;\n        if (vixLevel > 30) {\n          logger.info('EXAMPLE', '🔥 High VIX detected - defensive mode suggested', {\n            vix: vixLevel\n          });\n        } else if (vixLevel < 12) {\n          logger.info('EXAMPLE', '🌤️ Low VIX detected - premium selling opportunity', {\n            vix: vixLevel\n          });\n        }\n      }\n    }\n  }\n  \n  /**\n   * Update performance metrics\n   */\n  updatePerformanceMetrics(quoteCount) {\n    // Simple performance tracking\n    const now = Date.now();\n    if (!this.lastMetricUpdate) {\n      this.lastMetricUpdate = now;\n      this.quotesReceived = 0;\n    }\n    \n    this.quotesReceived += quoteCount;\n    \n    // Log performance every minute\n    if (now - this.lastMetricUpdate > 60000) {\n      const quotesPerSecond = this.quotesReceived / 60;\n      logger.info('EXAMPLE', '📊 Performance metrics', {\n        quotesPerSecond: quotesPerSecond.toFixed(2),\n        totalQuotes: this.quotesReceived,\n        connectedSymbols: this.streamer.getSubscriptions()\n      });\n      \n      this.lastMetricUpdate = now;\n      this.quotesReceived = 0;\n    }\n  }\n  \n  /**\n   * Enable fallback to polling mode\n   */\n  enableFallback() {\n    if (this.isUsingFallback) {\n      return;\n    }\n    \n    logger.info('EXAMPLE', '🔄 Switching to fallback polling mode');\n    this.isUsingFallback = true;\n    \n    // Start polling for watched symbols\n    this.startPolling();\n  }\n  \n  /**\n   * Start polling mode as fallback\n   */\n  startPolling() {\n    if (this.pollingInterval) {\n      clearInterval(this.pollingInterval);\n    }\n    \n    this.pollingInterval = setInterval(async () => {\n      try {\n        logger.debug('EXAMPLE', '🔄 Polling market data...');\n        \n        // Get data from fallback service\n        const marketData = await this.fallbackService.getMultipleTickerData(\n          this.watchedSymbols.filter(s => !s.startsWith('/')) // Filter out futures for demo\n        );\n        \n        // Convert to streaming format and emit\n        const updates = {};\n        Object.entries(marketData).forEach(([symbol, data]) => {\n          updates[symbol] = {\n            last: data.currentPrice,\n            bid: data.currentPrice * 0.999, // Mock bid\n            ask: data.currentPrice * 1.001, // Mock ask\n            timestamp: new Date(data.timestamp)\n          };\n        });\n        \n        this.handleRealTimeQuotes({\n          updates,\n          timestamp: new Date()\n        });\n        \n      } catch (error) {\n        logger.error('EXAMPLE', '🚨 Polling failed', error);\n      }\n    }, 5000); // Poll every 5 seconds\n    \n    logger.info('EXAMPLE', '✅ Fallback polling started (5 second interval)');\n  }\n  \n  /**\n   * Get current status of the streaming system\n   */\n  getStatus() {\n    const streamerStatus = this.streamer ? this.streamer.getStatus() : null;\n    \n    return {\n      streaming: {\n        enabled: !this.isUsingFallback,\n        status: streamerStatus\n      },\n      fallback: {\n        enabled: this.isUsingFallback,\n        interval: this.pollingInterval ? '5s' : 'stopped'\n      },\n      symbols: {\n        watched: this.watchedSymbols.length,\n        subscribed: streamerStatus?.subscriptions || 0,\n        quotesReceived: streamerStatus?.quotesReceived || 0\n      },\n      performance: {\n        quotesPerSecond: this.streamer ? this.streamer.calculateQuotesPerSecond() : 0,\n        lastUpdate: streamerStatus?.lastUpdate || null\n      }\n    };\n  }\n  \n  /**\n   * Run diagnostics and display comprehensive status\n   */\n  async runDiagnostics() {\n    logger.info('EXAMPLE', '🔍 Running diagnostics...');\n    \n    const status = this.getStatus();\n    console.log('\\n=== STREAMING SYSTEM DIAGNOSTICS ===');\n    console.log(JSON.stringify(status, null, 2));\n    \n    if (this.streamer) {\n      const diagnostics = this.streamer.getDiagnostics();\n      console.log('\\n=== DETAILED DIAGNOSTICS ===');\n      console.log(JSON.stringify(diagnostics, null, 2));\n      \n      // Test connection\n      console.log('\\n=== CONNECTION TEST ===');\n      try {\n        const connectionTest = await this.streamer.testConnection();\n        console.log(`Connection test: ${connectionTest ? 'PASS' : 'FAIL'}`);\n      } catch (error) {\n        console.log(`Connection test: FAIL - ${error.message}`);\n      }\n    }\n  }\n  \n  /**\n   * Gracefully shutdown the streaming system\n   */\n  async shutdown() {\n    logger.info('EXAMPLE', '🛑 Shutting down streaming system...');\n    \n    // Stop polling\n    if (this.pollingInterval) {\n      clearInterval(this.pollingInterval);\n      this.pollingInterval = null;\n    }\n    \n    // Disconnect streamer\n    if (this.streamer) {\n      await this.streamer.disconnect();\n    }\n    \n    logger.info('EXAMPLE', '✅ Streaming system shutdown complete');\n  }\n}\n\n// Example usage\nasync function runExample() {\n  const example = new StreamingIntegrationExample();\n  \n  try {\n    // Initialize streaming\n    await example.initialize();\n    \n    // Run for 2 minutes\n    logger.info('EXAMPLE', '⏱️ Running example for 2 minutes...');\n    \n    // Display status every 30 seconds\n    const statusInterval = setInterval(() => {\n      const status = example.getStatus();\n      logger.info('EXAMPLE', '📊 Current status', status);\n    }, 30000);\n    \n    // Run diagnostics after 1 minute\n    setTimeout(() => {\n      example.runDiagnostics();\n    }, 60000);\n    \n    // Shutdown after 2 minutes\n    setTimeout(async () => {\n      clearInterval(statusInterval);\n      await example.shutdown();\n      process.exit(0);\n    }, 120000);\n    \n  } catch (error) {\n    logger.error('EXAMPLE', '🚨 Example failed', error);\n    process.exit(1);\n  }\n}\n\n// Run the example if this file is executed directly\nif (require.main === module) {\n  runExample();\n}\n\nmodule.exports = StreamingIntegrationExample;