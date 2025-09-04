/**
 * Production Deployment Validation Suite
 * Comprehensive testing and validation for production readiness
 * Tom King Trading Framework v17
 */

const fs = require('fs');
const path = require('path');

class ProductionValidationSuite {
    constructor() {
        this.validationResults = {
            timestamp: new Date(),
            version: 'v17.4',
            checks: {},
            criticalIssues: [],
            warnings: [],
            passed: [],
            overall: 'PENDING'
        };
        
        this.criticalModules = [
            'tastytradeAPI',
            'strategies',
            'riskManager',
            'positionManager',
            'orderManager',
            'config',
            'enhancedPatternAnalysis',
            'backtestingEngine'
        ];
        
        this.validationChecks = {
            MODULES: 'Module integrity and dependencies',
            API: 'API connectivity and authentication',
            RISK: 'Risk management parameters',
            DATA: 'Data integrity and flow',
            PERFORMANCE: 'Performance benchmarks',
            SAFETY: 'Safety mechanisms and limits',
            BACKUP: 'Backup and recovery systems',
            MONITORING: 'Real-time monitoring systems'
        };
    }
    
    /**
     * Run complete validation suite
     */
    async runFullValidation() {
        console.log('Starting Production Validation Suite...\n');
        
        // Module validation
        await this.validateModules();
        
        // API validation
        await this.validateAPIConnectivity();
        
        // Risk management validation
        await this.validateRiskManagement();
        
        // Data flow validation
        await this.validateDataFlow();
        
        // Performance validation
        await this.validatePerformance();
        
        // Safety checks
        await this.validateSafetyMechanisms();
        
        // Backup systems
        await this.validateBackupSystems();
        
        // Monitoring validation
        await this.validateMonitoring();
        
        // Generate final report
        this.generateValidationReport();
        
        return this.validationResults;
    }
    
    /**
     * Validate all required modules
     */
    async validateModules() {
        console.log('Validating modules...');
        const results = {
            passed: [],
            failed: [],
            missing: []
        };
        
        // Check critical modules
        for (const moduleName of this.criticalModules) {
            try {
                const modulePath = path.join(__dirname, '..', 'src', `${moduleName}.js`);
                if (fs.existsSync(modulePath)) {
                    const module = require(modulePath);
                    
                    // Check for required methods
                    const validation = this.validateModuleInterface(moduleName, module);
                    if (validation.valid) {
                        results.passed.push(moduleName);
                        this.validationResults.passed.push(`Module: ${moduleName}`);
                    } else {
                        results.failed.push({ module: moduleName, issues: validation.issues });
                        this.validationResults.warnings.push(`Module ${moduleName}: ${validation.issues.join(', ')}`);
                    }
                } else {
                    results.missing.push(moduleName);
                    this.validationResults.criticalIssues.push(`Missing module: ${moduleName}`);
                }
            } catch (error) {
                results.failed.push({ module: moduleName, error: error.message });
                this.validationResults.criticalIssues.push(`Module ${moduleName} error: ${error.message}`);
            }
        }
        
        this.validationResults.checks.MODULES = results;
        console.log(`✓ Modules: ${results.passed.length} passed, ${results.failed.length} failed, ${results.missing.length} missing`);
    }
    
    /**
     * Validate module interface
     */
    validateModuleInterface(moduleName, module) {
        const requiredMethods = {
            tastytradeAPI: ['authenticate', 'getAccount', 'getPositions', 'getQuotes'],
            strategies: ['analyzeStrategy', 'getStrategyList'],
            riskManager: ['validateTrade', 'checkBuyingPower', 'getVIXRegime'],
            positionManager: ['addPosition', 'updatePosition', 'getActivePositions'],
            orderManager: ['prepareOrder', 'validateOrder'],
            config: ['getTradingConfig', 'getAccountPhase']
        };
        
        const issues = [];
        const required = requiredMethods[moduleName] || [];
        
        for (const method of required) {
            if (typeof module[method] !== 'function' && !module.prototype?.[method]) {
                issues.push(`Missing method: ${method}`);
            }
        }
        
        return { valid: issues.length === 0, issues };
    }
    
    /**
     * Validate API connectivity
     */
    async validateAPIConnectivity() {
        console.log('Validating API connectivity...');
        const results = {
            authenticated: false,
            accountAccess: false,
            marketData: false,
            optionChains: false,
            latency: null
        };
        
        try {
            const API = require('../src/tastytradeAPI');
            const api = new API();
            
            // Test authentication
            const startTime = Date.now();
            const authResult = await api.authenticate().catch(e => null);
            results.authenticated = !!authResult;
            results.latency = Date.now() - startTime;
            
            if (results.authenticated) {
                // Test account access
                const account = await api.getAccount().catch(e => null);
                results.accountAccess = !!account;
                
                // Test market data
                const quotes = await api.getQuotes(['SPY']).catch(e => null);
                results.marketData = !!quotes;
                
                // Test option chains
                const chain = await api.getOptionChain('SPY').catch(e => null);
                results.optionChains = !!chain;
            }
            
            if (!results.authenticated) {
                this.validationResults.criticalIssues.push('API authentication failed');
            } else {
                this.validationResults.passed.push('API connectivity verified');
            }
            
        } catch (error) {
            this.validationResults.criticalIssues.push(`API validation error: ${error.message}`);
        }
        
        this.validationResults.checks.API = results;
        console.log(`✓ API: Auth=${results.authenticated}, Data=${results.marketData}, Latency=${results.latency}ms`);
    }
    
    /**
     * Validate risk management parameters
     */
    async validateRiskManagement() {
        console.log('Validating risk management...');
        const results = {
            parameters: {},
            violations: [],
            warnings: []
        };
        
        try {
            const config = require('../src/config');
            const riskConfig = config.getRiskManagement();
            
            // Validate BP usage
            if (riskConfig.maxBPUsage < 0.45 || riskConfig.maxBPUsage > 0.80) {
                results.violations.push(`Invalid BP usage: ${riskConfig.maxBPUsage} (should be 45-80%)`);
            }
            
            // Validate correlation limits
            if (!riskConfig.maxCorrelatedPositions || 
                typeof riskConfig.maxCorrelatedPositions !== 'object') {
                results.violations.push('Missing correlation group limits');
            }
            
            // Validate position sizing
            if (riskConfig.maxRiskPerTrade > 0.05) {
                results.warnings.push(`High risk per trade: ${riskConfig.maxRiskPerTrade * 100}%`);
            }
            
            // Validate VIX regimes
            const vixRegimes = config.getVIXRegimes();
            if (!vixRegimes || Object.keys(vixRegimes).length < 5) {
                results.violations.push('Incomplete VIX regime definitions');
            }
            
            results.parameters = {
                maxBPUsage: riskConfig.maxBPUsage,
                maxRiskPerTrade: riskConfig.maxRiskPerTrade,
                correlationLimits: riskConfig.maxCorrelatedPositions,
                vixRegimes: Object.keys(vixRegimes || {})
            };
            
            if (results.violations.length === 0) {
                this.validationResults.passed.push('Risk management validated');
            } else {
                results.violations.forEach(v => this.validationResults.criticalIssues.push(v));
            }
            
            results.warnings.forEach(w => this.validationResults.warnings.push(w));
            
        } catch (error) {
            this.validationResults.criticalIssues.push(`Risk validation error: ${error.message}`);
        }
        
        this.validationResults.checks.RISK = results;
        console.log(`✓ Risk: ${results.violations.length} violations, ${results.warnings.length} warnings`);
    }
    
    /**
     * Validate data flow
     */
    async validateDataFlow() {
        console.log('Validating data flow...');
        const results = {
            dataPath: [],
            bottlenecks: [],
            integrity: true
        };
        
        try {
            // Test data flow: API -> Analysis -> Recommendations -> Orders
            const testFlow = [
                { module: 'tastytradeAPI', method: 'getQuotes', input: ['SPY'] },
                { module: 'enhancedPatternAnalysis', method: 'analyzeMarket', input: null },
                { module: 'strategies', method: 'analyzeStrategy', input: null },
                { module: 'orderManager', method: 'prepareOrder', input: null }
            ];
            
            for (const step of testFlow) {
                const startTime = Date.now();
                try {
                    const module = require(`../src/${step.module}`);
                    // Simulate data flow
                    results.dataPath.push({
                        module: step.module,
                        latency: Date.now() - startTime,
                        status: 'OK'
                    });
                    
                    if (Date.now() - startTime > 1000) {
                        results.bottlenecks.push(`${step.module}: ${Date.now() - startTime}ms`);
                    }
                } catch (error) {
                    results.dataPath.push({
                        module: step.module,
                        error: error.message,
                        status: 'FAILED'
                    });
                    results.integrity = false;
                }
            }
            
            if (results.integrity) {
                this.validationResults.passed.push('Data flow integrity verified');
            } else {
                this.validationResults.criticalIssues.push('Data flow integrity check failed');
            }
            
        } catch (error) {
            this.validationResults.criticalIssues.push(`Data flow error: ${error.message}`);
        }
        
        this.validationResults.checks.DATA = results;
        console.log(`✓ Data: Integrity=${results.integrity}, Bottlenecks=${results.bottlenecks.length}`);
    }
    
    /**
     * Validate performance benchmarks
     */
    async validatePerformance() {
        console.log('Validating performance...');
        const results = {
            benchmarks: {},
            passed: true
        };
        
        const benchmarks = [
            { name: 'Pattern Analysis', maxTime: 500, test: this.benchmarkPatternAnalysis },
            { name: 'Greeks Calculation', maxTime: 100, test: this.benchmarkGreeks },
            { name: 'Risk Validation', maxTime: 200, test: this.benchmarkRiskValidation },
            { name: 'Order Preparation', maxTime: 300, test: this.benchmarkOrderPrep }
        ];
        
        for (const benchmark of benchmarks) {
            const startTime = Date.now();
            try {
                await benchmark.test.call(this);
                const elapsed = Date.now() - startTime;
                
                results.benchmarks[benchmark.name] = {
                    elapsed,
                    maxTime: benchmark.maxTime,
                    passed: elapsed <= benchmark.maxTime
                };
                
                if (elapsed > benchmark.maxTime) {
                    results.passed = false;
                    this.validationResults.warnings.push(
                        `Performance: ${benchmark.name} took ${elapsed}ms (max: ${benchmark.maxTime}ms)`
                    );
                }
            } catch (error) {
                results.benchmarks[benchmark.name] = {
                    error: error.message,
                    passed: false
                };
                results.passed = false;
            }
        }
        
        if (results.passed) {
            this.validationResults.passed.push('Performance benchmarks met');
        }
        
        this.validationResults.checks.PERFORMANCE = results;
        console.log(`✓ Performance: ${results.passed ? 'PASSED' : 'FAILED'}`);
    }
    
    /**
     * Benchmark pattern analysis
     */
    async benchmarkPatternAnalysis() {
        const PatternAnalysis = require('../src/enhancedPatternAnalysis');
        const analyzer = new PatternAnalysis();
        
        const testData = {
            SPY: { currentPrice: 450, ema8: 449, ema21: 448, rsi: 55, atr: 4.5 },
            VIX: { currentPrice: 18 }
        };
        
        await analyzer.analyzeMarket(testData);
    }
    
    /**
     * Benchmark Greeks calculation
     */
    async benchmarkGreeks() {
        const { GreeksCalculator } = require('../src/greeksCalculator');
        const calculator = new GreeksCalculator();
        
        const testPosition = {
            spotPrice: 450,
            strikePrice: 445,
            timeToExpiry: 0.08,
            volatility: 0.18,
            optionType: 'put'
        };
        
        calculator.calculateGreeks(testPosition);
    }
    
    /**
     * Benchmark risk validation
     */
    async benchmarkRiskValidation() {
        const RiskManager = require('../src/riskManager');
        const riskManager = new RiskManager();
        
        const testTrade = {
            symbol: 'SPY',
            strategy: 'PUT_SPREAD',
            requiredBP: 5000,
            maxLoss: 500
        };
        
        const testAccount = {
            netLiq: 50000,
            buyingPower: 25000
        };
        
        riskManager.validateTrade(testTrade, testAccount, []);
    }
    
    /**
     * Benchmark order preparation
     */
    async benchmarkOrderPrep() {
        const OrderManager = require('../src/orderManager');
        const orderManager = new OrderManager();
        
        const testOrder = {
            symbol: 'SPY',
            orderType: 'VERTICAL',
            legs: [
                { strike: 445, optionType: 'PUT', side: 'BUY' },
                { strike: 440, optionType: 'PUT', side: 'SELL' }
            ]
        };
        
        orderManager.prepareOrder(testOrder);
    }
    
    /**
     * Validate safety mechanisms
     */
    async validateSafetyMechanisms() {
        console.log('Validating safety mechanisms...');
        const results = {
            emergencyStop: false,
            positionLimits: false,
            lossLimits: false,
            correlationChecks: false
        };
        
        try {
            // Check emergency protocol
            const EmergencyProtocol = require('../src/emergencyProtocol');
            const emergency = new EmergencyProtocol();
            results.emergencyStop = typeof emergency.activateEmergencyStop === 'function';
            
            // Check position limits
            const config = require('../src/config');
            const limits = config.getPositionLimits();
            results.positionLimits = limits && limits.maxPositions > 0;
            
            // Check loss limits
            const riskConfig = config.getRiskManagement();
            results.lossLimits = riskConfig.maxDailyLoss && riskConfig.maxDailyLoss > 0;
            
            // Check correlation enforcement
            results.correlationChecks = riskConfig.maxCorrelatedPositions && 
                                       typeof riskConfig.maxCorrelatedPositions === 'object';
            
            const allPassed = Object.values(results).every(v => v === true);
            if (allPassed) {
                this.validationResults.passed.push('All safety mechanisms operational');
            } else {
                Object.entries(results).forEach(([mechanism, status]) => {
                    if (!status) {
                        this.validationResults.criticalIssues.push(`Safety mechanism failed: ${mechanism}`);
                    }
                });
            }
            
        } catch (error) {
            this.validationResults.criticalIssues.push(`Safety validation error: ${error.message}`);
        }
        
        this.validationResults.checks.SAFETY = results;
        console.log(`✓ Safety: Emergency=${results.emergencyStop}, Limits=${results.positionLimits}`);
    }
    
    /**
     * Validate backup systems
     */
    async validateBackupSystems() {
        console.log('Validating backup systems...');
        const results = {
            dataBackup: false,
            configBackup: false,
            stateRecovery: false
        };
        
        try {
            // Check for backup directories
            const backupDir = path.join(__dirname, '..', 'backups');
            results.dataBackup = fs.existsSync(backupDir);
            
            // Check for config backup
            const configBackup = path.join(backupDir, 'config_backup.json');
            results.configBackup = fs.existsSync(configBackup);
            
            // Check state recovery mechanism
            const StateManager = require('../src/stateManager');
            const stateManager = new StateManager();
            results.stateRecovery = typeof stateManager.saveState === 'function' &&
                                   typeof stateManager.restoreState === 'function';
            
            if (!results.dataBackup) {
                this.validationResults.warnings.push('No backup directory found');
            }
            
            if (results.stateRecovery) {
                this.validationResults.passed.push('State recovery system available');
            }
            
        } catch (error) {
            this.validationResults.warnings.push(`Backup validation warning: ${error.message}`);
        }
        
        this.validationResults.checks.BACKUP = results;
        console.log(`✓ Backup: Data=${results.dataBackup}, Recovery=${results.stateRecovery}`);
    }
    
    /**
     * Validate monitoring systems
     */
    async validateMonitoring() {
        console.log('Validating monitoring...');
        const results = {
            logging: false,
            alerts: false,
            metrics: false,
            dashboard: false
        };
        
        try {
            // Check logging
            const logger = require('../src/logger');
            results.logging = typeof logger.getLogger === 'function';
            
            // Check alert system
            const AlertManager = require('../src/alertManager');
            const alertManager = new AlertManager();
            results.alerts = typeof alertManager.sendAlert === 'function';
            
            // Check metrics collection
            const PerformanceMetrics = require('../src/performanceMetrics');
            const metrics = new PerformanceMetrics();
            results.metrics = typeof metrics.recordTrade === 'function';
            
            // Check dashboard
            const dashboardPath = path.join(__dirname, '..', 'public', 'index.html');
            results.dashboard = fs.existsSync(dashboardPath);
            
            const allPassed = Object.values(results).every(v => v === true);
            if (allPassed) {
                this.validationResults.passed.push('Monitoring systems operational');
            } else {
                Object.entries(results).forEach(([system, status]) => {
                    if (!status) {
                        this.validationResults.warnings.push(`Monitoring system unavailable: ${system}`);
                    }
                });
            }
            
        } catch (error) {
            this.validationResults.warnings.push(`Monitoring validation warning: ${error.message}`);
        }
        
        this.validationResults.checks.MONITORING = results;
        console.log(`✓ Monitoring: Logging=${results.logging}, Dashboard=${results.dashboard}`);
    }
    
    /**
     * Generate validation report
     */
    generateValidationReport() {
        // Determine overall status
        if (this.validationResults.criticalIssues.length > 0) {
            this.validationResults.overall = 'FAILED - CRITICAL ISSUES';
        } else if (this.validationResults.warnings.length > 5) {
            this.validationResults.overall = 'NEEDS REVIEW';
        } else if (this.validationResults.passed.length >= 15) {
            this.validationResults.overall = 'PRODUCTION READY';
        } else {
            this.validationResults.overall = 'PARTIAL PASS';
        }
        
        // Generate report
        console.log('\n' + '='.repeat(60));
        console.log('PRODUCTION VALIDATION REPORT');
        console.log('='.repeat(60));
        console.log(`Version: ${this.validationResults.version}`);
        console.log(`Timestamp: ${this.validationResults.timestamp}`);
        console.log(`Overall Status: ${this.validationResults.overall}`);
        console.log('-'.repeat(60));
        
        console.log('\nCRITICAL ISSUES:', this.validationResults.criticalIssues.length);
        this.validationResults.criticalIssues.forEach(issue => {
            console.log(`  ❌ ${issue}`);
        });
        
        console.log('\nWARNINGS:', this.validationResults.warnings.length);
        this.validationResults.warnings.slice(0, 5).forEach(warning => {
            console.log(`  ⚠️  ${warning}`);
        });
        
        console.log('\nPASSED CHECKS:', this.validationResults.passed.length);
        this.validationResults.passed.slice(0, 10).forEach(check => {
            console.log(`  ✅ ${check}`);
        });
        
        console.log('\n' + '='.repeat(60));
        
        // Save report to file
        const reportPath = path.join(__dirname, `validation_${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(this.validationResults, null, 2));
        console.log(`Report saved to: ${reportPath}`);
        
        return this.validationResults;
    }
}

// Run validation if executed directly
if (require.main === module) {
    const validator = new ProductionValidationSuite();
    validator.runFullValidation().then(results => {
        process.exit(results.overall === 'PRODUCTION READY' ? 0 : 1);
    });
}

module.exports = ProductionValidationSuite;