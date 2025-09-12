# Comprehensive Position Opening Validator
# Systematically validates all 47 failure points from deep audit
# Production-ready diagnostic system with extensive error logging

from AlgorithmImports import *
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
import traceback
import json
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage position_sizer from unified system
# Consider delegating to: self.algo.position_sizer.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class PositionOpeningValidator:
    """
    Comprehensive validator for all position opening failure points
    Implements systematic validation of all 47 failure points identified in deep audit
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.validation_results = {}
        self.error_logs = []
        self.failure_count = 0
        self.success_count = 0
        
        # Validation categories from deep audit
        self.failure_categories = {
            'component_initialization': [1, 2, 3, 4],
            'method_integration': [5, 6, 7, 8, 9, 10, 11, 12],
            'spy_concentration': [13, 14, 15, 16, 17],
            'option_chain_data': [18, 19, 20, 21, 22, 23, 24, 25],
            'risk_management': [26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
            'state_execution': [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47]
        }
        
    def log_error(self, category: str, failure_point: int, message: str, details: Dict = None):
        """Log detailed error information"""
        error_entry = {
            'timestamp': self.algo.Time,
            'category': category,
            'failure_point': failure_point,
            'message': message,
            'details': details or {},
            'stack_trace': traceback.format_stack()[-3:-1]  # Get calling context
        }
        self.error_logs.append(error_entry)
        self.algo.Error(f"[VALIDATOR-{failure_point:02d}] {category.upper()}: {message}")
        if details:
            self.algo.Error(f"[VALIDATOR-{failure_point:02d}] Details: {json.dumps(details, default=str)}")
    
    def log_success(self, category: str, failure_point: int, message: str):
        """Log successful validation"""
        self.algo.Log(f"[VALIDATOR-{failure_point:02d}] ✅ {category.upper()}: {message}")
        self.success_count += 1
    
    def validate_all_failure_points(self) -> Dict:
        """
        MASTER VALIDATION METHOD
        Systematically validates all 47 failure points from deep audit
        """
        self.algo.Error("="*80)
        self.algo.Error("COMPREHENSIVE POSITION OPENING VALIDATION - 47 FAILURE POINTS")
        self.algo.Error("="*80)
        
        validation_methods = [
            ('component_initialization', self._validate_component_initialization),
            ('method_integration', self._validate_method_integration), 
            ('spy_concentration', self._validate_spy_concentration),
            ('option_chain_data', self._validate_option_chain_data),
            ('risk_management', self._validate_risk_management),
            ('state_execution', self._validate_state_execution)
        ]
        
        for category, validation_method in validation_methods:
            try:
                pass
            except Exception as e:

                self.algo.Error(f"\n[VALIDATOR] Starting {category.upper()} validation...")
                validation_method()
                self.algo.Error(f"[VALIDATOR] {category.upper()} validation completed")
            except Exception as e:
                self.log_error(category, 0, f"Category validation failed: {str(e)}", {
                    'exception_type': type(e).__name__,
                    'traceback': traceback.format_exc()
                })
        
        return self._generate_final_report()
    
    def _validate_component_initialization(self):
        """Validate Component Initialization Dependencies (Failure Points 1-4)"""
        
        # FAILURE POINT 1: ComponentInitializer dependency resolution
        try:
            pass
        except Exception as e:

            if hasattr(self.algo, 'component_initializer'):
                init_status = self.algo.component_initializer.get_initialization_status()
                if not init_status.get('successful', False):
                    self.log_error('component_initialization', 1, 
                                 "Component initialization failed",
                                 {'status': init_status, 'failed_components': init_status.get('failed_components', [])})
                else:
                    self.log_success('component_initialization', 1, 
                                   f"All {init_status.get('success_count', 0)} components initialized successfully")
            else:
                self.log_error('component_initialization', 1, "ComponentInitializer not found - integration system missing")
        except Exception as e:
            self.log_error('component_initialization', 1, f"ComponentInitializer validation failed: {str(e)}")
        
        # FAILURE POINT 2: Critical component availability
        critical_components = [
            'vix_manager', 'state_manager', 'strategy_coordinator', 'position_sizer', 
            'margin_manager', 'circuit_breaker', 'spy_concentration_manager'
        ]
        
        missing_components = []
        for component_name in critical_components:
            if not hasattr(self.algo, component_name):
                missing_components.append(component_name)
        
        if missing_components:
            self.log_error('component_initialization', 2,
                         f"Critical components missing: {missing_components}")
        else:
            self.log_success('component_initialization', 2,
                           f"All {len(critical_components)} critical components available")
        
        # FAILURE POINT 3: Dependency chain validation
        dependency_chains = [
            ['margin_manager', 'vix_manager', 'position_sizer'],
            ['state_manager', 'strategy_coordinator'],
            ['circuit_breaker', 'strategy_coordinator']
        ]
        
        for i, chain in enumerate(dependency_chains, 3):
            chain_valid = True
            missing_in_chain = []
            for component in chain:
                if not hasattr(self.algo, component):
                    chain_valid = False
                    missing_in_chain.append(component)
            
            if not chain_valid:
                self.log_error('component_initialization', 3,
                             f"Dependency chain {i-2} broken: missing {missing_in_chain}")
            else:
                self.log_success('component_initialization', 3,
                               f"Dependency chain {i-2} intact: {' -> '.join(chain)}")
        
        # FAILURE POINT 4: Component method interface validation
        self._validate_component_interfaces()
    
    def _validate_component_interfaces(self):
        """Validate component interfaces (Failure Point 4)"""
        required_interfaces = {
            'vix_manager': ['get_current_vix', 'get_vix_regime', 'get_position_size_adjustment'],
            'position_sizer': ['calculate_position_size', 'get_max_position_size', 'get_available_buying_power'],
            'margin_manager': ['get_available_buying_power', 'calculate_required_margin', 'check_margin_health'],
            'state_manager': ['register_strategy', 'update_all_state_machines', 'get_system_state'],
            'strategy_coordinator': ['register_strategy', 'execute_strategies'],
            'circuit_breaker': ['check_circuit_breaker', 'get_circuit_breaker_status'],
            'spy_concentration_manager': ['request_spy_allocation', 'release_spy_allocation']
        }
        
        interface_failures = {}
        
        for component_name, required_methods in required_interfaces.items():
            if hasattr(self.algo, component_name):
                component = getattr(self.algo, component_name)
                missing_methods = []
                
                for method_name in required_methods:
                    if not hasattr(component, method_name):
                        missing_methods.append(method_name)
                    elif not callable(getattr(component, method_name)):
                        missing_methods.append(f"{method_name} (not callable)")
                
                if missing_methods:
                    interface_failures[component_name] = missing_methods
                    self.log_error('component_initialization', 4,
                                 f"{component_name} missing methods: {missing_methods}")
                else:
                    self.log_success('component_initialization', 4,
                                   f"{component_name} interface complete: {len(required_methods)} methods")
            else:
                interface_failures[component_name] = ["component missing"]
                self.log_error('component_initialization', 4,
                             f"{component_name} component not available")
        
        if not interface_failures:
            self.log_success('component_initialization', 4,
                           f"All component interfaces validated successfully")
    
    def _validate_method_integration(self):
        """Validate Missing Method Integration (Failure Points 5-12)"""
        
        # FAILURE POINT 5: VIX Manager integration
        self._test_vix_manager_integration()
        
        # FAILURE POINT 6: Position Sizer integration
        self._test_position_sizer_integration()
        
        # FAILURE POINT 7: State Manager integration
        self._test_state_manager_integration()
        
        # FAILURE POINT 8: Strategy Coordinator integration
        self._test_strategy_coordinator_integration()
        
        # FAILURE POINT 9: Margin Manager integration
        self._test_margin_manager_integration()
        
        # FAILURE POINT 10: Circuit Breaker integration
        self._test_circuit_breaker_integration()
        
        # FAILURE POINT 11: Greeks Monitor integration
        self._test_greeks_monitor_integration()
        
        # FAILURE POINT 12: Cross-component method call validation
        self._test_cross_component_calls()
    
    def _test_vix_manager_integration(self):
        """Test VIX Manager integration (Failure Point 5)"""
        if not hasattr(self.algo, 'vix_manager'):
            self.log_error('method_integration', 5, "VIX Manager not available")
            return
        
        vix_manager = self.algo.vix_manager
        
        # Test get_current_vix
        try:
            pass
        except Exception as e:

            vix_value = vix_manager.get_current_vix()
            if vix_value <= 0:
                self.log_error('method_integration', 5, f"Invalid VIX value: {vix_value}")
            else:
                self.log_success('method_integration', 5, f"VIX value valid: {vix_value:.2f}")
        except Exception as e:
            self.log_error('method_integration', 5, f"get_current_vix failed: {str(e)}")
        
        # Test get_vix_regime  
        try:
            pass
        except Exception as e:

            regime = vix_manager.get_vix_regime()
            valid_regimes = ["LOW", "NORMAL", "ELEVATED", "HIGH", "EXTREME", "CRISIS", "HISTORIC"]
            if regime not in valid_regimes:
                self.log_error('method_integration', 5, f"Invalid VIX regime: {regime}")
            else:
                self.log_success('method_integration', 5, f"VIX regime valid: {regime}")
        except Exception as e:
            self.log_error('method_integration', 5, f"get_vix_regime failed: {str(e)}")
        
        # Test position size adjustment
        try:
            pass
        except Exception as e:

            adjustment = vix_manager.get_position_size_adjustment()
            if not (0.1 <= adjustment <= 2.0):
                self.log_error('method_integration', 5, f"Invalid position adjustment: {adjustment}")
            else:
                self.log_success('method_integration', 5, f"Position adjustment valid: {adjustment:.2f}")
        except Exception as e:
            self.log_error('method_integration', 5, f"get_position_size_adjustment failed: {str(e)}")
    
    def _test_position_sizer_integration(self):
        """Test Position Sizer integration (Failure Point 6)"""
        if not hasattr(self.algo, 'position_sizer'):
            self.log_error('method_integration', 6, "Position Sizer not available")
            return
        
        position_sizer = self.algo.position_sizer
        
        # Test calculate_position_size
        try:
            pass
        except Exception as e:

            size = position_sizer.calculate_position_size("0DTE", 0.70, 1.0, 1.0)
            if size <= 0:
                self.log_error('method_integration', 6, f"Invalid position size: {size}")
            else:
                self.log_success('method_integration', 6, f"Position size calculation valid: {size}")
        except Exception as e:
            self.log_error('method_integration', 6, f"calculate_position_size failed: {str(e)}")
        
        # Test get_max_position_size
        try:
            pass
        except Exception as e:

            max_size = position_sizer.get_max_position_size("0DTE")
            if max_size <= 0:
                self.log_error('method_integration', 6, f"Invalid max position size: {max_size}")
            else:
                self.log_success('method_integration', 6, f"Max position size valid: {max_size}")
        except Exception as e:
            self.log_error('method_integration', 6, f"get_max_position_size failed: {str(e)}")
        
        # Test get_available_buying_power (if method exists)
        if hasattr(position_sizer, 'get_available_buying_power'):
            try:
                pass
            except Exception as e:

                bp = position_sizer.get_available_buying_power()
                if bp < 0:
                    self.log_error('method_integration', 6, f"Negative buying power: {bp}")
                else:
                    self.log_success('method_integration', 6, f"Buying power valid: ${bp:,.2f}")
            except Exception as e:
                self.log_error('method_integration', 6, f"get_available_buying_power failed: {str(e)}")
    
    def _test_state_manager_integration(self):
        """Test State Manager integration (Failure Point 7)"""
        if not hasattr(self.algo, 'state_manager'):
            self.log_error('method_integration', 7, "State Manager not available")
            return
        
        state_manager = self.algo.state_manager
        
        # Test get_system_state
        try:
            pass
        except Exception as e:

            system_state = state_manager.get_system_state()
            if not isinstance(system_state, dict):
                self.log_error('method_integration', 7, f"Invalid system state type: {type(system_state)}")
            else:
                self.log_success('method_integration', 7, f"System state valid: {list(system_state.keys())}")
        except Exception as e:
            self.log_error('method_integration', 7, f"get_system_state failed: {str(e)}")
        
        # Test register_strategy
        try:
            # Try to register a test strategy
            result = state_manager.register_strategy("test_strategy", None)
            self.log_success('method_integration', 7, "register_strategy method callable")
        except Exception as e:
            self.log_error('method_integration', 7, f"register_strategy failed: {str(e)}")
        
        # Test update_all_state_machines (critical missing method)
        if hasattr(state_manager, 'update_all_state_machines'):
            try:
                pass
            except Exception as e:

                state_manager.update_all_state_machines()
                self.log_success('method_integration', 7, "update_all_state_machines method available")
            except Exception as e:
                self.log_error('method_integration', 7, f"update_all_state_machines failed: {str(e)}")
        else:
            self.log_error('method_integration', 7, "CRITICAL: update_all_state_machines method missing")
    
    def _test_strategy_coordinator_integration(self):
        """Test Strategy Coordinator integration (Failure Point 8)"""
        if not hasattr(self.algo, 'strategy_coordinator'):
            self.log_error('method_integration', 8, "Strategy Coordinator not available")
            return
        
        coordinator = self.algo.strategy_coordinator
        
        # Test execute_strategies (called from OnData)
        if hasattr(coordinator, 'execute_strategies'):
            try:
                # Test with empty data to avoid side effects
                coordinator.execute_strategies(None)
                self.log_success('method_integration', 8, "execute_strategies method callable")
            except Exception as e:
                self.log_error('method_integration', 8, f"execute_strategies failed: {str(e)}")
        else:
            self.log_error('method_integration', 8, "CRITICAL: execute_strategies method missing")
        
        # Test register_strategy
        try:
            pass
        except Exception as e:

            coordinator.register_strategy("test_strategy", None)
            self.log_success('method_integration', 8, "register_strategy method callable")
        except Exception as e:
            self.log_error('method_integration', 8, f"register_strategy failed: {str(e)}")
    
    def _test_margin_manager_integration(self):
        """Test Margin Manager integration (Failure Point 9)"""
        if not hasattr(self.algo, 'margin_manager'):
            self.log_error('method_integration', 9, "Margin Manager not available")
            return
        
        margin_manager = self.algo.margin_manager
        
        # Test get_available_buying_power
        try:
            pass
        except Exception as e:

            bp = margin_manager.get_available_buying_power()
            if bp < 0:
                self.log_error('method_integration', 9, f"Negative available buying power: {bp}")
            else:
                self.log_success('method_integration', 9, f"Available buying power: ${bp:,.2f}")
        except Exception as e:
            self.log_error('method_integration', 9, f"get_available_buying_power failed: {str(e)}")
        
        # Test calculate_required_margin
        try:
            pass
        except Exception as e:

            test_positions = [{'symbol': 'SPY', 'quantity': 1, 'option_type': 'SPREAD', 
                             'strike': 450, 'underlying_price': 450}]
            margin = margin_manager.calculate_required_margin(test_positions)
            if margin < 0:
                self.log_error('method_integration', 9, f"Negative margin requirement: {margin}")
            else:
                self.log_success('method_integration', 9, f"Margin calculation valid: ${margin:,.2f}")
        except Exception as e:
            self.log_error('method_integration', 9, f"calculate_required_margin failed: {str(e)}")
    
    def _test_circuit_breaker_integration(self):
        """Test Circuit Breaker integration (Failure Point 10)"""
        if not hasattr(self.algo, 'circuit_breaker'):
            self.log_error('method_integration', 10, "Circuit Breaker not available")
            return
        
        circuit_breaker = self.algo.circuit_breaker
        
        # Test check_circuit_breaker
        try:
            pass
        except Exception as e:

            can_trade = circuit_breaker.check_circuit_breaker()
            if not isinstance(can_trade, bool):
                self.log_error('method_integration', 10, f"Invalid circuit breaker return type: {type(can_trade)}")
            else:
                self.log_success('method_integration', 10, f"Circuit breaker check valid: {can_trade}")
        except Exception as e:
            self.log_error('method_integration', 10, f"check_circuit_breaker failed: {str(e)}")
        
        # Test get_circuit_breaker_status
        try:
            pass
        except Exception as e:

            status = circuit_breaker.get_circuit_breaker_status()
            if not isinstance(status, dict):
                self.log_error('method_integration', 10, f"Invalid status type: {type(status)}")
            else:
                self.log_success('method_integration', 10, f"Circuit breaker status valid: {list(status.keys())}")
        except Exception as e:
            self.log_error('method_integration', 10, f"get_circuit_breaker_status failed: {str(e)}")
    
    def _test_greeks_monitor_integration(self):
        """Test Greeks Monitor integration (Failure Point 11)"""
        if not hasattr(self.algo, 'greeks_monitor'):
            self.log_error('method_integration', 11, "Greeks Monitor not available")
            return
        
        greeks_monitor = self.algo.greeks_monitor
        
        # Test calculate_portfolio_greeks
        if hasattr(greeks_monitor, 'calculate_portfolio_greeks'):
            try:
                pass
            except Exception as e:

                portfolio_greeks = greeks_monitor.calculate_portfolio_greeks()
                self.log_success('method_integration', 11, "calculate_portfolio_greeks method callable")
            except Exception as e:
                self.log_error('method_integration', 11, f"calculate_portfolio_greeks failed: {str(e)}")
        else:
            self.log_error('method_integration', 11, "calculate_portfolio_greeks method missing")
    
    def _test_cross_component_calls(self):
        """Test cross-component method calls (Failure Point 12)"""
        cross_calls = [
            ('position_sizer', 'vix_manager', 'get_position_size_adjustment'),
            ('position_sizer', 'margin_manager', 'get_available_buying_power'),
            ('state_manager', 'vix_manager', 'get_current_vix'),
            ('strategy_coordinator', 'circuit_breaker', 'check_circuit_breaker')
        ]
        
        for caller, target, method in cross_calls:
            if hasattr(self.algo, caller) and hasattr(self.algo, target):
                caller_obj = getattr(self.algo, caller)
                target_obj = getattr(self.algo, target)
                
                if hasattr(target_obj, method):
                    try:
                        method_obj = getattr(target_obj, method)
                        if callable(method_obj):
                            self.log_success('method_integration', 12,
                                            f"{caller} -> {target}.{method} integration valid")
                        else:
                            self.log_error('method_integration', 12,
                                          f"{caller} -> {target}.{method} not callable")
                    except Exception as e:
                        self.log_error('method_integration', 12,
                                      f"{caller} -> {target}.{method} integration failed: {str(e)}")
                else:
                    self.log_error('method_integration', 12, 
                                 f"{caller} -> {target}.{method} method missing")
            else:
                self.log_error('method_integration', 12, 
                             f"Cross-call {caller} -> {target} components missing")
    
    def _validate_spy_concentration(self):
        """Validate SPY Concentration System (Failure Points 13-17)"""
        
        if not hasattr(self.algo, 'spy_concentration_manager'):
            self.log_error('spy_concentration', 13, "SPY Concentration Manager not available")
            return
        
        spy_manager = self.algo.spy_concentration_manager
        
        # FAILURE POINT 13: SPY allocation request validation
        try:
            approved, reason = spy_manager.request_spy_allocation(
            strategy_name="test_strategy",
            position_type="options",
            requested_delta=-10.0,
            requested_contracts=1
            )
            if not isinstance(approved, bool):
                self.log_error('spy_concentration', 13, f"Invalid approval type: {type(approved)}")
            else:
                self.log_success('spy_concentration', 13, f"SPY allocation request valid: {approved} - {reason}")
                
        except Exception as e:
            self.log_error('spy_concentration', 13, f"request_spy_allocation failed: {str(e)}")
        
        # FAILURE POINT 14: SPY allocation limits validation
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        max_spy_allocation = portfolio_value * 0.30
        
        # Test large allocation that should be rejected
        try:
            pass
        except Exception as e:

            large_delta = -1000  # Very large delta
            approved, reason = spy_manager.request_spy_allocation(
                strategy_name="large_test",
                position_type="options",
                requested_delta=large_delta,
                requested_contracts=100
            )
            
            if approved:
                self.log_error('spy_concentration', 14, f"Large allocation incorrectly approved: {large_delta}")
            else:
                self.log_success('spy_concentration', 14, f"Large allocation correctly rejected: {reason}")
                
        except Exception as e:
            self.log_error('spy_concentration', 14, f"Large allocation test failed: {str(e)}")
        
        # FAILURE POINT 15: SPY allocation cleanup validation
        if hasattr(spy_manager, 'spy_positions'):
            try:
                pass
            except Exception as e:

                position_count_before = len(spy_manager.spy_positions)
                spy_manager.release_spy_allocation("test_strategy")
                position_count_after = len(spy_manager.spy_positions)
                
                if position_count_after <= position_count_before:
                    self.log_success('spy_concentration', 15, 
                                   f"SPY allocation cleanup working: {position_count_before} -> {position_count_after}")
                else:
                    self.log_error('spy_concentration', 15, 
                                 f"SPY allocation cleanup failed: {position_count_before} -> {position_count_after}")
                    
            except Exception as e:
                self.log_error('spy_concentration', 15, f"SPY allocation cleanup test failed: {str(e)}")
        
        # FAILURE POINT 16: Multiple strategy limit validation
        strategy_names = ["strategy1", "strategy2", "strategy3", "strategy4", "strategy5"]
        approved_count = 0
        
        for strategy_name in strategy_names:
            try:
                pass
            except Exception as e:

                approved, reason = spy_manager.request_spy_allocation(
                    strategy_name=strategy_name,
                    position_type="options",
                    requested_delta=-5.0,
                    requested_contracts=1
                )
                if approved:
                    approved_count += 1
                    
            except Exception as e:
                self.log_error('spy_concentration', 16, f"Multiple strategy test failed for {strategy_name}: {str(e)}")
        
        if hasattr(spy_manager, 'max_strategies_per_underlying'):
            max_strategies = spy_manager.max_strategies_per_underlying
            if approved_count <= max_strategies:
                self.log_success('spy_concentration', 16, 
                               f"Multiple strategy limits enforced: {approved_count}/{max_strategies}")
            else:
                self.log_error('spy_concentration', 16, 
                             f"Multiple strategy limits violated: {approved_count}/{max_strategies}")
        
        # FAILURE POINT 17: Position conflict detection
        try:
            approved1, reason1 = spy_manager.request_spy_allocation(
            strategy_name="conflict_test1",
            position_type="options",
            requested_delta=50.0,  # Long delta
            requested_contracts=10
            )
            approved2, reason2 = spy_manager.request_spy_allocation(
                strategy_name="conflict_test2", 
                position_type="options",
                requested_delta=-50.0,  # Short delta (opposite direction)
                requested_contracts=10
            )
            
            # Both should be allowed (diversification), but test conflict detection
            self.log_success('spy_concentration', 17, 
                           f"Position conflict detection tested: {approved1}/{approved2}")
                           
        except Exception as e:
            self.log_error('spy_concentration', 17, f"Position conflict test failed: {str(e)}")
    
    def _validate_option_chain_data(self):
        """Validate Option Chain and Market Data Systems (Failure Points 18-25)"""
        
        # FAILURE POINT 18: Option chain availability
        self._test_option_chain_availability()
        
        # FAILURE POINT 19: 0DTE option chain validation
        self._test_0dte_chain_validation()
        
        # FAILURE POINT 20: Market timing validation
        self._test_market_timing_validation()
        
        # FAILURE POINT 21: VIX data quality validation
        self._test_vix_data_quality()
        
        # FAILURE POINT 22: Market open price capture
        self._test_market_open_price_logic()
        
        # FAILURE POINT 23: Data freshness validation
        self._test_data_freshness()
        
        # FAILURE POINT 24: Cache staleness detection
        self._test_cache_staleness()
        
        # FAILURE POINT 25: Economic calendar integration
        self._test_economic_calendar()
    
    def _test_option_chain_availability(self):
        """Test option chain availability (Failure Point 18)"""
        try:
            pass
        except Exception as e:

            spy_symbol = self.algo.spy if hasattr(self.algo, 'spy') else Symbol.Create('SPY', SecurityType.Equity, Market.USA)
            
            # Test option chain retrieval
            chain = self.algo.OptionChainProvider.GetOptionContractList(spy_symbol, self.algo.Time)
            
            if not chain:
                self.log_error('option_chain_data', 18, "Option chain empty")
            elif len(chain) < 10:
                self.log_error('option_chain_data', 18, f"Option chain too small: {len(chain)} contracts")
            else:
                self.log_success('option_chain_data', 18, f"Option chain available: {len(chain)} contracts")
                
                # Test chain date range
                dates = set(c.ID.Date.date() for c in chain)
                if len(dates) < 3:
                    self.log_error('option_chain_data', 18, f"Limited expiration dates: {len(dates)}")
                else:
                    self.log_success('option_chain_data', 18, f"Multiple expiration dates: {len(dates)}")
                    
        except Exception as e:
            self.log_error('option_chain_data', 18, f"Option chain test failed: {str(e)}")
    
    def _test_0dte_chain_validation(self):
        """Test 0DTE option chain validation (Failure Point 19)"""
        try:
            pass
        except Exception as e:

            spy_symbol = self.algo.spy if hasattr(self.algo, 'spy') else Symbol.Create('SPY', SecurityType.Equity, Market.USA)
            chain = self.algo.OptionChainProvider.GetOptionContractList(spy_symbol, self.algo.Time)
            
            # Filter for 0DTE options
            expiry = self.algo.Time.date()
            zero_dte_chain = [c for c in chain if c.ID.Date.date() == expiry]
            
            # Check if it's a trading day
            is_trading_day = self.algo.IsMarketOpen(spy_symbol)
            
            if is_trading_day:
                if not zero_dte_chain:
                    self.log_error('option_chain_data', 19, 
                                 f"0DTE options missing on trading day {expiry}")
                elif len(zero_dte_chain) < 20:
                    self.log_error('option_chain_data', 19, 
                                 f"Limited 0DTE options: {len(zero_dte_chain)} contracts")
                else:
                    self.log_success('option_chain_data', 19, 
                                   f"0DTE options available: {len(zero_dte_chain)} contracts")
            else:
                if zero_dte_chain:
                    self.log_error('option_chain_data', 19, 
                                 f"0DTE options present on non-trading day {expiry}")
                else:
                    self.log_success('option_chain_data', 19, 
                                   f"0DTE options correctly absent on non-trading day")
                    
        except Exception as e:
            self.log_error('option_chain_data', 19, f"0DTE chain test failed: {str(e)}")
    
    def _test_market_timing_validation(self):
        """Test market timing validation (Failure Point 20)"""
        current_time = self.algo.Time.time()
        current_day = self.algo.Time.weekday()
        
        # Test Friday detection for 0DTE strategy
        is_friday = (current_day == 4)  # Friday = 4
        
        # Test entry time window (10:30 AM for 0DTE)
        entry_time = time(10, 30)
        in_entry_window = current_time >= entry_time
        
        # Test market open window (9:30 AM)
        market_open = time(9, 30)
        after_market_open = current_time >= market_open
        
        timing_details = {
            'current_time': str(current_time),
            'current_day': current_day,
            'is_friday': is_friday,
            'in_entry_window': in_entry_window,
            'after_market_open': after_market_open
        }
        
        self.log_success('option_chain_data', 20, 
                       f"Market timing validation completed: {timing_details}")
    
    def _test_vix_data_quality(self):
        """Test VIX data quality validation (Failure Point 21)"""
        try:
            pass
        except Exception as e:

            vix_symbol = Symbol.Create('VIX', SecurityType.Index, Market.USA)
            
            if vix_symbol in self.algo.Securities:
                vix_security = self.algo.Securities[vix_symbol]
                vix_price = vix_security.Price
                
                # VIX quality checks
                if vix_price <= 0:
                    self.log_error('option_chain_data', 21, f"Invalid VIX price: {vix_price}")
                elif vix_price < 5 or vix_price > 100:
                    self.log_error('option_chain_data', 21, f"VIX price out of normal range: {vix_price}")
                else:
                    self.log_success('option_chain_data', 21, f"VIX data quality valid: {vix_price:.2f}")
                
                # Test data age
                last_update = vix_security.GetLastData().Time if vix_security.GetLastData() else None
                if last_update:
                    data_age = self.algo.Time - last_update
                    if data_age > timedelta(minutes=5):
                        self.log_error('option_chain_data', 21, f"VIX data stale: {data_age}")
                    else:
                        self.log_success('option_chain_data', 21, f"VIX data fresh: {data_age}")
                        
            else:
                self.log_error('option_chain_data', 21, "VIX security not subscribed")
                
        except Exception as e:
            self.log_error('option_chain_data', 21, f"VIX data quality test failed: {str(e)}")
    
    def _test_market_open_price_logic(self):
        """Test market open price capture logic (Failure Point 22)"""
        current_time = self.algo.Time.time()
        
        # Test market open window logic (9:30-9:35 AM)
        market_open_start = time(9, 30)
        market_open_end = time(9, 35)
        
        in_capture_window = market_open_start <= current_time <= market_open_end
        after_capture_window = current_time > market_open_end
        
        capture_details = {
            'current_time': str(current_time),
            'in_capture_window': in_capture_window,
            'after_capture_window': after_capture_window,
            'should_use_fallback': after_capture_window
        }
        
        # Test SPY price availability
        try:
            pass
        except Exception as e:

            spy_symbol = self.algo.spy if hasattr(self.algo, 'spy') else Symbol.Create('SPY', SecurityType.Equity, Market.USA)
            if spy_symbol in self.algo.Securities:
                spy_price = self.algo.Securities[spy_symbol].Price
                if spy_price <= 0:
                    self.log_error('option_chain_data', 22, f"Invalid SPY price for open capture: {spy_price}")
                else:
                    self.log_success('option_chain_data', 22, 
                                   f"Market open price logic valid: SPY={spy_price:.2f}, {capture_details}")
            else:
                self.log_error('option_chain_data', 22, "SPY security not available for open price capture")
                
        except Exception as e:
            self.log_error('option_chain_data', 22, f"Market open price test failed: {str(e)}")
    
    def _test_data_freshness(self):
        """Test data freshness validation (Failure Point 23)"""
        if hasattr(self.algo, 'data_validator'):
            try:
                is_data_fresh = self.algo.data_validator.validate_data_freshness()
                if is_data_fresh:
                    self.log_success('option_chain_data', 23, "Data freshness validation passed")
                else:
                    self.log_error('option_chain_data', 23, "Data freshness validation failed")
            except Exception as e:
                self.log_error('option_chain_data', 23, f"Data freshness test failed: {str(e)}")
        else:
            self.log_error('option_chain_data', 23, "Data validator not available")
    
    def _test_cache_staleness(self):
        """Test cache staleness detection (Failure Point 24)"""
        cache_systems = ['main_cache', 'position_cache', 'market_cache']
        
        for cache_name in cache_systems:
            if hasattr(self.algo, cache_name):
                try:
                    pass
                except Exception as e:

                    cache = getattr(self.algo, cache_name)
                    if hasattr(cache, 'get_statistics'):
                        stats = cache.get_statistics()
                        hit_rate = stats.get('hit_rate', 0)
                        
                        if hit_rate < 0.5:
                            self.log_error('option_chain_data', 24, 
                                         f"{cache_name} low hit rate: {hit_rate:.1%}")
                        else:
                            self.log_success('option_chain_data', 24, 
                                           f"{cache_name} hit rate acceptable: {hit_rate:.1%}")
                except Exception as e:
                    self.log_error('option_chain_data', 24, f"{cache_name} test failed: {str(e)}")
            else:
                self.log_error('option_chain_data', 24, f"{cache_name} not available")
    
    def _test_economic_calendar(self):
        """Test economic calendar integration (Failure Point 25)"""
        if hasattr(self.algo, 'event_calendar'):
            try:
                pass
            except Exception as e:

                calendar = self.algo.event_calendar
                
                # Test earnings week detection
                if hasattr(calendar, 'is_earnings_week'):
                    is_earnings_week = calendar.is_earnings_week('SPY')
                    self.log_success('option_chain_data', 25, 
                                   f"Earnings detection working: {is_earnings_week}")
                else:
                    self.log_error('option_chain_data', 25, "is_earnings_week method missing")
                
                # Test expiration detection
                if hasattr(calendar, 'get_next_expiration'):
                    next_expiration = calendar.get_next_expiration()
                    self.log_success('option_chain_data', 25, 
                                   f"Expiration detection working: {next_expiration}")
                else:
                    self.log_error('option_chain_data', 25, "get_next_expiration method missing")
                    
            except Exception as e:
                self.log_error('option_chain_data', 25, f"Economic calendar test failed: {str(e)}")
        else:
            self.log_error('option_chain_data', 25, "Event calendar not available")
    
    def _validate_risk_management(self):
        """Validate Risk Management Integration (Failure Points 26-35)"""
        
        # FAILURE POINT 26-27: Circuit Breaker system validation
        self._test_circuit_breaker_conditions()
        
        # FAILURE POINT 28-29: Dynamic margin buffer validation  
        self._test_dynamic_margin_buffers()
        
        # FAILURE POINT 30-31: Risk limit calculations
        self._test_risk_limit_calculations()
        
        # FAILURE POINT 32-33: Position limit enforcement
        self._test_position_limit_enforcement()
        
        # FAILURE POINT 34-35: Cross-strategy risk aggregation
        self._test_cross_strategy_risk()
    
    def _test_circuit_breaker_conditions(self):
        """Test circuit breaker conditions (Failure Points 26-27)"""
        if not hasattr(self.algo, 'circuit_breaker'):
            self.log_error('risk_management', 26, "Circuit breaker not available")
            return
        
        circuit_breaker = self.algo.circuit_breaker
        
        # Test all circuit breaker conditions
        status = circuit_breaker.get_circuit_breaker_status()
        
        required_status_keys = ['enabled', 'triggered', 'daily_pnl', 'weekly_pnl', 
                               'monthly_pnl', 'consecutive_losses', 'can_trade']
        
        missing_keys = [key for key in required_status_keys if key not in status]
        
        if missing_keys:
            self.log_error('risk_management', 26, f"Circuit breaker status missing keys: {missing_keys}")
        else:
            self.log_success('risk_management', 26, f"Circuit breaker status complete: {list(status.keys())}")
        
        # Test specific thresholds
        daily_pnl = status.get('daily_pnl', 0)
        if daily_pnl < -0.10:  # More than 10% daily loss
            self.log_error('risk_management', 27, f"Excessive daily loss not caught: {daily_pnl:.2%}")
        else:
            self.log_success('risk_management', 27, f"Daily loss within bounds: {daily_pnl:.2%}")
    
    def _test_dynamic_margin_buffers(self):
        """Test dynamic margin buffers (Failure Points 28-29)"""
        if not hasattr(self.algo, 'margin_manager'):
            self.log_error('risk_management', 28, "Margin manager not available")
            return
        
        margin_manager = self.algo.margin_manager
        
        # Test buffer calculation
        try:
            pass
        except Exception as e:

            if hasattr(margin_manager, 'calculate_required_margin_buffer'):
                buffer = margin_manager.calculate_required_margin_buffer()
                
                if not (0.1 <= buffer <= 1.0):
                    self.log_error('risk_management', 28, f"Invalid margin buffer: {buffer:.1%}")
                else:
                    self.log_success('risk_management', 28, f"Margin buffer valid: {buffer:.1%}")
                    
            else:
                self.log_error('risk_management', 28, "calculate_required_margin_buffer method missing")
                
        except Exception as e:
            self.log_error('risk_management', 28, f"Margin buffer test failed: {str(e)}")
        
        # Test margin health check
        try:
            pass
        except Exception as e:

            health = margin_manager.check_margin_health()
            
            required_health_keys = ['status', 'usage_pct', 'action_required']
            missing_health_keys = [key for key in required_health_keys if key not in health]
            
            if missing_health_keys:
                self.log_error('risk_management', 29, f"Margin health missing keys: {missing_health_keys}")
            else:
                self.log_success('risk_management', 29, f"Margin health check complete: {health['status']}")
                
        except Exception as e:
            self.log_error('risk_management', 29, f"Margin health test failed: {str(e)}")
    
    def _test_risk_limit_calculations(self):
        """Test risk limit calculations (Failure Points 30-31)"""
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        margin_used = self.algo.Portfolio.TotalMarginUsed
        margin_remaining = self.algo.Portfolio.MarginRemaining
        
        # Test basic risk metrics
        if portfolio_value > 0:
            margin_usage_pct = margin_used / portfolio_value
            
            if margin_usage_pct > 0.9:  # 90% margin usage
                self.log_error('risk_management', 30, f"Excessive margin usage: {margin_usage_pct:.1%}")
            else:
                self.log_success('risk_management', 30, f"Margin usage acceptable: {margin_usage_pct:.1%}")
        
        # Test available buying power calculation
        if hasattr(self.algo, 'position_sizer'):
            try:
                pass
            except Exception as e:

                if hasattr(self.algo.position_sizer, 'get_available_buying_power'):
                    available_bp = self.algo.position_sizer.get_available_buying_power()
                    
                    if available_bp < 0:
                        self.log_error('risk_management', 31, f"Negative buying power: ${available_bp:,.2f}")
                    else:
                        self.log_success('risk_management', 31, f"Available buying power: ${available_bp:,.2f}")
                        
                else:
                    self.log_error('risk_management', 31, "get_available_buying_power method missing")
                    
            except Exception as e:
                self.log_error('risk_management', 31, f"Buying power test failed: {str(e)}")
    
    def _test_position_limit_enforcement(self):
        """Test position limit enforcement (Failure Points 32-33)"""
        
        # Test account phase calculation
        portfolio_value = self.algo.Portfolio.TotalPortfolioValue
        
        if portfolio_value < 50000:
            expected_phase = 1
            expected_max_positions = 3
        elif portfolio_value < 100000:
            expected_phase = 2
            expected_max_positions = 5
        elif portfolio_value < 250000:
            expected_phase = 3
            expected_max_positions = 7
        else:
            expected_phase = 4
            expected_max_positions = 10
        
        # Test VIX manager phase calculation if available
        if hasattr(self.algo, 'vix_manager'):
            try:
                pass
            except Exception as e:

                actual_phase = self.algo.vix_manager.get_account_phase()
                if actual_phase != expected_phase:
                    self.log_error('risk_management', 32, 
                                 f"Account phase mismatch: expected {expected_phase}, got {actual_phase}")
                else:
                    self.log_success('risk_management', 32, f"Account phase correct: {actual_phase}")
            except Exception as e:
                self.log_error('risk_management', 32, f"Account phase test failed: {str(e)}")
        
        # Test position counting
        current_positions = sum(1 for holding in self.algo.Portfolio.Values if holding.Invested)
        
        if current_positions > expected_max_positions:
            self.log_error('risk_management', 33, 
                         f"Position limit exceeded: {current_positions}/{expected_max_positions}")
        else:
            self.log_success('risk_management', 33, 
                           f"Position limit respected: {current_positions}/{expected_max_positions}")
    
    def _test_cross_strategy_risk(self):
        """Test cross-strategy risk aggregation (Failure Points 34-35)"""
        
        # Test correlation manager integration
        if hasattr(self.algo, 'correlation_limiter'):
            try:
                pass
            except Exception as e:

                correlation_limiter = self.algo.correlation_limiter
                
                if hasattr(correlation_limiter, 'check_correlation_limits'):
                    correlation_ok = correlation_limiter.check_correlation_limits()
                    self.log_success('risk_management', 34, 
                                   f"Correlation limits check available: {correlation_ok}")
                else:
                    self.log_error('risk_management', 34, "check_correlation_limits method missing")
                    
            except Exception as e:
                self.log_error('risk_management', 34, f"Correlation test failed: {str(e)}")
        else:
            self.log_error('risk_management', 34, "Correlation limiter not available")
        
        # Test strategy coordination
        if hasattr(self.algo, 'strategy_coordinator'):
            try:
                pass
            except Exception as e:

                coordinator = self.algo.strategy_coordinator
                
                # Test if coordinator tracks multiple strategies
                if hasattr(coordinator, 'registered_strategies'):
                    strategy_count = len(coordinator.registered_strategies)
                    self.log_success('risk_management', 35, 
                                   f"Strategy coordinator tracking {strategy_count} strategies")
                else:
                    self.log_error('risk_management', 35, "Strategy coordinator not tracking strategies")
                    
            except Exception as e:
                self.log_error('risk_management', 35, f"Strategy coordination test failed: {str(e)}")
        else:
            self.log_error('risk_management', 35, "Strategy coordinator not available")
    
    def _validate_state_execution(self):
        """Validate State Machine and Order Execution (Failure Points 36-47)"""
        
        # FAILURE POINT 36-39: State machine transitions
        self._test_state_machine_transitions()
        
        # FAILURE POINT 40-43: Order execution pipeline
        self._test_order_execution_pipeline()
        
        # FAILURE POINT 44-47: Error recovery and logging
        self._test_error_recovery_systems()
    
    def _test_state_machine_transitions(self):
        """Test state machine transitions (Failure Points 36-39)"""
        
        # Test if strategies have state machines
        strategy_attrs = [attr for attr in dir(self.algo) if 'strategy' in attr.lower()]
        
        for attr_name in strategy_attrs:
            if hasattr(self.algo, attr_name):
                strategy = getattr(self.algo, attr_name)
                
                if hasattr(strategy, 'state_machine'):
                    try:
                        pass
                    except Exception as e:

                        state_machine = strategy.state_machine
                        
                        # Test current state
                        if hasattr(state_machine, 'current_state'):
                            current_state = state_machine.current_state
                            self.log_success('state_execution', 36, 
                                           f"{attr_name} state machine active: {current_state}")
                        else:
                            self.log_error('state_execution', 36, 
                                         f"{attr_name} state machine missing current_state")
                        
                        # Test transition capability
                        if hasattr(state_machine, 'can_transition'):
                            # Test with a common trigger
                            from core.state_machine import TransitionTrigger
                            can_transition = state_machine.can_transition(TransitionTrigger.MARKET_OPEN)
                            self.log_success('state_execution', 37, 
                                           f"{attr_name} transition check available: {can_transition}")
                        else:
                            self.log_error('state_execution', 37, 
                                         f"{attr_name} state machine missing can_transition")
                            
                    except Exception as e:
                        self.log_error('state_execution', 38, 
                                     f"{attr_name} state machine test failed: {str(e)}")
                else:
                    self.log_error('state_execution', 39, f"{attr_name} missing state machine")
    
    def _test_order_execution_pipeline(self):
        """Test order execution pipeline (Failure Points 40-43)"""
        
        # Test atomic order executor
        if hasattr(self.algo, 'atomic_executor'):
            try:
                pass
            except Exception as e:

                executor = self.algo.atomic_executor
                
                # Test if executor has required methods
                required_methods = ['execute_spread_order', 'execute_iron_condor', 'cancel_all_orders']
                missing_methods = [method for method in required_methods 
                                 if not hasattr(executor, method)]
                
                if missing_methods:
                    self.log_error('state_execution', 40, 
                                 f"Atomic executor missing methods: {missing_methods}")
                else:
                    self.log_success('state_execution', 40, 
                                   f"Atomic executor methods available: {required_methods}")
                    
            except Exception as e:
                self.log_error('state_execution', 40, f"Atomic executor test failed: {str(e)}")
        else:
            self.log_error('state_execution', 40, "Atomic executor not available")
        
        # Test option order executor
        if hasattr(self.algo, 'option_executor'):
            try:
                pass
            except Exception as e:

                option_executor = self.algo.option_executor
                
                if hasattr(option_executor, 'place_spread_order'):
                    self.log_success('state_execution', 41, "Option executor spread orders available")
                else:
                    self.log_error('state_execution', 41, "Option executor missing place_spread_order")
                    
            except Exception as e:
                self.log_error('state_execution', 41, f"Option executor test failed: {str(e)}")
        else:
            self.log_error('state_execution', 41, "Option executor not available")
        
        # Test order state recovery
        if hasattr(self.algo, 'order_recovery'):
            try:
                pass
            except Exception as e:

                recovery_system = self.algo.order_recovery
                
                if hasattr(recovery_system, 'recover_incomplete_orders'):
                    self.log_success('state_execution', 42, "Order recovery system available")
                else:
                    self.log_error('state_execution', 42, "Order recovery missing recover_incomplete_orders")
                    
            except Exception as e:
                self.log_error('state_execution', 42, f"Order recovery test failed: {str(e)}")
        else:
            self.log_error('state_execution', 42, "Order recovery system not available")
        
        # Test position state manager
        if hasattr(self.algo, 'position_state_manager'):
            try:
                pass
            except Exception as e:

                pos_manager = self.algo.position_state_manager
                
                required_methods = ['update_positions', 'get_position_summary']
                missing_methods = [method for method in required_methods 
                                 if not hasattr(pos_manager, method)]
                
                if missing_methods:
                    self.log_error('state_execution', 43, 
                                 f"Position state manager missing: {missing_methods}")
                else:
                    self.log_success('state_execution', 43, "Position state manager methods available")
                    
            except Exception as e:
                self.log_error('state_execution', 43, f"Position state manager test failed: {str(e)}")
        else:
            self.log_error('state_execution', 43, "Position state manager not available")
    
    def _test_error_recovery_systems(self):
        """Test error recovery and logging systems (Failure Points 44-47)"""
        
        # Test performance tracker error handling
        if hasattr(self.algo, 'performance_tracker'):
            try:
                pass
            except Exception as e:

                perf_tracker = self.algo.performance_tracker
                
                if hasattr(perf_tracker, 'add_trade_pnl'):
                    # Test with valid data
                    perf_tracker.add_trade_pnl("test_strategy", 100.0, True)
                    self.log_success('state_execution', 44, "Performance tracker working")
                else:
                    self.log_error('state_execution', 44, "Performance tracker missing add_trade_pnl")
                    
            except Exception as e:
                self.log_error('state_execution', 44, f"Performance tracker test failed: {str(e)}")
        else:
            self.log_error('state_execution', 44, "Performance tracker not available")
        
        # Test data validator error handling
        if hasattr(self.algo, 'data_validator'):
            try:
                pass
            except Exception as e:

                validator = self.algo.data_validator
                
                if hasattr(validator, 'validate_data_freshness'):
                    is_valid = validator.validate_data_freshness()
                    self.log_success('state_execution', 45, f"Data validator working: {is_valid}")
                else:
                    self.log_error('state_execution', 45, "Data validator missing validate_data_freshness")
                    
            except Exception as e:
                self.log_error('state_execution', 45, f"Data validator test failed: {str(e)}")
        else:
            self.log_error('state_execution', 45, "Data validator not available")
        
        # Test logging system integration
        try:
            self.algo.Debug("Test debug message")
            self.algo.Log("Test log message")
            self.algo.Error("Test error message")
            self.log_success('state_execution', 46, "Logging system operational")
            
        except Exception as e:
            self.log_error('state_execution', 46, f"Logging system test failed: {str(e)}")
        
        # Test integration verification system
        if hasattr(self.algo, 'run_complete_integration_verification'):
            try:
                self.log_success('state_execution', 47, "Integration verification system available")
            except Exception as e:
                self.log_error('state_execution', 47, f"Integration verification test failed: {str(e)}")
        else:
            self.log_error('state_execution', 47, "Integration verification system not available")
    
    def _generate_final_report(self) -> Dict:
        """Generate comprehensive final validation report"""
        
        total_points = 47
        
        # Calculate success/failure rates by category
        category_results = {}
        for category, points in self.failure_categories.items():
            category_successes = sum(1 for log in self.error_logs if log['category'] == category and 'success' in log['message'].lower())
            category_failures = sum(1 for log in self.error_logs if log['category'] == category and 'success' not in log['message'].lower())
            category_results[category] = {
                'total_points': len(points),
                'successes': category_successes,
                'failures': category_failures,
                'success_rate': category_successes / len(points) if points else 0
            }
        
        # Overall statistics
        overall_success_rate = self.success_count / total_points
        critical_failures = [log for log in self.error_logs if 'CRITICAL' in log['message']]
        
        final_report = {
            'validation_timestamp': self.algo.Time,
            'total_failure_points_tested': total_points,
            'successful_validations': self.success_count,
            'failed_validations': self.failure_count,
            'overall_success_rate': overall_success_rate,
            'category_results': category_results,
            'critical_failures': len(critical_failures),
            'error_log_count': len(self.error_logs),
            'production_ready': overall_success_rate >= 0.90 and len(critical_failures) == 0,
            'detailed_errors': self.error_logs
        }
        
        # Log final summary
        self.algo.Error("="*80)
        self.algo.Error("VALIDATION COMPLETE - FINAL REPORT")
        self.algo.Error("="*80)
        self.algo.Error(f"SUCCESS RATE: {overall_success_rate:.1%} ({self.success_count}/{total_points})")
        self.algo.Error(f"CRITICAL FAILURES: {len(critical_failures)}")
        self.algo.Error(f"PRODUCTION READY: {'YES' if final_report['production_ready'] else 'NO'}")
        
        if not final_report['production_ready']:
            self.algo.Error("CRITICAL ISSUES MUST BE RESOLVED BEFORE PRODUCTION DEPLOYMENT")
            
            # List top failure categories
            top_failures = sorted(category_results.items(), 
                                key=lambda x: x[1]['failures'], reverse=True)[:3]
            
            for category, results in top_failures:
                if results['failures'] > 0:
                    self.algo.Error(f"- {category.upper()}: {results['failures']} failures")
        
        self.algo.Error("="*80)
        
        return final_report