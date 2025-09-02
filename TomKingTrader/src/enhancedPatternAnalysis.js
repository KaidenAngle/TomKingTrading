/**
 * Enhanced Pattern Analysis Engine
 * Advanced technical analysis and pattern recognition for Tom King Trading Framework
 * Includes 20+ technical indicators, chart patterns, and strategy-specific analysis
 */

const fs = require('fs');
const path = require('path');

const DEBUG = process.env.NODE_ENV !== 'production';

/**
 * Advanced Technical Indicators Calculator
 * Implements 20+ professional-grade technical indicators
 */
class AdvancedTechnicalIndicators {
  
  // Moving Averages Family
  static calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((sum, price) => sum + price, 0) / period;
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

  static calculateWMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    const weights = Array.from({length: period}, (_, i) => i + 1);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    
    return slice.reduce((sum, price, i) => sum + price * weights[i], 0) / weightSum;
  }

  static calculateHMA(prices, period) {
    if (prices.length < period) return null;
    
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    
    const wma1 = this.calculateWMA(prices, halfPeriod);
    const wma2 = this.calculateWMA(prices, period);
    const rawHMA = 2 * wma1 - wma2;
    
    // Create array with rawHMA values for final WMA calculation
    const hmaArray = [rawHMA];
    return this.calculateWMA(hmaArray, Math.min(sqrtPeriod, hmaArray.length));
  }

  // Oscillators
  static calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = [];
    let losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    if (gains.length < period) return null;
    
    let avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  static calculateStochastic(highs, lows, closes, period = 14, smoothK = 3, smoothD = 3) {
    if (highs.length < period) return null;
    
    const kValues = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const periodHigh = Math.max(...highs.slice(i - period + 1, i + 1));
      const periodLow = Math.min(...lows.slice(i - period + 1, i + 1));
      const k = ((closes[i] - periodLow) / (periodHigh - periodLow)) * 100;
      kValues.push(k);
    }
    
    const smoothedK = this.calculateSMA(kValues, smoothK);
    const dValue = smoothedK ? this.calculateSMA([smoothedK], smoothD) : null;
    
    return {
      k: smoothedK,
      d: dValue,
      signal: smoothedK > 80 ? 'OVERBOUGHT' : smoothedK < 20 ? 'OVERSOLD' : 'NEUTRAL'
    };
  }

  static calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return null;
    
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    if (!fastEMA || !slowEMA) return null;
    
    const macdLine = fastEMA - slowEMA;
    const signalLine = this.calculateEMA([macdLine], signalPeriod);
    const histogram = macdLine - (signalLine || 0);
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram,
      crossover: macdLine > signalLine ? 'BULLISH' : 'BEARISH'
    };
  }

  static calculateWilliamsR(highs, lows, closes, period = 14) {
    if (highs.length < period) return null;
    
    const periodHigh = Math.max(...highs.slice(-period));
    const periodLow = Math.min(...lows.slice(-period));
    const currentClose = closes[closes.length - 1];
    
    const williamsR = ((periodHigh - currentClose) / (periodHigh - periodLow)) * -100;
    
    return {
      value: williamsR,
      signal: williamsR > -20 ? 'OVERBOUGHT' : williamsR < -80 ? 'OVERSOLD' : 'NEUTRAL'
    };
  }

  static calculateCCI(highs, lows, closes, period = 20) {
    if (highs.length < period) return null;
    
    const typicalPrices = [];
    for (let i = 0; i < highs.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    
    const smaTP = this.calculateSMA(typicalPrices, period);
    if (!smaTP) return null;
    
    const currentTP = typicalPrices[typicalPrices.length - 1];
    let meanDeviation = 0;
    
    const periodTPs = typicalPrices.slice(-period);
    for (const tp of periodTPs) {
      meanDeviation += Math.abs(tp - smaTP);
    }
    meanDeviation = meanDeviation / period;
    
    const cci = (currentTP - smaTP) / (0.015 * meanDeviation);
    
    return {
      value: cci,
      signal: cci > 100 ? 'OVERBOUGHT' : cci < -100 ? 'OVERSOLD' : 'NEUTRAL'
    };
  }

  // Volatility Indicators
  static calculateATR(highs, lows, closes, period = 14) {
    if (highs.length < period + 1) return null;
    
    const trueRanges = [];
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  static calculateBollingerBands(prices, period = 20, multiplier = 2) {
    if (prices.length < period) return null;
    
    const sma = this.calculateSMA(prices, period);
    if (!sma) return null;
    
    const periodPrices = prices.slice(-period);
    const variance = periodPrices.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    const currentPrice = prices[prices.length - 1];
    const upperBand = sma + (multiplier * stdDev);
    const lowerBand = sma - (multiplier * stdDev);
    const bandwidthPct = ((upperBand - lowerBand) / sma) * 100;
    
    return {
      upper: upperBand,
      middle: sma,
      lower: lowerBand,
      bandwidth: bandwidthPct,
      position: ((currentPrice - lowerBand) / (upperBand - lowerBand)) * 100,
      squeeze: bandwidthPct < 10,
      breakout: currentPrice > upperBand || currentPrice < lowerBand
    };
  }

  static calculateKeltnerChannels(highs, lows, closes, period = 20, multiplier = 2) {
    if (highs.length < period) return null;
    
    const typicalPrices = [];
    for (let i = 0; i < highs.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    
    const ema = this.calculateEMA(typicalPrices, period);
    const atr = this.calculateATR(highs, lows, closes, period);
    
    if (!ema || !atr) return null;
    
    return {
      upper: ema + (multiplier * atr),
      middle: ema,
      lower: ema - (multiplier * atr),
      atr: atr
    };
  }

  // Volume Indicators
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

  static calculateOBV(closes, volumes) {
    if (closes.length !== volumes.length || closes.length < 2) return null;
    
    let obv = volumes[0];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }
    
    return obv;
  }

  static calculateMFI(highs, lows, closes, volumes, period = 14) {
    if (highs.length < period + 1) return null;
    
    const typicalPrices = [];
    const rawMoneyFlows = [];
    
    for (let i = 0; i < highs.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(tp);
      rawMoneyFlows.push(tp * volumes[i]);
    }
    
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let i = Math.max(1, typicalPrices.length - period); i < typicalPrices.length; i++) {
      if (typicalPrices[i] > typicalPrices[i - 1]) {
        positiveFlow += rawMoneyFlows[i];
      } else if (typicalPrices[i] < typicalPrices[i - 1]) {
        negativeFlow += rawMoneyFlows[i];
      }
    }
    
    if (negativeFlow === 0) return 100;
    
    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
  }

  // Tom King Specific Indicators
  static calculateVIXRegime(vixLevel) {
    if (!vixLevel) return 'UNKNOWN';
    
    if (vixLevel < 12) return 'VERY_LOW';
    if (vixLevel < 16) return 'LOW';
    if (vixLevel < 20) return 'NORMAL';
    if (vixLevel < 30) return 'ELEVATED';
    return 'HIGH';
  }

  static calculateIVRank(currentIV, ivHistory) {
    if (!ivHistory || ivHistory.length < 252) return null; // Need at least 1 year
    
    const sortedIV = [...ivHistory].sort((a, b) => a - b);
    let rank = 0;
    
    for (const historicalIV of sortedIV) {
      if (currentIV > historicalIV) rank++;
    }
    
    return (rank / ivHistory.length) * 100;
  }

  static calculateDayOfWeekBias(priceHistory, dayOfWeek) {
    // Friday bias calculation for 0DTE strategies
    const fridayReturns = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const date = new Date(priceHistory[i].date);
      if (date.getDay() === dayOfWeek) {
        const return_ = (priceHistory[i].close - priceHistory[i].open) / priceHistory[i].open;
        fridayReturns.push(return_);
      }
    }
    
    if (fridayReturns.length === 0) return null;
    
    const avgReturn = fridayReturns.reduce((sum, ret) => sum + ret, 0) / fridayReturns.length;
    const winRate = fridayReturns.filter(ret => ret > 0).length / fridayReturns.length;
    
    return {
      averageReturn: avgReturn * 100,
      winRate: winRate * 100,
      totalTrades: fridayReturns.length,
      bias: avgReturn > 0.001 ? 'BULLISH' : avgReturn < -0.001 ? 'BEARISH' : 'NEUTRAL'
    };
  }
}

/**
 * Support and Resistance Level Detector
 */
class SupportResistanceDetector {
  static detectLevels(highs, lows, closes, lookback = 20, minTouches = 2) {
    const levels = [];
    
    // Find pivot highs and lows
    const pivotHighs = this.findPivotHighs(highs, lookback);
    const pivotLows = this.findPivotLows(lows, lookback);
    
    // Cluster similar levels
    const allLevels = [...pivotHighs, ...pivotLows];
    const clusters = this.clusterLevels(allLevels, closes[closes.length - 1] * 0.01); // 1% clustering
    
    // Filter levels by touch count
    for (const cluster of clusters) {
      const touchCount = this.countTouches(cluster.level, highs, lows, closes[closes.length - 1] * 0.005);
      
      if (touchCount >= minTouches) {
        levels.push({
          level: cluster.level,
          type: cluster.type,
          strength: touchCount,
          recent: cluster.recent,
          distance: Math.abs(closes[closes.length - 1] - cluster.level)
        });
      }
    }
    
    // Sort by strength and distance
    return levels.sort((a, b) => b.strength - a.strength || a.distance - b.distance);
  }

  static findPivotHighs(highs, lookback) {
    const pivots = [];
    
    for (let i = lookback; i < highs.length - lookback; i++) {
      let isPivot = true;
      
      // Check if this is a local maximum
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && highs[j] >= highs[i]) {
          isPivot = false;
          break;
        }
      }
      
      if (isPivot) {
        pivots.push({
          level: highs[i],
          type: 'RESISTANCE',
          index: i
        });
      }
    }
    
    return pivots;
  }

  static findPivotLows(lows, lookback) {
    const pivots = [];
    
    for (let i = lookback; i < lows.length - lookback; i++) {
      let isPivot = true;
      
      // Check if this is a local minimum
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && lows[j] <= lows[i]) {
          isPivot = false;
          break;
        }
      }
      
      if (isPivot) {
        pivots.push({
          level: lows[i],
          type: 'SUPPORT',
          index: i
        });
      }
    }
    
    return pivots;
  }

  static clusterLevels(levels, tolerance) {
    const clusters = [];
    const used = new Set();
    
    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;
      
      const cluster = {
        level: levels[i].level,
        type: levels[i].type,
        count: 1,
        recent: levels[i].index
      };
      
      used.add(i);
      
      // Find similar levels
      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;
        
        if (Math.abs(levels[i].level - levels[j].level) <= tolerance) {
          cluster.level = (cluster.level * cluster.count + levels[j].level) / (cluster.count + 1);
          cluster.count++;
          cluster.recent = Math.max(cluster.recent, levels[j].index);
          used.add(j);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }

  static countTouches(level, highs, lows, tolerance) {
    let touches = 0;
    
    for (let i = 0; i < highs.length; i++) {
      if (Math.abs(highs[i] - level) <= tolerance || Math.abs(lows[i] - level) <= tolerance) {
        touches++;
      }
    }
    
    return touches;
  }
}

/**
 * Volume Profile Analyzer
 */
class VolumeProfileAnalyzer {
  static analyzeVolumeProfile(prices, volumes, bins = 20) {
    if (prices.length !== volumes.length) return null;
    
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const binSize = priceRange / bins;
    const profile = [];
    
    // Initialize bins
    for (let i = 0; i < bins; i++) {
      profile.push({
        priceLevel: Math.min(...prices) + (i * binSize),
        volume: 0,
        trades: 0
      });
    }
    
    // Distribute volume across price levels
    for (let i = 0; i < prices.length; i++) {
      const binIndex = Math.min(bins - 1, Math.floor((prices[i] - Math.min(...prices)) / binSize));
      profile[binIndex].volume += volumes[i];
      profile[binIndex].trades++;
    }
    
    // Find key levels
    const sortedByVolume = [...profile].sort((a, b) => b.volume - a.volume);
    const poc = sortedByVolume[0]; // Point of Control
    const vah = this.findValueAreaHigh(profile, 0.70); // Value Area High
    const val = this.findValueAreaLow(profile, 0.70); // Value Area Low
    
    return {
      poc: poc.priceLevel,
      vah: vah,
      val: val,
      profile: profile,
      totalVolume: volumes.reduce((sum, vol) => sum + vol, 0)
    };
  }

  static findValueAreaHigh(profile, valueAreaPercent) {
    const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
    const targetVolume = totalVolume * valueAreaPercent;
    
    // Start from POC and expand
    const pocIndex = profile.reduce((maxIndex, bin, index) => 
      bin.volume > profile[maxIndex].volume ? index : maxIndex, 0);
    
    let currentVolume = profile[pocIndex].volume;
    let high = pocIndex;
    let low = pocIndex;
    
    while (currentVolume < targetVolume && (high < profile.length - 1 || low > 0)) {
      const highVolume = high < profile.length - 1 ? profile[high + 1].volume : 0;
      const lowVolume = low > 0 ? profile[low - 1].volume : 0;
      
      if (highVolume >= lowVolume) {
        high++;
        currentVolume += highVolume;
      } else {
        low--;
        currentVolume += lowVolume;
      }
    }
    
    return profile[high].priceLevel;
  }

  static findValueAreaLow(profile, valueAreaPercent) {
    const totalVolume = profile.reduce((sum, bin) => sum + bin.volume, 0);
    const targetVolume = totalVolume * valueAreaPercent;
    
    const pocIndex = profile.reduce((maxIndex, bin, index) => 
      bin.volume > profile[maxIndex].volume ? index : maxIndex, 0);
    
    let currentVolume = profile[pocIndex].volume;
    let high = pocIndex;
    let low = pocIndex;
    
    while (currentVolume < targetVolume && (high < profile.length - 1 || low > 0)) {
      const highVolume = high < profile.length - 1 ? profile[high + 1].volume : 0;
      const lowVolume = low > 0 ? profile[low - 1].volume : 0;
      
      if (highVolume >= lowVolume) {
        high++;
        currentVolume += highVolume;
      } else {
        low--;
        currentVolume += lowVolume;
      }
    }
    
    return profile[low].priceLevel;
  }
}

/**
 * Chart Pattern Recognition Engine
 */
class ChartPatternRecognizer {
  
  static recognizePatterns(highs, lows, closes, lookback = 50) {
    const patterns = [];
    
    // Head and Shoulders
    const headShoulders = this.detectHeadAndShoulders(highs, lows, closes, lookback);
    if (headShoulders) patterns.push(headShoulders);
    
    // Triangles
    const triangle = this.detectTriangles(highs, lows, lookback);
    if (triangle) patterns.push(triangle);
    
    // Flags and Pennants
    const flag = this.detectFlags(highs, lows, closes, lookback);
    if (flag) patterns.push(flag);
    
    // Double Top/Bottom
    const double = this.detectDoubleTops(highs, lows, lookback);
    if (double) patterns.push(double);
    
    // Wedges
    const wedge = this.detectWedges(highs, lows, lookback);
    if (wedge) patterns.push(wedge);
    
    return patterns;
  }

  static detectHeadAndShoulders(highs, lows, closes, lookback) {
    if (highs.length < lookback) return null;
    
    const recentHighs = highs.slice(-lookback);
    const pivots = this.findSignificantPivots(recentHighs, 5);
    
    if (pivots.highs.length < 3) return null;
    
    const [leftShoulder, head, rightShoulder] = pivots.highs.slice(-3);
    
    // Check pattern validity
    const isValidPattern = 
      head.value > leftShoulder.value && 
      head.value > rightShoulder.value &&
      Math.abs(leftShoulder.value - rightShoulder.value) / leftShoulder.value < 0.03; // Within 3%
    
    if (isValidPattern) {
      const neckline = Math.min(
        lows[leftShoulder.index + 1],
        lows[rightShoulder.index - 1]
      );
      
      const currentPrice = closes[closes.length - 1];
      const breakout = currentPrice < neckline;
      
      return {
        type: 'HEAD_AND_SHOULDERS',
        confidence: this.calculatePatternConfidence(0.75, breakout ? 0.9 : 0.6),
        neckline: neckline,
        target: neckline - (head.value - neckline),
        breakout: breakout,
        timeframe: lookback
      };
    }
    
    return null;
  }

  static detectTriangles(highs, lows, lookback) {
    if (highs.length < lookback) return null;
    
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    
    // Find trend lines
    const highTrend = this.fitTrendLine(recentHighs);
    const lowTrend = this.fitTrendLine(recentLows);
    
    if (!highTrend || !lowTrend) return null;
    
    const convergence = Math.abs(highTrend.slope + lowTrend.slope);
    
    if (convergence < 0.1) { // Lines are converging
      let triangleType = 'SYMMETRICAL';
      
      if (Math.abs(highTrend.slope) < 0.01) triangleType = 'ASCENDING';
      else if (Math.abs(lowTrend.slope) < 0.01) triangleType = 'DESCENDING';
      
      return {
        type: `${triangleType}_TRIANGLE`,
        confidence: this.calculatePatternConfidence(0.7, convergence < 0.05 ? 0.8 : 0.6),
        breakoutLevel: triangleType === 'ASCENDING' ? Math.max(...recentHighs) : 
                      triangleType === 'DESCENDING' ? Math.min(...recentLows) :
                      (Math.max(...recentHighs) + Math.min(...recentLows)) / 2,
        timeframe: lookback
      };
    }
    
    return null;
  }

  static detectFlags(highs, lows, closes, lookback) {
    if (closes.length < lookback) return null;
    
    const recentCloses = closes.slice(-lookback);
    const trendStrength = this.calculateTrendStrength(recentCloses);
    
    if (Math.abs(trendStrength) < 0.5) return null; // Need strong prior trend
    
    const consolidationPeriod = Math.floor(lookback * 0.3);
    const flagPortion = recentCloses.slice(-consolidationPeriod);
    
    const flagTrend = this.fitTrendLine(flagPortion);
    if (!flagTrend) return null;
    
    // Flag should trend against the prior move
    const isValidFlag = (trendStrength > 0 && flagTrend.slope < 0) ||
                       (trendStrength < 0 && flagTrend.slope > 0);
    
    if (isValidFlag) {
      return {
        type: trendStrength > 0 ? 'BULL_FLAG' : 'BEAR_FLAG',
        confidence: this.calculatePatternConfidence(0.8, Math.abs(flagTrend.slope) > 0.01 ? 0.7 : 0.5),
        priorTrend: trendStrength > 0 ? 'BULLISH' : 'BEARISH',
        consolidationSlope: flagTrend.slope,
        timeframe: lookback
      };
    }
    
    return null;
  }

  static detectDoubleTops(highs, lows, lookback) {
    if (highs.length < lookback) return null;
    
    const pivots = this.findSignificantPivots(highs.slice(-lookback), 5);
    if (pivots.highs.length < 2) return null;
    
    const [peak1, peak2] = pivots.highs.slice(-2);
    const priceDiff = Math.abs(peak1.value - peak2.value) / peak1.value;
    
    if (priceDiff < 0.02) { // Within 2%
      const valleyIndex = Math.floor((peak1.index + peak2.index) / 2);
      const valleyPrice = Math.min(...lows.slice(peak1.index, peak2.index + 1));
      
      return {
        type: 'DOUBLE_TOP',
        confidence: this.calculatePatternConfidence(0.75, priceDiff < 0.01 ? 0.8 : 0.6),
        peaks: [peak1.value, peak2.value],
        support: valleyPrice,
        target: valleyPrice - (peak1.value - valleyPrice),
        timeframe: lookback
      };
    }
    
    return null;
  }

  static detectWedges(highs, lows, lookback) {
    if (highs.length < lookback) return null;
    
    const highTrend = this.fitTrendLine(highs.slice(-lookback));
    const lowTrend = this.fitTrendLine(lows.slice(-lookback));
    
    if (!highTrend || !lowTrend) return null;
    
    // Both trend lines should be in same direction for wedge
    const sameDirection = (highTrend.slope > 0 && lowTrend.slope > 0) ||
                         (highTrend.slope < 0 && lowTrend.slope < 0);
    
    if (sameDirection) {
      const wedgeType = highTrend.slope > 0 ? 'RISING_WEDGE' : 'FALLING_WEDGE';
      
      return {
        type: wedgeType,
        confidence: this.calculatePatternConfidence(0.7, Math.abs(highTrend.slope - lowTrend.slope) < 0.05 ? 0.8 : 0.6),
        bias: wedgeType === 'RISING_WEDGE' ? 'BEARISH' : 'BULLISH',
        timeframe: lookback
      };
    }
    
    return null;
  }

  static findSignificantPivots(data, minDistance) {
    const highs = [];
    const lows = [];
    
    for (let i = minDistance; i < data.length - minDistance; i++) {
      let isHigh = true;
      let isLow = true;
      
      for (let j = i - minDistance; j <= i + minDistance; j++) {
        if (j !== i) {
          if (data[j] >= data[i]) isHigh = false;
          if (data[j] <= data[i]) isLow = false;
        }
      }
      
      if (isHigh) highs.push({ index: i, value: data[i] });
      if (isLow) lows.push({ index: i, value: data[i] });
    }
    
    return { highs, lows };
  }

  static fitTrendLine(data) {
    if (data.length < 5) return null;
    
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, i) => sum + (val * i), 0);
    const sumX2 = data.reduce((sum, val, i) => sum + (i * i), 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    return { slope, intercept };
  }

  static calculateTrendStrength(data) {
    if (data.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < data.length; i++) {
      returns.push((data[i] - data[i - 1]) / data[i - 1]);
    }
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    return avgReturn * Math.sqrt(returns.length); // Annualized trend strength
  }

  static calculatePatternConfidence(baseConfidence, adjustmentFactor) {
    return Math.min(1.0, baseConfidence * adjustmentFactor);
  }
}

/**
 * Multi-Timeframe Analysis Engine
 */
class MultiTimeframeAnalyzer {
  static analyzeMultipleTimeframes(marketData, timeframes = ['1m', '5m', '15m', '1h', '4h', '1d']) {
    const analysis = {};
    
    for (const timeframe of timeframes) {
      if (marketData[timeframe]) {
        analysis[timeframe] = this.analyzeSingleTimeframe(marketData[timeframe], timeframe);
      }
    }
    
    // Calculate consensus
    analysis.consensus = this.calculateConsensus(analysis);
    
    return analysis;
  }

  static analyzeSingleTimeframe(data, timeframe) {
    const { highs, lows, closes, volumes } = data;
    
    // Technical indicators
    const rsi = AdvancedTechnicalIndicators.calculateRSI(closes);
    const macd = AdvancedTechnicalIndicators.calculateMACD(closes);
    const bb = AdvancedTechnicalIndicators.calculateBollingerBands(closes);
    const stoch = AdvancedTechnicalIndicators.calculateStochastic(highs, lows, closes);
    
    // Support/Resistance
    const srLevels = SupportResistanceDetector.detectLevels(highs, lows, closes);
    
    // Pattern recognition
    const patterns = ChartPatternRecognizer.recognizePatterns(highs, lows, closes);
    
    // Trend analysis
    const ema20 = AdvancedTechnicalIndicators.calculateEMA(closes, 20);
    const ema50 = AdvancedTechnicalIndicators.calculateEMA(closes, 50);
    const currentPrice = closes[closes.length - 1];
    
    let trend = 'NEUTRAL';
    if (ema20 && ema50) {
      if (currentPrice > ema20 && ema20 > ema50) trend = 'BULLISH';
      else if (currentPrice < ema20 && ema20 < ema50) trend = 'BEARISH';
    }
    
    return {
      timeframe,
      trend,
      rsi: rsi ? Math.round(rsi) : null,
      macd: macd,
      bollinger: bb,
      stochastic: stoch,
      supportResistance: srLevels.slice(0, 5), // Top 5 levels
      patterns: patterns,
      currentPrice,
      strength: this.calculateTimeframeStrength(data)
    };
  }

  static calculateTimeframeStrength(data) {
    // Combine multiple factors to determine timeframe strength
    let strength = 0;
    
    if (data.volumes && data.volumes.length > 0) {
      const avgVolume = data.volumes.reduce((sum, vol) => sum + vol, 0) / data.volumes.length;
      const recentVolume = data.volumes[data.volumes.length - 1];
      if (recentVolume > avgVolume * 1.5) strength += 0.3;
    }
    
    // Add more strength calculations based on volatility, range, etc.
    return Math.min(1.0, strength);
  }

  static calculateConsensus(timeframeAnalysis) {
    const trends = Object.values(timeframeAnalysis)
      .filter(analysis => analysis.trend)
      .map(analysis => analysis.trend);
    
    if (trends.length === 0) return { trend: 'UNKNOWN', confidence: 0 };
    
    const trendCounts = trends.reduce((counts, trend) => {
      counts[trend] = (counts[trend] || 0) + 1;
      return counts;
    }, {});
    
    const dominantTrend = Object.keys(trendCounts).reduce((a, b) => 
      trendCounts[a] > trendCounts[b] ? a : b
    );
    
    const confidence = trendCounts[dominantTrend] / trends.length;
    
    return {
      trend: dominantTrend,
      confidence: confidence,
      agreement: confidence >= 0.7 ? 'HIGH' : confidence >= 0.5 ? 'MEDIUM' : 'LOW'
    };
  }
}

/**
 * Tom King Strategy-Specific Pattern Detectors
 */
class TomKingPatternDetectors {
  
  // Strangle Setup Pattern Detection
  static detectStrangleSetup(marketData) {
    const analysis = {
      suitable: false,
      confidence: 0,
      reasons: [],
      quality: 'POOR'
    };

    // High IV requirement
    const ivRank = marketData.ivRank || 0;
    if (ivRank >= 40) {
      analysis.reasons.push(`IV Rank ${ivRank}% - Premium rich`);
      analysis.confidence += 0.3;
    } else {
      analysis.reasons.push(`IV Rank ${ivRank}% too low - Need 40%+`);
      return analysis;
    }

    // Range-bound requirement
    const price = marketData.currentPrice;
    const high20d = marketData.high20d;
    const low20d = marketData.low20d;
    
    if (high20d && low20d) {
      const position = (price - low20d) / (high20d - low20d);
      if (position >= 0.3 && position <= 0.7) {
        analysis.reasons.push(`Price at ${Math.round(position * 100)}% of 20-day range - Optimal`);
        analysis.confidence += 0.4;
      } else if (position >= 0.2 && position <= 0.8) {
        analysis.reasons.push(`Price at ${Math.round(position * 100)}% of 20-day range - Acceptable`);
        analysis.confidence += 0.2;
      } else {
        analysis.reasons.push(`Price at extreme of range - ${Math.round(position * 100)}%`);
        analysis.confidence -= 0.1;
      }
    }

    // Support/Resistance levels
    const srLevels = SupportResistanceDetector.detectLevels(
      marketData.highs || [],
      marketData.lows || [],
      marketData.closes || []
    );
    
    const nearestLevels = srLevels.filter(level => 
      Math.abs(level.level - price) / price < 0.05
    );
    
    if (nearestLevels.length >= 2) {
      analysis.reasons.push(`Strong S/R levels nearby - Enhanced probability`);
      analysis.confidence += 0.2;
    }

    // Time to expiration check (45-90 DTE optimal)
    const dte = marketData.dte || 0;
    if (dte >= 45 && dte <= 90) {
      analysis.reasons.push(`${dte} DTE - Optimal time decay window`);
      analysis.confidence += 0.1;
    } else {
      analysis.reasons.push(`${dte} DTE - Suboptimal timing`);
    }

    analysis.suitable = analysis.confidence >= 0.6;
    
    if (analysis.confidence >= 0.8) analysis.quality = 'EXCELLENT';
    else if (analysis.confidence >= 0.7) analysis.quality = 'GOOD';
    else if (analysis.confidence >= 0.6) analysis.quality = 'FAIR';

    return analysis;
  }

  // 0DTE Friday Pattern Detection
  static detect0DTEFridayPattern(marketData, currentTime) {
    const analysis = {
      suitable: false,
      confidence: 0,
      reasons: [],
      direction: 'NEUTRAL',
      quality: 'POOR'
    };

    // Time restriction check
    const time = new Date(currentTime);
    const hour = time.getHours();
    const minutes = time.getMinutes();
    const timeScore = hour * 60 + minutes;

    if (timeScore < 630) { // Before 10:30 AM EST
      analysis.reasons.push('Before 10:30 AM - Trading restricted');
      return analysis;
    }

    analysis.reasons.push('After 10:30 AM - Trading allowed');
    analysis.confidence += 0.2;

    // Opening range analysis
    const openPrice = marketData.openPrice || marketData.open;
    const currentPrice = marketData.currentPrice || marketData.close;
    const dayMove = ((currentPrice - openPrice) / openPrice) * 100;

    analysis.reasons.push(`Day move: ${dayMove.toFixed(2)}%`);

    // Direction bias based on movement
    if (Math.abs(dayMove) >= 0.8) {
      analysis.direction = dayMove > 0 ? 'BULLISH' : 'BEARISH';
      analysis.reasons.push(`Strong ${analysis.direction} bias detected`);
      analysis.confidence += 0.3;
    } else {
      analysis.direction = 'NEUTRAL';
      analysis.reasons.push('Neutral bias - Range-bound day');
      analysis.confidence += 0.2;
    }

    // Volume confirmation
    const volume = marketData.volume || 0;
    const avgVolume = marketData.avgVolume || volume;
    
    if (volume > avgVolume * 1.2) {
      analysis.reasons.push('Above-average volume - Good participation');
      analysis.confidence += 0.2;
    }

    // VIX regime consideration
    const vix = marketData.vix || 0;
    const vixRegime = AdvancedTechnicalIndicators.calculateVIXRegime(vix);
    
    if (vixRegime === 'HIGH' || vixRegime === 'ELEVATED') {
      analysis.reasons.push(`${vixRegime} VIX - Increased premium available`);
      analysis.confidence += 0.2;
    } else if (vixRegime === 'VERY_LOW') {
      analysis.reasons.push('Very low VIX - Limited premium collection');
      analysis.confidence -= 0.1;
    }

    // Time remaining factor
    const timeRemaining = this.calculateTimeToClose(currentTime);
    const hoursLeft = parseFloat(timeRemaining.split('h')[0]);
    
    if (hoursLeft >= 2) {
      analysis.reasons.push(`${timeRemaining} until close - Sufficient time`);
      analysis.confidence += 0.1;
    } else {
      analysis.reasons.push(`${timeRemaining} until close - Limited time`);
      analysis.confidence -= 0.1;
    }

    analysis.suitable = analysis.confidence >= 0.6;
    
    if (analysis.confidence >= 0.8) analysis.quality = 'EXCELLENT';
    else if (analysis.confidence >= 0.7) analysis.quality = 'GOOD';
    else if (analysis.confidence >= 0.6) analysis.quality = 'FAIR';

    return analysis;
  }

  // LT112 Pattern Detection
  static detectLT112Pattern(marketData) {
    const analysis = {
      suitable: false,
      confidence: 0,
      reasons: [],
      quality: 'POOR'
    };

    // DTE requirement (90-120 optimal)
    const dte = marketData.dte || 0;
    if (dte >= 90 && dte <= 120) {
      analysis.reasons.push(`${dte} DTE - Perfect for LT112`);
      analysis.confidence += 0.3;
    } else if (dte >= 80 && dte <= 130) {
      analysis.reasons.push(`${dte} DTE - Acceptable for LT112`);
      analysis.confidence += 0.2;
    } else {
      analysis.reasons.push(`${dte} DTE - Outside optimal range`);
      return analysis;
    }

    // Trend strength analysis for momentum component
    const closes = marketData.closes || [];
    if (closes.length >= 20) {
      const ema20 = AdvancedTechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = AdvancedTechnicalIndicators.calculateEMA(closes, 50);
      const currentPrice = closes[closes.length - 1];

      if (ema20 && ema50) {
        const trendStrength = Math.abs(ema20 - ema50) / currentPrice;
        
        if (trendStrength > 0.02) {
          analysis.reasons.push('Strong trend detected - Good for momentum hedge');
          analysis.confidence += 0.2;
        } else {
          analysis.reasons.push('Sideways market - Neutral for LT112');
          analysis.confidence += 0.1;
        }
      }
    }

    // IV environment check
    const ivRank = marketData.ivRank || 0;
    if (ivRank >= 30) {
      analysis.reasons.push(`IV Rank ${ivRank}% - Good premium environment`);
      analysis.confidence += 0.2;
    } else {
      analysis.reasons.push(`IV Rank ${ivRank}% - Low premium environment`);
      analysis.confidence -= 0.1;
    }

    // Entry timing (first 4 weeks of month)
    const entryWeek = this.calculateEntryWeek();
    if (entryWeek <= 4) {
      analysis.reasons.push(`Week ${entryWeek} entry - Within window`);
      analysis.confidence += 0.2;
    } else {
      analysis.reasons.push('Outside monthly entry window');
      analysis.confidence -= 0.2;
    }

    // Volatility expansion potential
    const atr = marketData.atr || 0;
    const atrPct = (atr / marketData.currentPrice) * 100;
    
    if (atrPct > 1.5) {
      analysis.reasons.push('High volatility environment - Good for strangles');
      analysis.confidence += 0.1;
    }

    analysis.suitable = analysis.confidence >= 0.6;
    
    if (analysis.confidence >= 0.8) analysis.quality = 'EXCELLENT';
    else if (analysis.confidence >= 0.7) analysis.quality = 'GOOD';
    else if (analysis.confidence >= 0.6) analysis.quality = 'FAIR';

    return analysis;
  }

  // IPMCC Pattern Detection (In-Place Married Call Cov)
  static detectIPMCCPattern(marketData) {
    const analysis = {
      suitable: false,
      confidence: 0,
      reasons: [],
      quality: 'POOR'
    };

    // Bullish momentum requirement
    const closes = marketData.closes || [];
    if (closes.length >= 10) {
      const recentTrend = (closes[closes.length - 1] - closes[closes.length - 10]) / closes[closes.length - 10];
      
      if (recentTrend > 0.05) {
        analysis.reasons.push('Strong bullish momentum - Excellent for IPMCC');
        analysis.confidence += 0.4;
      } else if (recentTrend > 0.02) {
        analysis.reasons.push('Moderate bullish momentum - Good for IPMCC');
        analysis.confidence += 0.2;
      } else {
        analysis.reasons.push('Insufficient bullish momentum');
        return analysis;
      }
    }

    // RSI confirmation (not overbought)
    const rsi = AdvancedTechnicalIndicators.calculateRSI(closes);
    if (rsi && rsi < 70) {
      analysis.reasons.push(`RSI ${Math.round(rsi)} - Not overbought`);
      analysis.confidence += 0.2;
    } else if (rsi) {
      analysis.reasons.push(`RSI ${Math.round(rsi)} - Overbought condition`);
      analysis.confidence -= 0.1;
    }

    // Relative strength vs market
    if (marketData.spyData && closes.length >= 20) {
      const stockReturn = (closes[closes.length - 1] - closes[closes.length - 20]) / closes[closes.length - 20];
      const spyReturn = (marketData.spyData.closes[marketData.spyData.closes.length - 1] - 
                        marketData.spyData.closes[marketData.spyData.closes.length - 20]) / 
                       marketData.spyData.closes[marketData.spyData.closes.length - 20];
      
      if (stockReturn > spyReturn * 1.1) {
        analysis.reasons.push('Outperforming market - Strong relative strength');
        analysis.confidence += 0.2;
      }
    }

    // Call option availability and pricing
    if (marketData.calls && marketData.calls.length > 0) {
      const nearCall = marketData.calls.find(call => call.delta && call.delta > 0.7);
      if (nearCall) {
        analysis.reasons.push('Deep ITM calls available for long leg');
        analysis.confidence += 0.1;
      }
    }

    analysis.suitable = analysis.confidence >= 0.6;
    
    if (analysis.confidence >= 0.8) analysis.quality = 'EXCELLENT';
    else if (analysis.confidence >= 0.7) analysis.quality = 'GOOD';
    else if (analysis.confidence >= 0.6) analysis.quality = 'FAIR';

    return analysis;
  }

  // VIX Spike Pattern Detection
  static detectVIXSpikePattern(marketData) {
    const analysis = {
      suitable: false,
      confidence: 0,
      reasons: [],
      quality: 'POOR'
    };

    const vix = marketData.vix || 0;
    const vixHistory = marketData.vixHistory || [];
    
    // Current VIX level
    if (vix >= 30) {
      analysis.reasons.push(`VIX ${vix} - High fear level`);
      analysis.confidence += 0.3;
    } else if (vix >= 25) {
      analysis.reasons.push(`VIX ${vix} - Elevated fear level`);
      analysis.confidence += 0.2;
    } else {
      analysis.reasons.push(`VIX ${vix} - No fear spike detected`);
      return analysis;
    }

    // VIX spike magnitude
    if (vixHistory.length >= 5) {
      const avgVix = vixHistory.slice(-5).reduce((sum, val) => sum + val, 0) / 5;
      const spikeSize = (vix - avgVix) / avgVix;
      
      if (spikeSize > 0.5) {
        analysis.reasons.push(`VIX spike ${(spikeSize * 100).toFixed(1)}% above recent average`);
        analysis.confidence += 0.3;
      } else if (spikeSize > 0.2) {
        analysis.reasons.push(`VIX elevated ${(spikeSize * 100).toFixed(1)}% above recent average`);
        analysis.confidence += 0.2;
      }
    }

    // Market oversold condition
    const closes = marketData.closes || [];
    const rsi = AdvancedTechnicalIndicators.calculateRSI(closes);
    
    if (rsi && rsi < 30) {
      analysis.reasons.push(`RSI ${Math.round(rsi)} - Oversold condition`);
      analysis.confidence += 0.2;
    }

    // Put/Call ratio if available
    if (marketData.putCallRatio && marketData.putCallRatio > 1.2) {
      analysis.reasons.push(`P/C Ratio ${marketData.putCallRatio.toFixed(2)} - Extreme bearish sentiment`);
      analysis.confidence += 0.2;
    }

    analysis.suitable = analysis.confidence >= 0.6;
    
    if (analysis.confidence >= 0.8) analysis.quality = 'EXCELLENT';
    else if (analysis.confidence >= 0.7) analysis.quality = 'GOOD';
    else if (analysis.confidence >= 0.6) analysis.quality = 'FAIR';

    return analysis;
  }

  static calculateEntryWeek() {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfWeek = firstOfMonth.getDay();
    const daysToWednesday = (3 - dayOfWeek + 7) % 7;
    const firstWednesday = new Date(firstOfMonth.getTime() + daysToWednesday * 24 * 60 * 60 * 1000);
    
    const weeksSinceFirst = Math.floor((now - firstWednesday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, Math.min(weeksSinceFirst, 4));
  }

  static calculateTimeToClose(currentTime) {
    const now = new Date(currentTime);
    const close = new Date(now);
    close.setHours(16, 0, 0, 0); // 4:00 PM EST
    
    if (now > close) {
      close.setDate(close.getDate() + 1);
    }
    
    const msRemaining = close - now;
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hoursRemaining}h ${minutesRemaining}m`;
  }
}

/**
 * Enhanced Confidence Scoring System
 */
class ConfidenceScorer {
  constructor() {
    this.historicalData = this.loadHistoricalData();
  }

  calculateConfidence(pattern, marketData, strategy) {
    const baseScore = this.getBaseConfidence(pattern.type);
    const marketRegimeScore = this.assessMarketRegime(marketData);
    const timeFactorScore = this.assessTimingFactors(marketData, strategy);
    const correlationScore = this.assessCorrelation(marketData, strategy);
    const historicalScore = this.assessHistoricalSuccess(pattern.type, marketData.symbol);
    
    const weights = {
      base: 0.3,
      marketRegime: 0.25,
      timing: 0.2,
      correlation: 0.15,
      historical: 0.1
    };
    
    const weightedScore = (
      baseScore * weights.base +
      marketRegimeScore * weights.marketRegime +
      timeFactorScore * weights.timing +
      correlationScore * weights.correlation +
      historicalScore * weights.historical
    );
    
    return {
      total: Math.min(100, Math.max(0, Math.round(weightedScore * 100))),
      breakdown: {
        base: Math.round(baseScore * 100),
        marketRegime: Math.round(marketRegimeScore * 100),
        timing: Math.round(timeFactorScore * 100),
        correlation: Math.round(correlationScore * 100),
        historical: Math.round(historicalScore * 100)
      }
    };
  }

  getBaseConfidence(patternType) {
    const baseConfidences = {
      'STRANGLE_SETUP': 0.75,
      '0DTE_FRIDAY': 0.80,
      'LT112': 0.70,
      'IPMCC': 0.65,
      'VIX_SPIKE': 0.85,
      'HEAD_AND_SHOULDERS': 0.70,
      'BULL_FLAG': 0.75,
      'BEAR_FLAG': 0.75,
      'TRIANGLE': 0.65,
      'DOUBLE_TOP': 0.70
    };
    
    return baseConfidences[patternType] || 0.5;
  }

  assessMarketRegime(marketData) {
    let score = 0.5;
    
    // VIX regime assessment
    const vix = marketData.vix || 20;
    if (vix >= 25 && vix <= 35) {
      score += 0.2; // Optimal premium selling environment
    } else if (vix > 35) {
      score += 0.1; // High but potentially unstable
    } else if (vix < 15) {
      score -= 0.2; // Low premium environment
    }
    
    // Trend consistency
    const closes = marketData.closes || [];
    if (closes.length >= 20) {
      const ema20 = AdvancedTechnicalIndicators.calculateEMA(closes, 20);
      const ema50 = AdvancedTechnicalIndicators.calculateEMA(closes, 50);
      
      if (ema20 && ema50) {
        const trendConsistency = Math.abs(ema20 - ema50) / marketData.currentPrice;
        if (trendConsistency < 0.02) {
          score += 0.1; // Consolidating - good for range strategies
        }
      }
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  assessTimingFactors(marketData, strategy) {
    let score = 0.5;
    
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    
    // Day of week factors
    if (strategy === '0DTE_FRIDAY' && dayOfWeek === 5) {
      score += 0.3;
    } else if (strategy === 'LT112' && dayOfWeek === 3) { // Wednesday entries
      score += 0.2;
    }
    
    // Time of day factors
    if (hour >= 9 && hour <= 11) {
      score += 0.1; // Market open volatility
    } else if (hour >= 14 && hour <= 16) {
      score += 0.1; // Afternoon session
    }
    
    // Month/quarter effects
    const month = now.getMonth();
    if ([2, 5, 8, 11].includes(month)) { // Quarterly months
      score += 0.1;
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  assessCorrelation(marketData, strategy) {
    let score = 0.5;
    
    // Sector correlation
    if (marketData.sector) {
      const sectorVolatility = this.getSectorVolatility(marketData.sector);
      if (sectorVolatility > 0.02) {
        score += 0.2;
      }
    }
    
    // Market correlation
    if (marketData.beta && Math.abs(marketData.beta) < 1.2) {
      score += 0.1; // Lower correlation with market
    }
    
    return Math.min(1.0, Math.max(0.0, score));
  }

  assessHistoricalSuccess(patternType, symbol) {
    const historicalRecord = this.getHistoricalSuccess(patternType, symbol);
    return historicalRecord ? historicalRecord.successRate : 0.5;
  }

  getSectorVolatility(sector) {
    // Placeholder - would calculate from real sector data
    const sectorVolatilities = {
      'TECHNOLOGY': 0.025,
      'FINANCIAL': 0.020,
      'HEALTHCARE': 0.018,
      'ENERGY': 0.035,
      'RETAIL': 0.030
    };
    
    return sectorVolatilities[sector] || 0.020;
  }

  getHistoricalSuccess(patternType, symbol) {
    // Placeholder for historical backtesting data
    return {
      successRate: 0.65,
      trades: 100,
      avgReturn: 0.15
    };
  }

  loadHistoricalData() {
    try {
      // Try to load from historical data manager if available
      if (typeof require !== 'undefined') {
        try {
          const HistoricalDataManager = require('./historicalDataManager');
          const dataManager = new HistoricalDataManager();
          return dataManager.loadCachedData() || this.generateSampleData();
        } catch (moduleError) {
          console.warn('Historical data manager not available:', moduleError.message);
        }
      }
      
      // Fallback to sample data generation
      return this.generateSampleData();
    } catch (error) {
      console.error('Error loading historical data:', error);
      return this.generateSampleData();
    }
  }

  generateSampleData() {
    // Generate sample historical data for common symbols
    const symbols = ['ES', 'SPY', 'QQQ', 'CL', 'GC', 'TLT', 'IWM'];
    const data = {};
    
    symbols.forEach(symbol => {
      const basePrice = this.getBasePrice(symbol);
      const history = [];
      let currentPrice = basePrice;
      
      // Generate 252 days of sample data (1 trading year)
      for (let i = 0; i < 252; i++) {
        const change = (Math.random() - 0.5) * 0.04; // +/- 2% daily change
        currentPrice *= (1 + change);
        
        const high = currentPrice * (1 + Math.random() * 0.015);
        const low = currentPrice * (1 - Math.random() * 0.015);
        const volume = Math.floor(1000000 * (0.5 + Math.random()));
        
        history.push({
          date: new Date(Date.now() - (251 - i) * 24 * 60 * 60 * 1000),
          open: currentPrice * (1 + (Math.random() - 0.5) * 0.01),
          high: high,
          low: low,
          close: currentPrice,
          volume: volume
        });
      }
      
      data[symbol] = history;
    });
    
    return data;
  }

  getBasePrice(symbol) {
    const basePrices = {
      'ES': 4500,
      'SPY': 450,
      'QQQ': 350,
      'CL': 70,
      'GC': 2000,
      'TLT': 100,
      'IWM': 200
    };
    return basePrices[symbol] || 100;
  }
}

/**
 * Backtesting Engine
 */
class BacktestingEngine {
  constructor() {
    this.results = [];
  }

  backtest(strategy, historicalData, parameters = {}) {
    const results = {
      strategy: strategy,
      parameters: parameters,
      trades: [],
      performance: {},
      startDate: null,
      endDate: null
    };

    if (!historicalData || historicalData.length < 30) {
      return { error: 'Insufficient historical data' };
    }

    results.startDate = historicalData[0].date;
    results.endDate = historicalData[historicalData.length - 1].date;

    // Simulate trades
    for (let i = 30; i < historicalData.length - 30; i++) {
      const currentData = historicalData[i];
      const signal = this.generateSignal(strategy, historicalData.slice(i - 30, i + 1));
      
      if (signal.action === 'ENTER') {
        const trade = this.simulateTrade(strategy, currentData, historicalData.slice(i, i + 30));
        if (trade) {
          results.trades.push(trade);
        }
      }
    }

    // Calculate performance metrics
    results.performance = this.calculatePerformanceMetrics(results.trades);
    
    return results;
  }

  generateSignal(strategy, data) {
    // Simplified signal generation - would use full pattern analysis
    const closes = data.map(d => d.close);
    const rsi = AdvancedTechnicalIndicators.calculateRSI(closes);
    
    switch (strategy) {
      case 'STRANGLE':
        const ivRank = data[data.length - 1].ivRank || 0;
        return {
          action: ivRank > 40 && rsi > 40 && rsi < 60 ? 'ENTER' : 'HOLD',
          confidence: ivRank / 100
        };
        
      case '0DTE':
        const dayOfWeek = new Date(data[data.length - 1].date).getDay();
        return {
          action: dayOfWeek === 5 && rsi > 45 && rsi < 55 ? 'ENTER' : 'HOLD',
          confidence: 0.7
        };
        
      default:
        return { action: 'HOLD', confidence: 0 };
    }
  }

  simulateTrade(strategy, entryData, futureData) {
    // Simplified trade simulation
    const entryPrice = entryData.close;
    const maxProfit = 0.5; // 50% profit target
    const maxLoss = 2.0; // 200% loss limit (2x credit received)
    
    let exitReason = 'TIME_DECAY';
    let exitPrice = entryPrice;
    let exitDate = futureData[futureData.length - 1].date;
    
    // Check for early exit conditions
    for (let i = 1; i < futureData.length; i++) {
      const currentPrice = futureData[i].close;
      const priceChange = (currentPrice - entryPrice) / entryPrice;
      
      // Profit target hit
      if (Math.abs(priceChange) < maxProfit / 100) {
        exitReason = 'PROFIT_TARGET';
        exitPrice = currentPrice;
        exitDate = futureData[i].date;
        break;
      }
      
      // Loss limit hit
      if (Math.abs(priceChange) > maxLoss / 100) {
        exitReason = 'STOP_LOSS';
        exitPrice = currentPrice;
        exitDate = futureData[i].date;
        break;
      }
    }
    
    const pnl = strategy === 'STRANGLE' ? 
      this.calculateStranglePnL(entryPrice, exitPrice) :
      (exitPrice - entryPrice);
    
    return {
      entryDate: entryData.date,
      exitDate: exitDate,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      pnl: pnl,
      exitReason: exitReason,
      daysHeld: Math.floor((new Date(exitDate) - new Date(entryData.date)) / (1000 * 60 * 60 * 24))
    };
  }

  calculateStranglePnL(entryPrice, exitPrice) {
    // Simplified strangle P&L calculation
    const credit = entryPrice * 0.02; // 2% credit typical
    const priceMove = Math.abs(exitPrice - entryPrice) / entryPrice;
    
    if (priceMove < 0.05) { // Within 5% range
      return credit * 0.5; // 50% profit
    } else {
      return credit - (priceMove * entryPrice); // Loss scenario
    }
  }

  calculatePerformanceMetrics(trades) {
    if (trades.length === 0) {
      return { error: 'No trades to analyze' };
    }

    const totalPnL = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winningTrades = trades.filter(trade => trade.pnl > 0);
    const losingTrades = trades.filter(trade => trade.pnl < 0);
    
    const winRate = (winningTrades.length / trades.length) * 100;
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, trade) => sum + Math.abs(trade.pnl), 0) / losingTrades.length : 0;
    
    const profitFactor = avgLoss > 0 ? (avgWin * winningTrades.length) / (avgLoss * losingTrades.length) : 0;
    
    return {
      totalTrades: trades.length,
      winRate: Math.round(winRate),
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      maxDrawdown: this.calculateMaxDrawdown(trades),
      sharpeRatio: this.calculateSharpeRatio(trades)
    };
  }

  calculateMaxDrawdown(trades) {
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnL = 0;
    
    for (const trade of trades) {
      runningPnL += trade.pnl;
      
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      
      const drawdown = (peak - runningPnL) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return Math.round(maxDrawdown * 100);
  }

  calculateSharpeRatio(trades) {
    if (trades.length < 2) return 0;
    
    const returns = trades.map(trade => trade.pnl);
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? Math.round((avgReturn / stdDev) * 100) / 100 : 0;
  }
}

/**
 * Enhanced Pattern Analyzer - Main Class
 */
class EnhancedPatternAnalyzer {
  constructor() {
    this.confidenceScorer = new ConfidenceScorer();
    this.backtester = new BacktestingEngine();
    this.cache = new Map();
  }

  analyzeEnhanced(ticker, marketData, strategy = 'AUTO', options = {}) {
    const cacheKey = `${ticker}_${JSON.stringify(marketData)}_${strategy}`;
    
    if (this.cache.has(cacheKey) && !options.forceRefresh) {
      return this.cache.get(cacheKey);
    }

    const analysis = {
      ticker,
      timestamp: new Date().toISOString(),
      strategy,
      
      // Technical Analysis
      technicalIndicators: this.calculateAllIndicators(marketData),
      
      // Support/Resistance
      supportResistance: SupportResistanceDetector.detectLevels(
        marketData.highs || [],
        marketData.lows || [],
        marketData.closes || []
      ),
      
      // Volume Profile
      volumeProfile: VolumeProfileAnalyzer.analyzeVolumeProfile(
        marketData.closes || [],
        marketData.volumes || []
      ),
      
      // Chart Patterns
      chartPatterns: ChartPatternRecognizer.recognizePatterns(
        marketData.highs || [],
        marketData.lows || [],
        marketData.closes || []
      ),
      
      // Multi-timeframe Analysis
      multiTimeframe: MultiTimeframeAnalyzer.analyzeMultipleTimeframes(marketData),
      
      // Tom King Specific Patterns
      tomKingPatterns: this.analyzeTomKingPatterns(marketData, strategy),
      
      // Overall Assessment
      overallAssessment: {}
    };

    // Calculate overall confidence and recommendations
    analysis.overallAssessment = this.generateOverallAssessment(analysis, marketData, strategy);
    
    // Cache the result
    this.cache.set(cacheKey, analysis);
    
    return analysis;
  }

  calculateAllIndicators(marketData) {
    const closes = marketData.closes || [];
    const highs = marketData.highs || [];
    const lows = marketData.lows || [];
    const volumes = marketData.volumes || [];

    if (closes.length < 20) {
      return { error: 'Insufficient data for technical analysis' };
    }

    return {
      // Moving Averages
      sma20: AdvancedTechnicalIndicators.calculateSMA(closes, 20),
      sma50: AdvancedTechnicalIndicators.calculateSMA(closes, 50),
      ema8: AdvancedTechnicalIndicators.calculateEMA(closes, 8),
      ema20: AdvancedTechnicalIndicators.calculateEMA(closes, 20),
      ema50: AdvancedTechnicalIndicators.calculateEMA(closes, 50),
      wma20: AdvancedTechnicalIndicators.calculateWMA(closes, 20),
      hma20: AdvancedTechnicalIndicators.calculateHMA(closes, 20),
      
      // Oscillators
      rsi: AdvancedTechnicalIndicators.calculateRSI(closes, 14),
      stochastic: AdvancedTechnicalIndicators.calculateStochastic(highs, lows, closes),
      macd: AdvancedTechnicalIndicators.calculateMACD(closes),
      williamsR: AdvancedTechnicalIndicators.calculateWilliamsR(highs, lows, closes),
      cci: AdvancedTechnicalIndicators.calculateCCI(highs, lows, closes),
      
      // Volatility
      atr: AdvancedTechnicalIndicators.calculateATR(highs, lows, closes),
      bollingerBands: AdvancedTechnicalIndicators.calculateBollingerBands(closes),
      keltnerChannels: AdvancedTechnicalIndicators.calculateKeltnerChannels(highs, lows, closes),
      
      // Volume
      vwap: volumes.length > 0 ? AdvancedTechnicalIndicators.calculateVWAP(closes, volumes, highs, lows) : null,
      obv: volumes.length > 0 ? AdvancedTechnicalIndicators.calculateOBV(closes, volumes) : null,
      mfi: volumes.length > 0 ? AdvancedTechnicalIndicators.calculateMFI(highs, lows, closes, volumes) : null,
      
      // Tom King Specific
      vixRegime: AdvancedTechnicalIndicators.calculateVIXRegime(marketData.vix),
      ivRank: AdvancedTechnicalIndicators.calculateIVRank(marketData.iv, marketData.ivHistory || [])
    };
  }

  analyzeTomKingPatterns(marketData, strategy) {
    const patterns = {};
    
    // Analyze all Tom King patterns regardless of strategy
    patterns.strangleSetup = TomKingPatternDetectors.detectStrangleSetup(marketData);
    patterns.fridayPattern = TomKingPatternDetectors.detect0DTEFridayPattern(marketData, new Date());
    patterns.lt112Pattern = TomKingPatternDetectors.detectLT112Pattern(marketData);
    patterns.ipmccPattern = TomKingPatternDetectors.detectIPMCCPattern(marketData);
    patterns.vixSpike = TomKingPatternDetectors.detectVIXSpikePattern(marketData);
    
    // Add confidence scores for each pattern
    for (const [patternName, pattern] of Object.entries(patterns)) {
      if (pattern && pattern.suitable) {
        pattern.confidenceScore = this.confidenceScorer.calculateConfidence(
          { type: patternName.toUpperCase() },
          marketData,
          strategy
        );
      }
    }
    
    return patterns;
  }

  generateOverallAssessment(analysis, marketData, strategy) {
    const assessment = {
      recommendation: 'HOLD',
      confidence: 0,
      primaryPattern: null,
      keyFactors: [],
      riskLevel: 'MEDIUM',
      expectedReturn: 0,
      timeframe: '30-45 days',
      entryPrice: marketData.currentPrice,
      stopLoss: 0,
      profitTarget: 0
    };

    // Find the best pattern
    let bestPattern = null;
    let bestConfidence = 0;

    // Check Tom King patterns
    for (const [patternName, pattern] of Object.entries(analysis.tomKingPatterns)) {
      if (pattern && pattern.suitable && pattern.confidence > bestConfidence) {
        bestPattern = { name: patternName, ...pattern };
        bestConfidence = pattern.confidence;
      }
    }

    // Check chart patterns
    for (const pattern of analysis.chartPatterns) {
      if (pattern.confidence > bestConfidence) {
        bestPattern = pattern;
        bestConfidence = pattern.confidence;
      }
    }

    if (bestPattern && bestConfidence >= 0.6) {
      assessment.recommendation = 'BUY';
      assessment.confidence = Math.round(bestConfidence * 100);
      assessment.primaryPattern = bestPattern;
      
      // Set risk parameters based on pattern
      this.setRiskParameters(assessment, bestPattern, marketData);
    }

    // Add key supporting factors
    assessment.keyFactors = this.identifyKeyFactors(analysis, marketData);
    
    return assessment;
  }

  setRiskParameters(assessment, pattern, marketData) {
    const currentPrice = marketData.currentPrice;
    
    switch (pattern.name || pattern.type) {
      case 'strangleSetup':
        assessment.expectedReturn = 15; // 15% return expectation
        assessment.stopLoss = currentPrice * 2; // 200% of credit received
        assessment.profitTarget = currentPrice * 0.5; // 50% of credit
        assessment.timeframe = '30-60 days';
        assessment.riskLevel = 'MEDIUM';
        break;
        
      case 'fridayPattern':
        assessment.expectedReturn = 8; // 8% return expectation
        assessment.stopLoss = currentPrice * 3; // 300% loss limit
        assessment.profitTarget = currentPrice * 0.3; // 30% profit
        assessment.timeframe = '1 day';
        assessment.riskLevel = 'HIGH';
        break;
        
      case 'lt112Pattern':
        assessment.expectedReturn = 12; // 12% return expectation
        assessment.stopLoss = currentPrice * 1.5; // 150% loss limit
        assessment.profitTarget = currentPrice * 0.5; // 50% profit
        assessment.timeframe = '90-120 days';
        assessment.riskLevel = 'MEDIUM_LOW';
        break;
        
      default:
        assessment.expectedReturn = 10;
        assessment.stopLoss = currentPrice * 0.98; // 2% stop loss
        assessment.profitTarget = currentPrice * 1.05; // 5% profit target
        assessment.riskLevel = 'MEDIUM';
    }
  }

  identifyKeyFactors(analysis, marketData) {
    const factors = [];
    
    // Technical factors
    const tech = analysis.technicalIndicators;
    if (tech.rsi < 30) factors.push('RSI oversold condition');
    if (tech.rsi > 70) factors.push('RSI overbought condition');
    if (tech.macd && tech.macd.crossover === 'BULLISH') factors.push('MACD bullish crossover');
    if (tech.bollingerBands && tech.bollingerBands.squeeze) factors.push('Bollinger Band squeeze');
    
    // Volume factors
    if (analysis.volumeProfile && analysis.volumeProfile.poc) {
      factors.push(`Trading near volume POC at ${analysis.volumeProfile.poc.toFixed(2)}`);
    }
    
    // Support/Resistance factors
    if (analysis.supportResistance.length > 0) {
      const nearestLevel = analysis.supportResistance[0];
      factors.push(`Strong ${nearestLevel.type.toLowerCase()} at ${nearestLevel.level.toFixed(2)}`);
    }
    
    // Pattern factors
    for (const pattern of analysis.chartPatterns) {
      factors.push(`${pattern.type.replace(/_/g, ' ')} pattern detected`);
    }
    
    return factors.slice(0, 5); // Top 5 factors
  }

  runBacktest(strategy, symbol, options = {}) {
    // This would load historical data for the symbol
    // For now, return placeholder results
    return {
      strategy: strategy,
      symbol: symbol,
      message: 'Backtesting requires historical data feed integration',
      recommendation: 'Implement data provider for backtesting capabilities'
    };
  }

  // Utility methods
  clearCache() {
    this.cache.clear();
  }

  getAnalysisSummary(analysis) {
    return {
      ticker: analysis.ticker,
      timestamp: analysis.timestamp,
      recommendation: analysis.overallAssessment.recommendation,
      confidence: analysis.overallAssessment.confidence,
      primaryPattern: analysis.overallAssessment.primaryPattern?.name || 'None',
      keyFactors: analysis.overallAssessment.keyFactors.slice(0, 3),
      riskLevel: analysis.overallAssessment.riskLevel
    };
  }
}

// Export all classes
module.exports = {
  EnhancedPatternAnalyzer,
  AdvancedTechnicalIndicators,
  SupportResistanceDetector,
  VolumeProfileAnalyzer,
  ChartPatternRecognizer,
  MultiTimeframeAnalyzer,
  TomKingPatternDetectors,
  ConfidenceScorer,
  BacktestingEngine
};