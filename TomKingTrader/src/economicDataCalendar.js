/**
 * Economic Data Release Calendar Integration Module
 * Real-time tracking and protection against major economic data releases
 * Implements Tom King's economic event risk management protocols
 */

const { EventEmitter } = require('events');
const { RISK_LIMITS } = require('./config');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Economic Data Impact Classifications and Market Effects
 */
const ECONOMIC_DATA_TYPES = {
    // Tier 1: Market Moving Events (Highest Impact)
    TIER_1: {
        'FOMC_RATE_DECISION': {
            name: 'Federal Reserve Interest Rate Decision',
            impact: 'EXTREME',
            volatilityMultiplier: 3.5,
            sectors: ['ALL'], // Affects entire market
            protectionHours: 4, // 4 hours before/after
            description: 'Most impactful economic event'
        },
        'NFP': {
            name: 'Non-Farm Payrolls',
            impact: 'VERY_HIGH',
            volatilityMultiplier: 2.8,
            sectors: ['FINANCIALS', 'REAL_ESTATE', 'UTILITIES'],
            protectionHours: 2,
            description: 'Monthly employment data - major market mover'
        },
        'CPI': {
            name: 'Consumer Price Index',
            impact: 'VERY_HIGH',
            volatilityMultiplier: 2.5,
            sectors: ['FINANCIALS', 'REAL_ESTATE', 'UTILITIES', 'CONSUMER'],
            protectionHours: 2,
            description: 'Primary inflation measure'
        },
        'GDP': {
            name: 'Gross Domestic Product',
            impact: 'HIGH',
            volatilityMultiplier: 2.2,
            sectors: ['ALL'],
            protectionHours: 1,
            description: 'Quarterly economic growth measure'
        },
        'JOLTS': {
            name: 'Job Openings and Labor Turnover Survey',
            impact: 'HIGH',
            volatilityMultiplier: 2.0,
            sectors: ['FINANCIALS', 'REAL_ESTATE'],
            protectionHours: 1,
            description: 'Labor market dynamics'
        }
    },
    
    // Tier 2: Significant Impact Events
    TIER_2: {
        'RETAIL_SALES': {
            name: 'Retail Sales',
            impact: 'HIGH',
            volatilityMultiplier: 1.8,
            sectors: ['CONSUMER_DISC', 'CONSUMER_STAPLES'],
            protectionHours: 1,
            description: 'Consumer spending indicator'
        },
        'PPI': {
            name: 'Producer Price Index',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.6,
            sectors: ['INDUSTRIALS', 'MATERIALS'],
            protectionHours: 0.5,
            description: 'Wholesale inflation measure'
        },
        'ISM_MANUFACTURING': {
            name: 'ISM Manufacturing PMI',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.5,
            sectors: ['INDUSTRIALS', 'MATERIALS', 'TECHNOLOGY'],
            protectionHours: 0.5,
            description: 'Manufacturing sector health'
        },
        'ISM_SERVICES': {
            name: 'ISM Services PMI',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.4,
            sectors: ['SERVICES', 'TECHNOLOGY', 'FINANCIALS'],
            protectionHours: 0.5,
            description: 'Services sector health'
        },
        'HOUSING_STARTS': {
            name: 'Housing Starts',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.3,
            sectors: ['REAL_ESTATE', 'MATERIALS', 'INDUSTRIALS'],
            protectionHours: 0.5,
            description: 'Housing market activity'
        }
    },
    
    // Tier 3: Moderate Impact Events
    TIER_3: {
        'INITIAL_CLAIMS': {
            name: 'Initial Jobless Claims',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.2,
            sectors: ['FINANCIALS'],
            protectionHours: 0.25,
            description: 'Weekly unemployment claims'
        },
        'CONSUMER_CONFIDENCE': {
            name: 'Consumer Confidence Index',
            impact: 'LOW',
            volatilityMultiplier: 1.1,
            sectors: ['CONSUMER_DISC', 'CONSUMER_STAPLES'],
            protectionHours: 0.25,
            description: 'Consumer sentiment measure'
        },
        'DURABLE_GOODS': {
            name: 'Durable Goods Orders',
            impact: 'LOW',
            volatilityMultiplier: 1.1,
            sectors: ['INDUSTRIALS', 'TECHNOLOGY'],
            protectionHours: 0.25,
            description: 'Business investment indicator'
        }
    },
    
    // International Events (Can Have Major Impact)
    INTERNATIONAL: {
        'ECB_RATE_DECISION': {
            name: 'European Central Bank Rate Decision',
            impact: 'HIGH',
            volatilityMultiplier: 2.0,
            sectors: ['FINANCIALS', 'CURRENCY'],
            protectionHours: 2,
            description: 'European monetary policy'
        },
        'BOJ_RATE_DECISION': {
            name: 'Bank of Japan Rate Decision',
            impact: 'MEDIUM',
            volatilityMultiplier: 1.5,
            sectors: ['TECHNOLOGY', 'CURRENCY'],
            protectionHours: 1,
            description: 'Japanese monetary policy'
        },
        'CHINA_GDP': {
            name: 'China GDP',
            impact: 'HIGH',
            volatilityMultiplier: 1.8,
            sectors: ['MATERIALS', 'INDUSTRIALS', 'TECHNOLOGY'],
            protectionHours: 1,
            description: 'Chinese economic growth'
        }
    }
};

/**
 * Economic Data Release Schedule (Typical Monthly Pattern)
 */
const RELEASE_SCHEDULE = {
    // First Week of Month
    WEEK_1: [
        { event: 'ISM_MANUFACTURING', dayOfMonth: 1, time: '10:00' },
        { event: 'INITIAL_CLAIMS', dayOfWeek: 4, time: '08:30' } // Every Thursday
    ],
    
    // Second Week of Month
    WEEK_2: [
        { event: 'CPI', dayOfMonth: 12, time: '08:30', variance: 2 }, // 10th-14th typically
        { event: 'PPI', dayOfMonth: 13, time: '08:30', variance: 2 },
        { event: 'RETAIL_SALES', dayOfMonth: 14, time: '08:30', variance: 2 }
    ],
    
    // Third Week of Month
    WEEK_3: [
        { event: 'HOUSING_STARTS', dayOfMonth: 17, time: '08:30', variance: 3 },
        { event: 'ISM_SERVICES', dayOfMonth: 3, time: '10:00' } // 3rd business day
    ],
    
    // Special Events (Specific Dates)
    MONTHLY: [
        { event: 'NFP', schedule: 'FIRST_FRIDAY', time: '08:30' },
        { event: 'JOLTS', dayOfMonth: 8, time: '10:00', variance: 5 } // Wide variance
    ],
    
    // Quarterly Events
    QUARTERLY: [
        { event: 'GDP', months: [1, 4, 7, 10], dayOfMonth: 26, time: '08:30', variance: 5 },
        { event: 'FOMC_RATE_DECISION', schedule: 'FOMC_CALENDAR' } // Special handling
    ],
    
    // Weekly Events
    WEEKLY: [
        { event: 'INITIAL_CLAIMS', dayOfWeek: 4, time: '08:30' } // Every Thursday
    ]
};

/**
 * Tom King's Economic Data Protection Rules
 */
const PROTECTION_RULES = {
    // Pre-event protection (hours before release)
    PRE_EVENT: {
        EXTREME: {
            hours: 4,
            actions: ['HALT_NEW_POSITIONS', 'REDUCE_EXPOSURE', 'HEDGE_PORTFOLIO'],
            maxBPUsage: 'DYNAMIC_HALVED', // 50% of normal VIX-based BP
            maxCorrelation: 1, // Only 1 position per correlation group
            restrictedStrategies: ['0DTE', 'WEEKLY_SHORT', 'IRON_CONDOR']
        },
        VERY_HIGH: {
            hours: 2,
            actions: ['LIMIT_NEW_POSITIONS', 'REDUCE_SIZE', 'INCREASE_HEDGING'],
            maxBPUsage: 'DYNAMIC_REDUCED', // 75% of normal VIX-based BP
            maxCorrelation: 2,
            restrictedStrategies: ['0DTE']
        },
        HIGH: {
            hours: 1,
            actions: ['MONITOR_CLOSELY', 'PREPARE_ADJUSTMENTS'],
            maxBPUsage: 'DYNAMIC_CONSERVATIVE', // 85% of normal VIX-based BP
            maxCorrelation: 2,
            restrictedStrategies: []
        },
        MEDIUM: {
            hours: 0.5,
            actions: ['INCREASED_MONITORING'],
            maxBPUsage: 'DYNAMIC', // Uses RISK_LIMITS.getMaxBPUsage(vix)
            maxCorrelation: 3,
            restrictedStrategies: []
        }
    },
    
    // Post-event protection (hours after release)
    POST_EVENT: {
        EXTREME: {
            hours: 2,
            actions: ['REASSESS_POSITIONS', 'GRADUAL_NORMALIZATION'],
            settlementTime: 1 // Hours to wait before full normalization
        },
        VERY_HIGH: {
            hours: 1,
            actions: ['MONITOR_REACTION', 'ADJUST_IF_NEEDED'],
            settlementTime: 0.5
        },
        HIGH: {
            hours: 0.5,
            actions: ['BRIEF_MONITORING'],
            settlementTime: 0.25
        },
        MEDIUM: {
            hours: 0.25,
            actions: ['NORMAL_MONITORING'],
            settlementTime: 0
        }
    }
};

/**
 * Economic Data Calendar Manager
 */
class EconomicDataCalendar extends EventEmitter {
    constructor(api = null, config = {}) {
        super();
        
        this.api = api;
        
        this.config = {
            enabled: config.enabled !== false,
            autoProtection: config.autoProtection !== false,
            
            // Data sources configuration
            dataSources: config.dataSources || ['ECONOMIC_CALENDAR_API', 'FRED', 'TRADINGECONOMICS'],
            primarySource: config.primarySource || 'ECONOMIC_CALENDAR_API',
            fallbackEnabled: config.fallbackEnabled !== false,
            
            // Monitoring settings
            updateInterval: config.updateInterval || 3600000, // 1 hour
            preEventInterval: config.preEventInterval || 300000, // 5 minutes before events
            postEventInterval: config.postEventInterval || 600000, // 10 minutes after events
            
            // Event filtering
            trackTiers: config.trackTiers || ['TIER_1', 'TIER_2', 'TIER_3'],
            trackInternational: config.trackInternational !== false,
            minImpactLevel: config.minImpactLevel || 'MEDIUM',
            
            // Geographic focus
            regions: config.regions || ['US', 'EU', 'UK', 'JP', 'CN'],
            primaryRegion: config.primaryRegion || 'US',
            
            // Protection settings
            protectionRules: { ...PROTECTION_RULES, ...config.protectionRules },
            aggressiveProtection: config.aggressiveProtection || false,
            
            // Alert settings
            alertHours: config.alertHours || 24, // Alert 24 hours before major events
            urgentAlertHours: config.urgentAlertHours || 4, // Urgent alerts 4 hours before
            
            // Data types
            dataTypes: { ...ECONOMIC_DATA_TYPES, ...config.customEvents }
        };
        
        // State management
        this.economicCalendar = new Map(); // eventId -> event data
        this.upcomingEvents = [];
        this.activeProtections = new Map(); // eventId -> protection state
        this.eventHistory = []; // Historical events for analysis
        
        // Monitoring
        this.monitoringInterval = null;
        this.lastUpdate = null;
        this.currentProtectionLevel = 'NORMAL';
        
        // Statistics
        this.stats = {
            eventsTracked: 0,
            protectionsActivated: 0,
            accuratePredictions: 0,
            falsePositives: 0,
            lastMajorEvent: null
        };
        
        logger.info('ECONOMIC_CALENDAR', 'Economic Data Calendar initialized', {
            dataSources: this.config.dataSources.length,
            trackTiers: this.config.trackTiers.length,
            autoProtection: this.config.autoProtection
        });
    }
    
    /**
     * Initialize the economic data calendar
     */
    async initialize() {
        try {
            logger.info('ECONOMIC_CALENDAR', 'Initializing economic data calendar');
            
            // Load economic calendar for next 30 days
            await this.loadEconomicCalendar();
            
            // Generate upcoming events schedule
            this.generateUpcomingEvents();
            
            // Start monitoring
            this.startMonitoring();
            
            logger.info('ECONOMIC_CALENDAR', 'Economic calendar initialized', {
                totalEvents: this.economicCalendar.size,
                upcomingEvents: this.upcomingEvents.length
            });
            
        } catch (error) {
            logger.error('ECONOMIC_CALENDAR', 'Failed to initialize economic calendar', error);
            throw error;
        }
    }
    
    /**
     * Load economic calendar from data sources
     */
    async loadEconomicCalendar() {
        try {
            let calendarData = [];
            
            // Try primary data source first
            try {
                calendarData = await this.fetchFromPrimarySource();
            } catch (error) {
                logger.warn('ECONOMIC_CALENDAR', 'Primary source failed, trying fallbacks', error.message);
                calendarData = await this.fetchFromFallbackSources();
            }
            
            // If no data from APIs, generate from known schedule
            if (calendarData.length === 0) {
                logger.warn('ECONOMIC_CALENDAR', 'No API data available, generating from schedule');
                calendarData = this.generateFromSchedule();
            }
            
            // Process and store calendar data
            this.processCalendarData(calendarData);
            
            this.lastUpdate = new Date();
            
        } catch (error) {
            logger.error('ECONOMIC_CALENDAR', 'Failed to load economic calendar', error);
            throw error;
        }
    }
    
    /**
     * Fetch from primary data source
     */
    async fetchFromPrimarySource() {
        const source = this.config.primarySource;
        
        switch (source) {
            case 'ECONOMIC_CALENDAR_API':
                return await this.fetchFromEconomicCalendarAPI();
                
            case 'FRED':
                return await this.fetchFromFRED();
                
            case 'TRADINGECONOMICS':
                return await this.fetchFromTradingEconomics();
                
            default:
                throw new Error(`Unknown primary source: ${source}`);
        }
    }
    
    /**
     * Fetch from Economic Calendar API
     */
    async fetchFromEconomicCalendarAPI() {
        try {
            // Example API call - would use real economic calendar API
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
            
            const url = `https://api.economicalendar.com/events?start=${new Date().toISOString()}&end=${endDate.toISOString()}`;
            
            // CRITICAL: No mock data allowed for production trading
            throw new Error('Economic calendar API unavailable - cannot use mock data for live trading');
            
        } catch (error) {
            logger.error('ECONOMIC_CALENDAR', 'Economic Calendar API failed', error);
            throw error;
        }
    }
    
    /**
     * DEPRECATED - Use real API data only
     * @deprecated This method should not be used in production
     */
    generateMockAPIResponse_DEPRECATED() {
        const events = [];
        const startDate = new Date();
        
        // Generate next 30 days of economic events
        for (let i = 0; i < 30; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            
            // Add some realistic events
            if (date.getDay() === 4) { // Thursday
                events.push({
                    id: `INITIAL_CLAIMS_${date.toISOString().split('T')[0]}`,
                    event: 'INITIAL_CLAIMS',
                    name: 'Initial Jobless Claims',
                    date: date.toISOString(),
                    time: '08:30',
                    impact: 'MEDIUM',
                    country: 'US',
                    actual: null,
                    forecast: '220K',
                    previous: '215K'
                });
            }
            
            // First Friday of month
            if (this.isFirstFriday(date)) {
                events.push({
                    id: `NFP_${date.toISOString().split('T')[0]}`,
                    event: 'NFP',
                    name: 'Non-Farm Payrolls',
                    date: date.toISOString(),
                    time: '08:30',
                    impact: 'VERY_HIGH',
                    country: 'US',
                    actual: null,
                    forecast: '180K',
                    previous: '175K'
                });
            }
            
            // CPI around 12th of month
            if (date.getDate() >= 10 && date.getDate() <= 14 && date.getDate() === 12) { // CPI typically on 12th
                events.push({
                    id: `CPI_${date.toISOString().split('T')[0]}`,
                    event: 'CPI',
                    name: 'Consumer Price Index',
                    date: date.toISOString(),
                    time: '08:30',
                    impact: 'VERY_HIGH',
                    country: 'US',
                    actual: null,
                    forecast: '3.2%',
                    previous: '3.0%'
                });
            }
        }
        
        return events;
    }
    
    /**
     * Fetch from fallback sources
     */
    async fetchFromFallbackSources() {
        for (const source of this.config.dataSources) {
            if (source === this.config.primarySource) continue;
            
            try {
                switch (source) {
                    case 'FRED':
                        return await this.fetchFromFRED();
                    case 'TRADINGECONOMICS':
                        return await this.fetchFromTradingEconomics();
                }
            } catch (error) {
                logger.warn('ECONOMIC_CALENDAR', `Fallback source ${source} failed:`, error.message);
                continue;
            }
        }
        
        return [];
    }
    
    /**
     * Fetch from FRED (Federal Reserve Economic Data)
     */
    async fetchFromFRED() {
        // FRED doesn't provide a calendar API, but has release dates for series
        // This would require FRED API key and complex series mapping
        logger.debug('ECONOMIC_CALENDAR', 'FRED API integration not fully implemented');
        return [];
    }
    
    /**
     * Fetch from Trading Economics
     */
    async fetchFromTradingEconomics() {
        // Trading Economics has a calendar API
        // This would require API subscription
        logger.debug('ECONOMIC_CALENDAR', 'Trading Economics API integration not fully implemented');
        return [];
    }
    
    /**
     * Generate calendar from known schedule patterns
     */
    generateFromSchedule() {
        const events = [];
        const today = new Date();
        
        // Generate events for next 60 days based on known patterns
        for (let i = 0; i < 60; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            
            // Generate events based on schedule patterns
            const dayEvents = this.generateEventsForDate(date);
            events.push(...dayEvents);
        }
        
        return events;
    }
    
    /**
     * Generate events for specific date based on patterns
     */
    generateEventsForDate(date) {
        const events = [];
        const dayOfMonth = date.getDate();
        const dayOfWeek = date.getDay();
        const month = date.getMonth();
        
        // Weekly events
        if (dayOfWeek === 4) { // Thursday
            events.push(this.createEvent('INITIAL_CLAIMS', date, '08:30'));
        }
        
        // First Friday NFP
        if (this.isFirstFriday(date)) {
            events.push(this.createEvent('NFP', date, '08:30'));
        }
        
        // CPI typically around 12th
        if (dayOfMonth >= 11 && dayOfMonth <= 15) {
            if (dayOfMonth === 12) { // CPI typically on 12th
                events.push(this.createEvent('CPI', date, '08:30'));
            }
        }
        
        // PPI typically day after CPI
        if (dayOfMonth >= 12 && dayOfMonth <= 16) {
            if (dayOfMonth === 13) { // PPI typically day after CPI
                events.push(this.createEvent('PPI', date, '08:30'));
            }
        }
        
        // ISM Manufacturing on 1st business day
        if (this.isFirstBusinessDay(date, month)) {
            events.push(this.createEvent('ISM_MANUFACTURING', date, '10:00'));
        }
        
        // Quarterly GDP
        if ([0, 3, 6, 9].includes(month) && dayOfMonth >= 25 && dayOfMonth <= 30) {
            if (dayOfMonth === 28) { // GDP typically on 28th
                events.push(this.createEvent('GDP', date, '08:30'));
            }
        }
        
        return events;
    }
    
    /**
     * Create event object
     */
    createEvent(eventType, date, time) {
        // Find event config
        let eventConfig = null;
        for (const tier of Object.values(this.config.dataTypes)) {
            if (tier[eventType]) {
                eventConfig = tier[eventType];
                break;
            }
        }
        
        if (!eventConfig) {
            eventConfig = {
                name: eventType,
                impact: 'MEDIUM',
                volatilityMultiplier: 1.5,
                sectors: ['ALL'],
                protectionHours: 1
            };
        }
        
        return {
            id: `${eventType}_${date.toISOString().split('T')[0]}`,
            event: eventType,
            name: eventConfig.name,
            date: date.toISOString(),
            time: time,
            impact: eventConfig.impact,
            country: 'US',
            volatilityMultiplier: eventConfig.volatilityMultiplier,
            sectors: eventConfig.sectors,
            protectionHours: eventConfig.protectionHours,
            generated: true
        };
    }
    
    /**
     * Process calendar data and store events
     */
    processCalendarData(rawData) {
        this.economicCalendar.clear();
        
        for (const event of rawData) {
            // Enhance event with configuration data
            const enhancedEvent = this.enhanceEvent(event);
            
            // Filter by impact level
            if (this.shouldTrackEvent(enhancedEvent)) {
                this.economicCalendar.set(event.id, enhancedEvent);
            }
        }
        
        logger.info('ECONOMIC_CALENDAR', `Processed ${this.economicCalendar.size} economic events`);
    }
    
    /**
     * Enhance event with configuration data
     */
    enhanceEvent(event) {
        // Find matching configuration
        let config = null;
        for (const [tierName, tier] of Object.entries(this.config.dataTypes)) {
            if (tier[event.event]) {
                config = { ...tier[event.event], tier: tierName };
                break;
            }
        }
        
        // Default config for unknown events
        if (!config) {
            config = {
                name: event.name || event.event,
                impact: 'MEDIUM',
                volatilityMultiplier: 1.2,
                sectors: ['ALL'],
                protectionHours: 0.5,
                tier: 'UNKNOWN'
            };
        }
        
        return {
            ...event,
            config: config,
            eventDateTime: new Date(`${event.date.split('T')[0]}T${event.time}:00`),
            processed: true
        };
    }
    
    /**
     * Check if event should be tracked
     */
    shouldTrackEvent(event) {
        // Check tier filtering
        if (!this.config.trackTiers.includes(event.config.tier)) {
            return false;
        }
        
        // Check impact level
        const impactLevels = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'EXTREME'];
        const eventImpactIndex = impactLevels.indexOf(event.impact);
        const minImpactIndex = impactLevels.indexOf(this.config.minImpactLevel);
        
        if (eventImpactIndex < minImpactIndex) {
            return false;
        }
        
        // Check geographic filtering
        if (!this.config.regions.includes(event.country)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Generate upcoming events list
     */
    generateUpcomingEvents() {
        const now = new Date();
        const upcomingCutoff = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // Next 7 days
        
        this.upcomingEvents = Array.from(this.economicCalendar.values())
            .filter(event => event.eventDateTime > now && event.eventDateTime <= upcomingCutoff)
            .sort((a, b) => a.eventDateTime - b.eventDateTime);
        
        logger.debug('ECONOMIC_CALENDAR', `Found ${this.upcomingEvents.length} upcoming events`);
    }
    
    /**
     * Start monitoring economic events
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            logger.warn('ECONOMIC_CALENDAR', 'Monitoring already active');
            return;
        }
        
        logger.info('ECONOMIC_CALENDAR', 'Starting economic data monitoring');
        
        // Initial check
        this.checkEconomicEvents();
        
        // Set up regular monitoring
        this.monitoringInterval = setInterval(() => {
            this.checkEconomicEvents();
        }, this.config.updateInterval);
        
        this.emit('monitoring_started');
    }
    
    /**
     * Check for upcoming economic events and activate protections
     */
    async checkEconomicEvents() {
        try {
            const now = new Date();
            const upcomingEvents = this.getUpcomingEvents(24); // Next 24 hours
            const immediatEvents = this.getUpcomingEvents(4); // Next 4 hours
            
            // Check for protection activation/deactivation
            for (const event of upcomingEvents) {
                const hoursUntil = (event.eventDateTime - now) / (1000 * 60 * 60);
                const hoursAfter = (now - event.eventDateTime) / (1000 * 60 * 60);
                
                // Pre-event protection
                if (hoursUntil > 0 && hoursUntil <= event.config.protectionHours) {
                    await this.activatePreEventProtection(event);
                }
                
                // Post-event monitoring
                else if (hoursAfter >= 0 && hoursAfter <= this.getPostEventHours(event)) {
                    await this.activatePostEventMonitoring(event);
                }
                
                // Deactivate expired protections
                else if (hoursAfter > this.getPostEventHours(event)) {
                    await this.deactivateProtection(event);
                }
            }
            
            // Generate alerts for upcoming major events
            const majorEvents = immediatEvents.filter(e => 
                ['VERY_HIGH', 'EXTREME'].includes(e.impact)
            );
            
            if (majorEvents.length > 0) {
                this.generateEventAlerts(majorEvents);
            }
            
            // Update protection level
            this.updateOverallProtectionLevel();
            
        } catch (error) {
            logger.error('ECONOMIC_CALENDAR', 'Error checking economic events', error);
        }
    }
    
    /**
     * Activate pre-event protection
     */
    async activatePreEventProtection(event) {
        const protectionKey = `pre_${event.id}`;
        
        if (this.activeProtections.has(protectionKey)) {
            return; // Already active
        }
        
        const protectionRules = this.config.protectionRules.PRE_EVENT[event.impact];
        if (!protectionRules) return;
        
        const protection = {
            id: protectionKey,
            event: event,
            type: 'PRE_EVENT',
            rules: protectionRules,
            startTime: new Date(),
            status: 'ACTIVE'
        };
        
        this.activeProtections.set(protectionKey, protection);
        
        logger.warn('ECONOMIC_CALENDAR', 'Pre-event protection activated', {
            event: event.name,
            impact: event.impact,
            time: event.eventDateTime.toISOString(),
            actions: protectionRules.actions
        });
        
        // Apply protection measures if auto-protection is enabled
        if (this.config.autoProtection) {
            await this.applyProtectionMeasures(protection);
        }
        
        this.emit('protection_activated', protection);
        this.stats.protectionsActivated++;
    }
    
    /**
     * Activate post-event monitoring
     */
    async activatePostEventMonitoring(event) {
        const protectionKey = `post_${event.id}`;
        
        if (this.activeProtections.has(protectionKey)) {
            return; // Already active
        }
        
        const protectionRules = this.config.protectionRules.POST_EVENT[event.impact];
        if (!protectionRules) return;
        
        const protection = {
            id: protectionKey,
            event: event,
            type: 'POST_EVENT',
            rules: protectionRules,
            startTime: new Date(),
            status: 'ACTIVE'
        };
        
        this.activeProtections.set(protectionKey, protection);
        
        logger.info('ECONOMIC_CALENDAR', 'Post-event monitoring activated', {
            event: event.name,
            settlementTime: protectionRules.settlementTime
        });
        
        this.emit('post_event_monitoring', protection);
    }
    
    /**
     * Apply protection measures through risk manager
     */
    async applyProtectionMeasures(protection) {
        try {
            const rules = protection.rules;
            
            // This would integrate with risk manager to apply restrictions
            const measures = {
                maxBPUsage: rules.maxBPUsage,
                maxCorrelation: rules.maxCorrelation,
                restrictedStrategies: rules.restrictedStrategies || [],
                actions: rules.actions,
                reason: 'ECONOMIC_EVENT_PROTECTION'
            };
            
            logger.info('ECONOMIC_CALENDAR', 'Applying protection measures', {
                event: protection.event.name,
                maxBP: measures.maxBPUsage,
                restrictions: measures.restrictedStrategies.length
            });
            
            // Emit for external risk manager integration
            this.emit('apply_protection_measures', measures);
            
        } catch (error) {
            logger.error('ECONOMIC_CALENDAR', 'Failed to apply protection measures', error);
        }
    }
    
    /**
     * Generate alerts for upcoming events
     */
    generateEventAlerts(events) {
        for (const event of events) {
            const hoursUntil = (event.eventDateTime - new Date()) / (1000 * 60 * 60);
            
            const alert = {
                type: 'ECONOMIC_EVENT_ALERT',
                event: event,
                hoursUntil: hoursUntil,
                impact: event.impact,
                sectors: event.config.sectors,
                recommendations: this.getEventRecommendations(event),
                timestamp: new Date()
            };
            
            logger.warn('ECONOMIC_CALENDAR', `Upcoming ${event.impact} impact event`, {
                name: event.name,
                time: event.eventDateTime.toISOString(),
                hoursUntil: hoursUntil.toFixed(1)
            });
            
            this.emit('economic_event_alert', alert);
        }
    }
    
    /**
     * Get recommendations for specific event
     */
    getEventRecommendations(event) {
        const recommendations = [];
        const impact = event.impact;
        const sectors = event.config.sectors;
        
        // Impact-based recommendations
        if (impact === 'EXTREME') {
            recommendations.push('HALT_ALL_NEW_POSITIONS');
            recommendations.push('REDUCE_OVERALL_EXPOSURE');
            recommendations.push('HEDGE_PORTFOLIO');
        } else if (impact === 'VERY_HIGH') {
            recommendations.push('AVOID_NEW_0DTE');
            recommendations.push('REDUCE_POSITION_SIZES');
            recommendations.push('INCREASE_CASH_RESERVES');
        } else if (impact === 'HIGH') {
            recommendations.push('MONITOR_CLOSELY');
            recommendations.push('PREPARE_QUICK_ADJUSTMENTS');
        }
        
        // Sector-specific recommendations
        if (sectors.includes('ALL')) {
            recommendations.push('BROAD_MARKET_CAUTION');
        } else {
            recommendations.push(`AVOID_${sectors[0]}_EXPOSURE`);
        }
        
        // Event-specific recommendations
        if (event.event === 'FOMC_RATE_DECISION') {
            recommendations.push('VOLATILITY_SPIKE_EXPECTED');
            recommendations.push('RATE_SENSITIVE_SECTOR_RISK');
        } else if (event.event === 'NFP') {
            recommendations.push('DOLLAR_VOLATILITY');
            recommendations.push('EMPLOYMENT_SECTOR_FOCUS');
        } else if (event.event === 'CPI') {
            recommendations.push('INFLATION_TRADES_RISK');
            recommendations.push('BOND_MARKET_VOLATILITY');
        }
        
        return recommendations;
    }
    
    // Utility methods
    
    getUpcomingEvents(hours = 24) {
        const now = new Date();
        const cutoff = new Date(now.getTime() + (hours * 60 * 60 * 1000));
        
        return Array.from(this.economicCalendar.values())
            .filter(event => event.eventDateTime > now && event.eventDateTime <= cutoff)
            .sort((a, b) => a.eventDateTime - b.eventDateTime);
    }
    
    getPostEventHours(event) {
        const rules = this.config.protectionRules.POST_EVENT[event.impact];
        return rules ? rules.hours : 0.5;
    }
    
    updateOverallProtectionLevel() {
        const activeCount = this.activeProtections.size;
        const majorEvents = this.getUpcomingEvents(4).filter(e => 
            ['EXTREME', 'VERY_HIGH'].includes(e.impact)
        ).length;
        
        let newLevel = 'NORMAL';
        
        if (majorEvents > 0) {
            newLevel = 'HIGH';
        } else if (activeCount > 2) {
            newLevel = 'MEDIUM';
        } else if (activeCount > 0) {
            newLevel = 'LOW';
        }
        
        if (newLevel !== this.currentProtectionLevel) {
            const oldLevel = this.currentProtectionLevel;
            this.currentProtectionLevel = newLevel;
            
            logger.info('ECONOMIC_CALENDAR', `Protection level changed: ${oldLevel} → ${newLevel}`, {
                activeProtections: activeCount,
                upcomingMajorEvents: majorEvents
            });
            
            this.emit('protection_level_change', {
                old: oldLevel,
                new: newLevel,
                activeProtections: activeCount,
                upcomingMajorEvents: majorEvents
            });
        }
    }
    
    deactivateProtection(event) {
        const preKey = `pre_${event.id}`;
        const postKey = `post_${event.id}`;
        
        let deactivated = false;
        
        if (this.activeProtections.has(preKey)) {
            this.activeProtections.delete(preKey);
            deactivated = true;
        }
        
        if (this.activeProtections.has(postKey)) {
            this.activeProtections.delete(postKey);
            deactivated = true;
        }
        
        if (deactivated) {
            logger.info('ECONOMIC_CALENDAR', `Protection deactivated for ${event.name}`);
            this.emit('protection_deactivated', event);
        }
    }
    
    isFirstFriday(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const firstFriday = new Date(firstDay);
        firstFriday.setDate(1 + (5 - firstDay.getDay() + 7) % 7);
        
        return date.getDate() === firstFriday.getDate() && date.getDay() === 5;
    }
    
    isFirstBusinessDay(date, month) {
        const year = date.getFullYear();
        let firstBusinessDay = new Date(year, month, 1);
        
        while (firstBusinessDay.getDay() === 0 || firstBusinessDay.getDay() === 6) {
            firstBusinessDay.setDate(firstBusinessDay.getDate() + 1);
        }
        
        return date.getDate() === firstBusinessDay.getDate();
    }
    
    // Public interface methods
    
    getStatus() {
        return {
            enabled: this.config.enabled,
            monitoring: this.monitoringInterval !== null,
            totalEvents: this.economicCalendar.size,
            upcomingEvents: this.upcomingEvents.length,
            activeProtections: this.activeProtections.size,
            protectionLevel: this.currentProtectionLevel,
            lastUpdate: this.lastUpdate,
            statistics: this.stats
        };
    }
    
    getUpcomingEventsDetails(hours = 168) { // Default 1 week
        return this.getUpcomingEvents(hours);
    }
    
    getActiveProtections() {
        return Array.from(this.activeProtections.values());
    }
    
    getEventByName(eventName, days = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + days);
        
        return Array.from(this.economicCalendar.values())
            .filter(event => event.event === eventName && event.eventDateTime <= cutoff)
            .sort((a, b) => a.eventDateTime - b.eventDateTime);
    }
    
    forceProtection(eventName, level = 'HIGH', hours = 2) {
        const protectionKey = `manual_${eventName}_${Date.now()}`;
        const rules = this.config.protectionRules.PRE_EVENT[level];
        
        if (!rules) {
            logger.error('ECONOMIC_CALENDAR', `Invalid protection level: ${level}`);
            return;
        }
        
        const protection = {
            id: protectionKey,
            event: { name: eventName, impact: level },
            type: 'MANUAL',
            rules: rules,
            startTime: new Date(),
            endTime: new Date(Date.now() + hours * 60 * 60 * 1000),
            status: 'ACTIVE'
        };
        
        this.activeProtections.set(protectionKey, protection);
        
        logger.warn('ECONOMIC_CALENDAR', `Manual protection activated for ${eventName}`, {
            level: level,
            duration: hours
        });
        
        this.emit('manual_protection_activated', protection);
    }
    
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('ECONOMIC_CALENDAR', 'Monitoring stopped');
        }
    }
}

// Export
module.exports = {
    EconomicDataCalendar,
    ECONOMIC_DATA_TYPES,
    PROTECTION_RULES
};