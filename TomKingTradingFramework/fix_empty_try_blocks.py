#!/usr/bin/env python3
"""
EMPTY TRY BLOCKS FIXER
Systematically fixes empty try blocks created by bare except fixer
Following Implementation Audit Protocol
"""

import os
import re
import ast
from pathlib import Path
from typing import List, Tuple

class EmptyTryBlockFixer:
    """Fix empty try blocks that have their content outside the try block"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_empty_try_blocks(self):
        """Fix all empty try blocks in the codebase"""
        print("EMPTY TRY BLOCKS FIXER")
        print("=" * 50)
        
        python_files = list(self.root_dir.rglob("*.py"))
        fixes_made = 0
        files_with_issues = 0
        
        for file_path in python_files:
            try:
                fixes = self._fix_file_empty_try_blocks(file_path)
                if fixes > 0:
                    files_with_issues += 1
                    fixes_made += fixes
                    relative_path = str(file_path.relative_to(self.root_dir))
                    self.fixes_applied.append(f"{relative_path}: {fixes} empty try blocks fixed")
                    print(f"   Fixed {fixes} empty try blocks in {relative_path}")
                    
            except Exception as e:
                print(f"   Error processing {file_path}: {e}")
        
        print(f"\nFiles with issues: {files_with_issues}")
        print(f"Total empty try blocks fixed: {fixes_made}")
        return fixes_made > 0
    
    def _fix_file_empty_try_blocks(self, file_path: Path) -> int:
        """Fix empty try blocks in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            fixes_made = 0
            
            # Pattern: Empty try block with exception handling followed by orphaned code
            # This matches: try:\n    \nexcept...\n    #comments\n    print(...)\n    raise\norphaned_code
            pattern = r'(\s+)try:\s*\n(\s+)\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)([^\n]+(?:\n(?!\s*(?:def |class |if |while |for |try:|$))[^\n]*)*)'
            
            def fix_empty_try(match):
                nonlocal fixes_made
                
                indent = match.group(1)
                try_indent = match.group(2)  # This should match except_indent
                except_indent = match.group(3)
                exception_part = match.group(4)
                exception_handling = match.group(5)
                orphaned_code = match.group(6)
                
                # Clean up the orphaned code and indent it properly
                lines = orphaned_code.strip().split('\n')
                indented_lines = []
                for line in lines:
                    if line.strip():
                        # Use the except_indent for consistent indentation
                        indented_lines.append(f"{except_indent}{line.strip()}")
                    else:
                        indented_lines.append('')
                
                indented_content = '\n'.join(indented_lines)
                
                fixed_structure = f"""{indent}try:
{indented_content}
{except_indent}except {exception_part}:
{exception_handling}"""
                
                fixes_made += 1
                return fixed_structure
            
            # Apply the fix
            new_content = re.sub(pattern, fix_empty_try, content, flags=re.MULTILINE | re.DOTALL)
            
            # Simpler pattern for cases where there's just one line after
            simple_pattern = r'(\s+)try:\s*\n(\s+)\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)([^\n]+)'
            
            def fix_simple_empty_try(match):
                nonlocal fixes_made
                
                indent = match.group(1)
                try_indent = match.group(2)
                except_indent = match.group(3)
                exception_part = match.group(4)
                exception_handling = match.group(5)
                orphaned_line = match.group(6)
                
                fixed_structure = f"""{indent}try:
{except_indent}{orphaned_line.strip()}
{except_indent}except {exception_part}:
{exception_handling}"""
                
                fixes_made += 1
                return fixed_structure
            
            new_content = re.sub(simple_pattern, fix_simple_empty_try, new_content, flags=re.MULTILINE)
            
            # Write back if changes were made
            if new_content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                # Validate syntax after fixes
                try:
                    ast.parse(new_content)
                except SyntaxError as se:
                    print(f"   WARNING: Syntax error after fixing {file_path}: {se}")
                    # Restore original if syntax is broken
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(original_content)
                    return 0
            
            return fixes_made
            
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            return 0

def main():
    """Fix all empty try blocks"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = EmptyTryBlockFixer(root_dir)
    
    success = fixer.fix_all_empty_try_blocks()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 50)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return success

if __name__ == "__main__":
    main()