#!/usr/bin/env python3
"""
Comprehensive Market Data Caching System for Tom King Trading Framework
Provides centralized, high-performance caching for major market instruments
"""

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
from core.dependency_container import IManager
from core.event_bus import EventBus, EventType, Event
from dataclasses import dataclass
from core.unified_vix_manager import UnifiedVIXManager

@dataclass

# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class MarketDataPoint:
    """Container for market data with metadata"""
    symbol: str
    price: float
    volume: int
    timestamp: datetime
    bid: float = 0.0
    ask: float = 0.0
    spread: float = 0.0
    change_percent: float = 0.0
    is_stale: bool = False

@dataclass
class MarketConditions:
    """Container for overall market conditions"""
    spy_price: float
    vix_value: float
    qqq_price: float
    market_direction: str  # 'bullish', 'bearish', 'neutral'
    volatility_regime: str  # 'low', 'normal', 'high', 'extreme'
    market_phase: str  # 'pre-market', 'open', 'mid-day', 'close'
    timestamp: datetime

class MarketDataCacheManager(IManager):
    """
    Centralized market data caching for major instruments
    
    Features:
    - Price caching with smart invalidation
    - Market condition assessment
    - Cross-asset correlation tracking
    - Performance monitoring
    - Automatic stale data detection
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Major instruments to cache
        self.major_instruments = ['SPY', 'QQQ', 'VIX', 'IWM', 'TLT', 'GLD', 'DXY']
        
        # UNIFIED INTELLIGENT CACHE: All market data caching consolidated
        # Uses appropriate cache types for different data patterns
        if hasattr(algorithm, 'unified_cache'):
            self.price_cache = algorithm.unified_cache          # MARKET_DATA type
            self.conditions_cache = algorithm.unified_cache     # GENERAL type
            self.correlation_cache = algorithm.unified_cache    # GENERAL type
            self.technical_cache = algorithm.unified_cache      # MARKET_DATA type
        else:
            # Fallback for testing or standalone usage
            self.price_cache = UnifiedIntelligentCache(algorithm, max_size=500, ttl_minutes=0.5 if algorithm.LiveMode else 2)
            self.conditions_cache = self.price_cache
            self.correlation_cache = self.price_cache
            self.technical_cache = self.price_cache
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=30)
        self.last_cache_stats_log = algorithm.Time
        
        # Market condition thresholds
        self.vix_thresholds = {
            'low': 16,
            'normal': 20,
            'high': 25,
            'extreme': 35
        }
        
        # Last known good values for fallback
        self.last_known_prices = {}
        self.data_staleness_threshold = timedelta(minutes=5)
        
        algorithm.Debug("[Market Data Cache] Comprehensive caching system initialized")
    
    def get_price(self, symbol: str) -> Optional[float]:
        """Get current price with caching and fallback logic"""
        
        cache_key = f'price_{symbol}'
        cached_price = self.price_cache.get(
            cache_key,
            lambda: self._fetch_current_price(symbol),
            cache_type=CacheType.MARKET_DATA
        )
        
        if cached_price and cached_price > 0:
            self.last_known_prices[symbol] = cached_price
            return cached_price
        
        # Fallback to last known price if fresh data unavailable
        return self.last_known_prices.get(symbol, None)
    
    def get_market_data_point(self, symbol: str) -> Optional[MarketDataPoint]:
        """Get comprehensive market data point for symbol"""
        
        cache_key = f'data_point_{symbol}'
        cached_data = self.price_cache.get(
            cache_key,
            lambda: self._fetch_market_data_point(symbol),
            cache_type=CacheType.MARKET_DATA
        )
        
        return cached_data
    
    def get_market_conditions(self) -> Optional[MarketConditions]:
        """Get comprehensive market conditions assessment"""
        
        cache_key = f'market_conditions_{self.algo.Time.hour}_{self.algo.Time.minute//5}'  # 5-minute buckets
        
        cached_conditions = self.conditions_cache.get(
            cache_key,
            lambda: self._assess_market_conditions(),
            cache_type=CacheType.GENERAL
        )
        
        return cached_conditions
    
    def get_major_prices(self) -> Dict[str, float]:
        """Get prices for all major instruments efficiently"""
        
        cache_key = 'major_prices'
        cached_prices = self.price_cache.get(
            cache_key,
            lambda: self._fetch_major_prices(),
            cache_type=CacheType.MARKET_DATA
        )
        
        return cached_prices if cached_prices else {}
    
    def get_volatility_regime(self) -> str:
        """Get current volatility regime based on VIX"""
        
        vix_value = self.get_price('VIX')
        if not vix_value:
            return 'unknown'
        
        if vix_value <= self.vix_thresholds['low']:
            return 'low'
        elif vix_value <= self.vix_thresholds['normal']:
            return 'normal' 
        elif vix_value <= self.vix_thresholds['high']:
            return 'high'
        else:
            return 'extreme'
    
    def get_market_direction(self, lookback_minutes: int = 30) -> str:
        """Get market direction based on SPY movement"""
        
        cache_key = f'market_direction_{lookback_minutes}'
        cached_direction = self.conditions_cache.get(
            cache_key,
            lambda: self._calculate_market_direction(lookback_minutes),
            cache_type=CacheType.GENERAL
        )
        
        return cached_direction if cached_direction else 'neutral'
    
    def get_cross_asset_correlation(self, symbol1: str, symbol2: str, lookback_days: int = 20) -> Optional[float]:
        """Get correlation between two assets"""
        
        cache_key = f'correlation_{symbol1}_{symbol2}_{lookback_days}'
        cached_correlation = self.correlation_cache.get(
            cache_key,
            lambda: self._calculate_correlation(symbol1, symbol2, lookback_days),
            cache_type=CacheType.GENERAL
        )
        
        return cached_correlation
    
    def get_relative_strength(self, symbol: str, benchmark: str = 'SPY', lookback_days: int = 20) -> Optional[float]:
        """Get relative strength of symbol vs benchmark"""
        
        cache_key = f'relative_strength_{symbol}_{benchmark}_{lookback_days}'
        cached_rs = self.technical_cache.get(
            cache_key,
            lambda: self._calculate_relative_strength(symbol, benchmark, lookback_days),
            cache_type=CacheType.MARKET_DATA
        )
        
        return cached_rs
    
    def is_data_fresh(self, symbol: str, max_age_minutes: int = 5) -> bool:
        """Check if data for symbol is fresh"""
        
        data_point = self.get_market_data_point(symbol)
        if not data_point:
            return False
        
        age = self.algo.Time - data_point.timestamp
        return age.total_seconds() < (max_age_minutes * 60)
    
    def invalidate_symbol_data(self, symbol: str, reason: str = "manual"):
        """Invalidate all cached data for a specific symbol"""
        
        try:
            self.price_cache.invalidate_pattern(f'price_{symbol}')
        self.price_cache.invalidate_pattern(f'data_point_{symbol}')
        except Exception as e:

            # Invalidate price and data point caches
            
            # Invalidate technical indicators
            self.technical_cache.invalidate_pattern(symbol)
            
            # Invalidate correlations involving this symbol
            self.correlation_cache.invalidate_pattern(symbol)
            
            self.algo.Debug(f"[Market Data Cache] Invalidated all data for {symbol}. Reason: {reason}")
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error invalidating {symbol}: {e}")
    
    def warm_up_cache(self):
        """Pre-populate cache with major instrument data"""
        
        try:
        
            pass
        except Exception as e:

            self.algo.Debug("[Market Data Cache] Warming up cache...")
            
            # Pre-fetch major prices
            major_prices = self.get_major_prices()
            
            # Pre-fetch market conditions
            conditions = self.get_market_conditions()
            
            # Pre-calculate key correlations
            for symbol in ['QQQ', 'IWM', 'TLT']:
                if symbol in major_prices:
                    self.get_cross_asset_correlation('SPY', symbol)
            
            self.algo.Debug(f"[Market Data Cache] Cache warmed up with {len(major_prices)} instruments")
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error warming up cache: {e}")
    
    def periodic_maintenance(self):
        """Run periodic cache maintenance and statistics"""
        
        current_time = self.algo.Time
        
        # Run cache maintenance
        self.price_cache.periodic_maintenance()
        self.conditions_cache.periodic_maintenance()
        self.correlation_cache.periodic_maintenance()
        self.technical_cache.periodic_maintenance()
        
        # Log statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_comprehensive_statistics()
            self.last_cache_stats_log = current_time
    
    def _fetch_current_price(self, symbol: str) -> Optional[float]:
        """Fetch current price from QuantConnect API"""
        
        try:
        
            pass
        except Exception as e:

            if symbol in self.algo.Securities:
                price = self.algo.Securities[symbol].Price
                return price if price > 0 else None
            else:
                # Try to get from current slice
                if hasattr(self.algo, 'CurrentSlice') and self.algo.CurrentSlice:
                    if symbol in self.algo.CurrentSlice.Bars:
                        return float(self.algo.CurrentSlice.Bars[symbol].Close)
                
                return None
                
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error fetching price for {symbol}: {e}")
            return None
    
    def _fetch_market_data_point(self, symbol: str) -> Optional[MarketDataPoint]:
        """Fetch comprehensive market data point"""
        
        try:
        
            pass
        except Exception as e:

            if symbol not in self.algo.Securities:
                return None
            
            security = self.algo.Securities[symbol]
            price = security.Price
            
            if price <= 0:
                return None
            
            # Calculate spread and other metrics
            bid = getattr(security, 'BidPrice', price * 0.999)
            ask = getattr(security, 'AskPrice', price * 1.001)
            spread = ask - bid
            
            # Calculate change percentage if we have historical data
            change_percent = 0.0
            try:
                pass
            except Exception as e:

                if hasattr(self.algo, 'History'):
                    hist = self.algo.History([symbol], 1, Resolution.Daily)
                    if not hist.empty:
                        prev_close = hist['close'].iloc[-1]
                        change_percent = (price - prev_close) / prev_close
            except (KeyError, IndexError, AttributeError, ZeroDivisionError) as e:
                # Don't fail for missing historical data or calculation errors
                self.algo.Debug(f"[Market Data Cache] Failed to calculate change for {symbol}: {e}")
                pass
            
            return MarketDataPoint(
                symbol=symbol,
                price=price,
                volume=getattr(security, 'Volume', 0),
                timestamp=self.algo.Time,
                bid=bid,
                ask=ask,
                spread=spread,
                change_percent=change_percent,
                is_stale=False
            )
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error fetching data point for {symbol}: {e}")
            return None
    
    def _fetch_major_prices(self) -> Dict[str, float]:
        """Fetch prices for all major instruments"""
        
        prices = {}
        for symbol in self.major_instruments:
            price = self._fetch_current_price(symbol)
            if price:
                prices[symbol] = price
        
        return prices
    
    def _assess_market_conditions(self) -> Optional[MarketConditions]:
        """Assess comprehensive market conditions"""
        
        try:
            spy_price = self.get_price('SPY')
        vix_value = self.get_price('VIX')
        qqq_price = self.get_price('QQQ')
        except Exception as e:

            # Get key prices
            
            if not all([spy_price, vix_value, qqq_price]):
                return None
            
            # Determine market direction
            market_direction = self.get_market_direction(30)
            
            # Determine volatility regime
            volatility_regime = self.get_volatility_regime()
            
            # Determine market phase based on time
            current_time = self.algo.Time.time()
            if current_time < time(9, 30):
                market_phase = 'pre-market'
            elif current_time < time(11, 0):
                market_phase = 'open'
            elif current_time < time(15, 0):
                market_phase = 'mid-day'
            else:
                market_phase = 'close'
            
            return MarketConditions(
                spy_price=spy_price,
                vix_value=vix_value,
                qqq_price=qqq_price,
                market_direction=market_direction,
                volatility_regime=volatility_regime,
                market_phase=market_phase,
                timestamp=self.algo.Time
            )
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error assessing market conditions: {e}")
            return None
    
    def _calculate_market_direction(self, lookback_minutes: int) -> str:
        """Calculate market direction based on SPY movement"""
        
        try:
        
            pass
        except Exception as e:

            current_price = self.get_price('SPY')
            if not current_price:
                return 'neutral'
            
            # Get historical data
            end_time = self.algo.Time
            start_time = end_time - timedelta(minutes=lookback_minutes)
            
            hist = self.algo.History(['SPY'], start_time, end_time, Resolution.Minute)
            if hist.empty or len(hist) < 5:
                return 'neutral'
            
            # Calculate percentage change
            start_price = hist['close'].iloc[0]
            change_percent = (current_price - start_price) / start_price
            
            if change_percent > 0.002:  # > 0.2%
                return 'bullish'
            elif change_percent < -0.002:  # < -0.2%
                return 'bearish'
            else:
                return 'neutral'
                
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error calculating market direction: {e}")
            return 'neutral'
    
    def _calculate_correlation(self, symbol1: str, symbol2: str, lookback_days: int) -> Optional[float]:
        """Calculate correlation between two assets"""
        
        try:
            end_time = self.algo.Time
        start_time = end_time - timedelta(days=lookback_days)
        except Exception as e:

            # Get historical data
            
            hist = self.algo.History([symbol1, symbol2], start_time, end_time, Resolution.Daily)
            
            if hist.empty or len(hist) < 10:  # Need at least 10 days
                return None
            
            # Calculate returns
            prices1 = hist.loc[symbol1]['close'] if symbol1 in hist.index.levels[0] else None
            prices2 = hist.loc[symbol2]['close'] if symbol2 in hist.index.levels[0] else None
            
            if prices1 is None or prices2 is None or len(prices1) < 10:
                return None
            
            returns1 = prices1.pct_change().dropna()
            returns2 = prices2.pct_change().dropna()
            
            # Calculate correlation
            if len(returns1) >= 10 and len(returns2) >= 10:
                correlation = returns1.corr(returns2)
                return float(correlation) if not pd.isna(correlation) else None
            
            return None
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error calculating correlation {symbol1}/{symbol2}: {e}")
            return None
    
    def _calculate_relative_strength(self, symbol: str, benchmark: str, lookback_days: int) -> Optional[float]:
        """Calculate relative strength vs benchmark"""
        
        try:
            symbol_price = self.get_price(symbol)
        benchmark_price = self.get_price(benchmark)
        except Exception as e:

            # Get current prices
            
            if not symbol_price or not benchmark_price:
                return None
            
            # Get historical data
            end_time = self.algo.Time
            start_time = end_time - timedelta(days=lookback_days)
            
            hist = self.algo.History([symbol, benchmark], start_time, end_time, Resolution.Daily)
            
            if hist.empty or len(hist) < 5:
                return None
            
            # Calculate performance
            symbol_start = hist.loc[symbol]['close'].iloc[0] if symbol in hist.index.levels[0] else None
            benchmark_start = hist.loc[benchmark]['close'].iloc[0] if benchmark in hist.index.levels[0] else None
            
            if not symbol_start or not benchmark_start:
                return None
            
            symbol_performance = (symbol_price - symbol_start) / symbol_start
            benchmark_performance = (benchmark_price - benchmark_start) / benchmark_start
            
            # Relative strength = symbol performance - benchmark performance
            relative_strength = symbol_performance - benchmark_performance
            return float(relative_strength)
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error calculating relative strength {symbol}/{benchmark}: {e}")
            return None
    
    def _log_comprehensive_statistics(self):
        """Log comprehensive cache statistics"""
        
        try:
        
            pass
        except Exception as e:

            price_stats = self.price_cache.get_statistics()
            conditions_stats = self.conditions_cache.get_statistics()
            correlation_stats = self.correlation_cache.get_statistics()
            technical_stats = self.technical_cache.get_statistics()
            
            total_memory = (
                price_stats['memory_usage_mb'] +
                conditions_stats['memory_usage_mb'] +
                correlation_stats['memory_usage_mb'] +
                technical_stats['memory_usage_mb']
            )
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[Market Data Cache] "
                    f"Price Hit Rate: {price_stats['hit_rate']:.1%} | "
                    f"Conditions Hit Rate: {conditions_stats['hit_rate']:.1%} | "
                    f"Correlation Hit Rate: {correlation_stats['hit_rate']:.1%} | "
                    f"Technical Hit Rate: {technical_stats['hit_rate']:.1%} | "
                    f"Total Memory: {total_memory:.1f}MB"
                )
            
            # Performance warnings
            overall_hit_rate = (
                price_stats['hit_rate'] +
                conditions_stats['hit_rate'] +
                correlation_stats['hit_rate'] +
                technical_stats['hit_rate']
            ) / 4
            
            if overall_hit_rate < 0.4:  # Less than 40% overall hit rate
                self.algo.Log(f"[Performance Warning] Market data cache overall hit rate low: {overall_hit_rate:.1%}")
            
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error logging statistics: {e}")
    
    def get_comprehensive_statistics(self) -> Dict:
        """Get comprehensive statistics for all caches"""
        
        try:
        
            pass
        except Exception as e:

            return {
                'price_cache': self.price_cache.get_statistics(),
                'conditions_cache': self.conditions_cache.get_statistics(),
                'correlation_cache': self.correlation_cache.get_statistics(),
                'technical_cache': self.technical_cache.get_statistics(),
                'total_memory_mb': (
                    self.price_cache.get_statistics()['memory_usage_mb'] +
                    self.conditions_cache.get_statistics()['memory_usage_mb'] +
                    self.correlation_cache.get_statistics()['memory_usage_mb'] +
                    self.technical_cache.get_statistics()['memory_usage_mb']
                ),
                'cached_instruments': len(self.last_known_prices),
                'major_instruments': self.major_instruments
            }
        except Exception as e:
            self.algo.Error(f"[Market Data Cache] Error getting comprehensive statistics: {e}")
            return {}
    
    def invalidate_all_caches(self, reason: str = "manual"):
        """Invalidate all market data caches"""
        
        try:
        
            pass
        except Exception as e:

            price_count = self.price_cache.invalidate_all()
            conditions_count = self.conditions_cache.invalidate_all()
            correlation_count = self.correlation_cache.invalidate_all()
            technical_count = self.technical_cache.invalidate_all()
            
            self.algo.Debug(
                f"[Market Data Cache] Invalidated all caches: "
                f"{price_count} price + {conditions_count} conditions + "
                f"{correlation_count} correlation + {technical_count} technical. "
                f"Reason: {reason}"
            )
            
        except Exception as e:
            self.algo.Error(f"[Market Data Cache] Error invalidating all caches: {e}")
    
    # IManager interface implementation
    def handle_event(self, event: Event) -> bool:
        """Handle incoming events from the event bus"""
        try:
            if event.event_type == EventType.PORTFOLIO_UPDATE:
                # Update market conditions based on portfolio changes
        self._update_market_conditions_from_portfolio(event.data)
        return True
        elif event.event_type == EventType.POSITION_OPENED or event.event_type == EventType.POSITION_CLOSED:
            # Cache market data for instruments involved in trades
        if 'symbol' in event.data:
            symbol = event.data['symbol']
        self._preload_symbol_data(symbol)
        return True
        except Exception as e:

            # Handle market data related events
            
            return False
        except Exception as e:
            self.algo.Error(f"[Market Data Cache] Error handling event {event.event_type}: {e}")
            return False
    
    def get_dependencies(self) -> List[str]:
        """Return list of manager names this manager depends on"""
        return ['event_bus']  # Cache manager only needs event bus
    
    def can_initialize_without_dependencies(self) -> bool:
        """Return True if this manager can initialize before its dependencies are ready"""
        return True  # Cache manager can initialize independently
    
    def get_manager_name(self) -> str:
        """Return unique name for this manager"""
        return "cache_manager"
    
    def _update_market_conditions_from_portfolio(self, data: Dict[str, Any]):
        """Update market conditions based on portfolio changes"""
        # Trigger market conditions refresh when portfolio changes significantly
        if 'portfolio_value' in data:
            try:
                pass
            except Exception as e:

                self.conditions_cache.invalidate_all()  # Force fresh market conditions
            except Exception as e:
                self.algo.Error(f"[Market Data Cache] Error updating conditions from portfolio: {e}")
    
    def _preload_symbol_data(self, symbol: str):
        """Preload market data for a specific symbol"""
        try:
            self.get_current_price(symbol)
        self.get_market_data_point(symbol)
        except Exception as e:
            self.algo.Debug(f"[Market Data Cache] Error preloading data for {symbol}: {e}")
        except Exception as e:

            # Preload current price and market data for the symbol