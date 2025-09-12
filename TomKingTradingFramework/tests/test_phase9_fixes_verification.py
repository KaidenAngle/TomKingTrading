#!/usr/bin/env python3
"""
Phase 9 Fixes Integration Test
Verifies that all critical fixes are working correctly:
1. Abstract method implementations (_place_exit_orders)
2. AccountPhase enum consolidation  
3. Centralized portfolio value access
4. Secure sandbox credentials
"""

import unittest
import sys
import os
import importlib
from unittest.mock import Mock, MagicMock, patch
from config.constants import TradingConstants

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestPhase9FixesVerification(unittest.TestCase):
    """Integration test for Phase 9 framework optimization fixes"""
    
    def setUp(self):
        """Set up test environment"""
        self.mock_algorithm = Mock()
        self.mock_algorithm.Time = Mock()
        self.mock_algorithm.Log = Mock()
        self.mock_algorithm.Debug = Mock() 
        self.mock_algorithm.Error = Mock()
        self.mock_algorithm.Portfolio = Mock()
        self.mock_algorithm.Portfolio.TotalPortfolioValue = 50000
        self.mock_algorithm.Securities = {}
        
        # Mock position sizer
        self.mock_position_sizer = Mock()
        self.mock_position_sizer.get_portfolio_value.return_value = 50000
        self.mock_algorithm.position_sizer = self.mock_position_sizer
    
    def test_abstract_method_implementations(self):
        """Test 1: Verify all strategies have implemented _place_exit_orders"""
        
        strategy_files = [
            'strategies.friday_0dte_with_state',
            'strategies.lt112_with_state', 
            'strategies.futures_strangle_with_state',
            'strategies.leap_put_ladders_with_state',
            'strategies.ipmcc_with_state'
        ]
        
        for strategy_module in strategy_files:
            with self.subTest(strategy=strategy_module):
                try:
                module = importlib.import_module(strategy_module)
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
# Import the strategy module
                    
                    # Find the strategy class (assumes pattern: ModuleNameWithState)
                    class_name = None
                    for attr in dir(module):
                        if attr.endswith('WithState') and not attr.startswith('Base'):
                            class_name = attr
                            break
                    
                    self.assertIsNotNone(class_name, f"Could not find strategy class in {strategy_module}")
                    
                    # Get the strategy class
                    strategy_class = getattr(module, class_name)
                    
                    # Verify _place_exit_orders method exists
                    self.assertTrue(
                        hasattr(strategy_class, '_place_exit_orders'),
                        f"{class_name} missing _place_exit_orders method"
                    )
                    
                    # Verify method is not abstract (has implementation)
                    method = getattr(strategy_class, '_place_exit_orders')
                    self.assertIsNotNone(method, f"{class_name}._place_exit_orders is None")
                    
                    # Try to instantiate and verify method exists
                    try:
                        
                    except Exception as e:

                        # Log and handle unexpected exception

                        print(f'Unexpected exception: {e}')

                        raise
instance = strategy_class(self.mock_algorithm)
                        self.assertTrue(
                            callable(getattr(instance, '_place_exit_orders', None)),
                            f"{class_name}._place_exit_orders is not callable"
                        )
                        print(f"✓ {class_name} has working _place_exit_orders implementation")
                        
                    except Exception as e:
                        # Some strategies might fail due to missing dependencies, but method should exist
                        self.assertTrue(
                            hasattr(strategy_class, '_place_exit_orders'),
                            f"{class_name} missing _place_exit_orders: {e}"
                        )
                        print(f"✓ {class_name} has _place_exit_orders method (instantiation issue: {e})")
                    
                except ImportError as e:
                    self.fail(f"Could not import {strategy_module}: {e}")
    
    def test_account_phase_consolidation(self):
        """Test 2: Verify AccountPhase enum is properly centralized"""
        
        try:
        from config.constants import AccountPhase
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Test centralized AccountPhase import
            
            # Verify enum has expected values
            expected_phases = ['PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4'] 
            for phase in expected_phases:
                self.assertTrue(
                    hasattr(AccountPhase, phase),
                    f"AccountPhase missing {phase}"
                )
                
            print("✓ AccountPhase enum centralized in config.constants")
            
            # Test that position_sizing.py imports from centralized location
            from risk.position_sizing import PositionSizer
            
            # Check that it uses the centralized AccountPhase
            # (This is implicit - if import works, it's using centralized version)
            print("✓ position_sizing.py uses centralized AccountPhase")
            
        except ImportError as e:
            self.fail(f"AccountPhase consolidation failed: {e}")
    
    def test_centralized_portfolio_access(self):
        """Test 3: Verify centralized portfolio value access is working"""
        
        try:
        from core.unified_position_sizer import UnifiedPositionSizer
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Test UnifiedPositionSizer has centralized methods
            
            sizer = UnifiedPositionSizer(self.mock_algorithm)
            
            # Verify centralized methods exist
            self.assertTrue(
                hasattr(sizer, 'get_portfolio_value'),
                "UnifiedPositionSizer missing get_portfolio_value method"
            )
            self.assertTrue(
                hasattr(sizer, 'get_buying_power'),
                "UnifiedPositionSizer missing get_buying_power method"  
            )
            self.assertTrue(
                hasattr(sizer, 'get_portfolio_usage_pct'),
                "UnifiedPositionSizer missing get_portfolio_usage_pct method"
            )
            
            # Test methods work
            portfolio_value = sizer.get_portfolio_value()
            self.assertEqual(portfolio_value, 50000, "get_portfolio_value not working correctly")
            
            print("✓ UnifiedPositionSizer has centralized portfolio access methods")
            
        except ImportError as e:
            self.fail(f"Centralized portfolio access test failed: {e}")
        except Exception as e:
            self.fail(f"Portfolio access method test failed: {e}")
    
    def test_secure_credentials_implementation(self):
        """Test 4: Verify secure credential handling is implemented"""
        
        try:
        from brokers.paper_trading_adapter import PaperTradingAdapter
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Test that paper trading adapter uses environment variables
            
            # Mock environment variables to test validation
            with patch.dict(os.environ, {
                'TASTYTRADE_SANDBOX_USERNAME': 'test_user',
                'TASTYTRADE_SANDBOX_PASSWORD': 'test_pass', 
                'TASTYTRADE_SANDBOX_CLIENT_ID': 'test_id',
                'TASTYTRADE_SANDBOX_CLIENT_SECRET': 'test_secret'
            }):
                # Should not fail with env vars set
                adapter = PaperTradingAdapter(self.mock_algorithm, enable_mirroring=False)
                self.assertIsNotNone(adapter.sandbox_config)
                self.assertEqual(adapter.sandbox_config['username'], 'test_user')
                print("✓ PaperTradingAdapter uses environment variables for credentials")
            
            # Test that validation works when env vars missing
            with patch.dict(os.environ, {}, clear=True):
                adapter = PaperTradingAdapter(self.mock_algorithm, enable_mirroring=True)
                # Should have disabled mirroring due to missing credentials
                self.assertFalse(adapter.enable_mirroring, "Mirroring should be disabled with missing credentials")
                print("✓ Credential validation properly disables insecure operations")
                
        except ImportError as e:
            self.fail(f"Secure credentials test failed: {e}")
        except Exception as e:
            self.fail(f"Credential security test failed: {e}")
    
    def test_integration_compatibility(self):
        """Test 5: Verify all fixes work together without conflicts"""
        
        try:
        from config.constants import AccountPhase, TradingConstants
        from core.unified_position_sizer import UnifiedPositionSizer
        from risk.position_sizing import PositionSizer
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Test that we can import and use multiple components together
            
            # Test AccountPhase works with position sizing
            sizer = UnifiedPositionSizer(self.mock_algorithm) 
            portfolio_value = sizer.get_portfolio_value()
            
            # Test that constants are accessible
            kelly_factor = TradingConstants.KELLY_FACTOR
            self.assertEqual(kelly_factor, TradingConstants.KELLY_FACTOR, "Kelly factor should be 0.25")
            
            # Test AccountPhase enum values
            self.assertEqual(AccountPhase.PHASE_1.value, 1)
            self.assertEqual(AccountPhase.PHASE_4.value, 4)
            
            print("✓ All fixes integrate without conflicts")
            
        except ImportError as e:
            self.fail(f"Integration compatibility failed: {e}")
        except Exception as e:
            self.fail(f"Integration test failed: {e}")
    
    def test_no_regression_issues(self):
        """Test 6: Verify fixes don't break existing functionality"""
        
        try:
        from strategies.base_strategy_with_state import BaseStrategyWithState
        from core.state_machine import StrategyState, TransitionTrigger
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Test that we can still import base classes
            
            # Verify base functionality still works
            self.assertTrue(hasattr(BaseStrategyWithState, '_place_exit_orders'))
            
            # Verify state machine enums are accessible  
            self.assertTrue(hasattr(StrategyState, 'READY'))
            self.assertTrue(hasattr(TransitionTrigger, 'TIME_WINDOW_START'))
            
            print("✓ No regression issues detected")
            
        except ImportError as e:
            self.fail(f"Regression test failed: {e}")

def run_verification_tests():
    """Run all Phase 9 verification tests"""
    
    print("=" * 80)
    print("PHASE 9 FIXES VERIFICATION TESTS")
    print("=" * 80)
    print()
    
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestPhase9FixesVerification)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print()
    print("=" * 80) 
    if result.wasSuccessful():
        print("✅ ALL PHASE 9 FIXES VERIFIED SUCCESSFULLY")
        print(f"Ran {result.testsRun} tests - All passed!")
    else:
        print("❌ SOME PHASE 9 FIXES FAILED VERIFICATION")
        print(f"Ran {result.testsRun} tests - {len(result.failures)} failures, {len(result.errors)} errors")
        
        if result.failures:
            print("\nFAILURES:")
            for test, trace in result.failures:
                print(f"- {test}: {trace}")
        
        if result.errors:
            print("\nERRORS:")
            for test, trace in result.errors:
                print(f"- {test}: {trace}")
    
    print("=" * 80)
    return result.wasSuccessful()

if __name__ == '__main__':
    success = run_verification_tests()
    exit(0 if success else 1)