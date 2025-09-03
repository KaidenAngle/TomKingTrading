/**
 * SECTOR ROTATION TRACKER
 * Enhanced sector correlation tracking with rotation detection
 * Based on Tom King methodology for sector leadership and correlation risk management
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class SectorRotationTracker {
    constructor(api = null) {
        this.api = api;
        
        // SPDR Sector ETFs for comprehensive tracking
        this.sectorETFs = {
            'XLF': { name: 'Financials', sector: 'FINANCIALS', weight: 0.13 },
            'XLK': { name: 'Technology', sector: 'TECHNOLOGY', weight: 0.28 },
            'XLE': { name: 'Energy', sector: 'ENERGY', weight: 0.04 },
            'XLV': { name: 'Healthcare', sector: 'HEALTHCARE', weight: 0.13 },
            'XLI': { name: 'Industrials', sector: 'INDUSTRIALS', weight: 0.08 },
            'XLY': { name: 'Consumer Discretionary', sector: 'CONSUMER_DISC', weight: 0.11 },
            'XLP': { name: 'Consumer Staples', sector: 'CONSUMER_STAPLES', weight: 0.07 },
            'XLU': { name: 'Utilities', sector: 'UTILITIES', weight: 0.03 },
            'XLB': { name: 'Materials', sector: 'MATERIALS', weight: 0.03 },
            'XLRE': { name: 'Real Estate', sector: 'REAL_ESTATE', weight: 0.02 },
            'XLC': { name: 'Communications', sector: 'COMMUNICATIONS', weight: 0.08 }
        };
        
        // Enhanced correlation groups with sector mapping
        this.sectorGroups = {
            EQUITY_INDICES: {
                tickers: ['ES', 'MES', 'SPY', 'QQQ', 'IWM', 'SPX', 'SPXW', 'NQ', 'MNQ', 'RTY'],
                correlationBeta: 0.95, // High correlation to market
                maxPositions: 3
            },
            TECHNOLOGY: {
                tickers: ['XLK', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'],
                correlationBeta: 0.85,
                maxPositions: 2
            },
            FINANCIALS: {
                tickers: ['XLF', 'JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'],
                correlationBeta: 0.80,
                maxPositions: 2
            },
            ENERGY: {
                tickers: ['XLE', 'XOP', 'CL', 'MCL', 'CVX', 'XOM', 'SLB', 'OIH'],
                correlationBeta: 0.70,
                maxPositions: 2
            },
            HEALTHCARE: {
                tickers: ['XLV', 'JNJ', 'PFE', 'UNH', 'ABBV', 'BMY'],
                correlationBeta: 0.65,
                maxPositions: 2
            },
            INDUSTRIALS: {
                tickers: ['XLI', 'BA', 'CAT', 'GE', 'MMM', 'HON'],
                correlationBeta: 0.75,
                maxPositions: 2
            },
            CONSUMER_DISCRETIONARY: {
                tickers: ['XLY', 'AMZN', 'TSLA', 'HD', 'MCD', 'NKE'],
                correlationBeta: 0.78,
                maxPositions: 2
            },
            CONSUMER_STAPLES: {
                tickers: ['XLP', 'PG', 'KO', 'PEP', 'WMT', 'COST'],
                correlationBeta: 0.60,
                maxPositions: 2
            },
            UTILITIES: {
                tickers: ['XLU', 'NEE', 'D', 'SO', 'DUK', 'AEP'],
                correlationBeta: 0.45,
                maxPositions: 1
            },
            MATERIALS: {
                tickers: ['XLB', 'FCX', 'NEM', 'DOW', 'LYB'],
                correlationBeta: 0.70,
                maxPositions: 1
            },
            REAL_ESTATE: {
                tickers: ['XLRE', 'REITs'],
                correlationBeta: 0.55,
                maxPositions: 1
            },
            COMMUNICATIONS: {
                tickers: ['XLC', 'META', 'GOOGL', 'NFLX', 'DIS'],
                correlationBeta: 0.72,
                maxPositions: 2
            },
            PRECIOUS_METALS: {
                tickers: ['GC', 'MGC', 'SI', 'GLD', 'SLV'],
                correlationBeta: 0.85,
                maxPositions: 2
            },
            FIXED_INCOME: {
                tickers: ['ZB', 'ZN', 'ZF', 'ZT', 'TLT', 'IEF', 'SHY'],
                correlationBeta: 0.75,
                maxPositions: 2
            },
            CURRENCIES: {
                tickers: ['6E', '6B', '6A', '6C', '6J', '6S', 'M6E', 'DXY'],
                correlationBeta: 0.60,
                maxPositions: 2
            }
        };
        
        // Historical sector performance tracking
        this.sectorHistory = new Map();
        this.rotationHistory = [];
        this.maxHistoryLength = 252; // 1 year of trading days
        
        // Rotation detection thresholds
        this.thresholds = {
            strongRotation: 2.0,    // 2% outperformance = strong rotation
            moderateRotation: 1.0,  // 1% outperformance = moderate rotation
            significantVolume: 1.5, // 50% above average volume
            correlationBreakdown: 0.3 // Correlation drops below 30%
        };
        
        logger.info('SECTOR', 'Sector Rotation Tracker initialized with enhanced correlation mapping');
    }

    /**
     * Get current sector performance data from TastyTrade API
     */
    async getSectorPerformanceData() {
        try {
            const sectorData = {};
            const sectorTickers = Object.keys(this.sectorETFs);
            
            if (this.api && this.api.getQuotes) {
                // Fetch real-time sector ETF data
                const quotes = await this.api.getQuotes(sectorTickers);
                
                for (const ticker of sectorTickers) {
                    if (quotes && quotes[ticker]) {
                        const quote = quotes[ticker];
                        sectorData[ticker] = {
                            ...this.sectorETFs[ticker],
                            ticker: ticker,
                            currentPrice: parseFloat(quote.last || quote.mark || 0),
                            dayChange: parseFloat(quote['net-change'] || 0),
                            dayChangePercent: parseFloat(quote['net-change-percent'] || 0),
                            volume: parseInt(quote.volume || 0),
                            bid: parseFloat(quote.bid || 0),
                            ask: parseFloat(quote.ask || 0),
                            timestamp: new Date().toISOString(),
                            source: 'TastyTrade_API'
                        };
                    }
                }
            }
            
            // Fallback to default data if API unavailable
            if (Object.keys(sectorData).length === 0) {
                logger.warn('SECTOR', 'Using default sector data - API unavailable');
                for (const [ticker, info] of Object.entries(this.sectorETFs)) {
                    sectorData[ticker] = {
                        ...info,
                        ticker: ticker,
                        currentPrice: 100,
                        dayChange: 0,
                        dayChangePercent: 0,
                        volume: 0,
                        timestamp: new Date().toISOString(),
                        source: 'Default'
                    };
                }
            }
            
            // Calculate relative performance vs SPY
            const spyData = await this.getSPYBenchmark();
            for (const [ticker, data] of Object.entries(sectorData)) {
                data.relativePerformance = data.dayChangePercent - (spyData?.dayChangePercent || 0);
                data.outperforming = data.relativePerformance > 0;
            }
            
            logger.debug('SECTOR', `Sector performance data collected for ${Object.keys(sectorData).length} sectors`);
            
            return sectorData;
            
        } catch (error) {
            logger.error('SECTOR', 'Failed to get sector performance data', error);
            throw error;
        }
    }

    /**
     * Get SPY as benchmark for relative performance calculation
     */
    async getSPYBenchmark() {
        try {
            if (this.api && this.api.getQuotes) {
                const quotes = await this.api.getQuotes(['SPY']);
                if (quotes && quotes.SPY) {
                    return {
                        currentPrice: parseFloat(quotes.SPY.last || quotes.SPY.mark || 0),
                        dayChange: parseFloat(quotes.SPY['net-change'] || 0),
                        dayChangePercent: parseFloat(quotes.SPY['net-change-percent'] || 0),
                        volume: parseInt(quotes.SPY.volume || 0)
                    };
                }
            }
            
            // Fallback
            return {
                currentPrice: 450,
                dayChange: 0,
                dayChangePercent: 0,
                volume: 50000000
            };
            
        } catch (error) {
            logger.warn('SECTOR', 'Failed to get SPY benchmark data', error);
            return { dayChangePercent: 0 };
        }
    }

    /**
     * Analyze sector rotation patterns and identify leadership changes
     */
    async analyzeSectorRotation() {
        try {
            const sectorData = await this.getSectorPerformanceData();
            
            // Sort sectors by relative performance
            const sectorsByPerformance = Object.values(sectorData)
                .sort((a, b) => b.relativePerformance - a.relativePerformance);
            
            const analysis = {
                timestamp: new Date().toISOString(),
                
                // Performance ranking
                leaders: sectorsByPerformance.slice(0, 3),
                laggards: sectorsByPerformance.slice(-3),
                
                // Rotation signals
                rotationType: this.classifyRotationType(sectorsByPerformance),
                rotationStrength: this.calculateRotationStrength(sectorsByPerformance),
                
                // Correlation breakdown detection
                correlationBreakdown: this.detectCorrelationBreakdown(sectorData),
                
                // Risk assessment
                riskAssessment: this.assessSectorRisk(sectorsByPerformance),
                
                // Trading implications
                tradingImplications: this.generateTradingImplications(sectorsByPerformance),
                
                rawData: sectorData
            };
            
            // Store in history
            this.addToRotationHistory(analysis);
            
            logger.info('SECTOR', 'Sector rotation analysis completed', {
                rotationType: analysis.rotationType,
                strength: analysis.rotationStrength.level,
                leaders: analysis.leaders.map(s => s.sector).join(', '),
                laggards: analysis.laggards.map(s => s.sector).join(', ')
            });
            
            return analysis;
            
        } catch (error) {
            logger.error('SECTOR', 'Sector rotation analysis failed', error);
            throw error;
        }
    }

    /**
     * Classify the type of rotation occurring
     */
    classifyRotationType(sectorsByPerformance) {
        const leaders = sectorsByPerformance.slice(0, 3);
        const topSectors = leaders.map(s => s.sector);
        
        // Risk-on patterns
        if (topSectors.includes('TECHNOLOGY') && topSectors.includes('CONSUMER_DISC')) {
            return 'RISK_ON_GROWTH';
        }
        
        if (topSectors.includes('FINANCIALS') && topSectors.includes('INDUSTRIALS')) {
            return 'RISK_ON_VALUE';
        }
        
        if (topSectors.includes('ENERGY') && topSectors.includes('MATERIALS')) {
            return 'COMMODITY_ROTATION';
        }
        
        // Risk-off patterns
        if (topSectors.includes('UTILITIES') && topSectors.includes('CONSUMER_STAPLES')) {
            return 'RISK_OFF_DEFENSIVE';
        }
        
        // Mixed or no clear pattern
        return 'MIXED_ROTATION';
    }

    /**
     * Calculate the strength of the rotation
     */
    calculateRotationStrength(sectorsByPerformance) {
        const leader = sectorsByPerformance[0];
        const laggard = sectorsByPerformance[sectorsByPerformance.length - 1];
        
        const spread = leader.relativePerformance - laggard.relativePerformance;
        
        let level = 'WEAK';
        if (spread > this.thresholds.strongRotation) {
            level = 'STRONG';
        } else if (spread > this.thresholds.moderateRotation) {
            level = 'MODERATE';
        }
        
        return {
            level: level,
            spread: parseFloat(spread.toFixed(2)),
            leaderPerformance: parseFloat(leader.relativePerformance.toFixed(2)),
            laggardPerformance: parseFloat(laggard.relativePerformance.toFixed(2))
        };
    }

    /**
     * Detect correlation breakdown events
     */
    detectCorrelationBreakdown(sectorData) {
        const breakdowns = [];
        
        // Check for unusual sector divergences
        for (const [ticker, data] of Object.entries(sectorData)) {
            if (Math.abs(data.relativePerformance) > this.thresholds.strongRotation) {
                breakdowns.push({
                    sector: data.sector,
                    ticker: ticker,
                    divergence: data.relativePerformance,
                    type: data.relativePerformance > 0 ? 'BREAKOUT_UP' : 'BREAKDOWN_DOWN',
                    severity: Math.abs(data.relativePerformance) > this.thresholds.strongRotation * 2 ? 'EXTREME' : 'MODERATE'
                });
            }
        }
        
        return {
            detected: breakdowns.length > 0,
            count: breakdowns.length,
            events: breakdowns
        };
    }

    /**
     * Assess overall sector risk for correlation management
     */
    assessSectorRisk(sectorsByPerformance) {
        const riskFactors = [];
        let overallRisk = 'LOW';
        
        // Check for extreme rotations
        const spread = sectorsByPerformance[0].relativePerformance - 
                      sectorsByPerformance[sectorsByPerformance.length - 1].relativePerformance;
        
        if (spread > this.thresholds.strongRotation * 2) {
            riskFactors.push('EXTREME_SECTOR_DIVERGENCE');
            overallRisk = 'HIGH';
        }
        
        // Check for risk-off rotation
        const defensiveLeaders = sectorsByPerformance.slice(0, 3)
            .filter(s => ['UTILITIES', 'CONSUMER_STAPLES', 'HEALTHCARE'].includes(s.sector));
        
        if (defensiveLeaders.length >= 2) {
            riskFactors.push('DEFENSIVE_ROTATION_DETECTED');
            overallRisk = overallRisk === 'HIGH' ? 'HIGH' : 'MODERATE';
        }
        
        // Check for correlation concentration risk
        const topPerformer = sectorsByPerformance[0];
        if (topPerformer.relativePerformance > this.thresholds.strongRotation * 1.5) {
            riskFactors.push('SINGLE_SECTOR_DOMINANCE');
        }
        
        return {
            level: overallRisk,
            factors: riskFactors,
            recommendation: this.getRiskRecommendation(overallRisk, riskFactors)
        };
    }

    /**
     * Generate trading implications based on rotation analysis
     */
    generateTradingImplications(sectorsByPerformance) {
        const implications = [];
        const leaders = sectorsByPerformance.slice(0, 3);
        const laggards = sectorsByPerformance.slice(-3);
        
        // Leadership implications
        leaders.forEach(sector => {
            if (sector.relativePerformance > this.thresholds.moderateRotation) {
                implications.push({
                    type: 'SECTOR_LEADERSHIP',
                    sector: sector.sector,
                    ticker: sector.ticker,
                    action: 'FAVOR_EXPOSURE',
                    reason: `Leading with ${sector.relativePerformance.toFixed(2)}% outperformance`,
                    impact: 'POSITIVE'
                });
            }
        });
        
        // Laggard implications
        laggards.forEach(sector => {
            if (sector.relativePerformance < -this.thresholds.moderateRotation) {
                implications.push({
                    type: 'SECTOR_WEAKNESS',
                    sector: sector.sector,
                    ticker: sector.ticker,
                    action: 'REDUCE_EXPOSURE',
                    reason: `Lagging with ${sector.relativePerformance.toFixed(2)}% underperformance`,
                    impact: 'NEGATIVE'
                });
            }
        });
        
        // Rotation-specific implications
        const rotationType = this.classifyRotationType(sectorsByPerformance);
        if (rotationType === 'RISK_OFF_DEFENSIVE') {
            implications.push({
                type: 'MARKET_REGIME',
                action: 'REDUCE_RISK',
                reason: 'Defensive sector rotation detected - risk-off environment',
                impact: 'CAUTION'
            });
        } else if (rotationType === 'RISK_ON_GROWTH') {
            implications.push({
                type: 'MARKET_REGIME',
                action: 'INCREASE_RISK',
                reason: 'Growth sector rotation detected - risk-on environment',
                impact: 'OPPORTUNITY'
            });
        }
        
        return implications;
    }

    /**
     * Get risk management recommendation
     */
    getRiskRecommendation(riskLevel, riskFactors) {
        switch (riskLevel) {
            case 'HIGH':
                return {
                    action: 'REDUCE_ALL_POSITIONS',
                    bpAdjustment: -25,
                    message: 'High sector risk - reduce buying power by 25%'
                };
            case 'MODERATE':
                return {
                    action: 'REDUCE_SECTOR_CONCENTRATION',
                    bpAdjustment: -10,
                    message: 'Moderate sector risk - reduce concentration'
                };
            default:
                return {
                    action: 'NORMAL_OPERATIONS',
                    bpAdjustment: 0,
                    message: 'Normal sector conditions'
                };
        }
    }

    /**
     * Enhanced position correlation checking with sector awareness
     */
    checkEnhancedCorrelationLimits(positions) {
        const violations = [];
        const sectorCounts = new Map();
        const correlationMatrix = new Map();
        
        // Map positions to sectors and count
        positions.forEach(position => {
            const sector = this.getSectorForTicker(position.ticker);
            const currentCount = sectorCounts.get(sector) || 0;
            sectorCounts.set(sector, currentCount + 1);
            
            // Check sector-specific limits
            const sectorInfo = this.sectorGroups[sector];
            if (sectorInfo && currentCount >= sectorInfo.maxPositions) {
                violations.push({
                    type: 'SECTOR_CONCENTRATION',
                    sector: sector,
                    count: currentCount + 1,
                    limit: sectorInfo.maxPositions,
                    positions: positions.filter(p => this.getSectorForTicker(p.ticker) === sector),
                    correlationBeta: sectorInfo.correlationBeta,
                    severity: currentCount > sectorInfo.maxPositions ? 'CRITICAL' : 'WARNING'
                });
            }
        });
        
        return {
            violations: violations,
            sectorBreakdown: Object.fromEntries(sectorCounts),
            overallRisk: violations.length > 0 ? 'HIGH' : 'LOW'
        };
    }

    /**
     * Determine sector for a given ticker
     */
    getSectorForTicker(ticker) {
        const upperTicker = ticker.toUpperCase();
        
        for (const [sectorName, sectorInfo] of Object.entries(this.sectorGroups)) {
            if (sectorInfo.tickers.includes(upperTicker)) {
                return sectorName;
            }
        }
        
        // Default assignment based on ticker patterns
        if (upperTicker.includes('ES') || upperTicker.includes('SPY') || upperTicker.includes('SPX')) {
            return 'EQUITY_INDICES';
        }
        
        return 'UNCATEGORIZED';
    }

    /**
     * Add rotation analysis to history
     */
    addToRotationHistory(analysis) {
        this.rotationHistory.push({
            timestamp: analysis.timestamp,
            rotationType: analysis.rotationType,
            rotationStrength: analysis.rotationStrength.level,
            leaders: analysis.leaders.map(s => s.sector),
            laggards: analysis.laggards.map(s => s.sector),
            riskLevel: analysis.riskAssessment.level
        });
        
        // Keep only recent history
        if (this.rotationHistory.length > this.maxHistoryLength) {
            this.rotationHistory.shift();
        }
    }

    /**
     * Get rotation trends over time
     */
    getRotationTrends(lookbackDays = 20) {
        if (this.rotationHistory.length < 2) {
            return { trend: 'INSUFFICIENT_DATA', stability: 0 };
        }
        
        const recentData = this.rotationHistory.slice(-lookbackDays);
        
        // Analyze rotation consistency
        const rotationTypes = recentData.map(d => d.rotationType);
        const uniqueTypes = [...new Set(rotationTypes)];
        const stability = 1 - (uniqueTypes.length - 1) / rotationTypes.length;
        
        // Analyze risk trend
        const riskLevels = recentData.map(d => d.riskLevel);
        const highRiskCount = riskLevels.filter(r => r === 'HIGH').length;
        const riskTrend = highRiskCount / riskLevels.length;
        
        return {
            stability: parseFloat(stability.toFixed(3)),
            dominantRotation: this.getMostFrequent(rotationTypes),
            riskTrend: riskTrend > 0.3 ? 'INCREASING' : riskTrend < 0.1 ? 'DECREASING' : 'STABLE',
            dataPoints: recentData.length
        };
    }

    /**
     * Get most frequent element in array
     */
    getMostFrequent(arr) {
        const freq = {};
        let maxCount = 0;
        let result = arr[0];
        
        for (const item of arr) {
            freq[item] = (freq[item] || 0) + 1;
            if (freq[item] > maxCount) {
                maxCount = freq[item];
                result = item;
            }
        }
        
        return result;
    }

    /**
     * Get complete sector analysis for trading decisions
     */
    async getCompleteSectorAnalysis() {
        try {
            const rotationAnalysis = await this.analyzeSectorRotation();
            const trends = this.getRotationTrends();
            
            return {
                current: rotationAnalysis,
                trends: trends,
                timestamp: new Date().toISOString(),
                recommendation: this.generateSectorTradeRecommendation(rotationAnalysis, trends)
            };
            
        } catch (error) {
            logger.error('SECTOR', 'Complete sector analysis failed', error);
            throw error;
        }
    }

    /**
     * Generate sector-based trading recommendation
     */
    generateSectorTradeRecommendation(analysis, trends) {
        let recommendation = 'NORMAL_OPERATIONS';
        let confidence = 50;
        let bpAdjustment = 0;
        
        // Risk-based adjustments
        if (analysis.riskAssessment.level === 'HIGH') {
            recommendation = 'REDUCE_SECTOR_RISK';
            confidence = 85;
            bpAdjustment = -25;
        } else if (analysis.rotationType === 'RISK_OFF_DEFENSIVE') {
            recommendation = 'DEFENSIVE_POSITIONING';
            confidence = 75;
            bpAdjustment = -15;
        } else if (analysis.rotationType === 'RISK_ON_GROWTH' && analysis.rotationStrength.level === 'STRONG') {
            recommendation = 'FAVOR_GROWTH_SECTORS';
            confidence = 80;
            bpAdjustment = 5;
        }
        
        return {
            action: recommendation,
            confidence: confidence,
            bpAdjustment: bpAdjustment,
            favoredSectors: analysis.leaders.map(s => s.sector),
            avoidSectors: analysis.laggards.map(s => s.sector),
            reasoning: this.explainSectorReasoning(analysis, trends)
        };
    }

    /**
     * Explain sector recommendation reasoning
     */
    explainSectorReasoning(analysis, trends) {
        const reasons = [];
        
        if (analysis.rotationType !== 'MIXED_ROTATION') {
            reasons.push(`${analysis.rotationType} rotation detected`);
        }
        
        if (analysis.rotationStrength.level === 'STRONG') {
            reasons.push(`Strong rotation with ${analysis.rotationStrength.spread}% spread`);
        }
        
        if (analysis.riskAssessment.level === 'HIGH') {
            reasons.push('High sector risk environment');
        }
        
        if (analysis.correlationBreakdown.detected) {
            reasons.push(`${analysis.correlationBreakdown.count} correlation breakdowns detected`);
        }
        
        return reasons.join('; ');
    }
}

module.exports = { SectorRotationTracker };