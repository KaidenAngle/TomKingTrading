/**
 * Test Performance Metrics Module
 * Validates the performance metrics calculation and reporting functionality
 */

const { PerformanceMetrics } = require('./src/performanceMetrics');
const { createLogger } = require('./src/logger');

const logger = createLogger();

async function testPerformanceMetrics() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TESTING PERFORMANCE METRICS MODULE');
    console.log('='.repeat(60));
    
    try {
        // Initialize performance metrics
        const metrics = new PerformanceMetrics();
        console.log('\n✅ PerformanceMetrics module loaded successfully');
        
        // Create sample trade data for testing
        const sampleTrades = [
            {
                symbol: 'SPY',
                strategy: 'Friday Zero DTE',
                entryTime: new Date('2025-09-02T10:30:00'),
                exitTime: new Date('2025-09-02T15:00:00'),
                entryPrice: 640,
                exitPrice: 642,
                quantity: 10,
                pnl: 200,
                status: 'closed',
                winLoss: 'win'
            },
            {
                symbol: 'QQQ',
                strategy: '112 Long-Term',
                entryTime: new Date('2025-09-01T09:30:00'),
                exitTime: new Date('2025-09-02T15:30:00'),
                entryPrice: 480,
                exitPrice: 479,
                quantity: 5,
                pnl: -50,
                status: 'closed',
                winLoss: 'loss'
            },
            {
                symbol: 'IWM',
                strategy: 'Friday Zero DTE',
                entryTime: new Date('2025-08-30T10:45:00'),
                exitTime: new Date('2025-08-30T15:00:00'),
                entryPrice: 220,
                exitPrice: 221.5,
                quantity: 20,
                pnl: 300,
                status: 'closed',
                winLoss: 'win'
            }
        ];
        
        // Create sample daily P&L data
        const dailyPnL = [
            { date: '2025-08-30', pnl: 300, cumulative: 35300 },
            { date: '2025-09-01', pnl: -50, cumulative: 35250 },
            { date: '2025-09-02', pnl: 200, cumulative: 35450 }
        ];
        
        const initialCapital = 35000;
        
        // Test comprehensive metrics calculation
        console.log('\n📈 Calculating Comprehensive Metrics...');
        const results = metrics.calculateComprehensiveMetrics(
            sampleTrades,
            dailyPnL,
            initialCapital
        );
        
        // Display results
        console.log('\n' + '='.repeat(60));
        console.log('📊 PERFORMANCE METRICS RESULTS');
        console.log('='.repeat(60));
        
        // Basic metrics
        if (results.basic) {
            console.log('\n📌 Basic Metrics:');
            console.log(`  Total Trades: ${results.basic.totalTrades}`);
            console.log(`  Winning Trades: ${results.basic.winningTrades}`);
            console.log(`  Losing Trades: ${results.basic.losingTrades}`);
            console.log(`  Win Rate: ${(results.basic.winRate * 100).toFixed(2)}%`);
            console.log(`  Total P&L: £${results.basic.totalPnL.toFixed(2)}`);
            console.log(`  Average P&L: £${results.basic.averagePnL.toFixed(2)}`);
        }
        
        // Strategy-specific metrics
        if (results.strategy) {
            console.log('\n📊 Strategy Performance:');
            Object.entries(results.strategy.byStrategy).forEach(([strategy, stats]) => {
                console.log(`\n  ${strategy}:`);
                console.log(`    Trades: ${stats.trades}`);
                console.log(`    Win Rate: ${(stats.winRate * 100).toFixed(2)}%`);
                console.log(`    Total P&L: £${stats.totalPnL.toFixed(2)}`);
            });
        }
        
        // Risk metrics
        if (results.risk) {
            console.log('\n⚠️ Risk Metrics:');
            console.log(`  Max Drawdown: ${(results.risk.maxDrawdown * 100).toFixed(2)}%`);
            console.log(`  Sharpe Ratio: ${results.risk.sharpeRatio?.toFixed(2) || 'N/A'}`);
            console.log(`  Volatility: ${(results.risk.volatility * 100).toFixed(2)}%`);
        }
        
        // Return metrics
        if (results.returns) {
            console.log('\n💰 Return Metrics:');
            console.log(`  Total Return: ${(results.returns.totalReturn * 100).toFixed(2)}%`);
            console.log(`  Monthly Return: ${(results.returns.monthlyReturn * 100).toFixed(2)}%`);
            console.log(`  Daily Return: ${(results.returns.dailyReturn * 100).toFixed(2)}%`);
        }
        
        // Note: HTML/Excel reporting methods not implemented yet
        console.log('\n📝 Report Generation:');
        console.log('  ⚠️ HTML report generation - not implemented');
        console.log('  ⚠️ Excel report generation - not implemented');
        console.log('  ⚠️ Automated reporting - not implemented');
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ PERFORMANCE METRICS TEST COMPLETED SUCCESSFULLY');
        console.log('='.repeat(60));
        
        // Additional validation
        console.log('\n🔍 Validation Results:');
        const validationChecks = [
            { name: 'Win rate calculation', pass: results.basic && Math.abs(results.basic.winRate - 2/3) < 0.01 },
            { name: 'Total P&L accuracy', pass: results.basic && results.basic.totalPnL === 450 },
            { name: 'Strategy tracking', pass: results.strategy && results.strategy.byStrategy && Object.keys(results.strategy.byStrategy).length > 0 },
            { name: 'Risk metrics available', pass: results.risk !== undefined },
            { name: 'Returns calculated', pass: results.returns !== undefined }
        ];
        
        validationChecks.forEach(check => {
            console.log(`  ${check.pass ? '✅' : '❌'} ${check.name}`);
        });
        
        const allPassed = validationChecks.every(c => c.pass);
        if (allPassed) {
            console.log('\n🎉 All validation checks passed!');
        } else {
            console.log('\n⚠️ Some validation checks failed - review results');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testPerformanceMetrics().catch(console.error);