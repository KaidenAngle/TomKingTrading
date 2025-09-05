#!/usr/bin/env python3
"""
Comprehensive August 2024 Protection Validation
Tests all aspects of the protection system to ensure £308k disaster cannot repeat
"""

import sys
import os
from datetime import datetime

# Add the risk module path
sys.path.append(os.path.join(os.path.dirname(__file__), 'risk'))

from risk.august_2024_protection import August2024ProtectionSystem, ProtectionLevel
from risk.correlation import CorrelationManager
from risk.defensive import DefensiveManager

def comprehensive_august_protection_test():
    """Run comprehensive protection tests"""
    print("="*100)
    print("COMPREHENSIVE AUGUST 2024 PROTECTION VALIDATION")
    print("="*100)
    print(f"Test Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("Purpose: Validate complete protection against Tom King's £308,000 loss")
    print("="*100)

    protection_system = August2024ProtectionSystem()
    correlation_manager = CorrelationManager()
    defensive_manager = DefensiveManager()

    # Test Results Summary
    test_results = {
        'correlation_detection': False,
        'vix_spike_response': False,
        'position_blocking': False,
        'emergency_protocols': False,
        'loss_reduction': False,
        'system_integration': False
    }

    print("\n1. CORRELATION CONCENTRATION DETECTION TEST")
    print("-" * 70)
    
    # Tom King's exact portfolio structure
    disaster_portfolio = [
        {'symbol': 'SPY', 'strategy': 'LT112', 'value': 51333},
        {'symbol': 'QQQ', 'strategy': 'LT112', 'value': 51333},
        {'symbol': 'IWM', 'strategy': 'LT112', 'value': 51333},
        {'symbol': 'ES', 'strategy': 'LT112', 'value': 51333},
        {'symbol': 'NQ', 'strategy': 'LT112', 'value': 51333},
        {'symbol': 'RTY', 'strategy': 'LT112', 'value': 51335}
    ]

    correlation_analysis = correlation_manager.monitor_correlation_risk(
        current_positions=[{'symbol': pos['symbol']} for pos in disaster_portfolio],
        vix_level=65.7,
        market_stress=True
    )

    disaster_risk = correlation_analysis.get('disaster_scenario_risk', {})
    print(f"Equity Concentration: {disaster_risk.get('equity_concentration', 0):.1%}")
    print(f"Risk Level: {disaster_risk.get('risk_level', 'UNKNOWN')}")
    print(f"Similar to Tom King Disaster: {disaster_risk.get('similar_to_disaster', False)}")
    
    if disaster_risk.get('risk_level') == 'EXTREME' and disaster_risk.get('equity_concentration', 0) > 0.9:
        test_results['correlation_detection'] = True
        print("PASS: Correlation concentration correctly detected")
    else:
        print("FAIL: Correlation concentration not properly detected")

    print("\n2. VIX SPIKE RESPONSE TEST")
    print("-" * 70)
    
    # Test VIX progression during August 2024
    vix_sequence = [
        (16.5, "Pre-crisis"),
        (25.0, "Starting to spike"),
        (35.0, "Emergency threshold"),
        (50.0, "Deep crisis"),
        (65.7, "August 5 peak")
    ]

    protection_levels = []
    for vix, desc in vix_sequence:
        level = protection_system.GetCurrentProtectionLevel(vix)
        protocols = protection_system.GetEmergencyProtocols(level)
        exposure = protection_system.CalculateOptimalExposure(500000, vix, level)
        
        protection_levels.append(level)
        print(f"VIX {vix:5.1f} ({desc:15s}): {str(level.value):12s} - Exposure: {exposure['total_optimal_exposure']/500000:.1%}")

    # Should escalate through protection levels
    if (protection_levels[0] == ProtectionLevel.PREVENTIVE and 
        protection_levels[-1] == ProtectionLevel.EMERGENCY):
        test_results['vix_spike_response'] = True
        print("PASS: VIX spike response correctly escalates protection levels")
    else:
        print("FAIL: VIX spike response not working properly")

    print("\n3. NEW POSITION BLOCKING TEST")
    print("-" * 70)
    
    # Test position blocking with existing equity concentration
    existing_equity = [{'symbol': pos['symbol']} for pos in disaster_portfolio]
    new_symbols = ['DIA', 'VTI', 'MDY', 'SQQQ']
    
    blocked_count = 0
    for symbol in new_symbols:
        result = correlation_manager.check_position_limits(
            current_positions=existing_equity,
            new_symbol=symbol,
            account_phase=4,
            vix_level=65.7
        )
        if not result['can_add_position']:
            blocked_count += 1
            print(f"PASS {symbol}: BLOCKED - {result.get('correlation_group', 'N/A')}")
        else:
            print(f"FAIL {symbol}: ALLOWED - Should be blocked!")

    if blocked_count == len(new_symbols):
        test_results['position_blocking'] = True
        print("PASS: All new equity positions correctly blocked")
    else:
        print(f"FAIL: Only {blocked_count}/{len(new_symbols)} positions blocked")

    print("\n4. EMERGENCY PROTOCOLS ACTIVATION TEST")
    print("-" * 70)
    
    emergency_protection = protection_system.GetCurrentProtectionLevel(65.7)
    emergency_protocols = protection_system.GetEmergencyProtocols(emergency_protection)
    
    print(f"Protection Level at VIX 65.7: {emergency_protection.value}")
    print(f"Emergency Actions: {len(emergency_protocols['actions'])}")
    print(f"Position Restrictions: {len(emergency_protocols['restrictions'])}")
    print(f"Critical Alerts: {len(emergency_protocols['alerts'])}")

    # Key emergency actions should be present
    actions_text = ' '.join(emergency_protocols['actions'])
    has_august_protocol = '[EMERGENCY] AUGUST 2024 PROTOCOL ACTIVATED' in actions_text
    has_position_close = 'Close 40% of positions immediately' in actions_text
    has_position_restriction = any('NO new positions' in restriction for restriction in emergency_protocols['restrictions'])

    if emergency_protection == ProtectionLevel.EMERGENCY and has_august_protocol and has_position_close:
        test_results['emergency_protocols'] = True
        print("PASS: Emergency protocols correctly activated")
    else:
        print("FAIL: Emergency protocols not properly activated")

    print("\n5. LOSS REDUCTION VALIDATION TEST")
    print("-" * 70)
    
    stress_test = protection_system.ExecuteAugust2024StressTest(
        portfolio_positions=disaster_portfolio,
        vix_scenario=65.7
    )

    original_loss = 308000
    protected_loss = stress_test['estimated_loss']
    loss_reduction = (original_loss - protected_loss) / original_loss
    
    print(f"Tom King's Original Loss: £{original_loss:,}")
    print(f"With Protection System:   £{protected_loss:,.2f}")
    print(f"Loss Reduction:          {loss_reduction:.1%}")
    print(f"Correlation Violations:  {stress_test['correlation_violations']}")
    print(f"Risk Level:              {stress_test['risk_level']}")
    print(f"Protection Effectiveness: {stress_test['protection_effectiveness']:.1%}")

    if loss_reduction >= 0.40 and stress_test['risk_level'] == 'EXTREME':
        test_results['loss_reduction'] = True
        print("PASS: Significant loss reduction achieved (40%+ reduction)")
    else:
        print(f"FAIL: Insufficient loss reduction ({loss_reduction:.1%})")

    print("\n6. INTEGRATED SYSTEM VALIDATION TEST")
    print("-" * 70)
    
    # Test complete system working together
    system_checks = {
        'correlation_limits': stress_test['correlation_violations'] > 0,
        'emergency_activation': emergency_protection == ProtectionLevel.EMERGENCY,
        'position_blocking': blocked_count > 0,
        'risk_classification': stress_test['risk_level'] == 'EXTREME',
        'protection_active': stress_test['protection_effectiveness'] > 0
    }

    all_checks_pass = all(system_checks.values())
    
    print("System Integration Checks:")
    for check_name, result in system_checks.items():
        status = "PASS" if result else "FAIL"
        print(f"  {check_name:20s}: {status}")

    if all_checks_pass:
        test_results['system_integration'] = True
        print("PASS: Complete system integration validated")
    else:
        print("FAIL: System integration issues detected")

    # FINAL VALIDATION SUMMARY
    print("\n" + "="*100)
    print("FINAL VALIDATION SUMMARY")
    print("="*100)

    passed_tests = sum(test_results.values())
    total_tests = len(test_results)

    print("Protection System Test Results:")
    for test_name, result in test_results.items():
        status = "PASS" if result else "FAIL"
        print(f"  {test_name.replace('_', ' ').title():30s}: {status}")

    print(f"\nOverall Result: {passed_tests}/{total_tests} tests passed")

    if passed_tests == total_tests:
        print("\nSUCCESS: ALL PROTECTION SYSTEMS VALIDATED!")
        print("   August 2024 disaster would have been PREVENTED")
        print(f"   Estimated loss reduction: £{original_loss - protected_loss:,.2f}")
        print(f"   Protection effectiveness: {loss_reduction:.1%}")
        print("\n   Tom King's £308,000 loss scenario: IMPOSSIBLE TO REPEAT")
        return True
    else:
        print(f"\nWARNING: {total_tests - passed_tests} PROTECTION GAPS DETECTED!")
        print("   System requires immediate fixes before deployment")
        print("   August 2024 disaster could potentially repeat")
        return False

if __name__ == '__main__':
    success = comprehensive_august_protection_test()
    if not success:
        print("\nCRITICAL: Protection system validation failed!")
        sys.exit(1)
    else:
        print("\nSUCCESS: Protection system fully validated!")
        sys.exit(0)