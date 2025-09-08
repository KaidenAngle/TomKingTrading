#!/usr/bin/env python3
"""
Strategy Configuration Validator - Tom King Trading Framework
Ensures all strategies follow proper parameters and phase requirements
"""

from typing import Dict, List, Tuple, Optional
from datetime import datetime

class StrategyValidator:
    """
    Validates strategy execution based on Tom King parameters
    Ensures proper phase requirements, BP utilization, and concentration limits
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Strategy requirements by phase (minimum phase to enable)
        self.strategy_phase_requirements = {
            '0DTE': 1,           # Available from Phase 1
            'BUTTERFLY_0DTE': 1, # Available from Phase 1
            'IPMCC': 1,         # Available from Phase 1
            'STRANGLE': 1,      # Available from Phase 1 (micro futures)
            'LT112': 2,         # Available from Phase 2 ($55k+)
            'LEAP_PUTS': 2,     # Available from Phase 2
            'BEAR_TRAP': 3,     # Available from Phase 3 ($75k+)
            'RATIO_SPREAD': 3,  # Available from Phase 3
            'ADVANCED': 4       # Available from Phase 4 ($95k+)
        }
        
        # BP utilization limits per strategy (% of account)
        self.strategy_bp_limits = {
            '0DTE': {
                'phase1': 0.02,   # 2% per position
                'phase2': 0.025,  # 2.5% per position
                'phase3': 0.03,   # 3% per position
                'phase4': 0.035   # 3.5% per position
            },
            'LT112': {
                'phase2': 0.06,   # 6% per position (1-1-2 structure)
                'phase3': 0.08,   # 8% per position
                'phase4': 0.10    # 10% per position
            },
            'STRANGLE': {
                'phase1': 0.025,  # 2.5% micro futures
                'phase2': 0.035,  # 3.5% mini futures
                'phase3': 0.045,  # 4.5% full futures
                'phase4': 0.055   # 5.5% full futures
            },
            'IPMCC': {
                'phase1': 0.08,   # 8% for LEAP + weekly calls
                'phase2': 0.10,   # 10%
                'phase3': 0.12,   # 12%
                'phase4': 0.15    # 15%
            }
        }
        
        # Maximum positions per strategy by phase
        self.max_positions_per_strategy = {
            'phase1': {
                '0DTE': 1,      # 1 iron condor
                'STRANGLE': 2,  # 2 strangles max
                'IPMCC': 2,     # 2 IPMCC positions
                'TOTAL': 5      # 5 total positions
            },
            'phase2': {
                '0DTE': 2,      # 2 iron condors
                'LT112': 1,     # 1 LT112 position
                'STRANGLE': 3,  # 3 strangles
                'IPMCC': 3,     # 3 IPMCC positions
                'TOTAL': 8      # 8 total positions
            },
            'phase3': {
                '0DTE': 3,      # 3 iron condors
                'LT112': 2,     # 2 LT112 positions
                'STRANGLE': 4,  # 4 strangles
                'IPMCC': 4,     # 4 IPMCC positions
                'BEAR_TRAP': 1, # 1 bear trap
                'TOTAL': 12     # 12 total positions
            },
            'phase4': {
                '0DTE': 5,      # 5 iron condors
                'LT112': 3,     # 3 LT112 positions
                'STRANGLE': 6,  # 6 strangles
                'IPMCC': 5,     # 5 IPMCC positions
                'BEAR_TRAP': 2, # 2 bear traps
                'TOTAL': 20     # 20 total positions
            }
        }
        
        # Ticker concentration limits
        self.ticker_concentration_limits = {
            'single_underlying': 0.15,  # Max 15% BP in single underlying
            'correlated_group': 0.30,    # Max 30% BP in correlated group
            'strategy_type': 0.40        # Max 40% BP in single strategy type
        }
        
    def can_execute_strategy(self, strategy: str, account_phase: int, 
                            account_value: float, current_positions: Dict) -> Tuple[bool, str]:
        """
        Validate if strategy can be executed based on all requirements
        """
        # Check phase requirement
        min_phase = self.strategy_phase_requirements.get(strategy, 1)
        if account_phase < min_phase:
            return False, f"{strategy} requires Phase {min_phase} (current: Phase {account_phase})"
        
        # Check drawdown status
        if hasattr(self.algo, 'drawdown_manager'):
            can_open, reason = self.algo.drawdown_manager.should_allow_new_position()
            if not can_open:
                return False, f"Drawdown restriction: {reason}"
        
        # Check position count limits
        phase_key = f'phase{account_phase}'
        max_for_strategy = self.max_positions_per_strategy.get(phase_key, {}).get(strategy, 0)
        current_count = self._count_strategy_positions(strategy, current_positions)
        
        if current_count >= max_for_strategy:
            return False, f"{strategy} position limit reached ({current_count}/{max_for_strategy})"
        
        # Check total position limit
        total_max = self.max_positions_per_strategy.get(phase_key, {}).get('TOTAL', 5)
        total_current = len(current_positions)
        
        if total_current >= total_max:
            return False, f"Total position limit reached ({total_current}/{total_max})"
        
        # Check BP utilization
        bp_check, bp_reason = self._check_bp_utilization(
            strategy, phase_key, account_value, current_positions
        )
        if not bp_check:
            return False, bp_reason
        
        # Check VIX conditions
        vix_check, vix_reason = self._check_vix_conditions(strategy)
        if not vix_check:
            return False, vix_reason
        
        return True, "All checks passed"
    
    def _count_strategy_positions(self, strategy: str, positions: Dict) -> int:
        """Count current positions for a specific strategy"""
        count = 0
        for pos in positions.values():
            if hasattr(pos, 'strategy') and pos.strategy == strategy:
                count += 1
        return count
    
    def _check_bp_utilization(self, strategy: str, phase_key: str, 
                             account_value: float, positions: Dict) -> Tuple[bool, str]:
        """Check if BP utilization allows new position"""
        # Get strategy BP requirement
        strategy_bp = self.strategy_bp_limits.get(strategy, {}).get(phase_key, 0.05)
        required_bp = account_value * strategy_bp
        
        # Calculate current BP usage
        current_bp_used = 0
        for pos in positions.values():
            if hasattr(pos, 'buying_power_used'):
                current_bp_used += pos.buying_power_used
        
        # Get phase BP limit
        phase_config = self.algo.position_sizer.phase_limits.get(
            self.algo.position_sizer.get_account_phase(account_value)
        )
        max_bp = account_value * phase_config.get('max_bp_limit', 0.80)
        
        if current_bp_used + required_bp > max_bp:
            usage_pct = (current_bp_used / account_value) * 100
            return False, f"BP limit exceeded (using {usage_pct:.1f}%, would be {((current_bp_used + required_bp) / account_value) * 100:.1f}%)"
        
        return True, "BP check passed"
    
    def _check_vix_conditions(self, strategy: str) -> Tuple[bool, str]:
        """Check VIX conditions for strategy"""
        if not hasattr(self.algo, 'vix_manager'):
            return True, "No VIX manager"
        
        current_vix = self.algo.vix_manager.get_current_vix()
        
        # Strategy-specific VIX requirements
        if strategy == '0DTE' and current_vix > 22:  # Tom King rule
            return False, f"VIX too high for 0DTE ({current_vix:.2f} > 22)"
        
        if strategy == 'STRANGLE' and current_vix < 12:
            return False, f"VIX too low for strangles ({current_vix:.2f} < 12)"
        
        if strategy == 'LT112' and current_vix > 35:
            return False, f"VIX too high for LT112 ({current_vix:.2f} > 35)"
        
        return True, "VIX check passed"
    
    def get_ticker_concentration(self, positions: Dict) -> Dict:
        """Calculate concentration by ticker and correlation group"""
        concentration = {
            'by_ticker': {},
            'by_correlation_group': {},
            'by_strategy': {},
            'warnings': []
        }
        
        account_value = float(self.algo.Portfolio.TotalPortfolioValue)
        
        # Calculate by ticker
        for pos in positions.values():
            if hasattr(pos, 'symbol') and hasattr(pos, 'buying_power_used'):
                symbol = pos.symbol
                bp_used = pos.buying_power_used
                
                if symbol not in concentration['by_ticker']:
                    concentration['by_ticker'][symbol] = 0
                concentration['by_ticker'][symbol] += bp_used
        
        # Check concentration limits
        for symbol, bp_used in concentration['by_ticker'].items():
            concentration_pct = bp_used / account_value
            if concentration_pct > self.ticker_concentration_limits['single_underlying']:
                concentration['warnings'].append(
                    f"{symbol}: {concentration_pct:.1%} exceeds {self.ticker_concentration_limits['single_underlying']:.0%} limit"
                )
        
        # Calculate by correlation group
        if hasattr(self.algo, 'correlation_manager'):
            for group_name in self.algo.correlation_manager.correlation_groups.keys():
                group_bp = 0
                for pos in positions.values():
                    if hasattr(pos, 'symbol') and hasattr(pos, 'buying_power_used'):
                        if self.algo.correlation_manager.get_correlation_group(pos.symbol) == group_name:
                            group_bp += pos.buying_power_used
                
                if group_bp > 0:
                    concentration['by_correlation_group'][group_name] = group_bp
                    group_pct = group_bp / account_value
                    if group_pct > self.ticker_concentration_limits['correlated_group']:
                        concentration['warnings'].append(
                            f"Group {group_name}: {group_pct:.1%} exceeds {self.ticker_concentration_limits['correlated_group']:.0%} limit"
                        )
        
        return concentration
    
    def handle_phase_transition(self, old_phase: int, new_phase: int, positions: Dict) -> List[Dict]:
        """
        Handle phase transition - adjust existing positions if needed
        Returns list of recommended actions
        """
        actions = []
        
        if new_phase < old_phase:
            # Downgrade - need to reduce positions
            self.algo.Log(f"[PHASE TRANSITION] Downgrade from Phase {old_phase} to {new_phase}")
            
            # Check which positions exceed new phase limits
            new_phase_key = f'phase{new_phase}'
            max_positions = self.max_positions_per_strategy.get(new_phase_key, {})
            
            for strategy, max_count in max_positions.items():
                if strategy == 'TOTAL':
                    continue
                    
                current_count = self._count_strategy_positions(strategy, positions)
                if current_count > max_count:
                    excess = current_count - max_count
                    actions.append({
                        'action': 'REDUCE',
                        'strategy': strategy,
                        'quantity': excess,
                        'reason': f"Phase downgrade: {strategy} limited to {max_count} positions"
                    })
            
            # Reduce BP usage if needed
            new_bp_limit = self.algo.position_sizer.phase_limits.get(
                self.algo.position_sizer.get_account_phase(float(self.algo.Portfolio.TotalPortfolioValue))
            ).get('max_bp_limit', 0.50)
            
            current_bp_usage = sum(pos.buying_power_used for pos in positions.values() 
                                 if hasattr(pos, 'buying_power_used'))
            account_value = float(self.algo.Portfolio.TotalPortfolioValue)
            
            if current_bp_usage > account_value * new_bp_limit:
                actions.append({
                    'action': 'REDUCE_BP',
                    'target_bp': new_bp_limit,
                    'current_bp': current_bp_usage / account_value,
                    'reason': f"Phase downgrade: BP limit reduced to {new_bp_limit:.0%}"
                })
        
        elif new_phase > old_phase:
            # Upgrade - new opportunities available
            self.algo.Log(f"[PHASE TRANSITION] Upgrade from Phase {old_phase} to {new_phase}")
            
            # Log newly available strategies
            for strategy, min_phase in self.strategy_phase_requirements.items():
                if min_phase == new_phase:
                    actions.append({
                        'action': 'ENABLE',
                        'strategy': strategy,
                        'reason': f"Strategy {strategy} now available in Phase {new_phase}"
                    })
        
        return actions
    
    def validate_greeks_requirements(self, strategy: str, option_contract) -> Tuple[bool, str]:
        """
        Validate that option contract meets Greeks requirements for strategy
        """
        if not hasattr(option_contract, 'Greeks'):
            return True, "No Greeks available"
        
        greeks = option_contract.Greeks
        
        # Strategy-specific Greeks requirements
        if strategy == '0DTE':
            # Iron condor should have low delta wings
            if abs(greeks.Delta) > 0.15:
                return False, f"Delta too high for 0DTE wing ({abs(greeks.Delta):.3f} > 0.15)"
        
        elif strategy == 'STRANGLE':
            # Tom King 5-7 delta requirement
            if abs(greeks.Delta) < 0.05 or abs(greeks.Delta) > 0.07:
                return False, f"Delta outside 5-7 range ({abs(greeks.Delta):.3f})"
        
        elif strategy == 'IPMCC':
            # LEAP should be 80 delta
            if greeks.Delta < 0.75 or greeks.Delta > 0.85:
                return False, f"LEAP delta outside 75-85 range ({greeks.Delta:.3f})"
        
        return True, "Greeks validation passed"
    
    def get_strategy_performance_metrics(self, strategy: str) -> Dict:
        """
        Get expected performance metrics for strategy validation
        """
        # Tom King documented win rates and targets
        metrics = {
            '0DTE': {
                'win_rate_target': 0.88,
                'profit_target': 0.50,
                'stop_loss': 2.00,
                'expected_monthly_return': 0.08,
                'max_drawdown': 0.10
            },
            'LT112': {
                'win_rate_target': 0.95,
                'profit_target': 0.50,
                'stop_loss': 2.00,
                'expected_monthly_return': 0.06,
                'max_drawdown': 0.08
            },
            'STRANGLE': {
                'win_rate_target': 0.70,
                'profit_target': 0.50,
                'stop_loss': 2.50,
                'expected_monthly_return': 0.05,
                'max_drawdown': 0.15
            },
            'IPMCC': {
                'win_rate_target': 0.80,
                'profit_target': 0.50,
                'stop_loss': 2.00,
                'expected_weekly_return': 0.02,
                'max_drawdown': 0.12
            }
        }
        
        return metrics.get(strategy, {
            'win_rate_target': 0.70,
            'profit_target': 0.50,
            'stop_loss': 2.00,
            'expected_monthly_return': 0.05,
            'max_drawdown': 0.20
        })
    
    def validate_expected_credit(self, strategy: str, expected_credit: float, 
                                max_risk: float, contracts: int = 1) -> Tuple[bool, str]:
        """
        Validate that expected credit meets minimum requirements for the strategy
        Based on Tom King risk/reward ratios
        """
        if expected_credit <= 0:
            return False, f"Invalid credit: ${expected_credit:.2f}"
        
        if max_risk <= 0:
            return False, f"Invalid max risk: ${max_risk:.2f}"
        
        # Calculate risk/reward ratio
        risk_reward_ratio = expected_credit / max_risk
        
        # Tom King minimum credit requirements by strategy
        min_credit_requirements = {
            '0DTE': {
                'min_credit_ratio': 0.20,  # Minimum 20% of max risk
                'min_credit_per_contract': 25,  # $25 minimum per iron condor
                'max_acceptable_ratio': 0.50  # Don't take more than 50% (too good to be true)
            },
            'STRANGLE': {
                'min_credit_ratio': 0.15,  # Minimum 15% of max risk
                'min_credit_per_contract': 50,  # $50 minimum per strangle
                'max_acceptable_ratio': 0.40  # Max 40% credit ratio
            },
            'LT112': {
                'min_credit_ratio': 0.25,  # Minimum 25% of max risk (better risk/reward)
                'min_credit_per_contract': 100,  # $100 minimum for 1-1-2
                'max_acceptable_ratio': 0.60  # Max 60% credit ratio
            },
            'IPMCC': {
                'min_credit_ratio': 0.02,  # 2% weekly minimum on capital
                'min_credit_per_contract': 20,  # $20 minimum per weekly call
                'max_acceptable_ratio': 0.05  # Max 5% weekly (too good to be true)
            },
            'BUTTERFLY_0DTE': {
                'min_credit_ratio': 0.33,  # Minimum 33% of max risk (1:2 risk/reward)
                'min_credit_per_contract': 30,  # $30 minimum per butterfly
                'max_acceptable_ratio': 0.67  # Max 67% credit ratio
            },
            'BEAR_TRAP': {
                'min_credit_ratio': 0.30,  # Minimum 30% of max risk
                'min_credit_per_contract': 75,  # $75 minimum
                'max_acceptable_ratio': 0.50  # Max 50% credit ratio
            }
        }
        
        # Get requirements for strategy
        requirements = min_credit_requirements.get(strategy, {
            'min_credit_ratio': 0.20,
            'min_credit_per_contract': 25,
            'max_acceptable_ratio': 0.50
        })
        
        # Check minimum credit ratio
        if risk_reward_ratio < requirements['min_credit_ratio']:
            return False, (f"Credit ratio {risk_reward_ratio:.2%} below minimum "
                         f"{requirements['min_credit_ratio']:.0%} for {strategy}")
        
        # Check maximum credit ratio (too good to be true)
        if risk_reward_ratio > requirements['max_acceptable_ratio']:
            return False, (f"Credit ratio {risk_reward_ratio:.2%} exceeds maximum "
                         f"{requirements['max_acceptable_ratio']:.0%} - potential pricing error")
        
        # Check minimum absolute credit
        credit_per_contract = expected_credit / contracts if contracts > 0 else 0
        if credit_per_contract < requirements['min_credit_per_contract']:
            return False, (f"Credit per contract ${credit_per_contract:.2f} below minimum "
                         f"${requirements['min_credit_per_contract']:.2f} for {strategy}")
        
        # Additional IV-based validation for certain strategies
        if strategy in ['STRANGLE', 'LT112']:
            # These strategies need higher IV to be profitable
            if hasattr(self.algo, 'vix_manager'):
                current_vix = self.algo.vix_manager.get_current_vix()
                if current_vix < 15 and risk_reward_ratio < 0.25:
                    return False, (f"Low VIX ({current_vix:.1f}) requires minimum 25% credit ratio, "
                                 f"got {risk_reward_ratio:.2%}")
        
        # Validate based on current market conditions
        if hasattr(self.algo, 'CurrentSlice') and self.algo.CurrentSlice:
            # Check if credit makes sense given time to expiration
            # For 0DTE, credit should be lower; for 30+ DTE, credit should be higher
            pass  # Implement DTE-based validation if needed
        
        return True, f"Credit validated: ${expected_credit:.2f} on ${max_risk:.2f} risk ({risk_reward_ratio:.1%})"
    
    def calculate_expected_credit(self, contracts: List) -> Tuple[float, float]:
        """
        Calculate expected credit and max risk from option contracts
        Returns (expected_credit, max_risk)
        """
        try:
            total_credit = 0
            total_debit = 0
            
            for contract in contracts:
                if not contract:
                    continue
                    
                # Determine if we're buying or selling based on contract type
                # This is a simplified calculation - in production use actual order direction
                if hasattr(contract, 'BidPrice') and hasattr(contract, 'AskPrice'):
                    # Use mid price for estimation
                    mid_price = (contract.BidPrice + contract.AskPrice) / 2
                    
                    # Assume selling if it's a short strike (would need actual order info)
                    # This is simplified - you'd track actual buy/sell from order placement
                    if hasattr(contract, 'Strike'):
                        # Just for demonstration - would need actual order direction
                        total_credit += mid_price * 100  # Assuming 1 contract = 100 shares
            
            # Calculate max risk based on strike widths
            # This is strategy-specific and would need proper implementation
            max_risk = abs(total_credit * 3)  # Simplified - use actual strike width calculation
            
            return total_credit, max_risk
            
        except Exception as e:
            self.algo.Debug(f"Error calculating expected credit: {e}")
            return 0, 0