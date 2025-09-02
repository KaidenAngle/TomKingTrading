/**
 * UNIFIED TRADING ENGINE v17
 * Single source of truth for both backtesting and live trading
 * Ensures exact same logic is used in both environments
 * 
 * CRITICAL REQUIREMENT: What you backtest is exactly what runs in production
 * 
 * Features:
 * - Mode-based execution: 'backtest', 'paper', 'live'
 * - Same strategy logic across all modes
 * - Unified data abstraction layer
 * - Identical risk management and position sizing
 * - Single entry/exit logic implementation
 */

const { EnhancedPatternAnalyzer } = require('./src/enhancedPatternAnalysis');
const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');
const OrderManager = require('./src/orderManager');
const { RiskManager } = require('./src/riskManager');
const { TastyTradeAPI } = require('./src/tastytradeAPI');
const GreeksCalculator = require('./src/greeksCalculator');
const { getLogger } = require('./src/logger');

const logger = getLogger();

/**
 * Unified Trading Engine Class
 * Single system for backtesting, paper trading, and live execution
 */
class UnifiedTradingEngine {
    constructor(mode = 'backtest', options = {}) {
        // Validate mode
        const validModes = ['backtest', 'paper', 'live'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
        }
        
        this.mode = mode;
        this.options = {
            initialCapital: 30000, // £30k Phase 1 start
            maxBPUsage: 0.35,      // 35% max buying power
            correlationLimit: 3,    // Max 3 positions per correlation group
            commissions: 2.50,     // Per contract
            slippage: 0.02,        // 2% slippage estimate
            ...options
        };
        
        // Initialize core components - SAME for all modes
        this.patternAnalysis = new EnhancedPatternAnalyzer();
        this.recommendationEngine = new EnhancedRecommendationEngine();
        this.riskManager = new RiskManager();
        this.greeksCalculator = new GreeksCalculator();
        this.api = new TastyTradeAPI();
        
        // Order manager initialization depends on mode
        if (mode === 'live') {
            this.orderManager = new OrderManager(this.api);
        } else {
            // For backtest and paper, create mock order manager
            this.orderManager = new MockOrderManager(this.api);
        }
        
        // Trading state - SAME structure for all modes
        this.portfolio = {
            cash: this.options.initialCapital,
            positions: new Map(),
            openOrders: new Map(),
            totalValue: this.options.initialCapital,
            buyingPower: this.options.initialCapital,
            dayTradeCount: 0,
            unrealizedPnL: 0,
            realizedPnL: 0
        };
        
        // Correlation tracking - SAME for all modes
        this.correlationGroups = new Map();
        this.positionHistory = [];
        this.tradeHistory = [];
        
        // Current market data cache
        this.marketDataCache = new Map();
        this.lastUpdate = null;
        
        logger.info('UNIFIED_ENGINE', `Initialized in ${mode} mode`, this.options);
    }
    
    /**
     * UNIFIED DATA ABSTRACTION LAYER
     * Same interface, different data sources based on mode
     */
    async getMarketData(symbol, date = null) {
        try {
            if (this.mode === 'backtest') {
                // Historical data for backtesting
                return await this.api.getHistoricalData(symbol, date);
            } else if (this.mode === 'paper' || this.mode === 'live') {
                // Real-time data for paper and live trading
                return await this.api.getLiveData(symbol);
            }
        } catch (error) {
            logger.error('UNIFIED_ENGINE', `Failed to get market data for ${symbol}`, error);
            throw error;
        }
    }
    
    /**
     * Get option chain data with unified interface
     */
    async getOptionChain(underlying, expiration = null, date = null) {
        try {
            if (this.mode === 'backtest') {
                return await this.api.getHistoricalOptionChain(underlying, expiration, date);
            } else {
                return await this.api.getOptionChain(underlying, expiration);
            }
        } catch (error) {
            logger.error('UNIFIED_ENGINE', `Failed to get option chain for ${underlying}`, error);
            throw error;
        }
    }
    
    /**
     * UNIFIED SIGNAL EVALUATION
     * Exact same recommendation engine for all modes
     */
    async evaluateSignals(marketData, date = null) {
        try {
            // Pattern analysis - SAME for all modes
            const patternResults = await this.patternAnalysis.analyzePatterns(marketData);
            
            // Get recommendation signals - SAME logic
            const signals = await this.recommendationEngine.analyzeSymbol(
                marketData.symbol, 
                marketData, 
                { date: date || new Date() }
            );
            
            // Combine pattern and recommendation signals
            return {
                ...signals,
                patterns: patternResults,
                timestamp: date || new Date(),
                mode: this.mode
            };
        } catch (error) {
            logger.error('UNIFIED_ENGINE', 'Signal evaluation failed', error);
            throw error;
        }
    }
    
    /**
     * UNIFIED RISK VALIDATION
     * Exact same risk management for all modes
     */
    async validateTrade(signal, marketData) {
        try {
            // Portfolio risk check - SAME for all modes
            const portfolioRisk = this.riskManager.validatePortfolioRisk(
                this.portfolio, 
                signal, 
                this.options
            );
            
            // Correlation check - SAME for all modes
            const correlationRisk = this.riskManager.validateCorrelation(
                signal, 
                Array.from(this.portfolio.positions.values()),
                this.options.correlationLimit
            );
            
            // Buying power check - SAME for all modes
            const bpRisk = this.riskManager.validateBuyingPower(
                this.portfolio.buyingPower,
                signal.estimatedCost || signal.marginRequirement,
                this.options.maxBPUsage
            );
            
            // VIX regime check - SAME for all modes
            const vixRisk = this.riskManager.validateVIXRegime(
                marketData.vix || marketData.volatility,
                signal
            );
            
            return {
                passed: portfolioRisk.passed && correlationRisk.passed && bpRisk.passed && vixRisk.passed,
                portfolio: portfolioRisk,
                correlation: correlationRisk,
                buyingPower: bpRisk,
                vixRegime: vixRisk,
                combinedScore: (portfolioRisk.score + correlationRisk.score + bpRisk.score + vixRisk.score) / 4
            };
        } catch (error) {
            logger.error('UNIFIED_ENGINE', 'Risk validation failed', error);
            return { passed: false, error: error.message };
        }
    }
    
    /**
     * UNIFIED STRATEGY EXECUTION
     * Same execution logic for all modes - only execution mechanism differs
     */
    async executeStrategy(strategyName, signal, marketData, date = null) {
        try {
            logger.info('UNIFIED_ENGINE', `Executing ${strategyName} strategy`, {
                mode: this.mode,
                symbol: signal.symbol,
                action: signal.action
            });
            
            // Risk validation - SAME for all modes
            const riskCheck = await this.validateTrade(signal, marketData);
            if (!riskCheck.passed) {
                logger.warn('UNIFIED_ENGINE', 'Trade failed risk validation', riskCheck);
                return {
                    success: false,
                    reason: 'RISK_REJECTION',
                    details: riskCheck
                };
            }
            
            // Greeks calculation if options trade - SAME for all modes
            let greeksData = null;
            if (signal.instrumentType === 'option') {
                greeksData = await this.greeksCalculator.calculateGreeks(
                    signal.underlying,
                    signal.strike,
                    signal.expiration,
                    marketData.price,
                    marketData.volatility || 0.2,
                    0.05 // risk-free rate
                );
            }
            
            // Execute based on mode
            let executionResult;
            if (this.mode === 'backtest') {
                executionResult = await this.executeBacktestTrade(signal, marketData, date);
            } else if (this.mode === 'paper') {
                executionResult = await this.executePaperTrade(signal, marketData);
            } else if (this.mode === 'live') {
                executionResult = await this.executeLiveTrade(signal, marketData);
            }
            
            // Update portfolio state - SAME for all modes
            if (executionResult.success) {
                await this.updatePortfolio(signal, executionResult, greeksData, date);
                
                // Update correlation tracking - SAME for all modes
                this.updateCorrelationGroups(signal);
                
                // Record trade history - SAME for all modes
                this.recordTrade(strategyName, signal, executionResult, marketData, date);
            }
            
            return {
                success: executionResult.success,
                execution: executionResult,
                risk: riskCheck,
                greeks: greeksData,
                portfolio: this.getPortfolioSummary(),
                timestamp: date || new Date()
            };
            
        } catch (error) {
            logger.error('UNIFIED_ENGINE', `Strategy execution failed for ${strategyName}`, error);
            throw error;
        }
    }
    
    /**
     * BACKTEST EXECUTION
     * Simulated execution with historical data
     */
    async executeBacktestTrade(signal, marketData, date) {
        try {
            // Simulate order execution with historical data
            const fillPrice = this.calculateBacktestFillPrice(signal, marketData);
            const commission = this.options.commissions;
            
            // Apply slippage
            const slippageAdjustment = fillPrice * this.options.slippage * (signal.action === 'BUY' ? 1 : -1);
            const adjustedFillPrice = fillPrice + slippageAdjustment;
            
            return {
                success: true,
                orderId: `backtest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fillPrice: adjustedFillPrice,
                fillQuantity: signal.quantity,
                commission: commission,
                executionTime: date || new Date(),
                mode: 'backtest'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                mode: 'backtest'
            };
        }
    }
    
    /**
     * PAPER TRADING EXECUTION
     * Real-time data but simulated execution
     */
    async executePaperTrade(signal, marketData) {
        try {
            // Use real market data but simulate execution
            const fillPrice = marketData.bid && marketData.ask ? 
                (marketData.bid + marketData.ask) / 2 : marketData.price;
            
            return {
                success: true,
                orderId: `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fillPrice: fillPrice,
                fillQuantity: signal.quantity,
                commission: this.options.commissions,
                executionTime: new Date(),
                mode: 'paper'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                mode: 'paper'
            };
        }
    }
    
    /**
     * LIVE EXECUTION
     * Real market execution through TastyTrade API
     */
    async executeLiveTrade(signal, marketData) {
        try {
            // Create and submit real order through API
            const order = await this.orderManager.createOrder(signal);
            const result = await this.orderManager.submitOrder(order);
            
            return {
                success: result.success,
                orderId: result.orderId,
                fillPrice: result.fillPrice,
                fillQuantity: result.fillQuantity,
                commission: result.commission,
                executionTime: new Date(),
                mode: 'live'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                mode: 'live'
            };
        }
    }
    
    /**
     * UNIFIED PORTFOLIO UPDATE
     * Same portfolio management logic for all modes
     */
    async updatePortfolio(signal, execution, greeksData, date) {
        const position = {
            symbol: signal.symbol,
            quantity: execution.fillQuantity * (signal.action === 'BUY' ? 1 : -1),
            avgPrice: execution.fillPrice,
            marketValue: execution.fillPrice * execution.fillQuantity,
            unrealizedPnL: 0,
            openDate: date || new Date(),
            greeks: greeksData,
            strategy: signal.strategy,
            correlationGroup: signal.correlationGroup
        };
        
        // Update or create position
        const existingPosition = this.portfolio.positions.get(signal.symbol);
        if (existingPosition) {
            // Update existing position
            const totalQuantity = existingPosition.quantity + position.quantity;
            const totalCost = (existingPosition.avgPrice * existingPosition.quantity) + 
                            (position.avgPrice * position.quantity);
            
            existingPosition.quantity = totalQuantity;
            existingPosition.avgPrice = totalQuantity !== 0 ? totalCost / totalQuantity : 0;
            existingPosition.marketValue = existingPosition.quantity * execution.fillPrice;
            
            if (totalQuantity === 0) {
                // Position closed
                this.portfolio.positions.delete(signal.symbol);
            }
        } else {
            // New position
            this.portfolio.positions.set(signal.symbol, position);
        }
        
        // Update portfolio totals
        this.portfolio.cash -= (execution.fillPrice * execution.fillQuantity + execution.commission);
        this.portfolio.realizedPnL -= execution.commission; // Commission reduces realized P&L
        
        // Recalculate portfolio value
        await this.recalculatePortfolioValue();
    }
    
    /**
     * UNIFIED EXIT SIGNAL EVALUATION
     * Same exit logic for all modes
     */
    async evaluateExitSignals(date = null) {
        const exitSignals = [];
        
        for (const [symbol, position] of this.portfolio.positions) {
            try {
                // Get current market data
                const marketData = await this.getMarketData(symbol, date);
                
                // Calculate current P&L
                const currentPnL = (marketData.price - position.avgPrice) * position.quantity;
                const pnlPercent = currentPnL / (position.avgPrice * Math.abs(position.quantity));
                
                // Strategy-specific exit rules
                const exitSignal = await this.evaluateStrategyExit(position, marketData, pnlPercent, date);
                
                if (exitSignal.shouldExit) {
                    exitSignals.push({
                        symbol: symbol,
                        position: position,
                        reason: exitSignal.reason,
                        urgency: exitSignal.urgency,
                        marketData: marketData,
                        pnlPercent: pnlPercent
                    });
                }
            } catch (error) {
                logger.error('UNIFIED_ENGINE', `Failed to evaluate exit for ${symbol}`, error);
            }
        }
        
        return exitSignals;
    }
    
    /**
     * Strategy-specific exit evaluation
     */
    async evaluateStrategyExit(position, marketData, pnlPercent, date) {
        const strategy = position.strategy;
        const daysHeld = date ? 
            Math.floor((new Date(date) - new Date(position.openDate)) / (1000 * 60 * 60 * 24)) :
            Math.floor((new Date() - new Date(position.openDate)) / (1000 * 60 * 60 * 24));
        
        switch (strategy) {
            case '0DTE':
                // Friday 0DTE - time-based exits
                if (date) {
                    const hour = new Date(date).getHours();
                    if (hour >= 15.5) { // 3:30 PM EST
                        return { shouldExit: true, reason: 'TIME_STOP', urgency: 'HIGH' };
                    }
                }
                if (pnlPercent <= -2.0) { // 200% of credit
                    return { shouldExit: true, reason: 'STOP_LOSS', urgency: 'HIGH' };
                }
                break;
                
            case 'LT112':
                // Long-term 112 strategy
                if (daysHeld >= 98) { // Week 14 (112 - 14 days)
                    if (pnlPercent >= 0.75) { // 75% profit
                        return { shouldExit: true, reason: 'PROFIT_TARGET', urgency: 'MEDIUM' };
                    }
                }
                if (daysHeld >= 21 && pnlPercent <= -2.0) { // 21 DTE management
                    return { shouldExit: true, reason: 'DEFENSIVE_MANAGEMENT', urgency: 'HIGH' };
                }
                break;
                
            case 'STRANGLE':
                // Strangle management
                if (pnlPercent >= 0.50) { // 50% profit target
                    return { shouldExit: true, reason: 'PROFIT_TARGET', urgency: 'MEDIUM' };
                }
                if (pnlPercent <= -2.0) { // 200% of credit stop loss
                    return { shouldExit: true, reason: 'STOP_LOSS', urgency: 'HIGH' };
                }
                if (daysHeld >= 21) { // 21 DTE management
                    return { shouldExit: true, reason: 'DTE_MANAGEMENT', urgency: 'MEDIUM' };
                }
                break;
                
            default:
                // Generic exit rules
                if (pnlPercent >= 0.50) { // 50% profit target
                    return { shouldExit: true, reason: 'PROFIT_TARGET', urgency: 'LOW' };
                }
                if (pnlPercent <= -1.0) { // 100% stop loss
                    return { shouldExit: true, reason: 'STOP_LOSS', urgency: 'HIGH' };
                }
        }
        
        return { shouldExit: false, reason: null, urgency: null };
    }
    
    /**
     * Calculate backtest fill price with realistic modeling
     */
    calculateBacktestFillPrice(signal, marketData) {
        if (marketData.bid && marketData.ask) {
            // Use bid/ask spread
            return signal.action === 'BUY' ? marketData.ask : marketData.bid;
        } else {
            // Use mid price
            return marketData.price;
        }
    }
    
    /**
     * Update correlation group tracking
     */
    updateCorrelationGroups(signal) {
        if (!signal.correlationGroup) return;
        
        const group = this.correlationGroups.get(signal.correlationGroup) || [];
        group.push({
            symbol: signal.symbol,
            timestamp: new Date(),
            quantity: signal.quantity
        });
        
        // Keep only active positions
        const activeGroup = group.filter(item => 
            this.portfolio.positions.has(item.symbol)
        );
        
        this.correlationGroups.set(signal.correlationGroup, activeGroup);
    }
    
    /**
     * Record trade in history
     */
    recordTrade(strategy, signal, execution, marketData, date) {
        this.tradeHistory.push({
            timestamp: date || new Date(),
            strategy: strategy,
            symbol: signal.symbol,
            action: signal.action,
            quantity: signal.quantity,
            price: execution.fillPrice,
            commission: execution.commission,
            mode: this.mode,
            marketData: {
                underlying: marketData.price,
                volatility: marketData.volatility,
                vix: marketData.vix
            }
        });
    }
    
    /**
     * Recalculate portfolio value
     */
    async recalculatePortfolioValue() {
        let totalValue = this.portfolio.cash;
        let unrealizedPnL = 0;
        
        for (const [symbol, position] of this.portfolio.positions) {
            try {
                const marketData = await this.getMarketData(symbol);
                const marketValue = marketData.price * position.quantity;
                const positionPnL = marketValue - (position.avgPrice * position.quantity);
                
                totalValue += marketValue;
                unrealizedPnL += positionPnL;
                
                // Update position market value
                position.marketValue = marketValue;
                position.unrealizedPnL = positionPnL;
            } catch (error) {
                logger.warn('UNIFIED_ENGINE', `Failed to update value for ${symbol}`, error);
            }
        }
        
        this.portfolio.totalValue = totalValue;
        this.portfolio.unrealizedPnL = unrealizedPnL;
        this.portfolio.buyingPower = Math.max(0, this.portfolio.cash * (1 / this.options.maxBPUsage));
    }
    
    /**
     * Get portfolio summary
     */
    getPortfolioSummary() {
        return {
            mode: this.mode,
            cash: this.portfolio.cash,
            totalValue: this.portfolio.totalValue,
            unrealizedPnL: this.portfolio.unrealizedPnL,
            realizedPnL: this.portfolio.realizedPnL,
            buyingPower: this.portfolio.buyingPower,
            positionCount: this.portfolio.positions.size,
            dayTradeCount: this.portfolio.dayTradeCount,
            bpUsagePercent: ((this.portfolio.totalValue - this.portfolio.cash) / this.portfolio.totalValue) * 100
        };
    }
    
    /**
     * Run strategy on single day/timepoint
     */
    async runSinglePeriod(date, symbols = []) {
        const results = [];
        
        for (const symbol of symbols) {
            try {
                // Get market data
                const marketData = await this.getMarketData(symbol, date);
                
                // Evaluate signals
                const signals = await this.evaluateSignals(marketData, date);
                
                // Execute if signals present
                if (signals && signals.recommendations && signals.recommendations.length > 0) {
                    for (const signal of signals.recommendations) {
                        const result = await this.executeStrategy(signal.strategy, signal, marketData, date);
                        results.push(result);
                    }
                }
                
                // Check exit signals
                const exitSignals = await this.evaluateExitSignals(date);
                for (const exitSignal of exitSignals) {
                    const exitResult = await this.executeStrategy('EXIT', {
                        symbol: exitSignal.symbol,
                        action: exitSignal.position.quantity > 0 ? 'SELL' : 'BUY',
                        quantity: Math.abs(exitSignal.position.quantity),
                        strategy: 'EXIT'
                    }, exitSignal.marketData, date);
                    results.push(exitResult);
                }
                
            } catch (error) {
                logger.error('UNIFIED_ENGINE', `Failed to process ${symbol} on ${date}`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Get trading statistics
     */
    getStatistics() {
        const trades = this.tradeHistory;
        const winningTrades = trades.filter(t => t.pnl > 0);
        const losingTrades = trades.filter(t => t.pnl < 0);
        
        return {
            mode: this.mode,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: trades.length > 0 ? winningTrades.length / trades.length : 0,
            totalReturn: (this.portfolio.totalValue / this.options.initialCapital) - 1,
            realizedPnL: this.portfolio.realizedPnL,
            unrealizedPnL: this.portfolio.unrealizedPnL,
            currentPositions: this.portfolio.positions.size
        };
    }
}

/**
 * Mock Order Manager for Backtesting and Paper Trading
 */
class MockOrderManager {
    constructor(api) {
        this.api = api;
        this.orderCounter = 0;
    }
    
    async createOrder(signal) {
        return {
            id: ++this.orderCounter,
            symbol: signal.symbol,
            action: signal.action,
            quantity: signal.quantity,
            orderType: 'MARKET',
            status: 'PENDING'
        };
    }
    
    async submitOrder(order) {
        // Mock successful execution
        return {
            success: true,
            orderId: order.id,
            fillPrice: Math.random() * 100 + 50, // Mock price
            fillQuantity: order.quantity,
            commission: 2.50
        };
    }
}

// Export the unified engine
module.exports = { UnifiedTradingEngine, MockOrderManager };