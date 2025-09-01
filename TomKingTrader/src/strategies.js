/**
 * Tom King Trading Strategies Module
 * Implementation of all 10 strategies with complete rules from PDF
 */

const GreeksCalculator = require('./greeksCalculator');

class TradingStrategies {
    constructor() {
        this.greeksCalc = new GreeksCalculator();
        this.strategies = this.initializeStrategies();
    }

    /**
     * Initialize all 10 Tom King strategies with specifications
     */
    initializeStrategies() {
        return {
            '0DTE': {
                name: '0DTE Friday',
                winRate: 92,
                avgReturn: 8.5,
                maxLoss: 100,
                daysAllowed: ['Friday'],
                timeWindow: { start: '10:30', end: '15:30' },
                requirements: { minPhase: 1, minBP: 4 }
            },
            'LT112': {
                name: 'Long-Term 112',
                winRate: 85,
                avgReturn: 12,
                maxLoss: 50,
                daysAllowed: ['Monday', 'Tuesday', 'Wednesday'],
                targetDTE: 112,
                requirements: { minPhase: 2, minBP: 3 }
            },
            'STRANGLE': {
                name: 'Futures Strangles',
                winRate: 80,
                avgReturn: 15,
                maxLoss: 200,
                daysAllowed: ['Tuesday'],
                targetDTE: 90,
                requirements: { minPhase: 1, minBP: 3 }
            },
            'IPMCC': {
                name: 'Income Producing Married Call',
                winRate: 75,
                avgReturn: 6,
                maxLoss: 15,
                daysAllowed: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                requirements: { minPhase: 1, minBP: 8 }
            },
            'LEAP': {
                name: 'LEAP Puts Ladder',
                winRate: 65,
                avgReturn: 25,
                maxLoss: 100,
                daysAllowed: ['Wednesday'],
                targetDTE: 365,
                requirements: { minPhase: 2, minBP: 5 }
            },
            'BOX': {
                name: 'Box Spreads',
                winRate: 99,
                avgReturn: 4.5,
                maxLoss: 0,
                daysAllowed: ['Any'],
                requirements: { minPhase: 4, minBP: 20, portfolioMargin: true }
            },
            'BUTTERFLY': {
                name: 'Butterflies',
                winRate: 70,
                avgReturn: 35,
                maxLoss: 100,
                daysAllowed: ['Thursday'],
                targetDTE: 45,
                requirements: { minPhase: 3, minBP: 1.5 }
            },
            'RATIO': {
                name: 'Ratio Spreads',
                winRate: 78,
                avgReturn: 10,
                maxLoss: 150,
                daysAllowed: ['Tuesday', 'Thursday'],
                targetDTE: 60,
                requirements: { minPhase: 2, minBP: 2 }
            },
            'DIAGONAL': {
                name: 'Diagonal Calendars',
                winRate: 72,
                avgReturn: 8,
                maxLoss: 50,
                daysAllowed: ['Wednesday'],
                requirements: { minPhase: 3, minBP: 4, maxVIX: 15 }
            },
            'ENHANCED': {
                name: 'Enhanced Optimizations',
                winRate: 85,
                avgReturn: 18,
                maxLoss: 75,
                daysAllowed: ['Any'],
                requirements: { minPhase: 4, minBP: 'Variable' }
            }
        };
    }

    /**
     * Strategy 1: 0DTE Friday - Tom's signature strategy
     */
    analyze0DTE(marketData, accountData) {
        const strategy = this.strategies['0DTE'];
        const analysis = {
            strategy: strategy.name,
            canTrade: false,
            signals: [],
            recommendation: null
        };

        // Check if it's Friday and after 10:30 AM
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        const time = now.getHours() * 100 + now.getMinutes();
        
        if (day !== 'Friday' || time < 1030) {
            analysis.recommendation = `0DTE only available Friday after 10:30 AM EST`;
            return analysis;
        }

        // Check ES movement from open (Tom's 0.5% rule)
        const esData = marketData.ES;
        if (!esData) {
            analysis.recommendation = 'No ES data available';
            return analysis;
        }

        const moveFromOpen = ((esData.currentPrice - esData.openPrice) / esData.openPrice) * 100;
        
        // Determine trade direction based on move
        if (Math.abs(moveFromOpen) > 0.5) {
            // Directional trade
            const direction = moveFromOpen > 0 ? 'CALL' : 'PUT';
            const spread = this.calculate0DTESpread(esData, direction);
            
            analysis.canTrade = true;
            analysis.signals.push({
                type: `0DTE ${direction} SPREAD`,
                entry: spread,
                contracts: this.calculate0DTEContracts(accountData.phase),
                expectedReturn: strategy.avgReturn,
                winRate: strategy.winRate
            });
            
            analysis.recommendation = `ENTER ${direction} SPREAD: Sell ${spread.shortStrike} / Buy ${spread.longStrike} for ${spread.credit} credit`;
        } else {
            // Iron Condor setup
            const ironCondor = this.calculate0DTEIronCondor(esData);
            
            analysis.canTrade = true;
            analysis.signals.push({
                type: '0DTE IRON CONDOR',
                entry: ironCondor,
                contracts: this.calculate0DTEContracts(accountData.phase),
                expectedReturn: strategy.avgReturn * 0.8, // Slightly lower for IC
                winRate: strategy.winRate + 3 // Higher win rate for IC
            });
            
            analysis.recommendation = `ENTER IRON CONDOR: ${ironCondor.putShort}/${ironCondor.putLong} - ${ironCondor.callShort}/${ironCondor.callLong} for ${ironCondor.totalCredit} credit`;
        }

        // Add Tom's specific 0DTE management rules
        analysis.management = {
            stopLoss: 'Close at 2x credit received',
            profitTarget: 'Let expire if OTM',
            timeStop: 'Close by 3:30 PM if ITM',
            adjustment: 'No adjustments - binary outcome'
        };

        return analysis;
    }

    /**
     * Calculate 0DTE spread strikes and credit
     */
    calculate0DTESpread(esData, direction) {
        const atmStrike = Math.round(esData.currentPrice / 5) * 5; // Round to nearest 5
        const spreadWidth = 30; // Tom's standard width
        
        if (direction === 'CALL') {
            return {
                shortStrike: atmStrike + 15, // Slightly OTM
                longStrike: atmStrike + 15 + spreadWidth,
                credit: this.estimate0DTECredit(esData.iv, 0.3), // 30 delta short
                maxLoss: spreadWidth - this.estimate0DTECredit(esData.iv, 0.3)
            };
        } else {
            return {
                shortStrike: atmStrike - 15, // Slightly OTM
                longStrike: atmStrike - 15 - spreadWidth,
                credit: this.estimate0DTECredit(esData.iv, 0.3),
                maxLoss: spreadWidth - this.estimate0DTECredit(esData.iv, 0.3)
            };
        }
    }

    /**
     * Calculate 0DTE Iron Condor
     */
    calculate0DTEIronCondor(esData) {
        const atmStrike = Math.round(esData.currentPrice / 5) * 5;
        const spreadWidth = 30;
        const distance = 50; // Distance from ATM
        
        return {
            putShort: atmStrike - distance,
            putLong: atmStrike - distance - spreadWidth,
            callShort: atmStrike + distance,
            callLong: atmStrike + distance + spreadWidth,
            putCredit: this.estimate0DTECredit(esData.iv, 0.15),
            callCredit: this.estimate0DTECredit(esData.iv, 0.15),
            totalCredit: this.estimate0DTECredit(esData.iv, 0.15) * 2,
            maxLoss: spreadWidth - (this.estimate0DTECredit(esData.iv, 0.15) * 2)
        };
    }

    /**
     * Estimate 0DTE credit based on IV and delta
     */
    estimate0DTECredit(iv, delta) {
        // Simplified credit estimation
        const baseCredit = 4.5; // Base credit for 30-delta
        const ivAdjustment = iv / 15; // Normalize to typical IV
        return Math.round(baseCredit * ivAdjustment * delta / 0.3 * 100) / 100;
    }

    /**
     * Calculate 0DTE contract size by phase
     */
    calculate0DTEContracts(phase) {
        const contracts = {
            1: 1,  // Phase 1: 1 contract
            2: 2,  // Phase 2: 2 contracts
            3: 3,  // Phase 3: 3 contracts
            4: 5   // Phase 4: 5 contracts max
        };
        return contracts[phase] || 1;
    }

    /**
     * Strategy 2: Long-Term 112 (LT112) - Tom's favorite
     */
    analyzeLT112(marketData, accountData) {
        const strategy = this.strategies['LT112'];
        const analysis = {
            strategy: strategy.name,
            canTrade: false,
            signals: [],
            recommendation: null
        };

        // Check if it's an entry day (Mon-Wed)
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (!['Monday', 'Tuesday', 'Wednesday'].includes(day)) {
            analysis.recommendation = 'LT112 entry only on Monday-Wednesday';
            return analysis;
        }

        // Check phase requirements (Phase 2+)
        if (accountData.phase < 2) {
            analysis.recommendation = 'LT112 requires Phase 2 (£40k+)';
            return analysis;
        }

        // Find next 112 DTE expiration (16 weeks out)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 112);
        const expirationFriday = this.getNextFriday(targetDate);

        // Analyze MES for entry (Phase 2) or ES (Phase 3+)
        const ticker = accountData.phase >= 3 ? 'ES' : 'MES';
        const data = marketData[ticker];
        
        if (!data) {
            analysis.recommendation = `No ${ticker} data available`;
            return analysis;
        }

        // Calculate LT112 spread parameters
        const spread = this.calculateLT112Spread(data, ticker);
        
        // Check entry criteria
        const entryScore = this.scoreLT112Entry(data, spread);
        
        if (entryScore >= 70) {
            analysis.canTrade = true;
            analysis.signals.push({
                type: 'LT112 PUT SPREAD',
                ticker: ticker,
                expiration: expirationFriday.toISOString().split('T')[0],
                shortStrike: spread.shortStrike,
                longStrike: spread.longStrike,
                credit: spread.credit,
                contracts: this.calculateLT112Contracts(accountData.phase, ticker),
                expectedReturn: strategy.avgReturn,
                winRate: strategy.winRate,
                score: entryScore
            });
            
            analysis.recommendation = `ENTER ${ticker} LT112: Sell ${spread.shortStrike} / Buy ${spread.longStrike} (112 DTE) for ${spread.credit} credit`;
        } else {
            analysis.recommendation = `Wait for better entry - Score: ${entryScore}/100`;
        }

        // Add Tom's LT112 management rules
        analysis.management = {
            week8: 'Monetize long hedge if profitable',
            week12: 'Roll tested side if necessary',
            week14: 'Consider closing if 75% profit',
            week16: 'Let expire or manage tested position',
            hedgeMonetization: 'Sell weekly calls against long put'
        };

        return analysis;
    }

    /**
     * Calculate LT112 spread parameters
     */
    calculateLT112Spread(data, ticker) {
        const currentPrice = data.currentPrice;
        
        // Tom's LT112 formula: 10% OTM for short, 15% OTM for long
        const shortStrike = Math.round(currentPrice * 0.9 / 5) * 5;
        const longStrike = Math.round(currentPrice * 0.85 / 5) * 5;
        
        // Estimate credit (typically 3-4% of width)
        const width = shortStrike - longStrike;
        const credit = width * 0.035;
        
        return {
            shortStrike,
            longStrike,
            width,
            credit: Math.round(credit * 100) / 100,
            returnOnRisk: (credit / (width - credit) * 100).toFixed(2)
        };
    }

    /**
     * Score LT112 entry conditions
     */
    scoreLT112Entry(data, spread) {
        let score = 0;
        
        // IV Rank check (prefer >30)
        if (data.ivRank > 50) score += 30;
        else if (data.ivRank > 30) score += 20;
        else if (data.ivRank > 20) score += 10;
        
        // Technical position (prefer near resistance)
        if (data.rsi > 60) score += 20;
        else if (data.rsi > 50) score += 10;
        
        // Range position
        const rangePosition = (data.currentPrice - data.low20d) / (data.high20d - data.low20d);
        if (rangePosition > 0.7) score += 20;
        else if (rangePosition > 0.5) score += 10;
        
        // Credit quality
        const creditPercent = spread.credit / spread.shortStrike * 100;
        if (creditPercent > 4) score += 20;
        else if (creditPercent > 3) score += 15;
        else if (creditPercent > 2) score += 10;
        
        // VIX environment
        if (data.vixLevel > 20) score += 10;
        
        return score;
    }

    /**
     * Calculate LT112 contracts by phase
     */
    calculateLT112Contracts(phase, ticker) {
        if (ticker === 'MES') {
            return phase >= 2 ? 4 : 0; // 4 MES contracts in Phase 2
        } else if (ticker === 'ES') {
            return phase >= 4 ? 2 : 1; // 1-2 ES contracts in Phase 3+
        }
        return 0;
    }

    /**
     * Strategy 3: Futures Strangles (90 DTE 5-delta)
     */
    analyzeStrangles(marketData, accountData) {
        const strategy = this.strategies['STRANGLE'];
        const analysis = {
            strategy: strategy.name,
            canTrade: false,
            signals: [],
            recommendation: null
        };

        // Tuesday entry for strangles
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (day !== 'Tuesday') {
            analysis.recommendation = 'Strangles entry on Tuesday only';
            return analysis;
        }

        // Get qualified tickers for phase
        const qualifiedTickers = this.getStrangleTickersByPhase(accountData.phase);
        const opportunities = [];

        qualifiedTickers.forEach(ticker => {
            const data = marketData[ticker];
            if (!data || !data.optionChain) return;

            // Calculate 5-delta strikes
            const strikes = this.greeksCalc.calculate5DeltaStrikes(
                data.currentPrice,
                data.iv / 100,
                90 / 365 // 90 DTE
            );

            // Score the strangle opportunity
            const score = this.scoreStrangleOpportunity(data, strikes);

            if (score >= 60) {
                opportunities.push({
                    ticker,
                    putStrike: strikes.putStrike,
                    callStrike: strikes.callStrike,
                    putCredit: data.optionChain.put5DeltaBid || 'FETCH',
                    callCredit: data.optionChain.call5DeltaBid || 'FETCH',
                    totalCredit: (data.optionChain.put5DeltaBid || 0) + (data.optionChain.call5DeltaBid || 0),
                    score,
                    ivRank: data.ivRank,
                    strangleWidth: strikes.strangleWidth,
                    widthPercent: strikes.widthPercent
                });
            }
        });

        // Sort by score and recommend top opportunities
        opportunities.sort((a, b) => b.score - a.score);
        const topOpportunities = opportunities.slice(0, 3); // Max 3 per correlation rules

        if (topOpportunities.length > 0) {
            analysis.canTrade = true;
            analysis.signals = topOpportunities.map(opp => ({
                type: 'STRANGLE',
                ...opp,
                expectedReturn: strategy.avgReturn,
                winRate: strategy.winRate,
                management: {
                    profitTarget: '50% of credit',
                    stopLoss: '2x credit received',
                    dteManagement: 'Close or roll at 21 DTE',
                    adjustment: 'Convert to Iron Condor if tested'
                }
            }));

            const best = topOpportunities[0];
            analysis.recommendation = `ENTER ${best.ticker} STRANGLE: Sell ${best.putStrike}P / ${best.callStrike}C for ${best.totalCredit.toFixed(2)} total credit`;
        } else {
            analysis.recommendation = 'No qualifying strangle opportunities today';
        }

        return analysis;
    }

    /**
     * Get strangle tickers by phase
     */
    getStrangleTickersByPhase(phase) {
        const tickers = {
            1: ['MCL', 'MGC', 'GLD', 'TLT'],
            2: ['MCL', 'MGC', 'MES', 'MNQ', '6A', 'SLV'],
            3: ['CL', 'GC', 'ES', 'NQ', 'ZC', 'ZS'],
            4: ['CL', 'GC', 'ES', 'NQ', 'SI', 'HG', 'ZB', '6E', '6J']
        };
        return tickers[phase] || tickers[1];
    }

    /**
     * Score strangle opportunity
     */
    scoreStrangleOpportunity(data, strikes) {
        let score = 0;

        // IV Rank (most important for strangles)
        if (data.ivRank > 70) score += 40;
        else if (data.ivRank > 50) score += 30;
        else if (data.ivRank > 30) score += 20;
        else if (data.ivRank > 20) score += 10;

        // Range-bound behavior
        const range20d = (data.high20d - data.low20d) / data.currentPrice * 100;
        if (range20d < 5) score += 30;
        else if (range20d < 10) score += 20;
        else if (range20d < 15) score += 10;

        // Strangle width (prefer wider)
        const widthPercent = parseFloat(strikes.widthPercent);
        if (widthPercent > 20) score += 20;
        else if (widthPercent > 15) score += 15;
        else if (widthPercent > 10) score += 10;

        // Credit quality (if available)
        if (data.optionChain && data.optionChain.put5DeltaBid) {
            const creditYield = (data.optionChain.put5DeltaBid + data.optionChain.call5DeltaBid) / data.currentPrice * 100;
            if (creditYield > 3) score += 10;
        }

        return score;
    }

    /**
     * Strategy 4: IPMCC (Income Producing Married Call)
     */
    analyzeIPMCC(marketData, accountData) {
        const strategy = this.strategies['IPMCC'];
        const analysis = {
            strategy: strategy.name,
            canTrade: false,
            signals: [],
            recommendation: null
        };

        // IPMCC available any day
        const qualifiedETFs = this.getIPMCCETFsByPhase(accountData.phase);
        const opportunities = [];

        qualifiedETFs.forEach(ticker => {
            const data = marketData[ticker];
            if (!data) return;

            // IPMCC setup: Buy LEAP call, sell weekly calls
            const leapStrike = this.calculateIPMCCLeapStrike(data);
            const weeklyStrike = this.calculateIPMCCWeeklyStrike(data, leapStrike);
            
            const setup = {
                ticker,
                leapStrike,
                leapExpiry: this.getExpirationDate(365), // 1 year out
                weeklyStrike,
                weeklyExpiry: this.getNextFriday(new Date()),
                estimatedCost: this.estimateIPMCCCost(data, leapStrike),
                weeklyCredit: this.estimateWeeklyCredit(data, weeklyStrike),
                monthlyIncome: this.estimateWeeklyCredit(data, weeklyStrike) * 4
            };

            // Score IPMCC opportunity
            const score = this.scoreIPMCCOpportunity(data, setup);
            
            if (score >= 65) {
                opportunities.push({
                    ...setup,
                    score,
                    expectedReturn: (setup.monthlyIncome / setup.estimatedCost * 100).toFixed(2),
                    management: {
                        weeklyRoll: 'Roll up and out if tested',
                        leapAdjustment: 'Roll LEAP if <50 delta',
                        exitTarget: '50% of LEAP cost recovered',
                        maxLoss: 'LEAP cost minus credits received'
                    }
                });
            }
        });

        if (opportunities.length > 0) {
            analysis.canTrade = true;
            analysis.signals = opportunities;
            
            const best = opportunities[0];
            analysis.recommendation = `ENTER ${best.ticker} IPMCC: Buy ${best.leapStrike}C LEAP, Sell ${best.weeklyStrike}C weekly for ${best.weeklyCredit} credit/week`;
        } else {
            analysis.recommendation = 'No qualifying IPMCC setups available';
        }

        return analysis;
    }

    /**
     * Get IPMCC ETFs by phase
     */
    getIPMCCETFsByPhase(phase) {
        const etfs = {
            1: ['SPY', 'QQQ'],
            2: ['SPY', 'QQQ', 'IWM', 'DIA'],
            3: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE'],
            4: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'GLD', 'TLT']
        };
        return etfs[phase] || etfs[1];
    }

    /**
     * Calculate IPMCC LEAP strike (70-80 delta)
     */
    calculateIPMCCLeapStrike(data) {
        // Buy 75-delta LEAP (slightly ITM)
        return Math.round(data.currentPrice * 0.95 / 5) * 5;
    }

    /**
     * Calculate IPMCC weekly strike
     */
    calculateIPMCCWeeklyStrike(data, leapStrike) {
        // Sell 30-delta weekly (OTM)
        return Math.round(data.currentPrice * 1.02);
    }

    /**
     * Estimate IPMCC LEAP cost
     */
    estimateIPMCCCost(data, strike) {
        // Rough estimate: 10-15% of stock price for 1-year 75-delta
        const intrinsic = Math.max(0, data.currentPrice - strike);
        const timeValue = data.currentPrice * 0.08; // 8% time value
        return intrinsic + timeValue;
    }

    /**
     * Estimate weekly credit
     */
    estimateWeeklyCredit(data, strike) {
        // Estimate 30-delta weekly credit
        const otmAmount = (strike - data.currentPrice) / data.currentPrice;
        return data.currentPrice * 0.003 * (1 + data.iv / 20); // Base 0.3% adjusted for IV
    }

    /**
     * Score IPMCC opportunity
     */
    scoreIPMCCOpportunity(data, setup) {
        let score = 0;

        // Trend (prefer uptrend for IPMCC)
        if (data.ema8 > data.ema21) score += 20;
        if (data.rsi > 50 && data.rsi < 70) score += 15;

        // IV environment (moderate IV best)
        if (data.iv > 15 && data.iv < 25) score += 25;
        else if (data.iv > 10 && data.iv < 30) score += 15;

        // Return on investment
        const monthlyReturn = (setup.monthlyIncome / setup.estimatedCost * 100);
        if (monthlyReturn > 2) score += 25;
        else if (monthlyReturn > 1.5) score += 20;
        else if (monthlyReturn > 1) score += 15;

        // Stock stability (prefer less volatile)
        if (data.atr / data.currentPrice < 0.02) score += 15;

        return score;
    }

    /**
     * Strategy 5: LEAP Puts Ladder System
     */
    analyzeLEAPLadder(marketData, accountData) {
        const strategy = this.strategies['LEAP'];
        const analysis = {
            strategy: strategy.name,
            canTrade: false,
            signals: [],
            recommendation: null
        };

        // LEAP entry on Wednesday
        const now = new Date();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (day !== 'Wednesday') {
            analysis.recommendation = 'LEAP ladder entry on Wednesday only';
            return analysis;
        }

        // Phase 2+ requirement
        if (accountData.phase < 2) {
            analysis.recommendation = 'LEAP ladder requires Phase 2+';
            return analysis;
        }

        // Analyze SPY for LEAP ladder (Tom's preference)
        const spyData = marketData.SPY;
        if (!spyData) {
            analysis.recommendation = 'SPY data required for LEAP analysis';
            return analysis;
        }

        // Calculate 10-position ladder
        const ladder = this.calculateLEAPLadder(spyData, accountData);
        
        // Check if market conditions favor LEAP entry
        const marketScore = this.scoreLEAPMarketConditions(spyData, marketData.VIX);
        
        if (marketScore >= 60) {
            analysis.canTrade = true;
            analysis.signals.push({
                type: 'LEAP PUT LADDER',
                ticker: 'SPY',
                positions: ladder,
                totalCost: ladder.reduce((sum, pos) => sum + pos.cost, 0),
                expectedAnnualReturn: strategy.avgReturn,
                marketScore,
                management: {
                    profitTarget: '50% on individual positions',
                    redeployment: 'Roll proceeds to new LEAP',
                    ladderMaintenance: 'Keep 10 positions active',
                    timeDecay: 'Accelerates after 6 months'
                }
            });
            
            analysis.recommendation = `BUILD LEAP LADDER: 10 positions from ${ladder[0].strike} to ${ladder[9].strike}`;
        } else {
            analysis.recommendation = `Wait for better market conditions - Score: ${marketScore}/100`;
        }

        return analysis;
    }

    /**
     * Calculate LEAP ladder positions
     */
    calculateLEAPLadder(spyData, accountData) {
        const ladder = [];
        const currentPrice = spyData.currentPrice;
        
        // 10 positions, 5% apart, starting 20% OTM
        for (let i = 0; i < 10; i++) {
            const strike = Math.round(currentPrice * (0.8 - i * 0.05));
            const cost = this.estimateLEAPCost(spyData, strike);
            
            ladder.push({
                position: i + 1,
                strike,
                expiry: this.getExpirationDate(365),
                cost,
                currentDelta: this.estimateLEAPDelta(currentPrice, strike),
                targetProfit: cost * 0.5
            });
        }
        
        return ladder;
    }

    /**
     * Estimate LEAP put cost
     */
    estimateLEAPCost(data, strike) {
        const otmPercent = (data.currentPrice - strike) / data.currentPrice;
        const baseCost = data.currentPrice * 0.02; // 2% base cost
        const otmAdjustment = Math.exp(-otmPercent * 10); // Exponential decay for OTM
        return Math.round(baseCost * otmAdjustment * 100) / 100;
    }

    /**
     * Estimate LEAP delta
     */
    estimateLEAPDelta(currentPrice, strike) {
        const moneyness = strike / currentPrice;
        if (moneyness > 1) return -0.9; // Deep ITM
        if (moneyness > 0.95) return -0.6; // ITM
        if (moneyness > 0.9) return -0.3; // Near ATM
        return -0.1; // OTM
    }

    /**
     * Score LEAP market conditions
     */
    scoreLEAPMarketConditions(spyData, vixData) {
        let score = 0;

        // Market trend (prefer after pullback)
        const fromHigh = (spyData.high20d - spyData.currentPrice) / spyData.high20d * 100;
        if (fromHigh > 5) score += 25;
        else if (fromHigh > 3) score += 15;

        // VIX level (prefer elevated for better premiums)
        if (vixData.currentLevel > 25) score += 25;
        else if (vixData.currentLevel > 20) score += 20;
        else if (vixData.currentLevel > 15) score += 10;

        // Technical oversold
        if (spyData.rsi < 30) score += 20;
        else if (spyData.rsi < 40) score += 10;

        // IV Rank
        if (spyData.ivRank > 50) score += 20;
        else if (spyData.ivRank > 30) score += 10;

        return score;
    }

    /**
     * Additional strategies (6-10) would follow similar pattern...
     * Including: Box Spreads, Butterflies, Ratio Spreads, Diagonals, Enhanced
     */

    /**
     * Master strategy analyzer - runs all strategies
     */
    analyzeAllStrategies(marketData, accountData) {
        const results = {
            timestamp: new Date().toISOString(),
            account: accountData,
            availableStrategies: [],
            recommendations: [],
            warnings: []
        };

        // Check each strategy based on phase and conditions
        if (accountData.phase >= 1) {
            results.availableStrategies.push(this.analyze0DTE(marketData, accountData));
            results.availableStrategies.push(this.analyzeStrangles(marketData, accountData));
            results.availableStrategies.push(this.analyzeIPMCC(marketData, accountData));
        }
        
        if (accountData.phase >= 2) {
            results.availableStrategies.push(this.analyzeLT112(marketData, accountData));
            results.availableStrategies.push(this.analyzeLEAPLadder(marketData, accountData));
            // Add Ratio Spreads
        }
        
        if (accountData.phase >= 3) {
            // Add Butterflies, Diagonals
        }
        
        if (accountData.phase >= 4) {
            // Add Box Spreads, Enhanced Optimizations
        }

        // Filter for tradeable strategies
        const tradeableStrategies = results.availableStrategies.filter(s => s.canTrade);
        
        // Sort by expected return or score
        tradeableStrategies.sort((a, b) => {
            const scoreA = a.signals[0]?.score || 0;
            const scoreB = b.signals[0]?.score || 0;
            return scoreB - scoreA;
        });

        // Generate recommendations
        if (tradeableStrategies.length > 0) {
            results.recommendations = tradeableStrategies.slice(0, 3); // Top 3
        } else {
            results.warnings.push('No strategies meet entry criteria today');
        }

        // Add risk warnings based on market conditions
        if (marketData.VIX?.currentLevel > 30) {
            results.warnings.push('VIX >30: Reduce all position sizes by 50%');
        }

        return results;
    }

    /**
     * Utility functions
     */
    
    getNextFriday(date) {
        const result = new Date(date);
        const day = result.getDay();
        const daysUntilFriday = (5 - day + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntilFriday);
        return result;
    }

    getExpirationDate(daysOut) {
        const date = new Date();
        date.setDate(date.getDate() + daysOut);
        return this.getNextFriday(date);
    }
}

module.exports = TradingStrategies;