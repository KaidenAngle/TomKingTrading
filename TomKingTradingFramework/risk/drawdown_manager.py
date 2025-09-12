#!/usr/bin/env python3
"""
Drawdown Manager - Tom King Risk Management
Implements 10%/15%/20% drawdown protocols with appropriate responses
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
from enum import Enum

class DrawdownLevel(Enum):
    """Drawdown severity levels per Tom King methodology"""
    NORMAL = "NORMAL"           # < 10%
    WARNING = "WARNING"         # 10-15%
    CRITICAL = "CRITICAL"       # 15-20%
    EMERGENCY = "EMERGENCY"     # > 20%

class DrawdownManager:
    """
    Manages portfolio drawdown monitoring and response protocols
    Based on Tom King's risk management rules
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Drawdown thresholds (Tom King specific)
        self.thresholds = {
            'warning': 0.10,    # 10% - Reduce new positions
            'critical': 0.15,   # 15% - Stop new positions
            'emergency': 0.20   # 20% - Consider closing positions
        }
        
        # Track peak values
        self.peak_value = 0.0
        self.peak_date = None
        self.current_drawdown = 0.0
        self.current_level = DrawdownLevel.NORMAL
        
        # Response tracking
        self.response_active = False
        self.response_start_date = None
        self.positions_reduced = False
        
        # Historical tracking
        self.drawdown_history = []
        self.max_historical_drawdown = 0.0
        
    def update_drawdown(self) -> Dict:
        """Update drawdown calculations and trigger responses"""
        current_value = float(self.algo.Portfolio.TotalPortfolioValue)
        
        # Update peak if new high
        if current_value > self.peak_value:
            self.peak_value = current_value
            self.peak_date = self.algo.Time
            
        # Calculate current drawdown
        if self.peak_value > 0:
            self.current_drawdown = (self.peak_value - current_value) / self.peak_value
        else:
            self.current_drawdown = 0.0
            
        # Update historical max
        if self.current_drawdown > self.max_historical_drawdown:
            self.max_historical_drawdown = self.current_drawdown
            
        # Determine drawdown level
        previous_level = self.current_level
        self.current_level = self._determine_level(self.current_drawdown)
        
        # Trigger responses if level changed
        response_action = None
        if self.current_level != previous_level:
            response_action = self._trigger_response(previous_level, self.current_level)
            
        # Record history
        self.drawdown_history.append({
            'timestamp': self.algo.Time,
            'value': current_value,
            'peak_value': self.peak_value,
            'drawdown': self.current_drawdown,
            'level': self.current_level,
            'response': response_action
        })
        
        return {
            'current_drawdown': self.current_drawdown,
            'level': self.current_level,
            'peak_value': self.peak_value,
            'days_since_peak': (self.algo.Time - self.peak_date).days if self.peak_date else 0,
            'response_active': self.response_active,
            'action': response_action
        }
        
    def _determine_level(self, drawdown: float) -> DrawdownLevel:
        """Determine drawdown severity level"""
        if drawdown >= self.thresholds['emergency']:
            return DrawdownLevel.EMERGENCY
        elif drawdown >= self.thresholds['critical']:
            return DrawdownLevel.CRITICAL
        elif drawdown >= self.thresholds['warning']:
            return DrawdownLevel.WARNING
        else:
            return DrawdownLevel.NORMAL
            
    def _trigger_response(self, previous: DrawdownLevel, current: DrawdownLevel) -> Optional[str]:
        """Trigger appropriate response based on level change"""
        # Deteriorating condition
        if current.value > previous.value:
            if current == DrawdownLevel.WARNING:
                return self._handle_warning_level()
            elif current == DrawdownLevel.CRITICAL:
                return self._handle_critical_level()
            elif current == DrawdownLevel.EMERGENCY:
                return self._handle_emergency_level()
                
        # Improving condition
        elif current.value < previous.value:
            if current == DrawdownLevel.NORMAL:
                return self._handle_recovery()
                
        return None
        
    def _handle_warning_level(self) -> str:
        """Handle 10% drawdown - Reduce new positions"""
        self.response_active = True
        self.response_start_date = self.algo.Time
        
        self.algo.Log(f"[DRAWDOWN WARNING] Portfolio down {self.current_drawdown:.1%} - Reducing new positions")
        
        # Reduce position sizing for new trades
        if hasattr(self.algo, 'position_sizer'):
            self.algo.position_sizer.apply_drawdown_adjustment(0.5)  # 50% reduction
            
        return "WARNING: Reduced position sizing by 50%"
        
    def _handle_critical_level(self) -> str:
        """Handle 15% drawdown - Stop new positions"""
        self.response_active = True
        self.positions_reduced = False
        
        self.algo.Log(f"[DRAWDOWN CRITICAL] Portfolio down {self.current_drawdown:.1%} - Stopping new positions")
        
        # Stop all new position entries
        if hasattr(self.algo, 'can_open_positions'):
            self.algo.can_open_positions = False
            
        # Tighten profit targets on existing positions
        if hasattr(self.algo, 'profit_target_manager'):
            self.algo.profit_target_manager.tighten_targets(0.25)  # Take profits at 25% instead of 50%
            
        return "CRITICAL: New positions stopped, profit targets tightened"
        
    def _handle_emergency_level(self) -> str:
        """Handle 20% drawdown - Emergency protocols"""
        self.response_active = True
        
        self.algo.Log(f"[DRAWDOWN EMERGENCY] Portfolio down {self.current_drawdown:.1%} - Emergency protocols active")
        
        # Close losing positions
        positions_closed = self._close_losing_positions()
        
        # Reduce all position sizes
        if not self.positions_reduced:
            self._reduce_all_positions()
            self.positions_reduced = True
            
        return f"EMERGENCY: Closed {positions_closed} losing positions, reduced all sizes"
        
    def _handle_recovery(self) -> str:
        """Handle recovery to normal levels"""
        self.response_active = False
        self.positions_reduced = False
        
        self.algo.Log(f"[DRAWDOWN RECOVERY] Portfolio recovered to {self.current_drawdown:.1%} drawdown")
        
        # Re-enable position opening
        if hasattr(self.algo, 'can_open_positions'):
            self.algo.can_open_positions = True
            
        # Reset position sizing
        if hasattr(self.algo, 'position_sizer'):
            self.algo.position_sizer.apply_drawdown_adjustment(1.0)  # Reset to normal
            
        # Reset profit targets
        if hasattr(self.algo, 'profit_target_manager'):
            self.algo.profit_target_manager.reset_targets()
            
        return "RECOVERY: Normal trading resumed"
        
    def _close_losing_positions(self) -> int:
        """Close positions with losses > TradingConstants.FULL_PERCENTAGE%"""
        positions_closed = 0
        
        if hasattr(self.algo, 'position_manager'):
            for position_id, position in self.algo.position_manager.positions.items():
                if position.status == "ACTIVE":
                    pnl_pct = position.get_pnl_percentage()
                    if pnl_pct < -TradingConstants.FULL_PERCENTAGE:  # Loss > TradingConstants.FULL_PERCENTAGE%
                        self.algo.Log(f"[EMERGENCY] Closing position {position_id} with {pnl_pct:.1f}% loss")
                        self.algo.position_manager.close_position(position_id, "EMERGENCY_DRAWDOWN")
                        positions_closed += 1
                        
        return positions_closed
        
    def _reduce_all_positions(self):
        """Reduce all position sizes by 50%"""
        if hasattr(self.algo, 'position_manager'):
            for position_id, position in self.algo.position_manager.positions.items():
                if position.status == "ACTIVE" and position.quantity > 1:
                    # Reduce by 50%
                    reduce_qty = position.quantity // 2
                    if reduce_qty > 0:
                        self.algo.Log(f"[EMERGENCY] Reducing position {position_id} by {reduce_qty} contracts")
                        # Execute reduction order
                        if hasattr(position, 'reduce_position'):
                            position.reduce_position(reduce_qty)
                            
    def should_allow_new_position(self) -> tuple[bool, str]:
        """Check if new positions are allowed based on drawdown"""
        if self.current_level == DrawdownLevel.NORMAL:
            return True, "Drawdown normal"
        elif self.current_level == DrawdownLevel.WARNING:
            return True, f"Drawdown warning ({self.current_drawdown:.1%}) - reduced sizing"
        elif self.current_level == DrawdownLevel.CRITICAL:
            return False, f"Drawdown critical ({self.current_drawdown:.1%}) - new positions blocked"
        else:  # EMERGENCY
            return False, f"Drawdown emergency ({self.current_drawdown:.1%}) - all new trades blocked"
            
    def get_position_size_multiplier(self) -> float:
        """Get position size adjustment based on drawdown"""
        if self.current_level == DrawdownLevel.NORMAL:
            return 1.0
        elif self.current_level == DrawdownLevel.WARNING:
            return 0.5  # 50% reduction
        elif self.current_level == DrawdownLevel.CRITICAL:
            return 0.25  # 75% reduction
        else:  # EMERGENCY
            return 0.0  # No new positions
            
    def get_drawdown_report(self) -> Dict:
        """Generate comprehensive drawdown report"""
        recovery_needed = 0.0
        if self.current_drawdown > 0 and self.peak_value > 0:
            current_value = self.peak_value * (1 - self.current_drawdown)
            recovery_needed = (self.peak_value - current_value) / current_value
            
        return {
            'current_drawdown': self.current_drawdown,
            'max_historical': self.max_historical_drawdown,
            'level': self.current_level.value,
            'peak_value': self.peak_value,
            'peak_date': self.peak_date,
            'days_in_drawdown': (self.algo.Time - self.peak_date).days if self.peak_date else 0,
            'recovery_needed': recovery_needed,
            'response_active': self.response_active,
            'positions_allowed': self.current_level == DrawdownLevel.NORMAL or self.current_level == DrawdownLevel.WARNING,
            'size_multiplier': self.get_position_size_multiplier(),
            'thresholds': self.thresholds,
            'recommendations': self._get_recommendations()
        }
        
    def _get_recommendations(self) -> List[str]:
        """Get action recommendations based on current state"""
        recommendations = []
        
        if self.current_level == DrawdownLevel.WARNING:
            recommendations.append("Consider reducing risk in new positions")
            recommendations.append("Tighten stop losses on existing positions")
            
        elif self.current_level == DrawdownLevel.CRITICAL:
            recommendations.append("Focus on preserving capital")
            recommendations.append("Take profits on winning positions early")
            recommendations.append("Avoid correlated positions")
            
        elif self.current_level == DrawdownLevel.EMERGENCY:
            recommendations.append("Close all losing positions immediately")
            recommendations.append("Reduce all position sizes")
            recommendations.append("Wait for market stabilization before re-entering")
            
        return recommendations