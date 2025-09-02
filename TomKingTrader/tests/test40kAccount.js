#!/usr/bin/env node

/**
 * £40,000 EMPTY ACCOUNT ANALYSIS
 * Tests the framework with a fresh £40,000 account with no positions
 * Simulates someone starting fresh with the framework
 */

require('dotenv').config();
const { TastyTradeAPI } = require('../src/tastytradeAPI');
const DataManager = require('../src/dataManager');
const EnhancedRecommendationEngine = require('../src/enhancedRecommendationEngine');
const V14CompleteFunctionality = require('../src/v14CompleteFunctionality');
const OrderPreparation = require('../src/orderPreparation');
const FrameworkOutputGenerator = require('../src/frameworkOutputGenerator');

async function analyze40kAccount() {
    console.log('================================================================================');
    console.log('                 TOM KING TRADING FRAMEWORK - £40,000 FRESH START               ');
    console.log('================================================================================\n');
    
    // Current date/time
    const now = new Date();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
    const timeEST = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
    
    // User data for fresh £40k account
    const userData = {
        accountValue: 40000,
        phase: 2,  // Phase 2: £40-60k
        bpUsed: 0, // No positions yet
        dayOfWeek: dayOfWeek,
        dateStr: now.toLocaleDateString('en-US'),
        timeStr: timeEST,
        timeEST: timeEST,
        vixLevel: 16.5, // Will update with real data
        portfolioMargin: false,
        monthPL: 0,
        positions: [] // Empty account
    };
    
    console.log('📊 ACCOUNT STATUS');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log(`Account Value:    £${userData.accountValue.toLocaleString()}`);
    console.log(`Phase:            ${userData.phase} (£40-60k Growth Phase)`);
    console.log(`BP Used:          ${userData.bpUsed}% / 65% max`);
    console.log(`Current Positions: NONE (Fresh start opportunity)`);
    console.log(`Day:              ${userData.dayOfWeek}`);
    console.log(`Time EST:         ${userData.timeEST}`);
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Initialize API and Data Manager
    const api = new TastyTradeAPI();
    const dataManager = new DataManager(api);
    
    try {
        await api.initialize();
        console.log('✅ Connected to TastyTrade API\n');
    } catch (error) {
        console.log('⚠️ Using simulated data (API connection failed)\n');
    }
    
    // Fetch market data
    console.log('📈 FETCHING MARKET DATA...');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    
    const marketData = {};
    const phase2Tickers = ['ES', 'MES', 'MCL', 'MGC', 'GLD', 'TLT', 'SLV', 'XOP', 'SPY'];
    
    for (const ticker of phase2Tickers) {
        const data = await dataManager.getMarketData(ticker);
        if (data) {
            marketData[ticker] = data;
            console.log(`${ticker}: $${data.currentPrice?.toFixed(2) || 'N/A'} ` +
                       `(${((data.currentPrice - data.previousClose) / data.previousClose * 100).toFixed(2)}%)`);
        }
    }
    
    // Update VIX level
    const vixData = await dataManager.getMarketData('VIX');
    if (vixData) {
        userData.vixLevel = vixData.currentPrice || 16.5;
        console.log(`\nVIX: ${userData.vixLevel.toFixed(2)} (${getVIXRegime(userData.vixLevel)})`);
    }
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Run V14 Complete Analysis
    const v14 = new V14CompleteFunctionality();
    const v14Analysis = await v14.runComprehensiveAnalysis(userData, marketData);
    
    // Run Enhanced Recommendations
    console.log('\n📊 RUNNING PATTERN ANALYSIS...');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    
    const engine = new EnhancedRecommendationEngine();
    await engine.initialize(false);
    engine.currentMarketData = marketData;
    
    const recommendations = await engine.generateEnhancedRecommendations(
        userData,
        true,  // Include Greeks
        true   // Include Patterns
    );
    
    console.log(`Qualified Tickers: ${recommendations.summary.qualifiedTickersCount}`);
    console.log(`Pattern Opportunities: ${recommendations.summary.patternOpportunities}`);
    console.log(`Strike Recommendations: ${recommendations.summary.strikeRecommendations}`);
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Display Today's Opportunities
    console.log('🎯 TODAY\'S OPPORTUNITIES');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    
    const dayOpportunities = {
        'Monday': ['LEAP entries (Phase 2+)', 'Position management'],
        'Tuesday': ['STRANGLE entries (primary day)', 'Ratio spreads'],
        'Wednesday': ['LT112 entries (primary day)', 'MES stacking'],
        'Thursday': ['Management only', 'Review positions for 21 DTE'],
        'Friday': ['0DTE after 10:30 AM', 'IPMCC rolls', 'Butterflies (Phase 3+)']
    };
    
    console.log(`Today (${userData.dayOfWeek}):`);
    dayOpportunities[userData.dayOfWeek]?.forEach(opp => {
        console.log(`  • ${opp}`);
    });
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Show specific recommendations
    if (recommendations.actionItems && recommendations.actionItems.length > 0) {
        console.log('✅ RECOMMENDED ACTIONS');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        
        recommendations.actionItems.forEach((item, idx) => {
            const priorityIcon = {
                'CRITICAL': '🚨',
                'HIGH': '⚡',
                'MEDIUM': '📊',
                'LOW': '💡'
            }[item.priority] || '📌';
            
            console.log(`\n${idx + 1}. ${priorityIcon} [${item.priority}] ${item.action}`);
            console.log(`   ${item.details}`);
            if (item.reasoning) {
                console.log(`   Reason: ${item.reasoning}`);
            }
            if (item.bpRequired) {
                console.log(`   BP Required: ${item.bpRequired}%`);
            }
        });
        console.log('─────────────────────────────────────────────────────────────────────────────\n');
    }
    
    // Prepare sample orders based on day
    const orderPrep = new OrderPreparation(api);
    console.log('📝 PREPARING ORDERS FOR MANUAL EXECUTION');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    
    if (userData.dayOfWeek === 'Tuesday') {
        console.log('\n📊 Tuesday Strangle Opportunity:');
        const strangleOrder = {
            strategy: 'STRANGLE',
            ticker: 'TLT',
            dte: 45,
            autoExecute: false
        };
        await orderPrep.prepareOrder(strangleOrder, userData);
    } else if (userData.dayOfWeek === 'Wednesday') {
        console.log('\n📊 Wednesday LT112 Opportunity:');
        const lt112Order = {
            strategy: 'LT112',
            ticker: 'MES',
            dte: 112,
            autoExecute: false
        };
        await orderPrep.prepareOrder(lt112Order, userData);
    } else if (userData.dayOfWeek === 'Friday' && extractHour(userData.timeEST) >= 10.5) {
        console.log('\n📊 Friday 0DTE Opportunity:');
        const zdteOrder = {
            strategy: '0DTE',
            ticker: 'ES',
            dte: 0,
            autoExecute: false
        };
        await orderPrep.prepareOrder(zdteOrder, userData);
    } else {
        console.log('\nNo primary opportunities for current day/time.');
        console.log('Consider position management or preparation for tomorrow.');
    }
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // BP Deployment Plan
    console.log('💰 OPTIMAL BP DEPLOYMENT PLAN (PHASE 2)');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log('Target BP Usage: 55-65% (Phase 2 optimal)');
    console.log('\nSuggested Initial Deployment:');
    console.log('  1. 2x Strangles (TLT, GLD):     6% BP');
    console.log('  2. 2x MES LT112:                6% BP');
    console.log('  3. 1x IPMCC (SPY):              8% BP');
    console.log('  4. 2x 0DTE Friday:              4% BP');
    console.log('  5. 2x MCL/MGC Strangles:        5% BP');
    console.log('  Total Week 1:                  29% BP');
    console.log('\nWeek 2 Additions:');
    console.log('  6. 2x More Strangles:           6% BP');
    console.log('  7. 2x Ratio Spreads:            4% BP');
    console.log('  8. 2x LEAP Positions:           4% BP');
    console.log('  Total Deployed:                43% BP');
    console.log('\nReserve: 22% for opportunities and management');
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Monthly Projections
    console.log('📈 MONTHLY PROJECTIONS');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    const monthlyTarget = userData.accountValue * 0.08; // 8% realistic target
    const optimalTarget = userData.accountValue * 0.12; // 12% optimal
    
    console.log(`Conservative (6%):  £${(userData.accountValue * 0.06).toLocaleString()}`);
    console.log(`Realistic (8%):     £${monthlyTarget.toLocaleString()}`);
    console.log(`Optimal (12%):      £${optimalTarget.toLocaleString()}`);
    console.log('\nPath to £80k Goal:');
    
    let projectedValue = userData.accountValue;
    for (let month = 1; month <= 8; month++) {
        projectedValue *= 1.08; // 8% monthly
        console.log(`  Month ${month}: £${Math.round(projectedValue).toLocaleString()}`);
        if (projectedValue >= 80000) {
            console.log(`  🎯 Goal reached in Month ${month}!`);
            break;
        }
    }
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Risk Warnings
    console.log('⚠️ RISK MANAGEMENT REMINDERS');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    console.log('• Never exceed 65% BP in Phase 2');
    console.log('• Max 3 positions per correlation group');
    console.log('• Exit all positions at 21 DTE or 50% profit');
    console.log('• 0DTE only on Friday after 10:30 AM');
    console.log('• Review August 2024 lesson (no excessive correlation)');
    console.log('• Start small - prove the system works');
    console.log('─────────────────────────────────────────────────────────────────────────────\n');
    
    // Summary
    console.log('================================================================================');
    console.log('                                    SUMMARY                                     ');
    console.log('================================================================================');
    console.log(`\n✅ Your £40,000 account is ready for systematic deployment.`);
    console.log(`\n📊 Phase 2 Benefits:`);
    console.log('   • Access to MES, MNQ futures');
    console.log('   • Up to 4 LT112 positions');
    console.log('   • 2 0DTE contracts on Fridays');
    console.log('   • Enhanced strangle opportunities');
    console.log(`\n🎯 Next Steps:`);
    console.log('   1. Review today\'s opportunities above');
    console.log('   2. Start with 1-2 positions to test the system');
    console.log('   3. Log all trades in the framework');
    console.log('   4. Run daily analysis at market open');
    console.log('   5. Stick to the plan - no emotional decisions');
    console.log('\n💡 Remember: Discipline beats intelligence in trading.');
    console.log('================================================================================\n');
    
    // Generate comprehensive output with visualization
    console.log('\n📊 GENERATING COMPREHENSIVE OUTPUT...');
    console.log('─────────────────────────────────────────────────────────────────────────────');
    
    const outputGenerator = new FrameworkOutputGenerator();
    const output = await outputGenerator.generateCompleteOutput(
        userData,
        marketData,
        recommendations,
        v14Analysis
    );
    
    console.log(`\n✅ Analysis complete!`);
    console.log(`📄 Text output: ${output.textFile}`);
    console.log(`📊 HTML dashboard: ${output.htmlFile}`);
    console.log('\nOpen the HTML file in your browser for interactive visualization.');
    console.log('================================================================================\n');
}

function getVIXRegime(vixLevel) {
    if (vixLevel < 13) return 'LOW - Deploy 40-50% BP';
    if (vixLevel < 18) return 'NORMAL - Deploy 60-70% BP';
    if (vixLevel < 25) return 'ELEVATED - Deploy 75-80% BP';
    if (vixLevel < 30) return 'HIGH - Deploy 50-60% BP';
    return 'CRISIS - Deploy 80% BP into puts';
}

function extractHour(timeStr) {
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

// Run analysis
analyze40kAccount().catch(error => {
    console.error('❌ Analysis Error:', error);
    console.error(error.stack);
});