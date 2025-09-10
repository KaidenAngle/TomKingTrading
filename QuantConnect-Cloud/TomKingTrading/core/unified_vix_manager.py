# Unified VIX Manager - Single source of truth for all VIX operations
# Consolidates 26+ duplicate VIX implementations into one clean interface
#
# NOT REDUNDANT WITH VIXRegimeManager - HERE'S WHY:
# - UnifiedVIXManager: Provides FAST CACHED ACCESS to VIX values (5-second cache)
#                      Simple regime detection for quick decisions
#                      Used for real-time position sizing adjustments
# - VIXRegimeManager: Provides ADVANCED REGIME ANALYSIS with 6 levels
#                     Tracks regime history and transitions
#                     Has strategy-specific adjustments per regime
#                     Used for strategic planning and backtesting analysis
#
# BOTH ARE NEEDED: UnifiedVIXManager for performance, VIXRegimeManager for intelligence

from AlgorithmImports import *
from typing import Optional, Dict, Tuple
from config.constants import VIX_LOW, VIX_NORMAL, VIX_ELEVATED, VIX_HIGH

class UnifiedVIXManager:
    """
    Centralized VIX management system FOR FAST CACHED ACCESS.
    Eliminates duplicate VIX checking across 26+ files.
    Single source of truth for VIX regime detection and thresholds.
    
    PURPOSE: Performance-optimized VIX access with caching
    USE FOR: Real-time decisions that need quick VIX values
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Standard VIX thresholds from Tom King methodology
        self.thresholds = {
            'low': VIX_LOW,           # 16
            'normal': VIX_NORMAL,     # 20
            'elevated': VIX_ELEVATED, # 25
            'high': VIX_HIGH,         # 30
            'extreme': 40,            # Emergency level
            'crisis': 50,             # System halt level
            'august_2024': 65.73      # Historical reference
        }
        
        # CRITICAL: Buying power limits by VIX regime and account phase
        # From Tom King's VIX regime management system
        self.bp_limits = {
            'LOW': {'phase1': 0.45, 'phase2': 0.50, 'phase3': 0.55, 'phase4': 0.60},
            'NORMAL': {'phase1': 0.50, 'phase2': 0.60, 'phase3': 0.65, 'phase4': 0.70},
            'ELEVATED': {'phase1': 0.40, 'phase2': 0.50, 'phase3': 0.55, 'phase4': 0.60},
            'HIGH': {'phase1': 0.30, 'phase2': 0.35, 'phase3': 0.40, 'phase4': 0.45},
            'EXTREME': {'phase1': 0.60, 'phase2': 0.70, 'phase3': 0.75, 'phase4': 0.80},
            'CRISIS': {'phase1': 0.20, 'phase2': 0.25, 'phase3': 0.30, 'phase4': 0.35},
            'HISTORIC': {'phase1': 0.15, 'phase2': 0.20, 'phase3': 0.25, 'phase4': 0.30}
        }
        
        # Cache for performance
        self._cached_vix = None
        self._cache_time = None
        self._cache_duration = timedelta(seconds=5)
        
    def get_current_vix(self) -> float:
        """Get current VIX value with caching"""
        
        current_time = self.algo.Time
        
        # Use cache if fresh
        if (self._cached_vix is not None and 
            self._cache_time is not None and
            current_time - self._cache_time < self._cache_duration):
            return self._cached_vix
        
        # Get fresh VIX value
        try:
            # Get VIX symbol - already initialized in main.py as Symbol object
            vix_symbol = self.algo.vix
            
            # Check if VIX security exists and get price
            if vix_symbol in self.algo.Securities:
                vix_security = self.algo.Securities[vix_symbol]
                if vix_security.Price > 0:
                    self._cached_vix = float(vix_security.Price)
                    self._cache_time = current_time
                    return self._cached_vix
                else:
                    self.algo.Debug("[VIX] VIX price is zero - using default")
                    return 20.0  # Default to normal regime
            else:
                self.algo.Error("[VIX] VIX symbol not found in securities")
                return 20.0  # Default to normal regime
                
        except Exception as e:
            self.algo.Error(f"[VIX] Error getting VIX: {e}")
            return 20.0  # Default to normal regime
    
    def get_vix_regime(self) -> str:
        """Get current VIX regime classification"""
        
        vix = self.get_current_vix()
        
        if vix <= self.thresholds['low']:
            return "LOW"
        elif vix <= self.thresholds['normal']:
            return "NORMAL"
        elif vix <= self.thresholds['elevated']:
            return "ELEVATED"
        elif vix <= self.thresholds['high']:
            return "HIGH"
        elif vix <= self.thresholds['extreme']:
            return "EXTREME"
        elif vix <= self.thresholds['crisis']:
            return "CRISIS"
        else:
            return "HISTORIC"
    
    def get_vix_details(self) -> Dict:
        """Get comprehensive VIX status"""
        
        vix = self.get_current_vix()
        regime = self.get_vix_regime()
        
        return {
            'value': vix,
            'regime': regime,
            'can_trade_0dte': vix > 22,  # Tom King rule
            'reduce_size': vix > self.thresholds['high'],
            'emergency_exit': vix > self.thresholds['extreme'],
            'halt_trading': vix > self.thresholds['crisis'],
            'percentile': self._calculate_percentile(vix),
            'regime_duration': self._get_regime_duration(),
            'next_threshold': self._get_next_threshold(vix)
        }
    
    def check_0dte_eligible(self) -> bool:
        """Check if VIX conditions allow 0DTE trading (Tom King rule)"""
        return self.get_current_vix() > 22
    
    def check_emergency_conditions(self) -> bool:
        """Check if VIX indicates emergency conditions"""
        return self.get_current_vix() > self.thresholds['extreme']
    
    def check_halt_conditions(self) -> bool:
        """Check if VIX requires trading halt"""
        return self.get_current_vix() > self.thresholds['crisis']
    
    def get_position_size_adjustment(self) -> float:
        """Get position size adjustment factor based on VIX"""
        
        vix = self.get_current_vix()
        
        # Normal sizing below elevated
        if vix <= self.thresholds['elevated']:
            return 1.0
        
        # Reduce linearly from elevated to extreme
        elif vix <= self.thresholds['extreme']:
            # Scale from 1.0 to 0.5
            range_size = self.thresholds['extreme'] - self.thresholds['elevated']
            position = vix - self.thresholds['elevated']
            reduction = 0.5 * (position / range_size)
            return 1.0 - reduction
        
        # Minimum sizing above extreme
        else:
            return 0.25
    
    def get_margin_requirement_multiplier(self) -> float:
        """Get margin requirement multiplier based on VIX"""
        
        regime = self.get_vix_regime()
        
        multipliers = {
            "LOW": 1.0,
            "NORMAL": 1.0,
            "ELEVATED": 1.25,
            "HIGH": 1.5,
            "EXTREME": 2.0,
            "CRISIS": 3.0,
            "HISTORIC": 4.0
        }
        
        return multipliers.get(regime, 1.5)
    
    def should_exit_positions(self) -> Tuple[bool, str]:
        """Determine if positions should be exited based on VIX"""
        
        vix = self.get_current_vix()
        
        if vix > self.thresholds['crisis']:
            return True, f"VIX crisis level: {vix:.2f}"
        elif vix > self.thresholds['extreme']:
            return True, f"VIX extreme level: {vix:.2f}"
        else:
            return False, ""
    
    def _calculate_percentile(self, vix: float) -> float:
        """Calculate historical percentile of current VIX"""
        
        # Simplified percentile calculation
        # In production, would use historical data
        
        if vix < 12:
            return 5
        elif vix < 16:
            return 25
        elif vix < 20:
            return 50
        elif vix < 25:
            return 75
        elif vix < 30:
            return 90
        elif vix < 40:
            return 95
        else:
            return 99
    
    def _get_regime_duration(self) -> int:
        """Get number of days in current regime"""
        
        # Simplified - would track state changes in production
        return 1
    
    def _get_next_threshold(self, vix: float) -> Dict:
        """Get next threshold information"""
        
        for name, threshold in sorted(self.thresholds.items(), key=lambda x: x[1]):
            if vix < threshold:
                return {
                    'name': name,
                    'value': threshold,
                    'distance': threshold - vix,
                    'percentage': ((threshold - vix) / vix) * 100
                }
        
        return {
            'name': 'none',
            'value': None,
            'distance': None,
            'percentage': None
        }
    
    def get_max_buying_power_usage(self, account_phase: int = 1) -> float:
        """Get maximum buying power usage based on VIX regime and account phase"""
        
        regime = self.get_vix_regime()
        phase_key = f'phase{account_phase}'
        
        # Get BP limit for current regime and phase
        bp_limits = self.bp_limits.get(regime, self.bp_limits['NORMAL'])
        max_bp = bp_limits.get(phase_key, 0.40)  # Default 40%
        
        self.algo.Debug(f"[VIX] Regime: {regime}, Phase: {account_phase}, Max BP: {max_bp:.0%}")
        return max_bp
    
    def get_account_phase(self) -> int:
        """Determine account phase based on portfolio value"""
        
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        if portfolio_value < 50000:
            return 1
        elif portfolio_value < 100000:
            return 2
        elif portfolio_value < 250000:
            return 3
        else:
            return 4
    
    def log_vix_status(self):
        """Log current VIX status"""
        
        details = self.get_vix_details()
        phase = self.get_account_phase()
        max_bp = self.get_max_buying_power_usage(phase)
        
        self.algo.Debug(
            f"[VIX] Value: {details['value']:.2f} | "
            f"Regime: {details['regime']} | "
            f"0DTE: {'Yes' if details['can_trade_0dte'] else 'No'} | "
            f"Size Adj: {self.get_position_size_adjustment():.2f}x | "
            f"Max BP: {max_bp:.0%}"
        )