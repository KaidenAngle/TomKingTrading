# Simple Order Helpers - Minimal complexity, maximum reliability
# Only what's absolutely needed for trading

from AlgorithmImports import *

class SimpleOrderHelpers:
    """
    Simple helpers for order placement
    No complexity, just practical solutions
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
    
    def place_option_limit_order(self, contract, quantity, aggressive=False):
        """
        Place limit order for option with simple pricing
        
        Args:
            contract: Option contract
            quantity: Number of contracts (negative for sell)
            aggressive: If True, cross spread more for fill
        """
        try:
            # Get bid/ask
            bid = contract.BidPrice if hasattr(contract, 'BidPrice') else 0
            ask = contract.AskPrice if hasattr(contract, 'AskPrice') else 0
            
            # Sanity check
            if bid <= 0 or ask <= 0:
                self.algo.Log(f"Invalid bid/ask for {contract.Symbol}: {bid}/{ask}")
                # Fall back to market order if needed
                return self.algo.MarketOrder(contract.Symbol, quantity)
            
            # Calculate limit price
            if quantity > 0:  # Buying
                if aggressive:
                    limit_price = ask  # Take the ask
                else:
                    limit_price = bid + (ask - bid) * 0.4  # 40% into spread
            else:  # Selling
                if aggressive:
                    limit_price = bid  # Hit the bid
                else:
                    limit_price = ask - (ask - bid) * 0.4  # 40% into spread
            
            # Round to nearest penny
            limit_price = round(limit_price, 2)
            
            # Place order
            return self.algo.LimitOrder(contract.Symbol, quantity, limit_price)
        except Exception as e:
            self.algo.Error(f"Limit order failed: {str(e)}, using market order")
            return self.algo.MarketOrder(contract.Symbol, quantity)
    
    def place_iron_condor_orders(self, short_call, long_call, short_put, long_put, quantity=1):
        """
        DEPRECATED: Use AtomicOrderExecutor.execute_iron_condor_atomic() instead.
        This method lacks atomic guarantees and proper rollback handling.
        Redirecting to atomic executor for safety.
        """
        # Redirect to atomic executor if available
        if hasattr(self.algo, 'atomic_executor'):
            return self.algo.atomic_executor.execute_iron_condor_atomic(
                short_call, long_call, short_put, long_put, quantity
            )
        
        # Log deprecation warning
        self.algo.Error("[SimpleOrderHelpers] DEPRECATED: place_iron_condor_orders called without atomic executor")
        self.algo.Error("[SimpleOrderHelpers] This method is unsafe - use AtomicOrderExecutor instead")
        
        # For backward compatibility only - this path should not be used in production
        # The atomic executor provides proper all-or-nothing execution with rollback
        return None
    
    def cleanup_partial_fill(self, orders):
        """
        Simple cleanup if multi-leg partially fills
        Just cancel unfilled and close filled
        """
        for order in orders:
            if order is not None:
                try:
                    if order.Status == OrderStatus.Submitted:
                        order.Cancel()
                    elif order.Status == OrderStatus.Filled:
                        # Reverse the filled position
                        self.algo.MarketOrder(order.Symbol, -order.Quantity)
                except (RuntimeError, AttributeError, InvalidOperationException) as e:
                    # Best effort cleanup - handle order state issues or missing attributes
                    pass
    
    def calculate_option_margin(self, short_strike, long_strike, quantity, multiplier=100):
        """
        Simple margin calculation for credit spreads
        """
        spread_width = abs(long_strike - short_strike)
        margin = spread_width * quantity * multiplier
        return margin