/**
 * Theta Optimization Engine
 * Optimizes positions for maximum time decay income in Tom King Trading Framework
 * 
 * MISSION: Optimize theta income across portfolio for systematic monthly income generation
 * - VIX-adaptive theta targeting
 * - Portfolio-wide theta aggregation and optimization
 * - Integration with Greeks calculator for precision
 */

const { getLogger } = require('./logger');
const { GreeksCalculator } = require('./greeksCalculator');

class ThetaOptimizationEngine {
    constructor(options = {}) {
        this.logger = getLogger();
        this.greeksCalculator = new GreeksCalculator();
        
        this.config = {
            // Theta targets by strategy (daily)
            dailyThetaTargets: {
                dte0: 150,      // £150 daily theta from 0DTE positions
                lt112: 200,     // £200 daily theta from LT112 positions
                strangles: 120, // £120 daily theta from strangles
                total: 470      // £470 total daily theta (£10.3k monthly)
            },
            
            // VIX-based theta multipliers
            vixThetaAdjustments: {
                veryLow: { threshold: 12, multiplier: 1.4, label: 'VERY_LOW' },
                low: { threshold: 18, multiplier: 1.2, label: 'LOW' },
                normal: { threshold: 25, multiplier: 1.0, label: 'NORMAL' },
                high: { threshold: 35, multiplier: 0.85, label: 'HIGH' },
                extreme: { threshold: 50, multiplier: 0.7, label: 'EXTREME' }
            },
            
            // Time decay optimization parameters
            optimalDTE: {
                dte0: 0,        // Same day expiry
                lt112: 7,       // 7 days for weekly cycle
                strangles: 21,  // 21 DTE for monthly strangles
                butterflies: 14 // 14 DTE for butterflies
            },
            
            // Theta efficiency thresholds
            thetaEfficiency: {
                excellent: 0.15,  // Theta/Premium > 15%
                good: 0.10,       // Theta/Premium > 10%
                fair: 0.06,       // Theta/Premium > 6%
                poor: 0.03        // Theta/Premium < 3%
            },
            
            // Portfolio theta balancing
            balancing: {
                maxStrategyAllocation: 0.60,  // Max 60% theta from one strategy
                minDiversification: 3,        // Minimum 3 strategies for diversification
                rebalanceThreshold: 0.20      // Rebalance if allocation drifts >20%
            },
            
            // Risk management for theta positions
            riskLimits: {
                maxGammaRisk: 500,      // Maximum portfolio gamma exposure
                maxVegaRisk: 2000,      // Maximum portfolio vega exposure
                maxPositionTheta: 50,   // Maximum theta per individual position
                minTimeToExpiry: 0.002  // Minimum 0.002 years (about 18 hours)
            }
        };
        
        this.currentPositions = [];
        this.thetaHistory = [];
        
        this.logger.info('THETA-OPT', 'Theta Optimization Engine initialized', {
            dailyThetaTarget: this.config.dailyThetaTargets.total
        });
    }

    /**
     * Optimize portfolio theta allocation
     * CORE METHOD: Calculates optimal theta distribution across strategies
     */
    optimizePortfolioTheta(accountValue, currentPositions = [], vixLevel = 20, targetDaily = null) {
        try {
            this.logger.info('THETA-OPT', 'Optimizing portfolio theta allocation', {
                accountValue,
                currentPositions: currentPositions.length,
                vixLevel
            });

            // Calculate VIX-adjusted theta targets
            const vixAdjustment = this.calculateVixThetaAdjustment(vixLevel);
            const adjustedTargets = this.adjustThetaTargetsForVIX(targetDaily, vixAdjustment);
            
            // Analyze current theta generation
            const currentTheta = this.analyzeCurrentThetaPositions(currentPositions);
            
            // Calculate theta gaps and opportunities
            const thetaGaps = this.calculateThetaGaps(currentTheta, adjustedTargets);
            
            // Generate optimization recommendations
            const recommendations = this.generateThetaOptimizationRecommendations(
                thetaGaps, 
                accountValue, 
                vixLevel
            );
            
            // Portfolio balance analysis
            const balanceAnalysis = this.analyzeThetaBalance(currentTheta, adjustedTargets);
            
            const result = {
                vixLevel,
                vixAdjustment,
                adjustedTargets,
                
                current: currentTheta,
                gaps: thetaGaps,
                balance: balanceAnalysis,
                
                recommendations,
                
                optimization: {
                    efficiency: this.calculatePortfolioThetaEfficiency(currentTheta),
                    diversification: this.calculateThetaDiversification(currentTheta),
                    riskScore: this.calculateThetaRiskScore(currentTheta),
                    qualityScore: this.calculateThetaQualityScore(currentTheta, recommendations)
                },
                
                projectedIncome: this.projectMonthlyThetaIncome(currentTheta, recommendations),
                
                timestamp: new Date().toISOString()
            };
            
            this.logger.info('THETA-OPT', 'Portfolio theta optimization completed', {
                currentDailyTheta: currentTheta.totalDailyTheta,
                targetDailyTheta: adjustedTargets.total,
                efficiency: result.optimization.efficiency
            });
            
            return result;
            
        } catch (error) {
            this.logger.error('THETA-OPT', 'Error optimizing portfolio theta', error);
            throw error;
        }
    }

    /**
     * Calculate VIX-based theta adjustment
     */
    calculateVixThetaAdjustment(vixLevel) {
        const { vixThetaAdjustments } = this.config;
        
        for (const [regime, config] of Object.entries(vixThetaAdjustments)) {
            if (vixLevel <= config.threshold) {
                return {
                    regime: config.label,
                    multiplier: config.multiplier,
                    threshold: config.threshold
                };
            }
        }
        
        return {
            regime: 'EXTREME',
            multiplier: vixThetaAdjustments.extreme.multiplier,
            threshold: vixThetaAdjustments.extreme.threshold
        };
    }

    /**
     * Adjust theta targets based on VIX level
     */
    adjustThetaTargetsForVIX(targetDaily, vixAdjustment) {
        const baseTargets = targetDaily ? {
            dte0: targetDaily * 0.32,      // 32% from 0DTE
            lt112: targetDaily * 0.43,     // 43% from LT112
            strangles: targetDaily * 0.25, // 25% from strangles
            total: targetDaily
        } : this.config.dailyThetaTargets;
        
        return {
            dte0: Math.round(baseTargets.dte0 * vixAdjustment.multiplier),
            lt112: Math.round(baseTargets.lt112 * vixAdjustment.multiplier),
            strangles: Math.round(baseTargets.strangles * vixAdjustment.multiplier),
            total: Math.round(baseTargets.total * vixAdjustment.multiplier),
            
            vixRegime: vixAdjustment.regime,
            adjustmentFactor: vixAdjustment.multiplier
        };
    }

    /**
     * Analyze current theta generation from existing positions
     */
    analyzeCurrentThetaPositions(positions) {
        try {
            const analysis = {
                byStrategy: {
                    dte0: { positions: 0, dailyTheta: 0, efficiency: 0 },
                    lt112: { positions: 0, dailyTheta: 0, efficiency: 0 },
                    strangles: { positions: 0, dailyTheta: 0, efficiency: 0 },
                    other: { positions: 0, dailyTheta: 0, efficiency: 0 }
                },
                totalPositions: positions.length,
                totalDailyTheta: 0,
                averageEfficiency: 0,
                riskMetrics: {
                    totalGamma: 0,
                    totalVega: 0,
                    maxSinglePositionTheta: 0
                }
            };

            for (const position of positions) {
                // Calculate position Greeks if not already available
                const greeks = position.greeks || this.calculatePositionGreeks(position);
                
                const positionTheta = Math.abs(greeks.theta) * (position.quantity || 1);
                const strategy = this.categorizePositionStrategy(position);
                
                // Add to strategy bucket
                analysis.byStrategy[strategy].positions += 1;
                analysis.byStrategy[strategy].dailyTheta += positionTheta;
                
                // Calculate position efficiency (theta per premium paid)
                const premium = position.premium || position.entryValue || 0;
                const efficiency = premium > 0 ? positionTheta / premium : 0;
                analysis.byStrategy[strategy].efficiency = 
                    (analysis.byStrategy[strategy].efficiency * (analysis.byStrategy[strategy].positions - 1) + efficiency) 
                    / analysis.byStrategy[strategy].positions;
                
                // Update totals
                analysis.totalDailyTheta += positionTheta;
                
                // Risk metrics
                analysis.riskMetrics.totalGamma += Math.abs(greeks.gamma) * (position.quantity || 1);
                analysis.riskMetrics.totalVega += Math.abs(greeks.vega) * (position.quantity || 1);
                analysis.riskMetrics.maxSinglePositionTheta = Math.max(
                    analysis.riskMetrics.maxSinglePositionTheta,
                    positionTheta
                );
            }

            // Calculate overall efficiency
            const totalPremium = positions.reduce((sum, pos) => sum + (pos.premium || pos.entryValue || 0), 0);
            analysis.averageEfficiency = totalPremium > 0 ? analysis.totalDailyTheta / totalPremium : 0;

            return analysis;
            
        } catch (error) {
            this.logger.error('THETA-OPT', 'Error analyzing current theta positions', error);
            return this.getEmptyThetaAnalysis();
        }
    }

    /**
     * Calculate position Greeks if not available
     */
    calculatePositionGreeks(position) {
        try {
            const {
                underlyingPrice = 400, // Default SPY price
                strike,
                expiration,
                optionType,
                volatility = 0.25
            } = position;

            const timeToExpiry = this.calculateTimeToExpiry(expiration);
            
            return this.greeksCalculator.calculateGreeks({
                spotPrice: underlyingPrice,
                strikePrice: strike,
                timeToExpiry,
                volatility,
                optionType
            });
            
        } catch (error) {
            this.logger.warn('THETA-OPT', 'Could not calculate position Greeks, using defaults');
            return { theta: -1, gamma: 0.01, vega: 5, delta: 0.3 };
        }
    }

    /**
     * Categorize position by strategy type
     */
    categorizePositionStrategy(position) {
        const { expiration, strategy, symbol } = position;
        
        // Check if explicitly labeled
        if (strategy) {
            if (strategy.includes('0DTE') || strategy.includes('FRIDAY')) return 'dte0';
            if (strategy.includes('112') || strategy.includes('LT112')) return 'lt112';
            if (strategy.includes('STRANGLE') || strategy.includes('FUTURES')) return 'strangles';
        }
        
        // Check by expiration timing
        const dte = this.calculateDaysToExpiry(expiration);
        if (dte <= 1) return 'dte0';
        if (dte >= 5 && dte <= 10) return 'lt112';
        if (dte >= 15 && dte <= 30) return 'strangles';
        
        // Check by underlying
        if (symbol && symbol.startsWith('M')) return 'strangles'; // Micro futures
        
        return 'other';
    }

    /**
     * Calculate gaps between current and target theta
     */
    calculateThetaGaps(currentTheta, targets) {
        return {
            dte0: {
                current: currentTheta.byStrategy.dte0.dailyTheta,
                target: targets.dte0,
                gap: targets.dte0 - currentTheta.byStrategy.dte0.dailyTheta,
                percentOfTarget: currentTheta.byStrategy.dte0.dailyTheta / targets.dte0 * 100
            },
            lt112: {
                current: currentTheta.byStrategy.lt112.dailyTheta,
                target: targets.lt112,
                gap: targets.lt112 - currentTheta.byStrategy.lt112.dailyTheta,
                percentOfTarget: currentTheta.byStrategy.lt112.dailyTheta / targets.lt112 * 100
            },
            strangles: {
                current: currentTheta.byStrategy.strangles.dailyTheta,
                target: targets.strangles,
                gap: targets.strangles - currentTheta.byStrategy.strangles.dailyTheta,
                percentOfTarget: currentTheta.byStrategy.strangles.dailyTheta / targets.strangles * 100
            },
            total: {
                current: currentTheta.totalDailyTheta,
                target: targets.total,
                gap: targets.total - currentTheta.totalDailyTheta,
                percentOfTarget: currentTheta.totalDailyTheta / targets.total * 100
            }
        };
    }

    /**
     * Generate theta optimization recommendations
     */
    generateThetaOptimizationRecommendations(gaps, accountValue, vixLevel) {
        const recommendations = [];
        
        // Process each strategy gap
        Object.entries(gaps).forEach(([strategy, gap]) => {
            if (strategy === 'total') return;
            
            if (gap.gap > 10) { // Significant gap (>£10 daily)
                const recommendation = this.generateStrategyRecommendation(
                    strategy, 
                    gap, 
                    accountValue, 
                    vixLevel
                );
                
                if (recommendation) recommendations.push(recommendation);
            }
        });
        
        // Overall portfolio recommendations
        if (gaps.total.gap > 50) {
            recommendations.push({
                type: 'PORTFOLIO',
                priority: 'HIGH',
                message: `Portfolio theta is ${Math.round(gaps.total.gap)} below target. Consider adding positions across all strategies.`,
                impact: Math.round(gaps.total.gap),
                actionRequired: true
            });
        }
        
        return recommendations;
    }

    /**
     * Generate strategy-specific recommendation
     */
    generateStrategyRecommendation(strategy, gap, accountValue, vixLevel) {
        const strategyConfig = {
            dte0: {
                name: '0DTE Friday',
                avgThetaPerContract: 15,
                bpPerContract: 2000,
                timing: 'Every Friday after 10:30 AM'
            },
            lt112: {
                name: 'Long-Term 112',
                avgThetaPerContract: 25,
                bpPerContract: 3500,
                timing: 'Weekly entries on Monday'
            },
            strangles: {
                name: 'Futures Strangles',
                avgThetaPerContract: 40,
                bpPerContract: 4000,
                timing: 'Bi-weekly entries'
            }
        };
        
        const config = strategyConfig[strategy];
        if (!config) return null;
        
        const contractsNeeded = Math.ceil(gap.gap / config.avgThetaPerContract);
        const bpRequired = contractsNeeded * config.bpPerContract;
        const bpPercent = (bpRequired / accountValue * 100).toFixed(1);
        
        return {
            type: 'STRATEGY',
            strategy: strategy.toUpperCase(),
            strategyName: config.name,
            priority: gap.gap > 50 ? 'HIGH' : 'MEDIUM',
            
            analysis: {
                currentTheta: Math.round(gap.current),
                targetTheta: Math.round(gap.target),
                shortfall: Math.round(gap.gap)
            },
            
            recommendation: {
                contractsNeeded,
                bpRequired: Math.round(bpRequired),
                bpPercentage: parseFloat(bpPercent),
                timing: config.timing
            },
            
            feasibility: bpPercent < 15 ? 'HIGH' : bpPercent < 25 ? 'MEDIUM' : 'LOW',
            
            message: `Add ${contractsNeeded} ${config.name} contracts to generate additional £${Math.round(gap.gap)} daily theta (${bpPercent}% BP)`
        };
    }

    /**
     * Analyze theta balance across strategies
     */
    analyzeThetaBalance(currentTheta, targets) {
        const totalCurrent = currentTheta.totalDailyTheta;
        const totalTarget = targets.total;
        
        if (totalCurrent === 0) {
            return {
                balanced: false,
                score: 0,
                issues: ['No current theta generation'],
                recommendations: ['Begin establishing theta positions across all strategies']
            };
        }
        
        const balance = {
            dte0: totalCurrent > 0 ? currentTheta.byStrategy.dte0.dailyTheta / totalCurrent : 0,
            lt112: totalCurrent > 0 ? currentTheta.byStrategy.lt112.dailyTheta / totalCurrent : 0,
            strangles: totalCurrent > 0 ? currentTheta.byStrategy.strangles.dailyTheta / totalCurrent : 0
        };
        
        const targetBalance = {
            dte0: targets.dte0 / totalTarget,
            lt112: targets.lt112 / totalTarget,
            strangles: targets.strangles / totalTarget
        };
        
        // Calculate balance score (0-100)
        let balanceScore = 100;
        const issues = [];
        const recommendations = [];
        
        Object.keys(balance).forEach(strategy => {
            const deviation = Math.abs(balance[strategy] - targetBalance[strategy]);
            if (deviation > 0.15) { // >15% deviation
                balanceScore -= 20;
                issues.push(`${strategy.toUpperCase()} allocation ${(balance[strategy] * 100).toFixed(1)}% vs target ${(targetBalance[strategy] * 100).toFixed(1)}%`);
                
                if (balance[strategy] < targetBalance[strategy]) {
                    recommendations.push(`Increase ${strategy.toUpperCase()} positions`);
                } else {
                    recommendations.push(`Reduce ${strategy.toUpperCase()} allocation or increase others`);
                }
            }
        });
        
        // Check for over-concentration
        const maxAllocation = Math.max(...Object.values(balance));
        if (maxAllocation > this.config.balancing.maxStrategyAllocation) {
            balanceScore -= 15;
            issues.push(`Over-concentration: ${(maxAllocation * 100).toFixed(1)}% in single strategy`);
            recommendations.push('Diversify theta sources across strategies');
        }
        
        return {
            balanced: balanceScore >= 80,
            score: Math.max(0, balanceScore),
            currentBalance: balance,
            targetBalance,
            issues,
            recommendations
        };
    }

    /**
     * Calculate portfolio theta efficiency
     */
    calculatePortfolioThetaEfficiency(currentTheta) {
        if (currentTheta.totalDailyTheta === 0) return 0;
        
        const weightedEfficiency = Object.values(currentTheta.byStrategy).reduce((sum, strategy) => {
            const weight = strategy.dailyTheta / currentTheta.totalDailyTheta;
            return sum + (strategy.efficiency * weight);
        }, 0);
        
        return parseFloat(weightedEfficiency.toFixed(4));
    }

    /**
     * Calculate theta diversification score
     */
    calculateThetaDiversification(currentTheta) {
        if (currentTheta.totalDailyTheta === 0) return 0;
        
        const allocations = Object.values(currentTheta.byStrategy).map(s => 
            s.dailyTheta / currentTheta.totalDailyTheta
        ).filter(a => a > 0);
        
        if (allocations.length < 2) return 25; // Poor diversification
        if (allocations.length < 3) return 60; // Fair diversification
        
        // Calculate Herfindahl index for concentration
        const herfindahl = allocations.reduce((sum, allocation) => sum + (allocation * allocation), 0);
        const diversificationScore = (1 - herfindahl) * 100;
        
        return Math.round(diversificationScore);
    }

    /**
     * Calculate theta risk score
     */
    calculateThetaRiskScore(currentTheta) {
        let riskScore = 100;
        
        // Gamma risk
        if (currentTheta.riskMetrics.totalGamma > this.config.riskLimits.maxGammaRisk) {
            riskScore -= 25;
        }
        
        // Vega risk
        if (currentTheta.riskMetrics.totalVega > this.config.riskLimits.maxVegaRisk) {
            riskScore -= 20;
        }
        
        // Position concentration risk
        if (currentTheta.riskMetrics.maxSinglePositionTheta > this.config.riskLimits.maxPositionTheta) {
            riskScore -= 15;
        }
        
        return Math.max(0, riskScore);
    }

    /**
     * Calculate theta quality score
     */
    calculateThetaQualityScore(currentTheta, recommendations) {
        let qualityScore = 50; // Base score
        
        // Efficiency bonus
        const efficiency = this.calculatePortfolioThetaEfficiency(currentTheta);
        if (efficiency > this.config.thetaEfficiency.excellent) {
            qualityScore += 25;
        } else if (efficiency > this.config.thetaEfficiency.good) {
            qualityScore += 15;
        } else if (efficiency > this.config.thetaEfficiency.fair) {
            qualityScore += 5;
        }
        
        // Diversification bonus
        const diversification = this.calculateThetaDiversification(currentTheta);
        qualityScore += Math.round(diversification * 0.25);
        
        // Penalty for high-priority recommendations
        const highPriorityRecs = recommendations.filter(r => r.priority === 'HIGH').length;
        qualityScore -= (highPriorityRecs * 10);
        
        return Math.max(0, Math.min(100, Math.round(qualityScore)));
    }

    /**
     * Project monthly theta income
     */
    projectMonthlyThetaIncome(currentTheta, recommendations) {
        const currentMonthly = currentTheta.totalDailyTheta * 21; // 21 trading days
        
        const potentialAdditional = recommendations
            .filter(r => r.type === 'STRATEGY')
            .reduce((sum, r) => sum + (r.analysis?.shortfall || 0), 0) * 21;
        
        const projectedMonthly = currentMonthly + potentialAdditional;
        
        return {
            currentDaily: Math.round(currentTheta.totalDailyTheta),
            currentMonthly: Math.round(currentMonthly),
            potentialAdditionalDaily: Math.round(potentialAdditional / 21),
            potentialAdditionalMonthly: Math.round(potentialAdditional),
            projectedDaily: Math.round((projectedMonthly / 21)),
            projectedMonthly: Math.round(projectedMonthly)
        };
    }

    /**
     * Optimize specific strategy theta
     */
    optimizeStrategyTheta(strategy, targetTheta, accountValue, constraints = {}) {
        try {
            const strategyConfigs = {
                dte0: {
                    optimalDTE: 0,
                    avgTheta: 15,
                    bpRequired: 2000,
                    maxPositions: Math.floor(accountValue * 0.20 / 2000)
                },
                lt112: {
                    optimalDTE: 7,
                    avgTheta: 25,
                    bpRequired: 3500,
                    maxPositions: Math.floor(accountValue * 0.30 / 3500)
                },
                strangles: {
                    optimalDTE: 21,
                    avgTheta: 40,
                    bpRequired: 4000,
                    maxPositions: Math.floor(accountValue * 0.25 / 4000)
                }
            };
            
            const config = strategyConfigs[strategy];
            if (!config) throw new Error(`Unknown strategy: ${strategy}`);
            
            const contractsNeeded = Math.ceil(targetTheta / config.avgTheta);
            const maxAffordable = config.maxPositions;
            const recommendedContracts = Math.min(contractsNeeded, maxAffordable);
            
            const expectedTheta = recommendedContracts * config.avgTheta;
            const bpRequired = recommendedContracts * config.bpRequired;
            
            return {
                strategy: strategy.toUpperCase(),
                targetTheta,
                recommendedContracts,
                expectedTheta,
                bpRequired,
                bpPercentage: (bpRequired / accountValue * 100).toFixed(2),
                achievementRatio: expectedTheta / targetTheta,
                feasible: recommendedContracts >= contractsNeeded * 0.8
            };
            
        } catch (error) {
            this.logger.error('THETA-OPT', `Error optimizing ${strategy} theta`, error);
            throw error;
        }
    }

    /**
     * Calculate time to expiry in years
     */
    calculateTimeToExpiry(expiration) {
        const now = new Date();
        const expDate = new Date(expiration);
        const diffMs = expDate.getTime() - now.getTime();
        return Math.max(this.config.riskLimits.minTimeToExpiry, diffMs / (1000 * 60 * 60 * 24 * 365));
    }

    /**
     * Calculate days to expiry
     */
    calculateDaysToExpiry(expiration) {
        const now = new Date();
        const expDate = new Date(expiration);
        const diffMs = expDate.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    /**
     * Get empty theta analysis structure
     */
    getEmptyThetaAnalysis() {
        return {
            byStrategy: {
                dte0: { positions: 0, dailyTheta: 0, efficiency: 0 },
                lt112: { positions: 0, dailyTheta: 0, efficiency: 0 },
                strangles: { positions: 0, dailyTheta: 0, efficiency: 0 },
                other: { positions: 0, dailyTheta: 0, efficiency: 0 }
            },
            totalPositions: 0,
            totalDailyTheta: 0,
            averageEfficiency: 0,
            riskMetrics: {
                totalGamma: 0,
                totalVega: 0,
                maxSinglePositionTheta: 0
            }
        };
    }

    /**
     * Get optimization summary
     */
    getOptimizationSummary(accountValue, vixLevel = 20) {
        const optimization = this.optimizePortfolioTheta(accountValue, [], vixLevel);
        
        return {
            currentStatus: {
                dailyTheta: optimization.current.totalDailyTheta,
                monthlyProjection: optimization.current.totalDailyTheta * 21,
                efficiency: optimization.optimization.efficiency
            },
            
            targets: {
                dailyTheta: optimization.adjustedTargets.total,
                monthlyTarget: optimization.adjustedTargets.total * 21,
                vixRegime: optimization.adjustedTargets.vixRegime
            },
            
            recommendations: optimization.recommendations.length,
            feasibility: optimization.optimization.qualityScore,
            
            nextSteps: optimization.recommendations
                .filter(r => r.priority === 'HIGH')
                .map(r => r.message)
        };
    }
}

module.exports = { ThetaOptimizationEngine };