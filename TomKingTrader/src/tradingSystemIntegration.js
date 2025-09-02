/**
 * Trading System Integration Module
 * Integrates all position tracking, P&L calculation, dashboard, and Tom King specific systems
 * Provides unified interface for the complete trading framework
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

// Import all tracking systems from consolidated modules
// PositionTracker functionality is now in PositionManager
const { PLCalculationEngine, TomKingTracker } = require('./performanceMetrics'); // Consolidated P&L tracking
const { DashboardDataManager, HTMLDashboardGenerator } = require('./performanceDashboard');
const { TradeJournal } = require('./tradeJournal');
const { PositionManager } = require('./positionManager');

const logger = getLogger();

/**
 * Unified Trading System
 * Orchestrates all tracking and reporting systems
 */
class UnifiedTradingSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            startingBalance: options.startingBalance || 35000,
            goalBalance: options.goalBalance || 80000,
            targetBPUsage: options.targetBPUsage || 35,
            autoSave: options.autoSave !== false,
            enableRealTimeUpdates: options.enableRealTimeUpdates !== false,
            dashboardUpdateInterval: options.dashboardUpdateInterval || 30000, // 30 seconds
            ...options
        };
        
        // Initialize all subsystems
        this.initializeSubsystems();
        
        // Set up event handling between systems
        this.setupEventHandlers();
        
        // Start real-time updates if enabled
        if (this.options.enableRealTimeUpdates) {
            this.startRealTimeUpdates();
        }
        
        logger.info('UNIFIED_SYSTEM', 'Unified Trading System initialized');
    }
    
    /**
     * Initialize all subsystems
     */
    initializeSubsystems() {
        try {
            // Core tracking systems
            this.positionTracker = new PositionManager({  // Using PositionManager instead
                autoSave: this.options.autoSave,
                maxAlerts: 50
            });
            
            this.plEngine = new PLCalculationEngine({
                autoCalculateHistorical: true,
                updateInterval: 60000 // 1 minute
            });
            
            this.tradeJournal = new TradeJournal({
                autoSave: this.options.autoSave,
                exportDir: './exports'
            });
            
            this.tomKingTracker = new TomKingTracker({
                startingBalance: this.options.startingBalance,
                goalBalance: this.options.goalBalance
            });
            
            this.positionManager = new PositionManager();
            
            // Dashboard system (initialized after other systems)
            this.dashboardManager = new DashboardDataManager(
                this.positionTracker,
                this.plEngine
            );
            
            // System state
            this.isInitialized = true;
            this.lastUpdate = null;
            this.systemHealth = 'GOOD';
            
            logger.info('UNIFIED_SYSTEM', 'All subsystems initialized successfully');
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to initialize subsystems: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Set up event handlers between systems
     */
    setupEventHandlers() {
        // Position tracker events
        this.positionTracker.on('positionAdded', (position) => {
            this.onPositionAdded(position);
        });
        
        this.positionTracker.on('positionUpdated', (position) => {
            this.onPositionUpdated(position);
        });
        
        this.positionTracker.on('positionClosed', (position) => {
            this.onPositionClosed(position);
        });
        
        this.positionTracker.on('alert', (alert) => {
            this.onAlert(alert);
        });
        
        // P&L engine events
        this.plEngine.on('plCalculated', (plData) => {
            this.onPLCalculated(plData);
        });
        
        this.plEngine.on('tradeCompleted', (trade) => {
            this.onTradeCompleted(trade);
        });
        
        // Dashboard events
        this.dashboardManager.on('dashboardUpdated', (dashboardData) => {
            this.onDashboardUpdated(dashboardData);
        });
        
        // Tom King tracker events
        this.tomKingTracker.on('balanceUpdated', (data) => {
            this.onBalanceUpdated(data);
        });
        
        this.tomKingTracker.on('buyingPowerUpdated', (data) => {
            this.onBuyingPowerUpdated(data);
        });
        
        logger.info('UNIFIED_SYSTEM', 'Event handlers configured');
    }
    
    /**
     * Position added event handler
     */
    onPositionAdded(position) {
        try {
            // Log trade in journal
            const tradeEntry = {
                ...position,
                type: 'ENTRY',
                timestamp: position.entryDate || new Date(),
                isActive: true
            };
            
            this.tradeJournal.logTrade(tradeEntry);
            
            // Update position manager
            this.positionManager.updatePositions([position]);
            
            // Update Tom King tracker
            this.updateTomKingSystems();
            
            this.emit('positionAdded', position);
            
            logger.info('UNIFIED_SYSTEM', `Position added: ${position.ticker} ${position.strategy}`);
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling position add: ${error.message}`);
        }
    }
    
    /**
     * Position updated event handler
     */
    onPositionUpdated(position) {
        try {
            // Calculate P&L for updated positions
            const positions = this.positionTracker.getAllPositions();
            this.plEngine.calculateRealTimePL(positions);
            
            // Update position manager
            this.positionManager.updatePositions(positions);
            
            this.emit('positionUpdated', position);
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling position update: ${error.message}`);
        }
    }
    
    /**
     * Position closed event handler
     */
    onPositionClosed(position) {
        try {
            // Close trade in journal
            const exitData = {
                exitTimestamp: position.exitDate || new Date(),
                exitPrice: position.exitPrice || position.currentPrice,
                exitReason: position.exitReason || 'Manual close',
                realizedPL: position.pl?.dollar || 0,
                commission: position.commission || 0
            };
            
            this.tradeJournal.closeTrade(position.id, exitData);
            
            // Record in P&L engine
            this.plEngine.recordCompletedTrade({
                ...position,
                ...exitData
            });
            
            // Update Tom King tracker
            this.tomKingTracker.updateWithTrade({
                ...position,
                ...exitData,
                isActive: false
            });
            
            this.emit('positionClosed', position);
            
            logger.info('UNIFIED_SYSTEM', 
                `Position closed: ${position.ticker} ${position.strategy} - P&L: £${exitData.realizedPL?.toFixed(2) || '0.00'}`
            );
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling position close: ${error.message}`);
        }
    }
    
    /**
     * Alert event handler
     */
    onAlert(alert) {
        try {
            // Log high priority alerts
            if (['EMERGENCY', 'URGENT'].includes(alert.priority)) {
                logger.warn('UNIFIED_SYSTEM', `${alert.priority} Alert: ${alert.message}`);
            }
            
            this.emit('alert', alert);
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling alert: ${error.message}`);
        }
    }
    
    /**
     * P&L calculated event handler
     */
    onPLCalculated(plData) {
        try {
            // Update Tom King tracker with new balance if available
            if (plData.portfolio?.totalCurrentValue) {
                this.tomKingTracker.updateBalance(plData.portfolio.totalCurrentValue, 'P&L_UPDATE');
            }
            
            this.emit('plCalculated', plData);
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling P&L calculation: ${error.message}`);
        }
    }
    
    /**
     * Trade completed event handler
     */
    onTradeCompleted(trade) {
        try {
            this.emit('tradeCompleted', trade);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling trade completion: ${error.message}`);
        }
    }
    
    /**
     * Dashboard updated event handler
     */
    onDashboardUpdated(dashboardData) {
        try {
            this.lastUpdate = new Date();
            this.emit('dashboardUpdated', dashboardData);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling dashboard update: ${error.message}`);
        }
    }
    
    /**
     * Balance updated event handler
     */
    onBalanceUpdated(data) {
        try {
            this.emit('balanceUpdated', data);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling balance update: ${error.message}`);
        }
    }
    
    /**
     * Buying power updated event handler
     */
    onBuyingPowerUpdated(data) {
        try {
            this.emit('buyingPowerUpdated', data);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error handling BP update: ${error.message}`);
        }
    }
    
    /**
     * Update Tom King specific systems
     */
    updateTomKingSystems() {
        try {
            const positions = this.positionTracker.getAllPositions();
            const summary = this.positionTracker.getSummary();
            
            // Update buying power tracking
            if (summary.totalUnrealizedPL) {
                const bpData = {
                    totalBP: this.options.startingBalance + summary.totalUnrealizedPL.dollar, // Simplified
                    usedBP: this.calculateUsedBP(positions),
                    positionCount: positions.length,
                    byStrategy: this.groupByStrategy(positions),
                    byCorrelationGroup: this.groupByCorrelationGroup(positions)
                };
                
                this.tomKingTracker.updateBuyingPower(bpData);
            }
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error updating Tom King systems: ${error.message}`);
        }
    }
    
    /**
     * Calculate used buying power (simplified)
     */
    calculateUsedBP(positions) {
        return positions.reduce((total, position) => {
            const estimatedBP = Math.abs(position.entryPrice * position.quantity) * 0.2; // 20% estimate
            return total + estimatedBP;
        }, 0);
    }
    
    /**
     * Group positions by strategy
     */
    groupByStrategy(positions) {
        const grouped = {};
        positions.forEach(position => {
            const strategy = position.strategy;
            grouped[strategy] = (grouped[strategy] || 0) + 1;
        });
        return grouped;
    }
    
    /**
     * Group positions by correlation group
     */
    groupByCorrelationGroup(positions) {
        const grouped = {};
        positions.forEach(position => {
            const group = position.correlationGroup || 'UNCORRELATED';
            grouped[group] = (grouped[group] || 0) + 1;
        });
        return grouped;
    }
    
    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.performRealTimeUpdate();
        }, this.options.dashboardUpdateInterval);
        
        logger.info('UNIFIED_SYSTEM', 'Real-time updates started');
    }
    
    /**
     * Perform real-time update
     */
    performRealTimeUpdate() {
        try {
            const positions = this.positionTracker.getAllPositions();
            
            // Update P&L calculations
            if (positions.length > 0) {
                this.plEngine.calculateRealTimePL(positions);
            }
            
            // Update Tom King systems
            this.updateTomKingSystems();
            
            this.lastUpdate = new Date();
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Real-time update failed: ${error.message}`);
        }
    }
    
    /**
     * PUBLIC API METHODS
     */
    
    /**
     * Add a new position
     */
    async addPosition(positionData) {
        try {
            return this.positionTracker.addPosition(positionData);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to add position: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Update a position
     */
    async updatePosition(positionId, updateData) {
        try {
            return this.positionTracker.updatePosition(positionId, updateData);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to update position: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Close a position
     */
    async closePosition(positionId, exitData = {}) {
        try {
            return this.positionTracker.closePosition(positionId, exitData);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to close position: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Update multiple positions with market data
     */
    async updatePositionsWithMarketData(marketData) {
        try {
            return this.positionTracker.updateAllPositions(marketData);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to update with market data: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get all positions
     */
    getAllPositions() {
        return this.positionTracker.getAllPositions();
    }
    
    /**
     * Get current P&L
     */
    getCurrentPL() {
        return this.plEngine.getCurrentPL();
    }
    
    /**
     * Get comprehensive dashboard data
     */
    getDashboardData() {
        return this.dashboardManager.getDashboardData();
    }
    
    /**
     * Generate HTML dashboard
     */
    generateHTMLDashboard() {
        const dashboardData = this.getDashboardData();
        return HTMLDashboardGenerator.generateDashboard(dashboardData);
    }
    
    /**
     * Get trade journal analytics
     */
    getTradeAnalytics(filters = {}) {
        return this.tradeJournal.getAnalytics(filters);
    }
    
    /**
     * Get Tom King specific metrics
     */
    getTomKingMetrics() {
        return this.tomKingTracker.getComprehensiveMetrics();
    }
    
    /**
     * Get position manager report
     */
    getPositionManagerReport() {
        return this.positionManager.generateReport();
    }
    
    /**
     * Get comprehensive system status
     */
    getSystemStatus() {
        try {
            const positions = this.positionTracker.getAllPositions();
            const summary = this.positionTracker.getSummary();
            const currentPL = this.plEngine.getCurrentPL();
            const tomKingMetrics = this.tomKingTracker.getComprehensiveMetrics();
            const alerts = this.positionTracker.getAllAlerts();
            
            return {
                timestamp: new Date().toISOString(),
                isInitialized: this.isInitialized,
                systemHealth: this.systemHealth,
                lastUpdate: this.lastUpdate?.toISOString(),
                summary: {
                    totalPositions: positions.length,
                    totalUnrealizedPL: summary.totalUnrealizedPL,
                    alertCount: alerts.length,
                    urgentAlerts: alerts.filter(a => ['EMERGENCY', 'URGENT'].includes(a.priority)).length
                },
                tomKing: {
                    currentPhase: tomKingMetrics.phaseProgression?.currentPhase,
                    goalProgress: tomKingMetrics.goalProgress?.progressPercent,
                    friday0DTEWinRate: tomKingMetrics.friday0DTE?.currentWinRate,
                    bpUsage: tomKingMetrics.buyingPower?.current?.usagePercent
                },
                performance: {
                    currentPL: currentPL?.portfolio?.totalDollarPL || 0,
                    todaysPL: 0, // Would need daily tracking
                    monthlyPL: 0 // Would need monthly tracking
                }
            };
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to get system status: ${error.message}`);
            return {
                timestamp: new Date().toISOString(),
                isInitialized: false,
                systemHealth: 'ERROR',
                error: error.message
            };
        }
    }
    
    /**
     * Export trades to CSV
     */
    async exportTrades(filters = {}, filename = null) {
        try {
            return await this.tradeJournal.exportToCSV(filters, filename);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to export trades: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Export analytics report
     */
    async exportAnalytics(filters = {}, filename = null) {
        try {
            return await this.tradeJournal.exportAnalyticsReport(filters, filename);
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to export analytics: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Generate comprehensive report
     */
    generateComprehensiveReport() {
        try {
            const systemStatus = this.getSystemStatus();
            const tomKingMetrics = this.getTomKingMetrics();
            const tradeAnalytics = this.getTradeAnalytics();
            const positionReport = this.getPositionManagerReport();
            const plReport = this.plEngine.generatePLReport();
            
            return {
                timestamp: new Date().toISOString(),
                reportType: 'COMPREHENSIVE_SYSTEM_REPORT',
                systemStatus,
                tomKingMetrics,
                tradeAnalytics,
                positionReport,
                plReport,
                summary: {
                    totalPositions: systemStatus.summary.totalPositions,
                    totalPL: plReport.current?.portfolio?.totalDollarPL || 0,
                    winRate: tradeAnalytics.summary?.winRate || 0,
                    goalProgress: tomKingMetrics.goalProgress?.progressPercent || 0,
                    systemHealth: systemStatus.systemHealth
                }
            };
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to generate comprehensive report: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Save all system data
     */
    async saveAllData() {
        try {
            // Trigger save events for all systems
            this.positionTracker.savePositions();
            this.tradeJournal.saveTrades();
            
            logger.info('UNIFIED_SYSTEM', 'All system data saved');
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to save system data: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Load system data
     */
    async loadAllData(data) {
        try {
            if (data.positions) {
                this.positionTracker.loadPositions(data.positions);
            }
            
            if (data.trades) {
                this.tradeJournal.loadTrades(data.trades);
            }
            
            logger.info('UNIFIED_SYSTEM', 'All system data loaded');
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Failed to load system data: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Cleanup and destroy all systems
     */
    destroy() {
        try {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            
            // Destroy all subsystems
            this.positionTracker?.destroy();
            this.plEngine?.destroy();
            this.tradeJournal?.destroy();
            this.tomKingTracker?.destroy();
            this.dashboardManager?.destroy();
            
            // Clear all references
            this.positionTracker = null;
            this.plEngine = null;
            this.tradeJournal = null;
            this.tomKingTracker = null;
            this.dashboardManager = null;
            this.positionManager = null;
            
            this.removeAllListeners();
            
            logger.info('UNIFIED_SYSTEM', 'Unified Trading System destroyed');
            
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', `Error during destruction: ${error.message}`);
        }
    }
}

module.exports = {
    UnifiedTradingSystem
};