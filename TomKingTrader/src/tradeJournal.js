/**
 * Trade Journal & Performance Tracking
 * Comprehensive trade logging and analysis system
 */

const fs = require('fs').promises;
const path = require('path');
const { RISK_LIMITS } = require('./config');
const { getLogger } = require('./logger');
const { PerformanceMetrics } = require('./performanceMetrics');
const { generateJournalId } = require('../utils/idGenerator');

const logger = getLogger();

class TradeJournal {
    constructor(config = {}) {
        this.config = {
            journalPath: config.journalPath || './journals',
            autoSave: config.autoSave !== false,
            saveInterval: config.saveInterval || 60000, // 1 minute
            ...config
        };
        
        this.trades = [];
        this.currentJournal = null;
        this.statistics = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            largestWin: 0,
            largestLoss: 0,
            avgWin: 0,
            avgLoss: 0,
            winRate: 0,
            profitFactor: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            currentStreak: 0,
            bestStreak: 0,
            worstStreak: 0
        };
        
        this.initialize();
    }
    
    /**
     * Initialize journal system with daily checklist
     */
    async initialize() {
        try {
            // Ensure journal directory exists
            await fs.mkdir(this.config.journalPath, { recursive: true });
            
            // Load current journal
            await this.loadCurrentJournal();
            
            // Initialize daily checklist
            await this.initializeDailyChecklist();
            
            // Setup auto-save
            if (this.config.autoSave) {
                this.autoSaveInterval = setInterval(() => {
                    this.saveJournal();
                }, this.config.saveInterval);
            }
            
            logger.info('JOURNAL', 'Trade journal initialized with daily checklist');
            
        } catch (error) {
            logger.error('JOURNAL', 'Failed to initialize journal', error);
        }
    }
    
    /**
     * Initialize daily trading checklist - Tom King methodology
     */
    async initializeDailyChecklist() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        
        this.dailyChecklist = {
            date: today.toISOString().split('T')[0],
            dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
            isFriday: dayOfWeek === 5,
            completed: false,
            startTime: null,
            endTime: null,
            
            // Pre-market checklist
            preMarket: {
                completed: false,
                items: {
                    checkAccountBalance: { done: false, value: null, target: 'Record current balance' },
                    reviewOpenPositions: { done: false, count: 0, notes: [] },
                    checkExpirations: { done: false, todayExpiring: 0, weekExpiring: 0 },
                    assessMarketConditions: { done: false, vix: null, spy: null, trend: null },
                    checkEconomicCalendar: { done: false, events: [], highImpact: 0 },
                    reviewCorrelations: { done: false, groups: {}, violations: [] },
                    setDailyGoals: { done: false, profitTarget: null, maxLoss: null },
                    verifyBuyingPower: { done: false, available: null, usage: null },
                    checkForAssignments: { done: false, assignments: [] },
                    reviewYesterdayTrades: { done: false, pnl: null, lessons: [] }
                }
            },
            
            // Market hours checklist
            marketHours: {
                completed: false,
                items: {
                    morningRoutine: {
                        '9:30-10:00': { done: false, action: 'Observe opening volatility', notes: null },
                        '10:00-10:30': { done: false, action: 'Check 0DTE setup (Friday)', notes: null },
                        '10:30-11:00': { done: false, action: 'Execute morning trades', notes: null }
                    },
                    middayReview: {
                        '12:00-12:30': { done: false, action: 'Review morning positions', notes: null },
                        checkProfitTargets: { done: false, closed: 0, remaining: 0 },
                        assessNewOpportunities: { done: false, identified: [] }
                    },
                    afternoonManagement: {
                        '14:00-14:30': { done: false, action: 'Defensive checks', notes: null },
                        '14:30-15:00': { done: false, action: '21 DTE management', notes: null },
                        '15:00-15:30': { done: false, action: 'End of day positioning', notes: null },
                        '15:30-16:00': { done: false, action: 'Final adjustments', notes: null }
                    }
                }
            },
            
            // Post-market checklist
            postMarket: {
                completed: false,
                items: {
                    calculateDailyPnL: { done: false, realized: null, unrealized: null, total: null },
                    reviewAllTrades: { done: false, winners: 0, losers: 0, winRate: null },
                    updateJournal: { done: false, entries: 0, lessons: [] },
                    planTomorrow: { done: false, watchlist: [], potentialTrades: [] },
                    checkAssignmentRisk: { done: false, atRisk: [], action: null },
                    reviewMistakes: { done: false, mistakes: [], preventionPlan: [] },
                    updateMetrics: { done: false, weeklyPnL: null, monthlyPnL: null },
                    backupData: { done: false, timestamp: null }
                }
            },
            
            // Tom King specific checks
            tomKingRules: {
                fridayZeroDTE: { 
                    applicable: dayOfWeek === 5,
                    checkTime: '10:30',
                    executed: false,
                    strikes: null,
                    premium: null
                },
                correlationLimits: {
                    checked: false,
                    violations: [],
                    maxGroupSize: 3
                },
                vixRegimeCheck: {
                    checked: false,
                    currentRegime: null,
                    positionAdjustment: null
                },
                profitTargets: {
                    checked: false,
                    at50Percent: [],
                    closedToday: []
                },
                defensiveRules: {
                    checked: false,
                    at21DTE: [],
                    tested: [],
                    actionsTaken: []
                }
            },
            
            // Risk management checks
            riskManagement: {
                buyingPowerUsage: { checked: false, current: null, max: 'DYNAMIC', withinLimits: null }, // Uses RISK_LIMITS.getMaxBPUsage(vix)
                dailyLossLimit: { checked: false, current: null, max: null, breached: false },
                positionSizing: { checked: false, violations: [] },
                emergencyProtocol: { triggered: false, reason: null, action: null }
            },
            
            // Performance tracking
            performance: {
                dailyGoalMet: null,
                weeklyProgress: null,
                monthlyTarget: null,
                compoundingRate: null,
                notes: []
            }
        };
        
        // Load existing checklist if it exists
        await this.loadDailyChecklist();
    }
    
    /**
     * Load today's checklist if it exists
     */
    async loadDailyChecklist() {
        const today = new Date().toISOString().split('T')[0];
        const checklistFile = path.join(this.config.journalPath, `checklist_${today}.json`);
        
        try {
            const data = await fs.readFile(checklistFile, 'utf8');
            const savedChecklist = JSON.parse(data);
            // Merge with current checklist to preserve structure
            this.dailyChecklist = { ...this.dailyChecklist, ...savedChecklist };
            logger.info('JOURNAL', 'Loaded existing daily checklist');
        } catch (error) {
            // No existing checklist, use initialized version
            logger.info('JOURNAL', 'Starting new daily checklist');
        }
    }
    
    /**
     * Update checklist item
     */
    async updateChecklistItem(section, item, value) {
        if (section === 'preMarket' || section === 'postMarket') {
            if (this.dailyChecklist[section].items[item]) {
                this.dailyChecklist[section].items[item].done = true;
                if (typeof value === 'object') {
                    Object.assign(this.dailyChecklist[section].items[item], value);
                } else {
                    this.dailyChecklist[section].items[item].value = value;
                }
            }
        } else if (section === 'marketHours') {
            // Handle nested market hours structure
            for (const period of Object.values(this.dailyChecklist.marketHours.items)) {
                if (period[item]) {
                    period[item].done = true;
                    period[item].notes = value;
                    break;
                }
            }
        } else if (this.dailyChecklist[section] && this.dailyChecklist[section][item]) {
            this.dailyChecklist[section][item] = { 
                ...this.dailyChecklist[section][item], 
                ...value 
            };
        }
        
        await this.saveChecklist();
    }
    
    /**
     * Get checklist completion status
     */
    getChecklistStatus() {
        const status = {
            preMarket: { total: 0, completed: 0, percentage: 0 },
            marketHours: { total: 0, completed: 0, percentage: 0 },
            postMarket: { total: 0, completed: 0, percentage: 0 },
            overall: { total: 0, completed: 0, percentage: 0 }
        };
        
        // Count pre-market items
        for (const item of Object.values(this.dailyChecklist.preMarket.items)) {
            status.preMarket.total++;
            if (item.done) status.preMarket.completed++;
        }
        
        // Count market hours items
        for (const period of Object.values(this.dailyChecklist.marketHours.items)) {
            for (const item of Object.values(period)) {
                if (item.done !== undefined) {
                    status.marketHours.total++;
                    if (item.done) status.marketHours.completed++;
                }
            }
        }
        
        // Count post-market items
        for (const item of Object.values(this.dailyChecklist.postMarket.items)) {
            status.postMarket.total++;
            if (item.done) status.postMarket.completed++;
        }
        
        // Calculate percentages
        status.preMarket.percentage = status.preMarket.total > 0 ? 
            (status.preMarket.completed / status.preMarket.total) * 100 : 0;
        status.marketHours.percentage = status.marketHours.total > 0 ? 
            (status.marketHours.completed / status.marketHours.total) * 100 : 0;
        status.postMarket.percentage = status.postMarket.total > 0 ? 
            (status.postMarket.completed / status.postMarket.total) * 100 : 0;
        
        // Overall
        status.overall.total = status.preMarket.total + status.marketHours.total + status.postMarket.total;
        status.overall.completed = status.preMarket.completed + status.marketHours.completed + status.postMarket.completed;
        status.overall.percentage = status.overall.total > 0 ? 
            (status.overall.completed / status.overall.total) * 100 : 0;
        
        return status;
    }
    
    /**
     * Generate checklist report
     */
    generateChecklistReport() {
        const status = this.getChecklistStatus();
        const report = {
            date: this.dailyChecklist.date,
            dayOfWeek: this.dailyChecklist.dayOfWeek,
            completionStatus: status,
            highlights: [],
            warnings: [],
            recommendations: []
        };
        
        // Check for incomplete critical items
        if (!this.dailyChecklist.preMarket.items.checkAccountBalance.done) {
            report.warnings.push('Account balance not checked');
        }
        if (!this.dailyChecklist.preMarket.items.reviewOpenPositions.done) {
            report.warnings.push('Open positions not reviewed');
        }
        if (!this.dailyChecklist.riskManagement.buyingPowerUsage.checked) {
            report.warnings.push('Buying power usage not verified');
        }
        
        // Friday specific checks
        if (this.dailyChecklist.isFriday) {
            if (this.dailyChecklist.tomKingRules.fridayZeroDTE.applicable && 
                !this.dailyChecklist.tomKingRules.fridayZeroDTE.executed) {
                report.warnings.push('Friday 0DTE trade not executed');
            }
        }
        
        // Highlights
        if (this.dailyChecklist.postMarket.items.calculateDailyPnL.done) {
            const pnl = this.dailyChecklist.postMarket.items.calculateDailyPnL.total;
            if (pnl > 0) {
                report.highlights.push(`Profitable day: £${pnl.toFixed(2)}`);
            }
        }
        
        // Recommendations for tomorrow
        if (this.dailyChecklist.postMarket.items.planTomorrow.done) {
            const plan = this.dailyChecklist.postMarket.items.planTomorrow;
            if (plan.watchlist.length > 0) {
                report.recommendations.push(`Watch: ${plan.watchlist.join(', ')}`);
            }
        }
        
        return report;
    }
    
    /**
     * Save checklist to file
     */
    async saveChecklist() {
        const today = new Date().toISOString().split('T')[0];
        const checklistFile = path.join(this.config.journalPath, `checklist_${today}.json`);
        
        try {
            await fs.writeFile(
                checklistFile, 
                JSON.stringify(this.dailyChecklist, null, 2),
                'utf8'
            );
            logger.debug('JOURNAL', 'Daily checklist saved');
        } catch (error) {
            logger.error('JOURNAL', 'Failed to save checklist', error);
        }
    }
    
    /**
     * Enhanced weekly review functionality
     */
    async generateWeeklyReview() {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7);
        
        const weeklyReview = {
            period: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            },
            summary: {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnL: 0,
                avgDailyPnL: 0,
                bestDay: null,
                worstDay: null
            },
            strategyPerformance: {},
            mistakes: [],
            improvements: [],
            lessonsLearned: [],
            nextWeekPlan: {
                goals: [],
                watchlist: [],
                strategies: [],
                riskLimits: {}
            }
        };
        
        // Load week's journals
        const weekData = await this.loadWeekData(startDate, endDate);
        
        // Analyze performance
        weekData.forEach(day => {
            weeklyReview.summary.totalTrades += day.trades.length;
            weeklyReview.summary.totalPnL += day.statistics.totalPnL;
            
            // Track best/worst days
            if (!weeklyReview.summary.bestDay || day.statistics.totalPnL > weeklyReview.summary.bestDay.pnl) {
                weeklyReview.summary.bestDay = {
                    date: day.date,
                    pnl: day.statistics.totalPnL
                };
            }
            if (!weeklyReview.summary.worstDay || day.statistics.totalPnL < weeklyReview.summary.worstDay.pnl) {
                weeklyReview.summary.worstDay = {
                    date: day.date,
                    pnl: day.statistics.totalPnL
                };
            }
            
            // Analyze by strategy
            day.trades.forEach(trade => {
                const strategy = trade.strategy || 'UNKNOWN';
                if (!weeklyReview.strategyPerformance[strategy]) {
                    weeklyReview.strategyPerformance[strategy] = {
                        trades: 0,
                        wins: 0,
                        losses: 0,
                        pnl: 0
                    };
                }
                weeklyReview.strategyPerformance[strategy].trades++;
                weeklyReview.strategyPerformance[strategy].pnl += trade.pnl;
                if (trade.pnl > 0) weeklyReview.strategyPerformance[strategy].wins++;
                else weeklyReview.strategyPerformance[strategy].losses++;
            });
        });
        
        // Calculate averages
        weeklyReview.summary.avgDailyPnL = weeklyReview.summary.totalPnL / 7;
        weeklyReview.summary.winRate = weeklyReview.summary.totalTrades > 0 ?
            (weeklyReview.summary.winningTrades / weeklyReview.summary.totalTrades) * 100 : 0;
        
        return weeklyReview;
    }
    
    /**
     * Enhanced monthly review
     */
    async generateMonthlyReview() {
        const endDate = new Date();
        const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        
        const monthlyReview = {
            period: {
                month: endDate.toLocaleString('default', { month: 'long' }),
                year: endDate.getFullYear(),
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            },
            performance: {
                totalPnL: 0,
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                returnOnCapital: 0
            },
            goals: {
                target: null,
                achieved: null,
                percentage: 0
            },
            bestTrades: [],
            worstTrades: [],
            strategySummary: {},
            compoundingAnalysis: {
                startingCapital: 0,
                endingCapital: 0,
                growthRate: 0,
                projectedAnnual: 0
            },
            improvements: [],
            nextMonthPlan: {}
        };
        
        // Load month's data
        const monthData = await this.loadMonthData(startDate, endDate);
        
        // Perform comprehensive analysis
        // ... (analysis implementation)
        
        return monthlyReview;
    }
    
    /**
     * Load week's journal data
     */
    async loadWeekData(startDate, endDate) {
        const weekData = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const journalFile = path.join(this.config.journalPath, `journal_${dateStr}.json`);
            
            try {
                const data = await fs.readFile(journalFile, 'utf8');
                weekData.push(JSON.parse(data));
            } catch (error) {
                // No journal for this day
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return weekData;
    }
    
    /**
     * Load month's journal data
     */
    async loadMonthData(startDate, endDate) {
        return this.loadWeekData(startDate, endDate); // Same logic, different period
    }
    
    /**
     * Load current day's journal
     */
    async loadCurrentJournal() {
        const today = new Date().toISOString().split('T')[0];
        const journalFile = path.join(this.config.journalPath, `journal_${today}.json`);
        
        try {
            const data = await fs.readFile(journalFile, 'utf8');
            this.currentJournal = JSON.parse(data);
            this.trades = this.currentJournal.trades || [];
            this.statistics = this.currentJournal.statistics || this.statistics;
            
            logger.info('JOURNAL', `Loaded ${this.trades.length} trades from journal`);
            
        } catch (error) {
            // Journal doesn't exist yet, create new
            this.currentJournal = {
                date: today,
                trades: [],
                statistics: this.statistics,
                notes: []
            };
        }
    }
    
    /**
     * Record a new trade
     */
    async recordTrade(trade) {
        const tradeEntry = {
            id: generateJournalId(),
            timestamp: new Date().toISOString(),
            entryTime: trade.entryTime || new Date().toISOString(),
            exitTime: trade.exitTime || null,
            
            // Trade details
            symbol: trade.symbol,
            strategy: trade.strategy,
            direction: trade.direction, // LONG/SHORT
            quantity: trade.quantity,
            
            // Prices
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice || null,
            stopLoss: trade.stopLoss || null,
            takeProfit: trade.takeProfit || null,
            
            // Options specific
            optionType: trade.optionType || null, // CALL/PUT
            strike: trade.strike || null,
            expiration: trade.expiration || null,
            entryIV: trade.entryIV || null,
            exitIV: trade.exitIV || null,
            
            // Greeks at entry
            delta: trade.delta || null,
            gamma: trade.gamma || null,
            theta: trade.theta || null,
            vega: trade.vega || null,
            
            // P&L
            realizedPnL: trade.realizedPnL || 0,
            unrealizedPnL: trade.unrealizedPnL || 0,
            commission: trade.commission || 0,
            netPnL: null, // Calculated
            
            // Risk metrics
            riskAmount: trade.riskAmount || 0,
            rewardRisk: null, // Calculated
            bpUsed: trade.bpUsed || 0,
            
            // Market conditions
            vixLevel: trade.vixLevel || null,
            marketRegime: trade.marketRegime || null,
            
            // Tags and notes
            tags: trade.tags || [],
            notes: trade.notes || '',
            
            // Status
            status: trade.status || 'OPEN', // OPEN/CLOSED/CANCELLED
            result: null // WIN/LOSS/BREAKEVEN
        };
        
        // Calculate net P&L
        if (tradeEntry.status === 'CLOSED' && tradeEntry.exitPrice) {
            const grossPnL = tradeEntry.direction === 'LONG' 
                ? (tradeEntry.exitPrice - tradeEntry.entryPrice) * tradeEntry.quantity * 100
                : (tradeEntry.entryPrice - tradeEntry.exitPrice) * tradeEntry.quantity * 100;
            
            // Use centralized P&L calculator to ensure consistency
            const plCalculator = new PerformanceMetrics();
            const plResult = plCalculator.calculatePositionPL({
                entryPrice: tradeEntry.entryPrice,
                currentPrice: tradeEntry.exitPrice,
                quantity: tradeEntry.quantity,
                commission: tradeEntry.commission,
                multiplier: tradeEntry.strategy && tradeEntry.strategy.includes('OPTIONS') ? 100 : 1
            });
            tradeEntry.netPnL = plResult.dollarPL;
            tradeEntry.realizedPnL = tradeEntry.netPnL;
            
            // Determine result
            if (tradeEntry.netPnL > 0) {
                tradeEntry.result = 'WIN';
            } else if (tradeEntry.netPnL < 0) {
                tradeEntry.result = 'LOSS';
            } else {
                tradeEntry.result = 'BREAKEVEN';
            }
            
            // Calculate reward/risk
            if (tradeEntry.riskAmount > 0) {
                tradeEntry.rewardRisk = tradeEntry.netPnL / tradeEntry.riskAmount;
            }
        }
        
        // Add to trades
        this.trades.push(tradeEntry);
        
        // Update statistics
        await this.updateStatistics();
        
        // Auto-save if enabled
        if (this.config.autoSave) {
            await this.saveJournal();
        }
        
        logger.info('JOURNAL', `Trade recorded: ${tradeEntry.id} - ${tradeEntry.symbol} ${tradeEntry.result || 'OPEN'}`);
        
        return tradeEntry;
    }
    
    /**
     * Update trade status
     */
    async updateTrade(tradeId, updates) {
        const trade = this.trades.find(t => t.id === tradeId);
        
        if (!trade) {
            logger.warn('JOURNAL', `Trade not found: ${tradeId}`);
            return null;
        }
        
        // Update trade fields
        Object.assign(trade, updates);
        
        // Recalculate if closing trade
        if (updates.status === 'CLOSED' && updates.exitPrice) {
            const grossPnL = trade.direction === 'LONG'
                ? (updates.exitPrice - trade.entryPrice) * trade.quantity * 100
                : (trade.entryPrice - updates.exitPrice) * trade.quantity * 100;
            
            trade.netPnL = grossPnL - (trade.commission || 0);
            trade.realizedPnL = trade.netPnL;
            trade.exitTime = updates.exitTime || new Date().toISOString();
            
            // Determine result
            if (trade.netPnL > 0) {
                trade.result = 'WIN';
            } else if (trade.netPnL < 0) {
                trade.result = 'LOSS';
            } else {
                trade.result = 'BREAKEVEN';
            }
        }
        
        // Update statistics
        await this.updateStatistics();
        
        // Save
        if (this.config.autoSave) {
            await this.saveJournal();
        }
        
        return trade;
    }
    
    /**
     * Update statistics
     */
    async updateStatistics() {
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
        
        if (closedTrades.length === 0) {
            return;
        }
        
        // Basic counts
        this.statistics.totalTrades = closedTrades.length;
        this.statistics.winningTrades = closedTrades.filter(t => t.result === 'WIN').length;
        this.statistics.losingTrades = closedTrades.filter(t => t.result === 'LOSS').length;
        
        // P&L calculations
        const wins = closedTrades.filter(t => t.result === 'WIN');
        const losses = closedTrades.filter(t => t.result === 'LOSS');
        
        const totalWins = wins.reduce((sum, t) => sum + (t.netPnL || 0), 0);
        const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.netPnL || 0), 0));
        
        this.statistics.totalPnL = totalWins - totalLosses;
        this.statistics.avgWin = wins.length > 0 ? totalWins / wins.length : 0;
        this.statistics.avgLoss = losses.length > 0 ? totalLosses / losses.length : 0;
        
        // Win rate
        this.statistics.winRate = this.statistics.totalTrades > 0
            ? (this.statistics.winningTrades / this.statistics.totalTrades) * 100
            : 0;
        
        // Profit factor
        this.statistics.profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
        
        // Largest win/loss
        if (wins.length > 0) {
            this.statistics.largestWin = Math.max(...wins.map(t => t.netPnL || 0));
        }
        if (losses.length > 0) {
            this.statistics.largestLoss = Math.min(...losses.map(t => t.netPnL || 0));
        }
        
        // Calculate streaks
        this.calculateStreaks(closedTrades);
        
        // Calculate drawdown
        this.calculateDrawdown(closedTrades);
        
        // Calculate Sharpe ratio (simplified)
        this.calculateSharpeRatio(closedTrades);
    }
    
    /**
     * Calculate winning/losing streaks
     */
    calculateStreaks(trades) {
        let currentStreak = 0;
        let bestStreak = 0;
        let worstStreak = 0;
        let tempStreak = 0;
        
        for (const trade of trades) {
            if (trade.result === 'WIN') {
                if (tempStreak >= 0) {
                    tempStreak++;
                } else {
                    worstStreak = Math.min(worstStreak, tempStreak);
                    tempStreak = 1;
                }
                bestStreak = Math.max(bestStreak, tempStreak);
            } else if (trade.result === 'LOSS') {
                if (tempStreak <= 0) {
                    tempStreak--;
                } else {
                    bestStreak = Math.max(bestStreak, tempStreak);
                    tempStreak = -1;
                }
                worstStreak = Math.min(worstStreak, tempStreak);
            }
        }
        
        this.statistics.currentStreak = tempStreak;
        this.statistics.bestStreak = bestStreak;
        this.statistics.worstStreak = Math.abs(worstStreak);
    }
    
    /**
     * Calculate maximum drawdown
     */
    calculateDrawdown(trades) {
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;
        
        for (const trade of trades) {
            runningPnL += trade.netPnL || 0;
            peak = Math.max(peak, runningPnL);
            
            const drawdown = peak > 0 ? (peak - runningPnL) / peak : 0;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        
        this.statistics.maxDrawdown = maxDrawdown * 100; // As percentage
    }
    
    /**
     * Calculate Sharpe ratio (simplified)
     */
    calculateSharpeRatio(trades) {
        if (trades.length < 2) {
            this.statistics.sharpeRatio = 0;
            return;
        }
        
        const returns = trades.map(t => t.netPnL || 0);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        // Assuming risk-free rate of 0 for simplicity
        this.statistics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
    }
    
    /**
     * Get trades by filter
     */
    async getTradesByFilter(filter = {}) {
        let filtered = [...this.trades];
        
        // Filter by date range
        if (filter.startDate) {
            filtered = filtered.filter(t => new Date(t.timestamp) >= new Date(filter.startDate));
        }
        if (filter.endDate) {
            filtered = filtered.filter(t => new Date(t.timestamp) <= new Date(filter.endDate));
        }
        
        // Filter by strategy
        if (filter.strategy) {
            filtered = filtered.filter(t => t.strategy === filter.strategy);
        }
        
        // Filter by symbol
        if (filter.symbol) {
            filtered = filtered.filter(t => t.symbol === filter.symbol);
        }
        
        // Filter by result
        if (filter.result) {
            filtered = filtered.filter(t => t.result === filter.result);
        }
        
        // Filter by status
        if (filter.status) {
            filtered = filtered.filter(t => t.status === filter.status);
        }
        
        return filtered;
    }
    
    /**
     * Generate performance report
     */
    async generateReport(period = 'daily') {
        const report = {
            period,
            date: new Date().toISOString(),
            statistics: this.statistics,
            tradesSummary: {
                total: this.trades.length,
                open: this.trades.filter(t => t.status === 'OPEN').length,
                closed: this.trades.filter(t => t.status === 'CLOSED').length,
                cancelled: this.trades.filter(t => t.status === 'CANCELLED').length
            },
            byStrategy: {},
            bySymbol: {},
            topWins: [],
            topLosses: [],
            recommendations: []
        };
        
        // Group by strategy
        const strategies = [...new Set(this.trades.map(t => t.strategy))];
        for (const strategy of strategies) {
            const strategyTrades = this.trades.filter(t => t.strategy === strategy && t.status === 'CLOSED');
            const wins = strategyTrades.filter(t => t.result === 'WIN').length;
            const total = strategyTrades.length;
            
            report.byStrategy[strategy] = {
                trades: total,
                wins,
                winRate: total > 0 ? (wins / total * 100).toFixed(2) : 0,
                pnl: strategyTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0)
            };
        }
        
        // Group by symbol
        const symbols = [...new Set(this.trades.map(t => t.symbol))];
        for (const symbol of symbols) {
            const symbolTrades = this.trades.filter(t => t.symbol === symbol && t.status === 'CLOSED');
            const wins = symbolTrades.filter(t => t.result === 'WIN').length;
            const total = symbolTrades.length;
            
            report.bySymbol[symbol] = {
                trades: total,
                wins,
                winRate: total > 0 ? (wins / total * 100).toFixed(2) : 0,
                pnl: symbolTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0)
            };
        }
        
        // Top wins and losses
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
        report.topWins = closedTrades
            .filter(t => t.netPnL > 0)
            .sort((a, b) => b.netPnL - a.netPnL)
            .slice(0, 5)
            .map(t => ({
                symbol: t.symbol,
                strategy: t.strategy,
                pnl: t.netPnL,
                date: t.timestamp
            }));
        
        report.topLosses = closedTrades
            .filter(t => t.netPnL < 0)
            .sort((a, b) => a.netPnL - b.netPnL)
            .slice(0, 5)
            .map(t => ({
                symbol: t.symbol,
                strategy: t.strategy,
                pnl: t.netPnL,
                date: t.timestamp
            }));
        
        // Generate recommendations
        if (this.statistics.winRate < 50) {
            report.recommendations.push('Win rate below 50% - Review entry criteria');
        }
        if (this.statistics.profitFactor < 1.5) {
            report.recommendations.push('Profit factor low - Consider improving risk/reward ratio');
        }
        if (this.statistics.maxDrawdown > 15) {
            report.recommendations.push('High drawdown detected - Reduce position sizes');
        }
        if (this.statistics.worstStreak > 5) {
            report.recommendations.push('Long losing streak - Review strategy effectiveness');
        }
        
        return report;
    }
    
    /**
     * Save journal to file
     */
    async saveJournal() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const journalFile = path.join(this.config.journalPath, `journal_${today}.json`);
            
            this.currentJournal = {
                date: today,
                trades: this.trades,
                statistics: this.statistics,
                lastUpdated: new Date().toISOString()
            };
            
            await fs.writeFile(journalFile, JSON.stringify(this.currentJournal, null, 2));
            
            logger.debug('JOURNAL', `Journal saved: ${this.trades.length} trades`);
            
        } catch (error) {
            logger.error('JOURNAL', 'Failed to save journal', error);
        }
    }
    
    /**
     * Export journal to CSV
     */
    async exportToCSV(filename = null) {
        const csvFilename = filename || `journal_export_${Date.now()}.csv`;
        const csvPath = path.join(this.config.journalPath, csvFilename);
        
        const headers = [
            'ID', 'Date', 'Symbol', 'Strategy', 'Direction', 'Quantity',
            'Entry Price', 'Exit Price', 'Net P&L', 'Result', 'Status',
            'VIX Level', 'Notes'
        ];
        
        let csv = headers.join(',') + '\n';
        
        for (const trade of this.trades) {
            const row = [
                trade.id,
                trade.timestamp,
                trade.symbol,
                trade.strategy,
                trade.direction,
                trade.quantity,
                trade.entryPrice,
                trade.exitPrice || '',
                trade.netPnL || 0,
                trade.result || '',
                trade.status,
                trade.vixLevel || '',
                `"${trade.notes || ''}"`
            ];
            
            csv += row.join(',') + '\n';
        }
        
        await fs.writeFile(csvPath, csv);
        
        logger.info('JOURNAL', `Journal exported to ${csvFilename}`);
        
        return csvPath;
    }
    
    /**
     * Add note to journal
     */
    async addNote(note) {
        if (!this.currentJournal.notes) {
            this.currentJournal.notes = [];
        }
        
        this.currentJournal.notes.push({
            timestamp: new Date().toISOString(),
            note
        });
        
        if (this.config.autoSave) {
            await this.saveJournal();
        }
    }
    
    /**
     * Get current statistics
     */
    getStatistics() {
        return { ...this.statistics };
    }
    
    /**
     * Get open trades
     */
    getOpenTrades() {
        return this.trades.filter(t => t.status === 'OPEN');
    }
    
    /**
     * Cleanup
     */
    async cleanup() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        await this.saveJournal();
    }
}

// Export
module.exports = { TradeJournal };

// Test if run directly
if (require.main === module) {
    const journal = new TradeJournal();
    
    // Test trade recording
    journal.recordTrade({
        symbol: 'SPY',
        strategy: 'FRIDAY_0DTE',
        direction: 'SHORT',
        quantity: 10,
        entryPrice: 450,
        optionType: 'PUT',
        strike: 445,
        expiration: '2025-09-05',
        delta: -0.25,
        vixLevel: 18,
        bpUsed: 2000,
        notes: 'Test trade'
    }).then(trade => {
        logger.info('SYSTEM', 'Trade recorded:', trade.id);
        
        // Simulate closing trade
        setTimeout(() => {
            journal.updateTrade(trade.id, {
                status: 'CLOSED',
                exitPrice: 448,
                exitTime: new Date().toISOString()
            }).then(() => {
                logger.info('SYSTEM', 'Trade closed');
                logger.info('SYSTEM', 'Statistics:', journal.getStatistics());
                
                // Generate report
                journal.generateReport().then(report => {
                    logger.info('SYSTEM', '\nPerformance Report:');
                    logger.info('SYSTEM', JSON.stringify(report, null, 2));
                });
            });
        }, 2000);
    });
}