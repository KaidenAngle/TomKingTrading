/**
 * RUN PROFESSIONAL BACKTEST
 * 
 * Execute comprehensive 2-year backtest using the new professional engine
 * with minute-level data for 0DTE and realistic market simulation.
 * 
 * Goal: Validate £35k → £80k in 8 months is achievable
 */

const IntegratedTradingSystem = require('./INTEGRATED_TRADING_SYSTEM');
const fs = require('fs').promises;
const path = require('path');

async function runProfessionalBacktest() {
    console.log('='.repeat(80));
    console.log('🚀 PROFESSIONAL 2-YEAR BACKTEST - TOM KING TRADING FRAMEWORK');
    console.log('='.repeat(80));
    console.log('Goal: £35,000 → £80,000 in 8 months');
    console.log('Required Monthly Return: 11.25%');
    console.log('Tom King Historical Performance: 12.5% monthly average');
    console.log('-'.repeat(80));
    
    // Initialize the professional backtesting engine
    const backtest = new IntegratedTradingSystem({
        mode: 'backtest',
        dataResolution: '1min',  // Minute-level for 0DTE accuracy
        slippage: 0.05,          // 5 cents realistic slippage
        commission: 1.17,         // $1.17 per round trip
        bidAskSpread: 0.10       // 10 cents typical spread
    });
    
    // Tom King's core symbols
    const symbols = [
        // Indices (primary for 0DTE)
        'SPY', 'QQQ', 'IWM',
        // Futures for diversification
        'ES', 'NQ', 'MES', 'MNQ',
        // Commodities
        'GLD', 'SLV', 'MCL', 'MGC',
        // Bonds
        'TLT', 'HYG'
    ];
    
    // Run 2-year backtest (2023-2024)
    const startDate = '2023-01-01';
    const endDate = '2024-12-31';
    
    console.log(`\n📊 Backtesting Period: ${startDate} to ${endDate}`);
    console.log(`📈 Symbols: ${symbols.join(', ')}`);
    console.log(`⚙️ Data Resolution: 1-minute bars (390 per trading day)`);
    console.log(`💰 Initial Capital: £35,000`);
    console.log();
    
    try {
        console.log('🔄 Running backtest with professional engine...');
        console.log('  - Minute-level data for 0DTE Fridays');
        console.log('  - Realistic option pricing with Greeks');
        console.log('  - Market microstructure simulation');
        console.log('  - Tom King exact methodology');
        console.log();
        
        const results = await backtest.execute(symbols, startDate, endDate);
        
        // Calculate performance metrics
        const initialCapital = 35000;
        const finalCapital = initialCapital + (results.metrics?.totalPnL || 0);
        const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
        const monthlyReturn = totalReturn / 24; // 24 months
        const projectedEightMonths = initialCapital * Math.pow(1 + monthlyReturn/100, 8);
        
        console.log('='.repeat(80));
        console.log('📊 BACKTEST RESULTS');
        console.log('='.repeat(80));
        
        console.log('\n💼 PERFORMANCE SUMMARY:');
        console.log(`  Initial Capital: £${initialCapital.toLocaleString()}`);
        console.log(`  Final Capital: £${finalCapital.toLocaleString()}`);
        console.log(`  Total Return: ${totalReturn.toFixed(2)}%`);
        console.log(`  Monthly Average: ${monthlyReturn.toFixed(2)}%`);
        console.log(`  Annualized Return: ${(totalReturn/2).toFixed(2)}%`);
        
        console.log('\n📈 TRADING STATISTICS:');
        console.log(`  Total Trades: ${results.metrics?.totalTrades || 0}`);
        console.log(`  Win Rate: ${((results.metrics?.winRate || 0) * 100).toFixed(1)}%`);
        console.log(`  Profit Factor: ${(results.metrics?.profitFactor || 0).toFixed(2)}`);
        console.log(`  Sharpe Ratio: ${(results.metrics?.sharpeRatio || 0).toFixed(2)}`);
        console.log(`  Max Drawdown: ${((results.metrics?.maxDrawdown || 0) * 100).toFixed(1)}%`);
        console.log(`  Average Win: £${(results.metrics?.avgWin || 0).toFixed(2)}`);
        console.log(`  Average Loss: £${(results.metrics?.avgLoss || 0).toFixed(2)}`);
        
        console.log('\n🎯 GOAL VALIDATION:');
        console.log(`  8-Month Projection: £${projectedEightMonths.toFixed(0)}`);
        console.log(`  Target: £80,000`);
        console.log(`  Goal Achievement: ${projectedEightMonths >= 80000 ? '✅ ACHIEVABLE' : '❌ NEEDS ADJUSTMENT'}`);
        
        // Strategy breakdown
        if (results.trades && results.trades.length > 0) {
            console.log('\n📊 STRATEGY BREAKDOWN:');
            const strategyStats = {};
            
            for (const trade of results.trades) {
                const strategy = trade.strategy || 'Unknown';
                if (!strategyStats[strategy]) {
                    strategyStats[strategy] = {
                        count: 0,
                        wins: 0,
                        totalPnL: 0,
                        avgPnL: 0
                    };
                }
                strategyStats[strategy].count++;
                if (trade.pnl > 0) strategyStats[strategy].wins++;
                strategyStats[strategy].totalPnL += trade.pnl || 0;
            }
            
            for (const [strategy, stats] of Object.entries(strategyStats)) {
                stats.avgPnL = stats.totalPnL / stats.count;
                const winRate = (stats.wins / stats.count * 100).toFixed(1);
                console.log(`  ${strategy}:`);
                console.log(`    - Trades: ${stats.count}`);
                console.log(`    - Win Rate: ${winRate}%`);
                console.log(`    - Total P&L: £${stats.totalPnL.toFixed(2)}`);
                console.log(`    - Avg P&L: £${stats.avgPnL.toFixed(2)}`);
            }
        }
        
        // Save detailed results
        const reportPath = path.join(__dirname, 'reports', `professional_backtest_${Date.now()}.json`);
        await fs.mkdir(path.join(__dirname, 'reports'), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify({
            config: {
                startDate,
                endDate,
                symbols,
                initialCapital,
                dataResolution: '1min'
            },
            results,
            summary: {
                finalCapital,
                totalReturn,
                monthlyReturn,
                projectedEightMonths,
                goalAchievable: projectedEightMonths >= 80000
            },
            timestamp: new Date().toISOString()
        }, null, 2));
        
        console.log(`\n📁 Detailed report saved: ${reportPath}`);
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (monthlyReturn < 11.25) {
            console.log('  ⚠️ Monthly return below target 11.25%');
            console.log('  Consider:');
            console.log('    - Increasing position sizes within risk limits');
            console.log('    - Adding more Friday 0DTE contracts');
            console.log('    - Optimizing entry timing for better fills');
        } else {
            console.log('  ✅ Performance exceeds required monthly return!');
            console.log('  Ready for paper trading validation');
        }
        
        if (results.metrics?.maxDrawdown > 0.15) {
            console.log('  ⚠️ Max drawdown exceeds 15% limit');
            console.log('  Consider:');
            console.log('    - Tightening stop losses');
            console.log('    - Reducing position sizes during high VIX');
            console.log('    - Better correlation management');
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ PROFESSIONAL BACKTEST COMPLETE');
        console.log('='.repeat(80));
        
        return results;
        
    } catch (error) {
        console.error('❌ Backtest error:', error.message);
        console.error(error.stack);
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    runProfessionalBacktest()
        .then(() => {
            console.log('\n🎯 Next Steps:');
            console.log('1. Review detailed results in reports folder');
            console.log('2. If performance meets targets, proceed to paper trading');
            console.log('3. Run 30-day paper trading validation');
            console.log('4. Deploy to production with small position sizes');
            console.log('5. Scale up as confidence builds');
            process.exit(0);
        })
        .catch(err => {
            console.error('\n❌ Fatal error:', err);
            process.exit(1);
        });
}

module.exports = runProfessionalBacktest;