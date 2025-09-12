# Simple Safety Checks - Essential protection without over-engineering
# Keep it simple, keep it working

from AlgorithmImports import *

class PositionSafetyValidator:
    """
    Simple, robust safety checks for live trading
    No complex logic - just essential protections
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Simple limits
        self.max_daily_loss = 0.05  # 5% daily loss limit
        self.max_loss_per_trade = 0.02  # 2% per trade
        self.daily_start_value = algorithm.Portfolio.TotalPortfolioValue
        
        # Simple tracking
        self.trades_today = 0
        self.losses_today = 0
        self.can_trade = True
        
        self.algo.Log("[WARNING] Simple Safety Checks Active")
    
    def check_before_trade(self) -> bool:
        """Simple check before any trade - returns True if safe to trade"""
        
        # Check 1: Daily loss limit
        current_value = self.algo.Portfolio.TotalPortfolioValue
        daily_loss = (self.daily_start_value - current_value) / self.daily_start_value
        
        if daily_loss > self.max_daily_loss:
            self.algo.Log(f"[WARNING] Daily loss limit hit: {daily_loss:.1%}")
            self.can_trade = False
            return False
        
        # Check 2: Too many losses today
        if self.losses_today >= 3:
            self.algo.Log(f"[WARNING] Too many losses today: {self.losses_today}")
            self.can_trade = False
            return False
        
        # Check 3: Market is open
        if not self.algo.IsMarketOpen("SPY"):
            return False
        
        return self.can_trade
    
    def check_position_size(self, proposed_risk: float) -> bool:
        """Check if position size is acceptable"""
        account_value = self.algo.Portfolio.TotalPortfolioValue
        risk_percent = proposed_risk / account_value
        
        if risk_percent > self.max_loss_per_trade:
            self.algo.Log(f"[WARNING] Position too large: {risk_percent:.1%} of account")
            return False
        
        return True
    
    def record_trade(self, profit: float):
        """Record trade result"""
        self.trades_today += 1
        if profit < 0:
            self.losses_today += 1
    
    def reset_daily(self):
        """Reset at market open"""
        self.daily_start_value = self.algo.Portfolio.TotalPortfolioValue
        self.trades_today = 0
        self.losses_today = 0
        self.can_trade = True


class SimpleOrderFillCheck:
    """
    Simple order fill validation for multi-leg strategies
    Just ensures all legs fill or none do
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
    
    def place_iron_condor(self, orders: list) -> bool:
        """
        Place iron condor and ensure all 4 legs fill
        orders = [call_sell, call_buy, put_sell, put_buy]
        """
        placed_orders = []
        
        # Place all orders
        for order in orders:
            ticket = self.algo.MarketOrder(order['symbol'], order['quantity'])
            if ticket:
                placed_orders.append(ticket)
            else:
                # One failed, cancel all others
                self.cancel_orders(placed_orders)
                return False
        
        # Wait for fills (simple check)
        filled = self.wait_for_fills(placed_orders, max_wait=10)
        
        if not filled:
            # Not all filled, close any that did
            self.close_partial_fills(placed_orders)
            return False
        
        return True
    
    def wait_for_fills(self, orders: list, max_wait: int = 10) -> bool:
        """Wait for orders to fill"""
        import time
        
        for _ in range(max_wait):
            all_filled = True
            for order in orders:
                if order.Status != OrderStatus.Filled:
                    all_filled = False
                    break
            
            if all_filled:
                return True
            
            # Don't block - let QuantConnect's scheduling handle the timing
            # Return False to indicate not all filled yet
            return False
        
        return False
    
    def cancel_orders(self, orders: list):
        """Cancel unfilled orders"""
        for order in orders:
            if order.Status not in [OrderStatus.Filled, OrderStatus.Canceled]:
                order.Cancel()
    
    def close_partial_fills(self, orders: list):
        """Close any filled legs to avoid naked positions"""
        for order in orders:
            if order.Status == OrderStatus.Filled:
                # Reverse the position
                self.algo.MarketOrder(order.Symbol, -order.Quantity)
                self.algo.Log(f"Closed orphaned leg: {order.Symbol}")


class SimpleAssignmentCheck:
    """
    Simple assignment risk check for short options
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
    
    def check_assignment_risk(self) -> list:
        """Check for ITM short options near expiry"""
        risky_positions = []
        
        for symbol, holding in self.algo.Portfolio.items():
            if not holding.Invested:
                continue
            
            # Check if it's a short option
            if holding.Type == SecurityType.Option and holding.IsShort:
                security = self.algo.Securities[symbol]
                
                # Check if near expiry (1 day)
                days_to_expiry = (security.Expiry - self.algo.Time).days
                
                if days_to_expiry <= 1:
                    # Check if ITM
                    underlying_price = security.Underlying.Price
                    strike = security.StrikePrice
                    
                    if security.Right == OptionRight.Call:
                        is_itm = underlying_price > strike
                    else:
                        is_itm = underlying_price < strike
                    
                    if is_itm:
                        risky_positions.append({
                            'symbol': symbol,
                            'days_to_expiry': days_to_expiry,
                            'moneyness': underlying_price / strike
                        })
        
        return risky_positions
    
    def close_risky_positions(self):
        """Close positions with assignment risk"""
        risky = self.check_assignment_risk()
        
        for position in risky:
            self.algo.Liquidate(position['symbol'], "Assignment risk")
            self.algo.Log(f"Closed {position['symbol']} - assignment risk")


class SimpleDataValidation:
    """
    Simple data validation - just check for obviously bad data
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
    
    def is_data_valid(self, symbol) -> bool:
        """Check if data looks valid"""
        security = self.algo.Securities.get(symbol)
        
        if not security:
            return False
        
        # Check price is positive
        if security.Price <= 0:
            return False
        
        # Check bid/ask if available
        if hasattr(security, 'BidPrice') and hasattr(security, 'AskPrice'):
            if security.BidPrice <= 0 or security.AskPrice <= 0:
                return False
            
            # Check spread isn't crazy (>20% is probably bad data)
            spread = (security.AskPrice - security.BidPrice) / security.BidPrice
            if spread > 0.20:
                self.algo.Log(f"Wide spread on {symbol}: {spread:.1%}")
                return False
        
        return True


class SimpleAlerts:
    """
    Simple alert system - just log critical events
    In production, add email/SMS here
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
    
    def send_alert(self, level: str, message: str):
        """Send alert based on severity"""
        
        if level == "CRITICAL":
            self.algo.Error(f"[WARNING] CRITICAL: {message}")
            # In production: send SMS/email
            
        elif level == "WARNING":
            self.algo.Log(f"[WARNING] WARNING: {message}")
            # In production: send email
            
        elif level == "INFO":
            self.algo.Log(f"ℹ[WARNING] INFO: {message}")
    
    def daily_summary(self):
        """Send daily summary"""
        portfolio = self.algo.Portfolio
        
        summary = f"""
        Daily Summary - {self.algo.Time.date()}
        Account Value: ${portfolio.TotalPortfolioValue:,.2f}
        Daily P&L: ${portfolio.TotalProfit:,.2f}
        Open Positions: {sum(1 for h in portfolio.Values if h.Invested)}
        """
        
        self.algo.Log(summary)
        # In production: email this


# USAGE EXAMPLE:
# 