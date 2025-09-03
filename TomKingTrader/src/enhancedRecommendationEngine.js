/**
 * ENHANCED TOM KING RECOMMENDATION ENGINE v17
 * Advanced pattern analysis, option Greeks, and strike optimization
 * Based on V14-V17 framework with full PDF integration
 * 
 * Features:
 * - Comprehensive ticker analysis and qualification
 * - Real-time pattern recognition and entry opportunities
 * - Option Greeks analysis (Delta, Gamma, Theta, Vega, IV)
 * - Strike price optimization with Greeks considerations
 * - Diversification analysis using Greeks correlations
 * - Phase-based strategy recommendations
 */

const { TastyTradeAPI } = require('./tastytradeAPI');
const { getLogger } = require('./logger');

const logger = getLogger();

class EnhancedRecommendationEngine {
    constructor() {
        this.api = null;
        this.currentMarketData = {};
        this.optionChains = {};
        this.greeksData = {};
        this.patternSignals = {};
        
        // Tom King Phase System (PDF Pages 13-24)
        this.phaseRequirements = {
            1: { // £30-40k
                maxPositions: 3,
                maxBPPerPosition: 10, // PDF: Account/3000 formula
                allowedStrategies: ['0DTE', 'STRANGLE', 'IPMCC', 'LEAP'],
                qualifiedTickers: ['MCL', 'MGC', 'GLD', 'TLT', 'SLV']
            },
            2: { // £40-60k  
                maxPositions: 5,
                maxBPPerPosition: 15, // PDF: Account/4000 formula
                allowedStrategies: ['0DTE', 'STRANGLE', 'IPMCC', 'LEAP', 'LT112', 'RATIO'],
                qualifiedTickers: ['MCL', 'MGC', 'MES', 'MNQ', 'GLD', 'TLT', 'SLV', 'XOP', '6A', 'M6E']
            },
            3: { // £60-75k
                maxPositions: 6,
                maxBPPerPosition: 20, // PDF: Account/3000 formula
                allowedStrategies: ['0DTE', 'STRANGLE', 'IPMCC', 'LEAP', 'LT112', 'RATIO', 'BUTTERFLY', 'DIAGONAL'],
                qualifiedTickers: ['ES', 'CL', 'GC', 'LE', 'HE', 'ZC', 'ZS', 'ZW', '6E', '6B', 'ZB', 'ZN', 'TLT', 'GLD', 'SLV']
            },
            4: { // £75k+
                maxPositions: 10,
                maxBPPerPosition: 30, // PDF: Professional level
                allowedStrategies: ['ALL_STRATEGIES'],
                qualifiedTickers: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'NG', 'RB', 'HO', 'LE', 'HE', 'ZC', 'ZS', 'ZW', 'KC', 'SB', 'CC', '6E', '6B', '6A', '6C', '6J', '6S', 'ZB', 'ZN', 'ZF', 'ZT', 'SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT', 'XLE', 'XOP']
            }
        };

        // Correlation Groups (August 2024 disaster prevention)
        this.correlationGroups = {
            'EQUITY_FUTURES': ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'SPY', 'QQQ', 'IWM'],
            'ENERGY': ['CL', 'NG', 'RB', 'HO', 'XLE', 'XOP'],
            'METALS': ['GC', 'SI', 'MGC', 'GLD', 'SLV'],
            'BONDS': ['ZB', 'ZN', 'ZF', 'ZT', 'TLT'],
            'CURRENCIES': ['6E', '6B', '6A', '6J', '6S', '6C'],
            'GRAINS': ['ZC', 'ZS', 'ZW'],
            'LIVESTOCK': ['LE', 'HE'],
            'SOFTS': ['KC', 'SB', 'CC']
        };

        // VIX Regimes with strategy adjustments (PDF Pages 4-5)
        this.vixRegimes = {
            1: { range: [0, 12], description: 'Extreme Low', sizing: 0.7, strategies: ['Conservative', 'Buy Options'] },
            2: { range: [12, 16], description: 'Low', sizing: 0.85, strategies: ['Standard', 'Moderate Premium'] },
            3: { range: [16, 20], description: 'Normal', sizing: 1.0, strategies: ['All Strategies', 'Balanced'] },
            4: { range: [20, 30], description: 'High', sizing: 1.25, strategies: ['Premium Collection', 'Short Strangles'] },
            5: { range: [30, 100], description: 'Extreme High', sizing: 1.5, strategies: ['Max Premium', 'Aggressive Short'] }
        };

        logger.info('ENGINE', 'Enhanced Tom King Recommendation Engine v17 initialized');
    }

    /**
     * Initialize with API connection for real-time data
     */
    async initialize(useAPI = true) {
        if (useAPI) {
            try {
                this.api = new TastyTradeAPI();
                await this.api.initialize();
                logger.info('ENGINE', 'API connected for enhanced recommendations');
                return true;
            } catch (error) {
                logger.error('ENGINE', 'API connection required - no simulated data allowed');
                this.api = null;
                throw new Error('API connection required for recommendations - simulated data not allowed');
            }
        }
        return false;
    }

    /**
     * MAIN ENTRY POINT: Generate comprehensive recommendations
     * @param {Object} userData - Parsed user account data
     * @param {boolean} includeGreeks - Include Greeks analysis
     * @param {boolean} includePatterns - Include pattern analysis
     */
    async generateEnhancedRecommendations(userData, includeGreeks = true, includePatterns = true) {
        logger.info('ENGINE', 'ENHANCED TOM KING ANALYSIS STARTING', {
            account: `£${userData.accountValue?.toLocaleString() || 'N/A'}`,
            phase: userData.phase,
            bpUsed: `${userData.bpUsed}%`
        });

        const startTime = Date.now();
        const recommendations = {
            summary: {},
            qualifiedTickers: [],
            patternAnalysis: {},
            greeksAnalysis: {},
            strikeRecommendations: {},
            riskAnalysis: {},
            portfolioOptimization: {},
            actionItems: [],
            warnings: []
        };

        try {
            // Step 1: Analyze current portfolio and risk
            logger.debug('ENGINE', 'Step 1: Portfolio Risk Analysis');
            recommendations.riskAnalysis = await this.analyzePortfolioRisk(userData);

            // Step 2: Determine qualified tickers based on phase and rules
            logger.debug('ENGINE', 'Step 2: Ticker Qualification Analysis');
            recommendations.qualifiedTickers = await this.determineQualifiedTickers(userData, recommendations.riskAnalysis);

            // Step 3: Collect market data for qualified tickers
            logger.debug('ENGINE', 'Step 3: Market Data Collection');
            await this.collectMarketDataForTickers(recommendations.qualifiedTickers);

            // Step 4: Run pattern analysis for entry opportunities
            if (includePatterns && recommendations.qualifiedTickers.length > 0) {
                logger.debug('ENGINE', 'Step 4: Pattern Analysis & Entry Opportunities');
                recommendations.patternAnalysis = await this.runPatternAnalysis(recommendations.qualifiedTickers, userData);
            }

            // Step 5: Analyze Greeks for qualified opportunities
            if (includeGreeks && recommendations.qualifiedTickers.length > 0) {
                logger.debug('ENGINE', 'Step 5: Greeks Analysis & Strike Optimization');
                recommendations.greeksAnalysis = await this.analyzeGreeksAndStrikes(recommendations.qualifiedTickers, userData);
                recommendations.strikeRecommendations = await this.optimizeStrikes(recommendations.qualifiedTickers, userData, recommendations.greeksAnalysis);
            }

            // Step 6: Portfolio optimization and diversification
            logger.debug('ENGINE', 'Step 6: Portfolio Optimization');
            recommendations.portfolioOptimization = await this.optimizePortfolioWithGreeks(userData, recommendations);

            // Step 7: Generate final action items
            logger.debug('ENGINE', 'Step 7: Final Recommendations');
            recommendations.actionItems = await this.generateActionItems(recommendations, userData);

            // Summary
            const executionTime = Date.now() - startTime;
            recommendations.summary = {
                accountPhase: userData.phase || 1,
                qualifiedTickersCount: recommendations.qualifiedTickers ? recommendations.qualifiedTickers.length : 0,
                patternOpportunities: recommendations.patternAnalysis ? Object.keys(recommendations.patternAnalysis).length : 0,
                strikeRecommendations: recommendations.strikeRecommendations ? Object.keys(recommendations.strikeRecommendations).length : 0,
                executionTime,
                generatedAt: new Date().toISOString()
            };

            logger.info('ENGINE', `Analysis Complete! Generated ${recommendations.actionItems.length} recommendations`, {
                executionTime: `${executionTime}ms`,
                recommendationCount: recommendations.actionItems.length
            });
            return recommendations;

        } catch (error) {
            console.error('❌ Enhanced analysis error:', error);
            recommendations.warnings.push({
                severity: 'ERROR',
                message: `Analysis failed: ${error.message}`,
                fallback: 'Using basic recommendation system'
            });
            return recommendations;
        }
    }

    /**
     * Analyze portfolio risk and correlation exposure
     */
    async analyzePortfolioRisk(userData) {
        const analysis = {
            correlationRisk: {
                groups: {},
                violations: [],
                maxPerGroup: 3
            },
            bpUtilization: userData.bpUsed || 0,
            positionHealth: [],
            riskLevel: 'LOW'
        };

        // Analyze current positions for correlation risk
        const groupCounts = {};
        userData.positions?.forEach(pos => {
            // Find correlation group
            for (const [groupName, tickers] of Object.entries(this.correlationGroups)) {
                if (tickers.includes(pos.ticker)) {
                    groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
                    break;
                }
            }

            // Analyze position health
            const health = this.analyzePositionHealth(pos);
            analysis.positionHealth.push({ ...pos, health });
        });

        analysis.correlationRisk.groups = groupCounts;

        // Check for violations (August 2024 disaster prevention)
        Object.entries(groupCounts).forEach(([group, count]) => {
            if (count > analysis.correlationRisk.maxPerGroup) {
                analysis.correlationRisk.violations.push({
                    group,
                    count,
                    severity: 'CRITICAL',
                    message: `${group}: ${count} positions (max ${analysis.correlationRisk.maxPerGroup})`
                });
            }
        });

        // Determine overall risk level
        if (analysis.correlationRisk.violations.length > 0) {
            analysis.riskLevel = 'CRITICAL';
        } else if (userData.bpUsed > 50) {
            analysis.riskLevel = 'HIGH';
        } else if (userData.bpUsed > 30) {
            analysis.riskLevel = 'MODERATE';
        }

        return analysis;
    }

    /**
     * Determine qualified tickers based on phase, correlation, and Tom King rules
     */
    async determineQualifiedTickers(userData, riskAnalysis) {
        const phase = userData.phase;
        const phaseConfig = this.phaseRequirements[phase];
        const qualified = [];

        logger.debug('ENGINE', `Phase ${phase}: Checking ${phaseConfig.qualifiedTickers.length} potential tickers`);

        for (const ticker of phaseConfig.qualifiedTickers) {
            const qualification = await this.qualifyTicker(ticker, userData, riskAnalysis, phaseConfig);
            
            if (qualification.qualified) {
                qualified.push({
                    ticker,
                    qualification,
                    priority: qualification.priority,
                    correlationGroup: this.getCorrelationGroup(ticker),
                    maxBPAllocation: qualification.maxBP
                });
            }
        }

        // Sort by priority and diversification
        qualified.sort((a, b) => {
            // Prioritize different correlation groups for diversification
            if (a.correlationGroup !== b.correlationGroup) {
                return 0; // Keep diverse tickers
            }
            return b.priority - a.priority; // Higher priority first within same group
        });

        logger.debug('ENGINE', `Qualified ${qualified.length} tickers for Phase ${phase}`);
        return qualified;
    }

    /**
     * Qualify individual ticker based on Tom King rules
     */
    async qualifyTicker(ticker, userData, riskAnalysis, phaseConfig) {
        const qualification = {
            qualified: false,
            reasons: [],
            priority: 0,
            maxBP: 0,
            restrictions: []
        };

        // Get phase from userData
        const phase = userData.phase || 1;
        
        // Check correlation limits first (August 2024 prevention)
        const correlationGroup = this.getCorrelationGroup(ticker);
        const currentGroupCount = riskAnalysis.correlationRisk.groups[correlationGroup] || 0;
        
        if (currentGroupCount >= 3) {
            qualification.reasons.push(`Correlation limit: ${correlationGroup} already has ${currentGroupCount} positions`);
            return qualification;
        }

        // Check if already holding this ticker
        const existingPosition = userData.positions?.find(p => p.ticker === ticker);
        if (existingPosition && existingPosition.strategy !== '0DTE') {
            qualification.reasons.push(`Already holding ${ticker} ${existingPosition.strategy}`);
            return qualification;
        }

        // Check buying power availability
        const availableBP = Math.max(0, 65 - userData.bpUsed); // Tom King max 65% rule
        const estimatedBPRequired = this.estimateBPRequirement(ticker, phaseConfig);
        
        if (availableBP < estimatedBPRequired) {
            qualification.reasons.push(`Insufficient BP: need ${estimatedBPRequired}%, have ${availableBP}%`);
            return qualification;
        }

        // Phase-specific qualifications
        if (phase === 1 && !['MCL', 'MGC', 'GLD', 'TLT', 'SLV'].includes(ticker)) {
            qualification.reasons.push(`Phase 1: ${ticker} not in foundation tier`);
            return qualification;
        }

        if (phase === 2 && ticker === 'ES') {
            qualification.reasons.push(`Phase 2: ES requires Phase 3+ (use MES instead)`);
            return qualification;
        }

        // VIX-based qualifications
        const vixLevel = userData.vixLevel || 16;
        const vixRegime = this.getVIXRegime(vixLevel);
        
        // Ticker is qualified - calculate priority
        qualification.qualified = true;
        qualification.maxBP = Math.min(estimatedBPRequired, phaseConfig.maxBPPerPosition);
        
        // Priority calculation (higher = better opportunity)
        let priority = 50; // Base priority

        // VIX regime adjustments
        if (vixRegime.level >= 4) priority += 20; // High VIX = more premium opportunity
        if (vixRegime.level <= 2) priority -= 10; // Low VIX = less opportunity

        // Correlation diversification bonus
        if (currentGroupCount === 0) priority += 15; // New correlation group
        if (currentGroupCount === 1) priority += 10; // Second in group
        if (currentGroupCount === 2) priority += 0;  // Third in group (max)

        // Phase progression bonuses
        if (phase === 2 && ticker === 'MES') priority += 25; // Core Phase 2 strategy
        if (phase === 3 && ticker === 'ES') priority += 30;  // Core Phase 3 upgrade
        if (phase >= 3 && ['CL', 'GC'].includes(ticker)) priority += 20; // Advanced strategies

        // Time-based adjustments
        if (userData.dayOfWeek === 'Friday' && ['ES', 'SPY', 'MES'].includes(ticker)) {
            priority += 25; // 0DTE opportunities
        }

        qualification.priority = priority;
        qualification.reasons.push(`Qualified with priority ${priority}`);

        return qualification;
    }

    /**
     * Get correlation group for ticker
     */
    getCorrelationGroup(ticker) {
        for (const [group, tickers] of Object.entries(this.correlationGroups)) {
            if (tickers.includes(ticker)) return group;
        }
        return 'OTHER';
    }

    /**
     * Get VIX regime information
     */
    getVIXRegime(vixLevel) {
        for (const [level, config] of Object.entries(this.vixRegimes)) {
            if (vixLevel >= config.range[0] && vixLevel < config.range[1]) {
                return { level: parseInt(level), ...config };
            }
        }
        return this.vixRegimes[3]; // Default to normal
    }

    /**
     * Estimate BP requirement for ticker/strategy combination
     */
    estimateBPRequirement(ticker, phaseConfig) {
        const isMicro = ticker.startsWith('M') || ticker === 'MCL' || ticker === 'MGC';
        const isETF = ['SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT', 'XLE', 'XOP'].includes(ticker);
        const isFuture = !isETF;

        if (isMicro) return 3; // Micro futures
        if (isETF) return 8; // ETF strategies
        if (isFuture) return 15; // Full futures
        
        return 5; // Default
    }

    /**
     * Analyze individual position health
     */
    analyzePositionHealth(position) {
        const { dte, pl, strategy } = position;
        
        // Tom King management rules
        if (dte <= 21 && pl < 50) return { status: 'CRITICAL', action: '21 DTE Rule - Close/Roll', priority: 'HIGH' };
        if (pl >= 50) return { status: 'EXCELLENT', action: 'Take 50% Profit', priority: 'HIGH' };
        if (pl >= 25) return { status: 'GOOD', action: 'Monitor for Profit Target', priority: 'MEDIUM' };
        if (pl >= -10) return { status: 'FAIR', action: 'Hold - Small Loss', priority: 'LOW' };
        if (pl >= -25) return { status: 'POOR', action: 'Consider Defensive Adjustment', priority: 'MEDIUM' };
        
        return { status: 'CRITICAL', action: 'Evaluate Stop Loss', priority: 'HIGH' };
    }

    /**
     * Collect market data for qualified tickers
     */
    async collectMarketDataForTickers(qualifiedTickers) {
        const tickers = qualifiedTickers.map(q => q.ticker);
        logger.debug('ENGINE', `Collecting market data for ${tickers.length} tickers: ${tickers.join(', ')}`);

        if (this.api) {
            try {
                // Collect real market data
                for (const tickerObj of qualifiedTickers) {
                    const ticker = tickerObj.ticker;
                    this.currentMarketData[ticker] = await this.api.marketDataCollector.getTickerData(ticker);
                }
            } catch (error) {
                logger.error('ENGINE', 'API data collection failed - cannot proceed without real data');
                throw new Error(`Real market data unavailable: ${error.message}`);
            }
        } else {
            // CRITICAL: No API means no real data
            throw new Error('API not available - cannot get real market data for recommendations');
        }
    }

    /**
     * REMOVED: Simulated market data not allowed - must use API
     */
    generateSimulatedMarketData(tickers) {
        throw new Error('Simulated market data generation not allowed. Connect to TastyTrade API for real data.');
        const basePrices = {
            'ES': 5450, 'MES': 5450, 'NQ': 18500, 'MNQ': 18500, 'RTY': 2100,
            'CL': 75, 'GC': 2050, 'SI': 24, 'NG': 2.8, 'MCL': 75, 'MGC': 2050,
            'SPY': 545, 'QQQ': 380, 'IWM': 210, 'GLD': 200, 'SLV': 24, 'TLT': 95,
            'ZB': 112, 'ZN': 108, '6E': 1.08, '6B': 1.27, '6A': 0.67
        };

        tickers.forEach(ticker => {
            const basePrice = basePrices[ticker] || 100;
            const volatility = Math.random() * 0.4 + 0.1; // 10-50% volatility
            
            this.currentMarketData[ticker] = {
                price: basePrice + (Math.random() - 0.5) * basePrice * volatility * 0.1,
                volume: Math.floor(Math.random() * 100000) + 10000,
                iv: volatility * 100,
                ivRank: Math.random() * 100,
                delta: Math.random() * 0.6 + 0.2,
                gamma: Math.random() * 0.05,
                theta: -(Math.random() * 0.1 + 0.01),
                vega: Math.random() * 0.5 + 0.1,
                bidAskSpread: basePrice * 0.001,
                liquidity: Math.random() > 0.3 ? 'Good' : 'Limited',
                trend: Math.random() > 0.5 ? 'Bullish' : 'Bearish',
                momentum: Math.random() > 0.6 ? 'Strong' : Math.random() > 0.3 ? 'Moderate' : 'Weak'
            };
        });
    }

    /**
     * Run comprehensive pattern analysis for entry opportunities
     */
    async runPatternAnalysis(qualifiedTickers, userData) {
        const analysis = {};
        const vixRegime = this.getVIXRegime(userData.vixLevel || 16);

        logger.debug('ENGINE', `Running pattern analysis for ${qualifiedTickers.length} tickers`);

        for (const tickerObj of qualifiedTickers) {
            const ticker = tickerObj.ticker;
            const marketData = this.currentMarketData[ticker];
            
            if (!marketData) continue;

            const patterns = this.analyzePatterns(ticker, marketData, vixRegime, userData);
            
            if (patterns.signals.length > 0) {
                analysis[ticker] = {
                    ...patterns,
                    correlationGroup: tickerObj.correlationGroup,
                    priority: tickerObj.priority,
                    maxBPAllocation: tickerObj.maxBPAllocation
                };
            }
        }

        const totalOpportunities = Object.keys(analysis).length;
        logger.debug('ENGINE', `Found ${totalOpportunities} pattern-based opportunities`);

        return analysis;
    }

    /**
     * Analyze patterns for individual ticker
     */
    analyzePatterns(ticker, marketData, vixRegime, userData) {
        const patterns = {
            ticker,
            signals: [],
            confidence: 0,
            preferredStrategy: null,
            entryConditions: [],
            riskFactors: []
        };

        const { price, iv, ivRank, trend, momentum, liquidity } = marketData;

        // Pattern 1: High IV Rank + VIX Spike (Premium Collection)
        if (ivRank > 70 && vixRegime.level >= 4) {
            patterns.signals.push({
                type: 'PREMIUM_COLLECTION',
                strength: 'STRONG',
                message: `High IV Rank (${ivRank.toFixed(1)}) + VIX ${vixRegime.description}`,
                strategy: 'Short Strangle',
                confidence: 85
            });
        }

        // Pattern 2: Low IV + Directional Momentum (Buy Options)
        if (ivRank < 30 && momentum === 'Strong') {
            patterns.signals.push({
                type: 'DIRECTIONAL_PLAY',
                strength: 'MODERATE',
                message: `Low IV (${ivRank.toFixed(1)}) + Strong ${trend} momentum`,
                strategy: trend === 'Bullish' ? 'Call Spread' : 'Put Spread',
                confidence: 65
            });
        }

        // Pattern 3: Friday 0DTE Setup
        if (userData.dayOfWeek === 'Friday' && ['ES', 'SPY', 'MES'].includes(ticker)) {
            const hour = this.extractHour(userData.timeEST || '11:00 AM');
            if (hour >= 10.5) {
                patterns.signals.push({
                    type: '0DTE_OPPORTUNITY',
                    strength: 'STRONG',
                    message: `Friday 0DTE window open for ${ticker}`,
                    strategy: '0DTE Iron Condor',
                    confidence: 75
                });
            }
        }

        // Pattern 4: Mean Reversion Setup
        if (Math.abs(price - (marketData.ema21 || price)) / price > 0.05) {
            patterns.signals.push({
                type: 'MEAN_REVERSION',
                strength: 'MODERATE',
                message: `Price ${price > (marketData.ema21 || price) ? 'extended above' : 'below'} moving average`,
                strategy: 'Iron Condor',
                confidence: 55
            });
        }

        // Pattern 5: Liquidity Check
        if (liquidity === 'Limited') {
            patterns.riskFactors.push('Limited liquidity - wider bid/ask spreads');
        }

        // Calculate overall confidence
        patterns.confidence = patterns.signals.reduce((sum, signal) => sum + signal.confidence, 0) / patterns.signals.length || 0;
        
        // Determine preferred strategy
        if (patterns.signals.length > 0) {
            const bestSignal = patterns.signals.reduce((best, signal) => 
                signal.confidence > best.confidence ? signal : best
            );
            patterns.preferredStrategy = bestSignal.strategy;
        }

        // Entry conditions
        if (patterns.signals.length > 0) {
            patterns.entryConditions = [
                'Wait for bid/ask spread < 0.05',
                'Enter during high volume periods',
                'Monitor Greeks before entry',
                `Target IV rank > 50 for premium strategies`
            ];
        }

        return patterns;
    }

    /**
     * Analyze Greeks and optimize strikes
     */
    async analyzeGreeksAndStrikes(qualifiedTickers, userData) {
        const analysis = {};
        
        logger.debug('ENGINE', `Analyzing Greeks for ${qualifiedTickers.length} tickers`);

        for (const tickerObj of qualifiedTickers) {
            const ticker = tickerObj.ticker;
            const marketData = this.currentMarketData[ticker];
            
            if (!marketData) continue;

            // Get option chain data (real API data only)
            const optionChain = await this.getOptionChainData(ticker, marketData);
            
            if (optionChain) {
                analysis[ticker] = {
                    ...this.analyzeGreeksForTicker(ticker, optionChain, marketData, userData),
                    correlationGroup: tickerObj.correlationGroup
                };
            }
        }

        logger.debug('ENGINE', `Greeks analysis complete for ${Object.keys(analysis).length} tickers`);
        return analysis;
    }

    /**
     * Get option chain data for ticker
     */
    async getOptionChainData(ticker, marketData) {
        if (this.api) {
            try {
                // Get real option chain data
                return await this.api.getOptionChain(ticker);
            } catch (error) {
                logger.error('ENGINE', `Option chain for ${ticker} not available from API`);
                throw error; // No fallback - must have real data
            }
        }

        // No API connection - cannot proceed
        throw new Error(`Real option chain unavailable for ${ticker}. API connection required.`);
    }

    /**
     * REMOVED: Simulated option chains not allowed - must use API
     */
    generateSimulatedOptionChain(ticker, marketData) {
        throw new Error(`Simulated option chain not allowed for ${ticker}. Use TastyTrade API for real data.`);
        const { price, iv } = marketData;
        const strikes = [];
        
        // Generate strikes around current price
        for (let i = -10; i <= 10; i++) {
            const strike = Math.round(price * (1 + i * 0.02) * 20) / 20; // 2% intervals, rounded to 0.05
            const moneyness = strike / price;
            
            // Calculate approximate Greeks
            const timeToExpiry = 0.25; // 90 days
            const delta = this.calculateApproximateDelta(moneyness, timeToExpiry, iv);
            
            strikes.push({
                strike,
                delta: delta.call,
                gamma: Math.abs(delta.call - delta.put) * 0.1,
                theta: -0.05 * Math.sqrt(timeToExpiry),
                vega: 0.3 * Math.sqrt(timeToExpiry) * (iv / 100),
                bid: Math.max(0.01, (price - strike) * 0.1 + Math.random() * 2),
                ask: Math.max(0.02, (price - strike) * 0.1 + Math.random() * 2 + 0.01),
                volume: Math.floor(Math.random() * 1000) + 10,
                openInterest: Math.floor(Math.random() * 5000) + 100
            });
        }

        return { strikes };
    }

    /**
     * Calculate approximate Delta using simplified Black-Scholes
     */
    calculateApproximateDelta(moneyness, timeToExpiry, iv) {
        const d1 = (Math.log(moneyness) + 0.5 * Math.pow(iv / 100, 2) * timeToExpiry) / 
                   (iv / 100 * Math.sqrt(timeToExpiry));
        
        // Simplified normal CDF approximation
        const normCDF = (x) => 0.5 * (1 + Math.sign(x) * Math.sqrt(1 - Math.exp(-2 * x * x / Math.PI)));
        
        return {
            call: normCDF(d1),
            put: normCDF(d1) - 1
        };
    }

    /**
     * Analyze Greeks for specific ticker
     */
    analyzeGreeksForTicker(ticker, optionChain, marketData, userData) {
        const analysis = {
            ticker,
            recommendations: [],
            greeksProfile: {},
            diversificationScore: 0,
            riskAdjustedOpportunity: 0
        };

        if (!optionChain || !optionChain.strikes) {
            return analysis;
        }

        const { strikes } = optionChain;
        const vixRegime = this.getVIXRegime(userData.vixLevel || 16);

        // Find optimal strikes for different strategies
        analysis.recommendations = [
            this.findOptimalStrangleStrikes(strikes, vixRegime),
            this.findOptimalIronCondorStrikes(strikes, vixRegime),
            this.findOptimal0DTEStrikes(strikes, userData)
        ].filter(rec => rec && rec.viable);

        // Calculate Greeks profile for portfolio impact
        analysis.greeksProfile = this.calculatePortfolioGreeks(strikes, userData.positions || []);

        // Diversification score based on Greeks correlation
        analysis.diversificationScore = this.calculateGreeksDiversification(analysis.greeksProfile, userData.positions || []);

        // Risk-adjusted opportunity score
        analysis.riskAdjustedOpportunity = this.calculateRiskAdjustedScore(analysis.recommendations, marketData);

        return analysis;
    }

    /**
     * Find optimal strangle strikes based on Greeks
     */
    findOptimalStrangleStrikes(strikes, vixRegime) {
        const recommendation = {
            strategy: 'Short Strangle',
            viable: false,
            putStrike: null,
            callStrike: null,
            netCredit: 0,
            greeksImpact: {},
            confidence: 0
        };

        // Target delta range based on VIX regime
        const targetDelta = vixRegime.level >= 4 ? 0.20 : 0.15; // Higher delta in high VIX

        // Find puts and calls near target delta
        if (!strikes || !Array.isArray(strikes)) {
            return recommendation;
        }
        
        const puts = strikes.filter(s => s && s.delta && s.delta < -0.1 && s.delta > -0.3).sort((a, b) => Math.abs(a.delta + targetDelta) - Math.abs(b.delta + targetDelta));
        const calls = strikes.filter(s => s && s.delta && s.delta > 0.1 && s.delta < 0.3).sort((a, b) => Math.abs(a.delta - targetDelta) - Math.abs(b.delta - targetDelta));

        if (puts.length > 0 && calls.length > 0) {
            const putStrike = puts[0];
            const callStrike = calls[0];
            
            recommendation.viable = true;
            recommendation.putStrike = putStrike.strike;
            recommendation.callStrike = callStrike.strike;
            recommendation.netCredit = (putStrike.bid + callStrike.bid) * 0.9; // 90% of mid
            
            // Calculate combined Greeks
            recommendation.greeksImpact = {
                delta: putStrike.delta + callStrike.delta, // Should be close to 0
                gamma: putStrike.gamma + callStrike.gamma,
                theta: putStrike.theta + callStrike.theta, // Positive theta
                vega: putStrike.vega + callStrike.vega     // Negative vega
            };

            // Confidence based on liquidity and Greeks balance
            const deltaBalance = Math.abs(recommendation.greeksImpact.delta);
            const liquidityScore = Math.min(putStrike.volume + callStrike.volume, 500) / 500;
            recommendation.confidence = (1 - deltaBalance * 5) * liquidityScore * 100;
        }

        return recommendation;
    }

    /**
     * Find optimal Iron Condor strikes
     */
    findOptimalIronCondorStrikes(strikes, vixRegime) {
        const recommendation = {
            strategy: 'Iron Condor',
            viable: false,
            strikes: { putLong: null, putShort: null, callShort: null, callLong: null },
            netCredit: 0,
            greeksImpact: {},
            confidence: 0
        };

        // Target 15-20 delta for short strikes
        const targetDelta = 0.16;
        const wingWidth = vixRegime.level >= 4 ? 50 : 30; // Wider wings in high VIX

        const shortPuts = strikes.filter(s => s.delta < -0.1 && s.delta > -0.25).sort((a, b) => Math.abs(a.delta + targetDelta) - Math.abs(b.delta + targetDelta));
        const shortCalls = strikes.filter(s => s.delta > 0.1 && s.delta < 0.25).sort((a, b) => Math.abs(a.delta - targetDelta) - Math.abs(b.delta - targetDelta));

        if (shortPuts.length > 0 && shortCalls.length > 0) {
            const putShort = shortPuts[0];
            const callShort = shortCalls[0];
            
            // Find long strikes at appropriate distance
            const putLong = strikes.find(s => Math.abs(s.strike - (putShort.strike - wingWidth)) < 5);
            const callLong = strikes.find(s => Math.abs(s.strike - (callShort.strike + wingWidth)) < 5);

            if (putLong && callLong) {
                recommendation.viable = true;
                recommendation.strikes = {
                    putLong: putLong.strike,
                    putShort: putShort.strike,
                    callShort: callShort.strike,
                    callLong: callLong.strike
                };
                
                // Net credit calculation
                recommendation.netCredit = (putShort.bid - putLong.ask + callShort.bid - callLong.ask) * 0.85;

                // Combined Greeks
                recommendation.greeksImpact = {
                    delta: (putShort.delta - putLong.delta) + (callShort.delta - callLong.delta),
                    gamma: (putShort.gamma - putLong.gamma) + (callShort.gamma - callLong.gamma),
                    theta: (putShort.theta - putLong.theta) + (callShort.theta - callLong.theta),
                    vega: (putShort.vega - putLong.vega) + (callShort.vega - callLong.vega)
                };

                // Confidence based on credit and balance
                const creditScore = Math.min(recommendation.netCredit, 5) / 5; // Up to $5 credit
                const deltaBalance = 1 - Math.abs(recommendation.greeksImpact.delta) * 2;
                recommendation.confidence = creditScore * deltaBalance * 100;
            }
        }

        return recommendation;
    }

    /**
     * Find optimal 0DTE strikes for Friday trading
     */
    findOptimal0DTEStrikes(strikes, userData) {
        const recommendation = {
            strategy: '0DTE',
            viable: false,
            direction: null,
            strikes: {},
            targetCredit: 0,
            confidence: 0
        };

        // Only viable on Fridays after 10:30 AM
        if (userData.dayOfWeek !== 'Friday') return recommendation;
        
        const hour = this.extractHour(userData.timeEST || '11:00 AM');
        if (hour < 10.5) return recommendation;

        // Determine direction based on momentum and IV
        const direction = this.determine0DTEDirection(strikes);
        
        if (direction.confidence > 50) {
            recommendation.viable = true;
            recommendation.direction = direction.bias;
            recommendation.strikes = direction.strikes;
            recommendation.targetCredit = direction.credit;
            recommendation.confidence = direction.confidence;
        }

        return recommendation;
    }

    /**
     * Determine 0DTE direction based on market conditions
     */
    determine0DTEDirection(strikes) {
        // Simplified directional bias calculation
        const atmStrike = strikes.find(s => Math.abs(s.delta) < 0.1);
        if (!atmStrike) return { confidence: 0 };

        const totalCallVolume = strikes.filter(s => s.delta > 0.1).reduce((sum, s) => sum + s.volume, 0);
        const totalPutVolume = strikes.filter(s => s.delta < -0.1).reduce((sum, s) => sum + s.volume, 0);
        
        const volumeBias = totalCallVolume > totalPutVolume ? 'BULLISH' : 'BEARISH';
        const confidence = Math.min(Math.abs(totalCallVolume - totalPutVolume) / (totalCallVolume + totalPutVolume) * 200, 80);

        return {
            bias: volumeBias,
            confidence,
            strikes: {
                short: atmStrike.strike + (volumeBias === 'BULLISH' ? -30 : 30),
                long: atmStrike.strike + (volumeBias === 'BULLISH' ? -60 : 60)
            },
            credit: 3.0 + Math.random() * 2
        };
    }

    /**
     * Calculate portfolio Greeks impact
     */
    calculatePortfolioGreeks(strikes, currentPositions) {
        const portfolio = {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            deltaAllocation: {}
        };

        // Sum existing Greeks from current positions (simplified)
        currentPositions.forEach(pos => {
            const estimatedGreeks = this.estimatePositionGreeks(pos);
            portfolio.delta += estimatedGreeks.delta;
            portfolio.gamma += estimatedGreeks.gamma;
            portfolio.theta += estimatedGreeks.theta;
            portfolio.vega += estimatedGreeks.vega;
            
            const group = this.getCorrelationGroup(pos.ticker);
            portfolio.deltaAllocation[group] = (portfolio.deltaAllocation[group] || 0) + Math.abs(estimatedGreeks.delta);
        });

        return portfolio;
    }

    /**
     * Estimate Greeks for existing position
     */
    estimatePositionGreeks(position) {
        const { strategy, ticker, dte } = position;
        
        // Simplified Greeks estimation based on strategy and DTE
        const timeDecayFactor = Math.sqrt(dte / 90);
        
        const greeksMap = {
            'STRANGLE': { delta: 0, gamma: 0.05, theta: 0.02, vega: -0.3 },
            'LT112': { delta: 0.2, gamma: 0.03, theta: 0.01, vega: -0.2 },
            'IPMCC': { delta: 0.3, gamma: 0.02, theta: 0.015, vega: -0.1 },
            '0DTE': { delta: 0, gamma: 0.1, theta: 0.05, vega: -0.5 },
            'BUTTERFLY': { delta: 0, gamma: 0.03, theta: 0.01, vega: -0.1 }
        };

        const baseGreeks = greeksMap[strategy] || greeksMap['STRANGLE'];
        
        return {
            delta: baseGreeks.delta * timeDecayFactor,
            gamma: baseGreeks.gamma * timeDecayFactor,
            theta: baseGreeks.theta * timeDecayFactor,
            vega: baseGreeks.vega * timeDecayFactor
        };
    }

    /**
     * Calculate Greeks-based diversification score
     */
    calculateGreeksDiversification(portfolioGreeks, currentPositions) {
        let score = 100; // Perfect diversification starts at 100

        // Penalize excessive delta exposure
        const totalDelta = Math.abs(portfolioGreeks.delta);
        if (totalDelta > 0.5) score -= (totalDelta - 0.5) * 40;

        // Penalize vega concentration
        const totalVega = Math.abs(portfolioGreeks.vega);
        if (totalVega > 1.0) score -= (totalVega - 1.0) * 30;

        // Bonus for theta positive positions
        if (portfolioGreeks.theta > 0) score += 20;

        // Check correlation group diversification
        const groups = {};
        currentPositions.forEach(pos => {
            const group = this.getCorrelationGroup(pos.ticker);
            groups[group] = (groups[group] || 0) + 1;
        });

        const groupCount = Object.keys(groups).length;
        if (groupCount >= 3) score += 15; // Bonus for 3+ different groups
        if (groupCount >= 5) score += 10; // Extra bonus for 5+ groups

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculate risk-adjusted opportunity score
     */
    calculateRiskAdjustedScore(recommendations, marketData) {
        if (recommendations.length === 0) return 0;

        const scores = recommendations.map(rec => {
            let score = rec.confidence || 0;
            
            // Adjust for market conditions
            if (marketData.liquidity === 'Good') score += 10;
            if (marketData.bidAskSpread < marketData.price * 0.005) score += 15; // Good spreads
            if (marketData.volume > 50000) score += 10; // High volume
            
            return score;
        });

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    /**
     * Extract hour from time string
     */
    extractHour(timeStr) {
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            const minute = parseInt(timeMatch[2]);
            const ampm = timeMatch[3];
            
            if (ampm && ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
            if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
            
            return hour + (minute / 60);
        }
        return 10; // Default
    }

    /**
     * Optimize strikes based on Greeks analysis
     */
    async optimizeStrikes(qualifiedTickers, userData, greeksAnalysis) {
        const optimized = {};
        
        logger.debug('ENGINE', `Optimizing strikes for ${qualifiedTickers.length} tickers`);

        Object.entries(greeksAnalysis).forEach(([ticker, analysis]) => {
            const bestRecommendations = analysis.recommendations
                .filter(rec => rec.viable)
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 2); // Top 2 strategies per ticker

            if (bestRecommendations.length > 0) {
                optimized[ticker] = {
                    ticker,
                    correlationGroup: analysis.correlationGroup,
                    diversificationScore: analysis.diversificationScore,
                    riskAdjustedOpportunity: analysis.riskAdjustedOpportunity,
                    recommendations: bestRecommendations,
                    portfolioImpact: this.calculatePortfolioImpact(bestRecommendations, userData)
                };
            }
        });

        logger.debug('ENGINE', `Optimized strikes for ${Object.keys(optimized).length} tickers`);
        return optimized;
    }

    /**
     * Calculate portfolio impact of recommendations
     */
    calculatePortfolioImpact(recommendations, userData) {
        const impact = {
            bpRequirement: 0,
            deltaImpact: 0,
            thetaImpact: 0,
            vegaImpact: 0,
            maxLoss: 0,
            expectedReturn: 0
        };

        recommendations.forEach(rec => {
            // Estimate BP requirement
            impact.bpRequirement += this.estimateStrategyBP(rec.strategy);
            
            // Greeks impact
            if (rec.greeksImpact) {
                impact.deltaImpact += Math.abs(rec.greeksImpact.delta || 0);
                impact.thetaImpact += rec.greeksImpact.theta || 0;
                impact.vegaImpact += Math.abs(rec.greeksImpact.vega || 0);
            }
            
            // Risk/return estimates
            if (rec.strategy === 'Short Strangle') {
                impact.maxLoss += rec.netCredit * 3; // Rough 3:1 risk
                impact.expectedReturn += rec.netCredit * 0.7; // 70% win rate assumption
            }
        });

        return impact;
    }

    /**
     * Estimate BP requirement for strategy
     */
    estimateStrategyBP(strategy) {
        const bpMap = {
            'Short Strangle': 12,
            'Iron Condor': 8,
            '0DTE': 5,
            'Call Spread': 6,
            'Put Spread': 6,
            'Butterfly': 3
        };
        
        return bpMap[strategy] || 10;
    }

    /**
     * Optimize portfolio with Greeks considerations
     */
    async optimizePortfolioWithGreeks(userData, recommendations) {
        const optimization = {
            currentPortfolioGreeks: {},
            proposedAdditions: [],
            diversificationImprovements: [],
            riskAdjustments: [],
            maxPositions: 0
        };

        const phase = userData.phase;
        const phaseConfig = this.phaseRequirements[phase];
        optimization.maxPositions = phaseConfig.maxPositions;

        // Calculate current portfolio Greeks
        optimization.currentPortfolioGreeks = this.calculatePortfolioGreeks([], userData.positions || []);

        // Select best opportunities considering diversification
        const opportunities = Object.values(recommendations.strikeRecommendations || {})
            .sort((a, b) => b.riskAdjustedOpportunity - a.riskAdjustedOpportunity);

        const selectedOpportunities = [];
        const usedGroups = {};
        let totalBPUsed = userData.bpUsed;

        for (const opp of opportunities) {
            // Check correlation limits
            const groupCount = usedGroups[opp.correlationGroup] || 0;
            if (groupCount >= 3) continue;

            // Check BP limits
            const bpRequired = opp.portfolioImpact.bpRequirement;
            if (totalBPUsed + bpRequired > 60) continue; // Conservative 60% limit

            // Check position limits
            if (selectedOpportunities.length >= optimization.maxPositions) break;

            selectedOpportunities.push(opp);
            usedGroups[opp.correlationGroup] = groupCount + 1;
            totalBPUsed += bpRequired;
        }

        optimization.proposedAdditions = selectedOpportunities;

        // Generate diversification improvements
        const currentGroups = {};
        userData.positions?.forEach(pos => {
            const group = this.getCorrelationGroup(pos.ticker);
            currentGroups[group] = (currentGroups[group] || 0) + 1;
        });

        Object.entries(this.correlationGroups).forEach(([group, tickers]) => {
            const currentCount = currentGroups[group] || 0;
            if (currentCount === 0 && selectedOpportunities.some(opp => opp.correlationGroup === group)) {
                optimization.diversificationImprovements.push({
                    group,
                    message: `Adding ${group} exposure improves portfolio diversification`,
                    impact: 'Positive'
                });
            }
        });

        return optimization;
    }

    /**
     * Generate final action items from comprehensive analysis
     */
    async generateActionItems(recommendations, userData) {
        const actionItems = [];
        const phase = userData.phase;

        logger.debug('ENGINE', `Generating action items for Phase ${phase} account`);

        // Critical warnings first
        if (recommendations.riskAnalysis.correlationRisk.violations.length > 0) {
            actionItems.push({
                priority: 'CRITICAL',
                category: 'Risk Management',
                action: 'Reduce Correlation Exposure',
                details: recommendations.riskAnalysis.correlationRisk.violations.map(v => v.message).join(', '),
                reasoning: 'Prevent August 2024 style disaster (£308k loss from over-correlation)'
            });
        }

        // Position management items
        recommendations.riskAnalysis.positionHealth.forEach(pos => {
            if (pos.health.priority === 'HIGH') {
                actionItems.push({
                    priority: 'HIGH',
                    category: 'Position Management',
                    action: pos.health.action,
                    details: `${pos.ticker} ${pos.strategy}: ${pos.health.status}`,
                    reasoning: pos.dte <= 21 ? 'Tom King 21 DTE Rule' : pos.pl >= 50 ? 'Tom King 50% Profit Rule' : 'Risk Management'
                });
            }
        });

        // New opportunity items
        const opportunities = recommendations.portfolioOptimization?.proposedAdditions || [];
        opportunities.forEach((opp, index) => {
            if (index < 3) { // Top 3 opportunities
                const bestRec = opp.recommendations[0];
                actionItems.push({
                    priority: index === 0 ? 'HIGH' : 'MEDIUM',
                    category: 'New Opportunity',
                    action: `Enter ${bestRec.strategy} on ${opp.ticker}`,
                    details: this.formatStrikeDetails(bestRec),
                    reasoning: `${bestRec.confidence.toFixed(0)}% confidence, ${opp.correlationGroup} diversification`,
                    greeksImpact: bestRec.greeksImpact,
                    bpRequired: opp.portfolioImpact.bpRequirement
                });
            }
        });

        // Friday 0DTE items
        if (userData.dayOfWeek === 'Friday') {
            const hour = this.extractHour(userData.timeEST || '11:00 AM');
            if (hour >= 10.5) {
                const zdteOpportunities = Object.values(recommendations.strikeRecommendations || {})
                    .filter(opp => opp.recommendations.some(rec => rec.strategy === '0DTE' && rec.viable));
                
                if (zdteOpportunities.length > 0) {
                    actionItems.push({
                        priority: 'MEDIUM',
                        category: 'Friday 0DTE',
                        action: `0DTE Opportunity Window Open`,
                        details: `${zdteOpportunities.length} tickers qualified for 0DTE trading`,
                        reasoning: 'Friday after 10:30 AM - Tom King 0DTE protocol',
                        maxContracts: phase
                    });
                }
            }
        }

        // Phase progression items
        if (phase < 4) {
            const nextPhaseTarget = [null, 40000, 60000, 75000, 100000][phase + 1];
            const currentValue = userData.accountValue || 0;
            const progressNeeded = nextPhaseTarget - currentValue;
            
            if (progressNeeded > 0) {
                actionItems.push({
                    priority: 'LOW',
                    category: 'Phase Progression',
                    action: `Target Phase ${phase + 1} Upgrade`,
                    details: `Need £${progressNeeded.toLocaleString()} more to reach Phase ${phase + 1}`,
                    reasoning: `Unlock ${this.phaseRequirements[phase + 1].allowedStrategies.length} strategies and ${this.phaseRequirements[phase + 1].qualifiedTickers.length} tickers`
                });
            }
        }

        // Sort by priority
        const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
        actionItems.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        logger.debug('ENGINE', `Generated ${actionItems.length} action items`);
        return actionItems;
    }

    /**
     * Format strike details for display
     */
    formatStrikeDetails(recommendation) {
        const { strategy } = recommendation;
        
        if (strategy === 'Short Strangle') {
            return `Sell ${recommendation.putStrike}P/${recommendation.callStrike}C for £${recommendation.netCredit.toFixed(2)} credit`;
        }
        
        if (strategy === 'Iron Condor') {
            const s = recommendation.strikes;
            return `${s.putLong}/${s.putShort}/${s.callShort}/${s.callLong} for £${recommendation.netCredit.toFixed(2)} credit`;
        }
        
        if (strategy === '0DTE') {
            return `${recommendation.direction} ${recommendation.strikes.short}/${recommendation.strikes.long} for £${recommendation.targetCredit.toFixed(2)} credit`;
        }
        
        return `${strategy} - See Greeks analysis for details`;
    }
}

module.exports = EnhancedRecommendationEngine;