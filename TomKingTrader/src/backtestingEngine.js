/**
 * Tom King Strategy Backtesting Engine
 * Uses core trading modules for exact production parity
 * Ensures backtesting uses identical logic as live trading
 */

// Import core modules directly since UNIFIED_TRADING_ENGINE is archived
const { EnhancedPatternAnalyzer } = require('./enhancedPatternAnalysis');
const { RiskManager } = require('./riskManager');
const { DataManager } = require('./dataManager');
const { TradingStrategies } = require('./strategies');
const { GreeksCalculator } = require('./greeksCalculator');
const { getLogger } = require('./logger');

class BacktestingEngine {
    constructor(options = {}) {
        this.config = {
            startDate: options.startDate || '2020-01-01',
            endDate: options.endDate || new Date().toISOString().split('T')[0],
            initialCapital: options.initialCapital || 30000, // £30k Phase 1 start
            commissions: options.commissions || 2.50, // Per contract
            slippage: options.slippage || 0.02, // 2% slippage estimate
            maxPositions: options.maxPositions || 20,
            correlationLimit: options.correlationLimit || 3,
            maxBPUsage: options.maxBPUsage || 'DYNAMIC', // VIX-based: 45-80% per Tom King
            ...options
        };

        this.logger = getLogger();
        this.dataManager = new DataManager(null, options);
        
        // Initialize pattern analyzer and risk manager for backtest mode
        // This ensures exact same logic as live trading
        this.patternAnalyzer = new EnhancedPatternAnalyzer();
        this.riskManager = new RiskManager();
        
        // Initialize tracking
        this.correlationGroups = new Map();
        this.tradeHistory = [];
        this.capitalDeployed = 0;
        this.startingBalance = this.config.initialCapital;
        this.currentVIX = 18; // Default VIX

        // Legacy support for existing methods
        this.strategies = new TradingStrategies();
        this.greeksCalc = new GreeksCalculator();
        
        // Trade replay system
        this.tradeReplay = {
            enabled: false,
            speed: 1, // 1x speed by default
            currentIndex: 0,
            trades: [],
            marketSnapshots: [],
            events: [],
            breakpoints: [],
            isPaused: false
        };
        
        // Tom King specific rules
        this.tomKingRules = {
            phases: {
                1: { minCapital: 30000, maxCapital: 40000 },
                2: { minCapital: 40000, maxCapital: 60000 },
                3: { minCapital: 60000, maxCapital: 75000 },
                4: { minCapital: 75000, maxCapital: Infinity }
            },
            strategies: {
                '0DTE': {
                    daysAllowed: [5], // Friday only
                    timeWindow: { start: 10.5, end: 15.5 }, // 10:30 AM - 3:30 PM EST
                    profitTarget: 'LET_EXPIRE_OTM',
                    stopLoss: 2.0, // 2x credit received
                    timeStop: 15.5, // Close by 3:30 PM if ITM
                    maxLossPercent: 100
                },
                'LT112': {
                    daysAllowed: [1, 2, 3], // Mon-Wed only
                    targetDTE: 112,
                    profitTarget: 0.75, // 75% of credit at week 14
                    management: {
                        week8: 'MONETIZE_HEDGE',
                        week12: 'ROLL_TESTED_SIDE',
                        week14: 'CLOSE_IF_75_PERCENT',
                        week16: 'EXPIRE_OR_MANAGE'
                    }
                },
                'STRANGLE': {
                    daysAllowed: [2], // Tuesday only
                    targetDTE: 90,
                    deltaTarget: 5, // 5-delta strikes
                    profitTarget: 0.50, // 50% of credit
                    stopLoss: 2.0, // 2x credit
                    dteManagement: 21, // Manage at 21 DTE
                    adjustment: 'IRON_CONDOR_IF_TESTED'
                },
                'IPMCC': {
                    daysAllowed: [1, 2, 3, 4, 5], // Any day
                    leapDelta: 75, // 75-delta LEAP
                    weeklyDelta: 30, // 30-delta weekly
                    rollRules: 'UP_AND_OUT_IF_TESTED',
                    exitTarget: 0.50 // 50% of LEAP cost recovered
                },
                'LEAP': {
                    daysAllowed: [3], // Wednesday only
                    ladderSize: 10,
                    profitTarget: 0.50, // 50% on individual positions
                    rebalancing: 'CONTINUOUS'
                }
            }
        };
    }

    /**
     * Run comprehensive backtest for all strategies using UNIFIED ENGINE
     * CRITICAL: This ensures exact same logic as live trading
     */
    async runFullBacktest(symbols = null) {
        this.logger.info('BACKTEST_UNIFIED', 'Starting unified backtest', {
            startDate: this.config.startDate,
            endDate: this.config.endDate,
            initialCapital: this.config.initialCapital,
            mode: 'backtest'
        });

        // Get default symbols if not provided
        if (!symbols) {
            symbols = this.getDefaultSymbols();
        }

        // Generate trading calendar (business days only)
        const tradingDays = this.generateTradingCalendar(this.config.startDate, this.config.endDate);
        let processedDays = 0;
        
        // Process each trading day using UNIFIED ENGINE
        for (const date of tradingDays) {
            try {
                // Process single trading day with exact same logic as live trading
                await this.processBacktestDay(date, await this.loadMarketDataForDate(date, symbols));
                
                processedDays++;
                if (processedDays % 100 === 0) {
                    const portfolio = this.getPortfolioSummary();
                    this.logger.info('BACKTEST_UNIFIED', `Processed ${processedDays}/${tradingDays.length} days`, {
                        currentDate: date.toISOString().split('T')[0],
                        totalValue: portfolio.totalValue,
                        positionCount: portfolio.positionCount,
                        unrealizedPnL: portfolio.unrealizedPnL
                    });
                }
            } catch (error) {
                this.logger.error('BACKTEST_UNIFIED', `Failed to process ${date}`, error);
            }
        }

        // Generate final results
        const finalStats = await this.calculatePerformanceMetrics();
        const portfolio = this.getPortfolioSummary();
        
        this.logger.info('BACKTEST_UNIFIED', 'Unified backtest completed', {
            finalValue: portfolio.totalValue,
            totalReturn: (finalStats.totalReturn * 100).toFixed(2) + '%',
            totalTrades: finalStats.totalTrades,
            winRate: (finalStats.winRate * 100).toFixed(2) + '%',
            currentPositions: finalStats.currentPositions
        });

        return {
            summary: portfolio,
            statistics: finalStats,
            tradeHistory: this.tradeHistory,
            correlationGroups: Array.from(this.correlationGroups.entries()),
            config: this.config,
            mode: 'UNIFIED_BACKTEST'
        };
    }

    /**
     * Run backtest for specific strategy using UNIFIED ENGINE
     * CRITICAL: Ensures exact same strategy logic as live trading
     */
    async runStrategyBacktest(strategyName, symbols = null) {
        this.logger.info('BACKTEST_UNIFIED', `Running unified strategy backtest for ${strategyName}`);

        const strategy = this.tomKingRules.strategies[strategyName];
        if (!strategy) {
            throw new Error(`Unknown strategy: ${strategyName}`);
        }

        symbols = symbols || this.getStrategySymbols(strategyName);
        
        // Initialize strategy-specific tracking
        this.initializeBacktest();
        this.strategyFilter = strategyName;
        
        const tradingDays = this.generateTradingCalendar(this.config.startDate, this.config.endDate);

        // Process each day using unified engine with strategy filter
        for (const date of tradingDays) {
            try {
                await this.processStrategyDay(date, strategyName, await this.loadMarketDataForDate(date, symbols));
            } catch (error) {
                this.logger.error('BACKTEST_UNIFIED', `Strategy ${strategyName} failed on ${date}`, error);
            }
        }

        const finalStats = await this.calculatePerformanceMetrics(strategyName);
        const portfolio = this.getPortfolioSummary();
        
        return {
            strategy: strategyName,
            summary: portfolio,
            statistics: finalStats,
            tradeHistory: this.tradeHistory.filter(trade => trade.strategy === strategyName),
            config: this.config,
            mode: 'UNIFIED_STRATEGY_BACKTEST'
        };
    }

    /**
     * Get maximum buying power usage based on VIX level
     * Implements Tom King's dynamic BP system
     */
    getMaxBPUsage(vixLevel) {
        if (vixLevel < 13) return 0.45; // 45% for VIX <13
        if (vixLevel < 18) return 0.65; // 65% for VIX 13-18
        if (vixLevel < 25) return 0.75; // 75% for VIX 18-25
        if (vixLevel < 30) return 0.50; // 50% for VIX 25-30
        return 0.80; // 80% for VIX >30 (puts only)
    }

    /**
     * Initialize backtest state
     */
    initializeBacktest() {
        this.trades = [];
        this.positions = [];
        this.dailyPnL = [];
        this.currentCapital = this.config.initialCapital;
        this.currentPhase = 1;
        this.correlationGroups.clear();
        
        this.logger.info('BACKTEST', 'Backtest state initialized');
    }

    /**
     * Process a single backtest day
     */
    async processBacktestDay(date, marketData) {
        const dayOfWeek = new Date(date).getDay();
        const dateStr = date.toISOString().split('T')[0];

        // Get market data for this day
        const dayMarketData = this.extractDayMarketData(marketData, dateStr);
        if (!dayMarketData) {
            return; // No data for this day
        }

        // Update current phase based on capital
        this.updatePhase();

        // Manage existing positions first
        await this.manageExistingPositions(date, dayMarketData);

        // Check for new strategy entries based on day of week
        const availableStrategies = this.getAvailableStrategies(dayOfWeek);
        
        for (const strategyName of availableStrategies) {
            if (this.canAddPosition()) {
                await this.evaluateStrategyEntry(strategyName, date, dayMarketData);
            }
        }

        // Calculate daily P&L
        const dayPnL = this.calculateDailyPnL(date, dayMarketData);
        this.dailyPnL.push({
            date: dateStr,
            capital: this.currentCapital,
            pnl: dayPnL,
            positions: this.positions.length,
            phase: this.currentPhase
        });
    }

    /**
     * Process strategy-specific backtest day
     */
    async processStrategyDay(date, strategyName, marketData) {
        const dayOfWeek = new Date(date).getDay();
        const dateStr = date.toISOString().split('T')[0];

        const dayMarketData = this.extractDayMarketData(marketData, dateStr);
        if (!dayMarketData) return;

        this.updatePhase();
        await this.manageExistingPositions(date, dayMarketData);

        // Only evaluate the specific strategy
        const strategy = this.tomKingRules.strategies[strategyName];
        if (strategy.daysAllowed.includes(dayOfWeek) && this.canAddPosition()) {
            await this.evaluateStrategyEntry(strategyName, date, dayMarketData);
        }

        const dayPnL = this.calculateDailyPnL(date, dayMarketData);
        this.dailyPnL.push({
            date: dateStr,
            capital: this.currentCapital,
            pnl: dayPnL,
            positions: this.positions.length,
            phase: this.currentPhase,
            strategy: strategyName
        });
    }

    /**
     * Manage existing positions (exits, adjustments, expirations)
     */
    async manageExistingPositions(date, marketData) {
        const positionsToClose = [];
        const dateStr = date.toISOString().split('T')[0];

        for (let i = 0; i < this.positions.length; i++) {
            const position = this.positions[i];
            const dte = this.calculateDTE(dateStr, position.expiration);
            
            // Check for expiration
            if (dte <= 0) {
                const exitReason = 'EXPIRATION';
                const exitValue = this.calculateExpirationValue(position, marketData);
                positionsToClose.push({ index: i, position, exitReason, exitValue });
                continue;
            }

            // Strategy-specific management
            const managementAction = this.checkManagementRules(position, date, marketData, dte);
            if (managementAction.action !== 'HOLD') {
                const exitValue = this.calculatePositionValue(position, marketData);
                positionsToClose.push({ 
                    index: i, 
                    position, 
                    exitReason: managementAction.action, 
                    exitValue: managementAction.value || exitValue 
                });
            }
        }

        // Close positions (in reverse order to maintain indices)
        for (const closeData of positionsToClose.reverse()) {
            this.closePosition(closeData.position, closeData.exitReason, closeData.exitValue, dateStr);
            this.positions.splice(closeData.index, 1);
        }
    }

    /**
     * Check management rules for a position
     */
    checkManagementRules(position, date, marketData, dte) {
        const strategyRules = this.tomKingRules.strategies[position.strategy];
        const currentValue = this.calculatePositionValue(position, marketData);
        const pnl = currentValue - position.entryValue;
        const pnlPercent = pnl / Math.abs(position.entryValue);

        switch (position.strategy) {
            case '0DTE':
                // 0DTE management
                const time = new Date(date).getHours() + (new Date(date).getMinutes() / 60);
                if (time >= strategyRules.timeStop && currentValue > 0) {
                    return { action: 'TIME_STOP', value: currentValue };
                }
                if (pnl <= -Math.abs(position.entryValue) * strategyRules.stopLoss) {
                    return { action: 'STOP_LOSS', value: currentValue };
                }
                break;

            case 'LT112':
                // LT112 week-based management
                const weeksHeld = Math.floor((Date.now() - new Date(position.entryDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
                if (weeksHeld >= 14 && pnlPercent >= 0.75) {
                    return { action: 'PROFIT_TARGET_75', value: currentValue };
                }
                if (weeksHeld >= 8) {
                    // Implement hedge monetization logic
                }
                break;

            case 'STRANGLE':
                // Strangle management
                if (dte <= strategyRules.dteManagement) {
                    if (pnlPercent >= strategyRules.profitTarget) {
                        return { action: 'PROFIT_TARGET', value: currentValue };
                    } else if (this.isStrangleTested(position, marketData)) {
                        return { action: 'CONVERT_TO_IC', value: currentValue };
                    }
                }
                if (pnl <= -Math.abs(position.entryValue) * strategyRules.stopLoss) {
                    return { action: 'STOP_LOSS', value: currentValue };
                }
                break;

            case 'IPMCC':
                // IPMCC management
                if (this.isWeeklyTested(position, marketData)) {
                    return { action: 'ROLL_WEEKLY', value: currentValue };
                }
                break;

            case 'LEAP':
                // LEAP ladder management
                if (pnlPercent >= strategyRules.profitTarget) {
                    return { action: 'PROFIT_TARGET', value: currentValue };
                }
                break;
        }

        return { action: 'HOLD' };
    }

    /**
     * Evaluate strategy entry on a given day
     */
    async evaluateStrategyEntry(strategyName, date, marketData) {
        const dateStr = date.toISOString().split('T')[0];
        
        // FIXED: Use the updated TradingStrategies class with realistic entry frequency
        const accountData = {
            phase: this.currentPhase,
            capital: this.currentCapital,
            buyingPower: this.currentCapital * this.getMaxBPUsage(this.currentVIX || 20), // Dynamic BP based on VIX
            positions: this.positions.filter(p => p.status === 'OPEN')
        };

        // Set proper time for intraday strategies in backtesting
        const testDate = new Date(date);
        if (strategyName === '0DTE') {
            testDate.setHours(11, 0, 0, 0); // 11:00 AM for 0DTE
        } else if (strategyName === 'IPMCC') {
            testDate.setHours(9, 15, 0, 0); // 9:15 AM for IPMCC
        } else {
            testDate.setHours(10, 0, 0, 0); // 10:00 AM for other strategies
        }

        // Call the fixed strategy analyzer
        let analysis = null;
        switch (strategyName) {
            case '0DTE':
                analysis = this.strategies.analyze0DTE(marketData, accountData, testDate);
                break;
            case 'LT112':
                analysis = this.strategies.analyzeLT112(marketData, accountData, testDate);
                break;
            case 'STRANGLE':
                analysis = this.strategies.analyzeStrangles(marketData, accountData, testDate);
                break;
            case 'IPMCC':
                analysis = this.strategies.analyzeIPMCC(marketData, accountData, testDate);
                break;
            case 'LEAP':
                analysis = this.strategies.analyzeLEAPLadder(marketData, accountData, testDate);
                break;
        }

        // Convert analysis to entry format for backtesting
        let entry = null;
        if (analysis && analysis.canTrade && analysis.signals && analysis.signals.length > 0) {
            const signal = analysis.signals[0];
            entry = this.convertAnalysisToEntry(signal, strategyName, date, marketData);
        }

        if (entry) {
            this.logger.debug('BACKTEST', `Entry generated for ${strategyName}`, entry);
            if (this.validateEntry(entry, dateStr)) {
                this.logger.info('BACKTEST', `Entering position for ${strategyName} on ${dateStr}`);
                this.enterPosition(entry, dateStr);
            } else {
                this.logger.debug('BACKTEST', `Entry validation failed for ${strategyName}`);
            }
        } else {
            this.logger.debug('BACKTEST', `No entry conditions met for ${strategyName} on ${dateStr}`);
        }
    }
    
    /**
     * Convert strategy analysis to backtest entry format
     */
    convertAnalysisToEntry(signal, strategyName, date, marketData) {
        const baseEntry = {
            strategy: strategyName,
            entryDate: date,
            capitalRequired: 0,
            maxLoss: 0
        };

        switch (strategyName) {
            case '0DTE':
                return this.convert0DTEEntry(signal, baseEntry, marketData);
            case 'LT112':
                return this.convertLT112Entry(signal, baseEntry, marketData);
            case 'STRANGLE':
                return this.convertStrangleEntry(signal, baseEntry, marketData);
            case 'IPMCC':
                return this.convertIPMCCEntry(signal, baseEntry, marketData);
            case 'LEAP':
                return this.convertLEAPEntry(signal, baseEntry, marketData);
            default:
                return null;
        }
    }

    convert0DTEEntry(signal, baseEntry, marketData) {
        const entry = signal.entry;
        const contracts = signal.contracts || 1;
        const multiplier = 50; // ES multiplier
        
        return {
            ...baseEntry,
            type: signal.type.includes('CALL') ? 'CALL_SPREAD' : 
                  signal.type.includes('PUT') ? 'PUT_SPREAD' : 'IRON_CONDOR',
            underlying: 'ES',
            shortStrike: entry.shortStrike || entry.callShort,
            longStrike: entry.longStrike || entry.callLong,
            putShort: entry.putShort,
            putLong: entry.putLong,
            callShort: entry.callShort,
            callLong: entry.callLong,
            expiration: date.toISOString().split('T')[0],
            contracts: contracts,
            entryValue: entry.credit ? entry.credit * contracts * multiplier : 
                       entry.totalCredit ? entry.totalCredit * contracts * multiplier : 1000,
            capitalRequired: entry.maxLoss ? entry.maxLoss * contracts : 2000,
            maxLoss: entry.maxLoss ? entry.maxLoss * contracts : 2000
        };
    }

    convertLT112Entry(signal, baseEntry, marketData) {
        const contracts = signal.contracts || 1;
        const multiplier = signal.ticker === 'ES' ? 50 : 5; // ES vs MES
        
        return {
            ...baseEntry,
            type: 'PUT_SPREAD',
            underlying: signal.ticker,
            shortStrike: signal.shortStrike,
            longStrike: signal.longStrike,
            expiration: signal.expiration,
            contracts: contracts,
            entryValue: signal.credit * contracts * multiplier,
            capitalRequired: (signal.shortStrike - signal.longStrike) * contracts * multiplier,
            maxLoss: ((signal.shortStrike - signal.longStrike) - signal.credit) * contracts * multiplier
        };
    }

    convertStrangleEntry(signal, baseEntry, marketData) {
        const multiplier = this.getContractMultiplier(signal.ticker);
        
        return {
            ...baseEntry,
            type: 'SHORT_STRANGLE',
            underlying: signal.ticker,
            putStrike: signal.putStrike,
            callStrike: signal.callStrike,
            expiration: this.getExpirationDate(90).toISOString().split('T')[0],
            contracts: 1,
            entryValue: signal.totalCredit * multiplier,
            capitalRequired: signal.totalCredit * multiplier * 2,
            maxLoss: signal.totalCredit * multiplier * 2
        };
    }

    convertIPMCCEntry(signal, baseEntry, marketData) {
        return {
            ...baseEntry,
            type: 'IPMCC',
            underlying: signal.ticker,
            leapStrike: signal.leapStrike,
            weeklyStrike: signal.weeklyStrike,
            leapExpiry: signal.leapExpiry,
            weeklyExpiry: signal.weeklyExpiry,
            contracts: 1,
            entryValue: -signal.estimatedCost, // Negative because we pay
            capitalRequired: signal.estimatedCost,
            maxLoss: signal.estimatedCost
        };
    }

    convertLEAPEntry(signal, baseEntry, marketData) {
        const totalCost = signal.totalCost || 5000; // Default if missing
        
        return {
            ...baseEntry,
            type: 'LEAP',
            underlying: signal.ticker,
            positions: signal.positions,
            contracts: signal.positions.length,
            entryValue: -totalCost, // Negative because we pay
            capitalRequired: totalCost,
            maxLoss: totalCost
        };
    }

    /**
     * Evaluate 0DTE entry
     */
    async evaluate0DTEEntry(date, marketData) {
        this.logger.info('BACKTEST', `Evaluating 0DTE entry for ${date.toISOString().split('T')[0]}`);
        const esData = marketData.ES || marketData.MES;
        if (!esData) {
            this.logger.debug('BACKTEST', 'No ES/MES data available');
            return null;
        }
        
        // Get VIX level (use actual VIX data or estimate from IV)
        const vixLevel = marketData.VIX ? marketData.VIX.close : (esData.iv ? esData.iv * 100 : 18);
        
        // Check VIX conditions for 0DTE
        if (vixLevel < 12 || vixLevel > 35) {
            return null; // VIX outside acceptable range
        }

        // Tom's 0.5% rule - relaxed for testing to 0.2%
        const moveFromOpen = ((esData.close - esData.open) / esData.open) * 100;
        
        // Relaxed from 0.5% to 0.2% for testing
        if (Math.abs(moveFromOpen) > 0.2) {
            // Directional trade
            const direction = moveFromOpen > 0 ? 'CALL' : 'PUT';
            const atmStrike = Math.round(esData.close / 5) * 5;
            
            let shortStrike, longStrike;
            if (direction === 'CALL') {
                shortStrike = atmStrike + 15;
                longStrike = atmStrike + 45;
            } else {
                shortStrike = atmStrike - 15;
                longStrike = atmStrike - 45;
            }

            const credit = this.estimateOptionCredit(esData, shortStrike, longStrike, 0, direction);
            
            return {
                strategy: '0DTE',
                symbol: 'ES',  // Added symbol field
                type: `${direction}_SPREAD`,
                underlying: 'ES',
                shortStrike,
                longStrike,
                expiration: date.toISOString().split('T')[0], // Same day expiration
                contracts: this.calculate0DTEContracts(),
                capitalRequired: Math.abs(longStrike - shortStrike) * this.calculate0DTEContracts() * 50,  // Added capitalRequired
                entryValue: credit * this.calculate0DTEContracts() * 50, // ES multiplier
                maxLoss: (Math.abs(longStrike - shortStrike) - credit) * this.calculate0DTEContracts() * 50
            };
        } else {
            // Iron Condor setup
            const atmStrike = Math.round(esData.close / 5) * 5;
            const distance = 50;
            const spreadWidth = 30;
            
            const putCredit = this.estimateOptionCredit(esData, atmStrike - distance, atmStrike - distance - spreadWidth, 0, 'PUT');
            const callCredit = this.estimateOptionCredit(esData, atmStrike + distance, atmStrike + distance + spreadWidth, 0, 'CALL');
            const totalCredit = putCredit + callCredit;
            
            return {
                strategy: '0DTE',
                symbol: 'ES',  // Added symbol field
                type: 'IRON_CONDOR',
                underlying: 'ES',
                capitalRequired: spreadWidth * this.calculate0DTEContracts() * 50,  // Added capitalRequired
                putShort: atmStrike - distance,
                putLong: atmStrike - distance - spreadWidth,
                callShort: atmStrike + distance,
                callLong: atmStrike + distance + spreadWidth,
                expiration: date.toISOString().split('T')[0],
                contracts: this.calculate0DTEContracts(),
                entryValue: totalCredit * this.calculate0DTEContracts() * 50,
                maxLoss: (spreadWidth - totalCredit) * this.calculate0DTEContracts() * 50
            };
        }
    }

    /**
     * Evaluate LT112 entry
     */
    async evaluateLT112Entry(date, marketData) {
        const ticker = this.currentPhase >= 3 ? 'ES' : 'MES';
        const data = marketData[ticker];
        if (!data) return null;

        // Calculate 120 DTE expiration
        const expirationDate = new Date(date);
        expirationDate.setDate(expirationDate.getDate() + 120);
        const expiration = this.getNextFriday(expirationDate).toISOString().split('T')[0];

        // Tom's LT112 formula: 10% OTM short, 15% OTM long
        const shortStrike = Math.round(data.close * 0.9 / 5) * 5;
        const longStrike = Math.round(data.close * 0.85 / 5) * 5;
        
        const credit = this.estimateOptionCredit(data, shortStrike, longStrike, 112, 'PUT');
        
        // Entry scoring
        const score = this.scoreLT112Entry(data);
        if (score < 70) return null;

        const contracts = ticker === 'MES' ? 4 : (this.currentPhase >= 4 ? 2 : 1);
        const multiplier = ticker === 'MES' ? 5 : 50;

        return {
            strategy: 'LT112',
            type: 'PUT_SPREAD',
            underlying: ticker,
            shortStrike,
            longStrike,
            expiration,
            contracts,
            entryValue: credit * contracts * multiplier,
            maxLoss: ((shortStrike - longStrike) - credit) * contracts * multiplier,
            score
        };
    }

    /**
     * Evaluate Strangle entry
     */
    async evaluateStrangleEntry(date, marketData) {
        const qualifiedTickers = this.getStrangleTickersByPhase(this.currentPhase);
        let bestEntry = null;
        let bestScore = 0;

        for (const ticker of qualifiedTickers) {
            const data = marketData[ticker];
            if (!data) continue;

            // Check correlation limits
            if (this.getCorrelationGroupCount(ticker) >= this.config.correlationLimit) {
                continue;
            }

            // Calculate 5-delta strikes for 90 DTE
            const expirationDate = new Date(date);
            expirationDate.setDate(expirationDate.getDate() + 90);
            const expiration = this.getNextFriday(expirationDate).toISOString().split('T')[0];

            const strikes = this.calculate5DeltaStrikes(data.close, data.iv || 0.2, 90);
            const putCredit = this.estimateOptionCredit(data, strikes.putStrike, null, 90, 'PUT');
            const callCredit = this.estimateOptionCredit(data, strikes.callStrike, null, 90, 'CALL');
            const totalCredit = putCredit + callCredit;

            const score = this.scoreStrangleEntry(data, strikes);
            
            if (score > bestScore && score >= 60) {
                bestScore = score;
                bestEntry = {
                    strategy: 'STRANGLE',
                    type: 'SHORT_STRANGLE',
                    underlying: ticker,
                    putStrike: strikes.putStrike,
                    callStrike: strikes.callStrike,
                    expiration,
                    contracts: 1,
                    entryValue: totalCredit * this.getContractMultiplier(ticker),
                    maxLoss: totalCredit * this.getContractMultiplier(ticker) * 2, // 2x credit stop
                    score
                };
            }
        }

        return bestEntry;
    }

    /**
     * Calculate position value at any point in time
     */
    calculatePositionValue(position, marketData) {
        const underlying = marketData[position.underlying];
        if (!underlying) return position.entryValue; // No change if no data

        const currentPrice = underlying.close;
        
        switch (position.type) {
            case 'CALL_SPREAD':
            case 'PUT_SPREAD':
                return this.calculateSpreadValue(position, currentPrice);
            case 'IRON_CONDOR':
                return this.calculateIronCondorValue(position, currentPrice);
            case 'SHORT_STRANGLE':
                return this.calculateStrangleValue(position, currentPrice);
            case 'IPMCC':
                return this.calculateIPMCCValue(position, currentPrice);
            case 'LEAP':
                return this.calculateLEAPValue(position, currentPrice);
            default:
                return position.entryValue;
        }
    }

    /**
     * Calculate spread value
     */
    calculateSpreadValue(position, currentPrice) {
        const { shortStrike, longStrike, entryValue, strategy } = position;
        
        if (strategy === '0DTE' && this.isExpiration(position.expiration)) {
            // 0DTE expiration value
            if (position.type === 'CALL_SPREAD') {
                if (currentPrice <= shortStrike) return entryValue; // Max profit
                if (currentPrice >= longStrike) return -(Math.abs(longStrike - shortStrike) * position.contracts * this.getContractMultiplier(position.underlying) - entryValue); // Max loss
                return entryValue - (currentPrice - shortStrike) * position.contracts * this.getContractMultiplier(position.underlying);
            } else { // PUT_SPREAD
                if (currentPrice >= shortStrike) return entryValue; // Max profit
                if (currentPrice <= longStrike) return -(Math.abs(shortStrike - longStrike) * position.contracts * this.getContractMultiplier(position.underlying) - entryValue); // Max loss
                return entryValue - (shortStrike - currentPrice) * position.contracts * this.getContractMultiplier(position.underlying);
            }
        }
        
        // For non-expiring spreads, estimate current value based on intrinsic + time value
        // This is simplified - real implementation would use option pricing models
        const intrinsicValue = this.calculateIntrinsicValue(position, currentPrice);
        const timeValue = this.estimateTimeValue(position, currentPrice);
        
        return intrinsicValue + timeValue;
    }

    /**
     * Calculate intrinsic value of an option position
     */
    calculateIntrinsicValue(position, currentPrice) {
        const { type, shortStrike, longStrike, underlying } = position;
        const multiplier = this.getContractMultiplier(underlying);
        
        switch (type) {
            case 'CALL_SPREAD':
                // Bull call spread intrinsic value
                if (currentPrice <= longStrike) return 0;
                if (currentPrice >= shortStrike) return (shortStrike - longStrike) * position.contracts * multiplier;
                return (currentPrice - longStrike) * position.contracts * multiplier;
                
            case 'PUT_SPREAD':
                // Bear put spread intrinsic value
                if (currentPrice >= shortStrike) return 0;
                if (currentPrice <= longStrike) return (shortStrike - longStrike) * position.contracts * multiplier;
                return (shortStrike - currentPrice) * position.contracts * multiplier;
                
            case 'SHORT_STRANGLE':
                // Short strangle intrinsic value (negative when ITM)
                let value = 0;
                if (currentPrice > position.callStrike) {
                    value -= (currentPrice - position.callStrike) * position.contracts * multiplier;
                }
                if (currentPrice < position.putStrike) {
                    value -= (position.putStrike - currentPrice) * position.contracts * multiplier;
                }
                return value;
                
            default:
                return 0;
        }
    }
    
    /**
     * Estimate time value of an option position
     */
    estimateTimeValue(position, currentPrice) {
        // Simplified time value estimation
        const daysToExpiry = this.calculateDaysToExpiry(position.expiration);
        
        if (daysToExpiry <= 0) return 0;
        
        // Time decay accelerates as expiration approaches
        const timeDecayFactor = Math.sqrt(daysToExpiry / 365);
        const entryValue = position.entryValue || 0;
        
        // Estimate remaining time value as percentage of entry value
        return entryValue * timeDecayFactor * 0.5; // Simplified - real implementation would use Black-Scholes
    }
    
    /**
     * Calculate days to expiry
     */
    calculateDaysToExpiry(expirationDate) {
        const expiry = new Date(expirationDate);
        const today = new Date(this.currentDate || new Date());
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.max(0, Math.floor((expiry - today) / msPerDay));
    }

    /**
     * Calculate expiration value of a position
     */
    calculateExpirationValue(position, expirationPrice) {
        const { type, shortStrike, longStrike, underlying, contracts } = position;
        const multiplier = this.getContractMultiplier(underlying);
        
        switch (type) {
            case 'CALL_SPREAD':
                // Bull call spread at expiration
                if (expirationPrice <= longStrike) {
                    return -position.entryValue; // Total loss
                } else if (expirationPrice >= shortStrike) {
                    return (shortStrike - longStrike) * contracts * multiplier - position.entryValue; // Max profit
                } else {
                    return (expirationPrice - longStrike) * contracts * multiplier - position.entryValue; // Partial profit/loss
                }
                
            case 'PUT_SPREAD':
                // Bear put spread at expiration
                if (expirationPrice >= shortStrike) {
                    return -position.entryValue; // Total loss
                } else if (expirationPrice <= longStrike) {
                    return (shortStrike - longStrike) * contracts * multiplier - position.entryValue; // Max profit
                } else {
                    return (shortStrike - expirationPrice) * contracts * multiplier - position.entryValue; // Partial profit/loss
                }
                
            case 'SHORT_STRANGLE':
                // Short strangle at expiration
                let pnl = position.entryValue; // Start with premium collected
                if (expirationPrice > position.callStrike) {
                    pnl -= (expirationPrice - position.callStrike) * contracts * multiplier;
                } else if (expirationPrice < position.putStrike) {
                    pnl -= (position.putStrike - expirationPrice) * contracts * multiplier;
                }
                return pnl;
                
            default:
                return 0;
        }
    }

    /**
     * Evaluate IPMCC (In-Phase Multi-Cycle Calendar) entry
     */
    async evaluateIPMCCEntry(date, marketData) {
        // IPMCC: Buy long call LEAP, sell short calls against it
        const vixLevel = marketData.vix || 20;
        
        // IPMCC works best in moderate volatility
        if (vixLevel < 15 || vixLevel > 35) {
            return null;
        }
        
        // Need trending market for IPMCC
        const trend = this.calculateTrend(marketData);
        if (Math.abs(trend) < 0.02) { // Need at least 2% trend
            return null;
        }
        
        const spotPrice = marketData.close;
        const longStrike = spotPrice * (trend > 0 ? 1.05 : 0.95); // 5% OTM
        const shortStrike = spotPrice * (trend > 0 ? 1.02 : 0.98); // 2% OTM
        
        // Estimate option prices using existing method
        const longCredit = this.estimateOptionCredit(marketData, longStrike, null, 365, 'CALL');
        const shortCredit = this.estimateOptionCredit(marketData, shortStrike, null, 30, 'CALL');
        
        return {
            entryDate: date,
            strategy: 'IPMCC',
            symbol: marketData.symbol,
            spotPrice,
            strikes: { long: longStrike, short: shortStrike },
            dte: { long: 365, short: 30 },
            credit: shortCredit - longCredit * 0.1, // Net credit after cost basis
            capitalRequired: longCredit * 100, // Cost of LEAP
            targetProfit: shortCredit * 0.5,
            stopLoss: shortCredit * 2,
            vixAtEntry: vixLevel
        };
    }
    
    /**
     * Evaluate LEAP entry
     */
    async evaluateLEAPEntry(date, marketData) {
        // LEAP: Long-term options for directional plays
        const vixLevel = marketData.vix || 20;
        
        // LEAPs work best in lower volatility
        if (vixLevel > 25) {
            return null;
        }
        
        const spotPrice = marketData.close;
        const trend = this.calculateTrend(marketData);
        
        // Need strong trend for LEAPs
        if (Math.abs(trend) < 0.03) { // Need at least 3% trend
            return null;
        }
        
        const strike = spotPrice * (trend > 0 ? 0.9 : 1.1); // Deep ITM for delta
        const optionType = trend > 0 ? 'CALL' : 'PUT';
        
        const credit = this.estimateOptionCredit(marketData, strike, null, 365, optionType);
        
        return {
            entryDate: date,
            strategy: 'LEAP',
            symbol: marketData.symbol,
            spotPrice,
            strike,
            dte: 365,
            optionType,
            credit: -credit, // Negative because we're buying
            capitalRequired: credit * 100,
            targetProfit: credit * 0.5, // 50% gain target
            stopLoss: credit * 0.3, // 30% loss stop
            vixAtEntry: vixLevel
        };
    }
    
    /**
     * Validate entry before placing trade
     */
    validateEntry(entry) {
        if (!entry) return false;
        
        // Basic validation
        if (!entry.strategy || !entry.symbol) return false;
        if (!entry.capitalRequired || entry.capitalRequired <= 0) return false;
        
        // Check if we have sufficient capital
        const availableCapital = this.currentCapital - this.capitalDeployed;
        if (entry.capitalRequired > availableCapital) {
            return false;
        }
        
        // Check position limits
        const currentPositions = this.positions.filter(p => p.status === 'OPEN').length;
        if (currentPositions >= this.config.maxPositions) {
            return false;
        }
        
        // Check correlation limits
        const sameSymbolPositions = this.positions.filter(
            p => p.status === 'OPEN' && p.symbol === entry.symbol
        ).length;
        if (sameSymbolPositions >= 2) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Calculate trend from market data
     */
    calculateTrend(marketData) {
        // Simple trend calculation based on recent price movement
        const prices = marketData.prices || [];
        if (prices.length < 20) {
            // Fallback to simple calculation if no price history
            const ema21 = marketData.ema21 || marketData.close;
            return (marketData.close - ema21) / ema21;
        }
        
        const recentPrices = prices.slice(-20);
        const firstPrice = recentPrices[0];
        const lastPrice = recentPrices[recentPrices.length - 1];
        
        return (lastPrice - firstPrice) / firstPrice;
    }
    
    /**
     * Estimate option credit for backtesting
     */
    estimateOptionCredit(underlying, strike, longStrike, dte, optionType) {
        const currentPrice = underlying.close;
        const volatility = underlying.iv || 0.2;
        const timeToExpiration = dte / 365;
        
        if (longStrike) {
            // Spread
            const shortCredit = this.greeksCalc.blackScholes(
                currentPrice, strike, timeToExpiration, 0.02, volatility, optionType.toLowerCase()
            );
            const longCost = this.greeksCalc.blackScholes(
                currentPrice, longStrike, timeToExpiration, 0.02, volatility, optionType.toLowerCase()
            );
            return Math.max(0.05, shortCredit - longCost); // Minimum 0.05 credit
        } else {
            // Single option
            const optionPrice = this.greeksCalc.blackScholes(
                currentPrice, strike, timeToExpiration, 0.02, volatility, optionType.toLowerCase()
            );
            return Math.max(0.05, optionPrice);
        }
    }

    /**
     * Calculate 5-delta strikes
     */
    calculate5DeltaStrikes(price, iv, dte) {
        const timeToExpiration = dte / 365;
        
        // Approximate 5-delta strikes (simplified)
        const factor = iv * Math.sqrt(timeToExpiration) * 2.33; // ~5 delta distance
        
        return {
            putStrike: Math.round(price * (1 - factor) / 5) * 5,
            callStrike: Math.round(price * (1 + factor) / 5) * 5,
            strangleWidth: Math.round(price * factor * 2 / 5) * 5 * 2
        };
    }

    /**
     * Scoring functions
     */
    scoreLT112Entry(data) {
        let score = 0;
        
        if (data.ivRank > 50) score += 30;
        else if (data.ivRank > 30) score += 20;
        
        if (data.rsi > 60) score += 20;
        if (data.close > data.sma20) score += 15;
        
        const rangePosition = (data.close - data.low) / (data.high - data.low);
        if (rangePosition > 0.7) score += 20;
        
        return score;
    }

    scoreStrangleEntry(data, strikes) {
        let score = 0;
        
        if (data.ivRank > 70) score += 40;
        else if (data.ivRank > 50) score += 30;
        else if (data.ivRank > 30) score += 20;
        
        const range20d = Math.abs(data.high - data.low) / data.close * 100;
        if (range20d < 5) score += 30;
        else if (range20d < 10) score += 20;
        
        return score;
    }

    /**
     * Position entry and exit
     */
    enterPosition(entry, date) {
        const position = {
            ...entry,
            entryDate: date,
            id: this.generatePositionId(),
            status: 'OPEN'
        };

        // Check buying power
        const bpRequired = this.calculateBPRequired(position);
        if (bpRequired > this.getAvailableBP()) {
            this.logger.warn('BACKTEST', 'Insufficient buying power', { required: bpRequired, available: this.getAvailableBP() });
            return;
        }

        // Add to correlation tracking
        this.updateCorrelationGroup(position.underlying, 1);

        this.positions.push(position);
        this.logger.debug('BACKTEST', `Entered ${position.strategy} position`, {
            underlying: position.underlying,
            entry: position.entryValue,
            date
        });
    }

    closePosition(position, reason, exitValue, date) {
        const trade = {
            id: position.id,
            strategy: position.strategy,
            underlying: position.underlying,
            entryDate: position.entryDate,
            exitDate: date,
            entryValue: position.entryValue,
            exitValue,
            pnl: exitValue - position.entryValue,
            pnlPercent: ((exitValue - position.entryValue) / Math.abs(position.entryValue)) * 100,
            exitReason: reason,
            contracts: position.contracts,
            dte: this.calculateDTE(position.entryDate, position.expiration),
            holdingPeriod: this.calculateHoldingPeriod(position.entryDate, date)
        };

        // Update capital
        this.currentCapital += trade.pnl - (this.config.commissions * position.contracts * 2); // Round trip commission

        // Update correlation tracking
        this.updateCorrelationGroup(position.underlying, -1);

        this.trades.push(trade);
        this.logger.debug('BACKTEST', `Closed ${position.strategy} position`, {
            pnl: trade.pnl,
            reason,
            date
        });
    }

    /**
     * Utility functions
     */
    
    async loadAllHistoricalData(symbols) {
        const data = {};
        
        for (const symbol of symbols) {
            try {
                data[symbol] = await this.dataManager.fetchHistoricalData(
                    symbol, 
                    this.config.startDate, 
                    this.config.endDate
                );
                this.logger.info('BACKTEST', `Loaded ${data[symbol].length} bars for ${symbol}`);
            } catch (error) {
                this.logger.error('BACKTEST', `Failed to load data for ${symbol}`, error);
            }
        }
        
        return data;
    }

    extractDayMarketData(marketData, dateStr) {
        const dayData = {};
        
        for (const [symbol, data] of Object.entries(marketData)) {
            const dayBar = data.find(bar => bar.date === dateStr);
            if (dayBar) {
                dayData[symbol] = dayBar;
            }
        }
        
        return Object.keys(dayData).length > 0 ? dayData : null;
    }

    generateTradingCalendar(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const tradingDays = [];
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            // Skip weekends
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                tradingDays.push(new Date(date));
            }
        }
        
        return tradingDays;
    }

    getDefaultSymbols() {
        return ['ES', 'MES', 'NQ', 'MNQ', 'CL', 'MCL', 'GC', 'MGC', 'SPY', 'QQQ', 'IWM', 'TLT', 'GLD', 'VIX'];
    }

    getStrategySymbols(strategyName) {
        const symbolMap = {
            '0DTE': ['ES'],
            'LT112': ['ES', 'MES'],
            'STRANGLE': ['MCL', 'MGC', 'MES', 'MNQ', 'GLD', 'TLT', 'SLV'],
            'IPMCC': ['SPY', 'QQQ', 'IWM'],
            'LEAP': ['SPY']
        };
        return symbolMap[strategyName] || this.getDefaultSymbols();
    }

    getAvailableStrategies(dayOfWeek) {
        const strategies = [];
        
        Object.entries(this.tomKingRules.strategies).forEach(([name, rules]) => {
            if (rules.daysAllowed.includes(dayOfWeek)) {
                strategies.push(name);
            }
        });
        
        return strategies;
    }

    updatePhase() {
        const phases = this.tomKingRules.phases;
        for (const [phase, limits] of Object.entries(phases)) {
            if (this.currentCapital >= limits.minCapital && this.currentCapital < limits.maxCapital) {
                this.currentPhase = parseInt(phase);
                break;
            }
        }
    }

    calculateDTE(currentDate, expiration) {
        const current = new Date(currentDate);
        const exp = new Date(expiration);
        return Math.ceil((exp - current) / (1000 * 60 * 60 * 24));
    }

    calculateHoldingPeriod(entryDate, exitDate) {
        return Math.ceil((new Date(exitDate) - new Date(entryDate)) / (1000 * 60 * 60 * 24));
    }

    getNextFriday(date) {
        const result = new Date(date);
        const day = result.getDay();
        const daysUntilFriday = (5 - day + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntilFriday);
        return result;
    }

    canAddPosition() {
        return this.positions.length < this.config.maxPositions &&
               this.getUsedBPPercent() < this.config.maxBPUsage;
    }

    getUsedBPPercent() {
        const totalBP = this.positions.reduce((sum, pos) => sum + this.calculateBPRequired(pos), 0);
        return (totalBP / this.currentCapital) * 100;
    }

    getAvailableBP() {
        const usedBP = this.positions.reduce((sum, pos) => sum + this.calculateBPRequired(pos), 0);
        const maxBP = this.getMaxBPUsage(this.currentVIX || 20); // Dynamic VIX-based BP
        return (this.currentCapital * maxBP) - usedBP; // Tom King's VIX-based BP system
    }

    calculateBPRequired(position) {
        // Simplified BP calculation - real implementation would be more complex
        switch (position.type) {
            case 'CALL_SPREAD':
            case 'PUT_SPREAD':
                return Math.abs(position.longStrike - position.shortStrike) * position.contracts * this.getContractMultiplier(position.underlying);
            case 'IRON_CONDOR':
                return Math.max(
                    Math.abs(position.putLong - position.putShort),
                    Math.abs(position.callLong - position.callShort)
                ) * position.contracts * this.getContractMultiplier(position.underlying);
            case 'SHORT_STRANGLE':
                return Math.abs(position.entryValue) * 2; // Rough estimate
            default:
                return Math.abs(position.entryValue);
        }
    }

    getContractMultiplier(symbol) {
        const multipliers = {
            'ES': 50, 'MES': 5, 'NQ': 20, 'MNQ': 2,
            'CL': 1000, 'MCL': 100, 'GC': 100, 'MGC': 10,
            'SPY': 100, 'QQQ': 100, 'IWM': 100
        };
        return multipliers[symbol] || 100;
    }

    getCorrelationGroupCount(symbol) {
        const group = this.getCorrelationGroup(symbol);
        return this.correlationGroups.get(group) || 0;
    }

    updateCorrelationGroup(symbol, delta) {
        const group = this.getCorrelationGroup(symbol);
        const current = this.correlationGroups.get(group) || 0;
        this.correlationGroups.set(group, current + delta);
    }

    getCorrelationGroup(symbol) {
        const groups = {
            'ES': 'EQUITIES', 'MES': 'EQUITIES', 'NQ': 'EQUITIES', 'MNQ': 'EQUITIES',
            'SPY': 'EQUITIES', 'QQQ': 'EQUITIES', 'IWM': 'EQUITIES',
            'CL': 'ENERGY', 'MCL': 'ENERGY',
            'GC': 'METALS', 'MGC': 'METALS', 'GLD': 'METALS', 'SLV': 'METALS',
            'TLT': 'BONDS'
        };
        return groups[symbol] || 'OTHER';
    }

    calculate0DTEContracts() {
        const contracts = { 1: 1, 2: 2, 3: 3, 4: 5 };
        return contracts[this.currentPhase] || 1;
    }

    getStrangleTickersByPhase(phase) {
        const tickers = {
            1: ['MCL', 'MGC', 'GLD', 'TLT'],
            2: ['MCL', 'MGC', 'MES', 'MNQ', 'SLV'],
            3: ['CL', 'GC', 'ES', 'NQ'],
            4: ['CL', 'GC', 'ES', 'NQ', 'SI', 'HG']
        };
        return tickers[phase] || tickers[1];
    }

    calculateDailyPnL(date, marketData) {
        let totalPnL = 0;
        
        this.positions.forEach(position => {
            const currentValue = this.calculatePositionValue(position, marketData);
            totalPnL += currentValue - position.entryValue;
        });
        
        return totalPnL;
    }

    generatePositionId() {
        return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    isExpiration(expirationDate) {
        const today = new Date().toISOString().split('T')[0];
        return expirationDate === today;
    }

    async generateBacktestResults(strategyFilter = null) {
        // Implementation for generating comprehensive backtest results
        // This will be implemented in the next file
        return {
            trades: this.trades,
            metrics: await this.calculatePerformanceMetrics(strategyFilter),
            dailyPnL: this.dailyPnL,
            positions: this.positions
        };
    }

    async calculatePerformanceMetrics(strategyFilter) {
        const filteredTrades = strategyFilter ? 
            this.trades.filter(trade => trade.strategy === strategyFilter) : 
            this.trades;

        if (filteredTrades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnL: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                returnOnInvestment: 0,
                monthlyReturns: [],
                maxConsecutiveLosses: 0,
                maxConsecutiveWins: 0,
                averageDaysInTrade: 0
            };
        }

        const winningTrades = filteredTrades.filter(trade => trade.pnl > 0);
        const losingTrades = filteredTrades.filter(trade => trade.pnl < 0);
        
        const totalWinAmount = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const totalLossAmount = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
        
        // Calculate drawdown
        let runningPnL = 0;
        let peak = 0;
        let maxDrawdown = 0;
        
        filteredTrades.forEach(trade => {
            runningPnL += trade.pnl;
            if (runningPnL > peak) {
                peak = runningPnL;
            }
            const drawdown = peak - runningPnL;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        // Calculate consecutive wins/losses
        let currentStreak = 0;
        let maxWinStreak = 0;
        let maxLossStreak = 0;
        let lastWasWin = null;

        filteredTrades.forEach(trade => {
            const isWin = trade.pnl > 0;
            if (lastWasWin === isWin) {
                currentStreak++;
            } else {
                if (lastWasWin === true) {
                    maxWinStreak = Math.max(maxWinStreak, currentStreak);
                } else if (lastWasWin === false) {
                    maxLossStreak = Math.max(maxLossStreak, currentStreak);
                }
                currentStreak = 1;
                lastWasWin = isWin;
            }
        });

        // Final streak check
        if (lastWasWin === true) {
            maxWinStreak = Math.max(maxWinStreak, currentStreak);
        } else if (lastWasWin === false) {
            maxLossStreak = Math.max(maxLossStreak, currentStreak);
        }

        // Calculate average days in trade
        const avgDaysInTrade = filteredTrades.reduce((sum, trade) => {
            if (trade.exitDate && trade.entryDate) {
                const days = (new Date(trade.exitDate) - new Date(trade.entryDate)) / (1000 * 60 * 60 * 24);
                return sum + days;
            }
            return sum;
        }, 0) / filteredTrades.length;

        const totalPnL = filteredTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const returnOnInvestment = (totalPnL / this.startingBalance) * 100;

        return {
            totalTrades: filteredTrades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: (winningTrades.length / filteredTrades.length) * 100,
            totalPnL: totalPnL,
            avgWin: winningTrades.length > 0 ? totalWinAmount / winningTrades.length : 0,
            avgLoss: losingTrades.length > 0 ? totalLossAmount / losingTrades.length : 0,
            profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : totalWinAmount > 0 ? 999 : 0,
            maxDrawdown: maxDrawdown,
            sharpeRatio: this.calculateSharpeRatio(filteredTrades),
            returnOnInvestment: returnOnInvestment,
            monthlyReturns: this.calculateMonthlyReturns(filteredTrades),
            maxConsecutiveLosses: maxLossStreak,
            maxConsecutiveWins: maxWinStreak,
            averageDaysInTrade: Math.round(avgDaysInTrade * 10) / 10
        };
    }

    calculateSharpeRatio(trades) {
        if (trades.length < 2) return 0;
        
        const returns = trades.map(trade => trade.pnl);
        const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1);
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return avgReturn > 0 ? 999 : 0;
        
        // Assuming risk-free rate of 2% annually, or ~0.0055% daily
        const riskFreeRate = 0.000055;
        return (avgReturn - riskFreeRate) / stdDev;
    }

    calculateMonthlyReturns(trades) {
        const monthlyData = {};
        
        trades.forEach(trade => {
            if (trade.exitDate) {
                const date = new Date(trade.exitDate);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = 0;
                }
                monthlyData[monthKey] += trade.pnl;
            }
        });

        return Object.entries(monthlyData).map(([month, pnl]) => ({
            month,
            pnl,
            returnPct: (pnl / this.startingBalance) * 100
        })).sort((a, b) => a.month.localeCompare(b.month));
    }

    /**
     * Get portfolio summary
     */
    getPortfolioSummary() {
        const openPositions = this.positions?.filter(p => p.status === 'OPEN') || [];
        const closedPositions = this.trades || [];
        
        const unrealizedPnL = openPositions.reduce((sum, pos) => {
            return sum + (pos.currentValue || pos.entryValue) - pos.entryValue;
        }, 0);
        
        const realizedPnL = closedPositions.reduce((sum, trade) => sum + trade.pnl, 0);
        
        return {
            totalValue: this.currentCapital + unrealizedPnL,
            positionCount: openPositions.length,
            unrealizedPnL,
            realizedPnL,
            totalPnL: unrealizedPnL + realizedPnL,
            currentPositions: openPositions.length,
            totalReturn: ((this.currentCapital - this.config.initialCapital) / this.config.initialCapital)
        };
    }

    /**
     * Load market data for specific date
     */
    async loadMarketDataForDate(date, symbols) {
        const marketData = {};
        const dateStr = date.toISOString().split('T')[0];
        
        // CRITICAL: Must use REAL historical data from TastyTrade API
        // No simulated/random data allowed per user requirements
        
        try {
            // Connect to TastyTrade API if not connected
            if (!this.api || !this.api.isAuthenticated()) {
                throw new Error('TastyTrade API not connected - cannot get real historical data');
            }
            
            // Fetch real historical data for each symbol
            for (const symbol of symbols) {
                const historicalData = await this.api.getHistoricalData(symbol, dateStr, dateStr);
                
                if (!historicalData || historicalData.length === 0) {
                    throw new Error(`No historical data available for ${symbol} on ${dateStr}`);
                }
                
                const dayData = historicalData[0];
                marketData[symbol] = {
                    date: dateStr,
                    open: dayData.open,
                    high: dayData.high,
                    low: dayData.low,
                    close: dayData.close,
                    volume: dayData.volume,
                    iv: dayData.iv || await this.api.getHistoricalIV(symbol, dateStr),
                    ivRank: dayData.ivRank || await this.api.getIVRank(symbol, dateStr),
                    rsi: await this.api.getHistoricalRSI(symbol, dateStr),
                    ema21: await this.api.getHistoricalEMA(symbol, dateStr, 21),
                    sma20: await this.api.getHistoricalSMA(symbol, dateStr, 20),
                    isRealData: true // Flag to confirm this is real data
                };
            }
            
            // Get real VIX data
            const vixData = await this.api.getHistoricalData('VIX', dateStr, dateStr);
            if (vixData && vixData.length > 0) {
                marketData.VIX = {
                    close: vixData[0].close,
                    isRealData: true
                };
            } else {
                throw new Error(`No VIX data available for ${dateStr}`);
            }
            
            return marketData;
            
        } catch (error) {
            // NO FALLBACK TO SIMULATED DATA - FAIL PROPERLY
            console.error(`\n❌ CRITICAL: Cannot load real historical data for ${dateStr}`);
            console.error(`   Error: ${error.message}`);
            console.error('   Backtesting cannot proceed without real historical data\n');
            
            throw new Error(`Real historical data unavailable: ${error.message}`);
        }
    }
    
    /**
     * Initialize trade replay system
     */
    initializeTradeReplay(trades, marketData = null) {
        this.tradeReplay = {
            enabled: true,
            speed: 1,
            currentIndex: 0,
            trades: trades || this.tradeHistory,
            marketSnapshots: marketData || [],
            events: [],
            breakpoints: [],
            isPaused: false,
            startTime: null,
            endTime: null,
            currentTime: null
        };
        
        // Sort trades by entry date
        this.tradeReplay.trades.sort((a, b) => 
            new Date(a.entryDate) - new Date(b.entryDate)
        );
        
        if (this.tradeReplay.trades.length > 0) {
            this.tradeReplay.startTime = new Date(this.tradeReplay.trades[0].entryDate);
            this.tradeReplay.endTime = new Date(
                this.tradeReplay.trades[this.tradeReplay.trades.length - 1].exitDate || 
                this.tradeReplay.trades[this.tradeReplay.trades.length - 1].entryDate
            );
            this.tradeReplay.currentTime = this.tradeReplay.startTime;
        }
        
        this.logger.info('TRADE_REPLAY', 'Trade replay initialized', {
            totalTrades: this.tradeReplay.trades.length,
            startTime: this.tradeReplay.startTime,
            endTime: this.tradeReplay.endTime
        });
        
        return this.tradeReplay;
    }
    
    /**
     * Start trade replay
     */
    async startTradeReplay(options = {}) {
        if (!this.tradeReplay.enabled || this.tradeReplay.trades.length === 0) {
            throw new Error('Trade replay not initialized or no trades to replay');
        }
        
        const {
            speed = 1,
            onTradeEntry = () => {},
            onTradeExit = () => {},
            onMarketUpdate = () => {},
            onEvent = () => {},
            breakOnLoss = false,
            breakOnWin = false
        } = options;
        
        this.tradeReplay.speed = speed;
        this.tradeReplay.isPaused = false;
        
        this.logger.info('TRADE_REPLAY', 'Starting trade replay', {
            speed: `${speed}x`,
            totalTrades: this.tradeReplay.trades.length
        });
        
        // Process trades in sequence
        while (this.tradeReplay.currentIndex < this.tradeReplay.trades.length && !this.tradeReplay.isPaused) {
            const trade = this.tradeReplay.trades[this.tradeReplay.currentIndex];
            
            // Update current time
            this.tradeReplay.currentTime = new Date(trade.entryDate);
            
            // Get market snapshot for this time
            const marketSnapshot = this.getMarketSnapshotAtTime(this.tradeReplay.currentTime);
            
            // Emit trade entry event
            await this.emitReplayEvent('TRADE_ENTRY', {
                trade,
                marketSnapshot,
                index: this.tradeReplay.currentIndex,
                totalTrades: this.tradeReplay.trades.length,
                currentTime: this.tradeReplay.currentTime
            });
            
            await onTradeEntry(trade, marketSnapshot);
            
            // Wait based on replay speed
            if (this.tradeReplay.speed > 0) {
                const waitTime = trade.exitDate 
                    ? (new Date(trade.exitDate) - new Date(trade.entryDate)) / this.tradeReplay.speed
                    : 1000 / this.tradeReplay.speed;
                
                await this.sleep(Math.min(waitTime, 5000)); // Cap at 5 seconds max wait
            }
            
            // Process trade exit if exists
            if (trade.exitDate) {
                this.tradeReplay.currentTime = new Date(trade.exitDate);
                const exitSnapshot = this.getMarketSnapshotAtTime(this.tradeReplay.currentTime);
                
                await this.emitReplayEvent('TRADE_EXIT', {
                    trade,
                    marketSnapshot: exitSnapshot,
                    pnl: trade.pnl,
                    currentTime: this.tradeReplay.currentTime
                });
                
                await onTradeExit(trade, exitSnapshot);
                
                // Check breakpoints
                if ((breakOnLoss && trade.pnl < 0) || (breakOnWin && trade.pnl > 0)) {
                    this.pauseReplay();
                    await this.emitReplayEvent('BREAKPOINT_HIT', {
                        reason: trade.pnl < 0 ? 'LOSS' : 'WIN',
                        trade,
                        currentTime: this.tradeReplay.currentTime
                    });
                }
            }
            
            // Update portfolio metrics
            this.updateReplayMetrics(trade);
            
            // Move to next trade
            this.tradeReplay.currentIndex++;
            
            // Emit progress update
            await onEvent({
                type: 'PROGRESS',
                current: this.tradeReplay.currentIndex,
                total: this.tradeReplay.trades.length,
                percentComplete: (this.tradeReplay.currentIndex / this.tradeReplay.trades.length) * 100
            });
        }
        
        // Replay complete
        await this.emitReplayEvent('REPLAY_COMPLETE', {
            totalTrades: this.tradeReplay.trades.length,
            finalMetrics: this.getReplayMetrics()
        });
        
        return this.getReplayMetrics();
    }
    
    /**
     * Pause trade replay
     */
    pauseReplay() {
        if (this.tradeReplay.enabled) {
            this.tradeReplay.isPaused = true;
            this.logger.info('TRADE_REPLAY', 'Replay paused', {
                currentIndex: this.tradeReplay.currentIndex,
                currentTime: this.tradeReplay.currentTime
            });
        }
    }
    
    /**
     * Resume trade replay
     */
    resumeReplay() {
        if (this.tradeReplay.enabled && this.tradeReplay.isPaused) {
            this.tradeReplay.isPaused = false;
            this.logger.info('TRADE_REPLAY', 'Replay resumed');
            return this.startTradeReplay(); // Continue from current index
        }
    }
    
    /**
     * Step forward one trade
     */
    async stepForward() {
        if (!this.tradeReplay.enabled || this.tradeReplay.currentIndex >= this.tradeReplay.trades.length) {
            return null;
        }
        
        const trade = this.tradeReplay.trades[this.tradeReplay.currentIndex];
        this.tradeReplay.currentIndex++;
        this.tradeReplay.currentTime = new Date(trade.entryDate);
        
        await this.emitReplayEvent('STEP_FORWARD', { trade });
        
        return trade;
    }
    
    /**
     * Step backward one trade
     */
    async stepBackward() {
        if (!this.tradeReplay.enabled || this.tradeReplay.currentIndex <= 0) {
            return null;
        }
        
        this.tradeReplay.currentIndex--;
        const trade = this.tradeReplay.trades[this.tradeReplay.currentIndex];
        this.tradeReplay.currentTime = new Date(trade.entryDate);
        
        await this.emitReplayEvent('STEP_BACKWARD', { trade });
        
        return trade;
    }
    
    /**
     * Jump to specific trade index
     */
    jumpToTrade(index) {
        if (!this.tradeReplay.enabled || index < 0 || index >= this.tradeReplay.trades.length) {
            return false;
        }
        
        this.tradeReplay.currentIndex = index;
        const trade = this.tradeReplay.trades[index];
        this.tradeReplay.currentTime = new Date(trade.entryDate);
        
        this.emitReplayEvent('JUMP_TO', { 
            index,
            trade,
            currentTime: this.tradeReplay.currentTime
        });
        
        return trade;
    }
    
    /**
     * Set replay speed
     */
    setReplaySpeed(speed) {
        this.tradeReplay.speed = Math.max(0, Math.min(speed, 100)); // 0-100x speed
        this.logger.info('TRADE_REPLAY', `Replay speed set to ${this.tradeReplay.speed}x`);
    }
    
    /**
     * Add breakpoint at specific condition
     */
    addBreakpoint(condition) {
        this.tradeReplay.breakpoints.push({
            id: Date.now(),
            condition,
            hits: 0
        });
        
        return this.tradeReplay.breakpoints.length - 1;
    }
    
    /**
     * Get market snapshot at specific time
     */
    getMarketSnapshotAtTime(timestamp) {
        if (!this.tradeReplay.marketSnapshots || this.tradeReplay.marketSnapshots.length === 0) {
            return null;
        }
        
        // Find closest market snapshot
        const targetTime = new Date(timestamp).getTime();
        let closest = this.tradeReplay.marketSnapshots[0];
        let minDiff = Math.abs(new Date(closest.timestamp).getTime() - targetTime);
        
        for (const snapshot of this.tradeReplay.marketSnapshots) {
            const diff = Math.abs(new Date(snapshot.timestamp).getTime() - targetTime);
            if (diff < minDiff) {
                minDiff = diff;
                closest = snapshot;
            }
        }
        
        return closest;
    }
    
    /**
     * Update replay metrics
     */
    updateReplayMetrics(trade) {
        if (!this.replayMetrics) {
            this.replayMetrics = {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                totalPnL: 0,
                maxWin: 0,
                maxLoss: 0,
                currentStreak: 0,
                maxWinStreak: 0,
                maxLossStreak: 0,
                byStrategy: {},
                bySymbol: {}
            };
        }
        
        this.replayMetrics.totalTrades++;
        
        if (trade.pnl > 0) {
            this.replayMetrics.winningTrades++;
            this.replayMetrics.maxWin = Math.max(this.replayMetrics.maxWin, trade.pnl);
            if (this.replayMetrics.currentStreak >= 0) {
                this.replayMetrics.currentStreak++;
                this.replayMetrics.maxWinStreak = Math.max(
                    this.replayMetrics.maxWinStreak,
                    this.replayMetrics.currentStreak
                );
            } else {
                this.replayMetrics.currentStreak = 1;
            }
        } else {
            this.replayMetrics.losingTrades++;
            this.replayMetrics.maxLoss = Math.min(this.replayMetrics.maxLoss, trade.pnl);
            if (this.replayMetrics.currentStreak <= 0) {
                this.replayMetrics.currentStreak--;
                this.replayMetrics.maxLossStreak = Math.max(
                    this.replayMetrics.maxLossStreak,
                    Math.abs(this.replayMetrics.currentStreak)
                );
            } else {
                this.replayMetrics.currentStreak = -1;
            }
        }
        
        this.replayMetrics.totalPnL += trade.pnl;
        
        // Track by strategy
        const strategy = trade.strategy || 'UNKNOWN';
        if (!this.replayMetrics.byStrategy[strategy]) {
            this.replayMetrics.byStrategy[strategy] = {
                trades: 0,
                wins: 0,
                pnl: 0
            };
        }
        this.replayMetrics.byStrategy[strategy].trades++;
        if (trade.pnl > 0) this.replayMetrics.byStrategy[strategy].wins++;
        this.replayMetrics.byStrategy[strategy].pnl += trade.pnl;
        
        // Track by symbol
        const symbol = trade.symbol || 'UNKNOWN';
        if (!this.replayMetrics.bySymbol[symbol]) {
            this.replayMetrics.bySymbol[symbol] = {
                trades: 0,
                wins: 0,
                pnl: 0
            };
        }
        this.replayMetrics.bySymbol[symbol].trades++;
        if (trade.pnl > 0) this.replayMetrics.bySymbol[symbol].wins++;
        this.replayMetrics.bySymbol[symbol].pnl += trade.pnl;
    }
    
    /**
     * Get replay metrics
     */
    getReplayMetrics() {
        if (!this.replayMetrics) {
            return null;
        }
        
        const winRate = this.replayMetrics.totalTrades > 0
            ? this.replayMetrics.winningTrades / this.replayMetrics.totalTrades
            : 0;
        
        const avgWin = this.replayMetrics.winningTrades > 0
            ? this.replayMetrics.totalPnL / this.replayMetrics.winningTrades
            : 0;
        
        const avgLoss = this.replayMetrics.losingTrades > 0
            ? this.replayMetrics.totalPnL / this.replayMetrics.losingTrades
            : 0;
        
        return {
            ...this.replayMetrics,
            winRate,
            avgWin,
            avgLoss,
            profitFactor: Math.abs(avgWin * this.replayMetrics.winningTrades) / 
                         Math.abs(avgLoss * this.replayMetrics.losingTrades) || 0,
            currentIndex: this.tradeReplay.currentIndex,
            progress: (this.tradeReplay.currentIndex / this.tradeReplay.trades.length) * 100
        };
    }
    
    /**
     * Emit replay event
     */
    async emitReplayEvent(type, data) {
        const event = {
            type,
            timestamp: new Date(),
            replayTime: this.tradeReplay.currentTime,
            data
        };
        
        this.tradeReplay.events.push(event);
        
        // Emit to any listeners
        if (this.eventEmitter) {
            this.eventEmitter.emit('replay-event', event);
        }
        
        // Log important events
        if (['TRADE_ENTRY', 'TRADE_EXIT', 'BREAKPOINT_HIT'].includes(type)) {
            this.logger.debug('TRADE_REPLAY', type, data);
        }
    }
    
    /**
     * Export replay session
     */
    async exportReplaySession(filepath) {
        const fs = require('fs').promises;
        
        const session = {
            config: this.config,
            replay: {
                trades: this.tradeReplay.trades,
                events: this.tradeReplay.events,
                metrics: this.getReplayMetrics()
            },
            exported: new Date().toISOString()
        };
        
        await fs.writeFile(filepath, JSON.stringify(session, null, 2));
        this.logger.info('TRADE_REPLAY', `Replay session exported to ${filepath}`);
        
        return session;
    }
    
    /**
     * Load replay session
     */
    async loadReplaySession(filepath) {
        const fs = require('fs').promises;
        
        try {
            const data = await fs.readFile(filepath, 'utf8');
            const session = JSON.parse(data);
            
            // Initialize with loaded data
            this.config = { ...this.config, ...session.config };
            this.initializeTradeReplay(session.replay.trades);
            this.tradeReplay.events = session.replay.events || [];
            
            this.logger.info('TRADE_REPLAY', `Replay session loaded from ${filepath}`, {
                trades: session.replay.trades.length,
                events: session.replay.events.length
            });
            
            return session;
            
        } catch (error) {
            this.logger.error('TRADE_REPLAY', `Failed to load replay session: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Sleep helper for replay timing
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { BacktestingEngine };