/**
 * Emergency Protocols Automation
 * Tom King Trading Framework - Circuit breakers and position unwinding
 * Automated risk management for extreme market conditions
 */

const fs = require('fs');
const path = require('path');

class EmergencyProtocols {
    constructor(orderManager, riskManager, api, monitoringSystem) {
        this.orderManager = orderManager;
        this.riskManager = riskManager;
        this.api = api;
        this.monitoringSystem = monitoringSystem;
        
        // Emergency protocol status
        this.emergencyActive = false;
        this.emergencyLevel = 'GREEN'; // GREEN, YELLOW, ORANGE, RED
        this.lastCheckTime = null;
        this.emergencyHistory = [];
        
        // Circuit breaker thresholds (Tom King risk management)
        this.circuitBreakers = {
            // Daily loss limits
            dailyLossThresholds: {
                YELLOW: -250,   // £250 daily loss
                ORANGE: -500,   // £500 daily loss
                RED: -1000      // £1000 daily loss - FULL STOP
            },
            
            // Position-specific losses
            positionLossThresholds: {
                singlePosition: -100,    // £100 single position loss
                strategyGroup: -200,     // £200 strategy group loss
                correlatedGroup: -300    // £300 correlated positions loss
            },
            
            // Market volatility triggers
            volatilityTriggers: {
                vixSpike: 35,           // VIX above 35
                vixCrash: 12,           // VIX below 12 (complacency)
                marketMove: 0.03,       // 3% daily SPY move
                flashCrash: 0.015       // 1.5% move in 15 minutes
            },
            
            // Time-based triggers
            timeTriggers: {
                fridayExpiration: true,  // 0DTE expiration management
                afterHours: true,        // After market close
                weekendGap: 0.02        // 2% weekend gap risk
            },
            
            // Buying power management
            bpTriggers: {
                maxUsage: 0.85,         // 85% BP usage (emergency level)
                marginCall: 0.95        // 95% BP usage (forced liquidation)
            }
        };
        
        // Emergency actions configuration
        this.emergencyActions = {
            YELLOW: {
                description: 'Caution - Heightened monitoring',
                actions: [
                    'stopNewPositions',
                    'increasedMonitoring',
                    'tightenStops'
                ]
            },
            ORANGE: {
                description: 'Warning - Active risk reduction',
                actions: [
                    'stopNewPositions',
                    'reduceBPUsage',
                    'closeRiskiestPositions',
                    'hedgePortfolio'
                ]
            },
            RED: {
                description: 'Emergency - Immediate risk reduction',
                actions: [
                    'stopAllTrading',
                    'emergencyUnwind',
                    'closeAllPositions',
                    'notifyOperator'
                ]
            }
        };
        
        // Position unwinding priorities (Tom King methodology)
        this.unwindPriorities = [
            { strategy: '0DTE', reason: 'Time decay risk', priority: 1 },
            { strategy: 'BUTTERFLY', reason: 'Complex management', priority: 2 },
            { strategy: 'IRON_CONDOR', reason: 'Multiple legs', priority: 3 },
            { strategy: 'STRANGLE', reason: 'Undefined risk', priority: 4 },
            { strategy: 'LT112', reason: 'Defined risk', priority: 5 }
        ];
        
        // Emergency log file
        this.logFile = path.join(__dirname, '../logs/emergency_protocols.json');
        this.ensureLogDir();
        
        // Start monitoring
        this.startEmergencyMonitoring();
        
        console.log('🚨 Emergency Protocols System initialized');
        console.log('📊 Circuit breakers active with Tom King risk limits');
    }
    
    /**
     * Start continuous emergency monitoring
     */
    startEmergencyMonitoring() {
        // Check every 30 seconds during market hours
        this.monitoringInterval = setInterval(async () => {
            await this.checkEmergencyConditions();
        }, 30000);
        
        // Also check every 5 minutes after hours
        this.afterHoursInterval = setInterval(async () => {
            if (this.isAfterHours()) {
                await this.checkAfterHoursRisks();
            }
        }, 300000);
        
        console.log('🔍 Emergency monitoring started');
    }
    
    /**
     * Main emergency condition checker
     */
    async checkEmergencyConditions() {
        try {
            this.lastCheckTime = new Date();
            
            // Get current account status
            const accountData = await this.api.getAccountStatus();
            if (!accountData) {
                console.warn('⚠️ Cannot retrieve account data for emergency check');
                return;
            }
            
            // Get current market data
            const marketData = await this.getCurrentMarketData();
            
            // Check all emergency conditions
            const checks = await Promise.all([
                this.checkDailyLoss(accountData),
                this.checkPositionLosses(),
                this.checkVolatilityTriggers(marketData),
                this.checkBuyingPowerRisk(accountData),
                this.checkTimeBasedRisks(),
                this.checkCorrelationRisk()
            ]);
            
            // Determine highest alert level
            const alertLevels = checks.map(check => check.level).filter(level => level !== 'GREEN');
            const highestLevel = this.getHighestAlertLevel(alertLevels);
            
            // Take action if alert level changed
            if (highestLevel !== this.emergencyLevel) {
                await this.handleEmergencyLevelChange(this.emergencyLevel, highestLevel, checks);
            }
            
            // Log monitoring result
            this.logMonitoringCheck(checks, highestLevel);
            
        } catch (error) {
            console.error('❌ Emergency monitoring error:', error);
            // Continue monitoring despite errors
        }
    }
    
    /**
     * Check daily loss limits
     */
    async checkDailyLoss(accountData) {
        const dailyPL = accountData.dayPL || 0;
        const thresholds = this.circuitBreakers.dailyLossThresholds;
        
        let level = 'GREEN';
        let message = 'Daily P&L within limits';
        
        if (dailyPL <= thresholds.RED) {
            level = 'RED';
            message = `CRITICAL: Daily loss £${Math.abs(dailyPL)} exceeds red limit`;
        } else if (dailyPL <= thresholds.ORANGE) {
            level = 'ORANGE';
            message = `WARNING: Daily loss £${Math.abs(dailyPL)} exceeds orange limit`;
        } else if (dailyPL <= thresholds.YELLOW) {
            level = 'YELLOW';
            message = `CAUTION: Daily loss £${Math.abs(dailyPL)} exceeds yellow limit`;
        }
        
        return {
            type: 'DAILY_LOSS',
            level,
            message,
            value: dailyPL,
            threshold: level !== 'GREEN' ? thresholds[level] : null
        };
    }
    
    /**
     * Check individual position losses
     */
    async checkPositionLosses() {
        try {
            const positions = await this.riskManager.getCurrentPositions();
            const thresholds = this.circuitBreakers.positionLossThresholds;
            
            let worstLevel = 'GREEN';
            let worstMessage = 'All positions within limits';
            
            // Check each position
            for (const position of positions) {
                const unrealizedPL = position.unrealizedPL || 0;
                
                if (unrealizedPL <= -thresholds.singlePosition) {
                    worstLevel = this.escalateLevel(worstLevel, 'ORANGE');
                    worstMessage = `Position ${position.symbol} loss £${Math.abs(unrealizedPL)}`;
                }
            }
            
            // Check strategy groups
            const strategyGroups = this.groupPositionsByStrategy(positions);
            for (const [strategy, strategyPositions] of Object.entries(strategyGroups)) {
                const totalPL = strategyPositions.reduce((sum, pos) => sum + (pos.unrealizedPL || 0), 0);
                
                if (totalPL <= -thresholds.strategyGroup) {
                    worstLevel = this.escalateLevel(worstLevel, 'ORANGE');
                    worstMessage = `${strategy} strategy group loss £${Math.abs(totalPL)}`;
                }
            }
            
            // Check correlated groups
            const correlatedGroups = await this.riskManager.getCorrelatedPositionGroups();
            for (const group of correlatedGroups) {
                const totalPL = group.positions.reduce((sum, pos) => sum + (pos.unrealizedPL || 0), 0);
                
                if (totalPL <= -thresholds.correlatedGroup) {
                    worstLevel = this.escalateLevel(worstLevel, 'RED');
                    worstMessage = `Correlated group loss £${Math.abs(totalPL)}`;
                }
            }
            
            return {
                type: 'POSITION_LOSSES',
                level: worstLevel,
                message: worstMessage,
                positionCount: positions.length
            };
            
        } catch (error) {
            console.error('❌ Error checking position losses:', error);
            return {
                type: 'POSITION_LOSSES',
                level: 'YELLOW',
                message: 'Error checking position losses',
                error: error.message
            };
        }
    }
    
    /**
     * Check volatility triggers
     */
    async checkVolatilityTriggers(marketData) {
        const triggers = this.circuitBreakers.volatilityTriggers;
        
        let level = 'GREEN';
        let message = 'Volatility within normal ranges';
        
        // Check VIX levels
        if (marketData.vix > triggers.vixSpike) {
            level = 'ORANGE';
            message = `High volatility: VIX ${marketData.vix} above ${triggers.vixSpike}`;
        } else if (marketData.vix < triggers.vixCrash) {
            level = 'YELLOW';
            message = `Low volatility: VIX ${marketData.vix} below ${triggers.vixCrash}`;
        }
        
        // Check market moves
        if (Math.abs(marketData.spyDailyMove) > triggers.marketMove) {
            level = this.escalateLevel(level, 'ORANGE');
            message = `Large market move: SPY ${(marketData.spyDailyMove * 100).toFixed(1)}%`;
        }
        
        // Check flash crash conditions
        if (Math.abs(marketData.spy15MinMove) > triggers.flashCrash) {
            level = this.escalateLevel(level, 'RED');
            message = `Flash crash detected: ${(marketData.spy15MinMove * 100).toFixed(1)}% in 15min`;
        }
        
        return {
            type: 'VOLATILITY',
            level,
            message,
            vix: marketData.vix,
            dailyMove: marketData.spyDailyMove,
            flashMove: marketData.spy15MinMove
        };
    }
    
    /**
     * Check buying power risk
     */
    async checkBuyingPowerRisk(accountData) {
        const bpUsage = await this.riskManager.calculateCurrentBPUsage();
        const triggers = this.circuitBreakers.bpTriggers;
        
        let level = 'GREEN';
        let message = 'Buying power usage normal';
        
        if (bpUsage >= triggers.marginCall) {
            level = 'RED';
            message = `MARGIN CALL RISK: BP usage ${(bpUsage * 100).toFixed(1)}%`;
        } else if (bpUsage >= triggers.maxUsage) {
            level = 'ORANGE';
            message = `High BP usage: ${(bpUsage * 100).toFixed(1)}%`;
        }
        
        return {
            type: 'BUYING_POWER',
            level,
            message,
            usage: bpUsage,
            available: accountData.derivativeBuyingPower
        };
    }
    
    /**
     * Check time-based risks
     */
    async checkTimeBasedRisks() {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const dayOfWeek = et.getDay();
        const hour = et.getHours();
        
        let level = 'GREEN';
        let message = 'No time-based risks';
        
        // Friday 0DTE expiration risk
        if (dayOfWeek === 5 && hour >= 15) { // After 3 PM ET on Friday
            const zdtePositions = await this.get0DTEPositions();
            if (zdtePositions.length > 0) {
                level = 'YELLOW';
                message = `Friday 3PM: ${zdtePositions.length} 0DTE positions at risk`;
            }
        }
        
        // After hours risk
        if (this.isAfterHours() && await this.hasOpenPositions()) {
            level = this.escalateLevel(level, 'YELLOW');
            message = 'After hours with open positions';
        }
        
        return {
            type: 'TIME_BASED',
            level,
            message,
            dayOfWeek,
            hour
        };
    }
    
    /**
     * Check correlation risk
     */
    async checkCorrelationRisk() {
        try {
            const correlationAnalysis = await this.riskManager.analyzeCorrelationRisk();
            
            let level = 'GREEN';
            let message = 'Correlation risk acceptable';
            
            if (correlationAnalysis.maxGroupSize > this.circuitBreakers.maxCorrelatedPositions) {
                level = 'ORANGE';
                message = `High correlation: ${correlationAnalysis.maxGroupSize} positions in group`;
            }
            
            if (correlationAnalysis.portfolioCorrelation > 0.8) {
                level = this.escalateLevel(level, 'RED');
                message = `Extreme correlation: ${(correlationAnalysis.portfolioCorrelation * 100).toFixed(0)}%`;
            }
            
            return {
                type: 'CORRELATION',
                level,
                message,
                maxGroupSize: correlationAnalysis.maxGroupSize,
                portfolioCorrelation: correlationAnalysis.portfolioCorrelation
            };
            
        } catch (error) {
            return {
                type: 'CORRELATION',
                level: 'YELLOW',
                message: 'Error checking correlation risk',
                error: error.message
            };
        }
    }
    
    /**
     * Handle emergency level changes
     */
    async handleEmergencyLevelChange(oldLevel, newLevel, checks) {
        console.log(`🚨 EMERGENCY LEVEL CHANGE: ${oldLevel} → ${newLevel}`);
        
        this.emergencyLevel = newLevel;
        this.emergencyActive = newLevel !== 'GREEN';
        
        // Log the change
        const emergencyEvent = {
            timestamp: new Date().toISOString(),
            oldLevel,
            newLevel,
            checks,
            actions: []
        };
        
        // Execute emergency actions
        if (newLevel !== 'GREEN') {
            const actions = this.emergencyActions[newLevel];
            console.log(`🎯 Executing ${newLevel} actions: ${actions.description}`);
            
            for (const action of actions.actions) {
                try {
                    const result = await this.executeEmergencyAction(action);
                    emergencyEvent.actions.push({ action, result });
                } catch (error) {
                    console.error(`❌ Failed to execute ${action}:`, error);
                    emergencyEvent.actions.push({ action, error: error.message });
                }
            }
        }
        
        // Store emergency event
        this.emergencyHistory.push(emergencyEvent);
        this.logEmergencyEvent(emergencyEvent);
        
        // Notify monitoring system (but NO alerts per user requirement)
        if (this.monitoringSystem) {
            await this.monitoringSystem.logEmergencyEvent(emergencyEvent);
        }
    }
    
    /**
     * Execute specific emergency actions
     */
    async executeEmergencyAction(action) {
        switch (action) {
            case 'stopNewPositions':
                return await this.stopNewPositions();
                
            case 'increasedMonitoring':
                return await this.increaseMonitoring();
                
            case 'tightenStops':
                return await this.tightenStops();
                
            case 'reduceBPUsage':
                return await this.reduceBPUsage();
                
            case 'closeRiskiestPositions':
                return await this.closeRiskiestPositions();
                
            case 'hedgePortfolio':
                return await this.hedgePortfolio();
                
            case 'stopAllTrading':
                return await this.stopAllTrading();
                
            case 'emergencyUnwind':
                return await this.emergencyUnwind();
                
            case 'closeAllPositions':
                return await this.closeAllPositions();
                
            case 'notifyOperator':
                return await this.notifyOperator();
                
            default:
                throw new Error(`Unknown emergency action: ${action}`);
        }
    }
    
    /**
     * Stop new positions from being opened
     */
    async stopNewPositions() {
        // Set flag in order manager to prevent new orders
        if (this.orderManager.setNewOrdersEnabled) {
            this.orderManager.setNewOrdersEnabled(false);
        }
        
        console.log('🚫 New position entry DISABLED');
        return { action: 'New positions stopped', success: true };
    }
    
    /**
     * Increase monitoring frequency
     */
    async increaseMonitoring() {
        // Reduce monitoring interval to 10 seconds
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = setInterval(async () => {
                await this.checkEmergencyConditions();
            }, 10000);
        }
        
        console.log('🔍 Monitoring frequency increased to 10 seconds');
        return { action: 'Monitoring increased', success: true };
    }
    
    /**
     * Tighten stop losses on existing positions
     */
    async tightenStops() {
        const positions = await this.riskManager.getCurrentPositions();
        let tightenedCount = 0;
        
        for (const position of positions) {
            try {
                // Tighten stop to 50% of original distance
                const newStop = await this.calculateTightenedStop(position);
                if (newStop) {
                    await this.orderManager.updateStopLoss(position.id, newStop);
                    tightenedCount++;
                }
            } catch (error) {
                console.error(`❌ Error tightening stop for ${position.symbol}:`, error);
            }
        }
        
        console.log(`🎯 Tightened stops on ${tightenedCount} positions`);
        return { action: 'Stops tightened', count: tightenedCount, success: true };
    }
    
    /**
     * Reduce buying power usage by closing least profitable positions
     */
    async reduceBPUsage() {
        const positions = await this.riskManager.getCurrentPositions();
        const targetReduction = 0.2; // Reduce BP usage by 20%
        
        // Sort positions by profitability (close least profitable first)
        positions.sort((a, b) => (a.unrealizedPL || 0) - (b.unrealizedPL || 0));
        
        let closedCount = 0;
        let bpReduced = 0;
        
        for (const position of positions) {
            if (bpReduced >= targetReduction) break;
            
            try {
                await this.closePosition(position, 'BP_REDUCTION');
                closedCount++;
                bpReduced += position.bpUsage || 0.05; // Estimate 5% if not known
            } catch (error) {
                console.error(`❌ Error closing ${position.symbol}:`, error);
            }
        }
        
        console.log(`📉 Reduced BP usage: closed ${closedCount} positions`);
        return { action: 'BP usage reduced', closedCount, bpReduced, success: true };
    }
    
    /**
     * Close the riskiest positions immediately
     */
    async closeRiskiestPositions() {
        const positions = await this.riskManager.getCurrentPositions();
        
        // Identify riskiest positions (high gamma, near expiration, losing money)
        const riskyPositions = positions
            .filter(pos => this.isRiskyPosition(pos))
            .sort((a, b) => this.calculateRiskScore(b) - this.calculateRiskScore(a))
            .slice(0, 5); // Close top 5 riskiest
        
        let closedCount = 0;
        
        for (const position of riskyPositions) {
            try {
                await this.closePosition(position, 'RISK_REDUCTION');
                closedCount++;
            } catch (error) {
                console.error(`❌ Error closing risky position ${position.symbol}:`, error);
            }
        }
        
        console.log(`⚠️ Closed ${closedCount} risky positions`);
        return { action: 'Risky positions closed', closedCount, success: true };
    }
    
    /**
     * Emergency hedge the portfolio
     */
    async hedgePortfolio() {
        try {
            // Simple hedge: buy VIX calls or SPY puts based on position delta
            const portfolioDelta = await this.riskManager.calculatePortfolioDelta();
            
            if (Math.abs(portfolioDelta) > 100) {
                const hedgeResult = await this.executePortfolioHedge(portfolioDelta);
                console.log('🛡️ Portfolio hedge executed');
                return { action: 'Portfolio hedged', delta: portfolioDelta, hedge: hedgeResult, success: true };
            }
            
            console.log('🛡️ Portfolio hedge not needed');
            return { action: 'Portfolio hedge evaluated', delta: portfolioDelta, needed: false, success: true };
            
        } catch (error) {
            console.error('❌ Error hedging portfolio:', error);
            return { action: 'Portfolio hedge failed', error: error.message, success: false };
        }
    }
    
    /**
     * Stop all trading activities
     */
    async stopAllTrading() {
        // Disable automated trading
        if (this.orderManager.setTradingEnabled) {
            this.orderManager.setTradingEnabled(false);
        }
        
        // Cancel all pending orders
        const cancelledOrders = await this.cancelAllPendingOrders();
        
        console.log('🚫 ALL TRADING STOPPED');
        return { action: 'All trading stopped', cancelledOrders, success: true };
    }
    
    /**
     * Emergency unwind all positions in priority order
     */
    async emergencyUnwind() {
        console.log('🚨 EMERGENCY UNWIND INITIATED');
        
        const positions = await this.riskManager.getCurrentPositions();
        const unwindResults = [];
        
        // Group positions by strategy and unwind in priority order
        for (const priority of this.unwindPriorities) {
            const strategyPositions = positions.filter(pos => pos.strategy === priority.strategy);
            
            for (const position of strategyPositions) {
                try {
                    const result = await this.closePosition(position, 'EMERGENCY_UNWIND');
                    unwindResults.push(result);
                    
                    // Brief pause between emergency closes
                    await this.sleep(1000);
                } catch (error) {
                    console.error(`❌ Emergency unwind failed for ${position.symbol}:`, error);
                    unwindResults.push({ position: position.symbol, error: error.message });
                }
            }
        }
        
        console.log(`🚨 Emergency unwind completed: ${unwindResults.length} positions`);
        return { action: 'Emergency unwind', results: unwindResults, success: true };
    }
    
    /**
     * Close all positions (nuclear option)
     */
    async closeAllPositions() {
        console.log('🚨 NUCLEAR OPTION: CLOSING ALL POSITIONS');
        
        const positions = await this.riskManager.getCurrentPositions();
        const closeResults = [];
        
        // Close everything as fast as possible
        const closePromises = positions.map(position => 
            this.closePosition(position, 'NUCLEAR_CLOSE').catch(error => ({
                position: position.symbol,
                error: error.message
            }))
        );
        
        const results = await Promise.all(closePromises);
        
        console.log(`🚨 Nuclear close completed: ${results.length} positions processed`);
        return { action: 'Nuclear close', results, success: true };
    }
    
    /**
     * Notify operator (log only, no alerts per user requirement)
     */
    async notifyOperator() {
        const notification = {
            timestamp: new Date().toISOString(),
            level: 'RED',
            message: 'EMERGENCY PROTOCOLS ACTIVATED - OPERATOR ATTENTION REQUIRED',
            emergencyLevel: this.emergencyLevel,
            activePositions: (await this.riskManager.getCurrentPositions()).length
        };
        
        // Log to emergency file
        this.logEmergencyNotification(notification);
        
        console.log('🚨 OPERATOR NOTIFICATION LOGGED (NO ALERTS PER USER REQUIREMENT)');
        return { action: 'Operator notified', notification, success: true };
    }
    
    /**
     * Close a position with specified reason
     */
    async closePosition(position, reason) {
        try {
            // For paper trading, just log the close
            if (process.env.PAPER_TRADING !== 'false') {
                console.log(`📄 PAPER: Closing ${position.symbol} - Reason: ${reason}`);
                return { position: position.symbol, reason, mode: 'PAPER', success: true };
            }
            
            // For live trading, execute actual close
            const closeOrder = await this.orderManager.createCloseOrder(position);
            const result = await this.orderManager.placeOrder(closeOrder);
            
            return { position: position.symbol, reason, orderId: result.orderId, success: result.success };
            
        } catch (error) {
            throw new Error(`Failed to close ${position.symbol}: ${error.message}`);
        }
    }
    
    /**
     * Utility functions
     */
    
    escalateLevel(current, new_level) {
        const levels = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
        const currentIndex = levels.indexOf(current);
        const newIndex = levels.indexOf(new_level);
        return newIndex > currentIndex ? new_level : current;
    }
    
    getHighestAlertLevel(levels) {
        const hierarchy = ['GREEN', 'YELLOW', 'ORANGE', 'RED'];
        let highest = 'GREEN';
        
        for (const level of levels) {
            if (hierarchy.indexOf(level) > hierarchy.indexOf(highest)) {
                highest = level;
            }
        }
        
        return highest;
    }
    
    async getCurrentMarketData() {
        try {
            const [spyQuote, vixQuote] = await Promise.all([
                this.api.getQuote('SPY'),
                this.api.getQuote('VIX')
            ]);
            
            // Calculate daily moves (simplified)
            const spyDailyMove = (spyQuote.last - spyQuote.open) / spyQuote.open;
            const spy15MinMove = (spyQuote.last - spyQuote.high) / spyQuote.high; // Approximation
            
            return {
                spy: spyQuote.last,
                vix: vixQuote.last,
                spyDailyMove,
                spy15MinMove
            };
        } catch (error) {
            console.error('❌ Error getting market data:', error);
            return { spy: 450, vix: 20, spyDailyMove: 0, spy15MinMove: 0 }; // Safe defaults
        }
    }
    
    isAfterHours() {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const hour = et.getHours();
        return hour < 9 || hour >= 16; // Before 9 AM or after 4 PM ET
    }
    
    async hasOpenPositions() {
        const positions = await this.riskManager.getCurrentPositions();
        return positions.length > 0;
    }
    
    async get0DTEPositions() {
        const positions = await this.riskManager.getCurrentPositions();
        return positions.filter(pos => pos.dte === 0);
    }
    
    groupPositionsByStrategy(positions) {
        const groups = {};
        for (const position of positions) {
            const strategy = position.strategy || 'UNKNOWN';
            if (!groups[strategy]) groups[strategy] = [];
            groups[strategy].push(position);
        }
        return groups;
    }
    
    isRiskyPosition(position) {
        // High risk indicators
        return (
            position.dte <= 1 ||                    // Near expiration
            position.unrealizedPL < -50 ||          // Losing money
            position.gamma > 0.1 ||                 // High gamma
            position.strategy === '0DTE'            // 0DTE always risky
        );
    }
    
    calculateRiskScore(position) {
        let score = 0;
        
        // Time risk
        score += Math.max(0, 10 - (position.dte || 30)); // Higher score for less time
        
        // P&L risk
        score += Math.max(0, -(position.unrealizedPL || 0) / 10); // Higher score for losses
        
        // Greeks risk
        score += Math.abs(position.delta || 0) * 10;
        score += Math.abs(position.gamma || 0) * 100;
        
        return score;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Logging functions
     */
    
    logMonitoringCheck(checks, level) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'MONITORING_CHECK',
            level,
            checks
        };
        
        this.appendToLog(logEntry);
    }
    
    logEmergencyEvent(event) {
        this.appendToLog({
            timestamp: new Date().toISOString(),
            type: 'EMERGENCY_EVENT',
            ...event
        });
    }
    
    logEmergencyNotification(notification) {
        this.appendToLog({
            timestamp: new Date().toISOString(),
            type: 'OPERATOR_NOTIFICATION',
            ...notification
        });
    }
    
    appendToLog(entry) {
        try {
            const logs = this.loadLogs();
            logs.push(entry);
            
            // Keep only last 10000 entries
            if (logs.length > 10000) {
                logs.splice(0, logs.length - 10000);
            }
            
            fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('❌ Error writing emergency log:', error);
        }
    }
    
    loadLogs() {
        try {
            if (fs.existsSync(this.logFile)) {
                return JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Error loading emergency logs:', error);
        }
        return [];
    }
    
    ensureLogDir() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    /**
     * Get emergency protocol status
     */
    getStatus() {
        return {
            emergencyActive: this.emergencyActive,
            emergencyLevel: this.emergencyLevel,
            lastCheckTime: this.lastCheckTime,
            monitoringActive: !!this.monitoringInterval,
            emergencyHistory: this.emergencyHistory.slice(-10), // Last 10 events
            circuitBreakers: this.circuitBreakers
        };
    }
    
    /**
     * Manual emergency trigger
     */
    async triggerEmergency(level, reason) {
        console.log(`🚨 MANUAL EMERGENCY TRIGGER: ${level} - ${reason}`);
        
        await this.handleEmergencyLevelChange(this.emergencyLevel, level, [{
            type: 'MANUAL_TRIGGER',
            level: level,
            message: reason,
            triggeredBy: 'OPERATOR'
        }]);
    }
    
    /**
     * Reset emergency state
     */
    async resetEmergencyState() {
        console.log('🔄 Resetting emergency state to GREEN');
        
        this.emergencyLevel = 'GREEN';
        this.emergencyActive = false;
        
        // Re-enable trading if it was disabled
        if (this.orderManager.setTradingEnabled) {
            this.orderManager.setTradingEnabled(true);
        }
        
        if (this.orderManager.setNewOrdersEnabled) {
            this.orderManager.setNewOrdersEnabled(true);
        }
        
        console.log('✅ Emergency state reset to normal operations');
    }
    
    /**
     * Cleanup monitoring intervals
     */
    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.afterHoursInterval) {
            clearInterval(this.afterHoursInterval);
            this.afterHoursInterval = null;
        }
        
        console.log('🧹 Emergency protocols cleanup completed');
    }
}

module.exports = EmergencyProtocols;