# region imports
from AlgorithmImports import *
from typing import Dict, List, Tuple, Optional
# endregion

class August2024CorrelationLimiter:
    """
    Tom King Correlation Group Management System
    Prevents overconcentration based on historical disaster analysis (August 5, 2024)
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Correlation Groups - Based on August 5, 2024 lessons
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
        
        # Dynamic position limits that scale with account size
        self.group_limits = self._get_dynamic_limits()
        
        # August 5, 2024 crisis correlation analysis
        self.crisis_correlation_weights = {
            'A1': 0.95,  # Equity Indices - Nearly perfect correlation during crashes
            'A2': 0.90,  # Equity ETFs - Very high correlation with indices
            'B1': -0.20, # Safe Haven - Inverse correlation (but can fail like TLT)
            'B2': 0.60,  # Industrial Metals - Moderate positive correlation
            'C1': 0.70,  # Crude Complex - High commodity correlation
            'C2': 0.65,  # Natural Gas - Independent but volatile
            'D1': 0.50,  # Grains - Moderate correlation
            'D2': 0.45,  # Proteins - Lower correlation
            'E': 0.30    # Currencies - Lowest correlation (flight to safety varies)
        }
        
        self.active_positions_by_group = {}
        self.correlation_warnings = []
        self.last_analysis_time = None
        
        # CRITICAL FIX: Add enforcement tracking
        self.bypass_attempts = []
        self.enforcement_enabled = True
        self.override_password = None  # Only for emergency
    
    def _get_dynamic_limits(self):
        """Get position limits that scale with account size using Tom King phase system"""
        account_value = float(self.algorithm.Portfolio.TotalPortfolioValue)
        
        # Import TomKingParameters for consistency
        from config.strategy_parameters import TomKingParameters
        account_phase = TomKingParameters.get_phase_for_account_size(account_value)
        
        # Phase-based correlation limits aligned with Tom King methodology
        if account_phase == 0:  # MES-only accounts (under $40k)
            return {
                'A1': 1, 'A2': 1, 'B1': 1, 'B2': 1,
                'C1': 1, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 1
            }
        elif account_phase == 1:  # Phase 1 ($40k-55k): Foundation
            return {
                'A1': 1, 'A2': 2, 'B1': 1, 'B2': 1,
                'C1': 1, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 1
            }
        elif account_phase == 2:  # Phase 2 ($55k-75k): Growth
            return {
                'A1': 2, 'A2': 2, 'B1': 2, 'B2': 1,
                'C1': 2, 'C2': 1, 'D1': 1, 'D2': 1, 'E': 2
            }
        elif account_phase == 3:  # Phase 3 ($75k-95k): Advanced
            return {
                'A1': 2, 'A2': 3, 'B1': 2, 'B2': 2,
                'C1': 2, 'C2': 1, 'D1': 2, 'D2': 1, 'E': 2
            }
        else:  # Phase 4 ($95k+): Professional
            return {
                'A1': 3, 'A2': 3, 'B1': 2, 'B2': 2,
                'C1': 3, 'C2': 2, 'D1': 2, 'D2': 2, 'E': 2
            }
    
    def get_correlation_group(self, symbol):
        """Identify which correlation group a symbol belongs to"""
        symbol_str = str(symbol).upper().replace(' ', '')
        
        for group_name, symbols in self.correlation_groups.items():
            if symbol_str in [s.upper() for s in symbols]:
                return group_name
        
        # For debugging - track uncategorized symbols
        if symbol_str not in getattr(self, '_logged_uncategorized', set()):
            self.algo.Debug(f"Symbol {symbol_str} not found in correlation groups")
            if not hasattr(self, '_logged_uncategorized'):
                self._logged_uncategorized = set()
            self._logged_uncategorized.add(symbol_str)
        return None
    
    def update_active_positions(self, portfolio_positions):
        """Update tracking of active positions by correlation group"""
        self.active_positions_by_group = {}
        
        for position in portfolio_positions:
            if position.Quantity != 0:
                symbol = position.Symbol
                group = self.get_correlation_group(symbol)
                
                if group:
                    if group not in self.active_positions_by_group:
                        self.active_positions_by_group[group] = []
                    self.active_positions_by_group[group].append(symbol)
    
    def can_add_to_group(self, symbol, account_phase, bypass_check=False):
        """Check if we can add another position to a correlation group"""
        
        # CRITICAL FIX: Track and prevent bypass attempts
        if bypass_check:
            self.bypass_attempts.append({
                'timestamp': self.algorithm.Time,
                'symbol': symbol,
                'account_phase': account_phase
            })
            
            # Log bypass attempt
            self.algorithm.Error(f"SECURITY: Correlation bypass attempted for {symbol}")
            
            # Only allow bypass in manual mode with password
            if not self._is_emergency_override_valid():
                return False, "Bypass denied - security violation", 0, 0
        
        group = self.get_correlation_group(symbol)
        
        if not group:
            # CRITICAL FIX: Unknown symbols should be blocked by default
            self.algorithm.Log(f"WARNING: Unknown symbol {symbol} - blocking by default")
            return False, "Symbol not in correlation groups - blocked", 0, 0
        
        # Update limits based on current account value
        self.group_limits = self._get_dynamic_limits()
        
        current_count = len(self.active_positions_by_group.get(group, []))
        max_allowed = self.group_limits.get(group, 1)
        
        # During high VIX (>30), reduce all limits by 1
        if hasattr(self.algorithm, 'vix_manager') and self.algorithm.vix_manager.current_vix:
            if self.algorithm.vix_manager.current_vix > 30:
                max_allowed = max(1, max_allowed - 1)
        
        if current_count >= max_allowed:
            return False, f"Group {group} at limit", current_count, max_allowed
        
        # Check total equity exposure (A1 + A2 combined)
        if group in ['A1', 'A2']:
            total_equity = len(self.active_positions_by_group.get('A1', [])) + \
                          len(self.active_positions_by_group.get('A2', []))
            if total_equity >= 3:  # Max 3 total equity positions
                return False, "Total equity exposure at limit", total_equity, 3
        
        return True, "Position allowed", current_count, max_allowed
    
    def get_correlation_risk_score(self):
        """Calculate overall portfolio correlation risk (0-100)"""
        if not self.active_positions_by_group:
            self.algo.Debug("No active positions for correlation risk calculation")
            return 0
        
        total_positions = sum(len(positions) for positions in self.active_positions_by_group.values())
        
        risk_score = 0
        
        # Concentration risk (too many in one group)
        for group, positions in self.active_positions_by_group.items():
            group_concentration = len(positions) / total_positions
            group_weight = self.crisis_correlation_weights.get(group, 0.5)
            risk_score += group_concentration * abs(group_weight) * 50
        
        # Correlation risk (highly correlated groups)
        equity_positions = len(self.active_positions_by_group.get('A1', [])) + \
                          len(self.active_positions_by_group.get('A2', []))
        
        if equity_positions > 0:
            equity_concentration = equity_positions / total_positions
            risk_score += equity_concentration * 30
        
        # Diversity bonus (reduce risk if well diversified)
        unique_groups = len(self.active_positions_by_group)
        if unique_groups > 3:
            risk_score *= 0.8
        
        return min(100, max(0, risk_score))
    
    def get_correlation_summary(self, account_phase):
        """Get comprehensive correlation analysis summary"""
        risk_score = self.get_correlation_risk_score()
        
        summary = {
            'risk_score': risk_score,
            'groups_used': list(self.active_positions_by_group.keys()),
            'total_positions': sum(len(p) for p in self.active_positions_by_group.values()),
            'warnings': [],
            'opportunities': []
        }
        
        # Generate warnings
        if risk_score > 70:
            summary['warnings'].append("HIGH CORRELATION RISK - Consider diversification")
        
        # Check for overconcentration
        for group, positions in self.active_positions_by_group.items():
            if len(positions) >= self.group_limits.get(group, 1):
                summary['warnings'].append(f"Group {group} at maximum capacity")
        
        # Identify opportunities
        unused_groups = set(self.correlation_groups.keys()) - set(self.active_positions_by_group.keys())
        if unused_groups:
            low_correlation_groups = [g for g in unused_groups 
                                     if abs(self.crisis_correlation_weights.get(g, 0.5)) < 0.5]
            if low_correlation_groups:
                summary['opportunities'].append(f"Low correlation groups available: {', '.join(low_correlation_groups)}")
        
        return summary
    
    def enforce_correlation_limits(self, symbol, account_phase, force_check=True):
        """Enforce correlation limits before position entry"""
        
        # CRITICAL FIX: Always enforce unless explicitly disabled
        if not self.enforcement_enabled and not force_check:
            self.algorithm.Error("CRITICAL: Correlation enforcement disabled!")
            # Re-enable immediately
            self.enforcement_enabled = True
            
        can_add, reason, current, max_allowed = self.can_add_to_group(symbol, account_phase)
        
        if not can_add:
            self.algorithm.Log(f"CORRELATION LIMIT BLOCKED: {symbol} - {reason}")
            
            # CRITICAL FIX: Notify risk management system
            if hasattr(self.algorithm, 'manual_mode'):
                if len(self.bypass_attempts) >= 3:
                    self.algorithm.manual_mode.activate_manual_mode(
                        f"Multiple correlation bypass attempts detected"
                    )
            
            return False, f"Blocked: {reason}"
        
        return True, f"Allowed: {current}/{max_allowed} in group"
    
    def calculate_crisis_portfolio_var(self):
        """Calculate portfolio VaR using August 5, 2024 correlation matrix"""
        if not self.active_positions_by_group:
            self.algo.Debug("No positions for VaR calculation")
            return 0
        
        # Simplified VaR calculation
        portfolio_var = 0
        
        for group, positions in self.active_positions_by_group.items():
            group_weight = self.crisis_correlation_weights.get(group, 0.5)
            position_count = len(positions)
            
            # Assume 5% individual VaR, scaled by correlation
            group_var = 0.05 * position_count * abs(group_weight)
            portfolio_var += group_var
        
        # Correlation adjustment
        unique_groups = len(self.active_positions_by_group)
        if unique_groups > 1:
            portfolio_var *= (1 - 0.1 * min(unique_groups - 1, 3))  # Diversification benefit
        
        return portfolio_var
    
    def _is_emergency_override_valid(self) -> bool:
        """Check if emergency override is valid (only for critical situations)"""
        
        # Check if manual mode is active
        if hasattr(self.algorithm, 'manual_mode'):
            if not self.algorithm.manual_mode.is_manual_mode:
                return False
        
        # Check if override password is set (would be set by admin)
        if self.override_password != "EMERGENCY_OVERRIDE_2024":
            return False
            
        # Log emergency override
        self.algorithm.Error("EMERGENCY: Correlation limits overridden")
        
        # Reset password after use
        self.override_password = None
        
        return True
    
    def reset_bypass_tracking(self):
        """Reset bypass attempt tracking"""
        
        # Clear old attempts (older than 1 hour)
        current_time = self.algorithm.Time
        self.bypass_attempts = [
            attempt for attempt in self.bypass_attempts
            if (current_time - attempt['timestamp']).total_seconds() < TradingConstants.SECONDS_PER_HOUR
        ]
    
    def get_security_status(self) -> Dict:
        """Get correlation enforcement security status"""
        
        return {
            'enforcement_enabled': self.enforcement_enabled,
            'bypass_attempts': len(self.bypass_attempts),
            'recent_bypasses': self.bypass_attempts[-5:] if self.bypass_attempts else [],
            'groups_at_limit': [
                group for group, positions in self.active_positions_by_group.items()
                if len(positions) >= self.group_limits.get(group, 1)
            ],
            'risk_score': self.get_correlation_risk_score()
        }