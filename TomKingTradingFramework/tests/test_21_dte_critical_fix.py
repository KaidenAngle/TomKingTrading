#!/usr/bin/env python3
"""
CRITICAL TradingConstants.DEFENSIVE_EXIT_DTE DTE FIX UNIT TESTS
Tests the absolute TradingConstants.DEFENSIVE_EXIT_DTE DTE exit rule implementation across all components

This test suite validates the CRITICAL fix for the TradingConstants.DEFENSIVE_EXIT_DTE DTE methodology violation
discovered during the DEEP LOGIC ANALYSIS PROTOCOL execution.

BACKGROUND:
- Tom King's methodology: "Exit all positions at TradingConstants.DEFENSIVE_EXIT_DTE DTE to avoid gamma risk"
- Original violation: LT112 component manager added 25% profit conditions
- Fixed components: lt112_component_manager.py, correlation_manager.py
- Removed: defensive_manager.py (unused legacy with incorrect logic)

CRITICAL REQUIREMENT: TradingConstants.DEFENSIVE_EXIT_DTE DTE exit must be ABSOLUTE with NO CONDITIONS
"""

import unittest
from unittest.mock import Mock, MagicMock, patch
import sys
import os
from datetime import datetime, timedelta

# Add framework root to path
framework_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, framework_root)

# Import components under test
from strategies.lt112_component_manager import FixedLT112Management
from risk.correlation_manager import CorrelationManager
from strategies.tom_king_exit_rules import TomKingExitRules

class MockAlgorithm:
    """Mock algorithm for testing TradingConstants.DEFENSIVE_EXIT_DTE DTE functionality"""
    
    def __init__(self):
        self.Time = datetime(2024, 3, 15, 10, 0, 0)  # Base test time
        self.LiveMode = False
        self.Securities = {
            'VIX': Mock(Price=18.5),
            'SPY': Mock(Price=450.0)
        }
        self.Portfolio = Mock()
        self.Portfolio.TotalPortfolioValue = 100000.0
        self.Portfolio.TotalMarginUsed = 50000.0
        self.Portfolio.Cash = 50000.0
        
        # Track log messages for verification
        self.log_messages = []
        self.debug_messages = []
        self.error_messages = []
        
    def Log(self, message):
        self.log_messages.append(message)
        
    def Debug(self, message):
        self.debug_messages.append(message)
        
    def Error(self, message):
        self.error_messages.append(message)

class MockPositionStateManager:
    """Mock position state manager for testing"""
    
    def __init__(self):
        self.positions = {}
        
    def close_lt112_naked_puts_only(self, position_id: str) -> bool:
        return True
        
    def close_lt112_debit_spread_only(self, position_id: str) -> bool:
        return True

class MockPosition:
    """Mock position for testing"""
    
    def __init__(self, strategy="LT112", position_id="TEST_001", entry_time=None, expiry=None):
        self.strategy = strategy
        self.position_id = position_id
        self.symbol = "SPY"
        self.status = "OPEN"
        self.entry_time = entry_time or datetime(2024, 2, 15)  # ~1 month ago
        self.components = {}
        self.expiry = expiry
        
        # Add mock components
        self._create_mock_components()
    
    def _create_mock_components(self):
        """Create mock LT112 components"""
        
        # Mock naked put
        naked_put = Mock()
        naked_put.component_id = "NAKED_PUT_001"
        naked_put.component_type = "NAKED_PUT"
        naked_put.status = "OPEN"
        naked_put.entry_price = -2.50
        naked_put.current_price = 1.25
        naked_put.quantity = -2
        naked_put.pnl = 250.0  # Profit
        naked_put.strike = 440
        naked_put.expiry = self.expiry or datetime(2024, 4, 5)  # 21 days from base time
        naked_put.contract_symbol = "SPY240405P00440000"  # Mock contract symbol
        
        # Mock debit long
        debit_long = Mock()
        debit_long.component_id = "DEBIT_LONG_001"
        debit_long.component_type = "DEBIT_LONG"
        debit_long.status = "OPEN"
        debit_long.entry_price = 3.00
        debit_long.current_price = 4.50
        debit_long.quantity = 1
        debit_long.pnl = 150.0  # Profit
        debit_long.strike = 450
        debit_long.expiry = self.expiry or datetime(2024, 4, 5)
        debit_long.contract_symbol = "SPY240405C00450000"  # Mock contract symbol
        
        # Mock debit short
        debit_short = Mock()
        debit_short.component_id = "DEBIT_SHORT_001"
        debit_short.component_type = "DEBIT_SHORT"
        debit_short.status = "OPEN"
        debit_short.entry_price = -1.00
        debit_short.current_price = -0.75
        debit_short.quantity = -1
        debit_short.pnl = 25.0  # Small profit
        debit_short.strike = 455
        debit_short.expiry = self.expiry or datetime(2024, 4, 5)
        debit_short.contract_symbol = "SPY240405C00455000"  # Mock contract symbol
        
        self.components = {
            "NAKED_PUT_001": naked_put,
            "DEBIT_LONG_001": debit_long,
            "DEBIT_SHORT_001": debit_short
        }
    
    def get_components_by_type(self, component_type: str):
        """Get components by type"""
        return [comp for comp in self.components.values() 
                if comp.component_type == component_type]
    
    def calculate_total_pnl(self):
        """Calculate total P&L"""
        return sum(comp.pnl for comp in self.components.values())
    
    def remove_component(self, component_id: str):
        """Remove component (for testing close operations)"""
        return self.components.pop(component_id, None)

class Test21DTEAbsoluteExitRule(unittest.TestCase):
    """Test the absolute TradingConstants.DEFENSIVE_EXIT_DTE DTE exit rule across all components"""
    
    def setUp(self):
        self.algo = MockAlgorithm()
        self.psm = MockPositionStateManager()
        
        # Component under test
        self.lt112_manager = FixedLT112Management(self.algo, self.psm)
        self.correlation_manager = CorrelationManager(self.algo)
        self.exit_rules = TomKingExitRules(self.algo)
    
    def test_21_dte_absolute_exit_regardless_of_profit(self):
        """CRITICAL: Verify TradingConstants.DEFENSIVE_EXIT_DTE DTE exit triggers REGARDLESS of P&L"""
        
        # Create position at exactly TradingConstants.DEFENSIVE_EXIT_DTE DTE with MASSIVE PROFIT (500% gain)
        expiry_date = self.algo.Time + timedelta(days=21)
        position = MockPosition(expiry=expiry_date)
        
        # Simulate massive profit that might tempt keeping position
        for comp in position.components.values():
            comp.pnl = 1000.0  # $1000 profit per component
        
        # Add to PSM
        self.psm.positions['TEST_001'] = position
        
        # Run analysis
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # CRITICAL ASSERTION: Must have TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit action
        self.assertGreater(len(actions), 0, "Should generate actions at TradingConstants.DEFENSIVE_EXIT_DTE DTE")
        
        # Find the TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive action
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 1, "Should have exactly 1 defensive exit action")
        
        defensive_action = defensive_actions[0]
        self.assertEqual(defensive_action['action'], 'CLOSE_ENTIRE_POSITION')
        self.assertEqual(defensive_action['priority'], 'URGENT')
        self.assertIn('TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit', defensive_action['reason'])
        self.assertIn('ABSOLUTE', defensive_action['tom_king_rule'])
    
    def test_21_dte_absolute_exit_with_huge_losses(self):
        """CRITICAL: Verify TradingConstants.DEFENSIVE_EXIT_DTE DTE exit triggers even with massive losses"""
        
        # Create position at exactly TradingConstants.DEFENSIVE_EXIT_DTE DTE with MASSIVE LOSSES
        expiry_date = self.algo.Time + timedelta(days=21)
        position = MockPosition(expiry=expiry_date)
        
        # Simulate massive losses that might tempt keeping to recover
        for comp in position.components.values():
            comp.pnl = -2000.0  # $2000 loss per component (disaster scenario)
        
        # Add to PSM
        self.psm.positions['TEST_001'] = position
        
        # Run analysis
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # CRITICAL ASSERTION: Must have TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit action DESPITE massive losses
        self.assertGreater(len(actions), 0, "Should generate actions even with massive losses")
        
        # Find the TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive action
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 1, "Should have defensive exit despite losses")
        
        defensive_action = defensive_actions[0]
        self.assertEqual(defensive_action['action'], 'CLOSE_ENTIRE_POSITION')
        self.assertEqual(defensive_action['priority'], 'URGENT')
        self.assertIn('TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit', defensive_action['reason'])
        self.assertIn('mandatory closure', defensive_action['reason'])
    
    def test_20_dte_triggers_absolute_exit(self):
        """Verify positions with < TradingConstants.DEFENSIVE_EXIT_DTE DTE also trigger absolute exit"""
        
        # Create position at 20 DTE (less than threshold)
        expiry_date = self.algo.Time + timedelta(days=20)
        position = MockPosition(expiry=expiry_date)
        
        self.psm.positions['TEST_001'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # Should trigger exit at 20 DTE
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]['action'], 'CLOSE_ENTIRE_POSITION')
        self.assertEqual(actions[0]['priority'], 'URGENT')
    
    def test_22_dte_no_exit_yet(self):
        """Verify positions with > TradingConstants.DEFENSIVE_EXIT_DTE DTE do NOT trigger defensive exit"""
        
        # Create position at 22 DTE (above threshold)
        expiry_date = self.algo.Time + timedelta(days=22)
        position = MockPosition(expiry=expiry_date)
        
        self.psm.positions['TEST_001'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # Should NOT trigger defensive exit yet (might have profit/loss exits)
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 0, 
                        "Should not trigger TradingConstants.DEFENSIVE_EXIT_DTE DTE exit at 22 DTE")
    
    def test_correlation_manager_absolute_should_defend(self):
        """Test correlation manager ShouldDefend implements absolute rule"""
        
        # Test exactly TradingConstants.DEFENSIVE_EXIT_DTE DTE
        position_info = {
            'symbol': 'SPY',
            'dte': 21,
            'strategy': 'LT112',
            'pnl': 5000.0  # Massive profit
        }
        
        should_defend = self.correlation_manager.ShouldDefend(position_info)
        self.assertTrue(should_defend, "Should defend at exactly TradingConstants.DEFENSIVE_EXIT_DTE DTE")
        
        # Verify log shows absolute trigger
        self.assertTrue(any('TradingConstants.DEFENSIVE_EXIT_DTE DTE absolute defense triggered' in msg 
                          for msg in self.algo.log_messages))
    
    def test_correlation_manager_no_conditions_check(self):
        """CRITICAL: Verify correlation manager has NO profit/loss conditions"""
        
        # Test with various P&L scenarios - all should trigger at TradingConstants.DEFENSIVE_EXIT_DTE DTE
        test_scenarios = [
            {'dte': 21, 'pnl': 10000.0, 'description': 'massive_profit'},
            {'dte': 21, 'pnl': -10000.0, 'description': 'massive_loss'},
            {'dte': 21, 'pnl': 0.0, 'description': 'break_even'},
            {'dte': 20, 'pnl': 1000000.0, 'description': 'million_dollar_profit'},
            {'dte': 15, 'pnl': -500000.0, 'description': 'catastrophic_loss'}
        ]
        
        for scenario in test_scenarios:
            with self.subTest(scenario=scenario['description']):
                position_info = {
                    'symbol': 'SPY',
                    'dte': scenario['dte'],
                    'pnl': scenario['pnl']
                }
                
                # Clear previous log messages
                self.algo.log_messages.clear()
                
                should_defend = self.correlation_manager.ShouldDefend(position_info)
                self.assertTrue(should_defend, 
                               f"Should defend in {scenario['description']} scenario")
    
    def test_exit_rules_21_dte_check(self):
        """Test TomKingExitRules TradingConstants.DEFENSIVE_EXIT_DTE DTE implementation"""
        
        position = {
            'strategy': 'LT112',
            'dte': 21,
            'entry_credit': 500.0,
            'current_value': 250.0,  # 50% profit - normally would exit
            'unrealized_pnl': 0
        }
        
        should_exit, reason, action = self.exit_rules.check_dte_rule(position)
        
        self.assertTrue(should_exit, "Should exit at TradingConstants.DEFENSIVE_EXIT_DTE DTE")
        self.assertEqual(action, 'close')
        self.assertIn('TradingConstants.DEFENSIVE_EXIT_DTE DTE rule', reason)

class Test21DTEEdgeCases(unittest.TestCase):
    """Test edge cases for TradingConstants.DEFENSIVE_EXIT_DTE DTE implementation"""
    
    def setUp(self):
        self.algo = MockAlgorithm()
        self.psm = MockPositionStateManager()
        self.lt112_manager = FixedLT112Management(self.algo, self.psm)
    
    def test_fractional_dte_handling(self):
        """Test handling of fractional DTE values"""
        
        # Test TradingConstants.DEFENSIVE_EXIT_DTE.9 DTE - Important: .days calculation truncates to 21, so WILL trigger
        # This is correct behavior - we don't want fractional precision in defensive exits
        expiry_date = self.algo.Time + timedelta(days=21, hours=22)
        position = MockPosition(expiry=expiry_date)
        self.psm.positions['TEST_001'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        # TradingConstants.DEFENSIVE_EXIT_DTE.9 DTE becomes TradingConstants.DEFENSIVE_EXIT_DTE DTE in calculation - should trigger (correct behavior)
        self.assertEqual(len(defensive_actions), 1, "TradingConstants.DEFENSIVE_EXIT_DTE.9 DTE truncates to TradingConstants.DEFENSIVE_EXIT_DTE DTE - should trigger")
        
        # Test 22.1 DTE (should NOT trigger - truncates to 22)
        expiry_date = self.algo.Time + timedelta(days=22, hours=2) 
        position = MockPosition(expiry=expiry_date)
        self.psm.positions['TEST_002'] = position
        
        # Clear previous position to avoid interference
        self.psm.positions.clear()
        self.psm.positions['TEST_002'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 0, "22.1 DTE truncates to 22 DTE - should not trigger")
    
    def test_weekend_market_closure_dte(self):
        """Test DTE calculation over weekends/holidays"""
        
        # Set algorithm time to Friday
        self.algo.Time = datetime(2024, 3, 15, 15, 0, 0)  # Friday 3PM
        
        # Expiry on Monday 3 weeks later (21 calendar days, ~15 trading days)
        expiry_date = datetime(2024, 4, 8, 16, 0, 0)  # Monday expiry
        position = MockPosition(expiry=expiry_date)
        self.psm.positions['TEST_001'] = position
        
        # Should calculate calendar days, not trading days
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # With 24 calendar days, should not trigger yet
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 0, "24 calendar days should not trigger")
    
    def test_same_day_expiry_zero_dte(self):
        """Test 0 DTE (same day expiry) handling"""
        
        # Create position expiring today
        expiry_date = self.algo.Time.replace(hour=16, minute=0, second=0)  # 4PM today
        position = MockPosition(expiry=expiry_date)
        self.psm.positions['TEST_001'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # Should trigger absolute exit at 0 DTE
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 1, "0 DTE should trigger absolute exit")
    
    def test_negative_dte_expired_options(self):
        """Test handling of expired options (negative DTE)"""
        
        # Create position that expired yesterday
        expiry_date = self.algo.Time - timedelta(days=1)
        position = MockPosition(expiry=expiry_date)
        self.psm.positions['TEST_001'] = position
        
        actions = self.lt112_manager.analyze_lt112_positions([position])
        
        # Should trigger exit for expired positions
        defensive_actions = [a for a in actions if 'TradingConstants.DEFENSIVE_EXIT_DTE DTE' in a.get('reason', '')]
        self.assertEqual(len(defensive_actions), 1, "Expired options should trigger exit")

class Test21DTEMethodologyCompliance(unittest.TestCase):
    """Test compliance with Tom King's documented methodology"""
    
    def setUp(self):
        self.algo = MockAlgorithm()
        self.correlation_manager = CorrelationManager(self.algo)
    
    def test_no_profit_conditions_in_defensive_logic(self):
        """CRITICAL: Verify no profit conditions exist in TradingConstants.DEFENSIVE_EXIT_DTE DTE logic"""
        
        # Test various profit scenarios - none should affect TradingConstants.DEFENSIVE_EXIT_DTE DTE decision
        profit_scenarios = [
            -50000,  # Massive loss
            -5000,   # Significant loss
            -500,    # Small loss
            0,       # Break even
            500,     # Small profit
            5000,    # Good profit
            50000    # Massive profit
        ]
        
        for profit in profit_scenarios:
            with self.subTest(profit=profit):
                position_info = {
                    'symbol': 'SPY',
                    'dte': 21,
                    'pnl': profit,
                    'strategy': 'LT112'
                }
                
                # Clear log messages
                self.algo.log_messages.clear()
                
                should_defend = self.correlation_manager.ShouldDefend(position_info)
                
                # CRITICAL: Must always return True regardless of profit
                self.assertTrue(should_defend, 
                               f"Must exit at TradingConstants.DEFENSIVE_EXIT_DTE DTE regardless of P&L (tested: ${profit})")
    
    def test_tom_king_rule_documentation_strings(self):
        """Verify Tom King rule strings match documentation"""
        
        psm = MockPositionStateManager()
        lt112_manager = FixedLT112Management(self.algo, psm)
        
        # Create position at TradingConstants.DEFENSIVE_EXIT_DTE DTE
        expiry_date = self.algo.Time + timedelta(days=21)
        position = MockPosition(expiry=expiry_date)
        psm.positions['TEST_001'] = position
        
        actions = lt112_manager.analyze_lt112_positions([position])
        
        # Verify action contains proper Tom King rule reference
        self.assertEqual(len(actions), 1)
        action = actions[0]
        
        self.assertIn('tom_king_rule', action)
        self.assertIn('ABSOLUTE', action['tom_king_rule'])
        self.assertIn('gamma risk', action['tom_king_rule'])
        self.assertIn('TradingConstants.DEFENSIVE_EXIT_DTE DTE', action['tom_king_rule'])

class Test21DTESystemIntegration(unittest.TestCase):
    """Test TradingConstants.DEFENSIVE_EXIT_DTE DTE integration across system components"""
    
    def setUp(self):
        self.algo = MockAlgorithm()
    
    def test_no_legacy_defensive_manager_references(self):
        """Verify removed DefensiveManager is not referenced anywhere"""
        
        # This test ensures the removed DefensiveManager class with
        # incorrect conditional logic is not imported or referenced
        
        try:
            from risk.defensive_manager import DefensiveManager
            self.fail("DefensiveManager should not exist - it was removed for methodology violations")
        except ImportError:
            # Expected - file was properly removed
            pass
        except Exception as e:
            # Log and handle unexpected exception
            print(f'Unexpected exception: {e}')
            raise
        # This should fail since we removed the file
    
    def test_consistent_21_dte_across_components(self):
        """Verify TradingConstants.DEFENSIVE_EXIT_DTE DTE threshold is consistent across all components"""
        
        from config.constants import TradingConstants
        
        # All these should use the same TradingConstants.DEFENSIVE_EXIT_DTE DTE value
        expected_dte = 21
        
        # Check TradingConstants
        self.assertEqual(TradingConstants.DEFENSIVE_EXIT_DTE, expected_dte)
        
        # Check exit rules
        exit_rules = TomKingExitRules(self.algo)
        self.assertEqual(exit_rules.dte_rules['LT112'], expected_dte)
        self.assertEqual(exit_rules.dte_rules['Strangle'], expected_dte)
        self.assertEqual(exit_rules.dte_rules['Futures_Strangle'], expected_dte)

def run_21_dte_critical_tests():
    """Run all TradingConstants.DEFENSIVE_EXIT_DTE DTE critical fix tests"""
    
    test_classes = [
        Test21DTEAbsoluteExitRule,
        Test21DTEEdgeCases,
        Test21DTEMethodologyCompliance,
        Test21DTESystemIntegration
    ]
    
    suite = unittest.TestSuite()
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

if __name__ == '__main__':
    print("=" * 80)
    print("CRITICAL TradingConstants.DEFENSIVE_EXIT_DTE DTE FIX UNIT TESTS")
    print("Testing absolute exit rule implementation")
    print("=" * 80)
    print()
    print("BACKGROUND:")
    print("- Original Issue: LT112 component manager added 25% profit conditions to TradingConstants.DEFENSIVE_EXIT_DTE DTE rule")
    print("- Tom King Rule: 'Exit all positions at TradingConstants.DEFENSIVE_EXIT_DTE DTE to avoid gamma risk' - NO CONDITIONS")
    print("- Fixed Components: lt112_component_manager.py, correlation_manager.py") 
    print("- Removed: defensive_manager.py (unused legacy with incorrect logic)")
    print()
    print("=" * 80)
    
    success = run_21_dte_critical_tests()
    
    if success:
        print("\n" + "=" * 80)
        print("SUCCESS: ALL TradingConstants.DEFENSIVE_EXIT_DTE DTE CRITICAL TESTS PASSED")
        print("=" * 80)
        print("\nValidated Functionality:")
        print("  * Absolute exit at TradingConstants.DEFENSIVE_EXIT_DTE DTE regardless of P&L")
        print("  * No profit conditions in defensive logic")
        print("  * Edge case handling (fractional DTE, weekends, 0 DTE)")
        print("  * Tom King methodology compliance")
        print("  * System integration consistency")
        print("  * Removed legacy code verification")
        print("\nCRITICAL FIX VALIDATED - PRODUCTION READY")
        print("=" * 80)
    else:
        print("\n" + "=" * 80)
        print("FAILURE: CRITICAL TradingConstants.DEFENSIVE_EXIT_DTE DTE TESTS FAILED")
        print("DO NOT DEPLOY - FIX ISSUES FIRST")
        print("=" * 80)
        exit(1)