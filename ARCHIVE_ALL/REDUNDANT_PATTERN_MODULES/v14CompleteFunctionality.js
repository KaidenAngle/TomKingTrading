/**
 * TOM KING FRAMEWORK v14 COMPLETE FUNCTIONALITY
 * Implements all missing features from the original v14 framework
 * Including Friday pre-market analysis, position allocation tables,
 * correlation groups, and capital recycling
 */

const { TastyTradeAPI } = require('./tastytradeAPI');
const { getLogger } = require('./logger');

const logger = getLogger();
const DEBUG_V14 = process.env.NODE_ENV !== 'production';

class V14CompleteFunctionality {
    constructor() {
        this.api = null;
        
        // Never Trade List from PDF Pages 6-7
        this.neverTradeList = ['OJ', 'LBS', 'DX', 'VX', 'NG', 'ZR', 'PA'];
        
        // Complete Correlation Groups (PDF Page 12)
        this.correlationGroups = {
            'A1': { 
                name: 'Equity Index Futures',
                tickers: ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'M2K', 'MYM', 'YM'],
                limit: 2,
                correlation: 'HIGH (0.85+)'
            },
            'A2': { 
                name: 'Equity ETFs',
                tickers: ['SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI'],
                limit: 3,
                correlation: 'HIGH (0.80+)'
            },
            'B1': { 
                name: 'Safe Haven Metals',
                tickers: ['GC', 'MGC', 'GLD', 'IAU'],
                limit: 2,
                correlation: 'TIGHT (0.95+)'
            },
            'B2': { 
                name: 'Industrial Metals',
                tickers: ['SI', 'SIL', 'SLV', 'HG', 'PL', 'PA'],
                limit: 2,
                correlation: 'MODERATE (0.60+)'
            },
            'C1': { 
                name: 'Crude Complex',
                tickers: ['CL', 'MCL', 'QM', 'XOP', 'USO', 'UCO'],
                limit: 2,
                correlation: 'VERY HIGH (0.95+)'
            },
            'C2': { 
                name: 'Natural Gas',
                tickers: ['NG', 'UNG', 'BOIL'],
                limit: 1,
                correlation: 'INDEPENDENT'
            },
            'D1': { 
                name: 'Grains',
                tickers: ['ZC', 'ZS', 'ZW', 'ZR'],
                limit: 2,
                correlation: 'WEATHER-DRIVEN'
            },
            'D2': { 
                name: 'Proteins',
                tickers: ['LE', 'HE', 'GF'],
                limit: 1,
                correlation: 'SEASONAL'
            },
            'E': { 
                name: 'Currencies',
                tickers: ['6E', '6B', '6A', '6C', '6J', '6S', 'M6E', 'M6A', 'DX', 'FXE', 'FXB'],
                limit: 2,
                correlation: 'DOLLAR-DEPENDENT'
            }
        };

        // PDF Exit Targets (Pages 9-10)
        this.pdfExitTargets = {
            'STRANGLE': { 
                profit: 50,
                dte: 21,
                reference: 'PDF Page 9 - 50% Rule'
            },
            'LT112': { 
                nakedProfit: 90,
                manageDTE: 30,
                spreadHold: true,
                reference: 'PDF Page 26 - LT112 Specs'
            },
            'IPMCC': { 
                maxLoss: -30,
                rollDTE: 90,
                weeklyTarget: 90,
                reference: 'PDF Pages 28-31 - IPMCC Specs'
            },
            '0DTE': { 
                profit: 50,
                stopMultiple: 2,
                timeStopHour: 15,
                reference: 'PDF Page 25 - 0DTE Specs'
            },
            'LEAP': {
                profit: 30,
                avgDays: 40,
                reference: 'PDF Page 28 - LEAP Specs'
            },
            'RATIO': {
                profit: 50,
                defenseDelta: 25,
                reference: 'PDF Page 32 - Ratio Specs'
            },
            'BUTTERFLY': {
                holdToExpiry: true,
                reference: 'PDF Pages 31-32 - Butterfly Specs'
            },
            'DIAGONAL': {
                profit: 50,
                vixLimit: 15,
                reference: 'PDF Pages 32-33 - Diagonal Specs'
            }
        };

        // Day-Specific Strategy Permissions
        this.dayStrategyMap = {
            'Monday': ['LEAP', 'STRANGLE', 'IPMCC'],
            'Tuesday': ['STRANGLE', 'RATIO'],
            'Wednesday': ['LT112', 'STRANGLE'],
            'Thursday': ['MANAGEMENT_ONLY'],
            'Friday': ['0DTE', 'IPMCC', 'BUTTERFLY']
        };
    }

    /**
     * PROGRESSIVE FRIDAY PRE-MARKET ANALYSIS (9:00-10:30 AM)
     * Implements the 3-phase analysis from v14 framework
     */
    async runFridayPreMarketAnalysis(marketData, currentTime) {
        if (DEBUG_V14) {
            console.log('\n📊 FRIDAY PRE-MARKET 0DTE ANALYSIS');
            console.log('================================================================================');
        }
        logger.info('V14', 'Starting Friday Pre-Market 0DTE Analysis');
        
        const timeHour = this.extractHour(currentTime);
        const analysis = {
            phase: null,
            data: {},
            triggers: {},
            recommendations: [],
            countdown: null
        };

        // Phase 1: 9:00-9:30 AM - Overnight Assessment
        if (timeHour >= 9 && timeHour < 9.5) {
            analysis.phase = 'OVERNIGHT ASSESSMENT';
            if (DEBUG_V14) {
                console.log('\n🌙 PHASE 1: OVERNIGHT ASSESSMENT (9:00-9:30 AM)');
                console.log('─────────────────────────────────────────────────────────────');
            }
            logger.info('V14', 'Phase 1: Overnight Assessment (9:00-9:30 AM)');
            
            analysis.data.overnight = {
                high: marketData.ES?.overnightHigh || 'SEARCH: ES overnight high',
                low: marketData.ES?.overnightLow || 'SEARCH: ES overnight low',
                current: marketData.ES?.currentPrice || 'SEARCH: ES current price',
                fromClose: marketData.ES?.previousClose ? 
                    ((marketData.ES.currentPrice - marketData.ES.previousClose) / marketData.ES.previousClose * 100).toFixed(2) : 
                    'CALCULATE',
                volume: marketData.ES?.globexVolume || 'SEARCH: ES Globex volume',
                direction: this.determineDirection(marketData.ES)
            };

            console.log(`📍 Overnight Range: $${analysis.data.overnight.low} - $${analysis.data.overnight.high}`);
            console.log(`📍 Current: $${analysis.data.overnight.current} (${analysis.data.overnight.fromClose}% from close)`);
            console.log(`📍 Direction: ${analysis.data.overnight.direction}`);
            console.log(`📍 Volume: ${analysis.data.overnight.volume}`);
            
            analysis.recommendations.push('Monitor for gap fill potential');
            analysis.recommendations.push('Check economic calendar for 9:30 AM data');
        }
        
        // Phase 2: 9:30-10:00 AM - Opening Range Development
        else if (timeHour >= 9.5 && timeHour < 10) {
            analysis.phase = 'OPENING RANGE DEVELOPMENT';
            console.log('\n📈 PHASE 2: OPENING RANGE DEVELOPMENT (9:30-10:00 AM)');
            console.log('─────────────────────────────────────────────────────────────');
            
            analysis.data.openingRange = {
                high30min: marketData.ES?.high30min || 'SEARCH: ES 30-min high',
                low30min: marketData.ES?.low30min || 'SEARCH: ES 30-min low',
                vwap: marketData.ES?.vwap || 'SEARCH: ES VWAP',
                orderFlow: marketData.ES?.orderFlow || 'SEARCH: ES order flow',
                buyingPressure: marketData.ES?.buyingPressure || 'SEARCH: ES buying pressure'
            };

            console.log(`📍 30-Min Range: $${analysis.data.openingRange.low30min} - $${analysis.data.openingRange.high30min}`);
            console.log(`📍 VWAP: $${analysis.data.openingRange.vwap}`);
            console.log(`📍 Order Flow: ${analysis.data.openingRange.orderFlow}`);
            
            analysis.recommendations.push('Watch for range breakout above/below 30-min levels');
            analysis.recommendations.push('Monitor VWAP as support/resistance');
        }
        
        // Phase 3: 10:00-10:30 AM - Final 0DTE Preparation
        else if (timeHour >= 10 && timeHour < 10.5) {
            analysis.phase = 'FINAL 0DTE PREPARATION';
            console.log('\n⚡ PHASE 3: FINAL 0DTE PREPARATION (10:00-10:30 AM)');
            console.log('─────────────────────────────────────────────────────────────');
            
            const openPrice = marketData.ES?.openPrice || 5450;
            const currentPrice = marketData.ES?.currentPrice || 5450;
            const moveFromOpen = ((currentPrice - openPrice) / openPrice * 100);
            
            // Calculate exact triggers (±0.5% from open per PDF Page 25)
            analysis.triggers = {
                callTrigger: openPrice * 1.005,
                putTrigger: openPrice * 0.995,
                currentMove: moveFromOpen,
                direction: moveFromOpen > 0.5 ? 'CALL SPREAD' : 
                          moveFromOpen < -0.5 ? 'PUT SPREAD' : 
                          'IRON CONDOR'
            };
            
            // Calculate countdown
            const now = new Date();
            const target = new Date();
            target.setHours(10, 30, 0);
            const minutesRemaining = Math.max(0, Math.floor((target - now) / 60000));
            analysis.countdown = minutesRemaining;

            console.log('\n🎯 KEY LEVELS FOR 10:30 AM EXECUTION');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📈 CALL SPREAD TRIGGER: ES above $${analysis.triggers.callTrigger.toFixed(2)} (+0.5%)`);
            console.log(`📉 PUT SPREAD TRIGGER: ES below $${analysis.triggers.putTrigger.toFixed(2)} (-0.5%)`);
            console.log(`📊 IRON CONDOR ZONE: ES between $${analysis.triggers.putTrigger.toFixed(2)} and $${analysis.triggers.callTrigger.toFixed(2)}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`\n⏰ COUNTDOWN: ${minutesRemaining} minutes until 10:30 AM execution`);
            console.log(`📍 Current ES: $${currentPrice} (${moveFromOpen.toFixed(2)}% from open)`);
            console.log(`🎯 RECOMMENDATION: ${analysis.triggers.direction}`);
        }
        
        // After 10:30 AM - Execution Window Open
        else if (timeHour >= 10.5) {
            analysis.phase = 'EXECUTION WINDOW OPEN';
            console.log('\n✅ 0DTE EXECUTION WINDOW IS OPEN');
            console.log('─────────────────────────────────────────────────────────────');
            console.log('Execute based on pre-market analysis triggers');
        }
        
        // Before 9:00 AM
        else {
            analysis.phase = 'PRE-MARKET CLOSED';
            console.log('\n⏰ Pre-market analysis begins at 9:00 AM EST');
        }

        return analysis;
    }

    /**
     * GENERATE POSITION ALLOCATION TABLE
     * Creates the comprehensive BP optimization table from v14
     */
    generatePositionAllocationTable(userData) {
        const { accountValue, positions = [], bpUsed, vixLevel, dayOfWeek, phase } = userData;
        
        console.log('\n📊 POSITION ALLOCATION & BP OPTIMIZATION TABLE');
        console.log(`Phase ${phase}: £${accountValue.toLocaleString()}`);
        console.log('================================================================================');
        console.log('Strategy    | Max | Current | Avail | BP/Pos | BP Used | Can Add | Priority');
        console.log('------------|-----|---------|-------|--------|---------|---------|------------');
        
        const phaseStrategies = this.getPhaseStrategies(phase);
        const table = [];
        let totalBPAvailable = 0;
        
        phaseStrategies.forEach(strategy => {
            const maxPos = this.calculateMaxPositionsByPhase(strategy, phase);
            const currentPos = positions.filter(p => p.strategy === strategy).length;
            const bpPerPos = this.getPhaseAdjustedBP(strategy, phase);
            const currentBP = currentPos * bpPerPos;
            const availablePos = Math.max(0, maxPos - currentPos);
            const canAddBP = availablePos * bpPerPos;
            const priority = this.getPhasePriority(strategy, dayOfWeek, phase);
            
            const row = {
                strategy,
                maxPos,
                currentPos,
                availablePos,
                bpPerPos,
                currentBP,
                canAddBP,
                priority
            };
            
            table.push(row);
            totalBPAvailable += canAddBP;
            
            // Format and print row
            console.log(
                `${strategy.padEnd(11)} | ${String(maxPos).padEnd(3)} | ${String(currentPos).padEnd(7)} | ` +
                `${String(availablePos).padEnd(5)} | ${String(bpPerPos).padEnd(6)}% | ${String(currentBP).padEnd(7)}% | ` +
                `${String(canAddBP).padEnd(7)}% | ${priority}`
            );
        });
        
        console.log('================================================================================');
        
        // VIX Regime Analysis
        const vixRegime = this.getVIXRegimeLimits(vixLevel);
        console.log(`\nVIX REGIME (${vixLevel}): ${vixRegime.regime} - Target ${vixRegime.min}-${vixRegime.max}% BP usage`);
        console.log(`Current: ${bpUsed}% | Gap to Min: ${Math.max(0, vixRegime.min - bpUsed)}% | Available: ${totalBPAvailable}%`);
        
        // Optimization Plan
        console.log('\nOPTIMIZATION PLAN TO REACH PHASE TARGET:');
        const optimization = this.calculatePhaseBPOptimization(bpUsed, phase, vixRegime, table, dayOfWeek);
        if (optimization.plan && optimization.plan.length > 0) {
            optimization.plan.forEach((item, idx) => {
                console.log(`${idx + 1}. Add ${item.positions} ${item.strategy} positions (+${item.bpAdded}% BP) - ${item.when}`);
            });
            console.log(`Projected BP after optimization: ${optimization.projectedBP}%`);
        } else {
            console.log('Already at optimal BP usage for current phase');
        }
        
        return { table, totalBPAvailable, vixRegime, optimization };
    }

    /**
     * CHECK AUGUST 2024 CORRELATION RULES
     * Prevents the £308k disaster scenario
     */
    checkAugust2024Rules(positions, newTicker = null) {
        const warnings = [];
        const violations = [];
        
        console.log('\n⚠️ AUGUST 2024 CORRELATION CHECK');
        console.log('─────────────────────────────────────────────────────────────');
        
        // Check each correlation group
        for (const [groupId, data] of Object.entries(this.correlationGroups)) {
            const groupPositions = positions.filter(p => data.tickers.includes(p.ticker));
            const count = groupPositions.length;
            
            if (count > 0) {
                console.log(`${data.name}: ${count}/${data.limit} positions`);
                
                if (count >= data.limit) {
                    violations.push({
                        group: data.name,
                        count,
                        limit: data.limit,
                        severity: 'CRITICAL'
                    });
                    warnings.push(`🚨 ${data.name} at MAXIMUM (${data.limit})`);
                } else if (count === data.limit - 1) {
                    warnings.push(`⚠️ ${data.name} approaching limit (${count}/${data.limit})`);
                }
            }
            
            // Check if new ticker would violate
            if (newTicker && data.tickers.includes(newTicker)) {
                if (count >= data.limit) {
                    return {
                        allowed: false,
                        reason: `BLOCKED: ${data.name} at maximum (${data.limit})`,
                        group: data.name,
                        current: count,
                        limit: data.limit
                    };
                }
            }
        }
        
        // Check expiration clustering
        const expirationMap = {};
        positions.forEach(p => {
            if (!expirationMap[p.dte]) expirationMap[p.dte] = [];
            expirationMap[p.dte].push(p);
        });
        
        Object.entries(expirationMap).forEach(([dte, pos]) => {
            if (pos.length >= 3) {
                warnings.push(`⚠️ ${pos.length} positions at ${dte} DTE (diversify expirations)`);
            }
        });
        
        // Check directional bias
        const bullishCount = positions.filter(p => 
            ['LT112', 'LEAP', 'IPMCC'].includes(p.strategy)
        ).length;
        
        if (bullishCount >= 4) {
            warnings.push(`⚠️ ${bullishCount} bullish positions (Tom had 6 when VIX spiked)`);
        }
        
        if (violations.length > 0) {
            console.log('\n🚨 CRITICAL VIOLATIONS:');
            violations.forEach(v => {
                console.log(`   ${v.group}: ${v.count}/${v.limit} - REDUCE IMMEDIATELY`);
            });
        }
        
        if (warnings.length > 0) {
            console.log('\n⚠️ WARNINGS:');
            warnings.forEach(w => console.log(`   ${w}`));
        } else if (violations.length === 0) {
            console.log('✅ All correlation limits OK');
        }
        
        return { warnings, violations, allowed: violations.length === 0 };
    }

    /**
     * IDENTIFY CAPITAL RECYCLING OPPORTUNITIES
     * Finds positions ready to close and free up BP
     */
    identifyCapitalRecycling(positions) {
        console.log('\n💰 CAPITAL RECYCLING OPPORTUNITIES');
        console.log('─────────────────────────────────────────────────────────────');
        
        const recyclable = [];
        let totalBPFreed = 0;
        
        positions.forEach(p => {
            const health = this.analyzePositionHealth(p);
            
            if (health.exitTrigger) {
                const bpFreed = this.estimateBPForPosition(p.ticker, p.strategy);
                recyclable.push({
                    position: p,
                    reason: health.action,
                    bpFreed,
                    priority: health.priority || 'HIGH'
                });
                totalBPFreed += bpFreed;
            }
        });
        
        if (recyclable.length > 0) {
            console.log(`Found ${recyclable.length} positions to recycle:`);
            recyclable.forEach((item, idx) => {
                console.log(`${idx + 1}. ${item.position.ticker} ${item.position.strategy}: ${item.reason}`);
                console.log(`   BP to free: ${item.bpFreed}% | Priority: ${item.priority}`);
            });
            console.log(`\nTotal BP to recycle: ${totalBPFreed}%`);
        } else {
            console.log('No positions ready for recycling');
        }
        
        return { recyclable, totalBPFreed };
    }

    /**
     * VIX SPIKE PROTOCOL
     * Implements emergency protocol when VIX > 30
     */
    checkVIXSpikeProtocol(vixLevel, accountValue) {
        if (vixLevel > 30) {
            console.log('\n🚨🚨🚨 VIX SPIKE OPPORTUNITY PROTOCOL TRIGGERED 🚨🚨🚨');
            console.log('════════════════════════════════════════════════════════════');
            console.log('VIX > 30: GENERATIONAL OPPORTUNITY (PDF Page 13)');
            console.log('\nIMMEDIATE ACTIONS:');
            console.log('1. ✅ Close all profitable strangles immediately');
            console.log('2. ✅ Close all call sales to prevent unlimited loss');
            console.log('3. ✅ Deploy 80% of BP into 45 DTE, 20-delta puts');
            console.log('4. ✅ Use SPX for tax efficiency (Section 1256)');
            console.log('5. ✅ Ladder entries over 3 days');
            console.log('\nDEPLOYMENT:');
            console.log(`   Account: £${accountValue.toLocaleString()}`);
            console.log(`   Deploy: £${Math.round(accountValue * 0.8).toLocaleString()} (80%)`);
            console.log(`   Expected Return: 15-20% in 30-45 days`);
            console.log('════════════════════════════════════════════════════════════');
            
            return {
                triggered: true,
                protocol: 'VIX_SPIKE',
                deployment: Math.round(accountValue * 0.8),
                actions: [
                    'Close profitable strangles',
                    'Close call sales',
                    'Deploy 80% BP into puts',
                    'Use SPX for tax efficiency',
                    'Ladder over 3 days'
                ]
            };
        }
        return { triggered: false };
    }

    /**
     * ANALYZE POSITION HEALTH
     * Calculates health score and exit triggers based on PDF rules
     */
    analyzePositionHealth(position) {
        let score = 100;
        let action = 'HOLD';
        let exitTrigger = false;
        let priority = 'LOW';
        
        const strategy = position.strategy.toUpperCase();
        const targets = this.pdfExitTargets[strategy];
        
        if (!targets) {
            return { score: 50, action: 'MONITOR', exitTrigger: false, priority: 'LOW' };
        }
        
        // Check strategy-specific rules
        switch(strategy) {
            case 'STRANGLE':
                if (position.pl >= targets.profit) {
                    exitTrigger = true;
                    action = `EXIT - ${targets.profit}% TARGET (${targets.reference})`;
                    priority = 'HIGH';
                } else if (position.dte <= targets.dte) {
                    exitTrigger = true;
                    action = `EXIT - ${targets.dte} DTE RULE (${targets.reference})`;
                    priority = 'HIGH';
                }
                score = Math.max(0, 100 - (90 - position.dte) - (targets.profit - position.pl));
                break;
                
            case 'LT112':
                if (position.pl >= targets.nakedProfit && position.dte > targets.manageDTE) {
                    action = `CLOSE NAKED PUTS - ${targets.nakedProfit}% TARGET`;
                    priority = 'MEDIUM';
                } else if (position.dte <= targets.manageDTE) {
                    action = `MANAGE - ${targets.manageDTE} DTE`;
                    priority = 'HIGH';
                }
                score = Math.max(0, 100 - (120 - position.dte) * 0.5);
                break;
                
            case '0DTE':
                const hour = new Date().getHours();
                if (position.pl >= targets.profit) {
                    exitTrigger = true;
                    action = `EXIT - ${targets.profit}% TARGET`;
                    priority = 'IMMEDIATE';
                } else if (position.pl <= -(targets.stopMultiple * 100)) {
                    exitTrigger = true;
                    action = `STOP LOSS - ${targets.stopMultiple}X`;
                    priority = 'IMMEDIATE';
                } else if (hour >= targets.timeStopHour) {
                    exitTrigger = true;
                    action = `TIME STOP - ${targets.timeStopHour}:00`;
                    priority = 'IMMEDIATE';
                }
                score = position.pl >= 0 ? 75 : 25;
                break;
        }
        
        return { score, action, exitTrigger, priority };
    }

    // HELPER METHODS
    
    getPhaseStrategies(phase) {
        const strategies = {
            1: ['0DTE', 'IPMCC', 'STRANGLE'],
            2: ['0DTE', 'LT112', 'STRANGLE', 'IPMCC', 'RATIO', 'LEAP'],
            3: ['0DTE', 'LT112', 'STRANGLE', 'IPMCC', 'RATIO', 'LEAP', 'BUTTERFLY', 'DIAGONAL'],
            4: ['0DTE', 'LT112', 'STRANGLE', 'IPMCC', 'RATIO', 'LEAP', 'BUTTERFLY', 'DIAGONAL', 'BOX']
        };
        return strategies[phase] || strategies[1];
    }
    
    calculateMaxPositionsByPhase(strategy, phase) {
        const limits = {
            '0DTE': [1, 2, 3, 4],
            'LT112': [0, 4, 1, 3],
            'STRANGLE': [1, 3, 4, 5],
            'IPMCC': [1, 2, 3, 4],
            'LEAP': [0, 2, 3, 10],
            'RATIO': [0, 2, 4, 5],
            'BUTTERFLY': [0, 0, 2, 4],
            'DIAGONAL': [0, 0, 2, 4],
            'BOX': [0, 0, 1, 2]
        };
        return limits[strategy]?.[phase - 1] || 0;
    }
    
    getPhaseAdjustedBP(strategy, phase) {
        const requirements = {
            '0DTE': 2,
            'LT112': phase >= 3 ? 6 : 3,
            'STRANGLE': 3,
            'IPMCC': 8,
            'LEAP': 2,
            'RATIO': 2,
            'BUTTERFLY': 0.5,
            'DIAGONAL': 1.5,
            'BOX': 0
        };
        return requirements[strategy] || 3;
    }
    
    getPhasePriority(strategy, dayOfWeek, phase) {
        if (strategy === '0DTE' && dayOfWeek === 'Friday') return 'TODAY 10:30';
        if (strategy === 'LT112' && dayOfWeek === 'Wednesday' && phase >= 2) {
            return phase >= 3 ? 'WEEKLY STACK' : 'TODAY';
        }
        if (strategy === 'STRANGLE' && dayOfWeek === 'Tuesday') return 'TODAY';
        if (strategy === 'IPMCC' && dayOfWeek === 'Friday') return 'Roll today';
        if (strategy === 'LEAP' && dayOfWeek === 'Monday' && phase >= 2) return 'TODAY';
        if (strategy === 'BUTTERFLY' && dayOfWeek === 'Friday' && phase >= 3) return 'After 0DTE';
        return 'Monitor';
    }
    
    getVIXRegimeLimits(vixLevel) {
        if (vixLevel < 13) return { regime: 'LOW', min: 40, max: 50 };
        if (vixLevel < 18) return { regime: 'NORMAL', min: 60, max: 70 };
        if (vixLevel < 25) return { regime: 'ELEVATED', min: 75, max: 80 };
        if (vixLevel < 30) return { regime: 'HIGH', min: 50, max: 60 };
        return { regime: 'CRISIS', min: 80, max: 80 };
    }
    
    calculatePhaseBPOptimization(currentBP, phase, vixRegime, availableSlots, dayOfWeek) {
        let targetRange = vixRegime;
        
        if (phase === 1) targetRange = { min: 40, max: 50 };
        else if (phase === 2) targetRange = { min: 55, max: 65 };
        else if (phase === 3) targetRange = { min: 60, max: 75 };
        
        const gap = targetRange.min - currentBP;
        if (gap <= 0) {
            return {
                needed: false,
                message: `Already at ${currentBP}% - within Phase ${phase} target`,
                plan: []
            };
        }
        
        const plan = [];
        let projectedBP = currentBP;
        
        availableSlots.forEach(slot => {
            if (projectedBP >= targetRange.min) return;
            if (slot.availablePos > 0) {
                const positionsNeeded = Math.min(
                    slot.availablePos,
                    Math.ceil((targetRange.min - projectedBP) / slot.bpPerPos)
                );
                
                if (positionsNeeded > 0) {
                    plan.push({
                        strategy: slot.strategy,
                        positions: positionsNeeded,
                        bpAdded: positionsNeeded * slot.bpPerPos,
                        when: slot.priority === 'TODAY' || slot.priority.includes('TODAY') ? 
                              'TODAY' : `Next ${this.getNextDayForStrategy(slot.strategy)}`
                    });
                    projectedBP += positionsNeeded * slot.bpPerPos;
                }
            }
        });
        
        return {
            needed: true,
            currentBP,
            targetMin: targetRange.min,
            gap,
            projectedBP,
            plan
        };
    }
    
    getNextDayForStrategy(strategy) {
        const map = {
            '0DTE': 'Friday',
            'LT112': 'Wednesday',
            'STRANGLE': 'Tuesday',
            'LEAP': 'Monday',
            'IPMCC': 'Friday'
        };
        return map[strategy] || 'Any day';
    }
    
    estimateBPForPosition(ticker, strategy) {
        const isMicro = ticker.startsWith('M') || ticker === 'MCL' || ticker === 'MGC';
        const bpMap = {
            'STRANGLE': isMicro ? 2.5 : 3.5,
            'LT112': ticker === 'ES' ? 6 : ticker === 'MES' ? 3 : 4,
            'IPMCC': 8,
            '0DTE': 2,
            'LEAP': 2,
            'BUTTERFLY': 0.5,
            'RATIO': 2,
            'DIAGONAL': 1.5,
            'BOX': 0
        };
        return bpMap[strategy.toUpperCase()] || 3;
    }
    
    determineDirection(esData) {
        if (!esData) return 'UNKNOWN';
        const change = esData.currentPrice - esData.previousClose;
        if (Math.abs(change) < 5) return 'NEUTRAL';
        return change > 0 ? 'BULLISH' : 'BEARISH';
    }
    
    extractHour(timeStr) {
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
        if (match) {
            let hour = parseInt(match[1]);
            const minute = parseInt(match[2]);
            const ampm = match[3];
            
            if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
            if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
            
            return hour + (minute / 60);
        }
        return 10;
    }

    /**
     * COMPREHENSIVE ANALYSIS RUNNER
     * Executes all v14 functionality checks
     */
    async runComprehensiveAnalysis(userData, marketData = {}) {
        console.log('\n================================================================================');
        console.log('                    TOM KING FRAMEWORK v14 COMPLETE ANALYSIS                    ');
        console.log('================================================================================\n');
        
        const results = {
            fridayAnalysis: null,
            allocationTable: null,
            correlationCheck: null,
            capitalRecycling: null,
            vixSpike: null
        };
        
        // 1. Friday Pre-Market Analysis (if Friday)
        if (userData.dayOfWeek === 'Friday') {
            results.fridayAnalysis = await this.runFridayPreMarketAnalysis(marketData, userData.timeStr || '10:15 AM');
        }
        
        // 2. Position Allocation Table
        results.allocationTable = this.generatePositionAllocationTable(userData);
        
        // 3. August 2024 Correlation Check
        results.correlationCheck = this.checkAugust2024Rules(userData.positions || []);
        
        // 4. Capital Recycling Opportunities
        results.capitalRecycling = this.identifyCapitalRecycling(userData.positions || []);
        
        // 5. VIX Spike Protocol Check
        results.vixSpike = this.checkVIXSpikeProtocol(userData.vixLevel || 16, userData.accountValue);
        
        console.log('\n================================================================================');
        console.log('                              ANALYSIS COMPLETE                                 ');
        console.log('================================================================================\n');
        
        return results;
    }
}

module.exports = V14CompleteFunctionality;