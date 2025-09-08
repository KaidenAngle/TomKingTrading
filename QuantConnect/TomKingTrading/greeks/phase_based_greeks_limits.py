#!/usr/bin/env python3
"""
Tom King Trading Framework - Phase-Based Greeks Limits
Implements proper phase-specific Greeks limits per Tom King methodology
"""

from AlgorithmImports import *
from typing import Dict, Tuple, Optional
from enum import Enum

class AccountPhase(Enum):
    """Account phases based on account value"""
    PHASE_1 = 1  # $38-51k
    PHASE_2 = 2  # $51-76k
    PHASE_3 = 3  # $76-95k
    PHASE_4 = 4  # $95k+

class PhaseBasedGreeksLimits:
    """
    Enforces Tom King's phase-specific Greeks limits
    These limits scale with account size to maintain proper risk management
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Tom King Phase-Based Greeks Limits (per documentation)
        self.phase_limits = {
            AccountPhase.PHASE_1: {
                'delta': 50,    # ±50 delta
                'gamma': 10,    # ±10 gamma
                'vega': 100,    # ±100 vega
                'theta': -250,  # Minimum theta collection
                'description': 'Conservative Phase 1 limits'
            },
            AccountPhase.PHASE_2: {
                'delta': 75,    # ±75 delta
                'gamma': 15,    # ±15 gamma
                'vega': 150,    # ±150 vega
                'theta': -375,  # Minimum theta collection
                'description': 'Moderate Phase 2 limits'
            },
            AccountPhase.PHASE_3: {
                'delta': 100,   # ±100 delta
                'gamma': 20,    # ±20 gamma
                'vega': 200,    # ±200 vega
                'theta': -500,  # Minimum theta collection
                'description': 'Advanced Phase 3 limits'
            },
            AccountPhase.PHASE_4: {
                'delta': 150,   # ±150 delta
                'gamma': 30,    # ±30 gamma
                'vega': 300,    # ±300 vega
                'theta': -750,  # Minimum theta collection
                'description': 'Professional Phase 4 limits'
            }
        }
        
        # Phase thresholds (account value)
        self.phase_thresholds = {
            AccountPhase.PHASE_1: (38000, 51000),
            AccountPhase.PHASE_2: (51000, 76000),
            AccountPhase.PHASE_3: (76000, 95000),
            AccountPhase.PHASE_4: (95000, float('inf'))
        }
        
        self.algo.Log("✅ Phase-Based Greeks Limits Manager Initialized")
    
    def get_current_phase(self, account_value: Optional[float] = None) -> AccountPhase:
        """Determine current account phase based on account value"""
        if account_value is None:
            account_value = self.algo.Portfolio.TotalPortfolioValue
        
        if account_value < 51000:
            return AccountPhase.PHASE_1
        elif account_value < 76000:
            return AccountPhase.PHASE_2
        elif account_value < 95000:
            return AccountPhase.PHASE_3
        else:
            return AccountPhase.PHASE_4
    
    def get_phase_limits(self, phase: Optional[AccountPhase] = None) -> Dict:
        """Get Greeks limits for specific phase or current phase"""
        if phase is None:
            phase = self.get_current_phase()
        
        return self.phase_limits.get(phase, self.phase_limits[AccountPhase.PHASE_1])
    
    def calculate_portfolio_greeks(self) -> Dict[str, float]:
        """Calculate total portfolio Greeks"""
        total_greeks = {
            'delta': 0.0,
            'gamma': 0.0,
            'theta': 0.0,
            'vega': 0.0,
            'rho': 0.0
        }
        
        for symbol, holding in self.algo.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Option:
                try:
                    security = self.algo.Securities[symbol]
                    
                    # Get Greeks if available
                    if hasattr(security, 'Greeks') and security.Greeks:
                        quantity = holding.Quantity
                        multiplier = 100  # Options multiplier
                        
                        total_greeks['delta'] += security.Greeks.Delta * quantity * multiplier
                        total_greeks['gamma'] += security.Greeks.Gamma * quantity * multiplier
                        total_greeks['theta'] += security.Greeks.Theta * quantity * multiplier
                        total_greeks['vega'] += security.Greeks.Vega * quantity * multiplier
                        total_greeks['rho'] += security.Greeks.Rho * quantity * multiplier if hasattr(security.Greeks, 'Rho') else 0
                        
                except Exception as e:
                    self.algo.Debug(f"Error calculating Greeks for {symbol}: {str(e)}")
        
        return total_greeks
    
    def check_greeks_compliance(self, proposed_trade: Optional[Dict] = None) -> Tuple[bool, str, Dict]:
        """
        Check if current portfolio Greeks are within phase limits
        Optionally check if a proposed trade would violate limits
        
        Returns:
            - compliant: bool - Whether Greeks are within limits
            - message: str - Explanation of any violations
            - details: Dict - Current Greeks and limits
        """
        current_phase = self.get_current_phase()
        phase_limits = self.get_phase_limits(current_phase)
        current_greeks = self.calculate_portfolio_greeks()
        
        # If proposed trade, add its Greeks to current
        if proposed_trade:
            for greek in ['delta', 'gamma', 'theta', 'vega']:
                if greek in proposed_trade:
                    current_greeks[greek] += proposed_trade[greek]
        
        # Check each Greek against phase limits
        violations = []
        
        if abs(current_greeks['delta']) > phase_limits['delta']:
            violations.append(f"Delta {current_greeks['delta']:.1f} exceeds Phase {current_phase.value} limit of ±{phase_limits['delta']}")
        
        if abs(current_greeks['gamma']) > phase_limits['gamma']:
            violations.append(f"Gamma {current_greeks['gamma']:.1f} exceeds Phase {current_phase.value} limit of ±{phase_limits['gamma']}")
        
        if abs(current_greeks['vega']) > phase_limits['vega']:
            violations.append(f"Vega {current_greeks['vega']:.1f} exceeds Phase {current_phase.value} limit of ±{phase_limits['vega']}")
        
        # Theta check (should be negative, collecting premium)
        if current_greeks['theta'] > 0:
            violations.append(f"Theta {current_greeks['theta']:.1f} is positive (paying theta instead of collecting)")
        elif current_greeks['theta'] > phase_limits['theta']:  # Less negative than required
            violations.append(f"Theta {current_greeks['theta']:.1f} insufficient for Phase {current_phase.value} (minimum {phase_limits['theta']})")
        
        compliant = len(violations) == 0
        message = "Greeks within phase limits" if compliant else " | ".join(violations)
        
        details = {
            'phase': current_phase.value,
            'current_greeks': current_greeks,
            'phase_limits': phase_limits,
            'violations': violations,
            'account_value': self.algo.Portfolio.TotalPortfolioValue
        }
        
        return compliant, message, details
    
    def should_allow_trade(self, symbol, quantity: int, option_type: str) -> Tuple[bool, str]:
        """
        Pre-trade validation: Check if a new trade would violate Greeks limits
        
        Args:
            symbol: Option symbol
            quantity: Number of contracts (positive for long, negative for short)
            option_type: 'CALL' or 'PUT'
        
        Returns:
            - allowed: bool - Whether trade should be allowed
            - reason: str - Explanation
        """
        try:
            # Estimate Greeks impact of proposed trade
            security = self.algo.Securities[symbol]
            if not hasattr(security, 'Greeks') or not security.Greeks:
                # Can't validate without Greeks, allow with warning
                return True, "Warning: Greeks not available for validation"
            
            # Calculate proposed Greeks change
            multiplier = 100
            proposed_greeks = {
                'delta': security.Greeks.Delta * quantity * multiplier,
                'gamma': security.Greeks.Gamma * quantity * multiplier,
                'theta': security.Greeks.Theta * quantity * multiplier,
                'vega': security.Greeks.Vega * quantity * multiplier
            }
            
            # Check if trade would violate limits
            compliant, message, details = self.check_greeks_compliance(proposed_greeks)
            
            if not compliant:
                self.algo.Log(f"⚠️ Trade blocked - Would violate Phase {details['phase']} Greeks limits: {message}")
                return False, f"Greeks violation: {message}"
            
            return True, "Trade within Greeks limits"
            
        except Exception as e:
            self.algo.Error(f"Error validating Greeks for trade: {str(e)}")
            return True, "Greeks validation error - allowing trade"
    
    def log_greeks_status(self):
        """Log current Greeks status vs phase limits"""
        compliant, message, details = self.check_greeks_compliance()
        
        status_emoji = "✅" if compliant else "⚠️"
        
        self.algo.Log(f"""
{status_emoji} GREEKS STATUS - Phase {details['phase']}
=====================================
Account Value: ${details['account_value']:,.0f}
Phase Limits: {details['phase_limits']['description']}

Current Greeks:
  Delta: {details['current_greeks']['delta']:+.1f} / ±{details['phase_limits']['delta']}
  Gamma: {details['current_greeks']['gamma']:+.1f} / ±{details['phase_limits']['gamma']}
  Vega:  {details['current_greeks']['vega']:+.1f} / ±{details['phase_limits']['vega']}
  Theta: {details['current_greeks']['theta']:+.1f} / {details['phase_limits']['theta']}

Status: {message}
""")
    
    def get_remaining_capacity(self) -> Dict[str, float]:
        """Calculate remaining Greeks capacity before hitting limits"""
        current_phase = self.get_current_phase()
        phase_limits = self.get_phase_limits(current_phase)
        current_greeks = self.calculate_portfolio_greeks()
        
        remaining = {
            'delta_positive': phase_limits['delta'] - current_greeks['delta'],
            'delta_negative': phase_limits['delta'] + current_greeks['delta'],
            'gamma_positive': phase_limits['gamma'] - current_greeks['gamma'],
            'gamma_negative': phase_limits['gamma'] + current_greeks['gamma'],
            'vega_positive': phase_limits['vega'] - current_greeks['vega'],
            'vega_negative': phase_limits['vega'] + current_greeks['vega'],
            'theta_capacity': current_greeks['theta'] - phase_limits['theta']  # How much more theta we can collect
        }
        
        return remaining

# Integration with main algorithm:
"""
# In main.py Initialize():
self.phase_greeks_manager = PhaseBasedGreeksLimits(self)

# Before placing trades:
allowed, reason = self.phase_greeks_manager.should_allow_trade(option_symbol, quantity, 'PUT')
if not allowed:
    self.Log(f"Trade blocked: {reason}")
    return

# Periodic monitoring (e.g., in OnData or scheduled event):
if self.Time.hour == 10 and self.Time.minute == 0:
    self.phase_greeks_manager.log_greeks_status()
    
# Check compliance:
compliant, message, details = self.phase_greeks_manager.check_greeks_compliance()
if not compliant:
    self.Log(f"⚠️ GREEKS VIOLATION: {message}")
    # Trigger defensive actions
"""