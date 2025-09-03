/**
 * Risk Manager Module
 * VIX regime detection, BP limits, and comprehensive risk management
 * Implements August 5, 2024 lessons and emergency protocols
 */

const DEBUG = process.env.NODE_ENV !== 'production';
const { FedAnnouncementProtection } = require('./fedAnnouncementProtection');
const { EarningsCalendar } = require('./earningsCalendar');

/**
 * VIX Regime Analyzer
 * Analyzes VIX levels and adjusts position sizing accordingly (PDF Page 12)
 */
class VIXRegimeAnalyzer {
  static analyzeVIXRegime(vixLevel) {
    if (vixLevel == null || isNaN(vixLevel)) {
      return {
        regime: 'UNKNOWN',
        bpLimits: { min: 40, max: 50 },
        warning: 'VIX data required for regime analysis',
        recommendations: ['Obtain VIX data before trading']
      };
    }
    
    let regime, bpLimits, warning, recommendations, characteristics;
    
    if (vixLevel < 13) {
      regime = 'LOW';
      bpLimits = { min: 30, max: 45 }; // Tom King: 45% max BP for VIX <13
      warning = '⚠️ Complacency regime - premium scarce, reduce exposure';
      recommendations = [
        'Reduce position sizes significantly',
        'Focus on highest probability setups only',
        'Prepare for volatility expansion',
        'Consider buying protection'
      ];
      characteristics = {
        premiumEnvironment: 'VERY_POOR',
        riskLevel: 'HIGH', // Paradoxically high risk due to complacency
        expectedDuration: 'SHORT_TERM',
        historicalReturn: 'POOR'
      };
    } else if (vixLevel < 18) {
      regime = 'NORMAL';
      bpLimits = { min: 50, max: 65 }; // Tom King: 65% max BP for VIX 13-18
      warning = '📉 Low volatility - premium collection challenging';
      recommendations = [
        'Selective premium selling',
        'Focus on shorter duration trades',
        'Monitor for VIX expansion signals',
        'Maintain conservative sizing'
      ];
      characteristics = {
        premiumEnvironment: 'POOR',
        riskLevel: 'MEDIUM_HIGH',
        expectedDuration: 'MEDIUM_TERM',
        historicalReturn: 'BELOW_AVERAGE'
      };
    } else if (vixLevel < 25) {
      regime = 'ELEVATED';
      bpLimits = { min: 60, max: 75 }; // Tom King: 75% max BP for VIX 18-25
      warning = null;
      recommendations = [
        'Optimal environment for premium selling',
        'Deploy full strategy arsenal',
        'Focus on 45-90 DTE strategies',
        'Maintain standard position sizing'
      ];
      characteristics = {
        premiumEnvironment: 'GOOD',
        riskLevel: 'MEDIUM',
        expectedDuration: 'LONG_TERM',
        historicalReturn: 'GOOD'
      };
    } else if (vixLevel < 30) {
      regime = 'HIGH';
      bpLimits = { min: 40, max: 50 }; // Tom King: 50% max BP for VIX 25-30
      warning = '⚠️ Elevated volatility - increased risk environment';
      recommendations = [
        'Rich premium environment - excellent for selling',
        'Monitor positions more closely',
        'Consider defensive adjustments earlier',
        'Prepare for potential volatility spikes'
      ];
      characteristics = {
        premiumEnvironment: 'VERY_GOOD',
        riskLevel: 'MEDIUM_HIGH',
        expectedDuration: 'SHORT_MEDIUM',
        historicalReturn: 'GOOD'
      };
    } else if (vixLevel < 35) {
      regime = 'HIGH';
      bpLimits = { min: 40, max: 50 }; // Keep 50% for VIX 30-35
      warning = '🚨 High volatility regime - significant risk present';
      recommendations = [
        'Excellent premium selling opportunities',
        'Reduce position sizes due to higher gamma risk',
        'Shorter duration strategies preferred',
        'Active position management required',
        'Consider put-selling focus'
      ];
      characteristics = {
        premiumEnvironment: 'EXCELLENT',
        riskLevel: 'HIGH',
        expectedDuration: 'SHORT_TERM',
        historicalReturn: 'EXCELLENT'
      };
    } else {
      regime = 'EXTREME';
      bpLimits = { min: 70, max: 80 }; // Tom King: 80% BP for VIX >30 (puts only)
      warning = '🚨🚨 CRISIS MODE - Generational opportunity but extreme risk';
      recommendations = [
        '💰 GENERATIONAL OPPORTUNITY - Deploy capital aggressively',
        'Focus on put selling in quality underlyings',
        'Avoid call spreads - stick to puts',
        'Use smallest position sizes due to extreme gamma',
        'Expect 15-25% monthly returns during normalization',
        'Monitor positions minute-by-minute if possible'
      ];
      characteristics = {
        premiumEnvironment: 'HISTORIC',
        riskLevel: 'EXTREME',
        expectedDuration: 'VERY_SHORT',
        historicalReturn: 'HISTORIC',
        opportunity: 'GENERATIONAL'
      };
    }
    
    return {
      regime,
      vixLevel,
      bpLimits,
      warning,
      recommendations,
      characteristics,
      timestamp: new Date().toISOString(),
      
      // Additional analysis
      trend: this.analyzeVIXTrend(vixLevel),
      seasonality: this.getVIXSeasonality(),
      historicalContext: this.getHistoricalContext(vixLevel)
    };
  }
  
  static analyzeVIXTrend(currentVIX, historicalVIX = []) {
    if (historicalVIX.length < 5) {
      return {
        direction: 'UNKNOWN',
        momentum: 'UNKNOWN',
        reliability: 'LOW'
      };
    }
    
    const recent = historicalVIX.slice(-5);
    const avg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    
    let direction = 'SIDEWAYS';
    if (currentVIX > avg * 1.1) {
      direction = 'RISING';
    } else if (currentVIX < avg * 0.9) {
      direction = 'FALLING';
    }
    
    // Calculate momentum
    const momentum = recent.slice(-2).reduce((sum, val, idx) => {
      if (idx === 0) return sum;
      return sum + (val - recent[idx - 1]);
    }, 0);
    
    return {
      direction,
      momentum: momentum > 1 ? 'STRONG' : momentum < -1 ? 'STRONG_DOWN' : 'WEAK',
      reliability: 'MEDIUM',
      recentAvg: avg.toFixed(2)
    };
  }
  
  static getVIXSeasonality() {
    const month = new Date().getMonth(); // 0-11
    const seasonalFactors = {
      // Based on historical VIX seasonality patterns
      0: { factor: 1.1, note: 'January - Higher volatility start of year' },
      1: { factor: 0.9, note: 'February - Typically calmer' },
      2: { factor: 1.0, note: 'March - Quarter end volatility' },
      3: { factor: 0.9, note: 'April - Spring calm period' },
      4: { factor: 0.8, note: 'May - Historically lowest volatility' },
      5: { factor: 0.9, note: 'June - Summer doldrums begin' },
      6: { factor: 0.8, note: 'July - Vacation month, low volume' },
      7: { factor: 0.9, note: 'August - Can be volatile (Flash crashes)' },
      8: { factor: 1.1, note: 'September - Historically volatile month' },
      9: { factor: 1.2, note: 'October - Crash month historically' },
      10: { factor: 1.0, note: 'November - Election/earnings season' },
      11: { factor: 0.9, note: 'December - Year-end positioning' }
    };
    
    return seasonalFactors[month] || { factor: 1.0, note: 'Unknown seasonality' };
  }
  
  static getHistoricalContext(vixLevel) {
    // Historical VIX context for perspective
    const contexts = [
      { level: 9, event: '2017 Historic Low', note: 'Post-election euphoria' },
      { level: 12, event: '2019-2020 Pre-COVID', note: 'Normal market conditions' },
      { level: 16, event: 'Long-term Average', note: 'Historical mean VIX level' },
      { level: 20, event: '2018 Volmageddon', note: 'Vol targeting strategies blew up' },
      { level: 25, event: '2015 China Devaluation', note: 'Emerging market stress' },
      { level: 30, event: '2008 Crisis Begin', note: 'Financial crisis threshold' },
      { level: 40, event: '2020 COVID Spike', note: 'Pandemic uncertainty' },
      { level: 50, event: '2008 Lehman Weekend', note: 'System stress extreme' },
      { level: 80, event: '2008 Crisis Peak', note: 'Maximum fear reading' }
    ];
    
    // Find closest historical context
    const closest = contexts.reduce((prev, curr) => 
      Math.abs(curr.level - vixLevel) < Math.abs(prev.level - vixLevel) ? curr : prev
    );
    
    return {
      closestEvent: closest,
      percentile: this.calculateVIXPercentile(vixLevel),
      interpretation: vixLevel > 30 ? 'CRISIS_TERRITORY' : 
                     vixLevel > 20 ? 'STRESSED_MARKET' :
                     vixLevel > 16 ? 'NORMAL_RANGE' : 'LOW_VOLATILITY'
    };
  }
  
  static calculateVIXPercentile(vixLevel) {
    // Approximate percentile based on historical VIX distribution
    if (vixLevel < 12) return '<20th';
    if (vixLevel < 16) return '20th-40th';
    if (vixLevel < 20) return '40th-60th';
    if (vixLevel < 25) return '60th-80th';
    if (vixLevel < 30) return '80th-90th';
    if (vixLevel < 40) return '90th-95th';
    return '>95th';
  }
}

/**
 * Buying Power Limits Manager
 * Manages BP limits by phase and VIX regime
 */
class BPLimitsManager {
  static getPhaseBPLimits(phase, accountValue) {
    // Base limits by phase (PDF Pages 13-24)
    const phaseLimits = {
      1: { min: 35, max: 50, target: 40 }, // Phase 1: £30-40k - Conservative
      2: { min: 45, max: 65, target: 55 }, // Phase 2: £40-60k - Building
      3: { min: 50, max: 75, target: 65 }, // Phase 3: £60-75k - Optimization  
      4: { min: 60, max: 85, target: 75 }  // Phase 4: £75k+ - Full deployment
    };
    
    const limits = phaseLimits[phase] || phaseLimits[1];
    
    return {
      ...limits,
      phase,
      accountValue,
      reasoning: this.getPhaseBPReasoning(phase),
      maxPositions: this.getMaxPositionsByPhase(phase),
      emergencyMax: Math.min(limits.max + 15, 85) // Emergency spike max
    };
  }
  
  static getPhaseBPReasoning(phase) {
    const reasoning = {
      1: 'Foundation building - conservative approach, learning systems, building track record',
      2: 'Scaling strategies - adding complexity, MES to ES transition, expanding product range',
      3: 'Optimization phase - full futures upgrade, advanced strategies, maximizing efficiency',
      4: 'Professional deployment - full system utilization, maximum diversification, all products'
    };
    
    return reasoning[phase] || reasoning[1];
  }
  
  static getMaxPositionsByPhase(phase) {
    return {
      1: { total: 3, perGroup: 1, strategies: 3 },
      2: { total: 8, perGroup: 2, strategies: 6 },
      3: { total: 12, perGroup: 2, strategies: 8 },
      4: { total: 20, perGroup: 3, strategies: 10 }
    }[phase] || { total: 3, perGroup: 1, strategies: 3 };
  }
  
  static calculateOptimalBP(phase, vixRegime, accountValue, currentPositions = []) {
    const phaseLimits = this.getPhaseBPLimits(phase, accountValue);
    const vixAnalysis = VIXRegimeAnalyzer.analyzeVIXRegime(vixRegime.currentLevel);
    
    // Combine phase and VIX limits
    const adjustedMin = Math.max(phaseLimits.min, vixAnalysis.bpLimits.min);
    const adjustedMax = Math.min(phaseLimits.max, vixAnalysis.bpLimits.max);
    const adjustedTarget = Math.min(Math.max(phaseLimits.target, adjustedMin), adjustedMax);
    
    // Calculate current BP usage
    const currentBP = currentPositions.reduce((total, pos) => {
      return total + this.estimatePositionBP(pos);
    }, 0);
    
    // Emergency protocols for VIX spikes
    let emergencyAdjustment = null;
    if (vixAnalysis.regime === 'EXTREME') {
      emergencyAdjustment = {
        recommendation: 'DEPLOY_AGGRESSIVELY',
        maxBP: Math.min(phaseLimits.emergencyMax, 85),
        reasoning: 'Generational VIX spike - deploy maximum capital',
        expectedReturn: '15-25% monthly during normalization',
        duration: 'Deploy over 1-3 days maximum'
      };
    }
    
    return {
      phase,
      vixRegime: vixAnalysis.regime,
      currentBP,
      limits: {
        min: adjustedMin,
        max: adjustedMax,
        target: adjustedTarget,
        emergency: emergencyAdjustment
      },
      recommendation: this.getBPRecommendation(currentBP, adjustedTarget, vixAnalysis),
      gap: adjustedTarget - currentBP,
      riskAdjustment: this.calculateRiskAdjustment(vixAnalysis, currentPositions)
    };
  }
  
  static getBPRecommendation(currentBP, targetBP, vixAnalysis) {
    const gap = targetBP - currentBP;
    
    if (Math.abs(gap) <= 5) {
      return {
        action: 'MAINTAIN',
        message: 'BP allocation within target range',
        urgency: 'LOW'
      };
    } else if (gap > 0) {
      const urgency = vixAnalysis.regime === 'EXTREME' ? 'URGENT' : 
                     vixAnalysis.regime === 'HIGH' ? 'HIGH' : 'MEDIUM';
      return {
        action: 'INCREASE',
        message: `Deploy additional ${gap.toFixed(1)}% BP`,
        urgency,
        timeline: urgency === 'URGENT' ? 'Immediately' : 
                 urgency === 'HIGH' ? 'Today' : 'This week'
      };
    } else {
      return {
        action: 'REDUCE',
        message: `Reduce BP usage by ${Math.abs(gap).toFixed(1)}%`,
        urgency: 'MEDIUM',
        reason: 'Over-allocated for current regime'
      };
    }
  }
  
  static estimatePositionBP(position) {
    const strategy = position.strategy?.toUpperCase();
    const ticker = position.ticker?.toUpperCase();
    const isMicro = ticker?.startsWith('M') || ['MCL', 'MGC'].includes(ticker);
    
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
  
  static calculateRiskAdjustment(vixAnalysis, positions) {
    const correlationRisk = this.assessCorrelationRisk(positions);
    const concentrationRisk = this.assessConcentrationRisk(positions);
    const liquidityRisk = this.assessLiquidityRisk(positions);
    
    let totalAdjustment = 0;
    const factors = [];
    
    // VIX-based adjustments
    if (vixAnalysis.regime === 'EXTREMELY_LOW') {
      totalAdjustment -= 10;
      factors.push('VIX extremely low - reduce exposure');
    } else if (vixAnalysis.regime === 'EXTREME') {
      totalAdjustment += 15;
      factors.push('VIX extreme - opportunity adjustment');
    }
    
    // Correlation risk adjustment
    if (correlationRisk > 0.7) {
      totalAdjustment -= 15;
      factors.push('High correlation risk - reduce exposure');
    }
    
    // Concentration risk adjustment
    if (concentrationRisk > 0.8) {
      totalAdjustment -= 10;
      factors.push('High concentration - diversify');
    }
    
    return {
      totalAdjustment: Math.max(-20, Math.min(20, totalAdjustment)),
      factors,
      correlationRisk,
      concentrationRisk,
      liquidityRisk
    };
  }
  
  static assessCorrelationRisk(positions) {
    // Simplified correlation risk assessment
    const groups = {};
    positions.forEach(pos => {
      const group = this.getAssetGroup(pos.ticker);
      groups[group] = (groups[group] || 0) + 1;
    });
    
    const maxInGroup = Math.max(...Object.values(groups), 0);
    return Math.min(maxInGroup / 5, 1); // Scale to 0-1
  }
  
  static assessConcentrationRisk(positions) {
    if (positions.length === 0) return 0;
    
    const tickerCounts = {};
    positions.forEach(pos => {
      tickerCounts[pos.ticker] = (tickerCounts[pos.ticker] || 0) + 1;
    });
    
    const maxSingle = Math.max(...Object.values(tickerCounts));
    return maxSingle / positions.length; // Concentration ratio
  }
  
  static assessLiquidityRisk(positions) {
    // Simplified liquidity assessment based on product type
    const liquidityScores = {
      'ES': 1.0, 'SPY': 1.0, 'QQQ': 0.9,
      'MES': 0.8, 'MCL': 0.7, 'MGC': 0.6
    };
    
    if (positions.length === 0) return 0;
    
    const avgLiquidity = positions.reduce((sum, pos) => {
      return sum + (liquidityScores[pos.ticker] || 0.5);
    }, 0) / positions.length;
    
    return 1 - avgLiquidity; // Convert to risk score
  }
  
  static getAssetGroup(ticker) {
    const groups = {
      'ES': 'EQUITY', 'MES': 'EQUITY', 'SPY': 'EQUITY', 'QQQ': 'EQUITY',
      'CL': 'ENERGY', 'MCL': 'ENERGY', 'NG': 'ENERGY',
      'GC': 'METALS', 'MGC': 'METALS', 'SI': 'METALS',
      'ZC': 'GRAINS', 'ZS': 'GRAINS', 'ZW': 'GRAINS'
    };
    
    return groups[ticker?.toUpperCase()] || 'OTHER';
  }
}

/**
 * August 5, 2024 Disaster Prevention System
 * Implements specific protocols to prevent correlation disasters
 * Enhanced with comprehensive volatility spike protection
 */
class August5DisasterPrevention {
  static analyzeAugust5Risk(positions, phase = 1, marketData = {}) {
    // August 5, 2024: £308k loss from excessive correlation in ES complex
    const equityPositions = positions.filter(pos => 
      ['ES', 'MES', 'SPY', 'QQQ', 'IWM', 'SPX', 'SPXW'].includes(pos.ticker?.toUpperCase())
    );
    
    const correlationLimit = phase >= 4 ? 3 : 2; // PDF Page 12
    const currentEquityCount = equityPositions.length;
    
    let riskLevel = 'LOW';
    let messages = [];
    let actions = [];
    let protocolStatus = {
      volatilitySpikeProtection: false,
      correlationProtection: false,
      emergencyExitReady: false,
      hedgePositions: []
    };
    
    // Volatility Spike Detection
    const vix = marketData.VIX || 0;
    const vixChangePercent = marketData.VIXChangePercent || 0;
    const vix5DayAvg = marketData.VIX5DayAvg || vix;
    
    // August 5 pattern detection - VIX spike >50% in single day
    if (vixChangePercent > 50 || vix > 35) {
      riskLevel = 'CRITICAL';
      messages.push(`🚨 VOLATILITY SPIKE DETECTED: VIX ${vix.toFixed(2)} (+${vixChangePercent.toFixed(1)}%)`);
      messages.push('⚡ August 5, 2024 pattern detected - ACTIVATE EMERGENCY PROTOCOLS');
      actions.push('ACTIVATE_VOLATILITY_SPIKE_PROTOCOL');
      protocolStatus.volatilitySpikeProtection = true;
    }
    
    // Pre-spike warning indicators
    const spikeIndicators = this.detectVolatilitySpikeIndicators(marketData);
    if (spikeIndicators.risk > 0.7) {
      messages.push(`⚠️ Pre-spike indicators: ${spikeIndicators.warningCount}/5 active`);
      actions.push('PREPARE_DEFENSIVE_POSITIONS');
    }
    
    // Correlation concentration check
    if (currentEquityCount > correlationLimit) {
      riskLevel = 'CRITICAL';
      messages.push(`🚨 AUGUST 5 RISK: ${currentEquityCount} equity positions (limit: ${correlationLimit})`);
      messages.push('💀 This exact scenario caused £308k loss on August 5, 2024');
      actions.push('CLOSE_EXCESS_POSITIONS_IMMEDIATELY');
      actions.push('NEVER_EXCEED_CORRELATION_LIMITS');
      protocolStatus.correlationProtection = true;
    } else if (currentEquityCount === correlationLimit) {
      riskLevel = 'HIGH';
      messages.push(`⚠️ At correlation limit: ${currentEquityCount}/${correlationLimit} equity positions`);
      messages.push('🎯 One more position triggers August 5 scenario');
      actions.push('DO_NOT_ADD_MORE_EQUITY_POSITIONS');
      actions.push('CONSIDER_REDUCING_TO_CREATE_BUFFER');
    }
    
    // Check for LT112 concentration (specific August 5 issue)
    const lt112Count = equityPositions.filter(pos => 
      pos.strategy?.toUpperCase() === 'LT112'
    ).length;
    
    if (lt112Count > 1) {
      riskLevel = riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      messages.push(`⚠️ Multiple LT112 positions: ${lt112Count} (August 5 problem)`);
      actions.push('DIVERSIFY_AWAY_FROM_MULTIPLE_LT112');
    }
    
    // VIX spike amplification risk
    const totalEquityBP = equityPositions.reduce((sum, pos) => 
      sum + BPLimitsManager.estimatePositionBP(pos), 0
    );
    
    if (totalEquityBP > 20) {
      riskLevel = 'HIGH';
      messages.push(`⚠️ High equity BP concentration: ${totalEquityBP.toFixed(1)}%`);
      actions.push('REDUCE_EQUITY_CONCENTRATION');
    }
    
    return {
      riskLevel,
      currentEquityCount,
      correlationLimit,
      lt112Count,
      totalEquityBP: totalEquityBP.toFixed(1),
      messages,
      actions,
      protocolStatus,
      historicalReference: {
        date: '2024-08-05',
        loss: '£308,000',
        cause: 'Excessive correlation in ES complex during VIX spike',
        lesson: 'NEVER exceed correlation group limits'
      },
      preventionProtocol: {
        rule1: 'Maximum 2 positions per correlation group (3 for Phase 4)',
        rule2: 'Never more than 1 LT112 position in same group',
        rule3: 'Monitor total group BP exposure (<20%)',
        rule4: 'Immediate exit if limits exceeded'
      }
    };
  }
  
  /**
   * Detect early warning indicators of volatility spike
   */
  static detectVolatilitySpikeIndicators(marketData) {
    const indicators = {
      vixTrending: false,
      putCallSkew: false,
      termStructureInversion: false,
      volumeSpike: false,
      correlationBreakdown: false,
      warningCount: 0,
      risk: 0
    };
    
    // VIX trending higher (5-day moving average)
    const vix = marketData.VIX || 0;
    const vix5DayAvg = marketData.VIX5DayAvg || vix;
    if (vix > vix5DayAvg * 1.15) {
      indicators.vixTrending = true;
      indicators.warningCount++;
    }
    
    // Put/Call skew widening
    const putCallRatio = marketData.putCallRatio || 1;
    if (putCallRatio > 1.5) {
      indicators.putCallSkew = true;
      indicators.warningCount++;
    }
    
    // VIX Term structure analysis (enhanced with VIXTermStructureAnalyzer)
    const vix9Day = marketData.VIX9D || vix;
    const vix30Day = marketData.VIX || vix;
    if (vix9Day > vix30Day) {
      indicators.termStructureInversion = true;
      indicators.warningCount++;
    }
    
    // Enhanced term structure analysis if VIXTermStructureAnalyzer is available
    if (this.vixAnalyzer) {
      try {
        const termStructure = this.vixAnalyzer.getTermStructureSummary();
        if (termStructure) {
          indicators.vixRegime = termStructure.regime;
          indicators.vixStructureType = termStructure.structureType;
          indicators.recommendedBPUsage = termStructure.suggestedBP;
          
          // Override basic term structure with advanced analysis
          if (termStructure.structureType === 'SHORT_TERM_INVERSION' || 
              termStructure.structureType === 'FULL_BACKWARDATION') {
            indicators.termStructureInversion = true;
            indicators.warningCount++;
          }
        }
      } catch (error) {
        // Fallback to basic analysis if advanced fails
        console.debug('Advanced VIX analysis unavailable, using basic term structure');
      }
    }
    
    // Volume spike detection
    const volume = marketData.volume || 0;
    const avgVolume = marketData.avgVolume20Day || volume;
    if (volume > avgVolume * 1.5) {
      indicators.volumeSpike = true;
      indicators.warningCount++;
    }
    
    // Correlation breakdown (usually precedes volatility events)
    const correlation = marketData.sectorCorrelation || 0.5;
    if (correlation < 0.3 || correlation > 0.8) {
      indicators.correlationBreakdown = true;
      indicators.warningCount++;
    }
    
    // Calculate overall risk score (0-1)
    indicators.risk = indicators.warningCount / 5;
    
    return indicators;
  }
  
  /**
   * Enhanced Volatility Spike Protection System
   * Implements automatic position reduction during extreme market events
   */
  static analyzeVolatilitySpikeRisk(positions, vixLevel, vixChange24h, accountValue) {
    const analysis = {
      spikeDetected: false,
      severity: 'NONE',
      autoReductions: [],
      manualActions: [],
      protectionLevel: 0
    };
    
    // Detect spike conditions
    const vixSpike = vixChange24h > 30; // 30% VIX increase in 24h
    const extremeVix = vixLevel > 35;
    const rapidSpike = vixChange24h > 50; // 50% VIX increase = extreme event
    
    if (rapidSpike || (vixSpike && extremeVix)) {
      analysis.spikeDetected = true;
      analysis.severity = rapidSpike ? 'EXTREME' : 'HIGH';
      
      // Calculate automatic position reductions
      const reductionFactor = rapidSpike ? 0.5 : 0.7; // 50% or 30% reduction
      
      positions.forEach(pos => {
        if (pos.type === 'SHORT_OPTION' || pos.strategy === 'STRANGLE') {
          analysis.autoReductions.push({
            position: pos.symbol,
            currentSize: pos.quantity,
            reduceTo: Math.floor(pos.quantity * reductionFactor),
            reason: `Volatility spike protection - ${analysis.severity}`,
            priority: pos.delta > 0.3 ? 'IMMEDIATE' : 'HIGH'
          });
        }
      });
      
      // Manual actions required
      analysis.manualActions = [
        'Close all 0DTE positions immediately',
        'Reduce futures strangles by 50%',
        'Exit any positions showing >2x loss',
        'Suspend new entries for 48 hours',
        'Monitor correlation groups for concentration'
      ];
      
      // Protection level (0-100)
      analysis.protectionLevel = rapidSpike ? 100 : 75;
    } else if (vixLevel > 30) {
      // Elevated protection mode
      analysis.severity = 'ELEVATED';
      analysis.protectionLevel = 50;
      analysis.manualActions = [
        'Review all positions for correlation risk',
        'Consider reducing position sizes by 25%',
        'No new aggressive positions'
      ];
    }
    
    // Add historical context
    analysis.historicalContext = {
      august2024: {
        vixSpike: '65% in one day',
        portfolioImpact: '-£308,000',
        lessonLearned: 'Correlation kills during spikes'
      },
      protectionThresholds: {
        warningLevel: 'VIX > 25 or +20% daily',
        actionLevel: 'VIX > 30 or +30% daily',
        emergencyLevel: 'VIX > 35 or +50% daily'
      }
    };
    
    return analysis;
  }
  
  static checkEmergencyProtocols(positions, vixLevel, phase, vixChange24h = 0, accountValue = 30000) {
    const august5Risk = this.analyzeAugust5Risk(positions, phase);
    const vixAnalysis = VIXRegimeAnalyzer.analyzeVIXRegime(vixLevel);
    const spikeProtection = this.analyzeVolatilitySpikeRisk(positions, vixLevel, vixChange24h, accountValue);
    
    const protocols = [];
    
    // Protocol 1: Volatility Spike Protection (NEW - ENHANCED)
    if (spikeProtection.spikeDetected) {
      protocols.push({
        type: 'VOLATILITY_SPIKE_PROTECTION',
        severity: spikeProtection.severity,
        immediate: true,
        actions: [
          ...spikeProtection.autoReductions.map(r => `AUTO-REDUCE: ${r.position} to ${r.reduceTo} contracts`),
          ...spikeProtection.manualActions
        ],
        protectionLevel: spikeProtection.protectionLevel,
        message: `🚨 VOLATILITY SPIKE DETECTED - ${spikeProtection.severity} SEVERITY`
      });
    }
    
    // Protocol 2: Correlation Emergency (EXISTING)
    if (august5Risk.riskLevel === 'CRITICAL') {
      protocols.push({
        type: 'CORRELATION_EMERGENCY',
        priority: 'IMMEDIATE',
        message: '🚨 CORRELATION EMERGENCY - Execute August 5 prevention protocol',
        actions: [
          'STOP all new position entries',
          'CLOSE excess correlated positions within 1 hour',
          'DO NOT add any equity-related positions',
          'Review and document what went wrong'
        ],
        deadline: '1 hour'
      });
    }
    
    // Protocol 2: VIX Spike Response
    if (vixLevel > 35 && august5Risk.currentEquityCount > 1) {
      protocols.push({
        type: 'VIX_SPIKE_RESPONSE',
        priority: 'HIGH',
        message: '⚡ VIX spike with correlation exposure detected',
        actions: [
          'Monitor positions minute-by-minute',
          'Prepare for immediate defensive actions',
          'Consider reducing position sizes',
          'Do not add new positions until VIX < 25'
        ],
        deadline: '30 minutes'
      });
    }
    
    // Protocol 3: Concentration Warning
    if (august5Risk.totalEquityBP > 25) {
      protocols.push({
        type: 'CONCENTRATION_WARNING',
        priority: 'MEDIUM',
        message: '📊 High concentration in equity complex detected',
        actions: [
          'Plan diversification into other asset classes',
          'Reduce position sizes on new entries',
          'Monitor correlation more closely',
          'Set alerts for VIX > 25'
        ],
        deadline: 'End of day'
      });
    }
    
    return {
      protocols,
      hasEmergency: protocols.some(p => p.priority === 'IMMEDIATE'),
      hasWarning: protocols.some(p => p.priority === 'HIGH'),
      august5Risk,
      vixAnalysis
    };
  }
}

/**
 * Main Risk Manager Class
 * Orchestrates all risk management functions
 */
class RiskManager {
  constructor(config = {}) {
    this.lastVIXLevel = null;
    this.lastAnalysis = null;
    this.alertHistory = [];
    this.emergencyMode = false;
    
    // Initialize protection systems
    this.fedProtection = new FedAnnouncementProtection(config.fedProtection);
    this.earningsCalendar = new EarningsCalendar(config.earningsCalendar);
    
    // Start monitoring
    this.fedProtection.startMonitoring();
    this.earningsCalendar.startMonitoring();
  }
  
  assessRisk(positions, vixLevel, phase, accountValue) {
    const timestamp = new Date();
    
    // Core analyses
    const vixAnalysis = VIXRegimeAnalyzer.analyzeVIXRegime(vixLevel);
    const bpOptimization = BPLimitsManager.calculateOptimalBP(
      phase, 
      { currentLevel: vixLevel }, 
      accountValue, 
      positions
    );
    const august5Analysis = August5DisasterPrevention.analyzeAugust5Risk(positions, phase);
    const emergencyProtocols = August5DisasterPrevention.checkEmergencyProtocols(
      positions, 
      vixLevel, 
      phase
    );
    
    // Check Fed and earnings protections
    const fedStatus = this.fedProtection.getStatus();
    const earningsRisks = this.earningsCalendar.checkEarningsRisk(positions);
    
    // Overall risk assessment
    const overallRisk = this.calculateOverallRisk(
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols,
      fedStatus,
      earningsRisks
    );
    
    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols,
      fedStatus,
      earningsRisks
    );
    
    // Check for new alerts
    const newAlerts = this.checkForNewAlerts(
      vixAnalysis,
      august5Analysis,
      emergencyProtocols
    );
    
    this.lastVIXLevel = vixLevel;
    this.lastAnalysis = {
      timestamp,
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols,
      fedStatus,
      earningsRisks,
      overallRisk,
      recommendations
    };
    
    if (DEBUG && newAlerts.length > 0) {
      console.log(`🚨 ${newAlerts.length} new risk alerts generated`);
    }
    
    return {
      timestamp: timestamp.toISOString(),
      overallRisk,
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols,
      fedStatus,
      earningsRisks,
      recommendations,
      alerts: newAlerts,
      emergencyMode: this.emergencyMode
    };
  }
  
  calculateOverallRisk(vixAnalysis, bpOptimization, august5Analysis, emergencyProtocols, fedStatus, earningsRisks) {
    let riskScore = 50; // Base risk level
    let riskLevel = 'MEDIUM';
    const factors = [];
    
    // VIX-based risk adjustments
    switch (vixAnalysis.regime) {
      case 'EXTREMELY_LOW':
        riskScore += 20;
        factors.push('Complacency regime - hidden risks');
        break;
      case 'LOW':
        riskScore += 10;
        factors.push('Low volatility - compressed premiums');
        break;
      case 'NORMAL':
        riskScore += 0;
        factors.push('Normal volatility environment');
        break;
      case 'ELEVATED':
        riskScore += 5;
        factors.push('Elevated volatility - monitor closely');
        break;
      case 'HIGH':
        riskScore += 15;
        factors.push('High volatility - active management required');
        break;
      case 'EXTREME':
        riskScore += 25;
        factors.push('Extreme volatility - maximum risk and opportunity');
        break;
    }
    
    // August 5 risk adjustments
    switch (august5Analysis.riskLevel) {
      case 'CRITICAL':
        riskScore += 30;
        riskLevel = 'CRITICAL';
        factors.push('CRITICAL: August 5 scenario risk');
        break;
      case 'HIGH':
        riskScore += 20;
        factors.push('High correlation concentration');
        break;
    }
    
    // BP optimization risk
    if (bpOptimization.currentBP > bpOptimization.limits.max) {
      riskScore += 15;
      factors.push('Over-allocated BP');
    }
    
    // Emergency protocols
    if (emergencyProtocols.hasEmergency) {
      riskScore += 25;
      riskLevel = 'CRITICAL';
      factors.push('Emergency protocols activated');
    }
    
    // Fed announcement protection
    if (fedStatus.protectionActive) {
      riskScore += 15;
      factors.push(`Fed ${fedStatus.currentAnnouncement?.type} protection active`);
    }
    
    // Earnings risks
    if (earningsRisks && earningsRisks.length > 0) {
      const criticalEarnings = earningsRisks.filter(r => r.risk.level === 'CRITICAL');
      if (criticalEarnings.length > 0) {
        riskScore += 20;
        factors.push(`${criticalEarnings.length} critical earnings exposures`);
      } else {
        riskScore += 10;
        factors.push(`${earningsRisks.length} earnings exposures monitored`);
      }
    }
    
    // Final risk level determination
    if (riskLevel !== 'CRITICAL') {
      if (riskScore >= 80) riskLevel = 'HIGH';
      else if (riskScore >= 60) riskLevel = 'MEDIUM_HIGH';
      else if (riskScore <= 40) riskLevel = 'LOW';
      else if (riskScore <= 50) riskLevel = 'MEDIUM_LOW';
    }
    
    return {
      score: Math.min(100, Math.max(0, riskScore)),
      level: riskLevel,
      factors,
      summary: this.getRiskSummary(riskLevel, factors)
    };
  }
  
  getRiskSummary(riskLevel, factors) {
    const summaries = {
      'CRITICAL': '🚨 CRITICAL RISK - Immediate action required',
      'HIGH': '⚠️ HIGH RISK - Active monitoring and management needed',
      'MEDIUM_HIGH': '📊 ELEVATED RISK - Increased caution warranted',
      'MEDIUM': '✅ NORMAL RISK - Standard monitoring sufficient',
      'MEDIUM_LOW': '🟢 LOW-MEDIUM RISK - Favorable conditions',
      'LOW': '🌟 LOW RISK - Optimal trading environment'
    };
    
    return summaries[riskLevel] || 'Unknown risk level';
  }
  
  generateRiskRecommendations(vixAnalysis, bpOptimization, august5Analysis, emergencyProtocols, fedStatus, earningsRisks) {
    const recommendations = [];
    
    // Emergency recommendations (highest priority)
    if (emergencyProtocols.hasEmergency) {
      emergencyProtocols.protocols.forEach(protocol => {
        if (protocol.priority === 'IMMEDIATE') {
          recommendations.push({
            type: 'EMERGENCY',
            priority: 'IMMEDIATE',
            title: protocol.message,
            actions: protocol.actions,
            deadline: protocol.deadline
          });
        }
      });
    }
    
    // August 5 specific recommendations
    if (august5Analysis.riskLevel === 'CRITICAL') {
      recommendations.push({
        type: 'CORRELATION_EMERGENCY',
        priority: 'URGENT',
        title: 'August 5 scenario prevention required',
        actions: august5Analysis.actions,
        historicalContext: august5Analysis.historicalReference
      });
    }
    
    // VIX regime recommendations
    if (vixAnalysis.regime === 'EXTREME') {
      recommendations.push({
        type: 'OPPORTUNITY',
        priority: 'HIGH',
        title: 'Generational VIX spike opportunity',
        actions: vixAnalysis.recommendations.slice(0, 3),
        expectedReturn: '15-25% monthly'
      });
    }
    
    // BP optimization recommendations
    if (bpOptimization.recommendation.urgency === 'URGENT') {
      recommendations.push({
        type: 'DEPLOYMENT',
        priority: 'HIGH',
        title: bpOptimization.recommendation.message,
        actions: [
          `${bpOptimization.recommendation.action} BP by ${Math.abs(bpOptimization.gap).toFixed(1)}%`,
          `Timeline: ${bpOptimization.recommendation.timeline}`
        ]
      });
    }
    
    // Fed announcement recommendations
    if (fedStatus.protectionActive) {
      recommendations.push({
        type: 'FED_PROTECTION',
        priority: 'HIGH',
        title: `Fed ${fedStatus.currentAnnouncement?.type} protection active`,
        actions: [
          `Hours until: ${fedStatus.currentAnnouncement?.hoursUntil?.toFixed(1) || 'N/A'}`,
          'New position restrictions in effect',
          'Position reduction protocols active',
          'Consider defensive adjustments'
        ]
      });
    }
    
    // Earnings recommendations
    if (earningsRisks && earningsRisks.length > 0) {
      const criticalEarnings = earningsRisks.filter(r => r.risk.level === 'CRITICAL');
      
      if (criticalEarnings.length > 0) {
        recommendations.push({
          type: 'EARNINGS_CRITICAL',
          priority: 'URGENT',
          title: `${criticalEarnings.length} critical earnings exposures`,
          actions: criticalEarnings.flatMap(e => e.risk.actions).slice(0, 4)
        });
      } else {
        recommendations.push({
          type: 'EARNINGS_MONITOR',
          priority: 'MEDIUM',
          title: `${earningsRisks.length} earnings exposures monitored`,
          actions: ['Monitor earnings calendar', 'Review position risk scores', 'Consider adjustments']
        });
      }
    }
    
    // General risk management
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'MONITOR',
        priority: 'LOW',
        title: 'Continue normal monitoring',
        actions: [
          'Monitor VIX for regime changes',
          'Watch correlation group limits',
          'Review position health regularly'
        ]
      });
    }
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }
  
  checkForNewAlerts(vixAnalysis, august5Analysis, emergencyProtocols) {
    const newAlerts = [];
    const now = Date.now();
    
    // VIX regime change alert
    if (this.lastVIXLevel && vixAnalysis.vixLevel !== this.lastVIXLevel) {
      const change = vixAnalysis.vixLevel - this.lastVIXLevel;
      if (Math.abs(change) >= 3) {
        newAlerts.push({
          type: 'VIX_CHANGE',
          severity: Math.abs(change) >= 10 ? 'HIGH' : 'MEDIUM',
          message: `VIX moved ${change > 0 ? '+' : ''}${change.toFixed(1)} to ${vixAnalysis.vixLevel}`,
          newRegime: vixAnalysis.regime,
          timestamp: now
        });
      }
    }
    
    // August 5 risk alerts
    if (august5Analysis.riskLevel === 'CRITICAL') {
      newAlerts.push({
        type: 'AUGUST_5_RISK',
        severity: 'CRITICAL',
        message: 'August 5 disaster scenario detected',
        actions: august5Analysis.actions,
        timestamp: now
      });
    }
    
    // Emergency protocol alerts
    emergencyProtocols.protocols.forEach(protocol => {
      if (protocol.priority === 'IMMEDIATE') {
        newAlerts.push({
          type: 'EMERGENCY_PROTOCOL',
          severity: 'CRITICAL',
          message: protocol.message,
          deadline: protocol.deadline,
          timestamp: now
        });
      }
    });
    
    // Add to alert history
    this.alertHistory.push(...newAlerts);
    
    // Clean old alerts (keep last 24 hours)
    const cutoff = now - (24 * 60 * 60 * 1000);
    this.alertHistory = this.alertHistory.filter(alert => alert.timestamp > cutoff);
    
    return newAlerts;
  }
  
  // Get recent alert history
  getAlertHistory(hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.alertHistory.filter(alert => alert.timestamp > cutoff);
  }
  
  // Set emergency mode
  setEmergencyMode(enabled, reason = null) {
    this.emergencyMode = enabled;
    if (enabled && reason) {
      console.log(`🚨 EMERGENCY MODE ACTIVATED: ${reason}`);
    } else if (!enabled) {
      console.log('✅ Emergency mode deactivated');
    }
  }
  
  // Get risk summary for dashboard
  getRiskSummary() {
    if (!this.lastAnalysis) {
      return { error: 'No risk analysis available' };
    }
    
    const { overallRisk, vixAnalysis, august5Analysis, emergencyProtocols } = this.lastAnalysis;
    
    return {
      timestamp: this.lastAnalysis.timestamp,
      overallRiskLevel: overallRisk.level,
      overallRiskScore: overallRisk.score,
      vixLevel: vixAnalysis.vixLevel,
      vixRegime: vixAnalysis.regime,
      august5Risk: august5Analysis.riskLevel,
      hasEmergency: emergencyProtocols.hasEmergency,
      emergencyMode: this.emergencyMode,
      recentAlerts: this.getAlertHistory(1).length,
      keyFactors: overallRisk.factors.slice(0, 3)
    };
  }
  
  /**
   * Check if a trade is allowed considering Fed and earnings protections
   */
  isTradeAllowed(trade) {
    const results = [];
    
    // Check Fed protection
    const fedCheck = this.fedProtection.isTradeAllowed(trade);
    if (!fedCheck.allowed) {
      results.push({
        type: 'FED_RESTRICTION',
        allowed: false,
        reasons: fedCheck.reasons,
        announcement: fedCheck.announcement
      });
    }
    
    // Check earnings protection
    const earningsCheck = this.earningsCalendar.isTradeAllowed(trade);
    if (!earningsCheck.allowed) {
      results.push({
        type: 'EARNINGS_RESTRICTION',
        allowed: false,
        reasons: earningsCheck.reasons,
        earnings: earningsCheck.earnings,
        hoursUntilEarnings: earningsCheck.hoursUntilEarnings
      });
    }
    
    const overallAllowed = results.every(r => r.allowed !== false);
    
    return {
      allowed: overallAllowed,
      restrictions: results,
      summary: overallAllowed ? 
        'Trade approved' : 
        `Trade blocked: ${results.flatMap(r => r.reasons).join(', ')}`
    };
  }
  
  /**
   * Get position sizing recommendations considering Fed/earnings
   */
  getPositionSizing(normalSize, trade) {
    let adjustedSize = normalSize;
    const adjustments = [];
    
    // Fed protection sizing
    if (this.fedProtection.getStatus().protectionActive) {
      const fedSizing = this.fedProtection.getPositionSizing(normalSize);
      adjustedSize = Math.min(adjustedSize, fedSizing.recommendedSize);
      adjustments.push({
        type: 'FED_PROTECTION',
        reduction: (normalSize - fedSizing.recommendedSize) / normalSize,
        reason: fedSizing.reason
      });
    }
    
    // Earnings considerations
    if (trade?.position?.symbol) {
      const earningsAdjustment = this.earningsCalendar.getEarningsAdjustments({
        symbol: trade.position.symbol,
        strategy: trade.strategy,
        type: trade.type
      });
      
      if (earningsAdjustment.adjustmentNeeded) {
        const reduction = earningsAdjustment.recommendations[0]?.amount || 0.5;
        adjustedSize = Math.floor(adjustedSize * (1 - reduction));
        adjustments.push({
          type: 'EARNINGS_PROTECTION',
          reduction: reduction,
          reason: 'Earnings window position reduction'
        });
      }
    }
    
    return {
      originalSize: normalSize,
      recommendedSize: adjustedSize,
      adjustments,
      totalReduction: (normalSize - adjustedSize) / normalSize
    };
  }
  
  /**
   * Stop all monitoring systems
   */
  shutdown() {
    this.fedProtection?.stopMonitoring();
    this.earningsCalendar?.stopMonitoring();
  }
  
  /**
   * Get maximum buying power usage based on VIX level
   * Implements Tom King's dynamic BP system
   */
  static getMaxBPUsage(vixLevel) {
    if (vixLevel < 13) return 0.45; // 45% for VIX <13
    if (vixLevel < 18) return 0.65; // 65% for VIX 13-18
    if (vixLevel < 25) return 0.75; // 75% for VIX 18-25
    return 0.80; // 80% for VIX 25+ (Tom King's max)
  }
  
  /**
   * Calculate optimal position size based on risk parameters
   */
  calculatePositionSize(options = {}) {
    const {
      accountValue = 50000,
      strategy = 'STRANGLE',
      vixLevel = 20,
      correlation = 'MEDIUM',
      riskPerTrade = 0.02, // 2% of account
      maxPositionSize = 0.1, // 10% of account max
      confidence = 0.8,
      winRate = 0.88, // Tom King's 88% win rate for 0DTE
      avgWin = 200, // Average win in £
      avgLoss = 800, // Average loss in £
      useKellyCriterion = false
    } = options;
    
    // Base position size as percentage of account
    let baseSize = riskPerTrade * confidence;
    
    // Apply Kelly Criterion if requested
    if (useKellyCriterion) {
      const kellySize = this.calculateKellyCriterion({
        winRate,
        avgWin,
        avgLoss,
        maxSize: maxPositionSize
      });
      baseSize = Math.min(baseSize, kellySize.recommendedSize);
    }
    
    // Adjust for VIX regime
    const vixRegime = VIXRegimeAnalyzer.analyzeVIXRegime(vixLevel);
    const vixAdjustment = this.getVIXPositionAdjustment(vixRegime.regime);
    baseSize *= vixAdjustment;
    
    // Adjust for strategy risk
    const strategyAdjustment = this.getStrategyRiskAdjustment(strategy);
    baseSize *= strategyAdjustment;
    
    // Adjust for correlation risk
    const correlationAdjustment = this.getCorrelationAdjustment(correlation);
    baseSize *= correlationAdjustment;
    
    // Apply emergency mode restrictions
    if (this.emergencyMode) {
      baseSize *= 0.5; // Halve position size in emergency mode
    }
    
    // Cap at maximum position size
    const finalSize = Math.min(baseSize, maxPositionSize);
    
    // Calculate actual dollar amount
    const dollarAmount = accountValue * finalSize;
    
    return {
      percentOfAccount: finalSize,
      dollarAmount: Math.round(dollarAmount),
      riskAmount: Math.round(dollarAmount * riskPerTrade),
      adjustments: {
        vixAdjustment,
        strategyAdjustment,
        correlationAdjustment,
        emergencyMode: this.emergencyMode,
        kellyCriterion: useKellyCriterion
      },
      recommendation: finalSize > 0.05 ? 'NORMAL' : finalSize > 0.02 ? 'CONSERVATIVE' : 'DEFENSIVE'
    };
  }
  
  /**
   * Kelly Criterion Position Sizing
   * Calculates optimal position size based on win rate and payoff ratio
   * Formula: f* = (p*b - q) / b
   * where f* = fraction to bet, p = win probability, q = loss probability, b = payoff ratio
   */
  calculateKellyCriterion(options = {}) {
    const {
      winRate = 0.88, // Tom King's 88% win rate
      avgWin = 200, // Average winning trade profit
      avgLoss = 800, // Average losing trade loss
      maxSize = 0.25, // Maximum position size (25% of account)
      kellyFraction = 0.25 // Use 25% of full Kelly for safety
    } = options;
    
    // Validate inputs
    if (winRate <= 0 || winRate >= 1) {
      return {
        recommendedSize: 0.02,
        fullKelly: 0,
        fractionalKelly: 0.02,
        error: 'Invalid win rate - must be between 0 and 1'
      };
    }
    
    // Calculate payoff ratio (b)
    const payoffRatio = avgWin / avgLoss;
    
    // Calculate loss probability
    const lossRate = 1 - winRate;
    
    // Kelly formula: f* = (p*b - q) / b
    const fullKelly = (winRate * payoffRatio - lossRate) / payoffRatio;
    
    // Apply fractional Kelly for safety (typically 25% of full Kelly)
    const fractionalKelly = fullKelly * kellyFraction;
    
    // Cap at maximum size
    const recommendedSize = Math.min(Math.max(fractionalKelly, 0), maxSize);
    
    // Calculate expected growth rate (for information)
    const expectedGrowthRate = this.calculateExpectedGrowthRate(
      winRate, 
      payoffRatio, 
      recommendedSize
    );
    
    return {
      recommendedSize,
      fullKelly,
      fractionalKelly,
      payoffRatio,
      expectedGrowthRate,
      details: {
        winRate: (winRate * 100).toFixed(1) + '%',
        lossRate: (lossRate * 100).toFixed(1) + '%',
        avgWin: '£' + avgWin,
        avgLoss: '£' + avgLoss,
        kellyFraction: (kellyFraction * 100).toFixed(0) + '% of full Kelly',
        maxAllowed: (maxSize * 100).toFixed(0) + '% of account'
      },
      interpretation: this.interpretKellyResult(recommendedSize, fullKelly)
    };
  }
  
  /**
   * Calculate expected growth rate using Kelly position sizing
   * G = p * ln(1 + b*f) + q * ln(1 - f)
   */
  calculateExpectedGrowthRate(winRate, payoffRatio, positionSize) {
    const lossRate = 1 - winRate;
    
    // Expected growth formula
    const winGrowth = winRate * Math.log(1 + payoffRatio * positionSize);
    const lossGrowth = lossRate * Math.log(1 - positionSize);
    
    return winGrowth + lossGrowth;
  }
  
  /**
   * Interpret Kelly Criterion results
   */
  interpretKellyResult(recommendedSize, fullKelly) {
    if (fullKelly <= 0) {
      return {
        verdict: 'DO_NOT_TRADE',
        reason: 'Negative expectancy - avoid this trade setup',
        action: 'Review strategy or improve edge'
      };
    } else if (fullKelly > 0.5) {
      return {
        verdict: 'EXCEPTIONAL_EDGE',
        reason: 'Very strong edge detected - rare opportunity',
        action: 'Consider increasing position size carefully'
      };
    } else if (fullKelly > 0.25) {
      return {
        verdict: 'STRONG_EDGE',
        reason: 'Good trading edge with favorable risk/reward',
        action: 'Trade with recommended Kelly sizing'
      };
    } else if (fullKelly > 0.1) {
      return {
        verdict: 'MODERATE_EDGE',
        reason: 'Decent edge but modest position sizing advised',
        action: 'Trade conservatively with fractional Kelly'
      };
    } else {
      return {
        verdict: 'WEAK_EDGE',
        reason: 'Marginal edge - consider if worth the risk',
        action: 'Use minimum position size or skip trade'
      };
    }
  }
  
  /**
   * Calculate optimal position size for multiple correlated positions
   * Uses modified Kelly for portfolio of correlated assets
   */
  calculatePortfolioKelly(positions = []) {
    // Aggregate statistics across positions
    const portfolioStats = positions.reduce((stats, pos) => {
      stats.totalWinRate += pos.winRate || 0.88;
      stats.totalPayoff += (pos.avgWin || 200) / (pos.avgLoss || 800);
      stats.count++;
      return stats;
    }, { totalWinRate: 0, totalPayoff: 0, count: 0 });
    
    if (portfolioStats.count === 0) {
      return {
        recommendedSize: 0.02,
        perPositionSize: 0.02,
        error: 'No positions to calculate'
      };
    }
    
    // Average statistics
    const avgWinRate = portfolioStats.totalWinRate / portfolioStats.count;
    const avgPayoff = portfolioStats.totalPayoff / portfolioStats.count;
    
    // Calculate correlation penalty (simplified)
    const correlationPenalty = this.calculateCorrelationPenalty(positions);
    
    // Modified Kelly for correlated positions
    const baseKelly = this.calculateKellyCriterion({
      winRate: avgWinRate,
      avgWin: avgPayoff * 800,
      avgLoss: 800
    });
    
    // Apply correlation penalty
    const adjustedKelly = baseKelly.recommendedSize * (1 - correlationPenalty);
    
    // Divide among positions
    const perPositionSize = adjustedKelly / Math.sqrt(portfolioStats.count);
    
    return {
      recommendedTotalSize: adjustedKelly,
      perPositionSize,
      numberOfPositions: portfolioStats.count,
      correlationPenalty: (correlationPenalty * 100).toFixed(1) + '%',
      details: {
        avgWinRate: (avgWinRate * 100).toFixed(1) + '%',
        avgPayoffRatio: avgPayoff.toFixed(2),
        baseKellySize: baseKelly.recommendedSize,
        adjustmentFactor: 1 - correlationPenalty
      }
    };
  }
  
  /**
   * Calculate correlation penalty for portfolio Kelly
   */
  calculateCorrelationPenalty(positions) {
    // Group positions by correlation
    const groups = {};
    positions.forEach(pos => {
      const group = BPLimitsManager.getAssetGroup(pos.ticker);
      groups[group] = (groups[group] || 0) + 1;
    });
    
    // Calculate penalty based on concentration
    let penalty = 0;
    Object.values(groups).forEach(count => {
      if (count > 1) {
        // Exponential penalty for concentration
        penalty += Math.pow(count - 1, 2) * 0.1;
      }
    });
    
    return Math.min(penalty, 0.5); // Cap at 50% penalty
  }
  
  /**
   * Dynamic Kelly adjustment based on market conditions
   */
  getDynamicKellyAdjustment(vixLevel, accountPhase) {
    let adjustment = 1.0;
    
    // VIX-based adjustments
    if (vixLevel < 15) {
      adjustment *= 0.5; // Reduce in low volatility
    } else if (vixLevel > 30) {
      adjustment *= 0.3; // Significant reduction in crisis
    } else if (vixLevel > 25) {
      adjustment *= 0.6; // Moderate reduction in high vol
    }
    
    // Phase-based adjustments
    switch(accountPhase) {
      case 1: // £30-40k - Conservative
        adjustment *= 0.5;
        break;
      case 2: // £40-60k - Building
        adjustment *= 0.7;
        break;
      case 3: // £60-75k - Optimization
        adjustment *= 0.9;
        break;
      case 4: // £75k+ - Full deployment
        adjustment *= 1.0;
        break;
    }
    
    return adjustment;
  }
  
  /**
   * Calculate optimal bet size for specific Tom King strategies
   */
  calculateStrategyKelly(strategy, marketConditions = {}) {
    const { vixLevel = 20, dayOfWeek = 'Monday', timeOfDay = '10:00' } = marketConditions;
    
    // Strategy-specific win rates and payoffs from Tom King methodology
    const strategyStats = {
      '0DTE_FRIDAY': {
        winRate: 0.88,
        avgWin: 200,
        avgLoss: 800,
        requirements: {
          dayOfWeek: 'Friday',
          minVIX: 22,
          timeAfter: '10:30'
        }
      },
      'LT112': {
        winRate: 0.75,
        avgWin: 500,
        avgLoss: 1000,
        requirements: {
          dte: [45, 90],
          vixRange: [18, 30]
        }
      },
      'STRANGLE': {
        winRate: 0.70,
        avgWin: 300,
        avgLoss: 600,
        requirements: {
          dte: [30, 60],
          vixMin: 16
        }
      },
      'IPMCC': {
        winRate: 0.65,
        avgWin: 800,
        avgLoss: 400,
        requirements: {
          accountMin: 50000,
          phase: [3, 4]
        }
      }
    };
    
    const stats = strategyStats[strategy];
    if (!stats) {
      return {
        error: `Unknown strategy: ${strategy}`,
        recommendedSize: 0.02
      };
    }
    
    // Check if requirements are met
    const requirementsMet = this.checkStrategyRequirements(
      stats.requirements, 
      marketConditions
    );
    
    if (!requirementsMet.passed) {
      return {
        recommendedSize: 0,
        error: 'Strategy requirements not met',
        unmetRequirements: requirementsMet.failed
      };
    }
    
    // Calculate Kelly with strategy-specific parameters
    const kellyResult = this.calculateKellyCriterion({
      winRate: stats.winRate,
      avgWin: stats.avgWin,
      avgLoss: stats.avgLoss,
      kellyFraction: strategy === '0DTE_FRIDAY' ? 0.2 : 0.25 // More conservative for 0DTE
    });
    
    // Apply dynamic adjustments
    const dynamicAdjustment = this.getDynamicKellyAdjustment(
      vixLevel, 
      marketConditions.accountPhase || 1
    );
    
    kellyResult.recommendedSize *= dynamicAdjustment;
    kellyResult.strategy = strategy;
    kellyResult.requirementsMet = true;
    
    return kellyResult;
  }
  
  /**
   * Check if strategy requirements are met
   */
  checkStrategyRequirements(requirements, conditions) {
    const failed = [];
    
    if (requirements.dayOfWeek && conditions.dayOfWeek !== requirements.dayOfWeek) {
      failed.push(`Wrong day: need ${requirements.dayOfWeek}, got ${conditions.dayOfWeek}`);
    }
    
    if (requirements.minVIX && conditions.vixLevel < requirements.minVIX) {
      failed.push(`VIX too low: need >${requirements.minVIX}, got ${conditions.vixLevel}`);
    }
    
    if (requirements.timeAfter && conditions.timeOfDay < requirements.timeAfter) {
      failed.push(`Too early: wait until ${requirements.timeAfter}`);
    }
    
    if (requirements.accountMin && conditions.accountValue < requirements.accountMin) {
      failed.push(`Account too small: need £${requirements.accountMin}`);
    }
    
    return {
      passed: failed.length === 0,
      failed
    };
  }
  
  /**
   * Get VIX-based position adjustment
   */
  getVIXPositionAdjustment(vixRegime) {
    const adjustments = {
      'EXTREMELY_LOW': 0.6, // Reduce size significantly in complacency
      'LOW': 0.8,
      'NORMAL': 1.0,
      'ELEVATED': 1.2,
      'EXTREME': 1.5,
      'UNKNOWN': 0.8
    };
    
    return adjustments[vixRegime] || 1.0;
  }
  
  /**
   * Get strategy-based risk adjustment
   */
  getStrategyRiskAdjustment(strategy) {
    const adjustments = {
      '0DTE': 0.7,      // Higher risk, smaller size
      'LT112': 1.0,     // Baseline
      'STRANGLE': 1.1,  // Lower risk, can size up
      'IPMCC': 0.9,     // Moderate risk
      'LEAP': 0.8       // Long-term risk
    };
    
    return adjustments[strategy] || 1.0;
  }
  
  /**
   * Get correlation-based adjustment
   */
  getCorrelationAdjustment(correlation) {
    const adjustments = {
      'LOW': 1.2,     // Less correlated, can size up
      'MEDIUM': 1.0,  // Baseline
      'HIGH': 0.7,    // Highly correlated, reduce size
      'EXTREME': 0.5  // Extremely correlated, significant reduction
    };
    
    return adjustments[correlation] || 1.0;
  }
  
  /**
   * Calculate number of contracts based on BP% usage and option premium
   * @param {Object} options - Calculation options
   * @param {number} options.accountValue - Total account value
   * @param {number} options.targetBPPercent - Target BP usage as percentage (0.01 = 1%)
   * @param {number} options.optionPrice - Price per contract (x100 for actual cost)
   * @param {number} options.vixLevel - Current VIX level
   * @param {string} options.strategy - Strategy type
   * @returns {Object} Contract sizing details
   */
  calculateContractsByBP(options = {}) {
    const {
      accountValue = 50000,
      targetBPPercent = 0.02, // 2% default
      optionPrice = 1.50, // Price per share
      vixLevel = 20,
      strategy = 'STRANGLE',
      multiplier = 100 // Standard option multiplier
    } = options;
    
    // Get VIX-adjusted BP limits
    const maxBP = RiskManager.getMaxBPUsage(vixLevel) / 100;
    
    // Ensure target BP doesn't exceed VIX-based maximum
    const adjustedBP = Math.min(targetBPPercent, maxBP);
    
    // Calculate maximum dollars to allocate
    const maxDollars = accountValue * adjustedBP;
    
    // Calculate cost per contract
    const costPerContract = optionPrice * multiplier;
    
    // Calculate number of contracts (round down for safety)
    const contracts = Math.floor(maxDollars / costPerContract);
    
    // Calculate actual BP used
    const actualCost = contracts * costPerContract;
    const actualBPPercent = (actualCost / accountValue) * 100;
    
    return {
      contracts: Math.max(1, contracts), // Minimum 1 contract
      totalCost: actualCost,
      bpUsedPercent: actualBPPercent.toFixed(2),
      maxBPPercent: (maxBP * 100).toFixed(2),
      targetBPPercent: (targetBPPercent * 100).toFixed(2),
      vixRegime: VIXRegimeAnalyzer.analyzeVIXRegime(vixLevel).regime,
      recommendation: contracts > 0 ? 'PROCEED' : 'INSUFFICIENT_CAPITAL'
    };
  }
  
  /**
   * Get correlation limit based on phase
   */
  getCorrelationLimit(phase) {
    // Tom King's phase-based correlation limits
    switch(phase) {
      case 1: return 2; // Phase 1: Max 2 correlated positions
      case 2: return 2; // Phase 2: Max 2 correlated positions
      case 3: return 3; // Phase 3: Max 3 correlated positions
      case 4: return 4; // Phase 4: Max 4 correlated positions
      default: return 2;
    }
  }

  /**
   * Check correlation limits for portfolio
   */
  checkCorrelationLimits(positions = []) {
    const correlationGroups = {
      'EQUITIES': ['ES', 'MES', 'SPY', 'QQQ', 'IWM'],
      'COMMODITIES': ['MCL', 'MGC', 'GLD', 'SLV'],
      'BONDS': ['TLT', 'TBT'],
      'CURRENCIES': ['EUR', 'GBP', 'JPY']
    };
    
    const groupCounts = {};
    // Phase-based correlation limits
    const phase = accountData?.phase || this.getAccountPhase(accountData?.netLiq || 35000);
    const maxPerGroup = this.getCorrelationLimitByPhase(phase);
    
    // Count positions in each group
    positions.forEach(position => {
      const symbol = position.symbol || position.underlying;
      for (const [group, symbols] of Object.entries(correlationGroups)) {
        if (symbols.includes(symbol)) {
          groupCounts[group] = (groupCounts[group] || 0) + 1;
        }
      }
    });
    
    // Check for violations
    const violations = [];
    for (const [group, count] of Object.entries(groupCounts)) {
      if (count > maxPerGroup) {
        violations.push({
          group,
          count,
          limit: maxPerGroup,
          excess: count - maxPerGroup
        });
      }
    }
    
    return {
      passed: violations.length === 0,
      violations,
      groupCounts,
      recommendation: violations.length > 0 ? 
        `Reduce positions in: ${violations.map(v => v.group).join(', ')}` :
        'Correlation limits within acceptable range'
    };
  }

  /**
   * Get correlation limit based on account phase
   * Tom King's phase-based correlation limits
   */
  getCorrelationLimitByPhase(phase) {
    switch(phase) {
      case 1: // £30-40k
        return 2; // Max 2 positions per correlation group
      case 2: // £40-60k  
        return 3; // Max 3 positions per group
      case 3: // £60-75k
        return 3; // Max 3 positions per group
      case 4: // £75k+
        return 4; // Max 4 positions per group (more flexibility)
      default:
        return 2; // Conservative default
    }
  }

  /**
   * Get position size based on VIX level
   * Implements Tom King's VIX-based sizing
   */
  getPositionSizeByVIX(vixLevel, baseSize) {
    const bpUsage = RiskManager.getMaxBPUsage(vixLevel);
    
    // Scale position size based on VIX
    if (vixLevel < 15) {
      return baseSize * 0.8; // Reduce size in low vol
    } else if (vixLevel < 20) {
      return baseSize * 1.0; // Normal size
    } else if (vixLevel < 25) {
      return baseSize * 1.2; // Increase in elevated vol
    } else if (vixLevel < 30) {
      return baseSize * 1.5; // Larger in high vol
    } else {
      return baseSize * 0.5; // Reduce in extreme vol
    }
  }

  /**
   * Check for defensive adjustment at 21 DTE
   * Tom King's defensive management rule
   */
  checkDefensiveAdjustment(position) {
    if (!position || !position.dte) return null;
    
    if (position.dte <= 21) {
      const adjustments = [];
      
      // Check if position is challenged
      if (position.pnlPercent < -10) {
        adjustments.push({
          action: 'ROLL',
          reason: 'Position challenged at 21 DTE',
          urgency: 'HIGH'
        });
      } else if (position.pnlPercent > 50) {
        adjustments.push({
          action: 'CLOSE',
          reason: 'Take profit at 50% with 21 DTE',
          urgency: 'MEDIUM'
        });
      } else {
        adjustments.push({
          action: 'MONITOR',
          reason: 'Position within range at 21 DTE',
          urgency: 'LOW'
        });
      }
      
      return adjustments;
    }
    
    return null;
  }

  /**
   * Check for volatility spike conditions
   * Implements August 2024 crash prevention
   */
  checkVolatilitySpike(currentVIX, historicalVIX) {
    const spikeThreshold = 1.5; // 50% spike
    const absoluteThreshold = 30; // VIX > 30
    
    const isSpike = (currentVIX / historicalVIX) > spikeThreshold || 
                    currentVIX > absoluteThreshold;
    
    if (isSpike) {
      return {
        detected: true,
        severity: currentVIX > 40 ? 'EXTREME' : 'HIGH',
        actions: [
          'Reduce all positions by 50%',
          'Close all 0DTE positions',
          'Avoid new entries until VIX < 25',
          'Implement correlation limits strictly'
        ],
        vixLevel: currentVIX,
        spikeRatio: (currentVIX / historicalVIX).toFixed(2)
      };
    }
    
    return {
      detected: false,
      vixLevel: currentVIX
    };
  }

  /**
   * Monitor buying power usage
   */
  monitorBuyingPower(account) {
    const bpUsed = account.buyingPowerUsed || 0;
    const totalBP = account.buyingPower || account.netLiquidation || 0;
    const usage = totalBP > 0 ? (bpUsed / totalBP) : 0;
    
    // Get VIX-based limit
    const vixLevel = account.vixLevel || 20;
    const maxUsage = RiskManager.getMaxBPUsage(vixLevel);
    
    return {
      currentUsage: usage,
      maxAllowed: maxUsage,
      withinLimits: usage <= maxUsage,
      availableBP: totalBP - bpUsed,
      recommendation: usage > maxUsage ? 
        `Reduce BP usage from ${(usage * 100).toFixed(1)}% to ${(maxUsage * 100).toFixed(1)}%` :
        `BP usage OK: ${(usage * 100).toFixed(1)}% of ${(maxUsage * 100).toFixed(1)}% max`
    };
  }

  /**
   * Check max risk per trade (5% rule)
   */
  checkMaxRiskPerTrade(tradeRisk, accountValue) {
    const maxRisk = accountValue * 0.05; // 5% max risk
    const riskPercent = (tradeRisk / accountValue) * 100;
    
    return {
      withinLimits: tradeRisk <= maxRisk,
      tradeRisk,
      maxRisk,
      riskPercent,
      recommendation: tradeRisk > maxRisk ?
        `Reduce position size: ${riskPercent.toFixed(1)}% exceeds 5% limit` :
        `Risk acceptable: ${riskPercent.toFixed(1)}% of account`
    };
  }

  /**
   * MARGIN FORECASTING SYSTEM
   * Predicts future margin requirements based on positions and market conditions
   * Critical for preventing margin calls and optimizing capital deployment
   */
  
  /**
   * Forecast margin requirements for next N days
   * Considers VIX expansion, position decay, and market stress scenarios
   */
  forecastMarginRequirements(options = {}) {
    const {
      positions = [],
      accountData = {},
      daysToForecast = 30,
      vixLevel = 20,
      stressTest = true,
      includeWeekendTheta = true
    } = options;
    
    const forecast = {
      timestamp: new Date(),
      currentMargin: this.calculateCurrentMargin(positions, accountData),
      dailyForecasts: [],
      stressScenarios: [],
      marginCallRisk: null,
      recommendations: []
    };
    
    // Generate daily forecasts
    for (let day = 1; day <= daysToForecast; day++) {
      const dailyForecast = this.calculateDailyMarginForecast({
        positions,
        accountData,
        daysForward: day,
        vixLevel,
        includeWeekendTheta
      });
      
      forecast.dailyForecasts.push(dailyForecast);
      
      // Check for margin call risk
      if (dailyForecast.marginUsagePercent > 90) {
        if (!forecast.marginCallRisk) {
          forecast.marginCallRisk = {
            firstRiskDay: day,
            peakUsage: dailyForecast.marginUsagePercent,
            triggerEvent: dailyForecast.notes
          };
        }
      }
    }
    
    // Run stress test scenarios
    if (stressTest) {
      forecast.stressScenarios = this.runMarginStressTests({
        positions,
        accountData,
        vixLevel
      });
    }
    
    // Generate recommendations
    forecast.recommendations = this.generateMarginRecommendations(forecast);
    
    return forecast;
  }
  
  /**
   * Calculate current margin requirements
   */
  calculateCurrentMargin(positions, accountData) {
    const margin = {
      initialMargin: 0,
      maintenanceMargin: 0,
      buyingPowerUsed: 0,
      excessLiquidity: 0
    };
    
    // Calculate margin for each position
    positions.forEach(position => {
      const positionMargin = this.calculatePositionMargin(position);
      margin.initialMargin += positionMargin.initial;
      margin.maintenanceMargin += positionMargin.maintenance;
      margin.buyingPowerUsed += positionMargin.bpUsed;
    });
    
    // Calculate excess liquidity
    const netLiq = accountData.netLiquidation || accountData.accountValue || 50000;
    margin.excessLiquidity = netLiq - margin.maintenanceMargin;
    margin.marginUsagePercent = (margin.maintenanceMargin / netLiq) * 100;
    
    // Add safety metrics
    margin.marginCallDistance = margin.excessLiquidity / margin.maintenanceMargin;
    margin.safetyRating = this.getMarginSafetyRating(margin.marginUsagePercent);
    
    return margin;
  }
  
  /**
   * Calculate margin for individual position
   */
  calculatePositionMargin(position) {
    const margin = {
      initial: 0,
      maintenance: 0,
      bpUsed: 0
    };
    
    // Different margin calculations based on position type
    switch (position.type) {
      case 'OPTION':
        margin.initial = this.calculateOptionMargin(position);
        margin.maintenance = margin.initial * 0.75; // 75% of initial for maintenance
        margin.bpUsed = margin.initial;
        break;
        
      case 'FUTURE':
        margin.initial = this.calculateFuturesMargin(position);
        margin.maintenance = margin.initial * 0.9; // 90% for futures
        margin.bpUsed = margin.initial;
        break;
        
      case 'SPREAD':
        margin.initial = this.calculateSpreadMargin(position);
        margin.maintenance = margin.initial * 0.8;
        margin.bpUsed = margin.initial;
        break;
        
      default:
        // Conservative estimate for unknown types
        const notional = (position.quantity || 1) * (position.price || 100) * 100;
        margin.initial = notional * 0.2; // 20% margin requirement
        margin.maintenance = margin.initial * 0.75;
        margin.bpUsed = margin.initial;
    }
    
    return margin;
  }
  
  /**
   * Calculate option margin requirements
   */
  calculateOptionMargin(position) {
    const { quantity = 1, strike = 100, underlying = 100, type = 'CALL' } = position;
    
    // Naked option margin calculation (simplified)
    const otm = type === 'CALL' ? 
      Math.max(0, strike - underlying) : 
      Math.max(0, underlying - strike);
    
    const percentageRequirement = 0.2; // 20% of underlying
    const minimumRequirement = 250; // Minimum per contract
    
    const marginPerContract = Math.max(
      (underlying * 100 * percentageRequirement) - otm,
      minimumRequirement
    );
    
    return marginPerContract * Math.abs(quantity);
  }
  
  /**
   * Calculate futures margin requirements
   */
  calculateFuturesMargin(position) {
    const { symbol = '', quantity = 1 } = position;
    
    // Futures margin requirements (approximate)
    const marginRequirements = {
      'MES': 1500,   // Micro E-mini S&P
      'MNQ': 1700,   // Micro E-mini Nasdaq
      'MCL': 1000,   // Micro Crude Oil
      'MGC': 1000,   // Micro Gold
      'ES': 15000,   // E-mini S&P
      'NQ': 17000,   // E-mini Nasdaq
      'CL': 10000,   // Crude Oil
      'GC': 10000    // Gold
    };
    
    const marginPerContract = marginRequirements[symbol] || 2000;
    return marginPerContract * Math.abs(quantity);
  }
  
  /**
   * Calculate spread margin requirements
   */
  calculateSpreadMargin(position) {
    const { spreadType = 'VERTICAL', width = 5, quantity = 1 } = position;
    
    // Spread margin calculations
    switch (spreadType) {
      case 'VERTICAL':
        return width * 100 * Math.abs(quantity); // Max loss is spread width
        
      case 'IRON_CONDOR':
        return width * 100 * Math.abs(quantity); // One side's width
        
      case 'BUTTERFLY':
        return width * 50 * Math.abs(quantity); // Half width for butterflies
        
      case 'CALENDAR':
        return width * 150 * Math.abs(quantity); // Higher for calendars
        
      default:
        return width * 100 * Math.abs(quantity);
    }
  }
  
  /**
   * Calculate daily margin forecast
   */
  calculateDailyMarginForecast(options) {
    const { positions, accountData, daysForward, vixLevel, includeWeekendTheta } = options;
    
    const forecast = {
      day: daysForward,
      date: new Date(Date.now() + daysForward * 24 * 60 * 60 * 1000),
      estimatedMargin: 0,
      marginUsagePercent: 0,
      vixImpact: 1.0,
      thetaDecay: 0,
      notes: []
    };
    
    // Adjust for weekend theta if applicable
    const isWeekend = [0, 6].includes(forecast.date.getDay());
    const thetaMultiplier = (includeWeekendTheta && isWeekend) ? 3 : 1;
    
    // Calculate VIX impact on margin
    const vixTrend = this.predictVIXTrend(vixLevel, daysForward);
    forecast.vixImpact = vixTrend.multiplier;
    
    // Calculate margin for each position at future date
    positions.forEach(position => {
      const futureMargin = this.calculateFuturePositionMargin({
        position,
        daysForward,
        vixMultiplier: forecast.vixImpact,
        thetaMultiplier
      });
      
      forecast.estimatedMargin += futureMargin.margin;
      forecast.thetaDecay += futureMargin.thetaDecay;
    });
    
    // Calculate usage percentage
    const netLiq = accountData.netLiquidation || 50000;
    forecast.marginUsagePercent = (forecast.estimatedMargin / netLiq) * 100;
    
    // Add notes for significant events
    if (forecast.marginUsagePercent > 80) {
      forecast.notes.push('⚠️ High margin usage warning');
    }
    if (vixTrend.spike) {
      forecast.notes.push('📈 VIX spike expected');
    }
    if (isWeekend) {
      forecast.notes.push('📅 Weekend theta acceleration');
    }
    
    // Check for expiration dates
    const expiringPositions = positions.filter(p => 
      p.daysToExpiration && p.daysToExpiration <= daysForward
    );
    if (expiringPositions.length > 0) {
      forecast.notes.push(`🎯 ${expiringPositions.length} positions expiring`);
    }
    
    return forecast;
  }
  
  /**
   * Calculate future margin for a position
   */
  calculateFuturePositionMargin(options) {
    const { position, daysForward, vixMultiplier, thetaMultiplier } = options;
    
    // Get current margin
    const currentMargin = this.calculatePositionMargin(position);
    
    // Adjust for time decay (options lose value over time)
    const timeDecayFactor = position.type === 'OPTION' ? 
      Math.exp(-0.02 * daysForward) : // 2% daily decay approximation
      1.0;
    
    // Adjust for VIX changes (higher VIX = higher margin requirements)
    const vixAdjustment = vixMultiplier;
    
    // Calculate theta decay
    const theta = position.theta || 0;
    const thetaDecay = theta * daysForward * thetaMultiplier;
    
    // Future margin estimate
    const futureMargin = currentMargin.initial * timeDecayFactor * vixAdjustment;
    
    return {
      margin: futureMargin,
      thetaDecay,
      original: currentMargin.initial,
      adjustments: {
        timeDecay: timeDecayFactor,
        vixImpact: vixAdjustment
      }
    };
  }
  
  /**
   * Predict VIX trend for forecasting
   */
  predictVIXTrend(currentVIX, daysForward) {
    // Mean reversion assumption
    const longTermMean = 19; // Historical VIX mean
    const reversionSpeed = 0.05; // 5% daily reversion
    
    // Calculate expected VIX
    const expectedVIX = currentVIX + (longTermMean - currentVIX) * reversionSpeed * daysForward;
    
    // Check for potential spikes (simplified model)
    const spikeProb = this.calculateVIXSpikeProbability(currentVIX, daysForward);
    const spike = spikeProb > 0.2;
    
    // Calculate margin multiplier based on VIX change
    const vixChange = expectedVIX / currentVIX;
    const multiplier = spike ? vixChange * 1.5 : vixChange;
    
    return {
      currentVIX,
      expectedVIX,
      spike,
      spikeProb,
      multiplier: Math.max(0.8, Math.min(2.0, multiplier)) // Cap between 0.8x and 2x
    };
  }
  
  /**
   * Calculate probability of VIX spike
   */
  calculateVIXSpikeProbability(currentVIX, daysForward) {
    // Simplified spike probability model
    if (currentVIX < 12) return 0.15 * (daysForward / 30); // Higher spike prob in low vol
    if (currentVIX < 15) return 0.10 * (daysForward / 30);
    if (currentVIX < 20) return 0.08 * (daysForward / 30);
    if (currentVIX < 25) return 0.12 * (daysForward / 30);
    return 0.20 * (daysForward / 30); // Already elevated, could spike more
  }
  
  /**
   * Run margin stress test scenarios
   */
  runMarginStressTests(options) {
    const { positions, accountData, vixLevel } = options;
    
    const scenarios = [
      {
        name: 'VIX Spike (50%)',
        vixMultiplier: 1.5,
        marketMove: -0.05 // 5% market drop
      },
      {
        name: 'August 2024 Repeat',
        vixMultiplier: 2.5,
        marketMove: -0.12 // 12% crash
      },
      {
        name: 'Gradual Increase',
        vixMultiplier: 1.2,
        marketMove: -0.02
      },
      {
        name: 'Flash Crash',
        vixMultiplier: 3.0,
        marketMove: -0.08
      },
      {
        name: 'Correlation Crisis',
        vixMultiplier: 2.0,
        marketMove: -0.10,
        correlationMultiplier: 2.0 // All positions move together
      }
    ];
    
    return scenarios.map(scenario => {
      const stressResult = this.calculateStressScenario({
        positions,
        accountData,
        scenario,
        currentVIX: vixLevel
      });
      
      return {
        ...scenario,
        ...stressResult,
        survives: stressResult.marginUsagePercent < 100,
        marginCallRisk: stressResult.marginUsagePercent > 90 ? 'HIGH' : 
                       stressResult.marginUsagePercent > 75 ? 'MEDIUM' : 'LOW'
      };
    });
  }
  
  /**
   * Calculate stress scenario impact
   */
  calculateStressScenario(options) {
    const { positions, accountData, scenario, currentVIX } = options;
    
    let totalMargin = 0;
    let totalLoss = 0;
    
    // Calculate impact on each position
    positions.forEach(position => {
      // Adjust margin for scenario
      const baseMargin = this.calculatePositionMargin(position);
      const stressedMargin = baseMargin.initial * scenario.vixMultiplier;
      
      // Calculate P&L impact
      const delta = position.delta || 0.5;
      const gamma = position.gamma || 0.01;
      const vega = position.vega || 0.1;
      
      // Price impact from market move
      const priceImpact = delta * scenario.marketMove * position.underlyingPrice * 100;
      const gammaImpact = 0.5 * gamma * Math.pow(scenario.marketMove * position.underlyingPrice, 2) * 100;
      const vegaImpact = vega * (currentVIX * (scenario.vixMultiplier - 1));
      
      const positionLoss = (priceImpact + gammaImpact + vegaImpact) * position.quantity;
      
      totalMargin += stressedMargin;
      totalLoss += Math.min(0, positionLoss); // Only count losses
    });
    
    const netLiq = accountData.netLiquidation || 50000;
    const stressedNetLiq = netLiq + totalLoss;
    
    return {
      estimatedMargin: totalMargin,
      estimatedLoss: Math.abs(totalLoss),
      stressedNetLiq,
      marginUsagePercent: (totalMargin / stressedNetLiq) * 100,
      excessLiquidity: stressedNetLiq - totalMargin,
      daysToMarginCall: this.estimateDaysToMarginCall(stressedNetLiq, totalMargin)
    };
  }
  
  /**
   * Estimate days until margin call
   */
  estimateDaysToMarginCall(netLiq, currentMargin) {
    const marginCallLevel = netLiq * 0.9; // Margin call at 90% usage
    const dailyDecay = netLiq * 0.01; // Assume 1% daily loss
    
    if (currentMargin >= marginCallLevel) return 0;
    
    const buffer = marginCallLevel - currentMargin;
    return Math.floor(buffer / dailyDecay);
  }
  
  /**
   * Get margin safety rating
   */
  getMarginSafetyRating(usagePercent) {
    if (usagePercent < 30) return 'EXCELLENT';
    if (usagePercent < 50) return 'GOOD';
    if (usagePercent < 70) return 'FAIR';
    if (usagePercent < 85) return 'POOR';
    return 'CRITICAL';
  }
  
  /**
   * Generate margin recommendations
   */
  generateMarginRecommendations(forecast) {
    const recommendations = [];
    
    // Check current margin usage
    if (forecast.currentMargin.marginUsagePercent > 70) {
      recommendations.push({
        priority: 'HIGH',
        action: 'REDUCE_POSITIONS',
        reason: `Current margin usage ${forecast.currentMargin.marginUsagePercent.toFixed(1)}% exceeds safe threshold`,
        suggestion: 'Close or reduce lowest performing positions'
      });
    }
    
    // Check margin call risk
    if (forecast.marginCallRisk) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'IMMEDIATE_ACTION',
        reason: `Margin call risk detected in ${forecast.marginCallRisk.firstRiskDay} days`,
        suggestion: 'Reduce positions immediately or add capital'
      });
    }
    
    // Check stress test results
    const failedStressTests = forecast.stressScenarios?.filter(s => !s.survives) || [];
    if (failedStressTests.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'IMPROVE_RESILIENCE',
        reason: `Portfolio fails ${failedStressTests.length} stress scenarios`,
        suggestion: 'Add hedges or reduce leverage'
      });
    }
    
    // Check for margin efficiency
    if (forecast.currentMargin.marginUsagePercent < 30) {
      recommendations.push({
        priority: 'LOW',
        action: 'OPTIMIZE_CAPITAL',
        reason: 'Low margin usage indicates underutilized capital',
        suggestion: 'Consider adding positions within risk limits'
      });
    }
    
    return recommendations;
  }
  
  /**
   * Calculate position impact on margin
   * Analyzes how adding/removing a position affects overall margin
   */
  calculatePositionImpact(options = {}) {
    const {
      currentPositions = [],
      newPosition = null,
      accountData = {},
      action = 'ADD' // ADD or REMOVE
    } = options;
    
    // Calculate current state
    const currentMargin = this.calculateCurrentMargin(currentPositions, accountData);
    
    // Calculate new state
    let modifiedPositions;
    if (action === 'ADD' && newPosition) {
      modifiedPositions = [...currentPositions, newPosition];
    } else if (action === 'REMOVE' && newPosition) {
      modifiedPositions = currentPositions.filter(p => 
        p.symbol !== newPosition.symbol || p.strike !== newPosition.strike
      );
    } else {
      return { error: 'Invalid action or missing position' };
    }
    
    const newMargin = this.calculateCurrentMargin(modifiedPositions, accountData);
    
    // Calculate impact
    const impact = {
      action,
      position: newPosition,
      currentMarginUsage: currentMargin.marginUsagePercent,
      newMarginUsage: newMargin.marginUsagePercent,
      marginChange: newMargin.maintenanceMargin - currentMargin.maintenanceMargin,
      marginChangePercent: ((newMargin.marginUsagePercent - currentMargin.marginUsagePercent) / 
                           currentMargin.marginUsagePercent * 100),
      newExcessLiquidity: newMargin.excessLiquidity,
      liquidityChange: newMargin.excessLiquidity - currentMargin.excessLiquidity,
      approved: newMargin.marginUsagePercent < 85, // Max 85% usage
      warnings: []
    };
    
    // Add warnings
    if (newMargin.marginUsagePercent > 70) {
      impact.warnings.push('Margin usage exceeds 70% - monitor closely');
    }
    if (newMargin.marginUsagePercent > 85) {
      impact.warnings.push('CRITICAL: Margin usage too high - trade rejected');
    }
    if (impact.liquidityChange < -5000) {
      impact.warnings.push('Significant liquidity reduction');
    }
    
    return impact;
  }
  
  /**
   * Dynamic position sizing based on available margin
   * Calculates optimal position size considering margin constraints
   */
  calculateDynamicPositionSize(options = {}) {
    const {
      strategy = 'STRANGLE',
      accountData = {},
      currentPositions = [],
      targetMarginUsage = 0.65, // Target 65% margin usage
      maxPositionMargin = 0.15, // Max 15% of margin per position
      vixLevel = 20
    } = options;
    
    // Get current margin state
    const currentMargin = this.calculateCurrentMargin(currentPositions, accountData);
    const netLiq = accountData.netLiquidation || 50000;
    
    // Calculate available margin for new positions
    const targetMargin = netLiq * targetMarginUsage;
    const availableMargin = targetMargin - currentMargin.maintenanceMargin;
    
    if (availableMargin <= 0) {
      return {
        contracts: 0,
        reason: 'No margin available for new positions',
        currentUsage: currentMargin.marginUsagePercent,
        targetUsage: targetMarginUsage * 100
      };
    }
    
    // Calculate position size based on strategy
    const strategyMargin = this.estimateStrategyMargin(strategy, vixLevel);
    const maxPositionMarginDollars = netLiq * maxPositionMargin;
    
    // Use the smaller of available margin or max position size
    const positionMargin = Math.min(availableMargin, maxPositionMarginDollars);
    
    // Calculate number of contracts
    const contracts = Math.floor(positionMargin / strategyMargin.perContract);
    
    // Verify the position won't exceed limits
    const finalMarginUsage = (currentMargin.maintenanceMargin + (contracts * strategyMargin.perContract)) / netLiq;
    
    return {
      contracts: Math.max(0, contracts),
      marginPerContract: strategyMargin.perContract,
      totalMarginRequired: contracts * strategyMargin.perContract,
      currentMarginUsage: currentMargin.marginUsagePercent,
      projectedMarginUsage: finalMarginUsage * 100,
      availableMargin,
      strategy,
      vixAdjustment: strategyMargin.vixAdjustment,
      approved: finalMarginUsage <= 0.85,
      recommendation: contracts > 0 ? 
        `Trade ${contracts} contracts using ${(finalMarginUsage * 100).toFixed(1)}% total margin` :
        'Insufficient margin for position'
    };
  }
  
  /**
   * Estimate margin requirements for different strategies
   */
  estimateStrategyMargin(strategy, vixLevel) {
    // Base margin requirements per contract (approximate)
    const baseMargins = {
      'STRANGLE': 2500,
      'STRADDLE': 3500,
      'IRON_CONDOR': 500,
      'VERTICAL': 500,
      'BUTTERFLY': 250,
      'CALENDAR': 1500,
      '0DTE': 1000,
      'LT112': 2000,
      'NAKED_PUT': 4000,
      'COVERED_CALL': 0 // No additional margin for covered
    };
    
    const baseMargin = baseMargins[strategy] || 2000;
    
    // Adjust for VIX level
    let vixAdjustment = 1.0;
    if (vixLevel < 15) vixAdjustment = 0.8;
    else if (vixLevel > 25) vixAdjustment = 1.3;
    else if (vixLevel > 30) vixAdjustment = 1.5;
    
    return {
      perContract: baseMargin * vixAdjustment,
      baseMargin,
      vixAdjustment,
      vixLevel
    };
  }
  
  /**
   * Monitor margin health in real-time
   */
  monitorMarginHealth(positions, accountData) {
    const health = {
      timestamp: new Date(),
      status: 'HEALTHY',
      alerts: [],
      metrics: {}
    };
    
    // Calculate current margin metrics
    const margin = this.calculateCurrentMargin(positions, accountData);
    health.metrics = margin;
    
    // Check margin usage
    if (margin.marginUsagePercent > 85) {
      health.status = 'CRITICAL';
      health.alerts.push({
        level: 'CRITICAL',
        message: `Margin usage ${margin.marginUsagePercent.toFixed(1)}% - Immediate action required`,
        action: 'Reduce positions or add capital immediately'
      });
    } else if (margin.marginUsagePercent > 70) {
      health.status = 'WARNING';
      health.alerts.push({
        level: 'WARNING',
        message: `Margin usage ${margin.marginUsagePercent.toFixed(1)}% - Approaching limits`,
        action: 'Consider reducing positions'
      });
    } else if (margin.marginUsagePercent > 60) {
      health.status = 'CAUTION';
      health.alerts.push({
        level: 'INFO',
        message: `Margin usage ${margin.marginUsagePercent.toFixed(1)}% - Monitor closely`,
        action: 'Normal range but stay vigilant'
      });
    }
    
    // Check excess liquidity
    if (margin.excessLiquidity < 5000) {
      health.alerts.push({
        level: 'WARNING',
        message: `Low excess liquidity: £${margin.excessLiquidity.toFixed(0)}`,
        action: 'Maintain minimum £5000 buffer'
      });
    }
    
    // Check margin call distance
    if (margin.marginCallDistance < 0.2) {
      health.alerts.push({
        level: 'CRITICAL',
        message: 'Close to margin call threshold',
        action: 'Reduce positions immediately'
      });
    }
    
    // Add recommendations
    health.recommendations = this.getMarginHealthRecommendations(health);
    
    return health;
  }
  
  /**
   * Get margin health recommendations
   */
  getMarginHealthRecommendations(health) {
    const recommendations = [];
    
    if (health.status === 'CRITICAL') {
      recommendations.push('🚨 IMMEDIATE: Close lowest performing positions');
      recommendations.push('🚨 IMMEDIATE: Avoid any new positions');
      recommendations.push('🚨 Consider adding capital if possible');
    } else if (health.status === 'WARNING') {
      recommendations.push('⚠️ Reduce position sizes on new trades');
      recommendations.push('⚠️ Close any underperforming positions');
      recommendations.push('⚠️ Monitor margin usage hourly');
    } else if (health.status === 'CAUTION') {
      recommendations.push('📊 Monitor margin usage daily');
      recommendations.push('📊 Maintain current position sizes');
    } else {
      recommendations.push('✅ Margin health good');
      recommendations.push('✅ Can consider new positions within limits');
    }
    
    return recommendations;
  }
}

// Export all classes and functions
module.exports = {
  RiskManager,
  VIXRegimeAnalyzer,
  BPLimitsManager,
  August5DisasterPrevention
};