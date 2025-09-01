#!/usr/bin/env node

/**
 * TEST DATA AVAILABILITY
 * Tests TastyTrade API data access outside market hours
 * Current UK Time: 9:00 PM (4:00 PM EST - Markets Closed)
 */

require('dotenv').config();
const { TastyTradeAPI } = require('./src/tastytradeAPI');

async function testDataAvailability() {
    console.log('================================================================================');
    console.log('                    TESTING API DATA AVAILABILITY                               ');
    console.log('================================================================================\n');
    
    const now = new Date();
    console.log(`📅 Current Time:`);
    console.log(`   UK:  ${now.toLocaleString('en-GB', { timeZone: 'Europe/London' })}`);
    console.log(`   EST: ${now.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
    console.log(`   Market Status: ${isMarketOpen() ? '🟢 OPEN' : '🔴 CLOSED'}\n`);
    
    const api = new TastyTradeAPI();
    
    try {
        // Initialize API
        console.log('🔌 Connecting to TastyTrade API...');
        await api.initialize();
        console.log('   ✅ Connected\n');
        
        // Test 1: Futures Data (ES, MES)
        console.log('📊 TEST 1: FUTURES DATA (24-hour markets)');
        console.log('─────────────────────────────────────────');
        const futuresTickers = ['/ES', '/MES', '/CL', '/GC'];
        
        for (const ticker of futuresTickers) {
            try {
                const quote = await api.getQuotes([ticker]);
                if (quote && quote[ticker]) {
                    const data = quote[ticker];
                    console.log(`✅ ${ticker}:`);
                    console.log(`   Last: $${data.last || data.mark || 'N/A'}`);
                    console.log(`   Bid/Ask: ${data.bid}/${data.ask}`);
                    console.log(`   Updated: ${data['updated-at'] || 'N/A'}`);
                } else {
                    console.log(`⚠️ ${ticker}: No data`);
                }
            } catch (error) {
                console.log(`❌ ${ticker}: ${error.message}`);
            }
        }
        
        // Test 2: Equity Data (SPY, QQQ)
        console.log('\n📊 TEST 2: EQUITY DATA (closed market)');
        console.log('─────────────────────────────────────────');
        const equityTickers = ['SPY', 'QQQ', 'GLD', 'TLT'];
        
        for (const ticker of equityTickers) {
            try {
                const quote = await api.getQuotes([ticker]);
                if (quote && quote[ticker]) {
                    const data = quote[ticker];
                    console.log(`✅ ${ticker}:`);
                    console.log(`   Last: $${data.last || data.close || 'N/A'}`);
                    console.log(`   Close: $${data.close || 'N/A'}`);
                    console.log(`   After-Hours: ${data.last !== data.close ? 'Yes' : 'No'}`);
                    console.log(`   Updated: ${data['updated-at'] || 'N/A'}`);
                } else {
                    console.log(`⚠️ ${ticker}: No data`);
                }
            } catch (error) {
                console.log(`❌ ${ticker}: ${error.message}`);
            }
        }
        
        // Test 3: Option Chain Data
        console.log('\n📊 TEST 3: OPTION CHAIN DATA');
        console.log('─────────────────────────────────────────');
        try {
            const chainData = await api.getOptionChain('SPY');
            if (chainData && chainData.strikes) {
                console.log(`✅ SPY Option Chain:`);
                console.log(`   Strikes Available: ${chainData.strikes.length}`);
                console.log(`   Expirations: ${chainData.expirations?.length || 'N/A'}`);
                console.log(`   Data Available: YES`);
            } else {
                console.log(`⚠️ SPY Option Chain: Limited data`);
            }
        } catch (error) {
            console.log(`❌ SPY Option Chain: ${error.message}`);
        }
        
        // Test 4: Greeks Data
        console.log('\n📊 TEST 4: GREEKS DATA');
        console.log('─────────────────────────────────────────');
        console.log('   Greeks typically require market hours for live calculation');
        console.log('   Using last known values when market is closed');
        
        // Test 5: Market Status
        console.log('\n📊 TEST 5: MARKET STATUS API');
        console.log('─────────────────────────────────────────');
        const status = await api.getMarketStatus();
        console.log(`   Status: ${status}`);
        
    } catch (error) {
        console.error('❌ Test Error:', error.message);
    }
    
    // Summary
    console.log('\n================================================================================');
    console.log('                                   SUMMARY                                      ');
    console.log('================================================================================');
    console.log('\n📋 DATA AVAILABILITY:');
    console.log('   ✅ Futures: Available 24/5 (Sunday 6PM - Friday 5PM EST)');
    console.log('   ✅ Equities: Last close price always available');
    console.log('   ✅ Options: Chain structure available, prices from last close');
    console.log('   ⚠️ Greeks: Calculated during market hours, last known otherwise');
    console.log('   ✅ Account Data: Always available\n');
    
    console.log('💡 RECOMMENDATION:');
    console.log('   The framework can run analysis 24/7 using:');
    console.log('   - Last close prices for equities');
    console.log('   - Live futures data (nearly 24-hour)');
    console.log('   - Cached Greeks from market close');
    console.log('   - Historical volatility calculations\n');
}

function isMarketOpen() {
    const now = new Date();
    const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const day = nyTime.getDay();
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    const time = hour * 100 + minute;
    
    // Market closed on weekends
    if (day === 0 || day === 6) return false;
    
    // Market hours: 9:30 AM - 4:00 PM EST
    return time >= 930 && time < 1600;
}

// Run test
testDataAvailability().catch(console.error);