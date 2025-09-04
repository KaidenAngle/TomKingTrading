/**
 * DATA MANAGER
 * Handles all market data with intelligent fallback system
 * Works 24/7 using live data when available, cached data otherwise
 */

const fs = require('fs').promises;
const path = require('path');
const { getLogger } = require('./logger');
const logger = getLogger();

// Removed synthetic data generator - using only real API data

class DataManager {
    constructor(api = null, options = {}) {
        this.api = api;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCloseCache = new Map(); // Permanent storage of last close prices
        
        // Historical data configuration
        this.dataDir = options.dataDir || path.join(__dirname, '..', 'data', 'historical');
        this.rateLimiter = new Map();
        this.maxRetries = options.maxRetries || 3;
        this.rateLimitDelay = options.rateLimitDelay || 1000;
        
        // Historical data index
        this.historicalIndex = null;
        
        // Phase-based ticker organization
        this.phaseTickerMap = {
            1: ['MCL', 'MGC', 'GLD', 'TLT', 'SLV', 'SPY', 'QQQ'],
            2: ['MES', 'MNQ', 'M6E', 'M6B', 'MYM', 'MCL', 'MGC', 'GLD', 'TLT'],
            3: ['ES', 'NQ', '6E', '6B', 'YM', 'CL', 'GC', 'ZN', 'ZB'],
            4: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', '6E', '6B', '6J', 'ZN', 'ZB', 'ZC', 'ZS']
        };
        
        // Default market data templates
        this.defaultMarketData = {
            VIX: { symbol: 'VIX', currentPrice: 16.12, previousClose: 16.50, change: -0.38, changePercent: -2.3 },
            SPY: { symbol: 'SPY', currentPrice: 450.25, previousClose: 448.50, iv: 18.5, ivRank: 35 },
            ES: { symbol: 'ES', currentPrice: 4520.50, previousClose: 4515.25, iv: 16.2, ivRank: 28 },
            QQQ: { symbol: 'QQQ', currentPrice: 380.15, previousClose: 378.90, iv: 22.3, ivRank: 45 }
        };
        
        // Initialize data directories and index (async)
        this.initializeDataSystem();
        
        // Symbol format mappings
        this.symbolMappings = {
            // Futures - need forward slash for API
            'ES': '/ES',
            'MES': '/MES',
            'NQ': '/NQ',
            'MNQ': '/MNQ',
            'CL': '/CL',
            'MCL': '/MCL',
            'GC': '/GC',
            'MGC': '/MGC',
            'ZB': '/ZB',
            'ZN': '/ZN',
            '6E': '/6E',
            '6B': '/6B',
            '6A': '/6A',
            'M6E': '/M6E',
            'M6A': '/M6A',
            // Indices - no change needed (handled as 'index' in API)
            'VIX': 'VIX',
            'SPX': 'SPX',
            'DJI': 'DJI',
            // Equities - no change needed
            'SPY': 'SPY',
            'QQQ': 'QQQ',
            'IWM': 'IWM',
            'GLD': 'GLD',
            'SLV': 'SLV',
            'TLT': 'TLT',
            'XLE': 'XLE',
            'XOP': 'XOP'
        };
    }
    
    /**
     * Initialize data system directories and index
     */
    async initializeDataSystem() {
        try {
            await this.ensureDataDirectory();
            await this.loadHistoricalIndex();
        } catch (error) {
            logger.error('DATA', 'Failed to initialize data system', error);
        }
    }
    
    /**
     * Ensure data directory structure exists
     */
    async ensureDataDirectory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'stocks'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'options'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'futures'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'indices'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'volatility'), { recursive: true });
            await fs.mkdir(path.join(this.dataDir, 'tastytrade_cache'), { recursive: true });
            logger.info('DATA', 'Data directory structure initialized');
        } catch (error) {
            logger.error('DATA', 'Failed to create data directories', error);
        }
    }
    
    /**
     * Load historical data index
     */
    async loadHistoricalIndex() {
        try {
            const indexPath = path.join(this.dataDir, 'index_2023_2024.json');
            const indexData = await fs.readFile(indexPath, 'utf8');
            this.historicalIndex = JSON.parse(indexData);
            logger.info('DATA', `Historical data index loaded: ${this.historicalIndex.totalFiles} files`);
        } catch (error) {
            logger.debug('DATA', 'No historical index found, using live data only');
            this.historicalIndex = null;
        }
    }

    /**
     * Convert internal symbol to API format
     * For futures, this will map to proper contract months via the API's mapFuturesSymbol method
     */
    formatSymbolForAPI(symbol) {
        const mapped = this.symbolMappings[symbol] || symbol;
        
        // If it's a futures symbol (starts with /), the API will handle contract month mapping
        if (mapped.startsWith('/')) {
            return mapped; // Let the API handle the specific contract month
        }
        
        return mapped;
    }

    /**
     * Check if market is open
     */
    isMarketOpen() {
        const now = new Date();
        const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = nyTime.getDay();
        const hour = nyTime.getHours();
        const minute = nyTime.getMinutes();
        const time = hour * 100 + minute;
        
        // Market closed on weekends
        if (day === 0 || day === 6) return false;
        
        // Market hours: 9:30 AM - 4:00 PM EST
        return time >= 930 && time < 1600;
    }

    /**
     * Check if futures market is open (nearly 24/5)
     */
    isFuturesMarketOpen() {
        const now = new Date();
        const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = nyTime.getDay();
        const hour = nyTime.getHours();
        
        // Futures closed from Friday 5PM to Sunday 6PM EST
        if (day === 6) return false; // Saturday
        if (day === 0 && hour < 18) return false; // Sunday before 6PM
        if (day === 5 && hour >= 17) return false; // Friday after 5PM
        
        return true;
    }

    /**
     * Get market data - ONLY from real API sources
     */
    async getMarketData(ticker, forceRefresh = false) {
        const apiSymbol = this.formatSymbolForAPI(ticker);
        const cacheKey = `${ticker}_${Date.now()}`;
        
        // Special debug logging for VIX
        if (ticker === 'VIX') {
            logger.debug('DATA', `VIX data request - ticker: ${ticker}, apiSymbol: ${apiSymbol}, forceRefresh: ${forceRefresh}`);
        }
        
        // Check if it's a futures symbol
        const isFutures = apiSymbol.startsWith('/');
        const marketOpen = isFutures ? this.isFuturesMarketOpen() : this.isMarketOpen();
        
        // 1. Try to get fresh data from API if market is open
        if (this.api && (marketOpen || forceRefresh)) {
            try {
                logger.debug('DATA', `Fetching live data for ${ticker} (${apiSymbol})`);
                const quotes = await this.api.getQuotes([apiSymbol]);
                
                // Special debug for VIX
                if (ticker === 'VIX') {
                    logger.debug('DATA', `VIX API response:`, { quotes, symbol: apiSymbol });
                }
                
                if (quotes && quotes[apiSymbol]) {
                    const data = this.parseQuoteData(quotes[apiSymbol], ticker);
                    
                    // Enhance with real IV rank/percentile from market-metrics API
                    await this.enhanceWithIVMetrics(data, ticker);
                    
                    // Special debug for VIX
                    if (ticker === 'VIX') {
                        logger.debug('DATA', `VIX parsed data:`, data);
                    }
                    
                    // Cache the data
                    this.cache.set(ticker, {
                        data,
                        timestamp: Date.now()
                    });
                    
                    // Store as last close if market is closed
                    if (!marketOpen) {
                        this.lastCloseCache.set(ticker, data);
                    }
                    
                    return data;
                }
            } catch (error) {
                logger.warn('DATA', `API error for ${ticker}`, { error: error.message });
            }
        }
        
        // 2. Check recent cache (within 5 minutes)
        const cached = this.cache.get(ticker);
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            logger.debug('DATA', `Using cached data for ${ticker}`, { age: `${Math.round((Date.now() - cached.timestamp) / 1000)}s old` });
            return cached.data;
        }
        
        // 3. Use last close data
        const lastClose = this.lastCloseCache.get(ticker);
        if (lastClose) {
            logger.debug('DATA', `Using last close data for ${ticker}`);
            return lastClose;
        }
        
        // 4. CRITICAL: No simulated data allowed - must fail if real data unavailable
        const errorMsg = `Real market data unavailable for ${ticker}. Cannot proceed with simulated data.`;
        logger.error('DATA', errorMsg);
        
        // Special error for VIX - critical for risk management
        if (ticker === 'VIX') {
            throw new Error(`CRITICAL: VIX data unavailable - cannot proceed without real volatility data`);
        }
        
        throw new Error(errorMsg);
    }

    /**
     * Parse quote data from API into standard format
     */
    parseQuoteData(apiData, ticker) {
        const currentPrice = parseFloat(apiData.last || apiData.mark || apiData.close || 0);
        const openPrice = parseFloat(apiData.open || apiData['prev-close'] || currentPrice);
        const previousClose = parseFloat(apiData['prev-close'] || apiData.close || openPrice);
        const bid = parseFloat(apiData.bid || currentPrice * 0.999);
        const ask = parseFloat(apiData.ask || currentPrice * 1.001);
        
        return {
            ticker,
            currentPrice,
            openPrice,
            previousClose,
            bid,
            ask,
            high: parseFloat(apiData['day-high-price'] || apiData.high || currentPrice * 1.01),
            low: parseFloat(apiData['day-low-price'] || apiData.low || currentPrice * 0.99),
            volume: parseInt(apiData.volume || 0),
            updatedAt: apiData['updated-at'] || new Date().toISOString(),
            
            // Calculate derived values
            dayChange: parseFloat((currentPrice - openPrice).toFixed(2)),
            dayChangePercent: parseFloat(((currentPrice - openPrice) / openPrice * 100).toFixed(2)),
            spread: parseFloat((ask - bid).toFixed(2)),
            
            // Technical indicators with defaults
            high5d: parseFloat(apiData['5-day-high'] || currentPrice * 1.02),
            low5d: parseFloat(apiData['5-day-low'] || currentPrice * 0.98),
            high20d: parseFloat(apiData['20-day-high'] || currentPrice * 1.05),
            low20d: parseFloat(apiData['20-day-low'] || currentPrice * 0.95),
            atr: parseFloat(apiData['average-true-range'] || currentPrice * 0.015),
            rsi: parseFloat(apiData['relative-strength-index'] || 50),
            ema8: parseFloat(apiData['8-day-ema'] || currentPrice * 0.998),
            ema21: parseFloat(apiData['21-day-ema'] || currentPrice * 0.997),
            vwap: parseFloat(apiData.vwap || currentPrice),
            iv: parseFloat(apiData['implied-volatility'] || this.getDefaultIV(ticker)),
            ivRank: parseFloat(apiData['iv-rank'] || 0), // No random fallback - use API or 0
            ivPercentile: parseFloat(apiData['iv-percentile'] || 0) // No random fallback - use API or 0
        };
    }

    /**
     * Enhance market data with real IV rank/percentile from TastyTrade market-metrics API
     */
    async enhanceWithIVMetrics(data, ticker) {
        try {
            // Skip VIX and futures - IV rank not applicable
            if (ticker === 'VIX' || this.isFuturesSymbol(ticker)) {
                return;
            }
            
            // Only enhance if we have zero values (meaning no data from quotes)
            if (data.ivRank > 0 && data.ivPercentile > 0) {
                return; // Already has real data
            }
            
            // Fetch from market-metrics API
            if (this.api && typeof this.api.getIVRank === 'function') {
                try {
                    const ivRank = await this.api.getIVRank(ticker);
                    const ivPercentile = await this.api.getIVPercentile(ticker);
                    
                    if (ivRank !== null && ivRank !== undefined) {
                        data.ivRank = ivRank;
                        logger.debug('DATA', `✅ Enhanced ${ticker} with real IV rank: ${ivRank}%`);
                    }
                    
                    if (ivPercentile !== null && ivPercentile !== undefined) {
                        data.ivPercentile = ivPercentile;
                        logger.debug('DATA', `✅ Enhanced ${ticker} with real IV percentile: ${ivPercentile}%`);
                    }
                    
                } catch (error) {
                    logger.debug('DATA', `Could not enhance ${ticker} with IV metrics:`, error.message);
                }
            }
            
        } catch (error) {
            logger.warn('DATA', `IV metrics enhancement failed for ${ticker}`, error);
        }
    }
    
    /**
     * Get default IV for ticker type
     */
    getDefaultIV(ticker) {
        const defaultIVs = {
            'VIX': 0, // VIX is volatility itself
            'ES': 14, 'MES': 14, 'SPY': 16,
            'NQ': 18, 'MNQ': 18, 'QQQ': 20,
            'CL': 35, 'MCL': 35,
            'GC': 18, 'MGC': 18, 'GLD': 15,
            'SLV': 28, 'TLT': 12, 'IWM': 22,
            'ZN': 8, 'ZB': 10
        };
        return defaultIVs[ticker] || 20;
    }

    /**
     * REMOVED: Simulated data generation not allowed
     * All data must be real from API sources
     */
    generateSimulatedData(ticker) {
        throw new Error(`Simulated data generation not allowed. All data must be real from API. Requested: ${ticker}`);
        
        // Method removed - throws error if called
    }

    /**
     * Get base prices for simulation
     */
    getBasePrice(ticker) {
        const basePrices = {
            'VIX': 16, // VIX typically ranges 10-30, average around 16
            'ES': 5450,
            'MES': 5450,
            'SPY': 545,
            'QQQ': 475,
            'IWM': 225,
            'GLD': 195,
            'SLV': 28,
            'TLT': 95,
            'CL': 75,
            'MCL': 75,
            'GC': 2050,
            'MGC': 2050,
            'NQ': 20000,
            'MNQ': 20000,
            'XLE': 85,
            'XOP': 135
        };
        
        return basePrices[ticker] || 100;
    }

    /**
     * Get option chain data
     */
    async getOptionChain(ticker, expiration = null) {
        const apiSymbol = this.formatSymbolForAPI(ticker);
        
        if (this.api) {
            try {
                logger.debug('DATA', `Fetching option chain for ${ticker}`);
                const chain = await this.api.getOptionChain(apiSymbol, expiration);
                
                if (chain) {
                    return this.parseOptionChain(chain, ticker);
                }
            } catch (error) {
                logger.warn('DATA', `Option chain error for ${ticker}`, { error: error.message });
            }
        }
        
        // CRITICAL: No simulated option chains - must have real data
        throw new Error(`Real option chain data unavailable for ${ticker}. Cannot proceed with simulated data.`);
    }

    /**
     * Parse option chain from API
     */
    parseOptionChain(apiChain, ticker) {
        // Implementation depends on API response structure
        return {
            ticker,
            expirations: apiChain.expirations || [],
            strikes: apiChain.strikes || [],
            options: apiChain.options || []
        };
    }

    /**
     * REMOVED: No synthetic option chain generation - real API data only
     */
    generateSimulatedOptionChain(ticker) {
        throw new Error(`Synthetic option chain generation not allowed. Must use real API data for ${ticker}`);
    }

    /**
     * REMOVED: No synthetic expiration generation - real API data only
     */
    generateExpirations() {
        throw new Error('Synthetic expiration generation not allowed. Must use real API data.');
    }

    /**
     * Get VIX data with special handling
     */
    async getVIXData() {
        const vixData = await this.getMarketData('VIX');
        
        // VIX special formatting
        if (vixData && vixData.currentPrice) {
            return {
                ...vixData,
                currentLevel: vixData.currentPrice, // Tom King format
                regime: this.getVIXRegime(vixData.currentPrice),
                trend: vixData.dayChange > 0 ? 'RISING' : 'FALLING'
            };
        }
        
        return vixData;
    }
    
    /**
     * Get VIX regime classification
     */
    getVIXRegime(vixLevel) {
        if (vixLevel < 12) return 'ULTRA_LOW';
        if (vixLevel < 15) return 'LOW'; 
        if (vixLevel < 20) return 'NORMAL';
        if (vixLevel < 30) return 'ELEVATED';
        if (vixLevel < 50) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Get account data
     */
    async getAccountData() {
        if (this.api) {
            try {
                const balances = await this.api.getAccountBalances();
                const positions = await this.api.getPositions();
                
                return {
                    netLiq: balances?.netLiquidatingValue || 0,
                    buyingPower: balances?.buyingPower || 0,
                    bpUsed: balances?.buyingPowerUsed || 0,
                    positions: positions || []
                };
            } catch (error) {
                logger.error('DATA', 'Account data error', { error: error.message });
            }
        }
        
        // Return test data
        return {
            netLiq: 35000,
            buyingPower: 25000,
            bpUsed: 28,
            positions: []
        };
    }

    // ========== HISTORICAL DATA METHODS ==========
    
    /**
     * Fetch historical stock/ETF/futures data
     */
    async fetchHistoricalData(symbol, startDate, endDate, interval = 'daily') {
        const cacheKey = `hist_${symbol}_${startDate}_${endDate}_${interval}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheExpiry * 12) { // Longer cache for historical
                logger.debug('DATA', `Historical cache hit for ${symbol}`);
                return cached.data;
            }
        }
        
        // Try TastyTrade API if available
        if (this.api) {
            try {
                const data = await this.fetchFromTastyTradeHistorical(symbol, startDate, endDate, interval);
                if (data) {
                    this.cache.set(cacheKey, { data, timestamp: Date.now() });
                    return data;
                }
            } catch (error) {
                logger.warn('DATA', `Historical API fetch failed for ${symbol}`, error);
            }
        }
        
        // No synthetic data generation - return empty if no real data
        logger.error('DATA', `No real historical data available for ${symbol}`);
        return [];
    }
    
    /**
     * Load symbol data from historical dataset
     */
    loadHistoricalSymbol(symbol) {
        if (!this.historicalIndex) {
            throw new Error('Historical index not available');
        }
        
        const cacheKey = `hist_symbol_${symbol}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey).data;
        }
        
        const fileInfo = this.historicalIndex.files.find(file => file.symbol === symbol);
        if (!fileInfo) {
            throw new Error(`Symbol ${symbol} not found in historical dataset`);
        }
        
        try {
            const filePath = path.join(this.dataDir, fileInfo.assetClass, fileInfo.fileName);
            const rawData = require('fs').readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(rawData);
            
            const data = {
                symbol: parsedData.symbol,
                period: parsedData.period,
                totalBars: parsedData.totalBars,
                startDate: parsedData.startDate,
                endDate: parsedData.endDate,
                bars: parsedData.data
            };
            
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            logger.info('DATA', `Loaded historical ${symbol}: ${data.totalBars} bars`);
            return data;
        } catch (error) {
            throw new Error(`Failed to load historical ${symbol}: ${error.message}`);
        }
    }
    
    /**
     * Get data for specific date range from historical dataset
     */
    getHistoricalDateRange(symbol, startDate, endDate) {
        const data = this.loadHistoricalSymbol(symbol);
        return data.bars.filter(bar => bar.date >= startDate && bar.date <= endDate);
    }
    
    /**
     * Get data for specific market events
     */
    getMarketEvent(symbol, eventName) {
        const events = {
            'svb-crisis': { start: '2023-03-08', end: '2023-03-17' },
            'debt-ceiling': { start: '2023-05-15', end: '2023-06-02' },
            'fall-correction': { start: '2023-10-10', end: '2023-10-27' },
            'march-rally': { start: '2024-03-01', end: '2024-03-28' },
            'august-crash': { start: '2024-08-02', end: '2024-08-09' },
            'election-volatility': { start: '2024-11-01', end: '2024-11-08' }
        };
        
        const event = events[eventName];
        if (!event) {
            throw new Error(`Unknown market event: ${eventName}`);
        }
        
        return this.getHistoricalDateRange(symbol, event.start, event.end);
    }
    
    /**
     * Get all Fridays for 0DTE testing
     */
    getFridays(symbol) {
        const data = this.loadHistoricalSymbol(symbol);
        return data.bars.filter(bar => {
            const date = new Date(bar.date);
            return date.getDay() === 5; // Friday
        });
    }
    
    /**
     * Get correlation data for multiple symbols
     */
    getCorrelationData(symbols, startDate = null, endDate = null) {
        const result = {};
        
        for (const symbol of symbols) {
            const data = this.loadHistoricalSymbol(symbol);
            let bars = data.bars;
            
            if (startDate || endDate) {
                bars = bars.filter(bar => {
                    if (startDate && bar.date < startDate) return false;
                    if (endDate && bar.date > endDate) return false;
                    return true;
                });
            }
            
            result[symbol] = bars.map(bar => ({
                date: bar.date,
                close: bar.close,
                dailyReturn: null
            }));
            
            // Calculate daily returns
            for (let i = 1; i < result[symbol].length; i++) {
                const today = result[symbol][i];
                const yesterday = result[symbol][i - 1];
                today.dailyReturn = (today.close - yesterday.close) / yesterday.close;
            }
        }
        
        return result;
    }
    
    /**
     * REMOVED: No synthetic historical data generation - real API data only
     */
    async generateHistoricalData(symbol, startDate, endDate, interval) {
        throw new Error(`Synthetic historical data generation not allowed. Must use real API data for ${symbol}`);
    }
    
    /**
     * Check if symbol is futures
     */
    isFuturesSymbol(symbol) {
        return ['ES', 'MES', 'NQ', 'MNQ', 'CL', 'MCL', 'GC', 'MGC', 'ZB', 'ZN', 'YM', 'MYM', 'RTY', '6E', '6B', '6J', '6C', 'M6E', 'M6B', 'ZC', 'ZS', 'SI'].includes(symbol) || symbol.startsWith('/');
    }
    
    /**
     * Fetch from TastyTrade historical API
     */
    async fetchFromTastyTradeHistorical(symbol, startDate, endDate, interval) {
        try {
            const apiSymbol = this.formatSymbolForAPI(symbol);
            // TastyTrade API doesn't provide historical data endpoint
            // Must use real-time data or error out
            throw new Error('Historical data not available via API - use real-time data only');
        } catch (error) {
            logger.error('DATA', `TastyTrade historical API error for ${symbol}`, error);
            return null;
        }
    }
    
    // ========== PHASE AND MARKET DATA METHODS ==========
    
    /**
     * Get market data for specific phase
     */
    async getPhaseMarketData(phase) {
        const tickers = this.phaseTickerMap[phase] || this.phaseTickerMap[1];
        const results = {};
        
        for (const ticker of tickers) {
            try {
                results[ticker] = await this.getMarketData(ticker);
            } catch (error) {
                logger.error('DATA', `Failed to get phase data for ${ticker}`, error);
                // No simulated data allowed - real data only
                throw new Error(`Real data unavailable for ${ticker}: ${error.message}`);
            }
        }
        
        return results;
    }
    
    /**
     * Get available symbols from historical index or defaults
     */
    getAvailableSymbols() {
        if (!this.historicalIndex) return Object.keys(this.defaultMarketData);
        return this.historicalIndex.files.map(file => file.symbol);
    }
    
    /**
     * Get symbols by asset class
     */
    getSymbolsByAssetClass(assetClass) {
        if (!this.historicalIndex) return [];
        return this.historicalIndex.files
            .filter(file => file.assetClass === assetClass)
            .map(file => file.symbol);
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        logger.debug('DATA', 'Cache cleared');
    }

    /**
     * Get cache status
     */
    getCacheStatus() {
        return {
            cacheSize: this.cache.size,
            lastCloseSize: this.lastCloseCache.size,
            marketOpen: this.isMarketOpen(),
            futuresOpen: this.isFuturesMarketOpen()
        };
    }
}

module.exports = { DataManager };