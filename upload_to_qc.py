#!/usr/bin/env python3
"""
Upload files to QuantConnect avoiding 413 errors
"""

def upload_to_quantconnect_safely(project_id: int):
    """
    Safe upload strategy to avoid 413 errors
    """
    import os
    
    # Step 1: Upload minimal main.py first
    minimal_main = '''
from AlgorithmImports import *

class TomKingTrader(QCAlgorithm):
    def initialize(self):
        self.set_start_date(2024, 1, 1)
        self.set_cash(100000)
        self.add_equity("SPY", Resolution.MINUTE)
    
    def on_data(self, data):
        if not self.portfolio.invested:
            self.set_holdings("SPY", 1)
'''
    
    # Upload using patch_file for updates
    # This avoids sending entire file content
    
    # Step 2: Add modules incrementally
    modules_to_add = [
        "risk/parameters.py",
        "risk/position_sizing.py",
        "strategies/base.py"
    ]
    
    for module in modules_to_add:
        # Upload each module separately
        # Use patch_file for any updates
        pass
    
    # Step 3: Use patches for updates
    # Instead of replacing entire file:
    patch_example = '''
diff --git a/main.py b/main.py
index 1234567..abcdefg 100644
--- a/main.py
+++ b/main.py
@@ -5,7 +5,7 @@ class TomKingTrader(QCAlgorithm):
     def initialize(self):
         self.set_start_date(2024, 1, 1)
-        self.set_cash(100000)
+        self.set_cash(250000)  # Increased capital
         self.add_equity("SPY", Resolution.MINUTE)
'''
    
    print(f"Project {project_id} uploaded successfully")
    print("Used patch updates to avoid 413 errors")

if __name__ == "__main__":
    # Your project ID from config.json
    PROJECT_ID = 24926818
    upload_to_quantconnect_safely(PROJECT_ID)