# region imports
from AlgorithmImports import *
# endregion
"""
VIX-Based Position Sizing Logic for QuantConnect LEAN
Implements Tom King's systematic position sizing approach with VIX regime detection
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from enum import Enum

class VIXRegime(Enum):
    """VIX volatility regimes based on Tom King methodology - 6 regimes"""
    EXTREMELY_LOW = "EXTREMELY_LOW"  # VIX < 12: 30-45% BP, Premium scarce
    LOW = "LOW"                      # VIX 12-16: 50-65% BP, No warning
    NORMAL = "NORMAL"                # VIX 16-20: 55-75% BP, No warning
    ELEVATED = "ELEVATED"            # VIX 20-25: 40-60% BP, Increased risk
    HIGH = "HIGH"                    # VIX 25-35: 25-40% BP, High volatility regime
    EXTREME = "EXTREME"              # VIX 35+: 10-25% BP, Crisis mode - minimal exposure

class AccountPhase(Enum):
    """Account size phases with different position limits"""
    PHASE_1 = 1  # $38-51k: 3 positions max
    PHASE_2 = 2  # $51-76k: 8 positions max
    PHASE_3 = 3  # $76-95k: 12 positions max
    PHASE_4 = 4  # $95k+: 20 positions max

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
        # VIX regime thresholds and BP limits - Exact Tom King specifications
        self.vix_regimes = {
            VIXRegime.EXTREMELY_LOW: {
                'threshold': (0, 12), 
                'bp_limit_min': 0.30, 
                'bp_limit_max': 0.45,
                'warning': "Premium scarce",
                'description': "Extremely low volatility - premium collection challenging"
            },
            VIXRegime.LOW: {
                'threshold': (12, 16), 
                'bp_limit_min': 0.50, 
                'bp_limit_max': 0.65,
                'warning': None,
                'description': "Low volatility - normal deployment"
            },
            VIXRegime.NORMAL: {
                'threshold': (16, 20), 
                'bp_limit_min': 0.55, 
                'bp_limit_max': 0.75,
                'warning': None,
                'description': "Normal volatility - optimal conditions"
            },
            VIXRegime.ELEVATED: {
                'threshold': (20, 25), 
                'bp_limit_min': 0.40, 
                'bp_limit_max': 0.60,
                'warning': "Increased risk",
                'description': "Elevated volatility - caution required"
            },
            VIXRegime.HIGH: {
                'threshold': (25, 35), 
                'bp_limit_min': 0.25, 
                'bp_limit_max': 0.40,
                'warning': "High volatility regime",
                'description': "High volatility - defensive positioning"
            },
            VIXRegime.EXTREME: {
                'threshold': (35, 100), 
                'bp_limit_min': 0.10, 
                'bp_limit_max': 0.25,
                'warning': "Crisis mode - minimal exposure",
                'description': "Extreme volatility - VIX spike opportunity",
                'spike_opportunity': True,
                'max_deployment': 19000,  # $19k max
                'max_deployment_pct': 0.20,  # 20% of account
                'expected_return_monthly': 0.15  # 15-25% expected
            }
        }
        
        # Phase-based position limits
        self.phase_limits = {
            AccountPhase.PHASE_1: {
                'account_range': (38100, 50800),  # USD converted from GBP
                'max_positions': 3,
                'base_bp_limit': 0.40,
                'max_bp_limit': 0.50,
                'position_types': ['0DTE', 'STRANGLE', 'IPMCC']
            },
            AccountPhase.PHASE_2: {
                'account_range': (50800, 76200),  # USD converted from GBP
                'max_positions': 8,
                'base_bp_limit': 0.55,
                'max_bp_limit': 0.65,
                'position_types': ['0DTE', 'STRANGLE', 'IPMCC', 'LT112', 'LEAP_PUTS']
            },
            AccountPhase.PHASE_3: {
                'account_range': (76200, 95250),  # USD converted from GBP
                'max_positions': 12,
                'base_bp_limit': 0.65,
                'max_bp_limit': 0.75,
                'position_types': ['ALL', 'BUTTERFLIES', 'RATIO_SPREADS']
            },
            AccountPhase.PHASE_4: {
                'account_range': (95250, float('inf')),  # USD converted from GBP
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
        """Determine current VIX regime based on level - Tom King 6-regime system"""
        for regime, config in self.vix_regimes.items():
            min_threshold, max_threshold = config['threshold']
            if min_threshold <= vix_level < max_threshold:
                return regime
        # Fallback for edge cases
        return VIXRegime.EXTREME if vix_level >= 35 else VIXRegime.EXTREMELY_LOW
    
    def get_account_phase(self, account_value: float) -> AccountPhase:
        """Determine account phase based on value"""
        for phase, config in self.phase_limits.items():
            min_val, max_val = config['account_range']
            if min_val <= account_value < max_val:
                return phase
        return AccountPhase.PHASE_4 if account_value >= 95250 else AccountPhase.PHASE_1
    
    def calculate_max_bp_usage(self, vix_level: float, account_value: float, 
                              current_positions: int = 0) -> Dict:
        """
        Calculate maximum buying power usage based on VIX and account phase
        Tom King 6-regime system with VIX spike opportunity detection
        
        Args:
            vix_level: Current VIX level
            account_value: Account value in USD
            current_positions: Number of current positions
            
        Returns:
            Dictionary with BP limits and regime analysis
        """
        vix_regime = self.get_vix_regime(vix_level)
        account_phase = self.get_account_phase(account_value)
        
        vix_config = self.vix_regimes[vix_regime]
        phase_config = self.phase_limits[account_phase]
        
        # Get VIX regime BP limits (min and max)
        vix_bp_min = vix_config['bp_limit_min']
        vix_bp_max = vix_config['bp_limit_max']
        
        # Calculate effective BP limit based on regime and phase
        # Use max VIX limit for normal conditions, but respect phase limits
        effective_bp_limit = min(vix_bp_max, phase_config['max_bp_limit'])
        conservative_bp_limit = min(vix_bp_min, phase_config['base_bp_limit'])
        
        # VIX spike opportunity detection (VIX ≥ 35)
        is_vix_spike = vix_level >= 35
        vix_spike_deployment = 0
        
        if is_vix_spike and vix_regime == VIXRegime.EXTREME:
            # Calculate VIX spike opportunity deployment
            max_spike_usd = min(vix_config['max_deployment'], 
                              account_value * vix_config['max_deployment_pct'])
            vix_spike_deployment = max_spike_usd
            deployment_strategy = "VIX_SPIKE_OPPORTUNITY"
            warning_message = f"[ALERT] GENERATIONAL OPPORTUNITY: VIX Spike Protocol Activated"
        else:
            deployment_strategy = self._get_deployment_strategy(vix_regime)
            warning_message = vix_config.get('warning')
        
        return {
            'vix_regime': vix_regime.value,
            'account_phase': account_phase.value,
            'vix_level': vix_level,
            'account_value': account_value,
            'max_bp_usage': effective_bp_limit,
            'conservative_bp_usage': conservative_bp_limit,
            'base_bp_usage': phase_config['base_bp_limit'],
            'max_positions': phase_config['max_positions'],
            'current_positions': current_positions,
            'available_positions': phase_config['max_positions'] - current_positions,
            'deployment_strategy': deployment_strategy,
            'warning_message': warning_message,
            'vix_spike_opportunity': is_vix_spike,
            'vix_spike_deployment': vix_spike_deployment,
            'expected_monthly_return': vix_config.get('expected_return_monthly', 0.08),
            'regime_analysis': {
                'vix_threshold': vix_config['threshold'],
                'bp_range': (vix_bp_min, vix_bp_max),
                'description': vix_config['description'],
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
            account_value: Account value in USD
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
            account_value: Account value in USD
            current_bp_usage: Current BP usage percentage
            
        Returns:
            Emergency sizing recommendations
        """
        vix_regime = self.get_vix_regime(vix_level)
        
        if vix_regime == VIXRegime.EXTREME and current_bp_usage < 0.35:
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
            self.algo.Debug(f"Invalid max_loss value for Kelly calculation: {max_loss}")
            return 0.05  # Extra conservative when data is invalid
        
        # Modified Kelly for options: f = (bp - q) / b
        # Where b = avg_return/|max_loss|, p = win_rate, q = 1 - win_rate
        
        # Protect against division by zero
        if max_loss == 0:
            self.algorithm.Log("[POSITION SIZING] Warning: max_loss is 0, using conservative Kelly")
            return 0.05
            
        b = avg_return / abs(max_loss)
        p = win_rate
        q = 1 - win_rate
        
        # Protect against division by zero in Kelly calculation
        if b == 0 or abs(b) < 0.0001:  # Near-zero protection
            self.algorithm.Log("[POSITION SIZING] Warning: b is near 0, using conservative Kelly")
            return 0.05
            
        # Simplified Kelly formula to avoid unnecessary division
        # kelly = (b * p - q) / b = p - q/b
        kelly = p - (q / b)
        
        # Conservative adjustment (use 25% of Kelly for safety)
        # Note: Applying single conservative factor, not double reduction
        conservative_kelly = kelly * 0.25
        return max(0.05, min(0.25, conservative_kelly))
    
    def _get_deployment_strategy(self, vix_regime: VIXRegime) -> str:
        """Get deployment strategy for VIX regime"""
        strategies = {
            VIXRegime.EXTREMELY_LOW: "CONSERVATIVE_DEPLOYMENT",
            VIXRegime.LOW: "STANDARD_DEPLOYMENT",
            VIXRegime.NORMAL: "OPTIMAL_DEPLOYMENT", 
            VIXRegime.ELEVATED: "CAUTIOUS_DEPLOYMENT",
            VIXRegime.HIGH: "DEFENSIVE_DEPLOYMENT",
            VIXRegime.EXTREME: "VIX_SPIKE_OPPORTUNITY"
        }
        return strategies.get(vix_regime, "STANDARD_DEPLOYMENT")
    
    def _get_risk_level(self, vix_regime: VIXRegime) -> str:
        """Get risk level description for VIX regime - Tom King 6-regime system"""
        risk_levels = {
            VIXRegime.EXTREMELY_LOW: "VERY_LOW",
            VIXRegime.LOW: "LOW", 
            VIXRegime.NORMAL: "MODERATE",
            VIXRegime.ELEVATED: "ELEVATED",
            VIXRegime.HIGH: "HIGH",
            VIXRegime.EXTREME: "EXTREME"
        }
        return risk_levels.get(vix_regime, "MODERATE")
    
    def _get_expected_regime_duration(self, vix_regime: VIXRegime) -> str:
        """Get expected duration for VIX regime - Tom King analysis"""
        durations = {
            VIXRegime.EXTREMELY_LOW: "3-12 months",
            VIXRegime.LOW: "1-6 months",
            VIXRegime.NORMAL: "2-12 weeks", 
            VIXRegime.ELEVATED: "1-6 weeks",
            VIXRegime.HIGH: "1-3 weeks",
            VIXRegime.EXTREME: "1-14 days"
        }
        return durations.get(vix_regime, "2-8 weeks")
    
    def get_sizing_recommendations(self, account_value: float, vix_level: float,
                                 available_strategies: List[str]) -> Dict:
        """
        Get comprehensive position sizing recommendations
        
        Args:
            account_value: Account value in USD
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


class VIXBasedPositionSizing:
    """
    QuantConnect LEAN wrapper for Tom King VIX-based position sizing
    Provides interface expected by main trading algorithm
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.position_sizer = PositionSizer()
        self.current_vix_level = 16.0  # Default normal VIX
        self.current_regime = None
        self.last_regime_update = None
        
    def UpdateVIXLevel(self, vix_level: float):
        """Update current VIX level and regime"""
        self.current_vix_level = vix_level
        self.current_regime = self.position_sizer.get_vix_regime(vix_level)
        self.last_regime_update = self.algorithm.Time
        
    def GetVIXRegimeInfo(self) -> Dict:
        """Get current VIX regime information for algorithm"""
        if self.current_regime is None:
            return {
                'regime': 'NORMAL',
                'max_bp_usage': 0.65,
                'warning': None
            }
        
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        bp_analysis = self.position_sizer.calculate_max_bp_usage(
            self.current_vix_level, 
            account_value
        )
        
        return {
            'regime': bp_analysis['vix_regime'],
            'max_bp_usage': bp_analysis['max_bp_usage'],
            'conservative_bp_usage': bp_analysis['conservative_bp_usage'],
            'warning': bp_analysis['warning_message'],
            'vix_level': self.current_vix_level,
            'deployment_strategy': bp_analysis['deployment_strategy'],
            'regime_description': bp_analysis['regime_analysis']['description']
        }
    
    def IsVIXSpikeOpportunity(self) -> bool:
        """Check if current conditions represent a VIX spike opportunity"""
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        bp_analysis = self.position_sizer.calculate_max_bp_usage(
            self.current_vix_level, 
            account_value
        )
        return bp_analysis['vix_spike_opportunity']
    
    def GetVIXSpikeParameters(self) -> Dict:
        """Get VIX spike deployment parameters"""
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        bp_analysis = self.position_sizer.calculate_max_bp_usage(
            self.current_vix_level, 
            account_value
        )
        
        return {
            'max_deployment': bp_analysis['vix_spike_deployment'],
            'expected_return': bp_analysis['expected_monthly_return'],
            'deployment_strategy': bp_analysis['deployment_strategy'],
            'warning_message': bp_analysis['warning_message']
        }
    
    def CalculatePositionSize(self, strategy: str, win_rate: float = 0.75) -> Dict:
        """Calculate position size for a specific strategy"""
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        return self.position_sizer.calculate_position_size(
            strategy=strategy,
            account_value=account_value,
            vix_level=self.current_vix_level,
            win_rate=win_rate
        )
    
    def GetComprehensiveAnalysis(self) -> Dict:
        """Get comprehensive position sizing analysis for algorithm"""
        account_value = self.algorithm.Portfolio.TotalPortfolioValue
        current_positions = len([p for p in self.algorithm.Portfolio.Values if p.Invested])
        
        # Get current analysis
        bp_analysis = self.position_sizer.calculate_max_bp_usage(
            self.current_vix_level, 
            account_value,
            current_positions
        )
        
        # Add algorithm-specific context
        bp_analysis['algorithm_context'] = {
            'current_time': self.algorithm.Time,
            'algorithm_name': 'TomKingTradingAlgorithm',
            'account_currency': 'USD',
            'target_goal': '$102,000',
            'last_regime_update': self.last_regime_update
        }
        
        return bp_analysis