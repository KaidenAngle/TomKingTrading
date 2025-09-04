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
            previousPhase: null,
            phaseTransitionHistory: [],
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
     * PHASE TRANSITION SYSTEM
     * Manages automatic transitions between account phases as balance grows
     * Adjusts strategies, position sizes, and risk parameters
     */
    
    /**
     * Check and execute phase transitions
     * Called on every balance update
     */
    async checkPhaseTransition(currentBalance) {
        const newPhase = this.determinePhase(currentBalance);
        const currentPhase = this.state.currentPhase;
        
        // Check if phase has changed
        if (newPhase !== currentPhase) {
            await this.executePhaseTransition(currentPhase, newPhase, currentBalance);
        }
        
        // Check for phase-specific milestones
        this.checkPhaseMilestones(newPhase, currentBalance);
    }
    
    /**
     * Execute phase transition
     * Updates strategies, risk parameters, and notifications
     */
    async executePhaseTransition(fromPhase, toPhase, balance) {
        logger.info('PHASE_TRANSITION', `🎆 PHASE TRANSITION: ${fromPhase || 'START'} → ${toPhase}`);
        logger.info('PHASE_TRANSITION', `Account balance: £${balance.toLocaleString()}`);
        
        // Record transition
        const transition = {
            timestamp: new Date(),
            fromPhase,
            toPhase,
            balance,
            type: this.getTransitionType(fromPhase, toPhase)
        };
        
        this.state.phaseTransitionHistory.push(transition);
        this.state.previousPhase = fromPhase;
        this.state.currentPhase = toPhase;
        
        // Update phase-specific configurations
        await this.applyPhaseConfiguration(toPhase);
        
        // Adjust existing positions if needed
        await this.adjustPositionsForPhase(toPhase);
        
        // Send notifications
        this.notifyPhaseTransition(transition);
        
        // Emit event
        this.emit('phaseTransition', transition);
    }
    
    /**
     * Get transition type (upgrade/downgrade)
     */
    getTransitionType(fromPhase, toPhase) {
        if (!fromPhase) return 'INITIAL';
        if (toPhase > fromPhase) return 'UPGRADE';
        if (toPhase < fromPhase) return 'DOWNGRADE';
        return 'UNCHANGED';
    }
    
    /**
     * Apply phase-specific configuration
     */
    async applyPhaseConfiguration(phase) {
        const phaseConfig = this.getPhaseConfiguration(phase);
        
        logger.info('PHASE_CONFIG', `Applying Phase ${phase} configuration...`);
        
        // Update risk parameters
        if (this.components.riskManager) {
            this.components.riskManager.updatePhaseSettings({
                phase,
                maxBPUsage: phaseConfig.maxBPUsage,
                maxCorrelatedPositions: phaseConfig.maxCorrelatedPositions,
                maxRiskPerTrade: phaseConfig.maxRiskPerTrade
            });
        }
        
        // Update available strategies
        this.state.activeStrategies = phaseConfig.availableStrategies;
        
        // Update position sizing
        if (this.components.positionManager) {
            this.components.positionManager.updatePhaseSettings({
                phase,
                defaultPositionSize: phaseConfig.defaultPositionSize,
                maxPositions: phaseConfig.maxPositions
            });
        }
        
        // Update income targets
        if (this.components.incomeGenerator) {
            this.components.incomeGenerator.updatePhaseTargets({
                phase,
                monthlyTarget: phaseConfig.monthlyIncomeTarget,
                withdrawalAllowed: phaseConfig.withdrawalAllowed
            });
        }
        
        logger.info('PHASE_CONFIG', `Phase ${phase} configuration applied successfully`);
    }
    
    /**
     * Get configuration for specific phase
     */
    getPhaseConfiguration(phase) {
        const configs = {
            1: { // £30-40k - Foundation Building
                name: 'Foundation Building',
                minBalance: 30000,
                maxBalance: 40000,
                maxBPUsage: 'DYNAMIC', // VIX-based: uses RISK_LIMITS.getMaxBPUsage()
                maxCorrelatedPositions: 2,
                maxRiskPerTrade: 0.02, // 2% max risk
                defaultPositionSize: 0.05, // 5% of account
                maxPositions: 8,
                monthlyIncomeTarget: 0, // Focus on growth
                withdrawalAllowed: false,
                availableStrategies: [
                    'MCL_STRANGLE',
                    'MGC_STRANGLE', 
                    'GLD_TLT_STRANGLE',
                    '0DTE_FRIDAY'
                ],
                tradingRules: [
                    'Micro futures only',
                    'Max 2 correlated positions',
                    'No withdrawals - compound only',
                    '0DTE Friday only with VIX > 22'
                ]
            },
            2: { // £40-60k - Expansion
                name: 'Expansion',
                minBalance: 40000,
                maxBalance: 60000,
                maxBPUsage: 'DYNAMIC', // VIX-based: uses RISK_LIMITS.getMaxBPUsage()
                maxCorrelatedPositions: 3,
                maxRiskPerTrade: 0.025, // 2.5% max risk
                defaultPositionSize: 0.06, // 6% of account
                maxPositions: 10,
                monthlyIncomeTarget: 2000, // Small income
                withdrawalAllowed: true,
                availableStrategies: [
                    'MCL_STRANGLE',
                    'MGC_STRANGLE',
                    'GLD_TLT_STRANGLE',
                    'MES_STRANGLE',
                    'MNQ_STRANGLE',
                    '0DTE_FRIDAY',
                    'LT112'
                ],
                tradingRules: [
                    'Add MES/MNQ strangles',
                    'Can start LT112 strategies',
                    'Limited withdrawals allowed',
                    'Max 3 correlated positions'
                ]
            },
            3: { // £60-75k - Optimization
                name: 'Optimization', 
                minBalance: 60000,
                maxBalance: 75000,
                maxBPUsage: 'DYNAMIC', // VIX-based: uses RISK_LIMITS.getMaxBPUsage()
                maxCorrelatedPositions: 3,
                maxRiskPerTrade: 0.03, // 3% max risk
                defaultPositionSize: 0.08, // 8% of account
                maxPositions: 12,
                monthlyIncomeTarget: 5000, // Target income
                withdrawalAllowed: true,
                availableStrategies: [
                    'ES_STRANGLE', // Full-size futures
                    'NQ_STRANGLE',
                    'CL_STRANGLE',
                    'GC_STRANGLE',
                    '0DTE_FRIDAY',
                    'LT112',
                    'IPMCC',
                    'BUTTERFLY',
                    'BROKEN_WING_CONDOR'
                ],
                tradingRules: [
                    'Full-size futures available',
                    'Complex spreads enabled',
                    'Regular income withdrawals',
                    'Section 9B strategies'
                ]
            },
            4: { // £75k+ - Professional
                name: 'Professional',
                minBalance: 75000,
                maxBalance: null,
                maxBPUsage: 'DYNAMIC', // VIX-based: uses RISK_LIMITS.getMaxBPUsage()
                maxCorrelatedPositions: 4,
                maxRiskPerTrade: 0.05, // 5% max risk
                defaultPositionSize: 0.10, // 10% of account
                maxPositions: 15,
                monthlyIncomeTarget: 10000, // Full income target
                withdrawalAllowed: true,
                availableStrategies: [
                    'ALL' // All strategies available
                ],
                tradingRules: [
                    'All strategies available',
                    'Maximum flexibility',
                    'Focus on income generation',
                    'Professional risk management'
                ]
            }
        };
        
        return configs[phase] || configs[1];
    }
    
    /**
     * Adjust existing positions for new phase
     */
    async adjustPositionsForPhase(newPhase) {
        const phaseConfig = this.getPhaseConfiguration(newPhase);
        const currentPositions = this.state.positions;
        
        logger.info('PHASE_ADJUST', `Adjusting ${currentPositions.length} positions for Phase ${newPhase}`);
        
        // Check if any positions violate new phase rules
        const adjustments = [];
        
        for (const position of currentPositions) {
            // Check correlation limits
            const correlationGroup = this.getCorrelationGroup(position.symbol);
            const groupCount = currentPositions.filter(p => 
                this.getCorrelationGroup(p.symbol) === correlationGroup
            ).length;
            
            if (groupCount > phaseConfig.maxCorrelatedPositions) {
                adjustments.push({
                    position: position.symbol,
                    action: 'REDUCE',
                    reason: `Exceeds Phase ${newPhase} correlation limit`
                });
            }
            
            // Check position size
            const positionSize = Math.abs(position.cost_basis) / this.state.accountBalance;
            if (positionSize > phaseConfig.defaultPositionSize * 1.5) {
                adjustments.push({
                    position: position.symbol,
                    action: 'RESIZE',
                    reason: `Position too large for Phase ${newPhase}`
                });
            }
        }
        
        // Log adjustments needed
        if (adjustments.length > 0) {
            logger.warn('PHASE_ADJUST', `${adjustments.length} positions need adjustment`);
            adjustments.forEach(adj => {
                logger.info('PHASE_ADJUST', `${adj.position}: ${adj.action} - ${adj.reason}`);
            });
        } else {
            logger.info('PHASE_ADJUST', 'All positions comply with new phase rules');
        }
        
        return adjustments;
    }
    
    /**
     * Get correlation group for symbol
     */
    getCorrelationGroup(symbol) {
        const groups = {
            'EQUITIES': ['ES', 'MES', 'NQ', 'MNQ', 'SPY', 'QQQ'],
            'COMMODITIES': ['CL', 'MCL', 'GC', 'MGC', 'GLD', 'SLV'],
            'BONDS': ['TLT', 'TBT', 'ZB', 'ZN'],
            'CURRENCIES': ['6E', '6B', '6J', 'EUR', 'GBP', 'JPY']
        };
        
        for (const [group, symbols] of Object.entries(groups)) {
            if (symbols.includes(symbol)) {
                return group;
            }
        }
        
        return 'OTHER';
    }
    
    /**
     * Check phase-specific milestones
     */
    checkPhaseMilestones(phase, balance) {
        const phaseConfig = this.getPhaseConfiguration(phase);
        const milestones = [];
        
        // Check if approaching next phase
        if (phaseConfig.maxBalance && balance >= phaseConfig.maxBalance * 0.9) {
            milestones.push({
                type: 'APPROACHING_UPGRADE',
                message: `Approaching Phase ${phase + 1} (90% of threshold)`,
                nextPhaseBalance: phaseConfig.maxBalance
            });
        }
        
        // Check if at risk of downgrade
        if (balance <= phaseConfig.minBalance * 1.1) {
            milestones.push({
                type: 'DOWNGRADE_RISK',
                message: `Close to Phase ${phase - 1} threshold`,
                thresholdBalance: phaseConfig.minBalance
            });
        }
        
        // Check monthly income achievement
        if (phaseConfig.monthlyIncomeTarget > 0) {
            const monthlyPnL = this.calculateMonthlyPnL();
            const achievement = (monthlyPnL / phaseConfig.monthlyIncomeTarget) * 100;
            
            if (achievement >= 100) {
                milestones.push({
                    type: 'INCOME_TARGET_MET',
                    message: `Monthly income target achieved: £${monthlyPnL.toFixed(0)}`,
                    target: phaseConfig.monthlyIncomeTarget
                });
            } else if (achievement >= 75) {
                milestones.push({
                    type: 'INCOME_PROGRESS',
                    message: `${achievement.toFixed(0)}% of monthly income target`,
                    current: monthlyPnL,
                    target: phaseConfig.monthlyIncomeTarget
                });
            }
        }
        
        // Log milestones
        milestones.forEach(milestone => {
            logger.info('MILESTONE', milestone.message);
            this.emit('milestone', milestone);
        });
        
        return milestones;
    }
    
    /**
     * Notify phase transition
     */
    notifyPhaseTransition(transition) {
        const { fromPhase, toPhase, balance, type } = transition;
        const toConfig = this.getPhaseConfiguration(toPhase);
        
        // Create notification message
        const notification = {
            priority: type === 'UPGRADE' ? 'HIGH' : 'MEDIUM',
            title: `🎆 PHASE TRANSITION: ${type}`,
            message: `Moved from Phase ${fromPhase || 0} to Phase ${toPhase}`,
            details: [
                `Account Balance: £${balance.toLocaleString()}`,
                `Phase Name: ${toConfig.name}`,
                `New BP Limit: ${toConfig.maxBPUsage === 'DYNAMIC' ? 'VIX-based (45-80%)' : (toConfig.maxBPUsage * 100).toFixed(0) + '%'}`,
                `Max Positions: ${toConfig.maxPositions}`,
                `Available Strategies: ${toConfig.availableStrategies.length}`
            ],
            timestamp: new Date()
        };
        
        // Log to console
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        logger.info('SYSTEM', notification.title);
        logger.info('SYSTEM', '='.repeat(60));
        notification.details.forEach(detail => logger.info('SYSTEM', detail));
        logger.info('SYSTEM', '\nNew Trading Rules:');
        toConfig.tradingRules.forEach(rule => logger.info('SYSTEM', `  • ${rule}`));
        logger.info('SYSTEM', '='.repeat(60) + '\n');
        
        // Emit notification event
        this.emit('notification', notification);
        
        // Update emergency protocol if downgrade
        if (type === 'DOWNGRADE' && this.components.emergencyProtocol) {
            this.components.emergencyProtocol.handlePhaseDowngrade(fromPhase, toPhase);
        }
    }
    
    /**
     * Calculate monthly P&L
     */
    calculateMonthlyPnL() {
        // Get current month's trades from journal
        if (!this.components.tradeJournal) {
            return 0;
        }
        
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyTrades = this.components.tradeJournal.getTradesSince(monthStart);
        
        return monthlyTrades.reduce((total, trade) => total + (trade.pnl || 0), 0);
    }
    
    /**
     * Get phase transition history
     */
    getPhaseHistory() {
        return {
            currentPhase: this.state.currentPhase,
            previousPhase: this.state.previousPhase,
            transitions: this.state.phaseTransitionHistory,
            totalTransitions: this.state.phaseTransitionHistory.length,
            lastTransition: this.state.phaseTransitionHistory[this.state.phaseTransitionHistory.length - 1],
            timeInCurrentPhase: this.getTimeInCurrentPhase()
        };
    }
    
    /**
     * Get time in current phase
     */
    getTimeInCurrentPhase() {
        const lastTransition = this.state.phaseTransitionHistory[this.state.phaseTransitionHistory.length - 1];
        if (!lastTransition) return 0;
        
        const now = new Date();
        const transitionTime = new Date(lastTransition.timestamp);
        const daysInPhase = Math.floor((now - transitionTime) / (1000 * 60 * 60 * 24));
        
        return daysInPhase;
    }
    
    /**
     * Force phase transition (for testing)
     */
    async forcePhaseTransition(targetPhase) {
        logger.warn('PHASE_TRANSITION', `FORCED transition to Phase ${targetPhase}`);
        const currentBalance = this.state.accountBalance;
        await this.executePhaseTransition(this.state.currentPhase, targetPhase, currentBalance);
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
        logger.info('SYSTEM', '\n' + '═'.repeat(60));
        logger.info('SYSTEM', '📊 TOM KING TRADING FRAMEWORK - MASTER CONTROLLER');
        logger.info('SYSTEM', '═'.repeat(60));
        logger.info('SYSTEM', `Mode: ${this.config.mode.toUpperCase()}`);
        logger.info('SYSTEM', `Phase: ${this.state.currentPhase}`);
        logger.info('SYSTEM', `Balance: £${this.state.accountBalance.toLocaleString()}`);
        logger.info('SYSTEM', `Target: £${this.config.targetBalance.toLocaleString()}`);
        logger.info('SYSTEM', `Progress: ${((this.state.accountBalance / this.config.targetBalance) * 100).toFixed(1)}%`);
        logger.info('SYSTEM', `Active Strategies: ${this.state.activeStrategies.join(', ')}`);
        logger.info('SYSTEM', `Positions: ${this.state.positions.length}`);
        logger.info('SYSTEM', `Status: ${this.state.running ? '🟢 RUNNING' : '🔴 STOPPED'}`);
        logger.info('SYSTEM', '═'.repeat(60));
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
            logger.info('SYSTEM', '\n✅ Master Controller initialized');
            logger.info('SYSTEM', 'Status:', controller.getStatus());
            
            // Test phase determination
            logger.info('SYSTEM', '\nPhase tests:');
            logger.info('SYSTEM', '£35k → Phase', controller.determinePhase(35000));
            logger.info('SYSTEM', '£45k → Phase', controller.determinePhase(45000));
            logger.info('SYSTEM', '£65k → Phase', controller.determinePhase(65000));
            logger.info('SYSTEM', '£80k → Phase', controller.determinePhase(80000));
            
            // Test never-trade list
            logger.info('SYSTEM', '\nNever-trade tests:');
            logger.info('SYSTEM', 'SPY:', controller.isNeverTrade('SPY'), '(should be false)');
            logger.info('SYSTEM', 'UVXY:', controller.isNeverTrade('UVXY'), '(should be true)');
            logger.info('SYSTEM', 'GME:', controller.isNeverTrade('GME'), '(should be true)');
        })
        .catch(error => logger.error('ERROR', 'Master Controller initialization failed', error));
}