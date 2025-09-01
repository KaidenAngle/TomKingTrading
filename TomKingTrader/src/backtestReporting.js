/**
 * Comprehensive Backtesting Report Generator
 * Creates detailed HTML/PDF reports with charts, metrics, and strategy analysis
 * Provides actionable insights for strategy optimization and risk management
 */

const fs = require('fs').promises;
const path = require('path');
const { getLogger } = require('./logger');

class BacktestReportGenerator {
    constructor(options = {}) {
        this.config = {
            outputDir: options.outputDir || path.join(__dirname, '..', 'reports'),
            templateDir: options.templateDir || path.join(__dirname, '..', 'templates'),
            includeCharts: options.includeCharts !== false,
            includeTradeLogs: options.includeTradeLogs !== false,
            chartLibrary: options.chartLibrary || 'plotly',
            currency: options.currency || 'GBP',
            ...options
        };

        this.logger = getLogger();
        this.ensureDirectories();
    }

    /**
     * Generate comprehensive backtest report
     */
    async generateComprehensiveReport(backtestResults, patternValidation = null, optimizationResults = null) {
        this.logger.info('BACKTEST-REPORT', 'Generating comprehensive backtest report');

        const reportData = {
            metadata: this.generateReportMetadata(backtestResults),
            executive: await this.generateExecutiveSummary(backtestResults),
            performance: this.generatePerformanceSection(backtestResults),
            strategies: this.generateStrategiesSection(backtestResults),
            riskAnalysis: this.generateRiskAnalysisSection(backtestResults),
            trades: this.generateTradesSection(backtestResults),
            patterns: patternValidation ? this.generatePatternSection(patternValidation) : null,
            optimization: optimizationResults ? this.generateOptimizationSection(optimizationResults) : null,
            recommendations: this.generateRecommendationsSection(backtestResults),
            appendix: this.generateAppendixSection(backtestResults)
        };

        // Generate HTML report
        const htmlReport = await this.generateHTMLReport(reportData);
        const htmlPath = path.join(this.config.outputDir, `backtest-report-${Date.now()}.html`);
        await fs.writeFile(htmlPath, htmlReport);

        // Generate JSON data export
        const jsonPath = path.join(this.config.outputDir, `backtest-data-${Date.now()}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(backtestResults, null, 2));

        // Generate CSV exports
        await this.generateCSVExports(backtestResults);

        this.logger.info('BACKTEST-REPORT', 'Report generation completed', {
            htmlReport: htmlPath,
            dataExport: jsonPath
        });

        return {
            htmlPath,
            jsonPath,
            reportData
        };
    }

    /**
     * Generate executive summary
     */
    async generateExecutiveSummary(results) {
        const metrics = results.metrics;
        const basic = metrics.basic;
        const risk = metrics.risk;
        const returns = metrics.returns;

        const summary = {
            period: {
                start: results.dailyPnL[0]?.date || 'N/A',
                end: results.dailyPnL[results.dailyPnL.length - 1]?.date || 'N/A',
                tradingDays: results.dailyPnL.length
            },
            headline: {
                totalReturn: basic.totalReturn,
                annualizedReturn: risk.annualizedReturn,
                sharpeRatio: risk.sharpeRatio,
                maxDrawdown: metrics.drawdown.maxDrawdown,
                winRate: basic.winRate
            },
            capital: {
                initial: this.formatCurrency(basic.initialCapital),
                final: this.formatCurrency(basic.finalCapital),
                peak: this.formatCurrency(Math.max(...results.dailyPnL.map(d => d.capital))),
                totalPnL: this.formatCurrency(basic.totalPnL)
            },
            trading: {
                totalTrades: basic.totalTrades,
                avgTradeSize: this.formatCurrency(basic.avgTradeSize),
                avgHoldingPeriod: `${basic.avgHoldingPeriod} days`,
                tradingFrequency: `${basic.tradesPerMonth.toFixed(1)} trades/month`
            },
            performance: {
                bestMonth: `${returns.bestMonth.toFixed(2)}%`,
                worstMonth: `${returns.worstMonth.toFixed(2)}%`,
                positiveMonths: `${returns.positiveMonths}/${returns.monthlyReturns.length}`,
                consistency: this.calculateConsistencyRating(returns.monthlyWinRate)
            },
            riskMetrics: {
                volatility: `${risk.annualizedVolatility.toFixed(2)}%`,
                var95: `${risk.valueAtRisk95.toFixed(2)}%`,
                calmarRatio: risk.calmarRatio.toFixed(3),
                riskGrade: risk.riskGrade
            },
            keyInsights: this.generateKeyInsights(results)
        };

        return summary;
    }

    /**
     * Generate key insights from results
     */
    generateKeyInsights(results) {
        const insights = [];
        const metrics = results.metrics;
        const basic = metrics.basic;
        const risk = metrics.risk;
        const strategies = metrics.strategies;

        // Performance insights
        if (basic.totalReturn > 15) {
            insights.push(`Strong absolute returns of ${basic.totalReturn.toFixed(1)}% demonstrate effective strategy execution`);
        } else if (basic.totalReturn < 5) {
            insights.push(`Low returns of ${basic.totalReturn.toFixed(1)}% suggest need for strategy refinement`);
        }

        // Risk insights
        if (risk.sharpeRatio > 1.5) {
            insights.push(`Excellent risk-adjusted returns with Sharpe ratio of ${risk.sharpeRatio.toFixed(2)}`);
        } else if (risk.sharpeRatio < 0.5) {
            insights.push(`Poor risk-adjusted performance (Sharpe: ${risk.sharpeRatio.toFixed(2)}) indicates excessive volatility`);
        }

        // Strategy insights
        if (strategies.bestStrategy) {
            const best = strategies.breakdown[strategies.bestStrategy];
            insights.push(`${strategies.bestStrategy} was the top performer with ${best.winRate.toFixed(1)}% win rate and ${this.formatCurrency(best.totalPnL)} profit`);
        }

        // Risk management insights
        if (metrics.drawdown.maxDrawdown > 20) {
            insights.push(`Maximum drawdown of ${metrics.drawdown.maxDrawdown.toFixed(1)}% exceeds recommended 20% threshold`);
        }

        // Win rate insights
        if (basic.winRate > 75) {
            insights.push(`High win rate of ${basic.winRate.toFixed(1)}% indicates strong entry criteria`);
        } else if (basic.winRate < 50) {
            insights.push(`Win rate below 50% (${basic.winRate.toFixed(1)}%) requires improved entry selection`);
        }

        return insights;
    }

    /**
     * Generate performance section
     */
    generatePerformanceSection(results) {
        const metrics = results.metrics;
        
        return {
            overview: {
                totalReturn: metrics.basic.totalReturn,
                annualizedReturn: metrics.risk.annualizedReturn,
                volatility: metrics.risk.annualizedVolatility,
                sharpeRatio: metrics.risk.sharpeRatio,
                sortinoRatio: metrics.risk.sortinoRatio,
                calmarRatio: metrics.risk.calmarRatio
            },
            returns: {
                monthly: metrics.returns.monthlyReturns,
                quarterly: metrics.returns.quarterlyReturns,
                yearly: metrics.returns.yearlyReturns,
                cagr: metrics.returns.compoundAnnualGrowthRate,
                bestMonth: metrics.returns.bestMonth,
                worstMonth: metrics.returns.worstMonth,
                positiveMonths: metrics.returns.positiveMonths,
                negativeMonths: metrics.returns.negativeMonths
            },
            risk: {
                maxDrawdown: metrics.drawdown.maxDrawdown,
                avgDrawdown: metrics.drawdown.avgDrawdown,
                drawdownDuration: metrics.drawdown.maxDrawdownDuration,
                recoveryFactor: metrics.drawdown.recoveryFactor,
                var95: metrics.risk.valueAtRisk95,
                var99: metrics.risk.valueAtRisk99,
                cvar95: metrics.risk.conditionalVaR95,
                ulcerIndex: metrics.drawdown.ulcerIndex
            },
            efficiency: {
                profitFactor: metrics.basic.profitFactor,
                payoffRatio: metrics.basic.payoffRatio,
                expectancy: metrics.basic.expectancy,
                tradingFrequency: metrics.basic.tradesPerMonth,
                capitalEfficiency: metrics.efficiency?.capitalEfficiency || 0,
                timeEfficiency: metrics.efficiency?.timeEfficiency || 0
            },
            charts: this.generatePerformanceCharts(results)
        };
    }

    /**
     * Generate strategies section
     */
    generateStrategiesSection(results) {
        const strategies = results.metrics.strategies;
        
        return {
            overview: {
                totalStrategies: Object.keys(strategies.breakdown).length,
                bestStrategy: strategies.bestStrategy,
                worstStrategy: strategies.worstStrategy,
                diversificationBenefit: strategies.diversificationBenefit
            },
            breakdown: Object.entries(strategies.breakdown).map(([strategy, metrics]) => ({
                name: strategy,
                trades: metrics.totalTrades,
                winRate: metrics.winRate,
                totalPnL: metrics.totalPnL,
                avgPnL: metrics.avgPnL,
                profitFactor: metrics.profitFactor,
                contribution: metrics.contribution,
                bestTrade: metrics.bestTrade,
                worstTrade: metrics.worstTrade,
                avgHoldingPeriod: metrics.avgHoldingPeriod,
                analysis: this.analyzeStrategy(strategy, metrics)
            })),
            correlation: this.generateStrategyCorrelationMatrix(strategies),
            performance: this.generateStrategyPerformanceComparison(strategies.breakdown),
            recommendations: this.generateStrategyRecommendations(strategies)
        };
    }

    /**
     * Generate risk analysis section
     */
    generateRiskAnalysisSection(results) {
        const metrics = results.metrics;
        
        return {
            summary: {
                riskGrade: metrics.risk.riskGrade,
                riskScore: this.calculateRiskScore(metrics.risk),
                keyRisks: this.identifyKeyRisks(metrics)
            },
            drawdown: {
                analysis: this.analyzeDrawdowns(metrics.drawdown),
                periods: metrics.drawdown.equityCurve ? this.identifyDrawdownPeriods(metrics.drawdown.equityCurve) : [],
                recovery: this.analyzeRecoveryPatterns(results.dailyPnL)
            },
            volatility: {
                analysis: this.analyzeVolatility(metrics.risk),
                regimes: this.identifyVolatilityRegimes(results.dailyPnL),
                seasonal: this.analyzeSeasonalVolatility(results.dailyPnL)
            },
            var: {
                analysis: this.analyzeVaR(metrics.risk),
                backtesting: this.backtestVaR(results.dailyPnL, metrics.risk),
                scenarios: this.generateStressScenarios(results)
            },
            correlation: {
                analysis: this.analyzeCorrelationRisks(results),
                concentration: this.analyzeConcentrationRisk(results.trades)
            }
        };
    }

    /**
     * Generate trades section
     */
    generateTradesSection(results) {
        const trades = results.trades;
        
        return {
            summary: {
                totalTrades: trades.length,
                winningTrades: trades.filter(t => t.pnl > 0).length,
                losingTrades: trades.filter(t => t.pnl <= 0).length,
                avgTrade: trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length
            },
            analysis: {
                byStrategy: this.analyzeTradesByStrategy(trades),
                byTimeframe: this.analyzeTradesByTimeframe(trades),
                bySize: this.analyzeTradesBySize(trades),
                byHoldingPeriod: this.analyzeTradesByHoldingPeriod(trades)
            },
            patterns: {
                winningStreak: this.calculateWinningStreak(trades),
                losingStreak: this.calculateLosingStreak(trades),
                seasonality: this.analyzeTradeSeasonality(trades),
                timing: this.analyzeEntryTiming(trades)
            },
            detailed: this.config.includeTradeLogs ? this.generateDetailedTradeLogs(trades) : null
        };
    }

    /**
     * Generate HTML report
     */
    async generateHTMLReport(reportData) {
        const template = await this.loadHTMLTemplate();
        
        const html = template
            .replace('{{REPORT_TITLE}}', this.generateReportTitle(reportData.metadata))
            .replace('{{GENERATION_DATE}}', new Date().toLocaleString())
            .replace('{{EXECUTIVE_SUMMARY}}', this.renderExecutiveSummary(reportData.executive))
            .replace('{{PERFORMANCE_SECTION}}', this.renderPerformanceSection(reportData.performance))
            .replace('{{STRATEGIES_SECTION}}', this.renderStrategiesSection(reportData.strategies))
            .replace('{{RISK_SECTION}}', this.renderRiskSection(reportData.riskAnalysis))
            .replace('{{TRADES_SECTION}}', this.renderTradesSection(reportData.trades))
            .replace('{{PATTERNS_SECTION}}', reportData.patterns ? this.renderPatternsSection(reportData.patterns) : '')
            .replace('{{OPTIMIZATION_SECTION}}', reportData.optimization ? this.renderOptimizationSection(reportData.optimization) : '')
            .replace('{{RECOMMENDATIONS_SECTION}}', this.renderRecommendationsSection(reportData.recommendations))
            .replace('{{APPENDIX_SECTION}}', this.renderAppendixSection(reportData.appendix))
            .replace('{{CHARTS_SCRIPT}}', this.generateChartsScript(reportData))
            .replace('{{CUSTOM_STYLES}}', this.generateCustomStyles());

        return html;
    }

    /**
     * Load HTML template
     */
    async loadHTMLTemplate() {
        const templatePath = path.join(this.config.templateDir, 'backtest-report-template.html');
        
        try {
            return await fs.readFile(templatePath, 'utf8');
        } catch (error) {
            this.logger.warn('BACKTEST-REPORT', 'Template not found, using default template');
            return this.getDefaultHTMLTemplate();
        }
    }

    /**
     * Generate performance charts
     */
    generatePerformanceCharts(results) {
        const charts = {};

        if (this.config.includeCharts) {
            // Equity curve
            charts.equityCurve = {
                id: 'equity-curve-chart',
                type: 'line',
                data: results.dailyPnL.map(day => ({
                    x: day.date,
                    y: day.capital
                })),
                config: {
                    title: 'Equity Curve',
                    xTitle: 'Date',
                    yTitle: `Capital (${this.config.currency})`,
                    color: '#2E86AB'
                }
            };

            // Drawdown chart
            charts.drawdown = {
                id: 'drawdown-chart',
                type: 'area',
                data: results.metrics.drawdown.equityCurve?.map((equity, index) => ({
                    x: results.dailyPnL[index]?.date,
                    y: equity.drawdown
                })) || [],
                config: {
                    title: 'Drawdown Analysis',
                    xTitle: 'Date',
                    yTitle: 'Drawdown (%)',
                    color: '#E74C3C',
                    fill: true
                }
            };

            // Monthly returns
            charts.monthlyReturns = {
                id: 'monthly-returns-chart',
                type: 'bar',
                data: results.metrics.returns.monthlyReturns.map((ret, index) => ({
                    x: `Month ${index + 1}`,
                    y: ret,
                    color: ret > 0 ? '#27AE60' : '#E74C3C'
                })),
                config: {
                    title: 'Monthly Returns',
                    xTitle: 'Month',
                    yTitle: 'Return (%)'
                }
            };

            // Strategy performance pie chart
            if (results.metrics.strategies.breakdown) {
                charts.strategyContribution = {
                    id: 'strategy-pie-chart',
                    type: 'pie',
                    data: Object.entries(results.metrics.strategies.breakdown).map(([strategy, metrics]) => ({
                        label: strategy,
                        value: Math.abs(metrics.totalPnL),
                        color: this.getStrategyColor(strategy)
                    })),
                    config: {
                        title: 'Strategy Contribution'
                    }
                };
            }

            // Risk-return scatter
            charts.riskReturn = {
                id: 'risk-return-chart',
                type: 'scatter',
                data: Object.entries(results.metrics.strategies.breakdown || {}).map(([strategy, metrics]) => ({
                    x: this.calculateStrategyVolatility(strategy, results.trades),
                    y: (metrics.totalPnL / results.metrics.basic.initialCapital) * 100,
                    label: strategy,
                    size: metrics.totalTrades
                })),
                config: {
                    title: 'Risk vs Return by Strategy',
                    xTitle: 'Volatility (%)',
                    yTitle: 'Return (%)'
                }
            };
        }

        return charts;
    }

    /**
     * Render executive summary HTML
     */
    renderExecutiveSummary(executive) {
        return `
            <div class="executive-summary">
                <div class="summary-grid">
                    <div class="summary-card highlight">
                        <h4>Total Return</h4>
                        <div class="metric-value ${executive.headline.totalReturn > 0 ? 'positive' : 'negative'}">
                            ${executive.headline.totalReturn.toFixed(2)}%
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <h4>Sharpe Ratio</h4>
                        <div class="metric-value ${executive.headline.sharpeRatio > 1 ? 'positive' : 'neutral'}">
                            ${executive.headline.sharpeRatio.toFixed(2)}
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <h4>Win Rate</h4>
                        <div class="metric-value ${executive.headline.winRate > 60 ? 'positive' : 'neutral'}">
                            ${executive.headline.winRate.toFixed(1)}%
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <h4>Max Drawdown</h4>
                        <div class="metric-value ${Math.abs(executive.headline.maxDrawdown) < 10 ? 'positive' : 'warning'}">
                            ${executive.headline.maxDrawdown.toFixed(2)}%
                        </div>
                    </div>
                </div>
                
                <div class="key-insights">
                    <h4>Key Insights</h4>
                    <ul>
                        ${executive.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Generate CSV exports
     */
    async generateCSVExports(results) {
        // Trades CSV
        const tradesCSV = this.generateTradesCSV(results.trades);
        const tradesPath = path.join(this.config.outputDir, `trades-${Date.now()}.csv`);
        await fs.writeFile(tradesPath, tradesCSV);

        // Daily P&L CSV
        const dailyPnLCSV = this.generateDailyPnLCSV(results.dailyPnL);
        const dailyPath = path.join(this.config.outputDir, `daily-pnl-${Date.now()}.csv`);
        await fs.writeFile(dailyPath, dailyPnLCSV);

        this.logger.info('BACKTEST-REPORT', 'CSV exports generated', {
            trades: tradesPath,
            dailyPnL: dailyPath
        });
    }

    /**
     * Generate trades CSV
     */
    generateTradesCSV(trades) {
        const headers = [
            'Date', 'Strategy', 'Symbol', 'Type', 'Entry', 'Exit', 'P&L', 'P&L %', 
            'Holding Days', 'Contracts', 'Exit Reason'
        ];

        const rows = trades.map(trade => [
            trade.entryDate,
            trade.strategy,
            trade.underlying,
            trade.type || 'N/A',
            trade.entryValue.toFixed(2),
            trade.exitValue.toFixed(2),
            trade.pnl.toFixed(2),
            trade.pnlPercent.toFixed(2),
            trade.holdingPeriod,
            trade.contracts,
            trade.exitReason
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Generate daily P&L CSV
     */
    generateDailyPnLCSV(dailyPnL) {
        const headers = ['Date', 'Capital', 'Daily P&L', 'Positions', 'Phase'];
        
        const rows = dailyPnL.map(day => [
            day.date,
            day.capital.toFixed(2),
            day.pnl.toFixed(2),
            day.positions,
            day.phase
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Utility functions
     */
    
    async ensureDirectories() {
        try {
            await fs.mkdir(this.config.outputDir, { recursive: true });
            await fs.mkdir(this.config.templateDir, { recursive: true });
        } catch (error) {
            this.logger.error('BACKTEST-REPORT', 'Failed to create directories', error);
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-GB', {
            style: 'currency',
            currency: this.config.currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    calculateConsistencyRating(monthlyWinRate) {
        if (monthlyWinRate >= 80) return 'Excellent';
        if (monthlyWinRate >= 70) return 'Very Good';
        if (monthlyWinRate >= 60) return 'Good';
        if (monthlyWinRate >= 50) return 'Fair';
        return 'Poor';
    }

    generateReportMetadata(results) {
        return {
            title: `Tom King Trading Framework - Backtest Report`,
            subtitle: `Performance Analysis & Strategy Validation`,
            generatedAt: new Date().toISOString(),
            period: {
                start: results.dailyPnL[0]?.date,
                end: results.dailyPnL[results.dailyPnL.length - 1]?.date
            },
            version: '17.0',
            framework: 'Tom King Trading System'
        };
    }

    getDefaultHTMLTemplate() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{REPORT_TITLE}}</title>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 3px solid #2E86AB; padding-bottom: 20px; margin-bottom: 30px; }
        .section { margin-bottom: 40px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #2E86AB; }
        .metric-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
        .positive { color: #27AE60; }
        .negative { color: #E74C3C; }
        .neutral { color: #34495E; }
        .warning { color: #F39C12; }
        .chart-container { margin: 20px 0; height: 400px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #2E86AB; color: white; }
        .key-insights ul { list-style-type: none; padding: 0; }
        .key-insights li { background: #e8f4fd; padding: 10px; margin: 10px 0; border-left: 4px solid #2E86AB; border-radius: 4px; }
        {{CUSTOM_STYLES}}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{REPORT_TITLE}}</h1>
            <p>Generated on {{GENERATION_DATE}}</p>
        </div>
        
        <div class="section">
            <h2>Executive Summary</h2>
            {{EXECUTIVE_SUMMARY}}
        </div>
        
        <div class="section">
            <h2>Performance Analysis</h2>
            {{PERFORMANCE_SECTION}}
        </div>
        
        <div class="section">
            <h2>Strategy Breakdown</h2>
            {{STRATEGIES_SECTION}}
        </div>
        
        <div class="section">
            <h2>Risk Analysis</h2>
            {{RISK_SECTION}}
        </div>
        
        <div class="section">
            <h2>Trade Analysis</h2>
            {{TRADES_SECTION}}
        </div>
        
        {{PATTERNS_SECTION}}
        {{OPTIMIZATION_SECTION}}
        
        <div class="section">
            <h2>Recommendations</h2>
            {{RECOMMENDATIONS_SECTION}}
        </div>
        
        <div class="section">
            <h2>Appendix</h2>
            {{APPENDIX_SECTION}}
        </div>
    </div>
    
    <script>
        {{CHARTS_SCRIPT}}
    </script>
</body>
</html>`;
    }

    // Additional rendering methods would continue here...
    // Including specific section renderers, chart generation, etc.
    
    generateRecommendationsSection(results) {
        const recommendations = [];
        const metrics = results.metrics;

        // Performance recommendations
        if (metrics.basic.totalReturn < 10) {
            recommendations.push({
                category: 'Performance',
                priority: 'High',
                issue: `Low absolute returns (${metrics.basic.totalReturn.toFixed(1)}%)`,
                recommendation: 'Review entry criteria and consider more selective trade filtering',
                impact: 'Could improve overall profitability'
            });
        }

        // Risk recommendations
        if (Math.abs(metrics.drawdown.maxDrawdown) > 20) {
            recommendations.push({
                category: 'Risk Management',
                priority: 'High',
                issue: `Maximum drawdown exceeds 20% (${metrics.drawdown.maxDrawdown.toFixed(1)}%)`,
                recommendation: 'Implement position sizing limits and correlation controls',
                impact: 'Reduce portfolio risk and improve risk-adjusted returns'
            });
        }

        // Strategy recommendations
        if (metrics.strategies.worstStrategy) {
            const worst = metrics.strategies.breakdown[metrics.strategies.worstStrategy];
            if (worst.winRate < 40) {
                recommendations.push({
                    category: 'Strategy',
                    priority: 'Medium',
                    issue: `${metrics.strategies.worstStrategy} has low win rate (${worst.winRate.toFixed(1)}%)`,
                    recommendation: 'Consider revising entry/exit rules or removing strategy',
                    impact: 'Improve overall system performance'
                });
            }
        }

        return {
            summary: {
                total: recommendations.length,
                highPriority: recommendations.filter(r => r.priority === 'High').length,
                categories: [...new Set(recommendations.map(r => r.category))]
            },
            recommendations
        };
    }

    generateAppendixSection(results) {
        return {
            methodology: {
                description: 'Tom King Trading Framework Backtesting Methodology',
                assumptions: [
                    'Historical data accuracy assumed',
                    'Transaction costs included at £2.50 per contract',
                    'Slippage estimated at 2% of entry price',
                    'No overnight gaps or market closures modeled',
                    'Perfect fill assumption for liquid instruments'
                ],
                limitations: [
                    'Past performance does not guarantee future results',
                    'Market regime changes not fully captured',
                    'Limited to available historical data period',
                    'Strategy parameter optimization may lead to overfitting'
                ]
            },
            glossary: this.generateGlossary(),
            technicalDetails: {
                calculationMethods: 'Standard industry formulas used for all metrics',
                riskFreeRate: '2% annual assumption',
                tradingDays: '252 days per year assumption',
                currency: this.config.currency
            }
        };
    }

    generateGlossary() {
        return {
            'Sharpe Ratio': 'Risk-adjusted return measure (excess return / volatility)',
            'Sortino Ratio': 'Downside risk-adjusted return measure',
            'Calmar Ratio': 'Annual return divided by maximum drawdown',
            'Maximum Drawdown': 'Largest peak-to-trough decline in portfolio value',
            'Value at Risk (VaR)': 'Maximum expected loss at given confidence level',
            'Win Rate': 'Percentage of profitable trades',
            'Profit Factor': 'Gross profit divided by gross loss',
            'Expectancy': 'Average profit per trade',
            'CAGR': 'Compound Annual Growth Rate'
        };
    }
}

module.exports = BacktestReportGenerator;