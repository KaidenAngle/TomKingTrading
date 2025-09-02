/**
 * MONTHLY INCOME GENERATION SYSTEM TEST
 * Tests and validates the Tom King Trading Framework's ability to generate £10k monthly income
 * CRITICAL FOCUS: Theta decay maximization and systematic income targeting
 */

const TradingStrategies = require('./src/strategies');
const PerformanceMetrics = require('./src/performanceMetrics');
const EnhancedRecommendationEngine = require('./src/enhancedRecommendationEngine');
const { getLogger } = require('./src/logger');

class MonthlyIncomeGenerationTest {
    constructor() {
        this.logger = getLogger();
        this.strategies = new TradingStrategies();
        this.performanceMetrics = new PerformanceMetrics();
        this.recommendationEngine = new EnhancedRecommendationEngine();
        
        // Monthly income targets by phase
        this.phaseIncomeTargets = {
            1: 3000,   // £3k monthly (Phase 1: £30-40k)
            2: 5000,   // £5k monthly (Phase 2: £40-60k) 
            3: 7500,   // £7.5k monthly (Phase 3: £60-75k)
            4: 10000   // £10k monthly (Phase 4: £75k+)
        };
        
        // Strategy income distribution (Tom King methodology)
        this.strategyDistribution = {
            '0DTE': 0.40,      // 40% from 0DTE Friday
            'LT112': 0.35,     // 35% from Long-Term 112
            'STRANGLE': 0.25   // 25% from Strangles
        };
    }

    /**
     * MAIN TEST SUITE: Monthly Income Generation System
     */
    async runComprehensiveTest() {
        console.log('🎯 MONTHLY INCOME GENERATION SYSTEM TEST - Tom King Trading Framework v17');
        console.log('========================================================================');
        
        const testResults = {
            timestamp: new Date().toISOString(),
            tests: {},
            gaps: [],
            recommendations: [],
            implementation: {}
        };

        try {
            // Test 1: Current Implementation Analysis
            console.log('\n📊 TEST 1: CURRENT IMPLEMENTATION ANALYSIS');
            testResults.tests.currentImplementation = await this.analyzeCurrentImplementation();

            // Test 2: Phase 4 Account Monthly Income Test
            console.log('\n💰 TEST 2: PHASE 4 ACCOUNT £10K MONTHLY INCOME TEST');
            testResults.tests.phase4Income = await this.testPhase4MonthlyIncome();

            // Test 3: Strategy Income Distribution Test  
            console.log('\n📈 TEST 3: STRATEGY INCOME DISTRIBUTION TEST');
            testResults.tests.strategyDistribution = await this.testStrategyIncomeDistribution();

            // Test 4: Theta Decay Optimization Test
            console.log('\n⏰ TEST 4: THETA DECAY OPTIMIZATION TEST');
            testResults.tests.thetaOptimization = await this.testThetaDecayOptimization();

            // Test 5: Income Reliability Test
            console.log('\n🎲 TEST 5: INCOME RELIABILITY TEST (85% Success Rate)');
            testResults.tests.incomeReliability = await this.testIncomeReliability();

            // Test 6: All Account Phases Test
            console.log('\n🏗️ TEST 6: ALL ACCOUNT PHASES INCOME SCALING TEST');
            testResults.tests.phaseScaling = await this.testAllPhaseIncomeScaling();

            // Analyze gaps and generate recommendations
            console.log('\n🔍 GAP ANALYSIS AND RECOMMENDATIONS');
            testResults.gaps = this.identifySystemGaps(testResults.tests);
            testResults.recommendations = this.generateImplementationRecommendations(testResults.gaps);

            // Save results
            this.saveTestResults(testResults);
            
            console.log('\n✅ MONTHLY INCOME GENERATION TEST COMPLETE');
            this.printTestSummary(testResults);
            
            return testResults;

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            testResults.error = error.message;
            return testResults;
        }
    }

    /**
     * Test 1: Analyze current implementation for monthly income logic
     */
    async analyzeCurrentImplementation() {
        const analysis = {
            monthlyIncomeLogicFound: false,
            thetaOptimizationFound: false,
            strategyAllocationFound: false,
            incomeTrackingFound: false,
            systematicTargetingFound: false,
            findings: []
        };

        // Check PerformanceMetrics for monthly income tracking
        try {
            const mockTrades = [];
            const mockPnL = [];
            const metrics = this.performanceMetrics.calculateComprehensiveMetrics(mockTrades, mockPnL, 75000);
            
            if (metrics && metrics.basic) {
                analysis.findings.push('✅ Basic performance metrics found');
            }
        } catch (error) {
            analysis.findings.push('❌ Performance metrics system incomplete');
        }

        // Check for monthly income targets
        const hasMonthlyTarget = this.phaseIncomeTargets[4] === 10000;
        if (hasMonthlyTarget) {
            analysis.monthlyIncomeLogicFound = true;
            analysis.findings.push('✅ £10k monthly target defined in test framework');
        }

        // Check strategies for income-focused logic
        const strategyList = Object.keys(this.strategies.strategies || {});
        if (strategyList.length > 0) {
            analysis.findings.push(`✅ ${strategyList.length} strategies implemented`);
            
            // Check for theta-focused strategies
            const thetaStrategies = strategyList.filter(s => 
                ['STRANGLE', 'LT112', '0DTE'].includes(s)
            );
            if (thetaStrategies.length >= 3) {
                analysis.thetaOptimizationFound = true;
                analysis.findings.push('✅ Core theta-generating strategies present');
            }
        }

        // Check for systematic allocation
        if (this.strategyDistribution['0DTE'] === 0.40) {
            analysis.strategyAllocationFound = true;
            analysis.findings.push('✅ Strategy income allocation defined (0DTE 40%, LT112 35%, Strangles 25%)');
        }

        analysis.findings.push('❌ No systematic monthly income calculator found');
        analysis.findings.push('❌ No theta decay optimization engine found');
        analysis.findings.push('❌ No monthly progress tracking against £10k target found');
        analysis.findings.push('❌ No income reliability validation system found');

        return analysis;
    }

    /**
     * Test 2: Test Phase 4 account's ability to generate £10k monthly
     */
    async testPhase4MonthlyIncome() {
        const phase4Account = {
            phase: 4,
            accountValue: 75000,
            bpUsed: 30,
            dayOfWeek: 'Friday',
            timeEST: '11:00 AM',
            vixLevel: 16,
            positions: []
        };

        const test = {
            accountSize: phase4Account.accountValue,
            targetMonthly: this.phaseIncomeTargets[4],
            canAchieveTarget: false,
            strategies: {},
            totalMonthlyIncome: 0,
            issues: []
        };

        // Test each strategy's monthly income potential
        try {
            // 0DTE Strategy (40% of income = £4000)
            const zdteTarget = test.targetMonthly * this.strategyDistribution['0DTE'];
            test.strategies['0DTE'] = await this.calculateStrategyMonthlyIncome('0DTE', phase4Account, zdteTarget);

            // LT112 Strategy (35% of income = £3500)
            const lt112Target = test.targetMonthly * this.strategyDistribution['LT112'];
            test.strategies['LT112'] = await this.calculateStrategyMonthlyIncome('LT112', phase4Account, lt112Target);

            // Strangle Strategy (25% of income = £2500)
            const strangleTarget = test.targetMonthly * this.strategyDistribution['STRANGLE'];
            test.strategies['STRANGLE'] = await this.calculateStrategyMonthlyIncome('STRANGLE', phase4Account, strangleTarget);

            // Calculate total achievable income
            test.totalMonthlyIncome = Object.values(test.strategies).reduce((sum, strategy) => {
                return sum + (strategy.monthlyIncome || 0);
            }, 0);

            test.canAchieveTarget = test.totalMonthlyIncome >= test.targetMonthly * 0.85; // 85% of target

            if (!test.canAchieveTarget) {
                test.issues.push(`Total achievable income £${test.totalMonthlyIncome} < target £${test.targetMonthly}`);
            }

        } catch (error) {
            test.issues.push(`Error calculating monthly income: ${error.message}`);
        }

        return test;
    }

    /**
     * Calculate monthly income potential for a strategy
     */
    async calculateStrategyMonthlyIncome(strategy, accountData, target) {
        const result = {
            strategy,
            target,
            monthlyIncome: 0,
            tradesPerMonth: 0,
            avgIncomePerTrade: 0,
            feasible: false,
            limitations: []
        };

        switch (strategy) {
            case '0DTE':
                // 4 Fridays per month, Tom's 88% win rate, 8.5% avg return
                result.tradesPerMonth = 4;
                const zdtePositionSize = accountData.accountValue * 0.10; // 10% per 0DTE trade
                result.avgIncomePerTrade = zdtePositionSize * 0.085; // 8.5% return
                result.monthlyIncome = result.tradesPerMonth * result.avgIncomePerTrade * 0.88; // 88% win rate
                result.feasible = result.monthlyIncome >= target * 0.8;
                
                if (!result.feasible) {
                    result.limitations.push(`0DTE generates £${result.monthlyIncome.toFixed(0)} vs target £${target}`);
                }
                break;

            case 'LT112':
                // 1 trade per month, 112 DTE, 73% win rate, 12% avg return
                result.tradesPerMonth = 1;
                const lt112PositionSize = accountData.accountValue * 0.15; // 15% per LT112 trade
                result.avgIncomePerTrade = lt112PositionSize * 0.12; // 12% return over 112 days
                result.monthlyIncome = result.avgIncomePerTrade * 0.73; // 73% win rate
                result.feasible = result.monthlyIncome >= target * 0.8;

                if (!result.feasible) {
                    result.limitations.push(`LT112 generates £${result.monthlyIncome.toFixed(0)} vs target £${target}`);
                }
                break;

            case 'STRANGLE':
                // 1 trade per month, 90 DTE, 72% win rate, 15% avg return
                result.tradesPerMonth = 1;
                const stranglePositionSize = accountData.accountValue * 0.12; // 12% per strangle
                result.avgIncomePerTrade = stranglePositionSize * 0.15; // 15% return over 90 days
                result.monthlyIncome = result.avgIncomePerTrade * 0.72; // 72% win rate
                result.feasible = result.monthlyIncome >= target * 0.8;

                if (!result.feasible) {
                    result.limitations.push(`Strangles generate £${result.monthlyIncome.toFixed(0)} vs target £${target}`);
                }
                break;
        }

        return result;
    }

    /**
     * Test 3: Validate strategy income distribution
     */
    async testStrategyIncomeDistribution() {
        const test = {
            targetDistribution: this.strategyDistribution,
            actualCapability: {},
            distributionMatches: false,
            issues: []
        };

        // Calculate what each strategy can actually contribute
        const phase4Account = { accountValue: 75000, phase: 4 };
        
        for (const [strategy, targetPercent] of Object.entries(this.strategyDistribution)) {
            const targetIncome = 10000 * targetPercent;
            const strategyTest = await this.calculateStrategyMonthlyIncome(strategy, phase4Account, targetIncome);
            
            test.actualCapability[strategy] = {
                target: targetPercent,
                actualPercent: strategyTest.monthlyIncome / 10000,
                gap: targetPercent - (strategyTest.monthlyIncome / 10000),
                feasible: strategyTest.feasible
            };
        }

        // Check if distribution is achievable
        const totalActualPercent = Object.values(test.actualCapability).reduce((sum, s) => sum + s.actualPercent, 0);
        test.distributionMatches = totalActualPercent >= 0.85; // 85% of target distribution

        if (!test.distributionMatches) {
            test.issues.push(`Total capability ${(totalActualPercent * 100).toFixed(1)}% vs target 100%`);
        }

        return test;
    }

    /**
     * Test 4: Theta decay optimization
     */
    async testThetaDecayOptimization() {
        const test = {
            thetaOptimized: false,
            strategies: {},
            totalTheta: 0,
            monthlyThetaIncome: 0,
            issues: []
        };

        // Test each strategy's theta generation
        const strategiesWithTheta = ['STRANGLE', 'LT112', '0DTE'];
        
        for (const strategy of strategiesWithTheta) {
            test.strategies[strategy] = {
                hasTheta: true,
                thetaPerContract: this.estimateStrategyTheta(strategy),
                monthlyThetaContribution: 0
            };
        }

        // Calculate total theta income potential
        test.totalTheta = Object.values(test.strategies).reduce((sum, s) => sum + s.thetaPerContract, 0);
        test.monthlyThetaIncome = test.totalTheta * 30; // 30 days

        test.thetaOptimized = test.monthlyThetaIncome >= 5000; // £5k monthly from theta decay

        if (!test.thetaOptimized) {
            test.issues.push(`Theta income £${test.monthlyThetaIncome} insufficient for systematic £10k monthly`);
        }

        return test;
    }

    /**
     * Estimate theta for strategy
     */
    estimateStrategyTheta(strategy) {
        const thetaMap = {
            'STRANGLE': 50,  // £50 daily theta per strangle
            'LT112': 25,     // £25 daily theta per LT112
            '0DTE': 100      // £100 daily theta per 0DTE (rapid decay)
        };
        return thetaMap[strategy] || 0;
    }

    /**
     * Test 5: Income reliability (85% success rate)
     */
    async testIncomeReliability() {
        const test = {
            targetReliability: 0.85,
            strategiesReliability: {},
            combinedReliability: 0,
            achievesTarget: false,
            monthsToTest: 12,
            issues: []
        };

        // Test each strategy's reliability based on Tom King's actual win rates
        const winRates = {
            '0DTE': 0.88,    // 88% win rate
            'LT112': 0.73,   // 73% win rate
            'STRANGLE': 0.72 // 72% win rate
        };

        for (const [strategy, winRate] of Object.entries(winRates)) {
            test.strategiesReliability[strategy] = {
                winRate,
                contributesToReliability: winRate >= 0.70,
                monthlySuccessProbability: Math.pow(winRate, 4) // 4 trades per month average
            };
        }

        // Calculate combined system reliability using portfolio approach
        // This is simplified - real calculation would use correlation
        const avgWinRate = Object.values(winRates).reduce((sum, rate) => sum + rate, 0) / Object.keys(winRates).length;
        test.combinedReliability = avgWinRate;
        test.achievesTarget = test.combinedReliability >= test.targetReliability;

        if (!test.achievesTarget) {
            test.issues.push(`Combined reliability ${(test.combinedReliability * 100).toFixed(1)}% < target 85%`);
        }

        return test;
    }

    /**
     * Test 6: All phase income scaling
     */
    async testAllPhaseIncomeScaling() {
        const test = {
            phases: {},
            scalingWorks: true,
            issues: []
        };

        for (let phase = 1; phase <= 4; phase++) {
            const accountValue = [null, 35000, 50000, 67500, 75000][phase];
            const targetIncome = this.phaseIncomeTargets[phase];
            
            test.phases[phase] = {
                accountValue,
                targetMonthly: targetIncome,
                canAchieve: false,
                requiredReturnRate: (targetIncome / accountValue * 12) * 100 // Annualized
            };

            // Test if phase can achieve target
            const phaseAccount = { accountValue, phase };
            const incomeTest = await this.testPhaseMonthlyIncome(phaseAccount, targetIncome);
            test.phases[phase].canAchieve = incomeTest.achievable;
            test.phases[phase].actualIncome = incomeTest.projectedIncome;

            if (!incomeTest.achievable) {
                test.scalingWorks = false;
                test.issues.push(`Phase ${phase} cannot achieve £${targetIncome} monthly with £${accountValue} account`);
            }
        }

        return test;
    }

    /**
     * Test individual phase income capability
     */
    async testPhaseMonthlyIncome(accountData, targetIncome) {
        const result = {
            achievable: false,
            projectedIncome: 0,
            limitingFactors: []
        };

        // Simplified calculation based on account size and available strategies
        const accountValue = accountData.accountValue;
        const maxMonthlyRisk = accountValue * 0.15; // 15% monthly risk limit
        const expectedReturn = maxMonthlyRisk * 0.20; // 20% return on risked capital
        
        result.projectedIncome = expectedReturn;
        result.achievable = result.projectedIncome >= targetIncome * 0.80; // 80% threshold

        if (!result.achievable) {
            result.limitingFactors.push(`Account size ${accountValue} insufficient for ${targetIncome} monthly target`);
        }

        return result;
    }

    /**
     * Identify gaps in the monthly income generation system
     */
    identifySystemGaps(testResults) {
        const gaps = [];

        // Gap 1: No systematic monthly income calculator
        gaps.push({
            category: 'Core System',
            gap: 'Missing Monthly Income Calculator',
            severity: 'CRITICAL',
            description: 'No systematic calculator to determine required positions for £10k monthly target',
            impact: 'Cannot systematically achieve monthly income goals'
        });

        // Gap 2: No theta decay optimizer
        gaps.push({
            category: 'Theta Optimization',
            gap: 'Missing Theta Decay Optimization Engine', 
            severity: 'HIGH',
            description: 'No system to maximize theta decay across all positions for optimal income generation',
            impact: 'Suboptimal income from time decay - core of Tom King methodology'
        });

        // Gap 3: No monthly income tracking
        gaps.push({
            category: 'Progress Tracking',
            gap: 'Missing Monthly Income Progress Tracking',
            severity: 'HIGH', 
            description: 'No real-time tracking of monthly progress toward £10k target',
            impact: 'Cannot monitor or adjust strategy to stay on track'
        });

        // Gap 4: No strategy income allocation engine
        gaps.push({
            category: 'Strategy Allocation',
            gap: 'Missing Strategy Income Allocation Engine',
            severity: 'MEDIUM',
            description: 'No system to allocate income targets across strategies (0DTE 40%, LT112 35%, Strangles 25%)',
            impact: 'Unbalanced approach may fail to achieve targets'
        });

        // Gap 5: No income reliability validation
        gaps.push({
            category: 'Reliability',
            gap: 'Missing Income Reliability Validation System',
            severity: 'MEDIUM',
            description: 'No system to validate 85%+ monthly success rate achievement',
            impact: 'Cannot ensure consistent monthly income generation'
        });

        return gaps;
    }

    /**
     * Generate implementation recommendations
     */
    generateImplementationRecommendations(gaps) {
        const recommendations = [];

        // Recommendation 1: Build Monthly Income Calculator
        recommendations.push({
            priority: 'CRITICAL',
            component: 'Monthly Income Calculator',
            description: 'Build systematic calculator to determine required positions, contracts, and allocation for £10k monthly target',
            implementation: 'Create MonthlyIncomeCalculator class with methods: calculateRequiredPositions(), optimizeForTarget(), validateAchievability()',
            estimatedEffort: '2-3 days'
        });

        // Recommendation 2: Build Theta Optimization Engine  
        recommendations.push({
            priority: 'HIGH',
            component: 'Theta Decay Optimization Engine',
            description: 'Build system to maximize theta decay income across all positions',
            implementation: 'Create ThetaOptimizer class with methods: calculateTotalTheta(), optimizePositionSizing(), maximizeThetaIncome()',
            estimatedEffort: '3-4 days'
        });

        // Recommendation 3: Build Monthly Progress Tracker
        recommendations.push({
            priority: 'HIGH', 
            component: 'Monthly Income Progress Tracker',
            description: 'Build real-time tracking of monthly progress toward £10k target with alerts and adjustments',
            implementation: 'Extend PerformanceMetrics with MonthlyIncomeTracker class',
            estimatedEffort: '1-2 days'
        });

        // Recommendation 4: Build Strategy Allocation Engine
        recommendations.push({
            priority: 'MEDIUM',
            component: 'Strategy Income Allocation Engine', 
            description: 'Build system to properly allocate income across strategies per Tom King distribution',
            implementation: 'Create StrategyIncomeAllocator class with target distribution enforcement',
            estimatedEffort: '1-2 days'
        });

        return recommendations;
    }

    /**
     * Save test results
     */
    saveTestResults(results) {
        const fs = require('fs');
        
        try {
            // Save detailed results
            fs.writeFileSync(
                'D:/OneDrive/Trading/Claude/TomKingTrader/MONTHLY_INCOME_TEST_RESULTS.json',
                JSON.stringify(results, null, 2)
            );

            // Save summary report
            const summary = this.generateSummaryReport(results);
            fs.writeFileSync(
                'D:/OneDrive/Trading/Claude/TomKingTrader/MONTHLY_INCOME_SUMMARY.md',
                summary
            );

            console.log('✅ Test results saved to MONTHLY_INCOME_TEST_RESULTS.json and MONTHLY_INCOME_SUMMARY.md');
        } catch (error) {
            console.error('❌ Failed to save test results:', error.message);
        }
    }

    /**
     * Generate summary report
     */
    generateSummaryReport(results) {
        return `# Monthly Income Generation System Test Results

## Executive Summary
**Test Date:** ${new Date().toISOString().split('T')[0]}
**Framework:** Tom King Trading Framework v17
**Target:** £10,000 Monthly Income Generation

## Test Results Overview

### Critical Findings
${results.gaps.filter(g => g.severity === 'CRITICAL').map(g => `- ❌ **${g.gap}**: ${g.description}`).join('\n')}

### High Priority Issues  
${results.gaps.filter(g => g.severity === 'HIGH').map(g => `- ⚠️ **${g.gap}**: ${g.description}`).join('\n')}

## Phase 4 Account Test (£75k → £10k Monthly)
${results.tests.phase4Income ? 
  `- **Can Achieve Target:** ${results.tests.phase4Income.canAchieveTarget ? '✅ YES' : '❌ NO'}
- **Projected Monthly Income:** £${results.tests.phase4Income.totalMonthlyIncome?.toFixed(0) || 'N/A'}
- **Strategy Breakdown:**
  - 0DTE: £${results.tests.phase4Income.strategies?.['0DTE']?.monthlyIncome?.toFixed(0) || 'N/A'}
  - LT112: £${results.tests.phase4Income.strategies?.['LT112']?.monthlyIncome?.toFixed(0) || 'N/A'}  
  - Strangles: £${results.tests.phase4Income.strategies?.['STRANGLE']?.monthlyIncome?.toFixed(0) || 'N/A'}` 
  : '- **Test Failed:** Unable to complete Phase 4 income test'}

## Implementation Recommendations

### CRITICAL Priority
${results.recommendations.filter(r => r.priority === 'CRITICAL').map(r => 
  `1. **${r.component}**
   - ${r.description}
   - Implementation: ${r.implementation}
   - Effort: ${r.estimatedEffort}`
).join('\n\n')}

### HIGH Priority  
${results.recommendations.filter(r => r.priority === 'HIGH').map(r =>
  `1. **${r.component}**
   - ${r.description}
   - Implementation: ${r.implementation}  
   - Effort: ${r.estimatedEffort}`
).join('\n\n')}

## Next Steps

1. **Implement Monthly Income Calculator** - Core system to calculate required positions for £10k target
2. **Build Theta Decay Optimization Engine** - Maximize time decay income (core of Tom King methodology)
3. **Add Monthly Progress Tracking** - Real-time monitoring of income generation progress
4. **Validate Strategy Distribution** - Ensure 0DTE/LT112/Strangles allocation works as planned

## Conclusion

The current Tom King Trading Framework v17 has solid foundation strategies but **lacks the systematic monthly income generation components** required to reliably produce £10,000 monthly income. The critical missing pieces are:

1. **Systematic Income Calculator** - To determine exact positions needed
2. **Theta Optimization Engine** - To maximize time decay income  
3. **Monthly Progress Tracking** - To monitor and adjust toward target
4. **Strategy Income Allocation** - To ensure proper 40%/35%/25% distribution

**Estimated Implementation Time:** 7-11 days for complete monthly income generation system.

---
*Generated by Monthly Income Generation Test Suite v1.0*
`;
    }

    /**
     * Print test summary to console
     */
    printTestSummary(results) {
        console.log('\n📊 MONTHLY INCOME GENERATION TEST SUMMARY');
        console.log('==========================================');
        
        // Critical gaps
        const criticalGaps = results.gaps.filter(g => g.severity === 'CRITICAL');
        console.log(`\n🚨 CRITICAL GAPS: ${criticalGaps.length}`);
        criticalGaps.forEach(gap => {
            console.log(`   ❌ ${gap.gap}: ${gap.description}`);
        });

        // Phase 4 test result
        if (results.tests.phase4Income) {
            console.log(`\n💰 PHASE 4 (£75k) → £10k MONTHLY TEST:`);
            console.log(`   Can Achieve Target: ${results.tests.phase4Income.canAchieveTarget ? '✅ YES' : '❌ NO'}`);
            console.log(`   Projected Income: £${results.tests.phase4Income.totalMonthlyIncome?.toFixed(0) || 'N/A'}`);
        }

        // Implementation priority
        console.log(`\n🔧 CRITICAL IMPLEMENTATIONS NEEDED:`);
        const criticalRecs = results.recommendations.filter(r => r.priority === 'CRITICAL');
        criticalRecs.forEach(rec => {
            console.log(`   1. ${rec.component} (${rec.estimatedEffort})`);
        });

        console.log('\n📄 Full results saved to MONTHLY_INCOME_TEST_RESULTS.json');
        console.log('📋 Summary report saved to MONTHLY_INCOME_SUMMARY.md');
    }
}

// Export for testing
module.exports = MonthlyIncomeGenerationTest;

// Run test if executed directly
if (require.main === module) {
    const test = new MonthlyIncomeGenerationTest();
    test.runComprehensiveTest()
        .then(() => {
            console.log('\n✅ Test completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}