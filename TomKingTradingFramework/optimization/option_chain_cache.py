#!/usr/bin/env python3
"""
Option Chain Cache System - Phase 4 Optimization
Reduces redundant option chain queries by caching results
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict
import heapq

class OptionChainCache:
    """
    High-performance cache for option chains to reduce API calls
    Implements LRU cache with TTL and smart invalidation
    """
    
    def __init__(self, algorithm, cache_ttl_minutes: int = 5, max_cache_size: int = 100):
        self.algo = algorithm
        self.cache_ttl = timedelta(minutes=cache_ttl_minutes)
        self.max_cache_size = max_cache_size
        
        # Primary cache storage
        self.chain_cache: Dict[str, Dict] = {}
        self.cache_timestamps: Dict[str, datetime] = {}
        self.access_count: Dict[str, int] = defaultdict(int)
        
        # Performance metrics
        self.cache_hits = 0
        self.cache_misses = 0
        self.total_queries = 0
        
    def get_option_chain(self, underlying: str, min_strike: float = None, 
                        max_strike: float = None, min_expiry: int = 0, 
                        max_expiry: int = 60) -> Optional[List]:
        """
        Get option chain with caching - primary performance optimization
        """
        self.total_queries += 1
        
        # Generate cache key
        cache_key = f"{underlying}_{min_strike}_{max_strike}_{min_expiry}_{max_expiry}"
        
        # Check cache validity
        if self._is_cache_valid(cache_key):
            self.cache_hits += 1
            self.access_count[cache_key] += 1
            self.algo.Debug(f"[CACHE HIT] {underlying} - Hit rate: {self.get_hit_rate():.1%}")
            return self.chain_cache[cache_key]['contracts']
        
        # Cache miss - fetch from API
        self.cache_misses += 1
        contracts = self._fetch_option_chain(underlying, min_strike, max_strike, 
                                            min_expiry, max_expiry)
        
        # Store in cache
        self._store_in_cache(cache_key, contracts)
        
        # Evict old entries if cache is full
        if len(self.chain_cache) > self.max_cache_size:
            self._evict_lru_entry()
        
        return contracts
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached entry is still valid"""
        if cache_key not in self.chain_cache:
            return False
        
        # Check TTL
        if cache_key in self.cache_timestamps:
            age = self.algo.Time - self.cache_timestamps[cache_key]
            if age > self.cache_ttl:
                # Expired - remove from cache
                del self.chain_cache[cache_key]
                del self.cache_timestamps[cache_key]
                return False
        
        return True
    
    def _fetch_option_chain(self, underlying: str, min_strike: float, 
                           max_strike: float, min_expiry: int, max_expiry: int) -> List:
        """Fetch option chain from QuantConnect API"""
        try:
            if underlying not in self.algo.Securities:
                return []
            
            # Get the underlying symbol
            
            underlying_price = self.algo.Securities[underlying].Price
            
            # Set strike range if not specified
            if min_strike is None:
                min_strike = underlying_price * 0.8
            if max_strike is None:
                max_strike = underlying_price * 1.2
            
            # Get option contracts
            underlying_symbol = self.algo.Securities[underlying].Symbol if underlying in self.algo.Securities else self.algo.Symbol(underlying)
            contracts = self.algo.OptionChainProvider.GetOptionContractList(
                underlying_symbol, self.algo.Time
            )
            
            # Filter contracts efficiently
            filtered_contracts = []
            current_date = self.algo.Time.date()
            
            for contract in contracts:
                # Early exit conditions for performance
                if contract.ID.StrikePrice < min_strike or contract.ID.StrikePrice > max_strike:
                    continue
                
                days_to_expiry = (contract.ID.Date.date() - current_date).days
                if days_to_expiry < min_expiry or days_to_expiry > max_expiry:
                    continue
                
                filtered_contracts.append(contract)
            
            return filtered_contracts
            
        except Exception as e:
            self.algo.Error(f"Error fetching option chain for {underlying}: {e}")
            return []
    
    def _store_in_cache(self, cache_key: str, contracts: List):
        """Store contracts in cache with metadata"""
        self.chain_cache[cache_key] = {
            'contracts': contracts,
            'cached_at': self.algo.Time,
            'access_count': 0
        }
        self.cache_timestamps[cache_key] = self.algo.Time
    
    def _evict_lru_entry(self):
        """Evict least recently used cache entry"""
        if not self.access_count:
            # If no access counts, evict oldest
            oldest_key = min(self.cache_timestamps.keys(), 
                           key=lambda k: self.cache_timestamps[k])
            del self.chain_cache[oldest_key]
            del self.cache_timestamps[oldest_key]
        else:
            # Evict least frequently accessed
            lru_key = min(self.access_count.keys(), 
                         key=lambda k: self.access_count[k])
            if lru_key in self.chain_cache:
                del self.chain_cache[lru_key]
            if lru_key in self.cache_timestamps:
                del self.cache_timestamps[lru_key]
            del self.access_count[lru_key]
    
    def invalidate_cache(self, underlying: str = None):
        """Invalidate cache entries for a specific underlying or all"""
        if underlying:
            # Remove all entries for specific underlying
            keys_to_remove = [k for k in self.chain_cache.keys() 
                            if k.startswith(f"{underlying}_")]
            for key in keys_to_remove:
                del self.chain_cache[key]
                if key in self.cache_timestamps:
                    del self.cache_timestamps[key]
                if key in self.access_count:
                    del self.access_count[key]
        else:
            # Clear entire cache
            self.chain_cache.clear()
            self.cache_timestamps.clear()
            self.access_count.clear()
    
    def get_hit_rate(self) -> float:
        """Calculate cache hit rate for performance monitoring"""
        if self.total_queries == 0:
            return 0.0
        return self.cache_hits / self.total_queries
    
    def get_cache_stats(self) -> Dict:
        """Get cache performance statistics"""
        return {
            'cache_size': len(self.chain_cache),
            'total_queries': self.total_queries,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_rate': self.get_hit_rate(),
            'avg_access_count': sum(self.access_count.values()) / len(self.access_count) 
                               if self.access_count else 0
        }


class GreeksCache:
    """
    Cache for Greeks calculations to avoid redundant computations
    """
    
    def __init__(self, algorithm, cache_ttl_seconds: int = 30):
        self.algo = algorithm
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self.greeks_cache: Dict[str, Dict] = {}
        self.cache_timestamps: Dict[str, datetime] = {}
        
    def get_greeks(self, option_symbol: str) -> Optional[Dict]:
        """Get Greeks with caching"""
        # Check cache
        if option_symbol in self.greeks_cache:
            if self.algo.Time - self.cache_timestamps[option_symbol] < self.cache_ttl:
                return self.greeks_cache[option_symbol]
        
        # Calculate Greeks
        if option_symbol in self.algo.Securities:
            security = self.algo.Securities[option_symbol]
            if hasattr(security, 'Greeks'):
                greeks = {
                    'delta': security.Greeks.Delta,
                    'gamma': security.Greeks.Gamma,
                    'theta': security.Greeks.Theta,
                    'vega': security.Greeks.Vega,
                    'rho': security.Greeks.Rho
                }
                
                # Cache the result
                self.greeks_cache[option_symbol] = greeks
                self.cache_timestamps[option_symbol] = self.algo.Time
                
                return greeks
        
        return None
    
    def invalidate(self, option_symbol: str = None):
        """Invalidate Greeks cache"""
        if option_symbol:
            if option_symbol in self.greeks_cache:
                del self.greeks_cache[option_symbol]
                del self.cache_timestamps[option_symbol]
        else:
            self.greeks_cache.clear()
            self.cache_timestamps.clear()