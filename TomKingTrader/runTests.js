#!/usr/bin/env node

/**
 * QUICK TEST EXECUTION SCRIPT
 * Simplified interface to run the comprehensive test suite
 */

const MasterTestRunner = require('./masterTestRunner');

async function quickDemo() {
    console.log('🚀 TOM KING FRAMEWORK - QUICK TEST DEMO');
    console.log('='.repeat(60));
    
    const runner = new MasterTestRunner();
    
    try {
        // Initialize without API for demo
        await runner.initialize({
            useAPI: false,
            verbose: true,
            generateReports: true
        });
        
        // Run quick validation
        console.log('⚡ Running quick validation test...');
        const result = await runner.runQuickValidation();
        
        if (result.success) {
            console.log('\n✅ QUICK VALIDATION PASSED - System appears healthy');
            console.log('🎯 Ready for comprehensive testing');
        } else {
            console.log('\n❌ QUICK VALIDATION FAILED - Issues detected');
            console.log('⚠️ Review results before comprehensive testing');
        }
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

if (require.main === module) {
    quickDemo();
}