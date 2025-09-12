#!/usr/bin/env python3
"""
Fix malformed f-strings in main.py
"""

import re

def fix_main_fstrings():
    """Fix all malformed f-strings in main.py"""
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Fix pattern: f""[MAIN] -> f"[MAIN]
    content = re.sub(r'f""(\[MAIN\])', r'f"\1', content)
    
    # Fix pattern: ""[MAIN] -> "[MAIN] 
    content = re.sub(r'""(\[MAIN\])', r'"\1', content)
    
    # Count all fixes
    fixes = (original_content.count('f""[') + original_content.count('""[')) - (content.count('f""[') + content.count('""['))
    
    if fixes > 0:
        with open('main.py', 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {fixes} malformed f-strings in main.py")
        return True
    else:
        print("No f-string fixes needed in main.py")
        return False

if __name__ == "__main__":
    fix_main_fstrings()