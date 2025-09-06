# Test Tastytrade Sandbox Environment
# Uses cert.tastyworks.com for testing with simulated data

import json
import requests
from datetime import datetime, timedelta

def test_sandbox():
    """Test Tastytrade Sandbox (cert) environment"""
    
    print("\n" + "=" * 80)
    print("TASTYTRADE SANDBOX ENVIRONMENT TEST")
    print("Using cert.tastyworks.com for testing")
    print("=" * 80)
    
    # Sandbox configuration (from credentials.config.js)
    config = {
        'api_base': 'https://api.cert.tastyworks.com',
        'oauth_url': 'https://api.cert.tastyworks.com/oauth/token',
        'username': 'kaiden.angle@gmail.com',
        'password': '56F@BhZ6z6sES9f',
        'client_id': 'd99becce-b939-450c-9133-c8ecb2e096b1',
        'client_secret': '98911c87a7287ac6665fc96a9a467d54fd02f7ed'
    }
    
    print(f"\nAPI Base: {config['api_base']}")
    print("Note: Sandbox environment uses test data and paper accounts")
    
    # Step 1: Authenticate
    print("\n1. AUTHENTICATION")
    print("-" * 40)
    
    session_data = {
        'login': config['username'],
        'password': config['password'],
        'remember-me': True
    }
    
    try:
        response = requests.post(
            f"{config['api_base']}/sessions",
            json=session_data,
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'TomKingFramework/17.0'
            }
        )
        
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            session_token = data.get('data', {}).get('session-token')
            remember_token = data.get('data', {}).get('remember-token')
            
            print(f"[OK] Sandbox authentication successful")
            print(f"     Session token: {session_token[:20]}...")
            if remember_token:
                print(f"     Remember token: {remember_token[:50]}...")
        else:
            print(f"[FAIL] Sandbox authentication failed: {response.status_code}")
            print(f"       Response: {response.text[:200]}")
            
            # Try OAuth2 flow as alternative
            print("\n[RETRY] Trying OAuth2 authentication...")
            oauth_data = {
                'grant_type': 'password',
                'username': config['username'],
                'password': config['password'],
                'client_id': config['client_id'],
                'client_secret': config['client_secret']
            }
            
            oauth_response = requests.post(
                config['oauth_url'],
                data=oauth_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            if oauth_response.status_code == 200:
                oauth_result = oauth_response.json()
                access_token = oauth_result.get('access_token')
                print(f"[OK] OAuth2 successful")
                print(f"     Access token: {access_token[:20]}...")
                session_token = access_token
            else:
                print(f"[FAIL] OAuth2 failed: {oauth_response.status_code}")
                return False
            
    except Exception as e:
        print(f"[ERROR] Authentication error: {str(e)}")
        return False
    
    # Headers for subsequent requests
    headers = {
        'Authorization': session_token,  # No Bearer prefix
        'User-Agent': 'TomKingFramework/17.0'
    }
    
    # Step 2: Test Customer Endpoint
    print("\n2. SANDBOX CUSTOMER INFO")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{config['api_base']}/customers/me",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            customer_id = data.get('data', {}).get('id')
            print(f"[OK] Sandbox Customer ID: {customer_id}")
        else:
            print(f"[FAIL] Customer info failed: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Customer error: {str(e)}")
    
    # Step 3: Test Sandbox Accounts
    print("\n3. SANDBOX ACCOUNTS")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{config['api_base']}/customers/me/accounts",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            accounts = data.get('data', {}).get('items', [])
            if accounts:
                for account in accounts:
                    acc_num = account.get('account', {}).get('account-number')
                    acc_type = account.get('account', {}).get('margin-or-cash')
                    print(f"[OK] Sandbox Account: {acc_num} ({acc_type})")
            else:
                print("[INFO] No sandbox accounts found (may need to create one)")
        else:
            print(f"[FAIL] Accounts failed: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Accounts error: {str(e)}")
    
    # Step 4: Test Sandbox Market Data
    print("\n4. SANDBOX MARKET DATA")
    print("-" * 40)
    print("Note: Sandbox may have limited or simulated market data")
    
    test_symbols = ['SPY', 'AAPL', 'TSLA']
    
    for symbol in test_symbols:
        try:
            params = {
                'symbols': symbol,
                'types': 'Equity'
            }
            
            response = requests.get(
                f"{config['api_base']}/market-data/by-type",
                params=params,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('data', {}).get('items', [])
                
                if items:
                    for item in items:
                        item_data = items[item] if isinstance(items, dict) else item
                        last = item_data.get('last') or item_data.get('mark') or 'N/A'
                        print(f"[OK] Sandbox {symbol}: ${last}")
                else:
                    print(f"[INFO] No sandbox data for {symbol}")
            else:
                print(f"[FAIL] {symbol}: Status {response.status_code}")
                
        except Exception as e:
            print(f"[ERROR] {symbol}: {str(e)}")
    
    # Step 5: Test Sandbox Option Chains
    print("\n5. SANDBOX OPTION CHAINS")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{config['api_base']}/option-chains/SPY/nested",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('data', {}).get('items', [])
            
            if items:
                print(f"[OK] Sandbox SPY option chain: {len(items)} expirations")
                for i, exp in enumerate(items[:3]):
                    exp_date = exp.get('expiration-date')
                    strikes = exp.get('strikes', [])
                    print(f"     {exp_date}: {len(strikes)} strikes")
            else:
                print("[INFO] No sandbox option chain data")
        else:
            print(f"[FAIL] Option chain failed: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Option chain error: {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print("SANDBOX TEST SUMMARY")
    print("=" * 80)
    
    print("\nSandbox Environment Details:")
    print("- URL: https://api.cert.tastyworks.com")
    print("- Purpose: Testing and development")
    print("- Data: Simulated/test data")
    print("- Trading: Paper trading only")
    print("- Availability: 24/7 (not dependent on market hours)")
    
    print("\nIntegration with QuantConnect:")
    print("1. Use sandbox for development and testing")
    print("2. Test strategies with simulated data")
    print("3. Verify API integration without risk")
    print("4. Switch to production when ready for live trading")
    
    return True

if __name__ == "__main__":
    test_sandbox()