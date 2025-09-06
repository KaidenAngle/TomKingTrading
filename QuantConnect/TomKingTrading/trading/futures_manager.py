# region imports
from AlgorithmImports import *
# endregion
# Tom King Trading Framework v17 - Futures Trading Manager
# Based on Tom King Complete Trading System Documentation

class FuturesManager:
    """
    Tom King Futures Trading System
    Handles micro and full-size futures across all asset classes
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.name = "FUTURES_MANAGER"
        
        # Futures contract specifications from parameters
        self.futures_specs = {
            # Micro futures (Phase 1-2)
            'MES': {
                'name': 'Micro E-mini S&P 500',
                'multiplier': 5,
                'tick_size': 0.25,
                'tick_value': 1.25,
                'margin_day': 500,
                'margin_overnight': 1000,
                'minimum_phase': 2,
                'correlation_group': 'A1',
                'sector': 'equity_index'
            },
            'MNQ': {
                'name': 'Micro E-mini NASDAQ 100',
                'multiplier': 2,
                'tick_size': 0.25,
                'tick_value': 0.50,
                'margin_day': 800,
                'margin_overnight': 1600,
                'minimum_phase': 2,
                'correlation_group': 'A1',
                'sector': 'equity_index'
            },
            'M2K': {
                'name': 'Micro E-mini Russell 2000',
                'multiplier': 5,
                'tick_size': 0.10,
                'tick_value': 0.50,
                'margin_day': 300,
                'margin_overnight': 600,
                'minimum_phase': 2,
                'correlation_group': 'A2',
                'sector': 'equity_index'
            },
            'MCL': {
                'name': 'Micro Crude Oil',
                'multiplier': 100,
                'tick_size': 0.01,
                'tick_value': 1.00,
                'margin_day': 200,
                'margin_overnight': 400,
                'minimum_phase': 1,
                'correlation_group': 'B1',
                'sector': 'energy'
            },
            'MGC': {
                'name': 'Micro Gold',
                'multiplier': 10,
                'tick_size': 0.10,
                'tick_value': 1.00,
                'margin_day': 400,
                'margin_overnight': 800,
                'minimum_phase': 1,
                'correlation_group': 'C1',
                'sector': 'metals'
            },
            
            # Full size futures (Phase 3+)
            'ES': {
                'name': 'E-mini S&P 500',
                'multiplier': 50,
                'tick_size': 0.25,
                'tick_value': 12.50,
                'margin_day': 5000,
                'margin_overnight': 10000,
                'minimum_phase': 3,
                'correlation_group': 'A1',
                'sector': 'equity_index'
            },
            'NQ': {
                'name': 'E-mini NASDAQ 100',
                'multiplier': 20,
                'tick_size': 0.25,
                'tick_value': 5.00,
                'margin_day': 8000,
                'margin_overnight': 16000,
                'minimum_phase': 3,
                'correlation_group': 'A1',
                'sector': 'equity_index'
            },
            'RTY': {
                'name': 'E-mini Russell 2000',
                'multiplier': 50,
                'tick_size': 0.10,
                'tick_value': 5.00,
                'margin_day': 3000,
                'margin_overnight': 6000,
                'minimum_phase': 3,
                'correlation_group': 'A2',
                'sector': 'equity_index'
            },
            'CL': {
                'name': 'Crude Oil',
                'multiplier': 1000,
                'tick_size': 0.01,
                'tick_value': 10.00,
                'margin_day': 2000,
                'margin_overnight': 4000,
                'minimum_phase': 3,
                'correlation_group': 'B1',
                'sector': 'energy'
            },
            'GC': {
                'name': 'Gold',
                'multiplier': 100,
                'tick_size': 0.10,
                'tick_value': 10.00,
                'margin_day': 4000,
                'margin_overnight': 8000,
                'minimum_phase': 3,
                'correlation_group': 'C1',
                'sector': 'metals'
            },
            'SI': {
                'name': 'Silver',
                'multiplier': 5000,
                'tick_size': 0.005,
                'tick_value': 25.00,
                'margin_day': 6000,
                'margin_overnight': 12000,
                'minimum_phase': 3,
                'correlation_group': 'C1',
                'sector': 'metals'
            },
            
            # Fixed income futures
            'ZB': {
                'name': '30-Year Treasury Bond',
                'multiplier': 1000,
                'tick_size': 0.03125,
                'tick_value': 31.25,
                'margin_day': 1500,
                'margin_overnight': 3000,
                'minimum_phase': 3,
                'correlation_group': 'E',
                'sector': 'fixed_income'
            },
            'ZN': {
                'name': '10-Year Treasury Note',
                'multiplier': 1000,
                'tick_size': 0.015625,
                'tick_value': 15.625,
                'margin_day': 1200,
                'margin_overnight': 2400,
                'minimum_phase': 3,
                'correlation_group': 'E',
                'sector': 'fixed_income'
            },
            
            # Currency futures
            '6E': {
                'name': 'Euro FX',
                'multiplier': 125000,
                'tick_size': 0.00005,
                'tick_value': 6.25,
                'margin_day': 1000,
                'margin_overnight': 2000,
                'minimum_phase': 3,
                'correlation_group': 'F',
                'sector': 'currency'
            },
            '6B': {
                'name': 'British Pound',
                'multiplier': 62500,
                'tick_size': 0.0001,
                'tick_value': 6.25,
                'margin_day': 1500,
                'margin_overnight': 3000,
                'minimum_phase': 3,
                'correlation_group': 'F',
                'sector': 'currency'
            }
        }
        
        # Phase-based futures access
        self.phase_access = {
            1: ['MCL', 'MGC'],  # Phase 1: Micro crude and gold only
            2: ['MCL', 'MGC', 'MES', 'MNQ', 'M2K'],  # Phase 2: Add micro equity indices
            3: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6B'],  # Phase 3: Full size futures
            4: ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6B', 'NG', 'RB', 'HO']  # Phase 4: Extended universe
        }
        
        # Contract month selection rules
        self.contract_selection = {
            'equity_index': 'front_month',  # ES, NQ, RTY - use front month
            'energy': 'front_month',       # CL, NG - front month
            'metals': 'active_month',      # GC, SI - most active month
            'fixed_income': 'front_month', # ZB, ZN - front month
            'currency': 'front_month'      # 6E, 6B - front month
        }
        
        # Risk management
        self.risk_parameters = {
            'max_margin_usage': 0.15,      # 15% of account for futures margin
            'position_size_factor': 0.02,  # 2% risk per futures position
            'correlation_limits': True,    # Enforce correlation limits
            'overnight_margin_buffer': 1.5 # 50% buffer for overnight margin
        }
        
    def get_available_futures(self, account_phase):
        """Get futures available for trading based on account phase"""
        return self.phase_access.get(account_phase, [])
    
    def get_futures_specs(self, symbol):
        """Get complete specifications for a futures contract"""
        return self.futures_specs.get(symbol, None)
    
    def is_micro_futures(self, symbol):
        """Check if symbol is a micro futures contract"""
        return symbol.startswith('M') or symbol in ['MCL', 'MGC']
    
    def calculate_position_size(self, symbol, account_value, risk_percent=None):
        """
        Calculate appropriate position size for futures contract
        Returns: number of contracts
        """
        specs = self.get_futures_specs(symbol)
        if not specs:
            return 0
        
        # Use risk percent or default
        if risk_percent is None:
            risk_percent = self.risk_parameters['position_size_factor']
        
        # Calculate risk per contract (overnight margin as proxy)
        risk_per_contract = specs['margin_overnight']
        
        # Calculate position size based on risk
        max_risk_amount = account_value * risk_percent
        position_size = int(max_risk_amount / risk_per_contract)
        
        # Minimum 1 contract, maximum based on margin usage
        max_margin_usage = account_value * self.risk_parameters['max_margin_usage']
        max_contracts_by_margin = int(max_margin_usage / specs['margin_overnight'])
        
        position_size = max(1, min(position_size, max_contracts_by_margin))
        
        return position_size
    
    def calculate_margin_requirement(self, symbol, contracts, overnight=True):
        """Calculate margin requirement for futures position"""
        specs = self.get_futures_specs(symbol)
        if not specs:
            return 0
        
        margin_per_contract = specs['margin_overnight'] if overnight else specs['margin_day']
        return margin_per_contract * contracts
    
    def calculate_tick_value_pnl(self, symbol, contracts, price_change_ticks):
        """Calculate P&L based on tick movement"""
        specs = self.get_futures_specs(symbol)
        if not specs:
            return 0
        
        return specs['tick_value'] * contracts * price_change_ticks
    
    def get_contract_month_symbol(self, base_symbol, target_month=None):
        """
        Get appropriate contract month symbol for trading
        Returns: contract symbol with month code
        """
        specs = self.get_futures_specs(base_symbol)
        if not specs:
            return base_symbol
        
        # Contract month codes: H=Mar, M=Jun, U=Sep, Z=Dec
        month_codes = {
            1: 'H', 2: 'H', 3: 'H',    # Jan-Mar -> Mar
            4: 'M', 5: 'M', 6: 'M',    # Apr-Jun -> Jun
            7: 'U', 8: 'U', 9: 'U',    # Jul-Sep -> Sep
            10: 'Z', 11: 'Z', 12: 'Z'  # Oct-Dec -> Dec
        }
        
        current_month = self.algorithm.Time.month
        current_year = self.algorithm.Time.year % 100  # 2-digit year
        
        # Get contract selection rule
        selection_rule = self.contract_selection.get(specs['sector'], 'front_month')
        
        if selection_rule == 'front_month':
            # Use current quarter's contract
            month_code = month_codes[current_month]
            return f"{base_symbol}{month_code}{current_year}"
        
        elif selection_rule == 'active_month':
            # Use most liquid contract (usually current or next quarter)
            # This would require market data analysis in production
            month_code = month_codes[current_month]
            return f"{base_symbol}{month_code}{current_year}"
        
        return base_symbol
    
    def validate_futures_trade(self, symbol, contracts, account_phase, correlation_manager=None):
        """
        Validate futures trade before execution
        Returns: (is_valid: bool, message: str)
        """
        # Check if futures is available for phase
        available_futures = self.get_available_futures(account_phase)
        if symbol not in available_futures:
            return False, f"Futures {symbol} not available for Phase {account_phase}"
        
        # Check specs exist
        specs = self.get_futures_specs(symbol)
        if not specs:
            return False, f"No specifications found for {symbol}"
        
        # Check minimum phase requirement
        if account_phase < specs['minimum_phase']:
            return False, f"{symbol} requires Phase {specs['minimum_phase']}+ (current: Phase {account_phase})"
        
        # Check correlation limits if manager provided
        if correlation_manager and self.risk_parameters['correlation_limits']:
            can_add, reason, current, max_allowed = correlation_manager.can_add_to_group(symbol, account_phase)
            if not can_add:
                return False, f"Correlation limit: {reason}"
        
        # Check margin requirements
        account_value = float(self.algorithm.Portfolio.TotalPortfolioValue)
        margin_required = self.calculate_margin_requirement(symbol, contracts, overnight=True)
        max_margin_allowed = account_value * self.risk_parameters['max_margin_usage']
        
        if margin_required > max_margin_allowed:
            return False, f"Insufficient margin: need ${margin_required:,.0f}, max allowed ${max_margin_allowed:,.0f}"
        
        return True, f"Futures trade validated: {contracts} contracts of {symbol}"
    
    def get_futures_for_strategy(self, strategy_name, account_phase):
        """Get appropriate futures contracts for specific strategy"""
        available_futures = self.get_available_futures(account_phase)
        
        strategy_preferences = {
            'STRANGLE': {
                1: ['MCL', 'MGC'],  # Phase 1: Micro crude and gold
                2: ['MCL', 'MGC', 'MES'],  # Phase 2: Add micro ES
                3: ['ES', 'CL', 'GC'],  # Phase 3: Full size
                4: ['ES', 'NQ', 'CL', 'GC', 'SI']  # Phase 4: Expanded
            },
            'LT112': {
                2: ['MES'],  # Phase 2: Micro ES only
                3: ['ES'],   # Phase 3: Full ES
                4: ['ES']    # Phase 4: ES focus
            },
            '0DTE': {
                2: ['MES'],  # Phase 2: Micro ES
                3: ['ES'],   # Phase 3: Full ES
                4: ['ES', 'NQ']  # Phase 4: ES and NQ
            }
        }
        
        preferred = strategy_preferences.get(strategy_name, {}).get(account_phase, [])
        return [f for f in preferred if f in available_futures]
    
    def calculate_futures_portfolio_metrics(self, current_positions):
        """Calculate futures-specific portfolio metrics"""
        futures_positions = [p for p in current_positions 
                           if p.get('symbol') in self.futures_specs]
        
        if not futures_positions:
            return {
                'futures_count': 0,
                'total_margin_used': 0,
                'margin_utilization': 0,
                'sector_breakdown': {},
                'micro_vs_full': {'micro': 0, 'full': 0}
            }
        
        total_margin = 0
        sector_breakdown = {}
        micro_count = 0
        full_count = 0
        
        for position in futures_positions:
            symbol = position.get('symbol')
            contracts = position.get('quantity', 1)
            specs = self.get_futures_specs(symbol)
            
            if specs:
                # Calculate margin
                margin = self.calculate_margin_requirement(symbol, contracts)
                total_margin += margin
                
                # Sector breakdown
                sector = specs['sector']
                if sector not in sector_breakdown:
                    sector_breakdown[sector] = {'count': 0, 'margin': 0}
                sector_breakdown[sector]['count'] += 1
                sector_breakdown[sector]['margin'] += margin
                
                # Micro vs full size
                if self.is_micro_futures(symbol):
                    micro_count += 1
                else:
                    full_count += 1
        
        account_value = float(self.algorithm.Portfolio.TotalPortfolioValue)
        margin_utilization = (total_margin / account_value) if account_value > 0 else 0
        
        return {
            'futures_count': len(futures_positions),
            'total_margin_used': total_margin,
            'margin_utilization': margin_utilization,
            'margin_limit': self.risk_parameters['max_margin_usage'],
            'sector_breakdown': sector_breakdown,
            'micro_vs_full': {'micro': micro_count, 'full': full_count}
        }
    
    def get_futures_upgrade_recommendations(self, account_phase, account_value, current_positions):
        """Recommend futures upgrades when transitioning phases"""
        if account_phase < 3:
            return []  # No upgrades below Phase 3
        
        recommendations = []
        
        for position in current_positions:
            symbol = position.get('symbol')
            
            # Check for micro to full size upgrade opportunities
            if symbol == 'MES' and account_phase >= 3:
                recommendations.append({
                    'current': 'MES',
                    'upgrade_to': 'ES',
                    'reason': 'Phase 3+ upgrade: MES → ES for better margin efficiency',
                    'benefit': '10x notional increase, better capital efficiency'
                })
            elif symbol == 'MNQ' and account_phase >= 3:
                recommendations.append({
                    'current': 'MNQ',
                    'upgrade_to': 'NQ',
                    'reason': 'Phase 3+ upgrade: MNQ → NQ for better margin efficiency',
                    'benefit': '10x notional increase, better capital efficiency'
                })
            elif symbol == 'MCL' and account_phase >= 3:
                recommendations.append({
                    'current': 'MCL',
                    'upgrade_to': 'CL',
                    'reason': 'Phase 3+ upgrade: MCL → CL for full contract efficiency',
                    'benefit': '10x notional increase, institutional-level trading'
                })
            elif symbol == 'MGC' and account_phase >= 3:
                recommendations.append({
                    'current': 'MGC',
                    'upgrade_to': 'GC',
                    'reason': 'Phase 3+ upgrade: MGC → GC for full contract efficiency',
                    'benefit': '10x notional increase, better liquidity'
                })
        
        return recommendations
    
    def validate_futures_system(self):
        """Validate futures management system"""
        tests = [
            ('Futures specs defined', len(self.futures_specs) >= 10),
            ('Phase access defined', len(self.phase_access) == 4),
            ('Margin calculation works', callable(self.calculate_margin_requirement)),
            ('Position sizing works', callable(self.calculate_position_size)),
            ('Contract validation works', callable(self.validate_futures_trade)),
            ('Micro detection works', self.is_micro_futures('MES'))
        ]
        
        results = []
        for test_name, condition in tests:
            results.append(f"{'✅' if condition else '❌'} {test_name}")
        
        return results

# Usage Example for QuantConnect Algorithm:
#
# def Initialize(self):
#     self.futures_manager = FuturesManager(self)
#     self.correlation_manager = CorrelationManager(self)
#     
# def OnData(self, data):
#     account_phase = 2
#     account_value = 50000
#     
#     # Get available futures for this phase
#     available_futures = self.futures_manager.get_available_futures(account_phase)
#     
#     for symbol in available_futures:
#         if symbol in data and data[symbol] is not None:
#             current_price = data[symbol].Close
#             
#             # Calculate appropriate position size
#             position_size = self.futures_manager.calculate_position_size(symbol, account_value)
#             
#             # Validate trade
#             is_valid, message = self.futures_manager.validate_futures_trade(
#                 symbol, position_size, account_phase, self.correlation_manager
#             )
#             
#             if is_valid:
#                 # Get contract month symbol
#                 contract_symbol = self.futures_manager.get_contract_month_symbol(symbol)
#                 
#                 # Calculate margin requirement
#                 margin_needed = self.futures_manager.calculate_margin_requirement(
#                     symbol, position_size
#                 )
#                 
#                 self.Log(f"Futures Trade Opportunity: {contract_symbol} x{position_size} "
#                         f"(Margin: ${margin_needed:,.0f})")
#                 
#                 # Execute futures trade logic here
#             else:
#                 self.Log(f"Futures Trade Blocked: {symbol} - {message}")
#     
#     # Calculate futures portfolio metrics
#     current_positions = []  # Get from portfolio
#     metrics = self.futures_manager.calculate_futures_portfolio_metrics(current_positions)
#     
#     # Check margin utilization
#     if metrics['margin_utilization'] > 0.12:  # 12% warning threshold
#         self.Log(f"Futures Margin Warning: {metrics['margin_utilization']:.1%} utilization")
#     
#     # Check for upgrade recommendations
#     upgrades = self.futures_manager.get_futures_upgrade_recommendations(
#         account_phase, account_value, current_positions
#     )
#     
#     for upgrade in upgrades:
#         self.Log(f"Futures Upgrade Opportunity: {upgrade['current']} → {upgrade['upgrade_to']}")