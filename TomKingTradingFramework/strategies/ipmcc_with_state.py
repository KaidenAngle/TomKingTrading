# In-Perpetuity Monthly Covered Calls with State Machine Pattern
# Tom King's IPMCC strategy with clean state management

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from datetime import time, timedelta
from typing import Dict, List, Optional

class IPMCCWithState(BaseStrategyWithState):
    """
    Tom King's IPMCC strategy with state machine pattern
    Sells 30-45 DTE covered calls on existing shares
    20% profit target, rolls at expiration
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm, "IPMCC")
        
        # Tom King IPMCC parameters
        self.entry_time = time(10, 0)  # 10:00 AM ET entry
        self.target_profit = 0.20       # 20% profit target
        
        # DTE targets
        self.min_dte = 30               # Minimum 30 DTE
        self.max_dte = 45               # Maximum 45 DTE
        self.roll_dte = 7                # Roll when 7 DTE or less
        
        # Strike selection
        self.call_delta = 0.30           # 30 delta calls (OTM)
        
        # Position tracking
        self.covered_positions = []
        self.underlying_shares = {}      # Track shares we're covering
        
        # Underlying symbols to run IPMCC on
        self.ipmcc_symbols = ['SPY', 'QQQ', 'IWM']
        
        # Add IPMCC-specific transitions
        self._setup_ipmcc_transitions()
    
    def _setup_ipmcc_transitions(self):
        """Setup IPMCC-specific state transitions"""
        
        # Roll transition for expiring calls
        self.state_machine.add_transition(
            StrategyState.MANAGING,
            StrategyState.ADJUSTING,
            TransitionTrigger.ADJUSTMENT_NEEDED,
            condition=lambda data: self._needs_rolling(data)
        )
        
        # Monthly check for new positions
        self.state_machine.add_transition(
            StrategyState.READY,
            StrategyState.ANALYZING,
            TransitionTrigger.TIME_WINDOW_START,
            condition=lambda data: self._is_monthly_entry_time()
        )
    
    def _check_entry_conditions(self) -> bool:
        """Check if IPMCC entry conditions are met"""
        
        # Check if we have shares to cover
        if not self._has_uncovered_shares():
            return False
        
        # Check if it's appropriate entry time
        if self.algo.Time.time() < self.entry_time:
            return False
        
        # Check market conditions
        if not self._check_market_conditions():
            return False
        
        return True
    
    def _place_entry_orders(self) -> bool:
        """Place IPMCC covered call orders"""
        
        try:
            positions_opened = False
            
            for symbol_str in self.ipmcc_symbols:
                # Use cached symbol if available
                if hasattr(self.algo, 'symbols') and symbol_str in self.algo.symbols:
                    symbol = self.algo.symbols[symbol_str]
                else:
                    symbol = self.algo.Symbol(symbol_str)
                
                # Check if we have uncovered shares
                shares = self._get_uncovered_shares(symbol)
                if shares < 100:
                    continue
                
                # Find options with target DTE
                contracts = self._find_target_dte_options(symbol)
                if not contracts:
                    self.algo.Debug(f"[IPMCC] No suitable contracts for {symbol_str}")
                    continue
                
                # Find 30 delta call
                call_contract = self._find_delta_strike(contracts, self.call_delta, "call")
                if not call_contract:
                    self.algo.Debug(f"[IPMCC] No suitable call for {symbol_str}")
                    continue
                
                # Calculate how many contracts to sell
                contracts_to_sell = int(shares / 100)
                
                # Check SPY concentration limits if trading SPY
                if symbol_str == 'SPY' and hasattr(self.algo, 'spy_concentration_manager'):
                    # Covered calls have delta around 0.30
                    estimated_delta = self.call_delta * contracts_to_sell * 100
                    approved, reason = self.algo.spy_concentration_manager.request_spy_allocation(
                        strategy_name="IPMCC",
                        position_type="covered_call",
                        requested_delta=estimated_delta,
                        requested_contracts=contracts_to_sell
                    )
                    
                    if not approved:
                        self.algo.Debug(f"[IPMCC] SPY allocation denied: {reason}")
                        continue
                
                # Place order to sell calls
                order = self.algo.MarketOrder(call_contract, -contracts_to_sell)
                
                if order:
                    # Track position
                    position = {
                        'entry_time': self.algo.Time,
                        'underlying': symbol,
                        'call': call_contract,
                        'contracts': contracts_to_sell,
                        'entry_premium': self._get_option_price(call_contract),
                        'status': 'open',
                        'state': StrategyState.POSITION_OPEN
                    }
                    
                    self.covered_positions.append(position)
                    positions_opened = True
                    
                    self.algo.Debug(
                        f"[IPMCC] Sold {contracts_to_sell}x {call_contract.Strike} calls on {symbol_str}"
                    )
            
            return positions_opened
            
        except Exception as e:
            self.algo.Error(f"[IPMCC] Entry error: {e}")
            return False
    
    def _manage_position(self):
        """Manage IPMCC positions"""
        
        for position in self.covered_positions:
            if position['status'] != 'open':
                continue
            
            # Check profit target
            if self._check_position_profit(position, self.target_profit):
                self.algo.Debug(f"[IPMCC] Profit target hit for {position['underlying']}")
                self._close_position(position)
                continue
            
            # Check if needs rolling (approaching expiration)
            if self._check_needs_rolling(position):
                self.state_machine.trigger(
                    TransitionTrigger.ADJUSTMENT_NEEDED,
                    {'position': position}
                )
    
    def _execute_adjustment(self) -> bool:
        """Roll expiring covered calls"""
        
        # Find positions that need rolling
        positions_to_roll = [
            p for p in self.covered_positions 
            if self._check_needs_rolling(p) and p['status'] == 'open'
        ]
        
        if not positions_to_roll:
            return True
        
        success = True
        for position in positions_to_roll:
            try:
                # Buy back current call
                self.algo.MarketOrder(position['call'], position['contracts'])
                
                # Find new call to sell
                symbol = position['underlying']
                contracts = self._find_target_dte_options(symbol)
                new_call = self._find_delta_strike(contracts, self.call_delta, "call")
                
                if new_call:
                    # Sell new call
                    self.algo.MarketOrder(new_call, -position['contracts'])
                    
                    # Update position
                    position['call'] = new_call
                    position['entry_time'] = self.algo.Time
                    position['entry_premium'] = self._get_option_price(new_call)
                    
                    self.algo.Debug(
                        f"[IPMCC] Rolled {position['underlying']} to {new_call.Strike} strike"
                    )
                else:
                    # Close if can't roll
                    position['status'] = 'closed'
                    self.algo.Debug(f"[IPMCC] Closed {position['underlying']} - no roll available")
                    
            except Exception as e:
                self.algo.Error(f"[IPMCC] Roll error: {e}")
                success = False
        
        return success
    
    def _has_uncovered_shares(self) -> bool:
        """Check if we have shares that aren't covered"""
        
        for symbol_str in self.ipmcc_symbols:
            symbol = self.algo.Symbol(symbol_str)
            if self._get_uncovered_shares(symbol) >= 100:
                return True
        
        return False
    
    def _get_uncovered_shares(self, symbol) -> int:
        """Get number of uncovered shares for a symbol"""
        
        # Get total shares held
        if symbol in self.algo.Portfolio:
            total_shares = self.algo.Portfolio[symbol].Quantity
        else:
            return 0
        
        # Subtract covered shares
        covered_shares = sum(
            p['contracts'] * 100 
            for p in self.covered_positions 
            if p['underlying'] == symbol and p['status'] == 'open'
        )
        
        return max(0, total_shares - covered_shares)
    
    def _is_monthly_entry_time(self) -> bool:
        """Check if it's time for monthly covered call entry"""
        
        # First trading day of month
        if self.algo.Time.day <= 3:
            return True
        
        # Or if we have significant uncovered shares
        return self._has_uncovered_shares()
    
    def _check_market_conditions(self) -> bool:
        """Check if market conditions suitable for IPMCC"""
        
        # Avoid selling calls in strong uptrend
        spy = self.algo.spy
        if spy in self.algo.Securities:
            sma20 = self.algo.Indicators.SMA(spy, 20)
            if sma20.IsReady:
                current_price = self.algo.Securities[spy].Price
                # Don't sell calls if more than 2% above 20-day MA
                if current_price > sma20.Current.Value * 1.02:
                    self.algo.Debug("[IPMCC] Market too bullish for calls")
                    return False
        
        return True
    
    def _find_target_dte_options(self, symbol) -> List:
        """Find options with target DTE"""
        
        min_expiry = self.algo.Time + timedelta(days=self.min_dte)
        max_expiry = self.algo.Time + timedelta(days=self.max_dte)
        
        # Get option chain
        chain = self.algo.OptionChainProvider.GetOptionContractList(symbol, self.algo.Time)
        
        # Filter by DTE range
        filtered = [
            c for c in chain
            if min_expiry <= c.ID.Date <= max_expiry
        ]
        
        return filtered
    
    def _find_delta_strike(self, contracts, target_delta, option_type):
        """Find option closest to target delta"""
        
        # Filter by type
        if option_type == "call":
            typed_contracts = [c for c in contracts if c.ID.OptionRight == OptionRight.Call]
        else:
            typed_contracts = [c for c in contracts if c.ID.OptionRight == OptionRight.Put]
        
        if not typed_contracts:
            return None
        
        # Calculate deltas using QuantConnect Greeks
        best_contract = None
        best_delta_diff = float('inf')
        
        for contract in typed_contracts:
            # Use QuantConnect's native Greeks when available
            if hasattr(contract, 'Greeks') and contract.Greeks:
                actual_delta = abs(contract.Greeks.Delta)
            else:
                # Fallback delta approximation based on moneyness
                underlying_price = self.algo.Securities[contract.Underlying].Price
                moneyness = contract.ID.StrikePrice / underlying_price
                
                if option_type == "call":
                    # Rough call delta approximation
                    if moneyness < 0.95:
                        actual_delta = 0.8
                    elif moneyness < 1.0:
                        actual_delta = 0.5
                    elif moneyness < 1.05:
                        actual_delta = 0.3
                    else:
                        actual_delta = 0.15
                else:
                    # Rough put delta approximation (inverse of call delta)
                    if moneyness > 1.05:
                        actual_delta = 0.8
                    elif moneyness > 1.0:
                        actual_delta = 0.5
                    elif moneyness > 0.95:
                        actual_delta = 0.3
                    else:
                        actual_delta = 0.15
            
            delta_diff = abs(actual_delta - target_delta)
            if delta_diff < best_delta_diff:
                best_delta_diff = delta_diff
                best_contract = contract
        
        return best_contract
    
    def _check_position_profit(self, position, target) -> bool:
        """Check if position hit profit target"""
        
        current_value = self._get_option_price(position['call'])
        entry_premium = position['entry_premium']
        
        if entry_premium > 0:
            # For short calls, profit when price decreases
            pnl_pct = (entry_premium - current_value) / entry_premium
            return pnl_pct >= target
        
        return False
    
    def _check_needs_rolling(self, position) -> bool:
        """Check if position needs rolling"""
        
        call = position['call']
        days_to_expiry = (call.ID.Date - self.algo.Time).days
        
        return days_to_expiry <= self.roll_dte
    
    def _get_option_price(self, contract) -> float:
        """Get current option price"""
        
        if contract in self.algo.Securities:
            return self.algo.Securities[contract].Price
        
        # Fallback estimate
        return 1.0
    
    def _close_position(self, position):
        """Close an IPMCC position"""
        
        try:
            # Buy back the call
            self.algo.MarketOrder(position['call'], position['contracts'])
            
            # Update position status
            position['status'] = 'closed'
            position['exit_time'] = self.algo.Time
            
            # Calculate final P&L
            exit_price = self._get_option_price(position['call'])
            pnl = (position['entry_premium'] - exit_price) * 100 * position['contracts']
            
            # Update statistics
            if pnl > 0:
                self.wins += 1
            else:
                self.losses += 1
            
            self.algo.Debug(f"[IPMCC] Closed {position['underlying']}, P&L: ${pnl:.2f}")
            
        except Exception as e:
            self.algo.Error(f"[IPMCC] Close position error: {e}")
    
    def _can_trade_again_today(self) -> bool:
        """IPMCC can check for new positions daily"""
        
        # Can sell more calls if we have uncovered shares
        return self._has_uncovered_shares()