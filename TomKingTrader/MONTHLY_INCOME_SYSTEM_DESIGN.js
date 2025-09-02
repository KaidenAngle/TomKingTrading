/**
 * MONTHLY INCOME GENERATION SYSTEM DESIGN
 * Complete implementation specification for Tom King Trading Framework
 * TARGET: Systematic £10,000 monthly income generation
 */

/**
 * 1. MONTHLY INCOME CALCULATOR
 * Core system to calculate exact positions needed for £10k monthly target
 */
class MonthlyIncomeCalculator {
    constructor() {
        // Tom King strategy parameters
        this.strategyParams = {
            '0DTE': {
                winRate: 0.88,
                avgReturn: 0.085,
                tradesPerMonth: 4,
                maxBPPerTrade: 0.10, // 10% max per trade
                incomeContribution: 0.40 // 40% of total income
            },
            'LT112': {
                winRate: 0.73,
                avgReturn: 0.12,
                tradesPerMonth: 1,
                maxBPPerTrade: 0.15, // 15% max per trade
                incomeContribution: 0.35 // 35% of total income
            },
            'STRANGLE': {
                winRate: 0.72,
                avgReturn: 0.15,
                tradesPerMonth: 1,
                maxBPPerTrade: 0.12, // 12% max per trade
                incomeContribution: 0.25 // 25% of total income
            }
        };
    }

    /**
     * Calculate required positions for monthly income target
     */
    calculateRequiredPositions(accountValue, monthlyTarget = 10000) {
        const result = {
            accountValue,
            monthlyTarget,
            strategies: {},
            totalRequiredBP: 0,
            achievable: false,
            recommendedAdjustments: []
        };

        for (const [strategy, params] of Object.entries(this.strategyParams)) {
            const strategyTarget = monthlyTarget * params.incomeContribution;
            
            // Calculate required position size
            const requiredIncomePerTrade = strategyTarget / params.tradesPerMonth;
            const requiredPositionSize = requiredIncomePerTrade / (params.avgReturn * params.winRate);
            
            // Calculate number of contracts needed
            const maxPositionSize = accountValue * params.maxBPPerTrade;
            const actualPositionSize = Math.min(requiredPositionSize, maxPositionSize);
            const actualIncomePerTrade = actualPositionSize * params.avgReturn * params.winRate;
            const actualMonthlyIncome = actualIncomePerTrade * params.tradesPerMonth;
            
            result.strategies[strategy] = {
                targetIncome: strategyTarget,
                requiredPositionSize,
                maxPositionSize,
                actualPositionSize,
                actualIncomePerTrade,
                actualMonthlyIncome,
                contracts: Math.floor(actualPositionSize / this.getContractValue(strategy)),
                shortfall: Math.max(0, strategyTarget - actualMonthlyIncome),
                bpUtilization: (actualPositionSize / accountValue) * 100
            };

            result.totalRequiredBP += actualPositionSize;
        }

        // Assess achievability
        const totalProjectedIncome = Object.values(result.strategies).reduce((sum, s) => sum + s.actualMonthlyIncome, 0);
        result.achievable = totalProjectedIncome >= monthlyTarget * 0.85; // 85% threshold
        result.totalProjectedIncome = totalProjectedIncome;
        result.shortfall = Math.max(0, monthlyTarget - totalProjectedIncome);
        result.totalBPUtilization = (result.totalRequiredBP / accountValue) * 100;

        // Generate recommendations if not achievable
        if (!result.achievable) {
            this.generateRecommendations(result);
        }

        return result;
    }

    /**
     * Get contract value for position sizing
     */
    getContractValue(strategy) {
        const contractValues = {
            '0DTE': 2000,     // £2000 per 0DTE contract
            'LT112': 6000,    // £6000 per LT112 contract
            'STRANGLE': 2500  // £2500 per strangle contract
        };
        return contractValues[strategy] || 1000;
    }

    /**
     * Generate recommendations for achieving target
     */
    generateRecommendations(result) {
        const recs = result.recommendedAdjustments;

        // Account size recommendations
        if (result.shortfall > result.monthlyTarget * 0.5) {
            recs.push({
                type: 'ACCOUNT_SIZE',
                priority: 'HIGH',
                message: `Consider increasing account size to £${Math.ceil((result.accountValue * result.monthlyTarget) / result.totalProjectedIncome / 1000) * 1000}`,
                impact: `Would enable full £${result.monthlyTarget} monthly target`
            });
        }

        // Strategy optimization recommendations
        Object.entries(result.strategies).forEach(([strategy, data]) => {
            if (data.shortfall > 0) {
                recs.push({
                    type: 'STRATEGY_OPTIMIZATION',
                    strategy,
                    priority: 'MEDIUM',
                    message: `${strategy}: Increase position size or trade frequency`,
                    shortfall: data.shortfall,
                    suggestion: `Consider ${Math.ceil(data.contracts * 1.2)} contracts instead of ${data.contracts}`
                });
            }
        });

        // BP utilization recommendations
        if (result.totalBPUtilization > 60) {
            recs.push({
                type: 'RISK_MANAGEMENT',
                priority: 'HIGH',
                message: `BP utilization ${result.totalBPUtilization.toFixed(1)}% exceeds safe limit of 60%`,
                impact: 'Reduce position sizes or target to maintain risk management'
            });
        }
    }

    /**
     * Optimize position sizing for specific strategy
     */
    optimizePositionSizing(strategy, accountValue, target) {
        const params = this.strategyParams[strategy];
        if (!params) return null;

        const optimization = {
            strategy,
            accountValue,
            target,
            optimal: {},
            alternatives: []
        };

        // Calculate optimal sizing
        const requiredPositionSize = target / (params.avgReturn * params.winRate * params.tradesPerMonth);
        const maxSafePositionSize = accountValue * params.maxBPPerTrade;
        const optimalPositionSize = Math.min(requiredPositionSize, maxSafePositionSize);

        optimization.optimal = {
            positionSize: optimalPositionSize,
            contracts: Math.floor(optimalPositionSize / this.getContractValue(strategy)),
            expectedIncome: optimalPositionSize * params.avgReturn * params.winRate * params.tradesPerMonth,
            bpUtilization: (optimalPositionSize / accountValue) * 100,
            achievesTarget: optimalPositionSize >= requiredPositionSize * 0.9
        };

        // Generate alternatives if target not achievable
        if (!optimization.optimal.achievesTarget) {
            for (let multiplier of [1.2, 1.5, 2.0]) {
                const altPositionSize = optimalPositionSize * multiplier;
                if (altPositionSize <= accountValue * 0.25) { // Max 25% allocation
                    optimization.alternatives.push({
                        multiplier,
                        positionSize: altPositionSize,
                        contracts: Math.floor(altPositionSize / this.getContractValue(strategy)),
                        expectedIncome: altPositionSize * params.avgReturn * params.winRate * params.tradesPerMonth,
                        bpUtilization: (altPositionSize / accountValue) * 100,
                        riskIncrease: ((multiplier - 1) * 100).toFixed(0) + '%'
                    });
                }
            }
        }

        return optimization;
    }
}

/**
 * 2. THETA DECAY OPTIMIZATION ENGINE
 * System to maximize theta decay income (core of Tom King methodology)
 */
class ThetaOptimizationEngine {
    constructor() {
        // Theta parameters by strategy
        this.thetaParams = {
            '0DTE': {
                avgDailyTheta: 80,    // £80 daily theta per contract
                decayAcceleration: 3,  // 3x acceleration in final week
                optimalDTE: 0         // Same day expiration
            },
            'LT112': {
                avgDailyTheta: 20,    // £20 daily theta per contract
                decayAcceleration: 2,  // 2x acceleration in final 3 weeks
                optimalDTE: 112       // 16 weeks optimal
            },
            'STRANGLE': {
                avgDailyTheta: 40,    // £40 daily theta per contract
                decayAcceleration: 1.5, // 1.5x acceleration in final month
                optimalDTE: 90        // 90 days optimal
            }
        };
    }

    /**
     * Calculate total portfolio theta decay
     */
    calculateTotalPortfolioTheta(positions) {
        const thetaAnalysis = {
            totalDailyTheta: 0,
            totalMonthlyTheta: 0,
            strategies: {},
            optimization: {
                currentEfficiency: 0,
                potentialIncrease: 0,
                recommendations: []
            }
        };

        for (const position of positions) {
            const strategy = position.strategy;
            const params = this.thetaParams[strategy];
            
            if (params) {
                const positionTheta = this.calculatePositionTheta(position, params);
                
                thetaAnalysis.strategies[strategy] = thetaAnalysis.strategies[strategy] || {
                    positions: 0,
                    dailyTheta: 0,
                    monthlyTheta: 0,
                    efficiency: 0
                };

                thetaAnalysis.strategies[strategy].positions++;
                thetaAnalysis.strategies[strategy].dailyTheta += positionTheta.dailyTheta;
                thetaAnalysis.strategies[strategy].monthlyTheta += positionTheta.monthlyTheta;
                
                thetaAnalysis.totalDailyTheta += positionTheta.dailyTheta;
                thetaAnalysis.totalMonthlyTheta += positionTheta.monthlyTheta;
            }
        }

        // Calculate optimization opportunities
        this.identifyThetaOptimizations(thetaAnalysis);

        return thetaAnalysis;
    }

    /**
     * Calculate theta for individual position
     */
    calculatePositionTheta(position, params) {
        const { dte = params.optimalDTE, contracts = 1 } = position;
        
        // Base theta calculation
        let dailyTheta = params.avgDailyTheta * contracts;
        
        // Time decay acceleration as expiration approaches
        if (dte <= 21) {
            const accelerationFactor = 1 + ((21 - dte) / 21) * (params.decayAcceleration - 1);
            dailyTheta *= accelerationFactor;
        }
        
        // DTE efficiency factor
        const dteEfficiency = this.calculateDTEEfficiency(dte, params.optimalDTE);
        dailyTheta *= dteEfficiency;

        return {
            dailyTheta: Math.round(dailyTheta),
            monthlyTheta: Math.round(dailyTheta * 22), // 22 trading days
            dteEfficiency,
            accelerationActive: dte <= 21
        };
    }

    /**
     * Calculate DTE efficiency factor
     */
    calculateDTEEfficiency(currentDTE, optimalDTE) {
        if (optimalDTE === 0) return 1; // 0DTE is always optimal
        
        const difference = Math.abs(currentDTE - optimalDTE);
        const maxEfficiency = 1.0;
        const minEfficiency = 0.6;
        
        // Efficiency decreases as we move away from optimal DTE
        const efficiencyLoss = (difference / optimalDTE) * (maxEfficiency - minEfficiency);
        return Math.max(minEfficiency, maxEfficiency - efficiencyLoss);
    }

    /**
     * Identify theta optimization opportunities
     */
    identifyThetaOptimizations(thetaAnalysis) {
        const optimization = thetaAnalysis.optimization;
        
        // Calculate current efficiency
        const totalPositions = Object.values(thetaAnalysis.strategies).reduce((sum, s) => sum + s.positions, 0);
        optimization.currentEfficiency = totalPositions > 0 ? 
            (thetaAnalysis.totalDailyTheta / (totalPositions * 50)) * 100 : 0; // Assume £50 average theta potential

        // Identify improvements
        Object.entries(thetaAnalysis.strategies).forEach(([strategy, data]) => {
            if (data.efficiency < 80) {
                optimization.recommendations.push({
                    type: 'EFFICIENCY_IMPROVEMENT',
                    strategy,
                    priority: 'HIGH',
                    message: `${strategy} theta efficiency only ${data.efficiency}% - optimize strikes and DTE`,
                    potentialIncrease: (data.monthlyTheta * 0.3).toFixed(0) // 30% potential increase
                });
            }
        });

        // Monthly theta target recommendations
        const targetMonthlyTheta = 5000; // £5k monthly target from theta
        if (thetaAnalysis.totalMonthlyTheta < targetMonthlyTheta) {
            optimization.recommendations.push({
                type: 'THETA_TARGET',
                priority: 'CRITICAL',
                message: `Monthly theta £${thetaAnalysis.totalMonthlyTheta} below target £${targetMonthlyTheta}`,
                requiredIncrease: targetMonthlyTheta - thetaAnalysis.totalMonthlyTheta,
                suggestion: 'Increase position sizes or add more theta-generating positions'
            });
        }
    }

    /**
     * Optimize strikes for maximum theta
     */
    optimizeStrikesForTheta(strategy, marketData, accountValue) {
        const params = this.thetaParams[strategy];
        if (!params) return null;

        const optimization = {
            strategy,
            currentPrice: marketData.currentPrice,
            recommendations: [],
            expectedTheta: 0
        };

        switch (strategy) {
            case 'STRANGLE':
                // Optimize for 5-delta strikes to maximize theta
                optimization.recommendations.push({
                    type: 'STRIKE_SELECTION',
                    putStrike: Math.round(marketData.currentPrice * 0.85),
                    callStrike: Math.round(marketData.currentPrice * 1.15),
                    expectedTheta: params.avgDailyTheta,
                    reasoning: '5-delta strikes provide optimal theta/gamma balance'
                });
                break;
                
            case 'LT112':
                // Optimize for 10% OTM short strikes
                optimization.recommendations.push({
                    type: 'STRIKE_SELECTION',
                    shortStrike: Math.round(marketData.currentPrice * 0.9),
                    longStrike: Math.round(marketData.currentPrice * 0.85),
                    expectedTheta: params.avgDailyTheta,
                    reasoning: '10% OTM provides optimal theta with acceptable risk'
                });
                break;
                
            case '0DTE':
                // Optimize based on movement and time of day
                const hourlyDecay = this.calculate0DTEHourlyDecay(marketData.timeOfDay);
                optimization.recommendations.push({
                    type: 'STRIKE_SELECTION',
                    strikes: this.optimize0DTEStrikes(marketData),
                    expectedTheta: params.avgDailyTheta * hourlyDecay,
                    reasoning: 'ATM iron condor with rapid time decay'
                });
                break;
        }

        return optimization;
    }

    /**
     * Calculate 0DTE hourly theta decay
     */
    calculate0DTEHourlyDecay(timeOfDay = '11:00') {
        const hour = parseInt(timeOfDay.split(':')[0]);
        const marketClose = 16; // 4 PM close
        const hoursRemaining = Math.max(0, marketClose - hour);
        
        // Exponential decay as expiration approaches
        return Math.max(0.1, Math.pow(2, hoursRemaining - 5)); // Accelerating decay
    }

    /**
     * Optimize 0DTE strikes for maximum theta
     */
    optimize0DTEStrikes(marketData) {
        const atmStrike = Math.round(marketData.currentPrice);
        const width = 30; // Standard width
        
        return {
            putShort: atmStrike - 25,
            putLong: atmStrike - 25 - width,
            callShort: atmStrike + 25,
            callLong: atmStrike + 25 + width,
            maxTheta: true
        };
    }

    /**
     * Maximize theta income for account
     */
    maximizeThetaIncome(accountValue, targetMonthlyTheta = 5000) {
        const maximization = {
            accountValue,
            targetMonthlyTheta,
            strategyAllocation: {},
            totalProjectedTheta: 0,
            achievable: false,
            recommendations: []
        };

        // Allocate across strategies for maximum theta
        const strategies = Object.keys(this.thetaParams);
        const allocationPerStrategy = 1 / strategies.length;

        for (const strategy of strategies) {
            const params = this.thetaParams[strategy];
            const allocation = accountValue * allocationPerStrategy * 0.6; // 60% max allocation
            const contracts = Math.floor(allocation / this.getContractValue(strategy));
            const monthlyTheta = params.avgDailyTheta * contracts * 22; // 22 trading days

            maximization.strategyAllocation[strategy] = {
                allocation,
                contracts,
                dailyTheta: params.avgDailyTheta * contracts,
                monthlyTheta,
                efficiency: this.calculateStrategyThetaEfficiency(strategy)
            };

            maximization.totalProjectedTheta += monthlyTheta;
        }

        maximization.achievable = maximization.totalProjectedTheta >= targetMonthlyTheta * 0.85;

        if (!maximization.achievable) {
            maximization.recommendations.push({
                type: 'THETA_SHORTFALL',
                shortfall: targetMonthlyTheta - maximization.totalProjectedTheta,
                suggestion: 'Increase position sizes or account value to achieve theta target'
            });
        }

        return maximization;
    }

    /**
     * Get contract value for strategy
     */
    getContractValue(strategy) {
        const contractValues = {
            '0DTE': 2000,
            'LT112': 6000,
            'STRANGLE': 2500
        };
        return contractValues[strategy] || 1000;
    }

    /**
     * Calculate strategy theta efficiency
     */
    calculateStrategyThetaEfficiency(strategy) {
        const efficiencyRatings = {
            '0DTE': 0.95,      // 95% - Very efficient theta decay
            'STRANGLE': 0.85,  // 85% - Good theta efficiency
            'LT112': 0.75      // 75% - Moderate theta efficiency
        };
        return efficiencyRatings[strategy] || 0.7;
    }
}

/**
 * 3. MONTHLY PROGRESS TRACKER
 * Real-time tracking of monthly income progress with alerts
 */
class MonthlyProgressTracker {
    constructor() {
        this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        this.monthlyData = new Map();
        this.alerts = [];
    }

    /**
     * Track monthly progress toward target
     */
    trackMonthlyProgress(currentIncome, target = 10000, dayOfMonth = null) {
        const today = new Date();
        const day = dayOfMonth || today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const monthKey = this.currentMonth;

        const progress = {
            month: monthKey,
            currentIncome,
            target,
            progressPercent: (currentIncome / target) * 100,
            dayOfMonth: day,
            daysInMonth,
            daysRemaining: daysInMonth - day,
            onTrack: this.calculateOnTrackStatus(currentIncome, target, day, daysInMonth),
            projectedMonthEnd: this.projectMonthEndIncome(currentIncome, day, daysInMonth),
            alerts: this.calculateProgressAlerts(currentIncome, target, day, daysInMonth)
        };

        // Update monthly data
        this.monthlyData.set(monthKey, progress);
        this.alerts = progress.alerts;

        return progress;
    }

    /**
     * Calculate if on track for target
     */
    calculateOnTrackStatus(currentIncome, target, day, daysInMonth) {
        const expectedProgressPercent = (day / daysInMonth) * 100;
        const actualProgressPercent = (currentIncome / target) * 100;
        const variance = actualProgressPercent - expectedProgressPercent;

        return {
            status: variance >= -10 ? 'ON_TRACK' : variance >= -25 ? 'BEHIND' : 'CRITICAL',
            variance: variance.toFixed(1),
            expectedIncome: (target * day / daysInMonth).toFixed(0),
            shortfall: Math.max(0, (target * day / daysInMonth) - currentIncome)
        };
    }

    /**
     * Project month-end income based on current progress
     */
    projectMonthEndIncome(currentIncome, day, daysInMonth) {
        // Simple linear projection
        const dailyAverage = currentIncome / day;
        const linearProjection = dailyAverage * daysInMonth;

        // Weighted projection considering typical month progression
        const midMonthWeight = day <= 15 ? 0.4 : 0.6; // Stronger patterns later in month
        const weightedProjection = currentIncome + (dailyAverage * (daysInMonth - day) * (1 + midMonthWeight));

        return {
            linear: Math.round(linearProjection),
            weighted: Math.round(weightedProjection),
            confidence: day >= 10 ? 'HIGH' : day >= 5 ? 'MEDIUM' : 'LOW'
        };
    }

    /**
     * Calculate progress alerts
     */
    calculateProgressAlerts(currentIncome, target, day, daysInMonth) {
        const alerts = [];
        const onTrack = this.calculateOnTrackStatus(currentIncome, target, day, daysInMonth);
        const projection = this.projectMonthEndIncome(currentIncome, day, daysInMonth);

        // Critical shortfall alert
        if (onTrack.status === 'CRITICAL') {
            alerts.push({
                type: 'CRITICAL_SHORTFALL',
                priority: 'HIGH',
                message: `Critical: £${onTrack.shortfall} behind expected progress`,
                action: 'Immediate strategy adjustment required',
                urgency: 'IMMEDIATE'
            });
        }

        // Behind track alert
        if (onTrack.status === 'BEHIND') {
            alerts.push({
                type: 'BEHIND_TRACK',
                priority: 'MEDIUM',
                message: `Behind track by £${onTrack.shortfall}`,
                action: 'Consider increasing position sizes',
                urgency: 'THIS_WEEK'
            });
        }

        // Projection alerts
        if (projection.weighted < target * 0.9) {
            alerts.push({
                type: 'PROJECTION_SHORTFALL',
                priority: 'MEDIUM',
                message: `Projected month-end: £${projection.weighted} (${((projection.weighted/target)*100).toFixed(0)}% of target)`,
                action: 'Strategy optimization recommended',
                urgency: 'THIS_WEEK'
            });
        }

        // Positive alerts
        if (onTrack.status === 'ON_TRACK' && projection.weighted >= target) {
            alerts.push({
                type: 'ON_TRACK',
                priority: 'INFO',
                message: `On track: Projected month-end £${projection.weighted}`,
                action: 'Continue current strategy',
                urgency: 'NONE'
            });
        }

        return alerts;
    }

    /**
     * Recommend adjustments based on shortfall
     */
    recommendAdjustments(shortfall, daysRemaining, currentPositions) {
        const adjustments = [];
        const dailyNeeded = shortfall / Math.max(1, daysRemaining);

        // Position size increases
        if (shortfall > 0) {
            adjustments.push({
                type: 'POSITION_INCREASE',
                description: `Increase position sizes by ${((shortfall / 5000) * 100).toFixed(0)}%`,
                impact: `Additional £${dailyNeeded.toFixed(0)} daily needed`,
                riskIncrease: 'MODERATE'
            });

            // Strategy frequency increases
            adjustments.push({
                type: 'FREQUENCY_INCREASE',
                description: 'Consider additional 0DTE opportunities',
                impact: `Could add £${(dailyNeeded * 0.5).toFixed(0)} daily`,
                riskIncrease: 'LOW'
            });

            // New strategy deployment
            if (shortfall > 3000) {
                adjustments.push({
                    type: 'STRATEGY_ADDITION',
                    description: 'Deploy additional theta-generating strategies',
                    impact: `Could add £${(shortfall * 0.3).toFixed(0)} monthly`,
                    riskIncrease: 'MODERATE'
                });
            }
        }

        return adjustments;
    }

    /**
     * Generate monthly report
     */
    generateMonthlyReport(month = this.currentMonth) {
        const data = this.monthlyData.get(month);
        if (!data) return null;

        return {
            month,
            summary: {
                finalIncome: data.currentIncome,
                target: data.target,
                achievementPercent: (data.currentIncome / data.target * 100).toFixed(1),
                status: data.currentIncome >= data.target ? 'SUCCESS' : 'SHORTFALL'
            },
            dailyBreakdown: this.calculateDailyBreakdown(data),
            strategyContribution: this.calculateStrategyContribution(data),
            lessonsLearned: this.generateLessonsLearned(data),
            nextMonthRecommendations: this.generateNextMonthRecommendations(data)
        };
    }

    /**
     * Calculate daily breakdown
     */
    calculateDailyBreakdown(data) {
        const dailyAverage = data.currentIncome / data.dayOfMonth;
        const targetDaily = data.target / data.daysInMonth;

        return {
            actualDailyAverage: dailyAverage.toFixed(0),
            targetDailyAverage: targetDaily.toFixed(0),
            variance: (dailyAverage - targetDaily).toFixed(0),
            bestDay: 'Data needed', // Would track individual days
            worstDay: 'Data needed'
        };
    }

    /**
     * Calculate strategy contribution
     */
    calculateStrategyContribution(data) {
        // This would integrate with actual position data
        return {
            '0DTE': { amount: 0, percent: 0 },
            'LT112': { amount: 0, percent: 0 },
            'STRANGLE': { amount: 0, percent: 0 }
        };
    }

    /**
     * Generate lessons learned
     */
    generateLessonsLearned(data) {
        const lessons = [];

        if (data.onTrack.status === 'CRITICAL') {
            lessons.push('Early month performance is critical - front-load profitable strategies');
        }

        if (data.progressPercent > 100) {
            lessons.push('Exceeded target - current strategy mix is effective');
        }

        return lessons;
    }

    /**
     * Generate next month recommendations
     */
    generateNextMonthRecommendations(data) {
        const recommendations = [];

        if (data.currentIncome < data.target) {
            recommendations.push('Increase position sizes by 20%');
            recommendations.push('Add mid-month strategy deployment');
        } else {
            recommendations.push('Maintain current allocation');
            recommendations.push('Consider profit-taking strategies');
        }

        return recommendations;
    }
}

/**
 * 4. STRATEGY INCOME ALLOCATOR
 * System to allocate income targets per Tom King distribution
 */
class StrategyIncomeAllocator {
    constructor() {
        this.targetDistribution = {
            '0DTE': 0.40,      // 40% from 0DTE Friday
            'LT112': 0.35,     // 35% from Long-Term 112
            'STRANGLE': 0.25   // 25% from Strangles
        };

        this.strategyCapabilities = {
            '0DTE': { maxMonthlyTrades: 4, avgReturnPerTrade: 0.085 },
            'LT112': { maxMonthlyTrades: 1, avgReturnPerTrade: 0.12 },
            'STRANGLE': { maxMonthlyTrades: 1, avgReturnPerTrade: 0.15 }
        };
    }

    /**
     * Allocate income targets across strategies
     */
    allocateIncomeTargets(totalTarget = 10000) {
        const allocation = {
            totalTarget,
            strategies: {},
            totalAllocated: 0,
            feasible: true,
            adjustments: []
        };

        for (const [strategy, percent] of Object.entries(this.targetDistribution)) {
            const targetAmount = totalTarget * percent;
            
            allocation.strategies[strategy] = {
                targetAmount,
                targetPercent: percent * 100,
                allocated: targetAmount,
                feasible: this.assessStrategyFeasibility(strategy, targetAmount)
            };

            allocation.totalAllocated += targetAmount;
        }

        // Assess overall feasibility
        const infeasibleStrategies = Object.values(allocation.strategies).filter(s => !s.feasible);
        allocation.feasible = infeasibleStrategies.length === 0;

        if (!allocation.feasible) {
            allocation.adjustments = this.generateAllocationAdjustments(allocation.strategies);
        }

        return allocation;
    }

    /**
     * Assess if strategy can achieve target
     */
    assessStrategyFeasibility(strategy, targetAmount) {
        const capability = this.strategyCapabilities[strategy];
        if (!capability) return false;

        // Rough feasibility check
        const maxCapacity = capability.maxMonthlyTrades * capability.avgReturnPerTrade * 50000; // Assume £50k max position
        return targetAmount <= maxCapacity;
    }

    /**
     * Generate allocation adjustments
     */
    generateAllocationAdjustments(strategies) {
        const adjustments = [];

        Object.entries(strategies).forEach(([strategy, data]) => {
            if (!data.feasible) {
                adjustments.push({
                    strategy,
                    type: 'REDUCE_TARGET',
                    message: `${strategy} target £${data.targetAmount} may be too high`,
                    suggestion: 'Redistribute to other strategies or increase account size'
                });
            }
        });

        return adjustments;
    }

    /**
     * Balance strategy allocation based on current positions
     */
    balanceStrategyAllocation(currentPositions, monthlyTarget = 10000) {
        const current = this.calculateCurrentAllocation(currentPositions);
        const target = this.allocateIncomeTargets(monthlyTarget);
        
        const rebalancing = {
            current,
            target: target.strategies,
            rebalanceNeeded: false,
            adjustments: []
        };

        // Calculate variances
        Object.keys(this.targetDistribution).forEach(strategy => {
            const currentPercent = current[strategy]?.percent || 0;
            const targetPercent = target.strategies[strategy].targetPercent;
            const variance = Math.abs(currentPercent - targetPercent);

            if (variance > 10) { // 10% tolerance
                rebalancing.rebalanceNeeded = true;
                rebalancing.adjustments.push({
                    strategy,
                    currentPercent,
                    targetPercent,
                    variance,
                    action: currentPercent < targetPercent ? 'INCREASE' : 'DECREASE',
                    priority: variance > 20 ? 'HIGH' : 'MEDIUM'
                });
            }
        });

        return rebalancing;
    }

    /**
     * Calculate current allocation from positions
     */
    calculateCurrentAllocation(positions) {
        const allocation = {};
        let totalValue = 0;

        positions.forEach(position => {
            const strategy = position.strategy;
            const value = position.value || 0;

            if (!allocation[strategy]) {
                allocation[strategy] = { value: 0, percent: 0, positions: 0 };
            }

            allocation[strategy].value += value;
            allocation[strategy].positions++;
            totalValue += value;
        });

        // Calculate percentages
        Object.keys(allocation).forEach(strategy => {
            allocation[strategy].percent = totalValue > 0 ? 
                (allocation[strategy].value / totalValue) * 100 : 0;
        });

        return allocation;
    }

    /**
     * Enforce distribution requirements
     */
    enforceDistribution(currentAllocation, targetDistribution = this.targetDistribution) {
        const enforcement = {
            compliant: true,
            violations: [],
            requiredActions: []
        };

        Object.entries(targetDistribution).forEach(([strategy, targetPercent]) => {
            const currentPercent = (currentAllocation[strategy]?.percent || 0) / 100;
            const variance = Math.abs(currentPercent - targetPercent);

            if (variance > 0.15) { // 15% tolerance
                enforcement.compliant = false;
                enforcement.violations.push({
                    strategy,
                    currentPercent: (currentPercent * 100).toFixed(1),
                    targetPercent: (targetPercent * 100).toFixed(1),
                    variance: (variance * 100).toFixed(1),
                    severity: variance > 0.25 ? 'HIGH' : 'MEDIUM'
                });

                // Generate required actions
                const action = currentPercent < targetPercent ? 'ADD' : 'REDUCE';
                const amount = Math.abs(currentPercent - targetPercent) * 100;
                
                enforcement.requiredActions.push({
                    strategy,
                    action,
                    amount: amount.toFixed(1) + '%',
                    urgency: variance > 0.25 ? 'IMMEDIATE' : 'THIS_WEEK'
                });
            }
        });

        return enforcement;
    }
}

// Export all classes
module.exports = {
    MonthlyIncomeCalculator,
    ThetaOptimizationEngine,
    MonthlyProgressTracker,
    StrategyIncomeAllocator
};

// Usage example and test
if (require.main === module) {
    console.log('🎯 MONTHLY INCOME GENERATION SYSTEM DESIGN');
    console.log('===========================================');
    console.log('');
    console.log('✅ MonthlyIncomeCalculator - Core position calculation system');
    console.log('✅ ThetaOptimizationEngine - Maximize theta decay income');
    console.log('✅ MonthlyProgressTracker - Real-time progress monitoring');
    console.log('✅ StrategyIncomeAllocator - Enforce Tom King distribution');
    console.log('');
    console.log('🚀 Ready for implementation in Tom King Trading Framework v17');
    console.log('📊 Estimated implementation time: 88 hours (11 days)');
    console.log('💰 Target: Systematic £10,000 monthly income generation');
}