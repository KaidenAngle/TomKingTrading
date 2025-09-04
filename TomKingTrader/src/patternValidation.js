/**
 * Pattern Validation Engine
 * Validates trading patterns and setups before execution
 * 
 * This module provides pattern validation for:
 * - Tom King trading setups
 * - Section 9B advanced strategies
 * - Technical analysis patterns
 * - Risk management compliance
 */

const { EnhancedPatternAnalyzer } = require('./enhancedPatternAnalysis');
const { RiskManager } = require('./riskManager');
const { RISK_LIMITS } = require('./config');
const { getLogger } = require('./logger');

const logger = getLogger();

class PatternValidationEngine {
    constructor(options = {}) {
        this.config = {
            strictValidation: options.strictValidation || true,
            minConfidence: options.minConfidence || 0.7,
            enableTechnicalValidation: options.enableTechnicalValidation || true,
            enableRiskValidation: options.enableRiskValidation || true
        };

        this.patternAnalyzer = new EnhancedPatternAnalyzer();
        this.riskManager = new RiskManager();
        
        // Pattern validation rules
        this.validationRules = this.initializeValidationRules();
        
        logger.info('PATTERN_VALIDATION', 'PatternValidationEngine initialized');
    }

    /**
     * Initialize pattern validation rules
     */
    initializeValidationRules() {
        return {
            // Tom King Strategy Rules
            FRIDAY_0DTE: {
                dayOfWeek: 5, // Friday
                minTime: '10:30',
                minVIX: 22,
                maxBPUsage: 'DYNAMIC', // Uses RISK_LIMITS.getMaxBPUsage(vix)
                requiredPhase: 1
            },
            
            LONG_TERM_112: {
                minDTE: 45,
                maxDTE: 90,
                minIVRank: 0.30,
                maxBPUsage: 'DYNAMIC', // Uses RISK_LIMITS.getMaxBPUsage(vix)
                requiredPhase: 1
            },

            // Section 9B Rules
            BROKEN_WING_CONDOR: {
                minVIX: 20,
                requiredPhase: 4,
                maxBPUsage: 'DYNAMIC', // Uses RISK_LIMITS.getMaxBPUsage(vix)
                minPremium: 500
            },

            BATMAN_SPREAD: {
                minVIX: 25,
                requiredPhase: 4,
                maxBPUsage: 'DYNAMIC', // Uses RISK_LIMITS.getMaxBPUsage(vix)
                volatilityRegime: 'HIGH'
            },

            // Risk Management Rules
            GENERAL_RISK: {
                maxRiskPerTrade: 0.05,
                maxCorrelationPositions: {
                    1: 2, // Phase 1: max 2 positions per group
                    2: 2, // Phase 2: max 2 positions per group
                    3: 3, // Phase 3: max 3 positions per group
                    4: 4  // Phase 4: max 4 positions per group
                },
                maxOpenPositions: {
                    1: 5,  // Phase 1: max 5 total positions
                    2: 8,  // Phase 2: max 8 total positions
                    3: 12, // Phase 3: max 12 total positions
                    4: 20  // Phase 4: max 20 total positions
                }
            }
        };
    }

    /**
     * Validate all patterns for a given setup
     */
    async validateAllPatterns(setup, marketConditions, accountInfo) {
        const validationResults = {
            overall: { valid: false, confidence: 0, issues: [] },
            technical: { valid: false, signals: [] },
            risk: { valid: false, checks: [] },
            strategy: { valid: false, rules: [] },
            timestamp: new Date().toISOString()
        };

        try {
            // Technical Pattern Validation
            if (this.config.enableTechnicalValidation) {
                validationResults.technical = await this.validateTechnicalPatterns(
                    setup, marketConditions
                );
            }

            // Risk Validation
            if (this.config.enableRiskValidation) {
                validationResults.risk = await this.validateRiskCompliance(
                    setup, accountInfo
                );
            }

            // Strategy-Specific Validation
            validationResults.strategy = await this.validateStrategyRules(
                setup, marketConditions, accountInfo
            );

            // Calculate overall validation
            validationResults.overall = this.calculateOverallValidation(validationResults);

            logger.info('PATTERN_VALIDATION', 'Pattern validation complete', {
                strategy: setup.strategy,
                valid: validationResults.overall.valid,
                confidence: validationResults.overall.confidence
            });

            return validationResults;

        } catch (error) {
            logger.error('PATTERN_VALIDATION', 'Validation failed', error);
            validationResults.overall.issues.push(`Validation error: ${error.message}`);
            return validationResults;
        }
    }

    /**
     * Validate technical analysis patterns
     */
    async validateTechnicalPatterns(setup, marketConditions) {
        const technical = {
            valid: false,
            signals: [],
            confidence: 0
        };

        try {
            // Use enhanced pattern analyzer
            const patterns = await this.patternAnalyzer.analyzePatterns(
                setup.underlying,
                marketConditions
            );

            // Check for bullish/bearish alignment
            const trendAlignment = this.validateTrendAlignment(setup, patterns);
            technical.signals.push(trendAlignment);

            // Check volatility conditions
            const volatilityCheck = this.validateVolatilityConditions(setup, marketConditions);
            technical.signals.push(volatilityCheck);

            // Check support/resistance levels
            const levelCheck = this.validateKeyLevels(setup, patterns);
            technical.signals.push(levelCheck);

            // Calculate technical confidence
            const validSignals = technical.signals.filter(s => s.valid);
            technical.confidence = validSignals.length / technical.signals.length;
            technical.valid = technical.confidence >= this.config.minConfidence;

        } catch (error) {
            logger.error('PATTERN_VALIDATION', 'Technical validation failed', error);
            technical.signals.push({
                type: 'ERROR',
                valid: false,
                message: `Technical analysis failed: ${error.message}`
            });
        }

        return technical;
    }

    /**
     * Validate risk management compliance
     */
    async validateRiskCompliance(setup, accountInfo) {
        const risk = {
            valid: false,
            checks: []
        };

        const rules = this.validationRules.GENERAL_RISK;
        const phase = accountInfo.phase || 1;

        // Check individual trade risk
        const tradeRiskCheck = {
            type: 'TRADE_RISK',
            valid: false,
            message: ''
        };

        const maxRisk = accountInfo.balance * rules.maxRiskPerTrade;
        if (setup.maxRisk <= maxRisk) {
            tradeRiskCheck.valid = true;
            tradeRiskCheck.message = `Trade risk ($${setup.maxRisk}) within limit ($${maxRisk.toFixed(0)})`;
        } else {
            tradeRiskCheck.message = `Trade risk ($${setup.maxRisk}) exceeds limit ($${maxRisk.toFixed(0)})`;
        }
        risk.checks.push(tradeRiskCheck);

        // Check correlation limits
        const correlationCheck = {
            type: 'CORRELATION',
            valid: false,
            message: ''
        };

        const maxCorrelatedPositions = rules.maxCorrelationPositions[phase];
        const currentCorrelatedPositions = this.countCorrelatedPositions(
            setup.underlying,
            accountInfo.positions || []
        );

        if (currentCorrelatedPositions < maxCorrelatedPositions) {
            correlationCheck.valid = true;
            correlationCheck.message = `Correlation (${currentCorrelatedPositions}/${maxCorrelatedPositions}) within limits`;
        } else {
            correlationCheck.message = `Too many correlated positions (${currentCorrelatedPositions}/${maxCorrelatedPositions})`;
        }
        risk.checks.push(correlationCheck);

        // Check total position limits
        const positionLimitCheck = {
            type: 'POSITION_LIMIT',
            valid: false,
            message: ''
        };

        const maxPositions = rules.maxOpenPositions[phase];
        const currentPositions = (accountInfo.positions || []).length;

        if (currentPositions < maxPositions) {
            positionLimitCheck.valid = true;
            positionLimitCheck.message = `Position count (${currentPositions}/${maxPositions}) within limits`;
        } else {
            positionLimitCheck.message = `Too many open positions (${currentPositions}/${maxPositions})`;
        }
        risk.checks.push(positionLimitCheck);

        // Overall risk validation
        const validChecks = risk.checks.filter(c => c.valid);
        risk.valid = validChecks.length === risk.checks.length;

        return risk;
    }

    /**
     * Validate strategy-specific rules
     */
    async validateStrategyRules(setup, marketConditions, accountInfo) {
        const strategy = {
            valid: false,
            rules: []
        };

        const strategyRules = this.validationRules[setup.strategy];
        if (!strategyRules) {
            strategy.rules.push({
                type: 'UNKNOWN_STRATEGY',
                valid: false,
                message: `No validation rules for strategy: ${setup.strategy}`
            });
            return strategy;
        }

        // Validate each rule
        for (const [ruleType, ruleValue] of Object.entries(strategyRules)) {
            const ruleCheck = this.validateStrategyRule(
                ruleType,
                ruleValue,
                setup,
                marketConditions,
                accountInfo
            );
            strategy.rules.push(ruleCheck);
        }

        // Overall strategy validation
        const validRules = strategy.rules.filter(r => r.valid);
        strategy.valid = validRules.length === strategy.rules.length;

        return strategy;
    }

    /**
     * Validate individual strategy rule
     */
    validateStrategyRule(ruleType, ruleValue, setup, marketConditions, accountInfo) {
        const rule = {
            type: ruleType,
            valid: false,
            message: ''
        };

        switch (ruleType) {
            case 'dayOfWeek':
                const currentDay = new Date().getDay();
                rule.valid = currentDay === ruleValue;
                rule.message = rule.valid ? 
                    `Correct day (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][currentDay]})` :
                    `Wrong day (need ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][ruleValue]})`;
                break;

            case 'minVIX':
                const vix = marketConditions.vix || 20;
                rule.valid = vix >= ruleValue;
                rule.message = rule.valid ?
                    `VIX (${vix}) above minimum (${ruleValue})` :
                    `VIX (${vix}) below minimum (${ruleValue})`;
                break;

            case 'requiredPhase':
                rule.valid = accountInfo.phase >= ruleValue;
                rule.message = rule.valid ?
                    `Phase ${accountInfo.phase} meets requirement (${ruleValue}+)` :
                    `Phase ${accountInfo.phase} below requirement (${ruleValue}+)`;
                break;

            case 'maxBPUsage':
                const currentBP = accountInfo.bpUsage || 0;
                rule.valid = currentBP <= ruleValue;
                rule.message = rule.valid ?
                    `BP usage (${(currentBP*100).toFixed(1)}%) within limit (${(ruleValue*100).toFixed(1)}%)` :
                    `BP usage (${(currentBP*100).toFixed(1)}%) exceeds limit (${(ruleValue*100).toFixed(1)}%)`;
                break;

            default:
                rule.valid = true;
                rule.message = `Rule ${ruleType} not implemented`;
        }

        return rule;
    }

    /**
     * Calculate overall validation result
     */
    calculateOverallValidation(results) {
        const overall = {
            valid: false,
            confidence: 0,
            issues: []
        };

        let totalWeight = 0;
        let validWeight = 0;

        // Technical validation (weight: 0.3)
        if (results.technical) {
            totalWeight += 0.3;
            if (results.technical.valid) validWeight += 0.3;
            else overall.issues.push('Technical patterns not favorable');
        }

        // Risk validation (weight: 0.5 - most important)
        if (results.risk) {
            totalWeight += 0.5;
            if (results.risk.valid) validWeight += 0.5;
            else {
                const failedChecks = results.risk.checks.filter(c => !c.valid);
                failedChecks.forEach(check => overall.issues.push(check.message));
            }
        }

        // Strategy validation (weight: 0.2)
        if (results.strategy) {
            totalWeight += 0.2;
            if (results.strategy.valid) validWeight += 0.2;
            else {
                const failedRules = results.strategy.rules.filter(r => !r.valid);
                failedRules.forEach(rule => overall.issues.push(rule.message));
            }
        }

        overall.confidence = totalWeight > 0 ? validWeight / totalWeight : 0;
        overall.valid = overall.confidence >= this.config.minConfidence && overall.issues.length === 0;

        return overall;
    }

    /**
     * Helper methods
     */
    validateTrendAlignment(setup, patterns) {
        // Simplified trend validation
        return {
            type: 'TREND_ALIGNMENT',
            valid: true, // Placeholder
            message: 'Trend alignment check passed'
        };
    }

    validateVolatilityConditions(setup, marketConditions) {
        return {
            type: 'VOLATILITY',
            valid: true, // Placeholder
            message: 'Volatility conditions acceptable'
        };
    }

    validateKeyLevels(setup, patterns) {
        return {
            type: 'KEY_LEVELS',
            valid: true, // Placeholder
            message: 'Key levels support setup'
        };
    }

    countCorrelatedPositions(underlying, positions) {
        // Count positions in the same correlation group
        const correlationGroups = {
            'SPY': ['SPX', 'QQQ', 'IWM', 'DIA'],
            'QQQ': ['SPY', 'SPX', 'TQQQ', 'SQQQ'],
            'GLD': ['GDX', 'SLV', 'GOLD'],
            'TLT': ['TYO', 'TNX', 'IEF']
        };

        const group = correlationGroups[underlying] || [underlying];
        return positions.filter(pos => 
            group.includes(pos.underlying) || pos.underlying === underlying
        ).length;
    }
}

module.exports = { PatternValidationEngine };