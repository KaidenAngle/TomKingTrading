/**
 * Strategy Income Allocator
 * Distributes monthly income targets across Tom King trading strategies
 * Based on win rates, capacity, and market conditions
 */

const { getLogger } = require('./logger');
const { MonthlyIncomeCalculator } = require('./monthlyIncomeCalculator');
const { ThetaOptimizationEngine } = require('./thetaOptimizationEngine');

class StrategyIncomeAllocator {
    constructor(options = {}) {
        this.logger = getLogger();
        this.monthlyIncomeCalc = new MonthlyIncomeCalculator();
        this.thetaOptimizer = new ThetaOptimizationEngine();
        
        this.config = {
            // Tom King strategy allocation percentages
            baseAllocation: {
                '0DTE': 0.40,    // 40% - Friday 0DTE (highest win rate)
                'LT112': 0.35,   // 35% - Long-term 112 
                'STRANGLE': 0.25 // 25% - Futures strangles
            },
            
            // Win rates from Tom King's historical data
            winRates: {
                '0DTE': 0.88,    // 88% win rate
                'LT112': 0.73,   // 73% win rate
                'STRANGLE': 0.72 // 72% win rate
            },
            
            // Average income per winning trade
            avgIncomePerWin: {
                '0DTE': 50,      // £50 per winning 0DTE
                'LT112': 150,    // £150 per winning LT112
                'STRANGLE': 120  // £120 per winning strangle
            },
            
            // Maximum capacity constraints
            maxPositions: {
                '0DTE': 10,      // Max 10 0DTE positions on Friday
                'LT112': 8,      // Max 8 LT112 positions
                'STRANGLE': 12   // Max 12 strangle positions
            },
            
            // Buying power allocation limits
            bpLimits: {
                '0DTE': 0.20,    // Max 20% BP for 0DTE
                'LT112': 0.30,   // Max 30% BP for LT112
                'STRANGLE': 0.25 // Max 25% BP for strangles
            },
            
            // VIX-based adjustments
            vixAdjustments: {
                low: { threshold: 15, multiplier: 1.2 },
                normal: { threshold: 25, multiplier: 1.0 },
                high: { threshold: 35, multiplier: 0.8 },
                extreme: { threshold: 50, multiplier: 0.5 }
            }
        };
        
        this.logger.info('ALLOCATOR', 'Strategy Income Allocator initialized', {
            baseAllocation: this.config.baseAllocation
        });
    }
    
    /**
     * Allocate monthly income target across strategies
     */
    allocateMonthlyIncome(accountValue, monthlyTarget, vixLevel = 20, currentPositions = []) {
        try {
            this.logger.info('ALLOCATOR', 'Allocating monthly income target', {
                accountValue,
                monthlyTarget,
                vixLevel
            });
            
            // Get VIX-adjusted allocations
            const adjustedAllocations = this.adjustAllocationsForVIX(vixLevel);
            
            // Calculate income targets per strategy
            const strategyTargets = this.calculateStrategyTargets(monthlyTarget, adjustedAllocations);
            
            // Check feasibility for each strategy
            const feasibility = this.checkStrategyFeasibility(accountValue, strategyTargets);
            
            // Optimize allocations if needed
            const optimizedAllocations = this.optimizeAllocations(
                accountValue,
                monthlyTarget,
                strategyTargets,
                feasibility
            );
            
            // Calculate required positions
            const requiredPositions = this.calculateRequiredPositions(optimizedAllocations);
            
            // Generate final allocation plan
            const allocationPlan = this.generateAllocationPlan(
                accountValue,
                monthlyTarget,
                optimizedAllocations,
                requiredPositions
            );
            
            this.logger.info('ALLOCATOR', 'Allocation plan generated', {
                totalTarget: monthlyTarget,
                strategies: Object.keys(allocationPlan.strategies).length
            });
            
            return allocationPlan;
            
        } catch (error) {
            this.logger.error('ALLOCATOR', 'Error allocating monthly income', error);
            throw error;
        }
    }
    
    /**
     * Adjust allocations based on VIX level
     */
    adjustAllocationsForVIX(vixLevel) {
        const baseAllocation = { ...this.config.baseAllocation };
        let vixMultiplier = 1.0;
        
        // Determine VIX regime
        if (vixLevel < this.config.vixAdjustments.low.threshold) {
            vixMultiplier = this.config.vixAdjustments.low.multiplier;
            // In low VIX, favor 0DTE and LT112
            baseAllocation['0DTE'] *= 1.1;
            baseAllocation['LT112'] *= 1.05;
            baseAllocation['STRANGLE'] *= 0.85;
        } else if (vixLevel > this.config.vixAdjustments.extreme.threshold) {
            vixMultiplier = this.config.vixAdjustments.extreme.multiplier;
            // In extreme VIX, reduce all allocations
            Object.keys(baseAllocation).forEach(strategy => {
                baseAllocation[strategy] *= vixMultiplier;
            });
        } else if (vixLevel > this.config.vixAdjustments.high.threshold) {
            vixMultiplier = this.config.vixAdjustments.high.multiplier;
            // In high VIX, favor strangles
            baseAllocation['0DTE'] *= 0.9;
            baseAllocation['LT112'] *= 0.95;
            baseAllocation['STRANGLE'] *= 1.15;
        }
        
        // Normalize allocations to sum to 1
        const total = Object.values(baseAllocation).reduce((sum, val) => sum + val, 0);
        Object.keys(baseAllocation).forEach(strategy => {
            baseAllocation[strategy] /= total;
        });
        
        return baseAllocation;
    }
    
    /**
     * Calculate income targets per strategy
     */
    calculateStrategyTargets(monthlyTarget, allocations) {
        const targets = {};
        
        Object.keys(allocations).forEach(strategy => {
            targets[strategy] = {
                targetIncome: monthlyTarget * allocations[strategy],
                allocation: allocations[strategy],
                winRate: this.config.winRates[strategy],
                avgWin: this.config.avgIncomePerWin[strategy]
            };
        });
        
        return targets;
    }
    
    /**
     * Check feasibility for each strategy
     */
    checkStrategyFeasibility(accountValue, strategyTargets) {
        const feasibility = {};
        
        Object.keys(strategyTargets).forEach(strategy => {
            const target = strategyTargets[strategy];
            const requiredWins = Math.ceil(target.targetIncome / target.avgWin);
            const requiredTrades = Math.ceil(requiredWins / target.winRate);
            const maxPositions = this.config.maxPositions[strategy];
            const bpLimit = accountValue * this.config.bpLimits[strategy];
            
            feasibility[strategy] = {
                feasible: requiredTrades <= maxPositions,
                requiredTrades,
                maxPositions,
                utilization: requiredTrades / maxPositions,
                bpRequired: requiredTrades * (bpLimit / maxPositions),
                bpLimit
            };
        });
        
        return feasibility;
    }
    
    /**
     * Optimize allocations if original plan isn't feasible
     */
    optimizeAllocations(accountValue, monthlyTarget, strategyTargets, feasibility) {
        const optimized = { ...strategyTargets };
        
        // Check if any strategy is over capacity
        const overCapacity = Object.keys(feasibility).filter(s => !feasibility[s].feasible);
        
        if (overCapacity.length > 0) {
            // Redistribute excess to other strategies
            overCapacity.forEach(strategy => {
                const excess = optimized[strategy].targetIncome * 
                    (1 - 1/feasibility[strategy].utilization);
                
                // Cap this strategy at maximum capacity
                optimized[strategy].targetIncome *= (1/feasibility[strategy].utilization);
                
                // Redistribute excess to other strategies proportionally
                const otherStrategies = Object.keys(optimized).filter(s => s !== strategy);
                const totalOtherAllocation = otherStrategies.reduce(
                    (sum, s) => sum + optimized[s].allocation, 0
                );
                
                otherStrategies.forEach(s => {
                    const share = optimized[s].allocation / totalOtherAllocation;
                    optimized[s].targetIncome += excess * share;
                });
            });
        }
        
        return optimized;
    }
    
    /**
     * Calculate required positions for each strategy
     */
    calculateRequiredPositions(allocations) {
        const positions = {};
        
        Object.keys(allocations).forEach(strategy => {
            const allocation = allocations[strategy];
            const requiredWins = Math.ceil(allocation.targetIncome / allocation.avgWin);
            const requiredTrades = Math.ceil(requiredWins / allocation.winRate);
            
            positions[strategy] = {
                requiredTrades,
                expectedWins: Math.floor(requiredTrades * allocation.winRate),
                expectedIncome: Math.floor(requiredTrades * allocation.winRate * allocation.avgWin),
                confidenceLevel: this.calculateConfidence(requiredTrades, allocation.winRate)
            };
        });
        
        return positions;
    }
    
    /**
     * Calculate confidence level for achieving target
     */
    calculateConfidence(trades, winRate) {
        // Simplified binomial confidence calculation
        const variance = trades * winRate * (1 - winRate);
        const stdDev = Math.sqrt(variance);
        const expectedWins = trades * winRate;
        
        // 1 standard deviation confidence
        if (expectedWins - stdDev > trades * 0.5) {
            return 'HIGH';
        } else if (expectedWins > trades * 0.5) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }
    
    /**
     * Generate final allocation plan
     */
    generateAllocationPlan(accountValue, monthlyTarget, allocations, positions) {
        const totalExpectedIncome = Object.values(positions).reduce(
            (sum, p) => sum + p.expectedIncome, 0
        );
        
        const plan = {
            accountValue,
            monthlyTarget,
            totalExpectedIncome,
            achievability: (totalExpectedIncome / monthlyTarget * 100).toFixed(1) + '%',
            strategies: {}
        };
        
        Object.keys(allocations).forEach(strategy => {
            plan.strategies[strategy] = {
                targetIncome: allocations[strategy].targetIncome,
                allocation: (allocations[strategy].allocation * 100).toFixed(1) + '%',
                requiredTrades: positions[strategy].requiredTrades,
                expectedWins: positions[strategy].expectedWins,
                expectedIncome: positions[strategy].expectedIncome,
                confidence: positions[strategy].confidenceLevel,
                winRate: (this.config.winRates[strategy] * 100).toFixed(0) + '%'
            };
        });
        
        // Add summary recommendations
        plan.recommendations = this.generateRecommendations(plan);
        
        return plan;
    }
    
    /**
     * Generate recommendations based on allocation plan
     */
    generateRecommendations(plan) {
        const recommendations = [];
        
        // Check overall achievability
        const achievability = parseFloat(plan.achievability);
        if (achievability < 90) {
            recommendations.push({
                type: 'WARNING',
                message: `Target may be difficult to achieve (${plan.achievability} expected)`
            });
        }
        
        // Check individual strategy confidence
        Object.keys(plan.strategies).forEach(strategy => {
            const strategyPlan = plan.strategies[strategy];
            if (strategyPlan.confidence === 'LOW') {
                recommendations.push({
                    type: 'CAUTION',
                    message: `${strategy} has low confidence - consider reducing allocation`
                });
            }
        });
        
        // Add positive recommendations
        if (achievability >= 100) {
            recommendations.push({
                type: 'SUCCESS',
                message: 'Income target is achievable with current allocation'
            });
        }
        
        // Friday 0DTE reminder
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 4) { // Thursday
            recommendations.push({
                type: 'INFO',
                message: 'Tomorrow is Friday - prepare for 0DTE trades'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Dynamic reallocation based on performance
     */
    reallocateBasedOnPerformance(currentPerformance, remainingDays, remainingTarget) {
        const adjustedAllocations = { ...this.config.baseAllocation };
        
        // Analyze performance by strategy
        Object.keys(currentPerformance).forEach(strategy => {
            const perf = currentPerformance[strategy];
            const actualWinRate = perf.wins / (perf.wins + perf.losses);
            const expectedWinRate = this.config.winRates[strategy];
            
            // Adjust allocation based on performance
            if (actualWinRate > expectedWinRate * 1.1) {
                // Outperforming - increase allocation
                adjustedAllocations[strategy] *= 1.15;
            } else if (actualWinRate < expectedWinRate * 0.9) {
                // Underperforming - decrease allocation
                adjustedAllocations[strategy] *= 0.85;
            }
        });
        
        // Normalize and return
        const total = Object.values(adjustedAllocations).reduce((sum, val) => sum + val, 0);
        Object.keys(adjustedAllocations).forEach(strategy => {
            adjustedAllocations[strategy] /= total;
        });
        
        return this.allocateMonthlyIncome(
            currentPerformance.accountValue,
            remainingTarget,
            currentPerformance.vixLevel
        );
    }
}

module.exports = { StrategyIncomeAllocator };