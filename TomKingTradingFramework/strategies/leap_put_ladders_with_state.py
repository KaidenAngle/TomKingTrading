# LEAP Put Ladders Strategy with State Machine Pattern
# Tom King's long-term put ladder strategy with clean state management

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from datetime import time, timedelta
from typing import Dict, List, Optional

class LEAPPutLaddersWithState(BaseStrategyWithState):
    """
    Tom King's LEAP Put Ladders strategy with state machine pattern
    Builds ladder of long-dated puts for portfolio protection
    Manages rolling and rebalancing systematically
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm, "LEAPLadders")
        
        # LEAP parameters
        self.entry_time = time(10, 30)  # 10:30 AM ET entry
        
        # Ladder configuration
        self.ladder_rungs = 5           # Number of ladder rungs
        self.min_dte = TradingConstants.CALENDAR_DAYS_PER_YEAR              # Minimum 1 year out
        self.max_dte = 730              # Maximum 2 years out
        self.roll_dte = 90              # Roll when 90 DTE remaining
        
        # Strike selection
        self.put_strikes = [            # Ladder strike percentages
            0.70,  # 30% OTM
            0.75,  # 25% OTM
            0.80,  # 20% OTM
            0.85,  # 15% OTM
            0.90   # 10% OTM
        ]
        
        # Position tracking
        self.ladder_positions = []
        self.target_allocation = 0.05    # 5% of portfolio for protection
        
        # Rebalancing
        self.rebalance_frequency = 30    # Days between rebalances
        self.last_rebalance = None
        
        # Add ladder-specific transitions
        self._setup_ladder_transitions()
    
    def _setup_ladder_transitions(self):
        """Setup ladder-specific state transitions"""
        
        # Monthly rebalancing
        self.state_machine.add_transition(
            StrategyState.MANAGING,
            StrategyState.ADJUSTING,
            TransitionTrigger.ADJUSTMENT_NEEDED,
            condition=lambda data: self._needs_rebalancing()
        )
        
        # Quarterly ladder review
        self.state_machine.add_transition(
            StrategyState.READY,
            StrategyState.ANALYZING,
            TransitionTrigger.TIME_WINDOW_START,
            condition=lambda data: self._is_ladder_review_time()
        )
    
    def _check_entry_conditions(self) -> bool:
        """Check if ladder entry conditions are met"""
        
        # Check if ladder needs building/rebuilding
        if not self._ladder_needs_work():
            return False
        
        # Check entry time
        if self.algo.Time.time() < self.entry_time:
            return False
        
        # Check market conditions
        if not self._check_market_conditions():
            return False
        
        # Check allocation limits
        if not self._check_allocation_available():
            return False
        
        return True
    
    def _place_entry_orders(self) -> bool:
        """Build or rebuild put ladder using atomic execution

        CRITICAL: Uses atomic execution for multi-rung ladder construction
        Prevents partial ladder with gaps in protection
        """

        try:
            spy = self.algo.spy
            current_price = self.algo.Securities[spy].Price
            
            # Calculate allocation per rung using centralized portfolio access
            portfolio_value = self.algo.position_sizer.get_portfolio_value()
            total_allocation = portfolio_value * self.target_allocation
            allocation_per_rung = total_allocation / self.ladder_rungs
            
            # Collect all ladder rungs for atomic execution
            ladder_legs = []
            pending_positions = []

            for i, strike_pct in enumerate(self.put_strikes):
                # Check if this rung needs filling
                if self._rung_exists(i):
                    continue

                # Calculate target strike
                target_strike = round(current_price * strike_pct, 0)

                # Find LEAP options
                contracts = self._find_leap_options(spy)
                if not contracts:
                    self.algo.Debug(f"[Ladder] No LEAP options found for rung {i}")
                    continue

                # Find best put contract
                put_contract = self._find_closest_strike(contracts, target_strike, "put")
                if not put_contract:
                    continue

                # Calculate contracts to buy
                put_price = self._get_option_price(put_contract)
                if put_price <= 0:
                    continue

                contracts_to_buy = max(1, int(allocation_per_rung / (put_price * 100)))

                # Check SPY concentration limits before adding to atomic execution
                if hasattr(self.algo, 'spy_concentration_manager'):
                    # LEAP puts have delta around -0.40 to -0.50
                    estimated_delta = -0.45 * contracts_to_buy * 100
                    approved, reason = self.algo.spy_concentration_manager.request_spy_allocation(
                        strategy_name="LEAPLadders",
                        position_type="leap_put",
                        requested_delta=estimated_delta,
                        requested_contracts=contracts_to_buy
                    )

                    if not approved:
                        self.algo.Debug(f"[Ladder] SPY allocation denied for rung {i}: {reason}")
                        continue

                # Add to atomic execution list
                ladder_legs.append((put_contract, contracts_to_buy))

                # Prepare position tracking
                position = {
                    'entry_time': self.algo.Time,
                    'rung_index': i,
                    'put_contract': put_contract,
                    'contracts': contracts_to_buy,
                    'entry_price': put_price,
                    'target_strike_pct': strike_pct,
                    'status': 'open',
                    'state': StrategyState.POSITION_OPEN
                }
                pending_positions.append(position)

            # Execute ladder atomically if we have legs to place
            if ladder_legs:
                self.algo.Debug(f"[Ladder] Executing {len(ladder_legs)} ladder rungs atomically")

                # Hybrid execution: TastyTrade for live, atomic executor for backtests
                success = False
                if not self.algo.is_backtest and hasattr(self.algo, 'tastytrade_integration'):
                    # Live mode - use TastyTrade integration
                    # Extract put strikes and expiry from ladder_legs for TastyTrade format
                    # ladder_legs contains (contract, quantity) tuples
                    put_strikes = [leg[0].ID.StrikePrice for leg in ladder_legs]
                    expiry_date = ladder_legs[0][0].ID.Date if ladder_legs else None
                    quantity = 1  # Standard quantity for ladder construction
                    
                    success = self.algo.tastytrade_integration.execute_leap_ladder_live(
                        put_strikes=put_strikes,
                        expiry_date=expiry_date,
                        quantity=quantity
                    )
                elif hasattr(self.algo, 'atomic_executor'):
                    # Backtest mode - use atomic executor
                    success = self.algo.atomic_executor.execute_leap_ladder_atomic(
                        ladder_legs=ladder_legs,
                        strategy_name="LEAP_Ladder"
                    )

                    if success:
                        # All legs filled - add all positions to tracking
                        for position in pending_positions:
                            self.ladder_positions.append(position)
                            self.algo.Debug(
                                f"[Ladder] Built rung {position['rung_index']}: {position['contracts']}x {position['put_contract'].Strike} puts"
                            )

                        self.last_rebalance = self.algo.Time
                        return True
                    else:
                        self.algo.Error("[Ladder] Atomic ladder execution failed - no partial positions created")
                        return False
                else:
                    self.algo.Error("[Ladder] Atomic executor not available")
                    return False
            else:
                self.algo.Debug("[Ladder] No new ladder rungs needed")
                return True
            
        except Exception as e:
            self.algo.Error(f"[Ladder] Entry error: {e}")
            return False
    
    def _manage_position(self):
        """Manage ladder positions"""
        
        for position in self.ladder_positions:
            if position['status'] != 'open':
                continue
            
            # Check if needs rolling (approaching expiration)
            if self._check_needs_rolling(position):
                self.algo.Debug(f"[Ladder] Rung {position['rung_index']} needs rolling")
                self.state_machine.trigger(
                    TransitionTrigger.ADJUSTMENT_NEEDED,
                    {'position': position, 'action': 'roll'}
                )
                return
            
            # Check if significantly ITM (potential profit taking)
            if self._check_deep_itm(position):
                self.algo.Debug(f"[Ladder] Rung {position['rung_index']} deep ITM")
                self._take_profit(position)
        
        # Check if ladder needs rebalancing
        if self._needs_rebalancing():
            self.state_machine.trigger(
                TransitionTrigger.ADJUSTMENT_NEEDED,
                {'action': 'rebalance'}
            )
    
    def _execute_adjustment(self) -> bool:
        """Execute ladder adjustment (roll or rebalance)"""
        
        # Check what type of adjustment needed
        positions_to_roll = [
            p for p in self.ladder_positions 
            if self._check_needs_rolling(p) and p['status'] == 'open'
        ]
        
        if positions_to_roll:
            return self._roll_positions(positions_to_roll)
        
        if self._needs_rebalancing():
            return self._rebalance_ladder()
        
        return True
    
    def _roll_positions(self, positions: List[Dict]) -> bool:
        """Roll expiring ladder positions"""
        
        success = True
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        for position in positions:
            try:
                self.algo.MarketOrder(position['put_contract'], -position['contracts'])
            except Exception as e:

                # Sell current position
                
                # Find new LEAP put
                target_strike = round(current_price * position['target_strike_pct'], 0)
                contracts = self._find_leap_options(spy)
                new_put = self._find_closest_strike(contracts, target_strike, "put")
                
                if new_put:
                    # Buy new put
                    self.algo.MarketOrder(new_put, position['contracts'])
                    
                    # Update position
                    position['put_contract'] = new_put
                    position['entry_time'] = self.algo.Time
                    position['entry_price'] = self._get_option_price(new_put)
                    
                    self.algo.Debug(
                        f"[Ladder] Rolled rung {position['rung_index']} to {new_put.Strike}"
                    )
                else:
                    # Mark as needs rebuild
                    position['status'] = 'closed'
                    self.algo.Debug(f"[Ladder] Closed rung {position['rung_index']} - rebuild needed")
                    
            except Exception as e:
                self.algo.Error(f"[Ladder] Roll error: {e}")
                success = False
        
        return success
    
    def _rebalance_ladder(self) -> bool:
        """Rebalance ladder to maintain target allocation"""
        
        try:
            portfolio_value = self.algo.position_sizer.get_portfolio_value()
            target_value = portfolio_value * self.target_allocation
            current_value = self._get_ladder_value()

            # Check if rebalancing needed (>20% deviation)
            deviation = abs(current_value - target_value) / target_value
            if deviation < 0.20:
                return True

            self.algo.Debug(f"[Ladder] Rebalancing: current ${current_value:.0f}, target ${target_value:.0f}")

            # Adjust each rung proportionally
            adjustment_factor = target_value / current_value if current_value > 0 else 1
            for position in self.ladder_positions:
                if position['status'] != 'open':
                    continue
                new_contracts = int(position['contracts'] * adjustment_factor)
                delta_contracts = new_contracts - position['contracts']
                if delta_contracts != 0:
                    self.algo.MarketOrder(position['put_contract'], delta_contracts)
                    position['contracts'] = new_contracts
                    self.algo.Debug(
                        f"[Ladder] Adjusted rung {position['rung_index']} by {delta_contracts} contracts"
                    )

            self.last_rebalance = self.algo.Time
            return True

        except Exception as e:
            self.algo.Error(f"[Ladder] Rebalance error: {e}")
            return False
    
    def _ladder_needs_work(self) -> bool:
        """Check if ladder needs building or rebuilding"""
        
        # Count open rungs
        open_rungs = sum(1 for p in self.ladder_positions if p['status'] == 'open')
        
        # Need work if missing rungs
        return open_rungs < self.ladder_rungs
    
    def _rung_exists(self, rung_index: int) -> bool:
        """Check if specific rung already exists"""
        
        return any(
            p['rung_index'] == rung_index and p['status'] == 'open'
            for p in self.ladder_positions
        )
    
    def _is_ladder_review_time(self) -> bool:
        """Check if it's time for quarterly ladder review"""
        
        # First trading day of quarter
        month = self.algo.Time.month
        day = self.algo.Time.day
        
        return month in [1, 4, 7, 10] and day <= 5
    
    def _check_market_conditions(self) -> bool:
        """Check if market conditions suitable for ladder building"""
        
        # Check VIX - better to build ladders when VIX is moderate
        vix = self._get_vix_value()
        if vix > 40:
            self.algo.Debug(f"[Ladder] VIX too high for ladder building ({vix:.2f})")
            return False
        
        return True
    
    def _check_allocation_available(self) -> bool:
        """Check if allocation available for ladder"""
        
        portfolio_value = self.algo.position_sizer.get_portfolio_value()
        target_value = portfolio_value * self.target_allocation
        current_value = self._get_ladder_value()
        
        # Can add more if under target
        return current_value < target_value * 1.2  # Allow 20% over-allocation
    
    def _needs_rebalancing(self) -> bool:
        """Check if ladder needs rebalancing"""
        
        if self.last_rebalance is None:
            return True
        
        days_since_rebalance = (self.algo.Time - self.last_rebalance).days
        if days_since_rebalance < self.rebalance_frequency:
            return False
        
        # Check deviation from target
        portfolio_value = self.algo.position_sizer.get_portfolio_value()
        target_value = portfolio_value * self.target_allocation
        current_value = self._get_ladder_value()
        
        deviation = abs(current_value - target_value) / target_value if target_value > 0 else 0
        
        return deviation > 0.20  # Rebalance if >20% deviation
    
    def _find_leap_options(self, symbol) -> List:
        """Find LEAP options with 1-2 year expiration"""
        
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
    
    def _check_needs_rolling(self, position) -> bool:
        """Check if position needs rolling"""
        
        put = position['put_contract']
        days_to_expiry = (put.ID.Date - self.algo.Time).days
        
        return days_to_expiry <= self.roll_dte
    
    def _check_deep_itm(self, position) -> bool:
        """Check if position is deep in the money"""
        
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        strike = position['put_contract'].ID.StrikePrice
        
        # Deep ITM if more than 10% ITM
        return current_price < strike * 0.90
    
    def _take_profit(self, position):
        """Take profit on deep ITM position"""
        
        try:
            self.algo.MarketOrder(position['put_contract'], -position['contracts'])
        except Exception as e:

            # Sell the profitable put
            
            # Calculate profit
            exit_price = self._get_option_price(position['put_contract'])
            pnl = (exit_price - position['entry_price']) * 100 * position['contracts']
            
            # Mark as closed
            position['status'] = 'closed'
            position['exit_time'] = self.algo.Time
            
            self.algo.Debug(f"[Ladder] Took profit on rung {position['rung_index']}, P&L: ${pnl:.2f}")
            
            # Will rebuild this rung on next cycle
            
        except Exception as e:
            self.algo.Error(f"[Ladder] Take profit error: {e}")
    
    def _get_ladder_value(self) -> float:
        """Get total value of ladder positions"""
        
        total_value = 0
        for position in self.ladder_positions:
            if position['status'] == 'open':
                price = self._get_option_price(position['put_contract'])
                total_value += price * 100 * position['contracts']
        
        return total_value
    
    def _get_option_price(self, contract) -> float:
        """Get current option price"""
        
        if contract in self.algo.Securities:
            return self.algo.Securities[contract].Price
        
        # Fallback estimate for LEAP puts
        return 10.0  # Rough estimate
    
    def _get_vix_value(self) -> float:
        """Get current VIX value from UnifiedVIXManager"""
        
        # Use central VIX manager - single source of truth
        if hasattr(self.algo, 'vix_manager'):
            vix = self.algo.vix_manager.get_current_vix()
            if vix and vix > 0:
                return vix
        
        # LEAP ladders prefer to buy when VIX is low
        self.algo.Debug("[LEAPLadders] VIX data unavailable, using default 20")
        return 20.0  # Conservative default
    
    def _place_exit_orders(self) -> bool:
        """Place LEAP ladder exit orders following Tom King methodology"""
        
        try:
            # Find positions that need exiting
            positions_to_exit = [
                pos for pos in self.ladder_positions
                if pos['status'] == 'open' and self._should_exit_position(pos)
            ]

            if not positions_to_exit:
                return True

            exit_success = True

            for position in positions_to_exit:
                try:
                    # Get position details
                    put_contract = position['put_contract']
                    contracts = position['contracts']
                    entry_price = position['entry_price']
                    rung_index = position['rung_index']

                    # Calculate current metrics
                    current_price = self._get_option_price(put_contract)
                    pnl = (current_price - entry_price) * 100 * contracts
                    pnl_pct = (current_price - entry_price) / entry_price if entry_price > 0 else 0
                    
                    # Place exit order (sell the long put)
                    order = self.algo.MarketOrder(put_contract, -contracts)
                    
                    if not order:
                        self.algo.Error(f"[LEAPLadders] Failed to place exit order for rung {rung_index}")
                        exit_success = False
                        continue
                    
                    # Update position status
                    position['status'] = 'closed'
                    position['exit_time'] = self.algo.Time
                    position['exit_price'] = current_price
                    position['exit_reason'] = self._get_exit_reason(position)
                    position['final_pnl'] = pnl
                    
                    # Update strategy statistics
                    if pnl > 0:
                        self.wins += 1
                    else:
                        self.losses += 1
                    
                    # Log exit details
                    self.algo.Log(
                        f"[LEAPLadders] Exited rung {rung_index}: "
                        f"P&L: ${pnl:.2f} ({pnl_pct:.1%}), "
                        f"Reason: {position['exit_reason']}, "
                        f"Strike: {put_contract.ID.StrikePrice}, "
                        f"Contracts: {contracts}"
                    )
                    
                    # Fire exit event for position state manager
                    if hasattr(self.algo, 'event_bus'):
                        self.algo.event_bus.fire_event(
                            'position_exited',
                            {
                                'strategy': self.strategy_name,
                                'position_id': f"leap_rung_{rung_index}_{position['entry_time'].strftime('%Y%m%d_%H%M%S')}",
                                'exit_time': position['exit_time'],
                                'pnl': pnl,
                                'reason': position['exit_reason'],
                                'rung_index': rung_index,
                                'strike': put_contract.ID.StrikePrice
                            }
                        )
                    
                    # Release SPY allocation if SPY concentration manager exists
                    if hasattr(self.algo, 'spy_concentration_manager'):
                        released_delta = 0.45 * contracts * 100  # Approximate LEAP put delta
                        self.algo.spy_concentration_manager.release_spy_allocation(
                            strategy_name="LEAPLadders",
                            position_type="leap_put",
                            released_delta=released_delta
                        )
                    
                except Exception as position_error:
                    self.algo.Error(f"[LEAPLadders] Error exiting rung {position.get('rung_index', 'unknown')}: {position_error}")
                    exit_success = False
                    continue
            
            # Update statistics
            if exit_success:
                self.algo.Debug(f"[LEAPLadders] Successfully exited {len(positions_to_exit)} ladder rungs")
            else:
                self.algo.Error("[LEAPLadders] Some rung exits failed")
            
            # Check if ladder needs rebuilding after exits
            if self._ladder_needs_work():
                self.algo.Debug("[LEAPLadders] Ladder needs rebuilding after exits")
            
            return exit_success
            
        except Exception as e:
            self.algo.Error(f"[LEAPLadders] Critical error in _place_exit_orders: {e}")
            return False
    
    def _should_exit_position(self, position) -> bool:
        """Determine if LEAP position should be exited based on Tom King rules"""

        try:
            put_contract = position['put_contract']

            # Check expiration - roll at 90 DTE or close if can't roll
            days_to_expiry = (put_contract.ID.Date - self.algo.Time).days
            if days_to_expiry <= self.roll_dte:
                spy = self.algo.spy
                current_price = self.algo.Securities[spy].Price
                target_strike = round(current_price * position.get('target_strike_pct', 0.85), 0)
                contracts = self._find_leap_options(spy)
                new_put = self._find_closest_strike(contracts, target_strike, "put")
                if not new_put:
                    # Can't roll, must exit
                    return True

            # Check if deep ITM - take profit opportunity
            if self._check_deep_itm(position):
                spy = self.algo.spy
                current_price = self.algo.Securities[spy].Price
                strike = position['put_contract'].ID.StrikePrice

                # Deep ITM with significant profit - Tom King rule for protection ladders
                current_option_price = self._get_option_price(position['put_contract'])
                entry_price = position['entry_price']
                if entry_price > 0:
                    profit_pct = (current_option_price - entry_price) / entry_price
                    # Exit if put has doubled in value (100%+ profit)
                    if profit_pct >= 1.0:
                        return True

            # Check for emergency liquidation conditions
            if self._check_emergency_exit(position):
                return True

            return False
        except Exception as e:
            self.algo.Debug(f"[LEAPLadders] Error checking exit condition: {e}")
            return False
    
    def _check_emergency_exit(self, position) -> bool:
        """Check for emergency exit conditions specific to LEAP ladders"""
        
        try:
            # Check if ladder allocation has grown too large (>10% of portfolio)
            portfolio_value = self.algo.position_sizer.get_portfolio_value()
            ladder_value = self._get_ladder_value()

            if ladder_value > portfolio_value * 0.10:
                return True

            # Check if individual position has grown disproportionately
            put_price = self._get_option_price(position['put_contract'])
            position_value = put_price * 100 * position['contracts']

            # Exit if single rung > 3% of portfolio (concentration risk)
            if position_value > portfolio_value * 0.03:
                return True

            # Check for black swan market conditions (VIX spike)
            vix = self._get_vix_value()
            if vix > 60:  # Extreme volatility - consider taking profits
                current_price = self._get_option_price(position['put_contract'])
                entry_price = position['entry_price']
                if entry_price > 0 and (current_price / entry_price) > 2.0:
                    return True  # Exit if put has more than doubled during VIX spike
            
            return False
            
        except Exception as e:
            self.algo.Debug(f"[LEAPLadders] Error checking emergency exit: {e}")
            return False
    
    def _get_exit_reason(self, position) -> str:
        """Get the reason for LEAP position exit"""

        try:
            put_contract = position['put_contract']
            days_to_expiry = (put_contract.ID.Date - self.algo.Time).days

            # Check expiration
            if days_to_expiry <= self.roll_dte:
                return f"Expiration Approaching ({days_to_expiry} DTE)"

            # Check profit taking
            current_price = self._get_option_price(position['put_contract'])
            entry_price = position['entry_price']
            if entry_price > 0:
                profit_pct = (current_price - entry_price) / entry_price
                if profit_pct >= 1.0:
                    return f"Profit Taking (100%+ gain)"

            # Check deep ITM
            if self._check_deep_itm(position):
                return "Deep ITM Protection Activated"

            # Check emergency conditions
            portfolio_value = self.algo.position_sizer.get_portfolio_value()
            ladder_value = self._get_ladder_value()
            if ladder_value > portfolio_value * 0.10:
                return "Ladder Over-Allocation (>10%)"

            position_value = current_price * 100 * position['contracts']
            if position_value > portfolio_value * 0.03:
                return "Position Concentration Risk (>3%)"

            vix = self._get_vix_value()
            if vix > 60 and profit_pct >= 2.0:
                return f"VIX Spike Profit Taking (VIX: {vix:.1f})"

            return "Manual Exit"

        except Exception as e:
            self.algo.Debug(f"[LEAPLadders] Error determining exit reason: {e}")
            return "Exit Error"
    
    def _can_trade_again_today(self) -> bool:
        """Ladder adjustments can happen throughout the day"""
        
        return self._ladder_needs_work()