/**
 * Position Tracker Module
 * Comprehensive position tracking system for Tom King Trading Framework
 * Tracks all open positions with strategy tags, correlation groups, and alerts
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const { CORRELATION_GROUPS } = require('./positionManager');

const logger = getLogger();

/**
 * Position class representing a single trading position
 */
class Position {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.ticker = data.ticker;
        this.strategy = data.strategy;
        this.type = data.type; // 'OPTIONS', 'FUTURES', 'STOCKS'
        this.quantity = data.quantity;
        this.entryPrice = data.entryPrice;
        this.currentPrice = data.currentPrice || data.entryPrice;
        this.entryDate = new Date(data.entryDate);
        this.expirationDate = data.expirationDate ? new Date(data.expirationDate) : null;
        this.correlationGroup = this.getCorrelationGroup();
        this.phase = data.phase || 1;
        
        // Options specific
        this.strike = data.strike;
        this.optionType = data.optionType; // 'CALL' or 'PUT'
        this.delta = data.delta;
        this.gamma = data.gamma;
        this.theta = data.theta;
        this.vega = data.vega;
        this.iv = data.iv; // Implied Volatility
        
        // P&L tracking
        this.realizedPL = 0;
        this.commission = data.commission || 0;
        
        // Additional metadata
        this.entryReason = data.entryReason;
        this.marketConditions = data.marketConditions;
        this.vixAtEntry = data.vixAtEntry;
        this.entryWeek = data.entryWeek; // For LT112 tracking
        this.testedSide = data.testedSide; // For strangles
        
        // Alerts and notifications
        this.alerts = [];
        this.lastAlertTime = null;
        
        this.updatedAt = new Date();
        this.createdAt = new Date();
    }
    
    generateId() {
        return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getCorrelationGroup() {
        for (const [groupName, tickers] of Object.entries(CORRELATION_GROUPS)) {
            if (tickers.includes(this.ticker.toUpperCase())) {
                return groupName;
            }
        }
        return 'UNCORRELATED';
    }
    
    getDaysToExpiration() {
        if (!this.expirationDate) return null;
        const now = new Date();
        const diffTime = this.expirationDate - now;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    getUnrealizedPL() {
        const priceDiff = this.currentPrice - this.entryPrice;
        const pl = priceDiff * this.quantity;
        return {
            dollar: pl - this.commission,
            percent: ((this.currentPrice - this.entryPrice) / this.entryPrice) * 100
        };
    }
    
    getTotalPL() {
        const unrealized = this.getUnrealizedPL();
        return {
            dollar: unrealized.dollar + this.realizedPL,
            percent: unrealized.percent
        };
    }
    
    update(data) {
        if (data.currentPrice !== undefined) this.currentPrice = data.currentPrice;
        if (data.delta !== undefined) this.delta = data.delta;
        if (data.gamma !== undefined) this.gamma = data.gamma;
        if (data.theta !== undefined) this.theta = data.theta;
        if (data.vega !== undefined) this.vega = data.vega;
        if (data.iv !== undefined) this.iv = data.iv;
        if (data.testedSide !== undefined) this.testedSide = data.testedSide;
        
        this.updatedAt = new Date();
        
        // Check for alerts
        this.checkAlerts();
    }
    
    checkAlerts() {
        const alerts = [];
        const dte = this.getDaysToExpiration();
        const pl = this.getUnrealizedPL().percent;
        
        // 21 DTE Alert
        if (dte === 21) {
            alerts.push({
                type: '21_DTE_ALERT',
                priority: 'HIGH',
                message: `${this.ticker} ${this.strategy} position at 21 DTE - review for management`,
                timestamp: new Date()
            });
        }
        
        // 50% Profit Alert
        if (pl >= 50) {
            alerts.push({
                type: '50_PERCENT_PROFIT',
                priority: 'URGENT',
                message: `${this.ticker} ${this.strategy} achieved 50% profit target - consider closing`,
                timestamp: new Date()
            });
        }
        
        // 0 DTE Alert
        if (dte === 0) {
            alerts.push({
                type: '0_DTE_EXPIRATION',
                priority: 'EMERGENCY',
                message: `${this.ticker} ${this.strategy} expires TODAY - immediate action required`,
                timestamp: new Date()
            });
        }
        
        // Major loss alert
        if (pl <= -200) {
            alerts.push({
                type: 'MAJOR_LOSS',
                priority: 'HIGH',
                message: `${this.ticker} ${this.strategy} at ${pl.toFixed(1)}% loss - implement defense`,
                timestamp: new Date()
            });
        }
        
        this.alerts = [...this.alerts, ...alerts];
        
        // Keep only recent alerts (last 24 hours)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo);
    }
    
    toJSON() {
        return {
            id: this.id,
            ticker: this.ticker,
            strategy: this.strategy,
            type: this.type,
            quantity: this.quantity,
            entryPrice: this.entryPrice,
            currentPrice: this.currentPrice,
            entryDate: this.entryDate.toISOString(),
            expirationDate: this.expirationDate?.toISOString(),
            daysToExpiration: this.getDaysToExpiration(),
            correlationGroup: this.correlationGroup,
            phase: this.phase,
            strike: this.strike,
            optionType: this.optionType,
            greeks: {
                delta: this.delta,
                gamma: this.gamma,
                theta: this.theta,
                vega: this.vega
            },
            iv: this.iv,
            pl: this.getTotalPL(),
            unrealizedPL: this.getUnrealizedPL(),
            realizedPL: this.realizedPL,
            commission: this.commission,
            entryReason: this.entryReason,
            marketConditions: this.marketConditions,
            vixAtEntry: this.vixAtEntry,
            entryWeek: this.entryWeek,
            testedSide: this.testedSide,
            alerts: this.alerts,
            updatedAt: this.updatedAt.toISOString(),
            createdAt: this.createdAt.toISOString()
        };
    }
}

/**
 * Position Tracker - Main tracking system
 */
class PositionTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        this.positions = new Map();
        this.closedPositions = new Map();
        this.watchlist = new Set();
        this.alerts = [];
        this.config = {
            maxAlerts: options.maxAlerts || 100,
            alertCooldown: options.alertCooldown || 300000, // 5 minutes
            autoSave: options.autoSave !== false,
            saveInterval: options.saveInterval || 60000, // 1 minute
            ...options
        };
        
        // Start auto-save if enabled
        if (this.config.autoSave) {
            this.saveInterval = setInterval(() => {
                this.savePositions();
            }, this.config.saveInterval);
        }
        
        logger.info('POSITION_TRACKER', 'Position tracking system initialized');
    }
    
    /**
     * Add a new position to tracking
     */
    addPosition(positionData) {
        try {
            const position = new Position(positionData);
            this.positions.set(position.id, position);
            
            logger.info('POSITION_TRACKER', `Added position: ${position.ticker} ${position.strategy}`);
            
            this.emit('positionAdded', position.toJSON());
            this.emit('positionsUpdated', this.getAllPositions());
            
            return position.id;
        } catch (error) {
            logger.error('POSITION_TRACKER', `Failed to add position: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Update an existing position
     */
    updatePosition(positionId, updateData) {
        const position = this.positions.get(positionId);
        if (!position) {
            throw new Error(`Position ${positionId} not found`);
        }
        
        const oldAlertCount = position.alerts.length;
        position.update(updateData);
        const newAlertCount = position.alerts.length;
        
        // Emit alerts if new ones were generated
        if (newAlertCount > oldAlertCount) {
            const newAlerts = position.alerts.slice(oldAlertCount);
            newAlerts.forEach(alert => {
                this.emit('alert', { positionId, ...alert });
            });
        }
        
        this.emit('positionUpdated', position.toJSON());
        this.emit('positionsUpdated', this.getAllPositions());
        
        logger.debug('POSITION_TRACKER', `Updated position: ${position.ticker} ${position.strategy}`);
    }
    
    /**
     * Close a position and move to history
     */
    closePosition(positionId, exitData = {}) {
        const position = this.positions.get(positionId);
        if (!position) {
            throw new Error(`Position ${positionId} not found`);
        }
        
        // Calculate final P&L
        const finalPL = position.getUnrealizedPL();
        position.realizedPL += finalPL.dollar;
        
        // Add exit data
        position.exitPrice = exitData.exitPrice || position.currentPrice;
        position.exitDate = new Date(exitData.exitDate || Date.now());
        position.exitReason = exitData.exitReason;
        position.commission += exitData.commission || 0;
        
        // Move to closed positions
        this.closedPositions.set(positionId, position);
        this.positions.delete(positionId);
        
        logger.info('POSITION_TRACKER', 
            `Closed position: ${position.ticker} ${position.strategy} P&L: £${finalPL.dollar.toFixed(2)} (${finalPL.percent.toFixed(1)}%)`
        );
        
        this.emit('positionClosed', position.toJSON());
        this.emit('positionsUpdated', this.getAllPositions());
        
        return position.toJSON();
    }
    
    /**
     * Get all open positions
     */
    getAllPositions() {
        return Array.from(this.positions.values()).map(pos => pos.toJSON());
    }
    
    /**
     * Get positions by strategy
     */
    getPositionsByStrategy(strategy) {
        return this.getAllPositions().filter(pos => 
            pos.strategy.toLowerCase() === strategy.toLowerCase()
        );
    }
    
    /**
     * Get positions by correlation group
     */
    getPositionsByCorrelationGroup(group) {
        return this.getAllPositions().filter(pos => pos.correlationGroup === group);
    }
    
    /**
     * Get positions expiring soon
     */
    getExpiringPositions(days = 7) {
        return this.getAllPositions().filter(pos => 
            pos.daysToExpiration !== null && 
            pos.daysToExpiration <= days
        );
    }
    
    /**
     * Get positions needing attention (alerts)
     */
    getPositionsNeedingAttention() {
        return this.getAllPositions().filter(pos => pos.alerts.length > 0);
    }
    
    /**
     * Get summary statistics
     */
    getSummary() {
        const positions = this.getAllPositions();
        const totalPositions = positions.length;
        
        if (totalPositions === 0) {
            return {
                totalPositions: 0,
                totalUnrealizedPL: { dollar: 0, percent: 0 },
                positionsByStrategy: {},
                positionsByCorrelationGroup: {},
                alertCount: 0,
                expiringCount: 0
            };
        }
        
        const totalUnrealizedPL = positions.reduce((sum, pos) => ({
            dollar: sum.dollar + pos.unrealizedPL.dollar,
            percent: sum.percent + pos.unrealizedPL.percent
        }), { dollar: 0, percent: 0 });
        
        // Average percent
        totalUnrealizedPL.percent = totalUnrealizedPL.percent / totalPositions;
        
        const positionsByStrategy = {};
        const positionsByCorrelationGroup = {};
        let alertCount = 0;
        let expiringCount = 0;
        
        positions.forEach(pos => {
            // Strategy breakdown
            positionsByStrategy[pos.strategy] = (positionsByStrategy[pos.strategy] || 0) + 1;
            
            // Correlation group breakdown
            positionsByCorrelationGroup[pos.correlationGroup] = 
                (positionsByCorrelationGroup[pos.correlationGroup] || 0) + 1;
            
            // Alert count
            alertCount += pos.alerts.length;
            
            // Expiring count (within 7 days)
            if (pos.daysToExpiration !== null && pos.daysToExpiration <= 7) {
                expiringCount++;
            }
        });
        
        return {
            totalPositions,
            totalUnrealizedPL,
            positionsByStrategy,
            positionsByCorrelationGroup,
            alertCount,
            expiringCount,
            avgDaysToExpiration: this.getAverageDTE(),
            profitablePositions: positions.filter(pos => pos.unrealizedPL.percent > 0).length
        };
    }
    
    getAverageDTE() {
        const positions = this.getAllPositions().filter(pos => pos.daysToExpiration !== null);
        if (positions.length === 0) return 0;
        
        const totalDTE = positions.reduce((sum, pos) => sum + pos.daysToExpiration, 0);
        return Math.round(totalDTE / positions.length);
    }
    
    /**
     * Update all positions with new market data
     */
    updateAllPositions(marketData) {
        let updatedCount = 0;
        
        this.positions.forEach((position) => {
            const ticker = position.ticker;
            if (marketData[ticker]) {
                const data = marketData[ticker];
                position.update({
                    currentPrice: data.price,
                    delta: data.delta,
                    gamma: data.gamma,
                    theta: data.theta,
                    vega: data.vega,
                    iv: data.iv
                });
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            logger.debug('POSITION_TRACKER', `Updated ${updatedCount} positions with market data`);
            this.emit('positionsUpdated', this.getAllPositions());
        }
        
        return updatedCount;
    }
    
    /**
     * Get all active alerts
     */
    getAllAlerts() {
        const positionAlerts = [];
        
        this.positions.forEach((position) => {
            position.alerts.forEach(alert => {
                positionAlerts.push({
                    positionId: position.id,
                    ticker: position.ticker,
                    strategy: position.strategy,
                    ...alert
                });
            });
        });
        
        // Sort by priority and timestamp
        const priorityOrder = { 'EMERGENCY': 0, 'URGENT': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
        positionAlerts.sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        return positionAlerts;
    }
    
    /**
     * Save positions to storage (placeholder - implement with your storage system)
     */
    savePositions() {
        try {
            const data = {
                positions: this.getAllPositions(),
                closedPositions: Array.from(this.closedPositions.values()).map(pos => pos.toJSON()),
                timestamp: new Date().toISOString()
            };
            
            // In a real implementation, save to database or file
            // For now, just emit an event
            this.emit('positionsSaved', data);
            
            logger.debug('POSITION_TRACKER', 'Positions saved successfully');
        } catch (error) {
            logger.error('POSITION_TRACKER', `Failed to save positions: ${error.message}`);
        }
    }
    
    /**
     * Load positions from storage (placeholder - implement with your storage system)
     */
    loadPositions(data) {
        try {
            this.positions.clear();
            this.closedPositions.clear();
            
            if (data.positions) {
                data.positions.forEach(posData => {
                    const position = new Position(posData);
                    this.positions.set(position.id, position);
                });
            }
            
            if (data.closedPositions) {
                data.closedPositions.forEach(posData => {
                    const position = new Position(posData);
                    this.closedPositions.set(position.id, position);
                });
            }
            
            logger.info('POSITION_TRACKER', 
                `Loaded ${this.positions.size} active and ${this.closedPositions.size} closed positions`
            );
            
            this.emit('positionsLoaded', this.getAllPositions());
        } catch (error) {
            logger.error('POSITION_TRACKER', `Failed to load positions: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        this.positions.clear();
        this.closedPositions.clear();
        this.removeAllListeners();
        
        logger.info('POSITION_TRACKER', 'Position tracker destroyed');
    }
}

module.exports = {
    Position,
    PositionTracker
};