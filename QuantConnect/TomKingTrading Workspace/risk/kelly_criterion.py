# region imports
from AlgorithmImports import *
# endregion
"""Kelly Criterion Position Sizing Calculator"""

import numpy as np

class KellyCriterion:
    """Calculate optimal position sizes using Kelly Criterion"""
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.kelly_fraction = 0.25  # Use 25% Kelly for safety (Tom King approach)
    
    def calculate_kelly_size(self, win_rate, avg_win_pct, avg_loss_pct, confidence=1.0):
        """
        Calculate Kelly Criterion position size
        
        Args:
            win_rate: Probability of winning (0-1)
            avg_win_pct: Average win as percentage of position (e.g., 0.25 for 25%)
            avg_loss_pct: Average loss as percentage of position (e.g., 0.15 for 15%)
            confidence: Confidence in estimates (0-1), reduces size if <1
        
        Returns:
            Recommended position size as fraction of account
        """
        if avg_loss_pct <= 0 or win_rate <= 0 or win_rate >= 1:
            return 0.0
        
        # Standard Kelly formula: (p*b - q) / b
        # Where p = win_rate, q = 1-win_rate, b = avg_win/avg_loss
        loss_rate = 1 - win_rate
        win_loss_ratio = avg_win_pct / avg_loss_pct
        
        kelly = (win_rate * win_loss_ratio - loss_rate) / win_loss_ratio
        
        # Apply safety factors
        kelly = max(0, kelly)  # Never negative
        kelly = min(kelly, 0.25)  # Cap at 25% (Tom King max for single position)
        kelly *= self.kelly_fraction  # Apply fractional Kelly (25% of full Kelly)
        kelly *= confidence  # Reduce if not confident
        
        return kelly
    
    def calculate_position_sizes_for_strategies(self):
        """
        Calculate recommended sizes for each Tom King strategy
        
        Returns:
            Dictionary of strategy names to recommended position sizes
        """
        account_value = self.algo.Portfolio.TotalPortfolioValue
        
        strategies = {
            'FRIDAY_0DTE': {
                'win_rate': 0.88,
                'avg_win': 0.50,  # 50% of credit
                'avg_loss': 1.00,  # 100% of credit (2x stop)
                'confidence': 0.95  # Very high confidence
            },
            'LT112': {
                'win_rate': 0.75,
                'avg_win': 0.30,
                'avg_loss': 0.20,
                'confidence': 0.90
            },
            'FUTURES_STRANGLES': {
                'win_rate': 0.70,
                'avg_win': 0.50,
                'avg_loss': 0.30,
                'confidence': 0.85
            },
            'IPMCC': {
                'win_rate': 0.83,
                'avg_win': 0.03,  # 3% weekly
                'avg_loss': 0.30,  # 30% stop on LEAP
                'confidence': 0.80
            },
            'LEAP_PUTS': {
                'win_rate': 0.82,
                'avg_win': 0.30,
                'avg_loss': 0.15,
                'confidence': 0.85
            }
        }
        
        position_sizes = {}
        for strategy, params in strategies.items():
            kelly_pct = self.calculate_kelly_size(
                params['win_rate'],
                params['avg_win'],
                params['avg_loss'],
                params['confidence']
            )
            position_sizes[strategy] = {
                'percentage': kelly_pct,
                'dollar_amount': account_value * kelly_pct,
                'description': f"{kelly_pct*100:.1f}% of account (${account_value * kelly_pct:,.0f})"
            }
        
        return position_sizes
    
    def log_recommended_sizes(self):
        """Log recommended position sizes to debug console"""
        sizes = self.calculate_position_sizes_for_strategies()
        
        self.algo.Debug("=== KELLY CRITERION POSITION SIZES ===")
        for strategy, size_info in sizes.items():
            self.algo.Debug(f"{strategy}: {size_info['description']}")
        
        # Calculate total recommended usage
        total_pct = sum(s['percentage'] for s in sizes.values())
        self.algo.Debug(f"Total Recommended BP Usage: {total_pct*100:.1f}%")
        
        # Compare to VIX regime limits
        if hasattr(self.algo, 'current_vix') and self.algo.current_vix:
            vix = self.algo.current_vix
            if vix < 16:
                max_bp = 0.45
            elif vix < 20:
                max_bp = 0.65
            elif vix < 25:
                max_bp = 0.75
            else:
                max_bp = 0.80
            
            self.algo.Debug(f"VIX Regime Max BP: {max_bp*100:.0f}% (VIX: {vix:.1f})")
            if total_pct > max_bp:
                self.algo.Debug(f"WARNING: Kelly exceeds VIX limit by {(total_pct-max_bp)*100:.1f}%")
