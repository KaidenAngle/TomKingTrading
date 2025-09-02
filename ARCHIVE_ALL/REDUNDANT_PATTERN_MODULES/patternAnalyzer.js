/**
 * TOM KING TRADING FRAMEWORK v17.2
 * Consolidated Pattern Analysis Module
 * Combines all pattern analysis functionality into a single, efficient module
 */

const config = require('../src/config');

class PatternAnalyzer {
    constructor() {
        this.vixRegimes = config.RISK_LIMITS.VIX_REGIMES;
        this.technicalConfig = config.TECHNICAL_CONFIG;
        this.cache = new Map();
    }

    /**
     * Main analysis entry point
     */
    async analyze(marketData, strategy = null) {
        const cacheKey = `${JSON.stringify(marketData)}_${strategy}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const analysis = {
            timestamp: new Date().toISOString(),
            marketData,
            indicators: this.calculateIndicators(marketData),
            vixRegime: this.getVIXRegime(marketData.VIX?.last || 18),
            patterns: this.detectPatterns(marketData),
            signals: this.generateSignals(marketData, strategy),
            confidence: 0
        };

        // Calculate overall confidence
        analysis.confidence = this.calculateConfidence(analysis);

        // Cache for 5 minutes
        this.cache.set(cacheKey, analysis);
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

        return analysis;
    }

    /**
     * Calculate technical indicators
     */
    calculateIndicators(marketData) {
        const prices = marketData.prices || [];
        const volume = marketData.volume || [];
        
        if (prices.length < 20) {
            return this.getDefaultIndicators();
        }

        return {
            // Moving Averages
            ema9: this.calculateEMA(prices, 9),
            ema21: this.calculateEMA(prices, 21),
            ema50: this.calculateEMA(prices, 50),
            sma20: this.calculateSMA(prices, 20),
            sma50: this.calculateSMA(prices, 50),
            sma200: this.calculateSMA(prices, 200),
            
            // Momentum
            rsi: this.calculateRSI(prices, 14),
            
            // Volatility
            atr: this.calculateATR(marketData, 14),
            bollinger: this.calculateBollingerBands(prices, 20, 2),
            
            // Volume
            vwap: this.calculateVWAP(prices, volume),
            volumeRatio: this.calculateVolumeRatio(volume),
            
            // Options specific
            ivRank: marketData.ivRank || 50,
            ivPercentile: marketData.ivPercentile || 50,
            putCallRatio: marketData.putCallRatio || 1.0
        };
    }

    /**
     * Get VIX regime
     */
    getVIXRegime(vixLevel) {
        for (const [regime, config] of Object.entries(this.vixRegimes)) {
            const [min, max] = config.range;
            if (vixLevel >= min && vixLevel <= max) {
                return {
                    name: regime,
                    ...config,
                    currentVIX: vixLevel
                };
            }
        }
        return { name: 'NORMAL', bpMultiplier: 1.0, riskMultiplier: 1.0 };
    }

    /**
     * Detect chart patterns
     */
    detectPatterns(marketData) {
        const patterns = [];
        const prices = marketData.prices || [];
        
        if (prices.length < 50) return patterns;

        // Trend patterns
        if (this.detectUptrend(prices)) {
            patterns.push({ type: 'UPTREND', strength: 'STRONG', confidence: 85 });
        }
        if (this.detectDowntrend(prices)) {
            patterns.push({ type: 'DOWNTREND', strength: 'STRONG', confidence: 85 });
        }
        
        // Reversal patterns
        if (this.detectDoubleTop(prices)) {
            patterns.push({ type: 'DOUBLE_TOP', strength: 'MEDIUM', confidence: 70 });
        }
        if (this.detectDoubleBottom(prices)) {
            patterns.push({ type: 'DOUBLE_BOTTOM', strength: 'MEDIUM', confidence: 70 });
        }
        
        // Continuation patterns
        if (this.detectFlag(prices)) {
            patterns.push({ type: 'FLAG', strength: 'MEDIUM', confidence: 65 });
        }
        if (this.detectTriangle(prices)) {
            patterns.push({ type: 'TRIANGLE', strength: 'MEDIUM', confidence: 60 });
        }

        return patterns;
    }

    /**
     * Generate trading signals based on strategy
     */
    generateSignals(marketData, strategy) {
        const signals = [];
        const indicators = this.calculateIndicators(marketData);
        const vixRegime = this.getVIXRegime(marketData.VIX?.last || 18);

        // Strategy-specific signals
        if (strategy === 'zeroDTE' || strategy === '0DTE') {
            signals.push(...this.generate0DTESignals(marketData, indicators, vixRegime));
        } else if (strategy === 'longTerm112' || strategy === 'LT112') {
            signals.push(...this.generateLT112Signals(marketData, indicators, vixRegime));
        } else if (strategy === 'strangles' || strategy === 'STRANGLE') {
            signals.push(...this.generateStrangleSignals(marketData, indicators, vixRegime));
        } else {
            // General signals
            signals.push(...this.generateGeneralSignals(marketData, indicators, vixRegime));
        }

        return signals;
    }

    /**
     * 0DTE specific signals
     */
    generate0DTESignals(marketData, indicators, vixRegime) {
        const signals = [];
        const day = new Date().getDay();
        const hour = new Date().getHours();
        const minute = new Date().getMinutes();

        // Check if it's Friday after 10:30 AM
        if (day !== 5 || hour < 10 || (hour === 10 && minute < 30)) {
            return signals;
        }

        // VIX check
        if (vixRegime.currentVIX > 35) {
            signals.push({ type: 'WAIT', reason: 'VIX too high for 0DTE', confidence: 100 });
            return signals;
        }

        // RSI conditions
        if (indicators.rsi > 70) {
            signals.push({
                type: 'SELL_CALL_SPREAD',
                strike: 'ATM + 1%',
                confidence: 75,
                size: this.calculate0DTESize(vixRegime)
            });
        } else if (indicators.rsi < 30) {
            signals.push({
                type: 'SELL_PUT_SPREAD',
                strike: 'ATM - 1%',
                confidence: 75,
                size: this.calculate0DTESize(vixRegime)
            });
        }

        // Trend following
        if (this.detectStrongTrend(marketData)) {
            signals.push({
                type: 'IRON_CONDOR',
                confidence: 80,
                size: this.calculate0DTESize(vixRegime)
            });
        }

        return signals;
    }

    /**
     * LT112 specific signals
     */
    generateLT112Signals(marketData, indicators, vixRegime) {
        const signals = [];
        const day = new Date().getDay();

        // Only Monday through Wednesday
        if (day === 0 || day > 3) {
            return signals;
        }

        // IV Rank check
        if (indicators.ivRank < 20) {
            signals.push({ type: 'WAIT', reason: 'IV Rank too low', confidence: 100 });
            return signals;
        }

        // Generate strangle signal
        if (indicators.ivRank > 30 && vixRegime.currentVIX < 40) {
            signals.push({
                type: 'STRANGLE',
                dte: 112,
                putDelta: -10,
                callDelta: 10,
                confidence: this.calculateLT112Confidence(indicators, vixRegime),
                size: 1
            });
        }

        return signals;
    }

    /**
     * Strangle specific signals
     */
    generateStrangleSignals(marketData, indicators, vixRegime) {
        const signals = [];
        const day = new Date().getDay();

        // Only Tuesday
        if (day !== 2) {
            return signals;
        }

        // IV Rank check
        if (indicators.ivRank < 30) {
            signals.push({ type: 'WAIT', reason: 'IV Rank too low for strangles', confidence: 100 });
            return signals;
        }

        // Generate strangle signal
        signals.push({
            type: 'SHORT_STRANGLE',
            dte: 90,
            putDelta: -15,
            callDelta: 15,
            confidence: this.calculateStrangleConfidence(indicators, vixRegime),
            size: 1
        });

        return signals;
    }

    /**
     * General trading signals
     */
    generateGeneralSignals(marketData, indicators, vixRegime) {
        const signals = [];

        // Oversold bounce
        if (indicators.rsi < 30 && indicators.bollinger.percentB < 0) {
            signals.push({
                type: 'BULLISH',
                reason: 'Oversold bounce setup',
                confidence: 70
            });
        }

        // Overbought reversal
        if (indicators.rsi > 70 && indicators.bollinger.percentB > 1) {
            signals.push({
                type: 'BEARISH',
                reason: 'Overbought reversal setup',
                confidence: 70
            });
        }

        // Trend continuation
        const ema9 = indicators.ema9[indicators.ema9.length - 1];
        const ema21 = indicators.ema21[indicators.ema21.length - 1];
        const ema50 = indicators.ema50[indicators.ema50.length - 1];

        if (ema9 > ema21 && ema21 > ema50) {
            signals.push({
                type: 'BULLISH_CONTINUATION',
                reason: 'EMA alignment bullish',
                confidence: 65
            });
        }

        return signals;
    }

    /**
     * Calculate overall confidence score
     */
    calculateConfidence(analysis) {
        let confidence = 50; // Base confidence

        // VIX regime adjustment
        const vixRegime = analysis.vixRegime;
        if (vixRegime.name === 'NORMAL' || vixRegime.name === 'ELEVATED') {
            confidence += 10;
        } else if (vixRegime.name === 'EXTREME') {
            confidence -= 20;
        }

        // Pattern confirmation
        if (analysis.patterns.length > 0) {
            const avgPatternConfidence = analysis.patterns.reduce((sum, p) => sum + p.confidence, 0) / analysis.patterns.length;
            confidence += (avgPatternConfidence - 50) * 0.3;
        }

        // Signal agreement
        const signalTypes = new Set(analysis.signals.map(s => s.type.split('_')[0]));
        if (signalTypes.size === 1 && analysis.signals.length > 1) {
            confidence += 15; // All signals agree
        }

        // IV Rank adjustment
        const ivRank = analysis.indicators.ivRank;
        if (ivRank > 30 && ivRank < 70) {
            confidence += 5; // Good IV environment
        }

        return Math.max(0, Math.min(100, Math.round(confidence)));
    }

    // Technical indicator calculations
    calculateEMA(prices, period) {
        if (prices.length < period) return [];
        
        const multiplier = 2 / (period + 1);
        const ema = [this.calculateSMA(prices.slice(0, period), period)[0]];
        
        for (let i = period; i < prices.length; i++) {
            ema.push((prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1]);
        }
        
        return ema;
    }

    calculateSMA(prices, period) {
        if (prices.length < period) return [];
        
        const sma = [];
        for (let i = period - 1; i < prices.length; i++) {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        
        return sma;
    }

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return 50;
        
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }
        
        let avgGain = 0;
        let avgLoss = 0;
        
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) avgGain += changes[i];
            else avgLoss -= changes[i];
        }
        
        avgGain /= period;
        avgLoss /= period;
        
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    calculateATR(marketData, period = 14) {
        const highs = marketData.highs || [];
        const lows = marketData.lows || [];
        const closes = marketData.closes || marketData.prices || [];
        
        if (highs.length < period || lows.length < period) return 0;
        
        const trueRanges = [];
        for (let i = 1; i < highs.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            trueRanges.push(tr);
        }
        
        return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    }

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        const sma = this.calculateSMA(prices, period);
        if (sma.length === 0) return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
        
        const lastSMA = sma[sma.length - 1];
        const relevantPrices = prices.slice(-period);
        
        const variance = relevantPrices.reduce((sum, price) => {
            return sum + Math.pow(price - lastSMA, 2);
        }, 0) / period;
        
        const std = Math.sqrt(variance);
        const currentPrice = prices[prices.length - 1];
        
        return {
            upper: lastSMA + (std * stdDev),
            middle: lastSMA,
            lower: lastSMA - (std * stdDev),
            percentB: (currentPrice - (lastSMA - std * stdDev)) / (2 * std * stdDev)
        };
    }

    calculateVWAP(prices, volumes) {
        if (!prices || !volumes || prices.length === 0) return 0;
        
        let cumVolume = 0;
        let cumPV = 0;
        
        for (let i = 0; i < Math.min(prices.length, volumes.length); i++) {
            cumPV += prices[i] * volumes[i];
            cumVolume += volumes[i];
        }
        
        return cumVolume === 0 ? prices[prices.length - 1] : cumPV / cumVolume;
    }

    calculateVolumeRatio(volumes) {
        if (!volumes || volumes.length < 20) return 1;
        
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];
        
        return avgVolume === 0 ? 1 : currentVolume / avgVolume;
    }

    // Pattern detection helpers
    detectUptrend(prices) {
        if (prices.length < 20) return false;
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);
        
        if (sma20.length === 0 || sma50.length === 0) return false;
        
        return sma20[sma20.length - 1] > sma50[sma50.length - 1] &&
               prices[prices.length - 1] > sma20[sma20.length - 1];
    }

    detectDowntrend(prices) {
        if (prices.length < 20) return false;
        const sma20 = this.calculateSMA(prices, 20);
        const sma50 = this.calculateSMA(prices, 50);
        
        if (sma20.length === 0 || sma50.length === 0) return false;
        
        return sma20[sma20.length - 1] < sma50[sma50.length - 1] &&
               prices[prices.length - 1] < sma20[sma20.length - 1];
    }

    detectDoubleTop(prices) {
        if (prices.length < 50) return false;
        // Simplified double top detection
        const recentHigh = Math.max(...prices.slice(-20));
        const previousHigh = Math.max(...prices.slice(-40, -20));
        
        return Math.abs(recentHigh - previousHigh) / previousHigh < 0.02;
    }

    detectDoubleBottom(prices) {
        if (prices.length < 50) return false;
        // Simplified double bottom detection
        const recentLow = Math.min(...prices.slice(-20));
        const previousLow = Math.min(...prices.slice(-40, -20));
        
        return Math.abs(recentLow - previousLow) / previousLow < 0.02;
    }

    detectFlag(prices) {
        if (prices.length < 30) return false;
        // Simplified flag pattern detection
        const trend = prices[prices.length - 1] - prices[prices.length - 30];
        const consolidation = Math.max(...prices.slice(-10)) - Math.min(...prices.slice(-10));
        
        return Math.abs(trend) > consolidation * 3;
    }

    detectTriangle(prices) {
        if (prices.length < 30) return false;
        // Simplified triangle pattern detection
        const highs = [];
        const lows = [];
        
        for (let i = 0; i < 30; i += 5) {
            const slice = prices.slice(-30 + i, -25 + i);
            highs.push(Math.max(...slice));
            lows.push(Math.min(...slice));
        }
        
        const highsConverging = highs[0] > highs[highs.length - 1];
        const lowsConverging = lows[0] < lows[lows.length - 1];
        
        return highsConverging && lowsConverging;
    }

    detectStrongTrend(marketData) {
        const prices = marketData.prices || [];
        if (prices.length < 20) return false;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const trend = avgReturn * Math.sqrt(returns.length);
        
        return Math.abs(trend) > 0.02;
    }

    // Position sizing helpers
    calculate0DTESize(vixRegime) {
        const baseSize = 1;
        if (vixRegime.currentVIX < 15) return baseSize;
        if (vixRegime.currentVIX < 20) return baseSize;
        if (vixRegime.currentVIX < 25) return Math.floor(baseSize * 0.75);
        return Math.floor(baseSize * 0.5);
    }

    calculateLT112Confidence(indicators, vixRegime) {
        let confidence = 60;
        
        if (indicators.ivRank > 40) confidence += 10;
        if (indicators.ivRank > 60) confidence += 10;
        if (vixRegime.currentVIX > 20 && vixRegime.currentVIX < 30) confidence += 10;
        if (indicators.rsi > 30 && indicators.rsi < 70) confidence += 5;
        
        return Math.min(95, confidence);
    }

    calculateStrangleConfidence(indicators, vixRegime) {
        let confidence = 65;
        
        if (indicators.ivRank > 50) confidence += 15;
        if (vixRegime.currentVIX > 18 && vixRegime.currentVIX < 25) confidence += 10;
        if (indicators.bollinger.percentB > 0.2 && indicators.bollinger.percentB < 0.8) confidence += 5;
        
        return Math.min(90, confidence);
    }

    // Default values
    getDefaultIndicators() {
        return {
            ema9: [],
            ema21: [],
            ema50: [],
            sma20: [],
            sma50: [],
            sma200: [],
            rsi: 50,
            atr: 0,
            bollinger: { upper: 0, middle: 0, lower: 0, percentB: 0.5 },
            vwap: 0,
            volumeRatio: 1,
            ivRank: 50,
            ivPercentile: 50,
            putCallRatio: 1.0
        };
    }
}

module.exports = PatternAnalyzer;