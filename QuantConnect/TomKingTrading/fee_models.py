# region imports
from AlgorithmImports import *
from AlgorithmImports import FeeModel, OrderFee, CashAmount, OrderFeeParameters, SecurityType
# endregion

"""
Tom King Trading Framework - TastyTrade Fee Model
Implements accurate commission and fee structure for TastyTrade options and futures trading
"""

class TastyTradeFeeModel(FeeModel):
    """
    TastyTrade fee model for options and futures trading
    
    Commission structure:
    - Equity Options: $1.00 per contract, max $10 per leg, no ticket fee
    - Index Options: $1.00 per contract, max $10 per leg, no ticket fee  
    - Futures: $1.25 per contract + exchange fees
    - Micro Futures: $0.85 per contract + exchange fees
    - Stock: $0.00 commission
    - Closing trades under $0.05: $0.00 commission
    
    Additional fees:
    - Regulatory fees: ~$0.05 per trade
    - Exchange fees: Varies by exchange and product
    - Assignment/Exercise: $5.00
    """
    
    def __init__(self):
        """Initialize TastyTrade fee model with current commission structure"""
        # Option commission rates
        self.option_commission = 1.00  # Per contract
        self.option_max_per_leg = 10.00  # Max commission per leg
        self.option_closing_threshold = 0.05  # Free to close under this price
        
        # Futures commission rates  
        self.futures_commission = 1.25  # Standard futures per contract
        self.micro_futures_commission = 0.85  # Micro futures per contract
        
        # Stock commission
        self.stock_commission = 0.00  # Zero commission on stocks
        
        # Additional fees
        self.regulatory_fee = 0.05  # Estimated regulatory fee per trade
        self.assignment_fee = 5.00  # Assignment/exercise fee
        
        # Exchange fees (simplified - actual varies by exchange)
        self.exchange_fees = {
            'options': 0.50,  # Average exchange fee for options
            'futures': 1.50,  # Average exchange fee for futures
            'micro_futures': 0.50  # Average exchange fee for micro futures
        }
        
        # Micro futures symbols
        self.micro_futures_symbols = {
            'MCL', 'MGC', 'MES', 'MNQ', 'MYM', 'M2K',
            'MET', 'MBT', 'MHG', 'MSI', 'M6A', 'M6B',
            'M6E', 'MCD', 'MJY', 'MSF', 'MIR', 'M6J'
        }
    
    def GetOrderFee(self, parameters: OrderFeeParameters) -> OrderFee:
        """
        Calculate order fees for TastyTrade
        
        Args:
            parameters: Order fee parameters containing order details
            
        Returns:
            OrderFee with calculated commission and fees
        """
        order = parameters.Order
        security = parameters.Security
        
        # Get absolute quantity
        quantity = abs(order.Quantity)
        
        # Calculate base commission based on security type
        commission = 0.0
        exchange_fee = 0.0
        
        if security.Type == SecurityType.Option:
            commission, exchange_fee = self._calculate_option_fees(order, quantity)
            
        elif security.Type == SecurityType.Future:
            commission, exchange_fee = self._calculate_futures_fees(security.Symbol, quantity)
            
        elif security.Type == SecurityType.Equity:
            commission = self.stock_commission * quantity
            exchange_fee = 0.0
            
        elif security.Type == SecurityType.FutureOption:
            # Futures options treated similar to futures
            commission, exchange_fee = self._calculate_futures_option_fees(security.Symbol, quantity)
            
        else:
            # Default to no commission for unsupported types
            commission = 0.0
            exchange_fee = 0.0
        
        # Add regulatory fee (applied to all trades)
        regulatory = self.regulatory_fee if quantity > 0 else 0.0
        
        # Total fees
        total_fee = commission + exchange_fee + regulatory
        
        return OrderFee(CashAmount(total_fee, "USD"))
    
    def _calculate_option_fees(self, order, quantity: float) -> tuple:
        """
        Calculate option trading fees
        
        Args:
            order: The order object
            quantity: Number of contracts
            
        Returns:
            Tuple of (commission, exchange_fee)
        """
        # Check if closing trade under threshold (free to close)
        if hasattr(order, 'Tag') and 'close' in str(order.Tag).lower():
            # Check if premium is under threshold
            if hasattr(order, 'Price') and order.Price < self.option_closing_threshold:
                return (0.0, 0.0)
        
        # Calculate commission with max per leg
        commission = min(self.option_commission * quantity, self.option_max_per_leg)
        
        # Add exchange fees
        exchange_fee = self.exchange_fees['options'] * quantity
        
        return (commission, exchange_fee)
    
    def _calculate_futures_fees(self, symbol, quantity: float) -> tuple:
        """
        Calculate futures trading fees
        
        Args:
            symbol: Futures symbol
            quantity: Number of contracts
            
        Returns:
            Tuple of (commission, exchange_fee)
        """
        # Check if micro future
        symbol_str = str(symbol.Value) if hasattr(symbol, 'Value') else str(symbol)
        is_micro = any(symbol_str.startswith(micro) for micro in self.micro_futures_symbols)
        
        # Calculate commission
        if is_micro:
            commission = self.micro_futures_commission * quantity
            exchange_fee = self.exchange_fees['micro_futures'] * quantity
        else:
            commission = self.futures_commission * quantity
            exchange_fee = self.exchange_fees['futures'] * quantity
        
        return (commission, exchange_fee)
    
    def _calculate_futures_option_fees(self, symbol, quantity: float) -> tuple:
        """
        Calculate futures option trading fees
        
        Args:
            symbol: Futures option symbol
            quantity: Number of contracts
            
        Returns:
            Tuple of (commission, exchange_fee)
        """
        # Futures options follow similar structure to futures
        symbol_str = str(symbol.Value) if hasattr(symbol, 'Value') else str(symbol)
        is_micro = any(symbol_str.startswith(micro) for micro in self.micro_futures_symbols)
        
        if is_micro:
            commission = self.micro_futures_commission * quantity
            exchange_fee = self.exchange_fees['micro_futures'] * quantity
        else:
            commission = self.futures_commission * quantity
            exchange_fee = self.exchange_fees['futures'] * quantity
        
        return (commission, exchange_fee)
    
    def GetAssignmentFee(self) -> float:
        """Get assignment/exercise fee"""
        return self.assignment_fee
    
    def GetEstimatedTotalFees(self, order_type: str, quantity: int, 
                            is_micro: bool = False, is_closing: bool = False) -> float:
        """
        Get estimated total fees for planning purposes
        
        Args:
            order_type: 'option', 'future', or 'stock'
            quantity: Number of contracts/shares
            is_micro: True for micro futures
            is_closing: True if closing position
            
        Returns:
            Estimated total fees
        """
        if order_type == 'option':
            if is_closing:
                # Assume closing at low price (free)
                return self.regulatory_fee
            commission = min(self.option_commission * quantity, self.option_max_per_leg)
            exchange = self.exchange_fees['options'] * quantity
            return commission + exchange + self.regulatory_fee
            
        elif order_type == 'future':
            if is_micro:
                commission = self.micro_futures_commission * quantity
                exchange = self.exchange_fees['micro_futures'] * quantity
            else:
                commission = self.futures_commission * quantity
                exchange = self.exchange_fees['futures'] * quantity
            return commission + exchange + self.regulatory_fee
            
        elif order_type == 'stock':
            return self.regulatory_fee  # Only regulatory fee for stocks
            
        return 0.0


class InteractiveBrokersFeeModel(FeeModel):
    """
    Interactive Brokers fee model for options and futures trading
    
    Commission structure (Tiered):
    - Options: $0.15-$0.65 per contract based on volume
    - Futures: $0.25-$0.85 per contract
    - Stock: $0.0035 per share, min $0.35, max $1.00
    """
    
    def __init__(self):
        """Initialize IB fee model"""
        # Option commission (using mid-tier rate)
        self.option_commission = 0.50  # Per contract
        
        # Futures commission
        self.futures_commission = 0.85  # Per contract
        self.micro_futures_commission = 0.25  # Micro futures
        
        # Stock commission
        self.stock_per_share = 0.0035
        self.stock_minimum = 0.35
        self.stock_maximum = 1.00
        
        # Micro futures symbols
        self.micro_futures_symbols = {
            'MCL', 'MGC', 'MES', 'MNQ', 'MYM', 'M2K'
        }
    
    def GetOrderFee(self, parameters: OrderFeeParameters) -> OrderFee:
        """Calculate order fees for Interactive Brokers"""
        order = parameters.Order
        security = parameters.Security
        quantity = abs(order.Quantity)
        
        commission = 0.0
        
        if security.Type == SecurityType.Option:
            commission = self.option_commission * quantity
            
        elif security.Type == SecurityType.Future:
            symbol_str = str(security.Symbol.Value)
            is_micro = any(symbol_str.startswith(micro) for micro in self.micro_futures_symbols)
            
            if is_micro:
                commission = self.micro_futures_commission * quantity
            else:
                commission = self.futures_commission * quantity
                
        elif security.Type == SecurityType.Equity:
            commission = self.stock_per_share * quantity
            commission = max(self.stock_minimum, min(commission, self.stock_maximum))
        
        return OrderFee(CashAmount(commission, "USD"))