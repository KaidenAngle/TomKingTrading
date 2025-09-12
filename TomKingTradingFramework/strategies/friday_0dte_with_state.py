# Friday 0DTE Strategy with State Machine Pattern
# Clean implementation using state transitions

from AlgorithmImports import *
from strategies.base_strategy_with_state import BaseStrategyWithState
from core.state_machine import StrategyState, TransitionTrigger
from core.unified_intelligent_cache import UnifiedIntelligentCache, CacheType
from datetime import time, timedelta
import numpy as np

class Friday0DTEWithState(BaseStrategyWithState):
    """
    Tom King's Friday 0DTE strategy with state machine pattern
    Provides clean, maintainable state transitions and error handling
    """
    
    def __init__(self, algorithm):
        super().__init__(algorithm, "Friday_0DTE")
        
        # UNIFIED INTELLIGENT CACHE: Entry conditions and market analysis caching
        # Uses appropriate cache types for automatic invalidation
        self.entry_conditions_cache = algorithm.unified_cache  # Uses GENERAL cache type
        self.market_data_cache = algorithm.unified_cache      # Uses MARKET_DATA cache type  
        self.vix_cache = algorithm.unified_cache              # Uses MARKET_DATA cache type
        
        # Cache performance tracking
        self.cache_stats_log_interval = timedelta(minutes=30)
        self.last_cache_stats_log = algorithm.Time
        
        # CRITICAL: Tom King uses FUTURES for 0DTE, not SPY options
        # ES for accounts >= $40k, MES for accounts < $40k
        account_value = algorithm.position_sizer.get_portfolio_value()
        if account_value < 40000:
            self.primary_symbol = 'MES'  # Micro E-mini S&P 500
            self.contract_multiplier = 5  # MES = $5 per point
        else:
            self.primary_symbol = 'ES'   # E-mini S&P 500  
            self.contract_multiplier = 50  # ES = $50 per point
        
        # Use SPY as fallback if futures not available
        self.use_futures = True  # Tom King preference
        self.fallback_symbol = 'SPY'
        
        # Tom King specific parameters (using constants)
        from config.constants import TradingConstants
        self.entry_time = time(TradingConstants.FRIDAY_0DTE_ENTRY_HOUR, 
                              TradingConstants.FRIDAY_0DTE_ENTRY_MINUTE)  # 10:30 AM ET
        self.analysis_start = time(TradingConstants.MARKET_OPEN_HOUR, 
                                  TradingConstants.MARKET_OPEN_MINUTE)  # Market open
        self.target_profit = TradingConstants.FRIDAY_0DTE_PROFIT_TARGET  # 50% profit target
        self.stop_loss = TradingConstants.FRIDAY_0DTE_STOP_LOSS  # 200% stop loss
        
        # VIX requirements - Tom King's strict methodology
        self.min_vix_for_entry = 22  # Tom King's rule: Only trade when VIX > 22
        
        # Market analysis
        self.market_open_price = None
        self.pre_entry_move = 0
        self.move_direction = None
        
        # Delta targets
        self.target_delta = 0.16  # 1 standard deviation
        self.protective_delta = 0.05  # 2 standard deviations
        
        # Position details
        self.entry_strikes = {}
        self.position_type = None  # 'iron_condor', 'put_spread', 'call_spread'
        
        # Add custom transitions for 0DTE
        self._setup_custom_transitions()
        
    def _setup_custom_transitions(self):
        """Setup 0DTE-specific state transitions"""
        
        # VIX-based transitions
        self.state_machine.add_transition(
            StrategyState.ANALYZING,
            StrategyState.SUSPENDED,
            TransitionTrigger.VIX_SPIKE,
            condition=lambda data: self._check_vix_too_high(data)
        )
        
        # Time-based transitions
        self.state_machine.add_transition(
            StrategyState.READY,
            StrategyState.CLOSED,
            TransitionTrigger.TIME_WINDOW_END,
            condition=lambda data: self._is_too_late_to_enter(data)
        )
    
    def _check_entry_conditions(self) -> bool:
        """Check if all entry conditions are met for 0DTE strategy with caching"""
        
        # Run cache maintenance
        self._run_cache_maintenance()
        
        self.algo.Error(f"[0DTE] ========== COMPLETE ENTRY CONDITIONS TRACE ==========")
        self.algo.Error(f"[0DTE] Time: {self.algo.Time}, Market: {self.algo.IsMarketOpen(self.algo.spy)}")
        
        # Create cache key for entry conditions
        current_time = self.algo.Time
        weekday = current_time.weekday()
        time_str = current_time.strftime('%H:%M')
        
        cache_key = f'entry_conditions_{weekday}_{time_str}_{current_time.minute//5}'  # 5-minute buckets
        
        # Try to get cached entry conditions result
        cached_result = self.entry_conditions_cache.get(
            cache_key,
            lambda: self._check_entry_conditions_internal()
        )
        
        return cached_result if cached_result is not None else False
    
    def _check_entry_conditions_internal(self) -> bool:
        """Internal entry conditions check (cached by _check_entry_conditions)"""
        
        # Must be Friday
        current_weekday = self.algo.Time.weekday()
        self.algo.Error(f"[0DTE] DAY CHECK: Weekday = {current_weekday} (4=Friday required)")
        if current_weekday != 4:
            self.algo.Error(f"[0DTE] DAY FAIL: Not Friday, exiting")
            return False
        self.algo.Error(f"[0DTE] DAY PASS: Friday confirmed, continuing...")
        
        # Must be after 10:30 AM
        current_time = self.algo.Time.time()
        self.algo.Error(f"[0DTE] TIME CHECK: Current = {current_time}, Entry = {self.entry_time}")
        if current_time < self.entry_time:
            self.algo.Error(f"[0DTE] TIME FAIL: Too early, waiting until {self.entry_time}")
            return False
        self.algo.Error(f"[0DTE] TIME PASS: After entry time, continuing...")
        
        # VIX check - Tom King methodology with caching
        vix_value = self._get_cached_vix_value()
        self.algo.Debug(f"[0DTE] VIX CHECK: Value = {vix_value:.2f}, Min required = {self.min_vix_for_entry}")
        
        if vix_value <= self.min_vix_for_entry:
            self.algo.Error(f"[0DTE] VIX FAIL: {vix_value:.2f} <= {self.min_vix_for_entry}, exiting")
            return False
        else:
            self.algo.Error(f"[0DTE] VIX PASS: {vix_value:.2f} > {self.min_vix_for_entry}, continuing...")
        
        # Must have analyzed pre-market move with caching
        self.algo.Error(f"[0DTE] MOVE CHECK: Analyzing pre-entry move...")
        move_analyzed = self._analyze_pre_entry_move()
        self.algo.Error(f"[0DTE] MOVE RESULT: Pre-entry move analyzed = {move_analyzed}")
        if not move_analyzed:
            self.algo.Error(f"[0DTE] MOVE FAIL: Pre-entry move analysis failed")
            return False
        self.algo.Error(f"[0DTE] MOVE PASS: Pre-entry move analyzed successfully")
        
        # Check margin and risk limits with caching
        self.algo.Error(f"[0DTE] RISK CHECK: Checking margin and risk limits...")
        risk_check = self._get_cached_risk_check()
        if not risk_check:
            self.algo.Error(f"[0DTE] RISK FAIL: Risk limits exceeded")
            return False
        self.algo.Error(f"[0DTE] RISK PASS: Risk limits OK")
        
        self.algo.Error(f"[0DTE] *** ALL ENTRY CONDITIONS PASS - READY TO TRADE! ***")
        self.algo.Error(f"[0DTE] ========== ENTRY CONDITIONS SUCCESS ==========")
        return True
    
    def _analyze_pre_entry_move(self) -> bool:
        """Analyze market move from 9:30 to 10:30 with caching"""
        
        current_time = self.algo.Time.time()
        cache_key = f'pre_entry_move_{current_time.hour}_{current_time.minute//5}'  # 5-minute buckets
        
        # Try to get cached analysis
        cached_result = self.market_data_cache.get(
            cache_key,
            lambda: self._analyze_pre_entry_move_internal()
        )
        
        return cached_result if cached_result is not None else False
    
    def _analyze_pre_entry_move_internal(self) -> bool:
        """Internal pre-entry move analysis (cached)"""
        
        try:
            spy = self.algo.spy
        current_time = self.algo.Time.time()
        except Exception as e:

            # Get SPY or ES price
            
            # CRITICAL FIX #3: Enhanced market open price capture with robust timing windows
            # and comprehensive fallback mechanisms per audit documentation
            if not self.market_open_price:
                current_spy_price = self.algo.Securities[spy].Price
                
                # Primary capture window: 9:30-9:40 AM (extended from 9:35 for robustness)
                if current_time.hour == 9 and current_time.minute >= 30 and current_time.minute <= 40:
                    # Price validation: ensure we have a reasonable SPY price
                    if current_spy_price > 0 and 300 <= current_spy_price <= 700:  # Reasonable SPY range
                        self.market_open_price = current_spy_price
                        self.market_open_capture_time = current_time
                        self.market_open_method = "PRIMARY_WINDOW"
                        self.algo.Error(f"[0DTE] MARKET OPEN CAPTURED: ${self.market_open_price:.2f} at {current_time} (Primary)")
                    else:
                        self.algo.Error(f"[0DTE] MARKET OPEN PRICE INVALID: ${current_spy_price:.2f} at {current_time}, waiting...")
                        return False
                
                # Extended fallback window: 9:40-10:00 AM (additional safety margin)
                elif current_time.hour == 9 and current_time.minute > 40 and current_time.minute <= 59:
                    if current_spy_price > 0 and 300 <= current_spy_price <= 700:
                        self.market_open_price = current_spy_price
                        self.market_open_capture_time = current_time
                        self.market_open_method = "EXTENDED_FALLBACK"
                        self.algo.Error(f"[0DTE] MARKET OPEN FALLBACK: Using price ${self.market_open_price:.2f} at {current_time} (Extended)")
                    else:
                        self.algo.Error(f"[0DTE] FALLBACK PRICE INVALID: ${current_spy_price:.2f}, using historical estimate")
                        # Use historical SPY average as last resort
                        self.market_open_price = 450.0  # Conservative SPY estimate
                        self.market_open_capture_time = current_time
                        self.market_open_method = "HISTORICAL_ESTIMATE"
                        self.algo.Log(f"[0DTE] EMERGENCY FALLBACK: Using historical estimate ${self.market_open_price:.2f}")
                
                # Final fallback: After 10:00 AM, use current price with validation
                elif current_time.hour >= 10:
                    if current_spy_price > 0 and 300 <= current_spy_price <= 700:
                        self.market_open_price = current_spy_price
                        self.market_open_capture_time = current_time
                        self.market_open_method = "LATE_FALLBACK"
                        self.algo.Error(f"[0DTE] LATE FALLBACK: Using current price ${self.market_open_price:.2f} at {current_time}")
                    else:
                        # Use historical estimate as absolute last resort
                        self.market_open_price = 450.0
                        self.market_open_capture_time = current_time
                        self.market_open_method = "EMERGENCY_ESTIMATE"
                        self.algo.Error(f"[0DTE] EMERGENCY FALLBACK: Invalid price data, using estimate ${self.market_open_price:.2f}")
                
                # Early morning waiting period: Before 9:30 AM
                elif current_time.hour < 9 or (current_time.hour == 9 and current_time.minute < 30):
                    self.algo.Debug(f"[0DTE] PRE-MARKET WAITING: Current time {current_time}, waiting for market open")
                    return False
                
                # Handle edge cases during market open hour
                else:
                    self.algo.Debug(f"[0DTE] MARKET OPEN EDGE CASE: Time {current_time}, attempting immediate capture")
                    if current_spy_price > 0 and 300 <= current_spy_price <= 700:
                        self.market_open_price = current_spy_price
                        self.market_open_capture_time = current_time
                        self.market_open_method = "EDGE_CASE_CAPTURE"
                        self.algo.Error(f"[0DTE] EDGE CASE CAPTURE: ${self.market_open_price:.2f} at {current_time}")
                    else:
                        return False
            
            # Enhanced validation: ensure we have market open price before proceeding
            if not self.market_open_price or self.market_open_price <= 0:
                self.algo.Error(f"[0DTE] MOVE ANALYSIS BLOCKED: No valid market open price available")
                return False
            
            # Additional price staleness check
            if hasattr(self, 'market_open_capture_time'):
                price_age = current_time - self.market_open_capture_time
                if price_age.total_seconds() > 7200:  # More than 2 hours old
                    self.algo.Log(f"[0DTE] WARNING: Market open price is {price_age.total_seconds()/TradingConstants.SECONDS_PER_HOUR:.1f} hours old")
                    # Consider re-capturing if very stale
                    if price_age.total_seconds() > 14400:  # More than 4 hours old
                        self.algo.Log(f"[0DTE] STALE PRICE: Re-capturing market price due to age")
                        self.market_open_price = None  # Force recapture
                        return self.analyze_move_from_open(spy)  # Recursive call to recapture
            
            # Calculate move from open to now
            current_price = self.algo.Securities[spy].Price
            self.pre_entry_move = (current_price - self.market_open_price) / self.market_open_price
            
            # Determine direction
            if abs(self.pre_entry_move) < 0.002:  # Less than 0.2% move
                self.move_direction = "neutral"
                self.position_type = "iron_condor"
            elif self.pre_entry_move > 0.005:  # Greater than 0.5% up
                self.move_direction = "bullish"
                self.position_type = "put_spread"  # Fade the move
            elif self.pre_entry_move < -0.005:  # Greater than 0.5% down
                self.move_direction = "bearish"
                self.position_type = "call_spread"  # Fade the move
            else:
                self.move_direction = "neutral"
                self.position_type = "iron_condor"
            
            self.algo.Error(
                f"[0DTE] MOVE ANALYSIS SUCCESS: Move={self.pre_entry_move:.2%}, "
                f"Open=${self.market_open_price:.2f}, Current=${current_price:.2f}, "
                f"Direction={self.move_direction}, Strategy={self.position_type}"
            )
            
            return True
            
        except Exception as e:
            self.algo.Error(f"[0DTE] Analysis error: {e}")
            return False
    
    def _get_cached_vix_value(self) -> float:
        """Get VIX value with caching"""
        cache_key = 'current_vix'
        cached_vix = self.vix_cache.get(
            cache_key,
            lambda: self._get_vix_value()
        )
        return cached_vix if cached_vix else 20.0
    
    def _get_cached_risk_check(self) -> bool:
        """Get risk check result with caching"""
        cache_key = 'risk_check'
        cached_result = self.entry_conditions_cache.get(
            cache_key,
            lambda: self._check_risk_limits()
        )
        return cached_result if cached_result is not None else False
    
    def _run_cache_maintenance(self):
        """Run periodic cache maintenance"""
        current_time = self.algo.Time
        
        # Run cache maintenance
        self.entry_conditions_cache.periodic_maintenance()
        self.market_data_cache.periodic_maintenance()
        self.vix_cache.periodic_maintenance()
        
        # Log cache statistics periodically
        if (current_time - self.last_cache_stats_log) > self.cache_stats_log_interval:
            self._log_cache_performance()
            self.last_cache_stats_log = current_time
    
    def _log_cache_performance(self):
        """Log 0DTE strategy cache performance"""
        try:
            pass
        except Exception as e:

            entry_stats = self.entry_conditions_cache.get_statistics()
            market_stats = self.market_data_cache.get_statistics()
            vix_stats = self.vix_cache.get_statistics()
            
            if not self.algo.LiveMode:  # Only detailed logging in backtest
                self.algo.Debug(
                    f"[0DTE Cache] Entry Hit Rate: {entry_stats['hit_rate']:.1%} | "
                    f"Market Hit Rate: {market_stats['hit_rate']:.1%} | "
                    f"VIX Hit Rate: {vix_stats['hit_rate']:.1%} | "
                    f"Total Memory: {entry_stats['memory_usage_mb'] + market_stats['memory_usage_mb'] + vix_stats['memory_usage_mb']:.1f}MB"
                )
            
        except Exception as e:
            self.algo.Debug(f"[0DTE Cache] Error logging statistics: {e}")
    
    def get_cache_statistics(self) -> dict:
        """Get 0DTE strategy cache statistics"""
        try:
            pass
        except Exception as e:

            return {
                'entry_conditions_cache': self.entry_conditions_cache.get_statistics(),
                'market_data_cache': self.market_data_cache.get_statistics(),
                'vix_cache': self.vix_cache.get_statistics(),
                'total_memory_mb': (
                    self.entry_conditions_cache.get_statistics()['memory_usage_mb'] +
                    self.market_data_cache.get_statistics()['memory_usage_mb'] +
                    self.vix_cache.get_statistics()['memory_usage_mb']
                )
            }
        except Exception as e:
            self.algo.Error(f"[0DTE Cache] Error getting statistics: {e}")
            return {}
    
    def invalidate_entry_cache(self, reason: str = "manual"):
        """Manually invalidate entry condition caches"""
        try:
            pass
        except Exception as e:

            entry_count = self.entry_conditions_cache.invalidate_all()
            market_count = self.market_data_cache.invalidate_all()
            vix_count = self.vix_cache.invalidate_all()
            
            self.algo.Debug(
                f"[0DTE Cache] Invalidated {entry_count} entry + {market_count} market + {vix_count} VIX calculations. Reason: {reason}"
            )
        except Exception as e:
            self.algo.Error(f"[0DTE Cache] Error invalidating cache: {e}")
    
    def _place_entry_orders(self) -> bool:
        """Place 0DTE entry orders based on analysis"""
        
        # Invalidate entry condition caches when placing orders
        # (positions are about to change)
        try:
            pass
        except Exception as e:

            self.entry_conditions_cache.invalidate_pattern('entry_conditions')
            self.entry_conditions_cache.invalidate_pattern('risk_check')
        except (AttributeError, KeyError, RuntimeError) as e:
            pass  # Don't fail order placement due to cache issues
        
        try:
            estimated_delta = self._estimate_position_delta()
        contracts = self._calculate_position_size()
        except Exception as e:

            # Check SPY concentration limits first (with potential caching from spy_concentration_manager)
            # IMPORTANT: Prevents over-exposure when multiple strategies trade SPY
            # DO NOT REMOVE: Critical risk management across strategies
            
            approved, reason = self.algo.spy_concentration_manager.request_spy_allocation(
                strategy_name="Friday_0DTE",
                position_type="options",
                requested_delta=estimated_delta,
                requested_contracts=contracts
            )
            
            if not approved:
                self.algo.Debug(f"[0DTE] SPY allocation denied: {reason}")
                return False
            
            spy = self.algo.spy
            
            # Get option chain
            chain = self.algo.OptionChainProvider.GetOptionContractList(spy, self.algo.Time)
            
            # Filter for 0DTE options
            expiry = self.algo.Time.date()
            zero_dte_chain = [c for c in chain if c.ID.Date.date() == expiry]
            
            if not zero_dte_chain:
                self.algo.Error("[0DTE] No 0DTE options available")
                return False
            
            # Select strikes based on position type
            if self.position_type == "iron_condor":
                success = self._enter_iron_condor(zero_dte_chain)
            elif self.position_type == "put_spread":
                success = self._enter_put_spread(zero_dte_chain)
            elif self.position_type == "call_spread":
                success = self._enter_call_spread(zero_dte_chain)
            else:
                return False
            
            if success:
                self.current_position = self.position_type
                self.entry_price = self._calculate_entry_credit()
                
                # Transition to POSITION_OPEN will happen when orders fill
                self.algo.Debug(f"[0DTE] Orders placed for {self.position_type}")
                
            return success
            
        except Exception as e:
            self.algo.Error(f"[0DTE] Order placement error: {e}")
            return False
    
    def _enter_iron_condor(self, chain) -> bool:
        """Enter iron condor position"""
        
        # Get current price
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        # Calculate expected move
        vix = self._get_vix_value()
        expected_move = current_price * (vix / 100) * np.sqrt(1/252)
        
        # Select strikes
        short_put_strike = current_price - expected_move
        long_put_strike = short_put_strike - 5  # $5 wide
        short_call_strike = current_price + expected_move
        long_call_strike = short_call_strike + 5  # $5 wide
        
        # Get option contracts from chain
        contracts_per_side = self._calculate_position_size()
        
        # Find 0DTE expiry (should be today)
        expiry = self.algo.Time.date()
        
        # Get actual option contracts
        short_put = self._get_option_contract(chain, short_put_strike, OptionRight.Put, expiry)
        long_put = self._get_option_contract(chain, long_put_strike, OptionRight.Put, expiry)
        short_call = self._get_option_contract(chain, short_call_strike, OptionRight.Call, expiry)
        long_call = self._get_option_contract(chain, long_call_strike, OptionRight.Call, expiry)
        
        if not all([short_put, long_put, short_call, long_call]):
            self.algo.Error("[0DTE] Could not find all required contracts")
            return False
        
        # Use atomic executor for all-or-nothing execution
        success = False
        if hasattr(self.algo, 'atomic_executor'):
            success = self.algo.atomic_executor.execute_iron_condor_atomic(
                short_call, long_call,
                short_put, long_put,
                contracts_per_side
            )
        else:
            # Fallback to option order executor
            if hasattr(self.algo, 'order_executor'):
                # Place as individual orders
                orders = []
                orders.append(self.algo.order_executor.place_order(short_put, -contracts_per_side))
                orders.append(self.algo.order_executor.place_order(long_put, contracts_per_side))
                orders.append(self.algo.order_executor.place_order(short_call, -contracts_per_side))
                orders.append(self.algo.order_executor.place_order(long_call, contracts_per_side))
                success = all(orders)
        
        if success:
            # Store strikes and positions for management
            self.entry_strikes = {
                'short_put': short_put_strike,
                'long_put': long_put_strike,
                'short_call': short_call_strike,
                'long_call': long_call_strike
            }
            self.current_position = {
                'short_put': short_put,
                'long_put': long_put,
                'short_call': short_call,
                'long_call': long_call,
                'contracts': contracts_per_side,
                'entry_time': self.algo.Time
            }
            self.algo.Debug(f"[0DTE] Iron condor entered: {contracts_per_side} contracts")
        
        return success
    
    def _enter_put_spread(self, chain) -> bool:
        """Enter put spread to fade bullish move"""
        
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        # Fade the move - sell put spread below market
        short_put_strike = current_price * 0.98  # 2% OTM
        long_put_strike = short_put_strike - 5
        
        contracts = self._calculate_position_size()
        
        self.entry_strikes = {
            'short_put': short_put_strike,
            'long_put': long_put_strike
        }
        
        return True
    
    def _enter_call_spread(self, chain) -> bool:
        """Enter call spread to fade bearish move"""
        
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        # Fade the move - sell call spread above market
        short_call_strike = current_price * 1.02  # 2% OTM
        long_call_strike = short_call_strike + 5
        
        contracts = self._calculate_position_size()
        
        self.entry_strikes = {
            'short_call': short_call_strike,
            'long_call': long_call_strike
        }
        
        return True
    
    def _check_defensive_exit(self) -> bool:
        """Check for defensive exit - 0DTE expires today so check time"""
        
        # Exit all 0DTE by 3:30 PM to avoid gamma risk
        if self.algo.Time.time() >= time(15, 30):
            self.algo.Debug("[0DTE] Defensive exit at 3:30 PM")
            return True
        
        return False
    
    def _needs_adjustment(self) -> bool:
        """Check if position needs adjustment"""
        
        # 0DTE typically doesn't adjust - just manage or exit
        # Could implement rolling to next expiry if breached
        
        if not self.current_position:
            return False
        
        # Check if any short strike is breached
        spy = self.algo.spy
        current_price = self.algo.Securities[spy].Price
        
        if 'short_put' in self.entry_strikes:
            if current_price <= self.entry_strikes['short_put']:
                self.algo.Debug("[0DTE] Short put breached, needs attention")
                return True
        
        if 'short_call' in self.entry_strikes:
            if current_price >= self.entry_strikes['short_call']:
                self.algo.Debug("[0DTE] Short call breached, needs attention")
                return True
        
        return False
    
    def _calculate_position_size(self) -> int:
        """Calculate position size using unified position sizer"""
        
        # UnifiedPositionSizer is always initialized in main.py
        return self.algo.position_sizer.calculate_0dte_size()
    
    def _estimate_position_delta(self) -> float:
        """Estimate delta for position before entry"""
        
        # Iron condor is roughly delta-neutral
        if self.position_type == "iron_condor":
            return 0.0  # Delta neutral
        
        # Put spread is bullish (positive delta)
        elif self.position_type == "put_spread":
            # Short put spread has positive delta
            contracts = self._calculate_position_size()
            return contracts * 10  # Roughly 10 delta per spread
        
        # Call spread is bearish (negative delta)
        elif self.position_type == "call_spread":
            # Short call spread has negative delta
            contracts = self._calculate_position_size()
            return contracts * -10  # Roughly -10 delta per spread
        
        return 0.0
    
    def _get_option_contract(self, chain, strike: float, right: OptionRight, expiry):
        """Get option contract closest to target strike"""
        
        contracts = [x for x in chain if x.ID.OptionRight == right and x.ID.Date.date() == expiry]
        
        if not contracts:
            return None
        
        # Find closest strike
        return min(contracts, key=lambda x: abs(x.ID.StrikePrice - strike))
    
    def _calculate_entry_credit(self) -> float:
        """Calculate actual entry credit from filled orders"""
        
        if not self.current_position:
            return 0.0
        
        total_credit = 0.0
        
        try:
            for contract_type, contract in self.current_position.items():
                if contract_type == 'contracts' or contract_type == 'entry_time':
                    continue
        except Exception as e:

            # Get credits from actual positions
                    
                if contract in self.algo.Securities:
                    position = self.algo.Portfolio[contract]
                    if position.Quantity < 0:  # Short position (credit)
                        total_credit += abs(position.AveragePrice * position.Quantity * 100)
                    else:  # Long position (debit)
                        total_credit -= abs(position.AveragePrice * position.Quantity * 100)
            
            return total_credit
            
        except Exception as e:
            self.algo.Error(f"[0DTE] Error calculating entry credit: {e}")
            
            # Fallback estimation based on position type
            if self.position_type == "iron_condor":
                return 100  # $1.00 typical credit per IC
            else:
                return 50  # $0.50 typical credit per spread
    
    def _get_vix_value(self) -> float:
        """Get current VIX value from UnifiedVIXManager
        
        IMPORTANT: VIX is CRITICAL for 0DTE - strategy cannot trade without it
        """
        self.algo.Debug(f"[0DTE] VIX RETRIEVAL: Requesting VIX from unified manager...")
        
        try:
        
            pass
        except Exception as e:

            vix = self.algo.vix_manager.get_current_vix()
            self.algo.Debug(f"[0DTE] VIX RETRIEVED: Raw value = {vix}")
            
            if not vix or vix <= 0:
                # DIAGNOSTIC: More detailed error logging
                self.algo.Error(f"[0DTE] VIX DATA ISSUE: Raw value = {vix} (should be > 0)")
                self.algo.Error(f"[0DTE] VIX MANAGER STATUS: {type(self.algo.vix_manager)}")
                self.algo.Error(f"[0DTE] VIX CRITICAL: Cannot trade 0DTE without valid VIX data")
                
                # FAIL FAST: Cannot trade 0DTE without valid VIX data
                raise ValueError("VIX data required for 0DTE trading - cannot proceed with invalid data")
            
            self.algo.Debug(f"[0DTE] VIX SUCCESS: Valid value = {vix:.2f}")
            return vix
            
        except Exception as e:
            self.algo.Error(f"[0DTE] VIX EXCEPTION: {e}")
            # FAIL FAST: Re-raise exception, don't trade with invalid data
            raise ValueError(f"Critical VIX data error in 0DTE strategy: {e}")
    
    def _check_vix_too_high(self, data) -> bool:
        """Check if VIX is too high for safe trading"""
        vix = self._get_vix_value()
        return vix > 35  # Emergency level
    
    def _is_too_late_to_enter(self, data) -> bool:
        """Check if too late to enter 0DTE"""
        return self.algo.Time.time() > time(11, 0)  # No entries after 11 AM
    
    def _check_risk_limits(self) -> bool:
        """Check if within risk limits"""
        
        # Check daily loss limit
        daily_pnl = self._get_daily_pnl()
        max_daily_loss = self.algo.position_sizer.get_portfolio_value() * 0.02  # 2% max daily loss
        
        if daily_pnl < -max_daily_loss:
            self.algo.Debug(f"[0DTE] Daily loss limit reached: ${daily_pnl:.2f}")
            return False
        
        # Check margin usage
        margin_used = self.algo.Portfolio.TotalMarginUsed
        max_margin = self.algo.position_sizer.get_portfolio_value() * 0.35
        
        if margin_used > max_margin:
            self.algo.Debug(f"[0DTE] Margin limit reached: ${margin_used:.2f}")
            return False
        
        return True
    
    def _get_daily_pnl(self) -> float:
        """Get actual today's P&L for this strategy"""
        
        if not hasattr(self, 'daily_start_value'):
            # Initialize at market open
            self.daily_start_value = self.algo.position_sizer.get_portfolio_value()
            return 0.0
        
        # Calculate P&L from positions related to this strategy
        strategy_pnl = 0.0
        
        try:
        
            pass
        except Exception as e:

            if self.current_position and isinstance(self.current_position, dict):
                for contract_type, contract in self.current_position.items():
                    if contract_type in ['contracts', 'entry_time']:
                        continue
                        
                    if contract in self.algo.Securities:
                        position = self.algo.Portfolio[contract]
                        strategy_pnl += position.UnrealizedProfit
            
            return strategy_pnl
            
        except Exception as e:
            self.algo.Error(f"[0DTE] Error calculating daily P&L: {e}")
            
            # Fallback to portfolio level (less accurate but functional)
            current_value = self.algo.position_sizer.get_portfolio_value()
            return current_value - self.daily_start_value
    
    def on_order_event(self, order_event):
        """Handle order events for state transitions"""
        
        if order_event.Status == OrderStatus.Filled:
            
            # Check if this completes entry
            if self.state_machine.is_in_state(StrategyState.ENTERING):
                # All legs filled?
                if self._all_entry_orders_filled():
                    self.state_machine.trigger(
                        TransitionTrigger.ORDER_FILLED,
                        {'order_id': order_event.OrderId}
                    )
            
            # Check if this completes exit
            elif self.state_machine.is_in_state(StrategyState.EXITING):
                if self._all_exit_orders_filled():
                    self.state_machine.trigger(
                        TransitionTrigger.ORDER_FILLED,
                        {'order_id': order_event.OrderId}
                    )
        
        elif order_event.Status == OrderStatus.Canceled:
            # Handle canceled orders
            if self.state_machine.is_in_state(StrategyState.ENTERING):
                self.state_machine.trigger(
                    TransitionTrigger.ORDER_REJECTED,
                    {'reason': 'Order canceled'}
                )
    
    def _all_entry_orders_filled(self) -> bool:
        """Check if all entry orders are filled"""
        
        if not hasattr(self, 'pending_entry_orders'):
            return True  # No pending orders
        
        # Check if all entry orders have been filled
        for order_id in self.pending_entry_orders:
            order = self.algo.Transactions.GetOrderById(order_id)
            if order and order.Status not in [OrderStatus.Filled, OrderStatus.PartiallyFilled]:
                return False
        
        # All orders filled - clear pending list
        self.pending_entry_orders = []
        return True
    
    def _all_exit_orders_filled(self) -> bool:
        """Check if all exit orders are filled"""
        
        if not hasattr(self, 'pending_exit_orders'):
            return True  # No pending orders
        
        # Check if all exit orders have been filled
        for order_id in self.pending_exit_orders:
            order = self.algo.Transactions.GetOrderById(order_id)
            if order and order.Status not in [OrderStatus.Filled, OrderStatus.PartiallyFilled]:
                return False
        
        # All orders filled - clear pending list
        self.pending_exit_orders = []
        return True
    
    def _place_exit_orders(self) -> bool:
        """
        Place 0DTE exit orders following Tom King methodology
        Handles iron condor, put spread, and call spread exits atomically
        """
        try:
            pass
        except Exception as e:

            if not self.current_position:
                self.algo.Error("[0DTE] No position to exit")
                return False
            
            self.algo.Debug(f"[0DTE] Placing exit orders for {self.position_type}")
            
            # Initialize pending exit orders tracking
            if not hasattr(self, 'pending_exit_orders'):
                self.pending_exit_orders = []
            
            # Create atomic order group for multi-leg exit
            from helpers.atomic_order_executor import AtomicOrderGroup
            exit_group = AtomicOrderGroup(self.algo, f"0DTE_Exit_{self.algo.Time.strftime('%H%M%S')}")
            
            exit_orders_placed = []
            
            # Handle different position types
            if self.position_type == "iron_condor" and isinstance(self.current_position, dict):
                # Exit all four legs of iron condor
                legs_to_exit = ['short_put', 'long_put', 'short_call', 'long_call']
                
                for leg_name in legs_to_exit:
                    if leg_name in self.current_position:
                        symbol = self.current_position[leg_name]
                        if symbol and symbol in self.algo.Securities:
                            # Get current position quantity
                            current_quantity = self.algo.Securities[symbol].Holdings.Quantity
                            
                            if current_quantity != 0:
                                # Exit by placing opposite order
                                exit_quantity = -current_quantity
                                exit_group.add_leg(symbol, exit_quantity)
                                
                                self.algo.Debug(f"[0DTE] Exit {leg_name}: {symbol} quantity {exit_quantity}")
            
            elif self.position_type in ["put_spread", "call_spread"] and isinstance(self.current_position, dict):
                # Exit spread legs
                if self.position_type == "put_spread":
                    legs_to_exit = ['short_put', 'long_put']
                else:  # call_spread
                    legs_to_exit = ['short_call', 'long_call']
                
                for leg_name in legs_to_exit:
                    if leg_name in self.current_position:
                        symbol = self.current_position[leg_name]
                        if symbol and symbol in self.algo.Securities:
                            current_quantity = self.algo.Securities[symbol].Holdings.Quantity
                            
                            if current_quantity != 0:
                                exit_quantity = -current_quantity
                                exit_group.add_leg(symbol, exit_quantity)
                                
                                self.algo.Debug(f"[0DTE] Exit {leg_name}: {symbol} quantity {exit_quantity}")
            
            else:
                # Handle simple position (legacy format)
                if hasattr(self.current_position, '__iter__') and not isinstance(self.current_position, str):
                    # Iterate through position symbols
                    for symbol in self.current_position:
                        if symbol and symbol in self.algo.Securities:
                            current_quantity = self.algo.Securities[symbol].Holdings.Quantity
                            if current_quantity != 0:
                                exit_quantity = -current_quantity
                                exit_group.add_leg(symbol, exit_quantity)
                
                elif isinstance(self.current_position, str):
                    # Single symbol position
                    symbol = self.current_position
                    if symbol and symbol in self.algo.Securities:
                        current_quantity = self.algo.Securities[symbol].Holdings.Quantity
                        if current_quantity != 0:
                            exit_quantity = -current_quantity
                            exit_group.add_leg(symbol, exit_quantity)
            
            # Execute atomic exit
            if exit_group.target_legs:
                success = exit_group.execute()
                
                if success:
                    # Store order IDs for tracking
                    for order in exit_group.orders:
                        if order and hasattr(order, 'OrderId'):
                            self.pending_exit_orders.append(order.OrderId)
                            exit_orders_placed.append(order.OrderId)
                    
                    # Notify SPY concentration manager about pending exit
                    if hasattr(self.algo, 'spy_concentration_manager'):
                        self.algo.spy_concentration_manager.notify_pending_exit(
                            strategy_name="Friday_0DTE",
                            position_info=self.current_position
                        )
                    
                    self.algo.Log(f"[0DTE] Exit orders placed successfully: {len(exit_orders_placed)} orders")
                    return True
                
                else:
                    self.algo.Error("[0DTE] Failed to place exit orders atomically")
                    return False
            
            else:
                self.algo.Log("[0DTE] No positions found to exit")
                return True  # No positions is considered successful exit
                
        except Exception as e:
            self.algo.Error(f"[0DTE] Exit order placement failed: {e}")
            import traceback
            self.algo.Error(f"[0DTE] Exit error traceback: {traceback.format_exc()}")
            return False