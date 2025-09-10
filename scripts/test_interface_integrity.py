#!/usr/bin/env python3
"""
Tom King Trading Framework - Interface Integrity Test Suite
Tests all component interfaces against main.py expectations
Prevents future interface mismatches through automated verification

USAGE: python test_interface_integrity.py
"""

import sys
import os
import inspect
import importlib.util
from typing import Dict, List, Tuple, Any

class InterfaceIntegrityTester:
    """
    Automated interface verification for Tom King Trading Framework
    Ensures all components expose expected public methods
    """
    
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.results = []
        self.failed_tests = 0
        self.passed_tests = 0
        
        # Expected interface contracts from main.py analysis
        self.expected_interfaces = {
            'helpers.data_freshness_validator.DataFreshnessValidator': [
                'validate_all_data',
                'get_status'
            ],
            'risk.dynamic_margin_manager.DynamicMarginManager': [
                'check_margin_available',
                'check_margin_health',
                'get_margin_status'
            ],
            'risk.correlation_group_limiter.August2024CorrelationLimiter': [
                'positions_at_limit',
                'get_max_correlation',
                'enforce_correlation_limits'
            ],
            'position_state_manager.PositionStateManagerQC': [
                'get_strategy_for_symbol',
                'calculate_position_pnl',
                'update_position_state'
            ],
            'greeks.greeks_monitor.GreeksMonitor': [
                'get_portfolio_greeks',
                'calculate_portfolio_risk'
            ],
            'core.strategy_coordinator.StrategyCoordinator': [
                'record_execution',
                'request_execution',
                'get_statistics'
            ],
            'core.unified_state_manager.UnifiedStateManager': [
                'persist_all_states',
                'save_all_states',
                'load_all_states'
            ],
            'core.spy_concentration_manager.SPYConcentrationManager': [
                'get_total_spy_exposure',
                'check_concentration_limits'
            ],
            'helpers.performance_tracker_safe.SafePerformanceTracker': [
                'update',
                'get_daily_pnl',
                'generate_final_report'
            ]
        }
        
    def test_interface_exists(self, module_path: str, class_name: str, method_name: str) -> Tuple[bool, str]:
        """Test if a specific method exists in the expected class"""
        
        try:
            # Import the module
            full_path = os.path.join(self.base_dir, module_path.replace('.', os.sep) + '.py')
            
            if not os.path.exists(full_path):
                return False, f"Module file not found: {full_path}"
                
            spec = importlib.util.spec_from_file_location(module_path, full_path)
            if spec is None or spec.loader is None:
                return False, f"Could not load module: {module_path}"
                
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Get the class
            if not hasattr(module, class_name):
                return False, f"Class {class_name} not found in module {module_path}"
                
            cls = getattr(module, class_name)
            
            # Check if method exists
            if hasattr(cls, method_name):
                method = getattr(cls, method_name)
                if callable(method):
                    return True, f"✅ {class_name}.{method_name}() exists and is callable"
                else:
                    return False, f"❌ {class_name}.{method_name} exists but is not callable"
            else:
                return False, f"❌ Method {method_name} not found in {class_name}"
                
        except Exception as e:
            return False, f"❌ Error testing {class_name}.{method_name}: {str(e)}"
            
    def run_interface_tests(self) -> Dict[str, Any]:
        """Run all interface integrity tests"""
        
        print("🔍 STARTING INTERFACE INTEGRITY TESTS")
        print("=" * 60)
        
        test_summary = {
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'results': []
        }
        
        for module_class, expected_methods in self.expected_interfaces.items():
            module_path, class_name = module_class.rsplit('.', 1)
            
            print(f"\n📋 Testing {class_name} ({module_path})")
            print("-" * 40)
            
            class_results = {
                'class': class_name,
                'module': module_path,
                'methods_tested': len(expected_methods),
                'methods_passed': 0,
                'methods_failed': 0,
                'method_results': []
            }
            
            for method_name in expected_methods:
                test_summary['total_tests'] += 1
                success, message = self.test_interface_exists(module_path, class_name, method_name)
                
                method_result = {
                    'method': method_name,
                    'passed': success,
                    'message': message
                }
                
                class_results['method_results'].append(method_result)
                print(f"  {message}")
                
                if success:
                    test_summary['passed'] += 1
                    class_results['methods_passed'] += 1
                else:
                    test_summary['failed'] += 1
                    class_results['methods_failed'] += 1
                    
            test_summary['results'].append(class_results)
            
        return test_summary
        
    def generate_interface_report(self, test_results: Dict[str, Any]) -> str:
        """Generate comprehensive interface integrity report"""
        
        report = []
        report.append("\n" + "=" * 80)
        report.append("TOM KING TRADING FRAMEWORK - INTERFACE INTEGRITY REPORT")
        report.append("=" * 80)
        
        # Summary
        report.append(f"\n📊 SUMMARY:")
        report.append(f"   Total Interface Tests: {test_results['total_tests']}")
        report.append(f"   ✅ Passed: {test_results['passed']}")
        report.append(f"   ❌ Failed: {test_results['failed']}")
        
        success_rate = (test_results['passed'] / test_results['total_tests']) * 100
        report.append(f"   Success Rate: {success_rate:.1f}%")
        
        # Detailed results
        report.append(f"\n🔍 DETAILED RESULTS:")
        
        for class_result in test_results['results']:
            class_status = "✅ PASS" if class_result['methods_failed'] == 0 else "❌ FAIL"
            report.append(f"\n{class_status} {class_result['class']} ({class_result['methods_passed']}/{class_result['methods_tested']})")
            
            for method_result in class_result['method_results']:
                status = "✅" if method_result['passed'] else "❌"
                report.append(f"    {status} {method_result['method']}()")
                if not method_result['passed']:
                    report.append(f"        └─ {method_result['message']}")
                    
        # Recommendations
        report.append(f"\n💡 RECOMMENDATIONS:")
        if test_results['failed'] == 0:
            report.append("   🎉 All interface tests passed! Framework has excellent interface integrity.")
            report.append("   📝 Consider running these tests before each deployment.")
        else:
            report.append("   🔧 Fix failing interface methods before deployment.")
            report.append("   📋 Add missing methods or update main.py expectations.")
            report.append("   🔄 Re-run tests after fixes to verify integrity.")
            
        report.append("\n" + "=" * 80)
        
        return "\n".join(report)

def main():
    """Main test execution"""
    
    # Determine base directory (where Tom King framework is located)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = script_dir  # Assumes script is in same directory as framework
    
    print(f"🏗️  Tom King Trading Framework Interface Integrity Tester")
    print(f"📁 Base Directory: {base_dir}")
    
    # Initialize tester
    tester = InterfaceIntegrityTester(base_dir)
    
    # Run tests
    results = tester.run_interface_tests()
    
    # Generate report
    report = tester.generate_interface_report(results)
    print(report)
    
    # Save report to file
    report_file = os.path.join(script_dir, "interface_integrity_report.txt")
    with open(report_file, 'w') as f:
        f.write(report)
    print(f"\n💾 Report saved to: {report_file}")
    
    # Exit with appropriate code
    if results['failed'] > 0:
        print(f"\n❌ INTERFACE TESTS FAILED ({results['failed']} failures)")
        sys.exit(1)
    else:
        print(f"\n✅ ALL INTERFACE TESTS PASSED")
        sys.exit(0)

if __name__ == "__main__":
    main()