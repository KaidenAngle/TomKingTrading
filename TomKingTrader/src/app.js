/**
 * TomKingTrader Main Application Server
 * Express.js server with WebSocket support for real-time trading dashboard
 * Integrates all modules and provides REST API endpoints
 */

require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;

// Import TomKingTrader modules
const { TomKingTrader, TomKingUtils } = require('./index');
const SignalGenerator = require('./signalGenerator');
const GreeksCalculator = require('./greeksCalculator');
const { getLogger } = require('./logger');
const config = require('./config');

// Import new unified trading system
const { UnifiedTradingSystem } = require('./tradingSystemIntegration');

// Import backtesting modules
const BacktestingEngine = require('./backtestingEngine');
const DataManager = require('./dataManager');
const PerformanceMetrics = require('./performanceMetrics');
const PatternValidationEngine = require('./patternValidation');
const BacktestReportGenerator = require('./backtestReporting');

const logger = getLogger();

class TomKingTraderApp {
    constructor(options = {}) {
        this.config = {
            port: options.port || process.env.PORT || 3000,
            wsPort: options.wsPort || process.env.WS_PORT || 3001,
            environment: options.environment || 'production',
            enableScheduler: options.enableScheduler !== false,
            logLevel: options.logLevel || 'info',
            ...options
        };
        
        // Initialize Express app
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Initialize WebSocket server
        this.wss = new WebSocket.Server({ port: this.config.wsPort });
        this.wsConnections = new Set();
        
        // Initialize core modules
        this.trader = null;
        this.greeksCalculator = null;
        this.signalGenerator = new SignalGenerator({
            enableRealTime: true,
            signalCooldown: 300000, // 5 minutes
            maxSignalsPerHour: 20
        });
        
        // Initialize unified trading system
        this.unifiedSystem = new UnifiedTradingSystem({
            startingBalance: 35000,
            goalBalance: 80000,
            targetBPUsage: 35,
            enableRealTimeUpdates: true,
            dashboardUpdateInterval: 30000
        });
        
        // Application state
        this.isInitialized = false;
        this.currentAnalysis = null;
        this.lastAnalysisTime = null;
        this.schedulerInterval = null;
        
        // Setup middleware and routes
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupScheduler();
        
        // Bind signal generator events
        this.signalGenerator.on('signal', (signal) => {
            this.broadcastSignal(signal);
        });
        
        logger.info('APP', 'TomKingTrader Application initialized');
    }
    
    /**
     * Setup Greeks integration event handlers
     */
    setupGreeksEventHandlers() {
        if (!this.greeksCalculator) return;
        
        // Portfolio Greeks updates
        this.greeksCalculator.on('greeksUpdated', (data) => {
            this.broadcast({
                type: 'greeks_updated',
                data: data
            });
        });
        
        // Real-time Greeks updates
        this.greeksCalculator.on('realTimeGreeksUpdate', (data) => {
            this.broadcast({
                type: 'real_time_greeks',
                data: data
            });
        });
        
        // Greeks alerts
        this.greeksCalculator.on('greeksAlerts', (data) => {
            this.broadcast({
                type: 'greeks_alerts',
                data: data
            });
        });
        
        // Tom King specific Greeks analysis
        this.greeksCalculator.on('tomKingGreeksAnalysis', (data) => {
            this.broadcast({
                type: 'tom_king_greeks_analysis',
                data: data
            });
        });
        
        logger.debug('APP', 'Greeks event handlers setup complete');
    }
    
    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Static files
        this.app.use(express.static(path.join(__dirname, '..', 'public')));
        
        // Request logging
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            // Reduce HTTP request logging - only log non-static requests
            if (!req.url.includes('/static/') && !req.url.includes('.css') && !req.url.includes('.js') && !req.url.includes('.png')) {
                logger.debug('HTTP', `${req.method} ${req.url}`);
            }
            next();
        });
        
        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('🚨 Express Error:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    /**
     * Setup API routes
     */
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                initialized: this.isInitialized,
                mode: this.trader ? this.trader.getStatus().mode : 'UNINITIALIZED',
                uptime: process.uptime()
            });
        });
        
        // Initialize system
        this.app.post('/api/initialize', async (req, res) => {
            try {
                const { apiMode, phase, accountValue, credentials } = req.body;
                
                // Use credentials from environment variables if available
                const apiCredentials = {
                    clientSecret: process.env.TASTYTRADE_CLIENT_SECRET || credentials?.clientSecret,
                    refreshToken: process.env.TASTYTRADE_REFRESH_TOKEN || credentials?.refreshToken
                };
                
                logger.debug('API', 'Credentials check', {
                    clientSecret: apiCredentials.clientSecret ? 'Present' : 'Missing',
                    refreshToken: apiCredentials.refreshToken ? 'Present' : 'Missing',
                    apiMode: apiMode || 'auto-detect'
                });
                
                // Auto-enable API mode if credentials are present
                const useApiMode = apiMode !== false && (apiCredentials.clientSecret && apiCredentials.refreshToken);
                
                this.trader = new TomKingTrader({
                    apiMode: useApiMode,
                    phase: phase || 1,
                    accountValue: accountValue || 30000,
                    environment: this.config.environment,
                    clientSecret: apiCredentials.clientSecret,
                    refreshToken: apiCredentials.refreshToken
                });
                
                const result = await this.trader.initialize();
                this.isInitialized = true;
                
                // Initialize Greeks integration if API mode is enabled
                if (useApiMode && this.trader.api) {
                    try {
                        this.greeksCalculator = new GreeksCalculator(this.trader.api, {
                            enableRealTimeUpdates: true,
                            updateInterval: 30000
                        });
                        await this.greeksCalculator.initialize();
                        
                        // Setup Greeks event handlers
                        this.setupGreeksEventHandlers();
                        
                        logger.info('APP', 'Greeks integration enabled');
                    } catch (error) {
                        logger.error('APP', 'Greeks integration failed', error);
                        // Continue without Greeks - not critical for basic operation
                    }
                }
                
                // Note: SignalGenerator will receive data when generateSignals is called
                // No need to update separately as it accepts data as parameters
                
                // Broadcast system status
                this.broadcast({
                    type: 'system_status',
                    data: { initialized: true, ...result }
                });
                
                res.json({
                    success: true,
                    result,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('🚨 Initialize error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Run analysis
        this.app.post('/api/analyze', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }
                
                const inputData = req.body;
                
                // Update trader with any manual data
                if (inputData.marketData) {
                    this.trader.marketData = inputData.marketData;
                }
                
                if (inputData.positions) {
                    await this.trader.updatePositions(inputData.positions);
                }
                
                // Run comprehensive analysis
                const analysis = await this.trader.runAnalysis(inputData);
                this.currentAnalysis = analysis;
                this.lastAnalysisTime = new Date();
                
                // Generate signals with market data and account data
                const signals = await this.signalGenerator.generateSignals(
                    this.trader.marketData,
                    {
                        vixLevel: inputData.vixLevel || analysis.vixLevel,
                        phase: inputData.phase || analysis.phase,
                        accountValue: inputData.accountValue || analysis.accountValue,
                        positions: this.trader.positions
                    }
                );
                
                const result = {
                    analysis,
                    signals: signals.signals,
                    signalSummary: signals.summary,
                    timestamp: new Date().toISOString()
                };
                
                // Broadcast analysis results
                this.broadcast({
                    type: 'analysis_complete',
                    data: result
                });
                
                res.json({
                    success: true,
                    ...result
                });
                
            } catch (error) {
                console.error('🚨 Analysis error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Get current status
        this.app.get('/api/status', (req, res) => {
            const status = {
                system: this.isInitialized ? this.trader.getStatus() : { initialized: false },
                signals: this.signalGenerator.getSignalReport().summary,
                connections: this.wsConnections.size,
                lastAnalysis: this.lastAnalysisTime,
                scheduler: {
                    enabled: this.config.enableScheduler,
                    running: !!this.schedulerInterval
                },
                timestamp: new Date().toISOString()
            };
            
            res.json(status);
        });
        
        // Get active signals
        this.app.get('/api/signals', (req, res) => {
            try {
                const signals = this.signalGenerator.signals || [];
                const report = this.signalGenerator.getSignalReport();
                
                res.json({
                    success: true,
                    signals,
                    count: signals.length,
                    stats: report.summary,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Signals error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Manual data input endpoints
        this.app.post('/api/market-data', async (req, res) => {
            try {
                const { marketData } = req.body;
                
                if (this.trader) {
                    this.trader.marketData = marketData;
                }
                
                this.broadcast({
                    type: 'market_data_updated',
                    data: { timestamp: new Date().toISOString() }
                });
                
                res.json({
                    success: true,
                    message: 'Market data updated',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('🚨 Market data error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        this.app.post('/api/positions', async (req, res) => {
            try {
                const { positions } = req.body;
                
                if (this.trader) {
                    await this.trader.updatePositions(positions);
                }
                
                this.broadcast({
                    type: 'positions_updated',
                    data: { count: positions.length, timestamp: new Date().toISOString() }
                });
                
                res.json({
                    success: true,
                    message: 'Positions updated',
                    count: positions.length,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('🚨 Positions error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Generate report
        this.app.post('/api/report', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized'
                    });
                }
                
                const report = await this.trader.generateReport(req.body);
                
                res.json({
                    success: true,
                    report,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('🚨 Report error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Configuration endpoints
        this.app.get('/api/config', (req, res) => {
            res.json({
                phases: config.PHASES,
                strategies: config.STRATEGIES,
                riskLimits: config.RISK_LIMITS,
                correlationGroups: config.CORRELATION_GROUPS
            });
        });
        
        // Test API connection
        this.app.post('/api/test-connection', async (req, res) => {
            try {
                const result = await this.trader?.testConnection() || { success: false, message: 'No trader instance' };
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // GREEKS API ENDPOINTS
        
        // Get portfolio Greeks
        this.app.get('/api/greeks/portfolio', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const portfolioGreeks = this.greeksCalculator.getPortfolioGreeks();
                
                res.json({
                    success: true,
                    portfolioGreeks: portfolioGreeks,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Portfolio Greeks error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get Greeks for specific option
        this.app.post('/api/greeks/option', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const { symbol, strike, expiration, optionType } = req.body;
                
                if (!symbol || !strike || !expiration || !optionType) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: symbol, strike, expiration, optionType',
                        timestamp: new Date().toISOString()
                    });
                }

                const greeks = await this.greeksCalculator.fetchRealGreeks(symbol, strike, expiration, optionType);
                
                res.json({
                    success: true,
                    greeks: greeks,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Option Greeks error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Calculate 5-delta strikes for Tom King strangles
        this.app.post('/api/greeks/5-delta-strikes', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const { symbol, expiration, targetDelta = 0.05 } = req.body;
                
                if (!symbol || !expiration) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: symbol, expiration',
                        timestamp: new Date().toISOString()
                    });
                }

                const strikes = await this.greeksCalculator.calculateOptimalStrangleStrikes(symbol, expiration);
                
                res.json({
                    success: true,
                    strikes: strikes,
                    targetDelta: targetDelta,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 5-Delta strikes error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Force Greeks update
        this.app.post('/api/greeks/update', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const result = await this.greeksCalculator.forceGreeksUpdate();
                
                res.json({
                    success: true,
                    message: 'Greeks update completed',
                    result: result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Greeks update error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get Greeks history
        this.app.get('/api/greeks/history', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const limit = parseInt(req.query.limit) || 50;
                const history = this.greeksCalculator.getGreeksHistory(limit);
                
                res.json({
                    success: true,
                    history: history,
                    count: history.length,
                    limit: limit,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Greeks history error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get current Greeks alerts
        this.app.get('/api/greeks/alerts', async (req, res) => {
            try {
                if (!this.greeksCalculator) {
                    return res.status(400).json({
                        success: false,
                        error: 'Greeks integration not available. Ensure API mode is enabled.',
                        timestamp: new Date().toISOString()
                    });
                }

                const alerts = this.greeksCalculator.getCurrentAlerts();
                
                res.json({
                    success: true,
                    alerts: alerts,
                    count: alerts.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Greeks alerts error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get Greeks status and configuration
        this.app.get('/api/greeks/status', async (req, res) => {
            try {
                const status = {
                    available: !!this.greeksCalculator,
                    initialized: !!this.greeksCalculator,
                    realTimeEnabled: this.greeksCalculator ? this.greeksCalculator.config.enableRealTimeUpdates : false,
                    lastUpdate: this.greeksCalculator ? this.greeksCalculator.lastGreeksUpdate : null,
                    alertsCount: this.greeksCalculator ? this.greeksCalculator.getCurrentAlerts().length : 0,
                    features: {
                        portfolioGreeks: true,
                        realTimeUpdates: !!this.greeksCalculator,
                        fiveDeltaCalculation: !!this.greeksCalculator,
                        zdteMonitoring: !!this.greeksCalculator,
                        lt112Analysis: !!this.greeksCalculator,
                        riskIntegration: !!this.greeksCalculator
                    }
                };
                
                res.json({
                    success: true,
                    status: status,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Greeks status error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Health check endpoint - comprehensive system health status
        this.app.get('/api/health', (req, res) => {
            try {
                const stats = this.getStats();
                
                res.json({
                    status: 'OK',
                    version: '17.0',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    system: {
                        initialized: this.isInitialized,
                        mode: this.trader ? this.trader.getStatus().mode : 'UNINITIALIZED',
                        environment: this.config.environment,
                        phase: this.config.phase || 1,
                        connections: this.wsConnections.size,
                        scheduler: {
                            enabled: this.config.enableScheduler,
                            running: !!this.schedulerInterval
                        }
                    },
                    health: {
                        api: this.trader?.api ? 'CONNECTED' : 'DISCONNECTED',
                        fallback: this.trader?.fallbackMode || false,
                        errors: this.errorCount || 0,
                        lastAnalysis: this.lastAnalysisTime,
                        memory: process.memoryUsage()
                    },
                    features: {
                        patternAnalysis: true,
                        riskManagement: true,
                        positionTracking: true,
                        signalGeneration: true,
                        webSocket: this.wsConnections.size > 0,
                        scheduler: this.config.enableScheduler
                    }
                });
            } catch (error) {
                console.error('🚨 Health check error:', error);
                res.status(500).json({
                    status: 'ERROR',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Enable real-time streaming endpoint
        this.app.post('/api/streaming/enable', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const result = await this.trader.api.enableStreaming();
                
                res.json({
                    success: result,
                    message: result ? 'Real-time streaming enabled' : 'Failed to enable streaming',
                    status: this.trader.api.getStreamingStatus(),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Streaming enable error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Disable real-time streaming endpoint
        this.app.post('/api/streaming/disable', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const result = await this.trader.api.disableStreaming();
                
                res.json({
                    success: result,
                    message: result ? 'Real-time streaming disabled' : 'Failed to disable streaming',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Streaming disable error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Subscribe to real-time quotes endpoint
        this.app.post('/api/streaming/subscribe', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { symbols } = req.body;
                
                if (!symbols || (!Array.isArray(symbols) && typeof symbols !== 'string')) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing or invalid symbols parameter'
                    });
                }

                const result = await this.trader.api.subscribeToQuotes(symbols);
                
                res.json({
                    success: result,
                    message: result ? `Subscribed to ${Array.isArray(symbols) ? symbols.length : 1} symbols` : 'Failed to subscribe',
                    symbols: Array.isArray(symbols) ? symbols : [symbols],
                    status: this.trader.api.getStreamingStatus(),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Streaming subscribe error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get real-time quotes endpoint
        this.app.post('/api/quotes/realtime', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { symbols } = req.body;
                
                if (!symbols) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing symbols parameter'
                    });
                }

                const quotes = this.trader.api.getRealtimeQuotes(symbols);
                
                res.json({
                    success: true,
                    quotes,
                    count: Object.keys(quotes).length,
                    streamingStatus: this.trader.api.getStreamingStatus(),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Real-time quotes error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get streaming status endpoint
        this.app.get('/api/streaming/status', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const status = this.trader.api.getStreamingStatus();
                
                res.json({
                    success: true,
                    status,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Streaming status error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // ORDER PLACEMENT ENDPOINTS
        
        // Dry-run order endpoint
        this.app.post('/api/orders/dry-run', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { order } = req.body;
                
                if (!order) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing order parameter'
                    });
                }

                const result = await this.trader.api.orderManager.dryRun(order);
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Dry-run order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Place live order endpoint
        this.app.post('/api/orders/place', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { order } = req.body;
                
                if (!order) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing order parameter'
                    });
                }

                const result = await this.trader.api.orderManager.placeOrder(order);
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Place order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // TOM KING STRATEGY ENDPOINTS

        // Iron Condor
        this.app.post('/api/strategies/iron-condor', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { underlying, expiration, strikes, netCredit, quantity } = req.body;
                
                if (!underlying || !expiration || !strikes || !netCredit) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: underlying, expiration, strikes, netCredit'
                    });
                }

                const expirationDate = new Date(expiration);
                const result = await this.trader.api.orderManager.placeIronCondor(
                    underlying, 
                    expirationDate, 
                    strikes, 
                    netCredit, 
                    quantity || 1
                );
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Iron Condor order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Short Strangle
        this.app.post('/api/strategies/short-strangle', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { underlying, expiration, putStrike, callStrike, netCredit, quantity } = req.body;
                
                if (!underlying || !expiration || !putStrike || !callStrike || !netCredit) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: underlying, expiration, putStrike, callStrike, netCredit'
                    });
                }

                const expirationDate = new Date(expiration);
                const result = await this.trader.api.orderManager.placeShortStrangle(
                    underlying, 
                    expirationDate, 
                    putStrike, 
                    callStrike, 
                    netCredit, 
                    quantity || 1
                );
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Short Strangle order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 0DTE Strategy
        this.app.post('/api/strategies/0dte', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { underlying, expiration, strike, optionType, premium, quantity } = req.body;
                
                if (!underlying || !expiration || !strike || !optionType || !premium) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: underlying, expiration, strike, optionType, premium'
                    });
                }

                const expirationDate = new Date(expiration);
                const result = await this.trader.api.orderManager.place0DTE(
                    underlying, 
                    expirationDate, 
                    strike, 
                    optionType, 
                    premium, 
                    quantity || 1
                );
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 0DTE order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Butterfly
        this.app.post('/api/strategies/butterfly', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { underlying, expiration, strikes, netDebit, quantity } = req.body;
                
                if (!underlying || !expiration || !strikes || !netDebit) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: underlying, expiration, strikes, netDebit'
                    });
                }

                const expirationDate = new Date(expiration);
                const result = await this.trader.api.orderManager.placeButterfly(
                    underlying, 
                    expirationDate, 
                    strikes, 
                    netDebit, 
                    quantity || 1
                );
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Butterfly order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // ORDER MANAGEMENT ENDPOINTS

        // Get live orders
        this.app.get('/api/orders/live', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const orders = await this.trader.api.orderManager.getLiveOrders();
                
                res.json({
                    success: true,
                    orders,
                    count: orders.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Get live orders error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get order status
        this.app.get('/api/orders/:orderId', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { orderId } = req.params;
                const order = await this.trader.api.orderManager.getOrderStatus(orderId);
                
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        error: 'Order not found'
                    });
                }
                
                res.json({
                    success: true,
                    order,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Get order status error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Cancel order
        this.app.delete('/api/orders/:orderId', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { orderId } = req.params;
                const result = await this.trader.api.orderManager.cancelOrder(orderId);
                
                res.json({
                    success: result.success,
                    result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Cancel order error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get order statistics
        this.app.get('/api/orders/stats', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const stats = this.trader.api.orderManager.getStatistics();
                
                res.json({
                    success: true,
                    stats,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Get order stats error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Strategy analysis endpoint - analyze specific trading strategy
        this.app.post('/api/strategy/analyze', async (req, res) => {
            try {
                if (!this.isInitialized) {
                    return res.status(400).json({
                        success: false,
                        error: 'System not initialized. Call /api/initialize first.'
                    });
                }

                const { strategy, symbol, dte, iv, ivRank, ivPercentile, vix, dayOfWeek, currentTime } = req.body;

                // Validate required fields
                if (!strategy || !symbol) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: strategy and symbol are required'
                    });
                }

                // Create market data structure for the specific symbol
                const marketData = {
                    [symbol]: {
                        symbol,
                        iv: iv || 20,
                        ivRank: ivRank || 50,
                        ivPercentile: ivPercentile || 50,
                        dte: dte || 30,
                        current: 100, // Default price for analysis
                        bid: 99.95,
                        ask: 100.05
                    }
                };

                // Add VIX data if provided
                if (vix) {
                    marketData.VIX = { current: vix, currentLevel: vix };
                }

                // Analyze the strategy using pattern analyzer
                let analysis = {};
                
                if (this.trader.patternAnalyzer) {
                    analysis = this.trader.patternAnalyzer.analyzePattern(
                        symbol,
                        marketData[symbol],
                        this.config.phase || 1
                    );
                }

                // Strategy-specific recommendations
                let recommendation = 'ANALYZE';
                let details = '';
                let score = 50;

                switch (strategy.toUpperCase()) {
                    case '0DTE':
                        if (dayOfWeek === 5 && currentTime && currentTime >= '10:30') {
                            recommendation = vix < 20 ? 'ENTER' : 'AVOID_HIGH_VIX';
                            details = vix < 20 ? '0DTE conditions favorable' : 'VIX too high for 0DTE';
                            score = vix < 20 ? 75 : 25;
                        } else {
                            recommendation = 'INVALID_TIME';
                            details = '0DTE only allowed on Fridays after 10:30 AM';
                            score = 0;
                        }
                        break;
                    
                    case 'LT112':
                        recommendation = (iv && iv > 15) ? 'ENTER' : 'WAIT_IV';
                        details = (iv && iv > 15) ? 'Long-term IV suitable' : 'Wait for higher IV';
                        score = (iv && iv > 15) ? Math.min(80, iv * 3) : 30;
                        break;
                    
                    case 'STRANGLE':
                        if (dte >= 45 && iv && iv > 18) {
                            recommendation = 'ENTER';
                            details = `${dte}DTE strangle with ${iv}% IV`;
                            score = Math.min(85, (iv - 10) * 4 + (dte > 60 ? 20 : 10));
                        } else {
                            recommendation = 'WAIT_CONDITIONS';
                            details = 'Need DTE >= 45 and IV > 18%';
                            score = 35;
                        }
                        break;
                    
                    default:
                        recommendation = 'ANALYZE';
                        details = `Strategy ${strategy} analyzed`;
                        score = analysis.score || 50;
                }

                const result = {
                    success: true,
                    strategy: strategy.toUpperCase(),
                    symbol,
                    recommendation,
                    details,
                    score,
                    analysis: {
                        iv: iv || marketData[symbol].iv,
                        dte: dte || marketData[symbol].dte,
                        conditions: {
                            ivSuitable: iv > 15,
                            dteSuitable: dte >= 30,
                            timingSuitable: strategy === '0DTE' ? (dayOfWeek === 5 && currentTime >= '10:30') : true
                        }
                    },
                    timestamp: new Date().toISOString()
                };

                res.json(result);

            } catch (error) {
                console.error('🚨 Strategy analysis error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Risk management check endpoint
        this.app.post('/api/risk/check', async (req, res) => {
            try {
                const { currentPositions = [], newPosition, accountValue } = req.body;

                if (!newPosition) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required field: newPosition'
                    });
                }

                const account = accountValue || this.config.accountValue || 30000;
                
                // Initialize position manager with current positions
                if (this.trader?.positionManager) {
                    this.trader.positionManager.updatePositions(currentPositions);
                }

                // Check if we can add the new position
                const canAdd = this.trader?.positionManager?.canAddPosition(
                    newPosition.symbol,
                    this.config.phase || 1
                ) || { allowed: true, reason: 'Default approval' };

                // Calculate BP usage
                const currentBPUsed = currentPositions.reduce((sum, pos) => sum + (pos.bpUsed || 0), 0);
                const newBPRequired = newPosition.bpRequired || 0;
                const totalBP = currentBPUsed + newBPRequired;
                const bpPercentage = (totalBP / account) * 100;

                // Check correlation limits
                const correlationGroup = newPosition.correlationGroup;
                const sameGroupPositions = currentPositions.filter(pos => 
                    pos.correlationGroup === correlationGroup
                ).length;

                // Risk assessment
                let allowed = true;
                let reason = 'Position approved';
                let warnings = [];

                // BP limit check (35% max)
                if (bpPercentage > 35) {
                    allowed = false;
                    reason = `BP limit exceeded: ${bpPercentage.toFixed(1)}% > 35%`;
                }

                // Correlation limit check (3 max per group)
                if (sameGroupPositions >= 3) {
                    allowed = false;
                    reason = `Correlation limit exceeded: ${sameGroupPositions + 1} positions in ${correlationGroup} group (max 3)`;
                }

                // Single position BP check (8% max)
                const singlePositionBP = (newBPRequired / account) * 100;
                if (singlePositionBP > 8) {
                    allowed = false;
                    reason = `Single position BP too high: ${singlePositionBP.toFixed(1)}% > 8%`;
                }

                // Warnings
                if (bpPercentage > 25) {
                    warnings.push(`High BP usage: ${bpPercentage.toFixed(1)}%`);
                }
                if (sameGroupPositions >= 2) {
                    warnings.push(`High correlation exposure in ${correlationGroup}`);
                }

                const result = {
                    success: true,
                    allowed,
                    reason,
                    warnings,
                    analysis: {
                        bpAnalysis: {
                            currentUsed: currentBPUsed,
                            newRequired: newBPRequired,
                            total: totalBP,
                            percentage: bpPercentage,
                            limit: 35,
                            withinLimit: bpPercentage <= 35
                        },
                        correlationAnalysis: {
                            group: correlationGroup,
                            currentCount: sameGroupPositions,
                            newCount: sameGroupPositions + 1,
                            limit: 3,
                            withinLimit: sameGroupPositions < 3
                        },
                        accountMetrics: {
                            accountValue: account,
                            phase: this.config.phase || 1,
                            maxSinglePositionBP: 8
                        }
                    },
                    timestamp: new Date().toISOString()
                };

                res.json(result);

            } catch (error) {
                console.error('🚨 Risk check error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Position calculation endpoint
        this.app.post('/api/position/calculate', async (req, res) => {
            try {
                const { symbol, strategy, accountValue, price, strikes } = req.body;

                if (!symbol || !strategy) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: symbol and strategy are required'
                    });
                }

                const account = accountValue || this.config.accountValue || 30000;
                const phase = this.config.phase || 1;
                
                // Calculate position size using TomKingUtils
                const { TomKingUtils } = require('./index');
                const positionSize = TomKingUtils.calculatePositionSize(account, strategy, phase);

                // Strategy-specific calculations
                let contracts = 1;
                let maxRisk = 0;
                let bpRequired = 0;
                let expectedReturn = 0;
                let breakevens = [];

                switch (strategy.toUpperCase()) {
                    case 'STRANGLE':
                        contracts = Math.floor(positionSize / 2500); // £2500 per strangle
                        bpRequired = contracts * 2500;
                        maxRisk = bpRequired * 0.5; // 50% max loss
                        expectedReturn = bpRequired * 0.02; // 2% monthly target
                        if (price && strikes) {
                            breakevens = [strikes.put - (strikes.call - strikes.put) * 0.1, strikes.call + (strikes.call - strikes.put) * 0.1];
                        }
                        break;
                    
                    case 'LT112':
                        contracts = Math.floor(positionSize / 6000); // £6000 per LT112
                        bpRequired = contracts * 6000;
                        maxRisk = bpRequired * 0.5;
                        expectedReturn = bpRequired * 0.025; // 2.5% monthly target
                        break;
                    
                    case '0DTE':
                        contracts = Math.floor(positionSize / 2000); // £2000 per 0DTE
                        bpRequired = contracts * 2000;
                        maxRisk = bpRequired * 0.3; // 30% max loss
                        expectedReturn = bpRequired * 0.05; // 5% daily target
                        break;
                    
                    case 'BUTTERFLY':
                        contracts = Math.floor(positionSize / 500); // £500 per butterfly
                        bpRequired = contracts * 500;
                        maxRisk = bpRequired; // Risk is premium paid
                        expectedReturn = bpRequired * 2; // 200% target return
                        break;
                    
                    default:
                        contracts = Math.floor(positionSize / 3000);
                        bpRequired = contracts * 3000;
                        maxRisk = bpRequired * 0.5;
                        expectedReturn = bpRequired * 0.02;
                }

                // Risk metrics
                const bpPercentage = (bpRequired / account) * 100;
                const riskPercentage = (maxRisk / account) * 100;

                const result = {
                    success: true,
                    symbol,
                    strategy: strategy.toUpperCase(),
                    calculation: {
                        contracts: Math.max(1, contracts),
                        bpRequired: Math.round(bpRequired),
                        maxRisk: Math.round(maxRisk),
                        expectedReturn: Math.round(expectedReturn),
                        breakevens,
                        bpPercentage: parseFloat(bpPercentage.toFixed(2)),
                        riskPercentage: parseFloat(riskPercentage.toFixed(2))
                    },
                    account: {
                        value: account,
                        phase,
                        currency: 'GBP'
                    },
                    validation: {
                        bpWithinLimits: bpPercentage <= 35,
                        riskAcceptable: riskPercentage <= 5,
                        contractsReasonable: contracts >= 1 && contracts <= 10
                    },
                    recommendations: {
                        adjustContracts: contracts === 0 ? 'Increase account size or reduce strategy allocation' : 
                                       contracts > 5 ? 'Consider reducing position size for better risk management' : 
                                       'Position size appears reasonable',
                        riskManagement: riskPercentage > 5 ? 'Consider smaller position - exceeds 5% account risk' :
                                      'Risk level acceptable for account size'
                    },
                    timestamp: new Date().toISOString()
                };

                res.json(result);

            } catch (error) {
                console.error('🚨 Position calculation error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Scheduler control
        this.app.post('/api/scheduler/start', (req, res) => {
            this.startScheduler();
            res.json({ success: true, message: 'Scheduler started' });
        });
        
        this.app.post('/api/scheduler/stop', (req, res) => {
            this.stopScheduler();
            res.json({ success: true, message: 'Scheduler stopped' });
        });

        // Testing Framework Endpoints
        this.app.get('/api/test/scenarios', async (req, res) => {
            try {
                const TomKingTestingFramework = require('./testingFramework');
                const framework = new TomKingTestingFramework();
                await framework.initialize(false);
                
                res.json({
                    success: true,
                    scenarios: framework.scenarios.map(s => ({
                        name: s.name,
                        phase: s.phase,
                        description: s.description,
                        expectedStrategies: s.expectedStrategies
                    })),
                    count: framework.scenarios.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Get scenarios error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/test/run', async (req, res) => {
            try {
                const { scenarioName, useAPI = false } = req.body;
                
                if (!scenarioName) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing scenarioName parameter',
                        timestamp: new Date().toISOString()
                    });
                }

                const TomKingTestingFramework = require('./testingFramework');
                const framework = new TomKingTestingFramework();
                await framework.initialize(useAPI);
                
                const result = await framework.runSpecificTest(scenarioName);
                
                if (!result) {
                    return res.status(404).json({
                        success: false,
                        error: `Scenario not found: ${scenarioName}`,
                        available: framework.scenarios.map(s => s.name),
                        timestamp: new Date().toISOString()
                    });
                }

                res.json({
                    success: result.success,
                    scenario: result.scenario,
                    phase: result.phase,
                    recommendations: result.recommendations,
                    analysis: result.analysis,
                    validation: result.validation,
                    executionTime: result.executionTime,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Run test error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/test/run-all', async (req, res) => {
            try {
                const { useAPI = false, phases = [1, 2, 3, 4] } = req.body;

                const TomKingTestingFramework = require('./testingFramework');
                const framework = new TomKingTestingFramework();
                await framework.initialize(useAPI);
                
                // Filter scenarios by requested phases
                const filteredScenarios = framework.scenarios.filter(s => phases.includes(s.phase));
                
                logger.info('TEST', `Running ${filteredScenarios.length} scenarios for phases: ${phases.join(', ')}`);
                
                const results = [];
                for (const scenario of filteredScenarios) {
                    const result = await framework.runScenario(scenario);
                    results.push(result);
                }
                
                // Generate summary report
                const successful = results.filter(r => r.success);
                const failed = results.filter(r => !r.success);
                const avgMatchRate = successful.reduce((sum, r) => sum + r.validation.matchRate, 0) / successful.length || 0;
                
                const summary = {
                    totalTests: results.length,
                    successful: successful.length,
                    failed: failed.length,
                    successRate: (successful.length / results.length) * 100,
                    avgStrategyMatchRate: avgMatchRate * 100,
                    phases: phases,
                    executionTime: results.reduce((sum, r) => sum + r.executionTime, 0)
                };

                res.json({
                    success: true,
                    summary,
                    results,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Run all tests error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/test/manual-input', async (req, res) => {
            try {
                const { input, includePatterns = true, includeGreeks = true } = req.body;
                
                if (!input) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing input parameter. Format: £[amount] | [positions] | [BP%] | [Day Date Time] | VIX [level] | [PM Y/N]',
                        example: '£45000 | ES LT112 (85 DTE, 6420, +5%) | 32% | Friday Jan 10 10:15 AM EST | VIX 15.2 | No',
                        timestamp: new Date().toISOString()
                    });
                }

                // Use enhanced recommendation engine if requested
                if (includePatterns || includeGreeks) {
                    const EnhancedRecommendationEngine = require('./enhancedRecommendationEngine');
                    const engine = new EnhancedRecommendationEngine();
                    await engine.initialize(this.isInitialized);
                    
                    // Parse input using testing framework
                    const TomKingTestingFramework = require('./testingFramework');
                    const framework = new TomKingTestingFramework();
                    const userData = framework.parseUserInput(input);
                    
                    // Generate enhanced recommendations
                    const recommendations = await engine.generateEnhancedRecommendations(
                        userData, includeGreeks, includePatterns
                    );

                    res.json({
                        success: true,
                        input: input,
                        userData: userData,
                        recommendations: recommendations.actionItems,
                        analysis: {
                            riskAnalysis: recommendations.riskAnalysis,
                            qualifiedTickers: recommendations.qualifiedTickers,
                            patternAnalysis: includePatterns ? recommendations.patternAnalysis : null,
                            greeksAnalysis: includeGreeks ? recommendations.greeksAnalysis : null,
                            portfolioOptimization: recommendations.portfolioOptimization
                        },
                        enhanced: true,
                        executionTime: recommendations.summary.executionTime,
                        timestamp: new Date().toISOString()
                    });

                } else {
                    // Use basic testing framework
                    const TomKingTestingFramework = require('./testingFramework');
                    const framework = new TomKingTestingFramework();
                    await framework.initialize(this.isInitialized);
                    
                    const customScenario = {
                        name: "Manual Input Test",
                        input: input,
                        expectedStrategies: ["Manual Analysis"],
                        phase: 1,
                        description: "Manual user input for recommendation generation"
                    };
                    
                    const result = await framework.runScenario(customScenario);

                    res.json({
                        success: result.success,
                        input: input,
                        userData: result.userData,
                        recommendations: result.recommendations,
                        analysis: result.analysis,
                        enhanced: false,
                        executionTime: result.executionTime,
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                console.error('🚨 Manual input test error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/enhanced/analyze', async (req, res) => {
            try {
                const { userData, includePatterns = true, includeGreeks = true } = req.body;
                
                if (!userData) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing userData parameter',
                        timestamp: new Date().toISOString()
                    });
                }

                const EnhancedRecommendationEngine = require('./enhancedRecommendationEngine');
                const engine = new EnhancedRecommendationEngine();
                await engine.initialize(this.isInitialized);
                
                const recommendations = await engine.generateEnhancedRecommendations(
                    userData, includeGreeks, includePatterns
                );

                res.json({
                    success: true,
                    userData: userData,
                    recommendations: recommendations,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Enhanced analysis error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/enhanced/pattern-analysis', async (req, res) => {
            try {
                const { tickers, phase = 2, vixLevel = 16 } = req.body;
                
                if (!tickers || !Array.isArray(tickers)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing or invalid tickers array',
                        timestamp: new Date().toISOString()
                    });
                }

                const EnhancedRecommendationEngine = require('./enhancedRecommendationEngine');
                const engine = new EnhancedRecommendationEngine();
                await engine.initialize(this.isInitialized);
                
                // Create mock userData for pattern analysis
                const userData = {
                    phase: phase,
                    vixLevel: vixLevel,
                    dayOfWeek: 'Wednesday',
                    timeEST: '2:30 PM',
                    positions: [],
                    bpUsed: 0,
                    accountValue: phase * 20000 + 20000 // Rough estimate
                };

                // Simulate qualified tickers
                const qualifiedTickers = tickers.map(ticker => ({
                    ticker: ticker,
                    priority: 70,
                    correlationGroup: engine.getCorrelationGroup(ticker)
                }));

                // Collect market data and run pattern analysis
                await engine.collectMarketDataForTickers(qualifiedTickers);
                const patternAnalysis = await engine.runPatternAnalysis(qualifiedTickers, userData);

                res.json({
                    success: true,
                    tickers: tickers,
                    phase: phase,
                    vixLevel: vixLevel,
                    patternAnalysis: patternAnalysis,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Pattern analysis error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/enhanced/greeks-optimization', async (req, res) => {
            try {
                const { ticker, strategy = 'strangle', currentPositions = [] } = req.body;
                
                if (!ticker) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing ticker parameter',
                        timestamp: new Date().toISOString()
                    });
                }

                const EnhancedRecommendationEngine = require('./enhancedRecommendationEngine');
                const engine = new EnhancedRecommendationEngine();
                await engine.initialize(this.isInitialized);
                
                // Create mock userData
                const userData = {
                    phase: 2,
                    vixLevel: 16,
                    dayOfWeek: 'Wednesday',
                    timeEST: '2:30 PM',
                    positions: currentPositions,
                    bpUsed: 25,
                    accountValue: 45000
                };

                const qualifiedTickers = [{ ticker: ticker, priority: 80, correlationGroup: engine.getCorrelationGroup(ticker) }];
                
                // Collect data and analyze Greeks
                await engine.collectMarketDataForTickers(qualifiedTickers);
                const greeksAnalysis = await engine.analyzeGreeksAndStrikes(qualifiedTickers, userData);
                const strikeOptimization = await engine.optimizeStrikes(qualifiedTickers, userData, greeksAnalysis);

                res.json({
                    success: true,
                    ticker: ticker,
                    strategy: strategy,
                    greeksAnalysis: greeksAnalysis,
                    strikeOptimization: strikeOptimization,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('🚨 Greeks optimization error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // PLUG-AND-PLAY ANALYSIS ENDPOINT
        this.app.post('/api/quick-analysis', async (req, res) => {
            try {
                const logger = require('./logger').getLogger();
                const DataManager = require('./dataManager');
                const dataManager = new DataManager();
                
                logger.info('QUICK-ANALYSIS', 'Starting plug-and-play analysis');
                
                // Get current VIX
                const vixData = await dataManager.getVIXData();
                const vixLevel = vixData.currentPrice;
                
                // Determine phase and account from request or use defaults
                const phase = req.body.phase || 2;
                const accountValue = req.body.accountValue || 45000;
                const bpUsed = req.body.bpUsed || 0;
                
                // Initialize if needed
                if (!this.isInitialized) {
                    logger.info('QUICK-ANALYSIS', 'Auto-initializing system');
                    this.trader = new TomKingTrader({
                        apiMode: false,
                        phase: phase,
                        accountValue: accountValue,
                        environment: 'production'
                    });
                    await this.trader.initialize();
                    this.isInitialized = true;
                }
                
                // Get market data for phase
                const marketData = await dataManager.getPhaseMarketData(phase);
                
                // Build user data
                const now = new Date();
                const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
                const timeEST = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' });
                
                const userData = {
                    accountValue: accountValue,
                    phase: phase,
                    positions: req.body.positions || [],
                    bpUsed: bpUsed,
                    dayOfWeek: dayOfWeek,
                    timeEST: timeEST,
                    vixLevel: vixLevel,
                    portfolioMargin: false
                };
                
                logger.info('QUICK-ANALYSIS', 'User data prepared', userData);
                
                // Run enhanced analysis
                const EnhancedRecommendationEngine = require('./enhancedRecommendationEngine');
                const engine = new EnhancedRecommendationEngine();
                await engine.initialize(true);
                
                const recommendations = await engine.generateEnhancedRecommendations(
                    userData, 
                    true, // includeGreeks
                    true  // includePatterns
                );
                
                // Format response
                const response = {
                    success: true,
                    market: {
                        vix: vixData,
                        regime: dataManager.getVIXRegime(vixLevel),
                        status: dataManager.getDetailedMarketStatus()
                    },
                    account: {
                        phase: phase,
                        value: accountValue,
                        bpUsed: bpUsed,
                        bpAvailable: 65 - bpUsed
                    },
                    recommendations: recommendations.actionItems || [],
                    qualifiedTickers: recommendations.qualifiedTickers || [],
                    patterns: recommendations.patternAnalysis || {},
                    greeks: recommendations.greeksAnalysis || {},
                    risk: recommendations.riskAnalysis || {},
                    summary: {
                        totalOpportunities: recommendations.actionItems ? recommendations.actionItems.length : 0,
                        topPick: recommendations.actionItems && recommendations.actionItems.length > 0 ? 
                                recommendations.actionItems[0] : null,
                        executionTime: recommendations.summary ? recommendations.summary.executionTime : 0
                    },
                    timestamp: new Date().toISOString()
                };
                
                logger.info('QUICK-ANALYSIS', 'Analysis complete', {
                    opportunities: response.summary.totalOpportunities,
                    executionTime: response.summary.executionTime
                });
                
                res.json(response);
                
            } catch (error) {
                const logger = require('./logger').getLogger();
                logger.error('QUICK-ANALYSIS', 'Analysis failed', error);
                
                res.status(500).json({
                    success: false,
                    error: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // BACKTESTING ENDPOINTS
        
        // Run comprehensive backtest
        this.app.post('/api/backtest/run', async (req, res) => {
            try {
                const {
                    symbols = ['ES', 'SPY', 'QQQ'],
                    startDate = '2020-01-01',
                    endDate = new Date().toISOString().split('T')[0],
                    initialCapital = 30000,
                    strategies = null // null means all strategies
                } = req.body;
                
                this.logger.info('BACKTEST', 'Starting comprehensive backtest', {
                    symbols: symbols.length,
                    period: `${startDate} to ${endDate}`,
                    initialCapital
                });

                const backtestEngine = new BacktestingEngine({
                    startDate,
                    endDate,
                    initialCapital,
                    apiClient: this.trader?.api
                });

                const results = await backtestEngine.runFullBacktest(symbols);
                
                res.json({
                    success: true,
                    results,
                    summary: {
                        totalReturn: results.metrics.basic.totalReturn,
                        sharpeRatio: results.metrics.risk.sharpeRatio,
                        maxDrawdown: results.metrics.drawdown.maxDrawdown,
                        winRate: results.metrics.basic.winRate,
                        totalTrades: results.metrics.basic.totalTrades
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', 'Backtest execution failed', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Run strategy-specific backtest
        this.app.post('/api/backtest/strategy/:strategyName', async (req, res) => {
            try {
                const { strategyName } = req.params;
                const {
                    symbols = null,
                    startDate = '2020-01-01',
                    endDate = new Date().toISOString().split('T')[0],
                    initialCapital = 30000
                } = req.body;

                this.logger.info('BACKTEST', `Starting ${strategyName} backtest`);

                const backtestEngine = new BacktestingEngine({
                    startDate,
                    endDate,
                    initialCapital,
                    apiClient: this.trader?.api
                });

                const results = await backtestEngine.runStrategyBacktest(strategyName, symbols);
                
                res.json({
                    success: true,
                    strategy: strategyName,
                    results,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', `${req.params.strategyName} backtest failed`, error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Validate patterns with historical data
        this.app.post('/api/backtest/validate-patterns', async (req, res) => {
            try {
                const {
                    symbols = ['ES', 'SPY'],
                    startDate = '2020-01-01',
                    endDate = new Date().toISOString().split('T')[0],
                    patterns = null // null means all patterns
                } = req.body;

                this.logger.info('BACKTEST', 'Starting pattern validation');

                const patternEngine = new PatternValidationEngine({
                    apiClient: this.trader?.api
                });

                const validation = await patternEngine.validateAllPatterns(symbols, startDate, endDate);
                
                res.json({
                    success: true,
                    validation,
                    summary: validation.summary,
                    recommendations: validation.recommendations,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', 'Pattern validation failed', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Optimize strategy parameters
        this.app.post('/api/backtest/optimize/:strategyName', async (req, res) => {
            try {
                const { strategyName } = req.params;
                const {
                    symbols = null,
                    startDate = '2020-01-01',
                    endDate = new Date().toISOString().split('T')[0]
                } = req.body;

                this.logger.info('BACKTEST', `Starting ${strategyName} optimization`);

                const patternEngine = new PatternValidationEngine({
                    apiClient: this.trader?.api
                });

                const dataManager = new HistoricalDataManager({
                    apiClient: this.trader?.api
                });

                // Load market data
                const marketData = {};
                const targetSymbols = symbols || ['ES', 'SPY'];
                
                for (const symbol of targetSymbols) {
                    marketData[symbol] = await dataManager.fetchHistoricalData(symbol, startDate, endDate);
                }

                const optimization = await patternEngine.optimizePatternParameters(
                    strategyName, 
                    marketData, 
                    { optimization: true }
                );
                
                res.json({
                    success: true,
                    strategy: strategyName,
                    optimization,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', `${req.params.strategyName} optimization failed`, error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Generate comprehensive backtest report
        this.app.post('/api/backtest/report', async (req, res) => {
            try {
                const { backtestResults, includePatterns = true, includeOptimization = false } = req.body;
                
                if (!backtestResults) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing backtestResults parameter',
                        timestamp: new Date().toISOString()
                    });
                }

                this.logger.info('BACKTEST', 'Generating comprehensive report');

                const reportGenerator = new BacktestReportGenerator({
                    outputDir: path.join(__dirname, '..', 'reports')
                });

                let patternValidation = null;
                let optimizationResults = null;

                // Optionally include pattern validation
                if (includePatterns) {
                    const patternEngine = new PatternValidationEngine({
                        apiClient: this.trader?.api
                    });
                    patternValidation = await patternEngine.validateAllPatterns(
                        ['ES', 'SPY'], 
                        backtestResults.startDate || '2020-01-01',
                        backtestResults.endDate || new Date().toISOString().split('T')[0]
                    );
                }

                const report = await reportGenerator.generateComprehensiveReport(
                    backtestResults,
                    patternValidation,
                    optimizationResults
                );
                
                res.json({
                    success: true,
                    report: {
                        htmlPath: report.htmlPath,
                        jsonPath: report.jsonPath
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', 'Report generation failed', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get historical data for specific symbol
        this.app.get('/api/backtest/data/:symbol', async (req, res) => {
            try {
                const { symbol } = req.params;
                const {
                    startDate = '2020-01-01',
                    endDate = new Date().toISOString().split('T')[0],
                    interval = 'daily'
                } = req.query;

                this.logger.info('BACKTEST', `Fetching historical data for ${symbol}`);

                const dataManager = new HistoricalDataManager({
                    apiClient: this.trader?.api
                });

                const data = await dataManager.fetchHistoricalData(symbol, startDate, endDate, interval);
                
                res.json({
                    success: true,
                    symbol,
                    data,
                    count: data.length,
                    period: { startDate, endDate },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', `Data fetch failed for ${req.params.symbol}`, error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Calculate performance metrics for custom data
        this.app.post('/api/backtest/metrics', async (req, res) => {
            try {
                const { trades, dailyPnL, initialCapital = 30000, benchmarkReturns = null } = req.body;
                
                if (!trades || !dailyPnL) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required parameters: trades and dailyPnL',
                        timestamp: new Date().toISOString()
                    });
                }

                this.logger.info('BACKTEST', 'Calculating performance metrics');

                const performanceCalc = new PerformanceMetrics();
                const metrics = performanceCalc.calculateComprehensiveMetrics(
                    trades, 
                    dailyPnL, 
                    initialCapital, 
                    benchmarkReturns
                );
                
                res.json({
                    success: true,
                    metrics,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('BACKTEST', 'Metrics calculation failed', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get backtest status and capabilities
        this.app.get('/api/backtest/status', (req, res) => {
            try {
                const capabilities = {
                    strategies: ['0DTE', 'LT112', 'STRANGLE', 'IPMCC', 'LEAP'],
                    patterns: ['BREAKOUT', 'REVERSAL', 'TREND_CONTINUATION', 'VOLATILITY_EXPANSION', 'MEAN_REVERSION'],
                    symbols: ['ES', 'MES', 'NQ', 'MNQ', 'SPY', 'QQQ', 'IWM', 'TLT', 'GLD'],
                    dataSource: this.trader?.api ? 'TastyTrade API + Alternatives' : 'Alternative Sources Only',
                    maxHistoryYears: 5,
                    reportFormats: ['HTML', 'JSON', 'CSV']
                };

                res.json({
                    success: true,
                    available: true,
                    capabilities,
                    apiConnected: !!this.trader?.api,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Serve main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
        });
        
        // === UNIFIED TRADING SYSTEM ROUTES ===
        
        // Get system status
        this.app.get('/api/system/status', (req, res) => {
            try {
                const status = this.unifiedSystem.getSystemStatus();
                res.json({
                    success: true,
                    ...status
                });
            } catch (error) {
                console.error('🚨 System status error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get comprehensive dashboard data
        this.app.get('/api/dashboard', (req, res) => {
            try {
                const dashboardData = this.unifiedSystem.getDashboardData();
                res.json({
                    success: true,
                    data: dashboardData,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Dashboard error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Get HTML dashboard (legacy)
        this.app.get('/dashboard-legacy', (req, res) => {
            try {
                const html = this.unifiedSystem.generateHTMLDashboard();
                res.type('html').send(html);
            } catch (error) {
                console.error('🚨 HTML dashboard error:', error);
                res.status(500).send(`
                    <html>
                        <body>
                            <h1>Dashboard Error</h1>
                            <p>Failed to generate dashboard: ${error.message}</p>
                            <p><a href="/dashboard-legacy">Refresh</a></p>
                        </body>
                    </html>
                `);
            }
        });

        // Serve professional dashboard
        this.app.get('/dashboard', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
        });

        // Position management routes
        this.app.get('/api/positions', (req, res) => {
            try {
                const positions = this.unifiedSystem.getAllPositions();
                res.json({
                    success: true,
                    positions,
                    count: positions.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Positions error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/positions', async (req, res) => {
            try {
                const positionId = await this.unifiedSystem.addPosition(req.body);
                res.json({
                    success: true,
                    positionId,
                    message: 'Position added successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Add position error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.put('/api/positions/:id', async (req, res) => {
            try {
                await this.unifiedSystem.updatePosition(req.params.id, req.body);
                res.json({
                    success: true,
                    message: 'Position updated successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Update position error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.delete('/api/positions/:id', async (req, res) => {
            try {
                const closedPosition = await this.unifiedSystem.closePosition(req.params.id, req.body);
                res.json({
                    success: true,
                    closedPosition,
                    message: 'Position closed successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Close position error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // P&L and performance routes
        this.app.get('/api/pl/current', (req, res) => {
            try {
                const currentPL = this.unifiedSystem.getCurrentPL();
                res.json({
                    success: true,
                    pl: currentPL,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Current P&L error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/analytics', (req, res) => {
            try {
                const analytics = this.unifiedSystem.getTradeAnalytics(req.query);
                res.json({
                    success: true,
                    analytics,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Analytics error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Tom King specific routes
        this.app.get('/api/tom-king/metrics', (req, res) => {
            try {
                const metrics = this.unifiedSystem.getTomKingMetrics();
                res.json({
                    success: true,
                    metrics,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Tom King metrics error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Export routes
        this.app.post('/api/export/trades', async (req, res) => {
            try {
                const filePath = await this.unifiedSystem.exportTrades(req.body.filters, req.body.filename);
                res.json({
                    success: true,
                    filePath,
                    message: 'Trades exported successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Export trades error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/export/analytics', async (req, res) => {
            try {
                const filePath = await this.unifiedSystem.exportAnalytics(req.body.filters, req.body.filename);
                res.json({
                    success: true,
                    filePath,
                    message: 'Analytics exported successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Export analytics error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Comprehensive report
        this.app.get('/api/reports/comprehensive', (req, res) => {
            try {
                const report = this.unifiedSystem.generateComprehensiveReport();
                res.json({
                    success: true,
                    report,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Comprehensive report error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Market data update endpoint
        this.app.post('/api/market-data/update', async (req, res) => {
            try {
                const updatedCount = await this.unifiedSystem.updatePositionsWithMarketData(req.body);
                res.json({
                    success: true,
                    updatedCount,
                    message: `Updated ${updatedCount} positions with market data`,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('🚨 Market data update error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Catch-all route - MUST BE LAST!
        this.app.get('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                availableEndpoints: [
                    'GET /health',
                    'GET /api/health',
                    'POST /api/initialize',
                    'POST /api/analyze',
                    'POST /api/strategy/analyze',
                    'POST /api/risk/check',
                    'POST /api/position/calculate',
                    'GET /api/status',
                    'GET /api/signals',
                    'POST /api/market-data',
                    'POST /api/positions',
                    'POST /api/report',
                    'GET /api/config',
                    'POST /api/test-connection',
                    'POST /api/scheduler/start',
                    'POST /api/scheduler/stop',
                    'POST /api/streaming/enable',
                    'POST /api/streaming/disable',
                    'POST /api/streaming/subscribe',
                    'POST /api/quotes/realtime',
                    'GET /api/streaming/status',
                    'POST /api/orders/dry-run',
                    'POST /api/orders/place',
                    'GET /api/orders/live',
                    'GET /api/orders/:orderId',
                    'DELETE /api/orders/:orderId',
                    'GET /api/orders/stats',
                    'POST /api/strategies/iron-condor',
                    'POST /api/strategies/short-strangle',
                    'POST /api/strategies/0dte',
                    'POST /api/strategies/butterfly',
                    'GET /api/greeks/portfolio',
                    'POST /api/greeks/option',
                    'POST /api/greeks/5-delta-strikes',
                    'POST /api/greeks/update',
                    'GET /api/greeks/history',
                    'GET /api/greeks/alerts',
                    'GET /api/greeks/status',
                    'GET /api/test/scenarios',
                    'POST /api/test/run',
                    'POST /api/test/run-all',
                    'POST /api/test/manual-input',
                    'POST /api/backtest/run',
                    'POST /api/backtest/strategy/:strategyName',
                    'POST /api/backtest/validate-patterns',
                    'POST /api/backtest/optimize/:strategyName',
                    'POST /api/backtest/report',
                    'GET /api/backtest/data/:symbol',
                    'POST /api/backtest/metrics',
                    'GET /api/backtest/status',
                    'GET /api/system/status',
                    'GET /api/dashboard',
                    'GET /dashboard',
                    'GET /api/positions',
                    'POST /api/positions',
                    'PUT /api/positions/:id',
                    'DELETE /api/positions/:id',
                    'GET /api/pl/current',
                    'GET /api/analytics',
                    'GET /api/tom-king/metrics',
                    'POST /api/export/trades',
                    'POST /api/export/analytics',
                    'GET /api/reports/comprehensive',
                    'POST /api/market-data/update'
                ]
            });
        });
    }
    
    /**
     * Setup WebSocket server
     */
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            logger.debug('WEBSOCKET', `Connection established from ${req.socket.remoteAddress}`);
            
            // Add to connection set
            this.wsConnections.add(ws);
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                data: {
                    message: 'Connected to TomKingTrader WebSocket server',
                    timestamp: new Date().toISOString(),
                    initialized: this.isInitialized
                }
            }));
            
            // Send current status
            if (this.isInitialized) {
                ws.send(JSON.stringify({
                    type: 'system_status',
                    data: this.trader.getStatus()
                }));
                
                // Send active signals
                const signals = this.signalGenerator.signals || [];
                if (signals.length > 0) {
                    ws.send(JSON.stringify({
                        type: 'active_signals',
                        data: signals
                    }));
                }
                
                // Send current analysis if available
                if (this.currentAnalysis) {
                    ws.send(JSON.stringify({
                        type: 'analysis_data',
                        data: this.currentAnalysis
                    }));
                }
            }
            
            // Handle messages from client
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleWebSocketMessage(ws, data);
                } catch (error) {
                    console.error('🚨 WebSocket message error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: { error: 'Invalid message format' }
                    }));
                }
            });
            
            // Handle disconnection
            ws.on('close', () => {
                logger.debug('WEBSOCKET', 'Connection closed');
                this.wsConnections.delete(ws);
            });
            
            // Handle errors
            ws.on('error', (error) => {
                console.error('🚨 WebSocket error:', error);
                this.wsConnections.delete(ws);
            });
        });
        
        logger.info('WEBSOCKET', `WebSocket server listening on port ${this.config.wsPort}`);
    }
    
    /**
     * Handle WebSocket messages from clients
     */
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
                
            case 'subscribe':
                // Handle subscription to specific data streams
                ws.subscriptions = ws.subscriptions || new Set();
                ws.subscriptions.add(data.channel);
                ws.send(JSON.stringify({ 
                    type: 'subscribed', 
                    channel: data.channel 
                }));
                break;
                
            case 'request_analysis':
                // Trigger analysis if initialized
                if (this.isInitialized && this.currentAnalysis) {
                    ws.send(JSON.stringify({
                        type: 'analysis_data',
                        data: this.currentAnalysis
                    }));
                }
                break;
                
            case 'request_signals':
                const signals = this.signalGenerator.signals || [];
                ws.send(JSON.stringify({
                    type: 'active_signals',
                    data: signals
                }));
                break;
                
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { error: `Unknown message type: ${data.type}` }
                }));
        }
    }
    
    /**
     * Broadcast message to all connected clients
     */
    broadcast(message) {
        const messageStr = JSON.stringify(message);
        
        this.wsConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    // Check if client is subscribed to this type
                    if (!ws.subscriptions || ws.subscriptions.has(message.type) || 
                        ['signal', 'system_status', 'analysis_complete'].includes(message.type)) {
                        ws.send(messageStr);
                    }
                } catch (error) {
                    console.error('🚨 Broadcast error:', error);
                    this.wsConnections.delete(ws);
                }
            } else {
                this.wsConnections.delete(ws);
            }
        });
    }
    
    /**
     * Broadcast individual signal
     */
    broadcastSignal(signal) {
        this.broadcast({
            type: 'signal',
            data: signal
        });
    }
    
    /**
     * Setup automated scheduler
     */
    setupScheduler() {
        if (!this.config.enableScheduler) return;
        
        logger.info('SCHEDULER', 'Setting up automated scheduler');
        
        // Start scheduler after 30 seconds
        setTimeout(() => {
            this.startScheduler();
        }, 30000);
    }
    
    /**
     * Start automated analysis scheduler
     */
    startScheduler() {
        if (this.schedulerInterval) {
            logger.debug('SCHEDULER', 'Scheduler already running');
            return;
        }
        
        logger.info('SCHEDULER', 'Starting automated scheduler - analysis every 15 minutes');
        
        this.schedulerInterval = setInterval(async () => {
            try {
                if (this.isInitialized) {
                    logger.info('SCHEDULER', 'Running scheduled analysis');
                    
                    // Collect fresh data if API mode
                    if (this.trader.api && !this.trader.fallbackMode) {
                        await this.trader.collectMarketData();
                        await this.trader.updatePositions();
                    }
                    
                    // Run analysis
                    const analysis = await this.trader.runAnalysis();
                    this.currentAnalysis = analysis;
                    this.lastAnalysisTime = new Date();
                    
                    // Generate signals
                    const signals = await this.signalGenerator.generateSignals(
                        this.trader.marketData,
                        {
                            vixLevel: analysis.vixLevel,
                            phase: analysis.phase,
                            accountValue: analysis.accountValue,
                            positions: this.trader.positions
                        }
                    );
                    
                    // Broadcast updates
                    this.broadcast({
                        type: 'scheduled_analysis',
                        data: {
                            analysis,
                            signals: signals.signals,
                            timestamp: new Date().toISOString()
                        }
                    });
                    
                    logger.info('SCHEDULER', 'Scheduled analysis complete');
                }
            } catch (error) {
                console.error('🚨 Scheduled analysis error:', error);
                
                this.broadcast({
                    type: 'scheduler_error',
                    data: {
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }, 15 * 60 * 1000); // 15 minutes
    }
    
    /**
     * Stop automated scheduler
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
            logger.info('SCHEDULER', 'Scheduler stopped');
        }
    }
    
    /**
     * Start the application server
     */
    async start() {
        return new Promise((resolve) => {
            this.server.listen(this.config.port, () => {
                logger.info('APP', 'TomKingTrader server started', {
                    port: this.config.port,
                    dashboard: `http://localhost:${this.config.port}`,
                    webSocket: `ws://localhost:${this.config.wsPort}`,
                    environment: this.config.environment
                });
                
                resolve(this);
            });
        });
    }
    
    /**
     * Stop the application server
     */
    async stop() {
        return new Promise((resolve) => {
            logger.info('APP', 'Shutting down TomKingTrader application');
            
            // Stop scheduler
            this.stopScheduler();
            
            // Close WebSocket connections
            this.wss.clients.forEach(ws => {
                ws.terminate();
            });
            
            // Close WebSocket server
            this.wss.close();
            
            // Close HTTP server
            this.server.close(() => {
                logger.info('APP', 'TomKingTrader application stopped');
                resolve();
            });
        });
    }
    
    /**
     * Get application statistics
     */
    getStats() {
        try {
            const signalReport = this.signalGenerator.getSignalReport();
            return {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                connections: this.wsConnections.size,
                initialized: this.isInitialized,
                lastAnalysis: this.lastAnalysisTime,
                signals: signalReport.summary,
                scheduler: {
                    enabled: this.config.enableScheduler,
                    running: !!this.schedulerInterval
                }
            };
        } catch (error) {
            return {
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                connections: this.wsConnections.size,
                initialized: this.isInitialized,
                lastAnalysis: this.lastAnalysisTime,
                signals: { totalSignals: 0, error: error.message },
                scheduler: {
                    enabled: this.config.enableScheduler,
                    running: !!this.schedulerInterval
                }
            };
        }
    }
}

/**
 * Create and start the application
 */
async function createApp(options = {}) {
    const app = new TomKingTraderApp(options);
    await app.start();
    return app;
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.warn('APP', 'Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.warn('APP', 'Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = {
    TomKingTraderApp,
    createApp
};

// If running directly, start the application
if (require.main === module) {
    createApp().catch(console.error);
}