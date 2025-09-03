/**
 * UK Tax Tracking Module
 * Comprehensive tracking for UK capital gains and income tax on trading
 * Designed for UK residents trading options and futures
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const fs = require('fs').promises;
const path = require('path');

const logger = getLogger();

class UKTaxTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            taxYear: config.taxYear || this.getCurrentTaxYear(),
            personalAllowance: config.personalAllowance || 12570, // 2024/25 personal allowance
            capitalGainsAllowance: config.capitalGainsAllowance || 3000, // 2024/25 CGT allowance (reduced from £6000)
            basicRateThreshold: config.basicRateThreshold || 50270, // £12,570 + £37,700
            higherRateThreshold: config.higherRateThreshold || 125140,
            ...config
        };
        
        // Tax rates for 2024/25
        this.taxRates = {
            capitalGains: {
                basic: 0.10,    // 10% for basic rate taxpayers
                higher: 0.20    // 20% for higher/additional rate taxpayers
            },
            income: {
                basic: 0.20,    // 20% basic rate
                higher: 0.40,   // 40% higher rate
                additional: 0.45 // 45% additional rate
            },
            dividend: {
                basic: 0.0875,   // 8.75% basic rate
                higher: 0.3375,  // 33.75% higher rate
                additional: 0.3937 // 39.375% additional rate
            },
            dividendAllowance: 500 // £500 dividend allowance 2024/25
        };
        
        // Trade tracking
        this.trades = [];
        this.positions = new Map(); // Open positions for Section 104 pooling
        this.taxableEvents = [];
        this.currentYearGains = 0;
        this.currentYearLosses = 0;
        this.carriedLosses = config.carriedLosses || 0; // Losses from previous years
        
        // Income tracking (for premium income from options)
        this.premiumIncome = 0;
        this.dividendIncome = 0;
        
        // Reports
        this.reportPath = config.reportPath || path.join(__dirname, '..', 'tax_reports');
    }
    
    /**
     * Get current UK tax year (April 6 to April 5)
     */
    getCurrentTaxYear() {
        const now = new Date();
        const year = now.getFullYear();
        const taxYearStart = new Date(year, 3, 6); // April 6
        
        if (now >= taxYearStart) {
            return `${year}/${(year + 1).toString().slice(2)}`;
        } else {
            return `${year - 1}/${year.toString().slice(2)}`;
        }
    }
    
    /**
     * Record a completed trade
     */
    async recordTrade(trade) {
        logger.info('UK_TAX', 'Recording trade for tax purposes', {
            symbol: trade.symbol,
            type: trade.type,
            pnl: trade.pnl
        });
        
        // Determine trade classification
        const classification = this.classifyTrade(trade);
        
        // Add to trades list
        this.trades.push({
            ...trade,
            classification,
            taxYear: this.getCurrentTaxYear(),
            timestamp: trade.timestamp || new Date()
        });
        
        // Process based on classification
        switch(classification) {
            case 'CAPITAL_GAIN':
                await this.processCapitalGain(trade);
                break;
                
            case 'INCOME':
                await this.processIncome(trade);
                break;
                
            case 'MIXED':
                await this.processMixedTrade(trade);
                break;
        }
        
        // Emit event
        this.emit('tradeRecorded', {
            trade,
            classification,
            currentYearGains: this.currentYearGains,
            currentYearLosses: this.currentYearLosses
        });
    }
    
    /**
     * Classify trade for tax purposes
     * UK tax treatment of options can be complex
     */
    classifyTrade(trade) {
        // Options premium received (writing options) is typically income
        if (trade.type === 'OPTION_WRITE' || trade.type === 'COVERED_CALL') {
            return 'INCOME';
        }
        
        // Buying and selling options is typically capital gains
        if (trade.type === 'OPTION_BUY' || trade.type === 'OPTION_SELL') {
            return 'CAPITAL_GAIN';
        }
        
        // Futures are typically capital gains
        if (trade.type === 'FUTURES') {
            return 'CAPITAL_GAIN';
        }
        
        // Complex strategies might be mixed
        if (trade.type === 'SPREAD' || trade.type === 'STRANGLE' || trade.type === 'IRON_CONDOR') {
            // For Tom King strategies, the net result is usually capital gains
            // but premium received initially might be income
            return 'MIXED';
        }
        
        // Default to capital gains
        return 'CAPITAL_GAIN';
    }
    
    /**
     * Process capital gains/losses
     */
    async processCapitalGain(trade) {
        const gain = trade.pnl || 0;
        
        if (gain > 0) {
            this.currentYearGains += gain;
        } else {
            this.currentYearLosses += Math.abs(gain);
        }
        
        // Use Section 104 pooling for shares/ETFs
        if (trade.assetType === 'SHARE' || trade.assetType === 'ETF') {
            await this.updateSection104Pool(trade);
        }
        
        // Record taxable event
        this.taxableEvents.push({
            type: 'CAPITAL_GAIN',
            date: trade.closeDate || new Date(),
            asset: trade.symbol,
            acquisition: trade.openDate,
            disposal: trade.closeDate,
            proceeds: trade.closePrice * trade.quantity,
            cost: trade.openPrice * trade.quantity,
            gain: gain,
            taxYear: this.getCurrentTaxYear()
        });
    }
    
    /**
     * Process income (e.g., option premiums)
     */
    async processIncome(trade) {
        const income = trade.premium || trade.pnl || 0;
        
        if (income > 0) {
            this.premiumIncome += income;
            
            this.taxableEvents.push({
                type: 'INCOME',
                date: trade.date || new Date(),
                source: `Option Premium - ${trade.symbol}`,
                amount: income,
                taxYear: this.getCurrentTaxYear()
            });
        }
    }
    
    /**
     * Process mixed trades (e.g., complex option strategies)
     */
    async processMixedTrade(trade) {
        // Split into income and capital components
        if (trade.premiumReceived) {
            await this.processIncome({
                ...trade,
                pnl: trade.premiumReceived
            });
        }
        
        if (trade.capitalGain !== undefined) {
            await this.processCapitalGain({
                ...trade,
                pnl: trade.capitalGain
            });
        }
    }
    
    /**
     * Update Section 104 pool for share holdings
     */
    async updateSection104Pool(trade) {
        const symbol = trade.symbol;
        
        if (!this.positions.has(symbol)) {
            this.positions.set(symbol, {
                quantity: 0,
                totalCost: 0,
                acquisitions: []
            });
        }
        
        const pool = this.positions.get(symbol);
        
        if (trade.action === 'BUY') {
            // Add to pool
            pool.quantity += trade.quantity;
            pool.totalCost += trade.quantity * trade.price;
            pool.acquisitions.push({
                date: trade.date,
                quantity: trade.quantity,
                price: trade.price
            });
        } else if (trade.action === 'SELL') {
            // Remove from pool using average cost
            const avgCost = pool.totalCost / pool.quantity;
            const costBasis = avgCost * trade.quantity;
            const proceeds = trade.quantity * trade.price;
            const gain = proceeds - costBasis;
            
            pool.quantity -= trade.quantity;
            pool.totalCost -= costBasis;
            
            // Record the gain
            if (gain > 0) {
                this.currentYearGains += gain;
            } else {
                this.currentYearLosses += Math.abs(gain);
            }
        }
    }
    
    /**
     * Enhanced UK tax calculation with full compliance
     */
    calculateTaxLiability(totalIncome = 0) {
        const report = {
            taxYear: this.getCurrentTaxYear(),
            capitalGains: {
                gains: this.currentYearGains,
                losses: this.currentYearLosses,
                netGain: this.currentYearGains - this.currentYearLosses,
                carriedLosses: this.carriedLosses,
                allowanceUsed: 0,
                taxableGain: 0,
                tax: 0,
                breakdown: {}
            },
            income: {
                employmentIncome: totalIncome,
                premiumIncome: this.premiumIncome,
                dividendIncome: this.dividendIncome,
                totalIncome: totalIncome + this.premiumIncome + this.dividendIncome,
                personalAllowance: this.config.personalAllowance,
                taxableIncome: 0,
                tax: 0,
                nationalInsurance: 0,
                breakdown: {}
            },
            allowances: {
                personalAllowance: this.config.personalAllowance,
                capitalGainsAllowance: this.config.capitalGainsAllowance,
                dividendAllowance: this.taxRates.dividendAllowance,
                tradingAllowance: 1000 // £1000 trading allowance
            },
            totalTax: 0,
            effectiveRate: 0,
            takeHome: 0,
            optimizations: []
        };
        
        // Calculate capital gains tax
        let taxableGain = report.capitalGains.netGain;
        
        // Apply carried losses from previous years (can carry forward indefinitely)
        if (this.carriedLosses > 0 && taxableGain > 0) {
            const lossesUsed = Math.min(this.carriedLosses, taxableGain);
            taxableGain -= lossesUsed;
            report.capitalGains.carriedLosses = this.carriedLosses - lossesUsed;
            report.capitalGains.breakdown.lossesApplied = lossesUsed;
        }
        
        // Apply annual CGT exemption (£3000 for 2024/25)
        if (taxableGain > 0) {
            report.capitalGains.allowanceUsed = Math.min(taxableGain, this.config.capitalGainsAllowance);
            taxableGain = Math.max(0, taxableGain - this.config.capitalGainsAllowance);
        }
        report.capitalGains.taxableGain = taxableGain;
        
        // Calculate progressive income tax first (affects CGT rate)
        const incomeTax = this.calculateProgressiveIncomeTax(report.income.totalIncome);
        report.income = { ...report.income, ...incomeTax };
        
        // Calculate CGT based on remaining basic rate band
        if (taxableGain > 0) {
            const taxableIncome = incomeTax.taxableIncome;
            const remainingBasicBand = Math.max(0, this.config.basicRateThreshold - taxableIncome);
            
            if (remainingBasicBand > 0) {
                // Some gain taxed at basic rate
                const basicRateGain = Math.min(taxableGain, remainingBasicBand);
                const higherRateGain = taxableGain - basicRateGain;
                
                report.capitalGains.breakdown.basicRateGain = basicRateGain;
                report.capitalGains.breakdown.higherRateGain = higherRateGain;
                report.capitalGains.breakdown.basicRateTax = basicRateGain * this.taxRates.capitalGains.basic;
                report.capitalGains.breakdown.higherRateTax = higherRateGain * this.taxRates.capitalGains.higher;
                
                report.capitalGains.tax = 
                    report.capitalGains.breakdown.basicRateTax +
                    report.capitalGains.breakdown.higherRateTax;
            } else {
                // All gain taxed at higher rate
                report.capitalGains.breakdown.higherRateGain = taxableGain;
                report.capitalGains.tax = taxableGain * this.taxRates.capitalGains.higher;
            }
        }
        
        // Calculate National Insurance (Class 2 & 4 for self-employed traders)
        if (this.premiumIncome > 0) {
            report.income.nationalInsurance = this.calculateNationalInsurance(this.premiumIncome);
        }
        
        // Total tax calculation
        report.totalTax = report.capitalGains.tax + report.income.tax + report.income.nationalInsurance;
        report.effectiveRate = report.income.totalIncome > 0 ? 
            (report.totalTax / report.income.totalIncome) * 100 : 0;
        report.takeHome = report.income.totalIncome + report.capitalGains.netGain - report.totalTax;
        
        // Add tax optimization suggestions
        report.optimizations = this.generateTaxOptimizations(report);
        
        return report;
    }
    
    /**
     * Calculate progressive UK income tax
     */
    calculateProgressiveIncomeTax(totalIncome) {
        const result = {
            totalIncome: totalIncome,
            personalAllowance: this.config.personalAllowance,
            taxableIncome: 0,
            tax: 0,
            breakdown: {
                personalAllowance: 0,
                basicRate: 0,
                higherRate: 0,
                additionalRate: 0
            }
        };
        
        // Personal allowance tapering (reduces by £1 for every £2 over £100k)
        let allowance = this.config.personalAllowance;
        if (totalIncome > 100000) {
            const excess = totalIncome - 100000;
            allowance = Math.max(0, this.config.personalAllowance - (excess / 2));
        }
        result.personalAllowance = allowance;
        
        // Calculate taxable income
        result.taxableIncome = Math.max(0, totalIncome - allowance);
        
        if (result.taxableIncome === 0) return result;
        
        // Apply progressive tax bands
        let remainingIncome = result.taxableIncome;
        let tax = 0;
        
        // Basic rate band (£0 - £37,700 of taxable income)
        const basicRateBand = this.config.basicRateThreshold - this.config.personalAllowance;
        if (remainingIncome > 0) {
            const basicTaxable = Math.min(remainingIncome, basicRateBand);
            result.breakdown.basicRate = basicTaxable * this.taxRates.income.basic;
            tax += result.breakdown.basicRate;
            remainingIncome -= basicTaxable;
        }
        
        // Higher rate band (£37,701 - £125,140)
        const higherRateBand = this.config.higherRateThreshold - this.config.basicRateThreshold;
        if (remainingIncome > 0) {
            const higherTaxable = Math.min(remainingIncome, higherRateBand);
            result.breakdown.higherRate = higherTaxable * this.taxRates.income.higher;
            tax += result.breakdown.higherRate;
            remainingIncome -= higherTaxable;
        }
        
        // Additional rate (over £125,140)
        if (remainingIncome > 0) {
            result.breakdown.additionalRate = remainingIncome * this.taxRates.income.additional;
            tax += result.breakdown.additionalRate;
        }
        
        result.tax = tax;
        return result;
    }
    
    /**
     * Calculate National Insurance contributions
     */
    calculateNationalInsurance(tradingProfit) {
        let ni = 0;
        
        // Class 2 NICs (£3.45/week for 2024/25 if profits > £12,570)
        if (tradingProfit > 12570) {
            ni += 3.45 * 52; // Annual Class 2
        }
        
        // Class 4 NICs on trading profits
        if (tradingProfit > 12570) {
            // 6% on profits between £12,570 and £50,270
            const band1 = Math.min(tradingProfit - 12570, 50270 - 12570);
            ni += band1 * 0.06;
            
            // 2% on profits over £50,270
            if (tradingProfit > 50270) {
                ni += (tradingProfit - 50270) * 0.02;
            }
        }
        
        return ni;
    }
    
    /**
     * Generate tax optimization suggestions
     */
    generateTaxOptimizations(report) {
        const optimizations = [];
        
        // CGT optimizations
        if (report.capitalGains.taxableGain > 0) {
            optimizations.push({
                type: 'CGT_TIMING',
                description: 'Consider spreading disposals across tax years to use multiple annual exemptions',
                potentialSaving: this.config.capitalGainsAllowance * this.taxRates.capitalGains.higher
            });
            
            if (report.capitalGains.losses > 0) {
                optimizations.push({
                    type: 'LOSS_HARVESTING',
                    description: 'Realized losses can offset gains - consider timing of profitable trades',
                    currentBenefit: report.capitalGains.losses * this.taxRates.capitalGains.higher
                });
            }
        }
        
        // Income tax optimizations
        if (report.income.totalIncome > 100000 && report.income.totalIncome < 125140) {
            optimizations.push({
                type: 'PENSION_CONTRIBUTION',
                description: 'Pension contributions can restore personal allowance (60% effective relief)',
                potentialSaving: (report.income.totalIncome - 100000) * 0.6
            });
        }
        
        // ISA optimization
        optimizations.push({
            type: 'ISA_USAGE',
            description: 'Use £20,000 annual ISA allowance for tax-free trading',
            annualBenefit: 20000 * 0.05 * this.taxRates.capitalGains.higher // Assume 5% return
        });
        
        // Spouse optimization
        if (report.capitalGains.taxableGain > 0 || report.income.tax > 0) {
            optimizations.push({
                type: 'SPOUSAL_TRANSFER',
                description: 'Transfer assets to spouse to use their allowances and lower rate bands',
                note: 'No CGT on transfers between spouses'
            });
        }
        
        // Trading structure
        if (this.premiumIncome > 50000) {
            optimizations.push({
                type: 'COMPANY_STRUCTURE',
                description: 'Consider trading through a limited company (19% corporation tax)',
                potentialSaving: this.premiumIncome * (this.taxRates.income.higher - 0.19)
            });
        }
        
        return optimizations;
    }
    
    /**
     * Track trades for Bed & Breakfast rules (30-day rule)
     */
    checkBedAndBreakfast(trade) {
        // UK rules: selling and rebuying within 30 days
        // Must match these trades for CGT calculation
        const symbol = trade.symbol;
        const tradeDate = new Date(trade.date);
        
        // Look for matching trades within 30 days
        const matchingTrades = this.trades.filter(t => {
            if (t.symbol !== symbol) return false;
            const daysDiff = Math.abs((new Date(t.date) - tradeDate) / (1000 * 60 * 60 * 24));
            return daysDiff <= 30 && t.id !== trade.id;
        });
        
        if (matchingTrades.length > 0) {
            return {
                applies: true,
                matchingTrades,
                warning: 'Bed & Breakfast rules apply - specific matching required'
            };
        }
        
        return { applies: false };
    }
    
    /**
     * Generate HMRC-compatible tax report
     */
    async generateHMRCReport() {
        const report = this.calculateTaxLiability();
        
        const hmrcReport = {
            taxYear: report.taxYear,
            personalDetails: {
                utr: 'USER_UTR', // User's Unique Taxpayer Reference
                nino: 'USER_NINO' // National Insurance Number
            },
            selfAssessment: {
                // SA108 - Capital Gains summary
                sa108: {
                    totalGains: report.capitalGains.gains,
                    totalLosses: report.capitalGains.losses,
                    netGain: report.capitalGains.netGain,
                    annualExempt: report.capitalGains.allowanceUsed,
                    taxableGains: report.capitalGains.taxableGain,
                    taxDue: report.capitalGains.tax,
                    lossesCarriedForward: report.capitalGains.carriedLosses
                },
                // SA103 - Self-employment (for trading income)
                sa103: {
                    tradingIncome: this.premiumIncome,
                    allowableExpenses: this.calculateAllowableExpenses(),
                    netProfit: this.premiumIncome - this.calculateAllowableExpenses(),
                    class2NIC: report.income.nationalInsurance,
                    class4NIC: 0 // Calculated separately
                }
            },
            payment: {
                totalTaxDue: report.totalTax,
                paymentOnAccount: report.totalTax / 2, // Each payment on account
                balancingPayment: 0, // Calculated after year end
                dueDate: this.getPaymentDueDate()
            },
            tradeList: this.generateTradeList()
        };
        
        // Save report
        await this.saveReport(hmrcReport);
        
        return hmrcReport;
    }
    
    /**
     * Calculate allowable expenses for trading
     */
    calculateAllowableExpenses() {
        // Common allowable expenses for traders
        return {
            dataFeeds: 2000, // Market data subscriptions
            software: 500, // Trading software
            homeOffice: 1248, // £6/week flat rate
            professionalFees: 500, // Accountancy
            education: 1000, // Trading courses/books
            bankCharges: 200,
            total: 5448
        }.total;
    }
    
    /**
     * Get payment due dates for self-assessment
     */
    getPaymentDueDate() {
        const taxYear = this.getCurrentTaxYear();
        const yearEnd = parseInt(taxYear.split('/')[0]) + 1;
        
        return {
            firstPayment: `${yearEnd}-01-31`, // 31 January
            secondPayment: `${yearEnd}-07-31`, // 31 July
            balancing: `${yearEnd + 1}-01-31` // Following 31 January
        };
    }
    
    /**
     * Generate detailed trade list for HMRC
     */
    generateTradeList() {
        return this.trades.map(trade => ({
            date: trade.date,
            description: `${trade.action} ${trade.quantity} ${trade.symbol}`,
            disposal: trade.action === 'SELL',
            proceeds: trade.action === 'SELL' ? trade.proceeds : 0,
            costs: trade.action === 'BUY' ? trade.cost : 0,
            gain: trade.pnl > 0 ? trade.pnl : 0,
            loss: trade.pnl < 0 ? Math.abs(trade.pnl) : 0
        }));
    }
    
    /**
     * Get effective income tax rate based on total income
     */
    getEffectiveIncomeTaxRate(totalIncome) {
        if (totalIncome <= this.config.personalAllowance) {
            return 0;
        } else if (totalIncome <= this.config.basicRateThreshold) {
            return this.taxRates.income.basic;
        } else if (totalIncome <= this.config.higherRateThreshold) {
            return this.taxRates.income.higher;
        } else {
            return this.taxRates.income.additional;
        }
    }
    
    /**
     * Generate tax report for the year
     */
    async generateTaxReport(totalIncome = 0) {
        const report = this.calculateTaxLiability(totalIncome);
        
        // Add trade details
        report.trades = this.trades.filter(t => t.taxYear === this.getCurrentTaxYear());
        report.taxableEvents = this.taxableEvents;
        
        // Add summary
        report.summary = {
            totalTrades: report.trades.length,
            profitableTrades: report.trades.filter(t => t.pnl > 0).length,
            losingTrades: report.trades.filter(t => t.pnl < 0).length,
            totalPnL: report.trades.reduce((sum, t) => sum + (t.pnl || 0), 0),
            estimatedTax: report.totalTax,
            taxAsPercentOfGains: report.capitalGains.netGain > 0 ? 
                (report.totalTax / report.capitalGains.netGain * 100).toFixed(2) + '%' : '0%'
        };
        
        // Save report
        await this.saveReport(report);
        
        logger.info('UK_TAX', 'Tax report generated', report.summary);
        
        return report;
    }
    
    /**
     * Save report to file
     */
    async saveReport(report) {
        try {
            await fs.mkdir(this.reportPath, { recursive: true });
            
            const filename = `uk_tax_report_${report.taxYear.replace('/', '_')}_${Date.now()}.json`;
            const filepath = path.join(this.reportPath, filename);
            
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            
            logger.info('UK_TAX', `Report saved to ${filepath}`);
            
            // Also generate CSV for accountant
            await this.generateCSVReport(report);
            
        } catch (error) {
            logger.error('UK_TAX', 'Failed to save report', error);
        }
    }
    
    /**
     * Generate CSV report for accountant
     */
    async generateCSVReport(report) {
        const csvLines = [
            'UK Tax Report - ' + report.taxYear,
            '',
            'CAPITAL GAINS',
            'Date,Asset,Buy Date,Sell Date,Proceeds,Cost,Gain/Loss',
        ];
        
        // Add capital gains transactions
        report.taxableEvents
            .filter(e => e.type === 'CAPITAL_GAIN')
            .forEach(event => {
                csvLines.push([
                    event.date,
                    event.asset,
                    event.acquisition,
                    event.disposal,
                    event.proceeds,
                    event.cost,
                    event.gain
                ].join(','));
            });
        
        csvLines.push('');
        csvLines.push('INCOME');
        csvLines.push('Date,Source,Amount');
        
        // Add income items
        report.taxableEvents
            .filter(e => e.type === 'INCOME')
            .forEach(event => {
                csvLines.push([
                    event.date,
                    event.source,
                    event.amount
                ].join(','));
            });
        
        csvLines.push('');
        csvLines.push('SUMMARY');
        csvLines.push(`Total Capital Gains,${report.capitalGains.gains}`);
        csvLines.push(`Total Capital Losses,${report.capitalGains.losses}`);
        csvLines.push(`Net Capital Gain,${report.capitalGains.netGain}`);
        csvLines.push(`CGT Annual Exemption,${this.config.capitalGainsAllowance}`);
        csvLines.push(`Taxable Gain,${report.capitalGains.taxableGain}`);
        csvLines.push(`Capital Gains Tax,${report.capitalGains.tax}`);
        csvLines.push('');
        csvLines.push(`Premium Income,${report.income.premiumIncome}`);
        csvLines.push(`Income Tax on Premiums,${report.income.tax}`);
        csvLines.push('');
        csvLines.push(`TOTAL TAX DUE,${report.totalTax}`);
        
        const csvContent = csvLines.join('\n');
        const filename = `uk_tax_csv_${report.taxYear.replace('/', '_')}_${Date.now()}.csv`;
        const filepath = path.join(this.reportPath, filename);
        
        await fs.writeFile(filepath, csvContent);
        logger.info('UK_TAX', `CSV report saved to ${filepath}`);
    }
    
    /**
     * Get current tax position
     */
    getCurrentPosition() {
        const netGain = this.currentYearGains - this.currentYearLosses;
        const afterAllowance = Math.max(0, netGain - this.config.capitalGainsAllowance);
        
        return {
            taxYear: this.getCurrentTaxYear(),
            gains: this.currentYearGains,
            losses: this.currentYearLosses,
            netGain: netGain,
            allowanceRemaining: Math.max(0, this.config.capitalGainsAllowance - netGain),
            taxableAmount: afterAllowance,
            estimatedTax: afterAllowance * this.taxRates.capitalGains.higher, // Conservative estimate
            premiumIncome: this.premiumIncome,
            totalTrades: this.trades.length
        };
    }
    
    /**
     * Reset for new tax year
     */
    resetForNewTaxYear() {
        // Carry forward any losses
        const netResult = this.currentYearGains - this.currentYearLosses;
        if (netResult < 0) {
            this.carriedLosses += Math.abs(netResult);
        }
        
        // Reset current year figures
        this.currentYearGains = 0;
        this.currentYearLosses = 0;
        this.premiumIncome = 0;
        this.dividendIncome = 0;
        this.trades = [];
        this.taxableEvents = [];
        
        logger.info('UK_TAX', 'Reset for new tax year', {
            newTaxYear: this.getCurrentTaxYear(),
            carriedLosses: this.carriedLosses
        });
    }
}

module.exports = { UKTaxTracker };