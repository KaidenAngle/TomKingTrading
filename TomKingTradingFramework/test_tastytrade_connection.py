# Test TastyTrade API Connection
# Safe test script - NO ORDER PLACEMENT
# Only tests authentication and data retrieval

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from brokers.tastytrade_api_client import TastytradeApiClient
from config.tastytrade_credentials_secure import TastytradeCredentials

class MockAlgorithm:
    """Mock algorithm for testing"""
    
    def __init__(self):
        self.LiveMode = False  # Set to False for safety
        
    def Log(self, message):
        print(f"[LOG] {message}")
        
    def Error(self, message):
        print(f"[ERROR] {message}")
        
    def Debug(self, message):
        print(f"[DEBUG] {message}")

def test_tastytrade_connection():
    """Test TastyTrade API connection safely"""
    
    print("=== TastyTrade API Connection Test ===")
    print("This test will:")
    print("1. Test authentication with TastyTrade API")
    print("2. Retrieve account information")
    print("3. Get SPY quote data")
    print("4. NO ORDER PLACEMENT - SAFE TEST ONLY")
    print("")
    
    # Create mock algorithm
    mock_algo = MockAlgorithm()
    
    # Initialize TastyTrade client
    try:
        client = TastytradeApiClient(mock_algo)
        print("[OK] TastyTrade client initialized")
    except Exception as e:
        print(f"[FAIL] Failed to initialize client: {e}")
        return False
    
    # Test authentication
    print("\n--- Testing Authentication ---")
    try:
        auth_success = client.ensure_authenticated()
        if auth_success:
            print("[OK] Authentication successful")
            print(f"Session token: {client.session_token[:20]}...") 
        else:
            print("[FAIL] Authentication failed")
            return False
    except Exception as e:
        print(f"[FAIL] Authentication error: {e}")
        return False
    
    # Test account information
    print("\n--- Testing Account Access ---")
    try:
        account_info = client.get_account_info()
        if account_info:
            print(f"[OK] Account info retrieved")
            acc_num = account_info.get('account_number', 'Unknown')
            net_liq = account_info.get('net_liquidation', 0)
            print(f"   Account: {acc_num}")
            print(f"   Net Liquidation: ${net_liq:,.2f}")
        else:
            print("[WARN] No account info found")
    except Exception as e:
        print(f"[FAIL] Account access error: {e}")
    
    # Test market data
    print("\n--- Testing Market Data ---")
    try:
        spy_quote = client.get_quote("SPY")
        if spy_quote:
            print("[OK] SPY market data retrieved:")
            print(f"   Last: ${spy_quote.get('last', 'N/A')}")
            print(f"   Bid: ${spy_quote.get('bid', 'N/A')}")
            print(f"   Ask: ${spy_quote.get('ask', 'N/A')}")
            print(f"   Volume: {spy_quote.get('total-volume', 'N/A')}")
        else:
            print("[WARN] No SPY quote data")
    except Exception as e:
        print(f"[FAIL] Market data error: {e}")
    
    # Test option chain data (if available)
    print("\n--- Testing Option Chain Data ---")
    try:
        option_chain = client.get_option_chain("SPY", dte=0)
        if option_chain and option_chain.get('expirations'):
            exp_count = len(option_chain['expirations'])
            print(f"[OK] SPY option chain retrieved: {exp_count} expiration(s)")
            
            # Show first expiration details
            if exp_count > 0:
                first_exp = option_chain['expirations'][0]
                exp_date = first_exp.get('expiration_date', 'Unknown')
                strike_count = len(first_exp.get('strikes', []))
                print(f"   First expiration: {exp_date} ({strike_count} strikes)")
        else:
            print("[WARN] No option chain data")
    except Exception as e:
        print(f"[FAIL] Option chain error: {e}")
    
    # Test session validation
    print("\n--- Testing Session Validation ---")
    try:
        is_valid = client.is_session_valid()
        print(f"[OK] Session valid: {is_valid}")
    except Exception as e:
        print(f"[FAIL] Session validation error: {e}")
    
    print("\n=== Test Complete ===")
    print("[OK] Connection test finished successfully")
    print("[SAFE] NO ORDERS WERE PLACED - ACCOUNT SAFE")
    
    return True

if __name__ == "__main__":
    test_tastytrade_connection()