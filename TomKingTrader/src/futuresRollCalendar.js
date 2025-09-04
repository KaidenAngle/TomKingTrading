/**
 * Futures Roll Calendar Tracking Module
 * Real-time tracking of futures contract roll dates and volume migration
 * Critical for Tom King's futures strategies (ES, NQ, CL, GC, etc.)
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

const logger = getLogger();

/**
 * Futures Contract Specifications and Roll Patterns
 */
const FUTURES_CONTRACTS = {
    // Equity Index Futures
    'ES': {
        name: 'E-mini S&P 500',
        exchange: 'CME',
        sector: 'EQUITY_INDEX',
        tickSize: 0.25,
        tickValue: 12.50,
        rollPattern: 'QUARTERLY', // Mar, Jun, Sep, Dec
        rollMonths: [3, 6, 9, 12],
        rollDay: 'THIRD_FRIDAY', // Third Friday of roll month
        rollTime: '09:30', // ET
        volumeMigration: {
            startDays: 8,  // Volume migration starts 8 days before roll
            peakDays: 3,   // Peak migration 3 days before
            completeDays: 1 // Migration complete 1 day before
        },
        tradingHours: {
            regular: { start: '09:30', end: '16:15' },
            extended: { start: '17:00', end: '16:15' }
        }
    },
    
    'MES': {
        name: 'Micro E-mini S&P 500',
        exchange: 'CME',
        sector: 'EQUITY_INDEX',
        tickSize: 0.25,
        tickValue: 1.25,
        rollPattern: 'QUARTERLY',
        rollMonths: [3, 6, 9, 12],
        rollDay: 'THIRD_FRIDAY',
        rollTime: '09:30',
        volumeMigration: {
            startDays: 5,
            peakDays: 2,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '09:30', end: '16:15' },
            extended: { start: '17:00', end: '16:15' }
        }
    },
    
    'NQ': {
        name: 'E-mini NASDAQ 100',
        exchange: 'CME',
        sector: 'EQUITY_INDEX',
        tickSize: 0.25,
        tickValue: 5.00,
        rollPattern: 'QUARTERLY',
        rollMonths: [3, 6, 9, 12],
        rollDay: 'THIRD_FRIDAY',
        rollTime: '09:30',
        volumeMigration: {
            startDays: 8,
            peakDays: 3,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '09:30', end: '16:15' },
            extended: { start: '17:00', end: '16:15' }
        }
    },
    
    'MNQ': {
        name: 'Micro E-mini NASDAQ 100',
        exchange: 'CME',
        sector: 'EQUITY_INDEX',
        tickSize: 0.25,
        tickValue: 0.50,
        rollPattern: 'QUARTERLY',
        rollMonths: [3, 6, 9, 12],
        rollDay: 'THIRD_FRIDAY',
        rollTime: '09:30',
        volumeMigration: {
            startDays: 5,
            peakDays: 2,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '09:30', end: '16:15' },
            extended: { start: '17:00', end: '16:15' }
        }
    },
    
    // Energy Futures
    'CL': {
        name: 'Crude Oil WTI',
        exchange: 'NYMEX',
        sector: 'ENERGY',
        tickSize: 0.01,
        tickValue: 10.00,
        rollPattern: 'MONTHLY',
        rollMonths: 'ALL',
        rollDay: 'BUSINESS_DAY_25', // 25th calendar day or preceding business day
        rollTime: '14:30', // ET
        volumeMigration: {
            startDays: 10,
            peakDays: 5,
            completeDays: 2
        },
        tradingHours: {
            regular: { start: '09:00', end: '14:30' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    'MCL': {
        name: 'Micro Crude Oil WTI',
        exchange: 'NYMEX',
        sector: 'ENERGY',
        tickSize: 0.01,
        tickValue: 1.00,
        rollPattern: 'MONTHLY',
        rollMonths: 'ALL',
        rollDay: 'BUSINESS_DAY_25',
        rollTime: '14:30',
        volumeMigration: {
            startDays: 7,
            peakDays: 3,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '09:00', end: '14:30' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    'NG': {
        name: 'Natural Gas',
        exchange: 'NYMEX',
        sector: 'ENERGY',
        tickSize: 0.001,
        tickValue: 10.00,
        rollPattern: 'MONTHLY',
        rollMonths: 'ALL',
        rollDay: 'BUSINESS_DAY_BEFORE_25', // Business day before 25th
        rollTime: '14:30',
        volumeMigration: {
            startDays: 8,
            peakDays: 4,
            completeDays: 2
        },
        tradingHours: {
            regular: { start: '09:00', end: '14:30' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    // Metals Futures
    'GC': {
        name: 'Gold',
        exchange: 'COMEX',
        sector: 'METALS',
        tickSize: 0.10,
        tickValue: 10.00,
        rollPattern: 'BIMONTHLY', // Feb, Apr, Jun, Aug, Oct, Dec
        rollMonths: [2, 4, 6, 8, 10, 12],
        rollDay: 'THIRD_LAST_BUSINESS', // Third last business day
        rollTime: '13:30',
        volumeMigration: {
            startDays: 10,
            peakDays: 5,
            completeDays: 2
        },
        tradingHours: {
            regular: { start: '08:20', end: '13:30' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    'MGC': {
        name: 'Micro Gold',
        exchange: 'COMEX',
        sector: 'METALS',
        tickSize: 0.10,
        tickValue: 1.00,
        rollPattern: 'BIMONTHLY',
        rollMonths: [2, 4, 6, 8, 10, 12],
        rollDay: 'THIRD_LAST_BUSINESS',
        rollTime: '13:30',
        volumeMigration: {
            startDays: 7,
            peakDays: 3,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '08:20', end: '13:30' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    'SI': {
        name: 'Silver',
        exchange: 'COMEX',
        sector: 'METALS',
        tickSize: 0.005,
        tickValue: 25.00,
        rollPattern: 'MONTHLY',
        rollMonths: 'ALL',
        rollDay: 'THIRD_LAST_BUSINESS',
        rollTime: '13:25',
        volumeMigration: {
            startDays: 8,
            peakDays: 4,
            completeDays: 2
        },
        tradingHours: {
            regular: { start: '08:25', end: '13:25' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    // Agricultural Futures
    'ZC': {
        name: 'Corn',
        exchange: 'CBOT',
        sector: 'AGRICULTURE',
        tickSize: 0.25,
        tickValue: 12.50,
        rollPattern: 'SEASONAL', // Mar, May, Jul, Sep, Dec
        rollMonths: [3, 5, 7, 9, 12],
        rollDay: 'BUSINESS_DAY_BEFORE_15',
        rollTime: '13:15',
        volumeMigration: {
            startDays: 12,
            peakDays: 6,
            completeDays: 3
        },
        tradingHours: {
            regular: { start: '08:30', end: '13:15' },
            extended: { start: '19:00', end: '07:45' }
        }
    },
    
    'ZS': {
        name: 'Soybeans',
        exchange: 'CBOT',
        sector: 'AGRICULTURE',
        tickSize: 0.25,
        tickValue: 12.50,
        rollPattern: 'SEASONAL',
        rollMonths: [1, 3, 5, 7, 8, 9, 11], // Jan, Mar, May, Jul, Aug, Sep, Nov
        rollDay: 'BUSINESS_DAY_BEFORE_15',
        rollTime: '13:15',
        volumeMigration: {
            startDays: 12,
            peakDays: 6,
            completeDays: 3
        },
        tradingHours: {
            regular: { start: '08:30', end: '13:15' },
            extended: { start: '19:00', end: '07:45' }
        }
    },
    
    // Currency Futures
    '6E': {
        name: 'Euro FX',
        exchange: 'CME',
        sector: 'CURRENCY',
        tickSize: 0.00005,
        tickValue: 6.25,
        rollPattern: 'QUARTERLY',
        rollMonths: [3, 6, 9, 12],
        rollDay: 'SECOND_BUSINESS_BEFORE_THIRD_WEDNESDAY',
        rollTime: '16:00',
        volumeMigration: {
            startDays: 6,
            peakDays: 3,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '07:20', end: '16:00' },
            extended: { start: '17:00', end: '16:00' }
        }
    },
    
    'M6E': {
        name: 'Micro Euro FX',
        exchange: 'CME',
        sector: 'CURRENCY',
        tickSize: 0.00005,
        tickValue: 0.625,
        rollPattern: 'QUARTERLY',
        rollMonths: [3, 6, 9, 12],
        rollDay: 'SECOND_BUSINESS_BEFORE_THIRD_WEDNESDAY',
        rollTime: '16:00',
        volumeMigration: {
            startDays: 4,
            peakDays: 2,
            completeDays: 1
        },
        tradingHours: {
            regular: { start: '07:20', end: '16:00' },
            extended: { start: '17:00', end: '16:00' }
        }
    }
};

/**
 * Roll Risk Assessment Configuration
 */
const ROLL_RISK_CONFIG = {
    // Distance from roll date risk levels
    CRITICAL_DAYS: 2,    // 2 days or less - critical risk
    HIGH_DAYS: 5,        // 5 days or less - high risk
    MEDIUM_DAYS: 10,     // 10 days or less - medium risk
    LOW_DAYS: 15,        // 15 days or less - low risk
    
    // Volume migration thresholds
    VOLUME_MIGRATION_THRESHOLD: 0.25, // 25% volume moved to new contract
    HEAVY_MIGRATION_THRESHOLD: 0.50,  // 50% volume moved
    COMPLETE_MIGRATION_THRESHOLD: 0.75, // 75% volume moved
    
    // Price spread thresholds (current vs next contract)
    NORMAL_SPREAD_THRESHOLD: 0.001,   // 0.1% spread is normal
    HIGH_SPREAD_THRESHOLD: 0.003,     // 0.3% spread indicates distortion
    EXTREME_SPREAD_THRESHOLD: 0.005   // 0.5% spread indicates severe distortion
};

/**
 * Futures Roll Calendar Tracker
 */
class FuturesRollCalendar extends EventEmitter {
    constructor(api = null, config = {}) {
        super();
        
        this.api = api;
        
        this.config = {
            enabled: config.enabled !== false,
            autoProtection: config.autoProtection !== false,
            
            // Monitoring settings
            updateInterval: config.updateInterval || 900000, // 15 minutes
            rollDayInterval: config.rollDayInterval || 60000, // 1 minute on roll days
            
            // Alert thresholds
            alertDays: config.alertDays || 10, // Start alerting 10 days before roll
            urgentDays: config.urgentDays || 3, // Urgent alerts 3 days before
            
            // Contract specifications
            contracts: { ...FUTURES_CONTRACTS, ...config.contracts },
            
            // Risk settings
            ...ROLL_RISK_CONFIG,
            ...config.riskConfig,
            
            // Tracking preferences
            trackAllContracts: config.trackAllContracts || false,
            trackedContracts: config.trackedContracts || ['ES', 'MES', 'NQ', 'MNQ', 'CL', 'MCL', 'GC', 'MGC'],
            
            // Data sources
            dataSources: config.dataSources || ['TASTYTRADE', 'CME', 'YAHOO'],
            fallbackEnabled: config.fallbackEnabled !== false
        };
        
        // State management
        this.rollCalendar = new Map(); // contract -> roll schedule
        this.currentContracts = new Map(); // contract -> current active contract
        this.volumeData = new Map(); // contract -> volume migration data
        this.spreadData = new Map(); // contract -> spread monitoring
        this.riskAssessments = new Map(); // contract -> risk analysis
        this.dataManager = null; // Will initialize if needed
        
        // Monitoring
        this.monitoringInterval = null;
        this.lastUpdate = null;
        this.rollAlerts = [];
        
        // Statistics
        this.stats = {
            totalRollsTracked: 0,
            accurateRollPredictions: 0,
            missedRolls: 0,
            volumeMigrationAccuracy: 0,
            lastRollDate: null
        };
        
        logger.info('FUTURES_ROLL', 'Futures Roll Calendar initialized', {
            trackedContracts: this.config.trackedContracts.length,
            autoProtection: this.config.autoProtection,
            updateInterval: this.config.updateInterval / 1000
        });
    }
    
    /**
     * Initialize the roll calendar system
     */
    async initialize() {
        try {
            logger.info('FUTURES_ROLL', 'Initializing futures roll calendar');
            
            // Generate roll calendar for next 12 months
            await this.generateRollCalendar();
            
            // Load current contract data
            await this.loadCurrentContracts();
            
            // Start monitoring
            this.startMonitoring();
            
            logger.info('FUTURES_ROLL', 'Futures roll calendar initialized successfully', {
                calendarEntries: this.rollCalendar.size,
                currentContracts: this.currentContracts.size
            });
            
        } catch (error) {
            logger.error('FUTURES_ROLL', 'Failed to initialize roll calendar', error);
            throw error;
        }
    }
    
    /**
     * Generate roll calendar for all tracked contracts
     */
    async generateRollCalendar() {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setFullYear(endDate.getFullYear() + 1); // Next 12 months
        
        for (const symbol of this.config.trackedContracts) {
            const contractSpec = this.config.contracts[symbol];
            if (!contractSpec) {
                logger.warn('FUTURES_ROLL', `No specification found for ${symbol}`);
                continue;
            }
            
            const rollDates = this.calculateRollDates(symbol, contractSpec, today, endDate);
            this.rollCalendar.set(symbol, rollDates);
            
            logger.debug('FUTURES_ROLL', `Generated ${rollDates.length} roll dates for ${symbol}`);
        }
    }
    
    /**
     * Calculate roll dates for a specific contract
     */
    calculateRollDates(symbol, contractSpec, startDate, endDate) {
        const rollDates = [];
        const current = new Date(startDate);
        
        while (current <= endDate) {
            const rollMonths = this.getRollMonths(contractSpec);
            
            for (const month of rollMonths) {
                const rollDate = this.calculateSpecificRollDate(
                    current.getFullYear(),
                    month,
                    contractSpec.rollDay,
                    contractSpec.rollTime
                );
                
                if (rollDate > startDate && rollDate <= endDate) {
                    rollDates.push({
                        symbol: symbol,
                        rollDate: rollDate,
                        fromContract: this.getContractCode(symbol, rollDate, -1),
                        toContract: this.getContractCode(symbol, rollDate, 0),
                        rollTime: contractSpec.rollTime,
                        volumeMigration: contractSpec.volumeMigration,
                        riskLevel: 'PENDING'
                    });
                }
            }
            
            current.setFullYear(current.getFullYear() + 1);
        }
        
        return rollDates.sort((a, b) => a.rollDate - b.rollDate);
    }
    
    /**
     * Get roll months for a contract specification
     */
    getRollMonths(contractSpec) {
        if (contractSpec.rollMonths === 'ALL') {
            return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        }
        return contractSpec.rollMonths || [];
    }
    
    /**
     * Calculate specific roll date based on roll day pattern
     */
    calculateSpecificRollDate(year, month, rollDay, rollTime) {
        let rollDate;
        
        switch (rollDay) {
            case 'THIRD_FRIDAY':
                rollDate = this.getThirdFriday(year, month);
                break;
                
            case 'BUSINESS_DAY_25':
                rollDate = this.getBusinessDay25(year, month);
                break;
                
            case 'BUSINESS_DAY_BEFORE_25':
                rollDate = this.getBusinessDayBefore25(year, month);
                break;
                
            case 'THIRD_LAST_BUSINESS':
                rollDate = this.getThirdLastBusinessDay(year, month);
                break;
                
            case 'BUSINESS_DAY_BEFORE_15':
                rollDate = this.getBusinessDayBefore15(year, month);
                break;
                
            case 'SECOND_BUSINESS_BEFORE_THIRD_WEDNESDAY':
                rollDate = this.getSecondBusinessBeforeThirdWednesday(year, month);
                break;
                
            default:
                // Default to third Friday
                rollDate = this.getThirdFriday(year, month);
        }
        
        // Add roll time
        const [hours, minutes] = rollTime.split(':');
        rollDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        return rollDate;
    }
    
    /**
     * Start monitoring roll calendar
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            logger.warn('FUTURES_ROLL', 'Monitoring already active');
            return;
        }
        
        logger.info('FUTURES_ROLL', 'Starting futures roll monitoring');
        
        // Initial check
        this.checkRollStatus();
        
        // Determine monitoring frequency based on proximity to rolls
        const interval = this.isRollDay() ? 
            this.config.rollDayInterval : 
            this.config.updateInterval;
        
        this.monitoringInterval = setInterval(() => {
            this.checkRollStatus();
        }, interval);
        
        this.emit('monitoring_started');
    }
    
    /**
     * Check roll status for all tracked contracts
     */
    async checkRollStatus() {
        try {
            const today = new Date();
            const upcomingRolls = [];
            const criticalRolls = [];
            
            for (const [symbol, rollDates] of this.rollCalendar) {
                const nextRoll = this.getNextRoll(symbol, today);
                
                if (!nextRoll) continue;
                
                const daysToRoll = this.calculateDaysToRoll(nextRoll.rollDate, today);
                const riskAssessment = await this.assessRollRisk(symbol, nextRoll, daysToRoll);
                
                // Update risk level
                nextRoll.riskLevel = riskAssessment.level;
                nextRoll.riskScore = riskAssessment.score;
                nextRoll.daysToRoll = daysToRoll;
                
                // Store assessment
                this.riskAssessments.set(symbol, riskAssessment);
                
                // Check for alerts
                if (daysToRoll <= this.config.alertDays) {
                    upcomingRolls.push(nextRoll);
                }
                
                if (daysToRoll <= this.config.urgentDays) {
                    criticalRolls.push(nextRoll);
                }
                
                // Update volume migration data
                if (daysToRoll <= 15) { // Start tracking 15 days before roll
                    await this.updateVolumeMigrationData(symbol, nextRoll);
                }
                
                // Update spread monitoring
                if (daysToRoll <= 10) { // Monitor spreads 10 days before
                    await this.updateSpreadData(symbol, nextRoll);
                }
            }
            
            // Process alerts
            if (upcomingRolls.length > 0) {
                this.processRollAlerts(upcomingRolls, criticalRolls);
            }
            
            this.lastUpdate = new Date();
            
        } catch (error) {
            logger.error('FUTURES_ROLL', 'Error checking roll status', error);
        }
    }
    
    /**
     * Assess roll risk for a contract
     */
    async assessRollRisk(symbol, rollInfo, daysToRoll) {
        const assessment = {
            symbol: symbol,
            level: 'LOW',
            score: 0,
            factors: [],
            recommendations: []
        };
        
        // Days to roll risk
        if (daysToRoll <= this.config.CRITICAL_DAYS) {
            assessment.score += 50;
            assessment.level = 'CRITICAL';
            assessment.factors.push(`Critical: ${daysToRoll} days to roll`);
            assessment.recommendations.push('CLOSE_EXPIRING_POSITIONS');
            assessment.recommendations.push('AVOID_NEW_POSITIONS');
        } else if (daysToRoll <= this.config.HIGH_DAYS) {
            assessment.score += 35;
            assessment.level = 'HIGH';
            assessment.factors.push(`High: ${daysToRoll} days to roll`);
            assessment.recommendations.push('REDUCE_POSITION_SIZE');
            assessment.recommendations.push('PREPARE_ROLL_STRATEGY');
        } else if (daysToRoll <= this.config.MEDIUM_DAYS) {
            assessment.score += 20;
            assessment.level = 'MEDIUM';
            assessment.factors.push(`Medium: ${daysToRoll} days to roll`);
            assessment.recommendations.push('MONITOR_VOLUME_MIGRATION');
        } else if (daysToRoll <= this.config.LOW_DAYS) {
            assessment.score += 10;
            assessment.factors.push(`Low: ${daysToRoll} days to roll`);
        }
        
        // Volume migration risk
        const volumeData = this.volumeData.get(symbol);
        if (volumeData) {
            const migrationRatio = volumeData.newContractVolume / 
                (volumeData.currentContractVolume + volumeData.newContractVolume);
            
            if (migrationRatio > this.config.HEAVY_MIGRATION_THRESHOLD) {
                assessment.score += 25;
                assessment.factors.push(`Heavy volume migration: ${(migrationRatio * 100).toFixed(1)}%`);
                assessment.recommendations.push('CONSIDER_EARLY_ROLL');
            } else if (migrationRatio > this.config.VOLUME_MIGRATION_THRESHOLD) {
                assessment.score += 15;
                assessment.factors.push(`Volume migration detected: ${(migrationRatio * 100).toFixed(1)}%`);
            }
        }
        
        // Spread distortion risk
        const spreadData = this.spreadData.get(symbol);
        if (spreadData) {
            const spreadPercent = Math.abs(spreadData.spread / spreadData.currentPrice);
            
            if (spreadPercent > this.config.EXTREME_SPREAD_THRESHOLD) {
                assessment.score += 30;
                assessment.factors.push(`Extreme spread distortion: ${(spreadPercent * 100).toFixed(2)}%`);
                assessment.recommendations.push('AVOID_TRADING_DURING_ROLL');
            } else if (spreadPercent > this.config.HIGH_SPREAD_THRESHOLD) {
                assessment.score += 20;
                assessment.factors.push(`High spread distortion: ${(spreadPercent * 100).toFixed(2)}%`);
            }
        }
        
        // Update overall level based on total score
        if (assessment.score >= 80) assessment.level = 'CRITICAL';
        else if (assessment.score >= 60) assessment.level = 'HIGH';
        else if (assessment.score >= 40) assessment.level = 'MEDIUM';
        else if (assessment.score >= 20) assessment.level = 'LOW';
        
        return assessment;
    }
    
    /**
     * Update volume migration data
     */
    async updateVolumeMigrationData(symbol, rollInfo) {
        try {
            // Get volume data for current and next contracts
            const currentVolume = await this.getContractVolume(rollInfo.fromContract);
            const nextVolume = await this.getContractVolume(rollInfo.toContract);
            
            const volumeData = {
                timestamp: new Date(),
                currentContract: rollInfo.fromContract,
                newContract: rollInfo.toContract,
                currentContractVolume: currentVolume || 0,
                newContractVolume: nextVolume || 0,
                migrationRatio: (nextVolume || 0) / ((currentVolume || 0) + (nextVolume || 0)),
                totalVolume: (currentVolume || 0) + (nextVolume || 0)
            };
            
            this.volumeData.set(symbol, volumeData);
            
            logger.debug('FUTURES_ROLL', `Updated volume data for ${symbol}`, {
                current: currentVolume,
                next: nextVolume,
                migrationRatio: (volumeData.migrationRatio * 100).toFixed(1) + '%'
            });
            
        } catch (error) {
            logger.error('FUTURES_ROLL', `Failed to update volume data for ${symbol}`, error);
        }
    }
    
    /**
     * Update spread monitoring data
     */
    async updateSpreadData(symbol, rollInfo) {
        try {
            // Get prices for current and next contracts
            const currentPrice = await this.getContractPrice(rollInfo.fromContract);
            const nextPrice = await this.getContractPrice(rollInfo.toContract);
            
            if (currentPrice && nextPrice) {
                const spread = nextPrice - currentPrice;
                const spreadPercent = spread / currentPrice;
                
                const spreadData = {
                    timestamp: new Date(),
                    currentContract: rollInfo.fromContract,
                    newContract: rollInfo.toContract,
                    currentPrice: currentPrice,
                    nextPrice: nextPrice,
                    spread: spread,
                    spreadPercent: spreadPercent,
                    distortionLevel: this.assessSpreadDistortion(Math.abs(spreadPercent))
                };
                
                this.spreadData.set(symbol, spreadData);
                
                logger.debug('FUTURES_ROLL', `Updated spread data for ${symbol}`, {
                    spread: spread.toFixed(3),
                    spreadPercent: (spreadPercent * 100).toFixed(2) + '%',
                    distortion: spreadData.distortionLevel
                });
            }
            
        } catch (error) {
            logger.error('FUTURES_ROLL', `Failed to update spread data for ${symbol}`, error);
        }
    }
    
    /**
     * Process roll alerts and notifications
     */
    processRollAlerts(upcomingRolls, criticalRolls) {
        // Clear old alerts
        this.rollAlerts = [];
        
        if (criticalRolls.length > 0) {
            logger.warn('FUTURES_ROLL', `CRITICAL: ${criticalRolls.length} contracts approaching roll`, {
                contracts: criticalRolls.map(r => `${r.symbol} (${r.daysToRoll}d)`).join(', ')
            });
            
            this.emit('critical_rolls_detected', criticalRolls);
        }
        
        if (upcomingRolls.length > 0) {
            logger.info('FUTURES_ROLL', `${upcomingRolls.length} upcoming contract rolls`, {
                contracts: upcomingRolls.map(r => `${r.symbol} (${r.daysToRoll}d)`).join(', ')
            });
            
            this.emit('upcoming_rolls_detected', upcomingRolls);
        }
        
        // Generate detailed alerts
        for (const roll of upcomingRolls) {
            const assessment = this.riskAssessments.get(roll.symbol);
            
            const alert = {
                symbol: roll.symbol,
                rollDate: roll.rollDate,
                daysToRoll: roll.daysToRoll,
                riskLevel: roll.riskLevel,
                riskScore: roll.riskScore,
                fromContract: roll.fromContract,
                toContract: roll.toContract,
                factors: assessment?.factors || [],
                recommendations: assessment?.recommendations || [],
                timestamp: new Date()
            };
            
            this.rollAlerts.push(alert);
        }
        
        // Auto-protection measures
        if (this.config.autoProtection && criticalRolls.length > 0) {
            this.activateRollProtection(criticalRolls);
        }
    }
    
    /**
     * Activate automatic roll protection measures
     */
    async activateRollProtection(criticalRolls) {
        logger.warn('FUTURES_ROLL', 'Activating automatic roll protection', {
            affectedContracts: criticalRolls.map(r => r.symbol)
        });
        
        for (const roll of criticalRolls) {
            const protectionMeasures = {
                symbol: roll.symbol,
                restrictions: [],
                actions: []
            };
            
            if (roll.daysToRoll <= 1) {
                protectionMeasures.restrictions.push('BLOCK_NEW_POSITIONS');
                protectionMeasures.actions.push('FORCE_CLOSE_EXPIRING');
            } else if (roll.daysToRoll <= 2) {
                protectionMeasures.restrictions.push('LIMIT_POSITION_SIZE');
                protectionMeasures.actions.push('REDUCE_EXPOSURE');
            }
            
            this.emit('roll_protection_activated', protectionMeasures);
        }
    }
    
    // Utility methods for date calculations
    
    getThirdFriday(year, month) {
        const firstDay = new Date(year, month - 1, 1);
        const firstFriday = new Date(firstDay);
        firstFriday.setDate(1 + (5 - firstDay.getDay() + 7) % 7);
        const thirdFriday = new Date(firstFriday);
        thirdFriday.setDate(firstFriday.getDate() + 14);
        return thirdFriday;
    }
    
    getBusinessDay25(year, month) {
        let date = new Date(year, month - 1, 25);
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() - 1);
        }
        return date;
    }
    
    getBusinessDayBefore25(year, month) {
        let date = new Date(year, month - 1, 25);
        date.setDate(date.getDate() - 1);
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() - 1);
        }
        return date;
    }
    
    getThirdLastBusinessDay(year, month) {
        const lastDay = new Date(year, month, 0); // Last day of month
        let businessDays = 0;
        let date = new Date(lastDay);
        
        while (businessDays < 3) {
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                businessDays++;
            }
            if (businessDays < 3) {
                date.setDate(date.getDate() - 1);
            }
        }
        
        return date;
    }
    
    getBusinessDayBefore15(year, month) {
        let date = new Date(year, month - 1, 15);
        date.setDate(date.getDate() - 1);
        while (date.getDay() === 0 || date.getDay() === 6) {
            date.setDate(date.getDate() - 1);
        }
        return date;
    }
    
    getSecondBusinessBeforeThirdWednesday(year, month) {
        const firstDay = new Date(year, month - 1, 1);
        const firstWednesday = new Date(firstDay);
        firstWednesday.setDate(1 + (3 - firstDay.getDay() + 7) % 7);
        const thirdWednesday = new Date(firstWednesday);
        thirdWednesday.setDate(firstWednesday.getDate() + 14);
        
        let date = new Date(thirdWednesday);
        let businessDays = 0;
        
        while (businessDays < 2) {
            date.setDate(date.getDate() - 1);
            if (date.getDay() !== 0 && date.getDay() !== 6) {
                businessDays++;
            }
        }
        
        return date;
    }
    
    // Data access methods
    
    getNextRoll(symbol, fromDate = new Date()) {
        const rollDates = this.rollCalendar.get(symbol);
        if (!rollDates) return null;
        
        return rollDates.find(roll => roll.rollDate > fromDate);
    }
    
    calculateDaysToRoll(rollDate, fromDate = new Date()) {
        const timeDiff = rollDate.getTime() - fromDate.getTime();
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    }
    
    getContractCode(symbol, rollDate, monthOffset = 0) {
        const contractDate = new Date(rollDate);
        contractDate.setMonth(contractDate.getMonth() + monthOffset);
        
        const monthCodes = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
        const monthCode = monthCodes[contractDate.getMonth()];
        const yearCode = contractDate.getFullYear().toString().slice(-2);
        
        return `${symbol}${monthCode}${yearCode}`;
    }
    
    isRollDay() {
        const today = new Date();
        for (const [symbol, rollDates] of this.rollCalendar) {
            const nextRoll = rollDates.find(roll => roll.rollDate > today);
            if (nextRoll && this.calculateDaysToRoll(nextRoll.rollDate, today) <= 1) {
                return true;
            }
        }
        return false;
    }
    
    assessSpreadDistortion(spreadPercent) {
        if (spreadPercent > this.config.EXTREME_SPREAD_THRESHOLD) return 'EXTREME';
        if (spreadPercent > this.config.HIGH_SPREAD_THRESHOLD) return 'HIGH';
        if (spreadPercent > this.config.NORMAL_SPREAD_THRESHOLD) return 'MEDIUM';
        return 'NORMAL';
    }
    
    // Mock data methods (would integrate with real APIs)
    
    async loadCurrentContracts() {
        // Would load current active contracts from market data
        for (const symbol of this.config.trackedContracts) {
            const currentContract = this.getCurrentContractCode(symbol);
            this.currentContracts.set(symbol, currentContract);
        }
    }
    
    getCurrentContractCode(symbol) {
        // Simplified - would determine from volume/open interest data
        const today = new Date();
        return this.getContractCode(symbol, today, 0);
    }
    
    async getContractVolume(contractCode) {
        try {
            // Use real API data if available
            if (this.api && this.api.getContractData) {
                const contractData = await this.api.getContractData(contractCode);
                if (contractData && contractData.volume) {
                    return contractData.volume;
                }
            }
            
            // Use real API quote data as fallback
            if (this.api && this.api.getQuote) {
                const quote = await this.api.getQuote(contractCode);
                if (quote && quote.volume) {
                    return quote.volume;
                }
            }
            
            // Initialize dataManager if needed
            if (!this.dataManager) {
                const DataManager = require('./dataManager');
                this.dataManager = new DataManager(this.api);
            }
            
            // Fallback to DataManager for real cached data
            const futuresData = await this.dataManager.getCurrentPrice(contractCode);
            if (futuresData && futuresData.volume) {
                return futuresData.volume;
            }
            
            // No synthetic data - return null if no real data available
            logger.error('FUTURES_ROLL', `No real volume data available for ${contractCode}`);
            return null;
        } catch (error) {
            logger.error('FUTURES_ROLL', `Failed to get volume for ${contractCode}:`, error);
            return null;
        }
    }
    
    async getContractPrice(contractCode) {
        try {
            // Use real API data if available
            if (this.api && this.api.getContractData) {
                const contractData = await this.api.getContractData(contractCode);
                if (contractData && contractData.price) {
                    return contractData.price;
                }
            }
            
            // Use real API quote data as fallback
            if (this.api && this.api.getQuote) {
                const quote = await this.api.getQuote(contractCode);
                if (quote && (quote.price || quote.last || quote.close)) {
                    return quote.price || quote.last || quote.close;
                }
            }
            
            // Initialize dataManager if needed
            if (!this.dataManager) {
                const DataManager = require('./dataManager');
                this.dataManager = new DataManager(this.api);
            }
            
            // Fallback to DataManager for real cached data
            const futuresData = await this.dataManager.getCurrentPrice(contractCode);
            if (futuresData && futuresData.price) {
                return futuresData.price;
            }
            
            // No synthetic data - return null if no real data available
            logger.error('FUTURES_ROLL', `No real price data available for ${contractCode}`);
            return null;
        } catch (error) {
            logger.error('FUTURES_ROLL', `Failed to get price for ${contractCode}:`, error);
            return null;
        }
    }
    
    // Removed synthetic calculation methods - using only real API data
    
    // Public interface methods
    
    getStatus() {
        return {
            enabled: this.config.enabled,
            monitoring: this.monitoringInterval !== null,
            trackedContracts: this.config.trackedContracts.length,
            upcomingRolls: this.rollAlerts.length,
            lastUpdate: this.lastUpdate,
            statistics: this.stats
        };
    }
    
    getRollSchedule(symbol = null) {
        if (symbol) {
            return this.rollCalendar.get(symbol) || [];
        }
        
        const allRolls = [];
        for (const rollDates of this.rollCalendar.values()) {
            allRolls.push(...rollDates);
        }
        
        return allRolls.sort((a, b) => a.rollDate - b.rollDate);
    }
    
    getRiskAssessment(symbol) {
        return this.riskAssessments.get(symbol) || null;
    }
    
    getCurrentAlerts() {
        return this.rollAlerts;
    }
    
    stop() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            logger.info('FUTURES_ROLL', 'Monitoring stopped');
        }
    }
}

// Export
module.exports = {
    FuturesRollCalendar,
    FUTURES_CONTRACTS,
    ROLL_RISK_CONFIG
};