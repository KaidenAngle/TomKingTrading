/**
 * Excel Export System
 * Comprehensive Excel export matching Tom King's methodology
 * Daily position tracking, Greeks balance, and performance analysis
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const { getLogger } = require('./logger');

const logger = getLogger();

class TomKingExcelExporter {
    constructor(options = {}) {
        this.exportDir = options.exportDir || path.join(__dirname, '..', 'exports');
        this.templateDir = options.templateDir || path.join(__dirname, '..', 'templates');
        
        // Tom King tracking categories
        this.trackingCategories = {
            dailyPositions: 'Daily Position Tracker',
            greeksBalance: 'Portfolio Greeks Balance',
            strategyPerformance: 'Strategy Performance Analysis',
            riskMetrics: 'Risk Management Dashboard',
            monthlyReview: 'Monthly Performance Review',
            correlationAnalysis: 'Correlation Group Analysis'
        };
    }

    /**
     * Create comprehensive Tom King Excel report
     */
    async createComprehensiveReport(data, options = {}) {
        try {
            const workbook = new ExcelJS.Workbook();
            const filename = options.filename || `TomKing_Trading_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            // Create all worksheets
            await this.createDailyPositionTracker(workbook, data);
            await this.createGreeksBalanceSheet(workbook, data);
            await this.createStrategyAnalysis(workbook, data);
            await this.createRiskDashboard(workbook, data);
            await this.createMonthlyReview(workbook, data);
            await this.createCorrelationAnalysis(workbook, data);
            
            // Ensure export directory exists
            await fs.mkdir(this.exportDir, { recursive: true });
            
            const filePath = path.join(this.exportDir, filename);
            await workbook.xlsx.writeFile(filePath);
            
            logger.info('EXCEL_EXPORT', `Comprehensive report exported to ${filePath}`);
            
            return {
                success: true,
                filePath,
                filename,
                worksheets: Object.values(this.trackingCategories).length,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error('EXCEL_EXPORT', 'Failed to create comprehensive report', error);
            throw error;
        }
    }

    /**
     * Daily Position Tracker (Tom King's main spreadsheet)
     */
    async createDailyPositionTracker(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.dailyPositions);
        
        // Tom King style headers
        const headers = [
            'Date', 'Symbol', 'Strategy', 'DTE', 'Entry Price', 'Current Price', 
            'P&L $', 'P&L %', 'BP Used', 'Delta', 'Gamma', 'Theta', 'Vega',
            'IV Rank', 'Status', 'Action Required', 'Notes'
        ];
        
        worksheet.addRow(headers);
        
        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '366092' } };
        
        // Add position data
        if (data.positions) {
            data.positions.forEach(position => {
                worksheet.addRow([
                    new Date().toISOString().split('T')[0],
                    position.symbol || position.ticker,
                    position.strategy,
                    position.dte || 'N/A',
                    position.entryPrice || 'N/A',
                    position.currentPrice || 'N/A',
                    position.dollarPL || 0,
                    position.percentPL || 0,
                    position.bpUsed || 0,
                    position.greeks?.delta || 0,
                    position.greeks?.gamma || 0,
                    position.greeks?.theta || 0,
                    position.greeks?.vega || 0,
                    position.ivRank || 'N/A',
                    position.status || 'ACTIVE',
                    position.actionRequired || 'HOLD',
                    position.notes || ''
                ]);
            });
        }
        
        // Auto-fit columns and add borders
        this.formatWorksheet(worksheet);
        
        return worksheet;
    }

    /**
     * Portfolio Greeks Balance Sheet
     */
    async createGreeksBalanceSheet(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.greeksBalance);
        
        // Portfolio summary
        worksheet.addRow(['TOM KING PORTFOLIO GREEKS ANALYSIS', '', '', '', '']);
        worksheet.mergeCells('A1:E1');
        worksheet.getRow(1).font = { bold: true, size: 16 };
        
        worksheet.addRow([]);
        
        // Current portfolio Greeks
        worksheet.addRow(['Current Portfolio Greeks', '', '', '', '']);
        worksheet.addRow(['Greek', 'Value', 'Target Range', 'Status', 'Action']);
        
        const greeksData = data.portfolioGreeks || {};
        const greeksRows = [
            ['Delta', greeksData.totalDelta || 0, '±50', greeksData.deltaNeutral ? 'GOOD' : 'ALERT', greeksData.deltaNeutral ? 'MAINTAIN' : 'HEDGE'],
            ['Gamma', greeksData.totalGamma || 0, '<200', greeksData.gammaRisk === 'LOW' ? 'GOOD' : 'ALERT', greeksData.gammaRisk === 'LOW' ? 'MAINTAIN' : 'REDUCE'],
            ['Theta', greeksData.totalTheta || 0, '>0', greeksData.totalTheta > 0 ? 'GOOD' : 'POOR', greeksData.totalTheta > 0 ? 'COLLECT' : 'IMPROVE'],
            ['Vega', greeksData.totalVega || 0, '±300', Math.abs(greeksData.totalVega) < 300 ? 'GOOD' : 'ALERT', Math.abs(greeksData.totalVega) < 300 ? 'MAINTAIN' : 'REDUCE'],
        ];
        
        greeksRows.forEach(row => worksheet.addRow(row));
        
        // Correlation groups analysis
        worksheet.addRow([]);
        worksheet.addRow(['Correlation Groups Analysis', '', '', '', '']);
        worksheet.addRow(['Group', 'Positions', 'Combined Delta', 'Risk Level', 'Max Allowed']);
        
        if (data.correlationGroups) {
            Object.entries(data.correlationGroups).forEach(([group, details]) => {
                worksheet.addRow([
                    group,
                    details.count || 0,
                    details.combinedDelta || 0,
                    details.count <= 3 ? 'SAFE' : 'VIOLATION',
                    3
                ]);
            });
        }
        
        this.formatWorksheet(worksheet);
        return worksheet;
    }

    /**
     * Strategy Performance Analysis
     */
    async createStrategyAnalysis(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.strategyPerformance);
        
        worksheet.addRow(['TOM KING STRATEGY PERFORMANCE ANALYSIS', '', '', '', '', '']);
        worksheet.mergeCells('A1:F1');
        worksheet.getRow(1).font = { bold: true, size: 16 };
        
        worksheet.addRow([]);
        worksheet.addRow(['Strategy', 'Total Trades', 'Win Rate %', 'Avg P&L', 'Best Trade', 'Worst Trade', 'Status']);
        
        const strategies = ['0DTE', 'LT112', 'STRANGLE', 'IPMCC', 'BUTTERFLY', 'RATIO'];
        
        strategies.forEach(strategy => {
            const strategyData = data.strategyPerformance?.[strategy] || {};
            worksheet.addRow([
                strategy,
                strategyData.totalTrades || 0,
                strategyData.winRate || 0,
                strategyData.avgPL || 0,
                strategyData.bestTrade || 0,
                strategyData.worstTrade || 0,
                strategyData.totalTrades > 0 ? 'ACTIVE' : 'INACTIVE'
            ]);
        });
        
        // Monthly breakdown
        worksheet.addRow([]);
        worksheet.addRow(['Monthly Performance Breakdown', '', '', '', '', '']);
        worksheet.addRow(['Month', 'Total P&L', 'Win Rate', 'BP Usage', 'VIX Avg', 'Notes']);
        
        if (data.monthlyPerformance) {
            data.monthlyPerformance.forEach(month => {
                worksheet.addRow([
                    month.month,
                    month.totalPL || 0,
                    month.winRate || 0,
                    month.avgBPUsage || 0,
                    month.avgVIX || 0,
                    month.notes || ''
                ]);
            });
        }
        
        this.formatWorksheet(worksheet);
        return worksheet;
    }

    /**
     * Risk Management Dashboard
     */
    async createRiskDashboard(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.riskMetrics);
        
        worksheet.addRow(['TOM KING RISK MANAGEMENT DASHBOARD', '', '', '', '']);
        worksheet.mergeCells('A1:E1');
        worksheet.getRow(1).font = { bold: true, size: 16 };
        
        worksheet.addRow([]);
        
        // Risk metrics
        const riskMetrics = [
            ['Current BP Usage', data.currentBPUsage || 0, '35%', data.currentBPUsage <= 35 ? 'SAFE' : 'WARNING'],
            ['Max Drawdown', data.maxDrawdown || 0, '10%', Math.abs(data.maxDrawdown) <= 10 ? 'GOOD' : 'ALERT'],
            ['VaR (95%)', data.valueAtRisk || 0, '5%', Math.abs(data.valueAtRisk) <= 5 ? 'ACCEPTABLE' : 'HIGH'],
            ['Correlation Violations', data.correlationViolations || 0, '0', data.correlationViolations === 0 ? 'CLEAN' : 'VIOLATION'],
            ['Days Since August 5', this.daysSinceAugust5(), 'N/A', 'MONITORING']
        ];
        
        worksheet.addRow(['Risk Metric', 'Current Value', 'Target/Limit', 'Status']);
        riskMetrics.forEach(row => worksheet.addRow(row));
        
        // August 2024 prevention metrics
        worksheet.addRow([]);
        worksheet.addRow(['August 2024 Disaster Prevention Metrics', '', '', '']);
        worksheet.addRow(['Metric', 'Current', 'August 5 Level', 'Prevention Status']);
        
        const preventionMetrics = [
            ['Total Correlation Groups', data.activeCorrelationGroups || 0, '6+', data.activeCorrelationGroups <= 5 ? 'PROTECTED' : 'DANGER'],
            ['Max Group Concentration', data.maxGroupConcentration || 0, '80%+', data.maxGroupConcentration <= 60 ? 'PROTECTED' : 'DANGER'],
            ['Portfolio Delta', Math.abs(data.portfolioGreeks?.totalDelta || 0), '500+', Math.abs(data.portfolioGreeks?.totalDelta || 0) <= 200 ? 'PROTECTED' : 'DANGER'],
            ['VIX Level', data.currentVIX || 15, '35+', data.currentVIX <= 25 ? 'NORMAL' : 'ELEVATED']
        ];
        
        preventionMetrics.forEach(row => worksheet.addRow(row));
        
        this.formatWorksheet(worksheet);
        return worksheet;
    }

    /**
     * Monthly Performance Review
     */
    async createMonthlyReview(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.monthlyReview);
        
        worksheet.addRow(['TOM KING MONTHLY PERFORMANCE REVIEW', '', '', '', '', '']);
        worksheet.mergeCells('A1:F1');
        worksheet.getRow(1).font = { bold: true, size: 16 };
        
        worksheet.addRow([]);
        
        // Goal tracking
        worksheet.addRow(['Goal Progress: £35k → £80k in 8 months', '', '', '', '', '']);
        worksheet.addRow(['Current Account Value', data.currentAccountValue || 35000]);
        worksheet.addRow(['Target Account Value', 80000]);
        worksheet.addRow(['Progress %', ((data.currentAccountValue || 35000) - 35000) / (80000 - 35000) * 100]);
        worksheet.addRow(['Months Remaining', data.monthsRemaining || 8]);
        worksheet.addRow(['Required Monthly Return', data.requiredMonthlyReturn || 12]);
        
        worksheet.addRow([]);
        
        // Phase progression
        worksheet.addRow(['Account Phase Progression', '', '', '', '', '']);
        worksheet.addRow(['Current Phase', data.currentPhase || 1]);
        worksheet.addRow(['Phase Range', this.getPhaseRange(data.currentPhase || 1)]);
        worksheet.addRow(['Next Phase Target', this.getNextPhaseTarget(data.currentPhase || 1)]);
        worksheet.addRow(['Amount Needed', this.getAmountToNextPhase(data.currentAccountValue || 35000, data.currentPhase || 1)]);
        
        this.formatWorksheet(worksheet);
        return worksheet;
    }

    /**
     * Correlation Analysis
     */
    async createCorrelationAnalysis(workbook, data) {
        const worksheet = workbook.addWorksheet(this.trackingCategories.correlationAnalysis);
        
        worksheet.addRow(['TOM KING CORRELATION GROUP ANALYSIS', '', '', '', '']);
        worksheet.mergeCells('A1:E1');
        worksheet.getRow(1).font = { bold: true, size: 16 };
        
        worksheet.addRow([]);
        worksheet.addRow(['August 5, 2024 Lesson: Never exceed 3 positions per correlation group']);
        worksheet.addRow([]);
        
        // Correlation groups
        const correlationGroups = [
            'EQUITY_FUTURES', 'METALS', 'ENERGY', 'BONDS', 'CURRENCIES', 
            'AGRICULTURE', 'VOLATILITY', 'TECH_FUTURES', 'OTHER'
        ];
        
        worksheet.addRow(['Correlation Group', 'Current Positions', 'Max Allowed', 'Status', 'Action']);
        
        correlationGroups.forEach(group => {
            const groupData = data.correlationGroups?.[group] || { count: 0 };
            worksheet.addRow([
                group,
                groupData.count || 0,
                3,
                groupData.count <= 3 ? 'COMPLIANT' : 'VIOLATION',
                groupData.count <= 3 ? 'MAINTAIN' : 'REDUCE IMMEDIATELY'
            ]);
        });
        
        this.formatWorksheet(worksheet);
        return worksheet;
    }

    /**
     * Format worksheet with borders and styling
     */
    formatWorksheet(worksheet) {
        // Auto-fit columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(maxLength + 2, 30);
        });
        
        // Add borders to all cells with data
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });
    }

    /**
     * Helper methods
     */
    daysSinceAugust5() {
        const august5 = new Date('2024-08-05');
        const today = new Date();
        return Math.floor((today - august5) / (1000 * 60 * 60 * 24));
    }

    getPhaseRange(phase) {
        const ranges = {
            1: '£30k - £40k',
            2: '£40k - £60k', 
            3: '£60k - £75k',
            4: '£75k+'
        };
        return ranges[phase] || 'Unknown';
    }

    getNextPhaseTarget(phase) {
        const targets = { 1: 40000, 2: 60000, 3: 75000, 4: 100000 };
        return targets[phase] || 100000;
    }

    getAmountToNextPhase(currentValue, phase) {
        return this.getNextPhaseTarget(phase) - currentValue;
    }

    /**
     * Create Friday 0DTE specific report
     */
    async createFriday0DTEReport(data, options = {}) {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Friday 0DTE Analysis');
            
            worksheet.addRow(['FRIDAY 0DTE STRATEGY ANALYSIS', '', '', '', '']);
            worksheet.mergeCells('A1:E1');
            worksheet.getRow(1).font = { bold: true, size: 16 };
            
            worksheet.addRow([]);
            worksheet.addRow(['Tom King Rule: Only trade 0DTE on Fridays after 10:30 AM EST']);
            worksheet.addRow(['Current Status:', data.is0DTEAllowed ? 'ALLOWED' : 'BLOCKED']);
            worksheet.addRow(['Current Time:', data.currentTime || new Date().toLocaleString()]);
            worksheet.addRow(['Day of Week:', data.dayOfWeek || 'Unknown']);
            worksheet.addRow([]);
            
            // 0DTE performance metrics
            worksheet.addRow(['0DTE Performance History', '', '', '', '']);
            worksheet.addRow(['Date', 'Setup Time', 'P&L Result', 'VIX Level', 'Notes']);
            
            if (data.dte0History) {
                data.dte0History.forEach(trade => {
                    worksheet.addRow([
                        trade.date,
                        trade.setupTime,
                        trade.pl,
                        trade.vixLevel,
                        trade.notes
                    ]);
                });
            }
            
            const filename = options.filename || `Friday_0DTE_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
            const filePath = path.join(this.exportDir, filename);
            
            await fs.mkdir(this.exportDir, { recursive: true });
            await workbook.xlsx.writeFile(filePath);
            
            return { success: true, filePath, filename };
            
        } catch (error) {
            logger.error('EXCEL_EXPORT', 'Failed to create Friday 0DTE report', error);
            throw error;
        }
    }
}

module.exports = TomKingExcelExporter;