# Defensive Management Module for LEAN
# Implements Tom King's 21 DTE rule and VIX spike protocols
from AlgorithmImports import *
from datetime import timedelta

class DefensiveManager:
    def __init__(self, algorithm):
        self.algo = algorithm
        self.vix_spike_threshold = 35
        self.vix_emergency_threshold = 40
        self.defensive_dte = 21
        
    def CheckAllPositions(self):
        """Check all positions for defensive actions"""
        vix_price = self.algo.Securities["VIX"].Price
        
        # Emergency VIX protocol
        emergency_action = self.CheckVIXEmergency(vix_price)
        if emergency_action:
            return emergency_action
        
        # Check each position for 21 DTE management
        positions_to_defend = []
        
        # Check option positions
        for holding in self.algo.Portfolio.Values:
            if holding.Invested and holding.Type == SecurityType.Option:
                contract = holding.Symbol
                dte = (contract.ID.Date - self.algo.Time.date()).days
                
                if dte <= self.defensive_dte:
                    # Check if position is challenged
                    if self.IsPositionChallenged(holding):
                        positions_to_defend.append(holding)
        
        return positions_to_defend
    
    def CheckVIXEmergency(self, vix_price: float) -> str:
        """Tom King's VIX emergency protocols"""
        if vix_price >= self.vix_emergency_threshold:
            self.algo.Log(f"EMERGENCY: VIX at {vix_price} - Closing all 0DTE positions")
            self.CloseAll0DTE()
            return "EMERGENCY_CLOSE_0DTE"
        
        elif vix_price >= self.vix_spike_threshold:
            self.algo.Log(f"WARNING: VIX spike to {vix_price} - Reducing exposure")
            self.ReduceExposure()
            return "REDUCE_EXPOSURE"
        
        return None
    
    def IsPositionChallenged(self, holding) -> bool:
        """Check if position is being challenged (tested)"""
        if holding.Type != SecurityType.Option:
            return False
        
        contract = holding.Symbol
        underlying = contract.Underlying
        underlying_price = self.algo.Securities[underlying].Price
        strike = contract.ID.StrikePrice
        
        # For short puts - challenged if underlying near or below strike
        if contract.ID.OptionRight == OptionRight.Put and holding.Quantity < 0:
            if underlying_price <= strike * 1.02:  # Within 2% of strike
                return True
        
        # For short calls - challenged if underlying near or above strike
        elif contract.ID.OptionRight == OptionRight.Call and holding.Quantity < 0:
            if underlying_price >= strike * 0.98:  # Within 2% of strike
                return True
        
        return False
    
    def ExecuteDefensiveAction(self, holding):
        """Execute Tom King's 21 DTE defensive management"""
        contract = holding.Symbol
        dte = (contract.ID.Date - self.algo.Time.date()).days
        
        self.algo.Log(f"Defensive action at {dte} DTE for {contract}")
        
        # Roll to next month at same strike
        self.RollPosition(holding)
    
    def RollPosition(self, holding):
        """Roll position to next expiry"""
        contract = holding.Symbol
        strike = contract.ID.StrikePrice
        right = contract.ID.OptionRight
        underlying = contract.Underlying
        
        # Close current position
        self.algo.Liquidate(contract)
        
        # Find next month contract
        chains = self.algo.CurrentSlice.OptionChains
        for kvp in chains:
            chain = kvp.Value
            if chain.Underlying.Symbol == underlying:
                # Find contracts 30-45 DTE at same strike
                next_month = [x for x in chain 
                            if x.Right == right 
                            and x.Strike == strike
                            and 30 <= (x.Expiry.date() - self.algo.Time.date()).days <= 45]
                
                if next_month:
                    new_contract = next_month[0]
                    # Re-establish position
                    if holding.Quantity < 0:
                        self.algo.Sell(new_contract.Symbol, abs(holding.Quantity))
                    else:
                        self.algo.Buy(new_contract.Symbol, holding.Quantity)
                    
                    self.algo.Log(f"Rolled {contract} to {new_contract.Symbol}")
                    return
        
        self.algo.Log(f"Could not roll {contract} - position closed")
    
    def CloseAll0DTE(self):
        """Emergency close all 0DTE positions"""
        for holding in self.algo.Portfolio.Values:
            if holding.Invested and holding.Type == SecurityType.Option:
                contract = holding.Symbol
                dte = (contract.ID.Date - self.algo.Time.date()).days
                
                if dte == 0:
                    self.algo.Liquidate(contract)
                    self.algo.Log(f"Emergency closed 0DTE: {contract}")
    
    def ReduceExposure(self):
        """Reduce overall portfolio exposure by 50%"""
        for holding in self.algo.Portfolio.Values:
            if holding.Invested and holding.Type == SecurityType.Option:
                # Reduce position by half
                current_qty = holding.Quantity
                reduce_qty = int(current_qty / 2)
                
                if reduce_qty != 0:
                    if current_qty > 0:
                        self.algo.Sell(holding.Symbol, abs(reduce_qty))
                    else:
                        self.algo.Buy(holding.Symbol, abs(reduce_qty))
                    
                    self.algo.Log(f"Reduced exposure: {holding.Symbol} by {reduce_qty}")
    
    def CheckEarnings(self, symbol: str) -> bool:
        """Check if earnings announcement is within 5 days"""
        # Simplified earnings check
        # In production, would use earnings calendar API
        
        # Known earnings dates (example)
        earnings_dates = {
            'AAPL': ['2024-01-25', '2024-04-25', '2024-07-25', '2024-10-25'],
            'MSFT': ['2024-01-24', '2024-04-24', '2024-07-24', '2024-10-24'],
            'SPY': [],  # ETFs don't have earnings
            'QQQ': [],
            'IWM': []
        }
        
        if symbol not in earnings_dates:
            return False
        
        for earnings_date_str in earnings_dates[symbol]:
            earnings_date = self.algo.Time.strptime(earnings_date_str, '%Y-%m-%d').date()
            days_to_earnings = (earnings_date - self.algo.Time.date()).days
            
            if 0 <= days_to_earnings <= 5:
                self.algo.Log(f"Earnings in {days_to_earnings} days for {symbol} - avoiding")
                return True
        
        return False
    
    def GetDefensiveMetrics(self) -> dict:
        """Get current defensive metrics"""
        vix_price = self.algo.Securities["VIX"].Price
        
        challenged_positions = 0
        dte_21_positions = 0
        
        for holding in self.algo.Portfolio.Values:
            if holding.Invested and holding.Type == SecurityType.Option:
                contract = holding.Symbol
                dte = (contract.ID.Date - self.algo.Time.date()).days
                
                if dte <= 21:
                    dte_21_positions += 1
                    if self.IsPositionChallenged(holding):
                        challenged_positions += 1
        
        return {
            'vix': vix_price,
            'vix_status': self.GetVIXStatus(vix_price),
            'challenged_positions': challenged_positions,
            'dte_21_positions': dte_21_positions,
            'emergency_threshold': self.vix_emergency_threshold,
            'spike_threshold': self.vix_spike_threshold
        }
    
    def GetVIXStatus(self, vix_price: float) -> str:
        """Get VIX status level"""
        if vix_price >= self.vix_emergency_threshold:
            return "EMERGENCY"
        elif vix_price >= self.vix_spike_threshold:
            return "SPIKE"
        elif vix_price >= 30:
            return "HIGH"
        elif vix_price >= 25:
            return "ELEVATED"
        elif vix_price >= 20:
            return "NORMAL"
        else:
            return "LOW"
