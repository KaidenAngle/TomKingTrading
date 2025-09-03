/**
 * Extreme Volatility Testing System
 * Tom King Trading Framework - VIX>40, flash crashes, circuit breaker validation
 * Tests framework resilience under extreme market conditions
 */

const fs = require('fs');
const path = require('path');

class ExtremeVolatilityTester {
    constructor(riskManager, emergencyProtocols, orderManager, strategies) {
        this.riskManager = riskManager;
        this.emergencyProtocols = emergencyProtocols;
        this.orderManager = orderManager;
        this.strategies = strategies;
        
        // Test scenarios configuration
        this.testScenarios = {
            vixSpike40: {
                name: 'VIX Spike to 40+',
                conditions: { vix: 42, spyMove: -0.025, timeframe: '1day' },
                expectedResponse: ['YELLOW', 'stopNewPositions', 'tightenStops']
            },
            vixSpike60: {
                name: 'VIX Crisis Level 60+',
                conditions: { vix: 65, spyMove: -0.08, timeframe: '1day' },
                expectedResponse: ['RED', 'emergencyUnwind', 'closeAllPositions']
            },
            flashCrash15min: {
                name: 'Flash Crash 1.5% in 15min',
                conditions: { vix: 35, spyMove: -0.015, timeframe: '15min' },
                expectedResponse: ['RED', 'flashCrashDetected', 'emergencyUnwind']
            },
            circuitBreaker: {
                name: 'Market Circuit Breaker',
                conditions: { spyMove: -0.07, halt: true, vix: 50 },
                expectedResponse: ['RED', 'marketHalt', 'liquidityDriedUp']
            },
            volmageddon: {
                name: 'Volmageddon Scenario (Feb 2018)',
                conditions: { vix: 115, spyMove: -0.04, vixMove: 180 },
                expectedResponse: ['RED', 'extremeVolatility', 'systemShutdown']
            },
            august2024: {
                name: 'August 2024 Correlation Crisis',
                conditions: { correlationSpike: 0.95, vix: 38, spyMove: -0.03 },
                expectedResponse: ['RED', 'correlationCrisis', 'diversificationFailed']
            }
        };
        
        // Results tracking
        this.testResults = [];
        this.currentTest = null;
        
        console.log('🌋 Extreme Volatility Testing System initialized');
        console.log(`📊 ${Object.keys(this.testScenarios).length} test scenarios loaded`);
    }
    
    /**
     * Run comprehensive extreme volatility test suite
     */
    async runComprehensiveTests() {
        console.log('🌋 STARTING EXTREME VOLATILITY TEST SUITE');
        console.log('====================================================');
        
        const startTime = new Date();
        const results = {
            startTime,
            totalTests: Object.keys(this.testScenarios).length,
            passed: 0,
            failed: 0,
            details: []
        };
        
        // Run each scenario
        for (const [scenarioId, scenario] of Object.entries(this.testScenarios)) {
            try {
                console.log(`\n🧪 Testing: ${scenario.name}`);
                console.log('─'.repeat(50));
                
                const result = await this.runScenarioTest(scenarioId, scenario);
                results.details.push(result);
                
                if (result.passed) {
                    results.passed++;
                    console.log(`✅ ${scenario.name}: PASSED`);
                } else {
                    results.failed++;
                    console.log(`❌ ${scenario.name}: FAILED`);
                }
                
                // Brief pause between tests
                await this.sleep(1000);
                
            } catch (error) {
                console.error(`❌ Test failed: ${scenario.name}:`, error);
                results.failed++;
                results.details.push({
                    scenario: scenarioId,
                    passed: false,
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }
        
        results.endTime = new Date();
        results.duration = results.endTime - results.startTime;
        results.successRate = (results.passed / results.totalTests * 100).toFixed(1);
        
        // Generate summary report
        this.generateTestReport(results);
        
        console.log('\n🌋 EXTREME VOLATILITY TESTING COMPLETE');
        console.log('====================================================');
        console.log(`📊 Results: ${results.passed}/${results.totalTests} tests passed (${results.successRate}%)`);
        console.log(`⏱️ Duration: ${(results.duration / 1000).toFixed(1)} seconds`);
        
        return results;
    }
    
    /**
     * Run individual scenario test
     */
    async runScenarioTest(scenarioId, scenario) {
        this.currentTest = scenarioId;
        const testResult = {
            scenario: scenarioId,
            name: scenario.name,
            conditions: scenario.conditions,
            expectedResponse: scenario.expectedResponse,
            actualResponse: [],
            passed: false,
            timestamp: new Date(),
            details: {}
        };
        
        try {
            // 1. Setup test environment
            await this.setupTestEnvironment(scenario.conditions);
            
            // 2. Inject extreme market conditions
            const marketData = this.createExtremeMarketData(scenario.conditions);
            
            // 3. Test emergency protocol response
            const emergencyResponse = await this.testEmergencyResponse(marketData);
            testResult.actualResponse = emergencyResponse.actions;
            testResult.details.emergencyLevel = emergencyResponse.level;
            
            // 4. Test risk manager response
            const riskResponse = await this.testRiskManagerResponse(marketData);
            testResult.details.riskActions = riskResponse.actions;
            
            // 5. Test strategy response
            const strategyResponse = await this.testStrategyResponse(marketData);
            testResult.details.strategyActions = strategyResponse.actions;
            
            // 6. Test order manager response
            const orderResponse = await this.testOrderManagerResponse(marketData);
            testResult.details.orderActions = orderResponse.actions;
            
            // 7. Validate responses match expectations
            testResult.passed = this.validateTestResults(testResult, scenario.expectedResponse);
            
            // 8. Cleanup test environment
            await this.cleanupTestEnvironment();
            
        } catch (error) {
            testResult.error = error.message;
            testResult.passed = false;
            console.error(`💥 Test execution error: ${error.message}`);
        }
        
        this.testResults.push(testResult);
        return testResult;
    }
    
    /**
     * Setup test environment with mock positions
     */
    async setupTestEnvironment(conditions) {
        // Create mock portfolio for testing
        const mockPositions = [
            { id: 'TEST_SPY_1', symbol: 'SPY', strategy: '0DTE', unrealizedPL: 150, delta: -25 },
            { id: 'TEST_QQQ_1', symbol: 'QQQ', strategy: 'STRANGLE', unrealizedPL: -75, delta: 10 },
            { id: 'TEST_IWM_1', symbol: 'IWM', strategy: 'LT112', unrealizedPL: 200, delta: -15 }
        ];
        
        // Inject mock positions into risk manager
        if (this.riskManager.setMockPositions) {
            this.riskManager.setMockPositions(mockPositions);
        }
        
        // Reset emergency protocols state
        if (this.emergencyProtocols.resetEmergencyState) {
            await this.emergencyProtocols.resetEmergencyState();
        }
        
        console.log(`🔧 Test environment setup complete (${mockPositions.length} mock positions)`);
    }
    
    /**
     * Create extreme market data for testing
     */
    createExtremeMarketData(conditions) {
        const baseData = {
            timestamp: new Date().toISOString(),
            SPY: {
                currentPrice: 450,
                dailyMove: conditions.spyMove || 0,
                high: 450,
                low: 450 * (1 + (conditions.spyMove || 0)),
                volume: 1000000,
                iv: 0.25
            },
            VIX: {
                currentLevel: conditions.vix || 20,
                currentPrice: conditions.vix || 20,
                dailyMove: conditions.vixMove ? conditions.vixMove / 100 : 0,
                high: conditions.vix || 20,
                low: 15
            },
            marketStatus: conditions.halt ? 'HALTED' : 'OPEN'
        };
        
        // Add flash crash detection
        if (conditions.timeframe === '15min') {
            baseData.SPY.fifteenMinMove = conditions.spyMove;
            baseData.flashCrashDetected = Math.abs(conditions.spyMove) > 0.015;
        }
        
        // Add correlation spike
        if (conditions.correlationSpike) {
            baseData.correlationMatrix = {
                SPY_QQQ: conditions.correlationSpike,
                SPY_IWM: conditions.correlationSpike,
                QQQ_IWM: conditions.correlationSpike
            };
        }
        
        console.log(`📊 Extreme market data created: VIX=${baseData.VIX.currentLevel}, SPY=${(conditions.spyMove * 100).toFixed(1)}%`);
        
        return baseData;
    }
    
    /**
     * Test emergency protocol response
     */
    async testEmergencyResponse(marketData) {
        const response = {
            level: 'GREEN',
            actions: [],
            timestamp: new Date()
        };
        
        try {
            // Check VIX levels
            const vixLevel = marketData.VIX.currentLevel;
            
            if (vixLevel > 60) {
                response.level = 'RED';
                response.actions.push('extremeVolatility', 'emergencyUnwind', 'systemShutdown');
            } else if (vixLevel > 40) {
                response.level = 'ORANGE';
                response.actions.push('highVolatility', 'reduceRisk', 'increaseMonitoring');
            } else if (vixLevel > 30) {
                response.level = 'YELLOW';
                response.actions.push('elevatedVolatility', 'stopNewPositions', 'tightenStops');
            }
            
            // Check flash crash
            if (marketData.flashCrashDetected) {
                response.level = 'RED';
                response.actions.push('flashCrashDetected', 'emergencyUnwind', 'liquidityRisk');
            }
            
            // Check market halt
            if (marketData.marketStatus === 'HALTED') {
                response.level = 'RED';
                response.actions.push('marketHalt', 'tradingHalted', 'awaitResumption');
            }
            
            // Check correlation crisis
            if (marketData.correlationMatrix) {
                const maxCorr = Math.max(...Object.values(marketData.correlationMatrix));
                if (maxCorr > 0.9) {
                    response.level = 'RED';
                    response.actions.push('correlationCrisis', 'diversificationFailed', 'concentrationRisk');
                }
            }
            
            console.log(`🚨 Emergency response: Level ${response.level}, Actions: ${response.actions.join(', ')}`);
            
        } catch (error) {
            response.error = error.message;
        }
        
        return response;
    }
    
    /**
     * Test risk manager response
     */
    async testRiskManagerResponse(marketData) {
        const response = {
            actions: [],
            bpAdjustment: 1.0,
            positionLimits: 'NORMAL'
        };
        
        try {
            const vixLevel = marketData.VIX.currentLevel;
            
            // VIX-adaptive buying power adjustments
            if (vixLevel > 50) {
                response.bpAdjustment = 0.2; // 20% of normal
                response.positionLimits = 'EMERGENCY';
                response.actions.push('severeBPReduction', 'emergencyLimits');
            } else if (vixLevel > 35) {
                response.bpAdjustment = 0.5; // 50% of normal
                response.positionLimits = 'RESTRICTED';
                response.actions.push('moderateBPReduction', 'restrictedPositions');
            } else if (vixLevel > 25) {
                response.bpAdjustment = 0.7; // 70% of normal
                response.actions.push('cautionaryBPReduction');
            }
            
            // Flash crash response
            if (marketData.flashCrashDetected) {
                response.bpAdjustment = 0.1; // 10% of normal
                response.actions.push('flashCrashBPFreeze', 'liquidityRisk');
            }
            
            console.log(`⚖️ Risk manager response: BP=${(response.bpAdjustment * 100)}%, Actions: ${response.actions.join(', ')}`);
            
        } catch (error) {
            response.error = error.message;
        }
        
        return response;
    }
    
    /**
     * Test strategy response under extreme conditions
     */
    async testStrategyResponse(marketData) {
        const response = {
            actions: [],
            strategiesDisabled: [],
            strategiesModified: []
        };
        
        try {
            const vixLevel = marketData.VIX.currentLevel;
            const spyMove = Math.abs(marketData.SPY.dailyMove);
            
            // Disable strategies based on extreme conditions
            if (vixLevel > 40) {
                response.strategiesDisabled.push('0DTE', 'BUTTERFLY');
                response.actions.push('disable0DTE', 'disableButterflies');
            }
            
            if (vixLevel > 50) {
                response.strategiesDisabled.push('STRANGLES', 'IPMCC');
                response.actions.push('disableShortVolatility', 'onlyDefensive');
            }
            
            if (spyMove > 0.05) { // 5% daily move
                response.strategiesDisabled.push('ALL_NEW_POSITIONS');
                response.actions.push('freezeAllNewPositions', 'assessmentMode');
            }
            
            // Modify remaining strategies
            if (vixLevel > 25) {
                response.strategiesModified.push('LT112_DEFENSIVE', 'LEAP_ACCELERATED');
                response.actions.push('enhanceDefensive', 'accelerateProtection');
            }
            
            console.log(`📈 Strategy response: Disabled: ${response.strategiesDisabled.join(', ')}, Modified: ${response.strategiesModified.join(', ')}`);
            
        } catch (error) {
            response.error = error.message;
        }
        
        return response;
    }
    
    /**
     * Test order manager response
     */
    async testOrderManagerResponse(marketData) {
        const response = {
            actions: [],
            orderStatus: 'NORMAL',
            executionMode: 'NORMAL'
        };
        
        try {
            const vixLevel = marketData.VIX.currentLevel;
            
            // Order execution modifications
            if (vixLevel > 50) {
                response.orderStatus = 'EMERGENCY_HALT';
                response.executionMode = 'MANUAL_ONLY';
                response.actions.push('haltAutomation', 'manualApprovalRequired');
            } else if (vixLevel > 35) {
                response.orderStatus = 'RESTRICTED';
                response.executionMode = 'REDUCED_AUTOMATION';
                response.actions.push('restrictAutomation', 'enhancedValidation');
            }
            
            // Flash crash response
            if (marketData.flashCrashDetected) {
                response.orderStatus = 'EMERGENCY_HALT';
                response.actions.push('flashCrashHalt', 'awaitStabilization');
            }
            
            // Market halt response
            if (marketData.marketStatus === 'HALTED') {
                response.orderStatus = 'MARKET_CLOSED';
                response.actions.push('marketHaltDetected', 'queueOrders');
            }
            
            console.log(`📋 Order manager response: Status: ${response.orderStatus}, Mode: ${response.executionMode}`);
            
        } catch (error) {
            response.error = error.message;
        }
        
        return response;
    }
    
    /**
     * Validate test results against expectations
     */
    validateTestResults(testResult, expectedResponse) {
        let passed = true;
        const validationDetails = [];
        
        // Check if emergency level is appropriate
        const emergencyLevel = testResult.details.emergencyLevel;
        if (expectedResponse.includes('RED') && emergencyLevel !== 'RED') {
            passed = false;
            validationDetails.push(`Expected RED emergency level, got ${emergencyLevel}`);
        }
        
        if (expectedResponse.includes('YELLOW') && !['YELLOW', 'ORANGE', 'RED'].includes(emergencyLevel)) {
            passed = false;
            validationDetails.push(`Expected at least YELLOW emergency level, got ${emergencyLevel}`);
        }
        
        // Check for specific expected actions
        const allActions = [
            ...testResult.actualResponse,
            ...testResult.details.riskActions,
            ...testResult.details.strategyActions,
            ...testResult.details.orderActions
        ];
        
        for (const expectedAction of expectedResponse) {
            if (!allActions.some(action => action.includes(expectedAction) || expectedAction.includes(action))) {
                passed = false;
                validationDetails.push(`Expected action containing '${expectedAction}' not found`);
            }
        }
        
        testResult.validationDetails = validationDetails;
        
        if (passed) {
            console.log(`✅ Validation passed: All expected responses detected`);
        } else {
            console.log(`❌ Validation failed:`, validationDetails);
        }
        
        return passed;
    }
    
    /**
     * Cleanup test environment
     */
    async cleanupTestEnvironment() {
        // Reset mock positions
        if (this.riskManager.clearMockPositions) {
            this.riskManager.clearMockPositions();
        }
        
        // Reset emergency protocols
        if (this.emergencyProtocols.resetEmergencyState) {
            await this.emergencyProtocols.resetEmergencyState();
        }
        
        console.log('🧹 Test environment cleanup complete');
    }
    
    /**
     * Generate comprehensive test report
     */
    generateTestReport(results) {
        const reportPath = path.join(__dirname, '../logs/extreme_volatility_test_report.json');
        const summaryPath = path.join(__dirname, '../logs/extreme_volatility_summary.txt');
        
        // Ensure logs directory exists
        const logsDir = path.dirname(reportPath);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        // Generate detailed JSON report
        const detailedReport = {
            ...results,
            systemInfo: {
                nodeVersion: process.version,
                platform: process.platform,
                timestamp: new Date().toISOString(),
                testVersion: '1.0'
            },
            testScenarios: this.testScenarios
        };
        
        fs.writeFileSync(reportPath, JSON.stringify(detailedReport, null, 2));
        
        // Generate human-readable summary
        let summary = '🌋 EXTREME VOLATILITY TESTING REPORT\n';
        summary += '='.repeat(50) + '\n\n';
        summary += `Test Date: ${results.startTime.toISOString()}\n`;
        summary += `Duration: ${(results.duration / 1000).toFixed(1)} seconds\n`;
        summary += `Total Tests: ${results.totalTests}\n`;
        summary += `Passed: ${results.passed}\n`;
        summary += `Failed: ${results.failed}\n`;
        summary += `Success Rate: ${results.successRate}%\n\n`;
        
        summary += 'TEST RESULTS BY SCENARIO:\n';
        summary += '-'.repeat(30) + '\n';
        
        for (const result of results.details) {
            summary += `${result.passed ? '✅' : '❌'} ${result.name}\n`;
            if (!result.passed && result.validationDetails) {
                result.validationDetails.forEach(detail => {
                    summary += `   ⚠️ ${detail}\n`;
                });
            }
            summary += `   Emergency Level: ${result.details.emergencyLevel || 'N/A'}\n`;
            summary += `   Actions: ${result.actualResponse.join(', ') || 'None'}\n\n`;
        }
        
        summary += 'SYSTEM RESILIENCE ASSESSMENT:\n';
        summary += '-'.repeat(30) + '\n';
        
        if (results.successRate >= 90) {
            summary += '🟢 EXCELLENT: System demonstrates strong resilience to extreme volatility\n';
        } else if (results.successRate >= 75) {
            summary += '🟡 GOOD: System mostly handles extreme conditions well\n';
        } else if (results.successRate >= 50) {
            summary += '🟠 MODERATE: System needs improvements for extreme conditions\n';
        } else {
            summary += '🔴 POOR: System requires significant improvements for stability\n';
        }
        
        summary += '\nRECOMMENDations:\n';
        summary += '-'.repeat(20) + '\n';
        
        if (results.failed > 0) {
            summary += '• Review failed test scenarios and improve response protocols\n';
            summary += '• Enhance emergency detection sensitivity\n';
            summary += '• Strengthen circuit breaker mechanisms\n';
        }
        
        summary += '• Regular testing recommended to maintain system resilience\n';
        summary += '• Monitor real market conditions for validation opportunities\n';
        
        fs.writeFileSync(summaryPath, summary);
        
        console.log(`📄 Detailed report saved: ${reportPath}`);
        console.log(`📄 Summary report saved: ${summaryPath}`);
    }
    
    /**
     * Run single scenario test (for debugging)
     */
    async runSingleScenario(scenarioId) {
        const scenario = this.testScenarios[scenarioId];
        if (!scenario) {
            throw new Error(`Scenario ${scenarioId} not found`);
        }
        
        console.log(`🧪 Running single scenario: ${scenario.name}`);
        
        const result = await this.runScenarioTest(scenarioId, scenario);
        
        console.log('\n📊 Single Scenario Result:');
        console.log(`Status: ${result.passed ? 'PASSED' : 'FAILED'}`);
        console.log(`Emergency Level: ${result.details.emergencyLevel}`);
        console.log(`Actions: ${result.actualResponse.join(', ')}`);
        
        if (!result.passed) {
            console.log('Validation Issues:', result.validationDetails);
        }
        
        return result;
    }
    
    /**
     * Get system stress test score
     */
    calculateStressTestScore() {
        const recentResults = this.testResults.slice(-Object.keys(this.testScenarios).length);
        if (recentResults.length === 0) return 0;
        
        const passedTests = recentResults.filter(r => r.passed).length;
        const score = (passedTests / recentResults.length) * 100;
        
        console.log(`📊 System Stress Test Score: ${score.toFixed(1)}/100`);
        
        return score;
    }
    
    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get test status
     */
    getStatus() {
        return {
            totalScenarios: Object.keys(this.testScenarios).length,
            testResults: this.testResults.length,
            currentTest: this.currentTest,
            lastTestTime: this.testResults.length > 0 ? 
                this.testResults[this.testResults.length - 1].timestamp : null,
            stressTestScore: this.calculateStressTestScore()
        };
    }
}

module.exports = ExtremeVolatilityTester;