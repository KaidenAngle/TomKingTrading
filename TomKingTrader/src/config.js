/**
 * TomKingTrader Configuration Module
 * Centralized configuration management for all system settings
 */

const path = require('path');

/**
 * Environment Configuration
 */
const ENVIRONMENT = {
    sandbox: {
        API_BASE: 'https://api.cert.tastyworks.com',
        STREAMER: 'wss://streamer.cert.tastyworks.com',
        LOG_LEVEL: 'debug',
        RATE_LIMIT: false,
        description: 'TastyWorks sandbox environment - safe testing with simulated fills',
        features: {
            marketOrderFill: '$1.00', // Market orders fill at $1
            limitOrderFill: 'immediate_if_under_$3', // Limits ≤$3 fill immediately
            accountBalance: 100000, // $100k simulated balance
            realMarketData: true // Real market data, simulated executions
        }
    },
    development: {
        API_BASE: 'https://api.cert.tastyworks.com',
        STREAMER: 'wss://streamer.cert.tastyworks.com',
        LOG_LEVEL: 'debug',
        RATE_LIMIT: false,
        description: 'Development environment using sandbox API'
    },
    paper: {
        API_BASE: 'https://api.tastyworks.com',
        STREAMER: 'wss://streamer.tastyworks.com',
        LOG_LEVEL: 'info',
        RATE_LIMIT: true,
        description: 'Paper trading with real market data',
        accountType: 'paper_trading'
    },
    production: {
        API_BASE: 'https://api.tastyworks.com',
        STREAMER: 'wss://streamer.tastyworks.com',
        LOG_LEVEL: 'info',
        RATE_LIMIT: true,
        description: 'Live trading environment - real money',
        safetyChecks: true
    }
};

/**
 * Account Phase Configuration
 * Based on Tom King's progressive account growth strategy
 */
const PHASES = {
    1: {
        name: 'Foundation Phase',
        range: { min: 30000, max: 40000 },
        description: 'Building foundation with micro futures and basic strategies',
        allowedStrategies: ['STRANGLE', '0DTE', 'LT112'],
        allowedTickers: ['MCL', 'MGC', 'GLD', 'TLT'],
        maxBPUsage: 'DYNAMIC', // VIX-based: 45-80% per Tom King
        maxPositionsPerGroup: 2,
        riskLimits: {
            maxRiskPerTrade: 0.05, // 5%
            maxCorrelatedPositions: 2,
            emergencyStopLoss: 0.20 // 20%
        },
        buyingPowerRequirements: {
            'STRANGLE': 2.5, // % of account value
            'LT112': 3.0,
            '0DTE': 2.0,
            'IPMCC': 0, // Not allowed in Phase 1
            'LEAP': 0,
            'BUTTERFLY': 0,
            'RATIO': 0,
            'DIAGONAL': 0,
            'BOX': 0
        }
    },
    2: {
        name: 'Expansion Phase',
        range: { min: 40000, max: 60000 },
        description: 'Adding MES, MNQ and expanding opportunity set',
        allowedStrategies: ['STRANGLE', '0DTE', 'LT112', 'IPMCC', 'LEAP'],
        allowedTickers: ['MCL', 'MGC', 'GLD', 'TLT', 'MES', 'MNQ', 'SLV', 'XOP'],
        maxBPUsage: 'DYNAMIC', // VIX-based: 45-80% per Tom King
        maxPositionsPerGroup: 2,
        riskLimits: {
            maxRiskPerTrade: 0.04,
            maxCorrelatedPositions: 2, // Phase 1-2: Max 2 per group
            emergencyStopLoss: 0.15
        },
        buyingPowerRequirements: {
            'STRANGLE': 3.0,
            'LT112': 4.0,
            '0DTE': 2.0,
            'IPMCC': 6.0,
            'LEAP': 2.0,
            'BUTTERFLY': 0.5,
            'RATIO': 2.0,
            'DIAGONAL': 0,
            'BOX': 0
        }
    },
    3: {
        name: 'Diversification Phase',
        range: { min: 60000, max: 75000 },
        description: 'Full futures upgrade and advanced strategies',
        allowedStrategies: ['STRANGLE', '0DTE', 'LT112', 'IPMCC', 'LEAP', 'BUTTERFLY', 'RATIO', 'DIAGONAL'],
        allowedTickers: ['ES', 'CL', 'GC', 'LE', 'HE', 'ZC', 'ZS', 'ZW', 'TLT', 'GLD', 'SLV'],
        maxBPUsage: 'DYNAMIC', // VIX-based: 45-80% per Tom King
        maxPositionsPerGroup: 3,
        riskLimits: {
            maxRiskPerTrade: 0.03,
            maxCorrelatedPositions: 3,
            emergencyStopLoss: 0.12
        },
        buyingPowerRequirements: {
            'STRANGLE': 3.5,
            'LT112': 6.0,
            '0DTE': 2.0,
            'IPMCC': 8.0,
            'LEAP': 2.0,
            'BUTTERFLY': 0.5,
            'RATIO': 2.0,
            'DIAGONAL': 1.5,
            'BOX': 0
        }
    },
    4: {
        name: 'Professional Phase',
        range: { min: 75000, max: 1000000 },
        description: 'Full professional deployment with all strategies',
        allowedStrategies: ['STRANGLE', '0DTE', 'LT112', 'IPMCC', 'LEAP', 'BUTTERFLY', 'RATIO', 'DIAGONAL', 'BOX'],
        allowedTickers: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'NG', 'SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT', 'XLE', 'XOP'],
        maxBPUsage: 'DYNAMIC', // VIX-based: 45-80% per Tom King
        maxPositionsPerGroup: 4,
        riskLimits: {
            maxRiskPerTrade: 0.025,
            maxCorrelatedPositions: 4,
            emergencyStopLoss: 0.10
        },
        buyingPowerRequirements: {
            'STRANGLE': 3.5,
            'LT112': 6.0,
            '0DTE': 2.0,
            'IPMCC': 8.0,
            'LEAP': 2.0,
            'BUTTERFLY': 0.5,
            'RATIO': 2.0,
            'DIAGONAL': 1.5,
            'BOX': 0
        }
    }
};

/**
 * Trading Strategies Configuration
 */
const STRATEGIES = {
    '0DTE': {
        name: '0DTE Friday',
        description: 'Zero days to expiration credit spreads on Friday',
        winRate: 88, // Tom King's actual 0DTE win rate
        avgReturn: 8.5,
        maxLoss: 100, // % of premium
        daysAllowed: ['Friday'],
        timeWindow: { start: '10:30', end: '15:30' },
        entryRules: {
            minVIXRank: 20,
            maxVIXLevel: 35,
            minIVRank: 30,
            preferredDelta: 5,
            minPremium: 0.25
        },
        exitRules: {
            profitTarget: 50, // % of max profit
            stopLoss: 200, // % of premium
            timeDecay: true,
            manageAt21DTE: false
        },
        riskLimits: {
            maxPositions: 3,
            maxBPPercentage: 6,
            correlationLimit: 1
        }
    },
    'LT112': {
        name: 'Long-Term 112',
        description: '112-day targeted strangles',
        winRate: 73, // Tom King's actual LT112 win rate
        avgReturn: 12,
        maxLoss: 50,
        daysAllowed: ['Monday', 'Tuesday', 'Wednesday'],
        targetDTE: 112,
        entryRules: {
            minVIXRank: 15,
            maxVIXLevel: 40,
            minIVRank: 20,
            preferredDelta: 10,
            minPremium: 1.0
        },
        exitRules: {
            profitTarget: 50,
            stopLoss: 150,
            manageAt21DTE: true,
            rollAt21DTE: true
        },
        riskLimits: {
            maxPositions: 5,
            maxBPPercentage: 15,
            correlationLimit: 2
        }
    },
    'STRANGLE': {
        name: 'Futures Strangles',
        description: 'Short strangles on futures with 90 DTE',
        winRate: 72, // Tom King's actual strangle win rate
        avgReturn: 15,
        maxLoss: 200,
        daysAllowed: ['Tuesday'],
        targetDTE: 90,
        entryRules: {
            minVIXRank: 25,
            maxVIXLevel: 50,
            minIVRank: 30,
            preferredDelta: 15,
            minPremium: 2.0
        },
        exitRules: {
            profitTarget: 50,
            stopLoss: 200,
            manageAt21DTE: true,
            rollDown: true
        },
        riskLimits: {
            maxPositions: 4,
            maxBPPercentage: 12,
            correlationLimit: 2
        }
    },
    'IPMCC': {
        name: 'Income Producing Married Call',
        description: 'LEAP + short calls for income',
        winRate: 83, // Tom King's actual IPMCC win rate
        avgReturn: 6,
        maxLoss: 15,
        daysAllowed: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        entryRules: {
            leapDelta: 80,
            shortDelta: 30,
            minTimeSpread: 60,
            maxVIXLevel: 25
        },
        exitRules: {
            rollShortAt21DTE: true,
            profitTarget: 25,
            manageLeap: true
        },
        riskLimits: {
            maxPositions: 3,
            maxBPPercentage: 20,
            correlationLimit: 2
        }
    },
    'LEAP': {
        name: 'LEAP Options',
        description: 'Long-term equity anticipation securities',
        winRate: 82, // Tom King's actual LEAP win rate
        avgReturn: 25,
        maxLoss: 100,
        entryRules: {
            minDTE: 365,
            minDelta: 70,
            maxVIXLevel: 30
        },
        exitRules: {
            profitTarget: 100,
            stopLoss: 50,
            timeDecay: false
        },
        riskLimits: {
            maxPositions: 2,
            maxBPPercentage: 10,
            correlationLimit: 1
        }
    },
    'BUTTERFLY': {
        name: 'Iron Butterfly',
        description: 'Market neutral strategy',
        winRate: 65,
        avgReturn: 8,
        maxLoss: 80,
        entryRules: {
            maxVIXLevel: 20,
            neutralMarket: true,
            minIVRank: 40
        },
        exitRules: {
            profitTarget: 25,
            stopLoss: 100,
            manageWings: true
        },
        riskLimits: {
            maxPositions: 3,
            maxBPPercentage: 5,
            correlationLimit: 1
        }
    },
    'RATIO': {
        name: 'Ratio Spreads',
        description: 'Unbalanced credit spreads',
        winRate: 78,
        avgReturn: 10,
        maxLoss: 150,
        entryRules: {
            maxVIXLevel: 25,
            ratio: [1, 2], // 1 long, 2 short
            preferredDelta: 25
        },
        exitRules: {
            profitTarget: 40,
            stopLoss: 200,
            manageUpside: true
        },
        riskLimits: {
            maxPositions: 2,
            maxBPPercentage: 8,
            correlationLimit: 1
        }
    },
    'DIAGONAL': {
        name: 'Diagonal Spreads',
        description: 'Time and price spreads',
        winRate: 72,
        avgReturn: 12,
        maxLoss: 100,
        entryRules: {
            timeDifference: 30, // days
            strikeDifference: 50, // points
            maxVIXLevel: 30
        },
        exitRules: {
            rollShortLeg: true,
            profitTarget: 35,
            manageTime: true
        },
        riskLimits: {
            maxPositions: 3,
            maxBPPercentage: 6,
            correlationLimit: 1
        }
    },
    'BOX': {
        name: 'Box Spreads',
        description: 'Risk-free arbitrage opportunities',
        winRate: 95,
        avgReturn: 3,
        maxLoss: 5,
        entryRules: {
            arbitrageOpportunity: true,
            minSpread: 0.1,
            liquidMarket: true
        },
        exitRules: {
            holdToExpiration: true
        },
        riskLimits: {
            maxPositions: 5,
            maxBPPercentage: 25,
            correlationLimit: 5
        }
    }
};

/**
 * Correlation Groups
 * Based on Tom King's correlation analysis to prevent August 5, 2024 disasters
 */
const CORRELATION_GROUPS = {
    'EQUITIES': {
        description: 'Stock index futures and ETFs',
        tickers: ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'SPY', 'QQQ', 'IWM'],
        maxPositions: 3,
        riskMultiplier: 1.5
    },
    'EQUITY_INDICES': {
        description: 'Stock index futures and ETFs (alias for EQUITIES)',
        tickers: ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'SPY', 'QQQ', 'IWM'],
        maxPositions: 3,
        riskMultiplier: 1.5
    },
    'ENERGY': {
        description: 'Oil, gas, and energy ETFs',
        tickers: ['CL', 'MCL', 'NG', 'XLE', 'XOP'],
        maxPositions: 2,
        riskMultiplier: 2.0
    },
    'PRECIOUS_METALS': {
        description: 'Gold, silver, and precious metals',
        tickers: ['GC', 'MGC', 'SI', 'GLD', 'SLV'],
        maxPositions: 3,
        riskMultiplier: 1.2
    },
    'FIXED_INCOME': {
        description: 'Bonds and treasury ETFs',
        tickers: ['ZB', 'ZN', 'ZF', 'TLT', 'IEF'],
        maxPositions: 2,
        riskMultiplier: 0.8
    },
    'AGRICULTURE': {
        description: 'Agricultural commodities',
        tickers: ['ZC', 'ZS', 'ZW', 'LE', 'HE'],
        maxPositions: 2,
        riskMultiplier: 1.8
    },
    'CURRENCY': {
        description: 'Currency futures and ETFs',
        tickers: ['DXY', 'EUR', 'GBP', 'UUP', 'FXE'],
        maxPositions: 2,
        riskMultiplier: 1.3
    },
    'VOLATILITY': {
        description: 'VIX and volatility products',
        tickers: ['VIX', 'VXX', 'UVXY', 'SVXY'],
        maxPositions: 1,
        riskMultiplier: 3.0
    }
};

/**
 * Risk Management Configuration
 */
const RISK_LIMITS = {
    // Global limits
    MAX_PORTFOLIO_RISK: 0.15, // 15% of account value
    MAX_BP_USAGE: 'DYNAMIC', // VIX-based: 45-80% per Tom King system
    MAX_CORRELATION_EXPOSURE: 0.25, // 25% per correlation group
    
    // Tom King's VIX-based BP system
    getMaxBPUsage: (vixLevel) => {
        if (vixLevel < 13) return 0.45; // 45% for VIX <13
        if (vixLevel < 18) return 0.65; // 65% for VIX 13-18
        if (vixLevel < 25) return 0.75; // 75% for VIX 18-25
        if (vixLevel < 30) return 0.50; // 50% for VIX 25-30
        return 0.80; // 80% for VIX >30 (puts only)
    },
    
    // VIX-based adjustments
    VIX_REGIMES: {
        'EXTREMELY_LOW': { range: [0, 12], bpMultiplier: 1.2, riskMultiplier: 0.8 },
        'LOW': { range: [12, 16], bpMultiplier: 1.1, riskMultiplier: 0.9 },
        'NORMAL': { range: [16, 20], bpMultiplier: 1.0, riskMultiplier: 1.0 },
        'ELEVATED': { range: [20, 30], bpMultiplier: 0.9, riskMultiplier: 1.1 },
        'HIGH': { range: [30, 40], bpMultiplier: 0.7, riskMultiplier: 1.3 },
        'EXTREME': { range: [40, 100], bpMultiplier: 1.5, riskMultiplier: 0.6 }
    },
    
    // Position management
    POSITION_LIMITS: {
        maxPositionsPerTicker: 2,
        maxSameStrategyPositions: 5,
        minDiversification: 3, // minimum different tickers
        maxConcentration: 0.20 // max 20% in single ticker
    },
    
    // Emergency protocols
    EMERGENCY_TRIGGERS: {
        accountDrawdown: 0.20, // 20% account drawdown
        dailyLoss: 0.05, // 5% daily loss
        vixSpike: 35, // VIX above 35
        correlationBreach: 1.5, // 150% of correlation limit
        marginCall: true
    }
};

/**
 * Technical Analysis Configuration
 */
const TECHNICAL_CONFIG = {
    // Moving averages
    EMA_PERIODS: [9, 21, 50],
    SMA_PERIODS: [20, 50, 200],
    
    // Oscillators
    RSI_PERIOD: 14,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    
    // Volatility
    ATR_PERIOD: 14,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD: 2,
    
    // Volume
    VOLUME_SMA: 20,
    VOLUME_THRESHOLD: 1.5, // 150% of average
    
    // Patterns
    PATTERN_CONFIDENCE: {
        'EXCELLENT': { min: 85, color: '#059669' },
        'GOOD': { min: 70, color: '#0891b2' },
        'FAIR': { min: 50, color: '#d97706' },
        'POOR': { min: 0, color: '#dc2626' }
    }
};

/**
 * API Configuration
 */
const API_CONFIG = {
    // Rate limiting
    RATE_LIMITS: {
        requestsPerSecond: 10,
        requestsPerMinute: 120,
        requestsPerHour: 1000
    },
    
    // Timeouts
    TIMEOUTS: {
        connection: 10000, // 10 seconds
        request: 30000, // 30 seconds
        stream: 60000 // 1 minute
    },
    
    // Retry configuration
    RETRY: {
        maxAttempts: 3,
        baseDelay: 1000, // 1 second
        maxDelay: 30000, // 30 seconds
        backoffMultiplier: 2
    },
    
    // WebSocket
    WEBSOCKET: {
        pingInterval: 30000, // 30 seconds
        pongTimeout: 5000, // 5 seconds
        reconnectAttempts: 5,
        reconnectDelay: 5000 // 5 seconds
    }
};

/**
 * Logging Configuration
 */
const LOGGING_CONFIG = {
    levels: ['error', 'warn', 'info', 'debug'],
    defaultLevel: 'info',
    
    // File logging
    files: {
        error: path.join(__dirname, '..', 'logs', 'error.log'),
        combined: path.join(__dirname, '..', 'logs', 'combined.log'),
        trading: path.join(__dirname, '..', 'logs', 'trading.log')
    },
    
    // Console formatting
    console: {
        timestamp: true,
        colorize: true,
        format: 'simple'
    }
};

/**
 * Data Paths Configuration
 */
const DATA_PATHS = {
    root: path.join(__dirname, '..', 'data'),
    cache: path.join(__dirname, '..', 'data', 'cache'),
    backups: path.join(__dirname, '..', 'data', 'backups'),
    exports: path.join(__dirname, '..', 'data', 'exports')
};

/**
 * Never Trade List Configuration
 * Symbols and patterns to never trade based on Tom King's wisdom
 */
const NEVER_TRADE_LIST = {
    // Individual symbols to never trade
    symbols: [
        'GME', // Meme stock - too volatile/manipulated
        'AMC', // Meme stock - too volatile/manipulated
        'BBBY', // Bankruptcy risk
        'COIN', // Crypto correlation - too volatile
        'RIOT', // Crypto miner - extreme volatility
        'MARA', // Crypto miner - extreme volatility
        'DWAC', // Political/social media stock
        'HOOD', // Controversial/volatile
        'WISH', // Poor fundamentals
        'CLOV', // Meme stock history
        'BB', // Meme stock history
        'NOK', // Meme stock history
        'SPCE', // Speculative space stock
        'NKLA', // Fraud history
        'RIDE', // Production issues
        'WKHS', // Penny stock territory
        'PSTH', // SPAC issues
        'VXX', // Decay product - only for hedging
        'UVXY', // Leveraged volatility - decay
        'SVXY', // Inverse volatility - blow up risk
        'TVIX', // Delisted but avoid similar
        'USO', // Contango issues
        'UCO', // Leveraged oil - decay
        'SCO', // Inverse oil - decay
        'JNUG', // 3x leveraged gold miners
        'JDST', // 3x inverse gold miners
        'NUGT', // 3x leveraged gold miners
        'DUST', // 3x inverse gold miners
        'TQQQ', // 3x leveraged - decay in sideways
        'SQQQ', // 3x inverse - decay
        'SPXU', // 3x inverse S&P - decay
        'SPXS', // 3x inverse S&P - decay
        'TZA', // 3x inverse Russell - decay
        'SRTY', // 3x inverse Russell - decay
        'FAZ', // 3x inverse financials
        'FAS', // 3x leveraged financials
        'ERX', // 3x leveraged energy
        'ERY', // 3x inverse energy
        'LABU', // 3x leveraged biotech
        'LABD', // 3x inverse biotech
        'SOXL', // 3x leveraged semiconductors
        'SOXS' // 3x inverse semiconductors
    ],
    
    // Patterns to avoid
    patterns: [
        {
            pattern: /^3[xX]/i, // Any 3x leveraged ETF
            reason: 'Triple leveraged ETFs decay over time'
        },
        {
            pattern: /^2[xX]/i, // Any 2x leveraged ETF  
            reason: 'Double leveraged ETFs have time decay'
        },
        {
            pattern: /SPAC/i, // SPACs
            reason: 'SPAC structures are too uncertain'
        },
        {
            pattern: /\.OTC$/i, // OTC stocks
            reason: 'OTC stocks lack liquidity and transparency'
        },
        {
            pattern: /^PINK:/i, // Pink sheets
            reason: 'Pink sheet stocks are too risky'
        },
        {
            pattern: /CRYPTO|COIN|BTC|ETH/i, // Crypto-related
            reason: 'Crypto correlation too volatile for options'
        },
        {
            pattern: /CANNABIS|WEED|POT|CBD/i, // Cannabis stocks
            reason: 'Cannabis stocks too speculative and volatile'
        }
    ],
    
    // Market cap and price filters
    filters: {
        minMarketCap: 1000000000, // $1B minimum
        minPrice: 5, // $5 minimum stock price
        minVolume: 1000000, // 1M shares daily volume
        maxBidAskSpread: 0.10, // 10 cent max spread
        minOptionVolume: 1000 // 1000 contracts daily
    },
    
    // Specific conditions to avoid
    conditions: [
        {
            name: 'Earnings Week',
            check: 'EARNINGS_WITHIN_7_DAYS',
            reason: 'Avoid trading during earnings week'
        },
        {
            name: 'Ex-Dividend',
            check: 'EX_DIV_WITHIN_5_DAYS',
            reason: 'Avoid assignment risk near ex-dividend'
        },
        {
            name: 'Binary Event',
            check: 'BINARY_EVENT_PENDING',
            reason: 'FDA approval, court case, etc - too binary'
        },
        {
            name: 'Halted',
            check: 'TRADING_HALTED',
            reason: 'Never trade halted securities'
        },
        {
            name: 'Delisted Warning',
            check: 'DELISTING_WARNING',
            reason: 'Avoid stocks with delisting risk'
        }
    ],
    
    // Tom King specific wisdom rules
    tomKingRules: [
        {
            rule: 'NO_PENNIES',
            description: 'Never trade penny stocks under $5',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_ILLIQUID',
            description: 'Avoid options with <100 open interest',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_WIDE_SPREADS',
            description: 'Skip if bid-ask spread >5% of mid price',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_BROKEN_COMPANIES',
            description: 'Avoid companies with fundamental issues',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_MEMES',
            description: 'Never trade meme stocks or social media pumps',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_LEVERAGED_ETFS',
            description: 'Avoid all leveraged/inverse ETFs for options',
            enforcement: 'STRICT'
        },
        {
            rule: 'NO_LOW_IV',
            description: 'Skip if IV Rank <10% - not worth selling',
            enforcement: 'WARNING'
        },
        {
            rule: 'NO_EXTREME_IV',
            description: 'Careful if IV Rank >90% - likely binary event',
            enforcement: 'WARNING'
        }
    ],
    
    // Enforcement settings
    enforcement: {
        enabled: true,
        mode: 'STRICT', // STRICT, WARNING, or MONITOR
        logViolations: true,
        preventOrders: true,
        alertOnAttempt: true
    },
    
    // Check if symbol should be traded
    isAllowed: function(symbol, marketData = {}) {
        // Direct symbol check
        if (this.symbols.includes(symbol.toUpperCase())) {
            return {
                allowed: false,
                reason: `${symbol} is on the never trade list`,
                type: 'BLACKLISTED_SYMBOL'
            };
        }
        
        // Pattern matching
        for (const rule of this.patterns) {
            if (rule.pattern.test(symbol)) {
                return {
                    allowed: false,
                    reason: rule.reason,
                    type: 'PATTERN_MATCH'
                };
            }
        }
        
        // Market data filters
        if (marketData.marketCap && marketData.marketCap < this.filters.minMarketCap) {
            return {
                allowed: false,
                reason: `Market cap too small: $${(marketData.marketCap/1e9).toFixed(2)}B`,
                type: 'MARKET_CAP_FILTER'
            };
        }
        
        if (marketData.price && marketData.price < this.filters.minPrice) {
            return {
                allowed: false,
                reason: `Price too low: $${marketData.price}`,
                type: 'PRICE_FILTER'
            };
        }
        
        if (marketData.volume && marketData.volume < this.filters.minVolume) {
            return {
                allowed: false,
                reason: `Volume too low: ${marketData.volume.toLocaleString()}`,
                type: 'VOLUME_FILTER'
            };
        }
        
        if (marketData.bidAskSpread && marketData.bidAskSpread > this.filters.maxBidAskSpread) {
            return {
                allowed: false,
                reason: `Spread too wide: $${marketData.bidAskSpread.toFixed(2)}`,
                type: 'SPREAD_FILTER'
            };
        }
        
        // Check conditions
        if (marketData.hasEarnings && marketData.daysToEarnings <= 7) {
            return {
                allowed: false,
                reason: 'Earnings within 7 days',
                type: 'EARNINGS_BLACKOUT',
                severity: 'WARNING'
            };
        }
        
        if (marketData.hasExDividend && marketData.daysToExDiv <= 5) {
            return {
                allowed: false,
                reason: 'Ex-dividend within 5 days',
                type: 'EXDIV_RISK',
                severity: 'WARNING'
            };
        }
        
        // IV checks
        if (marketData.ivRank !== undefined) {
            if (marketData.ivRank < 10) {
                return {
                    allowed: false,
                    reason: `IV Rank too low: ${marketData.ivRank}%`,
                    type: 'LOW_IV',
                    severity: 'WARNING'
                };
            }
            if (marketData.ivRank > 90) {
                return {
                    allowed: 'WARNING',
                    reason: `IV Rank very high: ${marketData.ivRank}% - possible binary event`,
                    type: 'HIGH_IV',
                    severity: 'CAUTION'
                };
            }
        }
        
        return {
            allowed: true,
            reason: 'Symbol passed all checks',
            type: 'APPROVED'
        };
    }
};

/**
 * Application Settings
 */
const APP_SETTINGS = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        wsPort: process.env.WS_PORT || 3001,
        host: process.env.HOST || 'localhost'
    },
    
    // Scheduler
    scheduler: {
        enabled: process.env.SCHEDULER_ENABLED !== 'false',
        analysisInterval: 15 * 60 * 1000, // 15 minutes
        signalInterval: 5 * 60 * 1000, // 5 minutes
        healthCheckInterval: 60 * 1000 // 1 minute
    },
    
    // Cache
    cache: {
        ttl: 5 * 60 * 1000, // 5 minutes
        maxSize: 100, // Max cached items
        compression: true
    }
};

/**
 * Helper Functions
 */
const ConfigHelpers = {
    /**
     * Get phase from account value
     */
    getPhaseFromAccountValue(accountValue) {
        for (const [phase, config] of Object.entries(PHASES)) {
            if (accountValue >= config.range.min && accountValue < config.range.max) {
                return parseInt(phase);
            }
        }
        return 4; // Default to highest phase
    },
    
    /**
     * Get VIX regime from level
     */
    getVIXRegime(vixLevel) {
        for (const [regime, config] of Object.entries(RISK_LIMITS.VIX_REGIMES)) {
            if (vixLevel >= config.range[0] && vixLevel <= config.range[1]) {
                return regime;
            }
        }
        return 'NORMAL';
    },
    
    /**
     * Get correlation group for ticker
     */
    getCorrelationGroup(ticker) {
        for (const [group, config] of Object.entries(CORRELATION_GROUPS)) {
            if (config.tickers.includes(ticker)) {
                return group;
            }
        }
        return null;
    },
    
    /**
     * Check if strategy is allowed for phase
     */
    isStrategyAllowed(strategy, phase) {
        const phaseConfig = PHASES[phase];
        return phaseConfig && phaseConfig.allowedStrategies.includes(strategy);
    },
    
    /**
     * Check if ticker is allowed for phase
     */
    isTickerAllowed(ticker, phase) {
        const phaseConfig = PHASES[phase];
        return phaseConfig && phaseConfig.allowedTickers.includes(ticker);
    },
    
    /**
     * Get buying power requirement
     */
    getBuyingPowerRequirement(strategy, phase) {
        const phaseConfig = PHASES[phase];
        return phaseConfig ? phaseConfig.buyingPowerRequirements[strategy] || 0 : 0;
    },
    
    /**
     * Get environment configuration
     */
    getEnvironmentConfig(env = 'production') {
        return ENVIRONMENT[env] || ENVIRONMENT.production;
    },
    
    /**
     * Get current mode configuration
     */
    getModeConfig() {
        const currentMode = process.env.TOM_KING_MODE || 'paper';
        return this.getEnvironmentConfig(currentMode);
    },
    
    /**
     * Set trading mode with validation
     */
    setTradingMode(mode) {
        const validModes = ['sandbox', 'paper', 'production'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid trading mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }
        
        process.env.TOM_KING_MODE = mode;
        console.log(`🎯 Trading mode set to: ${mode.toUpperCase()}`);
        console.log(`📊 Environment: ${this.getEnvironmentConfig(mode).description}`);
        
        if (mode === 'sandbox') {
            console.log(`💡 Sandbox Features:`);
            console.log(`   • Market orders fill at $1.00`);
            console.log(`   • Limit orders ≤$3 fill immediately`);
            console.log(`   • $100k simulated balance`);
            console.log(`   • Real market data, simulated executions`);
        }
        
        return this.getEnvironmentConfig(mode);
    },
    
    /**
     * Check if sandbox mode safety features are enabled
     */
    isSandboxMode() {
        return (process.env.TOM_KING_MODE || 'paper') === 'sandbox';
    },
    
    /**
     * Check if production mode with real money
     */
    isProductionMode() {
        return (process.env.TOM_KING_MODE || 'paper') === 'production';
    },
    
    /**
     * Validate configuration
     */
    validateConfig() {
        const errors = [];
        
        // Validate phases
        Object.entries(PHASES).forEach(([phase, config]) => {
            if (!config.allowedStrategies || !Array.isArray(config.allowedStrategies)) {
                errors.push(`Phase ${phase}: allowedStrategies must be an array`);
            }
            
            if (!config.allowedTickers || !Array.isArray(config.allowedTickers)) {
                errors.push(`Phase ${phase}: allowedTickers must be an array`);
            }
            
            if (config.maxBPUsage <= 0 || config.maxBPUsage > 1) {
                errors.push(`Phase ${phase}: maxBPUsage must be between 0 and 1`);
            }
        });
        
        // Validate strategies
        Object.entries(STRATEGIES).forEach(([strategy, config]) => {
            if (config.winRate < 0 || config.winRate > 100) {
                errors.push(`Strategy ${strategy}: winRate must be between 0 and 100`);
            }
        });
        
        return errors;
    }
};

/**
 * TOM KING WISDOM RULES
 * Hard-earned trading principles from 30+ years of experience
 * These rules override all other logic when triggered
 */
const WISDOM_RULES = {
    // Core Trading Principles
    NEVER_AVERAGE_DOWN: {
        id: 'NEVER_AVERAGE_DOWN',
        principle: 'Never add to a losing position',
        description: 'If a trade moves against you, do not increase position size',
        enforcement: 'STRICT',
        check: (position, newTrade) => {
            if (position.unrealizedPnL < 0 && newTrade.symbol === position.symbol) {
                return { allowed: false, reason: 'Never average down on losses' };
            }
            return { allowed: true };
        }
    },
    
    FRIDAY_0DTE_RULE: {
        id: 'FRIDAY_0DTE_RULE',
        principle: '0DTE only on Fridays after 10:30 AM EST with VIX > 22',
        description: 'Tom King\'s signature strategy - 88% win rate when rules followed',
        enforcement: 'STRICT',
        check: (trade, marketData) => {
            if (trade.strategy === '0DTE') {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const hour = now.getHours();
                const minute = now.getMinutes();
                const vix = marketData?.VIX?.currentPrice || 20;
                
                if (dayOfWeek !== 5) {
                    return { allowed: false, reason: '0DTE only on Fridays' };
                }
                if (hour < 10 || (hour === 10 && minute < 30)) {
                    return { allowed: false, reason: 'Wait until 10:30 AM for 0DTE' };
                }
                if (vix < 22) {
                    return { allowed: false, reason: 'VIX must be > 22 for 0DTE' };
                }
            }
            return { allowed: true };
        }
    },
    
    CORRELATION_LIMIT: {
        id: 'CORRELATION_LIMIT',
        principle: 'Never exceed phase correlation limits',
        description: 'August 5, 2024 lesson - excessive correlation leads to disaster',
        enforcement: 'STRICT',
        phaseLimit: {
            1: 2, // Phase 1-2: Max 2 per correlation group
            2: 2,
            3: 3, // Phase 3-4: Max 3 per correlation group
            4: 3
        },
        check: (positions, newTrade, phase = 1) => {
            const groups = {
                'EQUITY': ['ES', 'MES', 'SPY', 'QQQ', 'IWM', 'NQ', 'MNQ'],
                'COMMODITIES': ['CL', 'MCL', 'GC', 'MGC', 'GLD', 'SLV'],
                'BONDS': ['ZB', 'ZN', 'TLT', 'TBT'],
                'CURRENCIES': ['6E', '6B', '6J', 'EUR', 'GBP', 'JPY']
            };
            
            // Find which group the new trade belongs to
            let tradeGroup = null;
            for (const [group, symbols] of Object.entries(groups)) {
                if (symbols.includes(newTrade.symbol)) {
                    tradeGroup = group;
                    break;
                }
            }
            
            if (!tradeGroup) return { allowed: true }; // Unknown symbol, allow
            
            // Count existing positions in that group
            const groupCount = positions.filter(p => {
                for (const [group, symbols] of Object.entries(groups)) {
                    if (group === tradeGroup && symbols.includes(p.symbol)) {
                        return true;
                    }
                }
                return false;
            }).length;
            
            const limit = this.phaseLimit[phase];
            if (groupCount >= limit) {
                return { 
                    allowed: false, 
                    reason: `Already have ${groupCount} positions in ${tradeGroup} group (limit: ${limit})` 
                };
            }
            
            return { allowed: true };
        }
    },
    
    DEFENSIVE_21_DTE: {
        id: 'DEFENSIVE_21_DTE',
        principle: 'Manage all positions at 21 DTE',
        description: 'Roll or close positions with 21 days to expiration',
        enforcement: 'WARNING',
        check: (position) => {
            if (position.daysToExpiration <= 21 && position.daysToExpiration > 0) {
                if (position.unrealizedPnL > position.maxProfit * 0.5) {
                    return { action: 'CLOSE', reason: 'Take profit at 50% with 21 DTE' };
                } else if (position.unrealizedPnL < 0) {
                    return { action: 'ROLL', reason: 'Roll challenged position at 21 DTE' };
                }
                return { action: 'EVALUATE', reason: 'Monitor position at 21 DTE' };
            }
            return { action: 'HOLD' };
        }
    },
    
    PROFIT_TARGET_50: {
        id: 'PROFIT_TARGET_50',
        principle: 'Take profits at 50% of max profit',
        description: 'Mechanical profit-taking improves win rate and reduces risk',
        enforcement: 'RECOMMENDED',
        check: (position) => {
            const profitPercent = (position.unrealizedPnL / position.maxProfit) * 100;
            if (profitPercent >= 50) {
                return { action: 'CLOSE', reason: 'Target profit of 50% reached' };
            }
            return { action: 'HOLD' };
        }
    },
    
    VIX_SPIKE_DEFENSE: {
        id: 'VIX_SPIKE_DEFENSE',
        principle: 'Reduce exposure during VIX spikes',
        description: 'When VIX spikes 50% or above 30, reduce all positions',
        enforcement: 'AUTOMATIC',
        check: (currentVIX, previousVIX) => {
            const spikePercent = ((currentVIX - previousVIX) / previousVIX) * 100;
            
            if (currentVIX > 30) {
                return { action: 'REDUCE_ALL', reason: 'VIX above 30 - extreme volatility' };
            }
            if (spikePercent > 50) {
                return { action: 'REDUCE_HALF', reason: 'VIX spike > 50% detected' };
            }
            return { action: 'MONITOR' };
        }
    },
    
    BUYING_POWER_DISCIPLINE: {
        id: 'BUYING_POWER_DISCIPLINE',
        principle: 'Never exceed VIX-adjusted BP limits',
        description: 'Dynamic BP usage: 45% (VIX<13), 65% (13-18), 75% (18-25), 80% (25+)',
        enforcement: 'STRICT',
        limits: {
            veryLow: { max: 13, bp: 0.45 },
            low: { max: 18, bp: 0.65 },
            normal: { max: 25, bp: 0.75 },
            high: { max: 100, bp: 0.80 }
        },
        check: (currentBPUsage, vixLevel) => {
            let maxBP = 0.80;
            
            if (vixLevel < 13) maxBP = 0.45;
            else if (vixLevel < 18) maxBP = 0.65;
            else if (vixLevel < 25) maxBP = 0.75;
            else maxBP = 0.80;
            
            if (currentBPUsage > maxBP) {
                return { 
                    allowed: false, 
                    reason: `BP usage ${(currentBPUsage * 100).toFixed(1)}% exceeds limit ${(maxBP * 100).toFixed(0)}% for VIX ${vixLevel}` 
                };
            }
            return { allowed: true, maxBP, currentUsage: currentBPUsage };
        }
    },
    
    NEVER_TRADE_EARNINGS: {
        id: 'NEVER_TRADE_EARNINGS',
        principle: 'Avoid trading during earnings week',
        description: 'Binary events destroy premium selling strategies',
        enforcement: 'WARNING',
        check: (symbol, earningsCalendar) => {
            const earnings = earningsCalendar?.[symbol];
            if (earnings) {
                const daysToEarnings = Math.floor((new Date(earnings.date) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysToEarnings <= 7 && daysToEarnings >= -1) {
                    return { 
                        allowed: false, 
                        reason: `Earnings in ${daysToEarnings} days - avoid binary risk` 
                    };
                }
            }
            return { allowed: true };
        }
    },
    
    MOMENTUM_15_MINUTE: {
        id: 'MOMENTUM_15_MINUTE',
        principle: 'Tom King\'s 15-minute momentum rule',
        description: '3% move in 15 minutes signals potential volatility explosion',
        enforcement: 'ALERT',
        check: (priceData) => {
            const fifteenMinChange = ((priceData.current - priceData.fifteenMinAgo) / priceData.fifteenMinAgo) * 100;
            
            if (Math.abs(fifteenMinChange) >= 3) {
                return {
                    alert: true,
                    action: 'AVOID_NEW_ENTRIES',
                    reason: `${fifteenMinChange.toFixed(2)}% move in 15 minutes - volatility spike`
                };
            }
            return { alert: false };
        }
    },
    
    STRATEGY_HIERARCHY: {
        id: 'STRATEGY_HIERARCHY',
        principle: 'Follow Tom King\'s strategy preference order',
        description: '1) LT-112, 2) Strangles, 3) 0DTE Friday - in that order',
        enforcement: 'GUIDANCE',
        priority: {
            'LT112': 1,
            'STRANGLE': 2,
            '0DTE': 3,
            'BUTTERFLY': 4,
            'IRON_CONDOR': 5,
            'OTHER': 6
        },
        check: (availableOpportunities) => {
            return availableOpportunities.sort((a, b) => {
                const priorityA = this.priority[a.strategy] || 99;
                const priorityB = this.priority[b.strategy] || 99;
                return priorityA - priorityB;
            });
        }
    },
    
    MAX_RISK_PER_TRADE: {
        id: 'MAX_RISK_PER_TRADE',
        principle: 'Never risk more than 5% on a single trade',
        description: 'Preservation of capital is paramount',
        enforcement: 'STRICT',
        check: (tradeRisk, accountValue) => {
            const riskPercent = (tradeRisk / accountValue) * 100;
            if (riskPercent > 5) {
                return {
                    allowed: false,
                    reason: `Trade risk ${riskPercent.toFixed(1)}% exceeds 5% limit`
                };
            }
            return { allowed: true, riskPercent };
        }
    },
    
    COMPOUND_ONLY_PHASES: {
        id: 'COMPOUND_ONLY_PHASES',
        principle: 'No withdrawals in Phases 1-2',
        description: 'Focus on compounding until account reaches £60k',
        enforcement: 'STRICT',
        check: (withdrawalAmount, accountBalance, phase) => {
            if (phase <= 2 && withdrawalAmount > 0) {
                return {
                    allowed: false,
                    reason: `No withdrawals allowed in Phase ${phase} - compound only`
                };
            }
            
            // In phases 3-4, limit withdrawals to preserve growth
            if (phase >= 3) {
                const monthlyProfit = accountBalance * 0.12; // Assuming 12% monthly target
                const maxWithdrawal = monthlyProfit * 0.5; // Max 50% of monthly profit
                
                if (withdrawalAmount > maxWithdrawal) {
                    return {
                        allowed: false,
                        reason: `Withdrawal £${withdrawalAmount} exceeds 50% of monthly profit £${maxWithdrawal.toFixed(0)}`
                    };
                }
            }
            
            return { allowed: true };
        }
    },
    
    NEVER_CHASE_LOSSES: {
        id: 'NEVER_CHASE_LOSSES',
        principle: 'Never revenge trade after a loss',
        description: 'Take a break after losses, don\'t double down',
        enforcement: 'WARNING',
        check: (recentTrades, newTrade) => {
            if (!recentTrades || recentTrades.length === 0) return { allowed: true };
            
            const lastTrade = recentTrades[recentTrades.length - 1];
            const timeSinceLast = Date.now() - new Date(lastTrade.closedAt).getTime();
            
            // If last trade was a loss and new trade is within 30 minutes
            if (lastTrade.pnl < 0 && timeSinceLast < 1800000) {
                // Check if new trade is larger than normal
                if (newTrade.size > lastTrade.size * 1.5) {
                    return {
                        allowed: false,
                        reason: 'Potential revenge trade detected - take a break'
                    };
                }
            }
            
            return { allowed: true };
        }
    },
    
    QUALITY_OVER_QUANTITY: {
        id: 'QUALITY_OVER_QUANTITY',
        principle: 'Fewer high-quality trades beat many mediocre trades',
        description: 'Maximum 5 new positions per day',
        enforcement: 'RECOMMENDED',
        check: (todaysTrades) => {
            if (todaysTrades.length >= 5) {
                return {
                    allowed: false,
                    reason: 'Daily trade limit (5) reached - quality over quantity'
                };
            }
            return { allowed: true, tradesRemaining: 5 - todaysTrades.length };
        }
    },
    
    ALWAYS_HAVE_PLAN: {
        id: 'ALWAYS_HAVE_PLAN',
        principle: 'Every trade needs entry, target, and stop',
        description: 'No trade without a complete plan',
        enforcement: 'STRICT',
        check: (trade) => {
            if (!trade.entryPrice || !trade.targetPrice || !trade.stopLoss) {
                const missing = [];
                if (!trade.entryPrice) missing.push('entry price');
                if (!trade.targetPrice) missing.push('target price');
                if (!trade.stopLoss) missing.push('stop loss');
                
                return {
                    allowed: false,
                    reason: `Trade plan incomplete - missing: ${missing.join(', ')}`
                };
            }
            return { allowed: true };
        }
    },
    
    // Wisdom rule application helper
    applyWisdomRules: function(trade, context = {}) {
        const results = [];
        const violations = [];
        
        // Check each applicable rule
        Object.values(WISDOM_RULES).forEach(rule => {
            if (typeof rule === 'function') return; // Skip helper functions
            if (!rule.check) return; // Skip rules without check function
            
            try {
                const result = rule.check(trade, context);
                if (result.allowed === false) {
                    violations.push({
                        rule: rule.id,
                        reason: result.reason,
                        enforcement: rule.enforcement
                    });
                }
                results.push({ rule: rule.id, ...result });
            } catch (error) {
                // Rule check failed, skip
            }
        });
        
        // Determine if trade should proceed
        const strictViolations = violations.filter(v => v.enforcement === 'STRICT');
        const warnings = violations.filter(v => v.enforcement === 'WARNING' || v.enforcement === 'RECOMMENDED');
        
        return {
            allowed: strictViolations.length === 0,
            violations: strictViolations,
            warnings,
            results
        };
    },
    
    // Get all wisdom rules for display
    getAllRules: function() {
        return Object.values(WISDOM_RULES)
            .filter(rule => typeof rule !== 'function')
            .map(rule => ({
                id: rule.id,
                principle: rule.principle,
                description: rule.description,
                enforcement: rule.enforcement
            }));
    }
};

/**
 * VIX Regime Configuration
 * Different volatility regimes and their adjustments
 */
const VIX_LEVELS = {
    VERY_LOW: {
        min: 0,
        max: 12,
        description: 'Very low volatility',
        bpAdjustment: 1.0,
        strategyAdjustments: {
            preferCredits: false,
            tighterSpreads: true,
            reducedSize: false
        }
    },
    LOW: {
        min: 12,
        max: 16,
        description: 'Low volatility',
        bpAdjustment: 1.0,
        strategyAdjustments: {
            preferCredits: true,
            tighterSpreads: false,
            reducedSize: false
        }
    },
    NORMAL: {
        min: 16,
        max: 20,
        description: 'Normal volatility',
        bpAdjustment: 1.0,
        strategyAdjustments: {
            preferCredits: true,
            tighterSpreads: false,
            reducedSize: false
        }
    },
    ELEVATED: {
        min: 20,
        max: 30,
        description: 'Elevated volatility',
        bpAdjustment: 0.75,
        strategyAdjustments: {
            preferCredits: true,
            tighterSpreads: false,
            reducedSize: true
        }
    },
    EXTREME: {
        min: 30,
        max: 100,
        description: 'Extreme volatility',
        bpAdjustment: 0.5,
        strategyAdjustments: {
            preferCredits: true,
            tighterSpreads: false,
            reducedSize: true,
            considerCash: true
        }
    }
};

module.exports = {
    // Main configuration objects
    ENVIRONMENT,
    PHASES,
    STRATEGIES,
    CORRELATION_GROUPS,
    RISK_LIMITS,
    TECHNICAL_CONFIG,
    API_CONFIG,
    LOGGING_CONFIG,
    DATA_PATHS,
    APP_SETTINGS,
    VIX_LEVELS,
    NEVER_TRADE_LIST,
    WISDOM_RULES,
    
    // Helper functions
    ConfigHelpers,
    
    // Convenience exports
    getPhaseConfig: (phase) => PHASES[phase],
    getStrategyConfig: (strategy) => STRATEGIES[strategy],
    getCorrelationConfig: (group) => CORRELATION_GROUPS[group],
    
    // Environment helpers
    isDevelopment: () => process.env.NODE_ENV === 'development',
    isProduction: () => process.env.NODE_ENV === 'production',
    
    // Default export
    default: {
        PHASES,
        STRATEGIES,
        CORRELATION_GROUPS,
        RISK_LIMITS
    }
};