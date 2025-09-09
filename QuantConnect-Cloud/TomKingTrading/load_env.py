#!/usr/bin/env python3
"""
Load environment variables from .env file
"""

import os
from pathlib import Path

def load_dotenv_manually():
    """Manually load .env file without python-dotenv dependency"""
    env_path = Path(__file__).parent / '.env'
    
    if not env_path.exists():
        print(f"[WARN] .env file not found at {env_path}")
        return False
    
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Set environment variable
                os.environ[key] = value
    
    print("[INFO] Environment variables loaded from .env")
    return True

if __name__ == "__main__":
    load_dotenv_manually()
    
    # Test that variables are loaded
    required = [
        'TASTYTRADE_USERNAME',
        'TASTYTRADE_PASSWORD',
        'TASTYTRADE_CLIENT_ID',
        'TASTYTRADE_CLIENT_SECRET'
    ]
    
    for var in required:
        value = os.getenv(var)
        if value:
            # Show first 3 chars only for security
            masked = value[:3] + '*' * (len(value) - 3)
            print(f"  {var}: {masked}")
        else:
            print(f"  {var}: NOT SET")