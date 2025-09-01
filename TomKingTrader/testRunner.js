#!/usr/bin/env node

/**
 * Tom King Testing Framework - Test Runner
 * Run comprehensive scenario-based tests for recommendation system
 */

const TomKingTestingFramework = require('./src/testingFramework');

async function main() {
    console.log('🧪 Tom King Testing Framework v17');
    console.log('📋 Comprehensive scenario-based testing for trading recommendations');
    console.log('🎯 NO LIVE TRADING - RECOMMENDATIONS ONLY\n');

    const framework = new TomKingTestingFramework();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    try {
        // Initialize framework
        const useAPI = args.includes('--api');
        await framework.initialize(useAPI);
        
        switch (command) {
            case 'list':
                framework.listScenarios();
                break;
                
            case 'run':
                const scenarioName = args[1];
                if (scenarioName) {
                    await framework.runSpecificTest(scenarioName);
                } else {
                    console.log('❌ Please specify a scenario name');
                    console.log('Usage: node testRunner.js run "scenario name"');
                    console.log('Use: node testRunner.js list to see all scenarios');
                }
                break;
                
            case 'all':
                await framework.runAllTests();
                break;
                
            default:
                console.log('📋 USAGE:');
                console.log('  node testRunner.js list                    # List all test scenarios');
                console.log('  node testRunner.js run "Phase 1"           # Run specific scenario');
                console.log('  node testRunner.js all                     # Run all scenarios');
                console.log('  node testRunner.js all --api               # Run all with real API data');
                console.log('');
                console.log('📊 QUICK TESTS:');
                console.log('  node testRunner.js run "Fresh Account"     # Test Phase 1 new account');
                console.log('  node testRunner.js run "Friday 0DTE"       # Test Friday opportunities');
                console.log('  node testRunner.js run "August 2024"       # Test disaster prevention');
                console.log('  node testRunner.js run "High VIX"          # Test VIX spike protocol');
                console.log('');
                
                // Show first few scenarios as examples
                await framework.initialize(false);
                console.log('📋 SAMPLE SCENARIOS:');
                framework.scenarios.slice(0, 3).forEach((scenario, i) => {
                    console.log(`${i + 1}. ${scenario.name}`);
                    console.log(`   ${scenario.description}`);
                });
                console.log(`   ... and ${framework.scenarios.length - 3} more scenarios`);
                break;
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if this file is executed directly
if (require.main === module) {
    main();
}

module.exports = { TomKingTestingFramework };