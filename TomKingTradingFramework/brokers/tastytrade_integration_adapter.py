# region imports
from AlgorithmImports import *
from typing import Dict, List, Optional, Protocol
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
from brokers.tastytrade_api_client import TastytradeApiClient
from datetime import timedelta
import threading
import queue
from concurrent.futures import ThreadPoolExecutor
# endregion

class ILiveOrderExecutor(Protocol):
    """Protocol for live order execution backends"""
    
    def place_live_order(self, symbol, quantity: int) -> Optional[object]:
        """Place single order via live execution backend"""
        ...
    
    def cancel_live_order(self, order_id: str) -> bool:
        """Cancel order via live execution backend"""
        ...
    
    def get_live_order_status(self, order_id: str) -> Dict:
        """Get order status from live execution backend"""
        ...


class TastyTradeOrderTicket:
    """Reusable order ticket implementation for TastyTrade integration"""
    
    def __init__(self, symbol, quantity: int, response: Dict, integration_adapter):
        self.Symbol = symbol
        self.Quantity = quantity
        self.OrderId = response.get('id', f'tt-{self._generate_order_id()}')
        self.Tag = 'TastyTrade-Live'
        self.Status = OrderStatus.Submitted
        self._tastytrade_response = response
        self._integration_adapter = integration_adapter
        self._last_status_check = None
        self._fill_quantity = 0
        self._average_fill_price = 0.0
        
        # Use integration adapter's order monitoring system
        self._integration_adapter._register_order_for_monitoring(self)
    
    def _generate_order_id(self):
        """Generate unique order ID for TastyTrade orders"""
        import uuid
        return str(uuid.uuid4())[:8]
    
    def update_from_tastytrade_status(self, status_info: Dict):
        """Update order state from TastyTrade status response"""
        
        tt_status = status_info.get('status', '').lower()
        
        # Map TastyTrade status to QuantConnect status
        status_mapping = {
            'received': OrderStatus.Submitted,
            'routed': OrderStatus.Submitted, 
            'filled': OrderStatus.Filled,
            'cancelled': OrderStatus.Canceled,
            'rejected': OrderStatus.Invalid,
            'expired': OrderStatus.Canceled
        }
        
        new_status = status_mapping.get(tt_status, self.Status)
        
        if new_status != self.Status:
            self.Status = new_status
            self._integration_adapter.algo.Debug(f"[OrderTicket] {self.OrderId} status: {new_status}")
        
        # Update fill information
        self._fill_quantity = status_info.get('filled_quantity', 0)
        self._average_fill_price = status_info.get('avg_fill_price', 0.0)
    
    def Cancel(self):
        """Cancel the order through TastyTrade API"""
        try:
            success = self._integration_adapter.tastytrade_client.cancel_order(self.OrderId)
            if success:
                self.Status = OrderStatus.CancelPending
                return True
            return False
        except Exception as e:
            self._integration_adapter.algo.Error(f"[OrderTicket] Cancel failed: {e}")
            return False
    
    @property
    def QuantityFilled(self):
        """Quantity filled so far"""
        return self._fill_quantity
    
    @property
    def AverageFillPrice(self):
        """Average fill price"""
        return self._average_fill_price
    
    @property
    def QuantityRemaining(self):
        """Remaining quantity to fill"""
        return abs(self.Quantity) - abs(self._fill_quantity)


class TastytradeIntegrationAdapter:
    """
    PRODUCTION-SAFE TastyTrade Integration Adapter
    
    FIXES FOR CRITICAL ARCHITECTURE GAPS:
    1. ✅ Eliminated dangerous monkey-patching - uses composition pattern
    2. ✅ Fixed memory leaks - reusable order ticket class outside methods
    3. ✅ Added robust order monitoring with thread safety
    4. ✅ Comprehensive edge case handling with circuit breakers
    5. ✅ Clean shutdown with proper resource cleanup
    
    Architecture:
    QuantConnect (Backtest) ──┐
    TastyTrade API (Live)     ├── SAFE DELEGATION EXECUTOR ──> Orders
    Existing Order System ────┘
    """
    
    def __init__(self, algorithm, atomic_executor: EnhancedAtomicOrderExecutor, 
                 tastytrade_client: TastytradeApiClient):
        self.algo = algorithm
        self.atomic_executor = atomic_executor
        self.tastytrade_client = tastytrade_client
        
        # Integration state
        self.is_live = algorithm.LiveMode if hasattr(algorithm, 'LiveMode') else False
        self.integration_active = False
        
        # Order monitoring system (thread-safe)
        self._active_orders = {}
        self._order_monitoring_lock = threading.Lock()
        self._monitoring_thread = None
        self._monitoring_stop_event = threading.Event()
        
        # Circuit breakers for edge cases
        self._error_count = 0
        self._max_errors = 10
        self._last_error_reset = None
        self._rate_limit_backoff = 0
        
        self._setup_integration()
    
    def _setup_integration(self):
        """Set up the integration between systems using safe delegation pattern"""
        
        try:
            # Only integrate in live mode
            if not self.is_live:
                self.algo.Log("[TT-Integration] Backtest mode - using QuantConnect execution only")
                return
            
            # Verify TastyTrade client is authenticated
            if not self.tastytrade_client.ensure_authenticated():
                self.algo.Error("[TT-Integration] TastyTrade authentication failed - falling back to QC")
                return
            
            # Start order monitoring thread
            self._start_order_monitoring()
            
            # Set up atomic executor delegation (NO MONKEY PATCHING)
            self._setup_safe_delegation()
            
            self.integration_active = True
            self.algo.Log("[TT-Integration] Successfully integrated TastyTrade with safe delegation")
            
        except Exception as e:
            self.algo.Error(f"[TT-Integration] Integration setup failed: {str(e)}")
            self.integration_active = False
    
    def _setup_safe_delegation(self):
        """Set up safe delegation to TastyTrade without monkey-patching"""
        
        # SAFE PATTERN: Composition over monkey-patching
        # The atomic executor will delegate to this adapter when needed
        
        # Register ourselves as the live order executor for the atomic executor
        if hasattr(self.atomic_executor, 'set_live_executor'):
            self.atomic_executor.set_live_executor(self)
            self.algo.Log("[TT-Integration] Registered as live executor with atomic executor")
        else:
            self.algo.Log("[TT-Integration] Atomic executor doesn't support live delegation - using strategy-level integration")
    
    def _start_order_monitoring(self):
        """Start thread-safe order monitoring system"""
        if not self._monitoring_thread or not self._monitoring_thread.is_alive():
            self._monitoring_thread = threading.Thread(
                target=self._order_monitoring_loop,
                name="TT-OrderMonitoring",
                daemon=True
            )
            self._monitoring_thread.start()
            self.algo.Log("[TT-Integration] Order monitoring thread started")
    
    def _order_monitoring_loop(self):
        """Main order monitoring loop (runs in separate thread)"""
        while not self._monitoring_stop_event.is_set():
            try:
                self._update_all_orders()
                self._monitoring_stop_event.wait(5.0)  # Check every 5 seconds
            except Exception as e:
                self.algo.Error(f"[TT-Integration] Order monitoring error: {e}")
                self._monitoring_stop_event.wait(10.0)  # Back off on errors
    
    def _register_order_for_monitoring(self, order_ticket: TastyTradeOrderTicket):
        """Thread-safe order registration for monitoring"""
        with self._order_monitoring_lock:
            self._active_orders[order_ticket.OrderId] = order_ticket
    
    def _update_all_orders(self):
        """Update status for all active orders (with circuit breaker)"""
        if self._rate_limit_backoff > 0:
            self._rate_limit_backoff -= 1
            return  # Skip this cycle due to rate limiting
        
        with self._order_monitoring_lock:
            active_order_ids = list(self._active_orders.keys())
        
        for order_id in active_order_ids:
            try:
                if order_id in self._active_orders:
                    self._update_single_order(order_id)
            except Exception as e:
                self._handle_monitoring_error(e)
    
    def _update_single_order(self, order_id: str):
        """Update single order status with error handling"""
        with self._order_monitoring_lock:
            order_ticket = self._active_orders.get(order_id)
            if not order_ticket:
                return
            
            # Skip if order is already final
            if order_ticket.Status in [OrderStatus.Filled, OrderStatus.Canceled, OrderStatus.Invalid]:
                del self._active_orders[order_id]  # Remove from monitoring
                return
        
        try:
            # Get status from TastyTrade API
            status_info = self.tastytrade_client.get_order_status(order_id)
            
            if status_info:
                order_ticket.update_from_tastytrade_status(status_info)
                
                # Remove from monitoring if final state reached
                if order_ticket.Status in [OrderStatus.Filled, OrderStatus.Canceled, OrderStatus.Invalid]:
                    with self._order_monitoring_lock:
                        if order_id in self._active_orders:
                            del self._active_orders[order_id]
                            
        except Exception as e:
            self._handle_monitoring_error(e)
    
    def _handle_monitoring_error(self, error: Exception):
        """Handle errors in order monitoring with circuit breaker"""
        self._error_count += 1
        
        if "rate limit" in str(error).lower():
            self._rate_limit_backoff = 12  # Skip next 12 cycles (60 seconds)
            self.algo.Log("[TT-Integration] Rate limit detected - backing off order monitoring")
            return
        
        if self._error_count >= self._max_errors:
            self.algo.Error(f"[TT-Integration] Too many monitoring errors ({self._error_count}) - stopping monitoring")
            self._monitoring_stop_event.set()
        else:
            self.algo.Debug(f"[TT-Integration] Order monitoring error {self._error_count}/{self._max_errors}: {error}")
    
    # Implementation of ILiveOrderExecutor protocol
    def place_live_order(self, symbol, quantity: int) -> Optional[TastyTradeOrderTicket]:
        """Protocol method for live order execution"""
        return self._place_tastytrade_order(symbol, quantity)
    
    def cancel_live_order(self, order_id: str) -> bool:
        """Protocol method for order cancellation"""
        with self._order_monitoring_lock:
            order_ticket = self._active_orders.get(order_id)
            if order_ticket:
                return order_ticket.Cancel()
        return False
    
    def get_live_order_status(self, order_id: str) -> Dict:
        """Protocol method for order status lookup"""
        return self.tastytrade_client.get_order_status(order_id) or {}
    
    def _place_tastytrade_order(self, symbol, quantity: int):
        """Place single order via TastyTrade API"""
        
        try:
            # Convert QuantConnect symbol to TastyTrade format if needed
            tt_symbol = self._convert_qc_symbol_to_tastytrade(symbol)
            if not tt_symbol:
                self.algo.Error(f"[TT-Integration] Failed to convert symbol: {symbol}")
                return None
            
            # Build single-leg TastyTrade order payload
            legs = [{
                'symbol': tt_symbol,
                'quantity': abs(quantity),
                'action': 'Buy to Open' if quantity > 0 else 'Sell to Open'
            }]
            
            # Use limit orders for better execution (with smart pricing)
            limit_price = self._calculate_smart_limit_price(symbol, quantity > 0)
            
            order_payload = self.tastytrade_client.build_tastytrade_order_payload(
                legs=legs,
                order_type='Limit' if limit_price else 'Market',
                limit_price=limit_price,
                price_effect='Debit' if quantity > 0 else 'Credit'
            )
            
            if not order_payload:
                self.algo.Error(f"[TT-Integration] Failed to build order payload for {symbol}")
                return None
            
            # Submit to TastyTrade
            result = self.tastytrade_client.submit_order_to_tastytrade(order_payload)
            
            if result:
                # Create complete order ticket for atomic executor compatibility
                ticket = self._create_tastytrade_order_ticket(symbol, quantity, result)
                self.algo.Debug(f"[TT-Integration] Order placed: {tt_symbol} x{quantity} (ID: {ticket.OrderId})")
                return ticket
            else:
                self.algo.Error(f"[TT-Integration] TastyTrade order submission failed for {symbol}")
                return None
            
        except Exception as e:
            self.algo.Error(f"[TT-Integration] TastyTrade order error: {str(e)}")
            return None
    
    def _create_tastytrade_order_ticket(self, symbol, quantity: int, tastytrade_response: Dict):
        """Create TastyTrade order ticket using the reusable class"""
        return TastyTradeOrderTicket(symbol, quantity, tastytrade_response, self)
    
    def execute_iron_condor_live(self, short_call, long_call, short_put, long_put, 
                                quantity: int = 1, limit_price: float = None) -> bool:
        """
        Execute iron condor using existing atomic executor with TastyTrade integration
        
        CRITICAL FIX: This method now ALWAYS uses the atomic executor for safety.
        The atomic executor will automatically route to TastyTrade in live mode.
        
        This ensures:
        1. All safety features preserved (rollback, validation, etc.)
        2. Atomic execution guarantees maintained  
        3. TastyTrade used as execution backend only
        4. Consistent behavior across environments
        """
        
        # ALWAYS use atomic executor - no bypassing!
        # The integration happens at the _place_smart_order level
        return self.atomic_executor.execute_iron_condor_atomic(
            short_call, long_call, short_put, long_put, quantity
        )
    
    def execute_lt112_live(self, long_put, short_put, naked_puts, quantity: int = 1) -> bool:
        """
        Execute LT112 (1-1-2 Put Ratio) using atomic executor with TastyTrade integration
        
        LT112 Structure: Long 1 put + Short 1 put (debit spread) + Short 2 naked puts
        This creates a 1:1:2 put ratio spread for income generation
        """
        
        # Use atomic executor for safe multi-leg execution
        # Will route to TastyTrade in live mode automatically
        return self.atomic_executor.execute_lt112_atomic(
            long_put, short_put, naked_puts, quantity
        )
    
    def execute_ipmcc_live(self, leap_call, weekly_call, quantity: int = 1) -> bool:
        """
        Execute IPMCC (Income Poor Man's Covered Call) using atomic executor
        
        IPMCC Structure: Long LEAP call (365+ DTE) + Short weekly call (7 DTE)
        This creates a diagonal call spread for income generation
        """
        
        # Use atomic executor for safe two-leg execution
        return self.atomic_executor.execute_ipmcc_atomic(
            leap_call, weekly_call, quantity
        )
    
    def execute_leap_ladder_live(self, put_strikes: List, expiry_date, quantity: int = 1) -> bool:
        """
        Execute LEAP Put Ladder using atomic executor
        
        LEAP Ladder Structure: Multiple long puts at different strikes (365+ DTE)
        Creates portfolio protection ladder at 5%, 10%, 15%, 20% OTM levels
        """
        
        # Convert TastyTrade parameters to atomic executor format
        # Atomic executor expects: List[tuple] of (contract, quantity) pairs
        
        try:
            # Convert strikes to contract tuples for atomic execution
            ladder_legs = []
            for strike in put_strikes:
                # Use the algorithm's option chain to get the actual contract
                put_contract = self.algo.OptionChainProvider.GetOptionContracts(
                    self.algo.Symbol("SPY"), expiry_date
                ).Where(lambda x: x.ID.OptionRight == OptionRight.Put and 
                                  x.ID.StrikePrice == strike).FirstOrDefault()
                
                if put_contract:
                    ladder_legs.append((put_contract, quantity))
                else:
                    self.algo.Error(f"[TT-Integration] Could not resolve LEAP put contract for strike {strike}")
                    return False
            
            if ladder_legs:
                return self.atomic_executor.execute_leap_ladder_atomic(
                    ladder_legs, "LEAP_Ladder_TT"
                )
            else:
                self.algo.Error("[TT-Integration] No valid LEAP contracts found for ladder")
                return False
                
        except Exception as e:
            self.algo.Error(f"[TT-Integration] LEAP ladder execution failed: {e}")
            return False
    
    def execute_strangle_live(self, call_strike, put_strike, expiry_date, 
                             underlying_symbol, quantity: int = 1) -> bool:
        """
        Execute Futures Strangle using atomic executor
        
        Strangle Structure: Short call OTM + Short put OTM
        Used on futures contracts (/ES, /CL, /GC, etc.) for income generation
        """
        
        # Convert TastyTrade parameters to QuantConnect contract objects
        # Atomic executor expects: (call_contract, put_contract, quantity)
        
        try:
            # Get the underlying symbol for option chain lookup
            underlying = self.algo.Symbol(underlying_symbol) if isinstance(underlying_symbol, str) else underlying_symbol
            
            # Get option contracts for the expiry date
            option_contracts = self.algo.OptionChainProvider.GetOptionContracts(
                underlying, expiry_date
            )
            
            # Find call contract
            call_contract = option_contracts.Where(
                lambda x: x.ID.OptionRight == OptionRight.Call and 
                         x.ID.StrikePrice == call_strike
            ).FirstOrDefault()
            
            # Find put contract  
            put_contract = option_contracts.Where(
                lambda x: x.ID.OptionRight == OptionRight.Put and 
                         x.ID.StrikePrice == put_strike
            ).FirstOrDefault()
            
            if call_contract and put_contract:
                return self.atomic_executor.execute_strangle_atomic(
                    call_contract, put_contract, quantity
                )
            else:
                missing = []
                if not call_contract: missing.append(f"call@{call_strike}")
                if not put_contract: missing.append(f"put@{put_strike}")
                self.algo.Error(f"[TT-Integration] Could not resolve strangle contracts: {', '.join(missing)}")
                return False
                
        except Exception as e:
            self.algo.Error(f"[TT-Integration] Strangle execution failed: {e}")
            return False
    
    def _convert_symbols_to_tastytrade(self, qc_legs: List) -> List[Dict]:
        """Convert QuantConnect symbols to TastyTrade format"""
        
        tt_legs = []
        
        for symbol, quantity, action in qc_legs:
            try:
                # For options, extract details and build TastyTrade symbol
                if hasattr(symbol, 'SecurityType') and symbol.SecurityType == SecurityType.Option:
                    underlying = str(symbol.Underlying)
                    strike = float(symbol.ID.StrikePrice)
                    expiry = symbol.ID.Date
                    option_type = 'C' if symbol.ID.OptionRight == OptionRight.Call else 'P'
                    
                    # Build TastyTrade expiration format (YYMMDD)
                    exp_str = expiry.strftime('%y%m%d')
                    
                    # Use TastyTrade symbol builder
                    tt_symbol = self.tastytrade_client.build_tastytrade_option_symbol(
                        underlying, exp_str, option_type, strike
                    )
                    
                    if tt_symbol:
                        tt_legs.append({
                            'symbol': tt_symbol,
                            'quantity': abs(quantity),
                            'action': action
                        })
                else:
                    # For equities, use symbol as-is
                    tt_legs.append({
                        'symbol': str(symbol),
                        'quantity': abs(quantity),
                        'action': action
                    })
                    
            except Exception as e:
                self.algo.Error(f"[TT-Integration] Symbol conversion error: {str(e)}")
        
        return tt_legs
    
    def get_integration_status(self) -> Dict:
        """Get current integration status"""
        
        return {
            'integration_active': self.integration_active,
            'is_live': self.is_live,
            'tastytrade_authenticated': self.tastytrade_client.is_session_valid() if self.tastytrade_client else False,
            'atomic_executor_available': self.atomic_executor is not None
        }
    
    def shutdown(self):
        """Clean shutdown of integration with comprehensive cleanup"""
        
        if self.integration_active:
            # Stop order monitoring thread
            self._monitoring_stop_event.set()
            if self._monitoring_thread and self._monitoring_thread.is_alive():
                self._monitoring_thread.join(timeout=5.0)
                if self._monitoring_thread.is_alive():
                    self.algo.Log("[TT-Integration] Warning: Monitoring thread did not stop cleanly")
            
            # Cancel all active orders
            with self._order_monitoring_lock:
                for order_id, order_ticket in list(self._active_orders.items()):
                    try:
                        if order_ticket.Status not in [OrderStatus.Filled, OrderStatus.Canceled]:
                            order_ticket.Cancel()
                    except Exception as e:
                        self.algo.Log(f"[TT-Integration] Error canceling order {order_id} during shutdown: {e}")
                
                self._active_orders.clear()
            
            # Unregister from atomic executor if registered
            if hasattr(self.atomic_executor, 'clear_live_executor'):
                self.atomic_executor.clear_live_executor()
            
            self.integration_active = False
            self.algo.Log("[TT-Integration] Integration shut down successfully with full cleanup")
    
    def _convert_qc_symbol_to_tastytrade(self, symbol) -> str:
        """Convert QuantConnect symbol to TastyTrade format"""
        
        try:
            # For options, extract details and build TastyTrade symbol
            if hasattr(symbol, 'SecurityType') and symbol.SecurityType == SecurityType.Option:
                underlying = str(symbol.Underlying)
                strike = float(symbol.ID.StrikePrice)
                expiry = symbol.ID.Date
                option_type = 'C' if symbol.ID.OptionRight == OptionRight.Call else 'P'
                
                # Build TastyTrade expiration format (YYMMDD)
                exp_str = expiry.strftime('%y%m%d')
                
                # Use TastyTrade symbol builder
                return self.tastytrade_client.build_tastytrade_option_symbol(
                    underlying, exp_str, option_type, strike
                )
            else:
                # For equities, use symbol as-is
                return str(symbol)
                
        except Exception as e:
            self.algo.Error(f"[TT-Integration] Symbol conversion error: {str(e)}")
            return None
    
    def _calculate_smart_limit_price(self, symbol, is_buy: bool) -> float:
        """Calculate smart limit price for better execution"""
        
        try:
            # Get current market data
            security = self.algo.Securities.get(symbol)
            if not security:
                return None
            
            bid = security.BidPrice
            ask = security.AskPrice
            
            if bid <= 0 or ask <= 0:
                return None
            
            # Use 40% rule for options, 10% for equities
            if hasattr(symbol, 'SecurityType') and symbol.SecurityType == SecurityType.Option:
                cross_percentage = 0.40
            else:
                cross_percentage = 0.10
            
            if is_buy:
                # Buy: bid + (ask - bid) * cross_percentage
                limit_price = bid + (ask - bid) * cross_percentage
            else:
                # Sell: ask - (ask - bid) * cross_percentage  
                limit_price = ask - (ask - bid) * cross_percentage
            
            return round(limit_price, 2)
            
        except Exception as e:
            self.algo.Error(f"[TT-Integration] Smart pricing error: {str(e)}")
            return None