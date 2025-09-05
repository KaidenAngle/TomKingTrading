# Shared Option Trading Utilities
# Consolidated from multiple duplicate implementations

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import numpy as np

class OptionUtils:
    """Centralized option trading utility functions to avoid duplication"""
    
    @staticmethod
    def GetDTE(contract, algorithm=None) -> int:
        """Calculate days to expiration for an option contract
        
        Args:
            contract: Option contract with Expiry property
            algorithm: QC Algorithm instance (optional, for accurate time)
            
        Returns:
            Days to expiration (negative if expired)
        """
        try:
            if hasattr(contract, 'Expiry'):
                # Use algorithm time if provided, otherwise use contract's Time property
                if algorithm:
                    current_date = algorithm.Time.date()
                elif hasattr(contract, 'Time'):
                    current_date = contract.Time.date()
                else:
                    # Last resort: use datetime.now() but this is inaccurate in backtests
                    current_date = datetime.now().date()
                
                days = (contract.Expiry.date() - current_date).days
                return days
            return 0
        except Exception as e:
            if algorithm:
                algorithm.Error(f"Error calculating DTE: {e}")
            return 0
    
    @staticmethod
    def GetATMIV(algorithm, underlying: str, atm_strike: float) -> float:
        """
        Get ATM implied volatility with consistent implementation
        
        Args:
            algorithm: QC Algorithm instance
            underlying: Underlying symbol
            atm_strike: At-the-money strike price
            
        Returns:
            Implied volatility (minimum 0.10)
        """
        try:
            option_chains = algorithm.CurrentSlice.OptionChains
            
            for kvp in option_chains:
                chain = kvp.Value
                if chain.Underlying.Symbol.Value == underlying:
                    # Find ATM contract
                    atm_contracts = [c for c in chain 
                                   if abs(c.Strike - atm_strike) < 1.0]
                    
                    if atm_contracts:
                        atm_contract = min(atm_contracts, 
                                         key=lambda x: abs(x.Strike - atm_strike))
                        return max(atm_contract.ImpliedVolatility, 0.10)
            
            # Default fallback
            return 0.20
            
        except Exception as e:
            algorithm.Debug(f"GetATMIV error: {e}")
            return 0.20
    
    @staticmethod
    def FilterOptionChain(chain, underlying_price: float, dte_min: int, 
                         dte_max: int, moneyness_min: float = 0.8, 
                         moneyness_max: float = 1.2, algorithm=None) -> List:
        """
        Filter option chain by DTE and moneyness criteria
        
        Args:
            chain: Option chain to filter
            underlying_price: Current underlying price
            dte_min: Minimum days to expiration
            dte_max: Maximum days to expiration
            moneyness_min: Minimum moneyness (0.8 = 20% OTM)
            moneyness_max: Maximum moneyness (1.2 = 20% ITM)
            
        Returns:
            Filtered list of option contracts
        """
        filtered = []
        
        for contract in chain:
            dte = OptionUtils.GetDTE(contract, algorithm)
            
            # Check DTE
            if dte < dte_min or dte > dte_max:
                continue
            
            # Check moneyness
            moneyness = contract.Strike / underlying_price
            if moneyness < moneyness_min or moneyness > moneyness_max:
                continue
            
            filtered.append(contract)
        
        return filtered
    
    @staticmethod
    def FindClosestStrike(contracts: List, target_strike: float):
        """
        Find contract closest to target strike price
        
        Args:
            contracts: List of option contracts
            target_strike: Target strike price
            
        Returns:
            Closest option contract or None
        """
        if not contracts:
            return None
        
        return min(contracts, key=lambda x: abs(x.Strike - target_strike))
    
    @staticmethod
    def CalculatePositionSize(algorithm, max_loss: float, credit: float) -> int:
        """
        Calculate position size based on max loss and available capital
        
        Args:
            algorithm: QC Algorithm instance
            max_loss: Maximum loss per contract
            credit: Credit received per contract
            
        Returns:
            Number of contracts to trade
        """
        try:
            # Get available capital (use 50% of buying power)
            available = algorithm.Portfolio.MarginRemaining * 0.5
            
            # Risk per trade (2% of portfolio)
            max_risk = algorithm.Portfolio.TotalPortfolioValue * 0.02
            
            # Calculate based on max loss
            if max_loss > 0:
                size_by_loss = int(max_risk / max_loss)
            else:
                size_by_loss = 1
            
            # Calculate based on available capital
            if credit > 0:
                size_by_capital = int(available / (max_loss - credit))
            else:
                size_by_capital = 1
            
            # Take the minimum, with a cap
            position_size = min(size_by_loss, size_by_capital, 10)
            
            return max(1, position_size)
            
        except Exception as e:
            algorithm.Debug(f"Position sizing error: {e}")
            return 1
    
    @staticmethod
    def ValidateSpread(short_strike: float, long_strike: float, 
                       spread_type: str = "credit") -> bool:
        """
        Validate option spread structure
        
        Args:
            short_strike: Short option strike
            long_strike: Long option strike
            spread_type: Type of spread (credit/debit)
            
        Returns:
            True if spread structure is valid
        """
        if spread_type == "credit":
            # For credit spreads, short strike should be closer to money
            return abs(short_strike) < abs(long_strike)
        else:
            # For debit spreads, long strike should be closer to money
            return abs(long_strike) < abs(short_strike)
    
    @staticmethod
    def GetOptionGreeks(contract) -> Dict:
        """
        Extract Greeks from option contract
        
        Args:
            contract: Option contract
            
        Returns:
            Dictionary of Greeks values
        """
        try:
            return {
                'delta': contract.Greeks.Delta if hasattr(contract.Greeks, 'Delta') else 0,
                'gamma': contract.Greeks.Gamma if hasattr(contract.Greeks, 'Gamma') else 0,
                'theta': contract.Greeks.Theta if hasattr(contract.Greeks, 'Theta') else 0,
                'vega': contract.Greeks.Vega if hasattr(contract.Greeks, 'Vega') else 0,
                'rho': contract.Greeks.Rho if hasattr(contract.Greeks, 'Rho') else 0
            }
        except Exception:
            return {'delta': 0, 'gamma': 0, 'theta': 0, 'vega': 0, 'rho': 0}
    
    @staticmethod
    def CheckAssignmentRisk(contract, underlying_price: float, 
                           dte: int, option_type: str = "put") -> bool:
        """
        Check if option has assignment risk per Tom King rules
        
        Args:
            contract: Option contract
            underlying_price: Current underlying price
            dte: Days to expiration
            option_type: Type of option (put/call)
            
        Returns:
            True if assignment risk exists
        """
        if option_type == "put":
            # Tom King: Exit puts if > 2% ITM
            itm_percent = (contract.Strike - underlying_price) / underlying_price
            return itm_percent > 0.02 and dte <= 21
        else:
            # Tom King: Exit calls if > 1% ITM
            itm_percent = (underlying_price - contract.Strike) / underlying_price
            return itm_percent > 0.01 and dte <= 21
    
    @staticmethod
    def CalculateExpectedMove(iv: float, underlying_price: float, dte: int) -> float:
        """
        Calculate expected move based on implied volatility
        
        Args:
            iv: Implied volatility
            underlying_price: Current underlying price
            dte: Days to expiration
            
        Returns:
            Expected move in dollars
        """
        try:
            # Convert annual IV to period IV
            period_iv = iv * np.sqrt(dte / 365)
            
            # Calculate expected move (1 standard deviation)
            expected_move = underlying_price * period_iv
            
            return expected_move
            
        except Exception:
            return underlying_price * 0.02  # Default 2% move