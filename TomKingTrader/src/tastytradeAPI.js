/**
 * TastyTrade API Integration Module
 * Complete OAuth2 authentication, market data streaming, and order management
 * Based on Tom King Trading Framework v17 specifications
 */

const MarketDataStreamer = require('./marketDataStreamer');
const OrderManager = require('./orderManager');

const DEBUG = process.env.NODE_ENV !== 'production';

// API Credentials (Store securely in production!)
const API_CREDENTIALS = {
  CLIENT_ID: 'bfca2bd1-b3f3-4941-b542-0267812f1b2f',
  CLIENT_SECRET: '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
  REFRESH_TOKEN: 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjdiMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw'
};

// Environment Configuration
const ENVIRONMENTS = {
  SANDBOX: {
    API_BASE: 'https://api.cert.tastyworks.com',
    STREAMER: 'wss://streamer.cert.tastyworks.com',
    DXLINK: 'wss://tasty-openapi-ws.dxfeed.com/realtime'
  },
  PRODUCTION: {
    API_BASE: 'https://api.tastyworks.com',
    STREAMER: 'wss://streamer.tastyworks.com',
    DXLINK: 'wss://tasty-openapi-ws.dxfeed.com/realtime'
  }
};

const CURRENT_ENV = ENVIRONMENTS.PRODUCTION;

/**
 * OAuth2 Token Manager
 * Handles token refresh and validation
 */
class TokenManager {
  constructor(refreshToken, clientSecret) {
    this.refreshToken = refreshToken;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.tokenExpiry = null;
  }
  
  async getValidToken() {
    const now = Date.now();
    // Refresh 1 minute early to avoid expiration
    if (!this.accessToken || now >= this.tokenExpiry) {
      console.log('🔄 Access token expired or missing, refreshing...');
      this.accessToken = await this.generateAccessToken();
      this.tokenExpiry = now + (14 * 60 * 1000); // 14 minutes (expires in 15 per API docs)
    } else {
      console.log('✅ Using cached access token');
    }
    return this.accessToken;
  }
  
  // Alias for compatibility
  async getValidAccessToken() {
    return this.getValidToken();
  }
  
  async generateAccessToken() {
    try {
      console.log('🔄 Generating new OAuth2 access token...');
      console.log('🔗 OAuth endpoint:', `${CURRENT_ENV.API_BASE}/oauth/token`);
      console.log('🔑 Refresh token:', this.refreshToken ? `${this.refreshToken.substring(0, 20)}...` : 'MISSING');
      console.log('🔐 Client secret:', this.clientSecret ? `${this.clientSecret.substring(0, 10)}...` : 'MISSING');
      
      const response = await fetch(`${CURRENT_ENV.API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TomKingFramework/17.0'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_secret: this.clientSecret
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      if (DEBUG) console.log('✅ Access token refreshed successfully');
      return data.access_token;
    } catch (error) {
      console.error('🚨 Token refresh failed:', error.message);
      throw error;
    }
  }
}

/**
 * API Error Handler with Progressive Backoff
 */
class APIFailureHandler {
  constructor() {
    this.failureCount = 0;
    this.lastFailure = null;
    this.fallbackMode = false;
    this.retryDelays = [1000, 5000, 15000, 30000]; // Progressive backoff in ms
  }
  
  async handleFailure(error, context) {
    this.failureCount++;
    this.lastFailure = Date.now();
    
    console.error(`🚨 API Failure #${this.failureCount}:`, {
      context,
      error: error.message,
      code: error.code,
      time: new Date().toISOString()
    });
    
    switch(error.code || error.status) {
      case 401: // Authentication failure
        return this.handleAuthFailure();
      case 429: // Rate limited
        return this.handleRateLimit();
      case 500: // Server error
      case 502: // Bad gateway
      case 503: // Service unavailable
        return this.handleServerError();
      case 'ENOTFOUND':
      case 'ETIMEDOUT':
      case 'ECONNREFUSED':
        return this.handleNetworkError();
      default:
        return this.handleUnknownError(error);
    }
  }
  
  async handleAuthFailure() {
    console.log('🔒 Authentication failed - switching to manual mode');
    return {
      action: 'SWITCH_TO_MANUAL',
      message: 'Authentication failed - switching to manual mode',
      instructions: 'Please re-enter credentials or use manual data entry'
    };
  }
  
  async handleRateLimit() {
    const waitTime = 60000; // 1 minute
    console.log(`⏱️ Rate limited - waiting ${waitTime/1000} seconds`);
    await new Promise(r => setTimeout(r, waitTime));
    return { action: 'RETRY' };
  }
  
  async handleServerError() {
    if (this.failureCount >= 3) {
      this.fallbackMode = true;
      console.log('🚨 Multiple server failures - activating emergency manual mode');
      return {
        action: 'EMERGENCY_MANUAL_MODE',
        message: 'TastyTrade API unavailable - emergency manual mode activated',
        instructions: 'Use manual data entry until service restored'
      };
    }
    const delay = this.retryDelays[Math.min(this.failureCount - 1, 3)];
    console.log(`🔄 Server error - retrying in ${delay/1000} seconds`);
    await new Promise(r => setTimeout(r, delay));
    return { action: 'RETRY' };
  }
  
  async handleNetworkError() {
    const delay = this.retryDelays[Math.min(this.failureCount - 1, 3)];
    console.log(`🌐 Network error - retrying in ${delay/1000} seconds`);
    await new Promise(r => setTimeout(r, delay));
    return { action: 'RETRY_WITH_BACKOFF' };
  }
  
  async handleUnknownError(error) {
    console.error('❓ Unknown error:', error);
    if (this.failureCount >= 5) {
      return {
        action: 'SWITCH_TO_MANUAL',
        message: 'Multiple failures detected - switching to manual mode'
      };
    }
    return { action: 'LOG_AND_CONTINUE' };
  }
  
  reset() {
    this.failureCount = 0;
    this.lastFailure = null;
    this.fallbackMode = false;
    if (DEBUG) console.log('✅ API failure handler reset');
  }
}

/**
 * Symbol Utilities for TastyTrade integration
 */
const SymbolUtils = {
  // Convert OCC symbol to TastyTrade streamer format
  occToStreamerSymbol(occSymbol) {
    try {
      const symbol = occSymbol.substring(0, 6).trim();
      const year = occSymbol.substring(6, 8);
      const month = occSymbol.substring(8, 10);
      const day = occSymbol.substring(10, 12);
      const type = occSymbol.substring(12, 13);
      const strike = parseInt(occSymbol.substring(13)) / 1000;
      
      return `.${symbol}${year}${month}${day}${type}${strike}`;
    } catch (error) {
      console.error('Symbol conversion error:', error);
      return occSymbol;
    }
  },
  
  // Get next Friday for expiration
  getNextFriday(date = new Date()) {
    const result = new Date(date);
    const day = result.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilFriday);
    return result;
  },
  
  // Get 45 DTE expiration date
  get45DTEExpiration(date = new Date()) {
    const result = new Date(date);
    result.setDate(result.getDate() + 45);
    return this.getNextFriday(result);
  },
  
  // Get 90 DTE expiration date  
  get90DTEExpiration(date = new Date()) {
    const result = new Date(date);
    result.setDate(result.getDate() + 90);
    return this.getNextFriday(result);
  },
  
  // Format expiration date for API
  formatExpiration(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  // Calculate DTE from expiration string
  calculateDTE(expiration) {
    const exp = new Date(expiration);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
};

/**
 * Main TastyTrade API Client
 */
class TastyTradeAPI {
  constructor(clientSecret = API_CREDENTIALS.CLIENT_SECRET, 
              refreshToken = API_CREDENTIALS.REFRESH_TOKEN, 
              environment = 'production') {
    this.tokenManager = new TokenManager(refreshToken, clientSecret);
    // Map development to sandbox, production to production
    this.env = environment.toLowerCase() === 'development' ? 'SANDBOX' : 'PRODUCTION';
    this.baseURL = ENVIRONMENTS[this.env].API_BASE;
    this.accountNumber = null;
    this.positions = [];
    this.balance = null;
    this.marketDataCache = new Map();
    this.cacheTTL = 5000; // 5 seconds
    this.errorHandler = new APIFailureHandler();
    
    // Initialize real-time market data streamer
    this.marketDataStreamer = new MarketDataStreamer(this);
    this.isStreamingEnabled = false;
    
    // Initialize order manager
    this.orderManager = new OrderManager(this);
    this.ordersEnabled = false;
  }
  
  async initialize() {
    try {
      console.log('🚀 Initializing TastyTrade API connection...');
      console.log('📊 Environment:', this.env);
      console.log('🔗 Base URL:', this.baseURL);
      
      // First ensure we have valid tokens
      const token = await this.tokenManager.getValidAccessToken();
      console.log('✅ Access token obtained');
      
      // Get customer info first
      console.log('📝 Fetching customer info...');
      const customerInfo = await this.request('/customers/me');
      console.log('👤 Customer ID:', customerInfo?.data?.id);
      
      // Get account info - API returns array directly, not data.items
      console.log('📝 Fetching accounts...');
      const accountsResponse = await this.request('/customers/me/accounts');
      console.log('📊 Accounts response type:', typeof accountsResponse);
      console.log('📊 Accounts response:', JSON.stringify(accountsResponse, null, 2).substring(0, 500));
      
      // The response structure can vary: direct array, data array, or data.items array
      let accounts = accountsResponse;
      if (accountsResponse?.data?.items) {
        accounts = accountsResponse.data.items;
      } else if (accountsResponse?.data && Array.isArray(accountsResponse.data)) {
        accounts = accountsResponse.data;
      }
      
      // Extract account number from first account
      if (Array.isArray(accounts) && accounts.length > 0) {
        const firstAccount = accounts[0];
        // Account number is in account['account-number'] per API docs
        if (firstAccount.account && firstAccount.account['account-number']) {
          this.accountNumber = firstAccount.account['account-number'];
        } else if (firstAccount['account-number']) {
          this.accountNumber = firstAccount['account-number'];
        }
      }
      
      if (!this.accountNumber) {
        console.error('❌ Could not extract account number from:', accounts);
        throw new Error('Failed to get account number from API');
      }
      
      console.log(`✅ Connected to account: ${this.accountNumber}`);
      
      // Initialize order manager with account number
      this.orderManager.initialize(this.accountNumber);
      this.ordersEnabled = true;
      
      // Load positions and balance with the valid account number
      await this.refreshPositions();
      await this.refreshBalance();
      
      console.log('✅ API initialization complete');
      return true;
    } catch (error) {
      console.error('🚨 API initialization failed:', error);
      const response = await this.errorHandler.handleFailure(error, 'initialization');
      
      if (response.action === 'SWITCH_TO_MANUAL') {
        throw new Error('API_FALLBACK_TO_MANUAL');
      }
      throw error;
    }
  }
  
  async request(endpoint, options = {}) {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const token = await this.tokenManager.getValidToken();
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'TomKingFramework/17.0',
            'Content-Type': 'application/json',
            ...options.headers
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
          error.status = response.status;
          error.code = response.status;
          throw error;
        }
        
        // Reset error handler on success
        this.errorHandler.reset();
        return response.json();
        
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        
        const response = await this.errorHandler.handleFailure(error, endpoint);
        if (response.action === 'SWITCH_TO_MANUAL') {
          throw new Error('API_FALLBACK_TO_MANUAL');
        }
        
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000 * retryCount));
      }
    }
  }
  
  async refreshPositions() {
    try {
      const data = await this.request(`/accounts/${this.accountNumber}/positions`);
      this.positions = data.data.items.filter(pos => 
        pos.quantity !== 0 && pos.quantity !== '0'
      );
      if (DEBUG) console.log(`📊 Loaded ${this.positions.length} positions`);
      return this.positions;
    } catch (error) {
      console.error('Position refresh failed:', error);
      return this.positions;
    }
  }
  
  async refreshBalance() {
    try {
      const data = await this.request(`/accounts/${this.accountNumber}/balances`);
      const balances = data.data;
      
      this.balance = {
        netLiq: parseFloat(balances['net-liquidating-value'] || 0),
        buyingPower: parseFloat(balances['derivative-buying-power'] || 0),
        cashBalance: parseFloat(balances['cash-balance'] || 0),
        bpUsed: parseFloat(balances['derivative-buying-power-used'] || 0),
        totalBP: parseFloat(balances['derivative-buying-power'] || 0) + 
                 parseFloat(balances['derivative-buying-power-used'] || 0),
        dayTradeBuyingPower: parseFloat(balances['day-trade-buying-power'] || 0),
        maintenanceReq: parseFloat(balances['maintenance-requirement'] || 0)
      };
      
      // Calculate BP usage percentage
      this.balance.bpUsedPercent = this.balance.totalBP > 0 ? 
        Math.round((this.balance.bpUsed / this.balance.totalBP) * 100) : 0;
      
      if (DEBUG) console.log(`💰 Account balance: £${this.balance.netLiq.toLocaleString()}, BP: ${this.balance.bpUsedPercent}%`);
      return this.balance;
    } catch (error) {
      console.error('Balance refresh failed:', error);
      return this.balance;
    }
  }
  
  async getQuotes(symbols) {
    try {
      const results = {};
      
      // Process each symbol individually to handle different types properly
      for (const symbol of symbols) {
        const quote = await this.getSingleQuote(symbol);
        if (quote) {
          results[symbol] = quote;
        }
      }
      
      return results;
    } catch (error) {
      console.error(`Quote fetch failed for ${symbols}:`, error);
      // Return empty object instead of throwing
      return {};
    }
  }
  
  async getSingleQuote(symbol) {
    try {
      // Use the working market-data/by-type endpoint directly
      const params = new URLSearchParams();
      
      if (symbol.startsWith('/')) {
        // For futures, remove slash and use futures contract mapping
        const futuresSymbol = this.mapFuturesSymbol(symbol);
        params.append('future', futuresSymbol);
      } else if (symbol === 'VIX' || symbol === 'SPX' || symbol === 'DJI') {
        params.append('index', symbol);
      } else {
        params.append('equity', symbol);
      }
      
      const response = await this.request(`/market-data/by-type?${params}`);
      
      // Extract the item from the response
      if (response?.data?.items && response.data.items.length > 0) {
        return response.data.items[0];
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get quote for ${symbol}:`, error.message);
      return null;
    }
  }
  
  mapFuturesSymbol(symbol) {
    // Map framework symbols to TastyTrade contract symbols with proper month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-based
    const currentYear = now.getFullYear();
    
    // For futures, we typically want the next quarterly expiration or next month
    let targetMonth, targetYear;
    
    // For now, let's try the most active contract months
    const monthCodes = ['', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
    
    // Quarterly contracts (Mar, Jun, Sep, Dec) for major indices
    const quarterlyMonths = [3, 6, 9, 12];
    const nextQuarterly = quarterlyMonths.find(m => m > currentMonth) || quarterlyMonths[0];
    const quarterlyYear = nextQuarterly > currentMonth ? currentYear : currentYear + 1;
    
    // Monthly contracts for commodities
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const monthlyYear = nextMonth === 1 ? currentYear + 1 : currentYear;
    
    const mapping = {
      '/ES': `ES${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // E-mini S&P 500 (quarterly)
      '/MES': `MES${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // Micro E-mini S&P 500
      '/NQ': `NQ${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // E-mini Nasdaq (quarterly)
      '/MNQ': `MNQ${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // Micro E-mini Nasdaq
      '/CL': `CL${monthCodes[nextMonth]}${String(monthlyYear).slice(-1)}`, // Crude Oil (monthly)
      '/MCL': `MCL${monthCodes[nextMonth]}${String(monthlyYear).slice(-1)}`, // Micro Crude Oil
      '/GC': `GC${monthCodes[nextMonth]}${String(monthlyYear).slice(-1)}`, // Gold (monthly)
      '/MGC': `MGC${monthCodes[nextMonth]}${String(monthlyYear).slice(-1)}`, // Micro Gold
      '/ZN': `ZN${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // 10-Year Note (quarterly)
      '/ZB': `ZB${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // 30-Year Bond (quarterly)
      '/6E': `6E${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // Euro FX (quarterly)
      '/M6E': `M6E${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // Micro Euro FX
      '/6B': `6B${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // British Pound (quarterly)
      '/M6B': `M6B${monthCodes[nextQuarterly]}${String(quarterlyYear).slice(-1)}`, // Micro British Pound
    };
    
    const mapped = mapping[symbol] || symbol.substring(1);
    if (DEBUG) console.log(`🔗 Mapped ${symbol} -> ${mapped}`);
    return mapped;
  }
  
  async getOptionChain(symbol, expiration = null) {
    try {
      let endpoint = `/option-chains/${symbol}/nested`;
      if (expiration) {
        endpoint += `?expiration=${expiration}`;
      }
      
      const chain = await this.request(endpoint);
      return this.parseOptionChain(chain);
    } catch (error) {
      console.error(`Option chain fetch failed for ${symbol}:`, error);
      return [];
    }
  }
  
  parseOptionChain(chainData) {
    try {
      if (!chainData.data || !chainData.data.items || !chainData.data.items[0]) {
        return [];
      }
      
      const expirations = chainData.data.items[0].expirations;
      return expirations.map(exp => ({
        date: exp['expiration-date'],
        dte: exp['days-to-expiration'],
        strikes: exp.strikes.map(strike => ({
          strike: parseFloat(strike['strike-price']),
          call: {
            bid: parseFloat(strike.call?.bid || 0),
            ask: parseFloat(strike.call?.ask || 0),
            last: parseFloat(strike.call?.last || 0),
            delta: parseFloat(strike.call?.delta || 0),
            gamma: parseFloat(strike.call?.gamma || 0),
            theta: parseFloat(strike.call?.theta || 0),
            vega: parseFloat(strike.call?.vega || 0),
            iv: parseFloat(strike.call?.['implied-volatility'] || 0)
          },
          put: {
            bid: parseFloat(strike.put?.bid || 0),
            ask: parseFloat(strike.put?.ask || 0),
            last: parseFloat(strike.put?.last || 0),
            delta: parseFloat(strike.put?.delta || 0),
            gamma: parseFloat(strike.put?.gamma || 0),
            theta: parseFloat(strike.put?.theta || 0),
            vega: parseFloat(strike.put?.vega || 0),
            iv: parseFloat(strike.put?.['implied-volatility'] || 0)
          },
          callStreamer: strike['call-streamer-symbol'],
          putStreamer: strike['put-streamer-symbol']
        }))
      }));
    } catch (error) {
      console.error('Option chain parse error:', error);
      return [];
    }
  }
  
  // Format positions for framework compatibility
  formatPositionsForFramework() {
    try {
      if (!this.positions || this.positions.length === 0) {
        return 'none';
      }
      
      return this.positions.map(pos => {
        const ticker = pos.symbol.replace('/', '');
        const strategy = this.identifyStrategy(pos);
        const dte = pos['days-to-expiration'] || 0;
        const entry = pos['average-open-price'] || 0;
        const pl = pos['unrealized-day-gain-percent'] || 0;
        
        return `${ticker} ${strategy} (${dte} DTE, ${entry}, ${pl >= 0 ? '+' : ''}${pl}%)`;
      }).join(', ');
    } catch (error) {
      console.error('Position formatting error:', error);
      return 'none';
    }
  }
  
  identifyStrategy(position) {
    try {
      const dte = position['days-to-expiration'] || 0;
      const instrumentType = position['instrument-type'];
      
      if (dte === 0) return '0DTE';
      if (dte > 100 && dte < 130) return 'LT112';
      if (dte > 80 && dte < 100) return 'STRANGLE';
      if (dte > 300) return 'LEAP';
      if (position['underlying-symbol'] && instrumentType === 'Equity Option') return 'IPMCC';
      if (instrumentType === 'Future') return 'FUTURE';
      
      return 'UNKNOWN';
    } catch (error) {
      console.error('Strategy identification error:', error);
      return 'UNKNOWN';
    }
  }
  
  async getAccountStatus() {
    try {
      await this.refreshBalance();
      const status = await this.request(`/accounts/${this.accountNumber}/trading-status`);
      
      return {
        netLiq: this.balance.netLiq,
        buyingPower: this.balance.buyingPower,
        bpUsedPercent: this.balance.bpUsedPercent,
        cashBalance: this.balance.cashBalance,
        positions: this.formatPositionsForFramework(),
        canTrade: status.data['can-trade'],
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
        dateStr: new Date().toLocaleDateString('en-US'),
        timeStr: new Date().toLocaleTimeString('en-US'),
        vixLevel: null, // Will be populated by market data collection
        portfolioMargin: status.data['enhanced-fraud-safeguards-enabled'] || false,
        monthPL: 0 // Calculated separately
      };
    } catch (error) {
      console.error('Account status error:', error);
      throw error;
    }
  }

  /**
   * Enable real-time market data streaming
   */
  async enableStreaming() {
    try {
      if (this.isStreamingEnabled) {
        if (DEBUG) console.log('📡 Streaming already enabled');
        return true;
      }

      if (DEBUG) console.log('📡 Enabling real-time market data streaming...');
      
      const success = await this.marketDataStreamer.initialize();
      
      if (success) {
        this.isStreamingEnabled = true;
        
        // Set up market data listener to update cache
        this.marketDataStreamer.addListener((event, data) => {
          if (event === 'quotes') {
            // Update market data cache with real-time quotes
            Object.entries(data.updates).forEach(([symbol, quote]) => {
              this.marketDataCache.set(symbol, {
                ...quote,
                cached: false, // Mark as live data
                timestamp: data.timestamp
              });
            });
          }
        });
        
        if (DEBUG) console.log('✅ Real-time streaming enabled');
        return true;
      } else {
        console.error('🚨 Failed to enable streaming');
        return false;
      }
      
    } catch (error) {
      console.error('🚨 Error enabling streaming:', error);
      return false;
    }
  }

  /**
   * Disable real-time market data streaming
   */
  async disableStreaming() {
    try {
      if (!this.isStreamingEnabled) {
        return true;
      }

      await this.marketDataStreamer.disconnect();
      this.isStreamingEnabled = false;
      
      if (DEBUG) console.log('📡 Real-time streaming disabled');
      return true;
      
    } catch (error) {
      console.error('🚨 Error disabling streaming:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time quotes for specific symbols
   */
  async subscribeToQuotes(symbols) {
    if (!this.isStreamingEnabled) {
      console.warn('⚠️ Streaming not enabled - call enableStreaming() first');
      return false;
    }
    
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    return await this.marketDataStreamer.subscribeToQuotes(symbolArray);
  }

  /**
   * Get real-time quote for a symbol (streaming or cached)
   */
  getRealtimeQuote(symbol) {
    if (this.isStreamingEnabled) {
      // Try to get live quote first
      const liveQuote = this.marketDataStreamer.getQuote(symbol);
      if (liveQuote) {
        return { ...liveQuote, source: 'live' };
      }
    }
    
    // Fall back to cached data
    const cachedQuote = this.marketDataCache.get(symbol);
    if (cachedQuote) {
      return { ...cachedQuote, source: 'cached' };
    }
    
    return null;
  }

  /**
   * Get multiple real-time quotes
   */
  getRealtimeQuotes(symbols) {
    const result = {};
    const symbolArray = Array.isArray(symbols) ? symbols : [symbols];
    
    symbolArray.forEach(symbol => {
      const quote = this.getRealtimeQuote(symbol);
      if (quote) {
        result[symbol] = quote;
      }
    });
    
    return result;
  }

  /**
   * Get streaming status and statistics
   */
  getStreamingStatus() {
    return {
      enabled: this.isStreamingEnabled,
      ...this.marketDataStreamer.getStatus()
    };
  }
}

/**
 * Market Data Collector Class
 * Builds searchedData structure for framework integration
 */
class MarketDataCollector {
  constructor(api) {
    this.api = api;
  }
  
  async buildSearchedData() {
    try {
      if (DEBUG) console.log('🔄 Collecting market data from TastyTrade API...');
      
      const searchedData = {
        timestamp: new Date().toISOString(),
        source: 'TastyTrade_API',
        
        // Core market data (always required)
        ES: await this.getESData(),
        SPY: await this.getSPYData(), 
        VIX: await this.getVIXData(),
        DXY: await this.getDXYData(),
        
        // Time data
        TIME: {
          currentEST: new Date().toLocaleTimeString('en-US', { 
            timeZone: 'America/New_York',
            hour12: true 
          }),
          currentUK: new Date().toLocaleTimeString('en-GB', { 
            timeZone: 'Europe/London',
            hour12: false 
          }),
          marketStatus: await this.getMarketStatus()
        }
      };
      
      // Add phase-specific tickers based on account size
      const additionalTickers = await this.getPhaseSpecificTickers();
      for (const [ticker, data] of Object.entries(additionalTickers)) {
        searchedData[ticker] = data;
      }
      
      if (DEBUG) console.log(`✅ Collected data for ${Object.keys(searchedData).length - 2} instruments`);
      return searchedData;
      
    } catch (error) {
      console.error('🚨 Market data collection failed:', error);
      throw error;
    }
  }
  
  async getESData() {
    try {
      const quotes = await this.api.getQuotes(['/ES']);
      if (!quotes['/ES']) {
        throw new Error('ES quote not available');
      }
      
      const es = quotes['/ES'];
      const currentPrice = parseFloat(es.last || es.mark || es.close || 5450);
      const openPrice = parseFloat(es.open || currentPrice);
      const prevClose = parseFloat(es['prev-close'] || es.close || currentPrice);
      
      if (DEBUG) console.log(`✅ ES: ${currentPrice}, Open: ${openPrice}, Prev: ${prevClose}`);
      
      // Get option chain for strikes
      const optionChain = await this.api.getOptionChain('ES');
      const strikes = this.extractOptionStrikes(optionChain, currentPrice);
      
      return {
        currentPrice,
        openPrice,
        previousClose: prevClose,
        dayHigh: parseFloat(es['day-high-price'] || es.high || currentPrice * 1.01),
        dayLow: parseFloat(es['day-low-price'] || es.low || currentPrice * 0.99),
        dayChange: parseFloat((currentPrice - openPrice).toFixed(2)),
        dayChangePercent: parseFloat(((currentPrice - openPrice) / openPrice * 100).toFixed(2)),
        bid: parseFloat(es.bid || currentPrice * 0.999),
        ask: parseFloat(es.ask || currentPrice * 1.001),
        volume: parseInt(es.volume || 0),
        high5d: parseFloat(es['5-day-high'] || es.high || currentPrice * 1.02),
        low5d: parseFloat(es['5-day-low'] || es.low || currentPrice * 0.98),
        high20d: parseFloat(es['20-day-high'] || es.high || currentPrice * 1.05),
        low20d: parseFloat(es['20-day-low'] || es.low || currentPrice * 0.95),
        atr: parseFloat(es['average-true-range'] || currentPrice * 0.015),
        rsi: parseFloat(es['relative-strength-index'] || 50),
        ema8: parseFloat(es['8-day-ema'] || currentPrice * 0.998),
        ema21: parseFloat(es['21-day-ema'] || currentPrice * 0.997),
        vwap: parseFloat(es.vwap || currentPrice),
        iv: parseFloat(es['implied-volatility'] || 15),
        ivRank: parseFloat(es['iv-rank'] || 25),
        ivPercentile: parseFloat(es['iv-percentile'] || 30),
        strikes
      };
    } catch (error) {
      console.error('ES data collection failed:', error);
      return this.getDefaultESData();
    }
  }
  
  async getSPYData() {
    try {
      const quotes = await this.api.getQuotes(['SPY']);
      if (!quotes.SPY) {
        throw new Error('SPY quote not available');
      }
      
      const spy = quotes.SPY;
      const currentPrice = parseFloat(spy.last || spy.mark || spy.close || 450);
      const openPrice = parseFloat(spy.open || currentPrice);
      const prevClose = parseFloat(spy['prev-close'] || spy.close || currentPrice);
      
      if (DEBUG) console.log(`✅ SPY: ${currentPrice}, Open: ${openPrice}, Prev: ${prevClose}`);
      
      return {
        currentPrice,
        openPrice,
        dayHigh: parseFloat(spy['day-high-price'] || spy.high || currentPrice * 1.01),
        dayLow: parseFloat(spy['day-low-price'] || spy.low || currentPrice * 0.99),
        dayChange: parseFloat((currentPrice - openPrice).toFixed(2)),
        dayChangePercent: parseFloat(((currentPrice - openPrice) / openPrice * 100).toFixed(2)),
        bid: parseFloat(spy.bid || currentPrice * 0.999),
        ask: parseFloat(spy.ask || currentPrice * 1.001),
        volume: parseInt(spy.volume || 0),
        high20d: parseFloat(spy['20-day-high'] || spy.high || currentPrice * 1.05),
        low20d: parseFloat(spy['20-day-low'] || spy.low || currentPrice * 0.95),
        atr: parseFloat(spy['average-true-range'] || currentPrice * 0.01),
        rsi: parseFloat(spy['relative-strength-index'] || 50),
        ema8: parseFloat(spy['8-day-ema'] || currentPrice * 0.998),
        ema21: parseFloat(spy['21-day-ema'] || currentPrice * 0.997),
        vwap: parseFloat(spy.vwap || currentPrice),
        ivRank: parseFloat(spy['iv-rank'] || 35),
        ivPercentile: parseFloat(spy['iv-percentile'] || 42)
      };
    } catch (error) {
      console.error('SPY data collection failed:', error);
      return { currentPrice: 450, error: 'Data unavailable' };
    }
  }
  
  async getVIXData() {
    try {
      const quotes = await this.api.getQuotes(['VIX']);
      if (!quotes.VIX) {
        throw new Error('VIX quote not available');
      }
      
      const vix = quotes.VIX;
      const currentLevel = parseFloat(vix.last || vix.mark || vix.close || 16);
      const prevClose = parseFloat(vix['prev-close'] || vix.close || currentLevel);
      const dayHigh = parseFloat(vix['day-high-price'] || vix.high || currentLevel * 1.02);
      const dayLow = parseFloat(vix['day-low-price'] || vix.low || currentLevel * 0.98);
      
      if (DEBUG) console.log(`✅ VIX: ${currentLevel}, Prev: ${prevClose}, High: ${dayHigh}, Low: ${dayLow}`);
      
      return {
        currentLevel,
        dayChange: parseFloat((currentLevel - prevClose).toFixed(2)),
        dayChangePercent: parseFloat(((currentLevel - prevClose) / prevClose * 100).toFixed(2)),
        dayHigh,
        dayLow,
        avg20d: parseFloat(vix['20-day-average'] || currentLevel),
        trend: currentLevel > prevClose ? 'RISING' : 'FALLING',
        regime: this.getVIXRegime(currentLevel)
      };
    } catch (error) {
      console.error('VIX data collection failed:', error);
      return { currentLevel: 16, error: 'Data unavailable', regime: 'NORMAL' };
    }
  }
  
  async getDXYData() {
    try {
      const quotes = await this.api.getQuotes(['DXY']);
      if (!quotes.DXY) {
        return { currentLevel: 103, trend: 'UNKNOWN', error: 'Data unavailable' };
      }
      
      const dxy = quotes.DXY;
      
      return {
        currentLevel: parseFloat(dxy.last),
        dayChange: parseFloat(dxy.last) - parseFloat(dxy.open),
        dayChangePercent: ((parseFloat(dxy.last) - parseFloat(dxy.open)) / parseFloat(dxy.open) * 100).toFixed(2),
        trend: parseFloat(dxy.last) > parseFloat(dxy.open) ? 'STRENGTHENING' : 'WEAKENING'
      };
    } catch (error) {
      console.error('DXY data collection failed:', error);
      return { currentLevel: 103, trend: 'UNKNOWN', error: 'Data unavailable' };
    }
  }
  
  extractOptionStrikes(optionChain, currentPrice) {
    try {
      if (!optionChain || optionChain.length === 0) {
        return null;
      }
      
      // Find 90 DTE expiration (closest to 90 days)
      const target90DTE = optionChain.find(exp => 
        Math.abs(exp.dte - 90) <= 7
      ) || optionChain[0];
      
      if (!target90DTE || !target90DTE.strikes) {
        return null;
      }
      
      // Find strikes closest to 5-delta
      const call5Delta = target90DTE.strikes.find(s => 
        s.call.delta > 0 && s.call.delta <= 0.10 && s.strike > currentPrice
      );
      
      const put5Delta = target90DTE.strikes.find(s => 
        s.put.delta < 0 && s.put.delta >= -0.10 && s.strike < currentPrice
      );
      
      return {
        expiration: target90DTE.date,
        dte: target90DTE.dte,
        atmStrike: target90DTE.strikes.find(s => 
          Math.abs(s.strike - currentPrice) < 50
        )?.strike || currentPrice,
        call90DTE: call5Delta ? {
          strike: call5Delta.strike,
          bid: call5Delta.call.bid,
          ask: call5Delta.call.ask,
          delta: call5Delta.call.delta,
          iv: call5Delta.call.iv
        } : null,
        put90DTE: put5Delta ? {
          strike: put5Delta.strike,
          bid: put5Delta.put.bid,
          ask: put5Delta.put.ask,
          delta: put5Delta.put.delta,
          iv: put5Delta.put.iv
        } : null
      };
    } catch (error) {
      console.error('Strike extraction error:', error);
      return null;
    }
  }
  
  getVIXRegime(vixLevel) {
    if (vixLevel < 12) return 'EXTREMELY_LOW';
    if (vixLevel < 16) return 'LOW';
    if (vixLevel < 20) return 'NORMAL';
    if (vixLevel < 25) return 'ELEVATED';
    if (vixLevel < 30) return 'HIGH';
    return 'EXTREME';
  }
  
  async getPhaseSpecificTickers() {
    // Phase-based ticker collection
    const accountBalance = this.api.balance?.netLiq || 35000;
    let phase = 1;
    
    if (accountBalance >= 75000) phase = 4;
    else if (accountBalance >= 60000) phase = 3;
    else if (accountBalance >= 40000) phase = 2;
    
    const phaseTickerMap = {
      1: ['/MCL', '/MGC', 'GLD', 'TLT', 'SLV'],
      2: ['/MES', '/MNQ', '/MCL', '/MGC', 'GLD', 'TLT', 'SLV', 'QQQ'],
      3: ['/ES', '/NQ', '/CL', '/GC', 'GLD', 'TLT', 'SLV', 'QQQ', 'IWM'],
      4: ['/ES', '/NQ', '/CL', '/GC', '/ZN', '/ZB', 'GLD', 'TLT', 'SLV', 'QQQ', 'IWM']
    };
    
    const tickersToFetch = phaseTickerMap[phase] || phaseTickerMap[1];
    const tickers = {};
    
    try {
      const quotes = await this.api.getQuotes(tickersToFetch);
      
      Object.entries(quotes).forEach(([symbol, item]) => {
        if (!item) return;
        
        const ticker = symbol.replace('/', '');
        const currentPrice = parseFloat(item.last || item.mark || item.close || 0);
        const openPrice = parseFloat(item.open || currentPrice);
        
        if (currentPrice > 0) {
          tickers[ticker] = {
            currentPrice,
            openPrice,
            dayChange: parseFloat((currentPrice - openPrice).toFixed(2)),
            dayChangePercent: parseFloat(((currentPrice - openPrice) / openPrice * 100).toFixed(2)),
            bid: parseFloat(item.bid || currentPrice * 0.999),
            ask: parseFloat(item.ask || currentPrice * 1.001),
            volume: parseInt(item.volume || 0),
            high: parseFloat(item['day-high-price'] || item.high || currentPrice * 1.01),
            low: parseFloat(item['day-low-price'] || item.low || currentPrice * 0.99),
            iv: parseFloat(item['implied-volatility'] || this.getDefaultIV(ticker)),
            ivRank: parseFloat(item['iv-rank'] || Math.random() * 100),
            ivPercentile: parseFloat(item['iv-percentile'] || Math.random() * 100)
          };
          
          if (DEBUG) console.log(`✅ ${ticker}: $${currentPrice}, IV: ${tickers[ticker].iv}%`);
        }
      });
    } catch (error) {
      console.warn('Additional tickers collection failed:', error);
    }
    
    return tickers;
  }
  
  getDefaultIV(ticker) {
    const defaultIVs = {
      'MCL': 35, 'MGC': 18, 'GLD': 15, 'TLT': 12, 'SLV': 28,
      'MES': 14, 'MNQ': 18, 'QQQ': 20, 'ES': 14, 'NQ': 18,
      'CL': 35, 'GC': 18, 'ZN': 8, 'ZB': 10, 'IWM': 22
    };
    return defaultIVs[ticker] || 20;
  }
  
  getDefaultESData() {
    return {
      currentPrice: 5400,
      openPrice: 5395,
      previousClose: 5390,
      error: 'Using default data - API unavailable',
      strikes: null
    };
  }
  
  async getMarketStatus() {
    try {
      const now = new Date();
      const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hour = nyTime.getHours();
      const day = nyTime.getDay();
      
      // Weekend
      if (day === 0 || day === 6) return 'CLOSED_WEEKEND';
      
      // Market hours (9:30 AM - 4:00 PM ET)
      if (hour >= 9 && hour < 16) {
        if (hour === 9 && nyTime.getMinutes() < 30) return 'PRE_MARKET';
        return 'OPEN';
      }
      
      // Pre-market (4:00 AM - 9:30 AM ET)
      if (hour >= 4 && hour < 9) return 'PRE_MARKET';
      if (hour === 9 && nyTime.getMinutes() < 30) return 'PRE_MARKET';
      
      // After-hours (4:00 PM - 8:00 PM ET)
      if (hour >= 16 && hour < 20) return 'AFTER_HOURS';
      
      return 'CLOSED';
    } catch (error) {
      return 'UNKNOWN';
    }
  }
}

/**
 * Order Builder (Preparation Only - No Auto-Submit)
 */
class OrderBuilder {
  constructor(api) {
    this.api = api;
    this.orders = [];
  }
  
  // Prepare strangle order (90 DTE)
  prepareStrangleOrder(ticker, putStrike, callStrike, expiration, contracts = 1) {
    const order = {
      orderType: 'STRANGLE',
      ticker,
      expiration,
      contracts,
      legs: [
        {
          action: 'SELL_TO_OPEN',
          instrument: 'PUT',
          strike: putStrike,
          quantity: contracts
        },
        {
          action: 'SELL_TO_OPEN', 
          instrument: 'CALL',
          strike: callStrike,
          quantity: contracts
        }
      ],
      orderClass: 'SPREAD',
      priceType: 'NET_CREDIT',
      timeInForce: 'DAY',
      status: 'PREPARED_NOT_SUBMITTED'
    };
    
    this.orders.push(order);
    if (DEBUG) console.log(`📋 Strangle order prepared: ${ticker} ${putStrike}P/${callStrike}C`);
    return order;
  }
  
  // Prepare 0DTE spread order
  prepare0DTEOrder(ticker, spreadType, shortStrike, longStrike, contracts = 1) {
    const order = {
      orderType: '0DTE_SPREAD',
      ticker,
      spreadType, // 'CALL_SPREAD' or 'PUT_SPREAD'
      contracts,
      expiration: new Date().toISOString().split('T')[0], // Today
      legs: [
        {
          action: 'SELL_TO_OPEN',
          instrument: spreadType === 'CALL_SPREAD' ? 'CALL' : 'PUT',
          strike: shortStrike,
          quantity: contracts
        },
        {
          action: 'BUY_TO_OPEN',
          instrument: spreadType === 'CALL_SPREAD' ? 'CALL' : 'PUT', 
          strike: longStrike,
          quantity: contracts
        }
      ],
      orderClass: 'SPREAD',
      priceType: 'NET_CREDIT',
      timeInForce: 'DAY',
      status: 'PREPARED_NOT_SUBMITTED',
      warning: '⚠️ 0DTE ORDER - Review carefully before submission'
    };
    
    this.orders.push(order);
    if (DEBUG) console.log(`📋 0DTE ${spreadType} prepared: ${shortStrike}/${longStrike}`);
    return order;
  }
  
  // Get all prepared orders
  getPreparedOrders() {
    return this.orders.filter(order => order.status === 'PREPARED_NOT_SUBMITTED');
  }
}

/**
 * Testing and validation functions
 */
async function testAPIConnection() {
  console.log('🧪 Testing API connection with stored credentials...');
  
  try {
    const api = new TastyTradeAPI();
    
    console.log('⏳ Initializing API connection...');
    await api.initialize();
    
    console.log('📊 Testing market data collection...');
    const collector = new MarketDataCollector(api);
    const searchedData = await collector.buildSearchedData();
    
    console.log('💰 Testing account status...');
    const accountStatus = await api.getAccountStatus();
    
    console.log('\n✅ API test completed successfully!');
    console.log(`Account: £${accountStatus.netLiq.toLocaleString()}`);
    console.log(`BP Usage: ${accountStatus.bpUsedPercent}%`);
    console.log(`Positions: ${accountStatus.positions}`);
    
    return { success: true, api, searchedData, accountStatus };
    
  } catch (error) {
    console.error('❌ API test failed:', error);
    
    if (error.message === 'API_FALLBACK_TO_MANUAL') {
      console.log('🔄 Falling back to manual mode - load search parsing module');
    }
    
    return { success: false, error: error.message };
  }
}

// Export all classes and utilities
module.exports = {
  TastyTradeAPI,
  MarketDataStreamer,
  MarketDataCollector,
  OrderBuilder,
  TokenManager,
  APIFailureHandler,
  SymbolUtils,
  testAPIConnection,
  ENVIRONMENTS,
  API_CREDENTIALS
};