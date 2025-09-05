# LEAP Put Ladders Strategy Module for LEAN
# Long-term put ladder construction for portfolio hedging and appreciation
# Tom King Specification: Quarterly entries with multi-strike, multi-expiration ladders
from AlgorithmImports import *
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union
from enum import Enum
from risk.parameters import get_risk_parameters, get_strategy_info

class LadderType(Enum):
    """LEAP Put Ladder construction types"""
    HEDGING = "HEDGING"                 # Primary hedge focus
    APPRECIATION = "APPRECIATION"       # Long-term appreciation focus
    HYBRID = "HYBRID"                   # Balanced approach

class QuarterlyEntry(Enum):
    """Quarterly entry schedule"""
    Q1 = 1  # January
    Q2 = 4  # April  
    Q3 = 7  # July
    Q4 = 10 # October

class ExpirationLadder(Enum):
    """Expiration laddering structure"""
    SHORT_LADDER = 12   # 12 months
    MEDIUM_LADDER = 18  # 18 months
    LONG_LADDER = 24    # 24 months

class LEAPPutLaddersStrategy:
    """
    Tom King LEAP Put Ladders Strategy - Complete Implementation
    
    Purpose: Portfolio hedging and long-term appreciation through structured
    put ladder construction with quarterly entries and multi-expiration management.
    
    Key Features:
    - Quarterly entries (January, April, July, October)
    - Multiple strike ladders (5%, 10%, 15% OTM)
    - Expiration diversification (12, 18, 24 months)
    - Dynamic position sizing based on portfolio allocation
    - Comprehensive hedge ratio tracking
    - Performance monitoring and adjustment
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        self.risk_params = get_risk_parameters()
        self.strategy_params = get_strategy_info("LEAP_PUTS")
        
        # Core strategy parameters
        self.target_underlyings = ["SPY", "QQQ", "IWM"]  # Major indices
        self.otm_strikes = [0.05, 0.10, 0.15]  # 5%, 10%, 15% OTM
        self.expiration_months = [12, 18, 24]  # Ladder expirations
        self.quarterly_months = [1, 4, 7, 10]  # Entry months
        
        # Position tracking and management
        self.positions = {}
        self.ladder_performance = {}
        self.hedge_effectiveness = {}
        self.quarterly_schedule = {}
        
        # Portfolio allocation and sizing
        self.max_allocation = 0.10  # 10% max portfolio allocation
        self.min_allocation = 0.05  # 5% min portfolio allocation
        self.allocation_per_ladder = 0.025  # 2.5% per ladder construction
        
        # Performance tracking
        self.entry_count = 0
        self.successful_hedges = 0
        self.appreciation_gains = 0
        self.total_premium_paid = 0.0
        
        # Risk management
        self.max_single_position_loss = -0.50  # 50% max loss per position
        self.profit_target = 3.00  # 300% gain target
        self.hedge_effectiveness_threshold = 0.80  # 80% hedge effectiveness
        
        self.algo.Log("LEAP Put Ladders Strategy initialized - Tom King specification")
        
    def CheckEntry(self):
        """Check for quarterly LEAP put ladder entries"""
        try:
            # Phase 2+ strategy (account > 40k)
            current_phase = self.risk_params.get_account_phase(self.algo.Portfolio.TotalPortfolioValue)
            if current_phase['phase'] < 2:
                return
            
            # Check if we're in a quarterly entry month
            current_month = self.algo.Time.month
            if current_month not in self.quarterly_months:
                return
            
            # Check if we've already entered this quarter
            quarter_key = f"{self.algo.Time.year}_Q{self._get_quarter(current_month)}"
            if quarter_key in self.quarterly_schedule:
                return
            
            # Analyze market conditions for entry
            market_analysis = self._analyze_market_conditions()
            if not market_analysis['suitable_for_entry']:
                self.algo.Log(f"LEAP Ladders: Market conditions not suitable - {market_analysis['reason']}")
                return
            
            # Calculate portfolio allocation
            allocation_analysis = self._calculate_allocation()
            if allocation_analysis['available_allocation'] < self.min_allocation:
                self.algo.Log(f"LEAP Ladders: Insufficient allocation available - {allocation_analysis['available_allocation']:.1%}")
                return
            
            # Enter quarterly ladder positions
            self._enter_quarterly_ladders(quarter_key, allocation_analysis)
            
        except Exception as e:
            self.algo.Log(f"ERROR in LEAP Ladders CheckEntry: {e}")
            
    def _get_quarter(self, month: int) -> int:
        """Get quarter number from month"""
        if month <= 3:
            return 1
        elif month <= 6:
            return 2
        elif month <= 9:
            return 3
        else:
            return 4
            
    def _analyze_market_conditions(self) -> Dict:
        """Analyze market conditions for LEAP ladder entry"""
        try:
            # Get VIX regime
            vix_price = self.algo.Securities["VIX"].Price if "VIX" in self.algo.Securities else 20.0
            vix_regime = self.risk_params.get_vix_regime(vix_price)
            
            # Analyze market trend and volatility
            spy_symbol = self.algo.Symbol("SPY")
            history = self.algo.History(spy_symbol, 60, Resolution.Daily)
            
            if history.empty:
                return {'suitable_for_entry': False, 'reason': 'No market data available'}
            
            current_price = history['close'].iloc[-1]
            sma_20 = history['close'].tail(20).mean()
            sma_50 = history['close'].tail(50).mean()
            volatility_20 = history['close'].tail(20).std() / sma_20
            
            # Calculate market conditions
            market_trend = "BULLISH" if current_price > sma_20 > sma_50 else "BEARISH" if current_price < sma_20 < sma_50 else "NEUTRAL"
            volatility_regime = "HIGH" if volatility_20 > 0.02 else "NORMAL" if volatility_20 > 0.01 else "LOW"
            
            # Entry criteria
            suitable_conditions = [
                vix_regime['regime'] in ['NORMAL', 'HIGH'],  # Prefer normal to elevated VIX
                volatility_regime in ['NORMAL', 'HIGH'],     # Need some volatility for premium
                15 <= vix_price <= 40,                      # Reasonable VIX range
            ]
            
            suitable_for_entry = all(suitable_conditions)
            reason = f"VIX: {vix_price:.1f} ({vix_regime['regime']}), Trend: {market_trend}, Vol: {volatility_regime}"
            
            return {
                'suitable_for_entry': suitable_for_entry,
                'reason': reason,
                'vix_regime': vix_regime,
                'market_trend': market_trend,
                'volatility_regime': volatility_regime,
                'current_price': current_price,
                'sma_20': sma_20,
                'sma_50': sma_50
            }
            
        except Exception as e:
            self.algo.Log(f"ERROR analyzing market conditions: {e}")
            return {'suitable_for_entry': False, 'reason': f'Analysis error: {e}'}
            
    def _calculate_allocation(self) -> Dict:
        """Calculate available allocation for LEAP ladders"""
        try:
            portfolio_value = self.algo.Portfolio.TotalPortfolioValue
            current_leap_value = self._calculate_current_leap_value()
            # Safe division for current allocation
            if portfolio_value > 0:
                current_allocation = current_leap_value / portfolio_value
            else:
                current_allocation = 0
                self.algo.Error("Invalid portfolio value in LEAP allocation calculation")
            
            available_allocation = self.max_allocation - current_allocation
            position_size = min(available_allocation, self.allocation_per_ladder)
            
            return {
                'portfolio_value': portfolio_value,
                'current_leap_value': current_leap_value,
                'current_allocation': current_allocation,
                'available_allocation': available_allocation,
                'position_size': position_size,
                'max_allocation': self.max_allocation
            }
            
        except Exception as e:
            self.algo.Log(f"ERROR calculating allocation: {e}")
            return {
                'available_allocation': 0,
                'position_size': 0
            }
            
    def _calculate_current_leap_value(self) -> float:
        """Calculate current value of all LEAP positions"""
        total_value = 0.0
        
        try:
            for position_key, position_data in self.positions.items():
                for ladder in position_data.get('ladders', []):
                    for contract_symbol in ladder.get('contracts', []):
                        if contract_symbol in self.algo.Securities:
                            holding = self.algo.Portfolio[contract_symbol]
                            total_value += abs(holding.HoldingsValue)
                            
        except Exception as e:
            self.algo.Log(f"ERROR calculating current LEAP value: {e}")
            
        return total_value
    
    def _enter_quarterly_ladders(self, quarter_key: str, allocation_analysis: Dict):
        """Enter quarterly LEAP put ladder positions"""
        try:
            position_size = allocation_analysis['position_size']
            if position_size <= 0:
                return
                
            successful_entries = []
            
            # Enter ladders for each target underlying
            for underlying in self.target_underlyings:
                entry_result = self._construct_leap_ladder(underlying, position_size)
                if entry_result['success']:
                    successful_entries.append(entry_result)
                    
            if successful_entries:
                self.quarterly_schedule[quarter_key] = {
                    'entry_date': self.algo.Time,
                    'entries': successful_entries,
                    'total_allocation': sum(entry['allocation'] for entry in successful_entries),
                    'market_conditions': self._analyze_market_conditions()
                }
                
                self.algo.Log(f"LEAP Ladders: Quarterly entry completed - {len(successful_entries)} ladders, {sum(entry['allocation'] for entry in successful_entries):.1%} allocation")
                
        except Exception as e:
            self.algo.Log(f"ERROR in quarterly ladder entry: {e}")
            
    def _construct_leap_ladder(self, underlying: str, position_size: float) -> Dict:
        """Construct multi-strike, multi-expiration LEAP put ladder"""
        try:
            chains = self.algo.CurrentSlice.OptionChains
            underlying_symbol = self.algo.Symbol(underlying)
            
            # Find option chain for this underlying
            chain = None
            for kvp in chains:
                if kvp.Key.Underlying == underlying_symbol:
                    chain = kvp.Value
                    break
                    
            if chain is None or len(chain) == 0:
                return {'success': False, 'reason': f'No option chain for {underlying}'}
                
            underlying_price = chain.Underlying.Price
            
            # Get LEAP puts for each expiration ladder
            ladder_contracts = self._select_ladder_contracts(chain, underlying_price)
            if not ladder_contracts['success']:
                return ladder_contracts
                
            # Execute the ladder construction
            execution_result = self._execute_ladder_trades(underlying, ladder_contracts, position_size)
            
            return execution_result
            
        except Exception as e:
            self.algo.Log(f"ERROR constructing LEAP ladder for {underlying}: {e}")
            return {'success': False, 'reason': f'Construction error: {e}'}
            
    def _select_ladder_contracts(self, chain, underlying_price: float) -> Dict:
        """Select contracts for multi-strike, multi-expiration ladder"""
        try:
            # Filter for LEAP puts (300+ DTE)
            leap_puts = [contract for contract in chain 
                        if contract.Right == OptionRight.PUT
                        and (contract.Expiry.date() - self.algo.Time.date()).days >= 300]
                        
            if len(leap_puts) < 12:  # Need sufficient contracts for multi-expiration ladder
                return {'success': False, 'reason': 'Insufficient LEAP contracts'}
                
            # Group by expiration and sort
            leap_puts.sort(key=lambda x: (x.Expiry, x.Strike))
            expiry_groups = {}
            
            for contract in leap_puts:
                expiry = contract.Expiry.date()
                if expiry not in expiry_groups:
                    expiry_groups[expiry] = []
                expiry_groups[expiry].append(contract)
                
            # Select expirations closest to target months
            selected_expirations = self._select_target_expirations(list(expiry_groups.keys()))
            
            # Build ladder for each expiration
            ladder_structure = []
            for expiry in selected_expirations:
                expiry_contracts = expiry_groups[expiry]
                
                # Select strikes for this expiration
                strike_contracts = self._select_strikes_for_expiry(expiry_contracts, underlying_price)
                if strike_contracts:
                    ladder_structure.append({
                        'expiry': expiry,
                        'contracts': strike_contracts,
                        'dte': (expiry - self.algo.Time.date()).days
                    })
                    
            if len(ladder_structure) < 2:  # Need at least 2 expirations
                return {'success': False, 'reason': 'Insufficient expirations for ladder'}
                
            return {
                'success': True,
                'ladder_structure': ladder_structure,
                'underlying_price': underlying_price
            }
            
        except Exception as e:
            self.algo.Log(f"ERROR selecting ladder contracts: {e}")
            return {'success': False, 'reason': f'Selection error: {e}'}
            
    def _select_target_expirations(self, available_expirations: List) -> List:
        """Select expirations closest to 12, 18, 24 month targets"""
        target_dates = []
        current_date = self.algo.Time.date()
        
        for months in self.expiration_months:
            target_date = current_date + timedelta(days=months * 30)  # Approximate
            closest_expiry = min(available_expirations, 
                               key=lambda x: abs((x - target_date).days))
            if closest_expiry not in target_dates:
                target_dates.append(closest_expiry)
                
        return sorted(target_dates)
        
    def _select_strikes_for_expiry(self, contracts: List, underlying_price: float) -> List:
        """Select strikes for ladder construction (5%, 10%, 15% OTM)"""
        selected_contracts = []
        
        try:
            # Sort contracts by strike
            contracts.sort(key=lambda x: x.Strike)
            
            # Select strikes based on OTM percentages
            for otm_percent in self.otm_strikes:
                target_strike = underlying_price * (1 - otm_percent)
                closest_contract = min(contracts,
                                     key=lambda x: abs(x.Strike - target_strike))
                
                if closest_contract not in selected_contracts:
                    selected_contracts.append(closest_contract)
                    
        except Exception as e:
            self.algo.Log(f"ERROR selecting strikes: {e}")
            
        return selected_contracts
        
    def _execute_ladder_trades(self, underlying: str, ladder_contracts: Dict, position_size: float) -> Dict:
        """Execute the LEAP put ladder trades"""
        try:
            portfolio_value = self.algo.Portfolio.TotalPortfolioValue
            dollar_allocation = portfolio_value * position_size
            
            executed_contracts = []
            total_premium = 0.0
            
            # Execute trades for each expiration ladder
            for ladder_level in ladder_contracts['ladder_structure']:
                expiry = ladder_level['expiry']
                contracts = ladder_level['contracts']
                dte = ladder_level['dte']
                
                # Calculate position sizing for this ladder level
                contracts_per_level = len(contracts)
                if contracts_per_level == 0:
                    continue
                    
                allocation_per_contract = dollar_allocation / (len(ladder_contracts['ladder_structure']) * contracts_per_level)
                
                for contract in contracts:
                    try:
                        # Add contract to algorithm
                        self.algo.AddOptionContract(contract.Symbol)
                        
                        # Calculate quantity based on allocation
                        contract_price = (contract.BidPrice + contract.AskPrice) / 2
                        if contract_price <= 0:
                            continue
                            
                        contract_value = contract_price * 100  # Options are per 100 shares
                        quantity = max(1, int(allocation_per_contract / contract_value))
                        
                        # Execute buy order (long puts for hedging/appreciation)
                        order = self.algo.Buy(contract.Symbol, quantity)
                        
                        if order:
                            executed_contracts.append({
                                'symbol': contract.Symbol,
                                'strike': contract.Strike,
                                'expiry': expiry,
                                'dte': dte,
                                'quantity': quantity,
                                'price': contract_price,
                                'premium': contract_price * quantity * 100,
                                'otm_percent': (ladder_contracts['underlying_price'] - contract.Strike) / ladder_contracts['underlying_price']
                            })
                            
                            total_premium += contract_price * quantity * 100
                            
                    except Exception as e:
                        self.algo.Log(f"ERROR executing contract {contract.Symbol}: {e}")
                        continue
                        
            if executed_contracts:
                # Store position data
                position_key = f"{underlying}_{self.algo.Time.strftime('%Y%m%d')}"
                self.positions[position_key] = {
                    'underlying': underlying,
                    'entry_date': self.algo.Time,
                    'entry_price': ladder_contracts['underlying_price'],
                    'contracts': executed_contracts,
                    'total_premium': total_premium,
                    'allocation': position_size,
                    'ladder_type': LadderType.HYBRID,
                    'performance': {
                        'max_gain': 0.0,
                        'current_pnl': 0.0,
                        'hedge_effectiveness': 0.0
                    }
                }
                
                self.entry_count += 1
                self.total_premium_paid += total_premium
                
                self.algo.Log(f"LEAP Ladder constructed: {underlying}")
                self.algo.Log(f"  Contracts: {len(executed_contracts)}, Premium: ${total_premium:.2f}")
                self.algo.Log(f"  Strikes: {[c['strike'] for c in executed_contracts]}")
                self.algo.Log(f"  Expirations: {list(set([c['expiry'].strftime('%Y-%m') for c in executed_contracts]))}")
                
                return {
                    'success': True,
                    'position_key': position_key,
                    'contracts': executed_contracts,
                    'allocation': position_size,
                    'premium_paid': total_premium
                }
                
            return {'success': False, 'reason': 'No contracts executed'}
            
        except Exception as e:
            self.algo.Log(f"ERROR executing ladder trades: {e}")
            return {'success': False, 'reason': f'Execution error: {e}'}
    
    def CheckManagement(self):
        """Comprehensive position management for LEAP ladders"""
        try:
            for position_key, position in list(self.positions.items()):
                # Update position performance
                self._update_position_performance(position_key, position)
                
                # Check expiration management
                if self._check_expiration_management(position_key, position):
                    continue
                    
                # Check profit taking opportunities
                if self._check_profit_taking(position_key, position):
                    continue
                    
                # Check hedge effectiveness
                self._check_hedge_effectiveness(position_key, position)
                
                # Check portfolio allocation limits
                self._check_allocation_limits(position_key, position)
                
        except Exception as e:
            self.algo.Log(f"ERROR in LEAP ladder management: {e}")
            
    def _update_position_performance(self, position_key: str, position: Dict):
        """Update performance metrics for position"""
        try:
            current_pnl = 0.0
            total_value = 0.0
            
            for contract in position['contracts']:
                symbol = contract['symbol']
                if symbol in self.algo.Securities:
                    holding = self.algo.Portfolio[symbol]
                    current_value = holding.HoldingsValue
                    total_value += current_value
                    
                    # Calculate P&L for this contract
                    entry_cost = contract['premium']
                    contract_pnl = current_value - entry_cost
                    current_pnl += contract_pnl
                    
            # Update performance metrics
            position['performance']['current_pnl'] = current_pnl
            position['performance']['max_gain'] = max(
                position['performance'].get('max_gain', 0),
                current_pnl
            )
            
            # Calculate percentage return
            if position['total_premium'] > 0:
                pnl_percent = current_pnl / position['total_premium']
                position['performance']['pnl_percent'] = pnl_percent
                
            # Calculate hedge effectiveness
            underlying_symbol = self.algo.Symbol(position['underlying'])
            if underlying_symbol in self.algo.Securities:
                current_underlying = self.algo.Securities[underlying_symbol].Price
                underlying_change = (current_underlying - position['entry_price']) / position['entry_price']
                
                # Hedge effectiveness: how well puts performed relative to underlying decline
                if underlying_change < 0:  # Underlying declined
                    hedge_effectiveness = abs(current_pnl / position['total_premium']) / abs(underlying_change)
                    position['performance']['hedge_effectiveness'] = min(2.0, hedge_effectiveness)  # Cap at 200%
                    
        except Exception as e:
            self.algo.Log(f"ERROR updating position performance for {position_key}: {e}")
            
    def _check_expiration_management(self, position_key: str, position: Dict) -> bool:
        """Check if position needs expiration management"""
        try:
            action_taken = False
            
            for contract in position['contracts']:
                expiry = contract['expiry']
                dte = (expiry - self.algo.Time.date()).days
                
                # Close positions approaching expiration (30 DTE)
                if dte <= 30:
                    symbol = contract['symbol']
                    if symbol in self.algo.Portfolio and self.algo.Portfolio[symbol].Quantity != 0:
                        self.algo.Liquidate(symbol)
                        self.algo.Log(f"LEAP Ladder: Closed {symbol} at {dte} DTE")
                        action_taken = True
                        
            # Remove position if all contracts closed
            if action_taken:
                remaining_contracts = [c for c in position['contracts'] 
                                     if c['symbol'] in self.algo.Portfolio 
                                     and self.algo.Portfolio[c['symbol']].Quantity != 0]
                if not remaining_contracts:
                    del self.positions[position_key]
                    self.algo.Log(f"LEAP Ladder position closed: {position_key}")
                else:
                    position['contracts'] = remaining_contracts
                    
            return action_taken
            
        except Exception as e:
            self.algo.Log(f"ERROR in expiration management for {position_key}: {e}")
            return False
            
    def _check_profit_taking(self, position_key: str, position: Dict) -> bool:
        """Check profit taking opportunities (300% gain or hold to expiration)"""
        try:
            current_pnl_percent = position['performance'].get('pnl_percent', 0)
            
            # Take profit at 300% gain
            if current_pnl_percent >= self.profit_target:
                self._close_position(position_key, f"Profit target reached: {current_pnl_percent:.1%}")
                self.appreciation_gains += 1
                return True
                
            # Check for significant underlying decline with good hedge performance
            underlying_symbol = self.algo.Symbol(position['underlying'])
            if underlying_symbol in self.algo.Securities:
                current_price = self.algo.Securities[underlying_symbol].Price
                underlying_decline = (position['entry_price'] - current_price) / position['entry_price']
                
                # If underlying declined significantly and we have good gains, consider partial profit taking
                if underlying_decline > 0.15 and current_pnl_percent > 1.0:  # 15% decline, 100%+ gains
                    # Take partial profits on most profitable contracts
                    self._take_partial_profits(position_key, position)
                    return True
                    
            return False
            
        except Exception as e:
            self.algo.Log(f"ERROR in profit taking for {position_key}: {e}")
            return False
            
    def _take_partial_profits(self, position_key: str, position: Dict):
        """Take partial profits on most profitable contracts"""
        try:
            # Calculate individual contract performance
            contract_performance = []
            
            for contract in position['contracts']:
                symbol = contract['symbol']
                if symbol in self.algo.Portfolio:
                    holding = self.algo.Portfolio[symbol]
                    if holding.Quantity > 0:
                        current_value = holding.HoldingsValue
                        entry_cost = contract['premium']
                        pnl_percent = (current_value - entry_cost) / entry_cost if entry_cost > 0 else 0
                        
                        contract_performance.append({
                            'symbol': symbol,
                            'pnl_percent': pnl_percent,
                            'quantity': holding.Quantity
                        })
                        
            # Sort by performance and take profits on top 50%
            contract_performance.sort(key=lambda x: x['pnl_percent'], reverse=True)
            top_performers = contract_performance[:len(contract_performance)//2]
            
            for contract in top_performers:
                symbol = contract['symbol']
                quantity_to_sell = contract['quantity'] // 2  # Sell half
                if quantity_to_sell > 0:
                    self.algo.Sell(symbol, quantity_to_sell)
                    self.algo.Log(f"LEAP Ladder: Partial profit taking on {symbol} - sold {quantity_to_sell} contracts")
                    
        except Exception as e:
            self.algo.Log(f"ERROR in partial profit taking: {e}")
            
    def _check_hedge_effectiveness(self, position_key: str, position: Dict):
        """Monitor and report hedge effectiveness"""
        try:
            hedge_effectiveness = position['performance'].get('hedge_effectiveness', 0)
            
            # Log hedge effectiveness periodically
            days_since_entry = (self.algo.Time.date() - position['entry_date'].date()).days
            if days_since_entry % 30 == 0:  # Monthly reporting
                underlying = position['underlying']
                current_pnl_percent = position['performance'].get('pnl_percent', 0)
                
                self.algo.Log(f"LEAP Hedge Report - {underlying}:")
                self.algo.Log(f"  Days held: {days_since_entry}")
                self.algo.Log(f"  Current P&L: {current_pnl_percent:.1%}")
                self.algo.Log(f"  Hedge effectiveness: {hedge_effectiveness:.2f}")
                
                # Track successful hedges
                if hedge_effectiveness > self.hedge_effectiveness_threshold:
                    self.successful_hedges += 1
                    
        except Exception as e:
            self.algo.Log(f"ERROR checking hedge effectiveness: {e}")
            
    def _check_allocation_limits(self, position_key: str, position: Dict):
        """Check portfolio allocation limits"""
        try:
            current_allocation = self._calculate_allocation()['current_allocation']
            
            # If over allocation limit, consider reducing positions
            if current_allocation > self.max_allocation * 1.1:  # 10% buffer
                self.algo.Log(f"LEAP Ladders: Over allocation limit ({current_allocation:.1%} vs {self.max_allocation:.1%})")
                # Could implement position reduction logic here
                
        except Exception as e:
            self.algo.Log(f"ERROR checking allocation limits: {e}")
            
    def _close_position(self, position_key: str, reason: str):
        """Close entire LEAP ladder position"""
        try:
            if position_key not in self.positions:
                return
                
            position = self.positions[position_key]
            
            # Close all contracts
            for contract in position['contracts']:
                symbol = contract['symbol']
                if symbol in self.algo.Portfolio and self.algo.Portfolio[symbol].Quantity != 0:
                    self.algo.Liquidate(symbol)
                    
            self.algo.Log(f"LEAP Ladder position closed: {position_key} - {reason}")
            del self.positions[position_key]
            
        except Exception as e:
            self.algo.Log(f"ERROR closing position {position_key}: {e}")
    
    def GetPerformanceMetrics(self) -> Dict:
        """Get comprehensive performance metrics for LEAP ladders"""
        try:
            total_positions = len(self.positions)
            total_pnl = sum(pos['performance'].get('current_pnl', 0) for pos in self.positions.values())
            total_premium = sum(pos['total_premium'] for pos in self.positions.values())
            
            # Calculate average hedge effectiveness
            hedge_scores = [pos['performance'].get('hedge_effectiveness', 0) 
                           for pos in self.positions.values() 
                           if pos['performance'].get('hedge_effectiveness', 0) > 0]
            avg_hedge_effectiveness = sum(hedge_scores) / len(hedge_scores) if hedge_scores else 0
            
            # Calculate allocation metrics
            current_allocation_data = self._calculate_allocation()
            
            return {
                'strategy': 'LEAP_PUT_LADDERS',
                'positions': {
                    'total_positions': total_positions,
                    'entry_count': self.entry_count,
                    'active_underlyings': list(set(pos['underlying'] for pos in self.positions.values()))
                },
                'performance': {
                    'total_pnl': total_pnl,
                    'total_premium_paid': self.total_premium_paid,
                    'pnl_percent': total_pnl / self.total_premium_paid if self.total_premium_paid > 0 else 0,
                    'successful_hedges': self.successful_hedges,
                    'appreciation_gains': self.appreciation_gains,
                    'avg_hedge_effectiveness': avg_hedge_effectiveness
                },
                'allocation': {
                    'current_allocation': current_allocation_data.get('current_allocation', 0),
                    'max_allocation': self.max_allocation,
                    'utilization': current_allocation_data.get('current_allocation', 0) / self.max_allocation
                },
                'risk_metrics': {
                    'max_single_loss': max(
                        pos['performance'].get('pnl_percent', 0) 
                        for pos in self.positions.values()
                    ) if self.positions else 0,
                    'portfolio_hedge_ratio': self._calculate_portfolio_hedge_ratio(),
                    'diversification_score': self._calculate_diversification_score()
                }
            }
            
        except Exception as e:
            self.algo.Log(f"ERROR getting performance metrics: {e}")
            return {'error': str(e)}
            
    def _calculate_portfolio_hedge_ratio(self) -> float:
        """Calculate overall portfolio hedge ratio provided by LEAP puts"""
        try:
            portfolio_value = self.algo.Portfolio.TotalPortfolioValue
            total_hedge_value = 0.0
            
            for position in self.positions.values():
                # Estimate hedge value based on current position value
                current_pnl = position['performance'].get('current_pnl', 0)
                hedge_value = position['total_premium'] + current_pnl
                total_hedge_value += hedge_value
                
            # Safe division for hedge ratio
            if portfolio_value > 0:
                return total_hedge_value / portfolio_value
            else:
                self.algo.Error("Invalid portfolio value in hedge ratio calculation")
                return 0.0
            
        except Exception as e:
            self.algo.Log(f"ERROR calculating hedge ratio: {e}")
            return 0.0
            
    def _calculate_diversification_score(self) -> float:
        """Calculate diversification score across underlyings and expirations"""
        try:
            if not self.positions:
                return 0.0
                
            # Count unique underlyings
            underlyings = set(pos['underlying'] for pos in self.positions.values())
            underlying_diversity = len(underlyings) / len(self.target_underlyings)
            
            # Count unique expirations
            all_expirations = set()
            for position in self.positions.values():
                for contract in position['contracts']:
                    all_expirations.add(contract['expiry'])
                    
            expiration_diversity = min(1.0, len(all_expirations) / (len(self.expiration_months) * len(self.target_underlyings)))
            
            # Combined diversification score
            return (underlying_diversity + expiration_diversity) / 2
            
        except Exception as e:
            self.algo.Log(f"ERROR calculating diversification score: {e}")
            return 0.0
            
    def GetStrategyInfo(self) -> Dict:
        """Get strategy configuration and status information"""
        return {
            'strategy_name': 'LEAP Put Ladders',
            'tom_king_specification': True,
            'strategy_type': 'Portfolio Hedging & Long-term Appreciation',
            'configuration': {
                'target_underlyings': self.target_underlyings,
                'otm_strikes': [f"{int(pct*100)}%" for pct in self.otm_strikes],
                'expiration_months': self.expiration_months,
                'quarterly_schedule': self.quarterly_months,
                'max_allocation': f"{self.max_allocation:.1%}",
                'profit_target': f"{self.profit_target:.0%}"
            },
            'risk_management': {
                'max_single_loss': f"{abs(self.max_single_position_loss):.0%}",
                'hedge_threshold': f"{self.hedge_effectiveness_threshold:.0%}",
                'allocation_limits': f"{self.min_allocation:.1%} - {self.max_allocation:.1%}"
            },
            'implementation_features': [
                'Quarterly entry system (Jan, Apr, Jul, Oct)',
                'Multi-strike ladder construction (5%, 10%, 15% OTM)',
                'Multi-expiration diversification (12, 18, 24 months)',
                'Dynamic position sizing based on portfolio allocation',
                'Comprehensive hedge effectiveness tracking',
                'Automatic profit taking at 300% gains',
                'Portfolio protection and long-term appreciation focus',
                'Integration with Tom King risk management framework'
            ],
            'performance_tracking': [
                'Individual position P&L monitoring',
                'Hedge effectiveness calculation',
                'Portfolio allocation utilization',
                'Diversification score tracking',
                'Quarterly entry success rate',
                'Long-term appreciation capture'
            ]
        }
        
    def OnEndOfDay(self):
        """End of day processing for LEAP ladders"""
        try:
            # Update all position metrics
            for position_key, position in self.positions.items():
                self._update_position_performance(position_key, position)
                
            # Log monthly performance summary
            if self.algo.Time.day == 1:  # First day of month
                self._log_monthly_summary()
                
        except Exception as e:
            self.algo.Log(f"ERROR in LEAP ladders end of day: {e}")
            
    def _log_monthly_summary(self):
        """Log monthly performance summary"""
        try:
            metrics = self.GetPerformanceMetrics()
            
            self.algo.Log("=== LEAP Put Ladders Monthly Summary ===")
            self.algo.Log(f"Active Positions: {metrics['positions']['total_positions']}")
            self.algo.Log(f"Total P&L: ${metrics['performance']['total_pnl']:.2f} ({metrics['performance']['pnl_percent']:.1%})")
            self.algo.Log(f"Allocation Utilization: {metrics['allocation']['utilization']:.1%}")
            self.algo.Log(f"Average Hedge Effectiveness: {metrics['performance']['avg_hedge_effectiveness']:.2f}")
            self.algo.Log(f"Diversification Score: {metrics['risk_metrics']['diversification_score']:.2f}")
            self.algo.Log(f"Successful Hedges: {metrics['performance']['successful_hedges']}")
            self.algo.Log(f"Appreciation Gains: {metrics['performance']['appreciation_gains']}")
            
        except Exception as e:
            self.algo.Log(f"ERROR in monthly summary: {e}")