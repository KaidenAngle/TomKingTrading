/**
 * Example Usage of Historical Data Loader
 * Demonstrates how to access the comprehensive 2023-2024 test dataset
 */

const { loader } = require('./src/historicalDataLoader');

async function demonstrateDataAccess() {
    console.log('🚀 Tom King Framework - Historical Data Access Demo\n');
    
    // 1. Get dataset overview
    console.log('📊 Dataset Statistics:');
    console.log('=====================');
    const stats = loader.getStats();
    console.log(`Period: ${stats.period}`);
    console.log(`Total Files: ${stats.totalFiles} (${stats.totalSizeMB}MB)`);
    console.log(`Asset Classes: ${Object.entries(stats.assetClasses).map(([k,v]) => `${k}=${v}`).join(', ')}`);
    console.log(`Available Symbols: ${stats.symbols.join(', ')}\n`);
    
    // 2. Load specific symbol data
    console.log('📈 Loading ES Futures Data:');
    console.log('===========================');
    const esData = loader.loadSymbol('ES');
    console.log(`Symbol: ${esData.symbol}`);
    console.log(`Total Bars: ${esData.totalBars}`);
    console.log(`Date Range: ${esData.startDate} to ${esData.endDate}`);
    console.log(`Sample Bar: ${JSON.stringify(esData.bars[0], null, 2)}\n`);
    
    // 3. Get August 2024 crash data
    console.log('⚡ August 2024 Crash Event:');
    console.log('==========================');
    const crashBars = loader.getMarketEvent('ES', 'august-crash');
    console.log(`Crash Period Bars: ${crashBars.length}`);
    crashBars.forEach(bar => {
        const dailyMove = ((bar.close - bar.open) / bar.open * 100).toFixed(2);
        console.log(`${bar.date}: ${bar.open.toFixed(0)} → ${bar.close.toFixed(0)} (${dailyMove}%)`);
    });
    
    // Get VIX during crash
    const vixCrash = loader.getMarketEvent('VIX', 'august-crash');
    console.log('\nVIX during crash:');
    vixCrash.forEach(bar => {
        console.log(`${bar.date}: VIX ${bar.close.toFixed(1)}`);
    });
    console.log();
    
    // 4. Friday 0DTE opportunities
    console.log('📅 Friday 0DTE Opportunities (SPY):');
    console.log('===================================');
    const fridays = loader.getFridays('SPY');
    console.log(`Total Fridays: ${fridays.length}`);
    
    // Show first 10 Fridays
    fridays.slice(0, 10).forEach(bar => {
        const dailyMove = ((bar.close - bar.open) / bar.open * 100).toFixed(2);
        console.log(`${bar.date}: ${bar.open.toFixed(2)} → ${bar.close.toFixed(2)} (${dailyMove}%)`);
    });
    console.log(`... and ${fridays.length - 10} more Fridays\n`);
    
    // 5. VIX regime analysis
    console.log('⚡ VIX Regime Analysis:');
    console.log('======================');
    const vixRegimes = loader.getVixRegimes();
    const regimeCounts = {};
    
    vixRegimes.forEach(day => {
        regimeCounts[day.regime] = (regimeCounts[day.regime] || 0) + 1;
    });
    
    Object.entries(regimeCounts).forEach(([regime, count]) => {
        const percent = (count / vixRegimes.length * 100).toFixed(1);
        console.log(`${regime}: ${count} days (${percent}%)`);
    });
    
    // Show extreme VIX days
    const extremeVix = vixRegimes.filter(day => day.vix >= 40).slice(0, 5);
    console.log('\nExtreme VIX Days (40+):');
    extremeVix.forEach(day => {
        console.log(`${day.date}: VIX ${day.vix.toFixed(1)} (${day.regime})`);
    });
    console.log();
    
    // 6. High IV opportunities for strangles
    console.log('🎯 High IV Strangle Opportunities:');
    console.log('==================================');
    const strangleSymbols = ['GLD', 'TLT', 'MCL', 'MGC'];
    
    for (const symbol of strangleSymbols) {
        const highIVBars = loader.getOptionsData(symbol, 60, 100); // IV rank 60%+
        console.log(`${symbol}: ${highIVBars.length} high IV days (IVR 60%+)`);
    }
    console.log();
    
    // 7. Major market events summary
    console.log('🎪 Major Market Events Coverage:');
    console.log('===============================');
    const events = ['svb-crisis', 'debt-ceiling', 'fall-correction', 'march-rally', 'august-crash', 'election-volatility'];
    
    for (const event of events) {
        try {
            const eventBars = loader.getMarketEvent('ES', event);
            const totalMove = eventBars.reduce((sum, bar) => 
                sum + Math.abs((bar.close - bar.open) / bar.open * 100), 0
            );
            console.log(`${event}: ${eventBars.length} days, ${totalMove.toFixed(1)}% total abs movement`);
        } catch (error) {
            console.log(`${event}: Error - ${error.message}`);
        }
    }
    console.log();
    
    // 8. Correlation example
    console.log('🔗 Asset Correlation Analysis:');
    console.log('==============================');
    const correlationData = loader.getCorrelationData(['ES', 'SPY', 'VIX'], '2024-08-01', '2024-08-31');
    
    console.log('August 2024 Daily Returns Sample:');
    const esReturns = correlationData.ES.slice(1, 6); // First 5 days with returns
    esReturns.forEach(day => {
        if (day.dailyReturn !== null) {
            const espyRet = correlationData.SPY.find(d => d.date === day.date)?.dailyReturn;
            const vixRet = correlationData.VIX.find(d => d.date === day.date)?.dailyReturn;
            console.log(`${day.date}: ES ${(day.dailyReturn*100).toFixed(2)}%, SPY ${(espyRet*100).toFixed(2)}%, VIX ${(vixRet*100).toFixed(2)}%`);
        }
    });
    
    console.log('\n🎉 Data access demonstration complete!');
    console.log('💡 This dataset provides comprehensive coverage for:');
    console.log('   ✅ All 10 Tom King strategies');
    console.log('   ✅ VIX regimes 12-65 (all 5 levels)');
    console.log('   ✅ Major market events and crashes');
    console.log('   ✅ 522 trading days of realistic data');
    console.log('   ✅ Proper correlations and volatility patterns');
    console.log('\n🚀 Ready for comprehensive framework testing!');
}

// Run demonstration
if (require.main === module) {
    demonstrateDataAccess().catch(console.error);
}

module.exports = demonstrateDataAccess;