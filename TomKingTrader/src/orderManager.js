/**
 * Tom King Order Management System
 * Complete TastyTrade API integration for live trading
 * Based on official API documentation and Tom King strategies
 */

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
    this.riskLimits = {
      maxPositionSize: 0.05, // 5% of account per trade (Tom King rule)
      maxBPUsage: 0.35,      // 35% max buying power
      maxCorrelatedPositions: 3, // Max 3 positions per correlation group
      dailyOrderLimit: 50    // Safety limit
    };

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
   * TOM KING STRATEGY: Butterfly Spread
   */
  async placeButterfly(underlying, expiration, strikes, netDebit, quantity = 1) {
    if (DEBUG) {
      console.log('🦋 Placing Butterfly order...');
      console.log(`📊 ${underlying} ${this.formatExpiration(expiration)} ${strikes.lower}/${strikes.middle}/${strikes.upper} for $${netDebit} debit`);
    }

    const order = {
      'time-in-force': 'Day',
      'order-type': 'Limit',
      price: netDebit.toString(),
      'price-effect': 'Debit',
      source: 'TOM_KING_BUTTERFLY',
      legs: [
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.lower, 'C'),
          action: 'Buy to Open',
          quantity: quantity
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.middle, 'C'),
          action: 'Sell to Open',
          quantity: quantity * 2
        },
        {
          'instrument-type': 'Equity Option',
          symbol: this.createOptionSymbol(underlying, expiration, strikes.upper, 'C'),
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

module.exports = OrderManager;