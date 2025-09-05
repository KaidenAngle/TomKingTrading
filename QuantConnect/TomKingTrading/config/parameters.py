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
    
    # Account Phase Configuration (USD)
    ACCOUNT_PHASES = {
        'phase1': {'min': 38100, 'max': 50800, 'description': 'MCL, MGC, GLD, TLT strangles'},  # £30k-£40k * 1.27
        'phase2': {'min': 50800, 'max': 76200, 'description': 'Add MES, MNQ, currency futures'},  # £40k-£60k * 1.27
        'phase3': {'min': 76200, 'max': 95250, 'description': 'Full futures, butterflies, spreads'},  # £60k-£75k * 1.27
        'phase4': {'min': 95250, 'max': 999999, 'description': 'Professional deployment, all strategies'}  # £75k+ * 1.27
    }
    
    # VIX Regime-Based Buying Power Usage
    VIX_BP_USAGE = {
        'phase1': {
            'very_low': 0.45,   # VIX < 15
            'low': 0.52,        # VIX 15-20
            'normal': 0.65,     # VIX 20-30
            'high': 0.75,       # VIX 30-40
            'very_high': 0.80   # VIX > 40
        },
        'phase2': {
            'very_low': 0.50,
            'low': 0.55,
            'normal': 0.65,
            'high': 0.75,
            'very_high': 0.80
        },
        'phase3': {
            'very_low': 0.52,
            'low': 0.60,
            'normal': 0.68,
            'high': 0.75,
            'very_high': 0.80
        },
        'phase4': {
            'very_low': 0.55,
            'low': 0.65,
            'normal': 0.70,
            'high': 0.78,
            'very_high': 0.82
        }
    }
    
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
        'zero_dte_friday': 0.25,      # 25% profit target
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
        'max_bp_usage': 0.35,         # 35% base maximum BP (VIX adjusted)
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
    
    # Symbol Universe by Phase
    SYMBOL_UNIVERSE = {
        'phase1': {
            'futures': ['MCL', 'MGC'],    # Micro crude, micro gold
            'etfs': ['GLD', 'TLT'],       # Gold, Treasury bonds
            'zero_dte': ['SPY', 'QQQ']    # 0DTE Fridays
        },
        'phase2': {
            'futures': ['MCL', 'MGC', 'MES', 'MNQ'], # Add micro ES, NQ
            'etfs': ['GLD', 'TLT', 'SLV', 'IWM'],
            'zero_dte': ['SPY', 'QQQ', 'IWM']
        },
        'phase3': {
            'futures': ['CL', 'GC', 'ES', 'NQ', 'RTY'], # Full size futures
            'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX'],
            'zero_dte': ['SPY', 'QQQ', 'IWM', 'DIA']
        },
        'phase4': {
            'futures': ['CL', 'GC', 'ES', 'NQ', 'RTY', 'ZB', 'ZN'],
            'etfs': ['GLD', 'TLT', 'SLV', 'IWM', 'GDX', 'XLE', 'XOP'],
            'zero_dte': ['SPY', 'QQQ', 'IWM', 'DIA', 'NVDA', 'TSLA']
        }
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
    
    # Currency Configuration
    CURRENCY = {
        'base': 'USD',                # US Dollar
        'quote': 'USD',               # US Dollar quotes
        'conversion_required': False,  # No conversion needed
        'initial_capital': 44500      # $44,500 starting capital (£35k * 1.27)
    }
    
    @classmethod
    def get_phase_for_account_size(cls, account_value):
        """Determine account phase based on current value"""
        for phase, config in cls.ACCOUNT_PHASES.items():
            if config['min'] <= account_value <= config['max']:
                return phase
        return 'phase4'  # Default to highest phase
    
    @classmethod
    def get_bp_usage(cls, account_phase, vix_level):
        """Get buying power usage based on phase and VIX level"""
        if vix_level < 15:
            regime = 'very_low'
        elif vix_level < 20:
            regime = 'low'
        elif vix_level < 30:
            regime = 'normal'
        elif vix_level < 40:
            regime = 'high'
        else:
            regime = 'very_high'
            
        return cls.VIX_BP_USAGE[account_phase][regime]
    
    @classmethod
    def get_symbols_for_phase(cls, account_phase):
        """Get available symbols for trading based on account phase"""
        return cls.SYMBOL_UNIVERSE.get(account_phase, cls.SYMBOL_UNIVERSE['phase1'])

# Usage Example:
# parameters = TomKingParameters()
# current_phase = parameters.get_phase_for_account_size(45000)  # Returns 'phase2'
# bp_usage = parameters.get_bp_usage('phase2', 25)  # Returns 0.65 for normal VIX
# symbols = parameters.get_symbols_for_phase('phase2')