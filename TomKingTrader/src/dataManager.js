/**
 * DATA MANAGER
 * Handles all market data with intelligent fallback system
 * Works 24/7 using live data when available, cached data otherwise
 */

class DataManager {
    constructor(api = null) {
        this.api = api;
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.lastCloseCache = new Map(); // Permanent storage of last close prices
        
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
     * Convert internal symbol to API format
     */
    formatSymbolForAPI(symbol) {
        return this.symbolMappings[symbol] || symbol;
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
     * Get market data with intelligent fallback
     */
    async getMarketData(ticker, forceRefresh = false) {
        const apiSymbol = this.formatSymbolForAPI(ticker);
        const cacheKey = `${ticker}_${Date.now()}`;
        
        // Check if it's a futures symbol
        const isFutures = apiSymbol.startsWith('/');
        const marketOpen = isFutures ? this.isFuturesMarketOpen() : this.isMarketOpen();
        
        // 1. Try to get fresh data from API if market is open
        if (this.api && (marketOpen || forceRefresh)) {
            try {
                console.log(`📊 Fetching live data for ${ticker} (${apiSymbol})...`);
                const quotes = await this.api.getQuotes([apiSymbol]);
                
                if (quotes && quotes[apiSymbol]) {
                    const data = this.parseQuoteData(quotes[apiSymbol], ticker);
                    
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
                console.log(`⚠️ API error for ${ticker}: ${error.message}`);
            }
        }
        
        // 2. Check recent cache (within 5 minutes)
        const cached = this.cache.get(ticker);
        if (cached && (Date.now() - cached.timestamp < this.cacheExpiry)) {
            console.log(`📦 Using cached data for ${ticker} (${Math.round((Date.now() - cached.timestamp) / 1000)}s old)`);
            return cached.data;
        }
        
        // 3. Use last close data
        const lastClose = this.lastCloseCache.get(ticker);
        if (lastClose) {
            console.log(`📉 Using last close data for ${ticker}`);
            return lastClose;
        }
        
        // 4. Generate simulated data for testing
        console.log(`🔧 Generating simulated data for ${ticker}`);
        return this.generateSimulatedData(ticker);
    }

    /**
     * Parse quote data from API into standard format
     */
    parseQuoteData(apiData, ticker) {
        return {
            ticker,
            currentPrice: parseFloat(apiData.last || apiData.mark || apiData.close || 0),
            openPrice: parseFloat(apiData.open || apiData['prev-close'] || 0),
            previousClose: parseFloat(apiData['prev-close'] || apiData.close || 0),
            bid: parseFloat(apiData.bid || 0),
            ask: parseFloat(apiData.ask || 0),
            high: parseFloat(apiData['day-high-price'] || apiData.high || 0),
            low: parseFloat(apiData['day-low-price'] || apiData.low || 0),
            volume: parseInt(apiData.volume || 0),
            updatedAt: apiData['updated-at'] || new Date().toISOString(),
            
            // Calculate derived values
            dayChange: null,
            dayChangePercent: null,
            spread: null,
            
            // These need separate API calls or calculations
            high5d: null,
            low5d: null,
            high20d: null,
            low20d: null,
            atr: null,
            rsi: null,
            ema8: null,
            ema21: null,
            vwap: null,
            iv: null,
            ivRank: null,
            ivPercentile: null
        };
    }

    /**
     * Generate simulated data for testing
     */
    generateSimulatedData(ticker) {
        const basePrice = this.getBasePrice(ticker);
        const volatility = 0.02; // 2% daily volatility
        
        return {
            ticker,
            currentPrice: basePrice * (1 + (Math.random() - 0.5) * volatility),
            openPrice: basePrice,
            previousClose: basePrice * 0.995,
            bid: basePrice * 0.999,
            ask: basePrice * 1.001,
            high: basePrice * 1.01,
            low: basePrice * 0.99,
            volume: Math.floor(Math.random() * 1000000),
            updatedAt: new Date().toISOString(),
            
            // Simulated technical data
            high5d: basePrice * 1.02,
            low5d: basePrice * 0.98,
            high20d: basePrice * 1.05,
            low20d: basePrice * 0.95,
            atr: basePrice * 0.015,
            rsi: 50 + (Math.random() - 0.5) * 30,
            ema8: basePrice * 0.998,
            ema21: basePrice * 0.997,
            vwap: basePrice * 1.001,
            iv: 15 + Math.random() * 10,
            ivRank: Math.random() * 100,
            ivPercentile: Math.random() * 100
        };
    }

    /**
     * Get base prices for simulation
     */
    getBasePrice(ticker) {
        const basePrices = {
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
                console.log(`⚙️ Fetching option chain for ${ticker}...`);
                const chain = await this.api.getOptionChain(apiSymbol, expiration);
                
                if (chain) {
                    return this.parseOptionChain(chain, ticker);
                }
            } catch (error) {
                console.log(`⚠️ Option chain error for ${ticker}: ${error.message}`);
            }
        }
        
        // Generate simulated option chain
        return this.generateSimulatedOptionChain(ticker);
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
     * Generate simulated option chain
     */
    generateSimulatedOptionChain(ticker) {
        const basePrice = this.getBasePrice(ticker);
        const strikes = [];
        
        // Generate strikes around current price
        for (let i = -10; i <= 10; i++) {
            const strike = Math.round(basePrice * (1 + i * 0.01));
            strikes.push({
                strike,
                delta: 0.5 - (i * 0.05), // Approximate delta
                bid: Math.abs(i) * 0.5,
                ask: Math.abs(i) * 0.5 + 0.1,
                iv: 20 + Math.random() * 5,
                gamma: 0.01 * Math.exp(-Math.abs(i) / 5),
                theta: -0.05 * Math.exp(-Math.abs(i) / 5),
                vega: 0.1 * Math.exp(-Math.abs(i) / 5)
            });
        }
        
        return {
            ticker,
            expirations: this.generateExpirations(),
            strikes,
            currentPrice: basePrice
        };
    }

    /**
     * Generate expiration dates
     */
    generateExpirations() {
        const expirations = [];
        const today = new Date();
        
        // Add weekly expirations for next 4 weeks
        for (let i = 1; i <= 4; i++) {
            const exp = new Date(today);
            exp.setDate(exp.getDate() + (i * 7));
            // Adjust to Friday
            const dayOfWeek = exp.getDay();
            const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
            exp.setDate(exp.getDate() + daysUntilFriday);
            expirations.push(exp.toISOString().split('T')[0]);
        }
        
        // Add monthly expirations
        for (let i = 1; i <= 3; i++) {
            const exp = new Date(today);
            exp.setMonth(exp.getMonth() + i);
            // Third Friday of the month
            exp.setDate(15);
            while (exp.getDay() !== 5) {
                exp.setDate(exp.getDate() + 1);
            }
            expirations.push(exp.toISOString().split('T')[0]);
        }
        
        return expirations;
    }

    /**
     * Get VIX data
     */
    async getVIXData() {
        return await this.getMarketData('VIX');
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
                console.log('⚠️ Account data error:', error.message);
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

    /**
     * Clear all caches
     */
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
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

module.exports = DataManager;