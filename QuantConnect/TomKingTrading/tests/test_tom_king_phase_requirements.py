# Tom King Trading Framework - Complete Phase Requirements Test
# Validates all Tom King phase-based strategy access requirements

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from risk.phase_manager import PhaseManager
from unittest.mock import Mock

def test_tom_king_phase_requirements():
    """Test all Tom King phase requirements as specified"""
    print("TOM KING TRADING FRAMEWORK - PHASE REQUIREMENTS TEST")
    print("=" * 60)
    print("Testing Tom King's 4-phase system strategy access control")
    print("Date: September 5, 2025")
    print("")
    
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
    
    # Tom King Phase Requirements (as specified)
    requirements = {
        1: {
            'balance_range': (30000, 40000),
            'allowed_strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES'],
            'blocked_strategies': ['IPMCC', 'CALENDARIZED_112', 'ENHANCED_STRANGLES',
                                 'BEAR_TRAP_11X', 'ADVANCED_0DTE', 'LEAP_PUT_LADDERS',
                                 'SECTION_9B_ADVANCED'],
            'max_positions': 6,
            'max_risk': 0.03,
            'description': 'Foundation Phase - Basic strategies only'
        },
        2: {
            'balance_range': (40000, 60000),
            'allowed_strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                                 'IPMCC', 'CALENDARIZED_112', 'ENHANCED_STRANGLES'],
            'blocked_strategies': ['BEAR_TRAP_11X', 'ADVANCED_0DTE', 'LEAP_PUT_LADDERS',
                                 'SECTION_9B_ADVANCED'],
            'max_positions': 10,
            'max_risk': 0.04,
            'description': 'Growth Phase - Intermediate strategies unlocked'
        },
        3: {
            'balance_range': (60000, 75000),
            'allowed_strategies': ['FRIDAY_0DTE', 'LONG_TERM_112', 'FUTURES_STRANGLES',
                                 'IPMCC', 'CALENDARIZED_112', 'ENHANCED_STRANGLES',
                                 'BEAR_TRAP_11X', 'ADVANCED_0DTE', 'LEAP_PUT_LADDERS',
                                 'SECTION_9B_ADVANCED'],
            'blocked_strategies': [],  # All known strategies should be allowed
            'max_positions': 12,
            'max_risk': 0.05,
            'description': 'Advanced Phase - All Tom King strategies available'
        },
        4: {
            'balance_range': (75000, float('inf')),
            'allowed_strategies': 'ALL',  # Special case
            'blocked_strategies': [],
            'max_positions': 15,
            'max_risk': 0.05,
            'description': 'Professional Phase - Full access + position scaling'
        }
    }
    
    test_results = {}
    overall_pass = True
    
    # Test each phase
    for phase_num, req in requirements.items():
        print(f"\n{'='*60}")
        print(f"TESTING PHASE {phase_num} ({req['description']})")
        print(f"Balance Range: £{req['balance_range'][0]:,} - £{req['balance_range'][1]:,}")
        print(f"{'='*60}")
        
        # Test with mid-range balance for phase
        if phase_num == 4:
            test_balance = 100000  # £100k for Phase 4
        else:
            # Use middle of range
            min_bal, max_bal = req['balance_range']
            test_balance = (min_bal + max_bal) // 2
        
        mock_algo.Portfolio.TotalPortfolioValue = test_balance
        phase_manager.UpdatePhase()
        
        phase_results = {
            'phase_detection': False,
            'strategy_access': True,
            'position_limits': False,
            'risk_limits': False,
            'issues': []
        }
        
        # Test 1: Phase Detection
        detected_phase = phase_manager.current_phase
        if detected_phase == phase_num:
            phase_results['phase_detection'] = True
            print(f"[PASS] Phase Detection: Detected Phase {detected_phase}")
        else:
            phase_results['phase_detection'] = False
            phase_results['issues'].append(f"Phase detection failed: Expected {phase_num}, got {detected_phase}")
            print(f"[FAIL] Phase Detection: Expected {phase_num}, got {detected_phase}")
            overall_pass = False
        
        # Test 2: Strategy Access Control
        print(f"\n--- Strategy Access Control ---")
        
        if req['allowed_strategies'] == 'ALL':
            # Phase 4: Test that all strategies are allowed
            test_strategies = ['FRIDAY_0DTE', 'BEAR_TRAP_11X', 'ADVANCED_0DTE', 
                             'SECTION_9B_ADVANCED', 'UNKNOWN_STRATEGY']
            all_allowed = True
            for strategy in test_strategies:
                allowed = phase_manager.IsStrategyAllowed(strategy)
                status = "ALLOWED" if allowed else "BLOCKED"
                print(f"  {strategy}: {status}")
                if not allowed and strategy != 'UNKNOWN_STRATEGY':
                    all_allowed = False
                    phase_results['issues'].append(f"Strategy {strategy} should be allowed in Phase 4")
            
            if all_allowed:
                print(f"[PASS] Strategy Access: All strategies allowed")
            else:
                print(f"[FAIL] Strategy Access: Some strategies incorrectly blocked")
                phase_results['strategy_access'] = False
                overall_pass = False
        else:
            # Test allowed strategies
            print("  Allowed Strategies:")
            for strategy in req['allowed_strategies']:
                allowed = phase_manager.IsStrategyAllowed(strategy)
                status = "ALLOWED" if allowed else "BLOCKED"
                print(f"    {strategy}: {status}")
                if not allowed:
                    phase_results['strategy_access'] = False
                    phase_results['issues'].append(f"Strategy {strategy} should be allowed in Phase {phase_num}")
                    overall_pass = False
            
            # Test blocked strategies
            print("  Should be Blocked:")
            for strategy in req['blocked_strategies']:
                allowed = phase_manager.IsStrategyAllowed(strategy)
                status = "ALLOWED" if allowed else "BLOCKED"
                print(f"    {strategy}: {status}")
                if allowed:
                    phase_results['strategy_access'] = False
                    phase_results['issues'].append(f"Strategy {strategy} should be blocked in Phase {phase_num}")
                    overall_pass = False
            
            if phase_results['strategy_access']:
                print(f"[PASS] Strategy Access: PASSED")
            else:
                print(f"[FAIL] Strategy Access: FAILED")
        
        # Test 3: Position Limits
        max_positions = phase_manager.GetMaxPositions()
        if max_positions == req['max_positions']:
            phase_results['position_limits'] = True
            print(f"[PASS] Position Limits: PASSED ({max_positions} positions)")
        else:
            phase_results['position_limits'] = False
            phase_results['issues'].append(f"Position limit: Expected {req['max_positions']}, got {max_positions}")
            print(f"[FAIL] Position Limits: FAILED (Expected {req['max_positions']}, got {max_positions})")
            overall_pass = False
        
        # Test 4: Risk Limits
        max_risk = phase_manager.GetMaxRiskPerTrade()
        if max_risk == req['max_risk']:
            phase_results['risk_limits'] = True
            print(f"[PASS] Risk Limits: PASSED ({max_risk:.1%} per trade)")
        else:
            phase_results['risk_limits'] = False
            phase_results['issues'].append(f"Risk limit: Expected {req['max_risk']:.1%}, got {max_risk:.1%}")
            print(f"[FAIL] Risk Limits: FAILED (Expected {req['max_risk']:.1%}, got {max_risk:.1%})")
            overall_pass = False
        
        # Test 5: Position Sizing with Blocked Strategies
        print(f"\n--- Position Sizing Tests ---")
        if req['allowed_strategies'] != 'ALL':
            allowed_strategy = req['allowed_strategies'][0]
            blocked_strategy = req['blocked_strategies'][0] if req['blocked_strategies'] else 'FAKE_STRATEGY'
        else:
            allowed_strategy = 'FRIDAY_0DTE'
            blocked_strategy = 'FAKE_STRATEGY'
        
        allowed_size = phase_manager.CalculatePositionSize(allowed_strategy)
        blocked_size = phase_manager.CalculatePositionSize(blocked_strategy)
        
        print(f"  {allowed_strategy}: {allowed_size} contracts")
        print(f"  {blocked_strategy}: {blocked_size} contracts")
        
        if allowed_size > 0 and blocked_size == 0:
            print(f"[PASS] Position Sizing: PASSED")
        else:
            phase_results['issues'].append("Position sizing logic incorrect")
            print(f"[FAIL] Position Sizing: FAILED")
            overall_pass = False
        
        test_results[phase_num] = phase_results
    
    # Test Phase Transitions
    print(f"\n{'='*60}")
    print(f"TESTING PHASE TRANSITIONS")
    print(f"{'='*60}")
    
    transition_pass = True
    
    # Test transition from Phase 1 to Phase 2
    mock_algo.Portfolio.TotalPortfolioValue = 35000  # Phase 1
    phase_manager.UpdatePhase()
    initial_phase = phase_manager.current_phase
    
    mock_algo.Portfolio.TotalPortfolioValue = 45000  # Phase 2
    phase_manager.UpdatePhase()
    new_phase = phase_manager.current_phase
    
    if initial_phase == 1 and new_phase == 2:
        print("[PASS] Phase 1 -> Phase 2 Transition: PASSED")
    else:
        print(f"[FAIL] Phase 1 -> Phase 2 Transition: FAILED ({initial_phase} -> {new_phase})")
        transition_pass = False
        overall_pass = False
    
    # Test transition to Phase 3
    mock_algo.Portfolio.TotalPortfolioValue = 67500  # Phase 3
    phase_manager.UpdatePhase()
    phase3 = phase_manager.current_phase
    
    if phase3 == 3:
        print("[PASS] Phase 2 -> Phase 3 Transition: PASSED")
    else:
        print(f"[FAIL] Phase 2 -> Phase 3 Transition: FAILED (Expected 3, got {phase3})")
        transition_pass = False
        overall_pass = False
    
    # Test transition to Phase 4
    mock_algo.Portfolio.TotalPortfolioValue = 80000  # Phase 4
    phase_manager.UpdatePhase()
    phase4 = phase_manager.current_phase
    
    if phase4 == 4:
        print("[PASS] Phase 3 -> Phase 4 Transition: PASSED")
    else:
        print(f"[FAIL] Phase 3 -> Phase 4 Transition: FAILED (Expected 4, got {phase4})")
        transition_pass = False
        overall_pass = False
    
    # Test Tom King Wisdom Rules
    print(f"\n{'='*60}")
    print(f"TESTING TOM KING WISDOM RULES")
    print(f"{'='*60}")
    
    wisdom_pass = True
    
    # Rule 1: Never risk more than 5%
    trade_params = {'risk_pct': 0.08, 'strategy': 'FRIDAY_0DTE'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params)
    if adjusted['risk_pct'] == 0.05:
        print("[PASS] Wisdom Rule 1 (Risk Capping): PASSED")
    else:
        print(f"[FAIL] Wisdom Rule 1 (Risk Capping): FAILED ({adjusted['risk_pct']:.1%})")
        wisdom_pass = False
        overall_pass = False
    
    # Rule 4: Avoid earnings
    trade_params = {'near_earnings': True, 'strategy': 'LONG_TERM_112'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params)
    if adjusted.get('allowed') == False:
        print("[PASS] Wisdom Rule 4 (Earnings Avoidance): PASSED")
    else:
        print("[FAIL] Wisdom Rule 4 (Earnings Avoidance): FAILED")
        wisdom_pass = False
        overall_pass = False
    
    # Rule 6: Friday 0DTE timing
    mock_algo.Time.hour = 9
    mock_algo.Time.minute = 30
    trade_params = {'strategy': 'FRIDAY_0DTE'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params.copy())
    early_blocked = adjusted.get('allowed') == False
    
    mock_algo.Time.hour = 11
    mock_algo.Time.minute = 0
    trade_params = {'strategy': 'FRIDAY_0DTE'}
    adjusted = phase_manager.ApplyWisdomRules(trade_params.copy())
    late_allowed = adjusted.get('allowed', True)
    
    if early_blocked and late_allowed:
        print("[PASS] Wisdom Rule 6 (Friday 0DTE Timing): PASSED")
    else:
        print(f"[FAIL] Wisdom Rule 6 (Friday 0DTE Timing): FAILED (Early: {early_blocked}, Late: {late_allowed})")
        wisdom_pass = False
        overall_pass = False
    
    # Generate Final Report
    print(f"\n{'='*60}")
    print(f"TOM KING PHASE SYSTEM - FINAL TEST REPORT")
    print(f"{'='*60}")
    
    # Count passed tests
    phase_tests_passed = sum(1 for phase_result in test_results.values() 
                           if all([phase_result['phase_detection'], 
                                  phase_result['strategy_access'],
                                  phase_result['position_limits'], 
                                  phase_result['risk_limits']]))
    
    print(f"Phase Detection Tests: {len([r for r in test_results.values() if r['phase_detection']])}/4 PASSED")
    print(f"Strategy Access Tests: {len([r for r in test_results.values() if r['strategy_access']])}/4 PASSED")
    print(f"Position Limit Tests: {len([r for r in test_results.values() if r['position_limits']])}/4 PASSED")
    print(f"Risk Limit Tests: {len([r for r in test_results.values() if r['risk_limits']])}/4 PASSED")
    print(f"Phase Transition Tests: {'PASSED' if transition_pass else 'FAILED'}")
    print(f"Tom King Wisdom Rules: {'PASSED' if wisdom_pass else 'FAILED'}")
    
    print(f"\n--- DETAILED ISSUES ---")
    total_issues = 0
    for phase_num, phase_result in test_results.items():
        if phase_result['issues']:
            print(f"Phase {phase_num}:")
            for issue in phase_result['issues']:
                print(f"  - {issue}")
                total_issues += 1
    
    if total_issues == 0:
        print("No issues found!")
    
    print(f"\n--- OVERALL RESULT ---")
    if overall_pass:
        print("[SUCCESS] ALL TESTS PASSED!")
        print("Tom King's phase-based strategy access system is working correctly.")
        print("[PASS] Inexperienced accounts are blocked from advanced strategies")
        print("[PASS] Position limits scale appropriately with account size") 
        print("[PASS] Risk limits prevent over-leveraging in early phases")
        print("[PASS] Tom King wisdom rules are properly enforced")
        return True
    else:
        print("[FAILED] SOME TESTS FAILED")
        print(f"Total Issues Found: {total_issues}")
        print("Review implementation to fix failing tests.")
        return False

if __name__ == "__main__":
    success = test_tom_king_phase_requirements()
    sys.exit(0 if success else 1)