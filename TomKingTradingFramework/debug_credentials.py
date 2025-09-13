# Debug TastyTrade Credentials
# Check what credentials are available

import os
from config.tastytrade_credentials_secure import TastytradeCredentials

print("=== TastyTrade Credentials Debug ===")
print("")

# Check environment variables
env_vars = [
    'TASTYTRADE_USERNAME',
    'TASTYTRADE_PASSWORD', 
    'TASTYTRADE_CLIENT_ID',
    'TASTYTRADE_CLIENT_SECRET',
    'TASTYTRADE_ACCOUNT_CASH',
    'TASTYTRADE_ACCOUNT_MARGIN',
    'TASTYTRADE_REMEMBER_TOKEN'
]

print("Environment Variables Status:")
for var in env_vars:
    value = os.getenv(var, '')
    if value:
        if 'PASSWORD' in var or 'SECRET' in var or 'TOKEN' in var:
            print(f"  {var}: [SET] ****...{value[-4:] if len(value) >= 4 else '****'}")
        else:
            print(f"  {var}: [SET] {value}")
    else:
        print(f"  {var}: [NOT SET]")

print("")

# Test credentials validation
try:
    TastytradeCredentials.validate_credentials()
    print("[OK] All required credentials are set")
except ValueError as e:
    print(f"[FAIL] Credential validation failed: {e}")

print("")

# Show API endpoints
endpoints = TastytradeCredentials.get_api_endpoints()
print("API Endpoints:")
print(f"  Base URL: {endpoints['base_url']}")
print(f"  Sessions: {endpoints['sessions']}")
print(f"  Accounts: {endpoints['accounts']}")