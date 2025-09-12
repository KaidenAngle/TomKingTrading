# LT112 Strategy with State Machine Pattern
# Tom King's Long-Term 112 DTE Put Selling with clean state management

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from datetime import time, timedelta
from typing import Dict, List, Optional

class LT112WithState(BaseStrategyWithState):
    """
    Tom King's LT112 strategy with state machine pattern
    Enters 112-120 DTE put spreads on Wednesdays
    50% profit target, 200% stop loss, TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm, "LT112")
        
        # Tom King LT112 parameters (using constants)
        from config.constants import TradingConstants
        self.entry_time = time(TradingConstants.LT112_ENTRY_HOUR,
                              TradingConstants.LT112_ENTRY_MINUTE)  # 10:00 AM ET on Wednesdays
        self.target_profit = TradingConstants.LT112_PROFIT_TARGET  # 50% profit target
        self.stop_loss = TradingConstants.LT112_STOP_LOSS  # 200% stop loss
        
        # DTE targets (using constants)
        self.target_dte = 112  # Primary target (LT112 = 112 DTE)
        self.dte_range = TradingConstants.LT112_TARGET_DTE_RANGE  # Accept range around target
        self.defensive_exit_dte = TradingConstants.DEFENSIVE_EXIT_DTE  # Tom King's TradingConstants.DEFENSIVE_EXIT_DTE DTE rule
        
        # Strike selection
        self.put_1_otm = 0.05           # 5% OTM for first put
        self.put_2_otm = 0.10           # 10% OTM for second put
        
        # Position tracking
        self.lt112_positions = []
        self.max_positions = self._get_max_positions()
        
        # Add LT112-specific transitions
        self._setup_lt112_transitions()
    
    def _setup_lt112_transitions(self):
        """Setup LT112-specific state transitions"""
        
        # Wednesday-only entry
        self.state_machine.add_transition(
            StrategyState.READY,
            StrategyState.ANALYZING,
            TransitionTrigger.TIME_WINDOW_START,
            condition=lambda data: self._is_wednesday()
        )
        
        # Rolling transition for tested positions
        self.state_machine.add_transition(
            StrategyState.MANAGING,
            StrategyState.ADJUSTING,
            TransitionTrigger.ADJUSTMENT_NEEDED,
            condition=lambda data: self._needs_rolling(data)
        )
    
    def _check_entry_conditions(self) -> bool:
        """Check if LT112 entry conditions are met"""
        
        # Must be Wednesday
        if not self._is_wednesday():
            return False
        
        # Must be entry time
        if self.algo.Time.time() < self.entry_time:
            return False
        
        # Check position limits
        if len(self.lt112_positions) >= self.max_positions:
            self.algo.Debug(f"[LT112] At max positions ({self.max_positions})")
            return False
        
        # Check market conditions
        if not self._check_market_conditions():
            return False
        
        # Check margin availability
        if not self._check_margin_available():
            return False
        
        return True
    
    def _place_entry_orders(self) -> bool:
        """Place LT112 put spread orders"""
        
        try:
        
            pass
        except Exception as e:

            spy = self.algo.spy
            current_price = self.algo.Securities[spy].Price
            
            # Find options with target DTE
            contracts = self._find_target_dte_options(spy)
            if not contracts:
                self.algo.Debug("[LT112] No suitable contracts found")
                return False
            
            # Calculate strikes
            put_1_strike = round(current_price * (1 - self.put_1_otm), 0)
            put_2_strike = round(current_price * (1 - self.put_2_otm), 0)
            
            # Find best contracts
            put_1 = self._find_closest_strike(contracts, put_1_strike, "put")
            put_2 = self._find_closest_strike(contracts, put_2_strike, "put")
            
            if not put_1 or not put_2:
                self.algo.Debug("[LT112] Could not find suitable strikes")
                return False
            
            # Calculate position size
            contracts_to_trade = self._calculate_lt112_size()
            
            # Check SPY concentration limits before placing order
            # IMPORTANT: SPY concentration check prevents over-exposure across strategies
            # DO NOT REMOVE: Multiple strategies trade SPY, must coordinate exposure
            estimated_delta = -0.30 * contracts_to_trade * TradingConstants.FULL_PERCENTAGE  # Delta estimate for 10% OTM put spread
            approved, reason = self.algo.spy_concentration_manager.request_spy_allocation(
                strategy_name="LT112",
                position_type="put_spread", 
                requested_delta=estimated_delta,
                requested_contracts=contracts_to_trade
            )
            
            if not approved:
                self.algo.Debug(f"[LT112] SPY allocation denied: {reason}")
                return False
            
            # Use atomic executor for put spread
            # IMPORTANT: Atomic execution ensures all-or-nothing fill for multi-leg orders
            # DO NOT SIMPLIFY: Prevents partial fills that could create naked positions
            success = self.algo.atomic_executor.execute_put_spread_atomic(
                put_1, put_2, contracts_to_trade
            )
            
            if not success:
                self.algo.Error("[LT112] Failed to enter position")
                return False
            
            # Track position
            position = {
                'entry_time': self.algo.Time,
                'short_put': put_1,
                'long_put': put_2,
                'contracts': contracts_to_trade,
                'entry_credit': self._calculate_credit(put_1, put_2),
                'status': 'open',
                'state': StrategyState.POSITION_OPEN
            }
            
            self.lt112_positions.append(position)
            self.current_position = position
            
            self.algo.Debug(
                f"[LT112] Entered {contracts_to_trade}x "
                f"{put_1.Strike}/{put_2.Strike} put spread"
            )
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[LT112] Entry error: {e}")
            return False
    
    def _manage_position(self):
        """Override to manage multiple LT112 positions"""
        
        for position in self.lt112_positions:
            if position['status'] != 'open':
                continue
            
            # Check profit target
            if self._check_position_profit(position, self.target_profit):
                self.algo.Debug(f"[LT112] Profit target hit for position")
                self._close_position(position)
                continue
            
            # Check stop loss
            if self._check_position_profit(position, self.stop_loss):
                self.algo.Debug(f"[LT112] Stop loss hit for position")
                self._close_position(position)
                continue
            
            # Check defensive exit (TradingConstants.DEFENSIVE_EXIT_DTE DTE)
            if self._check_dte_exit(position):
                self.algo.Debug(f"[LT112] TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit")
                self._close_position(position)
                continue
            
            # Check if needs rolling (tested/breached)
            if self._check_needs_rolling(position):
                self.state_machine.trigger(
                    TransitionTrigger.ADJUSTMENT_NEEDED,
                    {'position': position}
                )
    
    def _execute_adjustment(self) -> bool:
        """Roll tested LT112 positions"""
        
        # Find position that needs rolling
        position_to_roll = None
        for position in self.lt112_positions:
            if self._check_needs_rolling(position):
                position_to_roll = position
                break
        
        if not position_to_roll:
            return True
        
        try:
            self._close_position(position_to_roll)
        except Exception as e:

            # Close current position
            
            # Open new position at further strikes
            spy = self.algo.spy
            current_price = self.algo.Securities[spy].Price
            
            # Roll to 15% and 20% OTM
            new_put_1_strike = round(current_price * 0.85, 0)
            new_put_2_strike = round(current_price * 0.80, 0)
            
            # Find new contracts
            contracts = self._find_target_dte_options(spy)
            new_put_1 = self._find_closest_strike(contracts, new_put_1_strike, "put")
            new_put_2 = self._find_closest_strike(contracts, new_put_2_strike, "put")
            
            if new_put_1 and new_put_2:
                # Place roll orders
                contracts_to_trade = position_to_roll['contracts']
                
                self.algo.MarketOrder(new_put_1, -contracts_to_trade)
                self.algo.MarketOrder(new_put_2, contracts_to_trade)
                
                # Create new position entry
                new_position = {
                    'entry_time': self.algo.Time,
                    'short_put': new_put_1,
                    'long_put': new_put_2,
                    'contracts': contracts_to_trade,
                    'entry_credit': self._calculate_credit(new_put_1, new_put_2),
                    'status': 'open',
                    'state': StrategyState.POSITION_OPEN,
                    'rolled_from': position_to_roll
                }
                
                self.lt112_positions.append(new_position)
                
                self.algo.Debug(f"[LT112] Rolled position to {new_put_1_strike}/{new_put_2_strike}")
                return True
            
        except Exception as e:
            self.algo.Error(f"[LT112] Roll error: {e}")
        
        return False
    
    def _is_wednesday(self) -> bool:
        """Check if today is Wednesday"""
        return self.algo.Time.weekday() == 2  # 2 = Wednesday
    
    def _get_max_positions(self) -> int:
        """Get maximum LT112 positions based on phase"""
        phase_limits = {
            1: 1,  # Phase 1: 1 position
            2: 2,  # Phase 2: 2 positions
            3: 3,  # Phase 3: 3 positions
            4: 4   # Phase 4: 4 positions
        }
        
        phase = getattr(self.algo, 'current_phase', 1)
        return phase_limits.get(phase, 1)
    
    def _check_market_conditions(self) -> bool:
        """Check if market conditions suitable for LT112"""
        
        # Check VIX range (not too low, not too high)
        vix = self._get_vix_value()
        if vix < 12:
            self.algo.Debug(f"[LT112] VIX too low ({vix:.2f})")
            return False
        if vix > 35:
            self.algo.Debug(f"[LT112] VIX too high ({vix:.2f})")
            return False
        
        # Check for corporate events
        spy = self.algo.spy
        if hasattr(self.algo, 'events_checker'):
            is_safe, reason = self.algo.events_checker.is_safe_to_trade(spy)
            if not is_safe:
                self.algo.Debug(f"[LT112] Event risk: {reason}")
                return False
        
        return True
    
    def _check_margin_available(self) -> bool:
        """Check if enough margin for new position"""
        
        # Estimate margin for 1 put spread
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        spread_width = current_price * (self.put_2_otm - self.put_1_otm)
        
        contracts = self._calculate_lt112_size()
        required_margin = spread_width * contracts * 100
        
        available_margin = self.algo.Portfolio.MarginRemaining
        
        if required_margin > available_margin * 0.5:  # Use max 50% of available
            self.algo.Debug(f"[LT112] Insufficient margin: need ${required_margin:.0f}")
            return False
        
        return True
    
    def _find_target_dte_options(self, symbol) -> List:
        """Find options with target DTE"""
        
        target_expiry = self.algo.Time + timedelta(days=self.target_dte)
        min_expiry = self.algo.Time + timedelta(days=self.target_dte - self.dte_range)
        max_expiry = self.algo.Time + timedelta(days=self.target_dte + self.dte_range)
        
        # Get option chain
        chain = self.algo.OptionChainProvider.GetOptionContractList(symbol, self.algo.Time)
        
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
    
    def _calculate_lt112_size(self) -> int:
        """Calculate position size for LT112 using unified position sizer"""
        
        # UnifiedPositionSizer is always initialized in main.py
        return self.algo.position_sizer.calculate_lt112_size()
    
    def _calculate_credit(self, short_option, long_option) -> float:
        """Calculate net credit for spread using real market data"""
        
        try:
            short_price = 0.0
        long_price = 0.0
        except Exception as e:

            # Use actual bid/ask prices from QuantConnect
            
            if short_option in self.algo.Securities:
                short_security = self.algo.Securities[short_option]
                # Use bid price for selling (short position)
                short_price = short_security.BidPrice if hasattr(short_security, 'BidPrice') else short_security.Price
            else:
                self.algo.Error(f"[LT112] Short option {short_option} not found in securities")
                return 0.0
            
            if long_option in self.algo.Securities:
                long_security = self.algo.Securities[long_option]
                # Use ask price for buying (long position)  
                long_price = long_security.AskPrice if hasattr(long_security, 'AskPrice') else long_security.Price
            else:
                self.algo.Error(f"[LT112] Long option {long_option} not found in securities")
                return 0.0
            
            net_credit = (short_price - long_price) * 100  # Options are per contract * 100
            
            # Validate credit is reasonable for LT112 spread
            if net_credit < 25:  # Less than $0.25
                self.algo.Debug(f"[LT112] Warning: Low credit ${net_credit:.2f} for spread")
            
            return net_credit
            
        except Exception as e:
            self.algo.Error(f"[LT112] Error calculating spread credit: {e}")
            return 0.0  # Return 0 to prevent trading with bad data
    
    def _check_position_profit(self, position, target) -> bool:
        """Check if position hit profit/loss target"""
        
        current_value = self._get_position_value(position)
        entry_credit = position['entry_credit']
        
        if entry_credit > 0:
            pnl_pct = (entry_credit - current_value) / entry_credit
            return pnl_pct >= target if target > 0 else pnl_pct <= target
        
        return False
    
    def _check_dte_exit(self, position) -> bool:
        """Check if position needs TradingConstants.DEFENSIVE_EXIT_DTE DTE exit"""
        
        short_put = position['short_put']
        days_to_expiry = (short_put.ID.Date - self.algo.Time).days
        
        return days_to_expiry <= self.defensive_exit_dte
    
    def _check_needs_rolling(self, position) -> bool:
        """Check if position is tested and needs rolling"""
        
        short_put = position['short_put']
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        # Position is tested if price within 5% of short strike
        distance_to_strike = (short_put.ID.StrikePrice - current_price) / current_price
        
        return distance_to_strike < 0.05  # Less than 5% OTM
    
    def _get_position_value(self, position) -> float:
        """Get current value of position"""
        
        # Simplified - would calculate actual spread value
        short_value = self.algo.Securities[position['short_put']].Price if position['short_put'] in self.algo.Securities else 0
        long_value = self.algo.Securities[position['long_put']].Price if position['long_put'] in self.algo.Securities else 0
        
        return (short_value - long_value) * 100 * position['contracts']
    
    def _close_position(self, position):
        """Close an LT112 position"""
        
        try:
            self.algo.MarketOrder(position['short_put'], position['contracts'])
        except Exception as e:

            # Buy back short put
            
            # Sell long put
            self.algo.MarketOrder(position['long_put'], -position['contracts'])
            
            # Update position status
            position['status'] = 'closed'
            position['exit_time'] = self.algo.Time
            
            # Calculate final P&L
            final_value = self._get_position_value(position)
            pnl = position['entry_credit'] - final_value
            
            # Update statistics
            if pnl > 0:
                self.wins += 1
            else:
                self.losses += 1
            
            self.algo.Debug(f"[LT112] Closed position, P&L: ${pnl:.2f}")
            
        except Exception as e:
            self.algo.Error(f"[LT112] Close position error: {e}")
    
    def _get_vix_value(self) -> float:
        """Get current VIX value from UnifiedVIXManager"""
        
        # UnifiedVIXManager is always initialized in main.py
        return self.algo.vix_manager.get_current_vix()
    
    def _can_trade_again_today(self) -> bool:
        """LT112 only enters once per Wednesday"""
        return False
    
    def _place_exit_orders(self) -> bool:
        """
        Place LT112 put spread exit orders following Tom King methodology
        Exits at 50% profit or TradingConstants.DEFENSIVE_EXIT_DTE DTE defensive exit
        """
        try:
            pass
        except Exception as e:

            if not self.current_position:
                self.algo.Error("[LT112] No position to exit")
                return False
                
            if not isinstance(self.current_position, dict):
                self.algo.Error("[LT112] Invalid position format for exit")
                return False
            
            self.algo.Debug("[LT112] Placing exit orders for put spread")
            
            # Get position details
            short_put = self.current_position.get('short_put')
            long_put = self.current_position.get('long_put')
            contracts = self.current_position.get('contracts', 1)
            
            if not short_put or not long_put:
                self.algo.Error("[LT112] Missing position symbols for exit")
                return False
            
            # Validate symbols exist in securities
            if short_put not in self.algo.Securities or long_put not in self.algo.Securities:
                self.algo.Error("[LT112] Position symbols not found in securities")
                return False
            
            # Create atomic order group for put spread exit
            from helpers.atomic_order_executor import AtomicOrderGroup
            exit_group = AtomicOrderGroup(self.algo, f"LT112_Exit_{self.algo.Time.strftime('%H%M%S')}")
            
            # Get current holdings
            short_put_quantity = self.algo.Securities[short_put].Holdings.Quantity
            long_put_quantity = self.algo.Securities[long_put].Holdings.Quantity
            
            if short_put_quantity == 0 and long_put_quantity == 0:
                self.algo.Log("[LT112] No positions found to exit")
                return True  # Already closed
            
            # Add exit legs (opposite quantities to close)
            if short_put_quantity != 0:
                exit_group.add_leg(short_put, -short_put_quantity)
                self.algo.Debug(f"[LT112] Exit short put: {short_put} quantity {-short_put_quantity}")
            
            if long_put_quantity != 0:
                exit_group.add_leg(long_put, -long_put_quantity)
                self.algo.Debug(f"[LT112] Exit long put: {long_put} quantity {-long_put_quantity}")
            
            # Execute atomic exit
            success = exit_group.execute()
            
            if success:
                # Track exit orders for monitoring
                exit_orders_placed = []
                for order in exit_group.orders:
                    if order and hasattr(order, 'OrderId'):
                        exit_orders_placed.append(order.OrderId)
                
                # Notify SPY concentration manager about pending exit
                if hasattr(self.algo, 'spy_concentration_manager'):
                    self.algo.spy_concentration_manager.notify_pending_exit(
                        strategy_name="LT112",
                        position_info=self.current_position
                    )
                
                # Mark position as closing
                self.current_position['status'] = 'closing'
                
                # Update position in tracking list
                for i, pos in enumerate(self.lt112_positions):
                    if pos.get('entry_time') == self.current_position.get('entry_time'):
                        self.lt112_positions[i]['status'] = 'closing'
                        break
                
                self.algo.Log(f"[LT112] Exit orders placed successfully: {len(exit_orders_placed)} orders")
                return True
                
            else:
                self.algo.Error("[LT112] Failed to place exit orders atomically")
                return False
                
        except Exception as e:
            self.algo.Error(f"[LT112] Exit order placement failed: {e}")
            import traceback
            self.algo.Error(f"[LT112] Exit error traceback: {traceback.format_exc()}")
            return False