/**
 * Test Account Tracking and Balance Investigation
 * Investigates why balance shows $0 and implements automated tracking
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const fs = require('fs').promises;
const path = require('path');

class AccountTracker {
    constructor(api) {
        this.api = api;
        this.trackingData = {
            timestamp: new Date().toISOString(),
            account: null,
            balance: null,
            positions: [],
            greeks: {
                portfolio: {
                    delta: 0,
                    gamma: 0,
                    theta: 0,
                    vega: 0
                }
            },
            diversification: {
                sectors: {},
                correlationGroups: {},
                assetTypes: {}
            },
            performance: {
                dailyPL: 0,
                unrealizedPL: 0,
                realizedPL: 0,
                winRate: 0,
                totalTrades: 0
            }
        };
    }

    async investigateBalance() {
        console.log('\n' + '='.repeat(70));
        console.log('🔍 INVESTIGATING ACCOUNT BALANCE ISSUE');
        console.log('='.repeat(70));
        
        // Test different balance endpoints
        console.log('\n1️⃣ Testing /balances endpoint:');
        try {
            const balanceData = await this.api.request(`/accounts/${this.api.accountNumber}/balances`);
            console.log('Raw balance response:', JSON.stringify(balanceData, null, 2));
            
            if (balanceData.data) {
                const b = balanceData.data;
                console.log('\nParsed values:');
                console.log(`  net-liquidating-value: ${b['net-liquidating-value']} (raw)`);
                console.log(`  cash-balance: ${b['cash-balance']} (raw)`);
                console.log(`  derivative-buying-power: ${b['derivative-buying-power']} (raw)`);
                console.log(`  account-number: ${b['account-number']}`);
                
                // Check if values are strings that need parsing
                if (typeof b['net-liquidating-value'] === 'string') {
                    const parsed = parseFloat(b['net-liquidating-value'].replace(/[$,]/g, ''));
                    console.log(`  Parsed net-liq: $${parsed.toFixed(2)}`);
                }
            }
        } catch (error) {
            console.error('Balance endpoint failed:', error.message);
        }

        console.log('\n2️⃣ Testing /net-liq-history endpoint:');
        try {
            const historyData = await this.api.request(`/accounts/${this.api.accountNumber}/net-liq-history`);
            console.log('Net liq history:', JSON.stringify(historyData, null, 2));
        } catch (error) {
            console.error('Net liq history failed:', error.message);
        }

        console.log('\n3️⃣ Testing /balances/balance-snapshots endpoint:');
        try {
            const snapshotData = await this.api.request(`/accounts/${this.api.accountNumber}/balances/balance-snapshots`);
            console.log('Balance snapshots:', JSON.stringify(snapshotData, null, 2));
        } catch (error) {
            console.error('Balance snapshots failed:', error.message);
        }

        console.log('\n4️⃣ Testing account details:');
        try {
            const accountData = await this.api.request(`/accounts/${this.api.accountNumber}`);
            console.log('Account details:', JSON.stringify(accountData, null, 2));
        } catch (error) {
            console.error('Account details failed:', error.message);
        }
    }

    async collectAccountData() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 COLLECTING ACCOUNT DATA FOR TRACKING');
        console.log('='.repeat(70));

        // Get account balance
        await this.api.refreshBalance();
        this.trackingData.balance = {
            netLiq: this.api.balance?.netLiq || 0,
            cashBalance: this.api.balance?.cashBalance || 0,
            buyingPower: this.api.balance?.buyingPower || 0,
            bpUsed: this.api.balance?.bpUsed || 0,
            bpUsedPercent: this.api.balance?.bpUsedPercent || 0,
            timestamp: new Date().toISOString()
        };

        console.log('\n💰 Balance Data:');
        console.log(`  Net Liquidating Value: $${this.trackingData.balance.netLiq}`);
        console.log(`  Cash Balance: $${this.trackingData.balance.cashBalance}`);
        console.log(`  Buying Power: $${this.trackingData.balance.buyingPower}`);
        console.log(`  BP Used: ${this.trackingData.balance.bpUsedPercent}%`);

        // Get positions
        await this.api.refreshPositions();
        if (this.api.positions && this.api.positions.length > 0) {
            console.log('\n📈 Positions:');
            this.trackingData.positions = this.api.positions.map(pos => {
                const posData = {
                    symbol: pos.symbol,
                    quantity: pos.quantity,
                    averagePrice: pos['average-open-price'] || 0,
                    currentPrice: pos['close-price'] || 0,
                    unrealizedPL: pos['unrealized-day-gain-loss'] || 0,
                    realizedPL: pos['realized-day-gain-loss'] || 0,
                    type: pos['instrument-type'],
                    underlyingSymbol: pos['underlying-symbol']
                };

                console.log(`  ${posData.symbol}: ${posData.quantity} @ $${posData.averagePrice}`);
                console.log(`    P&L: $${posData.unrealizedPL}`);

                // Calculate position Greeks if it's an option
                if (pos['instrument-type'] === 'Option') {
                    posData.greeks = {
                        delta: pos.delta || 0,
                        gamma: pos.gamma || 0,
                        theta: pos.theta || 0,
                        vega: pos.vega || 0
                    };
                    
                    // Add to portfolio Greeks
                    this.trackingData.greeks.portfolio.delta += posData.greeks.delta * posData.quantity;
                    this.trackingData.greeks.portfolio.gamma += posData.greeks.gamma * posData.quantity;
                    this.trackingData.greeks.portfolio.theta += posData.greeks.theta * posData.quantity;
                    this.trackingData.greeks.portfolio.vega += posData.greeks.vega * posData.quantity;
                }

                return posData;
            });

            console.log('\n🎯 Portfolio Greeks:');
            console.log(`  Delta: ${this.trackingData.greeks.portfolio.delta.toFixed(2)}`);
            console.log(`  Gamma: ${this.trackingData.greeks.portfolio.gamma.toFixed(2)}`);
            console.log(`  Theta: ${this.trackingData.greeks.portfolio.theta.toFixed(2)}`);
            console.log(`  Vega: ${this.trackingData.greeks.portfolio.vega.toFixed(2)}`);
        } else {
            console.log('\n📈 No open positions');
        }

        // Calculate diversification metrics
        this.calculateDiversification();

        return this.trackingData;
    }

    calculateDiversification() {
        if (this.trackingData.positions.length === 0) return;

        console.log('\n🌐 Diversification Analysis:');

        // Group by asset type
        this.trackingData.positions.forEach(pos => {
            const type = pos.type || 'Unknown';
            if (!this.trackingData.diversification.assetTypes[type]) {
                this.trackingData.diversification.assetTypes[type] = {
                    count: 0,
                    totalValue: 0
                };
            }
            this.trackingData.diversification.assetTypes[type].count++;
            this.trackingData.diversification.assetTypes[type].totalValue += 
                Math.abs(pos.quantity * pos.currentPrice);
        });

        console.log('  Asset Types:', this.trackingData.diversification.assetTypes);

        // Identify correlation groups (simplified)
        const correlationGroups = {
            'Tech': ['QQQ', 'AAPL', 'MSFT', 'GOOGL', 'META'],
            'Index': ['SPY', 'SPX', 'ES', 'MES'],
            'SmallCap': ['IWM', 'RTY', 'M2K'],
            'Volatility': ['VIX', 'VXX', 'UVXY'],
            'Bonds': ['TLT', 'TLH', 'ZB'],
            'Commodities': ['GLD', 'SLV', 'CL', 'GC']
        };

        this.trackingData.positions.forEach(pos => {
            const symbol = pos.underlyingSymbol || pos.symbol;
            for (const [group, symbols] of Object.entries(correlationGroups)) {
                if (symbols.some(s => symbol.includes(s))) {
                    if (!this.trackingData.diversification.correlationGroups[group]) {
                        this.trackingData.diversification.correlationGroups[group] = {
                            count: 0,
                            symbols: []
                        };
                    }
                    this.trackingData.diversification.correlationGroups[group].count++;
                    this.trackingData.diversification.correlationGroups[group].symbols.push(symbol);
                    break;
                }
            }
        });

        console.log('  Correlation Groups:', this.trackingData.diversification.correlationGroups);
    }

    async exportToCSV() {
        console.log('\n' + '='.repeat(70));
        console.log('📝 EXPORTING TO CSV');
        console.log('='.repeat(70));

        const timestamp = new Date().toISOString().split('T')[0];
        const csvPath = path.join(__dirname, 'tracking', `account_tracking_${timestamp}.csv`);

        // Create tracking directory if it doesn't exist
        await fs.mkdir(path.join(__dirname, 'tracking'), { recursive: true });

        // Create CSV content
        let csvContent = 'Date,Time,Net Liq,Cash,Buying Power,BP Used %,Portfolio Delta,Portfolio Theta,Positions Count\n';
        
        const now = new Date();
        const date = now.toLocaleDateString('en-GB');
        const time = now.toLocaleTimeString('en-GB');
        
        csvContent += `${date},${time},`;
        csvContent += `${this.trackingData.balance.netLiq},`;
        csvContent += `${this.trackingData.balance.cashBalance},`;
        csvContent += `${this.trackingData.balance.buyingPower},`;
        csvContent += `${this.trackingData.balance.bpUsedPercent},`;
        csvContent += `${this.trackingData.greeks.portfolio.delta.toFixed(2)},`;
        csvContent += `${this.trackingData.greeks.portfolio.theta.toFixed(2)},`;
        csvContent += `${this.trackingData.positions.length}\n`;

        // Add positions section
        if (this.trackingData.positions.length > 0) {
            csvContent += '\nPositions:\n';
            csvContent += 'Symbol,Quantity,Avg Price,Current Price,Unrealized P&L,Delta,Theta\n';
            
            this.trackingData.positions.forEach(pos => {
                csvContent += `${pos.symbol},${pos.quantity},${pos.averagePrice},${pos.currentPrice},`;
                csvContent += `${pos.unrealizedPL},`;
                if (pos.greeks) {
                    csvContent += `${pos.greeks.delta},${pos.greeks.theta}`;
                }
                csvContent += '\n';
            });
        }

        await fs.writeFile(csvPath, csvContent);
        console.log(`✅ Exported to: ${csvPath}`);

        // Also save as JSON for more detailed tracking
        const jsonPath = path.join(__dirname, 'tracking', `account_tracking_${timestamp}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(this.trackingData, null, 2));
        console.log(`✅ JSON saved to: ${jsonPath}`);

        return { csv: csvPath, json: jsonPath };
    }

    async createDailyReport() {
        console.log('\n' + '='.repeat(70));
        console.log('📊 DAILY TRACKING REPORT');
        console.log('='.repeat(70));

        const report = {
            date: new Date().toLocaleDateString('en-GB'),
            time: new Date().toLocaleTimeString('en-GB'),
            account: this.api.accountNumber,
            mode: process.env.TRADING_MODE || 'real',
            
            '💰 Account Summary': {
                'Net Liquidating Value': `$${this.trackingData.balance.netLiq}`,
                'Cash Balance': `$${this.trackingData.balance.cashBalance}`,
                'Buying Power': `$${this.trackingData.balance.buyingPower}`,
                'BP Used': `${this.trackingData.balance.bpUsedPercent}%`
            },

            '🎯 Greeks Summary': {
                'Portfolio Delta': this.trackingData.greeks.portfolio.delta.toFixed(2),
                'Portfolio Gamma': this.trackingData.greeks.portfolio.gamma.toFixed(2),
                'Portfolio Theta': this.trackingData.greeks.portfolio.theta.toFixed(2),
                'Portfolio Vega': this.trackingData.greeks.portfolio.vega.toFixed(2)
            },

            '📈 Position Summary': {
                'Total Positions': this.trackingData.positions.length,
                'Asset Types': Object.keys(this.trackingData.diversification.assetTypes).join(', '),
                'Correlation Groups': Object.keys(this.trackingData.diversification.correlationGroups).join(', ')
            },

            '💡 Tom King Alignment': {
                'Max BP Usage Rule': this.trackingData.balance.bpUsedPercent <= 65 ? '✅ Within limits' : '⚠️ Exceeds 65%',
                'Correlation Groups': Object.keys(this.trackingData.diversification.correlationGroups).length <= 3 ? '✅ Diversified' : '⚠️ Too concentrated'
            }
        };

        console.log(JSON.stringify(report, null, 2));
        return report;
    }
}

async function runAccountTrackingTest() {
    console.log('=' + '='.repeat(70));
    console.log('🔍 ACCOUNT TRACKING AND BALANCE INVESTIGATION');
    console.log('=' + '='.repeat(70));
    
    const ukTime = new Date().toLocaleTimeString('en-GB');
    const etTime = new Date().toLocaleTimeString('en-US', { 
        timeZone: 'America/New_York',
        hour12: false 
    });
    
    console.log(`\n📅 Time: ${ukTime} UK / ${etTime} ET`);
    
    try {
        // Test REAL mode to investigate $16.09 balance
        process.env.TRADING_MODE = 'real';
        
        // Clear module cache
        delete require.cache[require.resolve('./credentials.config.js')];
        delete require.cache[require.resolve('./src/tastytradeAPI.js')];
        
        const config = require('./credentials.config.js');
        const { TastyTradeAPI } = require('./src/tastytradeAPI');
        
        console.log(`\n🔐 Testing ${config.mode.toUpperCase()} mode`);
        console.log(`Account: ${config.accountNumber}`);
        
        const api = new TastyTradeAPI();
        await api.authenticate();
        
        const tracker = new AccountTracker(api);
        
        // Investigate why balance shows $0
        await tracker.investigateBalance();
        
        // Collect all account data
        await tracker.collectAccountData();
        
        // Export to CSV/JSON
        await tracker.exportToCSV();
        
        // Generate daily report
        await tracker.createDailyReport();
        
        console.log('\n' + '='.repeat(70));
        console.log('✅ ACCOUNT TRACKING TEST COMPLETE');
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
    }
}

// Run the test
runAccountTrackingTest().catch(console.error);