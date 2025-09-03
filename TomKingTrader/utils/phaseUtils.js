/**
 * Phase Determination Utilities
 * Centralized Tom King phase calculation logic
 * Eliminates code duplication across modules
 */

/**
 * Determine trading phase based on account balance
 * Tom King's systematic approach to account progression
 */
function determinePhase(balance) {
    if (balance < 35000) {
        return {
            phase: 0,
            name: 'BUILDING',
            range: '£0k-£35k',
            description: 'Account building phase - conservative approach',
            strategies: ['LEARNING', 'PAPER_TRADING'],
            maxBP: 0.30,
            riskLevel: 'VERY_LOW'
        };
    }
    
    if (balance < 40000) {
        return {
            phase: 1,
            name: 'FOUNDATION', 
            range: '£35k-£40k',
            description: 'Foundation phase - MCL, MGC strangles, 0DTE Fridays',
            strategies: ['MCL_STRANGLES', 'MGC_STRANGLES', 'FRIDAY_0DTE', 'GLD_TLT_STRANGLES'],
            maxBP: 0.35,
            riskLevel: 'LOW',
            correlationGroups: 2,
            maxPositionsPerGroup: 2
        };
    }
    
    if (balance < 60000) {
        return {
            phase: 2,
            name: 'EXPANSION',
            range: '£40k-£60k', 
            description: 'Expansion phase - Add MES, MNQ, currency futures',
            strategies: ['ALL_PHASE_1', 'MES_STRANGLES', 'MNQ_STRANGLES', 'CURRENCY_FUTURES', 'LONG_TERM_112'],
            maxBP: 0.50,
            riskLevel: 'MEDIUM',
            correlationGroups: 3,
            maxPositionsPerGroup: 3
        };
    }
    
    if (balance < 75000) {
        return {
            phase: 3,
            name: 'SOPHISTICATION',
            range: '£60k-£75k',
            description: 'Sophisticated strategies - Full futures, butterflies, spreads', 
            strategies: ['ALL_PHASE_2', 'FULL_FUTURES', 'BUTTERFLIES', 'RATIO_SPREADS', 'SECTION_9B'],
            maxBP: 0.65,
            riskLevel: 'MEDIUM_HIGH',
            correlationGroups: 4,
            maxPositionsPerGroup: 3
        };
    }
    
    // Phase 4: £75k+
    return {
        phase: 4,
        name: 'PROFESSIONAL',
        range: '£75k+',
        description: 'Professional deployment - All strategies, maximum efficiency',
        strategies: ['ALL_STRATEGIES', 'ADVANCED_SECTION_9B', 'CALENDAR_SPREADS', 'COMPLEX_STRUCTURES'],
        maxBP: 0.75,
        riskLevel: 'HIGH',
        correlationGroups: 5,
        maxPositionsPerGroup: 4,
        professionalLevel: true
    };
}

/**
 * Get phase transition requirements
 */
function getPhaseTransitionRequirements(currentPhase) {
    const transitions = {
        0: { targetBalance: 35000, requirements: ['Complete training', 'Paper trading proficiency'] },
        1: { targetBalance: 40000, requirements: ['Consistent 0DTE performance', '2+ months experience'] },
        2: { targetBalance: 60000, requirements: ['Risk management proficiency', 'Correlation understanding'] },
        3: { targetBalance: 75000, requirements: ['Advanced strategy mastery', 'Section 9B competency'] },
        4: { targetBalance: 100000, requirements: ['Professional deployment', 'Full system mastery'] }
    };
    
    return transitions[currentPhase] || null;
}

/**
 * Calculate progress within current phase
 */
function calculatePhaseProgress(balance, currentPhase) {
    const phaseInfo = determinePhase(balance);
    const transitions = getPhaseTransitionRequirements(currentPhase);
    
    if (!transitions) {
        return { progress: 1.0, complete: true };
    }
    
    const phaseRanges = {
        0: { min: 0, max: 35000 },
        1: { min: 35000, max: 40000 },
        2: { min: 40000, max: 60000 },
        3: { min: 60000, max: 75000 },
        4: { min: 75000, max: 100000 }
    };
    
    const range = phaseRanges[currentPhase];
    if (!range) return { progress: 1.0, complete: true };
    
    const progress = Math.min(1.0, (balance - range.min) / (range.max - range.min));
    
    return {
        progress: Math.max(0, progress),
        complete: progress >= 1.0,
        remainingAmount: Math.max(0, range.max - balance),
        targetBalance: range.max
    };
}

/**
 * Get available strategies for phase
 */
function getPhaseStrategies(phase) {
    const phaseInfo = typeof phase === 'number' ? determinePhase(getPhaseBalance(phase)) : determinePhase(phase);
    return phaseInfo.strategies;
}

/**
 * Helper to get minimum balance for phase
 */
function getPhaseBalance(phase) {
    const balances = [0, 35000, 40000, 60000, 75000];
    return balances[phase] || 100000;
}

/**
 * Validate if strategy is allowed for current phase
 */
function isStrategyAllowedForPhase(strategy, balance) {
    const phaseInfo = determinePhase(balance);
    const allowedStrategies = phaseInfo.strategies;
    
    // Check for broad strategy categories
    if (allowedStrategies.includes('ALL_STRATEGIES')) return true;
    if (allowedStrategies.includes('ALL_PHASE_2') && phase <= 2) return true;
    if (allowedStrategies.includes('ALL_PHASE_1') && phase <= 1) return true;
    
    return allowedStrategies.includes(strategy);
}

/**
 * Get phase-appropriate position sizing
 */
function getPhasePositionSizing(balance, baseSize = 1) {
    const phaseInfo = determinePhase(balance);
    const phaseMultipliers = {
        0: 0.5,  // Very conservative
        1: 0.8,  // Conservative  
        2: 1.0,  // Normal
        3: 1.2,  // Moderate increase
        4: 1.5   // Full deployment
    };
    
    const multiplier = phaseMultipliers[phaseInfo.phase] || 1.0;
    return Math.floor(baseSize * multiplier);
}

module.exports = {
    determinePhase,
    getPhaseTransitionRequirements,
    calculatePhaseProgress,
    getPhaseStrategies,
    getPhaseBalance,
    isStrategyAllowedForPhase,
    getPhasePositionSizing
};