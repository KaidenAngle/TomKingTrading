# Correlation Risk Management Plugin
# Migrated from CorrelationManager and August2024CorrelationLimiter
# Implements plugin architecture for UnifiedRiskManager

from AlgorithmImports import *
from typing import Dict, List, Set, Optional, Any
from risk.unified_risk_manager import BaseRiskPlugin, RiskEvent, RiskEventType, RiskLevel
from datetime import datetime, timedelta
from core.unified_vix_manager import UnifiedVIXManager
from config.constants import TradingConstants


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class CorrelationPlugin(BaseRiskPlugin):
    """
    Correlation risk management plugin implementing Tom King's correlation limits.
    Migrated from CorrelationManager and August2024CorrelationLimiter.
    Preserves ALL August 5, 2024 safety lessons while using unified architecture.
    """
    
    @property
    def plugin_name(self) -> str:
        return "CorrelationRiskPlugin"
    
    @property
    def plugin_version(self) -> str:
        return "2.0.0"
    
    def _plugin_initialize(self) -> bool:
        """Initialize correlation risk management"""
        try:
        self.correlation_groups = {
        'A1': ['ES', 'MES', 'NQ', 'MNQ', 'RTY', 'M2K', 'YM', 'MYM'],  # Equity Indices
        'A2': ['SPY', 'QQQ', 'IWM', 'DIA'],  # Equity ETFs + IPMCC positions
        'B1': ['GC', 'MGC', 'GLD', 'TLT', 'ZB', 'ZN'],  # Safe Haven
        'B2': ['SI', 'SIL', 'SLV', 'HG', 'PL', 'PA'],  # Industrial Metals
        'C1': ['CL', 'MCL', 'QM', 'RB', 'HO', 'XLE', 'XOP'],  # Crude Complex
        'C2': ['NG'],  # Natural Gas
        'D1': ['ZC', 'ZS', 'ZW'],  # Grains
        'D2': ['LE', 'HE', 'GF'],  # Proteins
        'E': ['6E', '6B', '6A', '6C', 'M6E', 'M6A', 'DXY']  # Currencies
        }
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Tom King's correlation groups (exactly as original - CRITICAL_DO_NOT_CHANGE)
            
            # August 5, 2024 crisis correlation weights (NEVER CHANGE)
            self.crisis_correlation_weights = {
                'A1': 0.95,  # Equity Indices - Nearly perfect correlation during crashes
                'A2': 0.90,  # Equity ETFs - Very high correlation with indices
                'B1': -0.20, # Safe Haven - Inverse correlation (but can fail like TLT)
                'B2': 0.60,  # Industrial Metals - Moderate positive correlation
                'C1': 0.70,  # Crude Complex - High commodity correlation
                'C2': 0.65,  # Natural Gas - Independent but volatile
                'D1': 0.50,  # Grains - Moderate correlation
                'D2': 0.45,  # Proteins - Lower correlation
                'E': 0.30    # Currencies - Lowest correlation
            }
            
            # Track active positions by group
            self.active_positions_by_group = {}
            self.position_timestamps = {}  # Track when positions were opened
            
            # Phase-based limits (Tom King methodology)
            self.phase_limits = self._get_phase_limits()
            
            # VIX regime tracking
            self.current_vix = 20.0
            self.vix_regime = 'NORMAL'
            self.last_vix_update = self._algorithm.Time
            
            # Emergency controls
            self.bypass_attempts = []
            self.enforcement_enabled = True
            self.max_total_equity_positions = 3  # A1 + A2 combined
            
            # Performance tracking
            self.correlation_checks = 0
            self.blocked_positions = 0
            self.last_metrics_update = self._algorithm.Time
            
            return True
            
        except Exception as e:
            self._algorithm.Error(f"[Correlation Plugin] Initialization error: {e}")
            return False
    
    def _get_phase_limits(self) -> Dict[str, int]:
        """Get correlation limits based on Tom King phase system"""
        try:
            
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
account_value = float(self._algorithm.Portfolio.TotalPortfolioValue)
            
            # Import Tom King parameters for consistency
            from config.strategy_parameters import TomKingParameters
            phase = TomKingParameters.get_phase_for_account_size(account_value)
            
            # Phase-based limits (exactly as original)
            if phase == 0:  # MES-only accounts (under $40k)
                return {
                    'A1': 1, 'A2': 1, 'B1': 1, 'B2': 1,
                    'C1': 1, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 1
                }
            elif phase == 1:  # Phase 1 ($40k-55k): Foundation
                return {
                    'A1': 1, 'A2': 2, 'B1': 1, 'B2': 1,
                    'C1': 1, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 1
                }
            elif phase == 2:  # Phase 2 ($55k-75k): Growth
                return {
                    'A1': 2, 'A2': 2, 'B1': 2, 'B2': 1,
                    'C1': 2, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 2
                }
            elif phase == 3:  # Phase 3 ($75k-95k): Advanced
                return {
                    'A1': 2, 'A2': 3, 'B1': 2, 'B2': 2,
                    'C1': 2, 'C2': 1, 'D1': 2, 'D2': 1, 'E': 2
                }
            else:  # Phase 4 ($95k+): Professional
                return {
                    'A1': 3, 'A2': 3, 'B1': 2, 'B2': 2,
                    'C1': 3, 'C2': 2, 'D1': 2, 'D2': 2, 'E': 2
                }
                
        except Exception as e:
            self._algorithm.Error(f"[Correlation Plugin] Error getting phase limits: {e}")
            # Conservative fallback
            return {
                'A1': 1, 'A2': 1, 'B1': 1, 'B2': 1,
                'C1': 1, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 1
            }
    
    def can_open_position(self, symbol: str, quantity: int, 
                         context: Dict[str, Any] = None) -> tuple[bool, str]:
        """Check if position can be opened within correlation limits"""
        def _check():
            self.correlation_checks += 1
            
            # Update limits based on current account value
            self.phase_limits = self._get_phase_limits()
            
            # Get correlation group
            group = self._get_correlation_group(symbol)
            if not group:
                # Unknown symbols blocked by default (safety-first approach)
                self._algorithm.Debug(f"[Correlation Plugin] Unknown symbol {symbol} blocked")
                return False, f"Symbol {symbol} not in correlation groups - blocked for safety"
            
            # Check group-specific limit
            current_count = len(self.active_positions_by_group.get(group, []))
            max_allowed = self.phase_limits.get(group, 1)
            
            # VIX-based emergency reduction
            if self.current_vix > 30:
                max_allowed = max(1, max_allowed - 1)
                self._algorithm.Debug(f"[Correlation Plugin] VIX emergency reduction: {group} limit reduced to {max_allowed}")
            
            if current_count >= max_allowed:
                self.blocked_positions += 1
                return False, f"Group {group} at limit: {current_count}/{max_allowed}"
            
            # Check total equity exposure (A1 + A2 combined - CRITICAL RULE)
            if group in ['A1', 'A2']:
                total_equity = (len(self.active_positions_by_group.get('A1', [])) + 
                              len(self.active_positions_by_group.get('A2', [])))
                
                if total_equity >= self.max_total_equity_positions:
                    self.blocked_positions += 1
                    return False, f"Total equity exposure at limit: {total_equity}/{self.max_total_equity_positions}"
            
            # Check for conflicting positions (opposite directions)
            conflict = self._check_position_conflicts(symbol, group, quantity)
            if conflict:
                self.blocked_positions += 1
                return False, f"Position conflicts with {conflict}"
            
            return True, f"Correlation check passed for group {group} ({current_count + 1}/{max_allowed})"
        
        return self._safe_execute("can_open_position", _check)
    
    def on_position_opened(self, symbol: str, quantity: int, 
                          fill_price: float, context: Dict[str, Any] = None):
        """Register new position in correlation tracking"""
        def _register():
            group = self._get_correlation_group(symbol)
            if group:
                if group not in self.active_positions_by_group:
                    self.active_positions_by_group[group] = []
                
                self.active_positions_by_group[group].append(symbol)
                self.position_timestamps[str(symbol)] = self._algorithm.Time
                
                self._algorithm.Debug(
                    f"[Correlation Plugin] Position registered: {symbol} in group {group} "
                    f"({len(self.active_positions_by_group[group])}/{self.phase_limits.get(group, 1)})"
                )
                
                # Check if we're approaching dangerous concentration
                self._check_concentration_warnings()
        
        self._safe_execute("on_position_opened", _register)
    
    def on_position_closed(self, symbol: str, quantity: int, 
                          fill_price: float, pnl: float, context: Dict[str, Any] = None):
        """Remove position from correlation tracking"""
        def _unregister():
            group = self._get_correlation_group(symbol)
            if group and group in self.active_positions_by_group:
                if symbol in self.active_positions_by_group[group]:
                    self.active_positions_by_group[group].remove(symbol)
                    
                    if str(symbol) in self.position_timestamps:
                        del self.position_timestamps[str(symbol)]
                    
                    # Clean up empty groups
                    if not self.active_positions_by_group[group]:
                        del self.active_positions_by_group[group]
                    
                    self._algorithm.Debug(
                        f"[Correlation Plugin] Position unregistered: {symbol} from group {group}"
                    )
        
        self._safe_execute("on_position_closed", _unregister)
    
    def on_market_data(self, symbol: str, data: Any):
        """Update VIX data for regime detection"""
        def _update_vix():
            if str(symbol) == 'VIX':
                self.current_vix = data.Price if hasattr(data, 'Price') else data
                self.last_vix_update = self._algorithm.Time
                
                # Update VIX regime
                old_regime = self.vix_regime
                if self.current_vix >= 40:
                    self.vix_regime = 'PANIC'
                elif self.current_vix >= 30:
                    self.vix_regime = 'HIGH'
                elif self.current_vix >= 25:
                    self.vix_regime = 'ELEVATED'
                elif self.current_vix >= 15:
                    self.vix_regime = 'NORMAL'
                else:
                    self.vix_regime = 'LOW'
                
                # Emit event on regime change
                if old_regime != self.vix_regime:
                    self._emit_event(
                        RiskEventType.VIX_EMERGENCY if self.vix_regime == 'PANIC' else RiskEventType.CORRELATION_LIMIT_EXCEEDED,
                        RiskLevel.CRITICAL if self.vix_regime in ['PANIC', 'HIGH'] else RiskLevel.WARNING,
                        f"VIX regime change: {old_regime} -> {self.vix_regime} (VIX: {self.current_vix:.1f})",
                        {'old_regime': old_regime, 'new_regime': self.vix_regime, 'vix': self.current_vix}
                    )
        
        self._safe_execute("on_market_data", _update_vix)
    
    def periodic_check(self) -> List[RiskEvent]:
        """Perform periodic correlation risk checks"""
        def _periodic_check():
            events = []
            
            # Update position tracking from portfolio
            self._sync_positions_with_portfolio()
            
            # Calculate risk score
            risk_score = self._calculate_correlation_risk_score()
            
            # Check for dangerous concentrations
            if risk_score > 80:
                events.append(RiskEvent(
                    RiskEventType.CORRELATION_LIMIT_EXCEEDED,
                    RiskLevel.CRITICAL,
                    f"High correlation risk: {risk_score:.1f}/100",
                    {'risk_score': risk_score, 'active_groups': list(self.active_positions_by_group.keys())}
                ))
            elif risk_score > 60:
                events.append(RiskEvent(
                    RiskEventType.CORRELATION_LIMIT_EXCEEDED,
                    RiskLevel.WARNING,
                    f"Elevated correlation risk: {risk_score:.1f}/100",
                    {'risk_score': risk_score}
                ))
            
            # Check for VIX emergency conditions
            if self.current_vix > 40:
                events.append(RiskEvent(
                    RiskEventType.VIX_EMERGENCY,
                    RiskLevel.EMERGENCY,
                    f"VIX emergency level: {self.current_vix:.1f}",
                    {'vix': self.current_vix, 'regime': self.vix_regime}
                ))
            
            # Clean up old bypass attempts
            self._clean_bypass_attempts()
            
            return events
        
        return self._safe_execute("periodic_check", _periodic_check) or []
    
    def get_risk_metrics(self) -> Dict[str, Any]:
        """Get correlation risk metrics"""
        def _get_metrics():
            total_positions = sum(len(positions) for positions in self.active_positions_by_group.values())
            
            return {
                'risk_score': self._calculate_correlation_risk_score(),
                'active_groups': len(self.active_positions_by_group),
                'total_positions': total_positions,
                'positions_by_group': {
                    group: len(positions) 
                    for group, positions in self.active_positions_by_group.items()
                },
                'group_limits': self.phase_limits,
                'vix_regime': self.vix_regime,
                'current_vix': self.current_vix,
                'equity_exposure': {
                    'A1_positions': len(self.active_positions_by_group.get('A1', [])),
                    'A2_positions': len(self.active_positions_by_group.get('A2', [])),
                    'total_equity': (len(self.active_positions_by_group.get('A1', [])) + 
                                   len(self.active_positions_by_group.get('A2', [])))
                },
                'performance': {
                    'correlation_checks': self.correlation_checks,
                    'blocked_positions': self.blocked_positions,
                    'block_rate': (self.blocked_positions / max(1, self.correlation_checks)) * 100
                },
                'security': {
                    'bypass_attempts': len(self.bypass_attempts),
                    'enforcement_enabled': self.enforcement_enabled
                }
            }
        
        return self._safe_execute("get_risk_metrics", _get_metrics) or {}
    
    def _get_correlation_group(self, symbol: str) -> Optional[str]:
        """Get correlation group for symbol"""
        symbol_str = str(symbol).upper().replace(' ', '')
        
        for group_name, symbols in self.correlation_groups.items():
            if symbol_str in [s.upper() for s in symbols]:
                return group_name
        
        return None
    
    def _check_position_conflicts(self, symbol: str, group: str, quantity: int) -> Optional[str]:
        """Check for conflicting positions (opposite directions)"""
        # For equity groups, check for opposing directions
        if group in ['A1', 'A2'] and quantity != 0:
            # Check if we have opposing positions in equity groups
            for existing_group in ['A1', 'A2']:
                if existing_group in self.active_positions_by_group:
                    positions = self.active_positions_by_group[existing_group]
                    if positions:
                        # Simplified conflict check - in practice would need position direction info
                        # For now, just warn about potential conflicts
                        if len(positions) >= 2:  # If already have 2+ equity positions
                            return f"Multiple equity positions (potential conflict risk)"
        
        return None
    
    def _check_concentration_warnings(self):
        """Check for dangerous concentration and emit warnings"""
        total_positions = sum(len(positions) for positions in self.active_positions_by_group.values())
        
        # Warning if >70% in highly correlated groups
        high_correlation_positions = (
            len(self.active_positions_by_group.get('A1', [])) + 
            len(self.active_positions_by_group.get('A2', []))
        )
        
        if total_positions > 0 and high_correlation_positions / total_positions > 0.7:
            self._emit_event(
                RiskEventType.CORRELATION_LIMIT_EXCEEDED,
                RiskLevel.WARNING,
                f"High equity concentration: {high_correlation_positions}/{total_positions} positions",
                {
                    'equity_percentage': (high_correlation_positions / total_positions) * 100,
                    'equity_positions': high_correlation_positions,
                    'total_positions': total_positions
                }
            )
    
    def _calculate_correlation_risk_score(self) -> float:
        """Calculate correlation risk score (0-100)"""
        if not self.active_positions_by_group:
            return 0.0
        
        total_positions = sum(len(positions) for positions in self.active_positions_by_group.values())
        if total_positions == 0:
            return 0.0
        
        risk_score = 0.0
        
        # Concentration risk in high-correlation groups
        for group, positions in self.active_positions_by_group.items():
            group_weight = abs(self.crisis_correlation_weights.get(group, 0.5))
            group_concentration = len(positions) / total_positions
            risk_score += group_concentration * group_weight * 50
        
        # Equity concentration penalty
        equity_positions = (len(self.active_positions_by_group.get('A1', [])) + 
                          len(self.active_positions_by_group.get('A2', [])))
        if total_positions > 0:
            equity_ratio = equity_positions / total_positions
            risk_score += equity_ratio * 30
        
        # VIX regime multiplier
        vix_multipliers = {
            'LOW': 0.8,
            'NORMAL': 1.0,
            'ELEVATED': 1.2,
            'HIGH': 1.5,
            'PANIC': 2.0
        }
        risk_score *= vix_multipliers.get(self.vix_regime, 1.0)
        
        # Diversity bonus
        unique_groups = len(self.active_positions_by_group)
        if unique_groups > 3:
            risk_score *= 0.8
        
        return min(100.0, max(0.0, risk_score))
    
    def _sync_positions_with_portfolio(self):
        """Sync position tracking with actual portfolio positions"""
        try:
        actual_symbols = set()
        for holding in self._algorithm.Portfolio.Values:
        if holding.Invested:
        actual_symbols.add(holding.Symbol)
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Get actual positions from portfolio
            
            # Remove tracking for positions that no longer exist
            for group, positions in list(self.active_positions_by_group.items()):
                for symbol in list(positions):
                    if symbol not in actual_symbols:
                        positions.remove(symbol)
                        if str(symbol) in self.position_timestamps:
                            del self.position_timestamps[str(symbol)]
                        self._algorithm.Debug(
                            f"[Correlation Plugin] Removed stale position tracking: {symbol}"
                        )
                
                # Clean up empty groups
                if not positions:
                    del self.active_positions_by_group[group]
            
            # Add tracking for new positions (may have missed during crashes)
            for symbol in actual_symbols:
                group = self._get_correlation_group(symbol)
                if group:
                    if group not in self.active_positions_by_group:
                        self.active_positions_by_group[group] = []
                    
                    if symbol not in self.active_positions_by_group[group]:
                        self.active_positions_by_group[group].append(symbol)
                        self.position_timestamps[str(symbol)] = self._algorithm.Time
                        self._algorithm.Debug(
                            f"[Correlation Plugin] Added missing position tracking: {symbol}"
                        )
            
        except Exception as e:
            self._algorithm.Error(f"[Correlation Plugin] Error syncing positions: {e}")
    
    def _clean_bypass_attempts(self):
        """Clean up old bypass attempts (security tracking)"""
        cutoff_time = self._algorithm.Time - timedelta(hours=24)
        self.bypass_attempts = [
            attempt for attempt in self.bypass_attempts
            if attempt.get('timestamp', self._algorithm.Time) > cutoff_time
        ]
    
    def ShouldDefend(self, position_info: Dict) -> bool:
        """
        BACKWARD COMPATIBILITY: Check if position needs defensive action at TradingConstants.DEFENSIVE_EXIT_DTE DTE
        Tom King's absolute rule - NO CONDITIONS, NO EXCEPTIONS
        """
        def _check_defense():
            days_to_expiry = position_info.get('dte', 999)
            
            # Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE rule - ABSOLUTE RULE
            if days_to_expiry <= 21:
                self._algorithm.Log(f"[Correlation Plugin] TradingConstants.DEFENSIVE_EXIT_DTE DTE absolute defense triggered for {position_info.get('symbol', 'UNKNOWN')} (DTE: {days_to_expiry})")
                return True
                
            return False
        
        return self._safe_execute("ShouldDefend", _check_defense) or False
    
    def shutdown(self):
        """Clean shutdown of correlation plugin"""
        self._algorithm.Log(
            f"[Correlation Plugin] Shutdown: {self.correlation_checks} checks, "
            f"{self.blocked_positions} blocks, "
            f"{len(self.active_positions_by_group)} active groups"
        )