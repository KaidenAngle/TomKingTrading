/**
 * Compounding Calculator Test Suite
 * Mathematical validation tests for CompoundingCalculator
 * 
 * CRITICAL REQUIREMENT: >99.9% accuracy validation for all calculations
 * Tests the mathematical foundation of the £35k→£80k transformation
 */

const { CompoundingCalculator } = require('../src/compoundingCalculator');

describe('CompoundingCalculator - Mathematical Foundation Tests', () => {
    let calculator;
    
    beforeEach(() => {
        calculator = new CompoundingCalculator();
    });

    describe('Core Mathematical Validation', () => {
        test('£35k→£86,659 in 8 months - exact mathematical validation', () => {
            const result = calculator.calculateCompoundTargets(35000, 8);
            
            // Core mathematical validation
            expect(result.validation.passesValidation).toBe(true);
            expect(result.validation.accuracy).toBeGreaterThanOrEqual(0.999);
            expect(result.targetCapital).toBe(86659);
            
            // Final month validation
            const finalMonth = result.progression[8];
            expect(finalMonth.capital).toBe(86659);
            expect(finalMonth.growthMultiplier).toBeCloseTo(2.476, 3);
            
            // Mathematical formula validation
            const expected = 35000 * Math.pow(1.12, 8);
            expect(result.targetCapital).toBeCloseTo(expected, 0);
        });

        test('Progressive monthly targets - exact calculations', () => {
            const result = calculator.calculateCompoundTargets(35000, 8);
            const progression = result.progression;
            
            // Month 0: £35,000
            expect(progression[0].capital).toBe(35000);
            
            // Month 1: £39,200
            expect(progression[1].capital).toBe(39200);
            expect(progression[1].monthlyGrowthRequired).toBe(4200);
            
            // Month 2: £43,904  
            expect(progression[2].capital).toBe(43904);
            expect(progression[2].monthlyGrowthRequired).toBe(4704);
            
            // Month 3: £49,173
            expect(progression[3].capital).toBe(49173);
            expect(progression[3].monthlyGrowthRequired).toBe(5269);
            
            // Month 4: £55,073
            expect(progression[4].capital).toBe(55073);
            expect(progression[4].monthlyGrowthRequired).toBe(5900);
            
            // Month 5: £61,682
            expect(progression[5].capital).toBe(61682);
            expect(progression[5].monthlyGrowthRequired).toBe(6609);
            
            // Month 6: £69,084
            expect(progression[6].capital).toBe(69084);
            expect(progression[6].monthlyGrowthRequired).toBe(7402);
            
            // Month 7: £77,374
            expect(progression[7].capital).toBe(77374);
            expect(progression[7].monthlyGrowthRequired).toBe(8290);
            
            // Month 8: £86,659
            expect(progression[8].capital).toBe(86659);
            expect(progression[8].monthlyGrowthRequired).toBe(9285);
        });

        test('Mathematical precision across different starting amounts', () => {
            const testCases = [
                { initial: 30000, months: 8, expectedMultiplier: 2.476 },
                { initial: 40000, months: 8, expectedMultiplier: 2.476 },
                { initial: 50000, months: 8, expectedMultiplier: 2.476 },
                { initial: 75000, months: 8, expectedMultiplier: 2.476 }
            ];
            
            testCases.forEach(testCase => {
                const result = calculator.calculateCompoundTargets(testCase.initial, testCase.months);
                const finalMonth = result.progression[testCase.months];
                
                expect(result.validation.accuracy).toBeGreaterThanOrEqual(0.999);
                expect(finalMonth.growthMultiplier).toBeCloseTo(testCase.expectedMultiplier, 3);
                
                // Verify mathematical precision
                const expected = testCase.initial * Math.pow(1.12, testCase.months);
                expect(result.targetCapital).toBeCloseTo(expected, 0);
            });
        });

        test('Compound rate mathematical consistency', () => {
            const result = calculator.calculateCompoundTargets(35000, 8);
            
            // Verify each month maintains 12% compound rate
            for (let month = 1; month <= 8; month++) {
                const current = result.progression[month];
                const previous = result.progression[month - 1];
                
                const actualGrowthRate = (current.capital - previous.capital) / previous.capital;
                expect(actualGrowthRate).toBeCloseTo(0.12, 3); // 12% within 0.1% precision
            }
        });

        test('Validation function - comprehensive mathematical checks', () => {
            const validation = calculator.validateCompoundMathematics();
            
            // Overall validation requirements
            expect(validation.overall.allTestsPassed).toBe(true);
            expect(validation.overall.averageAccuracy).toBeGreaterThanOrEqual(0.999);
            expect(validation.overall.passesRequirement).toBe(true);
            
            // Progressive validation
            expect(validation.progressive.allMonthsPassed).toBe(true);
            expect(validation.progressive.consistentProgression.consistent).toBe(true);
            
            // Formula validation
            expect(validation.formula.formulaValid).toBe(true);
            
            // All test cases must pass
            validation.testCases.forEach(testCase => {
                expect(testCase.passed).toBe(true);
                expect(testCase.accuracy).toBeGreaterThanOrEqual(0.999);
            });
        });
    });

    describe('VIX-Adaptive Compound Targeting', () => {
        test('VIX regime adjustments - 4 volatility levels', () => {
            const testCases = [
                { vix: 12, expectedMultiplier: 1.0, expectedRegime: 'LOW_VOLATILITY' },
                { vix: 20, expectedMultiplier: 0.9, expectedRegime: 'MEDIUM_VOLATILITY' },
                { vix: 30, expectedMultiplier: 0.75, expectedRegime: 'HIGH_VOLATILITY' },
                { vix: 45, expectedMultiplier: 0.6, expectedRegime: 'EXTREME_VOLATILITY' }
            ];
            
            testCases.forEach(testCase => {
                const vixAdjustment = calculator.getVixAdjustment(testCase.vix);
                
                expect(vixAdjustment.multiplier).toBe(testCase.expectedMultiplier);
                expect(vixAdjustment.label).toBe(testCase.expectedRegime);
            });
        });

        test('VIX-adjusted growth targeting', () => {
            const baseGrowthTarget = 5000; // £5k monthly target
            
            // Low VIX - standard targeting
            const lowVixPositioning = calculator.calculateGrowthBasedPositioning(50000, baseGrowthTarget, 12);
            expect(lowVixPositioning.vixAdjustment.multiplier).toBe(1.0);
            expect(lowVixPositioning.monthlyGrowthTarget).toBe(5000);
            
            // High VIX - reduced targeting
            const highVixPositioning = calculator.calculateGrowthBasedPositioning(50000, baseGrowthTarget, 30);
            expect(highVixPositioning.vixAdjustment.multiplier).toBe(0.75);
            expect(highVixPositioning.monthlyGrowthTarget).toBe(3750);
            
            // Extreme VIX - maximum reduction
            const extremeVixPositioning = calculator.calculateGrowthBasedPositioning(50000, baseGrowthTarget, 45);
            expect(extremeVixPositioning.vixAdjustment.multiplier).toBe(0.6);
            expect(extremeVixPositioning.monthlyGrowthTarget).toBe(3000);
        });
    });

    describe('Growth-Based Position Sizing', () => {
        test('Growth-based sizing vs arbitrary BP limits', () => {
            const positioning = calculator.calculateGrowthBasedPositioning(50000, 5000, 20);
            
            // Verify it's based on growth requirements, not arbitrary percentages
            expect(positioning.growthAnalysis).toBeDefined();
            expect(positioning.strategies.dte0.contractsNeeded).toBeGreaterThan(0);
            expect(positioning.strategies.lt112.contractsNeeded).toBeGreaterThan(0);
            expect(positioning.strategies.strangles.contractsNeeded).toBeGreaterThan(0);
            
            // Verify Tom King allocation: 40% 0DTE, 35% LT112, 25% Strangles
            const strategyAllocations = calculator.calculateStrategyAllocations(5000);
            expect(strategyAllocations.dte0).toBe(2000);      // 40%
            expect(strategyAllocations.lt112).toBe(1750);     // 35%
            expect(strategyAllocations.strangles).toBe(1250); // 25%
        });

        test('Position sizing based on required returns', () => {
            const positioning = calculator.calculateGrowthBasedPositioning(75000, 7500, 20);
            
            // Each strategy should have calculated positions based on expected returns
            Object.values(positioning.strategies).forEach(strategy => {
                expect(strategy.contractsNeeded).toBeGreaterThan(0);
                expect(strategy.expectedReturn).toBeGreaterThan(0);
                expect(strategy.bpRequired).toBeGreaterThan(0);
                expect(strategy.returnOnCapital).toBeGreaterThan(0);
                expect(strategy.riskRewardRatio).toBeGreaterThan(0);
            });
            
            // Total expected return should approach target
            const totalExpected = positioning.totals.totalExpectedReturn;
            expect(totalExpected).toBeGreaterThan(positioning.monthlyGrowthTarget * 0.8); // At least 80% of target
        });

        test('Tom King win rate integration', () => {
            const positioning = calculator.calculateGrowthBasedPositioning(60000, 6000, 20);
            
            // Verify Tom King win rates are used
            expect(positioning.strategies.dte0.winRate).toBe(0.88);      // 88%
            expect(positioning.strategies.lt112.winRate).toBe(0.73);     // 73%
            expect(positioning.strategies.strangles.winRate).toBe(0.72); // 72%
            
            // Expected returns should incorporate win rates
            Object.values(positioning.strategies).forEach(strategy => {
                expect(strategy.avgReturnPerContract).toBeGreaterThan(0);
                expect(strategy.winRate).toBeGreaterThan(0.7); // All above 70%
            });
        });
    });

    describe('Phase Transition System', () => {
        test('Phase determination based on capital levels', () => {
            expect(calculator.determinePhase(35000)).toBe(1);  // Phase 1: £30k-£43.9k
            expect(calculator.determinePhase(45000)).toBe(2);  // Phase 2: £43.9k-£61.7k
            expect(calculator.determinePhase(65000)).toBe(3);  // Phase 3: £61.7k-£80k
            expect(calculator.determinePhase(85000)).toBe(4);  // Phase 4: £80k+
        });

        test('Phase transitions in compound progression', () => {
            const result = calculator.calculateCompoundTargets(35000, 8);
            
            // Verify phase transitions occur at correct milestones
            const phaseSummary = result.phaseSummary;
            expect(phaseSummary.length).toBeGreaterThan(1); // Multiple phases
            
            // Check phase progression makes sense
            for (let i = 1; i < phaseSummary.length; i++) {
                expect(phaseSummary[i].phase).toBeGreaterThan(phaseSummary[i-1].phase);
                expect(phaseSummary[i].startCapital).toBeGreaterThan(phaseSummary[i-1].endCapital);
            }
        });

        test('Income target alignment across phases', () => {
            const testValues = [35000, 45000, 65000, 85000];
            const expectedTargets = [3000, 5000, 7500, 10000]; // Phase targets
            
            testValues.forEach((value, index) => {
                const incomeTarget = calculator.calculateAlignedIncomeTarget(value);
                expect(incomeTarget).toBe(expectedTargets[index]);
            });
        });
    });

    describe('Integration with MonthlyIncomeCalculator', () => {
        test('Seamless integration with Agent 1 systems', () => {
            const integration = calculator.integrateWithMonthlyIncomeCalculator(50000, 3, 20);
            
            // Both approaches should be present
            expect(integration.compoundApproach).toBeDefined();
            expect(integration.incomeApproach).toBeDefined();
            
            // Integration analysis should show alignment
            expect(integration.integration.alignmentScore).toBeGreaterThan(70); // Good alignment
            expect(integration.integration.wellAligned).toBe(true);
            
            // Unified recommendations should be provided
            expect(integration.unifiedRecommendations.length).toBeGreaterThan(0);
        });

        test('Cross-validation between approaches', () => {
            const integration = calculator.integrateWithMonthlyIncomeCalculator(60000, 4, 25);
            
            const alignment = integration.integration;
            
            // Both approaches should target similar amounts
            expect(alignment.targetAlignment).toBeLessThan(1000); // Within £1k difference
            
            // BP requirements should be similar
            expect(alignment.bpAlignment.difference).toBeLessThan(5000); // Within £5k BP difference
            
            // Feasibility scores should be comparable
            expect(alignment.feasibilityAlignment.difference).toBeLessThan(20); // Within 20 points
        });

        test('Unified recommendations coordination', () => {
            const integration = calculator.integrateWithMonthlyIncomeCalculator(70000, 5, 30);
            
            const unified = integration.unifiedRecommendations;
            
            // Should have unified positioning recommendation
            const positioningRec = unified.find(r => r.type === 'UNIFIED_POSITIONING');
            expect(positioningRec).toBeDefined();
            expect(positioningRec.priority).toBe('HIGH');
            
            // Should have strategy coordination recommendations
            const strategyRecs = unified.filter(r => r.type === 'STRATEGY_COORDINATION');
            expect(strategyRecs.length).toBe(3); // One for each strategy
        });
    });

    describe('Risk Assessment and Management', () => {
        test('Compounding risk assessment', () => {
            const positioning = calculator.calculateGrowthBasedPositioning(40000, 6000, 35);
            const riskAssessment = positioning.growthAnalysis.riskAssessment;
            
            expect(riskAssessment.riskScore).toBeGreaterThanOrEqual(0);
            expect(riskAssessment.riskScore).toBeLessThanOrEqual(100);
            expect(['LOW', 'MEDIUM', 'HIGH']).toContain(riskAssessment.riskLevel);
            expect(riskAssessment.risks).toBeInstanceOf(Array);
            expect(riskAssessment.mitigation).toBeInstanceOf(Array);
        });

        test('Feasibility scoring system', () => {
            // High feasibility scenario
            const highFeasible = calculator.calculateGrowthBasedPositioning(100000, 5000, 15);
            expect(highFeasible.growthAnalysis.confidenceScore).toBeGreaterThan(80);
            
            // Low feasibility scenario  
            const lowFeasible = calculator.calculateGrowthBasedPositioning(30000, 10000, 45);
            expect(lowFeasible.growthAnalysis.confidenceScore).toBeLessThan(60);
        });

        test('Growth optimization recommendations', () => {
            const positioning = calculator.calculateGrowthBasedPositioning(45000, 8000, 25);
            
            expect(positioning.recommendations).toBeInstanceOf(Array);
            positioning.recommendations.forEach(rec => {
                expect(rec.type).toBeDefined();
                expect(rec.priority).toBeDefined();
                expect(rec.message).toBeDefined();
                expect(['HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(rec.priority);
            });
        });
    });

    describe('Edge Cases and Boundary Testing', () => {
        test('Minimum account size handling', () => {
            const minResult = calculator.calculateGrowthBasedPositioning(25000, 2500, 20);
            expect(minResult.growthAnalysis.riskAssessment.riskLevel).toBe('HIGH'); // Small account = high risk
        });

        test('Maximum VIX level handling', () => {
            const extremeVix = calculator.calculateGrowthBasedPositioning(50000, 5000, 80);
            expect(extremeVix.vixAdjustment.multiplier).toBe(0.6); // Maximum reduction
        });

        test('Zero growth target handling', () => {
            expect(() => {
                calculator.calculateGrowthBasedPositioning(50000, 0, 20);
            }).not.toThrow();
        });

        test('Negative values handling', () => {
            expect(() => {
                calculator.calculateCompoundTargets(-1000, 8);
            }).not.toThrow();
        });

        test('Very high target handling', () => {
            const highTarget = calculator.calculateGrowthBasedPositioning(50000, 25000, 20); // 50% monthly target
            expect(highTarget.growthAnalysis.riskAssessment.riskLevel).toBe('HIGH');
        });
    });

    describe('Performance and Efficiency', () => {
        test('Calculation performance for large datasets', () => {
            const startTime = Date.now();
            
            // Run 1000 calculations
            for (let i = 0; i < 1000; i++) {
                calculator.calculateCompoundTargets(35000 + i, 8);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });

        test('Memory efficiency', () => {
            const memBefore = process.memoryUsage().heapUsed;
            
            // Run multiple calculations
            for (let i = 0; i < 100; i++) {
                calculator.calculateGrowthBasedPositioning(50000 + i * 1000, 5000, 20);
            }
            
            const memAfter = process.memoryUsage().heapUsed;
            const memIncrease = memAfter - memBefore;
            
            expect(memIncrease).toBeLessThan(10000000); // Less than 10MB increase
        });
    });

    describe('Configuration and Customization', () => {
        test('Configuration retrieval', () => {
            const config = calculator.getConfiguration();
            
            expect(config.targetCompoundRate).toBe(0.12);
            expect(config.targetMonths).toBe(8);
            expect(config.initialCapital).toBe(35000);
            expect(config.targetCapital).toBe(80000);
        });

        test('Configuration updates', () => {
            const updateSuccess = calculator.updateConfiguration({
                targetCompoundRate: 0.15,
                safetyMargins: { compoundBuffer: 0.10 }
            });
            
            expect(updateSuccess).toBe(true);
            
            const config = calculator.getConfiguration();
            expect(config.targetCompoundRate).toBe(0.15);
            expect(config.safetyMargins.compoundBuffer).toBe(0.10);
        });
    });
});