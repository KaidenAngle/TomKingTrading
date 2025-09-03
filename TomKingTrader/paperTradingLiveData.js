/**
 * Paper Trading Live Data Integration
 * Connects paper trading server to real market data for realistic simulation
 */

const WebSocket = require('ws');
const axios = require('axios');
const EventEmitter = require('events');

class PaperTradingLiveData extends EventEmitter {
    constructor(tastyTradeAPI = null) {
        super();
        this.api = tastyTradeAPI;
        this.marketData = {};
        this.optionChains = {};
        this.vixLevel = 20; // Default VIX
        this.updateInterval = 5000; // 5 second updates
        this.isConnected = false;
        
        // Fallback data sources if API not available
        this.dataProviders = {
            yahoo: 'https://query1.finance.yahoo.com/v8/finance/quote',
            alphavantage: process.env.ALPHA_VANTAGE_KEY,
            iex: process.env.IEX_CLOUD_KEY
        };
    }

    /**
     * Start live data feed
     */
    async startLiveDataFeed() {
        console.log('🔴 Starting live data feed for paper trading...');
        
        // Try TastyTrade API first
        if (this.api && this.api.isAuthenticated()) {
            await this.connectTastyTrade();
        } else {
            // Fallback to free data sources
            await this.connectFallbackData();
        }
        
        // Start update loop
        this.startUpdateLoop();
        this.isConnected = true;
        
        return true;
    }

    /**
     * Connect to TastyTrade for real data
     */
    async connectTastyTrade() {
        try {
            // Get account data
            const account = await this.api.getAccount();
            
            // Subscribe to market data streams
            const symbols = ['SPY', 'QQQ', 'IWM', 'VIX', '/ES', '/NQ', '/MES', '/MNQ'];
            
            for (const symbol of symbols) {
                try {
                    const quote = await this.api.getQuote(symbol);
                    this.marketData[symbol] = {
                        symbol,
                        last: quote.last,
                        bid: quote.bid,
                        ask: quote.ask,
                        volume: quote.volume,
                        open: quote.open,
                        high: quote.high,
                        low: quote.low,
                        close: quote.previousClose,
                        timestamp: new Date()
                    };
                } catch (error) {
                    console.log(`Warning: Could not get quote for ${symbol}`);
                }
            }
            
            // Get VIX level
            if (this.marketData.VIX) {
                this.vixLevel = this.marketData.VIX.last;
            }
            
            console.log('✅ Connected to TastyTrade live data');
            
        } catch (error) {
            console.log('⚠️ TastyTrade connection failed, using fallback data');
            await this.connectFallbackData();
        }
    }

    /**
     * Connect to fallback free data sources
     */
    async connectFallbackData() {
        try {
            // Use Yahoo Finance as primary fallback
            const symbols = ['SPY', 'QQQ', 'IWM', '^VIX'];
            const url = `${this.dataProviders.yahoo}?symbols=${symbols.join(',')}`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.data && response.data.quoteResponse) {
                const quotes = response.data.quoteResponse.result;
                
                for (const quote of quotes) {
                    const symbol = quote.symbol.replace('^', '');
                    this.marketData[symbol] = {
                        symbol,
                        last: quote.regularMarketPrice,
                        bid: quote.bid || quote.regularMarketPrice,
                        ask: quote.ask || quote.regularMarketPrice,
                        volume: quote.regularMarketVolume,
                        open: quote.regularMarketOpen,
                        high: quote.regularMarketDayHigh,
                        low: quote.regularMarketDayLow,
                        close: quote.regularMarketPreviousClose,
                        timestamp: new Date()
                    };
                }
                
                // Update VIX
                if (this.marketData.VIX) {
                    this.vixLevel = this.marketData.VIX.last;
                }
                
                console.log('✅ Connected to Yahoo Finance fallback data');
            }
            
        } catch (error) {
            console.log('⚠️ Fallback data failed, using simulated data');
            this.useSimulatedData();
        }
    }

    /**
     * Use simulated data as last resort
     */
    useSimulatedData() {
        // Realistic simulated data based on typical market values
        const baseData = {
            SPY: { base: 450, volatility: 0.01 },
            QQQ: { base: 380, volatility: 0.015 },
            IWM: { base: 220, volatility: 0.02 },
            VIX: { base: 20, volatility: 0.1 },
            '/ES': { base: 4500, volatility: 0.01 },
            '/NQ': { base: 15500, volatility: 0.015 },
            '/MES': { base: 4500, volatility: 0.01 },
            '/MNQ': { base: 15500, volatility: 0.015 }
        };
        
        for (const [symbol, config] of Object.entries(baseData)) {
            const randomChange = (Math.random() - 0.5) * config.volatility;
            const price = config.base * (1 + randomChange);
            
            this.marketData[symbol] = {
                symbol,
                last: price,
                bid: price - 0.01,
                ask: price + 0.01,
                volume: Math.floor(Math.random() * 1000000),
                open: config.base,
                high: price * 1.002,
                low: price * 0.998,
                close: config.base,
                timestamp: new Date()
            };
        }
        
        this.vixLevel = this.marketData.VIX.last;
        console.log('📊 Using simulated market data');
    }

    /**
     * Start continuous update loop
     */
    startUpdateLoop() {
        setInterval(async () => {
            if (this.isConnected) {
                await this.updateMarketData();
                this.emit('marketUpdate', this.marketData);
                this.emit('vixUpdate', this.vixLevel);
            }
        }, this.updateInterval);
    }

    /**
     * Update market data
     */
    async updateMarketData() {
        // Add small random movements to simulate real market
        for (const symbol in this.marketData) {
            const data = this.marketData[symbol];
            const volatility = symbol === 'VIX' ? 0.05 : 0.001;
            const change = (Math.random() - 0.5) * volatility;
            
            data.last = data.last * (1 + change);
            data.bid = data.last - 0.01;
            data.ask = data.last + 0.01;
            data.timestamp = new Date();
            
            // Update high/low
            if (data.last > data.high) data.high = data.last;
            if (data.last < data.low) data.low = data.last;
        }
        
        // Update VIX
        if (this.marketData.VIX) {
            this.vixLevel = this.marketData.VIX.last;
        }
    }

    /**
     * Get option chain for symbol
     */
    async getOptionChain(symbol, expirationDate = null) {
        try {
            if (this.api && this.api.isAuthenticated()) {
                // Get real option chain from TastyTrade
                const chain = await this.api.getOptionChain(symbol, expirationDate);
                this.optionChains[symbol] = chain;
                return chain;
            } else {
                // Generate simulated option chain
                return this.generateSimulatedOptionChain(symbol, expirationDate);
            }
        } catch (error) {
            console.log('Using simulated option chain');
            return this.generateSimulatedOptionChain(symbol, expirationDate);
        }
    }

    /**
     * Generate realistic simulated option chain
     */
    generateSimulatedOptionChain(symbol, expirationDate) {
        const spotPrice = this.marketData[symbol]?.last || 450;
        const strikes = [];
        
        // Generate strikes around spot price
        for (let i = -10; i <= 10; i++) {
            const strike = Math.round(spotPrice + (i * 5));
            
            // Calculate realistic option prices using simplified Black-Scholes approximation
            const moneyness = (spotPrice - strike) / spotPrice;
            const timeToExpiry = expirationDate ? 
                (new Date(expirationDate) - new Date()) / (365 * 24 * 60 * 60 * 1000) : 
                30 / 365; // Default 30 days
            
            const iv = 0.20 + Math.abs(moneyness) * 0.1; // Implied volatility
            
            // Simplified pricing
            const callPrice = Math.max(0, spotPrice - strike) + 
                (spotPrice * iv * Math.sqrt(timeToExpiry) * 0.4);
            const putPrice = Math.max(0, strike - spotPrice) + 
                (spotPrice * iv * Math.sqrt(timeToExpiry) * 0.4);
            
            strikes.push({
                strike,
                call: {
                    bid: Math.max(0.01, callPrice - 0.05),
                    ask: callPrice + 0.05,
                    last: callPrice,
                    volume: Math.floor(Math.random() * 1000),
                    openInterest: Math.floor(Math.random() * 5000),
                    iv: iv,
                    delta: 0.5 + moneyness,
                    gamma: 0.02 / (1 + Math.abs(moneyness) * 10),
                    theta: -callPrice * 0.02,
                    vega: callPrice * 0.1
                },
                put: {
                    bid: Math.max(0.01, putPrice - 0.05),
                    ask: putPrice + 0.05,
                    last: putPrice,
                    volume: Math.floor(Math.random() * 1000),
                    openInterest: Math.floor(Math.random() * 5000),
                    iv: iv,
                    delta: -0.5 + moneyness,
                    gamma: 0.02 / (1 + Math.abs(moneyness) * 10),
                    theta: -putPrice * 0.02,
                    vega: putPrice * 0.1
                }
            });
        }
        
        return {
            symbol,
            expirationDate: expirationDate || this.getNextFriday(),
            strikes,
            spotPrice,
            timestamp: new Date()
        };
    }

    /**
     * Get next Friday for 0DTE simulation
     */
    getNextFriday() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        return nextFriday.toISOString().split('T')[0];
    }

    /**
     * Get current market data
     */
    getMarketData() {
        return this.marketData;
    }

    /**
     * Get VIX level
     */
    getVIXLevel() {
        return this.vixLevel;
    }

    /**
     * Check if market is open
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
        
        return true;
    }

    /**
     * Stop live data feed
     */
    stopLiveDataFeed() {
        this.isConnected = false;
        console.log('🔴 Live data feed stopped');
    }
}

module.exports = PaperTradingLiveData;