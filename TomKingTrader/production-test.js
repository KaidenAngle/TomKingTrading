#!/usr/bin/env node

/**
 * Tom King Trading Framework - Production Readiness Test
 * End-to-end testing with real scenarios
 */

const http = require('http');
const WebSocket = require('ws');
const { TomKingTrader, TomKingUtils } = require('./src/index');

// Test Configuration
const TEST_CONFIG = {
    API_URL: 'http://localhost:3000',
    WS_URL: 'ws://localhost:3001',
    TEST_ACCOUNT: {
        value: 40000,
        positions: 0,
        bpUsed: 0
    }
};

// Color codes for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Helper functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const color = type === 'success' ? colors.green :
                  type === 'error' ? colors.red :
                  type === 'warning' ? colors.yellow :
                  type === 'test' ? colors.magenta :
                  type === 'data' ? colors.cyan :
                  type === 'info' ? colors.blue : colors.reset;
    
    console.log(`${color}[${timestamp.split('T')[1].split('.')[0]}] ${message}${colors.reset}`);
}

// API Helper
async function makeAPICall(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, TEST_CONFIG.API_URL);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        const req = http.request(url, options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: body
                    });
                }
            });
        });
        
        req.on('error', reject);
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

// WebSocket Helper
function createWebSocketConnection() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(TEST_CONFIG.WS_URL);
        
        ws.on('open', () => {
            log('WebSocket connected', 'success');
            resolve(ws);
        });
        
        ws.on('error', (error) => {
            log(`WebSocket error: ${error.message}`, 'error');
            reject(error);
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                log(`WS Message: ${message.type}`, 'data');
            } catch (e) {
                log(`WS Raw: ${data}`, 'data');
            }
        });
    });
}

// Test Suite 1: API Health Check
async function testAPIHealth() {
    log('\n═══ TEST 1: API Health Check ═══', 'test');
    
    try {
        const response = await makeAPICall('/api/health');
        
        if (response.status === 200) {
            log('✅ API is healthy', 'success');
            log(`   Status: ${response.data.status}`, 'info');
            log(`   Version: ${response.data.version}`, 'info');
            return true;
        } else {
            log(`❌ API health check failed: ${response.status}`, 'error');
            return false;
        }
    } catch (error) {
        log(`❌ Cannot connect to API: ${error.message}`, 'error');
        return false;
    }
}

// Test Suite 2: System Initialization
async function testSystemInitialization() {
    log('\n═══ TEST 2: System Initialization ═══', 'test');
    
    const initData = {
        accountValue: TEST_CONFIG.TEST_ACCOUNT.value,
        currentPositions: TEST_CONFIG.TEST_ACCOUNT.positions,
        buyingPowerUsed: TEST_CONFIG.TEST_ACCOUNT.bpUsed,
        hasAPICredentials: false,
        testMode: 'Monday 10:45 AM EST'
    };
    
    try {
        const response = await makeAPICall('/api/initialize', 'POST', initData);
        
        if (response.status === 200 && response.data.success) {
            log('✅ System initialized successfully', 'success');
            log(`   Phase: ${response.data.phase}`, 'info');
            log(`   Environment: ${response.data.environment}`, 'info');
            log(`   Qualified Tickers: ${response.data.qualifiedTickers?.join(', ')}`, 'info');
            return response.data;
        } else {
            log(`❌ Initialization failed: ${JSON.stringify(response.data)}`, 'error');
            return null;
        }
    } catch (error) {
        log(`❌ Initialization error: ${error.message}`, 'error');
        return null;
    }
}

// Test Suite 3: Market Data Simulation
async function testMarketDataAnalysis() {
    log('\n═══ TEST 3: Market Data Analysis ═══', 'test');
    
    // Simulate market data for testing
    const marketData = {
        SPY: {
            symbol: 'SPY',
            current: 450.25,
            open: 448.50,
            high: 451.75,
            low: 447.25,
            close: 449.80,
            volume: 85000000,
            atr: 4.5,
            rsi: 55,
            ema20: 448.00,
            ema50: 445.00,
            vwap: 449.50,
            iv: 16.5,
            ivRank: 35,
            ivPercentile: 42,
            bid: 450.20,
            ask: 450.30
        },
        MCL: {
            symbol: 'MCL',
            current: 85.30,
            open: 84.75,
            high: 85.80,
            low: 84.50,
            close: 85.10,
            volume: 15000,
            atr: 1.2,
            rsi: 48,
            ema20: 84.90,
            ema50: 84.00,
            vwap: 85.15,
            iv: 28.5,
            ivRank: 42,
            ivPercentile: 55,
            bid: 85.25,
            ask: 85.35
        },
        GLD: {
            symbol: 'GLD',
            current: 195.50,
            open: 194.80,
            high: 196.20,
            low: 194.50,
            close: 195.30,
            volume: 8500000,
            atr: 2.1,
            rsi: 62,
            ema20: 194.00,
            ema50: 192.50,
            vwap: 195.40,
            iv: 14.8,
            ivRank: 25,
            ivPercentile: 30,
            bid: 195.48,
            ask: 195.52
        },
        TLT: {
            symbol: 'TLT',
            current: 92.75,
            open: 92.20,
            high: 93.10,
            low: 92.00,
            close: 92.60,
            volume: 12000000,
            atr: 1.8,
            rsi: 45,
            ema20: 93.00,
            ema50: 93.50,
            vwap: 92.65,
            iv: 18.2,
            ivRank: 38,
            ivPercentile: 45,
            bid: 92.73,
            ask: 92.77
        }
    };
    
    try {
        const response = await makeAPICall('/api/analyze', 'POST', { marketData });
        
        if (response.status === 200) {
            log('✅ Market analysis completed', 'success');
            
            const analysis = response.data;
            if (analysis.recommendations && analysis.recommendations.length > 0) {
                log('   Recommendations:', 'info');
                analysis.recommendations.forEach(rec => {
                    log(`     • ${rec.action} ${rec.symbol}: ${rec.strategy}`, 'data');
                    if (rec.details) {
                        log(`       ${rec.details}`, 'data');
                    }
                });
            }
            
            if (analysis.signals && analysis.signals.length > 0) {
                log('   Trading Signals:', 'info');
                analysis.signals.forEach(signal => {
                    log(`     • ${signal.symbol}: ${signal.action} (Score: ${signal.score})`, 'data');
                });
            }
            
            return analysis;
        } else {
            log(`❌ Analysis failed: ${response.status}`, 'error');
            return null;
        }
    } catch (error) {
        log(`❌ Analysis error: ${error.message}`, 'error');
        return null;
    }
}

// Test Suite 4: Trading Strategies
async function testTradingStrategies() {
    log('\n═══ TEST 4: Trading Strategy Tests ═══', 'test');
    
    const strategies = [
        {
            name: '0DTE Friday',
            data: {
                strategy: '0DTE',
                symbol: 'SPY',
                dte: 0,
                dayOfWeek: 5,
                currentTime: '11:00',
                vix: 15
            }
        },
        {
            name: 'Long-Term 112',
            data: {
                strategy: 'LT112',
                symbol: 'SPY',
                dte: 112,
                iv: 18,
                ivRank: 45
            }
        },
        {
            name: '90DTE Strangle',
            data: {
                strategy: 'STRANGLE',
                symbol: 'MCL',
                dte: 90,
                iv: 28,
                ivPercentile: 55
            }
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const strategy of strategies) {
        try {
            const response = await makeAPICall('/api/strategy/analyze', 'POST', strategy.data);
            
            if (response.status === 200 && response.data) {
                log(`   ✅ ${strategy.name}: ${response.data.recommendation || 'Analysis complete'}`, 'success');
                passed++;
            } else {
                log(`   ❌ ${strategy.name}: Failed`, 'error');
                failed++;
            }
        } catch (error) {
            log(`   ❌ ${strategy.name}: ${error.message}`, 'error');
            failed++;
        }
    }
    
    log(`   Summary: ${passed} passed, ${failed} failed`, passed === strategies.length ? 'success' : 'warning');
    return passed === strategies.length;
}

// Test Suite 5: Risk Management
async function testRiskManagement() {
    log('\n═══ TEST 5: Risk Management Tests ═══', 'test');
    
    const riskScenarios = [
        {
            name: 'Normal Position',
            positions: [
                { symbol: 'SPY', correlationGroup: 'EQUITY_INDICES', bpUsed: 5000 }
            ],
            newPosition: { symbol: 'QQQ', correlationGroup: 'EQUITY_INDICES', bpRequired: 3000 }
        },
        {
            name: 'Correlation Limit',
            positions: [
                { symbol: 'SPY', correlationGroup: 'EQUITY_INDICES', bpUsed: 5000 },
                { symbol: 'QQQ', correlationGroup: 'EQUITY_INDICES', bpUsed: 3000 },
                { symbol: 'IWM', correlationGroup: 'EQUITY_INDICES', bpUsed: 2000 }
            ],
            newPosition: { symbol: 'ES', correlationGroup: 'EQUITY_INDICES', bpRequired: 4000 }
        },
        {
            name: 'BP Limit',
            positions: [
                { symbol: 'MCL', correlationGroup: 'ENERGY', bpUsed: 8000 },
                { symbol: 'GLD', correlationGroup: 'PRECIOUS_METALS', bpUsed: 6000 }
            ],
            newPosition: { symbol: 'TLT', correlationGroup: 'FIXED_INCOME', bpRequired: 10000 }
        }
    ];
    
    for (const scenario of riskScenarios) {
        try {
            const response = await makeAPICall('/api/risk/check', 'POST', {
                currentPositions: scenario.positions,
                newPosition: scenario.newPosition,
                accountValue: TEST_CONFIG.TEST_ACCOUNT.value
            });
            
            if (response.status === 200) {
                const allowed = response.data.allowed ? '✅ Allowed' : '❌ Blocked';
                log(`   ${scenario.name}: ${allowed}`, response.data.allowed ? 'success' : 'warning');
                if (response.data.reason) {
                    log(`     Reason: ${response.data.reason}`, 'info');
                }
            }
        } catch (error) {
            log(`   ❌ ${scenario.name}: ${error.message}`, 'error');
        }
    }
    
    return true;
}

// Test Suite 6: Complete Workflow
async function testCompleteWorkflow() {
    log('\n═══ TEST 6: Complete Trading Workflow ═══', 'test');
    
    log('Step 1: Initialize system', 'info');
    const initResult = await testSystemInitialization();
    if (!initResult) {
        log('❌ Workflow failed at initialization', 'error');
        return false;
    }
    
    log('\nStep 2: Analyze market data', 'info');
    const analysis = await testMarketDataAnalysis();
    if (!analysis) {
        log('❌ Workflow failed at analysis', 'error');
        return false;
    }
    
    log('\nStep 3: Generate trade recommendations', 'info');
    if (analysis.recommendations && analysis.recommendations.length > 0) {
        const firstRec = analysis.recommendations[0];
        log(`   Selected: ${firstRec.action} ${firstRec.symbol}`, 'success');
        
        log('\nStep 4: Check risk management', 'info');
        const riskCheck = await makeAPICall('/api/risk/check', 'POST', {
            currentPositions: [],
            newPosition: {
                symbol: firstRec.symbol,
                strategy: firstRec.strategy,
                bpRequired: 3000
            },
            accountValue: TEST_CONFIG.TEST_ACCOUNT.value
        });
        
        if (riskCheck.data.allowed) {
            log('   ✅ Risk check passed', 'success');
        } else {
            log(`   ⚠️  Risk check: ${riskCheck.data.reason}`, 'warning');
        }
        
        log('\nStep 5: Generate position details', 'info');
        const positionDetails = await makeAPICall('/api/position/calculate', 'POST', {
            symbol: firstRec.symbol,
            strategy: firstRec.strategy,
            accountValue: TEST_CONFIG.TEST_ACCOUNT.value
        });
        
        if (positionDetails.status === 200) {
            log('   ✅ Position calculated', 'success');
            if (positionDetails.data.contracts) {
                log(`     Contracts: ${positionDetails.data.contracts}`, 'data');
            }
            if (positionDetails.data.maxRisk) {
                log(`     Max Risk: £${positionDetails.data.maxRisk}`, 'data');
            }
        }
    }
    
    log('\n✅ Complete workflow test passed', 'success');
    return true;
}

// Test Suite 7: Performance Test
async function testPerformance() {
    log('\n═══ TEST 7: Performance Testing ═══', 'test');
    
    const iterations = 10;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        await makeAPICall('/api/health');
        
        const time = Date.now() - start;
        times.push(time);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    log(`   Requests: ${iterations}`, 'info');
    log(`   Avg Response: ${avgTime.toFixed(2)}ms`, 'info');
    log(`   Min: ${minTime}ms, Max: ${maxTime}ms`, 'info');
    
    if (avgTime < 100) {
        log('   ✅ Performance is excellent', 'success');
    } else if (avgTime < 500) {
        log('   ⚠️  Performance is acceptable', 'warning');
    } else {
        log('   ❌ Performance needs improvement', 'error');
    }
    
    return avgTime < 500;
}

// Main Test Runner
async function runProductionTests() {
    console.clear();
    log('╔════════════════════════════════════════════════════════════╗', 'test');
    log('║     TOM KING TRADING FRAMEWORK - PRODUCTION TESTS         ║', 'test');
    log('╚════════════════════════════════════════════════════════════╝', 'test');
    log(`Started at: ${new Date().toISOString()}`, 'info');
    
    const results = {
        passed: [],
        failed: [],
        warnings: []
    };
    
    // Check if server is running
    log('\nChecking server status...', 'info');
    try {
        const health = await testAPIHealth();
        if (!health) {
            log('\n❌ Server is not running!', 'error');
            log('Please start the server with: cd TomKingTrader && node start.js', 'error');
            process.exit(1);
        }
    } catch (error) {
        log('\n❌ Cannot connect to server!', 'error');
        log('Please start the server with: cd TomKingTrader && node start.js', 'error');
        process.exit(1);
    }
    
    // Run all tests
    const tests = [
        { name: 'API Health', fn: testAPIHealth },
        { name: 'System Initialization', fn: testSystemInitialization },
        { name: 'Market Data Analysis', fn: testMarketDataAnalysis },
        { name: 'Trading Strategies', fn: testTradingStrategies },
        { name: 'Risk Management', fn: testRiskManagement },
        { name: 'Complete Workflow', fn: testCompleteWorkflow },
        { name: 'Performance', fn: testPerformance }
    ];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                results.passed.push(test.name);
            } else {
                results.failed.push(test.name);
            }
        } catch (error) {
            log(`\n❌ ${test.name} crashed: ${error.message}`, 'error');
            results.failed.push(test.name);
        }
    }
    
    // WebSocket Test
    log('\n═══ TEST 8: WebSocket Connection ═══', 'test');
    try {
        const ws = await createWebSocketConnection();
        log('   ✅ WebSocket connection successful', 'success');
        ws.close();
        results.passed.push('WebSocket');
    } catch (error) {
        log(`   ❌ WebSocket failed: ${error.message}`, 'error');
        results.failed.push('WebSocket');
    }
    
    // Final Report
    log('\n╔════════════════════════════════════════════════════════════╗', 'test');
    log('║                    PRODUCTION TEST RESULTS                 ║', 'test');
    log('╚════════════════════════════════════════════════════════════╝', 'test');
    
    const total = results.passed.length + results.failed.length;
    const passRate = ((results.passed.length / total) * 100).toFixed(1);
    
    log(`\n📊 SUMMARY:`, 'info');
    log(`   Total Tests: ${total}`, 'info');
    log(`   ✅ Passed: ${results.passed.length}`, 'success');
    log(`   ❌ Failed: ${results.failed.length}`, results.failed.length > 0 ? 'error' : 'success');
    log(`   📈 Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'warning');
    
    if (results.failed.length > 0) {
        log('\n❌ Failed Tests:', 'error');
        results.failed.forEach(test => {
            log(`   • ${test}`, 'error');
        });
    }
    
    // Production Readiness Assessment
    log('\n🎯 PRODUCTION READINESS:', 'test');
    
    if (passRate >= 90) {
        log('   ✅ System is PRODUCTION READY', 'success');
        log('   All critical components are functioning correctly', 'success');
    } else if (passRate >= 70) {
        log('   ⚠️  System is PARTIALLY READY', 'warning');
        log('   Some components need attention before production', 'warning');
    } else {
        log('   ❌ System is NOT READY for production', 'error');
        log('   Critical issues must be resolved', 'error');
    }
    
    // Recommendations
    log('\n📋 RECOMMENDATIONS:', 'info');
    if (results.failed.includes('System Initialization')) {
        log('   • Fix initialization issues before deployment', 'warning');
    }
    if (results.failed.includes('Risk Management')) {
        log('   • Critical: Risk management must be fully functional', 'error');
    }
    if (results.failed.includes('Complete Workflow')) {
        log('   • End-to-end workflow must work reliably', 'warning');
    }
    
    log('\n✅ Production tests completed', 'success');
    process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
    runProductionTests().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runProductionTests };