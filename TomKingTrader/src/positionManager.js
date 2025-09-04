/**
 * Position Manager Module
 * Complete position health scoring, correlation tracking, and exit management
 * Based on Tom King Trading Framework specifications and PDF references
 */

const DEBUG = process.env.NODE_ENV !== 'production';
const { SectorRotationTracker } = require('./sectorRotationTracker');

/**
 * Correlation Groups Definition (PDF Page 12)
 * Critical for preventing August 5, 2024 type disasters
 */
const CORRELATION_GROUPS = {
  // Group A1: ES & Major Index Products (Maximum correlation risk)
  A1: ['ES', 'MES', 'SPY', 'QQQ', 'IWM', 'SPX', 'SPXW'],
  
  // Group A2: International Equity
  A2: ['NQ', 'RTY', 'FTSE', 'DAX', 'Nikkei'],
  
  // Group B1: Energy Complex
  B1: ['CL', 'MCL', 'NG', 'RB', 'HO', 'XLE', 'XOP'],
  
  // Group C1: Precious Metals
  C1: ['GC', 'MGC', 'SI', 'GLD', 'SLV'],
  
  // Group D1: Agriculture
  D1: ['ZC', 'ZS', 'ZW', 'LE', 'HE', 'KC', 'SB', 'CC'],
  
  // Group E: Fixed Income
  E: ['ZB', 'ZN', 'ZF', 'ZT', 'TLT'],
  
  // Group F: Currencies  
  F: ['6E', '6B', '6A', '6C', '6J', '6S', 'M6E', 'DXY']
};

/**
 * Position Health Calculator
 * Calculates comprehensive health scores based on DTE, P&L, and risk factors
 */
class PositionHealthCalculator {
  static calculateHealthScore(position) {
    let score = 100; // Start with perfect health
    const warnings = [];
    const actions = [];
    
    const dte = position.dte || 0;
    const pl = position.pl || 0;
    const strategy = position.strategy?.toUpperCase();
    
    // DTE-based scoring (PDF Pages 9-10 - Management Protocols)
    if (dte === 0) {
      score -= 60;
      warnings.push('🚨 0 DTE - IMMEDIATE ACTION REQUIRED');
      actions.push('CLOSE_IMMEDIATELY');
    } else if (dte <= 3) {
      score -= 40;
      warnings.push('⚠️ Very low DTE - high gamma risk');
      actions.push('CLOSE_TODAY');
    } else if (dte <= 7) {
      score -= 25;
      warnings.push('⏰ Low DTE - prepare to close');
      actions.push('PREPARE_EXIT');
    } else if (dte <= 21) {
      score -= 10;
      warnings.push('📅 Approaching 21 DTE management threshold');
      actions.push('MONITOR_CLOSELY');
    }
    
    // P&L-based scoring
    if (pl >= 50) {
      score += 10; // Bonus for profitable position
      warnings.push('✅ 50% rule triggered - CLOSE FOR PROFIT');
      actions.push('TAKE_PROFIT');
    } else if (pl >= 25) {
      score += 5;
      warnings.push('🎯 Approaching 50% profit target');
      actions.push('PREPARE_PROFIT_TAKE');
    } else if (pl <= -200) {
      score -= 50;
      warnings.push('🚨 Major loss - defensive action required');
      actions.push('DEFEND_OR_EXIT');
    } else if (pl <= -100) {
      score -= 30;
      warnings.push('⚠️ Significant loss - monitor closely');
      actions.push('REVIEW_DEFENSE');
    } else if (pl <= -50) {
      score -= 15;
      warnings.push('📉 Moderate loss - watch for defense triggers');
      actions.push('MONITOR_DEFENSE');
    }
    
    // Strategy-specific adjustments
    if (strategy === 'LT112') {
      if (position.entryWeek && position.entryWeek >= 3) {
        score -= 15;
        warnings.push('⏰ Late entry week - reduced win probability');
      }
      
      // LT112 specific management at 21 DTE
      if (dte <= 21 && pl < 25) {
        score -= 20;
        warnings.push('📊 LT112 at 21 DTE without 25% profit - consider rolling');
        actions.push('CONSIDER_ROLL');
      }
    }
    
    if (strategy === '0DTE') {
      // Higher urgency for 0DTE positions
      if (dte === 0) {
        score = Math.min(score, 20); // Cap at 20 for 0DTE
        warnings.push('⚡ 0DTE position - expires TODAY');
      }
    }
    
    if (strategy === 'STRANGLE' || strategy === 'IRON_CONDOR') {
      // Check for tested side
      if (position.testedSide) {
        score -= 25;
        warnings.push(`📍 ${position.testedSide} side tested - manage accordingly`);
        actions.push('MANAGE_TESTED_SIDE');
      }
    }
    
    // Ensure score stays within bounds
    score = Math.max(0, Math.min(100, score));
    
    // Determine overall action
    let primaryAction = 'HOLD';
    if (actions.includes('CLOSE_IMMEDIATELY') || actions.includes('TAKE_PROFIT')) {
      primaryAction = actions.includes('CLOSE_IMMEDIATELY') ? 'CLOSE_IMMEDIATELY' : 'TAKE_PROFIT';
    } else if (actions.includes('CLOSE_TODAY')) {
      primaryAction = 'CLOSE_TODAY';
    } else if (actions.includes('DEFEND_OR_EXIT')) {
      primaryAction = 'DEFEND_OR_EXIT';
    } else if (actions.includes('PREPARE_EXIT')) {
      primaryAction = 'PREPARE_EXIT';
    } else if (actions.includes('MONITOR_CLOSELY')) {
      primaryAction = 'MONITOR_CLOSELY';
    }
    
    return {
      score: Math.round(score),
      healthLevel: this.getHealthLevel(score),
      primaryAction,
      warnings,
      allActions: actions,
      exitTrigger: score <= 40,
      profitTarget: pl >= 50,
      defensiveMode: pl <= -100
    };
  }
  
  static getHealthLevel(score) {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'FAIR';
    if (score >= 40) return 'POOR';
    return 'CRITICAL';
  }
  
  /**
   * Generate health alerts for all positions
   * Returns positions requiring immediate attention
   */
  static generateHealthAlerts(positions) {
    const alerts = {
      critical: [],      // Score < 20 - Immediate action required
      urgent: [],        // Score 20-39 - Action today
      warning: [],       // Score 40-59 - Monitor closely  
      opportunities: []  // Score 60+ with profit > 40%
    };
    
    for (const position of positions) {
      const health = this.calculateHealthScore(position);
      const alertData = {
        symbol: position.symbol,
        strategy: position.strategy,
        dte: position.daysToExpiration,
        pl: position.plPercent,
        score: health.score,
        level: health.healthLevel,
        action: health.primaryAction,
        warnings: health.warnings
      };
      
      // Categorize by urgency
      if (health.score < 20) {
        alerts.critical.push({
          ...alertData,
          priority: 1,
          message: `🚨 CRITICAL: ${position.symbol} - ${health.primaryAction}`,
          reason: health.warnings[0] || 'Score below critical threshold'
        });
      } else if (health.score < 40) {
        alerts.urgent.push({
          ...alertData,
          priority: 2,
          message: `⚠️ URGENT: ${position.symbol} - ${health.primaryAction}`,
          reason: health.warnings[0] || 'Position requires attention today'
        });
      } else if (health.score < 60) {
        alerts.warning.push({
          ...alertData,
          priority: 3,
          message: `📊 WARNING: ${position.symbol} - Monitor closely`,
          reason: health.warnings[0] || 'Position approaching management point'
        });
      } else if (health.profitTarget) {
        alerts.opportunities.push({
          ...alertData,
          priority: 4,
          message: `💰 PROFIT TARGET: ${position.symbol} - Consider taking profit at ${position.plPercent.toFixed(1)}%`,
          reason: 'Profit target reached'
        });
      }
    }
    
    return alerts;
  }
  
  /**
   * Monitor positions continuously and trigger alerts
   */
  static startHealthMonitoring(positions, callback, interval = 60000) {
    const checkHealth = () => {
      const alerts = this.generateHealthAlerts(positions);
      const totalAlerts = alerts.critical.length + alerts.urgent.length + 
                         alerts.warning.length + alerts.opportunities.length;
      
      if (totalAlerts > 0) {
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        logger.info('SYSTEM', '📊 POSITION HEALTH ALERT SUMMARY');
        logger.info('SYSTEM', '='.repeat(60));
        
        if (alerts.critical.length > 0) {
          logger.info('SYSTEM', '\n🚨 CRITICAL ALERTS (Immediate Action Required):');
          alerts.critical.forEach(alert => {
            logger.info('SYSTEM', `  • ${alert.symbol}: Score ${alert.score} - ${alert.action}`);
            logger.info('SYSTEM', `    Reason: ${alert.reason}`);
          });
        }
        
        if (alerts.urgent.length > 0) {
          logger.info('SYSTEM', '\n⚠️ URGENT ALERTS (Action Required Today):');
          alerts.urgent.forEach(alert => {
            logger.info('SYSTEM', `  • ${alert.symbol}: Score ${alert.score} - ${alert.action}`);
            logger.info('SYSTEM', `    Reason: ${alert.reason}`);
          });
        }
        
        if (alerts.warning.length > 0) {
          logger.info('SYSTEM', '\n📊 WARNING ALERTS (Monitor Closely):');
          alerts.warning.forEach(alert => {
            logger.info('SYSTEM', `  • ${alert.symbol}: Score ${alert.score}`);
            logger.info('SYSTEM', `    Reason: ${alert.reason}`);
          });
        }
        
        if (alerts.opportunities.length > 0) {
          logger.info('SYSTEM', '\n💰 PROFIT OPPORTUNITIES:');
          alerts.opportunities.forEach(alert => {
            logger.info('SYSTEM', `  • ${alert.symbol}: P&L ${alert.pl.toFixed(1)}% - Consider closing`);
          });
        }
        
        logger.info('SYSTEM', '\n' + '='.repeat(60));
        
        // Execute callback with alerts
        if (callback) {
          callback(alerts);
        }
      }
      
      return alerts;
    };
    
    // Initial check
    checkHealth();
    
    // Set up monitoring interval
    const monitoringId = setInterval(checkHealth, interval);
    
    // Return stop function
    return () => clearInterval(monitoringId);
  }
}

/**
 * Correlation Tracker
 * Monitors and prevents concentration risk per August 5, 2024 lessons
 */
class CorrelationTracker {
  constructor() {
    this.positions = [];
    this.limits = {
      maxPerGroup: 2,     // PDF Page 12: Maximum 2 positions per group
      phase4MaxPerGroup: 3 // Phase 4 allows 3 positions per group
    };
  }
  
  updatePositions(positions) {
    this.positions = positions.map(pos => ({
      ...pos,
      correlationGroup: this.getCorrelationGroup(pos.ticker)
    }));
  }
  
  getCorrelationGroup(ticker) {
    for (const [groupName, tickers] of Object.entries(CORRELATION_GROUPS)) {
      if (tickers.includes(ticker.toUpperCase())) {
        return groupName;
      }
    }
    return 'UNCORRELATED';
  }
  
  checkConcentrationLimits(phase = 1) {
    const maxPerGroup = phase >= 4 ? this.limits.phase4MaxPerGroup : this.limits.maxPerGroup;
    const groupCounts = {};
    const violations = [];
    
    // Count positions per group
    this.positions.forEach(position => {
      const group = position.correlationGroup;
      if (group !== 'UNCORRELATED') {
        groupCounts[group] = (groupCounts[group] || 0) + 1;
      }
    });
    
    // Check for violations
    for (const [group, count] of Object.entries(groupCounts)) {
      if (count > maxPerGroup) {
        violations.push({
          group,
          count,
          limit: maxPerGroup,
          severity: 'HIGH',
          message: `🚨 CORRELATION VIOLATION: ${count} positions in group ${group} (limit: ${maxPerGroup})`,
          positions: this.positions.filter(p => p.correlationGroup === group)
        });
      } else if (count === maxPerGroup) {
        violations.push({
          group,
          count,
          limit: maxPerGroup,
          severity: 'WARNING',
          message: `⚠️ GROUP AT LIMIT: ${count} positions in group ${group} (limit: ${maxPerGroup})`,
          positions: this.positions.filter(p => p.correlationGroup === group)
        });
      }
    }
    
    return {
      violations,
      groupCounts,
      isViolated: violations.some(v => v.severity === 'HIGH'),
      atCapacity: violations.some(v => v.severity === 'WARNING'),
      august5Risk: this.assessAugust5Risk(groupCounts, maxPerGroup)
    };
  }
  
  assessAugust5Risk(groupCounts, maxPerGroup) {
    // August 5, 2024 had 6+ correlated positions in ES complex
    const highRiskGroups = ['A1', 'A2']; // Equity groups most at risk
    
    for (const group of highRiskGroups) {
      const count = groupCounts[group] || 0;
      if (count > maxPerGroup) {
        return {
          risk: 'HIGH',
          message: `🚨 AUGUST 5 RISK: ${count} positions in ${group} group exceeds safe limit`,
          recommendation: 'Close excess positions immediately',
          historicalReference: 'August 5, 2024 - £308k loss from correlation exposure'
        };
      }
    }
    
    return { risk: 'LOW' };
  }
  
  canAddPosition(ticker, phase = 1) {
    const group = this.getCorrelationGroup(ticker);
    if (group === 'UNCORRELATED') {
      return { allowed: true, reason: 'No correlation restrictions' };
    }
    
    const maxPerGroup = phase >= 4 ? this.limits.phase4MaxPerGroup : this.limits.maxPerGroup;
    const currentCount = this.positions.filter(p => p.correlationGroup === group).length;
    
    if (currentCount >= maxPerGroup) {
      return {
        allowed: false,
        reason: `Group ${group} at maximum (${currentCount}/${maxPerGroup})`,
        action: 'Close existing position in this group first'
      };
    }
    
    return {
      allowed: true,
      reason: `Group ${group} has capacity (${currentCount}/${maxPerGroup})`
    };
  }
}

/**
 * Buying Power Optimizer
 * Optimizes BP usage across positions and phases
 */
class BuyingPowerOptimizer {
  static calculateCurrentBPUsage(positions) {
    let totalBP = 0;
    const breakdown = {};
    
    positions.forEach(position => {
      const bp = this.estimateBPUsage(position);
      totalBP += bp;
      
      const group = position.correlationGroup || 'OTHER';
      breakdown[group] = (breakdown[group] || 0) + bp;
    });
    
    return {
      totalBP: Math.round(totalBP * 100) / 100,
      breakdown,
      positionCount: positions.length
    };
  }
  
  static estimateBPUsage(position) {
    const ticker = position.ticker;
    const strategy = position.strategy?.toUpperCase();
    const isMicro = ticker.startsWith('M') || ['MCL', 'MGC'].includes(ticker);
    
    // BP requirements from framework (PDF Pages 5-6, 13-24)
    const bpMap = {
      'STRANGLE': isMicro ? 2.5 : 3.5,
      'LT112': ticker === 'ES' ? 6 : ticker === 'MES' ? 3 : 4,
      'IPMCC': 8,
      '0DTE': 2,
      'LEAP': 2,
      'BUTTERFLY': 0.5,
      'RATIO': 2,
      'DIAGONAL': 1.5,
      'BOX': 0 // Self-financing
    };
    
    return bpMap[strategy] || 3; // Default 3%
  }
  
  static optimizeBPAllocation(positions, targetBP, phase, vixRegime) {
    const current = this.calculateCurrentBPUsage(positions);
    const gap = targetBP - current.totalBP;
    
    if (gap <= 0) {
      return {
        needed: false,
        current: current.totalBP,
        target: targetBP,
        message: 'BP allocation at or above target'
      };
    }
    
    const recommendations = [];
    
    // Phase-specific optimization strategies
    switch (phase) {
      case 1:
        if (gap >= 2.5) {
          recommendations.push({
            strategy: 'STRANGLE',
            ticker: 'MCL',
            bpUsed: 2.5,
            priority: 'HIGH',
            reason: 'Phase 1 foundation strategy'
          });
        }
        break;
        
      case 2:
        if (gap >= 6) {
          recommendations.push({
            strategy: 'LT112',
            ticker: 'MES',
            bpUsed: 3,
            priority: 'HIGH',
            reason: 'Phase 2 scaling with MES LT112'
          });
        }
        if (gap >= 2.5) {
          recommendations.push({
            strategy: 'STRANGLE',
            ticker: 'MGC',
            bpUsed: 2.5,
            priority: 'MEDIUM',
            reason: 'Additional strangle capacity'
          });
        }
        break;
        
      case 3:
        if (gap >= 6) {
          recommendations.push({
            strategy: 'LT112',
            ticker: 'ES',
            bpUsed: 6,
            priority: 'HIGH',
            reason: 'Phase 3 ES upgrade'
          });
        }
        if (gap >= 0.5) {
          recommendations.push({
            strategy: 'BUTTERFLY',
            ticker: 'ES',
            bpUsed: 0.5,
            priority: 'MEDIUM',
            reason: 'Phase 3 butterfly introduction'
          });
        }
        break;
        
      case 4:
        if (gap >= 2) {
          recommendations.push({
            strategy: 'LEAP',
            ticker: 'SPY',
            bpUsed: 2,
            priority: 'HIGH',
            reason: 'Phase 4 LEAP ladder system'
          });
        }
        break;
    }
    
    // VIX-adjusted recommendations
    if (vixRegime && vixRegime.regime === 'EXTREMELY_LOW') {
      recommendations.forEach(rec => {
        rec.priority = rec.priority === 'HIGH' ? 'MEDIUM' : 'LOW';
        rec.reason += ' (VIX low - reduced priority)';
      });
    } else if (vixRegime && vixRegime.regime === 'EXTREME') {
      recommendations.push({
        strategy: 'PUT_SELLING',
        ticker: 'SPY',
        bpUsed: 8,
        priority: 'URGENT',
        reason: 'VIX spike opportunity - sell puts aggressively'
      });
    }
    
    return {
      needed: true,
      current: current.totalBP,
      target: targetBP,
      gap,
      recommendations: recommendations.slice(0, 3) // Top 3 recommendations
    };
  }
}

/**
 * Exit Manager
 * Manages position exits based on framework rules
 */
class ExitManager {
  static evaluateExitTriggers(position) {
    const exits = [];
    const dte = position.dte || 0;
    const pl = position.pl || 0;
    const strategy = position.strategy?.toUpperCase();
    
    // Universal exit rules (PDF Pages 9-10)
    
    // 1. 50% Profit Rule (HIGHEST PRIORITY)
    if (pl >= 50) {
      exits.push({
        trigger: '50_PERCENT_PROFIT',
        priority: 'URGENT',
        action: 'CLOSE_IMMEDIATELY',
        message: '✅ 50% profit achieved - close immediately',
        pdfRef: 'Page 9 - 50% Rule'
      });
    }
    
    // 2. 21 DTE Management Rule
    if (dte <= 21 && strategy !== '0DTE') {
      if (pl >= 25) {
        exits.push({
          trigger: '21_DTE_PROFIT',
          priority: 'HIGH',
          action: 'CLOSE_TODAY',
          message: '📅 21 DTE with 25%+ profit - close position',
          pdfRef: 'Page 9 - 21 DTE Rule'
        });
      } else if (pl <= -25) {
        exits.push({
          trigger: '21_DTE_LOSS',
          priority: 'HIGH',
          action: 'DEFEND_OR_CLOSE',
          message: '📅 21 DTE with loss - defend or close',
          pdfRef: 'Page 10 - Defensive Management'
        });
      } else {
        exits.push({
          trigger: '21_DTE_NEUTRAL',
          priority: 'MEDIUM',
          action: 'EVALUATE_ROLL',
          message: '📅 21 DTE - evaluate rolling or closing',
          pdfRef: 'Page 9 - 21 DTE Rule'
        });
      }
    }
    
    // 3. 0 DTE Emergency Exit
    if (dte === 0) {
      exits.push({
        trigger: '0_DTE_EXPIRATION',
        priority: 'EMERGENCY',
        action: 'CLOSE_IMMEDIATELY',
        message: '🚨 EXPIRATION TODAY - Close immediately to avoid assignment',
        pdfRef: 'Risk Management Protocol'
      });
    }
    
    // 4. Major Loss Threshold
    if (pl <= -200) {
      exits.push({
        trigger: 'MAJOR_LOSS',
        priority: 'HIGH',
        action: 'DEFEND_OR_EXIT',
        message: `🚨 Major loss (${pl}%) - implement defense or exit`,
        pdfRef: 'Page 10 - Loss Management'
      });
    }
    
    // Strategy-specific exit rules
    if (strategy === 'LT112') {
      // LT112 specific management
      if (dte <= 21 && position.entryWeek <= 2) {
        if (pl < 15) {
          exits.push({
            trigger: 'LT112_UNDERPERFORM',
            priority: 'MEDIUM',
            action: 'CONSIDER_ROLL',
            message: '🔄 LT112 underperforming at 21 DTE - consider 45 DTE roll',
            pdfRef: 'Page 27 - LT112 Management'
          });
        }
      }
      
      // Late entry week warning
      if (position.entryWeek >= 3) {
        exits.push({
          trigger: 'LT112_LATE_ENTRY',
          priority: 'LOW',
          action: 'MONITOR_CLOSELY',
          message: '⏰ Late entry week - monitor for early exit opportunities',
          pdfRef: 'Page 26 - Entry Timing'
        });
      }
    }
    
    if (strategy === 'STRANGLE' || strategy === 'IRON_CONDOR') {
      // Test management for strangles/condors
      if (position.testedSide) {
        exits.push({
          trigger: 'TESTED_SIDE',
          priority: 'MEDIUM',
          action: 'MANAGE_TESTED_SIDE',
          message: `📍 ${position.testedSide} side tested - manage or roll tested side`,
          pdfRef: 'Page 30 - Strangle Management'
        });
      }
    }
    
    // Sort by priority
    const priorityOrder = { 'EMERGENCY': 0, 'URGENT': 1, 'HIGH': 2, 'MEDIUM': 3, 'LOW': 4 };
    exits.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    return {
      hasExitTriggers: exits.length > 0,
      exitTriggers: exits,
      primaryExit: exits[0] || null,
      urgentAction: exits.some(e => ['EMERGENCY', 'URGENT'].includes(e.priority))
    };
  }
  
  static generateExitPlan(positions) {
    const plan = {
      immediate: [],
      today: [],
      thisWeek: [],
      monitor: [],
      summary: {
        totalPositions: positions.length,
        needingAction: 0,
        profitTargets: 0,
        riskManagement: 0
      }
    };
    
    positions.forEach(position => {
      const exitEval = this.evaluateExitTriggers(position);
      const health = PositionHealthCalculator.calculateHealthScore(position);
      
      const positionPlan = {
        ticker: position.ticker,
        strategy: position.strategy,
        dte: position.dte,
        pl: position.pl,
        healthScore: health.score,
        exitTriggers: exitEval.exitTriggers,
        primaryAction: exitEval.primaryExit?.action || 'HOLD'
      };
      
      if (exitEval.urgentAction) {
        plan.immediate.push(positionPlan);
        plan.summary.needingAction++;
        if (exitEval.primaryExit?.trigger === '50_PERCENT_PROFIT') {
          plan.summary.profitTargets++;
        } else {
          plan.summary.riskManagement++;
        }
      } else if (exitEval.primaryExit?.priority === 'HIGH') {
        plan.today.push(positionPlan);
        plan.summary.needingAction++;
      } else if (exitEval.primaryExit?.priority === 'MEDIUM') {
        plan.thisWeek.push(positionPlan);
      } else {
        plan.monitor.push(positionPlan);
      }
    });
    
    return plan;
  }
}

/**
 * Main Position Manager Class
 * Orchestrates all position management functions with enhanced sector rotation tracking
 */
class PositionManager {
  constructor(api = null) {
    this.correlationTracker = new CorrelationTracker();
    this.sectorTracker = new SectorRotationTracker(api);
    this.positions = [];
    this.lastUpdate = null;
    this.api = api;
  }
  
  updatePositions(positions) {
    this.positions = positions.map(pos => ({
      ...pos,
      healthScore: PositionHealthCalculator.calculateHealthScore(pos),
      exitEvaluation: ExitManager.evaluateExitTriggers(pos)
    }));
    
    this.correlationTracker.updatePositions(this.positions);
    this.lastUpdate = new Date();
    
    if (DEBUG) {
      logger.info('SYSTEM', `📊 Updated ${this.positions.length} positions`);
      logger.info('SYSTEM', `⚠️ Positions needing action: ${this.positions.filter(p => p.exitEvaluation.urgentAction).length}`);
    }
  }
  
  getPositionHealth() {
    return this.positions.map(pos => ({
      ticker: pos.ticker,
      strategy: pos.strategy,
      dte: pos.dte,
      pl: pos.pl,
      healthScore: pos.healthScore.score,
      healthLevel: pos.healthScore.healthLevel,
      primaryAction: pos.healthScore.primaryAction,
      warnings: pos.healthScore.warnings,
      exitTrigger: pos.healthScore.exitTrigger
    }));
  }
  
  getCorrelationStatus(phase = 1) {
    return this.correlationTracker.checkConcentrationLimits(phase);
  }
  
  canAddPosition(ticker, phase = 1) {
    return this.correlationTracker.canAddPosition(ticker, phase);
  }
  
  getExitPlan() {
    return ExitManager.generateExitPlan(this.positions);
  }
  
  getBPOptimization(targetBP, phase, vixRegime) {
    return BuyingPowerOptimizer.optimizeBPAllocation(this.positions, targetBP, phase, vixRegime);
  }
  
  getCurrentBPUsage() {
    return BuyingPowerOptimizer.calculateCurrentBPUsage(this.positions);
  }
  
  getPositionsByHealth(minScore = 60) {
    return this.positions.filter(pos => pos.healthScore.score >= minScore);
  }
  
  getCriticalPositions() {
    return this.positions.filter(pos => 
      pos.healthScore.exitTrigger || 
      pos.exitEvaluation.urgentAction
    );
  }

  /**
   * Get enhanced sector correlation analysis
   */
  async getEnhancedSectorAnalysis() {
    try {
      const sectorAnalysis = await this.sectorTracker.getCompleteSectorAnalysis();
      const enhancedCorrelation = this.sectorTracker.checkEnhancedCorrelationLimits(this.positions);
      
      return {
        sectorRotation: sectorAnalysis,
        enhancedCorrelation: enhancedCorrelation,
        riskAssessment: this.assessSectorBasedRisk(sectorAnalysis, enhancedCorrelation),
        tradingImplications: this.generateSectorTradingImplications(sectorAnalysis),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.warn('WARN', 'Enhanced sector analysis failed:', error.message);
      return {
        sectorRotation: null,
        enhancedCorrelation: { violations: [], overallRisk: 'UNKNOWN' },
        riskAssessment: { level: 'UNKNOWN', message: 'Analysis unavailable' },
        tradingImplications: []
      };
    }
  }

  /**
   * Assess risk based on sector rotation and correlation
   */
  assessSectorBasedRisk(sectorAnalysis, enhancedCorrelation) {
    let overallRisk = 'LOW';
    const riskFactors = [];
    
    if (enhancedCorrelation.violations.length > 0) {
      const criticalViolations = enhancedCorrelation.violations.filter(v => v.severity === 'CRITICAL');
      if (criticalViolations.length > 0) {
        overallRisk = 'CRITICAL';
        riskFactors.push(`${criticalViolations.length} critical sector concentration violations`);
      } else {
        overallRisk = 'HIGH';
        riskFactors.push(`${enhancedCorrelation.violations.length} sector concentration warnings`);
      }
    }
    
    if (sectorAnalysis && sectorAnalysis.current) {
      const riskLevel = sectorAnalysis.current.riskAssessment.level;
      if (riskLevel === 'HIGH') {
        overallRisk = overallRisk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
        riskFactors.push('High sector rotation risk detected');
      }
      
      if (sectorAnalysis.current.rotationType === 'RISK_OFF_DEFENSIVE') {
        overallRisk = overallRisk === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
        riskFactors.push('Risk-off market regime detected');
      }
      
      if (sectorAnalysis.current.correlationBreakdown.detected) {
        riskFactors.push(`${sectorAnalysis.current.correlationBreakdown.count} sector correlation breakdowns`);
      }
    }
    
    return {
      level: overallRisk,
      factors: riskFactors,
      message: this.getSectorRiskMessage(overallRisk, riskFactors),
      bpAdjustment: this.getSectorBPAdjustment(overallRisk),
      actionRequired: overallRisk === 'CRITICAL' || overallRisk === 'HIGH'
    };
  }

  /**
   * Get sector risk message
   */
  getSectorRiskMessage(riskLevel, factors) {
    switch (riskLevel) {
      case 'CRITICAL':
        return `🚨 CRITICAL SECTOR RISK: ${factors.join(', ')} - Emergency reduction required`;
      case 'HIGH':
        return `⚠️ HIGH SECTOR RISK: ${factors.join(', ')} - Reduce exposure`;
      case 'MODERATE':
        return `📊 MODERATE SECTOR RISK: ${factors.join(', ')} - Monitor closely`;
      default:
        return '✅ Normal sector risk environment';
    }
  }

  /**
   * Get BP adjustment based on sector risk
   */
  getSectorBPAdjustment(riskLevel) {
    switch (riskLevel) {
      case 'CRITICAL': return -40; // 40% BP reduction
      case 'HIGH': return -25;     // 25% BP reduction
      case 'MODERATE': return -10; // 10% BP reduction
      default: return 0;           // No adjustment
    }
  }

  /**
   * Generate trading implications from sector analysis
   */
  generateSectorTradingImplications(sectorAnalysis) {
    const implications = [];
    
    if (!sectorAnalysis || !sectorAnalysis.current) {
      return implications;
    }
    
    const current = sectorAnalysis.current;
    
    // Sector leadership implications
    current.leaders.forEach(leader => {
      if (leader.relativePerformance > 1.5) {
        implications.push({
          type: 'SECTOR_OPPORTUNITY',
          sector: leader.sector,
          ticker: leader.ticker,
          action: 'CONSIDER_EXPOSURE',
          reason: `Leading sector with ${leader.relativePerformance.toFixed(2)}% outperformance`,
          impact: 'POSITIVE',
          priority: 'HIGH'
        });
      }
    });
    
    // Sector weakness implications
    current.laggards.forEach(laggard => {
      if (laggard.relativePerformance < -1.5) {
        implications.push({
          type: 'SECTOR_AVOIDANCE',
          sector: laggard.sector,
          ticker: laggard.ticker,
          action: 'AVOID_NEW_EXPOSURE',
          reason: `Weak sector with ${laggard.relativePerformance.toFixed(2)}% underperformance`,
          impact: 'NEGATIVE',
          priority: 'MEDIUM'
        });
      }
    });
    
    // Rotation type implications
    if (current.rotationType === 'RISK_OFF_DEFENSIVE') {
      implications.push({
        type: 'MARKET_REGIME_SHIFT',
        action: 'REDUCE_RISK_EXPOSURE',
        reason: 'Defensive sector rotation indicates risk-off environment',
        impact: 'CAUTION',
        priority: 'HIGH'
      });
    } else if (current.rotationType === 'RISK_ON_GROWTH') {
      implications.push({
        type: 'MARKET_REGIME_SHIFT',
        action: 'FAVOR_GROWTH_SECTORS',
        reason: 'Growth sector leadership indicates risk-on environment',
        impact: 'OPPORTUNITY',
        priority: 'MEDIUM'
      });
    }
    
    return implications;
  }

  /**
   * Check if a new position would violate enhanced sector limits
   */
  async canAddPositionWithSectorCheck(ticker, phase = 1) {
    // Basic correlation check
    const basicCheck = this.canAddPosition(ticker, phase);
    
    if (!basicCheck.allowed) {
      return basicCheck;
    }
    
    // Enhanced sector check
    try {
      const sector = this.sectorTracker.getSectorForTicker(ticker);
      const sectorInfo = this.sectorTracker.sectorGroups[sector];
      
      if (sectorInfo) {
        const currentSectorPositions = this.positions.filter(pos => 
          this.sectorTracker.getSectorForTicker(pos.ticker) === sector
        ).length;
        
        if (currentSectorPositions >= sectorInfo.maxPositions) {
          return {
            allowed: false,
            reason: `Sector ${sector} at maximum (${currentSectorPositions}/${sectorInfo.maxPositions})`,
            action: 'Close existing position in this sector first',
            sectorLimited: true
          };
        }
      }
      
      // Get current sector analysis
      const sectorAnalysis = await this.sectorTracker.getCompleteSectorAnalysis();
      const sectorData = sectorAnalysis.current.rawData[ticker];
      
      if (sectorData && sectorData.relativePerformance < -2.0) {
        return {
          allowed: true,
          reason: 'Position allowed but sector is underperforming',
          warning: `${ticker} sector underperforming by ${sectorData.relativePerformance.toFixed(2)}%`,
          recommendation: 'Consider waiting for sector strength or reduce position size'
        };
      }
      
      return {
        allowed: true,
        reason: 'Position allowed - no sector restrictions',
        sectorStatus: sectorData ? {
          performance: sectorData.relativePerformance,
          outperforming: sectorData.outperforming
        } : null
      };
      
    } catch (error) {
      logger.warn('WARN', 'Enhanced sector check failed:', error.message);
      return basicCheck; // Fall back to basic check
    }
  }
  
  // Generate comprehensive position report with enhanced sector analysis
  async generateReport() {
    const correlationStatus = this.getCorrelationStatus();
    const exitPlan = this.getExitPlan();
    const bpUsage = this.getCurrentBPUsage();
    const criticalPositions = this.getCriticalPositions();
    
    // Enhanced sector analysis
    const enhancedSectorAnalysis = await this.getEnhancedSectorAnalysis();
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalPositions: this.positions.length,
        criticalPositions: criticalPositions.length,
        avgHealthScore: Math.round(
          this.positions.reduce((sum, pos) => sum + pos.healthScore.score, 0) / 
          (this.positions.length || 1)
        ),
        totalBPUsage: bpUsage.totalBP,
        sectorRiskLevel: enhancedSectorAnalysis.riskAssessment.level
      },
      correlationStatus,
      enhancedSectorAnalysis,
      exitPlan,
      bpUsage,
      criticalPositions: criticalPositions.map(pos => ({
        ticker: pos.ticker,
        strategy: pos.strategy,
        issue: pos.exitEvaluation.primaryExit?.message || 'Health score critical',
        action: pos.exitEvaluation.primaryExit?.action || pos.healthScore.primaryAction
      })),
      recommendations: this.generateRecommendations(correlationStatus, exitPlan, bpUsage, enhancedSectorAnalysis)
    };
  }
  
  generateRecommendations(correlationStatus, exitPlan, bpUsage, enhancedSectorAnalysis) {
    const recommendations = [];
    
    // Correlation warnings
    if (correlationStatus.isViolated) {
      recommendations.push({
        type: 'CORRELATION_VIOLATION',
        priority: 'URGENT',
        message: '🚨 Correlation limits exceeded - close excess positions immediately',
        action: 'REDUCE_CORRELATION'
      });
    }
    
    // August 5 risk warning
    if (correlationStatus.august5Risk?.risk === 'HIGH') {
      recommendations.push({
        type: 'AUGUST_5_RISK',
        priority: 'URGENT',
        message: correlationStatus.august5Risk.message,
        action: 'CLOSE_EXCESS_POSITIONS'
      });
    }
    
    // Enhanced sector risk warnings
    if (enhancedSectorAnalysis && enhancedSectorAnalysis.riskAssessment.actionRequired) {
      recommendations.push({
        type: 'ENHANCED_SECTOR_RISK',
        priority: enhancedSectorAnalysis.riskAssessment.level === 'CRITICAL' ? 'URGENT' : 'HIGH',
        message: enhancedSectorAnalysis.riskAssessment.message,
        action: 'SECTOR_RISK_MANAGEMENT',
        bpAdjustment: enhancedSectorAnalysis.riskAssessment.bpAdjustment
      });
    }
    
    // Sector trading implications
    if (enhancedSectorAnalysis && enhancedSectorAnalysis.tradingImplications.length > 0) {
      const highPriorityImplications = enhancedSectorAnalysis.tradingImplications.filter(
        impl => impl.priority === 'HIGH'
      );
      
      if (highPriorityImplications.length > 0) {
        recommendations.push({
          type: 'SECTOR_OPPORTUNITY',
          priority: 'MEDIUM',
          message: `${highPriorityImplications.length} high-priority sector opportunities identified`,
          action: 'REVIEW_SECTOR_IMPLICATIONS',
          details: highPriorityImplications
        });
      }
    }
    
    // Exit plan recommendations
    if (exitPlan.immediate.length > 0) {
      recommendations.push({
        type: 'IMMEDIATE_EXITS',
        priority: 'URGENT',
        message: `${exitPlan.immediate.length} position(s) need immediate action`,
        action: 'EXECUTE_EXIT_PLAN'
      });
    }
    
    // BP optimization (adjusted for sector risk)
    const sectorAdjustedBP = enhancedSectorAnalysis ? 
      Math.max(20, 65 + enhancedSectorAnalysis.riskAssessment.bpAdjustment) : 65;
    
    if (bpUsage.totalBP < sectorAdjustedBP - 20) {
      recommendations.push({
        type: 'BP_UNDERUTILIZED',
        priority: 'MEDIUM',
        message: `BP usage at ${bpUsage.totalBP}% - consider adding positions (sector-adjusted target: ${sectorAdjustedBP}%)`,
        action: 'OPTIMIZE_BP_USAGE'
      });
    }
    
    return recommendations;
  }

  /**
   * Get all current positions
   * @returns {Array} Array of current positions
   */
  getPositions() {
    return this.positions.map(position => ({
      ticker: position.ticker || position.symbol,
      strategy: position.strategy,
      quantity: position.quantity || 1,
      pl: position.pl || 0,
      plPercent: position.plPercent || position.pl || 0,
      dte: position.dte || position.daysToExpiration || 0,
      daysToExpiration: position.daysToExpiration || position.dte || 0,
      entry: position.entry || position.entryPrice,
      current: position.current || position.currentPrice,
      healthScore: position.healthScore?.score || 50,
      correlationGroup: position.correlationGroup,
      exitEvaluation: position.exitEvaluation,
      lastUpdate: position.lastUpdate || new Date().toISOString()
    }));
  }
}

// Export all classes and functions
module.exports = {
  PositionManager,
  PositionHealthCalculator,
  CorrelationTracker,
  BuyingPowerOptimizer,
  ExitManager,
  CORRELATION_GROUPS
};
const { getLogger } = require('./logger');
const logger = getLogger();

