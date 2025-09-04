/**
 * Greeks Calculator Module
 * Complete options Greeks calculations for Tom King Trading Framework
 */

const math = require('mathjs');
const { getLogger } = require('./logger');

class GreeksCalculator {
    constructor() {
        this.riskFreeRate = 0.045; // Current risk-free rate (4.5%)
    }

    /**
     * Calculate all Greeks for an option
     */
    calculateGreeks(params) {
        const {
            spotPrice,
            strikePrice,
            timeToExpiry, // in years
            volatility, // as decimal (0.15 = 15%)
            optionType, // 'call' or 'put'
            dividendYield = 0
        } = params;

        // Input validation to prevent NaN
        if (!spotPrice || !strikePrice || spotPrice <= 0 || strikePrice <= 0) {
            return this.getDefaultGreeks();
        }
        if (!timeToExpiry || timeToExpiry <= 0) {
            return this.getDefaultGreeks();
        }
        if (!volatility || volatility <= 0) {
            return this.getDefaultGreeks();
        }

        // Black-Scholes components
        const d1 = this.calculateD1(spotPrice, strikePrice, timeToExpiry, volatility, dividendYield);
        const d2 = d1 - volatility * Math.sqrt(timeToExpiry);

        // Calculate individual Greeks
        const delta = this.calculateDelta(d1, optionType, dividendYield, timeToExpiry);
        const gamma = this.calculateGamma(spotPrice, d1, volatility, timeToExpiry, dividendYield);
        const theta = this.calculateTheta(spotPrice, strikePrice, d1, d2, volatility, timeToExpiry, optionType, dividendYield);
        const vega = this.calculateVega(spotPrice, d1, timeToExpiry, dividendYield);
        const rho = this.calculateRho(strikePrice, timeToExpiry, d2, optionType);

        // Calculate theoretical price
        const theoreticalPrice = this.blackScholesPrice(spotPrice, strikePrice, timeToExpiry, volatility, optionType, dividendYield);

        return {
            delta: Math.round(delta * 1000) / 1000,
            gamma: Math.round(gamma * 10000) / 10000,
            theta: Math.round(theta * 100) / 100,
            vega: Math.round(vega * 100) / 100,
            rho: Math.round(rho * 100) / 100,
            theoreticalPrice: Math.round(theoreticalPrice * 100) / 100,
            // Additional metrics for Tom King strategies
            deltaPercent: Math.round(delta * 100 * 10) / 10, // As percentage
            gammaRisk: this.calculateGammaRisk(gamma, spotPrice),
            thetaDecay: Math.round(theta / theoreticalPrice * 100 * 10) / 10, // Daily decay %
            vegaRisk: this.calculateVegaRisk(vega, volatility)
        };
    }

    /**
     * Calculate D1 for Black-Scholes
     */
    calculateD1(S, K, T, sigma, q) {
        // Validate inputs to prevent NaN
        if (!S || !K || S <= 0 || K <= 0) return 0;
        if (!T || T <= 0) return 0;
        if (!sigma || sigma <= 0) return 0;
        
        const numerator = Math.log(S / K) + (this.riskFreeRate - q + 0.5 * sigma * sigma) * T;
        const denominator = sigma * Math.sqrt(T);
        
        // Check for division by zero
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }

    /**
     * Calculate Delta
     */
    calculateDelta(d1, optionType, q, T) {
        const Nd1 = this.normalCDF(d1);
        const adjustment = Math.exp(-q * T);
        
        if (optionType === 'call') {
            return adjustment * Nd1;
        } else {
            return adjustment * (Nd1 - 1);
        }
    }

    /**
     * Calculate Gamma
     */
    calculateGamma(S, d1, sigma, T, q) {
        const phi_d1 = this.normalPDF(d1);
        const adjustment = Math.exp(-q * T);
        return (adjustment * phi_d1) / (S * sigma * Math.sqrt(T));
    }

    /**
     * Calculate Theta
     */
    calculateTheta(S, K, d1, d2, sigma, T, optionType, q) {
        const phi_d1 = this.normalPDF(d1);
        const Nd1 = this.normalCDF(d1);
        const Nd2 = this.normalCDF(d2);
        
        const term1 = -(S * phi_d1 * sigma * Math.exp(-q * T)) / (2 * Math.sqrt(T));
        
        if (optionType === 'call') {
            const term2 = q * S * Nd1 * Math.exp(-q * T);
            const term3 = -this.riskFreeRate * K * Math.exp(-this.riskFreeRate * T) * Nd2;
            return (term1 + term2 + term3) / 365; // Convert to daily
        } else {
            const term2 = -q * S * (Nd1 - 1) * Math.exp(-q * T);
            const term3 = this.riskFreeRate * K * Math.exp(-this.riskFreeRate * T) * (1 - Nd2);
            return (term1 + term2 + term3) / 365; // Convert to daily
        }
    }

    /**
     * Calculate Vega
     */
    calculateVega(S, d1, T, q) {
        const phi_d1 = this.normalPDF(d1);
        return (S * phi_d1 * Math.sqrt(T) * Math.exp(-q * T)) / 100; // Per 1% change in volatility
    }

    /**
     * Calculate Rho
     */
    calculateRho(K, T, d2, optionType) {
        const Nd2 = this.normalCDF(d2);
        
        if (optionType === 'call') {
            return (K * T * Math.exp(-this.riskFreeRate * T) * Nd2) / 100; // Per 1% change in interest rate
        } else {
            return (-K * T * Math.exp(-this.riskFreeRate * T) * (1 - Nd2)) / 100;
        }
    }

    /**
     * Black-Scholes option pricing
     */
    blackScholesPrice(S, K, T, sigma, optionType, q = 0) {
        const d1 = this.calculateD1(S, K, T, sigma, q);
        const d2 = d1 - sigma * Math.sqrt(T);
        
        const Nd1 = this.normalCDF(d1);
        const Nd2 = this.normalCDF(d2);
        
        if (optionType === 'call') {
            return S * Math.exp(-q * T) * Nd1 - K * Math.exp(-this.riskFreeRate * T) * Nd2;
        } else {
            return K * Math.exp(-this.riskFreeRate * T) * (1 - Nd2) - S * Math.exp(-q * T) * (1 - Nd1);
        }
    }
    
    /**
     * Alias for backward compatibility
     */
    blackScholes(S, K, T, r, sigma, optionType) {
        // Note: r parameter is ignored, using this.riskFreeRate instead
        return this.blackScholesPrice(S, K, T, sigma, optionType, 0);
    }

    /**
     * Calculate Implied Volatility from option price
     */
    calculateIV(params) {
        const {
            optionPrice,
            spotPrice,
            strikePrice,
            timeToExpiry,
            optionType,
            dividendYield = 0
        } = params;

        // Newton-Raphson method for IV calculation
        let iv = 0.2; // Initial guess 20%
        let maxIterations = 100;
        let tolerance = 0.0001;
        
        for (let i = 0; i < maxIterations; i++) {
            const price = this.blackScholesPrice(spotPrice, strikePrice, timeToExpiry, iv, optionType, dividendYield);
            const vega = this.calculateVega(spotPrice, this.calculateD1(spotPrice, strikePrice, timeToExpiry, iv, dividendYield), timeToExpiry, dividendYield);
            
            const diff = price - optionPrice;
            
            if (Math.abs(diff) < tolerance) {
                return Math.round(iv * 1000) / 10; // Return as percentage
            }
            
            iv = iv - diff / (vega * 100); // Adjust for vega scaling
            
            // Bounds check
            if (iv < 0.001) iv = 0.001;
            if (iv > 5) iv = 5;
        }
        
        return Math.round(iv * 1000) / 10; // Return as percentage
    }

    /**
     * Enhanced portfolio Greeks aggregation with correlation adjustments
     * Tom King methodology: Account for correlation and cross-product effects
     */
    calculatePortfolioGreeks(positions, correlationMatrix = null) {
        const portfolioGreeks = {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            deltaAdjusted: 0, // Beta-weighted delta
            totalValue: 0,
            byUnderlying: {},
            byStrategy: {},
            byExpiration: {}
        };

        // Group positions by underlying, strategy, and expiration
        const groupings = this.groupPositions(positions);
        
        // Calculate raw Greeks for each position
        positions.forEach(position => {
            const greeks = this.calculateGreeks(position);
            const quantity = position.quantity || 1;
            const multiplier = position.multiplier || 100; // Options multiplier
            const side = position.side === 'SHORT' ? -1 : 1;
            
            // Aggregate raw Greeks
            portfolioGreeks.delta += greeks.delta * quantity * multiplier * side;
            portfolioGreeks.gamma += greeks.gamma * quantity * multiplier * side;
            portfolioGreeks.theta += greeks.theta * quantity * multiplier * side;
            portfolioGreeks.vega += greeks.vega * quantity * multiplier * side;
            portfolioGreeks.rho += greeks.rho * quantity * multiplier * side;
            portfolioGreeks.totalValue += greeks.theoreticalPrice * quantity * multiplier;
            
            // Track by underlying
            const underlying = position.underlying || position.symbol;
            if (!portfolioGreeks.byUnderlying[underlying]) {
                portfolioGreeks.byUnderlying[underlying] = this.initializeGreeks();
            }
            this.addGreeks(portfolioGreeks.byUnderlying[underlying], greeks, quantity, multiplier, side);
            
            // Track by strategy
            const strategy = position.strategy || 'SINGLE';
            if (!portfolioGreeks.byStrategy[strategy]) {
                portfolioGreeks.byStrategy[strategy] = this.initializeGreeks();
            }
            this.addGreeks(portfolioGreeks.byStrategy[strategy], greeks, quantity, multiplier, side);
            
            // Track by expiration
            const expiration = position.expiration || 'UNKNOWN';
            if (!portfolioGreeks.byExpiration[expiration]) {
                portfolioGreeks.byExpiration[expiration] = this.initializeGreeks();
            }
            this.addGreeks(portfolioGreeks.byExpiration[expiration], greeks, quantity, multiplier, side);
        });

        // Apply correlation adjustments if matrix provided
        if (correlationMatrix) {
            portfolioGreeks.correlationAdjusted = this.applyCorrelationAdjustments(
                portfolioGreeks,
                correlationMatrix
            );
        }

        // Calculate SPY-equivalent delta (beta-weighted)
        portfolioGreeks.deltaAdjusted = this.calculateBetaWeightedDelta(
            portfolioGreeks.byUnderlying
        );
        
        // Enhanced risk metrics
        const riskAnalysis = this.analyzePortfolioRisk(portfolioGreeks, positions);

        return {
            ...portfolioGreeks,
            // Risk metrics for Tom King strategies
            gammaRisk: this.assessGammaRisk(portfolioGreeks.gamma),
            thetaIncome: Math.round(portfolioGreeks.theta), // Daily income from theta
            vegaExposure: this.assessVegaExposure(portfolioGreeks.vega),
            deltaNeutral: Math.abs(portfolioGreeks.deltaAdjusted) < 50, // Consider neutral if < 50 SPY deltas
            riskScore: this.calculateGreeksRiskScore(portfolioGreeks),
            ...riskAnalysis,
            // Concentration metrics
            concentration: this.calculateConcentrationMetrics(portfolioGreeks),
            // Hedging recommendations
            hedgingRecommendations: this.generateHedgingRecommendations(portfolioGreeks)
        };
    }
    
    /**
     * Initialize Greeks object
     */
    initializeGreeks() {
        return {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            count: 0,
            value: 0
        };
    }
    
    /**
     * Add Greeks to aggregation
     */
    addGreeks(target, greeks, quantity, multiplier, side) {
        target.delta += greeks.delta * quantity * multiplier * side;
        target.gamma += greeks.gamma * quantity * multiplier * side;
        target.theta += greeks.theta * quantity * multiplier * side;
        target.vega += greeks.vega * quantity * multiplier * side;
        target.rho += greeks.rho * quantity * multiplier * side;
        target.count += 1;
        target.value += greeks.theoreticalPrice * quantity * multiplier;
    }
    
    /**
     * Group positions for analysis
     */
    groupPositions(positions) {
        const groups = {
            byUnderlying: {},
            byStrategy: {},
            byExpiration: {},
            byCorrelationGroup: {}
        };
        
        positions.forEach(position => {
            const underlying = position.underlying || position.symbol;
            const strategy = position.strategy || 'SINGLE';
            const expiration = position.expiration || 'UNKNOWN';
            const correlationGroup = this.getCorrelationGroup(underlying);
            
            // Group by underlying
            if (!groups.byUnderlying[underlying]) {
                groups.byUnderlying[underlying] = [];
            }
            groups.byUnderlying[underlying].push(position);
            
            // Group by strategy
            if (!groups.byStrategy[strategy]) {
                groups.byStrategy[strategy] = [];
            }
            groups.byStrategy[strategy].push(position);
            
            // Group by expiration
            if (!groups.byExpiration[expiration]) {
                groups.byExpiration[expiration] = [];
            }
            groups.byExpiration[expiration].push(position);
            
            // Group by correlation
            if (!groups.byCorrelationGroup[correlationGroup]) {
                groups.byCorrelationGroup[correlationGroup] = [];
            }
            groups.byCorrelationGroup[correlationGroup].push(position);
        });
        
        return groups;
    }
    
    /**
     * Get correlation group for Tom King risk management
     */
    getCorrelationGroup(underlying) {
        const correlationGroups = {
            EQUITY_INDEX: ['SPY', 'QQQ', 'IWM', 'DIA', 'SPX', 'NDX', 'RUT'],
            TECH: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AMD'],
            FINANCIALS: ['JPM', 'BAC', 'GS', 'MS', 'C', 'WFC', 'XLF'],
            COMMODITIES: ['GLD', 'SLV', 'USO', 'UNG', 'GC', 'SI', 'CL'],
            BONDS: ['TLT', 'IEF', 'SHY', 'HYG', 'LQD', 'AGG', 'ZB'],
            VOLATILITY: ['VXX', 'UVXY', 'SVXY', 'VIX', 'VIXY'],
            CURRENCIES: ['FXE', 'FXY', 'UUP', 'EWJ', '6E', '6J'],
            ENERGY: ['XLE', 'XOP', 'OIH', 'CVX', 'XOM'],
            FUTURES: ['ES', 'NQ', 'RTY', 'YM', 'ZN', 'ZB', 'GC', 'CL',
                     'MES', 'MNQ', 'M2K', 'MYM', 'MGC', 'MCL']
        };
        
        for (const [group, symbols] of Object.entries(correlationGroups)) {
            if (symbols.includes(underlying.toUpperCase())) {
                return group;
            }
        }
        
        return 'OTHER';
    }
    
    /**
     * Apply correlation adjustments to portfolio Greeks
     */
    applyCorrelationAdjustments(portfolioGreeks, correlationMatrix) {
        const adjusted = { ...portfolioGreeks };
        
        // Adjust gamma for correlation
        // High correlation increases effective gamma risk
        let correlationFactor = 1.0;
        const underlyings = Object.keys(portfolioGreeks.byUnderlying);
        
        if (underlyings.length > 1) {
            let totalCorrelation = 0;
            let pairCount = 0;
            
            for (let i = 0; i < underlyings.length; i++) {
                for (let j = i + 1; j < underlyings.length; j++) {
                    const corr = correlationMatrix?.[underlyings[i]]?.[underlyings[j]] || 0.5;
                    totalCorrelation += Math.abs(corr);
                    pairCount++;
                }
            }
            
            const avgCorrelation = pairCount > 0 ? totalCorrelation / pairCount : 0;
            correlationFactor = 1 + (avgCorrelation * 0.5); // Increase gamma risk by up to 50%
        }
        
        adjusted.gammaAdjusted = portfolioGreeks.gamma * correlationFactor;
        adjusted.correlationFactor = correlationFactor;
        
        return adjusted;
    }
    
    /**
     * Calculate beta-weighted delta
     */
    calculateBetaWeightedDelta(byUnderlying) {
        const betas = {
            'SPY': 1.0,
            'QQQ': 1.1,
            'IWM': 1.2,
            'DIA': 0.9,
            'GLD': -0.2,
            'TLT': -0.3,
            'VXX': -3.0,
            'DEFAULT': 1.0
        };
        
        let betaWeightedDelta = 0;
        
        for (const [underlying, greeks] of Object.entries(byUnderlying)) {
            const beta = betas[underlying] || betas.DEFAULT;
            betaWeightedDelta += greeks.delta * beta;
        }
        
        return betaWeightedDelta;
    }
    
    /**
     * Analyze portfolio risk comprehensively
     */
    analyzePortfolioRisk(portfolioGreeks, positions) {
        const analysis = {
            expirationConcentration: {},
            strikeConcentration: {},
            gammaConcentration: {},
            criticalDates: [],
            riskAlerts: []
        };
        
        // Analyze expiration concentration
        for (const [expiration, greeks] of Object.entries(portfolioGreeks.byExpiration)) {
            const concentration = Math.abs(greeks.gamma) / Math.abs(portfolioGreeks.gamma || 1);
            analysis.expirationConcentration[expiration] = {
                gammaPercent: concentration * 100,
                thetaAmount: greeks.theta,
                vegaAmount: greeks.vega,
                risk: concentration > 0.5 ? 'HIGH' : concentration > 0.3 ? 'MEDIUM' : 'LOW'
            };
            
            if (concentration > 0.5) {
                analysis.riskAlerts.push(`High gamma concentration (${(concentration * 100).toFixed(0)}%) at ${expiration}`);
            }
        }
        
        // Identify critical dates (high gamma/theta days)
        const expirationDates = Object.keys(portfolioGreeks.byExpiration);
        expirationDates.forEach(date => {
            const greeks = portfolioGreeks.byExpiration[date];
            if (Math.abs(greeks.gamma) > 100 || Math.abs(greeks.theta) > 500) {
                analysis.criticalDates.push({
                    date,
                    gamma: greeks.gamma,
                    theta: greeks.theta,
                    severity: Math.abs(greeks.gamma) > 200 ? 'CRITICAL' : 'HIGH'
                });
            }
        });
        
        // Check for dangerous gamma/vega ratios
        const gammaVegaRatio = Math.abs(portfolioGreeks.gamma / (portfolioGreeks.vega || 1));
        if (gammaVegaRatio > 5) {
            analysis.riskAlerts.push(`High gamma/vega ratio: ${gammaVegaRatio.toFixed(1)}`);
        }
        
        return analysis;
    }
    
    /**
     * Calculate concentration metrics
     */
    calculateConcentrationMetrics(portfolioGreeks) {
        const metrics = {
            underlyingCount: Object.keys(portfolioGreeks.byUnderlying).length,
            strategyCount: Object.keys(portfolioGreeks.byStrategy).length,
            expirationCount: Object.keys(portfolioGreeks.byExpiration).length,
            diversificationScore: 0,
            concentrationRisk: 'LOW'
        };
        
        // Calculate Herfindahl index for concentration
        let herfindahl = 0;
        const totalGamma = Math.abs(portfolioGreeks.gamma) || 1;
        
        for (const greeks of Object.values(portfolioGreeks.byUnderlying)) {
            const share = Math.abs(greeks.gamma) / totalGamma;
            herfindahl += share * share;
        }
        
        // Diversification score (inverse of concentration)
        metrics.diversificationScore = Math.round((1 - herfindahl) * 100);
        
        // Assess concentration risk
        if (herfindahl > 0.5) {
            metrics.concentrationRisk = 'HIGH';
        } else if (herfindahl > 0.3) {
            metrics.concentrationRisk = 'MEDIUM';
        }
        
        return metrics;
    }
    
    /**
     * Generate hedging recommendations
     */
    generateHedgingRecommendations(portfolioGreeks) {
        const recommendations = [];
        
        // Delta hedging
        if (Math.abs(portfolioGreeks.deltaAdjusted) > 100) {
            const hedgeDirection = portfolioGreeks.deltaAdjusted > 0 ? 'SHORT' : 'LONG';
            const hedgeAmount = Math.abs(Math.round(portfolioGreeks.deltaAdjusted));
            recommendations.push({
                type: 'DELTA_HEDGE',
                action: `${hedgeDirection} ${hedgeAmount} SPY shares or equivalent`,
                urgency: Math.abs(portfolioGreeks.deltaAdjusted) > 500 ? 'HIGH' : 'MEDIUM'
            });
        }
        
        // Gamma hedging
        if (Math.abs(portfolioGreeks.gamma) > 300) {
            recommendations.push({
                type: 'GAMMA_HEDGE',
                action: 'Consider ATM options to reduce gamma exposure',
                urgency: Math.abs(portfolioGreeks.gamma) > 500 ? 'HIGH' : 'MEDIUM'
            });
        }
        
        // Vega hedging
        if (Math.abs(portfolioGreeks.vega) > 1000) {
            const hedgeDirection = portfolioGreeks.vega > 0 ? 'SHORT' : 'LONG';
            recommendations.push({
                type: 'VEGA_HEDGE',
                action: `${hedgeDirection} volatility through VIX options or spreads`,
                urgency: Math.abs(portfolioGreeks.vega) > 2000 ? 'HIGH' : 'MEDIUM'
            });
        }
        
        // Theta optimization
        if (portfolioGreeks.theta < -500) {
            recommendations.push({
                type: 'THETA_OPTIMIZATION',
                action: 'High theta decay - consider rolling or closing positions',
                urgency: portfolioGreeks.theta < -1000 ? 'HIGH' : 'MEDIUM'
            });
        }
        
        return recommendations;
    }

    /**
     * Calculate Gamma risk for position
     */
    calculateGammaRisk(gamma, spotPrice) {
        const onePercentMove = spotPrice * 0.01;
        const gammaImpact = gamma * onePercentMove * onePercentMove * 100;
        
        if (Math.abs(gammaImpact) < 50) return 'LOW';
        if (Math.abs(gammaImpact) < 150) return 'MEDIUM';
        return 'HIGH';
    }

    /**
     * Calculate Vega risk based on IV environment
     */
    calculateVegaRisk(vega, currentIV) {
        const vegaImpact = Math.abs(vega);
        
        if (currentIV > 0.3) { // High IV environment
            if (vegaImpact < 20) return 'LOW';
            if (vegaImpact < 50) return 'MEDIUM';
            return 'HIGH';
        } else { // Low IV environment
            if (vegaImpact < 30) return 'LOW';
            if (vegaImpact < 70) return 'MEDIUM';
            return 'HIGH';
        }
    }

    /**
     * Assess portfolio gamma risk
     */
    assessGammaRisk(portfolioGamma) {
        const absGamma = Math.abs(portfolioGamma);
        
        if (absGamma < 100) return 'LOW';
        if (absGamma < 300) return 'MEDIUM';
        if (absGamma < 500) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Calculate weekend theta decay
     * Accounts for 3-day theta burn over weekends
     */
    calculateWeekendTheta(positions, currentDate = new Date()) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isFriday = dayOfWeek === 5;
        
        const weekendAnalysis = {
            isWeekend,
            isFriday,
            positions: [],
            totalWeekendDecay: 0,
            criticalPositions: [],
            recommendations: []
        };
        
        positions.forEach(position => {
            if (!position.greeks || !position.greeks.theta) return;
            
            const theta = position.greeks.theta;
            const dte = position.dte || 30;
            
            // Weekend multiplier - 3 days of decay over 2 calendar days
            let weekendMultiplier = 1;
            
            if (isWeekend || isFriday) {
                // Higher multiplier for options closer to expiration
                if (dte <= 7) {
                    weekendMultiplier = 3.5; // Severe weekend decay for weeklies
                } else if (dte <= 14) {
                    weekendMultiplier = 3.2; // High decay for 2-week options
                } else if (dte <= 21) {
                    weekendMultiplier = 3.0; // Standard 3-day decay
                } else {
                    weekendMultiplier = 2.8; // Slightly less for longer-term
                }
            }
            
            const weekendTheta = theta * weekendMultiplier;
            const weekendDecay = weekendTheta * position.quantity * 100; // Convert to dollar amount
            
            const positionAnalysis = {
                symbol: position.symbol,
                strategy: position.strategy,
                theta: theta,
                weekendTheta: weekendTheta,
                weekendDecay: weekendDecay,
                dte: dte,
                quantity: position.quantity,
                multiplier: weekendMultiplier,
                severity: this.assessThetaSeverity(weekendDecay, position.value || 1000)
            };
            
            weekendAnalysis.positions.push(positionAnalysis);
            weekendAnalysis.totalWeekendDecay += weekendDecay;
            
            // Flag critical positions (high weekend decay)
            if (positionAnalysis.severity === 'CRITICAL' || Math.abs(weekendDecay) > 200) {
                weekendAnalysis.criticalPositions.push(positionAnalysis);
            }
        });
        
        // Generate recommendations
        if (isFriday && weekendAnalysis.criticalPositions.length > 0) {
            weekendAnalysis.recommendations.push({
                type: 'FRIDAY_CLOSE',
                message: 'Consider closing high-theta positions before weekend',
                affectedPositions: weekendAnalysis.criticalPositions.length
            });
        }
        
        if (Math.abs(weekendAnalysis.totalWeekendDecay) > 500) {
            weekendAnalysis.recommendations.push({
                type: 'PORTFOLIO_RISK',
                message: `High weekend theta exposure: $${Math.abs(weekendAnalysis.totalWeekendDecay).toFixed(2)}`,
                severity: 'HIGH'
            });
        }
        
        return weekendAnalysis;
    }
    
    /**
     * Assess theta decay severity relative to position value
     */
    assessThetaSeverity(thetaDecay, positionValue) {
        const decayPercent = Math.abs(thetaDecay) / positionValue;
        
        if (decayPercent > 0.05) return 'CRITICAL'; // >5% weekend decay
        if (decayPercent > 0.03) return 'HIGH';     // >3% weekend decay
        if (decayPercent > 0.01) return 'MEDIUM';   // >1% weekend decay
        return 'LOW';
    }
    
    /**
     * Assess portfolio vega exposure
     */
    assessVegaExposure(portfolioVega) {
        const absVega = Math.abs(portfolioVega);
        
        if (absVega < 500) return 'LOW';
        if (absVega < 1500) return 'MEDIUM';
        if (absVega < 3000) return 'HIGH';
        return 'EXTREME';
    }

    /**
     * Calculate overall Greeks risk score
     */
    calculateGreeksRiskScore(greeks) {
        let score = 100;
        
        // Delta risk (prefer neutral)
        const deltaRisk = Math.abs(greeks.deltaAdjusted);
        if (deltaRisk > 100) score -= Math.min(20, deltaRisk / 10);
        
        // Gamma risk
        if (this.assessGammaRisk(greeks.gamma) === 'HIGH') score -= 15;
        if (this.assessGammaRisk(greeks.gamma) === 'EXTREME') score -= 30;
        
        // Vega risk
        if (this.assessVegaExposure(greeks.vega) === 'HIGH') score -= 10;
        if (this.assessVegaExposure(greeks.vega) === 'EXTREME') score -= 20;
        
        // Positive theta is good
        if (greeks.theta > 0) score += Math.min(10, greeks.theta / 100);
        
        return Math.max(0, Math.round(score));
    }

    /**
     * Calculate strike by delta
     */
    findStrikeByDelta(params) {
        const {
            spotPrice,
            targetDelta,
            timeToExpiry,
            volatility,
            optionType,
            dividendYield = 0
        } = params;

        // Use iterative method to find strike with target delta
        let low = spotPrice * 0.5;
        let high = spotPrice * 1.5;
        let tolerance = 0.001;
        let maxIterations = 50;
        
        for (let i = 0; i < maxIterations; i++) {
            const mid = (low + high) / 2;
            const d1 = this.calculateD1(spotPrice, mid, timeToExpiry, volatility, dividendYield);
            const delta = this.calculateDelta(d1, optionType, dividendYield, timeToExpiry);
            
            if (Math.abs(delta - targetDelta) < tolerance) {
                return Math.round(mid * 100) / 100;
            }
            
            if (optionType === 'call') {
                if (delta > targetDelta) {
                    low = mid;
                } else {
                    high = mid;
                }
            } else {
                if (Math.abs(delta) < Math.abs(targetDelta)) {
                    high = mid;
                } else {
                    low = mid;
                }
            }
        }
        
        return Math.round((low + high) / 2 * 100) / 100;
    }

    /**
     * Normal CDF (Cumulative Distribution Function)
     */
    normalCDF(x) {
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2.0);

        const t = 1.0 / (1.0 + p * x);
        const t2 = t * t;
        const t3 = t2 * t;
        const t4 = t3 * t;
        const t5 = t4 * t;
        const y = 1.0 - (((((a5 * t5 + a4 * t4) + a3 * t3) + a2 * t2) + a1 * t) * Math.exp(-x * x));

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Normal PDF (Probability Density Function)
     */
    normalPDF(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    /**
     * Return default Greeks when inputs are invalid
     */
    getDefaultGreeks() {
        return {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            theoreticalPrice: 0,
            deltaPercent: 0,
            gammaRisk: 'N/A',
            thetaDecay: 0,
            vegaRisk: 'N/A'
        };
    }

    /**
     * Special calculations for Tom King strategies
     */
    
    /**
     * Calculate 5-delta strike for strangles (Tom's favorite)
     */
    calculate5DeltaStrikes(spotPrice, volatility, timeToExpiry) {
        const putStrike = this.findStrikeByDelta({
            spotPrice,
            targetDelta: -0.05,
            timeToExpiry,
            volatility,
            optionType: 'put'
        });
        
        const callStrike = this.findStrikeByDelta({
            spotPrice,
            targetDelta: 0.05,
            timeToExpiry,
            volatility,
            optionType: 'call'
        });
        
        return {
            putStrike,
            callStrike,
            strangleWidth: callStrike - putStrike,
            widthPercent: ((callStrike - putStrike) / spotPrice * 100).toFixed(2)
        };
    }

    /**
     * Calculate expected move for 0DTE
     */
    calculateExpectedMove(spotPrice, volatility, daysToExpiry = 1) {
        // Expected move = Stock Price × IV × √(DTE/365)
        const expectedMove = spotPrice * volatility * Math.sqrt(daysToExpiry / 365);
        
        return {
            expectedMove: Math.round(expectedMove * 100) / 100,
            upperBound: Math.round((spotPrice + expectedMove) * 100) / 100,
            lowerBound: Math.round((spotPrice - expectedMove) * 100) / 100,
            movePercent: Math.round(expectedMove / spotPrice * 100 * 100) / 100
        };
    }

    /**
     * Calculate butterfly max profit zone
     */
    calculateButterflyProfitZone(shortStrike, wingWidth) {
        return {
            maxProfitStrike: shortStrike,
            breakEvenLower: shortStrike - wingWidth,
            breakEvenUpper: shortStrike + wingWidth,
            profitZoneWidth: wingWidth * 2,
            profitZonePercent: (wingWidth * 2 / shortStrike * 100).toFixed(2)
        };
    }

    /**
     * Initialize real-time Greeks system (if API available)
     */
    async initialize() {
        try {
            // getLogger already imported at top
            const logger = getLogger();
            logger.info('GREEKS', 'Initializing Greeks Calculator with real-time capabilities');
            return true;
        } catch (error) {
            // getLogger already imported at top
            const logger = getLogger();
            logger.error('GREEKS', 'Failed to initialize Greeks Calculator', error);
            throw error;
        }
    }

    /**
     * Fetch real Greeks from API ONLY - no fallback to calculated values
     */
    async fetchRealGreeks(symbol, strike, expiration, optionType) {
        try {
            if (!this.api) {
                throw new Error('API connection required for real Greeks data');
            }
            
            // Get option chain from API
            const optionChain = await this.api.getOptionChain(symbol);
            if (!optionChain || optionChain.length === 0) {
                throw new Error(`No option chain available for ${symbol}`);
            }
            
            // Find the specific option
            const expiry = optionChain.find(e => e.expiration === expiration);
            if (!expiry || !expiry.strikes) {
                throw new Error(`Expiration ${expiration} not found for ${symbol}`);
            }
            
            const strikeData = expiry.strikes.find(s => s.strike === strike);
            if (!strikeData) {
                throw new Error(`Strike ${strike} not found for ${symbol} ${expiration}`);
            }
            
            const option = optionType === 'call' ? strikeData.call : strikeData.put;
            if (!option) {
                throw new Error(`${optionType} option not found at strike ${strike}`);
            }
            
            // Return real Greeks from API
            return {
                delta: option.delta || 0,
                gamma: option.gamma || 0,
                theta: option.theta || 0,
                vega: option.vega || 0,
                rho: option.rho || 0,
                theoreticalPrice: option.theo || option.mid || ((option.bid + option.ask) / 2),
                iv: option.iv || 0,
                strike: strike,
                optionType: optionType,
                symbol: symbol,
                expiration: expiration,
                timestamp: new Date().toISOString(),
                source: 'TastyTrade_API'
            };
            
        } catch (error) {
            // getLogger already imported at top
            const logger = getLogger();
            logger.error('GREEKS', `Failed to fetch real Greeks for ${symbol}`, error);
            throw error; // No fallback - must use real data
        }
    }

    /**
     * REMOVED: No fallback Greeks allowed - must use real API data
     * @deprecated Use fetchRealGreeks() with API connection instead
     */
    getFallbackGreeks(symbol, strike, expiration, optionType) {
        throw new Error('Fallback Greeks not allowed - must use real API data. Connect to TastyTrade API for Greeks.');
    }

    /**
     * Calculate time to expiry in years
     */
    calculateTimeToExpiry(expiration) {
        const now = new Date();
        const expDate = new Date(expiration);
        const diffMs = expDate.getTime() - now.getTime();
        return Math.max(0.001, diffMs / (1000 * 60 * 60 * 24 * 365)); // Minimum 0.001 years
    }

    /**
     * Calculate optimal strangle strikes (simplified)
     */
    async calculateOptimalStrangleStrikes(symbol, expiration, targetDelta = 0.05) {
        try {
            // Use Black-Scholes to estimate strikes
            const spotPrice = 400; // Estimate
            const volatility = 0.25;
            const timeToExpiry = this.calculateTimeToExpiry(expiration);
            
            const putStrike = this.findStrikeByDelta({
                spotPrice,
                targetDelta: -targetDelta,
                timeToExpiry,
                volatility,
                optionType: 'put'
            });
            
            const callStrike = this.findStrikeByDelta({
                spotPrice,
                targetDelta: targetDelta,
                timeToExpiry,
                volatility,
                optionType: 'call'
            });
            
            return {
                putStrike: { strike: putStrike, delta: -targetDelta },
                callStrike: { strike: callStrike, delta: targetDelta },
                strangleWidth: callStrike - putStrike,
                underlyingPrice: spotPrice,
                expiration: expiration,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            // getLogger already imported at top
            const logger = getLogger();
            logger.error('GREEKS', `Failed to calculate optimal strangle strikes for ${symbol}`, error);
            throw error;
        }
    }

    /**
     * Get current alerts (placeholder)
     */
    getCurrentAlerts() {
        return this.currentAlerts || [];
    }

    /**
     * Get Greeks history (placeholder)
     */
    getGreeksHistory(limit = 50) {
        return this.greeksHistory ? this.greeksHistory.slice(-limit) : [];
    }

    /**
     * Force Greeks update (placeholder)
     */
    async forceGreeksUpdate() {
        const { getLogger } = require('./logger');
        const logger = getLogger();
        logger.info('GREEKS', 'Force update requested - using current implementation');
        return null;
    }

    /**
     * Cleanup
     */
    async shutdown() {
        try {
            // getLogger already imported at top
            const logger = getLogger();
            logger.info('GREEKS', 'Greeks Calculator shutdown');
        } catch (error) {
            // getLogger already imported at top
            const logger = getLogger();
            logger.error('GREEKS', 'Error during shutdown', error);
        }
    }
}

module.exports = { GreeksCalculator };