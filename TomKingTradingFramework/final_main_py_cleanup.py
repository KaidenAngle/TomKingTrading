#!/usr/bin/env python3
"""
FINAL MAIN.PY CLEANUP TOOL
Finish fixing the last remaining try-except indentation issues in main.py
"""

import re

def fix_remaining_main_py_issues():
    """Fix remaining try-except indentation patterns in main.py"""
    
    # Read main.py
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("[FINAL-CLEANUP] Loaded main.py for final structural cleanup")
    
    # Pattern 1: Fix try blocks with missing indentation on subsequent lines
    def fix_try_block_indentation(match):
        try_line = match.group(1)
        try_indent = len(try_line) - len(try_line.lstrip())
        subsequent_lines = match.group(2)
        
        # Fix indentation of each subsequent line
        fixed_lines = []
        for line in subsequent_lines.split('\n'):
            if line.strip():
                if line.strip().startswith(('except', 'finally', 'else')):
                    # These should be at try level
                    fixed_lines.append(' ' * try_indent + line.strip())
                else:
                    # These should be indented inside try
                    fixed_lines.append(' ' * (try_indent + 4) + line.strip())
            else:
                fixed_lines.append(line)
        
        return try_line + '\n' + '\n'.join(fixed_lines)
    
    # Apply try block indentation fixes
    original_content = content
    
    # Fix pattern: try: ... (unindented code) ... except
    pattern = re.compile(r'^(\s*try:\s*\n)((?:(?!\s*(?:except|finally|class|def|\s*$)).*\n)*?)(\s*except.*?:)', re.MULTILINE)
    
    matches = pattern.findall(content)
    print(f"[FINAL-CLEANUP] Found {len(matches)} try-except blocks to fix")
    
    for try_line, middle_content, except_line in matches:
        try_indent = len(try_line) - len(try_line.lstrip())
        
        # Fix middle content indentation
        fixed_middle = []
        for line in middle_content.strip().split('\n'):
            if line.strip():
                # Indent by 4 spaces from try level
                fixed_middle.append(' ' * (try_indent + 4) + line.strip())
            else:
                fixed_middle.append('')
        
        # Fix except line indentation  
        except_fixed = ' ' * try_indent + except_line.strip()
        
        # Replace in content
        old_block = try_line + middle_content + except_line
        new_block = try_line + '\n'.join(fixed_middle) + '\n' + except_fixed
        
        content = content.replace(old_block, new_block)
    
    # Additional cleanup: fix orphaned code after try blocks
    content = re.sub(r'(\s*)try:\s*\n\s*pass\s*\n\s*except.*?:\s*\n\s*\n\s*(.+)', 
                     r'\1try:\n\1    \2', content, flags=re.MULTILINE)
    
    if content != original_content:
        # Save the fixed content
        with open('main.py', 'w', encoding='utf-8') as f:
            f.write(content)
        print("[FINAL-CLEANUP] Applied final structural fixes to main.py")
        return True
    else:
        print("[FINAL-CLEANUP] No additional fixes needed")
        return False

if __name__ == "__main__":
    success = fix_remaining_main_py_issues()
    
    # Test compilation
    import py_compile
    try:
        py_compile.compile('main.py', doraise=True)
        print("[FINAL-CLEANUP] SUCCESS: main.py compiles without errors!")
    except Exception as e:
        print(f"[FINAL-CLEANUP] Still has errors: {e}")