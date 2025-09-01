#!/usr/bin/env node

/**
 * TOM KING TEXT-BASED PATTERN ANALYSIS v17
 * Replicates the original v14 text-based analysis format
 * Generates detailed strike recommendations and trading signals
 */

const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');

// Simulated market data for testing
const mockMarketData = {
    accountValue: 45000,
    phase: 2,
    bpUsed: 28,
    dayOfWeek: 'Friday',
    timeEST: '11:30 AM',
    vixLevel: 16.5,
    positions: [
        { ticker: 'MES', strategy: 'STRANGLE', dte: 45, pl: 15, entry: '2024-01-15' },
        { ticker: 'GLD', strategy: 'LT112', dte: 112, pl: 8, entry: '2024-01-10' }
    ]
};

// Ticker data to analyze
const tickersToAnalyze = ['ES', 'MES', 'GLD', 'TLT', 'MCL'];

class TextAnalyzer {
    constructor() {
        this.engine = new EnhancedRecommendationEngine();
    }

    async run() {
        console.log('================================================================================');
        console.log('                 TOM KING TRADING FRAMEWORK v17 - TEXT ANALYSIS                ');
        console.log('================================================================================\n');
        
        // Initialize engine
        await this.engine.initialize(false); // Use simulated data
        
        // Print account overview
        this.printAccountOverview(mockMarketData);
        
        // Run comprehensive analysis
        console.log('\n📊 RUNNING COMPREHENSIVE PATTERN ANALYSIS...\n');
        const recommendations = await this.engine.generateEnhancedRecommendations(
            mockMarketData,
            true,  // Include Greeks
            true   // Include Patterns
        );
        
        // Display results in text format
        this.displayTextResults(recommendations, mockMarketData);
    }

    printAccountOverview(userData) {
        console.log('📈 ACCOUNT STATUS');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        console.log(`Account Value:    £${userData.accountValue.toLocaleString()}`);
        console.log(`Phase:            ${userData.phase} (${this.getPhaseDescription(userData.phase)})`);
        console.log(`BP Used:          ${userData.bpUsed}% / 65% max`);
        console.log(`VIX Level:        ${userData.vixLevel} (${this.getVIXRegimeDescription(userData.vixLevel)})`);
        console.log(`Day/Time:         ${userData.dayOfWeek} ${userData.timeEST}`);
        console.log(`Current Positions: ${userData.positions.length}`);
        console.log('─────────────────────────────────────────────────────────────────────────────');
        
        if (userData.positions.length > 0) {
            console.log('\n📋 CURRENT POSITIONS:');
            userData.positions.forEach(pos => {
                const status = this.getPositionStatus(pos);
                console.log(`  • ${pos.ticker} ${pos.strategy}: ${pos.dte} DTE, P/L: ${pos.pl >= 0 ? '+' : ''}${pos.pl}% ${status}`);
            });
        }
    }

    displayTextResults(recommendations, userData) {
        console.log('\n\n================================================================================');
        console.log('                            PATTERN ANALYSIS RESULTS                           ');
        console.log('================================================================================\n');

        // Risk Analysis
        console.log('⚠️  RISK ANALYSIS');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        const risk = recommendations.riskAnalysis;
        console.log(`Overall Risk Level: ${risk.riskLevel}`);
        console.log(`BP Utilization:     ${risk.bpUtilization}% / 65% max`);
        
        if (risk.correlationRisk.violations.length > 0) {
            console.log('\n🚨 CRITICAL WARNINGS:');
            risk.correlationRisk.violations.forEach(v => {
                console.log(`  ❌ ${v.message}`);
            });
        }
        
        console.log('\nCorrelation Groups:');
        Object.entries(risk.correlationRisk.groups).forEach(([group, count]) => {
            const status = count >= 3 ? '⚠️ MAX' : count >= 2 ? '📊' : '✅';
            console.log(`  ${status} ${group}: ${count}/3 positions`);
        });

        // Pattern Opportunities
        console.log('\n\n📈 PATTERN-BASED OPPORTUNITIES');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        
        if (Object.keys(recommendations.patternAnalysis).length === 0) {
            console.log('No immediate pattern opportunities detected.');
        } else {
            Object.entries(recommendations.patternAnalysis).forEach(([ticker, patterns]) => {
                console.log(`\n${ticker} (${patterns.correlationGroup})`);
                console.log(`  Priority Score: ${patterns.priority}`);
                console.log(`  Confidence:     ${patterns.confidence.toFixed(0)}%`);
                console.log(`  Max BP:         ${patterns.maxBPAllocation}%`);
                
                if (patterns.signals.length > 0) {
                    console.log('  Signals:');
                    patterns.signals.forEach(signal => {
                        console.log(`    • ${signal.type}: ${signal.message}`);
                        console.log(`      Strategy: ${signal.strategy} (${signal.confidence}% confidence)`);
                    });
                }
                
                if (patterns.preferredStrategy) {
                    console.log(`  📌 Recommended: ${patterns.preferredStrategy}`);
                }
            });
        }

        // Strike Recommendations
        console.log('\n\n🎯 STRIKE RECOMMENDATIONS WITH GREEKS');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        
        Object.entries(recommendations.strikeRecommendations).forEach(([ticker, strikeData]) => {
            console.log(`\n${ticker}`);
            console.log(`  Diversification Score: ${strikeData.diversificationScore}/100`);
            console.log(`  Risk-Adjusted Score:   ${strikeData.riskAdjustedOpportunity.toFixed(0)}`);
            
            strikeData.recommendations.forEach(rec => {
                if (rec.viable) {
                    console.log(`\n  📊 ${rec.strategy}:`);
                    
                    if (rec.strategy === 'Short Strangle') {
                        console.log(`     Put Strike:  ${rec.putStrike}`);
                        console.log(`     Call Strike: ${rec.callStrike}`);
                        console.log(`     Net Credit:  £${rec.netCredit.toFixed(2)}`);
                    } else if (rec.strategy === 'Iron Condor') {
                        console.log(`     Strikes:     ${rec.strikes.putLong}/${rec.strikes.putShort}/${rec.strikes.callShort}/${rec.strikes.callLong}`);
                        console.log(`     Net Credit:  £${rec.netCredit.toFixed(2)}`);
                    } else if (rec.strategy === '0DTE') {
                        console.log(`     Direction:   ${rec.direction}`);
                        console.log(`     Strikes:     ${rec.strikes.short}/${rec.strikes.long}`);
                        console.log(`     Target:      £${rec.targetCredit.toFixed(2)}`);
                    }
                    
                    if (rec.greeksImpact) {
                        console.log(`     Greeks:      Δ=${rec.greeksImpact.delta?.toFixed(3) || '0'} ` +
                                   `Γ=${rec.greeksImpact.gamma?.toFixed(3) || '0'} ` +
                                   `Θ=${rec.greeksImpact.theta?.toFixed(3) || '0'} ` +
                                   `ν=${rec.greeksImpact.vega?.toFixed(3) || '0'}`);
                    }
                    console.log(`     Confidence:  ${rec.confidence.toFixed(0)}%`);
                }
            });
        });

        // Action Items
        console.log('\n\n✅ RECOMMENDED ACTIONS');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        
        if (recommendations.actionItems.length === 0) {
            console.log('No immediate actions required.');
        } else {
            recommendations.actionItems.forEach((item, index) => {
                const priorityIcon = {
                    'CRITICAL': '🚨',
                    'HIGH': '⚡',
                    'MEDIUM': '📊',
                    'LOW': '💡'
                }[item.priority];
                
                console.log(`\n${index + 1}. ${priorityIcon} [${item.priority}] ${item.action}`);
                console.log(`   ${item.details}`);
                console.log(`   Reason: ${item.reasoning}`);
                
                if (item.bpRequired) {
                    console.log(`   BP Required: ${item.bpRequired}%`);
                }
                
                if (item.greeksImpact) {
                    console.log(`   Greeks Impact: Δ=${item.greeksImpact.delta?.toFixed(3) || '0'} ` +
                               `Θ=${item.greeksImpact.theta?.toFixed(3) || '0'} ` +
                               `ν=${item.greeksImpact.vega?.toFixed(3) || '0'}`);
                }
            });
        }

        // Portfolio Optimization
        console.log('\n\n🎨 PORTFOLIO OPTIMIZATION');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        const opt = recommendations.portfolioOptimization;
        console.log(`Max Positions Allowed: ${opt.maxPositions}`);
        console.log(`Current Greeks Profile:`);
        console.log(`  Delta: ${opt.currentPortfolioGreeks.delta?.toFixed(3) || '0'}`);
        console.log(`  Gamma: ${opt.currentPortfolioGreeks.gamma?.toFixed(3) || '0'}`);
        console.log(`  Theta: ${opt.currentPortfolioGreeks.theta?.toFixed(3) || '0'} (${opt.currentPortfolioGreeks.theta > 0 ? 'Positive ✅' : 'Negative ⚠️'})`);
        console.log(`  Vega:  ${opt.currentPortfolioGreeks.vega?.toFixed(3) || '0'}`);
        
        if (opt.diversificationImprovements.length > 0) {
            console.log('\nDiversification Improvements:');
            opt.diversificationImprovements.forEach(imp => {
                console.log(`  • ${imp.message}`);
            });
        }

        // Summary
        console.log('\n\n================================================================================');
        console.log('                                    SUMMARY                                    ');
        console.log('================================================================================');
        console.log(`Analysis Phase:     ${recommendations.summary.accountPhase}`);
        console.log(`Qualified Tickers:  ${recommendations.summary.qualifiedTickersCount}`);
        console.log(`Pattern Signals:    ${recommendations.summary.patternOpportunities}`);
        console.log(`Strike Options:     ${recommendations.summary.strikeRecommendations}`);
        console.log(`Execution Time:     ${recommendations.summary.executionTime}ms`);
        console.log(`Generated At:       ${new Date(recommendations.summary.generatedAt).toLocaleString()}`);
        
        // Special notes
        console.log('\n📝 NOTES:');
        if (userData.dayOfWeek === 'Friday' && this.extractHour(userData.timeEST) >= 10.5) {
            console.log('  ✅ Friday 0DTE window is OPEN (after 10:30 AM)');
        }
        if (userData.vixLevel >= 20) {
            console.log('  ✅ High VIX environment - Premium collection favored');
        }
        if (userData.bpUsed < 30) {
            console.log('  ✅ Low BP usage - Room for new positions');
        }
        
        console.log('\n================================================================================\n');
    }

    getPhaseDescription(phase) {
        const descriptions = {
            1: '£30-40k Foundation',
            2: '£40-60k Growth',
            3: '£60-75k Advanced',
            4: '£75k+ Professional'
        };
        return descriptions[phase] || 'Unknown';
    }

    getVIXRegimeDescription(vixLevel) {
        if (vixLevel < 12) return 'Extreme Low';
        if (vixLevel < 16) return 'Low';
        if (vixLevel < 20) return 'Normal';
        if (vixLevel < 30) return 'High';
        return 'Extreme High';
    }

    getPositionStatus(pos) {
        if (pos.dte <= 21 && pos.pl < 50) return '⚠️ 21 DTE RULE';
        if (pos.pl >= 50) return '✅ PROFIT TARGET';
        if (pos.pl >= 25) return '📈 Profitable';
        if (pos.pl >= -10) return '📊 Small Loss';
        return '📉 Monitor';
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
}

// Run the analysis
async function main() {
    const analyzer = new TextAnalyzer();
    
    try {
        await analyzer.run();
        
        console.log('\n💡 To run with different parameters, edit the mockMarketData object in this file.');
        console.log('📊 To use real API data, set initialize(true) in the run() method.\n');
        
    } catch (error) {
        console.error('\n❌ Analysis Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Execute if run directly
if (require.main === module) {
    main();
}

module.exports = TextAnalyzer;