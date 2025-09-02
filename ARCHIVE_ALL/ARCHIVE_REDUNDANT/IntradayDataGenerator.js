/**
 * INTRADAY DATA GENERATOR - Professional Market Simulation
 * Generates realistic minute-level market data for professional backtesting
 * Designed specifically for options trading and 0DTE strategies
 * 
 * CRITICAL FEATURES:
 * - Realistic opening range patterns (9:30-10:00 AM high volume)
 * - Lunch hour consolidation (12:00-1:00 PM low volume)
 * - Power hour movements (3:00-4:00 PM increased activity)
 * - Options expiration pinning effects for Fridays
 * - VIX-correlated volatility regimes
 * - Volume-weighted price patterns
 * - Bid-ask spread variations by time of day
 * 
 * BASED ON:
 * - SPX/ES historical intraday patterns
 * - Options market maker behavior
 * - Institutional trading flows
 * - VIX regime analysis
 */

const { getLogger } = require('./src/logger');

class IntradayDataGenerator {
    constructor(config = {}) {
        this.logger = getLogger('INTRADAY_GENERATOR');
        this.config = config;
        
        // Market microstructure parameters based on real ES/SPY patterns
        this.patterns = {
            // Opening Range Patterns (9:30-10:00 AM)
            openingRange: {
                highVolatility: 0.015,  // 1.5% typical opening range
                volumeMultiplier: 3.5,  // 3.5x normal volume at open
                gapProbability: 0.15,   // 15% chance of gap
                reversalProbability: 0.6 // 60% chance of reversal from gap
            },
            
            // Lunch Hour Patterns (12:00-1:00 PM)
            lunchHour: {
                volatilityReduction: 0.4, // 40% reduction in volatility
                volumeReduction: 0.3,     // 70% reduction in volume
                consolidationBias: 0.8    // 80% likelihood of sideways movement
            },
            
            // Power Hour Patterns (3:00-4:00 PM)
            powerHour: {
                volatilityIncrease: 1.3,  // 30% increase in volatility
                volumeIncrease: 2.2,      // 120% increase in volume
                trendContinuation: 0.7,   // 70% trend continuation probability
                closingAuction: 1.8       // 80% volume spike last 10 minutes
            },
            
            // Options Expiration Effects (Fridays)
            expiration: {
                pinningRadius: 5,         // Points around major strikes
                pinningProbability: 0.3,  // 30% chance of pinning behavior
                majorStrikes: [25, 50, 75, 100], // Strike intervals that cause pinning
                gammaSqueeze: {
                    threshold: 0.02,      // 2% move threshold for gamma effects
                    acceleration: 1.5     // 50% acceleration of moves
                }
            },
            
            // VIX Regime Effects
            vixRegimes: {
                veryLow: { threshold: 12, volMultiplier: 0.6, meanReversion: 0.9 },
                low: { threshold: 16, volMultiplier: 0.8, meanReversion: 0.7 },
                normal: { threshold: 20, volMultiplier: 1.0, meanReversion: 0.5 },
                elevated: { threshold: 30, volMultiplier: 1.4, meanReversion: 0.3 },
                high: { threshold: 50, volMultiplier: 2.2, meanReversion: 0.1 }
            },
            
            // Volume Patterns
            volume: {
                // Typical intraday volume pattern (percentage of daily volume by hour)
                hourlyDistribution: [
                    0.18, // 9:30-10:30 (18% of daily volume)
                    0.12, // 10:30-11:30
                    0.10, // 11:30-12:30
                    0.08, // 12:30-1:30 (lunch)
                    0.09, // 1:30-2:30
                    0.11, // 2:30-3:30
                    0.15, // 3:30-4:00 (power hour - 30 minutes)
                    0.17  // After hours (if applicable)
                ],
                baseVolume: 1000000, // Base daily volume for ES
                spikeProbability: 0.05, // 5% chance of volume spike per bar
                spikeMultiplier: 4.0   // 4x volume on spikes
            }
        };
    }
    
    /**
     * Generate complete Friday 0DTE data (9:30 AM - 4:00 PM)
     * 390 minutes of 1-minute bars with realistic market behavior
     */
    async generateFridayData(date, symbol = 'ES') {
        this.logger.info('FRIDAY_DATA', `Generating Friday 0DTE data for ${date}`);
        
        const fridayData = new Map();
        const startTime = new Date(`${date}T09:30:00`);
        const endTime = new Date(`${date}T16:00:00`);
        
        // Get or simulate opening price and daily characteristics
        const dailyParams = await this.generateDailyParameters(date, symbol);
        
        let currentTime = new Date(startTime);
        let currentPrice = dailyParams.open;
        let cumulativeVolume = 0;
        
        // Track for realistic price evolution
        let lastPrice = dailyParams.prevClose;
        let sessionHigh = currentPrice;
        let sessionLow = currentPrice;
        
        while (currentTime <= endTime) {
            const timeKey = this.formatTimeKey(currentTime);
            const hourMinute = currentTime.getHours() + (currentTime.getMinutes() / 60);
            
            // Generate bar data with realistic patterns
            const barData = await this.generateMinuteBar({
                timestamp: new Date(currentTime),
                symbol,
                previousClose: lastPrice,
                currentPrice,
                sessionHigh,
                sessionLow,
                hourMinute,
                dailyParams,
                cumulativeVolume,
                isExpiration: true // Friday expiration
            });
            
            fridayData.set(timeKey, barData);
            
            // Update tracking variables
            lastPrice = barData.close;
            currentPrice = barData.close;
            sessionHigh = Math.max(sessionHigh, barData.high);
            sessionLow = Math.min(sessionLow, barData.low);
            cumulativeVolume += barData.volume;
            
            // Advance to next minute
            currentTime.setMinutes(currentTime.getMinutes() + 1);
        }
        
        this.logger.debug('FRIDAY_DATA', `Generated ${fridayData.size} minute bars`, {
            sessionRange: `${sessionLow.toFixed(2)} - ${sessionHigh.toFixed(2)}`,
            totalVolume: cumulativeVolume,
            finalPrice: lastPrice.toFixed(2)
        });
        
        return fridayData;
    }
    
    /**
     * Generate historical data for backtesting
     */
    async generateHistoricalData(symbol, startDate, endDate, resolution = '1min') {
        this.logger.info('HISTORICAL_DATA', `Generating data for ${symbol}`, {
            dateRange: `${startDate} to ${endDate}`,
            resolution
        });
        
        const data = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Generate base price series using geometric brownian motion
        const basePrices = this.generateBasePriceSeries(symbol, start, end);
        
        let dataIndex = 0;
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            const isExpiration = date.getDay() === 5; // Friday expiration
            const dailyData = await this.generateDayData(date, symbol, basePrices[dataIndex], resolution, isExpiration);
            
            data.push(...dailyData);
            dataIndex++;
        }
        
        this.logger.info('HISTORICAL_DATA', `Generated ${data.length} bars for ${symbol}`);
        return data;
    }
    
    /**
     * Generate daily parameters for realistic simulation
     */
    async generateDailyParameters(date, symbol) {
        // Base parameters for ES futures
        const basePrice = 4200; // Approximate ES level
        const dailyRange = 0.015; // 1.5% typical daily range
        
        // VIX level affects volatility
        const vixLevel = this.simulateVIX(date);
        const vixRegime = this.getVIXRegime(vixLevel);
        
        // Economic calendar effects (simplified)
        const isEconomicEvent = this.hasEconomicEvent(date);
        const eventMultiplier = isEconomicEvent ? 1.5 : 1.0;
        
        // Random walk with regime-based parameters
        const prevClose = basePrice + (Math.random() - 0.5) * 100;
        const gap = this.generateGap(vixRegime, isEconomicEvent);
        const open = prevClose + gap;
        
        return {
            date,
            symbol,
            prevClose,
            open,
            vixLevel,
            vixRegime,
            isEconomicEvent,
            dailyVolatility: dailyRange * vixRegime.volMultiplier * eventMultiplier,
            expectedRange: Math.abs(open * dailyRange * vixRegime.volMultiplier),
            targetHigh: open + (Math.random() * 0.6 + 0.4) * Math.abs(open * dailyRange),
            targetLow: open - (Math.random() * 0.6 + 0.4) * Math.abs(open * dailyRange)
        };
    }
    
    /**
     * Generate realistic minute bar with sophisticated patterns
     */
    async generateMinuteBar(params) {
        const {
            timestamp, symbol, previousClose, currentPrice, sessionHigh, sessionLow,
            hourMinute, dailyParams, cumulativeVolume, isExpiration
        } = params;
        
        // Time-based volume and volatility adjustments
        const volumeProfile = this.getVolumeProfile(hourMinute);
        const volatilityProfile = this.getVolatilityProfile(hourMinute, dailyParams.vixRegime);
        
        // Expiration pinning effects for Fridays
        let pinningEffect = 1.0;
        if (isExpiration && hourMinute > 14.0) { // After 2 PM on expiration
            pinningEffect = this.calculatePinningEffect(currentPrice, hourMinute);
        }
        
        // Calculate minute return using multiple factors
        const baseReturn = this.generateBaseReturn(dailyParams.vixRegime);
        const meanReversionForce = this.calculateMeanReversion(currentPrice, dailyParams);
        const volumeImpact = volumeProfile.impact;
        const timeDecayFactor = Math.max(0.1, (16 - hourMinute) / 6.5); // Decay toward close
        
        const totalReturn = (baseReturn + meanReversionForce) * 
                           volatilityProfile * 
                           volumeImpact * 
                           pinningEffect * 
                           timeDecayFactor;
        
        // Generate OHLC with microstructure realism
        const open = currentPrice;
        const close = open * (1 + totalReturn);
        
        // Realistic high/low based on volatility and volume
        const barRange = Math.abs(close - open) * (1 + Math.random());
        const high = Math.max(open, close) + barRange * Math.random() * 0.6;
        const low = Math.min(open, close) - barRange * Math.random() * 0.6;
        
        // Volume with realistic patterns
        const baseVolume = dailyParams.expectedRange > 0 ? 
            this.patterns.volume.baseVolume * volumeProfile.multiplier : 500;
        const volumeVariation = (Math.random() * 0.4 + 0.8); // 80-120% of expected
        const volume = Math.round(baseVolume * volumeVariation);
        
        // Technical indicators
        const vwap = this.calculateVWAP(cumulativeVolume, volume, (high + low + close) / 3);
        const rsi = this.calculateRSI(close, previousClose);
        
        // Option-specific data
        const impliedVol = this.calculateImpliedVolatility(dailyParams.vixLevel, hourMinute, totalReturn);
        const ivRank = this.calculateIVRank(impliedVol, symbol);
        
        return {
            timestamp,
            symbol,
            open: this.roundPrice(open),
            high: this.roundPrice(high),
            low: this.roundPrice(low),
            close: this.roundPrice(close),
            volume,
            vwap: this.roundPrice(vwap),
            
            // Technical indicators
            rsi: Math.max(0, Math.min(100, rsi)),
            
            // Options data
            iv: impliedVol,
            ivRank,
            vix: dailyParams.vixLevel,
            
            // Microstructure
            bidAskSpread: this.calculateBidAskSpread(impliedVol, volume, hourMinute),
            liquidity: this.calculateLiquidity(volume, Math.abs(totalReturn)),
            
            // Metadata
            timeOfDay: hourMinute,
            isExpiration,
            regime: dailyParams.vixRegime.name || 'normal'
        };
    }
    
    /**
     * Volume profile based on time of day
     */
    getVolumeProfile(hourMinute) {
        if (hourMinute < 10.5) {
            // Opening range - high volume
            return { multiplier: 3.5, impact: 1.2 };
        } else if (hourMinute >= 12 && hourMinute < 13) {
            // Lunch hour - low volume
            return { multiplier: 0.3, impact: 0.7 };
        } else if (hourMinute >= 15) {
            // Power hour - high volume
            return { multiplier: 2.2, impact: 1.3 };
        } else {
            // Regular trading - normal volume
            return { multiplier: 1.0, impact: 1.0 };
        }
    }
    
    /**
     * Volatility profile based on time and VIX regime
     */
    getVolatilityProfile(hourMinute, vixRegime) {
        let baseVolatility = vixRegime.volMultiplier;
        
        if (hourMinute < 10) {
            // High volatility at open
            baseVolatility *= 1.4;
        } else if (hourMinute >= 12 && hourMinute < 13) {
            // Low volatility during lunch
            baseVolatility *= 0.6;
        } else if (hourMinute >= 15.5) {
            // Increased volatility toward close
            baseVolatility *= 1.2;
        }
        
        return baseVolatility;
    }
    
    /**
     * Calculate options expiration pinning effect
     */
    calculatePinningEffect(currentPrice, hourMinute) {
        const { pinningRadius, pinningProbability, majorStrikes } = this.patterns.expiration;
        
        // Find nearest major strike
        let nearestStrike = null;
        let minDistance = Infinity;
        
        for (const interval of majorStrikes) {
            const strike = Math.round(currentPrice / interval) * interval;
            const distance = Math.abs(currentPrice - strike);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestStrike = strike;
            }
        }
        
        // Apply pinning if close to major strike and late in session
        if (minDistance <= pinningRadius && hourMinute > 14) {
            const pinningStrength = (16 - hourMinute) / 2; // Stronger closer to 4 PM
            const magneticForce = Math.exp(-minDistance / pinningRadius) * pinningStrength;
            
            return Math.random() < pinningProbability ? (1 - magneticForce * 0.3) : 1;
        }
        
        return 1;
    }
    
    /**
     * Generate base return using regime-appropriate distribution
     */
    generateBaseReturn(vixRegime) {
        // Use normal distribution with regime-adjusted parameters
        const mean = 0; // No directional bias
        const stdDev = vixRegime.volMultiplier * 0.001; // Base 1-minute volatility
        
        // Box-Muller transformation for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        
        return mean + stdDev * z0;
    }
    
    /**
     * Calculate mean reversion force
     */
    calculateMeanReversion(currentPrice, dailyParams) {
        const deviationFromOpen = (currentPrice - dailyParams.open) / dailyParams.open;
        const expectedRange = dailyParams.expectedRange / dailyParams.open;
        
        if (Math.abs(deviationFromOpen) > expectedRange) {
            // Strong mean reversion for moves beyond expected range
            return -deviationFromOpen * dailyParams.vixRegime.meanReversion * 0.1;
        }
        
        return 0;
    }
    
    /**
     * VIX simulation and regime detection
     */
    simulateVIX(date) {
        // Simplified VIX simulation based on market cycles
        const dayOfYear = this.getDayOfYear(date);
        const baseVIX = 18 + 8 * Math.sin(dayOfYear / 365 * 2 * Math.PI); // Seasonal pattern
        
        // Add random walk component
        const randomComponent = (Math.random() - 0.5) * 10;
        
        return Math.max(10, Math.min(80, baseVIX + randomComponent));
    }
    
    getVIXRegime(vixLevel) {
        for (const [name, regime] of Object.entries(this.patterns.vixRegimes)) {
            if (vixLevel <= regime.threshold) {
                return { ...regime, name };
            }
        }
        return { ...this.patterns.vixRegimes.high, name: 'high' };
    }
    
    /**
     * Calculate implied volatility for options
     */
    calculateImpliedVolatility(vixLevel, timeOfDay, priceMove) {
        // Base IV from VIX
        let iv = vixLevel / 100;
        
        // Time of day adjustments
        if (timeOfDay < 10 || timeOfDay > 15) {
            iv *= 1.1; // Higher IV at open/close
        }
        
        // Recent price movement impact
        iv += Math.abs(priceMove) * 5; // Higher IV after big moves
        
        return Math.max(0.08, Math.min(2.0, iv));
    }
    
    /**
     * Calculate bid-ask spread based on market conditions
     */
    calculateBidAskSpread(iv, volume, timeOfDay) {
        let baseSpread = 0.10; // 10 cents base
        
        // IV impact
        baseSpread *= (1 + iv * 2);
        
        // Volume impact (lower volume = wider spreads)
        const volumeImpact = Math.max(0.5, Math.min(2.0, 1000 / Math.sqrt(volume)));
        baseSpread *= volumeImpact;
        
        // Time of day impact
        if (timeOfDay < 9.75 || timeOfDay > 15.75) {
            baseSpread *= 1.3; // Wider spreads at open/close
        } else if (timeOfDay >= 12 && timeOfDay < 13) {
            baseSpread *= 1.5; // Wider spreads during lunch
        }
        
        return Math.round(baseSpread * 100) / 100; // Round to cents
    }
    
    /**
     * Utility methods
     */
    
    formatTimeKey(dateTime) {
        const date = dateTime.toISOString().split('T')[0];
        const time = dateTime.toTimeString().substr(0, 5);
        return `${date}_${time}`;
    }
    
    roundPrice(price) {
        // Round to ES tick size (0.25)
        return Math.round(price * 4) / 4;
    }
    
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    
    hasEconomicEvent(date) {
        // Simplified: assume 10% chance of significant economic event
        return Math.random() < 0.10;
    }
    
    generateGap(vixRegime, isEconomicEvent) {
        const maxGap = vixRegime.volMultiplier * 10; // Max gap in points
        const gapProbability = isEconomicEvent ? 0.3 : 0.15;
        
        if (Math.random() < gapProbability) {
            return (Math.random() - 0.5) * maxGap;
        }
        
        return 0;
    }
    
    calculateVWAP(cumulativeVolume, currentVolume, currentPrice) {
        // Simplified VWAP calculation
        const totalVolume = cumulativeVolume + currentVolume;
        if (totalVolume === 0) return currentPrice;
        
        // Assume equal weighting for simplicity
        return currentPrice; // In real implementation, would track cumulative volume-weighted prices
    }
    
    calculateRSI(currentPrice, previousPrice) {
        // Simplified RSI - in real implementation would use 14-period calculation
        const change = (currentPrice - previousPrice) / previousPrice;
        return 50 + (change * 1000); // Simplified transformation
    }
    
    calculateIVRank(iv, symbol) {
        // Simplified IV Rank calculation
        // In real implementation would use 1-year lookback
        const typicalIVs = { ES: 0.18, SPY: 0.15, QQQ: 0.22 };
        const typicalIV = typicalIVs[symbol] || 0.18;
        
        return Math.max(0, Math.min(100, (iv / typicalIV - 0.5) * 100 + 50));
    }
    
    calculateLiquidity(volume, priceMove) {
        // Liquidity score based on volume and price stability
        const baseScore = Math.min(100, volume / 1000);
        const stabilityPenalty = Math.abs(priceMove) * 10000;
        
        return Math.max(0, Math.min(100, baseScore - stabilityPenalty));
    }
    
    generateBasePriceSeries(symbol, startDate, endDate) {
        // Generate geometric brownian motion price series
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const prices = [];
        let currentPrice = 4200; // Base ES price
        
        for (let i = 0; i < days; i++) {
            const dailyReturn = (Math.random() - 0.5) * 0.02; // +/- 1% daily
            currentPrice *= (1 + dailyReturn);
            prices.push(currentPrice);
        }
        
        return prices;
    }
    
    async generateDayData(date, symbol, basePrice, resolution, isExpiration) {
        // Generate full day of data based on resolution
        const bars = [];
        const startTime = new Date(`${date.toISOString().split('T')[0]}T09:30:00`);
        const endTime = new Date(`${date.toISOString().split('T')[0]}T16:00:00`);
        
        // For minute bars, generate full session
        if (resolution === '1min') {
            let currentTime = new Date(startTime);
            let currentPrice = basePrice;
            
            while (currentTime <= endTime) {
                const dailyParams = await this.generateDailyParameters(date, symbol);
                dailyParams.open = basePrice;
                
                const bar = await this.generateMinuteBar({
                    timestamp: new Date(currentTime),
                    symbol,
                    previousClose: currentPrice,
                    currentPrice,
                    sessionHigh: currentPrice,
                    sessionLow: currentPrice,
                    hourMinute: currentTime.getHours() + (currentTime.getMinutes() / 60),
                    dailyParams,
                    cumulativeVolume: 0,
                    isExpiration
                });
                
                bars.push(bar);
                currentPrice = bar.close;
                currentTime.setMinutes(currentTime.getMinutes() + 1);
            }
        }
        
        return bars;
    }
}

module.exports = IntradayDataGenerator;