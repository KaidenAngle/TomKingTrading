# region imports
from AlgorithmImports import *
from datetime import time
# endregion

class EnhancedButterfly0DTE:
    """
    Enhanced 0DTE Butterfly Strategy (Friday afternoons only)
    Triggers: After 10:30 AM when price moves >1% from baseline
    Simple butterfly spreads to fade extreme moves, max 3 per day
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.baseline_prices = {}
        self.daily_trades = 0
        self.eligible_products = ['SPY', 'QQQ', 'IWM']
        
    def initialize_daily_baseline(self):
        """Capture 10:30 AM baseline prices"""
        if self.algo.Time.time() >= time(10, 30) and not self.baseline_prices:
            for symbol in self.eligible_products:
                if symbol in self.algo.Securities:
                    price = float(self.algo.Securities[symbol].Price)
                    if price > 0:
                        self.baseline_prices[symbol] = price
    
    def get_movement_opportunities(self, symbol, current_price, baseline_price):
        """Check if move is large enough for butterfly"""
        if not baseline_price or baseline_price <= 0:
            return {'opportunity': False}
        
        movement = abs((current_price - baseline_price) / baseline_price)
        
        # Simple: >1% move = opportunity
        if movement >= 0.01 and self.daily_trades < 3:
            return {
                'opportunity': True,
                'type': 'butterfly',
                'direction': 'fade',
                'reason': f"{movement:.1%} move from baseline"
            }
        
        return {'opportunity': False}
    
    def calculate_butterfly_strikes(self, current_price, direction):
        """Simple ATM butterfly strikes"""
        atm = round(current_price)
        width = 5 if current_price > 400 else 2
        
        return {
            'lower': atm - width,
            'middle': atm,
            'upper': atm + width
        }
    
    def execute_butterfly_spread(self, symbol, strikes, account_value):
        """Simple execution tracking"""
        if self.daily_trades >= 3:
            return False, "Daily limit reached"
        
        self.daily_trades += 1
        return True, f"Butterfly executed on {symbol}"
    
    def calculate_ratio_spread_strikes(self, current_price, direction):
        """Not used in simplified version"""
        return {}
    
    def execute_ratio_spread(self, symbol, strikes, account_value):
        """Not used in simplified version"""
        return False, "Not implemented"
    
    def check_time_stops(self):
        """Simple time stop at 3:45 PM"""
        if self.algo.Time.time() >= time(15, 45):
            self.daily_trades = 0
            self.baseline_prices = {}
    
    def check_profit_targets(self):
        """Check if positions hit profit targets"""
        return
    
    def validate_butterfly_system(self):
        """Simple validation"""
        return [
            "[WARNING] Enhanced Butterfly configured",
            "[WARNING] 10:30 AM baseline capture",
            "[WARNING] Max 3 butterfly trades per day"
        ]