# Tom King Trading Framework - Comprehensive Position Exit System Test
# Tests all Tom King exit rules: profit targets, stop losses, 21 DTE, defensive exits

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import unittest
from unittest.mock import Mock, MagicMock

# Import the modules to test
from trading.position_exit_manager import PositionExitManager, ExitReason
from trading.order_execution_engine import ExecutionEngine, OrderType

class TestPositionExitSystem:
    """
    Comprehensive test suite for Tom King position exit rules
    
    TESTS:
    1. 50% Profit Target Exit for LT112 (standard positions)
    2. 25% Profit Target Exit for 0DTE positions
    3. 200% Stop Loss Exit (2x credit received)
    4. 21 DTE Mandatory Exit
    5. VIX Spike Defensive Exits (>35)
    6. Assignment Risk Management
    7. Portfolio Drawdown Exits (>15%)
    8. Integration with Execution Engine
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Initialize systems under test
        self.exit_manager = PositionExitManager(algorithm)
        self.execution_engine = ExecutionEngine(algorithm)
        
        # Test counters
        self.test_results = {
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'detailed_results': []
        }
        
        # Mock positions for testing
        self.test_positions = self._create_test_positions()
        
        self.algorithm.Log("🧪 POSITION EXIT SYSTEM TEST INITIALIZED")
    
    def run_all_exit_tests(self) -> Dict:
        """Run comprehensive exit system tests"""
        self.algorithm.Log("\n🧪 STARTING POSITION EXIT SYSTEM TESTS")
        
        # Test 1: Profit Target Exits
        self._test_profit_target_exits()
        
        # Test 2: Stop Loss Exits
        self._test_stop_loss_exits()
        
        # Test 3: 21 DTE Exits
        self._test_dte_exits()
        
        # Test 4: Assignment Risk Exits
        self._test_assignment_risk_exits()
        
        # Test 5: Defensive Exits
        self._test_defensive_exits()
        
        # Test 6: Exit Execution Integration
        self._test_exit_execution_integration()
        
        # Test 7: Exit Statistics Tracking
        self._test_exit_statistics()
        
        # Test 8: Multi-Position Exit Management
        self._test_multi_position_exit_management()
        
        # Summary
        self._log_test_summary()
        
        return self.test_results
    
    def _test_profit_target_exits(self):
        """Test Tom King profit target rules"""
        self.algorithm.Log("\n📊 Testing Profit Target Exits...")
        
        # Test 1: LT112 50% profit target
        lt112_position = {
            'position_id': 'TEST_LT112_001',
            'type': OrderType.PUT_SPREAD,
            'max_profit': 100.0,
            'entry_time': self.algorithm.Time - timedelta(days=5),
            'status': 'open'
        }
        
        # Mock 60% profit scenario
        with self._mock_position_pnl(60.0):
            result = self.exit_manager._check_profit_target(lt112_position)
            
            expected = True  # Should exit at 50% target
            actual = result['should_exit']
            self._assert_test("LT112 50% Profit Target", expected, actual, result)
        
        # Test 2: Friday 0DTE 25% profit target
        friday_position = {
            'position_id': 'TEST_FRIDAY_001',
            'type': OrderType.IRON_CONDOR,
            'credit': 50.0,
            'max_profit': 50.0,
            'entry_time': self.algorithm.Time,
            'status': 'open'
        }
        
        # Mock 30% profit scenario
        with self._mock_position_pnl(15.0):  # 30% of 50 credit
            result = self.exit_manager._check_profit_target(friday_position)
            
            expected = True  # Should exit at 25% target for 0DTE
            actual = result['should_exit']
            self._assert_test("0DTE 25% Profit Target", expected, actual, result)
        
        # Test 3: Below profit target - no exit
        with self._mock_position_pnl(20.0):  # 20% profit
            result = self.exit_manager._check_profit_target(lt112_position)
            
            expected = False  # Should not exit below 50%
            actual = result['should_exit']
            self._assert_test("Below Profit Target - No Exit", expected, actual, result)
    
    def _test_stop_loss_exits(self):
        """Test Tom King 200% stop loss rule"""
        self.algorithm.Log("\n🛑 Testing Stop Loss Exits...")
        
        # Test 1: 200% stop loss triggered
        position = {
            'position_id': 'TEST_STOPLOSS_001',
            'type': OrderType.PUT_SPREAD,
            'max_profit': 100.0,
            'credit': 100.0,
            'entry_time': self.algorithm.Time - timedelta(days=10),
            'status': 'open'
        }
        
        # Mock 250% loss scenario (loss of $250 on $100 credit = 2.5x)
        with self._mock_position_pnl(-250.0):
            result = self.exit_manager._check_stop_loss(position)
            
            expected = True  # Should exit at 200% loss
            actual = result['should_exit']
            self._assert_test("200% Stop Loss Triggered", expected, actual, result)
        
        # Test 2: Below stop loss threshold
        with self._mock_position_pnl(-150.0):  # 150% loss (below 200% threshold)
            result = self.exit_manager._check_stop_loss(position)
            
            expected = False  # Should not exit below 200%
            actual = result['should_exit']
            self._assert_test("Below Stop Loss Threshold", expected, actual, result)
        
        # Test 3: Profitable position - no stop loss
        with self._mock_position_pnl(25.0):
            result = self.exit_manager._check_stop_loss(position)
            
            expected = False  # No stop loss on profit
            actual = result['should_exit']
            self._assert_test("Profitable Position - No Stop Loss", expected, actual, result)
    
    def _test_dte_exits(self):
        """Test Tom King 21 DTE mandatory exit rule"""
        self.algorithm.Log("\n📅 Testing 21 DTE Exit Rule...")
        
        # Test 1: 21 DTE exit triggered
        position_21_dte = {
            'position_id': 'TEST_21DTE_001',
            'type': OrderType.PUT_SPREAD,
            'expiry': self.algorithm.Time.date() + timedelta(days=21),
            'status': 'open'
        }
        
        result = self.exit_manager._check_dte_exit(position_21_dte)
        expected = True  # Should exit at exactly 21 DTE
        actual = result['should_exit']
        self._assert_test("21 DTE Exit Triggered", expected, actual, result)
        
        # Test 2: Below 21 DTE - still exit
        position_10_dte = {
            'position_id': 'TEST_10DTE_001',
            'type': OrderType.STRANGLE,
            'expiry': self.algorithm.Time.date() + timedelta(days=10),
            'status': 'open'
        }
        
        result = self.exit_manager._check_dte_exit(position_10_dte)
        expected = True  # Should exit below 21 DTE
        actual = result['should_exit']
        self._assert_test("Below 21 DTE Exit", expected, actual, result)
        
        # Test 3: Above 21 DTE - no exit
        position_30_dte = {
            'position_id': 'TEST_30DTE_001',
            'type': OrderType.PUT_SPREAD,
            'expiry': self.algorithm.Time.date() + timedelta(days=30),
            'status': 'open'
        }
        
        result = self.exit_manager._check_dte_exit(position_30_dte)
        expected = False  # Should not exit above 21 DTE
        actual = result['should_exit']
        self._assert_test("Above 21 DTE - No Exit", expected, actual, result)
        
        # Test 4: 0DTE position
        position_0_dte = {
            'position_id': 'TEST_0DTE_001',
            'type': OrderType.IRON_CONDOR,
            'expiry': self.algorithm.Time.date(),
            'status': 'open'
        }
        
        result = self.exit_manager._check_dte_exit(position_0_dte)
        expected = True  # Should exit 0DTE
        actual = result['should_exit']
        self._assert_test("0DTE Exit", expected, actual, result)
    
    def _test_assignment_risk_exits(self):
        """Test assignment risk management"""
        self.algorithm.Log("\n⚠️ Testing Assignment Risk Management...")
        
        # Mock SPY at $500
        self._mock_underlying_price('SPY', 500.0)
        
        # Test 1: Short put ITM beyond threshold (2%)
        position_put_itm = {
            'position_id': 'TEST_ASSIGN_PUT_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY',
            'short_strike': 510.0,  # Put $10 ITM (2% threshold)
            'expiry': self.algorithm.Time.date() + timedelta(days=5),  # Within 7 DTE
            'status': 'open'
        }
        
        result = self.exit_manager._check_assignment_risk(position_put_itm)
        expected = True  # Should exit due to assignment risk
        actual = result['should_exit']
        self._assert_test("Short Put ITM Assignment Risk", expected, actual, result)
        
        # Test 2: Short call ITM beyond threshold (1%)
        position_call_itm = {
            'position_id': 'TEST_ASSIGN_CALL_001',
            'type': OrderType.STRANGLE,
            'underlying': 'SPY',
            'call_strike': 495.0,  # Call $5 ITM (1% threshold)
            'expiry': self.algorithm.Time.date() + timedelta(days=3),
            'status': 'open'
        }
        
        result = self.exit_manager._check_assignment_risk(position_call_itm)
        expected = True  # Should exit due to call assignment risk
        actual = result['should_exit']
        self._assert_test("Short Call ITM Assignment Risk", expected, actual, result)
        
        # Test 3: OTM options - no assignment risk
        position_otm = {
            'position_id': 'TEST_ASSIGN_OTM_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY',
            'short_strike': 480.0,  # Put $20 OTM
            'expiry': self.algorithm.Time.date() + timedelta(days=2),
            'status': 'open'
        }
        
        result = self.exit_manager._check_assignment_risk(position_otm)
        expected = False  # No assignment risk for OTM
        actual = result['should_exit']
        self._assert_test("OTM Options - No Assignment Risk", expected, actual, result)
        
        # Test 4: Long DTE - no assignment check
        position_long_dte = {
            'position_id': 'TEST_ASSIGN_LONGDTE_001',
            'type': OrderType.PUT_SPREAD,
            'underlying': 'SPY',
            'short_strike': 510.0,  # Same ITM put
            'expiry': self.algorithm.Time.date() + timedelta(days=30),  # 30 DTE
            'status': 'open'
        }
        
        result = self.exit_manager._check_assignment_risk(position_long_dte)
        expected = False  # No assignment check > 7 DTE
        actual = result['should_exit']
        self._assert_test("Long DTE - No Assignment Check", expected, actual, result)
    
    def _test_defensive_exits(self):
        """Test defensive exit conditions"""
        self.algorithm.Log("\n🚨 Testing Defensive Exits...")
        
        # Test 1: VIX spike above 35
        self._mock_vix_price(40.0)
        
        position = {
            'position_id': 'TEST_VIX_001',
            'type': OrderType.PUT_SPREAD,
            'status': 'open'
        }
        
        result = self.exit_manager._check_defensive_exit(position)
        expected = True  # Should exit on VIX > 35
        actual = result['should_exit']
        self._assert_test("VIX Spike Defensive Exit", expected, actual, result)
        
        # Test 2: VIX below threshold
        self._mock_vix_price(25.0)
        
        result = self.exit_manager._check_defensive_exit(position)
        expected = False  # No exit below VIX 35
        actual = result['should_exit'] and result['reason'] == ExitReason.VIX_SPIKE
        self._assert_test("VIX Below Threshold", False, actual, result)
        
        # Test 3: Portfolio drawdown > 15%
        self._mock_portfolio_drawdown(0.20)  # 20% drawdown
        
        result = self.exit_manager._check_defensive_exit(position)
        expected = True  # Should exit on 15%+ drawdown
        actual = result['should_exit'] and result['reason'] == ExitReason.DEFENSIVE
        self._assert_test("Portfolio Drawdown Defensive Exit", expected, actual, result)
    
    def _test_exit_execution_integration(self):
        """Test integration with execution engine"""
        self.algorithm.Log("\n⚙️ Testing Exit Execution Integration...")
        
        # Create test positions in execution engine
        test_positions = {
            'TEST_EXEC_001': {
                'position_id': 'TEST_EXEC_001',
                'type': OrderType.PUT_SPREAD,
                'status': 'open',
                'max_profit': 100.0,
                'entry_time': self.algorithm.Time - timedelta(days=5)
            }
        }
        
        # Mock execution engine close_position method
        mock_execution = Mock()
        mock_execution.close_position = Mock(return_value=True)
        
        # Mock profitable position for exit
        with self._mock_position_pnl(60.0):  # 60% profit, above 50% target
            positions_to_exit = self.exit_manager.CheckPositionExits(test_positions)
            
            # Should find one position to exit
            expected = 1
            actual = len(positions_to_exit)
            self._assert_test("Exit Detection", expected, actual, positions_to_exit)
            
            # Execute exits
            if positions_to_exit:
                results = self.exit_manager.ExecuteExits(positions_to_exit, mock_execution)
                
                expected = True  # Should be successful
                actual = results.get('TEST_EXEC_001', {}).get('success', False)
                self._assert_test("Exit Execution", expected, actual, results)
    
    def _test_exit_statistics(self):
        """Test exit statistics tracking"""
        self.algorithm.Log("\n📈 Testing Exit Statistics...")
        
        # Simulate various exits
        self.exit_manager._update_exit_statistics(ExitReason.PROFIT_TARGET)
        self.exit_manager._update_exit_statistics(ExitReason.STOP_LOSS)
        self.exit_manager._update_exit_statistics(ExitReason.DTE_EXIT)
        self.exit_manager._update_exit_statistics(ExitReason.DEFENSIVE)
        
        stats = self.exit_manager.GetExitStatistics()
        
        # Check statistics
        tests = [
            ("Total Exits", 4, stats['total_exits']),
            ("Profit Targets", 1, stats['profit_targets_hit']),
            ("Stop Losses", 1, stats['stop_losses_hit']),
            ("DTE Exits", 1, stats['dte_exits']),
            ("Defensive Exits", 1, stats['defensive_exits'])
        ]
        
        for test_name, expected, actual in tests:
            self._assert_test(f"Exit Stats - {test_name}", expected, actual, stats)
    
    def _test_multi_position_exit_management(self):
        """Test managing multiple positions simultaneously"""
        self.algorithm.Log("\n🎯 Testing Multi-Position Exit Management...")
        
        # Create multiple positions with different exit conditions
        positions = {
            'PROFIT_EXIT': {
                'position_id': 'PROFIT_EXIT',
                'type': OrderType.PUT_SPREAD,
                'max_profit': 100.0,
                'status': 'open'
            },
            'DTE_EXIT': {
                'position_id': 'DTE_EXIT',
                'type': OrderType.STRANGLE,
                'expiry': self.algorithm.Time.date() + timedelta(days=15),  # < 21 DTE
                'status': 'open'
            },
            'NO_EXIT': {
                'position_id': 'NO_EXIT',
                'type': OrderType.PUT_SPREAD,
                'max_profit': 100.0,
                'expiry': self.algorithm.Time.date() + timedelta(days=45),
                'status': 'open'
            }
        }
        
        # Mock profit for first position only
        def mock_pnl(position):
            if position['position_id'] == 'PROFIT_EXIT':
                return 60.0  # Profitable
            return 10.0  # Small profit, below threshold
        
        with self._mock_variable_position_pnl(mock_pnl):
            positions_to_exit = self.exit_manager.CheckPositionExits(positions)
            
            # Should find 2 positions to exit (profit + DTE)
            expected = 2
            actual = len(positions_to_exit)
            self._assert_test("Multi-Position Exit Detection", expected, actual, positions_to_exit)
            
            # Check exit reasons
            exit_reasons = [exit_info['exit_reason'] for exit_info in positions_to_exit]
            
            expected_profit = ExitReason.PROFIT_TARGET in exit_reasons
            expected_dte = ExitReason.DTE_EXIT in exit_reasons
            
            self._assert_test("Profit Target Exit Found", True, expected_profit, exit_reasons)
            self._assert_test("DTE Exit Found", True, expected_dte, exit_reasons)
    
    def _create_test_positions(self) -> Dict:
        """Create mock positions for testing"""
        return {
            'LT112_001': {
                'position_id': 'LT112_001',
                'type': OrderType.PUT_SPREAD,
                'underlying': 'SPY',
                'max_profit': 100.0,
                'status': 'open'
            },
            'FRIDAY_001': {
                'position_id': 'FRIDAY_001',
                'type': OrderType.IRON_CONDOR,
                'underlying': 'SPY',
                'credit': 50.0,
                'status': 'open'
            }
        }
    
    # Helper methods for mocking
    def _mock_position_pnl(self, pnl_value):
        """Mock context manager for position P&L"""
        class MockPnL:
            def __init__(self, exit_manager, value):
                self.exit_manager = exit_manager
                self.value = value
                self.original_method = None
            
            def __enter__(self):
                self.original_method = self.exit_manager._calculate_position_pnl
                self.exit_manager._calculate_position_pnl = lambda pos: self.value
                return self
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.original_method:
                    self.exit_manager._calculate_position_pnl = self.original_method
        
        return MockPnL(self.exit_manager, pnl_value)
    
    def _mock_variable_position_pnl(self, pnl_function):
        """Mock context manager for variable position P&L"""
        class MockVariablePnL:
            def __init__(self, exit_manager, func):
                self.exit_manager = exit_manager
                self.func = func
                self.original_method = None
            
            def __enter__(self):
                self.original_method = self.exit_manager._calculate_position_pnl
                self.exit_manager._calculate_position_pnl = self.func
                return self
            
            def __exit__(self, exc_type, exc_val, exc_tb):
                if self.original_method:
                    self.exit_manager._calculate_position_pnl = self.original_method
        
        return MockVariablePnL(self.exit_manager, pnl_function)
    
    def _mock_underlying_price(self, symbol, price):
        """Mock underlying price"""
        if symbol not in self.algorithm.Securities:
            # Create mock security
            mock_security = Mock()
            mock_security.Price = price
            self.algorithm.Securities[symbol] = mock_security
        else:
            self.algorithm.Securities[symbol].Price = price
    
    def _mock_vix_price(self, vix_price):
        """Mock VIX price"""
        self._mock_underlying_price('VIX', vix_price)
    
    def _mock_portfolio_drawdown(self, drawdown_pct):
        """Mock portfolio drawdown"""
        starting_value = getattr(self.algorithm, 'starting_portfolio_value', 75000)
        current_value = starting_value * (1 - drawdown_pct)
        self.algorithm.Portfolio.TotalPortfolioValue = current_value
    
    def _assert_test(self, test_name: str, expected, actual, context=None):
        """Assert test result and log"""
        self.test_results['tests_run'] += 1
        
        if expected == actual:
            self.test_results['tests_passed'] += 1
            result = "✅ PASSED"
        else:
            self.test_results['tests_failed'] += 1
            result = "❌ FAILED"
        
        self.test_results['detailed_results'].append({
            'test': test_name,
            'expected': expected,
            'actual': actual,
            'passed': expected == actual,
            'context': context
        })
        
        self.algorithm.Log(f"  {result}: {test_name}")
        if expected != actual:
            self.algorithm.Log(f"    Expected: {expected}, Got: {actual}")
            if context:
                self.algorithm.Log(f"    Context: {context}")
    
    def _log_test_summary(self):
        """Log comprehensive test summary"""
        self.algorithm.Log("\n" + "="*60)
        self.algorithm.Log("📊 POSITION EXIT SYSTEM TEST SUMMARY")
        self.algorithm.Log("="*60)
        
        total = self.test_results['tests_run']
        passed = self.test_results['tests_passed']
        failed = self.test_results['tests_failed']
        
        self.algorithm.Log(f"Total Tests: {total}")
        self.algorithm.Log(f"Passed: {passed} ({passed/total*100:.1f}%)")
        self.algorithm.Log(f"Failed: {failed} ({failed/total*100:.1f}%)")
        
        if failed > 0:
            self.algorithm.Log("\n❌ FAILED TESTS:")
            for result in self.test_results['detailed_results']:
                if not result['passed']:
                    self.algorithm.Log(f"  - {result['test']}: Expected {result['expected']}, Got {result['actual']}")
        
        # Exit Rules Coverage Summary
        self.algorithm.Log("\n📋 EXIT RULES TESTED:")
        self.algorithm.Log("  ✅ 50% Profit Target (LT112)")
        self.algorithm.Log("  ✅ 25% Profit Target (0DTE)")
        self.algorithm.Log("  ✅ 200% Stop Loss Rule")
        self.algorithm.Log("  ✅ 21 DTE Mandatory Exit")
        self.algorithm.Log("  ✅ Assignment Risk Management")
        self.algorithm.Log("  ✅ VIX Spike Defensive Exits")
        self.algorithm.Log("  ✅ Portfolio Drawdown Exits")
        self.algorithm.Log("  ✅ Exit Execution Integration")
        self.algorithm.Log("  ✅ Multi-Position Management")
        
        success_rate = passed / total * 100
        if success_rate >= 95:
            self.algorithm.Log(f"\n🎉 EXCELLENT: {success_rate:.1f}% success rate")
        elif success_rate >= 85:
            self.algorithm.Log(f"\n👍 GOOD: {success_rate:.1f}% success rate")
        else:
            self.algorithm.Log(f"\n⚠️ NEEDS WORK: {success_rate:.1f}% success rate")