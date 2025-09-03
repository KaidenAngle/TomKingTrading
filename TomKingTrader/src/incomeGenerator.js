/**
 * Monthly Income Generation System
 * Core module for achieving £10k/month financial freedom target
 * Implements Tom King's systematic income extraction methodology
 */

const EventEmitter = require('events');
const { TradingStrategies } = require('./strategies');
const { RiskManager } = require('./riskManager');
const { PerformanceMetrics } = require('./performanceMetrics');
const { TradeJournal } = require('./tradeJournal');
const { getLogger } = require('./logger');

const logger = getLogger();

class IncomeGenerator extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            targetMonthlyIncome: config.targetMonthlyIncome || 10000, // £10k default
            accountBalance: config.accountBalance || 35000,
            monthlyGrowthTarget: config.monthlyGrowthTarget || 0.12, // 12% monthly
            withdrawalRate: config.withdrawalRate || 0.03, // 3% monthly withdrawal
            reinvestmentRate: config.reinvestmentRate || 0.75, // 75% reinvest, 25% withdraw
            ...config
        };
        
        // Income tracking
        this.monthlyIncome = {
            target: this.config.targetMonthlyIncome,
            actual: 0,
            projected: 0,
            strategies: {},
            withdrawals: [],
            reinvestments: []
        };
        
        // Compounding tracker
        this.compoundingTracker = {
            startBalance: this.config.accountBalance,
            currentBalance: this.config.accountBalance,
            totalGrowth: 0,
            monthlyGrowth: [],
            compoundRate: this.config.monthlyGrowthTarget,
            reinvestedAmount: 0,
            withdrawnAmount: 0,
            projectedBalance: {},
            milestones: this.initializeMilestones()
        };
        
        // Strategy income allocation (based on Tom King's preferences)
        this.strategyAllocation = {
            'FRIDAY_0DTE': 0.35,        // 35% from Friday 0DTE
            'LONG_TERM_112': 0.25,      // 25% from LT112
            'FUTURES_STRANGLES': 0.20,  // 20% from strangles
            'IPMCC': 0.10,              // 10% from IPMCC
            'SECTION_9B': 0.10          // 10% from advanced strategies
        };
        
        // Phase-based income targets
        this.phaseTargets = {
            1: { min: 30000, max: 40000, monthlyIncome: 1200, strategies: ['FRIDAY_0DTE', 'LONG_TERM_112'] },
            2: { min: 40000, max: 60000, monthlyIncome: 2400, strategies: ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES'] },
            3: { min: 60000, max: 75000, monthlyIncome: 4500, strategies: ['ALL'] },
            4: { min: 75000, max: Infinity, monthlyIncome: 10000, strategies: ['ALL_ENHANCED'] }
        };
        
        this.currentPhase = this.determinePhase(this.config.accountBalance);
        this.strategies = new TradingStrategies();
        this.riskManager = new RiskManager();
        this.performanceMetrics = new PerformanceMetrics();
        this.tradeJournal = new TradeJournal();
    }
    
    /**
     * Initialize income generation system
     */
    async initialize() {
        logger.info('INCOME', 'Initializing income generation system');
        
        // Set monthly targets based on current phase
        this.updateMonthlyTargets();
        
        // Calculate projected income
        await this.calculateProjectedIncome();
        
        console.log('💰 Income Generation System Initialized');
        console.log(`   Current Phase: ${this.currentPhase}`);
        console.log(`   Account Balance: £${this.config.accountBalance.toLocaleString()}`);
        console.log(`   Monthly Target: £${this.monthlyIncome.target.toLocaleString()}`);
        console.log(`   Projected Income: £${this.monthlyIncome.projected.toLocaleString()}`);
        
        this.emit('initialized', {
            phase: this.currentPhase,
            balance: this.config.accountBalance,
            target: this.monthlyIncome.target
        });
    }
    
    /**
     * Determine account phase based on balance
     * Uses masterController's centralized phase determination
     */
    determinePhase(balance) {
        // Use centralized phase determination from config
        const config = require('./config');
        return config.ConfigHelpers.getPhaseFromAccountValue(balance);
    }
    
    /**
     * Update monthly income targets based on phase
     */
    updateMonthlyTargets() {
        const phaseInfo = this.phaseTargets[this.currentPhase];
        this.monthlyIncome.target = phaseInfo.monthlyIncome;
        
        // Update strategy allocations based on phase
        if (this.currentPhase === 1) {
            // Phase 1: Focus on 0DTE and LT112
            this.strategyAllocation = {
                'FRIDAY_0DTE': 0.60,
                'LONG_TERM_112': 0.40,
                'FUTURES_STRANGLES': 0,
                'IPMCC': 0,
                'SECTION_9B': 0
            };
        } else if (this.currentPhase === 2) {
            // Phase 2: Add strangles
            this.strategyAllocation = {
                'FRIDAY_0DTE': 0.40,
                'LONG_TERM_112': 0.30,
                'FUTURES_STRANGLES': 0.30,
                'IPMCC': 0,
                'SECTION_9B': 0
            };
        } else if (this.currentPhase === 3) {
            // Phase 3: Add IPMCC
            this.strategyAllocation = {
                'FRIDAY_0DTE': 0.35,
                'LONG_TERM_112': 0.25,
                'FUTURES_STRANGLES': 0.25,
                'IPMCC': 0.15,
                'SECTION_9B': 0
            };
        }
        // Phase 4 uses default allocation
    }
    
    /**
     * Calculate projected monthly income
     */
    async calculateProjectedIncome() {
        const accountValue = this.config.accountBalance;
        const vixLevel = 18; // Default VIX for calculation
        
        // Calculate income by strategy
        for (const [strategy, allocation] of Object.entries(this.strategyAllocation)) {
            if (allocation === 0) continue;
            
            const strategyCapital = accountValue * allocation;
            const monthlyReturn = this.calculateStrategyReturn(strategy, strategyCapital, vixLevel);
            
            this.monthlyIncome.strategies[strategy] = {
                allocation: allocation * 100,
                capital: strategyCapital,
                expectedReturn: monthlyReturn,
                actualReturn: 0
            };
            
            this.monthlyIncome.projected += monthlyReturn;
        }
        
        return this.monthlyIncome.projected;
    }
    
    /**
     * Calculate expected return for a strategy
     */
    calculateStrategyReturn(strategy, capital, vixLevel) {
        // Based on Tom King's documented win rates and returns
        const strategyReturns = {
            'FRIDAY_0DTE': {
                winRate: 0.88,
                avgWin: 0.015,  // 1.5% per trade
                avgLoss: -0.03,  // -3% per trade
                tradesPerMonth: 4
            },
            'LONG_TERM_112': {
                winRate: 0.73,
                avgWin: 0.50,    // 50% target
                avgLoss: -0.25,  // -25% max loss
                tradesPerMonth: 2
            },
            'FUTURES_STRANGLES': {
                winRate: 0.72,
                avgWin: 0.03,    // 3% per trade
                avgLoss: -0.04,  // -4% per trade
                tradesPerMonth: 8
            },
            'IPMCC': {
                winRate: 0.75,
                avgWin: 0.02,    // 2% weekly
                avgLoss: -0.03,
                tradesPerMonth: 4
            },
            'SECTION_9B': {
                winRate: 0.70,
                avgWin: 0.04,
                avgLoss: -0.05,
                tradesPerMonth: 2
            }
        };
        
        const returns = strategyReturns[strategy];
        if (!returns) return 0;
        
        // Calculate expected value per trade
        const expectedValuePerTrade = 
            (returns.winRate * returns.avgWin) + 
            ((1 - returns.winRate) * returns.avgLoss);
        
        // Calculate monthly return
        const monthlyReturn = capital * expectedValuePerTrade * returns.tradesPerMonth;
        
        // Adjust for VIX regime
        let vixAdjustment = 1.0;
        if (vixLevel < 15) {
            vixAdjustment = 0.7; // Lower returns in low vol
        } else if (vixLevel > 25) {
            vixAdjustment = 1.3; // Higher returns in high vol
        }
        
        return monthlyReturn * vixAdjustment;
    }
    
    /**
     * Record income from a completed trade
     */
    async recordTradeIncome(trade) {
        const income = trade.netPnL || 0;
        const strategy = trade.strategy;
        
        // Update actual income
        this.monthlyIncome.actual += income;
        
        if (this.monthlyIncome.strategies[strategy]) {
            this.monthlyIncome.strategies[strategy].actualReturn += income;
        }
        
        // Check if we're meeting targets
        const targetProgress = (this.monthlyIncome.actual / this.monthlyIncome.target) * 100;
        
        logger.info('INCOME', `Trade income recorded: £${income.toFixed(2)} from ${strategy}`);
        logger.info('INCOME', `Monthly progress: ${targetProgress.toFixed(1)}% of target`);
        
        this.emit('incomeRecorded', {
            trade,
            income,
            monthlyTotal: this.monthlyIncome.actual,
            targetProgress
        });
        
        // Check if we should process withdrawals
        if (this.monthlyIncome.actual >= this.monthlyIncome.target) {
            await this.processMonthlyWithdrawal();
        }
    }
    
    /**
     * Process monthly withdrawal for income
     */
    async processMonthlyWithdrawal() {
        const availableIncome = this.monthlyIncome.actual;
        
        // Calculate withdrawal amount (25% for income, 75% reinvest)
        const withdrawalAmount = availableIncome * (1 - this.config.reinvestmentRate);
        const reinvestAmount = availableIncome * this.config.reinvestmentRate;
        
        // Record withdrawal
        const withdrawal = {
            date: new Date().toISOString(),
            amount: withdrawalAmount,
            purpose: 'MONTHLY_INCOME',
            remaining: reinvestAmount,
            accountBalance: this.config.accountBalance
        };
        
        this.monthlyIncome.withdrawals.push(withdrawal);
        
        // Update account balance (reinvest portion)
        this.config.accountBalance += reinvestAmount;
        
        // Check if we need to change phase
        const newPhase = this.determinePhase(this.config.accountBalance);
        if (newPhase !== this.currentPhase) {
            await this.transitionPhase(newPhase);
        }
        
        console.log('\n💵 MONTHLY INCOME WITHDRAWAL PROCESSED');
        console.log(`   Withdrawal: £${withdrawalAmount.toFixed(2)}`);
        console.log(`   Reinvested: £${reinvestAmount.toFixed(2)}`);
        console.log(`   New Balance: £${this.config.accountBalance.toFixed(2)}`);
        
        this.emit('withdrawalProcessed', withdrawal);
        
        // Reset monthly counters
        this.monthlyIncome.actual = 0;
        for (const strategy in this.monthlyIncome.strategies) {
            this.monthlyIncome.strategies[strategy].actualReturn = 0;
        }
        
        return withdrawal;
    }
    
    /**
     * Transition to new account phase
     */
    async transitionPhase(newPhase) {
        const oldPhase = this.currentPhase;
        this.currentPhase = newPhase;
        
        console.log('\n🎯 ACCOUNT PHASE TRANSITION');
        console.log(`   From Phase ${oldPhase} to Phase ${newPhase}`);
        console.log(`   New Strategies Available: ${this.phaseTargets[newPhase].strategies.join(', ')}`);
        console.log(`   New Monthly Target: £${this.phaseTargets[newPhase].monthlyIncome}`);
        
        // Update targets and allocations
        this.updateMonthlyTargets();
        await this.calculateProjectedIncome();
        
        this.emit('phaseTransition', {
            oldPhase,
            newPhase,
            balance: this.config.accountBalance,
            newTarget: this.monthlyIncome.target
        });
    }
    
    /**
     * Calculate compound growth projection
     */
    calculateCompoundGrowth(months = 8) {
        let balance = this.config.accountBalance;
        const monthlyGrowth = this.config.monthlyGrowthTarget;
        const projections = [];
        
        for (let month = 1; month <= months; month++) {
            // Calculate growth
            const growth = balance * monthlyGrowth;
            
            // Apply withdrawal rate
            const withdrawal = growth * (1 - this.config.reinvestmentRate);
            const reinvest = growth * this.config.reinvestmentRate;
            
            balance += reinvest;
            
            // Determine phase for this balance
            const phase = this.determinePhase(balance);
            const phaseInfo = this.phaseTargets[phase];
            
            projections.push({
                month,
                startBalance: balance - reinvest,
                growth,
                withdrawal,
                reinvest,
                endBalance: balance,
                phase,
                monthlyIncome: phaseInfo.monthlyIncome
            });
        }
        
        return projections;
    }
    
    /**
     * Calculate time to financial freedom
     */
    calculateTimeToFreedom() {
        const targetMonthlyIncome = 10000; // £10k/month freedom target
        const targetAccountSize = 100000; // £100k generates £3k/month at 3%
        
        let balance = this.config.accountBalance;
        let months = 0;
        
        while (balance < targetAccountSize && months < 36) {
            months++;
            const growth = balance * this.config.monthlyGrowthTarget;
            const reinvest = growth * this.config.reinvestmentRate;
            balance += reinvest;
        }
        
        return {
            monthsToFreedom: months,
            targetDate: new Date(Date.now() + (months * 30 * 24 * 60 * 60 * 1000)),
            finalBalance: balance,
            monthlyIncomeAtTarget: balance * 0.03, // 3% monthly sustainable
            achievable: months <= 18 // Tom's goal is 18 months
        };
    }
    
    /**
     * Generate income report
     */
    async generateIncomeReport() {
        const report = {
            currentPhase: this.currentPhase,
            accountBalance: this.config.accountBalance,
            monthlyIncome: this.monthlyIncome,
            yearToDate: {
                totalIncome: this.monthlyIncome.withdrawals.reduce((sum, w) => sum + w.amount, 0),
                totalReinvested: this.monthlyIncome.withdrawals.reduce((sum, w) => sum + w.remaining, 0),
                withdrawalCount: this.monthlyIncome.withdrawals.length
            },
            projections: {
                compound: this.calculateCompoundGrowth(8),
                timeToFreedom: this.calculateTimeToFreedom()
            },
            strategyPerformance: this.monthlyIncome.strategies,
            recommendations: []
        };
        
        // Generate recommendations
        if (this.monthlyIncome.actual < this.monthlyIncome.target * 0.8) {
            report.recommendations.push('Below target - increase position sizes within risk limits');
        }
        
        if (this.currentPhase < 4) {
            const nextPhase = this.phaseTargets[this.currentPhase + 1];
            const needed = nextPhase.min - this.config.accountBalance;
            report.recommendations.push(`£${needed.toFixed(0)} needed for Phase ${this.currentPhase + 1}`);
        }
        
        return report;
    }
    
    /**
     * Initialize milestones for tracking
     */
    initializeMilestones() {
        return [
            { amount: 40000, name: 'Phase 2', achieved: false, date: null },
            { amount: 50000, name: 'Halfway', achieved: false, date: null },
            { amount: 60000, name: 'Phase 3', achieved: false, date: null },
            { amount: 75000, name: 'Phase 4', achieved: false, date: null },
            { amount: 80000, name: 'Initial Goal', achieved: false, date: null },
            { amount: 100000, name: 'Financial Freedom', achieved: false, date: null },
            { amount: 150000, name: 'Wealth Building', achieved: false, date: null },
            { amount: 250000, name: 'Quarter Million', achieved: false, date: null },
            { amount: 500000, name: 'Half Million', achieved: false, date: null },
            { amount: 1000000, name: 'Millionaire', achieved: false, date: null }
        ];
    }
    
    /**
     * Update compounding tracker with new balance
     */
    updateCompoundingTracker(newBalance, monthlyPnL) {
        const previousBalance = this.compoundingTracker.currentBalance;
        const growthRate = (newBalance - previousBalance) / previousBalance;
        
        this.compoundingTracker.currentBalance = newBalance;
        this.compoundingTracker.totalGrowth = (newBalance - this.compoundingTracker.startBalance) / this.compoundingTracker.startBalance;
        
        // Add to monthly growth history
        this.compoundingTracker.monthlyGrowth.push({
            month: new Date().toISOString().slice(0, 7),
            startBalance: previousBalance,
            endBalance: newBalance,
            pnl: monthlyPnL,
            growthRate: growthRate,
            compoundedReturn: this.compoundingTracker.totalGrowth
        });
        
        // Check milestones
        this.checkMilestones(newBalance);
        
        // Update projections
        this.updateProjections(newBalance);
        
        // Emit update event
        this.emit('compoundingUpdate', {
            currentBalance: newBalance,
            totalGrowth: this.compoundingTracker.totalGrowth,
            monthlyGrowthRate: growthRate
        });
    }
    
    /**
     * Check and update milestones
     */
    checkMilestones(currentBalance) {
        for (const milestone of this.compoundingTracker.milestones) {
            if (!milestone.achieved && currentBalance >= milestone.amount) {
                milestone.achieved = true;
                milestone.date = new Date();
                
                logger.info('MILESTONE', `Achieved: ${milestone.name} (£${milestone.amount.toLocaleString()})`);
                
                this.emit('milestoneAchieved', {
                    name: milestone.name,
                    amount: milestone.amount,
                    date: milestone.date
                });
            }
        }
    }
    
    /**
     * Update future projections based on current performance
     */
    updateProjections(currentBalance) {
        // Calculate rolling average growth rate (last 3 months)
        const recentGrowth = this.compoundingTracker.monthlyGrowth.slice(-3);
        const avgGrowthRate = recentGrowth.length > 0 
            ? recentGrowth.reduce((sum, m) => sum + m.growthRate, 0) / recentGrowth.length
            : this.config.monthlyGrowthTarget;
        
        // Project future balances
        const projections = {};
        let balance = currentBalance;
        
        for (let months = 1; months <= 24; months++) {
            balance *= (1 + avgGrowthRate);
            projections[months] = {
                balance: Math.round(balance),
                monthlyIncome: Math.round(balance * 0.03), // 3% monthly income
                phase: this.determinePhase(balance)
            };
        }
        
        this.compoundingTracker.projectedBalance = projections;
    }
    
    /**
     * Calculate compound growth with reinvestment
     */
    calculateCompoundGrowthWithReinvestment(months, startBalance = null, customGrowthRate = null) {
        const balance = startBalance || this.compoundingTracker.currentBalance;
        const growthRate = customGrowthRate || this.compoundingTracker.compoundRate;
        const reinvestRate = this.config.reinvestmentRate;
        
        const projections = [];
        let currentBalance = balance;
        let totalWithdrawn = 0;
        let totalReinvested = 0;
        
        for (let month = 1; month <= months; month++) {
            const monthlyReturn = currentBalance * growthRate;
            const reinvested = monthlyReturn * reinvestRate;
            const withdrawn = monthlyReturn * (1 - reinvestRate);
            
            totalReinvested += reinvested;
            totalWithdrawn += withdrawn;
            currentBalance += reinvested; // Only reinvested portion adds to balance
            
            projections.push({
                month,
                startBalance: currentBalance - reinvested,
                endBalance: currentBalance,
                monthlyReturn,
                reinvested,
                withdrawn,
                totalWithdrawn,
                totalReinvested,
                phase: this.determinePhase(currentBalance),
                monthlyIncome: currentBalance * 0.03
            });
        }
        
        return projections;
    }
    
    /**
     * Track reinvestment vs withdrawal
     */
    trackReinvestment(monthlyPnL) {
        const reinvestAmount = monthlyPnL * this.config.reinvestmentRate;
        const withdrawAmount = monthlyPnL * (1 - this.config.reinvestmentRate);
        
        this.compoundingTracker.reinvestedAmount += reinvestAmount;
        this.compoundingTracker.withdrawnAmount += withdrawAmount;
        
        // Update balance with reinvestment
        const newBalance = this.compoundingTracker.currentBalance + reinvestAmount;
        this.updateCompoundingTracker(newBalance, monthlyPnL);
        
        // Record reinvestment
        this.monthlyIncome.reinvestments.push({
            date: new Date(),
            totalPnL: monthlyPnL,
            reinvested: reinvestAmount,
            withdrawn: withdrawAmount,
            newBalance: newBalance
        });
        
        return {
            reinvested: reinvestAmount,
            withdrawn: withdrawAmount,
            newBalance: newBalance
        };
    }
    
    /**
     * Get compounding statistics
     */
    getCompoundingStats() {
        const monthsTracked = this.compoundingTracker.monthlyGrowth.length;
        const avgMonthlyGrowth = monthsTracked > 0
            ? this.compoundingTracker.monthlyGrowth.reduce((sum, m) => sum + m.growthRate, 0) / monthsTracked
            : 0;
        
        const achievedMilestones = this.compoundingTracker.milestones.filter(m => m.achieved);
        const nextMilestone = this.compoundingTracker.milestones.find(m => !m.achieved);
        
        // Calculate months to next milestone based on average growth
        let monthsToNext = null;
        if (nextMilestone && avgMonthlyGrowth > 0) {
            const needed = nextMilestone.amount - this.compoundingTracker.currentBalance;
            monthsToNext = Math.ceil(Math.log(nextMilestone.amount / this.compoundingTracker.currentBalance) / Math.log(1 + avgMonthlyGrowth));
        }
        
        return {
            currentBalance: this.compoundingTracker.currentBalance,
            startBalance: this.compoundingTracker.startBalance,
            totalGrowth: this.compoundingTracker.totalGrowth,
            totalGrowthPercent: (this.compoundingTracker.totalGrowth * 100).toFixed(2),
            monthsTracked,
            avgMonthlyGrowth: (avgMonthlyGrowth * 100).toFixed(2),
            totalReinvested: this.compoundingTracker.reinvestedAmount,
            totalWithdrawn: this.compoundingTracker.withdrawnAmount,
            reinvestmentRatio: this.compoundingTracker.reinvestedAmount / (this.compoundingTracker.reinvestedAmount + this.compoundingTracker.withdrawnAmount),
            achievedMilestones: achievedMilestones.map(m => ({
                name: m.name,
                amount: m.amount,
                date: m.date
            })),
            nextMilestone: nextMilestone ? {
                name: nextMilestone.name,
                amount: nextMilestone.amount,
                needed: nextMilestone.amount - this.compoundingTracker.currentBalance,
                monthsToReach: monthsToNext
            } : null,
            projectedBalances: {
                '3_months': this.compoundingTracker.projectedBalance[3],
                '6_months': this.compoundingTracker.projectedBalance[6],
                '12_months': this.compoundingTracker.projectedBalance[12],
                '24_months': this.compoundingTracker.projectedBalance[24]
            }
        };
    }
    
    /**
     * Display compounding status
     */
    displayCompoundingStatus() {
        const stats = this.getCompoundingStats();
        
        console.log('\n📈 COMPOUNDING TRACKER');
        console.log('═'.repeat(50));
        console.log(`Current Balance: £${stats.currentBalance.toLocaleString()}`);
        console.log(`Start Balance: £${stats.startBalance.toLocaleString()}`);
        console.log(`Total Growth: ${stats.totalGrowthPercent}%`);
        console.log(`Avg Monthly: ${stats.avgMonthlyGrowth}%`);
        
        console.log('\nReinvestment Strategy:');
        console.log(`  Total Reinvested: £${stats.totalReinvested.toFixed(0)}`);
        console.log(`  Total Withdrawn: £${stats.totalWithdrawn.toFixed(0)}`);
        console.log(`  Reinvestment Rate: ${(stats.reinvestmentRatio * 100).toFixed(1)}%`);
        
        if (stats.achievedMilestones.length > 0) {
            console.log('\n✅ Achieved Milestones:');
            stats.achievedMilestones.forEach(m => {
                console.log(`  ${m.name}: £${m.amount.toLocaleString()} (${new Date(m.date).toLocaleDateString()})`);
            });
        }
        
        if (stats.nextMilestone) {
            console.log('\n🎯 Next Milestone:');
            console.log(`  ${stats.nextMilestone.name}: £${stats.nextMilestone.amount.toLocaleString()}`);
            console.log(`  Needed: £${stats.nextMilestone.needed.toFixed(0)}`);
            console.log(`  ETA: ${stats.nextMilestone.monthsToReach} months`);
        }
        
        console.log('\n📊 Projections:');
        if (stats.projectedBalances['3_months']) {
            console.log(`  3 months: £${stats.projectedBalances['3_months'].balance.toLocaleString()} (£${stats.projectedBalances['3_months'].monthlyIncome}/month)`);
        }
        if (stats.projectedBalances['6_months']) {
            console.log(`  6 months: £${stats.projectedBalances['6_months'].balance.toLocaleString()} (£${stats.projectedBalances['6_months'].monthlyIncome}/month)`);
        }
        if (stats.projectedBalances['12_months']) {
            console.log(`  12 months: £${stats.projectedBalances['12_months'].balance.toLocaleString()} (£${stats.projectedBalances['12_months'].monthlyIncome}/month)`);
        }
        
        console.log('═'.repeat(50));
    }
    
    /**
     * Display income status
     */
    displayStatus() {
        const timeToFreedom = this.calculateTimeToFreedom();
        
        console.log('\n💰 INCOME GENERATION STATUS');
        console.log('═'.repeat(50));
        console.log(`Phase: ${this.currentPhase} | Balance: £${this.config.accountBalance.toLocaleString()}`);
        console.log(`Monthly Target: £${this.monthlyIncome.target.toLocaleString()}`);
        console.log(`Current Month: £${this.monthlyIncome.actual.toLocaleString()} (${((this.monthlyIncome.actual / this.monthlyIncome.target) * 100).toFixed(1)}%)`);
        console.log(`Projected: £${this.monthlyIncome.projected.toLocaleString()}`);
        console.log('\nStrategy Allocation:');
        
        for (const [strategy, data] of Object.entries(this.monthlyIncome.strategies)) {
            if (data.allocation > 0) {
                console.log(`  ${strategy}: ${data.allocation.toFixed(0)}% (£${data.expectedReturn.toFixed(0)}/month)`);
            }
        }
        
        console.log('\nPath to Financial Freedom:');
        console.log(`  Time to £100k: ${timeToFreedom.monthsToFreedom} months`);
        console.log(`  Target Date: ${timeToFreedom.targetDate.toLocaleDateString()}`);
        console.log(`  Monthly Income at Target: £${timeToFreedom.monthlyIncomeAtTarget.toFixed(0)}`);
        console.log(`  Status: ${timeToFreedom.achievable ? '✅ ON TRACK' : '⚠️ NEEDS ACCELERATION'}`);
        console.log('═'.repeat(50));
        
        // Also display compounding status
        this.displayCompoundingStatus();
    }
}

// Export
module.exports = { IncomeGenerator };

// Test if run directly
if (require.main === module) {
    const incomeGen = new IncomeGenerator({
        accountBalance: 35000,
        targetMonthlyIncome: 10000,
        monthlyGrowthTarget: 0.12
    });
    
    incomeGen.initialize().then(() => {
        // Display initial status
        incomeGen.displayStatus();
        
        // Show compound growth projection
        console.log('\n📈 8-MONTH PROJECTION:');
        const projections = incomeGen.calculateCompoundGrowth(8);
        
        projections.forEach(p => {
            console.log(`Month ${p.month}: £${p.startBalance.toFixed(0)} → £${p.endBalance.toFixed(0)} (Phase ${p.phase}, Income: £${p.monthlyIncome})`);
        });
        
        // Simulate some trades
        console.log('\n🎯 Simulating trades...');
        
        setTimeout(() => {
            incomeGen.recordTradeIncome({
                strategy: 'FRIDAY_0DTE',
                netPnL: 450
            });
        }, 1000);
        
        setTimeout(() => {
            incomeGen.recordTradeIncome({
                strategy: 'LONG_TERM_112',
                netPnL: 320
            });
        }, 2000);
        
        setTimeout(() => {
            incomeGen.displayStatus();
        }, 3000);
    });
}