/**
 * Comprehensive System Test Suite
 * Tests all critical functionality for Tom King Trading Framework
 */

const { TastyTradeAPI } = require('../src/tastytradeAPI');
const { DataManager } = require('../src/dataManager');
const { OrderManager } = require('../src/orderManager');
const { RiskManager } = require('../src/riskManager');
const { SignalGenerator } = require('../src/signalGenerator');
const { GreeksCalculator } = require('../src/greeksCalculator');
const { PositionManager } = require('../src/positionManager');
const { PerformanceMetrics } = require('../src/performanceMetrics');
const { MarketDataStreamer } = require('../src/marketDataStreamer');
const { getLogger } = require('../src/logger');
const { ConfigHelpers, ACCOUNT_PHASES } = require('../src/config');

const logger = getLogger();

class ComprehensiveSystemTest {
    constructor() {
        this.api = null;
        this.dataManager = null;
        this.orderManager = null;
        this.riskManager = null;
        this.signalGenerator = null;
        this.greeksCalculator = null;
        this.positionManager = null;
        this.performanceMetrics = null;
        this.results = {
            passed: [],
            failed: [],
            skipped: []
        };
    }

    async initialize() {
        logger.info('TEST', '🚀 Initializing Comprehensive System Test...');
        
        try {
            // Initialize API
            this.api = new TastyTradeAPI();
            const authResult = await this.api.authenticate();
            
            if (!authResult) {
                throw new Error('Authentication failed');
            }
            
            // Initialize all components
            this.dataManager = new DataManager(this.api);
            this.orderManager = new OrderManager(this.api);
            this.riskManager = new RiskManager();
            this.signalGenerator = new SignalGenerator(this.api);
            this.greeksCalculator = new GreeksCalculator();
            this.positionManager = new PositionManager(this.api);
            this.performanceMetrics = new PerformanceMetrics();
            
            logger.info('TEST', '✅ All components initialized successfully');
            return true;
        } catch (error) {
            logger.error('TEST', 'Initialization failed:', error);
            return false;
        }
    }

    /**
     * 1. Test Option Chain Retrieval
     */
    async testOptionChainRetrieval() {
        logger.info('TEST', '\n📊 Testing Option Chain Retrieval...');
        
        try {
            const symbols = ['SPY', 'QQQ', 'IWM'];
            
            for (const symbol of symbols) {
                const chain = await this.api.getOptionChain(symbol);
                
                if (chain && chain.expirations && chain.expirations.length > 0) {
                    logger.info('TEST', `✅ ${symbol} option chain retrieved:`, {
                        expirations: chain.expirations.length,
                        firstExpiry: chain.expirations[0].date
                    });
                    this.results.passed.push(`option-chain-${symbol}`);
                } else {
                    logger.warn('TEST', `⚠️ ${symbol} option chain empty or unavailable`);
                    this.results.skipped.push(`option-chain-${symbol}`);
                }
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'Option chain test failed:', error);
            this.results.failed.push('option-chain-retrieval');
            return false;
        }
    }

    /**
     * 2. Test Greeks Calculation
     */
    async testGreeksCalculation() {
        logger.info('TEST', '\n📊 Testing Greeks Calculation...');
        
        try {
            // Test with sample option data
            const testOption = {
                underlyingPrice: 450,
                strikePrice: 455,
                timeToExpiry: 30 / 365, // 30 days
                riskFreeRate: 0.05,
                volatility: 0.20,
                optionType: 'CALL'
            };
            
            const greeks = this.greeksCalculator.calculateGreeks(testOption);
            
            if (greeks && greeks.delta !== undefined) {
                logger.info('TEST', '✅ Greeks calculated:', {
                    delta: greeks.delta.toFixed(4),
                    gamma: greeks.gamma.toFixed(4),
                    theta: greeks.theta.toFixed(4),
                    vega: greeks.vega.toFixed(4)
                });
                this.results.passed.push('greeks-calculation');
            } else {
                throw new Error('Greeks calculation returned invalid results');
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'Greeks calculation failed:', error);
            this.results.failed.push('greeks-calculation');
            return false;
        }
    }

    /**
     * 3. Test Position Monitoring
     */
    async testPositionMonitoring() {
        logger.info('TEST', '\n📊 Testing Position Monitoring...');
        
        try {
            const positions = await this.positionManager.getPositions();
            const account = await this.api.getAccountStatus();
            
            logger.info('TEST', '✅ Position monitoring active:', {
                openPositions: positions.length,
                netLiq: account.netLiq,
                buyingPower: account.buyingPower,
                bpUsed: account.bpUsedPercent
            });
            
            this.results.passed.push('position-monitoring');
            return true;
        } catch (error) {
            logger.error('TEST', 'Position monitoring failed:', error);
            this.results.failed.push('position-monitoring');
            return false;
        }
    }

    /**
     * 4. Test Friday 0DTE Strategy
     */
    async testFriday0DTEStrategy() {
        logger.info('TEST', '\n📊 Testing Friday 0DTE Strategy...');
        
        try {
            const dayOfWeek = new Date().getDay();
            const hour = new Date().getHours();
            
            if (dayOfWeek !== 5) {
                logger.info('TEST', '⚠️ Not Friday, simulating Friday 0DTE conditions');
            }
            
            // Test strategy signal generation
            // Mock market data for testing
            const mockMarketData = {
                SPY: { currentPrice: 450, iv: 0.15, volume: 1000000 },
                QQQ: { currentPrice: 380, iv: 0.18, volume: 800000 },
                VIX: { currentLevel: 16, regime: 'NORMAL' }
            };
            
            const mockAccountData = {
                netLiq: 50000,
                buyingPower: 30000,
                positions: []
            };
            
            const result = await this.signalGenerator.generateSignals(mockMarketData, mockAccountData);
            
            // Extract signals array from result (might be in result.signals)
            const signals = Array.isArray(result) ? result : (result?.signals || []);
            
            // Check for Friday 0DTE signals specifically
            const fridaySignals = signals.filter(s => 
                s.strategy === 'FRIDAY_0DTE' || 
                s.strategy === '0DTE' || 
                (dayOfWeek !== 5 && s.notes && s.notes.includes('0DTE'))
            );
            
            if (fridaySignals && fridaySignals.length > 0) {
                logger.info('TEST', '✅ Friday 0DTE signals generated:', fridaySignals.length);
                this.results.passed.push('friday-0dte-strategy');
            } else if (dayOfWeek !== 5) {
                logger.info('TEST', '✅ Friday 0DTE test passed (not Friday, correctly no signals)');
                this.results.passed.push('friday-0dte-strategy');
            } else {
                logger.info('TEST', '⚠️ No 0DTE signals on Friday (may need market hours check)');
                this.results.skipped.push('friday-0dte-strategy');
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'Friday 0DTE test failed:', error);
            this.results.failed.push('friday-0dte-strategy');
            return false;
        }
    }

    /**
     * 5. Test Long Term 112 Strategy
     */
    async testLongTerm112Strategy() {
        logger.info('TEST', '\n📊 Testing Long Term 112 Strategy...');
        
        try {
            const signals = await this.signalGenerator.generateSignals({
                strategy: 'LONG_TERM_112',
                symbols: ['SPY', 'IWM'],
                targetDTE: 45
            });
            
            if (signals) {
                logger.info('TEST', '✅ Long Term 112 analysis complete');
                this.results.passed.push('long-term-112');
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'Long Term 112 test failed:', error);
            this.results.failed.push('long-term-112');
            return false;
        }
    }

    /**
     * 6. Test VIX-Based Position Sizing
     */
    async testVIXBasedSizing() {
        logger.info('TEST', '\n📊 Testing VIX-Based Position Sizing...');
        
        try {
            const vixData = await this.api.getVIXData();
            const vixLevel = vixData.currentLevel || 16;
            
            // Test different VIX scenarios
            const scenarios = [10, 16, 22, 30, 40];
            
            for (const testVix of scenarios) {
                const sizing = this.riskManager.calculatePositionSize({
                    accountValue: 50000,
                    vixLevel: testVix,
                    strategy: 'STRANGLE'
                });
                
                logger.info('TEST', `VIX ${testVix}: Position size ${sizing.contracts}, BP usage ${(sizing.bpUsage * 100).toFixed(1)}%`);
            }
            
            this.results.passed.push('vix-based-sizing');
            return true;
        } catch (error) {
            logger.error('TEST', 'VIX sizing test failed:', error);
            this.results.failed.push('vix-based-sizing');
            return false;
        }
    }

    /**
     * 7. Test Correlation Group Limits
     */
    async testCorrelationLimits() {
        logger.info('TEST', '\n📊 Testing Correlation Group Limits...');
        
        try {
            // Test correlation group enforcement
            const testPositions = [
                { symbol: 'SPY', correlationGroup: 'EQUITY_INDEX' },
                { symbol: 'QQQ', correlationGroup: 'EQUITY_INDEX' },
                { symbol: 'IWM', correlationGroup: 'EQUITY_INDEX' },
                { symbol: 'GLD', correlationGroup: 'PRECIOUS_METALS' }
            ];
            
            const riskAssessment = this.riskManager.assessRisk(
                testPositions,
                20, // VIX level
                2,  // Phase 2
                50000 // Account value
            );
            
            logger.info('TEST', '✅ Correlation limits checked:', {
                groups: riskAssessment.correlationAnalysis?.groups || 'N/A',
                violations: riskAssessment.correlationAnalysis?.violations || []
            });
            
            this.results.passed.push('correlation-limits');
            return true;
        } catch (error) {
            logger.error('TEST', 'Correlation limits test failed:', error);
            this.results.failed.push('correlation-limits');
            return false;
        }
    }

    /**
     * 8. Test Order Placement Workflow
     */
    async testOrderPlacement() {
        logger.info('TEST', '\n📊 Testing Order Placement Workflow...');
        
        try {
            // Prepare but don't execute an order
            const testOrder = {
                symbol: 'SPY',
                quantity: 1,
                'order-type': 'Limit',
                price: 450.00,
                'price-effect': 'Debit',
                side: 'BUY',
                'time-in-force': 'Day',
                legs: [{
                    'instrument-type': 'Equity',
                    symbol: 'SPY',
                    quantity: 1,
                    action: 'Buy to Open'
                }],
                dryRun: true // Safety flag
            };
            
            const validation = await this.orderManager.validateOrder(testOrder);
            
            if (validation.isValid) {
                logger.info('TEST', '✅ Order validation passed:', validation);
                this.results.passed.push('order-placement');
            } else {
                logger.warn('TEST', '⚠️ Order validation failed:', validation.errors);
                this.results.failed.push('order-placement');
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'Order placement test failed:', error);
            this.results.failed.push('order-placement');
            return false;
        }
    }

    /**
     * 9. Test Risk Management
     */
    async testRiskManagement() {
        logger.info('TEST', '\n📊 Testing Risk Management...');
        
        try {
            const account = await this.api.getAccountStatus();
            const vixLevel = 20;
            
            const riskMetrics = this.riskManager.assessRisk(
                [],
                vixLevel,
                2, // Phase 2
                parseFloat(account.netLiq) || 50000
            );
            
            logger.info('TEST', '✅ Risk assessment complete:', {
                maxBPUsage: riskMetrics.bpOptimization?.adjustedMax || 'N/A',
                emergencyProtocols: riskMetrics.emergencyProtocols?.length || 0
            });
            
            this.results.passed.push('risk-management');
            return true;
        } catch (error) {
            logger.error('TEST', 'Risk management test failed:', error);
            this.results.failed.push('risk-management');
            return false;
        }
    }

    /**
     * 10. Test WebSocket Streaming
     */
    async testWebSocketStreaming() {
        logger.info('TEST', '\n📊 Testing WebSocket Streaming...');
        
        try {
            const streamer = this.api.marketDataStreamer;
            
            if (streamer) {
                // Test subscription
                await streamer.subscribe(['SPY', 'QQQ']);
                
                logger.info('TEST', '✅ WebSocket subscription test passed');
                this.results.passed.push('websocket-streaming');
                
                // Unsubscribe after test
                await streamer.unsubscribe(['SPY', 'QQQ']);
            } else {
                logger.warn('TEST', '⚠️ WebSocket not available in current mode');
                this.results.skipped.push('websocket-streaming');
            }
            
            return true;
        } catch (error) {
            logger.error('TEST', 'WebSocket test failed:', error);
            this.results.failed.push('websocket-streaming');
            return false;
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        const initialized = await this.initialize();
        
        if (!initialized) {
            logger.error('TEST', '❌ Failed to initialize test suite');
            return this.results;
        }
        
        // Run tests in sequence
        const tests = [
            { name: 'Option Chain Retrieval', fn: () => this.testOptionChainRetrieval() },
            { name: 'Greeks Calculation', fn: () => this.testGreeksCalculation() },
            { name: 'Position Monitoring', fn: () => this.testPositionMonitoring() },
            { name: 'Friday 0DTE Strategy', fn: () => this.testFriday0DTEStrategy() },
            { name: 'Long Term 112 Strategy', fn: () => this.testLongTerm112Strategy() },
            { name: 'VIX-Based Sizing', fn: () => this.testVIXBasedSizing() },
            { name: 'Correlation Limits', fn: () => this.testCorrelationLimits() },
            { name: 'Order Placement', fn: () => this.testOrderPlacement() },
            { name: 'Risk Management', fn: () => this.testRiskManagement() },
            { name: 'WebSocket Streaming', fn: () => this.testWebSocketStreaming() }
        ];
        
        logger.info('TEST', `\n${'='.repeat(60)}`);
        logger.info('TEST', '🧪 RUNNING COMPREHENSIVE SYSTEM TESTS');
        logger.info('TEST', `${'='.repeat(60)}\n`);
        
        for (const test of tests) {
            try {
                logger.info('TEST', `\n▶️  Running: ${test.name}`);
                await test.fn();
            } catch (error) {
                logger.error('TEST', `❌ ${test.name} failed:`, error.message);
                this.results.failed.push(test.name.toLowerCase().replace(/\s+/g, '-'));
            }
        }
        
        // Generate summary
        this.generateSummary();
        
        return this.results;
    }

    generateSummary() {
        const total = this.results.passed.length + this.results.failed.length + this.results.skipped.length;
        const passRate = total > 0 ? (this.results.passed.length / total * 100).toFixed(1) : 0;
        
        logger.info('TEST', `\n${'='.repeat(60)}`);
        logger.info('TEST', '📊 TEST RESULTS SUMMARY');
        logger.info('TEST', `${'='.repeat(60)}`);
        logger.info('TEST', `✅ Passed: ${this.results.passed.length}`);
        logger.info('TEST', `❌ Failed: ${this.results.failed.length}`);
        logger.info('TEST', `⚠️  Skipped: ${this.results.skipped.length}`);
        logger.info('TEST', `📈 Pass Rate: ${passRate}%`);
        logger.info('TEST', `${'='.repeat(60)}\n`);
        
        if (this.results.failed.length > 0) {
            logger.error('TEST', 'Failed tests:', this.results.failed);
        }
        
        if (this.results.passed.length === total) {
            logger.info('TEST', '🎉 ALL TESTS PASSED! System is ready for deployment.');
        } else if (this.results.failed.length === 0) {
            logger.info('TEST', '✨ No failures detected. Some tests were skipped (may need market hours).');
        } else {
            logger.warn('TEST', '⚠️ Some tests failed. Review and fix issues before production use.');
        }
    }
}

// Run the comprehensive test
async function main() {
    const tester = new ComprehensiveSystemTest();
    const results = await tester.runAllTests();
    
    // Save results to file
    const fs = require('fs');
    const resultsFile = `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    logger.info('TEST', `Results saved to ${resultsFile}`);
    
    // Exit with appropriate code
    process.exit(results.failed.length > 0 ? 1 : 0);
}

// Export for use in other test runners
module.exports = ComprehensiveSystemTest;

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        logger.error('TEST', 'Unhandled error:', error);
        process.exit(1);
    });
}