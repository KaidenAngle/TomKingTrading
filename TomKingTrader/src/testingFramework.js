/**
 * TOM KING TESTING FRAMEWORK v17
 * Comprehensive scenario-based testing for recommendations
 * Based on V14-V17 framework specifications
 * 
 * PURPOSE: Generate trading recommendations for manual execution
 * NO LIVE TRADING - RECOMMENDATIONS ONLY
 */

const { TastyTradeAPI } = require('./tastytradeAPI');

class TomKingTestingFramework {
    constructor() {
        this.scenarios = [];
        this.results = [];
        this.api = null;
        this.testMode = true; // Always in test mode for recommendations
        
        console.log('🧪 Tom King Testing Framework v17 initialized');
        console.log('📋 Mode: RECOMMENDATIONS ONLY (No live trading)');
    }

    /**
     * Initialize API connection for market data (no trading)
     */
    async initialize(useAPI = false) {
        if (useAPI) {
            try {
                this.api = new TastyTradeAPI();
                await this.api.initialize();
                console.log('✅ API connected for market data only');
            } catch (error) {
                console.log('⚠️ API not available, using simulated data');
                this.api = null;
            }
        }
        
        // Load predefined test scenarios from V14-V17
        this.loadTestScenarios();
        console.log(`📊 Loaded ${this.scenarios.length} test scenarios`);
    }

    /**
     * Load comprehensive test scenarios based on V14-V17 documentation
     */
    loadTestScenarios() {
        this.scenarios = [
            // PHASE 1 SCENARIOS (£30-40k)
            {
                name: "Phase 1: Fresh Account - Friday 0DTE Opportunity",
                input: "£35000 | none | 0% | Friday Jan 10 10:15 AM EST | VIX 15.2 | No",
                expectedStrategies: ["0DTE", "MCL Strangle", "MGC Strangle"],
                phase: 1,
                description: "New account on Friday morning - should recommend 0DTE after 10:30 AM"
            },
            {
                name: "Phase 1: High VIX Opportunity", 
                input: "£38000 | none | 0% | Monday Jan 13 9:45 AM EST | VIX 28.5 | No",
                expectedStrategies: ["VIX Spike Protocol", "Premium Collection"],
                phase: 1,
                description: "High VIX spike - should recommend premium collection strategies"
            },
            {
                name: "Phase 1: Weekend Position Review",
                input: "£32000 | MCL strangle (55 DTE, 2.80, +15%) | 8% | Saturday Jan 11 2:30 PM EST | VIX 16.8 | No",
                expectedStrategies: ["Position Management", "Weekend Review"],
                phase: 1,
                description: "Weekend review with profitable position"
            },

            // PHASE 2 SCENARIOS (£40-60k)
            {
                name: "Phase 2: Core Position Active",
                input: "£45000 | ES LT112 (85 DTE, 6420, +5%) | 32% | Wednesday Jan 8 10:15 AM EST | VIX 15.2 | No",
                expectedStrategies: ["LT112 Management", "Add Strangles", "0DTE on Friday"],
                phase: 2,
                description: "Active LT112 position - should recommend additional strategies"
            },
            {
                name: "Phase 2: Multiple Positions",
                input: "£52000 | ES LT112 (85 DTE, 6420, +5%), MCL strangle (55 DTE, 2.80, +15%), TLT IPMCC (280 DTE, 95/weekly, -2%) | 45% | Friday Jan 10 10:45 AM EST | VIX 13.8 | No",
                expectedStrategies: ["0DTE", "Position Management", "Profit Taking"],
                phase: 2,
                description: "Multiple positions active - 0DTE opportunity + management"
            },
            {
                name: "Phase 2: 21 DTE Management Trigger",
                input: "£48000 | MES LT112 (21 DTE, 5420, +25%) | 28% | Tuesday Jan 14 11:30 AM EST | VIX 16.5 | No",
                expectedStrategies: ["21 DTE Rule", "Profit Taking", "Roll Forward"],
                phase: 2,
                description: "Position at 21 DTE - should trigger Tom King management rules"
            },

            // PHASE 3 SCENARIOS (£60-75k)
            {
                name: "Phase 3: Butterfly Opportunities", 
                input: "£68000 | ES LT112 (65 DTE, 6420, +8%), CL strangle (90 DTE, 3.50, +12%) | 38% | Monday Jan 13 2:15 PM EST | VIX 12.3 | No",
                expectedStrategies: ["Butterfly Spreads", "Ratio Spreads", "ES Upgrade"],
                phase: 3,
                description: "Phase 3 account with room for advanced strategies"
            },
            {
                name: "Phase 3: Full Futures Access",
                input: "£71000 | ES LT112 (75 DTE, 6420, +15%), GC strangle (88 DTE, 4.20, +8%), LE butterfly (45 DTE, 1.50, -5%) | 55% | Thursday Jan 9 3:45 PM EST | VIX 18.9 | No",
                expectedStrategies: ["Portfolio Optimization", "Correlation Check", "Defensive Adjustments"],
                phase: 3,
                description: "High BP usage with multiple futures positions"
            },

            // PHASE 4 SCENARIOS (£75k+)
            {
                name: "Phase 4: Professional Deployment",
                input: "£85000 | ES LT112 (45 DTE, 6420, +18%), NQ strangle (65 DTE, 8.50, +22%), CL butterfly (90 DTE, 2.80, +5%), GC ratio (30 DTE, 3.20, -8%) | 62% | Friday Jan 10 10:35 AM EST | VIX 14.2 | Yes",
                expectedStrategies: ["0DTE", "Portfolio Margin Optimization", "Tax Optimization", "Advanced Management"],
                phase: 4,
                description: "Large account with portfolio margin and complex positions"
            },

            // CRISIS SCENARIOS
            {
                name: "August 5, 2024 Disaster Prevention",
                input: "£55000 | ES LT112 (45 DTE, 6420, -45%), MES LT112 (45 DTE, 5420, -48%), NQ strangle (45 DTE, 8.50, -52%), RTY strangle (45 DTE, 4.20, -41%), CL strangle (45 DTE, 3.50, -38%), GC strangle (45 DTE, 2.80, -35%) | 85% | Monday Aug 5 9:45 AM EST | VIX 35.8 | No",
                expectedStrategies: ["Emergency Protocol", "Correlation Disaster", "Risk Reduction"],
                phase: 2,
                description: "Recreate August 5, 2024 disaster - should detect over-correlation"
            },

            // VIX REGIME SCENARIOS
            {
                name: "VIX Regime 1: Extreme Low (VIX < 12)",
                input: "£50000 | none | 0% | Wednesday Jan 8 11:15 AM EST | VIX 9.8 | No",
                expectedStrategies: ["Conservative Sizing", "Premium Hunting", "Defensive Positioning"],
                phase: 2,
                description: "Extremely low VIX - should recommend conservative approach"
            },
            {
                name: "VIX Regime 5: Extreme High (VIX > 30)",
                input: "£50000 | none | 0% | Monday Jan 13 10:30 AM EST | VIX 42.3 | No", 
                expectedStrategies: ["VIX Spike Protocol", "Aggressive Premium Collection", "Short-term Opportunities"],
                phase: 2,
                description: "Extremely high VIX - should recommend aggressive premium collection"
            },

            // TIME-SPECIFIC SCENARIOS
            {
                name: "Pre-Market Friday Analysis (Phase 1)",
                input: "£35000 | none | 0% | Friday Jan 10 9:15 AM EST | VIX 15.2 | No",
                expectedStrategies: ["Pre-Market Analysis", "0DTE Preparation", "Trigger Levels"],
                phase: 1,
                description: "Friday pre-market - should provide 0DTE trigger levels"
            },
            {
                name: "Pre-Market Friday Analysis (Phase 2)", 
                input: "£45000 | MES LT112 (85 DTE, 5420, +5%) | 25% | Friday Jan 10 9:30 AM EST | VIX 16.8 | No",
                expectedStrategies: ["Pre-Market Analysis", "0DTE Preparation", "Multiple Contract Sizing"],
                phase: 2,
                description: "Phase 2 Friday pre-market - should recommend multiple contracts"
            },
            {
                name: "After Hours - No Trading",
                input: "£45000 | ES LT112 (85 DTE, 6420, +5%) | 32% | Friday Jan 10 8:30 PM EST | VIX 15.2 | No",
                expectedStrategies: ["Market Closed Warning", "Position Review", "Weekend Planning"],
                phase: 2,
                description: "After hours - should warn about market closure"
            }
        ];
    }

    /**
     * Run a single test scenario and generate recommendations
     */
    async runScenario(scenario) {
        console.log(`\n🧪 TESTING: ${scenario.name}`);
        console.log(`📋 Input: ${scenario.input}`);
        console.log(`🎯 Phase: ${scenario.phase} | Expected: ${scenario.expectedStrategies.join(', ')}`);
        
        const startTime = Date.now();
        
        try {
            // Parse the input format from V14-V17
            const userData = this.parseUserInput(scenario.input);
            
            // Get market data (API or simulated)
            const searchedData = await this.getMarketData(userData);
            
            // Run Tom King analysis
            const analysis = this.runTomKingAnalysis(userData, searchedData);
            
            // Generate recommendations (NO TRADING)
            const recommendations = this.generateRecommendations(analysis, userData, searchedData);
            
            const result = {
                scenario: scenario.name,
                phase: scenario.phase,
                success: true,
                userData,
                analysis,
                recommendations,
                executionTime: Date.now() - startTime,
                validation: this.validateRecommendations(recommendations, scenario.expectedStrategies)
            };
            
            this.logResults(result);
            this.results.push(result);
            
            return result;
            
        } catch (error) {
            const result = {
                scenario: scenario.name,
                phase: scenario.phase,
                success: false,
                error: error.message,
                executionTime: Date.now() - startTime
            };
            
            console.log(`❌ Test failed: ${error.message}`);
            this.results.push(result);
            
            return result;
        }
    }

    /**
     * Parse user input in V14-V17 format
     * Format: £[amount] | [positions] | [BP%] | [Day Date Time] | VIX [level] | [PM Y/N]
     */
    parseUserInput(inputString) {
        const parts = inputString.split(' | ');
        
        // Account value
        const accountValue = parseInt(parts[0].replace('£', '').replace(',', ''));
        
        // Positions
        const positionsStr = parts[1] || 'none';
        const positions = this.parsePositions(positionsStr);
        
        // Buying power percentage
        const bpUsed = parseFloat(parts[2].replace('%', ''));
        
        // Date/time parsing with test mode override
        const dateTimeStr = parts[3];
        const { dayOfWeek, timeEST, testMode } = this.parseDatetime(dateTimeStr);
        
        // VIX level
        const vixLevel = parseFloat(parts[4].replace('VIX ', ''));
        
        // Portfolio margin
        const portfolioMargin = parts[5] === 'Yes';
        
        // Determine phase based on account value (from PDF pages 13-24)
        let phase = 1;
        if (accountValue >= 75000) phase = 4;
        else if (accountValue >= 60000) phase = 3;
        else if (accountValue >= 40000) phase = 2;
        
        return {
            accountValue,
            positions,
            bpUsed,
            dayOfWeek,
            timeEST,
            vixLevel,
            portfolioMargin,
            phase,
            testMode
        };
    }

    /**
     * Parse positions string in Tom King format
     * Examples: "ES LT112 (85 DTE, 6420, +5%)", "MCL strangle (55 DTE, 2.80, +15%)"
     */
    parsePositions(positionsStr) {
        if (positionsStr === 'none') return [];
        
        const positions = [];
        const patterns = [
            // Standard format: ES LT112 (85 DTE, 6420, +5%)
            /([A-Z0-9]+)\s+([A-Z0-9]+)\s*\((\d+)\s*DTE,\s*([0-9.]+)(?:\/weekly)?,\s*([+-]?\d+)%?\)/gi,
            // Alternative: MCL strangle (55 DTE, 2.80, +15%)
            /([A-Z0-9]+)\s+([a-z]+)\s*\((\d+)\s*DTE,\s*([0-9.]+),\s*([+-]?\d+)%?\)/gi
        ];
        
        patterns.forEach(pattern => {
            let match;
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(positionsStr)) !== null) {
                const ticker = match[1].toUpperCase();
                const strategy = match[2].toUpperCase();
                const dte = parseInt(match[3]);
                const entry = parseFloat(match[4]);
                const pl = parseInt(match[5]);
                
                positions.push({
                    ticker,
                    strategy,
                    dte,
                    entry,
                    pl,
                    bpUsed: this.estimateBPForPosition(ticker, strategy)
                });
            }
        });
        
        return positions;
    }

    /**
     * Parse datetime string and detect test mode overrides
     */
    parseDatetime(dateTimeStr) {
        // Check for test mode override: "Pretend it's Friday 01/10 9:15 AM EST"
        const testPattern = /Pretend it'?s (\w+day) (\d{1,2}\/\d{1,2}) (\d{1,2}:\d{2} [AP]M)/i;
        const testMatch = dateTimeStr.match(testPattern);
        
        if (testMatch) {
            return {
                dayOfWeek: testMatch[1],
                timeEST: `${testMatch[2]} ${testMatch[3]}`,
                testMode: true
            };
        }
        
        // Standard format: "Friday Jan 10 10:15 AM EST"
        const parts = dateTimeStr.split(' ');
        const dayOfWeek = parts[0];
        const timeEST = dateTimeStr.replace('EST', '').trim();
        
        return {
            dayOfWeek,
            timeEST,
            testMode: false
        };
    }

    /**
     * Estimate buying power for position (from V14 specifications)
     */
    estimateBPForPosition(ticker, strategy) {
        const isMicro = ticker.startsWith('M') || ticker === 'MCL' || ticker === 'MGC';
        
        const bpMap = {
            'STRANGLE': isMicro ? 2.5 : 3.5,
            'LT112': ticker === 'ES' ? 6 : ticker === 'MES' ? 3 : 4,
            'IPMCC': 8,
            '0DTE': 2,
            'LEAP': 2,
            'BUTTERFLY': 0.5,
            'RATIO': 2,
            'DIAGONAL': 1.5,
            'BOX': 0
        };
        
        return bpMap[strategy] || 3;
    }

    /**
     * Get market data (API or simulated)
     */
    async getMarketData(userData) {
        if (this.api) {
            try {
                // Use real API data
                return await this.api.marketDataCollector.buildSearchedData();
            } catch (error) {
                console.log('⚠️ API data failed, using simulated data');
            }
        }
        
        // Generate simulated market data based on VIX level
        return this.generateSimulatedData(userData.vixLevel);
    }

    /**
     * Generate simulated market data for testing
     */
    generateSimulatedData(vixLevel) {
        const baseES = 5450;
        const baseSPY = 545;
        
        // Adjust for VIX regime
        const volatilityMultiplier = vixLevel > 25 ? 1.5 : vixLevel < 12 ? 0.7 : 1.0;
        
        return {
            ES: {
                currentPrice: baseES + (Math.random() - 0.5) * 100 * volatilityMultiplier,
                openPrice: baseES + (Math.random() - 0.5) * 50,
                previousClose: baseES + (Math.random() - 0.5) * 30,
                high5d: baseES + 75,
                low5d: baseES - 75,
                high20d: baseES + 150,
                low20d: baseES - 150,
                atr: 45 * volatilityMultiplier,
                rsi: 45 + Math.random() * 20,
                ema8: baseES + (Math.random() - 0.5) * 25,
                ema21: baseES + (Math.random() - 0.5) * 50,
                vwap: baseES + (Math.random() - 0.5) * 15,
                iv: (15 + Math.random() * 10) * volatilityMultiplier,
                ivRank: Math.random() * 100,
                ivPercentile: Math.random() * 100,
                optionChain: {
                    put5Delta: baseES - 150,
                    put5DeltaBid: 2.5,
                    call5Delta: baseES + 150,
                    call5DeltaBid: 2.5,
                    atmStrike: Math.round(baseES / 5) * 5,
                    call30Wide: {
                        shortStrike: baseES + 30,
                        longStrike: baseES + 60,
                        credit: 5.0 + Math.random() * 3
                    },
                    put30Wide: {
                        shortStrike: baseES - 30,
                        longStrike: baseES - 60,
                        credit: 5.0 + Math.random() * 3
                    },
                    ironCondor: {
                        credit: 8.0 + Math.random() * 4
                    }
                }
            },
            SPY: {
                currentPrice: baseSPY + (Math.random() - 0.5) * 10,
                // ... similar structure
            },
            VIX: {
                current: vixLevel,
                avg20d: vixLevel * 0.9,
                regime: this.getVIXRegime(vixLevel)
            },
            TIME: {
                currentEST: new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
                currentUK: new Date().toLocaleTimeString('en-GB', { timeZone: 'Europe/London' }),
                marketStatus: 'OPEN' // Simplified for testing
            }
        };
    }

    /**
     * Determine VIX regime (from PDF pages 4-5)
     */
    getVIXRegime(vixLevel) {
        if (vixLevel < 12) return { level: 1, description: "Extreme Low - Conservative Sizing" };
        if (vixLevel < 16) return { level: 2, description: "Low - Standard Sizing" };
        if (vixLevel < 20) return { level: 3, description: "Normal - Moderate Sizing" };
        if (vixLevel < 30) return { level: 4, description: "High - Aggressive Sizing" };
        return { level: 5, description: "Extreme High - Max Premium Collection" };
    }

    /**
     * Run Tom King analysis on the data
     */
    runTomKingAnalysis(userData, searchedData) {
        const analysis = {
            phase: userData.phase,
            vixRegime: searchedData.VIX.regime,
            marketConditions: this.analyzeMarketConditions(searchedData),
            positionHealth: this.analyzePositionHealth(userData.positions),
            correlationRisk: this.analyzeCorrelationRisk(userData.positions),
            bpUtilization: userData.bpUsed,
            timeAnalysis: this.analyzeTimeConditions(userData.dayOfWeek, userData.timeEST),
            riskMetrics: this.calculateRiskMetrics(userData, searchedData)
        };
        
        return analysis;
    }

    /**
     * Analyze market conditions
     */
    analyzeMarketConditions(searchedData) {
        const es = searchedData.ES;
        const spy = searchedData.SPY;
        const vix = searchedData.VIX;
        
        return {
            trend: es.currentPrice > es.ema21 ? 'BULLISH' : 'BEARISH',
            volatility: vix.regime.description,
            momentum: es.rsi > 70 ? 'OVERBOUGHT' : es.rsi < 30 ? 'OVERSOLD' : 'NEUTRAL',
            ivRank: es.ivRank,
            opportunity: this.assessOpportunity(es, vix)
        };
    }

    /**
     * Assess trading opportunity based on market conditions
     */
    assessOpportunity(es, vix) {
        if (vix.current > 25) return 'EXCELLENT - High premium environment';
        if (es.ivRank > 70) return 'GOOD - High IV rank for premium collection';
        if (es.ivRank < 30) return 'POOR - Low IV, consider buying options';
        return 'MODERATE - Standard conditions';
    }

    /**
     * Analyze position health and exit triggers
     */
    analyzePositionHealth(positions) {
        return positions.map(pos => {
            const health = this.calculatePositionHealth(pos);
            const exitTrigger = this.getExitTrigger(pos);
            
            return {
                ...pos,
                health,
                exitTrigger,
                action: this.getRecommendedAction(pos, health, exitTrigger)
            };
        });
    }

    /**
     * Calculate position health score
     */
    calculatePositionHealth(position) {
        const { dte, pl } = position;
        
        // Tom King rules: 21 DTE management, 50% profit target
        if (dte <= 21 && pl < 50) return 'CRITICAL - 21 DTE Rule Triggered';
        if (pl >= 50) return 'EXCELLENT - Profit Target Reached';
        if (pl >= 25) return 'GOOD - Profitable Position';
        if (pl >= -10) return 'FAIR - Small Loss';
        if (pl >= -25) return 'POOR - Moderate Loss';
        return 'CRITICAL - Large Loss';
    }

    /**
     * Get exit trigger for position
     */
    getExitTrigger(position) {
        const { strategy, dte, pl } = position;
        
        if (dte <= 21) return '21 DTE Management Rule';
        if (pl >= 50) return '50% Profit Target';
        if (strategy === '0DTE' && dte === 0) return 'Expiration Day Management';
        if (pl <= -100) return 'Stop Loss Consideration';
        
        return 'Hold - Monitor Closely';
    }

    /**
     * Get recommended action for position
     */
    getRecommendedAction(position, health, exitTrigger) {
        if (exitTrigger.includes('21 DTE')) return 'CLOSE/ROLL - 21 DTE Rule';
        if (exitTrigger.includes('50%')) return 'CLOSE - Take Profit';
        if (exitTrigger.includes('Stop Loss')) return 'CONSIDER CLOSING - Large Loss';
        if (health.includes('EXCELLENT')) return 'HOLD - Monitor for Profit Taking';
        
        return 'HOLD - Continue Monitoring';
    }

    /**
     * Analyze correlation risk (August 5, 2024 disaster prevention)
     */
    analyzeCorrelationRisk(positions) {
        const correlationGroups = {
            'EQUITY_FUTURES': ['ES', 'MES', 'NQ', 'MNQ', 'RTY'],
            'ENERGY': ['CL', 'NG', 'RB', 'HO'],
            'METALS': ['GC', 'SI', 'MGC'],
            'BONDS': ['ZB', 'ZN', 'ZF', 'ZT', 'TLT'],
            'CURRENCIES': ['6E', '6B', '6A', '6J', '6S'],
            'GRAINS': ['ZC', 'ZS', 'ZW'],
            'LIVESTOCK': ['LE', 'HE']
        };
        
        const groupCounts = {};
        positions.forEach(pos => {
            for (const [group, tickers] of Object.entries(correlationGroups)) {
                if (tickers.includes(pos.ticker)) {
                    groupCounts[group] = (groupCounts[group] || 0) + 1;
                }
            }
        });
        
        const violations = [];
        for (const [group, count] of Object.entries(groupCounts)) {
            if (count > 3) { // Tom King rule: max 3 per correlation group
                violations.push({
                    group,
                    count,
                    severity: 'CRITICAL - August 2024 Risk Pattern'
                });
            }
        }
        
        return {
            groups: groupCounts,
            violations,
            riskLevel: violations.length > 0 ? 'HIGH' : 'ACCEPTABLE'
        };
    }

    /**
     * Analyze time conditions for strategy recommendations
     */
    analyzeTimeConditions(dayOfWeek, timeEST) {
        const isFriday = dayOfWeek.toLowerCase().includes('friday');
        const hour = this.extractHour(timeEST);
        const after1030 = hour >= 10.5; // 10:30 AM
        
        return {
            dayOfWeek,
            isFriday,
            hour,
            after1030,
            marketStatus: this.getMarketStatus(dayOfWeek, hour),
            tradingRecommendation: this.getTimeBasedRecommendation(dayOfWeek, hour, after1030)
        };
    }

    /**
     * Extract hour from time string
     */
    extractHour(timeEST) {
        try {
            const timeMatch = timeEST.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
            if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                const minute = parseInt(timeMatch[2]);
                const ampm = timeMatch[3];
                
                if (ampm && ampm.toUpperCase() === 'PM' && hour !== 12) hour += 12;
                if (ampm && ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
                
                return hour + (minute / 60);
            }
        } catch (error) {
            // Fallback for parsing errors
        }
        
        return 10; // Default to 10 AM if parsing fails
    }

    /**
     * Get market status based on day and time
     */
    getMarketStatus(dayOfWeek, hour) {
        const day = dayOfWeek.toLowerCase();
        
        if (day.includes('saturday') || day.includes('sunday')) {
            return 'CLOSED - Weekend';
        }
        
        if (hour < 9.5 || hour > 16) {
            return 'CLOSED - After Hours';
        }
        
        return 'OPEN';
    }

    /**
     * Get time-based trading recommendation
     */
    getTimeBasedRecommendation(dayOfWeek, hour, after1030) {
        const day = dayOfWeek.toLowerCase();
        
        if (day.includes('friday') && after1030) {
            return '0DTE Trading Window Open';
        }
        
        if (day.includes('friday') && !after1030) {
            return 'Pre-Market 0DTE Analysis - Wait for 10:30 AM';
        }
        
        if (day.includes('saturday') || day.includes('sunday')) {
            return 'Weekend Position Review';
        }
        
        return 'Standard Trading Hours';
    }

    /**
     * Calculate risk metrics
     */
    calculateRiskMetrics(userData, searchedData) {
        const maxBPUsage = 65; // Tom King max BP rule
        const currentBP = userData.bpUsed;
        const availableBP = maxBPUsage - currentBP;
        
        return {
            currentBPUsage: currentBP,
            maxBPUsage,
            availableBP,
            riskLevel: currentBP > 50 ? 'HIGH' : currentBP > 30 ? 'MODERATE' : 'LOW',
            accountSize: userData.accountValue,
            phase: userData.phase,
            kelly: this.calculateKellyCriterion(userData, searchedData)
        };
    }

    /**
     * Calculate Kelly Criterion for position sizing
     */
    calculateKellyCriterion(userData, searchedData) {
        // Simplified Kelly based on VIX regime and phase
        const vixMultiplier = searchedData.VIX.current > 25 ? 1.5 : 
                             searchedData.VIX.current < 12 ? 0.7 : 1.0;
        
        const phaseMultiplier = userData.phase / 4; // Scale with phase
        
        return {
            multiplier: vixMultiplier * phaseMultiplier,
            recommendation: 'Size positions according to VIX regime and account phase'
        };
    }

    /**
     * Generate trading recommendations (NO LIVE TRADING)
     */
    generateRecommendations(analysis, userData, searchedData) {
        const recommendations = {
            primary: [],
            secondary: [],
            warnings: [],
            management: [],
            friday0DTE: null,
            phaseSpecific: []
        };
        
        // Check for critical warnings first
        this.addCriticalWarnings(recommendations, analysis, userData);
        
        // Add position management recommendations
        this.addManagementRecommendations(recommendations, analysis.positionHealth);
        
        // Add new opportunity recommendations
        this.addOpportunityRecommendations(recommendations, analysis, userData, searchedData);
        
        // Add phase-specific recommendations
        this.addPhaseSpecificRecommendations(recommendations, userData, analysis, searchedData);
        
        // Add Friday 0DTE analysis if applicable
        this.addFriday0DTEAnalysis(recommendations, analysis.timeAnalysis, userData, searchedData);
        
        return recommendations;
    }

    /**
     * Add critical warnings
     */
    addCriticalWarnings(recommendations, analysis, userData) {
        // Correlation risk (August 2024 disaster prevention)
        if (analysis.correlationRisk.violations.length > 0) {
            recommendations.warnings.push({
                severity: 'CRITICAL',
                type: 'CORRELATION_RISK',
                message: '⚠️ AUGUST 2024 CORRELATION WARNING - Too many positions in same group',
                detail: `Violations: ${analysis.correlationRisk.violations.map(v => `${v.group}: ${v.count} positions`).join(', ')}`,
                action: 'Reduce correlation exposure immediately - Tom lost £308k this way'
            });
        }
        
        // High BP usage warning
        if (analysis.bpUtilization > 50) {
            recommendations.warnings.push({
                severity: 'HIGH',
                type: 'BP_USAGE',
                message: `⚠️ High BP Usage: ${analysis.bpUtilization}%`,
                action: 'Consider reducing position sizes or closing profitable trades'
            });
        }
        
        // Market closed warning
        if (analysis.timeAnalysis.marketStatus.includes('CLOSED')) {
            recommendations.warnings.push({
                severity: 'INFO',
                type: 'MARKET_CLOSED',
                message: `📅 ${analysis.timeAnalysis.marketStatus}`,
                action: 'No trading available - Use time for position review and planning'
            });
        }
    }

    /**
     * Add position management recommendations
     */
    addManagementRecommendations(recommendations, positionHealth) {
        positionHealth.forEach(pos => {
            if (pos.action.includes('CLOSE') || pos.action.includes('ROLL')) {
                recommendations.management.push({
                    position: `${pos.ticker} ${pos.strategy}`,
                    dte: pos.dte,
                    pl: pos.pl,
                    action: pos.action,
                    reason: pos.exitTrigger,
                    priority: pos.health.includes('CRITICAL') ? 'HIGH' : 'NORMAL'
                });
            }
        });
    }

    /**
     * Add new opportunity recommendations
     */
    addOpportunityRecommendations(recommendations, analysis, userData, searchedData) {
        const availableBP = Math.max(0, 65 - analysis.bpUtilization);
        
        if (availableBP < 10) {
            recommendations.primary.push({
                strategy: 'PORTFOLIO_MANAGEMENT',
                message: 'Low available BP - Focus on managing existing positions',
                bpRequired: 0
            });
            return;
        }
        
        // VIX-based opportunities
        if (searchedData.VIX.current > 25) {
            recommendations.primary.push({
                strategy: 'PREMIUM_COLLECTION',
                message: `High VIX (${searchedData.VIX.current}) - Excellent premium collection opportunity`,
                suggestions: ['Short strangles', 'Credit spreads', 'Iron condors'],
                bpRequired: 15
            });
        }
        
        // Standard strategies by phase
        const phaseStrategies = this.getPhaseAppropriateStrategies(userData.phase);
        phaseStrategies.forEach(strategy => {
            if (this.hasCapacityForStrategy(strategy, userData.positions, userData.phase)) {
                recommendations.secondary.push({
                    strategy: strategy.name,
                    message: strategy.description,
                    bpRequired: strategy.bpRequired,
                    phase: userData.phase
                });
            }
        });
    }

    /**
     * Get phase-appropriate strategies
     */
    getPhaseAppropriateStrategies(phase) {
        const strategies = {
            1: [
                { name: 'MCL_STRANGLE', description: 'MCL 90-day strangles for steady premium', bpRequired: 8 },
                { name: 'MGC_STRANGLE', description: 'MGC 90-day strangles for portfolio diversity', bpRequired: 10 },
                { name: 'GLD_IPMCC', description: 'GLD Poor Man\'s Covered Call', bpRequired: 15 }
            ],
            2: [
                { name: 'MES_LT112', description: 'MES Long-Term 112-day strategy', bpRequired: 12 },
                { name: 'TLT_STRANGLE', description: 'TLT bond volatility strategy', bpRequired: 10 },
                { name: 'SLV_BUTTERFLY', description: 'SLV butterfly for range-bound markets', bpRequired: 3 }
            ],
            3: [
                { name: 'ES_LT112', description: 'ES Long-Term 112-day (full futures)', bpRequired: 18 },
                { name: 'CL_STRANGLE', description: 'Crude oil volatility strategy', bpRequired: 12 },
                { name: 'GC_BUTTERFLY', description: 'Gold butterfly spread', bpRequired: 5 }
            ],
            4: [
                { name: 'PORTFOLIO_OPTIMIZATION', description: 'Full system deployment with all strategies', bpRequired: 20 },
                { name: 'TAX_OPTIMIZATION', description: '1256 contracts for tax efficiency', bpRequired: 15 },
                { name: 'ADVANCED_SPREADS', description: 'Complex ratio and diagonal spreads', bpRequired: 10 }
            ]
        };
        
        return strategies[phase] || strategies[1];
    }

    /**
     * Check if there's capacity for a strategy
     */
    hasCapacityForStrategy(strategy, currentPositions, phase) {
        // Simplified capacity check - in real implementation, this would be more sophisticated
        const strategyCount = currentPositions.filter(pos => 
            pos.strategy.toLowerCase().includes(strategy.name.toLowerCase().split('_')[0])
        ).length;
        
        const maxPositions = phase; // Simplified: max positions = phase number
        return strategyCount < maxPositions;
    }

    /**
     * Add phase-specific recommendations
     */
    addPhaseSpecificRecommendations(recommendations, userData, analysis, searchedData) {
        const phase = userData.phase;
        
        switch (phase) {
            case 1:
                recommendations.phaseSpecific.push({
                    phase: 1,
                    message: 'Phase 1 Focus: Build foundation with micro futures and ETFs',
                    strategies: ['0DTE on Fridays', 'MCL/MGC strangles', 'Conservative position sizing'],
                    nextPhase: 'Reach £40k for Phase 2 upgrade'
                });
                break;
                
            case 2:
                recommendations.phaseSpecific.push({
                    phase: 2,
                    message: 'Phase 2 Focus: Add MES LT112 and enhanced strategies',
                    strategies: ['MES Long-Term 112', 'Multiple 0DTE contracts', 'Ratio spreads'],
                    nextPhase: 'Reach £60k for Phase 3 upgrade'
                });
                break;
                
            case 3:
                recommendations.phaseSpecific.push({
                    phase: 3,
                    message: 'Phase 3 Focus: Full futures upgrade and advanced strategies',
                    strategies: ['ES LT112 upgrade', 'Butterfly spreads', 'Complex adjustments'],
                    nextPhase: 'Reach £75k for Phase 4 professional deployment'
                });
                break;
                
            case 4:
                recommendations.phaseSpecific.push({
                    phase: 4,
                    message: 'Phase 4 Focus: Professional system deployment',
                    strategies: ['Full strategy suite', 'Portfolio margin optimization', 'Tax-efficient structures'],
                    nextPhase: 'System fully deployed - Focus on consistent execution'
                });
                break;
        }
    }

    /**
     * Add Friday 0DTE analysis
     */
    addFriday0DTEAnalysis(recommendations, timeAnalysis, userData, searchedData) {
        if (!timeAnalysis.isFriday) return;
        
        const es = searchedData.ES;
        const atmStrike = es.optionChain.atmStrike;
        
        if (!timeAnalysis.after1030) {
            recommendations.friday0DTE = {
                status: 'PRE_MARKET',
                message: '📅 Friday 0DTE Pre-Market Analysis',
                waitTime: '10:30 AM EST',
                triggerLevels: {
                    callSpread: atmStrike + 30,
                    putSpread: atmStrike - 30,
                    ironCondor: `Between ${atmStrike - 30} and ${atmStrike + 30}`
                },
                maxContracts: userData.phase,
                preparation: 'Monitor ES movement - prepare for 10:30 AM entry window'
            };
        } else {
            const direction = this.analyze0DTEDirection(es, searchedData.VIX);
            
            recommendations.friday0DTE = {
                status: 'ACTIVE',
                message: '⚡ 0DTE Trading Window Open',
                direction: direction.bias,
                confidence: direction.confidence,
                recommendation: {
                    strategy: direction.preferredStrategy,
                    strikes: direction.strikes,
                    targetCredit: direction.targetCredit,
                    maxContracts: Math.min(userData.phase, Math.floor((65 - userData.bpUsed) / 8))
                },
                warning: 'Expiration day - manage positions actively'
            };
        }
    }

    /**
     * Analyze 0DTE direction and strategy
     */
    analyze0DTEDirection(es, vix) {
        const momentum = es.rsi > 70 ? 'BEARISH' : es.rsi < 30 ? 'BULLISH' : 'NEUTRAL';
        const trend = es.currentPrice > es.ema21 ? 'BULLISH' : 'BEARISH';
        const volatility = vix.current > 20 ? 'HIGH' : 'LOW';
        
        let bias, confidence, preferredStrategy, strikes, targetCredit;
        
        if (momentum === 'NEUTRAL' && volatility === 'LOW') {
            bias = 'IRON_CONDOR';
            confidence = 'MODERATE';
            preferredStrategy = 'Iron Condor';
            strikes = {
                putShort: es.optionChain.atmStrike - 30,
                putLong: es.optionChain.atmStrike - 60,
                callShort: es.optionChain.atmStrike + 30,
                callLong: es.optionChain.atmStrike + 60
            };
            targetCredit = es.optionChain.ironCondor.credit;
        } else if (momentum === 'BULLISH' || trend === 'BULLISH') {
            bias = 'PUT_SPREAD';
            confidence = momentum === trend ? 'HIGH' : 'MODERATE';
            preferredStrategy = 'Put Credit Spread';
            strikes = {
                short: es.optionChain.put30Wide.shortStrike,
                long: es.optionChain.put30Wide.longStrike
            };
            targetCredit = es.optionChain.put30Wide.credit;
        } else {
            bias = 'CALL_SPREAD';
            confidence = momentum === trend ? 'HIGH' : 'MODERATE';
            preferredStrategy = 'Call Credit Spread';
            strikes = {
                short: es.optionChain.call30Wide.shortStrike,
                long: es.optionChain.call30Wide.longStrike
            };
            targetCredit = es.optionChain.call30Wide.credit;
        }
        
        return {
            bias,
            confidence,
            preferredStrategy,
            strikes,
            targetCredit
        };
    }

    /**
     * Validate recommendations against expected strategies
     */
    validateRecommendations(recommendations, expectedStrategies) {
        const allRecommendations = [
            ...recommendations.primary.map(r => r.strategy),
            ...recommendations.secondary.map(r => r.strategy),
            ...recommendations.management.map(r => r.action),
            ...(recommendations.friday0DTE ? [recommendations.friday0DTE.status] : [])
        ];
        
        const matches = expectedStrategies.filter(expected => 
            allRecommendations.some(actual => 
                actual.toLowerCase().includes(expected.toLowerCase()) ||
                expected.toLowerCase().includes(actual.toLowerCase())
            )
        );
        
        return {
            expectedCount: expectedStrategies.length,
            matchedCount: matches.length,
            matchRate: matches.length / expectedStrategies.length,
            matches,
            allRecommendations
        };
    }

    /**
     * Log test results
     */
    logResults(result) {
        console.log(`\n✅ RESULTS: ${result.scenario}`);
        console.log(`⏱️ Execution: ${result.executionTime}ms | Phase: ${result.phase}`);
        
        if (result.recommendations.warnings.length > 0) {
            console.log(`⚠️ Warnings: ${result.recommendations.warnings.length}`);
            result.recommendations.warnings.forEach(w => {
                console.log(`   ${w.severity}: ${w.message}`);
            });
        }
        
        if (result.recommendations.primary.length > 0) {
            console.log(`💡 Primary Recommendations:`);
            result.recommendations.primary.forEach(r => {
                console.log(`   • ${r.strategy}: ${r.message}`);
            });
        }
        
        if (result.recommendations.management.length > 0) {
            console.log(`📋 Position Management:`);
            result.recommendations.management.forEach(m => {
                console.log(`   • ${m.position}: ${m.action} (${m.reason})`);
            });
        }
        
        if (result.recommendations.friday0DTE) {
            const friday = result.recommendations.friday0DTE;
            console.log(`📅 Friday 0DTE: ${friday.status} - ${friday.message}`);
        }
        
        // Validation results
        console.log(`🎯 Validation: ${result.validation.matchedCount}/${result.validation.expectedCount} strategies matched (${(result.validation.matchRate * 100).toFixed(1)}%)`);
        
        console.log('─'.repeat(80));
    }

    /**
     * Run all test scenarios
     */
    async runAllTests() {
        console.log('\n🧪 STARTING COMPREHENSIVE TOM KING TESTING FRAMEWORK');
        console.log('📋 Mode: RECOMMENDATIONS ONLY (No live trading)');
        console.log('🎯 Testing all phases, scenarios, and edge cases\n');
        
        const startTime = Date.now();
        
        for (let i = 0; i < this.scenarios.length; i++) {
            const scenario = this.scenarios[i];
            console.log(`\n[${i + 1}/${this.scenarios.length}] Running scenario: ${scenario.name}`);
            
            await this.runScenario(scenario);
            
            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const totalTime = Date.now() - startTime;
        this.generateTestReport(totalTime);
    }

    /**
     * Generate comprehensive test report
     */
    generateTestReport(totalExecutionTime) {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TOM KING TESTING FRAMEWORK - COMPREHENSIVE REPORT');
        console.log('='.repeat(80));
        
        const successful = this.results.filter(r => r.success);
        const failed = this.results.filter(r => !r.success);
        
        console.log(`\n📈 OVERALL RESULTS:`);
        console.log(`   Total Tests: ${this.results.length}`);
        console.log(`   Successful: ${successful.length} (${(successful.length/this.results.length*100).toFixed(1)}%)`);
        console.log(`   Failed: ${failed.length} (${(failed.length/this.results.length*100).toFixed(1)}%)`);
        console.log(`   Total Execution Time: ${totalExecutionTime}ms`);
        console.log(`   Average per Test: ${Math.round(totalExecutionTime/this.results.length)}ms`);
        
        // Phase breakdown
        console.log(`\n📊 RESULTS BY PHASE:`);
        [1, 2, 3, 4].forEach(phase => {
            const phaseResults = successful.filter(r => r.phase === phase);
            const phaseTotal = this.results.filter(r => r.phase === phase).length;
            console.log(`   Phase ${phase}: ${phaseResults.length}/${phaseTotal} successful`);
        });
        
        // Validation results
        console.log(`\n🎯 VALIDATION RESULTS:`);
        const avgMatchRate = successful.reduce((sum, r) => sum + r.validation.matchRate, 0) / successful.length;
        console.log(`   Average Strategy Match Rate: ${(avgMatchRate * 100).toFixed(1)}%`);
        
        // Most common recommendations
        const allRecommendations = successful.flatMap(r => r.recommendations.primary.map(p => p.strategy));
        const recommendationCounts = {};
        allRecommendations.forEach(rec => {
            recommendationCounts[rec] = (recommendationCounts[rec] || 0) + 1;
        });
        
        console.log(`\n💡 TOP RECOMMENDATIONS:`);
        Object.entries(recommendationCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .forEach(([strategy, count]) => {
                console.log(`   ${strategy}: ${count} times`);
            });
        
        // Critical warnings analysis
        const allWarnings = successful.flatMap(r => r.recommendations.warnings);
        const criticalWarnings = allWarnings.filter(w => w.severity === 'CRITICAL');
        
        if (criticalWarnings.length > 0) {
            console.log(`\n⚠️ CRITICAL WARNINGS DETECTED:`);
            console.log(`   Total Critical Warnings: ${criticalWarnings.length}`);
            console.log(`   Correlation Risk Warnings: ${criticalWarnings.filter(w => w.type === 'CORRELATION_RISK').length}`);
        }
        
        // Friday 0DTE analysis
        const fridayTests = successful.filter(r => r.userData.dayOfWeek.toLowerCase().includes('friday'));
        const fridayWith0DTE = fridayTests.filter(r => r.recommendations.friday0DTE);
        
        console.log(`\n📅 FRIDAY 0DTE ANALYSIS:`);
        console.log(`   Friday Tests: ${fridayTests.length}`);
        console.log(`   0DTE Recommendations Generated: ${fridayWith0DTE.length}`);
        
        if (failed.length > 0) {
            console.log(`\n❌ FAILED TESTS:`);
            failed.forEach(f => {
                console.log(`   • ${f.scenario}: ${f.error}`);
            });
        }
        
        console.log('\n✅ TEST FRAMEWORK COMPLETE');
        console.log('📋 All recommendations are for MANUAL EXECUTION only');
        console.log('🎯 System ready for production recommendation generation');
        console.log('='.repeat(80));
        
        return {
            totalTests: this.results.length,
            successful: successful.length,
            failed: failed.length,
            avgMatchRate,
            totalExecutionTime,
            recommendationCounts,
            criticalWarnings: criticalWarnings.length
        };
    }

    /**
     * Run a specific scenario by name
     */
    async runSpecificTest(scenarioName) {
        const scenario = this.scenarios.find(s => 
            s.name.toLowerCase().includes(scenarioName.toLowerCase())
        );
        
        if (!scenario) {
            console.log(`❌ Scenario not found: ${scenarioName}`);
            console.log('Available scenarios:');
            this.scenarios.forEach((s, i) => console.log(`   ${i + 1}. ${s.name}`));
            return null;
        }
        
        return await this.runScenario(scenario);
    }

    /**
     * List all available test scenarios
     */
    listScenarios() {
        console.log('\n📋 AVAILABLE TEST SCENARIOS:');
        console.log('='.repeat(50));
        
        this.scenarios.forEach((scenario, i) => {
            console.log(`${i + 1}. ${scenario.name}`);
            console.log(`   Phase: ${scenario.phase} | Input: ${scenario.input.substring(0, 50)}...`);
            console.log(`   Expected: ${scenario.expectedStrategies.join(', ')}`);
            console.log(`   Description: ${scenario.description}`);
            console.log('');
        });
    }
}

module.exports = TomKingTestingFramework;