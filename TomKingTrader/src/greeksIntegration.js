/**
 * Greeks Integration Module
 * Integrates real Greeks data with Tom King Trading Framework risk management
 */

const RealGreeksManager = require('./realGreeksManager');
const { getLogger } = require('./logger');
const EventEmitter = require('events');

const logger = getLogger();

class GreeksIntegration extends EventEmitter {
    constructor(tomKingTrader, options = {}) {
        super();
        this.trader = tomKingTrader;
        this.greeksManager = null;
        
        // Configuration
        this.config = {
            enableRealTimeUpdates: options.enableRealTimeUpdates !== false,
            updateInterval: options.updateInterval || 30000,
            riskThresholds: {
                deltaNeutralRange: 50,
                gammaRiskLimit: 500,
                thetaDecayAlert: -100,
                vegaExposureLimit: 2000,
                ...options.riskThresholds
            },
            tomKingSpecific: {
                enable5DeltaTracking: true,
                enable0DTEMonitoring: true,
                enableStrangleOptimization: true,
                enableLT112Greeks: true,
                ...options.tomKingSpecific
            }
        };
        
        // State tracking
        this.lastGreeksUpdate = null;
        this.currentAlerts = [];
        this.greeksHistory = [];
        
        logger.info('GREEKS_INTEGRATION', 'Greeks integration initialized', {
            realTimeUpdates: this.config.enableRealTimeUpdates,
            updateInterval: this.config.updateInterval
        });
    }

    /**
     * Initialize Greeks integration with the trading framework
     */
    async initialize() {
        try {
            logger.info('GREEKS_INTEGRATION', 'Starting Greeks integration');
            
            if (!this.trader || !this.trader.api) {
                throw new Error('Tom King Trader instance with API required');
            }
            
            // Initialize Real Greeks Manager
            this.greeksManager = new RealGreeksManager(this.trader.api, {
                updateInterval: this.config.updateInterval,
                enableStreaming: this.config.enableRealTimeUpdates,
                enableWebSocket: true,
                correlationGroupTracking: true
            });
            
            await this.greeksManager.initialize();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Initial Greeks fetch if positions exist
            if (this.trader.positions && this.trader.positions.length > 0) {
                await this.updatePortfolioGreeks();
            }
            
            logger.info('GREEKS_INTEGRATION', 'Greeks integration initialized successfully');
            return true;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to initialize Greeks integration', error);
            throw error;
        }
    }

    /**
     * Setup event handlers for Greeks updates and alerts
     */
    setupEventHandlers() {
        // Portfolio Greeks updates
        this.greeksManager.on('portfolioGreeksUpdated', (data) => {
            this.handlePortfolioGreeksUpdate(data);
        });
        
        // Real-time Greeks updates
        this.greeksManager.on('realTimeGreeksUpdate', (data) => {
            this.handleRealTimeGreeksUpdate(data);
        });
        
        // Greeks alerts
        this.greeksManager.on('greeksAlerts', (data) => {
            this.handleGreeksAlerts(data);
        });
        
        // Framework position updates
        if (this.trader.on) {
            this.trader.on('positionsUpdated', async (positions) => {
                await this.updatePortfolioGreeks();
            });
        }
        
        logger.debug('GREEKS_INTEGRATION', 'Event handlers setup complete');
    }

    /**
     * Update portfolio Greeks when positions change
     */
    async updatePortfolioGreeks() {
        try {
            if (!this.greeksManager) {
                logger.warn('GREEKS_INTEGRATION', 'Greeks manager not initialized');
                return null;
            }
            
            const positions = this.trader.positions || [];
            if (positions.length === 0) {
                logger.debug('GREEKS_INTEGRATION', 'No positions to update Greeks for');
                return null;
            }
            
            logger.info('GREEKS_INTEGRATION', `Updating Greeks for ${positions.length} positions`);
            
            // Convert Tom King positions to Greeks format
            const greeksPositions = this.convertPositionsForGreeks(positions);
            
            // Fetch real Greeks
            const result = await this.greeksManager.fetchPortfolioGreeks(greeksPositions);
            
            // Integrate with Tom King risk management
            await this.integrateWithRiskManagement(result);
            
            this.lastGreeksUpdate = new Date().toISOString();
            
            return result;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to update portfolio Greeks', error);
            throw error;
        }
    }

    /**
     * Convert Tom King positions to Greeks manager format
     */
    convertPositionsForGreeks(positions) {
        return positions.map(position => ({
            symbol: position.symbol,
            strike: position.strike,
            expiration: position.expiration,
            optionType: position.optionType || (position.type === 'Call' ? 'call' : 'put'),
            quantity: position.quantity || 1,
            multiplier: position.multiplier || 100,
            strategy: position.strategy,
            correlationGroup: position.correlationGroup,
            bpUsed: position.bpUsed || 0,
            originalPosition: position
        }));
    }

    /**
     * Handle portfolio Greeks updates
     */
    async handlePortfolioGreeksUpdate(data) {
        try {
            logger.info('GREEKS_INTEGRATION', 'Portfolio Greeks updated', {
                totalDelta: data.portfolioGreeks.totalDelta.toFixed(0),
                totalGamma: data.portfolioGreeks.totalGamma.toFixed(0),
                riskScore: data.portfolioGreeks.riskScore
            });
            
            // Store Greeks history
            this.greeksHistory.push({
                timestamp: data.timestamp,
                greeks: { ...data.portfolioGreeks },
                positionCount: data.positions.length
            });
            
            // Keep only last 100 entries
            if (this.greeksHistory.length > 100) {
                this.greeksHistory = this.greeksHistory.slice(-100);
            }
            
            // Emit to Tom King framework
            this.emit('greeksUpdated', {
                portfolioGreeks: data.portfolioGreeks,
                positions: data.positions,
                timestamp: data.timestamp,
                source: 'real_api_greeks'
            });
            
            // Tom King specific analysis
            await this.performTomKingGreeksAnalysis(data);
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to handle portfolio Greeks update', error);
        }
    }

    /**
     * Handle real-time Greeks updates
     */
    handleRealTimeGreeksUpdate(data) {
        try {
            logger.debug('GREEKS_INTEGRATION', 'Real-time Greeks update received', {
                symbol: data.symbol,
                strike: data.strike,
                delta: data.greeks.delta
            });
            
            // Emit to framework for real-time dashboard updates
            this.emit('realTimeGreeksUpdate', data);
            
            // Check for immediate alerts
            this.checkRealTimeAlerts(data);
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to handle real-time Greeks update', error);
        }
    }

    /**
     * Handle Greeks alerts
     */
    handleGreeksAlerts(data) {
        try {
            logger.warn('GREEKS_INTEGRATION', `Greeks alerts triggered: ${data.alerts.length}`, {
                types: data.alerts.map(a => a.type)
            });
            
            this.currentAlerts = data.alerts;
            
            // Emit to Tom King framework for alert handling
            this.emit('greeksAlerts', {
                alerts: data.alerts,
                portfolioGreeks: data.portfolioGreeks,
                timestamp: data.timestamp,
                severity: this.calculateAlertSeverity(data.alerts)
            });
            
            // Tom King specific alert actions
            this.handleTomKingAlerts(data.alerts);
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to handle Greeks alerts', error);
        }
    }

    /**
     * Integrate Greeks data with Tom King risk management
     */
    async integrateWithRiskManagement(greeksData) {
        try {
            if (!this.trader.riskManager) {
                logger.warn('GREEKS_INTEGRATION', 'Risk manager not available for integration');
                return;
            }
            
            const riskUpdates = {
                portfolioDelta: greeksData.portfolioGreeks.totalDelta,
                portfolioGamma: greeksData.portfolioGreeks.totalGamma,
                portfolioTheta: greeksData.portfolioGreeks.totalTheta,
                portfolioVega: greeksData.portfolioGreeks.totalVega,
                deltaNeutral: greeksData.portfolioGreeks.deltaNeutral,
                gammaRisk: greeksData.portfolioGreeks.gammaRisk,
                vegaExposure: greeksData.portfolioGreeks.vegaExposure,
                riskScore: greeksData.portfolioGreeks.riskScore,
                correlationGreeks: greeksData.portfolioGreeks.correlationGroups,
                strategyGreeks: greeksData.portfolioGreeks.strategies
            };
            
            // Update risk manager with Greeks data
            if (this.trader.riskManager.updateGreeksData) {
                await this.trader.riskManager.updateGreeksData(riskUpdates);
            }
            
            // Check position limits with Greeks consideration
            if (this.trader.riskManager.checkGreeksLimits) {
                const limitsCheck = await this.trader.riskManager.checkGreeksLimits(riskUpdates);
                
                if (!limitsCheck.withinLimits) {
                    this.emit('greeksLimitViolation', {
                        violations: limitsCheck.violations,
                        recommendations: limitsCheck.recommendations,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to integrate with risk management', error);
        }
    }

    /**
     * Tom King specific Greeks analysis
     */
    async performTomKingGreeksAnalysis(data) {
        try {
            const analysis = {
                timestamp: new Date().toISOString(),
                strategies: {},
                alerts: [],
                recommendations: []
            };
            
            // Analyze by strategy
            for (const [strategy, greeks] of Object.entries(data.portfolioGreeks.strategies)) {
                analysis.strategies[strategy] = await this.analyzeStrategyGreeks(strategy, greeks);
            }
            
            // 5-delta tracking for strangles
            if (this.config.tomKingSpecific.enable5DeltaTracking) {
                analysis.fiveDeltaTracking = await this.track5DeltaStrategies(data.positions);
            }
            
            // 0DTE monitoring
            if (this.config.tomKingSpecific.enable0DTEMonitoring) {
                analysis.zdteMonitoring = await this.monitor0DTEGreeks(data.positions);
            }
            
            // LT112 Greeks optimization
            if (this.config.tomKingSpecific.enableLT112Greeks) {
                analysis.lt112Analysis = await this.analyzeLT112Greeks(data.positions);
            }
            
            // Emit Tom King specific analysis
            this.emit('tomKingGreeksAnalysis', analysis);
            
            return analysis;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to perform Tom King Greeks analysis', error);
            return null;
        }
    }

    /**
     * Analyze Greeks for specific strategy
     */
    async analyzeStrategyGreeks(strategy, greeks) {
        try {
            const analysis = {
                strategy: strategy,
                greeks: greeks,
                health: 'GOOD',
                issues: [],
                recommendations: []
            };
            
            switch (strategy.toUpperCase()) {
                case 'STRANGLE':
                    // Strangles should be delta neutral
                    if (Math.abs(greeks.delta) > 10) {
                        analysis.health = 'WARNING';
                        analysis.issues.push(`Delta imbalance: ${greeks.delta.toFixed(0)}`);
                        analysis.recommendations.push('Consider delta hedging');
                    }
                    
                    // High gamma is risky for strangles
                    if (Math.abs(greeks.gamma) > 300) {
                        analysis.health = 'CAUTION';
                        analysis.issues.push(`High gamma risk: ${greeks.gamma.toFixed(0)}`);
                        analysis.recommendations.push('Monitor price movements closely');
                    }
                    break;
                    
                case '0DTE':
                    // 0DTE should have rapid theta decay
                    if (greeks.theta > -50) {
                        analysis.health = 'WARNING';
                        analysis.issues.push(`Low theta decay: ${greeks.theta.toFixed(0)}`);
                        analysis.recommendations.push('Time decay may be insufficient');
                    }
                    
                    // High gamma is expected but dangerous
                    if (Math.abs(greeks.gamma) > 1000) {
                        analysis.health = 'CRITICAL';
                        analysis.issues.push(`Extreme gamma: ${greeks.gamma.toFixed(0)}`);
                        analysis.recommendations.push('Consider reducing position size');
                    }
                    break;
                    
                case 'LT112':
                    // LT112 should have positive theta
                    if (greeks.theta < 10) {
                        analysis.health = 'WARNING';
                        analysis.issues.push(`Insufficient theta income: ${greeks.theta.toFixed(0)}`);
                        analysis.recommendations.push('Review strike selection');
                    }
                    break;
            }
            
            return analysis;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', `Failed to analyze ${strategy} Greeks`, error);
            return { strategy, health: 'ERROR', issues: [error.message] };
        }
    }

    /**
     * Track 5-delta strategies
     */
    async track5DeltaStrategies(positions) {
        try {
            const fiveDeltaPositions = positions.filter(pos => 
                pos.strategy === 'STRANGLE' && Math.abs(pos.greeks?.delta || 0) <= 0.1
            );
            
            if (fiveDeltaPositions.length === 0) {
                return { count: 0, analysis: 'No 5-delta strategies detected' };
            }
            
            const analysis = {
                count: fiveDeltaPositions.length,
                totalDelta: 0,
                totalGamma: 0,
                positions: []
            };
            
            for (const position of fiveDeltaPositions) {
                if (position.greeks) {
                    analysis.totalDelta += position.greeks.delta * (position.quantity || 1) * (position.multiplier || 100);
                    analysis.totalGamma += position.greeks.gamma * (position.quantity || 1) * (position.multiplier || 100);
                    
                    analysis.positions.push({
                        symbol: position.symbol,
                        expiration: position.expiration,
                        delta: position.greeks.delta,
                        actualDelta: Math.abs(position.greeks.delta),
                        deviation: Math.abs(Math.abs(position.greeks.delta) - 0.05),
                        status: Math.abs(position.greeks.delta) <= 0.07 ? 'GOOD' : 'DRIFT'
                    });
                }
            }
            
            analysis.avgDelta = analysis.totalDelta / fiveDeltaPositions.length;
            analysis.health = analysis.positions.every(p => p.status === 'GOOD') ? 'GOOD' : 'NEEDS_ADJUSTMENT';
            
            return analysis;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to track 5-delta strategies', error);
            return { count: 0, error: error.message };
        }
    }

    /**
     * Monitor 0DTE Greeks
     */
    async monitor0DTEGreeks(positions) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const zdtePositions = positions.filter(pos => pos.expiration === today);
            
            if (zdtePositions.length === 0) {
                return { hasZDTE: false };
            }
            
            return await this.greeksManager.monitor0DTEGreeks(
                zdtePositions[0].symbol, 
                zdtePositions
            );
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to monitor 0DTE Greeks', error);
            return { hasZDTE: false, error: error.message };
        }
    }

    /**
     * Analyze LT112 Greeks
     */
    async analyzeLT112Greeks(positions) {
        try {
            const lt112Positions = positions.filter(pos => 
                pos.strategy === 'LT112' || (pos.dte && pos.dte >= 100 && pos.dte <= 130)
            );
            
            if (lt112Positions.length === 0) {
                return { count: 0, analysis: 'No LT112 positions detected' };
            }
            
            const analysis = {
                count: lt112Positions.length,
                totalTheta: 0,
                avgTheta: 0,
                positions: []
            };
            
            lt112Positions.forEach(position => {
                if (position.greeks) {
                    const positionTheta = position.greeks.theta * (position.quantity || 1) * (position.multiplier || 100);
                    analysis.totalTheta += positionTheta;
                    
                    analysis.positions.push({
                        symbol: position.symbol,
                        expiration: position.expiration,
                        theta: position.greeks.theta,
                        dailyIncome: Math.round(positionTheta),
                        health: positionTheta > 5 ? 'GOOD' : 'LOW'
                    });
                }
            });
            
            analysis.avgTheta = analysis.totalTheta / lt112Positions.length;
            analysis.dailyIncomeTotal = Math.round(analysis.totalTheta);
            analysis.monthlyProjection = Math.round(analysis.totalTheta * 22); // 22 trading days
            
            return analysis;
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to analyze LT112 Greeks', error);
            return { count: 0, error: error.message };
        }
    }

    /**
     * Tom King specific alert handling
     */
    handleTomKingAlerts(alerts) {
        try {
            alerts.forEach(alert => {
                switch (alert.type) {
                    case 'DELTA_IMBALANCE':
                        if (this.trader.riskManager && this.trader.riskManager.suggestDeltaHedge) {
                            this.trader.riskManager.suggestDeltaHedge();
                        }
                        break;
                        
                    case 'GAMMA_RISK':
                        if (alert.severity === 'CRITICAL' && this.trader.riskManager) {
                            // Suggest position size reduction
                            logger.warn('GREEKS_INTEGRATION', 'CRITICAL gamma risk - consider position reduction');
                        }
                        break;
                        
                    case 'VEGA_EXPOSURE':
                        // Monitor for volatility changes
                        logger.info('GREEKS_INTEGRATION', 'High vega exposure - monitoring volatility');
                        break;
                }
            });
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to handle Tom King alerts', error);
        }
    }

    /**
     * Check real-time alerts for immediate action
     */
    checkRealTimeAlerts(data) {
        try {
            const alerts = [];
            
            // Check for rapid Greeks changes
            if (data.greeks && this.lastGreeksUpdate) {
                const deltaChange = Math.abs(data.greeks.delta) > 0.1 ? 'HIGH' : 'NORMAL';
                const gammaChange = Math.abs(data.greeks.gamma) > 2.0 ? 'HIGH' : 'NORMAL';
                
                if (deltaChange === 'HIGH' || gammaChange === 'HIGH') {
                    alerts.push({
                        type: 'RAPID_GREEKS_CHANGE',
                        symbol: data.symbol,
                        change: { deltaChange, gammaChange },
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            if (alerts.length > 0) {
                this.emit('realTimeGreeksAlerts', alerts);
            }
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Failed to check real-time alerts', error);
        }
    }

    /**
     * Calculate alert severity
     */
    calculateAlertSeverity(alerts) {
        if (alerts.some(a => a.severity === 'CRITICAL')) return 'CRITICAL';
        if (alerts.some(a => a.severity === 'WARNING')) return 'WARNING';
        return 'INFO';
    }

    /**
     * Public API methods
     */
    
    /**
     * Get current portfolio Greeks
     */
    getPortfolioGreeks() {
        return this.greeksManager ? this.greeksManager.getPortfolioGreeks() : null;
    }

    /**
     * Get Greeks for specific option
     */
    async getOptionGreeks(symbol, strike, expiration, optionType) {
        if (!this.greeksManager) {
            throw new Error('Greeks manager not initialized');
        }
        return await this.greeksManager.fetchRealGreeks(symbol, strike, expiration, optionType);
    }

    /**
     * Get 5-delta strikes for strangle
     */
    async get5DeltaStrikes(symbol, expiration) {
        if (!this.trader.api || !this.trader.api.calculate5DeltaStrikes) {
            throw new Error('API with 5-delta calculation not available');
        }
        return await this.trader.api.calculate5DeltaStrikes(symbol, expiration);
    }

    /**
     * Get Greeks history
     */
    getGreeksHistory(limit = 50) {
        return this.greeksHistory.slice(-limit);
    }

    /**
     * Get current alerts
     */
    getCurrentAlerts() {
        return this.currentAlerts;
    }

    /**
     * Force Greeks update
     */
    async forceGreeksUpdate() {
        return await this.updatePortfolioGreeks();
    }

    /**
     * Shutdown integration
     */
    async shutdown() {
        try {
            if (this.greeksManager) {
                await this.greeksManager.shutdown();
            }
            
            this.removeAllListeners();
            
            logger.info('GREEKS_INTEGRATION', 'Greeks integration shutdown complete');
            
        } catch (error) {
            logger.error('GREEKS_INTEGRATION', 'Error during shutdown', error);
        }
    }
}

module.exports = GreeksIntegration;