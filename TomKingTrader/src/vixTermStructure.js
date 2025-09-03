/**
 * VIX TERM STRUCTURE ANALYSIS
 * Complete implementation of VIX volatility term structure analysis
 * Based on Tom King methodology for volatility regime detection and trading signals
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class VIXTermStructureAnalyzer {
    constructor(api = null) {
        this.api = api;
        
        // VIX family symbols for term structure
        this.vixSymbols = {
            'VIX9D': 'VIX9D',      // 9-day expected volatility
            'VIX': 'VIX',          // 30-day expected volatility (standard)
            'VIX3M': 'VIX3M',      // 3-month expected volatility
            'VIX6M': 'VIX6M'       // 6-month expected volatility
        };
        
        // VX futures symbols (when available)
        this.vxFutures = [
            '/VXF24', '/VXG24', '/VXH24', '/VXJ24', // 2024 contracts
            '/VXK24', '/VXM24', '/VXN24', '/VXQ24'
        ];
        
        // Term structure analysis thresholds based on Tom King methodology
        this.thresholds = {
            backwardationThreshold: -2.0,    // VIX > VIX3M by 2+ points
            steepContangoThreshold: 5.0,     // VIX3M > VIX by 5+ points
            inversionThreshold: 1.0,         // VIX9D > VIX by 1+ point
            extremeVIXThreshold: 35,         // Extreme volatility level
            normalVIXRange: { min: 12, max: 20 }
        };
        
        // Historical term structure cache
        this.termStructureHistory = [];
        this.maxHistoryLength = 252; // 1 year of trading days
        
        logger.info('VIX', 'VIX Term Structure Analyzer initialized');
    }

    /**
     * Get current VIX term structure data from multiple sources
     */
    async getCurrentTermStructure() {
        try {
            const termStructure = {};
            
            // 1. Try to get VIX family data from TastyTrade API
            for (const [key, symbol] of Object.entries(this.vixSymbols)) {
                try {
                    if (this.api && this.api.getQuotes) {
                        const quotes = await this.api.getQuotes([symbol]);
                        if (quotes && quotes[symbol]) {
                            termStructure[key] = {
                                symbol: symbol,
                                price: parseFloat(quotes[symbol].last || quotes[symbol].mark || 0),
                                change: parseFloat(quotes[symbol]['net-change'] || 0),
                                changePercent: parseFloat(quotes[symbol]['net-change-percent'] || 0),
                                timestamp: new Date().toISOString(),
                                source: 'TastyTrade_API'
                            };
                        }
                    }
                } catch (error) {
                    logger.debug('VIX', `Could not fetch ${symbol}:`, error.message);
                }
            }
            
            // 2. If we don't have all VIX data, use VIX and calculate implied structure
            if (!termStructure.VIX && this.api) {
                try {
                    const vixQuotes = await this.api.getQuotes(['VIX']);
                    if (vixQuotes && vixQuotes.VIX) {
                        const vixPrice = parseFloat(vixQuotes.VIX.last || vixQuotes.VIX.mark || 16);
                        
                        termStructure.VIX = {
                            symbol: 'VIX',
                            price: vixPrice,
                            change: parseFloat(vixQuotes.VIX['net-change'] || 0),
                            changePercent: parseFloat(vixQuotes.VIX['net-change-percent'] || 0),
                            timestamp: new Date().toISOString(),
                            source: 'TastyTrade_API'
                        };
                        
                        // Estimate missing VIX data using typical relationships
                        if (!termStructure.VIX9D) {
                            termStructure.VIX9D = {
                                symbol: 'VIX9D',
                                price: vixPrice * 0.95, // Typically slightly lower than VIX
                                change: 0,
                                changePercent: 0,
                                timestamp: new Date().toISOString(),
                                source: 'Estimated_from_VIX'
                            };
                        }
                        
                        if (!termStructure.VIX3M) {
                            // VIX3M typically trades in contango (higher than VIX)
                            const contangoAdjustment = this.calculateTypicalContango(vixPrice);
                            termStructure.VIX3M = {
                                symbol: 'VIX3M',
                                price: vixPrice + contangoAdjustment,
                                change: 0,
                                changePercent: 0,
                                timestamp: new Date().toISOString(),
                                source: 'Estimated_from_VIX'
                            };
                        }
                        
                        if (!termStructure.VIX6M) {
                            // VIX6M typically even higher in normal contango
                            const contangoAdjustment = this.calculateTypicalContango(vixPrice) * 1.5;
                            termStructure.VIX6M = {
                                symbol: 'VIX6M',
                                price: vixPrice + contangoAdjustment,
                                change: 0,
                                changePercent: 0,
                                timestamp: new Date().toISOString(),
                                source: 'Estimated_from_VIX'
                            };
                        }
                    }
                } catch (error) {
                    logger.warn('VIX', 'Failed to fetch VIX data for term structure', error);
                }
            }
            
            // 3. Fallback to default structure if no API data
            if (Object.keys(termStructure).length === 0) {
                logger.warn('VIX', 'Using default VIX term structure - no real data available');
                termStructure.VIX9D = { symbol: 'VIX9D', price: 15.5, source: 'Default' };
                termStructure.VIX = { symbol: 'VIX', price: 16.0, source: 'Default' };
                termStructure.VIX3M = { symbol: 'VIX3M', price: 18.5, source: 'Default' };
                termStructure.VIX6M = { symbol: 'VIX6M', price: 20.0, source: 'Default' };
            }
            
            // Add analysis timestamp
            termStructure.analysisTimestamp = new Date().toISOString();
            
            logger.debug('VIX', 'Term structure data collected', {
                vix9d: termStructure.VIX9D?.price,
                vix: termStructure.VIX?.price,
                vix3m: termStructure.VIX3M?.price,
                vix6m: termStructure.VIX6M?.price
            });
            
            return termStructure;
            
        } catch (error) {
            logger.error('VIX', 'Failed to get VIX term structure', error);
            throw error;
        }
    }

    /**
     * Calculate typical contango adjustment based on VIX level
     */
    calculateTypicalContango(vixLevel) {
        // Historical analysis shows contango varies with VIX level
        if (vixLevel > 30) return 0.5;  // High VIX - minimal contango
        if (vixLevel > 25) return 1.5;  // Elevated VIX
        if (vixLevel > 20) return 2.5;  // Normal-high VIX
        if (vixLevel > 15) return 3.5;  // Normal VIX
        return 4.5; // Low VIX - steep contango
    }

    /**
     * Analyze VIX term structure and classify regime
     */
    async analyzeTermStructure(termStructureData = null) {
        try {
            const data = termStructureData || await this.getCurrentTermStructure();
            
            const vix9d = data.VIX9D?.price || 16;
            const vix = data.VIX?.price || 16;
            const vix3m = data.VIX3M?.price || 18;
            const vix6m = data.VIX6M?.price || 20;
            
            const analysis = {
                timestamp: new Date().toISOString(),
                rawData: data,
                
                // Basic structure metrics
                vix9dToVix: parseFloat((vix9d - vix).toFixed(2)),
                vixToVix3m: parseFloat((vix - vix3m).toFixed(2)),
                vix3mToVix6m: parseFloat((vix3m - vix6m).toFixed(2)),
                totalSlope: parseFloat((vix6m - vix9d).toFixed(2)),
                
                // Percentage relationships
                vix9dToVixPct: parseFloat(((vix9d / vix - 1) * 100).toFixed(2)),
                vixToVix3mPct: parseFloat(((vix / vix3m - 1) * 100).toFixed(2)),
                
                // Structure classification
                regime: this.classifyVolatilityRegime(vix),
                structureType: this.classifyStructureType(vix9d, vix, vix3m, vix6m),
                
                // Trading signals based on Tom King methodology
                signals: this.generateTradingSignals(vix9d, vix, vix3m, vix6m),
                
                // Risk warnings
                warnings: this.generateStructureWarnings(vix9d, vix, vix3m, vix6m)
            };
            
            // Store in history for trend analysis
            this.addToHistory(analysis);
            
            logger.info('VIX', 'Term structure analysis completed', {
                regime: analysis.regime,
                structureType: analysis.structureType,
                vix9dToVix: analysis.vix9dToVix,
                vixToVix3m: analysis.vixToVix3m,
                signals: analysis.signals.length
            });
            
            return analysis;
            
        } catch (error) {
            logger.error('VIX', 'Term structure analysis failed', error);
            throw error;
        }
    }

    /**
     * Classify volatility regime based on VIX level
     */
    classifyVolatilityRegime(vixLevel) {
        if (vixLevel < 12) return 'EXTREMELY_LOW';
        if (vixLevel < 15) return 'LOW';
        if (vixLevel < 20) return 'NORMAL';
        if (vixLevel < 25) return 'ELEVATED';
        if (vixLevel < 35) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Classify term structure shape
     */
    classifyStructureType(vix9d, vix, vix3m, vix6m) {
        const shortTermInversion = vix9d > vix;
        const backwardation = vix > vix3m;
        const steepContango = (vix3m - vix) > this.thresholds.steepContangoThreshold;
        
        if (shortTermInversion && backwardation) {
            return 'FULL_BACKWARDATION';
        } else if (shortTermInversion) {
            return 'SHORT_TERM_INVERSION';
        } else if (backwardation) {
            return 'BACKWARDATION';
        } else if (steepContango) {
            return 'STEEP_CONTANGO';
        } else {
            return 'NORMAL_CONTANGO';
        }
    }

    /**
     * Generate trading signals based on term structure
     */
    generateTradingSignals(vix9d, vix, vix3m, vix6m) {
        const signals = [];
        
        // 1. Backwardation signal (bullish for vol sellers)
        if (vix > vix3m + this.thresholds.backwardationThreshold) {
            signals.push({
                type: 'BACKWARDATION',
                severity: 'HIGH',
                message: `VIX ${vix.toFixed(1)} > VIX3M ${vix3m.toFixed(1)} - Backwardation detected`,
                implication: 'Favorable for premium selling strategies',
                action: 'INCREASE_POSITION_SIZING'
            });
        }
        
        // 2. Short-term inversion (potential volatility spike)
        if (vix9d > vix + this.thresholds.inversionThreshold) {
            signals.push({
                type: 'SHORT_TERM_INVERSION',
                severity: 'MEDIUM',
                message: `VIX9D ${vix9d.toFixed(1)} > VIX ${vix.toFixed(1)} - Short-term spike`,
                implication: 'Potential volatility event in next 1-2 weeks',
                action: 'REDUCE_POSITION_SIZING'
            });
        }
        
        // 3. Steep contango (premium decay environment)
        if ((vix3m - vix) > this.thresholds.steepContangoThreshold) {
            signals.push({
                type: 'STEEP_CONTANGO',
                severity: 'LOW',
                message: `VIX3M ${vix3m.toFixed(1)} >> VIX ${vix.toFixed(1)} - Steep contango`,
                implication: 'Strong premium decay environment',
                action: 'FAVORABLE_FOR_SELLING'
            });
        }
        
        // 4. Extreme VIX level
        if (vix > this.thresholds.extremeVIXThreshold) {
            signals.push({
                type: 'EXTREME_VOLATILITY',
                severity: 'CRITICAL',
                message: `VIX ${vix.toFixed(1)} - Extreme volatility level`,
                implication: 'High risk environment - reduce exposure',
                action: 'EMERGENCY_REDUCTION'
            });
        }
        
        // 5. Normal range signal
        if (vix >= this.thresholds.normalVIXRange.min && vix <= this.thresholds.normalVIXRange.max) {
            signals.push({
                type: 'NORMAL_RANGE',
                severity: 'LOW',
                message: `VIX ${vix.toFixed(1)} in normal range`,
                implication: 'Standard trading environment',
                action: 'NORMAL_OPERATIONS'
            });
        }
        
        return signals;
    }

    /**
     * Generate structure-based risk warnings
     */
    generateStructureWarnings(vix9d, vix, vix3m, vix6m) {
        const warnings = [];
        
        // Check for unusual patterns
        if (vix9d > vix && vix > vix3m && vix3m > vix6m) {
            warnings.push({
                type: 'INVERTED_CURVE',
                message: 'Entire volatility curve is inverted - high risk environment',
                severity: 'CRITICAL'
            });
        }
        
        if (Math.abs(vix9d - vix6m) < 1.0) {
            warnings.push({
                type: 'FLAT_CURVE',
                message: 'Volatility curve is unusually flat - potential regime change',
                severity: 'MEDIUM'
            });
        }
        
        if ((vix6m - vix9d) > 10) {
            warnings.push({
                type: 'EXTREME_CONTANGO',
                message: 'Extreme contango - potential for rapid curve flattening',
                severity: 'MEDIUM'
            });
        }
        
        return warnings;
    }

    /**
     * Add analysis to historical tracking
     */
    addToHistory(analysis) {
        this.termStructureHistory.push({
            timestamp: analysis.timestamp,
            vix9d: analysis.rawData.VIX9D?.price,
            vix: analysis.rawData.VIX?.price,
            vix3m: analysis.rawData.VIX3M?.price,
            vix6m: analysis.rawData.VIX6M?.price,
            regime: analysis.regime,
            structureType: analysis.structureType
        });
        
        // Keep only recent history
        if (this.termStructureHistory.length > this.maxHistoryLength) {
            this.termStructureHistory.shift();
        }
    }

    /**
     * Analyze term structure trends over time
     */
    analyzeTrends(lookbackPeriod = 20) {
        if (this.termStructureHistory.length < 2) {
            return { trend: 'INSUFFICIENT_DATA', confidence: 0 };
        }
        
        const recentData = this.termStructureHistory.slice(-lookbackPeriod);
        
        // Calculate VIX trend
        const vixValues = recentData.map(d => d.vix).filter(v => v);
        const vixTrend = this.calculateTrend(vixValues);
        
        // Calculate structure slope trend
        const slopeValues = recentData.map(d => (d.vix3m - d.vix)).filter(s => !isNaN(s));
        const slopeTrend = this.calculateTrend(slopeValues);
        
        // Regime stability
        const regimes = recentData.map(d => d.regime);
        const regimeStability = this.calculateRegimeStability(regimes);
        
        return {
            vixTrend: vixTrend,
            slopeTrend: slopeTrend,
            regimeStability: regimeStability,
            dataPoints: recentData.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate trend direction and strength
     */
    calculateTrend(values) {
        if (values.length < 2) return { direction: 'FLAT', strength: 0 };
        
        // Simple linear regression
        const n = values.length;
        const sumX = n * (n + 1) / 2;
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
        const sumX2 = n * (n + 1) * (2 * n + 1) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        let direction = 'FLAT';
        if (slope > 0.1) direction = 'RISING';
        else if (slope < -0.1) direction = 'FALLING';
        
        return {
            direction: direction,
            strength: Math.abs(slope),
            slope: parseFloat(slope.toFixed(4))
        };
    }

    /**
     * Calculate regime stability
     */
    calculateRegimeStability(regimes) {
        const uniqueRegimes = [...new Set(regimes)];
        const stability = 1 - (uniqueRegimes.length - 1) / regimes.length;
        
        return {
            stability: parseFloat(stability.toFixed(3)),
            uniqueRegimes: uniqueRegimes.length,
            currentRegime: regimes[regimes.length - 1],
            changes: regimes.length - uniqueRegimes.length
        };
    }

    /**
     * Get complete term structure analysis for trading decisions
     */
    async getCompleteAnalysis() {
        try {
            const termStructure = await this.getCurrentTermStructure();
            const analysis = await this.analyzeTermStructure(termStructure);
            const trends = this.analyzeTrends();
            
            return {
                current: analysis,
                trends: trends,
                timestamp: new Date().toISOString(),
                recommendation: this.generateTradeRecommendation(analysis, trends)
            };
            
        } catch (error) {
            logger.error('VIX', 'Complete analysis failed', error);
            throw error;
        }
    }

    /**
     * Generate trading recommendation based on complete analysis
     */
    generateTradeRecommendation(analysis, trends) {
        const signals = analysis.signals;
        const warnings = analysis.warnings;
        
        // Count severity levels
        const criticalSignals = signals.filter(s => s.severity === 'CRITICAL').length;
        const highSignals = signals.filter(s => s.severity === 'HIGH').length;
        
        let recommendation = 'NORMAL_OPERATIONS';
        let confidence = 50;
        let reason = 'Standard market conditions';
        
        // Determine recommendation based on signals
        if (criticalSignals > 0) {
            recommendation = 'REDUCE_EXPOSURE';
            confidence = 90;
            reason = 'Critical volatility signals detected';
        } else if (highSignals > 0 && warnings.length > 1) {
            recommendation = 'CAUTIOUS_APPROACH';
            confidence = 75;
            reason = 'Multiple warning signals present';
        } else if (analysis.structureType === 'BACKWARDATION') {
            recommendation = 'FAVORABLE_CONDITIONS';
            confidence = 80;
            reason = 'Backwardation favors premium selling';
        } else if (analysis.structureType === 'STEEP_CONTANGO') {
            recommendation = 'INCREASE_ACTIVITY';
            confidence = 70;
            reason = 'Strong premium decay environment';
        }
        
        return {
            action: recommendation,
            confidence: confidence,
            reason: reason,
            suggestedBPUsage: this.calculateSuggestedBPUsage(analysis, trends),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate suggested buying power usage based on VIX analysis
     */
    calculateSuggestedBPUsage(analysis, trends) {
        const baseUsage = 65; // Tom King's typical usage
        let adjustment = 0;
        
        const vix = analysis.rawData.VIX?.price || 16;
        
        // VIX level adjustments
        if (vix > 35) adjustment -= 30;      // Extreme: 35%
        else if (vix > 25) adjustment -= 15; // High: 50%
        else if (vix > 20) adjustment += 0;  // Elevated: 65%
        else if (vix < 12) adjustment -= 10; // Too low: 55%
        
        // Structure adjustments
        if (analysis.structureType === 'FULL_BACKWARDATION') adjustment -= 20;
        else if (analysis.structureType === 'BACKWARDATION') adjustment += 5;
        else if (analysis.structureType === 'STEEP_CONTANGO') adjustment += 10;
        
        // Trend adjustments
        if (trends.vixTrend?.direction === 'RISING' && trends.vixTrend?.strength > 0.5) {
            adjustment -= 15;
        }
        
        const suggestedUsage = Math.max(25, Math.min(80, baseUsage + adjustment));
        
        return {
            suggested: suggestedUsage,
            base: baseUsage,
            adjustment: adjustment,
            reasoning: this.explainBPAdjustment(adjustment, analysis, trends)
        };
    }

    /**
     * Explain BP usage adjustment reasoning
     */
    explainBPAdjustment(adjustment, analysis, trends) {
        const reasons = [];
        
        const vix = analysis.rawData.VIX?.price || 16;
        if (vix > 35) reasons.push('Extreme VIX level - major reduction');
        else if (vix > 25) reasons.push('High VIX - moderate reduction');
        else if (vix < 12) reasons.push('Very low VIX - slight reduction');
        
        if (analysis.structureType === 'BACKWARDATION') {
            reasons.push('Backwardation - favorable environment');
        } else if (analysis.structureType === 'STEEP_CONTANGO') {
            reasons.push('Steep contango - premium decay advantage');
        }
        
        if (trends.vixTrend?.direction === 'RISING') {
            reasons.push('Rising VIX trend - increased caution');
        }
        
        return reasons.join('; ');
    }

    /**
     * Get term structure summary for logging/display
     */
    async getTermStructureSummary() {
        try {
            const analysis = await this.getCompleteAnalysis();
            
            return {
                vixLevel: analysis.current.rawData.VIX?.price,
                regime: analysis.current.regime,
                structureType: analysis.current.structureType,
                signalCount: analysis.current.signals.length,
                warningCount: analysis.current.warnings.length,
                recommendation: analysis.recommendation.action,
                suggestedBP: analysis.recommendation.suggestedBPUsage.suggested,
                timestamp: analysis.timestamp
            };
            
        } catch (error) {
            logger.error('VIX', 'Failed to get term structure summary', error);
            return {
                vixLevel: 16,
                regime: 'UNKNOWN',
                structureType: 'UNKNOWN',
                error: error.message
            };
        }
    }
}

module.exports = { VIXTermStructureAnalyzer };