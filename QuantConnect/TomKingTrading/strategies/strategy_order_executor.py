# Strategy Order Executor - Converts strategy signals to actual orders
# Bridges the gap between strategy logic and order placement

from AlgorithmImports import *
from helpers.option_order_executor import OptionOrderExecutor

class StrategyOrderExecutor:
    """
    Executes orders for all strategies
    Converts order structures to actual market orders
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.order_helper = OptionOrderExecutor(algorithm)
    
    def execute_lt112_order(self, order_structure):
        """
        Execute LT112 (1-1-2 put ratio) order
        """
        try:
            underlying = order_structure['underlying']
            strikes = order_structure['structure']
            position_size = order_structure['position_size']
            expiry_date = order_structure['expiry_date']
            
            # Create option contracts
            # Debit spread - long put
            long_put = self.create_option_contract(
                underlying,
                strikes['debit_spread']['long_put']['strike'],
                expiry_date,
                OptionRight.Put
            )
            
            # Debit spread - short put
            short_put = self.create_option_contract(
                underlying,
                strikes['debit_spread']['short_put']['strike'],
                expiry_date,
                OptionRight.Put
            )
            
            # Naked puts (2x)
            naked_put = self.create_option_contract(
                underlying,
                strikes['naked_puts']['strike'],
                expiry_date,
                OptionRight.Put
            )
            
            # Place orders with limit pricing
            orders = []
            
            # Buy long put
            orders.append(self.order_helper.place_option_limit_order(
                long_put, position_size
            ))
            
            # Sell short put
            orders.append(self.order_helper.place_option_limit_order(
                short_put, -position_size
            ))
            
            # Sell 2 naked puts
            orders.append(self.order_helper.place_option_limit_order(
                naked_put, -position_size * 2
            ))
            
            # Check if all orders placed
            if all(orders):
                self.algo.Log(f"✅ LT112 order executed: {underlying}")
                return True, orders
            else:
                self.algo.Log(f"❌ LT112 order failed: {underlying}")
                return False, None
                
        except Exception as e:
            self.algo.Error(f"LT112 execution error: {str(e)}")
            return False, None
    
    def execute_futures_strangle(self, futures_symbol, call_strike, put_strike, expiry, quantity):
        """
        Execute futures strangle order
        """
        try:
            # Create option contracts
            call_contract = self.create_futures_option_contract(
                futures_symbol, call_strike, expiry, OptionRight.Call
            )
            
            put_contract = self.create_futures_option_contract(
                futures_symbol, put_strike, expiry, OptionRight.Put
            )
            
            # Place orders (sell both)
            call_order = self.order_helper.place_option_limit_order(
                call_contract, -quantity
            )
            
            put_order = self.order_helper.place_option_limit_order(
                put_contract, -quantity
            )
            
            if call_order and put_order:
                self.algo.Log(f"✅ Futures strangle executed: {futures_symbol}")
                return True, [call_order, put_order]
            else:
                self.algo.Log(f"❌ Futures strangle failed: {futures_symbol}")
                return False, None
                
        except Exception as e:
            self.algo.Error(f"Futures strangle execution error: {str(e)}")
            return False, None
    
    def execute_ipmcc_order(self, underlying, long_strike, short_strike, expiry, quantity):
        """
        Execute IPMCC (Income Poor Man's Covered Call) order
        """
        try:
            # Long dated long call (LEAP-like)
            long_expiry = self.algo.Time + timedelta(days=365)  # 1 year out
            long_call = self.create_option_contract(
                underlying, long_strike, long_expiry, OptionRight.Call
            )
            
            # Short dated short call (30-45 DTE)
            short_call = self.create_option_contract(
                underlying, short_strike, expiry, OptionRight.Call
            )
            
            # Place orders
            long_order = self.order_helper.place_option_limit_order(
                long_call, quantity
            )
            
            short_order = self.order_helper.place_option_limit_order(
                short_call, -quantity
            )
            
            if long_order and short_order:
                self.algo.Log(f"✅ IPMCC executed: {underlying}")
                return True, [long_order, short_order]
            else:
                self.algo.Log(f"❌ IPMCC failed: {underlying}")
                return False, None
                
        except Exception as e:
            self.algo.Error(f"IPMCC execution error: {str(e)}")
            return False, None
    
    def execute_leap_ladder(self, underlying, strikes, expiry, quantity):
        """
        Execute LEAP put ladder order
        """
        try:
            orders = []
            
            for strike in strikes:
                # Create LEAP put contract
                put_contract = self.create_option_contract(
                    underlying, strike, expiry, OptionRight.Put
                )
                
                # Sell the put
                order = self.order_helper.place_option_limit_order(
                    put_contract, -quantity
                )
                
                if order:
                    orders.append(order)
                else:
                    self.algo.Log(f"Failed to place LEAP put at strike {strike}")
            
            if len(orders) == len(strikes):
                self.algo.Log(f"✅ LEAP ladder executed: {underlying} with {len(strikes)} rungs")
                return True, orders
            else:
                self.algo.Log(f"❌ LEAP ladder partially failed: {len(orders)}/{len(strikes)} filled")
                return False, orders
                
        except Exception as e:
            self.algo.Error(f"LEAP ladder execution error: {str(e)}")
            return False, None
    
    def create_option_contract(self, underlying_symbol, strike, expiry, right):
        """
        Create and add option contract to algorithm
        """
        try:
            # Get the option contract from chain provider
            option = self.algo.OptionChainProvider.GetOptionContractList(
                underlying_symbol, self.algo.Time
            )
            
            # Filter to find exact contract
            contracts = [x for x in option 
                        if x.ID.StrikePrice == strike 
                        and x.ID.Date.date() == expiry.date()
                        and x.ID.OptionRight == right]
            
            if contracts:
                contract = contracts[0]
                # Add to algorithm if not already added
                if contract not in self.algo.Securities:
                    self.algo.AddOptionContract(contract)
                return self.algo.Securities[contract]
            else:
                # If exact contract not found, create it
                contract_symbol = Symbol.CreateOption(
                    underlying_symbol,
                    Market.USA,
                    OptionStyle.American,
                    right,
                    strike,
                    expiry
                )
                return self.algo.AddOptionContract(contract_symbol)
                
        except Exception as e:
            self.algo.Error(f"Failed to create option contract: {str(e)}")
            return None
    
    def create_futures_option_contract(self, futures_symbol, strike, expiry, right):
        """
        Create futures option contract
        """
        try:
            # For futures options, use FOP (Futures Options)
            option_symbol = Symbol.CreateOption(
                futures_symbol,
                Market.USA,
                OptionStyle.American,
                right,
                strike,
                expiry
            )
            
            return self.algo.AddFutureOption(option_symbol)
            
        except Exception as e:
            self.algo.Error(f"Failed to create futures option: {str(e)}")
            return None


# USAGE IN MAIN.PY:
#
# def Initialize(self):
#     self.order_executor = StrategyOrderExecutor(self)
#
# def execute_monthly_strategies(self):
#     # LT112 creates order structure
#     order_structure = self.lt112_strategy.create_lt112_order(strikes, size, symbol)
#     
#     # Execute the actual orders
#     success, orders = self.order_executor.execute_lt112_order(order_structure)
#     
#     if success:
#         # Track in dashboard
#         self.dashboard.add_position("LT112", {...})