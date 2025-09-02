/**
 * FINAL PRODUCTION BACKTEST
 * 
 * Complete backtest using the existing proven components
 * to validate £35k → £80k goal with Tom King strategies
 */

const BacktestingEngine = require('./src/backtestingEngine');
const fs = require('fs').promises;
const path = require('path');

async function runFinalBacktest() {
    console.log('='.repeat(80));
    console.log('💎 FINAL PRODUCTION BACKTEST - TOM KING TRADING FRAMEWORK');
    console.log('='.repeat(80));
    console.log('Goal: Transform £35,000 → £80,000 in 8 months');
    console.log('Required: 11.25% monthly return');
    console.log('Tom King Proven: 12.5% monthly average');
    console.log('-'.repeat(80));
    
    // Use the existing backtesting engine with our improvements
    const backtest = new BacktestingEngine({
        startDate: '2023-01-01',
        endDate: '2024-12-31',
        initialCapital: 35000,  // £35k starting capital
        commissions: 1.17,       // Realistic commission
        slippage: 0.02,          // 2% slippage
        maxPositions: 20,
        correlationLimit: 3,     // Tom King rule
        maxBPUsage: 35          // 35% max buying power
    });
    
    // Core symbols for testing
    const symbols = ['SPY', 'QQQ', 'IWM', 'ES', 'MES', 'GLD', 'TLT'];
    
    console.log(`\n📊 Test Parameters:`);
    console.log(`  Period: 2023-2024 (2 years)`);
    console.log(`  Symbols: ${symbols.join(', ')}`);
    console.log(`  Starting Capital: £35,000`);
    console.log(`  Max BP Usage: 35%`);
    console.log(`  Correlation Limit: 3 per group`);
    
    const results = {
        byStrategy: {},
        overall: {
            trades: [],
            totalPnL: 0,
            winCount: 0,
            lossCount: 0
        }
    };
    
    // Test each strategy
    console.log('\n🔄 Running Strategy Backtests...\n');
    
    // 1. 0DTE Strategy (Fridays only)
    console.log('📈 Testing 0DTE Strategy...');
    const zdteResults = await backtest.runStrategyBacktest('0DTE', symbols);
    results.byStrategy['0DTE'] = zdteResults;
    console.log(`  ✅ Completed: ${zdteResults.trades?.length || 0} trades`);
    
    // 2. LT112 Strategy (Monthly)
    console.log('📈 Testing LT112 Strategy...');
    const lt112Results = await backtest.runStrategyBacktest('LT112', symbols);
    results.byStrategy['LT112'] = lt112Results;
    console.log(`  ✅ Completed: ${lt112Results.trades?.length || 0} trades`);
    
    // 3. Strangles (Monthly)
    console.log('📈 Testing STRANGLE Strategy...');
    const strangleResults = await backtest.runStrategyBacktest('STRANGLE', symbols);
    results.byStrategy['STRANGLE'] = strangleResults;
    console.log(`  ✅ Completed: ${strangleResults.trades?.length || 0} trades`);
    
    // 4. IPMCC (Weekly)
    console.log('📈 Testing IPMCC Strategy...');
    const ipmccResults = await backtest.runStrategyBacktest('IPMCC', symbols);
    results.byStrategy['IPMCC'] = ipmccResults;
    console.log(`  ✅ Completed: ${ipmccResults.trades?.length || 0} trades`);
    
    // 5. LEAP Puts (Weekly)
    console.log('📈 Testing LEAP Strategy...');
    const leapResults = await backtest.runStrategyBacktest('LEAP', symbols);
    results.byStrategy['LEAP'] = leapResults;
    console.log(`  ✅ Completed: ${leapResults.trades?.length || 0} trades`);
    
    // Aggregate results
    for (const [strategy, stratResults] of Object.entries(results.byStrategy)) {
        if (stratResults.trades) {
            results.overall.trades.push(...stratResults.trades);
        }
        results.overall.totalPnL += stratResults.totalPnL || 0;
        results.overall.winCount += stratResults.winningTrades || 0;
        results.overall.lossCount += stratResults.losingTrades || 0;
    }
    
    // Calculate metrics
    const totalTrades = results.overall.trades.length;
    const winRate = totalTrades > 0 ? (results.overall.winCount / totalTrades) * 100 : 0;
    const finalCapital = 35000 + results.overall.totalPnL;
    const totalReturn = ((finalCapital - 35000) / 35000) * 100;
    const monthlyReturn = totalReturn / 24; // 24 months
    const eightMonthProjection = 35000 * Math.pow(1 + monthlyReturn/100, 8);
    
    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 BACKTEST RESULTS SUMMARY');
    console.log('='.repeat(80));
    
    console.log('\n💰 FINANCIAL PERFORMANCE:');
    console.log(`  Starting Capital: £35,000`);
    console.log(`  Final Capital: £${finalCapital.toFixed(2)}`);
    console.log(`  Total P&L: £${results.overall.totalPnL.toFixed(2)}`);
    console.log(`  Total Return: ${totalReturn.toFixed(2)}%`);
    console.log(`  Monthly Average: ${monthlyReturn.toFixed(2)}%`);
    console.log(`  8-Month Projection: £${eightMonthProjection.toFixed(0)}`);
    
    console.log('\n📈 TRADING STATISTICS:');
    console.log(`  Total Trades: ${totalTrades}`);
    console.log(`  Winning Trades: ${results.overall.winCount}`);
    console.log(`  Losing Trades: ${results.overall.lossCount}`);
    console.log(`  Win Rate: ${winRate.toFixed(1)}%`);
    
    console.log('\n📊 STRATEGY BREAKDOWN:');
    for (const [strategy, stratResults] of Object.entries(results.byStrategy)) {
        const trades = stratResults.trades?.length || 0;
        const pnl = stratResults.totalPnL || 0;
        const stratWinRate = trades > 0 ? 
            ((stratResults.winningTrades || 0) / trades * 100) : 0;
        
        console.log(`\n  ${strategy}:`);
        console.log(`    Trades: ${trades}`);
        console.log(`    P&L: £${pnl.toFixed(2)}`);
        console.log(`    Win Rate: ${stratWinRate.toFixed(1)}%`);
        console.log(`    Avg per Trade: £${trades > 0 ? (pnl/trades).toFixed(2) : '0.00'}`);
    }
    
    console.log('\n🎯 GOAL VALIDATION:');
    console.log(`  Target: £80,000 in 8 months`);
    console.log(`  Projected: £${eightMonthProjection.toFixed(0)}`);
    console.log(`  Status: ${eightMonthProjection >= 80000 ? '✅ ACHIEVABLE!' : '⚠️ Needs Optimization'}`);
    
    // Recommendations based on results
    console.log('\n💡 ANALYSIS & RECOMMENDATIONS:');
    
    if (monthlyReturn < 11.25) {
        console.log('  ⚠️ Monthly return below 11.25% target');
        console.log('  Actions needed:');
        console.log('    - Review entry signal thresholds');
        console.log('    - Ensure all strategies are generating trades');
        console.log('    - Check VIX filters aren\'t too restrictive');
        console.log('    - Consider position sizing optimization');
    } else {
        console.log('  ✅ Performance meets monthly return target!');
        console.log('  Ready to proceed with paper trading');
    }
    
    if (winRate < 70) {
        console.log('  ⚠️ Win rate below Tom King\'s 75% target');
        console.log('  Consider:');
        console.log('    - Tightening entry criteria');
        console.log('    - Better market regime filtering');
        console.log('    - Improved exit timing');
    }
    
    if (totalTrades < 100) {
        console.log('  ⚠️ Low trade volume (should be 150+ per year)');
        console.log('  Check:');
        console.log('    - Day-of-week scheduling is correct');
        console.log('    - Entry thresholds aren\'t too strict');
        console.log('    - All strategies are active');
    }
    
    // Save report
    const reportPath = path.join(__dirname, 'reports', `final_backtest_${Date.now()}.json`);
    await fs.mkdir(path.join(__dirname, 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify({
        summary: {
            initialCapital: 35000,
            finalCapital,
            totalReturn,
            monthlyReturn,
            eightMonthProjection,
            goalAchievable: eightMonthProjection >= 80000
        },
        statistics: {
            totalTrades,
            winRate,
            totalPnL: results.overall.totalPnL
        },
        strategies: results.byStrategy,
        timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n📁 Report saved: ${reportPath}`);
    
    // Next steps
    console.log('\n' + '='.repeat(80));
    console.log('🚀 NEXT STEPS FOR PRODUCTION');
    console.log('='.repeat(80));
    
    if (eightMonthProjection >= 80000 && winRate >= 70) {
        console.log('\n✅ SYSTEM VALIDATED - Ready for Production!');
        console.log('\n1. START PAPER TRADING (1-2 weeks):');
        console.log('   node paperTrade.js --symbols SPY,QQQ --duration 7d');
        console.log('\n2. BEGIN LIVE TRADING (small size):');
        console.log('   - Start with 1 contract per strategy');
        console.log('   - Monitor for 1 week');
        console.log('   - Scale up gradually');
        console.log('\n3. FULL DEPLOYMENT (target size):');
        console.log('   - Scale to target position sizes');
        console.log('   - Monitor daily P&L');
        console.log('   - Adjust as needed');
    } else {
        console.log('\n⚠️ OPTIMIZATION NEEDED');
        console.log('Review and adjust:');
        console.log('  1. Entry signal generation');
        console.log('  2. Position sizing');
        console.log('  3. Exit timing');
        console.log('  4. Risk parameters');
    }
    
    return results;
}

// Run the backtest
if (require.main === module) {
    runFinalBacktest()
        .then(results => {
            console.log('\n✅ Backtest complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = runFinalBacktest;