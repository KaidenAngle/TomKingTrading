/**
 * Treasury Auction Calendar Protection Module
 * Provides automated protection against Treasury auction volatility events
 * Implements Tom King's risk management protocols for auction days
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');
const { WebFetch } = require('../utils/webUtils');

const logger = getLogger();

/**
 * Treasury Auction Types and Their Market Impact
 */
const AUCTION_TYPES = {
    // Bills (High Frequency, Lower Impact)
    '4_WEEK': { frequency: 'Weekly', impact: 'LOW', avgVolatility: 0.002 },
    '8_WEEK': { frequency: 'Weekly', impact: 'LOW', avgVolatility: 0.003 },
    '13_WEEK': { frequency: 'Weekly', impact: 'MEDIUM', avgVolatility: 0.005 },
    '26_WEEK': { frequency: 'Weekly', impact: 'MEDIUM', avgVolatility: 0.007 },
    '52_WEEK': { frequency: 'Monthly', impact: 'MEDIUM', avgVolatility: 0.008 },
    
    // Notes (Medium Frequency, Higher Impact)
    '2_YEAR': { frequency: 'Monthly', impact: 'HIGH', avgVolatility: 0.015 },
    '3_YEAR': { frequency: 'Monthly', impact: 'HIGH', avgVolatility: 0.018 },
    '5_YEAR': { frequency: 'Monthly', impact: 'HIGH', avgVolatility: 0.020 },
    '7_YEAR': { frequency: 'Monthly', impact: 'HIGH', avgVolatility: 0.022 },
    '10_YEAR': { frequency: 'Monthly', impact: 'VERY_HIGH', avgVolatility: 0.025 },
    
    // Bonds (Low Frequency, Highest Impact)
    '20_YEAR': { frequency: 'Monthly', impact: 'VERY_HIGH', avgVolatility: 0.030 },
    '30_YEAR': { frequency: 'Monthly', impact: 'EXTREME', avgVolatility: 0.035 },
    
    // Special Issues
    'TIPS_5': { frequency: 'Quarterly', impact: 'HIGH', avgVolatility: 0.018 },
    'TIPS_10': { frequency: 'Quarterly', impact: 'VERY_HIGH', avgVolatility: 0.025 },
    'TIPS_30': { frequency: 'Quarterly', impact: 'EXTREME', avgVolatility: 0.032 },
    'FRN': { frequency: 'Monthly', impact: 'MEDIUM', avgVolatility: 0.012 }
};

/**
 * Market Sectors Most Affected by Treasury Auctions
 */
const AFFECTED_SECTORS = {
    // Direct Impact (Fixed Income)
    DIRECT: ['TLT', 'IEF', 'SHY', 'TIP', 'BND', 'AGG', 'LQD', 'HYG'],
    
    // High Correlation (Interest Rate Sensitive)
    HIGH_CORRELATION: ['XLF', 'XLRE', 'XLU', 'VNQ', 'KRE', 'IYR'],
    
    // Medium Correlation (Growth Stocks)
    MEDIUM_CORRELATION: ['XLK', 'QQQ', 'ARKK', 'TQQQ', 'SOXL'],
    
    // Currency Impact
    CURRENCY: ['UUP', 'FXE', 'FXY', 'EUO', 'YCS']
};

/**
 * Tom King's Treasury Auction Protection Rules
 */
const PROTECTION_RULES = {
    // Pre-Auction (1-2 days before)
    PRE_AUCTION: {
        durationHours: 48,
        actions: ['REDUCE_SIZE', 'WIDEN_STRIKES', 'INCREASE_HEDGING'],
        restrictedStrategies: ['0DTE', 'WEEKLY_SHORT'],
        maxBPUsage: 0.60, // Reduce from normal 65-80%
        correlation: {
            maxDirectPositions: 1,      // Only 1 TLT/bond position
            maxHighCorr: 2,             // Limit rate-sensitive positions
            totalLimit: 6               // Reduced from normal 8-10
        }
    },
    
    // Auction Day
    AUCTION_DAY: {
        restrictionWindow: { start: 10, end: 16 }, // 10 AM to 4 PM EST
        actions: ['PAUSE_ENTRIES', 'MONITOR_CLOSELY', 'PREPARE_EXITS'],
        restrictedStrategies: ['ALL_NEW_ENTRIES'],
        emergencyThreshold: 0.015, // 1.5% move triggers emergency protocol
        maxNewBP: 0.20, // Only 20% new buying power allocation
        monitoring: {
            interval: 30000, // Check every 30 seconds
            volatilityThreshold: 2.0, // 2x normal volatility
            correlationThreshold: 0.8 // High correlation warning
        }
    },
    
    // Post-Auction (4-6 hours after)
    POST_AUCTION: {
        durationHours: 6,
        actions: ['REASSESS_POSITIONS', 'NORMALIZE_EXPOSURE'],
        settlementPeriod: 2, // Hours to wait before full normalization
        volatilityDecay: 0.7 // Expected volatility reduction factor
    }
};

/**
 * Treasury Auction Calendar Manager
 */
class TreasuryAuctionCalendar extends EventEmitter {
    constructor(api = null, riskManager = null) {
        super();
        
        this.api = api;
        this.riskManager = riskManager;
        this.auctionCalendar = [];
        this.activeProtections = new Map(); // Current protection states
        this.protectionHistory = []; // Historical protection events
        
        // Configuration
        this.config = {
            enabled: true,
            autoProtection: true,
            lookAheadDays: 7,
            dataSource: 'TREASURY_DIRECT', // Primary source
            backupSources: ['FRED', 'YAHOO_FINANCE'],
            updateInterval: 3600000, // Update hourly
            emergencyUpdateInterval: 300000 // 5 minutes during auction day
        };
        
        this.lastUpdate = null;
        this.updateInterval = null;
        this.isAuctionDay = false;
        this.currentAuctions = [];
        
        // Initialize calendar
        this.initializeCalendar();
    }
    
    /**
     * Initialize the auction calendar system
     */
    async initializeCalendar() {
        try {
            logger.info('TREASURY', 'Initializing Treasury Auction Calendar');
            
            // Load initial calendar data
            await this.loadAuctionCalendar();
            
            // Start monitoring
            this.startMonitoring();
            
            logger.info('TREASURY', 'Treasury Auction Calendar initialized successfully', {
                upcomingAuctions: this.getUpcomingAuctions(7).length,
                autoProtection: this.config.autoProtection
            });
            
        } catch (error) {
            logger.error('TREASURY', 'Failed to initialize Treasury Auction Calendar', error);
            throw error;
        }
    }
    
    /**
     * Load auction calendar from Treasury Direct and backup sources
     */
    async loadAuctionCalendar() {
        try {
            // Try primary source first
            let calendarData = await this.fetchFromTreasuryDirect();
            
            if (!calendarData || calendarData.length === 0) {
                // Fallback to backup sources
                logger.warn('TREASURY', 'Primary source unavailable, trying backup sources');
                calendarData = await this.fetchFromBackupSources();
            }
            
            if (!calendarData || calendarData.length === 0) {
                // Generate default calendar based on historical patterns
                logger.warn('TREASURY', 'All sources unavailable, generating default calendar');
                calendarData = this.generateDefaultCalendar();
            }
            
            // Process and validate calendar data
            this.auctionCalendar = this.processCalendarData(calendarData);
            this.lastUpdate = new Date();
            
            // Emit calendar loaded event
            this.emit('calendar_loaded', {
                totalAuctions: this.auctionCalendar.length,
                nextAuction: this.getNextAuction(),
                upcomingHighImpact: this.getUpcomingAuctions(30, 'HIGH').length
            });
            
            logger.info('TREASURY', 'Auction calendar loaded', {
                totalAuctions: this.auctionCalendar.length,
                dateRange: {
                    from: this.auctionCalendar[0]?.date || 'N/A',
                    to: this.auctionCalendar[this.auctionCalendar.length - 1]?.date || 'N/A'
                }
            });
            
        } catch (error) {
            logger.error('TREASURY', 'Failed to load auction calendar', error);
            throw error;
        }
    }
    
    /**
     * Fetch auction data from Treasury Direct API
     */
    async fetchFromTreasuryDirect() {
        try {
            const today = new Date();
            const endDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days ahead
            
            // Treasury Direct API endpoint
            const url = `https://www.treasurydirect.gov/TA_WS/securities/auctioned`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'TomKingTradingFramework/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Treasury Direct API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            logger.warn('TREASURY', 'Failed to fetch from Treasury Direct', error.message);
            return null;
        }
    }
    
    /**
     * Fetch from backup data sources
     */
    async fetchFromBackupSources() {
        const sources = [
            () => this.fetchFromFRED(),
            () => this.fetchFromYahooFinance(),
            () => this.fetchFromMarketWatch()
        ];
        
        for (const fetchSource of sources) {
            try {
                const data = await fetchSource();
                if (data && data.length > 0) {
                    return data;
                }
            } catch (error) {
                logger.warn('TREASURY', 'Backup source failed', error.message);
                continue;
            }
        }
        
        return null;
    }
    
    /**
     * Fetch from FRED (Federal Reserve Economic Data)
     */
    async fetchFromFRED() {
        // This would require FRED API key
        // For now, return null to trigger default calendar
        logger.info('TREASURY', 'FRED data source requires API key configuration');
        return null;
    }
    
    /**
     * Fetch from Yahoo Finance
     */
    async fetchFromYahooFinance() {
        // Yahoo Finance doesn't have a direct Treasury auction API
        // This would require screen scraping which is unreliable
        logger.info('TREASURY', 'Yahoo Finance does not provide Treasury auction data');
        return null;
    }
    
    /**
     * Fetch from MarketWatch
     */
    async fetchFromMarketWatch() {
        // MarketWatch economic calendar might have auction data
        // This would require screen scraping
        logger.info('TREASURY', 'MarketWatch data source not yet implemented');
        return null;
    }
    
    /**
     * Generate default calendar based on historical auction patterns
     */
    generateDefaultCalendar() {
        const calendar = [];
        const today = new Date();
        
        // Generate typical auction schedule for next 90 days
        for (let i = 0; i < 90; i++) {
            const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
            const dayOfWeek = date.getDay();
            const weekOfMonth = Math.ceil(date.getDate() / 7);
            
            // Weekly bill auctions (Tuesdays and Thursdays)
            if (dayOfWeek === 2) { // Tuesday
                calendar.push({
                    date: date,
                    type: '13_WEEK',
                    time: '11:30',
                    impact: 'MEDIUM',
                    size: '42000000000', // $42B typical
                    source: 'GENERATED'
                });
                
                calendar.push({
                    date: date,
                    type: '26_WEEK',
                    time: '11:30',
                    impact: 'MEDIUM',
                    size: '39000000000', // $39B typical
                    source: 'GENERATED'
                });
            }
            
            if (dayOfWeek === 4) { // Thursday
                calendar.push({
                    date: date,
                    type: '4_WEEK',
                    time: '11:30',
                    impact: 'LOW',
                    size: '45000000000', // $45B typical
                    source: 'GENERATED'
                });
            }
            
            // Monthly note/bond auctions (usually mid-month)
            if (weekOfMonth === 2 && dayOfWeek === 3) { // Second Wednesday
                const monthlyAuctions = [
                    { type: '3_YEAR', size: '38000000000' },
                    { type: '10_YEAR', size: '35000000000' },
                    { type: '30_YEAR', size: '18000000000' }
                ];
                
                monthlyAuctions.forEach((auction, index) => {
                    const auctionDate = new Date(date);
                    auctionDate.setDate(date.getDate() + index); // Spread over 3 days
                    
                    calendar.push({
                        date: auctionDate,
                        type: auction.type,
                        time: '13:00', // 1 PM EST
                        impact: AUCTION_TYPES[auction.type]?.impact || 'HIGH',
                        size: auction.size,
                        source: 'GENERATED'
                    });
                });
            }
        }
        
        return calendar;
    }
    
    /**
     * Process and validate calendar data
     */
    processCalendarData(rawData) {
        return rawData
            .map(auction => ({
                id: this.generateAuctionId(auction),
                date: new Date(auction.date),
                type: auction.type,
                time: auction.time || '11:30',
                impact: AUCTION_TYPES[auction.type]?.impact || 'MEDIUM',
                size: parseFloat(auction.size) || 0,
                frequency: AUCTION_TYPES[auction.type]?.frequency || 'Unknown',
                avgVolatility: AUCTION_TYPES[auction.type]?.avgVolatility || 0.01,
                affectedSectors: this.getAffectedSectors(auction.type),
                protectionRequired: this.isProtectionRequired(auction),
                source: auction.source || 'API'
            }))
            .filter(auction => auction.date >= new Date()) // Only future auctions
            .sort((a, b) => a.date - b.date); // Sort by date
    }
    
    /**
     * Start monitoring for auction events
     */
    startMonitoring() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Set up regular updates
        this.updateInterval = setInterval(() => {
            this.checkAuctionEvents();
            this.updateCalendar();
        }, this.config.updateInterval);
        
        // Initial check
        this.checkAuctionEvents();
        
        logger.info('TREASURY', 'Started auction monitoring', {
            updateInterval: this.config.updateInterval / 1000 / 60, // minutes
            autoProtection: this.config.autoProtection
        });
    }
    
    /**
     * Check for auction events and trigger protections
     */
    async checkAuctionEvents() {
        try {
            const now = new Date();
            const upcomingAuctions = this.getUpcomingAuctions(3); // Next 3 days
            const todayAuctions = this.getTodayAuctions();
            
            // Check if today is an auction day
            const wasAuctionDay = this.isAuctionDay;
            this.isAuctionDay = todayAuctions.length > 0;
            this.currentAuctions = todayAuctions;
            
            // Auction day state change
            if (this.isAuctionDay && !wasAuctionDay) {
                this.onAuctionDayStart();
            } else if (!this.isAuctionDay && wasAuctionDay) {
                this.onAuctionDayEnd();
            }
            
            // Check pre-auction protections
            for (const auction of upcomingAuctions) {
                const hoursUntil = (auction.date - now) / (1000 * 60 * 60);
                
                if (hoursUntil <= 48 && hoursUntil > 24) {
                    await this.activatePreAuctionProtection(auction);
                } else if (hoursUntil <= 6 && hoursUntil > 0) {
                    await this.activatePostAuctionProtection(auction);
                }
            }
            
            // Emit status update
            this.emit('auction_status', {
                isAuctionDay: this.isAuctionDay,
                todayAuctions: todayAuctions.length,
                upcomingAuctions: upcomingAuctions.length,
                activeProtections: this.activeProtections.size
            });
            
        } catch (error) {
            logger.error('TREASURY', 'Error checking auction events', error);
        }
    }
    
    /**
     * Activate pre-auction protection measures
     */
    async activatePreAuctionProtection(auction) {
        const protectionKey = `pre_${auction.id}`;
        
        if (this.activeProtections.has(protectionKey)) {
            return; // Already activated
        }
        
        try {
            const protection = {
                id: protectionKey,
                auction: auction,
                type: 'PRE_AUCTION',
                startTime: new Date(),
                rules: PROTECTION_RULES.PRE_AUCTION,
                status: 'ACTIVE'
            };
            
            this.activeProtections.set(protectionKey, protection);
            
            // Apply protection measures
            if (this.config.autoProtection && this.riskManager) {
                await this.applyProtectionMeasures(protection);
            }
            
            // Emit protection event
            this.emit('protection_activated', protection);
            
            logger.warn('TREASURY', 'Pre-auction protection activated', {
                auction: auction.type,
                date: auction.date.toISOString(),
                impact: auction.impact,
                hoursUntil: Math.round((auction.date - new Date()) / (1000 * 60 * 60))
            });
            
        } catch (error) {
            logger.error('TREASURY', 'Failed to activate pre-auction protection', error);
        }
    }
    
    /**
     * Handle auction day start
     */
    onAuctionDayStart() {
        logger.warn('TREASURY', 'AUCTION DAY STARTED - Enhanced monitoring active', {
            auctions: this.currentAuctions.map(a => ({
                type: a.type,
                time: a.time,
                impact: a.impact
            }))
        });
        
        // Increase monitoring frequency
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.checkAuctionEvents();
        }, this.config.emergencyUpdateInterval);
        
        // Emit auction day event
        this.emit('auction_day_start', {
            auctions: this.currentAuctions,
            protectionLevel: 'HIGH'
        });
    }
    
    /**
     * Handle auction day end
     */
    onAuctionDayEnd() {
        logger.info('TREASURY', 'Auction day ended - Normalizing monitoring', {
            completedAuctions: this.currentAuctions.length
        });
        
        // Return to normal monitoring frequency
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.checkAuctionEvents();
            this.updateCalendar();
        }, this.config.updateInterval);
        
        // Emit auction day end event
        this.emit('auction_day_end', {
            completedAuctions: this.currentAuctions.length,
            protectionLevel: 'NORMAL'
        });
    }
    
    /**
     * Apply protection measures through risk manager
     */
    async applyProtectionMeasures(protection) {
        if (!this.riskManager) {
            logger.warn('TREASURY', 'Risk manager not available for protection measures');
            return;
        }
        
        try {
            const measures = protection.rules;
            
            // Reduce position sizes
            if (measures.maxBPUsage) {
                await this.riskManager.setTemporaryBPLimit(measures.maxBPUsage, 'TREASURY_AUCTION');
            }
            
            // Update correlation limits
            if (measures.correlation) {
                await this.riskManager.setTemporaryCorrelationLimits(measures.correlation, 'TREASURY_AUCTION');
            }
            
            // Restrict strategies
            if (measures.restrictedStrategies) {
                await this.riskManager.setRestrictedStrategies(measures.restrictedStrategies, 'TREASURY_AUCTION');
            }
            
            logger.info('TREASURY', 'Protection measures applied', {
                maxBP: measures.maxBPUsage,
                restrictedStrategies: measures.restrictedStrategies?.length || 0,
                correlationLimits: Object.keys(measures.correlation || {}).length
            });
            
        } catch (error) {
            logger.error('TREASURY', 'Failed to apply protection measures', error);
        }
    }
    
    /**
     * Get upcoming auctions
     */
    getUpcomingAuctions(days = 7, impactLevel = null) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() + days);
        
        return this.auctionCalendar
            .filter(auction => auction.date <= cutoffDate)
            .filter(auction => !impactLevel || auction.impact === impactLevel);
    }
    
    /**
     * Get today's auctions
     */
    getTodayAuctions() {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        
        return this.auctionCalendar
            .filter(auction => auction.date >= startOfDay && auction.date < endOfDay);
    }
    
    /**
     * Get next auction
     */
    getNextAuction() {
        const now = new Date();
        return this.auctionCalendar.find(auction => auction.date > now);
    }
    
    /**
     * Check if ticker is affected by Treasury auctions
     */
    isAffectedTicker(ticker) {
        return Object.values(AFFECTED_SECTORS).some(sector => 
            sector.includes(ticker.toUpperCase())
        );
    }
    
    /**
     * Get protection recommendations for a ticker
     */
    getProtectionRecommendations(ticker, strategy) {
        if (!this.isAffectedTicker(ticker)) {
            return { required: false };
        }
        
        const upcomingAuctions = this.getUpcomingAuctions(3);
        const highImpactAuctions = upcomingAuctions.filter(a => 
            ['HIGH', 'VERY_HIGH', 'EXTREME'].includes(a.impact)
        );
        
        if (highImpactAuctions.length === 0) {
            return { required: false };
        }
        
        const affectionLevel = this.getAffectionLevel(ticker);
        const recommendations = {
            required: true,
            level: affectionLevel,
            actions: [],
            restrictions: []
        };
        
        // Generate specific recommendations
        switch (affectionLevel) {
            case 'DIRECT':
                recommendations.actions.push('AVOID_NEW_POSITIONS');
                recommendations.actions.push('REDUCE_EXISTING_SIZE');
                recommendations.actions.push('WIDEN_STRIKE_SELECTION');
                recommendations.restrictions.push('NO_0DTE');
                recommendations.restrictions.push('NO_WEEKLY_SHORT');
                break;
                
            case 'HIGH':
                recommendations.actions.push('REDUCE_SIZE_50PCT');
                recommendations.actions.push('INCREASE_HEDGING');
                recommendations.restrictions.push('LIMIT_SHORT_PREMIUM');
                break;
                
            case 'MEDIUM':
                recommendations.actions.push('MONITOR_CLOSELY');
                recommendations.actions.push('PREPARE_QUICK_EXITS');
                break;
        }
        
        return recommendations;
    }
    
    /**
     * Utility methods
     */
    generateAuctionId(auction) {
        return `${auction.type}_${new Date(auction.date).toISOString().split('T')[0]}`;
    }
    
    getAffectedSectors(auctionType) {
        if (['30_YEAR', '20_YEAR', 'TIPS_30'].includes(auctionType)) {
            return ['DIRECT', 'HIGH_CORRELATION', 'CURRENCY'];
        } else if (['10_YEAR', '7_YEAR', '5_YEAR'].includes(auctionType)) {
            return ['DIRECT', 'HIGH_CORRELATION'];
        } else {
            return ['DIRECT'];
        }
    }
    
    isProtectionRequired(auction) {
        return ['HIGH', 'VERY_HIGH', 'EXTREME'].includes(
            AUCTION_TYPES[auction.type]?.impact || 'MEDIUM'
        );
    }
    
    getAffectionLevel(ticker) {
        if (AFFECTED_SECTORS.DIRECT.includes(ticker.toUpperCase())) {
            return 'DIRECT';
        } else if (AFFECTED_SECTORS.HIGH_CORRELATION.includes(ticker.toUpperCase())) {
            return 'HIGH';
        } else if (AFFECTED_SECTORS.MEDIUM_CORRELATION.includes(ticker.toUpperCase())) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }
    
    /**
     * Update calendar (refresh data)
     */
    async updateCalendar() {
        const hoursSinceUpdate = this.lastUpdate ? 
            (new Date() - this.lastUpdate) / (1000 * 60 * 60) : 24;
        
        if (hoursSinceUpdate >= 24) { // Daily refresh
            try {
                await this.loadAuctionCalendar();
            } catch (error) {
                logger.error('TREASURY', 'Failed to update calendar', error);
            }
        }
    }
    
    /**
     * Get current status
     */
    getStatus() {
        return {
            enabled: this.config.enabled,
            isAuctionDay: this.isAuctionDay,
            currentAuctions: this.currentAuctions.length,
            activeProtections: this.activeProtections.size,
            upcomingAuctions: this.getUpcomingAuctions(7).length,
            nextAuction: this.getNextAuction(),
            lastUpdate: this.lastUpdate,
            calendarSize: this.auctionCalendar.length
        };
    }
    
    /**
     * Manual protection override
     */
    async activateManualProtection(level = 'HIGH', duration = 24) {
        const protectionKey = `manual_${Date.now()}`;
        const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);
        
        const protection = {
            id: protectionKey,
            type: 'MANUAL',
            level: level,
            startTime: new Date(),
            endTime: endTime,
            status: 'ACTIVE'
        };
        
        this.activeProtections.set(protectionKey, protection);
        
        logger.warn('TREASURY', 'Manual protection activated', {
            level: level,
            duration: duration,
            endTime: endTime.toISOString()
        });
        
        this.emit('manual_protection_activated', protection);
        
        return protection;
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.activeProtections.clear();
        
        logger.info('TREASURY', 'Treasury auction monitoring stopped');
    }
}

// Export
module.exports = {
    TreasuryAuctionCalendar,
    AUCTION_TYPES,
    AFFECTED_SECTORS,
    PROTECTION_RULES
};