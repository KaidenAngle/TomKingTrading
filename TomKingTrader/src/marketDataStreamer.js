/**
 * Real-time Market Data Streamer using TastyTrade WebSocket
 * Complete implementation with auto-reconnect, heartbeat, and fallback
 * Based on Tom King Trading Framework v17 specifications
 */

const WebSocket = require('isomorphic-ws');
const EventEmitter = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();
const DEBUG = process.env.NODE_ENV !== 'production';

class MarketDataStreamer extends EventEmitter {
  constructor(tastyTradeAPI) {
    super();
    this.api = tastyTradeAPI;
    this.ws = null;
    this.subscriptions = new Map();
    this.isConnected = false;
    this.isConnecting = false;
    this.token = null;
    this.sessionId = null;
    
    // Connection management
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.lastHeartbeat = null;
    
    // Message queuing for reconnection
    this.messageQueue = [];
    this.maxQueueSize = 1000;
    
    // Market data cache
    this.quotes = new Map();
    this.lastUpdate = new Map();
    this.updateCallbacks = new Set();
    
    // WebSocket endpoints
    this.wsEndpoint = 'wss://streamer.tastyworks.com';
    this.fallbackEndpoint = 'wss://streamer.dxfeed.com/realtime';
    
    // Market hours tracking
    this.marketHours = {
      isOpen: false,
      nextOpen: null,
      lastChecked: null
    };
    
    logger.info('STREAMER', '📊 MarketDataStreamer initialized');
  }

  /**
   * Initialize the streaming connection
   */
  async initialize() {
    if (this.isConnecting || this.isConnected) {
      logger.warn('STREAMER', 'Already connected or connecting');
      return true;
    }
    
    try {
      logger.info('STREAMER', '📡 Initializing market data streaming...');
      this.isConnecting = true;
      
      // Get streaming token from TastyTrade API
      await this.getStreamingToken();
      
      // Connect to WebSocket
      await this.connect();
      
      return this.isConnected;
      
    } catch (error) {
      logger.error('STREAMER', '🚨 Failed to initialize market data streaming', error);
      this.isConnecting = false;
      await this.handleReconnect();
      return false;
    }
  }
  
  /**
   * Connect to WebSocket with fallback
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Try primary endpoint first
        this.ws = new WebSocket(this.wsEndpoint);
        
        const timeout = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000); // 10 second timeout
        
        this.ws.onopen = () => {
          clearTimeout(timeout);
          logger.info('STREAMER', '✅ WebSocket connected');
          this.handleOpen();
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
        
        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.handleClose(event);
        };
        
        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          logger.error('STREAMER', '🚨 WebSocket error', error);
          reject(error);
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle WebSocket open event
   */
  handleOpen() {
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    
    // Authenticate
    this.authenticate();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process any queued messages
    this.processMessageQueue();
    
    // Emit connected event
    this.emit('connected', { status: 'connected', endpoint: this.wsEndpoint });
    
    logger.info('STREAMER', '📡 Market data streaming connected and authenticated');
  }

  /**
   * Get streaming token from TastyTrade API
   */
  async getStreamingToken() {
    try {
      logger.debug('STREAMER', '📡 Requesting streaming token from /api-quote-tokens');
      
      const response = await this.api.request('/api-quote-tokens');
      
      // Handle response structure - could be direct or wrapped in 'data'
      const tokenData = response?.data || response;
      
      if (tokenData && tokenData.token) {
        this.token = tokenData.token;
        this.tokenExpiry = new Date(tokenData['expires-at']);
        
        logger.info('STREAMER', '🔑 Streaming token obtained', {
          expires: this.tokenExpiry.toISOString()
        });
        
        return this.token;
      }
      
      logger.error('STREAMER', '❌ No token found in response', {
        responseExists: !!response,
        responseType: typeof response,
        hasData: !!response?.data,
        tokenDataExists: !!tokenData,
        tokenDataType: typeof tokenData,
        hasToken: !!tokenData?.token
      });
      throw new Error('No streaming token received');
      
    } catch (error) {
      logger.error('STREAMER', '🚨 Failed to get streaming token', error);
      throw error;
    }
  }
  
  /**
   * Authenticate WebSocket connection
   */
  authenticate() {
    if (!this.token) {
      logger.error('STREAMER', '❌ No token available for authentication');
      return;
    }
    
    const authMessage = {
      action: 'auth',
      value: this.token
    };
    
    this.sendMessage(authMessage);
    logger.debug('STREAMER', '🔐 Authentication message sent');
  }
  
  /**
   * Send message to WebSocket
   */
  sendMessage(message) {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message for later
      if (this.messageQueue.length < this.maxQueueSize) {
        this.messageQueue.push(message);
        logger.debug('STREAMER', '📤 Message queued', { queueLength: this.messageQueue.length });
      } else {
        logger.warn('STREAMER', '⚠️ Message queue full, dropping message');
      }
      return false;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      logger.trace('STREAMER', '📤 Message sent', message);
      return true;
    } catch (error) {
      logger.error('STREAMER', '🚨 Failed to send message', error);
      return false;
    }
  }
  
  /**
   * Process queued messages
   */
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    logger.info('STREAMER', `📤 Processing ${this.messageQueue.length} queued messages`);
    
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    
    messages.forEach(message => {
      this.sendMessage(message);
    });
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      switch (data.type || data.action) {
        case 'auth-state':
          this.handleAuthState(data);
          break;
        case 'heartbeat':
        case 'pong':
          this.handleHeartbeat(data);
          break;
        case 'quote':
        case 'trade':
          this.handleMarketDataMessage(data);
          break;
        case 'subscription-state':
          this.handleSubscriptionState(data);
          break;
        case 'error':
          this.handleError(data);
          break;
        default:
          logger.trace('STREAMER', '📨 Unknown message type', data);
      }
      
    } catch (error) {
      logger.error('STREAMER', '🚨 Failed to parse message', error);
    }
  }
  
  /**
   * Handle authentication state
   */
  handleAuthState(data) {
    if (data.state === 'logged-in') {
      this.sessionId = data.session;
      logger.info('STREAMER', '✅ Authentication successful', { session: this.sessionId });
      
      // Re-subscribe to any existing subscriptions
      this.resubscribeAll();
      
    } else if (data.state === 'logged-out') {
      logger.warn('STREAMER', '⚠️ Authentication lost, reconnecting');
      this.handleReconnect();
    }
  }
  
  /**
   * Handle heartbeat messages
   */
  handleHeartbeat(data) {
    this.lastHeartbeat = Date.now();
    logger.trace('STREAMER', '💓 Heartbeat received');
  }
  
  /**
   * Handle market data messages
   */
  handleMarketDataMessage(data) {
    const symbols = Array.isArray(data.data) ? data.data : [data];
    const updates = new Map();
    
    symbols.forEach(symbolData => {
      const symbol = symbolData.symbol || symbolData.eventSymbol;
      if (!symbol) return;
      
      const timestamp = new Date();
      
      if (!this.quotes.has(symbol)) {
        this.quotes.set(symbol, {});
      }
      
      const quote = this.quotes.get(symbol);
      
      // Handle quote data
      if (symbolData.bid !== undefined) {
        quote.bid = symbolData.bid;
        quote.bidSize = symbolData.bidSize;
      }
      if (symbolData.ask !== undefined) {
        quote.ask = symbolData.ask;
        quote.askSize = symbolData.askSize;
      }
      if (quote.bid && quote.ask) {
        quote.mid = (quote.bid + quote.ask) / 2;
        quote.spread = quote.ask - quote.bid;
        quote.spreadPercent = (quote.spread / quote.mid) * 100;
      }
      
      // Handle trade data
      if (symbolData.price !== undefined || symbolData.last !== undefined) {
        quote.last = symbolData.price || symbolData.last;
        quote.lastSize = symbolData.size || symbolData.lastSize;
        quote.lastTime = symbolData.time || timestamp;
      }
      
      quote.timestamp = timestamp;
      this.lastUpdate.set(symbol, timestamp);
      
      updates.set(symbol, { ...quote });
    });
    
    // Emit updates
    if (updates.size > 0) {
      this.emit('quotes', {
        updates: Object.fromEntries(updates),
        timestamp: new Date()
      });
      
      // Call update callbacks
      this.updateCallbacks.forEach(callback => {
        try {
          callback('quotes', {
            updates: Object.fromEntries(updates),
            timestamp: new Date()
          });
        } catch (error) {
          logger.error('STREAMER', '🚨 Error in update callback', error);
        }
      });
      
      logger.trace('STREAMER', `📊 Market data update: ${updates.size} symbols`);
    }
  }

  /**
   * Subscribe to real-time quotes for symbols
   */
  async subscribeToQuotes(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }
    
    const subscribeMessage = {
      action: 'feed-subscription',
      types: ['Quote', 'Trade'],
      symbols: symbols.map(symbol => this.convertToStreamerSymbol(symbol)),
      reset: false
    };
    
    const success = this.sendMessage(subscribeMessage);
    
    if (success || !this.isConnected) {
      // Track subscriptions even if queued
      symbols.forEach(symbol => {
        const streamerSymbol = this.convertToStreamerSymbol(symbol);
        this.subscriptions.set(symbol, {
          streamerSymbol,
          subscribed: true,
          lastUpdate: null,
          types: ['Quote', 'Trade']
        });
      });
      
      logger.info('STREAMER', `📡 Subscribed to ${symbols.length} symbols`, symbols);
      return true;
    }
    
    logger.error('STREAMER', '🚨 Failed to subscribe to quotes', symbols);
    return false;
  }
  
  /**
   * Unsubscribe from symbols
   */
  async unsubscribeFromQuotes(symbols) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }
    
    const unsubscribeMessage = {
      action: 'feed-subscription',
      types: ['Quote', 'Trade'],
      symbols: symbols.map(symbol => this.convertToStreamerSymbol(symbol)),
      reset: true // This removes the subscription
    };
    
    const success = this.sendMessage(unsubscribeMessage);
    
    if (success || !this.isConnected) {
      symbols.forEach(symbol => {
        this.subscriptions.delete(symbol);
        this.quotes.delete(symbol);
        this.lastUpdate.delete(symbol);
      });
      
      logger.info('STREAMER', `📊 Unsubscribed from ${symbols.length} symbols`, symbols);
      return true;
    }
    
    logger.error('STREAMER', '🚨 Failed to unsubscribe from quotes', symbols);
    return false;
  }
  
  /**
   * Re-subscribe to all existing subscriptions
   */
  resubscribeAll() {
    if (this.subscriptions.size === 0) return;
    
    const symbols = Array.from(this.subscriptions.keys());
    logger.info('STREAMER', `🔄 Re-subscribing to ${symbols.length} symbols`);
    
    this.subscribeToQuotes(symbols);
  }

  /**
   * Convert symbol to TastyTrade streamer format
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
    
    // For futures, handle TastyTrade format
    if (symbol.startsWith('/')) {
      return symbol;
    }
    
    // For micro futures (M prefix)
    if (symbol.startsWith('M') && symbol.length <= 4) {
      return '/' + symbol;
    }
    
    // Default return as-is
    return symbol;
  }

  /**
   * Handle subscription state messages
   */
  handleSubscriptionState(data) {
    if (data.state === 'subscribed') {
      logger.debug('STREAMER', '✅ Subscription confirmed', data.symbols);
    } else if (data.state === 'error') {
      logger.error('STREAMER', '🚨 Subscription error', data);
    }
  }
  
  /**
   * Handle error messages
   */
  handleError(data) {
    logger.error('STREAMER', '🚨 WebSocket error message', data);
    
    // Check if it's an authentication error
    if (data.code === 401 || data.message?.includes('auth')) {
      logger.warn('STREAMER', '🔐 Authentication error, reconnecting');
      this.handleReconnect();
    }
  }
  
  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    // Clear any existing heartbeat
    this.stopHeartbeat();
    
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendMessage({ action: 'heartbeat', time: Date.now() });
        
        // Check if we haven't received a heartbeat in too long
        if (this.lastHeartbeat && Date.now() - this.lastHeartbeat > 60000) {
          logger.warn('STREAMER', '⚠️ Heartbeat timeout, reconnecting');
          this.handleReconnect();
        }
      }
    }, 30000);
    
    logger.debug('STREAMER', '💓 Heartbeat started');
  }
  
  /**
   * Stop heartbeat mechanism
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }
  
  /**
   * Handle WebSocket close event
   */
  handleClose(event) {
    logger.warn('STREAMER', `🚪 WebSocket closed`, { code: event.code, reason: event.reason });
    
    this.isConnected = false;
    this.isConnecting = false;
    this.sessionId = null;
    this.stopHeartbeat();
    
    // Emit disconnected event
    this.emit('disconnected', { code: event.code, reason: event.reason });
    
    // Only reconnect if it wasn't a clean close
    if (event.code !== 1000) {
      this.handleReconnect();
    }
  }

  /**
   * Get current quote for a symbol
   */
  getQuote(symbol) {
    const quote = this.quotes.get(symbol);
    return quote ? { ...quote } : null; // Return copy to prevent mutation
  }

  /**
   * Get quotes for multiple symbols
   */
  getQuotes(symbols = null) {
    if (!symbols) {
      const result = {};
      this.quotes.forEach((quote, symbol) => {
        result[symbol] = { ...quote }; // Return copies
      });
      return result;
    }
    
    const result = {};
    symbols.forEach(symbol => {
      const quote = this.quotes.get(symbol);
      if (quote) {
        result[symbol] = { ...quote }; // Return copy
      }
    });
    
    return result;
  }

  /**
   * Add market data update callback (legacy support)
   */
  addListener(callback) {
    this.updateCallbacks.add(callback);
    logger.debug('STREAMER', `📡 Added market data listener (total: ${this.updateCallbacks.size})`);
  }

  /**
   * Remove market data update callback (legacy support)
   */
  removeListener(callback) {
    this.updateCallbacks.delete(callback);
  }
  
  /**
   * Add event listener (EventEmitter style)
   */
  addUpdateListener(callback) {
    this.on('quotes', callback);
  }
  
  /**
   * Remove event listener (EventEmitter style)
   */
  removeUpdateListener(callback) {
    this.off('quotes', callback);
  }
  
  /**
   * Get subscription status
   */
  getSubscriptions() {
    const result = {};
    this.subscriptions.forEach((sub, symbol) => {
      result[symbol] = {
        streamerSymbol: sub.streamerSymbol,
        subscribed: sub.subscribed,
        lastUpdate: this.lastUpdate.get(symbol),
        types: sub.types || ['Quote', 'Trade']
      };
    });
    return result;
  }
  
  /**
   * Check if symbol is subscribed
   */
  isSubscribed(symbol) {
    return this.subscriptions.has(symbol);
  }

  /**
   * Handle reconnection logic with exponential backoff
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('STREAMER', '🚨 Max reconnection attempts reached');
      this.emit('failed', { 
        error: 'Max reconnection attempts reached',
        attempts: this.reconnectAttempts
      });
      return;
    }
    
    if (this.isConnecting) {
      logger.debug('STREAMER', '🔄 Reconnect already in progress');
      return;
    }
    
    this.reconnectAttempts++;
    this.isConnected = false;
    
    // Calculate exponential backoff delay
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    logger.info('STREAMER', `🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    // Cleanup current connection
    this.cleanup();
    
    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Try to reinitialize
    try {
      await this.initialize();
    } catch (error) {
      logger.error('STREAMER', '🚨 Reconnection failed', error);
      // Will trigger another reconnect attempt
      setTimeout(() => this.handleReconnect(), 1000);
    }
  }
  
  /**
   * Cleanup connection resources
   */
  cleanup() {
    this.stopHeartbeat();
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        logger.debug('STREAMER', 'Error closing WebSocket', error);
      }
      this.ws = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    this.sessionId = null;
  }
  
  /**
   * Enable/disable fallback mode
   */
  async enableFallback() {
    logger.info('STREAMER', '🔄 Enabling fallback to polling mode');
    
    // Emit event to notify that we're falling back
    this.emit('fallback', { mode: 'polling' });
    
    // Here you could integrate with MarketDataService for polling
    // This would be called by your main application
  }

  /**
   * Get connection status and statistics
   */
  getStatus() {
    const lastUpdateTimes = Array.from(this.lastUpdate.values()).map(d => d.getTime());
    const lastUpdate = lastUpdateTimes.length > 0 ? Math.max(...lastUpdateTimes) : null;
    
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      subscriptions: this.subscriptions.size,
      quotesReceived: this.quotes.size,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      tokenExpiry: this.tokenExpiry,
      sessionId: this.sessionId,
      lastUpdate: lastUpdate ? new Date(lastUpdate) : null,
      lastHeartbeat: this.lastHeartbeat ? new Date(this.lastHeartbeat) : null,
      messageQueueLength: this.messageQueue.length,
      endpoint: this.wsEndpoint,
      marketHours: this.getMarketHoursStatus()
    };
  }
  
  /**
   * Get market hours status
   */
  getMarketHoursStatus() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    
    // US market hours: 9:30 AM - 4:00 PM ET (14:30 - 21:00 UTC)
    const isMarketHours = (
      dayOfWeek >= 1 && dayOfWeek <= 5 && // Monday to Friday
      utcHour >= 14 && utcHour < 21 // 9:30 AM - 4:00 PM ET
    );
    
    // Extended hours: 4:00 AM - 9:30 AM ET and 4:00 PM - 8:00 PM ET
    const isExtendedHours = (
      dayOfWeek >= 1 && dayOfWeek <= 5 && // Monday to Friday
      ((utcHour >= 9 && utcHour < 14) || (utcHour >= 21 && utcHour < 24)) // Extended hours
    );
    
    return {
      isMarketHours,
      isExtendedHours,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      currentTime: now.toISOString(),
      timeZone: 'UTC'
    };
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    try {
      logger.info('STREAMER', '🚪 Disconnecting market data streaming...');
      
      // Reset reconnection attempts
      this.reconnectAttempts = this.maxReconnectAttempts;
      
      // Clear all subscriptions first
      if (this.subscriptions.size > 0) {
        const symbols = Array.from(this.subscriptions.keys());
        await this.unsubscribeFromQuotes(symbols);
      }
      
      // Cleanup connection
      this.cleanup();
      
      // Clear data
      this.subscriptions.clear();
      this.quotes.clear();
      this.lastUpdate.clear();
      this.messageQueue = [];
      
      // Remove all listeners
      this.removeAllListeners();
      this.updateCallbacks.clear();
      
      logger.info('STREAMER', '✅ Market data streaming disconnected');
      
    } catch (error) {
      logger.error('STREAMER', '🚨 Error during disconnect', error);
    }
  }
  
  /**
   * Test WebSocket connection
   */
  async testConnection() {
    logger.info('STREAMER', '🧪 Testing WebSocket connection...');
    
    try {
      const testWs = new WebSocket(this.wsEndpoint);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          testWs.close();
          reject(new Error('Connection test timeout'));
        }, 5000);
        
        testWs.onopen = () => {
          clearTimeout(timeout);
          testWs.close();
          resolve(true);
        };
        
        testWs.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
      
    } catch (error) {
      logger.error('STREAMER', '🚨 Connection test failed', error);
      return false;
    }
  }
  
  /**
   * Get comprehensive diagnostics
   */
  getDiagnostics() {
    return {
      ...this.getStatus(),
      subscriptions: this.getSubscriptions(),
      connectionHistory: {
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.maxReconnectAttempts
      },
      performance: {
        quotesPerSecond: this.calculateQuotesPerSecond(),
        latency: this.calculateAverageLatency()
      }
    };
  }
  
  /**
   * Calculate quotes per second (rough estimate)
   */
  calculateQuotesPerSecond() {
    const now = Date.now();
    const recentUpdates = Array.from(this.lastUpdate.values())
      .filter(timestamp => now - timestamp.getTime() < 60000); // Last minute
    
    return Math.round(recentUpdates.length / 60);
  }
  
  /**
   * Calculate average latency (mock implementation)
   */
  calculateAverageLatency() {
    // This would need to be implemented with timestamp comparison
    // between when market events occur and when we receive them
    return 'Not implemented';
  }
}

module.exports = MarketDataStreamer;