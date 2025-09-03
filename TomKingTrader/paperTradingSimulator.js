/**
 * PAPER TRADING SIMULATOR
 * Simulates the Tom King Trading Framework without real money
 * Perfect for testing strategies before funding your account
 */

const { MonthlyIncomeCalculator } = require('./src/monthlyIncomeCalculator');
const { CompoundingCalculator } = require('./src/compoundingCalculator');
const { UKTaxOptimizer } = require('./src/ukTaxOptimizer');
const { GreeksCalculator } = require('./src/greeksCalculator');

class PaperTradingSimulator {
    constructor(startingBalance = 35000) {
        console.log('\n🎮 PAPER TRADING SIMULATOR INITIALIZED');
        console.log('=' .repeat(60));
        
        // Initialize with pretend account balance
        this.account = {
            startingBalance: startingBalance,
            currentBalance: startingBalance,
            realizedPL: 0,
            unrealizedPL: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            currentPhase: this.determinePhase(startingBalance)
        };
        
        // Initialize agent systems
        this.monthlyIncome = new MonthlyIncomeCalculator();
        this.compounding = new CompoundingCalculator();
        this.taxOptimizer = new UKTaxOptimizer();
        this.greeksCalc = new GreeksCalculator();
        
        // Track open positions
        this.positions = [];
        
        // Tom King win rates for simulation
        this.winRates = {
            '0DTE': 0.88,    // 88% win rate
            'LT112': 0.73,   // 73% win rate
            'STRANGLE': 0.72 // 72% win rate
        };
        
        // Simulated market data
        this.marketData = {
            SPX: 4500,
            VIX: 18,
            ES: 4495,
            MES: 4495
        };
        
        console.log(`📊 Starting Balance: £${this.account.startingBalance.toLocaleString()}`);
        console.log(`📈 Current Phase: ${this.account.currentPhase}`);
        console.log(`🎯 Target: £80,000 in 8 months`);
        console.log('=' .repeat(60) + '\n');
    }
    
    /**
     * Determine account phase based on balance
     */
    determinePhase(balance) {
        if (balance < 40000) return 1;
        if (balance < 60000) return 2;
        if (balance < 75000) return 3;
        return 4;
    }
    
    /**
     * Run daily trading simulation
     */
    async runDailySimulation(mockDate = null) {
        console.log('\n📅 RUNNING DAILY SIMULATION');
        console.log('-'.repeat(50));
        
        // Use mock date if provided (for backtesting), otherwise use current date
        const simulationDate = mockDate || new Date();
        const dayOfWeek = simulationDate.getDay();
        const hour = simulationDate.getHours();
        const dayOfMonth = simulationDate.getDate();
        
        // Check what strategies to run today
        const strategies = [];
        
        // 0DTE Friday check (only on Fridays after 10:30 AM EST)
        if (dayOfWeek === 5 && hour >= 10) {
            strategies.push('0DTE');
            console.log('📍 Friday 0DTE Day - Tom King\'s signature strategy!');
        }
        
        // LT112 opportunities (any day, but prefer Tuesday/Thursday)
        if ([2, 4].includes(dayOfWeek) || Math.random() > 0.5) {
            strategies.push('LT112');
        }
        
        // Futures Strangles (prefer Monday/Wednesday for weekly setups)
        if ([1, 3].includes(dayOfWeek) || Math.random() > 0.6) {
            strategies.push('STRANGLE');
        }
        
        // If no strategies selected, at least run one
        if (strategies.length === 0) {
            strategies.push('LT112'); // Default to LT112
        }
        
        console.log(`📊 Account Balance: £${this.account.currentBalance.toLocaleString()}`);
        console.log(`📈 Phase: ${this.account.currentPhase}`);
        console.log(`📅 Date: ${simulationDate.toLocaleDateString('en-GB')}`);
        console.log(`🎯 Today's Strategies: ${strategies.join(', ')}`);
        
        // Calculate required positions based on phase
        const requirements = this.monthlyIncome.calculateMonthlyIncomeRequirements(
            this.account.currentBalance,
            null,
            this.marketData.VIX
        );
        
        console.log(`\n💰 Monthly Target: £${requirements.monthlyTarget.toLocaleString()}`);
        console.log(`📊 BP Required: £${(requirements.totals?.totalBPRequired || 0).toLocaleString()}`);
        console.log(`✅ Feasibility: ${requirements.feasibility?.achievable ? 'YES' : 'NO'}`);
        
        // Track daily trades
        let dailyTrades = 0;
        let dailyPL = 0;
        
        // Simulate trades for each strategy with proper allocation
        for (const strategy of strategies) {
            const allocation = this.getStrategyAllocation(strategy);
            const tradeResult = await this.simulateTrade(strategy, requirements.strategies[strategy.toLowerCase()], allocation);
            if (tradeResult) {
                dailyTrades++;
                dailyPL += tradeResult.pl || 0;
            }
        }
        
        console.log(`\n📊 Daily Summary: ${dailyTrades} trades, P&L: £${dailyPL.toFixed(2)}`);
        
        // Update P&L
        this.updatePL();
        
        // Check for phase transition
        const newPhase = this.determinePhase(this.account.currentBalance);
        if (newPhase !== this.account.currentPhase) {
            console.log(`\n🎉 PHASE TRANSITION: ${this.account.currentPhase} → ${newPhase}`);
            this.account.currentPhase = newPhase;
        }
        
        return this.getDailySummary();
    }
    
    /**
     * Get strategy allocation based on Tom King methodology
     */
    getStrategyAllocation(strategy) {
        const allocations = {
            '0DTE': 0.40,    // 40% for 0DTE Friday
            'LT112': 0.35,   // 35% for Long-Term 112
            'STRANGLE': 0.25 // 25% for Futures Strangles
        };
        return allocations[strategy] || 0.33;
    }
    
    /**
     * Simulate a single trade
     */
    async simulateTrade(strategy, requirements, allocation = 0.33) {
        // Skip if no requirements or if buying power exceeded
        if (!requirements && strategy !== '0DTE') return null;
        
        console.log(`\n📈 Simulating ${strategy} Trade:`);
        
        // Simulate win/loss based on Tom King win rates
        const isWinner = Math.random() < this.winRates[strategy];
        
        // Calculate position size based on allocation and account balance
        const allocatedCapital = this.account.currentBalance * allocation;
        
        // Strategy-specific parameters
        let avgCredit, contracts, bpRequired;
        
        if (strategy === '0DTE') {
            // 0DTE Friday specific parameters
            avgCredit = 0.40 + Math.random() * 0.30; // $0.40-0.70 typical for 10-delta
            contracts = Math.max(1, Math.floor(allocatedCapital / 5000)); // Conservative sizing
            bpRequired = contracts * 500; // Lower BP for 0DTE
        } else if (strategy === 'STRANGLE') {
            // Futures strangle parameters
            avgCredit = 1.00 + Math.random() * 0.50; // $1.00-1.50 for strangles
            contracts = Math.max(1, Math.floor(allocatedCapital / 8000));
            bpRequired = contracts * 2000; // Higher BP for strangles
        } else {
            // LT112 parameters
            avgCredit = requirements?.avgCredit || (1.20 + Math.random() * 0.60); // $1.20-1.80
            contracts = requirements?.contractsNeeded || Math.max(1, Math.floor(allocatedCapital / 10000));
            bpRequired = requirements?.bpRequired || (contracts * 1500);
        }
        
        // Check buying power constraint (VIX-based dynamic: 45-80%)
        const { RiskManager } = require('./src/riskManager');
        const vixLevel = this.currentVIX || 20; // Default VIX if not available
        const maxBPUsage = RiskManager.getMaxBPUsage(vixLevel) / 100;
        
        if (bpRequired > this.account.currentBalance * maxBPUsage) {
            console.log(`  ⚠️ BP constraint exceeded (${(bpRequired/this.account.currentBalance*100).toFixed(1)}% > ${(maxBPUsage*100).toFixed(0)}% for VIX ${vixLevel})`);
            contracts = Math.floor((this.account.currentBalance * maxBPUsage) / (bpRequired / contracts));
            bpRequired = contracts * (bpRequired / (requirements?.contractsNeeded || contracts));
        }
        
        const position = {
            id: `SIM_${Date.now()}_${strategy}`,
            strategy: strategy,
            openDate: new Date().toISOString(),
            contracts: contracts,
            creditReceived: avgCredit * contracts * 100,
            bpUsed: bpRequired,
            status: 'OPEN',
            daysToExpiry: strategy === '0DTE' ? 0 : 45,
            allocation: allocation
        };
        
        // Simulate immediate close for paper trading
        if (isWinner) {
            // Winner - keep most of credit
            position.pl = position.creditReceived * 0.5; // 50% profit target
            position.status = 'CLOSED_WIN';
            this.account.winningTrades++;
        } else {
            // Loser - lose 2x credit
            position.pl = -position.creditReceived * 2;
            position.status = 'CLOSED_LOSS';
            this.account.losingTrades++;
        }
        
        position.closeDate = new Date().toISOString();
        
        // Update account
        this.account.currentBalance += position.pl;
        this.account.realizedPL += position.pl;
        this.account.totalTrades++;
        
        // Track position
        this.positions.push(position);
        
        console.log(`  Strategy: ${strategy}`);
        console.log(`  Contracts: ${position.contracts}`);
        console.log(`  Credit: £${position.creditReceived.toFixed(2)}`);
        console.log(`  Result: ${position.status}`);
        console.log(`  P&L: £${position.pl.toFixed(2)}`);
        
        return position;
    }
    
    /**
     * Update unrealized P&L for open positions
     */
    updatePL() {
        this.account.unrealizedPL = 0;
        
        this.positions.filter(p => p.status === 'OPEN').forEach(position => {
            // Simulate theta decay
            position.daysToExpiry--;
            
            // Simulate unrealized P&L
            if (position.daysToExpiry <= 21) {
                // Defensive management at 21 DTE
                position.unrealizedPL = -position.creditReceived * 0.5;
            } else {
                // Normal theta decay
                position.unrealizedPL = position.creditReceived * 0.1;
            }
            
            this.account.unrealizedPL += position.unrealizedPL;
        });
    }
    
    /**
     * Get daily summary
     */
    getDailySummary() {
        const winRate = this.account.totalTrades > 0 ? 
            (this.account.winningTrades / this.account.totalTrades * 100).toFixed(1) : 0;
        
        return {
            date: new Date().toISOString().split('T')[0],
            startingBalance: this.account.startingBalance,
            currentBalance: this.account.currentBalance,
            dailyPL: this.account.realizedPL,
            unrealizedPL: this.account.unrealizedPL,
            totalPL: this.account.realizedPL + this.account.unrealizedPL,
            totalTrades: this.account.totalTrades,
            winRate: winRate + '%',
            currentPhase: this.account.currentPhase,
            progressToTarget: ((this.account.currentBalance / 80000) * 100).toFixed(1) + '%'
        };
    }
    
    /**
     * Run monthly analysis
     */
    runMonthlyAnalysis() {
        console.log('\n📊 MONTHLY ANALYSIS');
        console.log('=' .repeat(60));
        
        // Calculate compound growth
        const monthlyReturn = ((this.account.currentBalance - this.account.startingBalance) / 
                               this.account.startingBalance) * 100;
        
        // Get compound targets
        const compoundTargets = this.compounding.calculateCompoundTargets(
            this.account.startingBalance, 
            1
        );
        
        // Tax analysis
        const taxAnalysis = this.taxOptimizer.calculateUKTaxLiability(
            this.positions.filter(p => p.status.includes('CLOSED'))
        );
        
        console.log(`\n💰 Financial Summary:`);
        console.log(`  Starting: £${this.account.startingBalance.toLocaleString()}`);
        console.log(`  Current: £${this.account.currentBalance.toLocaleString()}`);
        console.log(`  Target: £${compoundTargets.progression[1].capital.toLocaleString()}`);
        console.log(`  Monthly Return: ${monthlyReturn.toFixed(2)}%`);
        console.log(`  Target Return: 12.00%`);
        console.log(`  On Track: ${monthlyReturn >= 12 ? '✅ YES' : '❌ NO'}`);
        
        console.log(`\n📈 Trading Performance:`);
        console.log(`  Total Trades: ${this.account.totalTrades}`);
        console.log(`  Winners: ${this.account.winningTrades}`);
        console.log(`  Losers: ${this.account.losingTrades}`);
        console.log(`  Win Rate: ${(this.account.winningTrades / this.account.totalTrades * 100).toFixed(1)}%`);
        
        console.log(`\n💷 UK Tax Position:`);
        console.log(`  Net Gains (GBP): £${taxAnalysis.gbp.netRealized}`);
        console.log(`  CGT Allowance Used: £${taxAnalysis.gbp.allowanceUsed}`);
        console.log(`  Taxable Gains: £${taxAnalysis.gbp.taxableGains}`);
        console.log(`  Est. Tax Liability: £${taxAnalysis.tax.liability}`);
        
        return {
            monthlyReturn,
            targetMet: monthlyReturn >= 12,
            compoundOnTrack: this.account.currentBalance >= compoundTargets.progression[1].capital,
            taxPosition: taxAnalysis
        };
    }
    
    /**
     * Simulate 8-month journey
     */
    async simulate8MonthJourney() {
        console.log('\n🚀 SIMULATING 8-MONTH JOURNEY TO £80K');
        console.log('=' .repeat(60));
        
        const results = [];
        
        for (let month = 1; month <= 8; month++) {
            console.log(`\n📅 MONTH ${month}`);
            console.log('-'.repeat(40));
            
            // Run 20 trading days per month
            for (let day = 1; day <= 20; day++) {
                // Simulate different days of week
                const mockDate = new Date();
                mockDate.setDate(mockDate.getDate() + day);
                
                // Run daily simulation
                await this.runDailySimulation();
                
                // Small delay for realism
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Monthly analysis
            const monthlyResult = this.runMonthlyAnalysis();
            results.push({
                month,
                balance: this.account.currentBalance,
                return: monthlyResult.monthlyReturn,
                onTrack: monthlyResult.compoundOnTrack
            });
            
            // Check if target reached
            if (this.account.currentBalance >= 80000) {
                console.log(`\n🎉 TARGET REACHED IN MONTH ${month}!`);
                break;
            }
        }
        
        // Final summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 FINAL RESULTS');
        console.log('=' .repeat(60));
        console.log(`Starting Balance: £${this.account.startingBalance.toLocaleString()}`);
        console.log(`Final Balance: £${this.account.currentBalance.toLocaleString()}`);
        console.log(`Total Return: ${((this.account.currentBalance - this.account.startingBalance) / this.account.startingBalance * 100).toFixed(2)}%`);
        console.log(`Target Achieved: ${this.account.currentBalance >= 80000 ? '✅ YES' : '❌ NO'}`);
        
        return results;
    }
}

// Run simulator if executed directly
if (require.main === module) {
    console.log('🎮 TOM KING TRADING FRAMEWORK - PAPER TRADING MODE');
    console.log('=' .repeat(60));
    console.log('This simulator uses pretend money for testing strategies');
    console.log('Perfect for learning before funding your real account!\n');
    
    const simulator = new PaperTradingSimulator(35000);
    
    // Run daily simulation
    simulator.runDailySimulation().then(summary => {
        console.log('\n📊 Daily Summary:', summary);
        
        // Option to run full 8-month simulation
        console.log('\n💡 To run full 8-month simulation:');
        console.log('   simulator.simulate8MonthJourney()');
    });
}

module.exports = { PaperTradingSimulator };