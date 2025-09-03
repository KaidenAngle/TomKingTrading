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
     * Calculate tax liability for current year
     */
    calculateTaxLiability(totalIncome = 0) {
        const report = {
            taxYear: this.getCurrentTaxYear(),
            capitalGains: {
                gains: this.currentYearGains,
                losses: this.currentYearLosses,
                netGain: this.currentYearGains - this.currentYearLosses,
                carriedLosses: this.carriedLosses,
                taxableGain: 0,
                tax: 0
            },
            income: {
                premiumIncome: this.premiumIncome,
                dividendIncome: this.dividendIncome,
                totalIncome: totalIncome + this.premiumIncome,
                tax: 0
            },
            totalTax: 0
        };
        
        // Calculate capital gains tax
        let taxableGain = report.capitalGains.netGain;
        
        // Apply carried losses from previous years
        if (this.carriedLosses > 0) {
            const lossesUsed = Math.min(this.carriedLosses, taxableGain);
            taxableGain -= lossesUsed;
            report.capitalGains.carriedLosses = this.carriedLosses - lossesUsed;
        }
        
        // Apply annual exemption
        taxableGain = Math.max(0, taxableGain - this.config.capitalGainsAllowance);
        report.capitalGains.taxableGain = taxableGain;
        
        // Calculate CGT based on income level
        if (taxableGain > 0) {
            const totalIncome = report.income.totalIncome;
            
            if (totalIncome <= this.config.basicRateThreshold) {
                // Basic rate taxpayer
                const basicRateCapacity = this.config.basicRateThreshold - totalIncome;
                const basicRateGain = Math.min(taxableGain, basicRateCapacity);
                const higherRateGain = taxableGain - basicRateGain;
                
                report.capitalGains.tax = 
                    (basicRateGain * this.taxRates.capitalGains.basic) +
                    (higherRateGain * this.taxRates.capitalGains.higher);
            } else {
                // Higher/additional rate taxpayer
                report.capitalGains.tax = taxableGain * this.taxRates.capitalGains.higher;
            }
        }
        
        // Calculate income tax on premium income
        if (this.premiumIncome > 0) {
            // This is simplified - actual calculation would need to consider
            // all income sources and apply bands progressively
            const effectiveRate = this.getEffectiveIncomeTaxRate(totalIncome);
            report.income.tax = this.premiumIncome * effectiveRate;
        }
        
        // Total tax
        report.totalTax = report.capitalGains.tax + report.income.tax;
        
        return report;
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