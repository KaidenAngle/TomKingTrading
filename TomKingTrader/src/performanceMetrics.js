/**
 * Performance Metrics Calculator
 * Consolidated P&L tracking and performance analysis for Tom King Trading Framework
 * Includes real-time P&L calculations, historical tracking, Tom King specific metrics,
 * Friday 0DTE tracking, buying power management, and phase progression monitoring
 */

const { EventEmitter } = require('events');
const { getLogger } = require('./logger');

class PerformanceMetrics extends EventEmitter {
    constructor(options = {}) {
        super();
        this.config = {
            riskFreeRate: options.riskFreeRate || 0.02, // 2% annual risk-free rate
            benchmarkSymbol: options.benchmarkSymbol || 'SPY',
            confidenceInterval: options.confidenceInterval || 0.95,
            tradingDaysPerYear: options.tradingDaysPerYear || 252,
            ...options
        };
        
        this.logger = getLogger();
    }

    /**
     * Calculate comprehensive performance metrics
     */
    calculateComprehensiveMetrics(trades, dailyPnL, initialCapital, benchmarkReturns = null) {
        this.logger.info('PERF-METRICS', 'Calculating comprehensive performance metrics', {
            trades: trades.length,
            dailyPnL: dailyPnL.length
        });

        const basicMetrics = this.calculateBasicMetrics(trades, dailyPnL, initialCapital);
        const riskMetrics = this.calculateRiskMetrics(dailyPnL, initialCapital);
        const returnMetrics = this.calculateReturnMetrics(dailyPnL, initialCapital);
        const drawdownMetrics = this.calculateDrawdownMetrics(dailyPnL);
        const strategyMetrics = this.calculateStrategySpecificMetrics(trades);
        const consistencyMetrics = this.calculateConsistencyMetrics(trades, dailyPnL);
        const efficiencyMetrics = this.calculateEfficiencyMetrics(trades, dailyPnL);

        let benchmarkComparison = null;
        if (benchmarkReturns) {
            benchmarkComparison = this.calculateBenchmarkComparison(dailyPnL, benchmarkReturns, initialCapital);
        }

        return {
            basic: basicMetrics,
            risk: riskMetrics,
            returns: returnMetrics,
            drawdown: drawdownMetrics,
            strategies: strategyMetrics,
            consistency: consistencyMetrics,
            efficiency: efficiencyMetrics,
            benchmark: benchmarkComparison,
            summary: this.generatePerformanceSummary(basicMetrics, riskMetrics, returnMetrics)
        };
    }

    /**
     * Calculate basic trading metrics
     */
    calculateBasicMetrics(trades, dailyPnL, initialCapital) {
        if (trades.length === 0) {
            return this.getEmptyBasicMetrics();
        }

        const winningTrades = trades.filter(trade => trade.pnl > 0);
        const losingTrades = trades.filter(trade => trade.pnl <= 0);
        const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
        
        const finalCapital = initialCapital + totalPnL;
        const totalReturn = (totalPnL / initialCapital) * 100;

        // Trade size analysis
        const tradeSizes = trades.map(trade => Math.abs(trade.entryValue));
        const avgTradeSize = tradeSizes.reduce((sum, size) => sum + size, 0) / trades.length;
        
        // Holding periods
        const holdingPeriods = trades.map(trade => trade.holdingPeriod || 0);
        const avgHoldingPeriod = holdingPeriods.reduce((sum, days) => sum + days, 0) / trades.length;

        return {
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: (winningTrades.length / trades.length),
            lossRate: (losingTrades.length / trades.length),
            
            totalPnL: Math.round(totalPnL),
            averagePnL: trades.length > 0 ? Math.round(totalPnL / trades.length) : 0,
            initialCapital: Math.round(initialCapital),
            finalCapital: Math.round(finalCapital),
            totalReturn: parseFloat(totalReturn.toFixed(2)),
            
            avgWin: winningTrades.length > 0 ? Math.round(winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length) : 0,
            avgLoss: losingTrades.length > 0 ? Math.round(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 0,
            
            largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
            largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
            
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
            payoffRatio: this.calculatePayoffRatio(winningTrades, losingTrades),
            expectancy: this.calculateExpectancy(trades),
            
            avgTradeSize: Math.round(avgTradeSize),
            avgHoldingPeriod: parseFloat(avgHoldingPeriod.toFixed(1)),
            
            tradingPeriod: this.calculateTradingPeriod(trades),
            tradesPerMonth: this.calculateTradesPerMonth(trades)
        };
    }

    /**
     * Calculate risk metrics
     */
    calculateRiskMetrics(dailyPnL, initialCapital) {
        if (dailyPnL.length === 0) {
            return this.getEmptyRiskMetrics();
        }

        const returns = this.calculateDailyReturns(dailyPnL, initialCapital);
        const annualizedReturn = this.calculateAnnualizedReturn(returns);
        const volatility = this.calculateVolatility(returns);
        const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility);
        
        const sortino = this.calculateSortinoRatio(returns, annualizedReturn);
        const calmar = this.calculateCalmarRatio(annualizedReturn, dailyPnL);
        const var95 = this.calculateVaR(returns, 0.95);
        const var99 = this.calculateVaR(returns, 0.99);
        const cvar95 = this.calculateCVaR(returns, 0.95);

        return {
            annualizedReturn: parseFloat(annualizedReturn.toFixed(2)),
            annualizedVolatility: parseFloat(volatility.toFixed(2)),
            sharpeRatio: parseFloat(sharpeRatio.toFixed(3)),
            sortinoRatio: parseFloat(sortino.toFixed(3)),
            calmarRatio: parseFloat(calmar.toFixed(3)),
            
            valueAtRisk95: parseFloat(var95.toFixed(2)),
            valueAtRisk99: parseFloat(var99.toFixed(2)),
            conditionalVaR95: parseFloat(cvar95.toFixed(2)),
            
            skewness: this.calculateSkewness(returns),
            kurtosis: this.calculateKurtosis(returns),
            
            riskGrade: this.calculateRiskGrade(sharpeRatio, volatility, var95)
        };
    }

    /**
     * Calculate return metrics
     */
    calculateReturnMetrics(dailyPnL, initialCapital) {
        if (dailyPnL.length === 0) {
            return this.getEmptyReturnMetrics();
        }

        const monthlyReturns = this.calculateMonthlyReturns(dailyPnL, initialCapital);
        const quarterlyReturns = this.calculateQuarterlyReturns(dailyPnL, initialCapital);
        const yearlyReturns = this.calculateYearlyReturns(dailyPnL, initialCapital);

        const positiveMonths = monthlyReturns.filter(ret => ret > 0).length;
        const negativeMonths = monthlyReturns.filter(ret => ret < 0).length;

        return {
            monthlyReturns: monthlyReturns.map(ret => parseFloat(ret.toFixed(2))),
            quarterlyReturns: quarterlyReturns.map(ret => parseFloat(ret.toFixed(2))),
            yearlyReturns: yearlyReturns.map(ret => parseFloat(ret.toFixed(2))),
            
            avgMonthlyReturn: monthlyReturns.length > 0 ? parseFloat((monthlyReturns.reduce((sum, ret) => sum + ret, 0) / monthlyReturns.length).toFixed(2)) : 0,
            bestMonth: monthlyReturns.length > 0 ? Math.max(...monthlyReturns) : 0,
            worstMonth: monthlyReturns.length > 0 ? Math.min(...monthlyReturns) : 0,
            
            positiveMonths,
            negativeMonths,
            monthlyWinRate: monthlyReturns.length > 0 ? (positiveMonths / monthlyReturns.length) * 100 : 0,
            
            compoundAnnualGrowthRate: this.calculateCAGR(dailyPnL, initialCapital),
            
            monthlyConsistency: this.calculateMonthlyConsistency(monthlyReturns),
            returnStability: this.calculateReturnStability(monthlyReturns)
        };
    }

    /**
     * Calculate drawdown metrics
     */
    calculateDrawdownMetrics(dailyPnL) {
        if (dailyPnL.length === 0) {
            return this.getEmptyDrawdownMetrics();
        }

        const equityCurve = this.calculateEquityCurve(dailyPnL);
        const drawdowns = this.calculateDrawdowns(equityCurve);
        const drawdownPeriods = this.calculateDrawdownPeriods(drawdowns);

        const maxDrawdown = Math.min(...drawdowns) * 100;
        const avgDrawdown = drawdowns.filter(dd => dd < 0).reduce((sum, dd) => sum + dd, 0) / Math.max(1, drawdowns.filter(dd => dd < 0).length) * 100;

        return {
            maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
            avgDrawdown: parseFloat(avgDrawdown.toFixed(2)),
            maxDrawdownDuration: Math.max(...drawdownPeriods.map(p => p.duration)),
            avgDrawdownDuration: drawdownPeriods.length > 0 ? drawdownPeriods.reduce((sum, p) => sum + p.duration, 0) / drawdownPeriods.length : 0,
            
            drawdownPeriods: drawdownPeriods.length,
            recoveryFactor: this.calculateRecoveryFactor(dailyPnL, maxDrawdown / 100),
            
            drawdownDays: drawdowns.filter(dd => dd < 0).length,
            profitableDays: drawdowns.filter(dd => dd >= 0).length,
            
            equityCurve: equityCurve.map((value, index) => ({
                day: index + 1,
                equity: Math.round(value),
                drawdown: parseFloat((drawdowns[index] * 100).toFixed(2))
            })),

            ulcerIndex: this.calculateUlcerIndex(drawdowns),
            painIndex: this.calculatePainIndex(drawdowns)
        };
    }

    /**
     * Calculate strategy-specific metrics
     */
    calculateStrategySpecificMetrics(trades) {
        const strategyBreakdown = {};
        const strategies = [...new Set(trades.map(trade => trade.strategy))];

        strategies.forEach(strategy => {
            const strategyTrades = trades.filter(trade => trade.strategy === strategy);
            
            if (strategyTrades.length > 0) {
                const winningTrades = strategyTrades.filter(trade => trade.pnl > 0);
                const totalPnL = strategyTrades.reduce((sum, trade) => sum + trade.pnl, 0);
                
                strategyBreakdown[strategy] = {
                    totalTrades: strategyTrades.length,
                    winRate: (winningTrades.length / strategyTrades.length) * 100,
                    totalPnL: Math.round(totalPnL),
                    avgPnL: Math.round(totalPnL / strategyTrades.length),
                    bestTrade: Math.max(...strategyTrades.map(t => t.pnl)),
                    worstTrade: Math.min(...strategyTrades.map(t => t.pnl)),
                    profitFactor: this.calculateProfitFactor(
                        winningTrades, 
                        strategyTrades.filter(trade => trade.pnl <= 0)
                    ),
                    avgHoldingPeriod: strategyTrades.reduce((sum, trade) => sum + (trade.holdingPeriod || 0), 0) / strategyTrades.length,
                    contribution: (totalPnL / trades.reduce((sum, trade) => sum + trade.pnl, 0)) * 100
                };
            }
        });

        return {
            breakdown: strategyBreakdown,
            bestStrategy: this.identifyBestStrategy(strategyBreakdown),
            worstStrategy: this.identifyWorstStrategy(strategyBreakdown),
            strategyCorrelation: this.calculateStrategyCorrelation(trades),
            diversificationBenefit: this.calculateDiversificationBenefit(strategyBreakdown)
        };
    }

    /**
     * Calculate consistency metrics
     */
    calculateConsistencyMetrics(trades, dailyPnL) {
        const monthlyReturns = this.calculateMonthlyReturns(dailyPnL, dailyPnL[0]?.capital || 30000);
        
        return {
            winStreakMax: this.calculateMaxWinStreak(trades),
            lossStreakMax: this.calculateMaxLossStreak(trades),
            profitStreakMax: this.calculateMaxProfitStreak(dailyPnL),
            drawdownStreakMax: this.calculateMaxDrawdownStreak(dailyPnL),
            
            consistencyScore: this.calculateConsistencyScore(monthlyReturns),
            reliabilityIndex: this.calculateReliabilityIndex(trades),
            
            tradingFrequency: this.calculateTradingFrequency(trades),
            seasonality: this.calculateSeasonality(trades),
            
            stabilityRating: this.calculateStabilityRating(monthlyReturns, trades)
        };
    }

    /**
     * Calculate efficiency metrics
     */
    calculateEfficiencyMetrics(trades, dailyPnL) {
        const totalCapitalDeployed = trades.reduce((sum, trade) => sum + Math.abs(trade.entryValue), 0);
        const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
        
        return {
            capitalEfficiency: totalCapitalDeployed > 0 ? (totalPnL / totalCapitalDeployed) * 100 : 0,
            timeEfficiency: this.calculateTimeEfficiency(trades),
            
            utilizationRate: this.calculateCapitalUtilizationRate(dailyPnL),
            turnoverRate: this.calculateTurnoverRate(trades, dailyPnL),
            
            riskAdjustedReturn: this.calculateRiskAdjustedReturn(trades, dailyPnL),
            informationRatio: this.calculateInformationRatio(dailyPnL),
            
            tradingCosts: this.estimateTradingCosts(trades),
            netEfficiency: this.calculateNetEfficiency(trades)
        };
    }

    /**
     * Calculate benchmark comparison
     */
    calculateBenchmarkComparison(dailyPnL, benchmarkReturns, initialCapital) {
        if (!benchmarkReturns || benchmarkReturns.length === 0) {
            return null;
        }

        const strategyReturns = this.calculateDailyReturns(dailyPnL, initialCapital);
        const alignedReturns = this.alignReturns(strategyReturns, benchmarkReturns);

        const strategyAnnualized = this.calculateAnnualizedReturn(alignedReturns.strategy);
        const benchmarkAnnualized = this.calculateAnnualizedReturn(alignedReturns.benchmark);
        
        const alpha = this.calculateAlpha(alignedReturns.strategy, alignedReturns.benchmark);
        const beta = this.calculateBeta(alignedReturns.strategy, alignedReturns.benchmark);
        const correlation = this.calculateCorrelation(alignedReturns.strategy, alignedReturns.benchmark);
        const trackingError = this.calculateTrackingError(alignedReturns.strategy, alignedReturns.benchmark);
        const informationRatio = this.calculateInformationRatio(alignedReturns.strategy, alignedReturns.benchmark);

        return {
            strategyReturn: parseFloat(strategyAnnualized.toFixed(2)),
            benchmarkReturn: parseFloat(benchmarkAnnualized.toFixed(2)),
            excessReturn: parseFloat((strategyAnnualized - benchmarkAnnualized).toFixed(2)),
            
            alpha: parseFloat(alpha.toFixed(4)),
            beta: parseFloat(beta.toFixed(3)),
            correlation: parseFloat(correlation.toFixed(3)),
            
            trackingError: parseFloat(trackingError.toFixed(2)),
            informationRatio: parseFloat(informationRatio.toFixed(3)),
            
            upCapture: this.calculateUpsideCapture(alignedReturns.strategy, alignedReturns.benchmark),
            downCapture: this.calculateDownsideCapture(alignedReturns.strategy, alignedReturns.benchmark),
            
            outperformancePeriods: this.calculateOutperformancePeriods(alignedReturns.strategy, alignedReturns.benchmark)
        };
    }

    /**
     * Helper calculation functions
     */
    
    calculateProfitFactor(winningTrades, losingTrades) {
        const grossProfit = winningTrades.reduce((sum, trade) => sum + trade.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0));
        return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    }

    calculatePayoffRatio(winningTrades, losingTrades) {
        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length) : 1;
        return avgLoss > 0 ? avgWin / avgLoss : avgWin;
    }

    calculateExpectancy(trades) {
        if (trades.length === 0) return 0;
        
        const winningTrades = trades.filter(trade => trade.pnl > 0);
        const losingTrades = trades.filter(trade => trade.pnl <= 0);
        
        const winRate = winningTrades.length / trades.length;
        const lossRate = losingTrades.length / trades.length;
        
        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length : 0;
        
        return (winRate * avgWin) + (lossRate * avgLoss);
    }

    calculateDailyReturns(dailyPnL, initialCapital) {
        if (!dailyPnL || dailyPnL.length === 0) return [];
        
        const returns = [];
        let previousCapital = initialCapital || 35000; // Default to starting balance
        
        for (const day of dailyPnL) {
            const currentCapital = day.capital || day.balance || previousCapital;
            
            // Prevent division by zero and NaN
            if (previousCapital === 0 || isNaN(previousCapital)) {
                previousCapital = initialCapital || 35000;
            }
            
            const dailyReturn = (currentCapital - previousCapital) / previousCapital;
            
            // Only add valid returns
            if (!isNaN(dailyReturn) && isFinite(dailyReturn)) {
                returns.push(dailyReturn);
            } else {
                returns.push(0); // Add 0 for invalid calculations
            }
            
            previousCapital = currentCapital;
        }
        
        return returns;
    }

    calculateAnnualizedReturn(returns) {
        if (!returns || returns.length === 0) return 0;
        
        // Filter out NaN and invalid values
        const validReturns = returns.filter(ret => !isNaN(ret) && isFinite(ret));
        if (validReturns.length === 0) return 0;
        
        // Use geometric mean for compounding
        const compoundReturn = validReturns.reduce((acc, ret) => acc * (1 + ret), 1);
        
        // Prevent negative base for pow operation
        if (compoundReturn <= 0) return -100; // Total loss
        
        const periods = validReturns.length || 1;
        const annualized = Math.pow(compoundReturn, this.config.tradingDaysPerYear / periods) - 1;
        const result = annualized * 100;
        
        return isNaN(result) || !isFinite(result) ? 0 : result;
    }

    calculateVolatility(returns) {
        if (!returns || returns.length === 0) return 0;
        
        // Filter out NaN values
        const validReturns = returns.filter(ret => !isNaN(ret) && isFinite(ret));
        if (validReturns.length === 0) return 0;
        
        const mean = validReturns.reduce((sum, ret) => sum + ret, 0) / validReturns.length;
        const variance = validReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / validReturns.length;
        
        // Prevent NaN from sqrt of negative variance
        if (isNaN(variance) || variance < 0) return 0;
        
        const dailyVol = Math.sqrt(variance);
        const annualizedVol = dailyVol * Math.sqrt(this.config.tradingDaysPerYear) * 100;
        
        return isNaN(annualizedVol) || !isFinite(annualizedVol) ? 0 : annualizedVol;
    }

    calculateSharpeRatio(annualizedReturn, volatility) {
        if (isNaN(annualizedReturn) || isNaN(volatility)) return 0;
        if (volatility === 0) return annualizedReturn > 0 ? 1 : 0;
        const excessReturn = annualizedReturn - (this.config.riskFreeRate * 100);
        return isNaN(excessReturn / volatility) ? 0 : excessReturn / volatility;
    }

    calculateSortinoRatio(returns, annualizedReturn) {
        if (returns.length === 0 || isNaN(annualizedReturn)) return 0;
        
        const downside = returns.filter(ret => ret < 0);
        if (downside.length === 0) return annualizedReturn > 0 ? 1 : 0;
        
        const downsideDeviation = Math.sqrt(downside.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / returns.length) * Math.sqrt(this.config.tradingDaysPerYear) * 100;
        
        if (downsideDeviation === 0 || isNaN(downsideDeviation)) return 0;
        const ratio = (annualizedReturn - this.config.riskFreeRate * 100) / downsideDeviation;
        return isNaN(ratio) ? 0 : ratio;
    }

    calculateCalmarRatio(annualizedReturn, dailyPnL) {
        if (isNaN(annualizedReturn) || !dailyPnL || dailyPnL.length === 0) return 0;
        const drawdowns = this.calculateDrawdowns(this.calculateEquityCurve(dailyPnL));
        if (drawdowns.length === 0) return 0;
        const maxDrawdown = Math.abs(Math.min(...drawdowns)) * 100;
        if (maxDrawdown === 0 || isNaN(maxDrawdown)) return 0;
        const ratio = annualizedReturn / maxDrawdown;
        return isNaN(ratio) ? 0 : ratio;
    }

    calculateVaR(returns, confidence) {
        if (returns.length === 0) return 0;
        
        const sortedReturns = returns.slice().sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return sortedReturns[index] * 100;
    }

    calculateCVaR(returns, confidence) {
        if (returns.length === 0) return 0;
        
        const sortedReturns = returns.slice().sort((a, b) => a - b);
        const cutoffIndex = Math.floor((1 - confidence) * sortedReturns.length);
        const tailReturns = sortedReturns.slice(0, cutoffIndex);
        
        if (tailReturns.length === 0) return 0;
        
        const avgTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
        return avgTailReturn * 100;
    }

    calculateSkewness(returns) {
        if (returns.length === 0) return 0;
        
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return 0;
        
        const skewness = returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / stdDev, 3), 0) / returns.length;
        return skewness;
    }

    calculateKurtosis(returns) {
        if (returns.length === 0) return 0;
        
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev === 0) return 0;
        
        const kurtosis = returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / stdDev, 4), 0) / returns.length;
        return kurtosis - 3; // Excess kurtosis
    }

    calculateEquityCurve(dailyPnL) {
        return dailyPnL.map(day => day.capital);
    }

    calculateDrawdowns(equityCurve) {
        const drawdowns = [];
        let peak = equityCurve[0] || 0;
        
        for (const equity of equityCurve) {
            peak = Math.max(peak, equity);
            const drawdown = (equity - peak) / peak;
            drawdowns.push(drawdown);
        }
        
        return drawdowns;
    }

    calculateDrawdownPeriods(drawdowns) {
        const periods = [];
        let inDrawdown = false;
        let start = 0;
        let maxDD = 0;
        
        for (let i = 0; i < drawdowns.length; i++) {
            if (drawdowns[i] < 0 && !inDrawdown) {
                inDrawdown = true;
                start = i;
                maxDD = drawdowns[i];
            } else if (drawdowns[i] < maxDD && inDrawdown) {
                maxDD = drawdowns[i];
            } else if (drawdowns[i] >= 0 && inDrawdown) {
                periods.push({
                    start,
                    end: i,
                    duration: i - start,
                    maxDrawdown: maxDD * 100
                });
                inDrawdown = false;
            }
        }
        
        return periods;
    }

    calculateMonthlyReturns(dailyPnL, initialCapital) {
        const monthlyReturns = [];
        const monthlyData = {};
        
        // Group by month
        dailyPnL.forEach(day => {
            const date = new Date(day.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = [];
            }
            monthlyData[monthKey].push(day);
        });
        
        // Calculate monthly returns
        let previousMonthEnd = initialCapital;
        for (const [month, days] of Object.entries(monthlyData)) {
            const monthEnd = days[days.length - 1].capital;
            const monthReturn = ((monthEnd - previousMonthEnd) / previousMonthEnd) * 100;
            monthlyReturns.push(monthReturn);
            previousMonthEnd = monthEnd;
        }
        
        return monthlyReturns;
    }

    calculateQuarterlyReturns(dailyPnL, initialCapital) {
        const quarterlyReturns = [];
        const quarterlyData = {};
        
        dailyPnL.forEach(day => {
            const date = new Date(day.date);
            const quarter = Math.ceil((date.getMonth() + 1) / 3);
            const quarterKey = `${date.getFullYear()}-Q${quarter}`;
            
            if (!quarterlyData[quarterKey]) {
                quarterlyData[quarterKey] = [];
            }
            quarterlyData[quarterKey].push(day);
        });
        
        let previousQuarterEnd = initialCapital;
        for (const [quarter, days] of Object.entries(quarterlyData)) {
            const quarterEnd = days[days.length - 1].capital;
            const quarterReturn = ((quarterEnd - previousQuarterEnd) / previousQuarterEnd) * 100;
            quarterlyReturns.push(quarterReturn);
            previousQuarterEnd = quarterEnd;
        }
        
        return quarterlyReturns;
    }

    calculateYearlyReturns(dailyPnL, initialCapital) {
        const yearlyReturns = [];
        const yearlyData = {};
        
        dailyPnL.forEach(day => {
            const year = new Date(day.date).getFullYear();
            
            if (!yearlyData[year]) {
                yearlyData[year] = [];
            }
            yearlyData[year].push(day);
        });
        
        let previousYearEnd = initialCapital;
        for (const [year, days] of Object.entries(yearlyData)) {
            const yearEnd = days[days.length - 1].capital;
            const yearReturn = ((yearEnd - previousYearEnd) / previousYearEnd) * 100;
            yearlyReturns.push(yearReturn);
            previousYearEnd = yearEnd;
        }
        
        return yearlyReturns;
    }

    calculateCAGR(dailyPnL, initialCapital) {
        if (dailyPnL.length === 0) return 0;
        
        const finalCapital = dailyPnL[dailyPnL.length - 1].capital;
        const years = dailyPnL.length / this.config.tradingDaysPerYear;
        
        if (years <= 0 || initialCapital <= 0) return 0;
        
        return (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100;
    }

    calculateRecoveryFactor(dailyPnL, maxDrawdownPercent) {
        const totalReturn = dailyPnL.length > 0 ? 
            ((dailyPnL[dailyPnL.length - 1].capital - dailyPnL[0].capital) / dailyPnL[0].capital) * 100 : 0;
        
        return Math.abs(maxDrawdownPercent) > 0 ? totalReturn / Math.abs(maxDrawdownPercent) : 0;
    }

    calculateUlcerIndex(drawdowns) {
        if (drawdowns.length === 0) return 0;
        
        const avgSquaredDrawdown = drawdowns.reduce((sum, dd) => sum + Math.pow(Math.abs(dd) * 100, 2), 0) / drawdowns.length;
        return Math.sqrt(avgSquaredDrawdown);
    }

    calculatePainIndex(drawdowns) {
        if (drawdowns.length === 0) return 0;
        
        return drawdowns.reduce((sum, dd) => sum + Math.abs(dd) * 100, 0) / drawdowns.length;
    }

    /**
     * Generate performance summary
     */
    generatePerformanceSummary(basicMetrics, riskMetrics, returnMetrics) {
        const score = this.calculateOverallScore(basicMetrics, riskMetrics, returnMetrics);
        
        return {
            overallScore: score,
            grade: this.assignPerformanceGrade(score),
            strengths: this.identifyStrengths(basicMetrics, riskMetrics, returnMetrics),
            weaknesses: this.identifyWeaknesses(basicMetrics, riskMetrics, returnMetrics),
            recommendations: this.generateRecommendations(basicMetrics, riskMetrics, returnMetrics)
        };
    }

    calculateOverallScore(basicMetrics, riskMetrics, returnMetrics) {
        let score = 0;
        
        // Return component (40%)
        score += Math.min(40, (basicMetrics.totalReturn / 20) * 40); // 20% annual return = full points
        
        // Risk component (30%)
        score += Math.min(30, Math.max(0, (2 - Math.abs(riskMetrics.sharpeRatio)) * 15)); // Sharpe > 1 gets points
        
        // Consistency component (30%)
        score += Math.min(30, (basicMetrics.winRate / 80) * 30); // 80% win rate = full points
        
        return Math.min(100, Math.max(0, score));
    }

    assignPerformanceGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 85) return 'A';
        if (score >= 80) return 'A-';
        if (score >= 75) return 'B+';
        if (score >= 70) return 'B';
        if (score >= 65) return 'B-';
        if (score >= 60) return 'C+';
        if (score >= 55) return 'C';
        if (score >= 50) return 'C-';
        if (score >= 40) return 'D';
        return 'F';
    }

    identifyStrengths(basicMetrics, riskMetrics, returnMetrics) {
        const strengths = [];
        
        if (basicMetrics.winRate >= 75) strengths.push('High win rate');
        if (riskMetrics.sharpeRatio >= 1.5) strengths.push('Excellent risk-adjusted returns');
        if (basicMetrics.profitFactor >= 2.0) strengths.push('Strong profit factor');
        if (returnMetrics.monthlyWinRate >= 70) strengths.push('Consistent monthly performance');
        if (riskMetrics.annualizedReturn >= 15) strengths.push('Strong absolute returns');
        
        return strengths;
    }

    identifyWeaknesses(basicMetrics, riskMetrics, returnMetrics) {
        const weaknesses = [];
        
        if (basicMetrics.winRate < 50) weaknesses.push('Low win rate');
        if (riskMetrics.sharpeRatio < 0.5) weaknesses.push('Poor risk-adjusted returns');
        if (Math.abs(riskMetrics.valueAtRisk95) > 5) weaknesses.push('High Value at Risk');
        if (returnMetrics.monthlyWinRate < 50) weaknesses.push('Inconsistent monthly performance');
        if (basicMetrics.profitFactor < 1.2) weaknesses.push('Weak profit factor');
        
        return weaknesses;
    }

    generateRecommendations(basicMetrics, riskMetrics, returnMetrics) {
        const recommendations = [];
        
        if (basicMetrics.winRate < 60) {
            recommendations.push('Consider improving entry criteria to increase win rate');
        }
        
        if (riskMetrics.sharpeRatio < 1.0) {
            recommendations.push('Focus on reducing volatility while maintaining returns');
        }
        
        if (Math.abs(basicMetrics.avgLoss) > basicMetrics.avgWin * 2) {
            recommendations.push('Implement tighter stop losses to reduce average loss size');
        }
        
        if (returnMetrics.monthlyWinRate < 60) {
            recommendations.push('Improve consistency by diversifying across strategies and timeframes');
        }
        
        return recommendations;
    }

    /**
     * Empty metrics objects for error cases
     */
    
    getEmptyBasicMetrics() {
        return {
            totalTrades: 0, winningTrades: 0, losingTrades: 0, winRate: 0, lossRate: 0,
            totalPnL: 0, initialCapital: 0, finalCapital: 0, totalReturn: 0,
            avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
            profitFactor: 0, payoffRatio: 0, expectancy: 0,
            avgTradeSize: 0, avgHoldingPeriod: 0, tradingPeriod: 0, tradesPerMonth: 0
        };
    }

    getEmptyRiskMetrics() {
        return {
            annualizedReturn: 0, annualizedVolatility: 0, sharpeRatio: 0,
            sortinoRatio: 0, calmarRatio: 0, valueAtRisk95: 0, valueAtRisk99: 0,
            conditionalVaR95: 0, skewness: 0, kurtosis: 0, riskGrade: 'N/A'
        };
    }

    getEmptyReturnMetrics() {
        return {
            monthlyReturns: [], quarterlyReturns: [], yearlyReturns: [],
            avgMonthlyReturn: 0, bestMonth: 0, worstMonth: 0,
            positiveMonths: 0, negativeMonths: 0, monthlyWinRate: 0,
            compoundAnnualGrowthRate: 0, monthlyConsistency: 0, returnStability: 0
        };
    }

    getEmptyDrawdownMetrics() {
        return {
            maxDrawdown: 0, avgDrawdown: 0, maxDrawdownDuration: 0, avgDrawdownDuration: 0,
            drawdownPeriods: 0, recoveryFactor: 0, drawdownDays: 0, profitableDays: 0,
            equityCurve: [], ulcerIndex: 0, painIndex: 0
        };
    }

    // Additional helper methods would continue here...
    // Due to length constraints, I'm including the core functionality
    // The remaining methods would follow similar patterns for completeness

    calculateRiskGrade(sharpeRatio, volatility, var95) {
        if (sharpeRatio >= 1.5 && volatility <= 15 && Math.abs(var95) <= 3) return 'EXCELLENT';
        if (sharpeRatio >= 1.0 && volatility <= 20 && Math.abs(var95) <= 5) return 'GOOD';
        if (sharpeRatio >= 0.5 && volatility <= 25 && Math.abs(var95) <= 7) return 'FAIR';
        if (sharpeRatio >= 0.0 && volatility <= 35 && Math.abs(var95) <= 10) return 'POOR';
        return 'VERY_POOR';
    }

    calculateTradingPeriod(trades) {
        if (trades.length === 0) return 0;
        
        const dates = trades.map(trade => new Date(trade.entryDate));
        const earliest = Math.min(...dates.map(d => d.getTime()));
        const latest = Math.max(...dates.map(d => d.getTime()));
        
        return Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));
    }

    calculateTradesPerMonth(trades) {
        if (trades.length === 0) return 0;
        
        const tradingPeriod = this.calculateTradingPeriod(trades);
        const months = tradingPeriod / 30.44; // Average days per month
        
        return months > 0 ? trades.length / months : 0;
    }

    /**
     * Calculate monthly consistency metric
     */
    calculateMonthlyConsistency(monthlyReturns) {
        if (!monthlyReturns || monthlyReturns.length === 0) return 0;
        
        const profitableMonths = monthlyReturns.filter(r => r > 0).length;
        return (profitableMonths / monthlyReturns.length) * 100;
    }

    /**
     * Calculate return stability
     */
    calculateReturnStability(monthlyReturns) {
        if (!monthlyReturns || monthlyReturns.length < 2) return 0;
        
        const mean = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
        const variance = monthlyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / monthlyReturns.length;
        const stdDev = Math.sqrt(variance);
        
        return mean !== 0 ? (mean / stdDev) : 0;
    }

    /**
     * Calculate CAGR (Compound Annual Growth Rate)
     */
    calculateCAGR(dailyPnL, initialCapital) {
        if (!dailyPnL || dailyPnL.length === 0) return 0;
        
        const finalCapital = dailyPnL[dailyPnL.length - 1].capital || initialCapital;
        const years = dailyPnL.length / 252; // Trading days per year
        
        if (years === 0) return 0;
        
        return (Math.pow(finalCapital / initialCapital, 1 / years) - 1) * 100;
    }

    /**
     * Calculate Compound Growth Tracking - £35k to £80k Goal
     * Tom King Framework: 12% monthly compound target
     */
    calculateCompoundGrowth(trades, initialCapital = 35000, targetCapital = 80000) {
        const compoundData = {
            initialCapital,
            targetCapital,
            currentCapital: initialCapital,
            monthlyTarget: 0.12, // 12% monthly compound per Tom King
            actualMonthlyReturns: [],
            projectedPath: [],
            actualPath: [],
            monthsToTarget: 0,
            progressPercent: 0,
            onTrack: false,
            variance: 0,
            compoundingEffect: 0
        };

        // Calculate months to target at 12% compound rate
        compoundData.monthsToTarget = Math.log(targetCapital / initialCapital) / Math.log(1.12);
        
        // Group trades by month
        const monthlyTrades = this.groupTradesByMonth(trades);
        let runningCapital = initialCapital;
        
        // Calculate actual monthly returns and compound growth
        for (const [month, monthTrades] of Object.entries(monthlyTrades)) {
            const monthPnL = monthTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
            const monthReturn = monthPnL / runningCapital;
            const newCapital = runningCapital * (1 + monthReturn);
            
            compoundData.actualMonthlyReturns.push({
                month,
                startCapital: runningCapital,
                pnl: monthPnL,
                returnPercent: monthReturn * 100,
                endCapital: newCapital,
                targetReturn: 12,
                variance: (monthReturn * 100) - 12
            });
            
            compoundData.actualPath.push({
                month,
                capital: newCapital
            });
            
            runningCapital = newCapital;
        }
        
        compoundData.currentCapital = runningCapital;
        
        // Generate projected path at 12% monthly
        let projectedCapital = initialCapital;
        for (let month = 1; month <= Math.ceil(compoundData.monthsToTarget); month++) {
            projectedCapital *= 1.12;
            compoundData.projectedPath.push({
                month,
                capital: Math.min(projectedCapital, targetCapital)
            });
        }
        
        // Calculate progress and variance
        compoundData.progressPercent = ((runningCapital - initialCapital) / (targetCapital - initialCapital)) * 100;
        
        // Calculate if on track
        const monthsElapsed = compoundData.actualMonthlyReturns.length;
        const expectedCapitalNow = initialCapital * Math.pow(1.12, monthsElapsed);
        compoundData.variance = ((runningCapital - expectedCapitalNow) / expectedCapitalNow) * 100;
        compoundData.onTrack = compoundData.variance >= -10; // Allow 10% below target
        
        // Calculate compounding effect (difference vs simple addition)
        const simpleGrowth = initialCapital + (monthlyTrades.size * initialCapital * 0.12);
        compoundData.compoundingEffect = runningCapital - simpleGrowth;
        
        // Add projections and recommendations
        compoundData.projections = this.projectFutureGrowth(runningCapital, targetCapital);
        compoundData.recommendations = this.generateGrowthRecommendations(compoundData);
        
        return compoundData;
    }
    
    /**
     * Project future growth at various rates
     */
    projectFutureGrowth(currentCapital, targetCapital) {
        const projections = {
            conservative: { rate: 0.08, months: 0 },
            target: { rate: 0.12, months: 0 },
            aggressive: { rate: 0.15, months: 0 }
        };
        
        for (const [scenario, data] of Object.entries(projections)) {
            data.months = Math.log(targetCapital / currentCapital) / Math.log(1 + data.rate);
            data.monthsRounded = Math.ceil(data.months);
            data.finalCapital = currentCapital * Math.pow(1 + data.rate, data.monthsRounded);
        }
        
        return projections;
    }
    
    /**
     * Generate recommendations based on compound growth tracking
     */
    generateGrowthRecommendations(compoundData) {
        const recommendations = [];
        
        // Check if behind schedule
        if (compoundData.variance < -10) {
            recommendations.push({
                priority: 'HIGH',
                message: `Behind target by ${Math.abs(compoundData.variance).toFixed(1)}% - Increase position sizing or frequency`,
                action: 'INCREASE_AGGRESSION'
            });
        }
        
        // Check monthly consistency
        const recentReturns = compoundData.actualMonthlyReturns.slice(-3);
        const avgRecent = recentReturns.reduce((sum, r) => sum + r.returnPercent, 0) / recentReturns.length;
        
        if (avgRecent < 10 && recentReturns.length >= 3) {
            recommendations.push({
                priority: 'MEDIUM',
                message: `Recent 3-month average ${avgRecent.toFixed(1)}% below 12% target`,
                action: 'REVIEW_STRATEGY_MIX'
            });
        }
        
        // Check if ahead of schedule
        if (compoundData.variance > 20) {
            recommendations.push({
                priority: 'LOW',
                message: `Ahead of target by ${compoundData.variance.toFixed(1)}% - Consider banking profits`,
                action: 'CONSIDER_RISK_REDUCTION'
            });
        }
        
        // Progress milestone notifications
        if (compoundData.progressPercent >= 75) {
            recommendations.push({
                priority: 'INFO',
                message: `${compoundData.progressPercent.toFixed(1)}% to £80k goal - Final push phase`,
                action: 'MAINTAIN_DISCIPLINE'
            });
        } else if (compoundData.progressPercent >= 50) {
            recommendations.push({
                priority: 'INFO',
                message: `Halfway to £80k goal - Compound effect accelerating`,
                action: 'STAY_CONSISTENT'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Group trades by calendar month
     */
    groupTradesByMonth(trades) {
        const monthlyGroups = new Map();
        
        for (const trade of trades) {
            const date = new Date(trade.exitDate || trade.entryDate);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyGroups.has(monthKey)) {
                monthlyGroups.set(monthKey, []);
            }
            monthlyGroups.get(monthKey).push(trade);
        }
        
        return monthlyGroups;
    }
    
    /**
     * Calculate monthly compounding metrics
     */
    calculateMonthlyCompounding(monthlyReturns, initialCapital = 35000) {
        let capital = initialCapital;
        const compoundingMetrics = {
            months: [],
            finalCapital: initialCapital,
            totalReturn: 0,
            averageMonthlyReturn: 0,
            bestMonth: { return: -Infinity, month: null },
            worstMonth: { return: Infinity, month: null },
            consistencyScore: 0
        };
        
        monthlyReturns.forEach((returnPct, index) => {
            const newCapital = capital * (1 + returnPct / 100);
            const monthData = {
                month: index + 1,
                startCapital: capital,
                returnPercent: returnPct,
                endCapital: newCapital,
                cumulativeReturn: ((newCapital - initialCapital) / initialCapital) * 100
            };
            
            compoundingMetrics.months.push(monthData);
            
            if (returnPct > compoundingMetrics.bestMonth.return) {
                compoundingMetrics.bestMonth = { return: returnPct, month: index + 1 };
            }
            if (returnPct < compoundingMetrics.worstMonth.return) {
                compoundingMetrics.worstMonth = { return: returnPct, month: index + 1 };
            }
            
            capital = newCapital;
        });
        
        compoundingMetrics.finalCapital = capital;
        compoundingMetrics.totalReturn = ((capital - initialCapital) / initialCapital) * 100;
        compoundingMetrics.averageMonthlyReturn = monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;
        
        // Calculate consistency score (how close to 12% target each month)
        const targetReturn = 12;
        const deviations = monthlyReturns.map(r => Math.abs(r - targetReturn));
        const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
        compoundingMetrics.consistencyScore = Math.max(0, 100 - (avgDeviation * 5)); // 5 points per 1% deviation
        
        return compoundingMetrics;
    }

    /**
     * Identify best performing strategy
     */
    identifyBestStrategy(strategyBreakdown) {
        if (!strategyBreakdown || Object.keys(strategyBreakdown).length === 0) {
            return { strategy: 'N/A', winRate: 0 };
        }
        
        let bestStrategy = null;
        let bestWinRate = -Infinity;
        
        for (const [strategy, stats] of Object.entries(strategyBreakdown)) {
            if (stats.winRate > bestWinRate) {
                bestWinRate = stats.winRate;
                bestStrategy = strategy;
            }
        }
        
        return { strategy: bestStrategy, winRate: bestWinRate };
    }

    /**
     * Identify worst performing strategy
     */
    identifyWorstStrategy(strategyBreakdown) {
        if (!strategyBreakdown || Object.keys(strategyBreakdown).length === 0) {
            return { strategy: 'N/A', winRate: 0 };
        }
        
        let worstStrategy = null;
        let worstWinRate = Infinity;
        
        for (const [strategy, stats] of Object.entries(strategyBreakdown)) {
            if (stats.winRate < worstWinRate) {
                worstWinRate = stats.winRate;
                worstStrategy = strategy;
            }
        }
        
        return { strategy: worstStrategy, winRate: worstWinRate };
    }

    /**
     * Calculate strategy correlation
     */
    calculateStrategyCorrelation(trades) {
        // Simplified correlation calculation
        if (!trades || trades.length < 2) return 0;
        
        const strategies = [...new Set(trades.map(t => t.strategy))];
        if (strategies.length < 2) return 0;
        
        // For now, return a simple diversity metric based on strategy count
        // More strategies = less correlation (better diversification)
        return 1 / strategies.length;
        
        /* Commented out - needs strategyReturns and benchmarkReturns to be defined
        let covariance = 0;
        let stratVariance = 0;
        let benchVariance = 0;
        
        for (let i = 0; i < strategyReturns.length; i++) {
            const stratDiff = strategyReturns[i] - avgStrategy;
            const benchDiff = benchmarkReturns[i] - avgBenchmark;
            covariance += stratDiff * benchDiff;
            stratVariance += stratDiff * stratDiff;
            benchVariance += benchDiff * benchDiff;
        }
        
        covariance /= strategyReturns.length;
        stratVariance /= strategyReturns.length;
        benchVariance /= benchmarkReturns.length;
        
        const correlation = Math.sqrt(stratVariance) * Math.sqrt(benchVariance) > 0
            ? covariance / (Math.sqrt(stratVariance) * Math.sqrt(benchVariance))
            : 0;
        
        return Math.round(correlation * 100) / 100 // Round to 2 decimals
        */
    }

    /**
     * Calculate diversification benefit
     */
    calculateDiversificationBenefit(strategyBreakdown) {
        if (!strategyBreakdown || Object.keys(strategyBreakdown).length === 0) return 0;
        
        const strategies = Object.keys(strategyBreakdown);
        if (strategies.length === 1) return 0;
        
        // Simplified diversification benefit calculation
        const avgReturn = Object.values(strategyBreakdown)
            .reduce((sum, stats) => sum + stats.totalReturn, 0) / strategies.length;
        
        return avgReturn * 0.15; // Assume 15% benefit from diversification
    }

    /**
     * Calculate maximum winning streak
     */
    calculateMaxWinStreak(trades) {
        if (!trades || trades.length === 0) return 0;
        
        let maxStreak = 0;
        let currentStreak = 0;
        
        for (const trade of trades) {
            if (trade.pnl > 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }
        
        return maxStreak;
    }

    /**
     * Calculate maximum losing streak
     */
    calculateMaxLossStreak(trades) {
        if (!trades || trades.length === 0) return 0;
        
        let maxStreak = 0;
        let currentStreak = 0;
        
        for (const trade of trades) {
            if (trade.pnl < 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }
        
        return maxStreak;
    }
    
    /**
     * Calculate maximum profit streak from daily P&L
     */
    calculateMaxProfitStreak(dailyPnL) {
        if (!dailyPnL || dailyPnL.length === 0) return 0;
        
        let maxStreak = 0;
        let currentStreak = 0;
        
        dailyPnL.forEach(day => {
            const pnl = day.pnl || day;
            if (pnl > 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return maxStreak;
    }
    
    /**
     * Calculate maximum drawdown streak from daily P&L
     */
    calculateMaxDrawdownStreak(dailyPnL) {
        if (!dailyPnL || dailyPnL.length === 0) return 0;
        
        let maxStreak = 0;
        let currentStreak = 0;
        
        dailyPnL.forEach(day => {
            const pnl = day.pnl || day;
            if (pnl < 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return maxStreak;
    }


    /**
     * Analyze days of week performance
     */
    analyzeDaysOfWeek(trades) {
        const dayStats = {};
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        for (let i = 0; i < 7; i++) {
            dayStats[dayNames[i]] = { trades: 0, wins: 0, losses: 0, pnl: 0 };
        }
        
        for (const trade of trades) {
            const day = new Date(trade.entryDate).getDay();
            const dayName = dayNames[day];
            
            dayStats[dayName].trades++;
            if (trade.pnl > 0) {
                dayStats[dayName].wins++;
            } else {
                dayStats[dayName].losses++;
            }
            dayStats[dayName].pnl += trade.pnl || 0;
        }
        
        return dayStats;
    }

    /**
     * Analyze time of day performance
     */
    analyzeTimeOfDay(trades) {
        const timeStats = {
            morning: { trades: 0, pnl: 0 },     // 9:30-12:00
            midday: { trades: 0, pnl: 0 },      // 12:00-14:00
            afternoon: { trades: 0, pnl: 0 },   // 14:00-16:00
            afterHours: { trades: 0, pnl: 0 }   // Other times
        };
        
        for (const trade of trades) {
            const hour = new Date(trade.entryDate).getHours();
            
            let period;
            if (hour >= 9 && hour < 12) period = 'morning';
            else if (hour >= 12 && hour < 14) period = 'midday';
            else if (hour >= 14 && hour < 16) period = 'afternoon';
            else period = 'afterHours';
            
            timeStats[period].trades++;
            timeStats[period].pnl += trade.pnl || 0;
        }
        
        return timeStats;
    }
    
    /**
     * Calculate reliability index
     */
    calculateReliabilityIndex(trades) {
        if (!trades || trades.length === 0) return 0;
        
        const profitableTrades = trades.filter(t => t.pnl > 0).length;
        const totalTrades = trades.length;
        const avgPnL = trades.reduce((sum, t) => sum + t.pnl, 0) / totalTrades;
        
        // Combine win rate with average P&L
        const winRate = profitableTrades / totalTrades;
        const pnlFactor = avgPnL > 0 ? 1 : 0.5;
        
        return Math.round(winRate * pnlFactor * 100);
    }
    
    /**
     * Calculate stability factor
     */
    calculateStabilityFactor(dailyPnL) {
        if (!dailyPnL || dailyPnL.length === 0) return 0;
        
        const pnlValues = dailyPnL.map(d => d.pnl || d);
        const mean = pnlValues.reduce((sum, v) => sum + v, 0) / pnlValues.length;
        
        if (mean === 0) return 0;
        
        const variance = pnlValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / pnlValues.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower volatility relative to mean = higher stability
        const cv = stdDev / Math.abs(mean);
        const stability = Math.max(0, 100 * (1 - cv));
        
        return Math.round(stability);
    }
    
    /**
     * Calculate trading frequency
     */
    calculateTradingFrequency(trades) {
        if (!trades || trades.length === 0) return { daily: 0, weekly: 0, monthly: 0 };
        
        const firstTrade = new Date(trades[0].entryDate || trades[0].date);
        const lastTrade = new Date(trades[trades.length - 1].entryDate || trades[trades.length - 1].date);
        const daysDiff = Math.max(1, (lastTrade - firstTrade) / (1000 * 60 * 60 * 24));
        
        return {
            daily: Math.round((trades.length / daysDiff) * 10) / 10,
            weekly: Math.round((trades.length / (daysDiff / 7)) * 10) / 10,
            monthly: Math.round((trades.length / (daysDiff / 30)) * 10) / 10
        };
    }
    
    /**
     * Calculate seasonality patterns
     */
    calculateSeasonality(trades) {
        if (!trades || trades.length === 0) return {};
        
        const monthlyPerformance = {};
        
        trades.forEach(trade => {
            const month = new Date(trade.entryDate || trade.date).getMonth();
            const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month];
            
            if (!monthlyPerformance[monthName]) {
                monthlyPerformance[monthName] = { trades: 0, pnl: 0 };
            }
            
            monthlyPerformance[monthName].trades++;
            monthlyPerformance[monthName].pnl += trade.pnl || 0;
        });
        
        return monthlyPerformance;
    }
    
    /**
     * Calculate stability rating
     */
    calculateStabilityRating(monthlyReturns, trades) {
        if (!monthlyReturns || monthlyReturns.length === 0) return 0;
        
        // Calculate consistency of monthly returns
        const profitableMonths = monthlyReturns.filter(r => r > 0).length;
        const consistencyScore = (profitableMonths / monthlyReturns.length) * 100;
        
        // Calculate trade frequency stability
        const tradeCount = trades ? trades.length : 0;
        const frequencyScore = Math.min(100, tradeCount * 2); // Cap at 100
        
        // Combine scores
        return Math.round((consistencyScore * 0.7 + frequencyScore * 0.3));
    }
    
    /**
     * Calculate time efficiency
     */
    calculateTimeEfficiency(trades) {
        if (!trades || trades.length === 0) return 0;
        
        let totalTimeInTrade = 0;
        let profitableTime = 0;
        
        trades.forEach(trade => {
            const entryDate = new Date(trade.entryDate || trade.date);
            const exitDate = new Date(trade.exitDate || trade.closeDate || trade.date);
            const timeDiff = Math.max(1, (exitDate - entryDate) / (1000 * 60 * 60 * 24)); // Days
            
            totalTimeInTrade += timeDiff;
            if (trade.pnl > 0) {
                profitableTime += timeDiff;
            }
        });
        
        if (totalTimeInTrade === 0) return 0;
        
        return Math.round((profitableTime / totalTimeInTrade) * 100);
    }
    
    /**
     * Calculate capital utilization rate
     */
    calculateCapitalUtilizationRate(trades, initialCapital) {
        if (!trades || trades.length === 0 || !initialCapital) return 0;
        
        let totalCapitalUsed = 0;
        trades.forEach(trade => {
            totalCapitalUsed += trade.capitalRequired || trade.buyingPower || 0;
        });
        
        const avgCapitalPerTrade = totalCapitalUsed / trades.length;
        return Math.round((avgCapitalPerTrade / initialCapital) * 100);
    }
    
    /**
     * Calculate return efficiency
     */
    calculateReturnEfficiency(totalReturn, maxDrawdown) {
        if (maxDrawdown === 0) return totalReturn > 0 ? 100 : 0;
        return Math.round((totalReturn / Math.abs(maxDrawdown)) * 100);
    }
    
    /**
     * Calculate portfolio efficiency score
     */
    calculatePortfolioEfficiencyScore(metrics) {
        const weights = {
            capitalEfficiency: 0.3,
            timeEfficiency: 0.2,
            returnEfficiency: 0.3,
            utilizationRate: 0.2
        };
        
        let score = 0;
        score += (metrics.capitalEfficiency || 0) * weights.capitalEfficiency;
        score += (metrics.timeEfficiency || 0) * weights.timeEfficiency;
        score += (metrics.returnEfficiency || 0) * weights.returnEfficiency;
        score += (metrics.utilizationRate || 0) * weights.utilizationRate;
        
        return Math.round(score);
    }

    /**
     * Calculate turnover rate - COMPLETE IMPLEMENTATION
     * Measures how often the portfolio is traded (higher = more active)
     */
    calculateTurnoverRate(trades, dailyPnL) {
        if (!trades || trades.length === 0) return 0;
        
        // Calculate total traded value
        const totalValue = trades.reduce((sum, trade) => sum + Math.abs(trade.entryValue || 0), 0);
        
        // Get average portfolio value from daily P&L
        const avgPortfolioValue = dailyPnL && dailyPnL.length > 0 
            ? dailyPnL.reduce((sum, day) => sum + (day.portfolioValue || 0), 0) / dailyPnL.length
            : totalValue / trades.length;
        
        // Annualized turnover = (Total Traded Value / Avg Portfolio Value) * (252 / Trading Days)
        const tradingPeriodDays = dailyPnL ? dailyPnL.length : trades.length;
        const annualTurnover = avgPortfolioValue > 0 
            ? (totalValue / avgPortfolioValue) * (252 / Math.max(1, tradingPeriodDays))
            : 0;
        
        return Math.round(annualTurnover * 100) / 100; // Round to 2 decimals
    }

    /**
     * Calculate risk-adjusted return - COMPLETE IMPLEMENTATION
     * Return per unit of risk taken (Sharpe-like metric)
     */
    calculateRiskAdjustedReturn(trades, dailyPnL) {
        if (!trades || trades.length === 0) return 0;
        
        // Calculate total return
        const totalReturn = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        
        // Calculate standard deviation of returns (risk)
        const returns = trades.map(trade => trade.pnl || 0);
        const avgReturn = totalReturn / trades.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / trades.length;
        const stdDev = Math.sqrt(variance);
        
        // Risk-adjusted return = Average Return / Standard Deviation
        // Similar to Sharpe ratio but without risk-free rate
        const riskAdjustedReturn = stdDev > 0 ? (avgReturn / stdDev) : 0;
        
        return Math.round(riskAdjustedReturn * 100) / 100; // Round to 2 decimals
    }

    /**
     * Calculate information ratio - COMPLETE IMPLEMENTATION
     * Measures excess returns relative to tracking error
     */
    calculateInformationRatio(dailyPnL, benchmark = null) {
        if (!dailyPnL || dailyPnL.length === 0) return 0;
        
        if (benchmark) {
            // Benchmark comparison version - proper calculation
            const returns = this.calculateDailyReturns(dailyPnL, dailyPnL[0]?.capital || 30000);
            const excessReturns = returns.map((ret, i) => ret - (benchmark[i] || 0));
            const avgExcess = excessReturns.reduce((sum, ret) => sum + ret, 0) / excessReturns.length;
            
            // Calculate tracking error (std dev of excess returns)
            const variance = excessReturns.reduce((sum, ret) => 
                sum + Math.pow(ret - avgExcess, 2), 0) / excessReturns.length;
            const trackingError = Math.sqrt(variance);
            
            // Information Ratio = Annualized Excess Return / Tracking Error
            const annualizedExcess = avgExcess * 252;
            const annualizedTE = trackingError * Math.sqrt(252);
            
            return annualizedTE > 0 ? Math.round((annualizedExcess / annualizedTE) * 100) / 100 : 0;
        } else {
            // Standalone version - Sharpe-like calculation
            const returns = this.calculateDailyReturns(dailyPnL, dailyPnL[0]?.capital || 30000);
            const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
            const volatility = this.calculateVolatility(returns) / 100;
            
            // Annualized Information Ratio
            const annualizedReturn = avgReturn * 252;
            const annualizedVol = volatility * Math.sqrt(252);
            
            return annualizedVol > 0 ? Math.round((annualizedReturn / annualizedVol) * 100) / 100 : 0;
        }
    }

    /**
     * Calculate trading costs estimate - COMPLETE IMPLEMENTATION
     * Based on TastyTrade's actual fee structure
     */
    estimateTradingCosts(trades) {
        if (!trades || trades.length === 0) return 0;
        
        let totalCosts = 0;
        
        for (const trade of trades) {
            const instrument = trade.instrument || 'option';
            const quantity = Math.abs(trade.quantity || 1);
            
            if (instrument === 'option' || trade.symbol?.includes('SPX')) {
                // Options: £0.50 per contract, £5 max per leg
                const optionCost = Math.min(quantity * 0.50, 5.00);
                totalCosts += optionCost;
            } else if (instrument === 'future' || trade.symbol?.includes('ES')) {
                // Futures: £1.25 per contract
                totalCosts += quantity * 1.25;
            } else {
                // Stock: £0 commission at TastyTrade
                totalCosts += 0;
            }
            
            // Add regulatory fees (estimated £0.05 per trade)
            totalCosts += 0.05;
        }
        
        return Math.round(totalCosts * 100) / 100; // Round to 2 decimals
    }

    /**
     * Calculate net efficiency - COMPLETE IMPLEMENTATION
     * Measures how much of gross profit is retained after costs
     */
    calculateNetEfficiency(trades) {
        if (!trades || trades.length === 0) return 0;
        
        // Separate winning and losing trades
        const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
        const losingTrades = trades.filter(t => (t.pnl || 0) <= 0);
        
        const grossProfit = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));
        
        // Calculate all costs
        const tradingCosts = this.estimateTradingCosts(trades);
        const slippage = trades.length * 0.25; // Estimated £0.25 slippage per trade
        const totalCosts = tradingCosts + slippage;
        
        // Net efficiency = (Gross Profit - Total Costs) / Gross Profit
        const netProfit = grossProfit - grossLoss - totalCosts;
        const efficiency = grossProfit > 0 ? (netProfit / grossProfit) * 100 : 0;
        
        return Math.round(efficiency * 100) / 100; // Round to 2 decimals
    }

    /**
     * Align returns for benchmark comparison
     */
    alignReturns(strategyReturns, benchmarkReturns) {
        const minLength = Math.min(strategyReturns.length, benchmarkReturns.length);
        return {
            strategy: strategyReturns.slice(0, minLength),
            benchmark: benchmarkReturns.slice(0, minLength)
        };
    }

    /**
     * Calculate alpha - COMPLETE IMPLEMENTATION
     * Excess return above expected return based on beta
     */
    calculateAlpha(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        // Calculate average returns
        const avgStrategy = strategyReturns.reduce((sum, ret) => sum + ret, 0) / strategyReturns.length;
        const avgBenchmark = benchmarkReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkReturns.length;
        
        // Calculate beta (systematic risk)
        const beta = this.calculateBeta(strategyReturns, benchmarkReturns);
        
        // Risk-free rate (UK 10-year gilt ~4.5% annually)
        const dailyRiskFree = 0.045 / 252;
        
        // Alpha = Portfolio Return - [Risk-Free Rate + Beta * (Market Return - Risk-Free Rate)]
        const alpha = avgStrategy - (dailyRiskFree + beta * (avgBenchmark - dailyRiskFree));
        
        // Annualize the alpha
        const annualizedAlpha = alpha * 252;
        
        return Math.round(annualizedAlpha * 10000) / 100; // Return as percentage
    }

    /**
     * Calculate beta - COMPLETE IMPLEMENTATION
     * Systematic risk relative to benchmark
     */
    calculateBeta(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 1;
        
        const covariance = this.calculateCovariance(strategyReturns, benchmarkReturns);
        const benchmarkVariance = this.calculateVariance(benchmarkReturns);
        
        return benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
    }

    /**
     * Calculate correlation between strategy and benchmark
     */
    calculateCorrelation(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        const covariance = this.calculateCovariance(strategyReturns, benchmarkReturns);
        const strategyStdDev = Math.sqrt(this.calculateVariance(strategyReturns));
        const benchmarkStdDev = Math.sqrt(this.calculateVariance(benchmarkReturns));
        
        return (strategyStdDev * benchmarkStdDev) > 0 ? covariance / (strategyStdDev * benchmarkStdDev) : 0;
    }

    /**
     * Calculate tracking error (std dev of excess returns)
     */
    calculateTrackingError(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        const excessReturns = strategyReturns.map((ret, i) => ret - (benchmarkReturns[i] || 0));
        return this.calculateVolatility(excessReturns);
    }

    /**
     * Calculate upside capture ratio
     */
    calculateUpsideCapture(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        const upPeriods = benchmarkReturns.map((ret, i) => ret > 0 ? { strategy: strategyReturns[i], benchmark: ret } : null)
            .filter(period => period !== null);
        
        if (upPeriods.length === 0) return 0;
        
        const avgStrategyUp = upPeriods.reduce((sum, p) => sum + p.strategy, 0) / upPeriods.length;
        const avgBenchmarkUp = upPeriods.reduce((sum, p) => sum + p.benchmark, 0) / upPeriods.length;
        
        return avgBenchmarkUp > 0 ? (avgStrategyUp / avgBenchmarkUp) * 100 : 0;
    }

    /**
     * Calculate downside capture ratio
     */
    calculateDownsideCapture(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        const downPeriods = benchmarkReturns.map((ret, i) => ret < 0 ? { strategy: strategyReturns[i], benchmark: ret } : null)
            .filter(period => period !== null);
        
        if (downPeriods.length === 0) return 0;
        
        const avgStrategyDown = downPeriods.reduce((sum, p) => sum + p.strategy, 0) / downPeriods.length;
        const avgBenchmarkDown = downPeriods.reduce((sum, p) => sum + p.benchmark, 0) / downPeriods.length;
        
        return avgBenchmarkDown < 0 ? (avgStrategyDown / avgBenchmarkDown) * 100 : 0;
    }

    /**
     * Calculate percentage of outperformance periods
     */
    calculateOutperformancePeriods(strategyReturns, benchmarkReturns) {
        if (!strategyReturns || !benchmarkReturns || strategyReturns.length === 0) return 0;
        
        const outperformingPeriods = strategyReturns.filter((ret, i) => ret > (benchmarkReturns[i] || 0)).length;
        return (outperformingPeriods / strategyReturns.length) * 100;
    }

    /**
     * Calculate covariance - helper function
     */
    calculateCovariance(returns1, returns2) {
        if (!returns1 || !returns2 || returns1.length !== returns2.length || returns1.length === 0) return 0;
        
        const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
        const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;
        
        const covariance = returns1.reduce((sum, ret, i) => sum + (ret - mean1) * (returns2[i] - mean2), 0) / returns1.length;
        return covariance;
    }

    /**
     * Calculate variance - helper function
     */
    calculateVariance(returns) {
        if (!returns || returns.length === 0) return 0;
        
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return variance;
    }

    /**
     * Fix calculateConsistencyScore signature mismatch
     */
    calculateConsistencyScore(monthlyReturns) {
        if (!monthlyReturns || monthlyReturns.length === 0) return 0;
        
        const profitableMonths = monthlyReturns.filter(ret => ret > 0).length;
        const consistencyRatio = profitableMonths / monthlyReturns.length;
        
        // Calculate volatility of returns as measure of consistency
        const mean = monthlyReturns.reduce((sum, ret) => sum + ret, 0) / monthlyReturns.length;
        const variance = monthlyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / monthlyReturns.length;
        const volatility = Math.sqrt(variance);
        
        // Higher consistency ratio and lower volatility = higher score
        const volatilityScore = Math.max(0, 1 - (volatility / 50)); // Normalize volatility
        const finalScore = (consistencyRatio * 0.6 + volatilityScore * 0.4) * 100;
        
        return Math.round(Math.min(100, Math.max(0, finalScore)));
    }
}

/**
 * P&L Calculator - Core calculation logic
 */
class PLCalculator {
    /**
     * Calculate position P&L
     */
    static calculatePositionPL(position) {
        const entryValue = position.entryPrice * position.quantity;
        const currentValue = position.currentPrice * position.quantity;
        const dollarPL = currentValue - entryValue;
        const percentPL = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100;
        
        return {
            dollarPL: dollarPL - position.commission,
            percentPL,
            entryValue,
            currentValue,
            commission: position.commission,
            netPL: dollarPL - position.commission
        };
    }
    
    /**
     * Calculate portfolio-level P&L
     */
    static calculatePortfolioPL(positions) {
        let totalDollarPL = 0;
        let totalEntryValue = 0;
        let totalCurrentValue = 0;
        let totalCommission = 0;
        
        const positionPLs = positions.map(position => {
            const pl = this.calculatePositionPL(position);
            totalDollarPL += pl.dollarPL;
            totalEntryValue += pl.entryValue;
            totalCurrentValue += pl.currentValue;
            totalCommission += pl.commission;
            
            return {
                positionId: position.id,
                ticker: position.ticker,
                strategy: position.strategy,
                ...pl
            };
        });
        
        const portfolioPercentPL = totalEntryValue > 0 ? 
            ((totalCurrentValue - totalEntryValue) / totalEntryValue) * 100 : 0;
        
        return {
            totalDollarPL,
            portfolioPercentPL,
            totalEntryValue,
            totalCurrentValue,
            totalCommission,
            netPL: totalDollarPL - totalCommission,
            positionPLs,
            positionCount: positions.length
        };
    }
    
    /**
     * Calculate P&L by strategy
     */
    static calculatePLByStrategy(positions) {
        const strategyPL = {};
        
        positions.forEach(position => {
            const strategy = position.strategy;
            const pl = this.calculatePositionPL(position);
            
            if (!strategyPL[strategy]) {
                strategyPL[strategy] = {
                    strategy,
                    positionCount: 0,
                    totalDollarPL: 0,
                    totalEntryValue: 0,
                    totalCurrentValue: 0,
                    totalCommission: 0,
                    positions: []
                };
            }
            
            const stratData = strategyPL[strategy];
            stratData.positionCount++;
            stratData.totalDollarPL += pl.dollarPL;
            stratData.totalEntryValue += pl.entryValue;
            stratData.totalCurrentValue += pl.currentValue;
            stratData.totalCommission += pl.commission;
            stratData.positions.push({
                positionId: position.id,
                ticker: position.ticker,
                ...pl
            });
        });
        
        // Calculate percentages for each strategy
        Object.keys(strategyPL).forEach(strategy => {
            const data = strategyPL[strategy];
            data.percentPL = data.totalEntryValue > 0 ? 
                ((data.totalCurrentValue - data.totalEntryValue) / data.totalEntryValue) * 100 : 0;
            data.netPL = data.totalDollarPL - data.totalCommission;
            data.avgPLPerPosition = data.positionCount > 0 ? data.netPL / data.positionCount : 0;
        });
        
        return strategyPL;
    }
    
    /**
     * Calculate P&L by correlation group
     */
    static calculatePLByCorrelationGroup(positions) {
        const groupPL = {};
        
        positions.forEach(position => {
            const group = position.correlationGroup || 'UNCORRELATED';
            const pl = this.calculatePositionPL(position);
            
            if (!groupPL[group]) {
                groupPL[group] = {
                    group,
                    positionCount: 0,
                    totalDollarPL: 0,
                    totalEntryValue: 0,
                    totalCurrentValue: 0,
                    totalCommission: 0,
                    tickers: new Set()
                };
            }
            
            const groupData = groupPL[group];
            groupData.positionCount++;
            groupData.totalDollarPL += pl.dollarPL;
            groupData.totalEntryValue += pl.entryValue;
            groupData.totalCurrentValue += pl.currentValue;
            groupData.totalCommission += pl.commission;
            groupData.tickers.add(position.ticker);
        });
        
        // Calculate percentages and convert tickers set to array
        Object.keys(groupPL).forEach(group => {
            const data = groupPL[group];
            data.percentPL = data.totalEntryValue > 0 ? 
                ((data.totalCurrentValue - data.totalEntryValue) / data.totalEntryValue) * 100 : 0;
            data.netPL = data.totalDollarPL - data.totalCommission;
            data.tickers = Array.from(data.tickers);
        });
        
        return groupPL;
    }
}

/**
 * Historical P&L Tracker
 */
class HistoricalPLTracker {
    constructor() {
        this.dailyPL = new Map(); // Date -> P&L data
        this.weeklyPL = new Map();
        this.monthlyPL = new Map();
        this.yearlyPL = new Map();
        this.trades = []; // Completed trades
    }
    
    /**
     * Record end-of-day P&L snapshot
     */
    recordDailyPL(date, plData) {
        const dateKey = this.formatDate(date);
        this.dailyPL.set(dateKey, {
            date: dateKey,
            timestamp: new Date(date),
            ...plData
        });
        
        // Update weekly/monthly/yearly aggregations
        this.updateAggregations(date, plData);
    }
    
    /**
     * Record completed trade
     */
    recordCompletedTrade(trade) {
        const tradeRecord = {
            ...trade,
            completedAt: new Date(),
            yearMonth: this.getYearMonth(trade.exitDate || new Date()),
            weekOfYear: this.getWeekOfYear(trade.exitDate || new Date())
        };
        
        this.trades.push(tradeRecord);
        
        getLogger().info('PL_TRACKER', 
            `Trade completed: ${trade.ticker} ${trade.strategy} P&L: £${trade.realizedPL?.toFixed(2) || 'N/A'}`
        );
    }
    
    /**
     * Get daily P&L for date range
     */
    getDailyPL(startDate, endDate) {
        const start = this.formatDate(startDate);
        const end = this.formatDate(endDate);
        const result = [];
        
        for (const [dateKey, plData] of this.dailyPL) {
            if (dateKey >= start && dateKey <= end) {
                result.push(plData);
            }
        }
        
        return result.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    /**
     * Get weekly P&L summary
     */
    getWeeklyPL(year) {
        const weeks = [];
        for (const [weekKey, plData] of this.weeklyPL) {
            if (weekKey.startsWith(year.toString())) {
                weeks.push(plData);
            }
        }
        return weeks.sort((a, b) => a.week - b.week);
    }
    
    /**
     * Get monthly P&L summary
     */
    getMonthlyPL(year) {
        const months = [];
        for (const [monthKey, plData] of this.monthlyPL) {
            if (monthKey.startsWith(year.toString())) {
                months.push(plData);
            }
        }
        return months.sort((a, b) => a.month - b.month);
    }
    
    /**
     * Get yearly P&L summary
     */
    getYearlyPL() {
        return Array.from(this.yearlyPL.values()).sort((a, b) => a.year - b.year);
    }
    
    /**
     * Get trade statistics
     */
    getTradeStatistics(filters = {}) {
        let filteredTrades = this.trades;
        
        // Apply filters
        if (filters.strategy) {
            filteredTrades = filteredTrades.filter(trade => 
                trade.strategy === filters.strategy
            );
        }
        
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            filteredTrades = filteredTrades.filter(trade => {
                const tradeDate = new Date(trade.exitDate || trade.completedAt);
                return tradeDate >= start && tradeDate <= end;
            });
        }
        
        if (filteredTrades.length === 0) {
            return {
                totalTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                totalPL: 0
            };
        }
        
        const winners = filteredTrades.filter(trade => 
            (trade.realizedPL || 0) > 0
        );
        const losers = filteredTrades.filter(trade => 
            (trade.realizedPL || 0) < 0
        );
        
        const totalWinAmount = winners.reduce((sum, trade) => 
            sum + (trade.realizedPL || 0), 0
        );
        const totalLossAmount = Math.abs(losers.reduce((sum, trade) => 
            sum + (trade.realizedPL || 0), 0
        ));
        
        const avgWin = winners.length > 0 ? totalWinAmount / winners.length : 0;
        const avgLoss = losers.length > 0 ? totalLossAmount / losers.length : 0;
        
        return {
            totalTrades: filteredTrades.length,
            winners: winners.length,
            losers: losers.length,
            winRate: (winners.length / filteredTrades.length) * 100,
            avgWin,
            avgLoss,
            profitFactor: totalLossAmount > 0 ? totalWinAmount / totalLossAmount : Infinity,
            totalPL: filteredTrades.reduce((sum, trade) => sum + (trade.realizedPL || 0), 0),
            totalWinAmount,
            totalLossAmount,
            largestWin: Math.max(...filteredTrades.map(t => t.realizedPL || 0)),
            largestLoss: Math.min(...filteredTrades.map(t => t.realizedPL || 0))
        };
    }
    
    /**
     * Tom King specific statistics
     */
    getTomKingStats() {
        const stats = {
            fridayODTE: this.getTradeStatistics({ strategy: '0DTE' }),
            strangles: this.getTradeStatistics({ strategy: 'STRANGLE' }),
            lt112: this.getTradeStatistics({ strategy: 'LT112' }),
            overall: this.getTradeStatistics()
        };
        
        // Calculate monthly income progression
        const monthlyIncomes = this.getMonthlyIncomes();
        const currentMonthIncome = monthlyIncomes[monthlyIncomes.length - 1]?.income || 0;
        const targetMonthlyIncome = 10000; // £10k target
        
        stats.monthlyProgression = {
            currentMonthIncome,
            targetMonthlyIncome,
            progressPercent: (currentMonthIncome / targetMonthlyIncome) * 100,
            monthsToTarget: this.calculateMonthsToTarget(monthlyIncomes, targetMonthlyIncome),
            monthlyIncomes
        };
        
        return stats;
    }
    
    getMonthlyIncomes() {
        const incomes = [];
        for (const [monthKey, plData] of this.monthlyPL) {
            incomes.push({
                month: monthKey,
                income: plData.totalDollarPL || 0,
                trades: plData.tradeCount || 0
            });
        }
        return incomes.sort((a, b) => a.month.localeCompare(b.month));
    }
    
    calculateMonthsToTarget(monthlyIncomes, target) {
        if (monthlyIncomes.length < 2) return 'Insufficient data';
        
        // Calculate growth rate from last 3 months if available
        const recentMonths = monthlyIncomes.slice(-3);
        if (recentMonths.length < 2) return 'Insufficient data';
        
        const avgGrowthRate = this.calculateAverageGrowthRate(recentMonths);
        const currentIncome = monthlyIncomes[monthlyIncomes.length - 1].income;
        
        if (avgGrowthRate <= 0 || currentIncome <= 0) return 'Target not achievable at current rate';
        
        const months = Math.log(target / currentIncome) / Math.log(1 + avgGrowthRate);
        return Math.ceil(months);
    }
    
    calculateAverageGrowthRate(incomes) {
        let totalGrowthRate = 0;
        let periods = 0;
        
        for (let i = 1; i < incomes.length; i++) {
            const current = incomes[i].income;
            const previous = incomes[i - 1].income;
            
            if (previous > 0) {
                totalGrowthRate += (current - previous) / previous;
                periods++;
            }
        }
        
        return periods > 0 ? totalGrowthRate / periods : 0;
    }
    
    // Helper methods
    formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    }
    
    getYearMonth(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    
    getWeekOfYear(date) {
        const d = new Date(date);
        const start = new Date(d.getFullYear(), 0, 1);
        const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }
    
    updateAggregations(date, plData) {
        const dateObj = new Date(date);
        const yearMonth = this.getYearMonth(date);
        const yearWeek = `${dateObj.getFullYear()}-W${String(this.getWeekOfYear(date)).padStart(2, '0')}`;
        const year = dateObj.getFullYear();
        
        // Update weekly
        if (!this.weeklyPL.has(yearWeek)) {
            this.weeklyPL.set(yearWeek, {
                week: this.getWeekOfYear(date),
                year: dateObj.getFullYear(),
                totalDollarPL: 0,
                tradeCount: 0,
                days: []
            });
        }
        const weekData = this.weeklyPL.get(yearWeek);
        weekData.totalDollarPL += plData.totalDollarPL || 0;
        weekData.tradeCount += plData.tradeCount || 0;
        weekData.days.push(this.formatDate(date));
        
        // Update monthly
        if (!this.monthlyPL.has(yearMonth)) {
            this.monthlyPL.set(yearMonth, {
                month: dateObj.getMonth() + 1,
                year: dateObj.getFullYear(),
                totalDollarPL: 0,
                tradeCount: 0,
                days: []
            });
        }
        const monthData = this.monthlyPL.get(yearMonth);
        monthData.totalDollarPL += plData.totalDollarPL || 0;
        monthData.tradeCount += plData.tradeCount || 0;
        monthData.days.push(this.formatDate(date));
        
        // Update yearly
        if (!this.yearlyPL.has(year)) {
            this.yearlyPL.set(year, {
                year,
                totalDollarPL: 0,
                tradeCount: 0,
                months: []
            });
        }
        const yearData = this.yearlyPL.get(year);
        yearData.totalDollarPL += plData.totalDollarPL || 0;
        yearData.tradeCount += plData.tradeCount || 0;
        if (!yearData.months.includes(yearMonth)) {
            yearData.months.push(yearMonth);
        }
    }
}

/**
 * P&L Calculation Engine - Main engine
 */
class PLCalculationEngine extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            updateInterval: options.updateInterval || 60000, // 1 minute
            historicalRetention: options.historicalRetention || 365, // days
            autoCalculateHistorical: options.autoCalculateHistorical !== false,
            ...options
        };
        
        this.calculator = PLCalculator;
        this.historicalTracker = new HistoricalPLTracker();
        this.currentPL = null;
        this.lastUpdateTime = null;
        
        // Auto-calculation interval
        if (this.options.autoCalculateHistorical) {
            this.historicalInterval = setInterval(() => {
                this.recordDailySnapshot();
            }, 24 * 60 * 60 * 1000); // Daily
        }
        
        getLogger().info('PL_ENGINE', 'P&L Calculation Engine initialized');
    }
    
    /**
     * Calculate real-time P&L for positions
     */
    calculateRealTimePL(positions) {
        try {
            const portfolioPL = this.calculator.calculatePortfolioPL(positions);
            const strategyPL = this.calculator.calculatePLByStrategy(positions);
            const correlationPL = this.calculator.calculatePLByCorrelationGroup(positions);
            
            this.currentPL = {
                timestamp: new Date(),
                portfolio: portfolioPL,
                byStrategy: strategyPL,
                byCorrelationGroup: correlationPL
            };
            
            this.lastUpdateTime = new Date();
            
            this.emit('plCalculated', this.currentPL);
            
            return this.currentPL;
        } catch (error) {
            getLogger().error('PL_ENGINE', `Failed to calculate P&L: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Get current P&L
     */
    getCurrentPL() {
        return this.currentPL;
    }
    
    /**
     * Record daily P&L snapshot
     */
    recordDailySnapshot(date = new Date(), positions = []) {
        if (positions.length > 0) {
            const plData = this.calculateRealTimePL(positions);
            this.historicalTracker.recordDailyPL(date, plData.portfolio);
        } else if (this.currentPL) {
            this.historicalTracker.recordDailyPL(date, this.currentPL.portfolio);
        }
        
        getLogger().info('PL_ENGINE', `Daily P&L snapshot recorded for ${this.formatDate(date)}`);
    }
    
    /**
     * Record completed trade
     */
    recordCompletedTrade(trade) {
        this.historicalTracker.recordCompletedTrade(trade);
        this.emit('tradeCompleted', trade);
    }
    
    /**
     * Get historical P&L data
     */
    getHistoricalPL(type, startDate, endDate) {
        switch (type.toLowerCase()) {
            case 'daily':
                return this.historicalTracker.getDailyPL(startDate, endDate);
            case 'weekly':
                return this.historicalTracker.getWeeklyPL(new Date(startDate).getFullYear());
            case 'monthly':
                return this.historicalTracker.getMonthlyPL(new Date(startDate).getFullYear());
            case 'yearly':
                return this.historicalTracker.getYearlyPL();
            default:
                throw new Error(`Unknown P&L type: ${type}`);
        }
    }
    
    /**
     * Get trade statistics
     */
    getTradeStatistics(filters = {}) {
        return this.historicalTracker.getTradeStatistics(filters);
    }
    
    /**
     * Get Tom King specific performance metrics
     */
    getTomKingPerformance() {
        return this.historicalTracker.getTomKingStats();
    }
    
    /**
     * Generate comprehensive P&L report
     */
    generatePLReport(options = {}) {
        const includeHistorical = options.includeHistorical !== false;
        const includeTomKingMetrics = options.includeTomKingMetrics !== false;
        
        const report = {
            timestamp: new Date().toISOString(),
            current: this.currentPL,
            lastUpdateTime: this.lastUpdateTime?.toISOString()
        };
        
        if (includeHistorical) {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            
            report.historical = {
                daily30Days: this.getHistoricalPL('daily', thirtyDaysAgo, now),
                monthly: this.getHistoricalPL('monthly', new Date(now.getFullYear(), 0, 1), now),
                yearly: this.getHistoricalPL('yearly')
            };
        }
        
        if (includeTomKingMetrics) {
            report.tomKingMetrics = this.getTomKingPerformance();
        }
        
        // Overall statistics
        report.statistics = {
            overall: this.getTradeStatistics(),
            byStrategy: {
                '0DTE': this.getTradeStatistics({ strategy: '0DTE' }),
                'STRANGLE': this.getTradeStatistics({ strategy: 'STRANGLE' }),
                'LT112': this.getTradeStatistics({ strategy: 'LT112' }),
                'IPMCC': this.getTradeStatistics({ strategy: 'IPMCC' })
            }
        };
        
        return report;
    }
    
    // Helper methods
    formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.historicalInterval) {
            clearInterval(this.historicalInterval);
        }
        
        this.removeAllListeners();
        
        getLogger().info('PL_ENGINE', 'P&L Calculation Engine destroyed');
    }
}

/**
 * Friday 0DTE Tracker
 * Specialized tracking for Friday 0DTE strategy performance
 */
class Friday0DTETracker {
    constructor() {
        this.fridayTrades = [];
        this.targetWinRate = 88; // Tom King's actual 88% win rate for 0DTE
        this.streakData = {
            currentWinStreak: 0,
            longestWinStreak: 0,
            currentLossStreak: 0,
            lastLoss: null
        };
    }
    
    /**
     * Add a Friday 0DTE trade
     */
    addFridayTrade(trade) {
        if (!this.isFriday(trade.timestamp)) {
            throw new Error('Trade must be on a Friday for Friday 0DTE tracking');
        }
        
        const fridayTrade = {
            ...trade,
            week: this.getWeekOfYear(trade.timestamp),
            year: new Date(trade.timestamp).getFullYear(),
            sessionNumber: this.fridayTrades.length + 1
        };
        
        this.fridayTrades.push(fridayTrade);
        this.updateStreaks(fridayTrade);
        
        getLogger().info('FRIDAY_0DTE_TRACKER', 
            `Friday session #${fridayTrade.sessionNumber}: ${trade.ticker} - ${trade.isWinner ? 'WIN' : 'LOSS'}`
        );
        
        return this.getPerformanceSummary();
    }
    
    /**
     * Update win/loss streaks
     */
    updateStreaks(trade) {
        if (trade.isWinner) {
            this.streakData.currentWinStreak++;
            this.streakData.currentLossStreak = 0;
            this.streakData.longestWinStreak = Math.max(
                this.streakData.longestWinStreak, 
                this.streakData.currentWinStreak
            );
        } else {
            this.streakData.currentLossStreak++;
            this.streakData.currentWinStreak = 0;
            this.streakData.lastLoss = {
                date: trade.timestamp,
                ticker: trade.ticker,
                reason: trade.exitReason,
                pl: trade.realizedPL
            };
        }
    }
    
    /**
     * Get performance summary
     */
    getPerformanceSummary() {
        const totalTrades = this.fridayTrades.length;
        if (totalTrades === 0) {
            return this.getEmptySummary();
        }
        
        const winners = this.fridayTrades.filter(t => t.isWinner).length;
        const currentWinRate = (winners / totalTrades) * 100;
        const totalPL = this.fridayTrades.reduce((sum, t) => sum + (t.realizedPL || 0), 0);
        
        // Recent performance (last 8 weeks)
        const recentTrades = this.fridayTrades.slice(-8);
        const recentWinners = recentTrades.filter(t => t.isWinner).length;
        const recentWinRate = recentTrades.length > 0 ? (recentWinners / recentTrades.length) * 100 : 0;
        
        // Monthly breakdown
        const monthlyBreakdown = this.calculateMonthlyBreakdown();
        
        return {
            totalFridaySessions: totalTrades,
            winners,
            losers: totalTrades - winners,
            currentWinRate,
            targetWinRate: this.targetWinRate,
            winRateVsTarget: currentWinRate - this.targetWinRate,
            totalPL,
            avgPLPerSession: totalPL / totalTrades,
            streaks: this.streakData,
            recentPerformance: {
                sessions: recentTrades.length,
                winners: recentWinners,
                winRate: recentWinRate,
                trades: recentTrades
            },
            monthlyBreakdown,
            nextFridayDate: this.getNextFriday(),
            systemStatus: this.getSystemStatus(currentWinRate, this.streakData)
        };
    }
    
    /**
     * Calculate monthly breakdown
     */
    calculateMonthlyBreakdown() {
        const monthly = {};
        
        this.fridayTrades.forEach(trade => {
            const date = new Date(trade.timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthly[monthKey]) {
                monthly[monthKey] = {
                    month: monthKey,
                    sessions: 0,
                    winners: 0,
                    totalPL: 0
                };
            }
            
            monthly[monthKey].sessions++;
            monthly[monthKey].totalPL += trade.realizedPL || 0;
            if (trade.isWinner) monthly[monthKey].winners++;
        });
        
        return Object.values(monthly).map(data => ({
            ...data,
            winRate: data.sessions > 0 ? (data.winners / data.sessions) * 100 : 0,
            avgPL: data.sessions > 0 ? data.totalPL / data.sessions : 0
        })).sort((a, b) => a.month.localeCompare(b.month));
    }
    
    /**
     * Get system status based on performance
     */
    getSystemStatus(winRate, streaks) {
        if (winRate >= this.targetWinRate && streaks.currentLossStreak === 0) {
            return {
                status: 'EXCELLENT',
                message: 'System performing above target with no current losses',
                color: 'green'
            };
        } else if (winRate >= 85 && streaks.currentLossStreak <= 1) {
            return {
                status: 'GOOD',
                message: 'System performing well, minor variance from target',
                color: 'blue'
            };
        } else if (winRate >= 75) {
            return {
                status: 'ACCEPTABLE',
                message: 'System below target but within acceptable range',
                color: 'orange'
            };
        } else {
            return {
                status: 'NEEDS_ATTENTION',
                message: 'System significantly below target - review required',
                color: 'red'
            };
        }
    }
    
    // Helper methods
    isFriday(timestamp) {
        return new Date(timestamp).getDay() === 5;
    }
    
    getWeekOfYear(timestamp) {
        const date = new Date(timestamp);
        const start = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + start.getDay() + 1) / 7);
    }
    
    getNextFriday() {
        const now = new Date();
        const daysUntilFriday = (5 - now.getDay()) % 7;
        const nextFriday = new Date(now);
        nextFriday.setDate(now.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
        return nextFriday.toISOString().split('T')[0];
    }
    
    getEmptySummary() {
        return {
            totalFridaySessions: 0,
            winners: 0,
            losers: 0,
            currentWinRate: 0,
            targetWinRate: this.targetWinRate,
            winRateVsTarget: -this.targetWinRate,
            totalPL: 0,
            avgPLPerSession: 0,
            streaks: { currentWinStreak: 0, longestWinStreak: 0, currentLossStreak: 0, lastLoss: null },
            recentPerformance: { sessions: 0, winners: 0, winRate: 0, trades: [] },
            monthlyBreakdown: [],
            nextFridayDate: this.getNextFriday(),
            systemStatus: { status: 'NO_DATA', message: 'No Friday sessions recorded', color: 'gray' }
        };
    }
}

/**
 * Buying Power Usage Tracker
 */
class BuyingPowerTracker {
    constructor(options = {}) {
        this.targetUsage = options.targetUsage || 35; // Target 35% BP usage
        this.maxUsage = options.maxUsage || 50; // Maximum 50% BP usage
        this.accountSize = options.accountSize || 35000; // Starting account size
        this.currentUsage = 0;
        this.history = [];
    }
    
    /**
     * Update buying power usage
     */
    updateUsage(usageData) {
        const entry = {
            timestamp: new Date(),
            totalBP: usageData.totalBP,
            usedBP: usageData.usedBP,
            usagePercent: (usageData.usedBP / usageData.totalBP) * 100,
            availableBP: usageData.totalBP - usageData.usedBP,
            positionCount: usageData.positionCount || 0,
            byStrategy: usageData.byStrategy || {},
            byCorrelationGroup: usageData.byCorrelationGroup || {}
        };
        
        this.currentUsage = entry.usagePercent;
        this.history.push(entry);
        
        // Keep only last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        this.history = this.history.filter(h => h.timestamp > thirtyDaysAgo);
        
        return this.getUsageSummary();
    }
    
    /**
     * Get usage summary and recommendations
     */
    getUsageSummary() {
        const current = this.history[this.history.length - 1];
        if (!current) {
            return this.getEmptyUsageSummary();
        }
        
        const recommendations = this.generateRecommendations(current);
        const efficiency = this.calculateEfficiency();
        const riskLevel = this.assessRiskLevel(current.usagePercent);
        
        return {
            current: {
                usagePercent: current.usagePercent,
                totalBP: current.totalBP,
                usedBP: current.usedBP,
                availableBP: current.availableBP,
                positionCount: current.positionCount
            },
            targets: {
                target: this.targetUsage,
                maximum: this.maxUsage,
                vsTarget: current.usagePercent - this.targetUsage,
                vsMaximum: current.usagePercent - this.maxUsage
            },
            breakdown: {
                byStrategy: current.byStrategy,
                byCorrelationGroup: current.byCorrelationGroup
            },
            riskLevel,
            efficiency,
            recommendations,
            history: this.history.slice(-7), // Last 7 entries
            trend: this.calculateTrend()
        };
    }
    
    /**
     * Generate BP usage recommendations
     */
    generateRecommendations(current) {
        const recommendations = [];
        const usage = current.usagePercent;
        
        if (usage < this.targetUsage * 0.7) {
            recommendations.push({
                type: 'INCREASE_POSITIONS',
                priority: 'MEDIUM',
                message: `BP usage at ${usage.toFixed(1)}% - consider adding positions to reach ${this.targetUsage}% target`,
                action: 'Add new positions in uncorrelated groups'
            });
        } else if (usage > this.maxUsage) {
            recommendations.push({
                type: 'REDUCE_POSITIONS',
                priority: 'HIGH',
                message: `BP usage at ${usage.toFixed(1)}% - exceeds maximum of ${this.maxUsage}%`,
                action: 'Close or reduce existing positions immediately'
            });
        } else if (usage > this.targetUsage * 1.2) {
            recommendations.push({
                type: 'MONITOR_USAGE',
                priority: 'LOW',
                message: `BP usage at ${usage.toFixed(1)}% - approaching maximum`,
                action: 'Monitor closely, prepare to reduce if needed'
            });
        }
        
        // Check concentration in correlation groups
        for (const [group, usage] of Object.entries(current.byCorrelationGroup)) {
            if (usage > 15) { // More than 15% in one group
                recommendations.push({
                    type: 'DIVERSIFY',
                    priority: 'MEDIUM',
                    message: `${usage.toFixed(1)}% BP concentrated in correlation group ${group}`,
                    action: 'Consider diversifying across other correlation groups'
                });
            }
        }
        
        return recommendations;
    }
    
    /**
     * Calculate BP usage efficiency
     */
    calculateEfficiency() {
        if (this.history.length < 7) {
            return { score: 0, message: 'Insufficient data for efficiency calculation' };
        }
        
        const recent = this.history.slice(-7);
        const avgUsage = recent.reduce((sum, h) => sum + h.usagePercent, 0) / recent.length;
        const consistency = 100 - (this.calculateStandardDeviation(recent.map(h => h.usagePercent)) / avgUsage * 100);
        
        // Target adherence score
        const targetAdherence = Math.max(0, 100 - Math.abs(avgUsage - this.targetUsage) * 2);
        
        // Overall efficiency score
        const score = (targetAdherence * 0.7 + consistency * 0.3);
        
        let message;
        if (score >= 90) message = 'Excellent BP management';
        else if (score >= 75) message = 'Good BP management';
        else if (score >= 60) message = 'Acceptable BP management';
        else message = 'BP management needs improvement';
        
        return {
            score: Math.round(score),
            avgUsage,
            targetAdherence: Math.round(targetAdherence),
            consistency: Math.round(consistency),
            message
        };
    }
    
    /**
     * Assess risk level based on usage
     */
    assessRiskLevel(usagePercent) {
        if (usagePercent > this.maxUsage) {
            return {
                level: 'HIGH',
                message: 'BP usage exceeds maximum safe limit',
                color: 'red'
            };
        } else if (usagePercent > this.targetUsage * 1.3) {
            return {
                level: 'MEDIUM',
                message: 'BP usage above comfortable level',
                color: 'orange'
            };
        } else if (usagePercent < this.targetUsage * 0.5) {
            return {
                level: 'LOW',
                message: 'BP significantly underutilized',
                color: 'blue'
            };
        } else {
            return {
                level: 'OPTIMAL',
                message: 'BP usage within optimal range',
                color: 'green'
            };
        }
    }
    
    calculateTrend() {
        if (this.history.length < 3) return { direction: 'STABLE', change: 0 };
        
        const recent = this.history.slice(-3);
        const first = recent[0].usagePercent;
        const last = recent[recent.length - 1].usagePercent;
        const change = last - first;
        
        let direction;
        if (Math.abs(change) < 2) direction = 'STABLE';
        else if (change > 0) direction = 'INCREASING';
        else direction = 'DECREASING';
        
        return { direction, change: Math.round(change * 10) / 10 };
    }
    
    calculateStandardDeviation(values) {
        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
        const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
        return Math.sqrt(avgSquaredDiff);
    }
    
    getEmptyUsageSummary() {
        return {
            current: { usagePercent: 0, totalBP: 0, usedBP: 0, availableBP: 0, positionCount: 0 },
            targets: { target: this.targetUsage, maximum: this.maxUsage, vsTarget: -this.targetUsage, vsMaximum: -this.maxUsage },
            breakdown: { byStrategy: {}, byCorrelationGroup: {} },
            riskLevel: { level: 'UNKNOWN', message: 'No usage data available', color: 'gray' },
            efficiency: { score: 0, message: 'No efficiency data available' },
            recommendations: [],
            history: [],
            trend: { direction: 'STABLE', change: 0 }
        };
    }
}

/**
 * Phase Progression Tracker
 * Tracks progression through Tom King's 4 account phases
 */
class PhaseProgressionTracker {
    constructor(startingBalance = 35000) {
        this.startingBalance = startingBalance;
        this.currentBalance = startingBalance;
        this.phaseHistory = [];
        this.milestones = [
            { phase: 1, minBalance: 30000, maxBalance: 39999, description: 'Foundation Phase - MCL, MGC, TLT strangles, Friday 0DTE' },
            { phase: 2, minBalance: 40000, maxBalance: 59999, description: 'Expansion Phase - Add MES, MNQ, currency futures' },
            { phase: 3, minBalance: 60000, maxBalance: 74999, description: 'Upgrade Phase - Full futures, butterflies, complex spreads' },
            { phase: 4, minBalance: 75000, maxBalance: Infinity, description: 'Professional Phase - All strategies, maximum capacity' }
        ];
        
        // Now determine phase after milestones are defined
        this.currentPhase = this.determinePhase(startingBalance);
        
        // Record initial phase
        this.recordPhaseEntry(this.currentPhase, startingBalance);
    }
    
    /**
     * Update account balance and check for phase changes
     */
    updateBalance(newBalance, source = 'TRADING') {
        const oldPhase = this.currentPhase;
        const oldBalance = this.currentBalance;
        
        this.currentBalance = newBalance;
        const newPhase = this.determinePhase(newBalance);
        
        // Check for phase change
        if (newPhase !== oldPhase) {
            this.recordPhaseChange(oldPhase, newPhase, newBalance);
        }
        
        const progressData = this.getProgressData();
        
        getLogger().info('PHASE_TRACKER', 
            `Balance updated: £${newBalance.toLocaleString()} (Phase ${newPhase}) - ${source}`
        );
        
        return progressData;
    }
    
    /**
     * Determine phase based on balance - uses centralized phase utils
     */
    determinePhase(balance) {
        const { determinePhase } = require('../utils/phaseUtils');
        return determinePhase(balance).phase;
    }
    
    /**
     * Record phase entry
     */
    recordPhaseEntry(phase, balance) {
        const entry = {
            phase,
            balance,
            timestamp: new Date(),
            type: 'ENTRY',
            daysInPhase: 0
        };
        
        this.phaseHistory.push(entry);
        
        getLogger().info('PHASE_TRACKER', 
            `Entered Phase ${phase} with £${balance.toLocaleString()}`
        );
    }
    
    /**
     * Record phase change
     */
    recordPhaseChange(oldPhase, newPhase, balance) {
        // Complete the old phase
        const lastEntry = this.phaseHistory[this.phaseHistory.length - 1];
        if (lastEntry && lastEntry.phase === oldPhase) {
            const daysInPhase = Math.floor((new Date() - lastEntry.timestamp) / (1000 * 60 * 60 * 24));
            lastEntry.daysInPhase = daysInPhase;
        }
        
        // Start the new phase
        this.recordPhaseEntry(newPhase, balance);
        
        const direction = newPhase > oldPhase ? 'PROMOTION' : 'DEMOTION';
        
        getLogger().info('PHASE_TRACKER', 
            `Phase ${direction}: ${oldPhase} → ${newPhase} at £${balance.toLocaleString()}`
        );
    }
    
    /**
     * Get comprehensive progress data
     */
    getProgressData() {
        const currentMilestone = this.milestones.find(m => m.phase === this.currentPhase);
        const nextMilestone = this.milestones.find(m => m.phase === this.currentPhase + 1);
        
        // Calculate progress within current phase
        let phaseProgress = 0;
        if (currentMilestone && nextMilestone) {
            const phaseRange = nextMilestone.minBalance - currentMilestone.minBalance;
            const currentProgress = this.currentBalance - currentMilestone.minBalance;
            phaseProgress = (currentProgress / phaseRange) * 100;
        } else if (this.currentPhase === 4) {
            // Phase 4 progress toward £80k goal
            const goalBalance = 80000;
            const phase4Start = 75000;
            const progressToGoal = this.currentBalance - phase4Start;
            const totalToGoal = goalBalance - phase4Start;
            phaseProgress = Math.min(100, (progressToGoal / totalToGoal) * 100);
        }
        
        // Calculate overall progress to £80k goal
        const goalBalance = 80000;
        const totalProgress = ((this.currentBalance - this.startingBalance) / (goalBalance - this.startingBalance)) * 100;
        
        // Time in current phase
        const currentPhaseEntry = this.phaseHistory.find(h => h.phase === this.currentPhase && h.type === 'ENTRY');
        const daysInCurrentPhase = currentPhaseEntry ? 
            Math.floor((new Date() - currentPhaseEntry.timestamp) / (1000 * 60 * 60 * 24)) : 0;
        
        return {
            currentPhase: this.currentPhase,
            currentBalance: this.currentBalance,
            startingBalance: this.startingBalance,
            totalGrowth: this.currentBalance - this.startingBalance,
            totalGrowthPercent: ((this.currentBalance - this.startingBalance) / this.startingBalance) * 100,
            phaseProgress: Math.max(0, Math.min(100, phaseProgress)),
            totalProgress: Math.max(0, Math.min(100, totalProgress)),
            currentMilestone,
            nextMilestone,
            daysInCurrentPhase,
            phaseHistory: this.phaseHistory,
            availableStrategies: this.getAvailableStrategies(this.currentPhase),
            nextPhaseRequirements: this.getNextPhaseRequirements(),
            monthlyTargets: this.calculateMonthlyTargets(),
            goalProjection: this.calculateGoalProjection()
        };
    }
    
    /**
     * Get available strategies for current phase
     */
    getAvailableStrategies(phase) {
        const strategies = {
            1: ['MCL Strangles', 'MGC Strangles', 'TLT Strangles', 'Friday 0DTE', 'Basic LEAPs'],
            2: ['All Phase 1', 'MES LT112', 'MNQ Strangles', 'Currency Futures', 'Enhanced LEAPs'],
            3: ['All Phase 2', 'ES LT112', 'Butterflies', 'Complex Spreads', 'VIX Strategies'],
            4: ['All Phase 3', 'Professional Box Spreads', 'Advanced Greeks Strategies', 'Custom Spreads']
        };
        
        return strategies[phase] || strategies[1];
    }
    
    /**
     * Get requirements for next phase
     */
    getNextPhaseRequirements() {
        const nextPhase = this.currentPhase + 1;
        const nextMilestone = this.milestones.find(m => m.phase === nextPhase);
        
        if (!nextMilestone) {
            return {
                phase: 'GOAL_ACHIEVED',
                message: 'You have reached the highest phase! Continue toward £80k goal.',
                balanceNeeded: Math.max(0, 80000 - this.currentBalance)
            };
        }
        
        return {
            phase: nextPhase,
            description: nextMilestone.description,
            minBalance: nextMilestone.minBalance,
            balanceNeeded: Math.max(0, nextMilestone.minBalance - this.currentBalance),
            percentNeeded: ((nextMilestone.minBalance - this.currentBalance) / this.currentBalance) * 100
        };
    }
    
    /**
     * Calculate monthly targets to reach £80k goal
     */
    calculateMonthlyTargets() {
        const goalBalance = 80000;
        const remainingAmount = goalBalance - this.currentBalance;
        const targetMonths = 8; // Target timeframe
        const monthlyTarget = remainingAmount / targetMonths;
        const monthlyPercentTarget = (monthlyTarget / this.currentBalance) * 100;
        
        return {
            monthlyTargetAmount: monthlyTarget,
            monthlyPercentTarget: monthlyPercentTarget,
            remainingAmount,
            remainingMonths: targetMonths,
            compoundingRequired: this.calculateRequiredCompounding(targetMonths)
        };
    }
    
    /**
     * Calculate required monthly compounding rate
     */
    calculateRequiredCompounding(months) {
        const goalBalance = 80000;
        const currentBalance = this.currentBalance;
        const requiredMultiplier = goalBalance / currentBalance;
        const monthlyRate = (Math.pow(requiredMultiplier, 1/months) - 1) * 100;
        
        return {
            monthlyRate,
            achievable: monthlyRate <= 15, // 15% monthly is considered achievable with Tom King strategies
            difficulty: this.assessDifficulty(monthlyRate)
        };
    }
    
    /**
     * Assess difficulty of achieving required returns
     */
    assessDifficulty(monthlyRate) {
        if (monthlyRate <= 6) return 'EASY';
        if (monthlyRate <= 10) return 'MODERATE';
        if (monthlyRate <= 15) return 'CHALLENGING';
        return 'VERY_DIFFICULT';
    }
    
    /**
     * Calculate goal projection based on current growth rate
     */
    calculateGoalProjection() {
        if (this.phaseHistory.length < 2) {
            return { 
                projectedDate: 'Insufficient data', 
                confidence: 'LOW',
                monthsToGoal: 'Unknown'
            };
        }
        
        // Calculate average monthly growth from phase history
        const totalDays = (new Date() - this.phaseHistory[0].timestamp) / (1000 * 60 * 60 * 24);
        const totalGrowth = this.currentBalance - this.startingBalance;
        const dailyGrowthRate = totalGrowth / totalDays;
        
        const goalBalance = 80000;
        const remainingAmount = goalBalance - this.currentBalance;
        const daysToGoal = remainingAmount / dailyGrowthRate;
        const projectedDate = new Date(Date.now() + daysToGoal * 24 * 60 * 60 * 1000);
        
        return {
            projectedDate: projectedDate.toISOString().split('T')[0],
            monthsToGoal: Math.ceil(daysToGoal / 30),
            confidence: totalDays > 30 ? 'MEDIUM' : 'LOW',
            currentGrowthRate: (dailyGrowthRate * 30 / this.currentBalance) * 100, // Monthly %
            requiredGrowthRate: this.calculateMonthlyTargets().monthlyPercentTarget
        };
    }
}

/**
 * Tom King Master Tracker
 * Orchestrates all Tom King specific tracking
 */
class TomKingTracker extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            startingBalance: options.startingBalance || 35000,
            goalBalance: options.goalBalance || 80000,
            targetMonthlyIncome: options.targetMonthlyIncome || 10000,
            ...options
        };
        
        this.friday0DTE = new Friday0DTETracker();
        this.buyingPower = new BuyingPowerTracker({
            accountSize: this.options.startingBalance
        });
        this.phaseProgression = new PhaseProgressionTracker(this.options.startingBalance);
        
        // Create performance metrics instance for calculations
        this.performanceMetrics = new PerformanceMetrics();
        
        getLogger().info('TOM_KING_TRACKER', 'Tom King tracking system initialized');
    }
    
    /**
     * Update all tracking systems with new trade
     */
    updateWithTrade(trade) {
        const updates = {};
        
        // Update Friday 0DTE tracking
        if (trade.fridayODTE && !trade.isActive) {
            updates.friday0DTE = this.friday0DTE.addFridayTrade({
                ...trade,
                isWinner: (trade.realizedPL || 0) > 0
            });
        }
        
        this.emit('tradeProcessed', { trade, updates });
        return updates;
    }
    
    /**
     * Update buying power usage
     */
    updateBuyingPower(usageData) {
        const summary = this.buyingPower.updateUsage(usageData);
        this.emit('buyingPowerUpdated', summary);
        return summary;
    }
    
    /**
     * Update account balance and phase progression
     */
    updateBalance(newBalance, source = 'TRADING') {
        const progressData = this.phaseProgression.updateBalance(newBalance, source);
        this.emit('balanceUpdated', { newBalance, source, progressData });
        return progressData;
    }
    
    /**
     * Get comprehensive Tom King metrics
     */
    getComprehensiveMetrics() {
        const friday0DTEMetrics = this.friday0DTE.getPerformanceSummary();
        const buyingPowerMetrics = this.buyingPower.getUsageSummary();
        const phaseMetrics = this.phaseProgression.getProgressData();
        
        return {
            timestamp: new Date().toISOString(),
            friday0DTE: friday0DTEMetrics,
            buyingPower: buyingPowerMetrics,
            phaseProgression: phaseMetrics,
            goalProgress: this.calculateGoalProgress(phaseMetrics),
            systemHealth: this.assessSystemHealth(friday0DTEMetrics, buyingPowerMetrics, phaseMetrics),
            recommendations: this.generateRecommendations(friday0DTEMetrics, buyingPowerMetrics, phaseMetrics)
        };
    }
    
    /**
     * Calculate overall goal progress
     */
    calculateGoalProgress(phaseMetrics) {
        const goalBalance = this.options.goalBalance;
        const currentBalance = phaseMetrics.currentBalance;
        const startingBalance = this.options.startingBalance;
        
        const progressPercent = ((currentBalance - startingBalance) / (goalBalance - startingBalance)) * 100;
        const remainingAmount = goalBalance - currentBalance;
        const monthlyIncomeProgress = this.calculateMonthlyIncomeProgress();
        
        return {
            currentBalance,
            goalBalance,
            startingBalance,
            progressPercent: Math.max(0, Math.min(100, progressPercent)),
            remainingAmount,
            monthlyIncomeProgress,
            onTrackForGoal: this.assessGoalTracking(phaseMetrics),
            estimatedCompletion: phaseMetrics.goalProjection.projectedDate
        };
    }
    
    /**
     * Calculate monthly income progress toward £10k target
     * ENHANCED: Full integration with MonthlyIncomeCalculator
     */
    calculateMonthlyIncomeProgress(accountValue = null, currentPositions = [], vixLevel = 20) {
        try {
            // Get account value from metrics if not provided
            const currentAccountValue = accountValue || this.getCurrentAccountValue();
            const targetMonthlyIncome = this.options.targetMonthlyIncome || 10000;
            
            // Calculate current month income from actual data
            const currentMonthIncome = this.calculateCurrentMonthIncome();
            
            // Use MonthlyIncomeCalculator for target analysis
            const incomeRequirements = this.monthlyIncomeCalculator.calculateMonthlyIncomeRequirements(
                currentAccountValue,
                targetMonthlyIncome,
                vixLevel
            );
            
            // Calculate theta optimization
            const thetaOptimization = this.thetaOptimizationEngine.optimizePortfolioTheta(
                currentAccountValue,
                currentPositions,
                vixLevel,
                targetMonthlyIncome / 21 // Convert to daily target
            );
            
            // Progressive scaling calculation
            const scalingProgression = this.monthlyIncomeCalculator.calculateScalingProgression(
                currentAccountValue,
                100000 // Target £100k account
            );
            
            return {
                current: {
                    accountValue: currentAccountValue,
                    monthlyIncome: currentMonthIncome,
                    dailyTheta: thetaOptimization.current.totalDailyTheta,
                    phase: incomeRequirements.phase
                },
                
                targets: {
                    monthlyIncome: targetMonthlyIncome,
                    dailyTheta: targetMonthlyIncome / 21,
                    phaseTarget: incomeRequirements.monthlyTarget,
                    nextPhaseAccount: this.getNextPhaseTarget(incomeRequirements.phase)
                },
                
                progress: {
                    incomeProgressPercent: Math.min(100, (currentMonthIncome / targetMonthlyIncome) * 100),
                    thetaProgressPercent: Math.min(100, (thetaOptimization.current.totalDailyTheta / (targetMonthlyIncome / 21)) * 100),
                    accountProgressPercent: this.calculateAccountProgressPercent(currentAccountValue),
                    overallProgressPercent: this.calculateOverallProgress(currentMonthIncome, currentAccountValue, targetMonthlyIncome)
                },
                
                requirements: incomeRequirements,
                thetaOptimization,
                scalingProgression,
                
                projections: {
                    monthsToTargetIncome: this.calculateMonthsToTarget(currentMonthIncome, targetMonthlyIncome),
                    monthsToNextPhase: scalingProgression.progression.find(p => p.phase > incomeRequirements.phase)?.timeframe || 0,
                    projectedMonthlyGrowth: this.calculateProjectedGrowthRate(currentMonthIncome)
                },
                
                recommendations: this.generateIncomeRecommendations(incomeRequirements, thetaOptimization),
                
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error('PERF-METRICS', 'Error calculating monthly income progress', error);
            
            // Fallback to basic calculation
            const targetMonthlyIncome = this.options.targetMonthlyIncome || 10000;
            const currentMonthIncome = this.calculateCurrentMonthIncome();
            
            return {
                current: { monthlyIncome: currentMonthIncome },
                targets: { monthlyIncome: targetMonthlyIncome },
                progress: { incomeProgressPercent: (currentMonthIncome / targetMonthlyIncome) * 100 },
                error: error.message
            };
        }
    }

    /**
     * Calculate current month income from recent trades and positions
     */
    calculateCurrentMonthIncome() {
        try {
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();
            
            // Get current month key
            const monthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
            
            // Get P&L for current month
            const monthlyData = this.monthlyPL?.get(monthKey);
            if (monthlyData) {
                return Math.max(0, monthlyData.totalDollarPL || 0);
            }
            
            // Fallback: calculate from recent trades
            const recentTrades = this.getTradesForMonth(currentMonth, currentYear);
            const monthIncome = recentTrades.reduce((sum, trade) => sum + Math.max(0, trade.pnl || 0), 0);
            
            return monthIncome;
            
        } catch (error) {
            this.logger.warn('PERF-METRICS', 'Could not calculate current month income', error);
            return 0;
        }
    }

    /**
     * Get current account value
     */
    getCurrentAccountValue() {
        try {
            // Try to get from latest metrics
            if (this.latestMetrics && this.latestMetrics.finalCapital) {
                return this.latestMetrics.finalCapital;
            }
            
            // Try to calculate from options
            if (this.options.initialCapital) {
                const totalPnL = this.calculateTotalPnL();
                return this.options.initialCapital + totalPnL;
            }
            
            // Default to Phase 4 threshold for demonstration
            return 75000;
            
        } catch (error) {
            this.logger.warn('PERF-METRICS', 'Could not determine account value, using default', error);
            return 75000;
        }
    }

    /**
     * Calculate total P&L from all tracking data
     */
    calculateTotalPnL() {
        let totalPnL = 0;
        
        // Sum from monthly P&L tracking
        if (this.monthlyPL) {
            for (const monthData of this.monthlyPL.values()) {
                totalPnL += monthData.totalDollarPL || 0;
            }
        }
        
        return totalPnL;
    }

    /**
     * Get trades for specific month and year
     */
    getTradesForMonth(month, year) {
        // Filter trades by month and year
        if (!this.trades || this.trades.length === 0) return [];
        
        return this.trades.filter(trade => {
            if (!trade.entryTime) return false;
            const tradeDate = new Date(trade.entryTime);
            return tradeDate.getMonth() === month && tradeDate.getFullYear() === year;
        });
    }

    /**
     * Get next phase target account value
     */
    getNextPhaseTarget(currentPhase) {
        const phaseTargets = {
            1: 40000,  // Phase 1 -> Phase 2
            2: 60000,  // Phase 2 -> Phase 3  
            3: 75000,  // Phase 3 -> Phase 4
            4: 100000  // Phase 4 -> Ultimate target
        };
        
        return phaseTargets[currentPhase] || 100000;
    }

    /**
     * Calculate account progress percentage
     */
    calculateAccountProgressPercent(currentValue) {
        const startValue = 30000; // Minimum Phase 1 start
        const targetValue = 100000; // Ultimate target
        
        return Math.min(100, Math.max(0, ((currentValue - startValue) / (targetValue - startValue)) * 100));
    }

    /**
     * Calculate overall progress combining income and account growth
     */
    calculateOverallProgress(currentIncome, currentAccount, targetIncome) {
        const incomeWeight = 0.6; // 60% weight on income generation
        const accountWeight = 0.4; // 40% weight on account growth
        
        const incomeProgress = Math.min(100, (currentIncome / targetIncome) * 100);
        const accountProgress = this.calculateAccountProgressPercent(currentAccount);
        
        return (incomeProgress * incomeWeight) + (accountProgress * accountWeight);
    }

    /**
     * Calculate months to reach target income
     */
    calculateMonthsToTarget(currentIncome, targetIncome) {
        if (currentIncome <= 0) return 'Unable to estimate';
        
        // Calculate required growth rate
        const growthNeeded = targetIncome / currentIncome;
        
        // Assume 10% monthly growth (conservative for Tom King strategies)
        const monthlyGrowthRate = 1.10;
        
        if (growthNeeded <= 1) return 0; // Already at target
        
        const monthsNeeded = Math.ceil(Math.log(growthNeeded) / Math.log(monthlyGrowthRate));
        
        return monthsNeeded;
    }

    /**
     * Calculate projected monthly growth rate based on recent performance
     */
    calculateProjectedGrowthRate(currentIncome) {
        // Get recent income history
        const recentIncomes = this.getRecentMonthlyIncomes(6); // Last 6 months
        
        if (recentIncomes.length < 2) {
            return 1.05; // 5% default growth assumption
        }
        
        // Calculate month-over-month growth rates
        const growthRates = [];
        for (let i = 1; i < recentIncomes.length; i++) {
            if (recentIncomes[i-1].income > 0) {
                const growthRate = recentIncomes[i].income / recentIncomes[i-1].income;
                growthRates.push(growthRate);
            }
        }
        
        if (growthRates.length === 0) return 1.05;
        
        // Return average growth rate, capped between 0.95 and 1.20
        const avgGrowthRate = growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length;
        return Math.max(0.95, Math.min(1.20, avgGrowthRate));
    }

    /**
     * Get recent monthly incomes
     */
    getRecentMonthlyIncomes(months = 6) {
        const incomes = [];
        const currentDate = new Date();
        
        for (let i = 0; i < months; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            const monthData = this.monthlyPL?.get(monthKey);
            incomes.push({
                month: monthKey,
                income: monthData ? Math.max(0, monthData.totalDollarPL || 0) : 0
            });
        }
        
        return incomes.reverse(); // Oldest first
    }

    /**
     * Generate income-focused recommendations
     */
    generateIncomeRecommendations(incomeRequirements, thetaOptimization) {
        const recommendations = [];
        
        // Check feasibility
        if (incomeRequirements.feasibility.score < 80) {
            recommendations.push({
                type: 'FEASIBILITY',
                priority: 'HIGH',
                message: `Current feasibility score ${incomeRequirements.feasibility.score}% requires attention`,
                actions: incomeRequirements.feasibility.recommendations
            });
        }
        
        // Check BP utilization
        if (incomeRequirements.totals.bpUtilization > 35) {
            recommendations.push({
                type: 'RISK_MANAGEMENT',
                priority: 'HIGH',
                message: `BP utilization ${incomeRequirements.totals.bpUtilization}% exceeds safe limit`,
                action: 'Reduce position sizes or grow account before increasing targets'
            });
        }
        
        // Theta optimization recommendations
        if (thetaOptimization.recommendations.length > 0) {
            recommendations.push({
                type: 'THETA_OPTIMIZATION',
                priority: 'MEDIUM',
                message: 'Theta optimization opportunities identified',
                details: thetaOptimization.recommendations.slice(0, 3) // Top 3 recommendations
            });
        }
        
        // Phase progression recommendations
        if (incomeRequirements.phase < 4) {
            recommendations.push({
                type: 'PHASE_PROGRESSION',
                priority: 'LOW',
                message: `Currently in Phase ${incomeRequirements.phase}. Focus on consistent income generation to progress`,
                nextTarget: this.getNextPhaseTarget(incomeRequirements.phase)
            });
        }
        
        return recommendations;
    }
    
    /**
     * Assess if on track for goal
     */
    assessGoalTracking(phaseMetrics) {
        const requiredRate = phaseMetrics.monthlyTargets.monthlyPercentTarget;
        const currentRate = phaseMetrics.goalProjection.currentGrowthRate || 0;
        
        if (currentRate >= requiredRate) {
            return {
                status: 'ON_TRACK',
                message: 'Current growth rate meets or exceeds target',
                variance: currentRate - requiredRate
            };
        } else if (currentRate >= requiredRate * 0.8) {
            return {
                status: 'SLIGHTLY_BEHIND',
                message: 'Growth rate slightly below target but recoverable',
                variance: currentRate - requiredRate
            };
        } else {
            return {
                status: 'BEHIND_TARGET',
                message: 'Growth rate significantly below target - strategy adjustment needed',
                variance: currentRate - requiredRate
            };
        }
    }
    
    /**
     * Assess overall system health
     */
    assessSystemHealth(friday0DTE, buyingPower, phase) {
        const healthFactors = [];
        
        // Friday 0DTE health
        if (friday0DTE.totalFridaySessions > 0) {
            const fridayHealth = friday0DTE.currentWinRate >= 85 ? 'GOOD' : 
                                friday0DTE.currentWinRate >= 70 ? 'FAIR' : 'POOR';
            healthFactors.push({ factor: 'Friday 0DTE', health: fridayHealth, score: friday0DTE.currentWinRate });
        }
        
        // Buying power health
        const bpHealth = buyingPower.riskLevel.level === 'OPTIMAL' ? 'GOOD' : 
                        buyingPower.riskLevel.level === 'MEDIUM' ? 'FAIR' : 'POOR';
        healthFactors.push({ factor: 'Buying Power', health: bpHealth, score: buyingPower.efficiency.score });
        
        // Phase progression health
        const progressHealth = phase.totalProgress >= 50 ? 'GOOD' : 
                              phase.totalProgress >= 25 ? 'FAIR' : 'POOR';
        healthFactors.push({ factor: 'Goal Progress', health: progressHealth, score: phase.totalProgress });
        
        // Calculate overall health
        const scores = healthFactors.map(f => f.score);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        
        let overallHealth;
        if (avgScore >= 80) overallHealth = 'EXCELLENT';
        else if (avgScore >= 65) overallHealth = 'GOOD';
        else if (avgScore >= 50) overallHealth = 'FAIR';
        else overallHealth = 'NEEDS_IMPROVEMENT';
        
        return {
            overall: overallHealth,
            score: Math.round(avgScore),
            factors: healthFactors
        };
    }
    
    /**
     * Generate comprehensive recommendations
     */
    generateRecommendations(friday0DTE, buyingPower, phase) {
        const recommendations = [];
        
        // Friday 0DTE recommendations
        if (friday0DTE.totalFridaySessions > 0 && friday0DTE.currentWinRate < 85) {
            recommendations.push({
                category: 'Friday 0DTE',
                priority: 'HIGH',
                message: `Win rate at ${friday0DTE.currentWinRate.toFixed(1)}% - review entry criteria and timing`,
                action: 'Analyze recent losses and adjust strategy parameters'
            });
        }
        
        // Buying power recommendations
        recommendations.push(...buyingPower.recommendations);
        
        // Phase progression recommendations
        const phaseReqs = phase.nextPhaseRequirements;
        if (phaseReqs.balanceNeeded > 0 && phaseReqs.phase !== 'GOAL_ACHIEVED') {
            recommendations.push({
                category: 'Phase Progression',
                priority: 'MEDIUM',
                message: `£${phaseReqs.balanceNeeded.toLocaleString()} needed for Phase ${phaseReqs.phase}`,
                action: `Focus on consistent execution of Phase ${phase.currentPhase} strategies`
            });
        }
        
        // Goal tracking recommendations
        const goalTracking = this.assessGoalTracking(phase);
        if (goalTracking.status === 'BEHIND_TARGET') {
            recommendations.push({
                category: 'Goal Achievement',
                priority: 'HIGH',
                message: 'Current growth rate insufficient for £80k goal in 8 months',
                action: 'Consider increasing position sizes or adding strategies within risk limits'
            });
        }
        
        return recommendations.sort((a, b) => {
            const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    
    /**
     * Generate comprehensive report
     */
    generateReport() {
        return this.getComprehensiveMetrics();
    }
    
    /**
     * Generate daily report
     */
    generateDailyReport(trades, positions, balance) {
        const logger = getLogger();
        const today = new Date().toDateString();
        
        // Filter today's trades
        const todayTrades = trades.filter(t => 
            new Date(t.timestamp).toDateString() === today
        );
        
        const report = {
            date: new Date().toISOString(),
            type: 'DAILY',
            summary: {
                tradesExecuted: todayTrades.length,
                totalPnL: todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
                winRate: this.calculateWinRate(todayTrades),
                openPositions: positions.length,
                accountBalance: balance.netLiq,
                buyingPowerUsed: balance.bpUsedPercent
            },
            trades: todayTrades,
            positions: positions,
            strategies: this.performanceMetrics.calculateStrategySpecificMetrics(todayTrades),
            vixRegime: this.getCurrentVIXRegime(),
            recommendations: []  // Would need friday0DTE, buyingPower, phase objects
        };
        
        logger.info('REPORTING', 'Daily report generated', report.summary);
        return report;
    }
    
    /**
     * Generate weekly report
     */
    generateWeeklyReport(trades, dailyPnL, positions, balance) {
        const logger = getLogger();
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        // Filter week's trades
        const weekTrades = trades.filter(t => 
            new Date(t.timestamp) > oneWeekAgo
        );
        
        // Filter week's daily P&L
        const weekPnL = dailyPnL.filter(d =>
            new Date(d.date) > oneWeekAgo
        );
        
        const report = {
            date: new Date().toISOString(),
            type: 'WEEKLY',
            period: {
                start: oneWeekAgo.toISOString(),
                end: new Date().toISOString()
            },
            summary: {
                tradesExecuted: weekTrades.length,
                totalPnL: weekTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
                winRate: this.calculateWinRate(weekTrades),
                avgDailyPnL: weekPnL.length > 0 ? 
                    weekPnL.reduce((sum, d) => sum + d.pnl, 0) / weekPnL.length : 0,
                bestDay: weekPnL.length > 0 ?
                    Math.max(...weekPnL.map(d => d.pnl)) : 0,
                worstDay: weekPnL.length > 0 ?
                    Math.min(...weekPnL.map(d => d.pnl)) : 0,
                accountGrowth: balance.netLiq && weekPnL[0] ? 
                    ((balance.netLiq - weekPnL[0].capital) / weekPnL[0].capital) * 100 : 0
            },
            strategies: this.performanceMetrics.calculateStrategySpecificMetrics(weekTrades),
            dailyBreakdown: weekPnL,
            tomKingMetrics: {
                fridayZeroDTE: this.calculateFriday0DTEMetrics(weekTrades),
                longTerm112: this.calculateLongTerm112Metrics(weekTrades),
                strangles: this.calculateStrangleMetrics(weekTrades)
            },
            riskMetrics: this.performanceMetrics.calculateRiskMetrics(weekPnL, balance.netLiq),
            recommendations: this.generateWeeklyRecommendations(weekTrades, positions, balance)
        };
        
        logger.info('REPORTING', 'Weekly report generated', report.summary);
        return report;
    }
    
    /**
     * Calculate Friday 0DTE metrics
     */
    calculateFriday0DTEMetrics(trades) {
        const friday0DTE = trades.filter(t => 
            t.strategy === 'ZERO_DTE' && 
            new Date(t.timestamp).getDay() === 5
        );
        
        return {
            trades: friday0DTE.length,
            winRate: this.calculateWinRate(friday0DTE),
            totalPnL: friday0DTE.reduce((sum, t) => sum + (t.pnl || 0), 0),
            avgPnL: friday0DTE.length > 0 ? 
                friday0DTE.reduce((sum, t) => sum + (t.pnl || 0), 0) / friday0DTE.length : 0
        };
    }
    
    /**
     * Calculate Long-Term 1-1-2 metrics
     */
    calculateLongTerm112Metrics(trades) {
        const lt112 = trades.filter(t => 
            t.strategy?.includes('112') || t.strategy?.includes('1-1-2')
        );
        
        return {
            trades: lt112.length,
            winRate: this.calculateWinRate(lt112),
            totalPnL: lt112.reduce((sum, t) => sum + (t.pnl || 0), 0),
            avgHoldingDays: lt112.length > 0 ?
                lt112.reduce((sum, t) => sum + (t.holdingPeriod || 0), 0) / lt112.length : 0
        };
    }
    
    /**
     * Calculate strangle metrics
     */
    calculateStrangleMetrics(trades) {
        const strangles = trades.filter(t => 
            t.strategy?.toLowerCase().includes('strangle')
        );
        
        return {
            trades: strangles.length,
            winRate: this.calculateWinRate(strangles),
            totalPnL: strangles.reduce((sum, t) => sum + (t.pnl || 0), 0),
            avgPnL: strangles.length > 0 ?
                strangles.reduce((sum, t) => sum + (t.pnl || 0), 0) / strangles.length : 0
        };
    }
    
    /**
     * Get current VIX regime
     */
    getCurrentVIXRegime() {
        // This would connect to real VIX data
        // For now, return placeholder
        return {
            level: 'NORMAL',
            vix: 17,
            recommendation: 'Standard position sizing'
        };
    }
    
    /**
     * Generate weekly recommendations
     */
    generateWeeklyRecommendations(trades, positions, balance) {
        const recommendations = [];
        
        // Check win rate
        const winRate = this.calculateWinRate(trades);
        if (winRate < 88) {
            recommendations.push({
                type: 'STRATEGY',
                priority: 'HIGH',
                message: `Win rate ${winRate.toFixed(1)}% below Tom King's 88% target`,
                action: 'Review entry criteria and position management'
            });
        }
        
        // Check buying power
        if (balance.bpUsedPercent > 65) {
            recommendations.push({
                type: 'RISK',
                priority: 'HIGH',
                message: `Buying power usage ${balance.bpUsedPercent}% exceeds recommended 65%`,
                action: 'Consider reducing position sizes or closing profitable trades'
            });
        }
        
        // Check diversification
        const uniqueUnderlyings = new Set(positions.map(p => p.underlying));
        if (uniqueUnderlyings.size < 3) {
            recommendations.push({
                type: 'DIVERSIFICATION',
                priority: 'MEDIUM',
                message: 'Low diversification across underlyings',
                action: 'Consider adding positions in uncorrelated assets'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Calculate win rate
     */
    calculateWinRate(trades) {
        if (trades.length === 0) return 0;
        const wins = trades.filter(t => t.pnl > 0).length;
        return (wins / trades.length) * 100;
    }
    
    /**
     * Export report to file
     */
    async exportReport(report, filepath) {
        const fs = require('fs').promises;
        const logger = getLogger();
        
        try {
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            logger.info('REPORTING', `Report exported to ${filepath}`);
            return filepath;
        } catch (error) {
            logger.error('REPORTING', 'Failed to export report', error);
            throw error;
        }
    }
    
    /**
     * Schedule automated reports
     */
    scheduleAutomatedReports(api, interval = 'daily') {
        const logger = getLogger();
        
        const intervals = {
            daily: 24 * 60 * 60 * 1000,  // 24 hours
            weekly: 7 * 24 * 60 * 60 * 1000  // 7 days
        };
        
        const runReport = async () => {
            try {
                const trades = api.trades || [];
                const positions = api.positions || [];
                const balance = api.balance || {};
                
                let report;
                if (interval === 'daily') {
                    report = this.generateDailyReport(trades, positions, balance);
                } else if (interval === 'weekly') {
                    const dailyPnL = []; // Would come from tracking
                    report = this.generateWeeklyReport(trades, dailyPnL, positions, balance);
                }
                
                // Export to file
                const date = new Date().toISOString().split('T')[0];
                const filepath = `./reports/${interval}_report_${date}.json`;
                await this.exportReport(report, filepath);
                
            } catch (error) {
                logger.error('REPORTING', `Failed to generate ${interval} report`, error);
            }
        };
        
        // Run immediately
        runReport();
        
        // Schedule recurring
        return setInterval(runReport, intervals[interval]);
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        this.removeAllListeners();
        getLogger().info('TOM_KING_TRACKER', 'Tom King tracker destroyed');
    }
}

module.exports = {
    PerformanceMetrics,
    PLCalculator,
    HistoricalPLTracker,
    PLCalculationEngine,
    Friday0DTETracker,
    BuyingPowerTracker,
    PhaseProgressionTracker,
    TomKingTracker
};