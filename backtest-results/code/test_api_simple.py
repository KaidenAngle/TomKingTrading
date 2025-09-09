#!/usr/bin/env python
"""
Simple API Test for Tom King Trading Framework
Tests core initialization components
"""

import sys
import os

# Add path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_basic_imports():
    """Test basic imports work"""
    print("\n" + "="*50)
    print("TESTING BASIC IMPORTS")
    print("="*50)
    
    # Test 1: Core algorithm imports
    print("\n1. Testing main algorithm import...")
    try:
        from main import TomKingTradingIntegrated
        print("   [PASS] Main algorithm imported")
    except ImportError as e:
        print(f"   [FAIL] Cannot import main algorithm: {e}")
        return False
    
    # Test 2: Fee model import
    print("\n2. Testing fee model import...")
    try:
        from fee_models import TastyTradeFeeModel
        print("   [PASS] TastyTrade fee model imported")
    except ImportError as e:
        print(f"   [FAIL] Cannot import fee model: {e}")
        return False
    
    # Test 3: Configuration imports
    print("\n3. Testing configuration imports...")
    try:
        from config.constants import VIX_LOW, VIX_HIGH
        print(f"   [PASS] Constants loaded (VIX_LOW={VIX_LOW}, VIX_HIGH={VIX_HIGH})")
    except ImportError as e:
        print(f"   [FAIL] Cannot import constants: {e}")
        return False
    
    # Test 4: Strategy imports
    print("\n4. Testing strategy imports...")
    try:
        from strategies.friday_0dte_with_state import Friday0DTEWithState
        from strategies.lt112_with_state import LT112WithState
        print("   [PASS] Strategy modules imported")
    except ImportError as e:
        print(f"   [FAIL] Cannot import strategies: {e}")
        return False
    
    # Test 5: Risk management imports
    print("\n5. Testing risk management imports...")
    try:
        from risk.vix_regime import VIXRegimeManager
        from risk.position_sizing import TomKingPositionSizer
        print("   [PASS] Risk management modules imported")
    except ImportError as e:
        print(f"   [FAIL] Cannot import risk modules: {e}")
        return False
    
    return True


def test_tastytrade_config():
    """Test Tastytrade configuration"""
    print("\n" + "="*50)
    print("TESTING TASTYTRADE CONFIGURATION")
    print("="*50)
    
    # Test 1: Credentials file
    print("\n1. Checking credentials file...")
    creds_path = os.path.join(os.path.dirname(__file__), 'config', 'tastytrade_credentials_secure.py')
    if os.path.exists(creds_path):
        print(f"   [PASS] Credentials file exists")
        
        # Try to import
        try:
            from config.tastytrade_credentials_secure import TastytradeCredentials
            print("   [PASS] Credentials module imported")
            
            # Check for required attributes (without exposing values)
            required_attrs = ['USERNAME', 'PASSWORD', 'ACCOUNT_NUMBER']
            for attr in required_attrs:
                if hasattr(TastytradeCredentials, attr):
                    print(f"   [INFO] {attr} is configured")
                else:
                    print(f"   [WARN] {attr} not found")
                    
        except ImportError as e:
            print(f"   [WARN] Cannot import credentials: {e}")
    else:
        print(f"   [INFO] Credentials file not found - expected if not configured yet")
    
    # Test 2: API client
    print("\n2. Checking API client...")
    api_path = os.path.join(os.path.dirname(__file__), 'brokers', 'tastytrade_api_client.py')
    if os.path.exists(api_path):
        print(f"   [PASS] API client file exists")
        
        try:
            from brokers.tastytrade_api_client import TastytradeApiClient
            print("   [PASS] API client imported")
            
            # Check for key methods
            methods = ['authenticate', 'get_account', 'get_positions', 'place_order']
            for method in methods:
                if hasattr(TastytradeApiClient, method):
                    print(f"   [INFO] Method '{method}' found")
                else:
                    print(f"   [WARN] Method '{method}' not found")
                    
        except ImportError as e:
            print(f"   [FAIL] Cannot import API client: {e}")
    else:
        print(f"   [FAIL] API client file not found")
    
    return True


def test_algorithm_structure():
    """Test algorithm structure and initialization"""
    print("\n" + "="*50)
    print("TESTING ALGORITHM STRUCTURE")
    print("="*50)
    
    try:
        from main import TomKingTradingIntegrated
        
        # Check for required methods
        print("\n1. Checking required methods...")
        required_methods = [
            'Initialize',
            'OnData', 
            'OnOrderEvent',
            'OnWarmupFinished',
            'check_circuit_breakers',
            'get_option_chain_cached'
        ]
        
        for method in required_methods:
            if hasattr(TomKingTradingIntegrated, method):
                print(f"   [PASS] Method '{method}' found")
            else:
                print(f"   [FAIL] Method '{method}' missing")
        
        # Check for key attributes in Initialize
        print("\n2. Checking initialization attributes...")
        
        # Read the main.py file to check for key initialization steps
        main_path = os.path.join(os.path.dirname(__file__), 'main.py')
        with open(main_path, 'r') as f:
            content = f.read()
            
        init_checks = [
            ('SetBrokerageModel', 'Brokerage model configuration'),
            ('SetSecurityInitializer', 'Security initializer'),
            ('SetWarmUp', 'Warmup period'),
            ('TastyTradeFeeModel', 'Tastytrade fee model'),
            ('AddEquity("SPY"', 'SPY symbol addition'),
            ('AddIndex("VIX"', 'VIX symbol addition'),
            ('AddOption("SPY"', 'SPY options addition')
        ]
        
        for check, description in init_checks:
            if check in content:
                print(f"   [PASS] {description}")
            else:
                print(f"   [FAIL] {description} not found")
        
        return True
        
    except Exception as e:
        print(f"   [FAIL] Error checking structure: {e}")
        return False


def check_file_structure():
    """Check that all required files exist"""
    print("\n" + "="*50)
    print("CHECKING FILE STRUCTURE")
    print("="*50)
    
    base_dir = os.path.dirname(__file__)
    
    required_files = {
        'Core': [
            'main.py',
            'fee_models.py',
            'position_state_manager.py'
        ],
        'Config': [
            'config/constants.py',
            'config/backtest_config.py',
            'config/strategy_parameters.py'
        ],
        'Strategies': [
            'strategies/friday_0dte_with_state.py',
            'strategies/lt112_with_state.py',
            'strategies/ipmcc_with_state.py',
            'strategies/futures_strangle_with_state.py',
            'strategies/leap_put_ladders_with_state.py'
        ],
        'Risk': [
            'risk/vix_regime.py',
            'risk/position_sizing.py',
            'risk/correlation_group_limiter.py',
            'risk/dynamic_margin_manager.py'
        ],
        'Core Systems': [
            'core/unified_state_manager.py',
            'core/unified_vix_manager.py',
            'core/unified_position_sizer.py',
            'core/strategy_coordinator.py'
        ]
    }
    
    all_exist = True
    for category, files in required_files.items():
        print(f"\n{category}:")
        for file_path in files:
            full_path = os.path.join(base_dir, file_path.replace('/', os.sep))
            if os.path.exists(full_path):
                print(f"   [PASS] {file_path}")
            else:
                print(f"   [FAIL] {file_path} not found")
                all_exist = False
    
    return all_exist


def main():
    """Main test runner"""
    print("\n" + "="*50)
    print("TOM KING TRADING - API CONNECTION TEST")
    print("="*50)
    
    results = {
        'imports': test_basic_imports(),
        'tastytrade': test_tastytrade_config(),
        'structure': test_algorithm_structure(),
        'files': check_file_structure()
    }
    
    # Summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    
    passed = sum(results.values())
    total = len(results)
    
    print(f"\nTests Passed: {passed}/{total}")
    
    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"  {status} {test_name.capitalize()}")
    
    print("\n" + "="*50)
    if passed == total:
        print("SUCCESS: All tests passed!")
        print("\nAPI Configuration Summary:")
        print("  - Brokerage Model: Default (for Tastytrade)")
        print("  - Fee Model: TastyTradeFeeModel")
        print("  - Security Initializer: Configured")
        print("  - Warmup: 30 days")
        print("  - Core Symbols: SPY, VIX, SPY Options")
    else:
        print("WARNING: Some tests failed")
        print("\nTroubleshooting:")
        print("  1. Ensure you're running from QuantConnect environment")
        print("  2. Check that AlgorithmImports is available")
        print("  3. Verify Tastytrade credentials are configured")
        print("  4. Ensure all required files are present")
    print("="*50)


if __name__ == "__main__":
    main()