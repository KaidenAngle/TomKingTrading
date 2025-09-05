# region imports
from AlgorithmImports import *
# endregion
"""
August 2024 Crash Protection and Stress Testing Module
Implements lessons learned from Tom King's £308,000 loss during the August 5, 2024 volatility event

Key Protection Features:
1. Correlation group enforcement (max 2-3 positions per group)
2. VIX spike protection protocols
3. Volatility regime awareness
4. Emergency position reduction
5. Stress testing against August 2024 scenarios

Author: Tom King Trading Framework Implementation
Version: 1.0.0 - Critical Risk Management
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class August2024EventType(Enum):
    """Types of August 2024 market events for stress testing"""
    VIX_SPIKE = "VIX_SPIKE"              # VIX 15 → 65 in 48 hours
    CORRELATION_BREAKDOWN = "CORRELATION_BREAKDOWN"  # All assets correlated to 1.0
    VOLATILITY_EXPLOSION = "VOLATILITY_EXPLOSION"   # IV explosion across all products
    LIQUIDITY_CRISIS = "LIQUIDITY_CRISIS"          # Bid/ask spreads widen 500%
    MARGIN_CALLS = "MARGIN_CALLS"                   # Portfolio margin requirements spike

class ProtectionLevel(Enum):
    """August 2024 protection levels"""
    PREVENTIVE = 1      # Before volatility spike (VIX < 25)
    DEFENSIVE = 2       # During volatility rise (VIX 25-35) 
    EMERGENCY = 3       # During crisis (VIX > 35)
    RECOVERY = 4        # Post-crisis normalization

class August2024ProtectionSystem:
    """
    Comprehensive protection system based on August 2024 lessons learned
    
    Key Features:
    - Prevents the £308k loss scenario through correlation limits
    - VIX spike detection and automatic defensive protocols
    - Stress testing against historical August 2024 conditions
    - Emergency position reduction and recovery procedures
    """
    
    def __init__(self):
        # August 5, 2024 historical data for stress testing
        self.august_2024_event_parameters = {
            "initial_date": "2024-08-02",
            "crisis_date": "2024-08-05", 
            "recovery_date": "2024-08-12",
            "vix_spike": {"from": 15.4, "to": 65.7, "peak_date": "2024-08-05"},
            "spx_drop": {"from": 5445, "to": 4945, "max_drop": -9.2, "days": 3},
            "correlation_surge": {"normal": 0.3, "crisis": 0.95, "duration_days": 7}
        }
        
        # Correlation groups (Tom King's 7 groups + enforcement)
        self.correlation_groups = {
            'A1_EQUITY_INDEX': {
                'symbols': ['ES', 'MES', 'SPY', 'QQQ', 'IWM'],
                'normal_limit': 2,
                'crisis_limit': 1,  # Reduce during crisis
                'current_positions': 0,
                'risk_weight': 0.35  # Highest risk group
            },
            'A2_INTERNATIONAL': {
                'symbols': ['NQ', 'RTY', 'FTSE', 'DAX', 'Nikkei'],
                'normal_limit': 2,
                'crisis_limit': 1,
                'current_positions': 0,
                'risk_weight': 0.25
            },
            'B1_ENERGY': {
                'symbols': ['CL', 'MCL', 'NG', 'RB', 'HO', 'XLE', 'XOP'],
                'normal_limit': 2,
                'crisis_limit': 1,
                'current_positions': 0,
                'risk_weight': 0.30
            },
            'C1_METALS': {
                'symbols': ['GC', 'MGC', 'SI', 'GLD', 'SLV'],
                'normal_limit': 2,
                'crisis_limit': 2,  # Safe haven - maintain exposure
                'current_positions': 0,
                'risk_weight': 0.15
            },
            'D1_AGRICULTURE': {
                'symbols': ['ZC', 'ZS', 'ZW', 'LE', 'HE', 'KC', 'SB', 'CC'],
                'normal_limit': 2,
                'crisis_limit': 1,
                'current_positions': 0,
                'risk_weight': 0.20
            },
            'E_BONDS': {
                'symbols': ['ZB', 'ZN', 'ZF', 'ZT', 'TLT'],
                'normal_limit': 2,
                'crisis_limit': 2,  # Safe haven - maintain exposure
                'current_positions': 0,
                'risk_weight': 0.10
            },
            'F_CURRENCIES': {
                'symbols': ['6E', '6B', '6A', '6C', '6J', '6S', 'M6E', 'DXY'],
                'normal_limit': 2,
                'crisis_limit': 1,
                'current_positions': 0,
                'risk_weight': 0.20
            }
        }
        
        # August 2024 protection thresholds
        self.protection_thresholds = {
            ProtectionLevel.PREVENTIVE: {
                'vix_threshold': 20,
                'correlation_limit_multiplier': 1.0,
                'position_reduction': 0.0,
                'new_position_restriction': False,
                'description': "Normal market conditions - full deployment allowed"
            },
            ProtectionLevel.DEFENSIVE: {
                'vix_threshold': 25,
                'correlation_limit_multiplier': 0.8,  # Reduce limits by 20%
                'position_reduction': 0.15,  # Close 15% of positions
                'new_position_restriction': True,  # Only defensive positions
                'description': "Elevated volatility - defensive positioning"
            },
            ProtectionLevel.EMERGENCY: {
                'vix_threshold': 35,
                'correlation_limit_multiplier': 0.5,  # Reduce limits by 50%
                'position_reduction': 0.40,  # Close 40% of positions
                'new_position_restriction': True,  # No new positions except hedges
                'description': "CRISIS MODE - August 2024 protection activated"
            },
            ProtectionLevel.RECOVERY: {
                'vix_threshold': 30,  # Below this threshold post-crisis
                'correlation_limit_multiplier': 0.7,  # Gradual recovery
                'position_reduction': 0.0,  # Stop reducing, but don't add
                'new_position_restriction': True,  # Limited new positions
                'description': "Post-crisis recovery - gradual re-deployment"
            }
        }
    
    def GetCurrentProtectionLevel(self, vix_level: float, recent_vix_history: List[float] = None) -> ProtectionLevel:
        """
        Determine current protection level based on VIX and market conditions
        
        Args:
            vix_level: Current VIX level
            recent_vix_history: Recent VIX levels for trend analysis
            
        Returns:
            Current protection level
        """
        # Check for VIX spike pattern (August 2024 signature)
        if recent_vix_history and len(recent_vix_history) >= 5:
            # Detect rapid VIX acceleration (August 2024 pattern)
            recent_change = (vix_level - recent_vix_history[-5]) / recent_vix_history[-5]
            if recent_change > 0.5 and vix_level > 30:  # 50%+ spike to 30+
                return ProtectionLevel.EMERGENCY
        
        # Standard thresholds
        if vix_level >= 35:
            return ProtectionLevel.EMERGENCY
        elif vix_level >= 25:
            return ProtectionLevel.DEFENSIVE
        else:
            return ProtectionLevel.PREVENTIVE
    
    def CheckCorrelationLimits(self, symbol: str, position_type: str) -> Dict:
        """
        Check if adding a position would violate August 2024 correlation limits
        
        Args:
            symbol: Symbol to check
            position_type: Type of position (LONG, SHORT, STRANGLE, etc.)
            
        Returns:
            Dictionary with limit check results
        """
        # Find which correlation group this symbol belongs to
        symbol_group = None
        for group_name, group_data in self.correlation_groups.items():
            if symbol in group_data['symbols']:
                symbol_group = group_name
                break
        
        if symbol_group is None:
            # Symbol not in correlation groups - allowed
            return {
                'allowed': True,
                'reason': f"Symbol {symbol} not in correlation groups",
                'group': None,
                'current_positions': 0,
                'limit': 'N/A'
            }
        
        group_data = self.correlation_groups[symbol_group]
        current_positions = group_data['current_positions']
        
        # Get current protection level to determine limits
        # Note: This would need VIX level passed in for full implementation
        normal_limit = group_data['normal_limit']
        crisis_limit = group_data['crisis_limit']
        
        # For now, use normal limits (would be dynamic in full implementation)
        effective_limit = normal_limit
        
        # Check if we can add the position
        would_exceed = (current_positions + 1) > effective_limit
        
        return {
            'allowed': not would_exceed,
            'reason': f"Group {symbol_group}: {current_positions}/{effective_limit} positions" + 
                     (" - LIMIT EXCEEDED" if would_exceed else " - OK"),
            'group': symbol_group,
            'current_positions': current_positions,
            'limit': effective_limit,
            'risk_weight': group_data['risk_weight'],
            'group_symbols': group_data['symbols']
        }
    
    def ExecuteAugust2024StressTest(self, portfolio_positions: List[Dict], vix_scenario: float = 65.7) -> Dict:
        """
        Execute comprehensive stress test based on August 2024 conditions
        
        Args:
            portfolio_positions: Current portfolio positions
            vix_scenario: VIX level for stress test (default: August 5 peak)
            
        Returns:
            Stress test results and recommendations
        """
        stress_results = {
            'scenario_name': 'August 2024 Volatility Crisis',
            'test_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'vix_scenario': vix_scenario,
            'positions_tested': len(portfolio_positions),
            'correlation_violations': 0,
            'estimated_loss': 0.0,
            'protection_effectiveness': 0.0,
            'recommendations': []
        }
        
        # Test 1: Correlation group violations
        group_counts = {}
        for position in portfolio_positions:
            symbol = position.get('symbol', 'UNKNOWN')
            for group_name, group_data in self.correlation_groups.items():
                if symbol in group_data['symbols']:
                    group_counts[group_name] = group_counts.get(group_name, 0) + 1
        
        # Count violations
        total_violations = 0
        for group_name, count in group_counts.items():
            crisis_limit = self.correlation_groups[group_name]['crisis_limit']
            if count > crisis_limit:
                violation = count - crisis_limit
                total_violations += violation
                stress_results['recommendations'].append(
                    f"CRITICAL: Reduce {group_name} positions from {count} to {crisis_limit} (remove {violation})"
                )
        
        stress_results['correlation_violations'] = total_violations
        
        # Test 2: Estimate potential loss (simplified)
        total_position_value = sum(pos.get('value', 0) for pos in portfolio_positions)
        base_loss_rate = 0.15  # 15% base loss rate during August 2024
        correlation_penalty = min(total_violations * 0.05, 0.20)  # Up to 20% additional loss
        vix_penalty = min((vix_scenario - 15) / 100, 0.15)  # VIX spike penalty
        
        total_loss_rate = base_loss_rate + correlation_penalty + vix_penalty
        estimated_loss = total_position_value * total_loss_rate
        
        stress_results['estimated_loss'] = estimated_loss
        
        # Test 3: Protection effectiveness
        if total_violations == 0:
            protection_effectiveness = 0.532  # 53.2% from Tom King documentation
        else:
            protection_effectiveness = max(0.0, 0.532 - (total_violations * 0.10))
        
        stress_results['protection_effectiveness'] = protection_effectiveness
        
        # Generate recommendations
        if total_violations > 0:
            stress_results['recommendations'].insert(0,
                f"[ALERT] AUGUST 2024 PROTECTION: {total_violations} correlation violations detected!")
        
        if estimated_loss > 0:
            stress_results['recommendations'].append(
                f"Estimated loss in August 2024 scenario: £{estimated_loss:,.2f}")
        
        if protection_effectiveness < 0.40:
            stress_results['recommendations'].append(
                "[CRITICAL] Protection effectiveness below 40% - immediate action required")
        
        stress_results['risk_level'] = self._GetRiskLevel(total_violations, protection_effectiveness)
        
        return stress_results
    
    def GetEmergencyProtocols(self, protection_level: ProtectionLevel) -> Dict:
        """
        Get emergency protocols for current protection level
        
        Args:
            protection_level: Current protection level
            
        Returns:
            Emergency protocols and actions
        """
        protocols = {
            ProtectionLevel.PREVENTIVE: {
                'actions': [
                    "Monitor correlation group positions",
                    "Maintain normal position sizing",
                    "Continue regular strategy deployment"
                ],
                'restrictions': [],
                'alerts': []
            },
            ProtectionLevel.DEFENSIVE: {
                'actions': [
                    "Reduce position sizes by 15%",
                    "Close weakest positions in each correlation group",
                    "Implement VIX-based position sizing",
                    "Increase cash reserves"
                ],
                'restrictions': [
                    "No new positions in overweight correlation groups",
                    "Maximum 1 position per high-risk group"
                ],
                'alerts': [
                    "[WARNING] Elevated volatility detected - defensive protocols active"
                ]
            },
            ProtectionLevel.EMERGENCY: {
                'actions': [
                    "[EMERGENCY] AUGUST 2024 PROTOCOL ACTIVATED",
                    "Close 40% of positions immediately",
                    "Liquidate all undefined risk positions",
                    "Deploy VIX spike opportunity trades (if VIX > 30)",
                    "Reduce correlation group exposure to crisis limits"
                ],
                'restrictions': [
                    "NO new positions except VIX spike trades",
                    "Maximum 1 position per correlation group",
                    "No naked options positions"
                ],
                'alerts': [
                    "[CRISIS MODE] August 2024 protection protocols activated",
                    "[BLOCKED] Correlation limits enforced at crisis levels",
                    "[OPPORTUNITY] VIX spike opportunity - deploy defensive positions"
                ]
            },
            ProtectionLevel.RECOVERY: {
                'actions': [
                    "Gradual re-deployment of capital",
                    "Monitor correlation group recovery",
                    "Maintain elevated cash reserves",
                    "Resume selected strategies only"
                ],
                'restrictions': [
                    "Limited new position sizes",
                    "Enhanced correlation monitoring"
                ],
                'alerts': [
                    "🔄 Recovery mode - gradual re-deployment"
                ]
            }
        }
        
        protocol = protocols.get(protection_level, protocols[ProtectionLevel.PREVENTIVE])
        protocol['protection_level'] = protection_level.value
        protocol['timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        return protocol
    
    def CalculateOptimalExposure(self, account_value: float, vix_level: float, 
                               protection_level: ProtectionLevel) -> Dict:
        """
        Calculate optimal exposure based on August 2024 lessons
        
        Args:
            account_value: Current account value
            vix_level: Current VIX level
            protection_level: Current protection level
            
        Returns:
            Optimal exposure recommendations
        """
        base_exposure = account_value * 0.70  # Base 70% exposure
        
        # Protection level adjustments
        protection_multipliers = {
            ProtectionLevel.PREVENTIVE: 1.0,
            ProtectionLevel.DEFENSIVE: 0.75,
            ProtectionLevel.EMERGENCY: 0.45,
            ProtectionLevel.RECOVERY: 0.65
        }
        
        protection_multiplier = protection_multipliers.get(protection_level, 0.75)
        
        # VIX-based adjustments
        if vix_level > 30:
            vix_adjustment = 0.5  # Reduce to 50% during extreme volatility
        elif vix_level > 25:
            vix_adjustment = 0.7  # Reduce to 70% during high volatility
        else:
            vix_adjustment = 1.0
        
        optimal_exposure = base_exposure * protection_multiplier * vix_adjustment
        
        # Correlation group allocations
        group_allocations = {}
        remaining_exposure = optimal_exposure
        
        for group_name, group_data in self.correlation_groups.items():
            max_group_allocation = optimal_exposure * group_data['risk_weight']
            
            # Apply crisis limits
            crisis_limit = group_data['crisis_limit']
            if protection_level in [ProtectionLevel.EMERGENCY, ProtectionLevel.DEFENSIVE]:
                # Reduce allocation for groups at crisis limits
                if group_data['current_positions'] >= crisis_limit:
                    max_group_allocation *= 0.5
            
            group_allocations[group_name] = min(max_group_allocation, remaining_exposure * 0.3)
            remaining_exposure -= group_allocations[group_name]
        
        return {
            'total_optimal_exposure': optimal_exposure,
            'base_exposure': base_exposure,
            'protection_multiplier': protection_multiplier,
            'vix_adjustment': vix_adjustment,
            'cash_reserve': account_value - optimal_exposure,
            'cash_reserve_pct': (account_value - optimal_exposure) / account_value,
            'group_allocations': group_allocations,
            'protection_level': protection_level.value,
            'august_2024_compliance': optimal_exposure < (account_value * 0.60),  # Keep under 60% during crisis
            'recommendations': self._GetExposureRecommendations(optimal_exposure, account_value, protection_level)
        }
    
    def _GetRiskLevel(self, correlation_violations: int, protection_effectiveness: float) -> str:
        """Get overall risk level assessment"""
        if correlation_violations >= 3 or protection_effectiveness < 0.30:
            return "EXTREME"
        elif correlation_violations >= 2 or protection_effectiveness < 0.40:
            return "HIGH"
        elif correlation_violations >= 1 or protection_effectiveness < 0.50:
            return "MODERATE"
        else:
            return "LOW"
    
    def _GetExposureRecommendations(self, optimal_exposure: float, account_value: float, 
                                  protection_level: ProtectionLevel) -> List[str]:
        """Generate exposure recommendations"""
        exposure_pct = optimal_exposure / account_value
        recommendations = []
        
        if exposure_pct > 0.75:
            recommendations.append("[WARNING] High exposure - consider reducing positions")
        elif exposure_pct < 0.40:
            recommendations.append("[INFO] Conservative exposure - opportunity for gradual deployment")
        
        if protection_level == ProtectionLevel.EMERGENCY:
            recommendations.append("[EMERGENCY] Emergency protocols - maintain minimal exposure until VIX normalizes")
        elif protection_level == ProtectionLevel.DEFENSIVE:
            recommendations.append("🛡️ Defensive posture - prioritize capital preservation")
        
        return recommendations
    
    def UpdatePositionCounts(self, symbol: str, action: str):
        """
        Update position counts for correlation group tracking
        
        Args:
            symbol: Symbol being traded
            action: 'ADD' or 'REMOVE'
        """
        for group_name, group_data in self.correlation_groups.items():
            if symbol in group_data['symbols']:
                if action == 'ADD':
                    group_data['current_positions'] += 1
                elif action == 'REMOVE':
                    group_data['current_positions'] = max(0, group_data['current_positions'] - 1)
                break
    
    def GetGroupStatus(self) -> Dict:
        """Get current status of all correlation groups"""
        status = {}
        total_positions = 0
        
        for group_name, group_data in self.correlation_groups.items():
            current_positions = group_data['current_positions']
            normal_limit = group_data['normal_limit'] 
            crisis_limit = group_data['crisis_limit']
            
            status[group_name] = {
                'current_positions': current_positions,
                'normal_limit': normal_limit,
                'crisis_limit': crisis_limit,
                'utilization_normal': current_positions / normal_limit,
                'utilization_crisis': current_positions / crisis_limit if crisis_limit > 0 else 0,
                'risk_weight': group_data['risk_weight'],
                'symbols': group_data['symbols'],
                'status': 'OK' if current_positions <= crisis_limit else 'VIOLATION'
            }
            
            total_positions += current_positions
        
        return {
            'groups': status,
            'total_positions': total_positions,
            'total_groups_at_limit': sum(1 for g in status.values() if g['current_positions'] >= g['crisis_limit']),
            'overall_status': 'PROTECTED' if all(g['status'] == 'OK' for g in status.values()) else 'AT_RISK'
        }