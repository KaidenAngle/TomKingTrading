#!/usr/bin/env python3
"""
MINIMAL TEST ALGORITHM - Isolate get_system_state method testing
This replaces the full complex algorithm with a simple test
"""

from AlgorithmImports import *

class TomKingTradingIntegratedCacheBust(QCAlgorithm):
    """
    MINIMAL TEST MODE - Testing get_system_state method isolation
    """
    
    def Initialize(self):
        """MINIMAL TEST MODE - Focus on get_system_state method only"""
        
        # Bare minimum setup
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2023, 1, 2)  # Just one day
        self.SetCash(10000)
        
        # Force clear error logging
        self.Error("======== MINIMAL TEST ALGORITHM STARTED ========")
        self.Error("[MINIMAL] Testing get_system_state method isolation...")
        
        try:
            # Import and create ONLY the state manager
            from core.unified_state_manager import UnifiedStateManager
            self.state_manager = UnifiedStateManager(self)
            self.Error("[MINIMAL] ✓ UnifiedStateManager created successfully")
            
            # Test the method directly
            if hasattr(self.state_manager, 'get_system_state'):
                self.Error("[MINIMAL] ✓ get_system_state method exists")
                
                if callable(self.state_manager.get_system_state):
                    self.Error("[MINIMAL] ✓ get_system_state is callable")
                    
                    try:
                        result = self.state_manager.get_system_state()
                        self.Error(f"[MINIMAL] ✓ Method returned: {type(result)}")
                        
                        if isinstance(result, dict):
                            self.Error(f"[MINIMAL] ✓ SUCCESS: Dict with {len(result)} keys")
                            # Show a few key names for verification
                            keys_sample = list(result.keys())[:3] if result else []
                            self.Error(f"[MINIMAL] ✓ Sample keys: {keys_sample}")
                        else:
                            self.Error(f"[MINIMAL] WARNING: Not dict: {result}")
                            
                    except Exception as call_error:
                        self.Error(f"[MINIMAL] ✗ Method call failed: {call_error}")
                        self.Error(f"[MINIMAL] ✗ Error type: {type(call_error)}")
                        
                else:
                    self.Error("[MINIMAL] ✗ Method not callable")
            else:
                self.Error("[MINIMAL] ✗ Method does not exist")
                
        except Exception as e:
            self.Error(f"[MINIMAL] ✗ StateManager creation failed: {e}")
            self.Error(f"[MINIMAL] ✗ Error type: {type(e)}")
            
        self.Error("======== MINIMAL TEST COMPLETE ========")
    
    def OnData(self, data):
        """Minimal OnData to prevent runtime errors"""
        pass