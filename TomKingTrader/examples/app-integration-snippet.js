/**
 * App.js Integration Snippet for WebSocket Streaming
 * This code shows how to integrate the MarketDataStreamer into the existing app.js
 * 
 * Add this to your TomKingTraderApp class constructor:
 */

// Add to constructor after existing module initialization
const TastyTradeAPI = require('./tastytradeAPI');
const MarketDataStreamer = require('./marketDataStreamer');

// In the constructor, add these properties:
this.api = null;
this.streamer = null;
this.streamingEnabled = false;
this.marketDataCache = new Map();
this.subscribedSymbols = new Set();

/**
 * Add this method to initialize streaming
 */
async initializeStreaming() {
    try {
        logger.info('APP', '📡 Initializing WebSocket market data streaming...');
        
        // Initialize TastyTrade API if not already done
        if (!this.api) {
            this.api = new TastyTradeAPI();
            await this.api.authenticate();
        }
        
        // Initialize market data streamer
        this.streamer = new MarketDataStreamer(this.api);
        
        // Set up event listeners
        this.setupStreamingEventListeners();
        
        // Connect to streaming
        const connected = await this.streamer.initialize();
        
        if (connected) {
            this.streamingEnabled = true;
            logger.info('APP', '✅ WebSocket streaming enabled');
            
            // Subscribe to default symbols
            const defaultSymbols = ['SPY', 'QQQ', 'VIX', '/ES', '/NQ'];
            await this.subscribeToSymbols(defaultSymbols);
            
            return true;
        } else {
            logger.warn('APP', '⚠️ WebSocket streaming failed to initialize');
            return false;
        }
        
    } catch (error) {
        logger.error('APP', '🚨 Failed to initialize streaming', error);
        this.streamingEnabled = false;
        return false;
    }
}

/**
 * Set up streaming event listeners
 */
setupStreamingEventListeners() {
    // Connection events
    this.streamer.on('connected', (data) => {
        logger.info('APP', '🔗 Market data streaming connected', data);
        this.streamingEnabled = true;
        this.broadcastToClients({
            type: 'streaming_status',
            data: { connected: true, endpoint: data.endpoint }
        });
    });
    
    this.streamer.on('disconnected', (data) => {
        logger.warn('APP', '🔌 Market data streaming disconnected', data);
        this.broadcastToClients({
            type: 'streaming_status',
            data: { connected: false, reason: data.reason }
        });
    });
    
    this.streamer.on('failed', (data) => {
        logger.error('APP', '🚨 Market data streaming failed permanently', data);
        this.streamingEnabled = false;
        this.broadcastToClients({
            type: 'streaming_error',
            data: { error: data.error, attempts: data.attempts }
        });
    });
    
    // Market data events
    this.streamer.on('quotes', (data) => {
        this.handleRealTimeMarketData(data);
    });
}

/**
 * Handle real-time market data updates
 */
handleRealTimeMarketData(data) {
    const { updates, timestamp } = data;
    
    // Update cache
    Object.entries(updates).forEach(([symbol, quote]) => {
        this.marketDataCache.set(symbol, {
            ...quote,
            lastUpdate: timestamp
        });
    });
    
    // Broadcast to connected WebSocket clients
    this.broadcastToClients({
        type: 'market_data',
        data: {
            updates,
            timestamp: timestamp.toISOString(),
            source: 'websocket'
        }
    });
    
    // Trigger signal analysis if enabled
    if (this.signalGenerator) {
        Object.entries(updates).forEach(([symbol, quote]) => {
            this.signalGenerator.processRealTimeData(symbol, quote);
        });
    }
    
    logger.trace('APP', `📊 Processed real-time data for ${Object.keys(updates).length} symbols`);
}

/**
 * Subscribe to market data for symbols
 */
async subscribeToSymbols(symbols) {
    if (!this.streamingEnabled || !this.streamer) {
        logger.warn('APP', 'Cannot subscribe - streaming not enabled');
        return false;
    }
    
    try {
        const success = await this.streamer.subscribeToQuotes(symbols);
        
        if (success) {
            symbols.forEach(symbol => this.subscribedSymbols.add(symbol));
            logger.info('APP', `📡 Subscribed to ${symbols.length} symbols`, symbols);
        }
        
        return success;
    } catch (error) {
        logger.error('APP', '🚨 Failed to subscribe to symbols', error);
        return false;
    }
}

/**
 * Unsubscribe from market data for symbols
 */
async unsubscribeFromSymbols(symbols) {
    if (!this.streamingEnabled || !this.streamer) {
        return false;
    }
    
    try {
        const success = await this.streamer.unsubscribeFromQuotes(symbols);
        
        if (success) {
            symbols.forEach(symbol => {
                this.subscribedSymbols.delete(symbol);
                this.marketDataCache.delete(symbol);
            });
            logger.info('APP', `📡 Unsubscribed from ${symbols.length} symbols`, symbols);
        }
        
        return success;
    } catch (error) {
        logger.error('APP', '🚨 Failed to unsubscribe from symbols', error);
        return false;
    }
}

/**
 * Get cached market data
 */
getCachedMarketData(symbols = null) {
    if (!symbols) {
        // Return all cached data
        const result = {};
        this.marketDataCache.forEach((data, symbol) => {
            result[symbol] = data;
        });
        return result;
    }
    
    // Return specific symbols
    const result = {};
    symbols.forEach(symbol => {
        const data = this.marketDataCache.get(symbol);
        if (data) {
            result[symbol] = data;
        }
    });
    
    return result;
}

/**
 * Broadcast message to all connected WebSocket clients
 */
broadcastToClients(message) {
    const messageStr = JSON.stringify(message);
    
    this.wsConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(messageStr);
            } catch (error) {
                logger.error('APP', 'Failed to send message to WebSocket client', error);
            }
        }
    });
}

/**
 * Add these REST API endpoints to your existing routes:
 */

// Get streaming status
app.get('/api/streaming/status', (req, res) => {
    const status = this.streamer ? this.streamer.getStatus() : null;
    
    res.json({
        success: true,
        data: {
            enabled: this.streamingEnabled,
            connected: status?.connected || false,
            subscriptions: status?.subscriptions || 0,
            quotesReceived: status?.quotesReceived || 0,
            lastUpdate: status?.lastUpdate || null,
            subscribedSymbols: Array.from(this.subscribedSymbols)
        }
    });
});

// Subscribe to symbols
app.post('/api/streaming/subscribe', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                error: 'symbols array is required'
            });
        }
        
        const success = await this.subscribeToSymbols(symbols);
        
        res.json({
            success,
            data: {
                subscribed: success ? symbols : [],
                totalSubscriptions: this.subscribedSymbols.size
            }
        });
        
    } catch (error) {
        logger.error('APP', 'Subscribe endpoint error', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Unsubscribe from symbols
app.post('/api/streaming/unsubscribe', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                error: 'symbols array is required'
            });
        }
        
        const success = await this.unsubscribeFromSymbols(symbols);
        
        res.json({
            success,
            data: {
                unsubscribed: success ? symbols : [],
                totalSubscriptions: this.subscribedSymbols.size
            }
        });
        
    } catch (error) {
        logger.error('APP', 'Unsubscribe endpoint error', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get cached market data
app.get('/api/streaming/data', (req, res) => {
    try {
        const { symbols } = req.query;
        const requestedSymbols = symbols ? symbols.split(',') : null;
        
        const data = this.getCachedMarketData(requestedSymbols);
        
        res.json({
            success: true,
            data: {
                quotes: data,
                count: Object.keys(data).length,
                timestamp: new Date().toISOString(),
                source: this.streamingEnabled ? 'websocket' : 'polling'
            }
        });
        
    } catch (error) {
        logger.error('APP', 'Market data endpoint error', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Add this to your server initialization:
 */
async start() {
    try {
        // Initialize existing modules...
        
        // Initialize streaming (add this after existing initialization)
        await this.initializeStreaming();
        
        // Start HTTP server
        this.server.listen(this.config.port, () => {
            logger.info('APP', `🚀 TomKingTrader server started on port ${this.config.port}`);
            logger.info('APP', `📡 WebSocket server running on port ${this.config.wsPort}`);
            logger.info('APP', `🔗 Streaming enabled: ${this.streamingEnabled}`);
        });
        
    } catch (error) {
        logger.error('APP', '🚨 Failed to start server', error);
        throw error;
    }
}

/**
 * Add this to your graceful shutdown:
 */
async stop() {
    try {
        logger.info('APP', '🛑 Shutting down TomKingTrader...');
        
        // Disconnect streaming
        if (this.streamer) {
            await this.streamer.disconnect();
        }
        
        // Close WebSocket connections
        this.wsConnections.forEach(ws => {
            try {
                ws.close();
            } catch (error) {
                // Ignore errors during shutdown
            }
        });
        
        // Close servers
        if (this.wss) {
            this.wss.close();
        }
        
        if (this.server) {
            this.server.close();
        }
        
        logger.info('APP', '✅ TomKingTrader shutdown complete');
        
    } catch (error) {
        logger.error('APP', '🚨 Error during shutdown', error);
    }
}