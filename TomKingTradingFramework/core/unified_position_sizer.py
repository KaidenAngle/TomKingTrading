# Unified Position Sizing System - Single source of truth for all position calculations
# Consolidates 9+ duplicate position sizing implementations
#
# NOT REDUNDANT WITH PositionSizer - HERE'S WHY:
# - UnifiedPositionSizer: SIMPLE KELLY CRITERION implementation
#                         Fast calculation for standard position sizing
#                         Strategy-specific contract limits
#                         Account tier-based sizing
# - PositionSizer: COMPLEX VIX-REGIME-BASED sizing
#                  6 VIX regimes with different BP limits
#                  Account phase management (Phase 1-4)
#                  Special crisis opportunity rules
#                  August 2024 crash protection measures
#
# USE UnifiedPositionSizer FOR: Quick standard position sizing
# USE PositionSizer FOR: VIX regime-adjusted sizing with complex rules

from AlgorithmImports import *
from typing import Dict, Optional
from config.constants import TradingConstants

# Get constants from TradingConstants class
KELLY_FACTOR = TradingConstants.KELLY_FACTOR
MIN_CONTRACTS = TradingConstants.MIN_CONTRACTS_PER_TRADE
MAX_CONTRACTS_0DTE = TradingConstants.MAX_CONTRACTS_0DTE
MAX_CONTRACTS_LT112 = TradingConstants.MAX_CONTRACTS_LT112
MAX_CONTRACTS_FUTURES = TradingConstants.MAX_CONTRACTS_FUTURES

class UnifiedPositionSizer:
    """
    Centralized position sizing system FOR SIMPLE KELLY SIZING.
    Eliminates duplicate sizing logic across all strategies.
    Implements Tom King's Kelly Criterion with 0.25 conservative factor.
    
    PURPOSE: Fast, simple position sizing with Kelly Criterion
    USE FOR: Standard position sizing without complex VIX adjustments
    UNIQUE FEATURES: Strategy-specific limits, account tier sizing
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Kelly factor from Tom King methodology
        self.kelly_factor = KELLY_FACTOR  # 0.25
        
        # Strategy-specific limits
        self.max_contracts = {
            '0DTE': MAX_CONTRACTS_0DTE,           # 10
            'LT112': MAX_CONTRACTS_LT112,         # 5
            'IPMCC': 100,                          # Based on shares owned
            'FuturesStrangle': MAX_CONTRACTS_FUTURES, # 3
            'LEAPLadders': 10                     # Portfolio protection limit
        }
        
        # Account value thresholds for sizing
        self.sizing_tiers = {
            10000: 1,    # Under $10k: 1 contract
            25000: 2,    # $10k-$25k: 2 contracts
            50000: 3,    # $25k-$50k: 3 contracts
            100000: 5,   # $50k-$100k: 5 contracts
            250000: 10,  # $100k-$250k: 10 contracts
            500000: 15,  # $250k-$500k: 15 contracts
            1000000: 20  # Over $500k: 20 contracts
        }
    
    def calculate_position_size(self, 
                               strategy_name: str,
                               win_rate: float = 0.60,
                               avg_win: float = 1.0,
                               avg_loss: float = 1.0,
                               override_kelly: Optional[float] = None) -> int:
        """
        Calculate position size using Kelly Criterion
        
        Args:
            strategy_name: Name of the strategy
            win_rate: Historical win rate (default 60%)
            avg_win: Average win amount
            avg_loss: Average loss amount
            override_kelly: Override Kelly factor if needed
        
        Returns:
            Number of contracts to trade
        """
        
        try:
            # Get account value
            account_value = self.algo.Portfolio.TotalPortfolioValue
            
            # Calculate base Kelly size
            kelly_size = self._calculate_kelly_size(
                account_value, win_rate, avg_win, avg_loss, override_kelly
            )
            
            # Apply VIX adjustment
            vix_adjustment = self._get_vix_adjustment()
            adjusted_size = int(kelly_size * vix_adjustment)
            
            # Apply strategy-specific limits
            max_allowed = self.max_contracts.get(strategy_name, 10)
            final_size = min(adjusted_size, max_allowed)
            
            # Apply minimum
            final_size = max(final_size, MIN_CONTRACTS)
            
            # Apply account tier limits
            tier_limit = self._get_tier_limit(account_value)
            final_size = min(final_size, tier_limit)
            
            self.algo.Debug(
                f"[Sizer] {strategy_name}: Base={kelly_size}, "
                f"VIX adj={vix_adjustment:.2f}, Final={final_size}"
            )
            
            return final_size
            
        except Exception as e:
            self.algo.Error(f"[Sizer] Error calculating size: {e}")
            return MIN_CONTRACTS
    
    def calculate_0dte_size(self) -> int:
        """Specialized sizing for 0DTE strategy"""
        
        # 0DTE has higher win rate but needs conservative sizing
        return self.calculate_position_size(
            strategy_name='0DTE',
            win_rate=0.70,  # Tom King's 0DTE win rate
            avg_win=0.50,   # Average credit
            avg_loss=2.00   # Risk of full loss
        )
    
    def calculate_lt112_size(self) -> int:
        """Specialized sizing for LT112 strategy"""
        
        return self.calculate_position_size(
            strategy_name='LT112',
            win_rate=0.85,  # High win rate for 112 DTE
            avg_win=0.50,   # 50% profit target
            avg_loss=1.00   # Defined risk spread
        )
    
    def calculate_futures_size(self) -> int:
        """Specialized sizing for futures strangles"""
        
        # Futures need extra conservative sizing
        return self.calculate_position_size(
            strategy_name='FuturesStrangle',
            win_rate=0.65,
            avg_win=1.00,
            avg_loss=2.00,
            override_kelly=0.15  # Extra conservative
        )
    
    def calculate_leap_allocation(self) -> float:
        """Calculate dollar allocation for LEAP ladders"""
        
        account_value = self.algo.Portfolio.TotalPortfolioValue
        
        # 5-10% allocation to portfolio protection
        if account_value < 50000:
            allocation_pct = 0.05
        elif account_value < 100000:
            allocation_pct = 0.075
        else:
            allocation_pct = 0.10
        
        return account_value * allocation_pct
    
    def _calculate_kelly_size(self,
                             account_value: float,
                             win_rate: float,
                             avg_win: float,
                             avg_loss: float,
                             override_kelly: Optional[float]) -> int:
        """Calculate raw Kelly Criterion position size"""
        
        # Kelly formula: f = (p*b - q) / b
        # where p = win rate, q = loss rate, b = win/loss ratio
        
        loss_rate = 1 - win_rate
        win_loss_ratio = avg_win / avg_loss if avg_loss > 0 else 1
        
        # Calculate Kelly percentage
        kelly_pct = (win_rate * win_loss_ratio - loss_rate) / win_loss_ratio
        
        # Apply conservative factor
        factor = override_kelly if override_kelly else self.kelly_factor
        conservative_kelly = kelly_pct * factor
        
        # Ensure reasonable bounds
        conservative_kelly = max(0.01, min(conservative_kelly, 0.25))
        
        # Calculate contracts based on $10k per contract rule
        contracts_per_10k = account_value / 10000
        kelly_contracts = int(contracts_per_10k * conservative_kelly)
        
        return max(1, kelly_contracts)
    
    def _get_vix_adjustment(self) -> float:
        """Get position size adjustment based on VIX"""
        
        # Use unified VIX manager if available
        if hasattr(self.algo, 'vix_manager'):
            return self.algo.vix_manager.get_position_size_adjustment()
        
        # Fallback to default
        return 1.0
    
    def _get_tier_limit(self, account_value: float) -> int:
        """Get position limit based on account tier"""
        
        for threshold, limit in sorted(self.sizing_tiers.items()):
            if account_value < threshold:
                return limit
        
        # Maximum for large accounts
        return 20
    
    def get_strategy_limits(self) -> Dict:
        """Get current position limits for all strategies"""
        
        account_value = self.algo.Portfolio.TotalPortfolioValue
        vix_adj = self._get_vix_adjustment()
        
        limits = {}
        for strategy, max_contracts in self.max_contracts.items():
            tier_limit = self._get_tier_limit(account_value)
            adjusted_limit = int(min(max_contracts, tier_limit) * vix_adj)
            limits[strategy] = max(1, adjusted_limit)
        
        return limits
    
    def validate_position_size(self, strategy: str, requested_size: int) -> int:
        """Validate and adjust requested position size"""
        
        limits = self.get_strategy_limits()
        max_allowed = limits.get(strategy, 10)
        
        if requested_size > max_allowed:
            self.algo.Debug(
                f"[Sizer] {strategy} requested {requested_size}, "
                f"limited to {max_allowed}"
            )
            return max_allowed
        
        return max(MIN_CONTRACTS, requested_size)
    
    def get_max_position_size(self, strategy: str, market_conditions: Dict = None) -> int:
        """Get maximum allowed position size for a strategy
        
        Critical method for position validation - calculates maximum allowable position size
        considering account tier, strategy limits, market conditions, and risk parameters.
        
        Args:
            strategy: Strategy name ('0DTE', 'LT112', 'FuturesStrangle', etc.)
            market_conditions: Optional dict with market condition overrides
                              {'vix_level': float, 'account_override': float}
        
        Returns:
            int: Maximum number of contracts allowed for this strategy
        """
        try:
            # Get base account value
            if market_conditions and 'account_override' in market_conditions:
                account_value = market_conditions['account_override']
            else:
                account_value = self.algo.Portfolio.TotalPortfolioValue
            
            if account_value <= 0:
                self.algo.Debug(f"[UnifiedSizer] Invalid account value: {account_value}")
                return MIN_CONTRACTS
            
            # Get strategy-specific hard limit
            strategy_max = self.max_contracts.get(strategy, 10)
            
            # Get account tier limit
            tier_limit = self._get_tier_limit(account_value)
            
            # Get VIX adjustment
            if market_conditions and 'vix_level' in market_conditions:
                vix_level = market_conditions['vix_level']
                # Simple VIX adjustment logic
                if vix_level < 16:
                    vix_multiplier = 0.8  # Reduce in low volatility
                elif vix_level > 30:
                    vix_multiplier = 0.6  # Reduce in high volatility
                else:
                    vix_multiplier = 1.0  # Normal volatility
            else:
                vix_multiplier = self._get_vix_adjustment()
            
            # Calculate maximum considering all constraints
            base_max = min(strategy_max, tier_limit)
            adjusted_max = int(base_max * vix_multiplier)
            
            # Apply minimum constraint
            final_max = max(MIN_CONTRACTS, adjusted_max)
            
            # Strategy-specific additional constraints
            if strategy == '0DTE':
                # 0DTE should be conservative during high volatility
                if hasattr(self.algo, 'vix_manager'):
                    current_vix = self.algo.vix_manager.get_vix_level()
                    if current_vix > 25:
                        final_max = min(final_max, 3)  # Cap at 3 contracts in high VIX
                        
            elif strategy == 'LT112':
                # LT112 can be more aggressive due to longer timeframe
                pass  # No additional constraints
                
            elif strategy == 'FuturesStrangle':
                # Futures need extra conservative limits due to leverage
                final_max = min(final_max, 3)  # Hard cap at 3 for futures
            
            # Log calculation details for debugging
            if not self.algo.LiveMode:  # Only in backtest to avoid spam
                self.algo.Debug(
                    f"[UnifiedSizer] Max size for {strategy}: "
                    f"Strategy limit={strategy_max}, Tier limit={tier_limit}, "
                    f"VIX multiplier={vix_multiplier:.2f}, Final max={final_max}"
                )
            
            return final_max
            
        except Exception as e:
            self.algo.Error(f"[UnifiedSizer] Error calculating max position size for {strategy}: {e}")
            # Return conservative fallback
            return MIN_CONTRACTS