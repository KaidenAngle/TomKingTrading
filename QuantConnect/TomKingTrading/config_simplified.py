# Tom King Trading Framework - Simplified Configuration
# Consolidates all configuration from multiple files into single dictionary
# Contains Tom King's proven parameters for £35,000 → £80,000 progression

from datetime import time

# Master Configuration Dictionary
# All Tom King parameters consolidated for easy maintenance
CONFIG = {
    # === CAPITAL AND PERFORMANCE TARGETS ===
    'starting_capital': 35000,          # £35,000 starting capital
    'target_capital': 80000,            # £80,000 target (128% return)
    'target_timeframe_months': 8,       # 8 months to target
    'target_monthly_return': 0.1143,    # 11.43% monthly average
    'max_drawdown': 0.085,              # 8.5% maximum drawdown
    'target_sharpe_ratio': 2.85,        # Expected Sharpe ratio
    
    # === RISK MANAGEMENT PARAMETERS ===
    'max_positions': 5,                 # Maximum concurrent positions
    'max_bp_usage': 0.50,              # Maximum 50% buying power usage
    'vix_threshold': 25,                # VIX regime threshold (HIGH/NORMAL)
    'profit_target': 0.50,              # 50% profit target
    'stop_loss': -2.00,                 # 200% loss limit
    'daily_loss_limit': 0.05,           # 5% daily loss limit (Phase 1)
    
    # === ACCOUNT PHASE SYSTEM ===
    'phase_thresholds': {
        1: 30000,   # Phase 1: £30k-40k (Basic strategies)
        2: 40000,   # Phase 2: £40k-60k (Add futures strangles)
        3: 60000,   # Phase 3: £60k-80k (Add advanced 0DTE)
        4: 80000    # Phase 4: £80k+ (All strategies)
    },
    
    'phase_max_position': {
        1: 0.20,    # 20% max position size
        2: 0.18,    # 18% max position size
        3: 0.15,    # 15% max position size
        4: 0.12     # 12% max position size
    },
    
    'phase_daily_limits': {
        1: 0.05,    # 5% daily loss limit
        2: 0.04,    # 4% daily loss limit
        3: 0.035,   # 3.5% daily loss limit
        4: 0.03     # 3% daily loss limit
    },
    
    # === STRATEGY SCHEDULING ===
    'friday_time': time(10, 30),        # Friday 0DTE entry time (10:30 AM ET)
    'friday_window_minutes': 30,        # 30-minute entry window
    'lt112_day': 2,                     # Wednesday (0=Monday) for LT112 entries
    'lt112_time': time(14, 0),          # 2:00 PM ET for LT112 entries
    'strangle_day': 15,                 # Mid-month (15th) for strangle entries
    'strangle_time': time(10, 0),       # 10:00 AM ET for strangle entries
    
    # === STRATEGY-SPECIFIC PARAMETERS ===
    
    # Friday 0DTE Strategy
    'friday_0dte': {
        'target_delta': 0.15,           # 15-20 delta strikes
        'min_credit': 0.20,             # Minimum $0.20 credit
        'max_credit': 0.50,             # Maximum $0.50 credit
        'strike_width': 5,              # $5 strike width
        'max_contracts': 5,             # Maximum 5 contracts
        'min_volume': 10,               # Minimum 10 volume
        'min_open_interest': 50,        # Minimum 50 open interest
        'win_rate_target': 0.785,       # 78.5% target win rate
        'avg_return_target': 0.023      # 2.3% average return target
    },
    
    # Long Term 112 Strategy  
    'lt112': {
        'target_dte': 120,              # 120 days to expiration
        'dte_tolerance': 7,             # ±7 days tolerance
        'rolling_dte': 21,              # Roll at 21 DTE
        'atr_multiplier': 0.7,          # ATR × 0.7 for strike selection
        'atr_periods': 20,              # 20-day ATR calculation
        'min_credit': 0.50,             # Minimum $0.50 credit
        'max_contracts': 3,             # Maximum 3 contracts
        'win_rate_target': 0.72,        # 72% target win rate
        'avg_return_target': 0.035      # 3.5% average return target
    },
    
    # Strangle Strategy (Equity Options)
    'strangle': {
        'target_dte': 45,               # 45 days to expiration
        'dte_tolerance': 7,             # ±7 days tolerance
        'target_delta': 0.20,           # 20 delta strikes
        'min_credit': 1.00,             # Minimum $1.00 credit
        'max_contracts': 2,             # Maximum 2 contracts
        'win_rate_target': 0.852,       # 85.2% target win rate
        'avg_return_target': 0.042      # 4.2% average return target
    },
    
    # === SYMBOL CONFIGURATION ===
    'core_symbols': ['SPY', 'QQQ', 'IWM'],  # Core underlying symbols
    'vix_symbol': 'VIX',                    # VIX for regime detection
    
    'symbol_phases': {
        1: ['SPY'],                     # Phase 1: SPY only
        2: ['SPY', 'QQQ'],             # Phase 2: Add QQQ
        3: ['SPY', 'QQQ', 'IWM'],      # Phase 3: Add IWM
        4: ['SPY', 'QQQ', 'IWM']       # Phase 4: All symbols
    },
    
    # === BROKERAGE CONFIGURATION ===
    'brokerage': 'TastyTrade',              # Primary brokerage
    'backup_brokerage': 'InteractiveBrokers', # Backup brokerage
    'commission_per_contract': 1.00,        # $1.00 per contract
    'regulatory_fees': 0.02,                # $0.02 per contract regulatory
    
    # === OPTION CHAIN FILTERING ===
    'option_filters': {
        'min_volume': 10,               # Minimum daily volume
        'min_open_interest': 50,        # Minimum open interest
        'max_bid_ask_spread': 0.10,     # Maximum $0.10 bid-ask spread
        'min_time_value': 0.05          # Minimum $0.05 time value
    },
    
    # === PORTFOLIO MANAGEMENT ===
    'rebalance_frequency': 'weekly',        # Weekly portfolio review
    'max_correlation': 0.70,                # Maximum 70% correlation between positions
    'position_timeout_days': 60,            # Close positions older than 60 days
    'emergency_vix_level': 40,              # Emergency stop if VIX > 40
    
    # === DATA AND TIMING ===
    'market_open': time(9, 30),             # Market open (9:30 AM ET)
    'market_close': time(16, 0),            # Market close (4:00 PM ET)
    'data_resolution': 'Minute',            # Data resolution
    'history_days': 252,                    # 1 year of history for calculations
    
    # === LOGGING AND MONITORING ===
    'log_level': 'INFO',                    # Logging level
    'max_log_entries': 10000,               # Maximum log entries
    'health_check_interval': 900,           # 15 minutes health checks
    'performance_report_frequency': 'daily', # Daily performance reports
    
    # === EMERGENCY PROCEDURES ===
    'emergency_stop_conditions': {
        'vix_spike': 40,                # VIX > 40
        'daily_loss': 0.10,             # 10% daily loss (circuit breaker)
        'margin_call_risk': 0.90,       # 90% margin usage
        'broker_disconnect': 300        # 5 minutes broker disconnect
    },
    
    # === TAX OPTIMIZATION (UK) ===
    'tax_settings': {
        'jurisdiction': 'UK',           # UK tax jurisdiction
        'tax_year_start': (4, 6),       # April 6th
        'annual_exemption': 6000,       # £6,000 annual exemption
        'currency_base': 'GBP',         # Base currency for tax
        'section_1256_election': True   # Use Section 1256 where applicable
    },
    
    # === VALIDATION TARGETS ===
    'validation_tolerances': {
        'win_rate_tolerance': 0.05,     # ±5% win rate tolerance
        'return_tolerance': 0.10,       # ±10% return tolerance
        'sharpe_tolerance': 0.20,       # ±20% Sharpe ratio tolerance
        'drawdown_tolerance': 0.02      # ±2% drawdown tolerance
    },
    
    # === STRATEGY MULTIPLIERS BY MARKET REGIME ===
    'regime_multipliers': {
        'NORMAL': {                     # VIX < 25
            'friday_0dte': 1.0,
            'lt112': 1.0,
            'strangle': 1.0
        },
        'HIGH': {                       # VIX >= 25
            'friday_0dte': 0.0,         # No Friday trades in high VIX
            'lt112': 0.5,               # Reduce LT112 by 50%
            'strangle': 0.3             # Reduce strangles by 70%
        }
    },
    
    # === SYSTEM HEALTH THRESHOLDS ===
    'health_thresholds': {
        'max_memory_mb': 512,           # 512MB memory limit
        'max_cpu_percent': 50,          # 50% CPU usage limit
        'max_api_calls_minute': 100,    # 100 API calls per minute
        'min_free_disk_gb': 1           # 1GB minimum free disk
    }
}

# Derived calculations (computed once at startup)
CONFIG['target_total_return'] = (CONFIG['target_capital'] / CONFIG['starting_capital']) - 1
CONFIG['max_position_value'] = CONFIG['starting_capital'] * CONFIG['phase_max_position'][1]
CONFIG['emergency_stop_value'] = CONFIG['starting_capital'] * (1 - CONFIG['emergency_stop_conditions']['daily_loss'])

# Validation function
def validate_config():
    """Validate configuration parameters for consistency"""
    errors = []
    
    # Basic validation
    if CONFIG['starting_capital'] <= 0:
        errors.append("Starting capital must be positive")
    
    if CONFIG['target_capital'] <= CONFIG['starting_capital']:
        errors.append("Target capital must exceed starting capital")
    
    if CONFIG['profit_target'] <= 0:
        errors.append("Profit target must be positive")
    
    if CONFIG['stop_loss'] >= 0:
        errors.append("Stop loss must be negative")
    
    # Phase validation
    phases = CONFIG['phase_thresholds']
    if not all(phases[i] < phases[i+1] for i in range(1, len(phases))):
        errors.append("Phase thresholds must be increasing")
    
    # Strategy parameter validation
    if CONFIG['friday_0dte']['min_credit'] >= CONFIG['friday_0dte']['max_credit']:
        errors.append("Friday 0DTE min credit must be less than max credit")
    
    return errors

# Auto-validate on import
_validation_errors = validate_config()
if _validation_errors:
    raise ValueError(f"Configuration errors: {_validation_errors}")

# Export commonly used values for convenience
STARTING_CAPITAL = CONFIG['starting_capital']
TARGET_CAPITAL = CONFIG['target_capital'] 
VIX_THRESHOLD = CONFIG['vix_threshold']
PROFIT_TARGET = CONFIG['profit_target']
STOP_LOSS = CONFIG['stop_loss']
MAX_POSITIONS = CONFIG['max_positions']