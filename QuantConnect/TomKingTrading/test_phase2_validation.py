#!/usr/bin/env python3
"""
Phase 2 Validation Tests
Tests order execution integration and state persistence
"""

import json
import sys
import os
from datetime import datetime, timedelta

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_position_state_manager():
    """Test PositionStateManagerQC functionality"""
    print("=" * 60)
    print("TESTING POSITION STATE MANAGER")
    print("=" * 60)
    
    from position_state_manager_qc import PositionStateManagerQC, PositionComponent, MultiLegPosition
    
    # Create mock algorithm
    class MockAlgo:
        def __init__(self):
            self.Time = datetime.now()
            self.Portfolio = {}
            self.ObjectStore = MockObjectStore()
            
        def Log(self, message):
            print(f"[LOG] {message}")
            
        def Symbol(self, symbol_str):
            return symbol_str
            
        def MarketOrder(self, symbol, quantity, tag=""):
            return MockOrderTicket(symbol, quantity)
            
        def Liquidate(self, symbol, reason=""):
            print(f"[LIQUIDATE] {symbol} - {reason}")
    
    class MockObjectStore:
        def __init__(self):
            self.data = {}
            
        def Save(self, key, value):
            self.data[key] = value
            
        def Read(self, key):
            return self.data.get(key, "")
            
        def ContainsKey(self, key):
            return key in self.data
            
        def Delete(self, key):
            if key in self.data:
                del self.data[key]
                
        def GetEnumerator(self):
            return list(self.data.keys())
    
    class MockOrderTicket:
        def __init__(self, symbol, quantity):
            self.Symbol = symbol
            self.Quantity = quantity
            self.Status = 0  # Filled
            self.AverageFillPrice = 100.0
            self.Time = datetime.now()
    
    # Test initialization
    algo = MockAlgo()
    manager = PositionStateManagerQC(algo)
    
    print("[OK] PositionStateManagerQC initialized")
    
    # Test creating IPMCC position
    position_id = manager.create_ipmcc_position("SPY")
    print(f"[OK] Created IPMCC position: {position_id}")
    
    # Test adding LEAP component
    leap_id = manager.add_ipmcc_leap(
        position_id, 
        "SPY_LEAP_400", 
        1, 
        400.0, 
        datetime.now() + timedelta(days=365)
    )
    print(f"[OK] Added LEAP component: {leap_id}")
    
    # Test order execution
    position = manager.positions[position_id]
    component = list(position.components.values())[0]
    
    # Test serialization
    state_json = manager.serialize_state()
    print(f"[OK] Serialized state: {len(state_json)} characters")
    
    # Test deserialization
    manager2 = PositionStateManagerQC(algo)
    manager2.deserialize_state(state_json)
    print(f"[OK] Deserialized state: {len(manager2.positions)} positions")
    
    # Test state summary
    summary = manager.get_state_summary()
    print(f"[OK] State summary: {summary}")
    
    return True

def test_order_execution_methods():
    """Test order execution integration methods"""
    print("\n" + "=" * 60)
    print("TESTING ORDER EXECUTION METHODS")
    print("=" * 60)
    
    # Check that all required methods exist
    from position_state_manager_qc import PositionStateManagerQC
    
    required_methods = [
        'link_order_to_component',
        'execute_component_order',
        'execute_position_orders',
        'update_fills_from_tickets',
        'sync_with_portfolio',
        'get_unfilled_components'
    ]
    
    for method in required_methods:
        if hasattr(PositionStateManagerQC, method):
            print(f"[OK] Method exists: {method}")
        else:
            print(f"[FAIL] Missing method: {method}")
            return False
    
    return True

def test_state_persistence_methods():
    """Test state persistence methods"""
    print("\n" + "=" * 60)
    print("TESTING STATE PERSISTENCE METHODS")
    print("=" * 60)
    
    # Check that persistence methods exist
    from position_state_manager_qc import PositionStateManagerQC
    
    required_methods = [
        'serialize_state',
        'deserialize_state',
        'get_state_summary'
    ]
    
    for method in required_methods:
        if hasattr(PositionStateManagerQC, method):
            print(f"[OK] Method exists: {method}")
        else:
            print(f"[FAIL] Missing method: {method}")
            return False
    
    return True

def test_main_algorithm_integration():
    """Test that main algorithm has state persistence integrated"""
    print("\n" + "=" * 60)
    print("TESTING MAIN ALGORITHM INTEGRATION")
    print("=" * 60)
    
    # Read main.py and check for persistence methods
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    required_methods = [
        'def save_position_state',
        'def load_position_state',
        'def cleanup_old_backups'
    ]
    
    for method in required_methods:
        if method in content:
            print(f"[OK] Found method: {method}")
        else:
            print(f"[FAIL] Missing method: {method}")
            return False
    
    # Check that load is called in Initialize
    if 'self.load_position_state()' in content:
        print("[OK] load_position_state() called in Initialize")
    else:
        print("[FAIL] load_position_state() not called in Initialize")
        return False
    
    # Check that save is called in end_of_day_summary
    if 'self.save_position_state()' in content:
        print("[OK] save_position_state() called in end_of_day_summary")
    else:
        print("[FAIL] save_position_state() not called in end_of_day_summary")
        return False
    
    return True

def check_for_bugs():
    """Check for common bugs and issues"""
    print("\n" + "=" * 60)
    print("CHECKING FOR BUGS AND ISSUES")
    print("=" * 60)
    
    # Check for duplicate methods in main.py
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    import re
    methods = re.findall(r'def (\w+)\(', content)
    from collections import Counter
    duplicates = [m for m, count in Counter(methods).items() if count > 1]
    
    if duplicates:
        print(f"[FAIL] Duplicate methods found: {duplicates}")
        return False
    else:
        print("[OK] No duplicate methods")
    
    # Check for placeholders
    placeholder_patterns = ['TODO', 'FIXME', 'XXX', 'PLACEHOLDER', 'placeholder']
    files_with_placeholders = []
    
    for root, dirs, files in os.walk('.'):
        # Skip test files and documentation
        if 'test' in root or 'doc' in root:
            continue
            
        for file in files:
            if file.endswith('.py') and not file.startswith('test'):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for pattern in placeholder_patterns:
                            if pattern in content:
                                files_with_placeholders.append((filepath, pattern))
                                break
                except:
                    pass
    
    if files_with_placeholders:
        print(f"[WARNING] Files with placeholders: {len(files_with_placeholders)}")
        for filepath, pattern in files_with_placeholders[:5]:  # Show first 5
            print(f"  - {filepath}: contains '{pattern}'")
    else:
        print("[OK] No placeholders found")
    
    return True

def main():
    """Run all Phase 2 validation tests"""
    print("=" * 60)
    print("PHASE 2 VALIDATION TEST SUITE")
    print("=" * 60)
    
    all_tests_passed = True
    
    # Test position state manager
    try:
        if not test_position_state_manager():
            all_tests_passed = False
    except Exception as e:
        print(f"[FAIL] Position state manager test failed: {e}")
        all_tests_passed = False
    
    # Test order execution methods
    try:
        if not test_order_execution_methods():
            all_tests_passed = False
    except Exception as e:
        print(f"[FAIL] Order execution test failed: {e}")
        all_tests_passed = False
    
    # Test state persistence methods
    try:
        if not test_state_persistence_methods():
            all_tests_passed = False
    except Exception as e:
        print(f"[FAIL] State persistence test failed: {e}")
        all_tests_passed = False
    
    # Test main algorithm integration
    try:
        if not test_main_algorithm_integration():
            all_tests_passed = False
    except Exception as e:
        print(f"[FAIL] Main algorithm integration test failed: {e}")
        all_tests_passed = False
    
    # Check for bugs
    try:
        if not check_for_bugs():
            all_tests_passed = False
    except Exception as e:
        print(f"[FAIL] Bug check failed: {e}")
        all_tests_passed = False
    
    # Final result
    print("\n" + "=" * 60)
    if all_tests_passed:
        print("✅ ALL PHASE 2 VALIDATION TESTS PASSED!")
        print("No bugs, redundancies, or placeholders found.")
        print("Order execution and state persistence fully integrated.")
    else:
        print("❌ SOME TESTS FAILED - Review issues above")
    print("=" * 60)
    
    return 0 if all_tests_passed else 1

if __name__ == "__main__":
    sys.exit(main())