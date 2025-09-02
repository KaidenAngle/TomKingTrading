/**
 * Monthly Income Calculator
 * Implements systematic £10k monthly income generation for Tom King Trading Framework
 * 
 * CRITICAL MISSION: Calculate exact positions needed for £10k monthly income from £75k account
 * Strategy allocation: 40% 0DTE, 35% LT112, 25% Strangles
 * Phase-based targeting: Phase 1=£3k, Phase 2=£5k, Phase 3=£7.5k, Phase 4=£10k
 */

const { getLogger } = require('./logger');
const { GreeksCalculator } = require('./greeksCalculator');

class MonthlyIncomeCalculator {
    constructor(options = {}) {
        this.logger = getLogger();
        this.greeksCalculator = new GreeksCalculator();
        
        // Tom King Strategy Parameters - Exact Specifications
        this.config = {
            // Win Rate Assumptions (Tom King verified)
            winRates: {
                dte0: 0.88,     // 88% win rate for 0DTE Friday
                lt112: 0.73,    // 73% win rate for Long-Term 112
                strangles: 0.72 // 72% win rate for futures strangles
            },
            
            // Strategy Allocation for £10k monthly target
            strategyAllocation: {
                dte0: 0.40,     // 40% allocation to 0DTE
                lt112: 0.35,    // 35% allocation to LT112
                strangles: 0.25 // 25% allocation to strangles
            },
            
            // Phase-based monthly targets (£GBP)
            phaseTargets: {
                1: 3000,   // Phase 1: £30-40k account -> £3k monthly
                2: 5000,   // Phase 2: £40-60k account -> £5k monthly  
                3: 7500,   // Phase 3: £60-75k account -> £7.5k monthly
                4: 10000   // Phase 4: £75k+ account -> £10k monthly
            },
            
            // Account phase thresholds (£GBP)
            phaseThresholds: {
                1: { min: 30000, max: 40000 },
                2: { min: 40000, max: 60000 },
                3: { min: 60000, max: 75000 },
                4: { min: 75000, max: Infinity }
            },
            
            // Buying Power Limits per Strategy
            bpLimits: {
                dte0: 0.20,     // Max 20% BP for 0DTE
                lt112: 0.30,    // Max 30% BP for LT112
                strangles: 0.25, // Max 25% BP for strangles
                total: 0.35     // Total max 35% BP usage
            },
            
            // Safety Margins
            safetyMargins: {
                bp: 0.85,       // Use 85% of max BP limit for safety
                target: 0.90    // Target 90% of phase goal for buffer
            },
            
            // Contract specifications
            contracts: {
                spy: { multiplier: 100, minIncrement: 0.01 },
                futures: { multiplier: 50, minIncrement: 0.25 } // Micro futures
            },
            
            // VIX-based adjustments
            vixAdjustments: {
                low: { threshold: 15, multiplier: 1.2 },    // Increase size in low vol
                normal: { threshold: 25, multiplier: 1.0 },  // Normal sizing
                high: { threshold: 35, multiplier: 0.8 },    // Reduce size in high vol
                extreme: { threshold: 50, multiplier: 0.6 }  // Major reduction in extreme vol
            }
        };
        
        this.logger.info('INCOME-CALC', 'Monthly Income Calculator initialized', {
            phaseTargets: this.config.phaseTargets,
            strategyAllocation: this.config.strategyAllocation
        });
    }

    /**
     * Calculate complete monthly income requirements
     * CORE METHOD: Determines exact positions needed for target monthly income
     */
    calculateMonthlyIncomeRequirements(accountValue, targetMonthly = null, vixLevel = 20) {
        try {
            this.logger.info('INCOME-CALC', 'Calculating monthly income requirements', {
                accountValue,
                targetMonthly,
                vixLevel
            });

            // Determine account phase and target
            const phase = this.determineAccountPhase(accountValue);
            const monthlyTarget = targetMonthly || this.config.phaseTargets[phase];
            
            // Calculate VIX adjustment multiplier
            const vixMultiplier = this.calculateVixAdjustment(vixLevel);
            
            // Calculate strategy-specific requirements
            const dte0Requirements = this.calculate0DTERequirements(
                accountValue, 
                monthlyTarget * this.config.strategyAllocation.dte0,
                vixMultiplier
            );
            
            const lt112Requirements = this.calculateLT112Requirements(
                accountValue,
                monthlyTarget * this.config.strategyAllocation.lt112,
                vixMultiplier
            );
            
            const stranglesRequirements = this.calculateStrangleRequirements(
                accountValue,
                monthlyTarget * this.config.strategyAllocation.strangles,
                vixMultiplier
            );
            
            // Calculate total BP requirements and feasibility
            const totalBPRequired = dte0Requirements.bpRequired + 
                                   lt112Requirements.bpRequired + 
                                   stranglesRequirements.bpRequired;
                                   
            const bpUtilization = totalBPRequired / accountValue;
            const feasibilityScore = this.calculateFeasibilityScore(
                bpUtilization, 
                dte0Requirements, 
                lt112Requirements, 
                stranglesRequirements
            );
            
            const result = {
                phase,
                accountValue,
                monthlyTarget,
                vixLevel,
                vixMultiplier,
                
                strategies: {
                    dte0: dte0Requirements,
                    lt112: lt112Requirements,
                    strangles: stranglesRequirements
                },
                
                totals: {
                    expectedMonthlyIncome: dte0Requirements.expectedIncome + 
                                         lt112Requirements.expectedIncome + 
                                         stranglesRequirements.expectedIncome,
                    totalBPRequired,
                    bpUtilization: parseFloat((bpUtilization * 100).toFixed(2)),
                    totalContracts: dte0Requirements.contractsNeeded + 
                                   lt112Requirements.contractsNeeded + 
                                   stranglesRequirements.contractsNeeded
                },
                
                feasibility: {
                    score: feasibilityScore,
                    achievable: feasibilityScore >= 80,
                    bpCompliant: bpUtilization <= this.config.bpLimits.total,
                    recommendations: this.generateRecommendations(feasibilityScore, bpUtilization)
                },
                
                timestamp: new Date().toISOString()
            };
            
            this.logger.info('INCOME-CALC', 'Monthly income calculation completed', {
                phase,
                monthlyTarget,
                feasibilityScore,
                bpUtilization: result.totals.bpUtilization
            });
            
            return result;
            
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error calculating monthly income requirements', error);
            throw error;
        }
    }

    /**
     * Calculate 0DTE Friday requirements
     * Tom King's signature strategy with 88% win rate
     */
    calculate0DTERequirements(accountValue, targetIncome, vixMultiplier = 1.0) {
        try {
            // 0DTE parameters based on Tom King methodology - CORRECTED
            const avgCreditPerContract = 50; // £50 average credit per SPY 0DTE spread (not single option)
            const winRate = this.config.winRates.dte0;
            const maxBP = accountValue * this.config.bpLimits.dte0 * this.config.safetyMargins.bp;
            const bpPerContract = 2000; // Approximate BP per SPY 0DTE spread
            
            // Expected value calculation with Tom King win rate - CORRECTED
            const avgLoss = avgCreditPerContract * 1.5; // Average loss is 1.5x credit received
            const expectedProfitPerContract = (avgCreditPerContract * winRate) - (avgLoss * (1 - winRate));
            
            // Calculate contracts needed for target income - CORRECTED
            const weeksPerMonth = 4.33;
            const contractsNeeded = Math.ceil(targetIncome / (Math.abs(expectedProfitPerContract) * weeksPerMonth));
            const adjustedContracts = Math.max(1, Math.floor(contractsNeeded * vixMultiplier)); // Multiply for VIX adjustment
            
            // BP requirements
            const bpRequired = adjustedContracts * bpPerContract;
            const bpCompliant = bpRequired <= maxBP;
            
            // Weekly and monthly projections
            const weeklyIncome = adjustedContracts * expectedProfitPerContract;
            const expectedIncome = weeklyIncome * 4.33;
            
            return {
                strategy: '0DTE_FRIDAY',
                targetIncome,
                contractsNeeded: adjustedContracts,
                expectedIncome: parseFloat(expectedIncome.toFixed(2)),
                
                bpRequired: Math.round(bpRequired),
                maxBP: Math.round(maxBP),
                bpUtilization: parseFloat((bpRequired / accountValue * 100).toFixed(2)),
                bpCompliant,
                
                avgCreditPerContract,
                expectedProfitPerContract: parseFloat(expectedProfitPerContract.toFixed(3)),
                winRate,
                
                weeklyProjection: {
                    contracts: adjustedContracts,
                    expectedIncome: parseFloat(weeklyIncome.toFixed(2)),
                    maxRisk: parseFloat((adjustedContracts * avgCreditPerContract * 2).toFixed(2))
                },
                
                vixAdjustment: vixMultiplier,
                feasibilityRating: this.rateFeasibility(bpCompliant, expectedIncome, targetIncome)
            };
            
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error calculating 0DTE requirements', error);
            throw error;
        }
    }

    /**
     * Calculate Long-Term 112 requirements
     * Tom King's systematic weekly income strategy with 73% win rate
     */
    calculateLT112Requirements(accountValue, targetIncome, vixMultiplier = 1.0) {
        try {
            // LT112 parameters based on Tom King methodology - CORRECTED
            const avgCreditPerContract = 150; // £150 average credit per SPY LT112 spread
            const winRate = this.config.winRates.lt112;
            const maxBP = accountValue * this.config.bpLimits.lt112 * this.config.safetyMargins.bp;
            const bpPerContract = 3500; // Higher BP for longer-term positions
            const tradesPerMonth = 4; // Weekly entries
            
            // Expected value calculation - CORRECTED
            const avgLoss = avgCreditPerContract * 1.3; // Average loss is 1.3x credit received
            const expectedProfitPerContract = (avgCreditPerContract * winRate) - (avgLoss * (1 - winRate));
            
            // Calculate contracts needed - CORRECTED
            const contractsNeeded = Math.ceil(targetIncome / (Math.abs(expectedProfitPerContract) * tradesPerMonth));
            const adjustedContracts = Math.max(1, Math.floor(contractsNeeded * vixMultiplier)); // Multiply for VIX adjustment
            
            // BP requirements
            const bpRequired = adjustedContracts * bpPerContract;
            const bpCompliant = bpRequired <= maxBP;
            
            // Monthly projections
            const expectedIncome = adjustedContracts * expectedProfitPerContract * tradesPerMonth;
            
            return {
                strategy: 'LONG_TERM_112',
                targetIncome,
                contractsNeeded: adjustedContracts,
                expectedIncome: parseFloat(expectedIncome.toFixed(2)),
                
                bpRequired: Math.round(bpRequired),
                maxBP: Math.round(maxBP),
                bpUtilization: parseFloat((bpRequired / accountValue * 100).toFixed(2)),
                bpCompliant,
                
                avgCreditPerContract,
                expectedProfitPerContract: parseFloat(expectedProfitPerContract.toFixed(3)),
                winRate,
                tradesPerMonth,
                
                weeklyProjection: {
                    contracts: adjustedContracts,
                    expectedIncome: parseFloat((expectedIncome / 4.33).toFixed(2)),
                    maxRisk: parseFloat((adjustedContracts * avgCreditPerContract * 1.5).toFixed(2))
                },
                
                vixAdjustment: vixMultiplier,
                feasibilityRating: this.rateFeasibility(bpCompliant, expectedIncome, targetIncome)
            };
            
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error calculating LT112 requirements', error);
            throw error;
        }
    }

    /**
     * Calculate futures strangle requirements  
     * Tom King's systematic futures income with 72% win rate
     */
    calculateStrangleRequirements(accountValue, targetIncome, vixMultiplier = 1.0) {
        try {
            // Strangle parameters based on Tom King methodology - CORRECTED
            const avgCreditPerContract = 400; // £400 average credit per micro futures strangle
            const winRate = this.config.winRates.strangles;
            const maxBP = accountValue * this.config.bpLimits.strangles * this.config.safetyMargins.bp;
            const bpPerContract = 2500; // Micro futures margin requirement (lower than full-size)
            const tradesPerMonth = 2; // Bi-weekly entries for longer hold
            
            // Expected value calculation - CORRECTED
            const avgLoss = avgCreditPerContract * 1.6; // Average loss is 1.6x credit received
            const expectedProfitPerContract = (avgCreditPerContract * winRate) - (avgLoss * (1 - winRate));
            
            // Calculate contracts needed - CORRECTED
            const contractsNeeded = Math.ceil(targetIncome / (Math.abs(expectedProfitPerContract) * tradesPerMonth));
            const adjustedContracts = Math.max(1, Math.floor(contractsNeeded * vixMultiplier)); // Multiply for VIX adjustment
            
            // BP requirements
            const bpRequired = adjustedContracts * bpPerContract;
            const bpCompliant = bpRequired <= maxBP;
            
            // Monthly projections
            const expectedIncome = adjustedContracts * expectedProfitPerContract * tradesPerMonth;
            
            return {
                strategy: 'FUTURES_STRANGLES',
                targetIncome,
                contractsNeeded: adjustedContracts,
                expectedIncome: parseFloat(expectedIncome.toFixed(2)),
                
                bpRequired: Math.round(bpRequired),
                maxBP: Math.round(maxBP),
                bpUtilization: parseFloat((bpRequired / accountValue * 100).toFixed(2)),
                bpCompliant,
                
                avgCreditPerContract,
                expectedProfitPerContract: parseFloat(expectedProfitPerContract.toFixed(2)),
                winRate,
                tradesPerMonth,
                
                underlyingAssets: ['MES', 'MNQ', 'MCL', 'MGC'], // Micro futures
                
                monthlyProjection: {
                    contracts: adjustedContracts,
                    expectedIncome: parseFloat(expectedIncome.toFixed(2)),
                    maxRisk: parseFloat((adjustedContracts * avgCreditPerContract * 1.8).toFixed(2))
                },
                
                vixAdjustment: vixMultiplier,
                feasibilityRating: this.rateFeasibility(bpCompliant, expectedIncome, targetIncome)
            };
            
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error calculating strangle requirements', error);
            throw error;
        }
    }

    /**
     * Determine account phase based on current value
     */
    determineAccountPhase(accountValue) {
        for (const [phase, thresholds] of Object.entries(this.config.phaseThresholds)) {
            if (accountValue >= thresholds.min && accountValue < thresholds.max) {
                return parseInt(phase);
            }
        }
        return 4; // Default to Phase 4 for accounts > £75k
    }

    /**
     * Calculate VIX-based position size adjustment
     */
    calculateVixAdjustment(vixLevel) {
        const { vixAdjustments } = this.config;
        
        if (vixLevel < vixAdjustments.low.threshold) {
            return vixAdjustments.low.multiplier;
        } else if (vixLevel < vixAdjustments.normal.threshold) {
            return vixAdjustments.normal.multiplier;
        } else if (vixLevel < vixAdjustments.high.threshold) {
            return vixAdjustments.high.multiplier;
        } else {
            return vixAdjustments.extreme.multiplier;
        }
    }

    /**
     * Calculate overall feasibility score (0-100)
     */
    calculateFeasibilityScore(bpUtilization, dte0Req, lt112Req, stranglesReq) {
        let score = 100;
        
        // BP utilization penalty (major factor)
        if (bpUtilization > this.config.bpLimits.total) {
            score -= Math.min(50, (bpUtilization - this.config.bpLimits.total) * 100);
        }
        
        // Individual strategy BP compliance
        if (!dte0Req.bpCompliant) score -= 15;
        if (!lt112Req.bpCompliant) score -= 15;
        if (!stranglesReq.bpCompliant) score -= 15;
        
        // Income target achievement
        const totalExpectedIncome = dte0Req.expectedIncome + lt112Req.expectedIncome + stranglesReq.expectedIncome;
        const targetIncome = dte0Req.targetIncome + lt112Req.targetIncome + stranglesReq.targetIncome;
        const incomeRatio = totalExpectedIncome / targetIncome;
        
        if (incomeRatio < 0.9) score -= 20;
        if (incomeRatio < 0.8) score -= 20;
        
        // Bonus for exceeding targets safely
        if (incomeRatio > 1.1 && bpUtilization < 0.3) score += 10;
        
        return Math.max(0, Math.round(score));
    }

    /**
     * Rate individual strategy feasibility
     */
    rateFeasibility(bpCompliant, expectedIncome, targetIncome) {
        if (!bpCompliant) return 'POOR';
        
        const achievementRatio = expectedIncome / targetIncome;
        
        if (achievementRatio >= 1.1) return 'EXCELLENT';
        if (achievementRatio >= 0.95) return 'GOOD';
        if (achievementRatio >= 0.8) return 'FAIR';
        return 'POOR';
    }

    /**
     * Generate recommendations based on feasibility analysis
     */
    generateRecommendations(feasibilityScore, bpUtilization) {
        const recommendations = [];
        
        if (feasibilityScore >= 90) {
            recommendations.push('Excellent feasibility - proceed with current allocation');
        } else if (feasibilityScore >= 80) {
            recommendations.push('Good feasibility - minor adjustments may optimize results');
        } else if (feasibilityScore >= 70) {
            recommendations.push('Fair feasibility - consider reducing position sizes or targets');
        } else {
            recommendations.push('Poor feasibility - significant adjustments required');
        }
        
        if (bpUtilization > this.config.bpLimits.total) {
            recommendations.push(`BP utilization ${(bpUtilization * 100).toFixed(1)}% exceeds safe limit of ${(this.config.bpLimits.total * 100)}%`);
            recommendations.push('Reduce position sizes or consider account growth before increasing targets');
        }
        
        if (bpUtilization > 0.25) {
            recommendations.push('Consider implementing position scaling as account grows');
        }
        
        return recommendations;
    }

    /**
     * Calculate progressive scaling as account grows
     */
    calculateScalingProgression(currentAccountValue, targetAccountValue) {
        const currentPhase = this.determineAccountPhase(currentAccountValue);
        const targetPhase = this.determineAccountPhase(targetAccountValue);
        
        const progression = [];
        
        for (let phase = currentPhase; phase <= Math.min(targetPhase, 4); phase++) {
            const phaseMinValue = this.config.phaseThresholds[phase].min;
            const monthlyTarget = this.config.phaseTargets[phase];
            
            const requirements = this.calculateMonthlyIncomeRequirements(phaseMinValue, monthlyTarget);
            
            progression.push({
                phase,
                accountValue: phaseMinValue,
                monthlyTarget,
                feasibilityScore: requirements.feasibility.score,
                bpUtilization: requirements.totals.bpUtilization,
                timeframe: this.estimateTimeToPhase(currentAccountValue, phaseMinValue, monthlyTarget)
            });
        }
        
        return {
            currentPhase,
            targetPhase,
            progression,
            totalTimeEstimate: progression.reduce((sum, p) => sum + p.timeframe, 0)
        };
    }

    /**
     * Estimate time to reach account phase
     */
    estimateTimeToPhase(currentValue, targetValue, monthlyIncome) {
        if (currentValue >= targetValue) return 0;
        
        const needed = targetValue - currentValue;
        const monthsNeeded = Math.ceil(needed / monthlyIncome);
        
        return monthsNeeded;
    }

    /**
     * Calculate optimal allocation adjustments
     */
    optimizeAllocation(accountValue, targetMonthly, constraints = {}) {
        try {
            const baseRequirements = this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly);
            
            if (baseRequirements.feasibility.score >= 85) {
                return baseRequirements; // Current allocation is optimal
            }
            
            // Try different allocation combinations
            const allocations = [
                { dte0: 0.45, lt112: 0.35, strangles: 0.20 },
                { dte0: 0.35, lt112: 0.40, strangles: 0.25 },
                { dte0: 0.40, lt112: 0.30, strangles: 0.30 },
                { dte0: 0.50, lt112: 0.30, strangles: 0.20 }
            ];
            
            let bestAllocation = null;
            let bestScore = baseRequirements.feasibility.score;
            
            for (const allocation of allocations) {
                // Temporarily update allocation
                const originalAllocation = { ...this.config.strategyAllocation };
                this.config.strategyAllocation = allocation;
                
                const testRequirements = this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly);
                
                if (testRequirements.feasibility.score > bestScore) {
                    bestScore = testRequirements.feasibility.score;
                    bestAllocation = {
                        allocation,
                        requirements: testRequirements
                    };
                }
                
                // Restore original allocation
                this.config.strategyAllocation = originalAllocation;
            }
            
            return bestAllocation ? bestAllocation.requirements : baseRequirements;
            
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error optimizing allocation', error);
            throw error;
        }
    }

    /**
     * Get current configuration
     */
    getConfiguration() {
        return {
            ...this.config,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Update configuration
     */
    updateConfiguration(updates) {
        try {
            this.config = { ...this.config, ...updates };
            this.logger.info('INCOME-CALC', 'Configuration updated', updates);
            return true;
        } catch (error) {
            this.logger.error('INCOME-CALC', 'Error updating configuration', error);
            return false;
        }
    }

    // ==============================================================
    // AGENT 4 INTEGRATION: REAL-TIME GREEKS-BASED ADJUSTMENTS
    // ==============================================================

    /**
     * Set Greeks streaming engine for real-time integration
     */
    setGreeksStreamer(greeksStreamer) {
        this.greeksStreamer = greeksStreamer;
        
        if (this.greeksStreamer) {
            // Listen for Greeks updates to adjust income calculations
            this.greeksStreamer.on('greeksUpdate', (data) => {
                this.handleGreeksUpdate(data);
            });
            
            // Listen for alerts that might affect income calculations
            this.greeksStreamer.on('alerts', (alerts) => {
                this.handleRiskAlerts(alerts.alerts);
            });
            
            this.logger.info('INCOME-CALC', '🎯 Greeks streaming integration enabled');
        }
    }

    /**
     * Handle real-time Greeks updates for income adjustments
     */
    handleGreeksUpdate(data) {
        try {
            const { portfolio, timestamp } = data;
            if (!portfolio) return;
            
            // Check if portfolio risk affects income targets
            const riskScore = portfolio.riskScore || 100;
            
            if (riskScore < 60) {
                // High risk - recommend reducing position sizes
                this.logger.warn('INCOME-CALC', '⚠️ High portfolio risk detected, reducing income targets', {
                    riskScore,
                    portfolioDelta: portfolio.delta,
                    timestamp
                });
                
                this.adjustIncomeForRisk(riskScore);
            }
            
            // Update theta income projections based on real Greeks
            if (portfolio.theta) {
                this.updateThetaProjections(portfolio.theta, portfolio.monthlyThetaProjection);
            }
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error handling Greeks update', error);
        }
    }

    /**
     * Handle risk alerts that might affect income calculations
     */
    handleRiskAlerts(alerts) {
        try {
            for (const alert of alerts) {
                if (alert.severity === 'CRITICAL') {
                    this.logger.error('INCOME-CALC', `🚨 Critical risk alert: ${alert.message}`, {
                        type: alert.type,
                        system: alert.system
                    });
                    
                    // Adjust income calculations based on alert type
                    if (alert.type === 'CRITICAL_DELTA') {
                        this.adjustForDeltaRisk(alert.data);
                    } else if (alert.type === 'CRITICAL_BP_USAGE') {
                        this.adjustForBuyingPowerRisk(alert.data);
                    }
                }
            }
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error handling risk alerts', error);
        }
    }

    /**
     * Adjust income targets based on portfolio risk
     */
    adjustIncomeForRisk(riskScore) {
        try {
            // Calculate risk adjustment factor (reduce targets when risk is high)
            const riskAdjustment = Math.max(0.5, riskScore / 100);
            
            // Store original targets if not already stored
            if (!this.originalTargets) {
                this.originalTargets = { ...this.config.phaseTargets };
            }
            
            // Apply risk adjustment to all phase targets
            for (const phase in this.config.phaseTargets) {
                this.config.phaseTargets[phase] = Math.round(
                    this.originalTargets[phase] * riskAdjustment
                );
            }
            
            this.logger.info('INCOME-CALC', '📉 Income targets adjusted for risk', {
                riskScore,
                riskAdjustment: (riskAdjustment * 100).toFixed(1) + '%',
                adjustedTargets: this.config.phaseTargets
            });
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error adjusting income for risk', error);
        }
    }

    /**
     * Adjust calculations for delta risk
     */
    adjustForDeltaRisk(alertData) {
        try {
            const deltaExposure = Math.abs(alertData.delta || 0);
            
            // Reduce 0DTE allocation if delta risk is high
            if (deltaExposure > 200) {
                this.config.strategyAllocation.dte0 = Math.max(0.2, this.config.strategyAllocation.dte0 * 0.8);
                this.config.strategyAllocation.lt112 = Math.min(0.5, this.config.strategyAllocation.lt112 * 1.1);
                
                this.logger.warn('INCOME-CALC', '⚠️ Strategy allocation adjusted for delta risk', {
                    deltaExposure,
                    newAllocation: this.config.strategyAllocation
                });
            }
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error adjusting for delta risk', error);
        }
    }

    /**
     * Adjust calculations for buying power risk
     */
    adjustForBuyingPowerRisk(alertData) {
        try {
            const bpUsage = alertData.bpUsage || 0;
            
            if (bpUsage > 0.4) {
                // Reduce all BP limits by 10%
                this.config.bpLimits.dte0 = Math.max(0.1, this.config.bpLimits.dte0 * 0.9);
                this.config.bpLimits.lt112 = Math.max(0.15, this.config.bpLimits.lt112 * 0.9);
                this.config.bpLimits.strangles = Math.max(0.15, this.config.bpLimits.strangles * 0.9);
                this.config.bpLimits.total = Math.max(0.25, this.config.bpLimits.total * 0.9);
                
                this.logger.warn('INCOME-CALC', '⚠️ BP limits reduced for safety', {
                    bpUsage: (bpUsage * 100).toFixed(1) + '%',
                    newLimits: this.config.bpLimits
                });
            }
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error adjusting for BP risk', error);
        }
    }

    /**
     * Update theta income projections based on real Greeks
     */
    updateThetaProjections(dailyTheta, monthlyProjection) {
        try {
            // Store real theta data for comparison with theoretical calculations
            this.realThetaData = {
                daily: dailyTheta,
                monthly: monthlyProjection,
                timestamp: new Date()
            };
            
            // If real theta is significantly different from projections, log it
            if (Math.abs(dailyTheta) > 100) { // Significant theta income/decay
                this.logger.info('INCOME-CALC', '💰 Significant theta activity detected', {
                    dailyTheta: dailyTheta.toFixed(2),
                    monthlyProjection: monthlyProjection?.toFixed(2),
                    annualizedIncome: (dailyTheta * 252).toFixed(0) // 252 trading days
                });
            }
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error updating theta projections', error);
        }
    }

    /**
     * Calculate Greeks-adjusted monthly requirements
     */
    calculateGreeksAdjustedRequirements(accountValue, targetMonthly = null, vixLevel = 20) {
        try {
            // Get base requirements
            const baseRequirements = this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly, vixLevel);
            
            // If Greeks streamer is available, apply real-time adjustments
            if (this.greeksStreamer) {
                const portfolioGreeks = this.greeksStreamer.getPortfolioGreeks();
                
                if (portfolioGreeks) {
                    // Adjust based on current risk score
                    if (portfolioGreeks.riskScore < 70) {
                        const riskAdjustment = portfolioGreeks.riskScore / 100;
                        
                        // Reduce contract requirements based on risk
                        baseRequirements.strategies.dte0.contractsNeeded = Math.floor(
                            baseRequirements.strategies.dte0.contractsNeeded * riskAdjustment
                        );
                        baseRequirements.strategies.lt112.contractsNeeded = Math.floor(
                            baseRequirements.strategies.lt112.contractsNeeded * riskAdjustment
                        );
                        baseRequirements.strategies.strangles.contractsNeeded = Math.floor(
                            baseRequirements.strategies.strangles.contractsNeeded * riskAdjustment
                        );
                        
                        // Recalculate expected income
                        baseRequirements.strategies.dte0.expectedIncome *= riskAdjustment;
                        baseRequirements.strategies.lt112.expectedIncome *= riskAdjustment;
                        baseRequirements.strategies.strangles.expectedIncome *= riskAdjustment;
                        
                        // Update totals
                        baseRequirements.totals.expectedMonthlyIncome = 
                            baseRequirements.strategies.dte0.expectedIncome + 
                            baseRequirements.strategies.lt112.expectedIncome + 
                            baseRequirements.strategies.strangles.expectedIncome;
                        
                        baseRequirements.totals.totalContracts = 
                            baseRequirements.strategies.dte0.contractsNeeded + 
                            baseRequirements.strategies.lt112.contractsNeeded + 
                            baseRequirements.strategies.strangles.contractsNeeded;
                        
                        baseRequirements.greeksAdjustment = {
                            applied: true,
                            riskScore: portfolioGreeks.riskScore,
                            adjustment: riskAdjustment,
                            reason: 'Portfolio risk adjustment'
                        };
                        
                        this.logger.info('INCOME-CALC', '⚖️ Greeks-based adjustments applied', {
                            riskScore: portfolioGreeks.riskScore,
                            adjustment: (riskAdjustment * 100).toFixed(1) + '%'
                        });
                    }
                    
                    // Add real Greeks data to response
                    baseRequirements.realTimeGreeks = {
                        portfolioDelta: portfolioGreeks.delta,
                        portfolioGamma: portfolioGreeks.gamma,
                        portfolioTheta: portfolioGreeks.theta,
                        portfolioVega: portfolioGreeks.vega,
                        riskScore: portfolioGreeks.riskScore,
                        timestamp: portfolioGreeks.timestamp
                    };
                }
            }
            
            return baseRequirements;
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error calculating Greeks-adjusted requirements', error);
            return this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly, vixLevel);
        }
    }

    /**
     * Reset risk adjustments to original targets
     */
    resetRiskAdjustments() {
        try {
            if (this.originalTargets) {
                this.config.phaseTargets = { ...this.originalTargets };
                this.originalTargets = null;
                
                this.logger.info('INCOME-CALC', '🔄 Risk adjustments reset to original targets');
            }
            
        } catch (error) {
            this.logger.error('INCOME-CALC', '🚨 Error resetting risk adjustments', error);
        }
    }
    
    /**
     * Compatibility method for test suite - maps to calculateMonthlyIncomeRequirements
     */
    calculateRequiredPositions(accountValue, phase = null) {
        // Determine target monthly income based on phase
        let targetMonthly;
        if (phase && this.config.phaseTargets[phase]) {
            targetMonthly = this.config.phaseTargets[phase];
        } else {
            // Auto-determine phase based on account value
            const determinedPhase = this.determineAccountPhase(accountValue);
            targetMonthly = this.config.phaseTargets[determinedPhase];
        }
        
        return this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly);
    }
    
    /**
     * Compatibility method for test suite - alias for calculateMonthlyIncomeRequirements
     */
    calculateMonthlyIncome(accountValue, targetMonthly = null, vixLevel = 20) {
        return this.calculateMonthlyIncomeRequirements(accountValue, targetMonthly, vixLevel);
    }

    /**
     * Get Greeks integration status
     */
    getGreeksIntegrationStatus() {
        return {
            greeksStreamerConnected: !!this.greeksStreamer,
            realThetaDataAvailable: !!this.realThetaData,
            riskAdjustmentsActive: !!this.originalTargets,
            lastGreeksUpdate: this.realThetaData?.timestamp || null
        };
    }
}

module.exports = { MonthlyIncomeCalculator };