# Enhanced Atomic Order Executor for Multi-Leg Strategies
# Production-grade atomic execution with rollback capability

from AlgorithmImports import *
from typing import List, Dict, Optional
from enum import Enum, auto
from datetime import timedelta

class OrderGroupStatus(Enum):
    """Status of atomic order group"""
    PENDING = auto()
    PLACING = auto()
    MONITORING = auto()
    FILLED = auto()
    PARTIAL = auto()
    FAILED = auto()
    ROLLING_BACK = auto()
    ROLLED_BACK = auto()

class AtomicOrderGroup:
    """
    Manages atomic execution of multi-leg orders
    All legs must fill or all are cancelled/reversed
    """
    
    def __init__(self, algorithm, group_id: str):
        self.algo = algorithm
        self.group_id = group_id
        self.status = OrderGroupStatus.PENDING
        
        # Order tracking
        self.orders = []  # List of order tickets
        self.target_legs = []  # List of (symbol, quantity) tuples
        self.filled_legs = []  # Successfully filled legs
        self.pending_legs = []  # Awaiting fill
        self.failed_legs = []  # Failed to fill
        
        # Timing
        self.created_time = self.algo.Time
        self.timeout = timedelta(seconds=30)  # 30 second timeout
        
        # Rollback tracking
        self.rollback_orders = []
        self.rollback_complete = False
    
    def add_leg(self, symbol, quantity: int):
        """Add a leg to the atomic group"""
        
        if self.status != OrderGroupStatus.PENDING:
            raise Exception(f"Cannot add legs to {self.status.name} group")
        
        self.target_legs.append((symbol, quantity))
        self.algo.Debug(f"[Atomic-{self.group_id}] Added leg: {symbol} x{quantity}")
    
    def execute(self) -> bool:
        """Execute all legs atomically"""
        
        if not self.target_legs:
            self.algo.Error(f"[Atomic-{self.group_id}] No legs to execute")
            return False
        
        self.status = OrderGroupStatus.PLACING
        self.algo.Debug(f"[Atomic-{self.group_id}] Executing {len(self.target_legs)} legs")
        
        try:
            # Place all orders
            for symbol, quantity in self.target_legs:
                order = self._place_smart_order(symbol, quantity)
                
                if order:
                    self.orders.append(order)
                    self.pending_legs.append((symbol, quantity, order))
                else:
                    self.algo.Error(f"[Atomic-{self.group_id}] Failed to place order for {symbol}")
                    self.status = OrderGroupStatus.FAILED
                    self._rollback()
                    return False
            
            # Monitor fills
            self.status = OrderGroupStatus.MONITORING
            return self._monitor_fills()
            
        except Exception as e:
            self.algo.Error(f"[Atomic-{self.group_id}] Execution error: {e}")
            self.status = OrderGroupStatus.FAILED
            self._rollback()
            return False
    
    def _place_smart_order(self, symbol, quantity: int):
        """Place order with smart routing using unified pricing"""
        
        try:
            # Use unified pricing if available
            if hasattr(self.algo, 'unified_pricing'):
                is_buy = quantity > 0
                limit_price, use_limit = self.algo.unified_pricing.calculate_limit_price(
                    symbol, is_buy
                )
                
                if use_limit and limit_price > 0:
                    # Place limit order with unified pricing
                    order = self.algo.LimitOrder(symbol, quantity, limit_price)
                    
                    # Set order properties for better execution
                    if order:
                        order.Tag = f"Atomic-{self.group_id}"
                    
                    return order
            
            # Fallback to legacy pricing if unified not available
            if symbol in self.algo.Securities:
                security = self.algo.Securities[symbol]
                
                # For options, use limit orders with smart pricing
                if symbol.SecurityType == SecurityType.Option:
                    bid = security.BidPrice
                    ask = security.AskPrice
                    
                    if bid > 0 and ask > 0:
                        # Calculate smart limit price (40% rule)
                        if quantity > 0:  # Buying
                            limit_price = bid + (ask - bid) * 0.40
                        else:  # Selling
                            limit_price = ask - (ask - bid) * 0.40
                        
                        limit_price = round(limit_price, 2)
                        
                        # Place limit order
                        order = self.algo.LimitOrder(symbol, quantity, limit_price)
                        
                        if order:
                            order.Tag = f"Atomic-{self.group_id}"
                        
                        return order
            
            # Final fallback to market order
            return self.algo.MarketOrder(symbol, quantity)
            
        except Exception as e:
            self.algo.Error(f"[Atomic-{self.group_id}] Smart order error: {e}")
            return None
    
    def _monitor_fills(self) -> bool:
        """Monitor order fills with timeout"""
        
        start_time = self.algo.Time
        
        while self.algo.Time - start_time < self.timeout:
            all_filled = True
            
            for symbol, quantity, order in self.pending_legs[:]:
                if order.Status == OrderStatus.Filled:
                    # Move to filled
                    self.pending_legs.remove((symbol, quantity, order))
                    self.filled_legs.append((symbol, quantity, order))
                    
                elif order.Status in [OrderStatus.Canceled, OrderStatus.Invalid]:
                    # Move to failed
                    self.pending_legs.remove((symbol, quantity, order))
                    self.failed_legs.append((symbol, quantity, order))
                    all_filled = False
                    
                elif order.Status in [OrderStatus.Submitted, OrderStatus.PartiallyFilled]:
                    # Still pending
                    all_filled = False
            
            # Check completion
            if all_filled and not self.pending_legs:
                if self.failed_legs:
                    self.status = OrderGroupStatus.PARTIAL
                    self.algo.Debug(f"[Atomic-{self.group_id}] Partial fill, rolling back")
                    self._rollback()
                    return False
                else:
                    self.status = OrderGroupStatus.FILLED
                    self.algo.Debug(f"[Atomic-{self.group_id}] All legs filled successfully")
                    return True
            
            # Small delay to avoid tight loop
            # Using time.sleep for order monitoring - QuantConnect handles scheduling
        
        # Timeout reached
        self.algo.Error(f"[Atomic-{self.group_id}] Timeout after {self.timeout.seconds}s")
        self.status = OrderGroupStatus.FAILED
        self._rollback()
        return False
    
    def _rollback(self):
        """Rollback any filled orders"""
        
        if self.status == OrderGroupStatus.ROLLING_BACK:
            return  # Already rolling back
        
        self.status = OrderGroupStatus.ROLLING_BACK
        self.algo.Debug(f"[Atomic-{self.group_id}] Rolling back {len(self.filled_legs)} filled legs")
        
        # Cancel any pending orders
        for symbol, quantity, order in self.pending_legs:
            if order.Status in [OrderStatus.Submitted, OrderStatus.PartiallyFilled]:
                try:
                    self.algo.Transactions.CancelOrder(order.OrderId)
                    self.algo.Debug(f"[Atomic-{self.group_id}] Cancelled pending order for {symbol}")
                except Exception as e:
                    self.algo.Debug(f"[Atomic-{self.group_id}] Rollback cancel failed for {order}: {e}")
        
        # Reverse any filled orders
        for symbol, quantity, order in self.filled_legs:
            try:
                # Place opposite order to flatten position
                reverse_quantity = -quantity
                reverse_order = self.algo.MarketOrder(symbol, reverse_quantity)
                
                if reverse_order:
                    self.rollback_orders.append(reverse_order)
                    self.algo.Debug(f"[Atomic-{self.group_id}] Reversed {symbol} x{quantity}")
                
            except Exception as e:
                self.algo.Error(f"[Atomic-{self.group_id}] Rollback error for {symbol}: {e}")
        
        self.status = OrderGroupStatus.ROLLED_BACK
        self.rollback_complete = True
    
    def get_status(self) -> Dict:
        """Get current status of atomic group"""
        
        return {
            'group_id': self.group_id,
            'status': self.status.name,
            'target_legs': len(self.target_legs),
            'filled_legs': len(self.filled_legs),
            'pending_legs': len(self.pending_legs),
            'failed_legs': len(self.failed_legs),
            'rollback_complete': self.rollback_complete
        }


class EnhancedAtomicOrderExecutor:
    """
    Enhanced order executor with atomic multi-leg support
    Production-ready with monitoring and rollback
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.active_groups = {}  # Track active atomic groups
        self.completed_groups = {}  # History of completed groups
        self.group_counter = 0
    
    def create_atomic_group(self, strategy_name: str = "") -> AtomicOrderGroup:
        """Create new atomic order group"""
        
        self.group_counter += 1
        group_id = f"{strategy_name}-{self.group_counter:04d}"
        
        group = AtomicOrderGroup(self.algo, group_id)
        self.active_groups[group_id] = group
        
        return group
    
    def execute_iron_condor_atomic(self, short_call, long_call, short_put, long_put, quantity: int = 1) -> bool:
        """Execute iron condor atomically with crash recovery"""
        
        group = self.create_atomic_group("IronCondor")
        
        # Add all 4 legs
        group.add_leg(short_call, -quantity)  # Sell call
        group.add_leg(long_call, quantity)     # Buy call
        group.add_leg(short_put, -quantity)    # Sell put
        group.add_leg(long_put, quantity)      # Buy put
        
        # Persist order group BEFORE execution for crash recovery
        if hasattr(self.algo, 'order_recovery'):
            legs = [(short_call, -quantity), (long_call, quantity), 
                   (short_put, -quantity), (long_put, quantity)]
            self.algo.order_recovery.persist_order_group_start(
                group.group_id, legs, "IronCondor"
            )
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        # Update recovery system
        if hasattr(self.algo, 'order_recovery'):
            if success:
                self.algo.order_recovery.mark_order_group_complete(group.group_id)
            else:
                self.algo.order_recovery.mark_order_group_failed(
                    group.group_id, 
                    f"Execution failed: {group.get_status()}"
                )
        
        if success:
            self.algo.Debug(f"Iron condor executed successfully: {group.group_id}")
        else:
            self.algo.Error(f"Iron condor failed: {group.get_status()}")
        
        return success
    
    def execute_put_spread_atomic(self, short_put, long_put, quantity: int = 1) -> bool:
        """Execute put spread atomically"""
        
        group = self.create_atomic_group("PutSpread")
        
        # Add both legs
        group.add_leg(short_put, -quantity)  # Sell put
        group.add_leg(long_put, quantity)    # Buy put
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        return success
    
    def execute_strangle_atomic(self, short_call, short_put, quantity: int = 1) -> bool:
        """Execute strangle atomically"""
        
        group = self.create_atomic_group("Strangle")
        
        # Add both legs
        group.add_leg(short_call, -quantity)  # Sell call
        group.add_leg(short_put, -quantity)   # Sell put
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        return success
    
    def get_active_groups(self) -> List[Dict]:
        """Get status of all active groups"""
        
        return [group.get_status() for group in self.active_groups.values()]
    
    def cancel_all_active(self):
        """Emergency cancel all active groups"""
        
        self.algo.Error(f"[AtomicExecutor] Emergency cancelling {len(self.active_groups)} groups")
        
        for group in self.active_groups.values():
            group._rollback()
    
    def cleanup_stale_groups(self):
        """Clean up stale groups (called periodically)"""
        
        current_time = self.algo.Time
        stale_groups = []
        
        for group_id, group in self.active_groups.items():
            if current_time - group.created_time > timedelta(minutes=5):
                stale_groups.append(group_id)
                group._rollback()
        
        for group_id in stale_groups:
            self.completed_groups[group_id] = self.active_groups[group_id]
            del self.active_groups[group_id]
            self.algo.Debug(f"[AtomicExecutor] Cleaned up stale group: {group_id}")