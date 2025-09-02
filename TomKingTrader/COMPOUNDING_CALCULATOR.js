/**
 * COMPOUNDING CALCULATOR - Core 12% Monthly Compounding System
 * Mathematical foundation for £35k→£80k transformation in 8 months
 * 
 * This is the missing mathematical foundation identified by the compounding system test.
 * Implements precise compound interest calculations with position sizing for growth targets.
 */

class CompoundingCalculator {
    constructor(options = {}) {
        this.startingCapital = options.startingCapital || 35000;
        this.monthlyGrowthRate = options.monthlyGrowthRate || 0.12; // 12% monthly
        this.targetMonths = options.targetMonths || 8;
        this.currentMonth = options.currentMonth || 0;
        
        // Pre-calculated monthly targets for performance
        this.monthlyTargets = this.precalculateTargets();
        
        console.log('🧮 Compounding Calculator Initialized');
        console.log(`Starting Capital: £${this.startingCapital.toLocaleString()}`);
        console.log(`Monthly Growth Rate: ${(this.monthlyGrowthRate * 100)}%`);
        console.log(`Target Timeline: ${this.targetMonths} months`);
    }

    /**
     * Pre-calculate all monthly targets for the 8-month journey
     */
    precalculateTargets() {
        const targets = new Map();
        let amount = this.startingCapital;

        targets.set(0, {
            target: amount,
            growth: 0,
            growthAmount: 0,
            multiplier: 1.0,
            phase: 1
        });

        for (let month = 1; month <= this.targetMonths; month++) {
            const newAmount = amount * (1 + this.monthlyGrowthRate);
            const growthAmount = newAmount - amount;
            const multiplier = Math.pow(1 + this.monthlyGrowthRate, month);
            
            // Determine phase based on compound targets
            let phase = 1;
            if (newAmount >= 43904) phase = 2; // Month 2+
            if (newAmount >= 61682) phase = 3; // Month 5+
            if (newAmount >= 80000) phase = 4; // Target reached

            targets.set(month, {
                target: Math.round(newAmount),
                growth: this.monthlyGrowthRate,
                growthAmount: Math.round(growthAmount),
                multiplier: parseFloat(multiplier.toFixed(3)),
                phase
            });

            amount = newAmount;
        }

        return targets;
    }

    /**
     * Get target amount for specific month
     */
    getMonthlyTarget(month) {
        return this.monthlyTargets.get(month) || null;
    }

    /**
     * Calculate exact position sizing needed for monthly growth target
     */
    calculatePositionSizingForGrowth(currentBalance, targetMonth = null) {
        const month = targetMonth || (this.currentMonth + 1);
        const target = this.getMonthlyTarget(month);
        
        if (!target) {
            throw new Error(`Invalid month: ${month}. Must be 0-${this.targetMonths}`);
        }

        const requiredGrowth = target.target - currentBalance;
        const requiredGrowthPercent = (requiredGrowth / currentBalance) * 100;

        // Tom King strategy parameters with realistic win rates
        const strategies = {
            '0DTE': {
                winRate: 0.88,
                avgReturn: 0.085,
                tradesPerMonth: 4,
                maxBP: 40,
                description: 'Friday Zero DTE after 10:30 AM'
            },
            'LT112': {
                winRate: 0.73,
                avgReturn: 0.12,
                tradesPerMonth: 1,
                maxBP: 50,
                description: 'Long Term 112 DTE strategy'
            },
            'STRANGLE': {
                winRate: 0.72,
                avgReturn: 0.15,
                tradesPerMonth: 1,
                maxBP: 35,
                description: 'Futures strangles 90 DTE'
            },
            'IPMCC': {
                winRate: 0.75,
                avgReturn: 0.08,
                tradesPerMonth: 2,
                maxBP: 30,
                description: 'Poor Man Covered Calls'
            }
        };

        const positionSizing = {};
        let totalFeasibleGrowth = 0;

        // Calculate position sizing for each strategy
        for (const [strategy, params] of Object.entries(strategies)) {
            const expectedReturn = params.avgReturn * params.winRate;
            const requiredPositionSize = requiredGrowth / (params.tradesPerMonth * expectedReturn);
            const bpRequired = (requiredPositionSize / currentBalance) * 100;
            const feasible = bpRequired <= params.maxBP && bpRequired >= 5;
            const projectedGrowth = params.tradesPerMonth * expectedReturn * Math.min(requiredPositionSize, currentBalance * params.maxBP / 100);

            positionSizing[strategy] = {
                requiredPosition: Math.round(requiredPositionSize),
                maxPosition: Math.round(currentBalance * params.maxBP / 100),
                recommendedPosition: Math.round(Math.min(requiredPositionSize, currentBalance * params.maxBP / 100)),
                bpRequired: Math.round(bpRequired * 10) / 10,
                maxBP: params.maxBP,
                feasible,
                projectedGrowth: Math.round(projectedGrowth),
                shortfall: feasible ? 0 : Math.round(requiredGrowth - projectedGrowth),
                efficiency: feasible ? 100 : Math.round((projectedGrowth / requiredGrowth) * 100)
            };

            if (feasible) {
                totalFeasibleGrowth += projectedGrowth;
            }
        }

        // Strategy combination recommendations
        const combinations = this.calculateStrategyCombinations(currentBalance, requiredGrowth, strategies);

        return {
            currentBalance,
            targetMonth: month,
            targetBalance: target.target,
            requiredGrowth,
            requiredGrowthPercent: Math.round(requiredGrowthPercent * 10) / 10,
            positionSizing,
            combinations,
            achievable: totalFeasibleGrowth >= requiredGrowth * 0.85,
            shortfall: Math.max(0, requiredGrowth - totalFeasibleGrowth),
            riskLevel: this.assessRiskLevel(requiredGrowthPercent, month)
        };
    }

    /**
     * Calculate optimal strategy combinations for growth target
     */
    calculateStrategyCombinations(currentBalance, requiredGrowth, strategies) {
        const combinations = [];

        // Combination 1: 0DTE + LT112 (Tom King's preference)
        const zdteReturn = strategies['0DTE'].tradesPerMonth * strategies['0DTE'].avgReturn * strategies['0DTE'].winRate;
        const lt112Return = strategies['LT112'].tradesPerMonth * strategies['LT112'].avgReturn * strategies['LT112'].winRate;
        
        const zdteSize = currentBalance * 0.25; // 25% allocation
        const lt112Size = currentBalance * 0.30; // 30% allocation
        const combo1Growth = (zdteSize * zdteReturn) + (lt112Size * lt112Return);

        combinations.push({
            name: 'Tom King Core (0DTE + LT112)',
            strategies: ['0DTE', 'LT112'],
            allocations: { '0DTE': 25, 'LT112': 30 },
            totalBP: 55,
            projectedGrowth: Math.round(combo1Growth),
            efficiency: Math.round((combo1Growth / requiredGrowth) * 100),
            achievable: combo1Growth >= requiredGrowth * 0.85,
            riskLevel: 'MODERATE'
        });

        // Combination 2: All strategies balanced
        const balancedGrowth = 
            (currentBalance * 0.20 * zdteReturn) +
            (currentBalance * 0.25 * lt112Return) +
            (currentBalance * 0.20 * strategies['STRANGLE'].tradesPerMonth * strategies['STRANGLE'].avgReturn * strategies['STRANGLE'].winRate) +
            (currentBalance * 0.15 * strategies['IPMCC'].tradesPerMonth * strategies['IPMCC'].avgReturn * strategies['IPMCC'].winRate);

        combinations.push({
            name: 'Balanced Portfolio',
            strategies: ['0DTE', 'LT112', 'STRANGLE', 'IPMCC'],
            allocations: { '0DTE': 20, 'LT112': 25, 'STRANGLE': 20, 'IPMCC': 15 },
            totalBP: 80,
            projectedGrowth: Math.round(balancedGrowth),
            efficiency: Math.round((balancedGrowth / requiredGrowth) * 100),
            achievable: balancedGrowth >= requiredGrowth * 0.85,
            riskLevel: 'HIGH'
        });

        // Combination 3: Conservative approach
        const conservativeGrowth = 
            (currentBalance * 0.15 * zdteReturn) +
            (currentBalance * 0.20 * lt112Return);

        combinations.push({
            name: 'Conservative Growth',
            strategies: ['0DTE', 'LT112'],
            allocations: { '0DTE': 15, 'LT112': 20 },
            totalBP: 35,
            projectedGrowth: Math.round(conservativeGrowth),
            efficiency: Math.round((conservativeGrowth / requiredGrowth) * 100),
            achievable: conservativeGrowth >= requiredGrowth * 0.85,
            riskLevel: 'LOW'
        });

        return combinations.sort((a, b) => b.efficiency - a.efficiency);
    }

    /**
     * Track progress toward compounding targets
     */
    trackCompoundingProgress(currentBalance, currentMonth = null) {
        const month = currentMonth || this.currentMonth;
        const target = this.getMonthlyTarget(month);
        
        if (!target) return null;

        const progress = (currentBalance / target.target) * 100;
        const isOnTrack = progress >= 85; // 85% threshold
        const nextTarget = this.getMonthlyTarget(month + 1);
        
        const daysInMonth = 30; // Approximate
        const currentDay = new Date().getDate();
        const monthProgress = (currentDay / daysInMonth) * 100;
        
        const expectedProgress = monthProgress;
        const progressDelta = progress - expectedProgress;

        return {
            currentMonth: month,
            currentBalance,
            targetBalance: target.target,
            progress: Math.round(progress * 10) / 10,
            isOnTrack,
            progressDelta: Math.round(progressDelta * 10) / 10,
            monthProgress: Math.round(monthProgress),
            nextTarget: nextTarget ? nextTarget.target : null,
            requiredGrowth: nextTarget ? nextTarget.target - currentBalance : 0,
            phase: target.phase,
            daysRemaining: daysInMonth - currentDay,
            projectedEndOfMonth: this.projectEndOfMonth(currentBalance, currentDay, daysInMonth),
            alerts: this.generateProgressAlerts(progress, progressDelta, month)
        };
    }

    /**
     * Project end-of-month balance based on current progress
     */
    projectEndOfMonth(currentBalance, currentDay, daysInMonth) {
        if (currentDay <= 1) return currentBalance; // Not enough data

        const daysElapsed = currentDay;
        const remainingDays = daysInMonth - currentDay;
        
        // Assume linear growth approximation (could be enhanced with historical patterns)
        const dailyGrowthRate = 0.12 / daysInMonth; // 12% monthly spread over days
        const projectedBalance = currentBalance * Math.pow(1 + dailyGrowthRate, remainingDays);
        
        return Math.round(projectedBalance);
    }

    /**
     * Generate alerts based on compounding progress
     */
    generateProgressAlerts(progress, progressDelta, month) {
        const alerts = [];

        if (progress < 70) {
            alerts.push({
                type: 'CRITICAL',
                message: `Severely behind compounding target (${progress.toFixed(1)}%)`,
                action: 'Consider increasing position sizes or adding strategies'
            });
        } else if (progress < 85) {
            alerts.push({
                type: 'WARNING',
                message: `Behind compounding schedule (${progress.toFixed(1)}%)`,
                action: 'Review strategy allocation and execution'
            });
        } else if (progress > 115) {
            alerts.push({
                type: 'SUCCESS',
                message: `Ahead of compounding schedule (${progress.toFixed(1)}%)`,
                action: 'Consider reducing risk or taking profits'
            });
        }

        if (progressDelta < -20 && month > 1) {
            alerts.push({
                type: 'URGENT',
                message: `Falling behind rapidly (${progressDelta.toFixed(1)}% vs expected)`,
                action: 'Emergency strategy review required'
            });
        }

        return alerts;
    }

    /**
     * Assess risk level for required growth rate
     */
    assessRiskLevel(requiredGrowthPercent, month) {
        if (requiredGrowthPercent <= 8) return 'LOW';
        if (requiredGrowthPercent <= 12) return 'MODERATE';
        if (requiredGrowthPercent <= 18) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Calculate VIX-adjusted growth targets
     */
    calculateVIXAdjustedTargets(vixLevel) {
        let adjustmentFactor = 1.0;
        
        // Adjust targets based on VIX regime
        if (vixLevel < 12) {
            adjustmentFactor = 0.8; // Reduce targets in low VIX (complacency risk)
        } else if (vixLevel <= 16) {
            adjustmentFactor = 1.0; // Normal targets
        } else if (vixLevel <= 20) {
            adjustmentFactor = 1.1; // Slightly higher targets (rich premiums)
        } else if (vixLevel <= 25) {
            adjustmentFactor = 0.9; // Reduce size but maintain targets
        } else {
            adjustmentFactor = 0.7; // Defensive mode during high VIX
        }

        const adjustedTargets = new Map();
        for (const [month, target] of this.monthlyTargets) {
            adjustedTargets.set(month, {
                ...target,
                adjustedTarget: Math.round(target.target * adjustmentFactor),
                vixAdjustment: adjustmentFactor,
                originalTarget: target.target
            });
        }

        return adjustedTargets;
    }

    /**
     * Generate comprehensive compounding report
     */
    generateCompoundingReport(currentBalance, currentMonth = null, vixLevel = 16) {
        const month = currentMonth || this.currentMonth;
        const progress = this.trackCompoundingProgress(currentBalance, month);
        const positioning = this.calculatePositionSizingForGrowth(currentBalance, month + 1);
        const vixAdjusted = this.calculateVIXAdjustedTargets(vixLevel);
        
        return {
            timestamp: new Date().toISOString(),
            currentStatus: {
                balance: currentBalance,
                month,
                progress: progress,
                vixLevel
            },
            targets: {
                original: Array.from(this.monthlyTargets.entries()).map(([m, t]) => ({ month: m, ...t })),
                vixAdjusted: Array.from(vixAdjusted.entries()).map(([m, t]) => ({ month: m, ...t }))
            },
            positioning,
            recommendations: this.generateRecommendations(progress, positioning, vixLevel),
            mathematics: {
                formula: `£${this.startingCapital.toLocaleString()} × (1.${(this.monthlyGrowthRate * 100).toFixed(0)})^${this.targetMonths}`,
                finalTarget: this.monthlyTargets.get(this.targetMonths).target,
                multiplier: this.monthlyTargets.get(this.targetMonths).multiplier
            }
        };
    }

    /**
     * Generate actionable recommendations based on current status
     */
    generateRecommendations(progress, positioning, vixLevel) {
        const recommendations = [];

        // Progress-based recommendations
        if (!progress.isOnTrack) {
            recommendations.push({
                priority: 'HIGH',
                category: 'PROGRESS',
                title: 'Behind Compounding Schedule',
                description: `Currently ${progress.progress.toFixed(1)}% of target. Need ${positioning.shortfall} additional growth.`,
                actions: [
                    'Increase position sizing within risk limits',
                    'Add complementary strategies',
                    'Review execution timing and entry quality'
                ]
            });
        }

        // Strategy combination recommendations
        const bestCombo = positioning.combinations[0];
        if (!bestCombo.achievable) {
            recommendations.push({
                priority: 'CRITICAL',
                category: 'STRATEGY',
                title: 'Insufficient Strategy Allocation',
                description: `Best combination only achieves ${bestCombo.efficiency}% of required growth.`,
                actions: [
                    'Consider higher-risk strategies if appropriate for phase',
                    'Increase buying power usage with caution',
                    'Reassess monthly targets given current constraints'
                ]
            });
        }

        // VIX-based recommendations
        if (vixLevel > 25) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'RISK',
                title: 'High VIX Environment',
                description: `VIX ${vixLevel} suggests defensive approach while maintaining growth targets.`,
                actions: [
                    'Prioritize high-probability strategies (0DTE, LT112)',
                    'Reduce position sizes but increase trade frequency',
                    'Focus on premium selling strategies'
                ]
            });
        }

        return recommendations.sort((a, b) => {
            const priorities = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
            return priorities[b.priority] - priorities[a.priority];
        });
    }

    /**
     * Validate if current system supports compound growth
     */
    validateSystemForCompounding(systemConfig) {
        const validation = {
            hasMonthlyTargets: false,
            hasGrowthSizing: false,
            hasProgressTracking: false,
            hasPhaseTransitions: false,
            hasVIXAdjustments: false,
            score: 0,
            recommendations: []
        };

        // Check for monthly target system
        if (systemConfig.monthlyTargets || systemConfig.compoundingTargets) {
            validation.hasMonthlyTargets = true;
            validation.score += 20;
        }

        // Check for growth-based position sizing
        if (systemConfig.growthBasedSizing || systemConfig.compoundingSizing) {
            validation.hasGrowthSizing = true;
            validation.score += 25;
        }

        // Check for progress tracking
        if (systemConfig.progressTracking || systemConfig.compoundingProgress) {
            validation.hasProgressTracking = true;
            validation.score += 20;
        }

        // Check for automatic phase transitions
        if (systemConfig.autoPhaseTransition || systemConfig.compoundingPhases) {
            validation.hasPhaseTransitions = true;
            validation.score += 20;
        }

        // Check for VIX adjustments
        if (systemConfig.vixAdjustments || systemConfig.volatilityAdjustedTargets) {
            validation.hasVIXAdjustments = true;
            validation.score += 15;
        }

        // Generate recommendations for missing components
        if (!validation.hasMonthlyTargets) {
            validation.recommendations.push('Add monthly compound targets to system configuration');
        }
        if (!validation.hasGrowthSizing) {
            validation.recommendations.push('Implement growth-based position sizing instead of arbitrary BP limits');
        }
        if (!validation.hasProgressTracking) {
            validation.recommendations.push('Add real-time compounding progress tracking');
        }

        validation.readyForCompounding = validation.score >= 70;

        return validation;
    }
}

module.exports = { CompoundingCalculator };

// Example usage and testing
if (require.main === module) {
    console.log('🧮 COMPOUNDING CALCULATOR DEMONSTRATION');
    console.log('======================================');

    const calculator = new CompoundingCalculator();

    // Test current month progression
    console.log('\n📊 MONTHLY TARGETS:');
    for (let month = 0; month <= 8; month++) {
        const target = calculator.getMonthlyTarget(month);
        console.log(`Month ${month}: £${target.target.toLocaleString()} (${target.multiplier}x, Phase ${target.phase})`);
    }

    // Test position sizing for Month 1
    console.log('\n💰 POSITION SIZING FOR MONTH 1:');
    const positioning = calculator.calculatePositionSizingForGrowth(35000, 1);
    console.log(`Required Growth: £${positioning.requiredGrowth.toLocaleString()} (${positioning.requiredGrowthPercent}%)`);
    console.log(`Achievable: ${positioning.achievable ? '✅' : '❌'}`);
    console.log(`Best Combination: ${positioning.combinations[0].name} (${positioning.combinations[0].efficiency}%)`);

    // Test progress tracking
    console.log('\n📈 PROGRESS TRACKING (Month 1, £37,500):');
    const progress = calculator.trackCompoundingProgress(37500, 1);
    console.log(`Progress: ${progress.progress}% of target`);
    console.log(`On Track: ${progress.isOnTrack ? '✅' : '❌'}`);
    console.log(`Alerts: ${progress.alerts.length}`);

    console.log('\n🚀 Compounding Calculator Ready for Integration');
}