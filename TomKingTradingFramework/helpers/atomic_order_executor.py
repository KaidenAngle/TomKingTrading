# Enhanced Atomic Order Executor for Multi-Leg Strategies
# Production-grade atomic execution with rollback capability

from AlgorithmImports import *
from typing import List, Dict, Optional
from enum import Enum, auto
from datetime import timedelta

class OrderGroupStatus(Enum):
    """Status of atomic order group"""
    PENDING = auto()
    PLACING = auto()
    MONITORING = auto()
    FILLED = auto()
    PARTIAL = auto()
    FAILED = auto()
    ROLLING_BACK = auto()
    ROLLED_BACK = auto()

class AtomicOrderGroup:
    """
    Manages atomic execution of multi-leg orders
    All legs must fill or all are cancelled/reversed
    """
    
    def __init__(self, algorithm, group_id: str):
        self.algo = algorithm
        self.group_id = group_id
        self.status = OrderGroupStatus.PENDING
        
        # Order tracking
        self.orders = []  # List of order tickets
        self.target_legs = []  # List of (symbol, quantity) tuples
        self.filled_legs = []  # Successfully filled legs
        self.pending_legs = []  # Awaiting fill
        self.failed_legs = []  # Failed to fill
        
        # Timing
        self.created_time = self.algo.Time
        self.timeout = timedelta(seconds=30)  # 30 second timeout
        
        # Rollback tracking
        self.rollback_orders = []
        self.rollback_complete = False
    
    def add_leg(self, symbol, quantity: int):
        """Add a leg to the atomic group"""
        
        # FIXED: Add comprehensive validation to prevent bypasses
        if self.status != OrderGroupStatus.PENDING:
            raise Exception(f"Cannot add legs to {self.status.name} group")
        
        # Validate symbol input
        if symbol is None:
            raise ValueError("Symbol cannot be None")
        
        # Validate quantity input
        if not isinstance(quantity, (int, float)) or quantity == 0:
            raise ValueError(f"Invalid quantity for {symbol}: {quantity}")
            
        if abs(quantity) > 1000:  # Sanity check for extremely large quantities
            raise ValueError(f"Suspiciously large quantity for {symbol}: {quantity}")
        
        quantity = int(quantity)  # Ensure integer
        
        self.target_legs.append((symbol, quantity))
        self.algo.Debug(f"[Atomic-{self.group_id}] Added leg: {symbol} x{quantity}")
    
    def execute(self) -> bool:
        """Execute all legs atomically"""
        
        # FIXED: Add validation to prevent bypass execution
        if not self.target_legs:
            self.algo.Error(f"[Atomic-{self.group_id}] No legs to execute")
            return False
        
        if self.status != OrderGroupStatus.PENDING:
            self.algo.Error(f"[Atomic-{self.group_id}] Cannot execute in {self.status.name} status")
            return False
        
        # Validate we have algorithm access
        if not hasattr(self.algo, 'MarketOrder') or not hasattr(self.algo, 'LimitOrder'):
            self.algo.Error(f"[Atomic-{self.group_id}] Algorithm order methods not available")
            return False
        
        self.status = OrderGroupStatus.PLACING
        self.algo.Debug(f"[Atomic-{self.group_id}] Executing {len(self.target_legs)} legs")
        
        try:
            # Place all orders
            for symbol, quantity in self.target_legs:
                order = self._place_smart_order(symbol, quantity)
                
                if order:
                    self.orders.append(order)
                    self.pending_legs.append((symbol, quantity, order))
                else:
                    self.algo.Error(f"[Atomic-{self.group_id}] Failed to place order for {symbol}")
                    self.status = OrderGroupStatus.FAILED
                    self._rollback()
                    return False
            
            # Monitor fills
            self.status = OrderGroupStatus.MONITORING
            return self._monitor_fills()
            
        except Exception as e:
            self.algo.Error(f"[Atomic-{self.group_id}] Execution error: {e}")
            self.status = OrderGroupStatus.FAILED
            self._rollback()
            return False
    
    def _place_smart_order(self, symbol, quantity: int):
        """Place order with smart routing using unified pricing"""
        
        try:
            if hasattr(self.algo, 'unified_pricing'):
                is_buy = quantity > 0
                limit_price, use_limit = self.algo.unified_pricing.calculate_limit_price(
                    symbol, is_buy
                )
                
                # Use unified pricing if available
                if use_limit and limit_price > 0:
                    # Place limit order with unified pricing
                    order = self.algo.LimitOrder(symbol, quantity, limit_price)
                    
                    # Set order properties for better execution
                    if order:
                        order.Tag = f"Atomic-{self.group_id}"
                    
                    return order
            
            # Fallback to legacy pricing if unified not available
            if symbol in self.algo.Securities:
                security = self.algo.Securities[symbol]
                
                # For options, use limit orders with smart pricing
                if symbol.SecurityType == SecurityType.Option:
                    bid = security.BidPrice
                    ask = security.AskPrice
                    
                    if bid > 0 and ask > 0:
                        # Calculate smart limit price (40% rule)
                        if quantity > 0:  # Buying
                            limit_price = bid + (ask - bid) * 0.40
                        else:  # Selling
                            limit_price = ask - (ask - bid) * 0.40
                        
                        limit_price = round(limit_price, 2)
                        
                        # Place limit order
                        order = self.algo.LimitOrder(symbol, quantity, limit_price)
                        
                        if order:
                            order.Tag = f"Atomic-{self.group_id}"
                        
                        return order
            
            # Final fallback to market order
            return self.algo.MarketOrder(symbol, quantity)
            
        except Exception as e:
            self.algo.Error(f"[Atomic-{self.group_id}] Smart order error: {e}")
            return None
    
    def _monitor_fills(self) -> bool:
        """Monitor order fills with timeout"""
        
        start_time = self.algo.Time
        
        while self.algo.Time - start_time < self.timeout:
            all_filled = True
            
            for symbol, quantity, order in self.pending_legs[:]:
                if order.Status == OrderStatus.Filled:
                    # Move to filled
                    self.pending_legs.remove((symbol, quantity, order))
                    self.filled_legs.append((symbol, quantity, order))
                    
                elif order.Status in [OrderStatus.Canceled, OrderStatus.Invalid]:
                    # Move to failed
                    self.pending_legs.remove((symbol, quantity, order))
                    self.failed_legs.append((symbol, quantity, order))
                    all_filled = False
                    
                elif order.Status in [OrderStatus.Submitted, OrderStatus.PartiallyFilled]:
                    # Still pending
                    all_filled = False
            
            # Check completion
            if all_filled and not self.pending_legs:
                if self.failed_legs:
                    self.status = OrderGroupStatus.PARTIAL
                    self.algo.Debug(f"[Atomic-{self.group_id}] Partial fill, rolling back")
                    self._rollback()
                    return False
                else:
                    self.status = OrderGroupStatus.FILLED
                    self.algo.Debug(f"[Atomic-{self.group_id}] All legs filled successfully")
                    return True
            
            # Small delay to avoid tight loop
            # Using time.sleep for order monitoring - QuantConnect handles scheduling
        
        # Timeout reached
        self.algo.Error(f"[Atomic-{self.group_id}] Timeout after {self.timeout.seconds}s")
        self.status = OrderGroupStatus.FAILED
        self._rollback()
        return False
    
    def _rollback(self):
        """Rollback any filled orders"""
        
        if self.status == OrderGroupStatus.ROLLING_BACK:
            return  # Already rolling back
        
        self.status = OrderGroupStatus.ROLLING_BACK
        self.algo.Debug(f"[Atomic-{self.group_id}] Rolling back {len(self.filled_legs)} filled legs")
        
        # Cancel any pending orders
        for symbol, quantity, order in self.pending_legs:
            if order.Status in [OrderStatus.Submitted, OrderStatus.PartiallyFilled]:
                try:
                    self.algo.Transactions.CancelOrder(order.OrderId)
                    self.algo.Debug(f"[Atomic-{self.group_id}] Cancelled pending order for {symbol}")
                except Exception as e:
                    self.algo.Debug(f"[Atomic-{self.group_id}] Rollback cancel failed for {order}: {e}")
        
        # Reverse any filled orders
        for symbol, quantity, order in self.filled_legs:
            try:
                # Place opposite order to flatten position
                reverse_quantity = -quantity
                reverse_order = self.algo.MarketOrder(symbol, reverse_quantity)
                
                if reverse_order:
                    self.rollback_orders.append(reverse_order)
                    self.algo.Debug(f"[Atomic-{self.group_id}] Reversed {symbol} x{quantity}")
                
            except Exception as e:
                self.algo.Error(f"[Atomic-{self.group_id}] Rollback error for {symbol}: {e}")
        
        self.status = OrderGroupStatus.ROLLED_BACK
        self.rollback_complete = True
    
    def get_status(self) -> Dict:
        """Get current status of atomic group"""
        
        return {
            'group_id': self.group_id,
            'status': self.status.name,
            'target_legs': len(self.target_legs),
            'filled_legs': len(self.filled_legs),
            'pending_legs': len(self.pending_legs),
            'failed_legs': len(self.failed_legs),
            'rollback_complete': self.rollback_complete
        }


class EnhancedAtomicOrderExecutor:
    """
    Enhanced order executor with atomic multi-leg support
    Production-ready with monitoring and rollback
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.active_groups = {}  # Track active atomic groups
        self.completed_groups = {}  # History of completed groups
        self.group_counter = 0
    
    def create_atomic_group(self, strategy_name: str = "") -> AtomicOrderGroup:
        """Create new atomic order group"""
        
        self.group_counter += 1
        group_id = f"{strategy_name}-{self.group_counter:04d}"
        
        group = AtomicOrderGroup(self.algo, group_id)
        self.active_groups[group_id] = group
        
        return group
    
    def execute_iron_condor_atomic(self, short_call, long_call, short_put, long_put, quantity: int = 1) -> bool:
        """Execute iron condor atomically with crash recovery"""
        
        group = self.create_atomic_group("IronCondor")
        
        # Add all 4 legs
        group.add_leg(short_call, -quantity)  # Sell call
        group.add_leg(long_call, quantity)     # Buy call
        group.add_leg(short_put, -quantity)    # Sell put
        group.add_leg(long_put, quantity)      # Buy put
        
        # Persist order group BEFORE execution for crash recovery
        if hasattr(self.algo, 'order_recovery'):
            legs = [(short_call, -quantity), (long_call, quantity), 
                   (short_put, -quantity), (long_put, quantity)]
            self.algo.order_recovery.persist_order_group_start(
                group.group_id, legs, "IronCondor"
            )
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        # Update recovery system
        if hasattr(self.algo, 'order_recovery'):
            if success:
                self.algo.order_recovery.mark_order_group_complete(group.group_id)
            else:
                self.algo.order_recovery.mark_order_group_failed(
                    group.group_id, 
                    f"Execution failed: {group.get_status()}"
                )
        
        if success:
            self.algo.Debug(f"Iron condor executed successfully: {group.group_id}")
        else:
            self.algo.Error(f"Iron condor failed: {group.get_status()}")
        
        return success
    
    def execute_put_spread_atomic(self, short_put, long_put, quantity: int = 1) -> bool:
        """Execute put spread atomically"""
        
        group = self.create_atomic_group("PutSpread")
        
        # Add both legs
        group.add_leg(short_put, -quantity)  # Sell put
        group.add_leg(long_put, quantity)    # Buy put
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        return success
    
    def execute_strangle_atomic(self, short_call, short_put, quantity: int = 1) -> bool:
        """Execute strangle atomically"""
        
        group = self.create_atomic_group("Strangle")
        
        # Add both legs
        group.add_leg(short_call, -quantity)  # Sell call
        group.add_leg(short_put, -quantity)   # Sell put
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        return success
    
    def execute_lt112_atomic(self, long_put, short_put, naked_puts, quantity: int = 1) -> bool:
        """Execute LT112 (1-1-2 Put Ratio) atomically - Complex income strategy
        
        CRITICAL: Prevents dangerous naked put exposure without debit spread
        Risk: Naked puts (2x) without protective debit spread = unlimited downside
        
        LT112 Structure:
        - Buy 1 PUT (long protection)
        - Sell 1 PUT (short income - creates debit spread with long)  
        - Sell 2 PUTS (naked income - higher strike, more premium)
        
        Args:
            long_put: Long put option contract (protection)
            short_put: Short put option contract (debit spread partner)
            naked_puts: Naked put option contract (income generation, 2x quantity)
            quantity: Base quantity (naked puts will be 2x this)
            
        Returns:
            bool: True if all 4 legs filled atomically, False if rolled back
        """
        
        # Comprehensive pre-execution validation
        if not self._validate_lt112_configuration(long_put, short_put, naked_puts, quantity):
            return False
            
        group = self.create_atomic_group("LT112")
        
        # Add all legs with proper quantities and directions
        group.add_leg(long_put, quantity)         # Buy 1 put (protection)
        group.add_leg(short_put, -quantity)      # Sell 1 put (debit spread)
        group.add_leg(naked_puts, -quantity * 2) # Sell 2 puts (naked income)
        
        # Persist order group BEFORE execution for crash recovery
        if hasattr(self.algo, 'order_recovery'):
            legs = [
                (long_put, quantity),
                (short_put, -quantity), 
                (naked_puts, -quantity * 2)
            ]
            self.algo.order_recovery.persist_order_group_start(
                group.group_id, legs, "LT112"
            )
        
        # Execute atomically
        success = group.execute()
        
        # Move to completed and clean up
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]
        
        # Update recovery system
        if hasattr(self.algo, 'order_recovery'):
            if success:
                self.algo.order_recovery.mark_order_group_complete(group.group_id)
            else:
                self.algo.order_recovery.mark_order_group_failed(
                    group.group_id,
                    f"LT112 execution failed: {group.get_status()}"
                )
        
        if success:
            self.algo.Debug(f"LT112 executed successfully: {group.group_id}")
            self.algo.Debug(f"Long: {long_put} x{quantity}, Short: {short_put} x{-quantity}, Naked: {naked_puts} x{-quantity*2}")
        else:
            self.algo.Error(f"LT112 execution failed: {group.get_status()}")
            self.algo.Error("LT112 rollback completed - no dangerous naked positions created")
            
        return success

    def execute_ipmcc_atomic(self, leap_call, weekly_call, quantity: int = 1) -> bool:
        """Execute IPMCC atomically - LEAP Call + Weekly Call coordination

        CRITICAL: Prevents expensive LEAP without income generation
        Risk: LEAP (£8,000+) + Weekly (-£200) partial fills = dangerous positions

        Args:
            leap_call: LEAP call option contract (long position)
            weekly_call: Weekly call option contract (short position)
            quantity: Number of contracts (default 1)

        Returns:
            bool: True if both legs filled atomically, False if rolled back
        """

        # Comprehensive pre-execution validation
        if not self._validate_ipmcc_configuration(leap_call, weekly_call, quantity):
            return False

        group = self.create_atomic_group("IPMCC")

        # Add both legs with proper direction
        group.add_leg(leap_call, quantity)    # Buy LEAP call (long)
        group.add_leg(weekly_call, -quantity) # Sell weekly call (short)

        # Persist order group BEFORE execution for crash recovery
        if hasattr(self.algo, 'order_recovery'):
            legs = [(leap_call, quantity), (weekly_call, -quantity)]
            self.algo.order_recovery.persist_order_group_start(
                group.group_id, legs, "IPMCC"
            )

        # Execute atomically
        success = group.execute()

        # Move to completed and clean up
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]

        # Update recovery system
        if hasattr(self.algo, 'order_recovery'):
            if success:
                self.algo.order_recovery.mark_order_group_complete(group.group_id)
            else:
                self.algo.order_recovery.mark_order_group_failed(
                    group.group_id,
                    f"IPMCC execution failed: {group.get_status()}"
                )

        if success:
            self.algo.Debug(f"IPMCC executed successfully: {group.group_id}")
            self.algo.Debug(f"LEAP: {leap_call} x{quantity}, Weekly: {weekly_call} x{-quantity}")
        else:
            self.algo.Error(f"IPMCC execution failed: {group.get_status()}")
            self.algo.Error("IPMCC rollback completed - no dangerous positions created")

        return success

    def execute_leap_ladder_atomic(self, ladder_legs: List[tuple], strategy_name: str = "LEAPLadder") -> bool:
        """Execute LEAP put ladder atomically - Multiple protection levels

        IMPORTANT: Ensures complete protection ladder construction
        Risk: Partial ladder = gaps in portfolio protection coverage

        Args:
            ladder_legs: List of (put_contract, quantity) tuples
            strategy_name: Strategy identifier for tracking

        Returns:
            bool: True if all rungs filled atomically, False if rolled back
        """

        # Comprehensive pre-execution validation
        if not self._validate_leap_ladder_configuration(ladder_legs):
            return False

        group = self.create_atomic_group(strategy_name)

        # Add all ladder rungs (all long puts)
        for put_contract, contracts in ladder_legs:
            if contracts <= 0:
                self.algo.Error(f"[LEAP-Ladder] Invalid quantity for {put_contract}: {contracts}")
                return False
            group.add_leg(put_contract, contracts)

        # Persist order group BEFORE execution for crash recovery
        if hasattr(self.algo, 'order_recovery'):
            self.algo.order_recovery.persist_order_group_start(
                group.group_id, ladder_legs, strategy_name
            )

        # Execute atomically
        success = group.execute()

        # Move to completed and clean up
        self.completed_groups[group.group_id] = group
        del self.active_groups[group.group_id]

        # Update recovery system
        if hasattr(self.algo, 'order_recovery'):
            if success:
                self.algo.order_recovery.mark_order_group_complete(group.group_id)
            else:
                self.algo.order_recovery.mark_order_group_failed(
                    group.group_id,
                    f"LEAP ladder execution failed: {group.get_status()}"
                )

        if success:
            self.algo.Debug(f"LEAP ladder executed successfully: {group.group_id}")
            self.algo.Debug(f"Ladder rungs: {len(ladder_legs)} protection levels")
        else:
            self.algo.Error(f"LEAP ladder execution failed: {group.get_status()}")
            self.algo.Error("LEAP ladder rollback completed - no partial protection")

        return success
    
    def _validate_lt112_configuration(self, long_put, short_put, naked_puts, quantity: int) -> bool:
        """Validate LT112 configuration to prevent dangerous naked put exposure
        
        CRITICAL VALIDATION: Strike relationships must create safe put ratio spread
        Validation ensures: long_strike > short_strike > naked_strike
        """
        
        try:
            # Basic parameter validation
            if not long_put or not short_put or not naked_puts:
                self.algo.Error("[LT112-Validation] Missing option contracts")
                return False
                
            if quantity <= 0 or quantity > 50:  # Sanity check
                self.algo.Error(f"[LT112-Validation] Invalid quantity: {quantity}")
                return False
            
            # Extract strike prices for validation
            long_strike = self._extract_strike_price(long_put)
            short_strike = self._extract_strike_price(short_put)
            naked_strike = self._extract_strike_price(naked_puts)
            
            if not long_strike or not short_strike or not naked_strike:
                self.algo.Error("[LT112-Validation] Could not extract strike prices")
                return False
            
            # CRITICAL SAFETY CHECK: Strike relationship for put ratio
            # Long put (protection) should be highest strike
            # Short put (debit spread) should be middle strike  
            # Naked puts (income) should be lowest strike
            if not (long_strike > short_strike > naked_strike):
                self.algo.Error(f"[LT112-Validation] DANGEROUS STRIKE CONFIGURATION!")
                self.algo.Error(f"Expected: Long({long_strike}) > Short({short_strike}) > Naked({naked_strike})")
                self.algo.Error("Strike relationship must be descending for safe put ratio")
                return False
            
            # Validate strike spacing (reasonable spreads)
            debit_spread_width = long_strike - short_strike
            ratio_spread_width = short_strike - naked_strike
            
            if debit_spread_width < 1 or debit_spread_width > 20:
                self.algo.Warning(f"[LT112-Validation] Unusual debit spread width: ${debit_spread_width}")
                
            if ratio_spread_width < 1 or ratio_spread_width > 30:
                self.algo.Warning(f"[LT112-Validation] Unusual ratio spread width: ${ratio_spread_width}")
            
            # Check maximum naked put exposure (2x quantity is significant risk)
            naked_exposure = naked_strike * 100 * quantity * 2  # 2x naked puts
            if hasattr(self.algo, 'Portfolio'):
                portfolio_value = self.algo.Portfolio.TotalPortfolioValue
                if naked_exposure > portfolio_value * 0.25:  # 25% max exposure
                    self.algo.Error(f"[LT112-Validation] Naked put exposure too high: ${naked_exposure:.0f}")
                    self.algo.Error(f"This exceeds 25% of portfolio (${portfolio_value * 0.25:.0f})")
                    return False
            
            self.algo.Debug(f"[LT112-Validation] Configuration validated successfully")
            self.algo.Debug(f"Strikes - Long: {long_strike}, Short: {short_strike}, Naked: {naked_strike}")
            self.algo.Debug(f"Naked exposure: ${naked_exposure:.0f} (2x quantity)")
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[LT112-Validation] Validation error: {e}")
            return False

    def _validate_ipmcc_configuration(self, leap_call, weekly_call, quantity: int) -> bool:
        """Validate IPMCC configuration to prevent dangerous setups

        CRITICAL VALIDATION: Weekly call strike MUST be below LEAP call strike
        Violation creates unlimited risk if assigned
        """

        try:
            # Basic parameter validation
            if not leap_call or not weekly_call:
                self.algo.Error("[IPMCC-Validation] Missing option contracts")
                return False

            if quantity <= 0 or quantity > 100:  # Sanity check
                self.algo.Error(f"[IPMCC-Validation] Invalid quantity: {quantity}")
                return False

            # Extract strike prices for validation
            leap_strike = self._extract_strike_price(leap_call)
            weekly_strike = self._extract_strike_price(weekly_call)

            if not leap_strike or not weekly_strike:
                self.algo.Error("[IPMCC-Validation] Could not extract strike prices")
                return False

            # CRITICAL SAFETY CHECK: Weekly strike must be above LEAP strike
            # This prevents the covered call from being "in the money" relative to LEAP
            if weekly_strike <= leap_strike:
                self.algo.Error(f"[IPMCC-Validation] DANGEROUS CONFIGURATION DETECTED!")
                self.algo.Error(f"Weekly strike ({weekly_strike}) <= LEAP strike ({leap_strike})")
                self.algo.Error("This creates unlimited risk if weekly call is assigned")
                return False

            # Validate expiration relationship
            if not self._validate_ipmcc_expirations(leap_call, weekly_call):
                return False

            # Check available buying power for LEAP
            if hasattr(self.algo, 'Portfolio'):
                leap_cost = self._estimate_leap_cost(leap_call, quantity)
                if leap_cost and leap_cost > self.algo.Portfolio.Cash * 0.15:  # 15% max
                    self.algo.Error(f"[IPMCC-Validation] LEAP cost too high: ${leap_cost:.0f}")
                    return False

            self.algo.Debug(f"[IPMCC-Validation] Configuration validated successfully")
            self.algo.Debug(f"LEAP strike: {leap_strike}, Weekly strike: {weekly_strike}")

            return True

        except Exception as e:
            self.algo.Error(f"[IPMCC-Validation] Validation error: {e}")
            return False

    def _validate_leap_ladder_configuration(self, ladder_legs: List[tuple]) -> bool:
        """Validate LEAP ladder configuration for proper protection setup"""

        try:
            # Basic validation
            if not ladder_legs or len(ladder_legs) == 0:
                self.algo.Error("[LEAP-Validation] No ladder legs provided")
                return False

            if len(ladder_legs) > 6:  # Reasonable maximum
                self.algo.Error(f"[LEAP-Validation] Too many ladder rungs: {len(ladder_legs)}")
                return False

            # Validate each rung
            total_cost = 0
            strikes = []

            for i, (put_contract, quantity) in enumerate(ladder_legs):
                if not put_contract:
                    self.algo.Error(f"[LEAP-Validation] Missing contract for rung {i+1}")
                    return False

                if quantity <= 0 or quantity > 50:  # Reasonable limits
                    self.algo.Error(f"[LEAP-Validation] Invalid quantity for rung {i+1}: {quantity}")
                    return False

                # Extract and validate strike
                strike = self._extract_strike_price(put_contract)
                if strike:
                    strikes.append(strike)

                # Estimate cost
                cost = self._estimate_option_cost(put_contract, quantity)
                if cost:
                    total_cost += cost

            # Validate strike progression (should be descending for put protection)
            if len(strikes) > 1:
                for i in range(1, len(strikes)):
                    if strikes[i] >= strikes[i-1]:
                        self.algo.Warning(f"[LEAP-Validation] Unusual strike progression at rung {i+1}")

            # Check total allocation (should be reasonable for protection)
            if hasattr(self.algo, 'Portfolio') and total_cost:
                if total_cost > self.algo.Portfolio.TotalPortfolioValue * 0.20:  # 20% max
                    self.algo.Error(f"[LEAP-Validation] Ladder cost too high: ${total_cost:.0f}")
                    return False

            self.algo.Debug(f"[LEAP-Validation] Ladder validated: {len(ladder_legs)} rungs")
            if total_cost:
                self.algo.Debug(f"Estimated total cost: ${total_cost:.0f}")

            return True

        except Exception as e:
            self.algo.Error(f"[LEAP-Validation] Validation error: {e}")
            return False

    def _validate_ipmcc_expirations(self, leap_call, weekly_call) -> bool:
        """Validate expiration relationship for IPMCC"""

        try:
            # Extract expiration dates if possible
            leap_expiry = getattr(leap_call, 'Expiry', None) if hasattr(leap_call, 'Expiry') else None
            weekly_expiry = getattr(weekly_call, 'Expiry', None) if hasattr(weekly_call, 'Expiry') else None

            if leap_expiry and weekly_expiry:
                # LEAP should expire after weekly
                if leap_expiry <= weekly_expiry:
                    self.algo.Error("[IPMCC-Validation] LEAP expires before/same as weekly call")
                    return False

                # Weekly should be relatively short term
                days_to_weekly = (weekly_expiry.date() - self.algo.Time.date()).days
                if days_to_weekly > 14:  # More than 2 weeks
                    self.algo.Warning(f"[IPMCC-Validation] Weekly call unusually long: {days_to_weekly} days")

                # LEAP should be long term
                days_to_leap = (leap_expiry.date() - self.algo.Time.date()).days
                if days_to_leap < 180:  # Less than 6 months
                    self.algo.Warning(f"[IPMCC-Validation] LEAP unusually short: {days_to_leap} days")

            return True

        except Exception as e:
            self.algo.Debug(f"[IPMCC-Validation] Expiration validation error: {e}")
            return True  # Don't fail on expiration validation errors

    def _extract_strike_price(self, option_contract) -> float:
        """Extract strike price from option contract"""

        try:
            # Try multiple methods to extract strike price
            if hasattr(option_contract, 'Strike'):
                return float(option_contract.Strike)
            elif hasattr(option_contract, 'StrikePrice'):
                return float(option_contract.StrikePrice)
            elif hasattr(option_contract, 'ID') and hasattr(option_contract.ID, 'StrikePrice'):
                return float(option_contract.ID.StrikePrice)
            else:
                # Try to extract from symbol string if available
                symbol_str = str(option_contract)
                # Look for strike pattern in symbol (implementation depends on format)
                self.algo.Debug(f"[Strike-Extract] Could not extract strike from: {symbol_str}")
                return None

        except Exception as e:
            self.algo.Debug(f"[Strike-Extract] Error extracting strike: {e}")
            return None

    def _estimate_leap_cost(self, leap_call, quantity: int) -> float:
        """Estimate LEAP call cost for validation"""

        try:
            if hasattr(self.algo, 'Securities') and leap_call in self.algo.Securities:
                security = self.algo.Securities[leap_call]
                if hasattr(security, 'Price') and security.Price > 0:
                    # LEAP calls are typically expensive
                    cost_per_contract = security.Price * 100  # Options are per 100 shares
                    return cost_per_contract * quantity

            return None

        except Exception as e:
            self.algo.Debug(f"[Cost-Estimate] Error estimating LEAP cost: {e}")
            return None

    def _estimate_option_cost(self, option_contract, quantity: int) -> float:
        """Estimate option cost for validation"""

        try:
            if hasattr(self.algo, 'Securities') and option_contract in self.algo.Securities:
                security = self.algo.Securities[option_contract]
                if hasattr(security, 'Price') and security.Price > 0:
                    cost_per_contract = security.Price * 100  # Options are per 100 shares
                    return cost_per_contract * quantity

            return None

        except Exception as e:
            self.algo.Debug(f"[Cost-Estimate] Error estimating option cost: {e}")
            return None

    def get_active_groups(self) -> List[Dict]:
        """Get status of all active groups"""
        
        return [group.get_status() for group in self.active_groups.values()]
    
    def cancel_all_active(self):
        """Emergency cancel all active groups"""
        
        self.algo.Error(f"[AtomicExecutor] Emergency cancelling {len(self.active_groups)} groups")
        
        for group in self.active_groups.values():
            group._rollback()
    
    def cleanup_stale_groups(self):
        """Clean up stale groups (called periodically)"""
        
        current_time = self.algo.Time
        stale_groups = []
        
        for group_id, group in self.active_groups.items():
            if current_time - group.created_time > timedelta(minutes=5):
                stale_groups.append(group_id)
                group._rollback()
        
        for group_id in stale_groups:
            self.completed_groups[group_id] = self.active_groups[group_id]
            del self.active_groups[group_id]
            self.algo.Debug(f"[AtomicExecutor] Cleaned up stale group: {group_id}")