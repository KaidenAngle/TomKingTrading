/**
 * 24/7 Monitoring System for Tom King Trading Framework
 * Continuous monitoring without external alerts - logs only
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const { PerformanceMetrics } = require('./src/performanceMetrics');
const { RiskManager } = require('./src/riskManager');
const { GreeksStreamingEngine } = require('./src/greeksStreamingEngine');
const { MonthlyIncomeCalculator } = require('./src/monthlyIncomeCalculator');
const { CompoundingCalculator } = require('./src/compoundingCalculator');

class Monitoring24x7 extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            checkInterval: options.checkInterval || 60000, // 1 minute default
            logPath: options.logPath || path.join(__dirname, 'logs', 'monitoring'),
            enableFileLogging: options.enableFileLogging !== false,
            maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
            retainDays: options.retainDays || 30
        };
        
        // System components
        this.performanceMetrics = new PerformanceMetrics();
        this.riskManager = new RiskManager();
        this.greeksEngine = null; // Will be initialized with API
        this.incomeCalculator = new MonthlyIncomeCalculator();
        this.compoundingCalc = new CompoundingCalculator();
        
        // Monitoring state
        this.state = {
            isRunning: false,
            startTime: null,
            lastCheck: null,
            checksPerformed: 0,
            issues: [],
            systemHealth: 'INITIALIZING'
        };
        
        // Thresholds for monitoring
        this.thresholds = {
            maxBPUsage: 0.50, // 50% max for Phase 4
            minAccountBalance: 30000,
            maxDrawdown: 0.15, // 15% max drawdown
            maxDailyLoss: 0.05, // 5% max daily loss
            targetMonthlyReturn: 0.12, // 12% target
            maxCorrelatedPositions: 3,
            criticalVIX: 35,
            warningVIX: 25
        };
        
        this.setupLogging();
    }

    /**
     * Setup logging system
     */
    setupLogging() {
        if (this.config.enableFileLogging) {
            // Create logs directory if it doesn't exist
            if (!fs.existsSync(this.config.logPath)) {
                fs.mkdirSync(this.config.logPath, { recursive: true });
            }
            
            // Setup log rotation
            this.currentLogFile = this.getLogFileName();
            this.logStream = fs.createWriteStream(
                path.join(this.config.logPath, this.currentLogFile),
                { flags: 'a' }
            );
        }
    }

    /**
     * Start 24/7 monitoring
     */
    async start(tradingSystem = null) {
        if (this.state.isRunning) {
            this.log('WARNING', 'Monitoring already running');
            return;
        }
        
        this.tradingSystem = tradingSystem;
        this.state.isRunning = true;
        this.state.startTime = new Date();
        this.state.systemHealth = 'OPERATIONAL';
        
        this.log('INFO', '🚀 24/7 Monitoring System Started');
        this.log('INFO', `Check interval: ${this.config.checkInterval}ms`);
        
        // Start monitoring loop
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.checkInterval);
        
        // Perform initial check
        await this.performHealthCheck();
        
        // Setup graceful shutdown
        this.setupShutdownHandlers();
        
        return true;
    }

    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        try {
            this.state.lastCheck = new Date();
            this.state.checksPerformed++;
            
            const healthReport = {
                timestamp: this.state.lastCheck,
                checkNumber: this.state.checksPerformed,
                systemHealth: 'OPERATIONAL',
                issues: [],
                metrics: {},
                recommendations: []
            };
            
            // 1. Check account health
            const accountHealth = await this.checkAccountHealth();
            healthReport.metrics.account = accountHealth;
            if (accountHealth.issues.length > 0) {
                healthReport.issues.push(...accountHealth.issues);
            }
            
            // 2. Check risk metrics
            const riskHealth = await this.checkRiskHealth();
            healthReport.metrics.risk = riskHealth;
            if (riskHealth.issues.length > 0) {
                healthReport.issues.push(...riskHealth.issues);
            }
            
            // 3. Check position health
            const positionHealth = await this.checkPositionHealth();
            healthReport.metrics.positions = positionHealth;
            if (positionHealth.issues.length > 0) {
                healthReport.issues.push(...positionHealth.issues);
            }
            
            // 4. Check Greeks exposure
            const greeksHealth = await this.checkGreeksHealth();
            healthReport.metrics.greeks = greeksHealth;
            if (greeksHealth.issues.length > 0) {
                healthReport.issues.push(...greeksHealth.issues);
            }
            
            // 5. Check performance metrics
            const performanceHealth = await this.checkPerformanceHealth();
            healthReport.metrics.performance = performanceHealth;
            if (performanceHealth.issues.length > 0) {
                healthReport.issues.push(...performanceHealth.issues);
            }
            
            // 6. Check system resources
            const systemHealth = this.checkSystemResources();
            healthReport.metrics.system = systemHealth;
            if (systemHealth.issues.length > 0) {
                healthReport.issues.push(...systemHealth.issues);
            }
            
            // Determine overall health
            if (healthReport.issues.length === 0) {
                healthReport.systemHealth = 'HEALTHY';
            } else if (healthReport.issues.some(i => i.severity === 'CRITICAL')) {
                healthReport.systemHealth = 'CRITICAL';
            } else if (healthReport.issues.some(i => i.severity === 'WARNING')) {
                healthReport.systemHealth = 'WARNING';
            } else {
                healthReport.systemHealth = 'OPERATIONAL';
            }
            
            // Update state
            this.state.systemHealth = healthReport.systemHealth;
            this.state.issues = healthReport.issues;
            
            // Log the health check
            this.logHealthReport(healthReport);
            
            // Emit health update event
            this.emit('healthCheck', healthReport);
            
            return healthReport;
            
        } catch (error) {
            this.log('ERROR', `Health check failed: ${error.message}`);
            this.state.systemHealth = 'ERROR';
            return null;
        }
    }

    /**
     * Check account health
     */
    async checkAccountHealth() {
        const health = {
            balance: 0,
            buyingPower: 0,
            bpUsage: 0,
            issues: []
        };
        
        try {
            if (this.tradingSystem && this.tradingSystem.account) {
                health.balance = this.tradingSystem.account.balance;
                health.buyingPower = this.tradingSystem.account.buyingPower;
                health.bpUsage = 1 - (health.buyingPower / health.balance);
                
                // Check thresholds
                if (health.balance < this.thresholds.minAccountBalance) {
                    health.issues.push({
                        type: 'ACCOUNT_BALANCE_LOW',
                        severity: 'WARNING',
                        message: `Account balance £${health.balance} below minimum £${this.thresholds.minAccountBalance}`
                    });
                }
                
                if (health.bpUsage > this.thresholds.maxBPUsage) {
                    health.issues.push({
                        type: 'BP_USAGE_HIGH',
                        severity: 'WARNING',
                        message: `BP usage ${(health.bpUsage * 100).toFixed(1)}% exceeds maximum ${(this.thresholds.maxBPUsage * 100)}%`
                    });
                }
            }
        } catch (error) {
            health.issues.push({
                type: 'ACCOUNT_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Check risk health
     */
    async checkRiskHealth() {
        const health = {
            vixLevel: 20,
            correlationGroups: 0,
            maxDrawdown: 0,
            dailyPL: 0,
            issues: []
        };
        
        try {
            // Get VIX level
            health.vixLevel = this.riskManager.getCurrentVIX() || 20;
            
            // Check VIX thresholds
            if (health.vixLevel > this.thresholds.criticalVIX) {
                health.issues.push({
                    type: 'VIX_CRITICAL',
                    severity: 'CRITICAL',
                    message: `VIX at ${health.vixLevel} exceeds critical level ${this.thresholds.criticalVIX}`
                });
            } else if (health.vixLevel > this.thresholds.warningVIX) {
                health.issues.push({
                    type: 'VIX_WARNING',
                    severity: 'WARNING',
                    message: `VIX at ${health.vixLevel} exceeds warning level ${this.thresholds.warningVIX}`
                });
            }
            
            // Check correlation groups
            if (this.tradingSystem && this.tradingSystem.positions) {
                const correlationAnalysis = this.riskManager.analyzeCorrelations(
                    this.tradingSystem.positions
                );
                
                if (correlationAnalysis.maxGroupSize > this.thresholds.maxCorrelatedPositions) {
                    health.issues.push({
                        type: 'CORRELATION_LIMIT_EXCEEDED',
                        severity: 'WARNING',
                        message: `Correlation group size ${correlationAnalysis.maxGroupSize} exceeds limit ${this.thresholds.maxCorrelatedPositions}`
                    });
                }
            }
            
        } catch (error) {
            health.issues.push({
                type: 'RISK_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Check position health
     */
    async checkPositionHealth() {
        const health = {
            openPositions: 0,
            profitablePositions: 0,
            losingPositions: 0,
            at21DTE: 0,
            issues: []
        };
        
        try {
            if (this.tradingSystem && this.tradingSystem.positions) {
                const positions = this.tradingSystem.positions;
                health.openPositions = positions.length;
                
                for (const position of positions) {
                    // Check P&L
                    if (position.unrealizedPL > 0) {
                        health.profitablePositions++;
                    } else if (position.unrealizedPL < 0) {
                        health.losingPositions++;
                    }
                    
                    // Check DTE for management
                    if (position.daysToExpiration <= 21 && position.daysToExpiration > 0) {
                        health.at21DTE++;
                        health.issues.push({
                            type: 'POSITION_NEAR_EXPIRY',
                            severity: 'INFO',
                            message: `Position ${position.symbol} at ${position.daysToExpiration} DTE - consider management`
                        });
                    }
                    
                    // Check for 50% profit target
                    if (position.unrealizedPL > position.maxProfit * 0.5) {
                        health.issues.push({
                            type: 'PROFIT_TARGET_REACHED',
                            severity: 'INFO',
                            message: `Position ${position.symbol} at ${(position.unrealizedPL / position.maxProfit * 100).toFixed(0)}% profit - consider closing`
                        });
                    }
                }
            }
        } catch (error) {
            health.issues.push({
                type: 'POSITION_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Check Greeks health
     */
    async checkGreeksHealth() {
        const health = {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            issues: []
        };
        
        try {
            if (this.greeksEngine) {
                const portfolioGreeks = this.greeksEngine.getPortfolioGreeks();
                health.delta = portfolioGreeks.netDelta;
                health.gamma = portfolioGreeks.netGamma;
                health.theta = portfolioGreeks.netTheta;
                health.vega = portfolioGreeks.netVega;
                
                // Check Greeks thresholds
                if (Math.abs(health.delta) > 200) {
                    health.issues.push({
                        type: 'DELTA_HIGH',
                        severity: 'WARNING',
                        message: `Portfolio delta ${health.delta.toFixed(0)} exceeds safe range`
                    });
                }
                
                if (Math.abs(health.gamma) > 500) {
                    health.issues.push({
                        type: 'GAMMA_HIGH',
                        severity: 'WARNING',
                        message: `Portfolio gamma ${health.gamma.toFixed(0)} indicates high risk`
                    });
                }
                
                if (health.theta < -1000) {
                    health.issues.push({
                        type: 'THETA_DECAY_HIGH',
                        severity: 'INFO',
                        message: `High theta decay £${Math.abs(health.theta).toFixed(0)}/day`
                    });
                }
            }
        } catch (error) {
            health.issues.push({
                type: 'GREEKS_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Check performance health
     */
    async checkPerformanceHealth() {
        const health = {
            dailyPL: 0,
            monthlyReturn: 0,
            winRate: 0,
            onTrack: false,
            issues: []
        };
        
        try {
            const metrics = this.performanceMetrics.getMetrics();
            
            health.dailyPL = metrics.daily.totalPL;
            health.monthlyReturn = metrics.monthly.returnPercentage;
            health.winRate = metrics.overall.winRate;
            
            // Check daily loss limit
            if (health.dailyPL < -this.thresholds.maxDailyLoss * (this.tradingSystem?.account?.balance || 35000)) {
                health.issues.push({
                    type: 'DAILY_LOSS_LIMIT',
                    severity: 'CRITICAL',
                    message: `Daily loss £${Math.abs(health.dailyPL).toFixed(0)} exceeds ${(this.thresholds.maxDailyLoss * 100)}% limit`
                });
            }
            
            // Check monthly target
            health.onTrack = health.monthlyReturn >= this.thresholds.targetMonthlyReturn * 0.8;
            if (!health.onTrack) {
                health.issues.push({
                    type: 'BELOW_TARGET',
                    severity: 'INFO',
                    message: `Monthly return ${(health.monthlyReturn * 100).toFixed(1)}% below ${(this.thresholds.targetMonthlyReturn * 100)}% target`
                });
            }
            
        } catch (error) {
            health.issues.push({
                type: 'PERFORMANCE_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Check system resources
     */
    checkSystemResources() {
        const health = {
            memoryUsage: 0,
            uptime: 0,
            issues: []
        };
        
        try {
            const memUsage = process.memoryUsage();
            health.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
            health.uptime = process.uptime() / 3600; // Hours
            
            // Check memory usage
            if (health.memoryUsage > 500) {
                health.issues.push({
                    type: 'MEMORY_HIGH',
                    severity: 'WARNING',
                    message: `Memory usage ${health.memoryUsage.toFixed(0)}MB is high`
                });
            }
            
        } catch (error) {
            health.issues.push({
                type: 'SYSTEM_CHECK_ERROR',
                severity: 'ERROR',
                message: error.message
            });
        }
        
        return health;
    }

    /**
     * Log health report
     */
    logHealthReport(report) {
        const logEntry = {
            ...report,
            uptime: this.getUptime()
        };
        
        // Console log based on health
        if (report.systemHealth === 'CRITICAL') {
            console.error('🔴 CRITICAL:', report.issues.map(i => i.message).join(', '));
        } else if (report.systemHealth === 'WARNING') {
            console.warn('🟡 WARNING:', report.issues.map(i => i.message).join(', '));
        } else if (report.systemHealth === 'HEALTHY') {
            console.log('🟢 System healthy - Check #' + report.checkNumber);
        }
        
        // File logging
        if (this.config.enableFileLogging && this.logStream) {
            this.logStream.write(JSON.stringify(logEntry) + '\n');
            
            // Check log rotation
            this.checkLogRotation();
        }
    }

    /**
     * Log message
     */
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data
        };
        
        // Console output
        console.log(`[${timestamp}] [${level}] ${message}`);
        
        // File output
        if (this.config.enableFileLogging && this.logStream) {
            this.logStream.write(JSON.stringify(logEntry) + '\n');
        }
    }

    /**
     * Get log file name
     */
    getLogFileName() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        return `monitoring_${dateStr}.log`;
    }

    /**
     * Check if log rotation needed
     */
    checkLogRotation() {
        try {
            const currentFile = path.join(this.config.logPath, this.currentLogFile);
            const stats = fs.statSync(currentFile);
            
            // Rotate if file too large
            if (stats.size > this.config.maxLogSize) {
                this.rotateLog();
            }
            
            // Check if date changed
            const newLogFile = this.getLogFileName();
            if (newLogFile !== this.currentLogFile) {
                this.rotateLog();
            }
            
            // Clean old logs
            this.cleanOldLogs();
            
        } catch (error) {
            // Ignore rotation errors
        }
    }

    /**
     * Rotate log file
     */
    rotateLog() {
        if (this.logStream) {
            this.logStream.end();
        }
        
        this.currentLogFile = this.getLogFileName();
        this.logStream = fs.createWriteStream(
            path.join(this.config.logPath, this.currentLogFile),
            { flags: 'a' }
        );
    }

    /**
     * Clean old log files
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.config.logPath);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.retainDays);
            
            for (const file of files) {
                if (file.startsWith('monitoring_') && file.endsWith('.log')) {
                    const filePath = path.join(this.config.logPath, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        this.log('INFO', `Deleted old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    /**
     * Get uptime
     */
    getUptime() {
        if (!this.state.startTime) return '0s';
        
        const uptime = Date.now() - this.state.startTime.getTime();
        const hours = Math.floor(uptime / 3600000);
        const minutes = Math.floor((uptime % 3600000) / 60000);
        const seconds = Math.floor((uptime % 60000) / 1000);
        
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    /**
     * Setup shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = () => {
            this.stop();
            process.exit(0);
        };
        
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.state.isRunning) return;
        
        this.state.isRunning = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        if (this.logStream) {
            this.logStream.end();
        }
        
        this.log('INFO', '🛑 24/7 Monitoring System Stopped');
        this.log('INFO', `Total uptime: ${this.getUptime()}`);
        this.log('INFO', `Total checks performed: ${this.state.checksPerformed}`);
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...this.state,
            uptime: this.getUptime()
        };
    }
}

// Export for use
module.exports = Monitoring24x7;

// Run standalone if executed directly
if (require.main === module) {
    const monitor = new Monitoring24x7({
        checkInterval: 30000, // 30 seconds for testing
        enableFileLogging: true
    });
    
    monitor.start();
    
    console.log('📡 24/7 Monitoring System Running');
    console.log('Press Ctrl+C to stop');
}