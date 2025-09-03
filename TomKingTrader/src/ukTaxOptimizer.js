/**
 * UK TAX OPTIMIZER
 * Simplified tax optimization specifically for UK citizens trading US options
 * 
 * IMPORTANT: UK citizens are NOT subject to US tax on trading profits
 * This module focuses ONLY on UK tax obligations and optimization
 */

class UKTaxOptimizer {
    constructor() {
        // UK Tax Year: April 6 - April 5
        this.taxYear = this.getCurrentTaxYear();
        
        // 2024/25 UK Tax Rates
        this.config = {
            // Capital Gains Tax
            cgt: {
                annualAllowance: 3000,  // £3,000 for 2024/25 (reduced from £6,000)
                basicRate: 0.10,        // 10% for basic rate taxpayers
                higherRate: 0.20,       // 20% for higher rate taxpayers
                additionalRate: 0.20    // 20% for additional rate taxpayers
            },
            
            // Income Tax Thresholds (for determining CGT rate)
            incomeTax: {
                personalAllowance: 12570,
                basicRateLimit: 50270,
                higherRateLimit: 125140,
                additionalRateThreshold: 125140
            },
            
            // Currency
            defaultExchangeRate: 1.28  // GBP/USD
        };
        
        // Track tax year positions
        this.taxYearPositions = {
            realized: [],
            unrealized: [],
            totalGains: 0,
            totalLosses: 0,
            allowanceUsed: 0,
            allowanceRemaining: this.config.cgt.annualAllowance
        };
    }
    
    /**
     * Validate UK tax compliance for a trade
     */
    validateUKTaxCompliance(trade) {
        // Handle different parameter formats
        const annualIncome = trade.annualIncome || 50000;
        const tradingProfit = trade.tradingProfit || trade.profit || 0;
        const allowableExpenses = trade.allowableExpenses || 0;
        
        // Calculate net trading profit after expenses
        const netTradingProfit = Math.max(0, tradingProfit - allowableExpenses);
        
        // Calculate CGT liability
        const taxableGains = Math.max(0, netTradingProfit - this.config.cgt.annualAllowance);
        let cgtRate = this.config.cgt.basicRate; // Default to basic rate
        
        // Determine CGT rate based on total income
        if (annualIncome > this.config.incomeTax.higherRateLimit) {
            cgtRate = this.config.cgt.additionalRate;
        } else if (annualIncome > this.config.incomeTax.basicRateLimit) {
            cgtRate = this.config.cgt.higherRate;
        }
        
        const cgtLiability = taxableGains * cgtRate;
        
        return {
            compliant: true,
            requiresReporting: netTradingProfit > this.config.cgt.annualAllowance,
            taxYear: this.taxYear,
            allowanceRemaining: Math.max(0, this.config.cgt.annualAllowance - netTradingProfit),
            calculations: {
                annualIncome,
                tradingProfit: netTradingProfit,
                allowableExpenses,
                taxableGains,
                cgtRate,
                totalTaxLiability: cgtLiability
            }
        };
    }
    
    /**
     * Generate quarterly tax estimates for UK taxpayers
     */
    generateQuarterlyTaxEstimates(params) {
        // Handle different parameter formats
        const ytdTradingProfit = typeof params === 'number' ? params : (params.ytdTradingProfit || 15000);
        const annualTargetIncome = typeof params === 'object' ? (params.annualTargetIncome || 60000) : 60000;
        
        const quarters = [];
        const quarterlyProfit = ytdTradingProfit / 4;
        
        for (let q = 1; q <= 4; q++) {
            const quarterProfit = quarterlyProfit * q;
            const taxableAmount = Math.max(0, quarterProfit - this.config.cgt.annualAllowance);
            
            // Determine rate based on income
            let cgtRate = this.config.cgt.basicRate;
            if (annualTargetIncome > this.config.incomeTax.basicRateLimit) {
                cgtRate = this.config.cgt.higherRate;
            }
            
            const estimatedPayment = Math.max(0, taxableAmount * cgtRate);
            
            quarters.push({
                quarter: q,
                cumulativeProfit: quarterProfit,
                taxableAmount,
                estimatedPayment, // Changed from estimatedTax
                dueDate: this.getQuarterlyDueDate(q),
                cgtRate
            });
        }
        
        return quarters;
    }
    
    /**
     * Calculate estimated tax on profits
     */
    calculateEstimatedTax(profit) {
        if (profit <= 0) return 0;
        
        // Check if within annual allowance
        const remainingAllowance = this.taxYearPositions.allowanceRemaining;
        if (profit <= remainingAllowance) {
            return 0; // No tax if within allowance
        }
        
        // Calculate taxable amount
        const taxableAmount = profit - remainingAllowance;
        
        // Assume higher rate for conservative estimate
        return taxableAmount * this.config.cgt.higherRate;
    }
    
    /**
     * Get quarterly payment due date
     */
    getQuarterlyDueDate(quarter) {
        const year = new Date().getFullYear();
        const dates = {
            1: new Date(year, 6, 31),  // July 31
            2: new Date(year, 9, 31),  // October 31
            3: new Date(year + 1, 0, 31), // January 31
            4: new Date(year + 1, 3, 30)  // April 30
        };
        return dates[quarter];
    }
    
    /**
     * Get current UK tax year
     */
    getCurrentTaxYear() {
        const now = new Date();
        const year = now.getFullYear();
        const taxYearStart = new Date(year, 3, 6); // April 6
        
        if (now < taxYearStart) {
            return `${year - 1}/${year.toString().slice(2)}`;
        } else {
            return `${year}/${(year + 1).toString().slice(2)}`;
        }
    }
    
    /**
     * Calculate UK tax liability for trading positions
     */
    calculateUKTaxLiability(positions, annualIncome = 50000) {
        const analysis = {
            taxYear: this.taxYear,
            timestamp: new Date().toISOString(),
            
            // Position Analysis
            positions: {
                total: positions.length,
                realized: 0,
                unrealized: 0
            },
            
            // P&L in USD
            usd: {
                realizedGains: 0,
                realizedLosses: 0,
                unrealizedGains: 0,
                unrealizedLosses: 0,
                netRealized: 0,
                netUnrealized: 0
            },
            
            // P&L in GBP
            gbp: {
                realizedGains: 0,
                realizedLosses: 0,
                netRealized: 0,
                allowanceUsed: 0,
                allowanceRemaining: this.config.cgt.annualAllowance,
                taxableGains: 0
            },
            
            // Tax Calculation
            tax: {
                rate: this.determineCGTRate(annualIncome),
                liability: 0,
                effectiveRate: 0
            },
            
            // Optimization Opportunities
            optimization: {
                lossHarvestingAvailable: 0,
                allowanceUtilization: 0,
                recommendations: []
            }
        };
        
        // Process positions
        positions.forEach(pos => {
            const pl = pos.pl || 0;
            
            if (pos.closeDate) {
                // Realized position
                analysis.positions.realized++;
                if (pl > 0) {
                    analysis.usd.realizedGains += pl;
                } else {
                    analysis.usd.realizedLosses += Math.abs(pl);
                }
            } else {
                // Unrealized position
                analysis.positions.unrealized++;
                if (pl > 0) {
                    analysis.usd.unrealizedGains += pl;
                } else {
                    analysis.usd.unrealizedLosses += Math.abs(pl);
                }
            }
        });
        
        // Calculate net amounts
        analysis.usd.netRealized = analysis.usd.realizedGains - analysis.usd.realizedLosses;
        analysis.usd.netUnrealized = analysis.usd.unrealizedGains - analysis.usd.unrealizedLosses;
        
        // Convert to GBP
        const exchangeRate = this.config.defaultExchangeRate;
        analysis.gbp.realizedGains = Math.round(analysis.usd.realizedGains / exchangeRate);
        analysis.gbp.realizedLosses = Math.round(analysis.usd.realizedLosses / exchangeRate);
        analysis.gbp.netRealized = Math.round(analysis.usd.netRealized / exchangeRate);
        
        // Apply CGT allowance
        if (analysis.gbp.netRealized > 0) {
            analysis.gbp.allowanceUsed = Math.min(
                analysis.gbp.netRealized,
                this.config.cgt.annualAllowance
            );
            analysis.gbp.allowanceRemaining = Math.max(
                0,
                this.config.cgt.annualAllowance - analysis.gbp.allowanceUsed
            );
            analysis.gbp.taxableGains = Math.max(
                0,
                analysis.gbp.netRealized - this.config.cgt.annualAllowance
            );
        }
        
        // Calculate tax liability
        if (analysis.gbp.taxableGains > 0) {
            analysis.tax.liability = Math.round(
                analysis.gbp.taxableGains * analysis.tax.rate
            );
            analysis.tax.effectiveRate = 
                (analysis.tax.liability / analysis.gbp.netRealized) * 100;
        }
        
        // Calculate optimization metrics
        analysis.optimization.allowanceUtilization = 
            (analysis.gbp.allowanceUsed / this.config.cgt.annualAllowance) * 100;
        
        analysis.optimization.lossHarvestingAvailable = 
            Math.round(analysis.usd.unrealizedLosses / exchangeRate);
        
        // Generate recommendations
        analysis.optimization.recommendations = 
            this.generateTaxRecommendations(analysis);
        
        return analysis;
    }
    
    /**
     * Determine CGT rate based on income
     */
    determineCGTRate(annualIncome) {
        if (annualIncome <= this.config.incomeTax.basicRateLimit) {
            return this.config.cgt.basicRate;
        } else if (annualIncome <= this.config.incomeTax.higherRateLimit) {
            return this.config.cgt.higherRate;
        } else {
            return this.config.cgt.additionalRate;
        }
    }
    
    /**
     * Generate tax optimization recommendations
     */
    generateTaxRecommendations(analysis) {
        const recommendations = [];
        
        // Allowance utilization
        if (analysis.optimization.allowanceUtilization < 50) {
            recommendations.push({
                priority: 'HIGH',
                category: 'ALLOWANCE',
                action: 'Realize more gains to utilize CGT allowance',
                detail: `Only ${Math.round(analysis.optimization.allowanceUtilization)}% of £${this.config.cgt.annualAllowance} allowance used`,
                benefit: `Up to £${analysis.gbp.allowanceRemaining} in tax-free gains available`
            });
        } else if (analysis.optimization.allowanceUtilization === 100 && analysis.gbp.taxableGains > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'TIMING',
                action: 'Consider deferring additional gains to next tax year',
                detail: `£${analysis.gbp.taxableGains} subject to CGT at ${analysis.tax.rate * 100}%`,
                benefit: `Save £${analysis.tax.liability} by using next year's allowance`
            });
        }
        
        // Loss harvesting
        if (analysis.optimization.lossHarvestingAvailable > 100) {
            recommendations.push({
                priority: 'HIGH',
                category: 'HARVESTING',
                action: 'Harvest unrealized losses to offset gains',
                detail: `£${analysis.optimization.lossHarvestingAvailable} in losses available`,
                benefit: 'Reduce taxable gains and CGT liability'
            });
        }
        
        // Tax year timing
        const daysToYearEnd = this.getDaysToTaxYearEnd();
        if (daysToYearEnd < 30) {
            recommendations.push({
                priority: 'URGENT',
                category: 'YEAR_END',
                action: 'Review positions before tax year end',
                detail: `${daysToYearEnd} days until April 5`,
                benefit: 'Optimize gain/loss realization timing'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Calculate days until tax year end
     */
    getDaysToTaxYearEnd() {
        const now = new Date();
        const year = now.getFullYear();
        let taxYearEnd = new Date(year, 3, 5); // April 5
        
        if (now > taxYearEnd) {
            taxYearEnd = new Date(year + 1, 3, 5);
        }
        
        return Math.ceil((taxYearEnd - now) / (1000 * 60 * 60 * 24));
    }
    
    /**
     * Plan optimal gain/loss realization
     */
    planOptimalRealization(positions, targetIncome = null) {
        const plan = {
            timestamp: new Date().toISOString(),
            taxYear: this.taxYear,
            daysRemaining: this.getDaysToTaxYearEnd(),
            
            currentStatus: {
                unrealizedGains: [],
                unrealizedLosses: [],
                totalUnrealizedGainsGBP: 0,
                totalUnrealizedLossesGBP: 0
            },
            
            recommendations: {
                immediate: [],
                beforeYearEnd: [],
                nextTaxYear: []
            },
            
            optimal: {
                gainsToRealize: [],
                lossesToHarvest: [],
                netTaxPosition: 0,
                estimatedTax: 0
            }
        };
        
        const exchangeRate = this.config.defaultExchangeRate;
        
        // Categorize unrealized positions
        positions.forEach(pos => {
            if (!pos.closeDate && pos.pl) {
                const plGBP = pos.pl / exchangeRate;
                
                if (pos.pl > 0) {
                    plan.currentStatus.unrealizedGains.push({
                        symbol: pos.symbol,
                        plUSD: pos.pl,
                        plGBP: Math.round(plGBP)
                    });
                    plan.currentStatus.totalUnrealizedGainsGBP += plGBP;
                } else {
                    plan.currentStatus.unrealizedLosses.push({
                        symbol: pos.symbol,
                        plUSD: pos.pl,
                        plGBP: Math.round(plGBP)
                    });
                    plan.currentStatus.totalUnrealizedLossesGBP += Math.abs(plGBP);
                }
            }
        });
        
        // Round totals
        plan.currentStatus.totalUnrealizedGainsGBP = 
            Math.round(plan.currentStatus.totalUnrealizedGainsGBP);
        plan.currentStatus.totalUnrealizedLossesGBP = 
            Math.round(plan.currentStatus.totalUnrealizedLossesGBP);
        
        // Determine optimal realization strategy
        const allowanceRemaining = this.taxYearPositions.allowanceRemaining;
        
        // Prioritize gains that fit within remaining allowance
        let remainingAllowance = allowanceRemaining;
        plan.currentStatus.unrealizedGains
            .sort((a, b) => a.plGBP - b.plGBP)
            .forEach(gain => {
                if (gain.plGBP <= remainingAllowance) {
                    plan.optimal.gainsToRealize.push(gain);
                    remainingAllowance -= gain.plGBP;
                    
                    plan.recommendations.immediate.push({
                        action: `Realize ${gain.symbol} gain`,
                        amount: `£${gain.plGBP}`,
                        reason: 'Fits within CGT allowance'
                    });
                }
            });
        
        // Plan for losses
        if (plan.currentStatus.totalUnrealizedLossesGBP > 0) {
            if (plan.currentStatus.totalUnrealizedGainsGBP > allowanceRemaining) {
                // Harvest losses to offset gains above allowance
                plan.recommendations.beforeYearEnd.push({
                    action: 'Harvest losses to offset gains',
                    amount: `£${plan.currentStatus.totalUnrealizedLossesGBP}`,
                    reason: 'Reduce taxable gains'
                });
            } else {
                // Carry losses forward
                plan.recommendations.nextTaxYear.push({
                    action: 'Consider carrying losses to next year',
                    amount: `£${plan.currentStatus.totalUnrealizedLossesGBP}`,
                    reason: 'Insufficient gains to offset this year'
                });
            }
        }
        
        return plan;
    }
    
    /**
     * Track position for tax purposes
     */
    trackPosition(position) {
        if (position.closeDate) {
            this.taxYearPositions.realized.push(position);
            
            const plGBP = (position.pl || 0) / this.config.defaultExchangeRate;
            if (plGBP > 0) {
                this.taxYearPositions.totalGains += plGBP;
            } else {
                this.taxYearPositions.totalLosses += Math.abs(plGBP);
            }
            
            // Update allowance tracking
            const netGains = this.taxYearPositions.totalGains - this.taxYearPositions.totalLosses;
            this.taxYearPositions.allowanceUsed = Math.min(
                netGains,
                this.config.cgt.annualAllowance
            );
            this.taxYearPositions.allowanceRemaining = Math.max(
                0,
                this.config.cgt.annualAllowance - this.taxYearPositions.allowanceUsed
            );
        } else {
            this.taxYearPositions.unrealized.push(position);
        }
    }
    
    /**
     * Generate year-end tax report
     */
    generateYearEndReport() {
        const report = {
            taxYear: this.taxYear,
            generatedDate: new Date().toISOString(),
            
            summary: {
                totalTrades: this.taxYearPositions.realized.length,
                totalGainsGBP: Math.round(this.taxYearPositions.totalGains),
                totalLossesGBP: Math.round(this.taxYearPositions.totalLosses),
                netGainsGBP: Math.round(this.taxYearPositions.totalGains - this.taxYearPositions.totalLosses),
                
                allowanceUsed: Math.round(this.taxYearPositions.allowanceUsed),
                allowanceRemaining: Math.round(this.taxYearPositions.allowanceRemaining),
                
                taxableGains: Math.max(
                    0,
                    Math.round(this.taxYearPositions.totalGains - this.taxYearPositions.totalLosses - this.config.cgt.annualAllowance)
                )
            },
            
            monthlyBreakdown: this.generateMonthlyBreakdown(),
            
            topGains: this.getTopPositions(true, 5),
            topLosses: this.getTopPositions(false, 5),
            
            taxCalculation: this.calculateFinalTax()
        };
        
        return report;
    }
    
    /**
     * Generate monthly P&L breakdown
     */
    generateMonthlyBreakdown() {
        const months = {};
        
        this.taxYearPositions.realized.forEach(pos => {
            if (pos.closeDate) {
                const month = new Date(pos.closeDate).toISOString().slice(0, 7);
                if (!months[month]) {
                    months[month] = { gains: 0, losses: 0, net: 0, trades: 0 };
                }
                
                const plGBP = (pos.pl || 0) / this.config.defaultExchangeRate;
                months[month].trades++;
                
                if (plGBP > 0) {
                    months[month].gains += plGBP;
                } else {
                    months[month].losses += Math.abs(plGBP);
                }
                months[month].net = months[month].gains - months[month].losses;
            }
        });
        
        // Round all values
        Object.keys(months).forEach(month => {
            months[month].gains = Math.round(months[month].gains);
            months[month].losses = Math.round(months[month].losses);
            months[month].net = Math.round(months[month].net);
        });
        
        return months;
    }
    
    /**
     * Get top gaining or losing positions
     */
    getTopPositions(gains = true, limit = 5) {
        return this.taxYearPositions.realized
            .filter(pos => gains ? pos.pl > 0 : pos.pl < 0)
            .sort((a, b) => gains ? b.pl - a.pl : a.pl - b.pl)
            .slice(0, limit)
            .map(pos => ({
                symbol: pos.symbol,
                plUSD: pos.pl,
                plGBP: Math.round(pos.pl / this.config.defaultExchangeRate),
                date: pos.closeDate
            }));
    }
    
    /**
     * Calculate final tax liability
     */
    calculateFinalTax(annualIncome = 50000) {
        const netGains = this.taxYearPositions.totalGains - this.taxYearPositions.totalLosses;
        const taxableGains = Math.max(0, netGains - this.config.cgt.annualAllowance);
        const rate = this.determineCGTRate(annualIncome);
        const tax = Math.round(taxableGains * rate);
        
        return {
            netGainsGBP: Math.round(netGains),
            allowanceApplied: Math.min(netGains, this.config.cgt.annualAllowance),
            taxableGainsGBP: Math.round(taxableGains),
            cgtRate: rate,
            taxLiabilityGBP: tax,
            effectiveRate: netGains > 0 ? (tax / netGains) * 100 : 0
        };
    }
}

module.exports = { UKTaxOptimizer };