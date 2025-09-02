/**
 * Comprehensive Test Suite for Monthly Income Generation System
 * Tests MonthlyIncomeCalculator and ThetaOptimizationEngine integration
 * 
 * CRITICAL VALIDATION: Ensures £10k monthly income achievable from £75k account
 * Tests all mathematical calculations for accuracy per Tom King methodology
 */

const assert = require('assert');
const { MonthlyIncomeCalculator } = require('../src/monthlyIncomeCalculator');
const { ThetaOptimizationEngine } = require('../src/thetaOptimizationEngine');
const { PerformanceMetrics } = require('../src/performanceMetrics');

class MonthlyIncomeTestSuite {
    constructor() {
        this.calculator = new MonthlyIncomeCalculator();
        this.thetaEngine = new ThetaOptimizationEngine();
        this.performanceMetrics = new PerformanceMetrics({
            initialCapital: 75000,
            targetMonthlyIncome: 10000
        });
        
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: [],
            details: []
        };
    }

    /**
     * Run complete test suite
     */
    async runAllTests() {
        console.log('🧪 MONTHLY INCOME GENERATION SYSTEM - COMPREHENSIVE TEST SUITE');
        console.log('================================================================');
        
        const testSuites = [
            'Basic Functionality Tests',
            'Tom King Win Rate Validation Tests', 
            'Phase Progression Tests',
            'BP Utilization Safety Tests',
            'VIX Adjustment Tests',
            'Theta Optimization Tests',
            'Integration Tests',
            'Real-World Scenario Tests',
            'Performance Metrics Integration Tests',
            'Feasibility Calculation Tests'
        ];
        
        for (const suiteName of testSuites) {
            console.log(`\n📋 ${suiteName}`);
            console.log('-'.repeat(50));
            
            await this.runTestSuite(suiteName);
        }
        
        this.printSummary();
        return this.testResults;
    }

    /**
     * Run specific test suite
     */
    async runTestSuite(suiteName) {
        try {
            switch (suiteName) {
                case 'Basic Functionality Tests':
                    await this.testBasicFunctionality();
                    break;
                case 'Tom King Win Rate Validation Tests':
                    await this.testTomKingWinRates();
                    break;
                case 'Phase Progression Tests':
                    await this.testPhaseProgression();
                    break;
                case 'BP Utilization Safety Tests':
                    await this.testBPUtilizationSafety();
                    break;
                case 'VIX Adjustment Tests':
                    await this.testVIXAdjustments();
                    break;
                case 'Theta Optimization Tests':
                    await this.testThetaOptimization();
                    break;
                case 'Integration Tests':
                    await this.testIntegration();
                    break;
                case 'Real-World Scenario Tests':
                    await this.testRealWorldScenarios();
                    break;
                case 'Performance Metrics Integration Tests':
                    await this.testPerformanceMetricsIntegration();
                    break;
                case 'Feasibility Calculation Tests':
                    await this.testFeasibilityCalculations();
                    break;
            }
        } catch (error) {
            this.recordError(`Error in ${suiteName}`, error);
        }
    }

    /**
     * Test basic functionality
     */
    async testBasicFunctionality() {
        // Test 1: Constructor initialization
        this.test('Calculator initializes correctly', () => {
            assert(this.calculator instanceof MonthlyIncomeCalculator);
            assert(this.thetaEngine instanceof ThetaOptimizationEngine);
            return true;
        });

        // Test 2: Configuration access
        this.test('Configuration accessible and valid', () => {
            const config = this.calculator.getConfiguration();
            assert(config.winRates.dte0 === 0.88, 'DTE0 win rate should be 88%');
            assert(config.winRates.lt112 === 0.73, 'LT112 win rate should be 73%');
            assert(config.winRates.strangles === 0.72, 'Strangles win rate should be 72%');
            return true;
        });

        // Test 3: Phase determination
        this.test('Account phase determination', () => {
            assert(this.calculator.determineAccountPhase(35000) === 1, 'Phase 1 for £35k account');
            assert(this.calculator.determineAccountPhase(50000) === 2, 'Phase 2 for £50k account');
            assert(this.calculator.determineAccountPhase(70000) === 3, 'Phase 3 for £70k account');
            assert(this.calculator.determineAccountPhase(80000) === 4, 'Phase 4 for £80k account');
            return true;
        });
    }

    /**
     * Test Tom King win rate validation with exact calculations
     */
    async testTomKingWinRates() {
        // Test 1: 0DTE win rate calculations
        this.test('0DTE win rate calculation accuracy', () => {
            const result = this.calculator.calculate0DTERequirements(75000, 4000, 1.0);
            
            // Verify win rate is exactly 88%
            assert(result.winRate === 0.88, 'DTE0 win rate must be exactly 88%');
            
            // Verify expected profit calculation uses correct win rate
            const expectedProfit = (0.50 * 0.88) - (0.50 * 2 * 0.12);
            assert(Math.abs(result.expectedProfitPerContract - expectedProfit) < 0.001, 
                'Expected profit calculation must be mathematically correct');
            
            return true;
        });

        // Test 2: LT112 win rate calculations
        this.test('LT112 win rate calculation accuracy', () => {
            const result = this.calculator.calculateLT112Requirements(75000, 3500, 1.0);
            
            // Verify win rate is exactly 73%
            assert(result.winRate === 0.73, 'LT112 win rate must be exactly 73%');
            
            // Verify expected profit calculation
            const expectedProfit = (1.50 * 0.73) - (1.50 * 1.5 * 0.27);
            assert(Math.abs(result.expectedProfitPerContract - expectedProfit) < 0.001,
                'LT112 expected profit calculation must be mathematically correct');
            
            return true;
        });

        // Test 3: Strangle win rate calculations
        this.test('Strangles win rate calculation accuracy', () => {
            const result = this.calculator.calculateStrangleRequirements(75000, 2500, 1.0);
            
            // Verify win rate is exactly 72%
            assert(result.winRate === 0.72, 'Strangles win rate must be exactly 72%');
            
            // Verify expected profit calculation
            const expectedProfit = (800 * 0.72) - (800 * 1.8 * 0.28);
            assert(Math.abs(result.expectedProfitPerContract - expectedProfit) < 0.01,
                'Strangles expected profit calculation must be mathematically correct');
            
            return true;
        });
    }

    /**
     * Test phase progression logic
     */
    async testPhaseProgression() {
        // Test 1: Phase targets match specification
        this.test('Phase targets match specification', () => {
            const config = this.calculator.getConfiguration();
            assert(config.phaseTargets[1] === 3000, 'Phase 1 target is £3k');
            assert(config.phaseTargets[2] === 5000, 'Phase 2 target is £5k');
            assert(config.phaseTargets[3] === 7500, 'Phase 3 target is £7.5k');
            assert(config.phaseTargets[4] === 10000, 'Phase 4 target is £10k');
            return true;
        });

        // Test 2: Scaling progression calculation
        this.test('Scaling progression calculation', () => {
            const progression = this.calculator.calculateScalingProgression(35000, 100000);
            
            assert(progression.currentPhase === 1, 'Current phase detected correctly');
            assert(progression.targetPhase === 4, 'Target phase calculated correctly');
            assert(progression.progression.length > 0, 'Progression steps generated');
            
            return true;
        });

        // Test 3: Time to phase estimation
        this.test('Time to phase estimation', () => {
            const timeToPhase2 = this.calculator.estimateTimeToPhase(35000, 40000, 1000);
            assert(timeToPhase2 === 5, 'Time to Phase 2 calculated correctly');
            
            const alreadyThere = this.calculator.estimateTimeToPhase(50000, 40000, 1000);
            assert(alreadyThere === 0, 'No time needed if already at target');
            
            return true;
        });
    }

    /**
     * Test BP utilization safety limits
     */
    async testBPUtilizationSafety() {
        // Test 1: Individual strategy BP limits
        this.test('Individual strategy BP limits enforced', () => {
            const result = this.calculator.calculateMonthlyIncomeRequirements(75000);
            
            // Check individual strategy BP utilization
            assert(result.strategies.dte0.bpUtilization <= 20, '0DTE BP ≤ 20%');
            assert(result.strategies.lt112.bpUtilization <= 30, 'LT112 BP ≤ 30%');
            assert(result.strategies.strangles.bpUtilization <= 25, 'Strangles BP ≤ 25%');
            
            return true;
        });

        // Test 2: Total BP utilization safety
        this.test('Total BP utilization within safety limits', () => {
            const result = this.calculator.calculateMonthlyIncomeRequirements(75000);
            
            assert(result.totals.bpUtilization <= 35, 'Total BP utilization ≤ 35%');
            assert(result.feasibility.bpCompliant === true, 'BP compliance verified');
            
            return true;
        });

        // Test 3: Safety margin application
        this.test('Safety margins properly applied', () => {
            const config = this.calculator.getConfiguration();
            assert(config.safetyMargins.bp === 0.85, 'BP safety margin is 85%');
            assert(config.safetyMargins.target === 0.90, 'Target safety margin is 90%');
            
            // Verify safety margins are applied in calculations
            const result = this.calculator.calculate0DTERequirements(75000, 4000, 1.0);
            const theoreticalMax = 75000 * 0.20; // 20% limit
            const safeMax = theoreticalMax * 0.85; // With safety margin
            assert(result.maxBP <= safeMax, 'Safety margin applied to BP limits');
            
            return true;
        });
    }

    /**
     * Test VIX adjustment mechanisms
     */
    async testVIXAdjustments() {
        // Test 1: VIX adjustment calculation
        this.test('VIX adjustment multipliers correct', () => {
            assert(this.calculator.calculateVixAdjustment(12) === 1.2, 'Low VIX increases positions');
            assert(this.calculator.calculateVixAdjustment(20) === 1.0, 'Normal VIX maintains positions');
            assert(this.calculator.calculateVixAdjustment(40) === 0.8, 'High VIX reduces positions');
            assert(this.calculator.calculateVixAdjustment(60) === 0.6, 'Extreme VIX major reduction');
            
            return true;
        });

        // Test 2: VIX adjustment application
        this.test('VIX adjustments applied to calculations', () => {
            const normalVIX = this.calculator.calculateMonthlyIncomeRequirements(75000, null, 20);
            const highVIX = this.calculator.calculateMonthlyIncomeRequirements(75000, null, 40);
            
            // High VIX should result in fewer contracts needed
            assert(highVIX.strategies.dte0.contractsNeeded < normalVIX.strategies.dte0.contractsNeeded,
                'High VIX reduces 0DTE contracts');
            assert(highVIX.vixMultiplier === 0.8, 'High VIX multiplier applied');
            
            return true;
        });

        // Test 3: Theta engine VIX adjustments
        this.test('Theta engine VIX adjustments', () => {
            const lowVIXOptimization = this.thetaEngine.calculateVixThetaAdjustment(15);
            const highVIXOptimization = this.thetaEngine.calculateVixThetaAdjustment(40);
            
            assert(lowVIXOptimization.multiplier > 1.0, 'Low VIX increases theta targets');
            assert(highVIXOptimization.multiplier < 1.0, 'High VIX reduces theta targets');
            
            return true;
        });
    }

    /**
     * Test theta optimization engine
     */
    async testThetaOptimization() {
        // Test 1: Portfolio theta calculation
        this.test('Portfolio theta calculation', () => {
            const mockPositions = [
                {
                    strategy: '0DTE',
                    greeks: { theta: -15 },
                    quantity: 10,
                    expiration: new Date(Date.now() + 86400000) // Tomorrow
                },
                {
                    strategy: 'LT112',
                    greeks: { theta: -25 },
                    quantity: 5,
                    expiration: new Date(Date.now() + 7 * 86400000) // 1 week
                }
            ];
            
            const analysis = this.thetaEngine.analyzeCurrentThetaPositions(mockPositions);
            
            assert(analysis.totalPositions === 2, 'Position count correct');
            assert(analysis.totalDailyTheta === 275, 'Total theta calculated correctly'); // (15*10) + (25*5)
            
            return true;
        });

        // Test 2: Theta gap calculation
        this.test('Theta gap calculation', () => {
            const currentTheta = {
                byStrategy: {
                    dte0: { dailyTheta: 100 },
                    lt112: { dailyTheta: 150 },
                    strangles: { dailyTheta: 80 }
                },
                totalDailyTheta: 330
            };
            
            const targets = {
                dte0: 150,
                lt112: 200,
                strangles: 120,
                total: 470
            };
            
            const gaps = this.thetaEngine.calculateThetaGaps(currentTheta, targets);
            
            assert(gaps.dte0.gap === 50, '0DTE gap calculated correctly');
            assert(gaps.lt112.gap === 50, 'LT112 gap calculated correctly');
            assert(gaps.total.gap === 140, 'Total gap calculated correctly');
            
            return true;
        });

        // Test 3: Optimization recommendations
        this.test('Optimization recommendations generated', () => {
            const optimization = this.thetaEngine.optimizePortfolioTheta(75000, [], 20);
            
            assert(optimization.recommendations instanceof Array, 'Recommendations is array');
            assert(optimization.optimization.efficiency >= 0, 'Efficiency score calculated');
            assert(optimization.projectedIncome.projectedMonthly >= 0, 'Monthly projection calculated');
            
            return true;
        });
    }

    /**
     * Test system integration
     */
    async testIntegration() {
        // Test 1: Calculator-Theta engine integration
        this.test('Calculator-Theta engine integration', () => {
            const incomeReq = this.calculator.calculateMonthlyIncomeRequirements(75000);
            const thetaOpt = this.thetaEngine.optimizePortfolioTheta(75000, [], 20, 470);
            
            // Both should be consistent in their calculations
            assert(incomeReq.phase === 4, 'Phase 4 for £75k account');
            assert(thetaOpt.adjustedTargets.total > 0, 'Theta targets generated');
            
            return true;
        });

        // Test 2: Performance metrics integration
        this.test('Performance metrics integration', () => {
            const progress = this.performanceMetrics.calculateMonthlyIncomeProgress(75000, [], 20);
            
            assert(progress.current !== undefined, 'Current metrics calculated');
            assert(progress.targets !== undefined, 'Target metrics calculated');
            assert(progress.requirements !== undefined, 'Requirements calculated');
            assert(progress.thetaOptimization !== undefined, 'Theta optimization included');
            
            return true;
        });

        // Test 3: Cross-validation of calculations
        this.test('Cross-validation of calculations', () => {
            const incomeReq = this.calculator.calculateMonthlyIncomeRequirements(75000);
            const monthlyTarget = incomeReq.monthlyTarget;
            const dailyTarget = monthlyTarget / 21;
            
            const thetaOpt = this.thetaEngine.optimizePortfolioTheta(75000, [], 20, dailyTarget);
            
            // Theta optimization should align with income requirements
            const targetTheta = thetaOpt.adjustedTargets.total;
            const projectedIncome = targetTheta * 21;
            
            // Should be within 10% of each other
            const variance = Math.abs(projectedIncome - monthlyTarget) / monthlyTarget;
            assert(variance < 0.10, 'Theta and income calculations align within 10%');
            
            return true;
        });
    }

    /**
     * Test real-world scenarios
     */
    async testRealWorldScenarios() {
        // Test 1: £35k → £80k scenario validation
        this.test('£35k → £80k transformation feasibility', () => {
            // Phase 1: £35k account
            const phase1 = this.calculator.calculateMonthlyIncomeRequirements(35000);
            assert(phase1.phase === 1, 'Phase 1 identified');
            assert(phase1.feasibility.achievable === true, 'Phase 1 achievable');
            
            // Phase 4: £80k account  
            const phase4 = this.calculator.calculateMonthlyIncomeRequirements(80000);
            assert(phase4.phase === 4, 'Phase 4 identified');
            assert(phase4.monthlyTarget === 10000, '£10k monthly target');
            assert(phase4.feasibility.score >= 80, 'Phase 4 feasible with >80% score');
            
            return true;
        });

        // Test 2: Market stress scenario (high VIX)
        this.test('Market stress scenario handling', () => {
            const stressScenario = this.calculator.calculateMonthlyIncomeRequirements(75000, null, 45);
            
            assert(stressScenario.vixMultiplier < 1.0, 'Position sizing reduced in stress');
            assert(stressScenario.feasibility.score >= 70, 'Maintains feasibility in stress');
            
            return true;
        });

        // Test 3: Progression timeline validation
        this.test('8-month progression timeline', () => {
            const progression = this.calculator.calculateScalingProgression(35000, 80000);
            
            // Should be achievable within 8-12 months with consistent performance
            const totalTime = progression.totalTimeEstimate;
            assert(totalTime <= 12, 'Transformation achievable within 12 months');
            
            return true;
        });
    }

    /**
     * Test performance metrics integration
     */
    async testPerformanceMetricsIntegration() {
        // Test 1: Monthly income tracking
        this.test('Monthly income tracking functionality', () => {
            // Mock some monthly P&L data
            this.performanceMetrics.monthlyPL = new Map();
            this.performanceMetrics.monthlyPL.set('2024-01', { totalDollarPL: 2500 });
            this.performanceMetrics.monthlyPL.set('2024-02', { totalDollarPL: 3200 });
            
            const currentIncome = this.performanceMetrics.calculateCurrentMonthIncome();
            assert(currentIncome >= 0, 'Current income calculated');
            
            return true;
        });

        // Test 2: Account value calculation
        this.test('Account value calculation', () => {
            const accountValue = this.performanceMetrics.getCurrentAccountValue();
            assert(accountValue > 0, 'Account value calculated');
            assert(typeof accountValue === 'number', 'Account value is number');
            
            return true;
        });

        // Test 3: Progress calculation
        this.test('Progress calculation comprehensive', () => {
            const progress = this.performanceMetrics.calculateMonthlyIncomeProgress(75000);
            
            assert(progress.current !== undefined, 'Current state calculated');
            assert(progress.targets !== undefined, 'Targets defined');
            assert(progress.progress !== undefined, 'Progress percentages calculated');
            assert(progress.projections !== undefined, 'Projections generated');
            assert(progress.recommendations !== undefined, 'Recommendations provided');
            
            return true;
        });
    }

    /**
     * Test feasibility calculations
     */
    async testFeasibilityCalculations() {
        // Test 1: Feasibility score calculation
        this.test('Feasibility score calculation', () => {
            const result = this.calculator.calculateMonthlyIncomeRequirements(75000);
            const score = result.feasibility.score;
            
            assert(score >= 0 && score <= 100, 'Feasibility score in valid range');
            assert(result.feasibility.achievable === (score >= 80), 'Achievable flag consistent with score');
            
            return true;
        });

        // Test 2: Risk-adjusted feasibility
        this.test('Risk-adjusted feasibility for different account sizes', () => {
            const smallAccount = this.calculator.calculateMonthlyIncomeRequirements(30000);
            const largeAccount = this.calculator.calculateMonthlyIncomeRequirements(100000);
            
            assert(largeAccount.feasibility.score >= smallAccount.feasibility.score,
                'Larger account has higher feasibility');
            
            return true;
        });

        // Test 3: £10k monthly income from £75k validation
        this.test('£10k monthly income from £75k account validation', () => {
            const result = this.calculator.calculateMonthlyIncomeRequirements(75000, 10000);
            
            // CRITICAL VALIDATION: Must be achievable
            assert(result.feasibility.score >= 80, 'Feasibility score ≥ 80%');
            assert(result.feasibility.achievable === true, 'Must be achievable');
            assert(result.totals.bpUtilization <= 35, 'BP utilization within safe limits');
            
            // Validate expected income meets target
            const totalExpectedIncome = result.strategies.dte0.expectedIncome + 
                                       result.strategies.lt112.expectedIncome + 
                                       result.strategies.strangles.expectedIncome;
            
            assert(totalExpectedIncome >= 9000, 'Expected income ≥ £9k (90% of target)');
            assert(totalExpectedIncome <= 12000, 'Expected income ≤ £12k (reasonable upper bound)');
            
            return true;
        });
    }

    /**
     * Helper method to run individual test
     */
    test(testName, testFunction) {
        try {
            const result = testFunction();
            if (result === true) {
                console.log(`✅ ${testName}`);
                this.testResults.passed++;
                this.testResults.details.push({ test: testName, status: 'PASSED' });
            } else {
                throw new Error('Test returned false');
            }
        } catch (error) {
            console.log(`❌ ${testName}: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push({ test: testName, error: error.message });
            this.testResults.details.push({ test: testName, status: 'FAILED', error: error.message });
        }
    }

    /**
     * Record error
     */
    recordError(context, error) {
        console.log(`💥 ${context}: ${error.message}`);
        this.testResults.errors.push({ context, error: error.message });
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n📊 TEST SUMMARY');
        console.log('================');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\n🔍 ERRORS SUMMARY:');
            this.testResults.errors.forEach(error => {
                console.log(`   • ${error.test || error.context}: ${error.error}`);
            });
        }
        
        // CRITICAL SUCCESS CRITERIA
        console.log('\n🎯 CRITICAL SUCCESS CRITERIA:');
        console.log('==============================');
        
        const criticalTests = this.testResults.details.filter(test => 
            test.test.includes('£10k monthly income') || 
            test.test.includes('Tom King win rate') ||
            test.test.includes('BP utilization')
        );
        
        const criticalPassed = criticalTests.filter(test => test.status === 'PASSED').length;
        const criticalTotal = criticalTests.length;
        
        console.log(`Critical Tests Passed: ${criticalPassed}/${criticalTotal}`);
        
        if (criticalPassed === criticalTotal) {
            console.log('🏆 ALL CRITICAL TESTS PASSED - SYSTEM READY FOR DEPLOYMENT');
        } else {
            console.log('⚠️  CRITICAL TESTS FAILED - SYSTEM NOT READY');
        }
    }

    /**
     * Generate detailed feasibility report
     */
    generateFeasibilityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            
            // Test £75k → £10k monthly scenario
            mainScenario: this.calculator.calculateMonthlyIncomeRequirements(75000, 10000),
            
            // Test theta optimization
            thetaOptimization: this.thetaEngine.optimizePortfolioTheta(75000, [], 20, 470),
            
            // Test all phases
            phaseAnalysis: {
                phase1: this.calculator.calculateMonthlyIncomeRequirements(35000),
                phase2: this.calculator.calculateMonthlyIncomeRequirements(50000),
                phase3: this.calculator.calculateMonthlyIncomeRequirements(70000),
                phase4: this.calculator.calculateMonthlyIncomeRequirements(80000)
            },
            
            // Stress testing
            stressTests: {
                lowVIX: this.calculator.calculateMonthlyIncomeRequirements(75000, 10000, 12),
                highVIX: this.calculator.calculateMonthlyIncomeRequirements(75000, 10000, 45),
                smallAccount: this.calculator.calculateMonthlyIncomeRequirements(30000, 10000),
                largeAccount: this.calculator.calculateMonthlyIncomeRequirements(100000, 10000)
            },
            
            testResults: this.testResults
        };
        
        return report;
    }
}

// Export for use in other modules
module.exports = { MonthlyIncomeTestSuite };

// Run tests if called directly
if (require.main === module) {
    (async () => {
        const testSuite = new MonthlyIncomeTestSuite();
        const results = await testSuite.runAllTests();
        
        // Generate and save feasibility report
        const report = testSuite.generateFeasibilityReport();
        
        const fs = require('fs');
        fs.writeFileSync(
            './MONTHLY_INCOME_TEST_RESULTS.json', 
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n💾 Detailed results saved to: MONTHLY_INCOME_TEST_RESULTS.json');
        
        process.exit(results.failed === 0 ? 0 : 1);
    })();
}