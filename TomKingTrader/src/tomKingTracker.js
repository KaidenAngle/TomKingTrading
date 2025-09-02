/**
 * Tom King Specific Tracker
 * Specialized tracking for Tom King Trading Framework features
 * 0DTE performance, BP usage, phase progression, and goal tracking
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Friday 0DTE Tracker
 * Specialized tracking for Friday 0DTE strategy performance
 */
class Friday0DTETracker {
    constructor() {
        this.fridayTrades = [];
        this.targetWinRate = 92; // Tom King's documented 92% win rate
        this.streakData = {
            currentWinStreak: 0,
            longestWinStreak: 0,
            currentLossStreak: 0,
            lastLoss: null
        };
    }
    
    /**
     * Add a Friday 0DTE trade
     */
    addFridayTrade(trade) {
        if (!this.isFriday(trade.timestamp)) {
            throw new Error('Trade must be on a Friday for Friday 0DTE tracking');
        }
        
        const fridayTrade = {
            ...trade,
            week: this.getWeekOfYear(trade.timestamp),
            year: new Date(trade.timestamp).getFullYear(),
            sessionNumber: this.fridayTrades.length + 1
        };
        
        this.fridayTrades.push(fridayTrade);
        this.updateStreaks(fridayTrade);
        
        logger.info('FRIDAY_0DTE_TRACKER', 
            `Friday session #${fridayTrade.sessionNumber}: ${trade.ticker} - ${trade.isWinner ? 'WIN' : 'LOSS'}`
        );
        
        return this.getPerformanceSummary();
    }
    
    /**
     * Update win/loss streaks
     */
    updateStreaks(trade) {
        if (trade.isWinner) {
            this.streakData.currentWinStreak++;
            this.streakData.currentLossStreak = 0;
            this.streakData.longestWinStreak = Math.max(
                this.streakData.longestWinStreak, 
                this.streakData.currentWinStreak
            );
        } else {
            this.streakData.currentLossStreak++;
            this.streakData.currentWinStreak = 0;
            this.streakData.lastLoss = {
                date: trade.timestamp,
                ticker: trade.ticker,
                reason: trade.exitReason,
                pl: trade.realizedPL
            };
        }
    }
    
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        const totalTrades = this.fridayTrades.length;
        if (totalTrades === 0) {
            return this.getEmptySummary();
        }
        
        const winners = this.fridayTrades.filter(t => t.isWinner).length;
        const currentWinRate = (winners / totalTrades) * 100;
        const totalPL = this.fridayTrades.reduce((sum, t) => sum + (t.realizedPL || 0), 0);
        
        // Recent performance (last 8 weeks)
        const recentTrades = this.fridayTrades.slice(-8);
        const recentWinners = recentTrades.filter(t => t.isWinner).length;
        const recentWinRate = recentTrades.length > 0 ? (recentWinners / recentTrades.length) * 100 : 0;
        
        // Monthly breakdown
        const monthlyBreakdown = this.calculateMonthlyBreakdown();
        
        return {
            totalFridaySessions: totalTrades,
            winners,
            losers: totalTrades - winners,
            currentWinRate,
            targetWinRate: this.targetWinRate,
            winRateVsTarget: currentWinRate - this.targetWinRate,
            totalPL,
            avgPLPerSession: totalPL / totalTrades,
            streaks: this.streakData,
            recentPerformance: {
                sessions: recentTrades.length,
                winners: recentWinners,
                winRate: recentWinRate,
                trades: recentTrades
            },
            monthlyBreakdown,
            nextFridayDate: this.getNextFriday(),
            systemStatus: this.getSystemStatus(currentWinRate, this.streakData)
        };
    }
    
    /**
     * Calculate monthly breakdown
     */
    calculateMonthlyBreakdown() {
        const monthly = {};
        
        this.fridayTrades.forEach(trade => {
            const date = new Date(trade.timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthly[monthKey]) {
                monthly[monthKey] = {
                    month: monthKey,
                    sessions: 0,
                    winners: 0,
                    totalPL: 0
                };
            }
            
            monthly[monthKey].sessions++;
            monthly[monthKey].totalPL += trade.realizedPL || 0;
            if (trade.isWinner) monthly[monthKey].winners++;
        });
        
        return Object.values(monthly).map(data => ({
            ...data,
            winRate: data.sessions > 0 ? (data.winners / data.sessions) * 100 : 0,
            avgPL: data.sessions > 0 ? data.totalPL / data.sessions : 0
        })).sort((a, b) => a.month.localeCompare(b.month));
    }
    
    /**
     * Get system status based on performance
     */
    getSystemStatus(winRate, streaks) {
        if (winRate >= this.targetWinRate && streaks.currentLossStreak === 0) {
            return {
                status: 'EXCELLENT',
                message: 'System performing above target with no current losses',
                color: 'green'
            };
        } else if (winRate >= 85 && streaks.currentLossStreak <= 1) {
            return {
                status: 'GOOD',
                message: 'System performing well, minor variance from target',
                color: 'blue'
            };
        } else if (winRate >= 75) {
            return {
                status: 'ACCEPTABLE',
                message: 'System below target but within acceptable range',
                color: 'orange'
            };
        } else {
            return {
                status: 'NEEDS_ATTENTION',
                message: 'System significantly below target - review required',
                color: 'red'
            };
        }
    }
    
    // Helper methods
    isFriday(timestamp) {
        return new Date(timestamp).getDay() === 5;
    }
    
    getWeekOfYear(timestamp) {
        const date = new Date(timestamp);
        const start = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }
    
    getNextFriday() {
        const now = new Date();
        const daysUntilFriday = (5 - now.getDay()) % 7;
        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
        return nextFriday.toISOString().split('T')[0];
    }
    
    getEmptySummary() {
        return {
            totalFridaySessions: 0,
            winners: 0,
            losers: 0,
            currentWinRate: 0,
            targetWinRate: this.targetWinRate,
            winRateVsTarget: -this.targetWinRate,
            totalPL: 0,
            avgPLPerSession: 0,
            streaks: { currentWinStreak: 0, longestWinStreak: 0, currentLossStreak: 0, lastLoss: null },
            recentPerformance: { sessions: 0, winners: 0, winRate: 0, trades: [] },
            monthlyBreakdown: [],
            nextFridayDate: this.getNextFriday(),
            systemStatus: { status: 'NO_DATA', message: 'No Friday sessions recorded', color: 'gray' }
        };
    }
}

/**
 * Buying Power Usage Tracker
 */
class BuyingPowerTracker {
    constructor(options = {}) {
        this.targetUsage = options.targetUsage || 35; // Target 35% BP usage
        this.maxUsage = options.maxUsage || 50; // Maximum 50% BP usage
        this.accountSize = options.accountSize || 35000; // Starting account size
        this.currentUsage = 0;
        this.history = [];
    }
    
    /**
     * Update buying power usage
     */
    updateUsage(usageData) {
        const entry = {
            timestamp: new Date(),
            totalBP: usageData.totalBP,
            usedBP: usageData.usedBP,
            usagePercent: (usageData.usedBP / usageData.totalBP) * 100,
            availableBP: usageData.totalBP - usageData.usedBP,
            positionCount: usageData.positionCount || 0,
            byStrategy: usageData.byStrategy || {},
            byCorrelationGroup: usageData.byCorrelationGroup || {}
        };
        
        this.currentUsage = entry.usagePercent;
        this.history.push(entry);
        
        // Keep only last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        this.history = this.history.filter(h => h.timestamp > thirtyDaysAgo);
        
        return this.getUsageSummary();
    }
    
    /**
     * Get usage summary and recommendations
     */
    getUsageSummary() {
        const current = this.history[this.history.length - 1];
        if (!current) {
            return this.getEmptyUsageSummary();
        }
        
        const recommendations = this.generateRecommendations(current);
        const efficiency = this.calculateEfficiency();
        const riskLevel = this.assessRiskLevel(current.usagePercent);
        
        return {
            current: {
                usagePercent: current.usagePercent,
                totalBP: current.totalBP,
                usedBP: current.usedBP,
                availableBP: current.availableBP,
                positionCount: current.positionCount
            },
            targets: {
                target: this.targetUsage,
                maximum: this.maxUsage,
                vsTarget: current.usagePercent - this.targetUsage,
                vsMaximum: current.usagePercent - this.maxUsage
            },
            breakdown: {
                byStrategy: current.byStrategy,
                byCorrelationGroup: current.byCorrelationGroup
            },
            riskLevel,
            efficiency,
            recommendations,
            history: this.history.slice(-7), // Last 7 entries
            trend: this.calculateTrend()
        };
    }
    
    /**
     * Generate BP usage recommendations
     */
    generateRecommendations(current) {
        const recommendations = [];
        const usage = current.usagePercent;
        
        if (usage < this.targetUsage * 0.7) {
            recommendations.push({
                type: 'INCREASE_POSITIONS',
                priority: 'MEDIUM',
                message: `BP usage at ${usage.toFixed(1)}% - consider adding positions to reach ${this.targetUsage}% target`,
                action: 'Add new positions in uncorrelated groups'
            });
        } else if (usage > this.maxUsage) {
            recommendations.push({
                type: 'REDUCE_POSITIONS',
                priority: 'HIGH',
                message: `BP usage at ${usage.toFixed(1)}% - exceeds maximum of ${this.maxUsage}%`,
                action: 'Close or reduce existing positions immediately'
            });
        } else if (usage > this.targetUsage * 1.2) {
            recommendations.push({
                type: 'MONITOR_USAGE',
                priority: 'LOW',
                message: `BP usage at ${usage.toFixed(1)}% - approaching maximum`,
                action: 'Monitor closely, prepare to reduce if needed'
            });
        }
        
        // Check concentration in correlation groups
        for (const [group, usage] of Object.entries(current.byCorrelationGroup)) {
            if (usage > 15) { // More than 15% in one group
                recommendations.push({
                    type: 'DIVERSIFY',
                    priority: 'MEDIUM',
                    message: `${usage.toFixed(1)}% BP concentrated in correlation group ${group}`,
                    action: 'Consider diversifying across other correlation groups'
                });
            }
        }
        
        return recommendations;
    }
    
    /**
     * Calculate BP usage efficiency
     */
    calculateEfficiency() {
        if (this.history.length < 7) {
            return { score: 0, message: 'Insufficient data for efficiency calculation' };
        }
        
        const recent = this.history.slice(-7);
        const avgUsage = recent.reduce((sum, h) => sum + h.usagePercent, 0) / recent.length;
        const consistency = 100 - (this.calculateStandardDeviation(recent.map(h => h.usagePercent)) / avgUsage * 100);
        
        // Target adherence score
        const targetAdherence = Math.max(0, 100 - Math.abs(avgUsage - this.targetUsage) * 2);
        
        // Overall efficiency score
        const score = (targetAdherence * 0.7 + consistency * 0.3);
        
        let message;
        if (score >= 90) message = 'Excellent BP management';
        else if (score >= 75) message = 'Good BP management';
        else if (score >= 60) message = 'Acceptable BP management';
        else message = 'BP management needs improvement';
        
        return {
            score: Math.round(score),
            avgUsage,
            targetAdherence: Math.round(targetAdherence),
            consistency: Math.round(consistency),
            message
        };
    }
    
    /**
     * Assess risk level based on usage
     */
    assessRiskLevel(usagePercent) {
        if (usagePercent > this.maxUsage) {
            return {
                level: 'HIGH',
                message: 'BP usage exceeds maximum safe limit',
                color: 'red'
            };
        } else if (usagePercent > this.targetUsage * 1.3) {
            return {
                level: 'MEDIUM',
                message: 'BP usage above comfortable level',
                color: 'orange'
            };
        } else if (usagePercent < this.targetUsage * 0.5) {
            return {
                level: 'LOW',
                message: 'BP significantly underutilized',
                color: 'blue'
            };
        } else {
            return {
                level: 'OPTIMAL',
                message: 'BP usage within optimal range',
                color: 'green'
            };
        }
    }
    
    calculateTrend() {
        if (this.history.length < 3) return { direction: 'STABLE', change: 0 };
        
        const recent = this.history.slice(-3);
        const first = recent[0].usagePercent;
        const last = recent[recent.length - 1].usagePercent;
        const change = last - first;
        
        let direction;
        if (Math.abs(change) < 2) direction = 'STABLE';
        else if (change > 0) direction = 'INCREASING';
        else direction = 'DECREASING';
        
        return { direction, change: Math.round(change * 10) / 10 };
    }
    
    calculateStandardDeviation(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
        return Math.sqrt(avgSquaredDiff);
    }
    
    getEmptyUsageSummary() {
        return {
            current: { usagePercent: 0, totalBP: 0, usedBP: 0, availableBP: 0, positionCount: 0 },
            targets: { target: this.targetUsage, maximum: this.maxUsage, vsTarget: -this.targetUsage, vsMaximum: -this.maxUsage },
            breakdown: { byStrategy: {}, byCorrelationGroup: {} },
            riskLevel: { level: 'UNKNOWN', message: 'No usage data available', color: 'gray' },
            efficiency: { score: 0, message: 'No efficiency data available' },
            recommendations: [],
            history: [],
            trend: { direction: 'STABLE', change: 0 }
        };
    }
}

/**
 * Phase Progression Tracker
 * Tracks progression through Tom King's 4 account phases
 */
class PhaseProgressionTracker {
    constructor(startingBalance = 35000) {
        this.startingBalance = startingBalance;
        this.currentBalance = startingBalance;
        this.phaseHistory = [];
        this.milestones = [
            { phase: 1, minBalance: 30000, maxBalance: 39999, description: 'Foundation Phase - MCL, MGC, TLT strangles, Friday 0DTE' },
            { phase: 2, minBalance: 40000, maxBalance: 59999, description: 'Expansion Phase - Add MES, MNQ, currency futures' },
            { phase: 3, minBalance: 60000, maxBalance: 74999, description: 'Upgrade Phase - Full futures, butterflies, complex spreads' },
            { phase: 4, minBalance: 75000, maxBalance: Infinity, description: 'Professional Phase - All strategies, maximum capacity' }
        ];
        
        // Now determine phase after milestones are defined
        this.currentPhase = this.determinePhase(startingBalance);
        
        // Record initial phase
        this.recordPhaseEntry(this.currentPhase, startingBalance);
    }
    
    /**
     * Update account balance and check for phase changes
     */
    updateBalance(newBalance, source = 'TRADING') {
        const oldPhase = this.currentPhase;
        const oldBalance = this.currentBalance;
        
        this.currentBalance = newBalance;
        const newPhase = this.determinePhase(newBalance);
        
        // Check for phase change
        if (newPhase !== oldPhase) {
            this.recordPhaseChange(oldPhase, newPhase, newBalance);
        }
        
        const progressData = this.getProgressData();
        
        logger.info('PHASE_TRACKER', 
            `Balance updated: £${newBalance.toLocaleString()} (Phase ${newPhase}) - ${source}`
        );
        
        return progressData;
    }
    
    /**
     * Determine phase based on balance
     */
    determinePhase(balance) {
        for (const milestone of this.milestones) {
            if (balance >= milestone.minBalance && balance <= milestone.maxBalance) {
                return milestone.phase;
            }
        }
        return 1; // Default to phase 1
    }
    
    /**
     * Record phase entry
     */
    recordPhaseEntry(phase, balance) {
        const entry = {
            phase,
            balance,
            timestamp: new Date(),
            type: 'ENTRY',
            daysInPhase: 0
        };
        
        this.phaseHistory.push(entry);
        
        logger.info('PHASE_TRACKER', 
            `Entered Phase ${phase} with £${balance.toLocaleString()}`
        );
    }
    
    /**
     * Record phase change
     */
    recordPhaseChange(oldPhase, newPhase, balance) {
        // Complete the old phase
        const lastEntry = this.phaseHistory[this.phaseHistory.length - 1];
        if (lastEntry && lastEntry.phase === oldPhase) {
            const daysInPhase = Math.floor((new Date() - lastEntry.timestamp) / (1000 * 60 * 60 * 24));
            lastEntry.daysInPhase = daysInPhase;
        }
        
        // Start the new phase
        this.recordPhaseEntry(newPhase, balance);
        
        const direction = newPhase > oldPhase ? 'PROMOTION' : 'DEMOTION';
        
        logger.info('PHASE_TRACKER', 
            `Phase ${direction}: ${oldPhase} → ${newPhase} at £${balance.toLocaleString()}`
        );
    }
    
    /**
     * Get comprehensive progress data
     */
    getProgressData() {
        const currentMilestone = this.milestones.find(m => m.phase === this.currentPhase);
        const nextMilestone = this.milestones.find(m => m.phase === this.currentPhase + 1);
        
        // Calculate progress within current phase
        let phaseProgress = 0;
        if (currentMilestone && nextMilestone) {
            const phaseRange = nextMilestone.minBalance - currentMilestone.minBalance;
            const currentProgress = this.currentBalance - currentMilestone.minBalance;
            phaseProgress = (currentProgress / phaseRange) * 100;
        } else if (this.currentPhase === 4) {
            // Phase 4 progress toward £80k goal
            const goalBalance = 80000;
            const phase4Start = 75000;
            const progressToGoal = this.currentBalance - phase4Start;
            const totalToGoal = goalBalance - phase4Start;
            phaseProgress = Math.min(100, (progressToGoal / totalToGoal) * 100);
        }
        
        // Calculate overall progress to £80k goal
        const goalBalance = 80000;
        const totalProgress = ((this.currentBalance - this.startingBalance) / (goalBalance - this.startingBalance)) * 100;
        
        // Time in current phase
        const currentPhaseEntry = this.phaseHistory.find(h => h.phase === this.currentPhase && h.type === 'ENTRY');
        const daysInCurrentPhase = currentPhaseEntry ? 
            Math.floor((new Date() - currentPhaseEntry.timestamp) / (1000 * 60 * 60 * 24)) : 0;
        
        return {
            currentPhase: this.currentPhase,
            currentBalance: this.currentBalance,
            startingBalance: this.startingBalance,
            totalGrowth: this.currentBalance - this.startingBalance,
            totalGrowthPercent: ((this.currentBalance - this.startingBalance) / this.startingBalance) * 100,
            phaseProgress: Math.max(0, Math.min(100, phaseProgress)),
            totalProgress: Math.max(0, Math.min(100, totalProgress)),
            currentMilestone,
            nextMilestone,
            daysInCurrentPhase,
            phaseHistory: this.phaseHistory,
            availableStrategies: this.getAvailableStrategies(this.currentPhase),
            nextPhaseRequirements: this.getNextPhaseRequirements(),
            monthlyTargets: this.calculateMonthlyTargets(),
            goalProjection: this.calculateGoalProjection()
        };
    }
    
    /**
     * Get available strategies for current phase
     */
    getAvailableStrategies(phase) {
        const strategies = {
            1: ['MCL Strangles', 'MGC Strangles', 'TLT Strangles', 'Friday 0DTE', 'Basic LEAPs'],
            2: ['All Phase 1', 'MES LT112', 'MNQ Strangles', 'Currency Futures', 'Enhanced LEAPs'],
            3: ['All Phase 2', 'ES LT112', 'Butterflies', 'Complex Spreads', 'VIX Strategies'],
            4: ['All Phase 3', 'Professional Box Spreads', 'Advanced Greeks Strategies', 'Custom Spreads']
        };
        
        return strategies[phase] || strategies[1];
    }
    
    /**
     * Get requirements for next phase
     */
    getNextPhaseRequirements() {
        const nextPhase = this.currentPhase + 1;
        const nextMilestone = this.milestones.find(m => m.phase === nextPhase);
        
        if (!nextMilestone) {
            return {
                phase: 'GOAL_ACHIEVED',
                message: 'You have reached the highest phase! Continue toward £80k goal.',
                balanceNeeded: Math.max(0, 80000 - this.currentBalance)
            };
        }
        
        return {
            phase: nextPhase,
            description: nextMilestone.description,
            minBalance: nextMilestone.minBalance,
            balanceNeeded: Math.max(0, nextMilestone.minBalance - this.currentBalance),
            percentNeeded: ((nextMilestone.minBalance - this.currentBalance) / this.currentBalance) * 100
        };
    }
    
    /**
     * Calculate monthly targets to reach £80k goal
     */
    calculateMonthlyTargets() {
        const goalBalance = 80000;
        const remainingAmount = goalBalance - this.currentBalance;
        const targetMonths = 8; // Target timeframe
        const monthlyTarget = remainingAmount / targetMonths;
        const monthlyPercentTarget = (monthlyTarget / this.currentBalance) * 100;
        
        return {
            monthlyTargetAmount: monthlyTarget,
            monthlyPercentTarget: monthlyPercentTarget,
            remainingAmount,
            remainingMonths: targetMonths,
            compoundingRequired: this.calculateRequiredCompounding(targetMonths)
        };
    }
    
    /**
     * Calculate required monthly compounding rate
     */
    calculateRequiredCompounding(months) {
        const goalBalance = 80000;
        const currentBalance = this.currentBalance;
        const requiredMultiplier = goalBalance / currentBalance;
        const monthlyRate = (Math.pow(requiredMultiplier, 1/months) - 1) * 100;
        
        return {
            monthlyRate,
            achievable: monthlyRate <= 15, // 15% monthly is considered achievable with Tom King strategies
            difficulty: this.assessDifficulty(monthlyRate)
        };
    }
    
    /**
     * Assess difficulty of achieving required returns
     */
    assessDifficulty(monthlyRate) {
        if (monthlyRate <= 6) return 'EASY';
        if (monthlyRate <= 10) return 'MODERATE';
        if (monthlyRate <= 15) return 'CHALLENGING';
        return 'VERY_DIFFICULT';
    }
    
    /**
     * Calculate goal projection based on current growth rate
     */
    calculateGoalProjection() {
        if (this.phaseHistory.length < 2) {
            return { 
                projectedDate: 'Insufficient data', 
                confidence: 'LOW',
                monthsToGoal: 'Unknown'
            };
        }
        
        // Calculate average monthly growth from phase history
        const totalDays = (new Date() - this.phaseHistory[0].timestamp) / (1000 * 60 * 60 * 24);
        const totalGrowth = this.currentBalance - this.startingBalance;
        const dailyGrowthRate = totalGrowth / totalDays;
        
        const goalBalance = 80000;
        const remainingAmount = goalBalance - this.currentBalance;
        const daysToGoal = remainingAmount / dailyGrowthRate;
        const projectedDate = new Date(Date.now() + daysToGoal * 24 * 60 * 60 * 1000);
        
        return {
            projectedDate: projectedDate.toISOString().split('T')[0],
            monthsToGoal: Math.ceil(daysToGoal / 30),
            confidence: totalDays > 30 ? 'MEDIUM' : 'LOW',
            currentGrowthRate: (dailyGrowthRate * 30 / this.currentBalance) * 100, // Monthly %
            requiredGrowthRate: this.calculateMonthlyTargets().monthlyPercentTarget
        };
    }
}

/**
 * Tom King Master Tracker
 * Orchestrates all Tom King specific tracking
 */
class TomKingTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            startingBalance: options.startingBalance || 35000,
            goalBalance: options.goalBalance || 80000,
            targetMonthlyIncome: options.targetMonthlyIncome || 10000,
            ...options
        };
        
        this.friday0DTE = new Friday0DTETracker();
        this.buyingPower = new BuyingPowerTracker({
            accountSize: this.options.startingBalance
        });
        this.phaseProgression = new PhaseProgressionTracker(this.options.startingBalance);
        
        logger.info('TOM_KING_TRACKER', 'Tom King tracking system initialized');
    }
    
    /**
     * Update all tracking systems with new trade
     */
    updateWithTrade(trade) {
        const updates = {};
        
        // Update Friday 0DTE tracking
        if (trade.fridayODTE && !trade.isActive) {
            updates.friday0DTE = this.friday0DTE.addFridayTrade({
                ...trade,
                isWinner: (trade.realizedPL || 0) > 0
            });
        }
        
        this.emit('tradeProcessed', { trade, updates });
        return updates;
    }
    
    /**
     * Update buying power usage
     */
    updateBuyingPower(usageData) {
        const summary = this.buyingPower.updateUsage(usageData);
        this.emit('buyingPowerUpdated', summary);
        return summary;
    }
    
    /**
     * Update account balance and phase progression
     */
    updateBalance(newBalance, source = 'TRADING') {
        const progressData = this.phaseProgression.updateBalance(newBalance, source);
        this.emit('balanceUpdated', { newBalance, source, progressData });
        return progressData;
    }
    
    /**
     * Get comprehensive Tom King metrics
     */
    getComprehensiveMetrics() {
        const friday0DTEMetrics = this.friday0DTE.getPerformanceSummary();
        const buyingPowerMetrics = this.buyingPower.getUsageSummary();
        const phaseMetrics = this.phaseProgression.getProgressData();
        
        return {
            timestamp: new Date().toISOString(),
            friday0DTE: friday0DTEMetrics,
            buyingPower: buyingPowerMetrics,
            phaseProgression: phaseMetrics,
            goalProgress: this.calculateGoalProgress(phaseMetrics),
            systemHealth: this.assessSystemHealth(friday0DTEMetrics, buyingPowerMetrics, phaseMetrics),
            recommendations: this.generateRecommendations(friday0DTEMetrics, buyingPowerMetrics, phaseMetrics)
        };
    }
    
    /**
     * Calculate overall goal progress
     */
    calculateGoalProgress(phaseMetrics) {
        const goalBalance = this.options.goalBalance;
        const currentBalance = phaseMetrics.currentBalance;
        const startingBalance = this.options.startingBalance;
        
        const progressPercent = ((currentBalance - startingBalance) / (goalBalance - startingBalance)) * 100;
        const remainingAmount = goalBalance - currentBalance;
        const monthlyIncomeProgress = this.calculateMonthlyIncomeProgress();
        
        return {
            currentBalance,
            goalBalance,
            startingBalance,
            progressPercent: Math.max(0, Math.min(100, progressPercent)),
            remainingAmount,
            monthlyIncomeProgress,
            onTrackForGoal: this.assessGoalTracking(phaseMetrics),
            estimatedCompletion: phaseMetrics.goalProjection.projectedDate
        };
    }
    
    /**
     * Calculate monthly income progress toward £10k target
     */
    calculateMonthlyIncomeProgress() {
        // This would need actual monthly income data
        // For now, return placeholder
        const targetMonthlyIncome = this.options.targetMonthlyIncome;
        return {
            currentMonthlyIncome: 0, // Would be calculated from actual data
            targetMonthlyIncome,
            progressPercent: 0,
            monthsToTarget: 'Unknown'
        };
    }
    
    /**
     * Assess if on track for goal
     */
    assessGoalTracking(phaseMetrics) {
        const requiredRate = phaseMetrics.monthlyTargets.monthlyPercentTarget;
        const currentRate = phaseMetrics.goalProjection.currentGrowthRate || 0;
        
        if (currentRate >= requiredRate) {
            return {
                status: 'ON_TRACK',
                message: 'Current growth rate meets or exceeds target',
                variance: currentRate - requiredRate
            };
        } else if (currentRate >= requiredRate * 0.8) {
            return {
                status: 'SLIGHTLY_BEHIND',
                message: 'Growth rate slightly below target but recoverable',
                variance: currentRate - requiredRate
            };
        } else {
            return {
                status: 'BEHIND_TARGET',
                message: 'Growth rate significantly below target - strategy adjustment needed',
                variance: currentRate - requiredRate
            };
        }
    }
    
    /**
     * Assess overall system health
     */
    assessSystemHealth(friday0DTE, buyingPower, phase) {
        const healthFactors = [];
        
        // Friday 0DTE health
        if (friday0DTE.totalFridaySessions > 0) {
            const fridayHealth = friday0DTE.currentWinRate >= 85 ? 'GOOD' : 
                                friday0DTE.currentWinRate >= 70 ? 'FAIR' : 'POOR';
            healthFactors.push({ factor: 'Friday 0DTE', health: fridayHealth, score: friday0DTE.currentWinRate });
        }
        
        // Buying power health
        const bpHealth = buyingPower.riskLevel.level === 'OPTIMAL' ? 'GOOD' : 
                        buyingPower.riskLevel.level === 'MEDIUM' ? 'FAIR' : 'POOR';
        healthFactors.push({ factor: 'Buying Power', health: bpHealth, score: buyingPower.efficiency.score });
        
        // Phase progression health
        const progressHealth = phase.totalProgress >= 50 ? 'GOOD' : 
                              phase.totalProgress >= 25 ? 'FAIR' : 'POOR';
        healthFactors.push({ factor: 'Goal Progress', health: progressHealth, score: phase.totalProgress });
        
        // Calculate overall health
        const scores = healthFactors.map(f => f.score);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        let overallHealth;
        if (avgScore >= 80) overallHealth = 'EXCELLENT';
        else if (avgScore >= 65) overallHealth = 'GOOD';
        else if (avgScore >= 50) overallHealth = 'FAIR';
        else overallHealth = 'NEEDS_IMPROVEMENT';
        
        return {
            overall: overallHealth,
            score: Math.round(avgScore),
            factors: healthFactors
        };
    }
    
    /**
     * Generate comprehensive recommendations
     */
    generateRecommendations(friday0DTE, buyingPower, phase) {
        const recommendations = [];
        
        // Friday 0DTE recommendations
        if (friday0DTE.totalFridaySessions > 0 && friday0DTE.currentWinRate < 85) {
            recommendations.push({
                category: 'Friday 0DTE',
                priority: 'HIGH',
                message: `Win rate at ${friday0DTE.currentWinRate.toFixed(1)}% - review entry criteria and timing`,
                action: 'Analyze recent losses and adjust strategy parameters'
            });
        }
        
        // Buying power recommendations
        recommendations.push(...buyingPower.recommendations);
        
        // Phase progression recommendations
        const phaseReqs = phase.nextPhaseRequirements;
        if (phaseReqs.balanceNeeded > 0 && phaseReqs.phase !== 'GOAL_ACHIEVED') {
            recommendations.push({
                category: 'Phase Progression',
                priority: 'MEDIUM',
                message: `£${phaseReqs.balanceNeeded.toLocaleString()} needed for Phase ${phaseReqs.phase}`,
                action: `Focus on consistent execution of Phase ${phase.currentPhase} strategies`
            });
        }
        
        // Goal tracking recommendations
        const goalTracking = this.assessGoalTracking(phase);
        if (goalTracking.status === 'BEHIND_TARGET') {
            recommendations.push({
                category: 'Goal Achievement',
                priority: 'HIGH',
                message: 'Current growth rate insufficient for £80k goal in 8 months',
                action: 'Consider increasing position sizes or adding strategies within risk limits'
            });
        }
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    
    /**
     * Generate comprehensive report
     */
    generateReport() {
        return this.getComprehensiveMetrics();
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.removeAllListeners();
        logger.info('TOM_KING_TRACKER', 'Tom King tracker destroyed');
    }
}

module.exports = {
    Friday0DTETracker,
    BuyingPowerTracker,
    PhaseProgressionTracker,
    TomKingTracker
};