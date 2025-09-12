# Interface Validation System - Prevents Runtime Method Not Found Errors
# Validates all component interfaces at startup to fail fast

from AlgorithmImports import *
from typing import Dict, List, Tuple, Any
import inspect
from core.unified_vix_manager import UnifiedVIXManager
from core.unified_position_sizer import UnifiedPositionSizer
from core.unified_state_manager import UnifiedStateManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage position_sizer from unified system
# Consider delegating to: self.algo.position_sizer.{method}()
# See Implementation Audit Protocol for systematic integration patterns


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage state_manager from unified system
# Consider delegating to: self.algo.state_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class InterfaceValidator:
    """
    Validates that all components have the required interfaces
    Prevents runtime 'method not found' errors by failing fast at startup
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.validation_results = {}
        self.critical_failures = []
        
    def validate_all_interfaces(self) -> Tuple[bool, List[str]]:
        """
        Validate all component interfaces
        Returns (success, list_of_errors)
        """
        
        self.algo.Log("[InterfaceValidator] Starting comprehensive interface validation")
        
        # Define required interfaces for each component
        required_interfaces = {
            'vix_manager': [
                'get_current_vix',
                'get_market_regime',  # This was missing and caused runtime error
                'get_vix_regime'
            ],
            'state_manager': [
                'register_strategy',
                'update_all_state_machines',  # This was missing and caused runtime error
                'get_dashboard',
                'save_all_states',
                'load_all_states',
                'trigger_emergency_halt'
            ],
            'strategy_coordinator': [
                'register_strategy',
                'execute_strategies'
            ],
            'position_sizer': [
                'calculate_position_size',
                'get_available_buying_power'
            ],
            'circuit_breaker': [
                'check_drawdown_limits',
                'check_correlation_limits',
                'check_margin_limits'
            ]
        }
        
        all_valid = True
        errors = []
        
        # Validate each component's interface
        for component_name, required_methods in required_interfaces.items():
            component = getattr(self.algo, component_name, None)
            
            if component is None:
                error = f"CRITICAL: Component '{component_name}' not found in algorithm"
                errors.append(error)
                self.critical_failures.append(error)
                all_valid = False
                continue
                
            # Check each required method
            missing_methods = []
            for method_name in required_methods:
                if not hasattr(component, method_name):
                    missing_methods.append(method_name)
                elif not callable(getattr(component, method_name)):
                    missing_methods.append(f"{method_name} (not callable)")
            
            if missing_methods:
                error = f"Component '{component_name}' missing methods: {missing_methods}"
                errors.append(error)
                all_valid = False
                
                # Critical failures for essential components
                if component_name in ['vix_manager', 'state_manager', 'strategy_coordinator']:
                    self.critical_failures.append(error)
        
        self.validation_results = {
            'all_valid': all_valid,
            'errors': errors,
            'critical_failures': self.critical_failures,
            'timestamp': str(self.algo.Time)
        }
        
        if all_valid:
            self.algo.Log("[InterfaceValidator] ✅ All component interfaces validated successfully")
        else:
            self.algo.Error(f"[InterfaceValidator] ❌ Interface validation failed with {len(errors)} errors")
            for error in errors:
                self.algo.Error(f"[InterfaceValidator]   - {error}")
        
        return all_valid, errors
    
    def validate_method_signatures(self) -> Dict[str, List[str]]:
        """
        Validate method signatures match expected parameters
        Returns dict of signature mismatches
        """
        
        signature_checks = {
            'vix_manager.get_market_regime': {'params': [], 'returns': 'str'},
            'state_manager.update_all_state_machines': {'params': ['data'], 'returns': 'None'},
            'strategy_coordinator.execute_strategies': {'params': ['data', 'context'], 'returns': 'None'}
        }
        
        mismatches = {}
        
        for method_path, expected in signature_checks.items():
            component_name, method_name = method_path.split('.')
            component = getattr(self.algo, component_name, None)
            
            if component and hasattr(component, method_name):
                method = getattr(component, method_name)
                if callable(method):
                    sig = inspect.signature(method)
                    actual_params = [p.name for p in sig.parameters.values() if p.name != 'self']
                    
                    if actual_params != expected['params']:
                        mismatches[method_path] = {
                            'expected_params': expected['params'],
                            'actual_params': actual_params
                        }
        
        return mismatches
    
    def get_component_methods_map(self) -> Dict[str, List[str]]:
        """
        Generate a map of all components and their available methods
        Useful for debugging and documentation
        """
        
        components = {
            'vix_manager': getattr(self.algo, 'vix_manager', None),
            'state_manager': getattr(self.algo, 'state_manager', None),
            'strategy_coordinator': getattr(self.algo, 'strategy_coordinator', None),
            'position_sizer': getattr(self.algo, 'position_sizer', None),
            'circuit_breaker': getattr(self.algo, 'circuit_breaker', None)
        }
        
        methods_map = {}
        
        for name, component in components.items():
            if component:
                methods = [method for method in dir(component) 
                          if callable(getattr(component, method)) 
                          and not method.startswith('_')]
                methods_map[name] = methods
            else:
                methods_map[name] = ['COMPONENT_NOT_FOUND']
        
        return methods_map
    
    def generate_interface_documentation(self) -> str:
        """
        Generate comprehensive interface documentation for all components
        """
        
        methods_map = self.get_component_methods_map()
        
        doc = "# Component Interface Documentation\n"
        doc += "# Auto-generated for debugging method signature issues\n\n"
        
        for component_name, methods in methods_map.items():
            doc += f"## {component_name.upper()}\n"
            if methods == ['COMPONENT_NOT_FOUND']:
                doc += "❌ COMPONENT NOT FOUND\n\n"
            else:
                for method in sorted(methods):
                    doc += f"- {method}()\n"
                doc += "\n"
        
        return doc
    
    def emergency_interface_check(self) -> bool:
        """
        Quick emergency check for critical interfaces
        Used if validation fails to determine if algorithm can continue
        """
        
        critical_checks = [
            ('vix_manager', 'get_current_vix'),
            ('state_manager', 'update_all_state_machines'),
            ('strategy_coordinator', 'execute_strategies')
        ]
        
        for component_name, method_name in critical_checks:
            component = getattr(self.algo, component_name, None)
            if not component or not hasattr(component, method_name):
                self.algo.Error(f"[InterfaceValidator] EMERGENCY: {component_name}.{method_name} not available")
                return False
        
        self.algo.Log("[InterfaceValidator] Emergency interface check passed")
        return True
    
    def get_validation_status(self) -> Dict:
        """Get current validation status"""
        
        return {
            'validation_results': self.validation_results,
            'critical_failures_count': len(self.critical_failures),
            'methods_map': self.get_component_methods_map(),
            'signature_mismatches': self.validate_method_signatures()
        }