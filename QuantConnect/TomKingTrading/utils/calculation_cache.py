# Tom King Trading Framework - Calculation Cache System
# Performance optimization through intelligent caching

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
import hashlib
import json

class CalculationCache:
    """
    High-performance caching system for expensive calculations
    
    Features:
    - Greeks calculation caching
    - Option chain filtering cache
    - Correlation matrix caching
    - Portfolio metrics caching
    - Automatic cache invalidation
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Cache storage
        self.greeks_cache = {}  # Key: (symbol, timestamp) -> Greeks
        self.chain_cache = {}   # Key: (underlying, dte, timestamp) -> Filtered chain
        self.correlation_cache = {}  # Key: timestamp -> Correlation matrix
        self.portfolio_cache = {}  # Key: metric_type -> Value
        
        # Cache expiration times
        self.CACHE_EXPIRATION = {
            'greeks': timedelta(minutes=5),      # Greeks valid for 5 minutes
            'chains': timedelta(minutes=1),      # Option chains for 1 minute
            'correlation': timedelta(minutes=15), # Correlations for 15 minutes
            'portfolio': timedelta(seconds=30)   # Portfolio metrics for 30 seconds
        }
        
        # Cache statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0
        }
        
        self.algorithm.Log("✅ CALCULATION CACHE INITIALIZED")
    
    def get_greeks(self, option_symbol: str, calculation_func, *args, **kwargs) -> Optional[Dict]:
        """
        Get cached Greeks or calculate if not cached
        
        Args:
            option_symbol: Option contract symbol
            calculation_func: Function to calculate Greeks if not cached
            *args, **kwargs: Arguments for calculation function
        
        Returns:
            Greeks dictionary
        """
        try:
            current_time = self.algorithm.Time
            cache_key = self._create_cache_key(option_symbol, current_time, 'greeks')
            
            # Check if cached and still valid
            if cache_key in self.greeks_cache:
                cached_data, timestamp = self.greeks_cache[cache_key]
                if current_time - timestamp < self.CACHE_EXPIRATION['greeks']:
                    self.stats['hits'] += 1
                    return cached_data
            
            # Cache miss - calculate Greeks
            self.stats['misses'] += 1
            greeks = calculation_func(*args, **kwargs)
            
            # Store in cache
            self.greeks_cache[cache_key] = (greeks, current_time)
            
            # Clean expired entries
            self._clean_expired_cache(self.greeks_cache, 'greeks')
            
            return greeks
            
        except Exception as e:
            self.algorithm.Error(f"Error in Greeks cache: {str(e)}")
            return calculation_func(*args, **kwargs)
    
    def get_filtered_chain(self, underlying: str, target_dte: int, 
                          filter_func, *args, **kwargs) -> Optional[list]:
        """
        Get cached filtered option chain or filter if not cached
        
        Args:
            underlying: Underlying symbol
            target_dte: Target days to expiration
            filter_func: Function to filter chain if not cached
            *args, **kwargs: Arguments for filter function
        
        Returns:
            Filtered option chain
        """
        try:
            current_time = self.algorithm.Time
            cache_key = f"{underlying}_{target_dte}_{current_time.minute}"
            
            # Check if cached and still valid
            if cache_key in self.chain_cache:
                cached_data, timestamp = self.chain_cache[cache_key]
                if current_time - timestamp < self.CACHE_EXPIRATION['chains']:
                    self.stats['hits'] += 1
                    return cached_data
            
            # Cache miss - filter chain
            self.stats['misses'] += 1
            filtered_chain = filter_func(*args, **kwargs)
            
            # Store in cache
            self.chain_cache[cache_key] = (filtered_chain, current_time)
            
            # Clean expired entries
            self._clean_expired_cache(self.chain_cache, 'chains')
            
            return filtered_chain
            
        except Exception as e:
            self.algorithm.Error(f"Error in chain cache: {str(e)}")
            return filter_func(*args, **kwargs)
    
    def get_correlation_matrix(self, symbols: list, calculation_func, 
                              *args, **kwargs) -> Optional[Dict]:
        """
        Get cached correlation matrix or calculate if not cached
        
        Args:
            symbols: List of symbols to correlate
            calculation_func: Function to calculate correlations if not cached
            *args, **kwargs: Arguments for calculation function
        
        Returns:
            Correlation matrix
        """
        try:
            current_time = self.algorithm.Time
            # Create deterministic key from symbols
            symbols_key = "_".join(sorted(symbols))
            cache_key = f"{symbols_key}_{current_time.hour}"
            
            # Check if cached and still valid
            if cache_key in self.correlation_cache:
                cached_data, timestamp = self.correlation_cache[cache_key]
                if current_time - timestamp < self.CACHE_EXPIRATION['correlation']:
                    self.stats['hits'] += 1
                    return cached_data
            
            # Cache miss - calculate correlations
            self.stats['misses'] += 1
            correlation_matrix = calculation_func(*args, **kwargs)
            
            # Store in cache
            self.correlation_cache[cache_key] = (correlation_matrix, current_time)
            
            # Clean expired entries
            self._clean_expired_cache(self.correlation_cache, 'correlation')
            
            return correlation_matrix
            
        except Exception as e:
            self.algorithm.Error(f"Error in correlation cache: {str(e)}")
            return calculation_func(*args, **kwargs)
    
    def get_portfolio_metric(self, metric_type: str, calculation_func, 
                            *args, **kwargs) -> Any:
        """
        Get cached portfolio metric or calculate if not cached
        
        Args:
            metric_type: Type of metric (e.g., 'total_greeks', 'exposure')
            calculation_func: Function to calculate metric if not cached
            *args, **kwargs: Arguments for calculation function
        
        Returns:
            Metric value
        """
        try:
            current_time = self.algorithm.Time
            cache_key = f"{metric_type}_{current_time.second // 30}"  # 30-second buckets
            
            # Check if cached and still valid
            if cache_key in self.portfolio_cache:
                cached_data, timestamp = self.portfolio_cache[cache_key]
                if current_time - timestamp < self.CACHE_EXPIRATION['portfolio']:
                    self.stats['hits'] += 1
                    return cached_data
            
            # Cache miss - calculate metric
            self.stats['misses'] += 1
            metric_value = calculation_func(*args, **kwargs)
            
            # Store in cache
            self.portfolio_cache[cache_key] = (metric_value, current_time)
            
            # Clean expired entries
            self._clean_expired_cache(self.portfolio_cache, 'portfolio')
            
            return metric_value
            
        except Exception as e:
            self.algorithm.Error(f"Error in portfolio cache: {str(e)}")
            return calculation_func(*args, **kwargs)
    
    def invalidate_cache(self, cache_type: str = None):
        """
        Invalidate cache (all or specific type)
        
        Args:
            cache_type: Type of cache to invalidate ('greeks', 'chains', 'correlation', 'portfolio')
                       If None, invalidate all caches
        """
        if cache_type == 'greeks' or cache_type is None:
            self.greeks_cache.clear()
        
        if cache_type == 'chains' or cache_type is None:
            self.chain_cache.clear()
        
        if cache_type == 'correlation' or cache_type is None:
            self.correlation_cache.clear()
        
        if cache_type == 'portfolio' or cache_type is None:
            self.portfolio_cache.clear()
        
        self.algorithm.Log(f"Cache invalidated: {cache_type or 'ALL'}")
    
    def _create_cache_key(self, primary_key: str, timestamp: datetime, 
                         cache_type: str) -> str:
        """Create cache key with time bucketing"""
        if cache_type == 'greeks':
            # 5-minute buckets for Greeks
            time_bucket = timestamp.minute // 5
            return f"{primary_key}_{timestamp.hour}_{time_bucket}"
        elif cache_type == 'chains':
            # 1-minute buckets for chains
            return f"{primary_key}_{timestamp.hour}_{timestamp.minute}"
        elif cache_type == 'correlation':
            # 15-minute buckets for correlations
            time_bucket = timestamp.minute // 15
            return f"{primary_key}_{timestamp.hour}_{time_bucket}"
        else:  # portfolio
            # 30-second buckets for portfolio metrics
            time_bucket = timestamp.second // 30
            return f"{primary_key}_{timestamp.minute}_{time_bucket}"
    
    def _clean_expired_cache(self, cache_dict: Dict, cache_type: str):
        """Remove expired entries from cache"""
        try:
            current_time = self.algorithm.Time
            expiration_time = self.CACHE_EXPIRATION[cache_type]
            
            expired_keys = []
            for key, (data, timestamp) in cache_dict.items():
                if current_time - timestamp > expiration_time:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del cache_dict[key]
                self.stats['evictions'] += 1
            
        except Exception as e:
            self.algorithm.Error(f"Error cleaning cache: {str(e)}")
    
    def get_cache_statistics(self) -> Dict:
        """Get cache performance statistics"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = self.stats['hits'] / total_requests if total_requests > 0 else 0
        
        return {
            'hits': self.stats['hits'],
            'misses': self.stats['misses'],
            'evictions': self.stats['evictions'],
            'hit_rate': hit_rate,
            'total_requests': total_requests,
            'cache_sizes': {
                'greeks': len(self.greeks_cache),
                'chains': len(self.chain_cache),
                'correlation': len(self.correlation_cache),
                'portfolio': len(self.portfolio_cache)
            }
        }
    
    def log_cache_performance(self):
        """Log cache performance metrics"""
        stats = self.get_cache_statistics()
        
        self.algorithm.Log("=" * 40)
        self.algorithm.Log("CACHE PERFORMANCE REPORT")
        self.algorithm.Log("=" * 40)
        self.algorithm.Log(f"Hit Rate: {stats['hit_rate']:.1%}")
        self.algorithm.Log(f"Total Hits: {stats['hits']}")
        self.algorithm.Log(f"Total Misses: {stats['misses']}")
        self.algorithm.Log(f"Evictions: {stats['evictions']}")
        self.algorithm.Log("Cache Sizes:")
        for cache_type, size in stats['cache_sizes'].items():
            self.algorithm.Log(f"  {cache_type}: {size} entries")
        self.algorithm.Log("=" * 40)