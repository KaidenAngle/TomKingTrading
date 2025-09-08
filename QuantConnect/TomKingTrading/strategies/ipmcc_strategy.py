# IPMCC Strategy Module for LEAN
# In-the-Money Put Calendar Credit Spread
from AlgorithmImports import *
import math

class IPMCCStrategy:
    def __init__(self, algorithm):
        self.algo = algorithm
        self.target_dte_short = 30  # Short leg
        self.target_dte_long = 60   # Long leg
        self.management_dte = 14
        self.target_profit = 0.50
        self.positions = {}
        
    def CheckEntry(self):
        """Check for IPMCC entry opportunities"""
        # Check VIX regime
        vix_price = self.algo.Securities["VIX"].Price
        if vix_price < 18:
            return  # Need some volatility for calendars
        
        # Phase 2+ strategy (account > 40k)
        if self.algo.Portfolio.TotalPortfolioValue < 40000:
            return
        
        for symbol in ['SPY', 'QQQ']:
            if symbol not in self.positions:
                self.EnterIPMCC(symbol)
    
    def EnterIPMCC(self, symbol_str):
        """Enter IPMCC position - ITM put calendar spread"""
        chains = self.algo.CurrentSlice.OptionChains
        
        for kvp in chains:
            chain = kvp.Value
            if chain.Underlying.Symbol.Value == symbol_str:
                underlying_price = chain.Underlying.Price
                
                # Get puts only
                puts = [x for x in chain if x.Right == OptionRight.Put]
                
                # Separate by expiry for calendar spread
                short_term = [x for x in puts 
                            if 25 <= (x.Expiry.date() - self.algo.Time.date()).days <= 35]
                long_term = [x for x in puts 
                           if 55 <= (x.Expiry.date() - self.algo.Time.date()).days <= 65]
                
                if not short_term or not long_term:
                    return
                
                # Select ITM strikes (5-10% ITM)
                itm_strike = underlying_price * 1.05
                
                # Find matching strikes in both expiries
                short_put = None
                long_put = None
                
                for strike in set([x.Strike for x in short_term]):
                    if strike >= itm_strike:
                        # Find contracts with this strike
                        short_candidates = [x for x in short_term if x.Strike == strike]
                        long_candidates = [x for x in long_term if x.Strike == strike]
                        
                        if short_candidates and long_candidates:
                            short_put = short_candidates[0]
                            long_put = long_candidates[0]
                            break
                
                if short_put and long_put:
                    # Execute calendar spread
                    # Sell near-term ITM put
                    self.algo.Sell(short_put.Symbol, 1)
                    # Buy longer-term ITM put
                    self.algo.Buy(long_put.Symbol, 1)
                    
                    self.positions[symbol_str] = {
                        'short': short_put.Symbol,
                        'long': long_put.Symbol,
                        'entry_time': self.algo.Time,
                        'short_expiry': short_put.Expiry.date(),
                        'long_expiry': long_put.Expiry.date(),
                        'strike': short_put.Strike
                    }
                    
                    self.algo.Log(f"IPMCC entered: {symbol_str} at strike {short_put.Strike}")
                
                return
    
    def CheckManagement(self):
        """Check positions for management"""
        for symbol_str, position in list(self.positions.items()):
            short_days = (position['short_expiry'] - self.algo.Time.date()).days
            
            # Close when short leg approaches expiry
            if short_days <= self.management_dte:
                self.ClosePosition(symbol_str)
            else:
                # Check profit target
                short_value = self.algo.Securities[position['short']].Price
                long_value = self.algo.Securities[position['long']].Price
                
                # Calendar spreads profit from time decay differential
                spread_value = long_value - short_value
                
                # Close if significant profit achieved
                if spread_value > 0.5:  # Simplified profit check
                    self.ClosePosition(symbol_str)
    
    def ClosePosition(self, symbol_str):
        """Close IPMCC position"""
        if symbol_str in self.positions:
            position = self.positions[symbol_str]
            
            # Close both legs
            self.algo.Buy(position['short'], 1)   # Buy back short
            self.algo.Sell(position['long'], 1)   # Sell long
            
            self.algo.Log(f"IPMCC closed: {symbol_str}")
            del self.positions[symbol_str]
    
    def RollPosition(self, symbol_str):
        """Roll short leg to next expiry"""
        if symbol_str not in self.positions:
            return
        
        position = self.positions[symbol_str]
        
        # Buy back current short
        self.algo.Buy(position['short'], 1)
        
        # Find new short contract
        chains = self.algo.CurrentSlice.OptionChains
        for kvp in chains:
            chain = kvp.Value
            if chain.Underlying.Symbol.Value == symbol_str:
                # Find next month contract at same strike
                new_shorts = [x for x in chain 
                            if x.Right == OptionRight.Put 
                            and x.Strike == position['strike']
                            and 25 <= (x.Expiry.date() - self.algo.Time.date()).days <= 35
                            and x.Expiry.date() > position['short_expiry']]
                
                if new_shorts:
                    new_short = new_shorts[0]
                    self.algo.Sell(new_short.Symbol, 1)
                    
                    position['short'] = new_short.Symbol
                    position['short_expiry'] = new_short.Expiry.date()
                    
                    self.algo.Log(f"IPMCC rolled: {symbol_str}")
                    return
        
        # If roll fails, close position
        self.ClosePosition(symbol_str)
