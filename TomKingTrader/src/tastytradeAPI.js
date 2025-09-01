/**
 * TastyTrade API Integration Module
 * Complete OAuth2 authentication, market data streaming, and order management
 * Based on Tom King Trading Framework v17 specifications
 */

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
      if (DEBUG) console.log('🔄 Refreshing access token...');
      this.accessToken = await this.generateAccessToken();
      this.tokenExpiry = now + (14 * 60 * 1000); // 14 minutes (expires in 15)
    }
    return this.accessToken;
  }
  
  async generateAccessToken() {
    try {
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
  }
  
  async initialize() {
    try {
      if (DEBUG) console.log('🚀 Initializing TastyTrade API connection...');
      
      // Get account info
      const accounts = await this.request('/customers/me/accounts');
      this.accountNumber = accounts.data.items[0]['account-number'];
      if (DEBUG) console.log(`✅ Connected to account: ${this.accountNumber}`);
      
      // Load positions and balance
      await this.refreshPositions();
      await this.refreshBalance();
      
      if (DEBUG) console.log('✅ API initialization complete');
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
      const params = new URLSearchParams();
      symbols.forEach(symbol => {
        if (symbol.startsWith('/')) {
          params.append('future', symbol);
        } else if (symbol.includes(' ')) {
          params.append('equity-option', symbol);
        } else {
          params.append('equity', symbol);
        }
      });
      
      const data = await this.request(`/market-data?${params}`);
      return data;
    } catch (error) {
      console.error(`Quote fetch failed for ${symbols}:`, error);
      throw error;
    }
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
      if (!quotes.data.items[0]) {
        throw new Error('ES quote not available');
      }
      
      const es = quotes.data.items[0];
      
      // Get option chain for strikes
      const optionChain = await this.api.getOptionChain('ES');
      const strikes = this.extractOptionStrikes(optionChain, parseFloat(es.last));
      
      return {
        currentPrice: parseFloat(es.last),
        openPrice: parseFloat(es.open),
        previousClose: parseFloat(es['previous-close'] || es.close),
        dayHigh: parseFloat(es.high),
        dayLow: parseFloat(es.low),
        dayChange: parseFloat(es.last) - parseFloat(es.open),
        dayChangePercent: ((parseFloat(es.last) - parseFloat(es.open)) / parseFloat(es.open) * 100).toFixed(2),
        bid: parseFloat(es.bid),
        ask: parseFloat(es.ask),
        volume: parseInt(es.volume || 0),
        high5d: parseFloat(es['5-day-high'] || es.high),
        low5d: parseFloat(es['5-day-low'] || es.low),
        high20d: parseFloat(es['20-day-high'] || es.high),
        low20d: parseFloat(es['20-day-low'] || es.low),
        atr: parseFloat(es['average-true-range'] || 0),
        rsi: parseFloat(es['relative-strength-index'] || 50),
        ema8: parseFloat(es['8-day-ema'] || es.last),
        ema21: parseFloat(es['21-day-ema'] || es.last),
        vwap: parseFloat(es.vwap || es.last),
        iv: parseFloat(es['implied-volatility'] || 0),
        ivRank: parseFloat(es['iv-rank'] || 0),
        ivPercentile: parseFloat(es['iv-percentile'] || 0),
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
      if (!quotes.data.items[0]) {
        throw new Error('SPY quote not available');
      }
      
      const spy = quotes.data.items[0];
      
      return {
        currentPrice: parseFloat(spy.last),
        openPrice: parseFloat(spy.open),
        dayHigh: parseFloat(spy.high),
        dayLow: parseFloat(spy.low),
        dayChange: parseFloat(spy.last) - parseFloat(spy.open),
        dayChangePercent: ((parseFloat(spy.last) - parseFloat(spy.open)) / parseFloat(spy.open) * 100).toFixed(2),
        bid: parseFloat(spy.bid),
        ask: parseFloat(spy.ask),
        volume: parseInt(spy.volume || 0),
        high20d: parseFloat(spy['20-day-high'] || spy.high),
        low20d: parseFloat(spy['20-day-low'] || spy.low),
        atr: parseFloat(spy['average-true-range'] || 0),
        rsi: parseFloat(spy['relative-strength-index'] || 50),
        ema8: parseFloat(spy['8-day-ema'] || spy.last),
        ema21: parseFloat(spy['21-day-ema'] || spy.last),
        vwap: parseFloat(spy.vwap || spy.last),
        ivRank: parseFloat(spy['iv-rank'] || 0),
        ivPercentile: parseFloat(spy['iv-percentile'] || 0)
      };
    } catch (error) {
      console.error('SPY data collection failed:', error);
      return { currentPrice: 0, error: 'Data unavailable' };
    }
  }
  
  async getVIXData() {
    try {
      const quotes = await this.api.getQuotes(['VIX']);
      if (!quotes.data.items[0]) {
        throw new Error('VIX quote not available');
      }
      
      const vix = quotes.data.items[0];
      const currentLevel = parseFloat(vix.last);
      
      return {
        currentLevel,
        dayChange: parseFloat(vix.last) - parseFloat(vix['previous-close'] || vix.last),
        dayChangePercent: ((parseFloat(vix.last) - parseFloat(vix['previous-close'] || vix.last)) / parseFloat(vix['previous-close'] || vix.last) * 100).toFixed(2),
        dayHigh: parseFloat(vix.high),
        dayLow: parseFloat(vix.low),
        avg20d: parseFloat(vix['20-day-average'] || currentLevel),
        trend: currentLevel > parseFloat(vix['20-day-average'] || currentLevel) ? 'RISING' : 'FALLING',
        regime: this.getVIXRegime(currentLevel)
      };
    } catch (error) {
      console.error('VIX data collection failed:', error);
      return { currentLevel: 15, error: 'Data unavailable', regime: 'UNKNOWN' };
    }
  }
  
  async getDXYData() {
    try {
      const quotes = await this.api.getQuotes(['DXY']);
      if (!quotes.data.items[0]) {
        return { currentLevel: 103, trend: 'UNKNOWN', error: 'Data unavailable' };
      }
      
      const dxy = quotes.data.items[0];
      
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
    // This would be expanded based on account phase
    const tickers = {};
    
    try {
      // Add MCL and MGC (common Phase 1-2 tickers)
      const additionalQuotes = await this.api.getQuotes(['/MCL', '/MGC']);
      
      additionalQuotes.data.items.forEach(item => {
        const ticker = item.symbol.replace('/', '');
        tickers[ticker] = {
          currentPrice: parseFloat(item.last),
          dayChange: parseFloat(item.last) - parseFloat(item.open),
          iv: parseFloat(item['implied-volatility'] || 0),
          ivRank: parseFloat(item['iv-rank'] || 0)
        };
      });
    } catch (error) {
      console.warn('Additional tickers collection failed:', error);
    }
    
    return tickers;
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
  
  // Clear prepared orders
  clearPreparedOrders() {
    this.orders = [];
    if (DEBUG) console.log('🗑️ Prepared orders cleared');
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
  MarketDataCollector,
  OrderBuilder,
  TokenManager,
  APIFailureHandler,
  SymbolUtils,
  testAPIConnection,
  ENVIRONMENTS,
  API_CREDENTIALS
};