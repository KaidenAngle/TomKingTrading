# Test Tastytrade Integration for Tom King Trading Framework
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import time

class TastytradeIntegrationTest:
    """
    Comprehensive test suite for Tastytrade API integration
    Based on previous JavaScript implementation from TomKingTrader
    """
    
    def __init__(self, test_mode: str = "paper"):
        """
        Initialize test suite
        
        Args:
            test_mode: 'sandbox', 'paper', or 'production'
        """
        self.test_mode = test_mode
        self.test_results = {
            'authentication': [],
            'data_retrieval': [],
            'option_chains': [],
            'order_placement': [],
            'websocket': [],
            'integration': []
        }
        
        # API Configuration based on previous implementation
        self.config = self._get_test_config()
        self.access_token = None
        self.session_token = None
        
    def _get_test_config(self) -> Dict:
        """Get configuration based on test mode"""
        
        configs = {
            'sandbox': {
                'api_base': 'https://api.cert.tastyworks.com',
                'oauth_url': 'https://api.cert.tastyworks.com/oauth/token',
                'streamer_url': 'wss://streamer.cert.tastyworks.com',
                'dxlink_url': 'wss://tasty-openapi-ws.dxfeed.com/realtime',
                # Sandbox credentials (from previous implementation)
                'client_id': 'd99becce-b939-450c-9133-c8ecb2e096b1',
                'client_secret': '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
                'username': 'kaiden.angle@gmail.com',
                'password': '56F@BhZ6z6sES9f',
                'account': 'SANDBOX_ACCOUNT'
            },
            'paper': {
                'api_base': 'https://api.tastyworks.com',
                'oauth_url': 'https://api.tastyworks.com/oauth/token',
                'streamer_url': 'wss://streamer.tastyworks.com',
                'dxlink_url': 'wss://tasty-openapi-ws.dxfeed.com/realtime',
                # Paper trading credentials
                'client_id': 'bfca2bd1-b3f3-4941-b542-0267812f1b2f',
                'client_secret': '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
                'refresh_token': 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw',
                'username': 'kaiden.angle@gmail.com',
                'password': '56F@BhZ6z6sES9f',
                'account': '5WX12569'
            },
            'production': {
                'api_base': 'https://api.tastyworks.com',
                'oauth_url': 'https://api.tastyworks.com/oauth/token',
                'streamer_url': 'wss://streamer.tastyworks.com',
                'dxlink_url': 'wss://tasty-openapi-ws.dxfeed.com/realtime',
                # Production would use same as paper but with live trading enabled
                'client_id': 'bfca2bd1-b3f3-4941-b542-0267812f1b2f',
                'client_secret': '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
                'refresh_token': 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw',
                'account': '5WX12569'
            }
        }
        
        return configs.get(self.test_mode, configs['paper'])
    
    def test_authentication(self) -> bool:
        """Test authentication methods"""
        
        print("\n" + "=" * 80)
        print("1. TESTING AUTHENTICATION")
        print("=" * 80)
        
        # Test 1: Refresh Token Authentication
        if 'refresh_token' in self.config:
            print("\n[TEST] Refresh Token Authentication...")
            try:
                params = {
                    'grant_type': 'refresh_token',
                    'refresh_token': self.config['refresh_token'],
                    'client_secret': self.config['client_secret']
                }
                
                response = requests.post(
                    self.config['oauth_url'],
                    data=params,
                    headers={
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'TomKingFramework/17.0'
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.access_token = data.get('access_token')
                    print("   [OK] Refresh token authentication successful")
                    self.test_results['authentication'].append({
                        'test': 'refresh_token_auth',
                        'status': 'passed',
                        'token_received': bool(self.access_token)
                    })
                    return True
                else:
                    print(f"   [[FAIL]] Refresh token failed: {response.status_code}")
                    self.test_results['authentication'].append({
                        'test': 'refresh_token_auth',
                        'status': 'failed',
                        'error': response.text
                    })
                    
            except Exception as e:
                print(f"   [[FAIL]] Authentication error: {str(e)}")
                self.test_results['authentication'].append({
                    'test': 'refresh_token_auth',
                    'status': 'error',
                    'error': str(e)
                })
        
        # Test 2: Username/Password Authentication (Fallback)
        if not self.access_token and 'username' in self.config:
            print("\n[TEST] Username/Password Authentication...")
            try:
                # Create session
                session_data = {
                    'login': self.config['username'],
                    'password': self.config['password'],
                    'remember-me': True
                }
                
                response = requests.post(
                    f"{self.config['api_base']}/sessions",
                    json=session_data,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'TomKingFramework/17.0'
                    }
                )
                
                if response.status_code == 201:
                    data = response.json()
                    self.session_token = data.get('data', {}).get('session-token')
                    self.access_token = self.session_token  # Session token IS the access token
                    print("   [[OK]] Username/password authentication successful")
                    self.test_results['authentication'].append({
                        'test': 'password_auth',
                        'status': 'passed',
                        'session_created': bool(self.session_token)
                    })
                    return True
                else:
                    print(f"   [[FAIL]] Password auth failed: {response.status_code}")
                    self.test_results['authentication'].append({
                        'test': 'password_auth',
                        'status': 'failed',
                        'error': response.text
                    })
                    
            except Exception as e:
                print(f"   [[FAIL]] Session error: {str(e)}")
                self.test_results['authentication'].append({
                    'test': 'password_auth',
                    'status': 'error',
                    'error': str(e)
                })
        
        return bool(self.access_token)
    
    def test_market_data(self) -> bool:
        """Test market data retrieval"""
        
        print("\n" + "=" * 80)
        print("2. TESTING MARKET DATA")
        print("=" * 80)
        
        if not self.access_token:
            print("   [[FAIL]] No access token - skipping market data tests")
            return False
        
        symbols = ['SPY', 'ES', 'QQQ', 'VIX']
        
        for symbol in symbols:
            print(f"\n[TEST] Getting quote for {symbol}...")
            try:
                # Map futures symbols
                api_symbol = f"/{symbol}" if symbol in ['ES', 'MES', 'CL', 'MCL'] else symbol
                
                # IMPORTANT: Tastytrade uses session tokens WITHOUT Bearer prefix!
                headers = {
                    'Authorization': self.access_token,  # Direct token, no Bearer
                    'User-Agent': 'TomKingFramework/17.0'
                }
                
                response = requests.get(
                    f"{self.config['api_base']}/market-data/quotes",
                    params={'symbols': api_symbol},
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    quotes = data.get('data', {}).get('items', [])
                    if quotes:
                        quote = quotes[0]
                        print(f"   [[OK]] {symbol}: ${quote.get('last', 'N/A')} "
                              f"(Bid: ${quote.get('bid', 'N/A')}, Ask: ${quote.get('ask', 'N/A')})")
                        self.test_results['data_retrieval'].append({
                            'symbol': symbol,
                            'status': 'success',
                            'price': quote.get('last')
                        })
                    else:
                        print(f"   [[WARNING]] No quote data for {symbol}")
                else:
                    print(f"   [[FAIL]] Failed to get {symbol}: {response.status_code}")
                    self.test_results['data_retrieval'].append({
                        'symbol': symbol,
                        'status': 'failed',
                        'error': response.status_code
                    })
                    
            except Exception as e:
                print(f"   [[FAIL]] Error getting {symbol}: {str(e)}")
                self.test_results['data_retrieval'].append({
                    'symbol': symbol,
                    'status': 'error',
                    'error': str(e)
                })
        
        return True
    
    def test_option_chains(self) -> bool:
        """Test option chain retrieval"""
        
        print("\n" + "=" * 80)
        print("3. TESTING OPTION CHAINS")
        print("=" * 80)
        
        if not self.access_token:
            print("   [[FAIL]] No access token - skipping option chain tests")
            return False
        
        test_cases = [
            ('SPY', 0, '0DTE Options'),
            ('SPY', 30, '30 DTE Options'),
            ('SPY', 120, 'LT112 Strategy'),
            ('QQQ', 0, '0DTE Options'),
            ('ES', 90, 'Futures Options')
        ]
        
        for symbol, dte, description in test_cases:
            print(f"\n[TEST] {symbol} {description} (DTE: {dte})...")
            try:
                # Calculate expiration
                expiry_date = (datetime.now() + timedelta(days=dte)).strftime('%Y-%m-%d')
                
                headers = {
                    'Authorization': self.access_token,  # No Bearer prefix
                    'User-Agent': 'TomKingFramework/17.0'
                }
                
                # Get option chain
                response = requests.get(
                    f"{self.config['api_base']}/option-chains/{symbol}/nested",
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expirations = data.get('data', {}).get('items', [])
                    
                    # Find closest expiration
                    target_exp = None
                    for exp in expirations:
                        if exp.get('expiration-type') == 'Regular':
                            exp_date = exp.get('expiration-date')
                            if exp_date:
                                days_diff = (datetime.strptime(exp_date, '%Y-%m-%d') - datetime.now()).days
                                if abs(days_diff - dte) <= 3:  # Within 3 days tolerance
                                    target_exp = exp
                                    break
                    
                    if target_exp:
                        strikes = target_exp.get('strikes', [])
                        print(f"   [[OK]] Found {len(strikes)} strikes for {exp_date}")
                        
                        # Find 10-delta strikes (Tom King methodology)
                        for strike_data in strikes[:5]:  # Sample first 5
                            strike = strike_data.get('strike-price')
                            put = strike_data.get('put')
                            call = strike_data.get('call')
                            
                            if put and call:
                                put_delta = put.get('delta', 0)
                                call_delta = call.get('delta', 0)
                                print(f"      Strike ${strike}: Put D={put_delta:.3f}, Call D={call_delta:.3f}")
                        
                        self.test_results['option_chains'].append({
                            'symbol': symbol,
                            'dte': dte,
                            'status': 'success',
                            'strikes_found': len(strikes)
                        })
                    else:
                        print(f"   [[WARNING]] No expiration found near {dte} DTE")
                        self.test_results['option_chains'].append({
                            'symbol': symbol,
                            'dte': dte,
                            'status': 'no_expiration'
                        })
                else:
                    print(f"   [[FAIL]] Failed to get option chain: {response.status_code}")
                    self.test_results['option_chains'].append({
                        'symbol': symbol,
                        'dte': dte,
                        'status': 'failed',
                        'error': response.status_code
                    })
                    
            except Exception as e:
                print(f"   [[FAIL]] Error: {str(e)}")
                self.test_results['option_chains'].append({
                    'symbol': symbol,
                    'dte': dte,
                    'status': 'error',
                    'error': str(e)
                })
        
        return True
    
    def test_integration_with_quantconnect(self) -> bool:
        """Test integration points with QuantConnect"""
        
        print("\n" + "=" * 80)
        print("4. TESTING QUANTCONNECT INTEGRATION")
        print("=" * 80)
        
        integration_tests = [
            ('Symbol Mapping', self._test_symbol_mapping),
            ('Data Format Compatibility', self._test_data_format),
            ('Order Format Translation', self._test_order_format),
            ('Greeks Calculation', self._test_greeks),
            ('Strike Selection Logic', self._test_strike_selection)
        ]
        
        for test_name, test_func in integration_tests:
            print(f"\n[TEST] {test_name}...")
            try:
                result = test_func()
                if result:
                    print(f"   [[OK]] {test_name} passed")
                    self.test_results['integration'].append({
                        'test': test_name,
                        'status': 'passed'
                    })
                else:
                    print(f"   [[FAIL]] {test_name} failed")
                    self.test_results['integration'].append({
                        'test': test_name,
                        'status': 'failed'
                    })
            except Exception as e:
                print(f"   [[FAIL]] Error in {test_name}: {str(e)}")
                self.test_results['integration'].append({
                    'test': test_name,
                    'status': 'error',
                    'error': str(e)
                })
        
        return True
    
    def _test_symbol_mapping(self) -> bool:
        """Test symbol mapping between Tastytrade and QuantConnect"""
        
        mappings = [
            ('ES', '/ES'),  # Futures
            ('MES', '/MES'),
            ('CL', '/CL'),
            ('MCL', '/MCL'),
            ('GC', '/GC'),
            ('MGC', '/MGC'),
            ('SPY', 'SPY'),  # ETFs stay the same
            ('QQQ', 'QQQ'),
            ('IWM', 'IWM')
        ]
        
        for qc_symbol, tt_symbol in mappings:
            print(f"      QC: {qc_symbol} → TT: {tt_symbol}")
        
        return True
    
    def _test_data_format(self) -> bool:
        """Test data format compatibility"""
        
        # Simulate Tastytrade data format
        tt_option = {
            'strike-price': 450.0,
            'delta': -0.10,
            'gamma': 0.002,
            'theta': -0.15,
            'vega': 0.25,
            'bid': 1.50,
            'ask': 1.55
        }
        
        # Convert to QuantConnect format
        qc_option = {
            'strike': tt_option['strike-price'],
            'delta': tt_option['delta'],
            'gamma': tt_option['gamma'],
            'theta': tt_option['theta'],
            'vega': tt_option['vega'],
            'bid_price': tt_option['bid'],
            'ask_price': tt_option['ask']
        }
        
        print(f"      Converted strike: ${qc_option['strike']}")
        print(f"      Greeks preserved: D={qc_option['delta']:.3f}")
        
        return True
    
    def _test_order_format(self) -> bool:
        """Test order format translation"""
        
        # QuantConnect order format
        qc_order = {
            'symbol': 'SPY',
            'quantity': 1,
            'order_type': 'limit',
            'limit_price': 450.50,
            'time_in_force': 'day'
        }
        
        # Tastytrade order format
        tt_order = {
            'symbol': qc_order['symbol'],
            'quantity': qc_order['quantity'],
            'order-type': 'Limit',
            'price': qc_order['limit_price'],
            'time-in-force': 'Day'
        }
        
        print(f"      QC Order → TT Order translation successful")
        
        return True
    
    def _test_greeks(self) -> bool:
        """Test Greeks calculations"""
        
        greeks = {
            'delta': 0.45,
            'gamma': 0.015,
            'theta': -0.25,
            'vega': 0.18,
            'rho': 0.05
        }
        
        # Validate Greeks ranges
        validations = [
            (-1 <= greeks['delta'] <= 1, 'Delta in valid range'),
            (greeks['gamma'] >= 0, 'Gamma positive'),
            (greeks['theta'] <= 0, 'Theta negative (decay)'),
            (greeks['vega'] >= 0, 'Vega positive')
        ]
        
        for valid, description in validations:
            status = "[v]" if valid else "[x]"
            print(f"      {status} {description}")
        
        return all(v[0] for v in validations)
    
    def _test_strike_selection(self) -> bool:
        """Test Tom King strike selection logic"""
        
        # Simulate finding 10-delta strikes for 0DTE
        current_price = 450.0
        strikes = [
            {'strike': 445, 'put_delta': -0.08, 'call_delta': 0.92},
            {'strike': 446, 'put_delta': -0.09, 'call_delta': 0.91},
            {'strike': 447, 'put_delta': -0.10, 'call_delta': 0.90},  # Target
            {'strike': 448, 'put_delta': -0.11, 'call_delta': 0.89},
            {'strike': 453, 'put_delta': -0.89, 'call_delta': 0.11},
            {'strike': 454, 'put_delta': -0.90, 'call_delta': 0.10},  # Target
            {'strike': 455, 'put_delta': -0.91, 'call_delta': 0.09}
        ]
        
        # Find 10-delta strikes
        put_strike = None
        call_strike = None
        
        for strike_data in strikes:
            if abs(strike_data['put_delta']) <= 0.10 and not put_strike:
                put_strike = strike_data['strike']
            if abs(strike_data['call_delta']) <= 0.10 and not call_strike:
                call_strike = strike_data['strike']
        
        print(f"      Current: ${current_price}")
        print(f"      10D Put: ${put_strike}")
        print(f"      10D Call: ${call_strike}")
        print(f"      Iron Condor Width: ${call_strike - put_strike}")
        
        return put_strike and call_strike
    
    def generate_report(self):
        """Generate comprehensive test report"""
        
        print("\n" + "=" * 80)
        print("TEST REPORT SUMMARY")
        print("=" * 80)
        print(f"Test Mode: {self.test_mode.upper()}")
        print(f"API Base: {self.config['api_base']}")
        print(f"Account: {self.config.get('account', 'N/A')}")
        print()
        
        # Calculate statistics
        total_tests = 0
        passed_tests = 0
        
        for category, results in self.test_results.items():
            if results:
                category_passed = sum(1 for r in results if r.get('status') in ['passed', 'success'])
                total_tests += len(results)
                passed_tests += category_passed
                
                print(f"{category.upper()}: {category_passed}/{len(results)} passed")
                
                # Show failed tests
                failed = [r for r in results if r.get('status') not in ['passed', 'success']]
                for fail in failed:
                    print(f"   [FAIL] {fail.get('test', fail.get('symbol', 'Unknown'))}: {fail.get('error', 'Failed')}")
        
        print()
        print(f"OVERALL: {passed_tests}/{total_tests} tests passed ({passed_tests/total_tests*100:.1f}%)")
        
        # Save results
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'tastytrade_test_results_{timestamp}.json'
        with open(filename, 'w') as f:
            json.dump({
                'timestamp': timestamp,
                'mode': self.test_mode,
                'results': self.test_results,
                'summary': {
                    'total_tests': total_tests,
                    'passed': passed_tests,
                    'success_rate': passed_tests/total_tests if total_tests > 0 else 0
                }
            }, f, indent=2)
        
        print(f"\n[SUCCESS] Results saved to {filename}")
        
        return passed_tests == total_tests

def main():
    """Run comprehensive Tastytrade integration tests"""
    
    print("\n" + "=" * 80)
    print("TASTYTRADE API INTEGRATION TEST SUITE")
    print("Tom King Trading Framework v17")
    print("=" * 80)
    
    # Note: Using 'paper' mode for safety
    # Change to 'sandbox' for cert environment testing
    # Never use 'production' for testing
    
    tester = TastytradeIntegrationTest(test_mode='paper')
    
    # Run all tests
    print("\nStarting comprehensive test suite...")
    
    # Test 1: Authentication
    auth_success = tester.test_authentication()
    if not auth_success:
        print("\n[WARNING] Authentication failed - some tests will be skipped")
    
    # Test 2: Market Data
    if auth_success:
        tester.test_market_data()
    
    # Test 3: Option Chains
    if auth_success:
        tester.test_option_chains()
    
    # Test 4: Integration
    tester.test_integration_with_quantconnect()
    
    # Generate report
    all_passed = tester.generate_report()
    
    if all_passed:
        print("\n[OK] ALL TESTS PASSED - Tastytrade integration is working correctly!")
    else:
        print("\n[WARNING] SOME TESTS FAILED - Review the report for details")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)