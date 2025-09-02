/**
 * Historical Data Loader for Tom King Trading Framework
 * Provides easy access to the comprehensive 2023-2024 test dataset
 */

const fs = require('fs');
const path = require('path');

class HistoricalDataLoader {
    constructor() {
        this.dataDir = path.join(__dirname, '..', 'data', 'historical');
        this.cache = new Map();
        this.index = null;
        this.loadIndex();
    }
    
    /**
     * Load the master index file
     */
    loadIndex() {
        try {
            const indexPath = path.join(this.dataDir, 'index_2023_2024.json');
            this.index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            console.log(`📋 Historical data index loaded: ${this.index.totalFiles} files`);
        } catch (error) {
            console.error('❌ Failed to load historical data index:', error.message);
        }
    }
    
    /**
     * Get list of available symbols
     */
    getAvailableSymbols() {
        if (!this.index) return [];
        return this.index.files.map(file => file.symbol);
    }
    
    /**
     * Get symbols by asset class
     */
    getSymbolsByAssetClass(assetClass) {
        if (!this.index) return [];
        return this.index.files
            .filter(file => file.assetClass === assetClass)
            .map(file => file.symbol);
    }
    
    /**
     * Load data for a specific symbol
     */
    loadSymbol(symbol) {
        // Check cache first
        if (this.cache.has(symbol)) {
            return this.cache.get(symbol);
        }
        
        // Find file info
        const fileInfo = this.index?.files.find(file => file.symbol === symbol);
        if (!fileInfo) {
            throw new Error(`Symbol ${symbol} not found in dataset`);
        }
        
        // Load file
        const filePath = path.join(this.dataDir, fileInfo.assetClass, fileInfo.fileName);
        
        try {
            const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const data = {
                symbol: rawData.symbol,
                period: rawData.period,
                totalBars: rawData.totalBars,
                startDate: rawData.startDate,
                endDate: rawData.endDate,
                bars: rawData.data
            };
            
            // Cache the data
            this.cache.set(symbol, data);
            
            console.log(`✅ Loaded ${symbol}: ${data.totalBars} bars (${data.startDate} to ${data.endDate})`);
            return data;
            
        } catch (error) {
            throw new Error(`Failed to load ${symbol}: ${error.message}`);
        }
    }
    
    /**
     * Load data for multiple symbols
     */
    loadSymbols(symbols) {
        const result = {};
        for (const symbol of symbols) {
            result[symbol] = this.loadSymbol(symbol);
        }
        return result;
    }
    
    /**
     * Get data for a specific date range
     */
    getDateRange(symbol, startDate, endDate) {
        const data = this.loadSymbol(symbol);
        return data.bars.filter(bar => 
            bar.date >= startDate && bar.date <= endDate
        );
    }
    
    /**
     * Get data for a specific market event
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
            throw new Error(`Unknown event: ${eventName}`);
        }
        
        return this.getDateRange(symbol, event.start, event.end);
    }
    
    /**
     * Get all Fridays for 0DTE testing
     */
    getFridays(symbol) {
        const data = this.loadSymbol(symbol);
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
            const data = this.loadSymbol(symbol);
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
                dailyReturn: null // Will be calculated
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
     * Get VIX regime data
     */
    getVixRegimes() {
        const vixData = this.loadSymbol('VIX');
        const regimes = [];
        
        for (const bar of vixData.bars) {
            let regime;
            if (bar.close < 15) regime = 'Very Low';
            else if (bar.close < 20) regime = 'Low';
            else if (bar.close < 25) regime = 'Normal';
            else if (bar.close < 35) regime = 'Elevated';
            else regime = 'High';
            
            regimes.push({
                date: bar.date,
                vix: bar.close,
                regime
            });
        }
        
        return regimes;
    }
    
    /**
     * Get options-specific data (with IV metrics)
     */
    getOptionsData(symbol, minIVRank = 0, maxIVRank = 100) {
        const data = this.loadSymbol(symbol);
        return data.bars.filter(bar => {
            if (!bar.ivRank) return true; // Include if IV rank not available
            return bar.ivRank >= minIVRank && bar.ivRank <= maxIVRank;
        });
    }
    
    /**
     * Get high volatility days across all symbols
     */
    getHighVolatilityDays(minVix = 25) {
        const vixData = this.loadSymbol('VIX');
        const highVolDates = vixData.bars
            .filter(bar => bar.close >= minVix)
            .map(bar => bar.date);
        
        const result = {};
        for (const symbol of this.getAvailableSymbols()) {
            if (symbol === 'VIX') continue;
            
            const data = this.loadSymbol(symbol);
            result[symbol] = data.bars.filter(bar => 
                highVolDates.includes(bar.date)
            );
        }
        
        return result;
    }
    
    /**
     * Clear cache to free memory
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Historical data cache cleared');
    }
    
    /**
     * Get dataset statistics
     */
    getStats() {
        if (!this.index) return null;
        
        return {
            totalFiles: this.index.totalFiles,
            totalSizeMB: this.index.totalSizeMB,
            period: this.index.period,
            generated: this.index.generated,
            assetClasses: {
                futures: this.getSymbolsByAssetClass('futures').length,
                stocks: this.getSymbolsByAssetClass('stocks').length,
                etfs: this.getSymbolsByAssetClass('etfs').length,
                volatility: this.getSymbolsByAssetClass('volatility').length
            },
            symbols: this.getAvailableSymbols()
        };
    }
}

// Export both class and convenience instance
const loader = new HistoricalDataLoader();

module.exports = {
    HistoricalDataLoader,
    loader
};

// Usage examples:
/*
const { loader } = require('./src/historicalDataLoader');

// Load ES futures data
const esData = loader.loadSymbol('ES');

// Get August 2024 crash data
const crashData = loader.getMarketEvent('ES', 'august-crash');

// Get all Fridays for 0DTE testing
const fridays = loader.getFridays('SPY');

// Get high volatility days
const highVolDays = loader.getHighVolatilityDays(30);

// Get correlation data
const corrData = loader.getCorrelationData(['ES', 'SPY', 'QQQ']);
*/