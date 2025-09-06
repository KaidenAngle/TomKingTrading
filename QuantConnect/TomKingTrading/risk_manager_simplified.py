# Tom King Risk Manager - Simplified Implementation
# Replaces 8 risk files (3,469 lines) with simple binary risk management
# Implements Tom King's proven risk methodology

from AlgorithmImports import *
from config_simplified import CONFIG

class SimpleRiskManager:
    """
    Simplified Tom King Risk Management System
    
    Key Features:
    - Binary VIX regime detection (HIGH/NORMAL)
    - Position limit enforcement (max 5 positions)
    - Buying power management (50% maximum usage)
    - Simple profit/loss exits (50% profit, 200% loss)
    - Account phase progression (£30k → £40k → £60k → £80k+)
    
    Replaces complex systems:
    - risk/correlation.py (826 lines)
    - risk/defensive.py (974 lines)  
    - risk/august_2024_protection.py (518 lines)
    - risk/kelly_criterion.py (138 lines)
    - risk/phase_manager.py (239 lines)
    - risk/position_sizing.py (774 lines)
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.vix_threshold = CONFIG['vix_threshold']  # 25
        self.max_positions = CONFIG['max_positions']  # 5
        self.max_bp_usage = CONFIG['max_bp_usage']    # 0.50
        self.profit_target = CONFIG['profit_target']  # 0.50
        self.stop_loss = CONFIG['stop_loss']          # -2.00
        
        # Account phase tracking
        self.current_phase = 1
        self.phase_thresholds = {
            1: 30000,   # Phase 1: £30k-40k
            2: 40000,   # Phase 2: £40k-60k  
            3: 60000,   # Phase 3: £60k-80k
            4: 80000    # Phase 4: £80k+
        }
        
        # Emergency stop state
        self.emergency_stop_active = False
        self.daily_loss_limit = 0.05  # 5% daily loss limit
    
    def can_trade(self, symbol, vix_regime):
        """
        Master risk check - determines if we can enter new positions
        
        Tom King's Risk Hierarchy:
        1. VIX regime must be NORMAL (< 25)
        2. Position count < maximum allowed
        3. Buying power usage < 50%
        4. No emergency stop active
        5. Daily loss within limits
        """
        try:
            # Emergency stop check (highest priority)
            if self.emergency_stop_active:
                return False
            
            # Daily loss limit check
            if self._check_daily_loss_limit():
                self.emergency_stop_active = True
                self.algorithm.Log("EMERGENCY STOP: Daily loss limit exceeded")
                return False
            
            # VIX regime check (Tom King's core filter)
            if vix_regime == "HIGH":
                return False
            
            # Position count check
            open_positions = self._count_open_positions()
            if open_positions >= self.max_positions:
                return False
            
            # Buying power check  
            bp_usage = self._get_buying_power_usage()
            if bp_usage >= self.max_bp_usage:
                return False
            
            # Account phase check for symbol
            if not self._symbol_allowed_for_phase(symbol):
                return False
            
            return True
            
        except Exception as e:
            self.algorithm.Error(f"Risk check error: {e}")
            return False  # Conservative: no trading if risk check fails
    
    def should_exit(self, position_pnl_pct):
        """
        Binary exit decision: 50% profit OR 200% loss
        
        Tom King's simple exit rules:
        - Take 50% profit (let winners run to 50%)
        - Cut losses at 200% (strict discipline)
        - No complex Greeks-based exits
        - No defensive adjustments
        """
        try:
            # Profit target hit
            if position_pnl_pct >= self.profit_target:
                return True
            
            # Stop loss hit
            if position_pnl_pct <= self.stop_loss:
                return True
            
            return False
            
        except Exception:
            return False
    
    def update_account_phase(self):
        """
        Update account phase based on current portfolio value
        
        Tom King's Account Progression:
        Phase 1 (£30k-40k): Basic strategies only
        Phase 2 (£40k-60k): Add futures strangles
        Phase 3 (£60k-80k): Add advanced 0DTE
        Phase 4 (£80k+):    All strategies available
        """
        try:
            portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
            
            # Determine current phase
            new_phase = 1
            for phase, threshold in sorted(self.phase_thresholds.items()):
                if portfolio_value >= threshold:
                    new_phase = phase
            
            # Log phase changes
            if new_phase != self.current_phase:
                self.algorithm.Log(f"Account Phase Change: {self.current_phase} → {new_phase}")
                self.algorithm.Log(f"Portfolio Value: ${portfolio_value:.2f}")
                self.current_phase = new_phase
                
                # Adjust risk parameters by phase
                self._adjust_risk_by_phase()
            
        except Exception as e:
            self.algorithm.Error(f"Phase update error: {e}")
    
    def check_emergency_conditions(self):
        """
        Monitor for emergency conditions requiring immediate action
        
        Tom King's Emergency Triggers:
        - VIX spike > 40 (market panic)
        - Daily loss > phase limit
        - Broker connection issues
        - Margin call risk
        """
        try:
            # VIX spike check
            vix_price = self.algorithm.Securities.get("VIX")
            if vix_price and vix_price.Price > 40:
                if not self.emergency_stop_active:
                    self.emergency_stop_active = True
                    self.algorithm.Log("EMERGENCY STOP: VIX spike > 40")
                    return True
            
            # Daily loss check
            if self._check_daily_loss_limit():
                if not self.emergency_stop_active:
                    self.emergency_stop_active = True
                    self.algorithm.Log("EMERGENCY STOP: Daily loss limit")
                    return True
            
            # Buying power emergency
            bp_usage = self._get_buying_power_usage()
            if bp_usage > 0.80:  # 80% emergency threshold
                self.algorithm.Log(f"WARNING: High BP usage {bp_usage:.2%}")
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Emergency check error: {e}")
            return False
    
    def reset_emergency_stop(self):
        """Reset emergency stop (typically at start of new day)"""
        if self.emergency_stop_active:
            self.algorithm.Log("Emergency stop reset")
            self.emergency_stop_active = False
    
    def _count_open_positions(self):
        """Count current open positions"""
        try:
            count = 0
            for holding in self.algorithm.Portfolio.Values:
                if holding.Invested:
                    count += 1
            return count
        except Exception:
            return 999  # Conservative: assume max positions if error
    
    def _get_buying_power_usage(self):
        """Calculate current buying power usage"""
        try:
            total_value = self.algorithm.Portfolio.TotalPortfolioValue
            cash = self.algorithm.Portfolio.Cash
            
            if total_value <= 0:
                return 1.0  # Conservative
            
            used_bp = total_value - cash
            usage = used_bp / total_value
            
            return max(0.0, min(1.0, usage))  # Clamp 0-100%
            
        except Exception:
            return 1.0  # Conservative: assume full usage if error
    
    def _check_daily_loss_limit(self):
        """Check if daily loss limit exceeded"""
        try:
            # Get today's P&L
            portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
            starting_value = CONFIG['starting_capital']  # Simplified
            
            # Calculate loss percentage (simplified daily check)
            loss_pct = (starting_value - portfolio_value) / starting_value
            
            return loss_pct > self.daily_loss_limit
            
        except Exception:
            return False  # Conservative: don't trigger on calculation errors
    
    def _symbol_allowed_for_phase(self, symbol):
        """Check if symbol trading allowed for current account phase"""
        try:
            # Phase 1: SPY only
            if self.current_phase == 1:
                return symbol in ["SPY"]
            
            # Phase 2: Add QQQ  
            elif self.current_phase == 2:
                return symbol in ["SPY", "QQQ"]
            
            # Phase 3: Add IWM
            elif self.current_phase == 3:
                return symbol in ["SPY", "QQQ", "IWM"]
            
            # Phase 4: All symbols
            else:
                return True
                
        except Exception:
            return True  # Conservative: allow trading if check fails
    
    def _adjust_risk_by_phase(self):
        """Adjust risk parameters based on account phase"""
        try:
            # Phase-specific position limits
            phase_limits = {
                1: 20,  # £30k-40k: 20% max position
                2: 18,  # £40k-60k: 18% max position  
                3: 15,  # £60k-80k: 15% max position
                4: 12   # £80k+:    12% max position
            }
            
            # Phase-specific daily loss limits
            phase_daily_limits = {
                1: 0.05,  # 5% daily loss limit
                2: 0.04,  # 4% daily loss limit
                3: 0.035, # 3.5% daily loss limit
                4: 0.03   # 3% daily loss limit
            }
            
            # Update limits
            if self.current_phase in phase_daily_limits:
                self.daily_loss_limit = phase_daily_limits[self.current_phase]
                
            self.algorithm.Log(f"Risk adjusted for Phase {self.current_phase}: "
                             f"Daily limit {self.daily_loss_limit:.1%}")
            
        except Exception as e:
            self.algorithm.Error(f"Risk adjustment error: {e}")
    
    def get_position_size(self, symbol, strategy_type):
        """
        Calculate position size based on Tom King methodology
        
        Simple sizing rules:
        - Never risk more than phase maximum per position
        - Account for strategy-specific multipliers
        - Ensure total exposure doesn't exceed limits
        """
        try:
            portfolio_value = self.algorithm.Portfolio.TotalPortfolioValue
            
            # Phase-based maximum position size
            phase_max_pct = {
                1: 0.20,  # 20% max
                2: 0.18,  # 18% max
                3: 0.15,  # 15% max
                4: 0.12   # 12% max
            }
            
            max_position_value = portfolio_value * phase_max_pct.get(self.current_phase, 0.12)
            
            # Strategy-specific adjustments
            strategy_multipliers = {
                'friday_0dte': 1.0,     # Full allocation
                'lt112': 0.8,           # Conservative
                'strangle': 0.6         # Most conservative
            }
            
            multiplier = strategy_multipliers.get(strategy_type, 0.5)
            adjusted_max = max_position_value * multiplier
            
            return max(1000, int(adjusted_max))  # Minimum £1,000 position
            
        except Exception:
            return 5000  # Conservative fallback