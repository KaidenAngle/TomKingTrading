#!/usr/bin/env node

/**
 * TOM KING TRADING FRAMEWORK - UNIFIED PRODUCTION LAUNCHER
 * Complete system integration with all modes and functionality
 * Version 17.2 - PRODUCTION READY
 */

require('dotenv').config();
const readline = require('readline');
const chalk = require('chalk');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Import all system components
const { TastyTradeAPI } = require('./src/tastytradeAPI');
const UnifiedTradingEngine = require('./UNIFIED_TRADING_ENGINE');
const ProfessionalBacktestEngine = require('./PROFESSIONAL_BACKTEST_ENGINE');
const LivePaperTrading = require('./LIVE_PAPER_TRADING');
const DailyTradingAnalysis = require('./DAILY_TRADING_ANALYSIS');

class ProductionLauncher {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        this.config = {
            accountValue: 35000,
            phase: 1,
            environment: 'production',
            apiConnected: false
        };
        
        this.api = null;
        this.engine = null;
        this.dashboardProcess = null;
    }
    
    async start() {
        console.clear();
        this.printHeader();
        
        // Check API connection
        await this.checkAPIConnection();
        
        // Load saved configuration
        await this.loadConfiguration();
        
        // Show main menu
        await this.showMainMenu();
    }
    
    printHeader() {
        console.log(chalk.cyan('════════════════════════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('                    TOM KING TRADING FRAMEWORK v17.2                           '));
        console.log(chalk.cyan('                         PRODUCTION LAUNCHER                                   '));
        console.log(chalk.cyan('════════════════════════════════════════════════════════════════════════════════'));
        console.log(chalk.yellow(`\n🎯 Goal: £35,000 → £80,000 in 8 months`));
        console.log(chalk.green(`📊 Current Phase: ${this.config.phase} | Account: £${this.config.accountValue.toLocaleString()}`));
        console.log(chalk.blue(`🔌 API Status: ${this.config.apiConnected ? '✅ Connected' : '❌ Disconnected'}\n`));
    }
    
    async checkAPIConnection() {
        try {
            this.api = new TastyTradeAPI();
            await this.api.initialize();
            this.config.apiConnected = true;
            console.log(chalk.green('✅ TastyTrade API connected successfully'));
        } catch (error) {
            console.log(chalk.yellow('⚠️ API connection failed - running in manual mode'));
            this.config.apiConnected = false;
        }
    }
    
    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'production.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const savedConfig = JSON.parse(configData);
            Object.assign(this.config, savedConfig);
            console.log(chalk.gray('📁 Configuration loaded'));
        } catch (error) {
            console.log(chalk.gray('📝 No saved configuration found'));
        }
    }
    
    async saveConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'production.json');
            await fs.mkdir(path.dirname(configPath), { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
            console.log(chalk.green('✅ Configuration saved'));
        } catch (error) {
            console.log(chalk.red('❌ Failed to save configuration'));
        }
    }
    
    async showMainMenu() {
        console.log(chalk.cyan('\n════════════════════════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('                              MAIN MENU                                        '));
        console.log(chalk.cyan('════════════════════════════════════════════════════════════════════════════════'));
        
        const menuOptions = [
            { key: '1', label: 'Live Trading Mode', icon: '🔴', available: this.config.apiConnected },
            { key: '2', label: 'Paper Trading (API Data)', icon: '📊', available: this.config.apiConnected },
            { key: '3', label: 'Manual Analysis Mode', icon: '📝', available: true },
            { key: '4', label: 'Backtesting Engine', icon: '⏮️', available: true },
            { key: '5', label: 'Launch Dashboard', icon: '🖥️', available: true },
            { key: '6', label: 'Run Complete Framework', icon: '🚀', available: true },
            { key: '7', label: 'System Validation', icon: '✅', available: true },
            { key: '8', label: 'Configuration', icon: '⚙️', available: true },
            { key: '9', label: 'Reports & Analytics', icon: '📈', available: true },
            { key: '0', label: 'Exit', icon: '🚪', available: true }
        ];
        
        menuOptions.forEach(option => {
            const color = option.available ? chalk.white : chalk.gray;
            const status = option.available ? '' : ' (Unavailable)';
            console.log(color(`  ${option.icon}  [${option.key}] ${option.label}${status}`));
        });
        
        console.log(chalk.cyan('\n════════════════════════════════════════════════════════════════════════════════'));
        
        const choice = await this.prompt('\nSelect option: ');
        await this.handleMenuChoice(choice);
    }
    
    async handleMenuChoice(choice) {
        console.clear();
        this.printHeader();
        
        switch(choice) {
            case '1':
                if (this.config.apiConnected) {
                    await this.startLiveTrading();
                } else {
                    console.log(chalk.red('❌ API connection required for live trading'));
                    await this.pause();
                }
                break;
                
            case '2':
                if (this.config.apiConnected) {
                    await this.startPaperTrading();
                } else {
                    console.log(chalk.red('❌ API connection required for paper trading'));
                    await this.pause();
                }
                break;
                
            case '3':
                await this.startManualAnalysis();
                break;
                
            case '4':
                await this.startBacktesting();
                break;
                
            case '5':
                await this.launchDashboard();
                break;
                
            case '6':
                await this.runCompleteFramework();
                break;
                
            case '7':
                await this.runValidation();
                break;
                
            case '8':
                await this.showConfiguration();
                break;
                
            case '9':
                await this.showReports();
                break;
                
            case '0':
                await this.exit();
                return;
                
            default:
                console.log(chalk.red('Invalid option'));
                await this.pause();
        }
        
        // Return to main menu
        await this.showMainMenu();
    }
    
    async startLiveTrading() {
        console.log(chalk.red.bold('\n⚠️  LIVE TRADING MODE - REAL MONEY AT RISK ⚠️\n'));
        
        const confirm = await this.prompt('Type "CONFIRM" to proceed with live trading: ');
        if (confirm !== 'CONFIRM') {
            console.log(chalk.yellow('Live trading cancelled'));
            return;
        }
        
        console.log(chalk.green('\n🔴 Starting live trading engine...\n'));
        
        // Initialize unified engine in live mode
        this.engine = new UnifiedTradingEngine('live');
        await this.engine.initialize();
        
        // Start monitoring loop
        console.log(chalk.green('✅ Live trading active - monitoring positions'));
        console.log(chalk.yellow('Press Ctrl+C to stop\n'));
        
        // Run continuous monitoring
        await this.runLiveTradingLoop();
    }
    
    async runLiveTradingLoop() {
        while (true) {
            try {
                // Fetch current positions
                const positions = await this.api.getPositions();
                
                // Run analysis
                const analysis = await this.engine.analyzeMarket({
                    accountValue: this.config.accountValue,
                    positions: positions,
                    phase: this.config.phase
                });
                
                // Display recommendations
                if (analysis.recommendations.length > 0) {
                    console.log(chalk.cyan('\n📊 New Recommendations:'));
                    analysis.recommendations.forEach((rec, idx) => {
                        console.log(`  ${idx + 1}. ${rec.action} - ${rec.ticker}`);
                    });
                }
                
                // Wait 5 minutes before next check
                await this.sleep(300000);
                
            } catch (error) {
                console.log(chalk.red(`Error: ${error.message}`));
                await this.sleep(60000); // Wait 1 minute on error
            }
        }
    }
    
    async startPaperTrading() {
        console.log(chalk.blue('\n📊 Starting Paper Trading with Live API Data...\n'));
        
        const paperTrader = new LivePaperTrading();
        await paperTrader.initialize();
        
        // Show paper trading menu
        const options = [
            '1. Run continuous paper trading',
            '2. Single analysis cycle',
            '3. View paper portfolio',
            '4. Reset paper portfolio'
        ];
        
        options.forEach(opt => console.log(chalk.white(`  ${opt}`)));
        
        const choice = await this.prompt('\nSelect option: ');
        
        switch(choice) {
            case '1':
                console.log(chalk.green('\n✅ Paper trading active'));
                await paperTrader.runContinuous();
                break;
            case '2':
                await paperTrader.runSingleCycle();
                break;
            case '3':
                const portfolio = await paperTrader.getPortfolio();
                console.log('\nPaper Portfolio:', JSON.stringify(portfolio, null, 2));
                break;
            case '4':
                await paperTrader.resetPortfolio();
                console.log(chalk.green('✅ Paper portfolio reset'));
                break;
        }
        
        await this.pause();
    }
    
    async startManualAnalysis() {
        console.log(chalk.yellow('\n📝 Manual Analysis Mode\n'));
        
        const analyzer = new DailyTradingAnalysis();
        
        // Get input from user
        const balance = await this.prompt('Account balance (£): ');
        const vix = await this.prompt('Current VIX level: ');
        const spy = await this.prompt('SPY price: ');
        const positionsStr = await this.prompt('Open positions (JSON or blank): ');
        
        const positions = positionsStr ? JSON.parse(positionsStr) : [];
        
        // Run analysis
        const analysis = await analyzer.analyze({
            balance: parseFloat(balance) || this.config.accountValue,
            vix: parseFloat(vix) || 16,
            spy: parseFloat(spy) || 575,
            positions: positions,
            date: new Date()
        });
        
        // Display results
        console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('                     ANALYSIS RESULTS                              '));
        console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════'));
        
        console.log(chalk.green('\n📊 Recommendations:'));
        analysis.recommendations.forEach((rec, idx) => {
            console.log(`  ${idx + 1}. ${rec.action} - ${rec.details}`);
        });
        
        console.log(chalk.yellow('\n⚠️ Warnings:'));
        analysis.warnings.forEach(warning => {
            console.log(`  • ${warning}`);
        });
        
        console.log(chalk.red('\n🚪 Exit Signals:'));
        analysis.exits.forEach(exit => {
            console.log(`  • ${exit.ticker}: ${exit.reason}`);
        });
        
        // Save analysis
        const save = await this.prompt('\nSave analysis? (y/n): ');
        if (save.toLowerCase() === 'y') {
            await analyzer.saveAnalysis(analysis);
            console.log(chalk.green('✅ Analysis saved'));
        }
        
        await this.pause();
    }
    
    async startBacktesting() {
        console.log(chalk.magenta('\n⏮️ Professional Backtesting Engine\n'));
        
        const backtest = new ProfessionalBacktestEngine({
            startDate: '2023-01-01',
            endDate: '2024-12-31',
            initialCapital: this.config.accountValue,
            dataResolution: '1min',
            slippage: 0.05,
            commission: 1.17
        });
        
        const scenarios = [
            '1. Full 2-year backtest (all strategies)',
            '2. 0DTE Friday strategy only',
            '3. August 2024 crash scenario',
            '4. Custom date range',
            '5. Monte Carlo simulation (1000 runs)'
        ];
        
        scenarios.forEach(s => console.log(chalk.white(`  ${s}`)));
        
        const choice = await this.prompt('\nSelect scenario: ');
        
        console.log(chalk.yellow('\n⏳ Running backtest... (this may take several minutes)\n'));
        
        let results;
        switch(choice) {
            case '1':
                results = await backtest.runFullBacktest();
                break;
            case '2':
                results = await backtest.run0DTEBacktest();
                break;
            case '3':
                results = await backtest.runAugust2024Scenario();
                break;
            case '4':
                const startDate = await this.prompt('Start date (YYYY-MM-DD): ');
                const endDate = await this.prompt('End date (YYYY-MM-DD): ');
                results = await backtest.runCustomRange(startDate, endDate);
                break;
            case '5':
                results = await backtest.runMonteCarloSimulation(1000);
                break;
            default:
                console.log(chalk.red('Invalid option'));
                return;
        }
        
        // Display results
        console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════════'));
        console.log(chalk.cyan.bold('                     BACKTEST RESULTS                              '));
        console.log(chalk.cyan('═══════════════════════════════════════════════════════════════════'));
        
        console.log(chalk.white(`
  📊 Performance Metrics:
    • Total Return: ${(results.totalReturn * 100).toFixed(2)}%
    • Win Rate: ${(results.winRate * 100).toFixed(2)}%
    • Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}
    • Max Drawdown: ${(results.maxDrawdown * 100).toFixed(2)}%
    • Total Trades: ${results.totalTrades}
    
  💰 Financial Results:
    • Starting Capital: £${results.startingCapital.toLocaleString()}
    • Ending Capital: £${results.endingCapital.toLocaleString()}
    • Total P&L: £${results.totalPL.toLocaleString()}
    • Best Trade: £${results.bestTrade.toLocaleString()}
    • Worst Trade: £${results.worstTrade.toLocaleString()}
        `));
        
        // Save results
        const save = await this.prompt('\nSave backtest results? (y/n): ');
        if (save.toLowerCase() === 'y') {
            await backtest.saveResults(results);
            console.log(chalk.green('✅ Results saved'));
        }
        
        await this.pause();
    }
    
    async launchDashboard() {
        console.log(chalk.blue('\n🖥️ Launching Trading Dashboard...\n'));
        
        // Start the app server if not running
        if (!this.dashboardProcess) {
            this.dashboardProcess = spawn('node', ['src/app.js'], {
                cwd: __dirname,
                detached: false
            });
            
            this.dashboardProcess.stdout.on('data', (data) => {
                console.log(chalk.gray(`Dashboard: ${data}`));
            });
            
            this.dashboardProcess.stderr.on('data', (data) => {
                console.error(chalk.red(`Dashboard Error: ${data}`));
            });
            
            console.log(chalk.green('✅ Dashboard server started'));
        }
        
        // Open browser
        const platform = process.platform;
        let command;
        
        if (platform === 'win32') {
            command = 'start';
        } else if (platform === 'darwin') {
            command = 'open';
        } else {
            command = 'xdg-open';
        }
        
        spawn(command, ['http://localhost:3000/dashboard.html'], {
            detached: true,
            stdio: 'ignore'
        });
        
        console.log(chalk.green('✅ Dashboard opened in browser'));
        console.log(chalk.gray('   URL: http://localhost:3000/dashboard.html'));
        
        await this.pause();
    }
    
    async runCompleteFramework() {
        console.log(chalk.green('\n🚀 Running Complete Framework Analysis...\n'));
        
        // Run the complete framework
        const { spawn } = require('child_process');
        const framework = spawn('node', ['runCompleteFramework.js', 'analyze', this.config.accountValue, '0'], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        await new Promise((resolve) => {
            framework.on('close', resolve);
        });
        
        await this.pause();
    }
    
    async runValidation() {
        console.log(chalk.cyan('\n✅ Running System Validation...\n'));
        
        // Run comprehensive tests
        const { spawn } = require('child_process');
        const validation = spawn('node', ['PHASE9_COMPREHENSIVE_TEST.js'], {
            cwd: __dirname,
            stdio: 'inherit'
        });
        
        await new Promise((resolve) => {
            validation.on('close', resolve);
        });
        
        await this.pause();
    }
    
    async showConfiguration() {
        console.log(chalk.cyan('\n⚙️ System Configuration\n'));
        
        const options = [
            '1. Update account value',
            '2. Change phase',
            '3. Toggle environment (production/sandbox)',
            '4. API credentials',
            '5. Risk parameters',
            '6. Back to menu'
        ];
        
        options.forEach(opt => console.log(chalk.white(`  ${opt}`)));
        
        const choice = await this.prompt('\nSelect option: ');
        
        switch(choice) {
            case '1':
                const value = await this.prompt('New account value (£): ');
                this.config.accountValue = parseFloat(value);
                this.config.phase = this.calculatePhase(this.config.accountValue);
                await this.saveConfiguration();
                console.log(chalk.green(`✅ Account updated to £${this.config.accountValue.toLocaleString()}`));
                break;
                
            case '2':
                const phase = await this.prompt('New phase (1-4): ');
                this.config.phase = parseInt(phase);
                await this.saveConfiguration();
                console.log(chalk.green(`✅ Phase updated to ${this.config.phase}`));
                break;
                
            case '3':
                this.config.environment = this.config.environment === 'production' ? 'sandbox' : 'production';
                await this.saveConfiguration();
                console.log(chalk.green(`✅ Environment set to ${this.config.environment}`));
                break;
                
            case '4':
                console.log(chalk.yellow('\nAPI credentials are stored in .env file'));
                console.log(chalk.gray('Edit .env file to update credentials'));
                break;
                
            case '5':
                console.log(chalk.white(`
  Current Risk Parameters:
    • Dynamic BP Usage (VIX-based):
      - VIX <13: 45% max BP
      - VIX 13-18: 65% max BP
      - VIX 18-25: 75% max BP
      - VIX 25-30: 50% max BP
      - VIX >30: 80% BP (puts only)
    • Max Correlation Group: 3 positions
    • VIX Regimes: 5 levels
    • Position Size: 5% max per trade
    • August 2024 Protection: ENABLED
                `));
                break;
        }
        
        await this.pause();
    }
    
    async showReports() {
        console.log(chalk.cyan('\n📈 Reports & Analytics\n'));
        
        const options = [
            '1. Generate comprehensive Excel report',
            '2. View performance metrics',
            '3. Position analysis',
            '4. Strategy performance breakdown',
            '5. Risk analysis report'
        ];
        
        options.forEach(opt => console.log(chalk.white(`  ${opt}`)));
        
        const choice = await this.prompt('\nSelect report: ');
        
        switch(choice) {
            case '1':
                console.log(chalk.yellow('\n⏳ Generating Excel report...'));
                const { spawn } = require('child_process');
                const excel = spawn('node', ['generateComprehensiveExcelReport.js'], {
                    cwd: __dirname,
                    stdio: 'inherit'
                });
                await new Promise((resolve) => excel.on('close', resolve));
                break;
                
            case '2':
                // Load and display performance metrics
                try {
                    const metrics = await fs.readFile('performance_tracking.json', 'utf8');
                    console.log('\nPerformance Metrics:', JSON.parse(metrics));
                } catch (error) {
                    console.log(chalk.red('No performance data available'));
                }
                break;
                
            default:
                console.log(chalk.yellow('Report generation in progress...'));
        }
        
        await this.pause();
    }
    
    calculatePhase(accountValue) {
        if (accountValue < 40000) return 1;
        if (accountValue < 60000) return 2;
        if (accountValue < 75000) return 3;
        return 4;
    }
    
    async prompt(question) {
        return new Promise((resolve) => {
            this.rl.question(chalk.cyan(question), (answer) => {
                resolve(answer);
            });
        });
    }
    
    async pause() {
        await this.prompt('\nPress Enter to continue...');
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async exit() {
        console.log(chalk.yellow('\n👋 Shutting down Tom King Trading Framework...'));
        
        // Stop dashboard if running
        if (this.dashboardProcess) {
            this.dashboardProcess.kill();
            console.log(chalk.gray('Dashboard stopped'));
        }
        
        // Save configuration
        await this.saveConfiguration();
        
        console.log(chalk.green('✅ System shutdown complete'));
        console.log(chalk.cyan('\n💡 Remember: Discipline beats intelligence in trading.\n'));
        
        this.rl.close();
        process.exit(0);
    }
}

// Handle interrupts gracefully
process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️ Interrupt received...'));
    const launcher = new ProductionLauncher();
    await launcher.exit();
});

// Start the launcher
async function main() {
    try {
        const launcher = new ProductionLauncher();
        await launcher.start();
    } catch (error) {
        console.error(chalk.red('Fatal error:'), error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = ProductionLauncher;