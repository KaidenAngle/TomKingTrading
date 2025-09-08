# Simple Greeks-Based Signal Generation
# Direct implementation of Tom King's approach using options mechanics

from AlgorithmImports import *

class GreeksSignalGenerator:
    """
    Generate trading signals using Greeks - Tom King's actual approach
    No over-engineering, just the essentials
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
    def should_enter_0dte(self, current_time, vix_level, spy_options) -> bool:
        """
        Tom King's 0DTE entry logic using Greeks
        """
        # Time check - after 10:30 AM when opening volatility settles
        if current_time.hour < 10 or (current_time.hour == 10 and current_time.minute < 30):
            return False
            
        # VIX regime check
        if vix_level < 13 or vix_level > 25:
            return False
            
        # Find max gamma strike (pin level)
        max_gamma_strike = self.find_gamma_pin(spy_options)
        current_price = self.algo.Securities["SPY"].Price
        
        # Enter if price is near gamma pin (high probability of pin)
        distance_from_pin = abs(current_price - max_gamma_strike) / current_price
        
        return distance_from_pin < 0.005  # Within 0.5% of pin
    
    def find_gamma_pin(self, options_chain) -> float:
        """
        Find the strike with highest gamma concentration
        This is where price tends to 'pin' on expiration
        """
        gamma_by_strike = {}
        
        for option in options_chain:
            if option.Expiry.date() == self.algo.Time.date():  # Today's expiry only
                strike = option.Strike
                gamma = option.Greeks.Gamma if hasattr(option.Greeks, 'Gamma') else 0
                
                if strike not in gamma_by_strike:
                    gamma_by_strike[strike] = 0
                gamma_by_strike[strike] += abs(gamma)
        
        if gamma_by_strike:
            return max(gamma_by_strike, key=gamma_by_strike.get)
        
        return self.algo.Securities["SPY"].Price  # Default to current price
    
    def get_strangle_strikes_by_delta(self, options_chain, target_delta=0.07) -> tuple:
        """
        Tom King's approach: Select strikes by delta, not technical levels
        """
        current_price = self.algo.Securities["SPY"].Price
        
        # Find puts around target delta
        put_candidates = []
        call_candidates = []
        
        for option in options_chain:
            delta = abs(option.Greeks.Delta) if hasattr(option.Greeks, 'Delta') else 0
            
            if abs(delta - target_delta) < 0.02:  # Within tolerance
                if option.Right == OptionRight.Put:
                    put_candidates.append((option.Strike, delta))
                else:
                    call_candidates.append((option.Strike, delta))
        
        # Get closest to target delta
        put_strike = min(put_candidates, key=lambda x: abs(x[1] - target_delta))[0] if put_candidates else current_price * 0.95
        call_strike = min(call_candidates, key=lambda x: abs(x[1] - target_delta))[0] if call_candidates else current_price * 1.05
        
        return put_strike, call_strike
    
    def calculate_iv_rank(self, current_iv, lookback_days=30) -> float:
        """
        Simple IV rank calculation
        """
        # In production, would use historical IV
        # For simplicity, using VIX-based approximation
        vix = self.algo.Securities["VIX"].Price if "VIX" in self.algo.Securities else 16
        
        # Simple normalization
        min_iv = 10
        max_iv = 30
        
        iv_rank = (vix - min_iv) / (max_iv - min_iv) * 100
        return max(0, min(100, iv_rank))
    
    def check_gamma_exposure(self, options_chain) -> str:
        """
        Determine if market makers are long or short gamma
        Affects how price will move
        """
        net_gamma = 0
        
        for option in options_chain:
            gamma = option.Greeks.Gamma if hasattr(option.Greeks, 'Gamma') else 0
            oi = option.OpenInterest if hasattr(option, 'OpenInterest') else 0
            
            # Simplified: Dealers short calls, long puts
            if option.Right == OptionRight.Call:
                net_gamma -= gamma * oi
            else:
                net_gamma += gamma * oi
        
        if net_gamma < -10000:
            return "negative"  # Explosive moves possible
        elif net_gamma > 10000:
            return "positive"  # Dampened moves
        else:
            return "neutral"
    
    def get_strategy_signal(self, vix_level, iv_rank, gamma_exposure) -> str:
        """
        Tom King's strategy selection based on market conditions
        """
        # VIX-based regime
        if vix_level < 13:
            return "wait"  # Too low, wait for better conditions
        
        elif 13 <= vix_level <= 18:
            # Optimal conditions for premium selling
            if iv_rank > 50:
                return "strangle"  # High IV rank = sell premium
            else:
                return "calendar"  # Low IV = calendar spreads
        
        elif 18 < vix_level <= 25:
            # Moderate volatility
            if gamma_exposure == "negative":
                return "iron_condor"  # Contained by gamma
            else:
                return "strangle"  # Standard approach
        
        else:  # VIX > 25
            return "defensive"  # Reduce size or stay out


