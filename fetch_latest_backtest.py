"""
Fetch latest QuantConnect backtest results - Manual approach
Since the CLI is not working properly, this script opens the browser
to manually check the latest backtest results.
"""

import webbrowser
import time

# Open QuantConnect terminal to check backtests
print("Opening QuantConnect terminal to check latest backtest results...")
print("Please check the latest backtest and note any runtime errors.")
print("\nPrevious errors we fixed:")
print("1. datetime.date() issue in dynamic_margin_manager.py - FIXED")
print("2. SafePerformanceTracker missing methods - FIXED")
print("\nPlease check if there are new errors preventing trades from executing.")

# Open the QuantConnect backtests page
url = "https://www.quantconnect.com/terminal/index.php#open/projects"
webbrowser.open(url)

print("\n" + "="*60)
print("MANUAL CHECK REQUIRED:")
print("1. Go to TomKingTrading project")
print("2. Check the latest backtest")
print("3. Look for any runtime errors in the logs")
print("4. Note if any trades were executed")
print("="*60)

# Reminder of what to look for
print("\nWhat to look for:")
print("- Runtime errors (AttributeError, NameError, etc.)")
print("- No trades executed messages")
print("- Strategy state transitions")
print("- Any error in Initialize() or OnData()")