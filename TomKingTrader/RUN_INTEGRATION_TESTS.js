/**
 * Tom King Trading Framework
 * Complete Agent Integration Test Runner
 * 
 * This script runs all integration tests between the 5 agent systems
 * to verify that they work together properly.
 */

const fs = require('fs');
const path = require('path');

// Import all agent modules
const { MonthlyIncomeCalculator } = require('./src/monthlyIncomeCalculator');
const { CompoundingCalculator } = require('./src/compoundingCalculator');
const { TaxOptimizationEngine } = require('./src/taxOptimizationEngine');
const { GreeksStreamingEngine } = require('./src/greeksStreamingEngine');

class IntegrationTestRunner {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async runTest(name, testFn) {
        console.log(`\nTesting: ${name}`);
        try {
            const result = await testFn();
            this.results.passed++;
            this.results.tests.push({
                name,
                status: 'PASSED',
                result
            });
            console.log(`✅ ${name} - PASSED`);
            return true;
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({
                name,
                status: 'FAILED',
                error: error.message
            });
            console.log(`❌ ${name} - FAILED: ${error.message}`);
            return false;
        }
    }

    async testAgent1_2Integration() {
        const agent1 = new MonthlyIncomeCalculator();
        const agent2 = new CompoundingCalculator();
        
        // Test income calculation with compounding
        const accountValue = 50000;
        const targetGrowth = agent2.calculateMonthlyTarget(accountValue);
        const incomeReq = agent1.calculateMonthlyIncomeRequirements(accountValue, targetGrowth, 20);
        
        if (!incomeReq || !incomeReq.totals) {
            throw new Error('Agent 1-2 integration failed');
        }
        
        return { targetGrowth, incomeReq };
    }

    async testAgent1_3Integration() {
        const agent1 = new MonthlyIncomeCalculator();
        const agent3 = new TaxOptimizationEngine();
        
        // Test tax-optimized income calculation
        const result = agent1.calculateWithTaxOptimization(50000, 5000, agent3);
        
        if (!result || !result.taxOptimization) {
            throw new Error('Agent 1-3 integration failed');
        }
        
        return result;
    }

    async testAgent1_4Integration() {
        const agent1 = new MonthlyIncomeCalculator();
        const agent4 = new GreeksStreamingEngine();
        
        // Test Greeks validation for position sizing
        const position = {
            symbol: 'SPY',
            quantity: 10,
            type: 'PUT',
            strike: 450,
            expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };
        
        const validation = agent4.validatePositionSizing(position, 50000);
        
        if (!validation || typeof validation.valid !== 'boolean') {
            throw new Error('Agent 1-4 integration failed');
        }
        
        return validation;
    }

    async testAgent2_3Integration() {
        const agent2 = new CompoundingCalculator();
        const agent3 = new TaxOptimizationEngine();
        
        // Test tax-aware growth positioning
        const result = agent2.calculateTaxAwareGrowthPositioning(50000, 6000, 20, agent3);
        
        if (!result || !result.taxOptimized) {
            throw new Error('Agent 2-3 integration failed');
        }
        
        return result;
    }

    async testAgent2_4Integration() {
        const agent2 = new CompoundingCalculator();
        const agent4 = new GreeksStreamingEngine();
        
        // Test Greeks-based targeting
        const greeksData = {
            portfolio: {
                delta: 150,
                gamma: 300,
                theta: -500,
                vega: 1000
            }
        };
        
        const result = agent2.calculateGreeksBasedTargeting(50000, 6000, 20, greeksData);
        
        if (!result || !result.greeksAdjusted) {
            throw new Error('Agent 2-4 integration failed');
        }
        
        return result;
    }

    async testAgent3_4Integration() {
        const agent3 = new TaxOptimizationEngine();
        const agent4 = new GreeksStreamingEngine();
        
        // Test tax optimization with Greeks monitoring
        const greeksData = {
            portfolio: {
                delta: 150,
                gamma: 300,
                theta: -500,
                vega: 1000
            }
        };
        
        const result = agent3.integrateGreeksMonitoring(greeksData);
        
        if (!result || !result.taxImplications) {
            throw new Error('Agent 3-4 integration failed');
        }
        
        return result;
    }

    async testAgent3StrategyMix() {
        const agent3 = new TaxOptimizationEngine();
        
        // Test strategy mix optimization
        const strategies = [
            { name: '0DTE', allocation: 0.4, isFutures: false },
            { name: 'LT112', allocation: 0.35, isFutures: false },
            { name: 'Strangles', allocation: 0.25, isFutures: true }
        ];
        
        const result = agent3.optimizeStrategyMix(strategies, 50000);
        
        if (!result || !result.optimizedMix) {
            throw new Error('Agent 3 strategy mix failed');
        }
        
        return result;
    }

    async testAgent3QuarterlyPlanning() {
        const agent3 = new TaxOptimizationEngine();
        
        // Test quarterly planning integration
        const quarterlyPlan = {
            quarter: 1,
            targetIncome: 15000,
            currentGains: 5000
        };
        
        const result = agent3.integrateQuarterlyPlanning(quarterlyPlan);
        
        if (!result || !result.quarterlyStrategy) {
            throw new Error('Agent 3 quarterly planning failed');
        }
        
        return result;
    }

    async testAgent3CompoundingOptimization() {
        const agent3 = new TaxOptimizationEngine();
        
        // Test compounding strategy optimization
        const compoundingPlan = {
            currentCapital: 50000,
            monthlyTarget: 6000,
            timeHorizon: 8
        };
        
        const result = agent3.optimizeCompoundingStrategy(compoundingPlan);
        
        if (!result || !result.taxEfficientStrategy) {
            throw new Error('Agent 3 compounding optimization failed');
        }
        
        return result;
    }

    async testAgent3AgentIntegration() {
        const agent3 = new TaxOptimizationEngine();
        
        // Test full agent integration
        const integrationData = {
            agent1Data: { monthlyTarget: 5000 },
            agent2Data: { compoundTarget: 6000 },
            agent4Data: { portfolioGreeks: { theta: -500 } }
        };
        
        const result = agent3.optimizeWithAgentIntegration(integrationData);
        
        if (!result || !result.unifiedStrategy) {
            throw new Error('Agent 3 agent integration failed');
        }
        
        return result;
    }

    async testAgent4RiskMonitoring() {
        const agent4 = new GreeksStreamingEngine();
        
        // Test risk monitoring integration
        const riskData = {
            positions: [
                { symbol: 'SPY', delta: 50, gamma: 100 },
                { symbol: 'QQQ', delta: 30, gamma: 80 }
            ],
            limits: {
                maxDelta: 200,
                maxGamma: 300
            }
        };
        
        const result = agent4.integrateRiskMonitoring(riskData);
        
        if (!result || typeof result.riskScore !== 'number') {
            throw new Error('Agent 4 risk monitoring failed');
        }
        
        return result;
    }

    async testAgent4CompoundTargets() {
        const agent4 = new GreeksStreamingEngine();
        
        // Test compound targets adjustment
        const targetData = {
            baseTarget: 6000,
            currentGreeks: {
                delta: 150,
                gamma: 300,
                theta: -500
            }
        };
        
        const result = agent4.adjustCompoundTargets(targetData);
        
        if (!result || typeof result.adjustedTarget !== 'number') {
            throw new Error('Agent 4 compound targets failed');
        }
        
        return result;
    }

    async testAgent4SystemIntegration() {
        const agent4 = new GreeksStreamingEngine();
        
        // Test full system integration
        const systemData = {
            agent1: { monthlyTarget: 5000 },
            agent2: { compoundTarget: 6000 },
            agent3: { taxStrategy: 'section1256' }
        };
        
        const result = agent4.integrateWithAgentSystems(systemData);
        
        if (!result || !result.unifiedGreeksStrategy) {
            throw new Error('Agent 4 system integration failed');
        }
        
        return result;
    }

    async testAllAgentsWorkflow() {
        // Test complete workflow with all agents
        const agent1 = new MonthlyIncomeCalculator();
        const agent2 = new CompoundingCalculator();
        const agent3 = new TaxOptimizationEngine();
        const agent4 = new GreeksStreamingEngine();
        
        const accountValue = 50000;
        const vixLevel = 20;
        
        // Step 1: Calculate compound target
        const compoundTarget = agent2.calculateMonthlyTarget(accountValue);
        
        // Step 2: Calculate income requirements
        const incomeReq = agent1.calculateMonthlyIncomeRequirements(accountValue, compoundTarget, vixLevel);
        
        // Step 3: Optimize for taxes
        const taxOptimized = agent1.calculateWithTaxOptimization(accountValue, compoundTarget, agent3);
        
        // Step 4: Validate with Greeks
        const validation = agent4.validatePositionSizing({
            symbol: 'SPY',
            quantity: 10,
            type: 'PUT'
        }, accountValue);
        
        if (!compoundTarget || !incomeReq || !taxOptimized || !validation) {
            throw new Error('Complete workflow failed');
        }
        
        return {
            compoundTarget,
            incomeReq,
            taxOptimized,
            validation
        };
    }

    async runAllTests() {
        console.log('='.repeat(80));
        console.log('TOM KING TRADING FRAMEWORK - AGENT INTEGRATION TESTS');
        console.log('='.repeat(80));
        
        // Agent 1-2 Integration
        await this.runTest('Agent 1-2: Income-Compounding Integration', 
            () => this.testAgent1_2Integration());
        
        // Agent 1-3 Integration
        await this.runTest('Agent 1-3: Tax-Optimized Income', 
            () => this.testAgent1_3Integration());
        
        // Agent 1-4 Integration
        await this.runTest('Agent 1-4: Greeks Position Validation', 
            () => this.testAgent1_4Integration());
        
        // Agent 2-3 Integration
        await this.runTest('Agent 2-3: Tax-Aware Growth', 
            () => this.testAgent2_3Integration());
        
        // Agent 2-4 Integration
        await this.runTest('Agent 2-4: Greeks-Based Targeting', 
            () => this.testAgent2_4Integration());
        
        // Agent 3-4 Integration
        await this.runTest('Agent 3-4: Tax-Greeks Integration', 
            () => this.testAgent3_4Integration());
        
        // Agent 3 specific methods
        await this.runTest('Agent 3: Strategy Mix Optimization', 
            () => this.testAgent3StrategyMix());
        
        await this.runTest('Agent 3: Quarterly Planning', 
            () => this.testAgent3QuarterlyPlanning());
        
        await this.runTest('Agent 3: Compounding Optimization', 
            () => this.testAgent3CompoundingOptimization());
        
        await this.runTest('Agent 3: Full Agent Integration', 
            () => this.testAgent3AgentIntegration());
        
        // Agent 4 specific methods
        await this.runTest('Agent 4: Risk Monitoring', 
            () => this.testAgent4RiskMonitoring());
        
        await this.runTest('Agent 4: Compound Targets Adjustment', 
            () => this.testAgent4CompoundTargets());
        
        await this.runTest('Agent 4: System Integration', 
            () => this.testAgent4SystemIntegration());
        
        // Complete workflow test
        await this.runTest('All Agents: Complete Workflow', 
            () => this.testAllAgentsWorkflow());
        
        // Print summary
        console.log('\n' + '='.repeat(80));
        console.log('TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Tests: ${this.results.passed + this.results.failed}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
        
        // Save results
        const resultsPath = path.join(__dirname, 'INTEGRATION_TEST_RESULTS.json');
        fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
        console.log(`\nResults saved to: ${resultsPath}`);
        
        if (this.results.failed === 0) {
            console.log('\n🎉 ALL INTEGRATION TESTS PASSED! System is ready for production.');
        } else {
            console.log('\n⚠️ Some tests failed. Please review and fix the issues.');
        }
        
        return this.results;
    }
}

// Run tests
if (require.main === module) {
    const runner = new IntegrationTestRunner();
    runner.runAllTests().catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = IntegrationTestRunner;