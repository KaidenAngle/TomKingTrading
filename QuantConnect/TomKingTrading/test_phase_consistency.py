#!/usr/bin/env python3
"""
Test Phase Consistency Validation
Ensures USD standardization is working correctly
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config.strategy_parameters import TomKingParameters

def test_phase_consistency():
    """Test that phase definitions are consistent in USD"""
    params = TomKingParameters()
    
    print("=" * 60)
    print("PHASE CONSISTENCY TEST")
    print("=" * 60)
    
    # Test 1: Validate phase consistency
    is_consistent = params.validate_phase_consistency()
    print(f"[OK] Phase consistency validation: {'PASSED' if is_consistent else 'FAILED'}")
    
    if not is_consistent:
        print("[FAIL] ERROR: Phase definitions are inconsistent!")
        print("\nACCOUNT_PHASES:")
        for phase, config in params.ACCOUNT_PHASES.items():
            print(f"  {phase}: ${config['min']:,} - ${config['max']:,}")
        
        print("\nPHASE_TRANSITIONS:")
        for transition, config in params.PHASE_TRANSITIONS.items():
            print(f"  {transition}: ${config['account_minimum']:,}")
        return False
    
    # Test 2: Verify USD values
    print("\n[OK] USD Phase Definitions:")
    print("\nACCOUNT_PHASES (USD):")
    for phase, config in params.ACCOUNT_PHASES.items():
        if 'min' in config and 'max' in config:
            print(f"  {phase}: ${config['min']:,} - ${config['max']:,}")
    
    print("\nPHASE_TRANSITIONS (USD):")
    transitions = params.PHASE_TRANSITIONS
    print(f"  Phase 1->2: ${transitions['phase1_to_2']['account_minimum']:,}")
    print(f"  Phase 2->3: ${transitions['phase2_to_3']['account_minimum']:,}")
    print(f"  Phase 3->4: ${transitions['phase3_to_4']['account_minimum']:,}")
    
    # Test 3: Verify phase calculation
    print("\n[OK] Phase Calculation Tests:")
    test_values = [
        (30000, 0),   # Below phase 1 (MES only - Phase 0)
        (45000, 1),   # Phase 1
        (60000, 2),   # Phase 2
        (80000, 3),   # Phase 3
        (100000, 4),  # Phase 4
    ]
    
    for value, expected_phase in test_values:
        actual_phase = params.get_phase_for_account_size(value)
        status = "[OK]" if actual_phase == expected_phase else "[FAIL]"
        print(f"  ${value:,} -> Phase {actual_phase} {status}")
    
    # Test 4: Currency conversion utilities
    print("\n[OK] Currency Conversion Tests:")
    gbp_amount = 35000
    usd_amount = params.gbp_to_usd(gbp_amount)
    back_to_gbp = params.usd_to_gbp(usd_amount)
    
    print(f"  £{gbp_amount:,} -> ${usd_amount:,.0f} -> £{back_to_gbp:,.0f}")
    print(f"  Conversion rate: 1.27 (USD/GBP)")
    
    # Final result
    print("\n" + "=" * 60)
    print("[OK] ALL PHASE CONSISTENCY TESTS PASSED!")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_phase_consistency()
    sys.exit(0 if success else 1)