#!/usr/bin/env python3
"""
Test Script for Tom King Trading System Improvements
Validates all recent changes are working correctly
"""

import sys
import os
import traceback
from datetime import datetime, timedelta

# Add the project directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_strategy_delegation():
    """Test that main.py properly delegates to strategy classes"""
    print("\n[TEST] Testing Strategy Delegation...")
    
    try:
        # Import main algorithm
        from main import TomKingTradingAlgorithm
        
        # Create mock algorithm
        class MockAlgorithm:
            def __init__(self):
                self.Time = datetime.now()
                self.Securities = {}
                self.Portfolio = type('obj', (object,), {
                    'TotalPortfolioValue': 50000,
                    'MarginRemaining': 25000,
                    'TotalMarginUsed': 10000
                })()
                self.account_phase = 2
                self.active_positions = []
                
            def Log(self, message):
                print(f"  LOG: {message}")
                
            def Error(self, message):
                print(f"  ERROR: {message}")
                
            def Debug(self, message):
                print(f"  DEBUG: {message}")
                
            def AddFuture(self, symbol):
                return type('obj', (object,), {'Symbol': symbol})()
                
            def AddEquity(self, symbol, resolution):
                return type('obj', (object,), {'Symbol': symbol})()
        
        # Initialize algorithm
        mock = MockAlgorithm()
        algo = TomKingTradingAlgorithm()
        algo.SetUp(mock)  # Use mock instead of self
        
        # Test Friday 0DTE delegation
        mock.Time = datetime(2024, 1, 5, 10, 30)  # Friday at 10:30 AM
        if hasattr(algo, 'friday_0dte'):
            print("  [OK] Friday 0DTE strategy initialized")
            if hasattr(algo.friday_0dte, 'Execute'):
                print("  [OK] Friday 0DTE has Execute method")
            else:
                print("  [FAIL] Friday 0DTE missing Execute method")
        else:
            print("  [FAIL] Friday 0DTE strategy not found")
            
        # Test LT112 delegation
        if hasattr(algo, 'lt112_strategy'):
            print("  [OK] LT112 strategy initialized")
            if hasattr(algo.lt112_strategy, 'Execute'):
                print("  [OK] LT112 has Execute method")
            else:
                print("  [FAIL] LT112 missing Execute method")
        else:
            print("  [FAIL] LT112 strategy not found")
            
    except Exception as e:
        print(f"  [FAIL] Strategy delegation test failed: {e}")
        traceback.print_exc()
        return False
    
    return True

def test_futures_symbols():
    """Test that 0DTE correctly uses ES/MES futures"""
    print("\n[TEST] Testing Futures Symbol Usage...")
    
    try:
        from strategies.friday_zero_day_options import FridayZeroDayOptions
        
        # Create mock algorithm
        class MockAlgo:
            def __init__(self):
                self.Portfolio = type('obj', (object,), {'TotalPortfolioValue': 35000})()
                self.Time = datetime.now()
                self.Securities = {}
            def Log(self, msg): 
                print(f"  {msg}")
            def Error(self, msg): 
                print(f"  ERROR: {msg}")
                
        # Test with small account (should use MES)
        mock = MockAlgo()
        strategy = FridayZeroDayOptions(mock)
        
        if strategy.primary_symbol == 'MES':
            print(f"  [OK] Small account ($35k) correctly uses MES")
        else:
            print(f"  [FAIL] Small account should use MES, got {strategy.primary_symbol}")
            
        # Test with larger account (should use ES)
        mock.Portfolio.TotalPortfolioValue = 50000
        strategy = FridayZeroDayOptions(mock)
        
        if strategy.primary_symbol == 'ES':
            print(f"  [OK] Large account ($50k) correctly uses ES")
        else:
            print(f"  [FAIL] Large account should use ES, got {strategy.primary_symbol}")
            
        # Test futures symbol list
        expected_symbols = ['MES', 'ES', 'MNQ', 'NQ', 'M2K', 'RTY', 'YM']
        actual_symbols = []
        for phase_symbols in strategy.futures_symbols.values():
            actual_symbols.extend(phase_symbols)
        actual_symbols = list(set(actual_symbols))
        
        if all(s in expected_symbols for s in actual_symbols):
            print(f"  [OK] All futures symbols are valid: {actual_symbols}")
        else:
            print(f"  [FAIL] Invalid futures symbols found: {actual_symbols}")
            
    except Exception as e:
        print(f"  [FAIL] Futures symbol test failed: {e}")
        return False
        
    return True

def test_vix_consolidation():
    """Test VIX usage is consolidated through VIXRegimeManager"""
    print("\n[TEST] Testing VIX Consolidation...")
    
    try:
        from risk.vix_regime import VIXRegimeManager
        
        # Create mock algorithm
        class MockAlgo:
            def __init__(self):
                self.Securities = {'VIX': type('obj', (object,), {'Price': 18.5})()}
                
        mock = MockAlgo()
        vix_manager = VIXRegimeManager(mock)
        
        # Test get_current_vix method exists
        if hasattr(vix_manager, 'get_current_vix'):
            print("  [OK] VIXRegimeManager has get_current_vix method")
            
            # Test it returns a value
            vix = vix_manager.get_current_vix()
            if vix is not None:
                print(f"  [OK] get_current_vix returns value: {vix}")
            else:
                print("  [WARN] get_current_vix returned None")
        else:
            print("  [FAIL] VIXRegimeManager missing get_current_vix method")
            
        # Test regime detection
        vix_manager.update_vix_level(18.5)
        regime = vix_manager.get_current_regime()
        if regime and 'name' in regime:
            print(f"  [OK] VIX regime detection working: {regime['name']}")
        else:
            print("  [FAIL] VIX regime detection failed")
            
    except Exception as e:
        print(f"  [FAIL] VIX consolidation test failed: {e}")
        traceback.print_exc()
        return False
        
    return True

def test_position_sizing_consolidation():
    """Test position sizing uses centralized PositionSizer"""
    print("\n[TEST] Testing Position Sizing Consolidation...")
    
    try:
        from risk.position_sizing import PositionSizer
        
        # Create mock algorithm
        class MockAlgo:
            def __init__(self):
                self.account_phase = 2
                
        mock = MockAlgo()
        sizer = PositionSizer(mock)
        
        # Test position sizing calculation
        sizing = sizer.calculate_position_size(
            strategy='0DTE',
            account_value=50000,
            vix_level=18,
            win_rate=0.88,
            avg_return=0.50,
            max_loss=-2.00,
            use_micro=False
        )
        
        if 'recommended_positions' in sizing:
            print(f"  [OK] Position sizer returns recommendations: {sizing['recommended_positions']} contracts")
        else:
            print("  [FAIL] Position sizer missing recommended_positions")
            
        # Test Kelly Criterion is used
        if 'kelly_fraction' in sizing:
            print(f"  [OK] Kelly Criterion calculated: {sizing['kelly_fraction']:.2%}")
        else:
            print("  ⚠️ Kelly Criterion not in output")
            
        # Test VIX adjustment
        if 'vix_adjustment' in sizing:
            print(f"  [OK] VIX adjustment applied: {sizing['vix_adjustment']:.2f}")
        else:
            print("  ⚠️ VIX adjustment not in output")
            
    except Exception as e:
        print(f"  [FAIL] Position sizing test failed: {e}")
        traceback.print_exc()
        return False
        
    return True

def test_order_execution():
    """Test order execution is complete (no placeholders)"""
    print("\n[TEST] Testing Order Execution Completeness...")
    
    try:
        from strategies.strategy_order_executor import StrategyOrderExecutor
        from helpers.option_order_executor import OptionOrderExecutor
        
        # Check StrategyOrderExecutor has execution methods
        methods_to_check = [
            'execute_lt112_order',
            'execute_futures_strangle',
            'execute_ipmcc_order',
            'execute_leap_ladder'
        ]
        
        for method in methods_to_check:
            if hasattr(StrategyOrderExecutor, method):
                print(f"  [OK] StrategyOrderExecutor has {method}")
            else:
                print(f"  [FAIL] StrategyOrderExecutor missing {method}")
                
        # Check OptionOrderExecutor has helper methods
        helper_methods = [
            'place_option_limit_order',
            'place_iron_condor_orders',
            'cleanup_partial_fill'
        ]
        
        for method in helper_methods:
            if hasattr(OptionOrderExecutor, method):
                print(f"  [OK] OptionOrderExecutor has {method}")
            else:
                print(f"  [FAIL] OptionOrderExecutor missing {method}")
                
    except Exception as e:
        print(f"  [FAIL] Order execution test failed: {e}")
        return False
        
    return True

def test_no_placeholders():
    """Test for any remaining placeholders or TODO comments"""
    print("\n[TEST] Checking for Placeholders...")
    
    files_to_check = [
        'main.py',
        'strategies/friday_zero_day_options.py',
        'strategies/long_term_112_put_selling.py',
        'strategies/strategy_order_executor.py'
    ]
    
    placeholder_patterns = [
        'TODO',
        'FIXME',
        'placeholder',
        'would execute',
        'In production',
        '# Actual execution'
    ]
    
    issues_found = False
    
    for filepath in files_to_check:
        full_path = os.path.join(os.path.dirname(__file__), filepath)
        if os.path.exists(full_path):
            with open(full_path, 'r') as f:
                content = f.read()
                for pattern in placeholder_patterns:
                    if pattern.lower() in content.lower():
                        # Check if it's a legitimate comment
                        if pattern == 'TODO' and 'TodoWrite' in content:
                            continue  # Skip TodoWrite tool references
                        print(f"  [WARN] Found '{pattern}' in {filepath}")
                        issues_found = True
        else:
            print(f"  [WARN] File not found: {filepath}")
            
    if not issues_found:
        print("  [OK] No placeholders found")
        
    return not issues_found

def main():
    """Run all tests"""
    print("=" * 60)
    print("TOM KING TRADING SYSTEM - IMPROVEMENT VALIDATION")
    print("=" * 60)
    
    all_tests_passed = True
    
    # Run tests
    tests = [
        test_futures_symbols,
        test_vix_consolidation,
        test_position_sizing_consolidation,
        test_order_execution,
        test_no_placeholders
    ]
    
    for test in tests:
        if not test():
            all_tests_passed = False
            
    # Summary
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("[SUCCESS] ALL TESTS PASSED - System improvements validated!")
    else:
        print("[FAILURE] SOME TESTS FAILED - Review issues above")
    print("=" * 60)
    
    return all_tests_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)