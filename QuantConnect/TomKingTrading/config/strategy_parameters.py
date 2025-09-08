# region imports
from AlgorithmImports import *
# endregion
# Tom King Trading Framework v17 - Configuration Parameters
# Extracted from Tom King Complete Trading System Documentation

class TomKingParameters:
    """
    Tom King Trading Framework Parameters for QuantConnect LEAN
    Based on 30+ years of proven systematic trading methodology
    """
    
    # Account Phase Configuration (USD - rounded to nearest 5k for ease)
    # ES contracts from Phase 1 ($40k+), MES only for accounts under $40k
    ACCOUNT_PHASES = {
        'phase1': {'min': 40000, 'max': 55000, 'description': 'ES 0DTE, IPMCC, MCL/MGC strangles'},  # $40k-$55k
        'phase2': {'min': 55000, 'max': 75000, 'description': 'Scale ES positions, add MNQ futures'},  # $55k-$75k  
        'phase3': {'min': 75000, 'max': 95000, 'description': 'Advanced strategies, multiple ES contracts'},  # $75k-$95k
        'phase4': {'min': 95000, 'max': 999999, 'description': 'Professional deployment, maximum BP utilization'},  # $95k+
        'mes_only': {'min': 0, 'max': 40000, 'description': 'MES contracts only for small accounts under $40k'}  # Under $40k = MES
    }
    
    # VIX BP Limits - REMOVED: Use risk.position_sizing.PositionSizer instead
    
    # VIX BP Usage - REMOVED: Use risk.position_sizing.PositionSizer instead
    
    # Strategy Win Rates (Historical Performance)
    STRATEGY_WIN_RATES = {
        'zero_dte_friday': 0.88,      # 88% - Tom King's signature strategy
        'lt112_long_term': 0.95,      # 95% - 1-1-2 Long Term
        'strangles_futures': 0.70,    # 70% - Futures strangles
        'strangles_micro': 0.75,      # 75% - Micro futures
        'butterflies': 0.82,          # 82% - Section 9B butterflies
        'iron_condors': 0.78,         # 78% - Iron condors
        'calendar_spreads': 0.85,     # 85% - Calendar spreads
        'jade_lizard': 0.80,          # 80% - Jade lizard
        'big_lizard': 0.77,           # 77% - Big lizard
        'broken_wing_butterfly': 0.83 # 83% - BWB
    }
    
    # Profit Targets by Strategy
    PROFIT_TARGETS = {
        'zero_dte_friday': 0.50,      # 50% profit target
        'lt112_long_term': 0.50,      # 50% profit target
        'strangles_futures': 0.50,    # 50% profit target
        'strangles_micro': 0.50,      # 50% profit target
        'butterflies': 0.25,          # 25% profit target
        'iron_condors': 0.50,         # 50% profit target
        'calendar_spreads': 0.30,     # 30% profit target
        'jade_lizard': 0.50,          # 50% profit target
        'big_lizard': 0.50,           # 50% profit target
        'broken_wing_butterfly': 0.25 # 25% profit target
    }
    
    # Stop Loss by Strategy
    STOP_LOSS = {
        'zero_dte_friday': 2.00,      # 200% stop loss (2x credit received)
        'lt112_long_term': 2.00,      # 200% stop loss
        'strangles_futures': 2.50,    # 250% stop loss
        'strangles_micro': 2.50,      # 250% stop loss
        'butterflies': 3.00,          # 300% stop loss
        'iron_condors': 2.00,         # 200% stop loss
        'calendar_spreads': 1.50,     # 150% stop loss
        'jade_lizard': 2.00,          # 200% stop loss
        'big_lizard': 2.00,           # 200% stop loss
        'broken_wing_butterfly': 3.00 # 300% stop loss
    }
    
    # Days to Expiration Management
    DTE_MANAGEMENT = {
        'zero_dte': 0,                # Same day expiration
        'defensive_exit': 21,         # 21 DTE defensive management
        'lt112_entry': 120,           # 120 DTE entry for LT 1-1-2
        'strangle_entry': 30,         # 30 DTE for strangles
        'butterfly_entry': 30,        # 30 DTE for butterflies
        'calendar_entry': 45          # 45 DTE for calendars
    }
    
    # Risk Management Rules
    RISK_MANAGEMENT = {
        'max_risk_per_trade': 0.05,   # 5% maximum risk per trade
        'max_bp_usage': 0.80,         # 80% maximum BP (VIX adjusted - can reach 80% in normal VIX)
        'max_correlated_positions': 3, # Maximum 3 positions per correlation group
        'correlation_groups': [
            ['SPY', 'QQQ', 'IWM', 'DIA'],  # Equity indices
            ['GLD', 'GDX', 'SLV'],         # Precious metals
            ['TLT', 'TBT', 'IEF'],         # Fixed income
            ['XLE', 'XOP', 'USO'],         # Energy
            ['VIX', 'UVXY', 'VXX']         # Volatility
        ],
        'vix_spike_protection': True,  # Enable VIX spike protection
        'earnings_avoidance': True,    # Avoid positions through earnings
        'fed_announcement_protection': True # Fed announcement protection
    }
    
    # Trading Schedule (US Eastern Time)
    TRADING_SCHEDULE = {
        'market_open': '09:30',
        'zero_dte_start': '10:30',    # No 0DTE before 10:30 AM
        'zero_dte_end': '15:00',      # No new 0DTE after 3:00 PM
        'friday_only_zero_dte': True, # 0DTE only on Fridays
        'avoid_fomc_days': True,      # Avoid FOMC announcement days
        'avoid_cpi_days': True        # Avoid CPI release days
    }
    
    # Complete Symbol Universe by Phase (From Tom King Framework v17)
    SYMBOL_UNIVERSE = {
        'phase1': {  # $40k-55k: Foundation phase - equity options + micro futures
            'futures': ['MCL', 'MGC'],                # Micro crude, gold for strangles
            'etfs': ['GLD', 'TLT'],                   # ETF options for diversification
            'equity_options': ['SPY', 'QQQ', 'IWM'],  # IPMCC options only (0DTE uses futures)
            'zero_dte': ['MES'],                      # Friday 0DTE MES futures (under $40k)
            'correlation_groups': ['A1', 'C1', 'E'],  # Equity, Metals, Bonds
            'max_products': 6
        },
        'phase2': {  # $55k-75k: Expansion phase - add micro equity futures
            'futures': ['MCL', 'MGC', 'MES', 'MNQ', 'M6E', 'M6A', 'M6B'], # Add micro ES, NQ
            'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'XOP'],
            'equity_options': ['SPY', 'QQQ', 'IWM'],
            'zero_dte': ['ES'],                       # Friday 0DTE ES futures
            'correlation_groups': ['A1', 'C1', 'E', 'B1'],  # Add equity, energy
            'max_products': 12
        },
        'phase3': {  # $75k-95k: Optimization phase - full size futures
            'futures': ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', '6E', '6B', '6A'], 
            'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX', 'XLE', 'XOP', 'GDXJ'],
            'equity_options': ['SPY', 'QQQ', 'IWM', 'DIA', 'XLE'],
            'zero_dte': ['ES', 'NQ'],                 # ES/NQ futures 0DTE
            'agriculture': ['ZC', 'ZS', 'ZW', 'LE', 'HE'],  # Add agriculture
            'correlation_groups': ['A1', 'A2', 'B1', 'C1', 'D1', 'E', 'F'],
            'max_products': 20
        },
        'phase4': {  # $95k+: Professional deployment - full universe
            'futures': [
                # Equity indices
                'ES', 'NQ', 'RTY', 'MES', 'MNQ', 'M2K',
                # Energy complex  
                'CL', 'NG', 'RB', 'HO', 'MCL', 'MGC',
                # Metals
                'GC', 'SI', 'HG', 'PA', 'PL',
                # Agriculture
                'ZC', 'ZS', 'ZW', 'ZM', 'ZL', 'LE', 'HE', 'KC', 'SB', 'CC', 'CT',
                # Fixed income
                'ZB', 'ZN', 'ZF', 'ZT',
                # Currencies
                '6E', '6B', '6A', '6C', '6J', '6S', '6M', 'DX'
            ],
            'etfs': [
                # Equity
                'SPY', 'QQQ', 'IWM', 'DIA', 'EFA', 'EEM', 'VTI',
                # Sector
                'XLE', 'XOP', 'XLF', 'XLK', 'XLV', 'XLI', 'XLU', 'XLB', 'XLP', 'XLY',
                # Metals/Commodities  
                'GLD', 'SLV', 'GDXJ', 'GDX', 'SILJ', 'DBA', 'DBC', 'USO', 'UNG',
                # Fixed income
                'TLT', 'TBT', 'IEF', 'SHY', 'LQD', 'HYG', 'TIP',
                # International
                'FXI', 'EWZ', 'EWJ', 'EWG', 'EWU', 'RSX'
            ],
            'equity_options': [
                'SPY', 'QQQ', 'IWM', 'DIA', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL'
            ],
            'zero_dte': ['ES', 'NQ'],                 # ES/NQ futures 0DTE only
            'spx_options': True,  # SPX available for box spreads
            'correlation_groups': ['A1', 'A2', 'B1', 'C1', 'D1', 'E', 'F', 'G'],
            'max_products': 50
        }
    }
    
    # Phase Transition Requirements
    PHASE_TRANSITIONS = {
        'phase1_to_2': {
            'account_minimum': 55000,  # $55k (matches ACCOUNT_PHASES)
            'required_months': 2,      # Must be in phase 1 for 2 months minimum
            'win_rate_minimum': 0.60,  # 60% win rate required
            'max_drawdown_limit': 0.15 # 15% max drawdown
        },
        'phase2_to_3': {
            'account_minimum': 75000,  # $75k (matches ACCOUNT_PHASES)
            'required_months': 3,      # Must demonstrate consistency
            'win_rate_minimum': 0.65,  # Higher standards
            'max_drawdown_limit': 0.12
        },
        'phase3_to_4': {
            'account_minimum': 95000,  # $95k (matches ACCOUNT_PHASES)
            'required_months': 4,      # Professional standards
            'win_rate_minimum': 0.70,  # 70% win rate
            'max_drawdown_limit': 0.10 # 10% max drawdown
        }
    }
    
    # Futures Contract Specifications (for proper sizing)
    FUTURES_SPECS = {
        # Micro futures (Phase 1-2)
        'MES': {'multiplier': 5, 'tick_size': 0.25, 'tick_value': 1.25, 'margin_day': 500, 'margin_overnight': 1000},
        'MNQ': {'multiplier': 2, 'tick_size': 0.25, 'tick_value': 0.50, 'margin_day': 800, 'margin_overnight': 1600},
        'M2K': {'multiplier': 5, 'tick_size': 0.10, 'tick_value': 0.50, 'margin_day': 300, 'margin_overnight': 600},
        'MCL': {'multiplier': 100, 'tick_size': 0.01, 'tick_value': 1.00, 'margin_day': 200, 'margin_overnight': 400},
        'MGC': {'multiplier': 10, 'tick_size': 0.10, 'tick_value': 1.00, 'margin_day': 400, 'margin_overnight': 800},
        
        # Full size futures (Phase 3+)
        'ES': {'multiplier': 50, 'tick_size': 0.25, 'tick_value': 12.50, 'margin_day': 5000, 'margin_overnight': 10000},
        'NQ': {'multiplier': 20, 'tick_size': 0.25, 'tick_value': 5.00, 'margin_day': 8000, 'margin_overnight': 16000},
        'RTY': {'multiplier': 50, 'tick_size': 0.10, 'tick_value': 5.00, 'margin_day': 3000, 'margin_overnight': 6000},
        'CL': {'multiplier': 1000, 'tick_size': 0.01, 'tick_value': 10.00, 'margin_day': 2000, 'margin_overnight': 4000},
        'GC': {'multiplier': 100, 'tick_size': 0.10, 'tick_value': 10.00, 'margin_day': 4000, 'margin_overnight': 8000},
        'SI': {'multiplier': 5000, 'tick_size': 0.005, 'tick_value': 25.00, 'margin_day': 6000, 'margin_overnight': 12000},
        
        # Fixed income
        'ZB': {'multiplier': 1000, 'tick_size': 0.03125, 'tick_value': 31.25, 'margin_day': 1500, 'margin_overnight': 3000},
        'ZN': {'multiplier': 1000, 'tick_size': 0.015625, 'tick_value': 15.625, 'margin_day': 1200, 'margin_overnight': 2400},
        
        # Currencies  
        '6E': {'multiplier': 125000, 'tick_size': 0.00005, 'tick_value': 6.25, 'margin_day': 1000, 'margin_overnight': 2000},
        '6B': {'multiplier': 62500, 'tick_size': 0.0001, 'tick_value': 6.25, 'margin_day': 1500, 'margin_overnight': 3000}
    }
    
    # Performance Targets
    PERFORMANCE_TARGETS = {
        'monthly_return': 0.067,      # 6.67% monthly (12% compounded)
        'annual_return': 1.28,        # 128% annually
        'max_drawdown': 0.15,         # 15% maximum drawdown
        'sharpe_ratio_min': 2.0,      # Minimum Sharpe ratio
        'goal_8_months': 102000,      # $102k in 8 months from $44.5k
        'goal_18_months': 127000      # $127k in 18 months
    }
    
    # 0DTE Strategy Configuration (Tom King Framework v17)
    # Friday ES futures options (NOT SPY) for maximum margin efficiency
    # Dynamic position sizing to MAXIMIZE BP utilization based on account size
    ZERO_DTE_CONFIG = {
        'execution_day': 'Friday',     # Friday only for 0DTE
        'entry_time': '10:30',         # No 0DTE before 10:30 AM
        'exit_time': '15:00',          # Close before 3:00 PM
        'contracts': {
            'ES': {
                'symbol': 'ES',
                'name': 'E-Mini S&P 500 Futures',
                'min_account': 40000,      # $40k minimum for ES
                'margin_per_spread': 1200, # ~$1,200 per ES 0DTE iron condor
                'target_bp_per_position': 0.08  # Target 8% BP per position
            },
            'MES': {
                'symbol': 'MES', 
                'name': 'Micro E-Mini S&P 500 Futures',
                'min_account': 0,          # No minimum for MES
                'max_account': 39999,      # Use MES under $40k only
                'margin_per_spread': 300,  # ~$300 per MES 0DTE iron condor  
                'target_bp_per_position': 0.10  # Target 10% BP per position (smaller size)
            }
        },
        'max_bp_usage_single_0dte': 0.25,  # Never exceed 25% BP on single 0DTE deployment
        'profit_target': 0.50,             # 50% profit target
        'stop_loss': 2.00,                 # 200% stop loss (2x credit received)
        'win_rate_target': 0.88            # 88% win rate expectation
    }
    
    # Currency Configuration
    CURRENCY = {
        'base': 'USD',                # US Dollar
        'quote': 'USD',               # US Dollar quotes
        'conversion_required': False,  # No conversion needed
        'initial_capital': 44500      # $44,500 starting capital
    }
    
    @classmethod
    def get_phase_for_account_size(cls, account_value):
        """Determine account phase based on current value"""
        for phase, config in cls.ACCOUNT_PHASES.items():
            if config['min'] <= account_value <= config['max']:
                # Handle special 'mes_only' phase for accounts under $40k
                if phase == 'mes_only':
                    return 0  # Phase 0 for MES-only accounts
                # Extract phase number from 'phase1', 'phase2', etc.
                if phase.startswith('phase'):
                    return int(phase.replace('phase', ''))
        return 4  # Default to highest phase
    
    @classmethod
    def get_bp_usage(cls, account_phase, vix_level):
        """Get buying power usage based on phase and VIX level (Tom King methodology)"""
        if vix_level < 12:
            regime = 'very_low'
        elif vix_level < 15:
            regime = 'low'
        elif vix_level < 20:
            regime = 'normal'
        elif vix_level < 30:
            regime = 'elevated'
        else:
            regime = 'high'
            
        # Use centralized position sizing instead
        from risk.position_sizing import PositionSizer
        # Return default values matching the old system
        regime_limits = {
            'very_low': 0.45,
            'low': 0.60,
            'normal': 0.80,
            'elevated': 0.80,
            'high': 0.60
        }
        return regime_limits.get(regime, 0.60)
        
    @classmethod
    def get_vix_regime_bp_limit(cls, vix_level):
        """Get maximum BP limit based on VIX level (Tom King Framework v17)"""
        if vix_level < 12:
            return 0.45  # 45% max
        elif vix_level < 15:
            return 0.60  # 60% max
        elif vix_level < 20:
            return 0.80  # 80% max
        elif vix_level < 30:
            return 0.80  # 80% max
        else:
            return 0.60  # 60% max (high VIX protection)
    
    @classmethod
    def get_symbols_for_phase(cls, account_phase):
        """Get available symbols for trading based on account phase"""
        return cls.SYMBOL_UNIVERSE.get(account_phase, cls.SYMBOL_UNIVERSE['phase1'])
        
    @classmethod
    def get_zero_dte_contract(cls, account_value):
        """Get the appropriate 0DTE contract (ES or MES) based on account size"""
        if account_value >= cls.ZERO_DTE_CONFIG['contracts']['ES']['min_account']:
            return 'ES'
        else:
            return 'MES'
            
    @classmethod 
    def calculate_max_zero_dte_positions(cls, account_value, vix_level, buying_power):
        """Calculate maximum 0DTE positions based on account size, VIX, and available BP"""
        # Get the appropriate contract
        contract = cls.get_zero_dte_contract(account_value)
        contract_config = cls.ZERO_DTE_CONFIG['contracts'][contract]
        
        # Get VIX-based BP limit
        max_bp_limit = cls.get_vix_regime_bp_limit(vix_level)
        available_bp = buying_power * max_bp_limit
        
        # Calculate positions based on margin requirement
        margin_per_position = contract_config['margin_per_spread']
        max_positions_by_margin = int(available_bp / margin_per_position)
        
        # Limit by maximum BP usage per single 0DTE deployment
        max_bp_for_0dte = buying_power * cls.ZERO_DTE_CONFIG['max_bp_usage_single_0dte']
        max_positions_by_limit = int(max_bp_for_0dte / margin_per_position)
        
        # Return the smaller of the two limits
        return min(max_positions_by_margin, max_positions_by_limit)
    
    @staticmethod
    def gbp_to_usd(gbp_amount: float, rate: float = 1.27) -> float:
        """Convert GBP to USD (for reference - all phases now use USD)"""
        return gbp_amount * rate
    
    @staticmethod
    def usd_to_gbp(usd_amount: float, rate: float = 1.27) -> float:
        """Convert USD to GBP (for reference only)"""
        return usd_amount / rate
    
    @classmethod
    def validate_phase_consistency(cls) -> bool:
        """Validate that all phase definitions are consistent in USD"""
        # Check that ACCOUNT_PHASES and PHASE_TRANSITIONS are aligned
        transitions = cls.PHASE_TRANSITIONS
        phases = cls.ACCOUNT_PHASES
        
        # Phase 1 to 2 transition should match phase2 minimum
        if transitions['phase1_to_2']['account_minimum'] != phases['phase2']['min']:
            return False
            
        # Phase 2 to 3 transition should match phase3 minimum  
        if transitions['phase2_to_3']['account_minimum'] != phases['phase3']['min']:
            return False
            
        # Phase 3 to 4 transition should match phase4 minimum
        if transitions['phase3_to_4']['account_minimum'] != phases['phase4']['min']:
            return False
            
        return True

# Usage Examples:
# parameters = TomKingParameters()
# current_phase = parameters.get_phase_for_account_size(45000)  # Returns 2 for $45k account
# bp_usage = parameters.get_bp_usage('phase2', 18)  # Returns 0.80 for VIX 18 (normal regime)  
# max_bp = parameters.get_vix_regime_bp_limit(18)  # Returns 0.80 for VIX 18
# contract = parameters.get_zero_dte_contract(45000)  # Returns 'ES' for $45k account
# max_positions = parameters.calculate_max_zero_dte_positions(45000, 18, 45000)  # Calculate max positions