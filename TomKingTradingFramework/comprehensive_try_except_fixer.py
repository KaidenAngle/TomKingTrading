#!/usr/bin/env python3
"""
Comprehensive Try-Except Block Fixer
Systematically repairs malformed try-except structures
"""

import re
import os
import ast

def fix_try_except_blocks(file_path):
    """Fix malformed try-except blocks in a Python file"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"[FAIL] Could not read {file_path}: {e}")
        return False
    
    print(f"[INFO] Fixing try-except blocks in {file_path}")
    
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Detect try: statement
        if re.match(r'^(\s*)try:\s*$', line):
            indent = re.match(r'^(\s*)', line).group(1)
            fixed_lines.append(line)
            i += 1
            
            # Look for the next except/finally block
            try_content = []
            found_except = False
            
            while i < len(lines):
                next_line = lines[i]
                
                # If we find except/finally at the same indentation level
                if re.match(rf'^{re.escape(indent)}(except|finally)', next_line):
                    found_except = True
                    break
                
                # If line is not properly indented for try block, fix it
                if next_line.strip() and not next_line.startswith(indent + '    '):
                    # This line should be inside the try block
                    if next_line.strip():
                        try_content.append(indent + '    ' + next_line.lstrip())
                    else:
                        try_content.append(next_line)
                else:
                    try_content.append(next_line)
                
                i += 1
            
            # Add the fixed try content
            fixed_lines.extend(try_content)
            
            # Add except block if found
            if found_except and i < len(lines):
                fixed_lines.append(lines[i])
                i += 1
            
            continue
        
        # Regular line - add as is
        fixed_lines.append(line)
        i += 1
    
    # Reconstruct content
    fixed_content = '\n'.join(fixed_lines)
    
    # Additional pattern-based fixes
    patterns = [
        # Fix orphaned except blocks
        (r'\n(\s*)except Exception as e:\n\n(\s*)# (.+)\n', 
         r'\n\1except Exception as e:\n\1    # \3\n\1    pass\n'),
        
        # Fix empty try blocks
        (r'\n(\s*)try:\s*\n(\s*)except',
         r'\n\1try:\n\1    pass\n\2except'),
    ]
    
    for pattern, replacement in patterns:
        fixed_content = re.sub(pattern, replacement, fixed_content)
    
    # Validate syntax
    try:
        ast.parse(fixed_content)
        print(f"[OK] Syntax validation passed for {file_path}")
    except SyntaxError as e:
        print(f"[WARN] Still has syntax issues after fixes: {e}")
        return False
    
    # Write fixed content
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        print(f"[OK] Successfully fixed {file_path}")
        return True
    except Exception as e:
        print(f"[FAIL] Could not write {file_path}: {e}")
        return False

def main():
    """Fix multiple files with try-except issues"""
    files_to_fix = [
        "core/market_data_cache.py",
        "core/performance_cache.py", 
        "helpers/option_chain_manager.py",
        "helpers/option_order_executor.py",
        "helpers/order_state_recovery.py"
    ]
    
    success_count = 0
    for file_path in files_to_fix:
        if os.path.exists(file_path):
            if fix_try_except_blocks(file_path):
                success_count += 1
        else:
            print(f"[SKIP] File not found: {file_path}")
    
    print(f"\n[SUMMARY] Fixed {success_count}/{len(files_to_fix)} files")
    return success_count == len(files_to_fix)

if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)