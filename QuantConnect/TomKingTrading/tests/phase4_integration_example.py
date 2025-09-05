# Tom King Trading Framework - Phase 4 Integration Example
# Demonstrates how to integrate Position Exit Rules and Greeks Aggregation in main algorithm

from AlgorithmImports import *
from datetime import datetime, timedelta
from typing import Dict, List, Optional

# Import Phase 4 systems
from trading.position_exit_manager import PositionExitManager, ExitReason
from greeks.greeks_engine import GreeksEngine
from trading.order_execution_engine import ExecutionEngine
from run_phase4_tests import run_phase4_tests, phase4_health_check, verify_phase4_readiness

class TomKingPhase4IntegrationExample(QCAlgorithm):
    """
    Example integration of Phase 4 systems in main Tom King algorithm
    
    DEMONSTRATES:
    1. System initialization and health checks
    2. Real-time Greeks monitoring (every 2 hours)
    3. Position exit rule enforcement
    4. Risk limit monitoring
    5. Complete risk management workflow
    6. Integration with existing strategies
    """
    
    def Initialize(self):
        """Initialize algorithm with Phase 4 systems"""
        
        # Basic algorithm setup
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 12, 31)  
        self.SetCash(75000)  # Tom King starting capital
        
        # Add core symbols
        self.spy = self.AddEquity("SPY", Resolution.Minute).Symbol
        self.qqq = self.AddEquity("QQQ", Resolution.Minute).Symbol
        self.iwm = self.AddEquity("IWM", Resolution.Minute).Symbol
        self.vix = self.AddData(CBOE, "VIX", Resolution.Minute).Symbol
        
        # Phase 4 System Initialization
        self.Log("\n🚀 INITIALIZING PHASE 4 SYSTEMS...")
        
        try:
            # Initialize core systems
            self.exit_manager = PositionExitManager(self)
            self.greeks_engine = GreeksEngine(self)
            self.execution_engine = ExecutionEngine(self)
            
            # System health check
            if not phase4_health_check(self):
                self.Error("❌ Phase 4 health check failed - stopping algorithm")
                return
            
            # Readiness verification
            readiness = verify_phase4_readiness(self)
            if not readiness['ready']:
                self.Error("❌ Phase 4 systems not ready - stopping algorithm")
                for issue in readiness['issues']:
                    self.Error(f"   Issue: {issue}")
                return
            
            self.Log("✅ Phase 4 systems initialized successfully")
            
        except Exception as e:
            self.Error(f"❌ Phase 4 initialization failed: {e}")
            return
        
        # Tom King algorithm parameters
        self.account_phase = 4  # Current account phase
        self.starting_portfolio_value = self.Portfolio.TotalPortfolioValue
        
        # Greeks monitoring schedule (every 2 hours as per Tom King spec)
        self.greeks_update_interval = timedelta(hours=2)
        self.last_greeks_update = self.Time
        
        # Exit checking frequency (every 30 minutes during market hours)
        self.exit_check_interval = timedelta(minutes=30)
        self.last_exit_check = self.Time
        
        # Portfolio risk monitoring
        self.risk_check_interval = timedelta(hours=1)
        self.last_risk_check = self.Time
        
        # Optional: Run comprehensive tests (disable in live trading)
        self.run_tests_on_startup = True  # Set to False for live trading
        
        if self.run_tests_on_startup:
            self.Log("\n🧪 Running Phase 4 comprehensive tests...")
            test_results = run_phase4_tests(self)
            
            # Check if systems passed testing
            overall_health = test_results.get('overall_health', {})
            if overall_health.get('overall_success_rate', 0) < 85:
                self.Error("❌ Phase 4 systems failed testing - stopping algorithm")
                return
        
        self.Log("🎯 Tom King Phase 4 algorithm ready for trading")
    
    def OnData(self, data):
        """Main algorithm logic with Phase 4 integration"""
        
        # Skip if we don't have all required data
        if not all(data.ContainsKey(symbol) for symbol in [self.spy, self.vix]):
            return
        
        try:
            # Phase 4 System Monitoring
            self._monitor_phase4_systems()
            
            # Check for position exits (Tom King exit rules)
            self._check_position_exits()
            
            # Monitor portfolio Greeks and risk limits
            self._monitor_portfolio_risk()
            
            # Strategy execution (your existing strategies go here)
            self._execute_strategies()
            
        except Exception as e:
            self.Error(f"OnData error: {e}")
    
    def _monitor_phase4_systems(self):
        """Monitor Phase 4 systems performance"""
        
        # Update Greeks every 2 hours
        if self.Time >= self.last_greeks_update + self.greeks_update_interval:
            self._update_portfolio_greeks()
            self.last_greeks_update = self.Time
    
    def _update_portfolio_greeks(self):
        """Update portfolio Greeks and log summary"""
        try:
            # Get active positions from execution engine
            active_positions = self.execution_engine.get_active_positions()
            
            if not active_positions:
                self.Log("📊 No active positions - skipping Greeks update")
                return
            
            # Calculate portfolio Greeks
            portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(active_positions)
            
            # Log Greeks summary
            self.greeks_engine.LogPortfolioGreeks(portfolio_greeks)
            
            # Check risk limit violations
            violations = self.greeks_engine.CheckGreeksRiskLimits(portfolio_greeks)
            
            if violations:
                self.Log("🚨 GREEKS RISK LIMIT VIOLATIONS DETECTED:")
                for violation in violations:
                    self.Log(f"   {violation['type']}: {violation['current']:.2f} (limit: {violation['limit']})")
                    
                    # Take action on high severity violations
                    if violation['severity'] == 'HIGH':
                        self._handle_high_severity_risk_violation(violation)
            
        except Exception as e:
            self.Error(f"Error updating portfolio Greeks: {e}")
    
    def _check_position_exits(self):
        """Check all positions for Tom King exit conditions"""
        
        if self.Time < self.last_exit_check + self.exit_check_interval:
            return
        
        try:
            # Get active positions
            active_positions = self.execution_engine.get_active_positions()
            
            if not active_positions:
                return
            
            # Check for exits using Tom King rules
            positions_to_exit = self.exit_manager.CheckPositionExits(active_positions)
            
            if positions_to_exit:
                self.Log(f"🎯 Found {len(positions_to_exit)} positions to exit")
                
                # Execute exits
                exit_results = self.exit_manager.ExecuteExits(positions_to_exit, self.execution_engine)
                
                # Log results
                successful_exits = sum(1 for result in exit_results.values() if result.get('success'))
                self.Log(f"✅ Successfully closed {successful_exits}/{len(positions_to_exit)} positions")
                
                # Update statistics
                self.exit_manager.LogExitSummary()
            
            self.last_exit_check = self.Time
            
        except Exception as e:
            self.Error(f"Error checking position exits: {e}")
    
    def _monitor_portfolio_risk(self):
        """Monitor portfolio-level risk metrics"""
        
        if self.Time < self.last_risk_check + self.risk_check_interval:
            return
        
        try:
            active_positions = self.execution_engine.get_active_positions()
            
            if active_positions:
                # Calculate portfolio Greeks
                portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(active_positions)
                
                # Check if portfolio is delta neutral
                risk_metrics = portfolio_greeks.get('risk_metrics', {})
                is_delta_neutral = risk_metrics.get('delta_neutral', False)
                
                if not is_delta_neutral:
                    total_delta = portfolio_greeks['total_delta']
                    self.Log(f"⚠️ Portfolio not delta neutral: {total_delta:.2f} delta exposure")
                    
                    # Consider hedging actions if delta too high
                    if abs(total_delta) > 30:  # Arbitrary threshold
                        self.Log("📊 Consider delta hedging - high directional exposure")
                
                # Log daily theta decay
                daily_theta = portfolio_greeks['total_theta']
                if daily_theta < -200:  # More than $200/day theta decay
                    self.Log(f"⏰ High theta decay: ${daily_theta:.2f}/day")
            
            self.last_risk_check = self.Time
            
        except Exception as e:
            self.Error(f"Error monitoring portfolio risk: {e}")
    
    def _execute_strategies(self):
        """Execute Tom King trading strategies with Phase 4 integration"""
        
        # This is where your existing Tom King strategies would go
        # Examples:
        
        # 1. LT112 Strategy with Greeks monitoring
        if self._should_open_lt112_position():
            position_id = self.execution_engine.execute_put_spread("SPY", quantity=1, target_dte=112)
            if position_id:
                self.Log(f"✅ Opened LT112 position: {position_id}")
                
                # Get initial Greeks
                position = self.execution_engine.active_positions[position_id]
                greeks = self.greeks_engine.CalculatePositionGreeks(position)
                self.Log(f"   Initial Greeks - Delta: {greeks['net_delta']:.3f}, Theta: {greeks['net_theta']:.2f}")
        
        # 2. Friday 0DTE Strategy with enhanced exit rules
        if self._should_open_friday_0dte():
            position_id = self.execution_engine.execute_iron_condor("SPY", quantity=1, target_dte=0)
            if position_id:
                self.Log(f"✅ Opened Friday 0DTE position: {position_id}")
        
        # 3. Futures Strangle with 90 DTE
        if self._should_open_futures_strangle():
            position_id = self.execution_engine.execute_futures_strangle("ES", quantity=1, target_dte=90)
            if position_id:
                self.Log(f"✅ Opened Futures Strangle: {position_id}")
    
    def _handle_high_severity_risk_violation(self, violation):
        """Handle high severity risk limit violations"""
        
        self.Log(f"🚨 HIGH SEVERITY VIOLATION: {violation['type']}")
        
        if violation['type'] == 'DELTA_LIMIT':
            self.Log("   Consider immediate delta hedging or position closure")
            
            # Example: Close most directional position
            active_positions = self.execution_engine.get_active_positions()
            highest_delta_pos = None
            highest_delta = 0
            
            for pos_id, position in active_positions.items():
                greeks = self.greeks_engine.CalculatePositionGreeks(position)
                if abs(greeks['net_delta']) > highest_delta:
                    highest_delta = abs(greeks['net_delta'])
                    highest_delta_pos = pos_id
            
            if highest_delta_pos:
                success = self.execution_engine.close_position(highest_delta_pos, "Delta limit violation")
                if success:
                    self.Log(f"✅ Closed high delta position: {highest_delta_pos}")
    
    def _should_open_lt112_position(self) -> bool:
        """Determine if should open LT112 position (simplified logic)"""
        
        # Check portfolio constraints
        active_positions = self.execution_engine.get_active_positions()
        
        # Don't open if we already have 5+ positions (simplified)
        if len(active_positions) >= 5:
            return False
        
        # Check Greeks limits
        if active_positions:
            portfolio_greeks = self.greeks_engine.CalculatePortfolioGreeks(active_positions)
            
            # Don't add more delta if already high
            if abs(portfolio_greeks['total_delta']) > 30:
                return False
        
        # Simple timing logic (you would implement Tom King's actual logic)
        return self.Time.weekday() == 0  # Monday only, for example
    
    def _should_open_friday_0dte(self) -> bool:
        """Determine if should open Friday 0DTE position"""
        
        # Only on Fridays
        if self.Time.weekday() != 4:
            return False
        
        # Check VIX level
        if not self.Securities.ContainsKey(self.vix):
            return False
        
        vix_level = self.Securities[self.vix].Price
        
        # Tom King typically avoids 0DTE when VIX is high
        return vix_level < 25
    
    def _should_open_futures_strangle(self) -> bool:
        """Determine if should open futures strangle"""
        
        # Check account size (futures require larger accounts)
        if self.Portfolio.TotalPortfolioValue < 40000:
            return False
        
        # Simple logic - monthly opening
        return self.Time.day == 1  # First day of month
    
    def OnEndOfAlgorithm(self):
        """Algorithm cleanup and final reporting"""
        
        self.Log("\n" + "="*60)
        self.Log("📊 ALGORITHM COMPLETION - PHASE 4 SUMMARY")
        self.Log("="*60)
        
        try:
            # Final exit statistics
            exit_stats = self.exit_manager.GetExitStatistics()
            self.Log("\n📈 EXIT STATISTICS:")
            self.Log(f"   Total Exits: {exit_stats['total_exits']}")
            self.Log(f"   Profit Targets Hit: {exit_stats['profit_targets_hit']}")
            self.Log(f"   Stop Losses Hit: {exit_stats['stop_losses_hit']}")
            self.Log(f"   21 DTE Exits: {exit_stats['dte_exits']}")
            self.Log(f"   Defensive Exits: {exit_stats['defensive_exits']}")
            
            # Final execution summary
            exec_summary = self.execution_engine.get_execution_summary()
            self.Log("\n🎯 EXECUTION SUMMARY:")
            self.Log(f"   Total Positions Opened: {exec_summary['total_positions']}")
            self.Log(f"   Currently Active: {exec_summary['active_positions']}")
            self.Log(f"   Total Credit Collected: ${exec_summary.get('total_credit_collected', 0):.2f}")
            
            # Final portfolio Greeks
            active_positions = self.execution_engine.get_active_positions()
            if active_positions:
                final_greeks = self.greeks_engine.CalculatePortfolioGreeks(active_positions)
                self.Log("\n📊 FINAL PORTFOLIO GREEKS:")
                self.Log(f"   Total Delta: {final_greeks['total_delta']:.2f}")
                self.Log(f"   Total Theta: ${final_greeks['total_theta']:.2f}/day")
                self.Log(f"   Delta Neutral: {'Yes' if final_greeks['risk_metrics']['delta_neutral'] else 'No'}")
            
            self.Log("\n🎉 Phase 4 Tom King Trading Framework Complete")
            
        except Exception as e:
            self.Error(f"Error in OnEndOfAlgorithm: {e}")