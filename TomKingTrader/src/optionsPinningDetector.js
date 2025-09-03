/**
 * Options Expiration Pinning Detection Module
 * Advanced detection and analysis of options pinning behavior
 * Implements Tom King's understanding of expiration dynamics and gamma effects
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Pin Risk Configuration and Thresholds
 */
const PIN_RISK_CONFIG = {
    // Distance thresholds for pin detection (as percentage of underlying price)
    CRITICAL_PIN_RANGE: 0.005,    // 0.5% - Very high pin risk
    HIGH_PIN_RANGE: 0.010,        // 1.0% - High pin risk  
    MEDIUM_PIN_RANGE: 0.015,      // 1.5% - Medium pin risk
    LOW_PIN_RANGE: 0.025,         // 2.5% - Low pin risk
    
    // Gamma exposure thresholds
    HIGH_GAMMA_THRESHOLD: 1000000,   // $1M+ gamma exposure indicates strong pinning force
    MEDIUM_GAMMA_THRESHOLD: 500000,  // $500K+ gamma exposure
    LOW_GAMMA_THRESHOLD: 250000,     // $250K+ gamma exposure
    
    // Open interest thresholds
    HIGH_OI_THRESHOLD: 10000,        // 10K+ contracts
    MEDIUM_OI_THRESHOLD: 5000,       // 5K+ contracts
    LOW_OI_THRESHOLD: 2000,          // 2K+ contracts
    
    // Volume vs OI ratios
    HIGH_VOLUME_RATIO: 0.5,          // Volume > 50% of OI indicates active trading
    MEDIUM_VOLUME_RATIO: 0.3,        // Volume > 30% of OI
    LOW_VOLUME_RATIO: 0.15,          // Volume > 15% of OI
    
    // Time decay factors (hours before expiration)
    CRITICAL_TIME_HOURS: 4,          // Last 4 hours - maximum pin effect
    HIGH_TIME_HOURS: 24,             // Last 24 hours - strong pin effect
    MEDIUM_TIME_HOURS: 72,           // Last 3 days - building pin effect
    
    // Market cap considerations
    LARGE_CAP_MIN: 100000000000,     // $100B+ market cap
    MID_CAP_MIN: 10000000000,        // $10B+ market cap
    SMALL_CAP_MIN: 2000000000        // $2B+ market cap
};

/**
 * Pin Detection Algorithms
 */
const PIN_ALGORITHMS = {
    // Standard pin detection based on price proximity to strikes
    PRICE_PROXIMITY: 'price_proximity',
    
    // Gamma-weighted pin detection considering delta hedging flows
    GAMMA_WEIGHTED: 'gamma_weighted',
    
    // Open interest concentration analysis
    OPEN_INTEREST: 'open_interest',
    
    // Volume flow analysis
    VOLUME_FLOW: 'volume_flow',
    
    // Combined multi-factor model
    MULTI_FACTOR: 'multi_factor'
};

/**
 * Options Pinning Detector
 */
class OptionsPinningDetector extends EventEmitter {
    constructor(api = null, config = {}) {
        super();
        
        this.api = api;
        
        this.config = {
            enabled: config.enabled !== false,
            algorithms: config.algorithms || [PIN_ALGORITHMS.MULTI_FACTOR],
            updateInterval: config.updateInterval || 300000, // 5 minutes
            urgentUpdateInterval: config.urgentUpdateInterval || 60000, // 1 minute for expiration day
            
            // Risk thresholds (override defaults if provided)
            ...PIN_RISK_CONFIG,
            ...config.thresholds,
            
            // Auto-alert settings
            alertThreshold: config.alertThreshold || 'MEDIUM', // Minimum risk level to alert
            alertChannels: config.alertChannels || ['LOG', 'EVENT'], // LOG, EVENT, EMAIL, SMS
            
            // Historical analysis
            historicalDays: config.historicalDays || 30,
            trackAccuracy: config.trackAccuracy !== false,
            
            // Debug and testing
            debug: config.debug || false,
            simulationMode: config.simulationMode || false
        };
        
        // State management
        this.pinDetections = new Map(); // symbol -> pin analysis
        this.historicalPins = [];
        this.monitoringInterval = null;
        this.expirationCalendar = new Map(); // Track upcoming expirations
        
        // Statistics
        this.stats = {
            totalAnalyses: 0,
            pinsDetected: 0,
            accuratePredictions: 0,
            falsePositives: 0,
            averageAccuracy: 0
        };
        
        logger.info('PIN_DETECTOR', 'Options Pinning Detector initialized', {
            algorithms: this.config.algorithms,
            updateInterval: this.config.updateInterval / 1000,
            alertThreshold: this.config.alertThreshold
        });
    }
    
    /**
     * Start pinning detection monitoring
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            logger.warn('PIN_DETECTOR', 'Monitoring already active');
            return;
        }
        
        logger.info('PIN_DETECTOR', 'Starting options pinning detection');
        
        // Initial scan
        this.scanForPinning();
        
        // Set up regular monitoring
        this.monitoringInterval = setInterval(() => {
            this.scanForPinning();
        }, this.config.updateInterval);
        
        // Update expiration calendar
        this.updateExpirationCalendar();
        
        this.emit('monitoring_started');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('PIN_DETECTOR', 'Monitoring stopped');
            this.emit('monitoring_stopped');
        }
    }
    
    /**
     * Main scanning function for pinning detection
     */
    async scanForPinning() {
        try {
            this.stats.totalAnalyses++;
            
            // Get list of symbols to analyze
            const symbols = await this.getSymbolsToAnalyze();
            
            if (symbols.length === 0) {
                logger.debug('PIN_DETECTOR', 'No symbols to analyze');
                return;
            }
            
            const detections = [];
            
            // Analyze each symbol
            for (const symbol of symbols) {
                try {
                    const detection = await this.analyzeSymbolPinning(symbol);
                    if (detection && detection.riskLevel !== 'NONE') {
                        detections.push(detection);
                        this.pinDetections.set(symbol, detection);
                    }
                } catch (error) {
                    logger.error('PIN_DETECTOR', `Failed to analyze ${symbol}:`, error);
                }
            }
            
            // Process detections
            if (detections.length > 0) {
                this.processDetections(detections);
                this.stats.pinsDetected += detections.filter(d => d.riskLevel !== 'LOW').length;
            }
            
            // Clean up old detections
            this.cleanupOldDetections();
            
        } catch (error) {
            logger.error('PIN_DETECTOR', 'Error in pinning scan:', error);
        }
    }
    
    /**
     * Get symbols that should be analyzed for pinning
     */
    async getSymbolsToAnalyze() {
        const symbols = [];
        
        try {
            // Get symbols with expiring options (0-7 DTE)
            const expiringSymbols = await this.getExpiringOptions();
            symbols.push(...expiringSymbols);
            
            // Add high-volume symbols
            const highVolumeSymbols = await this.getHighVolumeSymbols();
            symbols.push(...highVolumeSymbols);
            
            // Add manually tracked symbols
            const trackedSymbols = this.getTrackedSymbols();
            symbols.push(...trackedSymbols);
            
            // Remove duplicates
            return [...new Set(symbols)];
            
        } catch (error) {
            logger.error('PIN_DETECTOR', 'Failed to get symbols for analysis:', error);
            return [];
        }
    }
    
    /**
     * Analyze a specific symbol for pinning behavior
     */
    async analyzeSymbolPinning(symbol) {
        try {
            // Get market data
            const marketData = await this.getMarketData(symbol);
            if (!marketData) {
                return null;
            }
            
            // Get option chain data
            const optionChain = await this.getOptionChain(symbol);
            if (!optionChain) {
                return null;
            }
            
            // Find next expiration
            const nextExpiration = this.findNextExpiration(optionChain);
            if (!nextExpiration) {
                return null;
            }
            
            // Calculate time to expiration
            const timeToExp = this.calculateTimeToExpiration(nextExpiration.expiration);
            
            // Skip if too far from expiration (unless specifically requested)
            if (timeToExp.hours > this.config.MEDIUM_TIME_HOURS && !this.isTrackedSymbol(symbol)) {
                return null;
            }
            
            const analysis = {
                symbol: symbol,
                timestamp: new Date().toISOString(),
                currentPrice: marketData.price,
                expiration: nextExpiration.expiration,
                timeToExpiration: timeToExp,
                riskLevel: 'NONE',
                pinScore: 0,
                algorithms: {},
                strikes: {},
                recommendations: []
            };
            
            // Apply selected algorithms
            for (const algorithm of this.config.algorithms) {
                const result = await this.applyAlgorithm(algorithm, symbol, marketData, optionChain, nextExpiration);
                analysis.algorithms[algorithm] = result;
                analysis.pinScore = Math.max(analysis.pinScore, result.score);
            }
            
            // Determine overall risk level
            analysis.riskLevel = this.calculateRiskLevel(analysis.pinScore, timeToExp);
            
            // Find specific pin strikes
            analysis.strikes = this.identifyPinStrikes(marketData.price, nextExpiration, analysis.pinScore);
            
            // Generate recommendations
            analysis.recommendations = this.generateRecommendations(analysis);
            
            return analysis;
            
        } catch (error) {
            logger.error('PIN_DETECTOR', `Error analyzing ${symbol}:`, error);
            return null;
        }
    }
    
    /**
     * Apply specific pin detection algorithm
     */
    async applyAlgorithm(algorithm, symbol, marketData, optionChain, expiration) {
        switch (algorithm) {
            case PIN_ALGORITHMS.PRICE_PROXIMITY:
                return this.priceProximityAlgorithm(marketData, expiration);
            
            case PIN_ALGORITHMS.GAMMA_WEIGHTED:
                return this.gammaWeightedAlgorithm(marketData, expiration);
                
            case PIN_ALGORITHMS.OPEN_INTEREST:
                return this.openInterestAlgorithm(expiration);
                
            case PIN_ALGORITHMS.VOLUME_FLOW:
                return this.volumeFlowAlgorithm(expiration);
                
            case PIN_ALGORITHMS.MULTI_FACTOR:
                return this.multiFactorAlgorithm(symbol, marketData, expiration);
                
            default:
                logger.warn('PIN_DETECTOR', `Unknown algorithm: ${algorithm}`);
                return { score: 0, confidence: 0, factors: [] };
        }
    }
    
    /**
     * Price proximity algorithm - basic pin detection
     */
    priceProximityAlgorithm(marketData, expiration) {
        const result = {
            score: 0,
            confidence: 0.7,
            factors: [],
            nearestStrikes: []
        };
        
        const price = marketData.price;
        const strikes = this.getAllStrikes(expiration);
        
        // Find nearest strikes
        const sortedStrikes = strikes.sort((a, b) => Math.abs(price - a.strike) - Math.abs(price - b.strike));
        const nearest = sortedStrikes.slice(0, 5);
        
        for (const strike of nearest) {
            const distance = Math.abs(price - strike.strike) / price;
            let strikeScore = 0;
            
            if (distance <= this.config.CRITICAL_PIN_RANGE) {
                strikeScore = 90;
                result.factors.push(`Critical pin range at ${strike.strike}`);
            } else if (distance <= this.config.HIGH_PIN_RANGE) {
                strikeScore = 70;
                result.factors.push(`High pin range at ${strike.strike}`);
            } else if (distance <= this.config.MEDIUM_PIN_RANGE) {
                strikeScore = 50;
                result.factors.push(`Medium pin range at ${strike.strike}`);
            } else if (distance <= this.config.LOW_PIN_RANGE) {
                strikeScore = 30;
                result.factors.push(`Low pin range at ${strike.strike}`);
            }
            
            // Weight by open interest
            if (strike.totalOI > this.config.HIGH_OI_THRESHOLD) {
                strikeScore *= 1.3;
            } else if (strike.totalOI > this.config.MEDIUM_OI_THRESHOLD) {
                strikeScore *= 1.15;
            }
            
            result.score = Math.max(result.score, strikeScore);
            result.nearestStrikes.push({
                strike: strike.strike,
                distance: distance,
                score: strikeScore,
                openInterest: strike.totalOI
            });
        }
        
        return result;
    }
    
    /**
     * Gamma-weighted algorithm considering delta hedging flows
     */
    gammaWeightedAlgorithm(marketData, expiration) {
        const result = {
            score: 0,
            confidence: 0.85,
            factors: [],
            gammaExposure: 0,
            netGamma: 0
        };
        
        const price = marketData.price;
        const strikes = this.getAllStrikes(expiration);
        
        let totalGammaExposure = 0;
        let netGamma = 0;
        
        // Calculate gamma exposure for each strike
        for (const strike of strikes) {
            if (!strike.calls || !strike.puts) continue;
            
            // Estimate gamma (simplified - would use actual Greeks in production)
            const gamma = this.estimateGamma(price, strike.strike, expiration.dte);
            
            // Calculate position gamma exposure
            const callGammaExp = (strike.calls.openInterest || 0) * gamma * 100 * price * price * 0.01;
            const putGammaExp = (strike.puts.openInterest || 0) * gamma * 100 * price * price * 0.01;
            
            const strikeGammaExp = Math.abs(callGammaExp - putGammaExp);
            totalGammaExposure += strikeGammaExp;
            
            // Net gamma calculation (calls positive, puts negative)
            netGamma += callGammaExp - putGammaExp;
            
            // Check if this strike has high gamma exposure
            if (strikeGammaExp > this.config.HIGH_GAMMA_THRESHOLD) {
                const distance = Math.abs(price - strike.strike) / price;
                const pinScore = Math.max(0, 90 - (distance * 3000)); // Score decreases with distance
                
                if (pinScore > result.score) {
                    result.score = pinScore;
                    result.factors.push(`High gamma exposure at ${strike.strike}: $${(strikeGammaExp / 1000000).toFixed(1)}M`);
                }
            }
        }
        
        result.gammaExposure = totalGammaExposure;
        result.netGamma = netGamma;
        
        // Overall gamma exposure assessment
        if (totalGammaExposure > this.config.HIGH_GAMMA_THRESHOLD * 5) {
            result.score = Math.max(result.score, 75);
            result.factors.push(`Very high total gamma exposure: $${(totalGammaExposure / 1000000).toFixed(1)}M`);
        }
        
        return result;
    }
    
    /**
     * Open interest concentration algorithm
     */
    openInterestAlgorithm(expiration) {
        const result = {
            score: 0,
            confidence: 0.75,
            factors: [],
            concentratedStrikes: []
        };
        
        const strikes = this.getAllStrikes(expiration);
        
        // Calculate total open interest
        let totalOI = 0;
        for (const strike of strikes) {
            totalOI += (strike.calls?.openInterest || 0) + (strike.puts?.openInterest || 0);
        }
        
        if (totalOI === 0) return result;
        
        // Find strikes with high OI concentration
        for (const strike of strikes) {
            const strikeOI = (strike.calls?.openInterest || 0) + (strike.puts?.openInterest || 0);
            const oiPercentage = strikeOI / totalOI;
            
            if (oiPercentage > 0.15) { // 15%+ of total OI
                const score = Math.min(80, oiPercentage * 400);
                result.concentratedStrikes.push({
                    strike: strike.strike,
                    openInterest: strikeOI,
                    percentage: oiPercentage,
                    score: score
                });
                
                result.score = Math.max(result.score, score);
                result.factors.push(`High OI concentration at ${strike.strike}: ${(oiPercentage * 100).toFixed(1)}%`);
            }
        }
        
        return result;
    }
    
    /**
     * Volume flow algorithm
     */
    volumeFlowAlgorithm(expiration) {
        const result = {
            score: 0,
            confidence: 0.6,
            factors: [],
            volumeFlows: []
        };
        
        const strikes = this.getAllStrikes(expiration);
        
        for (const strike of strikes) {
            if (!strike.calls || !strike.puts) continue;
            
            const callVolume = strike.calls.volume || 0;
            const putVolume = strike.puts.volume || 0;
            const callOI = strike.calls.openInterest || 0;
            const putOI = strike.puts.openInterest || 0;
            
            const totalVolume = callVolume + putVolume;
            const totalOI = callOI + putOI;
            
            if (totalOI === 0) continue;
            
            const volumeRatio = totalVolume / totalOI;
            
            if (volumeRatio > this.config.HIGH_VOLUME_RATIO) {
                const score = Math.min(60, volumeRatio * 100);
                result.volumeFlows.push({
                    strike: strike.strike,
                    volume: totalVolume,
                    openInterest: totalOI,
                    ratio: volumeRatio,
                    score: score
                });
                
                result.score = Math.max(result.score, score);
                result.factors.push(`High volume activity at ${strike.strike}: ${(volumeRatio * 100).toFixed(1)}% ratio`);
            }
        }
        
        return result;
    }
    
    /**
     * Multi-factor algorithm combining all approaches
     */
    multiFactorAlgorithm(symbol, marketData, expiration) {
        const result = {
            score: 0,
            confidence: 0.9,
            factors: [],
            components: {}
        };
        
        // Get individual algorithm results
        const proximity = this.priceProximityAlgorithm(marketData, expiration);
        const gamma = this.gammaWeightedAlgorithm(marketData, expiration);
        const oi = this.openInterestAlgorithm(expiration);
        const volume = this.volumeFlowAlgorithm(expiration);
        
        result.components = { proximity, gamma, oi, volume };
        
        // Weighted combination
        const weights = {
            proximity: 0.35,
            gamma: 0.30,
            oi: 0.25,
            volume: 0.10
        };
        
        result.score = (
            proximity.score * weights.proximity +
            gamma.score * weights.gamma +
            oi.score * weights.oi +
            volume.score * weights.volume
        );
        
        // Combine factors
        result.factors = [
            ...proximity.factors,
            ...gamma.factors,
            ...oi.factors,
            ...volume.factors
        ];
        
        // Time decay adjustment
        const timeMultiplier = this.getTimeDecayMultiplier(expiration.dte);
        result.score *= timeMultiplier;
        
        if (timeMultiplier > 1) {
            result.factors.push(`Time decay amplification: ${timeMultiplier.toFixed(2)}x`);
        }
        
        return result;
    }
    
    /**
     * Process detected pinning and generate alerts
     */
    processDetections(detections) {
        // Sort by score
        detections.sort((a, b) => b.pinScore - a.pinScore);
        
        if (this.config.debug) {
            console.log('\n' + '='.repeat(70));
            console.log('📍 OPTIONS PINNING DETECTIONS');
            console.log('='.repeat(70));
            
            for (const detection of detections) {
                const icon = this.getRiskIcon(detection.riskLevel);
                const timeStr = `${detection.timeToExpiration.hours}h ${detection.timeToExpiration.minutes}m`;
                
                console.log(`\n${icon} ${detection.symbol} - Risk: ${detection.riskLevel} (Score: ${detection.pinScore.toFixed(1)})`);
                console.log(`   Expiration: ${detection.expiration} (${timeStr})`);
                console.log(`   Current Price: $${detection.currentPrice.toFixed(2)}`);
                
                if (detection.strikes.primary) {
                    console.log(`   Primary Pin Strike: $${detection.strikes.primary.strike} (${detection.strikes.primary.distance}% away)`);
                }
                
                if (detection.recommendations.length > 0) {
                    console.log(`   Recommendations: ${detection.recommendations.join(', ')}`);
                }
            }
            
            console.log('\n' + '='.repeat(70));
        }
        
        // Emit events for high-risk detections
        const highRiskDetections = detections.filter(d => 
            ['CRITICAL', 'HIGH'].includes(d.riskLevel)
        );
        
        if (highRiskDetections.length > 0) {
            this.emit('high_risk_pinning', highRiskDetections);
        }
        
        // Store for historical analysis
        this.historicalPins.push({
            timestamp: new Date(),
            detections: detections.length,
            highRisk: highRiskDetections.length,
            symbols: detections.map(d => d.symbol)
        });
        
        // Cleanup old history
        this.cleanupHistoricalData();
    }
    
    // Helper methods and utilities
    
    /**
     * Calculate risk level from pin score and time
     */
    calculateRiskLevel(score, timeToExp) {
        if (score >= 80 && timeToExp.hours <= this.config.CRITICAL_TIME_HOURS) return 'CRITICAL';
        if (score >= 70) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        if (score >= 30) return 'LOW';
        return 'NONE';
    }
    
    /**
     * Identify specific pin strikes
     */
    identifyPinStrikes(currentPrice, expiration, pinScore) {
        const strikes = this.getAllStrikes(expiration);
        const pinStrikes = { primary: null, secondary: [], all: [] };
        
        // Find closest strikes
        const sorted = strikes
            .map(s => ({
                strike: s.strike,
                distance: Math.abs(currentPrice - s.strike) / currentPrice,
                openInterest: (s.calls?.openInterest || 0) + (s.puts?.openInterest || 0),
                volume: (s.calls?.volume || 0) + (s.puts?.volume || 0)
            }))
            .sort((a, b) => a.distance - b.distance);
        
        if (sorted.length > 0) {
            pinStrikes.primary = {
                strike: sorted[0].strike,
                distance: (sorted[0].distance * 100).toFixed(2),
                openInterest: sorted[0].openInterest,
                volume: sorted[0].volume
            };
            
            pinStrikes.secondary = sorted.slice(1, 4).map(s => ({
                strike: s.strike,
                distance: (s.distance * 100).toFixed(2),
                openInterest: s.openInterest
            }));
        }
        
        return pinStrikes;
    }
    
    /**
     * Generate trading recommendations
     */
    generateRecommendations(analysis) {
        const recommendations = [];
        const { riskLevel, timeToExpiration, strikes } = analysis;
        
        if (riskLevel === 'CRITICAL') {
            recommendations.push('AVOID_NEW_POSITIONS');
            recommendations.push('CLOSE_EXPIRING_POSITIONS');
            if (timeToExpiration.hours <= 4) {
                recommendations.push('URGENT_POSITION_REVIEW');
            }
        } else if (riskLevel === 'HIGH') {
            recommendations.push('REDUCE_POSITION_SIZES');
            recommendations.push('WIDEN_STRIKE_SELECTION');
            recommendations.push('CONSIDER_HEDGING');
        } else if (riskLevel === 'MEDIUM') {
            recommendations.push('MONITOR_CLOSELY');
            recommendations.push('PREPARE_ADJUSTMENTS');
        }
        
        // Strike-specific recommendations
        if (strikes.primary && parseFloat(strikes.primary.distance) < 1.0) {
            recommendations.push(`AVOID_${strikes.primary.strike}_STRIKE`);
        }
        
        return recommendations;
    }
    
    /**
     * Get all strikes for an expiration
     */
    getAllStrikes(expiration) {
        // This would parse the option chain data
        // For now, return empty array (would implement with real data)
        return expiration.strikes || [];
    }
    
    /**
     * Estimate gamma for a given strike (simplified)
     */
    estimateGamma(spotPrice, strike, dte) {
        const moneyness = spotPrice / strike;
        const timeValue = Math.sqrt(dte / 365);
        
        // Simplified gamma estimation
        // Real implementation would use proper Black-Scholes
        const gamma = Math.exp(-0.5 * Math.pow((Math.log(moneyness) / (0.2 * timeValue)), 2)) / 
                     (spotPrice * 0.2 * timeValue * Math.sqrt(2 * Math.PI));
        
        return gamma;
    }
    
    /**
     * Get time decay multiplier (higher as expiration approaches)
     */
    getTimeDecayMultiplier(dte) {
        if (dte <= 0.25) return 2.0;  // Last few hours
        if (dte <= 1) return 1.5;     // Same day
        if (dte <= 2) return 1.2;     // Next day
        return 1.0;
    }
    
    /**
     * Mock data methods (would be replaced with real API calls)
     */
    async getExpiringOptions() {
        // Would query for options expiring in next 7 days
        return ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'TSLA'];
    }
    
    async getHighVolumeSymbols() {
        // Would query for high options volume symbols
        return ['SPY', 'QQQ', 'AAPL', 'TSLA'];
    }
    
    getTrackedSymbols() {
        // Would return manually configured symbols to always track
        return ['SPY', 'QQQ'];
    }
    
    async getMarketData(symbol) {
        // Mock market data
        const basePrices = {
            'SPY': 450, 'QQQ': 350, 'IWM': 200, 'AAPL': 175,
            'MSFT': 380, 'TSLA': 220, 'AMZN': 140, 'GOOGL': 135
        };
        
        const basePrice = basePrices[symbol] || 100;
        return {
            symbol: symbol,
            price: basePrice * (1 + (Math.random() - 0.5) * 0.02), // +/- 1%
            volume: Math.floor(Math.random() * 10000000),
            timestamp: new Date()
        };
    }
    
    async getOptionChain(symbol) {
        // Mock option chain data
        return {
            symbol: symbol,
            expirations: [
                {
                    expiration: '2024-09-06', // Next Friday
                    dte: 3,
                    strikes: [] // Would contain actual strike data
                }
            ]
        };
    }
    
    findNextExpiration(optionChain) {
        if (!optionChain.expirations || optionChain.expirations.length === 0) {
            return null;
        }
        
        return optionChain.expirations[0]; // Next expiration
    }
    
    calculateTimeToExpiration(expiration) {
        const now = new Date();
        const expDate = new Date(expiration + ' 16:00:00'); // 4 PM EST
        const diff = expDate - now;
        
        return {
            hours: Math.max(0, Math.floor(diff / (1000 * 60 * 60))),
            minutes: Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))),
            total: diff
        };
    }
    
    isTrackedSymbol(symbol) {
        return this.getTrackedSymbols().includes(symbol);
    }
    
    getRiskIcon(riskLevel) {
        const icons = {
            'CRITICAL': '🔴',
            'HIGH': '🟠', 
            'MEDIUM': '🟡',
            'LOW': '🟢',
            'NONE': '⚪'
        };
        return icons[riskLevel] || '⚪';
    }
    
    updateExpirationCalendar() {
        // Would update calendar of upcoming expirations
        logger.debug('PIN_DETECTOR', 'Updating expiration calendar');
    }
    
    cleanupOldDetections() {
        // Remove detections older than 24 hours
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        
        for (const [symbol, detection] of this.pinDetections) {
            if (new Date(detection.timestamp).getTime() < cutoff) {
                this.pinDetections.delete(symbol);
            }
        }
    }
    
    cleanupHistoricalData() {
        // Keep only last 30 days of historical data
        const cutoff = Date.now() - (this.config.historicalDays * 24 * 60 * 60 * 1000);
        this.historicalPins = this.historicalPins.filter(p => p.timestamp.getTime() > cutoff);
    }
    
    /**
     * Get current detector status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            monitoring: this.monitoringInterval !== null,
            activeDetections: this.pinDetections.size,
            lastScan: this.lastScan,
            algorithms: this.config.algorithms,
            statistics: this.stats
        };
    }
    
    /**
     * Get pin analysis for specific symbol
     */
    getPinAnalysis(symbol) {
        return this.pinDetections.get(symbol) || null;
    }
    
    /**
     * Get all current detections
     */
    getAllDetections() {
        return Array.from(this.pinDetections.values());
    }
    
    /**
     * Manual analysis trigger
     */
    async analyzeSymbol(symbol) {
        logger.info('PIN_DETECTOR', `Manual analysis triggered for ${symbol}`);
        return await this.analyzeSymbolPinning(symbol);
    }
    
    /**
     * Clear all data
     */
    clear() {
        this.pinDetections.clear();
        this.historicalPins = [];
        this.stats = {
            totalAnalyses: 0,
            pinsDetected: 0,
            accuratePredictions: 0,
            falsePositives: 0,
            averageAccuracy: 0
        };
        
        logger.info('PIN_DETECTOR', 'Cleared all pinning data');
    }
}

// Export
module.exports = {
    OptionsPinningDetector,
    PIN_RISK_CONFIG,
    PIN_ALGORITHMS
};