# Test Atomic Execution Integration
# Validates new IPMCC and LEAP ladder atomic methods

from AlgorithmImports import *
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor

class AtomicExecutionIntegrationTest:
    """
    Test suite for atomic execution integration validation

    CRITICAL: Validates new IPMCC and LEAP ladder atomic methods
    """

    def __init__(self, algorithm):
        self.algo = algorithm
        self.test_results = {}

    def run_all_tests(self) -> dict:
        """Run comprehensive atomic execution integration tests"""

        self.algo.Debug("[AtomicTest] Starting atomic execution integration tests")

        tests = [
            ("atomic_executor_availability", self.test_atomic_executor_availability),
            ("ipmcc_atomic_method", self.test_ipmcc_atomic_method_exists),
            ("leap_ladder_atomic_method", self.test_leap_ladder_atomic_method_exists),
            ("ipmcc_validation_methods", self.test_ipmcc_validation_methods),
            ("leap_validation_methods", self.test_leap_validation_methods),
            ("atomic_group_creation", self.test_atomic_group_creation),
            ("method_signatures", self.test_method_signatures),
            ("error_handling", self.test_error_handling_integration)
        ]

        for test_name, test_method in tests:
            try:
                result = test_method()
                self.test_results[test_name] = {
                    'status': 'PASS' if result else 'FAIL',
                    'details': f"Test executed: {result}"
                }
                self.algo.Debug(f"[AtomicTest] {test_name}: {'PASS' if result else 'FAIL'}")
            except Exception as e:
                self.test_results[test_name] = {
                    'status': 'ERROR',
                    'details': str(e)
                }
                self.algo.Error(f"[AtomicTest] {test_name}: ERROR - {e}")

        # Summary
        passed = sum(1 for r in self.test_results.values() if r['status'] == 'PASS')
        total = len(self.test_results)

        self.algo.Log(f"[AtomicTest] Integration tests complete: {passed}/{total} passed")

        return self.test_results

    def test_atomic_executor_availability(self) -> bool:
        """Test atomic executor is available and properly initialized"""

        if not hasattr(self.algo, 'atomic_executor'):
            return False

        if not isinstance(self.algo.atomic_executor, EnhancedAtomicOrderExecutor):
            return False

        return True

    def test_ipmcc_atomic_method_exists(self) -> bool:
        """Test IPMCC atomic method exists with correct signature"""

        if not hasattr(self.algo.atomic_executor, 'execute_ipmcc_atomic'):
            return False

        method = getattr(self.algo.atomic_executor, 'execute_ipmcc_atomic')

        # Check if it's callable
        if not callable(method):
            return False

        return True

    def test_leap_ladder_atomic_method_exists(self) -> bool:
        """Test LEAP ladder atomic method exists with correct signature"""

        if not hasattr(self.algo.atomic_executor, 'execute_leap_ladder_atomic'):
            return False

        method = getattr(self.algo.atomic_executor, 'execute_leap_ladder_atomic')

        # Check if it's callable
        if not callable(method):
            return False

        return True

    def test_ipmcc_validation_methods(self) -> bool:
        """Test IPMCC validation methods are available"""

        required_methods = [
            '_validate_ipmcc_configuration',
            '_validate_ipmcc_expirations',
            '_extract_strike_price',
            '_estimate_leap_cost'
        ]

        for method_name in required_methods:
            if not hasattr(self.algo.atomic_executor, method_name):
                self.algo.Debug(f"[AtomicTest] Missing IPMCC method: {method_name}")
                return False

        return True

    def test_leap_validation_methods(self) -> bool:
        """Test LEAP ladder validation methods are available"""

        required_methods = [
            '_validate_leap_ladder_configuration',
            '_estimate_option_cost'
        ]

        for method_name in required_methods:
            if not hasattr(self.algo.atomic_executor, method_name):
                self.algo.Debug(f"[AtomicTest] Missing LEAP method: {method_name}")
                return False

        return True

    def test_atomic_group_creation(self) -> bool:
        """Test atomic group creation works correctly"""

        try:
            # Test group creation
            group = self.algo.atomic_executor.create_atomic_group("TestGroup")

            if not group:
                return False

            # Test group has required attributes
            required_attrs = ['group_id', 'add_leg', 'execute', 'get_status']
            for attr in required_attrs:
                if not hasattr(group, attr):
                    self.algo.Debug(f"[AtomicTest] Group missing attribute: {attr}")
                    return False

            return True

        except Exception as e:
            self.algo.Debug(f"[AtomicTest] Group creation error: {e}")
            return False

    def test_method_signatures(self) -> bool:
        """Test method signatures accept expected parameters"""

        try:
            # Test IPMCC method signature (should not crash with proper parameters)
            # We won't actually execute, just validate signature
            import inspect

            ipmcc_method = getattr(self.algo.atomic_executor, 'execute_ipmcc_atomic')
            ipmcc_sig = inspect.signature(ipmcc_method)

            expected_params = ['leap_call', 'weekly_call', 'quantity']
            actual_params = list(ipmcc_sig.parameters.keys())

            for param in expected_params:
                if param not in actual_params:
                    self.algo.Debug(f"[AtomicTest] IPMCC missing parameter: {param}")
                    return False

            # Test LEAP method signature
            leap_method = getattr(self.algo.atomic_executor, 'execute_leap_ladder_atomic')
            leap_sig = inspect.signature(leap_method)

            expected_params = ['ladder_legs', 'strategy_name']
            actual_params = list(leap_sig.parameters.keys())

            for param in expected_params:
                if param not in actual_params:
                    self.algo.Debug(f"[AtomicTest] LEAP missing parameter: {param}")
                    return False

            return True

        except Exception as e:
            self.algo.Debug(f"[AtomicTest] Signature validation error: {e}")
            return False

    def test_error_handling_integration(self) -> bool:
        """Test error handling integration with main algorithm"""

        try:
            # Test that atomic executor properly logs to algorithm
            # This validates the algo reference is correctly passed

            # Test with invalid parameters (should handle gracefully)
            result = self.algo.atomic_executor.execute_ipmcc_atomic(
                leap_call=None,  # Invalid
                weekly_call=None,  # Invalid
                quantity=0  # Invalid
            )

            # Should return False, not crash
            if result is not False:
                self.algo.Debug("[AtomicTest] Expected False return for invalid parameters")
                return False

            # Test LEAP ladder with empty list
            result = self.algo.atomic_executor.execute_leap_ladder_atomic(
                ladder_legs=[],  # Empty list
                strategy_name="TestStrategy"
            )

            # Should return False, not crash
            if result is not False:
                self.algo.Debug("[AtomicTest] Expected False return for empty ladder")
                return False

            return True

        except Exception as e:
            self.algo.Debug(f"[AtomicTest] Error handling test failed: {e}")
            return False

def run_atomic_integration_tests(algorithm) -> dict:
    """
    Convenience function to run atomic execution integration tests

    Args:
        algorithm: QuantConnect algorithm instance

    Returns:
        dict: Test results with status and details
    """

    test_suite = AtomicExecutionIntegrationTest(algorithm)
    return test_suite.run_all_tests()