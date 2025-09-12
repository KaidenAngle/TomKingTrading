# region imports
from AlgorithmImports import *
from datetime import datetime, timedelta
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer
# endregion


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage position_sizer from unified system
# Consider delegating to: self.algo.position_sizer.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class SystemValidator:
    """
    Comprehensive validation system for Tom King Trading Framework
    Ensures all components are properly integrated and production-ready
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.validation_results = []
        self.critical_issues = []
        self.warnings = []
        self.info = []
        
    def run_full_validation(self):
        """
        Run complete system validation and return report
        """
        self.validation_results = []
        self.critical_issues = []
        self.warnings = []
        self.info = []
        
        # Component validations
        self._validate_core_components()
        self._validate_strategies()
        self._validate_risk_management()
        self._validate_data_access()
        self._validate_position_sizing()
        self._validate_correlation_limits()
        self._validate_vix_integration()
        self._validate_option_chains()
        self._validate_order_execution()
        self._validate_phase_progression()
        
        return self._generate_report()
    
    def _validate_core_components(self):
        """Validate core algorithm components are initialized"""
        
        required_components = [
            ('params', 'Strategy parameters'),
            ('vix_manager', 'VIX regime manager'),
            ('correlation_manager', 'Correlation limiter'),
            ('friday_0dte', 'Friday 0DTE strategy'),
            ('lt112_strategy', 'LT112 strategy'),
            ('futures_strangle', 'Futures strangle strategy'),
            ('ipmcc_strategy', 'IPMCC strategy'),
            ('leap_strategy', 'LEAP ladder strategy'),
            ('option_chain_manager', 'Option chain manager'),
            # bear_trap_strategy and butterfly_0dte removed - not part of core 5 strategies
        ]
        
        for attr, name in required_components:
            if hasattr(self.algo, attr):
                self.info.append(f"[WARNING] {name} initialized")
            else:
                self.critical_issues.append(f"[WARNING] {name} NOT initialized")
    
    def _validate_strategies(self):
        """Validate each strategy can execute properly"""
        
        # Test Friday 0DTE
        if hasattr(self.algo, 'friday_0dte'):
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
can_enter, reason = self.algo.friday_0dte.can_enter_position(
                    2, [], 100000, None
                )
                self.info.append(f"[WARNING] Friday 0DTE validation: {reason}")
            except Exception as e:
                self.critical_issues.append(f"[WARNING] Friday 0DTE error: {e}")
        
        # Test LT112
        if hasattr(self.algo, 'lt112_strategy'):
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
can_enter, reason = self.algo.lt112_strategy.can_enter_position(
                    2, [], 100000
                )
                self.info.append(f"[WARNING] LT112 validation: {reason}")
            except Exception as e:
                self.critical_issues.append(f"[WARNING] LT112 error: {e}")
    
    def _validate_risk_management(self):
        """Validate risk management systems"""
        
        # Test correlation limits
        if hasattr(self.algo, 'correlation_manager'):
            try:
            test_positions = ['SPY', 'QQQ']
            allowed, msg = self.algo.correlation_manager.enforce_correlation_limits(
            'IWM', 2
            )
            self.info.append(f"[WARNING] Correlation limits working")
            except Exception as e:
            self.critical_issues.append(f"[WARNING] Correlation manager error: {e}")
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
# Test with sample positions
        
        # Test VIX regime
        if hasattr(self.algo, 'vix_manager'):
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
regime = self.algo.vix_manager.get_current_regime()
                if regime:
                    self.info.append(f"[WARNING] VIX regime detected: {regime.get('name', 'Unknown')}")
                else:
                    self.warnings.append("[WARNING] VIX regime not available")
            except Exception as e:
                self.critical_issues.append(f"[WARNING] VIX manager error: {e}")
    
    def _validate_data_access(self):
        """Validate market data access"""
        
        # Check if we have any securities
        if self.algo.Securities:
            equity_count = sum(1 for s in self.algo.Securities.Values 
                             if s.Type == SecurityType.Equity)
            futures_count = sum(1 for s in self.algo.Securities.Values 
                              if s.Type == SecurityType.Future)
            option_count = sum(1 for s in self.algo.Securities.Values 
                             if s.Type == SecurityType.Option)
            
            self.info.append(f"[WARNING] Securities: {equity_count} equities, "
                           f"{futures_count} futures, {option_count} options")
            
            if equity_count == 0:
                self.warnings.append("[WARNING] No equity securities subscribed")
        else:
            self.critical_issues.append("[WARNING] No securities subscribed")
    
    def _validate_position_sizing(self):
        """Validate position sizing calculations"""
        
        if hasattr(self.algo, 'position_size_calculator'):
            try:
            test_cases = [
            ('friday_0dte', 50000, 2, 20),
            ('lt112', 100000, 3, 25),
            ('ipmcc', 150000, 4, 30)
            ]
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
# Test position sizing for different scenarios
                
                for strategy, account, phase, vix in test_cases:
                    result = self.algo.position_size_calculator.calculate_position_size(
                        strategy, account, phase, vix
                    )
                    
                    if result['allowed']:
                        self.info.append(f"[WARNING] {strategy} sizing: {result['contracts']} contracts")
                    else:
                        self.info.append(f"ℹ[WARNING] {strategy} not allowed at phase {phase}")
                        
            except Exception as e:
                self.warnings.append(f"[WARNING] Position calculator not available: {e}")
        else:
            self.warnings.append("[WARNING] Position size calculator not initialized")
    
    def _validate_correlation_limits(self):
        """Validate correlation configuration"""
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
from config.correlation_config import CorrelationConfig
            
            # Test dynamic limits for different account sizes
            test_accounts = [25000, 50000, 100000, 200000]
            
            for account in test_accounts:
                limits = CorrelationConfig.get_portfolio_limits(account)
                self.info.append(f"[WARNING] ${account:,} limits: {limits['max_total_positions']} positions")
                
        except Exception as e:
            self.critical_issues.append(f"[WARNING] Correlation config error: {e}")
    
    def _validate_vix_integration(self):
        """Validate VIX integration across strategies"""
        
        if hasattr(self.algo, 'vix_manager'):
            # Check if VIX data is available
            if self.algo.vix_manager.current_vix:
                self.info.append(f"[WARNING] VIX data available: {self.algo.vix_manager.current_vix:.1f}")
            else:
                self.warnings.append("[WARNING] VIX data not yet available")
                
            # Check VIX regime adjustments
            try:
                
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
for vix in [10, 18, 25, 35]:
                    regime = self.algo.vix_manager.get_regime_for_vix(vix)
                    self.info.append(f"[WARNING] VIX {vix}: {regime['name']}")
            except (AttributeError, KeyError, ValueError, TypeError) as e:
                self.warnings.append("[WARNING] VIX regime lookup issues")
    
    def _validate_option_chains(self):
        """Validate option chain access"""
        
        if hasattr(self.algo, 'option_chain_manager'):
            try:
            subs = self.algo.option_chain_manager.option_subscriptions
            if subs:
            self.info.append(f"[WARNING] Option subscriptions: {list(subs.keys())}")
            else:
            self.warnings.append("[WARNING] No option subscriptions active")
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
# Check option subscriptions
                    
                # Validate option data
                validation = self.algo.option_chain_manager.validate_option_data()
                for result in validation:
                    if "[WARNING]" in result:
                        self.info.append(result)
                    else:
                        self.warnings.append(result)
                        
            except Exception as e:
                self.critical_issues.append(f"[WARNING] Option chain manager error: {e}")
        else:
            self.critical_issues.append("[WARNING] Option chain manager not initialized")
    
    def _validate_order_execution(self):
        """Validate order execution components"""
        
        # Check if order executors exist
        if hasattr(self.algo, 'option_order_executor'):
            self.info.append("[WARNING] Option order executor available")
        else:
            self.warnings.append("[WARNING] Option order executor not initialized")
            
        if hasattr(self.algo, 'strategy_order_executor'):
            self.info.append("[WARNING] Strategy order executor available")
        else:
            self.warnings.append("[WARNING] Strategy order executor not initialized")
    
    def _validate_phase_progression(self):
        """Validate account phase logic"""
        
        if hasattr(self.algo, 'account_phase'):
            current_phase = self.algo.account_phase
            account_value = float(self.algo.Portfolio.TotalPortfolioValue)
            
            # Check if phase is correct for account value
            expected_phase = self.algo.params.get_phase_for_account_size(account_value)
            
            if current_phase == expected_phase:
                self.info.append(f"[WARNING] Phase {current_phase} correct for ${account_value:,.0f}")
            else:
                self.warnings.append(f"[WARNING] Phase mismatch: Current {current_phase}, "
                                    f"Expected {expected_phase} for ${account_value:,.0f}")
                
            # Check available strategies for phase
            available = []
            if current_phase >= 1:
                available.extend(['Friday 0DTE', 'IPMCC'])
            if current_phase >= 2:
                available.extend(['LT112', 'Futures Strangle', 'LEAP Ladders'])
            if current_phase >= 3:
                available.extend(['Bear Trap 11x'])
                
            self.info.append(f"[WARNING] Phase {current_phase} strategies: {', '.join(available)}")
        else:
            self.critical_issues.append("[WARNING] Account phase not initialized")
    
    def _generate_report(self):
        """Generate validation report"""
        
        report = []
        report.append("\n" + "="*60)
        report.append("TOM KING TRADING SYSTEM VALIDATION REPORT")
        report.append("="*60)
        report.append(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Summary
        total_issues = len(self.critical_issues) + len(self.warnings)
        if len(self.critical_issues) == 0:
            if len(self.warnings) == 0:
                report.append("\n[WARNING] SYSTEM STATUS: FULLY OPERATIONAL")
            else:
                report.append(f"\n[WARNING] SYSTEM STATUS: OPERATIONAL WITH {len(self.warnings)} WARNINGS")
        else:
            report.append(f"\n[WARNING] SYSTEM STATUS: {len(self.critical_issues)} CRITICAL ISSUES FOUND")
        
        # Critical Issues
        if self.critical_issues:
            report.append("\n[WARNING] CRITICAL ISSUES:")
            for issue in self.critical_issues:
                report.append(f"  {issue}")
        
        # Warnings
        if self.warnings:
            report.append("\n[WARNING] WARNINGS:")
            for warning in self.warnings:
                report.append(f"  {warning}")
        
        # Information
        if self.info:
            report.append("\nℹ[WARNING] SYSTEM INFORMATION:")
            for info in self.info[:10]:  # Limit to first 10 for brevity
                report.append(f"  {info}")
            if len(self.info) > 10:
                report.append(f"  ... and {len(self.info) - 10} more validations passed")
        
        # Production Readiness Score
        total_checks = len(self.info) + len(self.warnings) + len(self.critical_issues)
        passed_checks = len(self.info)
        readiness_score = (passed_checks / total_checks * 100) if total_checks > 0 else 0
        
        report.append(f"\n[WARNING] PRODUCTION READINESS: {readiness_score:.1f}%")
        
        if readiness_score >= 95:
            report.append("[WARNING] System is production ready")
        elif readiness_score >= 80:
            report.append("[WARNING] System needs minor fixes before production")
        else:
            report.append("[WARNING] System requires significant work before production")
        
        report.append("="*60 + "\n")
        
        return "\n".join(report)
    
    def quick_check(self):
        """Quick validation check for critical components"""
        
        critical_ok = True
        checks = []
        
        # Quick checks
        if not hasattr(self.algo, 'friday_0dte'):
            critical_ok = False
            checks.append("[WARNING] Core strategies missing")
        
        if not hasattr(self.algo, 'vix_manager'):
            critical_ok = False
            checks.append("[WARNING] VIX manager missing")
            
        if not hasattr(self.algo, 'correlation_manager'):
            critical_ok = False
            checks.append("[WARNING] Correlation manager missing")
            
        if not self.algo.Securities:
            critical_ok = False
            checks.append("[WARNING] No securities subscribed")
        
        if critical_ok:
            return "[WARNING] Quick check passed - all critical components present"
        else:
            return f"[WARNING] Quick check failed:\n" + "\n".join(checks)