/**
 * LEAP Put Ladder Strategy
 * Complete implementation of Tom King's systematic LEAP put ladder system
 * 
 * Strategy Overview:
 * - Build ladder of 10 LEAP put positions at different strikes
 * - Hold for appreciation and sell at 50% profit target
 * - Reinvest profits into new LEAP positions
 * - Maintain constant exposure across market cycles
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class LEAPPutLadderStrategy {
    constructor(config = {}) {
        this.config = {
            // Ladder configuration
            ladderSize: config.ladderSize || 10, // 10 positions in ladder
            strikeSpacing: config.strikeSpacing || 0.05, // 5% spacing between strikes
            startingOTM: config.startingOTM || 0.20, // Start 20% OTM
            
            // Position parameters
            minDTE: config.minDTE || 300, // Minimum 10 months out
            maxDTE: config.maxDTE || 450, // Maximum 15 months out
            targetDTE: config.targetDTE || 365, // Target 12 months
            
            // Risk and position sizing
            maxRiskPerRung: config.maxRiskPerRung || 0.01, // 1% per ladder rung
            maxTotalLadderRisk: config.maxTotalLadderRisk || 0.10, // 10% total
            profitTarget: config.profitTarget || 0.50, // 50% profit target
            stopLoss: config.stopLoss || -0.50, // 50% stop loss
            
            // Management rules
            rollDTE: config.rollDTE || 60, // Roll when <60 days to expiration
            rebalanceThreshold: config.rebalanceThreshold || 0.20, // Rebalance if 20% out of balance
            
            // Entry criteria
            minVIX: config.minVIX || 15, // Minimum VIX for entry
            maxVIX: config.maxVIX || 40, // Maximum VIX for entry
            preferredVIX: config.preferredVIX || 22, // Ideal VIX level
            
            // ETFs to trade
            primaryETF: config.primaryETF || 'SPY',
            alternateETFs: config.alternateETFs || ['QQQ', 'IWM'],
            
            ...config
        };
        
        // Track ladder positions
        this.ladderPositions = [];
        this.closedPositions = [];
        this.totalProfit = 0;
    }

    /**
     * Main analysis method for LEAP ladder opportunities
     */
    analyzeLEAPLadder(marketData, accountData, currentDate = new Date()) {
        const analysis = {
            timestamp: currentDate,
            strategy: 'LEAP Put Ladder',
            currentLadder: this.analyzeLadderStatus(accountData.positions),
            newOpportunities: [],
            recommendations: [],
            performanceMetrics: this.calculateLadderPerformance()
        };

        // Check day constraint (Monday entry per Tom King)
        const day = currentDate.getDay();
        if (day !== 1) { // 1 = Monday
            analysis.recommendation = 'LEAP puts entry on Monday only';
            analysis.canBuildLadder = false;
            return analysis;
        }

        // Check phase requirement
        if (accountData.phase < 2) {
            analysis.recommendation = 'LEAP ladder requires Phase 2+ (£40k+ account)';
            analysis.canBuildLadder = false;
            return analysis;
        }

        // Check VIX conditions
        const vix = marketData.VIX?.currentPrice || 16;
        if (vix < this.config.minVIX || vix > this.config.maxVIX) {
            analysis.recommendation = `VIX ${vix.toFixed(2)} outside range (${this.config.minVIX}-${this.config.maxVIX})`;
            analysis.canBuildLadder = false;
            return analysis;
        }

        // Analyze primary ETF
        const primaryAnalysis = this.analyzeETFForLadder(
            this.config.primaryETF,
            marketData,
            accountData
        );

        if (primaryAnalysis.canBuild) {
            analysis.newOpportunities.push(primaryAnalysis);
        }

        // Check if we need to build/rebuild ladder
        const ladderHealth = this.assessLadderHealth(analysis.currentLadder);
        
        if (ladderHealth.needsBuilding) {
            analysis.recommendations.push({
                action: 'BUILD_LADDER',
                etf: this.config.primaryETF,
                positions: primaryAnalysis.ladderPositions,
                totalCost: primaryAnalysis.totalCost,
                reason: ladderHealth.reason
            });
        }

        // Manage existing positions
        const managementActions = this.manageExistingLadder(
            analysis.currentLadder,
            marketData,
            currentDate
        );
        
        analysis.recommendations.push(...managementActions);

        // Calculate ladder statistics
        analysis.statistics = this.calculateLadderStatistics(analysis.currentLadder);

        logger.info('LEAP Ladder', 'Analysis complete', {
            currentPositions: analysis.currentLadder.length,
            newOpportunities: analysis.newOpportunities.length,
            recommendations: analysis.recommendations.length
        });

        return analysis;
    }

    /**
     * Analyze specific ETF for ladder building
     */
    analyzeETFForLadder(ticker, marketData, accountData) {
        const analysis = {
            ticker,
            timestamp: new Date(),
            canBuild: false,
            ladderPositions: [],
            totalCost: 0,
            expectedReturn: 0,
            score: 0
        };

        const etfData = marketData[ticker];
        if (!etfData) {
            logger.warn('LEAP Ladder', `No market data for ${ticker}`);
            return analysis;
        }

        const optionChain = marketData.optionChain?.[ticker];
        if (!optionChain) {
            logger.warn('LEAP Ladder', `No option chain for ${ticker}`);
            return analysis;
        }

        // Find suitable LEAP expiration
        const leapExpiration = this.findLEAPExpiration(optionChain);
        if (!leapExpiration) {
            logger.warn('LEAP Ladder', `No suitable LEAP expiration for ${ticker}`);
            return analysis;
        }

        // Build ladder positions
        const ladder = this.buildLadderPositions(
            etfData.currentPrice,
            optionChain[leapExpiration],
            leapExpiration
        );

        if (ladder.length < this.config.ladderSize) {
            logger.warn('LEAP Ladder', `Insufficient strikes for full ladder on ${ticker}`);
            return analysis;
        }

        // Calculate total cost and position sizing
        const totalCost = ladder.reduce((sum, pos) => sum + pos.cost, 0);
        const maxLadderInvestment = accountData.netLiq * this.config.maxTotalLadderRisk;

        if (totalCost > maxLadderInvestment) {
            // Scale down positions
            const scaleFactor = maxLadderInvestment / totalCost;
            ladder.forEach(pos => {
                pos.contracts = Math.floor(pos.contracts * scaleFactor);
                pos.cost = pos.cost * scaleFactor;
            });
        }

        // Score the opportunity
        const score = this.scoreLadderOpportunity(ladder, etfData, marketData.VIX);

        if (score >= 60) {
            analysis.canBuild = true;
            analysis.ladderPositions = ladder;
            analysis.totalCost = ladder.reduce((sum, pos) => sum + pos.cost, 0);
            analysis.expectedReturn = this.calculateExpectedReturn(ladder);
            analysis.score = score;
        }

        return analysis;
    }

    /**
     * Build ladder positions at different strikes
     */
    buildLadderPositions(currentPrice, optionChain, expiration) {
        const ladder = [];
        const putChain = optionChain?.PUT || {};
        
        // Start 20% OTM and go down in 5% increments
        for (let i = 0; i < this.config.ladderSize; i++) {
            const strikeTarget = currentPrice * (1 - this.config.startingOTM - i * this.config.strikeSpacing);
            const strike = this.findNearestStrike(strikeTarget, putChain);
            
            if (!strike) continue;
            
            const option = putChain[strike];
            if (!option) continue;
            
            const position = {
                rung: i + 1,
                strike,
                expiration,
                type: 'PUT',
                askPrice: option.ask || 0,
                bidPrice: option.bid || 0,
                midPrice: (option.ask + option.bid) / 2,
                iv: option.iv || 0.20,
                delta: option.delta || this.estimatePutDelta(currentPrice, strike),
                contracts: 1, // Start with 1, will be scaled
                cost: ((option.ask + option.bid) / 2) * 100,
                targetProfit: ((option.ask + option.bid) / 2) * 100 * this.config.profitTarget,
                stopLoss: ((option.ask + option.bid) / 2) * 100 * this.config.stopLoss
            };
            
            ladder.push(position);
        }
        
        return ladder;
    }

    /**
     * Manage existing ladder positions
     */
    manageExistingLadder(positions, marketData, currentDate) {
        const actions = [];
        
        for (const position of positions) {
            const etfData = marketData[position.ticker];
            if (!etfData) continue;
            
            // Check profit target
            const currentValue = this.calculatePositionValue(position, etfData);
            const pnl = currentValue - position.cost;
            const pnlPercent = pnl / position.cost;
            
            if (pnlPercent >= this.config.profitTarget) {
                actions.push({
                    action: 'CLOSE_WINNER',
                    position: position.id,
                    strike: position.strike,
                    pnl,
                    pnlPercent: pnlPercent * 100,
                    reason: 'Profit target reached'
                });
                
                // Plan replacement position
                actions.push({
                    action: 'REPLACE_RUNG',
                    rung: position.rung,
                    strike: this.calculateReplacementStrike(position, etfData),
                    reason: 'Maintain ladder structure'
                });
            }
            
            // Check stop loss
            if (pnlPercent <= -this.config.stopLoss) {
                actions.push({
                    action: 'STOP_LOSS',
                    position: position.id,
                    strike: position.strike,
                    pnl,
                    pnlPercent: pnlPercent * 100,
                    reason: 'Stop loss triggered'
                });
            }
            
            // Check expiration
            const dte = this.calculateDTE(position.expiration, currentDate);
            if (dte <= this.config.rollDTE) {
                actions.push({
                    action: 'ROLL_EXPIRING',
                    position: position.id,
                    strike: position.strike,
                    dte,
                    newExpiration: this.findLEAPExpiration(marketData.optionChain?.[position.ticker]),
                    reason: `Expiring in ${dte} days`
                });
            }
        }
        
        return actions;
    }

    /**
     * Assess ladder health and balance
     */
    assessLadderHealth(positions) {
        const health = {
            needsBuilding: false,
            reason: null,
            metrics: {}
        };
        
        // Check if ladder exists
        if (positions.length === 0) {
            health.needsBuilding = true;
            health.reason = 'No ladder positions exist';
            return health;
        }
        
        // Check ladder completeness
        const coverage = positions.length / this.config.ladderSize;
        if (coverage < 0.7) {
            health.needsBuilding = true;
            health.reason = `Ladder only ${(coverage * 100).toFixed(0)}% complete`;
            return health;
        }
        
        // Check strike distribution
        const strikes = positions.map(p => p.strike).sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < strikes.length; i++) {
            gaps.push((strikes[i] - strikes[i-1]) / strikes[i-1]);
        }
        
        const maxGap = Math.max(...gaps);
        if (maxGap > this.config.strikeSpacing * 2) {
            health.needsBuilding = true;
            health.reason = 'Large gaps in strike coverage';
        }
        
        // Calculate health metrics
        health.metrics = {
            coverage,
            averageGap: gaps.reduce((a, b) => a + b, 0) / gaps.length,
            maxGap,
            totalValue: positions.reduce((sum, p) => sum + p.currentValue, 0),
            unrealizedPnL: positions.reduce((sum, p) => sum + (p.currentValue - p.cost), 0)
        };
        
        return health;
    }

    /**
     * Score ladder opportunity
     */
    scoreLadderOpportunity(ladder, etfData, vixData) {
        let score = 0;
        
        // VIX environment scoring
        const vix = vixData?.currentPrice || 16;
        if (vix >= 20 && vix <= 30) score += 25;
        else if (vix >= 18 && vix <= 35) score += 20;
        else if (vix >= 15 && vix <= 40) score += 15;
        else score += 10;
        
        // Market pullback scoring (prefer after decline)
        const decline = (etfData.high20d - etfData.currentPrice) / etfData.high20d;
        if (decline > 0.10) score += 25; // 10%+ pullback
        else if (decline > 0.07) score += 20; // 7%+ pullback
        else if (decline > 0.05) score += 15; // 5%+ pullback
        else if (decline > 0.03) score += 10; // 3%+ pullback
        
        // IV Rank scoring
        const ivRank = etfData.ivRank || 50;
        if (ivRank > 60) score += 20;
        else if (ivRank > 40) score += 15;
        else if (ivRank > 25) score += 10;
        
        // Technical oversold conditions
        const rsi = etfData.rsi || 50;
        if (rsi < 30) score += 15;
        else if (rsi < 40) score += 10;
        else if (rsi < 50) score += 5;
        
        // Ladder cost efficiency
        const avgPremium = ladder.reduce((sum, p) => sum + p.midPrice, 0) / ladder.length;
        if (avgPremium > 3) score += 15;
        else if (avgPremium > 2) score += 10;
        else if (avgPremium > 1) score += 5;
        
        return Math.min(100, score);
    }

    /**
     * Calculate ladder statistics
     */
    calculateLadderStatistics(positions) {
        if (positions.length === 0) {
            return {
                totalPositions: 0,
                totalInvested: 0,
                totalValue: 0,
                unrealizedPnL: 0,
                realizedPnL: this.totalProfit,
                averageDTE: 0,
                coverage: 0
            };
        }
        
        const stats = {
            totalPositions: positions.length,
            totalInvested: positions.reduce((sum, p) => sum + p.cost, 0),
            totalValue: positions.reduce((sum, p) => sum + (p.currentValue || p.cost), 0),
            unrealizedPnL: 0,
            realizedPnL: this.totalProfit,
            averageDTE: 0,
            coverage: (positions.length / this.config.ladderSize) * 100,
            distribution: {}
        };
        
        // Calculate unrealized P&L
        stats.unrealizedPnL = stats.totalValue - stats.totalInvested;
        
        // Calculate average DTE
        const today = new Date();
        const totalDTE = positions.reduce((sum, p) => {
            const expDate = new Date(p.expiration);
            const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            return sum + dte;
        }, 0);
        stats.averageDTE = Math.round(totalDTE / positions.length);
        
        // Strike distribution
        const strikes = positions.map(p => p.strike).sort((a, b) => a - b);
        stats.distribution = {
            lowest: strikes[0],
            highest: strikes[strikes.length - 1],
            spread: strikes[strikes.length - 1] - strikes[0],
            averageGap: (strikes[strikes.length - 1] - strikes[0]) / (strikes.length - 1)
        };
        
        return stats;
    }

    /**
     * Calculate expected return for ladder
     */
    calculateExpectedReturn(ladder) {
        // Assume 40% of positions hit profit target over the year
        const hitRate = 0.40;
        const avgProfit = ladder.reduce((sum, p) => sum + p.targetProfit, 0) / ladder.length;
        const expectedProfit = avgProfit * hitRate * ladder.length;
        const totalCost = ladder.reduce((sum, p) => sum + p.cost, 0);
        
        return (expectedProfit / totalCost) * 100;
    }

    /**
     * Calculate ladder performance metrics
     */
    calculateLadderPerformance() {
        const closed = this.closedPositions;
        if (closed.length === 0) {
            return {
                totalTrades: 0,
                winners: 0,
                losers: 0,
                winRate: 0,
                averageWin: 0,
                averageLoss: 0,
                profitFactor: 0,
                totalPnL: 0
            };
        }
        
        const winners = closed.filter(p => p.pnl > 0);
        const losers = closed.filter(p => p.pnl < 0);
        
        return {
            totalTrades: closed.length,
            winners: winners.length,
            losers: losers.length,
            winRate: (winners.length / closed.length) * 100,
            averageWin: winners.length > 0 ? winners.reduce((sum, p) => sum + p.pnl, 0) / winners.length : 0,
            averageLoss: losers.length > 0 ? losers.reduce((sum, p) => sum + p.pnl, 0) / losers.length : 0,
            profitFactor: Math.abs(winners.reduce((sum, p) => sum + p.pnl, 0) / (losers.reduce((sum, p) => sum + p.pnl, 0) || 1)),
            totalPnL: closed.reduce((sum, p) => sum + p.pnl, 0)
        };
    }

    // Helper methods

    findLEAPExpiration(optionChain) {
        if (!optionChain) return null;
        
        const today = new Date();
        const expirations = Object.keys(optionChain).sort();
        
        for (const exp of expirations) {
            const expDate = new Date(exp);
            const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            
            if (dte >= this.config.minDTE && dte <= this.config.maxDTE) {
                return exp;
            }
        }
        
        return null;
    }

    findNearestStrike(target, chain) {
        const strikes = Object.keys(chain).map(Number).sort((a, b) => a - b);
        
        let closest = strikes[0];
        let minDiff = Math.abs(strikes[0] - target);
        
        for (const strike of strikes) {
            const diff = Math.abs(strike - target);
            if (diff < minDiff) {
                minDiff = diff;
                closest = strike;
            }
        }
        
        return closest;
    }

    estimatePutDelta(price, strike) {
        const moneyness = strike / price;
        
        if (moneyness >= 1.10) return -0.90; // Deep ITM put
        if (moneyness >= 1.05) return -0.70; // ITM put
        if (moneyness >= 1.00) return -0.50; // ATM put
        if (moneyness >= 0.95) return -0.30; // OTM put
        if (moneyness >= 0.90) return -0.15; // OTM put
        if (moneyness >= 0.80) return -0.05; // Deep OTM put
        return -0.02; // Very deep OTM
    }

    calculatePositionValue(position, currentData) {
        // Simplified valuation based on intrinsic value + time value decay
        const intrinsic = Math.max(0, position.strike - currentData.currentPrice);
        const daysHeld = Math.ceil((new Date() - new Date(position.entryDate)) / (1000 * 60 * 60 * 24));
        const daysToExpiry = Math.ceil((new Date(position.expiration) - new Date()) / (1000 * 60 * 60 * 24));
        
        // Simple time decay model
        const timeValueRemaining = position.timeValue * (daysToExpiry / position.originalDTE);
        
        return (intrinsic + timeValueRemaining) * 100 * position.contracts;
    }

    calculateReplacementStrike(oldPosition, currentData) {
        // Replace at similar OTM percentage
        const originalOTM = (oldPosition.entryPrice - oldPosition.strike) / oldPosition.entryPrice;
        return Math.round(currentData.currentPrice * (1 - originalOTM));
    }

    calculateDTE(expiration, currentDate = new Date()) {
        const expDate = new Date(expiration);
        return Math.ceil((expDate - currentDate) / (1000 * 60 * 60 * 24));
    }

    analyzeLadderStatus(positions) {
        return positions.filter(p => 
            p.strategy === 'LEAP_LADDER' && 
            p.status === 'OPEN'
        );
    }
}

module.exports = { LEAPPutLadderStrategy };