# Long Term 112 Strategy Module for LEAN
from AlgorithmImports import *
import math

class LongTerm112Strategy:
    def __init__(self, algorithm):
        self.algo = algorithm
        self.target_dte = 45
        self.management_dte = 21
        self.target_profit = 0.50
        self.positions = {}
        
    def CheckEntry(self):
        """Check for LT112 entry opportunities on Monday-Wednesday"""
        if self.algo.Time.weekday() > 2:  # Skip Thursday/Friday
            return
            
        for symbol in ['SPY', 'IWM', 'QQQ']:
            if symbol not in self.positions:
                self.EnterPosition(symbol)
    
    def EnterPosition(self, symbol_str):
        """Enter LT112 position"""
        chains = self.algo.CurrentSlice.OptionChains
        
        for kvp in chains:
            chain = kvp.Value
            if chain.Underlying.Symbol.Value == symbol_str:
                # Target 45 DTE
                target_expiry = self.algo.Time + timedelta(days=45)
                contracts = [x for x in chain if 38 <= (x.Expiry.date() - self.algo.Time.date()).days <= 52]
                
                if len(contracts) < 3:
                    return
                
                underlying_price = chain.Underlying.Price
                puts = [x for x in contracts if x.Right == OptionRight.Put]
                
                if len(puts) >= 3:
                    # Select 5-delta puts for high win rate
                    sorted_puts = sorted(puts, key=lambda x: x.Strike)
                    
                    # Simple 1-1-2 structure
                    if len(sorted_puts) >= 3:
                        long_put = sorted_puts[0]  # Furthest OTM for protection
                        short_put_1 = sorted_puts[1]  # First short
                        short_put_2 = sorted_puts[2]  # Second short (same or different strike)
                        
                        # Enter position
                        self.algo.Buy(long_put.Symbol, 1)
                        self.algo.Sell(short_put_1.Symbol, 1)
                        self.algo.Sell(short_put_2.Symbol, 1)
                        
                        self.positions[symbol_str] = {
                            'long': long_put.Symbol,
                            'short1': short_put_1.Symbol,
                            'short2': short_put_2.Symbol,
                            'entry_time': self.algo.Time,
                            'expiry': long_put.Expiry.date()
                        }
                        
                        self.algo.Log(f"LT112 entered: {symbol_str}")
                
                return
    
    def CheckManagement(self):
        """Check positions for 21 DTE management"""
        for symbol_str, position in list(self.positions.items()):
            days_remaining = (position['expiry'] - self.algo.Time.date()).days
            
            if days_remaining <= self.management_dte:
                # Close at 21 DTE
                self.ClosePosition(symbol_str)
    
    def ClosePosition(self, symbol_str):
        """Close LT112 position"""
        if symbol_str in self.positions:
            position = self.positions[symbol_str]
            
            # Close all legs
            self.algo.Sell(position['long'], 1)
            self.algo.Buy(position['short1'], 1) 
            self.algo.Buy(position['short2'], 1)
            
            self.algo.Log(f"LT112 closed: {symbol_str}")
            del self.positions[symbol_str]