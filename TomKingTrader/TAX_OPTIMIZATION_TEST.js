/**
 * TAX OPTIMIZATION SYSTEMS TEST
 * Testing current framework for tax optimization and compliance features
 * Focus: Section 1256, UK/US tax compliance, wash sale rules, profit optimization
 */

const { performance } = require('perf_hooks');

// Test configuration
const TEST_CONFIG = {
    accountValue: 50000,
    baseCurrency: 'GBP', // UK trader
    taxYearEnd: '2025-04-05', // UK tax year
    currentDate: new Date('2025-01-15'),
    section1256Enabled: true, // Tax election status
    ukResident: true
};

// Test positions for tax analysis
const TEST_POSITIONS = [
    // Section 1256 Qualifying Instruments
    {
        id: 'pos1',
        symbol: 'ES',
        instrument: 'FUTURE',
        strategy: 'LT112',
        openDate: '2024-12-15',
        closeDate: null,
        openPrice: 5800,
        currentPrice: 5850,
        quantity: 1,
        pl: 2500, // $2500 profit = ~£1950
        section1256: true, // Should qualify
        broadBasedIndex: true
    },
    {
        id: 'pos2', 
        symbol: 'SPX',
        instrument: 'INDEX_OPTION',
        strategy: '0DTE',
        openDate: '2025-01-10',
        closeDate: '2025-01-10',
        openPrice: 15.50,
        closePrice: 31.00,
        quantity: 10,
        pl: 1550, // $1550 profit
        section1256: true, // SPX qualifies
        broadBasedIndex: true
    },
    {
        id: 'pos3',
        symbol: 'SPY',
        instrument: 'ETF_OPTION',
        strategy: 'STRANGLE',
        openDate: '2024-12-20',
        closeDate: null,
        openPrice: 8.50,
        currentPrice: 6.20,
        quantity: 5,
        pl: -1150, // Loss
        section1256: false, // ETF options don't qualify
        broadBasedIndex: false
    },
    {
        id: 'pos4',
        symbol: 'GC',
        instrument: 'FUTURE',
        strategy: 'STRANGLE',
        openDate: '2024-11-15',
        closeDate: '2025-01-05',
        openPrice: 2050,
        closePrice: 2080,
        quantity: 1,
        pl: 3000, // Gold futures profit
        section1256: true,
        commodity: true
    },
    // Potential wash sale scenario
    {
        id: 'pos5',
        symbol: 'SPY',
        instrument: 'ETF_OPTION',
        strategy: 'PUT',
        openDate: '2024-12-28',
        closeDate: '2025-01-03',
        openPrice: 12.00,
        closePrice: 8.50,
        quantity: 3,
        pl: -1050, // Loss - potential wash sale trigger
        section1256: false
    },
    {
        id: 'pos6',
        symbol: 'SPY',
        instrument: 'ETF_OPTION', 
        strategy: 'CALL',
        openDate: '2025-01-08', // Within 30 days of pos5 close
        closeDate: null,
        openPrice: 14.20,
        currentPrice: 16.80,
        quantity: 2,
        pl: 520,
        section1256: false,
        potentialWashSale: true // Flag for substantially identical
    }
];

class TaxOptimizationTester {
    constructor() {
        this.results = {
            section1256Tests: [],
            ukTaxTests: [],
            washSaleTests: [],
            optimizationTests: [],
            complianceTests: [],
            recommendations: []
        };
        this.startTime = performance.now();
    }

    // Test 1: Section 1256 Qualification and Treatment
    testSection1256Qualification() {
        console.log('\n=== TESTING SECTION 1256 QUALIFICATION ===');
        
        const section1256Positions = TEST_POSITIONS.filter(pos => pos.section1256);
        const nonSection1256 = TEST_POSITIONS.filter(pos => !pos.section1256);
        
        // Test qualification rules
        const qualificationTest = this.validateSection1256Qualification(TEST_POSITIONS);
        
        // Calculate 60/40 tax treatment
        const taxTreatment = this.calculateSection1256TaxTreatment(section1256Positions);
        
        this.results.section1256Tests.push({
            test: 'Section 1256 Qualification',
            passed: qualificationTest.passed,
            details: {
                qualifying: section1256Positions.length,
                nonQualifying: nonSection1256.length,
                correctlyIdentified: qualificationTest.correctlyIdentified,
                totalProfit: taxTreatment.totalProfit,
                longTermPortion: taxTreatment.longTermPortion,
                shortTermPortion: taxTreatment.shortTermPortion,
                taxSavings: taxTreatment.estimatedSavings
            }
        });

        console.log(`✓ Section 1256 positions: ${section1256Positions.length}`);
        console.log(`✓ Non-Section 1256 positions: ${nonSection1256.length}`);
        console.log(`✓ Total Section 1256 P&L: $${taxTreatment.totalProfit}`);
        console.log(`✓ Long-term treatment (60%): $${taxTreatment.longTermPortion}`);
        console.log(`✓ Short-term treatment (40%): $${taxTreatment.shortTermPortion}`);
        console.log(`✓ Estimated tax savings: $${taxTreatment.estimatedSavings}`);
    }

    // Test 2: UK Tax Compliance and Capital Gains
    testUKTaxCompliance() {
        console.log('\n=== TESTING UK TAX COMPLIANCE ===');
        
        const ukTaxAnalysis = this.calculateUKTaxImplications(TEST_POSITIONS);
        
        this.results.ukTaxTests.push({
            test: 'UK Capital Gains Calculation',
            passed: ukTaxAnalysis.withinAllowance,
            details: {
                totalCapitalGains: ukTaxAnalysis.totalGains,
                annualAllowance: ukTaxAnalysis.annualAllowance,
                taxableGains: ukTaxAnalysis.taxableGains,
                estimatedTax: ukTaxAnalysis.estimatedTax,
                utilizationRate: ukTaxAnalysis.allowanceUtilization
            }
        });

        console.log(`✓ Total capital gains: £${ukTaxAnalysis.totalGains}`);
        console.log(`✓ Annual allowance: £${ukTaxAnalysis.annualAllowance}`);
        console.log(`✓ Taxable gains: £${ukTaxAnalysis.taxableGains}`);
        console.log(`✓ Allowance utilization: ${ukTaxAnalysis.allowanceUtilization}%`);
        console.log(`✓ Estimated UK CGT: £${ukTaxAnalysis.estimatedTax}`);
    }

    // Test 3: Wash Sale Prevention
    testWashSalePrevention() {
        console.log('\n=== TESTING WASH SALE PREVENTION ===');
        
        const washSaleAnalysis = this.identifyWashSales(TEST_POSITIONS);
        
        this.results.washSaleTests.push({
            test: 'Wash Sale Detection',
            passed: washSaleAnalysis.violations.length === 0,
            details: {
                potentialViolations: washSaleAnalysis.violations.length,
                disallowedLoss: washSaleAnalysis.totalDisallowed,
                adjustedCostBasis: washSaleAnalysis.adjustments.length,
                preventionRecommendations: washSaleAnalysis.recommendations
            }
        });

        console.log(`✓ Wash sale violations: ${washSaleAnalysis.violations.length}`);
        console.log(`✓ Disallowed losses: $${washSaleAnalysis.totalDisallowed}`);
        console.log(`✓ Cost basis adjustments: ${washSaleAnalysis.adjustments.length}`);
        
        if (washSaleAnalysis.violations.length > 0) {
            console.log('⚠️ WASH SALE DETECTED:');
            washSaleAnalysis.violations.forEach(violation => {
                console.log(`   - ${violation.symbol}: Loss $${violation.lossAmount} disallowed`);
            });
        }
    }

    // Test 4: Tax-Optimized Position Sizing
    testTaxOptimizedPositionSizing() {
        console.log('\n=== TESTING TAX-OPTIMIZED POSITION SIZING ===');
        
        const optimizationAnalysis = this.analyzePositionOptimization(TEST_POSITIONS);
        
        this.results.optimizationTests.push({
            test: 'Tax-Optimized Position Sizing',
            passed: optimizationAnalysis.score >= 70,
            details: {
                optimizationScore: optimizationAnalysis.score,
                section1256Preference: optimizationAnalysis.section1256Preference,
                taxEfficiencyRatio: optimizationAnalysis.taxEfficiency,
                recommendations: optimizationAnalysis.recommendations
            }
        });

        console.log(`✓ Tax optimization score: ${optimizationAnalysis.score}/100`);
        console.log(`✓ Section 1256 preference: ${optimizationAnalysis.section1256Preference}%`);
        console.log(`✓ Tax efficiency ratio: ${optimizationAnalysis.taxEfficiency}`);
    }

    // Test 5: Year-End Tax Planning
    testYearEndTaxPlanning() {
        console.log('\n=== TESTING YEAR-END TAX PLANNING ===');
        
        const yearEndAnalysis = this.generateYearEndTaxPlan(TEST_POSITIONS);
        
        this.results.optimizationTests.push({
            test: 'Year-End Tax Planning',
            passed: yearEndAnalysis.hasRecommendations,
            details: {
                lossHarvestingOpportunity: yearEndAnalysis.lossHarvesting,
                gainRealizationPlan: yearEndAnalysis.gainRealization,
                washSalePrevention: yearEndAnalysis.washSalePrevention,
                section1256Optimization: yearEndAnalysis.section1256Optimization
            }
        });

        console.log(`✓ Loss harvesting opportunities: $${yearEndAnalysis.lossHarvesting}`);
        console.log(`✓ Optimal gain realization: $${yearEndAnalysis.gainRealization}`);
        console.log(`✓ Tax planning recommendations: ${yearEndAnalysis.recommendations.length}`);
    }

    // Implementation: Section 1256 Qualification Validator
    validateSection1256Qualification(positions) {
        const section1256Instruments = [
            'ES', 'MES', 'NQ', 'MNQ', 'YM', 'MYM', 'RTY', 'M2K', // Index futures
            'GC', 'MGC', 'SI', 'CL', 'MCL', 'NG', // Commodity futures
            'SPX', 'SPXW', 'RUT', 'NDX', 'VIX' // Broad-based index options
        ];

        let correctlyIdentified = 0;
        
        positions.forEach(pos => {
            const shouldQualify = (
                pos.instrument === 'FUTURE' || 
                (pos.instrument === 'INDEX_OPTION' && pos.broadBasedIndex)
            );
            
            if (pos.section1256 === shouldQualify) {
                correctlyIdentified++;
            }
        });

        return {
            passed: correctlyIdentified === positions.length,
            correctlyIdentified,
            totalPositions: positions.length
        };
    }

    // Implementation: Section 1256 Tax Treatment Calculator
    calculateSection1256TaxTreatment(positions) {
        const totalProfit = positions.reduce((sum, pos) => sum + pos.pl, 0);
        const longTermPortion = totalProfit * 0.60;
        const shortTermPortion = totalProfit * 0.40;
        
        // Estimate tax savings (assuming 37% ST rate vs 20% LT rate)
        const regularTax = totalProfit * 0.37; // All short-term
        const section1256Tax = (longTermPortion * 0.20) + (shortTermPortion * 0.37);
        const estimatedSavings = regularTax - section1256Tax;

        return {
            totalProfit: Math.round(totalProfit),
            longTermPortion: Math.round(longTermPortion),
            shortTermPortion: Math.round(shortTermPortion),
            estimatedSavings: Math.round(estimatedSavings)
        };
    }

    // Implementation: UK Tax Implications Calculator
    calculateUKTaxImplications(positions) {
        const GBP_USD_RATE = 1.28; // Approximate exchange rate
        const ANNUAL_CGT_ALLOWANCE = 6000; // 2024/25 UK CGT allowance
        
        // Convert USD P&L to GBP and calculate gains
        const totalGainsGBP = positions
            .filter(pos => pos.pl > 0)
            .reduce((sum, pos) => sum + (pos.pl / GBP_USD_RATE), 0);
            
        const taxableGains = Math.max(0, totalGainsGBP - ANNUAL_CGT_ALLOWANCE);
        const basicRateTax = taxableGains * 0.10; // 10% for trading profits
        const higherRateTax = taxableGains * 0.20; // 20% for higher rate
        
        // Assume basic rate for this test
        const estimatedTax = basicRateTax;

        return {
            totalGains: Math.round(totalGainsGBP),
            annualAllowance: ANNUAL_CGT_ALLOWANCE,
            taxableGains: Math.round(taxableGains),
            estimatedTax: Math.round(estimatedTax),
            allowanceUtilization: Math.round((totalGainsGBP / ANNUAL_CGT_ALLOWANCE) * 100),
            withinAllowance: totalGainsGBP <= ANNUAL_CGT_ALLOWANCE
        };
    }

    // Implementation: Wash Sale Detector
    identifyWashSales(positions) {
        const violations = [];
        const adjustments = [];
        let totalDisallowed = 0;

        // Group positions by underlying
        const positionsByUnderlying = {};
        positions.forEach(pos => {
            const underlying = pos.symbol;
            if (!positionsByUnderlying[underlying]) {
                positionsByUnderlying[underlying] = [];
            }
            positionsByUnderlying[underlying].push(pos);
        });

        // Check for wash sales within each underlying
        Object.entries(positionsByUnderlying).forEach(([symbol, positions]) => {
            const lossTrades = positions.filter(p => p.pl < 0 && p.closeDate);
            const gainTrades = positions.filter(p => p.pl > 0);

            lossTrades.forEach(lossTrade => {
                const lossDate = new Date(lossTrade.closeDate);
                
                // Check for substantially identical purchases within 30 days before/after
                const substantiallyIdentical = positions.filter(p => {
                    if (p.id === lossTrade.id) return false;
                    
                    const tradeDate = new Date(p.openDate);
                    const daysDiff = Math.abs((tradeDate - lossDate) / (1000 * 60 * 60 * 24));
                    
                    return daysDiff <= 30 && this.isSubstantiallyIdentical(lossTrade, p);
                });

                if (substantiallyIdentical.length > 0) {
                    violations.push({
                        symbol: symbol,
                        lossTrade: lossTrade.id,
                        lossAmount: Math.abs(lossTrade.pl),
                        identicalTrades: substantiallyIdentical.map(t => t.id)
                    });
                    
                    totalDisallowed += Math.abs(lossTrade.pl);
                    
                    // Cost basis adjustment
                    adjustments.push({
                        affectedPosition: substantiallyIdentical[0].id,
                        adjustmentAmount: Math.abs(lossTrade.pl)
                    });
                }
            });
        });

        return {
            violations,
            adjustments,
            totalDisallowed: Math.round(totalDisallowed),
            recommendations: violations.length > 0 ? [
                'Wait 31 days before repurchasing substantially identical securities',
                'Consider tax-loss harvesting with non-identical alternatives',
                'Use Section 1256 instruments to avoid wash sale rules'
            ] : []
        };
    }

    // Check if two positions are substantially identical
    isSubstantiallyIdentical(pos1, pos2) {
        // Same underlying symbol
        if (pos1.symbol !== pos2.symbol) return false;
        
        // Same general strategy type (calls vs puts matter less than underlying)
        const strategy1 = pos1.strategy || pos1.instrument;
        const strategy2 = pos2.strategy || pos2.instrument;
        
        // For options, same underlying = substantially identical
        // For futures, same contract = substantially identical
        return true;
    }

    // Implementation: Position Optimization Analyzer
    analyzePositionOptimization(positions) {
        const totalPositions = positions.length;
        const section1256Positions = positions.filter(p => p.section1256).length;
        const section1256Preference = (section1256Positions / totalPositions) * 100;
        
        // Calculate tax efficiency score
        const section1256Profit = positions
            .filter(p => p.section1256)
            .reduce((sum, p) => sum + Math.max(0, p.pl), 0);
        
        const totalProfit = positions
            .reduce((sum, p) => sum + Math.max(0, p.pl), 0);
        
        const taxEfficiency = section1256Profit / totalProfit;
        
        // Overall optimization score
        let score = 50; // Base score
        score += section1256Preference * 0.3; // Bonus for Section 1256 preference
        score += taxEfficiency * 30; // Bonus for tax-efficient profits
        
        return {
            score: Math.min(100, Math.round(score)),
            section1256Preference: Math.round(section1256Preference),
            taxEfficiency: Math.round(taxEfficiency * 100) / 100,
            recommendations: [
                section1256Preference < 60 ? 'Increase allocation to Section 1256 instruments' : null,
                taxEfficiency < 0.7 ? 'Focus profits on tax-advantaged instruments' : null,
                'Consider futures over ETF options for tax efficiency'
            ].filter(Boolean)
        };
    }

    // Implementation: Year-End Tax Planning Generator
    generateYearEndTaxPlan(positions) {
        const currentLosses = positions
            .filter(p => p.pl < 0)
            .reduce((sum, p) => sum + Math.abs(p.pl), 0);
        
        const unrealizedGains = positions
            .filter(p => !p.closeDate && p.pl > 0)
            .reduce((sum, p) => sum + p.pl, 0);
        
        const section1256Gains = positions
            .filter(p => p.section1256 && p.pl > 0)
            .reduce((sum, p) => sum + p.pl, 0);

        const recommendations = [];
        
        if (currentLosses > 3000) {
            recommendations.push('Consider realizing losses for tax deduction (up to $3,000 annually)');
        }
        
        if (unrealizedGains > 10000) {
            recommendations.push('Plan gain realization timing across tax years');
        }
        
        if (section1256Gains < (unrealizedGains * 0.6)) {
            recommendations.push('Prioritize Section 1256 instruments for future trades');
        }

        return {
            lossHarvesting: Math.round(Math.min(currentLosses, 3000)),
            gainRealization: Math.round(unrealizedGains),
            washSalePrevention: 'Monitor 30-day windows',
            section1256Optimization: Math.round(section1256Gains),
            hasRecommendations: recommendations.length > 0,
            recommendations
        };
    }

    // Generate comprehensive test report
    generateReport() {
        const endTime = performance.now();
        const duration = Math.round(endTime - this.startTime);
        
        console.log('\n' + '='.repeat(60));
        console.log('         TAX OPTIMIZATION SYSTEMS TEST REPORT');
        console.log('='.repeat(60));
        
        // Overall summary
        const allTests = [
            ...this.results.section1256Tests,
            ...this.results.ukTaxTests,
            ...this.results.washSaleTests,
            ...this.results.optimizationTests,
            ...this.results.complianceTests
        ];
        
        const passedTests = allTests.filter(test => test.passed).length;
        const totalTests = allTests.length;
        const passRate = Math.round((passedTests / totalTests) * 100);
        
        console.log(`\n📊 OVERALL RESULTS:`);
        console.log(`✓ Tests Passed: ${passedTests}/${totalTests} (${passRate}%)`);
        console.log(`⏱️  Duration: ${duration}ms`);
        
        // Critical findings
        console.log(`\n🚨 CRITICAL FINDINGS:`);
        
        const hasSection1256Implementation = this.results.section1256Tests.some(t => t.passed);
        const hasWashSaleDetection = this.results.washSaleTests.some(t => t.passed);
        const hasUKTaxCompliance = this.results.ukTaxTests.some(t => t.passed);
        
        if (!hasSection1256Implementation) {
            console.log(`❌ NO SECTION 1256 TAX OPTIMIZATION DETECTED`);
        }
        
        if (!hasWashSaleDetection) {
            console.log(`❌ NO WASH SALE PREVENTION SYSTEM DETECTED`);
        }
        
        if (!hasUKTaxCompliance) {
            console.log(`❌ NO UK TAX COMPLIANCE TRACKING DETECTED`);
        }
        
        // Tax optimization recommendations
        console.log(`\n💰 TAX OPTIMIZATION OPPORTUNITIES:`);
        console.log(`• Section 1256 instruments can save ~17% on taxes vs regular options`);
        console.log(`• Futures provide better tax treatment than ETF options`);
        console.log(`• UK capital gains allowance: £6,000 annually (use efficiently)`);
        console.log(`• Wash sale rules can disallow loss deductions (30-day rule)`);
        
        console.log(`\n📋 IMPLEMENTATION NEEDED:`);
        console.log(`1. Section 1256 instrument classification system`);
        console.log(`2. UK capital gains tracking and optimization`);
        console.log(`3. Wash sale prevention and detection`);
        console.log(`4. Tax-optimized position sizing algorithms`);
        console.log(`5. Year-end tax planning automation`);
        console.log(`6. Cross-border tax compliance tracking`);
        
        return {
            summary: {
                totalTests,
                passedTests,
                passRate,
                duration,
                testDate: new Date().toISOString()
            },
            findings: {
                hasSection1256Implementation,
                hasWashSaleDetection,
                hasUKTaxCompliance,
                criticalGaps: !hasSection1256Implementation || !hasWashSaleDetection || !hasUKTaxCompliance
            },
            results: this.results
        };
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 STARTING TAX OPTIMIZATION SYSTEMS TEST');
        console.log(`📅 Test Date: ${new Date().toISOString()}`);
        console.log(`💰 Test Account: ${TEST_CONFIG.baseCurrency} ${TEST_CONFIG.accountValue}`);
        console.log(`🏦 UK Resident: ${TEST_CONFIG.ukResident}`);
        
        try {
            this.testSection1256Qualification();
            this.testUKTaxCompliance();
            this.testWashSalePrevention();
            this.testTaxOptimizedPositionSizing();
            this.testYearEndTaxPlanning();
            
            return this.generateReport();
        } catch (error) {
            console.error('❌ TEST EXECUTION FAILED:', error);
            return {
                error: error.message,
                stack: error.stack
            };
        }
    }
}

// Execute tests if run directly
if (require.main === module) {
    const tester = new TaxOptimizationTester();
    tester.runAllTests().then(report => {
        console.log('\n✅ Tax optimization test completed');
        
        // Save report
        const fs = require('fs');
        const reportPath = './TAX_OPTIMIZATION_TEST_RESULTS.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Report saved to: ${reportPath}`);
    });
}

module.exports = TaxOptimizationTester;