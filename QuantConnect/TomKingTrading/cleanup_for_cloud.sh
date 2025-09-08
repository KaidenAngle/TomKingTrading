#!/bin/bash
# Cleanup script to reduce project size for QuantConnect cloud push

echo "=== CLEANUP FOR CLOUD PUSH ==="
echo "This will remove unnecessary files to reduce project size"
echo ""

# 1. Remove backtests folder (7.5MB)
echo "Removing backtests folder..."
rm -rf backtests/

# 2. Remove all __pycache__ folders (1.9MB)
echo "Removing Python cache..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# 3. Remove documentation files (except README.md)
echo "Removing analysis documentation..."
rm -f DEEP_LOGIC_ANALYSIS_FINDINGS.md
rm -f REASSESSED_ANALYSIS_REPORT.md
rm -f LT112_PROFIT_TARGET_ANALYSIS.md
rm -f BACKTEST_READY_CHECKLIST.md
rm -f VIX_STRATEGY_REQUIREMENTS.md
rm -f SYSTEM_DOCUMENTATION.md
rm -f DOCUMENTATION_GUIDE.md

# 4. Remove test/development files
echo "Removing test files..."
rm -f run_backtest.py
rm -f test_initialization.py
rm -f test_api_connections.py
rm -f test_api_simple.py
rm -f main_simple.py
rm -f main_simple_backup.py
rm -f backtest_30k.py
rm -f verify_ready.py
rm -f deploy_backtest.py

# 5. Remove tests folder
echo "Removing tests folder..."
rm -rf tests/

# 6. Remove .pyc files
echo "Removing compiled Python files..."
find . -name "*.pyc" -delete

# Show new size
echo ""
echo "=== CLEANUP COMPLETE ==="
echo "New project size:"
du -sh .