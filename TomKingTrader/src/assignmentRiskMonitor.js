/**
 * Assignment Risk Monitor
 * Comprehensive monitoring and management of assignment risk for options positions
 * Includes early assignment detection, dividend risk, and pin risk management
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const logger = getLogger();

class AssignmentRiskMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Risk thresholds
            earlyAssignmentDelta: config.earlyAssignmentDelta || 0.80, // Delta threshold for early assignment risk
            pinRiskRange: config.pinRiskRange || 0.02, // 2% range around strike for pin risk
            dividendRiskDays: config.dividendRiskDays || 30, // Days before ex-dividend to monitor
            
            // Monitoring intervals
            checkInterval: config.checkInterval || 60000, // Check every minute
            urgentCheckInterval: config.urgentCheckInterval || 10000, // 10 seconds for urgent positions
            
            // Risk levels
            criticalDTE: config.criticalDTE || 1, // DTE for critical monitoring
            warningDTE: config.warningDTE || 7, // DTE for warning level
            
            // Auto-management settings
            autoClose: config.autoClose || false, // Auto-close high-risk positions
            autoHedge: config.autoHedge || false, // Auto-hedge assignment risk
            
            ...config
        };
        
        this.positions = new Map(); // Track positions by ID
        this.riskAlerts = [];
        this.monitoringInterval = null;
        this.dividendCalendar = new Map(); // Symbol -> ex-dividend dates
    }
    
    /**
     * Start monitoring positions for assignment risk
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            logger.warn('AssignmentRisk', 'Monitoring already active');
            return;
        }
        
        logger.info('AssignmentRisk', 'Starting assignment risk monitoring');
        
        // Initial check
        this.checkAllPositions();
        
        // Set up regular monitoring
        this.monitoringInterval = setInterval(() => {
            this.checkAllPositions();
        }, this.config.checkInterval);
        
        this.emit('monitoringStarted');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('AssignmentRisk', 'Monitoring stopped');
            this.emit('monitoringStopped');
        }
    }
    
    /**
     * Add position to monitor
     */
    addPosition(position) {
        if (!position.id) {
            position.id = `${position.symbol}_${position.strike}_${position.expiration}_${Date.now()}`;
        }
        
        this.positions.set(position.id, {
            ...position,
            addedAt: Date.now(),
            lastChecked: null,
            riskLevel: 'LOW',
            alerts: []
        });
        
        logger.debug('AssignmentRisk', `Added position: ${position.symbol} ${position.strike} ${position.expiration}`);
        
        // Immediate risk check
        this.checkPosition(position.id);
    }
    
    /**
     * Remove position from monitoring
     */
    removePosition(positionId) {
        this.positions.delete(positionId);
        logger.debug('AssignmentRisk', `Removed position: ${positionId}`);
    }
    
    /**
     * Check all positions for assignment risk
     */
    async checkAllPositions() {
        const alerts = [];
        
        for (const [id, position] of this.positions) {
            const risk = await this.checkPosition(id);
            if (risk.level !== 'LOW') {
                alerts.push(risk);
            }
        }
        
        if (alerts.length > 0) {
            this.processAlerts(alerts);
        }
        
        return alerts;
    }
    
    /**
     * Check individual position for assignment risk
     */
    async checkPosition(positionId) {
        const position = this.positions.get(positionId);
        if (!position) return null;
        
        const riskAssessment = {
            positionId,
            symbol: position.symbol,
            strike: position.strike,
            expiration: position.expiration,
            type: position.type, // CALL or PUT
            side: position.side, // LONG or SHORT
            level: 'LOW',
            risks: [],
            actions: [],
            score: 0,
            timestamp: Date.now()
        };
        
        // Only short options have assignment risk
        if (position.side !== 'SHORT') {
            position.lastChecked = Date.now();
            return riskAssessment;
        }
        
        // Calculate days to expiration
        const dte = this.calculateDTE(position.expiration);
        
        // 1. Check expiration risk
        const expirationRisk = this.assessExpirationRisk(position, dte);
        if (expirationRisk.level !== 'NONE') {
            riskAssessment.risks.push(expirationRisk);
            riskAssessment.score += expirationRisk.score;
        }
        
        // 2. Check early assignment risk (ITM status)
        const earlyAssignmentRisk = await this.assessEarlyAssignmentRisk(position);
        if (earlyAssignmentRisk.level !== 'NONE') {
            riskAssessment.risks.push(earlyAssignmentRisk);
            riskAssessment.score += earlyAssignmentRisk.score;
        }
        
        // 3. Check dividend risk (for short calls)
        if (position.type === 'CALL') {
            const dividendRisk = await this.assessDividendRisk(position);
            if (dividendRisk.level !== 'NONE') {
                riskAssessment.risks.push(dividendRisk);
                riskAssessment.score += dividendRisk.score;
            }
        }
        
        // 4. Check pin risk
        const pinRisk = await this.assessPinRisk(position);
        if (pinRisk.level !== 'NONE') {
            riskAssessment.risks.push(pinRisk);
            riskAssessment.score += pinRisk.score;
        }
        
        // Determine overall risk level
        if (riskAssessment.score >= 80) {
            riskAssessment.level = 'CRITICAL';
            riskAssessment.actions.push('CLOSE_IMMEDIATELY');
        } else if (riskAssessment.score >= 60) {
            riskAssessment.level = 'HIGH';
            riskAssessment.actions.push('CLOSE_TODAY');
        } else if (riskAssessment.score >= 40) {
            riskAssessment.level = 'MEDIUM';
            riskAssessment.actions.push('MONITOR_CLOSELY');
        } else if (riskAssessment.score >= 20) {
            riskAssessment.level = 'LOW';
            riskAssessment.actions.push('NORMAL_MONITORING');
        }
        
        // Update position record
        position.lastChecked = Date.now();
        position.riskLevel = riskAssessment.level;
        position.lastRiskScore = riskAssessment.score;
        
        // Emit high-risk alert
        if (riskAssessment.level === 'CRITICAL' || riskAssessment.level === 'HIGH') {
            this.emit('highRiskDetected', riskAssessment);
        }
        
        return riskAssessment;
    }
    
    /**
     * Assess expiration risk
     */
    assessExpirationRisk(position, dte) {
        const risk = {
            type: 'EXPIRATION',
            level: 'NONE',
            score: 0,
            message: '',
            dte
        };
        
        if (dte === 0) {
            risk.level = 'CRITICAL';
            risk.score = 50;
            risk.message = `Expires TODAY - High assignment risk`;
        } else if (dte === 1) {
            risk.level = 'HIGH';
            risk.score = 40;
            risk.message = `Expires tomorrow - Prepare for assignment`;
        } else if (dte <= 3) {
            risk.level = 'MEDIUM';
            risk.score = 25;
            risk.message = `${dte} days to expiration - Monitor closely`;
        } else if (dte <= 7) {
            risk.level = 'LOW';
            risk.score = 10;
            risk.message = `${dte} days to expiration - Start planning exit`;
        }
        
        return risk;
    }
    
    /**
     * Assess early assignment risk based on moneyness
     */
    async assessEarlyAssignmentRisk(position) {
        const risk = {
            type: 'EARLY_ASSIGNMENT',
            level: 'NONE',
            score: 0,
            message: ''
        };
        
        // Get current underlying price
        const currentPrice = await this.getCurrentPrice(position.symbol);
        if (!currentPrice) return risk;
        
        // Calculate moneyness
        const moneyness = position.type === 'CALL' 
            ? (currentPrice - position.strike) / position.strike
            : (position.strike - currentPrice) / position.strike;
        
        // Estimate delta if not provided
        const delta = position.delta || this.estimateDelta(position, currentPrice);
        
        if (moneyness > 0.10 || Math.abs(delta) > this.config.earlyAssignmentDelta) {
            risk.level = 'HIGH';
            risk.score = 40;
            risk.message = `Deep ITM (${(moneyness * 100).toFixed(1)}%) - High early assignment risk`;
        } else if (moneyness > 0.05 || Math.abs(delta) > 0.70) {
            risk.level = 'MEDIUM';
            risk.score = 25;
            risk.message = `ITM (${(moneyness * 100).toFixed(1)}%) - Moderate assignment risk`;
        } else if (moneyness > 0.02 || Math.abs(delta) > 0.60) {
            risk.level = 'LOW';
            risk.score = 15;
            risk.message = `Slightly ITM - Monitor for assignment risk`;
        } else if (moneyness > 0) {
            risk.level = 'LOW';
            risk.score = 5;
            risk.message = `At the money - Low assignment risk`;
        }
        
        return risk;
    }
    
    /**
     * Assess dividend risk for short calls
     */
    async assessDividendRisk(position) {
        const risk = {
            type: 'DIVIDEND',
            level: 'NONE',
            score: 0,
            message: ''
        };
        
        // Get dividend information
        const dividend = await this.getDividendInfo(position.symbol);
        if (!dividend || !dividend.exDate) return risk;
        
        const daysToExDividend = this.calculateDTE(dividend.exDate);
        
        // Only worry if position is ITM or near ITM
        const currentPrice = await this.getCurrentPrice(position.symbol);
        const moneyness = (currentPrice - position.strike) / position.strike;
        
        if (daysToExDividend <= 1 && moneyness > -0.02) {
            risk.level = 'CRITICAL';
            risk.score = 45;
            risk.message = `Ex-dividend ${daysToExDividend === 0 ? 'TODAY' : 'tomorrow'} - Very high assignment risk`;
        } else if (daysToExDividend <= 5 && moneyness > 0) {
            risk.level = 'HIGH';
            risk.score = 35;
            risk.message = `Ex-dividend in ${daysToExDividend} days - ITM call at risk`;
        } else if (daysToExDividend <= 10 && moneyness > 0.02) {
            risk.level = 'MEDIUM';
            risk.score = 20;
            risk.message = `Ex-dividend in ${daysToExDividend} days - Monitor closely`;
        } else if (daysToExDividend <= this.config.dividendRiskDays) {
            risk.level = 'LOW';
            risk.score = 10;
            risk.message = `Ex-dividend in ${daysToExDividend} days`;
        }
        
        return risk;
    }
    
    /**
     * Assess pin risk near expiration
     */
    async assessPinRisk(position) {
        const risk = {
            type: 'PIN_RISK',
            level: 'NONE',
            score: 0,
            message: ''
        };
        
        const dte = this.calculateDTE(position.expiration);
        
        // Pin risk only matters close to expiration
        if (dte > 1) return risk;
        
        const currentPrice = await this.getCurrentPrice(position.symbol);
        if (!currentPrice) return risk;
        
        // Calculate distance from strike
        const distancePercent = Math.abs(currentPrice - position.strike) / position.strike;
        
        if (dte === 0 && distancePercent <= this.config.pinRiskRange) {
            risk.level = 'HIGH';
            risk.score = 35;
            risk.message = `Pin risk - Price within ${(distancePercent * 100).toFixed(1)}% of strike on expiration day`;
        } else if (dte === 1 && distancePercent <= this.config.pinRiskRange * 1.5) {
            risk.level = 'MEDIUM';
            risk.score = 20;
            risk.message = `Potential pin risk - Price near strike with 1 DTE`;
        } else if (dte === 0 && distancePercent <= this.config.pinRiskRange * 2) {
            risk.level = 'LOW';
            risk.score = 10;
            risk.message = `Monitor for pin risk - Expiration day`;
        }
        
        return risk;
    }
    
    /**
     * Process alerts and take actions
     */
    processAlerts(alerts) {
        // Sort by risk score
        alerts.sort((a, b) => b.score - a.score);
        
        console.log('\n' + '='.repeat(60));
        console.log('⚠️ ASSIGNMENT RISK ALERTS');
        console.log('='.repeat(60));
        
        for (const alert of alerts) {
            const icon = alert.level === 'CRITICAL' ? '🚨' : 
                        alert.level === 'HIGH' ? '⚠️' : 
                        alert.level === 'MEDIUM' ? '📊' : '📌';
            
            console.log(`\n${icon} ${alert.level} RISK: ${alert.symbol} ${alert.strike} ${alert.expiration}`);
            console.log(`   Score: ${alert.score}/100`);
            
            for (const risk of alert.risks) {
                console.log(`   • ${risk.type}: ${risk.message}`);
            }
            
            if (alert.actions.length > 0) {
                console.log(`   Actions: ${alert.actions.join(', ')}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Store alerts
        this.riskAlerts = alerts;
        
        // Emit event for external handling
        this.emit('alertsProcessed', alerts);
        
        // Auto-management if enabled
        if (this.config.autoClose || this.config.autoHedge) {
            this.executeAutoManagement(alerts);
        }
    }
    
    /**
     * Execute automatic risk management
     */
    async executeAutoManagement(alerts) {
        const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
        
        for (const alert of criticalAlerts) {
            if (this.config.autoClose && alert.actions.includes('CLOSE_IMMEDIATELY')) {
                logger.warn('AssignmentRisk', `Auto-closing critical risk position: ${alert.symbol}`);
                this.emit('autoCloseTriggered', alert);
            }
            
            if (this.config.autoHedge && alert.risks.some(r => r.type === 'EARLY_ASSIGNMENT')) {
                logger.warn('AssignmentRisk', `Auto-hedging assignment risk: ${alert.symbol}`);
                this.emit('autoHedgeTriggered', alert);
            }
        }
    }
    
    // Helper methods
    
    calculateDTE(expiration) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expDate = new Date(expiration);
        expDate.setHours(0, 0, 0, 0);
        return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    }
    
    estimateDelta(position, currentPrice) {
        // Simple delta estimation based on moneyness
        const moneyness = position.type === 'CALL'
            ? (currentPrice - position.strike) / position.strike
            : (position.strike - currentPrice) / position.strike;
        
        if (moneyness > 0.10) return 0.90;
        if (moneyness > 0.05) return 0.75;
        if (moneyness > 0.02) return 0.60;
        if (moneyness > 0) return 0.55;
        if (moneyness > -0.02) return 0.45;
        if (moneyness > -0.05) return 0.25;
        return 0.10;
    }
    
    async getCurrentPrice(symbol) {
        // This would connect to the market data feed
        // For now, return null to indicate need for real implementation
        return null; // TODO: Connect to real market data
    }
    
    async getDividendInfo(symbol) {
        // This would connect to dividend calendar API
        // For now, return null to indicate need for real implementation
        return null; // TODO: Connect to dividend calendar API
    }
    
    /**
     * Get current risk summary
     */
    getRiskSummary() {
        const summary = {
            totalPositions: this.positions.size,
            criticalRisk: 0,
            highRisk: 0,
            mediumRisk: 0,
            lowRisk: 0,
            monitoring: this.monitoringInterval !== null
        };
        
        for (const position of this.positions.values()) {
            switch (position.riskLevel) {
                case 'CRITICAL': summary.criticalRisk++; break;
                case 'HIGH': summary.highRisk++; break;
                case 'MEDIUM': summary.mediumRisk++; break;
                case 'LOW': summary.lowRisk++; break;
            }
        }
        
        return summary;
    }
    
    /**
     * Clear all positions and alerts
     */
    clear() {
        this.positions.clear();
        this.riskAlerts = [];
        logger.info('AssignmentRisk', 'Cleared all positions and alerts');
    }
}

module.exports = { AssignmentRiskMonitor };