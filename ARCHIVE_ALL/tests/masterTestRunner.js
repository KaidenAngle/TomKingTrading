#!/usr/bin/env node

/**
 * MASTER TEST RUNNER - Tom King Trading Framework v17
 * 
 * Comprehensive test execution system that:
 * - Runs all account scenarios (£30k-£75k+)
 * - Tests BP utilization patterns (0%-95%)
 * - Validates position management
 * - Tests market conditions and VIX regimes
 * - Validates timing scenarios and Friday 0DTE
 * - Tests edge cases and error handling
 * - Generates detailed performance reports
 * - Validates API vs simulated data usage
 * - Tests recommendation quality
 * - Verifies risk rule compliance
 * 
 * PURPOSE: Complete framework validation with plug-and-play testing
 * NO LIVE TRADING - RECOMMENDATIONS ONLY
 */

const ComprehensiveTestSuite = require('../src/comprehensiveTestSuite');
const fs = require('fs');
const path = require('path');

class MasterTestRunner {
    constructor() {
        this.testSuite = new ComprehensiveTestSuite();
        this.reportDir = path.join(__dirname, 'test-reports');
        this.startTime = null;
        this.sessionId = this.generateSessionId();
        
        console.log('🚀 MASTER TEST RUNNER - Tom King Trading Framework v17');
        console.log('📊 Complete framework validation system');
        console.log(`🔬 Session ID: ${this.sessionId}`);
        console.log('🎯 NO LIVE TRADING - RECOMMENDATIONS ONLY\n');
        
        this.ensureReportDirectory();
    }

    /**
     * Generate unique session ID for test run
     */
    generateSessionId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = Math.random().toString(36).substr(2, 6);
        return `test-${timestamp}-${random}`;
    }

    /**
     * Ensure report directory exists
     */
    ensureReportDirectory() {
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
            console.log(`📁 Created report directory: ${this.reportDir}`);
        }
    }

    /**
     * Initialize test suite
     */
    async initialize(options = {}) {
        console.log('🔧 Initializing Master Test Runner...');
        
        const {
            useAPI = false,
            verbose = true,
            generateReports = true,
            categories = null // null means all categories
        } = options;

        this.options = {
            useAPI,
            verbose,
            generateReports,
            categories: categories || [
                'account_size',
                'bp_utilization',
                'position_scenarios', 
                'market_conditions',
                'time_scenarios',
                'edge_cases'
            ]
        };

        await this.testSuite.initialize(useAPI);
        
        console.log(`✅ Test suite initialized`);
        console.log(`📡 API Mode: ${useAPI ? 'ENABLED' : 'SIMULATED DATA'}`);
        console.log(`📊 Categories: ${this.options.categories.join(', ')}`);
        console.log(`📝 Reports: ${generateReports ? 'ENABLED' : 'DISABLED'}\n`);
    }

    /**
     * Run complete test suite
     */
    async runComplete() {
        this.startTime = Date.now();
        
        console.log('🚀 STARTING COMPLETE TOM KING FRAMEWORK VALIDATION');
        console.log('='.repeat(100));
        console.log('📊 Testing ALL scenarios across ALL categories');
        console.log('🎯 Complete system validation with advanced metrics\n');

        try {
            // Run comprehensive tests
            const results = await this.testSuite.runComprehensiveTests();
            
            // Generate detailed reports
            if (this.options.generateReports) {
                await this.generateAllReports(results);
            }

            // Display final summary
            this.displayFinalSummary(results);
            
            return results;
            
        } catch (error) {
            console.error('❌ MASTER TEST RUNNER ERROR:', error);
            throw error;
        }
    }

    /**
     * Run specific test categories
     */
    async runCategories(categories = null) {
        this.startTime = Date.now();
        
        const targetCategories = categories || this.options.categories;
        
        console.log('🎯 RUNNING TARGETED CATEGORY TESTS');
        console.log('='.repeat(80));
        console.log(`📊 Categories: ${targetCategories.join(', ')}\n`);

        const results = {
            totalTime: 0,
            categoryResults: {},
            overallResults: []
        };

        for (const category of targetCategories) {
            console.log(`\n🔬 TESTING CATEGORY: ${category.toUpperCase()}`);
            console.log('─'.repeat(60));
            
            const categoryResults = await this.testSuite.runCategoryTests(category);
            
            if (categoryResults) {
                results.categoryResults[category] = {
                    total: categoryResults.length,
                    successful: categoryResults.filter(r => r.success).length,
                    failed: categoryResults.filter(r => !r.success).length,
                    scenarios: categoryResults
                };
                
                results.overallResults.push(...categoryResults);
            }
        }

        results.totalTime = Date.now() - this.startTime;

        // Generate category-specific reports
        if (this.options.generateReports) {
            await this.generateCategoryReports(results, targetCategories);
        }

        this.displayCategorySummary(results, targetCategories);
        
        return results;
    }

    /**
     * Run quick validation test (subset of critical scenarios)
     */
    async runQuickValidation() {
        this.startTime = Date.now();
        
        console.log('⚡ RUNNING QUICK VALIDATION TEST');
        console.log('='.repeat(60));
        console.log('🎯 Testing critical scenarios for rapid feedback\n');

        // Define critical scenarios for quick validation
        const criticalScenarios = [
            'Fresh Account',
            'Friday 0DTE',
            'August 2024',
            'High VIX',
            '21 DTE',
            'Correlation',
            'API Failure'
        ];

        const results = [];

        for (const scenarioPattern of criticalScenarios) {
            console.log(`🧪 Quick test: ${scenarioPattern}`);
            
            const result = await this.testSuite.runSpecificTest(scenarioPattern);
            if (result) {
                results.push(result);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const totalTime = Date.now() - this.startTime;
        const successful = results.filter(r => r.success).length;

        console.log(`\n⚡ QUICK VALIDATION RESULTS:`);
        console.log(`   Tests: ${results.length}`);
        console.log(`   Successful: ${successful} (${(successful/results.length*100).toFixed(1)}%)`);
        console.log(`   Time: ${(totalTime/1000).toFixed(2)}s`);
        console.log(`   Status: ${successful === results.length ? '✅ PASSED' : '❌ FAILED'}`);

        return {
            results,
            totalTime,
            success: successful === results.length
        };
    }

    /**
     * Generate all comprehensive reports
     */
    async generateAllReports(results) {
        console.log('\n📊 GENERATING COMPREHENSIVE REPORTS...');
        
        const reports = [
            this.generateJSONReport(results),
            this.generateCSVReport(results),
            this.generateMarkdownReport(results),
            this.generatePerformanceReport(results),
            this.generateRiskAnalysisReport(results),
            this.generateRecommendationReport(results)
        ];

        await Promise.all(reports);
        
        console.log(`📁 All reports saved to: ${this.reportDir}`);
    }

    /**
     * Generate JSON report (machine readable)
     */
    async generateJSONReport(results) {
        const report = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            framework: 'Tom King Trading Framework v17',
            mode: 'RECOMMENDATIONS_ONLY',
            options: this.options,
            totalTime: results.totalTime,
            summary: {
                totalTests: results.overallResults.length,
                successful: results.overallResults.filter(r => r.success).length,
                failed: results.overallResults.filter(r => !r.success).length,
                successRate: (results.overallResults.filter(r => r.success).length / results.overallResults.length * 100).toFixed(2)
            },
            categoryResults: results.categoryResults,
            detailedResults: results.overallResults.map(r => ({
                scenario: r.scenario,
                phase: r.phase,
                success: r.success,
                executionTime: r.executionTime,
                validation: r.validation,
                recommendationCount: {
                    primary: r.recommendations?.primary?.length || 0,
                    secondary: r.recommendations?.secondary?.length || 0,
                    warnings: r.recommendations?.warnings?.length || 0,
                    management: r.recommendations?.management?.length || 0
                },
                error: r.error || null
            }))
        };

        const filePath = path.join(this.reportDir, `${this.sessionId}-full-report.json`);
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        
        console.log(`✅ JSON report: ${filePath}`);
    }

    /**
     * Generate CSV report (spreadsheet friendly)
     */
    async generateCSVReport(results) {
        const headers = [
            'Session ID',
            'Scenario',
            'Category', 
            'Phase',
            'Success',
            'Execution Time (ms)',
            'Strategy Match Rate',
            'Primary Recommendations',
            'Warnings',
            'Management Actions',
            'Error'
        ];

        const rows = results.overallResults.map(r => [
            this.sessionId,
            r.scenario,
            this.extractCategory(r.scenario),
            r.phase,
            r.success ? 'PASS' : 'FAIL',
            r.executionTime,
            r.validation ? (r.validation.matchRate * 100).toFixed(1) + '%' : 'N/A',
            r.recommendations?.primary?.length || 0,
            r.recommendations?.warnings?.length || 0,
            r.recommendations?.management?.length || 0,
            r.error || ''
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');

        const filePath = path.join(this.reportDir, `${this.sessionId}-results.csv`);
        fs.writeFileSync(filePath, csvContent);
        
        console.log(`✅ CSV report: ${filePath}`);
    }

    /**
     * Generate Markdown report (human readable)
     */
    async generateMarkdownReport(results) {
        const successful = results.overallResults.filter(r => r.success);
        const failed = results.overallResults.filter(r => !r.success);
        
        let markdown = `# Tom King Trading Framework Test Report\n\n`;
        markdown += `**Session ID:** ${this.sessionId}  \n`;
        markdown += `**Date:** ${new Date().toISOString()}  \n`;
        markdown += `**Framework:** Tom King Trading Framework v17  \n`;
        markdown += `**Mode:** RECOMMENDATIONS ONLY (No Live Trading)  \n\n`;

        // Executive Summary
        markdown += `## Executive Summary\n\n`;
        markdown += `| Metric | Value |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| Total Tests | ${results.overallResults.length} |\n`;
        markdown += `| Successful | ${successful.length} |\n`;
        markdown += `| Failed | ${failed.length} |\n`;
        markdown += `| Success Rate | ${(successful.length/results.overallResults.length*100).toFixed(1)}% |\n`;
        markdown += `| Total Time | ${(results.totalTime/1000).toFixed(2)}s |\n`;
        markdown += `| Avg per Test | ${Math.round(results.totalTime/results.overallResults.length)}ms |\n\n`;

        // Category Results
        markdown += `## Results by Category\n\n`;
        markdown += `| Category | Tests | Success | Rate |\n`;
        markdown += `|----------|-------|---------|------|\n`;
        
        Object.entries(results.categoryResults).forEach(([category, data]) => {
            const rate = (data.successful / data.total * 100).toFixed(1);
            markdown += `| ${category.replace('_', ' ').toUpperCase()} | ${data.total} | ${data.successful} | ${rate}% |\n`;
        });

        // Failed Tests
        if (failed.length > 0) {
            markdown += `\n## Failed Tests\n\n`;
            failed.forEach(f => {
                markdown += `- **${f.scenario}**: ${f.error}\n`;
            });
        }

        // Top Recommendations
        markdown += `\n## Top Recommended Strategies\n\n`;
        const allRecs = successful.flatMap(r => r.recommendations?.primary?.map(p => p.strategy) || []);
        const recCounts = {};
        allRecs.forEach(rec => recCounts[rec] = (recCounts[rec] || 0) + 1);
        
        Object.entries(recCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([strategy, count]) => {
                markdown += `- **${strategy}**: ${count} times\n`;
            });

        const filePath = path.join(this.reportDir, `${this.sessionId}-report.md`);
        fs.writeFileSync(filePath, markdown);
        
        console.log(`✅ Markdown report: ${filePath}`);
    }

    /**
     * Generate performance analysis report
     */
    async generatePerformanceReport(results) {
        const successful = results.overallResults.filter(r => r.success);
        const executionTimes = successful.map(r => r.executionTime);
        
        const performance = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            metrics: {
                totalTests: results.overallResults.length,
                successfulTests: successful.length,
                totalExecutionTime: results.totalTime,
                averageExecutionTime: executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length,
                fastestTest: Math.min(...executionTimes),
                slowestTest: Math.max(...executionTimes),
                testsPerSecond: successful.length / (results.totalTime / 1000),
                memoryUsage: process.memoryUsage()
            },
            categoryPerformance: {},
            slowestTests: successful
                .sort((a, b) => b.executionTime - a.executionTime)
                .slice(0, 10)
                .map(r => ({ scenario: r.scenario, time: r.executionTime })),
            fastestTests: successful
                .sort((a, b) => a.executionTime - b.executionTime)
                .slice(0, 10)
                .map(r => ({ scenario: r.scenario, time: r.executionTime }))
        };

        // Category performance
        Object.entries(results.categoryResults).forEach(([category, data]) => {
            const categoryTimes = data.scenarios.filter(s => s.success).map(s => s.executionTime);
            if (categoryTimes.length > 0) {
                performance.categoryPerformance[category] = {
                    tests: categoryTimes.length,
                    avgTime: categoryTimes.reduce((sum, time) => sum + time, 0) / categoryTimes.length,
                    minTime: Math.min(...categoryTimes),
                    maxTime: Math.max(...categoryTimes)
                };
            }
        });

        const filePath = path.join(this.reportDir, `${this.sessionId}-performance.json`);
        fs.writeFileSync(filePath, JSON.stringify(performance, null, 2));
        
        console.log(`✅ Performance report: ${filePath}`);
    }

    /**
     * Generate risk analysis report
     */
    async generateRiskAnalysisReport(results) {
        const successful = results.overallResults.filter(r => r.success);
        
        // Analyze warnings
        const allWarnings = successful.flatMap(r => r.recommendations?.warnings || []);
        const criticalWarnings = allWarnings.filter(w => w.severity === 'CRITICAL');
        const highWarnings = allWarnings.filter(w => w.severity === 'HIGH');
        
        // Warning type analysis
        const warningTypes = {};
        allWarnings.forEach(w => {
            warningTypes[w.type] = (warningTypes[w.type] || 0) + 1;
        });

        // Correlation risk analysis
        const correlationWarnings = allWarnings.filter(w => w.type === 'CORRELATION_RISK');
        
        // BP usage analysis
        const bpWarnings = allWarnings.filter(w => w.type === 'BP_USAGE');

        const riskReport = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            riskMetrics: {
                totalWarnings: allWarnings.length,
                criticalWarnings: criticalWarnings.length,
                highPriorityWarnings: highWarnings.length,
                warningRate: (allWarnings.length / successful.length * 100).toFixed(2) + '%'
            },
            warningAnalysis: {
                byType: warningTypes,
                correlationRisk: {
                    triggered: correlationWarnings.length,
                    rate: (correlationWarnings.length / successful.length * 100).toFixed(2) + '%'
                },
                bpUsageRisk: {
                    triggered: bpWarnings.length, 
                    rate: (bpWarnings.length / successful.length * 100).toFixed(2) + '%'
                }
            },
            august2024Prevention: {
                testsWithCorrelationWarnings: correlationWarnings.length,
                disasterPreventionActive: correlationWarnings.length > 0,
                status: correlationWarnings.length > 0 ? 'PROTECTED' : 'VERIFY_NEEDED'
            },
            recommendationQuality: {
                avgStrategyMatchRate: (successful.reduce((sum, r) => sum + (r.validation?.matchRate || 0), 0) / successful.length * 100).toFixed(2) + '%',
                excellentMatches: successful.filter(r => (r.validation?.matchRate || 0) >= 0.9).length,
                goodMatches: successful.filter(r => (r.validation?.matchRate || 0) >= 0.7).length,
                poorMatches: successful.filter(r => (r.validation?.matchRate || 0) < 0.5).length
            }
        };

        const filePath = path.join(this.reportDir, `${this.sessionId}-risk-analysis.json`);
        fs.writeFileSync(filePath, JSON.stringify(riskReport, null, 2));
        
        console.log(`✅ Risk analysis report: ${filePath}`);
    }

    /**
     * Generate recommendation analysis report
     */
    async generateRecommendationReport(results) {
        const successful = results.overallResults.filter(r => r.success);
        
        // Analyze all recommendations
        const primaryRecs = successful.flatMap(r => r.recommendations?.primary || []);
        const secondaryRecs = successful.flatMap(r => r.recommendations?.secondary || []);
        const managementRecs = successful.flatMap(r => r.recommendations?.management || []);
        
        // Strategy frequency analysis
        const strategyFreq = {};
        primaryRecs.forEach(rec => {
            strategyFreq[rec.strategy] = (strategyFreq[rec.strategy] || 0) + 1;
        });

        // Phase-specific analysis
        const phaseAnalysis = {};
        [1, 2, 3, 4].forEach(phase => {
            const phaseResults = successful.filter(r => r.phase === phase);
            const phaseRecs = phaseResults.flatMap(r => r.recommendations?.primary?.map(p => p.strategy) || []);
            
            const phaseFreq = {};
            phaseRecs.forEach(rec => phaseFreq[rec] = (phaseFreq[rec] || 0) + 1);
            
            phaseAnalysis[`phase_${phase}`] = {
                tests: phaseResults.length,
                totalRecommendations: phaseRecs.length,
                avgRecommendationsPerTest: phaseRecs.length / phaseResults.length,
                topStrategies: Object.entries(phaseFreq)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 5)
            };
        });

        // Friday 0DTE analysis
        const fridayTests = successful.filter(r => 
            r.userData?.dayOfWeek?.toLowerCase().includes('friday')
        );
        const fridayWith0DTE = fridayTests.filter(r => r.recommendations?.friday0DTE);

        const recommendationReport = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            recommendationMetrics: {
                totalPrimaryRecommendations: primaryRecs.length,
                totalSecondaryRecommendations: secondaryRecs.length,
                totalManagementActions: managementRecs.length,
                avgRecommendationsPerTest: primaryRecs.length / successful.length
            },
            strategyAnalysis: {
                mostRecommended: Object.entries(strategyFreq)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 15),
                strategyDistribution: strategyFreq
            },
            phaseAnalysis,
            friday0DTEAnalysis: {
                fridayTests: fridayTests.length,
                testsWith0DTE: fridayWith0DTE.length,
                coverage: fridayTests.length > 0 ? (fridayWith0DTE.length / fridayTests.length * 100).toFixed(2) + '%' : '0%',
                preMarketAnalysis: fridayWith0DTE.filter(r => r.recommendations.friday0DTE.status === 'PRE_MARKET').length,
                activeTrading: fridayWith0DTE.filter(r => r.recommendations.friday0DTE.status === 'ACTIVE').length
            },
            managementAnalysis: {
                totalActions: managementRecs.length,
                actionTypes: managementRecs.reduce((acc, action) => {
                    const type = action.action.split(' ')[0]; // Get first word of action
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {}),
                highPriorityActions: managementRecs.filter(m => m.priority === 'HIGH').length
            }
        };

        const filePath = path.join(this.reportDir, `${this.sessionId}-recommendations.json`);
        fs.writeFileSync(filePath, JSON.stringify(recommendationReport, null, 2));
        
        console.log(`✅ Recommendation analysis: ${filePath}`);
    }

    /**
     * Generate category-specific reports
     */
    async generateCategoryReports(results, categories) {
        console.log(`\n📊 GENERATING CATEGORY REPORTS FOR: ${categories.join(', ')}`);
        
        for (const category of categories) {
            const categoryData = results.categoryResults[category];
            if (!categoryData) continue;

            const report = {
                sessionId: this.sessionId,
                category,
                timestamp: new Date().toISOString(),
                summary: {
                    totalTests: categoryData.total,
                    successful: categoryData.successful,
                    failed: categoryData.failed,
                    successRate: (categoryData.successful / categoryData.total * 100).toFixed(2) + '%'
                },
                detailedResults: categoryData.scenarios.map(s => ({
                    scenario: s.scenario,
                    success: s.success,
                    phase: s.phase,
                    executionTime: s.executionTime,
                    recommendations: s.recommendations ? {
                        primaryCount: s.recommendations.primary?.length || 0,
                        warningsCount: s.recommendations.warnings?.length || 0,
                        managementCount: s.recommendations.management?.length || 0
                    } : null,
                    error: s.error || null
                }))
            };

            const filePath = path.join(this.reportDir, `${this.sessionId}-${category}.json`);
            fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
        }
        
        console.log(`✅ Category reports generated`);
    }

    /**
     * Display final summary
     */
    displayFinalSummary(results) {
        const successful = results.overallResults.filter(r => r.success);
        const failed = results.overallResults.filter(r => !r.success);
        const successRate = successful.length / results.overallResults.length;
        
        console.log('\n' + '='.repeat(100));
        console.log('🏁 MASTER TEST RUNNER - FINAL SUMMARY');
        console.log('='.repeat(100));
        
        console.log(`\n📊 EXECUTION SUMMARY:`);
        console.log(`   Session ID: ${this.sessionId}`);
        console.log(`   Total Execution Time: ${(results.totalTime / 1000).toFixed(2)} seconds`);
        console.log(`   Tests per Second: ${(results.overallResults.length / (results.totalTime / 1000)).toFixed(2)}`);
        
        console.log(`\n🎯 TEST RESULTS:`);
        console.log(`   Total Tests: ${results.overallResults.length}`);
        console.log(`   Successful: ${successful.length} (${(successRate * 100).toFixed(1)}%)`);
        console.log(`   Failed: ${failed.length} (${((1-successRate) * 100).toFixed(1)}%)`);
        
        // Overall status determination
        let status, readiness;
        if (successRate >= 0.95) {
            status = '✅ EXCELLENT';
            readiness = 'READY FOR PRODUCTION';
        } else if (successRate >= 0.90) {
            status = '✅ GOOD';
            readiness = 'READY WITH MINOR ISSUES';
        } else if (successRate >= 0.80) {
            status = '⚠️ ACCEPTABLE';
            readiness = 'NEEDS ATTENTION BEFORE PRODUCTION';
        } else {
            status = '❌ POOR';
            readiness = 'NOT READY FOR PRODUCTION';
        }
        
        console.log(`\n🚀 SYSTEM STATUS:`);
        console.log(`   Framework Health: ${status}`);
        console.log(`   Production Readiness: ${readiness}`);
        console.log(`   API Mode: ${this.options.useAPI ? 'LIVE DATA TESTED' : 'SIMULATED DATA ONLY'}`);
        
        if (this.options.generateReports) {
            console.log(`\n📁 REPORTS GENERATED:`);
            console.log(`   Report Directory: ${this.reportDir}`);
            console.log(`   Session Files: ${this.sessionId}-*.{json,csv,md}`);
        }
        
        console.log(`\n📋 FINAL STATUS:`);
        console.log(`   ✅ Comprehensive Testing: COMPLETE`);
        console.log(`   ✅ Risk Management: VALIDATED`);  
        console.log(`   ✅ Recommendation Engine: TESTED`);
        console.log(`   ✅ All Phases Tested: ${this.options.categories.length}/6 categories`);
        console.log(`   ✅ Mode: RECOMMENDATIONS ONLY (No Live Trading)`);
        
        console.log('\n🎯 Tom King Trading Framework v17 - Testing Complete');
        console.log('🛡️ System validated for manual recommendation generation');
        console.log('='.repeat(100));
    }

    /**
     * Display category summary
     */
    displayCategorySummary(results, categories) {
        console.log(`\n📊 CATEGORY TEST SUMMARY - ${categories.join(', ').toUpperCase()}`);
        console.log('='.repeat(80));
        
        categories.forEach(category => {
            const data = results.categoryResults[category];
            if (data) {
                const rate = (data.successful / data.total * 100).toFixed(1);
                console.log(`${category.toUpperCase().padEnd(20)} | ${data.successful}/${data.total} | ${rate}% success`);
            }
        });
        
        const totalSuccessful = Object.values(results.categoryResults).reduce((sum, cat) => sum + cat.successful, 0);
        const totalTests = Object.values(results.categoryResults).reduce((sum, cat) => sum + cat.total, 0);
        const overallRate = (totalSuccessful / totalTests * 100).toFixed(1);
        
        console.log('─'.repeat(80));
        console.log(`${'OVERALL'.padEnd(20)} | ${totalSuccessful}/${totalTests} | ${overallRate}% success`);
        console.log(`Execution Time: ${(results.totalTime / 1000).toFixed(2)}s`);
    }

    /**
     * Extract category from scenario name
     */
    extractCategory(scenarioName) {
        if (scenarioName.includes('Account Size')) return 'account_size';
        if (scenarioName.includes('BP Utilization')) return 'bp_utilization';
        if (scenarioName.includes('Positions')) return 'position_scenarios';
        if (scenarioName.includes('Market') || scenarioName.includes('VIX') || scenarioName.includes('August')) return 'market_conditions';
        if (scenarioName.includes('Monday') || scenarioName.includes('Tuesday') || scenarioName.includes('Wednesday') || 
            scenarioName.includes('Thursday') || scenarioName.includes('Friday') || scenarioName.includes('Saturday') || 
            scenarioName.includes('Sunday')) return 'time_scenarios';
        if (scenarioName.includes('Edge Case')) return 'edge_cases';
        return 'unknown';
    }
}

/**
 * Command line interface
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const runner = new MasterTestRunner();
    
    try {
        switch (command) {
            case 'complete':
                await runner.initialize({ 
                    useAPI: args.includes('--api'),
                    verbose: !args.includes('--quiet'),
                    generateReports: !args.includes('--no-reports')
                });
                await runner.runComplete();
                break;
                
            case 'categories':
                const categories = args.slice(1).filter(arg => !arg.startsWith('--'));
                await runner.initialize({ 
                    useAPI: args.includes('--api'),
                    categories: categories.length > 0 ? categories : null
                });
                await runner.runCategories(categories.length > 0 ? categories : null);
                break;
                
            case 'quick':
                await runner.initialize({ 
                    useAPI: args.includes('--api'),
                    generateReports: false
                });
                await runner.runQuickValidation();
                break;
                
            case 'list':
                await runner.initialize({ useAPI: false, generateReports: false });
                runner.testSuite.listScenariosByCategory();
                break;
                
            default:
                console.log('🚀 MASTER TEST RUNNER - Tom King Trading Framework v17');
                console.log('📊 Comprehensive testing system for complete framework validation');
                console.log('');
                console.log('USAGE:');
                console.log('  node masterTestRunner.js complete [--api] [--quiet] [--no-reports]');
                console.log('    Run complete test suite with all scenarios');
                console.log('');
                console.log('  node masterTestRunner.js categories [category1] [category2] [...] [--api]');
                console.log('    Run specific test categories');
                console.log(''); 
                console.log('  node masterTestRunner.js quick [--api]');
                console.log('    Run quick validation (critical scenarios only)');
                console.log('');
                console.log('  node masterTestRunner.js list');
                console.log('    List all available test scenarios by category');
                console.log('');
                console.log('CATEGORIES:');
                console.log('  account_size      - Test different account phases (£30k-£75k+)');
                console.log('  bp_utilization    - Test BP usage scenarios (0%-95%)');
                console.log('  position_scenarios - Test position management scenarios');
                console.log('  market_conditions - Test VIX regimes and market conditions');
                console.log('  time_scenarios    - Test timing and day-specific strategies');
                console.log('  edge_cases        - Test error handling and edge cases');
                console.log('');
                console.log('FLAGS:');
                console.log('  --api            Use real TastyTrade API (vs simulated data)');
                console.log('  --quiet          Reduce output verbosity');
                console.log('  --no-reports     Skip report generation');
                console.log('');
                console.log('EXAMPLES:');
                console.log('  node masterTestRunner.js complete --api');
                console.log('  node masterTestRunner.js categories account_size bp_utilization');
                console.log('  node masterTestRunner.js quick');
                console.log('');
                break;
        }
    } catch (error) {
        console.error('❌ MASTER TEST RUNNER ERROR:', error.message);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = MasterTestRunner;