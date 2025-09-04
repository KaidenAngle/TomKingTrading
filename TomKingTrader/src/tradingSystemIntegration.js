/**
 * Unified Trading System Integration
 * Orchestrates all trading components into a cohesive system
 * 
 * This module unifies:
 * - Risk Management
 * - Position Management  
 * - Strategy Execution
 * - Data Management
 * - Performance Tracking
 */

const EventEmitter = require('events');
const { RiskManager } = require('./riskManager');
const { PositionManager } = require('./positionManager');
const { TradingStrategies } = require('./strategies');
const { Section9BStrategies } = require('./section9BStrategies');
const { SignalGenerator } = require('./signalGenerator');
const { PerformanceMetrics } = require('./performanceMetrics');
const { TastyTradeAPI } = require('./tastytradeAPI');
const { getLogger } = require('./logger');

const logger = getLogger();

class UnifiedTradingSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            startingBalance: options.startingBalance || 35000,
            goalBalance: options.goalBalance || 80000,
            targetBPUsage: options.targetBPUsage || 'DYNAMIC', // VIX-based
            enableRealTimeUpdates: options.enableRealTimeUpdates || true,
            dashboardUpdateInterval: options.dashboardUpdateInterval || 30000,
            maxRiskPerTrade: 0.05, // 5% max risk per trade
            maxCorrelatedPositions: 4 // Phase 4 maximum
        };

        // Initialize core components
        this.api = null; // Will be injected
        this.riskManager = new RiskManager();
        this.positionManager = new PositionManager();
        this.coreStrategies = new TradingStrategies();
        this.section9BStrategies = new Section9BStrategies();
        this.signalGenerator = new SignalGenerator();
        this.performanceMetrics = new PerformanceMetrics();
        
        // System state
        this.isInitialized = false;
        this.currentPhase = 1;
        this.accountBalance = this.config.startingBalance;
        this.positions = [];
        
        // Bind event handlers
        this.setupEventHandlers();
        
        logger.info('UNIFIED_SYSTEM', 'UnifiedTradingSystem initialized');
    }

    /**
     * Initialize the unified trading system
     */
    async initialize(api = null) {
        if (api) {
            this.api = api;
        }
        
        if (this.api && !this.api.connected) {
            await this.api.initialize();
        }
        
        // Update account information
        await this.updateAccountInfo();
        
        // Initialize all subsystems
        await this.initializeSubsystems();
        
        this.isInitialized = true;
        this.emit('system:initialized');
        
        logger.info('UNIFIED_SYSTEM', 'System fully initialized', {
            phase: this.currentPhase,
            balance: this.accountBalance,
            bpUsage: this.getCurrentBPUsage()
        });
    }

    /**
     * Update account information from API
     */
    async updateAccountInfo() {
        if (!this.api || !this.api.connected) {
            return;
        }

        try {
            const balance = await this.api.refreshBalance();
            if (balance) {
                this.accountBalance = parseFloat(balance.netLiquidatingValue?.replace(/[$,]/g, '')) || this.accountBalance;
                this.currentPhase = this.determinePhase(this.accountBalance);
                
                this.emit('account:updated', {
                    balance: this.accountBalance,
                    phase: this.currentPhase
                });
            }
        } catch (error) {
            logger.error('UNIFIED_SYSTEM', 'Failed to update account info', error);
        }
    }

    /**
     * Determine current phase based on account balance
     */
    determinePhase(balance) {
        if (balance >= 75000) return 4;      // Phase 4: Professional ($75k+)
        if (balance >= 60000) return 3;      // Phase 3: Advanced ($60-75k)
        if (balance >= 40000) return 2;      // Phase 2: Expansion ($40-60k)
        return 1;                            // Phase 1: Foundation ($30-40k)
    }

    /**
     * Initialize all subsystems
     */
    async initializeSubsystems() {
        // Initialize signal generator with current config
        this.signalGenerator.updateConfig({
            accountBalance: this.accountBalance,
            phase: this.currentPhase,
            maxRiskPerTrade: this.config.maxRiskPerTrade
        });

        // Initialize position manager
        if (this.api) {
            this.positionManager.setAPI(this.api);
            this.positions = await this.positionManager.refreshPositions() || [];
        }

        // Initialize performance tracking
        this.performanceMetrics.setAccountBalance(this.accountBalance);
    }

    /**
     * Setup event handlers between components
     */
    setupEventHandlers() {
        // Risk management is not an EventEmitter - handle alerts differently
        // this.riskManager.on('risk:alert', ...) // Removed - RiskManager doesn't extend EventEmitter

        // Position updates - PositionManager is not an EventEmitter
        // Handle position updates through direct calls instead of events

        // Signal generation
        this.signalGenerator.on('signal:generated', (signal) => {
            this.emit('system:signal', signal);
            this.processSignal(signal);
        });
    }

    /**
     * Get current buying power usage
     */
    getCurrentBPUsage() {
        if (!this.api || !this.api.accountBalance) {
            return 0;
        }

        const netLiq = parseFloat(this.api.accountBalance.netLiquidatingValue?.replace(/[$,]/g, '') || '0');
        const buyingPower = parseFloat(this.api.accountBalance.buyingPower?.replace(/[$,]/g, '') || netLiq);
        const usedBP = netLiq - buyingPower;
        
        return netLiq > 0 ? usedBP / netLiq : 0;
    }

    /**
     * Get maximum allowed BP usage based on VIX
     */
    getMaxBPUsage(vixLevel = 20) {
        return this.riskManager.getMaxBPUsage(vixLevel);
    }

    /**
     * Get available strategies for current phase
     */
    getAvailableStrategies(marketConditions = {}) {
        const phaseStrategies = this.coreStrategies.getStrategiesForPhase(this.currentPhase);
        const section9BStrategies = this.section9BStrategies.getAvailableStrategies(
            { phase: this.currentPhase, balance: this.accountBalance },
            marketConditions
        );

        return {
            core: phaseStrategies,
            section9B: section9BStrategies,
            total: phaseStrategies.length + section9BStrategies.totalStrategies
        };
    }

    /**
     * Process a generated signal
     */
    async processSignal(signal) {
        try {
            // Validate signal against current risk limits
            const riskCheck = await this.validateSignalRisk(signal);
            if (!riskCheck.approved) {
                logger.warn('SIGNAL_REJECTED', riskCheck.reason, signal);
                return;
            }

            // Execute signal based on mode
            if (this.config.enableRealTimeUpdates) {
                await this.executeSignal(signal);
            } else {
                this.emit('system:signal_prepared', signal);
            }

        } catch (error) {
            logger.error('UNIFIED_SYSTEM', 'Error processing signal', error);
        }
    }

    /**
     * Validate signal against risk parameters
     */
    async validateSignalRisk(signal) {
        const currentBPUsage = this.getCurrentBPUsage();
        const maxBPUsage = this.getMaxBPUsage(signal.marketConditions?.vix);
        
        // Check BP usage limits
        if (currentBPUsage >= maxBPUsage) {
            return {
                approved: false,
                reason: `BP usage (${(currentBPUsage * 100).toFixed(1)}%) exceeds limit (${(maxBPUsage * 100).toFixed(1)}%)`
            };
        }

        // Check correlation limits
        const correlationCheck = this.riskManager.validateCorrelationLimits(
            this.positions,
            signal.underlying,
            this.currentPhase
        );

        if (!correlationCheck.approved) {
            return correlationCheck;
        }

        // Check individual trade risk
        const tradeRisk = signal.maxRisk || 0;
        const maxTradeRisk = this.accountBalance * this.config.maxRiskPerTrade;
        
        if (tradeRisk > maxTradeRisk) {
            return {
                approved: false,
                reason: `Trade risk ($${tradeRisk}) exceeds limit ($${maxTradeRisk.toFixed(0)})`
            };
        }

        return { approved: true };
    }

    /**
     * Execute a validated signal
     */
    async executeSignal(signal) {
        // This would execute the actual trade in live mode
        // For now, just log and emit event
        logger.info('SIGNAL_EXECUTION', 'Executing signal', signal);
        this.emit('system:signal_executed', signal);
    }

    /**
     * Update system state
     */
    async updateSystemState() {
        await this.updateAccountInfo();
        await this.positionManager.refreshPositions();
        
        this.emit('system:state_updated', {
            phase: this.currentPhase,
            balance: this.accountBalance,
            positions: this.positions.length,
            bpUsage: this.getCurrentBPUsage()
        });
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            phase: this.currentPhase,
            balance: this.accountBalance,
            bpUsage: this.getCurrentBPUsage(),
            positions: this.positions.length,
            apiConnected: this.api?.connected || false,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * Shutdown system gracefully
     */
    async shutdown() {
        logger.info('UNIFIED_SYSTEM', 'Shutting down trading system');
        
        // Stop all subsystems
        this.signalGenerator.stop();
        
        // Clear intervals
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.emit('system:shutdown');
        this.removeAllListeners();
    }
}

module.exports = { UnifiedTradingSystem };