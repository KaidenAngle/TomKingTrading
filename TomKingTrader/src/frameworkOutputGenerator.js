/**
 * TOM KING FRAMEWORK OUTPUT GENERATOR
 * Creates comprehensive text and HTML visualizations
 * Based on original framework format with live data enhancements
 */

const fs = require('fs');
const path = require('path');

class FrameworkOutputGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '..', 'output');
        this.ensureOutputDirectory();
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * Generate complete framework output
     */
    async generateCompleteOutput(userData, marketData, recommendations, v14Analysis) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Generate text output first
        const textOutput = this.generateTextOutput(userData, marketData, recommendations, v14Analysis);
        const textFile = path.join(this.outputDir, `analysis_${timestamp}.txt`);
        fs.writeFileSync(textFile, textOutput);
        console.log(`\n📄 Text analysis saved to: ${textFile}`);
        
        // Generate HTML visualization
        const htmlOutput = this.generateHTMLOutput(userData, marketData, recommendations, v14Analysis);
        const htmlFile = path.join(this.outputDir, `dashboard_${timestamp}.html`);
        fs.writeFileSync(htmlFile, htmlOutput);
        console.log(`📊 HTML dashboard saved to: ${htmlFile}`);
        
        return { textFile, htmlFile, textOutput, htmlOutput };
    }

    /**
     * Generate text output in Tom King format
     */
    generateTextOutput(userData, marketData, recommendations, v14Analysis) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        let output = [];
        
        // Header
        output.push(`TOM KING POSITION ANALYSIS - ${dateStr}`);
        output.push('═'.repeat(60));
        output.push('');
        
        // Position Health Dashboard
        output.push('POSITION HEALTH DASHBOARD');
        output.push('─'.repeat(40));
        output.push('Current Portfolio Status:');
        output.push('');
        output.push(`Account Value: £${userData.accountValue.toLocaleString()}`);
        output.push(`Positions: ${userData.positions?.length || 0} active`);
        output.push(`BP Used: ${userData.bpUsed}% / ${this.getMaxBP(userData)}% max`);
        output.push(`VIX Level: ${userData.vixLevel?.toFixed(2)} (${this.getVIXRegime(userData.vixLevel)})`);
        output.push(`Day: ${userData.dayOfWeek} - ${this.getDayOpportunity(userData.dayOfWeek)}`);
        output.push('');
        
        // Immediate Actions
        output.push('IMMEDIATE ACTIONS REQUIRED:');
        output.push('─'.repeat(40));
        
        if (recommendations.actionItems && recommendations.actionItems.length > 0) {
            recommendations.actionItems.slice(0, 3).forEach(item => {
                const icon = this.getPriorityIcon(item.priority);
                output.push(`${icon} ${item.action.toUpperCase()}: ${item.details}`);
            });
        } else {
            output.push('🟢 MONITOR: No immediate actions required');
        }
        output.push('');
        
        // Pattern Analysis
        output.push('PATTERN ANALYSIS & OPPORTUNITIES');
        output.push('═'.repeat(60));
        output.push(`QUALIFIED TICKERS FOR £${Math.round(userData.accountValue/1000)}K ACCOUNT:`);
        output.push('─'.repeat(40));
        output.push('Market Data Retrieved:');
        output.push('');
        
        // Display key market data
        const keyTickers = ['ES', 'SPY', 'VIX', 'TLT', 'MCL', 'MGC'];
        keyTickers.forEach(ticker => {
            if (marketData[ticker]) {
                const data = marketData[ticker];
                const change = ((data.currentPrice - data.previousClose) / data.previousClose * 100).toFixed(2);
                output.push(`${ticker}: $${data.currentPrice?.toFixed(2)} (${change}%)`);
                
                // Add context for specific tickers
                if (ticker === 'VIX') {
                    output.push(`  Regime: ${this.getVIXRegime(data.currentPrice)}`);
                }
                if (ticker === 'TLT' && data.ivRank) {
                    output.push(`  IV Rank: ${data.ivRank.toFixed(0)} ${data.ivRank > 30 ? '✓' : '✗'}`);
                }
            }
        });
        output.push('');
        
        // Strangle Opportunities (if Tuesday)
        if (userData.dayOfWeek === 'Tuesday') {
            output.push('STRANGLE OPPORTUNITIES:');
            this.addStrangleOpportunities(output, marketData, userData);
            output.push('');
        }
        
        // LT112 Opportunities (if Wednesday)
        if (userData.dayOfWeek === 'Wednesday') {
            output.push('LT112 OPPORTUNITIES:');
            this.addLT112Opportunities(output, marketData, userData);
            output.push('');
        }
        
        // 0DTE Opportunities (if Friday after 10:30)
        if (userData.dayOfWeek === 'Friday') {
            output.push('0DTE OPPORTUNITIES:');
            this.add0DTEOpportunities(output, marketData, userData);
            output.push('');
        }
        
        // Today's Execution Plan
        output.push(`TODAY'S EXECUTION PLAN - ${userData.dayOfWeek.toUpperCase()}`);
        output.push('═'.repeat(60));
        output.push('Available Strategies:');
        output.push('');
        
        const dayStrategies = this.getDayStrategies(userData.dayOfWeek);
        dayStrategies.forEach(strategy => {
            output.push(`${strategy.available ? '✅' : '❌'} ${strategy.name}: ${strategy.description}`);
        });
        output.push('');
        
        // BP Allocation from V14
        if (v14Analysis?.positionAllocation) {
            output.push('POSITION ALLOCATION TABLE');
            output.push('─'.repeat(40));
            output.push(this.formatAllocationTable(v14Analysis.positionAllocation));
            output.push('');
        }
        
        // Sustainability & Projections
        output.push('SUSTAINABILITY & PROJECTIONS');
        output.push('═'.repeat(60));
        output.push('MONTHLY PERFORMANCE TARGETS:');
        output.push('');
        output.push(`Conservative: £${(userData.accountValue * 0.06).toLocaleString()} (6%)`);
        output.push(`Realistic: £${(userData.accountValue * 0.08).toLocaleString()} (8%)`);
        output.push(`Optimal: £${(userData.accountValue * 0.12).toLocaleString()} (12%)`);
        output.push('');
        
        // Path to goal
        output.push('PATH TO £80K GOAL:');
        let projectedValue = userData.accountValue;
        for (let month = 1; month <= 8; month++) {
            projectedValue *= 1.08;
            output.push(`Month ${month}: £${Math.round(projectedValue).toLocaleString()}`);
            if (projectedValue >= 80000) {
                output.push(`🎯 Goal reached in Month ${month}!`);
                break;
            }
        }
        output.push('');
        
        // Risk & Concentration Check
        output.push('RISK & CONCENTRATION CHECK');
        output.push('═'.repeat(60));
        
        if (v14Analysis?.correlationGroups) {
            output.push('Correlation Groups Status:');
            Object.entries(v14Analysis.correlationGroups).forEach(([group, data]) => {
                const status = data.count >= 3 ? '⚠️ FULL' : '✅ Available';
                output.push(`${group}: ${data.count}/3 positions ${status}`);
            });
        } else {
            output.push('All correlation groups available (no positions)');
        }
        output.push('');
        
        // Critical Next Steps
        output.push('CRITICAL NEXT STEPS');
        output.push('─'.repeat(40));
        output.push('IMMEDIATE (Next 2 Hours):');
        output.push('');
        
        if (recommendations.actionItems && recommendations.actionItems.length > 0) {
            recommendations.actionItems.slice(0, 5).forEach((item, idx) => {
                output.push(`${idx + 1}. ${item.action}`);
                if (item.details) {
                    output.push(`   ${item.details}`);
                }
            });
        }
        output.push('');
        
        // Risk Warnings
        output.push('⚠️ RISK MANAGEMENT REMINDERS');
        output.push('─'.repeat(40));
        output.push(`• Never exceed ${this.getMaxBP(userData)}% BP in Phase ${userData.phase}`);
        output.push('• Max 3 positions per correlation group');
        output.push('• Exit all positions at 21 DTE or 50% profit');
        output.push('• 0DTE only on Friday after 10:30 AM');
        output.push('• Review August 2024 lesson (no excessive correlation)');
        output.push('');
        
        return output.join('\n');
    }

    /**
     * Generate HTML visualization
     */
    generateHTMLOutput(userData, marketData, recommendations, v14Analysis) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tom King Trading Dashboard - £${userData.accountValue.toLocaleString()}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
        }
        h1 {
            color: #667eea;
            font-size: 2.5em;
            margin: 0;
        }
        .subtitle {
            color: #666;
            font-size: 1.2em;
            margin-top: 10px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-radius: 15px;
            padding: 20px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        .card h3 {
            color: #667eea;
            margin-top: 0;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 5px 0;
            border-bottom: 1px solid rgba(0,0,0,0.1);
        }
        .metric-label {
            font-weight: 600;
            color: #555;
        }
        .metric-value {
            font-weight: bold;
            color: #333;
        }
        .alert {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: bold;
        }
        .success {
            background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
        }
        .warning {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #667eea;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background: rgba(102, 126, 234, 0.1);
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin: 20px 0;
        }
        .button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px 5px;
            transition: transform 0.2s;
        }
        .button:hover {
            transform: scale(1.05);
        }
        .position-box {
            background: white;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 15px;
            margin: 10px 0;
        }
        .ticker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 10px;
            margin: 20px 0;
        }
        .ticker-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 10px;
            border-radius: 8px;
            text-align: center;
        }
        .ticker-symbol {
            font-size: 1.2em;
            font-weight: bold;
        }
        .ticker-price {
            font-size: 0.9em;
            margin-top: 5px;
        }
        .progress-bar {
            width: 100%;
            height: 30px;
            background: #e0e0e0;
            border-radius: 15px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            transition: width 0.3s;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Tom King Trading Framework</h1>
            <div class="subtitle">
                ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                | £${userData.accountValue.toLocaleString()} Account | Phase ${userData.phase}
            </div>
        </div>

        ${this.generateVIXAlert(userData.vixLevel)}

        <div class="grid">
            <div class="card">
                <h3>📊 Account Status</h3>
                <div class="metric">
                    <span class="metric-label">Net Liquidation:</span>
                    <span class="metric-value">£${userData.accountValue.toLocaleString()}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">BP Used:</span>
                    <span class="metric-value">${userData.bpUsed}% / ${this.getMaxBP(userData)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Active Positions:</span>
                    <span class="metric-value">${userData.positions?.length || 0}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Month P&L:</span>
                    <span class="metric-value">£${(userData.monthPL || 0).toLocaleString()}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(100, (userData.bpUsed / this.getMaxBP(userData)) * 100)}%">
                        BP: ${userData.bpUsed}% / ${this.getMaxBP(userData)}%
                    </div>
                </div>
            </div>

            <div class="card">
                <h3>🎯 Today's Focus</h3>
                ${this.getTodaysFocus(userData, recommendations)}
            </div>

            <div class="card">
                <h3>📈 Market Conditions</h3>
                <div class="metric">
                    <span class="metric-label">VIX Level:</span>
                    <span class="metric-value">${userData.vixLevel?.toFixed(2)} (${this.getVIXRegime(userData.vixLevel).split(' - ')[0]})</span>
                </div>
                <div class="metric">
                    <span class="metric-label">ES Futures:</span>
                    <span class="metric-value">$${marketData.ES?.currentPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">SPY:</span>
                    <span class="metric-value">$${marketData.SPY?.currentPrice?.toFixed(2) || 'N/A'}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Market Status:</span>
                    <span class="metric-value">${this.getMarketStatus()}</span>
                </div>
            </div>
        </div>

        <div class="card">
            <h3>📊 Position Allocation Table</h3>
            ${this.generateAllocationTableHTML(v14Analysis?.positionAllocation, userData)}
        </div>

        <div class="card">
            <h3>🎯 Qualified Tickers</h3>
            <div class="ticker-grid">
                ${this.generateTickerCards(marketData, userData)}
            </div>
        </div>

        <div class="card">
            <h3>📈 Path to £80k Goal</h3>
            <canvas id="projectionChart"></canvas>
        </div>

        <div class="card">
            <h3>✅ Action Items</h3>
            ${this.generateActionItemsHTML(recommendations)}
        </div>

        <div class="card">
            <h3>⚠️ Risk Management</h3>
            ${this.generateRiskManagementHTML(v14Analysis, userData)}
        </div>

    </div>

    <script>
        // Projection Chart
        const ctx = document.getElementById('projectionChart').getContext('2d');
        const projectionData = ${this.generateProjectionData(userData)};
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: projectionData.labels,
                datasets: [{
                    label: 'Account Value Projection (8% Monthly)',
                    data: projectionData.values,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: '£80k Goal',
                    data: new Array(projectionData.labels.length).fill(80000),
                    borderColor: '#f5576c',
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
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '£' + (value/1000).toFixed(0) + 'k';
                            }
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
        
        return html;
    }

    // Helper methods
    getMaxBP(userData) {
        const vixBP = {
            LOW: 50,
            NORMAL: 70,
            ELEVATED: 80,
            HIGH: 60,
            CRISIS: 80
        };
        const regime = this.getVIXRegime(userData.vixLevel).split(' - ')[0];
        return vixBP[regime] || 65;
    }

    getVIXRegime(vixLevel) {
        if (vixLevel < 13) return 'LOW - Deploy 40-50% BP';
        if (vixLevel < 18) return 'NORMAL - Deploy 60-70% BP';
        if (vixLevel < 25) return 'ELEVATED - Deploy 75-80% BP';
        if (vixLevel < 30) return 'HIGH - Deploy 50-60% BP';
        return 'CRISIS - Deploy 80% BP into puts';
    }

    getDayOpportunity(day) {
        const opportunities = {
            'Monday': 'LEAP ENTRIES',
            'Tuesday': 'STRANGLE ENTRY DAY',
            'Wednesday': 'LT112 PRIMARY',
            'Thursday': 'MANAGEMENT ONLY',
            'Friday': '0DTE AFTER 10:30'
        };
        return opportunities[day] || 'MONITORING';
    }

    getPriorityIcon(priority) {
        return {
            'CRITICAL': '🚨',
            'HIGH': '⚡',
            'MEDIUM': '🟡',
            'LOW': '🟢'
        }[priority] || '📌';
    }

    getDayStrategies(day) {
        const allStrategies = {
            'Monday': [
                { name: 'LEAPs', available: true, description: 'Long-term positions' },
                { name: 'Management', available: true, description: 'Review existing positions' },
                { name: '0DTE', available: false, description: 'Friday only' }
            ],
            'Tuesday': [
                { name: 'Strangles', available: true, description: '2-3 positions maximum' },
                { name: 'Ratio Spreads', available: true, description: 'If volatility elevated' },
                { name: 'LT112', available: false, description: 'Wednesday entry' }
            ],
            'Wednesday': [
                { name: 'LT112', available: true, description: 'Primary entry day' },
                { name: 'MES Stacking', available: true, description: 'Add to positions' },
                { name: '0DTE', available: false, description: 'Friday only' }
            ],
            'Thursday': [
                { name: 'Management', available: true, description: 'Review for 21 DTE' },
                { name: 'New Entries', available: false, description: 'Not recommended' },
                { name: 'Planning', available: true, description: 'Prepare for Friday' }
            ],
            'Friday': [
                { name: '0DTE', available: true, description: 'After 10:30 AM only' },
                { name: 'IPMCC Rolls', available: true, description: 'Morning adjustments' },
                { name: 'Butterflies', available: true, description: 'Phase 3+ only' }
            ]
        };
        return allStrategies[day] || [];
    }

    addStrangleOpportunities(output, marketData, userData) {
        const strangleCandidates = ['TLT', 'GLD', 'SLV', 'MCL', 'MGC'];
        strangleCandidates.forEach(ticker => {
            if (marketData[ticker]) {
                const data = marketData[ticker];
                output.push(`🟢 ${ticker}:`);
                output.push(`  Current Price: $${data.currentPrice?.toFixed(2)}`);
                if (data.ivRank) {
                    output.push(`  IV Rank: ${data.ivRank.toFixed(0)} ${data.ivRank > 30 ? '✓' : '✗'}`);
                }
                output.push(`  Estimated BP: 2.5-3%`);
                output.push('');
            }
        });
    }

    addLT112Opportunities(output, marketData, userData) {
        const lt112Candidates = ['MES', 'MNQ'];
        lt112Candidates.forEach(ticker => {
            if (marketData[ticker]) {
                const data = marketData[ticker];
                output.push(`🟢 ${ticker}:`);
                output.push(`  Current Price: $${data.currentPrice?.toFixed(2)}`);
                output.push(`  120 DTE Target`);
                output.push(`  Estimated BP: 3%`);
                output.push('');
            }
        });
    }

    add0DTEOpportunities(output, marketData, userData) {
        const time = this.extractHour(userData.timeEST);
        if (time >= 10.5) {
            output.push('✅ Time window open (after 10:30 AM)');
            if (marketData.ES) {
                output.push(`ES Current: $${marketData.ES.currentPrice?.toFixed(2)}`);
                output.push('Max contracts: 2 (Phase 2)');
                output.push('Target: ATM strikes');
            }
        } else {
            output.push('⏰ Wait until 10:30 AM EST');
            output.push(`Current time: ${userData.timeEST}`);
        }
    }

    extractHour(timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
        if (match) {
            let hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            const ampm = match[3];
            if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
            if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
            return hour + (minute / 60);
        }
        return 10;
    }

    formatAllocationTable(allocation) {
        if (!allocation) return 'No allocation data available';
        
        let table = [];
        table.push('Strategy    | Max | Current | Avail | BP/Pos | BP Used');
        table.push('------------|-----|---------|-------|--------|--------');
        
        Object.entries(allocation).forEach(([strategy, data]) => {
            if (data.max) {
                table.push(
                    `${strategy.padEnd(11)} | ${String(data.max).padEnd(3)} | ` +
                    `${String(data.current).padEnd(7)} | ${String(data.available).padEnd(5)} | ` +
                    `${String(data.bpPerPosition).padEnd(6)}% | ${String(data.bpUsed).padEnd(6)}%`
                );
            }
        });
        
        return table.join('\n');
    }

    generateVIXAlert(vixLevel) {
        if (vixLevel > 30) {
            return `
                <div class="alert">
                    🚨 VIX SPIKE PROTOCOL ACTIVATED! VIX at ${vixLevel.toFixed(2)} - Deploy 80% BP into puts!
                </div>
            `;
        } else if (vixLevel > 25) {
            return `
                <div class="alert warning">
                    ⚠️ VIX ELEVATED at ${vixLevel.toFixed(2)} - Consider defensive positioning
                </div>
            `;
        }
        return '';
    }

    getTodaysFocus(userData, recommendations) {
        const dayFocus = {
            'Monday': '🎯 LEAP entries and position management',
            'Tuesday': '🎯 STRANGLE entry day - Deploy 2-3 positions',
            'Wednesday': '🎯 LT112 primary entry - MES positions',
            'Thursday': '🎯 Management day - Review 21 DTE positions',
            'Friday': '🎯 0DTE execution after 10:30 AM'
        };
        
        let html = `<div style="font-size: 1.1em; color: #667eea; font-weight: bold; margin-bottom: 15px;">
            ${dayFocus[userData.dayOfWeek] || '🎯 Monitor positions'}
        </div>`;
        
        if (recommendations.actionItems && recommendations.actionItems.length > 0) {
            html += '<div style="margin-top: 10px;">';
            recommendations.actionItems.slice(0, 2).forEach(item => {
                html += `<div style="margin: 5px 0;">• ${item.action}</div>`;
            });
            html += '</div>';
        }
        
        return html;
    }

    getMarketStatus() {
        const now = new Date();
        const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const day = nyTime.getDay();
        const hour = nyTime.getHours();
        const minute = nyTime.getMinutes();
        const time = hour * 100 + minute;
        
        if (day === 0 || day === 6) return 'Weekend';
        if (time >= 930 && time < 1600) return 'Market Open';
        if (time >= 400 && time < 930) return 'Pre-Market';
        if (time >= 1600 && time < 2000) return 'After-Hours';
        return 'Closed';
    }

    generateAllocationTableHTML(allocation, userData) {
        if (!allocation) return '<p>Generating allocation data...</p>';
        
        let html = '<table><thead><tr>';
        html += '<th>Strategy</th><th>Max</th><th>Current</th><th>Available</th>';
        html += '<th>BP/Position</th><th>BP Used</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        
        Object.entries(allocation).forEach(([strategy, data]) => {
            if (data.max) {
                const statusColor = data.current >= data.max ? '#f5576c' : 
                                   data.current > 0 ? '#ffa500' : '#84fab0';
                html += `<tr>
                    <td><strong>${strategy}</strong></td>
                    <td>${data.max}</td>
                    <td>${data.current}</td>
                    <td>${data.available}</td>
                    <td>${data.bpPerPosition}%</td>
                    <td>${data.bpUsed}%</td>
                    <td><span style="color: ${statusColor}">●</span> ${data.status}</td>
                </tr>`;
            }
        });
        
        html += '</tbody></table>';
        return html;
    }

    generateTickerCards(marketData, userData) {
        const phaseTickers = {
            1: ['MCL', 'MGC', 'GLD', 'TLT', 'SLV'],
            2: ['MCL', 'MGC', 'GLD', 'TLT', 'SLV', 'MES', 'MNQ', 'XOP'],
            3: ['ES', 'NQ', 'CL', 'GC', 'SPY', 'QQQ', 'IWM'],
            4: ['ES', 'NQ', 'CL', 'GC', 'SPY', 'QQQ', 'IWM', 'ZB', 'ZN']
        };
        
        const tickers = phaseTickers[userData.phase] || phaseTickers[1];
        let html = '';
        
        tickers.forEach(ticker => {
            const data = marketData[ticker];
            if (data) {
                const change = ((data.currentPrice - data.previousClose) / data.previousClose * 100).toFixed(2);
                const color = change >= 0 ? '#84fab0' : '#f5576c';
                html += `
                    <div class="ticker-card">
                        <div class="ticker-symbol">${ticker}</div>
                        <div class="ticker-price">$${data.currentPrice?.toFixed(2)}</div>
                        <div style="color: ${color}">${change}%</div>
                    </div>
                `;
            }
        });
        
        return html;
    }

    generateProjectionData(userData) {
        const months = [];
        const values = [];
        let currentValue = userData.accountValue;
        
        for (let i = 0; i <= 12; i++) {
            months.push(`Month ${i}`);
            values.push(currentValue);
            currentValue *= 1.08; // 8% monthly growth
        }
        
        return JSON.stringify({
            labels: months,
            values: values
        });
    }

    generateActionItemsHTML(recommendations) {
        if (!recommendations.actionItems || recommendations.actionItems.length === 0) {
            return '<p>No immediate actions required - monitor positions</p>';
        }
        
        let html = '<div>';
        recommendations.actionItems.forEach((item, idx) => {
            const icon = this.getPriorityIcon(item.priority);
            const bgColor = item.priority === 'CRITICAL' ? '#f5576c' :
                           item.priority === 'HIGH' ? '#ffa500' :
                           item.priority === 'MEDIUM' ? '#ffeb3b' : '#84fab0';
            
            html += `
                <div class="position-box" style="border-left: 5px solid ${bgColor}">
                    <strong>${icon} ${item.action}</strong><br>
                    ${item.details}<br>
                    ${item.reasoning ? `<em>Reason: ${item.reasoning}</em><br>` : ''}
                    ${item.bpRequired ? `BP Required: ${item.bpRequired}%` : ''}
                </div>
            `;
        });
        html += '</div>';
        
        return html;
    }

    generateRiskManagementHTML(v14Analysis, userData) {
        let html = '<div>';
        
        // Correlation groups
        if (v14Analysis?.correlationGroups) {
            html += '<h4>Correlation Groups:</h4>';
            html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
            
            Object.entries(v14Analysis.correlationGroups).forEach(([group, data]) => {
                const color = data.count >= 3 ? '#f5576c' : data.count > 0 ? '#ffa500' : '#84fab0';
                html += `
                    <div style="padding: 10px; border-radius: 5px; background: ${color}20; border: 2px solid ${color}">
                        <strong>${group}:</strong> ${data.count}/3 positions
                    </div>
                `;
            });
            html += '</div>';
        }
        
        // Risk rules
        html += '<h4 style="margin-top: 20px;">Critical Rules:</h4>';
        html += '<ul>';
        html += `<li>Maximum BP: ${this.getMaxBP(userData)}% for Phase ${userData.phase}</li>`;
        html += '<li>Max 3 positions per correlation group</li>';
        html += '<li>Exit at 21 DTE or 50% profit</li>';
        html += '<li>0DTE only Friday after 10:30 AM</li>';
        html += '<li>No excessive correlation (August 2024 lesson)</li>';
        html += '</ul>';
        
        html += '</div>';
        return html;
    }
}

module.exports = FrameworkOutputGenerator;