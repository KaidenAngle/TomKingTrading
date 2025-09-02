/**
 * TOM KING TRADING FRAMEWORK v17.2
 * Unified Position Manager - Consolidates all position tracking functionality
 * ADDITIVE consolidation that uses existing position modules
 */

// Import all existing position management modules
const { PositionManager } = require('../src/positionManager');
const { PositionTracker } = require('../src/positionTracker');
const { TomKingTracker } = require('../src/tomKingTracker');
const { RiskManager } = require('../src/riskManager');
const config = require('../src/config');

/**
 * Unified Position Manager that orchestrates all position tracking modules
 */
class UnifiedPositionManager {
    constructor(api = null) {
        // Initialize all existing position modules
        this.positionManager = new PositionManager(api);
        this.positionTracker = new PositionTracker();
        this.tomKingTracker = new TomKingTracker();
        this.riskManager = new RiskManager();
        
        // Unified position storage
        this.positions = new Map(); // key: positionId, value: position object
        this.closedPositions = [];
        this.correlationGroups = new Map(); // key: group name, value: array of positions
        
        // Performance tracking
        this.performance = {
            totalPL: 0,
            realizedPL: 0,
            unrealizedPL: 0,
            winRate: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0
        };
        
        this.api = api;
    }

    /**
     * Add a new position (uses all trackers)
     */
    async addPosition(position) {
        try {
            // Generate unique position ID if not provided
            if (!position.id) {
                position.id = this.generatePositionId(position);
            }

            // Add timestamp
            position.entryTime = position.entryTime || new Date().toISOString();
            
            // Track in all systems
            const trackingResults = await Promise.all([
                this.trackInPositionManager(position),
                this.trackInPositionTracker(position),
                this.trackInTomKingTracker(position)
            ]);

            // Store in unified map
            this.positions.set(position.id, {
                ...position,
                trackingStatus: {
                    positionManager: trackingResults[0],
                    positionTracker: trackingResults[1],
                    tomKingTracker: trackingResults[2]
                }
            });

            // Update correlation groups
            this.updateCorrelationGroups(position);
            
            // Check risk limits
            const riskCheck = await this.checkRiskLimits(position);
            if (!riskCheck.passed) {
                console.warn(`Risk limit warning for position ${position.id}:`, riskCheck.warnings);
            }

            return {
                success: true,
                positionId: position.id,
                riskCheck
            };
            
        } catch (error) {
            console.error('Error adding position:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update an existing position
     */
    async updatePosition(positionId, updates) {
        const position = this.positions.get(positionId);
        if (!position) {
            return { success: false, error: 'Position not found' };
        }

        try {
            // Update in all tracking systems
            await Promise.all([
                this.updateInPositionManager(positionId, updates),
                this.updateInPositionTracker(positionId, updates),
                this.updateInTomKingTracker(positionId, updates)
            ]);

            // Update unified storage
            const updatedPosition = {
                ...position,
                ...updates,
                lastUpdate: new Date().toISOString()
            };
            
            this.positions.set(positionId, updatedPosition);
            
            // Recalculate P&L
            await this.calculatePositionPL(positionId);
            
            return { success: true, position: updatedPosition };
            
        } catch (error) {
            console.error('Error updating position:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Close a position
     */
    async closePosition(positionId, closePrice = null) {
        const position = this.positions.get(positionId);
        if (!position) {
            return { success: false, error: 'Position not found' };
        }

        try {
            // Calculate final P&L
            const finalPL = await this.calculateFinalPL(position, closePrice);
            
            // Close in all tracking systems
            await Promise.all([
                this.closeInPositionManager(positionId, closePrice),
                this.closeInPositionTracker(positionId, closePrice),
                this.closeInTomKingTracker(positionId, closePrice)
            ]);

            // Move to closed positions
            const closedPosition = {
                ...position,
                closePrice,
                closeTime: new Date().toISOString(),
                finalPL,
                status: 'CLOSED'
            };
            
            this.closedPositions.push(closedPosition);
            this.positions.delete(positionId);
            
            // Update performance metrics
            this.updatePerformanceMetrics(closedPosition);
            
            // Update correlation groups
            this.removeFromCorrelationGroups(position);
            
            return {
                success: true,
                position: closedPosition,
                finalPL
            };
            
        } catch (error) {
            console.error('Error closing position:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all open positions
     */
    getOpenPositions() {
        return Array.from(this.positions.values());
    }

    /**
     * Get positions by strategy
     */
    getPositionsByStrategy(strategy) {
        return this.getOpenPositions().filter(p => p.strategy === strategy);
    }

    /**
     * Get positions by correlation group
     */
    getPositionsByCorrelationGroup(group) {
        return this.correlationGroups.get(group) || [];
    }

    /**
     * Calculate total P&L across all positions
     */
    async calculateTotalPL() {
        let totalPL = 0;
        
        // Calculate unrealized P&L for open positions
        for (const position of this.positions.values()) {
            const pl = await this.calculatePositionPL(position.id);
            totalPL += pl;
        }
        
        // Add realized P&L from closed positions
        totalPL += this.performance.realizedPL;
        
        return totalPL;
    }

    /**
     * Get current buying power usage
     */
    async getCurrentBPUsage() {
        let totalBPUsed = 0;
        
        for (const position of this.positions.values()) {
            totalBPUsed += position.buyingPower || 0;
        }
        
        return totalBPUsed;
    }

    /**
     * Check if a new position would violate risk limits
     */
    async checkRiskLimits(position) {
        const checks = {
            passed: true,
            warnings: [],
            violations: []
        };

        // Check correlation group limits
        const group = this.getCorrelationGroup(position.symbol);
        const groupPositions = this.correlationGroups.get(group) || [];
        const phase = this.getCurrentPhase();
        const maxGroupPositions = config.PHASES[phase].maxPositionsPerGroup;
        
        if (groupPositions.length >= maxGroupPositions) {
            checks.passed = false;
            checks.violations.push(`Correlation group ${group} at limit (${maxGroupPositions})`);
        }

        // Check buying power limits
        const currentBP = await this.getCurrentBPUsage();
        const accountValue = await this.getAccountValue();
        const vixLevel = await this.getCurrentVIX();
        const maxBP = config.RISK_LIMITS.getMaxBPUsage(vixLevel);
        
        const projectedBP = (currentBP + (position.buyingPower || 0)) / accountValue;
        
        if (projectedBP > maxBP) {
            checks.passed = false;
            checks.violations.push(`BP usage would exceed limit (${(projectedBP * 100).toFixed(1)}% > ${(maxBP * 100).toFixed(0)}%)`);
        }

        // Check position risk
        const maxRiskPerTrade = config.PHASES[phase].riskLimits.maxRiskPerTrade;
        const positionRisk = (position.risk || 0) / accountValue;
        
        if (positionRisk > maxRiskPerTrade) {
            checks.warnings.push(`Position risk high (${(positionRisk * 100).toFixed(1)}% > ${(maxRiskPerTrade * 100).toFixed(0)}%)`);
        }

        return checks;
    }

    /**
     * Get comprehensive portfolio analytics
     */
    async getPortfolioAnalytics() {
        const analytics = {
            summary: {
                openPositions: this.positions.size,
                closedPositions: this.closedPositions.length,
                totalPL: await this.calculateTotalPL(),
                winRate: this.performance.winRate,
                currentBPUsage: await this.getCurrentBPUsage()
            },
            
            byStrategy: {},
            byCorrelationGroup: {},
            
            risk: {
                totalRisk: 0,
                maxDrawdown: 0,
                sharpeRatio: 0
            },
            
            performance: { ...this.performance }
        };

        // Analyze by strategy
        for (const [strategy] of Object.entries(config.STRATEGIES)) {
            const positions = this.getPositionsByStrategy(strategy);
            analytics.byStrategy[strategy] = {
                count: positions.length,
                pl: positions.reduce((sum, p) => sum + (p.unrealizedPL || 0), 0)
            };
        }

        // Analyze by correlation group
        for (const [group, positions] of this.correlationGroups.entries()) {
            analytics.byCorrelationGroup[group] = {
                count: positions.length,
                symbols: [...new Set(positions.map(p => p.symbol))]
            };
        }

        return analytics;
    }

    // Helper methods for tracking in individual systems
    async trackInPositionManager(position) {
        try {
            if (this.positionManager && typeof this.positionManager.addPosition === 'function') {
                return await this.positionManager.addPosition(position);
            }
        } catch (error) {
            console.error('PositionManager tracking error:', error);
        }
        return null;
    }

    async trackInPositionTracker(position) {
        try {
            if (this.positionTracker && typeof this.positionTracker.track === 'function') {
                return await this.positionTracker.track(position);
            }
        } catch (error) {
            console.error('PositionTracker tracking error:', error);
        }
        return null;
    }

    async trackInTomKingTracker(position) {
        try {
            if (this.tomKingTracker && typeof this.tomKingTracker.trackPosition === 'function') {
                return await this.tomKingTracker.trackPosition(position);
            }
        } catch (error) {
            console.error('TomKingTracker tracking error:', error);
        }
        return null;
    }

    async updateInPositionManager(positionId, updates) {
        try {
            if (this.positionManager && typeof this.positionManager.updatePosition === 'function') {
                return await this.positionManager.updatePosition(positionId, updates);
            }
        } catch (error) {
            console.error('PositionManager update error:', error);
        }
        return null;
    }

    async updateInPositionTracker(positionId, updates) {
        try {
            if (this.positionTracker && typeof this.positionTracker.update === 'function') {
                return await this.positionTracker.update(positionId, updates);
            }
        } catch (error) {
            console.error('PositionTracker update error:', error);
        }
        return null;
    }

    async updateInTomKingTracker(positionId, updates) {
        try {
            if (this.tomKingTracker && typeof this.tomKingTracker.updatePosition === 'function') {
                return await this.tomKingTracker.updatePosition(positionId, updates);
            }
        } catch (error) {
            console.error('TomKingTracker update error:', error);
        }
        return null;
    }

    async closeInPositionManager(positionId, closePrice) {
        try {
            if (this.positionManager && typeof this.positionManager.closePosition === 'function') {
                return await this.positionManager.closePosition(positionId, closePrice);
            }
        } catch (error) {
            console.error('PositionManager close error:', error);
        }
        return null;
    }

    async closeInPositionTracker(positionId, closePrice) {
        try {
            if (this.positionTracker && typeof this.positionTracker.close === 'function') {
                return await this.positionTracker.close(positionId, closePrice);
            }
        } catch (error) {
            console.error('PositionTracker close error:', error);
        }
        return null;
    }

    async closeInTomKingTracker(positionId, closePrice) {
        try {
            if (this.tomKingTracker && typeof this.tomKingTracker.closePosition === 'function') {
                return await this.tomKingTracker.closePosition(positionId, closePrice);
            }
        } catch (error) {
            console.error('TomKingTracker close error:', error);
        }
        return null;
    }

    // Utility methods
    generatePositionId(position) {
        return `${position.symbol}_${position.strategy}_${Date.now()}`;
    }

    updateCorrelationGroups(position) {
        const group = this.getCorrelationGroup(position.symbol);
        if (group) {
            const positions = this.correlationGroups.get(group) || [];
            positions.push(position);
            this.correlationGroups.set(group, positions);
        }
    }

    removeFromCorrelationGroups(position) {
        const group = this.getCorrelationGroup(position.symbol);
        if (group) {
            let positions = this.correlationGroups.get(group) || [];
            positions = positions.filter(p => p.id !== position.id);
            this.correlationGroups.set(group, positions);
        }
    }

    getCorrelationGroup(symbol) {
        for (const [group, config] of Object.entries(config.CORRELATION_GROUPS)) {
            if (config.tickers.includes(symbol)) {
                return group;
            }
        }
        return 'UNCATEGORIZED';
    }

    getCurrentPhase() {
        // This would normally get from account value
        // For now, return phase 1
        return 1;
    }

    async getCurrentVIX() {
        // This would normally get from market data
        // For now, return default
        return 18;
    }

    async getAccountValue() {
        // This would normally get from API
        // For now, return default
        return 35000;
    }

    async calculatePositionPL(positionId) {
        const position = this.positions.get(positionId);
        if (!position) return 0;
        
        // This would normally calculate based on current market prices
        // For now, return placeholder
        return position.unrealizedPL || 0;
    }

    async calculateFinalPL(position, closePrice) {
        // This would normally calculate based on entry and exit prices
        // For now, return placeholder
        return position.unrealizedPL || 0;
    }

    updatePerformanceMetrics(closedPosition) {
        this.performance.totalTrades++;
        
        if (closedPosition.finalPL > 0) {
            this.performance.winningTrades++;
        } else {
            this.performance.losingTrades++;
        }
        
        this.performance.realizedPL += closedPosition.finalPL;
        this.performance.winRate = this.performance.totalTrades > 0
            ? (this.performance.winningTrades / this.performance.totalTrades * 100)
            : 0;
    }
}

// Export as singleton
let instance = null;

module.exports = {
    UnifiedPositionManager,
    
    getInstance: (api = null) => {
        if (!instance) {
            instance = new UnifiedPositionManager(api);
        }
        return instance;
    },
    
    default: UnifiedPositionManager
};