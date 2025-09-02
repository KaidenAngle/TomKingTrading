#!/usr/bin/env node

/**
 * Basic Test Runner for Tom King Framework
 * Simple validation of core functionality
 */

const TomKingTestingFramework = require('./src/testingFramework');

async function runBasicTests() {
    console.log('🧪 Running Basic Tom King Framework Tests');
    console.log('===============================================');
    
    const framework = new TomKingTestingFramework();
    
    try {
        // Initialize framework
        await framework.initialize(false); // Use simulated data
        
        // List available scenarios
        console.log('\n📋 Available Test Scenarios:');
        framework.listScenarios();
        
        // Run a few key scenarios
        const keyScenarios = [
            'Phase 1: Fresh Account',
            'Phase 1: High VIX',
            'Friday: 10:30 AM'
        ];
        
        console.log('\n🎯 Running Key Phase 1 Scenarios:');
        
        for (const scenarioName of keyScenarios) {
            try {
                console.log(`\n▶️ Testing: ${scenarioName}`);
                const result = await framework.runSpecificTest(scenarioName);
                
                if (result) {
                    const status = result.success ? '✅ PASSED' : '❌ FAILED';
                    console.log(`${status}: ${result.scenario}`);
                    
                    if (result.success && result.recommendations) {
                        console.log(`   📊 Recommendations: ${result.recommendations.primary?.length || 0} primary`);
                        console.log(`   ⚠️ Warnings: ${result.recommendations.warnings?.length || 0}`);
                        console.log(`   📋 Management: ${result.recommendations.management?.length || 0}`);
                    }
                    
                    if (!result.success) {
                        console.log(`   💥 Error: ${result.error}`);
                    }
                } else {
                    console.log(`❌ Scenario not found: ${scenarioName}`);
                }
                
            } catch (error) {
                console.log(`❌ Test failed: ${error.message}`);
            }
            
            // Brief pause
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n📊 Basic testing completed');
        
    } catch (error) {
        console.error('❌ Testing framework failed:', error.message);
        return false;
    }
    
    return true;
}

// Run if called directly
if (require.main === module) {
    runBasicTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { runBasicTests };