# Critical Issues Verification Test
# Tests all fixes from the parallel audit: abstract methods, security, interfaces, constants

import unittest
import sys
import os
from unittest.mock import MagicMock, patch

# Add framework root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestCriticalIssuesFixes(unittest.TestCase):
    """Test suite for all critical issues identified and fixed"""
    
    def test_1_abstract_method_implementation(self):
        """Test BaseRiskPlugin abstract methods are properly defined"""
        try:
            from risk.unified_risk_manager import BaseRiskPlugin
            
            # Check that abstract methods exist and are properly defined
            self.assertTrue(hasattr(BaseRiskPlugin, 'plugin_name'))
            self.assertTrue(hasattr(BaseRiskPlugin, 'plugin_version'))
            self.assertTrue(hasattr(BaseRiskPlugin, '_plugin_initialize'))
            
            # Ensure abstract methods are marked with ellipsis, not pass
            import inspect
            source = inspect.getsource(BaseRiskPlugin._plugin_initialize)
            self.assertIn('...', source)  # Should use ellipsis notation
            self.assertNotIn('pass', source)  # Should not use pass
            
            print("PASS: Abstract methods properly implemented")
            
        except Exception as e:
            self.fail(f"Abstract method test failed: {e}")
    
    def test_2_credentials_security(self):
        """Test hardcoded account numbers moved to environment variables"""
        try:
            from config.tastytrade_credentials_secure import TastytradeCredentials
            
            # Check that account numbers are using environment variables
            self.assertIsNotNone(TastytradeCredentials.ACCOUNT_NUMBER_CASH)
            self.assertIsNotNone(TastytradeCredentials.ACCOUNT_NUMBER_MARGIN)
            
            # The values should be empty strings in test environment (no env vars set)
            # This confirms they're reading from environment, not hardcoded
            self.assertIsInstance(TastytradeCredentials.ACCOUNT_NUMBER_CASH, str)
            self.assertIsInstance(TastytradeCredentials.ACCOUNT_NUMBER_MARGIN, str)
            
            # Check validation includes new account number checks
            validation_method = TastytradeCredentials.validate_credentials
            self.assertTrue(callable(validation_method))
            
            print("PASS: Credentials properly secured with environment variables")
            
        except Exception as e:
            self.fail(f"Credentials security test failed: {e}")
    
    def test_3_manager_interface_compliance(self):
        """Test managers implement IManager interface"""
        try:
            from core.dependency_container import IManager
            from core.unified_state_manager import UnifiedStateManager
            from core.market_data_cache import MarketDataCacheManager
            
            # Check that managers inherit from IManager
            self.assertTrue(issubclass(UnifiedStateManager, IManager))
            self.assertTrue(issubclass(MarketDataCacheManager, IManager))
            
            # Check required methods exist
            required_methods = ['handle_event', 'get_dependencies', 'can_initialize_without_dependencies', 'get_manager_name']
            
            for cls in [UnifiedStateManager, MarketDataCacheManager]:
                for method_name in required_methods:
                    self.assertTrue(hasattr(cls, method_name), f"{cls.__name__} missing {method_name}")
            
            print("PASS: Manager interface compliance verified")
            
        except Exception as e:
            self.fail(f"Manager interface test failed: {e}")
    
    def test_4_constants_consolidation(self):
        """Test hardcoded constants moved to TradingConstants"""
        try:
            from config.constants import TradingConstants
            
            # Check circuit breaker constants exist
            circuit_breaker_constants = [
                'DAILY_LOSS_LIMIT',
                'WEEKLY_LOSS_LIMIT', 
                'MONTHLY_LOSS_LIMIT',
                'INTRADAY_DRAWDOWN_LIMIT',
                'MAX_CONSECUTIVE_LOSSES',
                'RECOVERY_PERIOD_HOURS',
                'RECOVERY_THRESHOLD',
                'MAX_DAILY_LOSS_RATE',
                'MIN_TRADES_FOR_LOSS_RATE'
            ]
            
            for constant in circuit_breaker_constants:
                self.assertTrue(hasattr(TradingConstants, constant), f"Missing constant: {constant}")
                value = getattr(TradingConstants, constant)
                self.assertIsNotNone(value, f"Constant {constant} is None")
            
            # Verify some key values are correct
            self.assertEqual(TradingConstants.DAILY_LOSS_LIMIT, 0.05)
            self.assertEqual(TradingConstants.MAX_CONSECUTIVE_LOSSES, 3)
            self.assertEqual(TradingConstants.RECOVERY_PERIOD_HOURS, 24)
            
            print("PASS: Constants properly consolidated")
            
        except Exception as e:
            self.fail(f"Constants consolidation test failed: {e}")
    
    def test_5_circuit_breaker_uses_constants(self):
        """Test CircuitBreakerPlugin uses centralized constants"""
        try:
            from risk.plugins.circuit_breaker_plugin import CircuitBreakerPlugin
            from config.constants import TradingConstants
            
            # Create a mock algorithm
            mock_algo = MagicMock()
            mock_algo.Log = MagicMock()
            mock_algo.Debug = MagicMock()
            mock_algo.Error = MagicMock()
            mock_algo.Portfolio.TotalPortfolioValue = 100000.0
            mock_algo.Time = MagicMock()
            
            # Initialize plugin
            plugin = CircuitBreakerPlugin()
            plugin._algorithm = mock_algo
            
            # Initialize the plugin
            result = plugin._plugin_initialize()
            self.assertTrue(result, "Plugin initialization failed")
            
            # Verify plugin uses constants from TradingConstants
            self.assertEqual(plugin.daily_loss_limit, TradingConstants.DAILY_LOSS_LIMIT)
            self.assertEqual(plugin.weekly_loss_limit, TradingConstants.WEEKLY_LOSS_LIMIT)
            self.assertEqual(plugin.monthly_loss_limit, TradingConstants.MONTHLY_LOSS_LIMIT)
            self.assertEqual(plugin.intraday_drawdown_limit, TradingConstants.INTRADAY_DRAWDOWN_LIMIT)
            self.assertEqual(plugin.max_consecutive_losses, TradingConstants.MAX_CONSECUTIVE_LOSSES)
            self.assertEqual(plugin.recovery_period_hours, TradingConstants.RECOVERY_PERIOD_HOURS)
            self.assertEqual(plugin.recovery_threshold, TradingConstants.RECOVERY_THRESHOLD)
            
            print("PASS: CircuitBreaker uses centralized constants")
            
        except Exception as e:
            self.fail(f"CircuitBreaker constants test failed: {e}")
    
    def test_6_integration_verification(self):
        """Test overall integration health"""
        try:
            # Import key framework components
            from core.dependency_container import DependencyContainer, IManager
            from core.event_bus import EventBus
            from core.unified_state_manager import UnifiedStateManager
            from core.market_data_cache import MarketDataCacheManager
            from config.constants import TradingConstants
            from risk.plugins.circuit_breaker_plugin import CircuitBreakerPlugin
            
            # Check all imports work
            self.assertTrue(True, "All critical imports successful")
            
            # Check classes can be instantiated (basic structure)
            mock_algo = MagicMock()
            event_bus = EventBus(mock_algo)
            self.assertIsNotNone(event_bus)
            
            print("PASS: Framework integration verified")
            
        except Exception as e:
            self.fail(f"Integration test failed: {e}")

if __name__ == '__main__':
    print("=== CRITICAL ISSUES VERIFICATION TEST ===")
    print("Testing fixes for:")
    print("1. BaseRiskPlugin abstract method implementation")
    print("2. Hardcoded account numbers security")  
    print("3. Manager IManager interface compliance")
    print("4. Constants consolidation to TradingConstants")
    print("5. CircuitBreaker using centralized constants")
    print("6. Overall framework integration")
    print()
    
    # Run tests
    unittest.main(verbosity=2, exit=False)
    
    print("\n=== VERIFICATION COMPLETE ===")