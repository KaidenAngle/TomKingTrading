"""
Tom King Trading Framework - Backtesting Configuration
QuantConnect LEAN Platform Implementation
"""

from datetime import datetime
from AlgorithmImports import *

class BacktestConfig:
    """Backtesting configuration for Tom King strategies"""
    
    # Backtest period settings
    BACKTEST_START_DATE = datetime(2023, 1, 1)  # 2-year backtest
    BACKTEST_END_DATE = datetime(2025, 1, 1)
    
    # Initial capital and currency
    STARTING_CASH = 100000  # $100,000 starting capital (increased for maximum strategy utilization)
    ACCOUNT_CURRENCY = "USD"  # QuantConnect standard currency
    
    # Data resolution settings
    EQUITY_RESOLUTION = Resolution.Minute
    OPTION_RESOLUTION = Resolution.Minute
    FUTURES_RESOLUTION = Resolution.Minute
    
    # Universe settings
    BACKTEST_SYMBOLS = {
        'equities': ['SPY', 'QQQ', 'IWM', 'DIA', 'TLT', 'GLD', 'SLV', 'USO', 'UNG'],
        'futures': ['ES', 'NQ', 'RTY', 'CL', 'GC', 'SI', 'ZB', 'ZN', 'ZF'],
        'micro_futures': ['MES', 'MNQ', 'MYM', 'MCL', 'MGC', 'SIL', 'M2K']
    }
    
    # Slippage and fee models
    SLIPPAGE_MODEL = {
        'equity_options': 0.01,  # $0.01 per contract
        'futures_options': 0.02,  # $0.02 per contract
        'futures': 0.25  # $0.25 per contract
    }
    
    COMMISSION_MODEL = {
        'tastytrade_options': 1.00,  # $1.00 per contract (opening)
        'tastytrade_futures': 2.50,  # $2.50 per contract
        'tastytrade_stocks': 0.00,  # $0 commission
        'assignment_fee': 5.00  # $5.00 per assignment
    }
    
    # Backtesting scenarios
    SCENARIOS = {
        'normal_market': {
            'name': 'Normal Market Conditions',
            'start': datetime(2023, 1, 1),
            'end': datetime(2023, 12, 31),
            'expected_return': 0.72,  # 72% annual (6% monthly)
            'max_drawdown': 0.10
        },
        'bull_market': {
            'name': 'Bull Market 2024',
            'start': datetime(2024, 1, 1),
            'end': datetime(2024, 7, 31),
            'expected_return': 0.50,  # 50% for 7 months
            'max_drawdown': 0.05
        },
        'august_2024_crash': {
            'name': 'August 2024 Volatility Event',
            'start': datetime(2024, 7, 1),
            'end': datetime(2024, 8, 31),
            'expected_return': -0.15,  # Expected controlled loss
            'max_drawdown': 0.15  # Our system limits to 15% vs Tom's 58%
        },
        'recovery_period': {
            'name': 'Post-Crash Recovery',
            'start': datetime(2024, 9, 1),
            'end': datetime(2024, 12, 31),
            'expected_return': 0.28,  # 28% recovery (7% monthly)
            'max_drawdown': 0.08
        }
    }
    
    # Performance benchmarks
    BENCHMARKS = {
        'target_monthly_return': 0.067,  # 6.67% to reach $101,600 (£80k * 1.27)
        'min_acceptable_return': 0.03,  # 3% minimum
        'max_monthly_loss': -0.15,  # 15% max loss
        'target_sharpe_ratio': 1.5,
        'target_win_rate': {
            'zero_dte': 0.88,
            'lt112': 0.95,
            'futures_strangles': 0.70,
            'overall': 0.80
        }
    }
    
    # Risk parameters for backtesting
    RISK_PARAMS = {
        'max_positions': {
            'phase_1': 3,
            'phase_2': 8,
            'phase_3': 12,
            'phase_4': 20
        },
        'max_bp_usage': {
            'vix_very_low': 0.45,
            'vix_low': 0.52,
            'vix_normal': 0.65,
            'vix_high': 0.75,
            'vix_extreme': 0.80
        },
        'correlation_limits': {
            'max_per_group': 3,
            'max_equity_concentration': 0.60,
            'max_sector_exposure': 0.40
        }
    }
    
    # Strategy activation schedule
    STRATEGY_SCHEDULE = {
        'zero_dte_friday': {
            'days': ['Friday'],
            'start_time': '10:30',
            'end_time': '15:00',
            'min_dte': 0,
            'max_dte': 0
        },
        'long_term_112': {
            'days': ['Wednesday'],  # First Wednesday of month
            'frequency': 'monthly',
            'target_dte': 45,
            'management_dte': 21
        },
        'futures_strangles': {
            'days': ['Monday', 'Thursday'],
            'target_dte': 90,
            'management_dte': 21
        }
    }
    
    # Reporting configuration
    REPORTING = {
        'generate_daily': True,
        'generate_weekly': True,
        'generate_monthly': True,
        'metrics_to_track': [
            'total_return',
            'monthly_returns',
            'win_rate',
            'average_win',
            'average_loss',
            'max_drawdown',
            'sharpe_ratio',
            'bp_usage',
            'correlation_breaches',
            'defensive_adjustments'
        ]
    }
    
    # Validation thresholds
    VALIDATION = {
        'min_trades_per_month': 10,
        'max_consecutive_losses': 5,
        'max_correlation_breach': 1,  # Per month
        'min_profit_factor': 1.5,
        'max_bp_breach': 0,  # Should never exceed limits
    }
    
    @classmethod
    def get_phase_for_balance(cls, balance):
        """Determine account phase based on balance (USD)"""
        if balance < 50800:  # $50,800 (£40k * 1.27)
            return 1
        elif balance < 76200:  # $76,200 (£60k * 1.27)
            return 2
        elif balance < 95250:  # $95,250 (£75k * 1.27)
            return 3
        else:
            return 4
    
    @classmethod
    def validate_backtest_results(cls, results):
        """Validate backtest meets Tom King expectations"""
        validations = {
            'monthly_return': results.get('avg_monthly_return', 0) >= cls.BENCHMARKS['min_acceptable_return'],
            'max_drawdown': results.get('max_drawdown', 1.0) <= 0.30,
            'win_rate': results.get('win_rate', 0) >= 0.70,
            'bp_compliance': results.get('bp_breaches', 1) == 0,
            'correlation_compliance': results.get('correlation_breaches', 100) <= 12  # Max 1 per month
        }
        
        return all(validations.values()), validations
    
    @classmethod
    def get_scenario_config(cls, scenario_name):
        """Get configuration for specific backtesting scenario"""
        return cls.SCENARIOS.get(scenario_name, cls.SCENARIOS['normal_market'])