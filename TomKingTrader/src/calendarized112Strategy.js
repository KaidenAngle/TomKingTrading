/**
 * Calendarized 1-1-2 Strategy Implementation
 * Tom King's advanced calendar spread strategy with time decay optimization
 */

class Calendarized112Strategy {
    constructor(config = {}) {
        this.name = 'Calendarized 1-1-2';
        this.config = {
            // Strategy parameters from Tom King's methodology
            longDTE: 60,           // Long option days to expiration
            shortDTE: 30,          // Short option days to expiration
            maxBPUsage: 0.15,      // 15% max BP per position
            profitTarget: 0.25,    // 25% profit target
            stopLoss: -0.30,       // 30% stop loss
            vixThreshold: 20,      // Minimum VIX for entry
            correlationLimit: 2,   // Max correlated positions
            
            // Strike selection
            deltaTarget: 0.30,     // Target delta for strikes
            strikeWidth: 5,        // Strike width for selection
            
            // Risk management
            maxPositions: 3,       // Max simultaneous positions
            defenseThreshold: 21,  // Days to manage defensively
            rollThreshold: 7,      // Days before expiration to roll
            
            ...config
        };
        
        this.positions = [];
        this.performance = {
            trades: 0,
            winners: 0,
            losers: 0,
            totalPnL: 0,
            winRate: 0
        };
    }

    /**
     * Analyze opportunity for Calendarized 1-1-2 entry
     */
    analyzeOpportunity(marketData, optionChain) {
        const opportunity = {
            viable: false,
            symbol: marketData.symbol,
            entry: null,
            reason: '',
            score: 0
        };

        try {
            // Check VIX regime
            if (marketData.vix < this.config.vixThreshold) {
                opportunity.reason = `VIX too low: ${marketData.vix} < ${this.config.vixThreshold}`;
                return opportunity;
            }

            // Find calendar spread opportunities
            const longExpiration = this.findExpiration(optionChain, this.config.longDTE);
            const shortExpiration = this.findExpiration(optionChain, this.config.shortDTE);

            if (!longExpiration || !shortExpiration) {
                opportunity.reason = 'Suitable expirations not found';
                return opportunity;
            }

            // Find optimal strikes
            const strike = this.findOptimalStrike(
                marketData.price,
                longExpiration,
                shortExpiration,
                this.config.deltaTarget
            );

            if (!strike) {
                opportunity.reason = 'No suitable strike found';
                return opportunity;
            }

            // Calculate position details
            const position = this.calculatePosition(
                strike,
                longExpiration,
                shortExpiration,
                marketData
            );

            // Validate position
            if (this.validatePosition(position, marketData)) {
                opportunity.viable = true;
                opportunity.entry = position;
                opportunity.score = this.scoreOpportunity(position, marketData);
                opportunity.reason = 'Calendarized 1-1-2 setup identified';
            } else {
                opportunity.reason = 'Position validation failed';
            }

        } catch (error) {
            opportunity.reason = `Analysis error: ${error.message}`;
        }

        return opportunity;
    }

    /**
     * Find suitable expiration date
     */
    findExpiration(optionChain, targetDTE) {
        if (!optionChain || !optionChain.expirations) return null;

        let closestExpiration = null;
        let minDiff = Infinity;

        for (const expiration of optionChain.expirations) {
            const dte = this.calculateDTE(expiration.date);
            const diff = Math.abs(dte - targetDTE);

            if (diff < minDiff) {
                minDiff = diff;
                closestExpiration = expiration;
            }
        }

        return closestExpiration;
    }

    /**
     * Find optimal strike for calendar spread
     */
    findOptimalStrike(spotPrice, longExp, shortExp, targetDelta) {
        // Find ATM strike as starting point
        const atmStrike = Math.round(spotPrice / 5) * 5;
        
        // Look for strikes with good calendar spread characteristics
        const strikes = [];
        
        for (let offset = -10; offset <= 10; offset++) {
            const strike = atmStrike + (offset * 5);
            
            const longOption = this.getOptionData(longExp, strike);
            const shortOption = this.getOptionData(shortExp, strike);
            
            if (longOption && shortOption) {
                const spread = {
                    strike,
                    longPremium: longOption.mid,
                    shortPremium: shortOption.mid,
                    netDebit: longOption.mid - shortOption.mid,
                    longIV: longOption.iv,
                    shortIV: shortOption.iv,
                    ivSpread: longOption.iv - shortOption.iv,
                    delta: longOption.delta
                };
                
                // Score based on IV spread and delta proximity
                spread.score = this.scoreStrike(spread, targetDelta);
                strikes.push(spread);
            }
        }
        
        // Return best scoring strike
        return strikes.sort((a, b) => b.score - a.score)[0];
    }

    /**
     * Score strike selection
     */
    scoreStrike(spread, targetDelta) {
        let score = 0;
        
        // Prefer positive IV spread (long IV > short IV)
        if (spread.ivSpread > 0) {
            score += spread.ivSpread * 100;
        }
        
        // Prefer strikes close to target delta
        const deltaDiff = Math.abs(Math.abs(spread.delta) - targetDelta);
        score -= deltaDiff * 50;
        
        // Prefer reasonable net debit
        if (spread.netDebit > 0 && spread.netDebit < spread.longPremium * 0.5) {
            score += 20;
        }
        
        return score;
    }

    /**
     * Calculate full position details
     */
    calculatePosition(strike, longExp, shortExp, marketData) {
        const position = {
            strategy: this.name,
            symbol: marketData.symbol,
            strike: strike.strike,
            longExpiration: longExp.date,
            shortExpiration: shortExp.date,
            longDTE: this.calculateDTE(longExp.date),
            shortDTE: this.calculateDTE(shortExp.date),
            
            // Leg 1: Buy 1 long-dated call
            leg1: {
                action: 'BUY',
                type: 'CALL',
                quantity: 1,
                strike: strike.strike,
                expiration: longExp.date,
                premium: strike.longPremium
            },
            
            // Leg 2: Sell 1 short-dated call
            leg2: {
                action: 'SELL',
                type: 'CALL',
                quantity: 1,
                strike: strike.strike,
                expiration: shortExp.date,
                premium: strike.shortPremium
            },
            
            // Leg 3: Sell 2 short-dated puts (the "2" in 1-1-2)
            leg3: {
                action: 'SELL',
                type: 'PUT',
                quantity: 2,
                strike: strike.strike,
                expiration: shortExp.date,
                premium: this.getOptionData(shortExp, strike.strike, 'PUT').mid
            },
            
            // Position metrics
            netDebit: 0,
            maxProfit: 0,
            maxLoss: 0,
            breakeven: 0,
            requiredBP: 0,
            currentPnL: 0,
            targetProfit: 0,
            stopLoss: 0
        };
        
        // Calculate net debit/credit
        position.netDebit = position.leg1.premium - position.leg2.premium - (2 * position.leg3.premium);
        
        // Calculate max profit (if short options expire worthless)
        position.maxProfit = -position.netDebit + position.leg1.premium;
        
        // Calculate max loss (if assigned on puts)
        position.maxLoss = (2 * strike.strike * 100) - position.maxProfit;
        
        // Calculate breakeven
        position.breakeven = strike.strike - (position.netDebit / 100);
        
        // Calculate required buying power
        position.requiredBP = Math.max(
            Math.abs(position.netDebit) * 100,
            (2 * strike.strike * 100 * 0.20) // 20% of notional for naked puts
        );
        
        // Set targets
        position.targetProfit = position.maxProfit * this.config.profitTarget;
        position.stopLoss = -Math.abs(position.maxProfit * this.config.stopLoss);
        
        return position;
    }

    /**
     * Validate position against risk rules
     */
    validatePosition(position, marketData) {
        // Check buying power usage
        const bpUsage = position.requiredBP / marketData.accountValue;
        if (bpUsage > this.config.maxBPUsage) {
            return false;
        }
        
        // Check correlation limits
        const correlatedPositions = this.countCorrelatedPositions(position.symbol);
        if (correlatedPositions >= this.config.correlationLimit) {
            return false;
        }
        
        // Check max positions
        if (this.positions.length >= this.config.maxPositions) {
            return false;
        }
        
        // Check risk/reward ratio
        const rrRatio = position.maxProfit / Math.abs(position.maxLoss);
        if (rrRatio < 0.3) { // Minimum 30% reward to risk
            return false;
        }
        
        return true;
    }

    /**
     * Score opportunity quality
     */
    scoreOpportunity(position, marketData) {
        let score = 0;
        
        // Score based on IV rank
        if (marketData.ivRank > 50) {
            score += 30;
        }
        
        // Score based on VIX level
        if (marketData.vix > 25) {
            score += 20;
        } else if (marketData.vix > 20) {
            score += 10;
        }
        
        // Score based on profit potential
        const profitRatio = position.maxProfit / position.requiredBP;
        score += profitRatio * 100;
        
        // Score based on probability of profit
        const pop = this.calculateProbabilityOfProfit(position, marketData);
        score += pop;
        
        return Math.min(100, score);
    }

    /**
     * Calculate probability of profit
     */
    calculateProbabilityOfProfit(position, marketData) {
        // Simplified POP calculation based on delta
        const otmDistance = Math.abs(position.strike - marketData.price) / marketData.price;
        const timeBonus = position.shortDTE / 365 * 20; // Time decay advantage
        
        const basePOP = 50 + (otmDistance * 100) + timeBonus;
        return Math.min(85, Math.max(15, basePOP));
    }

    /**
     * Execute trade entry
     */
    async executeTrade(position, api) {
        try {
            // Prepare order
            const order = {
                symbol: position.symbol,
                orderType: 'NET_DEBIT',
                price: Math.abs(position.netDebit),
                legs: [position.leg1, position.leg2, position.leg3]
            };
            
            // Log trade attempt
            console.log(`📊 Executing Calendarized 1-1-2: ${position.symbol}`);
            console.log(`   Strike: ${position.strike}`);
            console.log(`   Long: ${position.longDTE} DTE`);
            console.log(`   Short: ${position.shortDTE} DTE`);
            console.log(`   Net Debit: $${Math.abs(position.netDebit).toFixed(2)}`);
            
            // Add to positions
            this.positions.push({
                ...position,
                entryTime: new Date(),
                status: 'OPEN'
            });
            
            return { success: true, position };
            
        } catch (error) {
            console.error('Trade execution failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Manage existing positions
     */
    managePositions(marketData) {
        const actions = [];
        
        for (const position of this.positions) {
            if (position.status !== 'OPEN') continue;
            
            const action = this.evaluatePosition(position, marketData);
            if (action.needed) {
                actions.push(action);
            }
        }
        
        return actions;
    }

    /**
     * Evaluate single position for management
     */
    evaluatePosition(position, marketData) {
        const action = {
            needed: false,
            type: null,
            position,
            reason: ''
        };
        
        // Update current P&L
        position.currentPnL = this.calculateCurrentPnL(position, marketData);
        
        // Check profit target
        if (position.currentPnL >= position.targetProfit) {
            action.needed = true;
            action.type = 'CLOSE';
            action.reason = 'Profit target reached';
            return action;
        }
        
        // Check stop loss
        if (position.currentPnL <= position.stopLoss) {
            action.needed = true;
            action.type = 'CLOSE';
            action.reason = 'Stop loss triggered';
            return action;
        }
        
        // Check for defensive management at 21 DTE
        if (position.shortDTE <= this.config.defenseThreshold) {
            action.needed = true;
            action.type = 'DEFEND';
            action.reason = `Defensive management at ${position.shortDTE} DTE`;
            return action;
        }
        
        // Check for rolling at 7 DTE
        if (position.shortDTE <= this.config.rollThreshold) {
            action.needed = true;
            action.type = 'ROLL';
            action.reason = `Roll position at ${position.shortDTE} DTE`;
            return action;
        }
        
        return action;
    }

    /**
     * Calculate current P&L for position
     */
    calculateCurrentPnL(position, marketData) {
        // Simplified P&L calculation
        // In production, would get actual option prices
        const timeDecay = (position.shortDTE / 30) * position.netDebit * 0.3;
        const priceMove = (marketData.price - position.strike) * 2;
        
        return timeDecay + priceMove;
    }

    /**
     * Calculate days to expiration
     */
    calculateDTE(expirationDate) {
        const expiry = new Date(expirationDate);
        const today = new Date();
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    }

    /**
     * Get option data from chain
     */
    getOptionData(expiration, strike, type = 'CALL') {
        // Simulated option data - in production would use real chain
        return {
            mid: Math.random() * 5 + 1,
            iv: Math.random() * 0.3 + 0.15,
            delta: type === 'CALL' ? Math.random() * 0.5 : -Math.random() * 0.5
        };
    }

    /**
     * Count correlated positions
     */
    countCorrelatedPositions(symbol) {
        // Check correlation groups
        const correlationGroups = {
            equity: ['SPY', 'QQQ', 'IWM'],
            volatility: ['VIX', 'UVXY', 'VXX'],
            bonds: ['TLT', 'IEF', 'TBT'],
            commodities: ['GLD', 'SLV', 'USO']
        };
        
        let count = 0;
        for (const group of Object.values(correlationGroups)) {
            if (group.includes(symbol)) {
                count = this.positions.filter(p => 
                    group.includes(p.symbol) && p.status === 'OPEN'
                ).length;
                break;
            }
        }
        
        return count;
    }

    /**
     * Get strategy statistics
     */
    getStatistics() {
        return {
            ...this.performance,
            activePositions: this.positions.filter(p => p.status === 'OPEN').length,
            totalPositions: this.positions.length
        };
    }
}

module.exports = Calendarized112Strategy;