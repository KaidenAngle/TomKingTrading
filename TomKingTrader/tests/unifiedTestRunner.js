/**
 * Unified Test Runner for Tom King Trading Framework v17
 * Consolidates all test scripts into a single interface
 * Run: node tests/unifiedTestRunner.js [category] [test-name]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getLogger } = require('../src/logger');

const logger = getLogger();

class UnifiedTestRunner {
    constructor() {
        this.testResults = new Map();
        this.categories = {
            auth: {
                name: 'Authentication Tests',
                description: 'Tests for API authentication and session management',
                tests: [
                    {
                        name: 'complete-auth',
                        file: 'testCompleteAuth.js',
                        description: 'Complete OAuth2 authentication flow test',
                        timeout: 30000
                    }
                ]
            },
            'market-data': {
                name: 'Market Data Tests',
                description: 'Tests for real-time market data retrieval',
                tests: [
                    {
                        name: 'api-data',
                        file: '../testAPIData.js',
                        description: 'Core API data retrieval test',
                        timeout: 45000
                    },
                    {
                        name: 'live-market-data',
                        file: 'testLiveMarketData.js',
                        description: 'Live market data during trading hours',
                        timeout: 60000
                    },
                    {
                        name: 'real-data-only',
                        file: 'verifyRealDataOnly.js',
                        description: 'Verify real data feeds (no mock data)',
                        timeout: 30000
                    }
                ]
            },
            strategy: {
                name: 'Strategy Tests',
                description: 'Tests for Tom King trading strategies',
                tests: [
                    {
                        name: 'strategy-recommendations',
                        file: 'testStrategyRecommendations.js',
                        description: 'Strategy recommendations with live data',
                        timeout: 60000
                    },
                    {
                        name: 'section-9b',
                        file: 'testSection9B.js',
                        description: 'Advanced Section 9B strategies test',
                        timeout: 45000
                    }
                ]
            },
            order: {
                name: 'Order Management Tests',
                description: 'Tests for order preparation and management (no execution)',
                tests: [
                    {
                        name: 'order-preparation',
                        file: 'testOrderPreparation.js',
                        description: 'Order preparation test (safe, no execution)',
                        timeout: 30000
                    }
                ]
            },
            integration: {
                name: 'Integration Tests',
                description: 'Comprehensive system integration tests',
                tests: [
                    {
                        name: 'system-integration',
                        file: 'systemIntegrationTest.js',
                        description: 'Complete system integration test',
                        timeout: 120000
                    },
                    {
                        name: 'paper-trading-validation',
                        file: 'validatePaperTradingLiveData.js',
                        description: 'Paper trading with live data validation',
                        timeout: 90000
                    }
                ]
            },
            backtest: {
                name: 'Backtesting Tests',
                description: 'Historical backtesting and performance validation',
                tests: [
                    {
                        name: 'backtest-real-data',
                        file: 'testBacktestingWithRealData.js',
                        description: 'Backtesting with real historical data',
                        timeout: 180000
                    },
                    {
                        name: 'comprehensive-backtest',
                        file: 'runComprehensiveBacktest.js',
                        description: 'Comprehensive backtesting scenarios',
                        timeout: 300000
                    }
                ]
            },
            validation: {
                name: 'Validation Tests',
                description: 'Performance metrics and benchmark validation',
                tests: [
                    {
                        name: 'account-tracking',
                        file: 'testAccountTracking.js',
                        description: 'Account balance and position tracking',
                        timeout: 45000
                    },
                    {
                        name: 'performance-metrics',
                        file: 'testPerformanceMetrics.js',
                        description: 'Performance metrics calculation test',
                        timeout: 30000
                    },
                    {
                        name: 'validate-benchmarks',
                        file: 'validate_benchmarks.js',
                        description: 'Benchmark validation test',
                        timeout: 30000
                    }
                ]
            }
        };
    }

    /**
     * Display available test categories and tests
     */
    displayHelp() {
        console.log('\n🧪 Tom King Trading Framework - Unified Test Runner');
        console.log('='.repeat(60));
        console.log('\nUsage:');
        console.log('  node tests/unifiedTestRunner.js                    # Run all tests');
        console.log('  node tests/unifiedTestRunner.js [category]         # Run category tests');
        console.log('  node tests/unifiedTestRunner.js [category] [test]  # Run specific test');
        console.log('\nAvailable Categories:');
        console.log('-'.repeat(40));

        Object.entries(this.categories).forEach(([key, category]) => {
            console.log(`\n📁 ${key} - ${category.name}`);
            console.log(`   ${category.description}`);
            console.log(`   Tests: ${category.tests.length}`);
            
            category.tests.forEach(test => {
                console.log(`     • ${test.name} - ${test.description}`);
            });
        });

        console.log('\nExamples:');
        console.log('  node tests/unifiedTestRunner.js auth                    # Run all auth tests');
        console.log('  node tests/unifiedTestRunner.js market-data api-data   # Run specific test');
        console.log('  node tests/unifiedTestRunner.js integration            # Run integration tests');
        console.log('\n');
    }

    /**
     * Run a specific test file
     */
    async runTest(testFile, testName, timeout = 60000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            console.log(`\n🔄 Running: ${testName}`);
            console.log(`   File: ${testFile}`);
            console.log(`   Timeout: ${timeout/1000}s`);
            console.log('-'.repeat(50));

            const testPath = path.resolve(__dirname, testFile);
            
            // Check if test file exists
            if (!fs.existsSync(testPath)) {
                const result = {
                    name: testName,
                    file: testFile,
                    status: 'ERROR',
                    error: `Test file not found: ${testPath}`,
                    duration: 0
                };
                console.log(`❌ ${testName}: Test file not found`);
                resolve(result);
                return;
            }

            const child = spawn('node', [testPath], {
                stdio: 'pipe',
                cwd: path.dirname(testPath)
            });

            let stdout = '';
            let stderr = '';
            let timeoutId;

            // Set up timeout
            timeoutId = setTimeout(() => {
                child.kill('SIGTERM');
                const result = {
                    name: testName,
                    file: testFile,
                    status: 'TIMEOUT',
                    error: `Test exceeded ${timeout/1000}s timeout`,
                    duration: Date.now() - startTime,
                    output: stdout
                };
                resolve(result);
            }, timeout);

            child.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                process.stdout.write(output);
            });

            child.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                process.stderr.write(output);
            });

            child.on('close', (code) => {
                clearTimeout(timeoutId);
                const duration = Date.now() - startTime;
                
                let status = 'PASSED';
                let error = null;

                if (code !== 0) {
                    status = 'FAILED';
                    error = `Process exited with code ${code}`;
                }

                const result = {
                    name: testName,
                    file: testFile,
                    status: status,
                    error: error,
                    duration: duration,
                    output: stdout,
                    stderr: stderr,
                    exitCode: code
                };

                const statusIcon = status === 'PASSED' ? '✅' : '❌';
                console.log(`\n${statusIcon} ${testName}: ${status} (${duration}ms)`);
                
                if (error) {
                    console.log(`   Error: ${error}`);
                }

                resolve(result);
            });

            child.on('error', (error) => {
                clearTimeout(timeoutId);
                const result = {
                    name: testName,
                    file: testFile,
                    status: 'ERROR',
                    error: error.message,
                    duration: Date.now() - startTime,
                    output: stdout
                };
                console.log(`❌ ${testName}: ERROR - ${error.message}`);
                resolve(result);
            });
        });
    }

    /**
     * Run tests in a specific category
     */
    async runCategory(categoryName) {
        const category = this.categories[categoryName];
        if (!category) {
            console.log(`❌ Category '${categoryName}' not found`);
            this.displayHelp();
            return [];
        }

        console.log(`\n🏷️  Running Category: ${category.name}`);
        console.log(`   ${category.description}`);
        console.log(`   Tests: ${category.tests.length}`);
        console.log('='.repeat(60));

        const results = [];
        for (const test of category.tests) {
            const result = await this.runTest(test.file, test.name, test.timeout);
            results.push(result);
            this.testResults.set(`${categoryName}.${test.name}`, result);
        }

        return results;
    }

    /**
     * Run a specific test within a category
     */
    async runSpecificTest(categoryName, testName) {
        const category = this.categories[categoryName];
        if (!category) {
            console.log(`❌ Category '${categoryName}' not found`);
            return null;
        }

        const test = category.tests.find(t => t.name === testName);
        if (!test) {
            console.log(`❌ Test '${testName}' not found in category '${categoryName}'`);
            console.log(`Available tests: ${category.tests.map(t => t.name).join(', ')}`);
            return null;
        }

        console.log(`\n🎯 Running Specific Test: ${test.name}`);
        console.log(`   Category: ${category.name}`);
        console.log(`   Description: ${test.description}`);
        console.log('='.repeat(60));

        const result = await this.runTest(test.file, test.name, test.timeout);
        this.testResults.set(`${categoryName}.${testName}`, result);
        return result;
    }

    /**
     * Run all tests in all categories
     */
    async runAllTests() {
        console.log('\n🚀 Running All Tests');
        console.log('='.repeat(60));
        console.log(`Total Categories: ${Object.keys(this.categories).length}`);
        console.log(`Total Tests: ${Object.values(this.categories).reduce((sum, cat) => sum + cat.tests.length, 0)}`);
        console.log('='.repeat(60));

        const allResults = [];
        
        for (const [categoryName, category] of Object.entries(this.categories)) {
            const categoryResults = await this.runCategory(categoryName);
            allResults.push(...categoryResults);
        }

        return allResults;
    }

    /**
     * Display test results summary
     */
    displaySummary(results) {
        const passed = results.filter(r => r.status === 'PASSED').length;
        const failed = results.filter(r => r.status === 'FAILED').length;
        const errors = results.filter(r => r.status === 'ERROR').length;
        const timeouts = results.filter(r => r.status === 'TIMEOUT').length;
        const total = results.length;

        console.log('\n📊 Test Results Summary');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed} (${Math.round(passed/total*100)}%)`);
        console.log(`❌ Failed: ${failed} (${Math.round(failed/total*100)}%)`);
        console.log(`💥 Errors: ${errors} (${Math.round(errors/total*100)}%)`);
        console.log(`⏱️  Timeouts: ${timeouts} (${Math.round(timeouts/total*100)}%)`);

        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
        console.log(`⏱️  Total Duration: ${Math.round(totalDuration/1000)}s`);

        if (failed > 0 || errors > 0 || timeouts > 0) {
            console.log('\n❌ Failed/Error Tests:');
            console.log('-'.repeat(40));
            results.filter(r => r.status !== 'PASSED').forEach(result => {
                console.log(`  • ${result.name}: ${result.status}`);
                if (result.error) {
                    console.log(`    ${result.error}`);
                }
            });
        }

        console.log('\n🎯 Test Success Rate: ' + (passed === total ? '100% 🎉' : `${Math.round(passed/total*100)}%`));
        console.log('='.repeat(60));

        // Save detailed results to file
        this.saveResults(results);
    }

    /**
     * Save test results to file
     */
    saveResults(results) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const resultsFile = path.join(__dirname, `test-results-${timestamp}.json`);
        
        const summary = {
            timestamp: new Date().toISOString(),
            framework: 'Tom King Trading Framework v17',
            totalTests: results.length,
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            errors: results.filter(r => r.status === 'ERROR').length,
            timeouts: results.filter(r => r.status === 'TIMEOUT').length,
            totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
            results: results
        };

        try {
            fs.writeFileSync(resultsFile, JSON.stringify(summary, null, 2));
            console.log(`\n💾 Detailed results saved: ${resultsFile}`);
        } catch (error) {
            console.log(`⚠️  Could not save results: ${error.message}`);
        }
    }

    /**
     * Main test runner logic
     */
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            // Run all tests
            const results = await this.runAllTests();
            this.displaySummary(results);
        } else if (args.length === 1) {
            if (args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
                this.displayHelp();
                return;
            }
            
            // Run category
            const results = await this.runCategory(args[0]);
            if (results.length > 0) {
                this.displaySummary(results);
            }
        } else if (args.length === 2) {
            // Run specific test
            const result = await this.runSpecificTest(args[0], args[1]);
            if (result) {
                this.displaySummary([result]);
            }
        } else {
            console.log('❌ Too many arguments');
            this.displayHelp();
        }
    }
}

// Create and run the test runner
const runner = new UnifiedTestRunner();

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n\n🛑 Test runner interrupted by user');
    console.log('📊 Partial results may be available in test-results-*.json');
    process.exit(130);
});

process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught exception in test runner:', error.message);
    console.error(error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled rejection in test runner:', reason);
    process.exit(1);
});

// Run the test runner
runner.run().catch(error => {
    console.error('\n💥 Test runner failed:', error.message);
    console.error(error.stack);
    process.exit(1);
});

module.exports = UnifiedTestRunner;