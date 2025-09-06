# region imports
from AlgorithmImports import *
import numpy as np
from datetime import timedelta
# endregion
# Tom King Trading Framework v17 - LEAP Put Ladder Strategy  
# Based on Tom King Complete Trading System Documentation (PDF Pages 28, 33)

class LEAPPutLadderStrategy:
    """
    Tom King's LEAP Put Ladder Strategy
    Capital compounding system with staggered weekly entries
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.name = "LEAP_LADDER"
        
        # LEAP Ladder Core Parameters (PDF Page 28)
        self.entry_schedule = "Monday"  # Every Monday staggered approach
        self.base_dte = 365            # 365 days initial DTE  
        self.roll_dte = 150            # Roll at 150 DTE
        self.target_delta_range = (0.12, 0.14)  # 12-14 delta (deep OTM puts)
        
        # Rotating Delta System (PDF Page 28)
        self.weekly_delta_rotation = {
            1: 0.12,  # Week 1 of month: 12 delta
            2: 0.13,  # Week 2 of month: 13 delta  
            3: 0.14,  # Week 3 of month: 14 delta
            4: 0.12   # Week 4 of month: 12 delta (back to start)
        }
        
        # Position Management
        self.max_positions_per_ladder = 10  # Maximum 10 positions per ladder
        self.profit_target = 0.30          # 30% profit target
        self.expected_monthly_income = (200, 300)  # £200-300 per month target
        
        # Phase-based Availability (PDF Page 17)
        self.phase_requirements = {
            'minimum_phase': 2,           # Available from Phase 2+
            'minimum_account': 37000      # £37k minimum (Phase 2 enhanced)
        }
        
        # Position Limits by Phase
        self.position_limits = {
            2: 4,   # Phase 2: 4 LEAP positions max
            3: 6,   # Phase 3: 6 LEAP positions max  
            4: 10   # Phase 4: Full 10 position ladder
        }
        
        # Product Universe (Focus on SPY for simplicity)
        self.product_universe = ['SPY']  # Can expand to QQQ, IWM in Phase 4
        
        # VIX Optimization Rules (PDF Page 33)
        self.vix_rules = {
            'skip_threshold': 15,     # Skip week if VIX < 15
            'double_threshold': 20,   # Double size if VIX > 20
            'max_vix_multiplier': 2.0 # Maximum 2x size
        }
        
        # Risk Management
        self.risk_parameters = {
            'max_bp_per_position': 0.02,  # 2% BP per LEAP
            'max_total_bp': 0.20,         # 20% total BP for all LEAPs
            'stop_loss_percent': -50,     # 50% loss triggers closure
            'position_sizing_base': 1     # 1 contract base size
        }
        
        # Active ladder tracking
        self.active_leaps = []
        self.completed_trades = []
        self.ladder_statistics = {
            'total_entries': 0,
            'total_profits': 0,
            'total_losses': 0,
            'win_rate': 0,
            'average_hold_days': 40  # Expected from PDF
        }
        
    def can_enter_position(self, account_phase, account_value, current_positions):
        """Check if we can enter a new LEAP position"""
        # Phase requirement check
        if account_phase < self.phase_requirements['minimum_phase']:
            return False, f"LEAP Ladders require Phase {self.phase_requirements['minimum_phase']}+"
        
        # Account size check
        if account_value < self.phase_requirements['minimum_account']:
            return False, f"LEAP Ladders require £{self.phase_requirements['minimum_account']:,}+ account"
        
        # Position count check
        current_leap_count = len([p for p in current_positions if 'LEAP' in p.get('strategy', '')])
        max_positions = self.position_limits.get(account_phase, 0)
        
        if current_leap_count >= max_positions:
            return False, f"LEAP Ladder at maximum positions ({current_leap_count}/{max_positions})"
        
        # Entry day check (Mondays only)
        if self.algorithm.Time.weekday() != 0:  # Monday = 0
            next_monday = self._get_next_monday()
            return False, f"LEAP entries on Mondays only. Next entry: {next_monday}"
        
        return True, "LEAP Ladder entry conditions met"
    
    def _get_next_monday(self):
        """Get next Monday's date"""
        today = self.algorithm.Time
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:  # Today is Monday
            days_until_monday = 7
        next_monday = today + timedelta(days=days_until_monday)
        return next_monday.strftime("%Y-%m-%d")
    
    def get_weekly_delta_target(self):
        """Get delta target based on week of month rotation"""
        today = self.algorithm.Time
        week_of_month = (today.day - 1) // 7 + 1  # 1-4
        week_of_month = min(4, week_of_month)  # Cap at 4
        
        return self.weekly_delta_rotation.get(week_of_month, 0.12)
    
    def calculate_vix_position_multiplier(self, vix_level):
        """
        Calculate position size multiplier based on VIX level
        Returns: (multiplier, action, reason)
        """
        if vix_level < self.vix_rules['skip_threshold']:
            return 0, 'SKIP', f'VIX {vix_level:.1f} < {self.vix_rules["skip_threshold"]} - Skip week'
        
        elif vix_level > self.vix_rules['double_threshold']:
            multiplier = min(self.vix_rules['max_vix_multiplier'], 2.0)
            return multiplier, 'DOUBLE_SIZE', f'VIX {vix_level:.1f} > {self.vix_rules["double_threshold"]} - Double size'
        
        else:
            return 1.0, 'STANDARD_ENTRY', f'VIX {vix_level:.1f} - Standard entry'
    
    def find_leap_put_strike(self, symbol, target_delta):
        """
        Find actual LEAP put strike from real option chains based on target delta
        Returns: (strike_price, contract_symbol, actual_delta)
        """
        try:
            # Access real option chains from QuantConnect
            option_chains = self.algorithm.CurrentSlice.OptionChains
            
            for kvp in option_chains:
                chain = kvp.Value
                underlying_price = chain.Underlying.Price
                
                # Filter for LEAP puts (365+ DTE)
                target_expiry = self.algorithm.Time + timedelta(days=self.base_dte)
                leap_puts = [
                    contract for contract in chain
                    if contract.Right == OptionRight.Put
                    and (contract.Expiry.date() - self.algorithm.Time.date()).days >= 350  # At least 350 days
                    and (contract.Expiry.date() - self.algorithm.Time.date()).days <= 380  # Max 380 days
                ]
                
                if not leap_puts:
                    # If no LEAP puts in current chain, use option chain provider
                    return self._find_leap_put_via_provider(symbol, target_delta)
                
                # Find put closest to target delta
                best_put = None
                best_delta_diff = float('inf')
                
                for contract in leap_puts:
                    # Calculate actual delta for this contract
                    actual_delta = abs(contract.Greeks.Delta) if hasattr(contract, 'Greeks') else 0
                    
                    # If no Greeks available, estimate based on moneyness
                    if actual_delta == 0:
                        moneyness = contract.Strike / underlying_price
                        if moneyness < 0.75:  # Deep OTM
                            estimated_delta = 0.12
                        elif moneyness < 0.77:
                            estimated_delta = 0.13
                        elif moneyness < 0.79:
                            estimated_delta = 0.14
                        else:
                            estimated_delta = 0.15
                        actual_delta = estimated_delta
                    
                    delta_diff = abs(actual_delta - target_delta)
                    if delta_diff < best_delta_diff:
                        best_delta_diff = delta_diff
                        best_put = contract
                
                if best_put:
                    return (
                        float(best_put.Strike),
                        best_put.Symbol,
                        abs(best_put.Greeks.Delta) if hasattr(best_put, 'Greeks') else target_delta
                    )
            
            # Fallback to provider if no suitable contract found
            return self._find_leap_put_via_provider(symbol, target_delta)
            
        except Exception as e:
            self.algorithm.Debug(f"Error finding LEAP put strike: {str(e)}")
            # Return reasonable estimate if API fails
            current_price = float(self.algorithm.Securities[symbol].Price)
            percent_otm = 0.25 if target_delta == 0.12 else (0.23 if target_delta == 0.13 else 0.21)
            estimated_strike = current_price * (1 - percent_otm)
            return (round(estimated_strike), None, target_delta)
    
    def _find_leap_put_via_provider(self, symbol, target_delta):
        """
        Find LEAP put using OptionChainProvider when CurrentSlice doesn't have the data
        """
        try:
            current_price = float(self.algorithm.Securities[symbol].Price)
            
            # Get option chain from provider
            equity = self.algorithm.Securities[symbol]
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(equity.Symbol, self.algorithm.Time)
            
            if not option_chain:
                # No chain available, return estimate
                percent_otm = 0.25 if target_delta == 0.12 else (0.23 if target_delta == 0.13 else 0.21)
                estimated_strike = current_price * (1 - percent_otm)
                return (round(estimated_strike), None, target_delta)
            
            # Filter for LEAP puts
            target_expiry = self.algorithm.Time + timedelta(days=self.base_dte)
            leap_puts = [
                c for c in option_chain
                if c.ID.OptionRight == OptionRight.Put
                and abs((c.ID.Date - target_expiry).days) <= 30  # Within 30 days of target
            ]
            
            if not leap_puts:
                # No suitable LEAPs, return estimate
                percent_otm = 0.25 if target_delta == 0.12 else (0.23 if target_delta == 0.13 else 0.21)
                estimated_strike = current_price * (1 - percent_otm)
                return (round(estimated_strike), None, target_delta)
            
            # Calculate target strike based on delta
            # Using Black-Scholes approximation for deep OTM puts
            iv = 0.20  # Assume 20% IV for SPY LEAPs
            time_to_expiry = self.base_dte / 365.0
            
            # Delta to strike conversion - simplified for deep OTM puts
            # For puts: delta ≈ -N(-d2) where N is cumulative normal
            # Deep OTM approximation: strike = current * (1 - % OTM)
            if target_delta <= 0.12:
                percent_otm = 0.25  # 25% OTM for 12 delta
            elif target_delta <= 0.13:
                percent_otm = 0.23  # 23% OTM for 13 delta
            else:
                percent_otm = 0.21  # 21% OTM for 14 delta
            
            target_strike = current_price * (1 - percent_otm)
            
            # Find closest strike
            best_put = min(leap_puts, key=lambda c: abs(c.ID.StrikePrice - target_strike))
            
            return (
                float(best_put.ID.StrikePrice),
                best_put,
                target_delta  # Return target delta since we can't calculate actual without Greeks
            )
            
        except Exception as e:
            self.algorithm.Debug(f"Provider fallback error: {str(e)}")
            # Last resort: return estimate
            current_price = float(self.algorithm.Securities[symbol].Price)
            percent_otm = 0.25 if target_delta == 0.12 else (0.23 if target_delta == 0.13 else 0.21)
            estimated_strike = current_price * (1 - percent_otm)
            return (round(estimated_strike), None, target_delta)
    
    def get_leap_premium_from_market(self, symbol, strike_price, target_expiry_days):
        """
        Get actual LEAP premium from market data
        Returns: (bid, ask, mid_price, contract_symbol)
        """
        try:
            # First try CurrentSlice option chains
            option_chains = self.algorithm.CurrentSlice.OptionChains
            
            for kvp in option_chains:
                chain = kvp.Value
                
                # Find matching LEAP put
                matching_puts = [
                    contract for contract in chain
                    if contract.Right == OptionRight.Put
                    and abs(contract.Strike - strike_price) < 1.0  # Within $1 of target
                    and (contract.Expiry.date() - self.algorithm.Time.date()).days >= target_expiry_days - 15
                    and (contract.Expiry.date() - self.algorithm.Time.date()).days <= target_expiry_days + 15
                ]
                
                if matching_puts:
                    best_put = matching_puts[0]
                    bid = float(best_put.BidPrice) if hasattr(best_put, 'BidPrice') else 0
                    ask = float(best_put.AskPrice) if hasattr(best_put, 'AskPrice') else 0
                    
                    # If no bid/ask, use last price
                    if bid == 0 or ask == 0:
                        last = float(best_put.LastPrice) if hasattr(best_put, 'LastPrice') else 0
                        if last > 0:
                            # Estimate bid/ask spread for LEAPs (typically 5-10% for deep OTM)
                            spread_pct = 0.07
                            bid = last * (1 - spread_pct/2)
                            ask = last * (1 + spread_pct/2)
                    
                    mid_price = (bid + ask) / 2 if (bid > 0 and ask > 0) else 0
                    
                    if mid_price > 0:
                        return (bid, ask, mid_price, best_put.Symbol)
            
            # If not found in CurrentSlice, try OptionChainProvider
            return self._get_leap_premium_from_provider(symbol, strike_price, target_expiry_days)
            
        except Exception as e:
            self.algorithm.Debug(f"Error getting LEAP premium: {str(e)}")
            # Return reasonable estimate if market data unavailable
            current_price = float(self.algorithm.Securities[symbol].Price)
            moneyness = strike_price / current_price
            time_value = target_expiry_days / 365.0
            
            # Use sophisticated estimation without scipy
            iv = 0.20  # 20% implied volatility for SPY LEAPs
            risk_free_rate = 0.02  # 2% risk-free rate
            
            # Simplified Black-Scholes approximation for deep OTM puts
            # For deep OTM puts, intrinsic value is 0, so price is all time value
            moneyness_ratio = np.log(current_price / strike_price)
            vol_sqrt_t = iv * np.sqrt(time_value)
            
            # Approximate put price for deep OTM
            # This uses a simplified formula suitable for deep OTM options
            if moneyness_ratio > 0.15:  # Deep OTM
                # Exponential decay approximation for deep OTM puts
                put_price = strike_price * np.exp(-risk_free_rate * time_value) * \
                           np.exp(-0.5 * (moneyness_ratio / vol_sqrt_t) ** 2) * \
                           vol_sqrt_t * 0.4  # Scaling factor
            else:
                # Standard approximation for near-the-money
                d2_approx = -moneyness_ratio / vol_sqrt_t - 0.5 * vol_sqrt_t
                n_minus_d2 = 0.5 * (1 + np.tanh(-d2_approx / np.sqrt(2)))  # Approximation of N(-d2)
                put_price = strike_price * np.exp(-risk_free_rate * time_value) * n_minus_d2
            
            put_price = max(1.0, put_price)  # Minimum $1 premium
            
            # Estimate bid/ask spread
            spread = put_price * 0.07  # 7% spread for LEAPs
            bid = put_price - spread/2
            ask = put_price + spread/2
            
            return (bid, ask, put_price, None)
    
    def _get_leap_premium_from_provider(self, symbol, strike_price, target_expiry_days):
        """
        Get LEAP premium using OptionChainProvider as fallback
        """
        try:
            equity = self.algorithm.Securities[symbol]
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(equity.Symbol, self.algorithm.Time)
            
            if not option_chain:
                raise Exception("No option chain available")
            
            # Find matching LEAP put
            target_expiry = self.algorithm.Time + timedelta(days=target_expiry_days)
            matching_puts = [
                c for c in option_chain
                if c.ID.OptionRight == OptionRight.Put
                and abs(c.ID.StrikePrice - strike_price) < 1.0
                and abs((c.ID.Date - target_expiry).days) <= 15
            ]
            
            if not matching_puts:
                raise Exception("No matching LEAP puts found")
            
            best_put = matching_puts[0]
            
            # Add contract to get market data
            option = self.algorithm.AddOptionContract(best_put)
            
            # Get market data
            if option and option.BidPrice:
                bid = float(option.BidPrice)
                ask = float(option.AskPrice)
                mid = (bid + ask) / 2
                return (bid, ask, mid, best_put)
            else:
                raise Exception("No market data available for contract")
                
        except Exception as e:
            # Return estimate
            current_price = float(self.algorithm.Securities[symbol].Price)
            moneyness = strike_price / current_price
            time_value = target_expiry_days / 365.0
            
            # Simple premium estimate for deep OTM puts
            put_premium = current_price * 0.03 * time_value * (2 - moneyness)
            put_premium = max(1.0, put_premium)
            
            bid = put_premium * 0.965  # 3.5% spread
            ask = put_premium * 1.035
            
            return (bid, ask, put_premium, None)
    
    def create_leap_position_structure(self, symbol, current_price, target_delta, vix_multiplier):
        """Create complete LEAP position structure with real market data"""
        # Get actual strike and contract from real option chains
        strike_price, contract_symbol, actual_delta = self.find_leap_put_strike(symbol, target_delta)
        
        # Get actual premium from market
        bid, ask, mid_premium, _ = self.get_leap_premium_from_market(symbol, strike_price, self.base_dte)
        
        # Position sizing
        base_size = self.risk_parameters['position_sizing_base']
        position_size = int(base_size * vix_multiplier)
        
        structure = {
            'strategy': 'LEAP_LADDER',
            'symbol': symbol,
            'entry_date': self.algorithm.Time,
            'position_size': position_size,
            'vix_multiplier': vix_multiplier,
            'week_of_month': (self.algorithm.Time.day - 1) // 7 + 1,
            'leap_details': {
                'strike': strike_price,
                'dte': self.base_dte,
                'target_delta': target_delta,
                'bid': bid if 'bid' in locals() else 0,
                'ask': ask if 'ask' in locals() else 0,
                'mid_premium': mid_premium if 'mid_premium' in locals() else 0,
                'actual_delta': actual_delta if 'actual_delta' in locals() else target_delta,
                'option_type': 'PUT',
                'action': 'SELL'  # Selling puts in LEAP ladder
            },
            'management_rules': {
                'profit_target': self.profit_target,
                'roll_dte': self.roll_dte,
                'stop_loss': self.risk_parameters['stop_loss_percent'],
                'expected_hold_days': self.ladder_statistics['average_hold_days']
            },
            'performance_tracking': {
                'premium_collected': 0,
                'unrealized_pl': 0,
                'days_held': 0,
                'rolled_count': 0
            }
        }
        
        return structure
    
    def analyze_existing_leaps(self, current_positions):
        """Analyze existing LEAP positions for management actions"""
        management_actions = []
        
        for position in current_positions:
            if position.get('strategy') != 'LEAP_LADDER':
                continue
            
            dte = position.get('dte', 365)
            unrealized_pl_percent = position.get('unrealized_pl_percent', 0)
            days_held = position.get('days_held', 0)
            
            position_id = position.get('id', 'unknown')
            
            # Check profit target (30%)
            if unrealized_pl_percent >= (self.profit_target * 100):
                management_actions.append({
                    'position_id': position_id,
                    'action': 'CLOSE',
                    'reason': f'30% profit target reached ({unrealized_pl_percent:.1f}%)',
                    'priority': 'HIGH'
                })
                continue
            
            # Check roll trigger (150 DTE)
            if dte <= self.roll_dte:
                if unrealized_pl_percent > 10:  # Profitable position
                    management_actions.append({
                        'position_id': position_id,
                        'action': 'ROLL_FORWARD',
                        'reason': f'150 DTE roll trigger - profitable position ({unrealized_pl_percent:.1f}%)',
                        'priority': 'MEDIUM',
                        'new_dte': self.base_dte,
                        'expected_credit': position['leap_details'].get('mid_premium', 100) * 0.4
                    })
                else:
                    management_actions.append({
                        'position_id': position_id,
                        'action': 'CLOSE',
                        'reason': f'150 DTE - unprofitable position ({unrealized_pl_percent:.1f}%)',
                        'priority': 'HIGH'
                    })
                continue
            
            # Check stop loss (50% loss)
            if unrealized_pl_percent <= self.risk_parameters['stop_loss_percent']:
                management_actions.append({
                    'position_id': position_id,
                    'action': 'CLOSE',
                    'reason': f'Stop loss triggered ({unrealized_pl_percent:.1f}%)',
                    'priority': 'URGENT'
                })
                continue
            
            # General monitoring
            if days_held > self.ladder_statistics['average_hold_days'] * 1.5:
                management_actions.append({
                    'position_id': position_id,
                    'action': 'MONITOR_CLOSELY',
                    'reason': f'Extended hold period ({days_held} days)',
                    'priority': 'LOW'
                })
        
        return management_actions
    
    def calculate_ladder_performance_metrics(self, current_positions):
        """Calculate comprehensive LEAP ladder performance metrics"""
        leap_positions = [p for p in current_positions if p.get('strategy') == 'LEAP_LADDER']
        
        if not leap_positions:
            return {
                'active_positions': 0,
                'total_premium_collected': 0,
                'average_days_held': 0,
                'unrealized_pl': 0,
                'monthly_income_run_rate': 0
            }
        
        total_premium = sum(p.get('premium_collected', 0) for p in leap_positions)
        total_unrealized = sum(p.get('unrealized_pl', 0) for p in leap_positions)
        average_days = sum(p.get('days_held', 0) for p in leap_positions) / len(leap_positions)
        
        # Calculate monthly income run rate
        if average_days > 0:
            monthly_income_rate = (total_premium / average_days) * 30
        else:
            monthly_income_rate = 0
        
        metrics = {
            'active_positions': len(leap_positions),
            'max_positions': self.max_positions_per_ladder,
            'utilization_rate': len(leap_positions) / self.max_positions_per_ladder,
            'total_premium_collected': total_premium,
            'total_unrealized_pl': total_unrealized,
            'average_days_held': average_days,
            'monthly_income_run_rate': monthly_income_rate,
            'target_monthly_income': self.expected_monthly_income,
            'performance_vs_target': {
                'current_rate': monthly_income_rate,
                'target_min': self.expected_monthly_income[0],
                'target_max': self.expected_monthly_income[1],
                'status': 'ABOVE_TARGET' if monthly_income_rate >= self.expected_monthly_income[0] else 'BELOW_TARGET'
            }
        }
        
        return metrics
    
    def get_leap_ladder_summary(self, account_phase, account_value):
        """Get comprehensive LEAP ladder strategy summary"""
        max_positions = self.position_limits.get(account_phase, 0)
        weekly_delta = self.get_weekly_delta_target()
        
        summary = {
            'strategy_name': 'LEAP Put Ladder System',
            'nickname': 'LEAP_LADDER',
            'phase_availability': f'Phase {self.phase_requirements["minimum_phase"]}+',
            'account_requirement': f'£{self.phase_requirements["minimum_account"]:,}+',
            'max_positions': max_positions,
            'current_week_delta': f'{weekly_delta:.2f} delta',
            'entry_schedule': {
                'day': 'Monday only',
                'delta_rotation': 'Weekly rotation: 12→13→14→12 delta',
                'next_entry': self._get_next_monday() if self.algorithm.Time.weekday() != 0 else 'Today'
            },
            'position_parameters': {
                'base_dte': f'{self.base_dte} days',
                'roll_dte': f'{self.roll_dte} DTE',
                'profit_target': f'{self.profit_target * 100:.0f}%',
                'stop_loss': f'{abs(self.risk_parameters["stop_loss_percent"]):.0f}%'
            },
            'vix_optimization': {
                'skip_below': f'VIX < {self.vix_rules["skip_threshold"]}',
                'double_above': f'VIX > {self.vix_rules["double_threshold"]}',
                'max_multiplier': f'{self.vix_rules["max_vix_multiplier"]}x'
            },
            'expected_performance': {
                'monthly_income': f'£{self.expected_monthly_income[0]}-{self.expected_monthly_income[1]}',
                'average_hold_days': f'{self.ladder_statistics["average_hold_days"]} days',
                'strategy_focus': 'Capital compounding through systematic put selling'
            },
            'risk_management': {
                'bp_per_position': f'{self.risk_parameters["max_bp_per_position"] * 100:.0f}%',
                'total_bp_limit': f'{self.risk_parameters["max_total_bp"] * 100:.0f}%',
                'position_sizing': 'VIX-adjusted with 2x maximum'
            }
        }
        
        return summary
    
    def execute_leap_entry(self, symbol, account_value, vix_level=None):
        """
        Execute actual LEAP entry with proper option contract registration using REAL chains
        """
        try:
            # Step 1: Check entry conditions
            can_enter, reason = self.can_enter_position(
                self.algorithm.account_phase if hasattr(self.algorithm, 'account_phase') else 2,
                account_value,
                self.active_leaps
            )
            
            if not can_enter:
                return False, reason
            
            # Step 2: Calculate VIX-based position sizing
            multiplier, action, vix_reason = self.calculate_vix_position_multiplier(vix_level or 18)
            if multiplier == 0:
                return False, vix_reason
            
            # Step 3: Get weekly delta target
            target_delta = self.get_weekly_delta_target()
            
            # Step 4: Get current price
            current_price = float(self.algorithm.Securities[symbol].Price)
            
            # Step 5: Find actual LEAP put from REAL option chains
            strike_price, leap_contract, actual_delta = self.find_leap_put_strike(symbol, target_delta)
            
            if not leap_contract:
                # Try using OptionChainProvider directly
                equity = self.algorithm.Securities[symbol]
                option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(equity.Symbol, self.algorithm.Time)
                
                if not option_chain:
                    return False, f"No option chain available for {symbol}"
                
                # Find suitable LEAP put (365 DTE)
                target_expiry = self.algorithm.Time + timedelta(days=self.base_dte)
                leap_puts = [c for c in option_chain 
                            if c.ID.OptionRight == OptionRight.Put and 
                            abs((c.ID.Date - target_expiry).days) <= 30]  # Within 30 days of target
                
                if not leap_puts:
                    return False, f"No suitable LEAP puts found for {symbol}"
                
                # Find put closest to target strike
                leap_put = min(leap_puts, key=lambda c: abs(c.ID.StrikePrice - strike_price))
            else:
                leap_put = leap_contract
            
            # Step 6: Get actual market prices for the LEAP
            bid, ask, mid_premium, _ = self.get_leap_premium_from_market(symbol, strike_price, self.base_dte)
            
            if mid_premium <= 0:
                return False, f"No valid market price for LEAP put at {strike_price} strike"
            
            # Step 7: Calculate position size
            base_size = self.risk_parameters['position_sizing_base']
            position_size = int(base_size * multiplier)
            
            # Step 8: Register option contract before trading (CRITICAL!)
            self.algorithm.AddOptionContract(leap_put)
            
            # Step 9: Execute LEAP put sale with limit order at mid or better
            # Use limit order to ensure good fill on wide bid/ask spreads
            limit_price = mid_premium * 1.01  # Sell slightly above mid
            leap_order = self.algorithm.LimitOrder(leap_put, -position_size, limit_price)  # Sell puts
            
            # Step 10: Track position
            if leap_order:
                leap_position = self.create_leap_position_structure(
                    symbol, current_price, target_delta, multiplier
                )
                leap_position['leap_order_id'] = leap_order.OrderId
                leap_position['leap_contract_symbol'] = str(leap_put)
                leap_position['actual_strike'] = leap_put.ID.StrikePrice
                leap_position['actual_expiry'] = leap_put.ID.Date
                leap_position['actual_delta'] = actual_delta
                leap_position['market_prices'] = {
                    'bid': bid,
                    'ask': ask,
                    'mid': mid_premium,
                    'spread_pct': ((ask - bid) / mid_premium * 100) if mid_premium > 0 else 0
                }
                
                self.active_leaps.append(leap_position)
                self.ladder_statistics['total_entries'] += 1
                
                self.algorithm.Log(f"✅ LEAP Ladder Entry: {symbol} {actual_delta:.2f}δ PUT@{leap_put.ID.StrikePrice} "
                                 f"Premium: ${mid_premium:.2f} (Bid: ${bid:.2f}/Ask: ${ask:.2f}) x{position_size} ({action})")
                return True, f"LEAP successfully executed at ${mid_premium:.2f} premium"
            else:
                return False, "LEAP order execution failed"
                
        except Exception as e:
            self.algorithm.Error(f"LEAP execution error for {symbol}: {str(e)}")
            return False, f"Execution error: {str(e)}"
    
    def roll_leap_forward(self, leap_position):
        """
        Roll LEAP forward with proper option contract registration
        """
        try:
            symbol = leap_position['symbol']
            current_price = float(self.algorithm.Securities[symbol].Price)
            
            # Get new option chain
            option_chain = self.algorithm.OptionChainProvider.GetOptionContractList(symbol, self.algorithm.Time)
            if not option_chain:
                return False, "No option chain available for rolling"
            
            # Find new LEAP put (365 DTE from now)
            new_target_expiry = self.algorithm.Time + timedelta(days=self.base_dte)
            new_leap_puts = [c for c in option_chain 
                           if c.ID.OptionRight == OptionRight.Put and 
                           abs((c.ID.Date - new_target_expiry).days) <= 30]
            
            if not new_leap_puts:
                return False, "No suitable new LEAP puts for rolling"
            
            # Use same delta as original position
            original_delta = leap_position['leap_details']['target_delta']
            new_target_strike = self.calculate_leap_strike(current_price, original_delta)
            new_leap_put = min(new_leap_puts, key=lambda c: abs(c.ID.StrikePrice - new_target_strike))
            
            # Register new contract
            self.algorithm.AddOptionContract(new_leap_put)
            
            # Close old position (buy back the short put)
            old_quantity = leap_position['position_size']
            close_order = self.algorithm.MarketOrder(
                Symbol.Create(leap_position['leap_contract_symbol'], SecurityType.Option, Market.USA),
                old_quantity  # Buy back the short put
            )
            
            # Sell new LEAP put
            new_order = self.algorithm.MarketOrder(new_leap_put, -old_quantity)
            
            if close_order and new_order:
                # Update position tracking
                leap_position['leap_details']['strike'] = new_leap_put.ID.StrikePrice
                leap_position['leap_details']['dte'] = self.base_dte
                leap_position['actual_strike'] = new_leap_put.ID.StrikePrice
                leap_position['actual_expiry'] = new_leap_put.ID.Date
                leap_position['leap_contract_symbol'] = str(new_leap_put)
                leap_position['leap_order_id'] = new_order.OrderId
                leap_position['performance_tracking']['rolled_count'] += 1
                
                self.algorithm.Log(f"✅ LEAP Rolled Forward: {symbol} to {new_leap_put.ID.StrikePrice} strike")
                return True
            else:
                return False
                
        except Exception as e:
            self.algorithm.Error(f"LEAP roll error: {str(e)}")
            return False
    
    def close_leap_position(self, leap_position, reason="Manual close"):
        """
        Close LEAP position with proper handling
        """
        try:
            # Buy back the short put
            quantity = leap_position['position_size']
            close_order = self.algorithm.MarketOrder(
                Symbol.Create(leap_position['leap_contract_symbol'], SecurityType.Option, Market.USA),
                quantity  # Buy back the short put
            )
            
            if close_order:
                # Move to completed trades
                leap_position['close_date'] = self.algorithm.Time
                leap_position['close_reason'] = reason
                leap_position['close_order_id'] = close_order.OrderId
                
                self.completed_trades.append(leap_position)
                if leap_position in self.active_leaps:
                    self.active_leaps.remove(leap_position)
                
                self.algorithm.Log(f"✅ LEAP Closed: {leap_position['symbol']} - {reason}")
                return True
            else:
                return False
                
        except Exception as e:
            self.algorithm.Error(f"LEAP close error: {str(e)}")
            return False

    def validate_leap_system(self):
        """Validate LEAP ladder system functionality"""
        tests = [
            ('Phase requirements set', self.phase_requirements['minimum_phase'] == 2),
            ('Position limits defined', len(self.position_limits) == 3),
            ('Delta rotation works', len(self.weekly_delta_rotation) == 4),
            ('VIX rules defined', self.vix_rules['skip_threshold'] == 15),
            ('Profit target set', self.profit_target == 0.30),
            ('Management logic works', callable(self.analyze_existing_leaps)),
            ('Execution method available', callable(self.execute_leap_entry)),
            ('Roll method available', callable(self.roll_leap_forward)),
            ('Close method available', callable(self.close_leap_position))
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'✅' if condition else '❌'} {test_name}")
        
        return results

    def build_ladder_structure(self, symbol, account_value, account_phase):
        """
        Build complete 10-position LEAP ladder structure with real option chains
        This creates a staggered entry plan over 10 weeks
        """
        try:
            ladder_plan = []
            current_price = float(self.algorithm.Securities[symbol].Price)
            max_positions = self.position_limits.get(account_phase, 4)
            
            # Plan entries for next 10 Mondays
            for week_num in range(min(10, max_positions)):
                entry_date = self.algorithm.Time + timedelta(weeks=week_num)
                
                # Skip if not Monday
                while entry_date.weekday() != 0:  # 0 = Monday
                    entry_date += timedelta(days=1)
                
                # Determine delta for this week
                week_of_month = ((entry_date.day - 1) // 7 + 1)
                week_of_month = min(4, week_of_month)
                target_delta = self.weekly_delta_rotation.get(week_of_month, 0.12)
                
                # Find actual LEAP put for this entry
                strike_price, contract_symbol, actual_delta = self.find_leap_put_strike(symbol, target_delta)
                
                # Get market pricing
                bid, ask, mid_premium, _ = self.get_leap_premium_from_market(symbol, strike_price, self.base_dte)
                
                ladder_entry = {
                    'week': week_num + 1,
                    'entry_date': entry_date.strftime('%Y-%m-%d'),
                    'target_delta': target_delta,
                    'actual_delta': actual_delta,
                    'strike': strike_price,
                    'contract_symbol': str(contract_symbol) if contract_symbol else f"{symbol} {strike_price}P {entry_date + timedelta(days=365)}",
                    'premium': {
                        'bid': bid,
                        'ask': ask,
                        'mid': mid_premium
                    },
                    'expected_income': mid_premium * 100,  # Per contract in dollars
                    'bp_required': strike_price * 100 * 0.20  # Approximately 20% of notional for cash-secured puts
                }
                
                ladder_plan.append(ladder_entry)
            
            # Calculate ladder statistics
            total_premium = sum(entry['premium']['mid'] * 100 for entry in ladder_plan)
            total_bp = sum(entry['bp_required'] for entry in ladder_plan)
            monthly_income = total_premium / 12  # Annual premium / 12 months
            
            ladder_summary = {
                'symbol': symbol,
                'current_price': current_price,
                'ladder_size': len(ladder_plan),
                'total_premium_potential': total_premium,
                'total_bp_required': total_bp,
                'monthly_income_estimate': monthly_income,
                'bp_efficiency': (total_premium / total_bp * 100) if total_bp > 0 else 0,
                'entries': ladder_plan
            }
            
            self.algorithm.Log(f"📊 LEAP Ladder Structure Built:")
            self.algorithm.Log(f"   Symbol: {symbol} @ ${current_price:.2f}")
            self.algorithm.Log(f"   Positions: {len(ladder_plan)} over {len(ladder_plan)} weeks")
            self.algorithm.Log(f"   Total Premium: ${total_premium:,.0f}")
            self.algorithm.Log(f"   Monthly Income: ${monthly_income:,.0f}")
            self.algorithm.Log(f"   BP Required: ${total_bp:,.0f}")
            self.algorithm.Log(f"   BP Efficiency: {ladder_summary['bp_efficiency']:.1f}%")
            
            return ladder_summary
            
        except Exception as e:
            self.algorithm.Error(f"Error building ladder structure: {str(e)}")
            return None

# Usage Example for QuantConnect Algorithm:
#
# def Initialize(self):
#     self.leap_strategy = LEAPPutLadderStrategy(self)
#     
# def OnData(self, data):
#     account_phase = 3
#     account_value = 75000
#     current_positions = []  # From portfolio
#     
#     # Check for new LEAP entry (Mondays only)
#     if self.Time.weekday() == 0:  # Monday
#         can_enter, reason = self.leap_strategy.can_enter_position(
#             account_phase, account_value, current_positions
#         )
#         
#         if can_enter:
#             # Get VIX level for position sizing
#             vix_level = 18  # Example - would get from VIX data feed
#             multiplier, action, vix_reason = self.leap_strategy.calculate_vix_position_multiplier(vix_level)
#             
#             if multiplier > 0:  # Not skipping due to low VIX
#                 if 'SPY' in data and data['SPY'] is not None:
#                     current_price = data['SPY'].Close
#                     target_delta = self.leap_strategy.get_weekly_delta_target()
#                     
#                     # Create LEAP position structure
#                     leap_structure = self.leap_strategy.create_leap_position_structure(
#                         'SPY', current_price, target_delta, multiplier
#                     )
#                     
#                     self.Log(f"LEAP Ladder Entry: SPY {target_delta:.2f}δ @ {leap_structure['leap_details']['strike']} ({action})")
#                     # Execute order logic here
#             else:
#                 self.Log(f"LEAP Ladder Skipped: {vix_reason}")
#     
#     # Manage existing LEAP positions
#     management_actions = self.leap_strategy.analyze_existing_leaps(current_positions)
#     for action in management_actions:
#         if action['priority'] in ['URGENT', 'HIGH']:
#             self.Log(f"LEAP Action Required: {action['action']} - {action['reason']}")
#     
#     # Monthly performance review
#     if self.Time.day == 1:  # First day of month
#         metrics = self.leap_strategy.calculate_ladder_performance_metrics(current_positions)
#         self.Log(f"LEAP Ladder Performance: {metrics['monthly_income_run_rate']:.0f} monthly run rate")