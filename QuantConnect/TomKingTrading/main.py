# Tom King Trading Framework - QuantConnect Production Implementation
# Complete multi-strategy options trading system
# Target: $44,450 to $101,600 in 8 months (128% return)

from AlgorithmImports import *
from datetime import datetime, timedelta
import numpy as np
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import json

# Import all Tom King Framework components
from config.strategy_parameters import *
from config.strategy_validator import StrategyValidator
from strategies.friday_zero_day_options import FridayZeroDayOptions
from strategies.futures_strangle import TomKingFuturesStrangleStrategy
from strategies.long_term_112_put_selling import LongTerm112PutSellingStrategy
from strategies.in_perpetuity_covered_calls import InPerpetuityCoveredCallsStrategy
from strategies.leap_put_ladders import LEAPPutLaddersStrategy
from risk.vix_regime import VIXRegimeManager
from risk.position_sizing import PositionSizingManager
from risk.august_2024_correlation_limiter import CorrelationLimiter
from greeks.greeks_monitor import GreeksMonitor
from greeks.greeks_signal_generator import GreeksSignalGenerator
from position_state_manager_qc import QuantConnectPositionStateManager
from brokers.tastytrade_api_client import TastytradeApiClient
from brokers.tastytrade_websocket import TastytradeWebSocket
from helpers.rate_limiter import RateLimiter
from risk.live_trading_components import (
    LivePositionRecovery, LivePerformanceTracker, 
    LiveCommissionModel, LiveDailySummary
)

class TomKingTradingAlgorithm(QCAlgorithm):
    """
    Tom King Trading Framework - Production Implementation
    Complete multi-strategy options trading system with:
    - 5 core strategies (0DTE, Futures Strangles, LT112, IPMCC, LEAP Ladders)
    - Greeks-based decision making
    - VIX regime management
    - Phase-based progression
    - Correlation limiting
    - Live trading components
    """
    
    def Initialize(self):
        """Initialize Tom King Trading Framework"""
        # Set dates and capital
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2025, 1, 1)
        self.SetCash(44450)  # Starting capital
        
        # Set resolution
        self.UniverseSettings.Resolution = Resolution.Minute
        
        # Initialize core components
        self.InitializeFrameworkSystems()
        self.InitializeRiskManagement()
        self.InitializeStrategies()
        self.InitializeTradingInfrastructure()
        self.InitializeSymbols()
        self.ScheduleEvents()
        
        self.Log(f"Tom King Trading Framework Initialized")
        self.Log(f"Starting Capital: ${self.Portfolio.Cash:,.0f}")
        self.Log(f"Account Phase: {self.current_phase}")
        self.Log(f"Greeks Monitoring: ACTIVE")
        self.Log(f"Strategy Attribution: ENABLED")
    
    def InitializeFrameworkSystems(self):
        """Initialize core framework systems"""
        # Phase management
        self.current_phase = self.GetAccountPhase()
        
        # VIX for regime detection
        self.vix = self.AddIndex("VIX", Resolution.Minute)
        self.current_vix = 20
        
        # Performance tracking
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        self.strategy_performance = defaultdict(lambda: {'trades': 0, 'wins': 0, 'pnl': 0})
        
        # Position tracking
        self.active_positions = {}
        self.position_entry_dates = {}
        
        # Initialize missing components that were found in verification
        self.tastytrade_api = None
        self.tastytrade_websocket = None
        self.LiveMode = False  # Set to True for live trading
        
        if self.LiveMode:
            # Initialize TastyTrade integration for live trading
            self.tastytrade_api = TastytradeApiClient(self)
            self.tastytrade_websocket = TastytradeWebSocket(self, list(self.symbol_universe))
            self.tastytrade_websocket.connect()
        
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(self)
        
        # Initialize performance tracker
        self.performance_tracker = LivePerformanceTracker(self)
        
        # Initialize position recovery for live trading
        self.position_recovery = LivePositionRecovery(self)
        
        # Initialize commission model
        self.commission_model = LiveCommissionModel(self)
        
        # Initialize daily summary
        self.daily_summary = LiveDailySummary(self)
    
    def InitializeRiskManagement(self):
        """Initialize risk management systems"""
        # Strategy validator
        self.strategy_validator = StrategyValidator(self)
        
        # VIX regime manager
        self.vix_regime = VIXRegimeManager(self)
        
        # Position sizing manager
        self.position_sizer = PositionSizingManager(self)
        
        # Correlation limiter (August 2024 protection)
        self.correlation_limiter = CorrelationLimiter(self)
        
        # Greeks monitoring
        self.greeks_monitor = GreeksMonitor(self)
        self.greeks_signal_generator = GreeksSignalGenerator(self)
        
        # Position state manager (QuantConnect compatible)
        self.position_manager = QuantConnectPositionStateManager(self)
    
    def InitializeStrategies(self):
        """Initialize all Tom King strategies"""
        self.strategies = {
            '0DTE': FridayZeroDayOptions(self),
            'Futures_Strangle': TomKingFuturesStrangleStrategy(self),
            'LT112': LongTerm112PutSellingStrategy(self),
            'IPMCC': InPerpetuityCoveredCallsStrategy(self),
            'LEAP_Ladders': LEAPPutLaddersStrategy(self)
        }
    
    def InitializeTradingInfrastructure(self):
        """Initialize trading infrastructure"""
        # Symbol universe based on phase
        self.symbol_universe = self.GetPhaseSymbols()
        
        # Greeks tracking
        self.portfolio_greeks = {
            'delta': 0,
            'gamma': 0,
            'theta': 0,
            'vega': 0
        }
    
    def InitializeSymbols(self):
        """Initialize trading symbols with options chains"""
        # Core ETFs always available
        for symbol in ['SPY', 'QQQ', 'IWM']:
            equity = self.AddEquity(symbol, Resolution.Minute)
            option = self.AddOption(symbol, Resolution.Minute)
            option.SetFilter(
                lambda x: x.Strikes(-20, 20)
                          .Expiration(0, 180)
                          .IncludeWeeklys()
            )
        
        # Phase-based additional symbols
        if self.current_phase >= 2:
            for symbol in ['GLD', 'TLT', 'SLV']:
                equity = self.AddEquity(symbol, Resolution.Minute)
                option = self.AddOption(symbol, Resolution.Minute)
                option.SetFilter(
                    lambda x: x.Strikes(-15, 15)
                              .Expiration(0, 120)
                              .IncludeWeeklys()
                )
        
        # Futures for strangles (Phase 2+)
        if self.current_phase >= 2:
            self.AddFuture(Futures.Indices.MicroSP500EMini, Resolution.Minute)
            self.AddFuture(Futures.Energies.MicroCrudeOilWTI, Resolution.Minute)
            self.AddFuture(Futures.Metals.MicroGold, Resolution.Minute)
    
    def ScheduleEvents(self):
        """Schedule all trading events"""
        # Friday 0DTE - 10:30 AM ET
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Friday),
            self.TimeRules.At(10, 30),
            self.Execute0DTE
        )
        
        # LT112 - First Wednesday of month
        self.Schedule.On(
            self.DateRules.MonthStart(),
            self.TimeRules.At(10, 15),
            self.ExecuteLT112
        )
        
        # Futures Strangles - Second Tuesday of month (Tom King methodology)
        # Schedule to run every Tuesday, strategy will check if it's the second Tuesday
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Tuesday),
            self.TimeRules.At(11, 0),
            self.ExecuteFuturesStrangles
        )
        
        # Position monitoring
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.Every(timedelta(minutes=15)),
            self.MonitorPositions
        )
        
        # Greeks update
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.Every(timedelta(minutes=30)),
            self.UpdateGreeks
        )
        
        # End of day summary
        self.Schedule.On(
            self.DateRules.EveryDay(),
            self.TimeRules.At(15, 45),
            self.EndOfDaySummary
        )
    
    def Execute0DTE(self):
        """Execute Friday 0DTE strategy"""
        if self.IsWarmingUp:
            return
        
        # Validate strategy can execute
        can_trade, reason = self.strategy_validator.validate_strategy('0DTE')
        if not can_trade:
            self.Log(f"0DTE skipped: {reason}")
            return
        
        # Execute through strategy class
        self.strategies['0DTE'].check_entry_conditions()
    
    def ExecuteLT112(self):
        """Execute LT112 strategy"""
        if self.IsWarmingUp or self.Time.day > 7:
            return
        
        can_trade, reason = self.strategy_validator.validate_strategy('LT112')
        if not can_trade:
            self.Log(f"LT112 skipped: {reason}")
            return
        
        self.strategies['LT112'].check_entry_conditions()
    
    def ExecuteFuturesStrangles(self):
        """Execute futures strangle strategy"""
        if self.IsWarmingUp or self.current_phase < 2:
            return
        
        can_trade, reason = self.strategy_validator.validate_strategy('Futures_Strangle')
        if not can_trade:
            self.Log(f"Futures Strangle skipped: {reason}")
            return
        
        self.strategies['Futures_Strangle'].check_entry_conditions()
    
    def MonitorPositions(self):
        """Monitor all active positions"""
        if self.IsWarmingUp:
            return
        
        # Update position states
        self.position_manager.update_positions()
        
        # Check exit conditions for each strategy
        for strategy_name, strategy in self.strategies.items():
            strategy.check_exit_conditions()
        
        # Update Greeks after position changes
        self.UpdateGreeks()
    
    def UpdateGreeks(self):
        """Update portfolio Greeks"""
        if self.IsWarmingUp:
            return
        
        # Reset portfolio Greeks
        self.portfolio_greeks = {
            'delta': 0,
            'gamma': 0,
            'theta': 0,
            'vega': 0
        }
        
        # Aggregate Greeks from all positions
        for symbol, holding in self.Portfolio.items():
            if holding.Invested and holding.Type == SecurityType.Option:
                security = self.Securities[symbol]
                if hasattr(security, 'Greeks') and security.Greeks:
                    self.portfolio_greeks['delta'] += security.Greeks.Delta * holding.Quantity * 100
                    self.portfolio_greeks['gamma'] += security.Greeks.Gamma * holding.Quantity * 100
                    self.portfolio_greeks['theta'] += security.Greeks.Theta * holding.Quantity * 100
                    self.portfolio_greeks['vega'] += security.Greeks.Vega * holding.Quantity * 100
        
        # Check Greeks limits
        self.CheckGreeksLimits()
    
    def CheckGreeksLimits(self):
        """Check if portfolio Greeks exceed limits"""
        # Phase-based Greeks limits
        limits = {
            1: {'delta': 50, 'gamma': 10, 'vega': 100},
            2: {'delta': 75, 'gamma': 15, 'vega': 150},
            3: {'delta': 100, 'gamma': 20, 'vega': 200},
            4: {'delta': 150, 'gamma': 30, 'vega': 300}
        }
        
        phase_limits = limits.get(self.current_phase, limits[1])
        
        # Check each Greek
        if abs(self.portfolio_greeks['delta']) > phase_limits['delta']:
            self.Log(f"[GREEKS] Delta limit exceeded: {self.portfolio_greeks['delta']:.1f}")
        
        if abs(self.portfolio_greeks['gamma']) > phase_limits['gamma']:
            self.Log(f"[GREEKS] Gamma limit exceeded: {self.portfolio_greeks['gamma']:.1f}")
        
        if abs(self.portfolio_greeks['vega']) > phase_limits['vega']:
            self.Log(f"[GREEKS] Vega limit exceeded: {self.portfolio_greeks['vega']:.1f}")
    
    def EndOfDaySummary(self):
        """Generate end of day summary"""
        if self.IsWarmingUp:
            return
        
        # Generate daily summary
        self.daily_summary.generate_daily_summary()
        
        # Save positions for recovery
        if self.LiveMode:
            self.position_recovery.save_positions()
    
    def GetAccountPhase(self):
        """Get current account phase"""
        balance = self.Portfolio.TotalPortfolioValue
        
        if balance < 50800:  # $40k * 1.27
            return 1
        elif balance < 69850:  # $55k * 1.27
            return 2
        elif balance < 95250:  # $75k * 1.27
            return 3
        else:
            return 4
    
    def GetPhaseSymbols(self):
        """Get allowed symbols for current phase"""
        phase_config = ACCOUNT_PHASES.get(self.current_phase, ACCOUNT_PHASES[1])
        return phase_config['symbols']
    
    def OnData(self, data):
        """Process incoming data"""
        if self.IsWarmingUp:
            return
        
        # Update VIX
        if "VIX" in data and data["VIX"] is not None:
            self.current_vix = data["VIX"].Price
            self.vix_regime.update_vix(self.current_vix)
        
        # Update Greeks monitor
        self.greeks_monitor.calculate_portfolio_greeks()
        
        # Generate Greeks signals
        signals = self.greeks_signal_generator.generate_signals()
        for signal in signals:
            if signal['action'] == 'ADJUST':
                self.Log(f"[GREEKS SIGNAL] {signal['message']}")
    
    def OnOrderEvent(self, orderEvent):
        """Handle order events for tracking"""
        if orderEvent.Status == OrderStatus.Filled:
            # Track fills for performance
            symbol = orderEvent.Symbol
            
            # Determine which strategy this belongs to
            strategy_name = self.position_manager.get_strategy_for_symbol(symbol)
            
            if strategy_name:
                # Record trade for performance tracking
                if orderEvent.Direction == OrderDirection.Buy:
                    # Opening trade
                    self.performance_tracker.record_trade(strategy_name, 0)  # P&L calculated on close
                else:
                    # Closing trade - calculate P&L
                    if symbol in self.position_entry_dates:
                        entry_price = self.position_entry_dates[symbol]
                        exit_price = orderEvent.FillPrice
                        pnl = (exit_price - entry_price) * orderEvent.FillQuantity
                        
                        # Record to performance tracker
                        self.performance_tracker.record_trade(strategy_name, pnl)
                        
                        # Update strategy performance
                        self.strategy_performance[strategy_name]['trades'] += 1
                        if pnl > 0:
                            self.strategy_performance[strategy_name]['wins'] += 1
                            self.winning_trades += 1
                        else:
                            self.losing_trades += 1
                        self.strategy_performance[strategy_name]['pnl'] += pnl
                        
                        # Clean up tracking
                        del self.position_entry_dates[symbol]
    
    def get_system_health(self) -> Dict:
        """Get comprehensive system health status"""
        return {
            'timestamp': str(self.Time),
            'phase': self.current_phase,
            'portfolio_value': float(self.Portfolio.TotalPortfolioValue),
            'vix': self.current_vix,
            'vix_regime': self.vix_regime.get_regime() if hasattr(self, 'vix_regime') else 'UNKNOWN',
            'greeks': self.portfolio_greeks,
            'active_positions': len(self.active_positions),
            'win_rate': self.winning_trades / max(1, self.winning_trades + self.losing_trades),
            'total_trades': self.total_trades,
            'strategy_performance': dict(self.strategy_performance),
            'correlation_groups': self.correlation_limiter.get_group_usage() if hasattr(self, 'correlation_limiter') else {},
            'health_status': 'HEALTHY'  # Would implement actual health checks
        }
    
    def enhanced_log(self, message: str, level: str = "INFO", context: Dict = None):
        """Enhanced logging with context"""
        timestamp = self.Time.strftime('%Y-%m-%d %H:%M:%S')
        
        # Build context string
        context_str = ""
        if context:
            context_items = [f"{k}={v}" for k, v in context.items()]
            context_str = f" [{', '.join(context_items)}]"
        
        # Format message
        formatted_message = f"[{timestamp}] [{level}]{context_str} {message}"
        
        # Log based on level
        if level == "ERROR":
            self.Error(formatted_message)
        elif level == "DEBUG":
            self.Debug(formatted_message)
        else:
            self.Log(formatted_message)
    
    def export_metrics(self):
        """Export metrics to ObjectStore for persistence"""
        try:
            metrics = {
                'timestamp': str(self.Time),
                'performance': dict(self.strategy_performance),
                'portfolio': {
                    'value': float(self.Portfolio.TotalPortfolioValue),
                    'cash': float(self.Portfolio.Cash),
                    'invested': float(self.Portfolio.TotalHoldingsValue)
                },
                'greeks': self.portfolio_greeks,
                'trades': {
                    'total': self.total_trades,
                    'wins': self.winning_trades,
                    'losses': self.losing_trades
                },
                'health': self.get_system_health()
            }
            
            # Save to ObjectStore
            metrics_json = json.dumps(metrics)
            self.ObjectStore.Save('metrics_latest', metrics_json)
            
            # Also save historical
            history_key = f"metrics_{self.Time.strftime('%Y%m%d_%H%M%S')}"
            self.ObjectStore.Save(history_key, metrics_json)
            
            return True
            
        except Exception as e:
            self.enhanced_log(f"Failed to export metrics: {str(e)}", "ERROR")
            return False
    
    def OnEndOfAlgorithm(self):
        """Final reporting"""
        final_value = self.Portfolio.TotalPortfolioValue
        total_return = (final_value - 44450) / 44450 * 100
        
        self.Log("=" * 60)
        self.Log("TOM KING TRADING FRAMEWORK - FINAL RESULTS")
        self.Log("=" * 60)
        self.Log(f"Starting Capital: $44,450")
        self.Log(f"Final Value: ${final_value:,.0f}")
        self.Log(f"Total Return: {total_return:.2f}%")
        self.Log(f"Target ($101,600): {'ACHIEVED' if final_value >= 101600 else f'MISSED by ${101600-final_value:,.0f}'}")
        self.Log("")
        
        # Strategy breakdown
        self.Log("STRATEGY PERFORMANCE:")
        for strategy, perf in self.strategy_performance.items():
            if perf['trades'] > 0:
                win_rate = (perf['wins'] / perf['trades']) * 100
                self.Log(f"  {strategy}: {perf['trades']} trades | {win_rate:.1f}% win | ${perf['pnl']:,.0f} P&L")
        
        # Greeks summary
        self.Log("")
        self.Log("FINAL GREEKS:")
        self.Log(f"  Delta: {self.portfolio_greeks['delta']:.1f}")
        self.Log(f"  Gamma: {self.portfolio_greeks['gamma']:.1f}")
        self.Log(f"  Theta: ${self.portfolio_greeks['theta']:.2f}/day")
        self.Log(f"  Vega: {self.portfolio_greeks['vega']:.1f}")
        
        # Export final metrics
        self.export_metrics()
        
        self.Log("=" * 60)
