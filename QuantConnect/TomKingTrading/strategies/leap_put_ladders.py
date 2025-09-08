# LEAP Put Ladders Strategy - Tom King Framework v17
# Capital compounding system with deep OTM LEAP puts
# Weekly Monday entries building to 10-position ladder

from AlgorithmImports import *
from datetime import datetime, timedelta
import math

class LEAPPutLaddersStrategy:
    """
    Tom King Framework v17 LEAP Put Ladders Strategy
    
    Key Specifications:
    - Entry: Every Monday (staggered approach)
    - DTE: 365 days initial, roll at 150 DTE
    - Delta: 12-14 delta (deep OTM puts)
    - Size: 10 positions maximum per ladder
    - Management: 30% profit target
    - Phase Requirement: Phase 4+ (£75k+)
    - Product: SPY primary, QQQ secondary
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Tom King Framework Parameters
        self.target_dte_entry = 365     # 1 year initial
        self.roll_dte_threshold = 150   # Roll at 150 DTE
        self.target_delta = 13          # 12-14 delta (deep OTM)
        self.max_ladder_positions = 10  # Maximum 10 ladder rungs
        self.profit_target = 0.30       # 30% profit target
        self.phase_requirement = 4      # Phase 4+ (£75k+)
        
        # Position tracking
        self.ladder_positions = {}      # Active LEAP positions
        self.ladder_entry_prices = {}   # Entry prices for profit calculation
        self.ladder_count = 0          # Current number of ladder rungs
        self.next_rung_number = 1      # Next rung to add
        
        # Performance tracking
        self.total_ladder_trades = 0
        self.profitable_ladder_trades = 0
        self.total_ladder_pnl = 0
        self.weekly_entries = 0
        
        # Entry timing control
        self.last_entry_week = None
        self.entry_attempted_today = False
        
        # Risk management
        self.max_allocation_per_rung = 0.02  # 2% of portfolio per LEAP
        
        self.algo.Log("LEAP Put Ladders Strategy Initialized")
        self.algo.Log(f"  Target Delta: {self.target_delta} (deep OTM)")
        self.algo.Log(f"  Max Positions: {self.max_ladder_positions}")
        self.algo.Log(f"  Profit Target: {self.profit_target:.0%}")
        self.algo.Log(f"  Phase Requirement: {self.phase_requirement}+ (£75k+)")
    
    def CheckMondayEntry(self):
        """Check for Monday LEAP ladder entry opportunities"""
        # Only execute on Mondays
        if self.algo.Time.weekday() != 0:  # 0 = Monday
            return
        
        # Reset daily flag
        if not hasattr(self, 'entry_attempted_today') or self.algo.Time.date() != getattr(self, 'last_entry_date', None):
            self.entry_attempted_today = False
            self.last_entry_date = self.algo.Time.date()
        
        # Don't attempt multiple entries on same day
        if self.entry_attempted_today:
            return
        
        self.entry_attempted_today = True
        
        # Phase requirement check (Phase 4+ = £75k+)
        current_phase = getattr(self.algo, 'current_phase', 4)
        if current_phase < self.phase_requirement:
            self.algo.Log(f"LEAP Ladders SKIPPED - Phase {current_phase} < required Phase {self.phase_requirement}")
            return
        
        # Check if ladder is already full
        if self.ladder_count >= self.max_ladder_positions:
            self.algo.Log(f"LEAP Ladder FULL - {self.ladder_count}/{self.max_ladder_positions} positions")
            return
        
        # VIX regime check - prefer normal to slightly elevated volatility
        current_vix = getattr(self.algo, 'current_vix', 20)
        if current_vix < 15:
            self.algo.Log(f"LEAP Ladders SKIPPED - VIX too low: {current_vix:.1f} (need >15 for put premiums)")
            return
        
        if current_vix > 35:
            self.algo.Log(f"LEAP Ladders SKIPPED - VIX too high: {current_vix:.1f} (avoid extreme volatility)")
            return
        
        # Buying power check
        bp_used = getattr(self.algo, 'GetBuyingPowerUsedPercent', lambda: 0.5)()
        if bp_used > 0.70:  # Conservative for LEAPs
            self.algo.Log(f"LEAP Ladders SKIPPED - BP used: {bp_used:.1%} (need <70%)")
            return
        
        # Market condition check - prefer slight weakness for put entries
        self.EvaluateLadderEntry()
    
    def EvaluateLadderEntry(self):
        """Evaluate and execute LEAP ladder entry"""
        # Primary: SPY, Secondary: QQQ (if SPY ladder full)
        symbols_priority = ['SPY', 'QQQ']
        
        for symbol_str in symbols_priority:
            if self.CanAddRungToSymbol(symbol_str):
                success = self.AddLadderRung(symbol_str)
                if success:
                    break  # Only add one rung per Monday
    
    def CanAddRungToSymbol(self, symbol_str):
        """Check if we can add another rung to this symbol's ladder"""
        # Count existing positions for this symbol
        symbol_positions = sum(1 for pos_id, pos_data in self.ladder_positions.items() 
                              if pos_data.get('symbol') == symbol_str)
        
        # Allow up to 7 positions per symbol (SPY primary focus)
        max_per_symbol = 7 if symbol_str == 'SPY' else 3
        return symbol_positions < max_per_symbol
    
    def AddLadderRung(self, symbol_str):
        """Add a new rung to the LEAP put ladder"""
        try:
            # Get options chain
            underlying = self.algo.Securities[symbol_str]
            contracts = self.algo.OptionChainProvider.GetOptionContractList(underlying.Symbol, self.algo.Time)
            
            # Filter for LEAP puts (350-380 DTE for 365 target)
            leap_puts = [c for c in contracts 
                        if c.ID.OptionRight == OptionRight.Put and 
                        350 <= (c.ID.Date - self.algo.Time).days <= 380]
            
            if len(leap_puts) < 5:
                self.algo.Log(f"Insufficient LEAP puts for {symbol_str} (found {len(leap_puts)})")
                return False
            
            # Get current underlying price
            current_price = underlying.Price
            
            # Calculate 12-14 delta strike (approximately 25-30% OTM for SPY LEAPs)
            # Delta approximation: 12-14 delta ≈ 25-30% OTM for 1-year options
            target_strike_ratio = 0.72  # 28% OTM (middle of range)
            target_strike = current_price * target_strike_ratio
            
            # Find closest strike to target delta
            leap_puts.sort(key=lambda x: x.ID.StrikePrice)
            selected_put = min(leap_puts, key=lambda x: abs(x.ID.StrikePrice - target_strike))
            
            # Verify strike is sufficiently OTM (at least 20% OTM)
            strike_ratio = selected_put.ID.StrikePrice / current_price
            if strike_ratio > 0.85:  # Less than 15% OTM
                self.algo.Log(f"LEAP strike too close to current price: {strike_ratio:.1%} OTM")
                return False
            
            # Calculate position size (2% of portfolio per LEAP)
            portfolio_value = self.algo.Portfolio.TotalPortfolioValue
            position_value = portfolio_value * self.max_allocation_per_rung
            
            # Estimate LEAP price (simplified - would use Black-Scholes in production)
            estimated_leap_price = current_price * 0.08  # Rough estimate for deep OTM LEAP
            contracts_to_buy = max(1, int(position_value / (estimated_leap_price * 100)))
            contracts_to_buy = min(contracts_to_buy, 5)  # Cap at 5 contracts per rung
            
            # Execute LEAP purchase
            ticket = self.algo.Buy(selected_put.Symbol, contracts_to_buy)
            
            if ticket:
                # Track position
                rung_id = f"{symbol_str}_LEAP_RUNG_{self.next_rung_number:02d}"
                
                self.ladder_positions[rung_id] = {
                    'symbol': symbol_str,
                    'option_symbol': selected_put.Symbol,
                    'strike': selected_put.ID.StrikePrice,
                    'expiry': selected_put.ID.Date.date(),
                    'contracts': contracts_to_buy,
                    'entry_time': self.algo.Time,
                    'entry_price': current_price,
                    'rung_number': self.next_rung_number,
                    'dte_at_entry': (selected_put.ID.Date - self.algo.Time).days,
                    'estimated_delta': 13  # Target delta
                }
                
                # Store entry price for profit calculation
                self.ladder_entry_prices[rung_id] = estimated_leap_price
                
                # Update counters
                self.ladder_count += 1
                self.next_rung_number += 1
                self.weekly_entries += 1
                self.total_ladder_trades += 1
                
                # Update correlation tracking if available
                if hasattr(self.algo, 'correlation_positions'):
                    corr_group = 'A1'  # Both SPY and QQQ are in equities group
                    self.algo.correlation_positions[corr_group].append(rung_id)
                
                self.algo.Log(f"LEAP LADDER RUNG ADDED: {rung_id}")
                self.algo.Log(f"  Symbol: {symbol_str} | Strike: ${selected_put.ID.StrikePrice:.0f}")
                self.algo.Log(f"  Contracts: {contracts_to_buy} | Underlying: ${current_price:.2f}")
                self.algo.Log(f"  OTM: {strike_ratio:.1%} | DTE: {(selected_put.ID.Date - self.algo.Time).days}")
                self.algo.Log(f"  Ladder Progress: {self.ladder_count}/{self.max_ladder_positions} rungs")
                
                # Update strategy performance tracking
                if hasattr(self.algo, 'strategy_performance'):
                    self.algo.strategy_performance['LEAP_LADDER']['trades'] += 1
                
                return True
            
            else:
                self.algo.Log(f"Failed to execute LEAP purchase for {symbol_str}")
                return False
                
        except Exception as e:
            self.algo.Log(f"Error adding LEAP ladder rung for {symbol_str}: {str(e)}")
            return False
    
    def CheckLadderManagement(self):
        """Check all ladder positions for management opportunities"""
        for rung_id, position_data in list(self.ladder_positions.items()):
            self.CheckRungManagement(rung_id, position_data)
    
    def CheckRungManagement(self, rung_id, position_data):
        """Check individual ladder rung for management"""
        try:
            # Calculate current DTE
            current_dte = (position_data['expiry'] - self.algo.Time.date()).days
            
            # Roll at 150 DTE threshold
            if current_dte <= self.roll_dte_threshold:
                self.RollLadderRung(rung_id, position_data, "150 DTE Roll")
                return
            
            # Check 30% profit target
            if self.CheckProfitTarget(rung_id, position_data):
                return  # Position closed for profit
            
            # Emergency management for extreme market moves
            self.CheckEmergencyManagement(rung_id, position_data)
            
        except Exception as e:
            self.algo.Log(f"Error managing LEAP rung {rung_id}: {str(e)}")
    
    def CheckProfitTarget(self, rung_id, position_data):
        """Check if position has hit 30% profit target"""
        try:
            current_price = self.algo.Securities[position_data['option_symbol']].Price
            entry_price = self.ladder_entry_prices.get(rung_id, current_price)
            
            if entry_price > 0:
                profit_percent = (current_price - entry_price) / entry_price
                
                if profit_percent >= self.profit_target:
                    self.CloseLadderRung(rung_id, position_data, f"Profit Target Hit ({profit_percent:.1%})")
                    return True
                    
            return False
            
        except:
            return False
    
    def CheckEmergencyManagement(self, rung_id, position_data):
        """Check for emergency management conditions"""
        try:
            current_underlying_price = self.algo.Securities[position_data['symbol']].Price
            entry_underlying_price = position_data['entry_price']
            
            # Emergency close if underlying drops significantly toward strike
            strike_distance = (current_underlying_price - position_data['strike']) / current_underlying_price
            
            # If underlying within 10% of strike, consider emergency management
            if strike_distance < 0.10:
                current_dte = (position_data['expiry'] - self.algo.Time.date()).days
                
                # More urgent if closer to expiration
                if current_dte < 90 and strike_distance < 0.05:
                    self.CloseLadderRung(rung_id, position_data, "Emergency - ITM Risk")
                elif current_dte < 30:
                    self.RollLadderRung(rung_id, position_data, "Emergency Roll - Time Decay")
                    
        except Exception as e:
            self.algo.Log(f"Error in emergency management for {rung_id}: {str(e)}")
    
    def RollLadderRung(self, rung_id, position_data, reason):
        """Roll LEAP ladder rung to new expiration"""
        try:
            # Close current position
            close_ticket = self.algo.Sell(position_data['option_symbol'], position_data['contracts'])
            
            if close_ticket:
                self.algo.Log(f"LEAP RUNG ROLLED: {rung_id}")
                self.algo.Log(f"  Reason: {reason}")
                
                # Clean up current position
                self.CleanupRungTracking(rung_id, position_data, "Roll")
                
                # Immediately try to add new rung (staggered approach maintains ladder)
                symbol_str = position_data['symbol']
                self.AddLadderRung(symbol_str)
                
        except Exception as e:
            self.algo.Log(f"Error rolling LEAP rung {rung_id}: {str(e)}")
    
    def CloseLadderRung(self, rung_id, position_data, reason):
        """Close LEAP ladder rung position"""
        try:
            # Execute sell order
            ticket = self.algo.Sell(position_data['option_symbol'], position_data['contracts'])
            
            if ticket:
                # Calculate P&L
                current_price = self.algo.Securities[position_data['option_symbol']].Price
                entry_price = self.ladder_entry_prices.get(rung_id, current_price)
                
                pnl_per_contract = (current_price - entry_price) * 100  # Options multiplier
                total_pnl = pnl_per_contract * position_data['contracts']
                
                self.total_ladder_pnl += total_pnl
                
                if total_pnl > 0:
                    self.profitable_ladder_trades += 1
                    
                    # Update strategy performance
                    if hasattr(self.algo, 'strategy_performance'):
                        self.algo.strategy_performance['LEAP_LADDER']['wins'] += 1
                        self.algo.strategy_performance['LEAP_LADDER']['total_pnl'] += total_pnl
                
                days_held = (self.algo.Time - position_data['entry_time']).days
                
                self.algo.Log(f"LEAP RUNG CLOSED: {rung_id}")
                self.algo.Log(f"  Reason: {reason}")
                self.algo.Log(f"  P&L: ${total_pnl:+.2f} | Days Held: {days_held}")
                self.algo.Log(f"  Strike: ${position_data['strike']:.0f} | Underlying: ${self.algo.Securities[position_data['symbol']].Price:.2f}")
                
                # Clean up tracking
                self.CleanupRungTracking(rung_id, position_data, "Close")
                
        except Exception as e:
            self.algo.Log(f"Error closing LEAP rung {rung_id}: {str(e)}")
    
    def CleanupRungTracking(self, rung_id, position_data, action):
        """Clean up position tracking after close/roll"""
        try:
            # Update ladder count
            self.ladder_count = max(0, self.ladder_count - 1)
            
            # Remove from tracking dictionaries
            if rung_id in self.ladder_positions:
                del self.ladder_positions[rung_id]
                
            if rung_id in self.ladder_entry_prices:
                del self.ladder_entry_prices[rung_id]
            
            # Clean up correlation tracking
            if hasattr(self.algo, 'correlation_positions'):
                for group, positions in self.algo.correlation_positions.items():
                    if rung_id in positions:
                        positions.remove(rung_id)
            
            self.algo.Log(f"  Ladder Count Updated: {self.ladder_count}/{self.max_ladder_positions} after {action}")
            
        except Exception as e:
            self.algo.Log(f"Error cleaning up rung tracking for {rung_id}: {str(e)}")
    
    def GetLadderHealthReport(self):
        """Generate health report for all ladder positions"""
        if not self.ladder_positions:
            return "No active LEAP ladder positions"
        
        report_lines = []
        report_lines.append(f"LEAP LADDER STATUS ({self.ladder_count} positions):")
        
        total_unrealized_pnl = 0
        
        for rung_id, position_data in self.ladder_positions.items():
            try:
                current_dte = (position_data['expiry'] - self.algo.Time.date()).days
                current_price = self.algo.Securities[position_data['option_symbol']].Price
                entry_price = self.ladder_entry_prices.get(rung_id, current_price)
                
                unrealized_pnl = (current_price - entry_price) * 100 * position_data['contracts']
                total_unrealized_pnl += unrealized_pnl
                
                underlying_price = self.algo.Securities[position_data['symbol']].Price
                strike_distance = (underlying_price - position_data['strike']) / underlying_price
                
                health_status = "HEALTHY"
                if current_dte < 90:
                    health_status = "WATCH" if strike_distance > 0.15 else "CAUTION"
                if current_dte < 30:
                    health_status = "URGENT"
                
                report_lines.append(f"  {rung_id}: ${unrealized_pnl:+.0f} | {current_dte}DTE | {health_status}")
                
            except Exception as e:
                report_lines.append(f"  {rung_id}: ERROR - {str(e)}")
        
        report_lines.append(f"Total Unrealized P&L: ${total_unrealized_pnl:+.2f}")
        report_lines.append(f"Realized P&L: ${self.total_ladder_pnl:+.2f}")
        
        win_rate = (self.profitable_ladder_trades / max(1, self.total_ladder_trades)) * 100
        report_lines.append(f"Win Rate: {win_rate:.1f}% ({self.profitable_ladder_trades}/{self.total_ladder_trades})")
        
        return "\n".join(report_lines)
    
    def GetPerformanceReport(self):
        """Get comprehensive performance report"""
        win_rate = (self.profitable_ladder_trades / max(1, self.total_ladder_trades)) * 100
        avg_pnl = self.total_ladder_pnl / max(1, self.total_ladder_trades)
        
        return {
            'strategy': 'LEAP_LADDER',
            'total_trades': self.total_ladder_trades,
            'profitable_trades': self.profitable_ladder_trades,
            'win_rate': win_rate,
            'total_pnl': self.total_ladder_pnl,
            'avg_pnl': avg_pnl,
            'active_positions': self.ladder_count,
            'weekly_entries': self.weekly_entries,
            'ladder_capacity': f"{self.ladder_count}/{self.max_ladder_positions}"
        }
