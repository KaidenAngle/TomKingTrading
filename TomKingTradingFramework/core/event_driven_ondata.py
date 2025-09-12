# region imports
from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Any
from core.event_bus import EventBus, EventType
from core.unified_vix_manager import UnifiedVIXManager
# endregion


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

class EventDrivenOnData:
    """
    PHASE 5 OPTIMIZATION: Event-Driven OnData Implementation
    
    Replaces traditional periodic OnData processing with event-driven architecture
    for 20%+ performance improvement through:
        - Elimination of unnecessary periodic checks
    - Event-triggered updates only when data changes
    - Intelligent batching and filtering
    - Performance monitoring and optimization
    """
    
    def __init__(self, algorithm, event_bus: EventBus, event_optimizer):
        self.algorithm = algorithm
        self.event_bus = event_bus
        self.event_optimizer = event_optimizer
        
        # Performance tracking
        self.ondata_calls = 0
        self.skipped_calls = 0
        self.total_processing_time = 0.0
        self.last_performance_log = algorithm.Time
        
        # Optimization thresholds
        self.min_price_change_pct = 0.001  # 0.1% minimum change to process
        self.batch_size_threshold = 5     # Batch process when >= 5 updates
        self.performance_log_interval = timedelta(minutes=30)
        
        # Data change tracking
        self.last_prices = {}
        self.significant_changes = []
        
        self.algorithm.Debug("[EventDrivenOnData] Initialized event-driven OnData processing")
    
    def process_ondata(self, data) -> Dict[str, Any]:
        """
        Main event-driven OnData processor
        
        Returns performance metrics and optimization results
        """
        
        start_time = datetime.now()
        self.ondata_calls += 1
        
        try:
            optimization_result = self.event_optimizer.optimize_ondata_performance(data)
        except Exception as e:

            # PHASE 5 OPTIMIZATION: Use event-driven optimizer
            
            # Check if processing can be skipped
            if not self._should_process_data(data):
                self.skipped_calls += 1
                optimization_result['optimizations'].append('skipped_entire_ondata')
                return optimization_result
            
            # Extract and filter significant market updates
            market_updates = self._extract_significant_updates(data)
            
            if market_updates:
                # Publish market data events (event-driven)
                self._publish_market_events(market_updates)
            
            # Update system state through events (not direct calls)
            self._trigger_system_updates()
            
            # Performance tracking
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            self.total_processing_time += processing_time
            
            # Log performance periodically
            if (self.algorithm.Time - self.last_performance_log) > self.performance_log_interval:
                self._log_performance_metrics()
                self.last_performance_log = self.algorithm.Time
            
            optimization_result['actual_processing_time_ms'] = processing_time
            return optimization_result
            
        except Exception as e:
            self.algorithm.Error(f"[EventDrivenOnData] Error in OnData processing: {e}")
            return {'error': str(e), 'optimizations': []}
    
    def _should_process_data(self, data) -> bool:
        """Determine if OnData processing is necessary"""
        
        # Always process during warmup
        if self.algorithm.IsWarmingUp:
            return True
        
        # Check for significant data changes
        has_significant_changes = False
        
        for symbol in data.Keys:
            current_price = None
            
            # Extract current price based on data type
            if symbol in data.Bars:
                current_price = data.Bars[symbol].Close
            elif symbol in data.QuoteBars:
                current_price = data.QuoteBars[symbol].Close
            elif symbol in data.Ticks:
                if data.Ticks[symbol]:
                    current_price = data.Ticks[symbol][-1].Price
            
            if current_price is not None:
                symbol_str = str(symbol)
                last_price = self.last_prices.get(symbol_str)
                
                if last_price is not None:
                    change_pct = abs(current_price - last_price) / last_price if last_price > 0 else 0
                    if change_pct >= self.min_price_change_pct:
                        has_significant_changes = True
                        break
                else:
                    # First time seeing this symbol
                    has_significant_changes = True
                
                self.last_prices[symbol_str] = current_price
        
        return has_significant_changes
    
    def _extract_significant_updates(self, data) -> Dict[str, Dict]:
        """Extract significant price updates from data"""
        
        updates = {}
        
        for symbol in data.Keys:
            symbol_str = str(symbol)
            last_price = self.last_prices.get(symbol_str)
            current_price = None
            change_pct = 0
            
            # Extract price based on data type
            if symbol in data.Bars:
                bar = data.Bars[symbol]
                current_price = bar.Close
                volume = bar.Volume if hasattr(bar, 'Volume') else 0
            elif symbol in data.QuoteBars:
                quote = data.QuoteBars[symbol]
                current_price = quote.Close
                volume = quote.LastBidSize + quote.LastAskSize if hasattr(quote, 'LastBidSize') else 0
            elif symbol in data.Ticks:
                if data.Ticks[symbol]:
                    tick = data.Ticks[symbol][-1]
                    current_price = tick.Price
                    volume = getattr(tick, 'Quantity', 0)
            
            if current_price is not None and last_price is not None:
                change_pct = (current_price - last_price) / last_price if last_price > 0 else 0
                
                # Only include if significant change
                if abs(change_pct) >= self.min_price_change_pct:
                    updates[symbol_str] = {
                        'price': current_price,
                        'previous_price': last_price,
                        'change_pct': change_pct,
                        'volume': volume,
                        'timestamp': self.algorithm.Time
                    }
        
        return updates
    
    def _publish_market_events(self, market_updates: Dict[str, Dict]):
        """Publish market data events to event bus"""
        
        for symbol_str, update_data in market_updates.items():
            # Publish general market data event
            self.event_bus.publish_market_data_event(
                symbol_str, 
                update_data['price'],
                update_data['change_pct']
            )
            
            # Publish specific events for significant changes
            change_pct = update_data['change_pct']
            
            # Significant price change event (> 2%)
            if abs(change_pct) > 0.02:
                self.event_bus.publish(
                    EventType.PRICE_CHANGE_SIGNIFICANT,
                    {
                        'symbol': symbol_str,
                        'price': update_data['price'],
                        'change_pct': change_pct,
                        'previous_price': update_data['previous_price']
                    },
                    source="ondata_processor"
                )
            
            # Volatility spike event (> 5%)
            if abs(change_pct) > 0.05:
                self.event_bus.publish(
                    EventType.VOLATILITY_SPIKE,
                    {
                        'symbol': symbol_str,
                        'price': update_data['price'],
                        'spike_magnitude': abs(change_pct),
                        'direction': 'up' if change_pct > 0 else 'down'
                    },
                    source="ondata_processor"
                )
    
    def _trigger_system_updates(self):
        """Trigger system updates through events (not direct method calls)"""
        
        # Instead of calling methods directly, publish events that trigger updates
        # This allows the event-driven architecture to determine what actually needs updating
        
        # Trigger VIX regime check (only if VIX data changed)
        if 'VIX' in [str(s) for s in self.significant_changes]:
            self.event_bus.publish(
                EventType.VIX_REGIME_CHANGE,
                {'trigger': 'vix_data_update'},
                source="ondata_processor"
            )
        
        # Trigger position updates (only if portfolio changed)
        if self._has_portfolio_changes():
            self.event_bus.publish(
                EventType.POSITION_UPDATED,
                {
                    'trigger': 'portfolio_change_detected',
                    'timestamp': self.algorithm.Time
                },
                source="ondata_processor"
            )
    
    def _has_portfolio_changes(self) -> bool:
        """Check if portfolio has changed since last check"""
        
        # Simple heuristic - in a full implementation, this would track actual position changes
        # For now, assume changes if we have positions and significant price movements
        has_positions = any(holding.Invested for holding in self.algorithm.Portfolio.Values)
        has_significant_updates = len(self.significant_changes) > 0
        
        return has_positions and has_significant_updates
    
    def _log_performance_metrics(self):
        """Log comprehensive performance metrics"""
        
        if self.ondata_calls == 0:
            return
        
        avg_processing_time = self.total_processing_time / self.ondata_calls
        skip_rate = (self.skipped_calls / self.ondata_calls) * 100
        
        # Get optimization statistics
        optimizer_stats = self.event_optimizer.get_optimization_statistics()
        
        self.algorithm.Log("=" * 60)
        self.algorithm.Log("[EventDrivenOnData] PERFORMANCE REPORT")
        self.algorithm.Log("-" * 60)
        self.algorithm.Log(f"OnData Calls: {self.ondata_calls}")
        self.algorithm.Log(f"Skipped Calls: {self.skipped_calls} ({skip_rate:.1f}%)")
        self.algorithm.Log(f"Avg Processing Time: {avg_processing_time:.2f}ms")
        self.algorithm.Log(f"Performance Improvement: {optimizer_stats['performance_improvement_pct']:.1f}%")
        self.algorithm.Log(f"Computational Savings: {optimizer_stats['computational_savings_ms']:.1f}ms")
        self.algorithm.Log(f"Target Achievement: {optimizer_stats['target_achievement']['target_achieved']}")
        self.algorithm.Log("=" * 60)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive OnData processing statistics"""
        
        skip_rate = (self.skipped_calls / self.ondata_calls) * 100 if self.ondata_calls > 0 else 0
        avg_processing_time = self.total_processing_time / self.ondata_calls if self.ondata_calls > 0 else 0
        
        optimizer_stats = self.event_optimizer.get_optimization_statistics()
        
        return {
            'ondata_performance': {
                'total_calls': self.ondata_calls,
                'skipped_calls': self.skipped_calls,
                'skip_rate_pct': skip_rate,
                'avg_processing_time_ms': avg_processing_time,
                'total_processing_time_ms': self.total_processing_time
            },
            'optimization_results': optimizer_stats,
            'event_bus_stats': self.event_bus.get_statistics(),
            'performance_targets': {
                'target_improvement_pct': 20.0,
                'actual_improvement_pct': optimizer_stats['performance_improvement_pct'],
                'target_achieved': optimizer_stats['performance_improvement_pct'] >= 20.0
            }
        }