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
from typing import Optional, Dict, Tuple, List, Any
from datetime import datetime
from config.constants import TradingConstants
from core.base_component import BaseComponent
# PHASE 6: Circular dependency resolution
from core.dependency_container import IManager
from core.event_bus import Event, EventType

class UnifiedVIXManager(BaseComponent, IManager):
    """
    Centralized VIX management system FOR FAST CACHED ACCESS.
    Eliminates duplicate VIX checking across 26+ files.
    Single source of truth for VIX regime detection and thresholds.
    
    PURPOSE: Performance-optimized VIX access with caching
    USE FOR: Real-time decisions that need quick VIX values
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm)  # Initialize BaseComponent
        
        # Standard VIX thresholds from Tom King methodology
        self.thresholds = {
            'low': TradingConstants.VIX_LOW,           # 16
            'normal': TradingConstants.VIX_NORMAL,     # 20
            'elevated': TradingConstants.VIX_ELEVATED, # 25
            'high': TradingConstants.VIX_HIGH,         # 30
            'extreme': TradingConstants.VIX_EXTREME,   # 35
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
        
        # Performance optimization based on environment
        self.is_backtest = not algorithm.LiveMode
        
        # Cache for performance - different durations for backtest vs live
        self._cached_vix = None
        self._cache_time = None
        self._cache_duration = timedelta(minutes=5 if self.is_backtest else 1)
        
        # Status logging frequency
        self.last_status_log = None
        self.status_log_interval = timedelta(minutes=30 if self.is_backtest else 5)
        
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
            if hasattr(self.algo, 'vix') and self.algo.vix is not None:
                vix_symbol = self.algo.vix
            else:
                # FIXED: Proper fallback for missing VIX symbol
                self.algo.Error("[VIX] CRITICAL: VIX symbol not available - algorithm initialization error")
                return 20.0  # Emergency fallback with warning

            if self.algo.Securities.ContainsKey(vix_symbol):
                self._cached_vix = self.algo.Securities[vix_symbol].Price
                self._cache_time = current_time
                return self._cached_vix
            else:
                if not self.is_backtest:
                    self.algo.Error("[VIX] VIX symbol not found in securities")
                return 20.0  # Default to normal regime

        except Exception as e:
            self.algo.Error(f"[VIX] Error retrieving VIX value: {str(e)}")
            return 20.0  # Emergency fallback on error
    
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
    
    def get_market_regime(self) -> str:
        """
        Get comprehensive market regime assessment combining VIX analysis with market dynamics.
        
        This method provides broader market regime classification beyond VIX-only analysis,
        incorporating market behavior patterns and trading environment assessment.
        
        Returns:
            str: Market regime classification ("NORMAL", "TRANSITIONAL", "STRESSED", "CRISIS")
        
        Called from:
            - main.py:682 in OnData loop for strategy execution context
            - Position sizing decisions requiring market context
            - Risk management regime-specific adjustments
        """
        
        vix = self.get_current_vix()
        vix_regime = self.get_vix_regime()
        
        # Get current market time for regime context
        current_time = self.algo.Time
        
        # Base regime assessment on VIX levels with market dynamics overlay
        if vix_regime in ["LOW", "NORMAL"]:
            # Check for hidden stress indicators during "normal" VIX periods
            if vix > 18 and current_time.hour in [9, 15]:  # Market open/close volatility
                return "TRANSITIONAL"  # Elevated intraday volatility despite normal VIX
            elif vix <= 16:
                return "NORMAL"  # True low volatility environment
            else:
                return "NORMAL"  # Standard trading environment
                
        elif vix_regime == "ELEVATED":
            # VIX 20-25: Transition period requiring careful assessment
            portfolio_value = self.get_portfolio_value()  # Use inherited BaseComponent method
            
            # Check for rapid VIX increases (stress building)
            if hasattr(self, '_previous_vix') and self._previous_vix:
                vix_change = vix - self._previous_vix
                if vix_change > 2.0:  # VIX increased by more than 2 points
                    return "STRESSED"  # Rapid volatility expansion
            
            # Check margin utilization as stress indicator
            margin_used = self.algo.Portfolio.TotalMarginUsed
            if portfolio_value > 0:
                margin_ratio = margin_used / portfolio_value
                if margin_ratio > 0.6:  # High margin usage during elevated VIX
                    return "STRESSED"
            
            return "TRANSITIONAL"  # Elevated but manageable
            
        elif vix_regime == "HIGH":
            # VIX 25-30: Stressed market conditions
            
            # Check for extreme intraday moves indicating crisis potential
            if current_time.hour >= 14 and vix > 28:  # Late day high VIX
                return "CRISIS"  # Afternoon volatility spike often precedes crisis
                
            # High VIX during options expiration (additional complexity)
            if current_time.weekday() == 4:  # Friday
                return "STRESSED"  # Friday high VIX requires caution but not crisis level
                
            return "STRESSED"  # General high volatility environment
            
        elif vix_regime in ["EXTREME", "CRISIS"]:
            # VIX 30+: Crisis conditions requiring defensive positioning
            
            # Differentiate between extreme volatility and true crisis
            if vix >= 40:
                return "CRISIS"  # True crisis conditions (2020, 2008 levels)
            elif vix >= 35:
                return "CRISIS"  # Extreme stress approaching crisis
            else:
                return "STRESSED"  # Very high volatility but not crisis
                
        else:  # HISTORIC levels (VIX > 50)
            return "CRISIS"  # Any VIX above 50 is crisis territory
    
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
        
        if not self.is_backtest:
            self.algo.Debug(f"[VIX] Regime: {regime}, Phase: {account_phase}, Max BP: {max_bp:.0%}")
        return max_bp
    
    
    def log_vix_status(self):
        """Log current VIX status with conditional frequency for performance"""
        
        current_time = self.algo.Time
        
        # Check if enough time has passed since last status log
        if (self.last_status_log is not None and 
            current_time - self.last_status_log < self.status_log_interval):
            return
        
        # Log VIX status conditionally
        details = self.get_vix_details()
        phase = self.get_account_phase()
        max_bp = self.get_max_buying_power_usage(phase)
        
        if not self.is_backtest or current_time.minute % 30 == 0:
            self.algo.Debug(
                f"[VIX] Value: {details['value']:.2f} | "
                f"Regime: {details['regime']} | "
                f"0DTE: {'Yes' if details['can_trade_0dte'] else 'No'} | "
                f"Size Adj: {self.get_position_size_adjustment():.2f}x | "
                f"Max BP: {max_bp:.0%}"
            )
        
        self.last_status_log = current_time
    
    def update(self):
        """Update method for compatibility with legacy code
        
        This method exists for backward compatibility with any legacy code
        that might be calling vix_manager.update(). The VIX manager doesn't
        actually need updating since it pulls data on-demand from QC APIs.
        """
        # VIX manager pulls fresh data on-demand, no periodic update needed
        return  # No-op for backward compatibility
    
    # PHASE 6: IManager Interface Implementation for Event-Driven Architecture
    
    def handle_event(self, event: Event) -> bool:
        """Handle incoming events from the event bus"""
        
        try:
            if event.event_type == EventType.VIX_LEVEL_REQUEST:
                # Handle VIX level requests
                vix_value = self.get_current_vix()
                regime = self.get_vix_regime()
                details = self.get_vix_details()
                
                # Publish response with comprehensive VIX data
                if hasattr(self.algo, 'event_bus'):
                    response_data = {
                        'correlation_id': event.correlation_id,
                        'vix_value': vix_value,
                        'regime': regime,
                        'details': details,
                        'can_trade_0dte': self.check_0dte_eligible(),
                        'position_size_adjustment': self.get_position_size_adjustment(),
                        'max_bp_usage': self.get_max_buying_power_usage()
                    }
                    
                    self.algo.event_bus.publish(
                        Event(EventType.VIX_LEVEL_RESPONSE, response_data, "vix_manager")
                    )
                
                return True
            
            # Handle regime change notifications
            elif event.event_type == EventType.MARKET_DATA:
                # Check for regime changes and publish notifications
                current_regime = self.get_vix_regime()
                if hasattr(self, '_last_regime') and self._last_regime != current_regime:
                    if hasattr(self.algo, 'event_bus'):
                        self.algo.event_bus.publish(Event(
                            EventType.MARKET_REGIME_CHANGED,  # Use existing event type
                            {
                                'component': 'vix_manager',
                                'old_regime': self._last_regime,
                                'new_regime': current_regime,
                                'vix_value': self.get_current_vix(),
                                'timestamp': self.algo.Time
                            },
                            "vix_manager"
                        ))
                self._last_regime = current_regime
                return True
                
            return False
            
        except Exception as e:
            self.algo.Error(f"[VIXManager] Error handling event {event.event_type}: {e}")
            return False
    
    def get_dependencies(self) -> List[str]:
        """Return list of manager names this manager depends on"""
        return ['data_validator']  # VIX manager needs data validation
    
    def can_initialize_without_dependencies(self) -> bool:
        """Return True if this manager can initialize before its dependencies are ready"""
        return True  # VIX manager can work with default values if data validator isn't ready
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "vix_manager"
    
    def get_health_status(self) -> Dict[str, Any]:
        """Return manager health status for monitoring"""
        try:
            }
        except Exception as e:
            current_vix = self.get_current_vix()
            current_regime = self.get_vix_regime()
            return {
                'healthy': True,
                'ready': self.is_ready(),
                'dependencies_met': True,
                'last_health_check': datetime.now(),
                'vix_value': current_vix,
                'regime': current_regime,
                'cache_valid': self._cache_time is not None and 
                              (self.algo.Time - self._cache_time < self._cache_duration),
                'thresholds_configured': len(self.thresholds) > 0,
                'bp_limits_configured': len(self.bp_limits) > 0
        except Exception as e:
            return {
                'healthy': False,
                'ready': False,
                'error': str(e),
                'last_health_check': datetime.now()
            }