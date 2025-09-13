# Unified Order Pricing - Single source of truth for limit order pricing
# Consolidates duplicate 40% spread calculations found in 3+ locations

from AlgorithmImports import *
from typing import Optional, Tuple

class UnifiedOrderPricing:
    """
    Centralized limit order pricing logic.
    Eliminates duplicate spread calculations across order helpers.
    Tom King methodology: 40% into the bid/ask spread for better fills.
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Tom King's standard: 40% into the spread for limit orders
        self.spread_penetration = 0.40
        
        # Minimum spread to use limit orders (else use market)
        self.min_spread_for_limit = 0.05  # $0.05 minimum spread
        
        # Maximum acceptable spread as percentage of mid price
        self.max_spread_percentage = 0.10  # 10% max spread
    
    def calculate_limit_price(self, 
                            symbol, 
                            is_buy: bool,
                            bid_price: Optional[float] = None,
                            ask_price: Optional[float] = None) -> Tuple[float, bool]:
        """
        Calculate optimal limit order price using Tom King's 40% spread rule.
        
        Args:
            symbol: The security symbol
            is_buy: True for buy orders, False for sell orders
            bid_price: Optional bid price (will fetch if not provided)
            ask_price: Optional ask price (will fetch if not provided)
            
        Returns:
            (limit_price, use_limit) - price and whether to use limit order
        """
        
        try:
            # Get bid/ask if not provided
            if bid_price is None or ask_price is None:
                if symbol not in self.algo.Securities:
                    self.algo.Error(f"[UnifiedPricing] Symbol {symbol} not in securities")
                    return (0, False)
                
                security = self.algo.Securities[symbol]
                bid_price = security.BidPrice if hasattr(security, 'BidPrice') else security.Price
                ask_price = security.AskPrice if hasattr(security, 'AskPrice') else security.Price
            
            # Validate bid/ask
            if bid_price <= 0 or ask_price <= 0:
                self.algo.Debug(f"[UnifiedPricing] Invalid bid/ask: {bid_price}/{ask_price}")
                return (0, False)
            
            # Calculate spread
            spread = ask_price - bid_price
            mid_price = (bid_price + ask_price) / 2
        except Exception as e:
            
            # Check if spread is reasonable
            if spread < self.min_spread_for_limit:
                # Spread too tight, use market order
                self.algo.Debug(f"[UnifiedPricing] Spread too tight ({spread:.2f}), use market")
                return (mid_price, False)
            
            if spread / mid_price > self.max_spread_percentage:
                # Spread too wide, use market order for safety
                self.algo.Debug(f"[UnifiedPricing] Spread too wide ({spread/mid_price:.1%}), use market")
                return (mid_price, False)
            
            # Calculate limit price using Tom King's 40% rule
            if is_buy:
                # Buy order: Start from bid, move 40% toward ask
                limit_price = bid_price + (spread * self.spread_penetration)
            else:
                # Sell order: Start from ask, move 40% toward bid
                limit_price = ask_price - (spread * self.spread_penetration)
            
            # Round to nearest penny
            limit_price = round(limit_price, 2)
            
            self.algo.Debug(f"[UnifiedPricing] Calculated limit price: {limit_price:.2f} "
                          f"(bid: {bid_price:.2f}, ask: {ask_price:.2f}, spread: {spread:.2f})")
            
            return (limit_price, True)
            
        except Exception as e:
            self.algo.Error(f"[UnifiedPricing] Error calculating limit price: {e}")
            return (0, False)
    
    def should_use_limit_order(self, symbol) -> bool:
        """
        Determine if limit order should be used for given symbol.
        
        Returns:
            True if limit order recommended, False for market order
        """
        
        try:
        
            pass
        except Exception as e:

            if symbol not in self.algo.Securities:
                return False
            
            security = self.algo.Securities[symbol]
            
            # Check if option
            if security.Type != SecurityType.Option:
                # For non-options, generally use market orders
                return False
            
            # Check liquidity
            volume = security.Volume if hasattr(security, 'Volume') else 0
            if volume < 100:  # Low volume, use limit for safety
                return True
            
            # Check spread
            bid = security.BidPrice if hasattr(security, 'BidPrice') else 0
            ask = security.AskPrice if hasattr(security, 'AskPrice') else 0
            
            if bid <= 0 or ask <= 0:
                return False
            
            spread = ask - bid
            mid = (bid + ask) / 2
            
            # Use limit if spread is reasonable
            return (spread >= self.min_spread_for_limit and 
                   spread / mid <= self.max_spread_percentage)
            
        except Exception as e:
            self.algo.Debug(f"[UnifiedPricing] Error checking limit order suitability: {e}")
            return False
    
    def calculate_iron_condor_prices(self, 
                                    short_call, long_call, 
                                    short_put, long_put) -> Dict:
        """
        Calculate limit prices for all legs of an iron condor.
        
        Returns:
            Dictionary with limit prices for each leg
        """
        
        prices = {}
        
        # Short call (sell)
        call_sell_price, use_limit = self.calculate_limit_price(short_call, is_buy=False)
        prices['short_call'] = {'price': call_sell_price, 'use_limit': use_limit}
        
        # Long call (buy)
        call_buy_price, use_limit = self.calculate_limit_price(long_call, is_buy=True)
        prices['long_call'] = {'price': call_buy_price, 'use_limit': use_limit}
        
        # Short put (sell)
        put_sell_price, use_limit = self.calculate_limit_price(short_put, is_buy=False)
        prices['short_put'] = {'price': put_sell_price, 'use_limit': use_limit}
        
        # Long put (buy)
        put_buy_price, use_limit = self.calculate_limit_price(long_put, is_buy=True)
        prices['long_put'] = {'price': put_buy_price, 'use_limit': use_limit}
        
        # Calculate net credit
        if all(prices[leg]['use_limit'] for leg in prices):
            net_credit = (prices['short_call']['price'] + prices['short_put']['price'] -
                         prices['long_call']['price'] - prices['long_put']['price'])
            prices['net_credit'] = net_credit
            prices['all_limits'] = True
        else:
            prices['all_limits'] = False
        
        return prices
    
    def adjust_price_for_partial_fill(self, 
                                     original_price: float,
                                     is_buy: bool,
                                     urgency_factor: float = 1.0) -> float:
        """
        Adjust limit price to improve fill probability.
        Used when original limit order doesn't fill.
        
        Args:
            original_price: The original limit price
            is_buy: True for buy orders, False for sell orders
            urgency_factor: Multiplier for adjustment (1.0 = normal, 2.0 = urgent)
            
        Returns:
            Adjusted limit price
        """
        
        # Tom King: Move another 20% into spread for each retry
        adjustment = 0.20 * urgency_factor
        
        if is_buy:
            # Buy order: Increase price
            new_price = original_price * (1 + adjustment)
        else:
            # Sell order: Decrease price
            new_price = original_price * (1 - adjustment)
        
        return round(new_price, 2)


# Helper function for backward compatibility
def get_unified_limit_price(algorithm, symbol, is_buy: bool) -> Tuple[float, bool]:
    """
    Quick helper to get limit price using unified pricing.
    
    Returns:
        (limit_price, use_limit) tuple
    """
    
    if not hasattr(algorithm, 'unified_pricing'):
        algorithm.unified_pricing = UnifiedOrderPricing(algorithm)
    
    return algorithm.unified_pricing.calculate_limit_price(symbol, is_buy)