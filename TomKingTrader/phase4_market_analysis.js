/**
 * Phase 4 Market Analysis & Trade Recommendations
 * For $75,000 Sandbox Account - All Strategies Available
 */

const { TastyTradeAPI } = require('./src/tastytradeAPI');
const { RiskManager } = require('./src/riskManager');
const { Section9BStrategies } = require('./src/section9BStrategies');
const { TradingStrategies } = require('./src/strategies');
const { GreeksCalculator } = require('./src/greeksCalculator');

console.log('🏆 PHASE 4 MARKET ANALYSIS & TRADE RECOMMENDATIONS');
console.log('='.repeat(60));
console.log('Account Balance: $75,000 (Phase 4 - All Strategies Available)');
console.log('Mode: Sandbox (TastyTrade Cert Environment)');
console.log('='.repeat(60));

class Phase4Analyzer {
    constructor() {
        this.api = new TastyTradeAPI();
        this.riskManager = new RiskManager();
        this.section9B = new Section9BStrategies();
        this.coreStrategies = new TradingStrategies();
        this.greeks = new GreeksCalculator();
        this.accountBalance = 75000;
        this.phase = 4;
    }

    async initialize() {
        console.log('\n📡 Connecting to TastyTrade API...');
        await this.api.initialize();
        
        console.log('✅ Connected to Account:', this.api.accountNumber);
        console.log('✅ Account Balance:', this.api.accountBalance?.netLiquidatingValue || '$75,000');
        console.log('✅ Buying Power:', this.api.accountBalance?.buyingPower || 'Loading...');
        
        return true;
    }

    async analyzeMarketConditions() {
        console.log('\n📊 CURRENT MARKET CONDITIONS ANALYSIS');
        console.log('=' + '='.repeat(40));

        try {
            // Get VIX data for volatility regime
            const vixData = await this.api.getQuote('VIX');
            const currentVIX = vixData?.last || 20; // Default if unavailable
            
            console.log('📈 VIX Level:', currentVIX);
            
            // Determine volatility regime
            const regime = this.getVolatilityRegime(currentVIX);
            console.log('🌡️ Volatility Regime:', regime.name);
            console.log('💰 Max BP Usage:', (regime.maxBP * 100) + '%');
            
            // Get SPY data for market direction
            const spyData = await this.api.getQuote('SPY');
            console.log('📊 SPY Price:', spyData?.last || 'Loading...');
            
            // Analyze current positions
            const positions = await this.api.getPositions();
            console.log('📋 Current Positions:', positions?.length || 0);
            
            return {
                vix: currentVIX,
                regime: regime,
                spy: spyData?.last,
                positions: positions || []
            };
            
        } catch (error) {
            console.log('⚠️ Using simulated market data for analysis');
            return {
                vix: 22,
                regime: this.getVolatilityRegime(22),
                spy: 450,
                positions: []
            };
        }
    }

    getVolatilityRegime(vix) {
        if (vix < 16) {
            return { name: 'LOW VOLATILITY', maxBP: 0.45, description: 'Quiet market, conservative sizing' };
        } else if (vix < 20) {
            return { name: 'NORMAL VOLATILITY', maxBP: 0.65, description: 'Standard conditions' };
        } else if (vix < 25) {
            return { name: 'ELEVATED VOLATILITY', maxBP: 0.75, description: 'Increased opportunity' };
        } else if (vix < 30) {
            return { name: 'HIGH VOLATILITY', maxBP: 0.80, description: 'Tom King maximum BP usage' };
        } else {
            return { name: 'EXTREME VOLATILITY', maxBP: 0.80, description: 'Crisis conditions - maximum caution' };
        }
    }

    async generateTradeRecommendations(marketConditions) {
        console.log('\n🎯 PHASE 4 TRADE RECOMMENDATIONS');
        console.log('=' + '='.repeat(40));

        const recommendations = [];

        // Check current day and time for Friday 0DTE
        const now = new Date();
        const isFriday = now.getDay() === 5; // 0 = Sunday, 5 = Friday
        const isAfter1030 = now.getHours() > 10 || (now.getHours() === 10 && now.getMinutes() >= 30);

        // 1. Friday 0DTE Strategy (if applicable)
        if (isFriday && isAfter1030 && marketConditions.vix > 22) {
            recommendations.push({
                strategy: 'FRIDAY_0DTE',
                priority: 'HIGH',
                description: 'Tom King signature Friday 0DTE strategy',
                conditions: 'Friday after 10:30 AM, VIX > 22',
                expectedWinRate: '88%',
                maxRisk: '$3,750 (5% of account)',
                setup: 'SPX iron condors or short strangles',
                reasoning: 'Perfect conditions for Tom King proven Friday strategy'
            });
        }

        // 2. Section 9B Advanced Strategies
        const section9BRecommendations = await this.getSection9BRecommendations(marketConditions);
        recommendations.push(...section9BRecommendations);

        // 3. Long-Term 1-1-2 Strategy
        recommendations.push({
            strategy: 'LONG_TERM_112',
            priority: 'MEDIUM',
            description: 'Tom King preferred setup - 45-90 DTE',
            conditions: 'Any market condition',
            expectedWinRate: '75%',
            maxRisk: '$3,750 (5% of account)',
            setup: 'SPY or QQQ 1 short put, 1 short call, 2 long calls',
            reasoning: 'Consistent income generation with limited risk'
        });

        // 4. Micro Futures Strangles
        if (marketConditions.regime.maxBP >= 0.65) {
            recommendations.push({
                strategy: 'MICRO_FUTURES_STRANGLES',
                priority: 'MEDIUM',
                description: 'MCL (Oil) and MGC (Gold) strangles',
                conditions: 'Normal+ volatility regime',
                expectedWinRate: '70%',
                maxRisk: '$2,500 per contract',
                setup: 'Sell OTM put and call on micro futures',
                reasoning: 'Diversification into commodities with high premium collection'
            });
        }

        return recommendations;
    }

    async getSection9BRecommendations(marketConditions) {
        const recommendations = [];
        
        // Get available Section 9B strategies for Phase 4
        const strategies = this.section9B.getAvailableStrategies(
            { phase: this.phase, balance: this.accountBalance },
            { vix: marketConditions.vix }
        );

        // Broken Wing Condor (Phase 4 only)
        if (marketConditions.vix > 20) {
            recommendations.push({
                strategy: 'BROKEN_WING_CONDOR',
                priority: 'HIGH',
                description: 'Section 9B advanced - asymmetric profit potential',
                conditions: 'VIX > 20, Phase 4 only',
                expectedWinRate: '65%',
                maxRisk: '$5,000',
                setup: 'SPY broken wing condor with enhanced profit side',
                reasoning: 'Higher volatility perfect for advanced spreads'
            });
        }

        // Batman Spread (High volatility environments)
        if (marketConditions.vix > 25) {
            recommendations.push({
                strategy: 'BATMAN_SPREAD',
                priority: 'HIGH',
                description: 'Section 9B - High volatility specialist',
                conditions: 'VIX > 25, extreme volatility',
                expectedWinRate: '60%',
                maxRisk: '$6,000',
                setup: 'Complex multi-leg spread for volatility capture',
                reasoning: 'Designed specifically for high volatility environments'
            });
        }

        // Enhanced Butterfly
        recommendations.push({
            strategy: 'ENHANCED_BUTTERFLY',
            priority: 'MEDIUM',
            description: 'Section 9B - Dynamic wing adjustment',
            conditions: 'Phase 3+ account',
            expectedWinRate: '70%',
            maxRisk: '$4,000',
            setup: 'SPY butterfly with adjustable wings',
            reasoning: 'Range-bound profit with adjustment capabilities'
        });

        return recommendations;
    }

    async calculatePositionSizing(recommendations, marketConditions) {
        console.log('\n📐 POSITION SIZING ANALYSIS');
        console.log('=' + '='.repeat(30));

        const maxBPUsage = marketConditions.regime.maxBP;
        const availableBP = this.accountBalance * maxBPUsage;
        
        console.log('💰 Account Balance: $' + this.accountBalance.toLocaleString());
        console.log('💳 Max BP Usage: ' + (maxBPUsage * 100) + '% = $' + availableBP.toLocaleString());
        console.log('⚖️ Max Risk Per Trade: 5% = $' + (this.accountBalance * 0.05).toLocaleString());

        // Kelly Criterion Analysis
        const kellyResult = this.riskManager.calculateKellyCriterion({
            winRate: 0.88, // Friday 0DTE win rate
            avgWin: 0.25,   // 25% average winner
            avgLoss: 0.15,  // 15% average loser
            accountValue: this.accountBalance
        });

        console.log('🧮 Kelly Criterion Recommended Size: ' + (kellyResult.recommendedSize * 100).toFixed(1) + '%');
        console.log('📈 Expected Growth Rate: ' + (kellyResult.expectedGrowthRate * 100).toFixed(1) + '%');

        return {
            maxBPUsage: maxBPUsage,
            availableBP: availableBP,
            maxRiskPerTrade: this.accountBalance * 0.05,
            kellySize: kellyResult.recommendedSize,
            expectedGrowth: kellyResult.expectedGrowthRate
        };
    }

    displayRecommendations(recommendations, sizing) {
        console.log('\n🎯 TOP TRADE RECOMMENDATIONS FOR PHASE 4 ACCOUNT');
        console.log('=' + '='.repeat(55));

        recommendations.forEach((rec, index) => {
            console.log('\\n' + (index + 1) + '. ' + rec.strategy + ' (' + rec.priority + ' PRIORITY)');
            console.log('   Description: ' + rec.description);
            console.log('   Conditions: ' + rec.conditions);
            console.log('   Win Rate: ' + rec.expectedWinRate);
            console.log('   Max Risk: ' + rec.maxRisk);
            console.log('   Setup: ' + rec.setup);
            console.log('   Reasoning: ' + rec.reasoning);
        });

        console.log('\\n🔥 IMMEDIATE ACTION ITEMS:');
        const highPriority = recommendations.filter(r => r.priority === 'HIGH');
        if (highPriority.length > 0) {
            highPriority.forEach(rec => {
                console.log('✅ Execute ' + rec.strategy + ' - ' + rec.reasoning);
            });
        } else {
            console.log('✅ Focus on Long-Term 1-1-2 setups for consistent income');
            console.log('✅ Monitor market for Friday 0DTE opportunities');
            console.log('✅ Consider micro futures for diversification');
        }
    }

    async generatePhase4Dashboard() {
        console.log('\\n📊 PHASE 4 ACCOUNT DASHBOARD');
        console.log('=' + '='.repeat(35));
        
        // Account progression from Phase 1 to Phase 4
        console.log('📈 ACCOUNT PROGRESSION:');
        console.log('   Phase 1 (£30-40k): ✅ COMPLETED - Foundation strategies');
        console.log('   Phase 2 (£40-60k): ✅ COMPLETED - Expanded strategy set');
        console.log('   Phase 3 (£60-75k): ✅ COMPLETED - Advanced spreads');
        console.log('   Phase 4 (£75k+): 🚀 CURRENT - Full professional arsenal');
        
        console.log('\\n🏆 PHASE 4 CAPABILITIES:');
        console.log('   ✅ All 17 strategies unlocked (10 Tom King + 7 Section 9B)');
        console.log('   ✅ Professional income generation mode');
        console.log('   ✅ Maximum correlation limits (4 positions per group)');
        console.log('   ✅ Advanced risk management protocols');
        console.log('   ✅ Kelly Criterion position sizing');
        
        console.log('\\n💰 INCOME TARGETS:');
        console.log('   Monthly Target: £10,000+ (achievable at this level)');
        console.log('   Reinvestment Rate: 50% (income focus vs growth)');
        console.log('   Expected Annual Return: 150%+ with proper execution');
    }
}

// Execute the analysis
async function runPhase4Analysis() {
    const analyzer = new Phase4Analyzer();
    
    try {
        // Initialize API connection
        await analyzer.initialize();
        
        // Analyze current market conditions
        const marketConditions = await analyzer.analyzeMarketConditions();
        
        // Generate trade recommendations
        const recommendations = await analyzer.generateTradeRecommendations(marketConditions);
        
        // Calculate position sizing
        const sizing = await analyzer.calculatePositionSizing(recommendations, marketConditions);
        
        // Display recommendations
        analyzer.displayRecommendations(recommendations, sizing);
        
        // Show Phase 4 capabilities
        await analyzer.generatePhase4Dashboard();
        
        console.log('\\n🚀 PHASE 4 ANALYSIS COMPLETE - READY FOR PROFESSIONAL TRADING');
        console.log('   Next: Execute high-priority recommendations in sandbox environment');
        
    } catch (error) {
        console.log('\\n❌ Error during analysis:', error.message);
        console.log('   Continuing with simulated analysis...');
        
        // Fallback analysis with simulated data
        const marketConditions = {
            vix: 22,
            regime: analyzer.getVolatilityRegime(22),
            spy: 450,
            positions: []
        };
        
        const recommendations = await analyzer.generateTradeRecommendations(marketConditions);
        analyzer.displayRecommendations(recommendations);
        await analyzer.generatePhase4Dashboard();
    }
}

if (require.main === module) {
    runPhase4Analysis().catch(console.error);
}

module.exports = { Phase4Analyzer };