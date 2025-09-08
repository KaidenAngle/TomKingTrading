# region imports
from AlgorithmImports import *
# endregion
"""
QuantConnect LEAN Risk Management Package
Complete implementation of Tom King's risk management methodology

This package provides four essential risk management modules:

1. position_sizing.py - VIX-based position sizing logic
2. august_2024_correlation_limiter.py - Correlation group management 
3. defensive.py - Defensive adjustment protocols
4. parameters.py - Centralized risk parameters

Author: Based on Tom King Complete Trading System Documentation 2025
Version: 1.0.0
Implementation: QuantConnect LEAN Python
"""

# Import only what exists and is used by main.py
from .august_2024_correlation_limiter import (
    August2024CorrelationLimiter as CorrelationManager
)

from .vix_regime import (
    VIXRegimeManager
)


__version__ = "1.0.0"
__author__ = "Tom King Trading System Implementation"

# Main risk management components
__all__ = [
    # Correlation Management
    'August2024CorrelationLimiter',
    
    # VIX Regime Management
    'VIXRegimeManager'
]