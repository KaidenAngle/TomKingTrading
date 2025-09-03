/**
 * TOM KING TRADING FRAMEWORK v17.2
 * Unified Entry Point - Consolidates all execution modes
 * 
 * Usage:
 *   node index.js --mode=live       # Live trading with API
 *   node index.js --mode=paper      # Paper trading simulation
 *   node index.js --mode=backtest   # Historical backtesting
 *   node index.js --mode=analysis   # Daily market analysis
 *   node index.js --mode=dashboard  # Start web dashboard
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Core modules
const { TradingStrategies } = require('./src/strategies');
const { RiskManager } = require('./src/riskManager');
const { TastyTradeAPI } = require('./src/tastytradeAPI');

// Use unified modules
const { EnhancedPatternAnalyzer } = require('./src/enhancedPatternAnalysis');
const { PositionManager } = require('./src/positionManager');

// Original modules still used directly
const SignalGenerator = require('./src/signalGenerator');
const { OrderManager } = require('./src/orderManager');
const { BacktestingEngine } = require('./src/backtestingEngine');
// const { generateComprehensiveExcelReport } = require('./reporting/generateComprehensiveExcelReport'); // Commented out - module not found
const config = require('./src/config');
const { createLogger } = require('./src/logger');

const logger = createLogger();

class UnifiedTradingFramework {
    constructor() {
        this.mode = this.parseMode();
        this.api = null;
        this.riskManager = null;
        this.patternAnalyzer = null;
        this.signalGenerator = null;
        this.orderManager = null;
        this.backtester = null;
        this.accountBalance = 35000; // Default £35k
        this.currentVIX = 18; // Default VIX
        this.paperPortfolio = this.loadPaperPortfolio();
    }

    parseMode() {
        const args = process.argv.slice(2);
        const modeArg = args.find(arg => arg.startsWith('--mode='));
        
        if (modeArg) {
            return modeArg.split('=')[1];
        }
        
        // If no mode specified, show interactive menu
        return 'interactive';
    }

    async initialize() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`TOM KING TRADING FRAMEWORK v17.2`);
        console.log(`Mode: ${this.mode.toUpperCase()}`);
        console.log(`${'='.repeat(60)}\n`);

        // Initialize core components
        this.riskManager = new RiskManager();
        this.patternAnalyzer = new EnhancedPatternAnalyzer();
        this.positionManager = new PositionManager(this.api);
        this.signalGenerator = new SignalGenerator();
        
        // Initialize API if needed for mode
        if (['live', 'paper', 'analysis'].includes(this.mode)) {
            await this.initializeAPI();
        }
        
        // Initialize mode-specific components
        switch(this.mode) {
            case 'live':
                await this.initializeLiveTrading();
                break;
            case 'paper':
                await this.initializePaperTrading();
                break;
            case 'backtest':
                await this.initializeBacktesting();
                break;
            case 'analysis':
                await this.runDailyAnalysis();
                break;
            case 'dashboard':
                await this.startDashboard();
                break;
            case 'interactive':
                await this.showInteractiveMenu();
                break;
            default:
                console.error(`Unknown mode: ${this.mode}`);
                this.showHelp();
        }
    }

    async initializeAPI() {
        try {
            console.log('Initializing TastyTrade API...');
            this.api = new TastyTradeAPI();
            
            const credentialsPath = path.join(__dirname, 'credentials.config.js');
            if (!fs.existsSync(credentialsPath)) {
                console.log('⚠️  No credentials found. Running in manual data mode.');
                return;
            }
            
            const credentials = require(credentialsPath);
            const authenticated = await this.api.authenticate(
                credentials.username,
                credentials.password
            );
            
            if (authenticated) {
                console.log('✅ API authenticated successfully');
                await this.api.loadAccountData();
            } else {
                console.log('⚠️  API authentication failed. Running in manual mode.');
            }
        } catch (error) {
            console.log('⚠️  API initialization failed:', error.message);
        }
    }

    async initializeLiveTrading() {
        console.log('\n⚠️  LIVE TRADING MODE - ORDERS WILL BE EXECUTED');
        console.log('This mode is currently disabled for safety.');
        console.log('Use paper trading mode to test strategies.\n');
        process.exit(0);
    }

    async initializePaperTrading() {
        console.log('\n📝 PAPER TRADING MODE');
        console.log('Simulating trades with real market data...\n');
        
        this.orderManager = new OrderManager(this.api, this.riskManager);
        
        // Load current market data
        await this.loadMarketData();
        
        // Generate signals
        const signals = await this.generateSignals();
        
        // Display recommendations
        this.displayRecommendations(signals);
        
        // Process paper trades
        await this.processPaperTrades(signals);
        
        // Save portfolio state
        this.savePaperPortfolio();
        
        // Generate report
        await this.generatePaperTradingReport();
    }

    async initializeBacktesting() {
        console.log('\n📊 BACKTESTING MODE');
        console.log('Running historical analysis...\n');
        
        this.backtester = new BacktestingEngine();
        
        // Get backtest parameters
        const params = await this.getBacktestParameters();
        
        // Run backtest
        const results = await this.backtester.runComprehensiveBacktest({
            startDate: params.startDate,
            endDate: params.endDate,
            initialBalance: params.balance,
            strategies: params.strategies,
            includeAugust2024: params.includeAugust
        });
        
        // Display results
        this.displayBacktestResults(results);
        
        // Generate Excel report
        await generateComprehensiveExcelReport(results, 'backtest_results.xlsx');
    }

    async runDailyAnalysis() {
        console.log('\n📈 DAILY ANALYSIS MODE');
        console.log('Analyzing current market conditions...\n');
        
        // Get current market data
        const marketData = await this.loadMarketData();
        
        // Analyze each strategy
        const analysis = {};
        for (const [strategyName, strategy] of Object.entries(strategies)) {
            const pattern = await this.patternAnalyzer.analyzeForStrategy(
                marketData,
                strategyName
            );
            
            const signal = this.signalGenerator.generateSignal(
                strategyName,
                pattern,
                marketData
            );
            
            analysis[strategyName] = {
                pattern,
                signal,
                recommendation: signal.action !== 'WAIT' ? signal : null
            };
        }
        
        // Display analysis
        this.displayDailyAnalysis(analysis, marketData);
        
        // Save analysis
        this.saveDailyAnalysis(analysis);
        
        // Generate report
        await this.generateDailyReport(analysis);
    }

    async startDashboard() {
        console.log('\n🖥️  STARTING WEB DASHBOARD');
        console.log('Dashboard will be available at http://localhost:3000\n');
        
        // Start the dashboard server
        require('./src/app');
    }

    async showInteractiveMenu() {
        console.log('\n📋 INTERACTIVE MODE\n');
        console.log('Select an option:');
        console.log('1. Paper Trading with API Data');
        console.log('2. Paper Trading with Manual Data');
        console.log('3. Run Backtest (2 Years)');
        console.log('4. Daily Market Analysis');
        console.log('5. Start Web Dashboard');
        console.log('6. Generate Reports');
        console.log('7. Exit\n');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question('Enter choice (1-7): ', resolve);
        });
        rl.close();
        
        switch(answer) {
            case '1':
                this.mode = 'paper';
                await this.initialize();
                break;
            case '2':
                this.mode = 'paper';
                await this.initializePaperTrading();
                break;
            case '3':
                this.mode = 'backtest';
                await this.initializeBacktesting();
                break;
            case '4':
                this.mode = 'analysis';
                await this.runDailyAnalysis();
                break;
            case '5':
                this.mode = 'dashboard';
                await this.startDashboard();
                break;
            case '6':
                await this.generateAllReports();
                break;
            case '7':
                console.log('Exiting...');
                process.exit(0);
            default:
                console.log('Invalid choice');
                await this.showInteractiveMenu();
        }
    }

    async loadMarketData() {
        const data = {};
        
        if (this.api && this.api.isAuthenticated) {
            // Load from API
            console.log('Loading market data from API...');
            data.SPY = await this.api.getQuote('SPY');
            data.VIX = await this.api.getQuote('VIX');
            data.options = await this.api.getOptionChain('SPY');
        } else {
            // Manual input
            console.log('Enter current market data:');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            data.SPY = await new Promise(resolve => {
                rl.question('SPY Price: ', price => resolve({ last: parseFloat(price) }));
            });
            
            data.VIX = await new Promise(resolve => {
                rl.question('VIX Level: ', vix => resolve({ last: parseFloat(vix) }));
            });
            
            rl.close();
        }
        
        this.currentVIX = data.VIX.last;
        return data;
    }

    async generateSignals() {
        const signals = [];
        const marketData = await this.loadMarketData();
        
        for (const [name, strategy] of Object.entries(strategies)) {
            if (this.shouldAnalyzeStrategy(name)) {
                const pattern = await this.patternAnalyzer.analyzeForStrategy(
                    marketData,
                    name
                );
                
                const signal = this.signalGenerator.generateSignal(
                    name,
                    pattern,
                    marketData
                );
                
                if (signal.action !== 'WAIT') {
                    signals.push({
                        strategy: name,
                        ...signal
                    });
                }
            }
        }
        
        return signals;
    }

    shouldAnalyzeStrategy(strategyName) {
        const day = new Date().getDay();
        const hour = new Date().getHours();
        
        // Check day and time restrictions
        if (strategyName === 'zeroDTE' && day !== 5) return false; // Friday only
        if (strategyName === 'zeroDTE' && hour < 10) return false; // After 10:30 AM
        if (strategyName === 'longTerm112' && day > 3) return false; // Mon-Wed
        if (strategyName === 'strangles' && day !== 2) return false; // Tuesday
        
        return true;
    }

    displayRecommendations(signals) {
        console.log('\n📊 TRADE RECOMMENDATIONS\n');
        
        if (signals.length === 0) {
            console.log('No trades recommended for current conditions.');
            return;
        }
        
        const maxBP = this.riskManager.getMaxBPUsage(this.currentVIX);
        console.log(`VIX Level: ${this.currentVIX}`);
        console.log(`Max BP Usage: ${(maxBP * 100).toFixed(0)}%`);
        console.log(`Account Balance: £${this.accountBalance.toLocaleString()}\n`);
        
        signals.forEach((signal, i) => {
            console.log(`\n${i + 1}. ${signal.strategy.toUpperCase()}`);
            console.log(`   Action: ${signal.action}`);
            console.log(`   Symbol: ${signal.symbol}`);
            console.log(`   Type: ${signal.type}`);
            console.log(`   Strike(s): ${signal.strikes}`);
            console.log(`   Expiration: ${signal.expiration}`);
            console.log(`   Size: ${signal.size} contracts`);
            console.log(`   Confidence: ${signal.confidence}%`);
            console.log(`   Risk: £${signal.risk}`);
            console.log(`   Target: £${signal.target}`);
        });
    }

    async processPaperTrades(signals) {
        console.log('\n💼 PROCESSING PAPER TRADES\n');
        
        for (const signal of signals) {
            // Check risk limits
            const riskCheck = this.riskManager.checkPositionRisk({
                strategy: signal.strategy,
                risk: signal.risk,
                correlationGroup: signal.correlationGroup,
                currentBPUsage: this.calculateCurrentBPUsage()
            });
            
            if (riskCheck.allowed) {
                // Add to paper portfolio
                this.paperPortfolio.positions.push({
                    ...signal,
                    entryDate: new Date().toISOString(),
                    status: 'OPEN'
                });
                
                console.log(`✅ Paper trade executed: ${signal.strategy}`);
            } else {
                console.log(`❌ Trade rejected: ${riskCheck.reason}`);
            }
        }
    }

    calculateCurrentBPUsage() {
        const totalBP = this.accountBalance;
        const usedBP = this.paperPortfolio.positions
            .filter(p => p.status === 'OPEN')
            .reduce((sum, p) => sum + p.risk, 0);
        
        return usedBP / totalBP;
    }

    loadPaperPortfolio() {
        const portfolioPath = path.join(__dirname, 'paper_portfolio.json');
        if (fs.existsSync(portfolioPath)) {
            return JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
        }
        
        return {
            positions: [],
            closedTrades: [],
            performance: {
                totalPL: 0,
                winRate: 0,
                totalTrades: 0
            }
        };
    }

    savePaperPortfolio() {
        const portfolioPath = path.join(__dirname, 'paper_portfolio.json');
        fs.writeFileSync(
            portfolioPath,
            JSON.stringify(this.paperPortfolio, null, 2)
        );
        console.log('\n✅ Paper portfolio saved');
    }

    async generatePaperTradingReport() {
        const report = {
            date: new Date().toISOString(),
            mode: 'PAPER_TRADING',
            account: {
                balance: this.accountBalance,
                vix: this.currentVIX,
                bpUsage: this.calculateCurrentBPUsage()
            },
            positions: this.paperPortfolio.positions,
            performance: this.paperPortfolio.performance
        };
        
        const reportPath = path.join(__dirname, 'reports', `paper_${Date.now()}.json`);
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Report saved: ${reportPath}`);
    }

    async getBacktestParameters() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const params = {};
        
        params.startDate = await new Promise(resolve => {
            rl.question('Start date (YYYY-MM-DD) [2023-01-01]: ', date => {
                resolve(date || '2023-01-01');
            });
        });
        
        params.endDate = await new Promise(resolve => {
            rl.question('End date (YYYY-MM-DD) [2024-12-31]: ', date => {
                resolve(date || '2024-12-31');
            });
        });
        
        params.balance = await new Promise(resolve => {
            rl.question('Initial balance (£) [35000]: ', balance => {
                resolve(parseFloat(balance) || 35000);
            });
        });
        
        params.includeAugust = await new Promise(resolve => {
            rl.question('Include August 2024 crash test? (y/n) [y]: ', answer => {
                resolve(answer !== 'n');
            });
        });
        
        params.strategies = Object.keys(strategies);
        
        rl.close();
        return params;
    }

    displayBacktestResults(results) {
        console.log('\n📊 BACKTEST RESULTS\n');
        console.log(`Period: ${results.startDate} to ${results.endDate}`);
        console.log(`Initial Balance: £${results.initialBalance.toLocaleString()}`);
        console.log(`Final Balance: £${results.finalBalance.toLocaleString()}`);
        console.log(`Total Return: ${results.totalReturn.toFixed(2)}%`);
        console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
        console.log(`Max Drawdown: ${results.maxDrawdown.toFixed(2)}%`);
        console.log(`Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
        
        if (results.august2024Test) {
            console.log('\nAugust 2024 Crash Test:');
            console.log(`  Survived: ${results.august2024Test.survived ? '✅' : '❌'}`);
            console.log(`  Drawdown: ${results.august2024Test.drawdown.toFixed(2)}%`);
        }
    }

    displayDailyAnalysis(analysis, marketData) {
        console.log('\n📈 DAILY MARKET ANALYSIS\n');
        console.log(`Date: ${new Date().toLocaleDateString()}`);
        console.log(`SPY: $${marketData.SPY.last}`);
        console.log(`VIX: ${marketData.VIX.last}\n`);
        
        Object.entries(analysis).forEach(([strategy, data]) => {
            if (data.recommendation) {
                console.log(`\n${strategy.toUpperCase()}`);
                console.log(`  Signal: ${data.signal.action}`);
                console.log(`  Confidence: ${data.signal.confidence}%`);
                console.log(`  Pattern: ${data.pattern.patternType}`);
            }
        });
    }

    saveDailyAnalysis(analysis) {
        const date = new Date().toISOString().split('T')[0];
        const analysisPath = path.join(__dirname, 'daily_analysis', `${date}.json`);
        
        fs.mkdirSync(path.dirname(analysisPath), { recursive: true });
        fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));
        
        console.log(`\n✅ Analysis saved: ${analysisPath}`);
    }

    async generateDailyReport(analysis) {
        const report = {
            date: new Date().toISOString(),
            analysis,
            recommendations: Object.entries(analysis)
                .filter(([_, data]) => data.recommendation)
                .map(([strategy, data]) => ({
                    strategy,
                    ...data.recommendation
                }))
        };
        
        await generateComprehensiveExcelReport(report, `daily_${Date.now()}.xlsx`);
    }

    async generateAllReports() {
        console.log('\n📄 GENERATING ALL REPORTS\n');
        
        // Load all data
        const portfolio = this.loadPaperPortfolio();
        const dailyAnalysis = this.loadLatestDailyAnalysis();
        
        // Generate comprehensive report
        const report = {
            generatedAt: new Date().toISOString(),
            portfolio,
            dailyAnalysis,
            performance: this.calculatePerformanceMetrics(portfolio)
        };
        
        // Generate Excel report
        await generateComprehensiveExcelReport(report, 'comprehensive_report.xlsx');
        
        console.log('✅ All reports generated successfully');
    }

    loadLatestDailyAnalysis() {
        const analysisDir = path.join(__dirname, 'daily_analysis');
        if (!fs.existsSync(analysisDir)) return null;
        
        const files = fs.readdirSync(analysisDir)
            .filter(f => f.endsWith('.json'))
            .sort()
            .reverse();
        
        if (files.length === 0) return null;
        
        return JSON.parse(
            fs.readFileSync(path.join(analysisDir, files[0]), 'utf8')
        );
    }

    calculatePerformanceMetrics(portfolio) {
        const closedTrades = portfolio.closedTrades || [];
        const winningTrades = closedTrades.filter(t => t.pl > 0);
        
        return {
            totalTrades: closedTrades.length,
            winningTrades: winningTrades.length,
            winRate: closedTrades.length > 0 
                ? (winningTrades.length / closedTrades.length * 100)
                : 0,
            totalPL: closedTrades.reduce((sum, t) => sum + t.pl, 0),
            averageWin: winningTrades.length > 0
                ? winningTrades.reduce((sum, t) => sum + t.pl, 0) / winningTrades.length
                : 0,
            averageLoss: closedTrades.filter(t => t.pl < 0).length > 0
                ? closedTrades.filter(t => t.pl < 0).reduce((sum, t) => sum + t.pl, 0) / 
                  closedTrades.filter(t => t.pl < 0).length
                : 0
        };
    }

    showHelp() {
        console.log('\nUsage: node index.js [OPTIONS]\n');
        console.log('Options:');
        console.log('  --mode=live       Live trading mode (disabled for safety)');
        console.log('  --mode=paper      Paper trading with market data');
        console.log('  --mode=backtest   Run historical backtesting');
        console.log('  --mode=analysis   Daily market analysis');
        console.log('  --mode=dashboard  Start web dashboard');
        console.log('\nIf no mode specified, interactive menu will be shown.\n');
    }
}

// Main execution
async function main() {
    try {
        const framework = new UnifiedTradingFramework();
        await framework.initialize();
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        logger.error('Framework error:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = UnifiedTradingFramework;