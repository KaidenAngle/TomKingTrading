"""
Correlation Group Manager for QuantConnect LEAN
Implements Tom King's correlation group limits and monitoring
Prevents concentration risk and August 2024-style disasters
"""

import numpy as np
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta
from enum import Enum
import pandas as pd

class CorrelationGroup(Enum):
    """Correlation groups based on Tom King methodology"""
    EQUITY_INDEX = "EQUITY_INDEX"      # SPY, QQQ, IWM, ES, MES, NQ, MNQ, YM, MYM
    ENERGY = "ENERGY"                  # CL, MCL, USO, XLE, OIH
    METALS = "METALS"                  # GC, MGC, GLD, SLV, SI, GDX, GDXJ
    TREASURIES = "TREASURIES"          # TLT, IEF, SHY, ZB, ZN, ZF
    VOLATILITY = "VOLATILITY"          # VIX, UVXY, VXX, SVXY
    CURRENCIES = "CURRENCIES"          # 6E, 6A, 6B, 6J, DXY, UUP
    TECHNOLOGY = "TECHNOLOGY"          # QQQ, NVDA, AAPL, MSFT, GOOGL
    COMMODITIES = "COMMODITIES"        # DBA, DBC, CORN, WEAT, SOYB
    REAL_ESTATE = "REAL_ESTATE"        # IYR, VNQ, REZ, REM
    
class CorrelationManager:
    """
    Manages correlation groups and position limits to prevent concentration risk
    
    Key Features:
    - Maximum 3 positions per correlation group (Phase 4), 2 for earlier phases
    - Real-time correlation monitoring and alerts
    - August 2024 disaster prevention protocols
    - Dynamic correlation coefficient calculation
    - Position diversification optimization
    """
    
    def __init__(self):
        # Symbol to correlation group mapping
        self.symbol_groups = {
            # Equity Index Group
            'SPY': CorrelationGroup.EQUITY_INDEX,
            'QQQ': CorrelationGroup.EQUITY_INDEX,
            'IWM': CorrelationGroup.EQUITY_INDEX,
            'DIA': CorrelationGroup.EQUITY_INDEX,
            'ES': CorrelationGroup.EQUITY_INDEX,
            'MES': CorrelationGroup.EQUITY_INDEX,
            'NQ': CorrelationGroup.EQUITY_INDEX,
            'MNQ': CorrelationGroup.EQUITY_INDEX,
            'YM': CorrelationGroup.EQUITY_INDEX,
            'MYM': CorrelationGroup.EQUITY_INDEX,
            'RTY': CorrelationGroup.EQUITY_INDEX,
            'M2K': CorrelationGroup.EQUITY_INDEX,
            
            # Energy Group
            'CL': CorrelationGroup.ENERGY,
            'MCL': CorrelationGroup.ENERGY,
            'USO': CorrelationGroup.ENERGY,
            'XLE': CorrelationGroup.ENERGY,
            'OIH': CorrelationGroup.ENERGY,
            'GUSH': CorrelationGroup.ENERGY,
            'DRIP': CorrelationGroup.ENERGY,
            
            # Metals Group
            'GC': CorrelationGroup.METALS,
            'MGC': CorrelationGroup.METALS,
            'GLD': CorrelationGroup.METALS,
            'SLV': CorrelationGroup.METALS,
            'SI': CorrelationGroup.METALS,
            'GDX': CorrelationGroup.METALS,
            'GDXJ': CorrelationGroup.METALS,
            'NUGT': CorrelationGroup.METALS,
            'DUST': CorrelationGroup.METALS,
            
            # Treasuries Group
            'TLT': CorrelationGroup.TREASURIES,
            'IEF': CorrelationGroup.TREASURIES,
            'SHY': CorrelationGroup.TREASURIES,
            'ZB': CorrelationGroup.TREASURIES,
            'ZN': CorrelationGroup.TREASURIES,
            'ZF': CorrelationGroup.TREASURIES,
            'TMF': CorrelationGroup.TREASURIES,
            'TMV': CorrelationGroup.TREASURIES,
            
            # Volatility Group
            'VIX': CorrelationGroup.VOLATILITY,
            'UVXY': CorrelationGroup.VOLATILITY,
            'VXX': CorrelationGroup.VOLATILITY,
            'SVXY': CorrelationGroup.VOLATILITY,
            'VIXY': CorrelationGroup.VOLATILITY,
            'XIV': CorrelationGroup.VOLATILITY,
            
            # Currencies Group
            '6E': CorrelationGroup.CURRENCIES,
            '6A': CorrelationGroup.CURRENCIES,
            '6B': CorrelationGroup.CURRENCIES,
            '6J': CorrelationGroup.CURRENCIES,
            'DXY': CorrelationGroup.CURRENCIES,
            'UUP': CorrelationGroup.CURRENCIES,
            'FXE': CorrelationGroup.CURRENCIES,
            'FXB': CorrelationGroup.CURRENCIES,
            
            # Technology Group (subset of equity with higher correlation)
            'NVDA': CorrelationGroup.TECHNOLOGY,
            'AAPL': CorrelationGroup.TECHNOLOGY,
            'MSFT': CorrelationGroup.TECHNOLOGY,
            'GOOGL': CorrelationGroup.TECHNOLOGY,
            'AMZN': CorrelationGroup.TECHNOLOGY,
            'META': CorrelationGroup.TECHNOLOGY,
            'TSLA': CorrelationGroup.TECHNOLOGY,
            
            # Commodities Group
            'DBA': CorrelationGroup.COMMODITIES,
            'DBC': CorrelationGroup.COMMODITIES,
            'CORN': CorrelationGroup.COMMODITIES,
            'WEAT': CorrelationGroup.COMMODITIES,
            'SOYB': CorrelationGroup.COMMODITIES,
            
            # Real Estate Group
            'IYR': CorrelationGroup.REAL_ESTATE,
            'VNQ': CorrelationGroup.REAL_ESTATE,
            'REZ': CorrelationGroup.REAL_ESTATE,
            'REM': CorrelationGroup.REAL_ESTATE
        }
        
        # Phase-based correlation group limits
        self.phase_group_limits = {
            1: 1,  # Phase 1: Max 1 position per group
            2: 2,  # Phase 2: Max 2 positions per group
            3: 2,  # Phase 3: Max 2 positions per group
            4: 3   # Phase 4: Max 3 positions per group
        }
        
        # Historical correlation coefficients (approximate)
        self.correlation_matrix = {
            CorrelationGroup.EQUITY_INDEX: {
                CorrelationGroup.EQUITY_INDEX: 0.95,
                CorrelationGroup.TECHNOLOGY: 0.85,
                CorrelationGroup.ENERGY: 0.25,
                CorrelationGroup.METALS: 0.15,
                CorrelationGroup.TREASURIES: -0.30,
                CorrelationGroup.VOLATILITY: -0.75,
                CorrelationGroup.CURRENCIES: -0.10,
                CorrelationGroup.COMMODITIES: 0.20,
                CorrelationGroup.REAL_ESTATE: 0.60
            },
            CorrelationGroup.TECHNOLOGY: {
                CorrelationGroup.EQUITY_INDEX: 0.85,
                CorrelationGroup.TECHNOLOGY: 0.90,
                CorrelationGroup.ENERGY: 0.15,
                CorrelationGroup.METALS: 0.10,
                CorrelationGroup.TREASURIES: -0.25,
                CorrelationGroup.VOLATILITY: -0.70,
                CorrelationGroup.CURRENCIES: -0.05,
                CorrelationGroup.COMMODITIES: 0.15,
                CorrelationGroup.REAL_ESTATE: 0.50
            },
            # Add other correlation relationships as needed
        }
        
        # August 2024 disaster patterns (high correlation warning thresholds)
        self.disaster_patterns = {
            'correlation_spike_threshold': 0.80,  # Alert when correlations exceed 80%
            'max_correlated_exposure': 0.60,     # Max 60% of portfolio in correlated positions
            'emergency_correlation_limit': 0.90,  # Emergency limit for extreme correlation
            'vix_correlation_multiplier': {       # Adjust limits based on VIX
                'low': 1.0,      # VIX < 20
                'normal': 0.8,   # VIX 20-25
                'high': 0.6,     # VIX 25-35
                'extreme': 0.4   # VIX > 35
            }
        }
    
    def get_symbol_group(self, symbol: str) -> CorrelationGroup:
        """Get correlation group for a symbol"""
        symbol_upper = symbol.upper()
        return self.symbol_groups.get(symbol_upper, CorrelationGroup.EQUITY_INDEX)
    
    def check_position_limits(self, current_positions: List[Dict], 
                            new_symbol: str, account_phase: int,
                            vix_level: float = 20.0) -> Dict:
        """
        Check if adding a new position would violate correlation limits
        
        Args:
            current_positions: List of current positions with 'symbol' key
            new_symbol: Symbol for new position
            account_phase: Current account phase (1-4)
            vix_level: Current VIX level for emergency adjustments
            
        Returns:
            Dictionary with limit check results and recommendations
        """
        new_group = self.get_symbol_group(new_symbol)
        
        # Count positions by correlation group
        group_counts = {}
        total_positions = len(current_positions)
        
        for position in current_positions:
            symbol = position.get('symbol', '')
            group = self.get_symbol_group(symbol)
            group_counts[group] = group_counts.get(group, 0) + 1
        
        current_in_group = group_counts.get(new_group, 0)
        max_per_group = self.phase_group_limits.get(account_phase, 1)
        
        # VIX-based adjustments (tighter limits during high volatility)
        vix_adjustment = self._get_vix_correlation_adjustment(vix_level)
        adjusted_max_per_group = max(1, int(max_per_group * vix_adjustment))
        
        # Check if new position would violate limits
        would_violate = current_in_group >= adjusted_max_per_group
        
        # Calculate diversification metrics
        diversification_score = self._calculate_diversification_score(group_counts, total_positions)
        
        return {
            'can_add_position': not would_violate,
            'new_symbol': new_symbol,
            'correlation_group': new_group.value,
            'current_positions_in_group': current_in_group,
            'max_positions_per_group': adjusted_max_per_group,
            'original_limit': max_per_group,
            'vix_adjustment_factor': vix_adjustment,
            'total_positions': total_positions,
            'group_distribution': {group.value: count for group, count in group_counts.items()},
            'diversification_score': diversification_score,
            'risk_analysis': {
                'concentration_risk': self._assess_concentration_risk(group_counts, total_positions),
                'august_2024_risk': self._assess_august_disaster_risk(group_counts, vix_level),
                'correlation_warning': would_violate
            },
            'recommendations': self._get_correlation_recommendations(
                group_counts, new_group, would_violate, vix_level
            )
        }
    
    def monitor_correlation_risk(self, current_positions: List[Dict], 
                               vix_level: float = 20.0,
                               market_stress: bool = False) -> Dict:
        """
        Monitor portfolio for correlation risk and August 2024-style scenarios
        
        Args:
            current_positions: List of current positions
            vix_level: Current VIX level
            market_stress: Whether market is under stress
            
        Returns:
            Comprehensive correlation risk analysis
        """
        group_counts = {}
        position_values = {}
        total_portfolio_value = 0
        
        # Analyze current portfolio composition
        for position in current_positions:
            symbol = position.get('symbol', '')
            value = position.get('market_value', 0)
            group = self.get_symbol_group(symbol)
            
            group_counts[group] = group_counts.get(group, 0) + 1
            position_values[group] = position_values.get(group, 0) + value
            total_portfolio_value += value
        
        # Calculate risk metrics
        risk_metrics = self._calculate_comprehensive_risk_metrics(
            group_counts, position_values, total_portfolio_value, vix_level
        )
        
        # August 2024 disaster scenario analysis
        disaster_risk = self._assess_august_disaster_risk(group_counts, vix_level)
        
        # Generate alerts and recommendations
        alerts = self._generate_correlation_alerts(risk_metrics, disaster_risk, market_stress)
        
        return {
            'portfolio_analysis': {
                'total_positions': sum(group_counts.values()),
                'group_distribution': {group.value: count for group, count in group_counts.items()},
                'value_distribution': {group.value: value for group, value in position_values.items()},
                'total_portfolio_value': total_portfolio_value
            },
            'risk_metrics': risk_metrics,
            'disaster_scenario_risk': disaster_risk,
            'correlation_matrix': self._get_current_correlation_estimates(list(group_counts.keys())),
            'alerts': alerts,
            'vix_context': {
                'current_level': vix_level,
                'correlation_adjustment': self._get_vix_correlation_adjustment(vix_level),
                'risk_regime': self._get_correlation_risk_regime(vix_level)
            }
        }
    
    def optimize_position_diversification(self, target_positions: List[str],
                                        account_phase: int, vix_level: float) -> Dict:
        """
        Optimize position allocation for maximum diversification
        
        Args:
            target_positions: List of target symbols
            account_phase: Account phase (1-4)
            vix_level: Current VIX level
            
        Returns:
            Optimized position allocation recommendations
        """
        # Group symbols by correlation group
        groups = {}
        for symbol in target_positions:
            group = self.get_symbol_group(symbol)
            if group not in groups:
                groups[group] = []
            groups[group].append(symbol)
        
        max_per_group = self.phase_group_limits.get(account_phase, 1)
        vix_adjustment = self._get_vix_correlation_adjustment(vix_level)
        adjusted_max = max(1, int(max_per_group * vix_adjustment))
        
        # Optimize selection within each group
        optimized_positions = []
        group_allocations = {}
        
        for group, symbols in groups.items():
            # Select best symbols from each group (up to limit)
            selected = self._select_best_symbols_from_group(symbols, adjusted_max, group)
            optimized_positions.extend(selected)
            group_allocations[group] = len(selected)
        
        # Calculate diversification score
        diversification_score = self._calculate_diversification_score(
            group_allocations, len(optimized_positions)
        )
        
        return {
            'optimized_positions': optimized_positions,
            'group_allocations': {group.value: count for group, count in group_allocations.items()},
            'diversification_score': diversification_score,
            'optimization_details': {
                'original_count': len(target_positions),
                'optimized_count': len(optimized_positions),
                'groups_used': len(group_allocations),
                'max_per_group': adjusted_max,
                'vix_adjustment': vix_adjustment
            },
            'risk_assessment': {
                'correlation_risk': 'LOW' if diversification_score > 0.7 else 'MODERATE' if diversification_score > 0.5 else 'HIGH',
                'august_2024_protection': diversification_score > 0.6,
                'recommended_additions': self._suggest_diversification_improvements(group_allocations)
            }
        }
    
    def _get_vix_correlation_adjustment(self, vix_level: float) -> float:
        """Get correlation limit adjustment based on VIX level"""
        if vix_level < 20:
            return 1.0  # Normal limits
        elif vix_level < 25:
            return 0.8  # 20% tighter limits
        elif vix_level < 35:
            return 0.6  # 40% tighter limits
        else:
            return 0.4  # 60% tighter limits (extreme caution)
    
    def _calculate_diversification_score(self, group_counts: Dict, 
                                       total_positions: int) -> float:
        """Calculate portfolio diversification score (0-1)"""
        if total_positions == 0:
            return 0.0
        
        # Calculate Herfindahl-Hirschman Index (HHI) for diversification
        hhi = sum((count / total_positions) ** 2 for count in group_counts.values())
        
        # Convert to diversification score (1 - HHI, adjusted)
        max_groups = len(CorrelationGroup)
        normalized_hhi = (hhi - 1/max_groups) / (1 - 1/max_groups)
        diversification_score = max(0, 1 - normalized_hhi)
        
        return diversification_score
    
    def _assess_concentration_risk(self, group_counts: Dict, 
                                 total_positions: int) -> str:
        """Assess concentration risk level"""
        if total_positions == 0:
            return "NO_POSITIONS"
        
        max_group_concentration = max(group_counts.values()) / total_positions
        
        if max_group_concentration > 0.70:
            return "EXTREME"
        elif max_group_concentration > 0.50:
            return "HIGH"
        elif max_group_concentration > 0.35:
            return "MODERATE"
        else:
            return "LOW"
    
    def _assess_august_disaster_risk(self, group_counts: Dict, vix_level: float) -> Dict:
        """
        Assess risk of August 5, 2024-style correlation disaster
        
        Tom King lost £308k because he had 6 LT112 positions all in equity indices
        This function prevents similar concentration disasters
        """
        total_positions = sum(group_counts.values())
        
        if total_positions == 0:
            return {'risk_level': 'NO_RISK', 'reason': 'No positions'}
        
        # Check for dangerous concentration patterns
        equity_positions = group_counts.get(CorrelationGroup.EQUITY_INDEX, 0)
        tech_positions = group_counts.get(CorrelationGroup.TECHNOLOGY, 0)
        
        # Equity + Tech are highly correlated during crashes
        correlated_equity_positions = equity_positions + tech_positions
        equity_concentration = correlated_equity_positions / total_positions
        
        # VIX-adjusted risk assessment
        if vix_level > 30 and equity_concentration > 0.60:
            risk_level = "EXTREME"
            reason = f"High VIX ({vix_level}) with {equity_concentration:.1%} equity concentration - August 2024 pattern"
        elif equity_concentration > 0.75:
            risk_level = "HIGH"
            reason = f"Excessive equity concentration ({equity_concentration:.1%}) - similar to Tom King's disaster"
        elif correlated_equity_positions > 4 and vix_level > 25:
            risk_level = "MODERATE"
            reason = f"{correlated_equity_positions} equity positions during elevated VIX ({vix_level})"
        elif equity_concentration > 0.50:
            risk_level = "LOW"
            reason = f"Moderate equity concentration ({equity_concentration:.1%})"
        else:
            risk_level = "MINIMAL"
            reason = "Well diversified portfolio"
        
        return {
            'risk_level': risk_level,
            'reason': reason,
            'equity_concentration': equity_concentration,
            'correlated_positions': correlated_equity_positions,
            'total_positions': total_positions,
            'vix_context': vix_level,
            'protection_active': equity_concentration < 0.60,
            'tom_king_comparison': {
                'his_concentration': 1.0,  # 6/6 positions in equity indices
                'his_loss': 308000,
                'your_concentration': equity_concentration,
                'estimated_protection': max(0, 1 - equity_concentration / 1.0)
            }
        }
    
    def _calculate_comprehensive_risk_metrics(self, group_counts: Dict, 
                                            position_values: Dict, 
                                            total_value: float, vix_level: float) -> Dict:
        """Calculate comprehensive correlation risk metrics"""
        if total_value == 0:
            return {'error': 'No portfolio value to analyze'}
        
        # Value-based concentration (more accurate than count-based)
        value_concentrations = {group: value / total_value 
                              for group, value in position_values.items()}
        
        max_value_concentration = max(value_concentrations.values()) if value_concentrations else 0
        
        # Estimated portfolio correlation during stress
        estimated_correlation = self._estimate_portfolio_correlation(group_counts, vix_level)
        
        # Risk-adjusted metrics
        return {
            'value_concentration': value_concentrations,
            'max_group_concentration': max_value_concentration,
            'estimated_portfolio_correlation': estimated_correlation,
            'diversification_index': self._calculate_diversification_score(group_counts, sum(group_counts.values())),
            'stress_test_correlation': min(0.95, estimated_correlation * (1 + vix_level / 100)),
            'august_2024_similarity': self._calculate_august_similarity(group_counts),
            'risk_score': self._calculate_overall_risk_score(
                max_value_concentration, estimated_correlation, vix_level
            )
        }
    
    def _estimate_portfolio_correlation(self, group_counts: Dict, vix_level: float) -> float:
        """Estimate overall portfolio correlation"""
        if not group_counts:
            return 0.0
        
        total_positions = sum(group_counts.values())
        weighted_correlation = 0.0
        
        for group1, count1 in group_counts.items():
            for group2, count2 in group_counts.items():
                if group1 in self.correlation_matrix and group2 in self.correlation_matrix[group1]:
                    corr = self.correlation_matrix[group1][group2]
                else:
                    corr = 0.3  # Default moderate correlation
                
                weight = (count1 * count2) / (total_positions ** 2)
                weighted_correlation += weight * corr
        
        # Adjust for VIX (correlations increase during stress)
        vix_multiplier = 1 + (vix_level - 20) / 100
        return min(0.99, weighted_correlation * vix_multiplier)
    
    def _calculate_august_similarity(self, group_counts: Dict) -> float:
        """Calculate similarity to August 2024 disaster scenario (0-1)"""
        total_positions = sum(group_counts.values())
        if total_positions == 0:
            return 0.0
        
        equity_positions = group_counts.get(CorrelationGroup.EQUITY_INDEX, 0)
        equity_percentage = equity_positions / total_positions
        
        # Tom King had 100% equity index concentration
        return equity_percentage
    
    def _calculate_overall_risk_score(self, concentration: float, 
                                    correlation: float, vix_level: float) -> float:
        """Calculate overall correlation risk score (0-1, higher is riskier)"""
        # Weighted combination of risk factors
        concentration_risk = min(1.0, concentration * 2)  # Double weight concentration
        correlation_risk = correlation
        vix_risk = min(1.0, (vix_level - 15) / 50)  # Risk increases with VIX above 15
        
        # Combined risk score
        risk_score = (0.4 * concentration_risk + 0.4 * correlation_risk + 0.2 * vix_risk)
        return min(1.0, risk_score)
    
    def _generate_correlation_alerts(self, risk_metrics: Dict, 
                                   disaster_risk: Dict, market_stress: bool) -> List[Dict]:
        """Generate correlation-based alerts and warnings"""
        alerts = []
        
        # High concentration alert
        if risk_metrics.get('max_group_concentration', 0) > 0.60:
            alerts.append({
                'type': 'CONCENTRATION_WARNING',
                'severity': 'HIGH',
                'message': f"High concentration in single correlation group: {risk_metrics['max_group_concentration']:.1%}",
                'action': 'Consider reducing positions in dominant group'
            })
        
        # August 2024 disaster risk alert
        if disaster_risk['risk_level'] in ['HIGH', 'EXTREME']:
            alerts.append({
                'type': 'AUGUST_2024_RISK',
                'severity': 'CRITICAL',
                'message': disaster_risk['reason'],
                'action': 'Reduce equity concentration immediately - Tom King lost £308k with this pattern'
            })
        
        # High correlation alert
        if risk_metrics.get('estimated_portfolio_correlation', 0) > 0.80:
            alerts.append({
                'type': 'HIGH_CORRELATION',
                'severity': 'MODERATE',
                'message': f"Portfolio correlation estimated at {risk_metrics['estimated_portfolio_correlation']:.1%}",
                'action': 'Add positions from uncorrelated groups'
            })
        
        # Market stress amplification alert
        if market_stress and risk_metrics.get('stress_test_correlation', 0) > 0.85:
            alerts.append({
                'type': 'STRESS_AMPLIFICATION',
                'severity': 'HIGH',
                'message': 'Market stress likely to amplify portfolio correlations',
                'action': 'Consider defensive position sizing or hedging'
            })
        
        return alerts
    
    def _get_current_correlation_estimates(self, active_groups: List[CorrelationGroup]) -> Dict:
        """Get correlation estimates for active groups"""
        estimates = {}
        for group1 in active_groups:
            estimates[group1.value] = {}
            for group2 in active_groups:
                if group1 in self.correlation_matrix and group2 in self.correlation_matrix[group1]:
                    estimates[group1.value][group2.value] = self.correlation_matrix[group1][group2]
                else:
                    # Default correlation estimates
                    if group1 == group2:
                        estimates[group1.value][group2.value] = 1.0
                    else:
                        estimates[group1.value][group2.value] = 0.3
        
        return estimates
    
    def _select_best_symbols_from_group(self, symbols: List[str], 
                                      max_count: int, group: CorrelationGroup) -> List[str]:
        """Select best symbols from a correlation group (placeholder for complex logic)"""
        # Simple implementation - in practice, this would use liquidity, spreads, etc.
        return symbols[:max_count]
    
    def _suggest_diversification_improvements(self, group_allocations: Dict) -> List[str]:
        """Suggest improvements to portfolio diversification"""
        suggestions = []
        
        total_groups = len(CorrelationGroup)
        used_groups = len(group_allocations)
        
        if used_groups < total_groups * 0.5:
            suggestions.append("Consider adding positions from unused correlation groups")
        
        # Find overconcentrated groups
        for group, count in group_allocations.items():
            if count > 3:
                suggestions.append(f"Consider reducing positions in {group.value} group")
        
        # Suggest underutilized groups
        unused_groups = set(CorrelationGroup) - set(group_allocations.keys())
        if unused_groups:
            for group in list(unused_groups)[:3]:  # Suggest up to 3 groups
                suggestions.append(f"Consider adding positions in {group.value} for diversification")
        
        return suggestions
    
    def _get_correlation_recommendations(self, group_counts: Dict, 
                                       new_group: CorrelationGroup, 
                                       would_violate: bool, vix_level: float) -> List[str]:
        """Get specific recommendations for correlation management"""
        recommendations = []
        
        if would_violate:
            recommendations.append(f"Cannot add position to {new_group.value} - group limit reached")
            
            # Suggest alternative groups
            underutilized_groups = []
            for group in CorrelationGroup:
                if group_counts.get(group, 0) < self.phase_group_limits.get(4, 3):
                    underutilized_groups.append(group.value)
            
            if underutilized_groups:
                recommendations.append(f"Consider positions in: {', '.join(underutilized_groups[:3])}")
        
        if vix_level > 25:
            recommendations.append("High VIX detected - using tighter correlation limits for protection")
        
        # August 2024 specific recommendations
        equity_count = group_counts.get(CorrelationGroup.EQUITY_INDEX, 0)
        if equity_count > 3:
            recommendations.append("WARNING: High equity concentration - consider Tom King's August 2024 lesson")
        
        return recommendations
    
    def _get_correlation_risk_regime(self, vix_level: float) -> str:
        """Get correlation risk regime based on VIX"""
        if vix_level < 15:
            return "LOW_CORRELATION"
        elif vix_level < 25:
            return "NORMAL_CORRELATION"
        elif vix_level < 35:
            return "HIGH_CORRELATION"
        else:
            return "EXTREME_CORRELATION"