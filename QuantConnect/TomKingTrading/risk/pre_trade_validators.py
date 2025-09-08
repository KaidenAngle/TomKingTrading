# Critical Production Validations - The Final 5%
# These are MUST HAVE before any live trading

from AlgorithmImports import *

class CriticalValidations:
    """
    Critical pre-trade validations for production safety
    Simple, robust, no over-engineering
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Hard position limits per strategy
        self.MAX_POSITIONS = {
            '0DTE': 2,
            'Futures_Strangle': 3,
            'LT112': 4,
            'IPMCC': 2,
            'LEAP_Ladders': 5,
            'TOTAL': 10
        }
        
        # Position tracking
        self.positions_by_strategy = {}
        
        # Connection status
        self.last_connection_check = None
        self.connection_healthy = True
        
        self.algo.Log("✅ Critical Validations Initialized")
        self.algo.Log(f"   Position Limits: {self.MAX_POSITIONS}")
    
    def validate_broker_connection(self) -> bool:
        """Validate broker API connection before trading"""
        try:
            if self.algo.LiveMode:
                # Check TastyTrade connection
                if hasattr(self.algo, 'tastytrade') and self.algo.tastytrade:
                    account = self.algo.tastytrade.get_account_info()
                    
                    if not account:
                        self.algo.Error("❌ TastyTrade API not connected")
                        self.connection_healthy = False
                        return False
                    
                    # Verify account balance is reasonable
                    tt_balance = account.get('net_liquidation', 0)
                    qc_balance = self.algo.Portfolio.TotalPortfolioValue
                    
                    # Allow 10% discrepancy for market movements
                    if abs(tt_balance - qc_balance) / qc_balance > 0.10:
                        self.algo.Error(f"⚠️ Balance mismatch: TT=${tt_balance:.2f} vs QC=${qc_balance:.2f}")
                        # Don't fail, just warn
                    
                    self.connection_healthy = True
                    self.last_connection_check = self.algo.Time
                    return True
                
            # In backtest mode, always return True
            return True
            
        except Exception as e:
            self.algo.Error(f"❌ Connection validation failed: {str(e)}")
            self.connection_healthy = False
            return False
    
    def validate_margin_requirements(self, required_bp: float, strategy_name: str = "") -> bool:
        """Check if we have sufficient buying power for the trade"""
        try:
            # Get available margin
            available_margin = self.algo.Portfolio.MarginRemaining
            total_value = self.algo.Portfolio.TotalPortfolioValue
            
            # Keep 20% buffer for safety
            safety_buffer = total_value * 0.20
            usable_margin = available_margin - safety_buffer
            
            # Check if we have enough
            if required_bp > usable_margin:
                self.algo.Log(f"❌ Insufficient margin for {strategy_name}")
                self.algo.Log(f"   Required: ${required_bp:.2f}")
                self.algo.Log(f"   Available: ${usable_margin:.2f}")
                return False
            
            # Also check as percentage of account
            bp_percent = required_bp / total_value
            max_bp_percent = 0.30  # Max 30% BP per trade
            
            if bp_percent > max_bp_percent:
                self.algo.Log(f"❌ Position too large: {bp_percent:.1%} of account")
                return False
            
            return True
            
        except Exception as e:
            self.algo.Error(f"Margin validation error: {str(e)}")
            return False
    
    def check_position_limit(self, strategy_name: str) -> bool:
        """Check if we're within position limits for the strategy"""
        # Count current positions for this strategy
        current_count = self.positions_by_strategy.get(strategy_name, 0)
        
        # Check strategy-specific limit
        if strategy_name in self.MAX_POSITIONS:
            if current_count >= self.MAX_POSITIONS[strategy_name]:
                self.algo.Log(f"❌ Position limit reached for {strategy_name}: {current_count}/{self.MAX_POSITIONS[strategy_name]}")
                return False
        
        # Check total position limit
        total_positions = sum(self.positions_by_strategy.values())
        if total_positions >= self.MAX_POSITIONS['TOTAL']:
            self.algo.Log(f"❌ Total position limit reached: {total_positions}/{self.MAX_POSITIONS['TOTAL']}")
            return False
        
        return True
    
    def record_position_open(self, strategy_name: str):
        """Record that a position was opened"""
        if strategy_name not in self.positions_by_strategy:
            self.positions_by_strategy[strategy_name] = 0
        
        self.positions_by_strategy[strategy_name] += 1
        
        total = sum(self.positions_by_strategy.values())
        self.algo.Log(f"📊 Position opened: {strategy_name} ({self.positions_by_strategy[strategy_name]}/{self.MAX_POSITIONS.get(strategy_name, 'N/A')})")
        self.algo.Log(f"   Total positions: {total}/{self.MAX_POSITIONS['TOTAL']}")
    
    def record_position_close(self, strategy_name: str):
        """Record that a position was closed"""
        if strategy_name in self.positions_by_strategy:
            self.positions_by_strategy[strategy_name] = max(0, self.positions_by_strategy[strategy_name] - 1)
            
            total = sum(self.positions_by_strategy.values())
            self.algo.Log(f"📊 Position closed: {strategy_name} ({self.positions_by_strategy[strategy_name]}/{self.MAX_POSITIONS.get(strategy_name, 'N/A')})")
            self.algo.Log(f"   Total positions: {total}/{self.MAX_POSITIONS['TOTAL']}")
    
    def update_position_counts(self):
        """Update position counts from actual portfolio"""
        # Reset counts
        self.positions_by_strategy = {}
        
        # Count positions by strategy tag
        for symbol, holding in self.algo.Portfolio.items():
            if holding.Invested:
                # Try to determine strategy from symbol or tag
                # This would need to be enhanced with actual position tracking
                if "0DTE" in str(symbol):
                    strategy = "0DTE"
                elif "STRANGLE" in str(symbol):
                    strategy = "Futures_Strangle"
                elif "LT112" in str(symbol):
                    strategy = "LT112"
                elif "IPMCC" in str(symbol):
                    strategy = "IPMCC"
                elif "LEAP" in str(symbol):
                    strategy = "LEAP_Ladders"
                else:
                    strategy = "Unknown"
                
                if strategy not in self.positions_by_strategy:
                    self.positions_by_strategy[strategy] = 0
                self.positions_by_strategy[strategy] += 1
    
    def calculate_required_margin(self, symbol, quantity, strategy_name="") -> float:
        """Calculate required margin for a position"""
        try:
            security = self.algo.Securities[symbol]
            
            if security.Type == SecurityType.Option:
                # Rough margin calculation for options
                # Short option margin = 20% of underlying + option premium
                if quantity < 0:  # Short option
                    underlying_price = security.Underlying.Price
                    margin = abs(quantity) * 100 * underlying_price * 0.20
                else:  # Long option
                    margin = abs(quantity) * 100 * security.Price
                    
            elif security.Type == SecurityType.Future:
                # Futures margin (varies by contract)
                # ES = $13,200, MES = $1,320 approximately
                if "ES" in str(symbol):
                    margin = abs(quantity) * 13200
                elif "MES" in str(symbol):
                    margin = abs(quantity) * 1320
                else:
                    margin = abs(quantity) * security.Price * 100
                    
            else:
                # Equity margin
                margin = abs(quantity) * security.Price
            
            return margin
            
        except Exception as e:
            self.algo.Error(f"Margin calculation error: {str(e)}")
            # Return conservative estimate
            return abs(quantity) * 100 * 100  # Assume $100 per contract
    
    def pre_trade_validation(self, strategy_name: str, symbol, quantity, required_bp: float = None) -> tuple:
        """Complete pre-trade validation check"""
        
        # 1. Check connection
        if not self.validate_broker_connection():
            return False, "Broker connection failed"
        
        # 2. Check position limits
        if not self.check_position_limit(strategy_name):
            return False, "Position limit exceeded"
        
        # 3. Calculate and check margin
        if required_bp is None:
            required_bp = self.calculate_required_margin(symbol, quantity, strategy_name)
        
        if not self.validate_margin_requirements(required_bp, strategy_name):
            return False, "Insufficient margin"
        
        return True, "All validations passed"
    
    def get_validation_status(self) -> dict:
        """Get current validation status"""
        total_positions = sum(self.positions_by_strategy.values())
        
        return {
            'connection_healthy': self.connection_healthy,
            'last_connection_check': self.last_connection_check,
            'positions_by_strategy': self.positions_by_strategy,
            'total_positions': total_positions,
            'total_limit': self.MAX_POSITIONS['TOTAL'],
            'margin_remaining': self.algo.Portfolio.MarginRemaining,
            'can_trade': self.connection_healthy and total_positions < self.MAX_POSITIONS['TOTAL']
        }


# USAGE IN MAIN.PY:
#
# def Initialize(self):
#     self.critical_validations = CriticalValidations(self)
#
# def place_trade(self, strategy_name, symbol, quantity):
#     # Pre-trade validation
#     valid, reason = self.critical_validations.pre_trade_validation(
#         strategy_name, symbol, quantity
#     )
#     
#     if not valid:
#         self.Log(f"Trade blocked: {reason}")
#         return None
#     
#     # Place the trade
#     order = self.MarketOrder(symbol, quantity)
#     
#     # Record position
#     if order:
#         self.critical_validations.record_position_open(strategy_name)
#     
#     return order