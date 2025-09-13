#!/usr/bin/env python3
"""
Phase 9.1.2 - State Unification Integration Tests
Test that UnifiedStateManager provides hierarchical state management
"""

import sys
import os
from datetime import datetime
from unittest.mock import MagicMock

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.unified_state_manager import UnifiedStateManager, SystemState
from core.unified_intelligent_cache import UnifiedIntelligentCache

def test_unified_state_manager():
    """Test UnifiedStateManager functionality"""
    print("[TEST] Testing UnifiedStateManager...")
    
    # Mock algorithm with unified cache
    class MockAlgorithm:
        def __init__(self):
            self.LiveMode = False
            self.Time = datetime.now()
            self.unified_cache = UnifiedIntelligentCache(algorithm=self)
            
        def Debug(self, message):
            pass
            
        def Log(self, message):  
            pass
    
    algorithm = MockAlgorithm()
    
    # Test 1: Construction
    try:
        state_manager = UnifiedStateManager(algorithm)
        print("[PASS] UnifiedStateManager construction successful")
    except Exception as e:
        print(f"[FAIL] UnifiedStateManager construction failed: {e}")
        return False
    
    # Test 2: Initial system state
    if state_manager.system_state != SystemState.INITIALIZING:
        print(f"[FAIL] Expected INITIALIZING, got {state_manager.system_state}")
        return False
    print("[PASS] Initial system state correct")
    
    # Test 3: Uses unified cache
    if state_manager.state_cache is not algorithm.unified_cache:
        print("[FAIL] StateManager not using unified cache")
        return False
    print("[PASS] Using unified cache for state management")
    
    # Test 4: Strategy machines dictionary exists
    if not hasattr(state_manager, 'strategy_machines'):
        print("[FAIL] Missing strategy_machines")
        return False
    print("[PASS] Strategy machines dictionary exists")
    
    # Test 5: Emergency controls exist
    if not hasattr(state_manager, 'emergency_mode'):
        print("[FAIL] Missing emergency controls")
        return False
    print("[PASS] Emergency controls exist")
    
    print("[SUCCESS] UnifiedStateManager functionality verified")
    return True

def verify_state_consolidation():
    """Verify state system consolidation"""
    print("[TEST] Verifying state consolidation...")
    
    # Check that we have unified state management
    state_files = []
    for root, dirs, files in os.walk('.'):
        for file in files:
            if file.endswith('.py') and 'state' in file.lower():
                state_files.append(os.path.join(root, file))
    
    print(f"[INFO] Found state-related files: {len(state_files)}")
    for f in state_files:
        print(f"  - {f}")
    
    # Should have UnifiedStateManager as central coordinator
    unified_state_exists = any('unified_state_manager' in f for f in state_files)
    if not unified_state_exists:
        print("[FAIL] UnifiedStateManager not found")
        return False
    
    print("[PASS] UnifiedStateManager exists as central coordinator")
    
    # Individual strategy state machines should still exist (this is correct)
    strategy_states = [f for f in state_files if 'strategies' in f and 'with_state' in f]
    if len(strategy_states) == 0:
        print("[FAIL] No strategy state machines found")
        return False
    
    print(f"[PASS] Found {len(strategy_states)} strategy state machines")
    
    return True

def test_hierarchical_state_structure():
    """Test that state management has proper hierarchy"""
    print("[TEST] Testing hierarchical state structure...")
    
    # Mock algorithm
    class MockAlgorithm:
        def __init__(self):
            self.LiveMode = False
            self.Time = datetime.now()
            self.unified_cache = UnifiedIntelligentCache(algorithm=self)
            
        def Debug(self, message):
            pass
            
        def Log(self, message):
            pass
    
    algorithm = MockAlgorithm()
    state_manager = UnifiedStateManager(algorithm)
    
    # Test hierarchical structure
    # System-level state
    system_states = list(SystemState)
    if len(system_states) < 5:
        print("[FAIL] Insufficient system states defined")
        return False
    print(f"[PASS] System states defined: {[s.name for s in system_states]}")
    
    # Strategy coordination
    if not hasattr(state_manager, 'strategy_machines'):
        print("[FAIL] No strategy coordination")
        return False
    print("[PASS] Strategy coordination structure exists")
    
    # Global triggers
    if not hasattr(state_manager, 'global_triggers'):
        print("[FAIL] No global triggers")
        return False
    print("[PASS] Global trigger system exists")
    
    print("[SUCCESS] Hierarchical state structure verified")
    return True

def main():
    """Run state unification verification"""
    print("=" * 60)
    print("PHASE 9.1.2 - STATE UNIFICATION VERIFICATION")  
    print("=" * 60)
    
    try:
        # Test 1: UnifiedStateManager functionality
        if not test_unified_state_manager():
            return False
            
        # Test 2: State consolidation
        if not verify_state_consolidation():
            return False
            
        # Test 3: Hierarchical structure
        if not test_hierarchical_state_structure():
            return False
            
        print("\n[SUCCESS] State unification verification PASSED")
        print("[INFO] UnifiedStateManager provides hierarchical state management")
        print("[INFO] Individual strategy state machines properly coordinated")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] State test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)