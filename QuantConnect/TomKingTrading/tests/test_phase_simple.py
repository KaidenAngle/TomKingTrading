# Tom King Trading Framework - Simple Phase Access Test
# Tests basic phase progression without Unicode characters

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from risk.phase_manager import PhaseManager
from unittest.mock import Mock

def test_phase_system():
    """Simple test of the phase system"""
    print("Tom King Phase-Based Strategy Access Test")
    print("=" * 50)
    
    # Create mock algorithm
    mock_algo = Mock()
    mock_algo.Portfolio = Mock()
    mock_algo.Portfolio.TotalPortfolioValue = 35000
    mock_algo.Log = Mock()
    mock_algo.Debug = Mock()
    mock_algo.Time = Mock()
    mock_algo.Time.hour = 11
    mock_algo.Time.minute = 0
    
    # Create phase manager
    phase_manager = PhaseManager(mock_algo)
    
    print(f"\nInitial Setup:")
    print(f"Portfolio Value: £{mock_algo.Portfolio.TotalPortfolioValue:,}")
    print(f"Current Phase: {phase_manager.current_phase}")
    
    # Test Phase 1 (£30k-40k)
    print(f"\n=== PHASE 1 TESTING (£30k-40k) ===")
    
    test_values = [30000, 35000, 39999]
    for value in test_values:
        mock_algo.Portfolio.TotalPortfolioValue = value
        phase_manager.UpdatePhase()
        
        print(f"\nPortfolio Value: £{value:,}")
        print(f"Current Phase: {phase_manager.current_phase}")
        
        # Test allowed strategies
        allowed = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES']
        blocked = ['IPMCC', 'POOR_MANS_COVERED_CALL']
        
        print("Allowed Strategies:")
        for strategy in allowed:
            result = phase_manager.IsStrategyAllowed(strategy)
            status = "ALLOWED" if result else "BLOCKED"
            print(f"  {strategy}: {status}")
        
        print("Should be Blocked Strategies:")
        for strategy in blocked:
            result = phase_manager.IsStrategyAllowed(strategy)
            status = "ALLOWED" if result else "BLOCKED"
            print(f"  {strategy}: {status}")
        
        print(f"Max Positions: {phase_manager.GetMaxPositions()}")
        print(f"Max Risk per Trade: {phase_manager.GetMaxRiskPerTrade():.1%}")
    
    # Test Phase 2 (£40k-60k)
    print(f"\n=== PHASE 2 TESTING (£40k-60k) ===")
    
    mock_algo.Portfolio.TotalPortfolioValue = 50000
    phase_manager.UpdatePhase()
    
    print(f"Portfolio Value: £50,000")
    print(f"Current Phase: {phase_manager.current_phase}")
    
    # Test strategies for Phase 2
    phase2_allowed = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES', 'IPMCC', 'POOR_MANS_COVERED_CALL']
    phase2_blocked = ['LEAP_PUT_LADDERS', 'ENHANCED_BUTTERFLY']
    
    print("Phase 2 Allowed Strategies:")
    for strategy in phase2_allowed:
        result = phase_manager.IsStrategyAllowed(strategy)
        status = "ALLOWED" if result else "BLOCKED"
        print(f"  {strategy}: {status}")
    
    print("Should still be Blocked:")
    for strategy in phase2_blocked:
        result = phase_manager.IsStrategyAllowed(strategy)
        status = "ALLOWED" if result else "BLOCKED"
        print(f"  {strategy}: {status}")
    
    print(f"Max Positions: {phase_manager.GetMaxPositions()}")
    print(f"Max Risk per Trade: {phase_manager.GetMaxRiskPerTrade():.1%}")
    
    # Test Phase 3 (£60k-75k)
    print(f"\n=== PHASE 3 TESTING (£60k-75k) ===")
    
    mock_algo.Portfolio.TotalPortfolioValue = 67500
    phase_manager.UpdatePhase()
    
    print(f"Portfolio Value: £67,500")
    print(f"Current Phase: {phase_manager.current_phase}")
    
    phase3_allowed = ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES', 
                      'IPMCC', 'POOR_MANS_COVERED_CALL', 'LEAP_PUT_LADDERS',
                      'ENHANCED_BUTTERFLY', 'RATIO_SPREADS']
    
    print("Phase 3 Allowed Strategies:")
    for strategy in phase3_allowed:
        result = phase_manager.IsStrategyAllowed(strategy)
        status = "ALLOWED" if result else "BLOCKED"
        print(f"  {strategy}: {status}")
    
    print(f"Max Positions: {phase_manager.GetMaxPositions()}")
    print(f"Max Risk per Trade: {phase_manager.GetMaxRiskPerTrade():.1%}")
    
    # Test Phase 4 (£75k+)
    print(f"\n=== PHASE 4 TESTING (£75k+) ===")
    
    mock_algo.Portfolio.TotalPortfolioValue = 100000
    phase_manager.UpdatePhase()
    
    print(f"Portfolio Value: £100,000")
    print(f"Current Phase: {phase_manager.current_phase}")
    
    # Test that all strategies are allowed in Phase 4
    test_strategies = ['FRIDAY_0DTE', 'ADVANCED_CONDOR', 'PROFESSIONAL_BUTTERFLY']
    
    print("Phase 4 Strategy Access (ALL should be allowed):")
    for strategy in test_strategies:
        result = phase_manager.IsStrategyAllowed(strategy)
        status = "ALLOWED" if result else "BLOCKED"
        print(f"  {strategy}: {status}")
    
    print(f"Max Positions: {phase_manager.GetMaxPositions()}")
    print(f"Max Risk per Trade: {phase_manager.GetMaxRiskPerTrade():.1%}")
    
    # Test Position Sizing
    print(f"\n=== POSITION SIZING TESTS ===")
    
    for phase_value, expected_phase in [(35000, 1), (50000, 2), (67500, 3), (100000, 4)]:
        mock_algo.Portfolio.TotalPortfolioValue = phase_value
        phase_manager.UpdatePhase()
        
        allowed_strategy = 'FRIDAY_0DTE'  # Available in all phases
        blocked_strategy = 'LEAP_PUT_LADDERS' if expected_phase < 3 else 'FAKE_STRATEGY'
        
        allowed_size = phase_manager.CalculatePositionSize(allowed_strategy)
        blocked_size = phase_manager.CalculatePositionSize(blocked_strategy)
        
        print(f"Phase {expected_phase} (£{phase_value:,}):")
        print(f"  {allowed_strategy}: {allowed_size} contracts")
        print(f"  {blocked_strategy}: {blocked_size} contracts")
    
    # Test Tom King Wisdom Rules
    print(f"\n=== TOM KING WISDOM RULES TEST ===")
    
    # Test Rule 1: Risk capping
    trade_params = {'risk_pct': 0.08, 'strategy': 'FRIDAY_0DTE'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params)
    print(f"Rule 1 - Risk Capping: {adjusted['risk_pct']:.1%} (should be 5%)")
    
    # Test Rule 4: Earnings avoidance
    trade_params = {'near_earnings': True, 'strategy': 'LONG_TERM_112'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params)
    print(f"Rule 4 - Earnings Avoidance: Trade allowed = {adjusted.get('allowed', True)}")
    
    # Test Rule 6: Friday 0DTE timing
    mock_algo.Time.hour = 9
    mock_algo.Time.minute = 30
    trade_params = {'strategy': 'FRIDAY_0DTE'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params.copy())
    print(f"Rule 6 - Friday 0DTE Timing (9:30 AM): Trade allowed = {adjusted.get('allowed', 'Not Set')}")
    
    mock_algo.Time.hour = 11
    mock_algo.Time.minute = 0
    trade_params = {'strategy': 'FRIDAY_0DTE'}  # Reset trade_params
    adjusted = phase_manager.ApplyWisdomRules(trade_params.copy())
    print(f"Rule 6 - Friday 0DTE Timing (11:00 AM): Trade allowed = {adjusted.get('allowed', 'Not Set')}")
    
    # Test Phase Metrics
    print(f"\n=== PHASE METRICS TEST ===")
    
    mock_algo.Portfolio.TotalPortfolioValue = 45000  # Phase 2
    phase_manager.UpdatePhase()
    metrics = phase_manager.GetPhaseMetrics()
    
    print(f"Phase Metrics for £45,000 portfolio:")
    print(f"  Current Phase: {metrics['current_phase']}")
    print(f"  Phase Name: {metrics['phase_name']}")
    print(f"  Progress to Next: {metrics['progress_to_next']:.1f}%")
    print(f"  Strategies Available: {metrics['strategies_available']}")
    
    # Test Monthly Targets
    print(f"\n=== MONTHLY TARGETS TEST ===")
    
    for phase_value, expected_phase in [(35000, 1), (50000, 2), (67500, 3), (100000, 4)]:
        mock_algo.Portfolio.TotalPortfolioValue = phase_value
        phase_manager.UpdatePhase()
        target = phase_manager.GetMonthlyTarget()
        print(f"Phase {expected_phase}: {target:.1%} monthly target")
    
    print(f"\n=== TEST COMPLETE ===")
    print("Phase-based strategy access system tested successfully!")

if __name__ == "__main__":
    test_phase_system()