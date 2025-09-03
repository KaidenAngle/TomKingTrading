/**
 * Paper Trading REAL Live Data Integration
 * CRITICAL: Uses ONLY real market data - NO simulated fallbacks
 * If real data is not available, the system MUST fail
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { getLogger } = require('./src/logger');

const logger = getLogger();

class PaperTradingRealData extends EventEmitter {
    constructor(tastyTradeAPI) {
        super();
        
        if (!tastyTradeAPI) {
            throw new Error('CRITICAL: TastyTrade API is required for real data. Cannot proceed without API connection.');
        }
        
        this.api = tastyTradeAPI;
        this.marketData = {};
        this.optionChains = {};
        this.vixLevel = null; // Must be fetched from real data
        this.updateInterval = 5000; // 5 second updates
        this.isConnected = false;
        this.lastUpdateTime = null;
        
        // Track data freshness
        this.maxDataAge = 60000; // 1 minute max age for data
    }

    /**
     * Start REAL live data feed
     * Fails if cannot connect to real data
     */
    async startLiveDataFeed() {
        console.log('🔴 Starting REAL live data feed for paper trading...');
        console.log('⚠️  CRITICAL: System will fail if real data not available');
        
        // Authenticate with TastyTrade
        if (!this.api.isAuthenticated()) {
            const authSuccess = await this.api.authenticate();
            if (!authSuccess) {
                throw new Error('CRITICAL: Cannot authenticate with TastyTrade API. Real data unavailable.');
            }
        }
        
        // Verify we can get real market data
        const testData = await this.api.getMarketData(['SPY']);
        if (!testData || !testData.SPY) {
            throw new Error('CRITICAL: Cannot retrieve real market data from TastyTrade. System cannot continue.');
        }
        
        console.log('✅ Connected to TastyTrade API for REAL market data');
        console.log(`   SPY Price: $${testData.SPY.last || testData.SPY.currentPrice}`);
        
        // Start update loop for real data only
        this.startRealDataUpdateLoop();
        this.isConnected = true;
        
        return true;
    }

    /**
     * Get real market data from TastyTrade
     * NO FALLBACKS - fails if data not available
     */
    async getRealMarketData(symbols) {
        try {
            const data = await this.api.getMarketData(symbols);
            
            if (!data || Object.keys(data).length === 0) {
                throw new Error(`No real data received for symbols: ${symbols.join(', ')}`);
            }
            
            // Update our cache with real data
            for (const [symbol, quote] of Object.entries(data)) {
                this.marketData[symbol] = {
                    symbol,
                    last: quote.last || quote.currentPrice,
                    bid: quote.bid,
                    ask: quote.ask,
                    volume: quote.volume,
                    open: quote.open,
                    high: quote.high,
                    low: quote.low,
                    close: quote.close || quote.previousClose,
                    timestamp: new Date(),
                    isRealData: true // Flag to confirm this is real data
                };
            }
            
            // Update VIX from real data
            if (this.marketData.VIX) {
                this.vixLevel = this.marketData.VIX.last;
                console.log(`📊 Real VIX Level: ${this.vixLevel}`);
            }
            
            this.lastUpdateTime = Date.now();
            return this.marketData;
            
        } catch (error) {
            logger.error('REAL_DATA', 'Failed to get real market data', error);
            throw new Error(`CRITICAL: Real market data unavailable: ${error.message}`);
        }
    }

    /**
     * Get real option chain from TastyTrade
     * NO FALLBACKS - fails if data not available
     */
    async getRealOptionChain(symbol, expiration = null) {
        try {
            const chain = await this.api.getOptionChain(symbol, expiration);
            
            if (!chain || !chain.expirations || chain.expirations.length === 0) {
                throw new Error(`No real option chain data for ${symbol}`);
            }
            
            // Cache the real option chain
            this.optionChains[symbol] = {
                ...chain,
                timestamp: new Date(),
                isRealData: true
            };
            
            return chain;
            
        } catch (error) {
            logger.error('REAL_DATA', `Failed to get real option chain for ${symbol}`, error);
            throw new Error(`CRITICAL: Real option chain unavailable for ${symbol}: ${error.message}`);
        }
    }

    /**
     * Update loop for REAL data only
     */
    startRealDataUpdateLoop() {
        setInterval(async () => {
            if (this.isConnected) {
                try {
                    // Get real data for key symbols
                    const symbols = ['SPY', 'QQQ', 'IWM', 'VIX', '/ES'];
                    await this.getRealMarketData(symbols);
                    
                    // Verify data freshness
                    const dataAge = Date.now() - this.lastUpdateTime;
                    if (dataAge > this.maxDataAge) {
                        throw new Error(`Data is stale: ${dataAge}ms old (max: ${this.maxDataAge}ms)`);
                    }
                    
                    // Emit real data updates
                    this.emit('marketUpdate', this.marketData);
                    this.emit('vixUpdate', this.vixLevel);
                    
                } catch (error) {
                    logger.error('REAL_DATA', 'Update loop failed', error);
                    this.emit('error', error);
                    
                    // If we can't get real data, the system should know
                    console.error('❌ CRITICAL: Cannot update real market data');
                    console.error('   System is operating on stale data');
                }
            }
        }, this.updateInterval);
    }

    /**
     * Get option chain for paper trading
     * Uses ONLY real data
     */
    async getOptionChain(symbol, expirationDate = null) {
        // Always fetch fresh real data for options
        return await this.getRealOptionChain(symbol, expirationDate);
    }

    /**
     * Stop live data feed
     */
    stopLiveDataFeed() {
        this.isConnected = false;
        console.log('🔴 Live data feed stopped');
    }

    /**
     * Get current market data
     * Returns null if data is stale
     */
    getMarketData() {
        const dataAge = Date.now() - this.lastUpdateTime;
        if (dataAge > this.maxDataAge) {
            console.warn(`⚠️  Market data is stale: ${dataAge}ms old`);
            return null;
        }
        return this.marketData;
    }

    /**
     * Get VIX level
     * Returns null if not available from real data
     */
    getVIXLevel() {
        return this.vixLevel;
    }

    /**
     * Check if market is open (real time check)
     */
    isMarketOpen() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const time = hour * 100 + minute;
        
        // Market hours: Mon-Fri 9:30 AM - 4:00 PM ET
        if (day === 0 || day === 6) return false; // Weekend
        if (time < 930 || time > 1600) return false; // Outside hours
        
        // Could also check with API for holidays
        return true;
    }

    /**
     * Verify data integrity
     * Ensures all data is real and fresh
     */
    verifyDataIntegrity() {
        const issues = [];
        
        // Check data freshness
        const dataAge = Date.now() - this.lastUpdateTime;
        if (dataAge > this.maxDataAge) {
            issues.push(`Data is ${dataAge}ms old (max: ${this.maxDataAge}ms)`);
        }
        
        // Check each symbol has real data flag
        for (const [symbol, data] of Object.entries(this.marketData)) {
            if (!data.isRealData) {
                issues.push(`${symbol} is not real data`);
            }
            
            const symbolAge = Date.now() - new Date(data.timestamp).getTime();
            if (symbolAge > this.maxDataAge) {
                issues.push(`${symbol} data is ${symbolAge}ms old`);
            }
        }
        
        // Check VIX
        if (this.vixLevel === null) {
            issues.push('VIX level not available from real data');
        }
        
        if (issues.length > 0) {
            throw new Error(`Data integrity check failed:\n${issues.join('\n')}`);
        }
        
        return true;
    }
}

module.exports = PaperTradingRealData;