/**
 * 24/7 System Monitor
 * Continuous monitoring of Tom King Trading Framework
 * Includes health checks, alerting, and auto-recovery
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { TastyTradeAPI } = require('../src/tastytradeAPI');
const { RiskManager } = require('../src/riskManager');
const { PerformanceMetrics } = require('../src/performanceMetrics');
const { EmergencyProtocol } = require('../src/emergencyProtocol');
const { FedAnnouncementProtection } = require('../src/fedAnnouncementProtection');
const { EarningsCalendar } = require('../src/earningsCalendar');
const { AssignmentRiskMonitor } = require('../src/assignmentRiskMonitor');
const { getLogger } = require('../src/logger');

const logger = getLogger();

class SystemMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            checkInterval: config.checkInterval || 60000, // 1 minute default
            alertThresholds: {
                apiLatency: 5000, // 5 seconds
                memoryUsage: 0.85, // 85% of available memory
                cpuUsage: 0.90, // 90% CPU
                drawdown: 0.10, // 10% drawdown alert
                disconnectTime: 300000, // 5 minutes disconnect
                ...config.alertThresholds
            },
            autoRestart: config.autoRestart !== false,
            logPath: config.logPath || './logs/monitoring',
            alertEmail: config.alertEmail || null,
            alertPhone: config.alertPhone || null,
            ...config
        };
        
        this.state = {
            startTime: Date.now(),
            lastCheck: null,
            apiStatus: 'UNKNOWN',
            marketStatus: 'UNKNOWN',
            systemHealth: 100,
            alerts: [],
            metrics: {},
            errors: []
        };
        
        this.api = null;
        this.riskManager = null;
        this.performanceMetrics = null;
        this.emergencyProtocol = null;
        this.fedProtection = null;
        this.earningsCalendar = null;
        this.assignmentRiskMonitor = null;
        this.monitoringInterval = null;
        this.isRunning = false;
    }
    
    /**
     * Start monitoring system
     */
    async start() {
        if (this.isRunning) {
            logger.warn('MONITOR', 'System monitor already running');
            return;
        }
        
        console.log('🚀 Starting 24/7 System Monitor...');
        
        try {
            // Initialize components
            await this.initialize();
            
            // Start monitoring loop
            this.isRunning = true;
            this.monitoringInterval = setInterval(() => {
                this.performHealthCheck();
            }, this.config.checkInterval);
            
            // Perform initial check
            await this.performHealthCheck();
            
            console.log('✅ System Monitor started successfully');
            logger.info('MONITOR', 'System monitoring started');
            
            // Set up graceful shutdown
            this.setupShutdownHandlers();
            
        } catch (error) {
            console.error('❌ Failed to start monitor:', error);
            logger.error('MONITOR', 'Failed to start monitoring', error);
            throw error;
        }
    }
    
    /**
     * Initialize monitoring components
     */
    async initialize() {
        // Initialize API connection
        this.api = new TastyTradeAPI();
        await this.api.initialize();
        
        // Initialize all monitoring components
        this.riskManager = new RiskManager();
        this.performanceMetrics = new PerformanceMetrics();
        this.emergencyProtocol = new EmergencyProtocol(this.api);
        this.fedProtection = new FedAnnouncementProtection();
        this.earningsCalendar = new EarningsCalendar();
        this.assignmentRiskMonitor = new AssignmentRiskMonitor();
        
        // Initialize emergency protocol
        await this.emergencyProtocol.initialize();
        
        // Ensure log directory exists
        await fs.mkdir(this.config.logPath, { recursive: true });
    }
    
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        const checkStart = Date.now();
        const checks = {
            api: false,
            market: false,
            risk: false,
            performance: false,
            system: false
        };
        
        try {
            // Check API connectivity
            checks.api = await this.checkAPIConnection();
            
            // Check market status
            checks.market = await this.checkMarketStatus();
            
            // Check risk parameters
            checks.risk = await this.checkRiskLimits();
            
            // Check performance metrics
            checks.performance = await this.checkPerformance();
            
            // Check system resources
            checks.system = await this.checkSystemResources();
            
            // Calculate overall health
            const healthScore = this.calculateHealthScore(checks);
            this.state.systemHealth = healthScore;
            
            // Log health status
            await this.logHealthStatus(checks, healthScore);
            
            // Check for alerts
            await this.checkAlerts(checks);
            
            // Update state
            this.state.lastCheck = Date.now();
            
            const checkDuration = Date.now() - checkStart;
            logger.debug('MONITOR', `Health check completed in ${checkDuration}ms`);
            
        } catch (error) {
            logger.error('MONITOR', 'Health check failed', error);
            this.state.errors.push({
                time: Date.now(),
                error: error.message,
                type: 'HEALTH_CHECK_FAILURE'
            });
            
            // Attempt recovery
            if (this.config.autoRestart) {
                await this.attemptRecovery();
            }
        }
    }
    
    /**
     * Check API connection health
     */
    async checkAPIConnection() {
        try {
            const start = Date.now();
            
            // Test API connectivity
            if (this.api && this.api.connected) {
                const account = await this.api.getAccount();
                const latency = Date.now() - start;
                
                this.state.metrics.apiLatency = latency;
                this.state.apiStatus = 'CONNECTED';
                
                if (latency > this.config.alertThresholds.apiLatency) {
                    this.addAlert('HIGH_API_LATENCY', `API latency: ${latency}ms`);
                }
                
                return true;
            } else {
                this.state.apiStatus = 'DISCONNECTED';
                this.addAlert('API_DISCONNECTED', 'API connection lost');
                return false;
            }
        } catch (error) {
            this.state.apiStatus = 'ERROR';
            this.addAlert('API_ERROR', error.message);
            return false;
        }
    }
    
    /**
     * Check market status
     */
    async checkMarketStatus() {
        try {
            const marketStatus = await this.api.getMarketStatus();
            this.state.marketStatus = marketStatus;
            
            // Get VIX level if market is open
            if (['OPEN', 'PRE_MARKET', 'AFTER_HOURS'].includes(marketStatus)) {
                const vixData = await this.api.getQuotes(['VIX']);
                if (vixData && vixData.VIX) {
                    this.state.metrics.vixLevel = vixData.VIX.last || vixData.VIX.mark;
                }
            }
            
            return true;
        } catch (error) {
            logger.warn('MONITOR', 'Market status check failed', error);
            return false;
        }
    }
    
    /**
     * Check risk limits
     */
    async checkRiskLimits() {
        try {
            // Get current positions
            const positions = await this.api.refreshPositions();
            const balance = await this.api.refreshBalance();
            
            // Check BP usage
            const bpUsage = this.riskManager.calculateBPUsage({
                positions,
                accountValue: balance
            });
            
            this.state.metrics.bpUsage = bpUsage;
            
            // Check correlation groups
            const correlations = this.riskManager.checkCorrelations(positions);
            this.state.metrics.correlationGroups = correlations.groups;
            
            // Alert if limits exceeded
            if (bpUsage > this.riskManager.getMaxBPUsage(this.state.metrics.vixLevel)) {
                this.addAlert('BP_LIMIT_EXCEEDED', `BP usage: ${bpUsage}%`);
            }
            
            if (correlations.violations.length > 0) {
                this.addAlert('CORRELATION_VIOLATION', correlations.violations.join(', '));
            }
            
            return true;
        } catch (error) {
            logger.warn('MONITOR', 'Risk limits check failed', error);
            return false;
        }
    }
    
    /**
     * Check performance metrics
     */
    async checkPerformance() {
        try {
            // Calculate current P&L
            const metrics = await this.performanceMetrics.calculateMetrics();
            
            this.state.metrics.dailyPnL = metrics.dailyPnL;
            this.state.metrics.weeklyPnL = metrics.weeklyPnL;
            this.state.metrics.monthlyPnL = metrics.monthlyPnL;
            this.state.metrics.drawdown = metrics.maxDrawdown;
            
            // Check for drawdown alert
            if (metrics.maxDrawdown > this.config.alertThresholds.drawdown) {
                this.addAlert('DRAWDOWN_ALERT', `Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%`);
            }
            
            return true;
        } catch (error) {
            logger.warn('MONITOR', 'Performance check failed', error);
            return false;
        }
    }
    
    /**
     * Check system resources
     */
    async checkSystemResources() {
        try {
            const usage = process.memoryUsage();
            const totalMem = require('os').totalmem();
            const freeMem = require('os').freemem();
            
            this.state.metrics.memoryUsage = (totalMem - freeMem) / totalMem;
            this.state.metrics.heapUsage = usage.heapUsed / usage.heapTotal;
            
            // Check CPU usage (simplified)
            const cpuUsage = process.cpuUsage();
            this.state.metrics.cpuUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
            
            // Alert if resources high
            if (this.state.metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
                this.addAlert('HIGH_MEMORY_USAGE', `Memory: ${(this.state.metrics.memoryUsage * 100).toFixed(2)}%`);
            }
            
            return true;
        } catch (error) {
            logger.warn('MONITOR', 'System resources check failed', error);
            return false;
        }
    }
    
    /**
     * Calculate overall health score
     */
    calculateHealthScore(checks) {
        const weights = {
            api: 30,
            market: 10,
            risk: 25,
            performance: 20,
            system: 15
        };
        
        let score = 0;
        for (const [check, passed] of Object.entries(checks)) {
            if (passed) {
                score += weights[check] || 0;
            }
        }
        
        return score;
    }
    
    /**
     * Add alert to system
     */
    addAlert(type, message, severity = 'WARNING') {
        const alert = {
            time: Date.now(),
            type,
            message,
            severity
        };
        
        this.state.alerts.push(alert);
        this.emit('alert', alert);
        
        // Keep only last 100 alerts
        if (this.state.alerts.length > 100) {
            this.state.alerts = this.state.alerts.slice(-100);
        }
        
        // Send notifications for critical alerts
        if (severity === 'CRITICAL') {
            this.sendNotification(alert);
        }
    }
    
    /**
     * Check for alert conditions
     */
    async checkAlerts(checks) {
        // Check for system down
        if (!checks.api && !checks.system) {
            this.addAlert('SYSTEM_DOWN', 'Multiple system failures detected', 'CRITICAL');
        }
        
        // Check for extended disconnect
        if (this.state.apiStatus === 'DISCONNECTED') {
            const disconnectTime = Date.now() - (this.state.lastConnected || 0);
            if (disconnectTime > this.config.alertThresholds.disconnectTime) {
                this.addAlert('EXTENDED_DISCONNECT', `Disconnected for ${Math.floor(disconnectTime / 60000)} minutes`, 'CRITICAL');
            }
        }
    }
    
    /**
     * Attempt automatic recovery
     */
    async attemptRecovery() {
        logger.info('MONITOR', 'Attempting automatic recovery...');
        
        try {
            // Try to reconnect API
            if (this.state.apiStatus !== 'CONNECTED') {
                await this.api.initialize();
            }
            
            // Restart monitoring
            if (!this.isRunning) {
                await this.start();
            }
            
            logger.info('MONITOR', 'Recovery successful');
            this.addAlert('RECOVERY_SUCCESS', 'System recovered automatically');
            
        } catch (error) {
            logger.error('MONITOR', 'Recovery failed', error);
            this.addAlert('RECOVERY_FAILED', 'Manual intervention required', 'CRITICAL');
        }
    }
    
    /**
     * Log health status to file
     */
    async logHealthStatus(checks, healthScore) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            health: healthScore,
            checks,
            metrics: this.state.metrics,
            alerts: this.state.alerts.slice(-10) // Last 10 alerts
        };
        
        const logFile = path.join(
            this.config.logPath,
            `health_${new Date().toISOString().split('T')[0]}.json`
        );
        
        try {
            // Append to daily log
            let logs = [];
            try {
                const existing = await fs.readFile(logFile, 'utf8');
                logs = JSON.parse(existing);
            } catch (e) {
                // File doesn't exist yet
            }
            
            logs.push(logEntry);
            
            // Keep only last 1440 entries (24 hours at 1-minute intervals)
            if (logs.length > 1440) {
                logs = logs.slice(-1440);
            }
            
            await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
            
        } catch (error) {
            logger.error('MONITOR', 'Failed to write health log', error);
        }
    }
    
    /**
     * Send notification for critical alerts
     */
    async sendNotification(alert) {
        // This would integrate with email/SMS service
        logger.warn('MONITOR', `CRITICAL ALERT: ${alert.type} - ${alert.message}`);
        
        // For now, just log prominently
        console.log('🚨'.repeat(10));
        console.log(`CRITICAL ALERT: ${alert.type}`);
        console.log(`Message: ${alert.message}`);
        console.log('🚨'.repeat(10));
    }
    
    /**
     * Setup shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            console.log(`\n📋 Received ${signal}, shutting down monitor...`);
            await this.stop();
            process.exit(0);
        };
        
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
    
    /**
     * Stop monitoring
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        logger.info('MONITOR', 'Stopping system monitor...');
        
        // Clear interval
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        // Final health log
        await this.performHealthCheck();
        
        this.isRunning = false;
        this.emit('stopped');
        
        console.log('✅ System monitor stopped');
    }
    
    /**
     * Get current status
     */
    getStatus() {
        const uptime = Date.now() - this.state.startTime;
        
        return {
            running: this.isRunning,
            uptime: Math.floor(uptime / 1000), // seconds
            health: this.state.systemHealth,
            apiStatus: this.state.apiStatus,
            marketStatus: this.state.marketStatus,
            lastCheck: this.state.lastCheck,
            metrics: this.state.metrics,
            recentAlerts: this.state.alerts.slice(-5),
            errorCount: this.state.errors.length
        };
    }
}

// Start monitor if run directly
if (require.main === module) {
    const monitor = new SystemMonitor({
        checkInterval: 60000, // 1 minute
        autoRestart: true
    });
    
    monitor.start().catch(console.error);
    
    // Display status every 5 minutes
    setInterval(() => {
        const status = monitor.getStatus();
        console.log('\n📊 System Status:');
        console.log(`   Health: ${status.health}%`);
        console.log(`   API: ${status.apiStatus}`);
        console.log(`   Market: ${status.marketStatus}`);
        console.log(`   Uptime: ${Math.floor(status.uptime / 60)} minutes`);
        if (status.metrics.vixLevel) {
            console.log(`   VIX: ${status.metrics.vixLevel}`);
        }
        if (status.metrics.dailyPnL) {
            console.log(`   Daily P&L: £${status.metrics.dailyPnL}`);
        }
    }, 300000); // 5 minutes
}

module.exports = SystemMonitor;