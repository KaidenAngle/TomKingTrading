/**
 * Data Validation Module
 * Ensures all market data is real and valid before use
 * Replaces dangerous fallback values with proper error handling
 * Critical for production trading safety
 */

const { getLogger } = require('./logger');
const logger = getLogger();

class DataValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.name = 'DataValidationError';
        this.field = field;
        this.value = value;
        this.timestamp = new Date();
    }
}

class DataValidator {
    constructor(config = {}) {
        this.config = {
            requireRealData: config.requireRealData !== false, // Default true for safety
            allowStaleData: config.allowStaleData || false,
            maxDataAge: config.maxDataAge || 60000, // 1 minute max staleness
            minVIX: config.minVIX || 8,  // Minimum realistic VIX
            maxVIX: config.maxVIX || 100, // Maximum realistic VIX
            minPrice: config.minPrice || 0.01,
            maxPrice: config.maxPrice || 1000000,
            ...config
        };
        
        this.validationErrors = [];
        this.lastValidation = null;
    }
    
    /**
     * Validate VIX data - NEVER use fallback values
     */
    validateVIX(vixData, required = true) {
        if (!vixData || vixData === undefined || vixData === null) {
            if (required) {
                throw new DataValidationError(
                    'VIX data is required but not available',
                    'VIX',
                    vixData
                );
            }
            return null;
        }
        
        // Extract VIX value from various formats
        const vix = typeof vixData === 'object' 
            ? (vixData.currentPrice || vixData.last || vixData.value)
            : vixData;
        
        // Validate VIX is a number
        if (typeof vix !== 'number' || isNaN(vix)) {
            throw new DataValidationError(
                `VIX must be a valid number, got: ${typeof vix}`,
                'VIX',
                vix
            );
        }
        
        // Validate VIX range
        if (vix < this.config.minVIX || vix > this.config.maxVIX) {
            throw new DataValidationError(
                `VIX ${vix} outside valid range (${this.config.minVIX}-${this.config.maxVIX})`,
                'VIX',
                vix
            );
        }
        
        logger.debug('DataValidator', `VIX validated: ${vix}`);
        return vix;
    }
    
    /**
     * Validate price data - no fallbacks
     */
    validatePrice(priceData, symbol, required = true) {
        if (!priceData || priceData === undefined || priceData === null) {
            if (required) {
                throw new DataValidationError(
                    `Price data required for ${symbol} but not available`,
                    'price',
                    priceData
                );
            }
            return null;
        }
        
        // Extract price from various formats
        const price = typeof priceData === 'object'
            ? (priceData.currentPrice || priceData.last || priceData.close || priceData.mark)
            : priceData;
        
        // Validate price is a number
        if (typeof price !== 'number' || isNaN(price)) {
            throw new DataValidationError(
                `Price for ${symbol} must be a valid number, got: ${typeof price}`,
                'price',
                price
            );
        }
        
        // Validate price range
        if (price < this.config.minPrice || price > this.config.maxPrice) {
            throw new DataValidationError(
                `Price ${price} for ${symbol} outside valid range`,
                'price',
                price
            );
        }
        
        return price;
    }
    
    /**
     * Validate option chain data
     */
    validateOptionChain(optionChain, symbol) {
        if (!optionChain) {
            throw new DataValidationError(
                `Option chain required for ${symbol} but not available`,
                'optionChain',
                null
            );
        }
        
        // Check for required fields
        const requiredFields = ['expirations', 'strikes'];
        for (const field of requiredFields) {
            if (!optionChain[field]) {
                throw new DataValidationError(
                    `Option chain missing required field: ${field}`,
                    field,
                    optionChain
                );
            }
        }
        
        // Validate we have actual strike data
        if (Object.keys(optionChain.strikes || {}).length === 0) {
            throw new DataValidationError(
                `Option chain has no strike prices for ${symbol}`,
                'strikes',
                optionChain.strikes
            );
        }
        
        return optionChain;
    }
    
    /**
     * Validate Greeks data
     */
    validateGreeks(greeks, required = false) {
        if (!greeks) {
            if (required) {
                throw new DataValidationError(
                    'Greeks data required but not available',
                    'greeks',
                    null
                );
            }
            return null;
        }
        
        const validatedGreeks = {};
        
        // Validate delta (-1 to 1)
        if (greeks.delta !== undefined) {
            if (typeof greeks.delta !== 'number' || Math.abs(greeks.delta) > 1) {
                throw new DataValidationError(
                    `Invalid delta: ${greeks.delta} (must be between -1 and 1)`,
                    'delta',
                    greeks.delta
                );
            }
            validatedGreeks.delta = greeks.delta;
        }
        
        // Validate gamma (positive)
        if (greeks.gamma !== undefined) {
            if (typeof greeks.gamma !== 'number' || greeks.gamma < 0) {
                throw new DataValidationError(
                    `Invalid gamma: ${greeks.gamma} (must be positive)`,
                    'gamma',
                    greeks.gamma
                );
            }
            validatedGreeks.gamma = greeks.gamma;
        }
        
        // Validate theta (typically negative for long options)
        if (greeks.theta !== undefined) {
            if (typeof greeks.theta !== 'number') {
                throw new DataValidationError(
                    `Invalid theta: ${greeks.theta} (must be a number)`,
                    'theta',
                    greeks.theta
                );
            }
            validatedGreeks.theta = greeks.theta;
        }
        
        // Validate vega (positive)
        if (greeks.vega !== undefined) {
            if (typeof greeks.vega !== 'number' || greeks.vega < 0) {
                throw new DataValidationError(
                    `Invalid vega: ${greeks.vega} (must be positive)`,
                    'vega',
                    greeks.vega
                );
            }
            validatedGreeks.vega = greeks.vega;
        }
        
        return validatedGreeks;
    }
    
    /**
     * Validate IV data
     */
    validateIV(ivData, required = false) {
        if (!ivData && !required) {
            return null;
        }
        
        if (!ivData) {
            throw new DataValidationError(
                'IV data required but not available',
                'iv',
                null
            );
        }
        
        const iv = typeof ivData === 'object' 
            ? (ivData.value || ivData.iv)
            : ivData;
        
        // IV should be between 0 and 500 (percent)
        if (typeof iv !== 'number' || iv < 0 || iv > 500) {
            throw new DataValidationError(
                `Invalid IV: ${iv} (must be 0-500%)`,
                'iv',
                iv
            );
        }
        
        return iv;
    }
    
    /**
     * Validate volume and open interest
     */
    validateVolumeOI(volume, openInterest) {
        const validated = {};
        
        if (volume !== undefined && volume !== null) {
            if (typeof volume !== 'number' || volume < 0) {
                throw new DataValidationError(
                    `Invalid volume: ${volume} (must be non-negative number)`,
                    'volume',
                    volume
                );
            }
            validated.volume = Math.floor(volume);
        }
        
        if (openInterest !== undefined && openInterest !== null) {
            if (typeof openInterest !== 'number' || openInterest < 0) {
                throw new DataValidationError(
                    `Invalid open interest: ${openInterest} (must be non-negative number)`,
                    'openInterest',
                    openInterest
                );
            }
            validated.openInterest = Math.floor(openInterest);
        }
        
        return validated;
    }
    
    /**
     * Validate account data
     */
    validateAccountData(accountData) {
        if (!accountData) {
            throw new DataValidationError(
                'Account data required but not available',
                'account',
                null
            );
        }
        
        const required = ['balance', 'buyingPower'];
        for (const field of required) {
            if (accountData[field] === undefined || accountData[field] === null) {
                throw new DataValidationError(
                    `Account data missing required field: ${field}`,
                    field,
                    accountData
                );
            }
            
            if (typeof accountData[field] !== 'number' || accountData[field] < 0) {
                throw new DataValidationError(
                    `Invalid ${field}: ${accountData[field]} (must be non-negative number)`,
                    field,
                    accountData[field]
                );
            }
        }
        
        return accountData;
    }
    
    /**
     * Validate market data freshness
     */
    validateDataFreshness(timestamp, maxAge = null) {
        const age = maxAge || this.config.maxDataAge;
        const dataAge = Date.now() - new Date(timestamp).getTime();
        
        if (dataAge > age) {
            if (!this.config.allowStaleData) {
                throw new DataValidationError(
                    `Data is ${Math.floor(dataAge/1000)}s old (max allowed: ${Math.floor(age/1000)}s)`,
                    'timestamp',
                    timestamp
                );
            } else {
                logger.warn('DataValidator', `Using stale data: ${Math.floor(dataAge/1000)}s old`);
            }
        }
        
        return true;
    }
    
    /**
     * Validate complete market data structure
     */
    validateMarketData(marketData, requirements = {}) {
        const validated = {};
        const errors = [];
        
        // Validate VIX if required
        if (requirements.vix !== false) {
            try {
                validated.vix = this.validateVIX(marketData.VIX || marketData.vix, requirements.vix);
            } catch (error) {
                errors.push(error);
            }
        }
        
        // Validate prices for required symbols
        if (requirements.symbols) {
            validated.prices = {};
            for (const symbol of requirements.symbols) {
                try {
                    validated.prices[symbol] = this.validatePrice(
                        marketData[symbol],
                        symbol,
                        true
                    );
                } catch (error) {
                    errors.push(error);
                }
            }
        }
        
        // Validate option chains if required
        if (requirements.optionChains) {
            validated.optionChains = {};
            for (const symbol of requirements.optionChains) {
                try {
                    validated.optionChains[symbol] = this.validateOptionChain(
                        marketData.optionChain?.[symbol],
                        symbol
                    );
                } catch (error) {
                    errors.push(error);
                }
            }
        }
        
        // Store validation results
        this.lastValidation = {
            timestamp: Date.now(),
            validated,
            errors,
            passed: errors.length === 0
        };
        
        if (errors.length > 0 && this.config.requireRealData) {
            logger.error('DataValidator', `Validation failed with ${errors.length} errors`);
            throw errors[0]; // Throw first error
        }
        
        return validated;
    }
    
    /**
     * Get validation report
     */
    getValidationReport() {
        return {
            lastValidation: this.lastValidation,
            config: this.config,
            errorCount: this.validationErrors.length,
            recentErrors: this.validationErrors.slice(-10)
        };
    }
    
    /**
     * Clear validation errors
     */
    clearErrors() {
        this.validationErrors = [];
        this.lastValidation = null;
    }
}

/**
 * Singleton instance for global validation
 */
let globalValidator = null;

function getGlobalValidator(config) {
    if (!globalValidator) {
        globalValidator = new DataValidator(config);
    }
    return globalValidator;
}

module.exports = {
    DataValidator,
    DataValidationError,
    getGlobalValidator
};