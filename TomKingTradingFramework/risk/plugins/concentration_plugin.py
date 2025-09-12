# Concentration Risk Management Plugin
# Migrated from SPYConcentrationManager
# Prevents over-exposure to single underlyings (especially SPY/ES)

from AlgorithmImports import *
from typing import Dict, List, Optional, Any, Tuple
from risk.unified_risk_manager import BaseRiskPlugin, RiskEvent, RiskEventType, RiskLevel
from datetime import datetime, timedelta

class ConcentrationPlugin(BaseRiskPlugin):
    """
    Concentration risk management plugin preventing over-exposure to SPY/ES/related assets.
    Migrated from SPYConcentrationManager with enhanced multi-asset support.
    Preserves Tom King's concentration limits and safety rules.
    """
    
    @property
    def plugin_name(self) -> str:
        return "ConcentrationPlugin"
    
    @property
    def plugin_version(self) -> str:
        return "2.0.0"
    
    def _plugin_initialize(self) -> bool:
        """Initialize concentration tracking"""
        try:
        self.spy_positions = {}    # Strategy -> position details
        self.es_positions = {}     # ES futures positions
        self.option_positions = {}  # SPY/SPX options
        self.other_positions = {}   # Other concentrated positions
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Track positions by underlying asset groups
            
            # Maximum exposure limits (Tom King methodology - NEVER CHANGE)
            self.max_spy_delta = 100           # Maximum net delta exposure
            self.max_notional_pct = 0.30       # Max 30% of portfolio in SPY/ES
            self.max_strategies_per_underlying = 2  # Max strategies per symbol
            
            # Asset multipliers for equivalent calculations
            self.multipliers = {
                'SPY': 1,      # Base reference
                'ES': 50,      # ES futures: $50 per point
                'MES': 5,      # MES futures: $5 per point  
                'SPX': 10,     # SPX options: ~10x SPY
                'QQQ': 1,      # QQQ tracking
                'IWM': 1,      # IWM tracking
                'DIA': 1       # DIA tracking
            }
            
            # Concentration groups (expanded beyond just SPY)
            self.concentration_groups = {
                'SPY_EQUIVALENT': ['SPY', 'ES', 'MES', 'SPX'],  # S&P 500 exposure
                'QQQ_EQUIVALENT': ['QQQ', 'NQ', 'MNQ'],         # NASDAQ exposure
                'IWM_EQUIVALENT': ['IWM', 'RTY', 'M2K'],        # Russell 2000
                'DIA_EQUIVALENT': ['DIA', 'YM', 'MYM']          # Dow Jones
            }
            
            # Track current exposures
            self.group_exposures = {group: 0.0 for group in self.concentration_groups}
            self.group_strategy_counts = {group: 0 for group in self.concentration_groups}
            
            # Position tracking for cleanup
            self.position_timestamps = {}
            self.allocation_leaks_detected = 0
            self.stale_allocations_cleaned = 0
            
            # Current market data
            self.current_prices = {}
            self.last_price_update = self._algorithm.Time
            
            # Performance metrics
            self.concentration_checks = 0
            self.blocked_concentrations = 0
            self.cleanups_performed = 0
            
            self._algorithm.Log("[Concentration Plugin] Initialized with multi-asset concentration tracking")
            
            return True
            
        except Exception as e:
            self._algorithm.Error(f"[Concentration Plugin] Initialization error: {e}")
            return False
    
    def can_open_position(self, symbol: str, quantity: int, 
                         context: Dict[str, Any] = None) -> tuple[bool, str]:
        """Check if position can be opened within concentration limits"""
        def _check():
            self.concentration_checks += 1
            
            # Get concentration group for symbol
            group = self._get_concentration_group(symbol)
            if not group:
                return True, "Symbol not in concentration tracking"
            
            # Extract strategy name from context
            strategy_name = context.get('strategy_name', 'unknown') if context else 'unknown'
            
            # Estimate position delta and notional
            estimated_delta = self._estimate_position_delta(symbol, quantity)
            estimated_notional = self._estimate_position_notional(symbol, quantity)
            
            # Check group delta limit
            current_group_exposure = self.group_exposures.get(group, 0.0)
            new_group_exposure = current_group_exposure + abs(estimated_delta)
            
            if new_group_exposure > self._get_group_limit(group):
                self.blocked_concentrations += 1
                return False, f"Would exceed {group} delta limit: {new_group_exposure:.1f} > {self._get_group_limit(group)}"
            
            # Check strategy count limit
            current_strategy_count = self.group_strategy_counts.get(group, 0)
            if (strategy_name not in self._get_strategies_for_group(group) and 
                current_strategy_count >= self.max_strategies_per_underlying):
                self.blocked_concentrations += 1
                return False, f"Already {current_strategy_count} strategies in {group} (max {self.max_strategies_per_underlying})"
            
            # Check portfolio notional limit
            account_value = self._algorithm.Portfolio.TotalPortfolioValue
            max_notional = account_value * self.max_notional_pct
            current_notional = self._calculate_total_group_notional(group)
            
            if current_notional + estimated_notional > max_notional:
                self.blocked_concentrations += 1
                return False, f"Would exceed {group} notional limit: ${current_notional + estimated_notional:,.0f} > ${max_notional:,.0f}"
            
            # Check for conflicting positions
            conflict = self._check_position_conflicts(group, estimated_delta, strategy_name)
            if conflict:
                self.blocked_concentrations += 1
                return False, f"Conflicts with {conflict}"
            
            return True, f"Concentration check passed for {group} ({new_group_exposure:.1f}/{self._get_group_limit(group)})"
        
        return self._safe_execute("can_open_position", _check)
    
    def on_position_opened(self, symbol: str, quantity: int, 
                          fill_price: float, context: Dict[str, Any] = None):
        """Register new position in concentration tracking"""
        def _register():
            group = self._get_concentration_group(symbol)
            if not group:
                return
            
            strategy_name = context.get('strategy_name', 'unknown') if context else 'unknown'
            
            # Calculate actual position metrics
            delta = self._estimate_position_delta(symbol, quantity)
            notional = quantity * fill_price * self.multipliers.get(str(symbol)[:3], 1)
            
            # Record position
            position_record = {
                'symbol': symbol,
                'quantity': quantity,
                'fill_price': fill_price,
                'delta': delta,
                'notional': notional,
                'timestamp': self._algorithm.Time,
                'group': group
            }
            
            # Store in appropriate tracking dict
            if group == 'SPY_EQUIVALENT':
                if 'ES' in str(symbol) or 'MES' in str(symbol):
                    self.es_positions[strategy_name] = position_record
                elif str(symbol).startswith('SPY') and symbol.SecurityType == SecurityType.Option:
                    self.option_positions[strategy_name] = position_record
                else:
                    self.spy_positions[strategy_name] = position_record
            else:
                self.other_positions[f"{strategy_name}_{group}"] = position_record
            
            # Update group tracking
            self.group_exposures[group] = self.group_exposures.get(group, 0) + abs(delta)
            
            # Update strategy count for group
            strategies = self._get_strategies_for_group(group)
            if strategy_name not in strategies:
                self.group_strategy_counts[group] = self.group_strategy_counts.get(group, 0) + 1
            
            self._algorithm.Debug(
                f"[Concentration Plugin] Position registered: {strategy_name} -> {symbol} "
                f"(Group: {group}, Delta: {delta:.1f}, Total: {self.group_exposures[group]:.1f})"
            )
        
        self._safe_execute("on_position_opened", _register)
    
    def on_position_closed(self, symbol: str, quantity: int, 
                          fill_price: float, pnl: float, context: Dict[str, Any] = None):
        """Remove position from concentration tracking"""  
        def _unregister():
            strategy_name = context.get('strategy_name', 'unknown') if context else 'unknown'
            
            # Find and remove position record
            removed_record = None
            for positions_dict in [self.spy_positions, self.es_positions, 
                                 self.option_positions, self.other_positions]:
                if strategy_name in positions_dict:
                    removed_record = positions_dict[strategy_name]
                    del positions_dict[strategy_name]
                    break
                    
                # Also check compound keys for other_positions
                for key in list(positions_dict.keys()):
                    if key.startswith(f"{strategy_name}_"):
                        removed_record = positions_dict[key]
                        del positions_dict[key]
                        break
            
            if removed_record:
                group = removed_record['group']
                delta = removed_record['delta']
                
                # Update group tracking
                self.group_exposures[group] = max(0, self.group_exposures[group] - abs(delta))
                
                # Update strategy count if no more positions in group
                remaining_strategies = self._get_strategies_for_group(group)
                if strategy_name not in remaining_strategies:
                    self.group_strategy_counts[group] = max(0, self.group_strategy_counts[group] - 1)
                
                self._algorithm.Debug(
                    f"[Concentration Plugin] Position removed: {strategy_name} -> {symbol} "
                    f"(Group: {group}, Remaining exposure: {self.group_exposures[group]:.1f})"
                )
        
        self._safe_execute("on_position_closed", _unregister)
    
    def on_market_data(self, symbol: str, data: Any):
        """Update price data for concentration calculations"""
        def _update_prices():
            symbol_str = str(symbol)
            if any(asset in symbol_str for asset in ['SPY', 'QQQ', 'IWM', 'DIA', 'ES', 'NQ']):
                price = data.Price if hasattr(data, 'Price') else data
                self.current_prices[symbol_str] = price
                self.last_price_update = self._algorithm.Time
        
        self._safe_execute("on_market_data", _update_prices)
    
    def periodic_check(self) -> List[RiskEvent]:
        """Perform periodic concentration checks and cleanup"""
        def _periodic_check():
            events = []
            
            # Sync positions with actual portfolio
            self._sync_positions_with_portfolio()
            
            # Clean up stale allocations  
            cleanup_results = self._cleanup_stale_allocations()
            if cleanup_results['stale_removed']:
                self.cleanups_performed += 1
                events.append(RiskEvent(
                    RiskEventType.CONCENTRATION_LIMIT_EXCEEDED,
                    RiskLevel.INFO,
                    f"Cleaned {len(cleanup_results['stale_removed'])} stale concentration allocations",
                    cleanup_results
                ))
            
            # Check for dangerous concentrations
            for group, exposure in self.group_exposures.items():
                limit = self._get_group_limit(group)
                if exposure > limit * 0.8:  # Warning at 80% of limit
                    level = RiskLevel.CRITICAL if exposure > limit * 0.95 else RiskLevel.WARNING
                    events.append(RiskEvent(
                        RiskEventType.CONCENTRATION_LIMIT_EXCEEDED,
                        level,
                        f"High {group} concentration: {exposure:.1f}/{limit} ({exposure/limit:.1%})",
                        {
                            'group': group,
                            'exposure': exposure,
                            'limit': limit,
                            'utilization': exposure / limit,
                            'strategy_count': self.group_strategy_counts.get(group, 0)
                        }
                    ))
            
            return events
        
        return self._safe_execute("periodic_check", _periodic_check) or []
    
    def get_risk_metrics(self) -> Dict[str, Any]:
        """Get concentration risk metrics"""
        def _get_metrics():
            return {
                'risk_score': self._calculate_concentration_risk_score(),
                'group_exposures': self.group_exposures,
                'group_limits': {group: self._get_group_limit(group) for group in self.concentration_groups},
                'group_utilization': {
                    group: exposure / max(self._get_group_limit(group), 1)
                    for group, exposure in self.group_exposures.items()
                },
                'strategy_counts': self.group_strategy_counts,
                'position_counts': {
                    'spy_positions': len(self.spy_positions),
                    'es_positions': len(self.es_positions),
                    'option_positions': len(self.option_positions),
                    'other_positions': len(self.other_positions)
                },
                'total_positions': (len(self.spy_positions) + len(self.es_positions) + 
                                  len(self.option_positions) + len(self.other_positions)),
                'performance': {
                    'concentration_checks': self.concentration_checks,
                    'blocked_concentrations': self.blocked_concentrations,
                    'block_rate': (self.blocked_concentrations / max(1, self.concentration_checks)) * 100,
                    'cleanups_performed': self.cleanups_performed,
                    'stale_allocations_cleaned': self.stale_allocations_cleaned,
                    'allocation_leaks_detected': self.allocation_leaks_detected
                },
                'limits': {
                    'max_spy_delta': self.max_spy_delta,
                    'max_notional_pct': self.max_notional_pct,
                    'max_strategies_per_underlying': self.max_strategies_per_underlying
                }
            }
        
        return self._safe_execute("get_risk_metrics", _get_metrics) or {}
    
    def _get_concentration_group(self, symbol: str) -> Optional[str]:
        """Get concentration group for symbol"""
        symbol_str = str(symbol).upper()
        
        for group, symbols in self.concentration_groups.items():
            if any(asset in symbol_str for asset in symbols):
                return group
        
        return None
    
    def _get_group_limit(self, group: str) -> float:
        """Get delta limit for concentration group"""
        # Base limits
        base_limits = {
            'SPY_EQUIVALENT': self.max_spy_delta,
            'QQQ_EQUIVALENT': 80,   # Slightly lower for NASDAQ
            'IWM_EQUIVALENT': 60,   # Lower for small caps
            'DIA_EQUIVALENT': 70    # Moderate for Dow
        }
        
        return base_limits.get(group, 50)  # Default limit
    
    def _estimate_position_delta(self, symbol: str, quantity: int) -> float:
        """Estimate position delta exposure"""
        symbol_str = str(symbol)
        
        # Futures have delta of 1.0 per contract  
        if 'ES' in symbol_str or 'NQ' in symbol_str or 'RTY' in symbol_str or 'YM' in symbol_str:
            multiplier = self.multipliers.get(symbol_str[:3], 50)
            return quantity * 1.0 * (multiplier / 50)  # Normalize to ES equivalent
        
        # Stocks have delta of 1.0 per share (in 100-share groups)
        elif symbol.SecurityType == SecurityType.Equity:
            return quantity / 100.0  # Convert to option-equivalent delta
        
        # Options - estimate based on rough delta (would use Greeks in production)
        elif symbol.SecurityType == SecurityType.Option:
            return quantity * 0.5  # Rough estimate - ATM options ~0.5 delta
        
        return 0.0
    
    def _estimate_position_notional(self, symbol: str, quantity: int) -> float:
        """Estimate position notional value"""
        symbol_str = str(symbol)
        
        # Get current price or estimate
        current_price = self.current_prices.get(symbol_str, 0)
        if not current_price:
            # Fallback estimates
            if 'SPY' in symbol_str:
                current_price = 450.0
            elif 'QQQ' in symbol_str:
                current_price = 350.0
            elif 'IWM' in symbol_str:
                current_price = 180.0
            elif 'ES' in symbol_str:
                current_price = 4500.0
            else:
                current_price = 100.0  # Generic fallback
        
        multiplier = self.multipliers.get(symbol_str[:3], 1)
        return abs(quantity) * current_price * multiplier
    
    def _get_strategies_for_group(self, group: str) -> List[str]:
        """Get list of strategies with positions in concentration group"""
        strategies = set()
        
        if group == 'SPY_EQUIVALENT':
            strategies.update(self.spy_positions.keys())
            strategies.update(self.es_positions.keys())
            strategies.update(self.option_positions.keys())
        else:
            # Check other_positions for this group
            for key in self.other_positions.keys():
                if key.endswith(f"_{group}"):
                    strategy_name = key.replace(f"_{group}", "")
                    strategies.add(strategy_name)
        
        return list(strategies)
    
    def _calculate_total_group_notional(self, group: str) -> float:
        """Calculate total notional exposure for group"""
        total = 0.0
        
        for positions_dict in [self.spy_positions, self.es_positions, 
                              self.option_positions, self.other_positions]:
            for position in positions_dict.values():
                if position.get('group') == group:
                    total += abs(position.get('notional', 0))
        
        return total
    
    def _check_position_conflicts(self, group: str, estimated_delta: float, 
                                 strategy_name: str) -> Optional[str]:
        """Check for conflicting positions (opposite directions)"""
        if abs(estimated_delta) < 5:  # Small positions don't conflict
            return None
        
        # Check for opposing large positions in same group
        existing_strategies = self._get_strategies_for_group(group)
        if len(existing_strategies) >= 2:  # Already have 2+ strategies
            return "too many strategies in group"
        
        return None
    
    def _sync_positions_with_portfolio(self):
        """Sync position tracking with actual portfolio"""
        try:
        actual_symbols = set()
        for holding in self._algorithm.Portfolio.Values:
        if holding.Invested:
        actual_symbols.add(holding.Symbol)
        except Exception as e:

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Get actual positions
            
            # Remove tracking for positions that no longer exist
            all_position_dicts = [self.spy_positions, self.es_positions, 
                                self.option_positions, self.other_positions]
            
            for positions_dict in all_position_dicts:
                for strategy_name, position in list(positions_dict.items()):
                    if position['symbol'] not in actual_symbols:
                        group = position['group']
                        delta = position['delta']
                        
                        # Update group tracking
                        self.group_exposures[group] = max(0, self.group_exposures[group] - abs(delta))
                        
                        # Remove position
                        del positions_dict[strategy_name]
                        
                        self._algorithm.Debug(
                            f"[Concentration Plugin] Synced out stale position: {strategy_name} -> {position['symbol']}"
                        )
            
        except Exception as e:
            self._algorithm.Debug(f"[Concentration Plugin] Error syncing positions: {e}")
    
    def _cleanup_stale_allocations(self) -> Dict[str, Any]:
        """Clean up stale position allocations"""
        cleanup_results = {
            'stale_removed': [],
            'total_delta_recovered': 0.0,
            'total_notional_recovered': 0.0,
            'cleanup_timestamp': self._algorithm.Time
        }
        
        try:
            
        
        except Exception as e:

        
            # Log and handle unexpected exception

        
            print(f'Unexpected exception: {e}')

        
            raise
cutoff_time = self._algorithm.Time - timedelta(hours=4)
            
            all_position_dicts = [
                ('spy', self.spy_positions),
                ('es', self.es_positions),
                ('option', self.option_positions),
                ('other', self.other_positions)
            ]
            
            for dict_name, positions_dict in all_position_dicts:
                for strategy_name, position in list(positions_dict.items()):
                    position_age = self._algorithm.Time - position.get('timestamp', self._algorithm.Time)
                    
                    if position_age > timedelta(hours=4):
                        # Remove stale allocation
                        group = position['group']
                        delta = position['delta']
                        notional = position.get('notional', 0)
                        
                        cleanup_results['stale_removed'].append({
                            'strategy': strategy_name,
                            'symbol': str(position['symbol']),
                            'type': dict_name,
                            'delta': delta,
                            'notional': notional,
                            'age_hours': position_age.total_seconds() / TradingConstants.SECONDS_PER_HOUR
                        })
                        
                        # Update tracking
                        self.group_exposures[group] = max(0, self.group_exposures[group] - abs(delta))
                        cleanup_results['total_delta_recovered'] += abs(delta)
                        cleanup_results['total_notional_recovered'] += notional
                        
                        # Remove position
                        del positions_dict[strategy_name]
                        
                        self.stale_allocations_cleaned += 1
            
            return cleanup_results
            
        except Exception as e:
            self._algorithm.Error(f"[Concentration Plugin] Error in cleanup: {e}")
            cleanup_results['error'] = str(e)
            return cleanup_results
    
    def _calculate_concentration_risk_score(self) -> float:
        """Calculate concentration risk score (0-100)"""
        if not any(self.group_exposures.values()):
            return 0.0
        
        max_risk = 0.0
        
        for group, exposure in self.group_exposures.items():
            limit = self._get_group_limit(group)
            utilization = exposure / max(limit, 1)
            
            # Higher risk for higher utilization
            risk = min(100.0, utilization * 100)
            max_risk = max(max_risk, risk)
        
        return max_risk
    
    def request_spy_allocation(self, strategy_name: str, position_type: str,
                              requested_delta: float, requested_contracts: int = 0):
        """
        BACKWARD COMPATIBILITY: Request allocation for SPY/ES position
        Maps to the plugin's concentration checking logic
        """
        def _request_allocation():
            # Determine symbol based on position type
            symbol_map = {
                'options': 'SPY',
                'futures': 'ES', 
                'stock': 'SPY'
            }
            symbol = symbol_map.get(position_type, 'SPY')
            
            # Use existing can_open_position logic
            can_open, reason = self.can_open_position(symbol, requested_contracts, {
                'strategy_name': strategy_name,
                'position_type': position_type,
                'requested_delta': requested_delta
            })
            
            if can_open:
                self._algorithm.Debug(
                    f"[Concentration Plugin] Allocation approved: {strategy_name} "
                    f"{requested_delta} delta {position_type}"
                )
            else:
                self._algorithm.Debug(
                    f"[Concentration Plugin] Allocation denied: {strategy_name} - {reason}"
                )
            
            return can_open, reason
        
        return self._safe_execute("request_spy_allocation", _request_allocation) or (False, "Plugin error")
    
    def release_spy_allocation(self, strategy_name: str):
        """
        BACKWARD COMPATIBILITY: Release SPY allocation for strategy
        """
        def _release_allocation():
            self._algorithm.Debug(f"[Concentration Plugin] Release allocation for {strategy_name}")
            # Note: Actual position tracking is handled by on_position_closed
            return True
        
        return self._safe_execute("release_spy_allocation", _release_allocation) or True
    
    def shutdown(self):
        """Clean shutdown of concentration plugin"""
        total_positions = (len(self.spy_positions) + len(self.es_positions) + 
                          len(self.option_positions) + len(self.other_positions))
        
        self._algorithm.Log(
            f"[Concentration Plugin] Shutdown: {total_positions} tracked positions, "
            f"{self.concentration_checks} checks, {self.blocked_concentrations} blocks, "
            f"{self.cleanups_performed} cleanups performed"
        )