#!/usr/bin/env python3
"""
MINIMAL TEST - Verify get_system_state method works
This is a bare-bones test to isolate the actual issue
"""

from AlgorithmImports import *
from core.unified_state_manager import UnifiedStateManager

class MinimalTest(QCAlgorithm):
    """Minimal test to verify get_system_state method"""
    
    def Initialize(self):
        """Minimal initialization to test state manager"""
        
        # Bare minimum setup
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2023, 1, 2)  # Just one day
        self.SetCash(10000)
        
        # Force clear error logging
        self.Error("====== MINIMAL TEST STARTED ======")
        self.Error("[TEST] About to create UnifiedStateManager...")
        
        try:
            # Create state manager
            self.state_manager = UnifiedStateManager(self)
            self.Error("[TEST] ✓ UnifiedStateManager created successfully")
            
            # Test if get_system_state method exists
            if hasattr(self.state_manager, 'get_system_state'):
                self.Error("[TEST] ✓ get_system_state method exists")
                
                # Test if method is callable
                if callable(self.state_manager.get_system_state):
                    self.Error("[TEST] ✓ get_system_state is callable")
                    
                    # Try to call the method
                    try:
                        result = self.state_manager.get_system_state()
                        self.Error(f"[TEST] ✓ get_system_state() returned: {type(result)}")
                        
                        if isinstance(result, dict):
                            self.Error(f"[TEST] ✓ Result is dict with {len(result)} keys")
                            self.Error("[TEST] SUCCESS - METHOD WORKS PERFECTLY")
                        else:
                            self.Error(f"[TEST] WARNING - Result not dict: {result}")
                            
                    except Exception as call_error:
                        self.Error(f"[TEST] ✗ Method call failed: {call_error}")
                        
                else:
                    self.Error("[TEST] ✗ get_system_state is not callable")
            else:
                self.Error("[TEST] ✗ get_system_state method does not exist")
                
        except Exception as e:
            self.Error(f"[TEST] ✗ UnifiedStateManager creation failed: {e}")
            
        self.Error("====== MINIMAL TEST COMPLETE ======")