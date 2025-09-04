"""
VIX-Based Position Sizing Logic for QuantConnect LEAN
Implements Tom King's systematic position sizing approach with VIX regime detection
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum

class VIXRegime(Enum):
    """VIX volatility regimes based on Tom King methodology"""
    VERY_LOW = "VERY_LOW"      # VIX < 15: 45% BP
    LOW = "LOW"                # VIX 15-20: 52% BP  
    NORMAL = "NORMAL"          # VIX 20-25: 65% BP
    HIGH = "HIGH"              # VIX 25-35: 75% BP
    EXTREME = "EXTREME"        # VIX > 35: 80% BP

class AccountPhase(Enum):
    """Account size phases with different position limits"""
    PHASE_1 = 1  # £30-40k: 3 positions max
    PHASE_2 = 2  # £40-60k: 8 positions max
    PHASE_3 = 3  # £60-75k: 12 positions max
    PHASE_4 = 4  # £75k+: 20 positions max

class PositionSizer:
    """
    VIX-based position sizing manager implementing Tom King methodology
    
    Key Features:
    - VIX regime detection with automatic BP adjustment
    - Account phase-based position limits
    - Kelly Criterion modified for options trading
    - August 2024 crash protection measures
    - Dynamic position sizing based on market conditions
    """
    
    def __init__(self):
        # VIX regime thresholds and BP limits
        self.vix_regimes = {
            VIXRegime.VERY_LOW: {'threshold': (0, 15), 'bp_limit': 0.45},
            VIXRegime.LOW: {'threshold': (15, 20), 'bp_limit': 0.52},
            VIXRegime.NORMAL: {'threshold': (20, 25), 'bp_limit': 0.65},
            VIXRegime.HIGH: {'threshold': (25, 35), 'bp_limit': 0.75},
            VIXRegime.EXTREME: {'threshold': (35, 100), 'bp_limit': 0.80}
        }
        
        # Phase-based position limits
        self.phase_limits = {
            AccountPhase.PHASE_1: {
                'account_range': (30000, 40000),
                'max_positions': 3,
                'base_bp_limit': 0.40,
                'max_bp_limit': 0.50,
                'position_types': ['0DTE', 'STRANGLE', 'IPMCC']
            },
            AccountPhase.PHASE_2: {
                'account_range': (40000, 60000),
                'max_positions': 8,
                'base_bp_limit': 0.55,
                'max_bp_limit': 0.65,
                'position_types': ['0DTE', 'STRANGLE', 'IPMCC', 'LT112', 'LEAP_PUTS']
            },
            AccountPhase.PHASE_3: {
                'account_range': (60000, 75000),
                'max_positions': 12,
                'base_bp_limit': 0.65,
                'max_bp_limit': 0.75,
                'position_types': ['ALL', 'BUTTERFLIES', 'RATIO_SPREADS']
            },
            AccountPhase.PHASE_4: {
                'account_range': (75000, float('inf')),
                'max_positions': 20,
                'base_bp_limit': 0.75,
                'max_bp_limit': 0.85,
                'position_types': ['ALL', 'PROFESSIONAL_STRATEGIES']
            }
        }
        
        # Strategy-specific BP requirements (percentage of account)
        self.strategy_bp_requirements = {
            '0DTE': {'micro': 0.02, 'full': 0.02},
            'STRANGLE': {'micro': 0.025, 'full': 0.035},
            'LT112': {'micro': 0.03, 'full': 0.06},
            'IPMCC': {'micro': 0.08, 'full': 0.08},
            'BUTTERFLY': {'micro': 0.005, 'full': 0.005},
            'RATIO_SPREAD': {'micro': 0.02, 'full': 0.02},
            'DIAGONAL': {'micro': 0.015, 'full': 0.015},
            'LEAP_PUTS': {'micro': 0.02, 'full': 0.02},
            'BOX_SPREAD': {'micro': 0.0, 'full': 0.0}
        }
    
    def get_vix_regime(self, vix_level: float) -> VIXRegime:
        """Determine current VIX regime based on level"""
        for regime, config in self.vix_regimes.items():
            min_threshold, max_threshold = config['threshold']
            if min_threshold <= vix_level < max_threshold:
                return regime
        return VIXRegime.EXTREME if vix_level >= 35 else VIXRegime.VERY_LOW
    
    def get_account_phase(self, account_value: float) -> AccountPhase:
        """Determine account phase based on value"""
        for phase, config in self.phase_limits.items():
            min_val, max_val = config['account_range']
            if min_val <= account_value < max_val:
                return phase
        return AccountPhase.PHASE_4 if account_value >= 75000 else AccountPhase.PHASE_1
    
    def calculate_max_bp_usage(self, vix_level: float, account_value: float, 
                              current_positions: int = 0) -> Dict:
        """
        Calculate maximum buying power usage based on VIX and account phase
        
        Args:
            vix_level: Current VIX level
            account_value: Account value in GBP
            current_positions: Number of current positions
            
        Returns:
            Dictionary with BP limits and regime analysis
        """
        vix_regime = self.get_vix_regime(vix_level)
        account_phase = self.get_account_phase(account_value)
        
        vix_bp_limit = self.vix_regimes[vix_regime]['bp_limit']
        phase_config = self.phase_limits[account_phase]
        
        # Calculate effective BP limit (minimum of VIX and phase limits)
        effective_bp_limit = min(vix_bp_limit, phase_config['max_bp_limit'])
        base_bp_limit = phase_config['base_bp_limit']
        
        # Emergency adjustments for extreme VIX
        if vix_regime == VIXRegime.EXTREME:
            # Deploy aggressively during generational opportunities
            effective_bp_limit = min(0.85, effective_bp_limit + 0.10)
            deployment_strategy = "AGGRESSIVE_DEPLOYMENT"
        elif vix_regime == VIXRegime.HIGH:
            # Moderate increase for high volatility
            effective_bp_limit = min(phase_config['max_bp_limit'], effective_bp_limit + 0.05)
            deployment_strategy = "ENHANCED_DEPLOYMENT"
        else:
            deployment_strategy = "NORMAL_DEPLOYMENT"
        
        return {
            'vix_regime': vix_regime.value,
            'account_phase': account_phase.value,
            'vix_level': vix_level,
            'account_value': account_value,
            'max_bp_usage': effective_bp_limit,
            'base_bp_usage': base_bp_limit,
            'max_positions': phase_config['max_positions'],
            'current_positions': current_positions,
            'available_positions': phase_config['max_positions'] - current_positions,
            'deployment_strategy': deployment_strategy,
            'regime_analysis': {
                'vix_threshold': self.vix_regimes[vix_regime]['threshold'],
                'bp_multiplier': vix_bp_limit / 0.45,  # Relative to base regime
                'risk_level': self._get_risk_level(vix_regime),
                'expected_duration': self._get_expected_regime_duration(vix_regime)
            }
        }
    
    def calculate_position_size(self, strategy: str, account_value: float, 
                              vix_level: float, win_rate: float = 0.75,
                              avg_return: float = 0.50, max_loss: float = -2.0,
                              use_micro: bool = True) -> Dict:
        """
        Calculate optimal position size using modified Kelly Criterion
        
        Args:
            strategy: Strategy name (e.g., '0DTE', 'STRANGLE')
            account_value: Account value in GBP
            vix_level: Current VIX level
            win_rate: Historical win rate (default 75%)
            avg_return: Average return per winner (default 50%)
            max_loss: Maximum loss per trade (default -200%)
            use_micro: Use micro contracts if available
            
        Returns:
            Position sizing recommendations
        """
        # Get strategy BP requirements
        strategy_key = strategy.upper()
        if strategy_key not in self.strategy_bp_requirements:
            strategy_key = '0DTE'  # Default fallback
            
        contract_type = 'micro' if use_micro else 'full'
        strategy_bp_req = self.strategy_bp_requirements[strategy_key][contract_type]
        
        # Calculate Kelly fraction
        kelly_fraction = self._calculate_kelly_fraction(win_rate, avg_return, max_loss)
        
        # Get maximum BP usage
        bp_analysis = self.calculate_max_bp_usage(vix_level, account_value)
        max_bp_available = account_value * bp_analysis['max_bp_usage']
        
        # Calculate position sizes
        max_positions_by_bp = int(max_bp_available / (account_value * strategy_bp_req))
        max_positions_by_phase = bp_analysis['available_positions']
        
        # Kelly-adjusted position size
        kelly_position_size = int(kelly_fraction * account_value / (account_value * strategy_bp_req))
        
        # Final position size (minimum of all constraints)
        recommended_positions = min(
            max_positions_by_bp,
            max_positions_by_phase,
            kelly_position_size,
            5  # Hard limit for risk management
        )
        
        # Calculate actual BP usage
        actual_bp_usage = (recommended_positions * strategy_bp_req * account_value) / account_value
        actual_bp_percentage = actual_bp_usage
        
        return {
            'strategy': strategy,
            'recommended_positions': max(1, recommended_positions),
            'max_positions_bp': max_positions_by_bp,
            'max_positions_phase': max_positions_by_phase,
            'kelly_positions': kelly_position_size,
            'bp_per_position': strategy_bp_req,
            'total_bp_usage': actual_bp_percentage,
            'total_bp_amount': actual_bp_percentage * account_value,
            'kelly_fraction': kelly_fraction,
            'vix_regime': bp_analysis['vix_regime'],
            'account_phase': bp_analysis['account_phase'],
            'risk_metrics': {
                'max_single_loss': strategy_bp_req * account_value * max_loss,
                'expected_return': strategy_bp_req * account_value * avg_return * win_rate,
                'risk_reward_ratio': abs(avg_return / max_loss),
                'position_risk': strategy_bp_req * 100  # Percentage of account
            }
        }
    
    def get_emergency_sizing(self, vix_level: float, account_value: float,
                           current_bp_usage: float) -> Dict:
        """
        Emergency position sizing during market stress events
        Based on August 5, 2024 lessons learned
        
        Args:
            vix_level: Current VIX level
            account_value: Account value in GBP
            current_bp_usage: Current BP usage percentage
            
        Returns:
            Emergency sizing recommendations
        """
        vix_regime = self.get_vix_regime(vix_level)
        
        if vix_regime == VIXRegime.EXTREME and current_bp_usage < 0.30:
            # Generational opportunity - deploy aggressively
            return {
                'action': 'DEPLOY_AGGRESSIVELY',
                'target_bp_usage': min(0.85, current_bp_usage + 0.30),
                'max_new_positions': 3,
                'preferred_strategies': ['STRANGLE', '0DTE', 'BUTTERFLY'],
                'timeframe': '1-3 days maximum',
                'expected_return': '15-25% monthly during normalization',
                'risk_warning': 'High risk/high reward - only for experienced traders'
            }
        elif vix_regime == VIXRegime.HIGH:
            # Elevated volatility - selective deployment
            return {
                'action': 'SELECTIVE_DEPLOYMENT',
                'target_bp_usage': min(0.70, current_bp_usage + 0.15),
                'max_new_positions': 2,
                'preferred_strategies': ['STRANGLE', 'BUTTERFLY'],
                'timeframe': '1 week',
                'expected_return': '8-12% monthly',
                'risk_warning': 'Moderate increase in deployment'
            }
        elif current_bp_usage > 0.75:
            # Already high BP usage - reduce exposure
            return {
                'action': 'REDUCE_EXPOSURE',
                'target_bp_usage': 0.60,
                'max_new_positions': 0,
                'preferred_strategies': [],
                'timeframe': 'Immediate',
                'expected_return': 'Capital preservation focus',
                'risk_warning': 'High BP usage - reduce positions'
            }
        else:
            # Normal conditions
            return {
                'action': 'MAINTAIN_CURRENT',
                'target_bp_usage': current_bp_usage,
                'max_new_positions': 1,
                'preferred_strategies': ['0DTE', 'STRANGLE', 'LT112'],
                'timeframe': 'Standard schedule',
                'expected_return': '6-8% monthly',
                'risk_warning': 'Normal market conditions'
            }
    
    def _calculate_kelly_fraction(self, win_rate: float, avg_return: float, 
                                max_loss: float) -> float:
        """Calculate Kelly fraction for optimal position sizing"""
        if max_loss >= 0:
            return 0.1  # Conservative fallback
        
        # Modified Kelly for options: f = (bp - q) / b
        # Where b = avg_return/|max_loss|, p = win_rate, q = 1 - win_rate
        b = avg_return / abs(max_loss)
        p = win_rate
        q = 1 - win_rate
        
        kelly = (b * p - q) / b
        
        # Conservative adjustment (use 25% of Kelly for safety)
        return max(0.05, min(0.25, kelly * 0.25))
    
    def _get_risk_level(self, vix_regime: VIXRegime) -> str:
        """Get risk level description for VIX regime"""
        risk_levels = {
            VIXRegime.VERY_LOW: "LOW",
            VIXRegime.LOW: "LOW_MODERATE", 
            VIXRegime.NORMAL: "MODERATE",
            VIXRegime.HIGH: "HIGH",
            VIXRegime.EXTREME: "EXTREME"
        }
        return risk_levels[vix_regime]
    
    def _get_expected_regime_duration(self, vix_regime: VIXRegime) -> str:
        """Get expected duration for VIX regime"""
        durations = {
            VIXRegime.VERY_LOW: "2-6 months",
            VIXRegime.LOW: "1-4 months",
            VIXRegime.NORMAL: "2-8 weeks", 
            VIXRegime.HIGH: "1-4 weeks",
            VIXRegime.EXTREME: "1-7 days"
        }
        return durations[vix_regime]
    
    def get_sizing_recommendations(self, account_value: float, vix_level: float,
                                 available_strategies: List[str]) -> Dict:
        """
        Get comprehensive position sizing recommendations
        
        Args:
            account_value: Account value in GBP
            vix_level: Current VIX level
            available_strategies: List of available strategies
            
        Returns:
            Complete sizing analysis and recommendations
        """
        bp_analysis = self.calculate_max_bp_usage(vix_level, account_value)
        
        recommendations = {}
        total_recommended_bp = 0.0
        
        for strategy in available_strategies:
            sizing = self.calculate_position_size(strategy, account_value, vix_level)
            recommendations[strategy] = sizing
            total_recommended_bp += sizing['total_bp_usage']
        
        return {
            'account_analysis': bp_analysis,
            'strategy_sizing': recommendations,
            'portfolio_summary': {
                'total_recommended_bp': total_recommended_bp,
                'remaining_bp_capacity': bp_analysis['max_bp_usage'] - total_recommended_bp,
                'risk_utilization': total_recommended_bp / bp_analysis['max_bp_usage'],
                'position_diversification': len([s for s in recommendations.values() 
                                               if s['recommended_positions'] > 0])
            },
            'market_context': {
                'vix_regime': bp_analysis['vix_regime'],
                'deployment_strategy': bp_analysis['deployment_strategy'],
                'risk_environment': self._get_risk_level(self.get_vix_regime(vix_level))
            }
        }