/**
 * Options Flow Anomaly Detection System
 * 
 * Implements sophisticated detection of unusual options activity patterns that may
 * indicate institutional positioning, upcoming events, or potential market moves.
 * 
 * Key Features:
 * - Real-time options flow monitoring
 * - Volume/Open Interest anomaly detection
 * - Unusual activity pattern recognition
 * - Cross-strike and cross-expiration analysis
 * - Integration with Tom King's risk management protocols
 * 
 * Author: Tom King Trading Framework v17.4
 * Created: 2025-09-03
 */

const EventEmitter = require('events');
const { VIX_REGIMES } = require('./config');

class OptionsFlowAnomalyDetector extends EventEmitter {
    constructor(tastytradeAPI, dataManager, riskManager) {
        super();
        this.api = tastytradeAPI;
        this.dataManager = dataManager;
        this.riskManager = riskManager;
        
        // Real-time flow monitoring
        this.activeFlowMonitoring = new Map();
        this.historicalBaselines = new Map();
        this.anomalyThresholds = ANOMALY_THRESHOLDS;
        this.detectionAlgorithms = DETECTION_ALGORITHMS;
        
        // Flow analysis state
        this.flowAnalysisCache = new Map();
        this.institutionalPatterns = new Map();
        this.retailPatterns = new Map();
        
        // Event tracking
        this.activeAnomalies = new Map();
        this.anomalyHistory = [];
        
        this.initializeFlowMonitoring();
    }

    async initializeFlowMonitoring() {
        logger.info('SYSTEM', '🔍 Initializing Options Flow Anomaly Detection System');
        
        try {
            // Load historical baselines
            await this.loadHistoricalBaselines();
            
            // Initialize real-time monitoring for key symbols
            await this.startRealTimeFlowMonitoring();
            
            // Set up periodic analysis
            this.startPeriodicAnalysis();
            
            logger.info('SYSTEM', '✅ Options Flow Anomaly Detection System initialized');
            this.emit('systemReady');
            
        } catch (error) {
            logger.error('ERROR', '❌ Failed to initialize Options Flow Anomaly Detection:', error);
            this.emit('systemError', error);
        }
    }

    async loadHistoricalBaselines() {
        logger.info('SYSTEM', '📊 Loading historical flow baselines...');
        
        const symbols = MONITORED_SYMBOLS.concat(['SPY', 'QQQ', 'IWM', 'VIX']);
        
        for (const symbol of symbols) {
            try {
                const historicalData = await this.fetchHistoricalFlowData(symbol);
                const baseline = this.calculateFlowBaseline(historicalData);
                this.historicalBaselines.set(symbol, baseline);
                
                logger.info('SYSTEM', `📈 Loaded baseline for ${symbol}:`, {
                    avgDailyVolume: baseline.avgDailyVolume,
                    avgCallPutRatio: baseline.avgCallPutRatio,
                    avgPremiumFlow: baseline.avgPremiumFlow
                });
                
            } catch (error) {
                logger.error('ERROR', `⚠️ Failed to load baseline for ${symbol}:`, error);
            }
        }
    }

    async fetchHistoricalFlowData(symbol, days = 30) {
        try {
            const optionChains = await this.api.getHistoricalOptionChains(symbol, days);
            const flowData = [];
            
            for (const chain of optionChains) {
                const dailyFlow = this.analyzeChainFlow(chain);
                flowData.push(dailyFlow);
            }
            
            return flowData;
            
        } catch (error) {
            logger.error('ERROR', `Failed to fetch historical flow data for ${symbol}:`, error);
            return [];
        }
    }

    calculateFlowBaseline(historicalData) {
        if (!historicalData.length) return null;
        
        const volumes = historicalData.map(d => d.totalVolume);
        const callPutRatios = historicalData.map(d => d.callPutRatio);
        const premiumFlows = historicalData.map(d => d.totalPremiumFlow);
        
        return {
            avgDailyVolume: this.calculateMean(volumes),
            avgDailyVolumeStdDev: this.calculateStdDev(volumes),
            avgCallPutRatio: this.calculateMean(callPutRatios),
            avgCallPutRatioStdDev: this.calculateStdDev(callPutRatios),
            avgPremiumFlow: this.calculateMean(premiumFlows),
            avgPremiumFlowStdDev: this.calculateStdDev(premiumFlows),
            
            // Percentile thresholds
            volume90thPercentile: this.calculatePercentile(volumes, 0.9),
            volume95thPercentile: this.calculatePercentile(volumes, 0.95),
            volume99thPercentile: this.calculatePercentile(volumes, 0.99),
            
            premiumFlow90thPercentile: this.calculatePercentile(premiumFlows, 0.9),
            premiumFlow95thPercentile: this.calculatePercentile(premiumFlows, 0.95),
            premiumFlow99thPercentile: this.calculatePercentile(premiumFlows, 0.99)
        };
    }

    async startRealTimeFlowMonitoring() {
        logger.info('SYSTEM', '🔄 Starting real-time options flow monitoring...');
        
        // Monitor key market symbols
        const keySymbols = ['SPY', 'QQQ', 'IWM', 'AAPL', 'MSFT', 'TSLA', 'NVDA'];
        
        for (const symbol of keySymbols) {
            this.activeFlowMonitoring.set(symbol, {
                lastUpdate: new Date(),
                currentFlow: null,
                anomalies: [],
                alertLevel: 'NORMAL'
            });
        }
        
        // Start WebSocket streaming for real-time data
        if (this.api.websocket) {
            this.api.websocket.subscribeToOptionFlow(keySymbols, (data) => {
                this.processRealTimeFlowData(data);
            });
        }
    }

    startPeriodicAnalysis() {
        // Run comprehensive analysis every 5 minutes during market hours
        setInterval(() => {
            if (this.isMarketHours()) {
                this.runComprehensiveFlowAnalysis();
            }
        }, 5 * 60 * 1000);
        
        // Run deep analysis every 30 minutes
        setInterval(() => {
            if (this.isMarketHours()) {
                this.runDeepFlowAnalysis();
            }
        }, 30 * 60 * 1000);
        
        // Update baselines daily
        setInterval(() => {
            this.updateDailyBaselines();
        }, 24 * 60 * 60 * 1000);
    }

    async processRealTimeFlowData(data) {
        try {
            const { symbol, optionFlow, timestamp } = data;
            
            // Update current flow data
            const monitoring = this.activeFlowMonitoring.get(symbol);
            if (monitoring) {
                monitoring.currentFlow = optionFlow;
                monitoring.lastUpdate = new Date(timestamp);
            }
            
            // Check for immediate anomalies
            const anomalies = await this.detectRealTimeAnomalies(symbol, optionFlow);
            
            if (anomalies.length > 0) {
                await this.processDetectedAnomalies(symbol, anomalies);
            }
            
        } catch (error) {
            logger.error('ERROR', 'Error processing real-time flow data:', error);
        }
    }

    async detectRealTimeAnomalies(symbol, optionFlow) {
        const anomalies = [];
        const baseline = this.historicalBaselines.get(symbol);
        
        if (!baseline || !optionFlow) return anomalies;
        
        // Volume anomaly detection
        const volumeAnomaly = this.detectVolumeAnomaly(optionFlow, baseline);
        if (volumeAnomaly) anomalies.push(volumeAnomaly);
        
        // Call/Put ratio anomaly detection
        const ratioAnomaly = this.detectCallPutRatioAnomaly(optionFlow, baseline);
        if (ratioAnomaly) anomalies.push(ratioAnomaly);
        
        // Premium flow anomaly detection
        const premiumAnomaly = this.detectPremiumFlowAnomaly(optionFlow, baseline);
        if (premiumAnomaly) anomalies.push(premiumAnomaly);
        
        // Cross-strike analysis
        const strikeAnomalies = this.detectCrossStrikeAnomalies(optionFlow);
        anomalies.push(...strikeAnomalies);
        
        // Time decay anomaly (unusual activity near expiration)
        const timeDecayAnomaly = this.detectTimeDecayAnomaly(optionFlow);
        if (timeDecayAnomaly) anomalies.push(timeDecayAnomaly);
        
        return anomalies;
    }

    detectVolumeAnomaly(optionFlow, baseline) {
        const currentVolume = optionFlow.totalVolume;
        const avgVolume = baseline.avgDailyVolume;
        const stdDev = baseline.avgDailyVolumeStdDev;
        
        // Z-score calculation
        const zScore = (currentVolume - avgVolume) / stdDev;
        
        if (Math.abs(zScore) > this.anomalyThresholds.VOLUME_Z_SCORE_THRESHOLD) {
            return {
                type: 'VOLUME_ANOMALY',
                severity: this.calculateAnomalySeverity(zScore),
                zScore: zScore,
                currentVolume: currentVolume,
                averageVolume: avgVolume,
                description: `Unusual volume: ${currentVolume} vs avg ${avgVolume.toFixed(0)} (${zScore.toFixed(2)} σ)`
            };
        }
        
        return null;
    }

    detectCallPutRatioAnomaly(optionFlow, baseline) {
        const currentRatio = optionFlow.callVolume / Math.max(optionFlow.putVolume, 1);
        const avgRatio = baseline.avgCallPutRatio;
        const stdDev = baseline.avgCallPutRatioStdDev;
        
        const zScore = (currentRatio - avgRatio) / stdDev;
        
        if (Math.abs(zScore) > this.anomalyThresholds.CALL_PUT_RATIO_THRESHOLD) {
            return {
                type: 'CALL_PUT_RATIO_ANOMALY',
                severity: this.calculateAnomalySeverity(zScore),
                zScore: zScore,
                currentRatio: currentRatio,
                averageRatio: avgRatio,
                bias: zScore > 0 ? 'BULLISH' : 'BEARISH',
                description: `Unusual C/P ratio: ${currentRatio.toFixed(2)} vs avg ${avgRatio.toFixed(2)} (${zScore.toFixed(2)} σ)`
            };
        }
        
        return null;
    }

    detectPremiumFlowAnomaly(optionFlow, baseline) {
        const currentPremiumFlow = optionFlow.totalPremiumFlow;
        const avgPremiumFlow = baseline.avgPremiumFlow;
        const stdDev = baseline.avgPremiumFlowStdDev;
        
        const zScore = (currentPremiumFlow - avgPremiumFlow) / stdDev;
        
        if (Math.abs(zScore) > this.anomalyThresholds.PREMIUM_FLOW_THRESHOLD) {
            return {
                type: 'PREMIUM_FLOW_ANOMALY',
                severity: this.calculateAnomalySeverity(zScore),
                zScore: zScore,
                currentFlow: currentPremiumFlow,
                averageFlow: avgPremiumFlow,
                description: `Unusual premium flow: $${(currentPremiumFlow/1000000).toFixed(1)}M vs avg $${(avgPremiumFlow/1000000).toFixed(1)}M`
            };
        }
        
        return null;
    }

    detectCrossStrikeAnomalies(optionFlow) {
        const anomalies = [];
        
        if (!optionFlow.strikeData || optionFlow.strikeData.length < 3) return anomalies;
        
        // Sort strikes by volume
        const sortedStrikes = optionFlow.strikeData.sort((a, b) => b.volume - a.volume);
        const topStrikes = sortedStrikes.slice(0, 5);
        
        // Detect unusual concentration at specific strikes
        const totalVolume = sortedStrikes.reduce((sum, strike) => sum + strike.volume, 0);
        
        for (const strike of topStrikes) {
            const concentration = strike.volume / totalVolume;
            
            if (concentration > this.anomalyThresholds.STRIKE_CONCENTRATION_THRESHOLD) {
                anomalies.push({
                    type: 'STRIKE_CONCENTRATION_ANOMALY',
                    severity: concentration > 0.5 ? 'HIGH' : 'MEDIUM',
                    strike: strike.strike,
                    concentration: concentration,
                    volume: strike.volume,
                    description: `High concentration at $${strike.strike} strike: ${(concentration * 100).toFixed(1)}% of volume`
                });
            }
        }
        
        return anomalies;
    }

    detectTimeDecayAnomaly(optionFlow) {
        if (!optionFlow.expirationData) return null;
        
        // Look for unusual activity in options expiring within 7 days
        const nearTermExpirations = optionFlow.expirationData.filter(exp => exp.daysToExpiration <= 7);
        
        if (nearTermExpirations.length === 0) return null;
        
        const nearTermVolume = nearTermExpirations.reduce((sum, exp) => sum + exp.volume, 0);
        const totalVolume = optionFlow.expirationData.reduce((sum, exp) => sum + exp.volume, 0);
        const nearTermRatio = nearTermVolume / totalVolume;
        
        if (nearTermRatio > this.anomalyThresholds.NEAR_TERM_VOLUME_THRESHOLD) {
            return {
                type: 'TIME_DECAY_ANOMALY',
                severity: nearTermRatio > 0.7 ? 'HIGH' : 'MEDIUM',
                nearTermRatio: nearTermRatio,
                nearTermVolume: nearTermVolume,
                description: `High near-term volume: ${(nearTermRatio * 100).toFixed(1)}% in options expiring within 7 days`
            };
        }
        
        return null;
    }

    async processDetectedAnomalies(symbol, anomalies) {
        logger.info('SYSTEM', `🚨 Detected ${anomalies.length} flow anomalies for ${symbol}`);
        
        for (const anomaly of anomalies) {
            // Store anomaly
            const anomalyKey = `${symbol}_${anomaly.type}_${Date.now()}`;
            this.activeAnomalies.set(anomalyKey, {
                ...anomaly,
                symbol: symbol,
                timestamp: new Date(),
                resolved: false
            });
            
            // Update alert level
            this.updateAlertLevel(symbol, anomaly.severity);
            
            // Emit anomaly event
            this.emit('anomalyDetected', {
                symbol: symbol,
                anomaly: anomaly,
                timestamp: new Date()
            });
            
            // Log detailed information
            logger.info('SYSTEM', `🔍 ${symbol} - ${anomaly.type}:`, anomaly.description);
            
            // Check if this anomaly affects our positions
            await this.checkAnomalyImpactOnPositions(symbol, anomaly);
        }
        
        // Store in history
        this.anomalyHistory.push({
            symbol: symbol,
            anomalies: anomalies,
            timestamp: new Date()
        });
        
        // Clean old history (keep 30 days)
        this.cleanAnomalyHistory();
    }

    updateAlertLevel(symbol, severity) {
        const monitoring = this.activeFlowMonitoring.get(symbol);
        if (!monitoring) return;
        
        const currentLevel = monitoring.alertLevel;
        let newLevel = currentLevel;
        
        switch (severity) {
            case 'HIGH':
                newLevel = 'HIGH';
                break;
            case 'MEDIUM':
                if (currentLevel === 'NORMAL') newLevel = 'MEDIUM';
                break;
            case 'LOW':
                if (currentLevel === 'NORMAL') newLevel = 'LOW';
                break;
        }
        
        if (newLevel !== currentLevel) {
            monitoring.alertLevel = newLevel;
            this.emit('alertLevelChanged', {
                symbol: symbol,
                oldLevel: currentLevel,
                newLevel: newLevel,
                timestamp: new Date()
            });
        }
    }

    async checkAnomalyImpactOnPositions(symbol, anomaly) {
        try {
            // Get current positions for this symbol
            const positions = await this.riskManager.getPositionsForSymbol(symbol);
            
            if (positions.length === 0) return;
            
            logger.info('SYSTEM', `📊 Checking anomaly impact on ${positions.length} positions for ${symbol}`);
            
            for (const position of positions) {
                const impact = this.calculateAnomalyImpact(position, anomaly);
                
                if (impact.riskLevel === 'HIGH') {
                    this.emit('positionRiskAlert', {
                        symbol: symbol,
                        position: position,
                        anomaly: anomaly,
                        impact: impact,
                        timestamp: new Date()
                    });
                    
                    logger.info('SYSTEM', `⚠️ HIGH RISK: Position ${position.id} affected by ${anomaly.type}`);
                }
            }
            
        } catch (error) {
            logger.error('ERROR', `Error checking anomaly impact for ${symbol}:`, error);
        }
    }

    calculateAnomalyImpact(position, anomaly) {
        let riskLevel = 'LOW';
        let impactScore = 0;
        const factors = [];
        
        // Factor 1: Anomaly severity
        switch (anomaly.severity) {
            case 'HIGH':
                impactScore += 3;
                factors.push('High severity anomaly');
                break;
            case 'MEDIUM':
                impactScore += 2;
                factors.push('Medium severity anomaly');
                break;
            case 'LOW':
                impactScore += 1;
                factors.push('Low severity anomaly');
                break;
        }
        
        // Factor 2: Position type correlation with anomaly
        if (anomaly.type === 'CALL_PUT_RATIO_ANOMALY') {
            if (position.type === 'CALL' && anomaly.bias === 'BEARISH') {
                impactScore += 2;
                factors.push('Call position with bearish flow bias');
            } else if (position.type === 'PUT' && anomaly.bias === 'BULLISH') {
                impactScore += 2;
                factors.push('Put position with bullish flow bias');
            }
        }
        
        // Factor 3: Time to expiration correlation
        if (anomaly.type === 'TIME_DECAY_ANOMALY' && position.daysToExpiration <= 7) {
            impactScore += 2;
            factors.push('Near-term position with time decay anomaly');
        }
        
        // Factor 4: Strike proximity for concentration anomalies
        if (anomaly.type === 'STRIKE_CONCENTRATION_ANOMALY') {
            const strikeDiff = Math.abs(position.strike - anomaly.strike);
            const underlyingPrice = position.underlyingPrice || 100; // fallback
            const strikePctDiff = strikeDiff / underlyingPrice;
            
            if (strikePctDiff < 0.05) { // Within 5%
                impactScore += 3;
                factors.push('Strike within 5% of concentration anomaly');
            } else if (strikePctDiff < 0.10) { // Within 10%
                impactScore += 1;
                factors.push('Strike within 10% of concentration anomaly');
            }
        }
        
        // Determine risk level
        if (impactScore >= 6) {
            riskLevel = 'HIGH';
        } else if (impactScore >= 3) {
            riskLevel = 'MEDIUM';
        }
        
        return {
            riskLevel: riskLevel,
            impactScore: impactScore,
            factors: factors,
            recommendation: this.generateImpactRecommendation(riskLevel, factors)
        };
    }

    generateImpactRecommendation(riskLevel, factors) {
        switch (riskLevel) {
            case 'HIGH':
                return 'Consider immediate position review and potential defensive adjustment';
            case 'MEDIUM':
                return 'Monitor position closely and prepare for potential adjustment';
            case 'LOW':
                return 'Note anomaly but continue normal monitoring';
            default:
                return 'No specific action required';
        }
    }

    async runComprehensiveFlowAnalysis() {
        logger.info('SYSTEM', '🔄 Running comprehensive options flow analysis...');
        
        try {
            const symbols = Array.from(this.activeFlowMonitoring.keys());
            const analysisResults = new Map();
            
            for (const symbol of symbols) {
                const analysis = await this.performSymbolFlowAnalysis(symbol);
                analysisResults.set(symbol, analysis);
            }
            
            // Generate market-wide insights
            const marketInsights = this.generateMarketWideInsights(analysisResults);
            
            this.emit('comprehensiveAnalysisComplete', {
                symbolAnalysis: analysisResults,
                marketInsights: marketInsights,
                timestamp: new Date()
            });
            
        } catch (error) {
            logger.error('ERROR', 'Error in comprehensive flow analysis:', error);
        }
    }

    async performSymbolFlowAnalysis(symbol) {
        try {
            // Get current option chain
            const optionChain = await this.api.getOptionChain(symbol);
            if (!optionChain) return null;
            
            // Analyze current flow patterns
            const flowAnalysis = this.analyzeChainFlow(optionChain);
            
            // Compare with historical patterns
            const baseline = this.historicalBaselines.get(symbol);
            const comparison = baseline ? this.compareWithBaseline(flowAnalysis, baseline) : null;
            
            // Detect institutional vs retail patterns
            const institutionalSignals = this.detectInstitutionalActivity(optionChain);
            const retailSignals = this.detectRetailActivity(optionChain);
            
            return {
                symbol: symbol,
                flowAnalysis: flowAnalysis,
                baselineComparison: comparison,
                institutionalSignals: institutionalSignals,
                retailSignals: retailSignals,
                timestamp: new Date()
            };
            
        } catch (error) {
            logger.error('ERROR', `Error analyzing flow for ${symbol}:`, error);
            return null;
        }
    }

    analyzeChainFlow(optionChain) {
        let totalVolume = 0;
        let totalOpenInterest = 0;
        let callVolume = 0;
        let putVolume = 0;
        let totalPremiumFlow = 0;
        
        const strikeData = [];
        const expirationData = new Map();
        
        for (const option of optionChain.options) {
            const volume = option.volume || 0;
            const openInterest = option.openInterest || 0;
            const premium = (option.bid + option.ask) / 2 * volume * 100;
            
            totalVolume += volume;
            totalOpenInterest += openInterest;
            totalPremiumFlow += premium;
            
            if (option.optionType === 'call') {
                callVolume += volume;
            } else {
                putVolume += volume;
            }
            
            // Strike analysis
            strikeData.push({
                strike: option.strike,
                volume: volume,
                openInterest: openInterest,
                type: option.optionType,
                premium: premium,
                delta: option.delta,
                gamma: option.gamma
            });
            
            // Expiration analysis
            const expKey = option.expiration;
            if (!expirationData.has(expKey)) {
                expirationData.set(expKey, {
                    expiration: expKey,
                    volume: 0,
                    openInterest: 0,
                    daysToExpiration: option.daysToExpiration || 0
                });
            }
            const expData = expirationData.get(expKey);
            expData.volume += volume;
            expData.openInterest += openInterest;
        }
        
        return {
            totalVolume: totalVolume,
            totalOpenInterest: totalOpenInterest,
            callVolume: callVolume,
            putVolume: putVolume,
            callPutRatio: putVolume > 0 ? callVolume / putVolume : callVolume,
            totalPremiumFlow: totalPremiumFlow,
            strikeData: strikeData.sort((a, b) => b.volume - a.volume),
            expirationData: Array.from(expirationData.values()).sort((a, b) => a.daysToExpiration - b.daysToExpiration)
        };
    }

    detectInstitutionalActivity(optionChain) {
        const institutionalSignals = [];
        
        // Large block trades (typically institutional)
        const largeBlocks = optionChain.options.filter(opt => (opt.volume || 0) >= 1000);
        if (largeBlocks.length > 0) {
            institutionalSignals.push({
                type: 'LARGE_BLOCK_ACTIVITY',
                count: largeBlocks.length,
                totalVolume: largeBlocks.reduce((sum, opt) => sum + opt.volume, 0),
                description: `${largeBlocks.length} large block trades detected`
            });
        }
        
        // Deep OTM activity (often institutional hedging)
        const underlyingPrice = optionChain.underlyingPrice || 100;
        const deepOTM = optionChain.options.filter(opt => {
            const moneyness = Math.abs(opt.strike - underlyingPrice) / underlyingPrice;
            return moneyness > 0.15 && (opt.volume || 0) > 100;
        });
        
        if (deepOTM.length > 0) {
            institutionalSignals.push({
                type: 'DEEP_OTM_ACTIVITY',
                count: deepOTM.length,
                totalVolume: deepOTM.reduce((sum, opt) => sum + opt.volume, 0),
                description: `Deep OTM activity suggests institutional hedging`
            });
        }
        
        return institutionalSignals;
    }

    detectRetailActivity(optionChain) {
        const retailSignals = [];
        
        // Small lot clustering (typically retail)
        const smallLots = optionChain.options.filter(opt => 
            (opt.volume || 0) > 0 && (opt.volume || 0) < 100
        );
        
        if (smallLots.length > 10) {
            retailSignals.push({
                type: 'SMALL_LOT_CLUSTERING',
                count: smallLots.length,
                totalVolume: smallLots.reduce((sum, opt) => sum + opt.volume, 0),
                description: `High retail activity with ${smallLots.length} small lot trades`
            });
        }
        
        // ATM concentration (retail preference)
        const underlyingPrice = optionChain.underlyingPrice || 100;
        const atmOptions = optionChain.options.filter(opt => {
            const moneyness = Math.abs(opt.strike - underlyingPrice) / underlyingPrice;
            return moneyness < 0.05;
        });
        
        const atmVolume = atmOptions.reduce((sum, opt) => sum + (opt.volume || 0), 0);
        const totalVolume = optionChain.options.reduce((sum, opt) => sum + (opt.volume || 0), 0);
        
        if (atmVolume / totalVolume > 0.4) {
            retailSignals.push({
                type: 'ATM_CONCENTRATION',
                concentration: atmVolume / totalVolume,
                atmVolume: atmVolume,
                description: `High ATM concentration suggests retail interest`
            });
        }
        
        return retailSignals;
    }

    generateMarketWideInsights(analysisResults) {
        const insights = {
            overallSentiment: 'NEUTRAL',
            dominantPatterns: [],
            sectorInsights: new Map(),
            riskAlerts: []
        };
        
        let totalCallVolume = 0;
        let totalPutVolume = 0;
        const highVolumeSymbols = [];
        const anomalySymbols = [];
        
        for (const [symbol, analysis] of analysisResults) {
            if (!analysis) continue;
            
            totalCallVolume += analysis.flowAnalysis.callVolume;
            totalPutVolume += analysis.flowAnalysis.putVolume;
            
            // Track high volume symbols
            if (analysis.flowAnalysis.totalVolume > 100000) {
                highVolumeSymbols.push({
                    symbol: symbol,
                    volume: analysis.flowAnalysis.totalVolume
                });
            }
            
            // Track symbols with anomalies
            const monitoring = this.activeFlowMonitoring.get(symbol);
            if (monitoring && monitoring.alertLevel !== 'NORMAL') {
                anomalySymbols.push({
                    symbol: symbol,
                    alertLevel: monitoring.alertLevel
                });
            }
        }
        
        // Overall sentiment
        const marketCallPutRatio = totalPutVolume > 0 ? totalCallVolume / totalPutVolume : totalCallVolume;
        if (marketCallPutRatio > 1.5) {
            insights.overallSentiment = 'BULLISH';
        } else if (marketCallPutRatio < 0.7) {
            insights.overallSentiment = 'BEARISH';
        }
        
        insights.marketCallPutRatio = marketCallPutRatio;
        insights.highVolumeSymbols = highVolumeSymbols.sort((a, b) => b.volume - a.volume);
        insights.anomalySymbols = anomalySymbols;
        
        return insights;
    }

    calculateAnomalySeverity(zScore) {
        const absZScore = Math.abs(zScore);
        
        if (absZScore >= 3.0) return 'HIGH';
        if (absZScore >= 2.0) return 'MEDIUM';
        if (absZScore >= 1.5) return 'LOW';
        return 'NORMAL';
    }

    calculateMean(values) {
        return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    }

    calculateStdDev(values) {
        if (values.length < 2) return 0;
        const mean = this.calculateMean(values);
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
        return Math.sqrt(variance);
    }

    calculatePercentile(values, percentile) {
        const sorted = values.slice().sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * percentile) - 1;
        return sorted[Math.max(0, index)];
    }

    isMarketHours() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeInMinutes = hour * 60 + minute;
        
        // Monday to Friday
        if (day === 0 || day === 6) return false;
        
        // 9:30 AM to 4:00 PM Eastern (converted to minutes)
        const marketOpen = 9 * 60 + 30;  // 9:30 AM
        const marketClose = 16 * 60;     // 4:00 PM
        
        return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
    }

    cleanAnomalyHistory() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        
        this.anomalyHistory = this.anomalyHistory.filter(
            entry => entry.timestamp > cutoffDate
        );
    }

    updateDailyBaselines() {
        logger.info('SYSTEM', '📊 Updating daily baselines...');
        
        // This would typically run overnight to update baselines with the latest data
        for (const symbol of this.historicalBaselines.keys()) {
            this.updateBaselineForSymbol(symbol);
        }
    }

    async updateBaselineForSymbol(symbol) {
        try {
            const historicalData = await this.fetchHistoricalFlowData(symbol, 30);
            if (historicalData.length > 0) {
                const newBaseline = this.calculateFlowBaseline(historicalData);
                this.historicalBaselines.set(symbol, newBaseline);
                logger.info('SYSTEM', `✅ Updated baseline for ${symbol}`);
            }
        } catch (error) {
            logger.error('ERROR', `Failed to update baseline for ${symbol}:`, error);
        }
    }

    // Public API methods
    async getAnomaliesForSymbol(symbol) {
        const anomalies = [];
        for (const [key, anomaly] of this.activeAnomalies) {
            if (anomaly.symbol === symbol && !anomaly.resolved) {
                anomalies.push(anomaly);
            }
        }
        return anomalies;
    }

    async getMarketWideAnomalies() {
        const anomalies = [];
        for (const [key, anomaly] of this.activeAnomalies) {
            if (!anomaly.resolved) {
                anomalies.push(anomaly);
            }
        }
        return anomalies.sort((a, b) => b.timestamp - a.timestamp);
    }

    async resolveAnomaly(anomalyKey, resolution) {
        const anomaly = this.activeAnomalies.get(anomalyKey);
        if (anomaly) {
            anomaly.resolved = true;
            anomaly.resolution = resolution;
            anomaly.resolvedAt = new Date();
            
            this.emit('anomalyResolved', {
                anomaly: anomaly,
                resolution: resolution,
                timestamp: new Date()
            });
        }
    }

    getSystemStatus() {
        return {
            isRunning: true,
            monitoredSymbols: Array.from(this.activeFlowMonitoring.keys()),
            activeAnomalies: this.activeAnomalies.size,
            lastUpdate: new Date(),
            baselines: Array.from(this.historicalBaselines.keys()).length
        };
    }
}

// Configuration constants
const MONITORED_SYMBOLS = [
    'SPY', 'QQQ', 'IWM', 'DIA',
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META',
    'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLRE', 'XLB'
];

const ANOMALY_THRESHOLDS = {
    VOLUME_Z_SCORE_THRESHOLD: 2.5,
    CALL_PUT_RATIO_THRESHOLD: 2.0,
    PREMIUM_FLOW_THRESHOLD: 2.5,
    STRIKE_CONCENTRATION_THRESHOLD: 0.3,
    NEAR_TERM_VOLUME_THRESHOLD: 0.6
};

const DETECTION_ALGORITHMS = {
    STATISTICAL: 'statistical',
    MACHINE_LEARNING: 'machine_learning',
    PATTERN_RECOGNITION: 'pattern_recognition',
    HYBRID: 'hybrid'
};

module.exports = OptionsFlowAnomalyDetector;
const { getLogger } = require('./logger');
const logger = getLogger();

