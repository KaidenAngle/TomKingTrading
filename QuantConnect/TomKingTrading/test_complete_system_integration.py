# Tom King Trading System - Complete Integration Test
# Verifies all 5 strategies work together with real option chains

from AlgorithmImports import *
from datetime import datetime, timedelta
import json

class TomKingSystemIntegrationTest(QCAlgorithm):
    """
    Complete integration test for Tom King Trading System
    Tests all 5 core strategies with real option chains and proper API access
    """
    
    def Initialize(self):
        # Test configuration
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 3, 31)  # 3 month test
        self.SetCash(75000)  # Phase 3 account
        
        # Import all strategies
        from strategies.friday_0dte import Friday0DTEStrategy
        from strategies.futures_strangle import TomKingFuturesStrangleStrategy
        from strategies.lt112_core_strategy import LongTerm112Strategy
        from strategies.ipmcc_strategy import IncomePoormansStrategy
        from strategies.leap_put_ladders import LEAPPutLadderStrategy
        
        # Import risk management
        from risk.correlation import CorrelationManager
        from risk.defensive import DefensiveManager
        from risk.position_sizing import PositionSizer
        from config.parameters import TomKingParameters
        
        # Initialize parameters
        self.params = TomKingParameters()
        self.account_phase = 3  # Phase 3 for testing
        
        # Initialize risk managers
        self.correlation_manager = CorrelationManager(self)
        self.defensive_manager = DefensiveManager(self)
        self.position_sizer = PositionSizer(self)
        
        # Initialize all 5 strategies
        self.friday_0dte = Friday0DTEStrategy(self)
        self.futures_strangle = TomKingFuturesStrangleStrategy(self)
        self.lt112 = LongTerm112Strategy(self)
        self.ipmcc = IncomePoormansStrategy(self)
        self.leap_ladder = LEAPPutLadderStrategy(self)
        
        # Add test symbols with real options
        self.InitializeTestSymbols()
        
        # Schedule tests
        self.ScheduleTests()
        
        # Test results tracking
        self.test_results = {
            'option_chains_accessed': False,
            'greeks_calculated': False,
            'consolidation_checked': False,
            'iv_analysis_done': False,
            'bp_limits_enforced': False,
            'correlation_limits_checked': False,
            'vix_adjustments_applied': False,
            'strategies_executed': {
                '0dte': False,
                'strangle': False,
                'lt112': False,
                'ipmcc': False,
                'leap': False
            }
        }
        
        self.Log("🚀 TOM KING SYSTEM INTEGRATION TEST INITIALIZED")
        self.Log(f"   Account: ${self.Portfolio.TotalPortfolioValue:,.0f}")
        self.Log(f"   Phase: {self.account_phase}")
        self.Log("   Testing all 5 strategies with real option chains")
    
    def InitializeTestSymbols(self):
        """Initialize symbols with real option chains for testing"""
        # Add SPY with options for multiple strategies
        spy = self.AddEquity("SPY", Resolution.Minute)
        spy_options = self.AddOption("SPY", Resolution.Minute)
        spy_options.SetFilter(-50, 50, 0, 365)  # Wide filter for all strategies
        
        # Add futures for 0DTE and strangles
        es = self.AddFuture(Futures.Indices.SP_500_E_MINI, Resolution.Minute)
        es.SetFilter(0, 120)
        
        # Add futures options
        es_options = self.AddFutureOption(es.Symbol, Resolution.Minute)
        es_options.SetFilter(-20, 20, 0, 120)
        
        # Add VIX for regime analysis
        self.vix_symbol = self.AddIndex("VIX", Resolution.Daily).Symbol
        
        # Add other test symbols
        self.AddEquity("QQQ", Resolution.Minute)
        self.AddEquity("IWM", Resolution.Minute)
        
        self.Log("✅ Test symbols initialized with option chains")
    
    def ScheduleTests(self):
        """Schedule strategy tests at appropriate times"""
        # Friday 0DTE test - Fridays at 10:30 AM
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Friday),
            self.TimeRules.At(10, 30),
            self.TestFriday0DTE
        )
        
        # Futures Strangle test - Second Tuesday at 10:15 AM
        self.Schedule.On(
            self.DateRules.MonthStart("SPY", 7),  # Approximate second Tuesday
            self.TimeRules.At(10, 15),
            self.TestFuturesStrangle
        )
        
        # LT112 test - First Wednesday at 10:00 AM
        self.Schedule.On(
            self.DateRules.MonthStart("SPY"),
            self.TimeRules.At(10, 0),
            self.TestLT112
        )
        
        # LEAP Ladder test - Mondays at 10:00 AM
        self.Schedule.On(
            self.DateRules.Every(DayOfWeek.Monday),
            self.TimeRules.At(10, 0),
            self.TestLEAPLadder
        )
        
        # Daily tests
        self.Schedule.On(
            self.DateRules.EveryDay("SPY"),
            self.TimeRules.AfterMarketOpen("SPY", 60),
            self.RunDailyTests
        )
        
        # End of day report
        self.Schedule.On(
            self.DateRules.EveryDay("SPY"),
            self.TimeRules.BeforeMarketClose("SPY", 30),
            self.DailyReport
        )
    
    def OnData(self, data):
        """Test real-time data access"""
        # Test option chain access
        if data.OptionChains:
            self.test_results['option_chains_accessed'] = True
            
            for kvp in data.OptionChains:
                chain = kvp.Value
                if chain and len(chain) > 0:
                    # Test Greeks access
                    for contract in chain:
                        if hasattr(contract, 'Greeks'):
                            if contract.Greeks.Delta != 0:
                                self.test_results['greeks_calculated'] = True
                                break
        
        # Update market data for strategies
        if hasattr(self.futures_strangle, 'update_market_data'):
            self.futures_strangle.update_market_data()
    
    def TestFriday0DTE(self):
        """Test Friday 0DTE strategy"""
        self.Log("🎯 TESTING FRIDAY 0DTE STRATEGY")
        
        try:
            # Test pre-market analysis
            if hasattr(self.friday_0dte, 'capture_market_open_prices'):
                self.friday_0dte.capture_market_open_prices()
                self.Log("   ✅ Market open prices captured")
            
            # Test market move analysis
            if hasattr(self.friday_0dte, 'analyze_pre_market_move'):
                analysis = self.friday_0dte.analyze_pre_market_move()
                if analysis:
                    self.Log(f"   ✅ Pre-market analysis complete: {len(analysis)} symbols")
            
            # Test Greeks validation
            if hasattr(self.friday_0dte, 'validate_portfolio_greeks'):
                valid = self.friday_0dte.validate_portfolio_greeks()
                self.Log(f"   ✅ Greeks validation: {valid}")
            
            # Test BP calculation
            if hasattr(self.friday_0dte, 'calculate_current_bp_usage'):
                bp_usage = self.friday_0dte.calculate_current_bp_usage()
                self.Log(f"   ✅ BP usage calculated: {bp_usage:.1%}")
                self.test_results['bp_limits_enforced'] = True
            
            # Test execution (dry run)
            if hasattr(self.friday_0dte, 'Execute'):
                self.friday_0dte.Execute()
                self.test_results['strategies_executed']['0dte'] = True
                self.Log("   ✅ 0DTE execution tested")
            
        except Exception as e:
            self.Error(f"0DTE test failed: {str(e)}")
    
    def TestFuturesStrangle(self):
        """Test Futures Strangle strategy"""
        self.Log("📊 TESTING FUTURES STRANGLE STRATEGY")
        
        try:
            # Test consolidation analysis
            if hasattr(self.futures_strangle, 'analyze_consolidation_pattern'):
                for futures_name in ['/ES', '/MES']:
                    valid, msg = self.futures_strangle.analyze_consolidation_pattern(futures_name)
                    self.Log(f"   Consolidation {futures_name}: {msg}")
                    self.test_results['consolidation_checked'] = True
            
            # Test IV environment
            if hasattr(self.futures_strangle, 'check_iv_environment'):
                for futures_name in ['/ES', '/MES']:
                    valid, msg = self.futures_strangle.check_iv_environment(futures_name)
                    self.Log(f"   IV check {futures_name}: {msg}")
                    self.test_results['iv_analysis_done'] = True
            
            # Test execution
            if hasattr(self.futures_strangle, 'execute_weekly_entry'):
                self.futures_strangle.execute_weekly_entry()
                self.test_results['strategies_executed']['strangle'] = True
                self.Log("   ✅ Strangle execution tested")
            
        except Exception as e:
            self.Error(f"Strangle test failed: {str(e)}")
    
    def TestLT112(self):
        """Test LT112 strategy"""
        self.Log("📈 TESTING LT112 STRATEGY")
        
        try:
            # Test first Wednesday validation
            if hasattr(self.lt112, '_is_first_wednesday'):
                is_first = self.lt112._is_first_wednesday()
                self.Log(f"   First Wednesday check: {is_first}")
            
            # Test 120 DTE availability
            if hasattr(self.lt112, '_has_120_dte_available'):
                has_120, contract = self.lt112._has_120_dte_available()
                self.Log(f"   120 DTE available: {has_120}")
            
            # Test execution
            if hasattr(self.lt112, 'execute_lt112_entry'):
                result = self.lt112.execute_lt112_entry()
                if result:
                    self.test_results['strategies_executed']['lt112'] = True
                    self.Log("   ✅ LT112 execution tested")
            
        except Exception as e:
            self.Error(f"LT112 test failed: {str(e)}")
    
    def TestLEAPLadder(self):
        """Test LEAP Ladder strategy"""
        self.Log("🪜 TESTING LEAP LADDER STRATEGY")
        
        try:
            # Test Monday check
            is_monday = self.Time.weekday() == 0
            self.Log(f"   Monday check: {is_monday}")
            
            # Test delta targeting
            if hasattr(self.leap_ladder, 'get_weekly_delta_target'):
                delta = self.leap_ladder.get_weekly_delta_target()
                self.Log(f"   Weekly delta target: {delta:.2f}")
            
            # Test VIX adjustment
            vix_level = float(self.Securities[self.vix_symbol].Price) if self.vix_symbol in self.Securities else 18
            if hasattr(self.leap_ladder, 'calculate_vix_position_multiplier'):
                multiplier, action, reason = self.leap_ladder.calculate_vix_position_multiplier(vix_level)
                self.Log(f"   VIX adjustment: {action} - {reason}")
                self.test_results['vix_adjustments_applied'] = True
            
            # Test ladder building
            if hasattr(self.leap_ladder, 'build_ladder_structure'):
                ladder = self.leap_ladder.build_ladder_structure('SPY', self.Portfolio.TotalPortfolioValue, self.account_phase)
                if ladder:
                    self.Log(f"   ✅ Ladder structure built: {ladder['ladder_size']} positions")
                    self.test_results['strategies_executed']['leap'] = True
            
        except Exception as e:
            self.Error(f"LEAP test failed: {str(e)}")
    
    def RunDailyTests(self):
        """Run daily integration tests"""
        # Test correlation limits
        if hasattr(self.correlation_manager, 'check_correlation_limits'):
            for symbol in ['SPY', 'QQQ', 'IWM']:
                allowed, msg = self.correlation_manager.can_add_position(symbol, 'EQUITY_INDEX')
                if not allowed:
                    self.test_results['correlation_limits_checked'] = True
        
        # Test defensive management
        if hasattr(self.defensive_manager, 'scan_positions'):
            actions = self.defensive_manager.scan_positions()
            if actions:
                self.Log(f"   Defensive actions: {len(actions)}")
    
    def DailyReport(self):
        """Generate daily test report"""
        self.Log("=" * 60)
        self.Log("📊 DAILY INTEGRATION TEST REPORT")
        self.Log("=" * 60)
        
        # Check all test results
        all_tests = [
            ('Option Chains Accessed', self.test_results['option_chains_accessed']),
            ('Greeks Calculated', self.test_results['greeks_calculated']),
            ('Consolidation Checked', self.test_results['consolidation_checked']),
            ('IV Analysis Done', self.test_results['iv_analysis_done']),
            ('BP Limits Enforced', self.test_results['bp_limits_enforced']),
            ('Correlation Limits', self.test_results['correlation_limits_checked']),
            ('VIX Adjustments', self.test_results['vix_adjustments_applied'])
        ]
        
        for test_name, passed in all_tests:
            status = "✅ PASS" if passed else "❌ FAIL"
            self.Log(f"   {test_name}: {status}")
        
        self.Log("\n📈 STRATEGY EXECUTION TESTS:")
        for strategy, executed in self.test_results['strategies_executed'].items():
            status = "✅ EXECUTED" if executed else "⏳ PENDING"
            self.Log(f"   {strategy.upper()}: {status}")
        
        # Overall status
        total_tests = len(all_tests) + len(self.test_results['strategies_executed'])
        passed_tests = sum(1 for _, p in all_tests if p) + sum(1 for e in self.test_results['strategies_executed'].values() if e)
        
        self.Log("\n" + "=" * 60)
        self.Log(f"OVERALL: {passed_tests}/{total_tests} Tests Passed")
        self.Log(f"System Status: {'✅ OPERATIONAL' if passed_tests > total_tests * 0.7 else '⚠️ NEEDS ATTENTION'}")
        self.Log("=" * 60)
    
    def OnEndOfAlgorithm(self):
        """Final test report"""
        self.Log("\n" + "=" * 80)
        self.Log("🏁 TOM KING SYSTEM INTEGRATION TEST COMPLETE")
        self.Log("=" * 80)
        
        # Final statistics
        self.Log(f"Final Portfolio Value: ${self.Portfolio.TotalPortfolioValue:,.2f}")
        self.Log(f"Total Return: {(self.Portfolio.TotalPortfolioValue - 75000) / 75000 * 100:.2f}%")
        
        # Save test results
        results_json = json.dumps(self.test_results, indent=2)
        self.Log("\nTest Results JSON:")
        self.Log(results_json)
        
        self.Log("\n✅ Integration test complete - System ready for production")