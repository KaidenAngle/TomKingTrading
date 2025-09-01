/**
 * P&L Calculation Engine
 * Comprehensive P&L calculation and reporting for Tom King Trading Framework
 * Handles real-time, historical, and strategy-specific P&L calculations
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * P&L Calculator - Core calculation logic
 */
class PLCalculator {
    /**
     * Calculate position P&L
     */
    static calculatePositionPL(position) {
        const entryValue = position.entryPrice * position.quantity;
        const currentValue = position.currentPrice * position.quantity;
        const dollarPL = currentValue - entryValue;
        const percentPL = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        return {
            dollarPL: dollarPL - position.commission,
            percentPL,
            entryValue,
            currentValue,
            commission: position.commission,
            netPL: dollarPL - position.commission
        };
    }
    
    /**
     * Calculate portfolio-level P&L
     */
    static calculatePortfolioPL(positions) {
        let totalDollarPL = 0;
        let totalEntryValue = 0;
        let totalCurrentValue = 0;
        let totalCommission = 0;
        
        const positionPLs = positions.map(position => {
            const pl = this.calculatePositionPL(position);
            totalDollarPL += pl.dollarPL;
            totalEntryValue += pl.entryValue;
            totalCurrentValue += pl.currentValue;
            totalCommission += pl.commission;
            
            return {
                positionId: position.id,
                ticker: position.ticker,
                strategy: position.strategy,
                ...pl
            };
        });
        
        const portfolioPercentPL = totalEntryValue > 0 ? 
            ((totalCurrentValue - totalEntryValue) / totalEntryValue) * 100 : 0;
        
        return {
            totalDollarPL,
            portfolioPercentPL,
            totalEntryValue,
            totalCurrentValue,
            totalCommission,
            netPL: totalDollarPL - totalCommission,
            positionPLs,
            positionCount: positions.length
        };
    }
    
    /**
     * Calculate P&L by strategy
     */
    static calculatePLByStrategy(positions) {
        const strategyPL = {};
        
        positions.forEach(position => {
            const strategy = position.strategy;
            const pl = this.calculatePositionPL(position);
            
            if (!strategyPL[strategy]) {
                strategyPL[strategy] = {
                    strategy,
                    positionCount: 0,
                    totalDollarPL: 0,
                    totalEntryValue: 0,
                    totalCurrentValue: 0,
                    totalCommission: 0,
                    positions: []
                };
            }
            
            const stratData = strategyPL[strategy];
            stratData.positionCount++;
            stratData.totalDollarPL += pl.dollarPL;
            stratData.totalEntryValue += pl.entryValue;
            stratData.totalCurrentValue += pl.currentValue;
            stratData.totalCommission += pl.commission;
            stratData.positions.push({
                positionId: position.id,
                ticker: position.ticker,
                ...pl
            });
        });
        
        // Calculate percentages for each strategy
        Object.keys(strategyPL).forEach(strategy => {
            const data = strategyPL[strategy];
            data.percentPL = data.totalEntryValue > 0 ? 
                ((data.totalCurrentValue - data.totalEntryValue) / data.totalEntryValue) * 100 : 0;
            data.netPL = data.totalDollarPL - data.totalCommission;
            data.avgPLPerPosition = data.positionCount > 0 ? data.netPL / data.positionCount : 0;
        });
        
        return strategyPL;
    }
    
    /**
     * Calculate P&L by correlation group
     */
    static calculatePLByCorrelationGroup(positions) {
        const groupPL = {};
        
        positions.forEach(position => {
            const group = position.correlationGroup || 'UNCORRELATED';
            const pl = this.calculatePositionPL(position);
            
            if (!groupPL[group]) {
                groupPL[group] = {
                    group,
                    positionCount: 0,
                    totalDollarPL: 0,
                    totalEntryValue: 0,
                    totalCurrentValue: 0,
                    totalCommission: 0,
                    tickers: new Set()
                };
            }
            
            const groupData = groupPL[group];
            groupData.positionCount++;
            groupData.totalDollarPL += pl.dollarPL;
            groupData.totalEntryValue += pl.entryValue;
            groupData.totalCurrentValue += pl.currentValue;
            groupData.totalCommission += pl.commission;
            groupData.tickers.add(position.ticker);
        });
        
        // Calculate percentages and convert tickers set to array
        Object.keys(groupPL).forEach(group => {
            const data = groupPL[group];
            data.percentPL = data.totalEntryValue > 0 ? 
                ((data.totalCurrentValue - data.totalEntryValue) / data.totalEntryValue) * 100 : 0;
            data.netPL = data.totalDollarPL - data.totalCommission;
            data.tickers = Array.from(data.tickers);
        });
        
        return groupPL;
    }
}

/**
 * Historical P&L Tracker
 */
class HistoricalPLTracker {
    constructor() {
        this.dailyPL = new Map(); // Date -> P&L data
        this.weeklyPL = new Map();
        this.monthlyPL = new Map();
        this.yearlyPL = new Map();
        this.trades = []; // Completed trades
    }
    
    /**
     * Record end-of-day P&L snapshot
     */
    recordDailyPL(date, plData) {
        const dateKey = this.formatDate(date);
        this.dailyPL.set(dateKey, {
            date: dateKey,
            timestamp: new Date(date),
            ...plData
        });
        
        // Update weekly/monthly/yearly aggregations
        this.updateAggregations(date, plData);
    }
    
    /**
     * Record completed trade
     */
    recordCompletedTrade(trade) {
        const tradeRecord = {
            ...trade,
            completedAt: new Date(),
            yearMonth: this.getYearMonth(trade.exitDate || new Date()),
            weekOfYear: this.getWeekOfYear(trade.exitDate || new Date())
        };
        
        this.trades.push(tradeRecord);
        
        logger.info('PL_TRACKER', 
            `Trade completed: ${trade.ticker} ${trade.strategy} P&L: £${trade.realizedPL?.toFixed(2) || 'N/A'}`
        );
    }
    
    /**
     * Get daily P&L for date range
     */
    getDailyPL(startDate, endDate) {
        const start = this.formatDate(startDate);
        const end = this.formatDate(endDate);
        const result = [];
        
        for (const [dateKey, plData] of this.dailyPL) {
            if (dateKey >= start && dateKey <= end) {
                result.push(plData);
            }
        }
        
        return result.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    /**
     * Get weekly P&L summary
     */
    getWeeklyPL(year) {
        const weeks = [];
        for (const [weekKey, plData] of this.weeklyPL) {
            if (weekKey.startsWith(year.toString())) {
                weeks.push(plData);
            }
        }
        return weeks.sort((a, b) => a.week - b.week);
    }
    
    /**
     * Get monthly P&L summary
     */
    getMonthlyPL(year) {
        const months = [];
        for (const [monthKey, plData] of this.monthlyPL) {
            if (monthKey.startsWith(year.toString())) {
                months.push(plData);
            }
        }
        return months.sort((a, b) => a.month - b.month);
    }
    
    /**
     * Get yearly P&L summary
     */
    getYearlyPL() {
        return Array.from(this.yearlyPL.values()).sort((a, b) => a.year - b.year);
    }
    
    /**
     * Get trade statistics
     */
    getTradeStatistics(filters = {}) {
        let filteredTrades = this.trades;
        
        // Apply filters
        if (filters.strategy) {
            filteredTrades = filteredTrades.filter(trade => 
                trade.strategy === filters.strategy
            );
        }
        
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            filteredTrades = filteredTrades.filter(trade => {
                const tradeDate = new Date(trade.exitDate || trade.completedAt);
                return tradeDate >= start && tradeDate <= end;
            });
        }
        
        if (filteredTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                totalPL: 0
            };
        }
        
        const winners = filteredTrades.filter(trade => 
            (trade.realizedPL || 0) > 0
        );
        const losers = filteredTrades.filter(trade => 
            (trade.realizedPL || 0) < 0
        );
        
        const totalWinAmount = winners.reduce((sum, trade) => 
            sum + (trade.realizedPL || 0), 0
        );
        const totalLossAmount = Math.abs(losers.reduce((sum, trade) => 
            sum + (trade.realizedPL || 0), 0
        ));
        
        const avgWin = winners.length > 0 ? totalWinAmount / winners.length : 0;
        const avgLoss = losers.length > 0 ? totalLossAmount / losers.length : 0;
        
        return {
            totalTrades: filteredTrades.length,
            winners: winners.length,
            losers: losers.length,
            winRate: (winners.length / filteredTrades.length) * 100,
            avgWin,
            avgLoss,
            profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : Infinity,
            totalPL: filteredTrades.reduce((sum, trade) => sum + (trade.realizedPL || 0), 0),
            totalWinAmount,
            totalLossAmount,
            largestWin: Math.max(...filteredTrades.map(t => t.realizedPL || 0)),
            largestLoss: Math.min(...filteredTrades.map(t => t.realizedPL || 0))
        };
    }
    
    /**
     * Tom King specific statistics
     */
    getTomKingStats() {
        const stats = {
            fridayODTE: this.getTradeStatistics({ strategy: '0DTE' }),
            strangles: this.getTradeStatistics({ strategy: 'STRANGLE' }),
            lt112: this.getTradeStatistics({ strategy: 'LT112' }),
            overall: this.getTradeStatistics()
        };
        
        // Calculate monthly income progression
        const monthlyIncomes = this.getMonthlyIncomes();
        const currentMonthIncome = monthlyIncomes[monthlyIncomes.length - 1]?.income || 0;
        const targetMonthlyIncome = 10000; // £10k target
        
        stats.monthlyProgression = {
            currentMonthIncome,
            targetMonthlyIncome,
            progressPercent: (currentMonthIncome / targetMonthlyIncome) * 100,
            monthsToTarget: this.calculateMonthsToTarget(monthlyIncomes, targetMonthlyIncome),
            monthlyIncomes
        };
        
        return stats;
    }
    
    getMonthlyIncomes() {
        const incomes = [];
        for (const [monthKey, plData] of this.monthlyPL) {
            incomes.push({
                month: monthKey,
                income: plData.totalDollarPL || 0,
                trades: plData.tradeCount || 0
            });
        }
        return incomes.sort((a, b) => a.month.localeCompare(b.month));
    }
    
    calculateMonthsToTarget(monthlyIncomes, target) {
        if (monthlyIncomes.length < 2) return 'Insufficient data';
        
        // Calculate growth rate from last 3 months if available
        const recentMonths = monthlyIncomes.slice(-3);
        if (recentMonths.length < 2) return 'Insufficient data';
        
        const avgGrowthRate = this.calculateAverageGrowthRate(recentMonths);
        const currentIncome = monthlyIncomes[monthlyIncomes.length - 1].income;
        
        if (avgGrowthRate <= 0 || currentIncome <= 0) return 'Target not achievable at current rate';
        
        const months = Math.log(target / currentIncome) / Math.log(1 + avgGrowthRate);
        return Math.ceil(months);
    }
    
    calculateAverageGrowthRate(incomes) {
        let totalGrowthRate = 0;
        let periods = 0;
        
        for (let i = 1; i < incomes.length; i++) {
            const current = incomes[i].income;
            const previous = incomes[i - 1].income;
            
            if (previous > 0) {
                totalGrowthRate += (current - previous) / previous;
                periods++;
            }
        }
        
        return periods > 0 ? totalGrowthRate / periods : 0;
    }
    
    // Helper methods
    formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    }
    
    getYearMonth(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    
    getWeekOfYear(date) {
        const d = new Date(date);
        const start = new Date(d.getFullYear(), 0, 1);
        const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }
    
    updateAggregations(date, plData) {
        const dateObj = new Date(date);
        const yearMonth = this.getYearMonth(date);
        const yearWeek = `${dateObj.getFullYear()}-W${String(this.getWeekOfYear(date)).padStart(2, '0')}`;
        const year = dateObj.getFullYear();
        
        // Update weekly
        if (!this.weeklyPL.has(yearWeek)) {
            this.weeklyPL.set(yearWeek, {
                week: this.getWeekOfYear(date),
                year: dateObj.getFullYear(),
                totalDollarPL: 0,
                tradeCount: 0,
                days: []
            });
        }
        const weekData = this.weeklyPL.get(yearWeek);
        weekData.totalDollarPL += plData.totalDollarPL || 0;
        weekData.tradeCount += plData.tradeCount || 0;
        weekData.days.push(this.formatDate(date));
        
        // Update monthly
        if (!this.monthlyPL.has(yearMonth)) {
            this.monthlyPL.set(yearMonth, {
                month: dateObj.getMonth() + 1,
                year: dateObj.getFullYear(),
                totalDollarPL: 0,
                tradeCount: 0,
                days: []
            });
        }
        const monthData = this.monthlyPL.get(yearMonth);
        monthData.totalDollarPL += plData.totalDollarPL || 0;
        monthData.tradeCount += plData.tradeCount || 0;
        monthData.days.push(this.formatDate(date));
        
        // Update yearly
        if (!this.yearlyPL.has(year)) {
            this.yearlyPL.set(year, {
                year,
                totalDollarPL: 0,
                tradeCount: 0,
                months: []
            });
        }
        const yearData = this.yearlyPL.get(year);
        yearData.totalDollarPL += plData.totalDollarPL || 0;
        yearData.tradeCount += plData.tradeCount || 0;
        if (!yearData.months.includes(yearMonth)) {
            yearData.months.push(yearMonth);
        }
    }
}

/**
 * P&L Calculation Engine - Main engine
 */
class PLCalculationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            updateInterval: options.updateInterval || 60000, // 1 minute
            historicalRetention: options.historicalRetention || 365, // days
            autoCalculateHistorical: options.autoCalculateHistorical !== false,
            ...options
        };
        
        this.calculator = PLCalculator;
        this.historicalTracker = new HistoricalPLTracker();
        this.currentPL = null;
        this.lastUpdateTime = null;
        
        // Auto-calculation interval
        if (this.options.autoCalculateHistorical) {
            this.historicalInterval = setInterval(() => {
                this.recordDailySnapshot();
            }, 24 * 60 * 60 * 1000); // Daily
        }
        
        logger.info('PL_ENGINE', 'P&L Calculation Engine initialized');
    }
    
    /**
     * Calculate real-time P&L for positions
     */
    calculateRealTimePL(positions) {
        try {
            const portfolioPL = this.calculator.calculatePortfolioPL(positions);
            const strategyPL = this.calculator.calculatePLByStrategy(positions);
            const correlationPL = this.calculator.calculatePLByCorrelationGroup(positions);
            
            this.currentPL = {
                timestamp: new Date(),
                portfolio: portfolioPL,
                byStrategy: strategyPL,
                byCorrelationGroup: correlationPL
            };
            
            this.lastUpdateTime = new Date();
            
            this.emit('plCalculated', this.currentPL);
            
            return this.currentPL;
        } catch (error) {
            logger.error('PL_ENGINE', `Failed to calculate P&L: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get current P&L
     */
    getCurrentPL() {
        return this.currentPL;
    }
    
    /**
     * Record daily P&L snapshot
     */
    recordDailySnapshot(date = new Date(), positions = []) {
        if (positions.length > 0) {
            const plData = this.calculateRealTimePL(positions);
            this.historicalTracker.recordDailyPL(date, plData.portfolio);
        } else if (this.currentPL) {
            this.historicalTracker.recordDailyPL(date, this.currentPL.portfolio);
        }
        
        logger.info('PL_ENGINE', `Daily P&L snapshot recorded for ${this.formatDate(date)}`);
    }
    
    /**
     * Record completed trade
     */
    recordCompletedTrade(trade) {
        this.historicalTracker.recordCompletedTrade(trade);
        this.emit('tradeCompleted', trade);
    }
    
    /**
     * Get historical P&L data
     */
    getHistoricalPL(type, startDate, endDate) {
        switch (type.toLowerCase()) {
            case 'daily':
                return this.historicalTracker.getDailyPL(startDate, endDate);
            case 'weekly':
                return this.historicalTracker.getWeeklyPL(new Date(startDate).getFullYear());
            case 'monthly':
                return this.historicalTracker.getMonthlyPL(new Date(startDate).getFullYear());
            case 'yearly':
                return this.historicalTracker.getYearlyPL();
            default:
                throw new Error(`Unknown P&L type: ${type}`);
        }
    }
    
    /**
     * Get trade statistics
     */
    getTradeStatistics(filters = {}) {
        return this.historicalTracker.getTradeStatistics(filters);
    }
    
    /**
     * Get Tom King specific performance metrics
     */
    getTomKingPerformance() {
        return this.historicalTracker.getTomKingStats();
    }
    
    /**
     * Generate comprehensive P&L report
     */
    generatePLReport(options = {}) {
        const includeHistorical = options.includeHistorical !== false;
        const includeTomKingMetrics = options.includeTomKingMetrics !== false;
        
        const report = {
            timestamp: new Date().toISOString(),
            current: this.currentPL,
            lastUpdateTime: this.lastUpdateTime?.toISOString()
        };
        
        if (includeHistorical) {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            report.historical = {
                daily30Days: this.getHistoricalPL('daily', thirtyDaysAgo, now),
                monthly: this.getHistoricalPL('monthly', new Date(now.getFullYear(), 0, 1), now),
                yearly: this.getHistoricalPL('yearly')
            };
        }
        
        if (includeTomKingMetrics) {
            report.tomKingMetrics = this.getTomKingPerformance();
        }
        
        // Overall statistics
        report.statistics = {
            overall: this.getTradeStatistics(),
            byStrategy: {
                '0DTE': this.getTradeStatistics({ strategy: '0DTE' }),
                'STRANGLE': this.getTradeStatistics({ strategy: 'STRANGLE' }),
                'LT112': this.getTradeStatistics({ strategy: 'LT112' }),
                'IPMCC': this.getTradeStatistics({ strategy: 'IPMCC' })
            }
        };
        
        return report;
    }
    
    // Helper methods
    formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.historicalInterval) {
            clearInterval(this.historicalInterval);
        }
        
        this.removeAllListeners();
        
        logger.info('PL_ENGINE', 'P&L Calculation Engine destroyed');
    }
}

module.exports = {
    PLCalculator,
    HistoricalPLTracker,
    PLCalculationEngine
};