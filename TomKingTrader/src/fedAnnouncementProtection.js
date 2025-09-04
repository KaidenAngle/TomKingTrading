/**
 * Fed Announcement Protection System
 * Protects trading positions during FOMC meetings and Fed announcements
 * Implements automatic position reduction and entry restrictions
 */

const { EventEmitter } = require('events');
const { RISK_LIMITS } = require('./config');
const { getLogger } = require('./logger');
const logger = getLogger();

class FedAnnouncementProtection extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Protection windows (hours before/after announcement)
            preAnnouncementWindow: config.preAnnouncementWindow || 24, // 24 hours before
            postAnnouncementWindow: config.postAnnouncementWindow || 2, // 2 hours after
            
            // Position management
            reducePositionsPercent: config.reducePositionsPercent || 0.50, // Reduce by 50%
            maxNewPositions: config.maxNewPositions || 0, // No new positions during Fed
            closeHighRiskPositions: config.closeHighRiskPositions !== false,
            
            // Strategy restrictions
            restrict0DTE: config.restrict0DTE !== false, // No 0DTE during Fed
            restrictStrangles: config.restrictStrangles !== false,
            allowDefensiveOnly: config.allowDefensiveOnly !== false,
            
            // VIX thresholds during Fed
            maxVIXForEntry: config.maxVIXForEntry || 30,
            targetBPUsage: config.targetBPUsage || 'DYNAMIC_EXTREME', // ~30% of VIX-based BP during Fed
            
            ...config
        };
        
        // 2024-2025 FOMC Schedule
        this.fedSchedule = [
            // 2024 Remaining
            { date: '2024-11-07', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2024-12-18', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            
            // 2025 Schedule
            { date: '2025-01-29', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-03-19', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-05-07', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-06-18', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-07-30', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-09-17', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-11-05', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            { date: '2025-12-17', time: '14:00', type: 'FOMC', importance: 'HIGH' },
            
            // Jackson Hole Symposium (typically late August)
            { date: '2025-08-22', time: '10:00', type: 'JACKSON_HOLE', importance: 'HIGH' },
            
            // Other important Fed events (updated dynamically)
            { date: '2025-02-05', time: '10:00', type: 'TESTIMONY', importance: 'MEDIUM' },
            { date: '2025-07-15', time: '10:00', type: 'TESTIMONY', importance: 'MEDIUM' }
        ];
        
        this.protectionActive = false;
        this.nextAnnouncement = null;
        this.checkInterval = null;
        this.restrictedStrategies = new Set();
        this.positionReductions = new Map();
    }
    
    /**
     * Start monitoring for Fed announcements
     */
    startMonitoring() {
        logger.info('FedProtection', 'Starting Fed announcement monitoring');
        
        // Initial check
        this.checkForUpcomingAnnouncements();
        
        // Set up hourly checks
        this.checkInterval = setInterval(() => {
            this.checkForUpcomingAnnouncements();
        }, 3600000); // Check every hour
        
        this.emit('monitoringStarted');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.emit('monitoringStopped');
    }
    
    /**
     * Check for upcoming Fed announcements
     */
    checkForUpcomingAnnouncements() {
        const now = new Date();
        const upcomingAnnouncements = [];
        
        for (const announcement of this.fedSchedule) {
            const announcementDate = new Date(`${announcement.date}T${announcement.time}:00`);
            const hoursUntil = (announcementDate - now) / (1000 * 60 * 60);
            
            // Check if within pre-announcement window
            if (hoursUntil > 0 && hoursUntil <= this.config.preAnnouncementWindow) {
                upcomingAnnouncements.push({
                    ...announcement,
                    hoursUntil,
                    announcementDate
                });
            }
            
            // Check if in post-announcement window
            if (hoursUntil < 0 && Math.abs(hoursUntil) <= this.config.postAnnouncementWindow) {
                upcomingAnnouncements.push({
                    ...announcement,
                    hoursUntil,
                    announcementDate,
                    inPostWindow: true
                });
            }
        }
        
        if (upcomingAnnouncements.length > 0) {
            this.activateProtection(upcomingAnnouncements[0]);
        } else if (this.protectionActive) {
            this.deactivateProtection();
        }
        
        return upcomingAnnouncements;
    }
    
    /**
     * Activate Fed protection protocols
     */
    activateProtection(announcement) {
        if (this.protectionActive && this.nextAnnouncement?.date === announcement.date) {
            return; // Already active for this announcement
        }
        
        this.protectionActive = true;
        this.nextAnnouncement = announcement;
        
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        logger.info('SYSTEM', '🏛️ FED ANNOUNCEMENT PROTECTION ACTIVATED');
        logger.info('SYSTEM', '='.repeat(60));
        logger.info('SYSTEM', `Event: ${announcement.type}`);
        logger.info('SYSTEM', `Date: ${announcement.date} at ${announcement.time}`);
        logger.info('SYSTEM', `Hours until: ${announcement.hoursUntil.toFixed(1)}`);
        logger.info('SYSTEM', `Importance: ${announcement.importance}`);
        
        // Apply trading restrictions
        this.applyTradingRestrictions();
        
        // Reduce existing positions
        this.reducePositions();
        
        // Emit protection event
        this.emit('protectionActivated', {
            announcement,
            restrictions: this.getActiveRestrictions()
        });
        
        logger.info('SYSTEM', '\nRestrictions Applied:');
        logger.info('SYSTEM', `• Position reduction: ${(this.config.reducePositionsPercent * 100).toFixed(0)}%`);
        logger.info('SYSTEM', `• Max new positions: ${this.config.maxNewPositions}`);
        logger.info('SYSTEM', `• Target BP usage: ${(this.config.targetBPUsage * 100).toFixed(0)}%`);
        logger.info('SYSTEM', `• 0DTE restricted: ${this.config.restrict0DTE}`);
        logger.info('SYSTEM', `• Strangles restricted: ${this.config.restrictStrangles}`);
        logger.info('SYSTEM', '='.repeat(60) + '\n');
    }
    
    /**
     * Apply trading restrictions during Fed events
     */
    applyTradingRestrictions() {
        this.restrictedStrategies.clear();
        
        if (this.config.restrict0DTE) {
            this.restrictedStrategies.add('0DTE');
        }
        
        if (this.config.restrictStrangles) {
            this.restrictedStrategies.add('STRANGLE');
            this.restrictedStrategies.add('IRON_CONDOR');
        }
        
        // High-risk strategies to restrict
        this.restrictedStrategies.add('RATIO_SPREAD');
        this.restrictedStrategies.add('NAKED_PUT');
        this.restrictedStrategies.add('NAKED_CALL');
        
        logger.info('FedProtection', `Restricted strategies: ${Array.from(this.restrictedStrategies).join(', ')}`);
    }
    
    /**
     * Reduce existing positions
     */
    reducePositions() {
        logger.info('FedProtection', `Reducing positions by ${(this.config.reducePositionsPercent * 100).toFixed(0)}%`);
        
        // This would interface with position manager
        this.emit('reducePositions', {
            reductionPercent: this.config.reducePositionsPercent,
            reason: 'Fed announcement protection',
            priority: ['0DTE', 'HIGH_DELTA', 'STRANGLES']
        });
    }
    
    /**
     * Deactivate protection after Fed event
     */
    deactivateProtection() {
        if (!this.protectionActive) return;
        
        logger.info('SYSTEM', '\n✅ Fed announcement protection deactivated');
        logger.info('SYSTEM', `Event ${this.nextAnnouncement.type} has passed\n`);
        
        this.protectionActive = false;
        this.nextAnnouncement = null;
        this.restrictedStrategies.clear();
        
        this.emit('protectionDeactivated');
    }
    
    /**
     * Check if a trade is allowed during Fed protection
     */
    isTradeAllowed(trade) {
        if (!this.protectionActive) {
            return { allowed: true };
        }
        
        const reasons = [];
        
        // Check strategy restrictions
        if (this.restrictedStrategies.has(trade.strategy)) {
            reasons.push(`Strategy ${trade.strategy} restricted during Fed announcement`);
        }
        
        // Check if it's a new position
        if (trade.action === 'OPEN' && this.config.maxNewPositions === 0) {
            reasons.push('No new positions allowed during Fed announcement');
        }
        
        // Check VIX level for new entries
        if (trade.action === 'OPEN' && trade.vix > this.config.maxVIXForEntry) {
            reasons.push(`VIX ${trade.vix} exceeds Fed limit of ${this.config.maxVIXForEntry}`);
        }
        
        // Allow defensive trades
        if (this.config.allowDefensiveOnly) {
            const defensiveActions = ['CLOSE', 'ROLL', 'HEDGE', 'REDUCE'];
            if (!defensiveActions.includes(trade.action)) {
                reasons.push('Only defensive trades allowed during Fed announcement');
            }
        }
        
        return {
            allowed: reasons.length === 0,
            reasons,
            announcement: this.nextAnnouncement
        };
    }
    
    /**
     * Get recommended position sizing during Fed
     */
    getPositionSizing(normalSize) {
        if (!this.protectionActive) {
            return normalSize;
        }
        
        // Reduce position sizes during Fed events
        const reductionFactor = this.nextAnnouncement?.importance === 'HIGH' ? 0.5 : 0.75;
        
        return {
            recommendedSize: Math.floor(normalSize * reductionFactor),
            normalSize,
            reductionFactor,
            reason: `Fed ${this.nextAnnouncement?.type} protection active`
        };
    }
    
    /**
     * Get current protection status
     */
    getStatus() {
        const upcoming = this.checkForUpcomingAnnouncements();
        
        return {
            protectionActive: this.protectionActive,
            currentAnnouncement: this.nextAnnouncement,
            upcomingAnnouncements: upcoming,
            restrictedStrategies: Array.from(this.restrictedStrategies),
            config: this.config,
            nextCheck: new Date(Date.now() + 3600000) // Next hourly check
        };
    }
    
    /**
     * Get active restrictions
     */
    getActiveRestrictions() {
        if (!this.protectionActive) {
            return {
                active: false,
                restrictions: []
            };
        }
        
        return {
            active: true,
            announcement: this.nextAnnouncement,
            restrictions: [
                `Max new positions: ${this.config.maxNewPositions}`,
                `Position reduction: ${(this.config.reducePositionsPercent * 100)}%`,
                `Target BP: ${(this.config.targetBPUsage * 100)}%`,
                `Restricted strategies: ${Array.from(this.restrictedStrategies).join(', ')}`
            ],
            allowedActions: this.config.allowDefensiveOnly ? 
                ['CLOSE', 'ROLL', 'HEDGE', 'REDUCE'] : 
                ['ALL']
        };
    }
    
    /**
     * Add custom Fed event
     */
    addFedEvent(date, time, type, importance = 'MEDIUM') {
        this.fedSchedule.push({
            date,
            time,
            type,
            importance
        });
        
        // Re-check for announcements
        this.checkForUpcomingAnnouncements();
        
        logger.info('FedProtection', `Added Fed event: ${type} on ${date}`);
    }
    
    /**
     * Get Fed calendar for next N days
     */
    getFedCalendar(days = 30) {
        const now = new Date();
        const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        
        return this.fedSchedule.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= now && eventDate <= futureDate;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    /**
     * Emergency override - force protection on/off
     */
    forceProtection(active, reason) {
        if (active) {
            this.activateProtection({
                date: new Date().toISOString().split('T')[0],
                time: new Date().toTimeString().split(' ')[0].slice(0, 5),
                type: 'EMERGENCY',
                importance: 'HIGH',
                reason
            });
        } else {
            this.deactivateProtection();
        }
        
        logger.warn('FedProtection', `Protection force ${active ? 'activated' : 'deactivated'}: ${reason}`);
    }
}

module.exports = { FedAnnouncementProtection };