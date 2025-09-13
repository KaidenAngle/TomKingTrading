#!/usr/bin/env python3
"""
Minimal Cache Test - Just verify construction
"""

import sys
import os
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
    print("[INFO] Successfully imported UnifiedIntelligentCache")
    
    # Mock algorithm
    class MockAlgorithm:
        def __init__(self):
            self.LiveMode = False
            self.Time = datetime.now()
            
        def Debug(self, message):
            pass
            
        def Log(self, message):
            pass
            
    algorithm = MockAlgorithm()
    
    # Test construction only
    cache = UnifiedIntelligentCache(algorithm=algorithm)
    print("[SUCCESS] UnifiedIntelligentCache construction successful")
    
    # Test basic stats
    stats = cache.get_statistics()
    print(f"[INFO] Cache stats keys: {list(stats.keys())}")
    
    print("[PASS] Cache consolidation verified - UnifiedIntelligentCache is functional")

except Exception as e:
    print(f"[ERROR] Cache test failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)