# Futures Strangle Strategy with State Machine Pattern
# Tom King's /ES strangle strategy with clean state management

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from datetime import time, timedelta
from typing import Dict, List, Optional

class FuturesStrangleWithState(BaseStrategyWithState):
    """
    Tom King's Futures Strangle strategy with state machine pattern
    Sells strangles on /ES with 45-60 DTE
    25% profit target, 100% stop loss, dynamic adjustments
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm, "FuturesStrangle")
        
        # Tom King Futures parameters
        self.entry_time = time(10, 0)   # 10:00 AM ET entry
        self.target_profit = 0.25       # 25% profit target
        self.stop_loss = -1.00          # 100% stop loss
        
        # DTE targets
        self.min_dte = 45               # Minimum 45 DTE
        self.max_dte = 60               # Maximum 60 DTE
        self.defensive_exit_dte = 21    # Exit at 21 DTE
        
        # Strike selection
        self.strangle_width = 0.15      # 15% OTM for both sides
        self.call_delta = 0.16          # 16 delta calls
        self.put_delta = -0.16          # 16 delta puts
        
        # Position tracking
        self.strangle_positions = []
        self.max_positions = 2          # Max 2 concurrent strangles
        
        # Futures symbols
        self.futures_symbols = ['/ES', '/NQ', '/RTY']  # E-mini S&P, NASDAQ, Russell
        self.active_future = '/ES'      # Primary focus on /ES
        
        # Add strangle-specific transitions
        self._setup_strangle_transitions()
    
    def _setup_strangle_transitions(self):
        """Setup strangle-specific state transitions"""
        
        # Adjustment for tested side
        self.state_machine.add_transition(
            StrategyState.MANAGING,
            StrategyState.ADJUSTING,
            TransitionTrigger.ADJUSTMENT_NEEDED,
            condition=lambda data: self._side_is_tested(data)
        )
        
        # Weekly entry check
        self.state_machine.add_transition(
            StrategyState.READY,
            StrategyState.ANALYZING,
            TransitionTrigger.TIME_WINDOW_START,
            condition=lambda data: self._is_entry_day()
        )
    
    def _check_entry_conditions(self) -> bool:
        """Check if strangle entry conditions are met"""
        
        # Check position limits
        open_positions = sum(1 for p in self.strangle_positions if p['status'] == 'open')
        if open_positions >= self.max_positions:
            self.algo.Debug(f"[Strangle] At max positions ({self.max_positions})")
            return False
        
        # Check entry time
        if self.algo.Time.time() < self.entry_time:
            return False
        
        # Check market conditions
        if not self._check_market_conditions():
            return False
        
        # Check margin
        if not self._check_margin_available():
            return False
        
        return True
    
    def _place_entry_orders(self) -> bool:
        """Place futures strangle orders"""
        
        try:
            # Get futures contract (use cached if available)
            if hasattr(self.algo, 'symbols') and self.active_future in self.algo.symbols:
                future = self.algo.symbols[self.active_future]
            else:
                future = self.algo.Symbol(self.active_future)
            if future not in self.algo.Securities:
                self.algo.AddFuture(self.active_future)
            
            current_price = self.algo.Securities[future].Price
            
            # Find options on futures
            contracts = self._find_futures_options(future)
            if not contracts:
                self.algo.Debug(f"[Strangle] No suitable options for {self.active_future}")
                return False
            
            # Calculate strangle strikes
            call_strike = round(current_price * (1 + self.strangle_width), 0)
            put_strike = round(current_price * (1 - self.strangle_width), 0)
            
            # Find best contracts
            call_contract = self._find_closest_strike(contracts, call_strike, "call")
            put_contract = self._find_closest_strike(contracts, put_strike, "put")
            
            if not call_contract or not put_contract:
                self.algo.Debug("[Strangle] Could not find suitable strikes")
                return False
            
            # Calculate position size
            contracts_to_trade = self._calculate_strangle_size()
            
            # Use atomic executor for strangle
            success = False
            if hasattr(self.algo, 'atomic_executor'):
                success = self.algo.atomic_executor.execute_strangle_atomic(
                    call_contract, put_contract, contracts_to_trade
                )
            else:
                # Fallback to regular orders
                call_order = self.algo.MarketOrder(call_contract, -contracts_to_trade)
                put_order = self.algo.MarketOrder(put_contract, -contracts_to_trade)
                success = call_order is not None and put_order is not None
            
            if success:
                # Track position
                position = {
                    'entry_time': self.algo.Time,
                    'underlying': future,
                    'short_call': call_contract,
                    'short_put': put_contract,
                    'contracts': contracts_to_trade,
                    'entry_credit': self._calculate_strangle_credit(call_contract, put_contract),
                    'status': 'open',
                    'state': StrategyState.POSITION_OPEN,
                    'adjustments': []
                }
                
                self.strangle_positions.append(position)
                self.current_position = position
                
                self.algo.Debug(
                    f"[Strangle] Entered {contracts_to_trade}x "
                    f"{put_strike}/{call_strike} strangle on {self.active_future}"
                )
                
                return True
            
            return False
            
        except Exception as e:
            self.algo.Error(f"[Strangle] Entry error: {e}")
            return False
    
    def _manage_position(self):
        """Manage strangle positions"""
        
        for position in self.strangle_positions:
            if position['status'] != 'open':
                continue
            
            # Check profit target
            if self._check_position_profit(position, self.target_profit):
                self.algo.Debug(f"[Strangle] Profit target hit")
                self._close_position(position)
                continue
            
            # Check stop loss
            if self._check_position_profit(position, self.stop_loss):
                self.algo.Debug(f"[Strangle] Stop loss hit")
                self._close_position(position)
                continue
            
            # Check defensive exit
            if self._check_dte_exit(position):
                self.algo.Debug(f"[Strangle] 21 DTE defensive exit")
                self._close_position(position)
                continue
            
            # Check if either side is tested
            if self._check_side_tested(position):
                self.state_machine.trigger(
                    TransitionTrigger.ADJUSTMENT_NEEDED,
                    {'position': position}
                )
    
    def _execute_adjustment(self) -> bool:
        """Adjust tested strangle side"""
        
        # Find position needing adjustment
        position_to_adjust = None
        for position in self.strangle_positions:
            if self._check_side_tested(position) and position['status'] == 'open':
                position_to_adjust = position
                break
        
        if not position_to_adjust:
            return True
        
        try:
            future = position_to_adjust['underlying']
            current_price = self.algo.Securities[future].Price
            
            # Determine which side is tested
            call_strike = position_to_adjust['short_call'].ID.StrikePrice
            put_strike = position_to_adjust['short_put'].ID.StrikePrice
            
            call_distance = abs(current_price - call_strike) / current_price
            put_distance = abs(current_price - put_strike) / current_price
            
            if call_distance < 0.05:  # Call side tested
                # Roll call up and out
                self.algo.MarketOrder(position_to_adjust['short_call'], position_to_adjust['contracts'])
                
                # Find new call further OTM
                new_call_strike = round(current_price * 1.20, 0)  # 20% OTM
                contracts = self._find_futures_options(future)
                new_call = self._find_closest_strike(contracts, new_call_strike, "call")
                
                if new_call:
                    self.algo.MarketOrder(new_call, -position_to_adjust['contracts'])
                    position_to_adjust['short_call'] = new_call
                    position_to_adjust['adjustments'].append({
                        'time': self.algo.Time,
                        'type': 'roll_call',
                        'old_strike': call_strike,
                        'new_strike': new_call_strike
                    })
                    self.algo.Debug(f"[Strangle] Rolled call to {new_call_strike}")
                    
            elif put_distance < 0.05:  # Put side tested
                # Roll put down and out
                self.algo.MarketOrder(position_to_adjust['short_put'], position_to_adjust['contracts'])
                
                # Find new put further OTM
                new_put_strike = round(current_price * 0.80, 0)  # 20% OTM
                contracts = self._find_futures_options(future)
                new_put = self._find_closest_strike(contracts, new_put_strike, "put")
                
                if new_put:
                    self.algo.MarketOrder(new_put, -position_to_adjust['contracts'])
                    position_to_adjust['short_put'] = new_put
                    position_to_adjust['adjustments'].append({
                        'time': self.algo.Time,
                        'type': 'roll_put',
                        'old_strike': put_strike,
                        'new_strike': new_put_strike
                    })
                    self.algo.Debug(f"[Strangle] Rolled put to {new_put_strike}")
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[Strangle] Adjustment error: {e}")
            return False
    
    def _is_entry_day(self) -> bool:
        """Check if today is a strangle entry day"""
        
        # Enter on Mondays and Thursdays
        return self.algo.Time.weekday() in [0, 3]
    
    def _check_market_conditions(self) -> bool:
        """Check if market conditions suitable for strangles"""
        
        # Check VIX for volatility
        vix = self._get_vix_value()
        if vix < 15:
            self.algo.Debug(f"[Strangle] VIX too low ({vix:.2f})")
            return False
        if vix > 40:
            self.algo.Debug(f"[Strangle] VIX too high ({vix:.2f})")
            return False
        
        # Check term structure (VIX9D vs VIX)
        if hasattr(self.algo, 'term_structure_analyzer'):
            if self.algo.term_structure_analyzer.is_inverted():
                self.algo.Debug("[Strangle] Term structure inverted")
                return False
        
        return True
    
    def _check_margin_available(self) -> bool:
        """Check if enough margin for strangle"""
        
        # Estimate margin for futures strangle
        # Rough estimate: $5000 per /ES strangle
        required_margin = 5000 * self._calculate_strangle_size()
        available_margin = self.algo.Portfolio.MarginRemaining
        
        if required_margin > available_margin * 0.3:  # Use max 30% of available
            self.algo.Debug(f"[Strangle] Insufficient margin: need ${required_margin:.0f}")
            return False
        
        return True
    
    def _find_futures_options(self, future_symbol) -> List:
        """Find options on futures contract"""
        
        target_expiry = self.algo.Time + timedelta(days=(self.min_dte + self.max_dte) / 2)
        min_expiry = self.algo.Time + timedelta(days=self.min_dte)
        max_expiry = self.algo.Time + timedelta(days=self.max_dte)
        
        # Get futures option chain
        # This would need QuantConnect futures option support
        chain = self.algo.OptionChainProvider.GetOptionContractList(future_symbol, self.algo.Time)
        
        # Filter by DTE range
        filtered = [
            c for c in chain
            if min_expiry <= c.ID.Date <= max_expiry
        ]
        
        return filtered
    
    def _find_closest_strike(self, contracts, target_strike, option_type):
        """Find closest strike to target"""
        
        # Filter by type
        if option_type == "put":
            typed_contracts = [c for c in contracts if c.ID.OptionRight == OptionRight.Put]
        else:
            typed_contracts = [c for c in contracts if c.ID.OptionRight == OptionRight.Call]
        
        if not typed_contracts:
            return None
        
        # Find closest strike
        closest = min(typed_contracts, key=lambda c: abs(c.ID.StrikePrice - target_strike))
        return closest
    
    def _calculate_strangle_size(self) -> int:
        """Calculate position size for strangle using unified position sizer"""
        
        # UnifiedPositionSizer is always initialized in main.py
        return self.algo.position_sizer.calculate_futures_strangle_size()
    
    def _calculate_strangle_credit(self, call, put) -> float:
        """Calculate total credit for strangle"""
        
        call_price = self.algo.Securities[call].Price if call in self.algo.Securities else 5.0
        put_price = self.algo.Securities[put].Price if put in self.algo.Securities else 5.0
        
        # Futures options have different multipliers
        multiplier = 50  # /ES options are $50 per point
        return (call_price + put_price) * multiplier
    
    def _check_position_profit(self, position, target) -> bool:
        """Check if position hit profit/loss target"""
        
        current_value = self._get_strangle_value(position)
        entry_credit = position['entry_credit']
        
        if entry_credit > 0:
            pnl_pct = (entry_credit - current_value) / entry_credit
            return pnl_pct >= target if target > 0 else pnl_pct <= target
        
        return False
    
    def _check_dte_exit(self, position) -> bool:
        """Check if position needs defensive exit"""
        
        call = position['short_call']
        days_to_expiry = (call.ID.Date - self.algo.Time).days
        
        return days_to_expiry <= self.defensive_exit_dte
    
    def _check_side_tested(self, position) -> bool:
        """Check if either side of strangle is tested"""
        
        future = position['underlying']
        current_price = self.algo.Securities[future].Price
        
        call_strike = position['short_call'].ID.StrikePrice
        put_strike = position['short_put'].ID.StrikePrice
        
        # Side is tested if price within 5% of strike
        call_distance = abs(current_price - call_strike) / current_price
        put_distance = abs(current_price - put_strike) / current_price
        
        return call_distance < 0.05 or put_distance < 0.05
    
    def _side_is_tested(self, data) -> bool:
        """Check if adjustment needed for tested side"""
        
        if 'position' in data:
            return self._check_side_tested(data['position'])
        
        return any(self._check_side_tested(p) for p in self.strangle_positions if p['status'] == 'open')
    
    def _get_strangle_value(self, position) -> float:
        """Get current value of strangle"""
        
        call_value = self.algo.Securities[position['short_call']].Price if position['short_call'] in self.algo.Securities else 0
        put_value = self.algo.Securities[position['short_put']].Price if position['short_put'] in self.algo.Securities else 0
        
        multiplier = 50  # /ES options multiplier
        return (call_value + put_value) * multiplier * position['contracts']
    
    def _close_position(self, position):
        """Close a strangle position"""
        
        try:
            # Buy back both sides
            self.algo.MarketOrder(position['short_call'], position['contracts'])
            self.algo.MarketOrder(position['short_put'], position['contracts'])
            
            # Update position status
            position['status'] = 'closed'
            position['exit_time'] = self.algo.Time
            
            # Calculate final P&L
            final_value = self._get_strangle_value(position)
            pnl = position['entry_credit'] - final_value
            
            # Update statistics
            if pnl > 0:
                self.wins += 1
            else:
                self.losses += 1
            
            self.algo.Debug(f"[Strangle] Closed position, P&L: ${pnl:.2f}")
            
        except Exception as e:
            self.algo.Error(f"[Strangle] Close position error: {e}")
    
    def _get_vix_value(self) -> float:
        """Get current VIX value from UnifiedVIXManager"""
        
        # Use central VIX manager - single source of truth
        if hasattr(self.algo, 'vix_manager'):
            vix = self.algo.vix_manager.get_current_vix()
            if vix and vix > 0:
                return vix
        
        # Futures strangle needs VIX for entry decisions
        self.algo.Debug("[FuturesStrangle] VIX data unavailable, using default 20")
        return 20.0  # Conservative default
    
    def _can_trade_again_today(self) -> bool:
        """Strangles can enter multiple times if conditions met"""
        
        open_positions = sum(1 for p in self.strangle_positions if p['status'] == 'open')
        return open_positions < self.max_positions