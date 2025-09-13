# region imports
from AlgorithmImports import *
from typing import Dict, List, Optional
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
from brokers.tastytrade_api_client import TastytradeApiClient
from datetime import timedelta
# endregion

class TastytradeIntegrationAdapter:
    """
    Integration adapter that connects TastyTrade API with existing AtomicOrderExecutor
    
    This eliminates redundancy by:
    1. Using existing atomic execution architecture 
    2. Adding TastyTrade as a live execution backend
    3. Maintaining all existing safety features (rollback, validation, etc.)
    
    Architecture:
    QuantConnect (Backtest) ──┐
    TastyTrade API (Live)     ├── UNIFIED ATOMIC EXECUTOR ──> Orders
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
        
        self._setup_integration()
    
    def _setup_integration(self):
        """Set up the integration between systems"""
        
        try:
            # Only integrate in live mode
            if not self.is_live:
                self.algo.Log("[TT-Integration] Backtest mode - using QuantConnect execution only")
                return
            
            # Verify TastyTrade client is authenticated
            if not self.tastytrade_client.ensure_authenticated():
                self.algo.Error("[TT-Integration] TastyTrade authentication failed - falling back to QC")
                return
            
            # Extend atomic executor with TastyTrade capabilities
            self._extend_atomic_executor()
            
            self.integration_active = True
            self.algo.Log("[TT-Integration] Successfully integrated TastyTrade with atomic executor")
            
        except Exception as e:
            self.algo.Error(f"[TT-Integration] Integration setup failed: {str(e)}")
            self.integration_active = False
    
    def _extend_atomic_executor(self):
        """Extend the atomic executor with TastyTrade live execution"""
        
        # Store original method from AtomicOrderGroup class
        original_place_order = None
        
        # Check if AtomicOrderGroup exists and has _place_smart_order method
        from helpers.atomic_order_executor import AtomicOrderGroup
        if hasattr(AtomicOrderGroup, '_place_smart_order'):
            original_place_order = AtomicOrderGroup._place_smart_order
        else:
            self.algo.Error("[TT-Integration] Could not find AtomicOrderGroup._place_smart_order method")
            return
        
        # Create closure that captures the integration adapter instance
        integration_adapter = self
        
        def enhanced_place_order(group_instance, symbol, quantity):
            """Enhanced order placement that uses TastyTrade in live mode"""
            
            # Use TastyTrade for live trading
            if integration_adapter.is_live and integration_adapter.integration_active:
                try:
                    return integration_adapter._place_tastytrade_order(symbol, quantity)
                except Exception as e:
                    integration_adapter.algo.Error(f"[TT-Integration] TastyTrade order failed: {e}")
                    # Fall back to original method
            
            # Use original QuantConnect method
            return original_place_order(group_instance, symbol, quantity)
        
        # Monkey patch the AtomicOrderGroup class method (safe integration)
        AtomicOrderGroup._place_smart_order_original = original_place_order
        AtomicOrderGroup._place_smart_order = enhanced_place_order
    
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
        """Create complete TastyTrade order ticket compatible with AtomicOrderExecutor"""
        
        # Create reference to OrderStatus for nested class
        OrderStatusRef = OrderStatus
        
        class TastyTradeOrderTicket:
            """Complete order ticket implementation for TastyTrade integration"""
            
            def __init__(self, symbol, quantity, response, integration_adapter):
                self.Symbol = symbol
                self.Quantity = quantity
                self.OrderId = response.get('id', f'tt-{self._generate_order_id()}')
                self.Tag = 'TastyTrade-Live'
                self.Status = OrderStatusRef.Submitted
                self._tastytrade_response = response
                self._integration_adapter = integration_adapter
                self._last_status_check = None
                self._fill_quantity = 0
                self._average_fill_price = 0.0
                
                # Start monitoring this order
                self._start_monitoring()
            
            def _generate_order_id(self):
                """Generate unique order ID for TastyTrade orders"""
                import uuid
                return str(uuid.uuid4())[:8]
            
            def _start_monitoring(self):
                """Start monitoring order status (integrated with algo scheduler)"""
                try:
                    # Schedule status updates using QuantConnect's scheduler
                    algo = self._integration_adapter.algo
                    algo.Schedule.On(
                        algo.DateRules.EveryDay(),
                        algo.TimeRules.Every(timedelta(seconds=5)),
                        self._update_status
                    )
                except Exception as e:
                    self._integration_adapter.algo.Error(f"[OrderTicket] Monitoring setup failed: {e}")
            
            def _update_status(self):
                """Update order status from TastyTrade API"""
                try:
                    # Only update if order is still active
                    if self.Status in [OrderStatusRef.Filled, OrderStatusRef.Canceled, OrderStatusRef.Invalid]:
                        return
                    
                    # Get status from TastyTrade API
                    status_info = self._integration_adapter.tastytrade_client.get_order_status(self.OrderId)
                    
                    if status_info:
                        self._update_from_tastytrade_status(status_info)
                        
                except Exception as e:
                    self._integration_adapter.algo.Debug(f"[OrderTicket] Status update error: {e}")
            
            def _update_from_tastytrade_status(self, status_info: Dict):
                """Update order state from TastyTrade status response"""
                
                tt_status = status_info.get('status', '').lower()
                
                # Map TastyTrade status to QuantConnect status
                status_mapping = {
                    'received': OrderStatusRef.Submitted,
                    'routed': OrderStatusRef.Submitted, 
                    'filled': OrderStatusRef.Filled,
                    'cancelled': OrderStatusRef.Canceled,
                    'rejected': OrderStatusRef.Invalid,
                    'expired': OrderStatusRef.Canceled
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
                        self.Status = OrderStatusRef.CancelPending
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
        
        return TastyTradeOrderTicket(symbol, quantity, tastytrade_response, self)
    
    def execute_iron_condor_live(self, short_call, long_call, short_put, long_put, 
                                quantity: int = 1, limit_price: float = None) -> bool:
        """
        Execute iron condor using existing atomic executor with TastyTrade integration
        
        CRITICAL FIX: This method now ALWAYS uses the atomic executor for safety.
        The atomic executor will automatically route to TastyTrade in live mode.
        
        This ensures:
        1. ✅ All safety features preserved (rollback, validation, etc.)
        2. ✅ Atomic execution guarantees maintained  
        3. ✅ TastyTrade used as execution backend only
        4. ✅ Consistent behavior across environments
        """
        
        # ALWAYS use atomic executor - no bypassing!
        # The integration happens at the _place_smart_order level
        return self.atomic_executor.execute_iron_condor_atomic(
            short_call, long_call, short_put, long_put, quantity
        )
    
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
        """Clean shutdown of integration"""
        
        if self.integration_active:
            # Restore original methods if modified
            from helpers.atomic_order_executor import AtomicOrderGroup
            if hasattr(AtomicOrderGroup, '_place_smart_order_original'):
                AtomicOrderGroup._place_smart_order = AtomicOrderGroup._place_smart_order_original
                delattr(AtomicOrderGroup, '_place_smart_order_original')
            
            self.integration_active = False
            self.algo.Log("[TT-Integration] Integration shut down successfully")
    
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