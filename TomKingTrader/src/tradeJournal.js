/**
 * Trade Journal Module
 * Comprehensive trade logging, analysis, and export functionality
 * For Tom King Trading Framework
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

const logger = getLogger();

/**
 * Trade Entry - Represents a single trade record
 */
class TradeEntry {
    constructor(data) {
        this.id = data.id || this.generateId();
        this.timestamp = new Date(data.timestamp || Date.now());
        
        // Basic trade information
        this.ticker = data.ticker;
        this.strategy = data.strategy;
        this.type = data.type; // 'ENTRY', 'EXIT', 'ADJUSTMENT'
        this.action = data.action; // 'BUY', 'SELL', 'ROLL', 'CLOSE'
        this.quantity = data.quantity;
        this.price = data.price;
        this.strike = data.strike;
        this.expiration = data.expiration ? new Date(data.expiration) : null;
        this.optionType = data.optionType; // 'CALL', 'PUT'
        
        // Trade context
        this.marketConditions = data.marketConditions || {};
        this.vixAtEntry = data.vixAtEntry;
        this.underlyingPrice = data.underlyingPrice;
        this.ivAtEntry = data.ivAtEntry;
        this.deltaAtEntry = data.deltaAtEntry;
        this.phase = data.phase; // Account phase (1-4)
        this.correlationGroup = data.correlationGroup;
        
        // Entry reasoning
        this.entryReason = data.entryReason;
        this.patternRecognized = data.patternRecognized;
        this.riskAssessment = data.riskAssessment;
        this.expectedOutcome = data.expectedOutcome;
        this.stopLoss = data.stopLoss;
        this.profitTarget = data.profitTarget;
        
        // Exit information (filled when trade is closed)
        this.exitTimestamp = data.exitTimestamp ? new Date(data.exitTimestamp) : null;
        this.exitPrice = data.exitPrice;
        this.exitReason = data.exitReason;
        this.actualOutcome = data.actualOutcome;
        this.lessonsLearned = data.lessonsLearned;
        
        // P&L tracking
        this.commission = data.commission || 0;
        this.realizedPL = data.realizedPL || 0;
        this.maxUnrealizedPL = data.maxUnrealizedPL || 0;
        this.minUnrealizedPL = data.minUnrealizedPL || 0;
        
        // Trade duration
        this.daysHeld = data.daysHeld || null;
        this.isActive = data.isActive !== false; // Default to true for new trades
        
        // Tom King specific tracking
        this.entryWeek = data.entryWeek; // For LT112
        this.fridayODTE = data.fridayODTE || false; // Track Friday 0DTE trades
        this.testedSide = data.testedSide; // For strangles/condors
        this.rolledTimes = data.rolledTimes || 0;
        this.defensesTaken = data.defensesTaken || [];
        
        // Metadata
        this.tags = data.tags || [];
        this.notes = data.notes || '';
        this.screenshots = data.screenshots || [];
        this.attachments = data.attachments || [];
    }
    
    generateId() {
        return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Close the trade and calculate final metrics
     */
    close(exitData) {
        this.isActive = false;
        this.exitTimestamp = new Date(exitData.exitTimestamp || Date.now());
        this.exitPrice = exitData.exitPrice;
        this.exitReason = exitData.exitReason;
        this.actualOutcome = exitData.actualOutcome;
        this.lessonsLearned = exitData.lessonsLearned;
        this.realizedPL = exitData.realizedPL || 0;
        this.commission += exitData.commission || 0;
        
        // Calculate days held
        if (this.exitTimestamp && this.timestamp) {
            this.daysHeld = Math.ceil((this.exitTimestamp - this.timestamp) / (1000 * 60 * 60 * 24));
        }
        
        logger.info('TRADE_JOURNAL', 
            `Trade closed: ${this.ticker} ${this.strategy} - P&L: £${this.realizedPL.toFixed(2)} (${this.daysHeld} days)`
        );
    }
    
    /**
     * Add a defense action to the trade
     */
    addDefense(defenseData) {
        const defense = {
            timestamp: new Date(),
            action: defenseData.action,
            reason: defenseData.reason,
            price: defenseData.price,
            description: defenseData.description,
            ...defenseData
        };
        
        this.defensesTaken.push(defense);
        this.rolledTimes += (defense.action === 'ROLL' ? 1 : 0);
        
        logger.info('TRADE_JOURNAL', 
            `Defense added to ${this.ticker}: ${defense.action} - ${defense.reason}`
        );
    }
    
    /**
     * Add a tag to the trade
     */
    addTag(tag) {
        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
        }
    }
    
    /**
     * Add a note to the trade
     */
    addNote(note) {
        const timestamp = new Date().toISOString();
        this.notes += `\n[${timestamp}] ${note}`;
    }
    
    /**
     * Get trade performance metrics
     */
    getPerformanceMetrics() {
        const entryValue = Math.abs(this.price * this.quantity);
        const percentPL = entryValue > 0 ? (this.realizedPL / entryValue) * 100 : 0;
        
        return {
            dollarPL: this.realizedPL,
            percentPL,
            commission: this.commission,
            netPL: this.realizedPL - this.commission,
            daysHeld: this.daysHeld,
            dailyPL: this.daysHeld > 0 ? this.realizedPL / this.daysHeld : 0,
            maxDrawdown: this.minUnrealizedPL,
            maxUnrealized: this.maxUnrealizedPL,
            isWinner: this.realizedPL > 0,
            rolledTimes: this.rolledTimes,
            defenseCount: this.defensesTaken.length
        };
    }
    
    /**
     * Convert to exportable format
     */
    toExportFormat() {
        const metrics = this.getPerformanceMetrics();
        
        return {
            // Basic Info
            'Trade ID': this.id,
            'Entry Date': this.timestamp.toISOString().split('T')[0],
            'Exit Date': this.exitTimestamp ? this.exitTimestamp.toISOString().split('T')[0] : 'ACTIVE',
            'Ticker': this.ticker,
            'Strategy': this.strategy,
            'Type': this.type,
            'Action': this.action,
            'Quantity': this.quantity,
            
            // Prices
            'Entry Price': this.price,
            'Exit Price': this.exitPrice || 'N/A',
            'Strike': this.strike || 'N/A',
            'Option Type': this.optionType || 'N/A',
            'Expiration': this.expiration ? this.expiration.toISOString().split('T')[0] : 'N/A',
            
            // Market Conditions
            'VIX at Entry': this.vixAtEntry,
            'Underlying Price': this.underlyingPrice,
            'IV at Entry': this.ivAtEntry,
            'Delta at Entry': this.deltaAtEntry,
            'Phase': this.phase,
            'Correlation Group': this.correlationGroup,
            
            // Performance
            'Realized P&L': this.realizedPL,
            'Percent P&L': metrics.percentPL.toFixed(2) + '%',
            'Commission': this.commission,
            'Net P&L': metrics.netPL,
            'Days Held': this.daysHeld || 'N/A',
            'Daily P&L': metrics.dailyPL.toFixed(2),
            'Max Unrealized': this.maxUnrealizedPL,
            'Min Unrealized': this.minUnrealizedPL,
            
            // Strategy Specific
            'Entry Week': this.entryWeek || 'N/A',
            'Friday 0DTE': this.fridayODTE ? 'YES' : 'NO',
            'Tested Side': this.testedSide || 'NONE',
            'Rolled Times': this.rolledTimes,
            'Defense Count': this.defensesTaken.length,
            
            // Analysis
            'Entry Reason': this.entryReason,
            'Exit Reason': this.exitReason || 'N/A',
            'Pattern': this.patternRecognized,
            'Expected Outcome': this.expectedOutcome,
            'Actual Outcome': this.actualOutcome || 'N/A',
            'Lessons Learned': this.lessonsLearned || 'N/A',
            'Tags': this.tags.join(', '),
            'Notes': this.notes.replace(/\n/g, ' | ')
        };
    }
    
    toJSON() {
        return {
            id: this.id,
            timestamp: this.timestamp.toISOString(),
            ticker: this.ticker,
            strategy: this.strategy,
            type: this.type,
            action: this.action,
            quantity: this.quantity,
            price: this.price,
            strike: this.strike,
            expiration: this.expiration?.toISOString(),
            optionType: this.optionType,
            marketConditions: this.marketConditions,
            vixAtEntry: this.vixAtEntry,
            underlyingPrice: this.underlyingPrice,
            ivAtEntry: this.ivAtEntry,
            deltaAtEntry: this.deltaAtEntry,
            phase: this.phase,
            correlationGroup: this.correlationGroup,
            entryReason: this.entryReason,
            patternRecognized: this.patternRecognized,
            riskAssessment: this.riskAssessment,
            expectedOutcome: this.expectedOutcome,
            stopLoss: this.stopLoss,
            profitTarget: this.profitTarget,
            exitTimestamp: this.exitTimestamp?.toISOString(),
            exitPrice: this.exitPrice,
            exitReason: this.exitReason,
            actualOutcome: this.actualOutcome,
            lessonsLearned: this.lessonsLearned,
            commission: this.commission,
            realizedPL: this.realizedPL,
            maxUnrealizedPL: this.maxUnrealizedPL,
            minUnrealizedPL: this.minUnrealizedPL,
            daysHeld: this.daysHeld,
            isActive: this.isActive,
            entryWeek: this.entryWeek,
            fridayODTE: this.fridayODTE,
            testedSide: this.testedSide,
            rolledTimes: this.rolledTimes,
            defensesTaken: this.defensesTaken,
            tags: this.tags,
            notes: this.notes,
            screenshots: this.screenshots,
            attachments: this.attachments,
            performanceMetrics: this.getPerformanceMetrics()
        };
    }
}

/**
 * Trade Analytics Engine
 */
class TradeAnalytics {
    /**
     * Analyze trading performance by various dimensions
     */
    static analyzePerformance(trades, filters = {}) {
        let filteredTrades = trades.filter(trade => !trade.isActive);
        
        // Apply filters
        if (filters.strategy) {
            filteredTrades = filteredTrades.filter(t => t.strategy === filters.strategy);
        }
        
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            filteredTrades = filteredTrades.filter(t => {
                const tradeDate = new Date(t.exitTimestamp || t.timestamp);
                return tradeDate >= start && tradeDate <= end;
            });
        }
        
        if (filters.phase) {
            filteredTrades = filteredTrades.filter(t => t.phase === filters.phase);
        }
        
        if (filteredTrades.length === 0) {
            return this.getEmptyAnalysis();
        }
        
        // Basic metrics
        const totalTrades = filteredTrades.length;
        const winners = filteredTrades.filter(t => t.realizedPL > 0);
        const losers = filteredTrades.filter(t => t.realizedPL < 0);
        const breakevens = filteredTrades.filter(t => t.realizedPL === 0);
        
        const totalPL = filteredTrades.reduce((sum, t) => sum + t.realizedPL, 0);
        const totalCommission = filteredTrades.reduce((sum, t) => sum + t.commission, 0);
        const netPL = totalPL - totalCommission;
        
        const winAmount = winners.reduce((sum, t) => sum + t.realizedPL, 0);
        const lossAmount = Math.abs(losers.reduce((sum, t) => sum + t.realizedPL, 0));
        
        const avgWin = winners.length > 0 ? winAmount / winners.length : 0;
        const avgLoss = losers.length > 0 ? lossAmount / losers.length : 0;
        
        const avgDaysHeld = filteredTrades.reduce((sum, t) => sum + (t.daysHeld || 0), 0) / totalTrades;
        
        // Advanced metrics
        const profitFactor = lossAmount > 0 ? winAmount / lossAmount : Infinity;
        const expectancy = (winners.length / totalTrades * avgWin) - (losers.length / totalTrades * avgLoss);
        
        // Consecutive wins/losses
        const streaks = this.calculateStreaks(filteredTrades);
        
        // Time-based analysis
        const monthlyBreakdown = this.analyzeMonthlyPerformance(filteredTrades);
        
        // Strategy-specific metrics
        const strategyMetrics = this.analyzeByStrategy(filteredTrades);
        
        // Tom King specific metrics
        const tomKingMetrics = this.analyzeTomKingSpecific(filteredTrades);
        
        return {
            summary: {
                totalTrades,
                winners: winners.length,
                losers: losers.length,
                breakevens: breakevens.length,
                winRate: (winners.length / totalTrades) * 100,
                totalPL,
                totalCommission,
                netPL,
                avgWin,
                avgLoss,
                avgDaysHeld,
                profitFactor,
                expectancy,
                largestWin: Math.max(...filteredTrades.map(t => t.realizedPL)),
                largestLoss: Math.min(...filteredTrades.map(t => t.realizedPL))
            },
            streaks,
            monthlyBreakdown,
            strategyMetrics,
            tomKingMetrics,
            trades: filteredTrades.map(t => t.toJSON())
        };
    }
    
    static getEmptyAnalysis() {
        return {
            summary: {
                totalTrades: 0,
                winners: 0,
                losers: 0,
                breakevens: 0,
                winRate: 0,
                totalPL: 0,
                totalCommission: 0,
                netPL: 0,
                avgWin: 0,
                avgLoss: 0,
                avgDaysHeld: 0,
                profitFactor: 0,
                expectancy: 0,
                largestWin: 0,
                largestLoss: 0
            },
            streaks: { currentWinStreak: 0, maxWinStreak: 0, currentLossStreak: 0, maxLossStreak: 0 },
            monthlyBreakdown: [],
            strategyMetrics: {},
            tomKingMetrics: {},
            trades: []
        };
    }
    
    static calculateStreaks(trades) {
        let currentWinStreak = 0;
        let maxWinStreak = 0;
        let currentLossStreak = 0;
        let maxLossStreak = 0;
        
        // Sort by exit date
        const sortedTrades = trades.sort((a, b) => 
            new Date(a.exitTimestamp || a.timestamp) - new Date(b.exitTimestamp || b.timestamp)
        );
        
        for (const trade of sortedTrades) {
            if (trade.realizedPL > 0) {
                currentWinStreak++;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
                currentLossStreak = 0;
            } else if (trade.realizedPL < 0) {
                currentLossStreak++;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
                currentWinStreak = 0;
            }
        }
        
        return {
            currentWinStreak,
            maxWinStreak,
            currentLossStreak,
            maxLossStreak
        };
    }
    
    static analyzeMonthlyPerformance(trades) {
        const monthlyData = {};
        
        trades.forEach(trade => {
            const exitDate = new Date(trade.exitTimestamp || trade.timestamp);
            const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    month: monthKey,
                    trades: 0,
                    winners: 0,
                    totalPL: 0,
                    commission: 0
                };
            }
            
            const data = monthlyData[monthKey];
            data.trades++;
            data.totalPL += trade.realizedPL;
            data.commission += trade.commission;
            if (trade.realizedPL > 0) data.winners++;
        });
        
        return Object.values(monthlyData).map(data => ({
            ...data,
            winRate: data.trades > 0 ? (data.winners / data.trades) * 100 : 0,
            netPL: data.totalPL - data.commission
        })).sort((a, b) => a.month.localeCompare(b.month));
    }
    
    static analyzeByStrategy(trades) {
        const strategies = {};
        
        trades.forEach(trade => {
            const strategy = trade.strategy;
            if (!strategies[strategy]) {
                strategies[strategy] = {
                    strategy,
                    trades: [],
                    totalTrades: 0,
                    winners: 0,
                    totalPL: 0,
                    commission: 0
                };
            }
            
            const data = strategies[strategy];
            data.trades.push(trade);
            data.totalTrades++;
            data.totalPL += trade.realizedPL;
            data.commission += trade.commission;
            if (trade.realizedPL > 0) data.winners++;
        });
        
        // Calculate additional metrics for each strategy
        Object.keys(strategies).forEach(strategy => {
            const data = strategies[strategy];
            data.winRate = data.totalTrades > 0 ? (data.winners / data.totalTrades) * 100 : 0;
            data.netPL = data.totalPL - data.commission;
            data.avgPL = data.totalTrades > 0 ? data.netPL / data.totalTrades : 0;
            data.avgDaysHeld = data.totalTrades > 0 ? 
                data.trades.reduce((sum, t) => sum + (t.daysHeld || 0), 0) / data.totalTrades : 0;
        });
        
        return strategies;
    }
    
    static analyzeTomKingSpecific(trades) {
        const fridayODTEs = trades.filter(t => t.fridayODTE);
        const strangles = trades.filter(t => t.strategy === 'STRANGLE');
        const lt112s = trades.filter(t => t.strategy === 'LT112');
        
        const metrics = {
            fridayODTE: this.getStrategyMetrics(fridayODTEs),
            strangles: this.getStrategyMetrics(strangles),
            lt112: this.getStrategyMetrics(lt112s),
            defensiveActions: this.analyzeDefensiveActions(trades),
            rollAnalysis: this.analyzeRolls(trades),
            phaseProgression: this.analyzePhaseProgression(trades)
        };
        
        // Friday 0DTE specific - track the 92% win rate target
        if (fridayODTEs.length > 0) {
            metrics.fridayODTE.targetWinRate = 92;
            metrics.fridayODTE.vsTarget = metrics.fridayODTE.winRate - 92;
        }
        
        return metrics;
    }
    
    static getStrategyMetrics(trades) {
        if (trades.length === 0) {
            return { trades: 0, winRate: 0, totalPL: 0, avgPL: 0 };
        }
        
        const winners = trades.filter(t => t.realizedPL > 0).length;
        const totalPL = trades.reduce((sum, t) => sum + t.realizedPL, 0);
        
        return {
            trades: trades.length,
            winners,
            winRate: (winners / trades.length) * 100,
            totalPL,
            avgPL: totalPL / trades.length,
            avgDaysHeld: trades.reduce((sum, t) => sum + (t.daysHeld || 0), 0) / trades.length
        };
    }
    
    static analyzeDefensiveActions(trades) {
        const tradesWithDefenses = trades.filter(t => t.defensesTaken.length > 0);
        const totalDefenses = trades.reduce((sum, t) => sum + t.defensesTaken.length, 0);
        
        const defenseTypes = {};
        trades.forEach(trade => {
            trade.defensesTaken.forEach(defense => {
                defenseTypes[defense.action] = (defenseTypes[defense.action] || 0) + 1;
            });
        });
        
        return {
            tradesWithDefenses: tradesWithDefenses.length,
            totalDefenses,
            avgDefensesPerTrade: trades.length > 0 ? totalDefenses / trades.length : 0,
            defenseTypes,
            defenseSuccessRate: tradesWithDefenses.length > 0 ? 
                (tradesWithDefenses.filter(t => t.realizedPL > 0).length / tradesWithDefenses.length) * 100 : 0
        };
    }
    
    static analyzeRolls(trades) {
        const rolledTrades = trades.filter(t => t.rolledTimes > 0);
        const totalRolls = trades.reduce((sum, t) => sum + t.rolledTimes, 0);
        
        return {
            tradesRolled: rolledTrades.length,
            totalRolls,
            avgRollsPerTrade: trades.length > 0 ? totalRolls / trades.length : 0,
            rollSuccessRate: rolledTrades.length > 0 ? 
                (rolledTrades.filter(t => t.realizedPL > 0).length / rolledTrades.length) * 100 : 0
        };
    }
    
    static analyzePhaseProgression(trades) {
        const phases = { 1: [], 2: [], 3: [], 4: [] };
        
        trades.forEach(trade => {
            if (trade.phase && phases[trade.phase]) {
                phases[trade.phase].push(trade);
            }
        });
        
        const progression = {};
        Object.keys(phases).forEach(phase => {
            const phaseTrades = phases[phase];
            progression[`phase${phase}`] = this.getStrategyMetrics(phaseTrades);
        });
        
        return progression;
    }
}

/**
 * Trade Journal - Main journal class
 */
class TradeJournal extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            autoSave: options.autoSave !== false,
            saveInterval: options.saveInterval || 300000, // 5 minutes
            exportDir: options.exportDir || './exports',
            maxTrades: options.maxTrades || 10000,
            ...options
        };
        
        this.trades = new Map();
        this.activeTrades = new Map();
        this.saveInterval = null;
        
        if (this.options.autoSave) {
            this.startAutoSave();
        }
        
        logger.info('TRADE_JOURNAL', 'Trade journal initialized');
    }
    
    /**
     * Log a new trade entry
     */
    logTrade(tradeData) {
        try {
            const trade = new TradeEntry(tradeData);
            this.trades.set(trade.id, trade);
            
            if (trade.isActive) {
                this.activeTrades.set(trade.id, trade);
            }
            
            // Add automatic tags based on trade characteristics
            this.addAutoTags(trade);
            
            logger.info('TRADE_JOURNAL', 
                `Logged ${trade.type}: ${trade.ticker} ${trade.strategy} - ${trade.action}`
            );
            
            this.emit('tradeLogged', trade.toJSON());
            
            return trade.id;
        } catch (error) {
            logger.error('TRADE_JOURNAL', `Failed to log trade: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Close a trade
     */
    closeTrade(tradeId, exitData) {
        const trade = this.trades.get(tradeId);
        if (!trade) {
            throw new Error(`Trade ${tradeId} not found`);
        }
        
        trade.close(exitData);
        this.activeTrades.delete(tradeId);
        
        // Add outcome-based tags
        this.addOutcomeTags(trade);
        
        this.emit('tradeClosed', trade.toJSON());
        
        return trade.toJSON();
    }
    
    /**
     * Add a defense to a trade
     */
    addDefense(tradeId, defenseData) {
        const trade = this.trades.get(tradeId);
        if (!trade) {
            throw new Error(`Trade ${tradeId} not found`);
        }
        
        trade.addDefense(defenseData);
        this.emit('defenseAdded', { tradeId, defense: defenseData });
        
        return trade.toJSON();
    }
    
    /**
     * Add automatic tags based on trade characteristics
     */
    addAutoTags(trade) {
        // Strategy-based tags
        if (trade.fridayODTE) {
            trade.addTag('FRIDAY_0DTE');
        }
        
        if (trade.strategy === 'LT112' && trade.entryWeek > 2) {
            trade.addTag('LATE_ENTRY');
        }
        
        // VIX-based tags
        if (trade.vixAtEntry) {
            if (trade.vixAtEntry < 15) trade.addTag('LOW_VIX');
            else if (trade.vixAtEntry > 25) trade.addTag('HIGH_VIX');
            else if (trade.vixAtEntry > 35) trade.addTag('EXTREME_VIX');
        }
        
        // Phase-based tags
        if (trade.phase) {
            trade.addTag(`PHASE_${trade.phase}`);
        }
        
        // Pattern-based tags
        if (trade.patternRecognized) {
            trade.addTag(`PATTERN_${trade.patternRecognized.toUpperCase()}`);
        }
    }
    
    /**
     * Add outcome-based tags after trade closure
     */
    addOutcomeTags(trade) {
        const metrics = trade.getPerformanceMetrics();
        
        // P&L-based tags
        if (metrics.percentPL >= 50) {
            trade.addTag('BIG_WINNER');
        } else if (metrics.percentPL >= 25) {
            trade.addTag('GOOD_WINNER');
        } else if (metrics.percentPL <= -50) {
            trade.addTag('BIG_LOSER');
        }
        
        // Duration-based tags
        if (trade.daysHeld <= 1) {
            trade.addTag('DAY_TRADE');
        } else if (trade.daysHeld <= 7) {
            trade.addTag('WEEK_TRADE');
        } else if (trade.daysHeld >= 30) {
            trade.addTag('LONG_HOLD');
        }
        
        // Defense-based tags
        if (metrics.defenseCount > 0) {
            trade.addTag('DEFENDED');
        }
        
        if (metrics.rolledTimes > 0) {
            trade.addTag('ROLLED');
        }
    }
    
    /**
     * Get all trades
     */
    getAllTrades() {
        return Array.from(this.trades.values()).map(t => t.toJSON());
    }
    
    /**
     * Get active trades
     */
    getActiveTrades() {
        return Array.from(this.activeTrades.values()).map(t => t.toJSON());
    }
    
    /**
     * Get closed trades
     */
    getClosedTrades() {
        return Array.from(this.trades.values())
            .filter(t => !t.isActive)
            .map(t => t.toJSON());
    }
    
    /**
     * Search trades
     */
    searchTrades(filters = {}) {
        let filteredTrades = Array.from(this.trades.values());
        
        if (filters.strategy) {
            filteredTrades = filteredTrades.filter(t => 
                t.strategy.toLowerCase() === filters.strategy.toLowerCase()
            );
        }
        
        if (filters.ticker) {
            filteredTrades = filteredTrades.filter(t => 
                t.ticker.toLowerCase().includes(filters.ticker.toLowerCase())
            );
        }
        
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            filteredTrades = filteredTrades.filter(t => {
                const tradeDate = new Date(t.timestamp);
                return tradeDate >= start && tradeDate <= end;
            });
        }
        
        if (filters.tags && filters.tags.length > 0) {
            filteredTrades = filteredTrades.filter(t => 
                filters.tags.some(tag => t.tags.includes(tag))
            );
        }
        
        if (filters.isActive !== undefined) {
            filteredTrades = filteredTrades.filter(t => t.isActive === filters.isActive);
        }
        
        return filteredTrades.map(t => t.toJSON());
    }
    
    /**
     * Get trade analytics
     */
    getAnalytics(filters = {}) {
        const trades = Array.from(this.trades.values());
        return TradeAnalytics.analyzePerformance(trades, filters);
    }
    
    /**
     * Export trades to CSV
     */
    async exportToCSV(filters = {}, filename = null) {
        try {
            const trades = this.searchTrades(filters);
            if (trades.length === 0) {
                throw new Error('No trades to export');
            }
            
            // Convert to export format
            const exportData = trades.map(trade => {
                const tradeEntry = new TradeEntry(trade);
                return tradeEntry.toExportFormat();
            });
            
            // Generate CSV content
            const headers = Object.keys(exportData[0]);
            let csv = headers.join(',') + '\n';
            
            exportData.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                });
                csv += values.join(',') + '\n';
            });
            
            // Save to file
            const exportDir = this.options.exportDir;
            await fs.mkdir(exportDir, { recursive: true });
            
            const exportFilename = filename || 
                `trades_export_${new Date().toISOString().split('T')[0]}.csv`;
            const filePath = path.join(exportDir, exportFilename);
            
            await fs.writeFile(filePath, csv, 'utf8');
            
            logger.info('TRADE_JOURNAL', `Exported ${trades.length} trades to ${filePath}`);
            
            this.emit('tradesExported', { 
                filename: exportFilename, 
                filePath, 
                tradeCount: trades.length 
            });
            
            return filePath;
            
        } catch (error) {
            logger.error('TRADE_JOURNAL', `Export failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Export analytics report
     */
    async exportAnalyticsReport(filters = {}, filename = null) {
        try {
            const analytics = this.getAnalytics(filters);
            
            const exportFilename = filename || 
                `analytics_report_${new Date().toISOString().split('T')[0]}.json`;
            const filePath = path.join(this.options.exportDir, exportFilename);
            
            await fs.mkdir(this.options.exportDir, { recursive: true });
            await fs.writeFile(filePath, JSON.stringify(analytics, null, 2), 'utf8');
            
            logger.info('TRADE_JOURNAL', `Analytics report exported to ${filePath}`);
            
            this.emit('analyticsExported', { filename: exportFilename, filePath });
            
            return filePath;
            
        } catch (error) {
            logger.error('TRADE_JOURNAL', `Analytics export failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Generate lessons learned report
     */
    generateLessonsReport() {
        const closedTrades = this.getClosedTrades();
        const lessons = {};
        
        closedTrades.forEach(trade => {
            if (trade.lessonsLearned) {
                const key = `${trade.strategy}_${trade.realizedPL > 0 ? 'WIN' : 'LOSS'}`;
                if (!lessons[key]) {
                    lessons[key] = [];
                }
                lessons[key].push({
                    ticker: trade.ticker,
                    date: trade.exitTimestamp,
                    pl: trade.realizedPL,
                    lesson: trade.lessonsLearned
                });
            }
        });
        
        return lessons;
    }
    
    /**
     * Start auto-save functionality
     */
    startAutoSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        this.saveInterval = setInterval(() => {
            this.saveTrades();
        }, this.options.saveInterval);
    }
    
    /**
     * Save trades to storage
     */
    async saveTrades() {
        try {
            const data = {
                trades: this.getAllTrades(),
                timestamp: new Date().toISOString(),
                version: '1.0'
            };
            
            // Emit save event (implement actual storage in your system)
            this.emit('tradesSaved', data);
            
            logger.debug('TRADE_JOURNAL', `Saved ${this.trades.size} trades`);
        } catch (error) {
            logger.error('TRADE_JOURNAL', `Save failed: ${error.message}`);
        }
    }
    
    /**
     * Load trades from storage
     */
    loadTrades(data) {
        try {
            this.trades.clear();
            this.activeTrades.clear();
            
            if (data.trades) {
                data.trades.forEach(tradeData => {
                    const trade = new TradeEntry(tradeData);
                    this.trades.set(trade.id, trade);
                    
                    if (trade.isActive) {
                        this.activeTrades.set(trade.id, trade);
                    }
                });
            }
            
            logger.info('TRADE_JOURNAL', 
                `Loaded ${this.trades.size} trades (${this.activeTrades.size} active)`
            );
            
            this.emit('tradesLoaded', this.getAllTrades());
        } catch (error) {
            logger.error('TRADE_JOURNAL', `Load failed: ${error.message}`);
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
        
        this.trades.clear();
        this.activeTrades.clear();
        this.removeAllListeners();
        
        logger.info('TRADE_JOURNAL', 'Trade journal destroyed');
    }
}

module.exports = {
    TradeEntry,
    TradeAnalytics,
    TradeJournal
};