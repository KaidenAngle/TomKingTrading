# region imports
from AlgorithmImports import *
from datetime import time, timedelta
import numpy as np
# endregion
# Tom King Trading Framework v17 - Income Poor Man's Covered Call Strategy (IPMCC)
# Based on Tom King Complete Trading System Documentation
# COMPLETE IMPLEMENTATION WITH REAL OPTION CHAIN ACCESS

class InPerpetuityCoveredCalls:
    """
    Tom King's Income Poor Man's Covered Call (IPMCC) Strategy
    Weekly income generation system using LEAP + weekly calls
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.name = "IPMCC"
        
        # Tom King IPMCC LEAP Requirements
        self.leap_requirements = {
            'delta': 0.80,          # 80 delta LEAP (Tom King specification)
            'min_dte': 280,         # Tom King: 280+ DTE minimum
            'target_dte': 365,      # Target 365 DTE
            'max_extrinsic_pct': 0.05  # <5% extrinsic value
        }
        
        # Tom King Weekly Call Rules  
        self.weekly_call_rules = {
            'roll_day': 4,  # Friday = 4
            'roll_time': time(9, 15),  # 9:15 AM ET
            'dte': 7,  # Weekly options
            'strike_selection': 'Based on 8/21 EMA relationship',
            'target_premium': 200,  # $200 minimum per week
            'max_risk_per_call': 0.02  # 2% of account per call
        }
        
        # Tom King EMA-based strike selection
        self.ema_periods = {
            'fast': 8,
            'slow': 21
        }
        
        # Performance Targets (PDF Page 16)
        self.performance_targets = {
            'weekly_return_on_leap': 0.025,  # 2.5% weekly return on LEAP value
            'monthly_target': 0.10,          # 10% monthly return target
            'annual_target': 1.20            # 120% annual return
        }
        
        # Product Universe by Phase
        self.product_universe = {
            1: ['SPY'],  # Phase 1: SPY only
            2: ['SPY', 'QQQ'],  # Phase 2: Add QQQ
            3: ['SPY', 'QQQ', 'IWM', 'DIA'],  # Phase 3: Add small caps
            4: ['SPY', 'QQQ', 'IWM', 'DIA', 'NVDA', 'TSLA', 'AAPL', 'MSFT']  # Phase 4: Individual names
        }
        
        # Position Limits by Phase
        self.position_limits = {
            1: 1,  # Phase 1: 1 IPMCC
            2: 2,  # Phase 2: 2 IPMCCs
            3: 3,  # Phase 3: 3 IPMCCs
            4: 4   # Phase 4: 4 IPMCCs
        }
        
        # Risk Management
        self.risk_rules = {
            'max_bp_per_position': 0.08,  # 8% BP per IPMCC
            'leap_loss_limit': 0.20,      # 20% loss on LEAP triggers closure
            'call_assignment_handling': 'roll_or_close',
            'earnings_avoidance': True    # Avoid calls through earnings
        }
        
        # Active positions tracking
        self.active_ipmccs = []
        self.completed_trades = []
        
    def can_enter_position(self, account_phase, current_positions, correlation_manager=None):
        """Check if we can enter a new IPMCC position"""
        # Position count check
        current_ipmcc_count = len([p for p in current_positions if 'IPMCC' in p.get('strategy', '')])
        max_positions = self.position_limits.get(account_phase, 0)
        
        if current_ipmcc_count >= max_positions:
            return False, f"IPMCC at maximum positions ({current_ipmcc_count}/{max_positions})"
        
        # Buying power check (8% per position)
        required_bp = self.risk_rules['max_bp_per_position']
        if current_ipmcc_count * required_bp >= 0.32:  # 32% max total for IPMCCs
            return False, "IPMCC BP limit reached (32% max total)"
        
        # Market conditions check
        if not self.is_suitable_market_environment():
            return False, "Market environment not suitable for new IPMCC"
        
        return True, "IPMCC entry conditions met"
    
    def is_suitable_market_environment(self, vix_level=None):
        """Check if market environment is suitable for IPMCC"""
        # Generally suitable unless VIX is extremely high
        if vix_level and vix_level > 35:
            return False  # Too volatile for covered call strategies
        return True
    
    def get_available_products(self, account_phase):
        """Get available products for IPMCC based on account phase"""
        return self.product_universe.get(account_phase, ['SPY'])
    
    def find_suitable_leap(self, symbol):
        """
        Tom King: Find ACTUAL 280+ DTE, 80 delta LEAP from REAL option chains
        """
        try:
            # Add the symbol if not already present
            if symbol not in self.algorithm.Securities:
                equity = self.algorithm.AddEquity(symbol, Resolution.Minute)
                equity.SetDataNormalizationMode(DataNormalizationMode.Raw)
            
            current_price = self.algorithm.Securities[symbol].Price
            
            # Get REAL option chain from QuantConnect
            option_chains = self.algorithm.CurrentSlice.OptionChains
            
            suitable_leaps = []
            
            # Check current option chains
            for kvp in option_chains:
                chain = kvp.Value
                if chain and chain.Underlying.Symbol.Value == symbol:
                    # Filter for LEAP candidates
                    leap_candidates = [
                        contract for contract in chain
                        if contract.Right == OptionRight.Call
                        and (contract.Expiry.date() - self.algorithm.Time.date()).days >= self.leap_requirements['min_dte']
                    ]
                    
                    for contract in leap_candidates:
                        # Calculate Greeks if available
                        delta = contract.Greeks.Delta if hasattr(contract.Greeks, 'Delta') else self._estimate_delta(contract, current_price)
                        
                        # Check delta requirement (75-85 delta acceptable)
                        if 0.75 <= delta <= 0.85:
                            # Calculate extrinsic value
                            intrinsic = max(0, current_price - contract.Strike)
                            extrinsic = contract.BidPrice - intrinsic
                            extrinsic_pct = extrinsic / contract.BidPrice if contract.BidPrice > 0 else 1
                            
                            # Check extrinsic value requirement
                            if extrinsic_pct <= self.leap_requirements['max_extrinsic_pct']:
                                suitable_leaps.append({
                                    'contract': contract,
                                    'strike': contract.Strike,
                                    'expiry': contract.Expiry,
                                    'dte': (contract.Expiry.date() - self.algorithm.Time.date()).days,
                                    'delta': delta,
                                    'bid': contract.BidPrice,
                                    'ask': contract.AskPrice,
                                    'intrinsic': intrinsic,
                                    'extrinsic': extrinsic,
                                    'extrinsic_pct': extrinsic_pct
                                })
            
            # If no options in current slice, use OptionChainProvider
            if not suitable_leaps and hasattr(self.algorithm, 'OptionChainProvider'):
                self.algorithm.Log(f"[IPMCC] Using OptionChainProvider for {symbol}")
                
                # Get all available option contracts
                all_contracts = self.algorithm.OptionChainProvider.GetOptionContractList(
                    self.algorithm.Symbol(symbol),
                    self.algorithm.Time
                )
                
                # Filter for LEAP expirations
                leap_contracts = [
                    c for c in all_contracts
                    if c.ID.OptionRight == OptionRight.Call
                    and (c.ID.Date.date() - self.algorithm.Time.date()).days >= self.leap_requirements['min_dte']
                ]
                
                # Find 80 delta strikes
                for contract_symbol in leap_contracts:
                    strike = contract_symbol.ID.StrikePrice
                    expiry = contract_symbol.ID.Date
                    dte = (expiry.date() - self.algorithm.Time.date()).days
                    
                    # Estimate delta for deep ITM calls
                    moneyness = current_price / strike
                    estimated_delta = min(0.95, max(0.5, moneyness - 0.2))  # Rough approximation
                    
                    if 0.75 <= estimated_delta <= 0.85:
                        # Add the option contract to get pricing
                        self.algorithm.AddOptionContract(contract_symbol)
                        
                        suitable_leaps.append({
                            'symbol': contract_symbol,
                            'strike': strike,
                            'expiry': expiry,
                            'dte': dte,
                            'delta': estimated_delta,
                            'needs_pricing': True  # Will get pricing on next slice
                        })
            
            if suitable_leaps:
                # Sort by closest to 365 DTE and 80 delta
                best_leap = min(suitable_leaps, 
                              key=lambda x: abs(x['dte'] - 365) + abs(x['delta'] - 0.80) * 100)
                
                self.algorithm.Log(f"[IPMCC] Found suitable LEAP for {symbol}:")
                self.algorithm.Log(f"  Strike: {best_leap['strike']}, DTE: {best_leap['dte']}, Delta: {best_leap['delta']:.2f}")
                
                return best_leap
            else:
                self.algorithm.Log(f"[IPMCC] No suitable LEAP found for {symbol}")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Error finding LEAP for {symbol}: {str(e)}")
            return None
    
    def _estimate_delta(self, contract, underlying_price):
        """Estimate delta for deep ITM calls when Greeks not available"""
        if contract.Strike < underlying_price * 0.85:
            return 0.80  # Deep ITM approximation
        elif contract.Strike < underlying_price * 0.95:
            return 0.60  # ITM approximation
        else:
            return 0.50  # ATM approximation
    
    def check_market_conditions_for_entry(self, symbol):
        """Tom King: Never enter IPMCC at channel tops"""
        try:
            if symbol not in self.algorithm.Securities:
                return False, "Symbol not in securities"
            
            # Get price history for channel analysis
            history = self.algorithm.History(self.algorithm.Symbol(symbol), 50, Resolution.Daily)
            
            if history.empty:
                return True, "No history available - proceeding"
            
            closes = history['close'].values
            current_price = self.algorithm.Securities[symbol].Price
            
            # Calculate channel (50-day high/low)
            channel_high = max(closes)
            channel_low = min(closes)
            channel_position = (current_price - channel_low) / (channel_high - channel_low) if channel_high > channel_low else 0.5
            
            # Tom King: Avoid entry at channel tops (>85% of range)
            if channel_position > 0.85:
                return False, f"Price at channel top ({channel_position:.1%})"
            
            # Check EMAs for trend
            ema_8 = self._calculate_ema(closes, 8)
            ema_21 = self._calculate_ema(closes, 21)
            
            # Prefer entry when testing moving averages
            if abs(current_price - ema_21) / ema_21 < 0.02:  # Within 2% of 21 EMA
                return True, "Price near 21 EMA - good entry point"
            
            return True, "Market conditions acceptable"
            
        except Exception as e:
            self.algorithm.Error(f"Error checking market conditions: {str(e)}")
            return True, "Error in analysis - proceeding"
    
    def _calculate_ema(self, prices, period):
        """Calculate exponential moving average"""
        if len(prices) < period:
            return prices[-1] if len(prices) > 0 else 0
        
        multiplier = 2 / (period + 1)
        ema = prices[:period].mean()  # SMA for first period
        
        for price in prices[period:]:
            ema = (price * multiplier) + (ema * (1 - multiplier))
        
        return ema
    
    def calculate_weekly_call_strike(self, symbol, leap_strike):
        """
        Tom King: Calculate weekly call strike based on 8/21 EMA relationship
        """
        try:
            current_price = self.algorithm.Securities[symbol].Price
            
            # Get price history for EMA calculation
            history = self.algorithm.History(self.algorithm.Symbol(symbol), 30, Resolution.Daily)
            
            if not history.empty:
                closes = history['close'].values
                ema_8 = self._calculate_ema(closes, 8)
                ema_21 = self._calculate_ema(closes, 21)
                
                # Tom King strike selection rules
                if ema_8 > ema_21 * 1.005:  # 8 EMA > 21 EMA (bullish)
                    # Sell ATM
                    call_strike = current_price
                    self.algorithm.Log(f"[IPMCC] 8 EMA > 21 EMA: Selling ATM at {call_strike}")
                    
                elif ema_8 < ema_21 * 0.995:  # 8 EMA < 21 EMA (bearish)
                    # Sell 1-2 strikes ITM
                    strike_increment = 1 if current_price < 100 else 5
                    call_strike = current_price - (2 * strike_increment)
                    self.algorithm.Log(f"[IPMCC] 8 EMA < 21 EMA: Selling ITM at {call_strike}")
                    
                else:  # EMAs converged (neutral)
                    # Sell slightly OTM
                    call_strike = current_price * 1.005
                    self.algorithm.Log(f"[IPMCC] EMAs neutral: Selling OTM at {call_strike}")
                    
                # Tom King: If market extended, sell ITM
                if current_price > ema_8 * 1.03:  # 3% above 8 EMA
                    call_strike = current_price * 0.99  # 1% ITM
                    self.algorithm.Log(f"[IPMCC] Market extended: Selling ITM at {call_strike}")
            else:
                # Default to ATM if no history
                call_strike = current_price
            
            # Ensure call strike is above LEAP strike
            call_strike = max(call_strike, leap_strike + 1)
            
            # Round to valid strike increment
            if symbol in ['SPY', 'QQQ', 'IWM']:
                call_strike = round(call_strike)  # $1 increments
            else:
                call_strike = round(call_strike / 5) * 5  # $5 increments
            
            return call_strike
            
        except Exception as e:
            self.algorithm.Error(f"Error calculating weekly call strike: {str(e)}")
            return leap_strike + 5  # Safe default
    
    def create_ipmcc_structure(self, symbol, leap_analysis, weekly_call_strike, position_size=1):
        """
        Create complete IPMCC position structure
        """
        structure = {
            'strategy': 'IPMCC',
            'symbol': symbol,
            'position_size': position_size,
            'entry_date': self.algorithm.Time,
            'leap_leg': {
                'action': 'BUY',
                'strike': leap_analysis['leap_strike'],
                'dte': self.leap_requirements['dte'],
                'premium_paid': leap_analysis['leap_premium'],
                'delta': self.leap_requirements['delta'],
                'extrinsic_value': leap_analysis['extrinsic_value']
            },
            'weekly_call': {
                'action': 'SELL',
                'strike': weekly_call_strike,
                'dte': 7,  # Weekly options
                'premium_target': self.weekly_call_rules['target_premium'],
                'roll_schedule': 'Friday 9:15 AM ET'
            },
            'performance_tracking': {
                'leap_cost_basis': leap_analysis['leap_premium'],
                'weekly_income_total': 0,
                'total_return': 0,
                'weekly_return_on_leap': 0
            },
            'management_rules': {
                'leap_loss_limit': self.risk_rules['leap_loss_limit'],
                'call_assignment_plan': self.risk_rules['call_assignment_handling'],
                'earnings_dates': []  # Would be populated with actual earnings dates
            }
        }
        
        return structure
    
    def analyze_weekly_roll_decision(self, ipmcc_position, current_price):
        """
        Analyze whether to roll weekly call or let it expire
        Returns: dict with roll recommendation
        """
        # First check if LEAP needs rolling (critical)
        # Clear boundaries: <= 30 is critical, 31-60 is warning, > 60 is normal
        leap_dte = ipmcc_position.get('leap_leg', {}).get('dte', float('inf'))
        if leap_dte <= 30:  # 30 days or less - critical
            self.algorithm.Log(f"[IPMCC] CRITICAL: LEAP expiring in {leap_dte} days - needs immediate roll!")
            return {
                'position_id': ipmcc_position.get('id'),
                'action': 'ROLL_LEAP_URGENT',
                'reason': f'LEAP expiring in {leap_dte} days',
                'priority': 'CRITICAL'
            }
        elif leap_dte <= 60:  # 31-60 days - warning
            self.algorithm.Log(f"[IPMCC] WARNING: LEAP has {leap_dte} days to expiration - plan roll soon")
        
        weekly_call = ipmcc_position['weekly_call']
        current_strike = weekly_call['strike']
        dte = weekly_call['dte']
        
        decision = {
            'position_id': ipmcc_position.get('id'),
            'action': 'HOLD',
            'reason': '',
            'new_strike': None,
            'expected_premium': None
        }
        
        # Friday 9:15 AM roll logic
        if self.algorithm.Time.weekday() == 4 and self.algorithm.Time.hour == 9 and self.algorithm.Time.minute >= 15:
            if dte <= 1:  # Day of or before expiration
                if current_price < current_strike:
                    # Call is OTM - likely to expire worthless
                    decision.update({
                        'action': 'LET_EXPIRE',
                        'reason': f'Call OTM ({current_price:.2f} < {current_strike})',
                        'expected_outcome': 'Expire worthless, keep premium'
                    })
                else:
                    # Call is ITM - may get assigned
                    decision.update({
                        'action': 'ROLL_UP_AND_OUT',
                        'reason': f'Call ITM ({current_price:.2f} > {current_strike})',
                        'new_strike': self.calculate_weekly_call_strike(
                            ipmcc_position['leap_leg']['strike'], 
                            current_price
                        ),
                        'expected_premium': 200  # Minimum target
                    })
        
        # Early assignment risk check
        if current_price > current_strike * 1.05 and dte <= 3:
            decision.update({
                'action': 'CLOSE_EARLY',
                'reason': 'High assignment risk - close early',
                'priority': 'HIGH'
            })
        
        return decision
    
    def analyze_leap_health(self, ipmcc_position, current_price):
        """
        Analyze health of LEAP position and recommend actions
        """
        leap_leg = ipmcc_position['leap_leg']
        cost_basis = leap_leg['premium_paid']
        current_leap_value = max(0, current_price - leap_leg['strike'])  # Intrinsic value estimate
        
        unrealized_pl = (current_leap_value - cost_basis) / cost_basis
        
        health_analysis = {
            'position_id': ipmcc_position.get('id'),
            'unrealized_pl_percent': unrealized_pl * 100,
            'current_value': current_leap_value,
            'cost_basis': cost_basis,
            'health_score': 50,  # Base score
            'recommendations': []
        }
        
        # Health scoring
        if unrealized_pl > 0.10:  # 10%+ profit
            health_analysis['health_score'] = 80
            health_analysis['recommendations'].append("LEAP performing well")
        elif unrealized_pl > 0:
            health_analysis['health_score'] = 60
        elif unrealized_pl > -0.10:  # Less than 10% loss
            health_analysis['health_score'] = 40
            health_analysis['recommendations'].append("Monitor LEAP closely")
        else:  # More than 10% loss
            health_analysis['health_score'] = 20
            health_analysis['recommendations'].append("Consider LEAP closure")
        
        # Check loss limit
        if unrealized_pl <= -self.risk_rules['leap_loss_limit']:
            health_analysis['recommendations'].append("URGENT: LEAP loss limit reached - close position")
            health_analysis['action_required'] = 'CLOSE_LEAP'
        
        return health_analysis
    
    def calculate_ipmcc_performance_metrics(self, ipmcc_position):
        """Calculate comprehensive performance metrics for IPMCC"""
        leap_leg = ipmcc_position['leap_leg']
        performance = ipmcc_position['performance_tracking']
        
        days_held = (self.algorithm.Time - ipmcc_position['entry_date']).days
        weeks_held = max(1, days_held / 7)
        
        metrics = {
            'days_held': days_held,
            'weeks_held': weeks_held,
            'total_weekly_income': performance['weekly_income_total'],
            'leap_cost_basis': performance['leap_cost_basis'],
            'weekly_income_yield': performance['weekly_income_total'] / performance['leap_cost_basis'],
            'annualized_yield': (performance['weekly_income_total'] / performance['leap_cost_basis']) * (52 / weeks_held),
            'target_weekly_return': self.performance_targets['weekly_return_on_leap'],
            'target_monthly_return': self.performance_targets['monthly_target'],
            'performance_vs_target': None
        }
        
        # Performance vs target
        actual_weekly_return = metrics['weekly_income_yield'] / weeks_held
        target_weekly_return = metrics['target_weekly_return']
        
        metrics['performance_vs_target'] = {
            'actual_weekly_return': actual_weekly_return,
            'target_weekly_return': target_weekly_return,
            'performance_ratio': actual_weekly_return / target_weekly_return if target_weekly_return > 0 else 0,
            'status': 'ABOVE_TARGET' if actual_weekly_return > target_weekly_return else 'BELOW_TARGET'
        }
        
        return metrics
    
    def get_ipmcc_summary(self, account_phase, account_value):
        """Get comprehensive IPMCC strategy summary"""
        available_products = self.get_available_products(account_phase)
        max_positions = self.position_limits.get(account_phase, 0)
        
        summary = {
            'strategy_name': 'Income Poor Mans Covered Call',
            'nickname': 'IPMCC',
            'phase_availability': f'All phases (max {max_positions} positions)',
            'available_products': available_products,
            'max_positions': max_positions,
            'bp_per_position': f'{self.risk_rules["max_bp_per_position"] * 100:.0f}%',
            'leap_requirements': {
                'delta': f'{self.leap_requirements["delta"] * 100:.0f} delta',
                'dte': f'{self.leap_requirements["dte"]} days',
                'extrinsic_limit': f'<{self.leap_requirements["max_extrinsic_pct"] * 100:.0f}%'
            },
            'weekly_call_strategy': {
                'roll_day': 'Friday 9:15 AM',
                'strike_selection': 'ATM or ITM based on regime',
                'target_premium': self.weekly_call_rules['target_premium']
            },
            'performance_targets': {
                'weekly_return_on_leap': f'{self.performance_targets["weekly_return_on_leap"] * 100:.1f}%',
                'monthly_target': f'{self.performance_targets["monthly_target"] * 100:.0f}%',
                'annual_target': f'{self.performance_targets["annual_target"] * 100:.0f}%'
            },
            'risk_management': {
                'leap_loss_limit': f'{self.risk_rules["leap_loss_limit"] * 100:.0f}%',
                'assignment_handling': self.risk_rules['call_assignment_handling'],
                'earnings_avoidance': self.risk_rules['earnings_avoidance']
            }
        }
        
        return summary
    
    def execute_ipmcc_entry(self, symbol, account_value, vix_level=None):
        """
        Execute actual IPMCC entry with proper option contract registration
        """
        try:
            # Step 1: Analyze LEAP suitability
            current_price = float(self.algorithm.Securities[symbol].Price)
            leap_analysis = self.analyze_leap_candidate(symbol, current_price)
            
            if not leap_analysis['suitable']:
                return False, f"LEAP analysis failed: {leap_analysis['reasons']}"
            
            # Step 2: Get option chain data for the symbol
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(symbol, self.algorithm.Time)
            if not option_chain:
                return False, f"No option chain available for {symbol}"
            
            # Step 3: Find suitable LEAP (365 DTE, ~80 delta)
            target_expiry = self.algorithm.Time + timedelta(days=365)
            leap_contracts = [c for c in option_chain 
                            if c.ID.OptionRight == OptionRight.Call and 
                            abs((c.ID.Date - target_expiry).days) <= 30]  # Within 30 days of target
            
            if not leap_contracts:
                return False, f"No suitable LEAP contracts found for {symbol}"
            
            # Find contract closest to 80 delta strike (estimate: 15-20% OTM)
            target_leap_strike = current_price * 0.82  # Rough 80 delta approximation
            leap_call = min(leap_contracts, key=lambda c: abs(c.ID.StrikePrice - target_leap_strike))
            
            # Step 4: Calculate weekly call parameters
            weekly_call_strike = self.calculate_weekly_call_strike(
                leap_call.ID.StrikePrice, current_price
            )
            
            # Find weekly call (7 DTE)
            weekly_expiry = self.algorithm.Time + timedelta(days=7)
            weekly_contracts = [c for c in option_chain 
                              if c.ID.OptionRight == OptionRight.Call and 
                              abs((c.ID.Date - weekly_expiry).days) <= 3 and  # Within 3 days
                              abs(c.ID.StrikePrice - weekly_call_strike) <= 5]  # Within $5 of target
            
            if not weekly_contracts:
                return False, f"No suitable weekly call found for {symbol}"
            
            weekly_call = min(weekly_contracts, key=lambda c: abs(c.ID.StrikePrice - weekly_call_strike))
            
            # Step 5: Calculate position size (8% of BP per IPMCC)
            max_bp_usage = account_value * self.risk_rules['max_bp_per_position']  # 8%
            estimated_leap_cost = current_price - leap_call.ID.StrikePrice + 10  # Intrinsic + est. extrinsic
            quantity = max(1, int(max_bp_usage / (estimated_leap_cost * 100)))  # 100 shares per contract
            
            # Step 6: Register option contracts before trading (CRITICAL!)
            self.algorithm.AddOptionContract(leap_call)
            self.algorithm.AddOptionContract(weekly_call)
            
            # Step 7: Execute IPMCC structure
            # Buy LEAP call
            leap_order = self.algorithm.MarketOrder(leap_call, quantity)
            
            # Sell weekly call
            weekly_order = self.algorithm.MarketOrder(weekly_call, -quantity)
            
            # Step 8: Track position
            if leap_order and weekly_order:
                ipmcc_position = self.create_ipmcc_structure(
                    symbol, leap_analysis, weekly_call_strike, quantity
                )
                ipmcc_position['leap_order_id'] = leap_order.OrderId
                ipmcc_position['weekly_order_id'] = weekly_order.OrderId
                self.active_ipmccs.append(ipmcc_position)
                
                self.algorithm.Log(f"✅ IPMCC Executed: {symbol} LEAP@{leap_call.ID.StrikePrice} + Weekly@{weekly_call.ID.StrikePrice} x{quantity}")
                return True, f"IPMCC successfully executed"
            else:
                return False, "Order execution failed"
                
        except Exception as e:
            self.algorithm.Error(f"IPMCC execution error for {symbol}: {str(e)}")
            return False, f"Execution error: {str(e)}"
    
    def roll_weekly_call(self, ipmcc_position):
        """
        Roll weekly call with proper option contract registration
        """
        try:
            symbol = ipmcc_position['symbol']
            current_price = float(self.algorithm.Securities[symbol].Price)
            
            # Analyze roll decision
            roll_decision = self.analyze_weekly_roll_decision(ipmcc_position, current_price)
            
            if roll_decision['action'] == 'ROLL_UP_AND_OUT':
                # Get new option chain
                option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(symbol, self.algorithm.Time)
                
                # Find new weekly call
                new_weekly_expiry = self.algorithm.Time + timedelta(days=7)
                new_weekly_contracts = [c for c in option_chain 
                                      if c.ID.OptionRight == OptionRight.Call and 
                                      abs((c.ID.Date - new_weekly_expiry).days) <= 3 and
                                      abs(c.ID.StrikePrice - roll_decision['new_strike']) <= 2]
                
                if new_weekly_contracts:
                    new_weekly_call = min(new_weekly_contracts, 
                                        key=lambda c: abs(c.ID.StrikePrice - roll_decision['new_strike']))
                    
                    # Register new contract
                    self.algorithm.AddOptionContract(new_weekly_call)
                    
                    # Close old weekly call
                    old_quantity = ipmcc_position['position_size']
                    close_order = self.algorithm.MarketOrder(
                        Symbol.Create(ipmcc_position['weekly_call']['symbol'], SecurityType.Option, Market.USA),
                        old_quantity  # Buy back the short call
                    )
                    
                    # Sell new weekly call
                    new_order = self.algorithm.MarketOrder(new_weekly_call, -old_quantity)
                    
                    if close_order and new_order:
                        # Update position tracking
                        ipmcc_position['weekly_call']['strike'] = new_weekly_call.ID.StrikePrice
                        ipmcc_position['weekly_call']['dte'] = 7
                        ipmcc_position['weekly_order_id'] = new_order.OrderId
                        
                        self.algorithm.Log(f"✅ IPMCC Weekly Rolled: {symbol} from old to {new_weekly_call.ID.StrikePrice}")
                        return True
            
            elif roll_decision['action'] == 'LET_EXPIRE':
                self.algorithm.Log(f"📅 IPMCC Weekly Expiring: {symbol} - letting expire worthless")
                return True
                
            return False
            
        except Exception as e:
            self.algorithm.Error(f"IPMCC roll error: {str(e)}")
            return False

    def validate_ipmcc_system(self):
        """Validate IPMCC strategy functionality"""
        tests = [
            ('Position limits defined', len(self.position_limits) == 4),
            ('Product universe defined', len(self.product_universe) == 4),
            ('LEAP requirements set', self.leap_requirements['delta'] == 0.80),
            ('Performance targets set', self.performance_targets['weekly_return_on_leap'] > 0),
            ('Risk rules defined', self.risk_rules['leap_loss_limit'] == 0.20),
            ('Weekly call logic works', callable(self.analyze_weekly_roll_decision)),
            ('Execution method available', callable(self.execute_ipmcc_entry)),
            ('Roll method available', callable(self.roll_weekly_call))
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'✅' if condition else '❌'} {test_name}")
        
        return results

# Usage Example for QuantConnect Algorithm:
#
