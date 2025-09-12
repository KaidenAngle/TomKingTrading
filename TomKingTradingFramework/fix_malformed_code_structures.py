#!/usr/bin/env python3
"""
MALFORMED CODE STRUCTURE FIXER
Systematically fixes malformed try-except blocks created by bare except fixer
Following Implementation Audit Protocol
"""

import os
import re
import ast
from pathlib import Path
from typing import List, Tuple, Dict

class MalformedCodeFixer:
    """Fix malformed code structures created by bare except clause fixer"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_malformed_code(self):
        """Fix all malformed code structures in the codebase"""
        print("MALFORMED CODE STRUCTURE FIXER")
        print("=" * 50)
        
        python_files = list(self.root_dir.rglob("*.py"))
        fixes_made = 0
        files_processed = 0
        
        for file_path in python_files:
            try:
                fixes = self._fix_file_malformed_code(file_path)
                files_processed += 1
                if fixes > 0:
                    fixes_made += fixes
                    relative_path = str(file_path.relative_to(self.root_dir))
                    self.fixes_applied.append(f"{relative_path}: {fixes} malformed structures fixed")
                    print(f"   Fixed {fixes} malformed structures in {relative_path}")
                    
            except Exception as e:
                print(f"   Error processing {file_path}: {e}")
        
        print(f"\nProcessed {files_processed} files")
        print(f"Total malformed structures fixed: {fixes_made}")
        return fixes_made > 0
    
    def _fix_file_malformed_code(self, file_path: Path) -> int:
        """Fix malformed code structures in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            fixes_made = 0
            
            # Pattern 1: Orphaned try blocks (try: followed immediately by except on next line)
            # This indicates the try block content was placed outside
            pattern1 = r'(\s+)try:\s*\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)([^\n]+)'
            
            def fix_orphaned_try(match):
                indent = match.group(1)
                except_indent = match.group(2)
                exception_part = match.group(3)
                exception_handling = match.group(4)
                orphaned_code = match.group(5)
                
                # Move the orphaned code back inside the try block
                fixed_structure = f"""{indent}try:
{except_indent}{orphaned_code.strip()}
{except_indent}except {exception_part}:
{exception_handling}"""
                return fixed_structure
            
            new_content = re.sub(pattern1, fix_orphaned_try, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern1, content, flags=re.MULTILINE))
                content = new_content
            
            # Pattern 2: Multiple line orphaned code after malformed try-except
            pattern2 = r'(\s+)try:\s*\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)((?:[^\n]+\n)+?)(?=\n\s*(?:def |class |if |for |while |try:|$))'
            
            def fix_multiline_orphaned(match):
                indent = match.group(1)
                except_indent = match.group(2)
                exception_part = match.group(3)
                exception_handling = match.group(4)
                orphaned_lines = match.group(5)
                
                # Clean up orphaned lines and move them to try block
                orphaned_cleaned = '\n'.join([f"{except_indent}{line.strip()}" 
                                            for line in orphaned_lines.strip().split('\n') 
                                            if line.strip()])
                
                fixed_structure = f"""{indent}try:
{orphaned_cleaned}
{except_indent}except {exception_part}:
{exception_handling}"""
                return fixed_structure
            
            new_content = re.sub(pattern2, fix_multiline_orphaned, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern2, content, flags=re.MULTILINE))
                content = new_content
            
            # Pattern 3: Specific fix for the pattern seen in the files
            # where code like "with open(...)" is outside try block
            pattern3 = r'(\s+)try:\s*\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)(with open\([^)]+\)[^:]*:)'
            
            def fix_with_open_pattern(match):
                indent = match.group(1)
                except_indent = match.group(2)
                exception_part = match.group(3)
                exception_handling = match.group(4)
                with_statement = match.group(5)
                
                fixed_structure = f"""{indent}try:
{except_indent}{with_statement}"""
                
                # Add the exception handling after finding the end of the with block
                # For now, just fix the immediate structure
                return fixed_structure
            
            new_content = re.sub(pattern3, fix_with_open_pattern, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern3, content, flags=re.MULTILINE))
                content = new_content
            
            # Pattern 4: Fix function calls that got separated from try blocks
            pattern4 = r'(\s+)try:\s*\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*print\(f\'[^\']*\'\)\s*\n\s*raise\s*\n)([a-zA-Z_][a-zA-Z0-9_]*\s*=\s*[^\n]+)'
            
            def fix_function_call_pattern(match):
                indent = match.group(1)
                except_indent = match.group(2)
                exception_part = match.group(3)
                exception_handling = match.group(4)
                function_call = match.group(5)
                
                fixed_structure = f"""{indent}try:
{except_indent}{function_call}
{except_indent}except {exception_part}:
{exception_handling}"""
                return fixed_structure
            
            new_content = re.sub(pattern4, fix_function_call_pattern, content, flags=re.MULTILINE)
            if new_content != content:
                fixes_made += len(re.findall(pattern4, content, flags=re.MULTILINE))
                content = new_content
            
            # Write back if changes were made
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                # Validate syntax after fixes
                try:
                    ast.parse(content)
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
    
    def _detect_orphaned_code_patterns(self, content: str) -> List[Dict]:
        """Detect various patterns of orphaned code"""
        patterns = []
        
        # Look for try blocks immediately followed by except
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.strip().endswith('try:') and i + 1 < len(lines):
                next_line = lines[i + 1]
                if next_line.strip().startswith('except '):
                    patterns.append({
                        'type': 'empty_try_block',
                        'line': i + 1,
                        'try_line': line,
                        'except_line': next_line
                    })
        
        return patterns

def main():
    """Fix all malformed code structures"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = MalformedCodeFixer(root_dir)
    
    success = fixer.fix_all_malformed_code()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 50)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return success

if __name__ == "__main__":
    main()