/**
 * TastyTrade Account Streamer
 * Real-time account data streaming and tracking
 * Handles balance updates, positions, and P&L tracking
 */

const WebSocket = require('ws');
const EventEmitter = require('events');
const { getLogger } = require('./logger');
const logger = getLogger();

class AccountStreamer extends EventEmitter {
    constructor(api) {
        super();
        this.api = api;
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        
        // Multi-account support
        this.multiAccountMode = false;
        this.accounts = new Map(); // Map of accountNumber -> accountData
        this.primaryAccount = null;
        this.activeAccount = null;
        
        // Account data cache (for backward compatibility)
        this.accountData = {
            balance: null,
            positions: [],
            orders: [],
            greeks: {
                portfolio: {
                    delta: 0,
                    gamma: 0,
                    theta: 0,
                    vega: 0
                }
            },
            lastUpdate: null
        };
        
        // Tracking history
        this.history = {
            balances: [],
            positions: [],
            trades: [],
            pnl: []
        };
    }
    
    /**
     * Initialize multi-account support
     */
    async initializeMultiAccount(accountNumbers = []) {
        if (!accountNumbers || accountNumbers.length === 0) {
            logger.warn('MULTI_ACCOUNT', 'No account numbers provided');
            return false;
        }
        
        this.multiAccountMode = true;
        this.primaryAccount = accountNumbers[0];
        this.activeAccount = this.primaryAccount;
        
        logger.info('MULTI_ACCOUNT', `Initializing ${accountNumbers.length} accounts`);
        
        // Initialize data structure for each account
        for (const accountNumber of accountNumbers) {
            this.accounts.set(accountNumber, {
                accountNumber,
                accountType: null, // 'LIVE', 'PAPER', 'IRA', 'MARGIN'
                balance: null,
                positions: [],
                orders: [],
                greeks: {
                    portfolio: {
                        delta: 0,
                        gamma: 0,
                        theta: 0,
                        vega: 0
                    }
                },
                history: {
                    balances: [],
                    positions: [],
                    trades: [],
                    pnl: []
                },
                lastUpdate: null,
                restrictions: [], // Account-specific restrictions
                phase: 1, // Account-specific phase
                tradingEnabled: true
            });
        }
        
        // Connect streams for all accounts
        const connections = await Promise.allSettled(
            accountNumbers.map(acc => this.connectAccount(acc))
        );
        
        const successful = connections.filter(c => c.status === 'fulfilled').length;
        logger.info('MULTI_ACCOUNT', `Connected to ${successful}/${accountNumbers.length} accounts`);
        
        return successful > 0;
    }
    
    /**
     * Connect to a specific account
     */
    async connectAccount(accountNumber) {
        try {
            const accountData = this.accounts.get(accountNumber);
            if (!accountData) {
                throw new Error(`Account ${accountNumber} not initialized`);
            }
            
            // Get account info
            const accountInfo = await this.api.getAccountInfo(accountNumber);
            accountData.accountType = accountInfo.accountType || 'MARGIN';
            accountData.restrictions = accountInfo.restrictions || [];
            
            // Determine phase based on balance
            const balance = accountInfo.netLiq || accountInfo.balance || 0;
            accountData.phase = this.determineAccountPhase(balance);
            
            logger.info('MULTI_ACCOUNT', `Account ${accountNumber} connected`, {
                type: accountData.accountType,
                phase: accountData.phase,
                balance: balance
            });
            
            return true;
            
        } catch (error) {
            logger.error('MULTI_ACCOUNT', `Failed to connect account ${accountNumber}`, error);
            return false;
        }
    }
    
    /**
     * Determine account phase based on balance
     */
    determineAccountPhase(balance) {
        if (balance < 40000) return 1;
        if (balance < 60000) return 2;
        if (balance < 75000) return 3;
        return 4;
    }
    
    /**
     * Switch active account
     */
    switchAccount(accountNumber) {
        if (!this.accounts.has(accountNumber)) {
            logger.error('MULTI_ACCOUNT', `Account ${accountNumber} not found`);
            return false;
        }
        
        this.activeAccount = accountNumber;
        
        // Update legacy accountData for backward compatibility
        const account = this.accounts.get(accountNumber);
        this.accountData = {
            balance: account.balance,
            positions: account.positions,
            orders: account.orders,
            greeks: account.greeks,
            lastUpdate: account.lastUpdate
        };
        
        this.emit('account-switched', {
            previousAccount: this.activeAccount,
            newAccount: accountNumber,
            accountData: account
        });
        
        logger.info('MULTI_ACCOUNT', `Switched to account ${accountNumber}`);
        return true;
    }
    
    /**
     * Get aggregated portfolio data across all accounts
     */
    getAggregatedPortfolio() {
        const aggregated = {
            totalBalance: 0,
            totalPositions: 0,
            totalOrders: 0,
            combinedGreeks: {
                delta: 0,
                gamma: 0,
                theta: 0,
                vega: 0
            },
            accounts: [],
            byStrategy: {},
            byUnderlying: {},
            correlationGroups: {}
        };
        
        for (const [accountNumber, account] of this.accounts) {
            // Add balance
            if (account.balance) {
                aggregated.totalBalance += account.balance.netLiq || 0;
            }
            
            // Add positions
            aggregated.totalPositions += account.positions.length;
            
            // Add orders
            aggregated.totalOrders += account.orders.length;
            
            // Aggregate Greeks
            if (account.greeks?.portfolio) {
                aggregated.combinedGreeks.delta += account.greeks.portfolio.delta || 0;
                aggregated.combinedGreeks.gamma += account.greeks.portfolio.gamma || 0;
                aggregated.combinedGreeks.theta += account.greeks.portfolio.theta || 0;
                aggregated.combinedGreeks.vega += account.greeks.portfolio.vega || 0;
            }
            
            // Account summary
            aggregated.accounts.push({
                accountNumber,
                accountType: account.accountType,
                phase: account.phase,
                balance: account.balance?.netLiq || 0,
                positions: account.positions.length,
                bpUsed: account.balance?.bpUsed || 0,
                tradingEnabled: account.tradingEnabled
            });
            
            // Aggregate by strategy and underlying
            for (const position of account.positions) {
                // By strategy
                const strategy = position.strategy || 'UNDEFINED';
                if (!aggregated.byStrategy[strategy]) {
                    aggregated.byStrategy[strategy] = {
                        count: 0,
                        value: 0,
                        pnl: 0
                    };
                }
                aggregated.byStrategy[strategy].count++;
                aggregated.byStrategy[strategy].value += position.marketValue || 0;
                aggregated.byStrategy[strategy].pnl += position.unrealizedPL || 0;
                
                // By underlying
                const underlying = position.underlyingSymbol || position.symbol;
                if (!aggregated.byUnderlying[underlying]) {
                    aggregated.byUnderlying[underlying] = {
                        count: 0,
                        accounts: new Set(),
                        totalDelta: 0
                    };
                }
                aggregated.byUnderlying[underlying].count++;
                aggregated.byUnderlying[underlying].accounts.add(accountNumber);
                aggregated.byUnderlying[underlying].totalDelta += position.delta || 0;
            }
        }
        
        // Check correlation violations across accounts
        aggregated.correlationViolations = this.checkCrossAccountCorrelation(aggregated.byUnderlying);
        
        return aggregated;
    }
    
    /**
     * Check correlation violations across accounts
     */
    checkCrossAccountCorrelation(byUnderlying) {
        const violations = [];
        const correlationGroups = {
            'EQUITY': ['ES', 'MES', 'SPY', 'QQQ', 'IWM'],
            'ENERGY': ['CL', 'MCL', 'XLE', 'XOP'],
            'METALS': ['GC', 'MGC', 'GLD', 'SLV']
        };
        
        for (const [group, symbols] of Object.entries(correlationGroups)) {
            let totalPositions = 0;
            const accountsInvolved = new Set();
            
            for (const symbol of symbols) {
                if (byUnderlying[symbol]) {
                    totalPositions += byUnderlying[symbol].count;
                    byUnderlying[symbol].accounts.forEach(acc => accountsInvolved.add(acc));
                }
            }
            
            // Check if exceeds limit (considering all accounts)
            if (totalPositions > 3) {
                violations.push({
                    group,
                    totalPositions,
                    accountsInvolved: Array.from(accountsInvolved),
                    severity: totalPositions > 5 ? 'HIGH' : 'MEDIUM'
                });
            }
        }
        
        return violations;
    }
    
    /**
     * Get account-specific recommendations
     */
    getAccountRecommendations(accountNumber = null) {
        const account = accountNumber 
            ? this.accounts.get(accountNumber)
            : this.accounts.get(this.activeAccount);
            
        if (!account) {
            return { error: 'Account not found' };
        }
        
        const recommendations = [];
        const balance = account.balance?.netLiq || 0;
        const bpUsed = account.balance?.bpUsed || 0;
        const bpUsagePercent = balance > 0 ? (bpUsed / balance) * 100 : 0;
        
        // Phase-based recommendations
        if (account.phase === 1 && balance > 38000) {
            recommendations.push({
                type: 'PHASE_UPGRADE',
                message: 'Near Phase 2 - prepare for MES/MNQ addition',
                action: 'Review Phase 2 strategies'
            });
        }
        
        // BP usage recommendations
        if (bpUsagePercent > 75) {
            recommendations.push({
                type: 'BP_WARNING',
                message: `BP usage high: ${bpUsagePercent.toFixed(1)}%`,
                action: 'Consider reducing position sizes'
            });
        } else if (bpUsagePercent < 30 && account.positions.length < 3) {
            recommendations.push({
                type: 'UNDERUTILIZED',
                message: 'Low BP utilization',
                action: 'Consider adding positions per strategy hierarchy'
            });
        }
        
        // Account type specific
        if (account.accountType === 'IRA') {
            recommendations.push({
                type: 'IRA_REMINDER',
                message: 'IRA account - no undefined risk trades',
                action: 'Stick to defined risk strategies only'
            });
        }
        
        return {
            accountNumber: account.accountNumber,
            phase: account.phase,
            recommendations
        };
    }
    
    /**
     * Export multi-account data
     */
    async exportMultiAccountData(filepath) {
        const fs = require('fs').promises;
        const data = {
            aggregated: this.getAggregatedPortfolio(),
            accounts: [],
            exported: new Date().toISOString()
        };
        
        for (const [accountNumber, account] of this.accounts) {
            data.accounts.push({
                accountNumber,
                accountType: account.accountType,
                phase: account.phase,
                balance: account.balance,
                positions: account.positions.length,
                orders: account.orders.length,
                greeks: account.greeks,
                recentPnL: account.history.pnl.slice(-7) // Last week
            });
        }
        
        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        logger.info('MULTI_ACCOUNT', `Multi-account data exported to ${filepath}`);
    }

    /**
     * Connect to account streaming WebSocket
     */
    async connect() {
        try {
            const token = await this.api.tokenManager.getValidToken();
            const wsUrl = this.getWebSocketUrl();
            
            logger.info('STREAMER', `Connecting to account stream at ${wsUrl}`);
            
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'Authorization': token
                }
            });

            this.setupEventHandlers();
            
            // Wait for connection
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 10000);

                this.once('connected', () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.once('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            // Subscribe to account updates
            await this.subscribeToAccount();
            
            logger.info('STREAMER', 'Account streaming connected and subscribed');
            return true;

        } catch (error) {
            logger.error('STREAMER', 'Connection failed', error);
            throw error;
        }
    }

    /**
     * Get WebSocket URL based on environment
     */
    getWebSocketUrl() {
        const baseUrl = this.api.baseURL.replace('https://', 'wss://');
        return `${baseUrl}/accounts/${this.api.accountNumber}/streamer`;
    }

    /**
     * Setup WebSocket event handlers
     */
    setupEventHandlers() {
        this.ws.on('open', () => {
            logger.info('STREAMER', 'WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
        });

        this.ws.on('message', (data) => {
            this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
            logger.error('STREAMER', 'WebSocket error', error);
            this.emit('error', error);
        });

        this.ws.on('close', (code, reason) => {
            logger.warn('STREAMER', `WebSocket closed: ${code} - ${reason}`);
            this.isConnected = false;
            this.emit('disconnected', { code, reason });
            
            // Attempt reconnection
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        });

        this.ws.on('ping', () => {
            this.ws.pong();
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            switch (message.type) {
                case 'balance-update':
                    this.handleBalanceUpdate(message.data);
                    break;
                
                case 'position-update':
                    this.handlePositionUpdate(message.data);
                    break;
                
                case 'order-update':
                    this.handleOrderUpdate(message.data);
                    break;
                
                case 'trade-update':
                    this.handleTradeUpdate(message.data);
                    break;
                
                case 'heartbeat':
                    this.handleHeartbeat();
                    break;
                
                default:
                    logger.debug('STREAMER', `Unknown message type: ${message.type}`);
            }

            // Store timestamp
            this.accountData.lastUpdate = new Date();
            
        } catch (error) {
            logger.error('STREAMER', 'Failed to handle message', error);
        }
    }

    /**
     * Handle balance update
     */
    handleBalanceUpdate(data) {
        // Parse balance data - handle small amounts properly
        const balance = {
            netLiq: this.parseMoneyValue(data['net-liquidating-value']),
            cashBalance: this.parseMoneyValue(data['cash-balance']),
            buyingPower: this.parseMoneyValue(data['derivative-buying-power']),
            maintenanceRequirement: this.parseMoneyValue(data['maintenance-requirement']),
            bpUsed: this.parseMoneyValue(data['derivative-buying-power-used']),
            timestamp: new Date().toISOString()
        };

        // Special handling for small balances
        if (balance.netLiq === 0 && data['net-liquidating-value']) {
            // Try parsing as string with more precision
            const rawValue = data['net-liquidating-value'];
            if (typeof rawValue === 'string') {
                const parsed = parseFloat(rawValue.replace(/[$,]/g, ''));
                if (!isNaN(parsed) && parsed > 0 && parsed < 100) {
                    balance.netLiq = parsed;
                    logger.info('STREAMER', `Small balance detected: $${parsed.toFixed(2)}`);
                }
            }
        }

        // Check if this could be the $16.09 account
        if (balance.netLiq < 20 && balance.netLiq > 0) {
            logger.info('STREAMER', `Low balance account detected: $${balance.netLiq.toFixed(2)}`);
            // Store exact value
            balance.actualBalance = balance.netLiq;
        }

        this.accountData.balance = balance;
        
        // Track balance history
        this.history.balances.push({
            ...balance,
            timestamp: new Date().toISOString()
        });

        // Emit event
        this.emit('balance-update', balance);
        
        logger.info('STREAMER', 'Balance updated', {
            netLiq: `$${balance.netLiq.toFixed(2)}`,
            cash: `$${balance.cashBalance.toFixed(2)}`,
            bp: `$${balance.buyingPower.toFixed(2)}`
        });
    }

    /**
     * Parse money value with special handling for small amounts
     */
    parseMoneyValue(value) {
        if (!value) return 0;
        
        // If already a number
        if (typeof value === 'number') {
            return value;
        }
        
        // Parse string value
        if (typeof value === 'string') {
            // Remove currency symbols and commas
            const cleaned = value.replace(/[$,]/g, '').trim();
            const parsed = parseFloat(cleaned);
            
            // Special case for very small values
            if (!isNaN(parsed)) {
                // If it's between 0 and 100, keep full precision
                if (parsed > 0 && parsed < 100) {
                    return Math.round(parsed * 100) / 100; // Round to cents
                }
                return parsed;
            }
        }
        
        return 0;
    }

    /**
     * Handle position update
     */
    handlePositionUpdate(data) {
        const position = {
            symbol: data.symbol,
            underlyingSymbol: data['underlying-symbol'],
            quantity: parseInt(data.quantity) || 0,
            averagePrice: parseFloat(data['average-open-price']) || 0,
            marketPrice: parseFloat(data['close-price']) || 0,
            marketValue: parseFloat(data['market-value']) || 0,
            unrealizedPL: parseFloat(data['unrealized-day-gain']) || 0,
            unrealizedPLPercent: parseFloat(data['unrealized-day-gain-percent']) || 0,
            realizedPL: parseFloat(data['realized-day-gain']) || 0,
            instrumentType: data['instrument-type'],
            expirationDate: data['expiration-date'],
            strikePrice: data['strike-price'],
            optionType: data['option-type'],
            
            // Greeks for options
            greeks: {
                delta: parseFloat(data.delta) || 0,
                gamma: parseFloat(data.gamma) || 0,
                theta: parseFloat(data.theta) || 0,
                vega: parseFloat(data.vega) || 0,
                rho: parseFloat(data.rho) || 0
            }
        };

        // Update or add position
        const existingIndex = this.accountData.positions.findIndex(
            p => p.symbol === position.symbol
        );

        if (existingIndex >= 0) {
            this.accountData.positions[existingIndex] = position;
        } else {
            this.accountData.positions.push(position);
        }

        // Recalculate portfolio Greeks
        this.calculatePortfolioGreeks();

        // Track position history
        this.history.positions.push({
            ...position,
            timestamp: new Date().toISOString()
        });

        // Emit event
        this.emit('position-update', position);
        
        logger.info('STREAMER', `Position updated: ${position.symbol}`, {
            quantity: position.quantity,
            unrealizedPL: `$${position.unrealizedPL.toFixed(2)}`
        });
    }

    /**
     * Handle order update
     */
    handleOrderUpdate(data) {
        const order = {
            id: data.id,
            symbol: data.symbol,
            underlyingSymbol: data['underlying-symbol'],
            orderType: data['order-type'],
            status: data.status,
            quantity: parseInt(data.quantity) || 0,
            filledQuantity: parseInt(data['filled-quantity']) || 0,
            price: parseFloat(data.price) || 0,
            avgFillPrice: parseFloat(data['avg-fill-price']) || 0,
            timeInForce: data['time-in-force'],
            createdAt: data['created-at'],
            updatedAt: data['updated-at']
        };

        // Update or add order
        const existingIndex = this.accountData.orders.findIndex(
            o => o.id === order.id
        );

        if (existingIndex >= 0) {
            this.accountData.orders[existingIndex] = order;
        } else {
            this.accountData.orders.push(order);
        }

        // Emit event
        this.emit('order-update', order);
        
        logger.info('STREAMER', `Order ${order.status}: ${order.symbol}`, {
            quantity: order.quantity,
            filled: order.filledQuantity
        });
    }

    /**
     * Handle trade update (fills)
     */
    handleTradeUpdate(data) {
        const trade = {
            id: data.id,
            orderId: data['order-id'],
            symbol: data.symbol,
            action: data.action,
            quantity: parseInt(data.quantity) || 0,
            price: parseFloat(data.price) || 0,
            fees: parseFloat(data.fees) || 0,
            executedAt: data['executed-at'],
            value: parseFloat(data.value) || 0
        };

        // Track trade history
        this.history.trades.push({
            ...trade,
            timestamp: new Date().toISOString()
        });

        // Update P&L tracking
        this.updatePnLTracking(trade);

        // Emit event
        this.emit('trade-update', trade);
        
        logger.info('STREAMER', `Trade executed: ${trade.symbol}`, {
            action: trade.action,
            quantity: trade.quantity,
            price: `$${trade.price.toFixed(2)}`
        });
    }

    /**
     * Calculate portfolio Greeks from all positions
     */
    calculatePortfolioGreeks() {
        const portfolio = {
            delta: 0,
            gamma: 0,
            theta: 0,
            vega: 0,
            rho: 0
        };

        for (const position of this.accountData.positions) {
            if (position.instrumentType === 'Option' && position.greeks) {
                portfolio.delta += position.greeks.delta * position.quantity;
                portfolio.gamma += position.greeks.gamma * position.quantity;
                portfolio.theta += position.greeks.theta * position.quantity;
                portfolio.vega += position.greeks.vega * position.quantity;
                portfolio.rho += position.greeks.rho * position.quantity;
            } else if (position.instrumentType === 'Stock') {
                // Stocks have delta of 1 per share
                portfolio.delta += position.quantity;
            }
        }

        this.accountData.greeks.portfolio = portfolio;
        
        logger.debug('STREAMER', 'Portfolio Greeks updated', portfolio);
    }

    /**
     * Update P&L tracking
     */
    updatePnLTracking(trade) {
        const today = new Date().toDateString();
        let dailyPnL = this.history.pnl.find(p => 
            new Date(p.date).toDateString() === today
        );

        if (!dailyPnL) {
            dailyPnL = {
                date: new Date().toISOString(),
                realized: 0,
                unrealized: 0,
                fees: 0,
                trades: 0
            };
            this.history.pnl.push(dailyPnL);
        }

        // Update daily P&L
        if (trade.action === 'SELL_TO_CLOSE' || trade.action === 'BUY_TO_CLOSE') {
            dailyPnL.realized += trade.value - trade.fees;
        }
        dailyPnL.fees += trade.fees;
        dailyPnL.trades++;

        // Update unrealized from positions
        dailyPnL.unrealized = this.accountData.positions.reduce(
            (sum, pos) => sum + pos.unrealizedPL, 0
        );
    }

    /**
     * Subscribe to account updates
     */
    async subscribeToAccount() {
        const subscribeMessage = {
            type: 'subscribe',
            channels: [
                'balance-updates',
                'position-updates',
                'order-updates',
                'trade-updates'
            ],
            accountNumber: this.api.accountNumber
        };

        this.ws.send(JSON.stringify(subscribeMessage));
        logger.debug('STREAMER', 'Subscribed to account updates');
    }

    /**
     * Handle heartbeat
     */
    handleHeartbeat() {
        const response = {
            type: 'heartbeat-response',
            timestamp: Date.now()
        };
        this.ws.send(JSON.stringify(response));
    }

    /**
     * Schedule reconnection attempt
     */
    scheduleReconnect() {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        
        logger.info('STREAMER', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(error => {
                logger.error('STREAMER', 'Reconnection failed', error);
            });
        }, delay);
    }

    /**
     * Get current account snapshot
     */
    getSnapshot() {
        return {
            ...this.accountData,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get balance history
     */
    getBalanceHistory(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.history.balances.filter(b => 
            new Date(b.timestamp) > cutoff
        );
    }

    /**
     * Get P&L history
     */
    getPnLHistory(days = 30) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        return this.history.pnl.filter(p => 
            new Date(p.date) > cutoff
        );
    }

    /**
     * Export account data to JSON
     */
    async exportToJSON(filepath) {
        const fs = require('fs').promises;
        const data = {
            snapshot: this.getSnapshot(),
            history: {
                balances: this.getBalanceHistory(24 * 7), // Last week
                pnl: this.getPnLHistory(30), // Last month
                recentTrades: this.history.trades.slice(-100) // Last 100 trades
            },
            exported: new Date().toISOString()
        };

        await fs.writeFile(filepath, JSON.stringify(data, null, 2));
        logger.info('STREAMER', `Account data exported to ${filepath}`);
    }

    /**
     * Disconnect streamer
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        logger.info('STREAMER', 'Disconnected from account stream');
    }
}

module.exports = AccountStreamer;