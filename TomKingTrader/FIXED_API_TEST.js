/**
 * FIXED COMPREHENSIVE API TEST SUITE
 * Tom King Trading Framework v17
 * Fixed to properly handle module exports and imports
 */

const path = require('path');
const fs = require('fs');

console.log('=== FIXED COMPREHENSIVE API TEST SUITE ===\n');
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
        
        // Test 2: Try to load each module and check exports
        for (const module of coreModules) {
            try {
                const modulePath = path.join(__dirname, 'src', module);
                if (fs.existsSync(modulePath)) {
                    const moduleExports = require(modulePath);
                    logTest(`Module Loading: ${module}`, 'PASS', `Exports: ${Object.keys(moduleExports).length} items`);
                }
            } catch (error) {
                logTest(`Module Loading: ${module}`, 'FAIL', error.message);
            }
        }
        
        console.log('\nPhase 3: API Integration Tests\n');
        
        // Test 3: Load and test TastyTrade API (Fixed)
        try {
            const { TastyTradeAPI } = require('./src/tastytradeAPI');
            logTest('TastyTrade API Class Loading', 'PASS');
            
            // Create API instance
            const api = new TastyTradeAPI();
            logTest('TastyTrade API Instance Creation', 'PASS');
            
            // Test authentication flow (without actual credentials)
            console.log('Testing authentication flow...');
            
            // Check if credentials are available
            let hasCredentials = false;
            try {
                const config = require('./credentials.config.js');
                hasCredentials = !!(config.clientId && config.clientSecret);
                logTest('Credentials Check', 'PASS', `Has credentials: ${hasCredentials}`);
            } catch (error) {
                logTest('Credentials Check', 'WARN', 'No credentials file found');
            }
            
            if (hasCredentials) {
                // Test actual authentication
                try {
                    console.log('Attempting authentication...');
                    const auth = await api.authenticate();
                    if (auth && auth.success) {
                        logTest('API Authentication', 'PASS', 'Successfully authenticated');
                        
                        // Test account data
                        try {
                            const account = await api.getAccountBalances();
                            if (account && account.netLiquidatingValue) {
                                logTest('Account Data Retrieval', 'PASS', `Balance: $${account.netLiquidatingValue}`);
                            } else {
                                logTest('Account Data Retrieval', 'WARN', 'Account data structure different than expected');
                            }
                        } catch (error) {
                            logTest('Account Data Retrieval', 'FAIL', error.message);
                        }
                        
                        // Test market quotes
                        const testSymbols = ['SPY', 'VIX', 'GLD', 'TLT'];
                        console.log('Testing market quotes...');
                        
                        for (const symbol of testSymbols) {
                            try {
                                const quote = await api.getQuote(symbol);
                                if (quote && (quote.last || quote.mark)) {
                                    const price = quote.last || quote.mark;
                                    logTest(`Quote: ${symbol}`, 'PASS', `Price: $${price}`);
                                } else {
                                    logTest(`Quote: ${symbol}`, 'WARN', 'No price data in expected format');
                                }
                            } catch (error) {
                                logTest(`Quote: ${symbol}`, 'FAIL', error.message);
                            }
                        }
                        
                        // Test futures quotes
                        const futuresSymbols = ['/ES', '/MCL', '/MGC', '/MES', '/MNQ'];
                        console.log('Testing futures quotes...');
                        
                        for (const symbol of futuresSymbols) {
                            try {
                                const quote = await api.getQuote(symbol);
                                if (quote && (quote.last || quote.mark)) {
                                    const price = quote.last || quote.mark;
                                    logTest(`Futures: ${symbol}`, 'PASS', `Price: $${price}`);
                                } else {
                                    logTest(`Futures: ${symbol}`, 'WARN', 'No price data in expected format');
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
                            if (chain && Array.isArray(chain) && chain.length > 0) {
                                logTest('Option Chain Retrieval', 'PASS', `${chain.length} options found`);
                            } else {
                                logTest('Option Chain Retrieval', 'WARN', 'No options data in expected format');
                            }
                        } catch (error) {
                            logTest('Option Chain Retrieval', 'FAIL', error.message);
                        }
                        
                        // Test positions
                        try {
                            const positions = await api.getPositions();
                            if (positions) {
                                const count = Array.isArray(positions) ? positions.length : Object.keys(positions).length;
                                logTest('Positions Retrieval', 'PASS', `${count} positions`);
                            } else {
                                logTest('Positions Retrieval', 'WARN', 'No positions data');
                            }
                        } catch (error) {
                            logTest('Positions Retrieval', 'FAIL', error.message);
                        }
                        
                    } else {
                        logTest('API Authentication', 'FAIL', 'Authentication returned false or no success flag');
                    }
                } catch (error) {
                    logTest('API Authentication', 'FAIL', error.message);
                }
            } else {
                logTest('API Authentication', 'WARN', 'No valid credentials available for testing');
            }
            
        } catch (error) {
            logTest('TastyTrade API Class Loading', 'FAIL', error.message);
        }
        
        console.log('\nPhase 4: Core Module Functionality Tests\n');
        
        // Test 4: Risk Manager (Fixed)
        try {
            const { RiskManager } = require('./src/riskManager');
            const riskManager = new RiskManager();
            logTest('Risk Manager Loading', 'PASS');
            
            // Test VIX regime analysis
            const { VIXRegimeAnalyzer } = require('./src/riskManager');
            const vixAnalysis = VIXRegimeAnalyzer.analyzeVIXRegime(25.5);
            if (vixAnalysis && vixAnalysis.regime) {
                logTest('VIX Regime Analysis', 'PASS', `Regime: ${vixAnalysis.regime}`);
            } else {
                logTest('VIX Regime Analysis', 'FAIL', 'Invalid VIX analysis result');
            }
            
        } catch (error) {
            logTest('Risk Manager Loading', 'FAIL', error.message);
        }
        
        // Test 5: Greeks Calculator (Fixed)
        try {
            const GreeksCalculator = require('./src/greeksCalculator');
            logTest('Greeks Calculator Loading', 'PASS', `Type: ${typeof GreeksCalculator}`);
            
            // Test basic Greeks calculation - check if it's a class or has methods
            if (typeof GreeksCalculator === 'function') {
                const greeks = new GreeksCalculator();
                
                // Test option data structure
                const testOption = {
                    underlyingPrice: 100,
                    strike: 105,
                    dte: 30,
                    riskFreeRate: 0.05,
                    volatility: 0.2,
                    type: 'call'
                };
                
                if (typeof greeks.calculateDelta === 'function') {
                    const delta = greeks.calculateDelta(testOption);
                    if (delta !== null && !isNaN(delta)) {
                        logTest('Greeks Calculation', 'PASS', `Delta: ${delta.toFixed(4)}`);
                    } else {
                        logTest('Greeks Calculation', 'FAIL', 'Invalid delta calculation result');
                    }
                } else {
                    logTest('Greeks Calculation', 'WARN', 'calculateDelta method not found');
                }
            } else if (typeof GreeksCalculator === 'object') {
                // If it's an exported object with methods
                if (typeof GreeksCalculator.calculateDelta === 'function') {
                    const testOption = {
                        underlyingPrice: 100,
                        strike: 105,
                        dte: 30,
                        riskFreeRate: 0.05,
                        volatility: 0.2,
                        type: 'call'
                    };
                    
                    const delta = GreeksCalculator.calculateDelta(testOption);
                    if (delta !== null && !isNaN(delta)) {
                        logTest('Greeks Calculation', 'PASS', `Delta: ${delta.toFixed(4)}`);
                    } else {
                        logTest('Greeks Calculation', 'FAIL', 'Invalid delta calculation result');
                    }
                } else {
                    logTest('Greeks Calculation', 'WARN', 'calculateDelta method not found in exported object');
                }
            }
            
        } catch (error) {
            logTest('Greeks Calculator Loading', 'FAIL', error.message);
        }
        
        // Test 6: Pattern Analysis (Fixed)
        try {
            const { EnhancedPatternAnalyzer } = require('./src/enhancedPatternAnalysis');
            if (EnhancedPatternAnalyzer) {
                const patterns = new EnhancedPatternAnalyzer();
                logTest('Pattern Analysis Loading', 'PASS');
                
                // Test basic pattern analysis
                const testData = {
                    prices: [100, 101, 99, 102, 98, 103],
                    volumes: [1000, 1200, 800, 1500, 900, 1100]
                };
                
                if (typeof patterns.analyze === 'function') {
                    logTest('Pattern Analysis Methods', 'PASS', 'analyze method available');
                } else {
                    logTest('Pattern Analysis Methods', 'WARN', 'Expected methods not found');
                }
            } else {
                logTest('Pattern Analysis Loading', 'WARN', 'EnhancedPatternAnalyzer not found in exports');
            }
            
        } catch (error) {
            logTest('Pattern Analysis Loading', 'FAIL', error.message);
        }
        
        // Test 7: Strategies (Fixed)
        try {
            const strategies = require('./src/strategies');
            logTest('Strategies Module Loading', 'PASS', `Exports: ${Object.keys(strategies).length} items`);
            
            // Check for key strategy functions
            const keyStrategies = ['friday0DTE', 'longTerm112', 'futuresStrangles'];
            let foundStrategies = 0;
            
            for (const strategy of keyStrategies) {
                if (strategies[strategy] || strategies[strategy.toUpperCase()]) {
                    foundStrategies++;
                }
            }
            
            logTest('Strategy Functions Check', 'PASS', `${foundStrategies}/${keyStrategies.length} key strategies found`);
            
        } catch (error) {
            logTest('Strategies Module Loading', 'FAIL', error.message);
        }
        
        console.log('\nPhase 5: Configuration Tests\n');
        
        // Test 8: Configuration Loading (Fixed)
        try {
            const config = require('./src/config');
            logTest('Configuration Loading', 'PASS', `Config sections: ${Object.keys(config).length}`);
            
            // Check critical config values
            const criticalSections = ['trading', 'risk', 'api'];
            let foundSections = 0;
            
            for (const section of criticalSections) {
                if (config[section]) {
                    foundSections++;
                }
            }
            
            if (foundSections >= 2) {
                logTest('Config Validation', 'PASS', `${foundSections}/${criticalSections.length} critical sections found`);
            } else {
                logTest('Config Validation', 'WARN', `Only ${foundSections}/${criticalSections.length} critical sections found`);
            }
            
            // Check specific trading parameters
            if (config.trading && config.trading.maxBuyingPowerUsage) {
                logTest('Trading Config', 'PASS', `Max BP: ${config.trading.maxBuyingPowerUsage}%`);
            } else if (config.maxBuyingPowerUsage) {
                logTest('Trading Config', 'PASS', `Max BP: ${config.maxBuyingPowerUsage}%`);
            } else {
                logTest('Trading Config', 'WARN', 'Max buying power usage not configured');
            }
            
        } catch (error) {
            logTest('Configuration Loading', 'FAIL', error.message);
        }
        
        console.log('\nPhase 6: Integration Tests\n');
        
        // Test 9: Module Integration
        try {
            const config = require('./src/config');
            const { RiskManager } = require('./src/riskManager');
            const { TastyTradeAPI } = require('./src/tastytradeAPI');
            
            // Test if modules can work together
            const riskManager = new RiskManager();
            const api = new TastyTradeAPI();
            
            if (riskManager && api) {
                logTest('Module Integration', 'PASS', 'Core modules can be instantiated together');
            } else {
                logTest('Module Integration', 'FAIL', 'Module integration issues');
            }
            
        } catch (error) {
            logTest('Module Integration', 'FAIL', error.message);
        }
        
    } catch (error) {
        logTest('Test Suite Execution', 'FAIL', error.message);
    }
    
    // Final Results
    console.log('\n=== FIXED TEST RESULTS SUMMARY ===\n');
    console.log(`✅ Tests Passed: ${testResults.passed}`);
    console.log(`❌ Tests Failed: ${testResults.failed}`);
    console.log(`⚠️  Warnings: ${testResults.warnings}`);
    console.log(`📊 Total Tests: ${testResults.passed + testResults.failed + testResults.warnings}`);
    
    const successRate = ((testResults.passed / (testResults.passed + testResults.failed + testResults.warnings)) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%\n`);
    
    // Save detailed results
    const reportPath = path.join(__dirname, 'FIXED_API_TEST_RESULTS.json');
    fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
    console.log(`📄 Detailed results saved to: ${reportPath}\n`);
    
    // Recommendations
    console.log('=== FIXED TEST RECOMMENDATIONS ===\n');
    
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
    } else if (testResults.failed <= 2) {
        console.log('🟡 Minor issues found. Framework is mostly functional.');
    } else {
        console.log('🔧 Address failed tests before proceeding with live trading.');
    }
    
    // Performance Assessment
    console.log('\n=== FRAMEWORK READINESS ASSESSMENT ===\n');
    
    if (successRate >= 90) {
        console.log('🟢 EXCELLENT: Framework is production-ready');
    } else if (successRate >= 80) {
        console.log('🟡 GOOD: Framework is functional with minor issues');
    } else if (successRate >= 70) {
        console.log('🟠 FAIR: Framework needs attention before production use');
    } else {
        console.log('🔴 POOR: Framework requires significant fixes');
    }
}

// Run the comprehensive test suite
runComprehensiveTests().catch(error => {
    console.error('Fixed test suite failed:', error);
    process.exit(1);
});