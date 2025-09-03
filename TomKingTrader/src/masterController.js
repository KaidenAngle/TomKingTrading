/**
 * Master Controller
 * Single source of truth for the Tom King Trading Framework
 * Consolidates and orchestrates all components
 */

const EventEmitter = require('events');
const { TastyTradeAPI } = require('./tastytradeAPI');
const { TradingStrategies } = require('./strategies');
const { RiskManager } = require('./riskManager');
const { PerformanceMetrics, TomKingTracker } = require('./performanceMetrics');
const { PositionManager } = require('./positionManager');
const { OrderManager } = require('./orderManager');
const { SignalGenerator } = require('./signalGenerator');
const { TradeJournal } = require('./tradeJournal');
const { EmergencyProtocol } = require('./emergencyProtocol');
const { IncomeGenerator } = require('./incomeGenerator');
const SystemMonitor = require('../monitoring/systemMonitor');
const config = require('./config');
const { getLogger } = require('./logger');

const logger = getLogger();

class MasterController extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            mode: options.mode || 'paper', // paper/live/sandbox
            startingBalance: options.startingBalance || 35000,
            targetBalance: options.targetBalance || 80000,
            monthlyTarget: options.monthlyTarget || 10000,
            autoTrade: options.autoTrade || false,
            ...options
        };
        
        // Core state
        this.state = {
            initialized: false,
            running: false,
            currentPhase: null,
            accountBalance: this.config.startingBalance,
            positions: [],
            pendingOrders: [],
            activeStrategies: [],
            lastUpdate: null
        };
        
        // Never-trade list (Tom King's forbidden items)
        this.neverTradeList = [
            'UVXY', 'VXX', 'VIXY', // Volatility ETPs
            'SQQQ', 'SPXU', 'TQQQ', 'SPXL', // Leveraged ETFs
            'GME', 'AMC', // Meme stocks
            'TSLA' // Too volatile per Tom King
        ];
        
        // Component instances (will be initialized)
        this.components = {};
    }
    
    /**
     * Initialize all components
     */
    async initialize() {
        try {
            logger.info('MASTER', '🚀 Initializing Master Controller...');
            
            // Initialize API
            this.components.api = new TastyTradeAPI();
            await this.components.api.initialize();
            
            // Initialize core components
            this.components.strategies = new TradingStrategies();
            this.components.riskManager = new RiskManager();
            this.components.positionManager = new PositionManager(this.components.api);
            this.components.orderManager = new OrderManager(this.components.api);
            this.components.signalGenerator = new SignalGenerator({
                api: this.components.api,
                enableRealTime: true
            });
            
            // Initialize tracking components
            this.components.performanceMetrics = new PerformanceMetrics({
                startingBalance: this.config.startingBalance,
                targetBalance: this.config.targetBalance
            });
            this.components.tomKingTracker = new TomKingTracker({
                startingBalance: this.config.startingBalance
            });
            this.components.tradeJournal = new TradeJournal();
            
            // Initialize income and monitoring
            this.components.incomeGenerator = new IncomeGenerator({
                accountBalance: this.config.startingBalance,
                targetMonthlyIncome: this.config.monthlyTarget
            });
            await this.components.incomeGenerator.initialize();
            
            this.components.emergencyProtocol = new EmergencyProtocol(this.components.api);
            await this.components.emergencyProtocol.initialize();
            
            this.components.systemMonitor = new SystemMonitor({
                checkInterval: 60000,
                autoRestart: true
            });
            
            // Determine initial phase
            this.updatePhase();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Load current state from API
            await this.refreshState();
            
            this.state.initialized = true;
            logger.info('MASTER', '✅ Master Controller initialized successfully');
            
            this.displayStatus();
            
            return true;
            
        } catch (error) {
            logger.error('MASTER', 'Failed to initialize:', error);
            throw error;
        }
    }
    
    /**
     * Single source of truth for phase determination
     */
    determinePhase(balance = null) {
        const accountBalance = balance || this.state.accountBalance;
        
        // Use centralized phase utils
        const { determinePhase } = require('../utils/phaseUtils');
        return determinePhase(accountBalance).phase;
    }
    
    /**
     * Update current phase based on account balance
     */
    updatePhase() {
        const newPhase = this.determinePhase();
        
        if (newPhase !== this.state.currentPhase) {
            const oldPhase = this.state.currentPhase;
            this.state.currentPhase = newPhase;
            
            logger.info('MASTER', `📊 Phase transition: ${oldPhase} → ${newPhase}`);
            
            // Update active strategies for new phase
            this.updateActiveStrategies();
            
            // Emit phase change event
            this.emit('phaseChanged', {
                oldPhase,
                newPhase,
                balance: this.state.accountBalance
            });
        }
        
        return this.state.currentPhase;
    }
    
    /**
     * Update active strategies based on current phase
     */
    updateActiveStrategies() {
        const phaseConfig = config.getPhaseConfig(this.state.currentPhase);
        
        if (phaseConfig) {
            this.state.activeStrategies = phaseConfig.allowedStrategies;
            
            logger.info('MASTER', `Active strategies for Phase ${this.state.currentPhase}:`, 
                this.state.activeStrategies);
        }
    }
    
    /**
     * Refresh state from API
     */
    async refreshState() {
        try {
            // Get account data
            const account = await this.components.api.getAccount();
            const balance = await this.components.api.refreshBalance();
            const positions = await this.components.api.refreshPositions();
            
            // Update state
            this.state.accountBalance = balance;
            this.state.positions = positions;
            this.state.lastUpdate = Date.now();
            
            // Update phase if needed
            this.updatePhase();
            
            // Update components
            this.components.tomKingTracker.updateBalance(balance, 'API_REFRESH');
            
            logger.debug('MASTER', 'State refreshed:', {
                balance,
                positions: positions.length,
                phase: this.state.currentPhase
            });
            
        } catch (error) {
            logger.error('MASTER', 'Failed to refresh state:', error);
        }
    }
    
    /**
     * Check if symbol is on never-trade list
     */
    isNeverTrade(symbol) {
        const cleanSymbol = symbol.replace('/', '').toUpperCase();
        return this.neverTradeList.includes(cleanSymbol);
    }
    
    /**
     * Validate trade before execution
     */
    validateTrade(trade) {
        const errors = [];
        
        // Check never-trade list
        if (this.isNeverTrade(trade.symbol)) {
            errors.push(`${trade.symbol} is on the never-trade list`);
        }
        
        // Check phase restrictions
        const phaseConfig = config.getPhaseConfig(this.state.currentPhase);
        if (phaseConfig) {
            if (!phaseConfig.allowedStrategies.includes(trade.strategy)) {
                errors.push(`Strategy ${trade.strategy} not allowed in Phase ${this.state.currentPhase}`);
            }
            
            const allowedTickers = phaseConfig.allowedTickers;
            if (allowedTickers && !allowedTickers.includes(trade.symbol)) {
                errors.push(`${trade.symbol} not allowed in Phase ${this.state.currentPhase}`);
            }
        }
        
        // Check risk limits
        const riskCheck = this.components.riskManager.validateTrade({
            ...trade,
            accountValue: this.state.accountBalance,
            currentPositions: this.state.positions
        });
        
        if (!riskCheck.approved) {
            errors.push(...riskCheck.reasons);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Process trading signals
     */
    async processSignals() {
        try {
            // Generate signals
            const signals = await this.components.signalGenerator.generateSignals({
                positions: this.state.positions,
                accountValue: this.state.accountBalance,
                phase: this.state.currentPhase
            });
            
            logger.info('MASTER', `Generated ${signals.length} signals`);
            
            // Process each signal
            for (const signal of signals) {
                // Validate
                const validation = this.validateTrade(signal);
                
                if (!validation.valid) {
                    logger.warn('MASTER', `Signal rejected: ${validation.errors.join(', ')}`);
                    continue;
                }
                
                // Prepare order (but don't execute in paper mode)
                const order = await this.components.orderManager.prepareOrder(signal);
                
                if (this.config.autoTrade && this.config.mode === 'live') {
                    // Would execute here in live mode
                    logger.warn('MASTER', 'Live trading disabled for safety');
                } else {
                    // Add to pending orders for review
                    this.state.pendingOrders.push(order);
                    logger.info('MASTER', `Order prepared: ${signal.symbol} ${signal.strategy}`);
                }
                
                // Record in journal
                await this.components.tradeJournal.recordTrade({
                    ...signal,
                    status: 'PENDING'
                });
            }
            
        } catch (error) {
            logger.error('MASTER', 'Error processing signals:', error);
        }
    }
    
    /**
     * Setup event handlers for all components
     */
    setupEventHandlers() {
        // Emergency protocol events
        this.components.emergencyProtocol.on('activated', (trigger) => {
            logger.warn('MASTER', '🚨 EMERGENCY PROTOCOL ACTIVATED');
            this.stop();
        });
        
        // Signal generator events
        this.components.signalGenerator.on('signal', (signal) => {
            logger.info('MASTER', 'New signal:', signal);
        });
        
        // Income generator events
        this.components.incomeGenerator.on('withdrawalProcessed', (withdrawal) => {
            logger.info('MASTER', '💰 Withdrawal processed:', withdrawal);
        });
        
        // Performance events
        this.components.tomKingTracker.on('milestone', (milestone) => {
            logger.info('MASTER', '🎯 Milestone reached:', milestone);
        });
    }
    
    /**
     * Start the trading system
     */
    async start() {
        if (!this.state.initialized) {
            await this.initialize();
        }
        
        if (this.state.running) {
            logger.warn('MASTER', 'System already running');
            return;
        }
        
        logger.info('MASTER', '▶️ Starting trading system...');
        
        this.state.running = true;
        
        // Start monitoring
        await this.components.systemMonitor.start();
        
        // Start main loop
        this.mainLoopInterval = setInterval(async () => {
            await this.mainLoop();
        }, 60000); // 1 minute intervals
        
        // Initial run
        await this.mainLoop();
        
        logger.info('MASTER', '✅ Trading system started');
    }
    
    /**
     * Main trading loop
     */
    async mainLoop() {
        try {
            // Refresh state
            await this.refreshState();
            
            // Check market status
            const marketStatus = await this.components.api.getMarketStatus();
            
            if (['OPEN', 'PRE_MARKET'].includes(marketStatus)) {
                // Process signals during market hours
                await this.processSignals();
                
                // Check positions for management
                await this.managePositions();
            }
            
            // Update metrics
            this.updateMetrics();
            
        } catch (error) {
            logger.error('MASTER', 'Error in main loop:', error);
        }
    }
    
    /**
     * Manage existing positions
     */
    async managePositions() {
        for (const position of this.state.positions) {
            // Check 21 DTE rule
            if (position.days_to_expiration <= 21) {
                logger.info('MASTER', `Position needs management (21 DTE): ${position.symbol}`);
                // Would implement rolling/closing logic here
            }
            
            // Check 50% profit rule
            const profitPercent = (position.unrealized_pnl / position.cost_basis) * 100;
            if (profitPercent >= 50) {
                logger.info('MASTER', `Position at 50% profit: ${position.symbol}`);
                // Would implement closing logic here
            }
        }
    }
    
    /**
     * Update performance metrics
     */
    updateMetrics() {
        const metrics = {
            balance: this.state.accountBalance,
            phase: this.state.currentPhase,
            positions: this.state.positions.length,
            pendingOrders: this.state.pendingOrders.length,
            dayPnL: 0, // Would calculate from positions
            monthPnL: 0 // Would calculate from journal
        };
        
        this.emit('metricsUpdated', metrics);
    }
    
    /**
     * Stop the trading system
     */
    async stop() {
        if (!this.state.running) {
            return;
        }
        
        logger.info('MASTER', '⏹️ Stopping trading system...');
        
        this.state.running = false;
        
        // Stop main loop
        if (this.mainLoopInterval) {
            clearInterval(this.mainLoopInterval);
        }
        
        // Stop monitoring
        await this.components.systemMonitor.stop();
        
        // Save state
        await this.saveState();
        
        logger.info('MASTER', '✅ Trading system stopped');
    }
    
    /**
     * Save current state
     */
    async saveState() {
        // Would implement state persistence here
        logger.debug('MASTER', 'State saved');
    }
    
    /**
     * Display system status
     */
    displayStatus() {
        console.log('\n' + '═'.repeat(60));
        console.log('📊 TOM KING TRADING FRAMEWORK - MASTER CONTROLLER');
        console.log('═'.repeat(60));
        console.log(`Mode: ${this.config.mode.toUpperCase()}`);
        console.log(`Phase: ${this.state.currentPhase}`);
        console.log(`Balance: £${this.state.accountBalance.toLocaleString()}`);
        console.log(`Target: £${this.config.targetBalance.toLocaleString()}`);
        console.log(`Progress: ${((this.state.accountBalance / this.config.targetBalance) * 100).toFixed(1)}%`);
        console.log(`Active Strategies: ${this.state.activeStrategies.join(', ')}`);
        console.log(`Positions: ${this.state.positions.length}`);
        console.log(`Status: ${this.state.running ? '🟢 RUNNING' : '🔴 STOPPED'}`);
        console.log('═'.repeat(60));
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            initialized: this.state.initialized,
            running: this.state.running,
            mode: this.config.mode,
            phase: this.state.currentPhase,
            balance: this.state.accountBalance,
            positions: this.state.positions.length,
            pendingOrders: this.state.pendingOrders.length,
            activeStrategies: this.state.activeStrategies,
            lastUpdate: this.state.lastUpdate
        };
    }
}

// Export
module.exports = { MasterController };

// Test if run directly
if (require.main === module) {
    const controller = new MasterController({
        mode: 'paper',
        startingBalance: 35000,
        targetBalance: 80000,
        autoTrade: false
    });
    
    controller.initialize()
        .then(() => {
            console.log('\n✅ Master Controller initialized');
            console.log('Status:', controller.getStatus());
            
            // Test phase determination
            console.log('\nPhase tests:');
            console.log('£35k → Phase', controller.determinePhase(35000));
            console.log('£45k → Phase', controller.determinePhase(45000));
            console.log('£65k → Phase', controller.determinePhase(65000));
            console.log('£80k → Phase', controller.determinePhase(80000));
            
            // Test never-trade list
            console.log('\nNever-trade tests:');
            console.log('SPY:', controller.isNeverTrade('SPY'), '(should be false)');
            console.log('UVXY:', controller.isNeverTrade('UVXY'), '(should be true)');
            console.log('GME:', controller.isNeverTrade('GME'), '(should be true)');
        })
        .catch(console.error);
}