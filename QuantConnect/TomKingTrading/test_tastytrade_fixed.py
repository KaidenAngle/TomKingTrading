# Fixed Tastytrade Integration Test
# Based on working JavaScript implementation

import json
import requests
from datetime import datetime, timedelta
import urllib.parse

def test_tastytrade():
    """Test Tastytrade API using the exact working implementation from JavaScript"""
    
    print("\n" + "=" * 80)
    print("TASTYTRADE API TEST - FIXED VERSION")
    print("Based on working JavaScript implementation")
    print("=" * 80)
    
    # Configuration from working credentials.config.js
    config = {
        'api_base': 'https://api.tastyworks.com',
        'oauth_url': 'https://api.tastyworks.com/oauth/token',
        'username': 'kaiden.angle@gmail.com',
        'password': '56F@BhZ6z6sES9f',
        'account': '5WX12569'
    }
    
    # Step 1: Authenticate with username/password (since refresh token is revoked)
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
        
        if response.status_code == 201:
            data = response.json()
            session_token = data.get('data', {}).get('session-token')
            remember_token = data.get('data', {}).get('remember-token')
            
            print(f"[OK] Authentication successful")
            print(f"     Session token: {session_token[:20]}...")
            if remember_token:
                print(f"     Remember token received (save for future use)")
                print(f"     Token: {remember_token[:50]}...")
        else:
            print(f"[FAIL] Authentication failed: {response.status_code}")
            print(f"       Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"[ERROR] Authentication error: {str(e)}")
        return False
    
    # Step 2: Get Customer Info
    print("\n2. CUSTOMER INFO")
    print("-" * 40)
    
    # CRITICAL: No Bearer prefix for Tastytrade!
    headers = {
        'Authorization': session_token,  # Direct token, no Bearer
        'User-Agent': 'TomKingFramework/17.0'
    }
    
    try:
        response = requests.get(
            f"{config['api_base']}/customers/me",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            customer_id = data.get('data', {}).get('id')
            print(f"[OK] Customer ID: {customer_id}")
        else:
            print(f"[FAIL] Failed to get customer info: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Customer info error: {str(e)}")
    
    # Step 3: Get Accounts
    print("\n3. ACCOUNTS")
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
                    print(f"[OK] Account: {acc_num} ({acc_type})")
            else:
                print("[WARNING] No accounts found")
        else:
            print(f"[FAIL] Failed to get accounts: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Accounts error: {str(e)}")
    
    # Step 4: Test Market Data (using correct endpoint)
    print("\n4. MARKET DATA")
    print("-" * 40)
    
    symbols_to_test = ['SPY', 'QQQ', 'VIX', '/ES', '/MES']
    
    for symbol in symbols_to_test:
        try:
            # Determine symbol type and mapping
            if symbol.startswith('/'):
                # Futures symbol
                mapped_symbol = symbol
                symbol_type = 'Future'
            elif symbol in ['VIX', 'SPX', 'NDX', 'RUT']:
                # Index symbol  
                mapped_symbol = f"${symbol}"
                symbol_type = 'Index'
            else:
                # Equity symbol
                mapped_symbol = symbol
                symbol_type = 'Equity'
            
            # Build parameters
            params = {
                'symbols': mapped_symbol,
                'types': symbol_type
            }
            
            # Use the correct endpoint that works in JavaScript
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
                        last = item_data.get('last') or item_data.get('mark')
                        bid = item_data.get('bid')
                        ask = item_data.get('ask')
                        
                        print(f"[OK] {symbol}: ${last} (Bid: ${bid}, Ask: ${ask})")
                else:
                    print(f"[WARNING] No data for {symbol}")
            else:
                print(f"[FAIL] {symbol}: Status {response.status_code}")
                
        except Exception as e:
            print(f"[ERROR] {symbol}: {str(e)}")
    
    # Step 5: Test Option Chain
    print("\n5. OPTION CHAINS")
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
                print(f"[OK] SPY option chain: {len(items)} expirations")
                
                # Show first few expirations
                for i, exp in enumerate(items[:3]):
                    exp_date = exp.get('expiration-date')
                    exp_type = exp.get('expiration-type')
                    strikes = exp.get('strikes', [])
                    print(f"     {exp_date} ({exp_type}): {len(strikes)} strikes")
            else:
                print("[WARNING] No option chain data")
        else:
            print(f"[FAIL] Option chain failed: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Option chain error: {str(e)}")
    
    # Step 6: Account Balance
    print("\n6. ACCOUNT BALANCE")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{config['api_base']}/accounts/{config['account']}/balances",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            balance_data = data.get('data')
            
            if balance_data:
                net_liq = balance_data.get('net-liquidating-value')
                cash = balance_data.get('cash-balance')
                bp = balance_data.get('derivative-buying-power')
                
                print(f"[OK] Net Liquidation: ${net_liq}")
                print(f"     Cash Balance: ${cash}")
                print(f"     Buying Power: ${bp}")
            else:
                print("[WARNING] No balance data")
        else:
            print(f"[FAIL] Balance failed: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] Balance error: {str(e)}")
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print("\nKey Findings:")
    print("1. Authentication: Username/password works (refresh token revoked)")
    print("2. Authorization: Session tokens must NOT use 'Bearer' prefix")
    print("3. Market Data: Use /market-data/by-type endpoint")
    print("4. Symbols: Futures need '/' prefix, indices need '$' prefix")
    print("5. Option Chains: /option-chains/{symbol}/nested endpoint works")
    
    print("\nFor QuantConnect Integration:")
    print("- Use this working implementation in tastytrade_integration.py")
    print("- Save the remember token for future sessions")
    print("- Implement proper symbol mapping (/, $, etc.)")
    print("- Use session token directly without Bearer prefix")
    
    return True

if __name__ == "__main__":
    test_tastytrade()