/**
 * TomKingTrader - Complete Trading System Integration
 * Main entry point for all modules
 * 
 * This system implements Tom King's systematic trading methodology with:
 * - Real-time TastyTrade API integration
 * - Advanced pattern analysis engine
 * - Position health monitoring and correlation tracking
 * - Comprehensive risk management with VIX regime detection
 * - August 5, 2024 disaster prevention protocols
 */

// Core Module Imports
const { 
  TastyTradeAPI, 
  MarketDataCollector, 
  OrderBuilder,
  TokenManager,
  APIFailureHandler,
  SymbolUtils,
  testAPIConnection 
} = require('./tastytradeAPI');

const {
  EnhancedPatternAnalyzer: PatternAnalyzer,
  ConfidenceScorer: PatternQualityScorer,
  AdvancedTechnicalIndicators: TechnicalIndicators,
  SupportResistanceDetector: RangeAnalyzer,
  VolumeProfileAnalyzer: IVAnalyzer,
  MultiTimeframeAnalyzer: TrendAnalyzer,
  ChartPatternRecognizer: StrikeCalculator,
  TomKingPatternDetectors: StrategyAnalyzers
} = require('./enhancedPatternAnalysis');

const {
  PositionManager,
  PositionHealthCalculator,
  CorrelationTracker,
  BuyingPowerOptimizer,
  ExitManager,
  CORRELATION_GROUPS
} = require('./positionManager');

const {
  RiskManager,
  VIXRegimeAnalyzer,
  BPLimitsManager,
  August5DisasterPrevention
} = require('./riskManager');

/**
 * Main TomKingTrader System Class
 * Orchestrates all modules for complete trading system functionality
 */
class TomKingTrader {
  constructor(options = {}) {
    // Configuration
    this.config = {
      apiMode: options.apiMode || false,
      environment: options.environment || 'production',
      phase: options.phase || 1,
      accountValue: options.accountValue || 30000,
      debug: options.debug || false,
      ...options
    };
    
    // Initialize core modules
    this.api = null;
    this.patternAnalyzer = new PatternAnalyzer();
    this.positionManager = new PositionManager();
    this.riskManager = new RiskManager();
    
    // Data storage
    this.marketData = null;
    this.positions = [];
    this.lastUpdate = null;
    
    // Status tracking
    this.initialized = false;
    this.errorCount = 0;
    this.fallbackMode = false;
  }
  
  /**
   * Initialize the complete trading system
   */
  async initialize() {
    try {
      console.log('🚀 Initializing TomKingTrader System...');
      console.log(`📊 Configuration: Phase ${this.config.phase}, Account: £${this.config.accountValue.toLocaleString()}`);
      
      // Initialize API if in API mode
      if (this.config.apiMode) {
        await this.initializeAPI();
      }
      
      this.initialized = true;
      console.log('✅ TomKingTrader system initialized successfully');
      
      return {
        success: true,
        mode: this.config.apiMode ? 'API' : 'MANUAL',
        phase: this.config.phase,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('🚨 System initialization failed:', error.message);
      
      if (error.message === 'API_FALLBACK_TO_MANUAL') {
        this.fallbackMode = true;
        console.log('🔄 Falling back to manual mode');
        return {
          success: true,
          mode: 'MANUAL',
          fallback: true,
          phase: this.config.phase
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Initialize TastyTrade API connection
   */
  async initializeAPI() {
    try {
      this.api = new TastyTradeAPI(
        this.config.clientSecret,
        this.config.refreshToken,
        this.config.environment
      );
      
      await this.api.initialize();
      console.log('✅ TastyTrade API connected successfully');
      
    } catch (error) {
      console.error('🚨 API initialization failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Collect and analyze market data
   */
  async collectMarketData() {
    try {
      if (this.api && !this.fallbackMode) {
        // Use API for real-time data
        const collector = new MarketDataCollector(this.api);
        this.marketData = await collector.buildSearchedData();
        console.log('📊 Market data collected via API');
      } else {
        // Manual mode - requires external data input
        console.log('📋 Manual mode - market data required from external source');
        return {
          success: false,
          mode: 'MANUAL',
          message: 'Market data required - use search parsing or provide data structure'
        };
      }
      
      return {
        success: true,
        dataPoints: Object.keys(this.marketData).length,
        source: this.marketData.source,
        timestamp: this.marketData.timestamp
      };
      
    } catch (error) {
      console.error('🚨 Market data collection failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Update positions from API or manual input
   */
  async updatePositions(manualPositions = null) {
    try {
      if (manualPositions) {
        // Manual position input
        this.positions = manualPositions;
      } else if (this.api && !this.fallbackMode) {
        // Get positions from API
        this.positions = await this.api.refreshPositions();
      } else {
        console.log('📋 No position data available - using empty positions');
        this.positions = [];
      }
      
      // Update position manager
      this.positionManager.updatePositions(this.positions);
      this.lastUpdate = new Date();
      
      console.log(`📊 Updated ${this.positions.length} positions`);
      
      return {
        success: true,
        positionCount: this.positions.length,
        source: manualPositions ? 'MANUAL' : 'API'
      };
      
    } catch (error) {
      console.error('🚨 Position update failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Run complete analysis cycle
   */
  async runAnalysis(inputData = {}) {
    try {
      if (!this.initialized) {
        throw new Error('System not initialized - call initialize() first');
      }
      
      // Extract analysis parameters
      const vixLevel = inputData.vixLevel || this.marketData?.VIX?.currentLevel || 15;
      const phase = inputData.phase || this.config.phase;
      const accountValue = inputData.accountValue || this.config.accountValue;
      
      console.log('🔍 Running comprehensive analysis...');
      
      // 1. Pattern Analysis
      const patternResults = {};
      if (this.marketData) {
        const qualifiedTickers = this.getQualifiedTickers(phase);
        
        for (const ticker of qualifiedTickers) {
          if (this.marketData[ticker]) {
            patternResults[ticker] = this.patternAnalyzer.analyzePattern(
              ticker, 
              this.marketData[ticker], 
              phase
            );
          }
        }
      }
      
      // 2. Position Analysis
      const positionHealth = this.positionManager.getPositionHealth();
      const correlationStatus = this.positionManager.getCorrelationStatus(phase);
      const exitPlan = this.positionManager.getExitPlan();
      const bpUsage = this.positionManager.getCurrentBPUsage();
      
      // 3. Risk Analysis
      const riskAssessment = this.riskManager.assessRisk(
        this.positions,
        vixLevel,
        phase,
        accountValue
      );
      
      // 4. Generate recommendations
      const recommendations = this.generateRecommendations(
        patternResults,
        positionHealth,
        correlationStatus,
        riskAssessment
      );
      
      const analysis = {
        timestamp: new Date().toISOString(),
        phase,
        accountValue,
        vixLevel,
        
        // Core analysis results
        patterns: patternResults,
        positions: {
          health: positionHealth,
          correlation: correlationStatus,
          exitPlan,
          bpUsage
        },
        risk: riskAssessment,
        recommendations,
        
        // Summary metrics
        summary: {
          totalPositions: this.positions.length,
          criticalPositions: positionHealth.filter(p => p.exitTrigger).length,
          excellentPatterns: Object.values(patternResults).filter(p => p.quality === 'EXCELLENT').length,
          overallRiskLevel: riskAssessment.overallRisk.level,
          bpUsagePercent: bpUsage.totalBP,
          correlationViolations: correlationStatus.violations.filter(v => v.severity === 'HIGH').length
        }
      };
      
      console.log('✅ Analysis complete');
      console.log(`📊 Summary: ${analysis.summary.totalPositions} positions, ${analysis.summary.excellentPatterns} excellent patterns, ${analysis.summary.overallRiskLevel} risk`);
      
      return analysis;
      
    } catch (error) {
      console.error('🚨 Analysis failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Generate trade recommendations based on analysis
   */
  generateRecommendations(patternResults, positionHealth, correlationStatus, riskAssessment) {
    const recommendations = [];
    
    // Emergency actions (highest priority)
    if (riskAssessment.emergencyProtocols.hasEmergency) {
      riskAssessment.emergencyProtocols.protocols.forEach(protocol => {
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
    
    // Position exit recommendations
    const criticalPositions = positionHealth.filter(p => p.exitTrigger);
    if (criticalPositions.length > 0) {
      recommendations.push({
        type: 'POSITION_EXIT',
        priority: 'HIGH',
        title: `${criticalPositions.length} position(s) require immediate action`,
        actions: criticalPositions.map(p => `${p.ticker} ${p.strategy}: ${p.primaryAction}`),
        tickers: criticalPositions.map(p => p.ticker)
      });
    }
    
    // Correlation warnings
    if (correlationStatus.isViolated) {
      recommendations.push({
        type: 'CORRELATION_VIOLATION',
        priority: 'URGENT',
        title: 'Correlation limits exceeded',
        actions: ['Close excess positions immediately'],
        violations: correlationStatus.violations.filter(v => v.severity === 'HIGH')
      });
    }
    
    // Pattern-based entry recommendations
    const excellentPatterns = Object.values(patternResults).filter(p => 
      p.quality === 'EXCELLENT' && p.score >= 80
    );
    
    if (excellentPatterns.length > 0 && !riskAssessment.emergencyProtocols.hasEmergency) {
      excellentPatterns.slice(0, 3).forEach(pattern => {
        const canAdd = this.positionManager.canAddPosition(pattern.ticker, this.config.phase);
        
        if (canAdd.allowed) {
          recommendations.push({
            type: 'NEW_ENTRY',
            priority: 'MEDIUM',
            title: `Excellent setup: ${pattern.ticker}`,
            actions: pattern.recommendations,
            ticker: pattern.ticker,
            quality: pattern.quality,
            score: pattern.score
          });
        }
      });
    }
    
    // VIX opportunity recommendations
    if (riskAssessment.vixAnalysis.regime === 'EXTREME') {
      recommendations.push({
        type: 'VIX_OPPORTUNITY',
        priority: 'HIGH',
        title: 'Generational VIX spike opportunity',
        actions: riskAssessment.vixAnalysis.recommendations.slice(0, 3),
        expectedReturn: '15-25% monthly',
        vixLevel: riskAssessment.vixAnalysis.vixLevel
      });
    }
    
    return recommendations.slice(0, 8); // Top 8 recommendations
  }
  
  /**
   * Get qualified tickers for current phase
   */
  getQualifiedTickers(phase) {
    const tickers = {
      1: ['MCL', 'MGC', 'GLD', 'TLT'],
      2: ['MCL', 'MGC', 'GLD', 'TLT', 'MES', 'MNQ', 'SLV', 'XOP'],
      3: ['ES', 'CL', 'GC', 'LE', 'HE', 'ZC', 'ZS', 'ZW', 'TLT', 'GLD', 'SLV'],
      4: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'NG', 'SPY', 'QQQ', 'IWM', 'GLD', 'SLV', 'TLT', 'XLE', 'XOP']
    };
    
    return ['ES', 'SPY', 'VIX', 'DXY', ...(tickers[phase] || tickers[1])];
  }
  
  /**
   * Test API connection
   */
  async testConnection() {
    return testAPIConnection();
  }
  
  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      mode: this.config.apiMode && !this.fallbackMode ? 'API' : 'MANUAL',
      fallbackMode: this.fallbackMode,
      phase: this.config.phase,
      accountValue: this.config.accountValue,
      lastUpdate: this.lastUpdate,
      positionCount: this.positions.length,
      errorCount: this.errorCount,
      apiConnected: this.api ? true : false
    };
  }
  
  /**
   * Generate comprehensive report
   */
  async generateReport(inputData = {}) {
    try {
      // Collect fresh data
      await this.collectMarketData();
      await this.updatePositions(inputData.positions);
      
      // Run analysis
      const analysis = await this.runAnalysis(inputData);
      
      // Generate position manager report
      const positionReport = this.positionManager.generateReport();
      
      // Get risk summary
      const riskSummary = this.riskManager.getRiskSummary();
      
      return {
        timestamp: new Date().toISOString(),
        systemStatus: this.getStatus(),
        analysis,
        positionReport,
        riskSummary,
        
        // Executive summary
        executiveSummary: {
          phase: this.config.phase,
          accountValue: this.config.accountValue,
          totalPositions: this.positions.length,
          criticalActions: analysis.recommendations.filter(r => ['IMMEDIATE', 'URGENT'].includes(r.priority)).length,
          overallRisk: analysis.risk.overallRisk.level,
          vixRegime: analysis.risk.vixAnalysis.regime,
          bpUsage: analysis.positions.bpUsage.totalBP,
          excellentOpportunities: analysis.summary.excellentPatterns
        }
      };
      
    } catch (error) {
      console.error('🚨 Report generation failed:', error.message);
      throw error;
    }
  }
}

/**
 * Utility Functions
 */
const TomKingUtils = {
  // Phase calculation from account value
  calculatePhase(accountValue) {
    if (accountValue < 40000) return 1;
    if (accountValue < 60000) return 2;
    if (accountValue < 75000) return 3;
    return 4;
  },
  
  // Format currency for UK market
  formatCurrency(amount) {
    return `£${amount.toLocaleString('en-GB')}`;
  },
  
  // Calculate position size based on phase and BP
  calculatePositionSize(accountValue, strategy, phase) {
    const bpMap = {
      'STRANGLE': phase <= 2 ? 2.5 : 3.5,
      'LT112': phase <= 2 ? 3 : 6,
      'IPMCC': 8,
      '0DTE': 2,
      'LEAP': 2,
      'BUTTERFLY': 0.5,
      'RATIO': 2,
      'DIAGONAL': 1.5,
      'BOX': 0
    };
    
    const bpRequired = bpMap[strategy.toUpperCase()] || 3;
    return (accountValue * bpRequired / 100).toFixed(0);
  }
};

// Export the main system and utilities
module.exports = {
  TomKingTrader,
  TomKingUtils,
  
  // Export individual modules for advanced usage
  TastyTradeAPI,
  PatternAnalyzer,
  PositionManager,
  RiskManager,
  
  // Export utility classes
  MarketDataCollector,
  OrderBuilder,
  SymbolUtils,
  TechnicalIndicators,
  VIXRegimeAnalyzer,
  August5DisasterPrevention,
  CORRELATION_GROUPS
};

// Default export
module.exports.default = TomKingTrader;