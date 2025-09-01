/**
 * Pattern Analysis Engine
 * Complete pattern recognition and technical analysis for Tom King Trading Framework
 * Based on framework specifications and 2000+ lines of analysis logic
 */

const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Technical Indicators Calculator
 */
class TechnicalIndicators {
  static calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Calculate RSI
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  static calculateEMA(prices, period) {
    if (prices.length < period) return null;
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }
  
  static calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return trueRanges.slice(-period).reduce((sum, tr) => sum + tr, 0) / period;
  }
  
  static calculateVWAP(prices, volumes, highs, lows) {
    if (prices.length === 0) return null;
    
    let totalPV = 0;
    let totalVolume = 0;
    
    for (let i = 0; i < prices.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + prices[i]) / 3;
      totalPV += typicalPrice * volumes[i];
      totalVolume += volumes[i];
    }
    
    return totalVolume > 0 ? totalPV / totalVolume : prices[prices.length - 1];
  }
}

/**
 * Range Analysis Engine
 * Analyzes 5-day and 20-day ranges per framework specifications
 */
class RangeAnalyzer {
  static analyze5DayRange(marketData) {
    if (!marketData.high5d || !marketData.low5d || !marketData.currentPrice) {
      return {
        range: 0,
        position: 0.5,
        quality: 'NO_DATA'
      };
    }
    
    const range = marketData.high5d - marketData.low5d;
    const position = (marketData.currentPrice - marketData.low5d) / range;
    
    let quality = 'POOR';
    if (position >= 0.3 && position <= 0.7) {
      quality = 'EXCELLENT'; // Middle of range
    } else if (position >= 0.2 && position <= 0.8) {
      quality = 'GOOD'; // Acceptable range
    }
    
    return {
      range,
      position: Math.round(position * 100),
      quality,
      high5d: marketData.high5d,
      low5d: marketData.low5d,
      isNearHigh: position > 0.8,
      isNearLow: position < 0.2
    };
  }
  
  static analyze20DayRange(marketData) {
    if (!marketData.high20d || !marketData.low20d || !marketData.currentPrice) {
      return {
        range: 0,
        position: 0.5,
        quality: 'NO_DATA'
      };
    }
    
    const range = marketData.high20d - marketData.low20d;
    const position = (marketData.currentPrice - marketData.low20d) / range;
    
    let quality = 'POOR';
    let bias = 'NEUTRAL';
    
    if (position >= 0.4 && position <= 0.6) {
      quality = 'EXCELLENT'; // Perfect for strangles
      bias = 'NEUTRAL_OPTIMAL';
    } else if (position >= 0.3 && position <= 0.7) {
      quality = 'GOOD';
      bias = position > 0.5 ? 'SLIGHT_BULLISH' : 'SLIGHT_BEARISH';
    } else if (position > 0.8) {
      quality = 'FAIR';
      bias = 'BEARISH_REVERSION';
    } else if (position < 0.2) {
      quality = 'FAIR';
      bias = 'BULLISH_REVERSION';
    }
    
    return {
      range,
      position: Math.round(position * 100),
      quality,
      bias,
      high20d: marketData.high20d,
      low20d: marketData.low20d,
      expansionPotential: range / marketData.currentPrice * 100
    };
  }
}

/**
 * IV Analysis Engine
 */
class IVAnalyzer {
  static analyzeIVEnvironment(marketData) {
    const ivRank = marketData.ivRank || 0;
    const ivPercentile = marketData.ivPercentile || 0;
    const iv = marketData.iv || 0;
    
    let environment = 'UNKNOWN';
    let recommendation = 'HOLD';
    let quality = 'POOR';
    
    // IV Rank Analysis (0-100 scale)
    if (ivRank >= 70) {
      environment = 'HIGH_IV';
      recommendation = 'SELL_PREMIUM';
      quality = 'EXCELLENT';
    } else if (ivRank >= 50) {
      environment = 'ELEVATED_IV';
      recommendation = 'SELL_PREMIUM';
      quality = 'GOOD';
    } else if (ivRank >= 30) {
      environment = 'NORMAL_IV';
      recommendation = 'SELECTIVE_SELL';
      quality = 'FAIR';
    } else if (ivRank >= 20) {
      environment = 'LOW_IV';
      recommendation = 'BUY_PREMIUM';
      quality = 'FAIR';
    } else {
      environment = 'VERY_LOW_IV';
      recommendation = 'AVOID_SELLING';
      quality = 'POOR';
    }
    
    return {
      ivRank,
      ivPercentile,
      iv,
      environment,
      recommendation,
      quality,
      premiumRich: ivRank > 60,
      premiumCheap: ivRank < 25,
      sellSignal: ivRank >= 40,
      buySignal: ivRank <= 20
    };
  }
}

/**
 * Trend Analysis Engine
 */
class TrendAnalyzer {
  static analyzeTrend(marketData) {
    const price = marketData.currentPrice;
    const ema8 = marketData.ema8;
    const ema21 = marketData.ema21;
    const rsi = marketData.rsi;
    
    if (!price || !ema8 || !ema21) {
      return {
        direction: 'UNKNOWN',
        strength: 'UNKNOWN',
        quality: 'NO_DATA'
      };
    }
    
    let direction = 'SIDEWAYS';
    let strength = 'WEAK';
    let quality = 'FAIR';
    
    // Determine trend direction
    if (price > ema8 && ema8 > ema21) {
      direction = 'UPTREND';
    } else if (price < ema8 && ema8 < ema21) {
      direction = 'DOWNTREND';
    }
    
    // Determine trend strength
    const emaSpread = Math.abs(ema8 - ema21) / price * 100;
    if (emaSpread > 2) {
      strength = 'STRONG';
      quality = direction !== 'SIDEWAYS' ? 'EXCELLENT' : 'GOOD';
    } else if (emaSpread > 1) {
      strength = 'MODERATE';
      quality = 'GOOD';
    }
    
    // RSI confirmation
    let rsiConfirm = false;
    if (direction === 'UPTREND' && rsi && rsi > 50 && rsi < 70) {
      rsiConfirm = true;
    } else if (direction === 'DOWNTREND' && rsi && rsi < 50 && rsi > 30) {
      rsiConfirm = true;
    } else if (direction === 'SIDEWAYS' && rsi && rsi > 40 && rsi < 60) {
      rsiConfirm = true;
    }
    
    if (rsiConfirm) {
      quality = quality === 'EXCELLENT' ? 'EXCELLENT' : 'GOOD';
    }
    
    return {
      direction,
      strength,
      quality,
      emaSpread: emaSpread.toFixed(2),
      rsiConfirm,
      priceVsEMA8: ((price - ema8) / price * 100).toFixed(2),
      priceVsEMA21: ((price - ema21) / price * 100).toFixed(2)
    };
  }
}

/**
 * Pattern Quality Scorer
 * Combines all analysis factors into unified quality score
 */
class PatternQualityScorer {
  static calculateScore(marketData, phase = 1) {
    if (!marketData || !marketData.currentPrice) {
      return {
        score: 0,
        quality: 'NO_DATA',
        factors: [],
        breakdown: {}
      };
    }
    
    let score = 50; // Base score
    const factors = [];
    const breakdown = {};
    
    // Range Analysis (25 points max)
    const range5d = RangeAnalyzer.analyze5DayRange(marketData);
    const range20d = RangeAnalyzer.analyze20DayRange(marketData);
    
    let rangeScore = 0;
    if (range5d.quality === 'EXCELLENT') rangeScore += 10;
    else if (range5d.quality === 'GOOD') rangeScore += 5;
    
    if (range20d.quality === 'EXCELLENT') rangeScore += 15;
    else if (range20d.quality === 'GOOD') rangeScore += 10;
    else if (range20d.quality === 'FAIR') rangeScore += 5;
    
    score += rangeScore;
    breakdown.rangeScore = rangeScore;
    if (rangeScore > 15) factors.push('Excellent range positioning');
    else if (rangeScore > 10) factors.push('Good range setup');
    
    // IV Analysis (30 points max)
    const ivAnalysis = IVAnalyzer.analyzeIVEnvironment(marketData);
    let ivScore = 0;
    
    if (ivAnalysis.quality === 'EXCELLENT') ivScore = 30;
    else if (ivAnalysis.quality === 'GOOD') ivScore = 20;
    else if (ivAnalysis.quality === 'FAIR') ivScore = 10;
    
    score += ivScore;
    breakdown.ivScore = ivScore;
    if (ivScore >= 20) factors.push(`${ivAnalysis.environment} - ${ivAnalysis.recommendation}`);
    
    // Trend Analysis (20 points max)
    const trendAnalysis = TrendAnalyzer.analyzeTrend(marketData);
    let trendScore = 0;
    
    if (trendAnalysis.quality === 'EXCELLENT') trendScore = 20;
    else if (trendAnalysis.quality === 'GOOD') trendScore = 15;
    else if (trendAnalysis.quality === 'FAIR') trendScore = 10;
    
    score += trendScore;
    breakdown.trendScore = trendScore;
    if (trendScore >= 15) factors.push(`${trendAnalysis.direction} trend confirmed`);
    
    // Volume Analysis (10 points max)
    let volumeScore = 0;
    if (marketData.volume && marketData.volume > 0) {
      volumeScore = 10; // Basic volume presence
      factors.push('Volume data available');
    }
    score += volumeScore;
    breakdown.volumeScore = volumeScore;
    
    // Phase-specific adjustments (5 points max)
    let phaseScore = 0;
    if (phase >= 3) {
      phaseScore = 5; // Phase 3+ gets bonus for advanced strategies
      factors.push('Phase 3+ qualification bonus');
    }
    score += phaseScore;
    breakdown.phaseScore = phaseScore;
    
    // Cap at 100
    score = Math.min(100, Math.max(0, score));
    
    // Determine quality rating
    let quality = 'POOR';
    if (score >= 85) quality = 'EXCELLENT';
    else if (score >= 70) quality = 'GOOD';
    else if (score >= 55) quality = 'FAIR';
    
    return {
      score: Math.round(score),
      quality,
      factors,
      breakdown,
      range5d,
      range20d,
      ivAnalysis,
      trendAnalysis
    };
  }
}

/**
 * Strike Calculator
 * Calculates specific option strikes based on deltas and market conditions
 */
class StrikeCalculator {
  static calculate5DeltaStrikes(marketData, targetDTE = 90) {
    if (!marketData.strikes || !marketData.strikes.call90DTE || !marketData.strikes.put90DTE) {
      return {
        available: false,
        reason: 'Option chain data required'
      };
    }
    
    const callStrike = marketData.strikes.call90DTE;
    const putStrike = marketData.strikes.put90DTE;
    
    // Calculate expected credit
    const expectedCredit = (callStrike.bid + putStrike.bid).toFixed(2);
    const midCredit = ((callStrike.bid + callStrike.ask) / 2 + (putStrike.bid + putStrike.ask) / 2).toFixed(2);
    
    return {
      available: true,
      dte: marketData.strikes.dte,
      expiration: marketData.strikes.expiration,
      call: {
        strike: callStrike.strike,
        bid: callStrike.bid,
        ask: callStrike.ask,
        delta: callStrike.delta,
        iv: callStrike.iv
      },
      put: {
        strike: putStrike.strike,
        bid: putStrike.bid,
        ask: putStrike.ask,
        delta: putStrike.delta,
        iv: putStrike.iv
      },
      expectedCredit: parseFloat(expectedCredit),
      midCredit: parseFloat(midCredit),
      strangleWidth: callStrike.strike - putStrike.strike,
      breakevens: {
        upper: callStrike.strike + parseFloat(expectedCredit),
        lower: putStrike.strike - parseFloat(expectedCredit)
      }
    };
  }
  
  static calculate0DTEStrikes(marketData, direction = 'NEUTRAL') {
    if (!marketData.currentPrice) {
      return {
        available: false,
        reason: 'Current price required'
      };
    }
    
    const currentPrice = marketData.currentPrice;
    
    // Calculate strikes based on direction and Tom King's rules
    let strikes = {};
    
    switch (direction) {
      case 'BULLISH':
        // Call spread: sell ATM+30, buy ATM+60
        strikes = {
          type: 'CALL_SPREAD',
          shortStrike: Math.round((currentPrice + 30) / 5) * 5,
          longStrike: Math.round((currentPrice + 60) / 5) * 5
        };
        break;
        
      case 'BEARISH':
        // Put spread: sell ATM-30, buy ATM-60
        strikes = {
          type: 'PUT_SPREAD',
          shortStrike: Math.round((currentPrice - 30) / 5) * 5,
          longStrike: Math.round((currentPrice - 60) / 5) * 5
        };
        break;
        
      case 'NEUTRAL':
      default:
        // Iron condor: sell ATM±15, buy ATM±45
        strikes = {
          type: 'IRON_CONDOR',
          callShort: Math.round((currentPrice + 15) / 5) * 5,
          callLong: Math.round((currentPrice + 45) / 5) * 5,
          putShort: Math.round((currentPrice - 15) / 5) * 5,
          putLong: Math.round((currentPrice - 45) / 5) * 5
        };
        break;
    }
    
    return {
      available: true,
      direction,
      currentPrice,
      strikes,
      maxLoss: strikes.type === 'IRON_CONDOR' ? 30 : 30, // $30 * multiplier
      warning: '⚠️ 0DTE - High risk, requires careful timing'
    };
  }
}

/**
 * Complete Pattern Analyzer
 * Main class that orchestrates all analysis components
 */
class PatternAnalyzer {
  constructor() {
    this.lastAnalysis = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }
  
  analyzePattern(ticker, marketData, phase = 1, forceRefresh = false) {
    // Check cache first
    const cacheKey = `${ticker}_${JSON.stringify(marketData)}_${phase}`;
    const cached = this.lastAnalysis.get(cacheKey);
    
    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }
    
    // Perform comprehensive analysis
    const qualityScore = PatternQualityScorer.calculateScore(marketData, phase);
    const strikes5Delta = StrikeCalculator.calculate5DeltaStrikes(marketData);
    
    const analysis = {
      ticker,
      timestamp: new Date().toISOString(),
      phase,
      currentPrice: marketData.currentPrice,
      
      // Core analysis results
      quality: qualityScore.quality,
      score: qualityScore.score,
      factors: qualityScore.factors,
      
      // Detailed breakdown
      range5d: qualityScore.range5d,
      range20d: qualityScore.range20d,
      ivAnalysis: qualityScore.ivAnalysis,
      trendAnalysis: qualityScore.trendAnalysis,
      
      // Strike calculations
      strikes: strikes5Delta,
      
      // Trade recommendations
      recommendations: this.generateRecommendations(qualityScore, strikes5Delta, phase),
      
      // Risk assessment
      riskLevel: this.assessRisk(qualityScore, marketData),
      
      // Scoring breakdown
      breakdown: qualityScore.breakdown
    };
    
    // Cache the result
    this.lastAnalysis.set(cacheKey, {
      timestamp: Date.now(),
      result: analysis
    });
    
    return analysis;
  }
  
  generateRecommendations(qualityScore, strikes, phase) {
    const recommendations = [];
    
    if (qualityScore.score < 55) {
      recommendations.push('AVOID - Pattern quality too low');
      return recommendations;
    }
    
    // Strategy recommendations based on analysis
    if (qualityScore.ivAnalysis.sellSignal && qualityScore.score >= 70) {
      if (strikes.available) {
        recommendations.push(`STRANGLE: Sell ${strikes.put.strike}P/${strikes.call.strike}C for £${strikes.expectedCredit} credit`);
      } else {
        recommendations.push('STRANGLE: Good setup, need option chain data');
      }
    }
    
    if (qualityScore.trendAnalysis.direction !== 'SIDEWAYS' && phase >= 2) {
      recommendations.push(`DIRECTIONAL: Consider ${qualityScore.trendAnalysis.direction} bias trades`);
    }
    
    if (qualityScore.range20d.quality === 'EXCELLENT' && phase >= 3) {
      recommendations.push('BUTTERFLY: Excellent for range-bound strategies');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('MONITOR: Wait for better setup');
    }
    
    return recommendations;
  }
  
  assessRisk(qualityScore, marketData) {
    let riskLevel = 'MEDIUM';
    const factors = [];
    
    // High risk factors
    if (qualityScore.ivAnalysis && qualityScore.ivAnalysis.ivRank < 20) {
      factors.push('Low IV - poor premium collection');
      riskLevel = 'HIGH';
    }
    
    if (qualityScore.range5d && (qualityScore.range5d.isNearHigh || qualityScore.range5d.isNearLow)) {
      factors.push('Price at range extreme');
      riskLevel = 'HIGH';
    }
    
    if (qualityScore.trendAnalysis && qualityScore.trendAnalysis.strength === 'STRONG' && qualityScore.trendAnalysis.direction !== 'SIDEWAYS') {
      factors.push('Strong directional trend');
      riskLevel = riskLevel === 'HIGH' ? 'HIGH' : 'MEDIUM_HIGH';
    }
    
    // Low risk factors
    if (qualityScore.score >= 85) {
      riskLevel = 'LOW';
    } else if (qualityScore.score >= 70 && riskLevel === 'MEDIUM') {
      riskLevel = 'MEDIUM_LOW';
    }
    
    return {
      level: riskLevel,
      factors,
      score: qualityScore.score
    };
  }
  
  // Batch analyze multiple tickers
  analyzeMultiple(tickerDataMap, phase = 1) {
    const results = {};
    
    for (const [ticker, marketData] of Object.entries(tickerDataMap)) {
      try {
        results[ticker] = this.analyzePattern(ticker, marketData, phase);
      } catch (error) {
        results[ticker] = {
          ticker,
          error: error.message,
          quality: 'ERROR',
          score: 0
        };
      }
    }
    
    return results;
  }
  
  // Get best patterns sorted by quality
  getBestPatterns(analysisResults, minScore = 70) {
    return Object.values(analysisResults)
      .filter(result => result.score >= minScore && !result.error)
      .sort((a, b) => b.score - a.score);
  }
  
  // Clear analysis cache
  clearCache() {
    this.lastAnalysis.clear();
    if (DEBUG) console.log('📊 Pattern analysis cache cleared');
  }
  
  // Alias for analyzePattern to maintain compatibility
  analyzeMarket(marketData, phase = 1) {
    // Convert marketData to expected format if needed
    const ticker = marketData.symbol || 'UNKNOWN';
    
    // Ensure marketData has required fields for analyzePattern
    const formattedData = {
      currentPrice: marketData.current || marketData.currentPrice,
      openPrice: marketData.open || marketData.openPrice,
      highPrice: marketData.high || marketData.highPrice,
      lowPrice: marketData.low || marketData.lowPrice,
      volume: marketData.volume,
      atr: marketData.atr,
      rsi: marketData.rsi,
      ema20: marketData.ema20,
      ema50: marketData.ema50,
      vwap: marketData.vwap,
      iv: marketData.iv,
      ivRank: marketData.ivRank,
      ivPercentile: marketData.ivPercentile,
      bid: marketData.bid,
      ask: marketData.ask
    };
    
    // Call analyzePattern with formatted data
    const result = this.analyzePattern(ticker, formattedData, phase);
    
    // Add additional fields for compatibility
    return {
      ...result,
      trend: result.trendAnalysis?.direction || 'NEUTRAL',
      strength: result.trendAnalysis?.strength || 'MODERATE',
      signal: result.quality
    };
  }
}

/**
 * Specialized analyzers for specific strategies
 */
class StrategyAnalyzers {
  // Friday 0DTE Analysis
  static analyze0DTE(marketData, currentTime) {
    const hour = new Date(currentTime).getHours();
    const minutes = new Date(currentTime).getMinutes();
    const timeScore = hour * 60 + minutes;
    
    // Before 10:30 AM EST - blocked
    if (timeScore < 630) { // 10:30 AM = 10*60 + 30 = 630
      return {
        allowed: false,
        reason: 'Before 10:30 AM restriction',
        nextWindow: '10:30 AM EST'
      };
    }
    
    // Analyze ES movement
    const dayMove = ((marketData.currentPrice - marketData.openPrice) / marketData.openPrice) * 100;
    let direction = 'NEUTRAL';
    
    if (Math.abs(dayMove) >= 0.8) {
      direction = dayMove > 0 ? 'BULLISH' : 'BEARISH';
    }
    
    const strikes = StrikeCalculator.calculate0DTEStrikes(marketData, direction);
    
    return {
      allowed: true,
      direction,
      dayMove: dayMove.toFixed(2),
      strikes,
      timeRemaining: this.calculateTimeToClose(currentTime),
      riskLevel: Math.abs(dayMove) > 1.5 ? 'HIGH' : 'MEDIUM'
    };
  }
  
  // LT112 Analysis (Long Term 112 DTE)
  static analyzeLT112(marketData) {
    if (!marketData.strikes || !marketData.strikes.call90DTE) {
      return {
        available: false,
        reason: 'Need 90+ DTE option chain'
      };
    }
    
    // Tom King's LT112 specifications
    const analysis = {
      available: true,
      structure: 'SHORT_STRANGLE_WITH_HEDGE',
      targetDTE: 112,
      entryWeek: this.calculateEntryWeek(),
      strikes: StrikeCalculator.calculate5DeltaStrikes(marketData, 112),
      hedgeRequired: true,
      hedgeStrike: marketData.currentPrice * 0.85, // 15% OTM put hedge
      bpRequirement: '6% for ES, 3% for MES',
      maxPositions: this.getMaxLT112Positions()
    };
    
    return analysis;
  }
  
  static calculateEntryWeek() {
    const now = new Date();
    const firstWednesday = this.getFirstWednesday(now);
    const weeksSinceFirst = Math.floor((now - firstWednesday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.min(weeksSinceFirst, 4); // Max 4 weeks
  }
  
  static getFirstWednesday(date) {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstOfMonth.getDay();
    const daysToWednesday = (3 - dayOfWeek + 7) % 7;
    return new Date(firstOfMonth.getTime() + daysToWednesday * 24 * 60 * 60 * 1000);
  }
  
  static getMaxLT112Positions() {
    // Based on account phase from framework
    return {
      phase1: 0, // Not available
      phase2: 4, // MES only
      phase3: 1, // ES upgrade
      phase4: 3  // Multiple ES positions
    };
  }
  
  static calculateTimeToClose(currentTime) {
    const now = new Date(currentTime);
    const close = new Date(now);
    close.setHours(16, 0, 0, 0); // 4:00 PM EST close
    
    if (now > close) {
      close.setDate(close.getDate() + 1); // Next day
    }
    
    const msRemaining = close - now;
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hoursRemaining}h ${minutesRemaining}m`;
  }
}

// Export all classes and functions
module.exports = {
  PatternAnalyzer,
  PatternQualityScorer,
  TechnicalIndicators,
  RangeAnalyzer,
  IVAnalyzer,
  TrendAnalyzer,
  StrikeCalculator,
  StrategyAnalyzers
};