# Tom King Trading Framework - Constants and Magic Numbers
# All magic numbers documented and centralized

from AlgorithmImports import *

class TradingConstants:
    """
    Centralized constants for Tom King Trading Framework
    All magic numbers documented with reasoning
    """
    
    # ==================== TIME CONSTANTS ====================
    
    # Trading Schedule
    MARKET_OPEN_HOUR = 9  # NYSE opens 9:30 AM ET
    MARKET_OPEN_MINUTE = 30
    MARKET_CLOSE_HOUR = 16  # NYSE closes 4:00 PM ET
    MARKET_CLOSE_MINUTE = 0
    
    # Strategy Entry Times
    FRIDAY_0DTE_ENTRY_HOUR = 10
    FRIDAY_0DTE_ENTRY_MINUTE = 30  # Tom King: Enter 0DTE after 10:30 AM to avoid opening volatility
    
    LT112_ENTRY_HOUR = 10
    LT112_ENTRY_MINUTE = 0  # Wednesday entries
    
    IPMCC_ENTRY_HOUR = 9
    IPMCC_ENTRY_MINUTE = 45  # Monthly first trading day
    
    FUTURES_STRANGLE_ENTRY_HOUR = 10
    FUTURES_STRANGLE_ENTRY_MINUTE = 15  # Thursday entries
    
    # ==================== DTE CONSTANTS ====================
    
    # Days to Expiration Management
    ZERO_DTE = 0  # Same day expiration for Friday theta capture
    DEFENSIVE_EXIT_DTE = 21  # Tom King: Exit all positions at 21 DTE to avoid gamma risk
    
    LT112_ENTRY_DTE = 120  # Tom King: Enter LT112 at 120 days
    LT112_TARGET_DTE_RANGE = 10  # Accept contracts within ±10 days of target
    
    FUTURES_STRANGLE_DTE = 90  # Tom King: 90 DTE for futures strangles
    IPMCC_LONG_CALL_MIN_DTE = 365  # LEAP minimum 1 year
    IPMCC_SHORT_CALL_DTE = 45  # Short call 45 DTE
    
    # ==================== PROFIT & LOSS TARGETS ====================
    
    # Profit Targets (as decimals)
    FRIDAY_0DTE_PROFIT_TARGET = 0.50  # Tom King: 50% profit target balances risk/reward
    LT112_PROFIT_TARGET = 0.50  # Tom King: 50% profit maximizes expected value
    FUTURES_STRANGLE_PROFIT_TARGET = 0.50  # 50% profit target
    IPMCC_PROFIT_TARGET = 0.50  # 50% on short calls
    
    # Stop Loss Levels (as decimals)
    FRIDAY_0DTE_STOP_LOSS = -2.00  # 200% stop: prevents catastrophic loss while allowing recovery
    LT112_STOP_LOSS = -2.00  # 200% stop: Tom King's tested optimal stop level
    LT112_LOSS_LIMIT = 200  # 200% loss limit prevents runaway losses
    FUTURES_STRANGLE_STOP_LOSS = -2.50  # 250% stop loss
    IPMCC_STOP_LOSS = -1.00  # 100% stop loss
    
    # ==================== WIN RATE TARGETS ====================
    
    # Historical Win Rate Targets
    FRIDAY_0DTE_WIN_RATE_TARGET = 0.88  # Tom King: 88% win rate from 2+ years backtesting
    LT112_WIN_RATE_TARGET = 0.95  # Tom King: 95% win rate with 5% OTM puts
    FUTURES_STRANGLE_WIN_RATE_TARGET = 0.70  # 70% win rate
    IPMCC_WIN_RATE_TARGET = 0.75  # 75% win rate
    
    # ==================== RISK MANAGEMENT ====================
    
    # Emergency Protocol Targets
    EMERGENCY_EXPOSURE_TARGET = 0.30  # 30% max exposure during emergency
    VIX_SPIKE_MAX_DEPLOYMENT = 0.20  # 20% max deployment during VIX spikes
    MAX_STRATEGY_ALLOCATION = 0.25  # 25% max allocation per strategy
    
    # VIX Thresholds (Tom King's 6-regime framework)
    VIX_EXTREMELY_LOW = 12  # Below 12: Premium too low, reduce positions
    VIX_LOW = 16  # 12-16: Low vol, normal sizing
    VIX_NORMAL = 20  # 16-20: Sweet spot for premium selling
    VIX_ELEVATED = 25  # 20-25: Elevated, best risk/reward for 0DTE
    VIX_HIGH = 30  # 25-30: High vol, reduce size but great premiums
    VIX_EXTREME = 35  # Above 35: Emergency protocols, minimal exposure
    
    # Position Limits
    MAX_POSITIONS_PER_CORRELATION_GROUP = 3  # Phase 4: Diversification limit
    MAX_POSITIONS_PER_CORRELATION_GROUP_EARLY = 2  # Phase 1-3: Conservative limit
    
    # Risk per Trade
    MAX_RISK_PER_TRADE = 0.05  # 5% max risk: Kelly Criterion with safety factor
    MAX_PORTFOLIO_DRAWDOWN = 0.15  # 15% max drawdown trigger for emergency exit
    
    # Buying Power Usage
    BASE_BP_USAGE = 0.35  # 35% BP: Leaves room for adjustments and margin requirements
    
    # VIX Spike Deployment - Scaled by account size
    # Tom King's £15k deployment = ~20% of £75k account
    VIX_SPIKE_BP_DEPLOYMENT_PCT = 0.20  # Deploy 20% during VIX spikes
    VIX_SPIKE_MIN_DEPLOYMENT = 5000  # Minimum $5k (protect small accounts)
    VIX_SPIKE_MAX_DEPLOYMENT = 50000  # Maximum $50k (prevent over-concentration)
    
    # ==================== GREEKS LIMITS ====================
    
    # Portfolio Greeks Limits
    MAX_PORTFOLIO_DELTA = 50  # Maximum net delta exposure
    MAX_PORTFOLIO_GAMMA = 5  # Maximum gamma exposure
    MAX_DAILY_THETA = -500  # Maximum theta decay per day ($)
    MAX_VEGA_EXPOSURE = 1000  # Maximum vega exposure
    DELTA_NEUTRAL_RANGE = 10  # Consider delta-neutral within ±10
    
    # Greeks Adjustment Thresholds
    DELTA_ADJUSTMENT_THRESHOLD = 0.20  # Adjust when position delta > 20%
    GAMMA_WARNING_THRESHOLD = 0.10  # Warn when gamma > 10% of portfolio
    THETA_ACCELERATION_THRESHOLD = -50  # Alert when daily theta < -$50
    VEGA_SPIKE_THRESHOLD = 100  # Alert when vega exposure spikes
    
    # ==================== OPTION CALCULATIONS ====================
    
    # Implied Volatility
    IV_DAILY_MOVE_MULTIPLIER = 0.0397  # Convert annual IV to 1-day expected move
    # Formula: Daily Move = Stock Price × IV × sqrt(1/252)
    # 0.0397 = sqrt(1/252) ≈ 0.063 × 0.63 (empirical adjustment for actual vs theoretical)
    
    DEFAULT_IMPLIED_VOLATILITY = 0.20  # 20% default IV if not available
    
    # Strike Selection
    IRON_CONDOR_SHORT_STRIKE_MULTIPLIER = 1.0  # 1 SD: ~68% probability of profit
    IRON_CONDOR_LONG_STRIKE_MULTIPLIER = 2.0  # 2 SD: ~95% probability wings stay OTM
    
    LT112_SHORT_PUT_1_MULTIPLIER = 0.95  # 5% OTM: Tom King's optimal for put #1
    LT112_SHORT_PUT_2_MULTIPLIER = 0.90  # 10% OTM: Tom King's optimal for put #2
    
    # ==================== MONEY MANAGEMENT ====================
    
    # Account Phases (Tom King's progressive scaling system)
    # USD converted from GBP at 1.27 USD/GBP rate
    PHASE1_MIN = 38100  # £30k: Learning phase, conservative sizing
    PHASE1_MAX = 50800  # £40k: Transition to Phase 2
    PHASE2_MIN = 50800  # $50,800 minimum (£40k * 1.27)
    PHASE2_MAX = 76200  # $76,200 maximum (£60k * 1.27)
    PHASE3_MIN = 76200  # $76,200 minimum (£60k * 1.27)
    PHASE3_MAX = 95250  # $95,250 maximum (£75k * 1.27)
    PHASE4_MIN = 95250  # $95,250 minimum (£75k * 1.27)
    
    # Income Targets (USD)
    MONTHLY_INCOME_TARGET_MIN = 2032  # $2,032 minimum (£1,600 * 1.27)
    MONTHLY_INCOME_TARGET_MAX = 2286  # $2,286 maximum (£1,800 * 1.27)
    MONTHLY_INCOME_TARGET_MID = 2159  # $2,159 target (£1,700 * 1.27)
    
    # Performance Targets
    ANNUAL_RETURN_TARGET = 1.28  # 128% annual: Tom King's achieved return
    SHARPE_RATIO_TARGET = 2.0  # Sharpe > 2: Professional-grade risk-adjusted returns
    
    # ==================== POSITION SIZING ====================
    
    # Minimum/Maximum Contracts
    # Kelly Criterion - Tom King uses conservative 0.25 factor
    KELLY_FACTOR = 0.25  # Conservative Kelly factor for risk management
    
    MIN_CONTRACTS_PER_TRADE = 1
    MAX_CONTRACTS_0DTE = 10  # Cap 0DTE risk: Limits gamma exposure
    MAX_CONTRACTS_LT112 = 5  # Cap LT112: 5 spreads = manageable assignment risk
    MAX_CONTRACTS_FUTURES = 3  # Cap futures: High leverage requires restraint
    
    # Credit Requirements
    MIN_CREDIT_IRON_CONDOR = 0.10  # Min $0.10: Ensures favorable risk/reward
    MIN_CREDIT_LT112 = 0.50  # Min $0.50: Tom King's minimum for profitability
    MIN_CREDIT_STRANGLE = 0.25  # Min $0.25: Covers commissions plus profit
    
    # ==================== DATA & CACHING ====================
    
    # Cache Settings
    GREEKS_CACHE_MINUTES = 5  # Cache Greeks for 5 minutes
    PRICE_HISTORY_DAYS = 20  # Keep 20 days of price history
    FILL_HISTORY_MAX = 1000  # Maximum fills to keep per order
    
    # Rolling Windows
    DAILY_RETURNS_WINDOW = 252  # 1 year of daily returns
    DRAWDOWN_HISTORY_WINDOW = 252  # 1 year of drawdown data
    
    # ==================== OPTIONS UNIVERSE ====================
    
    # Option Filter Parameters
    OPTION_STRIKE_RANGE_LOWER = -50  # 50 strikes below ATM
    OPTION_STRIKE_RANGE_UPPER = 50  # 50 strikes above ATM
    OPTION_MIN_DTE = 0  # Include 0DTE options
    OPTION_MAX_DTE = 180  # Up to 180 DTE for LT112
    
    # ==================== WARMUP & INITIALIZATION ====================
    
    # Warmup Period
    WARMUP_DAYS = 30  # 30 days warmup for indicators
    
    # ==================== COMMISSIONS & FEES ====================
    
    # TastyTrade Commission Structure (per contract)
    OPTION_COMMISSION_OPEN = 0.65  # Tom King: $0.65 to open per contract
    OPTION_COMMISSION_CLOSE = 0.65  # Tom King: $0.65 to close per contract
    OPTION_COMMISSION_MAX = 10.00  # $10 cap per leg: Helps with larger positions
    
    FUTURES_OPTION_COMMISSION = 2.50  # $2.50 per futures option
    
    @classmethod
    def get_vix_regime_name(cls, vix_level: float) -> str:
        """Get VIX regime name based on level"""
        if vix_level < cls.VIX_EXTREMELY_LOW:
            return "EXTREMELY_LOW"
        elif vix_level < cls.VIX_LOW:
            return "LOW"
        elif vix_level < cls.VIX_NORMAL:
            return "NORMAL"
        elif vix_level < cls.VIX_ELEVATED:
            return "ELEVATED"
        elif vix_level < cls.VIX_HIGH:
            return "HIGH"
        else:
            return "EXTREME"
    
    @classmethod
    def get_phase_limits(cls, phase: int) -> tuple:
        """Get account limits for a specific phase"""
        phase_limits = {
            1: (cls.PHASE1_MIN, cls.PHASE1_MAX),
            2: (cls.PHASE2_MIN, cls.PHASE2_MAX),
            3: (cls.PHASE3_MIN, cls.PHASE3_MAX),
            4: (cls.PHASE4_MIN, float('inf'))
        }
        return phase_limits.get(phase, (cls.PHASE1_MIN, cls.PHASE1_MAX))
    
    @classmethod
    def get_profit_target(cls, strategy: str) -> float:
        """Get profit target for a strategy"""
        targets = {
            'friday_0dte': cls.FRIDAY_0DTE_PROFIT_TARGET,
            'lt112': cls.LT112_PROFIT_TARGET,
            'futures_strangle': cls.FUTURES_STRANGLE_PROFIT_TARGET,
            'ipmcc': cls.IPMCC_PROFIT_TARGET
        }
        return targets.get(strategy, 0.50)  # Default 50%
    
    @classmethod
    def get_stop_loss(cls, strategy: str) -> float:
        """Get stop loss for a strategy"""
        stops = {
            'friday_0dte': cls.FRIDAY_0DTE_STOP_LOSS,
            'lt112': cls.LT112_STOP_LOSS,
            'futures_strangle': cls.FUTURES_STRANGLE_STOP_LOSS,
            'ipmcc': cls.IPMCC_STOP_LOSS
        }
        return stops.get(strategy, -2.00)  # Default 200%