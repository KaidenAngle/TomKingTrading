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
        const batmanAnalysis = this.analyzeBatmanSpread(marketData, accountData, currentDate);
        const brokenWingCondorAnalysis = this.analyzeBrokenWingCondor(marketData, accountData, currentDate);

        // Compile all opportunities
        if (butterflyAnalysis.canTrade) analysis.opportunities.push(butterflyAnalysis);
        if (ironCondorAnalysis.canTrade) analysis.opportunities.push(ironCondorAnalysis);
        if (diagonalAnalysis.canTrade) analysis.opportunities.push(diagonalAnalysis);
        if (ratioAnalysis.canTrade) analysis.opportunities.push(ratioAnalysis);
        if (brokenWingAnalysis.canTrade) analysis.opportunities.push(brokenWingAnalysis);
        if (batmanAnalysis.canTrade) analysis.opportunities.push(batmanAnalysis);
        if (brokenWingCondorAnalysis.canTrade) analysis.opportunities.push(brokenWingCondorAnalysis);

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
     * Iron Condor Strategy with Advanced Management
     */
    analyzeIronCondor(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Iron Condor',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null,
            adjustments: []
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
     * Enhanced Diagonal Spread Strategy with IV Skew Analysis
     * Tom King methodology: Focus on IV term structure and skew opportunities
     */
    analyzeDiagonalSpreads(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Diagonal Spread',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null,
            ivAnalysis: null
        };

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || {};
        const currentPrice = spy.currentPrice || 0;

        // Tom King's diagonal entry criteria
        // Best between VIX 15-28 with IV backwardation
        if (vix < 15) {
            analysis.recommendation = `VIX too low for diagonals: ${vix} (need >15)`;
            return analysis;
        }
        if (vix > 35) {
            analysis.recommendation = `VIX too high for diagonals: ${vix} (prefer <35)`;
            return analysis;
        }

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain).sort();

        if (expirations.length < 3) {
            analysis.recommendation = 'Need at least 3 expirations for proper diagonal analysis';
            return analysis;
        }

        // Tom King's optimal DTE selection
        // Front: 7-14 DTE (weekly decay acceleration)
        // Back: 35-50 DTE (monthly stability)
        const frontDTE = vix > 25 ? 7 : 10;  // Shorter front in high vol
        const backDTE = vix > 25 ? 35 : 45;  // Shorter back in high vol
        
        const frontExpiration = this.findNearestExpiration(expirations, frontDTE);
        const backExpiration = this.findNearestExpiration(expirations, backDTE);

        if (!frontExpiration || !backExpiration) {
            analysis.recommendation = 'Cannot find suitable expirations for diagonal';
            return analysis;
        }

        // Analyze IV term structure
        const ivTermStructure = this.analyzeIVTermStructure(
            optionChain,
            frontExpiration,
            backExpiration,
            currentPrice
        );

        if (!ivTermStructure || !ivTermStructure.hasBackwardation) {
            analysis.recommendation = 'No IV backwardation - diagonal not optimal';
            analysis.ivAnalysis = ivTermStructure;
            return analysis;
        }

        // Determine diagonal type based on market bias
        const marketBias = this.detectMarketBias(marketData);
        const diagonalType = this.selectDiagonalType(marketBias, vix, ivTermStructure);
        
        // Strike selection based on Tom King rules
        const strikeSelection = this.selectDiagonalStrikes(
            currentPrice,
            diagonalType,
            marketBias,
            vix
        );

        // Calculate both CALL and PUT diagonal opportunities
        const callDiagonal = this.calculateEnhancedDiagonal(
            optionChain[frontExpiration],
            optionChain[backExpiration],
            strikeSelection.callStrike,
            'CALL',
            ivTermStructure
        );

        const putDiagonal = this.calculateEnhancedDiagonal(
            optionChain[frontExpiration],
            optionChain[backExpiration],
            strikeSelection.putStrike,
            'PUT',
            ivTermStructure
        );

        // Select best diagonal based on scores
        const callScore = callDiagonal ? this.scoreEnhancedDiagonal(callDiagonal, vix, marketBias) : 0;
        const putScore = putDiagonal ? this.scoreEnhancedDiagonal(putDiagonal, vix, marketBias) : 0;

        const bestDiagonal = callScore >= putScore ? callDiagonal : putDiagonal;
        const bestScore = Math.max(callScore, putScore);
        const bestType = callScore >= putScore ? 'CALL' : 'PUT';
        const bestStrike = callScore >= putScore ? strikeSelection.callStrike : strikeSelection.putStrike;

        if (!bestDiagonal || bestScore < 65) {
            analysis.recommendation = `Diagonal score too low: ${bestScore}/100`;
            analysis.ivAnalysis = ivTermStructure;
            return analysis;
        }

        // Tom King position sizing: 5-8% per diagonal spread
        const riskPerSpread = bestDiagonal.maxRisk;
        const maxRiskAllocation = accountData.netLiq * 0.08;
        const maxPositions = Math.floor(maxRiskAllocation / riskPerSpread);
        const positions = Math.min(maxPositions, 10);

        // Additional filters for high-probability setups
        const canEnter = this.validateDiagonalEntry(
            bestDiagonal,
            ivTermStructure,
            marketBias,
            vix,
            currentDate
        );

        if (!canEnter.valid) {
            analysis.recommendation = canEnter.reason;
            analysis.ivAnalysis = ivTermStructure;
            return analysis;
        }

        analysis.canTrade = true;
        analysis.score = bestScore;
        analysis.ivAnalysis = ivTermStructure;
        analysis.setup = {
            type: `${bestType} Diagonal`,
            strike: bestStrike,
            frontExpiration,
            backExpiration,
            frontDTE: frontDTE,
            backDTE: backDTE,
            netDebit: bestDiagonal.netDebit,
            maxRisk: bestDiagonal.maxRisk,
            maxProfit: bestDiagonal.maxProfit,
            positions,
            requiredBP: bestDiagonal.maxRisk * positions,
            ivDifferential: bestDiagonal.ivDifferential,
            thetaCapture: bestDiagonal.thetaCapture,
            vegaExposure: bestDiagonal.vegaExposure,
            profitTarget: bestDiagonal.profitTarget,
            stopLoss: bestDiagonal.stopLoss,
            adjustmentTriggers: bestDiagonal.adjustmentTriggers,
            marketBias: marketBias
        };

        analysis.recommendation = `ENTER ${positions}x ${bestType} Diagonal ${bestStrike} ` +
            `${frontExpiration}/${backExpiration} | ` +
            `IV Diff: ${(bestDiagonal.ivDifferential * 100).toFixed(1)}% | ` +
            `Target: £${(bestDiagonal.profitTarget * positions).toFixed(0)}`;

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

    /**
     * Batman Spread Strategy (Wide Condor with skewed risk)
     * Named for its profit diagram resembling Batman's logo
     * Tom King variation: Use on high volatility Fridays
     */
    analyzeBatmanSpread(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Batman Spread',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null,
            description: 'Wide condor with Batman-shaped P&L diagram'
        };

        const day = currentDate.getDay();
        const hour = currentDate.getHours();
        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || marketData.ES || {};

        // Batman spreads work best on volatile Fridays
        if (day !== 5) {
            analysis.recommendation = 'Batman spreads preferred on Fridays';
            return analysis;
        }

        // Need high volatility for Batman spreads
        if (vix < 22) {
            analysis.recommendation = `VIX too low for Batman: ${vix} (need 22+)`;
            return analysis;
        }

        if (!spy.currentPrice) {
            analysis.recommendation = 'Missing SPY/ES data';
            return analysis;
        }

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);
        
        // Batman spreads use 7-14 DTE
        const targetDTE = 10;
        const expiration = this.findNearestExpiration(expirations, targetDTE);

        if (!expiration) {
            analysis.recommendation = 'No suitable expiration for Batman spread';
            return analysis;
        }

        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        
        // Batman structure: Very wide condor with specific ratios
        // Inner wings narrow, outer wings very wide (creates the Batman ears)
        const innerWidth = 5;  // Narrow body
        const outerWidth = 20; // Wide wings (Batman ears)
        
        const strikes = {
            farPut: atmStrike - outerWidth,
            nearPut: atmStrike - innerWidth,
            nearCall: atmStrike + innerWidth,
            farCall: atmStrike + outerWidth
        };

        // Calculate Batman spread prices
        const batmanSetup = this.calculateBatmanSpread(
            optionChain[expiration],
            strikes.farPut,
            strikes.nearPut,
            strikes.nearCall,
            strikes.farCall
        );

        if (!batmanSetup || batmanSetup.netCredit < 1.50) {
            analysis.recommendation = `Insufficient credit: $${batmanSetup?.netCredit || 0} (need $1.50+)`;
            return analysis;
        }

        // Score the Batman setup
        const score = this.scoreBatmanSpread(batmanSetup, vix, spy.currentPrice, atmStrike);

        if (score >= 75) {
            const maxPositions = Math.floor((accountData.netLiq * 0.06) / batmanSetup.maxLoss);
            const positions = Math.min(maxPositions, 5);

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                strikes: strikes,
                expiration,
                netCredit: batmanSetup.netCredit,
                maxLoss: batmanSetup.maxLoss,
                maxProfit: batmanSetup.maxProfit,
                positions,
                requiredBP: batmanSetup.maxLoss * positions,
                profitZones: batmanSetup.profitZones
            };

            analysis.recommendation = `ENTER ${positions}x Batman Spread ` +
                `${strikes.farPut}/${strikes.nearPut}/${strikes.nearCall}/${strikes.farCall} @ ${expiration}`;
        } else {
            analysis.recommendation = `Batman score too low: ${score}/100 (need 75+)`;
        }

        return analysis;
    }

    /**
     * Broken Wing Iron Condor Strategy
     * Asymmetric condor with different wing widths for skewed risk/reward
     */
    analyzeBrokenWingCondor(marketData, accountData, currentDate) {
        const analysis = {
            strategy: 'Broken Wing Iron Condor',
            timestamp: currentDate,
            canTrade: false,
            score: 0,
            setup: null,
            description: 'Asymmetric iron condor with directional bias'
        };

        const vix = marketData.VIX?.currentPrice || 0;
        const spy = marketData.SPY || marketData.ES || {};

        // Broken wing condors work in moderate-high volatility
        if (vix < 16 || vix > 35) {
            analysis.recommendation = `VIX outside range: ${vix} (ideal: 16-35)`;
            return analysis;
        }

        if (!spy.currentPrice || !spy.open) {
            analysis.recommendation = 'Missing market data';
            return analysis;
        }

        // Determine market bias
        const dayMove = ((spy.currentPrice - spy.open) / spy.open) * 100;
        const marketBias = dayMove > 0 ? 'BULLISH' : 'BEARISH';

        const optionChain = marketData.optionChain?.SPY || {};
        const expirations = Object.keys(optionChain);
        
        // 21-35 DTE for broken wing condors
        const targetDTE = 28;
        const expiration = this.findNearestExpiration(expirations, targetDTE);

        if (!expiration) {
            analysis.recommendation = 'No suitable expiration';
            return analysis;
        }

        const atmStrike = this.roundToStrike(spy.currentPrice, 1);
        const expectedMove = spy.currentPrice * (vix / 100) * Math.sqrt(targetDTE / 365);
        
        // Asymmetric strikes based on market bias
        let strikes;
        if (marketBias === 'BULLISH') {
            // Wider put spread, narrower call spread (bullish bias)
            strikes = {
                putLong: atmStrike - expectedMove * 1.5,  // Wider put side
                putShort: atmStrike - expectedMove * 1.0,
                callShort: atmStrike + expectedMove * 0.8, // Narrower call side
                callLong: atmStrike + expectedMove * 1.0
            };
        } else {
            // Wider call spread, narrower put spread (bearish bias)
            strikes = {
                putLong: atmStrike - expectedMove * 1.0,  // Narrower put side
                putShort: atmStrike - expectedMove * 0.8,
                callShort: atmStrike + expectedMove * 1.0,
                callLong: atmStrike + expectedMove * 1.5  // Wider call side
            };
        }

        // Round strikes
        Object.keys(strikes).forEach(key => {
            strikes[key] = this.roundToStrike(strikes[key], 1);
        });

        // Calculate broken wing condor prices
        const condorSetup = this.calculateBrokenWingCondor(
            optionChain[expiration],
            strikes.putLong,
            strikes.putShort,
            strikes.callShort,
            strikes.callLong,
            marketBias
        );

        if (!condorSetup || condorSetup.netCredit < 1.20) {
            analysis.recommendation = `Insufficient credit: $${condorSetup?.netCredit || 0} (need $1.20+)`;
            return analysis;
        }

        // Score the setup
        const score = this.scoreBrokenWingCondor(condorSetup, vix, marketBias, Math.abs(dayMove));

        if (score >= 70) {
            const maxPositions = Math.floor((accountData.netLiq * 0.08) / condorSetup.maxLoss);
            const positions = Math.min(maxPositions, 6);

            analysis.canTrade = true;
            analysis.score = score;
            analysis.setup = {
                type: `${marketBias} Broken Wing Condor`,
                strikes: strikes,
                expiration,
                netCredit: condorSetup.netCredit,
                maxLoss: condorSetup.maxLoss,
                positions,
                requiredBP: condorSetup.maxLoss * positions,
                putSpreadWidth: strikes.putShort - strikes.putLong,
                callSpreadWidth: strikes.callLong - strikes.callShort,
                bias: marketBias
            };

            analysis.recommendation = `ENTER ${positions}x ${marketBias} Broken Wing Condor ` +
                `${strikes.putLong}/${strikes.putShort}/${strikes.callShort}/${strikes.callLong} @ ${expiration}`;
        } else {
            analysis.recommendation = `Score too low: ${score}/100 (need 70+)`;
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

    /**
     * Enhanced diagonal calculation with Greeks and profit targets
     */
    calculateEnhancedDiagonal(frontChain, backChain, strike, type, ivTermStructure) {
        if (!frontChain || !backChain) return null;

        const frontOption = frontChain[type]?.[strike];
        const backOption = backChain[type]?.[strike];

        if (!frontOption || !backOption) return null;

        // Calculate net debit (buy back month, sell front month)
        const backMid = (backOption.bid + backOption.ask) / 2;
        const frontMid = (frontOption.bid + frontOption.ask) / 2;
        const netDebit = backOption.ask - frontOption.bid;
        const maxRisk = netDebit * 100;

        // IV differential is key for diagonal profitability
        const frontIV = frontOption.iv || frontMid / 100;
        const backIV = backOption.iv || backMid / 100;
        const ivDifferential = frontIV - backIV;

        // Calculate Greeks differential
        const thetaCapture = Math.abs(frontOption.theta || 0) - Math.abs(backOption.theta || 0);
        const vegaExposure = (backOption.vega || 0) - (frontOption.vega || 0);
        const deltaExposure = (backOption.delta || 0) - (frontOption.delta || 0);

        // Tom King profit targets
        // Target 25-35% of max risk for diagonals
        const profitTarget = maxRisk * 0.30;
        const maxProfit = frontMid * 100; // If front expires worthless

        // Stop loss at 50% of debit paid
        const stopLoss = maxRisk * 0.50;

        // Adjustment triggers
        const adjustmentTriggers = {
            frontDTE: 3, // Roll front when 3 DTE
            profitPercent: 25, // Take profit at 25%
            lossPercent: 30, // Adjust at 30% loss
            ivCollapse: -0.05, // Adjust if IV diff collapses
            deltaThreshold: 0.30 // Adjust if delta gets too high
        };

        return {
            netDebit,
            maxRisk,
            maxProfit,
            profitTarget,
            stopLoss,
            frontIV,
            backIV,
            ivDifferential,
            thetaCapture,
            vegaExposure,
            deltaExposure,
            adjustmentTriggers,
            frontStrike: strike,
            backStrike: strike,
            type
        };
    }

    /**
     * Analyze IV term structure for diagonal opportunities
     */
    analyzeIVTermStructure(optionChain, frontExpiration, backExpiration, currentPrice) {
        if (!optionChain || !frontExpiration || !backExpiration) return null;

        const atmStrike = this.roundToStrike(currentPrice, 1);
        const frontChain = optionChain[frontExpiration];
        const backChain = optionChain[backExpiration];

        if (!frontChain || !backChain) return null;

        // Check ATM IVs
        const frontATMCall = frontChain.CALL?.[atmStrike];
        const backATMCall = backChain.CALL?.[atmStrike];
        const frontATMPut = frontChain.PUT?.[atmStrike];
        const backATMPut = backChain.PUT?.[atmStrike];

        if (!frontATMCall || !backATMCall) return null;

        const frontATMIV = (frontATMCall.iv + frontATMPut.iv) / 2;
        const backATMIV = (backATMCall.iv + backATMPut.iv) / 2;

        // Calculate IV skew
        const otmCallStrike = atmStrike + 5;
        const otmPutStrike = atmStrike - 5;

        const frontCallSkew = frontChain.CALL?.[otmCallStrike]?.iv - frontATMCall.iv;
        const frontPutSkew = frontChain.PUT?.[otmPutStrike]?.iv - frontATMPut.iv;
        const backCallSkew = backChain.CALL?.[otmCallStrike]?.iv - backATMCall.iv;
        const backPutSkew = backChain.PUT?.[otmPutStrike]?.iv - backATMPut.iv;

        return {
            frontATMIV,
            backATMIV,
            ivDifferential: frontATMIV - backATMIV,
            hasBackwardation: frontATMIV > backATMIV,
            frontCallSkew,
            frontPutSkew,
            backCallSkew,
            backPutSkew,
            skewDifferential: {
                call: frontCallSkew - backCallSkew,
                put: frontPutSkew - backPutSkew
            },
            termStructureSlope: (backATMIV - frontATMIV) / (backExpiration - frontExpiration)
        };
    }

    /**
     * Detect market bias for diagonal selection
     */
    detectMarketBias(marketData) {
        const spy = marketData.SPY || {};
        const ema8 = spy.ema8 || spy.currentPrice;
        const ema21 = spy.ema21 || spy.currentPrice;
        const vwap = spy.vwap || spy.currentPrice;
        const currentPrice = spy.currentPrice;

        let bias = 'NEUTRAL';
        let strength = 0;

        // Price vs EMAs
        if (currentPrice > ema8 && ema8 > ema21) {
            bias = 'BULLISH';
            strength += 2;
        } else if (currentPrice < ema8 && ema8 < ema21) {
            bias = 'BEARISH';
            strength += 2;
        }

        // Price vs VWAP
        if (currentPrice > vwap * 1.005) strength += 1;
        else if (currentPrice < vwap * 0.995) strength -= 1;

        // RSI bias
        const rsi = spy.rsi || 50;
        if (rsi > 60) {
            if (bias !== 'BEARISH') bias = 'BULLISH';
            strength += 1;
        } else if (rsi < 40) {
            if (bias !== 'BULLISH') bias = 'BEARISH';
            strength += 1;
        }

        return { bias, strength: Math.min(5, Math.abs(strength)) };
    }

    /**
     * Select diagonal type based on conditions
     */
    selectDiagonalType(marketBias, vix, ivTermStructure) {
        // Tom King preference: PUT diagonals in high VIX
        if (vix > 25) return 'PUT';
        
        // CALL diagonals in bullish markets
        if (marketBias.bias === 'BULLISH' && marketBias.strength >= 3) return 'CALL';
        
        // PUT diagonals in bearish markets
        if (marketBias.bias === 'BEARISH' && marketBias.strength >= 3) return 'PUT';
        
        // Default based on skew advantage
        if (ivTermStructure?.skewDifferential?.put > ivTermStructure?.skewDifferential?.call) {
            return 'PUT';
        }
        
        return 'CALL';
    }

    /**
     * Select strikes for diagonal based on Tom King rules
     */
    selectDiagonalStrikes(currentPrice, diagonalType, marketBias, vix) {
        const atmStrike = this.roundToStrike(currentPrice, 1);
        
        // Tom King strike selection:
        // - Slightly OTM for directional bias
        // - ATM for neutral markets
        // - Adjust for VIX levels
        
        let callStrike = atmStrike;
        let putStrike = atmStrike;
        
        if (marketBias.bias === 'BULLISH') {
            // Slightly OTM calls, slightly ITM puts
            callStrike = atmStrike + (vix > 20 ? 2 : 1);
            putStrike = atmStrike + (vix > 20 ? 1 : 0);
        } else if (marketBias.bias === 'BEARISH') {
            // Slightly ITM calls, slightly OTM puts
            callStrike = atmStrike - (vix > 20 ? 1 : 0);
            putStrike = atmStrike - (vix > 20 ? 2 : 1);
        }
        
        return { callStrike, putStrike, atmStrike };
    }

    /**
     * Enhanced scoring for diagonal spreads
     */
    scoreEnhancedDiagonal(setup, vix, marketBias) {
        let score = 0;

        // IV differential (most important for diagonals)
        const ivDiff = setup.ivDifferential;
        if (ivDiff > 0.08) score += 35;
        else if (ivDiff > 0.05) score += 25;
        else if (ivDiff > 0.02) score += 15;
        else if (ivDiff > 0) score += 10;

        // VIX environment
        if (vix >= 18 && vix <= 28) score += 20;
        else if (vix >= 15 && vix <= 32) score += 15;
        else if (vix >= 12 && vix <= 35) score += 10;

        // Theta capture potential
        if (setup.thetaCapture > 0.15) score += 15;
        else if (setup.thetaCapture > 0.10) score += 10;
        else if (setup.thetaCapture > 0.05) score += 5;

        // Net debit relative to potential profit
        const profitRatio = setup.maxProfit / setup.maxRisk;
        if (profitRatio > 1.5) score += 15;
        else if (profitRatio > 1.2) score += 10;
        else if (profitRatio > 1.0) score += 5;

        // Market bias alignment
        if (setup.type === 'CALL' && marketBias.bias === 'BULLISH') score += 10;
        else if (setup.type === 'PUT' && marketBias.bias === 'BEARISH') score += 10;

        // Vega exposure (prefer positive in low VIX)
        if (vix < 20 && setup.vegaExposure > 0) score += 5;
        else if (vix > 25 && setup.vegaExposure < 0) score += 5;

        return Math.min(100, score);
    }

    /**
     * Validate diagonal entry conditions
     */
    validateDiagonalEntry(diagonal, ivTermStructure, marketBias, vix, currentDate) {
        const hour = currentDate.getHours();
        const dayOfWeek = currentDate.getDay();

        // Tom King timing rules
        if (hour < 10 || hour >= 15) {
            return { valid: false, reason: 'Outside optimal hours (10 AM - 3 PM)' };
        }

        // Avoid Mondays and Fridays for new diagonals
        if (dayOfWeek === 1 || dayOfWeek === 5) {
            return { valid: false, reason: 'Avoid diagonal entry on Monday/Friday' };
        }

        // IV differential minimum
        if (diagonal.ivDifferential < 0.02) {
            return { valid: false, reason: 'IV differential too small (<2%)' };
        }

        // Risk/reward check
        if (diagonal.maxProfit / diagonal.maxRisk < 0.8) {
            return { valid: false, reason: 'Risk/reward ratio too low' };
        }

        // Theta capture minimum
        if (diagonal.thetaCapture < 0.03) {
            return { valid: false, reason: 'Insufficient theta capture' };
        }

        return { valid: true, reason: 'All diagonal entry conditions met' };
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

    /**
     * Calculate Batman spread prices and structure
     */
    calculateBatmanSpread(chain, farPut, nearPut, nearCall, farCall) {
        if (!chain || !chain.PUT || !chain.CALL) return null;

        const farPutOpt = chain.PUT[farPut];
        const nearPutOpt = chain.PUT[nearPut];
        const nearCallOpt = chain.CALL[nearCall];
        const farCallOpt = chain.CALL[farCall];

        if (!farPutOpt || !nearPutOpt || !nearCallOpt || !farCallOpt) return null;

        // Batman: Sell near strikes, buy far strikes (wide iron condor variant)
        const putSpreadCredit = nearPutOpt.bid - farPutOpt.ask;
        const callSpreadCredit = nearCallOpt.bid - farCallOpt.ask;
        const netCredit = putSpreadCredit + callSpreadCredit;

        const putSpreadWidth = nearPut - farPut;
        const callSpreadWidth = farCall - nearCall;
        const maxLoss = Math.max(putSpreadWidth, callSpreadWidth) * 100 - netCredit * 100;
        const maxProfit = netCredit * 100;

        // Calculate profit zones (Batman ears)
        const profitZones = [
            { start: farPut, end: nearPut - netCredit },
            { start: nearCall + netCredit, end: farCall }
        ];

        return {
            netCredit,
            maxLoss,
            maxProfit,
            profitZones
        };
    }

    /**
     * Calculate broken wing condor prices
     */
    calculateBrokenWingCondor(chain, putLong, putShort, callShort, callLong, bias) {
        if (!chain || !chain.PUT || !chain.CALL) return null;

        const putLongOpt = chain.PUT[putLong];
        const putShortOpt = chain.PUT[putShort];
        const callShortOpt = chain.CALL[callShort];
        const callLongOpt = chain.CALL[callLong];

        if (!putLongOpt || !putShortOpt || !callShortOpt || !callLongOpt) return null;

        // Calculate credits for each spread
        const putSpreadCredit = putShortOpt.bid - putLongOpt.ask;
        const callSpreadCredit = callShortOpt.bid - callLongOpt.ask;
        const netCredit = putSpreadCredit + callSpreadCredit;

        // Max loss depends on bias and wing widths
        const putSpreadWidth = putShort - putLong;
        const callSpreadWidth = callLong - callShort;
        
        let maxLoss;
        if (bias === 'BULLISH') {
            // Wider put spread = higher risk on put side
            maxLoss = putSpreadWidth * 100 - netCredit * 100;
        } else {
            // Wider call spread = higher risk on call side
            maxLoss = callSpreadWidth * 100 - netCredit * 100;
        }

        return {
            netCredit,
            maxLoss,
            putSpreadWidth,
            callSpreadWidth
        };
    }

    /**
     * Score Batman spread setup
     */
    scoreBatmanSpread(setup, vix, currentPrice, atmStrike) {
        let score = 0;

        // High VIX requirement (22+)
        if (vix >= 25) score += 35;
        else if (vix >= 22) score += 25;
        else return 0; // Don't trade Batman below VIX 22

        // Net credit (need good premium)
        if (setup.netCredit >= 2.0) score += 30;
        else if (setup.netCredit >= 1.5) score += 20;

        // Risk/reward ratio
        const rrRatio = setup.maxProfit / setup.maxLoss;
        if (rrRatio >= 0.4) score += 25;
        else if (rrRatio >= 0.3) score += 15;

        // Price position relative to ATM (prefer when near center)
        const priceDistance = Math.abs(currentPrice - atmStrike) / atmStrike;
        if (priceDistance < 0.01) score += 10; // Within 1% of ATM

        return Math.min(100, score);
    }

    /**
     * Score broken wing condor setup
     */
    scoreBrokenWingCondor(setup, vix, bias, dayMovePercent) {
        let score = 0;

        // VIX range (16-35)
        if (vix >= 20 && vix <= 30) score += 30;
        else if (vix >= 16 && vix <= 35) score += 20;

        // Net credit
        if (setup.netCredit >= 1.5) score += 25;
        else if (setup.netCredit >= 1.2) score += 15;

        // Day move alignment with bias
        if ((bias === 'BULLISH' && dayMovePercent > 0.5) ||
            (bias === 'BEARISH' && dayMovePercent > 0.5)) {
            score += 20; // Direction confirmed by movement
        }

        // Wing asymmetry (should be meaningfully different)
        const wingDiff = Math.abs(setup.putSpreadWidth - setup.callSpreadWidth);
        if (wingDiff >= 10) score += 15;
        else if (wingDiff >= 5) score += 10;

        // Risk/reward assessment
        const creditToRisk = setup.netCredit / (setup.maxLoss / 100);
        if (creditToRisk >= 0.35) score += 10;

        return Math.min(100, score);
    }

    /**
     * Get available Section 9B strategies based on account phase and market conditions
     */
    getAvailableStrategies(accountData = {}, marketData = {}) {
        const phase = accountData.phase || this.determinePhase(accountData.balance || 35000);
        const vix = marketData.vix || 20;
        const isMarketHours = this.isMarketHours();
        
        const strategies = [
            {
                name: 'Enhanced Butterfly',
                type: 'BUTTERFLY',
                phase: 3, // Phase 3+
                enabled: phase >= 3,
                vixRange: [15, 35],
                suitable: vix >= 15 && vix <= 35 && phase >= 3,
                description: 'Tom King butterfly matrix with dynamic wing adjustment',
                riskLevel: 'MEDIUM',
                capitalEfficiency: 'HIGH',
                avgWinRate: 75,
                avgReturn: 25,
                timeframe: '10-21 DTE'
            },
            {
                name: 'Iron Condor',
                type: 'IRON_CONDOR',
                phase: 3,
                enabled: phase >= 3,
                vixRange: [18, 40],
                suitable: vix >= 18 && vix <= 40 && phase >= 3,
                description: 'High probability OTM iron condor with 70% profit target',
                riskLevel: 'MEDIUM',
                capitalEfficiency: 'HIGH',
                avgWinRate: 70,
                avgReturn: 35,
                timeframe: '30-45 DTE'
            },
            {
                name: 'Diagonal Spreads',
                type: 'DIAGONAL',
                phase: 2,
                enabled: phase >= 2,
                vixRange: [12, 30],
                suitable: vix >= 12 && vix <= 30 && phase >= 2,
                description: 'Time-based diagonal calendar spreads',
                riskLevel: 'LOW',
                capitalEfficiency: 'MEDIUM',
                avgWinRate: 65,
                avgReturn: 20,
                timeframe: '21-60 DTE'
            },
            {
                name: 'Ratio Spreads',
                type: 'RATIO',
                phase: 3,
                enabled: phase >= 3,
                vixRange: [20, 45],
                suitable: vix >= 20 && vix <= 45 && phase >= 3 && isMarketHours,
                description: 'Ratio call/put spreads with unlimited upside potential',
                riskLevel: 'HIGH',
                capitalEfficiency: 'VERY_HIGH',
                avgWinRate: 60,
                avgReturn: 45,
                timeframe: '14-30 DTE'
            },
            {
                name: 'Broken Wing Butterfly',
                type: 'BROKEN_WING_BUTTERFLY',
                phase: 4,
                enabled: phase >= 4,
                vixRange: [25, 50],
                suitable: vix >= 25 && vix <= 50 && phase >= 4,
                description: 'Asymmetric butterfly with skewed risk/reward',
                riskLevel: 'HIGH',
                capitalEfficiency: 'VERY_HIGH',
                avgWinRate: 55,
                avgReturn: 60,
                timeframe: '7-21 DTE'
            },
            {
                name: 'Batman Spread',
                type: 'BATMAN',
                phase: 4,
                enabled: phase >= 4,
                vixRange: [30, 60],
                suitable: vix >= 30 && vix <= 60 && phase >= 4 && isMarketHours,
                description: 'Complex multi-leg spread for high volatility environments',
                riskLevel: 'VERY_HIGH',
                capitalEfficiency: 'EXTREME',
                avgWinRate: 45,
                avgReturn: 80,
                timeframe: '5-14 DTE'
            },
            {
                name: 'Broken Wing Condor',
                type: 'BROKEN_WING_CONDOR',
                phase: 4,
                enabled: phase >= 4,
                vixRange: [22, 40],
                suitable: vix >= 22 && vix <= 40 && phase >= 4,
                description: 'Asymmetric iron condor with enhanced profit potential',
                riskLevel: 'HIGH',
                capitalEfficiency: 'VERY_HIGH',
                avgWinRate: 50,
                avgReturn: 70,
                timeframe: '14-35 DTE'
            }
        ];

        // Filter strategies based on suitability
        const availableStrategies = strategies.filter(strategy => strategy.enabled);
        const suitableStrategies = strategies.filter(strategy => strategy.suitable);
        
        // Add market condition assessment
        const marketCondition = this.assessMarketCondition(vix);
        
        // Generate strategy recommendations
        const recommendations = this.generateStrategyRecommendations(suitableStrategies, marketCondition, phase);

        return {
            timestamp: new Date().toISOString(),
            accountPhase: phase,
            currentVIX: vix,
            marketCondition,
            isMarketHours,
            totalStrategies: strategies.length,
            availableStrategies: availableStrategies.length,
            suitableStrategies: suitableStrategies.length,
            strategies: strategies,
            available: availableStrategies,
            suitable: suitableStrategies,
            recommendations,
            summary: {
                phase: `Phase ${phase} Account`,
                strategiesUnlocked: availableStrategies.length,
                currentOpportunities: suitableStrategies.length,
                topRecommendation: recommendations.length > 0 ? recommendations[0].name : 'None suitable',
                marketAssessment: `VIX ${vix} - ${marketCondition} volatility environment`
            }
        };
    }

    /**
     * Determine account phase from balance
     */
    determinePhase(balance) {
        if (balance >= 75000) return 4;
        if (balance >= 60000) return 3;
        if (balance >= 40000) return 2;
        return 1;
    }

    /**
     * Check if market is currently open
     */
    isMarketHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        
        // Market hours: Mon-Fri, 9:30 AM - 4:00 PM EST
        const isWeekday = day >= 1 && day <= 5;
        const isDuringMarket = hour >= 9 && hour < 16;
        
        return isWeekday && isDuringMarket;
    }

    /**
     * Assess market condition based on VIX
     */
    assessMarketCondition(vix) {
        if (vix < 15) return 'LOW';
        if (vix < 20) return 'NORMAL';
        if (vix < 25) return 'ELEVATED';
        if (vix < 35) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Generate strategy recommendations based on current conditions
     */
    generateStrategyRecommendations(suitableStrategies, marketCondition, phase) {
        const recommendations = [];
        
        // Sort by risk-adjusted return potential
        const sorted = suitableStrategies.sort((a, b) => {
            const aScore = (a.avgWinRate * a.avgReturn) / 100;
            const bScore = (b.avgWinRate * b.avgReturn) / 100;
            return bScore - aScore;
        });

        // Add top 3 recommendations with reasoning
        sorted.slice(0, 3).forEach((strategy, index) => {
            const priority = index === 0 ? 'HIGH' : index === 1 ? 'MEDIUM' : 'LOW';
            
            recommendations.push({
                rank: index + 1,
                name: strategy.name,
                type: strategy.type,
                priority,
                reason: this.generateRecommendationReason(strategy, marketCondition, phase),
                expectedReturn: strategy.avgReturn,
                winRate: strategy.avgWinRate,
                riskLevel: strategy.riskLevel,
                timeframe: strategy.timeframe,
                capitalEfficiency: strategy.capitalEfficiency
            });
        });

        return recommendations;
    }

    /**
     * Generate recommendation reasoning
     */
    generateRecommendationReason(strategy, marketCondition, phase) {
        const reasons = [];
        
        if (strategy.type === 'BUTTERFLY' && marketCondition === 'NORMAL') {
            reasons.push('Ideal low-volatility butterfly conditions');
        }
        
        if (strategy.type === 'IRON_CONDOR' && ['ELEVATED', 'HIGH'].includes(marketCondition)) {
            reasons.push('High IV environment favors credit spreads');
        }
        
        if (strategy.type === 'RATIO' && marketCondition === 'HIGH') {
            reasons.push('High volatility creates ratio spread opportunities');
        }
        
        if (strategy.phase === phase) {
            reasons.push('Perfect phase alignment for this strategy');
        }
        
        if (strategy.capitalEfficiency === 'HIGH' || strategy.capitalEfficiency === 'VERY_HIGH') {
            reasons.push('Excellent capital efficiency');
        }
        
        if (strategy.avgWinRate >= 70) {
            reasons.push('High probability setup');
        }

        return reasons.length > 0 ? reasons.join('; ') : 'Suitable for current market conditions';
    }
}

module.exports = { Section9BStrategies };