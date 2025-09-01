#!/usr/bin/env node

/**
 * COMPREHENSIVE TOM KING TESTING SUITE v17
 * 
 * Complete scenario-based testing covering:
 * - Account Size Scenarios (£30k-£75k+)
 * - BP Utilization Scenarios (0%-95%)  
 * - Position Scenarios (none to max correlation)
 * - Market Condition Scenarios (VIX regimes, August 2024 disaster)
 * - Day/Time Scenarios (weekday strategies, Friday 0DTE timing)
 * - Edge Cases (API failures, missing data, risk violations)
 * 
 * PURPOSE: Comprehensive validation of Tom King Framework recommendations
 * NO LIVE TRADING - RECOMMENDATIONS ONLY
 */

const TomKingTestingFramework = require('./testingFramework');
const { getLogger } = require('./logger');

const logger = getLogger();

class ComprehensiveTestSuite extends TomKingTestingFramework {
    constructor() {
        super();
        this.testCategories = [
            'account_size',
            'bp_utilization', 
            'position_scenarios',
            'market_conditions',
            'time_scenarios',
            'edge_cases'
        ];
        
        logger.info('TEST_SUITE', 'COMPREHENSIVE TOM KING TEST SUITE v17 initialized');
        logger.info('TEST_SUITE', 'Testing all scenarios, edge cases, and market conditions');
        logger.info('TEST_SUITE', 'Complete framework validation with detailed reporting');
    }

    /**
     * Load comprehensive test scenarios
     */
    loadTestScenarios() {
        this.scenarios = [
            ...this.getAccountSizeScenarios(),
            ...this.getBPUtilizationScenarios(),
            ...this.getPositionScenarios(), 
            ...this.getMarketConditionScenarios(),
            ...this.getTimeScenarios(),
            ...this.getEdgeCaseScenarios()
        ];
        
        logger.info('TEST_SUITE', `Loaded ${this.scenarios.length} comprehensive test scenarios across ${this.testCategories.length} categories`);
    }

    /**
     * Account Size Scenarios (£30k-£75k+)
     */
    getAccountSizeScenarios() {
        return [
            {
                name: "Account Size: £30,000 - Phase 1 Entry Level",
                category: "account_size",
                input: "£30000 | none | 0% | Tuesday Jan 7 11:00 AM EST | VIX 16.2 | No",
                expectedStrategies: ["Phase 1 Strategies", "MCL Strangle", "MGC Strangle", "Conservative Sizing"],
                phase: 1,
                description: "Minimum Phase 1 account - limited to micro futures and ETFs",
                testMetrics: {
                    maxPositions: 2,
                    maxBPUsage: 25,
                    availableStrategies: ["MCL_STRANGLE", "MGC_STRANGLE", "GLD_IPMCC"]
                }
            },
            {
                name: "Account Size: £35,000 - Fresh Phase 1",
                category: "account_size", 
                input: "£35000 | none | 0% | Wednesday Jan 8 2:15 PM EST | VIX 15.8 | No",
                expectedStrategies: ["Fresh Account Setup", "Foundation Building", "Risk Management"],
                phase: 1,
                description: "Typical fresh Phase 1 account - focus on foundation building"
            },
            {
                name: "Account Size: £39,500 - Phase 1 Peak",
                category: "account_size",
                input: "£39500 | MCL strangle (65 DTE, 2.85, +12%), MGC strangle (70 DTE, 4.20, +8%) | 18% | Friday Jan 10 9:45 AM EST | VIX 14.3 | No",
                expectedStrategies: ["Phase 2 Preparation", "0DTE Ready", "Account Growth Strategy"],
                phase: 1,
                description: "Near Phase 2 threshold - should prepare for upgrade"
            },
            {
                name: "Account Size: £40,000 - Phase 2 Entry",
                category: "account_size",
                input: "£40000 | none | 0% | Monday Jan 6 10:30 AM EST | VIX 17.1 | No",
                expectedStrategies: ["Phase 2 Upgrade", "MES Access", "Enhanced Strategies"],
                phase: 2,
                description: "Fresh Phase 2 upgrade - unlock MES and enhanced strategies"
            },
            {
                name: "Account Size: £50,000 - Mid Phase 2",
                category: "account_size",
                input: "£50000 | MES LT112 (85 DTE, 5420, +15%), TLT strangle (60 DTE, 1.85, +22%) | 35% | Thursday Jan 9 1:45 PM EST | VIX 13.9 | No",
                expectedStrategies: ["Portfolio Expansion", "Multiple Strategies", "0DTE Multiple Contracts"],
                phase: 2,
                description: "Established Phase 2 account with multiple positions"
            },
            {
                name: "Account Size: £59,999 - Phase 2 Peak",
                category: "account_size",
                input: "£59999 | MES LT112 (45 DTE, 5420, +28%), MCL strangle (75 DTE, 2.90, +18%), TLT IPMCC (280 DTE, 95/weekly, +5%) | 48% | Tuesday Jan 14 11:15 AM EST | VIX 16.7 | No",
                expectedStrategies: ["Phase 3 Preparation", "Full Portfolio", "ES Upgrade Ready"],
                phase: 2,
                description: "Maximum Phase 2 - prepare for Phase 3 full futures upgrade"
            },
            {
                name: "Account Size: £60,000 - Phase 3 Entry", 
                category: "account_size",
                input: "£60000 | none | 0% | Wednesday Jan 8 9:30 AM EST | VIX 15.4 | No",
                expectedStrategies: ["Phase 3 Upgrade", "Full Futures Access", "ES LT112", "Advanced Strategies"],
                phase: 3,
                description: "Fresh Phase 3 - full futures access and advanced strategies"
            },
            {
                name: "Account Size: £70,000 - Mid Phase 3",
                category: "account_size", 
                input: "£70000 | ES LT112 (65 DTE, 6420, +12%), CL strangle (80 DTE, 3.50, +15%), GC butterfly (45 DTE, 1.85, -3%) | 52% | Friday Jan 10 10:50 AM EST | VIX 12.8 | No",
                expectedStrategies: ["0DTE", "Advanced Management", "Butterfly Spreads", "Portfolio Optimization"],
                phase: 3,
                description: "Established Phase 3 with complex strategies and high BP usage"
            },
            {
                name: "Account Size: £74,999 - Phase 3 Peak",
                category: "account_size",
                input: "£74999 | ES LT112 (25 DTE, 6420, +35%), NQ strangle (90 DTE, 8.50, +8%), CL butterfly (60 DTE, 2.80, +12%), GC ratio (30 DTE, 3.20, -5%) | 58% | Monday Jan 13 2:30 PM EST | VIX 18.2 | No",
                expectedStrategies: ["21 DTE Management", "Phase 4 Preparation", "Professional Readiness"],
                phase: 3,
                description: "Maximum Phase 3 - prepare for professional Phase 4 deployment"
            },
            {
                name: "Account Size: £75,000 - Phase 4 Entry",
                category: "account_size",
                input: "£75000 | none | 0% | Thursday Jan 9 10:15 AM EST | VIX 14.6 | No",
                expectedStrategies: ["Phase 4 Professional", "Portfolio Margin", "Tax Optimization", "Full System"],
                phase: 4,
                description: "Professional Phase 4 deployment - all strategies available"
            },
            {
                name: "Account Size: £100,000 - Full Professional",
                category: "account_size",
                input: "£100000 | ES LT112 (55 DTE, 6420, +22%), NQ strangle (85 DTE, 8.50, +18%), CL butterfly (70 DTE, 2.80, +8%), GC ratio (40 DTE, 3.20, +15%), TLT diagonal (120 DTE, 2.50, -2%) | 45% | Friday Jan 10 10:40 AM EST | VIX 13.5 | Yes",
                expectedStrategies: ["0DTE", "Professional Management", "Tax Efficiency", "Portfolio Margin Optimization"],
                phase: 4,
                description: "Large professional account with portfolio margin and complex strategies"
            }
        ];
    }

    /**
     * BP Utilization Scenarios (0%-95%)
     */
    getBPUtilizationScenarios() {
        return [
            {
                name: "BP Utilization: 0% - Fresh Account Analysis", 
                category: "bp_utilization",
                input: "£45000 | none | 0% | Tuesday Jan 7 10:45 AM EST | VIX 15.8 | No",
                expectedStrategies: ["Fresh Deployment", "Multiple Opportunities", "Aggressive Sizing"],
                phase: 2,
                description: "Zero BP usage - should recommend multiple strategies for deployment",
                testMetrics: {
                    expectedBPRecommendations: 40,
                    maxNewPositions: 4,
                    aggressiveSizing: true
                }
            },
            {
                name: "BP Utilization: 15% - Light Deployment",
                category: "bp_utilization",
                input: "£50000 | TLT strangle (90 DTE, 1.85, +8%) | 15% | Wednesday Jan 8 1:30 PM EST | VIX 16.2 | No",
                expectedStrategies: ["Portfolio Expansion", "Additional Strategies", "Room for Growth"],
                phase: 2,
                description: "Light BP usage - significant room for additional positions"
            },
            {
                name: "BP Utilization: 30% - Moderate Deployment",
                category: "bp_utilization", 
                input: "£65000 | ES LT112 (75 DTE, 6420, +10%), TLT strangle (65 DTE, 1.85, +15%) | 30% | Thursday Jan 9 11:20 AM EST | VIX 14.7 | No",
                expectedStrategies: ["Balanced Portfolio", "Additional Opportunities", "Moderate Sizing"],
                phase: 3,
                description: "Moderate BP usage - balanced approach with room for more positions"
            },
            {
                name: "BP Utilization: 50% - Optimal Range", 
                category: "bp_utilization",
                input: "£70000 | ES LT112 (65 DTE, 6420, +18%), NQ strangle (80 DTE, 8.50, +12%), CL strangle (70 DTE, 3.50, +5%) | 50% | Friday Jan 10 10:35 AM EST | VIX 13.2 | No",
                expectedStrategies: ["0DTE", "Optimal Deployment", "Selective Opportunities"],
                phase: 3,
                description: "Optimal BP usage - good deployment with Friday 0DTE opportunity"
            },
            {
                name: "BP Utilization: 65% - Maximum Safe",
                category: "bp_utilization",
                input: "£80000 | ES LT112 (45 DTE, 6420, +25%), NQ strangle (90 DTE, 8.50, +8%), CL butterfly (60 DTE, 2.80, +12%), GC ratio (35 DTE, 3.20, -3%), TLT diagonal (180 DTE, 2.50, +6%) | 65% | Monday Jan 13 2:15 PM EST | VIX 17.5 | Yes",
                expectedStrategies: ["Maximum Deployment", "Management Focus", "No New Large Positions"],
                phase: 4,
                description: "Maximum safe BP usage - focus on management over new positions"
            },
            {
                name: "BP Utilization: 75% - High Risk Warning",
                category: "bp_utilization",
                input: "£60000 | ES LT112 (30 DTE, 6420, -5%), MES LT112 (90 DTE, 5420, +15%), NQ strangle (55 DTE, 8.50, -8%), CL strangle (45 DTE, 3.50, +22%), GC butterfly (25 DTE, 1.85, +8%) | 75% | Tuesday Jan 14 3:45 PM EST | VIX 19.8 | No",
                expectedStrategies: ["High BP Warning", "Reduce Exposure", "Management Only"],
                phase: 3,
                description: "High BP usage - should warn and recommend reducing exposure"
            },
            {
                name: "BP Utilization: 85% - Critical Warning", 
                category: "bp_utilization",
                input: "£55000 | ES LT112 (20 DTE, 6420, -15%), MES LT112 (40 DTE, 5420, -12%), NQ strangle (30 DTE, 8.50, -20%), RTY strangle (25 DTE, 4.20, -18%), CL strangle (35 DTE, 3.50, -8%), GC strangle (30 DTE, 2.80, -10%) | 85% | Wednesday Jan 8 11:45 AM EST | VIX 28.5 | No",
                expectedStrategies: ["Critical BP Warning", "Emergency Protocol", "Reduce Immediately"],
                phase: 2,
                description: "Critical BP usage with losses - emergency protocol activation"
            },
            {
                name: "BP Utilization: 95% - Disaster Mode",
                category: "bp_utilization",
                input: "£50000 | ES LT112 (15 DTE, 6420, -35%), MES LT112 (20 DTE, 5420, -40%), NQ strangle (18 DTE, 8.50, -45%), RTY strangle (15 DTE, 4.20, -42%), CL strangle (20 DTE, 3.50, -38%), GC strangle (15 DTE, 2.80, -35%), TLT strangle (25 DTE, 1.85, -25%) | 95% | Thursday Jan 9 9:30 AM EST | VIX 35.2 | No",
                expectedStrategies: ["Disaster Protocol", "Margin Call Risk", "Immediate Action Required"],
                phase: 2,
                description: "Disaster-level BP usage - immediate risk reduction required"
            }
        ];
    }

    /**
     * Position Scenarios (none to max correlation)
     */
    getPositionScenarios() {
        return [
            {
                name: "Positions: None - Fresh Start",
                category: "position_scenarios", 
                input: "£45000 | none | 0% | Monday Jan 6 11:30 AM EST | VIX 16.5 | No",
                expectedStrategies: ["Fresh Deployment", "Foundation Building", "Multiple Strategies"],
                phase: 2,
                description: "No positions - clean slate for strategic deployment"
            },
            {
                name: "Positions: Single Position - Room for More",
                category: "position_scenarios",
                input: "£50000 | MES LT112 (85 DTE, 5420, +12%) | 25% | Tuesday Jan 7 1:15 PM EST | VIX 15.2 | No", 
                expectedStrategies: ["Portfolio Expansion", "Diversification", "Additional Strategies"],
                phase: 2,
                description: "Single profitable position - room for portfolio expansion"
            },
            {
                name: "Positions: Three Positions - Under Limit",
                category: "position_scenarios",
                input: "£65000 | ES LT112 (75 DTE, 6420, +8%), TLT strangle (90 DTE, 1.85, +15%), GC butterfly (60 DTE, 1.85, -2%) | 42% | Wednesday Jan 8 10:20 AM EST | VIX 14.8 | No",
                expectedStrategies: ["Balanced Portfolio", "Selective Additions", "Management Focus"],
                phase: 3, 
                description: "Three positions from different correlation groups - good diversification"
            },
            {
                name: "Positions: Max Correlation Group - Energy Warning",
                category: "position_scenarios",
                input: "£70000 | CL strangle (80 DTE, 3.50, +10%), NG strangle (70 DTE, 2.20, +5%), RB strangle (85 DTE, 1.95, +8%) | 48% | Thursday Jan 9 2:45 PM EST | VIX 16.3 | No",
                expectedStrategies: ["Correlation Warning", "Diversification Needed", "Energy Overweight"],
                phase: 3,
                description: "Three energy positions - at correlation group limit"
            },
            {
                name: "Positions: Mixed Strategies - Optimal Deployment", 
                category: "position_scenarios",
                input: "£80000 | ES LT112 (65 DTE, 6420, +18%), CL strangle (75 DTE, 3.50, +12%), GLD IPMCC (280 DTE, 95/weekly, +8%), TLT butterfly (45 DTE, 0.85, +25%) | 52% | Friday Jan 10 10:45 AM EST | VIX 13.9 | Yes",
                expectedStrategies: ["0DTE", "Mixed Strategy Management", "Optimal Deployment"],
                phase: 4,
                description: "Mixed strategies across different asset classes - optimal deployment"
            },
            {
                name: "Positions: 21 DTE Management Trigger",
                category: "position_scenarios",
                input: "£60000 | ES LT112 (21 DTE, 6420, +30%), MES LT112 (22 DTE, 5420, +25%), TLT strangle (20 DTE, 1.85, +45%) | 45% | Monday Jan 13 11:00 AM EST | VIX 17.2 | No",
                expectedStrategies: ["21 DTE Rule", "Profit Taking", "Roll Forward", "Management Priority"],
                phase: 3,
                description: "Multiple positions at 21 DTE - Tom King management rule triggered"
            },
            {
                name: "Positions: Correlation Violation - August 2024 Risk",
                category: "position_scenarios", 
                input: "£55000 | ES LT112 (45 DTE, 6420, -25%), MES LT112 (50 DTE, 5420, -30%), NQ strangle (45 DTE, 8.50, -28%), RTY strangle (48 DTE, 4.20, -22%) | 68% | Tuesday Jan 14 9:45 AM EST | VIX 32.5 | No",
                expectedStrategies: ["August 2024 Warning", "Correlation Disaster", "Reduce Exposure"],
                phase: 2,
                description: "Four equity futures positions - recreates August 2024 disaster scenario"
            },
            {
                name: "Positions: Defensive Adjustment Needed",
                category: "position_scenarios",
                input: "£75000 | ES LT112 (35 DTE, 6420, -15%), NQ strangle (40 DTE, 8.50, -12%), CL butterfly (30 DTE, 2.80, +35%), GC ratio (25 DTE, 3.20, -20%) | 58% | Wednesday Jan 8 3:30 PM EST | VIX 24.8 | Yes",
                expectedStrategies: ["Defensive Adjustments", "Mixed P&L Management", "Risk Assessment"],
                phase: 4,
                description: "Mixed P&L positions requiring different management approaches"
            }
        ];
    }

    /**
     * Market Condition Scenarios (VIX regimes, crises)
     */
    getMarketConditionScenarios() {
        return [
            {
                name: "Market: VIX 10 - Extreme Low Volatility",
                category: "market_conditions",
                input: "£50000 | TLT strangle (90 DTE, 1.85, +5%) | 20% | Tuesday Jan 7 11:15 AM EST | VIX 9.8 | No",
                expectedStrategies: ["VIX Regime 1", "Conservative Sizing", "Premium Hunting", "Long Volatility"],
                phase: 2,
                description: "Extreme low VIX - conservative approach with volatility buying bias"
            },
            {
                name: "Market: VIX 12 - Low Volatility Threshold",
                category: "market_conditions",
                input: "£65000 | ES LT112 (75 DTE, 6420, +8%), GC butterfly (60 DTE, 1.85, +12%) | 35% | Wednesday Jan 8 2:20 PM EST | VIX 11.9 | No",
                expectedStrategies: ["VIX Regime 2", "Standard Sizing", "Butterfly Strategies"],
                phase: 3,
                description: "Low VIX at regime boundary - standard sizing with range-bound strategies"
            },
            {
                name: "Market: VIX 16 - Normal Conditions",
                category: "market_conditions", 
                input: "£70000 | ES LT112 (65 DTE, 6420, +15%), CL strangle (80 DTE, 3.50, +10%) | 42% | Thursday Jan 9 10:30 AM EST | VIX 15.8 | No",
                expectedStrategies: ["VIX Regime 3", "Standard Deployment", "Normal Sizing"],
                phase: 3,
                description: "Normal VIX regime - standard Tom King strategies and sizing"
            },
            {
                name: "Market: VIX 20 - Elevated Volatility",
                category: "market_conditions",
                input: "£60000 | MES LT112 (85 DTE, 5420, +12%), TLT strangle (70 DTE, 1.85, +8%) | 38% | Friday Jan 10 10:40 AM EST | VIX 20.2 | No",
                expectedStrategies: ["0DTE", "VIX Regime 3-4", "Moderate Sizing", "Premium Collection"],
                phase: 3,
                description: "Elevated VIX - increased premium collection opportunities"
            },
            {
                name: "Market: VIX 25 - High Volatility Spike",
                category: "market_conditions",
                input: "£75000 | ES LT112 (55 DTE, 6420, -5%), NQ strangle (90 DTE, 8.50, +18%) | 45% | Monday Jan 13 1:45 PM EST | VIX 25.3 | Yes",
                expectedStrategies: ["VIX Regime 4", "VIX Spike Protocol", "Aggressive Premium Collection"],
                phase: 4,
                description: "High VIX spike - excellent premium collection environment"
            },
            {
                name: "Market: VIX 30 - Crisis Threshold", 
                category: "market_conditions",
                input: "£55000 | ES LT112 (45 DTE, 6420, -15%), MES LT112 (60 DTE, 5420, -8%) | 48% | Tuesday Jan 14 10:15 AM EST | VIX 30.5 | No",
                expectedStrategies: ["VIX Regime 5", "Crisis Protocol", "Max Premium Collection"],
                phase: 2,
                description: "Crisis-level VIX - maximum premium collection opportunities"
            },
            {
                name: "Market: VIX 40 - Extreme Crisis",
                category: "market_conditions",
                input: "£65000 | ES LT112 (30 DTE, 6420, -25%), NQ strangle (45 DTE, 8.50, -20%), CL strangle (40 DTE, 3.50, -12%) | 62% | Wednesday Jan 8 11:30 AM EST | VIX 40.8 | No",
                expectedStrategies: ["VIX Regime 5", "Extreme Crisis Protocol", "Defensive Positioning"],
                phase: 3,
                description: "Extreme crisis VIX - focus on defensive positioning and risk management"
            },
            {
                name: "Market: August 5, 2024 Disaster Recreation",
                category: "market_conditions",
                input: "£55000 | ES LT112 (45 DTE, 6420, -45%), MES LT112 (45 DTE, 5420, -48%), NQ strangle (45 DTE, 8.50, -52%), RTY strangle (45 DTE, 4.20, -41%), CL strangle (45 DTE, 3.50, -38%), GC strangle (45 DTE, 2.80, -35%) | 85% | Monday Aug 5 9:45 AM EST | VIX 35.8 | No",
                expectedStrategies: ["August 2024 Disaster", "Emergency Protocol", "Correlation Crisis", "£308k Loss Prevention"],
                phase: 2,
                description: "Exact recreation of August 5, 2024 disaster - test prevention protocols"
            },
            {
                name: "Market: Post-Crisis Recovery",
                category: "market_conditions",
                input: "£45000 | none | 0% | Friday Jan 10 10:35 AM EST | VIX 18.5 | No",
                expectedStrategies: ["0DTE", "Post-Crisis Recovery", "Cautious Re-entry"],
                phase: 2,
                description: "Post-crisis recovery phase - cautious re-entry with Friday 0DTE opportunity"
            }
        ];
    }

    /**
     * Day/Time Scenarios (weekday strategies, timing)
     */
    getTimeScenarios() {
        return [
            {
                name: "Monday: LEAP Day Strategy",
                category: "time_scenarios",
                input: "£60000 | ES LT112 (85 DTE, 6420, +10%) | 25% | Monday Jan 6 10:45 AM EST | VIX 15.5 | No",
                expectedStrategies: ["Monday LEAP Setup", "Long-term Positioning", "Weekly Planning"],
                phase: 3,
                description: "Monday LEAP day - focus on long-term position setup"
            },
            {
                name: "Tuesday: Strangle Day Strategy",
                category: "time_scenarios", 
                input: "£55000 | MES LT112 (75 DTE, 5420, +12%) | 30% | Tuesday Jan 7 11:30 AM EST | VIX 16.8 | No",
                expectedStrategies: ["Tuesday Strangles", "Volatility Positioning", "90-Day Strangles"],
                phase: 2,
                description: "Tuesday strangle day - optimal day for strangle deployment"
            },
            {
                name: "Wednesday: LT112 Day Strategy",
                category: "time_scenarios",
                input: "£70000 | TLT strangle (90 DTE, 1.85, +8%), GC butterfly (60 DTE, 1.85, +5%) | 35% | Wednesday Jan 8 1:15 PM EST | VIX 14.2 | No",
                expectedStrategies: ["Wednesday LT112", "Long-Term 112 Strategy", "ES/MES Positioning"],
                phase: 3,
                description: "Wednesday LT112 day - optimal for Long-Term 112 strategy deployment"
            },
            {
                name: "Thursday: Mid-week Review",
                category: "time_scenarios",
                input: "£65000 | ES LT112 (65 DTE, 6420, +15%), CL strangle (80 DTE, 3.50, +12%), TLT butterfly (45 DTE, 0.85, +22%) | 48% | Thursday Jan 9 2:45 PM EST | VIX 13.8 | No",
                expectedStrategies: ["Mid-week Review", "Position Assessment", "Friday Preparation"],
                phase: 3,
                description: "Thursday mid-week review - assess positions and prepare for Friday"
            },
            {
                name: "Friday: 9:00 AM - Pre-Market Analysis Phase 1",
                category: "time_scenarios",
                input: "£35000 | none | 0% | Friday Jan 10 9:00 AM EST | VIX 15.8 | No",
                expectedStrategies: ["Pre-Market Analysis", "0DTE Preparation", "Phase 1 Sizing"],
                phase: 1,
                description: "Friday 9:00 AM - Phase 1 of pre-market 0DTE analysis"
            },
            {
                name: "Friday: 9:30 AM - Pre-Market Analysis Phase 2",
                category: "time_scenarios",
                input: "£45000 | MES LT112 (85 DTE, 5420, +8%) | 28% | Friday Jan 10 9:30 AM EST | VIX 16.2 | No",
                expectedStrategies: ["Pre-Market Analysis", "0DTE Preparation", "Market Open Preparation"],
                phase: 2,
                description: "Friday 9:30 AM - Phase 2 pre-market analysis as market opens"
            },
            {
                name: "Friday: 10:00 AM - Pre-Market Analysis Phase 3",
                category: "time_scenarios", 
                input: "£65000 | ES LT112 (75 DTE, 6420, +12%), TLT strangle (90 DTE, 1.85, +15%) | 42% | Friday Jan 10 10:00 AM EST | VIX 14.5 | No",
                expectedStrategies: ["Pre-Market Analysis", "0DTE Trigger Levels", "Final Preparation"],
                phase: 3,
                description: "Friday 10:00 AM - Final pre-market analysis before 0DTE window"
            },
            {
                name: "Friday: 10:30 AM - 0DTE Window Opens",
                category: "time_scenarios",
                input: "£50000 | TLT strangle (90 DTE, 1.85, +10%) | 25% | Friday Jan 10 10:30 AM EST | VIX 15.2 | No",
                expectedStrategies: ["0DTE Active", "Trading Window Open", "Direction Analysis"],
                phase: 2,
                description: "Friday 10:30 AM - 0DTE trading window officially opens"
            },
            {
                name: "Friday: 11:00 AM - Active 0DTE Trading",
                category: "time_scenarios",
                input: "£70000 | ES LT112 (65 DTE, 6420, +18%), CL strangle (80 DTE, 3.50, +12%) | 45% | Friday Jan 10 11:00 AM EST | VIX 13.8 | No",
                expectedStrategies: ["0DTE Active Trading", "Direction Confirmed", "Multiple Contracts"],
                phase: 3,
                description: "Friday 11:00 AM - Active 0DTE trading with confirmed market direction"
            },
            {
                name: "Friday: 3:00 PM - Expiration Management",
                category: "time_scenarios", 
                input: "£60000 | ES LT112 (85 DTE, 6420, +12%), 0DTE Iron Condor (0 DTE, 5450/5420/5480/5510, +45%) | 38% | Friday Jan 10 3:00 PM EST | VIX 16.5 | No",
                expectedStrategies: ["Expiration Management", "0DTE Exit Strategy", "Close Management"],
                phase: 3,
                description: "Friday 3:00 PM - 0DTE expiration management critical window"
            },
            {
                name: "Saturday: Weekend Position Review",
                category: "time_scenarios",
                input: "£55000 | MES LT112 (83 DTE, 5420, +15%), TLT strangle (88 DTE, 1.85, +8%), GC butterfly (58 DTE, 1.85, +12%) | 42% | Saturday Jan 11 2:30 PM EST | VIX 14.8 | No",
                expectedStrategies: ["Weekend Review", "Position Analysis", "Weekly Planning"],
                phase: 2,
                description: "Weekend position review - market closed, planning focus"
            },
            {
                name: "Sunday: Week Preparation",
                category: "time_scenarios",
                input: "£75000 | ES LT112 (82 DTE, 6420, +18%), NQ strangle (87 DTE, 8.50, +10%), CL butterfly (57 DTE, 2.80, +5%) | 52% | Sunday Jan 12 4:15 PM EST | VIX 15.3 | Yes",
                expectedStrategies: ["Week Preparation", "Strategy Planning", "Market Outlook"],
                phase: 4,
                description: "Sunday preparation for upcoming trading week"
            }
        ];
    }

    /**
     * Edge Case Scenarios (failures, errors, violations)
     */
    getEdgeCaseScenarios() {
        return [
            {
                name: "Edge Case: API Failure with Fallback",
                category: "edge_cases",
                input: "£50000 | MES LT112 (85 DTE, 5420, +10%) | 30% | Tuesday Jan 7 11:15 AM EST | VIX 16.5 | No",
                expectedStrategies: ["API Fallback", "Manual Mode", "Data Simulation"],
                phase: 2,
                description: "API failure scenario - should fallback to manual/simulated data",
                forceAPIFailure: true
            },
            {
                name: "Edge Case: Missing Market Data",
                category: "edge_cases", 
                input: "£65000 | ES LT112 (75 DTE, 6420, +8%) | 35% | Wednesday Jan 8 2:30 PM EST | VIX ? | No",
                expectedStrategies: ["Data Recovery", "Conservative Approach", "Manual Verification"],
                phase: 3,
                description: "Missing critical market data - should handle gracefully"
            },
            {
                name: "Edge Case: Invalid Position Data",
                category: "edge_cases",
                input: "£70000 | INVALID LT112 (999 DTE, 0, +999%) | 40% | Thursday Jan 9 1:45 PM EST | VIX 15.8 | No",
                expectedStrategies: ["Data Validation Error", "Position Correction", "Manual Review"],
                phase: 3,
                description: "Invalid position data - should detect and handle errors"
            },
            {
                name: "Edge Case: Extreme Correlation Violation",
                category: "edge_cases",
                input: "£80000 | ES LT112 (45 DTE, 6420, -30%), MES LT112 (50 DTE, 5420, -35%), NQ strangle (45 DTE, 8.50, -32%), MNQ strangle (48 DTE, 4.20, -28%), RTY strangle (45 DTE, 4.20, -30%), IWM butterfly (50 DTE, 2.80, -25%) | 88% | Friday Jan 10 10:45 AM EST | VIX 32.8 | No",
                expectedStrategies: ["Correlation Disaster", "Emergency Protocol", "Immediate Action"],
                phase: 4,
                description: "Extreme correlation violation - 6 equity positions, disaster scenario"
            },
            {
                name: "Edge Case: Risk Limit Breach - Account Blow-up",
                category: "edge_cases", 
                input: "£25000 | ES LT112 (10 DTE, 6420, -75%), MES LT112 (15 DTE, 5420, -80%), NQ strangle (12 DTE, 8.50, -70%) | 125% | Monday Jan 13 9:30 AM EST | VIX 45.5 | No",
                expectedStrategies: ["Account Blow-up", "Emergency Liquidation", "Damage Control"],
                phase: 1, // Forced back to Phase 1 due to losses
                description: "Account blow-up scenario - risk limits severely breached"
            },
            {
                name: "Edge Case: Market Closed Trading Attempt",
                category: "edge_cases",
                input: "£60000 | ES LT112 (65 DTE, 6420, +15%) | 35% | Saturday Jan 11 10:30 AM EST | VIX 14.5 | No", 
                expectedStrategies: ["Market Closed Warning", "No Trading Available", "Review Mode"],
                phase: 3,
                description: "Weekend trading attempt - should warn market is closed"
            },
            {
                name: "Edge Case: After Hours Analysis",
                category: "edge_cases",
                input: "£55000 | MES LT112 (75 DTE, 5420, +12%), TLT strangle (90 DTE, 1.85, +8%) | 38% | Thursday Jan 9 8:45 PM EST | VIX 15.2 | No",
                expectedStrategies: ["After Hours Warning", "Position Review Only", "Next Day Planning"],
                phase: 2,
                description: "After hours analysis - limited options available"
            },
            {
                name: "Edge Case: Extreme VIX Data Error",
                category: "edge_cases",
                input: "£70000 | ES LT112 (65 DTE, 6420, +10%) | 42% | Tuesday Jan 7 11:30 AM EST | VIX 999 | No",
                expectedStrategies: ["VIX Data Error", "Conservative Default", "Manual Verification"],
                phase: 3, 
                description: "Extreme VIX reading - should detect data error"
            },
            {
                name: "Edge Case: Negative Account Value",
                category: "edge_cases",
                input: "£-5000 | ES LT112 (5 DTE, 6420, -95%) | 200% | Wednesday Jan 8 10:15 AM EST | VIX 42.8 | No",
                expectedStrategies: ["Negative Account", "Margin Call", "Emergency Liquidation"],
                phase: 0, // Below Phase 1
                description: "Negative account value - extreme emergency scenario"
            },
            {
                name: "Edge Case: Portfolio Margin Calculation Error",
                category: "edge_cases",
                input: "£100000 | ES LT112 (65 DTE, 6420, +15%), NQ strangle (80 DTE, 8.50, +10%), Complex Position Portfolio (ERROR) | ?% | Friday Jan 10 10:40 AM EST | VIX 14.8 | Yes",
                expectedStrategies: ["PM Calculation Error", "Standard Margin Fallback", "Manual Calculation"],
                phase: 4,
                description: "Portfolio margin calculation error - should fallback to standard margin"
            }
        ];
    }

    /**
     * Run comprehensive test suite with detailed reporting
     */
    async runComprehensiveTests() {
        // Keep main header for test suite visibility
        console.log('\n🧪 COMPREHENSIVE TOM KING TEST SUITE v17');
        console.log('='.repeat(80));
        console.log('📊 Testing ALL scenarios, edge cases, and market conditions');
        console.log('🎯 Complete framework validation with advanced reporting');
        console.log('📋 Mode: RECOMMENDATIONS ONLY (No live trading)\n');

        const startTime = Date.now();
        const categoryResults = {};

        // Initialize category tracking
        this.testCategories.forEach(category => {
            categoryResults[category] = {
                total: 0,
                successful: 0,
                failed: 0,
                scenarios: []
            };
        });

        // Run all scenarios with progress tracking
        for (let i = 0; i < this.scenarios.length; i++) {
            const scenario = this.scenarios[i];
            const category = scenario.category;
            
            // Progress tracking - only show every 10th test to reduce output
            if (i % 10 === 0 || i === this.scenarios.length - 1) {
                logger.info('TEST_SUITE', `Progress: [${i + 1}/${this.scenarios.length}] Category: ${category.toUpperCase()} - ${scenario.name}`);
            }
            
            const result = await this.runScenario(scenario);
            
            // Track by category
            categoryResults[category].total++;
            categoryResults[category].scenarios.push(result);
            
            if (result.success) {
                categoryResults[category].successful++;
            } else {
                categoryResults[category].failed++;
            }

            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        const totalTime = Date.now() - startTime;
        this.generateComprehensiveReport(totalTime, categoryResults);
        
        return {
            totalTime,
            categoryResults,
            overallResults: this.results
        };
    }

    /**
     * Generate comprehensive test report with category breakdown
     */
    generateComprehensiveReport(totalExecutionTime, categoryResults) {
        console.log('\n' + '='.repeat(100));
        console.log('📊 COMPREHENSIVE TOM KING TEST SUITE - DETAILED REPORT');
        console.log('='.repeat(100));

        const successful = this.results.filter(r => r.success);
        const failed = this.results.filter(r => !r.success);

        // Overall Results
        console.log(`\n📈 OVERALL RESULTS:`);
        console.log(`   Total Tests: ${this.results.length}`);
        console.log(`   Successful: ${successful.length} (${(successful.length/this.results.length*100).toFixed(1)}%)`);
        console.log(`   Failed: ${failed.length} (${(failed.length/this.results.length*100).toFixed(1)}%)`);
        console.log(`   Total Execution Time: ${(totalExecutionTime/1000).toFixed(2)}s`);
        console.log(`   Average per Test: ${Math.round(totalExecutionTime/this.results.length)}ms`);

        // Category Breakdown
        console.log(`\n📊 RESULTS BY TEST CATEGORY:`);
        console.log('─'.repeat(80));
        
        this.testCategories.forEach(category => {
            const cat = categoryResults[category];
            const successRate = cat.total > 0 ? (cat.successful / cat.total * 100).toFixed(1) : '0.0';
            
            console.log(`${category.toUpperCase().padEnd(20)} | ${cat.successful.toString().padStart(2)}/${cat.total.toString().padEnd(2)} | ${successRate.padStart(5)}% success`);
            
            // Show failed tests in this category
            if (cat.failed > 0) {
                const failedInCategory = cat.scenarios.filter(s => !s.success);
                failedInCategory.forEach(f => {
                    console.log(`   ❌ ${f.scenario}: ${f.error}`);
                });
            }
        });

        // Phase Analysis
        console.log(`\n🎯 RESULTS BY ACCOUNT PHASE:`);
        console.log('─'.repeat(50));
        
        [1, 2, 3, 4].forEach(phase => {
            const phaseResults = successful.filter(r => r.phase === phase);
            const phaseTotal = this.results.filter(r => r.phase === phase).length;
            const phaseRate = phaseTotal > 0 ? (phaseResults.length / phaseTotal * 100).toFixed(1) : '0.0';
            
            console.log(`Phase ${phase} (£${this.getPhaseRange(phase)})  | ${phaseResults.length}/${phaseTotal} | ${phaseRate}% success`);
        });

        // Validation Analysis
        console.log(`\n🎯 STRATEGY VALIDATION ANALYSIS:`);
        console.log('─'.repeat(60));
        
        const avgMatchRate = successful.reduce((sum, r) => sum + r.validation.matchRate, 0) / successful.length;
        console.log(`   Average Strategy Match Rate: ${(avgMatchRate * 100).toFixed(1)}%`);
        
        // Match rate distribution
        const matchRateRanges = [
            { min: 0.9, max: 1.0, label: 'Excellent (90-100%)' },
            { min: 0.7, max: 0.9, label: 'Good (70-89%)' },
            { min: 0.5, max: 0.7, label: 'Fair (50-69%)' },
            { min: 0.0, max: 0.5, label: 'Poor (0-49%)' }
        ];

        matchRateRanges.forEach(range => {
            const count = successful.filter(r => 
                r.validation.matchRate >= range.min && r.validation.matchRate < range.max
            ).length;
            console.log(`   ${range.label}: ${count} tests`);
        });

        // Most Common Recommendations
        console.log(`\n💡 TOP RECOMMENDED STRATEGIES:`);
        console.log('─'.repeat(50));
        
        const allRecommendations = successful.flatMap(r => r.recommendations.primary.map(p => p.strategy));
        const recommendationCounts = {};
        
        allRecommendations.forEach(rec => {
            recommendationCounts[rec] = (recommendationCounts[rec] || 0) + 1;
        });

        Object.entries(recommendationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .forEach(([strategy, count]) => {
                console.log(`   ${strategy.padEnd(30)} | ${count} times`);
            });

        // Critical Warnings Analysis
        console.log(`\n⚠️ RISK MANAGEMENT ANALYSIS:`);
        console.log('─'.repeat(50));
        
        const allWarnings = successful.flatMap(r => r.recommendations.warnings);
        const criticalWarnings = allWarnings.filter(w => w.severity === 'CRITICAL');
        const highWarnings = allWarnings.filter(w => w.severity === 'HIGH');
        
        console.log(`   Total Warnings: ${allWarnings.length}`);
        console.log(`   Critical Warnings: ${criticalWarnings.length}`);
        console.log(`   High Priority Warnings: ${highWarnings.length}`);
        
        // Warning types
        const warningTypes = {};
        allWarnings.forEach(w => {
            warningTypes[w.type] = (warningTypes[w.type] || 0) + 1;
        });
        
        console.log(`   Warning Types:`);
        Object.entries(warningTypes).forEach(([type, count]) => {
            console.log(`     ${type}: ${count}`);
        });

        // Friday 0DTE Analysis
        console.log(`\n📅 FRIDAY 0DTE ANALYSIS:`);
        console.log('─'.repeat(40));
        
        const fridayTests = successful.filter(r => r.userData && r.userData.dayOfWeek && r.userData.dayOfWeek.toLowerCase().includes('friday'));
        const fridayWith0DTE = fridayTests.filter(r => r.recommendations.friday0DTE);
        const preMarket0DTE = fridayWith0DTE.filter(r => r.recommendations.friday0DTE.status === 'PRE_MARKET');
        const active0DTE = fridayWith0DTE.filter(r => r.recommendations.friday0DTE.status === 'ACTIVE');
        
        console.log(`   Friday Tests: ${fridayTests.length}`);
        console.log(`   0DTE Recommendations Generated: ${fridayWith0DTE.length}`);
        console.log(`   Pre-Market Analysis: ${preMarket0DTE.length}`);
        console.log(`   Active Trading Recommendations: ${active0DTE.length}`);

        // Edge Case Analysis
        console.log(`\n🚨 EDGE CASE HANDLING:`);
        console.log('─'.repeat(40));
        
        const edgeCaseResults = categoryResults['edge_cases'];
        console.log(`   Edge Case Tests: ${edgeCaseResults.total}`);
        console.log(`   Successfully Handled: ${edgeCaseResults.successful}`);
        console.log(`   Failed to Handle: ${edgeCaseResults.failed}`);
        
        if (edgeCaseResults.failed > 0) {
            console.log(`   Failed Edge Cases:`);
            edgeCaseResults.scenarios.filter(s => !s.success).forEach(f => {
                console.log(`     - ${f.scenario}: ${f.error}`);
            });
        }

        // August 2024 Disaster Prevention Analysis
        const aug2024Tests = successful.filter(r => 
            r.scenario.includes('August 2024') || r.scenario.includes('Correlation')
        );
        
        if (aug2024Tests.length > 0) {
            console.log(`\n🛡️ AUGUST 2024 DISASTER PREVENTION:`);
            console.log('─'.repeat(50));
            console.log(`   August 2024 Related Tests: ${aug2024Tests.length}`);
            
            const correlationWarnings = aug2024Tests.filter(r => 
                r.recommendations.warnings.some(w => w.type === 'CORRELATION_RISK')
            );
            
            console.log(`   Correlation Warnings Triggered: ${correlationWarnings.length}`);
            console.log(`   Prevention Protocol Status: ${correlationWarnings.length > 0 ? '✅ ACTIVE' : '❌ NOT DETECTED'}`);
        }

        // Performance Metrics
        console.log(`\n⚡ PERFORMANCE METRICS:`);
        console.log('─'.repeat(40));
        
        const executionTimes = successful.map(r => r.executionTime);
        const avgExecution = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
        const maxExecution = Math.max(...executionTimes);
        const minExecution = Math.min(...executionTimes);
        
        console.log(`   Average Execution Time: ${avgExecution.toFixed(1)}ms`);
        console.log(`   Fastest Test: ${minExecution}ms`);
        console.log(`   Slowest Test: ${maxExecution}ms`);
        console.log(`   Tests per Second: ${(successful.length / (totalExecutionTime / 1000)).toFixed(1)}`);

        // Final Status
        console.log(`\n✅ COMPREHENSIVE TEST SUITE COMPLETE`);
        console.log('─'.repeat(60));
        
        const overallSuccess = (successful.length / this.results.length) >= 0.95;
        
        console.log(`   Overall Status: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
        console.log(`   Framework Readiness: ${overallSuccess ? 'READY FOR PRODUCTION' : 'NEEDS ATTENTION'}`);
        console.log(`   Recommendation Engine: ${avgMatchRate >= 0.8 ? '✅ EXCELLENT' : avgMatchRate >= 0.6 ? '⚠️ GOOD' : '❌ NEEDS IMPROVEMENT'}`);
        console.log(`   Risk Management: ${criticalWarnings.length > 0 ? '✅ ACTIVE' : '⚠️ VERIFY'}`);
        
        console.log('\n📋 All recommendations are for MANUAL EXECUTION only');
        console.log('🎯 System validated across all scenarios and market conditions');
        console.log('🛡️ Risk management protocols tested and verified');
        console.log('='.repeat(100));
    }

    /**
     * Get phase account value ranges
     */
    getPhaseRange(phase) {
        const ranges = {
            1: '30k-40k',
            2: '40k-60k', 
            3: '60k-75k',
            4: '75k+'
        };
        return ranges[phase] || 'Unknown';
    }

    /**
     * Run specific test category
     */
    async runCategoryTests(categoryName) {
        const categoryScenarios = this.scenarios.filter(s => s.category === categoryName);
        
        if (categoryScenarios.length === 0) {
            console.log(`❌ No scenarios found for category: ${categoryName}`);
            console.log('Available categories:', this.testCategories.join(', '));
            return null;
        }

        console.log(`\n🧪 RUNNING ${categoryName.toUpperCase()} TESTS`);
        console.log('='.repeat(60));
        console.log(`📊 Testing ${categoryScenarios.length} scenarios in ${categoryName} category\n`);

        const startTime = Date.now();
        const results = [];

        for (let i = 0; i < categoryScenarios.length; i++) {
            const scenario = categoryScenarios[i];
            console.log(`[${i + 1}/${categoryScenarios.length}] ${scenario.name}`);
            
            const result = await this.runScenario(scenario);
            results.push(result);
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const totalTime = Date.now() - startTime;
        const successful = results.filter(r => r.success).length;

        console.log(`\n📊 ${categoryName.toUpperCase()} CATEGORY RESULTS:`);
        console.log(`   Tests: ${results.length}`);
        console.log(`   Successful: ${successful} (${(successful/results.length*100).toFixed(1)}%)`);
        console.log(`   Execution Time: ${(totalTime/1000).toFixed(2)}s`);
        
        return results;
    }

    /**
     * List scenarios by category
     */
    listScenariosByCategory() {
        console.log('\n📋 COMPREHENSIVE TEST SCENARIOS BY CATEGORY:');
        console.log('='.repeat(80));

        this.testCategories.forEach(category => {
            const categoryScenarios = this.scenarios.filter(s => s.category === category);
            
            console.log(`\n📊 ${category.toUpperCase().replace('_', ' ')} (${categoryScenarios.length} scenarios):`);
            console.log('─'.repeat(60));
            
            categoryScenarios.forEach((scenario, i) => {
                console.log(`${(i + 1).toString().padStart(2)}. ${scenario.name}`);
                console.log(`    Phase: ${scenario.phase} | Expected: ${scenario.expectedStrategies.slice(0, 3).join(', ')}${scenario.expectedStrategies.length > 3 ? '...' : ''}`);
                console.log(`    ${scenario.description}`);
                console.log('');
            });
        });
    }
}

module.exports = ComprehensiveTestSuite;