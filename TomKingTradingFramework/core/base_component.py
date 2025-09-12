# Base component class for all Tom King Trading System components
# Eliminates duplicate initialization patterns across 37+ files

from AlgorithmImports import *
from typing import Optional, Dict, Any
from config.constants import TradingConstants
from core.unified_vix_manager import UnifiedVIXManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class BaseComponent:
    """
    Base class for all trading system components.
    Provides common initialization and utility methods.
    Eliminates duplicate code across the entire system.
    """
    
    def __init__(self, algorithm):
        """Initialize base component with algorithm reference"""
        self.algorithm = algorithm
        self.algo = algorithm  # Alias for compatibility
        self.initialized = False
        self.last_update = None
        
    def log(self, message: str, level: str = "INFO"):
        """Standardized logging method"""
        # Log, Debug, and Error are standard QCAlgorithm methods - always available
        self.algorithm.Log(f"[{self.__class__.__name__}] {message}")
    
    def debug(self, message: str):
        """Debug logging"""
        self.algorithm.Debug(f"[{self.__class__.__name__}] {message}")
    
    def error(self, message: str):
        """Error logging"""
        self.algorithm.Error(f"[{self.__class__.__name__}] {message}")
    
    def get_account_phase(self) -> int:
        """
        Get current account phase based on portfolio value
        Uses centralized constants (USD converted from Tom King's GBP thresholds)
        
        Phase 1: £30-40k (Foundation) = $38,100-$50,800
        Phase 2: £40-60k (Scaling) = $50,800-$76,200
        Phase 3: £60-75k (Optimization) = $76,200-$95,250
        Phase 4: £75k+ (Professional) = $95,250+
        """
        if hasattr(self.algorithm, 'current_phase'):
            return self.algorithm.current_phase
            
        portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
        
        if portfolio_value >= TradingConstants.PHASE4_MIN:
            return 4  # Professional Deployment (£75k+)
        elif portfolio_value >= TradingConstants.PHASE3_MIN:
            return 3  # Optimization (£60-75k)
        elif portfolio_value >= TradingConstants.PHASE2_MIN:
            return 2  # Scaling (£40-60k)
        elif portfolio_value >= TradingConstants.PHASE1_MIN:
            return 1  # Foundation (£30-40k)
        else:
            return 0  # Below minimum trading capital
    
    def is_market_open(self) -> bool:
        """Check if market is currently open"""
        if self.algorithm.IsMarketOpen("SPY"):
            return True
        return False
    
    def get_vix_level(self) -> float:
        """Get current VIX level"""
        if hasattr(self.algorithm, 'vix_indicator'):
            return self.algorithm.vix_indicator.get_vix_level()
        
        # Fallback to direct VIX check
        vix_symbol = self.algorithm.AddIndex("VIX", Resolution.Minute).Symbol
        if vix_symbol in self.algorithm.Securities:
            return float(self.algorithm.Securities[vix_symbol].Price)
        
        return 20.0  # Default VIX if not available
    
    def get_portfolio_value(self) -> float:
        """Get current portfolio value"""
        return self.algorithm.Portfolio.TotalPortfolioValue
    
    def get_buying_power(self) -> float:
        """Get available buying power"""
        return self.algorithm.Portfolio.MarginRemaining
    
    def validate_trade_conditions(self, strategy_name: str) -> bool:
        """Common trade validation logic"""
        # Check if strategy validator exists
        if hasattr(self.algorithm, 'strategy_validator'):
            is_valid, reason = self.algorithm.strategy_validator.validate_strategy(strategy_name)
            if not is_valid:
                self.log(f"Strategy {strategy_name} validation failed: {reason}")
            return is_valid
        
        # Basic validation if no validator
        if not self.is_market_open():
            self.log(f"Market closed, cannot execute {strategy_name}")
            return False
        
        if self.get_buying_power() <= 0:
            self.log(f"Insufficient buying power for {strategy_name}")
            return False
        
        return True
    
    def format_currency(self, amount: float) -> str:
        """Format currency for display"""
        return f"${amount:,.2f}"
    
    def format_percentage(self, value: float, decimals: int = 2) -> str:
        """Format percentage for display"""
        return f"{value:.{decimals}f}%"
    
    def safe_divide(self, numerator: float, denominator: float, default: float = 0) -> float:
        """Safe division with default value"""
        if denominator == 0:
            return default
        return numerator / denominator
    
    def is_initialized(self) -> bool:
        """Check if component is initialized"""
        return self.initialized
    
    def mark_initialized(self):
        """Mark component as initialized"""
        self.initialized = True
        self.last_update = self.algorithm.Time
    
    def get_component_status(self) -> Dict[str, Any]:
        """Get component status for monitoring"""
        return {
            'name': self.__class__.__name__,
            'initialized': self.initialized,
            'last_update': str(self.last_update) if self.last_update else None,
            'phase': self.get_account_phase(),
            'portfolio_value': self.get_portfolio_value()
        }