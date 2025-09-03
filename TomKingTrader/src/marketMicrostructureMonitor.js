/**
 * Market Microstructure Monitor
 * 
 * Implements Tom King's market microstructure analysis including gap fill detection,
 * intraday level monitoring, volume profile analysis, and order flow dynamics.
 * 
 * Key Features:
 * - Gap fill detection and tracking (Tom King's signature analysis)
 * - Intraday support/resistance level monitoring
 * - Volume profile and VWAP analysis
 * - Order flow imbalance detection
 * - Market maker behavior pattern recognition
 * - Real-time microstructure anomaly alerts
 * 
 * Author: Tom King Trading Framework v17.4
 * Created: 2025-09-03
 */

const EventEmitter = require('events');
const { VIX_REGIMES } = require('./config');

class MarketMicrostructureMonitor extends EventEmitter {
    constructor(tastytradeAPI, dataManager, patternAnalysis) {
        super();
        this.api = tastytradeAPI;
        this.dataManager = dataManager;
        this.patternAnalysis = patternAnalysis;
        
        // Gap tracking
        this.activeGaps = new Map();
        this.gapHistory = new Map();
        this.gapFillPatterns = GAP_FILL_PATTERNS;
        
        // Microstructure state
        this.currentLevels = new Map();
        this.volumeProfiles = new Map();
        this.orderFlowData = new Map();
        this.marketMakerBehavior = new Map();
        
        // Real-time monitoring
        this.monitoringActive = false;
        this.lastTickData = new Map();
        this.microstructureAlerts = [];
        
        this.initializeMicrostructureMonitoring();
    }

    async initializeMicrostructureMonitoring() {
        console.log('📊 Initializing Market Microstructure Monitor');
        
        try {
            // Initialize gap detection for key symbols
            await this.initializeGapDetection();
            
            // Load historical microstructure data
            await this.loadHistoricalMicrostructure();
            
            // Start real-time monitoring
            await this.startRealTimeMonitoring();
            
            console.log('✅ Market Microstructure Monitor initialized');
            this.emit('systemReady');
            
        } catch (error) {
            console.error('❌ Failed to initialize Market Microstructure Monitor:', error);
            this.emit('systemError', error);
        }
    }

    async initializeGapDetection() {
        console.log('🔍 Initializing gap detection for key symbols...');
        
        const symbols = MONITORED_SYMBOLS.concat(['SPY', 'QQQ', 'IWM', 'VIX']);
        
        for (const symbol of symbols) {
            try {
                // Get current and previous day data
                const currentData = await this.api.getQuote(symbol);
                const previousData = await this.api.getHistoricalData(symbol, 1);
                
                if (currentData && previousData && previousData.length > 0) {
                    const gap = this.detectGap(symbol, currentData, previousData[previousData.length - 1]);
                    
                    if (gap) {
                        this.activeGaps.set(symbol, gap);
                        console.log(`📈 Detected ${gap.type} gap for ${symbol}:`, gap);
                        
                        this.emit('gapDetected', {
                            symbol: symbol,
                            gap: gap,
                            timestamp: new Date()
                        });
                    }
                }
                
            } catch (error) {
                console.error(`Failed to initialize gap detection for ${symbol}:`, error);
            }
        }
    }

    detectGap(symbol, currentData, previousData) {
        const currentOpen = currentData.open;
        const previousClose = previousData.close;
        const previousHigh = previousData.high;
        const previousLow = previousData.low;
        
        // Calculate gap percentage
        const gapPercent = Math.abs(currentOpen - previousClose) / previousClose;
        
        // Minimum gap threshold (0.25% for most symbols, lower for VIX)
        const minGapThreshold = symbol === 'VIX' ? 0.02 : 0.0025;
        
        if (gapPercent < minGapThreshold) return null;
        
        // Determine gap type
        let gapType = 'UNKNOWN';
        if (currentOpen > previousHigh) {
            gapType = 'GAP_UP';
        } else if (currentOpen < previousLow) {
            gapType = 'GAP_DOWN';
        } else if (currentOpen > previousClose) {
            gapType = 'GAP_UP_PARTIAL';
        } else if (currentOpen < previousClose) {
            gapType = 'GAP_DOWN_PARTIAL';
        }
        
        const gap = {
            symbol: symbol,
            type: gapType,
            gapPercent: gapPercent,
            currentOpen: currentOpen,
            previousClose: previousClose,
            previousHigh: previousHigh,
            previousLow: previousLow,
            gapSize: Math.abs(currentOpen - previousClose),
            fillTarget: this.calculateGapFillTarget(gapType, currentOpen, previousClose, previousHigh, previousLow),
            fillProbability: this.estimateGapFillProbability(gapType, gapPercent, symbol),
            timestamp: new Date(),
            filled: false,
            fillTime: null,
            fillPercentage: 0
        };
        
        return gap;
    }

    calculateGapFillTarget(gapType, currentOpen, previousClose, previousHigh, previousLow) {
        switch (gapType) {
            case 'GAP_UP':
                return previousHigh; // Full fill would reach previous high
            case 'GAP_DOWN':
                return previousLow; // Full fill would reach previous low
            case 'GAP_UP_PARTIAL':
            case 'GAP_DOWN_PARTIAL':
                return previousClose; // Partial gaps fill to previous close
            default:
                return previousClose;
        }
    }

    estimateGapFillProbability(gapType, gapPercent, symbol) {
        // Tom King's gap fill statistics (based on his research)
        let baseProbability = 0.75; // 75% base probability
        
        // Adjust for gap size
        if (gapPercent > 0.02) { // > 2%
            baseProbability *= 0.8; // Large gaps less likely to fill same day
        } else if (gapPercent > 0.01) { // > 1%
            baseProbability *= 0.9;
        }
        
        // Adjust for symbol (SPY gaps fill more frequently)
        if (symbol === 'SPY' || symbol === 'QQQ') {
            baseProbability *= 1.1;
        }
        
        // Adjust for gap type
        switch (gapType) {
            case 'GAP_UP_PARTIAL':
            case 'GAP_DOWN_PARTIAL':
                baseProbability *= 1.2; // Partial gaps more likely to fill
                break;
            case 'GAP_UP':
            case 'GAP_DOWN':
                baseProbability *= 0.9; // Full gaps less likely to fill same day
                break;
        }
        
        return Math.min(0.95, Math.max(0.30, baseProbability));
    }

    async loadHistoricalMicrostructure() {
        console.log('📚 Loading historical microstructure data...');
        
        const symbols = ['SPY', 'QQQ', 'IWM'];
        
        for (const symbol of symbols) {
            try {
                // Load recent intraday data for level identification
                const intradayData = await this.api.getIntradayData(symbol, '1m', 5); // 5 days of 1-minute data
                
                if (intradayData && intradayData.length > 0) {
                    // Identify key levels
                    const levels = this.identifyKeyLevels(intradayData);
                    this.currentLevels.set(symbol, levels);
                    
                    // Build volume profile
                    const volumeProfile = this.buildVolumeProfile(intradayData);
                    this.volumeProfiles.set(symbol, volumeProfile);
                    
                    console.log(`📊 Loaded microstructure for ${symbol}:`, {
                        levels: levels.length,
                        volumeProfile: volumeProfile.totalVolume
                    });
                }
                
            } catch (error) {
                console.error(`Failed to load microstructure for ${symbol}:`, error);
            }
        }
    }

    identifyKeyLevels(intradayData) {
        const levels = [];
        const pricePoints = intradayData.map(bar => ({
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            timestamp: bar.timestamp
        }));
        
        // Identify support and resistance levels using pivot points
        const pivotHighs = this.findPivotPoints(pricePoints, 'high', 5);
        const pivotLows = this.findPivotPoints(pricePoints, 'low', 5);
        
        // Convert pivot points to levels
        for (const pivot of pivotHighs) {
            levels.push({
                price: pivot.price,
                type: 'RESISTANCE',
                strength: pivot.strength,
                touches: pivot.touches,
                lastTouch: pivot.lastTouch,
                confidence: this.calculateLevelConfidence(pivot, pricePoints)
            });
        }
        
        for (const pivot of pivotLows) {
            levels.push({
                price: pivot.price,
                type: 'SUPPORT',
                strength: pivot.strength,
                touches: pivot.touches,
                lastTouch: pivot.lastTouch,
                confidence: this.calculateLevelConfidence(pivot, pricePoints)
            });
        }
        
        // Add VWAP as a dynamic level
        const vwap = this.calculateVWAP(intradayData);
        if (vwap) {
            levels.push({
                price: vwap,
                type: 'VWAP',
                strength: 'MEDIUM',
                touches: 0,
                lastTouch: null,
                confidence: 0.8
            });
        }
        
        return levels.sort((a, b) => b.confidence - a.confidence);
    }

    findPivotPoints(pricePoints, field, lookback) {
        const pivots = [];
        
        for (let i = lookback; i < pricePoints.length - lookback; i++) {
            const currentPrice = pricePoints[i][field];
            let isPivot = true;
            
            // Check if current point is a pivot
            for (let j = i - lookback; j <= i + lookback; j++) {
                if (j === i) continue;
                
                if (field === 'high' && pricePoints[j][field] >= currentPrice) {
                    isPivot = false;
                    break;
                } else if (field === 'low' && pricePoints[j][field] <= currentPrice) {
                    isPivot = false;
                    break;
                }
            }
            
            if (isPivot) {
                // Count touches at this level
                const touches = this.countTouchesAtLevel(pricePoints, currentPrice, 0.001); // 0.1% tolerance
                
                pivots.push({
                    price: currentPrice,
                    index: i,
                    touches: touches.count,
                    lastTouch: touches.lastTouch,
                    strength: touches.count > 3 ? 'STRONG' : touches.count > 1 ? 'MEDIUM' : 'WEAK'
                });
            }
        }
        
        return pivots;
    }

    countTouchesAtLevel(pricePoints, level, tolerance) {
        let count = 0;
        let lastTouch = null;
        const upperBound = level * (1 + tolerance);
        const lowerBound = level * (1 - tolerance);
        
        for (const point of pricePoints) {
            if ((point.high >= lowerBound && point.high <= upperBound) ||
                (point.low >= lowerBound && point.low <= upperBound) ||
                (point.close >= lowerBound && point.close <= upperBound)) {
                count++;
                lastTouch = point.timestamp;
            }
        }
        
        return { count, lastTouch };
    }

    calculateLevelConfidence(pivot, pricePoints) {
        let confidence = 0.5; // Base confidence
        
        // Adjust for number of touches
        confidence += Math.min(0.3, pivot.touches * 0.05);
        
        // Adjust for recency
        if (pivot.lastTouch) {
            const hoursSinceTouch = (new Date() - pivot.lastTouch) / (1000 * 60 * 60);
            if (hoursSinceTouch < 24) {
                confidence += 0.2;
            } else if (hoursSinceTouch < 72) {
                confidence += 0.1;
            }
        }
        
        // Adjust for strength
        switch (pivot.strength) {
            case 'STRONG':
                confidence += 0.2;
                break;
            case 'MEDIUM':
                confidence += 0.1;
                break;
        }
        
        return Math.min(1.0, confidence);
    }

    buildVolumeProfile(intradayData) {
        const priceVolumeMap = new Map();
        let totalVolume = 0;
        let maxVolume = 0;
        let pocPrice = 0; // Point of Control (highest volume price)
        
        // Aggregate volume by price level (rounded to nearest cent)
        for (const bar of intradayData) {
            const price = Math.round(bar.close * 100) / 100;
            const volume = bar.volume || 0;
            
            if (!priceVolumeMap.has(price)) {
                priceVolumeMap.set(price, 0);
            }
            
            const newVolume = priceVolumeMap.get(price) + volume;
            priceVolumeMap.set(price, newVolume);
            totalVolume += volume;
            
            if (newVolume > maxVolume) {
                maxVolume = newVolume;
                pocPrice = price;
            }
        }
        
        // Convert to sorted array
        const volumeProfile = Array.from(priceVolumeMap.entries())
            .map(([price, volume]) => ({
                price: price,
                volume: volume,
                volumePercent: volume / totalVolume
            }))
            .sort((a, b) => b.volume - a.volume);
        
        // Calculate value area (70% of volume)
        const valueAreaVolume = totalVolume * 0.70;
        let currentVolume = 0;
        const valueAreaPrices = [];
        
        for (const level of volumeProfile) {
            valueAreaPrices.push(level.price);
            currentVolume += level.volume;
            if (currentVolume >= valueAreaVolume) break;
        }
        
        return {
            totalVolume: totalVolume,
            pointOfControl: pocPrice,
            maxVolume: maxVolume,
            valueAreaHigh: Math.max(...valueAreaPrices),
            valueAreaLow: Math.min(...valueAreaPrices),
            profile: volumeProfile.slice(0, 20) // Top 20 levels
        };
    }

    calculateVWAP(intradayData) {
        let totalVolume = 0;
        let totalVolumePrice = 0;
        
        for (const bar of intradayData) {
            const typicalPrice = (bar.high + bar.low + bar.close) / 3;
            const volume = bar.volume || 0;
            
            totalVolumePrice += typicalPrice * volume;
            totalVolume += volume;
        }
        
        return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
    }

    async startRealTimeMonitoring() {
        console.log('🔄 Starting real-time microstructure monitoring...');
        
        this.monitoringActive = true;
        
        // Start WebSocket streaming for tick data
        if (this.api.websocket) {
            const symbols = ['SPY', 'QQQ', 'IWM'];
            
            this.api.websocket.subscribeToTickData(symbols, (tickData) => {
                this.processTickData(tickData);
            });
        }
        
        // Start periodic analysis
        this.startPeriodicAnalysis();
    }

    startPeriodicAnalysis() {
        // Monitor gaps every minute during market hours
        setInterval(() => {
            if (this.isMarketHours()) {
                this.updateGapFillStatus();
            }
        }, 60 * 1000);
        
        // Update microstructure levels every 5 minutes
        setInterval(() => {
            if (this.isMarketHours()) {
                this.updateMicrostructureLevels();
            }
        }, 5 * 60 * 1000);
        
        // Comprehensive analysis every 15 minutes
        setInterval(() => {
            if (this.isMarketHours()) {
                this.runComprehensiveMicrostructureAnalysis();
            }
        }, 15 * 60 * 1000);
    }

    async processTickData(tickData) {
        try {
            const { symbol, price, volume, timestamp, bid, ask } = tickData;
            
            // Update last tick data
            this.lastTickData.set(symbol, {
                price: price,
                volume: volume,
                timestamp: new Date(timestamp),
                bid: bid,
                ask: ask,
                spread: ask - bid
            });
            
            // Check for gap fill progress
            await this.checkGapFillProgress(symbol, price);
            
            // Check for level interactions
            await this.checkLevelInteractions(symbol, price, volume);
            
            // Detect order flow anomalies
            await this.detectOrderFlowAnomalies(symbol, tickData);
            
        } catch (error) {
            console.error('Error processing tick data:', error);
        }
    }

    async checkGapFillProgress(symbol, currentPrice) {
        const gap = this.activeGaps.get(symbol);
        if (!gap || gap.filled) return;
        
        // Calculate fill percentage
        const fillPercentage = this.calculateGapFillPercentage(gap, currentPrice);
        
        if (fillPercentage !== gap.fillPercentage) {
            gap.fillPercentage = fillPercentage;
            
            // Check if gap is filled
            if (fillPercentage >= 100) {
                gap.filled = true;
                gap.fillTime = new Date();
                
                console.log(`✅ Gap filled for ${symbol}: ${gap.type} - ${fillPercentage.toFixed(1)}%`);
                
                this.emit('gapFilled', {
                    symbol: symbol,
                    gap: gap,
                    fillTime: gap.fillTime,
                    timestamp: new Date()
                });
                
                // Move to history
                if (!this.gapHistory.has(symbol)) {
                    this.gapHistory.set(symbol, []);
                }
                this.gapHistory.get(symbol).push(gap);
                this.activeGaps.delete(symbol);
                
            } else if (fillPercentage >= 50 && gap.fillPercentage < 50) {
                // Half-way fill milestone
                this.emit('gapHalfFilled', {
                    symbol: symbol,
                    gap: gap,
                    fillPercentage: fillPercentage,
                    timestamp: new Date()
                });
                
                console.log(`📊 Gap 50% filled for ${symbol}: ${fillPercentage.toFixed(1)}%`);
            }
        }
    }

    calculateGapFillPercentage(gap, currentPrice) {
        const { type, currentOpen, fillTarget } = gap;
        
        switch (type) {
            case 'GAP_UP':
            case 'GAP_UP_PARTIAL':
                if (currentPrice <= fillTarget) {
                    return 100;
                } else {
                    const totalGapSize = currentOpen - fillTarget;
                    const filledSize = currentOpen - currentPrice;
                    return Math.max(0, (filledSize / totalGapSize) * 100);
                }
                
            case 'GAP_DOWN':
            case 'GAP_DOWN_PARTIAL':
                if (currentPrice >= fillTarget) {
                    return 100;
                } else {
                    const totalGapSize = fillTarget - currentOpen;
                    const filledSize = currentPrice - currentOpen;
                    return Math.max(0, (filledSize / totalGapSize) * 100);
                }
                
            default:
                return 0;
        }
    }

    async checkLevelInteractions(symbol, price, volume) {
        const levels = this.currentLevels.get(symbol);
        if (!levels) return;
        
        for (const level of levels) {
            const distance = Math.abs(price - level.price) / level.price;
            
            // Within 0.1% of level
            if (distance <= 0.001) {
                const interaction = {
                    symbol: symbol,
                    level: level,
                    price: price,
                    volume: volume,
                    interaction: this.determineLevelInteraction(price, level, volume),
                    timestamp: new Date()
                };
                
                this.emit('levelInteraction', interaction);
                
                // Update level touch count
                level.touches++;
                level.lastTouch = new Date();
                
                console.log(`🎯 Level interaction for ${symbol}: ${interaction.interaction} at $${level.price}`);
            }
        }
    }

    determineLevelInteraction(price, level, volume) {
        // Simple interaction classification
        if (level.type === 'SUPPORT') {
            return price > level.price ? 'BOUNCE' : 'TEST';
        } else if (level.type === 'RESISTANCE') {
            return price < level.price ? 'REJECT' : 'BREAK';
        } else {
            return 'TOUCH';
        }
    }

    async detectOrderFlowAnomalies(symbol, tickData) {
        const { price, volume, bid, ask, timestamp } = tickData;
        
        // Store order flow data
        if (!this.orderFlowData.has(symbol)) {
            this.orderFlowData.set(symbol, []);
        }
        
        const orderFlow = this.orderFlowData.get(symbol);
        orderFlow.push({
            price: price,
            volume: volume,
            bid: bid,
            ask: ask,
            spread: ask - bid,
            timestamp: new Date(timestamp)
        });
        
        // Keep only recent data (last 100 ticks)
        if (orderFlow.length > 100) {
            orderFlow.shift();
        }
        
        // Detect anomalies
        const anomalies = this.analyzeOrderFlowAnomalies(symbol, orderFlow);
        
        for (const anomaly of anomalies) {
            this.emit('orderFlowAnomaly', {
                symbol: symbol,
                anomaly: anomaly,
                timestamp: new Date()
            });
        }
    }

    analyzeOrderFlowAnomalies(symbol, orderFlow) {
        const anomalies = [];
        
        if (orderFlow.length < 20) return anomalies;
        
        // Calculate recent averages
        const recent = orderFlow.slice(-20);
        const avgVolume = recent.reduce((sum, tick) => sum + tick.volume, 0) / recent.length;
        const avgSpread = recent.reduce((sum, tick) => sum + tick.spread, 0) / recent.length;
        
        const latest = recent[recent.length - 1];
        
        // Volume spike detection
        if (latest.volume > avgVolume * 3) {
            anomalies.push({
                type: 'VOLUME_SPIKE',
                severity: 'MEDIUM',
                currentVolume: latest.volume,
                averageVolume: avgVolume,
                description: `Volume spike: ${latest.volume} vs avg ${avgVolume.toFixed(0)}`
            });
        }
        
        // Spread widening detection
        if (latest.spread > avgSpread * 2) {
            anomalies.push({
                type: 'SPREAD_WIDENING',
                severity: 'LOW',
                currentSpread: latest.spread,
                averageSpread: avgSpread,
                description: `Spread widening: $${latest.spread.toFixed(3)} vs avg $${avgSpread.toFixed(3)}`
            });
        }
        
        return anomalies;
    }

    async updateGapFillStatus() {
        for (const [symbol, gap] of this.activeGaps) {
            try {
                const currentQuote = await this.api.getQuote(symbol);
                if (currentQuote) {
                    await this.checkGapFillProgress(symbol, currentQuote.last);
                }
            } catch (error) {
                console.error(`Error updating gap status for ${symbol}:`, error);
            }
        }
    }

    async updateMicrostructureLevels() {
        const symbols = ['SPY', 'QQQ', 'IWM'];
        
        for (const symbol of symbols) {
            try {
                // Get recent intraday data
                const recentData = await this.api.getIntradayData(symbol, '1m', 1);
                
                if (recentData && recentData.length > 0) {
                    // Update levels
                    const updatedLevels = this.identifyKeyLevels(recentData);
                    this.currentLevels.set(symbol, updatedLevels);
                    
                    // Update volume profile
                    const updatedProfile = this.buildVolumeProfile(recentData);
                    this.volumeProfiles.set(symbol, updatedProfile);
                }
                
            } catch (error) {
                console.error(`Error updating microstructure for ${symbol}:`, error);
            }
        }
    }

    async runComprehensiveMicrostructureAnalysis() {
        console.log('🔄 Running comprehensive microstructure analysis...');
        
        try {
            const analysis = {
                timestamp: new Date(),
                gapAnalysis: this.analyzeCurrentGaps(),
                levelAnalysis: this.analyzeLevelStrength(),
                volumeAnalysis: this.analyzeVolumeProfile(),
                orderFlowAnalysis: this.analyzeOrderFlow(),
                marketMicrostructureHealth: this.assessMarketMicrostructureHealth()
            };
            
            this.emit('comprehensiveAnalysisComplete', analysis);
            
        } catch (error) {
            console.error('Error in comprehensive microstructure analysis:', error);
        }
    }

    analyzeCurrentGaps() {
        const gapAnalysis = {
            totalActiveGaps: this.activeGaps.size,
            gapsByType: {},
            avgFillProgress: 0,
            nearlyFilledGaps: []
        };
        
        let totalFillProgress = 0;
        
        for (const [symbol, gap] of this.activeGaps) {
            // Count by type
            if (!gapAnalysis.gapsByType[gap.type]) {
                gapAnalysis.gapsByType[gap.type] = 0;
            }
            gapAnalysis.gapsByType[gap.type]++;
            
            // Track fill progress
            totalFillProgress += gap.fillPercentage;
            
            // Nearly filled gaps (>80%)
            if (gap.fillPercentage > 80) {
                gapAnalysis.nearlyFilledGaps.push({
                    symbol: symbol,
                    type: gap.type,
                    fillPercentage: gap.fillPercentage
                });
            }
        }
        
        gapAnalysis.avgFillProgress = this.activeGaps.size > 0 ? 
            totalFillProgress / this.activeGaps.size : 0;
        
        return gapAnalysis;
    }

    analyzeLevelStrength() {
        const levelAnalysis = {
            strongLevels: [],
            weakLevels: [],
            recentBreaks: [],
            avgLevelConfidence: 0
        };
        
        let totalConfidence = 0;
        let levelCount = 0;
        
        for (const [symbol, levels] of this.currentLevels) {
            for (const level of levels) {
                totalConfidence += level.confidence;
                levelCount++;
                
                if (level.confidence > 0.8) {
                    levelAnalysis.strongLevels.push({
                        symbol: symbol,
                        price: level.price,
                        type: level.type,
                        confidence: level.confidence
                    });
                } else if (level.confidence < 0.4) {
                    levelAnalysis.weakLevels.push({
                        symbol: symbol,
                        price: level.price,
                        type: level.type,
                        confidence: level.confidence
                    });
                }
            }
        }
        
        levelAnalysis.avgLevelConfidence = levelCount > 0 ? 
            totalConfidence / levelCount : 0;
        
        return levelAnalysis;
    }

    analyzeVolumeProfile() {
        const volumeAnalysis = {
            strongPOCs: [], // Point of Control levels
            valueAreaBreaks: [],
            volumeConcentration: {}
        };
        
        for (const [symbol, profile] of this.volumeProfiles) {
            // Strong POC identification
            const topLevel = profile.profile[0];
            if (topLevel && topLevel.volumePercent > 0.15) { // >15% of volume
                volumeAnalysis.strongPOCs.push({
                    symbol: symbol,
                    price: topLevel.price,
                    volumePercent: topLevel.volumePercent
                });
            }
            
            // Volume concentration
            volumeAnalysis.volumeConcentration[symbol] = {
                poc: profile.pointOfControl,
                valueAreaHigh: profile.valueAreaHigh,
                valueAreaLow: profile.valueAreaLow,
                totalVolume: profile.totalVolume
            };
        }
        
        return volumeAnalysis;
    }

    analyzeOrderFlow() {
        const orderFlowAnalysis = {
            anomaliesDetected: this.microstructureAlerts.length,
            recentAnomalies: this.microstructureAlerts.slice(-10),
            orderFlowHealth: 'NORMAL'
        };
        
        // Assess overall order flow health
        const recentAnomalies = this.microstructureAlerts.filter(
            alert => (new Date() - alert.timestamp) < 60 * 60 * 1000 // Last hour
        );
        
        if (recentAnomalies.length > 10) {
            orderFlowAnalysis.orderFlowHealth = 'STRESSED';
        } else if (recentAnomalies.length > 5) {
            orderFlowAnalysis.orderFlowHealth = 'ELEVATED';
        }
        
        return orderFlowAnalysis;
    }

    assessMarketMicrostructureHealth() {
        const health = {
            overallScore: 0,
            factors: [],
            recommendation: 'NORMAL_OPERATIONS'
        };
        
        let score = 100; // Start with perfect score
        
        // Factor 1: Gap fill progress
        const avgGapFill = this.analyzeCurrentGaps().avgFillProgress;
        if (avgGapFill < 30) {
            score -= 10;
            health.factors.push('Low gap fill progress suggests weak follow-through');
        }
        
        // Factor 2: Level strength
        const avgConfidence = this.analyzeLevelStrength().avgLevelConfidence;
        if (avgConfidence < 0.6) {
            score -= 15;
            health.factors.push('Weak technical levels reduce trading conviction');
        }
        
        // Factor 3: Order flow anomalies
        const recentAnomalies = this.microstructureAlerts.filter(
            alert => (new Date() - alert.timestamp) < 30 * 60 * 1000 // Last 30 min
        );
        if (recentAnomalies.length > 5) {
            score -= 20;
            health.factors.push('Elevated order flow anomalies suggest market stress');
        }
        
        health.overallScore = Math.max(0, score);
        
        // Generate recommendation
        if (score < 60) {
            health.recommendation = 'REDUCE_POSITION_SIZE';
        } else if (score < 80) {
            health.recommendation = 'INCREASED_CAUTION';
        }
        
        return health;
    }

    isMarketHours() {
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeInMinutes = hour * 60 + minute;
        
        // Monday to Friday
        if (day === 0 || day === 6) return false;
        
        // 9:30 AM to 4:00 PM Eastern
        const marketOpen = 9 * 60 + 30;
        const marketClose = 16 * 60;
        
        return timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
    }

    // Public API methods
    async getActiveGaps() {
        return Array.from(this.activeGaps.entries()).map(([symbol, gap]) => ({
            symbol: symbol,
            ...gap
        }));
    }

    async getGapHistory(symbol, days = 7) {
        const history = this.gapHistory.get(symbol) || [];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        return history.filter(gap => gap.timestamp > cutoffDate);
    }

    async getCurrentLevels(symbol) {
        return this.currentLevels.get(symbol) || [];
    }

    async getVolumeProfile(symbol) {
        return this.volumeProfiles.get(symbol) || null;
    }

    async getOrderFlowData(symbol) {
        return this.orderFlowData.get(symbol) || [];
    }

    getSystemStatus() {
        return {
            monitoringActive: this.monitoringActive,
            activeGaps: this.activeGaps.size,
            monitoredSymbols: Array.from(this.currentLevels.keys()),
            lastUpdate: new Date(),
            microstructureHealth: this.assessMarketMicrostructureHealth().overallScore
        };
    }
}

// Configuration constants
const MONITORED_SYMBOLS = [
    'SPY', 'QQQ', 'IWM', 'DIA',
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA',
    'XLK', 'XLF', 'XLE', 'XLV', 'XLI'
];

const GAP_FILL_PATTERNS = {
    SAME_DAY_FILL: {
        probability: 0.75,
        timeframe: 'INTRADAY',
        characteristics: ['Small gap size', 'High volume', 'Market trend alignment']
    },
    PARTIAL_FILL: {
        probability: 0.85,
        timeframe: 'INTRADAY',
        characteristics: ['Any gap size', 'Normal volume', 'Retracement expected']
    },
    MULTI_DAY_FILL: {
        probability: 0.90,
        timeframe: '2-5_DAYS',
        characteristics: ['Large gap size', 'Strong directional move', 'Eventually filled']
    }
};

module.exports = MarketMicrostructureMonitor;