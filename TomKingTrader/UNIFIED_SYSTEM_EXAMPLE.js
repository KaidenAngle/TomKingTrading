/**
 * UNIFIED TRADING SYSTEM USAGE EXAMPLE
 * Demonstrates how to use the same system for backtesting, paper trading, and live trading
 * 
 * CRITICAL BENEFIT: What you test is exactly what runs in production
 */

const { UnifiedTradingEngine } = require('./UNIFIED_TRADING_ENGINE');
const { BacktestingEngine } = require('./src/backtestingEngine');

/**
 * Example 1: Backtesting with Unified Engine
 */
async function runBacktestExample() {
    console.log('\n=== BACKTESTING WITH UNIFIED ENGINE ===');
    
    // Create backtest engine - uses unified system internally
    const backtester = new BacktestingEngine({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        initialCapital: 30000, // £30k Phase 1
        maxBPUsage: 0.35,      // 35% max buying power
        correlationLimit: 3     // Max 3 positions per correlation group
    });
    
    // Run full backtest - uses SAME logic as live trading
    const results = await backtester.runFullBacktest(['SPY', 'QQQ', 'IWM']);
    
    console.log('Backtest Results:');
    console.log(`Final Value: £${results.summary.totalValue.toFixed(2)}`);
    console.log(`Total Return: ${(results.statistics.totalReturn * 100).toFixed(2)}%`);
    console.log(`Win Rate: ${(results.statistics.winRate * 100).toFixed(2)}%`);
    console.log(`Total Trades: ${results.statistics.totalTrades}`);
    
    return results;
}

/**
 * Example 2: Paper Trading with Unified Engine
 */
async function runPaperTradingExample() {
    console.log('\n=== PAPER TRADING WITH UNIFIED ENGINE ===');
    
    // Create paper trading engine - SAME logic as backtest but with live data
    const paperEngine = new UnifiedTradingEngine('paper', {
        initialCapital: 30000,
        maxBPUsage: 0.35,
        correlationLimit: 3
    });
    
    // Example: Run single day of paper trading
    const today = new Date();
    const symbols = ['SPY', 'QQQ', 'IWM'];
    
    console.log('Running paper trading for today...');
    const dayResults = await paperEngine.runSinglePeriod(today, symbols);
    
    console.log('Paper Trading Results:');
    const portfolio = paperEngine.getPortfolioSummary();
    console.log(`Portfolio Value: £${portfolio.totalValue.toFixed(2)}`);
    console.log(`Cash: £${portfolio.cash.toFixed(2)}`);
    console.log(`Positions: ${portfolio.positionCount}`);
    console.log(`Unrealized P&L: £${portfolio.unrealizedPnL.toFixed(2)}`);
    
    return dayResults;
}

/**
 * Example 3: Live Trading with Unified Engine  
 */
async function runLiveTradingExample() {
    console.log('\n=== LIVE TRADING WITH UNIFIED ENGINE ===');
    console.log('⚠️  CAUTION: This would execute REAL trades!');
    
    // Create live trading engine - SAME logic as backtest/paper but with real execution
    const liveEngine = new UnifiedTradingEngine('live', {
        initialCapital: 30000,
        maxBPUsage: 0.35,
        correlationLimit: 3
    });
    
    // For safety, just show what would happen without executing
    console.log('Live engine created with same logic as backtest/paper.');
    console.log('Would use exact same:');
    console.log('- Pattern analysis logic');
    console.log('- Recommendation engine');
    console.log('- Risk management rules');
    console.log('- Position sizing calculations');
    console.log('- Entry/exit signals');
    console.log('');
    console.log('Only difference: Real order execution vs simulation');
    
    return liveEngine.getPortfolioSummary();
}

/**
 * Example 4: Strategy Comparison Across Modes
 */
async function compareStrategyAcrossModes() {
    console.log('\n=== STRATEGY COMPARISON ACROSS MODES ===');
    
    const testDate = new Date('2024-08-15'); // Example test date
    const symbol = 'SPY';
    
    // Same strategy logic in all three modes
    const modes = ['backtest', 'paper', 'live'];
    
    for (const mode of modes) {
        console.log(`\n--- ${mode.toUpperCase()} MODE ---`);
        
        const engine = new UnifiedTradingEngine(mode, {
            initialCapital: 30000,
            maxBPUsage: 0.35
        });
        
        try {
            // Get market data (historical for backtest, live for others)
            const marketData = await engine.getMarketData(symbol, mode === 'backtest' ? testDate : null);
            
            // Evaluate signals - SAME logic across all modes
            const signals = await engine.evaluateSignals(marketData, testDate);
            
            console.log(`Market Data Source: ${mode === 'backtest' ? 'Historical' : 'Live'}`);
            console.log(`Price: $${marketData.price?.toFixed(2) || 'N/A'}`);
            console.log(`Signals Generated: ${signals.recommendations?.length || 0}`);
            
            // Risk validation - SAME logic across all modes
            if (signals.recommendations && signals.recommendations.length > 0) {
                const signal = signals.recommendations[0];
                const riskCheck = await engine.validateTrade(signal, marketData);
                console.log(`Risk Check Passed: ${riskCheck.passed}`);
                console.log(`Risk Score: ${riskCheck.combinedScore?.toFixed(2) || 'N/A'}`);
            }
            
        } catch (error) {
            console.log(`Error in ${mode} mode:`, error.message);
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('UNIFIED TRADING SYSTEM DEMONSTRATION');
    console.log('====================================');
    console.log('');
    console.log('This example shows how the SAME code is used for:');
    console.log('1. Backtesting (historical data, simulated execution)');
    console.log('2. Paper Trading (live data, simulated execution)');
    console.log('3. Live Trading (live data, real execution)');
    console.log('');
    console.log('CRITICAL BENEFIT: Backtesting results will exactly match live trading behavior!');
    
    try {
        // Run examples
        await runBacktestExample();
        await runPaperTradingExample(); 
        // await runLiveTradingExample(); // Uncomment for live demo (CAUTION!)
        await compareStrategyAcrossModes();
        
        console.log('\n=== UNIFIED SYSTEM BENEFITS ===');
        console.log('✅ Single codebase for all trading modes');
        console.log('✅ Backtesting uses exact same logic as live trading');
        console.log('✅ No discrepancy between test and production results');
        console.log('✅ Same risk management across all modes');
        console.log('✅ Identical signal generation logic');
        console.log('✅ Consistent position sizing and correlation limits');
        console.log('✅ Single source of truth for strategy implementation');
        
    } catch (error) {
        console.error('Example failed:', error);
    }
}

// Export for use in other modules
module.exports = {
    runBacktestExample,
    runPaperTradingExample,
    runLiveTradingExample,
    compareStrategyAcrossModes,
    main
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}