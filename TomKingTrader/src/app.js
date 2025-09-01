/**
 * TomKingTrader Main Application Server
 * Express.js server with WebSocket support for real-time trading dashboard
 * Integrates all modules and provides REST API endpoints
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;

// Import TomKingTrader modules
const { TomKingTrader, TomKingUtils } = require('./index');
const SignalGenerator = require('./signalGenerator');
const config = require('./config');

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
        this.signalGenerator = new SignalGenerator({
            enableRealTime: true,
            signalCooldown: 300000, // 5 minutes
            maxSignalsPerHour: 20
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
        
        console.log('🚀 TomKingTrader Application initialized');
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
            console.log(`${timestamp} ${req.method} ${req.url}`);
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
                
                this.trader = new TomKingTrader({
                    apiMode: apiMode || false,
                    phase: phase || 1,
                    accountValue: accountValue || 30000,
                    environment: this.config.environment,
                    ...credentials
                });
                
                const result = await this.trader.initialize();
                this.isInitialized = true;
                
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
        
        // Serve main dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
        });
        
        // Catch-all route
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
                    'POST /api/scheduler/stop'
                ]
            });
        });
    }
    
    /**
     * Setup WebSocket server
     */
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            console.log(`📡 WebSocket connection established from ${req.socket.remoteAddress}`);
            
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
                console.log('📡 WebSocket connection closed');
                this.wsConnections.delete(ws);
            });
            
            // Handle errors
            ws.on('error', (error) => {
                console.error('🚨 WebSocket error:', error);
                this.wsConnections.delete(ws);
            });
        });
        
        console.log(`📡 WebSocket server listening on port ${this.config.wsPort}`);
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
        
        console.log('⏰ Setting up automated scheduler');
        
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
            console.log('⏰ Scheduler already running');
            return;
        }
        
        console.log('⏰ Starting automated scheduler - analysis every 15 minutes');
        
        this.schedulerInterval = setInterval(async () => {
            try {
                if (this.isInitialized) {
                    console.log('⏰ Running scheduled analysis...');
                    
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
                    
                    console.log('✅ Scheduled analysis complete');
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
            console.log('⏰ Scheduler stopped');
        }
    }
    
    /**
     * Start the application server
     */
    async start() {
        return new Promise((resolve) => {
            this.server.listen(this.config.port, () => {
                console.log(`🌐 TomKingTrader server listening on port ${this.config.port}`);
                console.log(`📊 Dashboard: http://localhost:${this.config.port}`);
                console.log(`📡 WebSocket: ws://localhost:${this.config.wsPort}`);
                console.log(`🎯 Environment: ${this.config.environment}`);
                
                resolve(this);
            });
        });
    }
    
    /**
     * Stop the application server
     */
    async stop() {
        return new Promise((resolve) => {
            console.log('🛑 Shutting down TomKingTrader application...');
            
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
                console.log('✅ TomKingTrader application stopped');
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
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
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