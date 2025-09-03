/**
 * Risk Manager Module
 * VIX regime detection, BP limits, and comprehensive risk management
 * Implements August 5, 2024 lessons and emergency protocols
 */

const DEBUG = process.env.NODE_ENV !== 'production';

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
    
    // Term structure inversion (short-term vol > long-term)
    const vix9Day = marketData.VIX9D || vix;
    const vix30Day = marketData.VIX || vix;
    if (vix9Day > vix30Day) {
      indicators.termStructureInversion = true;
      indicators.warningCount++;
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
  constructor() {
    this.lastVIXLevel = null;
    this.lastAnalysis = null;
    this.alertHistory = [];
    this.emergencyMode = false;
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
    
    // Overall risk assessment
    const overallRisk = this.calculateOverallRisk(
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols
    );
    
    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(
      vixAnalysis,
      bpOptimization,
      august5Analysis,
      emergencyProtocols
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
      recommendations,
      alerts: newAlerts,
      emergencyMode: this.emergencyMode
    };
  }
  
  calculateOverallRisk(vixAnalysis, bpOptimization, august5Analysis, emergencyProtocols) {
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
  
  generateRiskRecommendations(vixAnalysis, bpOptimization, august5Analysis, emergencyProtocols) {
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
      confidence = 0.8
    } = options;
    
    // Base position size as percentage of account
    let baseSize = riskPerTrade * confidence;
    
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
        emergencyMode: this.emergencyMode
      },
      recommendation: finalSize > 0.05 ? 'NORMAL' : finalSize > 0.02 ? 'CONSERVATIVE' : 'DEFENSIVE'
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
}

// Export all classes and functions
module.exports = {
  RiskManager,
  VIXRegimeAnalyzer,
  BPLimitsManager,
  August5DisasterPrevention
};