# In-Perpetuity Monthly Covered Calls with State Machine Pattern
# Tom King's IPMCC strategy with clean state management

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from datetime import time, timedelta
from typing import Dict, List, Optional
from core.unified_vix_manager import UnifiedVIXManager


# SYSTEM LEVERAGE OPPORTUNITY:
# This file could leverage vix_manager from unified system
# Consider delegating to: self.algo.vix_manager.{method}()
# See Implementation Audit Protocol for systematic integration patterns

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
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
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
            self.algo.MarketOrder(position['call'], position['contracts'])
            except Exception as e:

                # Log and handle unexpected exception

                print(f'Unexpected exception: {e}')

                raise
# Buy back current call
                
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
        self.algo.MarketOrder(position['call'], position['contracts'])
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Buy back the call
            
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
    
    def _place_exit_orders(self) -> bool:
        """Place IPMCC covered call exit orders following Tom King methodology"""
        
        try:
        positions_to_exit = [
        pos for pos in self.covered_positions
        if pos['status'] == 'open' and self._should_exit_position(pos)
        ]
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Find covered call positions that need closing
            
            if not positions_to_exit:
                return True
            
            exit_success = True
            
            for position in positions_to_exit:
                try:
                call_contract = position['call']
                contracts = position['contracts']
                entry_premium = position['entry_premium']
                underlying = position['underlying']
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
# Get position details
                    
                    # Calculate current metrics
                    current_value = self._get_option_price(call_contract)
                    pnl = (entry_premium - current_value) * 100 * contracts
                    pnl_pct = (entry_premium - current_value) / entry_premium if entry_premium > 0 else 0
                    
                    # Place exit order (buy back the short call)
                    order = self.algo.MarketOrder(call_contract, contracts)
                    
                    if not order:
                        self.algo.Error(f"[IPMCC] Failed to place exit order for {underlying}")
                        exit_success = False
                        continue
                    
                    # Update position status
                    position['status'] = 'closed'
                    position['exit_time'] = self.algo.Time
                    position['exit_premium'] = current_value
                    position['exit_reason'] = self._get_exit_reason(position)
                    position['final_pnl'] = pnl
                    
                    # Update strategy statistics
                    if pnl > 0:
                        self.wins += 1
                    else:
                        self.losses += 1
                    
                    # Log exit details
                    self.algo.Log(
                        f"[IPMCC] Closed {underlying} covered call: "
                        f"P&L: ${pnl:.2f} ({pnl_pct:.1%}), "
                        f"Reason: {position['exit_reason']}, "
                        f"Strike: {call_contract.Strike}, "
                        f"Contracts: {contracts}"
                    )
                    
                    # Fire exit event for position state manager
                    if hasattr(self.algo, 'event_bus'):
                        self.algo.event_bus.fire_event(
                            'position_exited',
                            {
                                'strategy': self.strategy_name,
                                'position_id': f"ipmcc_{str(underlying)}_{position['entry_time'].strftime('%Y%m%d_%H%M%S')}",
                                'exit_time': position['exit_time'],
                                'pnl': pnl,
                                'reason': position['exit_reason'],
                                'underlying': str(underlying),
                                'strike': call_contract.Strike
                            }
                        )
                    
                    # Release SPY allocation if this was a SPY covered call
                    if hasattr(self.algo, 'spy_concentration_manager') and str(underlying) == 'SPY':
                        released_delta = 0.30 * contracts * 100  # Approximate covered call delta
                        self.algo.spy_concentration_manager.release_spy_allocation(
                            strategy_name="IPMCC",
                            position_type="covered_call",
                            released_delta=released_delta
                        )
                    
                except Exception as position_error:
                    self.algo.Error(f"[IPMCC] Error exiting {position.get('underlying', 'unknown')} position: {position_error}")
                    exit_success = False
                    continue
            
            # Update statistics
            if exit_success:
                self.algo.Debug(f"[IPMCC] Successfully closed {len(positions_to_exit)} covered call positions")
            else:
                self.algo.Error("[IPMCC] Some position closures failed")
            
            return exit_success
            
        except Exception as e:
            self.algo.Error(f"[IPMCC] Critical error in _place_exit_orders: {e}")
            return False
    
    def _should_exit_position(self, position) -> bool:
        """Determine if IPMCC position should be exited based on Tom King rules"""
        
        try:
        if self._check_position_profit(position, self.target_profit):
        return True
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Check profit target (20% profit for covered calls)
            
            # Check if needs rolling (approaching expiration)
            if self._check_needs_rolling(position):
                # Try to find rolling opportunity first
                symbol = position['underlying']
                contracts = self._find_target_dte_options(symbol)
                new_call = self._find_delta_strike(contracts, self.call_delta, "call")
                
                if not new_call:
                    # Can't roll, must close
                    return True
            
            # Check for assignment risk (call is deep ITM)
            if self._check_assignment_risk(position):
                return True
            
            # Check for emergency conditions
            if self._check_emergency_exit_conditions(position):
                return True
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[IPMCC] Error checking exit condition: {e}")
            return False
    
    def _check_assignment_risk(self, position) -> bool:
        """Check if call is at risk of assignment"""
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
call = position['call']
            underlying = position['underlying']
            
            # Get current price
            if underlying in self.algo.Securities:
                current_price = self.algo.Securities[underlying].Price
            else:
                return False
            
            # Check if call is deep ITM (assignment likely)
            call_strike = call.Strike
            
            # Assignment risk if underlying is more than 5% above strike
            if current_price > call_strike * 1.05:
                return True
            
            # Also check days to expiration - higher risk as we approach expiry
            days_to_expiry = (call.ID.Date - self.algo.Time).days
            
            # If within 7 days and ITM, close to avoid assignment
            if days_to_expiry <= 7 and current_price > call_strike:
                return True
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[IPMCC] Error checking assignment risk: {e}")
            return False
    
    def _check_emergency_exit_conditions(self, position) -> bool:
        """Check for emergency exit conditions for covered calls"""
        
        try:
        vix = 20.0  # Default
        if hasattr(self.algo, 'vix_manager'):
        vix_val = self.algo.vix_manager.get_current_vix()
        if vix_val and vix_val > 0:
        vix = vix_val
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Check for extreme market conditions requiring closure
            # If VIX spikes above 40, close calls to preserve upside
            
            if vix > 40:
                # In high volatility, close calls early to preserve upside
                current_value = self._get_option_price(position['call'])
                entry_premium = position['entry_premium']
                
                if entry_premium > 0:
                    pnl_pct = (entry_premium - current_value) / entry_premium
                    # Close if at least 10% profit during volatility spike
                    if pnl_pct >= 0.10:
                        return True
            
            # Check if underlying has run up significantly
            underlying = position['underlying']
            if underlying in self.algo.Securities:
                current_price = self.algo.Securities[underlying].Price
                
                # If we have SMA data, check for strong uptrend
                if hasattr(self.algo, 'Indicators'):
                    try:
                        
                    except Exception as e:

                        # Log and handle unexpected exception

                        print(f'Unexpected exception: {e}')

                        raise
sma20 = self.algo.Indicators.SMA(underlying, 20)
                        if sma20.IsReady:
                            # If stock is more than 5% above 20-day MA, consider closing
                            if current_price > sma20.Current.Value * 1.05:
                                # Check if we have some profit to take
                                current_call_value = self._get_option_price(position['call'])
                                entry_premium = position['entry_premium']
                                if entry_premium > 0:
                                    pnl_pct = (entry_premium - current_call_value) / entry_premium
                                    if pnl_pct >= 0.10:  # At least 10% profit
                                        return True
                    except (AttributeError, KeyError, ZeroDivisionError, ValueError) as e:
                        pass  # Ignore SMA errors
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[IPMCC] Error checking emergency exit: {e}")
            return False
    
    def _get_exit_reason(self, position) -> str:
        """Get the reason for IPMCC position exit"""
        
        try:
        if self._check_position_profit(position, self.target_profit):
        return f"Profit Target Hit (20%)"
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
# Check profit target
            
            # Check rolling expiration
            if self._check_needs_rolling(position):
                return f"Rolling at {self.roll_dte} DTE"
            
            # Check assignment risk
            if self._check_assignment_risk(position):
                call_strike = position['call'].Strike
                underlying = position['underlying']
                current_price = self.algo.Securities[underlying].Price if underlying in self.algo.Securities else 0
                
                days_to_expiry = (position['call'].ID.Date - self.algo.Time).days
                
                if days_to_expiry <= 7:
                    return f"Assignment Risk (ITM at {days_to_expiry} DTE)"
                else:
                    return f"Deep ITM Risk ({current_price:.2f} vs {call_strike} strike)"
            
            # Check emergency conditions
            vix = 20.0
            if hasattr(self.algo, 'vix_manager'):
                vix_val = self.algo.vix_manager.get_current_vix()
                if vix_val and vix_val > 0:
                    vix = vix_val
            
            if vix > 40:
                return f"High VIX Early Close (VIX: {vix:.1f})"
            
            # Check strong uptrend
            underlying = position['underlying']
            if underlying in self.algo.Securities:
                current_price = self.algo.Securities[underlying].Price
                
                if hasattr(self.algo, 'Indicators'):
                    try:
                        
                    except Exception as e:

                        # Log and handle unexpected exception

                        print(f'Unexpected exception: {e}')

                        raise
sma20 = self.algo.Indicators.SMA(underlying, 20)
                        if sma20.IsReady and current_price > sma20.Current.Value * 1.05:
                            return f"Strong Uptrend Exit (5%+ above SMA20)"
                    except (AttributeError, KeyError, ValueError, TypeError) as e:
                        pass
            
            return "Manual Exit"
            
        except Exception as e:
            self.algo.Debug(f"[IPMCC] Error determining exit reason: {e}")
            return "Exit Error"
    
    def _can_trade_again_today(self) -> bool:
        """IPMCC can check for new positions daily"""
        
        # Can sell more calls if we have uncovered shares
        return self._has_uncovered_shares()