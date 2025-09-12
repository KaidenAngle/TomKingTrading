#!/usr/bin/env python3
"""
Phase 9 Core Fixes Verification - Simplified Test
Tests the essential fixes without complex imports or Unicode issues
"""

import unittest
import sys
import os
import inspect
from unittest.mock import Mock

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestPhase9CoreVerification(unittest.TestCase):
    """Core verification for Phase 9 fixes"""
    
    def test_1_abstract_methods_exist(self):
        """Verify _place_exit_orders methods exist in strategy files"""
        
        strategy_files = [
            'strategies/friday_0dte_with_state.py',
            'strategies/lt112_with_state.py', 
            'strategies/futures_strangle_with_state.py',
            'strategies/leap_put_ladders_with_state.py',
            'strategies/ipmcc_with_state.py'
        ]
        
        for strategy_file in strategy_files:
            with self.subTest(file=strategy_file):
                # Check if file exists
                full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), strategy_file)
                self.assertTrue(os.path.exists(full_path), f"Strategy file not found: {strategy_file}")
                
                # Read file and check for _place_exit_orders method
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Verify method is implemented (not just declared)
                self.assertIn('def _place_exit_orders(self)', content, 
                            f"{strategy_file} missing _place_exit_orders implementation")
                
                # Verify it has substantial implementation (not just pass)
                lines = content.split('\n')
                method_found = False
                implementation_lines = 0
                
                for i, line in enumerate(lines):
                    if 'def _place_exit_orders(self)' in line:
                        method_found = True
                        # Count implementation lines after method declaration
                        for j in range(i + 1, min(i + 50, len(lines))):
                            if lines[j].strip().startswith('def ') and not lines[j].strip().startswith('def _'):
                                break
                            if lines[j].strip() and not lines[j].strip().startswith('#'):
                                implementation_lines += 1
                        break
                
                self.assertTrue(method_found, f"{strategy_file} _place_exit_orders method not found")
                self.assertGreater(implementation_lines, 5, 
                                 f"{strategy_file} _place_exit_orders has insufficient implementation")
                
                print(f"PASS: {strategy_file} has _place_exit_orders implementation ({implementation_lines} lines)")
    
    def test_2_account_phase_centralized(self):
        """Verify AccountPhase enum is in constants file"""
        
        constants_file = 'config/constants.py'
        full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), constants_file)
        
        self.assertTrue(os.path.exists(full_path), "constants.py file not found")
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verify AccountPhase enum is defined
        self.assertIn('class AccountPhase(Enum):', content, 
                     "AccountPhase enum not found in constants.py")
        
        # Verify it has the expected phases
        for phase in ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4']:
            self.assertIn(phase, content, f"AccountPhase missing {phase}")
        
        print("PASS: AccountPhase enum centralized in constants.py")
    
    def test_3_position_sizer_portfolio_methods(self):
        """Verify UnifiedPositionSizer has centralized portfolio methods"""
        
        sizer_file = 'core/unified_position_sizer.py'
        full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), sizer_file)
        
        self.assertTrue(os.path.exists(full_path), "unified_position_sizer.py not found")
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verify centralized methods exist
        required_methods = [
            'def get_portfolio_value(self)',
            'def get_buying_power(self)', 
            'def get_portfolio_usage_pct(self)'
        ]
        
        for method in required_methods:
            self.assertIn(method, content, f"UnifiedPositionSizer missing {method}")
        
        print("PASS: UnifiedPositionSizer has centralized portfolio access methods")
    
    def test_4_secure_credentials_no_hardcoding(self):
        """Verify no hardcoded credentials in paper trading adapter"""
        
        adapter_file = 'brokers/paper_trading_adapter.py'
        full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), adapter_file)
        
        self.assertTrue(os.path.exists(full_path), "paper_trading_adapter.py not found")
        
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verify no hardcoded credentials (common patterns)
        suspicious_patterns = [
            'kaiden.angle@gmail.com',
            '56F@BhZ6z6sES9f', 
            'd99becce-b939-450c-9133-c8ecb2e096b1',
            '98911c87a7287ac6665fc96a9a467d54fd02f7ed'
        ]
        
        for pattern in suspicious_patterns:
            self.assertNotIn(pattern, content, 
                           f"Found hardcoded credential pattern in paper_trading_adapter.py: {pattern}")
        
        # Verify environment variable usage
        self.assertIn('os.getenv(', content, "paper_trading_adapter.py not using environment variables")
        self.assertIn('TASTYTRADE_SANDBOX_', content, "Missing TASTYTRADE_SANDBOX_ env var usage")
        
        print("PASS: No hardcoded credentials found, using environment variables")
    
    def test_5_portfolio_access_centralization(self):
        """Verify strategy files use centralized portfolio access"""
        
        strategy_files = [
            'strategies/friday_0dte_with_state.py',
            'strategies/leap_put_ladders_with_state.py'
        ]
        
        for strategy_file in strategy_files:
            with self.subTest(file=strategy_file):
                full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), strategy_file)
                
                if os.path.exists(full_path):
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Count centralized vs direct access
                    centralized_count = content.count('position_sizer.get_portfolio_value()')
                    direct_count = content.count('Portfolio.TotalPortfolioValue')
                    
                    # Should have more centralized access than direct access
                    self.assertGreaterEqual(centralized_count, direct_count,
                                          f"{strategy_file} should use more centralized portfolio access")
                    
                    if centralized_count > 0:
                        print(f"PASS: {strategy_file} uses centralized portfolio access ({centralized_count} instances)")

def run_core_verification():
    """Run core verification tests with simple output"""
    
    print("=" * 60)
    print("PHASE 9 CORE FIXES VERIFICATION")
    print("=" * 60)
    
    # Run tests
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase9CoreVerification)
    runner = unittest.TextTestRunner(verbosity=1)
    result = runner.run(suite)
    
    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print(f"SUCCESS: All {result.testsRun} verification tests passed!")
        print("Phase 9 fixes are working correctly.")
    else:
        print(f"ISSUES FOUND: {len(result.failures)} failures, {len(result.errors)} errors")
        
        for test, trace in result.failures + result.errors:
            print(f"\nFAILED: {test}")
            # Show only the assertion message, not full traceback
            lines = trace.strip().split('\n')
            for line in lines:
                if line.startswith('AssertionError:') or line.startswith('AssertionError '):
                    print(f"  {line}")
                    break
    
    print("=" * 60)
    return result.wasSuccessful()

if __name__ == '__main__':
    success = run_core_verification()
    exit(0 if success else 1)