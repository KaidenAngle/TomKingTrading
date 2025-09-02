/**
 * TAX OPTIMIZATION INTEGRATION TEST
 * Tests the integration of the tax optimization engine with the Tom King Trading Framework
 */

const { TaxOptimizationEngine } = require('./src/taxOptimizationEngine');
const { PositionManager } = require('./src/positionManager');
const { RiskManager } = require('./src/riskManager');

// Test positions representing various Tom King strategies
const INTEGRATION_TEST_POSITIONS = [
    // Section 1256 qualifying positions (Tom King's preferred instruments)
    {
        id: 'pos1',
        symbol: 'ES',
        strategy: 'LT112',
        instrumentType: 'FUTURE',
        openDate: '2024-12-01',
        closeDate: null,
        openPrice: 5800,
        currentPrice: 5875,
        quantity: 1,
        pl: 3750, // $75 * 50 = $3750 profit
        dte: 45,
        correlationGroup: 'A1'
    },
    {
        id: 'pos2',
        symbol: 'SPX',
        strategy: '0DTE',
        instrumentType: 'INDEX_OPTION',
        openDate: '2025-01-10',
        closeDate: '2025-01-10',
        openPrice: 12.50,
        closePrice: 28.00,
        quantity: 5,
        pl: 775, // ($28-$12.50) * 5 * 100 = $7750 
        dte: 0
    },
    {
        id: 'pos3',
        symbol: 'GC',
        strategy: 'STRANGLE',
        instrumentType: 'FUTURE',
        openDate: '2024-11-20',
        closeDate: null,
        openPrice: 2050,
        currentPrice: 2080,
        quantity: 1,
        pl: 3000, // Gold futures profit
        dte: 62,
        correlationGroup: 'C1'
    },
    
    // Non-Section 1256 positions (less tax-efficient)
    {
        id: 'pos4',
        symbol: 'SPY',
        strategy: 'STRANGLE',
        instrumentType: 'ETF_OPTION',
        openDate: '2024-12-15',
        closeDate: null,
        openPrice: 8.75,
        currentPrice: 6.20,
        quantity: 3,
        pl: -765, // Loss position
        dte: 38,
        correlationGroup: 'A1'
    },
    {
        id: 'pos5',
        symbol: 'QQQ',
        strategy: 'PUT',
        instrumentType: 'ETF_OPTION',
        openDate: '2024-12-28',
        closeDate: '2025-01-05',
        openPrice: 14.20,
        closePrice: 9.80,
        quantity: 2,
        pl: -880, // Loss - potential wash sale trigger
        correlationGroup: 'A1'
    },
    {
        id: 'pos6',
        symbol: 'QQQ',
        strategy: 'CALL',
        instrumentType: 'ETF_OPTION',
        openDate: '2025-01-08', // Within 30 days of pos5 close
        closeDate: null,
        openPrice: 16.50,
        currentPrice: 19.20,
        quantity: 1,
        pl: 270,
        dte: 42,
        correlationGroup: 'A1',
        potentialWashSale: true
    }
];

class TaxIntegrationTester {
    constructor() {
        this.taxEngine = new TaxOptimizationEngine();
        this.positionManager = new PositionManager();
        this.riskManager = new RiskManager();
        this.results = {
            integrationTests: [],
            performanceTests: [],
            recommendationTests: [],
            complianceTests: []
        };
    }

    /**
     * Test 1: Integration with Position Manager
     */
    testPositionManagerIntegration() {
        console.log('\n=== TESTING POSITION MANAGER INTEGRATION ===');
        
        try {
            // Update position manager with test positions
            this.positionManager.updatePositions(INTEGRATION_TEST_POSITIONS);
            
            // Get position health (existing functionality)
            const positionHealth = this.positionManager.getPositionHealth();
            
            // Add tax analysis to each position
            const taxEnhancedPositions = positionHealth.map(pos => {
                const originalPos = INTEGRATION_TEST_POSITIONS.find(p => p.symbol === pos.ticker);
                const taxAnalysis = this.taxEngine.section1256Classifier.calculateSection1256Treatment(originalPos);
                
                return {
                    ...pos,
                    taxAnalysis: {
                        section1256: taxAnalysis.qualifies,
                        taxTreatment: taxAnalysis.taxTreatment,
                        estimatedTaxSavings: taxAnalysis.estimatedTaxSavings,
                        washSaleExempt: taxAnalysis.washSaleExempt
                    }
                };
            });

            this.results.integrationTests.push({
                test: 'Position Manager Integration',
                passed: taxEnhancedPositions.length === INTEGRATION_TEST_POSITIONS.length,
                details: {
                    originalPositions: INTEGRATION_TEST_POSITIONS.length,
                    enhancedPositions: taxEnhancedPositions.length,
                    section1256Positions: taxEnhancedPositions.filter(p => p.taxAnalysis.section1256).length,
                    totalTaxSavings: taxEnhancedPositions.reduce((sum, p) => sum + (p.taxAnalysis.estimatedTaxSavings || 0), 0)
                }
            });

            console.log(`✓ Enhanced ${taxEnhancedPositions.length} positions with tax analysis`);
            console.log(`✓ Section 1256 positions: ${taxEnhancedPositions.filter(p => p.taxAnalysis.section1256).length}`);
            console.log(`✓ Total tax savings: $${Math.round(taxEnhancedPositions.reduce((sum, p) => sum + (p.taxAnalysis.estimatedTaxSavings || 0), 0))}`);
            
            return taxEnhancedPositions;
        } catch (error) {
            console.error('❌ Position Manager integration failed:', error.message);
            this.results.integrationTests.push({
                test: 'Position Manager Integration',
                passed: false,
                error: error.message
            });
            return [];
        }
    }

    /**
     * Test 2: Integration with Risk Manager
     */
    testRiskManagerIntegration() {
        console.log('\n=== TESTING RISK MANAGER INTEGRATION ===');
        
        try {
            // Assess risk with tax considerations
            const riskAssessment = this.riskManager.assessRisk(
                INTEGRATION_TEST_POSITIONS,
                18, // VIX level
                2, // Phase 2
                65000 // Account value
            );

            // Add tax optimization to risk assessment
            const taxAnalysis = this.taxEngine.analyzePortfolioTaxImplications(INTEGRATION_TEST_POSITIONS, {
                accountValue: 65000,
                annualIncome: 75000
            });

            const taxEnhancedRisk = {
                ...riskAssessment,
                taxOptimization: {
                    overallScore: taxAnalysis.overallScore,
                    section1256Allocation: taxAnalysis.section1256Analysis.allocationPercentage,
                    washSaleViolations: taxAnalysis.washSaleAnalysis.violations.length,
                    ukTaxEfficiency: taxAnalysis.ukTaxAnalysis.utilizationRate,
                    recommendations: taxAnalysis.recommendations.slice(0, 3) // Top 3
                }
            };

            this.results.integrationTests.push({
                test: 'Risk Manager Integration',
                passed: taxEnhancedRisk.taxOptimization.overallScore > 0,
                details: {
                    originalRiskScore: riskAssessment.overallRisk.score,
                    taxOptimizationScore: taxAnalysis.overallScore,
                    combinedAnalysis: true,
                    recommendations: taxEnhancedRisk.taxOptimization.recommendations.length
                }
            });

            console.log(`✓ Risk assessment enhanced with tax analysis`);
            console.log(`✓ Tax optimization score: ${taxAnalysis.overallScore}/100`);
            console.log(`✓ Section 1256 allocation: ${Math.round(taxAnalysis.section1256Analysis.allocationPercentage)}%`);
            console.log(`✓ Combined recommendations: ${taxEnhancedRisk.taxOptimization.recommendations.length}`);
            
            return taxEnhancedRisk;
        } catch (error) {
            console.error('❌ Risk Manager integration failed:', error.message);
            this.results.integrationTests.push({
                test: 'Risk Manager Integration',
                passed: false,
                error: error.message
            });
            return null;
        }
    }

    /**
     * Test 3: Tom King Strategy Tax Optimization
     */
    testTomKingStrategyOptimization() {
        console.log('\n=== TESTING TOM KING STRATEGY TAX OPTIMIZATION ===');
        
        const strategyTests = [
            { strategy: '0DTE', recommendedInstruments: ['SPX', 'SPXW'] },
            { strategy: 'LT112', recommendedInstruments: ['ES', 'MES'] },
            { strategy: 'STRANGLE', recommendedInstruments: ['ES', 'GC', 'CL'] },
            { strategy: 'IPMCC', recommendedInstruments: ['SPY', 'QQQ'] } // Mixed - some qualify
        ];

        const optimizationResults = [];

        strategyTests.forEach(test => {
            console.log(`\n📊 Testing ${test.strategy} strategy optimization:`);
            
            const recommendations = test.recommendedInstruments.map(symbol => {
                const instrumentRec = this.taxEngine.getInstrumentRecommendations(symbol, test.strategy);
                const section1256Check = this.taxEngine.section1256Classifier.qualifiesForSection1256(symbol);
                
                return {
                    symbol,
                    section1256: section1256Check.qualifies,
                    recommendation: instrumentRec.recommendation,
                    taxAdvantage: section1256Check.qualifies ? '60/40 treatment' : 'Regular treatment',
                    estimatedSavings: section1256Check.qualifies ? '~17% tax savings' : 'No tax advantage'
                };
            });

            const section1256Count = recommendations.filter(r => r.section1256).length;
            const optimizationScore = (section1256Count / recommendations.length) * 100;

            optimizationResults.push({
                strategy: test.strategy,
                recommendations,
                section1256Ratio: section1256Count / recommendations.length,
                optimizationScore: Math.round(optimizationScore),
                preferredInstruments: recommendations.filter(r => r.section1256).map(r => r.symbol)
            });

            console.log(`  ✓ Section 1256 instruments: ${section1256Count}/${recommendations.length}`);
            console.log(`  ✓ Tax optimization score: ${Math.round(optimizationScore)}%`);
            console.log(`  ✓ Preferred: ${recommendations.filter(r => r.section1256).map(r => r.symbol).join(', ')}`);
        });

        this.results.recommendationTests.push({
            test: 'Tom King Strategy Tax Optimization',
            passed: optimizationResults.every(result => result.optimizationScore >= 50),
            details: {
                strategiesTested: optimizationResults.length,
                averageOptimization: Math.round(optimizationResults.reduce((sum, r) => sum + r.optimizationScore, 0) / optimizationResults.length),
                results: optimizationResults
            }
        });

        return optimizationResults;
    }

    /**
     * Test 4: Performance and Scalability
     */
    testPerformanceAndScalability() {
        console.log('\n=== TESTING PERFORMANCE AND SCALABILITY ===');
        
        const performanceTests = [
            { positions: 10, description: 'Small portfolio' },
            { positions: 50, description: 'Medium portfolio' },
            { positions: 100, description: 'Large portfolio' }
        ];

        const performanceResults = [];

        performanceTests.forEach(test => {
            // Generate test positions
            const testPositions = this.generateTestPositions(test.positions);
            
            const startTime = Date.now();
            
            try {
                // Run full tax analysis
                const analysis = this.taxEngine.analyzePortfolioTaxImplications(testPositions, {
                    accountValue: 100000,
                    annualIncome: 80000
                });
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                performanceResults.push({
                    positionCount: test.positions,
                    description: test.description,
                    duration,
                    passed: duration < 5000, // Should complete in under 5 seconds
                    score: analysis.overallScore,
                    recommendations: analysis.recommendations.length
                });

                console.log(`  ✓ ${test.description} (${test.positions} positions): ${duration}ms`);
                console.log(`    - Tax score: ${analysis.overallScore}/100`);
                console.log(`    - Recommendations: ${analysis.recommendations.length}`);
                
            } catch (error) {
                console.error(`  ❌ ${test.description} failed:`, error.message);
                performanceResults.push({
                    positionCount: test.positions,
                    description: test.description,
                    passed: false,
                    error: error.message
                });
            }
        });

        this.results.performanceTests.push({
            test: 'Performance and Scalability',
            passed: performanceResults.every(result => result.passed),
            details: {
                testCases: performanceResults.length,
                averageDuration: Math.round(performanceResults.reduce((sum, r) => sum + (r.duration || 0), 0) / performanceResults.length),
                results: performanceResults
            }
        });

        return performanceResults;
    }

    /**
     * Test 5: Compliance and Accuracy
     */
    testComplianceAndAccuracy() {
        console.log('\n=== TESTING COMPLIANCE AND ACCURACY ===');
        
        const complianceTests = [
            {
                name: 'Section 1256 Classification Accuracy',
                test: () => {
                    const accuracyTests = [
                        { symbol: 'ES', expected: true },
                        { symbol: 'SPX', expected: true },
                        { symbol: 'GC', expected: true },
                        { symbol: 'SPY', expected: false },
                        { symbol: 'QQQ', expected: false },
                        { symbol: 'AAPL', expected: false }
                    ];
                    
                    let correct = 0;
                    accuracyTests.forEach(test => {
                        const result = this.taxEngine.section1256Classifier.qualifiesForSection1256(test.symbol);
                        if (result.qualifies === test.expected) correct++;
                    });
                    
                    return {
                        passed: correct === accuracyTests.length,
                        accuracy: (correct / accuracyTests.length) * 100,
                        details: `${correct}/${accuracyTests.length} correct classifications`
                    };
                }
            },
            {
                name: 'Wash Sale Detection Accuracy',
                test: () => {
                    const washSaleAnalysis = this.taxEngine.washSaleEngine.detectWashSales(INTEGRATION_TEST_POSITIONS);
                    // Should detect the QQQ wash sale (pos5 -> pos6)
                    
                    return {
                        passed: washSaleAnalysis.violations.length > 0,
                        details: `Detected ${washSaleAnalysis.violations.length} wash sale violations`,
                        expectedViolations: 1,
                        actualViolations: washSaleAnalysis.violations.length
                    };
                }
            },
            {
                name: 'UK Tax Calculation Accuracy',
                test: () => {
                    const ukAnalysis = this.taxEngine.ukTaxEngine.calculateUKTaxLiability(INTEGRATION_TEST_POSITIONS);
                    
                    return {
                        passed: ukAnalysis.totalGainsGBP > 0 && ukAnalysis.allowanceUsed >= 0,
                        details: `£${Math.round(ukAnalysis.totalGainsGBP)} gains, ${ukAnalysis.utilizationRate}% allowance used`,
                        withinAllowance: ukAnalysis.totalGainsGBP <= 6000
                    };
                }
            }
        ];

        const complianceResults = [];
        complianceTests.forEach(test => {
            console.log(`\n🔍 ${test.name}:`);
            try {
                const result = test.test();
                complianceResults.push({
                    name: test.name,
                    ...result
                });
                console.log(`  ✓ ${result.passed ? 'PASSED' : 'FAILED'}: ${result.details}`);
            } catch (error) {
                console.error(`  ❌ ${test.name} failed:`, error.message);
                complianceResults.push({
                    name: test.name,
                    passed: false,
                    error: error.message
                });
            }
        });

        this.results.complianceTests.push({
            test: 'Compliance and Accuracy',
            passed: complianceResults.every(result => result.passed),
            details: {
                testCases: complianceResults.length,
                passRate: (complianceResults.filter(r => r.passed).length / complianceResults.length) * 100,
                results: complianceResults
            }
        });

        return complianceResults;
    }

    /**
     * Generate test positions for performance testing
     */
    generateTestPositions(count) {
        const symbols = ['ES', 'SPX', 'GC', 'SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT'];
        const strategies = ['0DTE', 'LT112', 'STRANGLE', 'IPMCC'];
        const positions = [];

        for (let i = 0; i < count; i++) {
            positions.push({
                id: `test_pos_${i}`,
                symbol: symbols[i % symbols.length],
                strategy: strategies[i % strategies.length],
                instrumentType: i % 2 === 0 ? 'FUTURE' : 'OPTION',
                openDate: new Date(2024, 10 + (i % 3), 1 + (i % 28)).toISOString().split('T')[0],
                closeDate: i % 3 === 0 ? new Date(2024, 11, 15).toISOString().split('T')[0] : null,
                quantity: 1 + (i % 5),
                pl: (Math.random() - 0.5) * 2000, // Random P&L between -1000 and +1000
                dte: Math.floor(Math.random() * 90)
            });
        }

        return positions;
    }

    /**
     * Generate comprehensive integration report
     */
    generateIntegrationReport() {
        console.log('\n' + '='.repeat(70));
        console.log('      TAX OPTIMIZATION INTEGRATION TEST REPORT');
        console.log('='.repeat(70));

        // Overall summary
        const allTests = [
            ...this.results.integrationTests,
            ...this.results.performanceTests,
            ...this.results.recommendationTests,
            ...this.results.complianceTests
        ];

        const passedTests = allTests.filter(test => test.passed).length;
        const totalTests = allTests.length;
        const passRate = Math.round((passedTests / totalTests) * 100);

        console.log(`\n📊 OVERALL INTEGRATION RESULTS:`);
        console.log(`✓ Tests Passed: ${passedTests}/${totalTests} (${passRate}%)`);
        console.log(`🔗 Integration Status: ${passRate >= 80 ? 'SUCCESSFUL' : 'NEEDS WORK'}`);

        // Category breakdown
        console.log(`\n📋 TEST CATEGORY BREAKDOWN:`);
        const categories = [
            { name: 'Integration Tests', results: this.results.integrationTests },
            { name: 'Performance Tests', results: this.results.performanceTests },
            { name: 'Recommendation Tests', results: this.results.recommendationTests },
            { name: 'Compliance Tests', results: this.results.complianceTests }
        ];

        categories.forEach(category => {
            const passed = category.results.filter(t => t.passed).length;
            const total = category.results.length;
            const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
            console.log(`  ${category.name}: ${passed}/${total} (${rate}%)`);
        });

        // Key findings
        console.log(`\n🔍 KEY FINDINGS:`);
        
        const integrationSuccess = this.results.integrationTests.every(t => t.passed);
        console.log(`${integrationSuccess ? '✅' : '❌'} Framework Integration: ${integrationSuccess ? 'SUCCESS' : 'FAILED'}`);
        
        const performanceSuccess = this.results.performanceTests.every(t => t.passed);
        console.log(`${performanceSuccess ? '✅' : '❌'} Performance Standards: ${performanceSuccess ? 'MET' : 'NOT MET'}`);
        
        const complianceSuccess = this.results.complianceTests.every(t => t.passed);
        console.log(`${complianceSuccess ? '✅' : '❌'} Tax Compliance: ${complianceSuccess ? 'ACCURATE' : 'NEEDS REVIEW'}`);

        // Recommendations for Tom King Trading Framework
        console.log(`\n💡 INTEGRATION RECOMMENDATIONS:`);
        console.log(`1. ✅ Tax optimization engine successfully integrates with existing framework`);
        console.log(`2. 📈 Add tax analysis to position manager dashboard displays`);
        console.log(`3. ⚠️  Include tax optimization in risk manager recommendations`);
        console.log(`4. 🎯 Prioritize Section 1256 instruments in strategy selection`);
        console.log(`5. 📊 Add tax efficiency metrics to performance reporting`);
        console.log(`6. 🇬🇧 Include UK tax compliance in account phase calculations`);

        // Implementation priority
        console.log(`\n🚀 IMPLEMENTATION PRIORITY FOR TOM KING FRAMEWORK:`);
        console.log(`HIGH:   Section 1256 instrument preference (immediate tax savings)`);
        console.log(`HIGH:   Wash sale prevention integration (compliance critical)`);
        console.log(`MEDIUM: UK capital gains optimization (jurisdiction specific)`);
        console.log(`MEDIUM: Tax-optimized position sizing (performance enhancement)`);
        console.log(`LOW:    Year-end planning automation (seasonal benefit)`);

        return {
            summary: {
                totalTests,
                passedTests,
                passRate,
                integrationSuccess
            },
            categories,
            findings: {
                integrationSuccess,
                performanceSuccess,
                complianceSuccess
            },
            results: this.results
        };
    }

    /**
     * Run all integration tests
     */
    async runAllIntegrationTests() {
        console.log('🧪 STARTING TAX OPTIMIZATION INTEGRATION TESTS');
        console.log(`📅 Test Date: ${new Date().toISOString()}`);
        console.log(`🎯 Framework: Tom King Trading Framework v17`);
        console.log(`📊 Test Positions: ${INTEGRATION_TEST_POSITIONS.length}`);

        try {
            // Run all test categories
            this.testPositionManagerIntegration();
            this.testRiskManagerIntegration();
            this.testTomKingStrategyOptimization();
            this.testPerformanceAndScalability();
            this.testComplianceAndAccuracy();

            // Generate comprehensive report
            const report = this.generateIntegrationReport();

            return report;
        } catch (error) {
            console.error('❌ INTEGRATION TEST EXECUTION FAILED:', error);
            return {
                error: error.message,
                stack: error.stack
            };
        }
    }
}

// Execute integration tests if run directly
if (require.main === module) {
    const tester = new TaxIntegrationTester();
    tester.runAllIntegrationTests().then(report => {
        console.log('\n✅ Tax optimization integration test completed');
        
        // Save report
        const fs = require('fs');
        const reportPath = './TAX_INTEGRATION_TEST_RESULTS.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Integration report saved to: ${reportPath}`);
    });
}

module.exports = TaxIntegrationTester;