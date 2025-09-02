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
    try {
      // Try to fetch from API if available
      if (this.apiClient && typeof this.apiClient.getMarketData === 'function') {
        const apiData = await this.apiClient.getMarketData(symbol);
        if (apiData && apiData.success) {
          return this.formatApiData(symbol, apiData.data);
        }
      }

      // Fallback to historical data or mock data for testing
      const basePrice = this.getBasePrice(symbol);
      const priceVariation = basePrice * 0.02; // 2% variation
      
      return {
        symbol,
        currentPrice: basePrice + (Math.random() - 0.5) * priceVariation,
        openPrice: basePrice + (Math.random() - 0.5) * priceVariation * 0.5,
        closes: this.generatePriceHistory(basePrice, 50),
        highs: this.generatePriceHistory(basePrice * 1.01, 50),
        lows: this.generatePriceHistory(basePrice * 0.99, 50),
        volumes: this.generateVolumeHistory(this.getAverageVolume(symbol), 50),
        iv: this.estimateImpliedVolatility(symbol),
        ivRank: Math.random() * 100,
        dte: 45,
        vix: 15 + Math.random() * 20,
        avgVolume: this.getAverageVolume(symbol),
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error);
      throw new Error(`Failed to fetch market data for ${symbol}`);
    }
  }

  formatApiData(symbol, apiData) {
    return {
      symbol,
      currentPrice: apiData.last || apiData.mark || 0,
      openPrice: apiData.open || apiData.last || 0,
      closes: apiData.history?.closes || [],
      highs: apiData.history?.highs || [],
      lows: apiData.history?.lows || [],
      volumes: apiData.history?.volumes || [],
      iv: apiData.impliedVolatility || 0,
      ivRank: apiData.ivRank || 0,
      dte: apiData.daysToExpiry || 45,
      vix: apiData.vix || 20,
      avgVolume: apiData.averageVolume || 0,
      lastUpdate: apiData.timestamp || new Date().toISOString()
    };
  }

  getBasePrice(symbol) {
    const basePrices = {
      'ES': 4500,
      'NQ': 15000,
      'CL': 70,
      'GC': 2000,
      'SPY': 450,
      'QQQ': 350,
      'TLT': 100,
      'GLD': 180,
      'IWM': 200,
      'VIX': 20
    };
    return basePrices[symbol] || 100;
  }

  getAverageVolume(symbol) {
    const avgVolumes = {
      'ES': 2000000,
      'NQ': 1500000,
      'CL': 500000,
      'GC': 300000,
      'SPY': 50000000,
      'QQQ': 40000000,
      'TLT': 10000000,
      'GLD': 8000000,
      'IWM': 15000000,
      'VIX': 0
    };
    return avgVolumes[symbol] || 1000000;
  }

  estimateImpliedVolatility(symbol) {
    const baseIVs = {
      'ES': 0.12,
      'NQ': 0.15,
      'CL': 0.25,
      'GC': 0.18,
      'SPY': 0.12,
      'QQQ': 0.15,
      'TLT': 0.10,
      'GLD': 0.18,
      'IWM': 0.20,
      'VIX': 0.90
    };
    const baseIV = baseIVs[symbol] || 0.15;
    return baseIV + (Math.random() - 0.5) * 0.1; // +/- 5% variation
  }

  generatePriceHistory(basePrice, length) {
    const history = [];
    let currentPrice = basePrice;
    
    for (let i = 0; i < length; i++) {
      const change = (Math.random() - 0.5) * 0.02; // +/- 1% daily change
      currentPrice *= (1 + change);
      history.push(currentPrice);
    }
    
    return history;
  }

  generateVolumeHistory(avgVolume, length) {
    return Array.from({length}, () => {
      const variation = (Math.random() - 0.5) * 0.5; // +/- 25% variation
      return Math.floor(avgVolume * (1 + variation));
    });
  }
  
  checkRangePosition(marketData) {
    const range = marketData.high20d - marketData.low20d;
    const position = (marketData.currentPrice - marketData.low20d) / range;
    return position >= 0.3 && position <= 0.7;
  }
  
  checkCorrelationLimits(symbol) {
    try {
      // Get current positions from position tracker if available
      const currentPositions = this.positionTracker ? 
        this.positionTracker.getAllPositions() : [];
      
      // Define correlation groups
      const correlationGroups = {
        'EQUITY_INDICES': ['ES', 'NQ', 'SPY', 'QQQ', 'IWM'],
        'COMMODITIES': ['CL', 'GC', 'SI'],
        'BONDS': ['TLT', 'TY', 'FV'],
        'CURRENCY': ['EUR', 'GBP', 'JPY'],
        'PRECIOUS_METALS': ['GC', 'SI', 'GLD'],
        'ENERGY': ['CL', 'NG', 'RB']
      };
      
      // Find which group the symbol belongs to
      const symbolGroup = Object.entries(correlationGroups)
        .find(([group, symbols]) => symbols.includes(symbol))?.[0];
      
      if (!symbolGroup) {
        // Unknown symbol, allow but log warning
        console.warn(`Symbol ${symbol} not found in correlation groups`);
        return true;
      }
      
      // Count current positions in the same correlation group
      const sameGroupPositions = currentPositions.filter(pos => {
        return correlationGroups[symbolGroup].includes(pos.symbol);
      });
      
      // Tom King's rule: Maximum 3 positions per correlation group
      const maxPositionsPerGroup = 3;
      const currentCount = sameGroupPositions.length;
      
      if (currentCount >= maxPositionsPerGroup) {
        console.log(`Correlation limit reached for group ${symbolGroup}: ${currentCount}/${maxPositionsPerGroup}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking correlation limits:', error);
      // Conservative approach: deny if we can't check
      return false;
    }
  }
  
  checkBuyingPower(symbol, strategy = 'STRANGLE', quantity = 1) {
    try {
      // Get current account information
      const accountInfo = this.accountTracker ? 
        this.accountTracker.getAccountSummary() : null;
      
      if (!accountInfo) {
        console.warn('No account information available for BP check');
        return true; // Allow if we can't check
      }
      
      const { totalBuyingPower, usedBuyingPower } = accountInfo;
      const availableBP = totalBuyingPower - usedBuyingPower;
      
      // Estimate BP requirement based on strategy and symbol
      const estimatedBPRequirement = this.estimateBPRequirement(symbol, strategy, quantity);
      
      // Tom King's rule: Never use more than 35% of total buying power
      const maxBPUsage = totalBuyingPower * 0.35;
      const wouldExceedLimit = (usedBuyingPower + estimatedBPRequirement) > maxBPUsage;
      
      if (wouldExceedLimit) {
        console.log(`BP limit would be exceeded. Current: ${usedBuyingPower}, Required: ${estimatedBPRequirement}, Max: ${maxBPUsage}`);
        return false;
      }
      
      // Check if we have enough available BP
      if (estimatedBPRequirement > availableBP) {
        console.log(`Insufficient buying power. Available: ${availableBP}, Required: ${estimatedBPRequirement}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking buying power:', error);
      // Conservative approach: deny if we can't check
      return false;
    }
  }
  
  estimateBPRequirement(symbol, strategy, quantity) {
    // Base requirements per contract/share
    const bpRequirements = {
      'ES': { STRANGLE: 12000, LT112: 8000, IRON_CONDOR: 5000 },
      'NQ': { STRANGLE: 18000, LT112: 12000, IRON_CONDOR: 8000 },
      'CL': { STRANGLE: 3000, LT112: 2000, IRON_CONDOR: 1500 },
      'GC': { STRANGLE: 8000, LT112: 5000, IRON_CONDOR: 3000 },
      'SPY': { STRANGLE: 2000, LT112: 1500, IRON_CONDOR: 1000 },
      'QQQ': { STRANGLE: 2500, LT112: 1800, IRON_CONDOR: 1200 },
      'TLT': { STRANGLE: 1000, LT112: 800, IRON_CONDOR: 600 },
      'GLD': { STRANGLE: 1500, LT112: 1200, IRON_CONDOR: 800 },
      'IWM': { STRANGLE: 1800, LT112: 1400, IRON_CONDOR: 1000 }
    };
    
    const symbolReqs = bpRequirements[symbol];
    if (!symbolReqs) {
      // Default estimation for unknown symbols
      return 5000 * quantity;
    }
    
    const baseRequirement = symbolReqs[strategy] || symbolReqs.STRANGLE;
    return baseRequirement * quantity;
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