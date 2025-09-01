/**
 * Greeks Calculator Module
 * Complete options Greeks calculations for Tom King Trading Framework
 */

const math = require('mathjs');

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
        const numerator = Math.log(S / K) + (this.riskFreeRate - q + 0.5 * sigma * sigma) * T;
        const denominator = sigma * Math.sqrt(T);
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
     * Calculate portfolio Greeks (aggregate)
     */
    calculatePortfolioGreeks(positions) {
        const portfolioGreeks = {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0,
            deltaAdjusted: 0, // Beta-weighted delta
            totalValue: 0
        };

        positions.forEach(position => {
            const greeks = this.calculateGreeks(position);
            const quantity = position.quantity || 1;
            const multiplier = position.multiplier || 100; // Options multiplier
            
            portfolioGreeks.delta += greeks.delta * quantity * multiplier;
            portfolioGreeks.gamma += greeks.gamma * quantity * multiplier;
            portfolioGreeks.theta += greeks.theta * quantity * multiplier;
            portfolioGreeks.vega += greeks.vega * quantity * multiplier;
            portfolioGreeks.rho += greeks.rho * quantity * multiplier;
            portfolioGreeks.totalValue += greeks.theoreticalPrice * quantity * multiplier;
        });

        // Calculate SPY-equivalent delta (beta-weighted)
        const betaAdjustment = 1; // Assume beta of 1 for simplicity
        portfolioGreeks.deltaAdjusted = portfolioGreeks.delta * betaAdjustment;

        return {
            ...portfolioGreeks,
            // Risk metrics for Tom King strategies
            gammaRisk: this.assessGammaRisk(portfolioGreeks.gamma),
            thetaIncome: Math.round(portfolioGreeks.theta), // Daily income from theta
            vegaExposure: this.assessVegaExposure(portfolioGreeks.vega),
            deltaNeutral: Math.abs(portfolioGreeks.delta) < 50, // Consider neutral if < 50 deltas
            riskScore: this.calculateGreeksRiskScore(portfolioGreeks)
        };
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
}

module.exports = GreeksCalculator;