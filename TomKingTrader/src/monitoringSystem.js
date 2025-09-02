/**
 * 24/7 Monitoring System
 * Agent 4 Implementation - Comprehensive automated monitoring and alerting
 * 
 * CRITICAL FEATURES:
 * - 24/7 position monitoring with after-hours tracking
 * - Automated risk alerts with escalation protocols
 * - Real-time Greeks monitoring integration
 * - Performance tracking and optimization alerts
 * - System health monitoring and diagnostics
 * - Integration with all Agent 1-3 systems
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const { getLogger } = require('./logger');

class MonitoringSystem extends EventEmitter {
    constructor(options = {}) {
        super();
        this.logger = getLogger();
        
        // Configuration
        this.config = {
            // Monitoring intervals
            intervals: {
                realTime: 1000,      // 1 second for critical monitoring
                standard: 5000,       // 5 seconds for standard checks
                extended: 30000,      // 30 seconds for extended monitoring
                heartbeat: 60000,     // 1 minute for heartbeat
                dailyReport: 86400000 // 24 hours for daily reports
            },
            
            // Risk thresholds
            thresholds: {
                portfolio: {
                    riskScore: { critical: 50, warning: 70 },
                    deltaExposure: { critical: 200, warning: 100 },
                    buyingPower: { critical: 0.40, warning: 0.35 },
                    correlationRisk: { critical: 0.8, warning: 0.6 }
                },
                performance: {
                    drawdown: { critical: -0.05, warning: -0.03 },
                    monthlyTarget: { critical: 0.7, warning: 0.85 },
                    systemLatency: { critical: 5000, warning: 2000 }
                },
                system: {
                    memoryUsage: { critical: 0.9, warning: 0.8 },
                    cpuUsage: { critical: 0.9, warning: 0.8 },
                    apiErrors: { critical: 10, warning: 5 }
                }
            },
            
            // Alert settings
            alerts: {
                escalation: {
                    immediate: ['CRITICAL_DELTA', 'SYSTEM_FAILURE', 'LARGE_LOSS'],
                    urgent: ['WARNING_DELTA', 'HIGH_CORRELATION', 'API_ISSUES'],
                    standard: ['PERFORMANCE_ALERT', 'ROUTINE_CHECK']
                },
                cooldown: 300000, // 5 minutes between similar alerts
                maxHistory: 10000
            },
            
            // Backup and persistence
            persistence: {
                alertLogPath: options.alertLogPath || path.join(__dirname, '..', 'logs', 'monitoring_alerts.json'),
                reportPath: options.reportPath || path.join(__dirname, '..', 'reports', 'daily_monitoring.json'),
                backupInterval: 3600000 // 1 hour
            },
            
            ...options
        };
        
        // State management
        this.monitoringState = {
            isActive: false,
            startTime: null,
            lastHeartbeat: null,
            intervals: new Map(),
            systems: new Map(),
            alerts: [],
            metrics: new Map()
        };
        
        // System components to monitor
        this.monitoredSystems = new Map();
        this.healthChecks = new Map();
        
        // Alert management
        this.alertHistory = [];
        this.alertCooldowns = new Map();
        this.alertCallbacks = new Set();
        
        // Performance tracking
        this.performanceMetrics = {
            systemUptime: 0,
            alertsGenerated: 0,
            checksPerformed: 0,
            systemLoad: 0,
            memoryUsage: 0
        };
        
        this.logger.info('MONITORING', '🔍 24/7 Monitoring System initialized', {
            intervals: this.config.intervals,
            thresholds: Object.keys(this.config.thresholds)
        });
    }

    /**
     * Start the monitoring system
     */
    async start() {
        try {
            if (this.monitoringState.isActive) {
                this.logger.warn('MONITORING', '⚠️ Monitoring system already active');
                return;
            }
            
            this.logger.info('MONITORING', '🚀 Starting 24/7 monitoring system...');
            
            this.monitoringState.isActive = true;
            this.monitoringState.startTime = new Date();
            
            // Start all monitoring intervals
            await this.startMonitoringIntervals();
            
            // Initialize system health checks
            this.initializeHealthChecks();
            
            // Load historical data
            await this.loadAlertHistory();
            
            // Start backup routine
            this.startBackupRoutine();
            
            this.emit('monitoringStarted', {
                timestamp: new Date(),
                config: this.config
            });
            
            this.logger.info('MONITORING', '✅ 24/7 monitoring system started successfully');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Failed to start monitoring system', error);
            throw error;
        }
    }

    /**
     * Stop the monitoring system
     */
    async stop() {
        try {
            if (!this.monitoringState.isActive) {
                this.logger.warn('MONITORING', '⚠️ Monitoring system not active');
                return;
            }
            
            this.logger.info('MONITORING', '🛑 Stopping monitoring system...');
            
            this.monitoringState.isActive = false;
            
            // Clear all intervals
            for (const [name, intervalId] of this.monitoringState.intervals) {
                clearInterval(intervalId);
                this.logger.debug('MONITORING', `🔄 Cleared interval: ${name}`);
            }
            this.monitoringState.intervals.clear();
            
            // Save final state
            await this.saveAlertHistory();
            await this.generateDailyReport();
            
            this.emit('monitoringStopped', {
                timestamp: new Date(),
                uptime: Date.now() - this.monitoringState.startTime?.getTime() || 0
            });
            
            this.logger.info('MONITORING', '✅ Monitoring system stopped');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error stopping monitoring system', error);
        }
    }

    /**
     * Register a system for monitoring
     */
    registerSystem(name, system, healthCheck = null) {
        try {
            this.logger.info('MONITORING', `📝 Registering system for monitoring: ${name}`);
            
            this.monitoredSystems.set(name, system);
            
            if (healthCheck && typeof healthCheck === 'function') {
                this.healthChecks.set(name, healthCheck);
            }
            
            // Initialize system metrics
            this.monitoringState.systems.set(name, {
                registered: new Date(),
                lastCheck: null,
                status: 'UNKNOWN',
                metrics: {}
            });
            
            this.emit('systemRegistered', { name, timestamp: new Date() });
            
        } catch (error) {
            this.logger.error('MONITORING', `🚨 Error registering system ${name}`, error);
        }
    }

    /**
     * Unregister a system from monitoring
     */
    unregisterSystem(name) {
        try {
            this.logger.info('MONITORING', `📝 Unregistering system: ${name}`);
            
            this.monitoredSystems.delete(name);
            this.healthChecks.delete(name);
            this.monitoringState.systems.delete(name);
            
            this.emit('systemUnregistered', { name, timestamp: new Date() });
            
        } catch (error) {
            this.logger.error('MONITORING', `🚨 Error unregistering system ${name}`, error);
        }
    }

    /**
     * Start all monitoring intervals
     */
    async startMonitoringIntervals() {
        try {
            // Real-time monitoring (1 second)
            const realTimeInterval = setInterval(() => {
                this.performRealTimeChecks();
            }, this.config.intervals.realTime);
            this.monitoringState.intervals.set('realTime', realTimeInterval);
            
            // Standard monitoring (5 seconds)
            const standardInterval = setInterval(() => {
                this.performStandardChecks();
            }, this.config.intervals.standard);
            this.monitoringState.intervals.set('standard', standardInterval);
            
            // Extended monitoring (30 seconds)
            const extendedInterval = setInterval(() => {
                this.performExtendedChecks();
            }, this.config.intervals.extended);
            this.monitoringState.intervals.set('extended', extendedInterval);
            
            // Heartbeat monitoring (1 minute)
            const heartbeatInterval = setInterval(() => {
                this.performHeartbeatCheck();
            }, this.config.intervals.heartbeat);
            this.monitoringState.intervals.set('heartbeat', heartbeatInterval);
            
            // Daily report generation (24 hours)
            const dailyInterval = setInterval(() => {
                this.generateDailyReport();
            }, this.config.intervals.dailyReport);
            this.monitoringState.intervals.set('daily', dailyInterval);
            
            this.logger.info('MONITORING', '⏰ All monitoring intervals started');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error starting monitoring intervals', error);
            throw error;
        }
    }

    /**
     * Perform real-time checks (1 second interval)
     */
    performRealTimeChecks() {
        try {
            if (!this.monitoringState.isActive) return;
            
            // Check critical systems
            const greeksStreamer = this.monitoredSystems.get('greeksStreamer');
            if (greeksStreamer) {
                this.checkGreeksStreamerHealth(greeksStreamer);
            }
            
            // Check market data streamer
            const marketStreamer = this.monitoredSystems.get('marketDataStreamer');
            if (marketStreamer) {
                this.checkMarketStreamerHealth(marketStreamer);
            }
            
            // Update performance metrics
            this.updatePerformanceMetrics();
            
            this.performanceMetrics.checksPerformed++;
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error in real-time checks', error);
        }
    }

    /**
     * Perform standard checks (5 second interval)
     */
    performStandardChecks() {
        try {
            if (!this.monitoringState.isActive) return;
            
            // Check all registered systems
            for (const [name, system] of this.monitoredSystems) {
                this.performSystemHealthCheck(name, system);
            }
            
            // Check portfolio Greeks thresholds
            const greeksStreamer = this.monitoredSystems.get('greeksStreamer');
            if (greeksStreamer) {
                this.checkPortfolioRiskThresholds(greeksStreamer);
            }
            
            // Check system resources
            this.checkSystemResources();
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error in standard checks', error);
        }
    }

    /**
     * Perform extended checks (30 second interval)
     */
    performExtendedChecks() {
        try {
            if (!this.monitoringState.isActive) return;
            
            // Check monthly income progress
            this.checkMonthlyIncomeProgress();
            
            // Check compounding performance
            this.checkCompoundingPerformance();
            
            // Check tax optimization status
            this.checkTaxOptimizationStatus();
            
            // Cleanup old alerts
            this.cleanupOldAlerts();
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error in extended checks', error);
        }
    }

    /**
     * Perform heartbeat check (1 minute interval)
     */
    performHeartbeatCheck() {
        try {
            const now = new Date();
            this.monitoringState.lastHeartbeat = now;
            
            // Emit heartbeat
            this.emit('heartbeat', {
                timestamp: now,
                uptime: now.getTime() - (this.monitoringState.startTime?.getTime() || 0),
                systemsMonitored: this.monitoredSystems.size,
                alertsActive: this.alertHistory.filter(a => a.active).length,
                performance: this.performanceMetrics
            });
            
            this.logger.debug('MONITORING', '💓 Heartbeat check completed', {
                systemsMonitored: this.monitoredSystems.size,
                uptime: Math.round((now.getTime() - (this.monitoringState.startTime?.getTime() || 0)) / 1000)
            });
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error in heartbeat check', error);
        }
    }

    /**
     * Check Greeks streamer health
     */
    checkGreeksStreamerHealth(greeksStreamer) {
        try {
            if (!greeksStreamer.getStatus) return;
            
            const status = greeksStreamer.getStatus();
            const systemState = this.monitoringState.systems.get('greeksStreamer');
            
            if (systemState) {
                systemState.lastCheck = new Date();
                systemState.status = status.isStreaming ? 'HEALTHY' : 'DEGRADED';
                systemState.metrics = {
                    positionsTracked: status.positionsTracked,
                    updateCount: status.updateCount,
                    alertsActive: status.alertsActive,
                    riskScore: status.portfolioRiskScore
                };
            }
            
            // Check for critical issues
            if (!status.isStreaming) {
                this.generateAlert({
                    type: 'SYSTEM_DEGRADED',
                    severity: 'WARNING',
                    system: 'greeksStreamer',
                    message: 'Greeks streaming is not active',
                    data: status
                });
            }
            
            if (status.portfolioRiskScore < this.config.thresholds.portfolio.riskScore.critical) {
                this.generateAlert({
                    type: 'CRITICAL_PORTFOLIO_RISK',
                    severity: 'CRITICAL',
                    system: 'portfolio',
                    message: `Critical portfolio risk score: ${status.portfolioRiskScore}`,
                    data: { riskScore: status.portfolioRiskScore }
                });
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking Greeks streamer health', error);
        }
    }

    /**
     * Check market data streamer health
     */
    checkMarketStreamerHealth(marketStreamer) {
        try {
            if (!marketStreamer.getStatus) return;
            
            const status = marketStreamer.getStatus();
            const systemState = this.monitoringState.systems.get('marketDataStreamer');
            
            if (systemState) {
                systemState.lastCheck = new Date();
                systemState.status = status.connected ? 'HEALTHY' : 'DEGRADED';
                systemState.metrics = {
                    connected: status.connected,
                    subscriptions: status.subscriptions,
                    quotesReceived: status.quotesReceived,
                    lastUpdate: status.lastUpdate
                };
            }
            
            // Check for connection issues
            if (!status.connected) {
                this.generateAlert({
                    type: 'DATA_STREAM_DISCONNECTED',
                    severity: 'WARNING',
                    system: 'marketDataStreamer',
                    message: 'Market data stream is disconnected',
                    data: status
                });
            }
            
            // Check for stale data
            if (status.lastUpdate) {
                const dataAge = Date.now() - new Date(status.lastUpdate).getTime();
                if (dataAge > 300000) { // 5 minutes
                    this.generateAlert({
                        type: 'STALE_DATA',
                        severity: 'WARNING',
                        system: 'marketDataStreamer',
                        message: `Market data is stale (${Math.round(dataAge / 60000)} minutes old)`,
                        data: { dataAge, lastUpdate: status.lastUpdate }
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking market streamer health', error);
        }
    }

    /**
     * Check portfolio risk thresholds
     */
    checkPortfolioRiskThresholds(greeksStreamer) {
        try {
            const portfolioGreeks = greeksStreamer.getPortfolioGreeks?.();
            if (!portfolioGreeks) return;
            
            const thresholds = this.config.thresholds.portfolio;
            
            // Check delta exposure
            const deltaExposure = Math.abs(portfolioGreeks.delta || 0);
            if (deltaExposure > thresholds.deltaExposure.critical) {
                this.generateAlert({
                    type: 'CRITICAL_DELTA',
                    severity: 'CRITICAL',
                    system: 'portfolio',
                    message: `Critical delta exposure: ${deltaExposure.toFixed(0)}`,
                    data: { delta: portfolioGreeks.delta, threshold: thresholds.deltaExposure.critical }
                });
            } else if (deltaExposure > thresholds.deltaExposure.warning) {
                this.generateAlert({
                    type: 'WARNING_DELTA',
                    severity: 'WARNING',
                    system: 'portfolio',
                    message: `High delta exposure: ${deltaExposure.toFixed(0)}`,
                    data: { delta: portfolioGreeks.delta, threshold: thresholds.deltaExposure.warning }
                });
            }
            
            // Check buying power usage
            if (portfolioGreeks.buyingPowerUsed) {
                const bpUsage = portfolioGreeks.buyingPowerUsed.percentage || 0;
                if (bpUsage > thresholds.buyingPower.critical) {
                    this.generateAlert({
                        type: 'CRITICAL_BP_USAGE',
                        severity: 'CRITICAL',
                        system: 'portfolio',
                        message: `Critical buying power usage: ${(bpUsage * 100).toFixed(1)}%`,
                        data: { bpUsage, threshold: thresholds.buyingPower.critical }
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking portfolio risk thresholds', error);
        }
    }

    /**
     * Check monthly income progress
     */
    checkMonthlyIncomeProgress() {
        try {
            const monthlyIncomeCalc = this.monitoredSystems.get('monthlyIncomeCalculator');
            if (!monthlyIncomeCalc) return;
            
            // This would integrate with monthly income tracking
            // Placeholder for now
            this.logger.debug('MONITORING', '📊 Checking monthly income progress...');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking monthly income progress', error);
        }
    }

    /**
     * Check compounding performance
     */
    checkCompoundingPerformance() {
        try {
            const compoundingCalc = this.monitoredSystems.get('compoundingCalculator');
            if (!compoundingCalc) return;
            
            // This would integrate with compounding tracking
            // Placeholder for now
            this.logger.debug('MONITORING', '📈 Checking compounding performance...');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking compounding performance', error);
        }
    }

    /**
     * Check tax optimization status
     */
    checkTaxOptimizationStatus() {
        try {
            const taxOptimizer = this.monitoredSystems.get('taxOptimizationEngine');
            if (!taxOptimizer) return;
            
            // This would integrate with tax optimization tracking
            // Placeholder for now
            this.logger.debug('MONITORING', '💰 Checking tax optimization status...');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking tax optimization status', error);
        }
    }

    /**
     * Perform system health check for a registered system
     */
    performSystemHealthCheck(name, system) {
        try {
            const healthCheck = this.healthChecks.get(name);
            const systemState = this.monitoringState.systems.get(name);
            
            if (!systemState) return;
            
            let status = 'HEALTHY';
            let metrics = {};
            
            // Use custom health check if available
            if (healthCheck) {
                const healthResult = healthCheck(system);
                status = healthResult.status || 'UNKNOWN';
                metrics = healthResult.metrics || {};
            } else {
                // Basic health check - system exists and has expected methods
                status = system ? 'HEALTHY' : 'UNHEALTHY';
            }
            
            // Update system state
            systemState.lastCheck = new Date();
            systemState.status = status;
            systemState.metrics = { ...systemState.metrics, ...metrics };
            
            // Generate alert if system is unhealthy
            if (status === 'UNHEALTHY' || status === 'DEGRADED') {
                this.generateAlert({
                    type: 'SYSTEM_UNHEALTHY',
                    severity: status === 'UNHEALTHY' ? 'CRITICAL' : 'WARNING',
                    system: name,
                    message: `System ${name} is ${status.toLowerCase()}`,
                    data: { status, metrics }
                });
            }
            
        } catch (error) {
            this.logger.error('MONITORING', `🚨 Error checking health of system ${name}`, error);
        }
    }

    /**
     * Check system resources (memory, CPU, etc.)
     */
    checkSystemResources() {
        try {
            const memUsage = process.memoryUsage();
            const memPercent = (memUsage.heapUsed / memUsage.heapTotal);
            
            this.performanceMetrics.memoryUsage = memPercent;
            
            // Check memory usage
            if (memPercent > this.config.thresholds.system.memoryUsage.critical) {
                this.generateAlert({
                    type: 'HIGH_MEMORY_USAGE',
                    severity: 'CRITICAL',
                    system: 'node',
                    message: `Critical memory usage: ${(memPercent * 100).toFixed(1)}%`,
                    data: { memoryUsage: memUsage, percentage: memPercent }
                });
            } else if (memPercent > this.config.thresholds.system.memoryUsage.warning) {
                this.generateAlert({
                    type: 'HIGH_MEMORY_USAGE',
                    severity: 'WARNING',
                    system: 'node',
                    message: `High memory usage: ${(memPercent * 100).toFixed(1)}%`,
                    data: { memoryUsage: memUsage, percentage: memPercent }
                });
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error checking system resources', error);
        }
    }

    /**
     * Generate an alert
     */
    generateAlert(alertData) {
        try {
            const alertKey = `${alertData.type}_${alertData.system}`;
            const now = Date.now();
            
            // Check cooldown
            const lastAlert = this.alertCooldowns.get(alertKey);
            if (lastAlert && (now - lastAlert) < this.config.alerts.cooldown) {
                return; // Skip alert due to cooldown
            }
            
            // Create alert object
            const alert = {
                id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                type: alertData.type,
                severity: alertData.severity || 'INFO',
                system: alertData.system,
                message: alertData.message,
                data: alertData.data || {},
                active: true,
                acknowledged: false,
                escalated: false
            };
            
            // Add to history
            this.alertHistory.push(alert);
            this.performanceMetrics.alertsGenerated++;
            
            // Set cooldown
            this.alertCooldowns.set(alertKey, now);
            
            // Limit alert history
            if (this.alertHistory.length > this.config.alerts.maxHistory) {
                this.alertHistory = this.alertHistory.slice(-Math.floor(this.config.alerts.maxHistory * 0.8));
            }
            
            // Emit alert event
            this.emit('alert', alert);
            
            // Call alert callbacks
            for (const callback of this.alertCallbacks) {
                try {
                    callback(alert);
                } catch (error) {
                    this.logger.error('MONITORING', '🚨 Error in alert callback', error);
                }
            }
            
            // Log the alert
            const logLevel = alert.severity === 'CRITICAL' ? 'error' : 
                            alert.severity === 'WARNING' ? 'warn' : 'info';
            
            this.logger[logLevel]('MONITORING', `🚨 ALERT [${alert.severity}]: ${alert.message}`, {
                type: alert.type,
                system: alert.system,
                data: alert.data
            });
            
            // Handle escalation
            if (this.shouldEscalateAlert(alert)) {
                this.escalateAlert(alert);
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error generating alert', error);
        }
    }

    /**
     * Check if alert should be escalated
     */
    shouldEscalateAlert(alert) {
        const immediateEscalation = this.config.alerts.escalation.immediate;
        const urgentEscalation = this.config.alerts.escalation.urgent;
        
        return immediateEscalation.includes(alert.type) ||
               (alert.severity === 'CRITICAL') ||
               (urgentEscalation.includes(alert.type) && !alert.acknowledged);
    }

    /**
     * Escalate an alert
     */
    escalateAlert(alert) {
        try {
            alert.escalated = true;
            alert.escalationTime = new Date();
            
            // Emit escalation event
            this.emit('alertEscalation', alert);
            
            this.logger.error('MONITORING', `🚨 ALERT ESCALATED: ${alert.message}`, {
                id: alert.id,
                type: alert.type,
                severity: alert.severity
            });
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error escalating alert', error);
        }
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId, acknowledgedBy = 'system') {
        try {
            const alert = this.alertHistory.find(a => a.id === alertId);
            if (alert && alert.active) {
                alert.acknowledged = true;
                alert.acknowledgedBy = acknowledgedBy;
                alert.acknowledgedAt = new Date();
                
                this.emit('alertAcknowledged', alert);
                
                this.logger.info('MONITORING', `✅ Alert acknowledged: ${alert.type}`, {
                    id: alertId,
                    acknowledgedBy
                });
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error acknowledging alert', error);
        }
    }

    /**
     * Resolve an alert
     */
    resolveAlert(alertId, resolvedBy = 'system') {
        try {
            const alert = this.alertHistory.find(a => a.id === alertId);
            if (alert && alert.active) {
                alert.active = false;
                alert.resolved = true;
                alert.resolvedBy = resolvedBy;
                alert.resolvedAt = new Date();
                
                this.emit('alertResolved', alert);
                
                this.logger.info('MONITORING', `✅ Alert resolved: ${alert.type}`, {
                    id: alertId,
                    resolvedBy
                });
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error resolving alert', error);
        }
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const uptime = this.monitoringState.startTime ? 
                      Date.now() - this.monitoringState.startTime.getTime() : 0;
        
        this.performanceMetrics.systemUptime = uptime;
        this.performanceMetrics.systemLoad = process.cpuUsage ? 
                                           process.cpuUsage().user / 1000000 : 0;
    }

    /**
     * Initialize health checks
     */
    initializeHealthChecks() {
        // Default health checks for common systems
        this.healthChecks.set('greeksStreamer', (system) => ({
            status: system.getStatus?.()?.isStreaming ? 'HEALTHY' : 'DEGRADED',
            metrics: system.getStatus?.() || {}
        }));
        
        this.healthChecks.set('marketDataStreamer', (system) => ({
            status: system.getStatus?.()?.connected ? 'HEALTHY' : 'DEGRADED',
            metrics: system.getStatus?.() || {}
        }));
        
        this.healthChecks.set('tastytradeAPI', (system) => ({
            status: system.isAuthenticated?.() ? 'HEALTHY' : 'DEGRADED',
            metrics: { authenticated: system.isAuthenticated?.() || false }
        }));
    }

    /**
     * Start backup routine
     */
    startBackupRoutine() {
        setInterval(async () => {
            try {
                await this.saveAlertHistory();
                this.logger.debug('MONITORING', '💾 Alert history backed up');
            } catch (error) {
                this.logger.error('MONITORING', '🚨 Error backing up alert history', error);
            }
        }, this.config.persistence.backupInterval);
    }

    /**
     * Save alert history to file
     */
    async saveAlertHistory() {
        try {
            const alertsDir = path.dirname(this.config.persistence.alertLogPath);
            await fs.mkdir(alertsDir, { recursive: true });
            
            const data = {
                timestamp: new Date().toISOString(),
                alerts: this.alertHistory,
                performance: this.performanceMetrics,
                systems: Object.fromEntries(this.monitoringState.systems)
            };
            
            await fs.writeFile(
                this.config.persistence.alertLogPath,
                JSON.stringify(data, null, 2)
            );
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error saving alert history', error);
        }
    }

    /**
     * Load alert history from file
     */
    async loadAlertHistory() {
        try {
            const data = await fs.readFile(this.config.persistence.alertLogPath, 'utf8');
            const parsed = JSON.parse(data);
            
            if (parsed.alerts) {
                this.alertHistory = parsed.alerts;
            }
            if (parsed.performance) {
                this.performanceMetrics = { ...this.performanceMetrics, ...parsed.performance };
            }
            
            this.logger.info('MONITORING', '📥 Alert history loaded', {
                alertCount: this.alertHistory.length
            });
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.error('MONITORING', '🚨 Error loading alert history', error);
            }
        }
    }

    /**
     * Generate daily report
     */
    async generateDailyReport() {
        try {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            const recentAlerts = this.alertHistory.filter(
                alert => new Date(alert.timestamp) > yesterday
            );
            
            const report = {
                date: now.toISOString().split('T')[0],
                timestamp: now.toISOString(),
                period: {
                    start: yesterday.toISOString(),
                    end: now.toISOString()
                },
                summary: {
                    totalAlerts: recentAlerts.length,
                    criticalAlerts: recentAlerts.filter(a => a.severity === 'CRITICAL').length,
                    warningAlerts: recentAlerts.filter(a => a.severity === 'WARNING').length,
                    systemsMonitored: this.monitoredSystems.size,
                    uptime: this.performanceMetrics.systemUptime,
                    checksPerformed: this.performanceMetrics.checksPerformed
                },
                systems: Object.fromEntries(this.monitoringState.systems),
                performance: this.performanceMetrics,
                alerts: recentAlerts
            };
            
            // Save report
            const reportsDir = path.dirname(this.config.persistence.reportPath);
            await fs.mkdir(reportsDir, { recursive: true });
            
            const reportPath = this.config.persistence.reportPath.replace(
                '.json',
                `_${report.date}.json`
            );
            
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            
            this.emit('dailyReport', report);
            
            this.logger.info('MONITORING', '📊 Daily report generated', {
                totalAlerts: report.summary.totalAlerts,
                criticalAlerts: report.summary.criticalAlerts,
                reportPath
            });
            
            return report;
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error generating daily report', error);
            throw error;
        }
    }

    /**
     * Cleanup old alerts
     */
    cleanupOldAlerts() {
        try {
            const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
            const before = this.alertHistory.length;
            
            this.alertHistory = this.alertHistory.filter(
                alert => new Date(alert.timestamp).getTime() > cutoff
            );
            
            const removed = before - this.alertHistory.length;
            
            if (removed > 0) {
                this.logger.debug('MONITORING', `🧹 Cleaned up ${removed} old alerts`);
            }
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error cleaning up old alerts', error);
        }
    }

    // PUBLIC API METHODS

    /**
     * Get current monitoring status
     */
    getStatus() {
        return {
            isActive: this.monitoringState.isActive,
            startTime: this.monitoringState.startTime,
            lastHeartbeat: this.monitoringState.lastHeartbeat,
            systemsMonitored: this.monitoredSystems.size,
            activeAlerts: this.alertHistory.filter(a => a.active).length,
            totalAlerts: this.alertHistory.length,
            performance: this.performanceMetrics,
            uptime: this.performanceMetrics.systemUptime
        };
    }

    /**
     * Get active alerts
     */
    getActiveAlerts() {
        return this.alertHistory.filter(alert => alert.active);
    }

    /**
     * Get alert history
     */
    getAlertHistory(limit = 100) {
        return this.alertHistory.slice(-limit);
    }

    /**
     * Add alert callback
     */
    addAlertCallback(callback) {
        this.alertCallbacks.add(callback);
    }

    /**
     * Remove alert callback
     */
    removeAlertCallback(callback) {
        this.alertCallbacks.delete(callback);
    }

    /**
     * Get system status
     */
    getSystemStatus(name) {
        return this.monitoringState.systems.get(name);
    }

    /**
     * Get all system statuses
     */
    getAllSystemStatuses() {
        return Object.fromEntries(this.monitoringState.systems);
    }

    /**
     * Clean shutdown
     */
    async shutdown() {
        try {
            this.logger.info('MONITORING', '🛑 Shutting down monitoring system...');
            
            await this.stop();
            
            // Clear all data
            this.monitoredSystems.clear();
            this.healthChecks.clear();
            this.alertCallbacks.clear();
            
            // Remove all listeners
            this.removeAllListeners();
            
            this.logger.info('MONITORING', '✅ Monitoring system shutdown complete');
            
        } catch (error) {
            this.logger.error('MONITORING', '🚨 Error during monitoring system shutdown', error);
        }
    }
}

module.exports = { MonitoringSystem };