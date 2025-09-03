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
        
        // Account data cache
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