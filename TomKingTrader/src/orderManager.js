/**
 * Tom King Order Management System
 * Complete TastyTrade API integration for live trading
 * Based on official API documentation and Tom King strategies
 * Consolidated order preparation and execution system
 */

const fs = require('fs');
const path = require('path');
const { BPLimitsManager } = require('./riskManager');
const { generateOrderId } = require('../utils/idGenerator');
const { getLogger } = require('./logger');

const logger = getLogger();

const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Order Manager for TastyTrade API Integration
 * Handles all order types including Tom King specific strategies
 */
class OrderManager {
  constructor(api) {
    this.api = api;
    this.accountNumber = null;
    this.activeOrders = new Map();
    this.orderHistory = [];
    this.allOrders = []; // For submitOrder compatibility
    this.orderLog = []; // For order preparation logging
    this.logFile = path.join(__dirname, '../logs/prepared_orders.json');
    this.executionEnabled = process.env.ORDER_EXECUTION === 'enabled';
    
    this.riskLimits = {
      maxPositionSize: 0.05, // 5% of account per trade (Tom King rule)
      maxBPUsage: 'DYNAMIC', // VIX-based: 45-80% per Tom King
      getMaxBPUsage: (vixLevel) => {
        const { RISK_LIMITS } = require('./config');
        return RISK_LIMITS.getMaxBPUsage(vixLevel);
      },
      maxCorrelatedPositions: 3, // Max 3 positions per correlation group
      dailyOrderLimit: 50    // Safety limit
    };
    
    // Phase-based safety limits from Tom King rules
    this.safetyLimits = {
      maxBPUsage: {
        1: 50,  // Phase 1
        2: 65,  // Phase 2
        3: 75,  // Phase 3
        4: 80   // Phase 4
      },
      maxPositionsPerStrategy: {
        '0DTE': { 1: 1, 2: 2, 3: 3, 4: 4 },
        'LT112': { 1: 0, 2: 4, 3: 1, 4: 3 },
        'STRANGLE': { 1: 1, 2: 3, 3: 4, 4: 5 },
        'IPMCC': { 1: 1, 2: 2, 3: 3, 4: 4 }
      },
      correlationGroupLimits: 3,
      maxRiskPerTrade: 0.05 // 5% max risk
    };
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    logger.info('ORDER', 'OrderManager initialized');
  }

  /**
   * Initialize with account number
   */
  initialize(accountNumber) {
    this.accountNumber = accountNumber;
    logger.info('ORDER', `OrderManager linked to account: ${accountNumber}`);
  }

  /**
   * Format strike price for TastyTrade API
   * Convert 460.00 → "00460000"
   */
  formatStrike(strike) {
    return String(Math.round(strike * 1000)).padStart(8, '0');
  }

  /**
   * Format expiration date for option symbols
   * Convert string/Date object → "YYMMDD" 
   */
  formatExpiration(date) {
    // Handle both string and Date inputs
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear().toString().slice(-2);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return year + month + day;
  }

  /**
   * Create OCC option symbol
   * underlying: "SPY", expiration: Date, strike: 460, type: "C"|"P"
   */
  createOptionSymbol(underlying, expiration, strike, type) {
    const exp = this.formatExpiration(expiration);
    const strikeStr = this.formatStrike(strike);
    return `${underlying.padEnd(6)}${exp}${type}${strikeStr}`;
  }

  /**
   * Validate order before submission
   */
  validateOrder(order) {
    const validations = [];

    // Check required fields
    if (!order['time-in-force']) {
      validations.push('Missing time-in-force');
    }
    if (!order['order-type']) {
      validations.push('Missing order-type');
    }
    if (!order.legs || order.legs.length === 0) {
      validations.push('Missing order legs');
    }

    // Validate price requirements
    if (['Limit', 'Stop Limit'].includes(order['order-type']) && !order.price) {
      validations.push('Price required for limit orders');
    }
    if (order.price && !order['price-effect']) {
      validations.push('Price-effect required when price is specified');
    }

    // Validate legs
    order.legs?.forEach((leg, index) => {
      if (!leg['instrument-type']) {
        validations.push(`Leg ${index + 1}: Missing instrument-type`);
      }
      if (!leg.symbol) {
        validations.push(`Leg ${index + 1}: Missing symbol`);
      }
      if (!leg.action) {
        validations.push(`Leg ${index + 1}: Missing action`);
      }
      if (!leg.quantity || leg.quantity <= 0) {
        validations.push(`Leg ${index + 1}: Invalid quantity`);
      }
    });

    // Tom King specific validations
    if (order.source === 'TOM_KING_0DTE') {
      if (order['time-in-force'] !== 'Day') {
        validations.push('0DTE orders must use Day time-in-force');
      }
      
      // Check if current time is after 10:30 AM ET
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hour = et.getHours();
      const minute = et.getMinutes();
      
      if (hour < 10 || (hour === 10 && minute < 30)) {
        validations.push('0DTE orders not allowed before 10:30 AM ET');
      }
    }

    // Return validation result object for consistency with tests
    return {
      isValid: validations.length === 0,
      errors: validations,
      errorCount: validations.length
    };
  }
  
  /**
   * Comprehensive execution checks before order placement
   */
  async performExecutionChecks(order, accountData = null) {
    const checks = {
      passed: [],
      failed: [],
      warnings: [],
      canExecute: true,
      requiresOverride: false
    };
    
    try {
      // 1. Basic order validation
      const validationResult = this.validateOrder(order);
      if (!validationResult.isValid) {
        checks.failed.push({
          type: 'VALIDATION',
          errors: validationResult.errors,
          severity: 'CRITICAL'
        });
        checks.canExecute = false;
      } else {
        checks.passed.push('Basic validation');
      }
      
      // 2. Account status check
      if (accountData) {
        const accountCheck = await this.checkAccountStatus(accountData);
        if (accountCheck.healthy) {
          checks.passed.push('Account status');
        } else {
          checks.failed.push({
            type: 'ACCOUNT_STATUS',
            issues: accountCheck.issues,
            severity: accountCheck.critical ? 'CRITICAL' : 'HIGH'
          });
          if (accountCheck.critical) {
            checks.canExecute = false;
          }
        }
      }
      
      // 3. Risk management checks
      const riskCheck = await this.checkRiskLimits(order, accountData);
      if (riskCheck.passed) {
        checks.passed.push('Risk limits');
      } else {
        checks.failed.push({
          type: 'RISK_LIMIT',
          violations: riskCheck.violations,
          severity: riskCheck.severity
        });
        if (riskCheck.severity === 'CRITICAL') {
          checks.canExecute = false;
        } else if (riskCheck.severity === 'HIGH') {
          checks.requiresOverride = true;
        }
      }
      
      // 4. Correlation check
      const correlationCheck = await this.checkCorrelation(order, accountData);
      if (correlationCheck.withinLimits) {
        checks.passed.push('Correlation limits');
      } else {
        checks.warnings.push({
          type: 'CORRELATION',
          message: correlationCheck.message,
          currentPositions: correlationCheck.positions
        });
      }
      
      // 5. Market conditions check
      const marketCheck = await this.checkMarketConditions(order);
      if (marketCheck.suitable) {
        checks.passed.push('Market conditions');
      } else {
        checks.warnings.push({
          type: 'MARKET_CONDITIONS',
          issues: marketCheck.issues
        });
      }
      
      // 6. Strategy-specific checks
      const strategyCheck = await this.checkStrategyRequirements(order);
      if (strategyCheck.met) {
        checks.passed.push('Strategy requirements');
      } else {
        checks.failed.push({
          type: 'STRATEGY_REQUIREMENTS',
          unmet: strategyCheck.unmet,
          severity: 'HIGH'
        });
        checks.requiresOverride = true;
      }
      
      // 7. Execution timing check
      const timingCheck = this.checkExecutionTiming(order);
      if (timingCheck.appropriate) {
        checks.passed.push('Execution timing');
      } else {
        checks.warnings.push({
          type: 'TIMING',
          message: timingCheck.message
        });
      }
      
      // 8. Never trade list check
      const blacklistCheck = await this.checkNeverTradeList(order);
      if (blacklistCheck.allowed) {
        checks.passed.push('Never trade list');
      } else {
        checks.failed.push({
          type: 'BLACKLISTED',
          symbol: blacklistCheck.symbol,
          reason: blacklistCheck.reason,
          severity: 'CRITICAL'
        });
        checks.canExecute = false;
      }
      
      // 9. Price sanity check
      const priceCheck = await this.checkPriceSanity(order);
      if (priceCheck.reasonable) {
        checks.passed.push('Price sanity');
      } else {
        checks.warnings.push({
          type: 'PRICE_SANITY',
          issues: priceCheck.issues,
          marketPrice: priceCheck.marketPrice,
          orderPrice: priceCheck.orderPrice
        });
      }
      
      // 10. Duplicate order check
      const duplicateCheck = await this.checkForDuplicates(order);
      if (!duplicateCheck.isDuplicate) {
        checks.passed.push('No duplicates');
      } else {
        checks.warnings.push({
          type: 'POTENTIAL_DUPLICATE',
          existingOrder: duplicateCheck.existingOrder
        });
      }
      
    } catch (error) {
      logger.error('ORDER', 'Execution check error', error);
      checks.failed.push({
        type: 'SYSTEM_ERROR',
        error: error.message,
        severity: 'CRITICAL'
      });
      checks.canExecute = false;
    }
    
    // Generate summary
    checks.summary = {
      totalChecks: 10,
      passed: checks.passed.length,
      failed: checks.failed.length,
      warnings: checks.warnings.length,
      recommendation: this.getExecutionRecommendation(checks)
    };
    
    return checks;
  }
  
  /**
   * Check account status
   */
  async checkAccountStatus(accountData) {
    const issues = [];
    let critical = false;
    
    // Check if account is restricted
    if (accountData.restricted) {
      issues.push('Account is restricted');
      critical = true;
    }
    
    // Check margin call
    if (accountData.marginCall) {
      issues.push('Account in margin call');
      critical = true;
    }
    
    // Check day trading status
    if (accountData.patternDayTrader && accountData.dayTradesRemaining <= 0) {
      issues.push('No day trades remaining');
    }
    
    // Check buying power
    const bpUsage = accountData.buyingPowerUsed / accountData.buyingPower;
    if (bpUsage > 0.9) {
      issues.push(`Buying power near limit: ${(bpUsage * 100).toFixed(1)}%`);
      if (bpUsage > 0.95) critical = true;
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      critical
    };
  }
  
  /**
   * Check risk limits
   */
  async checkRiskLimits(order, accountData) {
    const violations = [];
    let severity = 'LOW';
    
    if (!accountData) {
      return { passed: true, violations: [], severity: 'LOW' };
    }
    
    // Calculate order value
    const orderValue = this.calculateOrderValue(order);
    const accountValue = accountData.netLiq || accountData.accountValue;
    
    // Check position size limit
    const positionSizePercent = orderValue / accountValue;
    if (positionSizePercent > this.riskLimits.maxPositionSize) {
      violations.push(`Position size ${(positionSizePercent * 100).toFixed(1)}% exceeds ${(this.riskLimits.maxPositionSize * 100)}% limit`);
      severity = 'HIGH';
    }
    
    // Check VIX-based BP limits
    const vixLevel = accountData.vixLevel || 20;
    const maxBP = this.riskLimits.getMaxBPUsage(vixLevel);
    const currentBPUsage = accountData.buyingPowerUsed / accountValue;
    const projectedBPUsage = (accountData.buyingPowerUsed + orderValue) / accountValue;
    
    if (projectedBPUsage > maxBP) {
      violations.push(`Projected BP usage ${(projectedBPUsage * 100).toFixed(1)}% exceeds VIX-based limit ${(maxBP * 100)}%`);
      severity = projectedBPUsage > maxBP * 1.2 ? 'CRITICAL' : 'HIGH';
    }
    
    // Check daily order limit
    const todayOrders = this.orderHistory.filter(o => {
      const orderDate = new Date(o.timestamp).toDateString();
      return orderDate === new Date().toDateString();
    });
    
    if (todayOrders.length >= this.riskLimits.dailyOrderLimit) {
      violations.push(`Daily order limit reached: ${todayOrders.length}/${this.riskLimits.dailyOrderLimit}`);
      severity = 'HIGH';
    }
    
    return {
      passed: violations.length === 0,
      violations,
      severity
    };
  }
  
  /**
   * Check correlation limits
   */
  async checkCorrelation(order, accountData) {
    if (!accountData || !accountData.positions) {
      return { withinLimits: true };
    }
    
    // Extract underlying from order
    const underlying = this.extractUnderlying(order);
    const correlationGroup = this.getCorrelationGroup(underlying);
    
    if (!correlationGroup) {
      return { withinLimits: true };
    }
    
    // Count positions in same correlation group
    const groupPositions = accountData.positions.filter(pos => {
      const posGroup = this.getCorrelationGroup(pos.underlying || pos.symbol);
      return posGroup === correlationGroup;
    });
    
    if (groupPositions.length >= this.riskLimits.maxCorrelatedPositions) {
      return {
        withinLimits: false,
        message: `Already have ${groupPositions.length} positions in ${correlationGroup} group`,
        positions: groupPositions.map(p => p.symbol)
      };
    }
    
    return { withinLimits: true };
  }
  
  /**
   * Check market conditions
   */
  async checkMarketConditions(order) {
    const issues = [];
    
    // Check if market is open
    if (!this.isMarketOpen()) {
      issues.push('Market is closed');
    }
    
    // Check for circuit breakers
    // This would need real market data in production
    
    // Check for high volatility
    // This would need VIX data in production
    
    return {
      suitable: issues.length === 0,
      issues
    };
  }
  
  /**
   * Check strategy-specific requirements
   */
  async checkStrategyRequirements(order) {
    const unmet = [];
    
    if (!order.source) {
      return { met: true };
    }
    
    // 0DTE specific checks
    if (order.source === 'TOM_KING_0DTE') {
      const day = new Date().getDay();
      if (day !== 5) {
        unmet.push('0DTE trades only allowed on Fridays');
      }
      
      // Check VIX requirement
      // Would need real VIX data in production
    }
    
    // LT112 specific checks
    if (order.source === 'TOM_KING_LT112') {
      const day = new Date().getDay();
      if (![1, 2, 3].includes(day)) {
        unmet.push('LT112 trades only on Mon-Wed');
      }
    }
    
    return {
      met: unmet.length === 0,
      unmet
    };
  }
  
  /**
   * Check execution timing
   */
  checkExecutionTiming(order) {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    // Market hours check (9:30 AM - 4:00 PM ET)
    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;
    
    if (totalMinutes < marketOpen || totalMinutes > marketClose) {
      return {
        appropriate: false,
        message: 'Outside regular market hours'
      };
    }
    
    // Close to close warning
    if (totalMinutes > marketClose - 30) {
      return {
        appropriate: true,
        message: 'Close to market close - consider waiting for next session'
      };
    }
    
    return { appropriate: true };
  }
  
  /**
   * Check never trade list
   */
  async checkNeverTradeList(order) {
    const config = require('./config');
    const underlying = this.extractUnderlying(order);
    
    const checkResult = config.NEVER_TRADE_LIST.isAllowed(underlying);
    
    return {
      allowed: checkResult.allowed === true,
      symbol: underlying,
      reason: checkResult.reason
    };
  }
  
  /**
   * Check price sanity
   */
  async checkPriceSanity(order) {
    if (order['order-type'] === 'Market') {
      return { reasonable: true };
    }
    
    const issues = [];
    const orderPrice = parseFloat(order.price);
    
    // Check for obviously wrong prices
    if (orderPrice <= 0) {
      issues.push('Price is zero or negative');
    }
    
    // Check for suspiciously high prices
    if (order['price-effect'] === 'Debit' && orderPrice > 10000) {
      issues.push('Unusually high debit');
    }
    
    // Would need market data for more sophisticated checks
    
    return {
      reasonable: issues.length === 0,
      issues,
      orderPrice
    };
  }
  
  /**
   * Check for duplicate orders
   */
  async checkForDuplicates(order) {
    // Check recent orders for similar characteristics
    const recentOrders = this.orderHistory.slice(-10);
    
    for (const recent of recentOrders) {
      // Check if same symbol and similar price
      if (this.isSimilarOrder(order, recent)) {
        const timeDiff = Date.now() - new Date(recent.timestamp).getTime();
        if (timeDiff < 60000) { // Within 1 minute
          return {
            isDuplicate: true,
            existingOrder: recent
          };
        }
      }
    }
    
    return { isDuplicate: false };
  }
  
  /**
   * Get execution recommendation based on checks
   */
  getExecutionRecommendation(checks) {
    if (!checks.canExecute) {
      return 'DO_NOT_EXECUTE';
    }
    
    if (checks.requiresOverride && checks.warnings.length > 2) {
      return 'REQUIRES_MANUAL_REVIEW';
    }
    
    if (checks.requiresOverride) {
      return 'EXECUTE_WITH_CAUTION';
    }
    
    if (checks.warnings.length > 0) {
      return 'EXECUTE_WITH_WARNINGS';
    }
    
    return 'SAFE_TO_EXECUTE';
  }
  
  /**
   * Helper: Extract underlying symbol from order
   */
  extractUnderlying(order) {
    if (!order.legs || order.legs.length === 0) return null;
    
    const firstLeg = order.legs[0];
    if (firstLeg['instrument-type'] === 'Equity Option') {
      // Extract from OCC symbol (first 6 characters)
      return firstLeg.symbol.substring(0, 6).trim();
    }
    
    return firstLeg.symbol;
  }
  
  /**
   * Helper: Get correlation group for symbol
   */
  getCorrelationGroup(symbol) {
    const groups = {
      EQUITY: ['SPY', 'QQQ', 'IWM', 'ES', 'MES'],
      ENERGY: ['CL', 'MCL', 'XLE', 'XOP'],
      METALS: ['GC', 'MGC', 'GLD', 'SLV'],
      BONDS: ['TLT', 'IEF', 'ZB', 'ZN']
    };
    
    for (const [group, symbols] of Object.entries(groups)) {
      if (symbols.includes(symbol)) {
        return group;
      }
    }
    
    return null;
  }
  
  /**
   * Helper: Calculate order value
   */
  calculateOrderValue(order) {
    // Simplified calculation - would need option pricing in production
    const quantity = order.legs.reduce((sum, leg) => sum + leg.quantity, 0);
    const price = parseFloat(order.price) || 0;
    
    return quantity * price * 100; // Assuming options with 100 multiplier
  }
  
  /**
   * Helper: Check if orders are similar
   */
  isSimilarOrder(order1, order2) {
    if (!order2.legs) return false;
    
    // Check if same underlying and strategy
    const underlying1 = this.extractUnderlying(order1);
    const underlying2 = this.extractUnderlying(order2);
    
    return underlying1 === underlying2 && 
           order1.source === order2.source;
  }
  
  /**
   * Helper: Check if market is open
   */
  isMarketOpen() {
    const now = new Date();
    const day = now.getDay();
    
    // Markets closed on weekends
    if (day === 0 || day === 6) return false;
    
    // Check time (simplified - would need holiday calendar)
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;
    
    const marketOpen = 9 * 60 + 30;  // 9:30 AM
    const marketClose = 16 * 60;      // 4:00 PM
    
    return totalMinutes >= marketOpen && totalMinutes <= marketClose;
  }

  /**
   * Place dry-run order for testing
   */
  async dryRun(order) {
    try {
      if (DEBUG) {
        logger.debug('ORDER', 'Running dry-run validation', { order });
      }

      // Validate order structure
      const validationResult = this.validateOrder(order);
      if (!validationResult.isValid) {
        throw new Error(`Order validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Call TastyTrade dry-run API
      const endpoint = order.legs?.length > 1 
        ? `/accounts/${this.accountNumber}/complex-orders/dry-run`
        : `/accounts/${this.accountNumber}/orders/dry-run`;

      const response = await this.api.request(endpoint, 'POST', order);

      if (DEBUG) {
        logger.debug('ORDER', 'Dry-run successful');
        if (response.warnings?.length > 0) {
          logger.warn('ORDER', 'Dry-run warnings', response.warnings);
        }
      }

      return {
        success: true,
        response,
        warnings: response.warnings || [],
        estimatedFees: response.fees || [],
        buyingPowerRequirement: response['buying-power-requirement'] || 0
      };

    } catch (error) {
      logger.error('ORDER', 'Dry-run failed', error);
      
      // Fall back to local validation when API is unavailable
      logger.info('ORDER', 'Falling back to local validation');
      return this.localDryRun(order);
    }
  }

  /**
   * Local dry-run validation when API is unavailable
   * Comprehensive validation of order structure and Tom King rules
   */
  localDryRun(order) {
    const warnings = [];
    const errors = [];

    logger.debug('ORDER', 'Running local dry-run validation');

    // 1. Basic Order Structure Validation
    if (!order.legs || order.legs.length === 0) {
      errors.push('Order must have at least one leg');
    }

    if (!order.price || isNaN(parseFloat(order.price))) {
      errors.push('Order must have valid price');
    }

    // 2. Symbol Validation
    order.legs?.forEach((leg, index) => {
      if (!leg.symbol || leg.symbol.includes('NaN')) {
        errors.push(`Leg ${index + 1}: Invalid option symbol - ${leg.symbol}`);
      }
      if (!leg.action || !['Sell to Open', 'Buy to Open', 'Sell to Close', 'Buy to Close'].includes(leg.action)) {
        errors.push(`Leg ${index + 1}: Invalid action - ${leg.action}`);
      }
      if (!leg.quantity || leg.quantity <= 0) {
        errors.push(`Leg ${index + 1}: Invalid quantity - ${leg.quantity}`);
      }
    });

    // 3. Tom King Strategy Validation
    const source = order.source;
    if (source === 'TOM_KING_0DTE') {
      const today = new Date();
      const isFriday = today.getDay() === 5;
      const currentHour = today.getHours();
      const currentMinute = today.getMinutes();
      const timeAfter1030 = currentHour > 10 || (currentHour === 10 && currentMinute >= 30);

      if (!isFriday) {
        warnings.push('0DTE strategy should only be used on Fridays');
      }
      if (!timeAfter1030) {
        warnings.push('0DTE strategy should only be used after 10:30 AM');
      }
    }

    // 4. Risk Management Validation
    const totalQuantity = order.legs?.reduce((sum, leg) => sum + Math.abs(leg.quantity), 0) || 0;
    if (totalQuantity > 10) {
      warnings.push(`Large position size: ${totalQuantity} contracts`);
    }

    const netPrice = parseFloat(order.price || 0);
    if (order['price-effect'] === 'Credit' && netPrice <= 0) {
      warnings.push('Credit spread should have positive premium');
    }

    // 5. Success/Failure Decision
    if (errors.length > 0) {
      return {
        success: false,
        error: `Local validation failed: ${errors.join('; ')}`,
        warnings
      };
    }

    logger.debug('ORDER', 'Local validation passed');
    if (warnings.length > 0) {
      logger.warn('ORDER', 'Local validation warnings', warnings);
    }

    return {
      success: true,
      response: {
        'dry-run-result': {
          message: 'Local validation passed',
          warnings: warnings.length > 0 ? warnings : ['No issues found']
        }
      },
      warnings,
      estimatedFees: [{ amount: 1.00, description: 'Estimated commission per contract' }],
      buyingPowerRequirement: netPrice * totalQuantity * 100 // Rough estimate
    };
  }

  /**
   * Place live order
   */
  async placeOrder(order, maxRetries = 3) {
    try {
      if (!this.accountNumber) {
        throw new Error('Account number not set. Call initialize() first.');
      }

      if (DEBUG) {
        logger.info('ORDER', 'Placing live order', { account: this.accountNumber });
      }

      // ALWAYS run dry-run first for live orders
      const dryRunResult = await this.dryRun(order);
      if (!dryRunResult.success) {
        throw new Error(`Dry-run failed: ${dryRunResult.error}`);
      }

      // Check buying power requirement
      if (dryRunResult.buyingPowerRequirement) {
        const accountData = await this.api.getAccountStatus();
        const availableBP = accountData.derivativeBuyingPower || 0;
        
        if (dryRunResult.buyingPowerRequirement > availableBP * this.riskLimits.maxBPUsage) {
          throw new Error(`Order exceeds buying power limits. Required: ${dryRunResult.buyingPowerRequirement}, Available: ${availableBP * this.riskLimits.maxBPUsage}`);
        }
      }

      // Add Tom King specific metadata
      const enrichedOrder = {
        ...order,
        source: order.source || 'TOM_KING_FRAMEWORK',
        'external-identifier': `TKF_${Date.now()}`,
        'advanced-instructions': {
          'strict-position-effect-validation': true
        }
      };

      // Determine endpoint (simple vs complex orders)
      const endpoint = enrichedOrder.legs?.length > 1
        ? `/accounts/${this.accountNumber}/complex-orders`
        : `/accounts/${this.accountNumber}/orders`;

      let lastError = null;

      // Retry logic with exponential backoff
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (DEBUG && attempt > 1) {
            logger.debug('ORDER', `Order attempt ${attempt}/${maxRetries}`);
          }

          const response = await this.api.request(endpoint, 'POST', enrichedOrder);

          // Store order in active orders
          const orderId = response.id;
          this.activeOrders.set(orderId, {
            ...response,
            placedAt: new Date(),
            strategy: order.source,
            dryRunResult
          });

          if (DEBUG) {
            const totalFees = dryRunResult.estimatedFees.map(f => f.amount).reduce((a, b) => a + b, 0).toFixed(2);
            logger.info('ORDER', 'Order placed successfully', { orderId, estimatedFees: totalFees });
          }

          return {
            success: true,
            orderId,
            order: response,
            dryRunResult,
            estimatedFees: dryRunResult.estimatedFees
          };

        } catch (error) {
          lastError = error;
          
          if (error.response?.status === 422 && attempt < maxRetries) {
            // Validation error - wait and retry
            logger.warn('ORDER', `Validation error, retrying in ${1000 * attempt}ms`);
            await this.sleep(1000 * attempt);
            continue;
          }
          
          if (error.response?.status >= 500 && attempt < maxRetries) {
            // Server error - exponential backoff
            const delay = 2000 * Math.pow(2, attempt - 1);
            logger.warn('ORDER', `Server error, retrying in ${delay}ms`);
            await this.sleep(delay);
            continue;
          }
          
          throw error; // Give up
        }
      }

      throw lastError;

    } catch (error) {
      logger.error('ERROR', '❌ Order placement failed:', error);
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * TOM KING STRATEGY: Iron Condor
   */
  async placeIronCondor(underlying, expiration, strikes, netCredit, quantity = 1) {
    if (DEBUG) {
      logger.info('SYSTEM', '🦅 Placing Iron Condor order...');
    }

    // Handle both strike formats: {longPut, shortPut, shortCall, longCall} or {putSpread: [long, short], callSpread: [short, long]}
    let longPut, shortPut, shortCall, longCall;
    
    if (strikes.putSpread && strikes.callSpread) {
      // Format: {putSpread: [640, 635], callSpread: [650, 655]}
      longPut = Math.min(...strikes.putSpread);    // Lower put (long)
      shortPut = Math.max(...strikes.putSpread);   // Higher put (short)
      shortCall = Math.min(...strikes.callSpread); // Lower call (short)
      longCall = Math.max(...strikes.callSpread);  // Higher call (long)
    } else {
      // Format: {longPut: 635, shortPut: 640, shortCall: 650, longCall: 655}
      longPut = strikes.longPut;
      shortPut = strikes.shortPut;
      shortCall = strikes.shortCall;
      longCall = strikes.longCall;
    }

    if (DEBUG) {
      logger.info('SYSTEM', `📊 ${underlying} ${this.formatExpiration(expiration)} strikes: ${longPut}/${shortPut}/${shortCall}/${longCall}`);
    }

    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netCredit.toString(),
      'price-effect': 'Credit',
      source: 'TOM_KING_IRON_CONDOR',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, longPut, 'P'),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, shortPut, 'P'),
          action: 'Sell to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, shortCall, 'C'),
          action: 'Sell to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, longCall, 'C'),
          action: 'Buy to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * TOM KING STRATEGY: Short Strangle (Credit)
   */
  async placeShortStrangle(underlying, expiration, putStrike, callStrike, netCredit, quantity = 1) {
    if (DEBUG) {
      logger.info('SYSTEM', '🎯 Placing Short Strangle order...');
      logger.info('SYSTEM', `📊 ${underlying} ${this.formatExpiration(expiration)} ${putStrike}P/${callStrike}C for $${netCredit} credit`);
    }

    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netCredit.toString(),
      'price-effect': 'Credit',
      source: 'TOM_KING_SHORT_STRANGLE',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, putStrike, 'P'),
          action: 'Sell to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, callStrike, 'C'),
          action: 'Sell to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * TOM KING STRATEGY: 0DTE Short Put/Call
   */
  async place0DTE(underlying, expiration, strike, optionType, premium, quantity = 1) {
    if (DEBUG) {
      logger.info('SYSTEM', '⚡ Placing 0DTE order...');
      logger.info('SYSTEM', `📊 ${underlying} ${this.formatExpiration(expiration)} ${strike}${optionType} for $${premium} credit`);
    }

    // Validate 0DTE timing
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = et.getHours();
    const minute = et.getMinutes();
    
    if (hour < 10 || (hour === 10 && minute < 30)) {
      throw new Error('0DTE orders not allowed before 10:30 AM ET (current time: ' + et.toLocaleTimeString() + ' ET)');
    }

    const order = {
      'time-in-force': 'Day', // CRITICAL: Never GTC for 0DTE
      'order-type': 'Limit',
      price: premium.toString(),
      'price-effect': 'Credit',
      source: 'TOM_KING_0DTE',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strike, optionType.toUpperCase().charAt(0)),
          action: 'Sell to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * TOM KING STRATEGY: Enhanced Section 9B Butterfly Matrix
   */
  async placeButterfly(underlying, expiration, strikes, netDebit, quantity = 1, butterflyType = 'CALL') {
    if (DEBUG) {
      logger.info('SYSTEM', '🦋 Placing Section 9B Butterfly order...');
      logger.info('SYSTEM', `📊 ${underlying} ${this.formatExpiration(expiration)} ${strikes.lower}/${strikes.middle}/${strikes.upper} ${butterflyType} for $${netDebit} debit`);
    }

    const optionType = butterflyType === 'CALL' ? 'C' : 'P';
    
    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netDebit.toString(),
      'price-effect': 'Debit',
      source: 'TOM_KING_SECTION_9B_BUTTERFLY',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.lower, optionType),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.middle, optionType),
          action: 'Sell to Open',
          quantity: quantity * 2
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.upper, optionType),
          action: 'Buy to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * TOM KING STRATEGY: Double Butterfly (Section 9B Advanced)
   */
  async placeDoubleButterfly(underlying, expiration, callStrikes, putStrikes, netDebit, quantity = 1) {
    if (DEBUG) {
      logger.info('SYSTEM', '🦋🦋 Placing Double Butterfly order (Section 9B)...');
      logger.info('SYSTEM', `📊 ${underlying} Call Fly: ${callStrikes.lower}/${callStrikes.middle}/${callStrikes.upper}`);
      logger.info('SYSTEM', `📊 ${underlying} Put Fly: ${putStrikes.lower}/${putStrikes.middle}/${putStrikes.upper}`);
    }

    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netDebit.toString(),
      'price-effect': 'Debit',
      source: 'TOM_KING_DOUBLE_BUTTERFLY',
      legs: [
        // Call butterfly
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, callStrikes.lower, 'C'),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, callStrikes.middle, 'C'),
          action: 'Sell to Open',
          quantity: quantity * 2
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, callStrikes.upper, 'C'),
          action: 'Buy to Open',
          quantity: quantity
        },
        // Put butterfly
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, putStrikes.lower, 'P'),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, putStrikes.middle, 'P'),
          action: 'Sell to Open',
          quantity: quantity * 2
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, putStrikes.upper, 'P'),
          action: 'Buy to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * TOM KING STRATEGY: Broken Wing Butterfly (Section 9B)
   */
  async placeBrokenWingButterfly(underlying, expiration, strikes, netCredit, quantity = 1) {
    if (DEBUG) {
      logger.info('SYSTEM', '🦋💥 Placing Broken Wing Butterfly order...');
      logger.info('SYSTEM', `📊 ${underlying} BWB: ${strikes.lower}/${strikes.middle}/${strikes.upper} for $${netCredit} credit`);
    }

    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netCredit.toString(),
      'price-effect': 'Credit',
      source: 'TOM_KING_BROKEN_WING_BUTTERFLY',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.lower, 'P'),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.middle, 'P'),
          action: 'Sell to Open',
          quantity: quantity * 2
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.upper, 'P'),
          action: 'Buy to Open',
          quantity: quantity
        }
      ]
    };

    return await this.placeOrder(order);
  }

  /**
   * Get order status by ID
   */
  async getOrderStatus(orderId) {
    try {
      const endpoint = `/accounts/${this.accountNumber}/orders/${orderId}`;
      const response = await this.api.request(endpoint);
      
      // Update local cache
      if (this.activeOrders.has(orderId)) {
        this.activeOrders.set(orderId, {
          ...this.activeOrders.get(orderId),
          ...response,
          lastChecked: new Date()
        });
      }

      return response;
    } catch (error) {
      logger.error('ERROR', `❌ Failed to get order status for ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Get all live orders
   */
  async getLiveOrders() {
    try {
      const endpoint = `/accounts/${this.accountNumber}/orders/live`;
      const response = await this.api.request(endpoint);
      
      if (DEBUG) {
        logger.info('SYSTEM', `📋 Retrieved ${response.items?.length || 0} live orders`);
      }

      return response.items || [];
    } catch (error) {
      logger.error('ERROR', '❌ Failed to get live orders:', error);
      return [];
    }
  }

  /**
   * Cancel order by ID
   */
  async cancelOrder(orderId) {
    try {
      logger.debug('SYSTEM', `❌ Cancelling order ${orderId}...`);
      
      const endpoint = `/accounts/${this.accountNumber}/orders/${orderId}`;
      const response = await this.api.request(endpoint, 'DELETE');
      
      // Remove from active orders
      this.activeOrders.delete(orderId);
      
      logger.debug('SYSTEM', `✅ Order ${orderId} cancelled`);
      
      return {
        success: true,
        orderId,
        response
      };
    } catch (error) {
      logger.error('ERROR', `❌ Failed to cancel order ${orderId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Monitor order until terminal status
   */
  async monitorOrder(orderId, callback = null) {
    const terminalStatuses = ['Filled', 'Cancelled', 'Expired', 'Rejected'];
    let status = 'Live';
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes at 1 second intervals

    logger.debug('SYSTEM', `👁️ Monitoring order ${orderId}...`);

    while (!terminalStatuses.includes(status) && attempts < maxAttempts) {
      await this.sleep(1000);
      attempts++;

      const order = await this.getOrderStatus(orderId);
      if (order && order.status !== status) {
        status = order.status;
        
        if (DEBUG) {
          logger.info('SYSTEM', `📊 Order ${orderId} status: ${status}`);
        }
        
        if (callback) {
          callback(order);
        }
      }
    }

    if (attempts >= maxAttempts) {
      logger.warn('WARN', `⚠️ Order monitoring timeout for ${orderId}`);
    }

    return status;
  }

  /**
   * Prepare an order without executing
   * Validates all safety rules before presenting to user
   */
  async prepareOrder(orderDetails, userData) {
    logger.info('SYSTEM', '\n📝 PREPARING ORDER FOR MANUAL EXECUTION');
    logger.info('SYSTEM', '================================================================================');
    
    // Step 1: Validate order
    const validation = await this.validateOrderPreparation(orderDetails, userData);
    if (!validation.valid) {
      logger.info('SYSTEM', '❌ ORDER VALIDATION FAILED');
      validation.errors.forEach(error => logger.info('SYSTEM', `   • ${error}`));
      return { success: false, errors: validation.errors };
    }
    
    // Step 2: Calculate exact order parameters
    const orderParams = await this.calculateOrderParameters(orderDetails, userData);
    
    // Step 3: Check risk limits
    const riskCheck = this.checkRiskLimits(orderParams, userData);
    if (!riskCheck.passed) {
      logger.info('SYSTEM', '⚠️ RISK LIMITS EXCEEDED');
      riskCheck.warnings.forEach(warning => logger.info('SYSTEM', `   • ${warning}`));
      if (!orderDetails.overrideRisk) {
        return { success: false, errors: riskCheck.warnings };
      }
    }
    
    // Step 4: Format for TastyTrade
    const tastytradeOrder = this.formatForTastyTrade(orderParams);
    
    // Step 5: Log the prepared order
    const preparedOrder = {
      id: this.generateOrderId(),
      timestamp: new Date().toISOString(),
      accountValue: userData.accountValue,
      phase: userData.phase,
      ...orderParams,
      tastytradeFormat: tastytradeOrder,
      validation: validation,
      riskCheck: riskCheck,
      status: 'PREPARED',
      executionEnabled: this.executionEnabled
    };
    
    this.logOrder(preparedOrder);
    
    // Display order details
    this.displayOrderSummary(preparedOrder);
    
    // Step 6: If execution is enabled, prepare for submission
    if (this.executionEnabled && orderDetails.autoExecute) {
      logger.info('SYSTEM', '\n⚠️ AUTO-EXECUTION IS ENABLED');
      logger.info('SYSTEM', 'Order would be submitted to TastyTrade API');
      // Future: await this.api.submitOrder(tastytradeOrder);
    } else {
      logger.info('SYSTEM', '\n📋 MANUAL EXECUTION REQUIRED');
      logger.info('SYSTEM', 'Copy the following details to TastyTrade platform:');
      logger.info('SYSTEM', '────────────────────────────────────────────────');
      this.displayManualInstructions(preparedOrder);
    }
    
    return {
      success: true,
      order: preparedOrder,
      manualExecutionRequired: !this.executionEnabled
    };
  }

  /**
   * Validate order against Tom King rules (for order preparation)
   */
  async validateOrderPreparation(orderDetails, userData) {
    const errors = [];
    const { strategy, ticker, direction, dte } = orderDetails;
    const { phase, dayOfWeek, timeEST, positions = [] } = userData;
    
    // Check day-specific strategy rules
    if (strategy === '0DTE') {
      if (dayOfWeek !== 'Friday') {
        errors.push('0DTE only allowed on Friday');
      }
      const hour = this.extractHour(timeEST);
      if (hour < 10.5) {
        errors.push('0DTE only after 10:30 AM EST');
      }
    }
    
    if (strategy === 'LT112' && dayOfWeek !== 'Wednesday') {
      errors.push('LT112 primary entry on Wednesday');
    }
    
    if (strategy === 'STRANGLE' && dayOfWeek !== 'Tuesday') {
      errors.push('Strangle preferred on Tuesday (warning only)');
    }
    
    // Check phase availability
    const maxPositions = this.safetyLimits.maxPositionsPerStrategy[strategy]?.[phase] || 0;
    if (maxPositions === 0) {
      errors.push(`${strategy} not available in Phase ${phase}`);
    }
    
    // Check current position count
    const currentPositions = positions.filter(p => p.strategy === strategy).length;
    if (currentPositions >= maxPositions) {
      errors.push(`Already at max ${strategy} positions (${currentPositions}/${maxPositions})`);
    }
    
    // Check correlation groups
    const correlationGroup = this.getCorrelationGroup(ticker);
    const groupPositions = positions.filter(p => 
      this.getCorrelationGroup(p.ticker) === correlationGroup
    ).length;
    
    if (groupPositions >= this.safetyLimits.correlationGroupLimits) {
      errors.push(`Correlation group ${correlationGroup} at limit (${groupPositions}/3)`);
    }
    
    // Check DTE rules
    if (strategy === 'STRANGLE' && dte < 45) {
      errors.push('Strangle requires 45+ DTE');
    }
    
    if (strategy === 'LT112' && (dte < 112 || dte > 120)) {
      errors.push('LT112 requires 112-120 DTE range (target 120)');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /**
   * Calculate exact order parameters
   */
  async calculateOrderParameters(orderDetails, userData) {
    const { strategy, ticker, strikes, quantity } = orderDetails;
    const { accountValue, phase } = userData;
    
    // Calculate position size based on phase and strategy
    const bpRequired = BPLimitsManager.estimatePositionBP({ strategy, ticker, phase });
    const maxRisk = accountValue * this.safetyLimits.maxRiskPerTrade;
    
    // Calculate exact strikes if not provided
    let finalStrikes = strikes;
    if (!strikes && this.api) {
      // Get option chain to find optimal strikes
      finalStrikes = await this.findOptimalStrikes(ticker, strategy);
    }
    
    return {
      strategy,
      ticker,
      strikes: finalStrikes,
      quantity: quantity || 1,
      bpRequired,
      maxRisk,
      estimatedCredit: this.estimateCredit(strategy, ticker),
      executionTime: new Date().toISOString()
    };
  }

  /**
   * Check risk limits for order preparation
   */
  checkRiskLimits(orderParams, userData) {
    const warnings = [];
    const { bpRequired } = orderParams;
    const { phase, bpUsed = 0, accountValue } = userData;
    
    const maxBP = this.safetyLimits.maxBPUsage[phase];
    const newBPUsage = bpUsed + bpRequired;
    
    if (newBPUsage > maxBP) {
      warnings.push(`Would exceed BP limit: ${newBPUsage}% > ${maxBP}% max`);
    }
    
    if (newBPUsage > 65) {
      warnings.push(`High BP usage warning: ${newBPUsage}%`);
    }
    
    const maxRisk = accountValue * this.safetyLimits.maxRiskPerTrade;
    if (orderParams.maxRisk > maxRisk) {
      warnings.push(`Risk exceeds 5% limit: £${orderParams.maxRisk}`);
    }
    
    return {
      passed: warnings.length === 0,
      warnings
    };
  }

  /**
   * Format order for TastyTrade API (enhanced version)
   */
  formatForTastyTrade(orderParams) {
    const { strategy, ticker, strikes, quantity } = orderParams;
    
    // Format according to TastyTrade API requirements
    if (strategy === 'STRANGLE') {
      return {
        symbol: ticker,
        orderType: 'NET_CREDIT',
        legs: [
          {
            symbol: `${ticker}_PUT_${strikes.put}`,
            action: 'SELL_TO_OPEN',
            quantity: quantity
          },
          {
            symbol: `${ticker}_CALL_${strikes.call}`,
            action: 'SELL_TO_OPEN',
            quantity: quantity
          }
        ],
        timeInForce: 'DAY',
        orderClass: 'MULTILEG'
      };
    }
    
    if (strategy === '0DTE') {
      return {
        symbol: ticker,
        orderType: 'NET_CREDIT',
        legs: [{
          symbol: `${ticker}_${strikes.type}_${strikes.strike}`,
          action: 'SELL_TO_OPEN',
          quantity: quantity
        }],
        timeInForce: 'DAY',
        orderClass: 'SIMPLE'
      };
    }
    
    // Default return for other strategies
    return {};
  }

  /**
   * Display order summary
   */
  displayOrderSummary(order) {
    logger.info('SYSTEM', '\n📊 ORDER SUMMARY');
    logger.info('SYSTEM', '────────────────────────────────────────────────');
    logger.info('SYSTEM', `Order ID:     ${order.id}`);
    logger.info('SYSTEM', `Strategy:     ${order.strategy}`);
    logger.info('SYSTEM', `Ticker:       ${order.ticker}`);
    logger.info('SYSTEM', `Quantity:     ${order.quantity}`);
    logger.info('SYSTEM', `BP Required:  ${order.bpRequired}%`);
    logger.info('SYSTEM', `Max Risk:     £${order.maxRisk?.toFixed(2) || 'N/A'}`);
    logger.info('SYSTEM', `Est. Credit:  £${order.estimatedCredit?.toFixed(2) || 'N/A'}`);
    
    if (order.strikes) {
      logger.info('SYSTEM', '\nStrikes:');
      Object.entries(order.strikes).forEach(([type, strike]) => {
        logger.info('SYSTEM', `  ${type}: ${strike}`);
      });
    }
  }

  /**
   * Display manual execution instructions
   */
  displayManualInstructions(order) {
    const { strategy, ticker, strikes, quantity } = order;
    
    logger.info('SYSTEM', '\n📋 TASTYTRADE MANUAL ENTRY INSTRUCTIONS:');
    logger.info('SYSTEM', '════════════════════════════════════════════════');
    
    if (strategy === 'STRANGLE') {
      logger.info('SYSTEM', '1. Go to Trade tab');
      logger.info('SYSTEM', `2. Search for: ${ticker}`);
      logger.info('SYSTEM', '3. Select expiration: 45-90 DTE');
      logger.info('SYSTEM', '4. Create strangle order:');
      logger.info('SYSTEM', `   • SELL ${quantity} PUT at strike ${strikes?.put || '[5-delta strike]'}`);
      logger.info('SYSTEM', `   • SELL ${quantity} CALL at strike ${strikes?.call || '[5-delta strike]'}`);
      logger.info('SYSTEM', '5. Set order type: NET CREDIT');
      logger.info('SYSTEM', '6. Review and submit');
    } else if (strategy === '0DTE') {
      logger.info('SYSTEM', '1. Go to Trade tab');
      logger.info('SYSTEM', `2. Search for: ${ticker}`);
      logger.info('SYSTEM', '3. Select expiration: Today (0 DTE)');
      logger.info('SYSTEM', '4. Create spread based on market direction');
      logger.info('SYSTEM', '5. Use 30-point wide spreads');
      logger.info('SYSTEM', '6. Target 50% profit or 2x stop loss');
    } else if (strategy === 'LT112') {
      logger.info('SYSTEM', '1. Go to Trade tab');
      logger.info('SYSTEM', `2. Search for: ${ticker}`);
      logger.info('SYSTEM', '3. Select expiration: 120 DTE (112-120 acceptable)');
      logger.info('SYSTEM', '4. SELL naked puts at support');
      logger.info('SYSTEM', '5. Week 2-4: Add call spreads');
    }
    
    logger.info('SYSTEM', '\n⚠️ IMPORTANT REMINDERS:');
    logger.info('SYSTEM', '   • Verify BP usage before submission');
    logger.info('SYSTEM', '   • Check correlation groups');
    logger.info('SYSTEM', '   • Set GTC orders for 50% profit target');
    logger.info('SYSTEM', '   • Note position in tracking spreadsheet');
  }

  /**
   * Log order to file
   */
  logOrder(order) {
    try {
      let orders = [];
      if (fs.existsSync(this.logFile)) {
        const data = fs.readFileSync(this.logFile, 'utf8');
        orders = JSON.parse(data);
      }
      
      orders.push(order);
      
      // Keep only last 100 orders
      if (orders.length > 100) {
        orders = orders.slice(-100);
      }
      
      fs.writeFileSync(this.logFile, JSON.stringify(orders, null, 2));
      logger.info('SYSTEM', `\n✅ Order logged: ${order.id}`);
    } catch (error) {
      logger.error('ERROR', 'Failed to log order:', error.message);
    }
  }

  /**
   * Get logged orders
   */
  getLoggedOrders(limit = 10) {
    try {
      if (fs.existsSync(this.logFile)) {
        const data = fs.readFileSync(this.logFile, 'utf8');
        const orders = JSON.parse(data);
        return orders.slice(-limit);
      }
    } catch (error) {
      logger.error('ERROR', 'Failed to read order log:', error.message);
    }
    return [];
  }

  /**
   * Get correlation group for a ticker
   */
  getCorrelationGroup(ticker) {
    const groups = {
      'EQUITY': ['ES', 'MES', 'NQ', 'MNQ', 'SPY', 'QQQ', 'IWM'],
      'METALS': ['GC', 'MGC', 'GLD', 'SI', 'SLV'],
      'ENERGY': ['CL', 'MCL', 'XLE', 'XOP'],
      'BONDS': ['ZB', 'ZN', 'TLT'],
      'CURRENCY': ['6E', '6B', '6A', 'M6E', 'M6A']
    };
    
    for (const [group, tickers] of Object.entries(groups)) {
      if (tickers.includes(ticker)) return group;
    }
    return 'OTHER';
  }

  // Removed duplicate calculateBPRequired - now using BPLimitsManager.estimatePositionBP from riskManager.js

  /**
   * Estimate credit for a strategy
   */
  estimateCredit(strategy, ticker) {
    // Rough estimates for planning
    const credits = {
      'STRANGLE': { micro: 200, full: 500 },
      '0DTE': { micro: 150, full: 300 },
      'LT112': { micro: 1000, full: 2500 }
    };
    
    const isMicro = ticker.startsWith('M') || ['MCL', 'MGC'].includes(ticker);
    return credits[strategy]?.[isMicro ? 'micro' : 'full'] || 100;
  }

  /**
   * Find optimal strikes using Greeks-based selection
   * Tom King methodology: Use delta for strike selection
   */
  async findOptimalStrikes(ticker, strategy, optionChain = null) {
    try {
      // Get option chain if not provided
      if (!optionChain) {
        optionChain = await this.api?.getOptionChain(ticker);
      }
      
      if (!optionChain || optionChain.length === 0) {
        logger.warn('ORDER', `No option chain available for ${ticker}`);
        return { put: 'N/A', call: 'N/A' };
      }
      
      // Get current price
      const quote = await this.api?.getMarketData(ticker);
      const currentPrice = quote?.last || quote?.price;
      
      if (!currentPrice) {
        return { put: 'N/A', call: 'N/A' };
      }
      
      // Define target deltas based on strategy
      let targetPutDelta, targetCallDelta;
      
      switch(strategy) {
        case '0DTE':
        case 'STRANGLE':
          // Tom King: 5-10 delta for strangles and 0DTE
          targetPutDelta = -0.05;
          targetCallDelta = 0.05;
          break;
          
        case 'LT112':
          // Tom King: 10 delta for Long-Term 112
          targetPutDelta = -0.10;
          targetCallDelta = 0.10;
          break;
          
        case 'IRON_CONDOR':
          // Tom King: 10-15 delta for Iron Condors
          targetPutDelta = -0.10;
          targetCallDelta = 0.10;
          break;
          
        case 'BUTTERFLY':
          // ATM for body, 20 delta for wings
          targetPutDelta = -0.50; // ATM
          targetCallDelta = 0.50;  // ATM
          break;
          
        default:
          // Default to 10 delta
          targetPutDelta = -0.10;
          targetCallDelta = 0.10;
      }
      
      // Find optimal expiration (Friday for 0DTE, appropriate DTE for others)
      const optimalExpiration = this.findOptimalExpiration(optionChain, strategy);
      
      if (!optimalExpiration) {
        return { put: 'N/A', call: 'N/A' };
      }
      
      // Find strikes closest to target delta
      const strikes = this.findStrikesByDelta(
        optimalExpiration.strikes,
        targetPutDelta,
        targetCallDelta,
        currentPrice
      );
      
      return {
        put: strikes.putStrike,
        call: strikes.callStrike,
        putDelta: strikes.putDelta,
        callDelta: strikes.callDelta,
        expiration: optimalExpiration.expiration,
        dte: optimalExpiration.dte
      };
      
    } catch (error) {
      logger.error('ORDER', 'Failed to find optimal strikes', error);
      return { put: 'ERROR', call: 'ERROR' };
    }
  }
  
  /**
   * Find optimal expiration based on strategy
   */
  findOptimalExpiration(optionChain, strategy) {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Sort expirations by DTE
    const expirations = optionChain
      .map(exp => {
        const expDate = new Date(exp.expiration);
        const dte = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
        return { ...exp, dte, dayOfWeek: expDate.getDay() };
      })
      .filter(exp => exp.dte >= 0)
      .sort((a, b) => a.dte - b.dte);
    
    if (expirations.length === 0) return null;
    
    let targetExp;
    
    switch(strategy) {
      case '0DTE':
        // Find today's expiration (must be Friday)
        targetExp = expirations.find(exp => exp.dte === 0 && exp.dayOfWeek === 5);
        break;
        
      case 'LT112':
        // Find expiration around 112 DTE
        targetExp = expirations.find(exp => exp.dte >= 105 && exp.dte <= 119) ||
                   expirations.find(exp => exp.dte >= 90 && exp.dte <= 130);
        break;
        
      case 'STRANGLE':
        // Find 90 DTE for strangles
        targetExp = expirations.find(exp => exp.dte >= 80 && exp.dte <= 100) ||
                   expirations.find(exp => exp.dte >= 70 && exp.dte <= 110);
        break;
        
      default:
        // Default to 30-45 DTE
        targetExp = expirations.find(exp => exp.dte >= 30 && exp.dte <= 45) ||
                   expirations[Math.floor(expirations.length / 2)];
    }
    
    return targetExp || expirations[0];
  }
  
  /**
   * Find strikes by target delta
   */
  findStrikesByDelta(strikes, targetPutDelta, targetCallDelta, currentPrice) {
    let bestPutStrike = null;
    let bestPutDelta = null;
    let bestCallStrike = null;
    let bestCallDelta = null;
    let minPutDiff = Infinity;
    let minCallDiff = Infinity;
    
    for (const strike of strikes) {
      // Check put options
      if (strike.put && strike.put.delta !== undefined) {
        const deltaDiff = Math.abs(strike.put.delta - targetPutDelta);
        if (deltaDiff < minPutDiff) {
          minPutDiff = deltaDiff;
          bestPutStrike = strike.strike;
          bestPutDelta = strike.put.delta;
        }
      }
      
      // Check call options
      if (strike.call && strike.call.delta !== undefined) {
        const deltaDiff = Math.abs(strike.call.delta - targetCallDelta);
        if (deltaDiff < minCallDiff) {
          minCallDiff = deltaDiff;
          bestCallStrike = strike.strike;
          bestCallDelta = strike.call.delta;
        }
      }
    }
    
    // Fallback to price-based selection if no Greeks available
    if (!bestPutStrike || !bestCallStrike) {
      const sortedStrikes = strikes
        .map(s => s.strike)
        .filter(s => typeof s === 'number')
        .sort((a, b) => a - b);
      
      if (sortedStrikes.length > 0) {
        // Put strike: ~5-10% below current price
        const targetPutPrice = currentPrice * 0.93;
        bestPutStrike = sortedStrikes.reduce((prev, curr) => 
          Math.abs(curr - targetPutPrice) < Math.abs(prev - targetPutPrice) ? curr : prev
        );
        
        // Call strike: ~5-10% above current price
        const targetCallPrice = currentPrice * 1.07;
        bestCallStrike = sortedStrikes.reduce((prev, curr) => 
          Math.abs(curr - targetCallPrice) < Math.abs(prev - targetCallPrice) ? curr : prev
        );
      }
    }
    
    return {
      putStrike: bestPutStrike || Math.floor(currentPrice * 0.93),
      callStrike: bestCallStrike || Math.ceil(currentPrice * 1.07),
      putDelta: bestPutDelta || targetPutDelta,
      callDelta: bestCallDelta || targetCallDelta
    };
  }

  /**
   * Extract hour from time string
   */
  extractHour(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
    if (match) {
      let hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const ampm = match[3];
      
      if (ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      
      return hour + (minute / 60);
    }
    return 10;
  }

  /**
   * Get Tom King strategy recommendations based on current orders
   */
  getStrategyRecommendations() {
    const activeCount = this.activeOrders.size;
    const recommendations = [];

    if (activeCount === 0) {
      recommendations.push({
        strategy: '0DTE Friday',
        priority: 'HIGH',
        reason: 'No active positions - safe to start with 0DTE'
      });
    }

    if (activeCount < 3) {
      recommendations.push({
        strategy: 'Iron Condor',
        priority: 'MEDIUM', 
        reason: 'Low correlation risk - can add defined risk strategies'
      });
    }

    return recommendations;
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate unique order ID
   */
  generateOrderId() {
    return generateOrderId();
  }

  /**
   * Submit a new order to the market
   * @param {Object} orderDetails - The order details including symbol, type, quantity, etc.
   * @returns {Promise<Object>} - Order submission result
   */
  async submitOrder(orderDetails) {
    const {
      symbol,
      orderType = 'LIMIT',
      quantity,
      price,
      side, // BUY or SELL
      strategy,
      timeInForce = 'DAY',
      stopPrice,
      metadata = {}
    } = orderDetails;

    // Validate required fields
    if (!symbol || !quantity || !side) {
      throw new Error('Missing required order fields: symbol, quantity, and side are required');
    }

    // Validate price for limit orders
    if (orderType === 'LIMIT' && !price) {
      throw new Error('Price is required for LIMIT orders');
    }

    // Validate stop price for stop orders
    if ((orderType === 'STOP' || orderType === 'STOP_LIMIT') && !stopPrice) {
      throw new Error('Stop price is required for STOP orders');
    }

    // Create order object
    const order = {
      id: this.generateOrderId(),
      symbol,
      orderType,
      quantity,
      price,
      side,
      strategy: strategy || 'MANUAL',
      timeInForce,
      stopPrice,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      metadata
    };

    // Add to active orders
    this.activeOrders.set(order.id, order);
    this.allOrders.push(order);

    // Log order submission
    logger.info('SYSTEM', `📤 Order submitted: ${order.id}`, {
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: order.price,
      type: order.orderType
    });

    // Simulate order execution (in production, this would call the API)
    if (this.api && typeof this.api.submitOrder === 'function') {
      try {
        const apiResponse = await this.api.submitOrder(order);
        order.apiOrderId = apiResponse.orderId;
        order.status = 'SUBMITTED';
      } catch (error) {
        order.status = 'FAILED';
        order.error = error.message;
        logger.error('ERROR', `❌ Order submission failed: ${error.message}`);
      }
    } else {
      // Simulate successful submission in test mode
      order.status = 'SUBMITTED';
      order.apiOrderId = `SIM-${order.id}`;
    }

    return order;
  }

  /**
   * Get order statistics
   */
  getStatistics() {
    const stats = {
      activeOrders: this.activeOrders.size,
      totalOrders: this.orderHistory.length,
      strategyCounts: {},
      totalFees: 0
    };

    // Count orders by strategy
    this.activeOrders.forEach(order => {
      const strategy = order.strategy || 'Unknown';
      stats.strategyCounts[strategy] = (stats.strategyCounts[strategy] || 0) + 1;
    });

    return stats;
  }
}

module.exports = { OrderManager };