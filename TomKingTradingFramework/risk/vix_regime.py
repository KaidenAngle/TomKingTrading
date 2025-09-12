# region imports
from AlgorithmImports import *
from config.constants import TradingConstants
# endregion
# Tom King Trading Framework v17 - VIX Regime Analysis System
# Based on Tom King Complete Trading System Documentation (PDF Pages 12, 33, 34-35)
#
# NOT REDUNDANT WITH UnifiedVIXManager - HERE'S WHY:
# - VIXRegimeManager: Provides ADVANCED 6-LEVEL REGIME ANALYSIS
#                     Tracks historical VIX patterns and regime transitions
#                     Has detailed strategy adjustments for each regime
#                     Includes special rules for crisis opportunities
#                     Maintains TradingConstants.TRADING_DAYS_PER_YEAR-day history for pattern analysis
# - UnifiedVIXManager: Simple cached VIX access for performance
#
# THIS CLASS IS FOR: Strategic decision-making based on VIX regime analysis
# USE WHEN: You need to understand VIX context, not just current value

class VIXRegimeManager:
    """
    Tom King 6-Level VIX Regime System (EXTREMELY_LOW to EXTREME)
    Dynamically adjusts buying power and position sizing based on volatility environment
    
    PURPOSE: Advanced regime analysis with historical context
    USE FOR: Strategic planning, regime-based adjustments, crisis detection
    UNIQUE FEATURES: 6 regimes, history tracking, strategy adjustments per regime
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.current_vix = None
        self.vix_history = []
        self.regime_history = []
        
        # 5-Level VIX Regime System (PDF Page 12)
        self.vix_regimes = {
            'EXTREMELY_LOW': {
                'range': (0, 12),
                'description': 'Complacency regime - premium scarce',
                'max_bp_usage': {
                    'phase1': 0.35, 'phase2': 0.40, 'phase3': 0.45, 'phase4': 0.50
                },
                'strategy_adjustments': {
                    'reduce_premium_selling': True,
                    'focus_calendar_spreads': True,
                    'avoid_short_strangles': True,
                    'increase_long_premium': True
                },
                'warning': 'Premium environment poor - reduce activity'
            },
            
            'LOW': {
                'range': (12, 16),
                'description': 'Low volatility - normal premium collection',
                'max_bp_usage': {
                    'phase1': 0.45, 'phase2': 0.50, 'phase3': 0.55, 'phase4': 0.60
                },
                'strategy_adjustments': {
                    'standard_operations': True,
                    'normal_position_sizing': True,
                    'all_strategies_available': True
                },
                'warning': None
            },
            
            'NORMAL': {
                'range': (16, 20),
                'description': 'Normal volatility - optimal trading environment',
                'max_bp_usage': {
                    'phase1': 0.50, 'phase2': 0.60, 'phase3': 0.65, 'phase4': 0.70
                },
                'strategy_adjustments': {
                    'optimal_environment': True,
                    'all_strategies_active': True,
                    'maximum_efficiency': True
                },
                'warning': None
            },
            
            'ELEVATED': {
                'range': (20, 25),
                'description': 'Elevated volatility - caution required',
                'max_bp_usage': {
                    'phase1': 0.40, 'phase2': 0.50, 'phase3': 0.55, 'phase4': 0.60
                },
                'strategy_adjustments': {
                    'reduce_position_size': True,
                    'avoid_high_gamma': True,
                    'prefer_further_dte': True,
                    'increase_monitoring': True
                },
                'warning': 'Elevated volatility - reduce position sizes'
            },
            
            'HIGH': {
                'range': (25, 30),
                'description': 'High volatility - defensive posture',
                'max_bp_usage': {
                    'phase1': 0.30, 'phase2': 0.35, 'phase3': 0.40, 'phase4': 0.45
                },
                'strategy_adjustments': {
                    'defensive_mode': True,
                    'avoid_0dte': True,
                    'increase_cash_buffer': True,
                    'focus_far_otm': True
                },
                'warning': 'High volatility regime - defensive positioning required'
            },
            
            'EXTREME': {
                'range': (30, 999),
                'description': 'Crisis mode - maximum opportunity',
                'max_bp_usage': {
                    'phase1': 0.60, 'phase2': 0.70, 'phase3': 0.75, 'phase4': 0.80
                },
                'strategy_adjustments': {
                    'crisis_opportunity': True,
                    'aggressive_premium_selling': True,
                    'ignore_correlation_limits': True,
                    'maximum_deployment': True
                },
                'warning': '[WARNING] CRISIS OPPORTUNITY - Deploy capital aggressively',
                'special_rules': {
                    'max_single_deployment': 0.20,  # 20% max per single opportunity
                    'focus_45_dte': True,
                    'sell_16_delta_strangles': True,
                    'expected_monthly_return': '15-25%'
                }
            }
        }
        
        # Historical VIX levels for reference (PDF Page 7-8)
        self.historical_context = {
            'august_5_2024': 65.73,  # The disaster that taught correlation lessons
            'march_2020_covid': 82.69,
            'february_2018_volmageddon': 50.30,
            'august_2015_china': 53.29,
            'october_2008_financial_crisis': 89.53,
            'typical_bull_market': 12.5,
            'typical_bear_market': 35.0
        }
    
    def update_vix_level(self, vix_level, timestamp=None):
        """Update current VIX level and maintain history"""
        if timestamp is None:
            timestamp = self.algorithm.Time
        
        self.current_vix = float(vix_level)
        
        # Maintain VIX history (last TradingConstants.TRADING_DAYS_PER_YEAR days)
        self.vix_history.append({
            'timestamp': timestamp,
            'vix': self.current_vix
        })
        
        # Keep only recent history
        if len(self.vix_history) > 252:
            self.vix_history = self.vix_history[-252:]
        
        # Update regime history
        current_regime = self.get_current_regime()
        self.regime_history.append({
            'timestamp': timestamp,
            'vix': self.current_vix,
            'regime': current_regime['name']
        })
        
        # Keep regime history
        if len(self.regime_history) > 252:
            self.regime_history = self.regime_history[-252:]
    
    def get_current_vix(self):
        """Get current VIX level"""
        # Try to get from Securities if not updated recently
        if self.current_vix is None and hasattr(self.algorithm, 'Securities'):
            if "VIX" in self.algorithm.Securities:
                self.current_vix = float(self.algorithm.Securities["VIX"].Price)
        
        # Return current VIX or default to normal regime (18)
        return self.current_vix if self.current_vix is not None else 18.0
    
    def get_current_regime(self):
        """Get current VIX regime based on latest VIX level"""
        if self.current_vix is None:
            self.algo.Debug("No VIX data available for regime determination")
            return {
                'name': 'UNKNOWN',
                'vix_level': None,
                'data': {
                    'max_bp_usage': 0.30,  # Conservative when no VIX data
                    'position_sizing': 'CONSERVATIVE',
                    'strategy_filters': ['HIGH_WIN_RATE_ONLY']
                },
                'historical_context': 'NO_VIX_DATA'
            }
        
        for regime_name, regime_data in self.vix_regimes.items():
            min_vix, max_vix = regime_data['range']
            if min_vix <= self.current_vix < max_vix:
                return {
                    'name': regime_name,
                    'vix_level': self.current_vix,
                    'data': regime_data,
                    'historical_context': self._get_historical_context()
                }
        
        # Default to EXTREME if VIX is very high
        return {
            'name': 'EXTREME',
            'vix_level': self.current_vix,
            'data': self.vix_regimes['EXTREME'],
            'historical_context': self._get_historical_context()
        }
    
    def get_max_bp_usage(self, account_phase):
        """Get maximum buying power usage for current VIX regime and account phase"""
        regime = self.get_current_regime()
        if not regime:
            self.algo.Debug("No regime available for BP calculation, using conservative default")
            return 0.30  # Extra conservative when regime unknown
        
        phase_key = f'phase{account_phase}'
        max_bp = regime['data']['max_bp_usage'].get(phase_key, 0.40)
        
        return max_bp
    
    def get_position_sizing_multiplier(self, account_phase):
        """
        Get position sizing multiplier based on VIX regime
        Returns: float (0.5 = half size, 2.0 = double size)
        """
        regime = self.get_current_regime()
        if not regime:
            return 1.0
        
        regime_name = regime['name']
        
        # Size adjustments by regime
        multipliers = {
            'EXTREMELY_LOW': 0.5,  # Half size due to poor premium
            'LOW': 0.8,            # Slightly reduced
            'NORMAL': 1.0,         # Normal sizing
            'ELEVATED': 0.7,       # Reduced due to higher risk
            'HIGH': 0.5,           # Half size defensive
            'EXTREME': 2.0         # Double size for opportunity
        }
        
        base_multiplier = multipliers.get(regime_name, 1.0)
        
        # Phase adjustments
        if account_phase <= 2 and regime_name == 'EXTREME':
            base_multiplier = 1.5  # Smaller accounts more conservative even in crisis
        
        return base_multiplier
    
    def should_avoid_strategy(self, strategy_name):
        """Check if current VIX regime suggests avoiding specific strategy"""
        regime = self.get_current_regime()
        if not regime:
            return False, "No VIX data available"
        
        adjustments = regime['data']['strategy_adjustments']
        regime_name = regime['name']
        
        # Strategy-specific regime checks
        avoid_reasons = []
        
        if strategy_name == '0DTE' and regime_name in ['HIGH', 'ELEVATED']:
            if adjustments.get('avoid_0dte') or adjustments.get('avoid_high_gamma'):
                avoid_reasons.append("High VIX regime - avoid 0DTE gamma risk")
        
        if strategy_name == 'STRANGLE' and regime_name == 'EXTREMELY_LOW':
            if adjustments.get('avoid_short_strangles'):
                avoid_reasons.append("Extremely low VIX - poor premium collection")
        
        if 'BUTTERFLY' in strategy_name.upper() and regime_name in ['HIGH', 'EXTREME']:
            avoid_reasons.append("High volatility - butterfly spreads less effective")
        
        should_avoid = len(avoid_reasons) > 0
        reason = "; ".join(avoid_reasons) if should_avoid else "Strategy suitable for current VIX regime"
        
        return should_avoid, reason
    
    def get_strategy_recommendations(self, account_phase):
        """Get strategy recommendations based on current VIX regime"""
        regime = self.get_current_regime()
        if not regime:
            self.algo.Debug("No VIX regime available for strategy recommendations")
            return [
                {
                    'strategy': 'CONSERVATIVE_ONLY',
                    'reason': 'No VIX data available - use high win rate strategies only',
                    'priority': 'HIGH',
                    'suggested_strategies': ['LT112_PUT_SELLING'],
                    'avoid_strategies': ['0DTE', 'STRANGLES', 'BUTTERFLIES']
                }
            ]
        
        recommendations = []
        regime_name = regime['name']
        adjustments = regime['data']['strategy_adjustments']
        
        # Regime-specific recommendations
        if regime_name == 'EXTREMELY_LOW':
            recommendations.extend([
                "Focus on calendar spreads and diagonal spreads",
                "Consider buying premium (long strangles, long butterflies)",
                "Reduce short premium strategies",
                "Wait for volatility expansion"
            ])
        
        elif regime_name == 'LOW':
            recommendations.extend([
                "Normal operations - all strategies available",
                "Standard position sizing",
                "Monitor for volatility changes"
            ])
        
        elif regime_name == 'NORMAL':
            recommendations.extend([
                "Optimal trading environment",
                "Maximum strategy deployment",
                "Focus on high-probability setups",
                "Standard Tom King methodology"
            ])
        
        elif regime_name == 'ELEVATED':
            recommendations.extend([
                "Reduce position sizes by 30%",
                "Avoid high-gamma strategies",
                "Prefer 45+ DTE over 30 DTE",
                "Increase monitoring frequency"
            ])
        
        elif regime_name == 'HIGH':
            recommendations.extend([
                "Defensive posture required",
                "Avoid 0DTE completely",
                "Focus on far OTM positions",
                "Maintain larger cash buffer"
            ])
        
        elif regime_name == 'EXTREME':
            recommendations.extend([
                "[WARNING] GENERATIONAL OPPORTUNITY",
                "Deploy up to 20% of account aggressively",
                "Sell 16-delta strangles at 45 DTE",
                "Temporarily ignore correlation limits",
                "Target 15-25% monthly returns",
                "Focus on high-IV underlyings"
            ])
            
            # Add special crisis deployment recommendations
            if regime['data'].get('special_rules'):
                recommendations.append("[WARNING] CRISIS DEPLOYMENT ACTIVATED")
        
        return recommendations
    
    def _get_historical_context(self):
        """Provide historical context for current VIX level"""
        if self.current_vix is None:
            return "No VIX data available"
        
        contexts = []
        
        # Compare to historical events
        if self.current_vix >= self.historical_context['august_5_2024']:
            contexts.append(f"Above August 5, 2024 spike ({self.historical_context['august_5_2024']})")
        
        if self.current_vix >= self.historical_context['march_2020_covid']:
            contexts.append(f"Above COVID-19 peak ({self.historical_context['march_2020_covid']})")
        
        if self.current_vix >= 50:
            contexts.append("Extreme crisis-level volatility")
        elif self.current_vix >= 30:
            contexts.append("Major market stress event")
        elif self.current_vix <= self.historical_context['typical_bull_market']:
            contexts.append("Below typical bull market levels")
        
        # Recent trend analysis
        if len(self.vix_history) >= 5:
            recent_vix = [h['vix'] for h in self.vix_history[-5:]]
            if all(recent_vix[i] <= recent_vix[i+1] for i in range(len(recent_vix)-1)):
                contexts.append("Rising VIX trend")
            elif all(recent_vix[i] >= recent_vix[i+1] for i in range(len(recent_vix)-1)):
                contexts.append("Falling VIX trend")
        
        return "; ".join(contexts) if contexts else f"VIX at {self.current_vix:.2f}"
    
    def check_vix_spike_opportunity(self, account_value):
        """
        Check for VIX spike trading opportunities (PDF Page 33)
        Returns deployment recommendations for crisis scenarios
        """
        regime = self.get_current_regime()
        if not regime:
            self.algo.Debug("No VIX regime data for spike opportunity analysis")
            return None
        
        if regime['name'] != 'EXTREME':
            self.algo.Debug(f"VIX regime {regime['name']} doesn't qualify for spike opportunities")
            return None
        
        # Calculate maximum deployment (20% of account max)
        max_deployment = min(account_value * 0.20, 50000)  # Max £50k deployment
        
        opportunity = {
            'triggered': True,
            'vix_level': self.current_vix,
            'regime': regime['name'],
            'max_deployment': max_deployment,
            'deployment_percentage': 20,  # 20% max
            'expected_duration': '2-8 weeks for VIX normalization',
            'target_monthly_return': '15-25%',
            'strategy_focus': [
                'Sell 16-delta strangles at 45 DTE',
                'Focus on high-IV underlyings (>50% IV Rank)',
                'Prioritize ES, SPY, QQQ, IWM',
                'Temporarily ignore correlation limits'
            ],
            'risk_management': [
                'Maximum 20% deployment per crisis',
                'Close at 50% profit or TradingConstants.DEFENSIVE_EXIT_DTE DTE',
                'Monitor correlation risk during crisis',
                'Expect 80%+ win rate during normalization'
            ],
            'historical_precedent': f"Similar to {self._get_closest_historical_event()}",
            'warning': '[WARNING] ONCE-PER-YEAR OPPORTUNITY - Deploy aggressively'
        }
        
        return opportunity
    
    def _get_closest_historical_event(self):
        """Find closest historical VIX event for context"""
        if self.current_vix is None:
            return "Unknown"
        
        # Find closest historical event
        min_diff = float('inf')
        closest_event = None
        
        for event, vix_level in self.historical_context.items():
            diff = abs(self.current_vix - vix_level)
            if diff < min_diff:
                min_diff = diff
                closest_event = event
        
        return closest_event.replace('_', ' ').title()
    
    def get_vix_regime_summary(self, account_phase):
        """Generate comprehensive VIX regime analysis"""
        regime = self.get_current_regime()
        
        if not regime:
            return {
                'error': 'No VIX data available',
                'current_vix': None,
                'regime': None
            }
        
        summary = {
            'current_vix': self.current_vix,
            'regime': regime['name'],
            'description': regime['data']['description'],
            'max_bp_usage': self.get_max_bp_usage(account_phase),
            'position_sizing_multiplier': self.get_position_sizing_multiplier(account_phase),
            'historical_context': regime['historical_context'],
            'strategy_recommendations': self.get_strategy_recommendations(account_phase),
            'warnings': [],
            'opportunities': None
        }
        
        # Add regime-specific warnings
        if regime['data'].get('warning'):
            summary['warnings'].append(regime['data']['warning'])
        
        # Check for spike opportunity
        if regime['name'] == 'EXTREME':
            opportunity = self.check_vix_spike_opportunity(
                float(self.algorithm.Portfolio.TotalPortfolioValue)
            )
            if opportunity:
                summary['opportunities'] = opportunity
                summary['warnings'].append(opportunity['warning'])
        
        # Add strategy avoidance warnings
        for strategy in ['0DTE', 'STRANGLE', 'BUTTERFLY']:
            should_avoid, reason = self.should_avoid_strategy(strategy)
            if should_avoid:
                summary['warnings'].append(f"{strategy}: {reason}")
        
        return summary
    
    def validate_vix_system(self):
        """Validate VIX regime system functionality"""
        tests = [
            ('5 regimes defined', len(self.vix_regimes) == 6),  # Including EXTREME
            ('All regimes have BP limits', all(
                'max_bp_usage' in regime for regime in self.vix_regimes.values()
            )),
            ('Historical context available', len(self.historical_context) >= 5),
            ('Regime detection works', self.current_vix is not None)
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'[WARNING]' if condition else '[WARNING]'} {test_name}")
        
        return results

# Usage Example for QuantConnect Algorithm:
#
