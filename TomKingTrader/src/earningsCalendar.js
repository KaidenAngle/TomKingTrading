/**
 * Earnings Calendar Integration
 * Monitors and protects positions during earnings announcements
 * Implements pre/post earnings strategies and risk management
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const logger = getLogger();

class EarningsCalendar extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Protection windows
            preEarningsWindow: config.preEarningsWindow || 48, // 48 hours before earnings
            postEarningsWindow: config.postEarningsWindow || 24, // 24 hours after
            
            // Position management
            closeBeforeEarnings: config.closeBeforeEarnings !== false, // Close positions before earnings
            reducePositionPercent: config.reducePositionPercent || 0.75, // Reduce by 75%
            avoidEarningsStocks: config.avoidEarningsStocks !== false,
            
            // Strategy adjustments
            noShortStrangles: config.noShortStrangles !== false, // No short strangles through earnings
            allowEarningsPlays: config.allowEarningsPlays || false, // Allow specific earnings strategies
            maxIVRankForEntry: config.maxIVRankForEntry || 70, // Max IV rank to enter before earnings
            
            // Risk limits
            maxEarningsExposure: config.maxEarningsExposure || 0.10, // 10% of portfolio max
            requireExtraMargin: config.requireExtraMargin || 2.0, // 2x normal margin for earnings
            
            ...config
        };
        
        // Earnings cache - Symbol -> Earnings data
        this.earningsData = new Map();
        this.monitoringInterval = null;
        this.protectedSymbols = new Set();
        
        // Major earnings to track (updated dynamically)
        this.trackedSymbols = [
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
            'SPY', 'QQQ', 'IWM', 'DIA', // ETFs affected by earnings season
            'JPM', 'BAC', 'GS', 'WFC', // Banks
            'XOM', 'CVX', // Energy
            'BA', 'CAT', 'GE' // Industrials
        ];
    }
    
    /**
     * Start monitoring earnings calendar
     */
    async startMonitoring() {
        logger.info('EarningsCalendar', 'Starting earnings monitoring');
        
        // Load initial earnings data
        await this.loadEarningsData();
        
        // Check positions against earnings
        this.checkEarningsRisk();
        
        // Set up daily updates
        this.monitoringInterval = setInterval(async () => {
            await this.loadEarningsData();
            this.checkEarningsRisk();
        }, 86400000); // Daily updates
        
        this.emit('monitoringStarted');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.emit('monitoringStopped');
    }
    
    /**
     * Load earnings data (would connect to earnings API)
     */
    async loadEarningsData() {
        // In production, this would fetch from an earnings API
        // For now, using example data structure
        
        const exampleEarnings = [
            {
                symbol: 'AAPL',
                date: '2025-01-28',
                time: 'AMC', // After Market Close
                fiscalQuarter: 'Q1 2025',
                consensusEPS: 2.18,
                previousEPS: 2.10,
                importance: 'HIGH'
            },
            {
                symbol: 'MSFT',
                date: '2025-01-23',
                time: 'AMC',
                fiscalQuarter: 'Q2 2025',
                consensusEPS: 3.12,
                previousEPS: 2.99,
                importance: 'HIGH'
            },
            {
                symbol: 'NVDA',
                date: '2025-02-20',
                time: 'AMC',
                fiscalQuarter: 'Q4 2025',
                consensusEPS: 4.55,
                previousEPS: 3.71,
                importance: 'HIGH'
            }
        ];
        
        // Store earnings data
        for (const earning of exampleEarnings) {
            this.earningsData.set(earning.symbol, earning);
        }
        
        logger.info('EarningsCalendar', `Loaded earnings data for ${this.earningsData.size} symbols`);
    }
    
    /**
     * Check positions for earnings risk
     */
    checkEarningsRisk(positions = []) {
        const risks = [];
        const now = new Date();
        
        for (const position of positions) {
            const earnings = this.earningsData.get(position.symbol);
            if (!earnings) continue;
            
            const earningsDate = new Date(earnings.date);
            const hoursUntilEarnings = (earningsDate - now) / (1000 * 60 * 60);
            
            // Check if within pre-earnings window
            if (hoursUntilEarnings > 0 && hoursUntilEarnings <= this.config.preEarningsWindow) {
                risks.push({
                    position,
                    earnings,
                    hoursUntil: hoursUntilEarnings,
                    risk: this.assessEarningsRisk(position, earnings, hoursUntilEarnings)
                });
            }
            
            // Check if in post-earnings volatility
            if (hoursUntilEarnings < 0 && Math.abs(hoursUntilEarnings) <= this.config.postEarningsWindow) {
                risks.push({
                    position,
                    earnings,
                    hoursAfter: Math.abs(hoursUntilEarnings),
                    risk: this.assessPostEarningsRisk(position, earnings)
                });
            }
        }
        
        if (risks.length > 0) {
            this.processEarningsRisks(risks);
        }
        
        return risks;
    }
    
    /**
     * Assess pre-earnings risk
     */
    assessEarningsRisk(position, earnings, hoursUntil) {
        const risk = {
            level: 'LOW',
            score: 0,
            actions: [],
            messages: []
        };
        
        // High risk for short options through earnings
        if (position.type === 'SHORT' && hoursUntil <= 24) {
            risk.level = 'CRITICAL';
            risk.score = 90;
            risk.messages.push(`Short position through ${earnings.symbol} earnings in ${hoursUntil.toFixed(0)}h`);
            risk.actions.push('CLOSE_BEFORE_EARNINGS');
        }
        
        // Strangles and straddles are extremely risky through earnings
        if (['STRANGLE', 'STRADDLE', 'IRON_CONDOR'].includes(position.strategy)) {
            if (hoursUntil <= 48) {
                risk.level = 'HIGH';
                risk.score += 40;
                risk.messages.push(`${position.strategy} position at risk from earnings volatility`);
                risk.actions.push('REDUCE_OR_CLOSE');
            }
        }
        
        // Check position size relative to earnings exposure limit
        const exposurePercent = (position.value / position.accountValue) || 0;
        if (exposurePercent > this.config.maxEarningsExposure) {
            risk.level = 'HIGH';
            risk.score += 30;
            risk.messages.push(`Position exceeds earnings exposure limit (${(exposurePercent * 100).toFixed(1)}% > ${(this.config.maxEarningsExposure * 100)}%)`);
            risk.actions.push('REDUCE_SIZE');
        }
        
        // IV considerations
        if (position.iv > this.config.maxIVRankForEntry) {
            risk.score += 20;
            risk.messages.push(`High IV (${position.iv}) before earnings - expensive premiums`);
        }
        
        return risk;
    }
    
    /**
     * Assess post-earnings risk
     */
    assessPostEarningsRisk(position, earnings) {
        const risk = {
            level: 'MEDIUM',
            score: 30,
            actions: [],
            messages: []
        };
        
        // Post-earnings IV crush risk
        risk.messages.push('Post-earnings IV crush period - monitor for opportunities');
        
        // Check for gap risk
        if (position.type === 'SHORT') {
            risk.level = 'HIGH';
            risk.score = 50;
            risk.messages.push('Short position exposed to post-earnings gap risk');
            risk.actions.push('MONITOR_CLOSELY');
        }
        
        return risk;
    }
    
    /**
     * Process earnings risks and take actions
     */
    processEarningsRisks(risks) {
        // Sort by risk score
        risks.sort((a, b) => b.risk.score - a.risk.score);
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 EARNINGS RISK ALERT');
        console.log('='.repeat(60));
        
        for (const item of risks) {
            const icon = item.risk.level === 'CRITICAL' ? '🚨' :
                        item.risk.level === 'HIGH' ? '⚠️' :
                        item.risk.level === 'MEDIUM' ? '📊' : '📌';
            
            console.log(`\n${icon} ${item.position.symbol} - ${item.risk.level} RISK`);
            console.log(`   Earnings: ${item.earnings.date} ${item.earnings.time}`);
            
            if (item.hoursUntil) {
                console.log(`   Time until: ${item.hoursUntil.toFixed(1)} hours`);
            } else if (item.hoursAfter) {
                console.log(`   Time since: ${item.hoursAfter.toFixed(1)} hours ago`);
            }
            
            console.log(`   Risk Score: ${item.risk.score}/100`);
            
            for (const message of item.risk.messages) {
                console.log(`   • ${message}`);
            }
            
            if (item.risk.actions.length > 0) {
                console.log(`   Actions: ${item.risk.actions.join(', ')}`);
            }
        }
        
        console.log('\n' + '='.repeat(60));
        
        // Emit high-risk earnings positions
        const criticalRisks = risks.filter(r => r.risk.level === 'CRITICAL');
        if (criticalRisks.length > 0) {
            this.emit('criticalEarningsRisk', criticalRisks);
        }
        
        // Add symbols to protected list
        for (const item of risks) {
            this.protectedSymbols.add(item.position.symbol);
        }
    }
    
    /**
     * Check if trade is allowed given earnings
     */
    isTradeAllowed(trade) {
        const earnings = this.earningsData.get(trade.symbol);
        if (!earnings) {
            return { allowed: true };
        }
        
        const now = new Date();
        const earningsDate = new Date(earnings.date);
        const hoursUntil = (earningsDate - now) / (1000 * 60 * 60);
        
        const reasons = [];
        
        // Check if within protection window
        if (hoursUntil > 0 && hoursUntil <= this.config.preEarningsWindow) {
            // No new short positions before earnings
            if (trade.type === 'SHORT' && trade.action === 'OPEN') {
                reasons.push(`Cannot open short position ${hoursUntil.toFixed(0)}h before ${trade.symbol} earnings`);
            }
            
            // No strangles/straddles through earnings
            if (this.config.noShortStrangles && ['STRANGLE', 'STRADDLE'].includes(trade.strategy)) {
                reasons.push(`${trade.strategy} not allowed through earnings`);
            }
            
            // Check if avoiding earnings stocks entirely
            if (this.config.avoidEarningsStocks && trade.action === 'OPEN') {
                reasons.push(`Avoiding ${trade.symbol} due to upcoming earnings`);
            }
        }
        
        // Special allowance for earnings plays if enabled
        if (this.config.allowEarningsPlays && trade.strategy === 'EARNINGS_PLAY') {
            return { allowed: true, warning: 'Earnings play allowed but risky' };
        }
        
        return {
            allowed: reasons.length === 0,
            reasons,
            earnings,
            hoursUntilEarnings: hoursUntil > 0 ? hoursUntil : null
        };
    }
    
    /**
     * Get earnings calendar for next N days
     */
    getUpcomingEarnings(days = 7) {
        const now = new Date();
        const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        const upcoming = [];
        
        for (const [symbol, earnings] of this.earningsData) {
            const earningsDate = new Date(earnings.date);
            if (earningsDate >= now && earningsDate <= future) {
                upcoming.push({
                    ...earnings,
                    daysUntil: Math.ceil((earningsDate - now) / (1000 * 60 * 60 * 24))
                });
            }
        }
        
        return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    /**
     * Get recommended position adjustments for earnings
     */
    getEarningsAdjustments(position) {
        const earnings = this.earningsData.get(position.symbol);
        if (!earnings) {
            return { adjustmentNeeded: false };
        }
        
        const now = new Date();
        const earningsDate = new Date(earnings.date);
        const hoursUntil = (earningsDate - now) / (1000 * 60 * 60);
        
        const adjustments = {
            adjustmentNeeded: false,
            recommendations: []
        };
        
        if (hoursUntil > 0 && hoursUntil <= this.config.preEarningsWindow) {
            adjustments.adjustmentNeeded = true;
            
            if (position.type === 'SHORT') {
                adjustments.recommendations.push({
                    action: 'CLOSE',
                    urgency: 'HIGH',
                    reason: 'Short position before earnings'
                });
            } else if (position.strategy === 'STRANGLE') {
                adjustments.recommendations.push({
                    action: 'REDUCE',
                    amount: this.config.reducePositionPercent,
                    urgency: 'MEDIUM',
                    reason: 'Reduce strangle exposure before earnings'
                });
            }
        }
        
        return adjustments;
    }
    
    /**
     * Add earnings date for a symbol
     */
    addEarningsDate(symbol, date, time = 'AMC', importance = 'MEDIUM') {
        this.earningsData.set(symbol, {
            symbol,
            date,
            time,
            importance,
            addedManually: true
        });
        
        logger.info('EarningsCalendar', `Added earnings for ${symbol} on ${date}`);
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            monitoring: this.monitoringInterval !== null,
            totalEarnings: this.earningsData.size,
            protectedSymbols: Array.from(this.protectedSymbols),
            upcomingEarnings: this.getUpcomingEarnings(7),
            config: this.config
        };
    }
}

module.exports = { EarningsCalendar };