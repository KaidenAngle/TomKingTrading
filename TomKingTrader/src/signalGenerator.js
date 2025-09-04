/**
 * Signal Generator Module
 * Real-time entry/exit signal generation for Tom King Trading Framework
 */

const EventEmitter = require('events');
const { TradingStrategies } = require('./strategies');
const { EnhancedPatternAnalyzer } = require('./enhancedPatternAnalysis');
const { PositionManager } = require('./positionManager');
const { RiskManager } = require('./riskManager');
const { GreeksCalculator } = require('./greeksCalculator');

class SignalGenerator extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Apply configuration options
        this.config = {
            enableRealTime: options.enableRealTime || false,
            signalCooldown: options.signalCooldown || 300000, // 5 minutes default
            maxSignalsPerHour: options.maxSignalsPerHour || 20,
            ...options
        };
        
        this.strategies = new TradingStrategies();
        this.patternAnalysis = new EnhancedPatternAnalyzer();
        this.positionManager = new PositionManager();
        this.riskManager = new RiskManager();
        this.greeksCalc = new GreeksCalculator();
        
        this.signals = [];
        this.alerts = [];
        this.lastAnalysis = null;
        this.monitoringInterval = null;
    }

    /**
     * Start real-time signal monitoring
     */
    startMonitoring(intervalMs = 60000) { // Default 1 minute
        console.log('Starting signal monitoring...');
        
        this.monitoringInterval = setInterval(() => {
            this.generateSignals();
        }, intervalMs);
        
        // Run immediately
        this.generateSignals();
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            console.log('Signal monitoring stopped');
        }
    }

    /**
     * Generate signals based on current market data and account state
     */
    async generateSignals(marketData = null, accountData = null) {
        try {
            // Clear previous signals
            this.signals = [];
            this.alerts = [];
            
            const timestamp = new Date();
            const dayOfWeek = timestamp.toLocaleDateString('en-US', { weekday: 'long' });
            const timeStr = timestamp.toTimeString().slice(0, 5);
            const hour = timestamp.getHours();
            const minute = timestamp.getMinutes();
            
            // Run pre-market analysis if in pre-market hours
            if (this.isPreMarketHours(hour, minute)) {
                const preMarketAnalysis = await this.runPreMarketAnalysis(marketData, accountData);
                if (preMarketAnalysis.alerts) {
                    this.alerts.push(...preMarketAnalysis.alerts);
                }
            }
            
            // Check if market is open
            if (!this.isMarketOpen(timestamp)) {
                this.addAlert('INFO', 'Market closed - monitoring continues');
                return this.getSignalReport();
            }
            
            // Generate entry signals
            const entrySignals = await this.generateEntrySignals(marketData, accountData, dayOfWeek, hour, minute);
            
            // Generate exit signals for existing positions
            const exitSignals = await this.generateExitSignals(accountData?.positions || []);
            
            // Generate time-sensitive alerts
            const timeAlerts = this.generateTimeAlerts(dayOfWeek, hour, minute);
            
            // Combine and rank all signals
            this.signals = [...entrySignals, ...exitSignals];
            this.rankSignalsByPriority();
            
            // Add time alerts
            this.alerts.push(...timeAlerts);
            
            // Emit signals for real-time updates
            this.emit('signals', this.getSignalReport());
            
            // Store last analysis
            this.lastAnalysis = {
                timestamp,
                signalCount: this.signals.length,
                alertCount: this.alerts.length
            };
            
            return this.getSignalReport();
            
        } catch (error) {
            console.error('Signal generation error:', error);
            this.addAlert('ERROR', `Signal generation failed: ${error.message}`);
            return this.getSignalReport();
        }
    }
    
    /**
     * Check if in pre-market hours
     */
    isPreMarketHours(hour, minute) {
        // Pre-market: 8:00 AM - 9:30 AM EST
        const totalMinutes = hour * 60 + minute;
        const preMarketStart = 8 * 60; // 8:00 AM
        const marketOpen = 9 * 60 + 30; // 9:30 AM
        
        return totalMinutes >= preMarketStart && totalMinutes < marketOpen;
    }
    
    /**
     * Run comprehensive pre-market analysis
     */
    async runPreMarketAnalysis(marketData, accountData) {
        const analysis = {
            timestamp: new Date(),
            alerts: [],
            opportunities: [],
            risks: [],
            todaysSetup: {},
            marketConditions: {}
        };
        
        try {
            // 1. Analyze overnight gaps
            const gapAnalysis = this.analyzeOvernightGaps(marketData);
            if (gapAnalysis.significantGap) {
                analysis.alerts.push({
                    type: 'PRE_MARKET',
                    severity: 'HIGH',
                    message: `Significant ${gapAnalysis.direction} gap: ${gapAnalysis.gapPercent.toFixed(2)}%`,
                    data: gapAnalysis
                });
            }
            
            // 2. Check economic calendar
            const economicEvents = this.checkEconomicCalendar();
            if (economicEvents.highImpact.length > 0) {
                analysis.alerts.push({
                    type: 'ECONOMIC_EVENT',
                    severity: 'HIGH',
                    message: `${economicEvents.highImpact.length} high-impact events today`,
                    events: economicEvents.highImpact
                });
            }
            
            // 3. Analyze futures positioning
            const futuresAnalysis = this.analyzeFuturesPositioning(marketData);
            analysis.marketConditions.futures = futuresAnalysis;
            
            // 4. Check VIX term structure
            const vixAnalysis = this.analyzeVIXTermStructure(marketData);
            if (vixAnalysis.backwardation) {
                analysis.alerts.push({
                    type: 'VIX_STRUCTURE',
                    severity: 'MEDIUM',
                    message: 'VIX in backwardation - elevated risk',
                    data: vixAnalysis
                });
            }
            
            // 5. Identify today's trading opportunities
            const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            analysis.opportunities = this.identifyTodaysOpportunities(dayOfWeek, marketData, accountData);
            
            // 6. Check for earnings/dividends
            const corporateEvents = this.checkCorporateEvents(accountData?.positions);
            if (corporateEvents.warnings.length > 0) {
                analysis.alerts.push(...corporateEvents.warnings);
            }
            
            // 7. Assess correlation risks
            const correlationRisk = this.assessPreMarketCorrelation(marketData);
            if (correlationRisk.elevated) {
                analysis.risks.push({
                    type: 'CORRELATION',
                    level: correlationRisk.level,
                    message: 'Elevated correlation detected',
                    affectedGroups: correlationRisk.groups
                });
            }
            
            // 8. Generate today's game plan
            analysis.todaysSetup = this.generateTodaysGamePlan(
                dayOfWeek,
                marketData,
                accountData,
                analysis.opportunities,
                analysis.risks
            );
            
            // 9. Position health check
            if (accountData?.positions?.length > 0) {
                const positionHealth = this.checkPositionHealth(accountData.positions, marketData);
                if (positionHealth.needsAttention.length > 0) {
                    analysis.alerts.push({
                        type: 'POSITION_HEALTH',
                        severity: 'MEDIUM',
                        message: `${positionHealth.needsAttention.length} positions need attention`,
                        positions: positionHealth.needsAttention
                    });
                }
            }
            
            // 10. Market regime assessment
            const marketRegime = this.assessMarketRegime(marketData);
            analysis.marketConditions.regime = marketRegime;
            
            return analysis;
            
        } catch (error) {
            console.error('Pre-market analysis error:', error);
            analysis.alerts.push({
                type: 'ERROR',
                severity: 'LOW',
                message: 'Partial pre-market analysis due to error',
                error: error.message
            });
            return analysis;
        }
    }
    
    /**
     * Analyze overnight gaps
     */
    analyzeOvernightGaps(marketData) {
        const gaps = {};
        const significantGapThreshold = 0.5; // 0.5%
        
        for (const [symbol, data] of Object.entries(marketData || {})) {
            if (data.previousClose && data.openPrice) {
                const gapPercent = ((data.openPrice - data.previousClose) / data.previousClose) * 100;
                
                if (Math.abs(gapPercent) >= significantGapThreshold) {
                    gaps[symbol] = {
                        gapPercent,
                        direction: gapPercent > 0 ? 'UP' : 'DOWN',
                        fillProbability: this.calculateGapFillProbability(gapPercent),
                        tradingOpportunity: Math.abs(gapPercent) > 1
                    };
                }
            }
        }
        
        const largestGap = Object.values(gaps).reduce((max, gap) => 
            Math.abs(gap.gapPercent) > Math.abs(max?.gapPercent || 0) ? gap : max, null
        );
        
        return {
            gaps,
            significantGap: Object.keys(gaps).length > 0,
            largestGap,
            ...largestGap
        };
    }
    
    /**
     * Calculate gap fill probability
     */
    calculateGapFillProbability(gapPercent) {
        // Historical probabilities
        const absGap = Math.abs(gapPercent);
        
        if (absGap < 0.5) return 0.65;
        if (absGap < 1.0) return 0.55;
        if (absGap < 1.5) return 0.45;
        if (absGap < 2.0) return 0.35;
        return 0.25;
    }
    
    /**
     * Check economic calendar
     */
    checkEconomicCalendar() {
        const today = new Date().toDateString();
        
        // Simulated economic events - in production, fetch from API
        const events = {
            highImpact: [],
            mediumImpact: [],
            lowImpact: []
        };
        
        // Check for major events
        const dayOfWeek = new Date().getDay();
        
        // Fed days (typically Tuesday/Wednesday)
        if (dayOfWeek === 2 || dayOfWeek === 3) {
            // Check if it's around mid-month (Fed meeting days)
            const dayOfMonth = new Date().getDate();
            if (dayOfMonth >= 14 && dayOfMonth <= 16) {
                events.highImpact.push({
                    time: '14:00',
                    event: 'FOMC Decision',
                    impact: 'HIGH',
                    tradingImplication: 'Avoid new positions until after announcement'
                });
            }
        }
        
        // Jobs Friday (first Friday)
        if (dayOfWeek === 5) {
            const dayOfMonth = new Date().getDate();
            if (dayOfMonth <= 7) {
                events.highImpact.push({
                    time: '08:30',
                    event: 'Non-Farm Payrolls',
                    impact: 'HIGH',
                    tradingImplication: 'Expect volatility at open'
                });
            }
        }
        
        // CPI/PPI (typically mid-month)
        const dayOfMonth = new Date().getDate();
        if (dayOfMonth >= 10 && dayOfMonth <= 15) {
            events.mediumImpact.push({
                time: '08:30',
                event: 'Inflation Data',
                impact: 'MEDIUM',
                tradingImplication: 'Monitor for trend changes'
            });
        }
        
        return events;
    }
    
    /**
     * Analyze futures positioning
     */
    analyzeFuturesPositioning(marketData) {
        const analysis = {
            sentiment: 'NEUTRAL',
            strength: 0,
            divergences: []
        };
        
        if (!marketData) return analysis;
        
        // Compare ES, NQ, RTY movements
        const es = marketData.ES;
        const nq = marketData.NQ || marketData.MNQ;
        const rty = marketData.RTY;
        
        if (es && nq) {
            const esChange = ((es.currentPrice - es.previousClose) / es.previousClose) * 100;
            const nqChange = ((nq.currentPrice - nq.previousClose) / nq.previousClose) * 100;
            
            // Check for divergence
            if (Math.sign(esChange) !== Math.sign(nqChange)) {
                analysis.divergences.push({
                    type: 'ES_NQ',
                    message: 'Tech/broad market divergence',
                    opportunity: 'Consider pairs trade'
                });
            }
            
            // Overall sentiment
            const avgChange = (esChange + nqChange) / 2;
            if (avgChange > 0.3) {
                analysis.sentiment = 'BULLISH';
                analysis.strength = Math.min(avgChange / 2, 1);
            } else if (avgChange < -0.3) {
                analysis.sentiment = 'BEARISH';
                analysis.strength = Math.min(Math.abs(avgChange) / 2, 1);
            }
        }
        
        return analysis;
    }
    
    /**
     * Analyze VIX term structure
     */
    analyzeVIXTermStructure(marketData) {
        const vix = marketData?.VIX;
        if (!vix) {
            return { available: false };
        }
        
        // Simplified term structure analysis
        const analysis = {
            currentLevel: vix.currentPrice,
            regime: this.getVIXRegime(vix.currentPrice),
            backwardation: false,
            contango: true,
            tradingImplication: ''
        };
        
        // Check for backwardation (front month > back month)
        // This would need real VIX futures data in production
        if (vix.currentPrice > 30) {
            analysis.backwardation = true;
            analysis.contango = false;
            analysis.tradingImplication = 'Favor put selling over call selling';
        } else if (vix.currentPrice < 15) {
            analysis.tradingImplication = 'Reduce position sizes - low premium environment';
        } else {
            analysis.tradingImplication = 'Normal premium selling environment';
        }
        
        return analysis;
    }
    
    /**
     * Get VIX regime
     */
    getVIXRegime(vixLevel) {
        if (vixLevel < 12) return 'EXTREMELY_LOW';
        if (vixLevel < 16) return 'LOW';
        if (vixLevel < 20) return 'NORMAL';
        if (vixLevel < 25) return 'ELEVATED';
        if (vixLevel < 30) return 'HIGH';
        return 'EXTREME';
    }
    
    /**
     * Identify today's opportunities
     */
    identifyTodaysOpportunities(dayOfWeek, marketData, accountData) {
        const opportunities = [];
        const vix = marketData?.VIX?.currentPrice || 20;
        
        // Friday 0DTE
        if (dayOfWeek === 'Friday' && vix > 22) {
            opportunities.push({
                strategy: '0DTE',
                priority: 'HIGH',
                timeWindow: '10:30 AM - 2:00 PM',
                requirements: 'Wait for direction after open',
                expectedReturn: '8-12%'
            });
        }
        
        // Tuesday Strangles
        if (dayOfWeek === 'Tuesday') {
            opportunities.push({
                strategy: 'STRANGLE',
                priority: 'MEDIUM',
                timeWindow: 'After 10:00 AM',
                requirements: 'Check correlation limits',
                expectedReturn: '3-5% monthly'
            });
        }
        
        // Monday/Wednesday LT112
        if (['Monday', 'Wednesday'].includes(dayOfWeek)) {
            opportunities.push({
                strategy: 'LT112',
                priority: 'MEDIUM',
                timeWindow: 'Any time',
                requirements: 'Find 112 DTE expiration',
                expectedReturn: '12-15% over cycle'
            });
        }
        
        return opportunities;
    }
    
    /**
     * Check corporate events
     */
    checkCorporateEvents(positions) {
        const warnings = [];
        
        // In production, check against earnings/dividend calendar
        // For now, return empty
        
        return { warnings };
    }
    
    /**
     * Assess pre-market correlation
     */
    assessPreMarketCorrelation(marketData) {
        // Simplified correlation check
        const correlationLevel = 0.5; // Would calculate from actual data
        
        return {
            elevated: correlationLevel > 0.7,
            level: correlationLevel,
            groups: correlationLevel > 0.7 ? ['EQUITY'] : []
        };
    }
    
    /**
     * Generate today's game plan
     */
    generateTodaysGamePlan(dayOfWeek, marketData, accountData, opportunities, risks) {
        const vix = marketData?.VIX?.currentPrice || 20;
        const phase = accountData?.phase || 1;
        
        const plan = {
            focusStrategies: [],
            avoidList: [],
            positionSizing: '',
            riskManagement: '',
            keyLevels: {},
            timeline: []
        };
        
        // Determine focus based on day
        if (dayOfWeek === 'Friday') {
            plan.focusStrategies.push('0DTE if VIX > 22');
            plan.timeline.push({ time: '10:30', action: 'Assess 0DTE setup' });
            plan.timeline.push({ time: '14:00', action: 'Final 0DTE entry cutoff' });
        }
        
        if (dayOfWeek === 'Tuesday') {
            plan.focusStrategies.push('Futures strangles');
            plan.timeline.push({ time: '10:00', action: 'Begin strangle analysis' });
        }
        
        // Position sizing based on VIX
        if (vix < 15) {
            plan.positionSizing = 'Reduce sizes by 20% - low volatility';
        } else if (vix > 30) {
            plan.positionSizing = 'Opportunity zone - can increase put selling';
        } else {
            plan.positionSizing = 'Normal position sizing';
        }
        
        // Risk management
        plan.riskManagement = `Max BP: ${this.getMaxBPForVIX(vix)}%, Correlation limit: ${phase <= 2 ? 2 : 3}`;
        
        // Key levels for ES
        if (marketData?.ES) {
            const es = marketData.ES;
            plan.keyLevels = {
                resistance: es.currentPrice * 1.005,
                support: es.currentPrice * 0.995,
                pivotPoint: es.openPrice
            };
        }
        
        return plan;
    }
    
    /**
     * Get max BP for VIX level
     */
    getMaxBPForVIX(vixLevel) {
        if (vixLevel < 13) return 45;
        if (vixLevel < 18) return 65;
        if (vixLevel < 25) return 75;
        return 80;
    }
    
    /**
     * Check position health
     */
    checkPositionHealth(positions, marketData) {
        const needsAttention = [];
        
        positions.forEach(position => {
            const health = {
                symbol: position.symbol,
                issues: []
            };
            
            // Check if approaching 21 DTE
            if (position.dte <= 21 && position.dte > 0) {
                health.issues.push('Approaching 21 DTE management point');
            }
            
            // Check if breached
            if (position.delta && Math.abs(position.delta) > 30) {
                health.issues.push('Delta exceeds comfort zone');
            }
            
            // Check P&L targets
            if (position.pnlPercent >= 50) {
                health.issues.push('Profit target reached - consider closing');
            } else if (position.pnlPercent <= -100) {
                health.issues.push('Stop loss area - evaluate adjustment');
            }
            
            if (health.issues.length > 0) {
                needsAttention.push(health);
            }
        });
        
        return { needsAttention };
    }
    
    /**
     * Assess market regime
     */
    assessMarketRegime(marketData) {
        const vix = marketData?.VIX?.currentPrice || 20;
        
        let regime = 'NORMAL';
        let characteristics = [];
        
        if (vix < 15) {
            regime = 'LOW_VOLATILITY';
            characteristics = ['Grinding higher', 'Sell call spreads carefully', 'Smaller profits expected'];
        } else if (vix > 25) {
            regime = 'HIGH_VOLATILITY';
            characteristics = ['Two-way action', 'Rich premiums', 'Manage positions actively'];
        } else {
            characteristics = ['Balanced market', 'Follow normal rules', 'Standard position sizing'];
        }
        
        return {
            regime,
            characteristics,
            vixLevel: vix,
            tradingApproach: this.getTradingApproachForRegime(regime)
        };
    }
    
    /**
     * Get trading approach for regime
     */
    getTradingApproachForRegime(regime) {
        const approaches = {
            'LOW_VOLATILITY': 'Focus on highest probability setups only, reduce size',
            'NORMAL': 'Deploy standard strategy mix per Tom King hierarchy',
            'HIGH_VOLATILITY': 'Aggressive put selling, avoid call side, use full BP allowance'
        };
        
        return approaches[regime] || approaches['NORMAL'];
    }

    /**
     * Generate entry signals
     */
    async generateEntrySignals(marketData, accountData, dayOfWeek, hour, minute) {
        const signals = [];
        
        if (!marketData || !accountData) {
            return signals;
        }
        
        // Check 0DTE opportunities (Friday only)
        if (dayOfWeek === 'Friday' && hour >= 10 && minute >= 30) {
            const signal = this.check0DTESignal(marketData, accountData);
            if (signal) signals.push(signal);
        }
        
        // Check LT112 opportunities (Mon-Wed)
        if (['Monday', 'Tuesday', 'Wednesday'].includes(dayOfWeek)) {
            const signal = this.checkLT112Signal(marketData, accountData);
            if (signal) signals.push(signal);
        }
        
        // Check Strangle opportunities (Tuesday)
        if (dayOfWeek === 'Tuesday') {
            const strangleSignals = this.checkStrangleSignals(marketData, accountData);
            signals.push(...strangleSignals);
        }
        
        // Check IPMCC opportunities (Any day)
        const ipmccSignals = this.checkIPMCCSignals(marketData, accountData);
        signals.push(...ipmccSignals);
        
        // Check pattern-based signals
        const patternSignals = this.checkPatternSignals(marketData, accountData);
        signals.push(...patternSignals);
        
        // Apply risk filters
        return this.applyRiskFilters(signals, accountData);
    }

    /**
     * Check 0DTE signal
     */
    check0DTESignal(marketData, accountData) {
        const esData = marketData.ES;
        if (!esData) return null;
        
        const moveFromOpen = ((esData.currentPrice - esData.openPrice) / esData.openPrice) * 100;
        
        if (Math.abs(moveFromOpen) < 0.5) {
            return null; // No signal if move < 0.5%
        }
        
        const direction = moveFromOpen > 0.5 ? 'CALL' : 'PUT';
        const contracts = this.calculate0DTEContracts(accountData.phase);
        
        return {
            type: 'ENTRY',
            strategy: '0DTE',
            symbol: 'ES',
            direction,
            action: `Sell ${direction} spread`,
            priority: 'IMMEDIATE',
            timeDecay: 'EXTREME',
            contracts,
            expectedReturn: 8.5,
            winRate: 88, // Tom King's actual 0DTE rate
            risk: 'HIGH',
            expiry: 'TODAY',
            management: {
                stopLoss: '2x credit',
                profitTarget: 'Let expire',
                timeStop: '3:30 PM'
            },
            score: 95,
            timestamp: new Date()
        };
    }

    /**
     * Check LT112 signal
     */
    checkLT112Signal(marketData, accountData) {
        if (accountData.phase < 2) return null;
        
        const ticker = accountData.phase >= 3 ? 'ES' : 'MES';
        const data = marketData[ticker];
        
        if (!data) return null;
        
        // Check pattern quality
        const patternScore = this.patternAnalysis.analyzePattern(ticker, data);
        
        if (patternScore.quality !== 'EXCELLENT' && patternScore.quality !== 'GOOD') {
            return null;
        }
        
        return {
            type: 'ENTRY',
            strategy: 'LT112',
            symbol: ticker,
            action: 'Sell 120 DTE put spread',
            priority: 'HIGH',
            contracts: ticker === 'MES' ? 4 : 1,
            expectedReturn: 12,
            winRate: 73, // Tom King's actual LT112 rate
            risk: 'MEDIUM',
            dte: 112,
            management: {
                week8: 'Monetize hedge',
                week12: 'Roll if tested',
                profitTarget: '75% at week 14'
            },
            patternQuality: patternScore.quality,
            score: patternScore.score,
            timestamp: new Date()
        };
    }

    /**
     * Check Strangle signals
     */
    checkStrangleSignals(marketData, accountData) {
        const signals = [];
        const qualifiedTickers = this.getQualifiedTickersByPhase(accountData.phase);
        
        qualifiedTickers.forEach(ticker => {
            const data = marketData[ticker];
            if (!data) return;
            
            // Check IV rank
            if (data.ivRank < 30) return;
            
            // Check pattern
            const pattern = this.patternAnalysis.analyzePattern(ticker, data);
            if (pattern.score < 60) return;
            
            // Check correlation group limits
            const correlationGroup = this.positionManager.getCorrelationGroup(ticker);
            const groupPositions = this.positionManager.getCorrelationGroupCount(correlationGroup, accountData.positions);
            
            if (groupPositions >= 3) return;
            
            signals.push({
                type: 'ENTRY',
                strategy: 'STRANGLE',
                symbol: ticker,
                action: 'Sell 90 DTE 5-delta strangle',
                priority: pattern.quality === 'EXCELLENT' ? 'HIGH' : 'MEDIUM',
                expectedReturn: 15,
                winRate: 72, // Tom King's actual strangle rate
                risk: 'MEDIUM',
                dte: 90,
                ivRank: data.ivRank,
                management: {
                    profitTarget: '50%',
                    stopLoss: '2x credit',
                    dteManagement: '21 DTE'
                },
                patternQuality: pattern.quality,
                score: pattern.score,
                timestamp: new Date()
            });
        });
        
        return signals;
    }

    /**
     * Check IPMCC signals
     */
    checkIPMCCSignals(marketData, accountData) {
        const signals = [];
        const etfs = ['SPY', 'QQQ', 'IWM'];
        
        etfs.forEach(ticker => {
            const data = marketData[ticker];
            if (!data) return;
            
            // Check trend
            if (data.ema8 <= data.ema21) return; // Need uptrend
            
            // Check IV environment
            if (data.iv < 12 || data.iv > 30) return; // Optimal IV range
            
            signals.push({
                type: 'ENTRY',
                strategy: 'IPMCC',
                symbol: ticker,
                action: 'Buy LEAP call, sell weekly calls',
                priority: 'LOW',
                expectedReturn: 6,
                winRate: 75,
                risk: 'LOW',
                management: {
                    weeklyRoll: 'Up and out if tested',
                    leapAdjustment: 'Roll if <50 delta',
                    exitTarget: '50% cost recovery'
                },
                trend: 'UPTREND',
                iv: data.iv,
                score: 70,
                timestamp: new Date()
            });
        });
        
        return signals;
    }

    /**
     * Check pattern-based signals
     */
    checkPatternSignals(marketData, accountData) {
        const signals = [];
        
        Object.keys(marketData).forEach(ticker => {
            const data = marketData[ticker];
            if (!data) return;
            
            const pattern = this.patternAnalysis.analyzePattern(ticker, data);
            
            if (pattern.quality === 'EXCELLENT') {
                // Generate signal based on pattern
                signals.push({
                    type: 'ENTRY',
                    strategy: 'PATTERN',
                    symbol: ticker,
                    action: pattern.recommendation,
                    priority: 'HIGH',
                    patternType: pattern.type,
                    patternQuality: pattern.quality,
                    score: pattern.score,
                    risk: this.assessPatternRisk(pattern),
                    timestamp: new Date()
                });
            }
        });
        
        return signals;
    }

    /**
     * Generate exit signals for existing positions
     */
    async generateExitSignals(positions = []) {
        const signals = [];
        
        positions.forEach(position => {
            // Check profit target
            if (position.pl >= position.profitTarget) {
                signals.push({
                    type: 'EXIT',
                    strategy: position.strategy,
                    symbol: position.ticker,
                    action: 'CLOSE - Profit target reached',
                    priority: 'HIGH',
                    currentPL: position.pl,
                    target: position.profitTarget,
                    reason: 'PROFIT_TARGET',
                    timestamp: new Date()
                });
            }
            
            // Check stop loss
            if (position.pl <= -position.stopLoss) {
                signals.push({
                    type: 'EXIT',
                    strategy: position.strategy,
                    symbol: position.ticker,
                    action: 'CLOSE - Stop loss triggered',
                    priority: 'IMMEDIATE',
                    currentPL: position.pl,
                    stopLoss: position.stopLoss,
                    reason: 'STOP_LOSS',
                    timestamp: new Date()
                });
            }
            
            // Check 21 DTE rule
            if (position.dte <= 21 && position.strategy === 'STRANGLE') {
                signals.push({
                    type: 'EXIT',
                    strategy: position.strategy,
                    symbol: position.ticker,
                    action: 'MANAGE - 21 DTE reached',
                    priority: 'HIGH',
                    currentDTE: position.dte,
                    reason: 'DTE_MANAGEMENT',
                    timestamp: new Date()
                });
            }
            
            // Check defensive adjustments
            const health = this.positionManager.calculatePositionHealth(position);
            if (health.score < 30) {
                signals.push({
                    type: 'ADJUST',
                    strategy: position.strategy,
                    symbol: position.ticker,
                    action: health.action,
                    priority: 'HIGH',
                    healthScore: health.score,
                    reason: 'DEFENSIVE_ADJUSTMENT',
                    timestamp: new Date()
                });
            }
        });
        
        return signals;
    }

    /**
     * Generate time-sensitive alerts
     */
    generateTimeAlerts(dayOfWeek, hour, minute) {
        const alerts = [];
        const totalMinutes = hour * 60 + minute;
        
        // 0DTE alerts
        if (dayOfWeek === 'Friday') {
            if (totalMinutes === 625) { // 10:25 AM
                alerts.push({
                    type: 'TIME_ALERT',
                    priority: 'HIGH',
                    message: '0DTE window opens in 5 minutes',
                    strategy: '0DTE',
                    timestamp: new Date()
                });
            }
            
            if (totalMinutes === 630) { // 10:30 AM
                alerts.push({
                    type: 'TIME_ALERT',
                    priority: 'IMMEDIATE',
                    message: '0DTE WINDOW NOW OPEN - Check ES movement',
                    strategy: '0DTE',
                    timestamp: new Date()
                });
            }
            
            if (totalMinutes === 930) { // 3:30 PM
                alerts.push({
                    type: 'TIME_ALERT',
                    priority: 'IMMEDIATE',
                    message: '0DTE final management window',
                    strategy: '0DTE',
                    timestamp: new Date()
                });
            }
        }
        
        // Market close alerts
        if (totalMinutes === 945) { // 3:45 PM
            alerts.push({
                type: 'TIME_ALERT',
                priority: 'HIGH',
                message: 'Market closes in 15 minutes',
                timestamp: new Date()
            });
        }
        
        return alerts;
    }

    /**
     * Apply risk filters to signals
     */
    applyRiskFilters(signals, accountData) {
        const filtered = [];
        
        signals.forEach(signal => {
            // Check buying power
            const bpRequired = this.calculateBPRequired(signal);
            if (accountData.availableBP < bpRequired) {
                signal.blocked = true;
                signal.blockReason = 'Insufficient buying power';
            }
            
            // Check correlation limits
            const correlationCheck = this.checkCorrelationLimits(signal, accountData);
            if (!correlationCheck.passed) {
                signal.blocked = true;
                signal.blockReason = correlationCheck.reason;
            }
            
            // Check VIX regime
            const vixCheck = this.checkVIXRegime(signal, accountData);
            if (!vixCheck.passed) {
                signal.blocked = true;
                signal.blockReason = vixCheck.reason;
            }
            
            filtered.push(signal);
        });
        
        return filtered;
    }

    /**
     * Rank signals by priority and expected value
     */
    rankSignalsByPriority() {
        this.signals.sort((a, b) => {
            // Priority levels
            const priorityOrder = { 'IMMEDIATE': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
            const priorityA = priorityOrder[a.priority] || 0;
            const priorityB = priorityOrder[b.priority] || 0;
            
            if (priorityA !== priorityB) {
                return priorityB - priorityA;
            }
            
            // Then by score
            return (b.score || 0) - (a.score || 0);
        });
    }

    /**
     * Calculate BP required for signal
     */
    calculateBPRequired(signal) {
        const bpMap = {
            '0DTE': 4,
            'LT112': 3,
            'STRANGLE': 3,
            'IPMCC': 8,
            'LEAP': 5,
            'BUTTERFLY': 1.5,
            'RATIO': 2,
            'DIAGONAL': 4
        };
        
        return bpMap[signal.strategy] || 3;
    }

    /**
     * Check correlation limits
     */
    checkCorrelationLimits(signal, accountData) {
        const group = this.positionManager.getCorrelationGroup(signal.symbol);
        const currentCount = this.positionManager.getCorrelationGroupCount(group, accountData.positions);
        const limit = accountData.phase >= 4 ? 3 : 2;
        
        if (currentCount >= limit) {
            return {
                passed: false,
                reason: `Correlation group ${group} at limit (${currentCount}/${limit})`
            };
        }
        
        return { passed: true };
    }

    /**
     * Check VIX regime restrictions
     */
    checkVIXRegime(signal, accountData) {
        const vixLevel = accountData.vixLevel || 15;
        
        // High VIX restrictions
        if (vixLevel > 30 && signal.strategy !== 'STRANGLE') {
            return {
                passed: false,
                reason: `VIX >30: Only strangles allowed`
            };
        }
        
        // Low VIX restrictions
        if (vixLevel < 12 && signal.strategy === 'STRANGLE') {
            return {
                passed: false,
                reason: `VIX <12: Strangles not optimal`
            };
        }
        
        return { passed: true };
    }

    /**
     * Calculate 0DTE contracts by phase
     */
    calculate0DTEContracts(phase) {
        const contracts = { 1: 1, 2: 2, 3: 3, 4: 5 };
        return contracts[phase] || 1;
    }

    /**
     * Get qualified tickers by phase
     */
    getQualifiedTickersByPhase(phase) {
        const tickers = {
            1: ['MCL', 'MGC', 'GLD', 'TLT'],
            2: ['MCL', 'MGC', 'MES', 'MNQ', '6A', 'SLV'],
            3: ['CL', 'GC', 'ES', 'NQ', 'ZC', 'ZS'],
            4: ['CL', 'GC', 'ES', 'NQ', 'SI', 'HG', 'ZB', '6E']
        };
        return tickers[phase] || tickers[1];
    }

    /**
     * Assess pattern risk
     */
    assessPatternRisk(pattern) {
        if (pattern.score > 90) return 'LOW';
        if (pattern.score > 70) return 'MEDIUM';
        return 'HIGH';
    }

    /**
     * Check if market is open
     */
    isMarketOpen(timestamp) {
        const day = timestamp.getDay();
        const hour = timestamp.getHours();
        const minute = timestamp.getMinutes();
        const totalMinutes = hour * 60 + minute;
        
        // Closed on weekends
        if (day === 0 || day === 6) return false;
        
        // Market hours: 9:30 AM - 4:00 PM EST
        if (totalMinutes < 570 || totalMinutes > 960) return false;
        
        return true;
    }

    /**
     * Add alert
     */
    addAlert(type, message) {
        this.alerts.push({
            type,
            message,
            timestamp: new Date()
        });
    }

    /**
     * Get signal report
     */
    getSignalReport() {
        return {
            timestamp: new Date(),
            signals: this.signals,
            alerts: this.alerts,
            summary: {
                totalSignals: this.signals.length,
                entrySignals: this.signals.filter(s => s.type === 'ENTRY').length,
                exitSignals: this.signals.filter(s => s.type === 'EXIT').length,
                adjustmentSignals: this.signals.filter(s => s.type === 'ADJUST').length,
                blockedSignals: this.signals.filter(s => s.blocked).length,
                immediateActions: this.signals.filter(s => s.priority === 'IMMEDIATE').length,
                highPriority: this.signals.filter(s => s.priority === 'HIGH').length
            }
        };
    }
}

module.exports = { SignalGenerator };