/**
 * OPTION PRICING ENGINE - Professional Black-Scholes Implementation
 * Industry-standard option pricing with real-time Greeks calculation
 * Designed for professional backtesting and risk management
 * 
 * CRITICAL FEATURES:
 * - Black-Scholes-Merton model for European options
 * - American option approximation for early exercise
 * - Real-time Greeks calculation (Delta, Gamma, Theta, Vega, Rho)
 * - Implied volatility surface modeling
 * - Volatility skew and term structure
 * - Time decay modeling throughout the day
 * - Dividend adjustments for equity options
 * - Interest rate curve integration
 * 
 * BASED ON:
 * - Hull "Options, Futures, and Other Derivatives"
 * - Wilmott "Paul Wilmott on Quantitative Finance"  
 * - Professional trading desk implementations
 * - CBOE methodology and standards
 */

const { getLogger } = require('./src/logger');

class OptionPricingEngine {
    constructor(config = {}) {
        this.logger = getLogger('OPTION_PRICING');
        this.config = config;
        
        // Professional pricing parameters
        this.pricingParams = {
            // Risk-free rate curve (simplified)
            riskFreeRate: {
                overnight: 0.02,    // 2% overnight rate
                '1month': 0.021,    // 2.1% 1-month
                '3month': 0.022,    // 2.2% 3-month  
                '1year': 0.025      // 2.5% 1-year
            },
            
            // Dividend yield by symbol
            dividendYield: {
                'SPY': 0.015,       // 1.5% dividend yield
                'QQQ': 0.008,       // 0.8% dividend yield
                'IWM': 0.012,       // 1.2% dividend yield
                'ES': 0.0,          // No dividend for futures
                'MES': 0.0          // No dividend for futures
            },
            
            // Volatility surface parameters
            volSurface: {
                atmVol: 0.18,       // 18% base ATM volatility
                skewSlope: -0.1,    // -10% skew per 1 SD
                termStructure: {
                    '7dte': 1.2,    // +20% for weekly options
                    '30dte': 1.0,   // Base level for monthly
                    '90dte': 0.9,   // -10% for quarterly
                    '365dte': 0.8   // -20% for LEAPS
                }
            },
            
            // Numerical precision
            precision: {
                price: 0.01,        // Penny precision
                greeks: 0.0001,     // High precision for Greeks
                impliedVol: 0.001,  // 0.1% precision for IV
                maxIterations: 100   // Max iterations for IV calculation
            }
        };
        
        // Greeks calculation cache for performance
        this.greeksCache = new Map();
        
        // Volatility surface cache
        this.volSurfaceCache = new Map();
        
        this.logger.info('OPTION_PRICING', 'Professional option pricing engine initialized');
    }
    
    /**
     * BLACK-SCHOLES OPTION PRICING - Core Implementation
     * 
     * @param {Object} params - Option parameters
     * @param {number} params.spot - Current underlying price
     * @param {number} params.strike - Option strike price
     * @param {number} params.timeToExpiry - Time to expiry in years
     * @param {number} params.volatility - Implied volatility
     * @param {number} params.riskFreeRate - Risk-free interest rate
     * @param {number} params.dividendYield - Dividend yield
     * @param {string} params.optionType - 'call' or 'put'
     */
    blackScholes(params) {
        const { spot, strike, timeToExpiry, volatility, riskFreeRate, dividendYield, optionType } = params;
        
        // Handle edge cases
        if (timeToExpiry <= 0) {
            return this.calculateIntrinsicValue(spot, strike, optionType);
        }
        
        if (volatility <= 0) {
            return this.calculateIntrinsicValue(spot, strike, optionType);
        }
        
        // Black-Scholes calculations
        const sqrtT = Math.sqrt(timeToExpiry);
        const d1 = (Math.log(spot / strike) + (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * timeToExpiry) 
                   / (volatility * sqrtT);
        const d2 = d1 - volatility * sqrtT;
        
        // Cumulative normal distribution values
        const nd1 = this.cumulativeNormalDistribution(d1);
        const nd2 = this.cumulativeNormalDistribution(d2);
        const nMinusD1 = this.cumulativeNormalDistribution(-d1);
        const nMinusD2 = this.cumulativeNormalDistribution(-d2);
        
        // Present value factors
        const pvSpot = spot * Math.exp(-dividendYield * timeToExpiry);
        const pvStrike = strike * Math.exp(-riskFreeRate * timeToExpiry);
        
        // Option prices
        let callPrice, putPrice;
        
        if (optionType.toLowerCase() === 'call') {
            callPrice = pvSpot * nd1 - pvStrike * nd2;
            putPrice = callPrice + pvStrike - pvSpot; // Put-call parity
        } else {
            putPrice = pvStrike * nMinusD2 - pvSpot * nMinusD1;
            callPrice = putPrice + pvSpot - pvStrike; // Put-call parity
        }
        
        const price = optionType.toLowerCase() === 'call' ? callPrice : putPrice;
        
        // Calculate Greeks
        const greeks = this.calculateGreeks(params, d1, d2, nd1, nd2, nMinusD1, nMinusD2);
        
        return {
            price: Math.max(0, price),
            intrinsicValue: this.calculateIntrinsicValue(spot, strike, optionType),
            timeValue: Math.max(0, price - this.calculateIntrinsicValue(spot, strike, optionType)),
            greeks,
            params: { ...params, d1, d2 }
        };
    }
    
    /**
     * CALCULATE OPTION GREEKS - Professional Implementation
     */
    calculateGreeks(params, d1, d2, nd1, nd2, nMinusD1, nMinusD2) {
        const { spot, strike, timeToExpiry, volatility, riskFreeRate, dividendYield, optionType } = params;
        
        if (timeToExpiry <= 0) {
            return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
        }
        
        const sqrtT = Math.sqrt(timeToExpiry);
        const pvSpot = spot * Math.exp(-dividendYield * timeToExpiry);
        const pvStrike = strike * Math.exp(-riskFreeRate * timeToExpiry);
        
        // Standard normal probability density function at d1
        const phi_d1 = this.standardNormalPDF(d1);
        
        let delta, gamma, theta, vega, rho;
        
        if (optionType.toLowerCase() === 'call') {
            // Call Greeks
            delta = Math.exp(-dividendYield * timeToExpiry) * nd1;
            gamma = Math.exp(-dividendYield * timeToExpiry) * phi_d1 / (spot * volatility * sqrtT);
            theta = (-spot * phi_d1 * volatility * Math.exp(-dividendYield * timeToExpiry) / (2 * sqrtT)
                    - riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * nd2
                    + dividendYield * spot * Math.exp(-dividendYield * timeToExpiry) * nd1) / 365;
            vega = spot * Math.exp(-dividendYield * timeToExpiry) * phi_d1 * sqrtT / 100;
            rho = strike * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * nd2 / 100;
        } else {
            // Put Greeks
            delta = -Math.exp(-dividendYield * timeToExpiry) * nMinusD1;
            gamma = Math.exp(-dividendYield * timeToExpiry) * phi_d1 / (spot * volatility * sqrtT);
            theta = (-spot * phi_d1 * volatility * Math.exp(-dividendYield * timeToExpiry) / (2 * sqrtT)
                    + riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * nMinusD2
                    - dividendYield * spot * Math.exp(-dividendYield * timeToExpiry) * nMinusD1) / 365;
            vega = spot * Math.exp(-dividendYield * timeToExpiry) * phi_d1 * sqrtT / 100;
            rho = -strike * timeToExpiry * Math.exp(-riskFreeRate * timeToExpiry) * nMinusD2 / 100;
        }
        
        return {
            delta: this.roundToGreekPrecision(delta),
            gamma: this.roundToGreekPrecision(gamma),
            theta: this.roundToGreekPrecision(theta),
            vega: this.roundToGreekPrecision(vega),
            rho: this.roundToGreekPrecision(rho)
        };
    }
    
    /**
     * PRICE OPTION with Professional Features
     */
    async priceOption(params) {
        const {
            underlying,
            strike,
            expiry,
            optionType,
            spot,
            volatility,
            timestamp
        } = params;
        
        // Calculate time to expiry
        const now = timestamp || new Date();
        const expiryDate = new Date(expiry);
        const timeToExpiry = Math.max(0, (expiryDate - now) / (1000 * 60 * 60 * 24 * 365));
        
        // Get risk-free rate and dividend yield
        const riskFreeRate = this.getRiskFreeRate(timeToExpiry);
        const dividendYield = this.getDividendYield(underlying);
        
        // Adjust volatility for skew and term structure
        const adjustedVolatility = this.adjustVolatilityForSkewAndTerm(
            volatility,
            spot,
            strike,
            timeToExpiry,
            underlying
        );
        
        // Price option using Black-Scholes
        const result = this.blackScholes({
            spot,
            strike,
            timeToExpiry,
            volatility: adjustedVolatility,
            riskFreeRate,
            dividendYield,
            optionType
        });
        
        // Calculate bid-ask spread
        const spread = this.calculateOptionSpread(result.price, adjustedVolatility, timeToExpiry);
        
        return {
            ...result,
            bidPrice: Math.max(0.01, result.price - spread / 2),
            askPrice: result.price + spread / 2,
            midPrice: result.price,
            spread,
            impliedVolatility: adjustedVolatility,
            timeToExpiry,
            underlying,
            strike,
            optionType,
            timestamp: now
        };
    }
    
    /**
     * UPDATE POSITION VALUE with Greeks Evolution
     */
    async updatePositionValue(position, currentSpot, currentTime) {
        const legs = this.getPositionLegs(position);
        let totalValue = 0;
        let totalGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
        
        for (const leg of legs) {
            const legValue = await this.priceOption({
                underlying: position.underlying,
                strike: leg.strike,
                expiry: leg.expiry,
                optionType: leg.optionType,
                spot: currentSpot,
                volatility: leg.impliedVolatility,
                timestamp: currentTime
            });
            
            // Apply position multiplier (long/short)
            const multiplier = leg.quantity;
            totalValue += legValue.price * multiplier;
            
            // Aggregate Greeks
            totalGreeks.delta += legValue.greeks.delta * multiplier;
            totalGreeks.gamma += legValue.greeks.gamma * multiplier;
            totalGreeks.theta += legValue.greeks.theta * multiplier;
            totalGreeks.vega += legValue.greeks.vega * multiplier;
            totalGreeks.rho += legValue.greeks.rho * multiplier;
        }
        
        return {
            totalValue,
            greeks: totalGreeks,
            legs: legs.map(leg => ({ ...leg, currentPrice: leg.currentPrice }))
        };
    }
    
    /**
     * VOLATILITY SURFACE MODELING
     */
    getVolatilitySmile(underlying, timestamp) {
        return {
            getVolatility: (strike, spot, timeToExpiry) => {
                const atmVol = this.pricingParams.volSurface.atmVol;
                const moneyness = Math.log(strike / spot);
                const skewAdjustment = this.pricingParams.volSurface.skewSlope * moneyness;
                
                // Term structure adjustment
                const termAdjustment = this.getTermStructureAdjustment(timeToExpiry);
                
                return atmVol + skewAdjustment + termAdjustment;
            }
        };
    }
    
    /**
     * IMPLIED VOLATILITY CALCULATION - Newton-Raphson Method
     */
    calculateImpliedVolatility(marketPrice, spot, strike, timeToExpiry, riskFreeRate, dividendYield, optionType) {
        let vol = 0.2; // Initial guess: 20%
        const maxIterations = this.pricingParams.precision.maxIterations;
        const tolerance = this.pricingParams.precision.impliedVol;
        
        for (let i = 0; i < maxIterations; i++) {
            const result = this.blackScholes({
                spot, strike, timeToExpiry, volatility: vol, 
                riskFreeRate, dividendYield, optionType
            });
            
            const priceDiff = result.price - marketPrice;
            
            if (Math.abs(priceDiff) < tolerance) {
                return vol;
            }
            
            // Newton-Raphson update
            if (result.greeks.vega > 0) {
                vol = vol - priceDiff / (result.greeks.vega * 100);
                vol = Math.max(0.001, Math.min(5.0, vol)); // Bound volatility
            } else {
                break;
            }
        }
        
        this.logger.warn('OPTION_PRICING', 'IV calculation did not converge', { marketPrice, spot, strike });
        return vol;
    }
    
    /**
     * AMERICAN OPTION APPROXIMATION - Binomial/Trinomial
     */
    americanOptionPrice(params, steps = 50) {
        const { spot, strike, timeToExpiry, volatility, riskFreeRate, dividendYield, optionType } = params;
        
        // Time step
        const dt = timeToExpiry / steps;
        const u = Math.exp(volatility * Math.sqrt(dt));  // Up factor
        const d = 1 / u;                                  // Down factor
        const p = (Math.exp((riskFreeRate - dividendYield) * dt) - d) / (u - d);  // Risk-neutral probability
        const discount = Math.exp(-riskFreeRate * dt);
        
        // Initialize price tree at expiration
        const prices = new Array(steps + 1);
        const values = new Array(steps + 1);
        
        // Calculate stock prices at expiration
        for (let i = 0; i <= steps; i++) {
            prices[i] = spot * Math.pow(u, 2 * i - steps);
            values[i] = Math.max(0, optionType.toLowerCase() === 'call' ? 
                prices[i] - strike : strike - prices[i]);
        }
        
        // Backward induction
        for (let step = steps - 1; step >= 0; step--) {
            for (let i = 0; i <= step; i++) {
                prices[i] = spot * Math.pow(u, 2 * i - step);
                
                // European value
                const europeanValue = discount * (p * values[i + 1] + (1 - p) * values[i]);
                
                // Intrinsic value (American exercise)
                const intrinsicValue = Math.max(0, optionType.toLowerCase() === 'call' ? 
                    prices[i] - strike : strike - prices[i]);
                
                // American option value is max of European and intrinsic
                values[i] = Math.max(europeanValue, intrinsicValue);
            }
        }
        
        return values[0];
    }
    
    /**
     * UTILITY METHODS
     */
    
    calculateIntrinsicValue(spot, strike, optionType) {
        if (optionType.toLowerCase() === 'call') {
            return Math.max(0, spot - strike);
        } else {
            return Math.max(0, strike - spot);
        }
    }
    
    cumulativeNormalDistribution(x) {
        // Abramowitz and Stegun approximation
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        
        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2.0);
        
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        
        return 0.5 * (1.0 + sign * y);
    }
    
    standardNormalPDF(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }
    
    getRiskFreeRate(timeToExpiry) {
        if (timeToExpiry <= 1/12) return this.pricingParams.riskFreeRate.overnight;
        if (timeToExpiry <= 0.25) return this.pricingParams.riskFreeRate['1month'];
        if (timeToExpiry <= 1) return this.pricingParams.riskFreeRate['3month'];
        return this.pricingParams.riskFreeRate['1year'];
    }
    
    getDividendYield(underlying) {
        return this.pricingParams.dividendYield[underlying] || 0;
    }
    
    adjustVolatilityForSkewAndTerm(baseVol, spot, strike, timeToExpiry, underlying) {
        // Moneyness adjustment (volatility skew)
        const moneyness = Math.log(strike / spot);
        const skewAdjustment = this.pricingParams.volSurface.skewSlope * moneyness;
        
        // Term structure adjustment
        const termAdjustment = this.getTermStructureAdjustment(timeToExpiry);
        
        return Math.max(0.01, baseVol + skewAdjustment + termAdjustment);
    }
    
    getTermStructureAdjustment(timeToExpiry) {
        const dteDays = timeToExpiry * 365;
        
        if (dteDays <= 7) return this.pricingParams.volSurface.termStructure['7dte'] - 1;
        if (dteDays <= 30) return this.pricingParams.volSurface.termStructure['30dte'] - 1;
        if (dteDays <= 90) return this.pricingParams.volSurface.termStructure['90dte'] - 1;
        
        return this.pricingParams.volSurface.termStructure['365dte'] - 1;
    }
    
    calculateOptionSpread(price, volatility, timeToExpiry) {
        // Professional spread modeling based on liquidity and Greeks
        let baseSpread = Math.max(0.05, price * 0.05); // 5% of option price or 5 cents minimum
        
        // Volatility adjustment
        baseSpread *= (1 + volatility);
        
        // Time decay adjustment (wider spreads closer to expiry)
        if (timeToExpiry < 7/365) {
            baseSpread *= 2.0;
        } else if (timeToExpiry < 30/365) {
            baseSpread *= 1.5;
        }
        
        return Math.round(baseSpread * 100) / 100; // Round to cents
    }
    
    getPositionLegs(position) {
        // Extract individual option legs from complex position
        const legs = [];
        
        switch (position.type) {
            case 'CALL_SPREAD':
            case 'PUT_SPREAD':
                legs.push({
                    strike: position.shortStrike,
                    optionType: position.type.includes('CALL') ? 'call' : 'put',
                    quantity: -1, // Short
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                legs.push({
                    strike: position.longStrike,
                    optionType: position.type.includes('CALL') ? 'call' : 'put',
                    quantity: 1, // Long
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                break;
                
            case 'IRON_CONDOR':
                // Put spread
                legs.push({
                    strike: position.putShort,
                    optionType: 'put',
                    quantity: -1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                legs.push({
                    strike: position.putLong,
                    optionType: 'put',
                    quantity: 1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                // Call spread
                legs.push({
                    strike: position.callShort,
                    optionType: 'call',
                    quantity: -1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                legs.push({
                    strike: position.callLong,
                    optionType: 'call',
                    quantity: 1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                break;
                
            case 'SHORT_STRANGLE':
                legs.push({
                    strike: position.putStrike,
                    optionType: 'put',
                    quantity: -1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                legs.push({
                    strike: position.callStrike,
                    optionType: 'call',
                    quantity: -1,
                    expiry: position.expiration,
                    impliedVolatility: position.impliedVolatility || 0.2
                });
                break;
        }
        
        return legs;
    }
    
    roundToGreekPrecision(value) {
        return Math.round(value / this.pricingParams.precision.greeks) * this.pricingParams.precision.greeks;
    }
    
    /**
     * PREPARE OPTION CHAINS for backtesting
     */
    async prepareOptionChains(symbols, startDate, endDate) {
        this.logger.info('OPTION_CHAINS', 'Preparing option chains for backtesting', { symbols });
        
        for (const symbol of symbols) {
            // Generate standard option strikes and expiration dates
            const chains = this.generateOptionChains(symbol, startDate, endDate);
            this.optionChains.set(symbol, chains);
        }
        
        this.logger.info('OPTION_CHAINS', 'Option chains prepared successfully');
    }
    
    generateOptionChains(symbol, startDate, endDate) {
        // Generate realistic option chains with standard strikes and expiries
        const chains = new Map();
        
        // Standard expiration dates (3rd Friday of each month)
        const expirationDates = this.generateExpirationDates(startDate, endDate);
        
        // Standard strikes around typical price levels
        const basePrice = this.getTypicalPrice(symbol);
        const strikes = this.generateStrikes(basePrice);
        
        for (const expiry of expirationDates) {
            for (const strike of strikes) {
                const chainKey = `${symbol}_${expiry}_${strike}`;
                chains.set(chainKey, {
                    symbol,
                    expiry,
                    strike,
                    call: { available: true, volume: Math.floor(Math.random() * 1000) },
                    put: { available: true, volume: Math.floor(Math.random() * 1000) }
                });
            }
        }
        
        return chains;
    }
    
    generateExpirationDates(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        
        while (current <= new Date(endDate)) {
            // Third Friday of the month
            const thirdFriday = this.getThirdFriday(current.getFullYear(), current.getMonth());
            if (thirdFriday >= new Date(startDate) && thirdFriday <= new Date(endDate)) {
                dates.push(thirdFriday.toISOString().split('T')[0]);
            }
            
            // Move to next month
            current.setMonth(current.getMonth() + 1);
        }
        
        return dates;
    }
    
    getThirdFriday(year, month) {
        const date = new Date(year, month, 1);
        
        // Find first Friday
        while (date.getDay() !== 5) {
            date.setDate(date.getDate() + 1);
        }
        
        // Add 14 days to get third Friday
        date.setDate(date.getDate() + 14);
        
        return date;
    }
    
    generateStrikes(basePrice) {
        const strikes = [];
        const increment = basePrice > 1000 ? 5 : 1;
        
        // Generate strikes +/- 20% around base price
        for (let strike = basePrice * 0.8; strike <= basePrice * 1.2; strike += increment) {
            strikes.push(Math.round(strike / increment) * increment);
        }
        
        return strikes;
    }
    
    getTypicalPrice(symbol) {
        const prices = {
            'ES': 4200,
            'MES': 4200,
            'SPY': 420,
            'QQQ': 350,
            'IWM': 200,
            'GLD': 180,
            'TLT': 100
        };
        
        return prices[symbol] || 100;
    }
}

module.exports = OptionPricingEngine;