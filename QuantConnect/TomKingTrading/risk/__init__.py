# region imports
from AlgorithmImports import *
# endregion
"""
QuantConnect LEAN Risk Management Package
Complete implementation of Tom King's risk management methodology

This package provides four essential risk management modules:

1. position_sizing.py - VIX-based position sizing logic
2. correlation.py - Correlation group management 
3. defensive.py - Defensive adjustment protocols
4. parameters.py - Centralized risk parameters

Author: Based on Tom King Complete Trading System Documentation 2025
Version: 1.0.0
Implementation: QuantConnect LEAN Python
"""

# Import only what exists and is used by main.py
from .correlation import (
    CorrelationManager,
    CorrelationGroup
)

from .vix_regime import (
    VIXRegimeManager
)

# Commented out missing modules
# from .position_sizing import (
#     PositionSizer,
#     VIXRegime,
#     AccountPhase
# )

# from .defensive import (
#     DefensiveManager,
#     DefensiveAction,
#     ManagementTrigger,
#     PositionStatus
# )

# from .parameters import (
#     RiskParameters,
#     RiskProfile,
#     RISK_PARAMETERS,
#     get_risk_parameters,
#     get_vix_regime_info,
#     get_account_phase_info,
#     get_strategy_info,
#     check_emergency_status
# )

__version__ = "1.0.0"
__author__ = "Tom King Trading System Implementation"

# Main risk management components
__all__ = [
    # Correlation Management
    'CorrelationManager',
    'CorrelationGroup',
    
    # VIX Regime Management
    'VIXRegimeManager'
]