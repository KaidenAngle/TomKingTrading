/**
 * Performance Dashboard Module
 * Live P&L display, historical performance charts, and comprehensive reporting
 * For Tom King Trading Framework
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Chart Data Generator
 * Generates data structures for various performance charts
 */
class ChartDataGenerator {
    /**
     * Generate daily P&L chart data
     */
    static generateDailyPLChart(dailyPLData) {
        const chartData = {
            labels: [],
            datasets: [{
                label: 'Daily P&L (£)',
                data: [],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        };
        
        let cumulativePL = 0;
        dailyPLData.forEach(dayData => {
            chartData.labels.push(dayData.date);
            cumulativePL += dayData.totalDollarPL || 0;
            chartData.datasets[0].data.push(cumulativePL);
        });
        
        return chartData;
    }
    
    /**
     * Generate strategy performance comparison chart
     */
    static generateStrategyPerformanceChart(strategyPLData) {
        const strategies = Object.keys(strategyPLData);
        const chartData = {
            labels: strategies,
            datasets: [{
                label: 'Strategy P&L (£)',
                data: strategies.map(strategy => strategyPLData[strategy].netPL),
                backgroundColor: [
                    '#3b82f6', // Blue for 0DTE
                    '#10b981', // Green for Strangles
                    '#f59e0b', // Orange for LT112
                    '#ef4444', // Red for IPMCC
                    '#8b5cf6', // Purple for others
                    '#06b6d4', // Cyan
                    '#84cc16'  // Lime
                ].slice(0, strategies.length),
                borderWidth: 1
            }]
        };
        
        return chartData;
    }
    
    /**
     * Generate correlation group exposure chart
     */
    static generateCorrelationExposureChart(correlationPLData) {
        const groups = Object.keys(correlationPLData);
        const chartData = {
            labels: groups,
            datasets: [{
                label: 'Group P&L (£)',
                data: groups.map(group => correlationPLData[group].netPL),
                backgroundColor: groups.map(group => {
                    const colorMap = {
                        'A1': '#ef4444', // Red for equity risk
                        'A2': '#f97316', // Orange for international equity
                        'B1': '#eab308', // Yellow for energy
                        'C1': '#84cc16', // Lime for metals
                        'D1': '#22c55e', // Green for agriculture
                        'E': '#06b6d4',   // Cyan for fixed income
                        'F': '#8b5cf6',   // Purple for currencies
                        'UNCORRELATED': '#6b7280' // Gray for uncorrelated
                    };
                    return colorMap[group] || '#6b7280';
                })
            }]
        };
        
        return chartData;
    }
    
    /**
     * Generate monthly income progression chart
     */
    static generateMonthlyIncomeChart(monthlyIncomes, targetIncome = 10000) {
        const chartData = {
            labels: monthlyIncomes.map(mi => mi.month),
            datasets: [
                {
                    label: 'Monthly Income (£)',
                    data: monthlyIncomes.map(mi => mi.income),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    type: 'line'
                },
                {
                    label: 'Target Income (£10k)',
                    data: new Array(monthlyIncomes.length).fill(targetIncome),
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    type: 'line'
                }
            ]
        };
        
        return chartData;
    }
    
    /**
     * Generate win rate by strategy chart
     */
    static generateWinRateChart(tradeStatistics) {
        const strategies = Object.keys(tradeStatistics);
        const chartData = {
            labels: strategies,
            datasets: [{
                label: 'Win Rate (%)',
                data: strategies.map(strategy => tradeStatistics[strategy].winRate || 0),
                backgroundColor: strategies.map(strategy => {
                    const winRate = tradeStatistics[strategy].winRate || 0;
                    if (winRate >= 80) return '#10b981'; // Green
                    if (winRate >= 60) return '#f59e0b'; // Orange
                    return '#ef4444'; // Red
                }),
                borderWidth: 1
            }]
        };
        
        return chartData;
    }
    
    /**
     * Generate account growth chart toward £80k goal
     */
    static generateAccountGrowthChart(dailyPLData, startingBalance = 35000, targetBalance = 80000) {
        let currentBalance = startingBalance;
        const chartData = {
            labels: [],
            datasets: [
                {
                    label: 'Account Value (£)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: true
                },
                {
                    label: 'Target (£80k)',
                    data: [],
                    borderColor: '#ef4444',
                    borderDash: [10, 5],
                    borderWidth: 2,
                    fill: false
                }
            ]
        };
        
        dailyPLData.forEach(dayData => {
            chartData.labels.push(dayData.date);
            currentBalance += dayData.totalDollarPL || 0;
            chartData.datasets[0].data.push(currentBalance);
            chartData.datasets[1].data.push(targetBalance);
        });
        
        return chartData;
    }
}

/**
 * Real-time Dashboard Data Manager
 */
class DashboardDataManager extends EventEmitter {
    constructor(positionTracker, plEngine) {
        super();
        this.positionTracker = positionTracker;
        this.plEngine = plEngine;
        this.dashboardData = null;
        this.updateInterval = null;
        this.isUpdating = false;
        
        this.setupEventHandlers();
        this.startRealTimeUpdates();
        
        logger.info('DASHBOARD', 'Dashboard data manager initialized');
    }
    
    setupEventHandlers() {
        // Listen for position updates
        this.positionTracker.on('positionsUpdated', () => {
            this.updateDashboardData();
        });
        
        // Listen for P&L calculations
        this.plEngine.on('plCalculated', () => {
            this.updateDashboardData();
        });
        
        // Listen for trade completions
        this.plEngine.on('tradeCompleted', () => {
            this.updateDashboardData();
        });
    }
    
    startRealTimeUpdates(interval = 30000) { // 30 seconds
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.updateDashboardData();
        }, interval);
        
        // Initial update
        this.updateDashboardData();
    }
    
    async updateDashboardData() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        
        try {
            const positions = this.positionTracker.getAllPositions();
            const positionSummary = this.positionTracker.getSummary();
            const currentPL = this.plEngine.getCurrentPL();
            const tomKingMetrics = this.plEngine.getTomKingPerformance();
            const plReport = this.plEngine.generatePLReport();
            
            // Generate chart data
            const chartData = this.generateAllCharts(plReport, tomKingMetrics);
            
            // Create comprehensive dashboard data
            this.dashboardData = {
                timestamp: new Date().toISOString(),
                summary: {
                    totalPositions: positionSummary.totalPositions,
                    totalUnrealizedPL: positionSummary.totalUnrealizedPL,
                    alertCount: positionSummary.alertCount,
                    expiringCount: positionSummary.expiringCount,
                    profitablePositions: positionSummary.profitablePositions
                },
                positions: {
                    all: positions,
                    byStrategy: positionSummary.positionsByStrategy,
                    byCorrelationGroup: positionSummary.positionsByCorrelationGroup,
                    expiring: this.positionTracker.getExpiringPositions(),
                    needingAttention: this.positionTracker.getPositionsNeedingAttention()
                },
                pl: {
                    current: currentPL,
                    historical: plReport.historical,
                    statistics: plReport.statistics
                },
                tomKingMetrics: tomKingMetrics,
                charts: chartData,
                alerts: this.positionTracker.getAllAlerts(),
                goalProgress: this.calculateGoalProgress(tomKingMetrics),
                riskMetrics: this.calculateRiskMetrics(positions, positionSummary)
            };
            
            this.emit('dashboardUpdated', this.dashboardData);
            
        } catch (error) {
            logger.error('DASHBOARD', `Failed to update dashboard data: ${error.message}`);
        } finally {
            this.isUpdating = false;
        }
    }
    
    generateAllCharts(plReport, tomKingMetrics) {
        const charts = {};
        
        try {
            // Daily P&L chart
            if (plReport.historical?.daily30Days) {
                charts.dailyPL = ChartDataGenerator.generateDailyPLChart(
                    plReport.historical.daily30Days
                );
            }
            
            // Strategy performance chart
            if (plReport.current?.byStrategy) {
                charts.strategyPerformance = ChartDataGenerator.generateStrategyPerformanceChart(
                    plReport.current.byStrategy
                );
            }
            
            // Correlation exposure chart
            if (plReport.current?.byCorrelationGroup) {
                charts.correlationExposure = ChartDataGenerator.generateCorrelationExposureChart(
                    plReport.current.byCorrelationGroup
                );
            }
            
            // Monthly income progression
            if (tomKingMetrics.monthlyProgression?.monthlyIncomes) {
                charts.monthlyIncome = ChartDataGenerator.generateMonthlyIncomeChart(
                    tomKingMetrics.monthlyProgression.monthlyIncomes
                );
            }
            
            // Win rate chart
            if (plReport.statistics?.byStrategy) {
                charts.winRate = ChartDataGenerator.generateWinRateChart(
                    plReport.statistics.byStrategy
                );
            }
            
            // Account growth chart
            if (plReport.historical?.daily30Days) {
                charts.accountGrowth = ChartDataGenerator.generateAccountGrowthChart(
                    plReport.historical.daily30Days
                );
            }
            
        } catch (error) {
            logger.error('DASHBOARD', `Failed to generate charts: ${error.message}`);
        }
        
        return charts;
    }
    
    calculateGoalProgress(tomKingMetrics) {
        const startingBalance = 35000;
        const targetBalance = 80000;
        const targetMonthlyIncome = 10000;
        
        // Estimate current account value (this would come from actual account data in real implementation)
        const monthlyIncomes = tomKingMetrics.monthlyProgression?.monthlyIncomes || [];
        const totalPL = monthlyIncomes.reduce((sum, month) => sum + month.income, 0);
        const currentBalance = startingBalance + totalPL;
        
        const balanceProgress = ((currentBalance - startingBalance) / (targetBalance - startingBalance)) * 100;
        const incomeProgress = (tomKingMetrics.monthlyProgression?.currentMonthIncome || 0) / targetMonthlyIncome * 100;
        
        return {
            startingBalance,
            currentBalance,
            targetBalance,
            balanceProgress: Math.min(100, Math.max(0, balanceProgress)),
            currentMonthlyIncome: tomKingMetrics.monthlyProgression?.currentMonthIncome || 0,
            targetMonthlyIncome,
            incomeProgress: Math.min(100, Math.max(0, incomeProgress)),
            monthsToTarget: tomKingMetrics.monthlyProgression?.monthsToTarget,
            progressPercent: tomKingMetrics.monthlyProgression?.progressPercent || 0
        };
    }
    
    calculateRiskMetrics(positions, summary) {
        // Calculate various risk metrics
        const totalPositions = positions.length;
        if (totalPositions === 0) {
            return {
                concentrationRisk: 'LOW',
                expirationRisk: 'LOW',
                correlationRisk: 'LOW',
                overallRisk: 'LOW'
            };
        }
        
        // Concentration risk (positions per strategy)
        const maxStrategyConcentration = Math.max(...Object.values(summary.positionsByStrategy || {}));
        const concentrationRatio = maxStrategyConcentration / totalPositions;
        
        // Expiration risk (positions expiring soon)
        const expirationRatio = summary.expiringCount / totalPositions;
        
        // Correlation risk (positions in same correlation groups)
        const maxGroupConcentration = Math.max(...Object.values(summary.positionsByCorrelationGroup || {}));
        const correlationRatio = maxGroupConcentration / totalPositions;
        
        const getRiskLevel = (ratio) => {
            if (ratio > 0.6) return 'HIGH';
            if (ratio > 0.4) return 'MEDIUM';
            return 'LOW';
        };
        
        const concentrationRisk = getRiskLevel(concentrationRatio);
        const expirationRisk = getRiskLevel(expirationRatio);
        const correlationRisk = getRiskLevel(correlationRatio);
        
        // Overall risk assessment
        const riskLevels = [concentrationRisk, expirationRisk, correlationRisk];
        const overallRisk = riskLevels.includes('HIGH') ? 'HIGH' : 
                           riskLevels.includes('MEDIUM') ? 'MEDIUM' : 'LOW';
        
        return {
            concentrationRisk,
            expirationRisk,
            correlationRisk,
            overallRisk,
            concentrationRatio,
            expirationRatio,
            correlationRatio
        };
    }
    
    getDashboardData() {
        return this.dashboardData;
    }
    
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.removeAllListeners();
        logger.info('DASHBOARD', 'Dashboard data manager destroyed');
    }
}

/**
 * HTML Dashboard Generator
 */
class HTMLDashboardGenerator {
    static generateDashboard(dashboardData) {
        if (!dashboardData) {
            return this.generateEmptyDashboard();
        }
        
        const { summary, positions, pl, tomKingMetrics, charts, alerts, goalProgress, riskMetrics } = dashboardData;
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tom King Trading Framework - Performance Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            color: #1e293b;
        }
        
        .dashboard-header {
            background: linear-gradient(135deg, #3b82f6, #1e40af);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .dashboard-title {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 10px;
        }
        
        .last-update {
            opacity: 0.9;
            font-size: 0.9rem;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #3b82f6;
        }
        
        .metric-card.profit {
            border-left-color: #10b981;
        }
        
        .metric-card.loss {
            border-left-color: #ef4444;
        }
        
        .metric-card.warning {
            border-left-color: #f59e0b;
        }
        
        .metric-title {
            font-size: 0.9rem;
            color: #6b7280;
            margin-bottom: 8px;
        }
        
        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #1e293b;
        }
        
        .metric-change {
            font-size: 0.85rem;
            margin-top: 4px;
        }
        
        .positive {
            color: #10b981;
        }
        
        .negative {
            color: #ef4444;
        }
        
        .section {
            background: white;
            margin-bottom: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
        }
        
        .section-header {
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 1.2rem;
            font-weight: bold;
        }
        
        .section-content {
            padding: 20px;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        
        .chart-container {
            position: relative;
            height: 300px;
        }
        
        .goal-progress {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        
        .progress-bar {
            width: 100%;
            height: 10px;
            background-color: rgba(255, 255, 255, 0.3);
            border-radius: 5px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background-color: white;
            transition: width 0.5s ease;
        }
        
        .alerts-section {
            max-height: 300px;
            overflow-y: auto;
        }
        
        .alert-item {
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 6px;
            border-left: 4px solid;
        }
        
        .alert-emergency {
            background-color: #fef2f2;
            border-left-color: #dc2626;
        }
        
        .alert-urgent {
            background-color: #fff7ed;
            border-left-color: #ea580c;
        }
        
        .alert-high {
            background-color: #fefce8;
            border-left-color: #ca8a04;
        }
        
        .positions-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .positions-table th,
        .positions-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .positions-table th {
            background-color: #f9fafb;
            font-weight: 600;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        
        .status-excellent {
            background-color: #d1fae5;
            color: #065f46;
        }
        
        .status-good {
            background-color: #dbeafe;
            color: #1e40af;
        }
        
        .status-fair {
            background-color: #fef3c7;
            color: #92400e;
        }
        
        .status-poor {
            background-color: #fed7d7;
            color: #991b1b;
        }
        
        .status-critical {
            background-color: #fecaca;
            color: #7f1d1d;
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="dashboard-title">Tom King Trading Framework</div>
        <div>Performance Dashboard - £35k → £80k Journey</div>
        <div class="last-update">Last Updated: ${new Date().toLocaleString()}</div>
    </div>

    <!-- Goal Progress Section -->
    <div class="goal-progress">
        <h3>Goal Progress: £35,000 → £80,000</h3>
        <div>Current Balance: £${goalProgress.currentBalance?.toLocaleString()}</div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${goalProgress.balanceProgress}%"></div>
        </div>
        <div>Progress: ${goalProgress.balanceProgress?.toFixed(1)}% | Monthly Income: £${goalProgress.currentMonthlyIncome?.toLocaleString()} / £${goalProgress.targetMonthlyIncome?.toLocaleString()}</div>
    </div>

    <!-- Key Metrics -->
    <div class="metrics-grid">
        <div class="metric-card ${summary.totalUnrealizedPL?.dollar >= 0 ? 'profit' : 'loss'}">
            <div class="metric-title">Unrealized P&L</div>
            <div class="metric-value">£${summary.totalUnrealizedPL?.dollar?.toLocaleString() || '0'}</div>
            <div class="metric-change ${summary.totalUnrealizedPL?.dollar >= 0 ? 'positive' : 'negative'}">
                ${summary.totalUnrealizedPL?.percent?.toFixed(2) || '0.00'}%
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">Active Positions</div>
            <div class="metric-value">${summary.totalPositions || 0}</div>
            <div class="metric-change">
                ${summary.profitablePositions || 0} profitable
            </div>
        </div>
        
        <div class="metric-card ${summary.alertCount > 0 ? 'warning' : ''}">
            <div class="metric-title">Alerts</div>
            <div class="metric-value">${summary.alertCount || 0}</div>
            <div class="metric-change">
                ${summary.expiringCount || 0} expiring soon
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-title">Win Rate (Overall)</div>
            <div class="metric-value">${tomKingMetrics?.overall?.winRate?.toFixed(1) || '0.0'}%</div>
            <div class="metric-change">
                ${tomKingMetrics?.overall?.totalTrades || 0} trades
            </div>
        </div>
    </div>

    <!-- Charts Section -->
    <div class="section">
        <div class="section-header">Performance Charts</div>
        <div class="section-content">
            <div class="charts-grid">
                ${charts?.accountGrowth ? `
                <div class="chart-container">
                    <canvas id="accountGrowthChart"></canvas>
                </div>
                ` : ''}
                
                ${charts?.strategyPerformance ? `
                <div class="chart-container">
                    <canvas id="strategyPerformanceChart"></canvas>
                </div>
                ` : ''}
                
                ${charts?.monthlyIncome ? `
                <div class="chart-container">
                    <canvas id="monthlyIncomeChart"></canvas>
                </div>
                ` : ''}
                
                ${charts?.winRate ? `
                <div class="chart-container">
                    <canvas id="winRateChart"></canvas>
                </div>
                ` : ''}
            </div>
        </div>
    </div>

    <!-- Active Positions Section -->
    <div class="section">
        <div class="section-header">Active Positions</div>
        <div class="section-content">
            <table class="positions-table">
                <thead>
                    <tr>
                        <th>Ticker</th>
                        <th>Strategy</th>
                        <th>DTE</th>
                        <th>P&L</th>
                        <th>Status</th>
                        <th>Group</th>
                    </tr>
                </thead>
                <tbody>
                    ${positions?.all?.map(position => `
                        <tr>
                            <td><strong>${position.ticker}</strong></td>
                            <td>${position.strategy}</td>
                            <td>${position.daysToExpiration || 'N/A'}</td>
                            <td class="${position.unrealizedPL?.percent >= 0 ? 'positive' : 'negative'}">
                                £${position.unrealizedPL?.dollar?.toFixed(2) || '0.00'} 
                                (${position.unrealizedPL?.percent?.toFixed(1) || '0.0'}%)
                            </td>
                            <td>
                                <span class="status-badge status-${(position.healthLevel || 'fair').toLowerCase()}">
                                    ${position.healthLevel || 'FAIR'}
                                </span>
                            </td>
                            <td>${position.correlationGroup}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="6">No active positions</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>

    <!-- Alerts Section -->
    ${alerts && alerts.length > 0 ? `
    <div class="section">
        <div class="section-header">Active Alerts</div>
        <div class="section-content">
            <div class="alerts-section">
                ${alerts.map(alert => `
                    <div class="alert-item alert-${alert.priority.toLowerCase()}">
                        <strong>${alert.ticker} ${alert.strategy}</strong>: ${alert.message}
                        <br><small>${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    </div>
    ` : ''}

    <script>
        // Chart rendering
        ${this.generateChartScripts(charts)}
        
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
        `;
    }
    
    static generateChartScripts(charts) {
        if (!charts) return '';
        
        let scripts = '';
        
        if (charts.accountGrowth) {
            scripts += `
                const accountGrowthCtx = document.getElementById('accountGrowthChart');
                if (accountGrowthCtx) {
                    new Chart(accountGrowthCtx, {
                        type: 'line',
                        data: ${JSON.stringify(charts.accountGrowth)},
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Account Growth Progress'
                                }
                            }
                        }
                    });
                }
            `;
        }
        
        if (charts.strategyPerformance) {
            scripts += `
                const strategyCtx = document.getElementById('strategyPerformanceChart');
                if (strategyCtx) {
                    new Chart(strategyCtx, {
                        type: 'bar',
                        data: ${JSON.stringify(charts.strategyPerformance)},
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Strategy Performance'
                                }
                            }
                        }
                    });
                }
            `;
        }
        
        if (charts.monthlyIncome) {
            scripts += `
                const monthlyIncomeCtx = document.getElementById('monthlyIncomeChart');
                if (monthlyIncomeCtx) {
                    new Chart(monthlyIncomeCtx, {
                        type: 'line',
                        data: ${JSON.stringify(charts.monthlyIncome)},
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Monthly Income Progression'
                                }
                            }
                        }
                    });
                }
            `;
        }
        
        if (charts.winRate) {
            scripts += `
                const winRateCtx = document.getElementById('winRateChart');
                if (winRateCtx) {
                    new Chart(winRateCtx, {
                        type: 'bar',
                        data: ${JSON.stringify(charts.winRate)},
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Win Rate by Strategy'
                                }
                            },
                            scales: {
                                y: {
                                    min: 0,
                                    max: 100
                                }
                            }
                        }
                    });
                }
            `;
        }
        
        return scripts;
    }
    
    static generateEmptyDashboard() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tom King Trading Framework - Dashboard Loading</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .spinner {
            border: 4px solid #e5e7eb;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <h2>Loading Dashboard...</h2>
        <p>Initializing Tom King Trading Framework performance data</p>
    </div>
    
    <script>
        setTimeout(() => {
            location.reload();
        }, 5000);
    </script>
</body>
</html>
        `;
    }
}

module.exports = {
    ChartDataGenerator,
    DashboardDataManager,
    HTMLDashboardGenerator
};