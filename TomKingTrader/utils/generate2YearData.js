/**
 * 2-Year Historical Data Generator for Tom King Trading Framework
 * Generates comprehensive test data for 2023-2024 with major market events
 */

const fs = require('fs');
const path = require('path');
const TestDataGenerator = require('./src/testDataGenerator');

class ComprehensiveDataGenerator extends TestDataGenerator {
    constructor() {
        super();
        
        // Market event definitions with specific dates and characteristics
        this.marketEvents = {
            // 2023 Events
            'svb-crisis': {
                startDate: '2023-03-08',
                endDate: '2023-03-17',
                description: 'SVB Banking Crisis',
                vixRange: [25, 35],
                movePattern: [-8, -4, -6, -2, 1, 3, 2, -1, 0.5, 1.5]
            },
            'debt-ceiling': {
                startDate: '2023-05-15',
                endDate: '2023-06-02',
                description: 'US Debt Ceiling Drama',
                vixRange: [20, 28],
                movePattern: [-2, -1, -3, -1.5, 0, 1, 2, 1.5, 1, 0.5, -1, 0, 1, 2, 1.5, 2.5, 1, 0.5]
            },
            'fall-correction': {
                startDate: '2023-10-10',
                endDate: '2023-10-27',
                description: 'October 2023 Market Correction',
                vixRange: [18, 26],
                movePattern: [-1, -2, -3, -1, 1, -2, -1.5, -3, 0, 1, 2, 1.5, 0.5, -1, 1, 2, 1, 0.5]
            },
            // 2024 Events
            'march-rally': {
                startDate: '2024-03-01',
                endDate: '2024-03-28',
                description: 'Q1 2024 AI Rally',
                vixRange: [12, 18],
                movePattern: [1, 2, 1.5, 0.5, 1, 2.5, 1, 0, 1.5, 2, 1, 0.5, 1, 2, 1.5, 1, 0.5, 2, 1, 1.5, 0.5, 1, 2, 1, 1.5, 0.5, 1, 2]
            },
            'august-crash': {
                startDate: '2024-08-02',
                endDate: '2024-08-09',
                description: 'August 2024 VIX 65 Crash',
                vixRange: [15, 65],
                movePattern: [-1, -2, -8, -12, 3, 2, 1, 0.5]
            },
            'election-volatility': {
                startDate: '2024-11-01',
                endDate: '2024-11-08',
                description: '2024 Election Volatility',
                vixRange: [18, 24],
                movePattern: [-1, 1, -2, 3, 2, -1, 1, 2]
            }
        };
        
        // All symbols needed for comprehensive testing
        this.allSymbols = {
            indices: ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'M2K'],
            etfs: ['SPY', 'QQQ', 'IWM', 'GLD', 'TLT', 'SLV'],
            futures: ['CL', 'MCL', 'GC', 'MGC', 'SI', 'SIL'],
            volatility: ['VIX', 'VXN', 'RVX']
        };
        
        // Base prices for 2023 start (will evolve over time)
        this.basePrices2023 = {
            ES: 3900, MES: 3900, NQ: 11000, MNQ: 11000, RTY: 1800, M2K: 1800,
            SPY: 390, QQQ: 275, IWM: 180, GLD: 180, TLT: 105, SLV: 22,
            CL: 80, MCL: 80, GC: 1850, MGC: 1850, SI: 23, SIL: 23,
            VIX: 22, VXN: 25, RVX: 28
        };
        
        // Price evolution multipliers through 2024
        this.priceEvolution = {
            '2023-06': { ES: 1.05, SPY: 1.05, QQQ: 1.08, NQ: 1.08 },
            '2023-12': { ES: 1.15, SPY: 1.15, QQQ: 1.25, NQ: 1.25, GLD: 1.08 },
            '2024-06': { ES: 1.25, SPY: 1.25, QQQ: 1.35, NQ: 1.35, GLD: 1.12 },
            '2024-12': { ES: 1.35, SPY: 1.35, QQQ: 1.45, NQ: 1.45, GLD: 1.15, TLT: 0.92 }
        };
    }
    
    /**
     * Generate complete 2-year dataset with all market events
     */
    async generate2YearData() {
        console.log('🚀 Starting 2-year comprehensive data generation...');
        console.log('📅 Period: January 1, 2023 - December 31, 2024');
        
        const startDate = new Date('2023-01-01');
        const endDate = new Date('2024-12-31');
        const allData = {};
        
        // Initialize data structure for all symbols
        const symbols = Object.values(this.allSymbols).flat();
        symbols.forEach(symbol => {
            allData[symbol] = [];
        });
        
        let totalTradingDays = 0;
        let eventDays = 0;
        const eventsSummary = [];
        
        const current = new Date(startDate);
        
        while (current <= endDate) {
            // Skip weekends
            if (current.getDay() === 0 || current.getDay() === 6) {
                current.setDate(current.getDate() + 1);
                continue;
            }
            
            totalTradingDays++;
            const dateStr = current.toISOString().split('T')[0];
            
            // Check if this date is part of a market event
            const activeEvent = this.getActiveEvent(dateStr);
            let dayData;
            
            if (activeEvent) {
                dayData = this.generateEventData(current, activeEvent);
                eventDays++;
                console.log(`📊 ${dateStr}: ${activeEvent.description} (Day ${activeEvent.dayIndex})`);
            } else {
                // Regular market day with appropriate strategy focus
                dayData = this.generateRegularMarketDay(current);
            }
            
            // Add data to the main dataset
            symbols.forEach(symbol => {
                if (dayData[symbol]) {
                    allData[symbol].push(dayData[symbol]);
                } else {
                    // Fill missing symbols with correlated data
                    const correlatedData = this.generateCorrelatedData(symbol, current, dayData);
                    allData[symbol].push(correlatedData);
                }
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        // Save data to files
        console.log('\n💾 Saving data files...');
        await this.saveDataToFiles(allData);
        
        // Generate summary
        this.generateSummary(totalTradingDays, eventDays, eventsSummary);
        
        return allData;
    }
    
    /**
     * Check if a date falls within any market event period
     */
    getActiveEvent(dateStr) {
        for (const [eventKey, event] of Object.entries(this.marketEvents)) {
            if (dateStr >= event.startDate && dateStr <= event.endDate) {
                const startDate = new Date(event.startDate);
                const currentDate = new Date(dateStr);
                const dayIndex = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
                
                return {
                    ...event,
                    key: eventKey,
                    dayIndex
                };
            }
        }
        return null;
    }
    
    /**
     * Generate data for market event days
     */
    generateEventData(date, event) {
        const dayIndex = event.dayIndex;
        const movePercent = event.movePattern[dayIndex] || 0;
        const vixLevel = this.interpolateVix(event.vixRange, dayIndex, event.movePattern.length);
        
        const data = {};
        const basePrice = this.getEvolvingPrice('ES', date);
        
        // ES futures data
        const open = basePrice;
        const close = open * (1 + movePercent / 100);
        const high = Math.max(open, close) * (1 + Math.abs(movePercent) / 200);
        const low = Math.min(open, close) * (1 - Math.abs(movePercent) / 200);
        
        data.ES = {
            date: date.toISOString().split('T')[0],
            open,
            high,
            low,
            close,
            volume: 2000000 + Math.abs(movePercent) * 100000,
            iv: vixLevel / 100,
            atr: Math.abs(movePercent) * 5,
            rsi: movePercent > 0 ? 65 : 35,
            ema21: basePrice * 0.998,
            ema8: basePrice * 1.001,
            vwap: (open + high + low + close) / 4
        };
        
        // VIX data
        data.VIX = {
            date: date.toISOString().split('T')[0],
            open: vixLevel - 1,
            high: vixLevel + (Math.abs(movePercent) / 2),
            low: vixLevel - 2,
            close: vixLevel,
            volume: 500000 + Math.abs(movePercent) * 25000
        };
        
        // SPY and other ETFs
        const spyPrice = this.getEvolvingPrice('SPY', date);
        data.SPY = this.generateCorrelatedEquityData('SPY', date, spyPrice, movePercent, vixLevel);
        data.QQQ = this.generateCorrelatedEquityData('QQQ', date, this.getEvolvingPrice('QQQ', date), movePercent * 1.2, vixLevel);
        data.IWM = this.generateCorrelatedEquityData('IWM', date, this.getEvolvingPrice('IWM', date), movePercent * 0.8, vixLevel);
        
        return data;
    }
    
    /**
     * Generate regular market day data
     */
    generateRegularMarketDay(date) {
        const dayOfWeek = date.getDay();
        const isVolatile = Math.random() < 0.2; // 20% of days are more volatile
        const baseVix = isVolatile ? 20 + Math.random() * 8 : 15 + Math.random() * 5;
        const movePercent = isVolatile ? (Math.random() - 0.5) * 4 : (Math.random() - 0.5) * 2;
        
        const data = {};
        
        // Focus on specific strategies based on day of week
        if (dayOfWeek === 5) { // Friday - 0DTE focus
            return this.generateFriday0DTEData(date, movePercent > 0 ? 'bullish' : 'bearish');
        } else if (dayOfWeek === 1) { // Monday - LT112 focus  
            return this.generateLT112Data(date);
        } else { // Other days - Strangle opportunities
            return this.generateStrangleData(date);
        }
    }
    
    /**
     * Generate correlated data for symbols not explicitly handled
     */
    generateCorrelatedData(symbol, date, referenceData) {
        const basePrice = this.getEvolvingPrice(symbol, date);
        const refMove = referenceData.ES ? 
            (referenceData.ES.close - referenceData.ES.open) / referenceData.ES.open * 100 : 0;
        
        const correlation = this.getSymbolCorrelation(symbol);
        const movePercent = refMove * correlation * (0.8 + Math.random() * 0.4);
        
        const open = basePrice;
        const close = open * (1 + movePercent / 100);
        const high = Math.max(open, close) * 1.005;
        const low = Math.min(open, close) * 0.995;
        
        return {
            date: date.toISOString().split('T')[0],
            open,
            high,
            low,
            close,
            volume: this.getSymbolVolume(symbol),
            iv: (referenceData.VIX?.close || 18) / 100,
            ivRank: Math.min(100, Math.max(0, 50 + movePercent * 2)),
            ivPercentile: Math.min(100, Math.max(0, 45 + movePercent * 3))
        };
    }
    
    /**
     * Generate correlated equity data
     */
    generateCorrelatedEquityData(symbol, date, basePrice, movePercent, vixLevel) {
        const open = basePrice;
        const close = open * (1 + movePercent / 100);
        const high = Math.max(open, close) * (1 + Math.abs(movePercent) / 300);
        const low = Math.min(open, close) * (1 - Math.abs(movePercent) / 300);
        
        return {
            date: date.toISOString().split('T')[0],
            open,
            high,
            low,
            close,
            volume: this.getSymbolVolume(symbol) * (1 + Math.abs(movePercent) / 10),
            iv: vixLevel / 100,
            ivRank: Math.min(100, Math.max(0, 50 + movePercent * 2)),
            ivPercentile: Math.min(100, Math.max(0, 45 + movePercent * 3)),
            atr: Math.abs(movePercent) * basePrice / 100,
            rsi: movePercent > 0 ? Math.min(80, 50 + movePercent * 2) : Math.max(20, 50 + movePercent * 2)
        };
    }
    
    /**
     * Get evolving price for symbol based on date
     */
    getEvolvingPrice(symbol, date) {
        const basePrice = this.basePrices2023[symbol] || 100;
        const dateStr = date.toISOString().split('T')[0];
        
        let multiplier = 1;
        
        // Apply cumulative price evolution
        for (const [periodEnd, multipliers] of Object.entries(this.priceEvolution)) {
            if (dateStr >= periodEnd && multipliers[symbol]) {
                multiplier = multipliers[symbol];
            }
        }
        
        return basePrice * multiplier;
    }
    
    /**
     * Get symbol correlation to ES
     */
    getSymbolCorrelation(symbol) {
        const correlations = {
            MES: 0.99, SPY: 0.95, NQ: 0.85, MNQ: 0.85, QQQ: 0.85,
            RTY: 0.75, M2K: 0.75, IWM: 0.75,
            GLD: -0.2, TLT: -0.3, SLV: 0.1,
            CL: 0.3, MCL: 0.3, GC: -0.2, MGC: -0.2,
            VIX: -0.8, VXN: -0.75, RVX: -0.7
        };
        return correlations[symbol] || 0.5;
    }
    
    /**
     * Get typical volume for symbol
     */
    getSymbolVolume(symbol) {
        const volumes = {
            ES: 1500000, MES: 100000, NQ: 800000, MNQ: 50000,
            SPY: 50000000, QQQ: 25000000, IWM: 15000000,
            GLD: 5000000, TLT: 8000000, SLV: 10000000,
            CL: 300000, MCL: 20000, GC: 150000, MGC: 10000,
            VIX: 500000, VXN: 100000, RVX: 50000
        };
        return volumes[symbol] || 100000;
    }
    
    /**
     * Interpolate VIX level for event day
     */
    interpolateVix(vixRange, dayIndex, totalDays) {
        const progress = dayIndex / Math.max(1, totalDays - 1);
        return vixRange[0] + (vixRange[1] - vixRange[0]) * progress;
    }
    
    /**
     * Save data to files organized by asset class
     */
    async saveDataToFiles(allData) {
        const dataDir = './data/historical';
        
        // Create directory structure if it doesn't exist
        const dirs = ['futures', 'indices', 'stocks', 'volatility', 'etfs'];
        for (const dir of dirs) {
            const fullPath = path.join(dataDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }
        
        const assetClasses = {
            futures: ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'M2K', 'CL', 'MCL', 'GC', 'MGC', 'SI', 'SIL'],
            indices: ['SPX', 'NDX', 'RUT'],
            stocks: ['SPY', 'QQQ', 'IWM'],
            etfs: ['GLD', 'TLT', 'SLV'],
            volatility: ['VIX', 'VXN', 'RVX']
        };
        
        let totalSize = 0;
        const fileSummary = [];
        
        for (const [assetClass, symbols] of Object.entries(assetClasses)) {
            for (const symbol of symbols) {
                if (allData[symbol] && allData[symbol].length > 0) {
                    const fileName = `${symbol}_2023_2024.json`;
                    const filePath = path.join(dataDir, assetClass, fileName);
                    
                    const fileData = {
                        symbol,
                        period: '2023-2024',
                        totalBars: allData[symbol].length,
                        startDate: allData[symbol][0]?.date,
                        endDate: allData[symbol][allData[symbol].length - 1]?.date,
                        data: allData[symbol]
                    };
                    
                    fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
                    
                    const stats = fs.statSync(filePath);
                    totalSize += stats.size;
                    
                    fileSummary.push({
                        symbol,
                        assetClass,
                        fileName,
                        bars: allData[symbol].length,
                        sizeKB: Math.round(stats.size / 1024)
                    });
                    
                    console.log(`✅ Saved ${symbol}: ${allData[symbol].length} bars (${Math.round(stats.size / 1024)}KB)`);
                }
            }
        }
        
        // Save master index file
        const indexFile = {
            generated: new Date().toISOString(),
            period: '2023-2024',
            totalFiles: fileSummary.length,
            totalSizeMB: Math.round(totalSize / 1024 / 1024),
            files: fileSummary
        };
        
        fs.writeFileSync(path.join(dataDir, 'index_2023_2024.json'), JSON.stringify(indexFile, null, 2));
        console.log(`📋 Master index saved: ${fileSummary.length} files, ${Math.round(totalSize / 1024 / 1024)}MB total`);
        
        return fileSummary;
    }
    
    /**
     * Generate comprehensive summary
     */
    generateSummary(totalTradingDays, eventDays, eventsSummary) {
        console.log('\n📈 2-YEAR DATA GENERATION COMPLETE');
        console.log('=====================================');
        console.log(`📅 Total Trading Days: ${totalTradingDays}`);
        console.log(`⚡ Event Days: ${eventDays} (${Math.round(eventDays/totalTradingDays*100)}%)`);
        console.log(`🎯 Regular Market Days: ${totalTradingDays - eventDays}`);
        
        console.log('\n🎪 Major Market Events Included:');
        console.log('--------------------------------');
        for (const [key, event] of Object.entries(this.marketEvents)) {
            const days = event.movePattern.length;
            const maxVix = Math.max(...event.vixRange);
            const maxMove = Math.max(...event.movePattern.map(Math.abs));
            console.log(`${event.description}:`);
            console.log(`  📅 ${event.startDate} to ${event.endDate} (${days} days)`);
            console.log(`  📊 Max VIX: ${maxVix}, Max Move: ${maxMove}%`);
        }
        
        console.log('\n📋 Symbol Coverage:');
        console.log('------------------');
        const symbolCounts = Object.values(this.allSymbols).flat();
        console.log(`🎯 Futures: ${this.allSymbols.futures.length} symbols`);
        console.log(`📈 Indices: ${this.allSymbols.indices.length} symbols`);
        console.log(`🏢 ETFs: ${this.allSymbols.etfs.length} symbols`);  
        console.log(`⚡ Volatility: ${this.allSymbols.volatility.length} symbols`);
        console.log(`📊 Total: ${symbolCounts.length} symbols`);
        
        console.log('\n🧪 Strategy Test Coverage:');
        console.log('-------------------------');
        console.log('✅ Friday 0DTE trades (every Friday)');
        console.log('✅ LT112 120-day puts (every Monday)');
        console.log('✅90-day strangles (all products)');
        console.log('✅ VIX regime changes (12-65 range)');
        console.log('✅ Correlation stress tests (August 2024)');
        console.log('✅ Trending and sideways markets');
        console.log('✅ High volatility events (6 major events)');
        
        console.log('\n💾 Files saved to: ./data/historical/');
        console.log('Ready for comprehensive backtesting! 🚀');
    }
}

/**
 * Main execution function
 */
async function generateData() {
    try {
        const generator = new ComprehensiveDataGenerator();
        await generator.generate2YearData();
        
        console.log('\n🎉 SUCCESS: 2-year comprehensive test data generated!');
        console.log('📂 Location: ./data/historical/');
        console.log('🧪 Ready for Tom King Framework testing');
        
    } catch (error) {
        console.error('❌ Error generating data:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    generateData();
}

module.exports = ComprehensiveDataGenerator;