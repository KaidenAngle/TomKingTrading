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
     * Roll position to next expiration
     */
    async rollPosition(order, reason) {
        logger.info('AUTOMATION', `ROLLING: ${order.symbol} - ${reason}`);
        
        // Find next appropriate expiration
        const optionChain = await this.api.getOptionChain(order.symbol);
        const nextExpiration = this.findNextExpiration(optionChain, order.strategy);
        
        if (!nextExpiration) {
            logger.warn('AUTOMATION', `Cannot roll ${order.symbol} - no suitable expiration`);
            // Fall back to closing
            await this.closePosition(order, `${reason} (roll unavailable)`);
            return;
        }
        
        // Prepare roll order
        const rollOrder = {
            closeLegs: order,
            openLegs: {
                ...order,
                expiration: nextExpiration.expiration,
                strikes: await this.orderManager.findOptimalStrikes(order.symbol, order.strategy, optionChain)
            }
        };
        
        this.emit('positionRolled', {
            order: rollOrder,
            reason,
            automated: true
        });
        
        logger.info('AUTOMATION', `Position rolled: ${order.symbol}`, rollOrder);
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
     * Get automation status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            running: this.monitoringInterval !== null,
            settings: {
                auto21DTE: this.config.auto21DTE,
                auto50Profit: this.config.auto50Profit,
                autoDefensive: this.config.autoDefensive,
                autoEmergency: this.config.autoEmergency
            },
            pendingActions: this.pendingActions.length,
            executedToday: this.executedActions.size
        };
    }
}

module.exports = { PositionAutomation };