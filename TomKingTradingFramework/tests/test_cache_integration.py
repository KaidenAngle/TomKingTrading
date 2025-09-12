#!/usr/bin/env python3
"""
Phase 9.1.1 - Cache Consolidation Integration Tests
Test that UnifiedIntelligentCache properly replaces 3 caching systems
"""

import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType

class TestCacheConsolidation(unittest.TestCase):
    """Integration tests for unified cache system"""
    
    def setUp(self):
        """Setup test cache instance"""
        self.algorithm = MagicMock()
        self.algorithm.LiveMode = False  # Backtest mode
        self.algorithm.Time = datetime.now()  # Add Time property
        self.cache = UnifiedIntelligentCache(
            algorithm=self.algorithm,
            max_size=1000,
            ttl_minutes=5  # 5 minutes
        )
    
    def test_cache_initialization(self):
        """Test cache initializes correctly"""
        self.assertIsNotNone(self.cache)
        self.assertEqual(self.cache.max_size, 1000)
        self.assertEqual(self.cache.default_ttl.total_seconds(), 300)  # 5 minutes * 60 seconds
        
        # Verify stats work
        stats = self.cache.get_statistics()
        self.assertIn('hit_rate', stats)
        self.assertIn('cache_size', stats)
        self.assertEqual(stats['cache_size'], 0)
    
    def test_general_cache_functionality(self):
        """Test general cache functionality (replaces HighPerformanceCache)"""
        # Test basic get/put
        result = self.cache.get(
            key='test_vix',
            cache_type=CacheType.GENERAL,
            factory=lambda: 23.5
        )
        self.assertEqual(result, 23.5)
        
        # Verify hit on second call
        result2 = self.cache.get(
            key='test_vix',
            cache_type=CacheType.GENERAL,
            factory=lambda: 99.0  # Should not be called
        )
        self.assertEqual(result2, 23.5)  # Should return cached value
        
        # Verify cache stats show hit
        stats = self.cache.get_statistics()
        self.assertGreater(stats['hit_rate'], 0)
    
    def test_position_aware_cache(self):
        """Test position-aware cache functionality (replaces PositionAwareCache)"""
        # Test position-dependent caching
        position_count = 5
        key = f'spy_concentration_{position_count}'
        
        result = self.cache.get(
            key=key,
            cache_type=CacheType.POSITION_AWARE,
            factory=lambda: 0.15  # 15% concentration
        )
        self.assertEqual(result, 0.15)
        
        # Test invalidation when position changes
        self.cache.invalidate_by_type(CacheType.POSITION_AWARE)
        
        # Should recompute after invalidation
        result2 = self.cache.get(
            key=key,
            cache_type=CacheType.POSITION_AWARE,
            factory=lambda: 0.20  # New concentration
        )
        self.assertEqual(result2, 0.20)
    
    def test_market_data_cache(self):
        """Test market data cache functionality (replaces MarketDataCache)"""
        # Test market data with shorter TTL
        symbol = 'SPY'
        expiry = '2024-12-20'
        key = f'option_chain_{symbol}_{expiry}'
        
        result = self.cache.get(
            key=key,
            cache_type=CacheType.MARKET_DATA,
            factory=lambda: {'SPY241220C450': 1.50, 'SPY241220P450': 1.25}
        )
        
        self.assertIsInstance(result, dict)
        self.assertIn('SPY241220C450', result)
        
        # Verify market data specific invalidation
        invalidated_count = self.cache.invalidate_by_type(CacheType.MARKET_DATA)
        self.assertEqual(invalidated_count, 1)
    
    def test_greeks_cache(self):
        """Test Greeks cache functionality"""
        position_id = 'iron_condor_1'
        key = f'position_greeks_{position_id}'
        
        mock_greeks = {
            'delta': -0.05,
            'gamma': -0.02,
            'theta': 0.15,
            'vega': -0.10
        }
        
        result = self.cache.get(
            key=key,
            cache_type=CacheType.GREEKS,
            factory=lambda: mock_greeks
        )
        
        self.assertEqual(result, mock_greeks)
    
    def test_cache_type_isolation(self):
        """Test that different cache types are properly isolated"""
        # Add entries of different types
        self.cache.get('test_key', CacheType.GENERAL, lambda: 'general_value')
        self.cache.get('test_key', CacheType.GREEKS, lambda: 'greeks_value')
        self.cache.get('test_key', CacheType.MARKET_DATA, lambda: 'market_value')
        
        # Verify all entries exist separately
        stats = self.cache.get_statistics()
        self.assertEqual(stats['cache_size'], 3)
        
        # Verify type-specific invalidation works
        general_count = self.cache.invalidate_by_type(CacheType.GENERAL)
        self.assertEqual(general_count, 1)
        
        # Other types should remain
        stats_after = self.cache.get_statistics()
        self.assertEqual(stats_after['cache_size'], 2)
    
    def test_memory_management(self):
        """Test cache memory management and cleanup"""
        # Fill cache to capacity
        for i in range(1100):  # Exceed max_size of 1000
            self.cache.get(f'key_{i}', CacheType.GENERAL, lambda i=i: f'value_{i}')
        
        # Should have cleaned up to stay under limit
        stats = self.cache.get_statistics()
        self.assertLessEqual(stats['cache_size'], 1000)
        
        # Should still be functional
        result = self.cache.get('new_key', CacheType.GENERAL, lambda: 'new_value')
        self.assertEqual(result, 'new_value')
    
    def test_ttl_expiration(self):
        """Test TTL-based cache expiration"""
        # Add entry with very short TTL
        self.cache.get(
            'short_ttl_key',
            CacheType.GENERAL,
            lambda: 'original_value'
        )
        
        # Wait for expiration (simulate time passing)
        import time
        time.sleep(0.002)
        
        # Should recompute due to expiration
        result = self.cache.get(
            'short_ttl_key',
            CacheType.GENERAL,
            lambda: 'new_value'
        )
        self.assertEqual(result, 'new_value')
    
    def test_pattern_invalidation(self):
        """Test pattern-based cache invalidation"""
        # Add entries with pattern
        self.cache.get('greeks_position_1', CacheType.GREEKS, lambda: 'value1')
        self.cache.get('greeks_position_2', CacheType.GREEKS, lambda: 'value2')
        self.cache.get('other_key', CacheType.GENERAL, lambda: 'value3')
        
        # Invalidate by pattern
        count = self.cache.invalidate_pattern('greeks_position_')
        self.assertEqual(count, 2)
        
        # Other key should remain
        stats = self.cache.get_statistics()
        self.assertEqual(stats['cache_size'], 1)

def test_unified_cache_consolidation():
    """Main integration test for cache consolidation"""
    print("[TEST] Testing UnifiedIntelligentCache consolidation...")
    
    suite = unittest.TestLoader().loadTestsFromTestCase(TestCacheConsolidation)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    if result.wasSuccessful():
        print("[PASS] Cache consolidation tests PASSED")
        print("[INFO] UnifiedIntelligentCache successfully replaces 3 caching systems")
        return True
    else:
        print("[FAIL] Cache consolidation tests FAILED")
        print("[CRITICAL] Critical issue with unified cache system")
        return False

if __name__ == '__main__':
    success = test_unified_cache_consolidation()
    sys.exit(0 if success else 1)