/**
 * Momentum Spike Protection Module
 * Implementation of Tom King's 15-minute rule and momentum surge protection
 * Prevents trading during abnormal momentum spikes and market dislocations
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Tom King's Momentum Protection Rules and Thresholds
 */
const MOMENTUM_RULES = {
    // The Famous 15-Minute Rule
    FIFTEEN_MINUTE_RULE: {
        enabled: true,
        timeWindow: 15, // Minutes to analyze
        threshold: 0.0075, // 0.75% move in 15 minutes triggers protection
        urgentThreshold: 0.015, // 1.5% move triggers immediate halt
        description: "Tom King's signature protection against momentum dislocations"
    },
    
    // Complementary momentum filters
    INTRADAY_MOMENTUM: {
        // 5-minute micro-momentum
        fiveMinuteThreshold: 0.003, // 0.3% in 5 minutes
        
        // 30-minute extended momentum  
        thirtyMinuteThreshold: 0.012, // 1.2% in 30 minutes
        
        // Opening hour surge protection
        openingHourThreshold: 0.020, // 2% in first hour
        
        // Close proximity protection (last 30 min)
        closingThreshold: 0.008 // 0.8% in last 30 minutes
    },
    
    // Volume surge confirmation
    VOLUME_CONFIRMATION: {
        enabled: true,
        volumeMultiplier: 2.0, // 2x average volume required
        urgentVolumeMultiplier: 3.5, // 3.5x average volume for urgent
        lookbackDays: 20, // Days to calculate average volume
        description: "Volume must confirm momentum moves"
    },
    
    // VIX spike correlation
    VIX_CORRELATION: {
        enabled: true,
        vixSpikeThreshold: 3.0, // 3 point VIX increase
        vixRateThreshold: 0.20, // 20% VIX increase
        correlationWindow: 30, // Minutes to check correlation
        description: "VIX spike confirms market stress"
    },
    
    // Sector rotation protection
    SECTOR_PROTECTION: {
        enabled: true,
        sectorCorrelationThreshold: 0.8, // High sector correlation warning
        crossSectorMomentum: 0.005, // 0.5% cross-sector momentum
        sectorCount: 3, // Minimum sectors moving together
        description: "Protect against broad sector momentum"
    }
};

/**
 * Market Regimes and Sensitivity Adjustments
 */
const MARKET_REGIMES = {
    NORMAL: {
        name: 'Normal Market',
        vixRange: [0, 20],
        multiplier: 1.0,
        description: 'Standard momentum thresholds'
    },
    
    ELEVATED: {
        name: 'Elevated Volatility',
        vixRange: [20, 30],
        multiplier: 0.8, // More sensitive (lower thresholds)
        description: 'Tighter momentum controls'
    },
    
    HIGH: {
        name: 'High Volatility',
        vixRange: [30, 40],
        multiplier: 0.6, // Much more sensitive
        description: 'Aggressive momentum protection'
    },
    
    EXTREME: {
        name: 'Extreme Volatility',
        vixRange: [40, 100],
        multiplier: 0.4, // Maximum sensitivity
        description: 'Emergency momentum protocols'
    }
};

/**
 * Protection Actions and Escalation
 */
const PROTECTION_ACTIONS = {
    MONITOR: {
        level: 1,
        actions: ['LOG_MOMENTUM', 'INCREASE_MONITORING'],
        description: 'Enhanced monitoring activated'
    },
    
    CAUTION: {
        level: 2,
        actions: ['REDUCE_SIZE', 'WIDEN_STRIKES', 'DELAY_ENTRIES'],
        description: 'Defensive positioning'
    },
    
    WARNING: {
        level: 3,
        actions: ['HALT_NEW_ENTRIES', 'PREPARE_EXITS', 'HEDGE_EXPOSURE'],
        description: 'Trading restrictions activated'
    },
    
    ALERT: {
        level: 4,
        actions: ['STOP_TRADING', 'CLOSE_RISKY_POSITIONS', 'EMERGENCY_HEDGING'],
        description: 'Emergency momentum protection'
    },
    
    HALT: {
        level: 5,
        actions: ['COMPLETE_HALT', 'FORCE_CLOSE_ALL', 'NOTIFY_URGENT'],
        description: 'Complete trading halt'
    }
};

/**
 * Momentum Spike Protection System
 */
class MomentumSpikeProtection extends EventEmitter {
    constructor(api = null, config = {}) {
        super();
        
        this.api = api;
        
        this.config = {
            enabled: config.enabled !== false,
            
            // Core momentum rules
            rules: { ...MOMENTUM_RULES, ...config.rules },
            
            // Market regime settings
            regimes: { ...MARKET_REGIMES, ...config.regimes },
            
            // Protection actions
            actions: { ...PROTECTION_ACTIONS, ...config.actions },
            
            // Monitoring settings
            monitoringInterval: config.monitoringInterval || 30000, // 30 seconds
            urgentInterval: config.urgentInterval || 5000, // 5 seconds during alerts
            
            // Symbol tracking
            trackedSymbols: config.trackedSymbols || [
                'SPY', 'QQQ', 'IWM', 'DIA', // Major ETFs
                'ES', 'MES', 'NQ', 'MNQ', // Futures
                'AAPL', 'MSFT', 'TSLA', 'AMZN', // Major stocks
                'TLT', 'GLD', 'VIX' // Cross-asset
            ],
            
            // Alert settings
            alertThreshold: config.alertThreshold || 'WARNING',
            autoProtection: config.autoProtection !== false,
            notificationChannels: config.notificationChannels || ['LOG', 'EVENT'],
            
            // Historical analysis
            dataRetentionHours: config.dataRetentionHours || 72, // 3 days
            backtestAccuracy: config.backtestAccuracy !== false,
            
            // Testing and debug
            debug: config.debug || false,
            testMode: config.testMode || false
        };
        
        // State management
        this.priceData = new Map(); // symbol -> price history
        this.momentumAnalysis = new Map(); // symbol -> current momentum
        this.volumeData = new Map(); // symbol -> volume history
        this.protectionStates = new Map(); // symbol -> protection level
        this.alertHistory = [];
        
        // Monitoring
        this.monitoringInterval = null;
        this.lastUpdate = null;
        this.currentRegime = 'NORMAL';
        this.activeProtections = new Set();
        
        // Statistics
        this.stats = {
            totalChecks: 0,
            protectionTriggered: 0,
            falsePositives: 0,
            truePositives: 0,
            averageAccuracy: 0,
            lastMomentumSpike: null
        };
        
        // Initialize data manager if needed
        this.initializeDataManager();
        
        logger.info('MOMENTUM_PROTECTION', 'Momentum Spike Protection initialized', {
            fifteenMinuteRule: this.config.rules.FIFTEEN_MINUTE_RULE.enabled,
            trackedSymbols: this.config.trackedSymbols.length,
            autoProtection: this.config.autoProtection
        });
    }
    
    /**
     * Start momentum monitoring
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            logger.warn('MOMENTUM_PROTECTION', 'Monitoring already active');
            return;
        }
        
        logger.info('MOMENTUM_PROTECTION', 'Starting momentum spike monitoring');
        
        // Initial scan
        this.performMomentumScan();
        
        // Determine monitoring frequency based on market stress
        const interval = this.activeProtections.size > 0 ? 
            this.config.urgentInterval : 
            this.config.monitoringInterval;
        
        this.monitoringInterval = setInterval(() => {
            this.performMomentumScan();
        }, interval);
        
        this.emit('monitoring_started');
    }
    
    /**
     * Main momentum scanning function
     */
    async performMomentumScan() {
        try {
            this.stats.totalChecks++;
            
            // Update market regime
            await this.updateMarketRegime();
            
            // Scan all tracked symbols
            const momentumAlerts = [];
            
            for (const symbol of this.config.trackedSymbols) {
                try {
                    // Update price and volume data
                    await this.updateSymbolData(symbol);
                    
                    // Analyze momentum
                    const momentumAnalysis = this.analyzeMomentum(symbol);
                    
                    if (momentumAnalysis) {
                        this.momentumAnalysis.set(symbol, momentumAnalysis);
                        
                        // Check for protection triggers
                        const protectionLevel = this.assessProtectionLevel(symbol, momentumAnalysis);
                        
                        if (protectionLevel.level > 1) { // Above MONITOR level
                            momentumAlerts.push({
                                symbol: symbol,
                                analysis: momentumAnalysis,
                                protection: protectionLevel,
                                timestamp: new Date()
                            });
                        }
                    }
                    
                } catch (error) {
                    logger.error('MOMENTUM_PROTECTION', `Failed to analyze ${symbol}:`, error);
                }
            }
            
            // Process alerts and take actions
            if (momentumAlerts.length > 0) {
                this.processMomentumAlerts(momentumAlerts);
            }
            
            // Clean up old data
            this.cleanupOldData();
            
            this.lastUpdate = new Date();
            
        } catch (error) {
            logger.error('MOMENTUM_PROTECTION', 'Error in momentum scan:', error);
        }
    }
    
    /**
     * Update market regime based on VIX and other factors
     */
    async updateMarketRegime() {
        try {
            // Get current VIX level
            const vixData = await this.getCurrentPrice('VIX');
            const vixLevel = vixData ? vixData.price : 16; // Default VIX
            
            // Determine regime
            const newRegime = this.determineMarketRegime(vixLevel);
            
            if (newRegime !== this.currentRegime) {
                logger.info('MOMENTUM_PROTECTION', `Market regime changed: ${this.currentRegime} → ${newRegime}`, {
                    vixLevel: vixLevel,
                    multiplier: this.config.regimes[newRegime].multiplier
                });
                
                this.currentRegime = newRegime;
                this.emit('regime_change', {
                    old: this.currentRegime,
                    new: newRegime,
                    vix: vixLevel
                });
            }
            
        } catch (error) {
            logger.error('MOMENTUM_PROTECTION', 'Failed to update market regime:', error);
        }
    }
    
    /**
     * Determine market regime from VIX level
     */
    determineMarketRegime(vixLevel) {
        for (const [regime, config] of Object.entries(this.config.regimes)) {
            if (vixLevel >= config.vixRange[0] && vixLevel < config.vixRange[1]) {
                return regime;
            }
        }
        return 'EXTREME'; // VIX above 40
    }
    
    /**
     * Update price and volume data for a symbol
     */
    async updateSymbolData(symbol) {
        try {
            // Get current market data
            const marketData = await this.getCurrentPrice(symbol);
            if (!marketData) return;
            
            const now = new Date();
            const pricePoint = {
                timestamp: now,
                price: marketData.price,
                volume: marketData.volume || 0
            };
            
            // Update price history
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, []);
            }
            
            const priceHistory = this.priceData.get(symbol);
            priceHistory.push(pricePoint);
            
            // Keep only data within retention period
            const cutoffTime = now.getTime() - (this.config.dataRetentionHours * 60 * 60 * 1000);
            this.priceData.set(symbol, priceHistory.filter(p => p.timestamp.getTime() > cutoffTime));
            
            // Update volume history
            if (!this.volumeData.has(symbol)) {
                this.volumeData.set(symbol, []);
            }
            
            const volumeHistory = this.volumeData.get(symbol);
            volumeHistory.push(pricePoint);
            this.volumeData.set(symbol, volumeHistory.filter(v => v.timestamp.getTime() > cutoffTime));
            
        } catch (error) {
            logger.error('MOMENTUM_PROTECTION', `Failed to update data for ${symbol}:`, error);
        }
    }
    
    /**
     * Analyze momentum for a symbol
     */
    analyzeMomentum(symbol) {
        const priceHistory = this.priceData.get(symbol);
        if (!priceHistory || priceHistory.length < 2) {
            return null;
        }
        
        const now = new Date();
        const currentPrice = priceHistory[priceHistory.length - 1].price;
        const regimeMultiplier = this.config.regimes[this.currentRegime].multiplier;
        
        const analysis = {
            symbol: symbol,
            timestamp: now,
            currentPrice: currentPrice,
            regime: this.currentRegime,
            multiplier: regimeMultiplier,
            momentum: {},
            triggers: [],
            maxRisk: 0
        };
        
        // 15-Minute Rule Analysis (Tom King's signature rule)
        const fifteenMinMomentum = this.calculateMomentum(priceHistory, 15);
        if (fifteenMinMomentum) {
            const adjustedThreshold = this.config.rules.FIFTEEN_MINUTE_RULE.threshold * regimeMultiplier;
            const adjustedUrgent = this.config.rules.FIFTEEN_MINUTE_RULE.urgentThreshold * regimeMultiplier;
            
            analysis.momentum.fifteenMin = {
                change: fifteenMinMomentum.change,
                changePercent: fifteenMinMomentum.changePercent,
                threshold: adjustedThreshold,
                urgentThreshold: adjustedUrgent,
                triggered: Math.abs(fifteenMinMomentum.changePercent) > adjustedThreshold,
                urgent: Math.abs(fifteenMinMomentum.changePercent) > adjustedUrgent
            };
            
            if (analysis.momentum.fifteenMin.urgent) {
                analysis.triggers.push('FIFTEEN_MINUTE_URGENT');
                analysis.maxRisk = Math.max(analysis.maxRisk, 5); // HALT level
            } else if (analysis.momentum.fifteenMin.triggered) {
                analysis.triggers.push('FIFTEEN_MINUTE_RULE');
                analysis.maxRisk = Math.max(analysis.maxRisk, 4); // ALERT level
            }
        }
        
        // 5-Minute Micro-Momentum
        const fiveMinMomentum = this.calculateMomentum(priceHistory, 5);
        if (fiveMinMomentum) {
            const threshold = this.config.rules.INTRADAY_MOMENTUM.fiveMinuteThreshold * regimeMultiplier;
            
            analysis.momentum.fiveMin = {
                changePercent: fiveMinMomentum.changePercent,
                threshold: threshold,
                triggered: Math.abs(fiveMinMomentum.changePercent) > threshold
            };
            
            if (analysis.momentum.fiveMin.triggered) {
                analysis.triggers.push('FIVE_MINUTE_MOMENTUM');
                analysis.maxRisk = Math.max(analysis.maxRisk, 2); // CAUTION level
            }
        }
        
        // 30-Minute Extended Momentum
        const thirtyMinMomentum = this.calculateMomentum(priceHistory, 30);
        if (thirtyMinMomentum) {
            const threshold = this.config.rules.INTRADAY_MOMENTUM.thirtyMinuteThreshold * regimeMultiplier;
            
            analysis.momentum.thirtyMin = {
                changePercent: thirtyMinMomentum.changePercent,
                threshold: threshold,
                triggered: Math.abs(thirtyMinMomentum.changePercent) > threshold
            };
            
            if (analysis.momentum.thirtyMin.triggered) {
                analysis.triggers.push('THIRTY_MINUTE_MOMENTUM');
                analysis.maxRisk = Math.max(analysis.maxRisk, 3); // WARNING level
            }
        }
        
        // Volume Confirmation
        if (this.config.rules.VOLUME_CONFIRMATION.enabled) {
            const volumeAnalysis = this.analyzeVolumeSpike(symbol);
            if (volumeAnalysis) {
                analysis.volume = volumeAnalysis;
                
                if (volumeAnalysis.urgentSpike && analysis.maxRisk >= 3) {
                    analysis.triggers.push('VOLUME_CONFIRMED_URGENT');
                    analysis.maxRisk = 5; // Escalate to HALT
                } else if (volumeAnalysis.spike && analysis.maxRisk >= 2) {
                    analysis.triggers.push('VOLUME_CONFIRMED');
                    analysis.maxRisk = Math.max(analysis.maxRisk, 4); // Escalate to ALERT
                }
            }
        }
        
        // Opening/Closing Hour Protection
        const marketTime = this.getMarketTime();
        if (marketTime.phase === 'OPENING_HOUR') {
            const threshold = this.config.rules.INTRADAY_MOMENTUM.openingHourThreshold * regimeMultiplier;
            const hourMomentum = this.calculateMomentum(priceHistory, 60);
            
            if (hourMomentum && Math.abs(hourMomentum.changePercent) > threshold) {
                analysis.triggers.push('OPENING_HOUR_SURGE');
                analysis.maxRisk = Math.max(analysis.maxRisk, 3);
            }
        } else if (marketTime.phase === 'CLOSING_HOUR') {
            const threshold = this.config.rules.INTRADAY_MOMENTUM.closingThreshold * regimeMultiplier;
            const recentMomentum = this.calculateMomentum(priceHistory, 30);
            
            if (recentMomentum && Math.abs(recentMomentum.changePercent) > threshold) {
                analysis.triggers.push('CLOSING_SURGE');
                analysis.maxRisk = Math.max(analysis.maxRisk, 3);
            }
        }
        
        return analysis;
    }
    
    /**
     * Calculate momentum over a specific time window
     */
    calculateMomentum(priceHistory, minutes) {
        const now = new Date();
        const windowStart = new Date(now.getTime() - (minutes * 60 * 1000));
        
        // Find prices at window boundaries
        const currentPrice = priceHistory[priceHistory.length - 1].price;
        const startPrice = this.findPriceAtTime(priceHistory, windowStart);
        
        if (!startPrice) return null;
        
        const change = currentPrice - startPrice;
        const changePercent = change / startPrice;
        
        return {
            change: change,
            changePercent: changePercent,
            startPrice: startPrice,
            currentPrice: currentPrice,
            timeWindow: minutes
        };
    }
    
    /**
     * Analyze volume spike for confirmation
     */
    analyzeVolumeSpike(symbol) {
        const volumeHistory = this.volumeData.get(symbol);
        if (!volumeHistory || volumeHistory.length < 20) return null;
        
        // Calculate recent average volume
        const recentVolumes = volumeHistory.slice(-this.config.rules.VOLUME_CONFIRMATION.lookbackDays);
        const avgVolume = recentVolumes.reduce((sum, v) => sum + v.volume, 0) / recentVolumes.length;
        
        // Current volume
        const currentVolume = volumeHistory[volumeHistory.length - 1].volume;
        
        if (avgVolume === 0) return null;
        
        const volumeMultiplier = currentVolume / avgVolume;
        
        return {
            currentVolume: currentVolume,
            averageVolume: avgVolume,
            multiplier: volumeMultiplier,
            spike: volumeMultiplier > this.config.rules.VOLUME_CONFIRMATION.volumeMultiplier,
            urgentSpike: volumeMultiplier > this.config.rules.VOLUME_CONFIRMATION.urgentVolumeMultiplier
        };
    }
    
    /**
     * Assess protection level based on momentum analysis
     */
    assessProtectionLevel(symbol, analysis) {
        const riskLevel = analysis.maxRisk;
        
        // Find matching protection action
        const protectionEntry = Object.entries(this.config.actions)
            .find(([name, config]) => config.level === riskLevel);
        
        if (!protectionEntry) {
            return {
                level: 1,
                name: 'MONITOR',
                actions: ['LOG_MOMENTUM'],
                description: 'Normal monitoring'
            };
        }
        
        const [name, config] = protectionEntry;
        
        return {
            level: riskLevel,
            name: name,
            actions: config.actions,
            description: config.description,
            triggers: analysis.triggers,
            regime: analysis.regime
        };
    }
    
    /**
     * Process momentum alerts and take protective actions
     */
    processMomentumAlerts(alerts) {
        // Sort by risk level
        alerts.sort((a, b) => b.protection.level - a.protection.level);
        
        const criticalAlerts = alerts.filter(a => a.protection.level >= 4);
        const warningAlerts = alerts.filter(a => a.protection.level === 3);
        
        if (this.config.debug || criticalAlerts.length > 0) {
            logger.info('SYSTEM', '\n' + '='.repeat(70));
            logger.info('SYSTEM', '⚡ MOMENTUM SPIKE PROTECTION ALERTS');
            logger.info('SYSTEM', '='.repeat(70));
            
            for (const alert of alerts.slice(0, 10)) { // Top 10 alerts
                const icon = this.getProtectionIcon(alert.protection.name);
                const momentum = alert.analysis.momentum.fifteenMin;
                const changeStr = momentum ? 
                    `${momentum.changePercent > 0 ? '+' : ''}${(momentum.changePercent * 100).toFixed(2)}%` : 'N/A';
                
                logger.info('SYSTEM', `\n${icon} ${alert.symbol} - ${alert.protection.name} (Level ${alert.protection.level})`);
                logger.info('SYSTEM', `   15-Min Move: ${changeStr} | Regime: ${alert.analysis.regime}`);
                logger.info('SYSTEM', `   Triggers: ${alert.analysis.triggers.join(', ')}`);
                logger.info('SYSTEM', `   Actions: ${alert.protection.actions.join(', ')}`);
                
                if (alert.analysis.volume) {
                    logger.info('SYSTEM', `   Volume: ${alert.analysis.volume.multiplier.toFixed(1)}x average`);
                }
            }
            
            logger.info('SYSTEM', '\n' + '='.repeat(70));
        }
        
        // Store alerts
        this.alertHistory.push(...alerts);
        
        // Update protection states
        for (const alert of alerts) {
            this.protectionStates.set(alert.symbol, alert.protection);
            
            if (alert.protection.level >= 3) {
                this.activeProtections.add(alert.symbol);
            }
        }
        
        // Emit events
        if (criticalAlerts.length > 0) {
            this.emit('critical_momentum_detected', criticalAlerts);
            this.stats.protectionTriggered++;
        }
        
        if (warningAlerts.length > 0) {
            this.emit('momentum_warning', warningAlerts);
        }
        
        // Auto-protection actions
        if (this.config.autoProtection) {
            this.executeAutoProtection(criticalAlerts);
        }
        
        // Adjust monitoring frequency if needed
        this.adjustMonitoringFrequency();
    }
    
    /**
     * Execute automatic protection measures
     */
    executeAutoProtection(criticalAlerts) {
        if (criticalAlerts.length === 0) return;
        
        logger.warn('MOMENTUM_PROTECTION', 'Executing automatic momentum protection', {
            affectedSymbols: criticalAlerts.map(a => a.symbol),
            highestLevel: Math.max(...criticalAlerts.map(a => a.protection.level))
        });
        
        for (const alert of criticalAlerts) {
            const protectionMeasures = {
                symbol: alert.symbol,
                level: alert.protection.level,
                actions: alert.protection.actions,
                triggers: alert.analysis.triggers,
                momentum: alert.analysis.momentum.fifteenMin,
                timestamp: new Date()
            };
            
            this.emit('auto_protection_activated', protectionMeasures);
        }
    }
    
    /**
     * Adjust monitoring frequency based on market stress
     */
    adjustMonitoringFrequency() {
        const currentInterval = this.monitoringInterval ? this.monitoringInterval._idleTimeout : null;
        const targetInterval = this.activeProtections.size > 0 ? 
            this.config.urgentInterval : 
            this.config.monitoringInterval;
        
        if (currentInterval !== targetInterval) {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            
            this.monitoringInterval = setInterval(() => {
                this.performMomentumScan();
            }, targetInterval);
            
            logger.info('MOMENTUM_PROTECTION', `Adjusted monitoring frequency to ${targetInterval/1000}s`, {
                reason: this.activeProtections.size > 0 ? 'URGENT_MODE' : 'NORMAL_MODE',
                activeProtections: this.activeProtections.size
            });
        }
    }
    
    // Utility methods
    
    findPriceAtTime(priceHistory, targetTime) {
        // Find closest price point to target time
        let closest = null;
        let minDiff = Infinity;
        
        for (const point of priceHistory) {
            const diff = Math.abs(point.timestamp.getTime() - targetTime.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                closest = point;
            }
        }
        
        return closest ? closest.price : null;
    }
    
    getMarketTime() {
        const now = new Date();
        const hour = now.getHours();
        const minutes = now.getMinutes();
        const timeMinutes = hour * 60 + minutes;
        
        // Market times in minutes from midnight
        const marketOpen = 9 * 60 + 30; // 9:30 AM
        const marketClose = 16 * 60; // 4:00 PM
        const openingHourEnd = marketOpen + 60; // 10:30 AM
        const closingHourStart = marketClose - 60; // 3:00 PM
        
        if (timeMinutes < marketOpen || timeMinutes >= marketClose) {
            return { phase: 'CLOSED', timeMinutes };
        } else if (timeMinutes <= openingHourEnd) {
            return { phase: 'OPENING_HOUR', timeMinutes };
        } else if (timeMinutes >= closingHourStart) {
            return { phase: 'CLOSING_HOUR', timeMinutes };
        } else {
            return { phase: 'REGULAR', timeMinutes };
        }
    }
    
    getProtectionIcon(level) {
        const icons = {
            'MONITOR': '👁️',
            'CAUTION': '🟡',
            'WARNING': '🟠',
            'ALERT': '🔴',
            'HALT': '🛑'
        };
        return icons[level] || '📊';
    }
    
    cleanupOldData() {
        const cutoff = Date.now() - (this.config.dataRetentionHours * 60 * 60 * 1000);
        
        // Clean price data
        for (const [symbol, data] of this.priceData) {
            const filtered = data.filter(point => point.timestamp.getTime() > cutoff);
            this.priceData.set(symbol, filtered);
        }
        
        // Clean volume data
        for (const [symbol, data] of this.volumeData) {
            const filtered = data.filter(point => point.timestamp.getTime() > cutoff);
            this.volumeData.set(symbol, filtered);
        }
        
        // Clean alert history
        this.alertHistory = this.alertHistory.filter(alert => 
            alert.timestamp.getTime() > cutoff
        );
        
        // Clear expired protections
        for (const symbol of this.activeProtections) {
            const protection = this.protectionStates.get(symbol);
            if (!protection || Date.now() - protection.timestamp > 300000) { // 5 minutes
                this.activeProtections.delete(symbol);
                this.protectionStates.delete(symbol);
            }
        }
    }
    
    async getCurrentPrice(symbol) {
        try {
            // Use real API data if available
            if (this.api && this.api.getQuote) {
                const quote = await this.api.getQuote(symbol);
                if (quote && (quote.price || quote.last || quote.close)) {
                    return {
                        symbol: symbol,
                        price: quote.price || quote.last || quote.close,
                        volume: quote.volume || quote.totalVolume || 0,
                        timestamp: new Date()
                    };
                }
            }
            
            // Fallback to DataManager for real cached data
            if (this.dataManager) {
                const marketData = await this.dataManager.getCurrentPrice(symbol);
                if (marketData && marketData.price) {
                    return {
                        symbol: symbol,
                        price: marketData.price,
                        volume: marketData.volume || 0,
                        timestamp: new Date()
                    };
                }
            }
            
            // No synthetic data generation - return null if no real data available
            logger.error('MOMENTUM_PROTECTION', `No real market data available for ${symbol}`);
            return null;
        } catch (error) {
            logger.error('MOMENTUM_PROTECTION', `Failed to get price for ${symbol}:`, error);
            return null;
        }
    }
    
    // Constructor should initialize dataManager if not provided
    initializeDataManager() {
        if (!this.dataManager && !this.api) {
            const DataManager = require('./dataManager');
            this.dataManager = new DataManager(this.api);
        }
    }
    
    // Public interface methods
    
    getStatus() {
        return {
            enabled: this.config.enabled,
            monitoring: this.monitoringInterval !== null,
            regime: this.currentRegime,
            activeProtections: this.activeProtections.size,
            trackedSymbols: this.config.trackedSymbols.length,
            lastUpdate: this.lastUpdate,
            statistics: this.stats
        };
    }
    
    getMomentumAnalysis(symbol) {
        return this.momentumAnalysis.get(symbol) || null;
    }
    
    getProtectionState(symbol) {
        return this.protectionStates.get(symbol) || null;
    }
    
    getCurrentAlerts() {
        const recentAlerts = this.alertHistory.filter(alert => 
            Date.now() - alert.timestamp.getTime() < 3600000 // Last hour
        );
        
        return recentAlerts.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    forceProtection(symbol, level = 'WARNING') {
        logger.warn('MOMENTUM_PROTECTION', `Manual protection activated for ${symbol}`, { level });
        
        const protection = this.config.actions[level] || this.config.actions['WARNING'];
        this.protectionStates.set(symbol, {
            ...protection,
            name: level,
            manual: true,
            timestamp: new Date()
        });
        
        this.activeProtections.add(symbol);
        this.emit('manual_protection_activated', { symbol, level, protection });
    }
    
    clearProtection(symbol) {
        this.protectionStates.delete(symbol);
        this.activeProtections.delete(symbol);
        logger.info('MOMENTUM_PROTECTION', `Protection cleared for ${symbol}`);
    }
    
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('MOMENTUM_PROTECTION', 'Monitoring stopped');
        }
    }
}

// Export
module.exports = {
    MomentumSpikeProtection,
    MOMENTUM_RULES,
    MARKET_REGIMES,
    PROTECTION_ACTIONS
};