/**
 * IPMCC Strategy Implementation
 * Income Producing Married Call (IPMCC) - Complete Tom King Implementation
 * 
 * Strategy Overview:
 * - Buy LEAP call (70-80 delta, 6-12 months out)
 * - Sell weekly calls against the LEAP position
 * - Generate weekly income while maintaining upside potential
 * - Manage position when tested or assigned
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class IPMCCStrategy {
    constructor(config = {}) {
        this.config = {
            // LEAP parameters
            targetLeapDelta: config.targetLeapDelta || 0.75, // 70-80 delta for LEAP
            minLeapDTE: config.minLeapDTE || 180, // Minimum 6 months
            maxLeapDTE: config.maxLeapDTE || 365, // Maximum 12 months
            
            // Weekly call parameters
            targetWeeklyDelta: config.targetWeeklyDelta || 0.30, // 25-35 delta for weeklies
            weeklyDTE: config.weeklyDTE || 7, // 5-10 days typical
            
            // Position management
            maxPositionsPerETF: config.maxPositionsPerETF || 1,
            maxTotalPositions: config.maxTotalPositions || 4,
            minCreditPercent: config.minCreditPercent || 0.005, // 0.5% minimum weekly credit
            
            // Risk management
            maxRiskPerPosition: config.maxRiskPerPosition || 0.05, // 5% of account
            profitTargetPercent: config.profitTargetPercent || 0.20, // 20% profit on LEAP
            stopLossPercent: config.stopLossPercent || 0.30, // 30% loss on LEAP
            
            // Adjustment rules
            rollWeeklyDelta: config.rollWeeklyDelta || 0.20, // Roll at 20 delta
            rollLeapDelta: config.rollLeapDelta || 0.90, // Roll LEAP at 90 delta
            
            ...config
        };
        
        // Phase-based ETF qualification
        this.qualifiedETFs = {
            1: ['SPY', 'QQQ'],
            2: ['SPY', 'QQQ', 'IWM', 'DIA'],
            3: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE'],
            4: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'GLD', 'TLT', 'SMH', 'XLK']
        };
    }

    /**
     * Main analysis method for IPMCC opportunities
     */
    analyzeIPMCC(marketData, accountData, currentDate = new Date()) {
        const analysis = {
            timestamp: currentDate,
            strategy: 'IPMCC',
            opportunities: [],
            recommendations: [],
            existingPositions: this.analyzeExistingPositions(accountData.positions || [])
        };

        // Check day and time constraints
        const day = currentDate.getDay();
        const hour = currentDate.getHours();
        const minute = currentDate.getMinutes();

        // Tom King: Friday 9:15 AM entry
        if (day !== 5 || hour < 9 || (hour === 9 && minute < 15)) {
            analysis.recommendation = 'IPMCC entry on Friday at 9:15 AM only';
            return analysis;
        }

        // Get qualified ETFs for account phase
        const phase = accountData.phase || 1;
        const qualifiedETFs = this.qualifiedETFs[phase];

        logger.info('IPMCC', 'Analyzing opportunities', {
            phase,
            qualifiedETFs: qualifiedETFs.length,
            existingPositions: analysis.existingPositions.length
        });

        // Analyze each qualified ETF
        for (const ticker of qualifiedETFs) {
            // Skip if we already have an IPMCC on this ETF
            if (this.hasExistingIPMCC(accountData.positions, ticker)) {
                logger.debug('IPMCC', `Skipping ${ticker} - existing position`);
                continue;
            }

            const etfData = marketData[ticker];
            if (!etfData) {
                logger.warn('IPMCC', `No market data for ${ticker}`);
                continue;
            }

            const opportunity = this.evaluateIPMCCSetup(ticker, etfData, marketData, accountData);
            if (opportunity && opportunity.score >= 60) {
                analysis.opportunities.push(opportunity);
            }
        }

        // Sort opportunities by score
        analysis.opportunities.sort((a, b) => b.score - a.score);

        // Generate recommendations
        const maxNewPositions = this.config.maxTotalPositions - analysis.existingPositions.length;
        const topOpportunities = analysis.opportunities.slice(0, maxNewPositions);

        for (const opp of topOpportunities) {
            analysis.recommendations.push({
                action: 'OPEN_IPMCC',
                ticker: opp.ticker,
                leapStrike: opp.leapSetup.strike,
                leapExpiration: opp.leapSetup.expiration,
                weeklyStrike: opp.weeklySetup.strike,
                weeklyExpiration: opp.weeklySetup.expiration,
                totalCost: opp.totalCost,
                weeklyIncome: opp.weeklyIncome,
                score: opp.score
            });
        }

        // Manage existing positions
        for (const position of analysis.existingPositions) {
            const mgmt = this.manageExistingIPMCC(position, marketData[position.ticker]);
            if (mgmt.action) {
                analysis.recommendations.push(mgmt);
            }
        }

        return analysis;
    }

    /**
     * Evaluate IPMCC setup for a specific ETF
     */
    evaluateIPMCCSetup(ticker, etfData, marketData, accountData) {
        const setup = {
            ticker,
            timestamp: new Date(),
            score: 0,
            leapSetup: null,
            weeklySetup: null,
            totalCost: 0,
            weeklyIncome: 0,
            monthlyReturn: 0,
            annualizedReturn: 0
        };

        // Get option chain
        const optionChain = marketData.optionChain?.[ticker];
        if (!optionChain) {
            logger.warn('IPMCC', `No option chain for ${ticker}`);
            return null;
        }

        // Find LEAP expiration (6-12 months out)
        const leapExpiration = this.findLeapExpiration(optionChain);
        if (!leapExpiration) {
            logger.warn('IPMCC', `No suitable LEAP expiration for ${ticker}`);
            return null;
        }

        // Find weekly expiration (5-10 days)
        const weeklyExpiration = this.findWeeklyExpiration(optionChain);
        if (!weeklyExpiration) {
            logger.warn('IPMCC', `No suitable weekly expiration for ${ticker}`);
            return null;
        }

        // Calculate LEAP strike (70-80 delta, slightly ITM)
        const leapStrike = this.calculateLeapStrike(etfData.currentPrice, optionChain[leapExpiration]);
        
        // Calculate weekly strike (25-35 delta, OTM)
        const weeklyStrike = this.calculateWeeklyStrike(etfData.currentPrice, optionChain[weeklyExpiration]);

        // Get option prices
        const leapOption = optionChain[leapExpiration]?.CALL?.[leapStrike];
        const weeklyOption = optionChain[weeklyExpiration]?.CALL?.[weeklyStrike];

        if (!leapOption || !weeklyOption) {
            logger.warn('IPMCC', `Missing option data for ${ticker}`);
            return null;
        }

        // Calculate costs and income
        const leapCost = leapOption.ask || (leapOption.bid + 0.10);
        const weeklyCredit = weeklyOption.bid || (weeklyOption.ask - 0.10);

        // Validate minimum credit requirement
        const creditPercent = weeklyCredit / etfData.currentPrice;
        if (creditPercent < this.config.minCreditPercent) {
            logger.debug('IPMCC', `Insufficient weekly credit for ${ticker}: ${creditPercent.toFixed(4)}`);
            return null;
        }

        // Calculate position metrics
        setup.leapSetup = {
            strike: leapStrike,
            expiration: leapExpiration,
            cost: leapCost,
            delta: leapOption.delta || this.estimateDelta(etfData.currentPrice, leapStrike, true),
            iv: leapOption.iv || 0.20
        };

        setup.weeklySetup = {
            strike: weeklyStrike,
            expiration: weeklyExpiration,
            credit: weeklyCredit,
            delta: weeklyOption.delta || this.estimateDelta(etfData.currentPrice, weeklyStrike, false),
            iv: weeklyOption.iv || 0.25
        };

        setup.totalCost = leapCost * 100; // Per contract
        setup.weeklyIncome = weeklyCredit * 100;
        setup.monthlyIncome = setup.weeklyIncome * 4.33; // Average weeks per month
        setup.monthlyReturn = (setup.monthlyIncome / setup.totalCost) * 100;
        setup.annualizedReturn = setup.monthlyReturn * 12;

        // Score the opportunity
        setup.score = this.scoreIPMCCOpportunity(setup, etfData, marketData.VIX);

        // Position sizing
        const maxPositionSize = accountData.netLiq * this.config.maxRiskPerPosition;
        const contracts = Math.min(
            Math.floor(maxPositionSize / setup.totalCost),
            10 // Cap at 10 contracts
        );
        setup.contracts = contracts;
        setup.requiredCapital = setup.totalCost * contracts;

        logger.info('IPMCC', `Evaluated ${ticker}`, {
            score: setup.score,
            monthlyReturn: setup.monthlyReturn.toFixed(2),
            contracts: contracts
        });

        return setup;
    }

    /**
     * Score IPMCC opportunity
     */
    scoreIPMCCOpportunity(setup, etfData, vixData) {
        let score = 0;

        // Monthly return scoring (1-3% monthly is excellent)
        if (setup.monthlyReturn >= 2.5) score += 30;
        else if (setup.monthlyReturn >= 2.0) score += 25;
        else if (setup.monthlyReturn >= 1.5) score += 20;
        else if (setup.monthlyReturn >= 1.0) score += 15;
        else if (setup.monthlyReturn >= 0.75) score += 10;

        // Trend analysis
        const trend = this.analyzeTrend(etfData);
        if (trend === 'STRONG_UP') score += 20;
        else if (trend === 'UP') score += 15;
        else if (trend === 'NEUTRAL') score += 10;
        else if (trend === 'DOWN') score += 5;

        // IV environment
        const iv = setup.leapSetup.iv;
        const weeklyIV = setup.weeklySetup.iv;
        const ivDiff = weeklyIV - iv;
        
        if (ivDiff > 0.05) score += 15; // Weekly IV higher than LEAP IV
        else if (ivDiff > 0) score += 10;
        
        // Absolute IV levels
        if (iv >= 0.15 && iv <= 0.35) score += 15;
        else if (iv >= 0.12 && iv <= 0.40) score += 10;

        // VIX environment
        const vix = vixData?.currentPrice || 16;
        if (vix >= 15 && vix <= 25) score += 10;
        else if (vix >= 12 && vix <= 30) score += 5;

        // Strike placement
        const moneyness = etfData.currentPrice / setup.leapSetup.strike;
        if (moneyness >= 1.02 && moneyness <= 1.08) score += 10; // 2-8% ITM

        // Base viability
        if (setup.weeklyIncome >= 50) score += 10; // At least $50/week

        return Math.min(100, score);
    }

    /**
     * Manage existing IPMCC positions
     */
    manageExistingIPMCC(position, currentData) {
        const management = {
            ticker: position.ticker,
            action: null,
            details: {}
        };

        if (!currentData) {
            logger.warn('IPMCC', `No market data for position ${position.ticker}`);
            return management;
        }

        const currentPrice = currentData.currentPrice;
        
        // Check if weekly needs rolling (ITM or close to ITM)
        if (position.weeklyStrike && currentPrice >= position.weeklyStrike * 0.98) {
            management.action = 'ROLL_WEEKLY';
            management.details = {
                currentStrike: position.weeklyStrike,
                reason: 'Weekly tested or ITM',
                newStrike: this.calculateWeeklyStrike(currentPrice)
            };
        }

        // Check if LEAP needs rolling (deep ITM)
        if (position.leapStrike && currentPrice >= position.leapStrike * 1.15) {
            management.action = 'ROLL_LEAP';
            management.details = {
                currentStrike: position.leapStrike,
                reason: 'LEAP deep ITM (>15%)',
                newStrike: this.calculateLeapStrike(currentPrice)
            };
        }

        // Check profit target
        const unrealizedPnL = this.calculateUnrealizedPnL(position, currentData);
        const pnlPercent = unrealizedPnL / position.cost;

        if (pnlPercent >= this.config.profitTargetPercent) {
            management.action = 'CLOSE_PROFITABLE';
            management.details = {
                pnl: unrealizedPnL,
                pnlPercent: pnlPercent * 100,
                reason: 'Profit target reached'
            };
        }

        // Check stop loss
        if (pnlPercent <= -this.config.stopLossPercent) {
            management.action = 'CLOSE_LOSS';
            management.details = {
                pnl: unrealizedPnL,
                pnlPercent: pnlPercent * 100,
                reason: 'Stop loss triggered'
            };
        }

        // Check time decay (close if <30 days on LEAP)
        const daysToExpiration = this.getDTE(position.leapExpiration);
        if (daysToExpiration < 30) {
            management.action = 'CLOSE_EXPIRING';
            management.details = {
                dte: daysToExpiration,
                reason: 'LEAP expiring soon'
            };
        }

        return management;
    }

    // Helper methods

    findLeapExpiration(optionChain) {
        const today = new Date();
        const expirations = Object.keys(optionChain).sort();
        
        for (const exp of expirations) {
            const expDate = new Date(exp);
            const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (dte >= this.config.minLeapDTE && dte <= this.config.maxLeapDTE) {
                return exp;
            }
        }
        
        return null;
    }

    findWeeklyExpiration(optionChain) {
        const today = new Date();
        const expirations = Object.keys(optionChain).sort();
        
        for (const exp of expirations) {
            const expDate = new Date(exp);
            const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (dte >= 5 && dte <= 10) {
                return exp;
            }
        }
        
        // Fallback to nearest expiration
        return expirations[0];
    }

    calculateLeapStrike(currentPrice, chain) {
        // Target 75 delta = ~5% ITM
        const targetStrike = currentPrice * 0.95;
        
        // Find nearest available strike
        const strikes = Object.keys(chain?.CALL || {})
            .map(Number)
            .sort((a, b) => a - b);
        
        let closest = strikes[0];
        let minDiff = Math.abs(strikes[0] - targetStrike);
        
        for (const strike of strikes) {
            const diff = Math.abs(strike - targetStrike);
            if (diff < minDiff) {
                minDiff = diff;
                closest = strike;
            }
        }
        
        return closest;
    }

    calculateWeeklyStrike(currentPrice, chain) {
        // Target 30 delta = ~2-3% OTM
        const targetStrike = currentPrice * 1.025;
        
        // Find nearest available strike
        const strikes = Object.keys(chain?.CALL || {})
            .map(Number)
            .sort((a, b) => a - b);
        
        let closest = strikes[strikes.length - 1];
        let minDiff = Math.abs(strikes[strikes.length - 1] - targetStrike);
        
        for (const strike of strikes) {
            const diff = Math.abs(strike - targetStrike);
            if (diff < minDiff) {
                minDiff = diff;
                closest = strike;
            }
        }
        
        return closest;
    }

    estimateDelta(price, strike, isCall = true) {
        // Simple delta approximation
        const moneyness = price / strike;
        
        if (isCall) {
            if (moneyness >= 1.10) return 0.90; // Deep ITM
            if (moneyness >= 1.05) return 0.75; // ITM
            if (moneyness >= 1.00) return 0.50; // ATM
            if (moneyness >= 0.95) return 0.25; // OTM
            return 0.10; // Deep OTM
        } else {
            if (moneyness <= 0.90) return -0.90; // Deep ITM
            if (moneyness <= 0.95) return -0.75; // ITM
            if (moneyness <= 1.00) return -0.50; // ATM
            if (moneyness <= 1.05) return -0.25; // OTM
            return -0.10; // Deep OTM
        }
    }

    analyzeTrend(etfData) {
        const ema8 = etfData.ema8 || etfData.currentPrice;
        const ema21 = etfData.ema21 || etfData.currentPrice;
        const ema50 = etfData.ema50 || etfData.currentPrice;
        const rsi = etfData.rsi || 50;
        
        // Strong uptrend
        if (ema8 > ema21 && ema21 > ema50 && rsi > 50 && rsi < 70) {
            return 'STRONG_UP';
        }
        
        // Uptrend
        if (ema8 > ema21 && rsi > 40) {
            return 'UP';
        }
        
        // Downtrend
        if (ema8 < ema21 && rsi < 50) {
            return 'DOWN';
        }
        
        return 'NEUTRAL';
    }

    hasExistingIPMCC(positions, ticker) {
        return positions.some(p => 
            p.ticker === ticker && 
            p.strategy === 'IPMCC' && 
            p.status === 'OPEN'
        );
    }

    analyzeExistingPositions(positions) {
        return positions.filter(p => 
            p.strategy === 'IPMCC' && 
            p.status === 'OPEN'
        );
    }

    calculateUnrealizedPnL(position, currentData) {
        // Simplified P&L calculation
        const currentPrice = currentData.currentPrice;
        const leapIntrinsic = Math.max(0, currentPrice - position.leapStrike);
        const currentLeapValue = leapIntrinsic + (position.leapTimeValue * 0.8); // Decay estimate
        
        const leapPnL = (currentLeapValue - position.leapCost) * 100;
        const weeklyIncome = position.weeklyIncomeCollected || 0;
        
        return leapPnL + weeklyIncome;
    }

    getDTE(expiration) {
        const today = new Date();
        const expDate = new Date(expiration);
        return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    }
}

module.exports = { IPMCCStrategy };