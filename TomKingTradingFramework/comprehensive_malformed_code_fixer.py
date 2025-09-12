#!/usr/bin/env python3
"""
COMPREHENSIVE MALFORMED CODE FIXER
Systematically fixes all malformed try-except structures created by bare except fixer
Following Implementation Audit Protocol - Zero Tolerance for Shortcuts
"""

import os
import re
from pathlib import Path
from typing import List, Tuple

class ComprehensiveMalformedCodeFixer:
    """Comprehensive fixer for all malformed code structures"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_malformed_structures(self):
        """Fix all types of malformed structures systematically"""
        print("COMPREHENSIVE MALFORMED CODE STRUCTURE FIXER")
        print("=" * 60)
        
        python_files = list(self.root_dir.rglob("*.py"))
        total_fixes = 0
        files_processed = 0
        
        for file_path in python_files:
            if self._should_skip_file(file_path):
                continue
                
            try:
                content_fixes = 0
                with open(file_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                
                content = original_content
                
                # Apply all fixing patterns in sequence
                content, fixes1 = self._fix_empty_try_with_orphaned_code(content, file_path)
                content, fixes2 = self._fix_nested_empty_try_patterns(content, file_path)
                content, fixes3 = self._fix_multiline_orphaned_patterns(content, file_path)
                
                content_fixes = fixes1 + fixes2 + fixes3
                
                if content_fixes > 0:
                    # Write the fixed content
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    relative_path = str(file_path.relative_to(self.root_dir))
                    self.fixes_applied.append(f"{relative_path}: {content_fixes} malformed structures fixed")
                    print(f"   Fixed {content_fixes} structures in {relative_path}")
                    
                    total_fixes += content_fixes
                
                files_processed += 1
                
            except Exception as e:
                print(f"   Error processing {file_path}: {e}")
        
        print(f"\nProcessed {files_processed} files")
        print(f"Total malformed structures fixed: {total_fixes}")
        return total_fixes > 0
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        # Skip the fixer files themselves
        if 'fix_' in file_path.name and file_path.name.endswith('_fixer.py'):
            return True
        if 'malformed' in file_path.name.lower():
            return True
        return False
    
    def _fix_empty_try_with_orphaned_code(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix empty try blocks with orphaned code immediately following"""
        fixes_made = 0
        
        # Pattern 1: try: followed by blank/whitespace line, then except, then orphaned code
        pattern1 = r'(\s+)try:\s*\n(\s*\n)?(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*(?:print\([^)]*\)|self\.algo\.[^(]*\([^)]*\))\s*\n(?:\s*raise\s*\n)?)((?:[^\n]+\n?)*?)(?=\n\s*(?:def |class |if |while |for |try:|except |$))'
        
        def fix_pattern1(match):
            nonlocal fixes_made
            
            try_indent = match.group(1)
            blank_line = match.group(2) or ''
            except_indent = match.group(3)
            exception_part = match.group(4)
            exception_handling = match.group(5).strip()
            orphaned_code = match.group(6).strip()
            
            if not orphaned_code:
                return match.group(0)  # No orphaned code to fix
            
            # Process orphaned code lines
            orphaned_lines = orphaned_code.split('\n')
            indented_orphaned = []
            
            for line in orphaned_lines:
                if line.strip():
                    indented_orphaned.append(f"{except_indent}{line.strip()}")
                else:
                    indented_orphaned.append('')
            
            fixed_content = f"""{try_indent}try:
                {chr(10).join(indented_orphaned)}
{except_indent}except {exception_part}:
    {except_indent}    {exception_handling}"""
            
            fixes_made += 1
            return fixed_content
        
        new_content = re.sub(pattern1, fix_pattern1, content, flags=re.MULTILINE | re.DOTALL)
        
        # Pattern 2: Simpler case - single line orphaned code
        pattern2 = r'(\s+)try:\s*\n(\s*\n)?(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*(?:print\([^)]*\)|.*Log\([^)]*\))\s*\n(?:\s*raise\s*\n)?)([a-zA-Z_][^\n]*)\n'
        
        def fix_pattern2(match):
            nonlocal fixes_made
            
            try_indent = match.group(1)
            blank_line = match.group(2) or ''
            except_indent = match.group(3)
            exception_part = match.group(4)
            exception_handling = match.group(5).strip()
            orphaned_line = match.group(6).strip()
            
            fixed_content = f"""{try_indent}try:
                {except_indent}{orphaned_line}
{except_indent}except {exception_part}:
    {except_indent}    {exception_handling}
"""
            
            fixes_made += 1
            return fixed_content
        
        new_content = re.sub(pattern2, fix_pattern2, new_content, flags=re.MULTILINE)
        
        return new_content, fixes_made
    
    def _fix_nested_empty_try_patterns(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix more complex nested empty try patterns"""
        fixes_made = 0
        
        # Pattern for with/for/if statements after empty try
        pattern = r'(\s+)try:\s*\n\s*\n(\s+)except ([^:]+):\s*\n((?:\s*#[^\n]*\n)*\s*(?:print\([^)]*\)|.*Log\([^)]*\))\s*\n(?:\s*raise\s*\n)?)(\s*)((?:with |for |if |while |return |yield )[^\n]*)\n'
        
        def fix_nested_pattern(match):
            nonlocal fixes_made
            
            try_indent = match.group(1)
            except_indent = match.group(2)
            exception_part = match.group(3)
            exception_handling = match.group(4).strip()
            orphaned_indent = match.group(5)
            orphaned_statement = match.group(6)
            
            # Use consistent indentation
            fixed_content = f"""{try_indent}try:
                {except_indent}{orphaned_statement}
{except_indent}except {exception_part}:
    {except_indent}    {exception_handling}
"""
            
            fixes_made += 1
            return fixed_content
        
        new_content = re.sub(pattern, fix_nested_pattern, content, flags=re.MULTILINE)
        
        return new_content, fixes_made
    
    def _fix_multiline_orphaned_patterns(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix complex multiline orphaned code patterns"""
        fixes_made = 0
        
        # Look for patterns where there are multiple lines of orphaned code
        lines = content.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Look for try: followed by except on next significant line
            if re.match(r'\s+try:\s*$', line):
                try_indent = re.match(r'(\s+)', line).group(1)
                j = i + 1
                
                # Skip blank lines
                while j < len(lines) and lines[j].strip() == '':
                    j += 1
                
                # Check if next non-blank line is except
                if j < len(lines) and re.match(r'\s+except .+:', lines[j]):
                    except_line = lines[j]
                    except_indent = re.match(r'(\s+)', except_line).group(1)
                    
                    # Collect exception handling
                    k = j + 1
                    exception_handling_lines = []
                    
                    while k < len(lines):
                        next_line = lines[k]
                        if not next_line.strip():
                            k += 1
                            continue
                        if (next_line.strip().startswith('#') or 
                            'print(' in next_line or 
                            'Log(' in next_line or 
                            next_line.strip() == 'raise'):
                            exception_handling_lines.append(next_line)
                            k += 1
                        else:
                            break
                    
                    # Collect orphaned code
                    orphaned_lines = []
                    while k < len(lines):
                        next_line = lines[k]
                        if not next_line.strip():
                            k += 1
                            continue
                        if (re.match(r'\s*(?:def |class |if |while |for |try:|except |return |yield)', next_line) or
                            k == len(lines) - 1):
                            if not re.match(r'\s*(?:def |class |if |while |for |try:|except)', next_line):
                                orphaned_lines.append(next_line)
                            break
                        orphaned_lines.append(next_line)
                        k += 1
                    
                    # If we found orphaned code, fix the structure
                    if orphaned_lines:
                        fixed_lines.append(line)  # try:
                        
                            # Add orphaned code to try block
                        for orphaned_line in orphaned_lines:
                            if orphaned_line.strip():
                                # Ensure proper indentation within try block
                                orphaned_content = orphaned_line.strip()
                                fixed_lines.append(f"{except_indent}{orphaned_content}")
                        
                        # Add the except block
                        fixed_lines.append(except_line)
                        for eh_line in exception_handling_lines:
                            fixed_lines.append(eh_line)
                        
                        fixes_made += 1
                        i = k
                        continue
            
            fixed_lines.append(line)
            i += 1
        
        if fixes_made > 0:
            return '\n'.join(fixed_lines), fixes_made
        
        return content, fixes_made

def main():
    """Fix all malformed code structures comprehensively"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = ComprehensiveMalformedCodeFixer(root_dir)
    
    success = fixer.fix_all_malformed_structures()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 60)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    print(f"\nMalformed code fixing completed: {'SUCCESS' if success else 'NO ISSUES FOUND'}")
    return success

if __name__ == "__main__":
    main()