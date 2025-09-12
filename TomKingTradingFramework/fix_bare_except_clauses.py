#!/usr/bin/env python3
"""
BARE EXCEPT CLAUSE FIXER
Systematically fixes all bare except clauses with proper exception handling
Following Implementation Audit Protocol
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

class BareExceptFixer:
    """Fix bare except clauses throughout the codebase"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
        # Common exception replacement patterns
        self.exception_patterns = {
            'file_operations': 'except (IOError, OSError, UnicodeDecodeError) as e:',
            'network_operations': 'except (requests.RequestException, ConnectionError, TimeoutError) as e:', 
            'json_operations': 'except (json.JSONDecodeError, ValueError, TypeError) as e:',
            'general_safe': 'except Exception as e:',
            'import_operations': 'except (ImportError, ModuleNotFoundError) as e:',
            'attribute_operations': 'except (AttributeError, TypeError) as e:'
        }
    
    def fix_all_bare_except(self):
        """Fix all bare except clauses in the codebase"""
        print("BARE EXCEPT CLAUSE FIXER")
        print("=" * 50)
        
        python_files = list(self.root_dir.rglob("*.py"))
        fixes_made = 0
        
        for file_path in python_files:
            try:
                fixes = self._fix_file_bare_except(file_path)
                if fixes > 0:
                    fixes_made += fixes
                    relative_path = str(file_path.relative_to(self.root_dir))
                    self.fixes_applied.append(f"{relative_path}: {fixes} bare except clauses fixed")
                    print(f"   Fixed {fixes} bare except clauses in {relative_path}")
                    
            except Exception as e:
                print(f"   Error processing {file_path}: {e}")
        
        print(f"\nTotal bare except clauses fixed: {fixes_made}")
        return fixes_made > 0
    
    def _fix_file_bare_except(self, file_path: Path) -> int:
        """Fix bare except clauses in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            fixes_made = 0
            
            # Pattern 1: except: with pass
            pattern1 = r'(\s+)except:\s*\n(\s+)pass\s*\n'
            def replace1(match):
                indent = match.group(1)
                pass_indent = match.group(2)
                context = self._determine_exception_context(content, match.start())
                exception_type = self.exception_patterns.get(context, self.exception_patterns['general_safe'])
                return f"{indent}{exception_type}\n{pass_indent}# Silently handle expected exception\n{pass_indent}continue\n"
            
            new_content = re.sub(pattern1, replace1, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern1, content, flags=re.MULTILINE))
                content = new_content
            
            # Pattern 2: except: with single statement
            pattern2 = r'(\s+)except:\s*\n(\s+)([^\n]+)\n'
            def replace2(match):
                indent = match.group(1)
                stmt_indent = match.group(2) 
                statement = match.group(3)
                
                # Skip if already has proper exception handling
                if 'except' in statement and 'as e' in statement:
                    return match.group(0)
                    
                context = self._determine_exception_context(content, match.start())
                exception_type = self.exception_patterns.get(context, self.exception_patterns['general_safe'])
                
                # Add proper logging
                return f"""{indent}{exception_type}
{stmt_indent}# Log the exception for debugging
{stmt_indent}print(f"Exception in {file_path.name}: {{e}}")
{stmt_indent}{statement}
"""
            
            new_content = re.sub(pattern2, replace2, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern2, content, flags=re.MULTILINE))
                content = new_content
            
            # Pattern 3: try without except (dangerous)
            pattern3 = r'(\s+)try:\s*\n((?:\s+[^\n]+\n)*?)(\s+)(?!except|finally|else)'
            matches = list(re.finditer(pattern3, content, flags=re.MULTILINE))
            
            for match in reversed(matches):  # Reverse to maintain positions
                indent = match.group(1)
                try_block = match.group(2)
                
                # Check if there's an except clause after the try block
                after_try = content[match.end():]
                if not re.match(r'\s*(except|finally|else)', after_try):
                    # Add a generic except clause
                    replacement = f"{match.group(0)}{indent}except Exception as e:\n{indent}    # Log and handle unexpected exception\n{indent}    print(f'Unexpected exception: {{e}}')\n{indent}    raise\n"
                    content = content[:match.start()] + replacement + content[match.end():]
                    fixes_made += 1
            
            # Write back if changes were made
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
            
            return fixes_made
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return 0
    
    def _determine_exception_context(self, content: str, position: int) -> str:
        """Determine the best exception type based on code context"""
        # Look at surrounding code to determine context
        context_window = content[max(0, position-500):position+500]
        
        if any(keyword in context_window.lower() for keyword in ['open(', 'file', 'read', 'write']):
            return 'file_operations'
        elif any(keyword in context_window.lower() for keyword in ['requests.', 'urllib', 'http']):
            return 'network_operations' 
        elif any(keyword in context_window.lower() for keyword in ['json.', 'loads', 'dumps']):
            return 'json_operations'
        elif any(keyword in context_window.lower() for keyword in ['import', 'from ']):
            return 'import_operations'
        elif any(keyword in context_window.lower() for keyword in ['getattr', 'hasattr', 'setattr']):
            return 'attribute_operations'
        else:
            return 'general_safe'

def main():
    """Fix all bare except clauses"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = BareExceptFixer(root_dir)
    
    success = fixer.fix_all_bare_except()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 50)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return success

if __name__ == "__main__":
    main()