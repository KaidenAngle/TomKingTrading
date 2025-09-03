/**
 * Automated Position Entry System
 * Tom King Trading Framework - Advanced automated entry with safety checks
 * Integrates with order manager for safe position automation
 */

const fs = require('fs');
const path = require('path');

class AutomatedPositionEntry {
    constructor(orderManager, riskManager, patternAnalyzer, api) {
        this.orderManager = orderManager;
        this.riskManager = riskManager;
        this.patternAnalyzer = patternAnalyzer;
        this.api = api;
        
        // Automation flags
        this.automationEnabled = process.env.AUTO_ENTRY_ENABLED === 'true';
        this.paperTradingMode = process.env.PAPER_TRADING !== 'false'; // Default to paper trading
        this.maxAutoPositionsPerDay = 10;
        this.autoPositionsToday = 0;
        this.lastResetDate = new Date().toDateString();
        
        // Safety circuits
        this.circuitBreakers = {
            maxDailyLoss: -500, // £500 max daily loss
            maxPositionSize: 0.05, // 5% max per position
            vixLimit: 35, // No automation above VIX 35
            correlationLimit: 3, // Max 3 correlated positions
            timeRestrictions: {
                start: 930, // 9:30 AM ET
                end: 1600, // 4:00 PM ET
                fridayEnd: 1330 // 1:30 PM ET for 0DTE
            }
        };
        
        // Entry conditions for each strategy
        this.entryConditions = {
            '0DTE': {
                minProbability: 0.88,
                minIVPercentile: 30,
                maxDTE: 0,
                timeWindow: { start: 1030, end: 1330 }, // 10:30 AM to 1:30 PM ET
                dayOfWeek: 5, // Friday only
                maxBPUsage: 0.20
            },
            'LT112': {
                minProbability: 0.73,
                minIVPercentile: 25,
                minDTE: 35,
                maxDTE: 50,
                maxBPUsage: 0.30
            },
            'STRANGLE': {
                minProbability: 0.72,
                minIVPercentile: 20,
                minDTE: 30,
                maxDTE: 45,
                maxBPUsage: 0.25
            },
            'BUTTERFLY': {
                minProbability: 0.65,
                minIVPercentile: 15,
                minDTE: 20,
                maxDTE: 40,
                maxBPUsage: 0.15
            }
        };
        
        // Active automation queue
        this.entryQueue = [];
        this.processingQueue = false;
        
        // Logging
        this.logFile = path.join(__dirname, '../logs/automated_entries.json');
        this.ensureLogDir();
        
        console.log('🤖 Automated Position Entry System initialized');
        console.log(`📊 Automation: ${this.automationEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📄 Paper Trading: ${this.paperTradingMode ? 'ON' : 'OFF'}`);
    }
    
    /**
     * Main entry point for automated position evaluation
     */
    async evaluateAndEnter() {
        if (!this.automationEnabled) {
            console.log('🚫 Automation disabled');
            return { success: false, reason: 'Automation disabled' };
        }
        
        try {
            // Reset daily counter if new day
            this.resetDailyCounters();
            
            // Run safety checks
            const safetyCheck = await this.runSafetyChecks();
            if (!safetyCheck.safe) {
                console.log('🚫 Safety check failed:', safetyCheck.reason);
                return { success: false, reason: safetyCheck.reason };
            }
            
            // Get market data and analysis
            const marketData = await this.getMarketAnalysis();
            if (!marketData.success) {
                return { success: false, reason: 'Market data unavailable' };
            }
            
            // Evaluate opportunities for each strategy
            const opportunities = await this.evaluateOpportunities(marketData);
            
            if (opportunities.length === 0) {
                console.log('📊 No automated entry opportunities found');
                return { success: false, reason: 'No opportunities' };
            }
            
            // Rank and process opportunities
            const rankedOpportunities = this.rankOpportunities(opportunities);
            const results = await this.processOpportunities(rankedOpportunities);
            
            return {
                success: true,
                opportunitiesFound: opportunities.length,
                processed: results.length,
                results
            };
            
        } catch (error) {
            console.error('❌ Automated entry evaluation failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Run comprehensive safety checks before automation
     */
    async runSafetyChecks() {
        try {
            // Check if automation is within time restrictions
            const timeCheck = this.checkTimeRestrictions();
            if (!timeCheck.allowed) {
                return { safe: false, reason: `Outside trading hours: ${timeCheck.reason}` };
            }
            
            // Check daily position limit
            if (this.autoPositionsToday >= this.maxAutoPositionsPerDay) {
                return { safe: false, reason: 'Daily automated position limit reached' };
            }
            
            // Check account status
            const accountData = await this.api.getAccountStatus();
            if (!accountData) {
                return { safe: false, reason: 'Cannot retrieve account data' };
            }
            
            // Check daily P&L
            const dailyPL = accountData.dayPL || 0;
            if (dailyPL <= this.circuitBreakers.maxDailyLoss) {
                return { safe: false, reason: 'Daily loss limit exceeded' };
            }
            
            // Check VIX level
            const vixLevel = await this.getCurrentVIX();
            if (vixLevel > this.circuitBreakers.vixLimit) {
                return { safe: false, reason: `VIX too high: ${vixLevel}` };
            }
            
            // Check correlation exposure
            const correlationCheck = await this.riskManager.checkCorrelationExposure();
            if (!correlationCheck.withinLimits) {
                return { safe: false, reason: 'Correlation limits exceeded' };
            }
            
            // Check buying power
            const bpUsage = await this.riskManager.calculateCurrentBPUsage();
            const maxAllowedBP = this.riskManager.getMaxBPUsage(vixLevel);
            if (bpUsage > maxAllowedBP * 0.8) { // Leave 20% buffer for automation
                return { safe: false, reason: 'Buying power too high for automation' };
            }
            
            return { safe: true };
            
        } catch (error) {
            console.error('❌ Safety check error:', error);
            return { safe: false, reason: 'Safety check system error' };
        }
    }
    
    /**
     * Check if current time allows for automated trading
     */
    checkTimeRestrictions() {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const currentTime = et.getHours() * 100 + et.getMinutes();
        const dayOfWeek = et.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
        
        // No weekend trading
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return { allowed: false, reason: 'Weekend - markets closed' };
        }
        
        // Check regular hours
        if (currentTime < this.circuitBreakers.timeRestrictions.start) {
            return { allowed: false, reason: 'Before market open' };
        }
        
        // Friday special hours for 0DTE
        if (dayOfWeek === 5 && currentTime > this.circuitBreakers.timeRestrictions.fridayEnd) {
            return { allowed: false, reason: 'After Friday 0DTE cutoff' };
        }
        
        // Regular market close
        if (currentTime > this.circuitBreakers.timeRestrictions.end) {
            return { allowed: false, reason: 'After market close' };
        }
        
        return { allowed: true };
    }
    
    /**
     * Get current market analysis for automation decisions
     */
    async getMarketAnalysis() {
        try {
            const analysis = await this.patternAnalyzer.analyzeMarket();
            return {
                success: true,
                vixLevel: analysis.vix,
                vixRegime: analysis.vixRegime,
                marketTrend: analysis.trend,
                volatility: analysis.impliedVolatility,
                correlations: analysis.correlations
            };
        } catch (error) {
            console.error('❌ Market analysis failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Evaluate opportunities across all Tom King strategies
     */
    async evaluateOpportunities(marketData) {
        const opportunities = [];
        
        // Evaluate each strategy type
        for (const [strategyType, conditions] of Object.entries(this.entryConditions)) {
            try {
                const strategyOpportunities = await this.evaluateStrategyOpportunities(
                    strategyType, 
                    conditions, 
                    marketData
                );
                opportunities.push(...strategyOpportunities);
            } catch (error) {
                console.error(`❌ Error evaluating ${strategyType}:`, error);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Evaluate opportunities for a specific strategy
     */
    async evaluateStrategyOpportunities(strategyType, conditions, marketData) {
        const opportunities = [];
        
        // Strategy-specific evaluation logic
        switch (strategyType) {
            case '0DTE':
                if (await this.can0DTEToday()) {
                    const zdteOpps = await this.evaluate0DTEOpportunities(conditions, marketData);
                    opportunities.push(...zdteOpps);
                }
                break;
                
            case 'LT112':
                const lt112Opps = await this.evaluateLT112Opportunities(conditions, marketData);
                opportunities.push(...lt112Opps);
                break;
                
            case 'STRANGLE':
                const strangleOpps = await this.evaluateStrangleOpportunities(conditions, marketData);
                opportunities.push(...strangleOpps);
                break;
                
            case 'BUTTERFLY':
                const butterflyOpps = await this.evaluateButterflyOpportunities(conditions, marketData);
                opportunities.push(...butterflyOpps);
                break;
        }
        
        return opportunities;
    }
    
    /**
     * Check if 0DTE is allowed today (Friday only, time restrictions)
     */
    async can0DTEToday() {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
        const dayOfWeek = et.getDay();
        const currentTime = et.getHours() * 100 + et.getMinutes();
        
        // Must be Friday
        if (dayOfWeek !== 5) return false;
        
        // Must be within 0DTE time window
        const conditions = this.entryConditions['0DTE'];
        if (currentTime < conditions.timeWindow.start || currentTime > conditions.timeWindow.end) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Evaluate 0DTE opportunities
     */
    async evaluate0DTEOpportunities(conditions, marketData) {
        const opportunities = [];
        const underlyings = ['SPY', 'QQQ', 'IWM']; // Focus on liquid ETFs
        
        for (const underlying of underlyings) {
            try {
                const analysis = await this.patternAnalyzer.analyze0DTESetup(underlying);
                
                if (analysis.probability >= conditions.minProbability && 
                    analysis.ivPercentile >= conditions.minIVPercentile) {
                    
                    opportunities.push({
                        strategy: '0DTE',
                        underlying,
                        probability: analysis.probability,
                        setup: analysis.setup,
                        premium: analysis.premium,
                        strike: analysis.strike,
                        side: analysis.side, // 'PUT' or 'CALL'
                        expiration: analysis.expiration,
                        ivPercentile: analysis.ivPercentile,
                        rank: analysis.probability * analysis.ivPercentile
                    });
                }
            } catch (error) {
                console.error(`❌ Error evaluating 0DTE for ${underlying}:`, error);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Evaluate Long Term 112 opportunities
     */
    async evaluateLT112Opportunities(conditions, marketData) {
        const opportunities = [];
        const underlyings = ['SPY', 'QQQ', 'IWM', 'TLT', 'GLD'];
        
        for (const underlying of underlyings) {
            try {
                const analysis = await this.patternAnalyzer.analyzeLT112Setup(underlying);
                
                if (analysis.probability >= conditions.minProbability &&
                    analysis.dte >= conditions.minDTE &&
                    analysis.dte <= conditions.maxDTE) {
                    
                    opportunities.push({
                        strategy: 'LT112',
                        underlying,
                        probability: analysis.probability,
                        setup: analysis.setup,
                        netCredit: analysis.netCredit,
                        strikes: analysis.strikes,
                        expiration: analysis.expiration,
                        dte: analysis.dte,
                        rank: analysis.probability * (analysis.netCredit / 1000)
                    });
                }
            } catch (error) {
                console.error(`❌ Error evaluating LT112 for ${underlying}:`, error);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Evaluate Strangle opportunities
     */
    async evaluateStrangleOpportunities(conditions, marketData) {
        const opportunities = [];
        const underlyings = ['SPY', 'QQQ', 'IWM', '/ES', '/NQ'];
        
        for (const underlying of underlyings) {
            try {
                const analysis = await this.patternAnalyzer.analyzeStrangleSetup(underlying);
                
                if (analysis.probability >= conditions.minProbability &&
                    analysis.dte >= conditions.minDTE &&
                    analysis.dte <= conditions.maxDTE) {
                    
                    opportunities.push({
                        strategy: 'STRANGLE',
                        underlying,
                        probability: analysis.probability,
                        setup: analysis.setup,
                        netCredit: analysis.netCredit,
                        strikes: analysis.strikes,
                        expiration: analysis.expiration,
                        dte: analysis.dte,
                        rank: analysis.probability * (analysis.netCredit / 1000)
                    });
                }
            } catch (error) {
                console.error(`❌ Error evaluating Strangle for ${underlying}:`, error);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Evaluate Butterfly opportunities
     */
    async evaluateButterflyOpportunities(conditions, marketData) {
        const opportunities = [];
        const underlyings = ['SPY', 'QQQ'];
        
        for (const underlying of underlyings) {
            try {
                const analysis = await this.patternAnalyzer.analyzeButterflySetup(underlying);
                
                if (analysis.probability >= conditions.minProbability &&
                    analysis.dte >= conditions.minDTE &&
                    analysis.dte <= conditions.maxDTE) {
                    
                    opportunities.push({
                        strategy: 'BUTTERFLY',
                        underlying,
                        probability: analysis.probability,
                        setup: analysis.setup,
                        netDebit: analysis.netDebit,
                        strikes: analysis.strikes,
                        expiration: analysis.expiration,
                        dte: analysis.dte,
                        rank: analysis.probability * (1000 / analysis.netDebit) // Higher rank for lower cost
                    });
                }
            } catch (error) {
                console.error(`❌ Error evaluating Butterfly for ${underlying}:`, error);
            }
        }
        
        return opportunities;
    }
    
    /**
     * Rank opportunities by quality score
     */
    rankOpportunities(opportunities) {
        return opportunities
            .sort((a, b) => b.rank - a.rank)
            .slice(0, 5); // Top 5 opportunities only
    }
    
    /**
     * Process ranked opportunities
     */
    async processOpportunities(opportunities) {
        const results = [];
        
        for (const opportunity of opportunities) {
            try {
                console.log(`🎯 Processing ${opportunity.strategy} opportunity on ${opportunity.underlying}`);
                
                // Final safety check for this specific opportunity
                const opportunityCheck = await this.validateOpportunity(opportunity);
                if (!opportunityCheck.valid) {
                    console.log(`🚫 Opportunity rejected: ${opportunityCheck.reason}`);
                    continue;
                }
                
                // Execute the trade
                const result = await this.executeOpportunity(opportunity);
                results.push(result);
                
                if (result.success) {
                    this.autoPositionsToday++;
                    this.logEntry(opportunity, result);
                    
                    // Brief pause between entries
                    await this.sleep(5000);
                }
                
            } catch (error) {
                console.error('❌ Error processing opportunity:', error);
                results.push({
                    opportunity,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Final validation for specific opportunity
     */
    async validateOpportunity(opportunity) {
        // Check current positions for this underlying
        const positions = await this.riskManager.getPositionsByUnderlying(opportunity.underlying);
        if (positions.length >= 2) {
            return { valid: false, reason: 'Too many positions in this underlying' };
        }
        
        // Check strategy-specific limits
        const conditions = this.entryConditions[opportunity.strategy];
        const currentBPUsage = await this.riskManager.calculateCurrentBPUsage();
        
        if (currentBPUsage + conditions.maxBPUsage > 0.8) {
            return { valid: false, reason: 'Would exceed buying power limits' };
        }
        
        return { valid: true };
    }
    
    /**
     * Execute the actual trade
     */
    async executeOpportunity(opportunity) {
        try {
            let result;
            
            switch (opportunity.strategy) {
                case '0DTE':
                    result = await this.orderManager.place0DTE(
                        opportunity.underlying,
                        opportunity.expiration,
                        opportunity.strike,
                        opportunity.side,
                        opportunity.premium
                    );
                    break;
                    
                case 'LT112':
                    result = await this.orderManager.placeLT112(
                        opportunity.underlying,
                        opportunity.expiration,
                        opportunity.strikes,
                        opportunity.netCredit
                    );
                    break;
                    
                case 'STRANGLE':
                    result = await this.orderManager.placeStrangle(
                        opportunity.underlying,
                        opportunity.expiration,
                        opportunity.strikes.put,
                        opportunity.strikes.call,
                        opportunity.netCredit
                    );
                    break;
                    
                case 'BUTTERFLY':
                    result = await this.orderManager.placeButterfly(
                        opportunity.underlying,
                        opportunity.expiration,
                        opportunity.strikes,
                        opportunity.netDebit
                    );
                    break;
                    
                default:
                    throw new Error(`Unknown strategy: ${opportunity.strategy}`);
            }
            
            return {
                opportunity,
                success: result.success,
                orderId: result.orderId,
                details: result
            };
            
        } catch (error) {
            console.error(`❌ Failed to execute ${opportunity.strategy}:`, error);
            return {
                opportunity,
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get current VIX level
     */
    async getCurrentVIX() {
        try {
            const vixData = await this.api.getQuote('VIX');
            return vixData?.last || 20; // Default to 20 if unavailable
        } catch (error) {
            console.error('❌ Error getting VIX:', error);
            return 20; // Conservative default
        }
    }
    
    /**
     * Reset daily counters if new day
     */
    resetDailyCounters() {
        const today = new Date().toDateString();
        if (this.lastResetDate !== today) {
            this.autoPositionsToday = 0;
            this.lastResetDate = today;
            console.log('🔄 Daily automation counters reset');
        }
    }
    
    /**
     * Log automated entry
     */
    logEntry(opportunity, result) {
        const entry = {
            timestamp: new Date().toISOString(),
            opportunity,
            result,
            mode: this.paperTradingMode ? 'PAPER' : 'LIVE'
        };
        
        try {
            const logs = this.loadLogs();
            logs.push(entry);
            
            // Keep only last 1000 entries
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('❌ Error logging entry:', error);
        }
    }
    
    /**
     * Load existing logs
     */
    loadLogs() {
        try {
            if (fs.existsSync(this.logFile)) {
                return JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
            }
        } catch (error) {
            console.error('❌ Error loading logs:', error);
        }
        return [];
    }
    
    /**
     * Ensure log directory exists
     */
    ensureLogDir() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get automation statistics
     */
    getAutomationStats() {
        const logs = this.loadLogs();
        const today = new Date().toDateString();
        const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === today);
        
        return {
            enabled: this.automationEnabled,
            paperTrading: this.paperTradingMode,
            positionsToday: this.autoPositionsToday,
            maxPositionsPerDay: this.maxAutoPositionsPerDay,
            todaySuccessful: todayLogs.filter(log => log.result.success).length,
            todayFailed: todayLogs.filter(log => !log.result.success).length,
            totalEntries: logs.length,
            lastEntry: logs.length > 0 ? logs[logs.length - 1].timestamp : null
        };
    }
    
    /**
     * Enable/disable automation
     */
    setAutomationEnabled(enabled) {
        this.automationEnabled = enabled;
        console.log(`🤖 Automation ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    /**
     * Set paper trading mode
     */
    setPaperTradingMode(enabled) {
        this.paperTradingMode = enabled;
        console.log(`📄 Paper Trading ${enabled ? 'ON' : 'OFF'}`);
    }
}

module.exports = AutomatedPositionEntry;