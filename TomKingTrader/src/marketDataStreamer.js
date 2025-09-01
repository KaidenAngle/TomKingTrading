/**
 * Real-time Market Data Streamer using DxFeed WebSocket
 * Based on official TastyTrade SDK patterns
 */

const WebSocket = require('isomorphic-ws');
const { DXLinkWebSocketClient, DXLinkFeed, FeedDataFormat } = require('@dxfeed/dxlink-api');

// Make WebSocket available globally for DxFeed
global.WebSocket = WebSocket;

const DEBUG = process.env.NODE_ENV !== 'production';

class MarketDataStreamer {
  constructor(tastyTradeAPI) {
    this.api = tastyTradeAPI;
    this.client = null;
    this.feed = null;
    this.subscriptions = new Map();
    this.listeners = new Set();
    this.isConnected = false;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Market data cache
    this.quotes = new Map();
    this.lastUpdate = new Map();
    
    if (DEBUG) {
      console.log('📊 MarketDataStreamer initialized');
    }
  }

  /**
   * Initialize the streaming connection
   */
  async initialize() {
    try {
      if (DEBUG) console.log('📡 Initializing market data streaming...');
      
      // Get streaming token from TastyTrade API
      await this.getStreamingToken();
      
      // Initialize DxFeed client
      this.client = new DXLinkWebSocketClient();
      
      // Connect to TastyTrade DxFeed endpoint
      await this.client.connect('wss://tasty-openapi-ws.dxfeed.com/realtime');
      
      // Set authentication token
      this.client.setAuthToken(this.token);
      
      // Initialize feed with optimized configuration
      this.feed = new DXLinkFeed(this.client, 'AUTO');
      
      // Configure feed for options trading
      this.feed.configure({
        acceptAggregationPeriod: 10, // 10ms aggregation for fast updates
        acceptDataFormat: FeedDataFormat.COMPACT,
        acceptEventFields: {
          Quote: [
            'eventSymbol', 
            'askPrice', 
            'bidPrice', 
            'askSize', 
            'bidSize',
            'timeSequence'
          ],
          Trade: [
            'eventSymbol',
            'price',
            'size',
            'time'
          ]
        }
      });
      
      // Add event listener for market data
      this.feed.addEventListener((events) => {
        this.handleMarketData(events);
      });
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      if (DEBUG) console.log('✅ Market data streaming connected');
      
      // Notify listeners of connection
      this.notifyListeners('connected', { status: 'connected' });
      
      return true;
      
    } catch (error) {
      console.error('🚨 Failed to initialize market data streaming:', error);
      await this.handleReconnect();
      return false;
    }
  }

  /**
   * Get streaming token from TastyTrade API
   */
  async getStreamingToken() {
    try {
      if (DEBUG) console.log('📡 Requesting streaming token from /api-quote-tokens');
      
      const response = await this.api.request('/api-quote-tokens');
      
      if (DEBUG) console.log('📡 API request completed successfully');
      
      if (DEBUG) {
        console.log('🔍 Streaming token response:', JSON.stringify(response, null, 2));
        console.log('🔍 Response type:', typeof response);
      }
      
      // Handle response structure - could be direct or wrapped in 'data'
      const tokenData = response?.data || response;
      
      if (tokenData && tokenData.token) {
        this.token = tokenData.token;
        this.tokenExpiry = new Date(tokenData['expires-at']);
        
        if (DEBUG) {
          console.log('🔑 Streaming token obtained');
          console.log('⏰ Token expires:', this.tokenExpiry.toISOString());
        }
        
        return this.token;
      }
      
      console.error('❌ No token found in response:', {
        responseExists: !!response,
        responseType: typeof response,
        hasData: !!response?.data,
        tokenDataExists: !!tokenData,
        tokenDataType: typeof tokenData,
        hasToken: !!tokenData?.token,
        tokenValue: tokenData?.token ? 'PRESENT' : 'MISSING',
        fullResponse: JSON.stringify(response, null, 2)
      });
      throw new Error('No streaming token received');
      
    } catch (error) {
      console.error('🚨 Failed to get streaming token:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time quotes for symbols
   */
  async subscribeToQuotes(symbols) {
    if (!this.isConnected || !this.feed) {
      console.warn('⚠️ Not connected - queuing subscription for:', symbols);
      return false;
    }
    
    try {
      for (const symbol of symbols) {
        // Convert to proper streamer symbol if needed
        const streamerSymbol = this.convertToStreamerSymbol(symbol);
        
        if (DEBUG) {
          console.log(`📡 Subscribing to quotes: ${symbol} -> ${streamerSymbol}`);
        }
        
        // Subscribe to both Quote and Trade events
        this.feed.addSubscriptions(
          {
            type: 'Quote',
            symbol: streamerSymbol
          },
          {
            type: 'Trade', 
            symbol: streamerSymbol
          }
        );
        
        this.subscriptions.set(symbol, {
          streamerSymbol,
          subscribed: true,
          lastUpdate: null
        });
      }
      
      if (DEBUG) {
        console.log(`✅ Subscribed to ${symbols.length} symbols`);
      }
      
      return true;
      
    } catch (error) {
      console.error('🚨 Failed to subscribe to quotes:', error);
      return false;
    }
  }

  /**
   * Convert symbol to DxFeed streamer format
   */
  convertToStreamerSymbol(symbol) {
    // For equity options, use OCC format directly
    if (symbol.includes(' ') && symbol.length > 10) {
      // This is likely an OCC option symbol
      return symbol;
    }
    
    // For equity symbols, use as-is
    if (symbol.match(/^[A-Z]{1,5}$/)) {
      return symbol;
    }
    
    // For futures options, may need conversion
    if (symbol.startsWith('./')) {
      return symbol;
    }
    
    return symbol;
  }

  /**
   * Handle incoming market data events
   */
  handleMarketData(events) {
    const updates = new Map();
    
    events.forEach(event => {
      const symbol = event.eventSymbol;
      const timestamp = new Date();
      
      if (!this.quotes.has(symbol)) {
        this.quotes.set(symbol, {});
      }
      
      const quote = this.quotes.get(symbol);
      
      // Handle Quote events
      if (event.eventType === 'Quote') {
        quote.bid = event.bidPrice;
        quote.ask = event.askPrice;
        quote.bidSize = event.bidSize;
        quote.askSize = event.askSize;
        quote.mid = (event.bidPrice + event.askPrice) / 2;
        quote.spread = event.askPrice - event.bidPrice;
        quote.spreadPercent = (quote.spread / quote.mid) * 100;
      }
      
      // Handle Trade events
      if (event.eventType === 'Trade') {
        quote.last = event.price;
        quote.lastSize = event.size;
        quote.lastTime = event.time;
      }
      
      quote.timestamp = timestamp;
      this.lastUpdate.set(symbol, timestamp);
      
      // Collect updates for batch notification
      updates.set(symbol, { ...quote });
    });
    
    // Notify listeners of updates
    if (updates.size > 0) {
      this.notifyListeners('quotes', {
        updates: Object.fromEntries(updates),
        timestamp: new Date()
      });
      
      if (DEBUG && updates.size > 0) {
        console.log(`📊 Market data update: ${updates.size} symbols`);
      }
    }
  }

  /**
   * Get current quote for a symbol
   */
  getQuote(symbol) {
    return this.quotes.get(symbol) || null;
  }

  /**
   * Get quotes for multiple symbols
   */
  getQuotes(symbols = null) {
    if (!symbols) {
      return Object.fromEntries(this.quotes);
    }
    
    const result = {};
    symbols.forEach(symbol => {
      const quote = this.quotes.get(symbol);
      if (quote) {
        result[symbol] = quote;
      }
    });
    
    return result;
  }

  /**
   * Add market data listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    
    if (DEBUG) {
      console.log(`📡 Added market data listener (total: ${this.listeners.size})`);
    }
  }

  /**
   * Remove market data listener
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of market data events
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('🚨 Error in market data listener:', error);
      }
    });
  }

  /**
   * Handle reconnection logic
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('🚨 Max reconnection attempts reached');
      this.notifyListeners('failed', { 
        error: 'Max reconnection attempts reached' 
      });
      return;
    }
    
    this.reconnectAttempts++;
    this.isConnected = false;
    
    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    // Wait before reconnecting
    await new Promise(resolve => 
      setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts)
    );
    
    // Try to reinitialize
    await this.initialize();
  }

  /**
   * Get connection status and statistics
   */
  getStatus() {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      quotesReceived: this.quotes.size,
      reconnectAttempts: this.reconnectAttempts,
      tokenExpiry: this.tokenExpiry,
      lastUpdate: Math.max(...Array.from(this.lastUpdate.values()).map(d => d.getTime())) || null
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    try {
      this.isConnected = false;
      
      if (this.feed) {
        // Remove all subscriptions
        const symbols = Array.from(this.subscriptions.keys());
        symbols.forEach(symbol => {
          const subscription = this.subscriptions.get(symbol);
          if (subscription && subscription.streamerSymbol) {
            this.feed.removeSubscriptions(
              { type: 'Quote', symbol: subscription.streamerSymbol },
              { type: 'Trade', symbol: subscription.streamerSymbol }
            );
          }
        });
        
        this.feed = null;
      }
      
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      
      this.subscriptions.clear();
      this.quotes.clear();
      this.lastUpdate.clear();
      
      if (DEBUG) {
        console.log('📡 Market data streaming disconnected');
      }
      
      this.notifyListeners('disconnected', { status: 'disconnected' });
      
    } catch (error) {
      console.error('🚨 Error during disconnect:', error);
    }
  }
}

module.exports = MarketDataStreamer;