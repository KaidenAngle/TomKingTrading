/**
 * Real Greeks Manager
 * Fetches actual Greeks from TastyTrade API option chains instead of Black-Scholes estimates
 * Integrates with Tom King Trading Framework for accurate risk management
 */

const GreeksCalculator = require('./greeksCalculator');
const { getLogger } = require('./logger');
const EventEmitter = require('events');

const logger = getLogger();

class RealGreeksManager extends EventEmitter {
    constructor(apiClient, options = {}) {
        super();
        this.api = apiClient;
        this.greeksCalculator = new GreeksCalculator();
        
        // Configuration
        this.config = {
            updateInterval: options.updateInterval || 30000, // 30 seconds
            enableStreaming: options.enableStreaming !== false,
            cacheExpiry: options.cacheExpiry || 60000, // 1 minute cache
            enableWebSocket: options.enableWebSocket !== false,
            correlationGroupTracking: options.correlationGroupTracking !== false,
            ...options
        };
        
        // Cache and state management
        this.greeksCache = new Map();
        this.portfolioGreeks = null;
        this.lastUpdate = null;
        this.subscriptions = new Set();
        this.updateTimer = null;
        this.positions = [];
        
        // Greeks monitoring alerts
        this.alerts = {
            deltaNeutralThreshold: 50,
            gammaRiskThreshold: 500,
            thetaDecayAlert: -100,
            vegaExposureLimit: 2000
        };
        
        logger.info('GREEKS', 'Real Greeks Manager initialized', {
            updateInterval: this.config.updateInterval,
            streaming: this.config.enableStreaming
        });
    }

    /**
     * Initialize the Greeks Manager
     */
    async initialize() {
        try {
            logger.info('GREEKS', 'Initializing Real Greeks Manager');
            
            // Verify API connection
            if (!this.api) {
                throw new Error('API client is required for real Greeks fetching');
            }
            
            // Start update timer if enabled
            if (this.config.updateInterval > 0) {
                this.startUpdates();
            }
            
            // Setup WebSocket subscriptions if API supports streaming
            if (this.config.enableWebSocket && this.api.enableStreaming) {
                await this.setupWebSocketSubscriptions();
            }
            
            logger.info('GREEKS', 'Real Greeks Manager initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to initialize Real Greeks Manager', error);
            throw error;
        }
    }

    /**
     * Fetch real Greeks for a single option
     */
    async fetchRealGreeks(symbol, strike, expiration, optionType) {
        try {
            const cacheKey = `${symbol}-${strike}-${expiration}-${optionType}`;
            
            // Check cache first
            if (this.greeksCache.has(cacheKey)) {
                const cached = this.greeksCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.cacheExpiry) {
                    return cached.greeks;
                }
            }
            
            // Fetch option chain from API
            const optionChain = await this.api.getOptionChain(symbol, expiration);
            
            if (!optionChain || !optionChain.expirations) {
                logger.warn('GREEKS', `No option chain data for ${symbol}`, { strike, expiration });
                return this.getFallbackGreeks(symbol, strike, expiration, optionType);
            }
            
            // Find the specific expiration
            const targetExpiration = optionChain.expirations.find(exp => 
                exp.expiration === expiration
            );
            
            if (!targetExpiration) {
                logger.warn('GREEKS', `Expiration not found: ${expiration} for ${symbol}`);
                return this.getFallbackGreeks(symbol, strike, expiration, optionType);
            }
            
            // Find the specific strike and option type
            const targetStrike = targetExpiration.strikes.find(s => 
                Math.abs(s.strike - strike) < 0.01
            );
            
            if (!targetStrike) {
                logger.warn('GREEKS', `Strike not found: ${strike} for ${symbol}`);
                return this.getFallbackGreeks(symbol, strike, expiration, optionType);
            }
            
            // Extract real Greeks from API data
            const realGreeks = this.extractGreeksFromChain(targetStrike, optionType, optionChain.underlyingPrice);
            
            // Cache the result
            this.greeksCache.set(cacheKey, {
                greeks: realGreeks,
                timestamp: Date.now(),
                source: 'API'
            });
            
            logger.debug('GREEKS', `Real Greeks fetched for ${symbol}`, {
                strike, expiration, optionType,
                delta: realGreeks.delta,
                gamma: realGreeks.gamma
            });
            
            return realGreeks;
            
        } catch (error) {
            logger.error('GREEKS', `Failed to fetch real Greeks for ${symbol}`, error);
            return this.getFallbackGreeks(symbol, strike, expiration, optionType);
        }
    }

    /**
     * Extract Greeks from TastyTrade option chain response
     */
    extractGreeksFromChain(strikeData, optionType, underlyingPrice) {
        try {
            const option = optionType === 'call' ? strikeData.call : strikeData.put;
            
            if (!option) {
                throw new Error(`No ${optionType} data found in strike`);
            }
            
            // TastyTrade provides real Greeks in the option data
            const realGreeks = {
                delta: option.delta || 0,
                gamma: option.gamma || 0,
                theta: option.theta || 0,
                vega: option.vega || 0,
                rho: option.rho || 0,
                impliedVolatility: option.impliedVolatility || option.iv || 0,
                theoreticalPrice: option.theoreticalValue || option.mark || 0,
                bidPrice: option.bid || 0,
                askPrice: option.ask || 0,
                lastPrice: option.last || 0,
                volume: option.volume || 0,
                openInterest: option.openInterest || 0,
                
                // Additional metrics for Tom King strategies
                deltaPercent: Math.round((option.delta || 0) * 100 * 10) / 10,
                ivRank: option.ivRank || 0,
                ivPercentile: option.ivPercentile || 0,
                moneyness: Math.round((strikeData.strike - underlyingPrice) / underlyingPrice * 100 * 10) / 10,
                
                // Risk metrics
                gammaRisk: this.assessGammaRisk(option.gamma || 0, underlyingPrice),
                thetaDecay: option.theta ? Math.round(option.theta / (option.theoreticalValue || option.mark || 1) * 100 * 10) / 10 : 0,
                vegaRisk: this.assessVegaRisk(option.vega || 0, option.impliedVolatility || option.iv || 0.2),
                
                // Metadata
                strike: strikeData.strike,
                optionType: optionType,
                underlyingPrice: underlyingPrice,
                timestamp: new Date().toISOString(),
                source: 'TastyTrade_API'
            };
            
            return realGreeks;
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to extract Greeks from chain data', error);
            throw error;
        }
    }

    /**
     * Fetch Greeks for multiple positions (batch operation)
     */
    async fetchPortfolioGreeks(positions) {
        try {
            logger.info('GREEKS', `Fetching Greeks for ${positions.length} positions`);
            
            const greeksPromises = positions.map(async (position) => {
                try {
                    const greeks = await this.fetchRealGreeks(
                        position.symbol,
                        position.strike,
                        position.expiration,
                        position.optionType
                    );
                    
                    return {
                        ...position,
                        greeks: {
                            ...greeks,
                            quantity: position.quantity || 1,
                            multiplier: position.multiplier || 100
                        }
                    };
                } catch (error) {
                    logger.error('GREEKS', `Failed to fetch Greeks for position`, error);
                    return {
                        ...position,
                        greeks: this.getFallbackGreeks(
                            position.symbol,
                            position.strike,
                            position.expiration,
                            position.optionType
                        )
                    };
                }
            });
            
            const positionsWithGreeks = await Promise.all(greeksPromises);
            
            // Calculate aggregate portfolio Greeks
            this.portfolioGreeks = this.calculatePortfolioGreeks(positionsWithGreeks);
            this.positions = positionsWithGreeks;
            this.lastUpdate = new Date().toISOString();
            
            // Emit update event
            this.emit('portfolioGreeksUpdated', {
                portfolioGreeks: this.portfolioGreeks,
                positions: this.positions,
                timestamp: this.lastUpdate
            });
            
            // Check for alerts
            this.checkGreeksAlerts();
            
            logger.info('GREEKS', 'Portfolio Greeks updated', {
                positions: positions.length,
                totalDelta: this.portfolioGreeks.totalDelta,
                totalGamma: this.portfolioGreeks.totalGamma
            });
            
            return {
                portfolioGreeks: this.portfolioGreeks,
                positions: positionsWithGreeks,
                timestamp: this.lastUpdate
            };
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to fetch portfolio Greeks', error);
            throw error;
        }
    }

    /**
     * Calculate aggregated portfolio Greeks from positions
     */
    calculatePortfolioGreeks(positionsWithGreeks) {
        try {
            const portfolio = {
                totalDelta: 0,
                totalGamma: 0,
                totalTheta: 0,
                totalVega: 0,
                totalRho: 0,
                
                // Position-weighted Greeks
                weightedDelta: 0,
                weightedGamma: 0,
                weightedTheta: 0,
                weightedVega: 0,
                
                // Beta-weighted Greeks (SPY equivalent)
                betaWeightedDelta: 0,
                
                // Risk metrics
                portfolioValue: 0,
                portfolioBP: 0,
                
                // By correlation group
                correlationGroups: {},
                
                // Strategy breakdown
                strategies: {},
                
                // Risk assessments
                deltaNeutral: false,
                gammaRisk: 'LOW',
                thetaIncome: 0,
                vegaExposure: 'LOW',
                riskScore: 100,
                
                // Metadata
                positionCount: positionsWithGreeks.length,
                timestamp: new Date().toISOString()
            };
            
            // Process each position
            positionsWithGreeks.forEach(position => {
                if (!position.greeks) return;
                
                const greeks = position.greeks;
                const quantity = position.quantity || 1;
                const multiplier = position.multiplier || 100;
                const notional = quantity * multiplier;
                
                // Aggregate basic Greeks
                portfolio.totalDelta += greeks.delta * notional;
                portfolio.totalGamma += greeks.gamma * notional;
                portfolio.totalTheta += greeks.theta * notional;
                portfolio.totalVega += greeks.vega * notional;
                portfolio.totalRho += greeks.rho * notional;
                
                // Portfolio value
                const positionValue = greeks.theoreticalPrice * notional;
                portfolio.portfolioValue += positionValue;
                portfolio.portfolioBP += position.bpUsed || 0;
                
                // Weight Greeks by position value
                if (portfolio.portfolioValue > 0) {
                    const weight = positionValue / portfolio.portfolioValue;
                    portfolio.weightedDelta += greeks.delta * weight;
                    portfolio.weightedGamma += greeks.gamma * weight;
                    portfolio.weightedTheta += greeks.theta * weight;
                    portfolio.weightedVega += greeks.vega * weight;
                }
                
                // Beta adjustment (simplified - assume beta of 1 for now)
                portfolio.betaWeightedDelta += greeks.delta * notional * 1;
                
                // By correlation group
                const correlationGroup = position.correlationGroup || 'UNKNOWN';
                if (!portfolio.correlationGroups[correlationGroup]) {
                    portfolio.correlationGroups[correlationGroup] = {
                        delta: 0, gamma: 0, theta: 0, vega: 0,
                        positions: 0, value: 0
                    };
                }
                
                portfolio.correlationGroups[correlationGroup].delta += greeks.delta * notional;
                portfolio.correlationGroups[correlationGroup].gamma += greeks.gamma * notional;
                portfolio.correlationGroups[correlationGroup].theta += greeks.theta * notional;
                portfolio.correlationGroups[correlationGroup].vega += greeks.vega * notional;
                portfolio.correlationGroups[correlationGroup].positions += 1;
                portfolio.correlationGroups[correlationGroup].value += positionValue;
                
                // By strategy
                const strategy = position.strategy || 'UNKNOWN';
                if (!portfolio.strategies[strategy]) {
                    portfolio.strategies[strategy] = {
                        delta: 0, gamma: 0, theta: 0, vega: 0,
                        positions: 0, value: 0
                    };
                }
                
                portfolio.strategies[strategy].delta += greeks.delta * notional;
                portfolio.strategies[strategy].gamma += greeks.gamma * notional;
                portfolio.strategies[strategy].theta += greeks.theta * notional;
                portfolio.strategies[strategy].vega += greeks.vega * notional;
                portfolio.strategies[strategy].positions += 1;
                portfolio.strategies[strategy].value += positionValue;
            });
            
            // Calculate risk assessments
            portfolio.deltaNeutral = Math.abs(portfolio.totalDelta) < this.alerts.deltaNeutralThreshold;
            portfolio.gammaRisk = this.assessPortfolioGammaRisk(portfolio.totalGamma);
            portfolio.thetaIncome = Math.round(portfolio.totalTheta);
            portfolio.vegaExposure = this.assessPortfolioVegaRisk(portfolio.totalVega);
            portfolio.riskScore = this.calculatePortfolioRiskScore(portfolio);
            
            return portfolio;
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to calculate portfolio Greeks', error);
            throw error;
        }
    }

    /**
     * Get real-time Greeks updates via WebSocket (if supported)
     */
    async setupWebSocketSubscriptions() {
        try {
            if (!this.api.enableStreaming) {
                logger.warn('GREEKS', 'WebSocket streaming not available');
                return false;
            }
            
            // Enable streaming
            const streamingEnabled = await this.api.enableStreaming();
            if (!streamingEnabled) {
                logger.warn('GREEKS', 'Failed to enable streaming');
                return false;
            }
            
            // Subscribe to Greeks updates for active positions
            this.api.on('greeksUpdate', (data) => {
                this.handleWebSocketGreeksUpdate(data);
            });
            
            logger.info('GREEKS', 'WebSocket subscriptions setup complete');
            return true;
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to setup WebSocket subscriptions', error);
            return false;
        }
    }

    /**
     * Handle WebSocket Greeks updates
     */
    handleWebSocketGreeksUpdate(data) {
        try {
            if (!data || !data.symbol) return;
            
            const cacheKey = `${data.symbol}-${data.strike}-${data.expiration}-${data.optionType}`;
            
            // Update cache with real-time data
            this.greeksCache.set(cacheKey, {
                greeks: {
                    delta: data.delta,
                    gamma: data.gamma,
                    theta: data.theta,
                    vega: data.vega,
                    rho: data.rho,
                    impliedVolatility: data.iv,
                    theoreticalPrice: data.theoreticalValue,
                    timestamp: new Date().toISOString(),
                    source: 'WebSocket_Stream'
                },
                timestamp: Date.now()
            });
            
            // Emit real-time update
            this.emit('realTimeGreeksUpdate', {
                symbol: data.symbol,
                strike: data.strike,
                expiration: data.expiration,
                optionType: data.optionType,
                greeks: data
            });
            
            // Trigger portfolio recalculation if this position is in portfolio
            if (this.positions.some(p => 
                p.symbol === data.symbol && 
                p.strike === data.strike && 
                p.expiration === data.expiration
            )) {
                this.recalculatePortfolioGreeks();
            }
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to handle WebSocket Greeks update', error);
        }
    }

    /**
     * Recalculate portfolio Greeks with current cached data
     */
    async recalculatePortfolioGreeks() {
        if (!this.positions || this.positions.length === 0) return;
        
        try {
            // Update positions with latest Greeks from cache
            const updatedPositions = await Promise.all(
                this.positions.map(async (position) => {
                    const cacheKey = `${position.symbol}-${position.strike}-${position.expiration}-${position.optionType}`;
                    
                    if (this.greeksCache.has(cacheKey)) {
                        const cached = this.greeksCache.get(cacheKey);
                        return {
                            ...position,
                            greeks: cached.greeks
                        };
                    }
                    
                    return position;
                })
            );
            
            // Recalculate portfolio Greeks
            this.portfolioGreeks = this.calculatePortfolioGreeks(updatedPositions);
            this.positions = updatedPositions;
            this.lastUpdate = new Date().toISOString();
            
            // Emit update
            this.emit('portfolioGreeksUpdated', {
                portfolioGreeks: this.portfolioGreeks,
                positions: this.positions,
                timestamp: this.lastUpdate
            });
            
            // Check alerts
            this.checkGreeksAlerts();
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to recalculate portfolio Greeks', error);
        }
    }

    /**
     * Start periodic Greeks updates
     */
    startUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        this.updateTimer = setInterval(async () => {
            try {
                if (this.positions && this.positions.length > 0) {
                    await this.fetchPortfolioGreeks(this.positions);
                }
            } catch (error) {
                logger.error('GREEKS', 'Periodic update failed', error);
            }
        }, this.config.updateInterval);
        
        logger.info('GREEKS', `Periodic updates started (${this.config.updateInterval}ms)`);
    }

    /**
     * Stop periodic updates
     */
    stopUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            logger.info('GREEKS', 'Periodic updates stopped');
        }
    }

    /**
     * Check for Greeks-based alerts
     */
    checkGreeksAlerts() {
        if (!this.portfolioGreeks) return;
        
        const alerts = [];
        
        // Delta neutral check
        if (!this.portfolioGreeks.deltaNeutral) {
            alerts.push({
                type: 'DELTA_IMBALANCE',
                severity: 'WARNING',
                message: `Portfolio delta: ${this.portfolioGreeks.totalDelta.toFixed(0)} (threshold: ±${this.alerts.deltaNeutralThreshold})`,
                recommendation: 'Consider delta hedging'
            });
        }
        
        // Gamma risk check
        if (this.portfolioGreeks.gammaRisk === 'HIGH' || this.portfolioGreeks.gammaRisk === 'EXTREME') {
            alerts.push({
                type: 'GAMMA_RISK',
                severity: this.portfolioGreeks.gammaRisk === 'EXTREME' ? 'CRITICAL' : 'WARNING',
                message: `High gamma exposure: ${this.portfolioGreeks.totalGamma.toFixed(0)}`,
                recommendation: 'Monitor price movements closely'
            });
        }
        
        // Theta decay alert
        if (this.portfolioGreeks.totalTheta < this.alerts.thetaDecayAlert) {
            alerts.push({
                type: 'THETA_DECAY',
                severity: 'INFO',
                message: `Daily theta decay: £${Math.abs(this.portfolioGreeks.totalTheta).toFixed(0)}`,
                recommendation: 'Monitor time decay impact'
            });
        }
        
        // Vega exposure check
        if (Math.abs(this.portfolioGreeks.totalVega) > this.alerts.vegaExposureLimit) {
            alerts.push({
                type: 'VEGA_EXPOSURE',
                severity: 'WARNING',
                message: `High vega exposure: ${this.portfolioGreeks.totalVega.toFixed(0)}`,
                recommendation: 'Monitor volatility changes'
            });
        }
        
        // Emit alerts if any
        if (alerts.length > 0) {
            this.emit('greeksAlerts', {
                alerts,
                portfolioGreeks: this.portfolioGreeks,
                timestamp: new Date().toISOString()
            });
            
            logger.warn('GREEKS', `Greeks alerts triggered: ${alerts.length}`, {
                types: alerts.map(a => a.type)
            });
        }
    }

    /**
     * Tom King specific Greeks calculations
     */
    
    /**
     * Calculate 5-delta strikes for strangles using real Greeks
     */
    async calculateOptimalStrangleStrikes(symbol, expiration, targetDelta = 0.05) {
        try {
            const optionChain = await this.api.getOptionChain(symbol, expiration);
            
            if (!optionChain || !optionChain.expirations) {
                throw new Error(`No option chain data for ${symbol}`);
            }
            
            const targetExpiration = optionChain.expirations.find(exp => 
                exp.expiration === expiration
            );
            
            if (!targetExpiration) {
                throw new Error(`Expiration ${expiration} not found`);
            }
            
            // Find strikes closest to target delta
            let bestPutStrike = null;
            let bestCallStrike = null;
            let minPutDiff = Infinity;
            let minCallDiff = Infinity;
            
            targetExpiration.strikes.forEach(strike => {
                if (strike.put && strike.put.delta) {
                    const putDeltaDiff = Math.abs(Math.abs(strike.put.delta) - targetDelta);
                    if (putDeltaDiff < minPutDiff) {
                        minPutDiff = putDeltaDiff;
                        bestPutStrike = {
                            strike: strike.strike,
                            delta: strike.put.delta,
                            greeks: this.extractGreeksFromChain(strike, 'put', optionChain.underlyingPrice)
                        };
                    }
                }
                
                if (strike.call && strike.call.delta) {
                    const callDeltaDiff = Math.abs(strike.call.delta - targetDelta);
                    if (callDeltaDiff < minCallDiff) {
                        minCallDiff = callDeltaDiff;
                        bestCallStrike = {
                            strike: strike.strike,
                            delta: strike.call.delta,
                            greeks: this.extractGreeksFromChain(strike, 'call', optionChain.underlyingPrice)
                        };
                    }
                }
            });
            
            if (!bestPutStrike || !bestCallStrike) {
                throw new Error(`Could not find strikes with target delta ${targetDelta}`);
            }
            
            return {
                putStrike: bestPutStrike,
                callStrike: bestCallStrike,
                strangleWidth: bestCallStrike.strike - bestPutStrike.strike,
                combinedGreeks: {
                    delta: bestPutStrike.greeks.delta + bestCallStrike.greeks.delta,
                    gamma: bestPutStrike.greeks.gamma + bestCallStrike.greeks.gamma,
                    theta: bestPutStrike.greeks.theta + bestCallStrike.greeks.theta,
                    vega: bestPutStrike.greeks.vega + bestCallStrike.greeks.vega
                },
                underlyingPrice: optionChain.underlyingPrice,
                expiration: expiration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error('GREEKS', `Failed to calculate optimal strangle strikes for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Monitor 0DTE Greeks for rapid changes
     */
    async monitor0DTEGreeks(symbol, positions) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Filter 0DTE positions
            const zdtePositions = positions.filter(pos => 
                pos.expiration === today && pos.symbol === symbol
            );
            
            if (zdtePositions.length === 0) {
                return { hasZDTE: false };
            }
            
            // Fetch current Greeks for 0DTE positions
            const zdteGreeks = await Promise.all(
                zdtePositions.map(async (pos) => {
                    const greeks = await this.fetchRealGreeks(
                        pos.symbol, pos.strike, pos.expiration, pos.optionType
                    );
                    return { ...pos, greeks };
                })
            );
            
            // Calculate aggregate 0DTE Greeks
            const aggregate0DTE = this.calculatePortfolioGreeks(zdteGreeks);
            
            // Check for rapid decay and gamma risk
            const gammaDanger = Math.abs(aggregate0DTE.totalGamma) > 1000;
            const thetaBurn = aggregate0DTE.totalTheta < -50;
            const deltaShift = Math.abs(aggregate0DTE.totalDelta) > 100;
            
            return {
                hasZDTE: true,
                positions: zdtePositions.length,
                greeks: aggregate0DTE,
                warnings: {
                    gammaDanger,
                    thetaBurn,
                    deltaShift
                },
                recommendations: this.get0DTERecommendations(aggregate0DTE)
            };
            
        } catch (error) {
            logger.error('GREEKS', `Failed to monitor 0DTE Greeks for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get 0DTE-specific recommendations
     */
    get0DTERecommendations(greeks) {
        const recommendations = [];
        
        if (Math.abs(greeks.totalGamma) > 1000) {
            recommendations.push('HIGH GAMMA RISK: Monitor price movements closely');
        }
        
        if (greeks.totalTheta < -100) {
            recommendations.push('RAPID THETA DECAY: Time is working against positions');
        }
        
        if (!greeks.deltaNeutral) {
            recommendations.push(`DELTA IMBALANCE: ${greeks.totalDelta.toFixed(0)} deltas`);
        }
        
        if (recommendations.length === 0) {
            recommendations.push('0DTE Greeks within acceptable ranges');
        }
        
        return recommendations;
    }

    /**
     * Helper methods for risk assessment
     */
    assessGammaRisk(gamma, underlyingPrice) {
        const onePercentMove = underlyingPrice * 0.01;
        const gammaImpact = Math.abs(gamma * onePercentMove * onePercentMove);
        
        if (gammaImpact < 10) return 'LOW';
        if (gammaImpact < 50) return 'MEDIUM';
        if (gammaImpact < 150) return 'HIGH';
        return 'EXTREME';
    }

    assessVegaRisk(vega, currentIV) {
        const vegaImpact = Math.abs(vega);
        const ivMultiplier = currentIV > 0.3 ? 1.5 : 1;
        
        const adjustedRisk = vegaImpact * ivMultiplier;
        
        if (adjustedRisk < 20) return 'LOW';
        if (adjustedRisk < 60) return 'MEDIUM';
        if (adjustedRisk < 150) return 'HIGH';
        return 'EXTREME';
    }

    assessPortfolioGammaRisk(portfolioGamma) {
        const absGamma = Math.abs(portfolioGamma);
        
        if (absGamma < 100) return 'LOW';
        if (absGamma < 300) return 'MEDIUM';
        if (absGamma < 800) return 'HIGH';
        return 'EXTREME';
    }

    assessPortfolioVegaRisk(portfolioVega) {
        const absVega = Math.abs(portfolioVega);
        
        if (absVega < 500) return 'LOW';
        if (absVega < 1500) return 'MEDIUM';
        if (absVega < 4000) return 'HIGH';
        return 'EXTREME';
    }

    calculatePortfolioRiskScore(portfolio) {
        let score = 100;
        
        // Delta risk penalty
        const deltaRisk = Math.abs(portfolio.totalDelta);
        if (deltaRisk > 50) score -= Math.min(25, deltaRisk / 20);
        
        // Gamma risk penalty
        const gammaRisk = this.assessPortfolioGammaRisk(portfolio.totalGamma);
        if (gammaRisk === 'HIGH') score -= 20;
        if (gammaRisk === 'EXTREME') score -= 40;
        
        // Vega risk penalty
        const vegaRisk = this.assessPortfolioVegaRisk(portfolio.totalVega);
        if (vegaRisk === 'HIGH') score -= 15;
        if (vegaRisk === 'EXTREME') score -= 30;
        
        // Theta bonus (positive theta is good)
        if (portfolio.totalTheta > 0) {
            score += Math.min(15, portfolio.totalTheta / 50);
        }
        
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Fallback Greeks using Black-Scholes when API fails
     */
    getFallbackGreeks(symbol, strike, expiration, optionType) {
        try {
            // Use Black-Scholes calculator as fallback
            const timeToExpiry = this.calculateTimeToExpiry(expiration);
            const estimatedVolatility = 0.25; // 25% default IV
            const estimatedPrice = 100; // Default underlying price
            
            const fallbackGreeks = this.greeksCalculator.calculateGreeks({
                spotPrice: estimatedPrice,
                strikePrice: strike,
                timeToExpiry: timeToExpiry,
                volatility: estimatedVolatility,
                optionType: optionType
            });
            
            return {
                ...fallbackGreeks,
                strike: strike,
                optionType: optionType,
                timestamp: new Date().toISOString(),
                source: 'Black_Scholes_Fallback'
            };
            
        } catch (error) {
            logger.error('GREEKS', 'Failed to calculate fallback Greeks', error);
            return {
                delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0,
                theoreticalPrice: 0, source: 'ERROR_FALLBACK'
            };
        }
    }

    calculateTimeToExpiry(expiration) {
        const now = new Date();
        const expDate = new Date(expiration);
        const diffMs = expDate.getTime() - now.getTime();
        return Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365));
    }

    /**
     * Public API methods
     */
    
    async updatePositions(positions) {
        return await this.fetchPortfolioGreeks(positions);
    }

    getPortfolioGreeks() {
        return this.portfolioGreeks;
    }

    getCachedGreeks(symbol, strike, expiration, optionType) {
        const cacheKey = `${symbol}-${strike}-${expiration}-${optionType}`;
        return this.greeksCache.get(cacheKey);
    }

    clearCache() {
        this.greeksCache.clear();
        logger.info('GREEKS', 'Greeks cache cleared');
    }

    /**
     * Cleanup
     */
    async shutdown() {
        try {
            this.stopUpdates();
            this.clearCache();
            
            if (this.api && this.api.disableStreaming) {
                await this.api.disableStreaming();
            }
            
            this.removeAllListeners();
            
            logger.info('GREEKS', 'Real Greeks Manager shutdown complete');
            
        } catch (error) {
            logger.error('GREEKS', 'Error during shutdown', error);
        }
    }
}

module.exports = RealGreeksManager;