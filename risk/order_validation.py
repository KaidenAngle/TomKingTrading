# Order Fill Validation System
# Critical for multi-leg strategies (iron condors, strangles, etc.)

from AlgorithmImports import *
from typing import List, Dict, Tuple
import time

class OrderValidationSystem:
    """
    Validates order fills for multi-leg strategies
    Handles partial fills, rejections, and incomplete positions
    CRITICAL: Prevents naked positions from incomplete fills
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Order tracking
        self.pending_orders = {}  # order_id -> order details
        self.multi_leg_orders = {}  # group_id -> list of order_ids
        self.failed_orders = []
        
        # Configuration
        self.max_retry_attempts = 3
        self.retry_delay_seconds = 2
        self.max_fill_time_seconds = 30
        self.partial_fill_threshold = 0.5  # Accept if 50%+ filled
        
        # Validation settings
        self.max_spread_percent = 0.10  # Max 10% bid-ask spread
        self.max_slippage_percent = 0.02  # Max 2% slippage from expected
        self.min_volume_required = 10  # Minimum contracts volume
        
        # Safety controls
        self.abort_on_partial = True  # Abort entire strategy if partial fill
        self.require_all_legs = True  # All legs must fill for multi-leg
        
        self.algorithm.Log("[WARNING] ORDER VALIDATION SYSTEM INITIALIZED")
    
    def validate_pre_order(self, symbol, order_type='LIMIT') -> Tuple[bool, str]:
        """
        Validate market conditions before placing order
        Returns: (is_valid, reason)
        """
        try:
            security = self.algorithm.Securities.get(symbol)
            if not security:
                return False, "Symbol not found"
            
            # Check if market is open
            if not self.algorithm.IsMarketOpen(symbol):
                return False, "Market closed"
            
            # Check bid-ask spread
            if security.BidPrice > 0 and security.AskPrice > 0:
                spread = (security.AskPrice - security.BidPrice) / security.BidPrice
                if spread > self.max_spread_percent:
                    return False, f"Spread too wide: {spread:.2%}"
            
            # Check volume for options
            if security.Type == SecurityType.Option:
                if hasattr(security, 'Volume') and security.Volume < self.min_volume_required:
                    return False, f"Low volume: {security.Volume}"
            
            # Check for stale data
            if hasattr(security, 'LastUpdate'):
                time_since_update = (self.algorithm.Time - security.LastUpdate).seconds
                if time_since_update > 60:
                    return False, f"Stale data: {time_since_update}s old"
            
            return True, "Valid"
            
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    def place_multi_leg_order(self, legs: List[Dict], strategy_name: str) -> bool:
        """
        Place multi-leg order with validation and tracking
        
        legs format: [
            {'symbol': Symbol, 'quantity': int, 'order_type': 'LIMIT/MARKET', 'limit_price': float},
            ...
        ]
        """
        group_id = f"{strategy_name}_{self.algorithm.Time.timestamp()}"
        order_ids = []
        
        # Pre-validate all legs
        for leg in legs:
            is_valid, reason = self.validate_pre_order(leg['symbol'])
            if not is_valid:
                self.algorithm.Error(f"Pre-order validation failed for {leg['symbol']}: {reason}")
                return False
        
        # Place all legs
        for i, leg in enumerate(legs):
            try:
                if leg.get('order_type') == 'MARKET':
                    order = self.algorithm.MarketOrder(
                        leg['symbol'], 
                        leg['quantity'],
                        asynchronous=False  # Wait for fill
                    )
                else:
                    limit_price = leg.get('limit_price', 0)
                    if limit_price <= 0:
                        # Calculate limit from bid/ask
                        limit_price = self.calculate_limit_price(leg['symbol'], leg['quantity'])
                    
                    order = self.algorithm.LimitOrder(
                        leg['symbol'],
                        leg['quantity'],
                        limit_price,
                        asynchronous=False
                    )
                
                if order:
                    order_ids.append(order.OrderId)
                    self.pending_orders[order.OrderId] = {
                        'symbol': leg['symbol'],
                        'quantity': leg['quantity'],
                        'group_id': group_id,
                        'leg_index': i,
                        'strategy': strategy_name,
                        'submit_time': self.algorithm.Time,
                        'expected_price': limit_price if leg.get('order_type') != 'MARKET' else None
                    }
                else:
                    self.algorithm.Error(f"Failed to place order for leg {i}: {leg['symbol']}")
                    # Cancel all previous legs if one fails
                    self.cancel_multi_leg_group(group_id)
                    return False
                    
            except Exception as e:
                self.algorithm.Error(f"Error placing leg {i}: {str(e)}")
                self.cancel_multi_leg_group(group_id)
                return False
        
        # Track multi-leg group
        self.multi_leg_orders[group_id] = order_ids
        
        # Validate fills
        return self.validate_multi_leg_fills(group_id)
    
    def validate_multi_leg_fills(self, group_id: str, timeout_seconds: int = None) -> bool:
        """
        Validate all legs of multi-leg order filled correctly
        """
        if timeout_seconds is None:
            timeout_seconds = self.max_fill_time_seconds
        
        order_ids = self.multi_leg_orders.get(group_id, [])
        if not order_ids:
            return False
        
        start_time = self.algorithm.Time
        all_filled = False
        partial_fills = []
        
        while (self.algorithm.Time - start_time).seconds < timeout_seconds:
            filled_count = 0
            
            for order_id in order_ids:
                order = self.algorithm.Transactions.GetOrderById(order_id)
                
                if not order:
                    continue
                
                if order.Status == OrderStatus.Filled:
                    filled_count += 1
                    # Validate fill price
                    self.validate_fill_price(order_id, order)
                    
                elif order.Status == OrderStatus.PartiallyFilled:
                    partial_fills.append(order_id)
                    
                elif order.Status in [OrderStatus.Canceled, OrderStatus.Invalid]:
                    self.algorithm.Error(f"Order {order_id} failed: {order.Status}")
                    # Abort entire multi-leg
                    if self.require_all_legs:
                        self.handle_failed_multi_leg(group_id, f"Leg {order_id} failed")
                        return False
            
            # Check if all filled
            if filled_count == len(order_ids):
                all_filled = True
                break
            
            # Handle partial fills
            if partial_fills and self.abort_on_partial:
                self.handle_partial_multi_leg(group_id, partial_fills)
                return False
            
            # Small delay before rechecking
            time.sleep(0.5)
        
        if all_filled:
            self.algorithm.Log(f"[WARNING] Multi-leg order {group_id} fully filled")
            return True
        else:
            self.handle_failed_multi_leg(group_id, "Timeout waiting for fills")
            return False
    
    def validate_fill_price(self, order_id: int, order) -> bool:
        """Validate fill price is within acceptable range"""
        order_info = self.pending_orders.get(order_id)
        if not order_info or not order_info.get('expected_price'):
            return True
        
        expected = order_info['expected_price']
        actual = order.AverageFillPrice
        
        if expected > 0:
            slippage = abs(actual - expected) / expected
            if slippage > self.max_slippage_percent:
                self.algorithm.Log(f"[WARNING] High slippage on {order_info['symbol']}: {slippage:.2%}")
                # Don't abort, just warn
        
        return True
    
    def handle_failed_multi_leg(self, group_id: str, reason: str):
        """Handle failed multi-leg order - close any filled legs"""
        self.algorithm.Error(f"[WARNING] Multi-leg order {group_id} failed: {reason}")
        
        order_ids = self.multi_leg_orders.get(group_id, [])
        filled_legs = []
        
        # Find which legs filled
        for order_id in order_ids:
            order = self.algorithm.Transactions.GetOrderById(order_id)
            if order and order.Status == OrderStatus.Filled:
                filled_legs.append(order)
        
        # Close filled legs to avoid naked positions
        for order in filled_legs:
            self.algorithm.Log(f"   Closing orphaned leg: {order.Symbol}")
            # Reverse the position
            reverse_quantity = -order.Quantity
            self.algorithm.MarketOrder(order.Symbol, reverse_quantity)
        
        # Record failure
        self.failed_orders.append({
            'group_id': group_id,
            'reason': reason,
            'time': self.algorithm.Time,
            'filled_legs': len(filled_legs),
            'total_legs': len(order_ids)
        })
    
    def handle_partial_multi_leg(self, group_id: str, partial_order_ids: List[int]):
        """Handle partially filled multi-leg order"""
        self.algorithm.Error(f"[WARNING] Partial fills on multi-leg {group_id}")
        
        if self.abort_on_partial:
            # Cancel remaining orders
            for order_id in partial_order_ids:
                self.algorithm.Transactions.CancelOrder(order_id)
            
            # Close any filled portions
            self.handle_failed_multi_leg(group_id, "Partial fills not accepted")
        else:
            # Try to complete partial fills
            for order_id in partial_order_ids:
                order = self.algorithm.Transactions.GetOrderById(order_id)
                if order:
                    filled_ratio = order.QuantityFilled / order.Quantity
                    if filled_ratio >= self.partial_fill_threshold:
                        self.algorithm.Log(f"   Accepting {filled_ratio:.0%} fill on {order.Symbol}")
                    else:
                        # Cancel and retry
                        self.retry_failed_order(order_id)
    
    def retry_failed_order(self, order_id: int, attempt: int = 1):
        """Retry a failed or partial order"""
        if attempt > self.max_retry_attempts:
            self.algorithm.Error(f"Max retries exceeded for order {order_id}")
            return False
        
        order_info = self.pending_orders.get(order_id)
        if not order_info:
            return False
        
        # Cancel existing order
        self.algorithm.Transactions.CancelOrder(order_id)
        
        # Wait before retry
        time.sleep(self.retry_delay_seconds)
        
        # Recalculate price and retry
        new_limit = self.calculate_limit_price(
            order_info['symbol'], 
            order_info['quantity']
        )
        
        new_order = self.algorithm.LimitOrder(
            order_info['symbol'],
            order_info['quantity'],
            new_limit
        )
        
        if new_order:
            self.algorithm.Log(f"   Retry {attempt} for {order_info['symbol']}")
            # Update tracking
            self.pending_orders[new_order.OrderId] = order_info
            return True
        
        return False
    
    def calculate_limit_price(self, symbol, quantity: int) -> float:
        """Calculate appropriate limit price based on bid/ask"""
        security = self.algorithm.Securities.get(symbol)
        if not security:
            return 0
        
        bid = security.BidPrice
        ask = security.AskPrice
        
        if bid <= 0 or ask <= 0:
            return 0
        
        # For buying (positive quantity), use slightly above mid
        # For selling (negative quantity), use slightly below mid
        mid = (bid + ask) / 2
        
        if quantity > 0:  # Buying
            return mid * 1.01  # 1% above mid
        else:  # Selling
            return mid * 0.99  # 1% below mid
    
    def cancel_multi_leg_group(self, group_id: str):
        """Cancel all orders in a multi-leg group"""
        order_ids = self.multi_leg_orders.get(group_id, [])
        
        for order_id in order_ids:
            try:
                self.algorithm.Transactions.CancelOrder(order_id)
                self.algorithm.Log(f"   Cancelled order {order_id}")
            except:
                pass  # Order may already be filled/cancelled
    
    def get_validation_stats(self) -> Dict:
        """Get order validation statistics"""
        total_groups = len(self.multi_leg_orders)
        failed_groups = len(self.failed_orders)
        
        success_rate = ((total_groups - failed_groups) / total_groups * 100) if total_groups > 0 else 0
        
        return {
            'total_multi_leg_orders': total_groups,
            'failed_orders': failed_groups,
            'success_rate': success_rate,
            'pending_orders': len(self.pending_orders),
            'recent_failures': self.failed_orders[-5:] if self.failed_orders else []
        }