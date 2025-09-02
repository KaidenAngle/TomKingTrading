/**
 * Test Data Generator for Tom King Trading Framework
 * Generates realistic market conditions that trigger trades
 */

class TestDataGenerator {
    constructor() {
        this.scenarios = {
            // Friday 0DTE scenarios
            friday0DTE: {
                bullish: { movePercent: 0.6, vix: 18 },
                bearish: { movePercent: -0.7, vix: 22 },
                neutral: { movePercent: 0.1, vix: 16 }
            },
            // LT112 scenarios  
            lt112: {
                normal: { vix: 20, trend: 'sideways' },
                elevated: { vix: 28, trend: 'down' }
            },
            // Strangle scenarios
            strangle: {
                highVol: { vix: 25, ivRank: 75 },
                normalVol: { vix: 18, ivRank: 50 }
            }
        };
    }

    /**
     * Generate data that will trigger 0DTE trades on Fridays
     */
    generateFriday0DTEData(date, scenario = 'bullish') {
        const config = this.scenarios.friday0DTE[scenario];
        const basePrice = 5450; // ES base price
        
        const open = basePrice;
        const close = open * (1 + config.movePercent / 100);
        const high = Math.max(open, close) * 1.005;
        const low = Math.min(open, close) * 0.995;
        
        return {
            ES: {
                date: date.toISOString().split('T')[0],
                open,
                high,
                low, 
                close,
                volume: 1500000,
                iv: config.vix / 100
            },
            VIX: {
                date: date.toISOString().split('T')[0],
                open: config.vix - 0.5,
                high: config.vix + 1,
                low: config.vix - 1,
                close: config.vix,
                volume: 500000
            }
        };
    }

    /**
     * Generate data for LT112 strategy (120 DTE puts)
     */
    generateLT112Data(date) {
        const basePrice = 5450;
        const vix = 20; // Good VIX level for LT112
        
        return {
            ES: {
                date: date.toISOString().split('T')[0],
                open: basePrice - 10,
                high: basePrice + 15,
                low: basePrice - 20,
                close: basePrice,
                volume: 1200000,
                iv: vix / 100,
                ema21: basePrice - 5,
                ema8: basePrice + 2
            },
            MES: {
                date: date.toISOString().split('T')[0],
                open: basePrice - 10,
                high: basePrice + 15,
                low: basePrice - 20,
                close: basePrice,
                volume: 50000,
                iv: vix / 100
            },
            VIX: {
                date: date.toISOString().split('T')[0],
                close: vix
            }
        };
    }

    /**
     * Generate data for Strangle strategy (90 DTE)
     */
    generateStrangleData(date) {
        const symbols = ['MCL', 'MGC', 'MES', 'MNQ', 'GLD', 'TLT', 'SLV'];
        const data = {};
        
        symbols.forEach((symbol, index) => {
            const basePrice = this.getSymbolBasePrice(symbol);
            const vix = 18 + (index * 2); // Vary VIX for different symbols
            
            data[symbol] = {
                date: date.toISOString().split('T')[0],
                open: basePrice * 0.99,
                high: basePrice * 1.01,
                low: basePrice * 0.98,
                close: basePrice,
                volume: 100000 + (index * 10000),
                iv: vix / 100,
                ivRank: 40 + (index * 5),
                ivPercentile: 45 + (index * 5)
            };
        });
        
        data.VIX = {
            date: date.toISOString().split('T')[0],
            close: 20
        };
        
        return data;
    }

    /**
     * Get base price for symbol
     */
    getSymbolBasePrice(symbol) {
        const prices = {
            ES: 5450,
            MES: 5450,
            NQ: 19500,
            MNQ: 19500,
            CL: 75,
            MCL: 75,
            GC: 2050,
            MGC: 2050,
            SPY: 545,
            QQQ: 485,
            IWM: 225,
            TLT: 90,
            GLD: 240,
            SLV: 28
        };
        return prices[symbol] || 100;
    }

    /**
     * Generate complete dataset for backtesting period
     */
    generateCompleteDataset(startDate, endDate) {
        const data = {};
        const symbols = ['ES', 'MES', 'SPY', 'QQQ', 'IWM', 'VIX', 'MCL', 'MGC', 'MNQ', 'GLD', 'TLT', 'SLV'];
        
        // Initialize data structure for each symbol
        symbols.forEach(symbol => {
            data[symbol] = [];
        });
        
        const current = new Date(startDate);
        const end = new Date(endDate);
        
        while (current <= end) {
            const dayOfWeek = current.getDay();
            
            // Skip weekends
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                current.setDate(current.getDate() + 1);
                continue;
            }
            
            let dayData;
            
            // Generate appropriate data based on day
            if (dayOfWeek === 5) { // Friday - 0DTE day
                // Alternate between bullish and bearish scenarios
                const scenario = Math.random() > 0.5 ? 'bullish' : 'bearish';
                dayData = this.generateFriday0DTEData(current, scenario);
            } else if (dayOfWeek === 1) { // Monday - good for LT112
                dayData = this.generateLT112Data(current);
            } else { // Other days - Strangle opportunities
                dayData = this.generateStrangleData(current);
            }
            
            // Add generated data to the dataset
            Object.keys(dayData).forEach(symbol => {
                if (data[symbol]) {
                    data[symbol].push(dayData[symbol]);
                }
            });
            
            // Fill in missing symbols with default data
            symbols.forEach(symbol => {
                if (!dayData[symbol]) {
                    const basePrice = this.getSymbolBasePrice(symbol);
                    const defaultBar = {
                        date: current.toISOString().split('T')[0],
                        open: basePrice,
                        high: basePrice * 1.002,
                        low: basePrice * 0.998,
                        close: basePrice * (1 + (Math.random() - 0.5) * 0.01),
                        volume: 100000,
                        iv: 0.18
                    };
                    data[symbol].push(defaultBar);
                }
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        return data;
    }

    /**
     * Generate August 2024 crash scenario
     */
    generateAugust2024Scenario() {
        const crashDate = new Date('2024-08-05');
        const data = {};
        
        // Generate 10 days before and after the crash
        for (let i = -10; i <= 10; i++) {
            const date = new Date(crashDate);
            date.setDate(date.getDate() + i);
            
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            let vix, movePercent;
            
            if (i < -2) {
                // Normal conditions before
                vix = 16 + Math.random() * 4;
                movePercent = (Math.random() - 0.5) * 1;
            } else if (i >= -2 && i <= 0) {
                // Building tension
                vix = 20 + Math.abs(i) * 5;
                movePercent = -1 - Math.abs(i);
            } else if (i === 1) {
                // Crash day
                vix = 65;
                movePercent = -12;
            } else {
                // Recovery
                vix = Math.max(20, 65 - i * 5);
                movePercent = Math.min(3, i * 0.5);
            }
            
            const dayData = this.generateCrashDayData(date, vix, movePercent);
            
            Object.keys(dayData).forEach(symbol => {
                if (!data[symbol]) data[symbol] = [];
                data[symbol].push(dayData[symbol]);
            });
        }
        
        return data;
    }

    /**
     * Generate crash day data
     */
    generateCrashDayData(date, vix, movePercent) {
        const symbols = ['ES', 'SPY', 'QQQ', 'IWM', 'VIX'];
        const data = {};
        
        symbols.forEach(symbol => {
            if (symbol === 'VIX') {
                data[symbol] = {
                    date: date.toISOString().split('T')[0],
                    open: vix - 2,
                    high: vix + 3,
                    low: vix - 3,
                    close: vix,
                    volume: 1000000
                };
            } else {
                const basePrice = this.getSymbolBasePrice(symbol);
                const open = basePrice;
                const close = open * (1 + movePercent / 100);
                
                data[symbol] = {
                    date: date.toISOString().split('T')[0],
                    open,
                    high: Math.max(open, close) * 1.01,
                    low: Math.min(open, close) * 0.99,
                    close,
                    volume: 2000000,
                    iv: vix / 100
                };
            }
        });
        
        return data;
    }
}

module.exports = TestDataGenerator;