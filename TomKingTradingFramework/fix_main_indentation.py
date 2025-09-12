#!/usr/bin/env python3
"""
FIX MAIN.PY INDENTATION ISSUES
Systematically fixes indentation problems in main.py
"""

import re
from pathlib import Path

def fix_main_indentation():
    """Fix all indentation issues in main.py"""
    main_file = Path("main.py")
    
    with open(main_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    fixed_lines = []
    
    for i, line in enumerate(lines):
        # Look for specific patterns that need fixing
        
        # Pattern 1: Lines after if/else statements that aren't properly indented
        if i > 0:
            prev_line = lines[i-1].strip()
            
            # If previous line ended with : and current line is not empty and not properly indented
            if (prev_line.endswith(':') and 
                line.strip() != '' and 
                not line.startswith('    ') and
                not line.strip().startswith('#') and
                not re.match(r'\s*(def |class |if |elif |else|except|finally)', line)):
                
                # Find the indentation level of the previous line
                prev_indent_match = re.match(r'(\s*)', lines[i-1])
                prev_indent = prev_indent_match.group(1) if prev_indent_match else ''
                
                # Add proper indentation (4 more spaces than previous line)
                content_stripped = line.strip()
                fixed_line = prev_indent + '    ' + content_stripped
                fixed_lines.append(fixed_line)
                print(f"Fixed line {i+1}: Added indentation")
                continue
        
        # Pattern 2: Multiline method calls that aren't properly indented
        if i > 0 and 'self.Schedule.On(' in line and not line.strip().startswith('self.Schedule.On('):
            # This is a continuation line that needs proper indentation
            prev_line = lines[i-1]
            prev_indent_match = re.match(r'(\s*)', prev_line)
            prev_indent = prev_indent_match.group(1) if prev_indent_match else ''
            
            content_stripped = line.strip()
            if content_stripped.startswith('self.'):
                fixed_line = prev_indent + '    ' + content_stripped
                fixed_lines.append(fixed_line)
                print(f"Fixed line {i+1}: Method call indentation")
                continue
        
        # Pattern 3: Function arguments that need proper indentation
        if (line.strip().startswith('self.DateRules.') or 
            line.strip().startswith('self.TimeRules.') or
            line.strip().startswith('self.SafetyCheck') or
            line.strip() == ')'):
            
            # Find the opening parenthesis line
            for j in range(i-1, -1, -1):
                if '(' in lines[j] and not lines[j].strip().startswith('#'):
                    parent_indent_match = re.match(r'(\s*)', lines[j])
                    parent_indent = parent_indent_match.group(1) if parent_indent_match else ''
                    
                    content_stripped = line.strip()
                    if content_stripped == ')':
                        fixed_line = parent_indent + content_stripped
                    else:
                        fixed_line = parent_indent + '    ' + content_stripped
                    
                    fixed_lines.append(fixed_line)
                    print(f"Fixed line {i+1}: Argument indentation")
                    break
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)
    
    # Write the fixed content
    fixed_content = '\n'.join(fixed_lines)
    
    with open(main_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print("Fixed main.py indentation issues")

if __name__ == "__main__":
    fix_main_indentation()