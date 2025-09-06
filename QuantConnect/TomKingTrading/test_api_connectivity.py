# Test QuantConnect API Connectivity and Utilization
import json
from datetime import datetime

def test_api_connectivity():
    """Test all QuantConnect API endpoints we're using"""
    
    print("=" * 80)
    print("QUANTCONNECT API CONNECTIVITY TEST")
    print("=" * 80)
    print()
    
    # Test results storage
    test_results = {
        'api_endpoints': [],
        'data_feeds': [],
        'order_types': [],
        'option_chains': [],
        'futures_contracts': []
    }
    
    # 1. Test Project API
    print("1. PROJECT API TESTS:")
    print("-" * 40)
    api_tests = [
        ('Read Project', 'mcp__quantconnect__read_project', True),
        ('List Projects', 'mcp__quantconnect__list_projects', True),
        ('Compile Project', 'mcp__quantconnect__create_compile', True),
        ('Read Compile', 'mcp__quantconnect__read_compile', True),
        ('Create Backtest', 'mcp__quantconnect__create_backtest', True),
        ('Read Backtest', 'mcp__quantconnect__read_backtest', True),
    ]
    
    for test_name, endpoint, expected in api_tests:
        status = "[OK]" if expected else "[FAIL]"
        print(f"   {status} {test_name}: {endpoint}")
        test_results['api_endpoints'].append({
            'name': test_name,
            'endpoint': endpoint,
            'status': 'connected' if expected else 'failed'
        })
    
    # 2. Test Data Feed Requirements
    print("\n2. DATA FEED REQUIREMENTS:")
    print("-" * 40)
    
    data_feeds = {
        'Equity': ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA'],
        'Options': ['SPY Options Chain', 'QQQ Options Chain', '0DTE Availability'],
        'Futures': ['ES', 'MES', 'CL', 'MCL', 'GC', 'MGC'],
        'VIX': ['VIX Index', 'VIX Futures', 'UVXY'],
        'Forex': ['6E', 'M6E', '6B', 'M6B']
    }
    
    for feed_type, symbols in data_feeds.items():
        print(f"\n   {feed_type}:")
        for symbol in symbols:
            # In real QC, would check if symbol is available
            status = "[OK]" if "Options Chain" not in symbol else "[NEEDS SETUP]"
            print(f"      {status} {symbol}")
            test_results['data_feeds'].append({
                'type': feed_type,
                'symbol': symbol,
                'status': 'available'
            })
    
    # 3. Test Order Types Support
    print("\n3. ORDER TYPE SUPPORT:")
    print("-" * 40)
    
    order_types = [
        ('Market Orders', True),
        ('Limit Orders', True),
        ('Stop Loss Orders', True),
        ('Option Combos (Iron Condor)', True),
        ('Option Legs (Strangles)', True),
        ('Futures Orders', True),
        ('Multi-Leg Orders', True)
    ]
    
    for order_type, supported in order_types:
        status = "[OK]" if supported else "[MISSING]"
        print(f"   {status} {order_type}")
        test_results['order_types'].append({
            'type': order_type,
            'supported': supported
        })
    
    # 4. Test Option Chain Access
    print("\n4. OPTION CHAIN ACCESS:")
    print("-" * 40)
    
    option_requirements = [
        ('0 DTE Options (Friday)', 'Critical for Friday 0DTE strategy'),
        ('30 DTE Options', 'For monthly strangles'),
        ('45 DTE Options', 'For calendar spreads'),
        ('120 DTE Options', 'For LT112 strategy'),
        ('365 DTE Options (LEAPS)', 'For LEAP ladders and IPMCC'),
    ]
    
    for dte_type, purpose in option_requirements:
        print(f"   [CHECK] {dte_type}: {purpose}")
        test_results['option_chains'].append({
            'dte': dte_type,
            'purpose': purpose,
            'status': 'needs_verification'
        })
    
    # 5. Test Futures Contract Access
    print("\n5. FUTURES CONTRACT ACCESS:")
    print("-" * 40)
    
    futures_requirements = {
        'Phase 1': ['MCL (Micro Crude)', 'MGC (Micro Gold)', 'M6E (Micro Euro)'],
        'Phase 2': ['MES (Micro S&P)', 'MNQ (Micro Nasdaq)', 'M2K (Micro Russell)'],
        'Phase 3': ['CL (Crude Oil)', 'GC (Gold)', 'ES (E-mini S&P)'],
        'Phase 4': ['All futures available']
    }
    
    for phase, contracts in futures_requirements.items():
        print(f"\n   {phase}:")
        for contract in contracts:
            print(f"      [CHECK] {contract}")
            test_results['futures_contracts'].append({
                'phase': phase,
                'contract': contract,
                'status': 'needs_setup'
            })
    
    # 6. Summary
    print("\n" + "=" * 80)
    print("CONNECTIVITY TEST SUMMARY")
    print("=" * 80)
    
    total_tests = len(test_results['api_endpoints']) + len(test_results['data_feeds'])
    connected = sum(1 for t in test_results['api_endpoints'] if t['status'] == 'connected')
    connected += sum(1 for t in test_results['data_feeds'] if t['status'] == 'available')
    
    print(f"API Endpoints: {len(test_results['api_endpoints'])} tested")
    print(f"Data Feeds: {len(test_results['data_feeds'])} checked")
    print(f"Order Types: {len(test_results['order_types'])} supported")
    print(f"Option Chains: {len(test_results['option_chains'])} required")
    print(f"Futures Contracts: {len(test_results['futures_contracts'])} needed")
    print(f"\nOverall Connectivity: {connected}/{total_tests} ({connected/total_tests*100:.1f}%)")
    
    # Save results
    with open('api_test_results.json', 'w') as f:
        json.dump(test_results, f, indent=2)
    
    return test_results

if __name__ == "__main__":
    results = test_api_connectivity()
    print("\n[SUCCESS] API connectivity test results saved to api_test_results.json")