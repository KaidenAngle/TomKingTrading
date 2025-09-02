/**
 * MARKET MICROSTRUCTURE - Professional Execution Simulation
 * Models realistic order execution with bid-ask spreads, slippage, and market impact
 * Based on actual market maker behavior and institutional trading patterns
 * 
 * CRITICAL FEATURES:
 * - Dynamic bid-ask spreads based on volatility, time, and liquidity
 * - Realistic slippage modeling with order size impact
 * - Fill simulation based on market conditions
 * - Partial fill handling for large orders
 * - Market impact calculation
 * - Price improvement simulation
 * - Queue position modeling
 * - Latency and rejection simulation
 * 
 * BASED ON:
 * - Interactive Brokers execution patterns
 * - CBOE and NYSE market maker behavior
 * - Academic research on market microstructure
 * - Professional trading desk observations
 */

const { getLogger } = require('./src/logger');

class MarketMicrostructure {
    constructor(config = {}) {
        this.logger = getLogger('MARKET_MICROSTRUCTURE');
        this.config = config;
        
        // Professional execution parameters
        this.executionParams = {
            // Base bid-ask spreads by instrument type
            baseSpreads: {
                options: {
                    liquid: 0.05,        // 5 cents for SPY, QQQ
                    standard: 0.10,      // 10 cents for most options
                    illiquid: 0.15,      // 15 cents for low volume
                    veryIlliquid: 0.25   // 25 cents for very low volume
                },
                futures: {
                    es: 0.25,            // 1 tick ES
                    mes: 0.25,           // 1 tick MES
                    crude: 0.01,         // 1 cent crude
                    gold: 0.10           // 10 cents gold
                },
                stocks: {
                    large: 0.01,         // 1 cent for large cap
                    mid: 0.02,           // 2 cents for mid cap
                    small: 0.05          // 5 cents for small cap
                }
            },
            
            // Slippage models
            slippage: {
                options: {
                    baseSlippage: 0.05,      // Base 5 cents
                    volumeImpact: 0.001,     // Per contract impact
                    volatilityMultiplier: 1.5, // Higher vol = more slippage
                    timeOfDayMultiplier: {
                        open: 1.5,           // 50% more at open
                        lunch: 1.3,          // 30% more at lunch
                        close: 1.4,          // 40% more at close
                        normal: 1.0          // Normal during day
                    }
                },
                futures: {
                    baseSlippage: 0.125,     // Half tick base
                    volumeImpact: 0.00025,   // Lower impact for futures
                    liquidityFactor: 0.8     // Generally more liquid
                }
            },
            
            // Fill probability models
            fillModels: {
                immediate: {
                    marketOrder: 0.98,       // 98% immediate fill
                    limitOrder: 0.15         // 15% immediate fill at limit
                },
                timeDecay: {
                    halfLife: 30,            // 50% fill probability in 30 seconds
                    maxWaitTime: 300         // 5 minutes max wait
                },
                priceImprovement: {
                    probability: 0.25,       // 25% chance of improvement
                    maxImprovement: 0.05     // Max 5 cents improvement
                }
            },
            
            // Market impact models
            marketImpact: {
                temporary: {
                    coefficient: 0.1,        // Temporary impact coefficient
                    decayRate: 0.5          // 50% decay per minute
                },
                permanent: {
                    coefficient: 0.05,       // Permanent impact coefficient
                    threshold: 1000          // Contracts threshold for permanent impact
                }
            },
            
            // Order rejection and latency
            execution: {
                latency: {
                    min: 50,                 // 50ms minimum latency
                    max: 500,                // 500ms maximum latency
                    averageElectronic: 100   // 100ms average electronic
                },
                rejection: {
                    rate: 0.01,              // 1% rejection rate
                    reasons: ['PRICE_IMPROVED', 'INSUFFICIENT_LIQUIDITY', 'SYSTEM_ERROR']
                }
            }
        };
        
        // Market state tracking
        this.marketState = {
            volatilityRegime: 'NORMAL',
            liquidityConditions: 'NORMAL',
            timeOfDay: 'NORMAL',
            systemLoad: 'LOW'
        };
        
        // Order tracking for realistic simulation
        this.orderBook = new Map();
        this.executionHistory = [];
        
        this.logger.info('MARKET_MICROSTRUCTURE', 'Professional market microstructure initialized');
    }
    
    /**
     * SIMULATE ORDER FILL - Main execution simulation
     */
    async simulateFill(order, marketData, conditions = {}) {
        this.logger.debug('FILL_SIMULATION', 'Processing order fill', {
            orderType: order.type,
            symbol: order.underlying,
            quantity: order.contracts
        });
        
        // Update market conditions
        this.updateMarketConditions(marketData, conditions);
        
        // Pre-execution validation
        const validation = await this.validateOrder(order, marketData);
        if (!validation.valid) {
            return this.createRejectionResult(order, validation.reason);
        }
        
        // Calculate execution parameters
        const executionParams = await this.calculateExecutionParameters(order, marketData, conditions);
        
        // Determine fill method based on order type
        let fillResult;
        
        switch (order.orderType || 'MARKET') {
            case 'MARKET':
                fillResult = await this.simulateMarketOrderFill(order, marketData, executionParams);
                break;
            case 'LIMIT':
                fillResult = await this.simulateLimitOrderFill(order, marketData, executionParams);
                break;
            case 'STOP':
                fillResult = await this.simulateStopOrderFill(order, marketData, executionParams);
                break;
            default:
                fillResult = await this.simulateMarketOrderFill(order, marketData, executionParams);
        }
        
        // Apply post-execution adjustments
        const finalResult = await this.applyPostExecutionAdjustments(fillResult, order, marketData);
        
        // Track execution for future reference
        this.trackExecution(order, finalResult);
        
        return finalResult;
    }
    
    /**
     * SIMULATE MARKET ORDER FILL
     */
    async simulateMarketOrderFill(order, marketData, executionParams) {
        const { bidAskSpread, slippage, latency } = executionParams;
        
        // Market orders typically fill immediately but with slippage
        const basePrice = this.getBaseExecutionPrice(order, marketData);
        
        // Calculate slippage direction (adverse selection)
        const slippageDirection = order.side === 'BUY' ? 1 : -1;
        const totalSlippage = slippage * slippageDirection;
        
        // Apply bid-ask spread impact
        const spreadImpact = (bidAskSpread / 2) * slippageDirection;
        
        // Final execution price
        const executionPrice = basePrice + totalSlippage + spreadImpact;
        
        // Simulate partial fills for large orders
        const fillQuantity = await this.simulatePartialFill(order.contracts, marketData);
        
        // Calculate costs
        const commission = this.calculateCommission(order, fillQuantity);
        const fees = this.calculateExchangeFees(order, fillQuantity);
        
        return {
            orderId: order.id || this.generateOrderId(),
            symbol: order.underlying,
            fillQuantity,
            remainingQuantity: order.contracts - fillQuantity,
            executionPrice: this.roundPrice(executionPrice),
            theoreticalPrice: basePrice,
            totalSlippage,
            spreadCost: spreadImpact,
            commission,
            fees,
            fillTime: new Date(Date.now() + latency),
            fillType: 'MARKET',
            venue: this.selectExecutionVenue(order, marketData),
            liquidity: executionParams.liquidityLevel,
            status: fillQuantity === order.contracts ? 'FILLED' : 'PARTIALLY_FILLED'
        };
    }
    
    /**
     * SIMULATE LIMIT ORDER FILL
     */
    async simulateLimitOrderFill(order, marketData, executionParams) {
        const { bidAskSpread, latency } = executionParams;
        
        const midPrice = this.getBaseExecutionPrice(order, marketData);
        const limitPrice = order.limitPrice;
        
        // Determine if limit order can fill immediately
        const canFillImmediately = this.canLimitOrderFillImmediately(
            order.side, 
            limitPrice, 
            midPrice, 
            bidAskSpread
        );
        
        if (canFillImmediately) {
            // Immediate fill - usually at limit price or better
            const priceImprovement = this.calculatePriceImprovement(order, marketData);
            const executionPrice = order.side === 'BUY' ? 
                Math.min(limitPrice, midPrice - bidAskSpread/2 - priceImprovement) :
                Math.max(limitPrice, midPrice + bidAskSpread/2 + priceImprovement);
            
            const fillQuantity = await this.simulatePartialFill(order.contracts, marketData);
            
            return {
                orderId: order.id || this.generateOrderId(),
                symbol: order.underlying,
                fillQuantity,
                remainingQuantity: order.contracts - fillQuantity,
                executionPrice: this.roundPrice(executionPrice),
                theoreticalPrice: midPrice,
                priceImprovement,
                commission: this.calculateCommission(order, fillQuantity),
                fees: this.calculateExchangeFees(order, fillQuantity),
                fillTime: new Date(Date.now() + latency),
                fillType: 'LIMIT_IMMEDIATE',
                status: fillQuantity === order.contracts ? 'FILLED' : 'PARTIALLY_FILLED'
            };
        } else {
            // Order goes to book - simulate queue position and fill probability
            return await this.simulateOrderInBook(order, marketData, executionParams);
        }
    }
    
    /**
     * CALCULATE EXECUTION PARAMETERS
     */
    async calculateExecutionParameters(order, marketData, conditions) {
        // Dynamic bid-ask spread calculation
        const bidAskSpread = this.calculateDynamicSpread(order, marketData, conditions);
        
        // Slippage calculation based on order characteristics
        const slippage = this.calculateSlippage(order, marketData, conditions);
        
        // Execution latency
        const latency = this.calculateExecutionLatency(order, conditions);
        
        // Liquidity assessment
        const liquidityLevel = this.assessLiquidityLevel(order, marketData);
        
        // Market impact estimation
        const marketImpact = this.estimateMarketImpact(order, marketData);
        
        return {
            bidAskSpread,
            slippage,
            latency,
            liquidityLevel,
            marketImpact,
            conditions: this.marketState
        };
    }
    
    /**
     * CALCULATE DYNAMIC SPREAD - Based on Market Conditions
     */
    calculateDynamicSpread(order, marketData, conditions) {
        const instrument = this.getInstrumentType(order.underlying);
        let baseSpread = this.executionParams.baseSpreads[instrument]?.standard || 0.10;
        
        // Volatility adjustment
        const volAdjustment = (conditions.volatility || 0.2) / 0.2; // Normalize to 20%
        baseSpread *= (0.5 + 0.5 * volAdjustment);
        
        // Time of day adjustment
        const timeMultiplier = this.getTimeOfDayMultiplier(conditions.timeOfDay);
        baseSpread *= timeMultiplier;
        
        // Volume/liquidity adjustment
        const volume = marketData.volume || 1000;
        const liquidityAdjustment = Math.max(0.5, Math.min(2.0, 1000 / Math.sqrt(volume)));
        baseSpread *= liquidityAdjustment;
        
        // Strike-specific adjustments for options
        if (instrument === 'options' && order.strike && marketData.close) {
            const moneyness = Math.abs(Math.log(order.strike / marketData.close));
            const moneynessAdjustment = 1 + moneyness; // Wider spreads for OTM options
            baseSpread *= moneynessAdjustment;
        }
        
        // Regime adjustment
        const regimeMultiplier = this.getRegimeSpreadMultiplier(this.marketState.volatilityRegime);
        baseSpread *= regimeMultiplier;
        
        return Math.max(0.01, baseSpread); // Minimum 1 cent spread
    }
    
    /**
     * CALCULATE SLIPPAGE - Professional Model
     */
    calculateSlippage(order, marketData, conditions) {
        const instrument = this.getInstrumentType(order.underlying);
        const slippageParams = this.executionParams.slippage[instrument] || this.executionParams.slippage.options;
        
        let baseSlippage = slippageParams.baseSlippage;
        
        // Order size impact
        const orderSize = order.contracts || 1;
        const volumeImpact = orderSize * slippageParams.volumeImpact;
        
        // Volatility impact
        const volMultiplier = slippageParams.volatilityMultiplier || 1.0;
        const volatility = conditions.volatility || 0.2;
        const volImpact = baseSlippage * (volatility / 0.2) * (volMultiplier - 1);
        
        // Time of day impact
        const timeMultiplier = slippageParams.timeOfDayMultiplier?.[this.marketState.timeOfDay] || 1.0;
        
        // Market regime impact
        const regimeMultiplier = this.getRegimeSlippageMultiplier(conditions.marketRegime);
        
        const totalSlippage = (baseSlippage + volumeImpact + volImpact) * timeMultiplier * regimeMultiplier;
        
        return Math.max(0, totalSlippage);
    }
    
    /**
     * SIMULATE PARTIAL FILL - Large Orders
     */
    async simulatePartialFill(requestedQuantity, marketData) {
        // Simple model: larger orders have higher chance of partial fills
        if (requestedQuantity <= 5) {
            return requestedQuantity; // Small orders typically fill completely
        }
        
        const liquidity = marketData.volume || 1000;
        const liquidityRatio = requestedQuantity / (liquidity * 0.1); // 10% of volume available
        
        if (liquidityRatio <= 1) {
            return requestedQuantity; // Sufficient liquidity
        }
        
        // Partial fill based on available liquidity
        const fillRatio = Math.min(1.0, 1 / liquidityRatio + Math.random() * 0.3);
        return Math.max(1, Math.floor(requestedQuantity * fillRatio));
    }
    
    /**
     * VALIDATE ORDER - Pre-execution Checks
     */
    async validateOrder(order, marketData) {
        // Basic order validation
        if (!order.underlying || !order.contracts) {
            return { valid: false, reason: 'INVALID_ORDER_PARAMETERS' };
        }
        
        // Market hours check
        if (!this.isMarketOpen(marketData.timestamp)) {
            return { valid: false, reason: 'MARKET_CLOSED' };
        }
        
        // Price validation for limit orders
        if (order.orderType === 'LIMIT' && order.limitPrice <= 0) {
            return { valid: false, reason: 'INVALID_LIMIT_PRICE' };
        }
        
        // Random rejection simulation
        if (Math.random() < this.executionParams.execution.rejection.rate) {
            const reasons = this.executionParams.execution.rejection.reasons;
            const reason = reasons[Math.floor(Math.random() * reasons.length)];
            return { valid: false, reason };
        }
        
        return { valid: true };
    }
    
    /**
     * UTILITY METHODS
     */
    
    getInstrumentType(symbol) {
        const futuresSymbols = ['ES', 'MES', 'NQ', 'MNQ', 'CL', 'MCL', 'GC', 'MGC'];
        const stockSymbols = ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD'];
        
        if (futuresSymbols.includes(symbol)) return 'futures';
        if (stockSymbols.includes(symbol)) return 'options'; // Assuming options on stocks
        return 'options'; // Default to options
    }
    
    getBaseExecutionPrice(order, marketData) {
        // Use mid-price as base execution price
        const bid = marketData.bid || marketData.close - 0.05;
        const ask = marketData.ask || marketData.close + 0.05;
        return (bid + ask) / 2;
    }
    
    getTimeOfDayMultiplier(timeOfDay) {
        const multipliers = {
            open: 1.5,
            lunch: 1.3,
            close: 1.4,
            normal: 1.0
        };
        return multipliers[this.marketState.timeOfDay] || 1.0;
    }
    
    getRegimeSpreadMultiplier(regime) {
        const multipliers = {
            LOW_VOL: 0.8,
            NORMAL: 1.0,
            ELEVATED: 1.3,
            HIGH_VOL: 1.8,
            CRISIS: 2.5
        };
        return multipliers[regime] || 1.0;
    }
    
    getRegimeSlippageMultiplier(regime) {
        const multipliers = {
            LOW_VOL: 0.7,
            NORMAL: 1.0,
            ELEVATED: 1.4,
            HIGH_VOL: 2.0,
            CRISIS: 3.0
        };
        return multipliers[regime] || 1.0;
    }
    
    calculateCommission(order, fillQuantity) {
        const instrument = this.getInstrumentType(order.underlying);
        
        if (instrument === 'options') {
            return this.config.commission?.options * fillQuantity || 1.17 * fillQuantity;
        } else if (instrument === 'futures') {
            return this.config.commission?.futures * fillQuantity || 2.50 * fillQuantity;
        }
        
        return 1.17 * fillQuantity; // Default options commission
    }
    
    calculateExchangeFees(order, fillQuantity) {
        // Simplified exchange fee calculation
        const baseFeePerContract = 0.50; // 50 cents per contract
        return baseFeePerContract * fillQuantity;
    }
    
    calculateExecutionLatency(order, conditions) {
        const baseLatency = this.executionParams.execution.latency.averageElectronic;
        const systemLoad = this.marketState.systemLoad === 'HIGH' ? 1.5 : 1.0;
        const orderComplexity = this.getOrderComplexityMultiplier(order);
        
        return Math.round(baseLatency * systemLoad * orderComplexity);
    }
    
    getOrderComplexityMultiplier(order) {
        // Simple orders execute faster
        if (order.type && order.type.includes('SPREAD')) return 1.5;
        if (order.type && order.type.includes('CONDOR')) return 2.0;
        return 1.0;
    }
    
    assessLiquidityLevel(order, marketData) {
        const volume = marketData.volume || 1000;
        const avgVolume = 5000; // Assume average volume
        
        const liquidityRatio = volume / avgVolume;
        
        if (liquidityRatio > 1.5) return 'HIGH';
        if (liquidityRatio > 0.8) return 'NORMAL';
        if (liquidityRatio > 0.3) return 'LOW';
        return 'VERY_LOW';
    }
    
    estimateMarketImpact(order, marketData) {
        const orderSize = order.contracts || 1;
        const volume = marketData.volume || 1000;
        
        // Temporary market impact
        const temporaryImpact = this.executionParams.marketImpact.temporary.coefficient * 
                               Math.sqrt(orderSize / volume);
        
        // Permanent market impact (if order is large)
        const permanentImpact = orderSize > this.executionParams.marketImpact.permanent.threshold ?
                               this.executionParams.marketImpact.permanent.coefficient * (orderSize / volume) : 0;
        
        return {
            temporary: temporaryImpact,
            permanent: permanentImpact,
            total: temporaryImpact + permanentImpact
        };
    }
    
    canLimitOrderFillImmediately(side, limitPrice, midPrice, spread) {
        const bid = midPrice - spread / 2;
        const ask = midPrice + spread / 2;
        
        if (side === 'BUY') {
            return limitPrice >= ask;
        } else {
            return limitPrice <= bid;
        }
    }
    
    calculatePriceImprovement(order, marketData) {
        const improvementProb = this.executionParams.fillModels.priceImprovement.probability;
        const maxImprovement = this.executionParams.fillModels.priceImprovement.maxImprovement;
        
        if (Math.random() < improvementProb) {
            return Math.random() * maxImprovement;
        }
        
        return 0;
    }
    
    selectExecutionVenue(order, marketData) {
        // Simplified venue selection
        const venues = ['CBOE', 'ISE', 'NASDAQ', 'NYSE'];
        return venues[Math.floor(Math.random() * venues.length)];
    }
    
    updateMarketConditions(marketData, conditions) {
        // Update market state based on current conditions
        const hour = new Date().getHours();
        
        if (hour < 10) {
            this.marketState.timeOfDay = 'open';
        } else if (hour >= 12 && hour < 13) {
            this.marketState.timeOfDay = 'lunch';
        } else if (hour >= 15) {
            this.marketState.timeOfDay = 'close';
        } else {
            this.marketState.timeOfDay = 'normal';
        }
        
        // Update volatility regime
        const vix = conditions.volatility * 100 || 18;
        if (vix < 12) this.marketState.volatilityRegime = 'LOW_VOL';
        else if (vix < 20) this.marketState.volatilityRegime = 'NORMAL';
        else if (vix < 30) this.marketState.volatilityRegime = 'ELEVATED';
        else this.marketState.volatilityRegime = 'HIGH_VOL';
    }
    
    isMarketOpen(timestamp) {
        const date = new Date(timestamp || Date.now());
        const hour = date.getHours();
        const day = date.getDay();
        
        // Skip weekends
        if (day === 0 || day === 6) return false;
        
        // Market hours: 9:30 AM - 4:00 PM EST
        return hour >= 9.5 && hour < 16;
    }
    
    roundPrice(price) {
        // Round to appropriate precision (cents for options, ticks for futures)
        return Math.round(price * 100) / 100;
    }
    
    generateOrderId() {
        return `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    
    createRejectionResult(order, reason) {
        return {
            orderId: order.id || this.generateOrderId(),
            status: 'REJECTED',
            reason,
            fillQuantity: 0,
            remainingQuantity: order.contracts,
            timestamp: new Date()
        };
    }
    
    async simulateOrderInBook(order, marketData, executionParams) {
        // Simulate order waiting in book for execution
        const fillProbability = this.calculateOrderBookFillProbability(order, marketData);
        
        if (Math.random() < fillProbability) {
            // Order fills from the book
            return {
                orderId: order.id || this.generateOrderId(),
                symbol: order.underlying,
                fillQuantity: order.contracts,
                remainingQuantity: 0,
                executionPrice: order.limitPrice,
                theoreticalPrice: this.getBaseExecutionPrice(order, marketData),
                commission: this.calculateCommission(order, order.contracts),
                fees: this.calculateExchangeFees(order, order.contracts),
                fillTime: new Date(Date.now() + Math.random() * 60000), // Random fill time
                fillType: 'LIMIT_BOOK',
                status: 'FILLED'
            };
        } else {
            // Order remains in book
            return {
                orderId: order.id || this.generateOrderId(),
                status: 'PENDING',
                fillQuantity: 0,
                remainingQuantity: order.contracts,
                bookPosition: Math.floor(Math.random() * 100) + 1 // Queue position
            };
        }
    }
    
    calculateOrderBookFillProbability(order, marketData) {
        // Simplified model: closer to market = higher fill probability
        const midPrice = this.getBaseExecutionPrice(order, marketData);
        const priceDistance = Math.abs(order.limitPrice - midPrice) / midPrice;
        
        // Base probability decreases with price distance
        const baseProbability = Math.max(0.1, 1 - priceDistance * 10);
        
        // Volume adjustment
        const volumeAdjustment = Math.min(1.5, (marketData.volume || 1000) / 1000);
        
        return Math.min(0.9, baseProbability * volumeAdjustment);
    }
    
    async applyPostExecutionAdjustments(fillResult, order, marketData) {
        // Apply any post-execution adjustments
        if (fillResult.status === 'FILLED' || fillResult.status === 'PARTIALLY_FILLED') {
            // Calculate actual P&L impact
            fillResult.pnl = this.calculateExecutionPnL(fillResult, order);
            
            // Add execution quality metrics
            fillResult.executionQuality = this.assessExecutionQuality(fillResult, order, marketData);
        }
        
        return fillResult;
    }
    
    calculateExecutionPnL(fillResult, order) {
        // Simple P&L calculation for the execution
        const side = order.side === 'BUY' ? 1 : -1;
        const priceImpact = fillResult.executionPrice - fillResult.theoreticalPrice;
        const contractMultiplier = this.getContractMultiplier(order.underlying);
        
        return -side * priceImpact * fillResult.fillQuantity * contractMultiplier;
    }
    
    assessExecutionQuality(fillResult, order, marketData) {
        // Professional execution quality assessment
        const priceImprovement = fillResult.priceImprovement || 0;
        const slippage = Math.abs(fillResult.totalSlippage || 0);
        const speedScore = fillResult.fillTime ? 100 - (fillResult.fillTime - Date.now()) / 100 : 100;
        
        return {
            priceScore: Math.max(0, 100 - slippage * 1000 + priceImprovement * 1000),
            speedScore: Math.max(0, Math.min(100, speedScore)),
            fillScore: fillResult.status === 'FILLED' ? 100 : 50,
            overallScore: (priceImprovement * 1000 - slippage * 1000 + speedScore) / 3
        };
    }
    
    trackExecution(order, fillResult) {
        // Track execution for analysis and improvement
        this.executionHistory.push({
            timestamp: Date.now(),
            order: { ...order },
            fillResult: { ...fillResult },
            marketConditions: { ...this.marketState }
        });
        
        // Maintain limited history
        if (this.executionHistory.length > 10000) {
            this.executionHistory.shift();
        }
    }
    
    getContractMultiplier(symbol) {
        const multipliers = {
            'ES': 50, 'MES': 5, 'NQ': 20, 'MNQ': 2,
            'CL': 1000, 'MCL': 100, 'GC': 100, 'MGC': 10,
            'SPY': 100, 'QQQ': 100, 'IWM': 100, 'TLT': 100, 'GLD': 100
        };
        return multipliers[symbol] || 100;
    }
}

module.exports = MarketMicrostructure;