#!/usr/bin/env python3
"""
TARGETED SYNTAX ERROR FIXER
Systematically fixes specific syntax error patterns found in the codebase
Following zero-tolerance approach
"""

import os
import re
import ast
from pathlib import Path
from typing import List, Dict

class TargetedSyntaxErrorFixer:
    """Fix specific syntax error patterns systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_targeted_syntax_errors(self):
        """Fix all targeted syntax errors systematically"""
        print("TARGETED SYNTAX ERROR FIXER")
        print("=" * 60)
        print("Fixing specific syntax error patterns...")
        
        python_files = list(self.root_dir.rglob("*.py"))
        # Skip fixer files
        python_files = [f for f in python_files if not self._should_skip_file(f)]
        
        print(f"Processing {len(python_files)} files...")
        
        total_fixes = 0
        for file_path in python_files:
            fixes_in_file = self._fix_file_syntax_errors(file_path)
            if fixes_in_file > 0:
                total_fixes += fixes_in_file
                print(f"  [OK] Fixed {fixes_in_file} errors in {file_path.relative_to(self.root_dir)}")
        
        print(f"\nTotal syntax fixes applied: {total_fixes}")
        return total_fixes
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        skip_patterns = ['fix_', 'fixer', 'audit']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _fix_file_syntax_errors(self, file_path: Path) -> int:
        """Fix syntax errors in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            fixes_in_file = 0
            
            # Pattern 1: Fix unterminated f-strings with missing opening quote
            # self.Error(f""[MAIN] -> self.Error(f"[MAIN]
            content, fix_count = self._fix_unterminated_fstrings(content)
            fixes_in_file += fix_count
            
            # Pattern 2: Fix empty try blocks
            content, fix_count = self._fix_empty_try_blocks(content)
            fixes_in_file += fix_count
            
            # Pattern 3: Fix f-string brace issues
            content, fix_count = self._fix_fstring_braces(content)
            fixes_in_file += fix_count
            
            # Pattern 4: Fix missing commas in function calls
            content, fix_count = self._fix_missing_commas(content)
            fixes_in_file += fix_count
            
            # Only write if changes were made
            if content != original_content:
                # Validate the fix worked
                try:
                    ast.parse(content)
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    self.fixes_applied.append(f"{file_path.relative_to(self.root_dir)} - Applied {fixes_in_file} fixes")
                    return fixes_in_file
                except SyntaxError:
                    # Fix didn't work, restore original
                    print(f"  [WARN] Syntax fix failed for {file_path.relative_to(self.root_dir)}, restored original")
                    return 0
            
            return 0
            
        except Exception as e:
            print(f"  [ERROR] Error processing {file_path}: {e}")
            return 0
    
    def _fix_unterminated_fstrings(self, content: str) -> tuple[str, int]:
        """Fix unterminated f-strings with missing opening quotes"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            # Pattern: f""[MAIN] -> f"[MAIN]
            if re.search(r'f""?\[', line):
                original_line = line
                # Fix double quotes at start of f-string
                fixed_line = re.sub(r'f""(\[)', r'f"\1', line)
                if fixed_line != original_line:
                    lines[i] = fixed_line
                    fixes += 1
            
            # Pattern: Missing closing quote and parenthesis for logging
            if re.search(r'self\.(Error|Log|Debug)\(f"[^"]*$', line):
                if not line.endswith('")'):
                    lines[i] = line + '")'
                    fixes += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_empty_try_blocks(self, content: str) -> tuple[str, int]:
        """Fix empty try blocks that cause syntax errors"""
        fixes = 0
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Found a try: statement
            if line == 'try:':
                # Check if next non-empty line is except/finally/else
                j = i + 1
                found_content = False
                
                while j < len(lines):
                    next_line = lines[j].strip()
                    
                    if not next_line:  # Empty line
                        j += 1
                        continue
                    
                    # If we hit except/finally/else without proper content, add pass
                    if next_line.startswith(('except', 'finally', 'else')):
                        if not found_content:
                            # Insert pass statement
                            indent = len(lines[i]) - len(lines[i].lstrip()) + 4
                            lines.insert(j, ' ' * indent + 'pass')
                            fixes += 1
                        break
                    elif not next_line.startswith(' ' * (len(lines[i]) - len(lines[i].lstrip()) + 4)):
                        # Line is not properly indented for try block
                        if not found_content:
                            indent = len(lines[i]) - len(lines[i].lstrip()) + 4
                            lines.insert(j, ' ' * indent + 'pass')
                            fixes += 1
                        break
                    else:
                        found_content = True
                        break
                    
                    j += 1
                
                # If we reached end without finding except/finally, add pass
                if j >= len(lines) and not found_content:
                    indent = len(lines[i]) - len(lines[i].lstrip()) + 4
                    lines.insert(i + 1, ' ' * indent + 'pass')
                    fixes += 1
            
            i += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_fstring_braces(self, content: str) -> tuple[str, int]:
        """Fix f-string brace matching issues"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            # Fix f-strings missing closing braces
            if 'f"' in line and '{' in line:
                original_line = line
                
                # Count braces
                open_braces = line.count('{')
                close_braces = line.count('}')
                
                if open_braces > close_braces:
                    # Add missing closing braces before the closing quote
                    missing_braces = open_braces - close_braces
                    if line.endswith('"') or line.endswith('")'):
                        if line.endswith('")'):
                            fixed_line = line[:-2] + '}' * missing_braces + '")'
                        else:
                            fixed_line = line[:-1] + '}' * missing_braces + '"'
                        lines[i] = fixed_line
                        fixes += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_missing_commas(self, content: str) -> tuple[str, int]:
        """Fix missing commas in function calls"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            # Look for patterns like: func(arg1 arg2) -> func(arg1, arg2)
            if '(' in line and ')' in line:
                original_line = line
                
                # Simple pattern: word followed by space and another word inside parentheses
                fixed_line = re.sub(r'(\w+)\s+(\w+)(?=\s*[,)])', r'\1, \2', line)
                
                if fixed_line != original_line:
                    lines[i] = fixed_line
                    fixes += 1
        
        return '\n'.join(lines), fixes

def main():
    """Fix targeted syntax errors"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = TargetedSyntaxErrorFixer(root_dir)
    
    total_fixes = fixer.fix_all_targeted_syntax_errors()
    
    print(f"\n{'='*60}")
    print("TARGETED SYNTAX ERROR FIXING COMPLETE")
    print(f"{'='*60}")
    print(f"Total fixes applied: {total_fixes}")
    
    if fixer.fixes_applied:
        print(f"\nFILES FIXED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return total_fixes > 0

if __name__ == "__main__":
    main()