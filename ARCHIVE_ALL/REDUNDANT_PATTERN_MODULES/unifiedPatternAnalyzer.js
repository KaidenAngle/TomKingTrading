/**
 * TOM KING TRADING FRAMEWORK v17.2
 * Unified Pattern Analyzer - Consolidates existing pattern analysis modules
 * This is an ADDITIVE consolidation that uses all existing functionality
 */

// Import all existing pattern analysis modules
const { EnhancedPatternAnalyzer } = require('../src/enhancedPatternAnalysis');
const { PatternAnalyzer: BasicPatternAnalyzer } = require('../src/patternAnalysis');
const { EnhancedTomKingFramework: EnhancedPatternIntegration } = require('../src/enhancedPatternIntegration');
const PatternValidator = require('../src/patternValidation');
const { EnhancedPatternTester } = require('../src/enhancedPatternTester');

/**
 * Unified Pattern Analyzer that leverages ALL existing pattern modules
 * This doesn't replace anything - it orchestrates the existing modules
 */
class UnifiedPatternAnalyzer {
    constructor() {
        // Initialize all existing analyzers
        this.enhancedAnalyzer = new EnhancedPatternAnalyzer();
        this.basicAnalyzer = new BasicPatternAnalyzer();
        this.integration = new EnhancedPatternIntegration();
        this.validator = new PatternValidator();
        this.tester = new EnhancedPatternTester();
        
        this.cache = new Map();
    }

    /**
     * Unified analysis that combines results from all analyzers
     */
    async analyzeComprehensive(marketData, strategy = null) {
        const cacheKey = `${JSON.stringify(marketData)}_${strategy}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            // Run all analyzers in parallel for best performance
            const [
                enhancedResults,
                basicResults,
                integrationResults,
                validationResults
            ] = await Promise.all([
                this.runEnhancedAnalysis(marketData, strategy),
                this.runBasicAnalysis(marketData),
                this.runIntegrationAnalysis(marketData, strategy),
                this.runValidation(marketData, strategy)
            ]);

            // Combine all results
            const combinedAnalysis = {
                timestamp: new Date().toISOString(),
                strategy,
                
                // Enhanced analysis results
                enhanced: enhancedResults,
                
                // Basic pattern analysis
                basic: basicResults,
                
                // Integration results
                integration: integrationResults,
                
                // Validation results
                validation: validationResults,
                
                // Consensus analysis
                consensus: this.buildConsensus(
                    enhancedResults,
                    basicResults,
                    integrationResults,
                    validationResults
                ),
                
                // Overall confidence based on agreement
                overallConfidence: this.calculateOverallConfidence(
                    enhancedResults,
                    basicResults,
                    integrationResults,
                    validationResults
                )
            };

            // Cache for 5 minutes
            this.cache.set(cacheKey, combinedAnalysis);
            setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);

            return combinedAnalysis;
            
        } catch (error) {
            console.error('Error in comprehensive analysis:', error);
            // Fallback to enhanced analyzer only
            return this.runEnhancedAnalysis(marketData, strategy);
        }
    }

    /**
     * Quick analysis using only the enhanced analyzer (for performance)
     */
    async analyzeQuick(marketData, strategy = null) {
        return this.enhancedAnalyzer.analyzeForStrategy(marketData, strategy);
    }

    /**
     * Run enhanced pattern analysis
     */
    async runEnhancedAnalysis(marketData, strategy) {
        try {
            if (strategy) {
                return await this.enhancedAnalyzer.analyzeForStrategy(marketData, strategy);
            }
            return await this.enhancedAnalyzer.analyze(marketData);
        } catch (error) {
            console.error('Enhanced analysis error:', error);
            return null;
        }
    }

    /**
     * Run basic pattern analysis
     */
    async runBasicAnalysis(marketData) {
        try {
            if (this.basicAnalyzer && typeof this.basicAnalyzer.analyze === 'function') {
                return await this.basicAnalyzer.analyze(marketData);
            }
            return null;
        } catch (error) {
            console.error('Basic analysis error:', error);
            return null;
        }
    }

    /**
     * Run integration analysis
     */
    async runIntegrationAnalysis(marketData, strategy) {
        try {
            if (this.integration && typeof this.integration.analyze === 'function') {
                return await this.integration.analyze(marketData, strategy);
            }
            return null;
        } catch (error) {
            console.error('Integration analysis error:', error);
            return null;
        }
    }

    /**
     * Run validation
     */
    async runValidation(marketData, strategy) {
        try {
            if (this.validator && typeof this.validator.validate === 'function') {
                return await this.validator.validate(marketData, strategy);
            }
            return null;
        } catch (error) {
            console.error('Validation error:', error);
            return null;
        }
    }

    /**
     * Build consensus from multiple analyzers
     */
    buildConsensus(enhanced, basic, integration, validation) {
        const consensus = {
            signals: [],
            patterns: [],
            recommendation: null,
            agreementLevel: 'NONE'
        };

        // Collect all signals
        const allSignals = [];
        
        if (enhanced?.signals) allSignals.push(...enhanced.signals);
        if (basic?.signals) allSignals.push(...basic.signals);
        if (integration?.signals) allSignals.push(...integration.signals);
        
        // Find most common signal type
        const signalCounts = {};
        allSignals.forEach(signal => {
            const type = signal.type || signal.action || 'UNKNOWN';
            signalCounts[type] = (signalCounts[type] || 0) + 1;
        });
        
        // Determine consensus
        const totalAnalyzers = 4;
        const maxAgreement = Math.max(...Object.values(signalCounts), 0);
        
        if (maxAgreement >= 3) {
            consensus.agreementLevel = 'STRONG';
            consensus.signals = allSignals;
        } else if (maxAgreement >= 2) {
            consensus.agreementLevel = 'MODERATE';
            consensus.signals = allSignals;
        } else if (maxAgreement >= 1) {
            consensus.agreementLevel = 'WEAK';
            consensus.signals = allSignals;
        }

        // Set recommendation based on strongest consensus
        if (consensus.agreementLevel !== 'NONE') {
            const strongestSignal = Object.entries(signalCounts)
                .sort((a, b) => b[1] - a[1])[0];
            
            if (strongestSignal) {
                consensus.recommendation = {
                    action: strongestSignal[0],
                    confidence: (maxAgreement / totalAnalyzers) * 100,
                    agreementCount: maxAgreement
                };
            }
        }

        return consensus;
    }

    /**
     * Calculate overall confidence based on analyzer agreement
     */
    calculateOverallConfidence(enhanced, basic, integration, validation) {
        let confidence = 0;
        let count = 0;

        // Collect all confidence scores
        if (enhanced?.confidence) {
            confidence += enhanced.confidence;
            count++;
        }
        
        if (basic?.confidence) {
            confidence += basic.confidence;
            count++;
        }
        
        if (integration?.confidence) {
            confidence += integration.confidence;
            count++;
        }
        
        if (validation?.isValid) {
            confidence += 80; // Valid patterns get high confidence
            count++;
        }

        // Calculate average confidence
        if (count === 0) return 50; // Default confidence
        
        const avgConfidence = confidence / count;
        
        // Boost confidence if multiple analyzers agree
        const agreementBonus = count >= 3 ? 10 : (count >= 2 ? 5 : 0);
        
        return Math.min(100, Math.round(avgConfidence + agreementBonus));
    }

    /**
     * Test pattern effectiveness
     */
    async testPattern(pattern, historicalData) {
        if (this.tester && typeof this.tester.test === 'function') {
            return await this.tester.test(pattern, historicalData);
        }
        return null;
    }

    /**
     * Validate a specific pattern
     */
    async validatePattern(pattern, marketData) {
        if (this.validator && typeof this.validator.validatePattern === 'function') {
            return await this.validator.validatePattern(pattern, marketData);
        }
        return true; // Default to valid if no validator
    }

    /**
     * Get analysis for a specific strategy (backwards compatibility)
     */
    async analyzeForStrategy(marketData, strategy) {
        // Use the enhanced analyzer's strategy-specific analysis
        return this.enhancedAnalyzer.analyzeForStrategy(marketData, strategy);
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Export as singleton for consistent usage across the app
let instance = null;

module.exports = {
    UnifiedPatternAnalyzer,
    
    // Singleton getter
    getInstance: () => {
        if (!instance) {
            instance = new UnifiedPatternAnalyzer();
        }
        return instance;
    },
    
    // For backwards compatibility, export as default
    default: UnifiedPatternAnalyzer
};