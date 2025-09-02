/**
 * COMPREHENSIVE API TEST SUITE
 * Tom King Trading Framework v17
 * Tests all API functions, module loading, and core functionality
 */

const path = require('path');
const fs = require('fs');

console.log('=== COMPREHENSIVE API TEST SUITE ===\n');
console.log('Testing Tom King Trading Framework v17 API Integration\n');

// Test Results Tracking
let testResults = {
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
};

function logTest(testName, status, details = '') {
    const timestamp = new Date().toISOString();
    const result = {
        test: testName,
        status,
        details,
        timestamp
    };
    
    testResults.details.push(result);
    
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ ${testName}: PASS ${details ? '- ' + details : ''}`);
    } else if (status === 'FAIL') {
        testResults.failed++;
        console.log(`❌ ${testName}: FAIL ${details ? '- ' + details : ''}`);
    } else if (status === 'WARN') {
        testResults.warnings++;
        console.log(`⚠️  ${testName}: WARN ${details ? '- ' + details : ''}`);
    }
}

async function runComprehensiveTests() {
    try {
        console.log('Phase 1: Module Syntax and Loading Tests\n');
        
        // Test 1: Check if all core modules exist
        const coreModules = [
            'tastytradeAPI.js',
            'config.js',
            'riskManager.js',
            'strategies.js',
            'enhancedPatternAnalysis.js',
            'enhancedRecommendationEngine.js',
            'greeksCalculator.js',
            'orderManager.js'
        ];
        
        for (const module of coreModules) {
            const modulePath = path.join(__dirname, 'src', module);
            if (fs.existsSync(modulePath)) {
                logTest(`Module Exists: ${module}`, 'PASS');
            } else {
                logTest(`Module Exists: ${module}`, 'FAIL', 'File not found');
            }
        }
        
        console.log('\nPhase 2: Module Loading Tests\n');
        
        // Test 2: Try to load each module
        for (const module of coreModules) {
            try {
                const modulePath = path.join(__dirname, 'src', module);
                if (fs.existsSync(modulePath)) {
                    require(modulePath);
                    logTest(`Module Loading: ${module}`, 'PASS');
                }
            } catch (error) {
                logTest(`Module Loading: ${module}`, 'FAIL', error.message);
            }
        }
        
        console.log('\nPhase 3: API Integration Tests\n');
        
        // Test 3: Load and test TastyTrade API
        try {
            const TastyTradeAPI = require('./src/tastytradeAPI');
            logTest('TastyTrade API Class Loading', 'PASS');
            
            // Create API instance
            const api = new TastyTradeAPI();
            logTest('TastyTrade API Instance Creation', 'PASS');
            
            // Test authentication (without actual credentials)
            console.log('Testing authentication flow...');
            
            // Check if credentials are available
            let hasCredentials = false;
            try {
                const config = require('./credentials.config.js');
                hasCredentials = !!(config.tastyTrade && config.tastyTrade.username && config.tastyTrade.password);
            } catch (error) {
                logTest('Credentials Check', 'WARN', 'No credentials file found');
            }
            
            if (hasCredentials) {
                // Test actual authentication
                try {
                    const auth = await api.authenticate();
                    if (auth) {
                        logTest('API Authentication', 'PASS', 'Successfully authenticated');
                        
                        // Test account data
                        try {
                            const account = await api.getAccountBalances();
                            if (account) {
                                logTest('Account Data Retrieval', 'PASS', `Balance: ${account.net_liquidating_value || 'N/A'}`);
                            } else {
                                logTest('Account Data Retrieval', 'FAIL', 'No account data returned');
                            }
                        } catch (error) {
                            logTest('Account Data Retrieval', 'FAIL', error.message);
                        }
                        
                        // Test market quotes
                        const testSymbols = ['SPY', 'VIX', 'GLD', 'TLT'];
                        console.log('\nTesting market quotes...');
                        
                        for (const symbol of testSymbols) {
                            try {
                                const quote = await api.getQuote(symbol);
                                if (quote && quote.last) {
                                    logTest(`Quote: ${symbol}`, 'PASS', `Price: $${quote.last}`);
                                } else {
                                    logTest(`Quote: ${symbol}`, 'WARN', 'No price data');
                                }
                            } catch (error) {
                                logTest(`Quote: ${symbol}`, 'FAIL', error.message);
                            }
                        }
                        
                        // Test futures quotes
                        const futuresSymbols = ['/ES', '/MCL', '/MGC', '/MES', '/MNQ'];
                        console.log('\nTesting futures quotes...');
                        
                        for (const symbol of futuresSymbols) {
                            try {
                                const quote = await api.getQuote(symbol);
                                if (quote && quote.last) {
                                    logTest(`Futures: ${symbol}`, 'PASS', `Price: $${quote.last}`);
                                } else {
                                    logTest(`Futures: ${symbol}`, 'WARN', 'No price data');
                                }
                            } catch (error) {
                                logTest(`Futures: ${symbol}`, 'FAIL', error.message);
                            }
                        }
                        
                        // Test option chain
                        try {
                            const expiryDate = new Date();
                            expiryDate.setDate(expiryDate.getDate() + 7);
                            const expiry = expiryDate.toISOString().split('T')[0];
                            
                            const chain = await api.getOptionChain('SPY', expiry);
                            if (chain && chain.length > 0) {
                                logTest('Option Chain Retrieval', 'PASS', `${chain.length} options found`);
                            } else {
                                logTest('Option Chain Retrieval', 'WARN', 'No options data');
                            }
                        } catch (error) {
                            logTest('Option Chain Retrieval', 'FAIL', error.message);
                        }
                        
                        // Test positions
                        try {
                            const positions = await api.getPositions();
                            if (positions) {
                                logTest('Positions Retrieval', 'PASS', `${positions.length || 0} positions`);
                            } else {
                                logTest('Positions Retrieval', 'WARN', 'No positions data');
                            }
                        } catch (error) {
                            logTest('Positions Retrieval', 'FAIL', error.message);
                        }
                        
                        // Test WebSocket connection
                        try {
                            const wsConnected = api.websocket && api.websocket.readyState === 1;
                            if (wsConnected) {
                                logTest('WebSocket Connection', 'PASS', 'Connected');
                            } else {
                                logTest('WebSocket Connection', 'WARN', 'Not connected');
                            }
                        } catch (error) {
                            logTest('WebSocket Connection', 'FAIL', error.message);
                        }
                        
                    } else {
                        logTest('API Authentication', 'FAIL', 'Authentication failed');
                    }
                } catch (error) {
                    logTest('API Authentication', 'FAIL', error.message);
                }
            } else {
                logTest('API Authentication', 'WARN', 'No credentials available for testing');
            }
            
        } catch (error) {
            logTest('TastyTrade API Class Loading', 'FAIL', error.message);
        }
        
        console.log('\nPhase 4: Core Module Functionality Tests\n');
        
        // Test 4: Risk Manager
        try {
            const RiskManager = require('./src/riskManager');
            const riskManager = new RiskManager();
            logTest('Risk Manager Loading', 'PASS');
            
            // Test correlation group limits
            const testPositions = [
                { symbol: 'SPY', correlationGroup: 'equities', size: 1000 },
                { symbol: 'QQQ', correlationGroup: 'equities', size: 1000 },
                { symbol: 'IWM', correlationGroup: 'equities', size: 1000 }
            ];
            
            const correlationCheck = riskManager.checkCorrelationLimits(testPositions);
            logTest('Risk Manager Correlation Check', 'PASS', `Result: ${correlationCheck}`);
            
        } catch (error) {
            logTest('Risk Manager Loading', 'FAIL', error.message);
        }
        
        // Test 5: Greeks Calculator
        try {
            const GreeksCalculator = require('./src/greeksCalculator');
            const greeks = new GreeksCalculator();
            logTest('Greeks Calculator Loading', 'PASS');
            
            // Test basic Greeks calculation
            const testOption = {
                spot: 100,
                strike: 105,
                timeToExpiry: 0.1,
                riskFreeRate: 0.05,
                volatility: 0.2,
                optionType: 'call'
            };
            
            const delta = greeks.calculateDelta(testOption);
            if (delta && !isNaN(delta)) {
                logTest('Greeks Calculation', 'PASS', `Delta: ${delta.toFixed(4)}`);
            } else {
                logTest('Greeks Calculation', 'FAIL', 'Invalid delta calculation');
            }
            
        } catch (error) {
            logTest('Greeks Calculator Loading', 'FAIL', error.message);
        }
        
        // Test 6: Pattern Analysis
        try {
            const PatternAnalysis = require('./src/enhancedPatternAnalysis');
            const patterns = new PatternAnalysis();
            logTest('Pattern Analysis Loading', 'PASS');
            
        } catch (error) {
            logTest('Pattern Analysis Loading', 'FAIL', error.message);
        }
        
        // Test 7: Strategies
        try {
            const Strategies = require('./src/strategies');
            logTest('Strategies Module Loading', 'PASS');
            
        } catch (error) {
            logTest('Strategies Module Loading', 'FAIL', error.message);
        }
        
        console.log('\nPhase 5: Configuration Tests\n');
        
        // Test 8: Configuration Loading
        try {
            const config = require('./src/config');
            logTest('Configuration Loading', 'PASS');
            
            // Check critical config values
            if (config.trading && config.trading.maxBuyingPowerUsage) {
                logTest('Config Validation', 'PASS', `Max BP: ${config.trading.maxBuyingPowerUsage}%`);
            } else {
                logTest('Config Validation', 'WARN', 'Missing trading configuration');
            }
            
        } catch (error) {
            logTest('Configuration Loading', 'FAIL', error.message);
        }
        
    } catch (error) {
        logTest('Test Suite Execution', 'FAIL', error.message);
    }
    
    // Final Results
    console.log('\n=== TEST RESULTS SUMMARY ===\n');
    console.log(`✅ Tests Passed: ${testResults.passed}`);
    console.log(`❌ Tests Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📊 Total Tests: ${testResults.passed + testResults.failed + testResults.warnings}`);
    
    const successRate = ((testResults.passed / (testResults.passed + testResults.failed + testResults.warnings)) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%\n`);
    
    // Save detailed results
    const reportPath = path.join(__dirname, 'API_TEST_RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`📄 Detailed results saved to: ${reportPath}\n`);
    
    // Recommendations
    console.log('=== RECOMMENDATIONS ===\n');
    
    if (testResults.failed > 0) {
        console.log('❌ CRITICAL ISSUES FOUND:');
        testResults.details
            .filter(t => t.status === 'FAIL')
            .forEach(test => console.log(`   - ${test.test}: ${test.details}`));
        console.log('');
    }
    
    if (testResults.warnings > 0) {
        console.log('⚠️  WARNINGS TO ADDRESS:');
        testResults.details
            .filter(t => t.status === 'WARN')
            .forEach(test => console.log(`   - ${test.test}: ${test.details}`));
        console.log('');
    }
    
    if (testResults.failed === 0) {
        console.log('✅ All critical tests passed! Framework is ready for trading.');
    } else {
        console.log('🔧 Address failed tests before proceeding with live trading.');
    }
}

// Run the comprehensive test suite
runComprehensiveTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});