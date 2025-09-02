/**
 * ORDER PREPARATION MODULE
 * Prepares orders for manual execution
 * Validates all safety rules before presenting to user
 * Does NOT execute orders automatically when ORDER_EXECUTION=disabled
 */

const fs = require('fs');
const path = require('path');

class OrderPreparation {
    constructor(api = null) {
        this.api = api;
        this.orderLog = [];
        this.logFile = path.join(__dirname, '../logs/prepared_orders.json');
        this.executionEnabled = process.env.ORDER_EXECUTION === 'enabled';
        
        // Safety limits from Tom King rules
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
    }

    /**
     * Prepare an order without executing
     */
    async prepareOrder(orderDetails, userData) {
        console.log('\n📝 PREPARING ORDER FOR MANUAL EXECUTION');
        console.log('================================================================================');
        
        // Step 1: Validate order
        const validation = await this.validateOrder(orderDetails, userData);
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
     * Validate order against Tom King rules
     */
    async validateOrder(orderDetails, userData) {
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
            // This would use the API to get current option chain
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
     * Check risk limits
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
     * Format order for TastyTrade API
     */
    formatForTastyTrade(orderParams) {
        const { strategy, ticker, strikes, quantity } = orderParams;
        
        // This would format according to TastyTrade API requirements
        // Example for a strangle:
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
        
        // Add other strategy formats...
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

    // Helper methods
    
    generateOrderId() {
        return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
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
    
    async findOptimalStrikes(ticker, strategy) {
        // This would use real option chain data
        // For now, return placeholder
        return {
            put: 'TBD - Check 5-delta',
            call: 'TBD - Check 5-delta'
        };
    }
}

module.exports = OrderPreparation;