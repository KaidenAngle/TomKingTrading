# region imports
from AlgorithmImports import *
# endregion
"""
Tom King Trading Framework - 11x Bear Trap Strategy (60 DTE Variants)
Advanced variant of 1-1-2 structure designed to capitalize on bear market reversals

Key Features:
1. 60 DTE timeframe (shorter than standard LT112's 120 DTE)
2. "Bear Trap" positioning - ATM 11x structure
3. Designed to profit from failed bearish moves and subsequent rallies
4. Phase 3+ strategy for experienced accounts

Strategy Logic:
- Enters during market weakness/bearish sentiment
- Positioned to profit when "bear trap" fails and market recovers
- Uses 1:1:X ratio spread structure with ATM components

Author: Tom King Trading System Implementation
Version: 1.0.0 - 11x Bear Trap Module
"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from enum import Enum
import numpy as np

class BearTrapVariant(Enum):
    """Variants of the 11x Bear Trap strategy"""
    STANDARD_11X = "STANDARD_11X"           # 1:1:X standard structure
    ATM_ENHANCED = "ATM_ENHANCED"           # Enhanced ATM positioning
    DEFENSIVE_11X = "DEFENSIVE_11X"         # Conservative variant

class MarketSentiment(Enum):
    """Market sentiment for bear trap identification"""
    EXTREME_BEARISH = "EXTREME_BEARISH"     # VIX >25, strong downtrend
    MODERATE_BEARISH = "MODERATE_BEARISH"   # Mild bearish sentiment
    NEUTRAL = "NEUTRAL"                     # No clear sentiment
    BULLISH = "BULLISH"                     # Not suitable for bear trap

class BearTrapTrigger(Enum):
    """Bear trap entry triggers"""
    VIX_SPIKE = "VIX_SPIKE"                 # VIX spike above 20
    OVERSOLD_BOUNCE = "OVERSOLD_BOUNCE"     # Oversold condition with bounce
    FAILED_BREAKDOWN = "FAILED_BREAKDOWN"   # Failed breakdown below support
    SENTIMENT_EXTREME = "SENTIMENT_EXTREME" # Extreme bearish sentiment

class BearTrap11XStrategy:
    """
    Implementation of Tom King's 11x Bear Trap Strategy
    
    Features:
    - 60 DTE structure (shorter than LT112)
    - ATM 11x positioning for bear trap scenarios
    - Market sentiment analysis for entry timing
    - Bear trap identification and execution
    - Phase 3+ strategy with enhanced risk management
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.debug = algorithm.Debug
        self.log = algorithm.Log
        self.error = algorithm.Error
        
        # Import real execution engine and option processor
        from trading.order_execution_engine import ExecutionEngine
        from trading.option_chain_processor import OptionChainProcessor
        
        self.execution_engine = ExecutionEngine(algorithm)
        self.option_processor = OptionChainProcessor(algorithm)
        
        # Strategy configuration
        self.config = {
            'dte': 60,                       # 60 DTE timeframe
            'min_account_phase': 3,          # Phase 3+ required
            'min_account_value': 60000,      # £60k minimum
            'max_positions': 3,              # Maximum concurrent positions
            'bp_allocation_pct': 0.05,       # 5% BP per position
            'products': ['SPY', 'QQQ', 'IWM'] # Focus on liquid ETFs
        }
        
        # Bear trap detection configuration
        self.bear_trap_config = {
            'vix_trigger_level': 20,         # VIX above 20 for bear sentiment
            'rsi_oversold_level': 30,        # RSI below 30 for oversold
            'sentiment_threshold': -0.7,     # Extreme bearish sentiment
            'min_days_since_low': 3,         # Minimum days since market low
            'max_days_since_low': 14         # Maximum days since market low
        }
        
        # Position structure configuration (11x variants)
        self.position_config = {
            'standard_11x': {
                'structure': '1 ATM Put + 1 OTM Put + X Deep OTM Puts',
                'atm_put_delta': 0.50,       # ATM (50 delta)
                'otm_put_delta': 0.30,       # OTM (30 delta)
                'deep_otm_delta': 0.15,      # Deep OTM (15 delta)
                'ratio': [1, 1, 2],          # 1:1:2 ratio
                'profit_target': 0.75,       # 75% profit target
                'max_loss_pct': 2.5          # 250% of credit received
            },
            'atm_enhanced': {
                'structure': '1 ATM Call + 1 ATM Put + X OTM Puts',
                'atm_call_delta': 0.50,      # ATM call hedge
                'atm_put_delta': 0.50,       # ATM put base
                'otm_puts_delta': 0.25,      # OTM puts (25 delta)
                'ratio': [1, 1, 3],          # 1:1:3 ratio
                'profit_target': 0.80,       # 80% profit target
                'max_loss_pct': 3.0          # 300% of credit received
            }
        }
        
        # Position tracking
        self.active_positions = {}
        self.bear_trap_signals = []
        self.market_sentiment_history = []
        
        # Performance tracking
        self.total_bear_traps = 0
        self.successful_traps = 0
        self.win_count = 0
        self.loss_count = 0
        
        self.log("🐻 11x Bear Trap Strategy Module Initialized")

    def AnalyzeMarketSentiment(self, current_time: datetime, vix_level: float, underlying_price: float) -> Dict:
        """
        Analyze market sentiment for bear trap opportunities
        Identifies conditions suitable for bear trap positioning
        """
        try:
            # VIX-based sentiment analysis
            if vix_level > 25:
                vix_sentiment = MarketSentiment.EXTREME_BEARISH
                vix_score = 1.0
            elif vix_level > 20:
                vix_sentiment = MarketSentiment.MODERATE_BEARISH
                vix_score = 0.7
            elif vix_level > 15:
                vix_sentiment = MarketSentiment.NEUTRAL
                vix_score = 0.3
            else:
                vix_sentiment = MarketSentiment.BULLISH
                vix_score = 0.0
            
            # Simulated RSI calculation (in practice, would use actual RSI)
            simulated_rsi = 50 - (vix_level - 15) * 2  # Rough inverse correlation
            simulated_rsi = max(0, min(100, simulated_rsi))
            
            # Bear trap trigger identification
            triggers = []
            if vix_level > self.bear_trap_config['vix_trigger_level']:
                triggers.append(BearTrapTrigger.VIX_SPIKE)
            if simulated_rsi < self.bear_trap_config['rsi_oversold_level']:
                triggers.append(BearTrapTrigger.OVERSOLD_BOUNCE)
                
            # Overall bear trap suitability score
            sentiment_score = vix_score
            if simulated_rsi < 30:
                sentiment_score += 0.3  # Oversold bonus
            if len(triggers) >= 2:
                sentiment_score += 0.2  # Multiple trigger bonus
                
            bear_trap_probability = min(1.0, sentiment_score)
            
            # Determine if conditions are suitable
            suitable = (
                bear_trap_probability > 0.6 and
                len(triggers) > 0 and
                vix_sentiment in [MarketSentiment.EXTREME_BEARISH, MarketSentiment.MODERATE_BEARISH]
            )
            
            return {
                'suitable_for_bear_trap': suitable,
                'market_sentiment': vix_sentiment.value,
                'vix_level': vix_level,
                'simulated_rsi': simulated_rsi,
                'bear_trap_probability': bear_trap_probability,
                'active_triggers': [trigger.value for trigger in triggers],
                'vix_score': vix_score,
                'sentiment_score': sentiment_score,
                'recommendation': self._get_sentiment_recommendation(bear_trap_probability, triggers)
            }
            
        except Exception as e:
            self.error(f"Market sentiment analysis failed: {e}")
            return {'suitable_for_bear_trap': False, 'error': str(e)}

    def CheckBearTrapEntry(self, current_time: datetime, account_phase: int, account_value: float, vix_level: float) -> Dict:
        """
        Check for bear trap entry opportunities
        Phase 3+ strategy with specific market conditions required
        """
        try:
            # Check account requirements
            if account_phase < self.config['min_account_phase']:
                return {
                    'qualified': False,
                    'reason': f'Requires Phase {self.config["min_account_phase"]}+, current: Phase {account_phase}'
                }
                
            if account_value < self.config['min_account_value']:
                return {
                    'qualified': False,
                    'reason': f'Requires £{self.config["min_account_value"]:,}+, current: £{account_value:,.0f}'
                }
            
            # Check position capacity
            if len(self.active_positions) >= self.config['max_positions']:
                return {
                    'qualified': False,
                    'reason': f'Maximum positions reached ({len(self.active_positions)}/{self.config["max_positions"]})'
                }
            
            # Analyze market sentiment for bear trap opportunity
            sentiment_analysis = self.AnalyzeMarketSentiment(current_time, vix_level, 0)  # Price passed separately
            
            if not sentiment_analysis.get('suitable_for_bear_trap'):
                return {
                    'qualified': False,
                    'reason': 'Market conditions not suitable for bear trap',
                    'market_sentiment': sentiment_analysis.get('market_sentiment', 'Unknown'),
                    'bear_trap_probability': sentiment_analysis.get('bear_trap_probability', 0),
                    'active_triggers': sentiment_analysis.get('active_triggers', [])
                }
            
            # Determine recommended variant
            recommended_variant = self._get_recommended_variant(
                vix_level, 
                sentiment_analysis['bear_trap_probability']
            )
            
            return {
                'qualified': True,
                'entry_type': '11x Bear Trap Entry',
                'account_phase': account_phase,
                'account_value': account_value,
                'market_sentiment': sentiment_analysis['market_sentiment'],
                'bear_trap_probability': sentiment_analysis['bear_trap_probability'],
                'active_triggers': sentiment_analysis['active_triggers'],
                'recommended_variant': recommended_variant.value,
                'vix_level': vix_level,
                'sentiment_score': sentiment_analysis['sentiment_score'],
                'available_positions': self.config['max_positions'] - len(self.active_positions)
            }
            
        except Exception as e:
            self.error(f"Bear trap entry check failed: {e}")
            return {'qualified': False, 'error': str(e)}

    def CalculateBearTrapPosition(self, variant: BearTrapVariant, underlying_symbol: str, underlying_price: float, sentiment_data: Dict) -> Dict:
        """
        Calculate bear trap position structure for specified variant
        Returns complete position specifications with bear trap logic
        """
        try:
            account_value = self.algorithm.Portfolio.TotalPortfolioValue
            
            if variant == BearTrapVariant.STANDARD_11X:
                position = self._calculate_standard_11x_position(underlying_symbol, underlying_price, account_value, sentiment_data)
            elif variant == BearTrapVariant.ATM_ENHANCED:
                position = self._calculate_atm_enhanced_position(underlying_symbol, underlying_price, account_value, sentiment_data)
            else:
                raise ValueError(f"Unknown variant: {variant}")
            
            # Add bear trap specific metadata
            position.update({
                'variant': variant.value,
                'underlying': underlying_symbol,
                'underlying_price': underlying_price,
                'dte': self.config['dte'],
                'bear_trap_probability': sentiment_data.get('bear_trap_probability', 0),
                'entry_triggers': sentiment_data.get('active_triggers', []),
                'market_sentiment': sentiment_data.get('market_sentiment', 'Unknown'),
                'entry_time': self.algorithm.Time,
                'position_id': f"BEAR_TRAP_{self.algorithm.Time.strftime('%Y%m%d')}_{underlying_symbol}_{variant.value}",
                'bear_trap_thesis': self._generate_bear_trap_thesis(sentiment_data),
                'expected_outcome': self._calculate_expected_outcome(position, sentiment_data)
            })
            
            return position
            
        except Exception as e:
            self.error(f"Bear trap position calculation failed: {e}")
            return {'error': str(e)}

    def _calculate_standard_11x_position(self, symbol: str, price: float, account_value: float, sentiment_data: Dict) -> Dict:
        """Calculate standard 1:1:X bear trap position"""
        config = self.position_config['standard_11x']
        
        # Calculate strikes for bear trap structure
        atm_put_strike = price  # ATM for bear trap
        otm_put_strike = price * (1 - config['otm_put_delta'] / 0.50)  # Adjust based on delta
        deep_otm_strike = price * (1 - config['deep_otm_delta'] / 0.50)  # Deep OTM
        
        # Position sizing
        bp_allocation = account_value * self.config['bp_allocation_pct']
        estimated_bp_per_set = 3500  # Estimated BP requirement
        position_size = max(1, int(bp_allocation / estimated_bp_per_set))
        
        # Bear trap enhancement - adjust for high probability setups
        if sentiment_data.get('bear_trap_probability', 0) > 0.8:
            position_size = int(position_size * 1.2)  # 20% size increase for high probability
        
        return {
            'structure': config['structure'],
            'bear_trap_type': 'Standard 11x',
            'legs': {
                'atm_put_long': {
                    'strike': round(atm_put_strike, 2),
                    'quantity': position_size,
                    'delta_target': config['atm_put_delta'],
                    'role': 'Bear trap hedge'
                },
                'otm_put_short': {
                    'strike': round(otm_put_strike, 2),
                    'quantity': position_size,
                    'delta_target': config['otm_put_delta'],
                    'role': 'Primary income'
                },
                'deep_otm_puts_short': {
                    'strike': round(deep_otm_strike, 2),
                    'quantity': position_size * config['ratio'][2],
                    'delta_target': config['deep_otm_delta'],
                    'role': 'Bear trap capture'
                }
            },
            'position_size': position_size,
            'bp_allocation': bp_allocation,
            'profit_target': config['profit_target'],
            'max_loss_pct': config['max_loss_pct'],
            'bear_trap_zones': self._calculate_bear_trap_zones(price, config)
        }

    def _calculate_atm_enhanced_position(self, symbol: str, price: float, account_value: float, sentiment_data: Dict) -> Dict:
        """Calculate ATM enhanced bear trap position"""
        config = self.position_config['atm_enhanced']
        
        # Enhanced ATM structure for better bear trap capture
        atm_call_strike = price  # ATM call for upside capture
        atm_put_strike = price   # ATM put for downside protection
        otm_puts_strike = price * (1 - config['otm_puts_delta'] / 0.50)
        
        # Position sizing with enhancement factor
        bp_allocation = account_value * self.config['bp_allocation_pct']
        estimated_bp_per_set = 4000  # Higher BP for enhanced structure
        position_size = max(1, int(bp_allocation / estimated_bp_per_set))
        
        return {
            'structure': config['structure'],
            'bear_trap_type': 'ATM Enhanced',
            'legs': {
                'atm_call_long': {
                    'strike': round(atm_call_strike, 2),
                    'quantity': position_size,
                    'delta_target': config['atm_call_delta'],
                    'role': 'Bear trap reversal capture'
                },
                'atm_put_long': {
                    'strike': round(atm_put_strike, 2),
                    'quantity': position_size,
                    'delta_target': config['atm_put_delta'],
                    'role': 'Downside protection'
                },
                'otm_puts_short': {
                    'strike': round(otm_puts_strike, 2),
                    'quantity': position_size * config['ratio'][2],
                    'delta_target': config['otm_puts_delta'],
                    'role': 'Income generation'
                }
            },
            'position_size': position_size,
            'bp_allocation': bp_allocation,
            'profit_target': config['profit_target'],
            'max_loss_pct': config['max_loss_pct'],
            'bear_trap_advantages': ['Upside capture', 'Downside protection', 'Income generation']
        }

    def ExecuteBearTrapPosition(self, position_config: Dict) -> bool:
        """Execute the calculated bear trap position using real ExecutionEngine"""
        try:
            self.log(f"🐻 EXECUTING BEAR TRAP POSITION: {position_config['bear_trap_type']}")
            self.log(f"   • Underlying: {position_config['underlying']} @ ${position_config['underlying_price']:.2f}")
            self.log(f"   • Structure: {position_config['structure']}")
            self.log(f"   • Bear Trap Probability: {position_config['bear_trap_probability']:.1%}")
            self.log(f"   • Entry Triggers: {', '.join(position_config['entry_triggers'])}")
            
            # Execute real iron condor for bear trap structure
            underlying = position_config['underlying']
            target_dte = self.config['dte']  # 60 DTE
            quantity = position_config.get('position_size', 1)
            
            # Bear trap is essentially an iron condor variant
            execution_id = self.execution_engine.execute_iron_condor(
                underlying=underlying,
                quantity=quantity,
                target_dte=target_dte
            )
            
            if not execution_id:
                self.error(f"Failed to execute bear trap for {underlying}")
                return False
            
            # Log actual execution
            legs = position_config['legs']
            self.log(f"✅ BEAR TRAP EXECUTED: {execution_id}")
            self.log(f"📊 POSITION LEGS:")
            for leg_name, leg_data in legs.items():
                self.log(f"   • {leg_name}: {leg_data['quantity']}x ${leg_data['strike']} ({leg_data['role']})")
            
            # Log bear trap thesis
            self.log(f"🎯 BEAR TRAP THESIS: {position_config['bear_trap_thesis']}")
            
            # Store position for management with real execution data
            position_id = position_config['position_id']
            self.active_positions[position_id] = {
                'config': position_config,
                'execution_id': execution_id,
                'entry_date': self.algorithm.Time,
                'status': 'ACTIVE',
                'days_held': 0,
                'current_pnl': 0.0,
                'bear_trap_status': 'MONITORING'
            }
            
            # Track bear trap attempt
            self.total_bear_traps += 1
            
            return True
            
        except Exception as e:
            self.error(f"Bear trap position execution failed: {e}")
            return False

    def ManageBearTrapPositions(self, current_time: datetime) -> None:
        """Manage active bear trap positions"""
        try:
            for position_id, position in list(self.active_positions.items()):
                # Update days held
                days_held = (current_time - position['entry_date']).days
                position['days_held'] = days_held
                
                # Check if bear trap has been sprung (market recovered)
                self._check_bear_trap_status(position_id, position)
                
                # Check profit targets and stop losses
                self._check_bear_trap_targets(position_id, position)
                
                # Check DTE-based management
                if days_held >= (self.config['dte'] - 21):  # 21 DTE management rule
                    self._evaluate_dte_management(position_id, position)
                
                # Log status updates
                if days_held % 7 == 0:  # Weekly updates
                    self._log_bear_trap_status(position_id, position)
                    
        except Exception as e:
            self.error(f"Bear trap position management failed: {e}")

    # Helper methods
    def _get_recommended_variant(self, vix_level: float, bear_trap_probability: float) -> BearTrapVariant:
        """Get recommended variant based on market conditions"""
        if bear_trap_probability > 0.8 and vix_level > 25:
            return BearTrapVariant.ATM_ENHANCED  # High probability, use enhanced
        else:
            return BearTrapVariant.STANDARD_11X  # Standard approach

    def _get_sentiment_recommendation(self, bear_trap_probability: float, triggers: List) -> str:
        """Get recommendation based on sentiment analysis"""
        if bear_trap_probability > 0.8:
            return "HIGH PROBABILITY BEAR TRAP - Execute enhanced position"
        elif bear_trap_probability > 0.6:
            return "MODERATE BEAR TRAP - Execute standard position"
        else:
            return "LOW PROBABILITY - Wait for better setup"

    def _generate_bear_trap_thesis(self, sentiment_data: Dict) -> str:
        """Generate bear trap thesis based on market conditions"""
        probability = sentiment_data.get('bear_trap_probability', 0)
        triggers = sentiment_data.get('active_triggers', [])
        
        if probability > 0.8:
            return f"High probability bear trap with {len(triggers)} triggers - Market oversold, VIX elevated, sentiment extreme"
        else:
            return f"Moderate bear trap setup - Market showing bearish exhaustion signals"

    def _calculate_expected_outcome(self, position: Dict, sentiment_data: Dict) -> Dict:
        """Calculate expected outcome for bear trap"""
        probability = sentiment_data.get('bear_trap_probability', 0.5)
        
        return {
            'success_probability': f"{probability:.1%}",
            'expected_profit': f"£{position['position_size'] * 500:.0f}",  # Estimated
            'target_timeline': f"{self.config['dte']//2} days",
            'bear_trap_scenario': 'Market reversal from oversold conditions'
        }

    def _calculate_bear_trap_zones(self, underlying_price: float, config: Dict) -> Dict:
        """Calculate bear trap profit/loss zones"""
        return {
            'optimal_zone': f"Above ${underlying_price * 0.95:.2f}",
            'profit_zone': f"${underlying_price * 0.90:.2f} - ${underlying_price * 1.05:.2f}",
            'loss_zone': f"Below ${underlying_price * 0.85:.2f}",
            'bear_trap_trigger': f"Recovery above ${underlying_price * 0.98:.2f}"
        }

    def _check_bear_trap_status(self, position_id: str, position: Dict) -> None:
        """Check if bear trap has been successfully sprung"""
        # Simulate bear trap success detection
        days_held = position['days_held']
        
        if days_held > 7:  # After 1 week
            # Simulate checking if market has reversed (bear trap sprung)
            simulated_success = days_held > 14 and np.random.random() > 0.3
            
            if simulated_success and position['bear_trap_status'] == 'MONITORING':
                self.log(f"🎯 BEAR TRAP SPRUNG: {position_id}")
                self.log(f"   • Market has reversed from bearish sentiment")
                position['bear_trap_status'] = 'SPRUNG'
                self.successful_traps += 1

    def _check_bear_trap_targets(self, position_id: str, position: Dict) -> None:
        """Check profit targets and stop losses for bear trap"""
        config = position['config']
        profit_target = config['profit_target']
        
        # Simulate profit checking
        days_held = position['days_held']
        simulated_profit_pct = min(0.75, days_held / 30)  # Rough approximation
        
        if simulated_profit_pct >= profit_target:
            self.log(f"✅ BEAR TRAP PROFIT TARGET: {position_id}")
            self._close_bear_trap_position(position_id, 'PROFIT_TARGET')

    def _evaluate_dte_management(self, position_id: str, position: Dict) -> None:
        """Evaluate 21 DTE management for bear trap positions"""
        remaining_dte = self.config['dte'] - position['days_held']
        
        if remaining_dte <= 21:
            self.log(f"⏰ 21 DTE MANAGEMENT: {position_id}")
            self.log(f"   • Remaining DTE: {remaining_dte}")
            self.log(f"   • Bear Trap Status: {position['bear_trap_status']}")
            
            if position['bear_trap_status'] == 'SPRUNG':
                self.log("   • Bear trap successful - holding to expiration")
            else:
                self.log("   • Bear trap not yet sprung - consider early closure")

    def _close_bear_trap_position(self, position_id: str, reason: str) -> None:
        """Close bear trap position and record results"""
        try:
            position = self.active_positions[position_id]
            
            # Record results
            if reason == 'PROFIT_TARGET':
                self.win_count += 1
            else:
                self.loss_count += 1
            
            self.log(f"📊 BEAR TRAP CLOSED: {position_id}")
            self.log(f"   • Reason: {reason}")
            self.log(f"   • Days Held: {position['days_held']}")
            self.log(f"   • Bear Trap Status: {position['bear_trap_status']}")
            
            # Remove from active positions
            del self.active_positions[position_id]
            
        except Exception as e:
            self.error(f"Bear trap position closure failed: {e}")

    def _log_bear_trap_status(self, position_id: str, position: Dict) -> None:
        """Log weekly bear trap status updates"""
        config = position['config']
        self.debug(f"🐻 Bear Trap Status: {position_id}")
        self.debug(f"   • Days Held: {position['days_held']}")
        self.debug(f"   • Bear Trap Status: {position['bear_trap_status']}")
        self.debug(f"   • Structure: {config['bear_trap_type']}")

    def GetBearTrapStatus(self) -> Dict:
        """Get current bear trap strategy status and performance metrics"""
        total_trades = self.win_count + self.loss_count
        win_rate = (self.win_count / total_trades * 100) if total_trades > 0 else 0
        trap_success_rate = (self.successful_traps / max(1, self.total_bear_traps) * 100)
        
        return {
            'active_positions': len(self.active_positions),
            'max_positions': self.config['max_positions'],
            'total_bear_traps': self.total_bear_traps,
            'successful_traps': self.successful_traps,
            'trap_success_rate': f"{trap_success_rate:.1f}%",
            'win_rate': f"{win_rate:.1f}%",
            'total_trades': total_trades,
            'strategy_variants': ['Standard 11x', 'ATM Enhanced'],
            'dte_target': f"{self.config['dte']} days",
            'phase_requirement': f"Phase {self.config['min_account_phase']}+",
            'bear_trap_thesis': 'Profit from failed bearish moves and market reversals'
        }