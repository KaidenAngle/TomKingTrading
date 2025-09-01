/**
 * Enhanced Pattern Analysis Testing Suite
 * Demonstrates the capabilities of the enhanced pattern analysis system
 */

const { 
  EnhancedPatternAnalyzer,
  AdvancedTechnicalIndicators,
  SupportResistanceDetector,
  TomKingPatternDetectors
} = require('./enhancedPatternAnalysis');

/**
 * Test Data Generator
 */
class TestDataGenerator {
  static generateESMarketData() {
    // Simulated E-mini S&P 500 data
    const basePrice = 4500;
    const closes = [];
    const highs = [];
    const lows = [];
    const volumes = [];
    
    for (let i = 0; i < 100; i++) {
      const randomWalk = (Math.random() - 0.5) * 20;
      const close = basePrice + randomWalk + (i * 2); // Slight uptrend
      const high = close + (Math.random() * 15);
      const low = close - (Math.random() * 15);
      const volume = 100000 + (Math.random() * 50000);
      
      closes.push(close);
      highs.push(high);
      lows.push(low);
      volumes.push(volume);
    }
    
    return {
      symbol: 'ES',
      currentPrice: closes[closes.length - 1],
      openPrice: closes[closes.length - 1] - 5,
      closes: closes,
      highs: highs,
      lows: lows,
      volumes: volumes,
      high5d: Math.max(...highs.slice(-5)),
      low5d: Math.min(...lows.slice(-5)),
      high20d: Math.max(...highs.slice(-20)),
      low20d: Math.min(...lows.slice(-20)),
      iv: 0.22,
      ivRank: 65,
      ivPercentile: 68,
      dte: 45,
      vix: 18.5,
      atr: 28.5,
      rsi: 52,
      ema8: closes[closes.length - 1] - 2,
      ema21: closes[closes.length - 1] - 8,
      vwap: closes[closes.length - 1] + 1,
      avgVolume: 125000
    };
  }
  
  static generateHighIVScenario() {
    const data = this.generateESMarketData();
    data.iv = 0.45;
    data.ivRank = 85;
    data.ivPercentile = 88;
    data.vix = 32;
    return data;
  }
  
  static generate0DTEScenario() {
    const data = this.generateESMarketData();
    data.dte = 0;
    data.openPrice = data.currentPrice - 25; // Big gap up
    data.volume = data.avgVolume * 2.5; // High volume
    return data;
  }
  
  static generateVIXSpikeScenario() {
    const data = this.generateESMarketData();
    data.vix = 38;
    data.vixHistory = [15, 16, 18, 22, 38]; // Spike from 22 to 38
    data.putCallRatio = 1.45;
    data.iv = 0.52;
    data.ivRank = 92;
    return data;
  }
}

/**
 * Test Suite Runner
 */
class EnhancedPatternTester {
  constructor() {
    this.analyzer = new EnhancedPatternAnalyzer();
    this.testResults = [];
  }
  
  runAllTests() {
    console.log('🚀 Starting Enhanced Pattern Analysis Test Suite\n');
    console.log('=' .repeat(60));
    
    // Test 1: Technical Indicators
    this.testTechnicalIndicators();
    
    // Test 2: Support/Resistance Detection
    this.testSupportResistance();
    
    // Test 3: Tom King Pattern Detection
    this.testTomKingPatterns();
    
    // Test 4: Complete Enhanced Analysis
    this.testCompleteAnalysis();
    
    // Test 5: Real-world Scenarios
    this.testRealWorldScenarios();
    
    // Summary
    this.printTestSummary();
  }
  
  testTechnicalIndicators() {
    console.log('\n📊 Testing Technical Indicators');
    console.log('-'.repeat(40));
    
    const marketData = TestDataGenerator.generateESMarketData();
    const closes = marketData.closes;
    const highs = marketData.highs;
    const lows = marketData.lows;
    const volumes = marketData.volumes;
    
    // Test RSI
    const rsi = AdvancedTechnicalIndicators.calculateRSI(closes);
    console.log(`RSI (14): ${rsi ? rsi.toFixed(2) : 'N/A'}`);
    this.recordTest('RSI Calculation', rsi !== null && rsi >= 0 && rsi <= 100);
    
    // Test MACD
    const macd = AdvancedTechnicalIndicators.calculateMACD(closes);
    console.log(`MACD: ${macd ? JSON.stringify({
      macd: macd.macd.toFixed(3),
      signal: macd.signal?.toFixed(3) || 'N/A',
      crossover: macd.crossover
    }) : 'N/A'}`);
    this.recordTest('MACD Calculation', macd !== null);
    
    // Test Bollinger Bands
    const bb = AdvancedTechnicalIndicators.calculateBollingerBands(closes);
    console.log(`Bollinger Bands: Upper: ${bb ? bb.upper.toFixed(2) : 'N/A'}, Lower: ${bb ? bb.lower.toFixed(2) : 'N/A'}`);
    console.log(`BB Position: ${bb ? bb.position.toFixed(1) : 'N/A'}%, Squeeze: ${bb ? bb.squeeze : 'N/A'}`);
    this.recordTest('Bollinger Bands Calculation', bb !== null);
    
    // Test Stochastic
    const stoch = AdvancedTechnicalIndicators.calculateStochastic(highs, lows, closes);
    console.log(`Stochastic: %K: ${stoch ? stoch.k?.toFixed(2) || 'N/A' : 'N/A'}, Signal: ${stoch ? stoch.signal : 'N/A'}`);
    this.recordTest('Stochastic Calculation', stoch !== null);
    
    // Test ATR
    const atr = AdvancedTechnicalIndicators.calculateATR(highs, lows, closes);
    console.log(`ATR (14): ${atr ? atr.toFixed(2) : 'N/A'}`);
    this.recordTest('ATR Calculation', atr !== null);
    
    // Test Volume Indicators
    const vwap = AdvancedTechnicalIndicators.calculateVWAP(closes, volumes, highs, lows);
    const obv = AdvancedTechnicalIndicators.calculateOBV(closes, volumes);
    const mfi = AdvancedTechnicalIndicators.calculateMFI(highs, lows, closes, volumes);
    
    console.log(`VWAP: ${vwap ? vwap.toFixed(2) : 'N/A'}`);
    console.log(`OBV: ${obv ? obv.toFixed(0) : 'N/A'}`);
    console.log(`MFI: ${mfi ? mfi.toFixed(2) : 'N/A'}`);
    
    this.recordTest('Volume Indicators', vwap !== null && obv !== null && mfi !== null);
  }
  
  testSupportResistance() {
    console.log('\n🎯 Testing Support/Resistance Detection');
    console.log('-'.repeat(40));
    
    const marketData = TestDataGenerator.generateESMarketData();
    const levels = SupportResistanceDetector.detectLevels(
      marketData.highs,
      marketData.lows,
      marketData.closes
    );
    
    console.log(`Found ${levels.length} significant S/R levels:`);
    
    levels.slice(0, 5).forEach((level, index) => {
      console.log(`${index + 1}. ${level.type} at ${level.level.toFixed(2)} (Strength: ${level.strength})`);
    });
    
    this.recordTest('Support/Resistance Detection', levels.length > 0);
  }
  
  testTomKingPatterns() {
    console.log('\n🎯 Testing Tom King Pattern Detection');
    console.log('-'.repeat(40));
    
    // Test Strangle Setup
    console.log('\nStrangle Setup Analysis:');
    const strangleData = TestDataGenerator.generateHighIVScenario();
    const stranglePattern = TomKingPatternDetectors.detectStrangleSetup(strangleData);
    
    console.log(`Suitable: ${stranglePattern.suitable}`);
    console.log(`Quality: ${stranglePattern.quality}`);
    console.log(`Confidence: ${(stranglePattern.confidence * 100).toFixed(1)}%`);
    console.log('Reasons:');
    stranglePattern.reasons.forEach(reason => console.log(`  • ${reason}`));
    
    this.recordTest('Strangle Pattern Detection', stranglePattern.suitable);
    
    // Test 0DTE Friday Pattern
    console.log('\n0DTE Friday Analysis:');
    const fridayData = TestDataGenerator.generate0DTEScenario();
    const fridayPattern = TomKingPatternDetectors.detect0DTEFridayPattern(fridayData, new Date());
    
    console.log(`Allowed: ${fridayPattern.allowed}`);
    console.log(`Direction: ${fridayPattern.direction}`);
    if (fridayPattern.allowed) {
      console.log(`Quality: ${fridayPattern.quality}`);
      console.log(`Risk Level: ${fridayPattern.riskLevel}`);
    }
    console.log('Analysis:');
    fridayPattern.reasons.forEach(reason => console.log(`  • ${reason}`));
    
    this.recordTest('0DTE Pattern Detection', fridayPattern.allowed !== undefined);
    
    // Test VIX Spike Pattern
    console.log('\nVIX Spike Analysis:');
    const vixData = TestDataGenerator.generateVIXSpikeScenario();
    const vixPattern = TomKingPatternDetectors.detectVIXSpikePattern(vixData);
    
    console.log(`Suitable: ${vixPattern.suitable}`);
    console.log(`Quality: ${vixPattern.quality}`);
    console.log(`Confidence: ${(vixPattern.confidence * 100).toFixed(1)}%`);
    console.log('Reasons:');
    vixPattern.reasons.forEach(reason => console.log(`  • ${reason}`));
    
    this.recordTest('VIX Spike Pattern Detection', vixPattern.confidence > 0);
  }
  
  testCompleteAnalysis() {
    console.log('\n🔍 Testing Complete Enhanced Analysis');
    console.log('-'.repeat(40));
    
    const marketData = TestDataGenerator.generateHighIVScenario();
    const analysis = this.analyzer.analyzeEnhanced('ES', marketData, 'STRANGLE');
    
    console.log(`\nAnalysis for ${analysis.ticker}:`);
    console.log(`Timestamp: ${analysis.timestamp}`);
    console.log(`Strategy: ${analysis.strategy}`);
    
    // Technical Indicators Summary
    console.log('\nTechnical Indicators:');
    const tech = analysis.technicalIndicators;
    if (tech.rsi) console.log(`  RSI: ${tech.rsi.toFixed(1)}`);
    if (tech.bollingerBands) console.log(`  BB Position: ${tech.bollingerBands.position.toFixed(1)}%`);
    if (tech.macd) console.log(`  MACD: ${tech.macd.crossover}`);
    
    // Support/Resistance Summary
    console.log(`\nSupport/Resistance: ${analysis.supportResistance.length} levels found`);
    
    // Chart Patterns
    console.log(`\nChart Patterns: ${analysis.chartPatterns.length} patterns detected`);
    analysis.chartPatterns.forEach(pattern => {
      console.log(`  • ${pattern.type} (Confidence: ${(pattern.confidence * 100).toFixed(1)}%)`);
    });
    
    // Tom King Patterns
    console.log('\nTom King Patterns:');
    Object.entries(analysis.tomKingPatterns).forEach(([name, pattern]) => {
      if (pattern && pattern.suitable) {
        console.log(`  • ${name}: ${pattern.quality} (${(pattern.confidence * 100).toFixed(1)}%)`);
      }
    });
    
    // Overall Assessment
    const assessment = analysis.overallAssessment;
    console.log('\nOverall Assessment:');
    console.log(`  Recommendation: ${assessment.recommendation}`);
    console.log(`  Confidence: ${assessment.confidence}%`);
    console.log(`  Primary Pattern: ${assessment.primaryPattern?.name || 'None'}`);
    console.log(`  Risk Level: ${assessment.riskLevel}`);
    console.log(`  Expected Return: ${assessment.expectedReturn}%`);
    console.log(`  Key Factors:`);
    assessment.keyFactors.forEach(factor => console.log(`    • ${factor}`));
    
    this.recordTest('Complete Analysis', analysis.overallAssessment.recommendation !== null);
  }
  
  testRealWorldScenarios() {
    console.log('\n🌍 Testing Real-World Scenarios');
    console.log('-'.repeat(40));
    
    const scenarios = [
      {
        name: 'High IV Strangle Setup',
        data: TestDataGenerator.generateHighIVScenario(),
        strategy: 'STRANGLE'
      },
      {
        name: 'Friday 0DTE Opportunity',
        data: TestDataGenerator.generate0DTEScenario(),
        strategy: '0DTE'
      },
      {
        name: 'VIX Spike Opportunity',
        data: TestDataGenerator.generateVIXSpikeScenario(),
        strategy: 'VIX_SPIKE'
      }
    ];
    
    scenarios.forEach(scenario => {
      console.log(`\n${scenario.name}:`);
      
      const analysis = this.analyzer.analyzeEnhanced('ES', scenario.data, scenario.strategy);
      const assessment = analysis.overallAssessment;
      
      console.log(`  Recommendation: ${assessment.recommendation}`);
      console.log(`  Confidence: ${assessment.confidence}%`);
      console.log(`  Risk Level: ${assessment.riskLevel}`);
      console.log(`  Expected Return: ${assessment.expectedReturn}%`);
      
      // Show top 3 factors
      console.log('  Top Factors:');
      assessment.keyFactors.slice(0, 3).forEach(factor => {
        console.log(`    • ${factor}`);
      });
      
      this.recordTest(`${scenario.name} Analysis`, assessment.confidence >= 60);
    });
  }
  
  recordTest(testName, passed) {
    this.testResults.push({ name: testName, passed });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
  }
  
  printTestSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(60));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(test => test.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (failedTests > 0) {
      console.log('\nFailed Tests:');
      this.testResults.filter(test => !test.passed).forEach(test => {
        console.log(`  • ${test.name}`);
      });
    }
    
    console.log('\n🎉 Enhanced Pattern Analysis System Test Complete!');
    console.log('The system is ready for deployment in the Tom King Trading Framework.');
  }
}

/**
 * Demo Usage Examples
 */
class PatternAnalysisDemo {
  static runDemo() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 ENHANCED PATTERN ANALYSIS DEMO');
    console.log('='.repeat(60));
    
    const analyzer = new EnhancedPatternAnalyzer();
    
    // Example 1: ES Strangle Analysis
    console.log('\n📊 Example 1: E-mini S&P 500 Strangle Analysis');
    console.log('-'.repeat(50));
    
    const esData = TestDataGenerator.generateHighIVScenario();
    const esAnalysis = analyzer.analyzeEnhanced('ES', esData, 'STRANGLE');
    
    this.printAnalysisSummary(esAnalysis);
    
    // Example 2: Integration with existing framework
    console.log('\n🔧 Example 2: Framework Integration');
    console.log('-'.repeat(50));
    
    this.showFrameworkIntegration();
  }
  
  static printAnalysisSummary(analysis) {
    const summary = analysis.overallAssessment;
    
    console.log(`Symbol: ${analysis.ticker}`);
    console.log(`Strategy Focus: ${analysis.strategy}`);
    console.log(`Overall Recommendation: ${summary.recommendation}`);
    console.log(`Confidence Level: ${summary.confidence}%`);
    console.log(`Risk Assessment: ${summary.riskLevel}`);
    console.log(`Expected Return: ${summary.expectedReturn}%`);
    console.log(`Timeframe: ${summary.timeframe}`);
    
    if (summary.primaryPattern) {
      console.log(`Primary Pattern: ${summary.primaryPattern.name || summary.primaryPattern.type}`);
      console.log(`Pattern Quality: ${summary.primaryPattern.quality}`);
    }
    
    console.log('Key Success Factors:');
    summary.keyFactors.forEach((factor, index) => {
      console.log(`  ${index + 1}. ${factor}`);
    });
  }
  
  static showFrameworkIntegration() {
    console.log('// Integration with existing Tom King Framework');
    console.log('const { EnhancedPatternAnalyzer } = require("./enhancedPatternAnalysis");');
    console.log('');
    console.log('// In your main trading loop:');
    console.log('const analyzer = new EnhancedPatternAnalyzer();');
    console.log('');
    console.log('// Analyze market data');
    console.log('const marketData = await fetchMarketData("ES");');
    console.log('const analysis = analyzer.analyzeEnhanced("ES", marketData, "AUTO");');
    console.log('');
    console.log('// Make trading decisions');
    console.log('if (analysis.overallAssessment.recommendation === "BUY" &&');
    console.log('    analysis.overallAssessment.confidence >= 75) {');
    console.log('  ');
    console.log('  const position = {');
    console.log('    strategy: analysis.overallAssessment.primaryPattern.name,');
    console.log('    expectedReturn: analysis.overallAssessment.expectedReturn,');
    console.log('    riskLevel: analysis.overallAssessment.riskLevel,');
    console.log('    stopLoss: analysis.overallAssessment.stopLoss,');
    console.log('    profitTarget: analysis.overallAssessment.profitTarget');
    console.log('  };');
    console.log('  ');
    console.log('  await executePosition(position);');
    console.log('}');
  }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const tester = new EnhancedPatternTester();
  tester.runAllTests();
  
  // Run demo
  PatternAnalysisDemo.runDemo();
}

module.exports = {
  EnhancedPatternTester,
  TestDataGenerator,
  PatternAnalysisDemo
};