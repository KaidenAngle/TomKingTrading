/**
 * Comprehensive Excel Report Generator
 * Generates detailed Excel reports for trading performance and analysis
 */

const { getLogger } = require('../src/logger');
const logger = getLogger();

class ComprehensiveExcelReportGenerator {
    constructor(config = {}) {
        this.config = {
            includeCharts: config.includeCharts !== false,
            includeFormulas: config.includeFormulas !== false,
            dateFormat: config.dateFormat || 'YYYY-MM-DD',
            currencySymbol: config.currencySymbol || '£',
            ...config
        };
    }

    /**
     * Generate comprehensive Excel report data structure
     */
    generateComprehensiveExcelReport(data) {
        const report = {
            metadata: this.generateMetadata(),
            sheets: {}
        };

        // Add various sheets to the report
        report.sheets['Summary'] = this.generateSummarySheet(data);
        report.sheets['Trades'] = this.generateTradesSheet(data.trades || []);
        report.sheets['Daily P&L'] = this.generateDailyPnLSheet(data.dailyPnL || []);
        report.sheets['Strategy Performance'] = this.generateStrategySheet(data.strategies || {});
        report.sheets['Risk Metrics'] = this.generateRiskSheet(data.risk || {});
        report.sheets['Position Analysis'] = this.generatePositionSheet(data.positions || []);
        report.sheets['Correlation Analysis'] = this.generateCorrelationSheet(data);
        report.sheets['Monthly Summary'] = this.generateMonthlySheet(data);
        report.sheets['Tom King Metrics'] = this.generateTomKingSheet(data);

        logger.info('EXCEL', 'Generated comprehensive report', {
            sheets: Object.keys(report.sheets).length,
            trades: data.trades?.length || 0
        });

        return report;
    }

    /**
     * Generate report metadata
     */
    generateMetadata() {
        return {
            generatedAt: new Date().toISOString(),
            framework: 'Tom King Trading Framework v17.3',
            reportType: 'Comprehensive Trading Analysis',
            currency: this.config.currencySymbol,
            period: {
                start: null, // Will be filled from data
                end: null
            }
        };
    }

    /**
     * Generate summary sheet
     */
    generateSummarySheet(data) {
        const sheet = {
            headers: ['Metric', 'Value', 'Target', 'Status'],
            data: [],
            formatting: {
                headerStyle: { bold: true, backgroundColor: '#1e3a8a', color: '#ffffff' },
                dataStyle: { alternateRows: true }
            }
        };

        // Key metrics
        const metrics = [
            ['Account Value', data.accountValue || 0, data.targetValue || 80000, this.getStatus(data.accountValue, data.targetValue)],
            ['Total P&L', data.totalPnL || 0, null, data.totalPnL >= 0 ? '✅' : '❌'],
            ['Win Rate', (data.winRate || 0) + '%', '70%', data.winRate >= 70 ? '✅' : '⚠️'],
            ['Total Trades', data.totalTrades || 0, null, null],
            ['Winning Trades', data.winningTrades || 0, null, null],
            ['Losing Trades', data.losingTrades || 0, null, null],
            ['Average Win', data.avgWin || 0, null, null],
            ['Average Loss', data.avgLoss || 0, null, null],
            ['Profit Factor', data.profitFactor || 0, 1.5, data.profitFactor >= 1.5 ? '✅' : '⚠️'],
            ['Sharpe Ratio', data.sharpeRatio || 0, 1.0, data.sharpeRatio >= 1.0 ? '✅' : '⚠️'],
            ['Max Drawdown', (data.maxDrawdown || 0) + '%', '20%', Math.abs(data.maxDrawdown) <= 20 ? '✅' : '❌'],
            ['BP Usage', (data.bpUsage || 0) + '%', '65%', data.bpUsage <= 65 ? '✅' : '⚠️'],
            ['Days Trading', data.daysTrad || 0, null, null],
            ['Best Day', data.bestDay || 0, null, null],
            ['Worst Day', data.worstDay || 0, null, null],
            ['Current Streak', data.currentStreak || 0, null, null]
        ];

        sheet.data = metrics;
        return sheet;
    }

    /**
     * Generate trades sheet
     */
    generateTradesSheet(trades) {
        const sheet = {
            headers: [
                'Trade ID', 'Date', 'Time', 'Symbol', 'Strategy', 'Side',
                'Quantity', 'Entry Price', 'Exit Price', 'P&L', 'P&L %',
                'Duration', 'Win/Loss', 'Notes'
            ],
            data: [],
            formatting: {
                headerStyle: { bold: true, backgroundColor: '#059669', color: '#ffffff' },
                conditionalFormatting: [
                    { column: 'P&L', condition: '>0', style: { color: '#059669' } },
                    { column: 'P&L', condition: '<0', style: { color: '#dc2626' } }
                ]
            }
        };

        for (const trade of trades) {
            sheet.data.push([
                trade.id || '-',
                this.formatDate(trade.entryTime),
                this.formatTime(trade.entryTime),
                trade.symbol,
                trade.strategy,
                trade.side || 'LONG',
                trade.quantity,
                trade.entryPrice,
                trade.exitPrice || '-',
                trade.pnl || 0,
                trade.pnlPercent ? trade.pnlPercent + '%' : '-',
                trade.duration || '-',
                trade.winLoss || (trade.pnl > 0 ? 'WIN' : 'LOSS'),
                trade.notes || ''
            ]);
        }

        return sheet;
    }

    /**
     * Generate daily P&L sheet
     */
    generateDailyPnLSheet(dailyPnL) {
        const sheet = {
            headers: ['Date', 'P&L', 'Cumulative P&L', 'Trades', 'Win Rate', 'Notes'],
            data: [],
            chartConfig: {
                type: 'line',
                xAxis: 'Date',
                yAxis: ['P&L', 'Cumulative P&L'],
                title: 'Daily P&L Progression'
            }
        };

        let cumulative = 0;
        for (const day of dailyPnL) {
            cumulative += (day.pnl || 0);
            sheet.data.push([
                this.formatDate(day.date),
                day.pnl || 0,
                cumulative,
                day.trades || 0,
                day.winRate ? day.winRate + '%' : '-',
                day.notes || ''
            ]);
        }

        return sheet;
    }

    /**
     * Generate strategy performance sheet
     */
    generateStrategySheet(strategies) {
        const sheet = {
            headers: [
                'Strategy', 'Trades', 'Wins', 'Losses', 'Win Rate',
                'Total P&L', 'Avg P&L', 'Best Trade', 'Worst Trade',
                'Profit Factor', 'Expected Value'
            ],
            data: []
        };

        const strategyList = [
            'Friday Zero DTE',
            'Long-Term 112',
            'Futures Strangles',
            'IPMCC',
            'LEAP Ladder',
            'Section 9B',
            'Calendarized 112'
        ];

        for (const name of strategyList) {
            const stats = strategies[name] || {};
            sheet.data.push([
                name,
                stats.trades || 0,
                stats.wins || 0,
                stats.losses || 0,
                stats.winRate ? stats.winRate + '%' : '0%',
                stats.totalPnL || 0,
                stats.avgPnL || 0,
                stats.bestTrade || 0,
                stats.worstTrade || 0,
                stats.profitFactor || 0,
                stats.expectedValue || 0
            ]);
        }

        return sheet;
    }

    /**
     * Generate risk metrics sheet
     */
    generateRiskSheet(risk) {
        const sheet = {
            headers: ['Risk Metric', 'Current Value', 'Limit', 'Status', 'Notes'],
            data: []
        };

        const riskMetrics = [
            ['Max Drawdown', risk.maxDrawdown || '0%', '20%', this.getRiskStatus(risk.maxDrawdown, 20), ''],
            ['Current Drawdown', risk.currentDrawdown || '0%', '10%', this.getRiskStatus(risk.currentDrawdown, 10), ''],
            ['VaR (95%)', risk.var95 || 0, risk.varLimit || 1000, risk.var95 <= risk.varLimit ? '✅' : '❌', ''],
            ['Beta', risk.beta || 0, 1.0, Math.abs(risk.beta) <= 1.0 ? '✅' : '⚠️', ''],
            ['Correlation Risk', risk.correlationRisk || 'Low', 'Medium', risk.correlationRisk === 'Low' ? '✅' : '⚠️', ''],
            ['BP Usage', risk.bpUsage || '0%', '65%', this.getRiskStatus(risk.bpUsage, 65), 'VIX adjusted'],
            ['Position Count', risk.positionCount || 0, risk.maxPositions || 20, risk.positionCount <= risk.maxPositions ? '✅' : '❌', ''],
            ['Largest Position', risk.largestPosition || '0%', '10%', this.getRiskStatus(risk.largestPosition, 10), ''],
            ['Greeks Exposure', risk.greeksExposure || 'Neutral', 'Neutral', risk.greeksExposure === 'Neutral' ? '✅' : '⚠️', '']
        ];

        sheet.data = riskMetrics;
        return sheet;
    }

    /**
     * Generate position analysis sheet
     */
    generatePositionSheet(positions) {
        const sheet = {
            headers: [
                'Symbol', 'Strategy', 'Quantity', 'Entry Date', 'Entry Price',
                'Current Price', 'Unrealized P&L', 'P&L %', 'Days Held',
                'Delta', 'Theta', 'Status'
            ],
            data: []
        };

        for (const pos of positions) {
            const unrealizedPnL = pos.quantity * (pos.currentPrice - pos.entryPrice);
            const pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice * 100).toFixed(2);
            
            sheet.data.push([
                pos.symbol,
                pos.strategy,
                pos.quantity,
                this.formatDate(pos.entryDate),
                pos.entryPrice,
                pos.currentPrice || pos.entryPrice,
                unrealizedPnL,
                pnlPercent + '%',
                pos.daysHeld || 0,
                pos.delta || 0,
                pos.theta || 0,
                pos.status || 'OPEN'
            ]);
        }

        return sheet;
    }

    /**
     * Generate correlation analysis sheet
     */
    generateCorrelationSheet(data) {
        const sheet = {
            headers: ['Correlation Group', 'Positions', 'Total Risk', 'Correlation', 'Status'],
            data: []
        };

        const groups = [
            { name: 'Tech', symbols: ['QQQ', 'SMH', 'XLK'], maxPositions: 3 },
            { name: 'Energy', symbols: ['XLE', 'USO', 'UNG'], maxPositions: 3 },
            { name: 'Financials', symbols: ['XLF', 'KRE', 'FAS'], maxPositions: 3 },
            { name: 'Bonds', symbols: ['TLT', 'TBT', 'IEF'], maxPositions: 3 },
            { name: 'Commodities', symbols: ['GLD', 'SLV', 'DBA'], maxPositions: 3 }
        ];

        for (const group of groups) {
            const positions = (data.positions || []).filter(p => 
                group.symbols.includes(p.symbol)
            );
            
            sheet.data.push([
                group.name,
                positions.length,
                positions.reduce((sum, p) => sum + (p.risk || 0), 0),
                positions.length > 1 ? 'High' : 'Low',
                positions.length <= group.maxPositions ? '✅' : '❌'
            ]);
        }

        return sheet;
    }

    /**
     * Generate monthly summary sheet
     */
    generateMonthlySheet(data) {
        const sheet = {
            headers: ['Month', 'P&L', 'Return %', 'Trades', 'Win Rate', 'Best Day', 'Worst Day', 'Target', 'Status'],
            data: [],
            chartConfig: {
                type: 'column',
                xAxis: 'Month',
                yAxis: 'P&L',
                title: 'Monthly Performance'
            }
        };

        const monthlyTarget = 4200; // 12% of £35k
        const months = this.aggregateMonthlyData(data.trades || [], data.dailyPnL || []);

        for (const [month, stats] of Object.entries(months)) {
            sheet.data.push([
                month,
                stats.pnl,
                stats.returnPercent + '%',
                stats.trades,
                stats.winRate + '%',
                stats.bestDay,
                stats.worstDay,
                monthlyTarget,
                stats.pnl >= monthlyTarget ? '✅' : '❌'
            ]);
        }

        return sheet;
    }

    /**
     * Generate Tom King specific metrics sheet
     */
    generateTomKingSheet(data) {
        const sheet = {
            headers: ['Tom King Metric', 'Current', 'Target', 'Status', 'Notes'],
            data: []
        };

        const tomKingMetrics = [
            ['Friday 0DTE Win Rate', data.friday0DTEWinRate || '0%', '88%', this.getMetricStatus(data.friday0DTEWinRate, 88), 'Target from Tom King'],
            ['Long-Term 112 Win Rate', data.lt112WinRate || '0%', '73%', this.getMetricStatus(data.lt112WinRate, 73), 'Verified rate'],
            ['Futures Strangles Win Rate', data.stranglesWinRate || '0%', '72%', this.getMetricStatus(data.stranglesWinRate, 72), 'Historical average'],
            ['Monthly Compounding', data.monthlyReturn || '0%', '12%', this.getMetricStatus(data.monthlyReturn, 12), '£35k → £80k target'],
            ['VIX Regime Adherence', data.vixAdherence || '0%', '100%', this.getMetricStatus(data.vixAdherence, 100), 'Following VIX rules'],
            ['Correlation Violations', data.correlationViolations || 0, 0, data.correlationViolations === 0 ? '✅' : '❌', 'Max 3 per group'],
            ['BP Usage (Current VIX)', data.currentBPUsage || '0%', data.vixTargetBP || '65%', this.getBPStatus(data.currentBPUsage, data.vixTargetBP), 'VIX adjusted'],
            ['50% Profit Targets Hit', data.profitTargetsHit || '0%', '80%', this.getMetricStatus(data.profitTargetsHit, 80), 'Exit discipline'],
            ['21 DTE Adjustments', data.adjustmentsMade || '0%', '100%', this.getMetricStatus(data.adjustmentsMade, 100), 'Defensive management'],
            ['Phase Progression', data.currentPhase || 1, data.targetPhase || 3, data.currentPhase >= data.targetPhase ? '✅' : '⏳', 'Account growth phases']
        ];

        sheet.data = tomKingMetrics;
        return sheet;
    }

    // Helper methods

    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('en-GB');
    }

    formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    getStatus(current, target) {
        if (!target) return null;
        const ratio = current / target;
        if (ratio >= 1) return '✅';
        if (ratio >= 0.8) return '⚠️';
        return '❌';
    }

    getRiskStatus(value, limit) {
        const numValue = parseFloat(value) || 0;
        if (numValue <= limit) return '✅';
        if (numValue <= limit * 1.5) return '⚠️';
        return '❌';
    }

    getMetricStatus(value, target) {
        const numValue = parseFloat(value) || 0;
        if (numValue >= target) return '✅';
        if (numValue >= target * 0.8) return '⚠️';
        return '❌';
    }

    getBPStatus(current, target) {
        const currNum = parseFloat(current) || 0;
        const targNum = parseFloat(target) || 65;
        if (currNum <= targNum) return '✅';
        if (currNum <= targNum * 1.1) return '⚠️';
        return '❌';
    }

    aggregateMonthlyData(trades, dailyPnL) {
        const months = {};
        
        // Aggregate from daily P&L if available
        for (const day of dailyPnL) {
            const month = new Date(day.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' });
            if (!months[month]) {
                months[month] = {
                    pnl: 0,
                    trades: 0,
                    wins: 0,
                    bestDay: 0,
                    worstDay: 0
                };
            }
            
            months[month].pnl += day.pnl || 0;
            months[month].trades += day.trades || 0;
            months[month].wins += day.wins || 0;
            months[month].bestDay = Math.max(months[month].bestDay, day.pnl || 0);
            months[month].worstDay = Math.min(months[month].worstDay, day.pnl || 0);
        }

        // Calculate additional metrics
        for (const [month, stats] of Object.entries(months)) {
            stats.winRate = stats.trades > 0 ? Math.round(stats.wins / stats.trades * 100) : 0;
            stats.returnPercent = Math.round(stats.pnl / 35000 * 100 * 100) / 100; // Based on £35k
        }

        return months;
    }

    /**
     * Convert report to CSV format (fallback when Excel not available)
     */
    convertToCSV(sheet) {
        const rows = [sheet.headers.join(',')];
        for (const row of sheet.data) {
            rows.push(row.map(cell => {
                if (typeof cell === 'string' && cell.includes(',')) {
                    return `"${cell}"`;
                }
                return cell;
            }).join(','));
        }
        return rows.join('\n');
    }
}

// Export both the class and a convenience function
module.exports = {
    ComprehensiveExcelReportGenerator,
    generateComprehensiveExcelReport: (data) => {
        const generator = new ComprehensiveExcelReportGenerator();
        return generator.generateComprehensiveExcelReport(data);
    }
};