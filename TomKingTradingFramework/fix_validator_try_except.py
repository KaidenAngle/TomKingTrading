#!/usr/bin/env python3
"""
TARGETED FIX for comprehensive_position_opening_validator.py
Fix all malformed try-except structures in this specific file
"""

import re

def fix_validator_try_except_patterns():
    """Fix all malformed try-except patterns in the validator file"""
    
    file_path = 'validation/comprehensive_position_opening_validator.py'
    
    # Read the file
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    print(f"[FIX-VALIDATOR] Processing {file_path}")
    
    # Pattern 1: Fix orphaned if-else after try
    # try: code \n if condition: \n except:
    pattern1 = r'(\s*try:\s*\n\s*[^\n]+\s*\n)(\s*if [^:]+:\s*\n[^}]*?)(\s*except [^:]*:\s*)'
    
    def fix_orphaned_if_else(match):
        try_line = match.group(1)
        if_block = match.group(2) 
        except_line = match.group(3)
        
        # Get indentation level from try
        try_indent = len(try_line) - len(try_line.lstrip())
        
        # Re-indent if-else block to be inside try
        fixed_if_block = []
        for line in if_block.strip().split('\n'):
            if line.strip():
                fixed_if_block.append(' ' * (try_indent + 4) + line.strip())
            else:
                fixed_if_block.append('')
        
        return try_line + '\n'.join(fixed_if_block) + '\n' + except_line
    
    # Apply pattern 1 fix
    content = re.sub(pattern1, fix_orphaned_if_else, content, flags=re.MULTILINE | re.DOTALL)
    
    # Pattern 2: Remove duplicate except blocks
    # except Exception as e: ... except Exception as e:
    pattern2 = r'(\s*except Exception as e:\s*\n(?:[^\n]*\n)*?)\s*except Exception as e:\s*\n\s*\n\s*# [^\n]*\s*\n'
    content = re.sub(pattern2, r'\1', content, flags=re.MULTILINE)
    
    # Pattern 3: Fix indentation issues in log messages
    pattern3 = r'(\s*)(self\.log_(?:success|error)\([^,]+,\s*\d+,\s*)\n\s*(["\'][^"\']*["\'])\)'
    
    def fix_log_indentation(match):
        indent = match.group(1)
        log_start = match.group(2)
        message = match.group(3)
        return f"{indent}{log_start}{message})"
    
    content = re.sub(pattern3, fix_log_indentation, content, flags=re.MULTILINE)
    
    # Pattern 4: Fix orphaned statements after try blocks
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Look for try: followed by code then orphaned statement
        if 'try:' in line and i + 2 < len(lines):
            try_indent = len(line) - len(line.lstrip())
            
            # Check next few lines for orphaned code before except
            j = i + 1
            try_block_lines = [line]
            
            while j < len(lines) and not lines[j].strip().startswith('except'):
                next_line = lines[j]
                if next_line.strip() and not next_line.strip().startswith('#'):
                    # This line should be indented properly inside try
                    if len(next_line) - len(next_line.lstrip()) <= try_indent:
                        # It's not properly indented - fix it
                        next_line = ' ' * (try_indent + 4) + next_line.strip()
                
                try_block_lines.append(next_line)
                j += 1
            
            fixed_lines.extend(try_block_lines)
            i = j
        else:
            fixed_lines.append(line)
            i += 1
    
    content = '\n'.join(fixed_lines)
    
    # Final cleanup: remove empty except blocks
    content = re.sub(r'\s*except Exception as e:\s*\n\s*\n\s*#[^\n]*\n', '', content, flags=re.MULTILINE)
    
    if content != original_content:
        # Save the fixed content
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"[FIX-VALIDATOR] Applied comprehensive fixes to {file_path}")
        return True
    else:
        print(f"[FIX-VALIDATOR] No changes needed")
        return False

if __name__ == "__main__":
    success = fix_validator_try_except_patterns()
    
    # Test compilation
    import subprocess
    try:
        result = subprocess.run(['python', '-m', 'py_compile', 'validation/comprehensive_position_opening_validator.py'], 
                               capture_output=True, text=True)
        if result.returncode == 0:
            print("[FIX-VALIDATOR] SUCCESS: File now compiles without errors!")
        else:
            print(f"[FIX-VALIDATOR] Still has errors: {result.stderr}")
    except Exception as e:
        print(f"[FIX-VALIDATOR] Compilation test failed: {e}")