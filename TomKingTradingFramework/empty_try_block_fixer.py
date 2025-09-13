#!/usr/bin/env python3
"""
EMPTY TRY BLOCK FIXER
Systematically fixes empty try blocks that cause "expected an indented block" syntax errors
Following zero-tolerance Implementation Audit Protocol
"""

import os
import ast
import re
from pathlib import Path
from typing import List, Dict, Tuple

class EmptyTryBlockFixer:
    """Fix empty try blocks systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_empty_try_blocks(self):
        """Fix all empty try blocks that cause syntax errors"""
        print("EMPTY TRY BLOCK FIXER")
        print("=" * 60)
        print("Fixing empty try blocks causing syntax errors...")
        
        # Get files with "expected an indented block after 'try'" errors
        files_to_fix = self._get_files_with_empty_try_blocks()
        
        print(f"Found {len(files_to_fix)} files with empty try block errors")
        
        total_fixes = 0
        for file_path in files_to_fix:
            print(f"\nProcessing: {file_path.relative_to(self.root_dir)}")
            
            fixes = self._fix_empty_try_blocks_in_file(file_path)
            if fixes > 0:
                total_fixes += fixes
                print(f"  [OK] Fixed {fixes} empty try blocks")
            else:
                print(f"  [SKIP] No fixes applied")
        
        print(f"\n{'='*60}")
        print(f"EMPTY TRY BLOCK FIXING COMPLETE")
        print(f"Total fixes applied: {total_fixes}")
        print(f"{'='*60}")
        
        return total_fixes
    
    def _get_files_with_empty_try_blocks(self) -> List[Path]:
        """Get files with empty try block syntax errors"""
        files_to_fix = []
        
        python_files = list(self.root_dir.rglob("*.py"))
        # Skip fixer files
        python_files = [f for f in python_files if not self._should_skip_file(f)]
        
        for file_path in python_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                try:
                    ast.parse(content)
                except SyntaxError as e:
                    if "expected an indented block after 'try'" in str(e):
                        files_to_fix.append(file_path)
            except Exception:
                pass
        
        return files_to_fix
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        skip_patterns = ['fix_', 'fixer', 'audit']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _fix_empty_try_blocks_in_file(self, file_path: Path) -> int:
        """Fix empty try blocks in a specific file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            lines = content.split('\n')
            fixes = 0
            
            i = 0
            while i < len(lines):
                line = lines[i]
                stripped = line.strip()
                
                # Found a try: statement
                if stripped == 'try:':
                    current_indent = len(line) - len(line.lstrip())
                    expected_indent = current_indent + 4
                    
                    # Look ahead to find what comes after try:
                    j = i + 1
                    found_proper_content = False
                    
                    # Skip empty lines immediately after try:
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    
                    if j < len(lines):
                        next_line = lines[j]
                        next_stripped = next_line.strip()
                        next_indent = len(next_line) - len(next_line.lstrip()) if next_stripped else 0
                        
                        # Check if we have proper content or need to add pass
                        if (next_stripped.startswith(('except', 'finally', 'else:')) or 
                            next_indent <= current_indent):
                            # No content in try block, add pass
                            lines.insert(j, ' ' * expected_indent + 'pass')
                            fixes += 1
                            print(f"    Added 'pass' to empty try block at line {i+1}")
                        elif next_indent > current_indent and not next_stripped.startswith(('except', 'finally', 'else:')):
                            # Has proper indented content
                            found_proper_content = True
                    else:
                        # Try at end of file, add pass
                        lines.append(' ' * expected_indent + 'pass')
                        fixes += 1
                        print(f"    Added 'pass' to try block at end of file (line {i+1})")
                
                i += 1
            
            # Write back if changes made
            if fixes > 0:
                new_content = '\n'.join(lines)
                
                # Validate the fix
                try:
                    ast.parse(new_content)
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    
                    self.fixes_applied.append(f"{file_path.relative_to(self.root_dir)} - {fixes} empty try blocks fixed")
                    return fixes
                except SyntaxError as e:
                    print(f"    [WARN] Fix validation failed: {e}")
                    return 0
            
            return 0
            
        except Exception as e:
            print(f"  [ERROR] {e}")
            return 0

def main():
    """Fix all empty try blocks"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = EmptyTryBlockFixer(root_dir)
    
    total_fixes = fixer.fix_all_empty_try_blocks()
    
    if fixer.fixes_applied:
        print(f"\nFILES SUCCESSFULLY FIXED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return total_fixes > 0

if __name__ == "__main__":
    main()