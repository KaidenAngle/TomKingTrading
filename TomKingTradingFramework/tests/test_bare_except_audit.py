# Critical Code Quality Audit - Bare Except Clauses
# Identifies all dangerous bare except: patterns in the framework

import os
import re
import sys

def find_bare_except_clauses():
    """Find all bare except clauses in the framework"""
    framework_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    bare_except_files = []
    pattern = re.compile(r'^\s*except:\s*$', re.MULTILINE)
    
    for root, dirs, files in os.walk(framework_root):
        # Skip test files for now
        if 'test' in root.lower():
            continue
            
        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                try:
                    
                except Exception as e:

                    # Log and handle unexpected exception

                    print(f'Unexpected exception: {e}')

                    raise
with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    matches = pattern.finditer(content)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        
                        # Get context lines
                        lines = content.split('\n')
                        start_line = max(0, line_num - 5)
                        end_line = min(len(lines), line_num + 5)
                        context = '\n'.join(f"{i+1:3}: {lines[i]}" for i in range(start_line, end_line))
                        
                        bare_except_files.append({
                            'file': filepath,
                            'line': line_num,
                            'context': context
                        })
                        
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
                    continue
    
    return bare_except_files

if __name__ == '__main__':
    print("=== BARE EXCEPT CLAUSE AUDIT ===")
    print("Searching for dangerous bare except: patterns...")
    print()
    
    bare_excepts = find_bare_except_clauses()
    
    print(f"Found {len(bare_excepts)} bare except clauses:")
    print()
    
    for i, issue in enumerate(bare_excepts, 1):
        rel_path = os.path.relpath(issue['file'])
        print(f"{i}. {rel_path}:{issue['line']}")
        print("   Context:")
        print("   " + issue['context'].replace('\n', '\n   '))
        print()
        
    if bare_excepts:
        print("CRITICAL: These bare except clauses are dangerous because they:")
        print("- Catch ALL exceptions including SystemExit and KeyboardInterrupt") 
        print("- Make debugging difficult by hiding real errors")
        print("- Can mask serious system issues")
        print("- Violate Python best practices")
        print()
        print("Each should be replaced with specific exception types.")
    else:
        print("✓ No bare except clauses found - code quality check passed!")