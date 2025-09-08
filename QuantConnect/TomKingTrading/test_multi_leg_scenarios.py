#!/usr/bin/env python3
"""
Comprehensive Test Scenarios for Multi-Legged Strategy Fixes
Tests all the critical scenarios that were broken in the original system
"""

import sys
import os
from datetime import datetime, timedelta
from typing import Dict, List
import unittest

# Add project path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

class TestMultiLegStrategies(unittest.TestCase):
    """Test cases for multi-legged strategy management"""
    
    def setUp(self):
        """Set up test environment"""
        # Create mock algorithm
        self.mock_algo = MockAlgorithm()
        
        # Import the fixed classes
        from position_state_manager import PositionStateManager
        from strategies.fixed_ipmcc_execution import FixedIPMCCExecution
        from strategies.fixed_lt112_management import FixedLT112Management
        
        # Initialize systems
        self.psm = PositionStateManager(self.mock_algo)
        self.fixed_ipmcc = FixedIPMCCExecution(self.mock_algo, self.psm)
        self.fixed_lt112 = FixedLT112Management(self.mock_algo, self.psm)
        
    def test_ipmcc_existing_leap_detection(self):
        """
        CRITICAL TEST: IPMCC should detect existing LEAPs and NOT create new ones
        """
        print("\n[TEST] Testing IPMCC Existing LEAP Detection...")
        
        # Scenario 1: No existing LEAP - should create new position
        has_leap = self.psm.has_active_leap('SPY')
        self.assertIsNone(has_leap, "Should not find existing LEAP initially")
        
        # Create a LEAP position manually (simulating previous month's creation)
        position_id = self.psm.create_ipmcc_position('SPY')
        leap_expiry = datetime.now() + timedelta(days=365)
        
        leap_component_id = self.psm.add_ipmcc_leap(
            position_id=position_id,
            leap_contract="SPY_CALL_450_20251205",
            quantity=2,
            strike=450.0,
            expiry=leap_expiry
        )
        
        # Scenario 2: Existing LEAP found - should NOT create new LEAP
        has_leap = self.psm.has_active_leap('SPY')
        self.assertIsNotNone(has_leap, "Should find existing LEAP")
        self.assertEqual(has_leap.leg_type, "LEAP_CALL", "Should be LEAP call type")
        self.assertEqual(has_leap.strike, 450.0, "Should match LEAP strike")
        
        print("  [PASS] IPMCC correctly detects existing LEAPs")
        
    def test_ipmcc_monthly_execution_logic(self):
        """
        CRITICAL TEST: Monthly IPMCC execution should add weekly calls to existing LEAPs
        """
        print("\n[TEST] Testing IPMCC Monthly Execution Logic...")
        
        # Month 1: Create initial IPMCC (LEAP + weekly)
        success1, result1 = self.fixed_ipmcc.execute_ipmcc_strategy('SPY', 50000, 18.0)
        self.assertTrue(success1, f"Month 1 execution should succeed: {result1}")
        
        # Verify LEAP was created
        leap = self.psm.has_active_leap('SPY')
        self.assertIsNotNone(leap, "LEAP should exist after Month 1")
        
        # Count initial positions
        spy_positions = self.psm.get_positions_for_symbol('SPY', 'IPMCC')
        initial_position_count = len(spy_positions)
        initial_leap_count = sum(len(p.get_components_by_type("LEAP_CALL")) for p in spy_positions)
        
        print(f"  Month 1: {initial_position_count} positions, {initial_leap_count} LEAPs")
        
        # Month 2: Should add weekly call to existing LEAP, NOT create new LEAP
        success2, result2 = self.fixed_ipmcc.execute_ipmcc_strategy('SPY', 50000, 18.0)
        self.assertTrue(success2, f"Month 2 execution should succeed: {result2}")
        
        # Verify no new LEAPs were created
        spy_positions_after = self.psm.get_positions_for_symbol('SPY', 'IPMCC')
        final_leap_count = sum(len(p.get_components_by_type("LEAP_CALL")) for p in spy_positions_after)
        
        self.assertEqual(final_leap_count, initial_leap_count, 
                        f"LEAP count should remain {initial_leap_count}, got {final_leap_count}")
        
        # Verify weekly call was added
        total_weekly_calls = sum(len([c for c in p.components.values() 
                                    if c.leg_type.startswith("WEEKLY_CALL")]) 
                               for p in spy_positions_after)
        self.assertGreater(total_weekly_calls, 0, "Should have weekly calls")
        
        print(f"  Month 2: Still {final_leap_count} LEAPs (correct!), {total_weekly_calls} weekly calls")
        print("  [PASS] IPMCC correctly reuses existing LEAPs")
        
    def test_lt112_individual_leg_management(self):
        """
        CRITICAL TEST: LT112 should allow closing individual legs
        """
        print("\n[TEST] Testing LT112 Individual Leg Management...")
        
        # Create LT112 position
        strikes = {
            'debit_spread_long': 4400,
            'debit_spread_short': 4300,
            'naked_puts': 4200,
            'expiry_date': datetime.now() + timedelta(days=120)
        }
        
        position_id = self.psm.create_lt112_position('SPY', strikes, 1)
        position = self.psm.positions[position_id]
        
        # Verify all components were created
        naked_puts = position.get_components_by_type("NAKED_PUT")
        debit_long = position.get_components_by_type("DEBIT_LONG") 
        debit_short = position.get_components_by_type("DEBIT_SHORT")
        
        self.assertEqual(len(naked_puts), 1, "Should have naked put component")
        self.assertEqual(len(debit_long), 1, "Should have debit long component")
        self.assertEqual(len(debit_short), 1, "Should have debit short component")
        
        initial_component_count = len(position.components)
        print(f"  Created LT112 with {initial_component_count} components")
        
        # Test closing naked puts only
        success = self.psm.close_lt112_naked_puts_only(position_id)
        self.assertTrue(success, "Should successfully close naked puts only")
        
        # Verify naked puts are closed but debit spread remains
        remaining_components = [c for c in position.components.values() if c.status == "OPEN"]
        naked_puts_remaining = [c for c in remaining_components if c.leg_type == "NAKED_PUT"]
        debit_remaining = [c for c in remaining_components if c.leg_type in ["DEBIT_LONG", "DEBIT_SHORT"]]
        
        self.assertEqual(len(naked_puts_remaining), 0, "Naked puts should be closed")
        self.assertEqual(len(debit_remaining), 2, "Debit spread should remain open")
        
        print("  [PASS] Successfully closed naked puts while keeping debit spread")
        
        # Test closing debit spread only (reset position first)
        position_id2 = self.psm.create_lt112_position('QQQ', strikes, 1)
        success2 = self.psm.close_lt112_debit_spread_only(position_id2)
        self.assertTrue(success2, "Should successfully close debit spread only")
        
        position2 = self.psm.positions[position_id2]
        remaining2 = [c for c in position2.components.values() if c.status == "OPEN"]
        naked_remaining2 = [c for c in remaining2 if c.leg_type == "NAKED_PUT"]
        debit_remaining2 = [c for c in remaining2 if c.leg_type in ["DEBIT_LONG", "DEBIT_SHORT"]]
        
        self.assertEqual(len(naked_remaining2), 1, "Naked puts should remain open")
        self.assertEqual(len(debit_remaining2), 0, "Debit spread should be closed")
        
        print("  [PASS] Successfully closed debit spread while keeping naked puts")
        
    def test_lt112_profit_target_scenarios(self):
        """
        TEST: LT112 should handle different profit target scenarios correctly
        """
        print("\n[TEST] Testing LT112 Profit Target Scenarios...")
        
        # Create LT112 position with simulated P&L
        strikes = {
            'debit_spread_long': 4400,
            'debit_spread_short': 4300, 
            'naked_puts': 4200,
            'expiry_date': datetime.now() + timedelta(days=45)
        }
        
        position_id = self.psm.create_lt112_position('SPY', strikes, 1)
        position = self.psm.positions[position_id]
        
        # Simulate profitable naked puts (90% profit)
        naked_put = position.get_components_by_type("NAKED_PUT")[0]
        naked_put.entry_price = 5.00
        naked_put.current_price = 0.50  # 90% profit (from $5 to $0.50)
        naked_put.pnl = 450  # $4.50 profit per contract
        
        # Analyze position
        actions = self.fixed_lt112.analyze_lt112_positions([])
        
        # Should recommend closing naked puts only
        naked_put_actions = [a for a in actions if a.get('action') == 'CLOSE_NAKED_PUTS_ONLY']
        self.assertGreater(len(naked_put_actions), 0, "Should recommend closing profitable naked puts")
        
        profit_action = naked_put_actions[0]
        self.assertIn('90%', profit_action['reason'], "Should mention 90% profit target")
        
        print("  [PASS] Correctly identifies 90% profit on naked puts")
        
    def test_position_state_persistence(self):
        """
        TEST: Position state should persist across algorithm restarts
        """
        print("\n[TEST] Testing Position State Persistence...")
        
        # Create positions
        position_id1 = self.psm.create_ipmcc_position('SPY')
        position_id2 = self.psm.create_lt112_position('QQQ', {
            'debit_spread_long': 380,
            'debit_spread_short': 370,
            'naked_puts': 360,
            'expiry_date': datetime.now() + timedelta(days=120)
        }, 1)
        
        # Serialize state
        state_dict = {pid: pos.to_dict() for pid, pos in self.psm.positions.items()}
        
        self.assertEqual(len(state_dict), 2, "Should have 2 positions in state")
        self.assertIn('IPMCC', state_dict[position_id1]['strategy'], "Should preserve IPMCC strategy")
        self.assertIn('LT112', state_dict[position_id2]['strategy'], "Should preserve LT112 strategy")
        
        print("  [PASS] Position state can be serialized for persistence")
        
    def test_edge_cases(self):
        """
        TEST: Handle edge cases gracefully
        """
        print("\n[TEST] Testing Edge Cases...")
        
        # Test 1: IPMCC with no suitable LEAP contracts
        success, result = self.fixed_ipmcc.execute_ipmcc_strategy('INVALID_SYMBOL', 50000, 18.0)
        self.assertFalse(success, "Should fail gracefully for invalid symbol")
        self.assertIn('error', result.lower(), "Should provide error message")
        
        # Test 2: LT112 management with missing position
        actions = self.fixed_lt112.analyze_lt112_positions([])  # Empty positions
        self.assertIsInstance(actions, list, "Should return empty list for no positions")
        
        # Test 3: Closing non-existent components
        success = self.psm.close_lt112_naked_puts_only('NON_EXISTENT_ID')
        self.assertFalse(success, "Should return False for non-existent position")
        
        print("  [PASS] Edge cases handled gracefully")

class MockAlgorithm:
    """Mock algorithm for testing"""
    
    def __init__(self):
        self.Time = datetime.now()
        self.Securities = MockSecurities()
        self.OptionChainProvider = MockOptionChainProvider()
        
    def Log(self, message):
        print(f"  [LOG] {message}")
        
    def Error(self, message):
        print(f"  [ERROR] {message}")
        
    def AddOptionContract(self, contract):
        return MockContract(contract)
        
    def MarketOrder(self, symbol, quantity):
        return MockOrder(symbol, quantity)

class MockSecurities:
    """Mock securities collection"""
    
    def __contains__(self, symbol):
        return True
        
    def __getitem__(self, symbol):
        return MockSecurity(symbol)

class MockSecurity:
    """Mock security with price"""
    
    def __init__(self, symbol):
        self.symbol = symbol
        
    @property 
    def Price(self):
        # Return mock prices for different symbols
        prices = {
            'SPY': 450.0,
            'QQQ': 380.0,
            'IWM': 200.0
        }
        return prices.get(str(self.symbol), 100.0)

class MockOptionChainProvider:
    """Mock option chain provider"""
    
    def GetOptionContractList(self, symbol, time):
        # Return mock option contracts
        contracts = []
        current_price = 450.0 if 'SPY' in str(symbol) else 100.0
        
        # Create LEAP contracts (365 DTE)
        leap_expiry = time + timedelta(days=365)
        for strike in [current_price * 0.8, current_price * 0.85, current_price * 0.9]:
            contracts.append(MockOptionContract('CALL', strike, leap_expiry))
            
        # Create weekly contracts (7 DTE)  
        weekly_expiry = time + timedelta(days=7)
        for strike in [current_price * 1.02, current_price * 1.05, current_price * 1.08]:
            contracts.append(MockOptionContract('CALL', strike, weekly_expiry))
            
        return contracts

class MockOptionContract:
    """Mock option contract"""
    
    def __init__(self, right, strike, expiry):
        self.ID = MockContractID(right, strike, expiry)
        
class MockContractID:
    """Mock contract ID"""
    
    def __init__(self, right, strike, expiry):
        self.OptionRight = OptionRight.Call if right == 'CALL' else OptionRight.Put
        self.StrikePrice = strike
        self.Date = expiry

class MockContract:
    """Mock contract for orders"""
    
    def __init__(self, symbol):
        self.symbol = symbol

class MockOrder:
    """Mock order"""
    
    def __init__(self, symbol, quantity):
        self.symbol = symbol
        self.quantity = quantity
        self.OrderId = f"ORDER_{symbol}_{quantity}"

# Mock OptionRight enum
class OptionRight:
    Call = "CALL"
    Put = "PUT"

def run_comprehensive_tests():
    """Run all multi-legged strategy tests"""
    print("=" * 80)
    print("COMPREHENSIVE MULTI-LEGGED STRATEGY TESTING")
    print("=" * 80)
    
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add all test methods
    test_methods = [
        'test_ipmcc_existing_leap_detection',
        'test_ipmcc_monthly_execution_logic', 
        'test_lt112_individual_leg_management',
        'test_lt112_profit_target_scenarios',
        'test_position_state_persistence',
        'test_edge_cases'
    ]
    
    for method in test_methods:
        suite.addTest(TestMultiLegStrategies(method))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=0, stream=open(os.devnull, 'w'))
    result = runner.run(suite)
    
    # Print summary
    print(f"\\n{'='*80}")
    if result.wasSuccessful():
        print("[SUCCESS] ALL TESTS PASSED - Multi-legged strategy fixes are working correctly!")
        print(f"[PASS] Ran {result.testsRun} tests successfully")
    else:
        print(f"[FAIL] {len(result.failures)} test(s) failed, {len(result.errors)} error(s)")
        for test, error in result.failures + result.errors:
            print(f"   FAILED: {test}")
            print(f"   {error}")
    
    print("="*80)
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_comprehensive_tests()
    sys.exit(0 if success else 1)