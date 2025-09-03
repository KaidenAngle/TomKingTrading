/**
 * TastyTrade Backtesting Integration
 * Uses TastyTrade's server-side backtesting API
 * Implements Tom King strategies within API constraints
 */

const fetch = require('node-fetch');
const { getLogger } = require('./logger');
const logger = getLogger();

class TastyTradeBacktest {
    constructor(api) {
        this.api = api;
        this.baseURL = api.baseURL;
        this.sessionToken = null;
    }

    /**
     * Initialize backtesting session
     */
    async initialize() {
        try {
            // Get session token from API
            this.sessionToken = await this.api.tokenManager.getValidToken();
            logger.info('BACKTEST', 'Backtesting session initialized');
            return true;
        } catch (error) {
            logger.error('BACKTEST', 'Failed to initialize backtesting', error);
            throw error;
        }
    }

    /**
     * Get available symbols and date ranges for backtesting
     */
    async getAvailableParameters() {
        try {
            const response = await fetch(`${this.baseURL}/backtesting/parameters`, {
                headers: {
                    'Authorization': this.sessionToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get parameters: ${response.status}`);
            }

            const data = await response.json();
            return data.data?.items || [];
        } catch (error) {
            logger.error('BACKTEST', 'Failed to get available parameters', error);
            throw error;
        }
    }

    /**
     * Run Tom King Zero DTE Strategy Backtest
     * Note: API minimum is 2 DTE, so we use shortest available
     */
    async runZeroDTEBacktest(symbol = 'SPY', startDate, endDate) {
        const config = {
            symbol: symbol,
            entryConditions: {
                useExactDte: true,
                maximumActiveTrials: 1,  // Tom King: one position at a time
                frequency: 'every friday'  // Tom King trades Fridays
            },
            exitConditions: {
                takeProfitPercentage: 75,  // Take profit at 75%
                stopLossPercentage: 200,    // Stop at 2x loss
                atDaysToExpiration: 0       // Close at expiration
            },
            legs: [{
                daysUntilExpiration: 2,     // Minimum API allows (not true 0DTE)
                delta: 15,                  // Tom King uses 10-20 delta
                direction: 'short',
                quantity: 1,
                side: 'put'                 // Selling puts
            }],
            startDate: startDate || this.getDateMonthsAgo(6),
            endDate: endDate || this.getTodayDate()
        };

        return await this.runBacktest(config);
    }

    /**
     * Run Tom King Long-Term 1-1-2 Strategy Backtest
     */
    async runLongTerm112Backtest(symbol = 'SPY', startDate, endDate) {
        const config = {
            symbol: symbol,
            entryConditions: {
                useExactDte: true,
                maximumActiveTrials: 2,     // Can have 2 positions
                frequency: 'every month'     // Monthly entries
            },
            exitConditions: {
                takeProfitPercentage: 50,   // 50% profit target
                atDaysToExpiration: 21       // Manage at 21 DTE
            },
            legs: [
                {
                    daysUntilExpiration: 45,
                    delta: 50,               // ATM
                    direction: 'short',
                    quantity: 1,
                    side: 'put'
                },
                {
                    daysUntilExpiration: 45,
                    delta: 45,               // Slightly OTM
                    direction: 'long',
                    quantity: 1,
                    side: 'put'
                },
                {
                    daysUntilExpiration: 45,
                    delta: 40,               // More OTM
                    direction: 'long',
                    quantity: 2,
                    side: 'put'
                }
            ],
            startDate: startDate || this.getDateMonthsAgo(12),
            endDate: endDate || this.getTodayDate()
        };

        return await this.runBacktest(config);
    }

    /**
     * Run Tom King Strangle Strategy Backtest
     */
    async runStrangleBacktest(symbol = 'SPY', startDate, endDate) {
        const config = {
            symbol: symbol,
            entryConditions: {
                useExactDte: true,
                maximumActiveTrials: 3,     // Can have 3 strangles
                frequency: 'every week'
            },
            exitConditions: {
                takeProfitPercentage: 50,   // 50% profit target
                stopLossPercentage: 200,     // 2x stop loss
                atDaysToExpiration: 21       // Manage at 21 DTE
            },
            legs: [
                {
                    daysUntilExpiration: 45,
                    delta: 20,               // 16-20 delta
                    direction: 'short',
                    quantity: 1,
                    side: 'put'
                },
                {
                    daysUntilExpiration: 45,
                    delta: 20,               // 16-20 delta
                    direction: 'short',
                    quantity: 1,
                    side: 'call'
                }
            ],
            startDate: startDate || this.getDateMonthsAgo(12),
            endDate: endDate || this.getTodayDate()
        };

        return await this.runBacktest(config);
    }

    /**
     * Run generic backtest with configuration
     */
    async runBacktest(config) {
        try {
            logger.info('BACKTEST', `Starting backtest for ${config.symbol}`, {
                strategy: config.legs.length === 1 ? 'Single Leg' : 'Multi-Leg',
                startDate: config.startDate,
                endDate: config.endDate
            });

            // Submit backtest to TastyTrade servers
            const response = await fetch(`${this.baseURL}/backtesting`, {
                method: 'POST',
                headers: {
                    'Authorization': this.sessionToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error(`Backtest submission failed: ${response.status}`);
            }

            const data = await response.json();
            const backtestId = data.data?.id;

            if (!backtestId) {
                throw new Error('No backtest ID received');
            }

            logger.info('BACKTEST', `Backtest submitted with ID: ${backtestId}`);

            // Poll for results
            return await this.pollBacktestResults(backtestId);

        } catch (error) {
            logger.error('BACKTEST', 'Backtest failed', error);
            throw error;
        }
    }

    /**
     * Poll for backtest results
     */
    async pollBacktestResults(backtestId, maxAttempts = 60) {
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${this.baseURL}/backtesting/${backtestId}`, {
                    headers: {
                        'Authorization': this.sessionToken
                    }
                });

                if (!response.ok) {
                    throw new Error(`Failed to get results: ${response.status}`);
                }

                const data = await response.json();
                const backtest = data.data;

                // Check status
                if (backtest.status === 'completed') {
                    logger.info('BACKTEST', 'Backtest completed successfully');
                    return this.parseBacktestResults(backtest);
                } else if (backtest.status === 'failed') {
                    throw new Error('Backtest failed on server');
                }

                // Still processing
                if (backtest.progress) {
                    logger.debug('BACKTEST', `Progress: ${(backtest.progress * 100).toFixed(1)}%`);
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;

            } catch (error) {
                logger.error('BACKTEST', `Poll attempt ${attempts} failed`, error);
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        throw new Error('Backtest timed out after maximum attempts');
    }

    /**
     * Parse backtest results into useful format
     */
    parseBacktestResults(backtest) {
        const results = backtest.results;
        const statistics = results?.statistics || {};
        
        // Extract key metrics
        const parsed = {
            id: backtest.id,
            symbol: backtest.symbol,
            period: {
                start: backtest.startDate,
                end: backtest.endDate
            },
            performance: {
                totalPL: parseFloat(statistics['Total profit/loss'] || 0),
                winRate: parseFloat(statistics['Win percentage'] || 0),
                avgWin: parseFloat(statistics['Avg. profit/loss per trade'] || 0),
                maxDrawdown: parseFloat(statistics['Max drawdown'] || 0),
                totalTrades: statistics['Number of trades'] || 0,
                wins: statistics['Wins'] || 0,
                losses: statistics['Losses'] || 0
            },
            capitalMetrics: {
                returnOnCapital: parseFloat(statistics['Return on used capital'] || 0),
                avgBuyingPower: parseFloat(statistics['Avg. BPR per trade'] || 0),
                totalPremium: parseFloat(statistics['Total premium'] || 0),
                premiumCaptureRate: parseFloat(statistics['Premium capture rate'] || 0)
            },
            riskMetrics: {
                worstLoss: parseFloat(statistics['Worst loss'] || 0),
                highestProfit: parseFloat(statistics['Highest profit'] || 0),
                avgDaysInTrade: parseFloat(statistics['Avg. days in trade'] || 0)
            },
            trades: results?.trials || [],
            snapshots: results?.snapshots || []
        };

        // Calculate Tom King specific metrics
        parsed.tomKingMetrics = {
            meetsWinRateTarget: parsed.performance.winRate >= 88,  // Tom's 88% target
            avgMonthlyReturn: this.calculateMonthlyReturn(parsed),
            projectedAnnualReturn: this.calculateAnnualReturn(parsed),
            riskRewardRatio: Math.abs(parsed.performance.avgWin / parsed.riskMetrics.worstLoss)
        };

        logger.info('BACKTEST', 'Results parsed', {
            winRate: `${parsed.performance.winRate}%`,
            totalPL: `$${parsed.performance.totalPL}`,
            trades: parsed.performance.totalTrades
        });

        return parsed;
    }

    /**
     * Calculate monthly return from backtest
     */
    calculateMonthlyReturn(results) {
        const startDate = new Date(results.period.start);
        const endDate = new Date(results.period.end);
        const months = (endDate - startDate) / (1000 * 60 * 60 * 24 * 30);
        
        if (months <= 0) return 0;
        
        const totalReturn = results.capitalMetrics.returnOnCapital;
        return totalReturn / months;
    }

    /**
     * Calculate projected annual return
     */
    calculateAnnualReturn(results) {
        const monthlyReturn = this.calculateMonthlyReturn(results);
        return monthlyReturn * 12;
    }

    /**
     * Compare multiple strategy backtests
     */
    async compareStrategies(symbol = 'SPY') {
        logger.info('BACKTEST', `Running strategy comparison for ${symbol}`);
        
        const strategies = [
            { name: 'Zero DTE', fn: () => this.runZeroDTEBacktest(symbol) },
            { name: 'Long-Term 1-1-2', fn: () => this.runLongTerm112Backtest(symbol) },
            { name: 'Strangle', fn: () => this.runStrangleBacktest(symbol) }
        ];

        const results = {};

        for (const strategy of strategies) {
            try {
                logger.info('BACKTEST', `Testing ${strategy.name} strategy`);
                results[strategy.name] = await strategy.fn();
            } catch (error) {
                logger.error('BACKTEST', `${strategy.name} failed`, error);
                results[strategy.name] = { error: error.message };
            }
        }

        // Create comparison summary
        const comparison = {
            timestamp: new Date().toISOString(),
            symbol: symbol,
            strategies: results,
            winner: this.determineWinner(results)
        };

        return comparison;
    }

    /**
     * Determine best performing strategy
     */
    determineWinner(results) {
        let best = null;
        let bestScore = -Infinity;

        for (const [name, data] of Object.entries(results)) {
            if (data.error) continue;
            
            // Score based on Tom King priorities
            const score = 
                (data.performance.winRate * 2) +  // Weight win rate heavily
                (data.capitalMetrics.returnOnCapital) +
                (-data.riskMetrics.worstLoss / 100);  // Penalize large losses
            
            if (score > bestScore) {
                bestScore = score;
                best = name;
            }
        }

        return best;
    }

    /**
     * Helper: Get date N months ago
     */
    getDateMonthsAgo(months) {
        const date = new Date();
        date.setMonth(date.getMonth() - months);
        return date.toISOString().split('T')[0];
    }

    /**
     * Helper: Get today's date
     */
    getTodayDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Export backtest results to CSV
     */
    async exportToCSV(results, filename) {
        const csv = this.convertToCSV(results);
        const fs = require('fs').promises;
        const filepath = `./backtest_results/${filename}_${Date.now()}.csv`;
        
        await fs.mkdir('./backtest_results', { recursive: true });
        await fs.writeFile(filepath, csv);
        
        logger.info('BACKTEST', `Results exported to ${filepath}`);
        return filepath;
    }

    /**
     * Convert results to CSV format
     */
    convertToCSV(results) {
        const headers = [
            'Strategy', 'Symbol', 'Start Date', 'End Date',
            'Total P/L', 'Win Rate', 'Total Trades', 'Wins', 'Losses',
            'Avg Win', 'Worst Loss', 'Max Drawdown', 'Return on Capital'
        ];

        const rows = [];
        
        if (results.strategies) {
            // Multiple strategy comparison
            for (const [name, data] of Object.entries(results.strategies)) {
                if (data.error) continue;
                rows.push([
                    name,
                    data.symbol,
                    data.period.start,
                    data.period.end,
                    data.performance.totalPL,
                    data.performance.winRate,
                    data.performance.totalTrades,
                    data.performance.wins,
                    data.performance.losses,
                    data.performance.avgWin,
                    data.riskMetrics.worstLoss,
                    data.performance.maxDrawdown,
                    data.capitalMetrics.returnOnCapital
                ]);
            }
        } else {
            // Single backtest result
            rows.push([
                'Single Test',
                results.symbol,
                results.period.start,
                results.period.end,
                results.performance.totalPL,
                results.performance.winRate,
                results.performance.totalTrades,
                results.performance.wins,
                results.performance.losses,
                results.performance.avgWin,
                results.riskMetrics.worstLoss,
                results.performance.maxDrawdown,
                results.capitalMetrics.returnOnCapital
            ]);
        }

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}

module.exports = TastyTradeBacktest;