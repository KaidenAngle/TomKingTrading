#!/usr/bin/env node

/**
 * COMPREHENSIVE TEST EXECUTION SCRIPT
 * Simple execution entry point for the complete Agent 5 testing suite
 * 
 * Usage: node RUN_COMPREHENSIVE_TESTS.js
 */

const { MasterTestRunner } = require('./tests/masterTestRunner');

console.log('🚀 Starting Comprehensive Test Suite Execution...\n');

// Execute complete testing suite
const masterRunner = new MasterTestRunner();
masterRunner.executeCompleteTestingSuite()
    .then(results => {
        if (results.finalAssessment.readyForProduction) {
            console.log('\n🎉 SUCCESS: System ready for production!');
            process.exit(0);
        } else {
            console.log('\n⚠️ WARNING: Issues detected, review results before production');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ ERROR: Test execution failed:', error.message);
        process.exit(1);
    });