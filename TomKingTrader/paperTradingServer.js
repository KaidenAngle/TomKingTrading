/**
 * Simple Paper Trading Dashboard Server
 * Standalone server for the paper trading dashboard with WebSocket support
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

class PaperTradingServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Try different port for WebSocket to avoid conflicts
        this.wss = new WebSocket.Server({ port: 3002 });
        this.wsConnections = new Set();
        
        // Simulation state
        this.accountBalance = 35000;
        this.positions = [];
        this.trades = [];
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.startSimulation();
    }

    setupMiddleware() {
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());
        
        // CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Serve the paper trading dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'paperTradingDashboard.html'));
        });

        // API endpoints
        this.app.get('/api/account', (req, res) => {
            res.json({
                balance: this.accountBalance,
                positions: this.positions.length,
                dayPnL: Math.random() * 1000 - 200 // Simulated
            });
        });

        this.app.get('/api/positions', (req, res) => {
            res.json(this.positions);
        });

        this.app.get('/api/trades', (req, res) => {
            res.json(this.trades);
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('📡 WebSocket client connected');
            this.wsConnections.add(ws);
            
            // Send initial data
            ws.send(JSON.stringify({
                type: 'account_update',
                payload: {
                    balance: this.accountBalance,
                    positions: this.positions
                }
            }));

            ws.on('close', () => {
                console.log('📡 WebSocket client disconnected');
                this.wsConnections.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.wsConnections.delete(ws);
            });
        });

        console.log('📡 WebSocket server started on port 3002');
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        this.wsConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    startSimulation() {
        console.log('🎮 Starting paper trading simulation');
        
        // Simulate market updates every 10 seconds
        setInterval(() => {
            this.simulateMarketUpdate();
        }, 10000);

        // Simulate trades every 30 seconds
        setInterval(() => {
            if (Math.random() > 0.7) { // 30% chance
                this.simulateTrade();
            }
        }, 30000);

        // Update positions P&L every 5 seconds
        setInterval(() => {
            this.updatePositionsPnL();
        }, 5000);
    }

    simulateMarketUpdate() {
        // Simulate account balance changes
        const dailyChange = (Math.random() - 0.3) * 500; // Slight positive bias
        this.accountBalance += dailyChange;
        
        this.broadcast({
            type: 'account_update',
            payload: {
                balance: this.accountBalance,
                dailyChange: dailyChange
            }
        });
    }

    simulateTrade() {
        const strategies = ['Zero DTE', 'LT112', 'Strangles'];
        const symbols = ['ES', 'NQ', 'RTY', 'GLD', 'TLT', 'SPY', 'QQQ'];
        
        const strategy = strategies[Math.floor(Math.random() * strategies.length)];
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const pnl = (Math.random() - 0.25) * 300; // Slightly positive bias
        const dte = Math.floor(Math.random() * 60) + 1;

        const trade = {
            id: Date.now(),
            symbol: symbol,
            strategy: strategy,
            pnl: pnl,
            dte: dte,
            timestamp: new Date(),
            isOpen: true
        };

        this.trades.push(trade);
        this.positions.push(trade);

        // Close some positions randomly
        if (Math.random() > 0.6 && this.positions.length > 0) {
            const positionToClose = this.positions[Math.floor(Math.random() * this.positions.length)];
            positionToClose.isOpen = false;
            this.positions = this.positions.filter(p => p.id !== positionToClose.id);
        }

        this.broadcast({
            type: 'trade_executed',
            payload: trade
        });

        this.broadcast({
            type: 'position_update',
            payload: this.positions
        });

        console.log(`🎯 Simulated trade: ${symbol} ${strategy} P&L: £${pnl.toFixed(2)}`);
    }

    updatePositionsPnL() {
        // Update existing positions with random P&L changes
        this.positions.forEach(position => {
            const pnlChange = (Math.random() - 0.5) * 50;
            position.pnl += pnlChange;
        });

        if (this.positions.length > 0) {
            this.broadcast({
                type: 'position_update',
                payload: this.positions
            });
        }
    }

    start(port = 3005) {
        this.server.listen(port, () => {
            console.log('\n🚀 Paper Trading Dashboard Server Started!');
            console.log(`📊 Dashboard: http://localhost:${port}`);
            console.log(`📡 WebSocket: ws://localhost:3002`);
            console.log(`💰 Starting Balance: £${this.accountBalance.toLocaleString()}`);
            console.log('\n🎯 Navigate to http://localhost:3000 to view the dashboard\n');
        });
    }
}

// Start the server
const server = new PaperTradingServer();
server.start();

module.exports = PaperTradingServer;