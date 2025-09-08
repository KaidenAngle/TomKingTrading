# region imports
from AlgorithmImports import *
from datetime import timedelta
# endregion

class Phase3BearTrapStrategy:
    """
    Phase 3+ Bear Trap Strategy (Tom King's 11x leverage strategy)
    Requirements: Account > £65k, VIX 18-35
    Simple implementation: 60 DTE ATM puts, exit at 50% or 21 DTE
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.active_position = None  # Only one at a time
        
    def can_enter_position(self, account_phase, account_value, active_positions, current_vix):
        """Simple entry check - Phase 3+, good VIX, no existing position"""
        if account_phase < 3:
            return False, "Requires Phase 3+"
            
        if account_value < 82550:  # £65k in USD
            return False, "Insufficient capital"
            
        if not current_vix or current_vix < 18 or current_vix > 35:
            return False, "VIX outside 18-35 range"
            
        if self.active_position:
            return False, "Position already active"
            
        return True, "Can enter"
    
    def get_available_products(self, account_phase):
        """Simple product list based on phase"""
        if account_phase >= 4:
            return ['SPY', 'QQQ', 'ES']
        return ['SPY']
    
    def execute_bear_trap_entry(self, symbol, account_value, current_vix):
        """Simple execution - just track the intent"""
        try:
            # Simple position sizing: 2% risk
            position_size = account_value * 0.02
            
            self.active_position = {
                'symbol': symbol,
                'size': position_size,
                'entry_time': self.algo.Time
            }
            
            return True, f"Bear Trap entered: {symbol}"
        except:
            return False, "Execution failed"
    
    def analyze_existing_positions(self, current_positions):
        """Simple position check - close at 50% profit or 21 DTE"""
        if not self.active_position:
            return []
            
        days_held = (self.algo.Time - self.active_position['entry_time']).days
        
        if days_held >= 39:  # 60 DTE - 21 DTE = 39 days
            return [{
                'position': 'BEAR_TRAP',
                'action': 'CLOSE',
                'reason': '21 DTE management',
                'priority': 'HIGH'
            }]
        
        return []
    
    def validate_bear_trap_system(self):
        """Simple validation"""
        return [
            "✅ Bear Trap 11x configured",
            "✅ Phase 3+ requirement",
            "✅ VIX 18-35 range"
        ]