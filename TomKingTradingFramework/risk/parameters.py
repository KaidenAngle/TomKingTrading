# region imports
from AlgorithmImports import *
from config.constants import TradingConstants
# endregion
"""
Risk Parameters and Thresholds for QuantConnect LEAN
Centralized risk parameter management implementing Tom King methodology
All risk limits, thresholds, and configuration in one place
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
from enum import Enum
import json
from core.unified_vix_manager import UnifiedVIXManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class RiskProfile(Enum):
    """Risk profile levels for different account phases"""
    CONSERVATIVE = "CONSERVATIVE"    # Phase 1: Learning and building
    MODERATE = "MODERATE"           # Phase 2: Scaling up
    AGGRESSIVE = "AGGRESSIVE"       # Phase 3: Optimization
    PROFESSIONAL = "PROFESSIONAL"   # Phase 4: Full deployment

class RiskParameters:
    """
    Centralized risk parameters and thresholds for Tom King trading system
    
    All risk management parameters are defined here and can be easily adjusted
    Parameters are organized by category and account phase
    """
    
    def __init__(self):
        # Initialize all risk parameters
        self._initialize_position_sizing_parameters()
        self._initialize_correlation_parameters()
        self._initialize_defensive_parameters()
        self._initialize_vix_regime_parameters()
        self._initialize_strategy_parameters()
        self._initialize_phase_parameters()
        self._initialize_emergency_parameters()
        self._initialize_august_2024_parameters()
        
    def _initialize_position_sizing_parameters(self):
        """Initialize position sizing parameters"""
        self.position_sizing = {
            # Kelly Criterion parameters
            'kelly': {
                'max_fraction': TradingConstants.KELLY_FACTOR,           # Maximum 25% of Kelly
                'min_fraction': 0.05,           # Minimum 5% of Kelly
                'safety_factor': TradingConstants.KELLY_FACTOR,          # Use 25% of calculated Kelly
                'default_win_rate': 0.75,       # Default win rate assumption
                'default_avg_return': 0.50,     # Default average return
                'default_max_loss': -2.00,      # Default max loss (200% of credit)
            },
            
            # Account value-based limits
            'account_limits': {
                'max_single_position_percent': 0.20,    # Max 20% in single position
                'max_strategy_percent': 0.40,           # Max 40% in single strategy
                'max_correlation_group_percent': 0.30,  # Max 30% in correlation group
                'emergency_reduction_factor': 0.50,     # Reduce by 50% in emergency
            },
            
            # VIX-based BP limits (core Tom King methodology)
            'vix_bp_limits': {
                'very_low': {'vix_max': 15, 'bp_limit': 0.45},    # VIX < 15: 45% BP
                'low': {'vix_max': 20, 'bp_limit': 0.52},         # VIX 15-20: 52% BP
                'normal': {'vix_max': 25, 'bp_limit': 0.65},      # VIX 20-25: 65% BP
                'high': {'vix_max': 35, 'bp_limit': 0.75},        # VIX 25-35: 75% BP
                'extreme': {'vix_max': TradingConstants.FULL_PERCENTAGE, 'bp_limit': 0.80},    # VIX > 35: 80% BP
            },
            
            # Strategy-specific BP requirements (percentage of account)
            # NOTE: max_positions are now dynamically calculated based on account phase
            'strategy_bp_requirements': {
                '0DTE': {'micro': 0.02, 'full': 0.02, 'base_max_positions': 2},
                'STRANGLE': {'micro': 0.025, 'full': 0.035, 'base_max_positions': 3},
                'LT112': {'micro': 0.03, 'full': 0.06, 'base_max_positions': 2},
                'IPMCC': {'micro': 0.08, 'full': 0.08, 'base_max_positions': 1},
                'RATIO_SPREAD': {'micro': 0.02, 'full': 0.02, 'base_max_positions': 2},
                'DIAGONAL': {'micro': 0.015, 'full': 0.015, 'base_max_positions': 2},
                'LEAP_PUTS': {'micro': 0.02, 'full': 0.02, 'base_max_positions': 3},
                'BOX_SPREAD': {'micro': 0.0, 'full': 0.0, 'base_max_positions': 2},
            },
            
            # Dynamic position scaling by phase (Tom King methodology)
            'phase_position_multipliers': {
                1: 1.0,    # Phase 1: Use base positions (conservative)
                2: 1.5,    # Phase 2: 50% more positions (growth)
                3: 2.0,    # Phase 3: Double positions (optimization)
                4: 2.5,    # Phase 4: 2.5x positions (professional)
            }
        }
    
    def _initialize_correlation_parameters(self):
        """Initialize correlation parameters"""
        self.correlation = {
            # Phase-based correlation group limits (Tom King's key lesson)
            'phase_group_limits': {
                1: 1,  # Phase 1: Max 1 position per correlation group
                2: 2,  # Phase 2: Max 2 positions per correlation group
                3: 2,  # Phase 3: Max 2 positions per correlation group (Tom's mistake was ignoring this)
                4: 3   # Phase 4: Max 3 positions per correlation group
            },
            
            # Correlation coefficient thresholds
            'correlation_thresholds': {
                'low_correlation': 0.30,        # Below 30% = independent
                'moderate_correlation': 0.60,   # 30-60% = moderate correlation
                'high_correlation': 0.80,       # 60-80% = high correlation
                'extreme_correlation': 0.90,    # Above 80% = dangerous correlation
            },
            
            # Portfolio concentration limits
            'concentration_limits': {
                'max_single_group_percent': 0.40,       # Max 40% in single correlation group
                'max_correlated_positions': 0.60,       # Max 60% in correlated positions
                'diversification_target': 0.80,         # Target 80% diversification score
                'emergency_concentration_limit': 0.30,   # Emergency limit 30%
            },
            
            # VIX-based correlation adjustments
            'vix_correlation_adjustments': {
                'low_vix': {'multiplier': 1.0},         # VIX < 20: Normal limits
                'normal_vix': {'multiplier': 0.8},      # VIX 20-25: 20% tighter
                'high_vix': {'multiplier': 0.6},        # VIX 25-35: 40% tighter  
                'extreme_vix': {'multiplier': 0.4},     # VIX > 35: 60% tighter
            },
            
            # August 2024 disaster prevention
            'august_2024_protection': {
                'max_equity_concentration': 0.60,       # Max 60% equity exposure (Tom had TradingConstants.FULL_PERCENTAGE%)
                'correlation_spike_threshold': 0.85,    # Alert at 85% correlation
                'emergency_diversification_target': 5,   # Min 5 correlation groups
                'tom_king_pattern_threshold': 0.75,     # Alert if > 75% single group
            }
        }
    
    def _initialize_defensive_parameters(self):
        """Initialize defensive management parameters"""
        self.defensive = {
            # Time-based management rules
            'time_management': {
                'dte_management_threshold': TradingConstants.DEFENSIVE_EXIT_DTE,          # Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE rule (non-negotiable)
                'emergency_dte_threshold': 7,            # Emergency management at 7 DTE
                'expiration_day_close_time': {'hour': 15, 'minute': 0},  # 3 PM close
                'friday_0dte_exit_time': {'hour': 15, 'minute': 0},      # Friday 3 PM 0DTE exit
                'weekend_risk_threshold': 3,             # Close if expiring within 3 days of weekend
            },
            
            # Profit and loss management
            'pnl_management': {
                'default_profit_target': TradingConstants.FRIDAY_0DTE_PROFIT_TARGET,           # 50% profit target
                'strategy_profit_targets': {
                    '0DTE': TradingConstants.FRIDAY_0DTE_PROFIT_TARGET,                        # 50% of credit
                    'STRANGLE': TradingConstants.FUTURES_STRANGLE_PROFIT_TARGET,                    # 50% of credit  
                    'LT112': 0.90,                       # 90% of credit on naked puts
                    'IPMCC': 0.50,                       # 50% on short calls
                    'RATIO_SPREAD': 0.60,                # 60% of credit
                },
                'default_stop_loss': -2.00,              # 200% of credit
                'strategy_stop_losses': {
                    '0DTE': -2.00,                       # 200% of credit
                    'STRANGLE': -2.00,                   # 200% of credit
                    'LT112': -3.00,                      # 300% of debit
                    'IPMCC': -0.30,                      # 30% loss on LEAP
                    'RATIO_SPREAD': -2.50,               # 250% of credit
                },
            },
            
            # Delta and Greeks management
            'greeks_management': {
                'delta_breach_threshold': 0.30,          # Manage when |delta| > 30
                'gamma_risk_threshold': 50,              # High gamma risk level
                'theta_collection_target': 25,           # Daily theta collection target
                'vega_exposure_limit': 500,              # Maximum vega exposure
                'portfolio_delta_target': 0.10,          # Target portfolio delta ±10
            },
            
            # VIX-based defensive adjustments
            'vix_defensive_triggers': {
                'normal_vix_threshold': 20,              # Normal defensive protocols
                'elevated_vix_threshold': 25,            # Enhanced defensive protocols
                'high_vix_threshold': 30,                # High alert defensive protocols
                'extreme_vix_threshold': 35,             # Emergency defensive protocols
                'crisis_vix_threshold': 40,              # Crisis management protocols
            },
            
            # Emergency exit criteria
            'emergency_exits': {
                'portfolio_loss_threshold': -0.15,       # 15% portfolio loss
                'daily_loss_threshold': -0.05,           # 5% daily loss
                'single_position_loss_threshold': -0.10, # 10% single position loss
                'correlation_disaster_threshold': 0.85,  # 85% correlation spike
                'liquidity_crisis_spread_threshold': 0.50, # 50% bid/ask spread
            }
        }
    
    def _initialize_vix_regime_parameters(self):
        """Initialize VIX regime detection parameters"""
        self.vix_regimes = {
            # VIX level definitions
            'regime_definitions': {
                'VERY_LOW': {'min': 0, 'max': 15, 'description': 'Complacency regime'},
                'LOW': {'min': 15, 'max': 20, 'description': 'Normal low volatility'},
                'NORMAL': {'min': 20, 'max': 25, 'description': 'Normal volatility'},
                'HIGH': {'min': 25, 'max': 35, 'description': 'Elevated volatility'},
                'EXTREME': {'min': 35, 'max': 100, 'description': 'Crisis volatility'},
            },
            
            # Regime-specific position sizing
            'regime_position_sizing': {
                'VERY_LOW': {'bp_multiplier': 0.90, 'position_multiplier': 1.0},
                'LOW': {'bp_multiplier': 1.00, 'position_multiplier': 1.0},
                'NORMAL': {'bp_multiplier': 1.10, 'position_multiplier': 1.1},
                'HIGH': {'bp_multiplier': 1.20, 'position_multiplier': 1.2},
                'EXTREME': {'bp_multiplier': 1.30, 'position_multiplier': 0.8},  # More BP, fewer positions
            },
            
            # Regime transition monitoring
            'regime_transitions': {
                'spike_threshold': 5,                    # VIX increase of 5 points = spike
                'crash_threshold': 10,                   # VIX increase of 10 points = crash
                'normalization_threshold': -3,           # VIX decrease of 3 points = normalizing
                'monitoring_period_days': 5,             # Monitor regime over 5 days
            },
            
            # Expected regime durations (for planning)
            'expected_durations': {
                'VERY_LOW': {'days': 90, 'description': '2-6 months'},
                'LOW': {'days': 60, 'description': '1-4 months'},
                'NORMAL': {'days': 30, 'description': '2-8 weeks'},
                'HIGH': {'days': 14, 'description': '1-4 weeks'},
                'EXTREME': {'days': 3, 'description': '1-7 days'},
            }
        }
    
    def _initialize_strategy_parameters(self):
        """Initialize strategy-specific parameters"""
        self.strategies = {
            # Strategy-specific win rates and expectations
            'performance_expectations': {
                '0DTE': {
                    'target_win_rate': 0.88,             # 88% win rate (Tom's track record)
                    'avg_return': 0.50,                  # 50% of credit
                    'max_loss': -2.00,                   # 200% of credit
                    'monthly_trades': 20,                # ~4 per week
                    'expected_monthly_return': 0.08,     # 8% monthly
                },
                'STRANGLE': {
                    'target_win_rate': 0.72,             # 72% win rate
                    'avg_return': 0.50,                  # 50% of credit
                    'max_loss': -2.00,                   # 200% of credit
                    'monthly_trades': 4,                 # Monthly entries
                    'expected_monthly_return': 0.06,     # 6% monthly
                },
                'LT112': {
                    'target_win_rate': 0.73,             # 73% win rate
                    'avg_return': 0.90,                  # 90% of credit
                    'max_loss': -3.00,                   # 300% of debit
                    'monthly_trades': 4,                 # Weekly entries
                    'expected_monthly_return': 0.12,     # 12% monthly
                },
                'IPMCC': {
                    'target_win_rate': 0.83,             # 83% win rate
                    'avg_return': 0.30,                  # 30% annual on LEAP
                    'max_loss': -0.30,                   # 30% loss on LEAP
                    'monthly_trades': 52,                # Weekly rolls
                    'expected_monthly_return': 0.08,     # 8% monthly
                },
            },
            
            # Strategy allocation by phase
            'phase_allocations': {
                1: ['0DTE', 'STRANGLE', 'IPMCC'],                           # Phase 1: Foundation
                2: ['0DTE', 'STRANGLE', 'IPMCC', 'LT112', 'LEAP_PUTS'],    # Phase 2: Expansion
                3: ['0DTE', 'STRANGLE', 'IPMCC', 'LT112', 'LEAP_PUTS'],  # Phase 3: Optimization
                4: ['ALL_STRATEGIES'],                                       # Phase 4: Full deployment
            },
            
            # Strategy risk ratings
            'risk_ratings': {
                '0DTE': 'MODERATE',                      # High win rate but gamma risk
                'STRANGLE': 'LOW',                       # Stable, predictable
                'LT112': 'HIGH',                         # Complex, correlation risk
                'IPMCC': 'MODERATE',                     # LEAP risk, assignment risk
                'RATIO_SPREAD': 'HIGH',                  # Unlimited risk potential
                'DIAGONAL': 'MODERATE',                  # Time risk
                'LEAP_PUTS': 'LOW',                      # Limited downside
            }
        }
    
    def _initialize_phase_parameters(self):
        """Initialize account phase parameters"""
        self.phases = {
            # Phase definitions and requirements
            'phase_definitions': {
                1: {
                    'account_range': (TradingConstants.STARTING_CAPITAL, 40000),
                    'name': 'FOUNDATION',
                    'description': 'Learning systems, building track record',
                    'max_positions': 3,
                    'max_bp_usage': 0.50,
                    'target_bp_usage': 0.40,
                    'risk_profile': RiskProfile.CONSERVATIVE,
                },
                2: {
                    'account_range': (40000, 60000),
                    'name': 'EXPANSION',
                    'description': 'Scaling strategies, adding complexity',
                    'max_positions': 8,
                    'max_bp_usage': 0.65,
                    'target_bp_usage': 0.55,
                    'risk_profile': RiskProfile.MODERATE,
                },
                3: {
                    'account_range': (60000, 75000),
                    'name': 'OPTIMIZATION',
                    'description': 'Full strategies, maximum efficiency',
                    'max_positions': 12,
                    'max_bp_usage': 0.75,
                    'target_bp_usage': 0.65,
                    'risk_profile': RiskProfile.AGGRESSIVE,
                },
                4: {
                    'account_range': (75000, float('inf')),
                    'name': 'PROFESSIONAL',
                    'description': 'Professional deployment, all strategies',
                    'max_positions': 20,
                    'max_bp_usage': 0.85,
                    'target_bp_usage': 0.75,
                    'risk_profile': RiskProfile.PROFESSIONAL,
                },
            },
            
            # Phase progression criteria
            'progression_criteria': {
                'min_time_in_phase_days': 90,            # Minimum 3 months per phase
                'min_win_rate_required': 0.75,           # 75% win rate to progress
                'max_drawdown_allowed': 0.15,            # 15% max drawdown
                'consistency_requirement_months': 3,      # 3 months consistent performance
                'risk_management_compliance': 0.95,      # 95% rule compliance
            },
            
            # Phase-specific target returns
            'phase_targets': {
                1: {'monthly_target': 0.06, 'annual_target': 0.72},     # 6% monthly, 72% annual
                2: {'monthly_target': 0.08, 'annual_target': 0.96},     # 8% monthly, 96% annual
                3: {'monthly_target': 0.10, 'annual_target': 1.20},     # 10% monthly, 120% annual
                4: {'monthly_target': 0.12, 'annual_target': 1.44},     # 12% monthly, 144% annual
            }
        }
    
    def _initialize_emergency_parameters(self):
        """Initialize emergency protocol parameters"""
        self.emergency = {
            # Emergency trigger levels
            'trigger_levels': {
                'LEVEL_1_WATCH': {
                    'portfolio_loss': -0.05,             # 5% portfolio loss
                    'vix_spike': 25,                     # VIX above 25
                    'correlation_increase': 0.70,        # Correlation above 70%
                    'response': 'Enhanced monitoring, reduce new positions',
                },
                'LEVEL_2_CAUTION': {
                    'portfolio_loss': -0.10,             # 10% portfolio loss
                    'vix_spike': 30,                     # VIX above 30
                    'correlation_increase': 0.80,        # Correlation above 80%
                    'response': 'Stop new positions, prepare to close losers',
                },
                'LEVEL_3_WARNING': {
                    'portfolio_loss': -0.15,             # 15% portfolio loss
                    'vix_spike': 35,                     # VIX above 35
                    'correlation_increase': 0.85,        # Correlation above 85%
                    'response': 'Close losing positions, reduce BP usage',
                },
                'LEVEL_4_EMERGENCY': {
                    'portfolio_loss': -0.20,             # 20% portfolio loss
                    'vix_spike': 40,                     # VIX above 40
                    'correlation_increase': 0.90,        # Correlation above 90%
                    'response': 'Close all positions, preserve capital',
                },
            },
            
            # Emergency response protocols
            'response_protocols': {
                'position_sizing_reduction': 0.50,       # Reduce position sizes by 50%
                'bp_usage_reduction': 0.30,              # Reduce BP usage by 30%
                'correlation_limit_tightening': 0.50,    # Tighten correlation limits by 50%
                'profit_taking_acceleration': True,       # Take profits early
                'stop_loss_tightening': 0.75,           # Tighten stops to 75% of normal
            },
            
            # Recovery protocols
            'recovery_protocols': {
                'vix_normalization_threshold': 20,       # VIX below 20 for recovery
                'portfolio_recovery_threshold': -0.05,   # Portfolio loss below 5%
                'gradual_position_increase_rate': 0.25,  # Increase positions by 25% per week
                'correlation_monitoring_period': 30,     # Monitor correlations for 30 days
            }
        }
    
    def _initialize_august_2024_parameters(self):
        """Initialize August 2024 disaster prevention parameters"""
        self.august_2024_protection = {
            # Tom King's disaster analysis
            'disaster_analysis': {
                'tom_king_loss': 308000,                 # £308k loss
                'tom_king_account_percent': 0.58,        # 58% of account
                'cause': 'Six LT112 positions all in equity indices',
                'correlation_at_disaster': 0.95,         # 95% correlation during crash
                'vix_spike': {'from': 16, 'to': 65},     # VIX spiked from 16 to 65
                'recovery_time_months': 4,               # Took 4 months to recover
            },
            
            # Prevention measures
            'prevention_measures': {
                'max_equity_concentration': 0.60,        # Max 60% equity (vs Tom's TradingConstants.FULL_PERCENTAGE%)
                'max_correlated_positions': 3,           # Max 3 correlated positions
                'vix_spike_threshold': 5,                # Alert on VIX spike of 5 points
                'correlation_monitoring_frequency': 'hourly',  # Monitor correlations hourly
                'emergency_exit_correlation': 0.80,      # Exit when correlation hits 80%
            },
            
            # Real-time protection protocols
            'protection_protocols': {
                'correlation_breach_action': 'CLOSE_NEWEST_POSITION',
                'vix_spike_action': 'REDUCE_POSITION_SIZING',
                'equity_concentration_action': 'DIVERSIFY_INTO_OTHER_GROUPS',
                'multiple_losses_action': 'EMERGENCY_STOP',
                'weekend_protection': 'CLOSE_EXPIRING_POSITIONS',
            },
            
            # Success metrics (how well we avoid the disaster)
            'protection_effectiveness': {
                'target_loss_reduction': 0.75,           # Target 75% loss reduction
                'target_recovery_time': 2,               # Target 2 month recovery
                'correlation_limit_effectiveness': 0.85, # 85% of disasters prevented
                'early_warning_success_rate': 0.90,     # 90% early warning success
            }
        }
    
    def get_vix_regime(self, vix_level: float) -> Dict:
        """Get VIX regime information for given VIX level"""
        for regime, config in self.vix_regimes['regime_definitions'].items():
            if config['min'] <= vix_level < config['max']:
                return {
                    'regime': regime,
                    'vix_level': vix_level,
                    'config': config,
                    'bp_limit': self.position_sizing['vix_bp_limits'][regime.lower()]['bp_limit'],
                    'position_multiplier': self.vix_regimes['regime_position_sizing'][regime]['position_multiplier'],
                    'expected_duration': self.vix_regimes['expected_durations'][regime]
                }
        
        # Default to EXTREME if above all thresholds
        return {
            'regime': 'EXTREME',
            'vix_level': vix_level,
            'config': self.vix_regimes['regime_definitions']['EXTREME'],
            'bp_limit': 0.80,
            'position_multiplier': 0.8,
            'expected_duration': self.vix_regimes['expected_durations']['EXTREME']
        }
    
    def get_account_phase(self, account_value: float) -> Dict:
        """Get account phase information for given account value"""
        for phase_num, config in self.phases['phase_definitions'].items():
            min_val, max_val = config['account_range']
            if min_val <= account_value < max_val:
                return {
                    'phase': phase_num,
                    'account_value': account_value,
                    'config': config,
                    'allowed_strategies': self.strategies['phase_allocations'][phase_num],
                    'target_returns': self.phases['phase_targets'][phase_num],
                    'correlation_limits': self.correlation['phase_group_limits'][phase_num]
                }
        
        # Default to Phase 4 if above all thresholds
        return {
            'phase': 4,
            'account_value': account_value,
            'config': self.phases['phase_definitions'][4],
            'allowed_strategies': self.strategies['phase_allocations'][4],
            'target_returns': self.phases['phase_targets'][4],
            'correlation_limits': self.correlation['phase_group_limits'][4]
        }
    
    def get_strategy_parameters(self, strategy: str) -> Dict:
        """Get all parameters for a specific strategy"""
        strategy_upper = strategy.upper()
        
        return {
            'strategy': strategy_upper,
            'bp_requirements': self.position_sizing['strategy_bp_requirements'].get(strategy_upper, 
                                                                                   self.position_sizing['strategy_bp_requirements']['0DTE']),
            'performance_expectations': self.strategies['performance_expectations'].get(strategy_upper, 
                                                                                       self.strategies['performance_expectations']['0DTE']),
            'profit_target': self.defensive['pnl_management']['strategy_profit_targets'].get(strategy_upper, 0.50),
            'stop_loss': self.defensive['pnl_management']['strategy_stop_losses'].get(strategy_upper, -2.00),
            'risk_rating': self.strategies['risk_ratings'].get(strategy_upper, 'MODERATE')
        }
    
    def get_dynamic_strategy_position_limit(self, strategy: str, account_value: float, vix_level: float = None) -> int:
        """Calculate dynamic position limits for strategy based on account phase and VIX
        
        Tom King Philosophy: Position limits should scale with account size and experience
        More sophisticated accounts can handle more complexity while maintaining risk control
        """
        strategy_upper = strategy.upper()
        
        # Get account phase for scaling
        account_phase = self.get_account_phase(account_value)['phase']
        
        # Get base position limit for strategy
        strategy_config = self.position_sizing['strategy_bp_requirements'].get(strategy_upper)
        if not strategy_config:
            strategy_config = self.position_sizing['strategy_bp_requirements']['0DTE']
        
        base_positions = strategy_config.get('base_max_positions', 2)
        
        # Get phase multiplier
        phase_multiplier = self.position_sizing['phase_position_multipliers'].get(account_phase, 1.0)
        
        # Calculate base dynamic limit
        dynamic_limit = int(base_positions * phase_multiplier)
        
        # VIX adjustments (higher VIX = fewer positions for risk control)
        if vix_level is not None:
            if vix_level > 35:      # Extreme VIX: reduce by 50%
                dynamic_limit = max(1, int(dynamic_limit * 0.5))
            elif vix_level > 25:    # High VIX: reduce by 25%
                dynamic_limit = max(1, int(dynamic_limit * 0.75))
            elif vix_level < 15:    # Very low VIX: allow 25% more
                dynamic_limit = int(dynamic_limit * 1.25)
        
        # Strategy-specific caps (prevent runaway positions)
        strategy_caps = {
            'LT112': 8,      # Correlation risk limit (Tom King disaster prevention)
            'IPMCC': 6,      # Capital intensive limit
            'RATIO_SPREAD': 5,  # Unlimited risk limit
            '0DTE': 12,      # Gamma risk limit
        }
        
        max_cap = strategy_caps.get(strategy_upper, 15)  # Default cap of 15
        dynamic_limit = min(dynamic_limit, max_cap)
        
        # Minimum of 1 position always allowed
        return max(1, dynamic_limit)
    
    def get_emergency_level(self, portfolio_loss: float, vix_level: float, 
                          correlation: float) -> Dict:
        """Determine current emergency level based on conditions"""
        max_level = 0
        triggered_conditions = []
        
        for level_num, (level_name, conditions) in enumerate(self.emergency['trigger_levels'].items(), 1):
            if (portfolio_loss <= conditions['portfolio_loss'] or
                vix_level >= conditions['vix_spike'] or
                correlation >= conditions['correlation_increase']):
                
                max_level = level_num
                triggered_conditions.append({
                    'level': level_name,
                    'conditions_met': {
                        'portfolio_loss': portfolio_loss <= conditions['portfolio_loss'],
                        'vix_spike': vix_level >= conditions['vix_spike'],
                        'correlation_spike': correlation >= conditions['correlation_increase']
                    },
                    'response': conditions['response']
                })
        
        return {
            'emergency_level': max_level,
            'level_name': list(self.emergency['trigger_levels'].keys())[max_level - 1] if max_level > 0 else 'NORMAL',
            'triggered_conditions': triggered_conditions,
            'recommended_response': triggered_conditions[-1]['response'] if triggered_conditions else 'Continue normal operations'
        }
    
    def get_correlation_limits(self, account_phase: int, vix_level: float) -> Dict:
        """Get correlation limits adjusted for phase and VIX"""
        base_limit = self.correlation['phase_group_limits'].get(account_phase, 1)
        
        # Get VIX adjustment
        if vix_level < 20:
            vix_multiplier = self.correlation['vix_correlation_adjustments']['low_vix']['multiplier']
        elif vix_level < 25:
            vix_multiplier = self.correlation['vix_correlation_adjustments']['normal_vix']['multiplier']
        elif vix_level < 35:
            vix_multiplier = self.correlation['vix_correlation_adjustments']['high_vix']['multiplier']
        else:
            vix_multiplier = self.correlation['vix_correlation_adjustments']['extreme_vix']['multiplier']
        
        adjusted_limit = max(1, int(base_limit * vix_multiplier))
        
        return {
            'base_limit': base_limit,
            'vix_adjustment': vix_multiplier,
            'adjusted_limit': adjusted_limit,
            'vix_level': vix_level,
            'account_phase': account_phase,
            'august_2024_protection': {
                'tom_king_had': 6,  # Tom King had 6 correlated positions
                'our_limit': adjusted_limit,
                'protection_factor': adjusted_limit / 6.0
            }
        }
    
    def check_august_2024_protection(self, portfolio_analysis: Dict) -> Dict:
        """Check if August 2024 protection measures are effective"""
        equity_concentration = portfolio_analysis.get('equity_concentration', 0)
        correlation_level = portfolio_analysis.get('average_correlation', 0)
        position_count = portfolio_analysis.get('total_positions', 0)
        
        # Calculate protection effectiveness
        tom_king_concentration = 1.0  # TradingConstants.FULL_PERCENTAGE% equity concentration
        concentration_protection = max(0, 1 - equity_concentration / tom_king_concentration)
        
        tom_king_correlation = 0.95  # 95% correlation during crash
        correlation_protection = max(0, 1 - correlation_level / tom_king_correlation)
        
        tom_king_positions = 6  # 6 correlated positions
        position_protection = max(0, 1 - position_count / tom_king_positions) if position_count > 0 else 1
        
        overall_protection = (concentration_protection + correlation_protection + position_protection) / 3
        
        return {
            'protection_analysis': {
                'concentration_protection': concentration_protection,
                'correlation_protection': correlation_protection,
                'position_protection': position_protection,
                'overall_protection': overall_protection,
            },
            'tom_king_comparison': {
                'his_equity_concentration': tom_king_concentration,
                'our_equity_concentration': equity_concentration,
                'his_correlation': tom_king_correlation,
                'our_correlation': correlation_level,
                'his_position_count': tom_king_positions,
                'our_position_count': position_count,
                'estimated_loss_reduction': overall_protection,
            },
            'protection_status': {
                'status': 'EXCELLENT' if overall_protection > 0.75 else 'GOOD' if overall_protection > 0.50 else 'MODERATE' if overall_protection > 0.25 else 'POOR',
                'warnings': self._generate_august_2024_warnings(equity_concentration, correlation_level, position_count),
                'recommendations': self._generate_august_2024_recommendations(equity_concentration, correlation_level, position_count)
            }
        }
    
    def _generate_august_2024_warnings(self, equity_concentration: float, 
                                     correlation_level: float, position_count: int) -> List[str]:
        """Generate warnings based on August 2024 risk factors"""
        warnings = []
        
        if equity_concentration > 0.75:
            warnings.append(f"HIGH RISK: {equity_concentration:.1%} equity concentration (Tom King had TradingConstants.FULL_PERCENTAGE%)")
        
        if correlation_level > 0.80:
            warnings.append(f"HIGH RISK: {correlation_level:.1%} correlation (Tom King disaster level)")
        
        if position_count > 4:
            warnings.append(f"MODERATE RISK: {position_count} positions in correlated group (Tom King had 6)")
        
        return warnings
    
    def _generate_august_2024_recommendations(self, equity_concentration: float,
                                            correlation_level: float, position_count: int) -> List[str]:
        """Generate recommendations to avoid August 2024 disaster"""
        recommendations = []
        
        if equity_concentration > self.august_2024_protection['prevention_measures']['max_equity_concentration']:
            recommendations.append("Reduce equity index concentration - diversify into other correlation groups")
        
        if correlation_level > 0.70:
            recommendations.append("High correlation detected - consider closing newest positions")
        
        if position_count > 3:
            recommendations.append("Multiple correlated positions - consider consolidating or diversifying")
        
        recommendations.append("Monitor VIX closely - be ready for quick action on spikes above 25")
        
        return recommendations
    
    def get_all_risk_parameters(self) -> Dict:
        """Get all risk parameters in one comprehensive dictionary"""
        return {
            'position_sizing': self.position_sizing,
            'correlation': self.correlation,
            'defensive': self.defensive,
            'vix_regimes': self.vix_regimes,
            'strategies': self.strategies,
            'phases': self.phases,
            'emergency': self.emergency,
            'august_2024_protection': self.august_2024_protection,
            'metadata': {
                'version': '1.0.0',
                'last_updated': datetime.now().isoformat(),
                'based_on': 'Tom King Complete Trading System Documentation 2025',
                'implementation': 'QuantConnect LEAN Python'
            }
        }
    
    def validate_parameters(self) -> Dict:
        """Validate all risk parameters for consistency and completeness"""
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'recommendations': []
        }
        
        # Validate VIX BP limits are in ascending order
        vix_limits = [(config['vix_max'], config['bp_limit']) 
                     for config in self.position_sizing['vix_bp_limits'].values()]
        
        for i in range(len(vix_limits) - 1):
            if vix_limits[i][1] > vix_limits[i + 1][1]:
                validation_results['errors'].append(f"VIX BP limits not in ascending order: {vix_limits[i]} vs {vix_limits[i + 1]}")
                validation_results['valid'] = False
        
        # Validate phase limits are consistent
        for phase in range(1, 5):
            if phase not in self.phases['phase_definitions']:
                validation_results['errors'].append(f"Phase {phase} definition missing")
                validation_results['valid'] = False
        
        # Validate all strategies have complete parameters
        required_strategy_params = ['profit_target', 'stop_loss', 'bp_requirements']
        for strategy in self.position_sizing['strategy_bp_requirements']:
            if strategy not in self.strategies['performance_expectations']:
                validation_results['warnings'].append(f"Strategy {strategy} missing performance expectations")
        
        return validation_results
    
    def save_parameters_to_file(self, filename: str) -> bool:
        """Save all parameters to JSON file"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
with open(filename, 'w') as f:
                json.dump(self.get_all_risk_parameters(), f, indent=2, default=str)
            return True
        except Exception as e:
            self.Error(f"Error saving parameters: {e}"")
            return False
    
    def load_parameters_from_file(self, filename: str) -> bool:
        """Load parameters from JSON file"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
with open(filename, 'r') as f:
                loaded_params = json.load(f)
            
            # Update parameters from loaded data
            for category, params in loaded_params.items():
                if hasattr(self, category) and category != 'metadata':
                    setattr(self, category, params)
            
            return True
        except Exception as e:
            self.Error(f"Error loading parameters: {e}"")
            return False


# Global risk parameters instance
RISK_PARAMETERS = RiskParameters()


def get_risk_parameters() -> RiskParameters:
    """Get global risk parameters instance"""
    return RISK_PARAMETERS


def get_vix_regime_info(vix_level: float) -> Dict:
    """Convenience function to get VIX regime info"""
    return RISK_PARAMETERS.get_vix_regime(vix_level)


def get_account_phase_info(account_value: float) -> Dict:
    """Convenience function to get account phase info"""
    return RISK_PARAMETERS.get_account_phase(account_value)


def get_strategy_info(strategy: str) -> Dict:
    """Convenience function to get strategy parameters"""
    return RISK_PARAMETERS.get_strategy_parameters(strategy)


def check_emergency_status(portfolio_loss: float, vix_level: float, correlation: float) -> Dict:
    """Convenience function to check emergency status"""
    return RISK_PARAMETERS.get_emergency_level(portfolio_loss, vix_level, correlation)


def get_dynamic_position_limit(strategy: str, account_value: float, vix_level: float = None) -> int:
    """Convenience function to get dynamic position limits for strategy"""
    return RISK_PARAMETERS.get_dynamic_strategy_position_limit(strategy, account_value, vix_level)


# Example usage and validation
if __name__ == "__main__":
    # Initialize parameters
    risk_params = RiskParameters()
    
    # Validate parameters
    validation = risk_params.validate_parameters()
    print("Parameter Validation:", validation)
    
    # Test VIX regime detection
    test_vix_levels = [12, 18, 22, 28, 45]
    for vix in test_vix_levels:
        regime_info = risk_params.get_vix_regime(vix)
        print(f"VIX {vix}: {regime_info['regime']} - BP Limit: {regime_info['bp_limit']:.1%}")
    
    # Test account phase detection
    test_accounts = [35000, 45000, 65000, 85000]
    for account in test_accounts:
        phase_info = risk_params.get_account_phase(account)
        print(f"Account £{account}: Phase {phase_info['phase']} - Max BP: {phase_info['config']['max_bp_usage']:.1%}")
    
    # Test emergency level detection
    emergency_info = risk_params.get_emergency_level(-0.12, 32, 0.85)
    print(f"Emergency Status: {emergency_info['level_name']} - {emergency_info['recommended_response']}")
    
    # Test August 2024 protection
    portfolio_analysis = {
        'equity_concentration': 0.45,
        'average_correlation': 0.65,
        'total_positions': 3
    }
    protection_info = risk_params.check_august_2024_protection(portfolio_analysis)
    print(f"August 2024 Protection: {protection_info['protection_status']['status']} - {protection_info['protection_analysis']['overall_protection']:.1%} effective")