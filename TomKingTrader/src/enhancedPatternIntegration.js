/**
 * Enhanced Pattern Analysis Integration Guide
 * Shows how to integrate the enhanced system with existing Tom King Framework
 */

const { EnhancedPatternAnalyzer } = require('./enhancedPatternAnalysis');
const { PatternAnalyzer } = require('./patternAnalysis'); // Existing system

/**
 * Enhanced Framework Integration
 * Seamlessly integrates new pattern analysis with existing framework
 */
class EnhancedTomKingFramework {
  constructor() {
    // Initialize both analyzers for backward compatibility
    this.enhancedAnalyzer = new EnhancedPatternAnalyzer();
    this.legacyAnalyzer = new PatternAnalyzer();
    
    // Framework settings
    this.settings = {
      useEnhancedAnalysis: true,
      minimumConfidence: 70,
      maxCorrelationExposure: 0.35,
      enableBacktesting: true
    };
  }
  
  /**
   * Main market analysis with enhanced capabilities
   */
  async analyzeMarkets(symbols = ['ES', 'MES', 'GLD', 'TLT']) {
    console.log('🔍 Starting Enhanced Market Analysis...');
    
    const results = {};
    const opportunities = [];
    
    for (const symbol of symbols) {
      try {
        // Fetch market data (replace with your data source)
        const marketData = await this.fetchMarketData(symbol);
        
        // Run enhanced analysis
        const enhanced = this.enhancedAnalyzer.analyzeEnhanced(symbol, marketData, 'AUTO');
        
        // Run legacy analysis for comparison
        const legacy = this.legacyAnalyzer.analyzePattern(symbol, marketData);
        
        // Combine results
        const analysis = this.combineAnalysis(enhanced, legacy, symbol);
        
        results[symbol] = analysis;
        
        // Check for trading opportunities
        if (this.isGoodOpportunity(analysis)) {
          opportunities.push({
            symbol,
            analysis,
            priority: this.calculatePriority(analysis)
          });
        }
        
        console.log(`✅ ${symbol}: ${analysis.recommendation} (${analysis.confidence}%)`);
        
      } catch (error) {
        console.error(`❌ Error analyzing ${symbol}:`, error.message);
        results[symbol] = { error: error.message };
      }
    }
    
    // Sort opportunities by priority
    opportunities.sort((a, b) => b.priority - a.priority);
    
    return {
      results,
      opportunities: opportunities.slice(0, 3), // Top 3 opportunities
      marketRegime: this.assessMarketRegime(results),
      riskLevel: this.calculateOverallRisk(results)
    };
  }
  
  /**
   * Combines enhanced and legacy analysis for best results
   */
  combineAnalysis(enhanced, legacy, symbol) {
    const combined = {
      symbol,
      timestamp: new Date().toISOString(),
      
      // Enhanced analysis results
      recommendation: enhanced.overallAssessment.recommendation,
      confidence: enhanced.overallAssessment.confidence,
      primaryPattern: enhanced.overallAssessment.primaryPattern,
      riskLevel: enhanced.overallAssessment.riskLevel,
      expectedReturn: enhanced.overallAssessment.expectedReturn,
      timeframe: enhanced.overallAssessment.timeframe,
      
      // Legacy analysis for validation
      legacyScore: legacy.score,
      legacyQuality: legacy.quality,
      
      // Technical indicators from enhanced system
      technicals: enhanced.technicalIndicators,
      
      // Tom King specific patterns
      tomKingPatterns: enhanced.tomKingPatterns,
      
      // Support/Resistance levels
      keyLevels: enhanced.supportResistance.slice(0, 3),
      
      // Chart patterns
      chartPatterns: enhanced.chartPatterns.filter(p => p.confidence > 0.6),
      
      // Key factors
      keyFactors: enhanced.overallAssessment.keyFactors,
      
      // Risk parameters
      stopLoss: enhanced.overallAssessment.stopLoss,
      profitTarget: enhanced.overallAssessment.profitTarget,
      
      // Enhanced metadata
      volumeProfile: enhanced.volumeProfile,
      multiTimeframe: enhanced.multiTimeframe?.consensus
    };
    
    // Adjust confidence based on legacy validation
    if (Math.abs(combined.confidence - legacy.score) > 20) {
      combined.confidence = Math.round((combined.confidence + legacy.score) / 2);
      combined.validated = false;
    } else {
      combined.validated = true;
    }
    
    return combined;
  }
  
  /**
   * Determines if analysis represents a good trading opportunity
   */
  isGoodOpportunity(analysis) {
    return (
      analysis.recommendation === 'BUY' &&
      analysis.confidence >= this.settings.minimumConfidence &&
      analysis.validated &&
      ['EXCELLENT', 'GOOD'].includes(analysis.primaryPattern?.quality)
    );
  }
  
  /**
   * Calculates priority score for opportunities
   */
  calculatePriority(analysis) {
    let priority = analysis.confidence;
    
    // Boost for high-quality Tom King patterns
    if (analysis.tomKingPatterns) {
      Object.values(analysis.tomKingPatterns).forEach(pattern => {
        if (pattern.suitable && pattern.quality === 'EXCELLENT') {
          priority += 10;
        }
      });
    }
    
    // Boost for multiple confirming patterns
    if (analysis.chartPatterns.length >= 2) {
      priority += 5;
    }
    
    // Risk adjustment
    const riskAdjustment = {
      'LOW': 1.2,
      'MEDIUM_LOW': 1.1,
      'MEDIUM': 1.0,
      'MEDIUM_HIGH': 0.9,
      'HIGH': 0.8
    };
    
    priority *= riskAdjustment[analysis.riskLevel] || 1.0;
    
    return Math.round(priority);
  }
  
  /**
   * Tom King Strategy-Specific Analysis
   */
  async analyzeTomKingStrategy(symbol, strategy) {
    const marketData = await this.fetchMarketData(symbol);
    const analysis = this.enhancedAnalyzer.analyzeEnhanced(symbol, marketData, strategy);
    
    // Strategy-specific validation
    switch (strategy) {
      case 'STRANGLE':
        return this.validateStrangleSetup(analysis, marketData);
      
      case '0DTE':
        return this.validate0DTESetup(analysis, marketData);
      
      case 'LT112':
        return this.validateLT112Setup(analysis, marketData);
      
      case 'VIX_SPIKE':
        return this.validateVIXSpike(analysis, marketData);
      
      default:
        return analysis;
    }
  }
  
  /**
   * Validates strangle setup according to Tom King rules
   */
  validateStrangleSetup(analysis, marketData) {
    const validation = {
      ...analysis,
      tomKingValidation: {
        ivRankCheck: marketData.ivRank >= 40,
        rangeCheck: this.checkRangePosition(marketData),
        correlationCheck: this.checkCorrelationLimits(marketData.symbol),
        bpCheck: this.checkBuyingPower(marketData.symbol),
        timeCheck: marketData.dte >= 45 && marketData.dte <= 90,
        
        // Overall validation
        passed: false
      }
    };
    
    // Check all validation criteria
    const checks = validation.tomKingValidation;
    checks.passed = checks.ivRankCheck && checks.rangeCheck && 
                   checks.correlationCheck && checks.bpCheck && checks.timeCheck;
    
    if (!checks.passed) {
      validation.recommendation = 'HOLD';
      validation.confidence = Math.max(0, validation.confidence - 30);
    }
    
    return validation;
  }
  
  /**
   * Validates 0DTE setup according to Tom King rules
   */
  validate0DTESetup(analysis, marketData) {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    const validation = {
      ...analysis,
      tomKingValidation: {
        timeRestriction: hour >= 10 && (hour > 10 || now.getMinutes() >= 30),
        dayRestriction: dayOfWeek === 5, // Friday only
        volumeCheck: marketData.volume > marketData.avgVolume * 1.2,
        moveCheck: this.checkDayMove(marketData),
        
        passed: false
      }
    };
    
    const checks = validation.tomKingValidation;
    checks.passed = checks.timeRestriction && checks.dayRestriction && 
                   checks.volumeCheck && checks.moveCheck;
    
    if (!checks.passed) {
      validation.recommendation = 'HOLD';
      validation.confidence = 0;
    }
    
    return validation;
  }
  
  /**
   * Position sizing based on enhanced analysis
   */
  calculatePositionSize(analysis, accountSize, maxRisk = 0.05) {
    const baseSize = accountSize * maxRisk;
    
    // Confidence adjustment
    const confidenceMultiplier = analysis.confidence / 100;
    
    // Risk level adjustment
    const riskMultipliers = {
      'LOW': 1.5,
      'MEDIUM_LOW': 1.2,
      'MEDIUM': 1.0,
      'MEDIUM_HIGH': 0.8,
      'HIGH': 0.5
    };
    
    const riskMultiplier = riskMultipliers[analysis.riskLevel] || 1.0;
    
    // Pattern quality adjustment
    let qualityMultiplier = 1.0;
    if (analysis.primaryPattern?.quality === 'EXCELLENT') qualityMultiplier = 1.2;
    else if (analysis.primaryPattern?.quality === 'POOR') qualityMultiplier = 0.7;
    
    const adjustedSize = baseSize * confidenceMultiplier * riskMultiplier * qualityMultiplier;
    
    return {
      recommendedSize: Math.round(adjustedSize),
      baseSize: Math.round(baseSize),
      adjustments: {
        confidence: confidenceMultiplier,
        risk: riskMultiplier,
        quality: qualityMultiplier
      }
    };
  }
  
  /**
   * Generate trading signals for dashboard
   */
  generateTradingSignals(analysisResults) {
    const signals = [];
    
    Object.values(analysisResults.results).forEach(analysis => {
      if (analysis.error) return;
      
      const signal = {
        symbol: analysis.symbol,
        action: analysis.recommendation,
        confidence: analysis.confidence,
        strategy: analysis.primaryPattern?.name || 'UNKNOWN',
        entry: analysis.stopLoss ? 'MARKET' : 'LIMIT',
        stopLoss: analysis.stopLoss,
        target: analysis.profitTarget,
        timeframe: analysis.timeframe,
        riskLevel: analysis.riskLevel,
        notes: analysis.keyFactors.join('; '),
        timestamp: analysis.timestamp
      };
      
      signals.push(signal);
    });
    
    return signals.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Risk management checks
   */
  assessMarketRegime(results) {
    const analyses = Object.values(results).filter(r => !r.error);
    if (analyses.length === 0) return 'UNKNOWN';
    
    const avgVIX = analyses.reduce((sum, a) => sum + (a.technicals?.vixRegime === 'HIGH' ? 30 : 18), 0) / analyses.length;
    const trendConsensus = analyses.filter(a => a.multiTimeframe?.trend === 'BULLISH').length / analyses.length;
    
    if (avgVIX > 25) return 'HIGH_VOLATILITY';
    if (trendConsensus > 0.7) return 'BULLISH';
    if (trendConsensus < 0.3) return 'BEARISH';
    return 'NEUTRAL';
  }
  
  calculateOverallRisk(results) {
    const analyses = Object.values(results).filter(r => !r.error);
    const riskScores = {
      'LOW': 1,
      'MEDIUM_LOW': 2,
      'MEDIUM': 3,
      'MEDIUM_HIGH': 4,
      'HIGH': 5
    };
    
    const avgRisk = analyses.reduce((sum, a) => sum + (riskScores[a.riskLevel] || 3), 0) / analyses.length;
    
    if (avgRisk <= 2) return 'LOW';
    if (avgRisk <= 3) return 'MEDIUM';
    return 'HIGH';
  }
  
  // Helper methods (implement based on your data sources)
  async fetchMarketData(symbol) {
    // Placeholder - replace with your actual data fetching
    return {
      symbol,
      currentPrice: 4500 + Math.random() * 100,
      closes: Array.from({length: 50}, () => 4500 + Math.random() * 50),
      highs: Array.from({length: 50}, () => 4510 + Math.random() * 40),
      lows: Array.from({length: 50}, () => 4490 + Math.random() * 40),
      volumes: Array.from({length: 50}, () => 100000 + Math.random() * 50000),
      iv: 0.15 + Math.random() * 0.3,
      ivRank: Math.random() * 100,
      dte: 45,
      vix: 15 + Math.random() * 20,
      avgVolume: 120000
    };
  }
  
  checkRangePosition(marketData) {
    const range = marketData.high20d - marketData.low20d;
    const position = (marketData.currentPrice - marketData.low20d) / range;
    return position >= 0.3 && position <= 0.7;
  }
  
  checkCorrelationLimits(symbol) {
    // Implement correlation checking logic
    return true; // Placeholder
  }
  
  checkBuyingPower(symbol) {
    // Implement buying power checking
    return true; // Placeholder
  }
  
  checkDayMove(marketData) {
    const dayMove = Math.abs(marketData.currentPrice - marketData.openPrice) / marketData.openPrice;
    return dayMove >= 0.005; // 0.5% minimum move
  }
}

/**
 * Usage Examples
 */
async function demonstrateEnhancedIntegration() {
  console.log('🚀 Enhanced Tom King Framework Integration Demo');
  console.log('='.repeat(50));
  
  const framework = new EnhancedTomKingFramework();
  
  // Example 1: Complete market analysis
  console.log('\n📊 Running Complete Market Analysis...');
  const marketAnalysis = await framework.analyzeMarkets(['ES', 'MES', 'GLD']);
  
  console.log(`\nMarket Regime: ${marketAnalysis.marketRegime}`);
  console.log(`Overall Risk: ${marketAnalysis.riskLevel}`);
  console.log(`Opportunities Found: ${marketAnalysis.opportunities.length}`);
  
  // Show top opportunity
  if (marketAnalysis.opportunities.length > 0) {
    const top = marketAnalysis.opportunities[0];
    console.log(`\nTop Opportunity: ${top.symbol}`);
    console.log(`Strategy: ${top.analysis.primaryPattern?.name}`);
    console.log(`Confidence: ${top.analysis.confidence}%`);
    console.log(`Expected Return: ${top.analysis.expectedReturn}%`);
  }
  
  // Example 2: Strategy-specific analysis
  console.log('\n🎯 Strategy-Specific Analysis...');
  const strangleAnalysis = await framework.analyzeTomKingStrategy('ES', 'STRANGLE');
  
  console.log(`Strangle Setup: ${strangleAnalysis.recommendation}`);
  console.log(`Tom King Validation: ${strangleAnalysis.tomKingValidation?.passed ? 'PASSED' : 'FAILED'}`);
  
  // Example 3: Position sizing
  console.log('\n💰 Position Sizing Calculation...');
  const accountSize = 50000; // £50k account
  const position = framework.calculatePositionSize(strangleAnalysis, accountSize);
  
  console.log(`Recommended Size: £${position.recommendedSize}`);
  console.log(`Risk Adjustments: Confidence ${(position.adjustments.confidence * 100).toFixed(0)}%, Risk ${(position.adjustments.risk * 100).toFixed(0)}%`);
  
  // Example 4: Trading signals
  console.log('\n📈 Trading Signals...');
  const signals = framework.generateTradingSignals(marketAnalysis);
  
  signals.slice(0, 3).forEach((signal, index) => {
    console.log(`${index + 1}. ${signal.symbol}: ${signal.action} (${signal.confidence}%) - ${signal.strategy}`);
  });
  
  console.log('\n✅ Enhanced Integration Demo Complete!');
}

// Export for use in main framework
module.exports = {
  EnhancedTomKingFramework,
  demonstrateEnhancedIntegration
};

// Run demo if called directly
if (require.main === module) {
  demonstrateEnhancedIntegration().catch(console.error);
}