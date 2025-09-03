/**
 * Position Automation Module
 * Automated management for 21 DTE, 50% profit targets, and position entry
 * Implements Tom King's systematic rules for position management
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

class PositionAutomation extends EventEmitter {
    constructor(api, orderManager, riskManager, positionManager) {
        super();
        
        this.api = api;
        this.orderManager = orderManager;
        this.riskManager = riskManager;
        this.positionManager = positionManager;
        
        // Automation settings (can be toggled)
        this.config = {
            enabled: false, // Start disabled for safety
            autoEntry: false,
            auto21DTE: true,
            auto50Profit: true,
            autoDefensive: true,
            autoEmergency: true,
            
            // Tom King rules
            profitTarget: 0.50, // 50% of max profit
            dteThreshold: 21, // Manage at 21 DTE
            defensiveDTE: 7, // Urgent defensive at 7 DTE
            maxLossPercent: 2.0, // 200% of credit received
            
            // Emergency thresholds
            accountDrawdown: 0.10, // 10% daily drawdown
            vixSpike: 40, // VIX above 40
            correlationBreach: 5, // More than 5 correlated positions
            
            // Intervals
            checkInterval: 60000, // Check every minute
            emergencyInterval: 5000 // Check emergency every 5 seconds
        };
        
        this.monitoringInterval = null;
        this.emergencyInterval = null;
        this.pendingActions = [];
        this.executedActions = new Set(); // Prevent duplicate actions
    }
    
    /**
     * Start automated monitoring
     */
    start() {
        if (!this.config.enabled) {
            logger.warn('AUTOMATION', 'Position automation is disabled');
            return;
        }
        
        logger.info('AUTOMATION', '🤖 Starting position automation');
        
        // Regular monitoring
        this.monitoringInterval = setInterval(() => {
            this.checkPositions();
        }, this.config.checkInterval);
        
        // Emergency monitoring (more frequent)
        if (this.config.autoEmergency) {
            this.emergencyInterval = setInterval(() => {
                this.checkEmergencyConditions();
            }, this.config.emergencyInterval);
        }
        
        // Initial check
        this.checkPositions();
        
        this.emit('started', { config: this.config });
    }
    
    /**
     * Stop automated monitoring
     */
    stop() {
        logger.info('AUTOMATION', '🛑 Stopping position automation');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.emergencyInterval) {
            clearInterval(this.emergencyInterval);
            this.emergencyInterval = null;
        }
        
        this.emit('stopped');
    }
    
    /**
     * Check all positions for automated actions
     */
    async checkPositions() {
        try {
            const positions = await this.api.getPositions();
            const account = await this.api.getAccount();
            
            if (!positions || positions.length === 0) {
                return;
            }
            
            logger.debug('AUTOMATION', `Checking ${positions.length} positions`);
            
            for (const position of positions) {
                await this.evaluatePosition(position, account);
            }
            
            // Process any pending actions
            await this.processPendingActions();
            
        } catch (error) {
            logger.error('AUTOMATION', 'Error checking positions', error);
        }
    }
    
    /**
     * Evaluate single position for automation rules
     */
    async evaluatePosition(position, account) {
        const positionId = `${position.symbol}_${position.strike}_${position.expiration}`;
        
        // Skip if already processed recently
        if (this.executedActions.has(positionId)) {
            return;
        }
        
        // Calculate metrics
        const dte = this.calculateDTE(position.expiration);
        const plPercent = this.calculatePLPercent(position);
        const health = this.positionManager.calculateHealthScore(position);
        
        // Check 50% profit target
        if (this.config.auto50Profit && plPercent >= this.config.profitTarget) {
            this.addPendingAction({
                type: 'CLOSE_PROFIT',
                position,
                reason: `50% profit target reached (${(plPercent * 100).toFixed(1)}%)`,
                priority: 1
            });
            return; // Exit early if closing for profit
        }
        
        // Check 21 DTE management
        if (this.config.auto21DTE && dte <= this.config.dteThreshold && dte > 0) {
            if (position.strategy === 'LT112' || position.strategy === 'STRANGLE') {
                // Check if profitable enough to hold
                if (plPercent < 0.25) {
                    this.addPendingAction({
                        type: 'MANAGE_21DTE',
                        position,
                        reason: `21 DTE reached with only ${(plPercent * 100).toFixed(1)}% profit`,
                        action: 'ROLL',
                        priority: 2
                    });
                } else if (plPercent >= 0.25 && plPercent < 0.50) {
                    this.addPendingAction({
                        type: 'MANAGE_21DTE',
                        position,
                        reason: `21 DTE with ${(plPercent * 100).toFixed(1)}% profit - consider closing`,
                        action: 'CLOSE',
                        priority: 3
                    });
                }
            }
        }
        
        // Check defensive DTE (urgent)
        if (this.config.autoDefensive && dte <= this.config.defensiveDTE && dte > 0) {
            if (plPercent < 0) {
                this.addPendingAction({
                    type: 'DEFENSIVE_URGENT',
                    position,
                    reason: `Only ${dte} DTE with loss of ${(Math.abs(plPercent) * 100).toFixed(1)}%`,
                    action: 'CLOSE',
                    priority: 0 // Highest priority
                });
            }
        }
        
        // Check max loss
        if (this.config.autoDefensive && plPercent <= -this.config.maxLossPercent) {
            this.addPendingAction({
                type: 'STOP_LOSS',
                position,
                reason: `Max loss exceeded: ${(Math.abs(plPercent) * 100).toFixed(1)}%`,
                action: 'CLOSE',
                priority: 0
            });
        }
        
        // Check if position is tested (for strangles/condors)
        if (position.strategy === 'STRANGLE' || position.strategy === 'IRON_CONDOR') {
            const tested = await this.checkIfTested(position);
            if (tested) {
                this.addPendingAction({
                    type: 'MANAGE_TESTED',
                    position,
                    reason: `${tested.side} side tested at ${tested.percentage.toFixed(1)}% ITM`,
                    action: 'DEFEND',
                    priority: 1
                });
            }
        }
    }
    
    /**
     * Check emergency conditions
     */
    async checkEmergencyConditions() {
        try {
            const account = await this.api.getAccount();
            const marketData = await this.api.getMarketData(['VIX']);
            
            // Check account drawdown
            const dailyPL = account.dailyPL || 0;
            const netLiq = account.netLiq || account.balance;
            const drawdownPercent = Math.abs(dailyPL / netLiq);
            
            if (drawdownPercent >= this.config.accountDrawdown) {
                logger.error('AUTOMATION', `🚨 EMERGENCY: Account drawdown ${(drawdownPercent * 100).toFixed(1)}%`);
                this.triggerEmergencyProtocol('ACCOUNT_DRAWDOWN', drawdownPercent);
                return;
            }
            
            // Check VIX spike
            const vixLevel = marketData.VIX?.last || 16;
            if (vixLevel >= this.config.vixSpike) {
                logger.error('AUTOMATION', `🚨 EMERGENCY: VIX spike to ${vixLevel}`);
                this.triggerEmergencyProtocol('VIX_SPIKE', vixLevel);
                return;
            }
            
            // Check correlation breach
            const correlationGroups = await this.checkCorrelationGroups();
            for (const [group, count] of Object.entries(correlationGroups)) {
                if (count >= this.config.correlationBreach) {
                    logger.error('AUTOMATION', `🚨 EMERGENCY: ${count} positions in ${group} group`);
                    this.triggerEmergencyProtocol('CORRELATION_BREACH', { group, count });
                    return;
                }
            }
            
        } catch (error) {
            logger.error('AUTOMATION', 'Error checking emergency conditions', error);
        }
    }
    
    /**
     * Trigger emergency protocol
     */
    async triggerEmergencyProtocol(reason, details) {
        this.emit('emergency', { reason, details, timestamp: new Date() });
        
        // Add emergency close all to pending actions
        const positions = await this.api.getPositions();
        
        for (const position of positions) {
            // Close 0DTE and losing positions first
            const dte = this.calculateDTE(position.expiration);
            const plPercent = this.calculatePLPercent(position);
            
            let priority = 10; // Default low priority
            if (dte === 0) priority = 0; // Highest priority for 0DTE
            else if (plPercent < 0) priority = 1; // High priority for losses
            else if (dte <= 7) priority = 2; // Medium-high for near expiry
            
            this.addPendingAction({
                type: 'EMERGENCY_CLOSE',
                position,
                reason: `Emergency protocol: ${reason}`,
                action: 'CLOSE',
                priority
            });
        }
        
        // Process immediately
        await this.processPendingActions();
    }
    
    /**
     * Add action to pending queue
     */
    addPendingAction(action) {
        // Check for duplicates
        const exists = this.pendingActions.find(a => 
            a.position.symbol === action.position.symbol &&
            a.position.strike === action.position.strike &&
            a.type === action.type
        );
        
        if (!exists) {
            this.pendingActions.push(action);
            logger.info('AUTOMATION', `Added pending action: ${action.type} for ${action.position.symbol}`);
        }
    }
    
    /**
     * Process pending actions by priority
     */
    async processPendingActions() {
        if (this.pendingActions.length === 0) return;
        
        // Sort by priority (lower number = higher priority)
        this.pendingActions.sort((a, b) => a.priority - b.priority);
        
        logger.info('AUTOMATION', `Processing ${this.pendingActions.length} pending actions`);
        
        const actionsToProcess = [...this.pendingActions];
        this.pendingActions = []; // Clear queue
        
        for (const action of actionsToProcess) {
            try {
                await this.executeAction(action);
                
                // Mark as executed to prevent re-processing
                const positionId = `${action.position.symbol}_${action.position.strike}_${action.position.expiration}`;
                this.executedActions.add(positionId);
                
                // Clear executed actions after 1 hour
                setTimeout(() => {
                    this.executedActions.delete(positionId);
                }, 3600000);
                
            } catch (error) {
                logger.error('AUTOMATION', `Failed to execute ${action.type}`, error);
                // Re-add to queue if not emergency
                if (!action.type.includes('EMERGENCY')) {
                    this.pendingActions.push(action);
                }
            }
        }
    }
    
    /**
     * Execute automated action
     */
    async executeAction(action) {
        logger.warn('AUTOMATION', `Executing: ${action.type} - ${action.reason}`);
        
        const order = {
            symbol: action.position.symbol,
            strategy: action.position.strategy,
            expiration: action.position.expiration,
            strikes: action.position.strikes,
            quantity: action.position.quantity
        };
        
        switch(action.action) {
            case 'CLOSE':
                await this.closePosition(order, action.reason);
                break;
                
            case 'ROLL':
                await this.rollPosition(order, action.reason);
                break;
                
            case 'DEFEND':
                await this.defendPosition(order, action.reason);
                break;
                
            default:
                logger.warn('AUTOMATION', `Unknown action: ${action.action}`);
        }
        
        this.emit('actionExecuted', {
            action: action.type,
            position: action.position.symbol,
            reason: action.reason,
            timestamp: new Date()
        });
    }
    
    /**
     * Close position
     */
    async closePosition(order, reason) {
        logger.info('AUTOMATION', `CLOSING: ${order.symbol} - ${reason}`);
        
        // In production, this would submit actual close order
        // For now, just prepare the order
        const closeOrder = await this.orderManager.prepareCloseOrder(order);
        
        this.emit('positionClosed', {
            order: closeOrder,
            reason,
            automated: true
        });
        
        // Log to journal
        logger.info('AUTOMATION', `Position closed: ${order.symbol}`, closeOrder);
    }
    
    /**
     * Enhanced roll management with Tom King methodology
     */
    async rollPosition(order, reason) {
        logger.info('AUTOMATION', `ROLLING: ${order.symbol} - ${reason}`);
        
        const rollAnalysis = await this.analyzeRollOpportunity(order);
        
        if (!rollAnalysis.shouldRoll) {
            logger.warn('AUTOMATION', `Roll not advisable: ${rollAnalysis.reason}`);
            if (rollAnalysis.alternativeAction === 'CLOSE') {
                await this.closePosition(order, `${reason} (roll not optimal)`);
            }
            return;
        }
        
        // Execute roll based on strategy
        const rollOrder = await this.prepareRollOrder(order, rollAnalysis);
        
        this.emit('positionRolled', {
            order: rollOrder,
            analysis: rollAnalysis,
            reason,
            automated: true
        });
        
        logger.info('AUTOMATION', `Position rolled: ${order.symbol}`, rollOrder);
    }
    
    /**
     * Analyze roll opportunity based on Tom King rules
     */
    async analyzeRollOpportunity(position) {
        const analysis = {
            shouldRoll: false,
            reason: '',
            alternativeAction: null,
            rollType: null,
            targetExpiration: null,
            costBenefit: null,
            riskReward: null
        };
        
        // Get current position metrics
        const currentDTE = this.calculateDTE(position.expiration);
        const currentPL = position.unrealizedPL || 0;
        const creditReceived = position.creditReceived || 0;
        
        // Tom King roll criteria
        // 1. Roll at 21 DTE or when tested
        // 2. Don't roll for a debit unless defending
        // 3. Roll to maintain similar risk profile
        
        // Check if position is tested
        const testStatus = await this.checkIfTested(position);
        const isTested = testStatus && testStatus.tested;
        
        // Get market data for analysis
        const marketData = await this.api.getMarketData([position.symbol]);
        const vix = marketData.VIX?.last || 20;
        
        // Decision tree for rolling
        if (currentDTE <= 0) {
            analysis.shouldRoll = false;
            analysis.reason = 'Expiration day - close instead';
            analysis.alternativeAction = 'CLOSE';
            return analysis;
        }
        
        if (currentDTE <= 7 && !isTested) {
            // Close profitable positions near expiration
            if (currentPL > creditReceived * 0.25) {
                analysis.shouldRoll = false;
                analysis.reason = 'Profitable near expiration - take profit';
                analysis.alternativeAction = 'CLOSE';
                return analysis;
            }
        }
        
        // Determine roll type
        if (isTested) {
            analysis.rollType = 'DEFENSIVE';
            analysis.shouldRoll = true;
            analysis.reason = `Position tested at ${testStatus.testedSide}`;
        } else if (currentDTE <= 21) {
            analysis.rollType = 'MANAGEMENT';
            analysis.shouldRoll = true;
            analysis.reason = `21 DTE management (${currentDTE} DTE)`;
        } else if (currentPL >= creditReceived * 0.50) {
            analysis.rollType = 'PROFIT_CAPTURE';
            analysis.shouldRoll = false; // Close for profit instead
            analysis.reason = '50% profit target reached';
            analysis.alternativeAction = 'CLOSE';
            return analysis;
        }
        
        // Find optimal roll target
        if (analysis.shouldRoll) {
            const rollTarget = await this.findOptimalRollTarget(position, analysis.rollType, vix);
            
            if (!rollTarget) {
                analysis.shouldRoll = false;
                analysis.reason = 'No suitable roll target found';
                analysis.alternativeAction = 'CLOSE';
                return analysis;
            }
            
            analysis.targetExpiration = rollTarget.expiration;
            analysis.costBenefit = rollTarget.costBenefit;
            analysis.riskReward = rollTarget.riskReward;
            
            // Final check: Don't roll for excessive debit
            if (rollTarget.netDebit > creditReceived * 0.25 && analysis.rollType !== 'DEFENSIVE') {
                analysis.shouldRoll = false;
                analysis.reason = 'Roll requires excessive debit';
                analysis.alternativeAction = 'CLOSE';
            }
        }
        
        return analysis;
    }
    
    /**
     * Find optimal roll target expiration and strikes
     */
    async findOptimalRollTarget(position, rollType, currentVIX) {
        const optionChain = await this.api.getOptionChain(position.symbol);
        const expirations = Object.keys(optionChain).sort();
        
        let targetDTE;
        let targetCriteria;
        
        // Set target based on roll type
        switch (rollType) {
            case 'DEFENSIVE':
                // Roll to next monthly (30-45 DTE)
                targetDTE = { min: 30, max: 45 };
                targetCriteria = 'REDUCE_RISK';
                break;
                
            case 'MANAGEMENT':
                // Standard roll to 45-60 DTE
                targetDTE = { min: 45, max: 60 };
                targetCriteria = 'MAINTAIN_RISK';
                break;
                
            default:
                targetDTE = { min: 35, max: 50 };
                targetCriteria = 'MAINTAIN_RISK';
        }
        
        // Find suitable expirations
        const candidates = [];
        for (const exp of expirations) {
            const dte = this.calculateDTE(exp);
            if (dte >= targetDTE.min && dte <= targetDTE.max) {
                const rollMetrics = await this.calculateRollMetrics(
                    position,
                    exp,
                    optionChain[exp],
                    targetCriteria
                );
                
                if (rollMetrics) {
                    candidates.push({
                        expiration: exp,
                        dte: dte,
                        ...rollMetrics
                    });
                }
            }
        }
        
        // Select best candidate
        if (candidates.length === 0) return null;
        
        // Score candidates based on Tom King preferences
        candidates.forEach(c => {
            c.score = this.scoreRollCandidate(c, rollType, currentVIX);
        });
        
        // Return highest scoring candidate
        return candidates.sort((a, b) => b.score - a.score)[0];
    }
    
    /**
     * Calculate roll metrics for a target expiration
     */
    async calculateRollMetrics(position, targetExpiration, chain, criteria) {
        const metrics = {
            netCredit: 0,
            netDebit: 0,
            newDelta: 0,
            newTheta: 0,
            widthChange: 0,
            riskChange: 0
        };
        
        // Calculate closing cost of current position
        const closingCost = await this.calculateClosingCost(position);
        
        // Find new strikes based on criteria
        const newStrikes = await this.selectRollStrikes(
            position,
            chain,
            criteria
        );
        
        if (!newStrikes) return null;
        
        // Calculate opening credit/debit for new position
        const openingCredit = await this.calculatePositionCredit(
            position.strategy,
            newStrikes,
            chain
        );
        
        // Net roll cost
        const rollCost = closingCost - openingCredit;
        if (rollCost > 0) {
            metrics.netDebit = rollCost;
        } else {
            metrics.netCredit = Math.abs(rollCost);
        }
        
        // Risk metrics
        if (position.strategy === 'STRANGLE' || position.strategy === 'IRON_CONDOR') {
            const currentWidth = Math.abs((position.strikes?.call || 0) - (position.strikes?.put || 0));
            const newWidth = Math.abs(newStrikes.call - newStrikes.put);
            metrics.widthChange = newWidth - currentWidth;
        }
        
        // Greeks for new position
        if (chain.CALL && newStrikes.call) {
            const callOption = chain.CALL[newStrikes.call];
            metrics.newDelta += callOption?.delta || 0;
            metrics.newTheta += callOption?.theta || 0;
        }
        if (chain.PUT && newStrikes.put) {
            const putOption = chain.PUT[newStrikes.put];
            metrics.newDelta += putOption?.delta || 0;
            metrics.newTheta += putOption?.theta || 0;
        }
        
        // Cost benefit analysis
        metrics.costBenefit = {
            rollCost: rollCost,
            additionalTime: this.calculateDTE(targetExpiration) - this.calculateDTE(position.expiration),
            thetaIncrease: metrics.newTheta - (position.theta || 0),
            creditPerDay: openingCredit / this.calculateDTE(targetExpiration)
        };
        
        // Risk/reward ratio
        const maxRisk = this.calculateMaxRisk(position.strategy, newStrikes, openingCredit);
        metrics.riskReward = {
            maxProfit: openingCredit,
            maxRisk: maxRisk,
            ratio: openingCredit / maxRisk
        };
        
        return metrics;
    }
    
    /**
     * Select new strikes for roll based on criteria
     */
    async selectRollStrikes(position, chain, criteria) {
        const currentPrice = await this.getCurrentPrice(position.symbol);
        const strikes = {
            call: null,
            put: null
        };
        
        switch (criteria) {
            case 'REDUCE_RISK':
                // Move strikes further out
                strikes.put = this.findStrikeByDelta(chain.PUT, 0.15); // 15 delta
                strikes.call = this.findStrikeByDelta(chain.CALL, 0.15);
                break;
                
            case 'MAINTAIN_RISK':
                // Keep similar deltas
                strikes.put = this.findStrikeByDelta(chain.PUT, 0.20); // 20 delta
                strikes.call = this.findStrikeByDelta(chain.CALL, 0.20);
                break;
                
            case 'AGGRESSIVE':
                // Move strikes closer
                strikes.put = this.findStrikeByDelta(chain.PUT, 0.25); // 25 delta
                strikes.call = this.findStrikeByDelta(chain.CALL, 0.25);
                break;
                
            default:
                // Standard Tom King strikes
                const expectedMove = currentPrice * 0.06; // Approximate 6% move
                strikes.put = this.roundToStrike(currentPrice - expectedMove, 5);
                strikes.call = this.roundToStrike(currentPrice + expectedMove, 5);
        }
        
        return strikes;
    }
    
    /**
     * Score roll candidate based on Tom King preferences
     */
    scoreRollCandidate(candidate, rollType, vix) {
        let score = 0;
        
        // Credit received (prefer credit over debit)
        if (candidate.netCredit > 0) {
            score += 30;
            score += Math.min(20, candidate.netCredit / 10); // More credit = better
        } else if (candidate.netDebit > 0) {
            score -= Math.min(30, candidate.netDebit / 10); // Penalize debits
        }
        
        // DTE preference (45 DTE is ideal)
        const dteDiff = Math.abs(candidate.dte - 45);
        score += Math.max(0, 20 - dteDiff);
        
        // Risk/reward ratio (prefer > 0.3)
        if (candidate.riskReward) {
            const ratio = candidate.riskReward.ratio;
            if (ratio > 0.3) score += 20;
            else if (ratio > 0.25) score += 10;
        }
        
        // Theta increase (more theta = more daily decay)
        if (candidate.newTheta > 0) {
            score += Math.min(15, candidate.newTheta * 10);
        }
        
        // VIX consideration
        if (vix > 25 && rollType === 'DEFENSIVE') {
            // In high VIX, prefer reducing risk
            if (candidate.widthChange > 0) score += 10; // Wider strikes
        } else if (vix < 15) {
            // In low VIX, can be more aggressive
            if (candidate.widthChange < 0) score += 5; // Tighter strikes OK
        }
        
        // Additional time value
        if (candidate.costBenefit) {
            const additionalDays = candidate.costBenefit.additionalTime;
            score += Math.min(10, additionalDays / 3);
        }
        
        return score;
    }
    
    /**
     * Prepare the actual roll order
     */
    async prepareRollOrder(position, rollAnalysis) {
        const rollOrder = {
            type: 'ROLL',
            symbol: position.symbol,
            strategy: position.strategy,
            closeLegs: [],
            openLegs: [],
            netCredit: rollAnalysis.costBenefit?.rollCost < 0 ? 
                      Math.abs(rollAnalysis.costBenefit.rollCost) : 0,
            netDebit: rollAnalysis.costBenefit?.rollCost > 0 ? 
                     rollAnalysis.costBenefit.rollCost : 0
        };
        
        // Build close legs (current position)
        if (position.legs) {
            rollOrder.closeLegs = position.legs.map(leg => ({
                ...leg,
                action: 'BUY_TO_CLOSE'
            }));
        }
        
        // Build open legs (new position)
        const optionChain = await this.api.getOptionChain(position.symbol);
        const targetChain = optionChain[rollAnalysis.targetExpiration];
        
        if (position.strategy === 'STRANGLE') {
            rollOrder.openLegs = [
                {
                    strike: rollAnalysis.targetStrikes?.put,
                    type: 'PUT',
                    action: 'SELL_TO_OPEN',
                    quantity: position.quantity
                },
                {
                    strike: rollAnalysis.targetStrikes?.call,
                    type: 'CALL',
                    action: 'SELL_TO_OPEN',
                    quantity: position.quantity
                }
            ];
        }
        
        return rollOrder;
    }
    
    // Helper methods for roll management
    
    async calculateClosingCost(position) {
        const quotes = await this.api.getPositionQuotes(position);
        let cost = 0;
        
        if (position.legs) {
            position.legs.forEach(leg => {
                const quote = quotes[leg.symbol];
                if (quote) {
                    // Cost to close = ask price for short positions
                    cost += quote.ask * leg.quantity * 100;
                }
            });
        }
        
        return cost;
    }
    
    async calculatePositionCredit(strategy, strikes, chain) {
        let credit = 0;
        
        switch (strategy) {
            case 'STRANGLE':
                if (chain.PUT && strikes.put) {
                    credit += (chain.PUT[strikes.put]?.bid || 0) * 100;
                }
                if (chain.CALL && strikes.call) {
                    credit += (chain.CALL[strikes.call]?.bid || 0) * 100;
                }
                break;
                
            case 'IRON_CONDOR':
                // Calculate net credit for all four legs
                // Implementation depends on specific strikes
                break;
        }
        
        return credit;
    }
    
    calculateMaxRisk(strategy, strikes, credit) {
        switch (strategy) {
            case 'STRANGLE':
                // Max risk is technically unlimited, use reasonable estimate
                return credit * 3; // 3x credit as max risk estimate
                
            case 'IRON_CONDOR':
                // Max risk = width of widest spread - credit
                const width = 5 * 100; // Assuming $5 wide spreads
                return width - credit;
                
            default:
                return credit * 2;
        }
    }
    
    async getCurrentPrice(symbol) {
        const quote = await this.api.getMarketData([symbol]);
        return quote[symbol]?.last || 0;
    }
    
    findStrikeByDelta(chain, targetDelta) {
        if (!chain) return null;
        
        const strikes = Object.keys(chain).map(Number).sort((a, b) => a - b);
        let closestStrike = strikes[0];
        let closestDiff = Math.abs((chain[strikes[0]]?.delta || 0) - targetDelta);
        
        for (const strike of strikes) {
            const delta = Math.abs(chain[strike]?.delta || 0);
            const diff = Math.abs(delta - targetDelta);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestStrike = strike;
            }
        }
        
        return closestStrike;
    }
    
    roundToStrike(price, increment) {
        return Math.round(price / increment) * increment;
    }
    
    /**
     * Defend tested position
     */
    async defendPosition(order, reason) {
        logger.info('AUTOMATION', `DEFENDING: ${order.symbol} - ${reason}`);
        
        // Tom King defensive strategies
        // 1. For strangles - roll untested side closer
        // 2. For condors - convert to butterfly
        // 3. For 0DTE - close immediately
        
        const dte = this.calculateDTE(order.expiration);
        
        if (dte === 0) {
            // Close 0DTE immediately
            await this.closePosition(order, `${reason} (0DTE defensive close)`);
        } else if (order.strategy === 'STRANGLE') {
            // Roll untested side
            const defenseOrder = {
                action: 'ROLL_UNTESTED',
                original: order,
                newStrike: 'CLOSER_DELTA' // Move to 20 delta
            };
            
            this.emit('positionDefended', {
                order: defenseOrder,
                reason,
                automated: true
            });
        } else {
            // Default to closing
            await this.closePosition(order, `${reason} (defensive close)`);
        }
    }
    
    // Helper methods
    
    calculateDTE(expiration) {
        const today = new Date();
        const expDate = new Date(expiration);
        return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    }
    
    calculatePLPercent(position) {
        if (!position.creditReceived || position.creditReceived === 0) {
            return position.unrealizedPL / Math.abs(position.cost || 1);
        }
        return position.unrealizedPL / position.creditReceived;
    }
    
    async checkIfTested(position) {
        const quote = await this.api.getMarketData([position.symbol]);
        const currentPrice = quote[position.symbol]?.last;
        
        if (!currentPrice) return null;
        
        const putStrike = position.strikes?.put;
        const callStrike = position.strikes?.call;
        
        if (putStrike && currentPrice <= putStrike * 1.02) {
            return {
                side: 'PUT',
                percentage: ((putStrike - currentPrice) / putStrike) * 100
            };
        }
        
        if (callStrike && currentPrice >= callStrike * 0.98) {
            return {
                side: 'CALL',
                percentage: ((currentPrice - callStrike) / callStrike) * 100
            };
        }
        
        return null;
    }
    
    async checkCorrelationGroups() {
        const positions = await this.api.getPositions();
        const groups = {};
        
        for (const position of positions) {
            const group = this.getCorrelationGroup(position.symbol);
            groups[group] = (groups[group] || 0) + 1;
        }
        
        return groups;
    }
    
    getCorrelationGroup(symbol) {
        const groups = {
            EQUITY: ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'NQ', 'MNQ'],
            ENERGY: ['CL', 'MCL', 'XLE', 'XOP'],
            METALS: ['GC', 'MGC', 'GLD', 'SLV'],
            BONDS: ['TLT', 'ZB', 'ZN']
        };
        
        for (const [group, symbols] of Object.entries(groups)) {
            if (symbols.includes(symbol)) return group;
        }
        
        return 'OTHER';
    }
    
    findNextExpiration(optionChain, strategy) {
        const today = new Date();
        
        const expirations = optionChain
            .map(exp => ({
                ...exp,
                dte: Math.ceil((new Date(exp.expiration) - today) / (1000 * 60 * 60 * 24))
            }))
            .filter(exp => exp.dte > 21) // Must be beyond 21 DTE
            .sort((a, b) => a.dte - b.dte);
        
        if (strategy === 'LT112') {
            // Find closest to 112 DTE
            return expirations.find(exp => exp.dte >= 105 && exp.dte <= 119) || expirations[0];
        } else if (strategy === 'STRANGLE') {
            // Find closest to 90 DTE
            return expirations.find(exp => exp.dte >= 80 && exp.dte <= 100) || expirations[0];
        } else {
            // Default to 30-45 DTE
            return expirations.find(exp => exp.dte >= 30 && exp.dte <= 45) || expirations[0];
        }
    }
    
    /**
     * Automated Position Entry System
     * Monitors for optimal entry conditions and executes trades
     */
    async startAutomatedEntry(config = {}) {
        const entryConfig = {
            enabled: config.enabled !== false,
            strategies: config.strategies || ['0DTE', 'LT112', 'STRANGLE'],
            maxDailyEntries: config.maxDailyEntries || 3,
            checkInterval: config.checkInterval || 300000, // 5 minutes
            requireVIXConfirmation: config.requireVIXConfirmation !== false,
            requirePatternConfirmation: config.requirePatternConfirmation !== false,
            ...config
        };
        
        if (!entryConfig.enabled) {
            console.log('⚠️ Automated entry disabled');
            return;
        }
        
        console.log('🚀 Starting automated position entry system...');
        console.log(`  Strategies: ${entryConfig.strategies.join(', ')}`);
        console.log(`  Max daily entries: ${entryConfig.maxDailyEntries}`);
        
        // Track daily entries
        let dailyEntryCount = 0;
        let lastResetDate = new Date().toDateString();
        
        // Entry monitoring function
        const checkForEntries = async () => {
            try {
                // Reset daily count if new day
                const today = new Date().toDateString();
                if (today !== lastResetDate) {
                    dailyEntryCount = 0;
                    lastResetDate = today;
                }
                
                // Check if we've hit daily limit
                if (dailyEntryCount >= entryConfig.maxDailyEntries) {
                    console.log(`📊 Daily entry limit reached (${dailyEntryCount}/${entryConfig.maxDailyEntries})`);
                    return;
                }
                
                // Get market conditions
                const marketConditions = await this.analyzeMarketConditions();
                
                // Check each strategy for entry opportunities
                for (const strategy of entryConfig.strategies) {
                    const entry = await this.evaluateEntryOpportunity(strategy, marketConditions, entryConfig);
                    
                    if (entry.shouldEnter) {
                        console.log(`\n✅ ENTRY SIGNAL: ${strategy}`);
                        console.log(`  Symbol: ${entry.symbol}`);
                        console.log(`  Reason: ${entry.reason}`);
                        console.log(`  Score: ${entry.score}/100`);
                        
                        // Prepare the order
                        const order = await this.prepareEntryOrder(entry);
                        
                        // Add to pending actions
                        this.addPendingAction({
                            type: 'AUTOMATED_ENTRY',
                            strategy: entry.strategy,
                            symbol: entry.symbol,
                            order: order,
                            reason: entry.reason,
                            score: entry.score,
                            timestamp: Date.now()
                        });
                        
                        dailyEntryCount++;
                        
                        // Emit entry signal
                        this.emit('entrySignal', {
                            strategy,
                            entry,
                            order,
                            automated: true
                        });
                    }
                }
                
            } catch (error) {
                console.error('Error in automated entry check:', error);
            }
        };
        
        // Start monitoring
        checkForEntries(); // Initial check
        const entryInterval = setInterval(checkForEntries, entryConfig.checkInterval);
        
        // Store interval ID for cleanup
        this.entryMonitoringInterval = entryInterval;
        
        return () => {
            clearInterval(entryInterval);
            this.entryMonitoringInterval = null;
        };
    }
    
    /**
     * Analyze current market conditions
     */
    async analyzeMarketConditions() {
        const conditions = {
            vix: null,
            vixRegime: null,
            marketTrend: null,
            correlations: null,
            buyingPowerUsed: null,
            timestamp: Date.now()
        };
        
        try {
            // Get VIX level
            const vixQuote = await this.api.getMarketData(['VIX']);
            conditions.vix = vixQuote.VIX?.last || 20;
            
            // Determine VIX regime
            if (conditions.vix < 12) conditions.vixRegime = 'ULTRA_LOW';
            else if (conditions.vix < 15) conditions.vixRegime = 'LOW';
            else if (conditions.vix < 20) conditions.vixRegime = 'NORMAL';
            else if (conditions.vix < 25) conditions.vixRegime = 'ELEVATED';
            else conditions.vixRegime = 'HIGH';
            
            // Get market trend
            const spyQuote = await this.api.getMarketData(['SPY']);
            const spy = spyQuote.SPY;
            if (spy) {
                const change = ((spy.last - spy.previousClose) / spy.previousClose) * 100;
                if (change > 1) conditions.marketTrend = 'STRONG_UP';
                else if (change > 0) conditions.marketTrend = 'UP';
                else if (change > -1) conditions.marketTrend = 'DOWN';
                else conditions.marketTrend = 'STRONG_DOWN';
            }
            
            // Check correlation groups
            conditions.correlations = await this.checkCorrelationGroups();
            
            // Get buying power usage
            const account = await this.api.getAccount();
            const bpUsed = account.buying_power_used || 0;
            const bpTotal = account.buying_power || 1;
            conditions.buyingPowerUsed = (bpUsed / bpTotal) * 100;
            
        } catch (error) {
            console.error('Error analyzing market conditions:', error);
        }
        
        return conditions;
    }
    
    /**
     * Evaluate if entry conditions are met for a strategy
     */
    async evaluateEntryOpportunity(strategy, marketConditions, config) {
        const opportunity = {
            strategy,
            shouldEnter: false,
            symbol: null,
            reason: null,
            score: 0,
            strikes: null,
            expiration: null
        };
        
        // Strategy-specific entry rules
        switch(strategy) {
            case '0DTE':
                // Only on Fridays after 10:30 AM EST
                const now = new Date();
                const day = now.getDay();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const isValidTime = day === 5 && (hour > 10 || (hour === 10 && minute >= 30));
                
                if (!isValidTime) {
                    return opportunity;
                }
                
                // Check VIX for 0DTE
                if (marketConditions.vix > 30) {
                    return opportunity; // Too high volatility for 0DTE
                }
                
                opportunity.symbol = 'SPY';
                opportunity.score = 85;
                
                // VIX confirmation
                if (config.requireVIXConfirmation) {
                    if (marketConditions.vixRegime === 'NORMAL' || marketConditions.vixRegime === 'LOW') {
                        opportunity.score += 10;
                    }
                }
                
                // Check buying power
                if (marketConditions.buyingPowerUsed < 30) {
                    opportunity.score += 5;
                }
                
                if (opportunity.score >= 80) {
                    opportunity.shouldEnter = true;
                    opportunity.reason = `Friday 0DTE optimal conditions (VIX: ${marketConditions.vix.toFixed(1)})`;
                }
                break;
                
            case 'LT112':
                // Long-term 112 DTE trades
                const symbols = ['ES', 'NQ', 'CL', 'GC'];
                
                for (const symbol of symbols) {
                    // Check correlation group limits
                    const group = this.getCorrelationGroup(symbol);
                    const groupCount = marketConditions.correlations[group] || 0;
                    
                    if (groupCount >= 2) continue; // Skip if group limit reached
                    
                    opportunity.symbol = symbol;
                    opportunity.score = 70;
                    
                    // VIX-based adjustment
                    if (marketConditions.vixRegime === 'ELEVATED') {
                        opportunity.score += 15; // Better premium in elevated VIX
                    }
                    
                    // Trend confirmation
                    if (marketConditions.marketTrend === 'UP' || marketConditions.marketTrend === 'DOWN') {
                        opportunity.score += 10; // Clear trend is good for LT112
                    }
                    
                    if (opportunity.score >= 75) {
                        opportunity.shouldEnter = true;
                        opportunity.reason = `LT112 setup on ${symbol} (Group: ${group}, Count: ${groupCount})`;
                        break;
                    }
                }
                break;
                
            case 'STRANGLE':
                // Futures strangles
                const futuresSymbols = ['MCL', 'MGC', 'MNQ', 'MES'];
                
                for (const symbol of futuresSymbols) {
                    const group = this.getCorrelationGroup(symbol);
                    const groupCount = marketConditions.correlations[group] || 0;
                    
                    if (groupCount >= 2) continue;
                    
                    opportunity.symbol = symbol;
                    opportunity.score = 65;
                    
                    // High VIX favors strangles
                    if (marketConditions.vix > 20) {
                        opportunity.score += 20;
                    }
                    
                    // Check buying power
                    if (marketConditions.buyingPowerUsed < 40) {
                        opportunity.score += 15;
                    }
                    
                    if (opportunity.score >= 75) {
                        opportunity.shouldEnter = true;
                        opportunity.reason = `Strangle opportunity on ${symbol} (VIX: ${marketConditions.vix.toFixed(1)})`;
                        break;
                    }
                }
                break;
        }
        
        return opportunity;
    }
    
    /**
     * Prepare entry order based on opportunity
     */
    async prepareEntryOrder(opportunity) {
        const { orderManager } = this;
        
        try {
            // Get option chain
            const optionChain = await this.api.getOptionChain(opportunity.symbol);
            
            // Find optimal strikes using Greeks
            const strikes = await orderManager.findOptimalStrikes(
                opportunity.symbol,
                opportunity.strategy,
                optionChain
            );
            
            // Prepare the order
            const order = {
                symbol: opportunity.symbol,
                strategy: opportunity.strategy,
                strikes: strikes,
                expiration: strikes.expiration,
                quantity: this.calculatePositionSize(opportunity),
                action: 'OPEN',
                orderType: 'LIMIT',
                price: strikes.totalCredit,
                reason: opportunity.reason,
                automated: true,
                timestamp: Date.now()
            };
            
            return order;
            
        } catch (error) {
            console.error('Error preparing entry order:', error);
            return null;
        }
    }
    
    /**
     * Calculate position size based on strategy and conditions
     */
    calculatePositionSize(opportunity) {
        // Base sizes per strategy
        const baseSizes = {
            '0DTE': 1,      // Conservative for 0DTE
            'LT112': 2,     // Standard for long-term
            'STRANGLE': 1   // Start with 1 lot for strangles
        };
        
        let size = baseSizes[opportunity.strategy] || 1;
        
        // Adjust based on score
        if (opportunity.score > 90) {
            size = Math.ceil(size * 1.5);
        } else if (opportunity.score < 80) {
            size = Math.ceil(size * 0.75);
        }
        
        // Never exceed maximum position sizes
        const maxSizes = {
            '0DTE': 2,
            'LT112': 5,
            'STRANGLE': 3
        };
        
        return Math.min(size, maxSizes[opportunity.strategy] || 2);
    }
    
    /**
     * Stop automated entry monitoring
     */
    stopAutomatedEntry() {
        if (this.entryMonitoringInterval) {
            clearInterval(this.entryMonitoringInterval);
            this.entryMonitoringInterval = null;
            console.log('⏹️ Automated entry system stopped');
        }
    }
    
    /**
     * Get automation status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            running: this.monitoringInterval !== null,
            entryMonitoring: this.entryMonitoringInterval !== null,
            settings: {
                auto21DTE: this.config.auto21DTE,
                auto50Profit: this.config.auto50Profit,
                autoDefensive: this.config.autoDefensive,
                autoEmergency: this.config.autoEmergency,
                automatedEntry: this.entryMonitoringInterval !== null
            },
            pendingActions: this.pendingActions.length,
            executedToday: this.executedActions.size
        };
    }
}

module.exports = { PositionAutomation };