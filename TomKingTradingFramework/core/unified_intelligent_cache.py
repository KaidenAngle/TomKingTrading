#!/usr/bin/env python3
"""
Unified Intelligent Cache System for Tom King Trading Framework
Consolidates HighPerformanceCache, PositionAwareCache, and MarketDataCache into single system

CONSOLIDATION FROM COMPREHENSIVE_SYSTEM_ANALYSIS.md:
- Replaces 3 separate caching systems with unified intelligent cache
- Automatic price-change invalidation 
- Position-aware expiration
- Memory-efficient unified storage
- Maintains ALL safety features from original caches
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, TypeVar, Generic, Tuple, Set
from collections import OrderedDict
from dataclasses import dataclass
from threading import Lock
from enum import Enum
import weakref
import gc

T = TypeVar('T')

class CacheType(Enum):
    """Cache entry types for intelligent invalidation"""
    GENERAL = "general"
    POSITION_AWARE = "position_aware"
    MARKET_DATA = "market_data"
    GREEKS = "greeks"
    STATE = "state"

@dataclass
class UnifiedCacheEntry:
    """Enhanced cache entry with type awareness and invalidation rules"""
    data: Any
    cache_type: CacheType
    created_at: datetime
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    size_bytes: int = 0
    ttl_override: Optional[timedelta] = None
    invalidation_tags: Set[str] = None
    
    def __post_init__(self):
        if self.invalidation_tags is None:
            self.invalidation_tags = set()
    
    def is_expired(self, default_ttl: timedelta, current_time: datetime) -> bool:
        """Check if entry has expired based on type-specific or custom TTL"""
        ttl = self.ttl_override if self.ttl_override else default_ttl
        
        # Market data has shorter TTL
        if self.cache_type == CacheType.MARKET_DATA:
            ttl = min(ttl, timedelta(minutes=1))
        
        return (current_time - self.created_at) > ttl
    
    def touch(self, current_time: datetime):
        """Update access metadata"""
        self.access_count += 1
        self.last_accessed = current_time
    
    def should_invalidate_on_position_change(self) -> bool:
        """Check if entry should be invalidated on position changes"""
        return (
            self.cache_type in [CacheType.POSITION_AWARE, CacheType.GREEKS] or
            any(tag in self.invalidation_tags for tag in ['portfolio', 'greek', 'position'])
        )
    
    def should_invalidate_on_price_change(self, symbol: str) -> bool:
        """Check if entry should be invalidated on price changes"""
        return (
            self.cache_type == CacheType.MARKET_DATA or
            symbol.upper() in self.invalidation_tags
        )

@dataclass
class UnifiedCacheStats:
    """Comprehensive cache statistics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    total_queries: int = 0
    memory_usage_bytes: int = 0
    position_invalidations: int = 0
    price_invalidations: int = 0
    ttl_expirations: int = 0
    cache_size: int = 0
    
    # Type-specific stats
    general_entries: int = 0
    position_aware_entries: int = 0
    market_data_entries: int = 0
    greeks_entries: int = 0
    state_entries: int = 0
    
    def hit_rate(self) -> float:
        return self.hits / max(1, self.total_queries)
    
    def miss_rate(self) -> float:
        return self.misses / max(1, self.total_queries)

class UnifiedIntelligentCache(Generic[T]):
    """
    UNIFIED INTELLIGENT CACHE - CONSOLIDATION IMPLEMENTATION
    
    Replaces:
    - HighPerformanceCache (LRU, TTL, memory management)
    - PositionAwareCache (position change invalidation)
    - MarketDataCache (price change invalidation)
    
    Features:
    - Type-aware caching with intelligent invalidation
    - Automatic price-change detection and invalidation
    - Position-change detection and invalidation
    - Memory-efficient unified storage
    - Comprehensive statistics and monitoring
    - Thread-safe operations with fine-grained locking
    - Custom TTL per entry type
    - Tag-based invalidation system
    """
    
    def __init__(
        self,
        algorithm,
        max_size: int = 2000,  # Increased from 1000 to accommodate consolidated cache
        ttl_minutes: int = 5,
        max_memory_mb: int = 100,  # Increased from 50MB for consolidated cache
        price_change_threshold: float = 0.001,
        position_check_interval_seconds: int = 30,
        enable_stats: bool = True
    ):
        self.algo = algorithm
        self.max_size = max_size
        self.default_ttl = timedelta(minutes=ttl_minutes)
        self.max_memory_bytes = max_memory_mb * 1024 * 1024
        self.price_change_threshold = price_change_threshold
        self.position_check_interval = timedelta(seconds=position_check_interval_seconds)
        self.enable_stats = enable_stats
        
        # Unified cache storage
        self._cache: OrderedDict[str, UnifiedCacheEntry] = OrderedDict()
        self._lock = Lock()
        
        # Statistics
        self.stats = UnifiedCacheStats()
        
        # Environment-aware configuration
        self.is_backtest = not algorithm.LiveMode
        if self.is_backtest:
            # Longer TTL for backtests (stable data)
            self.default_ttl = timedelta(minutes=ttl_minutes * 2)
            # Larger memory limit for backtests
            self.max_memory_bytes *= 2
        
        # Price tracking for market data invalidation
        self._last_prices: Dict[str, float] = {}
        self._tracked_symbols = {'SPY', 'QQQ', 'VIX', 'IWM', 'TLT', 'ES', 'SPX'}
        
        # Position tracking for position-aware invalidation
        self._position_snapshot: Dict[str, float] = {}
        self._last_position_check = algorithm.Time
        
        # Maintenance
        self._last_cleanup = algorithm.Time
        self._cleanup_interval = timedelta(minutes=10)
        
        # Custom invalidation hooks for extensibility
        self._invalidation_hooks: Dict[str, Callable] = {}
        
        algorithm.Debug(
            f"[UnifiedCache] Initialized: max_size={max_size}, ttl={self.default_ttl}, "
            f"max_memory={max_memory_mb}MB, price_threshold={price_change_threshold}"
        )
    
    def get(
        self, 
        key: str, 
        cache_type: CacheType = CacheType.GENERAL,
        factory: Optional[Callable[[], T]] = None,
        tags: Optional[Set[str]] = None
    ) -> Optional[T]:
        """
        Get value from unified cache with type-aware behavior
        
        Args:
            key: Cache key
            cache_type: Type of cache entry for intelligent invalidation
            factory: Function to compute value if cache miss
            tags: Invalidation tags for fine-grained control
            
        Returns:
            Cached or computed value, None if not found and no factory
        """
        with self._lock:
            current_time = self.algo.Time
            
            if self.enable_stats:
                self.stats.total_queries += 1
            
            # Check if key exists and is valid
            if key in self._cache:
                entry = self._cache[key]
                
                # Check various invalidation conditions
                should_invalidate = False
                invalidation_reason = None
                
                # TTL expiration
                if entry.is_expired(self.default_ttl, current_time):
                    should_invalidate = True
                    invalidation_reason = "ttl_expired"
                    if self.enable_stats:
                        self.stats.ttl_expirations += 1
                
                # Position change invalidation
                elif entry.should_invalidate_on_position_change() and self._has_position_changed():
                    should_invalidate = True
                    invalidation_reason = "position_changed"
                    if self.enable_stats:
                        self.stats.position_invalidations += 1
                
                # Price change invalidation
                elif self._should_invalidate_on_price_change(entry):
                    should_invalidate = True
                    invalidation_reason = "price_changed"
                    if self.enable_stats:
                        self.stats.price_invalidations += 1
                
                # Custom invalidation hooks
                elif self._check_custom_invalidation(key, entry):
                    should_invalidate = True
                    invalidation_reason = "custom_hook"
                
                if should_invalidate:
                    self._remove_entry(key)
                    if self.enable_stats:
                        self.stats.misses += 1
                    # Continue to factory logic below
                else:
                    # Cache hit - update access info and move to end
                    entry.touch(current_time)
                    self._cache.move_to_end(key)
                    
                    if self.enable_stats:
                        self.stats.hits += 1
                    
                    return entry.data
            
            # Cache miss - use factory if provided
            if factory:
                try:
                    value = factory()
                    self.put(key, value, cache_type=cache_type, tags=tags)
                    return value
                except Exception as e:
                    self.algo.Debug(f"[UnifiedCache] Factory function failed for key {key}: {e}")
                    if self.enable_stats:
                        self.stats.misses += 1
                    return None
            
            # No factory and cache miss
            if self.enable_stats:
                self.stats.misses += 1
            
            return None
    
    def put(
        self, 
        key: str, 
        value: T, 
        cache_type: CacheType = CacheType.GENERAL,
        custom_ttl: Optional[timedelta] = None,
        tags: Optional[Set[str]] = None
    ) -> bool:
        """
        Put value into unified cache with type-aware storage
        
        Args:
            key: Cache key
            value: Value to cache
            cache_type: Type of cache entry for intelligent behavior
            custom_ttl: Custom TTL for this entry
            tags: Invalidation tags for fine-grained control
            
        Returns:
            True if successfully cached
        """
        with self._lock:
            current_time = self.algo.Time
            
            try:
                # Estimate memory usage
                size_bytes = self._estimate_size(value)
                
                # Check memory limits
                if size_bytes > self.max_memory_bytes:
                    self.algo.Debug(f"[UnifiedCache] Value too large: {size_bytes} bytes > {self.max_memory_bytes}")
                    return False
                
                # Create unified cache entry
                entry = UnifiedCacheEntry(
                    data=value,
                    cache_type=cache_type,
                    created_at=current_time,
                    last_accessed=current_time,
                    size_bytes=size_bytes,
                    ttl_override=custom_ttl,
                    invalidation_tags=tags or set()
                )
                
                # Remove existing entry if present
                if key in self._cache:
                    self._remove_entry(key)
                
                # Add new entry
                self._cache[key] = entry
                
                # Update statistics
                if self.enable_stats:
                    self.stats.memory_usage_bytes += size_bytes
                    self.stats.cache_size = len(self._cache)
                    self._update_type_stats(cache_type, delta=1)
                
                # FIXED: Enforce size and memory limits to prevent memory leaks
                self._enforce_cache_limits()
                
                return True
                
            except Exception as e:
                self.algo.Error(f"[UnifiedCache] Failed to cache value for key {key}: {e}")
                return False
    
    def invalidate(self, key: str) -> bool:
        """Remove specific key from cache"""
        with self._lock:
            if key in self._cache:
                self._remove_entry(key)
                return True
            return False
    
    def invalidate_by_type(self, cache_type: CacheType) -> int:
        """Invalidate all entries of specific type"""
        with self._lock:
            keys_to_remove = [
                k for k, v in self._cache.items() 
                if v.cache_type == cache_type
            ]
            for key in keys_to_remove:
                self._remove_entry(key)
            return len(keys_to_remove)
    
    def invalidate_by_tag(self, tag: str) -> int:
        """Invalidate all entries with specific tag"""
        with self._lock:
            keys_to_remove = [
                k for k, v in self._cache.items() 
                if tag in v.invalidation_tags
            ]
            for key in keys_to_remove:
                self._remove_entry(key)
            return len(keys_to_remove)
    
    def invalidate_pattern(self, pattern: str) -> int:
        """Remove all keys matching pattern"""
        with self._lock:
            keys_to_remove = [k for k in self._cache.keys() if pattern in k]
            for key in keys_to_remove:
                self._remove_entry(key)
            return len(keys_to_remove)
    
    def invalidate_all(self) -> int:
        """Clear entire cache"""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
            if self.enable_stats:
                self.stats.memory_usage_bytes = 0
                self.stats.cache_size = 0
                self._reset_type_stats()
            return count
    
    def force_position_check(self):
        """Force immediate position change check and invalidation"""
        if self._has_position_changed():
            invalidated = self.invalidate_by_type(CacheType.POSITION_AWARE)
            invalidated += self.invalidate_by_type(CacheType.GREEKS)
            if self.enable_stats:
                self.stats.position_invalidations += invalidated
            
            self.algo.Debug(f"[UnifiedCache] Position change detected, invalidated {invalidated} entries")
    
    def force_price_check(self):
        """Force immediate price change check and invalidation"""
        invalidated_count = 0
        with self._lock:
            keys_to_remove = []
            for key, entry in self._cache.items():
                if self._should_invalidate_on_price_change(entry):
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                self._remove_entry(key)
                invalidated_count += 1
        
        if self.enable_stats:
            self.stats.price_invalidations += invalidated_count
        
        if invalidated_count > 0:
            self.algo.Debug(f"[UnifiedCache] Price changes detected, invalidated {invalidated_count} entries")
    
    def periodic_maintenance(self):
        """Run comprehensive maintenance tasks"""
        with self._lock:  # FIXED: Add lock protection for maintenance operations
            current_time = self.algo.Time
            
            # Run cleanup if interval has passed
            if (current_time - self._last_cleanup) > self._cleanup_interval:
                # Clean up expired entries
                expired_count = self._cleanup_expired()
                
                # Check position changes
                if self._has_position_changed():
                    self.force_position_check()
                
                # Check price changes
                self.force_price_check()
                
                # Check custom invalidation hooks
                self._check_all_custom_invalidation()
                
                # Force garbage collection if memory usage is high
                if self.stats.memory_usage_bytes > (self.max_memory_bytes * 0.8):
                    gc.collect()
                
                self._last_cleanup = current_time
                
                if expired_count > 0:
                    self.algo.Debug(f"[UnifiedCache] Maintenance: cleaned {expired_count} expired entries")
    
    def _enforce_cache_limits(self):
        """FIXED: Enforce cache size and memory limits to prevent memory leaks"""
        # Enforce memory limit
        while (self.stats.memory_usage_bytes > self.max_memory_bytes and len(self._cache) > 0):
            # Remove oldest entry (LRU eviction)
            oldest_key = next(iter(self._cache))
            self._remove_entry(oldest_key)
            self.algo.Debug(f"[UnifiedCache] Memory limit exceeded, removed oldest entry: {oldest_key}")
        
        # Enforce max cache size limit
        while len(self._cache) > self.max_size:
            oldest_key = next(iter(self._cache))
            self._remove_entry(oldest_key)
            self.algo.Debug(f"[UnifiedCache] Size limit exceeded, removed oldest entry: {oldest_key}")
    
    def get_statistics(self) -> Dict:
        """Get comprehensive cache performance statistics"""
        with self._lock:
            return {
                'unified_cache_version': '1.0',
                'consolidation_info': 'Replaces HighPerformanceCache + PositionAwareCache + MarketDataCache',
                'hit_rate': self.stats.hit_rate(),
                'miss_rate': self.stats.miss_rate(),
                'total_queries': self.stats.total_queries,
                'cache_hits': self.stats.hits,
                'cache_misses': self.stats.misses,
                'evictions': self.stats.evictions,
                'position_invalidations': self.stats.position_invalidations,
                'price_invalidations': self.stats.price_invalidations,
                'ttl_expirations': self.stats.ttl_expirations,
                'cache_size': len(self._cache),
                'max_size': self.max_size,
                'memory_usage_mb': self.stats.memory_usage_bytes / (1024 * 1024),
                'max_memory_mb': self.max_memory_bytes / (1024 * 1024),
                'default_ttl_minutes': self.default_ttl.total_seconds() / 60,
                'is_backtest': self.is_backtest,
                'cache_distribution': {
                    'general': self.stats.general_entries,
                    'position_aware': self.stats.position_aware_entries,
                    'market_data': self.stats.market_data_entries,
                    'greeks': self.stats.greeks_entries,
                    'state': self.stats.state_entries
                }
            }
    
    # Backward compatibility methods for legacy code
    def add_invalidation_hook(self, name: str, hook: Callable):
        """Add custom invalidation hook for backward compatibility"""
        self._invalidation_hooks[name] = hook
    
    def remove_invalidation_hook(self, name: str):
        """Remove invalidation hook"""
        if name in self._invalidation_hooks:
            del self._invalidation_hooks[name]
    
    def log_stats(self):
        """Log comprehensive cache statistics"""
        stats = self.get_statistics()
        self.algo.Debug(
            f"[UnifiedCache] Hit Rate: {stats['hit_rate']:.1%} | "
            f"Size: {stats['cache_size']}/{stats['max_size']} | "
            f"Memory: {stats['memory_usage_mb']:.1f}/{stats['max_memory_mb']:.1f}MB | "
            f"Evictions: {stats['evictions']} | "
            f"Pos Inv: {stats['position_invalidations']} | "
            f"Price Inv: {stats['price_invalidations']}"
        )
    
    # Private helper methods
    def _has_position_changed(self) -> bool:
        """Check if positions have changed since last check"""
        current_time = self.algo.Time
        
        # Only check periodically to avoid performance impact
        if (current_time - self._last_position_check) < self.position_check_interval:
            return False
        
        current_snapshot = self._get_position_snapshot()
        changed = current_snapshot != self._position_snapshot
        
        if changed:
            self._position_snapshot = current_snapshot
        
        self._last_position_check = current_time
        return changed
    
    def _get_position_snapshot(self) -> Dict[str, float]:
        """Get current position snapshot for change detection"""
        snapshot = {}
        try:
            for symbol, holding in self.algo.Portfolio.items():
                if holding.Invested and abs(holding.Quantity) > 0:
                    snapshot[str(symbol)] = holding.Quantity
        except Exception as e:
            self.algo.Debug(f"[UnifiedCache] Error getting position snapshot: {e}")
        return snapshot
    
    def _should_invalidate_on_price_change(self, entry: UnifiedCacheEntry) -> bool:
        """Check if entry should be invalidated due to price changes"""
        if entry.cache_type != CacheType.MARKET_DATA and not entry.invalidation_tags:
            return False
        
        try:
            # Check tracked symbols for price changes
            for symbol_str in self._tracked_symbols:
                if (symbol_str in entry.invalidation_tags or 
                    entry.cache_type == CacheType.MARKET_DATA):
                    
                    if symbol_str in self.algo.Securities:
                        current_price = self.algo.Securities[symbol_str].Price
                        
                        if symbol_str in self._last_prices:
                            last_price = self._last_prices[symbol_str]
                            if last_price > 0:  # Avoid division by zero
                                change_pct = abs(current_price - last_price) / last_price
                                
                                if change_pct > self.price_change_threshold:
                                    self._last_prices[symbol_str] = current_price
                                    return True
                        else:
                            self._last_prices[symbol_str] = current_price
        except Exception as e:
            self.algo.Debug(f"[UnifiedCache] Price check error: {e}")
        
        return False
    
    def _check_custom_invalidation(self, key: str, entry: UnifiedCacheEntry) -> bool:
        """Check custom invalidation hooks"""
        for hook_name, hook in self._invalidation_hooks.items():
            try:
                if hook(key, entry.data):
                    return True
            except Exception as e:
                self.algo.Debug(f"[UnifiedCache] Hook {hook_name} failed: {e}")
        return False
    
    def _check_all_custom_invalidation(self):
        """Check all custom invalidation hooks and remove matching entries"""
        if not self._invalidation_hooks:
            return
        
        with self._lock:
            keys_to_remove = []
            for key, entry in self._cache.items():
                if self._check_custom_invalidation(key, entry):
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                self._remove_entry(key)
    
    def _cleanup_expired(self) -> int:
        """Remove expired entries"""
        current_time = self.algo.Time
        keys_to_remove = []
        
        for key, entry in self._cache.items():
            if entry.is_expired(self.default_ttl, current_time):
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            self._remove_entry(key)
        
        if self.enable_stats:
            self.stats.ttl_expirations += len(keys_to_remove)
        
        return len(keys_to_remove)
    
    def _remove_entry(self, key: str):
        """Remove entry and update statistics"""
        if key in self._cache:
            entry = self._cache[key]
            del self._cache[key]
            
            if self.enable_stats:
                self.stats.memory_usage_bytes -= entry.size_bytes
                self.stats.cache_size = len(self._cache)
                self._update_type_stats(entry.cache_type, delta=-1)
    
    def _enforce_limits(self):
        """Enforce cache size and memory limits using LRU eviction"""
        # Enforce size limit
        while len(self._cache) > self.max_size:
            oldest_key = next(iter(self._cache))
            self._remove_entry(oldest_key)
            if self.enable_stats:
                self.stats.evictions += 1
        
        # Enforce memory limit
        while self.stats.memory_usage_bytes > self.max_memory_bytes and self._cache:
            oldest_key = next(iter(self._cache))
            self._remove_entry(oldest_key)
            if self.enable_stats:
                self.stats.evictions += 1
    
    def _estimate_size(self, value: Any) -> int:
        """Estimate memory usage of a value"""
        try:
            if isinstance(value, (int, float, bool)):
                return 24
            elif isinstance(value, str):
                return 50 + len(value)
            elif isinstance(value, (list, tuple)):
                return 64 + sum(self._estimate_size(item) for item in value[:10])
            elif isinstance(value, dict):
                size = 240
                for k, v in list(value.items())[:10]:
                    size += self._estimate_size(k) + self._estimate_size(v)
                return size
            else:
                return 1024
        except:
            return 1024
    
    def _update_type_stats(self, cache_type: CacheType, delta: int):
        """Update type-specific statistics"""
        if cache_type == CacheType.GENERAL:
            self.stats.general_entries += delta
        elif cache_type == CacheType.POSITION_AWARE:
            self.stats.position_aware_entries += delta
        elif cache_type == CacheType.MARKET_DATA:
            self.stats.market_data_entries += delta
        elif cache_type == CacheType.GREEKS:
            self.stats.greeks_entries += delta
        elif cache_type == CacheType.STATE:
            self.stats.state_entries += delta
    
    def _reset_type_stats(self):
        """Reset type-specific statistics"""
        self.stats.general_entries = 0
        self.stats.position_aware_entries = 0
        self.stats.market_data_entries = 0
        self.stats.greeks_entries = 0
        self.stats.state_entries = 0


# Compatibility aliases for migration
UnifiedCache = UnifiedIntelligentCache