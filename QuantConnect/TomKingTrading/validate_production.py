#!/usr/bin/env python3
"""
Production Deployment Validation Script
Ensures the Tom King Trading System is ready for production deployment
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# Load environment variables from .env file
def load_dotenv_manually():
    """Manually load .env file without python-dotenv dependency"""
    env_path = Path(__file__).parent / '.env'
    
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    os.environ[key] = value

# Load env vars before running checks
load_dotenv_manually()

def check_environment_variables():
    """Validate all required environment variables are set"""
    required_vars = [
        'TASTYTRADE_USERNAME',
        'TASTYTRADE_PASSWORD', 
        'TASTYTRADE_CLIENT_ID',
        'TASTYTRADE_CLIENT_SECRET'
    ]
    
    missing = []
    for var in required_vars:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print("[FAIL] Missing required environment variables:")
        for var in missing:
            print(f"   - {var}")
        return False
    
    print("[PASS] All required environment variables are set")
    return True

def check_secure_credentials():
    """Ensure we're using the secure credentials file"""
    try:
        # Check that secure version exists
        secure_path = 'config/tastytrade_credentials_secure.py'
        if not os.path.exists(secure_path):
            print("[FAIL] Secure credentials file not found")
            return False
        
        # Check that insecure version is not imported anywhere
        import subprocess
        result = subprocess.run(
            ['grep', '-r', 'from config.tastytrade_credentials import', '.', 
             '--exclude-dir=.git', '--exclude=validate_production.py'],
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            print("[FAIL] Found imports of insecure credentials file:")
            print(result.stdout)
            return False
        
        print("[PASS] Using secure credentials implementation")
        return True
    except Exception as e:
        print(f"[WARN] Could not verify credentials security: {e}")
        return False

def check_gitignore():
    """Ensure sensitive files are in .gitignore"""
    gitignore_path = '.gitignore'
    required_entries = ['.env', 'config/tastytrade_credentials.py']
    
    if not os.path.exists(gitignore_path):
        print("[FAIL] .gitignore file not found")
        return False
    
    with open(gitignore_path, 'r') as f:
        content = f.read()
    
    missing = []
    for entry in required_entries:
        if entry not in content:
            missing.append(entry)
    
    if missing:
        print("[FAIL] Missing entries in .gitignore:")
        for entry in missing:
            print(f"   - {entry}")
        return False
    
    print("[PASS] .gitignore properly configured")
    return True

def check_core_strategies():
    """Verify all 5 core strategies are present"""
    strategies = {
        'strategies/friday_zero_day_options.py': 'Friday 0DTE',
        'strategies/long_term_112_put_selling.py': 'LT112 Put Selling',
        'strategies/futures_strangle.py': 'Futures Strangle',
        'strategies/in_perpetuity_covered_calls.py': 'IPMCC',
        'strategies/leap_put_ladders.py': 'LEAP Put Ladders'
    }
    
    missing = []
    for file, name in strategies.items():
        if not os.path.exists(file):
            missing.append(f"{name} ({file})")
    
    if missing:
        print("[FAIL] Missing core strategy files:")
        for strategy in missing:
            print(f"   - {strategy}")
        return False
    
    print("[PASS] All 5 core strategies present")
    return True

def check_risk_management():
    """Verify critical risk management components"""
    risk_files = {
        'risk/august_2024_correlation_limiter.py': 'Correlation Limiter (Max 3 positions)',
        'risk/vix_regime.py': 'VIX Regime Management',
        'strategies/tom_king_exit_rules.py': 'Exit Rules Manager'
    }
    
    missing = []
    for file, name in risk_files.items():
        if not os.path.exists(file):
            missing.append(f"{name} ({file})")
    
    if missing:
        print("[FAIL] Missing risk management files:")
        for component in missing:
            print(f"   - {component}")
        return False
    
    print("[PASS] Risk management components present")
    return True

def check_profit_targets():
    """Verify profit targets are set to 50%"""
    try:
        with open('config/constants.py', 'r') as f:
            content = f.read()
            if 'FRIDAY_0DTE_PROFIT_TARGET = 0.50' in content:
                print("[PASS] Profit targets correctly set to 50%")
                return True
            else:
                print("[FAIL] Profit target may not be set to 50%")
                return False
    except FileNotFoundError:
        print("[WARN] Could not verify profit targets - constants.py not found")
        return False

def main():
    """Run all production validation checks"""
    print("=" * 60)
    print("Tom King Trading System - Production Validation")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    print()
    
    checks = [
        ("Environment Variables", check_environment_variables),
        ("Secure Credentials", check_secure_credentials),
        ("Git Ignore Configuration", check_gitignore),
        ("Core Strategies", check_core_strategies),
        ("Risk Management", check_risk_management),
        ("Profit Targets", check_profit_targets)
    ]
    
    results = []
    for name, check_func in checks:
        print(f"\n{name}:")
        result = check_func()
        results.append(result)
    
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    percentage = (passed / total) * 100
    
    if percentage == 100:
        print(f"[SUCCESS] ALL CHECKS PASSED ({passed}/{total})")
        print("\n>>> SYSTEM IS READY FOR PRODUCTION DEPLOYMENT <<<")
    elif percentage >= 80:
        print(f"[WARNING] MOSTLY READY ({passed}/{total} passed - {percentage:.0f}%)")
        print("\nFix remaining issues before production deployment")
    else:
        print(f"[ERROR] NOT READY ({passed}/{total} passed - {percentage:.0f}%)")
        print("\nCritical issues must be resolved before deployment")
    
    print("\n" + "=" * 60)
    
    return 0 if percentage == 100 else 1

if __name__ == "__main__":
    sys.exit(main())