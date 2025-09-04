/**
 * Friday Psychology Protection Module
 * Implementation of Tom King's Friday market psychology and behavioral patterns
 * Protects against end-of-week positioning effects and gamma pin dynamics
 */

const { EventEmitter } = require('events');
const { RISK_LIMITS } = require('./config');
const { getLogger } = require('./logger');
const { EarningsCalendar } = require('./earningsCalendar');
const { FedAnnouncementProtection } = require('./fedAnnouncementProtection');

// Removed synthetic data generator - using only real API data

const logger = getLogger();

/**
 * Tom King's Friday Psychology Rules and Market Behavior Patterns
 */
const FRIDAY_PSYCHOLOGY = {
    // Core Friday behavior patterns
    PATTERNS: {
        GAMMA_PIN: {
            name: 'Gamma Pinning Effect',
            description: 'Options gamma creates magnetic effect around large OI strikes',
            timeWindow: { start: '14:00', end: '16:00' }, // 2-4 PM EST most pronounced
            strengthFactor: 1.5, // 50% stronger on Fridays
            affectedProducts: ['SPY', 'QQQ', 'IWM', 'AAPL', 'TSLA', 'AMZN']
        },
        
        POSITION_SQUARING: {
            name: 'Weekly Position Squaring',
            description: 'Institutional rebalancing creates end-of-week flows',
            timeWindow: { start: '15:00', end: '16:00' }, // Last hour
            volumeIncrease: 1.3, // 30% higher volume typical
            volatilityIncrease: 1.2 // 20% higher volatility
        },
        
        THETA_ACCELERATION: {
            name: 'Friday Theta Burn',
            description: 'Accelerated time decay on weekly options',
            criticalWindow: { start: '15:30', end: '16:00' }, // Last 30 minutes
            thetaMultiplier: 2.0, // Double theta effect
            affectedStrategies: ['0DTE', 'WEEKLY_SHORT', 'IRON_CONDOR']
        },
        
        BEHAVIORAL_BIAS: {
            name: 'Weekend Risk Aversion',
            description: 'Traders avoid holding risk over weekend',
            timeWindow: { start: '13:00', end: '16:00' }, // Afternoon session
            riskReductionFactor: 0.7, // 30% reduction in risk appetite
            premiumCompressionFactor: 0.9 // 10% premium compression
        },
        
        EARLY_CLOSE_EFFECT: {
            name: 'Early Position Closure',
            description: 'Positions closed earlier than normal due to weekend gap risk',
            timeWindow: { start: '10:30', end: '15:00' }, // Earlier than usual
            earlyCloseMultiplier: 1.4, // 40% more early closes
            gapRiskPremium: 0.15 // 15 basis points gap risk premium
        }
    },
    
    // Market psychology phases throughout Friday
    PHASES: {
        MORNING_NORMAL: {
            period: '09:30-11:00',
            psychology: 'NORMAL',
            characteristics: ['Standard trading', 'Regular patterns'],
            riskMultiplier: 1.0
        },
        
        MIDDAY_POSITIONING: {
            period: '11:00-13:00',
            psychology: 'POSITIONING',
            characteristics: ['Early weekend positioning', 'Increased correlation'],
            riskMultiplier: 1.1
        },
        
        AFTERNOON_ACCELERATION: {
            period: '13:00-15:00',
            psychology: 'ACCELERATING',
            characteristics: ['Gamma effects building', 'Position squaring begins'],
            riskMultiplier: 1.3
        },
        
        POWER_HOUR_CHAOS: {
            period: '15:00-16:00',
            psychology: 'CHAOTIC',
            characteristics: ['Maximum gamma pin', 'Heavy rebalancing', 'Volatility spikes'],
            riskMultiplier: 1.8
        },
        
        CLOSING_RESOLUTION: {
            period: '15:50-16:00',
            psychology: 'RESOLUTION',
            characteristics: ['Final settlements', 'Pin resolution', 'Weekend positioning'],
            riskMultiplier: 2.0
        }
    },
    
    // Special Friday considerations
    CONSIDERATIONS: {
        EXPIRATION_FRIDAY: {
            name: 'Monthly/Quarterly Expiration Friday',
            multiplier: 2.5, // 150% more intense effects
            additionalRisks: ['TRIPLE_WITCHING', 'MASSIVE_GAMMA', 'INSTITUTIONAL_REBALANCING']
        },
        
        EARNINGS_FRIDAY: {
            name: 'Post-Earnings Friday',
            multiplier: 1.7, // 70% more volatility
            additionalRisks: ['EARNINGS_HANGOVER', 'ANALYST_DOWNGRADES', 'POSITION_ADJUSTMENTS']
        },
        
        HOLIDAY_FRIDAY: {
            name: 'Pre-Holiday Friday',
            multiplier: 0.6, // 40% reduced activity
            characteristics: ['LOW_VOLUME', 'EARLY_CLOSE', 'MINIMAL_NEW_POSITIONS']
        },
        
        FOMC_FRIDAY: {
            name: 'Post-FOMC Friday',
            multiplier: 2.0, // Double intensity
            additionalRisks: ['POLICY_INTERPRETATION', 'RATE_SENSITIVITY', 'SECTOR_ROTATION']
        }
    }
};

/**
 * Friday-Specific Protection Thresholds
 */
const FRIDAY_THRESHOLDS = {
    // Gamma pin detection
    GAMMA_PIN: {
        proximityThreshold: 0.005, // 0.5% from major strike
        volumeThreshold: 1.5, // 50% above average volume
        oiThreshold: 10000, // 10K+ open interest
        timeDecayFactor: 2.0 // Double time decay consideration
    },
    
    // Volume surge detection
    VOLUME_SURGE: {
        normalThreshold: 1.3, // 30% above average
        fridayThreshold: 1.6, // 60% above average on Fridays
        powerHourThreshold: 2.0, // 100% above in power hour
        criticalThreshold: 3.0 // 200% above triggers halt
    },
    
    // Volatility spike protection
    VOLATILITY: {
        normalThreshold: 0.015, // 1.5% move
        fridayThreshold: 0.010, // 1.0% move (more sensitive)
        powerHourThreshold: 0.008, // 0.8% move in power hour
        closingThreshold: 0.005 // 0.5% move in last 10 minutes
    },
    
    // Position risk limits
    POSITION_LIMITS: {
        maxBPFriday: 'DYNAMIC_FRIDAY', // 70% of normal VIX-based BP on Fridays
        maxCorrelatedPositions: 2, // Reduce from normal 3 to 2
        maxSinglePosition: 0.08, // 8% max single position (vs 10%)
        maxShortPremium: 0.30 // 30% max short premium exposure
    }
};

/**
 * Friday Psychology Protection System
 */
class FridayPsychologyProtection extends EventEmitter {
    constructor(api = null, config = {}) {
        super();
        
        this.api = api;
        
        this.config = {
            enabled: config.enabled !== false,
            
            // Psychology patterns and rules
            psychology: { ...FRIDAY_PSYCHOLOGY, ...config.psychology },
            
            // Protection thresholds
            thresholds: { ...FRIDAY_THRESHOLDS, ...config.thresholds },
            
            // Monitoring settings
            updateInterval: config.updateInterval || 60000, // 1 minute
            powerHourInterval: config.powerHourInterval || 15000, // 15 seconds in power hour
            closingInterval: config.closingInterval || 5000, // 5 seconds in last 10 minutes
            
            // Protection settings
            autoProtection: config.autoProtection !== false,
            aggressiveProtection: config.aggressiveProtection || false,
            
            // Symbol tracking
            trackedSymbols: config.trackedSymbols || [
                'SPY', 'QQQ', 'IWM', 'DIA', // Major ETFs (highest Friday effects)
                'AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', // High gamma stocks
                'XLF', 'XLK', 'XLE', 'XLV', 'XLI' // Sector ETFs
            ],
            
            // Special Friday detection
            detectSpecialFridays: config.detectSpecialFridays !== false,
            expirationCalendar: config.expirationCalendar || null,
            earningsCalendar: config.earningsCalendar || null,
            
            // Alert settings
            alertChannels: config.alertChannels || ['LOG', 'EVENT'],
            debugMode: config.debugMode || false
        };
        
        // State management
        this.currentPhase = 'INACTIVE';
        this.fridayType = 'NORMAL';
        this.psychologyFactors = new Map(); // symbol -> psychology analysis
        this.protectionStates = new Map(); // symbol -> protection level
        this.gammaAnalysis = new Map(); // symbol -> gamma pin analysis
        this.volumePatterns = new Map(); // symbol -> volume pattern analysis
        
        // Monitoring
        this.monitoringInterval = null;
        this.lastUpdate = null;
        this.activeProtections = new Set();
        this.fridayAlerts = [];
        
        // Statistics
        this.stats = {
            fridaysMonitored: 0,
            protectionTriggered: 0,
            gammaPinsDetected: 0,
            averageProtectionAccuracy: 0,
            lastFridayAnalysis: null
        };
        
        // Initialize calendar modules and data manager
        this.earningsCalendar = this.config.earningsCalendar || new EarningsCalendar();
        this.fedProtection = new FedAnnouncementProtection();
        this.dataManager = null; // Will initialize if needed
        
        logger.info('FRIDAY_PSYCHOLOGY', 'Friday Psychology Protection initialized', {
            trackedSymbols: this.config.trackedSymbols.length,
            autoProtection: this.config.autoProtection,
            aggressiveProtection: this.config.aggressiveProtection
        });
    }
    
    /**
     * Check if today is Friday and start monitoring if needed
     */
    checkFridayStatus() {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday
        
        if (dayOfWeek === 5) { // Friday
            if (!this.monitoringInterval) {
                this.startFridayMonitoring();
            }
            return true;
        } else {
            if (this.monitoringInterval) {
                this.stopMonitoring();
            }
            this.currentPhase = 'INACTIVE';
            return false;
        }
    }
    
    /**
     * Start Friday-specific monitoring
     */
    startFridayMonitoring() {
        logger.info('FRIDAY_PSYCHOLOGY', 'Starting Friday psychology monitoring');
        
        // Determine Friday type
        this.fridayType = this.detectFridayType();
        
        // Initial analysis
        this.performFridayAnalysis();
        
        // Start monitoring with appropriate frequency
        const interval = this.determineMonitoringInterval();
        this.monitoringInterval = setInterval(() => {
            this.performFridayAnalysis();
        }, interval);
        
        this.stats.fridaysMonitored++;
        this.emit('friday_monitoring_started', {
            fridayType: this.fridayType,
            interval: interval
        });
    }
    
    /**
     * Detect what type of Friday this is
     */
    detectFridayType() {
        const now = new Date();
        
        // Check for expiration Friday
        if (this.isExpirationFriday(now)) {
            if (this.isTripleWitching(now)) {
                return 'TRIPLE_WITCHING';
            }
            return 'EXPIRATION_FRIDAY';
        }
        
        // Check for earnings-heavy Friday
        if (this.isEarningsFriday(now)) {
            return 'EARNINGS_FRIDAY';
        }
        
        // Check for holiday Friday
        if (this.isHolidayFriday(now)) {
            return 'HOLIDAY_FRIDAY';
        }
        
        // Check for FOMC Friday
        if (this.isFOMCFriday(now)) {
            return 'FOMC_FRIDAY';
        }
        
        return 'NORMAL_FRIDAY';
    }
    
    /**
     * Main Friday psychology analysis
     */
    async performFridayAnalysis() {
        try {
            const now = new Date();
            
            // Update current phase
            this.updateCurrentPhase(now);
            
            // Get current psychology multipliers
            const psychologyMultipliers = this.getPsychologyMultipliers();
            
            // Analyze each tracked symbol
            const analyses = [];
            
            for (const symbol of this.config.trackedSymbols) {
                try {
                    const analysis = await this.analyzeSymbolPsychology(symbol, psychologyMultipliers);
                    if (analysis) {
                        analyses.push(analysis);
                        this.psychologyFactors.set(symbol, analysis);
                    }
                } catch (error) {
                    logger.error('FRIDAY_PSYCHOLOGY', `Failed to analyze ${symbol}:`, error);
                }
            }
            
            // Process analyses and generate protections
            this.processAnalyses(analyses);
            
            // Adjust monitoring frequency based on phase
            this.adjustMonitoringFrequency();
            
            this.lastUpdate = now;
            
        } catch (error) {
            logger.error('FRIDAY_PSYCHOLOGY', 'Error in Friday analysis:', error);
        }
    }
    
    /**
     * Update current Friday psychology phase
     */
    updateCurrentPhase(now) {
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeMinutes = hour * 60 + minute;
        
        let newPhase;
        
        if (timeMinutes < 570) { // Before 9:30 AM
            newPhase = 'INACTIVE';
        } else if (timeMinutes < 660) { // 9:30 - 11:00 AM
            newPhase = 'MORNING_NORMAL';
        } else if (timeMinutes < 780) { // 11:00 AM - 1:00 PM
            newPhase = 'MIDDAY_POSITIONING';
        } else if (timeMinutes < 900) { // 1:00 - 3:00 PM
            newPhase = 'AFTERNOON_ACCELERATION';
        } else if (timeMinutes < 950) { // 3:00 - 3:50 PM
            newPhase = 'POWER_HOUR_CHAOS';
        } else if (timeMinutes < 960) { // 3:50 - 4:00 PM
            newPhase = 'CLOSING_RESOLUTION';
        } else {
            newPhase = 'INACTIVE';
        }
        
        if (newPhase !== this.currentPhase) {
            const oldPhase = this.currentPhase;
            this.currentPhase = newPhase;
            
            logger.info('FRIDAY_PSYCHOLOGY', `Phase transition: ${oldPhase} → ${newPhase}`, {
                time: now.toLocaleTimeString(),
                fridayType: this.fridayType
            });
            
            this.emit('phase_change', {
                old: oldPhase,
                new: newPhase,
                time: now,
                fridayType: this.fridayType
            });
        }
    }
    
    /**
     * Get psychology multipliers for current state
     */
    getPsychologyMultipliers() {
        const phase = this.config.psychology.PHASES[this.currentPhase];
        const fridayConsideration = this.config.psychology.CONSIDERATIONS[this.fridayType];
        
        const baseMultiplier = phase ? phase.riskMultiplier : 1.0;
        const typeMultiplier = fridayConsideration ? fridayConsideration.multiplier : 1.0;
        
        return {
            risk: baseMultiplier * typeMultiplier,
            gamma: this.config.psychology.PATTERNS.GAMMA_PIN.strengthFactor,
            volume: this.config.psychology.PATTERNS.POSITION_SQUARING.volumeIncrease,
            volatility: this.config.psychology.PATTERNS.POSITION_SQUARING.volatilityIncrease,
            theta: this.config.psychology.PATTERNS.THETA_ACCELERATION.thetaMultiplier
        };
    }
    
    /**
     * Analyze psychology factors for a specific symbol
     */
    async analyzeSymbolPsychology(symbol, multipliers) {
        // Get current market data
        const marketData = await this.getCurrentMarketData(symbol);
        if (!marketData) return null;
        
        const analysis = {
            symbol: symbol,
            timestamp: new Date(),
            phase: this.currentPhase,
            fridayType: this.fridayType,
            multipliers: multipliers,
            factors: {},
            riskScore: 0,
            protectionLevel: 'NORMAL',
            recommendations: []
        };
        
        // Gamma pin analysis
        const gammaAnalysis = await this.analyzeGammaPin(symbol, marketData, multipliers);
        analysis.factors.gamma = gammaAnalysis;
        analysis.riskScore += gammaAnalysis.riskScore;
        
        // Volume pattern analysis
        const volumeAnalysis = await this.analyzeVolumePatterns(symbol, marketData, multipliers);
        analysis.factors.volume = volumeAnalysis;
        analysis.riskScore += volumeAnalysis.riskScore;
        
        // Volatility analysis
        const volatilityAnalysis = this.analyzeVolatilityPatterns(symbol, marketData, multipliers);
        analysis.factors.volatility = volatilityAnalysis;
        analysis.riskScore += volatilityAnalysis.riskScore;
        
        // Behavioral bias analysis
        const behavioralAnalysis = this.analyzeBehavioralBias(symbol, marketData, multipliers);
        analysis.factors.behavioral = behavioralAnalysis;
        analysis.riskScore += behavioralAnalysis.riskScore;
        
        // Determine protection level
        analysis.protectionLevel = this.determineProtectionLevel(analysis.riskScore);
        
        // Generate recommendations
        analysis.recommendations = this.generateProtectionRecommendations(analysis);
        
        return analysis;
    }
    
    /**
     * Analyze gamma pinning effects
     */
    async analyzeGammaPin(symbol, marketData, multipliers) {
        const analysis = {
            riskScore: 0,
            pinStrikes: [],
            proximityRisk: 0,
            magnification: multipliers.gamma,
            factors: []
        };
        
        // Get option chain data (mock for now)
        const optionChain = await this.getOptionChain(symbol);
        if (!optionChain) return analysis;
        
        const currentPrice = marketData.price;
        
        // Find strikes with high open interest
        const highOIStrikes = optionChain.strikes.filter(strike => 
            (strike.calls?.openInterest || 0) + (strike.puts?.openInterest || 0) > 
            this.config.thresholds.GAMMA_PIN.oiThreshold
        );
        
        // Analyze proximity to these strikes
        for (const strike of highOIStrikes) {
            const distance = Math.abs(currentPrice - strike.strike) / currentPrice;
            const totalOI = (strike.calls?.openInterest || 0) + (strike.puts?.openInterest || 0);
            
            if (distance <= this.config.thresholds.GAMMA_PIN.proximityThreshold) {
                const pinRisk = (1 - distance / this.config.thresholds.GAMMA_PIN.proximityThreshold) * 
                              Math.min(totalOI / 50000, 2.0) * // OI factor (max 2x)
                              multipliers.gamma;
                
                analysis.pinStrikes.push({
                    strike: strike.strike,
                    distance: distance,
                    openInterest: totalOI,
                    pinRisk: pinRisk
                });
                
                analysis.riskScore += pinRisk * 20; // Scale to 0-100
                analysis.factors.push(`Pin risk at ${strike.strike}: ${(pinRisk * 100).toFixed(1)}%`);
            }
        }
        
        // Power hour amplification
        if (this.currentPhase === 'POWER_HOUR_CHAOS' || this.currentPhase === 'CLOSING_RESOLUTION') {
            analysis.riskScore *= 1.5;
            analysis.factors.push('Power hour gamma amplification');
        }
        
        return analysis;
    }
    
    /**
     * Analyze volume patterns
     */
    async analyzeVolumePatterns(symbol, marketData, multipliers) {
        const analysis = {
            riskScore: 0,
            currentVolume: marketData.volume,
            averageVolume: marketData.averageVolume || marketData.volume,
            volumeRatio: 1.0,
            surge: false,
            factors: []
        };
        
        if (analysis.averageVolume > 0) {
            analysis.volumeRatio = analysis.currentVolume / analysis.averageVolume;
            
            // Apply Friday-specific thresholds
            let threshold;
            if (this.currentPhase === 'POWER_HOUR_CHAOS') {
                threshold = this.config.thresholds.VOLUME_SURGE.powerHourThreshold;
            } else {
                threshold = this.config.thresholds.VOLUME_SURGE.fridayThreshold;
            }
            
            if (analysis.volumeRatio > threshold) {
                analysis.surge = true;
                analysis.riskScore = Math.min(30, (analysis.volumeRatio - threshold) * 50);
                analysis.factors.push(`Volume surge: ${analysis.volumeRatio.toFixed(1)}x average`);
                
                if (analysis.volumeRatio > this.config.thresholds.VOLUME_SURGE.criticalThreshold) {
                    analysis.riskScore = 50;
                    analysis.factors.push('CRITICAL volume surge detected');
                }
            }
        }
        
        return analysis;
    }
    
    /**
     * Analyze volatility patterns
     */
    analyzeVolatilityPatterns(symbol, marketData, multipliers) {
        const analysis = {
            riskScore: 0,
            currentVolatility: marketData.volatility || 0,
            thresholdBreached: false,
            factors: []
        };
        
        // Determine appropriate threshold based on phase
        let threshold;
        if (this.currentPhase === 'CLOSING_RESOLUTION') {
            threshold = this.config.thresholds.VOLATILITY.closingThreshold;
        } else if (this.currentPhase === 'POWER_HOUR_CHAOS') {
            threshold = this.config.thresholds.VOLATILITY.powerHourThreshold;
        } else {
            threshold = this.config.thresholds.VOLATILITY.fridayThreshold;
        }
        
        // Apply multipliers
        threshold /= multipliers.volatility;
        
        if (analysis.currentVolatility > threshold) {
            analysis.thresholdBreached = true;
            analysis.riskScore = Math.min(25, (analysis.currentVolatility / threshold - 1) * 100);
            analysis.factors.push(`Volatility spike: ${(analysis.currentVolatility * 100).toFixed(2)}%`);
        }
        
        return analysis;
    }
    
    /**
     * Analyze behavioral bias effects
     */
    analyzeBehavioralBias(symbol, marketData, multipliers) {
        const analysis = {
            riskScore: 0,
            biasFactors: [],
            weekendRiskAversion: false,
            factors: []
        };
        
        // Weekend risk aversion typically builds in afternoon
        if (['AFTERNOON_ACCELERATION', 'POWER_HOUR_CHAOS'].includes(this.currentPhase)) {
            analysis.weekendRiskAversion = true;
            analysis.riskScore += 15;
            analysis.factors.push('Weekend risk aversion detected');
        }
        
        // Early closure pressure
        if (this.config.psychology.PATTERNS.EARLY_CLOSE_EFFECT.timeWindow) {
            const now = new Date();
            const hour = now.getHours();
            
            if (hour >= 10 && hour < 15) { // Within early close window
                analysis.biasFactors.push('EARLY_CLOSE_PRESSURE');
                analysis.riskScore += 10;
                analysis.factors.push('Early closure pressure building');
            }
        }
        
        // Premium compression
        if (this.currentPhase === 'POWER_HOUR_CHAOS') {
            analysis.biasFactors.push('PREMIUM_COMPRESSION');
            analysis.riskScore += 12;
            analysis.factors.push('Premium compression effect');
        }
        
        return analysis;
    }
    
    /**
     * Determine protection level based on risk score
     */
    determineProtectionLevel(riskScore) {
        if (riskScore >= 80) return 'CRITICAL';
        if (riskScore >= 60) return 'HIGH';
        if (riskScore >= 40) return 'MEDIUM';
        if (riskScore >= 20) return 'LOW';
        return 'NORMAL';
    }
    
    /**
     * Generate protection recommendations
     */
    generateProtectionRecommendations(analysis) {
        const recommendations = [];
        
        switch (analysis.protectionLevel) {
            case 'CRITICAL':
                recommendations.push('HALT_NEW_POSITIONS');
                recommendations.push('CLOSE_RISKY_POSITIONS');
                recommendations.push('REDUCE_EXPOSURE_IMMEDIATELY');
                break;
                
            case 'HIGH':
                recommendations.push('AVOID_NEW_0DTE');
                recommendations.push('REDUCE_POSITION_SIZES');
                recommendations.push('INCREASE_MONITORING');
                break;
                
            case 'MEDIUM':
                recommendations.push('USE_WIDER_STRIKES');
                recommendations.push('AVOID_PIN_STRIKES');
                recommendations.push('CONSIDER_EARLY_CLOSE');
                break;
                
            case 'LOW':
                recommendations.push('MONITOR_CLOSELY');
                recommendations.push('PREPARE_ADJUSTMENTS');
                break;
        }
        
        // Phase-specific recommendations
        if (this.currentPhase === 'POWER_HOUR_CHAOS') {
            recommendations.push('AVOID_POWER_HOUR_ENTRIES');
            recommendations.push('PREPARE_FOR_PIN_RESOLUTION');
        }
        
        if (this.currentPhase === 'CLOSING_RESOLUTION') {
            recommendations.push('FINAL_ADJUSTMENTS_ONLY');
            recommendations.push('ACCEPT_ASSIGNMENTS_IF_NEEDED');
        }
        
        return recommendations;
    }
    
    /**
     * Process analyses and activate protections
     */
    processAnalyses(analyses) {
        const highRiskAnalyses = analyses.filter(a => ['HIGH', 'CRITICAL'].includes(a.protectionLevel));
        const mediumRiskAnalyses = analyses.filter(a => a.protectionLevel === 'MEDIUM');
        
        if (this.config.debugMode || highRiskAnalyses.length > 0) {
            logger.info('SYSTEM', '\n' + '='.repeat(70));
            logger.info('SYSTEM', `📅 FRIDAY PSYCHOLOGY PROTECTION - Phase: ${this.currentPhase}`);
            logger.info('SYSTEM', '='.repeat(70));
            
            for (const analysis of analyses.slice(0, 10)) {
                const icon = this.getProtectionIcon(analysis.protectionLevel);
                
                logger.info('SYSTEM', `\n${icon} ${analysis.symbol} - ${analysis.protectionLevel} Risk (Score: ${analysis.riskScore.toFixed(1)})`);
                logger.info('SYSTEM', `   Friday Type: ${analysis.fridayType} | Phase: ${analysis.phase}`);
                
                if (analysis.factors.gamma.pinStrikes.length > 0) {
                    const nearestPin = analysis.factors.gamma.pinStrikes[0];
                    logger.info('SYSTEM', `   Nearest Pin: $${nearestPin.strike} (${(nearestPin.distance * 100).toFixed(2)}% away)`);
                }
                
                if (analysis.factors.volume.surge) {
                    logger.info('SYSTEM', `   Volume: ${analysis.factors.volume.volumeRatio.toFixed(1)}x average`);
                }
                
                if (analysis.recommendations.length > 0) {
                    logger.info('SYSTEM', `   Actions: ${analysis.recommendations.slice(0, 3).join(', ')}`);
                }
            }
            
            logger.info('SYSTEM', '\n' + '='.repeat(70));
        }
        
        // Store alerts
        this.fridayAlerts = analyses.filter(a => a.protectionLevel !== 'NORMAL');
        
        // Update protection states
        for (const analysis of analyses) {
            this.protectionStates.set(analysis.symbol, analysis);
            
            if (['HIGH', 'CRITICAL'].includes(analysis.protectionLevel)) {
                this.activeProtections.add(analysis.symbol);
            }
        }
        
        // Emit events
        if (highRiskAnalyses.length > 0) {
            this.emit('high_friday_risk', highRiskAnalyses);
            this.stats.protectionTriggered++;
        }
        
        if (mediumRiskAnalyses.length > 0) {
            this.emit('medium_friday_risk', mediumRiskAnalyses);
        }
        
        // Auto-protection
        if (this.config.autoProtection && highRiskAnalyses.length > 0) {
            this.executeAutoProtection(highRiskAnalyses);
        }
    }
    
    /**
     * Execute automatic protection measures
     */
    executeAutoProtection(highRiskAnalyses) {
        logger.warn('FRIDAY_PSYCHOLOGY', 'Executing Friday auto-protection', {
            affectedSymbols: highRiskAnalyses.map(a => a.symbol),
            phase: this.currentPhase,
            fridayType: this.fridayType
        });
        
        const protectionMeasures = {
            phase: this.currentPhase,
            fridayType: this.fridayType,
            restrictions: [],
            actions: [],
            affectedSymbols: highRiskAnalyses.map(a => a.symbol)
        };
        
        // Apply Friday-specific restrictions
        protectionMeasures.restrictions.push('FRIDAY_BP_LIMIT');
        protectionMeasures.restrictions.push('NO_NEW_0DTE');
        protectionMeasures.restrictions.push('GAMMA_PIN_AVOIDANCE');
        
        if (this.currentPhase === 'POWER_HOUR_CHAOS') {
            protectionMeasures.restrictions.push('POWER_HOUR_HALT');
            protectionMeasures.actions.push('CLOSE_EXPIRING_POSITIONS');
        }
        
        if (this.currentPhase === 'CLOSING_RESOLUTION') {
            protectionMeasures.actions.push('ACCEPT_ASSIGNMENTS');
            protectionMeasures.actions.push('FINAL_ADJUSTMENTS_ONLY');
        }
        
        this.emit('friday_auto_protection', protectionMeasures);
    }
    
    // Utility and helper methods
    
    determineMonitoringInterval() {
        if (this.currentPhase === 'CLOSING_RESOLUTION') {
            return this.config.closingInterval;
        } else if (this.currentPhase === 'POWER_HOUR_CHAOS') {
            return this.config.powerHourInterval;
        } else {
            return this.config.updateInterval;
        }
    }
    
    adjustMonitoringFrequency() {
        const targetInterval = this.determineMonitoringInterval();
        const currentInterval = this.monitoringInterval ? this.monitoringInterval._idleTimeout : null;
        
        if (currentInterval !== targetInterval) {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            
            this.monitoringInterval = setInterval(() => {
                this.performFridayAnalysis();
            }, targetInterval);
        }
    }
    
    getProtectionIcon(level) {
        const icons = {
            'CRITICAL': '🔴',
            'HIGH': '🟠',
            'MEDIUM': '🟡',
            'LOW': '🟢',
            'NORMAL': '⚪'
        };
        return icons[level] || '📊';
    }
    
    // Friday type detection methods
    
    isExpirationFriday(date) {
        // Check if this is the third Friday of the month
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstFriday = this.getFirstFriday(year, month);
        const thirdFriday = new Date(firstFriday);
        thirdFriday.setDate(firstFriday.getDate() + 14);
        
        return date.getDate() === thirdFriday.getDate();
    }
    
    isTripleWitching(date) {
        // March, June, September, December third Fridays
        const month = date.getMonth();
        const tripleMwitchingMonths = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec
        return tripleMwitchingMonths.includes(month) && this.isExpirationFriday(date);
    }
    
    isEarningsFriday(date) {
        // Check earnings calendar integration
        try {
            return this.earningsCalendar.hasEarningsOnDate(date);
        } catch (error) {
            logger.warn('FRIDAY_PSYCHOLOGY', 'Earnings calendar check failed', error);
            return false;
        }
    }
    
    isHolidayFriday(date) {
        // Check for pre-holiday Fridays
        const holidays = [
            { month: 6, date: 4 }, // July 4th
            { month: 10, date: 25 }, // Thanksgiving week
            { month: 11, date: 25 } // Christmas week
        ];
        
        for (const holiday of holidays) {
            const holidayDate = new Date(date.getFullYear(), holiday.month, holiday.date);
            const daysDiff = Math.abs((holidayDate - date) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 3) return true; // Within 3 days of holiday
        }
        
        return false;
    }
    
    isFOMCFriday(date) {
        // Check FOMC calendar integration
        try {
            return this.fedProtection.isFOMCWeek(date);
        } catch (error) {
            logger.warn('FRIDAY_PSYCHOLOGY', 'FOMC calendar check failed', error);
            return false;
        }
    }
    
    getFirstFriday(year, month) {
        const firstDay = new Date(year, month, 1);
        const dayOfWeek = firstDay.getDay();
        const daysToFriday = (5 - dayOfWeek + 7) % 7;
        return new Date(year, month, 1 + daysToFriday);
    }
    
    async getCurrentMarketData(symbol) {
        try {
            // Use real API data if available
            if (this.api && this.api.getQuote) {
                const quote = await this.api.getQuote(symbol);
                if (quote && (quote.price || quote.last || quote.close)) {
                    return {
                        symbol: symbol,
                        price: quote.price || quote.last || quote.close,
                        volume: quote.volume || quote.totalVolume || 0,
                        averageVolume: quote.averageVolume || 0,
                        volatility: quote.impliedVolatility || 0,
                        timestamp: new Date()
                    };
                }
            }
            
            // Initialize dataManager if needed
            if (!this.dataManager) {
                const DataManager = require('./dataManager');
                this.dataManager = new DataManager(this.api);
            }
            
            // Fallback to DataManager for real cached data
            const marketData = await this.dataManager.getCurrentPrice(symbol);
            if (marketData && marketData.price) {
                return {
                    symbol: symbol,
                    price: marketData.price,
                    volume: marketData.volume || 0,
                    averageVolume: marketData.averageVolume || 0,
                    volatility: marketData.volatility || 0,
                    timestamp: new Date()
                };
            }
            
            // No synthetic data - return null if no real data available
            logger.error('FRIDAY_PSYCHOLOGY', `No real market data available for ${symbol}`);
            return null;
        } catch (error) {
            logger.error('FRIDAY_PSYCHOLOGY', `Failed to get market data for ${symbol}:`, error);
            return null;
        }
    }
    
    // Removed all synthetic calculation methods - using only real API data
    
    async getOptionChain(symbol) {
        try {
            // Use real API data if available
            if (this.api && this.api.getOptionChain) {
                const optionChain = await this.api.getOptionChain(symbol);
                if (optionChain && optionChain.strikes) {
                    return optionChain;
                }
            }
            
            // No synthetic data generation - return empty if no real data
            logger.error('FRIDAY_PSYCHOLOGY', `No real option chain data available for ${symbol}`);
            return { strikes: [] };
        } catch (error) {
            logger.error('FRIDAY_PSYCHOLOGY', `Failed to get option chain for ${symbol}:`, error);
            return { strikes: [] };
        }
    }
    
    // Public interface methods
    
    getStatus() {
        return {
            enabled: this.config.enabled,
            isFriday: this.checkFridayStatus(),
            monitoring: this.monitoringInterval !== null,
            phase: this.currentPhase,
            fridayType: this.fridayType,
            activeProtections: this.activeProtections.size,
            lastUpdate: this.lastUpdate,
            statistics: this.stats
        };
    }
    
    getCurrentAnalysis(symbol) {
        return this.psychologyFactors.get(symbol) || null;
    }
    
    getProtectionState(symbol) {
        return this.protectionStates.get(symbol) || null;
    }
    
    getCurrentAlerts() {
        return this.fridayAlerts;
    }
    
    forceProtection(symbol, level = 'HIGH') {
        logger.warn('FRIDAY_PSYCHOLOGY', `Manual Friday protection for ${symbol}`, { level });
        
        this.protectionStates.set(symbol, {
            protectionLevel: level,
            manual: true,
            timestamp: new Date()
        });
        
        this.activeProtections.add(symbol);
        this.emit('manual_friday_protection', { symbol, level });
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('FRIDAY_PSYCHOLOGY', 'Friday monitoring stopped');
        }
    }
    
    // Initialize monitoring
    initialize() {
        // Check if we should be monitoring (if today is Friday)
        return this.checkFridayStatus();
    }
}

// Export
module.exports = {
    FridayPsychologyProtection,
    FRIDAY_PSYCHOLOGY,
    FRIDAY_THRESHOLDS
};