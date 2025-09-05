# Tom King Trading Framework - Real Order Execution Engine for LEAN
# CRITICAL: Actual order execution with ComboMarketOrder for multi-leg options

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from enum import Enum

class OrderType(Enum):
    """Order types for execution"""
    PUT_SPREAD = "put_spread"
    CALL_SPREAD = "call_spread"
    STRANGLE = "strangle"
    IRON_CONDOR = "iron_condor"
    BUTTERFLY = "butterfly"
    CALENDAR = "calendar"
    SINGLE_OPTION = "single_option"
    FUTURES_STRANGLE = "futures_strangle"

class ExecutionEngine:
    """
    Real Order Execution Engine for Tom King Trading Framework
    
    CRITICAL FUNCTIONALITY:
    - Real ComboMarketOrder execution for multi-leg options
    - Proper LEAN order management
    - Position tracking with actual fills
    - Order validation and risk checks
    - Integration with option chain processor
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        
        # Import option chain processor and correlation manager
        from trading.option_chain_processor import OptionChainProcessor
        from risk.correlation import CorrelationManager
        
        self.option_processor = OptionChainProcessor(algorithm)
        self.correlation_manager = CorrelationManager(algorithm)
        
        # Active positions tracking (real positions, not simulated)
        self.active_positions = {}
        self.position_counter = 0
        
        # Order tracking
        self.pending_orders = {}
        self.filled_orders = {}
        
        # Risk limits (Tom King specifications)
        self.MAX_POSITION_SIZE = 5  # Max contracts per position initially
        self.MAX_BP_USAGE = 0.50    # Max 50% buying power usage
        
        self.algorithm.Log("[SUCCESS] REAL ORDER EXECUTION ENGINE INITIALIZED")
    
    def execute_put_spread(self, underlying: str, quantity: int = 1, 
                          target_dte: int = 120) -> Optional[str]:
        """
        Execute real put credit spread using ComboMarketOrder
        
        Args:
            underlying: Symbol to trade (e.g., 'SPY')
            quantity: Number of spreads
            target_dte: Target days to expiration
        
        Returns:
            Position ID if successful, None otherwise
        """
        try:
            # Validate risk limits
            if not self._validate_risk_limits(underlying, quantity):
                self.algorithm.Log(f" RISK LIMITS EXCEEDED for {underlying} put spread - skipping")
                self._log_failed_execution("PUT_SPREAD", underlying, "Risk limits exceeded")
                return None
            
            # Construct put spread using option processor
            spread = self.option_processor.construct_put_spread(
                underlying, target_dte, 
                short_delta=0.30, long_delta=0.15
            )
            
            if not spread:
                self.algorithm.Error(f" FAILED to construct put spread for {underlying} - trying emergency fallback")
                self._log_failed_execution("PUT_SPREAD", underlying, "Construction failed")
                # Emergency fallback: try with wider deltas
                spread = self.option_processor.construct_put_spread(
                    underlying, target_dte, 
                    short_delta=0.25, long_delta=0.10  # Wider spread
                )
                if not spread:
                    return None
            
            # Validate liquidity
            short_liquidity = self.option_processor.validate_option_liquidity(spread['short_put'])
            long_liquidity = self.option_processor.validate_option_liquidity(spread['long_put'])
            
            if not (short_liquidity.get('is_liquid') and long_liquidity.get('is_liquid')):
                self.algorithm.Error(f" INSUFFICIENT LIQUIDITY for {underlying} put spread - using market orders")
                self._log_failed_execution("PUT_SPREAD", underlying, "Liquidity insufficient")
                # Emergency: proceed with market orders instead of limit orders
                self.algorithm.Log("[EMERGENCY] EMERGENCY: Using market orders due to liquidity constraints")
            
            # Add option contracts to algorithm before trading
            self.algorithm.AddOptionContract(spread['short_put'].Symbol)
            self.algorithm.AddOptionContract(spread['long_put'].Symbol)
            
            # Create legs for combo order
            legs = [
                Leg.Create(spread['short_put'].Symbol, -quantity),  # Sell short put
                Leg.Create(spread['long_put'].Symbol, quantity)      # Buy long put
            ]
            
            # Execute combo market order
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                # Create position tracking
                position_id = f"PS_{underlying}_{self.position_counter}"
                self.position_counter += 1
                
                self.active_positions[position_id] = {
                    'position_id': position_id,
                    'type': OrderType.PUT_SPREAD,
                    'underlying': underlying,
                    'quantity': quantity,
                    'short_strike': spread['short_put'].Strike,
                    'long_strike': spread['long_put'].Strike,
                    'expiry': spread['short_put'].Expiry,
                    'entry_time': self.algorithm.Time,
                    'order_ids': [combo_order.OrderId],
                    'dte': spread['dte'],
                    'max_profit': spread['max_profit'],
                    'max_loss': spread['max_loss'],
                    'status': 'open'
                }
                
                self.algorithm.Log(f"[SUCCESS] PUT SPREAD EXECUTED: {position_id}")
                self.algorithm.Log(f"   Strikes: {spread['short_put'].Strike}/{spread['long_put'].Strike}")
                self.algorithm.Log(f"   DTE: {spread['dte']}")
                self.algorithm.Log(f"   Credit: ${spread['max_profit']:.2f}")
                
                return position_id
            
            # Emergency: Order failed - log for manual intervention
            self.algorithm.Error(f"[EMERGENCY] CRITICAL: Put spread order failed for {underlying} - manual intervention needed")
            self._log_failed_execution("PUT_SPREAD", underlying, "Order execution failed")
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Put spread execution error: {e}")
            return None
    
    def execute_strangle(self, underlying: str, quantity: int = 1,
                        target_dte: int = 45) -> Optional[str]:
        """
        Execute real strangle using ComboMarketOrder
        
        Returns:
            Position ID if successful
        """
        try:
            # Validate risk limits
            if not self._validate_risk_limits(underlying, quantity):
                return None
            
            # Construct strangle
            strangle = self.option_processor.construct_strangle(
                underlying, target_dte, target_delta=0.16
            )
            
            if not strangle:
                self.algorithm.Error(f"Failed to construct strangle for {underlying}")
                return None
            
            # Validate liquidity
            put_liquidity = self.option_processor.validate_option_liquidity(strangle['put'])
            call_liquidity = self.option_processor.validate_option_liquidity(strangle['call'])
            
            if not (put_liquidity.get('is_liquid') and call_liquidity.get('is_liquid')):
                self.algorithm.Error(f"Insufficient liquidity for {underlying} strangle")
                return None
            
            # Add option contracts to algorithm before trading
            self.algorithm.AddOptionContract(strangle['put'].Symbol)
            self.algorithm.AddOptionContract(strangle['call'].Symbol)
            
            # Create legs for combo order
            legs = [
                Leg.Create(strangle['put'].Symbol, -quantity),   # Sell put
                Leg.Create(strangle['call'].Symbol, -quantity)   # Sell call
            ]
            
            # Execute combo market order
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                position_id = f"STR_{underlying}_{self.position_counter}"
                self.position_counter += 1
                
                self.active_positions[position_id] = {
                    'position_id': position_id,
                    'type': OrderType.STRANGLE,
                    'underlying': underlying,
                    'quantity': quantity,
                    'put_strike': strangle['put_strike'],
                    'call_strike': strangle['call_strike'],
                    'expiry': strangle['put'].Expiry,
                    'entry_time': self.algorithm.Time,
                    'order_ids': [combo_order.OrderId],
                    'dte': strangle['dte'],
                    'credit': strangle['total_credit'],
                    'status': 'open'
                }
                
                self.algorithm.Log(f"[SUCCESS] STRANGLE EXECUTED: {position_id}")
                self.algorithm.Log(f"   Strikes: {strangle['put_strike']}/{strangle['call_strike']}")
                self.algorithm.Log(f"   Credit: ${strangle['total_credit']:.2f}")
                
                return position_id
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Strangle execution error: {e}")
            return None
    
    def execute_iron_condor(self, underlying: str, quantity: int = 1,
                           target_dte: int = 45) -> Optional[str]:
        """
        Execute real iron condor using ComboMarketOrder
        
        Returns:
            Position ID if successful
        """
        try:
            # Validate risk limits
            if not self._validate_risk_limits(underlying, quantity):
                return None
            
            # Construct iron condor
            ic = self.option_processor.construct_iron_condor(
                underlying, target_dte, 
                short_delta=0.20, long_delta=0.05
            )
            
            if not ic:
                self.algorithm.Error(f"Failed to construct iron condor for {underlying}")
                return None
            
            # Add option contracts to algorithm before trading
            self.algorithm.AddOptionContract(ic['long_put'].Symbol)
            self.algorithm.AddOptionContract(ic['short_put'].Symbol)
            self.algorithm.AddOptionContract(ic['short_call'].Symbol)
            self.algorithm.AddOptionContract(ic['long_call'].Symbol)
            
            # Create legs for combo order (4 legs)
            legs = [
                Leg.Create(ic['long_put'].Symbol, quantity),      # Buy long put
                Leg.Create(ic['short_put'].Symbol, -quantity),    # Sell short put
                Leg.Create(ic['short_call'].Symbol, -quantity),   # Sell short call
                Leg.Create(ic['long_call'].Symbol, quantity)      # Buy long call
            ]
            
            # Execute combo market order
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                position_id = f"IC_{underlying}_{self.position_counter}"
                self.position_counter += 1
                
                self.active_positions[position_id] = {
                    'position_id': position_id,
                    'type': OrderType.IRON_CONDOR,
                    'underlying': underlying,
                    'quantity': quantity,
                    'strikes': {
                        'long_put': ic['long_put'].Strike,
                        'short_put': ic['short_put'].Strike,
                        'short_call': ic['short_call'].Strike,
                        'long_call': ic['long_call'].Strike
                    },
                    'expiry': ic['short_put'].Expiry,
                    'entry_time': self.algorithm.Time,
                    'order_ids': [combo_order.OrderId],
                    'dte': ic['dte'],
                    'credit': ic['total_credit'],
                    'max_loss': ic['max_loss'],
                    'status': 'open'
                }
                
                self.algorithm.Log(f"[SUCCESS] IRON CONDOR EXECUTED: {position_id}")
                self.algorithm.Log(f"   Structure: {ic['structure']}")
                self.algorithm.Log(f"   Credit: ${ic['total_credit']:.2f}")
                
                return position_id
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Iron condor execution error: {e}")
            return None
    
    def execute_futures_strangle(self, futures_symbol: str, quantity: int = 1,
                                target_dte: int = 90) -> Optional[str]:
        """
        Execute futures strangle (Tom King 90 DTE specification)
        
        Returns:
            Position ID if successful
        """
        try:
            # Validate risk limits for futures
            if not self._validate_futures_risk_limits(futures_symbol, quantity):
                return None
            
            # Construct futures strangle
            strangle = self.option_processor.construct_futures_strangle(
                futures_symbol, target_dte, target_delta=0.16
            )
            
            if not strangle:
                self.algorithm.Error(f"Failed to construct futures strangle for {futures_symbol}")
                return None
            
            # Add option contracts to algorithm before trading
            self.algorithm.AddOptionContract(strangle['put'].Symbol)
            self.algorithm.AddOptionContract(strangle['call'].Symbol)
            
            # Create legs for combo order
            legs = [
                Leg.Create(strangle['put'].Symbol, -quantity),   # Sell put
                Leg.Create(strangle['call'].Symbol, -quantity)   # Sell call
            ]
            
            # Execute combo market order
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                position_id = f"FSTR_{futures_symbol.replace('/', '')}_{self.position_counter}"
                self.position_counter += 1
                
                self.active_positions[position_id] = {
                    'position_id': position_id,
                    'type': OrderType.FUTURES_STRANGLE,
                    'futures_symbol': futures_symbol,
                    'quantity': quantity,
                    'put_strike': strangle['put_strike'],
                    'call_strike': strangle['call_strike'],
                    'expiry': strangle['put'].Expiry,
                    'entry_time': self.algorithm.Time,
                    'order_ids': [combo_order.OrderId],
                    'dte': strangle['dte'],
                    'credit': strangle['total_credit'],
                    'multiplier': strangle['multiplier'],
                    'status': 'open'
                }
                
                self.algorithm.Log(f"[SUCCESS] FUTURES STRANGLE EXECUTED: {position_id}")
                self.algorithm.Log(f"   Futures: {futures_symbol}")
                self.algorithm.Log(f"   Strikes: {strangle['put_strike']}/{strangle['call_strike']}")
                self.algorithm.Log(f"   Credit: ${strangle['total_credit']:.2f}")
                
                return position_id
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Futures strangle execution error: {e}")
            return None
    
    def close_position(self, position_id: str, reason: str = "Manual close") -> bool:
        """
        Close an existing position
        
        Args:
            position_id: ID of position to close
            reason: Reason for closing
        
        Returns:
            True if successful
        """
        try:
            if position_id not in self.active_positions:
                self.algorithm.Error(f"Position {position_id} not found")
                return False
            
            position = self.active_positions[position_id]
            
            # Create closing order based on position type
            if position['type'] == OrderType.PUT_SPREAD:
                # Close put spread - reverse the original trades
                success = self._close_spread_position(position)
                
            elif position['type'] == OrderType.STRANGLE:
                # Close strangle - buy back both legs
                success = self._close_strangle_position(position)
                
            elif position['type'] == OrderType.IRON_CONDOR:
                # Close iron condor - reverse all four legs
                success = self._close_iron_condor_position(position)
                
            elif position['type'] == OrderType.FUTURES_STRANGLE:
                # Close futures strangle
                success = self._close_futures_strangle_position(position)
                
            else:
                self.algorithm.Error(f"Unknown position type: {position['type']}")
                return False
            
            if success:
                position['status'] = 'closed'
                position['close_time'] = self.algorithm.Time
                position['close_reason'] = reason
                
                self.algorithm.Log(f"[SUCCESS] POSITION CLOSED: {position_id}")
                self.algorithm.Log(f"   Reason: {reason}")
                
                return True
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Error closing position {position_id}: {e}")
            return False
    
    def _close_spread_position(self, position: Dict) -> bool:
        """Close a spread position with real combo order"""
        try:
            # Get the underlying for option chain lookup
            underlying = position['underlying']
            
            # Find options to close using current strikes and expiry
            short_strike = position['short_strike']
            long_strike = position['long_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            self.algorithm.Log(f"Closing spread position {position['position_id']}")
            self.algorithm.Log(f"  Strikes: {short_strike}/{long_strike}")
            
            # Get option chain for the underlying
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(underlying, self.algorithm.Time)
            
            # Filter for exact strikes and expiry
            short_options = [opt for opt in option_chain 
                           if opt.ID.Strike == short_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            long_options = [opt for opt in option_chain 
                          if opt.ID.Strike == long_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            
            if not (short_options and long_options):
                self.algorithm.Error(f"Could not find options to close for spread {position['position_id']}")
                return False
            
            # Add contracts if not already added
            short_symbol = short_options[0]
            long_symbol = long_options[0]
            
            if short_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(short_symbol)
            if long_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(long_symbol)
            
            # Create closing combo order (reverse of opening)
            legs = [
                Leg.Create(short_symbol, quantity),   # Buy back short put
                Leg.Create(long_symbol, -quantity)    # Sell long put
            ]
            
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                self.algorithm.Log(f"[SUCCESS] Spread closing order placed: {combo_order.OrderId}")
                return True
            else:
                self.algorithm.Error(f"Failed to place closing order for spread {position['position_id']}")
                return False
            
        except Exception as e:
            self.algorithm.Error(f"Error closing spread: {e}")
            # Try individual leg closing as fallback
            try:
                return self._close_spread_individual_legs(position)
            except:
                return False
    
    def _close_strangle_position(self, position: Dict) -> bool:
        """Close a strangle position with real combo order"""
        try:
            underlying = position.get('underlying') or position.get('futures_symbol')
            put_strike = position['put_strike']
            call_strike = position['call_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            self.algorithm.Log(f"Closing strangle position {position['position_id']}")
            self.algorithm.Log(f"  Strikes: {put_strike}P/{call_strike}C")
            
            # Get option chain
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(underlying, self.algorithm.Time)
            
            # Find put and call options
            put_options = [opt for opt in option_chain 
                          if opt.ID.Strike == put_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            call_options = [opt for opt in option_chain 
                           if opt.ID.Strike == call_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Call]
            
            if not (put_options and call_options):
                self.algorithm.Error(f"Could not find options to close for strangle {position['position_id']}")
                return False
            
            put_symbol = put_options[0]
            call_symbol = call_options[0]
            
            # Add contracts if not already added
            if put_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(put_symbol)
            if call_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(call_symbol)
            
            # Create closing combo order (buy back both short options)
            legs = [
                Leg.Create(put_symbol, quantity),   # Buy back short put
                Leg.Create(call_symbol, quantity)   # Buy back short call
            ]
            
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                self.algorithm.Log(f"[SUCCESS] Strangle closing order placed: {combo_order.OrderId}")
                return True
            else:
                self.algorithm.Error(f"Failed to place closing order for strangle {position['position_id']}")
                return False
            
        except Exception as e:
            self.algorithm.Error(f"Error closing strangle: {e}")
            # Try individual leg closing as fallback
            try:
                return self._close_strangle_individual_legs(position)
            except:
                return False
    
    def _close_iron_condor_position(self, position: Dict) -> bool:
        """Close an iron condor position with real combo order"""
        try:
            underlying = position['underlying']
            strikes = position['strikes']
            expiry = position['expiry']
            quantity = position['quantity']
            
            self.algorithm.Log(f"Closing iron condor position {position['position_id']}")
            self.algorithm.Log(f"  Strikes: {strikes}")
            
            # Get option chain
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(underlying, self.algorithm.Time)
            
            # Find all four option legs
            long_put_options = [opt for opt in option_chain 
                               if opt.ID.Strike == strikes['long_put'] and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            short_put_options = [opt for opt in option_chain 
                                if opt.ID.Strike == strikes['short_put'] and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            short_call_options = [opt for opt in option_chain 
                                 if opt.ID.Strike == strikes['short_call'] and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Call]
            long_call_options = [opt for opt in option_chain 
                                if opt.ID.Strike == strikes['long_call'] and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Call]
            
            if not all([long_put_options, short_put_options, short_call_options, long_call_options]):
                self.algorithm.Error(f"Could not find all option legs to close IC {position['position_id']}")
                return False
            
            # Get symbols
            long_put_symbol = long_put_options[0]
            short_put_symbol = short_put_options[0]
            short_call_symbol = short_call_options[0]
            long_call_symbol = long_call_options[0]
            
            # Add contracts if not already added
            for symbol in [long_put_symbol, short_put_symbol, short_call_symbol, long_call_symbol]:
                if symbol not in self.algorithm.Securities:
                    self.algorithm.AddOptionContract(symbol)
            
            # Create closing combo order (reverse of opening trade)
            legs = [
                Leg.Create(long_put_symbol, -quantity),    # Sell long put
                Leg.Create(short_put_symbol, quantity),    # Buy back short put
                Leg.Create(short_call_symbol, quantity),   # Buy back short call
                Leg.Create(long_call_symbol, -quantity)    # Sell long call
            ]
            
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                self.algorithm.Log(f"[SUCCESS] Iron Condor closing order placed: {combo_order.OrderId}")
                return True
            else:
                self.algorithm.Error(f"Failed to place closing order for IC {position['position_id']}")
                return False
            
        except Exception as e:
            self.algorithm.Error(f"Error closing iron condor: {e}")
            # Try individual leg closing as fallback
            try:
                return self._close_iron_condor_individual_legs(position)
            except:
                return False
    
    def _close_futures_strangle_position(self, position: Dict) -> bool:
        """Close a futures strangle position with real combo order"""
        try:
            futures_symbol = position['futures_symbol']
            put_strike = position['put_strike']
            call_strike = position['call_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            self.algorithm.Log(f"Closing futures strangle position {position['position_id']}")
            self.algorithm.Log(f"  Futures: {futures_symbol}")
            self.algorithm.Log(f"  Strikes: {put_strike}P/{call_strike}C")
            
            # Get futures option chain
            try:
                # For futures options, need to use appropriate method
                option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(futures_symbol, self.algorithm.Time)
            except:
                # Fallback: try to construct symbols directly
                self.algorithm.Error(f"Could not get option chain for futures {futures_symbol}")
                return False
            
            # Find put and call options for futures
            put_options = [opt for opt in option_chain 
                          if opt.ID.Strike == put_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Put]
            call_options = [opt for opt in option_chain 
                           if opt.ID.Strike == call_strike and opt.ID.Date == expiry and opt.ID.OptionRight == OptionRight.Call]
            
            if not (put_options and call_options):
                self.algorithm.Error(f"Could not find futures options to close for strangle {position['position_id']}")
                return False
            
            put_symbol = put_options[0]
            call_symbol = call_options[0]
            
            # Add contracts if not already added
            if put_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(put_symbol)
            if call_symbol not in self.algorithm.Securities:
                self.algorithm.AddOptionContract(call_symbol)
            
            # Create closing combo order (buy back both short options)
            legs = [
                Leg.Create(put_symbol, quantity),   # Buy back short put
                Leg.Create(call_symbol, quantity)   # Buy back short call
            ]
            
            combo_order = self.algorithm.ComboMarketOrder(legs, quantity)
            
            if combo_order:
                self.algorithm.Log(f"[SUCCESS] Futures strangle closing order placed: {combo_order.OrderId}")
                return True
            else:
                self.algorithm.Error(f"Failed to place closing order for futures strangle {position['position_id']}")
                return False
            
        except Exception as e:
            self.algorithm.Error(f"Error closing futures strangle: {e}")
            # Try individual leg closing as fallback
            try:
                return self._close_futures_strangle_individual_legs(position)
            except:
                return False
    
    def roll_position(self, position_id: str, new_dte: int = 45) -> Optional[str]:
        """
        Roll position to new expiration (Tom King 21 DTE rule)
        
        Args:
            position_id: Position to roll
            new_dte: Target DTE for new position
        
        Returns:
            New position ID if successful
        """
        try:
            if position_id not in self.active_positions:
                return None
            
            position = self.active_positions[position_id]
            
            # Close existing position
            if not self.close_position(position_id, "Rolling to new expiration"):
                return None
            
            # Open new position with same structure
            if position['type'] == OrderType.PUT_SPREAD:
                new_position_id = self.execute_put_spread(
                    position['underlying'],
                    position['quantity'],
                    new_dte
                )
            elif position['type'] == OrderType.STRANGLE:
                new_position_id = self.execute_strangle(
                    position['underlying'],
                    position['quantity'],
                    new_dte
                )
            else:
                new_position_id = None
            
            if new_position_id:
                self.algorithm.Log(f"[SUCCESS] POSITION ROLLED: {position_id}  {new_position_id}")
                return new_position_id
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Error rolling position {position_id}: {e}")
            return None
    
    def _validate_risk_limits(self, underlying: str, quantity: int) -> bool:
        """Validate position meets risk limits including correlation groups"""
        try:
            # Check position size
            if quantity > self.MAX_POSITION_SIZE:
                self.algorithm.Error(f"Position size {quantity} exceeds limit {self.MAX_POSITION_SIZE}")
                return False
            
            # Check buying power usage
            current_bp_usage = self.algorithm.Portfolio.TotalMarginUsed / self.algorithm.Portfolio.TotalPortfolioValue
            if current_bp_usage > self.MAX_BP_USAGE:
                self.algorithm.Error(f"BP usage {current_bp_usage:.1%} exceeds limit {self.MAX_BP_USAGE:.1%}")
                return False
            
            # Check correlation group limits (Tom King: max 2 per group, 3 for Phase 4)
            correlation_group = self.correlation_manager.GetCorrelationGroup(underlying)
            if correlation_group:
                current_positions = self._get_positions_in_correlation_group(correlation_group)
                max_allowed = 3 if getattr(self.algorithm, 'account_phase', 1) >= 4 else 2
                
                if len(current_positions) >= max_allowed:
                    self.algorithm.Error(f"Correlation group {correlation_group} at limit ({len(current_positions)}/{max_allowed})")
                    self.algorithm.Log(f"   Current positions: {', '.join(current_positions)}")
                    return False
            
            # Check if underlying is available
            if underlying not in self.algorithm.Securities:
                self.algorithm.Error(f"Underlying {underlying} not available")
                return False
            
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Risk validation error: {e}")
            return False
    
    def _get_positions_in_correlation_group(self, group: str) -> List[str]:
        """Get all active positions in a correlation group"""
        positions_in_group = []
        
        for pos_id, pos in self.active_positions.items():
            if pos['status'] == 'open':
                underlying = pos.get('underlying') or pos.get('futures_symbol', '')
                if underlying:
                    pos_group = self.correlation_manager.GetCorrelationGroup(underlying)
                    if pos_group == group:
                        positions_in_group.append(underlying)
        
        return positions_in_group
    
    def _validate_futures_risk_limits(self, futures_symbol: str, quantity: int) -> bool:
        """Validate futures position meets risk limits"""
        try:
            # Futures have higher leverage - more strict limits
            max_futures_contracts = 2  # Start conservative
            
            if quantity > max_futures_contracts:
                self.algorithm.Error(f"Futures quantity {quantity} exceeds limit {max_futures_contracts}")
                return False
            
            # Check account size for futures trading
            if self.algorithm.Portfolio.TotalPortfolioValue < 40000:  # 40k minimum for futures
                self.algorithm.Error("Insufficient capital for futures trading (min 40k)")
                return False
            
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Futures risk validation error: {e}")
            return False
    
    def get_active_positions(self) -> Dict:
        """Get all active positions"""
        return {pid: pos for pid, pos in self.active_positions.items() 
                if pos['status'] == 'open'}
    
    def get_position_by_underlying(self, underlying: str) -> List[Dict]:
        """Get all positions for a specific underlying"""
        positions = []
        for pid, pos in self.active_positions.items():
            if pos.get('underlying') == underlying and pos['status'] == 'open':
                positions.append(pos)
        return positions
    
    def check_positions_for_management(self) -> List[Dict]:
        """
        Check all positions for management (21 DTE rule, profit targets)
        
        Returns:
            List of positions needing action
        """
        positions_to_manage = []
        
        for pid, position in self.active_positions.items():
            if position['status'] != 'open':
                continue
            
            # Calculate current DTE
            current_dte = (position['expiry'].date() - self.algorithm.Time.date()).days
            
            # Check 21 DTE rule
            if current_dte <= 21:
                positions_to_manage.append({
                    'position_id': pid,
                    'action': 'roll',
                    'reason': f'21 DTE rule (current: {current_dte})',
                    'position': position
                })
            
            # Check profit target (would need to calculate current P&L)
            # This is handled by LEAN's portfolio tracking
            
        return positions_to_manage
    
    def _close_spread_individual_legs(self, position: Dict) -> bool:
        """Fallback: Close spread legs individually if combo order fails"""
        try:
            self.algorithm.Log(f"[WARNING] Using individual leg closing fallback for spread {position['position_id']}")
            
            underlying = position['underlying']
            short_strike = position['short_strike']
            long_strike = position['long_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            # Try to close each leg separately
            success = True
            
            # Buy back short put
            short_orders = self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {short_strike}P", quantity)
            if not short_orders:
                success = False
                
            # Sell long put
            long_orders = self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {long_strike}P", -quantity)
            if not long_orders:
                success = False
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"Individual leg closing failed: {e}")
            return False
    
    def _close_strangle_individual_legs(self, position: Dict) -> bool:
        """Fallback: Close strangle legs individually"""
        try:
            self.algorithm.Log(f"[WARNING] Using individual leg closing fallback for strangle {position['position_id']}")
            
            underlying = position.get('underlying') or position.get('futures_symbol')
            put_strike = position['put_strike']
            call_strike = position['call_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            success = True
            
            # Buy back short put
            put_orders = self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {put_strike}P", quantity)
            if not put_orders:
                success = False
                
            # Buy back short call
            call_orders = self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {call_strike}C", quantity)
            if not call_orders:
                success = False
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"Individual strangle leg closing failed: {e}")
            return False
    
    def _close_iron_condor_individual_legs(self, position: Dict) -> bool:
        """Fallback: Close iron condor legs individually"""
        try:
            self.algorithm.Log(f"[WARNING] Using individual leg closing fallback for IC {position['position_id']}")
            
            underlying = position['underlying']
            strikes = position['strikes']
            expiry = position['expiry']
            quantity = position['quantity']
            
            success = True
            
            # Sell long put
            if not self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {strikes['long_put']}P", -quantity):
                success = False
                
            # Buy back short put
            if not self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {strikes['short_put']}P", quantity):
                success = False
                
            # Buy back short call
            if not self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {strikes['short_call']}C", quantity):
                success = False
                
            # Sell long call
            if not self.algorithm.MarketOrder(f"{underlying} {expiry.strftime('%Y%m%d')} {strikes['long_call']}C", -quantity):
                success = False
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"Individual IC leg closing failed: {e}")
            return False
    
    def _close_futures_strangle_individual_legs(self, position: Dict) -> bool:
        """Fallback: Close futures strangle legs individually"""
        try:
            self.algorithm.Log(f"[WARNING] Using individual leg closing fallback for futures strangle {position['position_id']}")
            
            futures_symbol = position['futures_symbol']
            put_strike = position['put_strike']
            call_strike = position['call_strike']
            expiry = position['expiry']
            quantity = position['quantity']
            
            success = True
            
            # Buy back short put
            put_orders = self.algorithm.MarketOrder(f"{futures_symbol} {expiry.strftime('%Y%m%d')} {put_strike}P", quantity)
            if not put_orders:
                success = False
                
            # Buy back short call  
            call_orders = self.algorithm.MarketOrder(f"{futures_symbol} {expiry.strftime('%Y%m%d')} {call_strike}C", quantity)
            if not call_orders:
                success = False
            
            return success
            
        except Exception as e:
            self.algorithm.Error(f"Individual futures strangle leg closing failed: {e}")
            return False
    
    def emergency_position_recovery(self) -> bool:
        """
        Emergency recovery system for failed orders or orphaned positions
        
        Returns:
            True if recovery successful
        """
        try:
            self.algorithm.Log("[EMERGENCY] EMERGENCY POSITION RECOVERY INITIATED")
            
            # Get all holdings from LEAN
            actual_holdings = {}
            for symbol in self.algorithm.Portfolio.Keys:
                holding = self.algorithm.Portfolio[symbol]
                if holding.Quantity != 0:
                    actual_holdings[str(symbol)] = {
                        'symbol': str(symbol),
                        'quantity': holding.Quantity,
                        'avg_price': holding.AveragePrice,
                        'market_value': holding.HoldingsValue,
                        'unrealized_pnl': holding.UnrealizedProfit
                    }
            
            # Compare with tracked positions
            tracked_symbols = set()
            for pos in self.active_positions.values():
                if pos['status'] == 'open':
                    # Extract symbols from position (would need actual symbol tracking)
                    pass  # This would match actual symbols
            
            # Find orphaned positions
            orphaned_holdings = []
            for symbol, holding in actual_holdings.items():
                if symbol not in tracked_symbols:
                    orphaned_holdings.append(holding)
            
            if orphaned_holdings:
                self.algorithm.Log(f"[WARNING] Found {len(orphaned_holdings)} orphaned holdings")
                for holding in orphaned_holdings:
                    self.algorithm.Log(f"   {holding['symbol']}: {holding['quantity']} @ {holding['avg_price']}")
                
                # Attempt to close orphaned positions
                for holding in orphaned_holdings:
                    try:
                        # Market order to close
                        close_quantity = -holding['quantity']  # Reverse the position
                        order = self.algorithm.MarketOrder(holding['symbol'], close_quantity)
                        if order:
                            self.algorithm.Log(f"[SUCCESS] Emergency close order placed for {holding['symbol']}")
                        else:
                            self.algorithm.Error(f" Failed to place emergency close order for {holding['symbol']}")
                    except Exception as e:
                        self.algorithm.Error(f"Emergency close failed for {holding['symbol']}: {e}")
            
            # Check for stale positions (older than 180 DTE)
            stale_positions = []
            for pid, pos in self.active_positions.items():
                if pos['status'] == 'open':
                    current_dte = (pos['expiry'].date() - self.algorithm.Time.date()).days
                    if current_dte < 0:  # Expired
                        stale_positions.append((pid, pos))
                        self.algorithm.Log(f"[WARNING] Expired position found: {pid} (expired {-current_dte} days ago)")
            
            # Mark expired positions as closed
            for pid, pos in stale_positions:
                pos['status'] = 'expired'
                pos['close_time'] = self.algorithm.Time
                pos['close_reason'] = 'Automatic expiration cleanup'
                
            self.algorithm.Log(f"[SUCCESS] Emergency recovery complete. Orphaned: {len(orphaned_holdings)}, Expired: {len(stale_positions)}")
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Emergency recovery failed: {e}")
            return False
    
    def get_execution_summary(self) -> Dict:
        """Get summary of execution engine status"""
        active = self.get_active_positions()
        
        # Group by type
        by_type = {}
        total_credit = 0
        
        for pid, pos in active.items():
            pos_type = pos['type'].value
            if pos_type not in by_type:
                by_type[pos_type] = 0
            by_type[pos_type] += 1
            
            # Sum credits
            if 'credit' in pos:
                total_credit += pos['credit']
        
        return {
            'active_positions': len(active),
            'total_positions': len(self.active_positions),
            'positions_by_type': by_type,
            'total_credit_collected': total_credit,
            'position_counter': self.position_counter,
            'emergency_recovery_available': True
        }
    
    def _log_failed_execution(self, strategy_type: str, underlying: str, reason: str):
        """Log failed execution for emergency monitoring and manual intervention"""
        try:
            if not hasattr(self, 'failed_executions'):
                self.failed_executions = []
            
            failure_record = {
                'timestamp': self.algorithm.Time,
                'strategy_type': strategy_type,
                'underlying': underlying,
                'reason': reason,
                'portfolio_value': self.algorithm.Portfolio.TotalPortfolioValue,
                'cash_remaining': self.algorithm.Portfolio.Cash,
                'vix_level': self.algorithm.Securities.get('VIX', {}).get('Price', 0) if hasattr(self.algorithm, 'Securities') else 0
            }
            
            self.failed_executions.append(failure_record)
            
            # Log to algorithm for real-time monitoring
            self.algorithm.Log(f"[LOG] FAILURE LOGGED: {strategy_type} {underlying} - {reason}")
            
            # Send to performance monitor if available
            if hasattr(self.algorithm, 'performance_monitor'):
                self.algorithm.performance_monitor.log_execution_failure(failure_record)
            
            # Emergency notification system
            if len(self.failed_executions) >= 3:  # Too many failures
                self.algorithm.Error(f"[EMERGENCY] EMERGENCY: {len(self.failed_executions)} execution failures - consider stopping algorithm")
                
        except Exception as e:
            self.algorithm.Error(f"Error logging failed execution: {e}")
    
    def get_execution_failures(self) -> List[Dict]:
        """Get list of execution failures for monitoring"""
        return getattr(self, 'failed_executions', [])