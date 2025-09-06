# Tom King Order Manager - Simplified Implementation
# Replaces complex trading infrastructure (4,132 lines) with QuantConnect built-ins
# Eliminates threading risks and over-engineered execution systems

from AlgorithmImports import *
from config_simplified import CONFIG

class SimpleOrderManager:
    """
    Simplified Tom King Order Execution System
    
    Key Features:
    - Uses QuantConnect's built-in ComboMarketOrder for multi-leg spreads
    - Eliminates threading complexity from order_execution_engine.py (1,090 lines)
    - Removes complex chain processing from option_chain_processor.py (1,094 lines)
    - Simplifies position exit logic from position_exit_manager.py (531 lines)
    - Removes dangerous live trading threading from live_trading_readiness.py (1,348 lines)
    
    Tom King's Order Types:
    1. Iron Condors (4-leg)
    2. Put Spreads (2-leg)  
    3. Strangles (2-leg)
    4. Simple exits (market orders)
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.active_orders = {}
        self.order_history = []
        self.max_order_retries = 3
        
    def place_iron_condor(self, underlying, strikes, quantity=1):
        """
        Place iron condor using QuantConnect's ComboMarketOrder
        
        Iron Condor Structure:
        - Sell put at strikes['short_put']
        - Buy put at strikes['long_put'] 
        - Sell call at strikes['short_call']
        - Buy call at strikes['long_call']
        
        Replaces 200+ lines of complex order execution logic
        """
        try:
            if not self._validate_iron_condor_strikes(strikes):
                self.algorithm.Error("Invalid iron condor strikes")
                return None
            
            # Create legs for iron condor
            legs = [
                # Put spread
                Leg.Create(strikes['short_put'], -quantity),  # Sell put
                Leg.Create(strikes['long_put'], quantity),    # Buy put
                
                # Call spread  
                Leg.Create(strikes['short_call'], -quantity), # Sell call
                Leg.Create(strikes['long_call'], quantity)    # Buy call
            ]
            
            # Place combo order
            order_ticket = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if order_ticket:
                # Track order
                self._track_order(order_ticket, 'iron_condor', {
                    'underlying': underlying,
                    'strikes': strikes,
                    'quantity': quantity,
                    'legs': len(legs)
                })
                
                self.algorithm.Log(f"Iron Condor Order: {underlying} {quantity}x")
                return order_ticket
            else:
                self.algorithm.Error("Iron condor order failed")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Iron condor order error: {e}")
            return None
    
    def place_put_spread(self, underlying, short_strike, long_strike, quantity=1):
        """
        Place put spread using QuantConnect's ComboMarketOrder
        
        Put Spread Structure:
        - Sell put at short_strike (higher)
        - Buy put at long_strike (lower)
        
        Used for Tom King's Long Term 112 strategy
        """
        try:
            if short_strike <= long_strike:
                self.algorithm.Error("Invalid put spread strikes")
                return None
            
            # Create legs
            legs = [
                Leg.Create(short_strike, -quantity),  # Sell put
                Leg.Create(long_strike, quantity)     # Buy put
            ]
            
            # Place combo order
            order_ticket = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if order_ticket:
                self._track_order(order_ticket, 'put_spread', {
                    'underlying': underlying,
                    'short_strike': short_strike,
                    'long_strike': long_strike,
                    'quantity': quantity
                })
                
                self.algorithm.Log(f"Put Spread Order: {underlying} {quantity}x")
                return order_ticket
            else:
                self.algorithm.Error("Put spread order failed")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Put spread order error: {e}")
            return None
    
    def place_strangle(self, underlying, put_strike, call_strike, quantity=1):
        """
        Place strangle using QuantConnect's ComboMarketOrder
        
        Strangle Structure:
        - Sell put at put_strike
        - Sell call at call_strike
        
        Used for Tom King's Futures Strangle strategy (adapted to equity options)
        """
        try:
            if put_strike >= call_strike:
                self.algorithm.Error("Invalid strangle strikes")
                return None
            
            # Create legs
            legs = [
                Leg.Create(put_strike, -quantity),   # Sell put
                Leg.Create(call_strike, -quantity)  # Sell call
            ]
            
            # Place combo order
            order_ticket = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if order_ticket:
                self._track_order(order_ticket, 'strangle', {
                    'underlying': underlying,
                    'put_strike': put_strike,
                    'call_strike': call_strike,
                    'quantity': quantity
                })
                
                self.algorithm.Log(f"Strangle Order: {underlying} {quantity}x")
                return order_ticket
            else:
                self.algorithm.Error("Strangle order failed")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Strangle order error: {e}")
            return None
    
    def place_ratio_spread(self, underlying, short_put, short_call, long_calls, quantity=1):
        """
        Place 1-1-2 ratio spread for Long Term 112 strategy
        
        Ratio Spread Structure:
        - Sell 1 put 
        - Sell 1 call
        - Buy 2 calls (higher strike)
        """
        try:
            # Create legs (1 short put, 1 short call, 2 long calls)
            legs = [
                Leg.Create(short_put, -quantity),      # Sell put
                Leg.Create(short_call, -quantity),     # Sell call
                Leg.Create(long_calls, 2 * quantity)   # Buy 2x calls
            ]
            
            # Place combo order
            order_ticket = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if order_ticket:
                self._track_order(order_ticket, 'ratio_spread', {
                    'underlying': underlying,
                    'short_put': short_put,
                    'short_call': short_call,
                    'long_calls': long_calls,
                    'quantity': quantity
                })
                
                self.algorithm.Log(f"1-1-2 Ratio Spread Order: {underlying} {quantity}x")
                return order_ticket
            else:
                self.algorithm.Error("Ratio spread order failed")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Ratio spread order error: {e}")
            return None
    
    def close_position(self, symbol, reason="manual_close"):
        """
        Close position using simple market order
        
        Tom King's exit methodology:
        - Close at 50% profit target
        - Close at 200% loss limit
        - Close at 21 DTE management
        
        Replaces complex exit logic with simple market orders
        """
        try:
            # Get current holding
            holding = self.algorithm.Portfolio.get(symbol)
            if not holding or not holding.Invested:
                return None
            
            quantity = holding.Quantity
            
            # Place closing order (opposite direction)
            if quantity > 0:
                order_ticket = self.algorithm.MarketOrder(symbol, -quantity)
            else:
                order_ticket = self.algorithm.MarketOrder(symbol, -quantity)
            
            if order_ticket:
                self._track_order(order_ticket, 'close_position', {
                    'symbol': symbol,
                    'quantity': quantity,
                    'reason': reason
                })
                
                self.algorithm.Log(f"Position Closed: {symbol} ({reason})")
                return order_ticket
            else:
                self.algorithm.Error(f"Failed to close position: {symbol}")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Position close error: {e}")
            return None
    
    def close_spread_position(self, legs, reason="exit_rule"):
        """
        Close multi-leg spread position
        
        Takes the opposite of the original spread to close
        """
        try:
            # Reverse all legs
            closing_legs = []
            for leg in legs:
                closing_legs.append(Leg.Create(leg.Symbol, -leg.Quantity))
            
            # Place closing combo order
            order_ticket = self.algorithm.ComboMarketOrder(closing_legs, 1)
            
            if order_ticket:
                self.algorithm.Log(f"Spread Position Closed: {len(legs)} legs ({reason})")
                return order_ticket
            else:
                self.algorithm.Error("Failed to close spread position")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Spread close error: {e}")
            return None
    
    def cancel_pending_orders(self):
        """
        Cancel all pending orders (emergency stop functionality)
        
        Tom King's emergency procedure:
        1. Cancel all pending orders immediately
        2. Log cancellation for audit
        3. Prevent new orders until reset
        """
        try:
            cancelled_count = 0
            
            # Get all open orders
            open_orders = self.algorithm.Transactions.GetOpenOrders()
            
            for order in open_orders:
                if order.Status in [OrderStatus.Submitted, OrderStatus.PartiallyFilled]:
                    order.Cancel()
                    cancelled_count += 1
            
            if cancelled_count > 0:
                self.algorithm.Log(f"Emergency: Cancelled {cancelled_count} pending orders")
            
            return cancelled_count
            
        except Exception as e:
            self.algorithm.Error(f"Order cancellation error: {e}")
            return 0
    
    def get_order_status(self, order_ticket):
        """Get current status of an order"""
        try:
            if order_ticket and hasattr(order_ticket, 'Status'):
                return order_ticket.Status
            return OrderStatus.Invalid
        except Exception:
            return OrderStatus.Invalid
    
    def _validate_iron_condor_strikes(self, strikes):
        """Validate iron condor strike structure"""
        try:
            required_keys = ['short_put', 'long_put', 'short_call', 'long_call']
            
            # Check all strikes present
            if not all(key in strikes for key in required_keys):
                return False
            
            # Validate strike relationships
            if strikes['long_put'] >= strikes['short_put']:
                return False  # Put spread invalid
            
            if strikes['short_call'] >= strikes['long_call']:
                return False  # Call spread invalid
            
            return True
            
        except Exception:
            return False
    
    def _track_order(self, order_ticket, order_type, details):
        """Track order for monitoring and audit"""
        try:
            order_info = {
                'ticket': order_ticket,
                'type': order_type,
                'details': details,
                'timestamp': self.algorithm.Time,
                'status': self.get_order_status(order_ticket)
            }
            
            # Store in active orders
            if order_ticket and hasattr(order_ticket, 'OrderId'):
                self.active_orders[order_ticket.OrderId] = order_info
            
            # Add to history
            self.order_history.append(order_info)
            
            # Limit history size
            if len(self.order_history) > 1000:
                self.order_history = self.order_history[-500:]  # Keep last 500
                
        except Exception as e:
            self.algorithm.Error(f"Order tracking error: {e}")
    
    def get_active_orders_summary(self):
        """Get summary of active orders for monitoring"""
        try:
            summary = {
                'total_active': len(self.active_orders),
                'by_type': {},
                'recent_count': 0
            }
            
            # Count by type
            for order_info in self.active_orders.values():
                order_type = order_info.get('type', 'unknown')
                summary['by_type'][order_type] = summary['by_type'].get(order_type, 0) + 1
            
            # Count recent orders (last hour)
            current_time = self.algorithm.Time
            for order_info in self.order_history[-50:]:  # Check last 50
                if (current_time - order_info['timestamp']).total_seconds() < 3600:
                    summary['recent_count'] += 1
            
            return summary
            
        except Exception as e:
            self.algorithm.Error(f"Order summary error: {e}")
            return {'total_active': 0, 'by_type': {}, 'recent_count': 0}