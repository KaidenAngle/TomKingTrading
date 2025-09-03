/**
 * Tom King Order Management System
 * Complete TastyTrade API integration for live trading
 * Based on official API documentation and Tom King strategies
 * Consolidated order preparation and execution system
 */

const fs = require('fs');
const path = require('path');

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
        if (vixLevel < 13) return 0.45; // 45% for VIX <13
        if (vixLevel < 18) return 0.65; // 65% for VIX 13-18
        if (vixLevel < 25) return 0.75; // 75% for VIX 18-25
        if (vixLevel < 30) return 0.50; // 50% for VIX 25-30
        return 0.80; // 80% for VIX >30 (puts only)
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

    if (DEBUG) console.log('📋 OrderManager initialized');
  }

  /**
   * Initialize with account number
   */
  initialize(accountNumber) {
    this.accountNumber = accountNumber;
    if (DEBUG) console.log(`📋 OrderManager linked to account: ${accountNumber}`);
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

    return validations;
  }

  /**
   * Place dry-run order for testing
   */
  async dryRun(order) {
    try {
      if (DEBUG) {
        console.log('🧪 Running dry-run validation...');
        console.log('📋 Order:', JSON.stringify(order, null, 2));
      }

      // Validate order structure
      const validationErrors = this.validateOrder(order);
      if (validationErrors.length > 0) {
        throw new Error(`Order validation failed: ${validationErrors.join(', ')}`);
      }

      // Call TastyTrade dry-run API
      const endpoint = order.legs?.length > 1 
        ? `/accounts/${this.accountNumber}/complex-orders/dry-run`
        : `/accounts/${this.accountNumber}/orders/dry-run`;

      const response = await this.api.request(endpoint, 'POST', order);

      if (DEBUG) {
        console.log('✅ Dry-run successful');
        if (response.warnings?.length > 0) {
          console.warn('⚠️ Dry-run warnings:', response.warnings);
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
      console.error('❌ Dry-run failed:', error.message);
      
      // Fall back to local validation when API is unavailable
      console.log('🔄 Falling back to local validation...');
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

    console.log('🧪 Running local dry-run validation...');

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

    console.log('✅ Local validation passed');
    if (warnings.length > 0) {
      console.warn('⚠️ Local validation warnings:', warnings);
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
        console.log('🚀 Placing live order...');
        console.log('📋 Account:', this.accountNumber);
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
            console.log(`🔄 Order attempt ${attempt}/${maxRetries}`);
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
            console.log('✅ Order placed successfully');
            console.log(`📋 Order ID: ${orderId}`);
            console.log(`💰 Estimated fees: $${dryRunResult.estimatedFees.map(f => f.amount).reduce((a, b) => a + b, 0).toFixed(2)}`);
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
            if (DEBUG) console.warn(`⚠️ Validation error, retrying in ${1000 * attempt}ms...`);
            await this.sleep(1000 * attempt);
            continue;
          }
          
          if (error.response?.status >= 500 && attempt < maxRetries) {
            // Server error - exponential backoff
            const delay = 2000 * Math.pow(2, attempt - 1);
            if (DEBUG) console.warn(`⚠️ Server error, retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          
          throw error; // Give up
        }
      }

      throw lastError;

    } catch (error) {
      console.error('❌ Order placement failed:', error);
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
      console.log('🦅 Placing Iron Condor order...');
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
      console.log(`📊 ${underlying} ${this.formatExpiration(expiration)} strikes: ${longPut}/${shortPut}/${shortCall}/${longCall}`);
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
      console.log('🎯 Placing Short Strangle order...');
      console.log(`📊 ${underlying} ${this.formatExpiration(expiration)} ${putStrike}P/${callStrike}C for $${netCredit} credit`);
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
      console.log('⚡ Placing 0DTE order...');
      console.log(`📊 ${underlying} ${this.formatExpiration(expiration)} ${strike}${optionType} for $${premium} credit`);
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
      console.log('🦋 Placing Section 9B Butterfly order...');
      console.log(`📊 ${underlying} ${this.formatExpiration(expiration)} ${strikes.lower}/${strikes.middle}/${strikes.upper} ${butterflyType} for $${netDebit} debit`);
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
      console.log('🦋🦋 Placing Double Butterfly order (Section 9B)...');
      console.log(`📊 ${underlying} Call Fly: ${callStrikes.lower}/${callStrikes.middle}/${callStrikes.upper}`);
      console.log(`📊 ${underlying} Put Fly: ${putStrikes.lower}/${putStrikes.middle}/${putStrikes.upper}`);
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
      console.log('🦋💥 Placing Broken Wing Butterfly order...');
      console.log(`📊 ${underlying} BWB: ${strikes.lower}/${strikes.middle}/${strikes.upper} for $${netCredit} credit`);
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
      console.error(`❌ Failed to get order status for ${orderId}:`, error);
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
        console.log(`📋 Retrieved ${response.items?.length || 0} live orders`);
      }

      return response.items || [];
    } catch (error) {
      console.error('❌ Failed to get live orders:', error);
      return [];
    }
  }

  /**
   * Cancel order by ID
   */
  async cancelOrder(orderId) {
    try {
      if (DEBUG) console.log(`❌ Cancelling order ${orderId}...`);
      
      const endpoint = `/accounts/${this.accountNumber}/orders/${orderId}`;
      const response = await this.api.request(endpoint, 'DELETE');
      
      // Remove from active orders
      this.activeOrders.delete(orderId);
      
      if (DEBUG) console.log(`✅ Order ${orderId} cancelled`);
      
      return {
        success: true,
        orderId,
        response
      };
    } catch (error) {
      console.error(`❌ Failed to cancel order ${orderId}:`, error);
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

    if (DEBUG) console.log(`👁️ Monitoring order ${orderId}...`);

    while (!terminalStatuses.includes(status) && attempts < maxAttempts) {
      await this.sleep(1000);
      attempts++;

      const order = await this.getOrderStatus(orderId);
      if (order && order.status !== status) {
        status = order.status;
        
        if (DEBUG) {
          console.log(`📊 Order ${orderId} status: ${status}`);
        }
        
        if (callback) {
          callback(order);
        }
      }
    }

    if (attempts >= maxAttempts) {
      console.warn(`⚠️ Order monitoring timeout for ${orderId}`);
    }

    return status;
  }

  /**
   * Prepare an order without executing
   * Validates all safety rules before presenting to user
   */
  async prepareOrder(orderDetails, userData) {
    console.log('\n📝 PREPARING ORDER FOR MANUAL EXECUTION');
    console.log('================================================================================');
    
    // Step 1: Validate order
    const validation = await this.validateOrderPreparation(orderDetails, userData);
    if (!validation.valid) {
      console.log('❌ ORDER VALIDATION FAILED');
      validation.errors.forEach(error => console.log(`   • ${error}`));
      return { success: false, errors: validation.errors };
    }
    
    // Step 2: Calculate exact order parameters
    const orderParams = await this.calculateOrderParameters(orderDetails, userData);
    
    // Step 3: Check risk limits
    const riskCheck = this.checkRiskLimits(orderParams, userData);
    if (!riskCheck.passed) {
      console.log('⚠️ RISK LIMITS EXCEEDED');
      riskCheck.warnings.forEach(warning => console.log(`   • ${warning}`));
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
      console.log('\n⚠️ AUTO-EXECUTION IS ENABLED');
      console.log('Order would be submitted to TastyTrade API');
      // Future: await this.api.submitOrder(tastytradeOrder);
    } else {
      console.log('\n📋 MANUAL EXECUTION REQUIRED');
      console.log('Copy the following details to TastyTrade platform:');
      console.log('────────────────────────────────────────────────');
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
    const bpRequired = this.calculateBPRequired(strategy, ticker, phase);
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
    console.log('\n📊 ORDER SUMMARY');
    console.log('────────────────────────────────────────────────');
    console.log(`Order ID:     ${order.id}`);
    console.log(`Strategy:     ${order.strategy}`);
    console.log(`Ticker:       ${order.ticker}`);
    console.log(`Quantity:     ${order.quantity}`);
    console.log(`BP Required:  ${order.bpRequired}%`);
    console.log(`Max Risk:     £${order.maxRisk?.toFixed(2) || 'N/A'}`);
    console.log(`Est. Credit:  £${order.estimatedCredit?.toFixed(2) || 'N/A'}`);
    
    if (order.strikes) {
      console.log('\nStrikes:');
      Object.entries(order.strikes).forEach(([type, strike]) => {
        console.log(`  ${type}: ${strike}`);
      });
    }
  }

  /**
   * Display manual execution instructions
   */
  displayManualInstructions(order) {
    const { strategy, ticker, strikes, quantity } = order;
    
    console.log('\n📋 TASTYTRADE MANUAL ENTRY INSTRUCTIONS:');
    console.log('════════════════════════════════════════════════');
    
    if (strategy === 'STRANGLE') {
      console.log('1. Go to Trade tab');
      console.log(`2. Search for: ${ticker}`);
      console.log('3. Select expiration: 45-90 DTE');
      console.log('4. Create strangle order:');
      console.log(`   • SELL ${quantity} PUT at strike ${strikes?.put || '[5-delta strike]'}`);
      console.log(`   • SELL ${quantity} CALL at strike ${strikes?.call || '[5-delta strike]'}`);
      console.log('5. Set order type: NET CREDIT');
      console.log('6. Review and submit');
    } else if (strategy === '0DTE') {
      console.log('1. Go to Trade tab');
      console.log(`2. Search for: ${ticker}`);
      console.log('3. Select expiration: Today (0 DTE)');
      console.log('4. Create spread based on market direction');
      console.log('5. Use 30-point wide spreads');
      console.log('6. Target 50% profit or 2x stop loss');
    } else if (strategy === 'LT112') {
      console.log('1. Go to Trade tab');
      console.log(`2. Search for: ${ticker}`);
      console.log('3. Select expiration: 120 DTE (112-120 acceptable)');
      console.log('4. SELL naked puts at support');
      console.log('5. Week 2-4: Add call spreads');
    }
    
    console.log('\n⚠️ IMPORTANT REMINDERS:');
    console.log('   • Verify BP usage before submission');
    console.log('   • Check correlation groups');
    console.log('   • Set GTC orders for 50% profit target');
    console.log('   • Note position in tracking spreadsheet');
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
      console.log(`\n✅ Order logged: ${order.id}`);
    } catch (error) {
      console.error('Failed to log order:', error.message);
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
      console.error('Failed to read order log:', error.message);
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

  /**
   * Calculate BP required for a strategy
   */
  calculateBPRequired(strategy, ticker, phase) {
    const isMicro = ticker.startsWith('M') || ['MCL', 'MGC'].includes(ticker);
    
    const bpMap = {
      'STRANGLE': isMicro ? 2.5 : 3.5,
      'LT112': ticker === 'ES' ? 6 : ticker === 'MES' ? 3 : 4,
      'IPMCC': 8,
      '0DTE': 2,
      'BUTTERFLY': 0.5
    };
    
    return bpMap[strategy] || 3;
  }

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
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
    console.log(`📤 Order submitted: ${order.id}`, {
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
        console.error(`❌ Order submission failed: ${error.message}`);
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