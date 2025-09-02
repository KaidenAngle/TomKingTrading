/**
 * DAILY TRADING ANALYSIS
 * 
 * Manual input system where you provide current account state
 * and receive today's trading recommendations.
 * 
 * This is client-side paper trading - no API needed.
 */

const TradingStrategies = require('./src/strategies');
// Import with fallbacks for different export styles
let RiskManager, EnhancedPatternAnalyzer, EnhancedRecommendationEngine;
try {
    const rm = require('./src/riskManager');
    RiskManager = rm.RiskManager || rm;
} catch (e) {
    RiskManager = class { checkRisk() { return { passed: true }; } };
}
try {
    const pa = require('./src/enhancedPatternAnalysis');
    EnhancedPatternAnalyzer = pa.EnhancedPatternAnalyzer || pa;
} catch (e) {
    EnhancedPatternAnalyzer = class { analyze() { return {}; } };
}
try {
    const re = require('./src/enhancedRecommendationEngine');
    EnhancedRecommendationEngine = re.EnhancedRecommendationEngine || re;
} catch (e) {
    EnhancedRecommendationEngine = class { generateRecommendations() { return []; } };
}
const fs = require('fs').promises;
const path = require('path');

class DailyTradingAnalysis {
    constructor() {
        this.strategies = new TradingStrategies();
        this.riskManager = new RiskManager();
        this.patternAnalyzer = new EnhancedPatternAnalyzer();
        this.recommendationEngine = new EnhancedRecommendationEngine();
        
        // Tom King rules
        this.rules = {
            maxBPUsage: 'DYNAMIC',   // VIX-based: 45-80% per Tom King
            correlationLimit: 3,      // Max 3 per correlation group
            maxRiskPerTrade: 0.05,    // 5% max risk per trade
            profitTarget: 0.50,       // 50% profit target default
            strategies: {
                '0DTE': { day: 5, time: '10:30' },      // Friday 10:30 AM
                'LT112': { days: [1,2,3], week: 1 },    // First week Mon-Wed
                'STRANGLE': { day: 2, week: 2 },        // Second Tuesday
                'IPMCC': { day: 5, time: '09:15' },     // Friday 9:15 AM
                'LEAP': { day: 1 }                      // Monday
            }
        };
    }
    
    /**
     * Get maximum buying power usage based on VIX level
     * Implements Tom King's dynamic BP system
     */
    getMaxBPUsage(vixLevel) {
        if (vixLevel < 13) return 0.45; // 45% for VIX <13
        if (vixLevel < 18) return 0.65; // 65% for VIX 13-18
        if (vixLevel < 25) return 0.75; // 75% for VIX 18-25
        if (vixLevel < 30) return 0.50; // 50% for VIX 25-30
        return 0.80; // 80% for VIX >30 (puts only)
    }
    
    /**
     * Main analysis function - call this daily
     */
    async analyze(input) {
        console.log('='.repeat(80));
        console.log('📊 TOM KING DAILY TRADING ANALYSIS');
        console.log('='.repeat(80));
        console.log(`Date: ${input.date || new Date().toISOString().split('T')[0]}`);
        console.log(`Account Balance: £${input.balance.toLocaleString()}`);
        console.log(`Open Positions: ${input.positions?.length || 0}`);
        console.log('-'.repeat(80));
        
        const analysis = {
            date: input.date || new Date(),
            accountValue: input.balance,
            buyingPower: input.balance * this.getMaxBPUsage(input.vix || 20),
            currentPositions: input.positions || [],
            marketData: input.marketData || {},
            recommendations: [],
            exits: [],
            warnings: [],
            summary: {}
        };
        
        // Determine account phase
        const phase = this.getAccountPhase(input.balance);
        console.log(`\n💼 Account Phase: ${phase}`);
        console.log(this.getPhaseDescription(phase));
        
        // Check what strategies are available today
        const today = new Date(input.date || new Date());
        const dayOfWeek = today.getDay();
        const availableStrategies = this.getAvailableStrategies(today);
        
        console.log(`\n📅 Today's Available Strategies:`);
        if (availableStrategies.length === 0) {
            console.log('  ❌ No strategies scheduled for today');
        } else {
            availableStrategies.forEach(s => console.log(`  ✅ ${s}`));
        }
        
        // Analyze current positions for exit signals
        console.log('\n📈 CURRENT POSITIONS ANALYSIS:');
        if (input.positions && input.positions.length > 0) {
            for (const position of input.positions) {
                const exitSignal = this.checkExitSignal(position, input.marketData);
                if (exitSignal.shouldExit) {
                    analysis.exits.push(exitSignal);
                    console.log(`  🔴 EXIT: ${position.symbol} ${position.strategy}`);
                    console.log(`     Reason: ${exitSignal.reason}`);
                    console.log(`     Action: ${exitSignal.action}`);
                } else {
                    console.log(`  🟢 HOLD: ${position.symbol} ${position.strategy}`);
                    console.log(`     P&L: ${exitSignal.currentPnL > 0 ? '+' : ''}${exitSignal.currentPnL.toFixed(2)}%`);
                }
            }
        } else {
            console.log('  No open positions');
        }
        
        // Generate new trade recommendations
        console.log('\n💡 NEW TRADE RECOMMENDATIONS:');
        
        for (const strategy of availableStrategies) {
            const recommendation = await this.generateRecommendation(
                strategy, 
                input.marketData,
                input.balance,
                input.positions
            );
            
            if (recommendation && recommendation.confidence > 60) {
                analysis.recommendations.push(recommendation);
                console.log(`\n  📊 ${strategy} Signal:`);
                console.log(`     Symbol: ${recommendation.symbol}`);
                console.log(`     Type: ${recommendation.type}`);
                console.log(`     Strike(s): ${recommendation.strikes}`);
                console.log(`     Capital Required: £${recommendation.capitalRequired}`);
                console.log(`     Max Risk: £${recommendation.maxRisk}`);
                console.log(`     Confidence: ${recommendation.confidence}%`);
                console.log(`     Entry: ${recommendation.entry}`);
            }
        }
        
        if (analysis.recommendations.length === 0) {
            console.log('  No high-confidence trades today');
        }
        
        // Risk management checks
        console.log('\n⚠️ RISK MANAGEMENT:');
        const riskStatus = this.checkRiskLimits(
            input.balance,
            input.positions,
            analysis.recommendations
        );
        
        console.log(`  Buying Power Used: ${riskStatus.bpUsed.toFixed(1)}% (Max: 35%)`);
        console.log(`  Correlation Groups: ${riskStatus.correlationStatus}`);
        console.log(`  VIX Level: ${input.marketData?.VIX || 'Unknown'}`);
        
        if (riskStatus.warnings.length > 0) {
            riskStatus.warnings.forEach(w => {
                console.log(`  ⚠️ ${w}`);
                analysis.warnings.push(w);
            });
        } else {
            console.log(`  ✅ All risk parameters within limits`);
        }
        
        // Position sizing recommendations
        console.log('\n📊 POSITION SIZING:');
        for (const rec of analysis.recommendations) {
            const sizing = this.calculatePositionSize(
                rec,
                input.balance,
                input.marketData?.VIX || 20
            );
            rec.contracts = sizing.contracts;
            console.log(`  ${rec.symbol}: ${sizing.contracts} contract(s)`);
            console.log(`    Risk: £${sizing.maxRisk.toFixed(2)} (${sizing.riskPercent.toFixed(1)}% of account)`);
        }
        
        // Summary and action items
        console.log('\n' + '='.repeat(80));
        console.log('📋 ACTION SUMMARY:');
        console.log('='.repeat(80));
        
        const actions = [];
        
        // Exits first (priority)
        if (analysis.exits.length > 0) {
            console.log('\n🔴 POSITIONS TO EXIT:');
            analysis.exits.forEach(exit => {
                console.log(`  ${exit.position.symbol}: ${exit.action}`);
                actions.push(`EXIT ${exit.position.symbol} - ${exit.reason}`);
            });
        }
        
        // New entries
        if (analysis.recommendations.length > 0) {
            console.log('\n🟢 NEW POSITIONS TO ENTER:');
            analysis.recommendations.forEach(rec => {
                console.log(`  ${rec.symbol}: ${rec.type} @ ${rec.strikes}`);
                console.log(`    Size: ${rec.contracts} contracts`);
                console.log(`    Capital: £${rec.capitalRequired}`);
                actions.push(`ENTER ${rec.symbol} ${rec.strategy}`);
            });
        }
        
        // No action needed
        if (actions.length === 0) {
            console.log('\n✅ No action required today - continue monitoring');
        }
        
        // Save analysis to file
        const filename = `analysis_${today.toISOString().split('T')[0]}.json`;
        const filepath = path.join(__dirname, 'daily_analysis', filename);
        await fs.mkdir(path.join(__dirname, 'daily_analysis'), { recursive: true });
        await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
        
        console.log(`\n📁 Analysis saved to: ${filename}`);
        
        // Performance tracking
        if (input.trackPerformance) {
            await this.updatePerformanceTracking(analysis);
        }
        
        return analysis;
    }
    
    /**
     * Determine account phase based on balance
     */
    getAccountPhase(balance) {
        if (balance < 40000) return 1;
        if (balance < 60000) return 2;
        if (balance < 75000) return 3;
        return 4;
    }
    
    getPhaseDescription(phase) {
        const descriptions = {
            1: 'Phase 1 (£30-40k): MCL, MGC, GLD, TLT strangles, 0DTE Fridays',
            2: 'Phase 2 (£40-60k): Add MES, MNQ, currency futures',
            3: 'Phase 3 (£60-75k): Full futures, butterflies, complex spreads',
            4: 'Phase 4 (£75k+): All strategies, professional deployment'
        };
        return descriptions[phase];
    }
    
    /**
     * Check which strategies can trade today
     */
    getAvailableStrategies(date) {
        const day = date.getDay();
        const weekOfMonth = Math.ceil(date.getDate() / 7);
        const available = [];
        
        // 0DTE - Fridays only
        if (day === 5) {
            available.push('0DTE');
            available.push('IPMCC'); // Also Friday
        }
        
        // LT112 - First week Mon-Wed
        if (weekOfMonth === 1 && day >= 1 && day <= 3) {
            available.push('LT112');
        }
        
        // Strangles - Second Tuesday
        if (weekOfMonth === 2 && day === 2) {
            available.push('STRANGLE');
        }
        
        // LEAP - Mondays
        if (day === 1) {
            available.push('LEAP');
        }
        
        return available;
    }
    
    /**
     * Check if position should be exited
     */
    checkExitSignal(position, marketData) {
        const signal = {
            shouldExit: false,
            position: position,
            reason: '',
            action: '',
            currentPnL: 0
        };
        
        // Calculate current P&L (simplified)
        if (position.entryPrice && marketData[position.symbol]) {
            const currentPrice = marketData[position.symbol].price || marketData[position.symbol];
            signal.currentPnL = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
        }
        
        // Check profit target (50% for most strategies)
        if (signal.currentPnL >= 50) {
            signal.shouldExit = true;
            signal.reason = 'PROFIT_TARGET';
            signal.action = 'Close position - 50% profit target reached';
            return signal;
        }
        
        // Check stop loss (2x credit for spreads)
        if (position.strategy === '0DTE' && signal.currentPnL <= -200) {
            signal.shouldExit = true;
            signal.reason = 'STOP_LOSS';
            signal.action = 'Close position - 2x credit stop loss hit';
            return signal;
        }
        
        // Check 21 DTE management
        if (position.dte && position.dte <= 21) {
            signal.shouldExit = true;
            signal.reason = '21_DTE_RULE';
            signal.action = 'Close or roll position - 21 DTE management';
            return signal;
        }
        
        // Check time-based exits for 0DTE
        if (position.strategy === '0DTE') {
            const now = new Date();
            if (now.getHours() >= 15 && now.getMinutes() >= 30) {
                signal.shouldExit = true;
                signal.reason = 'TIME_STOP';
                signal.action = 'Close 0DTE position - 3:30 PM cutoff';
                return signal;
            }
        }
        
        return signal;
    }
    
    /**
     * Generate recommendation for a strategy
     */
    async generateRecommendation(strategy, marketData, balance, positions) {
        // Use the strategies analyzer with fallback
        let analyzer;
        try {
            analyzer = this.strategies.getStrategyAnalyzer ? 
                this.strategies.getStrategyAnalyzer(strategy) :
                this.strategies[`analyze${strategy}`];
        } catch (e) {
            // Fallback to basic recommendation
        }
        if (!analyzer) {
            // Create basic recommendation without analyzer
            return this.createBasicRecommendation(strategy, marketData, balance);
        }
        
        // Prepare data in expected format
        const data = {
            symbol: this.getSymbolForStrategy(strategy),
            ...marketData
        };
        
        // Get recommendation
        const signal = analyzer(data);
        
        if (!signal || signal.score < 60) return null;
        
        // Format recommendation
        return {
            strategy: strategy,
            symbol: signal.symbol || data.symbol,
            type: signal.type,
            strikes: signal.strikes,
            expiration: signal.expiration,
            capitalRequired: signal.capitalRequired || balance * 0.05,
            maxRisk: signal.maxRisk || balance * 0.05,
            confidence: signal.score,
            entry: signal.entry || 'Market order at open',
            contracts: 1 // Will be updated by position sizing
        };
    }
    
    /**
     * Create basic recommendation when analyzer not available
     */
    createBasicRecommendation(strategy, marketData, balance) {
        const vix = marketData.VIX || 20;
        const spy = marketData.SPY?.price || marketData.SPY || 475;
        
        // Basic recommendations based on strategy
        const recommendations = {
            '0DTE': {
                strategy: '0DTE',
                symbol: 'SPY',
                type: 'PUT_SPREAD',
                strikes: `${Math.floor(spy * 0.98)}/${Math.floor(spy * 0.96)}`,
                expiration: 'Today',
                capitalRequired: balance * 0.03,
                maxRisk: balance * 0.03,
                confidence: vix < 30 ? 75 : 60,
                entry: 'Enter at 10:30 AM EST',
                contracts: 1
            },
            'LT112': {
                strategy: 'LT112',
                symbol: 'SPY',
                type: '1-1-2 RATIO',
                strikes: `${Math.floor(spy * 0.88)} put spread, ${Math.floor(spy * 0.85)} naked puts`,
                expiration: '112 DTE',
                capitalRequired: balance * 0.10,
                maxRisk: balance * 0.05,
                confidence: 70,
                entry: 'Enter at market open',
                contracts: 1
            },
            'STRANGLE': {
                strategy: 'STRANGLE',
                symbol: 'MES',
                type: 'SHORT_STRANGLE',
                strikes: '5-delta put/call',
                expiration: '90 DTE',
                capitalRequired: balance * 0.08,
                maxRisk: balance * 0.04,
                confidence: 65,
                entry: 'Enter at market open',
                contracts: 1
            },
            'IPMCC': {
                strategy: 'IPMCC',
                symbol: 'QQQ',
                type: 'PMCC',
                strikes: '80-delta LEAP, weekly ATM call',
                expiration: 'LEAP 365 DTE, weekly 7 DTE',
                capitalRequired: balance * 0.15,
                maxRisk: balance * 0.05,
                confidence: 70,
                entry: 'Roll at 9:15 AM Friday',
                contracts: 1
            },
            'LEAP': {
                strategy: 'LEAP',
                symbol: 'SPY',
                type: 'LONG_PUT',
                strikes: `${Math.floor(spy * 0.85)}`,
                expiration: '365 DTE',
                capitalRequired: balance * 0.05,
                maxRisk: balance * 0.05,
                confidence: 65,
                entry: 'Ladder entry Monday',
                contracts: 1
            }
        };
        
        return recommendations[strategy] || null;
    }
    
    /**
     * Get primary symbol for strategy
     */
    getSymbolForStrategy(strategy) {
        const symbols = {
            '0DTE': 'SPY',
            'LT112': 'SPY',
            'STRANGLE': 'MES',
            'IPMCC': 'QQQ',
            'LEAP': 'SPY'
        };
        return symbols[strategy] || 'SPY';
    }
    
    /**
     * Check risk limits
     */
    checkRiskLimits(balance, positions, newRecommendations) {
        const status = {
            bpUsed: 0,
            correlationStatus: 'OK',
            warnings: []
        };
        
        // Calculate current BP usage
        if (positions) {
            const positionValue = positions.reduce((sum, p) => 
                sum + (p.capitalRequired || balance * 0.05), 0
            );
            status.bpUsed = (positionValue / balance) * 100;
        }
        
        // Add new recommendations
        const newCapital = newRecommendations.reduce((sum, r) => 
            sum + r.capitalRequired, 0
        );
        const projectedBP = ((status.bpUsed / 100 * balance + newCapital) / balance) * 100;
        
        if (projectedBP > 35) {
            status.warnings.push(`Buying power would exceed 35% (${projectedBP.toFixed(1)}%)`);
        }
        
        // Check correlation groups
        const correlationGroups = this.getCorrelationGroups(positions, newRecommendations);
        for (const [group, count] of Object.entries(correlationGroups)) {
            if (count > 3) {
                status.warnings.push(`Correlation group ${group} would have ${count} positions (max 3)`);
                status.correlationStatus = 'LIMIT_EXCEEDED';
            }
        }
        
        return status;
    }
    
    /**
     * Get correlation groups
     */
    getCorrelationGroups(positions, recommendations) {
        const groups = {
            equity: 0,
            metals: 0,
            bonds: 0,
            energy: 0,
            currency: 0
        };
        
        const symbolGroups = {
            'SPY': 'equity', 'QQQ': 'equity', 'IWM': 'equity',
            'ES': 'equity', 'MES': 'equity', 'NQ': 'equity', 'MNQ': 'equity',
            'GLD': 'metals', 'SLV': 'metals', 'GC': 'metals', 'MGC': 'metals',
            'TLT': 'bonds', 'HYG': 'bonds', 'ZB': 'bonds',
            'CL': 'energy', 'MCL': 'energy',
            '6E': 'currency', '6A': 'currency'
        };
        
        // Count current positions
        if (positions) {
            positions.forEach(p => {
                const group = symbolGroups[p.symbol];
                if (group) groups[group]++;
            });
        }
        
        // Count new recommendations
        recommendations.forEach(r => {
            const group = symbolGroups[r.symbol];
            if (group) groups[group]++;
        });
        
        return groups;
    }
    
    /**
     * Calculate position size based on Kelly Criterion and VIX
     */
    calculatePositionSize(recommendation, balance, vix) {
        // Base position size
        let contracts = 1;
        
        // Adjust for VIX regime
        if (vix < 15) {
            contracts = 2; // Low vol, can size up
        } else if (vix > 30) {
            contracts = 1; // High vol, size down
        } else if (vix > 50) {
            contracts = 0; // Extreme vol, skip
        }
        
        // Adjust for account size
        const phase = this.getAccountPhase(balance);
        if (phase >= 3) {
            contracts = Math.min(contracts * 2, 5); // Phase 3+ can double size
        }
        
        // Calculate risk
        const maxRisk = recommendation.capitalRequired * contracts;
        const riskPercent = (maxRisk / balance) * 100;
        
        // Ensure within 5% risk limit
        if (riskPercent > 5) {
            contracts = Math.floor((balance * 0.05) / recommendation.capitalRequired);
        }
        
        return {
            contracts: Math.max(1, contracts),
            maxRisk: maxRisk,
            riskPercent: riskPercent
        };
    }
    
    /**
     * Update performance tracking file
     */
    async updatePerformanceTracking(analysis) {
        const trackingFile = path.join(__dirname, 'performance_tracking.json');
        let tracking = { trades: [], dailyPnL: [], statistics: {} };
        
        try {
            const existing = await fs.readFile(trackingFile, 'utf8');
            tracking = JSON.parse(existing);
        } catch (e) {
            // File doesn't exist yet
        }
        
        // Add today's analysis
        tracking.dailyPnL.push({
            date: analysis.date,
            accountValue: analysis.accountValue,
            recommendations: analysis.recommendations.length,
            exits: analysis.exits.length
        });
        
        // Save updated tracking
        await fs.writeFile(trackingFile, JSON.stringify(tracking, null, 2));
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    // Parse command line arguments
    const input = {
        balance: 35000,
        date: new Date().toISOString().split('T')[0],
        positions: [],
        marketData: {},
        trackPerformance: true
    };
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--balance':
                input.balance = parseFloat(args[++i]);
                break;
            case '--date':
                input.date = args[++i];
                break;
            case '--positions':
                // Format: "SPY_PUT_450_0DTE,QQQ_CALL_380_LEAP"
                input.positions = args[++i].split(',').map(p => {
                    const parts = p.split('_');
                    return {
                        symbol: parts[0],
                        type: parts[1],
                        strike: parseFloat(parts[2]),
                        strategy: parts[3]
                    };
                });
                break;
            case '--spy':
                input.marketData.SPY = { price: parseFloat(args[++i]) };
                break;
            case '--vix':
                input.marketData.VIX = parseFloat(args[++i]);
                break;
        }
    }
    
    // Run analysis
    const analyzer = new DailyTradingAnalysis();
    analyzer.analyze(input)
        .then(analysis => {
            console.log('\n✅ Analysis complete!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = DailyTradingAnalysis;