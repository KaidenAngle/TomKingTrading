# Tom King Trading Framework - Phase-Based Strategy Access Test
# Tests phase progression and strategy gating based on account balance
# Validates Tom King's 4-phase system requirements

from AlgorithmImports import *
from risk.phase_manager import PhaseManager
import unittest
from unittest.mock import Mock, MagicMock

class TestPhaseBasedStrategyAccess(unittest.TestCase):
    """Comprehensive tests for Tom King's phase-based strategy access system"""
    
    def setUp(self):
        """Set up test environment with mock algorithm"""
        self.mock_algo = Mock()
        self.mock_algo.Portfolio = Mock()
        self.mock_algo.Portfolio.TotalPortfolioValue = 35000  # Default Phase 1 value
        self.mock_algo.Log = Mock()
        self.mock_algo.Debug = Mock()
        
        # Create phase manager instance
        self.phase_manager = PhaseManager(self.mock_algo)
    
    def test_phase_1_requirements(self):
        """Test Phase 1 (£30k-40k) strategy access requirements"""
        print("\n=== TESTING PHASE 1 (£30k-40k) REQUIREMENTS ===")
        
        # Set portfolio value to Phase 1 range
        test_values = [30000, 35000, 39999]
        
        for value in test_values:
            self.mock_algo.Portfolio.TotalPortfolioValue = value
            self.phase_manager.UpdatePhase()
            
            print(f"\nTesting with portfolio value: £{value:,}")
            print(f"Current Phase: {self.phase_manager.current_phase}")
            
            # Test allowed strategies for Phase 1
            allowed_strategies = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES']
            blocked_strategies = ['IPMCC', 'POOR_MANS_COVERED_CALL', 'LEAP_PUT_LADDERS', 
                                'ENHANCED_BUTTERFLY', 'RATIO_SPREADS']
            
            for strategy in allowed_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertTrue(result, f"Strategy {strategy} should be allowed in Phase 1")
                print(f"  ✅ {strategy}: ALLOWED")
            
            for strategy in blocked_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertFalse(result, f"Strategy {strategy} should be blocked in Phase 1")
                print(f"  ❌ {strategy}: BLOCKED")
            
            # Test position limits
            max_positions = self.phase_manager.GetMaxPositions()
            self.assertEqual(max_positions, 6, f"Phase 1 should allow max 6 positions")
            print(f"  📊 Max Positions: {max_positions}")
            
            # Test risk limits
            max_risk = self.phase_manager.GetMaxRiskPerTrade()
            self.assertEqual(max_risk, 0.03, f"Phase 1 should have 3% max risk per trade")
            print(f"  🛡️ Max Risk per Trade: {max_risk:.1%}")
    
    def test_phase_2_requirements(self):
        """Test Phase 2 (£40k-60k) strategy access requirements"""
        print("\n=== TESTING PHASE 2 (£40k-60k) REQUIREMENTS ===")
        
        # Set portfolio value to Phase 2 range
        test_values = [40000, 50000, 59999]
        
        for value in test_values:
            self.mock_algo.Portfolio.TotalPortfolioValue = value
            self.phase_manager.UpdatePhase()
            
            print(f"\nTesting with portfolio value: £{value:,}")
            print(f"Current Phase: {self.phase_manager.current_phase}")
            
            # Test allowed strategies for Phase 2 (includes Phase 1 + new)
            allowed_strategies = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                                'IPMCC', 'POOR_MANS_COVERED_CALL']
            blocked_strategies = ['LEAP_PUT_LADDERS', 'ENHANCED_BUTTERFLY', 'RATIO_SPREADS']
            
            for strategy in allowed_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertTrue(result, f"Strategy {strategy} should be allowed in Phase 2")
                print(f"  ✅ {strategy}: ALLOWED")
            
            for strategy in blocked_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertFalse(result, f"Strategy {strategy} should be blocked in Phase 2")
                print(f"  ❌ {strategy}: BLOCKED")
            
            # Test position limits
            max_positions = self.phase_manager.GetMaxPositions()
            self.assertEqual(max_positions, 10, f"Phase 2 should allow max 10 positions")
            print(f"  📊 Max Positions: {max_positions}")
            
            # Test risk limits
            max_risk = self.phase_manager.GetMaxRiskPerTrade()
            self.assertEqual(max_risk, 0.04, f"Phase 2 should have 4% max risk per trade")
            print(f"  🛡️ Max Risk per Trade: {max_risk:.1%}")
    
    def test_phase_3_requirements(self):
        """Test Phase 3 (£60k-75k) strategy access requirements"""
        print("\n=== TESTING PHASE 3 (£60k-75k) REQUIREMENTS ===")
        
        # Set portfolio value to Phase 3 range
        test_values = [60000, 67500, 74999]
        
        for value in test_values:
            self.mock_algo.Portfolio.TotalPortfolioValue = value
            self.phase_manager.UpdatePhase()
            
            print(f"\nTesting with portfolio value: £{value:,}")
            print(f"Current Phase: {self.phase_manager.current_phase}")
            
            # Test allowed strategies for Phase 3 (includes Phase 1-2 + new)
            allowed_strategies = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                                'IPMCC', 'POOR_MANS_COVERED_CALL', 'LEAP_PUT_LADDERS',
                                'ENHANCED_BUTTERFLY', 'RATIO_SPREADS']
            
            for strategy in allowed_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertTrue(result, f"Strategy {strategy} should be allowed in Phase 3")
                print(f"  ✅ {strategy}: ALLOWED")
            
            # Test position limits
            max_positions = self.phase_manager.GetMaxPositions()
            self.assertEqual(max_positions, 12, f"Phase 3 should allow max 12 positions")
            print(f"  📊 Max Positions: {max_positions}")
            
            # Test risk limits
            max_risk = self.phase_manager.GetMaxRiskPerTrade()
            self.assertEqual(max_risk, 0.05, f"Phase 3 should have 5% max risk per trade")
            print(f"  🛡️ Max Risk per Trade: {max_risk:.1%}")
    
    def test_phase_4_requirements(self):
        """Test Phase 4 (£75k+) strategy access requirements"""
        print("\n=== TESTING PHASE 4 (£75k+) REQUIREMENTS ===")
        
        # Set portfolio value to Phase 4 range
        test_values = [75000, 100000, 150000]
        
        for value in test_values:
            self.mock_algo.Portfolio.TotalPortfolioValue = value
            self.phase_manager.UpdatePhase()
            
            print(f"\nTesting with portfolio value: £{value:,}")
            print(f"Current Phase: {self.phase_manager.current_phase}")
            
            # Test ALL strategies should be allowed in Phase 4
            test_strategies = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                             'IPMCC', 'POOR_MANS_COVERED_CALL', 'LEAP_PUT_LADDERS',
                             'ENHANCED_BUTTERFLY', 'RATIO_SPREADS', 'ADVANCED_CONDOR',
                             'PROFESSIONAL_BUTTERFLY']
            
            for strategy in test_strategies:
                result = self.phase_manager.IsStrategyAllowed(strategy)
                self.assertTrue(result, f"All strategies should be allowed in Phase 4")
                print(f"  ✅ {strategy}: ALLOWED")
            
            # Test position limits
            max_positions = self.phase_manager.GetMaxPositions()
            self.assertEqual(max_positions, 15, f"Phase 4 should allow max 15 positions")
            print(f"  📊 Max Positions: {max_positions}")
            
            # Test risk limits
            max_risk = self.phase_manager.GetMaxRiskPerTrade()
            self.assertEqual(max_risk, 0.05, f"Phase 4 should have 5% max risk per trade")
            print(f"  🛡️ Max Risk per Trade: {max_risk:.1%}")
    
    def test_phase_transitions(self):
        """Test phase transitions and logging"""
        print("\n=== TESTING PHASE TRANSITIONS ===")
        
        # Test transition from Phase 1 to Phase 2
        self.mock_algo.Portfolio.TotalPortfolioValue = 35000  # Phase 1
        self.phase_manager.UpdatePhase()
        self.assertEqual(self.phase_manager.current_phase, 1)
        print(f"Starting Phase: {self.phase_manager.current_phase}")
        
        # Transition to Phase 2
        self.mock_algo.Portfolio.TotalPortfolioValue = 45000  # Phase 2
        self.phase_manager.UpdatePhase()
        self.assertEqual(self.phase_manager.current_phase, 2)
        print(f"Transitioned to Phase: {self.phase_manager.current_phase}")
        
        # Verify logging was called
        self.mock_algo.Log.assert_called()
        print("✅ Phase transition logging verified")
        
        # Test transition to Phase 3
        self.mock_algo.Portfolio.TotalPortfolioValue = 65000  # Phase 3
        self.phase_manager.UpdatePhase()
        self.assertEqual(self.phase_manager.current_phase, 3)
        print(f"Transitioned to Phase: {self.phase_manager.current_phase}")
        
        # Test transition to Phase 4
        self.mock_algo.Portfolio.TotalPortfolioValue = 80000  # Phase 4
        self.phase_manager.UpdatePhase()
        self.assertEqual(self.phase_manager.current_phase, 4)
        print(f"Transitioned to Phase: {self.phase_manager.current_phase}")
    
    def test_position_sizing_with_phase_limits(self):
        """Test position sizing respects phase limits"""
        print("\n=== TESTING POSITION SIZING WITH PHASE LIMITS ===")
        
        test_cases = [
            (35000, 1, 'FRIDAY_0DTE', 0.03),    # Phase 1
            (50000, 2, 'IPMCC', 0.04),          # Phase 2
            (70000, 3, 'RATIO_SPREADS', 0.05),  # Phase 3
            (100000, 4, 'ADVANCED_CONDOR', 0.05) # Phase 4
        ]
        
        for portfolio_value, expected_phase, strategy, expected_max_risk in test_cases:
            self.mock_algo.Portfolio.TotalPortfolioValue = portfolio_value
            self.phase_manager.UpdatePhase()
            
            print(f"\nTesting Phase {expected_phase} (£{portfolio_value:,}):")
            print(f"Strategy: {strategy}")
            
            # Test if strategy is allowed
            allowed = self.phase_manager.IsStrategyAllowed(strategy)
            print(f"Strategy Allowed: {allowed}")
            
            if allowed:
                # Test position sizing calculation
                position_size = self.phase_manager.CalculatePositionSize(strategy)
                self.assertGreater(position_size, 0, "Position size should be greater than 0 for allowed strategies")
                print(f"Position Size: {position_size}")
                
                # Test risk calculation
                max_risk_amount = portfolio_value * expected_max_risk
                print(f"Max Risk Amount: £{max_risk_amount:,.2f} ({expected_max_risk:.1%})")
            else:
                # Test blocked strategy returns 0 position size
                position_size = self.phase_manager.CalculatePositionSize(strategy)
                self.assertEqual(position_size, 0, "Position size should be 0 for blocked strategies")
                print(f"Position Size: {position_size} (BLOCKED)")
    
    def test_tom_king_wisdom_rules_integration(self):
        """Test Tom King's wisdom rules are applied correctly by phase"""
        print("\n=== TESTING TOM KING WISDOM RULES INTEGRATION ===")
        
        # Test Rule 1: Never risk more than 5%
        trade_params = {'risk_pct': 0.08, 'strategy': 'FRIDAY_0DTE'}
        adjusted_params = self.phase_manager.ApplyWisdomRules(trade_params)
        self.assertEqual(adjusted_params['risk_pct'], 0.05, "Risk should be capped at 5%")
        print("✅ Rule 1: Risk capped at 5% - PASSED")
        
        # Test Rule 4: Avoid earnings
        trade_params = {'near_earnings': True, 'strategy': 'LONG_TERM_112'}
        adjusted_params = self.phase_manager.ApplyWisdomRules(trade_params)
        self.assertFalse(adjusted_params.get('allowed', True), "Trade should be blocked near earnings")
        print("✅ Rule 4: Earnings avoidance - PASSED")
        
        # Test Rule 6: Friday 0DTE timing
        self.mock_algo.Time = Mock()
        self.mock_algo.Time.hour = 9
        self.mock_algo.Time.minute = 30
        
        trade_params = {'strategy': 'FRIDAY_0DTE'}
        adjusted_params = self.phase_manager.ApplyWisdomRules(trade_params)
        self.assertFalse(adjusted_params.get('allowed', True), "Friday 0DTE should be blocked before 10:30 AM")
        print("✅ Rule 6: Friday 0DTE timing - PASSED")
    
    def test_phase_metrics_and_progression(self):
        """Test phase metrics calculation and progression tracking"""
        print("\n=== TESTING PHASE METRICS AND PROGRESSION ===")
        
        # Test Phase 2 metrics
        self.mock_algo.Portfolio.TotalPortfolioValue = 45000
        self.phase_manager.UpdatePhase()
        
        metrics = self.phase_manager.GetPhaseMetrics()
        
        print(f"Phase Metrics:")
        print(f"  Current Phase: {metrics['current_phase']}")
        print(f"  Phase Name: {metrics['phase_name']}")
        print(f"  Portfolio Value: £{metrics['portfolio_value']:,}")
        print(f"  Phase Range: £{metrics['min_balance']:,} - £{metrics['max_balance']:,}")
        print(f"  Max Positions: {metrics['max_positions']}")
        print(f"  Max Risk per Trade: {metrics['max_risk_per_trade']:.1%}")
        print(f"  Progress to Next Phase: {metrics['progress_to_next']:.1f}%")
        print(f"  Strategies Available: {metrics['strategies_available']}")
        
        # Verify calculations
        self.assertEqual(metrics['current_phase'], 2)
        self.assertEqual(metrics['portfolio_value'], 45000)
        self.assertEqual(metrics['max_positions'], 10)
        self.assertEqual(metrics['max_risk_per_trade'], 0.04)
        
        # Progress calculation: (45000 - 40000) / (60000 - 40000) = 25%
        expected_progress = (45000 - 40000) / (60000 - 40000) * 100
        self.assertAlmostEqual(metrics['progress_to_next'], expected_progress, places=1)
        print(f"✅ Progress calculation verified: {expected_progress:.1f}%")
    
    def test_monthly_targets_by_phase(self):
        """Test monthly return targets scale with account phase"""
        print("\n=== TESTING MONTHLY TARGETS BY PHASE ===")
        
        expected_targets = {
            1: 0.05,  # 5% monthly in Phase 1
            2: 0.08,  # 8% monthly in Phase 2  
            3: 0.10,  # 10% monthly in Phase 3
            4: 0.12   # 12% monthly in Phase 4
        }
        
        for phase, expected_target in expected_targets.items():
            # Set appropriate portfolio value for phase
            portfolio_values = {1: 35000, 2: 50000, 3: 67500, 4: 100000}
            
            self.mock_algo.Portfolio.TotalPortfolioValue = portfolio_values[phase]
            self.phase_manager.UpdatePhase()
            
            target = self.phase_manager.GetMonthlyTarget()
            self.assertEqual(target, expected_target, f"Phase {phase} should have {expected_target:.1%} monthly target")
            
            print(f"Phase {phase}: {target:.1%} monthly target ✅")
    
    def run_comprehensive_test(self):
        """Run all tests and generate comprehensive report"""
        print("STARTING COMPREHENSIVE PHASE-BASED STRATEGY ACCESS TEST")
        print("=" * 80)
        
        try:
            # Run all test methods
            test_methods = [
                self.test_phase_1_requirements,
                self.test_phase_2_requirements, 
                self.test_phase_3_requirements,
                self.test_phase_4_requirements,
                self.test_phase_transitions,
                self.test_position_sizing_with_phase_limits,
                self.test_tom_king_wisdom_rules_integration,
                self.test_phase_metrics_and_progression,
                self.test_monthly_targets_by_phase
            ]
            
            passed_tests = 0
            total_tests = len(test_methods)
            
            for test_method in test_methods:
                try:
                    test_method()
                    passed_tests += 1
                    print(f"✅ {test_method.__name__}: PASSED")
                except Exception as e:
                    print(f"❌ {test_method.__name__}: FAILED - {str(e)}")
            
            print("\n" + "=" * 80)
            print("🎯 TEST SUMMARY")
            print("=" * 80)
            print(f"Total Tests: {total_tests}")
            print(f"Passed: {passed_tests}")
            print(f"Failed: {total_tests - passed_tests}")
            print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
            
            if passed_tests == total_tests:
                print("\n🏆 ALL TESTS PASSED! Phase-based strategy access system is working correctly.")
            else:
                print(f"\n⚠️  {total_tests - passed_tests} tests failed. Review implementation.")
                
        except Exception as e:
            print(f"❌ Test execution failed: {str(e)}")

def run_phase_access_tests():
    """Main function to run the phase access tests"""
    
    # Create and run the test suite
    test_suite = TestPhaseBasedStrategyAccess()
    test_suite.setUp()
    
    print("Tom King Trading Framework - Phase-Based Strategy Access Test")
    print("Testing phase progression and strategy gating requirements")
    print("Date: September 5, 2025")
    print("")
    
    # Run comprehensive test
    test_suite.run_comprehensive_test()
    
    return test_suite

# Run tests if executed directly
if __name__ == "__main__":
    run_phase_access_tests()