/**
 * Section 9B Advanced Strategies
 * Complete implementation of Tom King's advanced butterfly, condor, and complex spread strategies
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class Section9BStrategies {
    constructor(config = {}) {
        this.config = {
            maxButterflyWidth: config.maxButterflyWidth || 50,
            maxCondorWidth: config.maxCondorWidth || 100,
            minCredit: config.minCredit || 0.50,
            maxRiskPerTrade: config.maxRiskPerTrade || 0.05, // 5% max risk
            ironCondorProbability: config.ironCondorProbability || 0.70, // 70% OTM
            butterflyTargetProfit: config.butterflyTargetProfit || 0.50, // 50% of max profit
            ...config
        };
    }

    /**
     * Analyze all Section 9B opportunities
     */
    analyzeSection9B(marketData, accountData, currentDate = new Date()) {
        const analysis = {
            timestamp: currentDate,
            opportunities: [],
            recommendations: []
        };

        // Analyze each strategy type
        const butterflyAnalysis = this.analyzeEnhancedButterfly(marketData, accountData, currentDate);
        const ironCondorAnalysis = this.analyzeIronCondor(marketData, accountData, currentDate);
        const diagonalAnalysis = this.analyzeDiagonalSpreads(marketData, accountData, currentDate);
        const ratioAnalysis = this.analyzeRatioSpreads(marketData, accountData, currentDate);
        const brokenWingAnalysis = this.analyzeBrokenWingButterfly(marketData, accountData, currentDate);

        // Compile all opportunities
        if (butterflyAnalysis.canTrade) analysis.opportunities.push(butterflyAnalysis);
        if (ironCondorAnalysis.canTrade) analysis.opportunities.push(ironCondorAnalysis);
        if (diagonalAnalysis.canTrade) analysis.opportunities.push(diagonalAnalysis);
        if (ratioAnalysis.canTrade) analysis.opportunities.push(ratioAnalysis);
        if (brokenWingAnalysis.canTrade) analysis.opportunities.push(brokenWingAnalysis);

        // Sort by score and select best opportunities
        analysis.opportunities.sort((a, b) => b.score - a.score);
        
        logger.info('SECTION9B', 'Analysis complete', {
            opportunities: analysis.opportunities.length,
            topScore: analysis.opportunities[0]?.score || 0
        });

        return analysis;
    }

    /**
     * Enhanced Butterfly Strategy with Tom King's rules
     */
    analyzeEnhancedButterfly(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Enhanced Butterfly',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null,
            requiredBP: 0
        };

        const day = currentDate.getDay();
        const hour = currentDate.getHours();
        const minute = currentDate.getMinutes();

        // Tom King: Friday 10:35 AM entry after ES movement
        if (day !== 5 || hour < 10 || (hour === 10 && minute < 35)) {
            analysis.recommendation = 'Butterfly entry only on Friday after 10:35 AM';
            return analysis;
        }

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || marketData.ES || {};
        
        if (!spy.currentPrice || !spy.open) {
            analysis.recommendation = 'Missing SPY/ES data for butterfly analysis';
            return analysis;
        }

        // Calculate market movement
        const dayMove = ((spy.currentPrice - spy.open) / spy.open) * 100;
        const moveAbs = Math.abs(dayMove);

        // Tom King: Enter after 1% move
        if (moveAbs < 1) {
            analysis.recommendation = `Insufficient movement: ${moveAbs.toFixed(2)}% (need 1%+)`;
            return analysis;
        }

        // Determine butterfly type and strikes
        const butterflyType = dayMove > 0 ? 'PUT' : 'CALL';
        const atmStrike = this.roundToStrike(spy.currentPrice, 5);
        
        // Calculate wing strikes based on VIX
        const wingWidth = this.calculateOptimalWingWidth(vix, spy.currentPrice);
        const lowerStrike = atmStrike - wingWidth;
        const upperStrike = atmStrike + wingWidth;

        // Get option chain data
        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);
        
        // Find nearest expiration (0-7 DTE for butterflies)
        const targetDTE = 0; // Same day for Friday butterflies
        const expiration = this.findNearestExpiration(expirations, targetDTE);

        if (!expiration) {
            analysis.recommendation = 'No suitable expiration found';
            return analysis;
        }

        // Calculate prices and credit
        const butterflySetup = this.calculateButterflyPrices(
            optionChain[expiration],
            butterflyType,
            lowerStrike,
            atmStrike,
            upperStrike
        );

        if (!butterflySetup || butterflySetup.netCredit < this.config.minCredit) {
            analysis.recommendation = `Insufficient credit: $${butterflySetup?.netCredit || 0} (min: $${this.config.minCredit})`;
            return analysis;
        }

        // Calculate position size based on account
        const maxRisk = butterflySetup.maxLoss;
        const maxPositions = Math.floor((accountData.netLiq * this.config.maxRiskPerTrade) / maxRisk);
        const positions = Math.min(maxPositions, 10); // Cap at 10 butterflies

        // Score the opportunity
        const score = this.scoreButterflySetup(butterflySetup, moveAbs, vix);

        if (score >= 70) {
            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                type: butterflyType,
                strikes: {
                    lower: lowerStrike,
                    middle: atmStrike,
                    upper: upperStrike
                },
                expiration,
                netCredit: butterflySetup.netCredit,
                maxLoss: butterflySetup.maxLoss,
                maxProfit: butterflySetup.maxProfit,
                breakevens: butterflySetup.breakevens,
                positions,
                requiredBP: maxRisk * positions
            };
            
            analysis.recommendation = `ENTER ${positions}x ${butterflyType} Butterfly ` +
                `${lowerStrike}/${atmStrike}/${upperStrike} @ ${expiration} ` +
                `for $${(butterflySetup.netCredit * positions).toFixed(2)} credit`;
        } else {
            analysis.recommendation = `Setup score too low: ${score}/100 (need 70+)`;
        }

        return analysis;
    }

    /**
     * Iron Condor Strategy
     */
    analyzeIronCondor(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Iron Condor',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null
        };

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || {};

        // Iron condors work best in low-moderate volatility
        if (vix < 12 || vix > 25) {
            analysis.recommendation = `VIX outside ideal range: ${vix} (ideal: 12-25)`;
            return analysis;
        }

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);
        
        // Find 30-45 DTE expiration
        const targetDTE = 35;
        const expiration = this.findNearestExpiration(expirations, targetDTE);

        if (!expiration) {
            analysis.recommendation = 'No suitable expiration for iron condor';
            return analysis;
        }

        // Calculate strikes based on probability
        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        const expectedMove = spy.currentPrice * (vix / 100) * Math.sqrt(targetDTE / 365);
        
        // 70% OTM strikes
        const putShortStrike = Math.floor(atmStrike - expectedMove * 1.1);
        const putLongStrike = putShortStrike - 5;
        const callShortStrike = Math.ceil(atmStrike + expectedMove * 1.1);
        const callLongStrike = callShortStrike + 5;

        // Calculate condor prices
        const condorSetup = this.calculateIronCondorPrices(
            optionChain[expiration],
            putLongStrike,
            putShortStrike,
            callShortStrike,
            callLongStrike
        );

        if (!condorSetup || condorSetup.netCredit < 1.00) {
            analysis.recommendation = `Insufficient credit: $${condorSetup?.netCredit || 0}`;
            return analysis;
        }

        // Score the setup
        const score = this.scoreIronCondor(condorSetup, vix, expectedMove);

        if (score >= 65) {
            const maxPositions = Math.floor((accountData.netLiq * 0.10) / condorSetup.maxLoss);
            const positions = Math.min(maxPositions, 5);

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                putSide: { long: putLongStrike, short: putShortStrike },
                callSide: { long: callLongStrike, short: callShortStrike },
                expiration,
                netCredit: condorSetup.netCredit,
                maxLoss: condorSetup.maxLoss,
                positions,
                probability: condorSetup.probability,
                requiredBP: condorSetup.maxLoss * positions
            };

            analysis.recommendation = `ENTER ${positions}x Iron Condor ` +
                `${putLongStrike}/${putShortStrike}/${callShortStrike}/${callLongStrike} @ ${expiration}`;
        } else {
            analysis.recommendation = `Iron condor score too low: ${score}/100`;
        }

        return analysis;
    }

    /**
     * Diagonal Spread Strategy
     */
    analyzeDiagonalSpreads(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Diagonal Spread',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null
        };

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || {};

        // Diagonals work well in moderate volatility
        if (vix < 15 || vix > 30) {
            analysis.recommendation = `VIX not ideal for diagonals: ${vix}`;
            return analysis;
        }

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain).sort();

        if (expirations.length < 2) {
            analysis.recommendation = 'Need multiple expirations for diagonal';
            return analysis;
        }

        // Front month: 7-14 DTE, Back month: 35-45 DTE
        const frontExpiration = this.findNearestExpiration(expirations, 10);
        const backExpiration = this.findNearestExpiration(expirations, 40);

        if (!frontExpiration || !backExpiration) {
            analysis.recommendation = 'Cannot find suitable expirations';
            return analysis;
        }

        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        
        // Calculate diagonal spread value
        const diagonalSetup = this.calculateDiagonalSpread(
            optionChain[frontExpiration],
            optionChain[backExpiration],
            atmStrike,
            'CALL' // Can be CALL or PUT diagonal
        );

        if (!diagonalSetup) {
            analysis.recommendation = 'Cannot calculate diagonal prices';
            return analysis;
        }

        const score = this.scoreDiagonal(diagonalSetup, vix);

        if (score >= 60) {
            const maxPositions = Math.floor((accountData.netLiq * 0.05) / diagonalSetup.maxRisk);
            const positions = Math.min(maxPositions, 10);

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                type: 'CALL Diagonal',
                strike: atmStrike,
                frontExpiration,
                backExpiration,
                netDebit: diagonalSetup.netDebit,
                maxRisk: diagonalSetup.maxRisk,
                positions,
                requiredBP: diagonalSetup.maxRisk * positions
            };

            analysis.recommendation = `ENTER ${positions}x Call Diagonal ${atmStrike} ` +
                `${frontExpiration}/${backExpiration}`;
        }

        return analysis;
    }

    /**
     * Ratio Spread Strategy  
     */
    analyzeRatioSpreads(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Ratio Spread',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null
        };

        const vix = marketData.VIX?.currentPrice || 0;
        
        // Ratio spreads need high IV
        if (vix < 20) {
            analysis.recommendation = `VIX too low for ratio spreads: ${vix} (need 20+)`;
            return analysis;
        }

        const spy = marketData.SPY || {};
        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);

        // 21-35 DTE for ratio spreads
        const expiration = this.findNearestExpiration(expirations, 28);
        if (!expiration) {
            analysis.recommendation = 'No suitable expiration';
            return analysis;
        }

        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        
        // 1x2 Put ratio spread (buy 1 ATM, sell 2 OTM)
        const longStrike = atmStrike;
        const shortStrike = atmStrike - 10; // 10 points OTM

        const ratioSetup = this.calculateRatioSpread(
            optionChain[expiration],
            longStrike,
            shortStrike,
            1, // long quantity
            2  // short quantity
        );

        if (!ratioSetup) {
            analysis.recommendation = 'Cannot calculate ratio spread';
            return analysis;
        }

        const score = this.scoreRatioSpread(ratioSetup, vix);

        if (score >= 65) {
            const positions = Math.min(5, Math.floor(accountData.netLiq * 0.03 / ratioSetup.maxRisk));

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                type: '1x2 Put Ratio',
                longStrike,
                shortStrike,
                expiration,
                netCredit: ratioSetup.netCredit,
                maxRisk: ratioSetup.maxRisk,
                positions,
                requiredBP: ratioSetup.maxRisk * positions
            };

            analysis.recommendation = `ENTER ${positions}x 1x2 Put Ratio ${longStrike}/${shortStrike} @ ${expiration}`;
        }

        return analysis;
    }

    /**
     * Broken Wing Butterfly
     */
    analyzeBrokenWingButterfly(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Broken Wing Butterfly',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null
        };

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || {};

        // Broken wings work in moderate-high volatility
        if (vix < 18 || vix > 35) {
            analysis.recommendation = `VIX not ideal: ${vix} (ideal: 18-35)`;
            return analysis;
        }

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);

        // 14-21 DTE for broken wing
        const expiration = this.findNearestExpiration(expirations, 17);
        if (!expiration) {
            analysis.recommendation = 'No suitable expiration';
            return analysis;
        }

        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        
        // Asymmetric wings - wider on upside for call, downside for put
        const isCallBroken = spy.currentPrice > spy.open; // Bullish day = call broken wing
        
        let lowerStrike, middleStrike, upperStrike;
        if (isCallBroken) {
            lowerStrike = atmStrike - 5;
            middleStrike = atmStrike;
            upperStrike = atmStrike + 10; // Wider upper wing
        } else {
            lowerStrike = atmStrike - 10; // Wider lower wing
            middleStrike = atmStrike;
            upperStrike = atmStrike + 5;
        }

        const brokenWingSetup = this.calculateBrokenWingButterfly(
            optionChain[expiration],
            isCallBroken ? 'CALL' : 'PUT',
            lowerStrike,
            middleStrike,
            upperStrike
        );

        if (!brokenWingSetup || brokenWingSetup.netCredit < 0.25) {
            analysis.recommendation = `Insufficient credit: $${brokenWingSetup?.netCredit || 0}`;
            return analysis;
        }

        const score = this.scoreBrokenWing(brokenWingSetup, vix);

        if (score >= 70) {
            const maxPositions = Math.floor((accountData.netLiq * 0.04) / brokenWingSetup.maxRisk);
            const positions = Math.min(maxPositions, 8);

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                type: isCallBroken ? 'Call Broken Wing' : 'Put Broken Wing',
                strikes: { lower: lowerStrike, middle: middleStrike, upper: upperStrike },
                expiration,
                netCredit: brokenWingSetup.netCredit,
                maxRisk: brokenWingSetup.maxRisk,
                positions,
                requiredBP: brokenWingSetup.maxRisk * positions
            };

            analysis.recommendation = `ENTER ${positions}x ${analysis.setup.type} ` +
                `${lowerStrike}/${middleStrike}/${upperStrike} @ ${expiration}`;
        }

        return analysis;
    }

    // Helper Methods

    roundToStrike(price, increment) {
        return Math.round(price / increment) * increment;
    }

    findNearestExpiration(expirations, targetDTE) {
        const today = new Date();
        let closest = null;
        let minDiff = Infinity;

        for (const exp of expirations) {
            const expDate = new Date(exp);
            const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            const diff = Math.abs(dte - targetDTE);
            
            if (diff < minDiff) {
                minDiff = diff;
                closest = exp;
            }
        }

        return closest;
    }

    calculateOptimalWingWidth(vix, price) {
        // Wing width based on VIX
        const baseWidth = price * 0.01; // 1% of price
        const vixMultiplier = Math.sqrt(vix / 16); // Adjust for VIX
        return Math.round(baseWidth * vixMultiplier / 5) * 5; // Round to nearest 5
    }

    calculateButterflyPrices(chain, type, lower, middle, upper) {
        if (!chain || !chain[type]) return null;

        const lowerOption = chain[type][lower];
        const middleOption = chain[type][middle];
        const upperOption = chain[type][upper];

        if (!lowerOption || !middleOption || !upperOption) return null;

        // Butterfly: Buy 1 lower, Sell 2 middle, Buy 1 upper
        const netCredit = -lowerOption.ask + 2 * middleOption.bid - upperOption.ask;
        const maxLoss = (middle - lower) * 100 - netCredit * 100;
        const maxProfit = netCredit * 100;
        
        const lowerBreakeven = lower + netCredit;
        const upperBreakeven = upper - netCredit;

        return {
            netCredit: Math.max(0, netCredit),
            maxLoss,
            maxProfit,
            breakevens: [lowerBreakeven, upperBreakeven]
        };
    }

    calculateIronCondorPrices(chain, putLong, putShort, callShort, callLong) {
        if (!chain || !chain.PUT || !chain.CALL) return null;

        const putLongOpt = chain.PUT[putLong];
        const putShortOpt = chain.PUT[putShort];
        const callShortOpt = chain.CALL[callShort];
        const callLongOpt = chain.CALL[callLong];

        if (!putLongOpt || !putShortOpt || !callShortOpt || !callLongOpt) return null;

        // Iron Condor: Sell put spread and call spread
        const putSpreadCredit = putShortOpt.bid - putLongOpt.ask;
        const callSpreadCredit = callShortOpt.bid - callLongOpt.ask;
        const netCredit = putSpreadCredit + callSpreadCredit;

        const putSpreadWidth = putShort - putLong;
        const callSpreadWidth = callLong - callShort;
        const maxLoss = Math.max(putSpreadWidth, callSpreadWidth) * 100 - netCredit * 100;

        // Calculate probability of success (simplified)
        const probability = 0.70; // Placeholder - would use delta in real implementation

        return {
            netCredit,
            maxLoss,
            probability
        };
    }

    calculateDiagonalSpread(frontChain, backChain, strike, type) {
        if (!frontChain || !backChain) return null;

        const frontOption = frontChain[type]?.[strike];
        const backOption = backChain[type]?.[strike];

        if (!frontOption || !backOption) return null;

        // Diagonal: Sell front month, Buy back month
        const netDebit = backOption.ask - frontOption.bid;
        const maxRisk = netDebit * 100;

        return {
            netDebit,
            maxRisk,
            frontIV: frontOption.iv || 0,
            backIV: backOption.iv || 0
        };
    }

    calculateRatioSpread(chain, longStrike, shortStrike, longQty, shortQty) {
        if (!chain || !chain.PUT) return null;

        const longOption = chain.PUT[longStrike];
        const shortOption = chain.PUT[shortStrike];

        if (!longOption || !shortOption) return null;

        const longCost = longOption.ask * longQty;
        const shortCredit = shortOption.bid * shortQty;
        const netCredit = shortCredit - longCost;

        // Max risk is unlimited below short strike (in theory)
        // In practice, we set a reasonable max risk
        const maxRisk = (shortStrike - 20) * 100 * (shortQty - longQty);

        return {
            netCredit,
            maxRisk
        };
    }

    calculateBrokenWingButterfly(chain, type, lower, middle, upper) {
        if (!chain || !chain[type]) return null;

        const lowerOption = chain[type][lower];
        const middleOption = chain[type][middle];  
        const upperOption = chain[type][upper];

        if (!lowerOption || !middleOption || !upperOption) return null;

        // Same as regular butterfly but with asymmetric wings
        const netCredit = -lowerOption.ask + 2 * middleOption.bid - upperOption.ask;
        
        // Max risk depends on which wing is wider
        const lowerWing = middle - lower;
        const upperWing = upper - middle;
        const widerWing = Math.max(lowerWing, upperWing);
        
        const maxRisk = (widerWing * 100) - (netCredit * 100);

        return {
            netCredit: Math.max(0, netCredit),
            maxRisk,
            lowerWing,
            upperWing
        };
    }

    // Scoring Methods

    scoreButterflySetup(setup, movePercent, vix) {
        let score = 0;

        // Movement size (1-3% ideal)
        if (movePercent >= 1 && movePercent <= 3) score += 30;
        else if (movePercent > 3) score += 15;

        // VIX level (18-25 ideal)
        if (vix >= 18 && vix <= 25) score += 25;
        else if (vix >= 15 && vix <= 30) score += 15;

        // Credit received
        if (setup.netCredit >= 1) score += 25;
        else if (setup.netCredit >= 0.5) score += 15;

        // Risk/reward ratio
        const rrRatio = setup.maxProfit / setup.maxLoss;
        if (rrRatio >= 0.5) score += 20;
        else if (rrRatio >= 0.3) score += 10;

        return Math.min(100, score);
    }

    scoreIronCondor(setup, vix, expectedMove) {
        let score = 0;

        // VIX range (12-25 ideal)
        if (vix >= 12 && vix <= 20) score += 30;
        else if (vix <= 25) score += 20;

        // Credit received
        if (setup.netCredit >= 1.5) score += 25;
        else if (setup.netCredit >= 1.0) score += 15;

        // Probability of profit
        if (setup.probability >= 0.70) score += 25;
        else if (setup.probability >= 0.65) score += 15;

        // Risk/reward
        const rrRatio = setup.netCredit / (setup.maxLoss / 100);
        if (rrRatio >= 0.33) score += 20;

        return Math.min(100, score);
    }

    scoreDiagonal(setup, vix) {
        let score = 0;

        // IV differential (front > back is ideal)
        const ivDiff = setup.frontIV - setup.backIV;
        if (ivDiff > 0.05) score += 30;
        else if (ivDiff > 0) score += 20;

        // VIX level
        if (vix >= 15 && vix <= 25) score += 25;
        else if (vix <= 30) score += 15;

        // Net debit (lower is better)
        if (setup.netDebit <= 2) score += 25;
        else if (setup.netDebit <= 3) score += 15;

        // Add base score for viable setup
        score += 20;

        return Math.min(100, score);
    }

    scoreRatioSpread(setup, vix) {
        let score = 0;

        // High VIX needed
        if (vix >= 25) score += 30;
        else if (vix >= 20) score += 20;

        // Net credit
        if (setup.netCredit > 0) score += 30;

        // Risk control
        if (setup.maxRisk < 5000) score += 25;

        // Base viability
        score += 15;

        return Math.min(100, score);
    }

    scoreBrokenWing(setup, vix) {
        let score = 0;

        // VIX range
        if (vix >= 20 && vix <= 30) score += 30;
        else if (vix >= 18 && vix <= 35) score += 20;

        // Net credit
        if (setup.netCredit >= 0.5) score += 30;
        else if (setup.netCredit >= 0.25) score += 20;

        // Wing asymmetry (more asymmetric = better for broken wing)
        const asymmetry = Math.abs(setup.upperWing - setup.lowerWing);
        if (asymmetry >= 5) score += 25;
        else if (asymmetry >= 3) score += 15;

        // Base score
        score += 15;

        return Math.min(100, score);
    }
}

module.exports = { Section9BStrategies };