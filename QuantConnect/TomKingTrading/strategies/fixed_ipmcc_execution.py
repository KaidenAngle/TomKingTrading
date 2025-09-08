#!/usr/bin/env python3
"""
FIXED IPMCC Execution Logic - Properly Handles Existing LEAPs
This replaces the broken execute_ipmcc_entry method
"""

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class FixedIPMCCExecution:
    """
    Fixed IPMCC execution that properly manages existing LEAPs vs creating new ones
    """
    
    def __init__(self, algorithm, position_state_manager):
        self.algo = algorithm
        self.psm = position_state_manager  # Position State Manager
        
    def execute_ipmcc_strategy(self, symbol: str, account_value: float, vix_level: float = None) -> Tuple[bool, str]:
        """
        FIXED IPMCC execution - checks for existing LEAPs first!
        
        Logic:
        1. Check if we have an active LEAP for this symbol
        2. If YES: Only add weekly call against existing LEAP
        3. If NO: Create new LEAP + weekly call position
        """
        try:
            # CRITICAL CHECK: Do we already have an active LEAP for this symbol?
            existing_leap = self.psm.has_active_leap(symbol)
            
            if existing_leap:
                # SCENARIO 1: We have an active LEAP - only add weekly call
                self.algo.Log(f"🔄 IPMCC: Found existing LEAP for {symbol}, adding weekly call only")
                return self._add_weekly_call_to_existing_leap(symbol, existing_leap)
                
            else:
                # SCENARIO 2: No active LEAP - create complete new IPMCC position
                self.algo.Log(f"🆕 IPMCC: No existing LEAP for {symbol}, creating new position")
                return self._create_new_ipmcc_position(symbol, account_value, vix_level)
                
        except Exception as e:
            self.algo.Error(f"IPMCC execution error for {symbol}: {str(e)}")
            return False, f"Execution error: {str(e)}"
            
    def _add_weekly_call_to_existing_leap(self, symbol: str, existing_leap) -> Tuple[bool, str]:
        """Add weekly call to existing LEAP position"""
        try:
            # Get current price and calculate weekly call strike
            current_price = float(self.algo.Securities[symbol].Price)
            
            # Calculate weekly call strike (typically 2-5% OTM)
            weekly_strike = self._calculate_weekly_call_strike(current_price, existing_leap.strike)
            
            # Get option chain for weekly options
            weekly_expiry = self._get_next_weekly_expiry()
            option_chain = self.algo.OptionChainProvider.GetOptionContractList(symbol, self.algo.Time)
            
            # Find suitable weekly call contract
            weekly_contracts = [c for c in option_chain 
                              if c.ID.OptionRight == OptionRight.Call and 
                              abs((c.ID.Date - weekly_expiry).days) <= 3 and
                              abs(c.ID.StrikePrice - weekly_strike) <= 5]
            
            if not weekly_contracts:
                return False, f"No suitable weekly call found for {symbol}"
                
            weekly_call = min(weekly_contracts, key=lambda c: abs(c.ID.StrikePrice - weekly_strike))
            
            # Register and execute weekly call
            self.algo.AddOptionContract(weekly_call)
            
            # Calculate position size (match existing LEAP quantity)
            quantity = abs(existing_leap.quantity)
            
            # Sell weekly call
            weekly_order = self.algo.MarketOrder(weekly_call, -quantity)
            
            if weekly_order:
                # Track the new weekly call component
                component_id = self.psm.add_ipmcc_weekly_call(
                    symbol=symbol,
                    weekly_contract=str(weekly_call),
                    quantity=quantity,
                    strike=weekly_call.ID.StrikePrice,
                    expiry=weekly_call.ID.Date
                )
                
                self.algo.Log(f"✅ IPMCC Weekly Added: {symbol} strike {weekly_call.ID.StrikePrice} against existing LEAP")
                return True, f"Weekly call added to existing IPMCC position"
            else:
                return False, "Weekly call order failed"
                
        except Exception as e:
            self.algo.Error(f"Error adding weekly call: {str(e)}")
            return False, f"Weekly call error: {str(e)}"
            
    def _create_new_ipmcc_position(self, symbol: str, account_value: float, vix_level: float) -> Tuple[bool, str]:
        """Create brand new IPMCC position (LEAP + weekly call)"""
        try:
            current_price = float(self.algo.Securities[symbol].Price)
            
            # Find suitable LEAP (365 DTE, ~80 delta)
            leap_contract, leap_analysis = self._find_suitable_leap(symbol, current_price)
            if not leap_contract:
                return False, "No suitable LEAP found"
                
            # Find suitable weekly call
            weekly_call, weekly_analysis = self._find_suitable_weekly_call(symbol, current_price, leap_contract.ID.StrikePrice)
            if not weekly_call:
                return False, "No suitable weekly call found"
                
            # Calculate position size
            quantity = self._calculate_position_size(account_value, current_price, leap_contract.ID.StrikePrice)
            
            # Register contracts
            self.algo.AddOptionContract(leap_contract)
            self.algo.AddOptionContract(weekly_call)
            
            # Execute orders
            leap_order = self.algo.MarketOrder(leap_contract, quantity)  # Buy LEAP
            weekly_order = self.algo.MarketOrder(weekly_call, -quantity)  # Sell weekly
            
            if leap_order and weekly_order:
                # Create position in state manager
                position_id = self.psm.create_ipmcc_position(symbol)
                
                # Add LEAP component
                self.psm.add_ipmcc_leap(
                    position_id=position_id,
                    leap_contract=str(leap_contract),
                    quantity=quantity,
                    strike=leap_contract.ID.StrikePrice,
                    expiry=leap_contract.ID.Date
                )
                
                # Add weekly call component
                self.psm.add_ipmcc_weekly_call(
                    symbol=symbol,
                    weekly_contract=str(weekly_call),
                    quantity=quantity,
                    strike=weekly_call.ID.StrikePrice,
                    expiry=weekly_call.ID.Date
                )
                
                self.algo.Log(f"✅ NEW IPMCC Created: {symbol} LEAP@{leap_contract.ID.StrikePrice} + Weekly@{weekly_call.ID.StrikePrice}")
                return True, f"New IPMCC position created successfully"
            else:
                return False, "Order execution failed"
                
        except Exception as e:
            self.algo.Error(f"Error creating new IPMCC: {str(e)}")
            return False, f"New IPMCC error: {str(e)}"
            
    def _find_suitable_leap(self, symbol: str, current_price: float) -> Tuple[Optional[object], Optional[Dict]]:
        """Find suitable LEAP contract (365+ DTE, ~80 delta)"""
        try:
            option_chain = self.algo.OptionChainProvider.GetOptionContractList(symbol, self.algo.Time)
            
            # Filter for LEAP calls (300+ DTE)
            target_expiry = self.algo.Time + timedelta(days=365)
            leap_candidates = [c for c in option_chain 
                             if c.ID.OptionRight == OptionRight.Call and 
                             (c.ID.Date - self.algo.Time).days >= 300]
            
            if not leap_candidates:
                self.algo.Debug(f"No LEAP candidates found for {symbol} with 300+ DTE")
                return None, None
                
            # Find ~80 delta strike (roughly 15-20% OTM)
            target_leap_strike = current_price * 0.82  # Rough 80 delta approximation
            best_leap = min(leap_candidates, key=lambda c: abs(c.ID.StrikePrice - target_leap_strike))
            
            analysis = {
                'strike': best_leap.ID.StrikePrice,
                'dte': (best_leap.ID.Date - self.algo.Time).days,
                'estimated_delta': 0.80,
                'moneyness': best_leap.ID.StrikePrice / current_price
            }
            
            return best_leap, analysis
            
        except Exception as e:
            self.algo.Error(f"Error finding LEAP: {str(e)}")
            return None, None
            
    def _find_suitable_weekly_call(self, symbol: str, current_price: float, leap_strike: float) -> Tuple[Optional[object], Optional[Dict]]:
        """Find suitable weekly call contract"""
        try:
            option_chain = self.algo.OptionChainProvider.GetOptionContractList(symbol, self.algo.Time)
            
            # Find weekly expiry (7 DTE)
            weekly_expiry = self._get_next_weekly_expiry()
            weekly_candidates = [c for c in option_chain 
                               if c.ID.OptionRight == OptionRight.Call and 
                               abs((c.ID.Date - weekly_expiry).days) <= 3]
            
            if not weekly_candidates:
                self.algo.Debug(f"No weekly call candidates found for {symbol} near {weekly_expiry}")
                return None, None
                
            # Calculate weekly strike (above current price, below LEAP strike for safety)
            weekly_strike = self._calculate_weekly_call_strike(current_price, leap_strike)
            best_weekly = min(weekly_candidates, key=lambda c: abs(c.ID.StrikePrice - weekly_strike))
            
            analysis = {
                'strike': best_weekly.ID.StrikePrice,
                'dte': (best_weekly.ID.Date - self.algo.Time).days,
                'moneyness': best_weekly.ID.StrikePrice / current_price
            }
            
            return best_weekly, analysis
            
        except Exception as e:
            self.algo.Error(f"Error finding weekly call: {str(e)}")
            return None, None
            
    def _calculate_weekly_call_strike(self, current_price: float, leap_strike: float) -> float:
        """Calculate appropriate weekly call strike"""
        # Weekly call should be:
        # 1. Above current price (OTM)
        # 2. Below LEAP strike (for safety)
        # 3. Typically 2-5% OTM
        
        otm_target = current_price * 1.03  # 3% OTM
        safety_max = leap_strike * 0.95    # 5% below LEAP strike
        
        return min(otm_target, safety_max)
        
    def _get_next_weekly_expiry(self) -> datetime:
        """Get next Friday expiry date"""
        current = self.algo.Time
        days_until_friday = (4 - current.weekday()) % 7
        if days_until_friday == 0 and current.hour >= 16:  # After market close on Friday
            days_until_friday = 7
            
        next_friday = current + timedelta(days=days_until_friday)
        return next_friday
        
    def _calculate_position_size(self, account_value: float, current_price: float, leap_strike: float) -> int:
        """Calculate appropriate position size for IPMCC"""
        # 8% of account value per IPMCC position
        max_bp_usage = account_value * 0.08
        
        # Estimate LEAP cost (intrinsic + some extrinsic)
        leap_intrinsic = max(0, current_price - leap_strike)
        estimated_leap_cost = leap_intrinsic + (current_price * 0.05)  # 5% extrinsic estimate
        
        # Calculate quantity
        quantity = max(1, int(max_bp_usage / (estimated_leap_cost * 100)))
        
        return min(quantity, 5)  # Cap at 5 contracts for safety
        
    def roll_weekly_call(self, symbol: str, component_id: str) -> Tuple[bool, str]:
        """Roll an expiring weekly call to next week"""
        try:
            # Close existing weekly call
            success = self.psm.close_ipmcc_weekly_call(symbol, component_id)
            if not success:
                return False, "Failed to close existing weekly call"
                
            # Add new weekly call for next week
            existing_leap = self.psm.has_active_leap(symbol)
            if existing_leap:
                return self._add_weekly_call_to_existing_leap(symbol, existing_leap)
            else:
                return False, "No active LEAP found for rolling"
                
        except Exception as e:
            self.algo.Error(f"Error rolling weekly call: {str(e)}")
            return False, f"Roll error: {str(e)}"

# USAGE EXAMPLE FOR INTEGRATION:
\"\"\"
# In main.py Initialize():
self.position_state_manager = PositionStateManager(self)
self.fixed_ipmcc = FixedIPMCCExecution(self, self.position_state_manager)

# In monthly strategy execution:
# REPLACE this broken line:
# success, result = self.ipmcc_strategy.execute_ipmcc_entry(symbol, account_value, current_vix)
# 
# WITH this fixed line:
success, result = self.fixed_ipmcc.execute_ipmcc_strategy(symbol, account_value, current_vix)
\"\"\"