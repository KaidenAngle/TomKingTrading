#!/usr/bin/env python3
"""
QuantConnect API 413 Error Fix Guide
=====================================

The 413 error occurs when request payload exceeds API limits.
QuantConnect has the following limits:
- Single file: ~100KB
- Total request: ~500KB
- Compile request: ~1MB total project size

Solutions:
"""

def fix_large_file_upload():
    """
    Solution 1: Use patch_file instead of update_file_contents
    """
    # Instead of updating entire file:
    # update_file_contents(projectId, fileName, fullContent)
    
    # Use patch updates for specific sections:
    # patch_file(projectId, patch_string)
    pass

def split_large_modules():
    """
    Solution 2: Split large files into smaller modules
    """
    # Break down main.py into:
    # - config/settings.py
    # - strategies/base_strategy.py
    # - risk/manager.py
    # - indicators/custom.py
    pass

def optimize_file_structure():
    """
    Solution 3: Remove unnecessary code and comments
    """
    # Remove:
    # - Debug print statements
    # - Large comment blocks
    # - Unused imports
    # - Development/test code
    pass

def use_incremental_updates():
    """
    Solution 4: Update files incrementally
    """
    # 1. Create project with minimal main.py
    # 2. Add other files one by one
    # 3. Use patch_file for updates
    pass

# Recommended approach for your project:
if __name__ == "__main__":
    print("To fix 413 errors:")
    print("1. Use mcp__quantconnect__patch_file instead of update_file_contents")
    print("2. Split files larger than 50KB")
    print("3. Remove unnecessary comments and whitespace")
    print("4. Upload files incrementally, not all at once")