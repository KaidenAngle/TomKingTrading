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
        
        // Store API reference for market data and dividend lookups
        this.api = config.api || null;
        
        this.config = {
            // Risk thresholds
            earlyAssignmentDelta: config.earlyAssignmentDelta || 0.80, // Delta threshold for early assignment risk
            pinRiskRange: config.pinRiskRange || 0.02, // 2% range around strike for pin risk
            dividendRiskDays: config.dividendRiskDays || 30, // Days before ex-dividend to monitor
            
            // Enhanced dividend monitoring thresholds
            dividendRiskByDTE: {
                0: { threshold: 0.001, riskScore: 50 }, // Expiration day - any ITM amount is risky
                1: { threshold: 0.005, riskScore: 45 }, // 1 DTE - 0.5% ITM
                2: { threshold: 0.010, riskScore: 40 }, // 2 DTE - 1% ITM
                3: { threshold: 0.015, riskScore: 35 }, // 3 DTE - 1.5% ITM
                7: { threshold: 0.025, riskScore: 25 }, // 1 week - 2.5% ITM
                14: { threshold: 0.035, riskScore: 15 } // 2 weeks - 3.5% ITM
            },
            
            // Monitoring intervals
            checkInterval: config.checkInterval || 60000, // Check every minute
            urgentCheckInterval: config.urgentCheckInterval || 10000, // 10 seconds for urgent positions
            dividendCheckInterval: config.dividendCheckInterval || 300000, // Check dividends every 5 minutes
            
            // Risk levels
            criticalDTE: config.criticalDTE || 1, // DTE for critical monitoring
            warningDTE: config.warningDTE || 7, // DTE for warning level
            dividendLookAhead: config.dividendLookAhead || 45, // Days to look ahead for dividends
            
            // Auto-management settings
            autoClose: config.autoClose || false, // Auto-close high-risk positions
            autoHedge: config.autoHedge || false, // Auto-hedge assignment risk
            autoNotify: config.autoNotify !== false, // Auto-notify on high risk (default true)
            
            // Enhanced ex-dividend monitoring
            dividendProtection: {
                enabled: config.dividendProtection !== false, // Default enabled
                autoCloseThreshold: 0.98, // Auto-close if ITM by 2% or more on ex-div day
                warningThreshold: 0.95, // Warning if ITM by 5% or more 3 days before
                monitoringThreshold: 0.90 // Start monitoring if ITM by 10% or more 1 week before
            },
            
            ...config
        };
        
        this.positions = new Map(); // Track positions by ID
        this.riskAlerts = [];
        this.monitoringInterval = null;
        this.dividendInterval = null; // Separate interval for dividend monitoring
        this.dividendCalendar = new Map(); // Symbol -> ex-dividend dates with enhanced data
        this.priceCache = new Map(); // Cache recent prices to reduce API calls
        
        // Statistics tracking
        this.stats = {
            totalChecks: 0,
            alertsGenerated: 0,
            dividendAlertsGenerated: 0,
            positionsAutoManaged: 0,
            lastHighRiskCount: 0
        };
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
        
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        logger.info('SYSTEM', '⚠️ ASSIGNMENT RISK ALERTS');
        logger.info('SYSTEM', '='.repeat(60));
        
        for (const alert of alerts) {
            const icon = alert.level === 'CRITICAL' ? '🚨' : 
                        alert.level === 'HIGH' ? '⚠️' : 
                        alert.level === 'MEDIUM' ? '📊' : '📌';
            
            logger.info('SYSTEM', `\n${icon} ${alert.level} RISK: ${alert.symbol} ${alert.strike} ${alert.expiration}`);
            logger.info('SYSTEM', `   Score: ${alert.score}/100`);
            
            for (const risk of alert.risks) {
                logger.info('SYSTEM', `   • ${risk.type}: ${risk.message}`);
            }
            
            if (alert.actions.length > 0) {
                logger.info('SYSTEM', `   Actions: ${alert.actions.join(', ')}`);
            }
        }
        
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        
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
    
    /**
     * Enhanced market data integration for current prices
     */
    async getCurrentPrice(symbol) {
        try {
            // Use TastyTrade API if available
            if (this.api && this.api.getQuotes) {
                const quotes = await this.api.getQuotes([symbol]);
                if (quotes && quotes[symbol]) {
                    return parseFloat(quotes[symbol].last || quotes[symbol].mark || quotes[symbol].mid);
                }
            }
            
            // Fallback to last known price from position data
            for (const position of this.positions.values()) {
                if (position.symbol === symbol && position.underlyingPrice) {
                    logger.debug('AssignmentRisk', `Using cached price for ${symbol}: ${position.underlyingPrice}`);
                    return position.underlyingPrice;
                }
            }
            
            // CRITICAL: Cannot proceed without real market data
            logger.error('AssignmentRisk', `CRITICAL: No price data available for ${symbol} - cannot monitor assignment risk without real data`);
            throw new Error(`Real market data required for ${symbol} - assignment risk monitoring disabled`);
            return null;
            
        } catch (error) {
            logger.error('AssignmentRisk', `Failed to get current price for ${symbol}:`, error);
            return null;
        }
    }
    
    /**
     * REMOVED: Test price generation - production system requires real market data only
     * @deprecated Production system must use real API data exclusively
     */
    generateTestPrice(symbol) {
        // This method has been intentionally disabled for production safety
        throw new Error(`Test price generation disabled - real market data required for ${symbol}`);
    }
    
    /**
     * Enhanced dividend information with real API integration
     */
    async getDividendInfo(symbol) {
        try {
            // Check cache first
            if (this.dividendCalendar.has(symbol)) {
                const cached = this.dividendCalendar.get(symbol);
                const cacheAge = Date.now() - cached.timestamp;
                
                // Use cached data if less than 24 hours old
                if (cacheAge < 24 * 60 * 60 * 1000) {
                    return cached.data;
                }
            }
            
            // Try multiple sources for dividend data
            let dividendData = null;
            
            // Primary source: TastyTrade API (if available)
            if (this.api) {
                try {
                    dividendData = await this.fetchDividendFromTastyTrade(symbol);
                } catch (error) {
                    logger.debug('AssignmentRisk', `TastyTrade dividend API failed for ${symbol}:`, error.message);
                }
            }
            
            // Backup source: Alpha Vantage (free tier)
            if (!dividendData) {
                try {
                    dividendData = await this.fetchDividendFromAlphaVantage(symbol);
                } catch (error) {
                    logger.debug('AssignmentRisk', `Alpha Vantage dividend API failed for ${symbol}:`, error.message);
                }
            }
            
            // Fallback: Yahoo Finance scraping
            if (!dividendData) {
                try {
                    dividendData = await this.fetchDividendFromYahoo(symbol);
                } catch (error) {
                    logger.debug('AssignmentRisk', `Yahoo dividend scraping failed for ${symbol}:`, error.message);
                }
            }
            
            // Generate estimated data for common dividend-paying stocks
            if (!dividendData) {
                dividendData = this.generateEstimatedDividendData(symbol);
            }
            
            // Cache the result
            if (dividendData) {
                this.dividendCalendar.set(symbol, {
                    timestamp: Date.now(),
                    data: dividendData
                });
            }
            
            return dividendData;
            
        } catch (error) {
            logger.error('AssignmentRisk', `Failed to get dividend info for ${symbol}:`, error);
            return null;
        }
    }
    
    /**
     * Fetch dividend data from TastyTrade API
     */
    async fetchDividendFromTastyTrade(symbol) {
        if (!this.api || !this.api.getDividendCalendar) {
            return null;
        }
        
        const dividends = await this.api.getDividendCalendar(symbol, 180); // Next 6 months
        
        if (dividends && dividends.length > 0) {
            const nextDividend = dividends.find(d => new Date(d.exDate) > new Date());
            
            if (nextDividend) {
                return {
                    symbol: symbol,
                    exDate: nextDividend.exDate,
                    payDate: nextDividend.payDate,
                    amount: parseFloat(nextDividend.amount),
                    frequency: nextDividend.frequency || 'QUARTERLY',
                    source: 'TASTYTRADE'
                };
            }
        }
        
        return null;
    }
    
    /**
     * Fetch dividend data from Alpha Vantage
     */
    async fetchDividendFromAlphaVantage(symbol) {
        // This would require Alpha Vantage API key
        // For demonstration, return null (would implement if API key available)
        logger.debug('AssignmentRisk', `Alpha Vantage requires API key for ${symbol}`);
        return null;
    }
    
    /**
     * Fetch dividend data from Yahoo Finance
     */
    async fetchDividendFromYahoo(symbol) {
        try {
            // Yahoo Finance summary page often shows next dividend date
            const url = `https://finance.yahoo.com/quote/${symbol}/`;
            
            // Note: This would require proper web scraping implementation
            // For now, return null to avoid complex scraping logic
            logger.debug('AssignmentRisk', `Yahoo dividend scraping not fully implemented for ${symbol}`);
            return null;
            
        } catch (error) {
            logger.debug('AssignmentRisk', `Yahoo dividend fetch failed for ${symbol}:`, error.message);
            return null;
        }
    }
    
    /**
     * Generate estimated dividend data for major dividend-paying stocks
     */
    generateEstimatedDividendData(symbol) {
        // Common dividend-paying stocks with typical patterns
        const dividendStocks = {
            // Major Dividend ETFs and Blue Chips
            'SPY': { amount: 1.50, frequency: 'QUARTERLY', nextMonth: this.getNextQuarterMonth() },
            'QQQ': { amount: 0.50, frequency: 'QUARTERLY', nextMonth: this.getNextQuarterMonth() },
            'IWM': { amount: 1.20, frequency: 'QUARTERLY', nextMonth: this.getNextQuarterMonth() },
            'DIA': { amount: 2.00, frequency: 'MONTHLY', nextMonth: this.getNextMonth() },
            'TLT': { amount: 2.50, frequency: 'MONTHLY', nextMonth: this.getNextMonth() },
            
            // Individual Stocks (common)
            'AAPL': { amount: 0.24, frequency: 'QUARTERLY', nextMonth: [2, 5, 8, 11] }, // Feb, May, Aug, Nov
            'MSFT': { amount: 0.75, frequency: 'QUARTERLY', nextMonth: [2, 5, 8, 11] },
            'JNJ': { amount: 1.13, frequency: 'QUARTERLY', nextMonth: [2, 5, 8, 11] },
            'KO': { amount: 0.44, frequency: 'QUARTERLY', nextMonth: [3, 6, 9, 12] }, // Mar, Jun, Sep, Dec
            'PG': { amount: 0.91, frequency: 'QUARTERLY', nextMonth: [1, 4, 7, 10] }, // Jan, Apr, Jul, Oct
            
            // REITs (monthly dividends)
            'VNQ': { amount: 3.50, frequency: 'QUARTERLY', nextMonth: this.getNextQuarterMonth() },
            'REIT': { amount: 0.12, frequency: 'MONTHLY', nextMonth: this.getNextMonth() }
        };
        
        const stockData = dividendStocks[symbol.toUpperCase()];
        if (!stockData) {
            // For unknown stocks, assume no dividend
            return null;
        }
        
        // Calculate next ex-dividend date based on pattern
        const nextExDate = this.calculateNextExDate(stockData);
        
        if (!nextExDate || nextExDate <= new Date()) {
            return null; // No upcoming dividend
        }
        
        return {
            symbol: symbol,
            exDate: nextExDate.toISOString().split('T')[0],
            payDate: this.calculatePayDate(nextExDate),
            amount: stockData.amount,
            frequency: stockData.frequency,
            source: 'ESTIMATED'
        };
    }
    
    /**
     * Calculate next ex-dividend date based on frequency pattern
     */
    calculateNextExDate(stockData) {
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // 1-based
        const currentYear = today.getFullYear();
        
        if (stockData.frequency === 'MONTHLY') {
            // Usually mid-month for monthly dividends
            const nextMonth = today.getDate() > 15 ? currentMonth + 1 : currentMonth;
            return new Date(currentYear, nextMonth - 1, 15); // 15th of month
        }
        
        if (stockData.frequency === 'QUARTERLY' && Array.isArray(stockData.nextMonth)) {
            // Find next quarterly month
            const nextQuarterMonth = stockData.nextMonth.find(month => month > currentMonth) || 
                                   stockData.nextMonth[0]; // First month of next year
            
            const year = nextQuarterMonth > currentMonth ? currentYear : currentYear + 1;
            return new Date(year, nextQuarterMonth - 1, 15); // 15th of quarter month
        }
        
        // Default: next quarter
        const nextQuarter = Math.ceil(currentMonth / 3) * 3 + 1;
        const year = nextQuarter > 12 ? currentYear + 1 : currentYear;
        const month = nextQuarter > 12 ? nextQuarter - 12 : nextQuarter;
        
        return new Date(year, month - 1, 15);
    }
    
    /**
     * Calculate pay date (typically 2-4 weeks after ex-date)
     */
    calculatePayDate(exDate) {
        const payDate = new Date(exDate);
        payDate.setDate(payDate.getDate() + 21); // 3 weeks later
        return payDate.toISOString().split('T')[0];
    }
    
    /**
     * Get next quarter months
     */
    getNextQuarterMonth() {
        const currentMonth = new Date().getMonth() + 1;
        const quarterMonths = [3, 6, 9, 12]; // Mar, Jun, Sep, Dec
        return quarterMonths.find(month => month > currentMonth) || quarterMonths[0];
    }
    
    /**
     * Get next month
     */
    getNextMonth() {
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth === 12 ? 1 : currentMonth + 1;
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