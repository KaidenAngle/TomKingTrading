/**
 * VISUALIZATION GENERATOR
 * Creates HTML visualizations after text output
 * Based on original framework dashboard requirements
 */

const fs = require('fs');
const path = require('path');

class VisualizationGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '../output');
        this.ensureOutputDir();
    }

    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate complete HTML visualization from analysis results
     */
    generateVisualization(analysisData, userData, recommendations) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `analysis_${timestamp}.html`;
        const filepath = path.join(this.outputDir, filename);
        
        const html = this.buildHTML(analysisData, userData, recommendations);
        
        fs.writeFileSync(filepath, html);
        console.log(`\n📊 Visualization saved: ${filename}`);
        console.log(`   Open: file://${filepath}`);
        
        return filepath;
    }

    buildHTML(analysisData, userData, recommendations) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tom King Trading Analysis - ${new Date().toLocaleDateString()}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: #fff;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
        }
        .card h2 {
            margin-bottom: 15px;
            color: #4fc3f7;
            font-size: 1.3em;
            border-bottom: 2px solid #4fc3f7;
            padding-bottom: 10px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .metric:last-child {
            border-bottom: none;
        }
        .label {
            color: #b3d9ff;
        }
        .value {
            font-weight: bold;
            color: #fff;
        }
        .positive { color: #4caf50; }
        .negative { color: #f44336; }
        .warning { color: #ff9800; }
        .neutral { color: #ffc107; }
        
        /* Position table */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        th {
            background: rgba(255,255,255,0.1);
            color: #4fc3f7;
        }
        
        /* Progress bars */
        .progress-bar {
            width: 100%;
            height: 30px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4fc3f7, #29b6f6);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            transition: width 1s ease;
        }
        
        /* Recommendations */
        .recommendation {
            background: rgba(255,255,255,0.05);
            border-left: 4px solid #4fc3f7;
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
        }
        .recommendation.critical {
            border-left-color: #f44336;
            background: rgba(244,67,54,0.1);
        }
        .recommendation.high {
            border-left-color: #ff9800;
            background: rgba(255,152,0,0.1);
        }
        .recommendation.low {
            border-left-color: #4caf50;
            background: rgba(76,175,80,0.1);
        }
        
        /* Charts */
        .chart-container {
            height: 300px;
            margin-top: 20px;
        }
        
        /* Status indicators */
        .status {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 5px;
        }
        .status.green { background: #4caf50; }
        .status.yellow { background: #ffc107; }
        .status.red { background: #f44336; }
        
        /* Footer */
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            border-top: 1px solid rgba(255,255,255,0.2);
            color: rgba(255,255,255,0.7);
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>🎯 Tom King Trading Framework Analysis</h1>
        
        <!-- Account Overview -->
        <div class="grid">
            <div class="card">
                <h2>📊 Account Status</h2>
                ${this.renderAccountStatus(userData)}
            </div>
            
            <div class="card">
                <h2>⚠️ Risk Analysis</h2>
                ${this.renderRiskAnalysis(analysisData)}
            </div>
            
            <div class="card">
                <h2>📈 Market Conditions</h2>
                ${this.renderMarketConditions(analysisData)}
            </div>
        </div>
        
        <!-- BP Usage Chart -->
        <div class="card">
            <h2>💰 Buying Power Allocation</h2>
            ${this.renderBPAllocation(userData, analysisData)}
        </div>
        
        <!-- Position Allocation Table -->
        <div class="card">
            <h2>📋 Position Allocation Plan</h2>
            ${this.renderAllocationTable(analysisData)}
        </div>
        
        <!-- Recommendations -->
        <div class="card">
            <h2>✅ Action Items</h2>
            ${this.renderRecommendations(recommendations)}
        </div>
        
        <!-- Pattern Opportunities -->
        <div class="card">
            <h2>🎯 Pattern Opportunities</h2>
            ${this.renderPatternOpportunities(analysisData)}
        </div>
        
        <!-- Greeks Analysis -->
        <div class="card">
            <h2>⚡ Portfolio Greeks</h2>
            ${this.renderGreeks(analysisData)}
        </div>
        
        <!-- Performance Projection -->
        <div class="card">
            <h2>📊 Performance Projection</h2>
            <canvas id="projectionChart"></canvas>
        </div>
        
        <div class="footer">
            Generated: ${new Date().toLocaleString()} | 
            Framework v17 | 
            Goal: £35k → £80k in 8 months
        </div>
    </div>
    
    <script>
        ${this.generateChartScript(userData)}
    </script>
</body>
</html>`;
    }

    renderAccountStatus(userData) {
        const phaseNames = {
            1: 'Foundation (£30-40k)',
            2: 'Growth (£40-60k)',
            3: 'Advanced (£60-75k)',
            4: 'Professional (£75k+)'
        };
        
        return `
            <div class="metric">
                <span class="label">Account Value:</span>
                <span class="value">£${userData.accountValue?.toLocaleString() || '0'}</span>
            </div>
            <div class="metric">
                <span class="label">Phase:</span>
                <span class="value">${userData.phase} - ${phaseNames[userData.phase]}</span>
            </div>
            <div class="metric">
                <span class="label">BP Used:</span>
                <span class="value ${userData.bpUsed > 50 ? 'warning' : ''}">${userData.bpUsed || 0}%</span>
            </div>
            <div class="metric">
                <span class="label">Positions:</span>
                <span class="value">${userData.positions?.length || 0}</span>
            </div>
            <div class="metric">
                <span class="label">Month P&L:</span>
                <span class="value ${userData.monthPL >= 0 ? 'positive' : 'negative'}">
                    £${userData.monthPL?.toLocaleString() || '0'}
                </span>
            </div>
        `;
    }

    renderRiskAnalysis(analysisData) {
        const risk = analysisData?.riskAnalysis || {};
        const violations = risk.correlationRisk?.violations || [];
        
        return `
            <div class="metric">
                <span class="label">Risk Level:</span>
                <span class="value ${risk.riskLevel === 'HIGH' ? 'negative' : risk.riskLevel === 'MEDIUM' ? 'warning' : 'positive'}">
                    ${risk.riskLevel || 'LOW'}
                </span>
            </div>
            <div class="metric">
                <span class="label">Violations:</span>
                <span class="value ${violations.length > 0 ? 'negative' : 'positive'}">
                    ${violations.length}
                </span>
            </div>
            ${violations.map(v => `
                <div class="recommendation critical" style="margin-top: 10px;">
                    ${v.message || v}
                </div>
            `).join('')}
        `;
    }

    renderMarketConditions(analysisData) {
        const vixLevel = analysisData?.vixLevel || 16;
        const vixRegime = this.getVIXRegime(vixLevel);
        
        return `
            <div class="metric">
                <span class="label">VIX Level:</span>
                <span class="value">${vixLevel.toFixed(2)}</span>
            </div>
            <div class="metric">
                <span class="label">VIX Regime:</span>
                <span class="value">${vixRegime.regime}</span>
            </div>
            <div class="metric">
                <span class="label">BP Target:</span>
                <span class="value">${vixRegime.min}-${vixRegime.max}%</span>
            </div>
            <div class="metric">
                <span class="label">Market Status:</span>
                <span class="value">
                    <span class="status ${this.isMarketOpen() ? 'green' : 'red'}"></span>
                    ${this.isMarketOpen() ? 'OPEN' : 'CLOSED'}
                </span>
            </div>
        `;
    }

    renderBPAllocation(userData, analysisData) {
        const bpUsed = userData.bpUsed || 0;
        const maxBP = this.getMaxBPForPhase(userData.phase);
        
        return `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (bpUsed/maxBP)*100)}%">
                    ${bpUsed}% / ${maxBP}% max
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                <span>Available: ${maxBP - bpUsed}%</span>
                <span>Reserve: ${100 - maxBP}%</span>
            </div>
        `;
    }

    renderAllocationTable(analysisData) {
        const allocation = analysisData?.allocationTable?.table || [];
        
        if (allocation.length === 0) {
            return '<p>No allocation data available</p>';
        }
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>Strategy</th>
                        <th>Max</th>
                        <th>Current</th>
                        <th>Available</th>
                        <th>BP/Pos</th>
                        <th>Priority</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocation.map(row => `
                        <tr>
                            <td>${row.strategy}</td>
                            <td>${row.maxPos}</td>
                            <td>${row.currentPos}</td>
                            <td>${row.availablePos}</td>
                            <td>${row.bpPerPos}%</td>
                            <td class="${row.priority.includes('TODAY') ? 'positive' : ''}">${row.priority}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderRecommendations(recommendations) {
        const items = recommendations?.actionItems || [];
        
        if (items.length === 0) {
            return '<p>No immediate actions required</p>';
        }
        
        return items.map(item => {
            const priorityClass = item.priority.toLowerCase();
            return `
                <div class="recommendation ${priorityClass}">
                    <strong>[${item.priority}] ${item.action}</strong>
                    <p>${item.details}</p>
                    ${item.reasoning ? `<small>Reason: ${item.reasoning}</small>` : ''}
                </div>
            `;
        }).join('');
    }

    renderPatternOpportunities(analysisData) {
        const patterns = analysisData?.patternAnalysis || {};
        const entries = Object.entries(patterns);
        
        if (entries.length === 0) {
            return '<p>No pattern opportunities detected</p>';
        }
        
        return entries.map(([ticker, data]) => `
            <div class="metric">
                <span class="label">${ticker}:</span>
                <span class="value">
                    ${data.confidence?.toFixed(0) || 0}% confidence
                    ${data.preferredStrategy ? `(${data.preferredStrategy})` : ''}
                </span>
            </div>
        `).join('');
    }

    renderGreeks(analysisData) {
        const greeks = analysisData?.portfolioOptimization?.currentPortfolioGreeks || {};
        
        return `
            <div class="metric">
                <span class="label">Delta:</span>
                <span class="value">${greeks.delta?.toFixed(3) || '0.000'}</span>
            </div>
            <div class="metric">
                <span class="label">Gamma:</span>
                <span class="value">${greeks.gamma?.toFixed(3) || '0.000'}</span>
            </div>
            <div class="metric">
                <span class="label">Theta:</span>
                <span class="value ${greeks.theta > 0 ? 'positive' : 'negative'}">
                    ${greeks.theta?.toFixed(3) || '0.000'}
                </span>
            </div>
            <div class="metric">
                <span class="label">Vega:</span>
                <span class="value">${greeks.vega?.toFixed(3) || '0.000'}</span>
            </div>
        `;
    }

    generateChartScript(userData) {
        const startValue = userData.accountValue || 35000;
        const months = [];
        const values = [];
        let currentValue = startValue;
        
        for (let i = 0; i <= 8; i++) {
            months.push(`Month ${i}`);
            values.push(Math.round(currentValue));
            currentValue *= 1.08; // 8% monthly growth
        }
        
        return `
            const ctx = document.getElementById('projectionChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ${JSON.stringify(months)},
                    datasets: [{
                        label: 'Projected Value (8% monthly)',
                        data: ${JSON.stringify(values)},
                        borderColor: '#4fc3f7',
                        backgroundColor: 'rgba(79, 195, 247, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    }, {
                        label: 'Goal (£80,000)',
                        data: Array(9).fill(80000),
                        borderColor: '#4caf50',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: { color: '#fff' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            ticks: {
                                color: '#fff',
                                callback: function(value) {
                                    return '£' + value.toLocaleString();
                                }
                            },
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            }
                        },
                        x: {
                            ticks: { color: '#fff' },
                            grid: {
                                color: 'rgba(255,255,255,0.1)'
                            }
                        }
                    }
                }
            });
        `;
    }

    // Helper methods
    getVIXRegime(vixLevel) {
        if (vixLevel < 13) return { regime: 'LOW', min: 40, max: 50 };
        if (vixLevel < 18) return { regime: 'NORMAL', min: 60, max: 70 };
        if (vixLevel < 25) return { regime: 'ELEVATED', min: 75, max: 80 };
        if (vixLevel < 30) return { regime: 'HIGH', min: 50, max: 60 };
        return { regime: 'CRISIS', min: 80, max: 80 };
    }

    getMaxBPForPhase(phase) {
        const limits = { 1: 50, 2: 65, 3: 75, 4: 80 };
        return limits[phase] || 65;
    }

    isMarketOpen() {
        const now = new Date();
        const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = nyTime.getDay();
        const hour = nyTime.getHours();
        const minute = nyTime.getMinutes();
        const time = hour * 100 + minute;
        
        if (day === 0 || day === 6) return false;
        return time >= 930 && time < 1600;
    }
}

module.exports = VisualizationGenerator;