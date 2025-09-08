#!/usr/bin/env python3
"""
API Rate Limiter - Production Safety
Prevents API limit violations and manages request throttling
"""

from typing import Dict, Optional
from datetime import datetime, timedelta
from collections import deque
import time

class RateLimiter:
    """
    Rate limiter for API calls to prevent exceeding broker/data provider limits
    """
    
    def __init__(self, algorithm, max_requests_per_minute: int = 120):
        self.algo = algorithm
        self.max_requests_per_minute = max_requests_per_minute
        
        # Track request timestamps
        self.request_times = deque()
        
        # Broker-specific limits
        self.broker_limits = {
            'tastytrade': {
                'api': 120,  # per minute
                'websocket': 100,  # concurrent subscriptions
                'orders': 60  # per minute
            },
            'quantconnect': {
                'option_chains': 100,  # per minute
                'historical': 10,  # per second
                'orders': 500  # per minute
            }
        }
        
        # Track requests by type
        self.requests_by_type = {
            'option_chain': deque(),
            'order': deque(),
            'data': deque(),
            'greeks': deque()
        }
        
        # Circuit breaker
        self.circuit_breaker_active = False
        self.circuit_breaker_reset_time = None
        
    def can_make_request(self, request_type: str = 'api', broker: str = 'quantconnect') -> tuple[bool, float]:
        """
        Check if request can be made without violating rate limits
        Returns (allowed, wait_time_seconds)
        """
        # Check circuit breaker
        if self.circuit_breaker_active:
            if datetime.now() < self.circuit_breaker_reset_time:
                wait_time = (self.circuit_breaker_reset_time - datetime.now()).total_seconds()
                return False, wait_time
            else:
                self.circuit_breaker_active = False
                self.algo.Log("[RATE LIMITER] Circuit breaker reset")
        
        # Get appropriate limit
        if broker in self.broker_limits and request_type in self.broker_limits[broker]:
            limit = self.broker_limits[broker][request_type]
        else:
            limit = self.max_requests_per_minute
            
        # Clean old requests (older than 1 minute)
        current_time = datetime.now()
        cutoff_time = current_time - timedelta(minutes=1)
        
        # Clean general requests
        while self.request_times and self.request_times[0] < cutoff_time:
            self.request_times.popleft()
            
        # Clean typed requests
        if request_type in self.requests_by_type:
            typed_requests = self.requests_by_type[request_type]
            while typed_requests and typed_requests[0] < cutoff_time:
                typed_requests.popleft()
                
        # Check if under limit
        if len(self.request_times) < limit:
            return True, 0.0
        else:
            # Calculate wait time
            oldest_request = self.request_times[0]
            wait_time = (oldest_request + timedelta(minutes=1) - current_time).total_seconds()
            return False, max(0, wait_time)
            
    def record_request(self, request_type: str = 'api'):
        """Record that a request was made"""
        current_time = datetime.now()
        self.request_times.append(current_time)
        
        if request_type in self.requests_by_type:
            self.requests_by_type[request_type].append(current_time)
            
    def wait_if_needed(self, request_type: str = 'api', broker: str = 'quantconnect') -> bool:
        """
        Wait if necessary before making request
        Returns True if request can proceed, False if circuit breaker is active
        """
        allowed, wait_time = self.can_make_request(request_type, broker)
        
        if not allowed:
            if wait_time > 60:  # Circuit breaker threshold
                self.trigger_circuit_breaker()
                return False
            elif wait_time > 0:
                self.algo.Log(f"[RATE LIMITER] Waiting {wait_time:.1f}s before {request_type} request")
                time.sleep(wait_time)
                
        self.record_request(request_type)
        return True
        
    def trigger_circuit_breaker(self, duration_minutes: int = 5):
        """Trigger circuit breaker to stop all requests temporarily"""
        self.circuit_breaker_active = True
        self.circuit_breaker_reset_time = datetime.now() + timedelta(minutes=duration_minutes)
        self.algo.Log(f"[RATE LIMITER] Circuit breaker triggered! Pausing requests for {duration_minutes} minutes")
        
        # Clear request queues
        self.request_times.clear()
        for queue in self.requests_by_type.values():
            queue.clear()
            
    def get_usage_stats(self) -> Dict:
        """Get current rate limit usage statistics"""
        current_time = datetime.now()
        cutoff_time = current_time - timedelta(minutes=1)
        
        # Count recent requests
        recent_requests = sum(1 for t in self.request_times if t > cutoff_time)
        
        # Count by type
        requests_by_type = {}
        for req_type, times in self.requests_by_type.items():
            requests_by_type[req_type] = sum(1 for t in times if t > cutoff_time)
            
        return {
            'total_requests_per_minute': recent_requests,
            'usage_percentage': (recent_requests / self.max_requests_per_minute) * 100,
            'requests_by_type': requests_by_type,
            'circuit_breaker_active': self.circuit_breaker_active,
            'can_make_request': recent_requests < self.max_requests_per_minute
        }
        
    def adaptive_throttle(self, request_type: str = 'api') -> float:
        """
        Adaptively throttle requests based on current usage
        Returns delay in seconds to add between requests
        """
        stats = self.get_usage_stats()
        usage_pct = stats['usage_percentage']
        
        if usage_pct < 50:
            return 0.0  # No throttling needed
        elif usage_pct < 70:
            return 0.1  # Light throttling
        elif usage_pct < 85:
            return 0.5  # Moderate throttling
        elif usage_pct < 95:
            return 1.0  # Heavy throttling
        else:
            return 2.0  # Maximum throttling
            
            
class BatchRequestOptimizer:
    """
    Optimizes API requests by batching when possible
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.pending_requests = {
            'option_chains': [],
            'greeks': [],
            'quotes': []
        }
        self.batch_size_limits = {
            'option_chains': 10,
            'greeks': 50,
            'quotes': 100
        }
        
    def add_to_batch(self, request_type: str, request_data: Dict):
        """Add request to batch queue"""
        if request_type in self.pending_requests:
            self.pending_requests[request_type].append(request_data)
            
            # Execute if batch is full
            if len(self.pending_requests[request_type]) >= self.batch_size_limits[request_type]:
                return self.execute_batch(request_type)
                
        return None
        
    def execute_batch(self, request_type: str) -> Optional[Dict]:
        """Execute batched requests"""
        if request_type not in self.pending_requests:
            return None
            
        batch = self.pending_requests[request_type]
        if not batch:
            return None
            
        self.algo.Debug(f"[BATCH] Executing {len(batch)} {request_type} requests")
        
        # Execute based on type
        results = {}
        if request_type == 'option_chains':
            results = self._batch_option_chains(batch)
        elif request_type == 'greeks':
            results = self._batch_greeks(batch)
        elif request_type == 'quotes':
            results = self._batch_quotes(batch)
            
        # Clear batch
        self.pending_requests[request_type].clear()
        
        return results
        
    def _batch_option_chains(self, requests: list) -> Dict:
        """Batch option chain requests"""
        results = {}
        
        # Group by underlying
        by_underlying = {}
        for req in requests:
            underlying = req.get('underlying')
            if underlying not in by_underlying:
                by_underlying[underlying] = []
            by_underlying[underlying].append(req)
            
        # Fetch chains for each underlying once
        for underlying, reqs in by_underlying.items():
            # Get the most encompassing parameters
            min_strike = min(r.get('min_strike', 0) for r in reqs)
            max_strike = max(r.get('max_strike', float('inf')) for r in reqs)
            min_expiry = min(r.get('min_expiry', 0) for r in reqs)
            max_expiry = max(r.get('max_expiry', 365) for r in reqs)
            
            # Single API call for all requests
            if hasattr(self.algo, 'option_cache'):
                chain = self.algo.option_cache.get_option_chain(
                    underlying, min_strike, max_strike, min_expiry, max_expiry
                )
                
                # Distribute results
                for req in reqs:
                    req_id = req.get('id')
                    if req_id:
                        results[req_id] = chain
                        
        return results
        
    def _batch_greeks(self, requests: list) -> Dict:
        """Batch Greeks calculations"""
        results = {}
        
        for req in requests:
            symbol = req.get('symbol')
            if symbol and hasattr(self.algo, 'greeks_cache'):
                greeks = self.algo.greeks_cache.get_greeks(symbol)
                req_id = req.get('id')
                if req_id:
                    results[req_id] = greeks
                    
        return results
        
    def _batch_quotes(self, requests: list) -> Dict:
        """Batch quote requests"""
        results = {}
        
        # Get all symbols
        symbols = [r.get('symbol') for r in requests if r.get('symbol')]
        
        # Batch fetch from QuantConnect
        for symbol in symbols:
            if symbol in self.algo.Securities:
                price = float(self.algo.Securities[symbol].Price)
                results[symbol] = price
                
        return results