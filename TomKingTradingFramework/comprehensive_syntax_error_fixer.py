#!/usr/bin/env python3
"""
COMPREHENSIVE SYNTAX ERROR FIXER
Systematically fixes all remaining syntax errors with specific pattern recognition
Following zero-tolerance Implementation Audit Protocol
"""

import os
import ast
import re
from pathlib import Path
from typing import List, Dict, Tuple

class ComprehensiveSyntaxErrorFixer:
    """Fix all remaining syntax errors systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_all_remaining_syntax_errors(self):
        """Fix all remaining syntax errors systematically"""
        print("COMPREHENSIVE SYNTAX ERROR FIXER")
        print("=" * 60)
        print("Fixing ALL remaining syntax errors with zero tolerance...")
        
        # Get list of files with syntax errors
        files_with_syntax_errors = self._get_files_with_syntax_errors()
        
        print(f"Found {len(files_with_syntax_errors)} files with syntax errors")
        
        total_fixes = 0
        for file_path, error_msg in files_with_syntax_errors:
            print(f"\nProcessing: {file_path.relative_to(self.root_dir)}")
            print(f"  Error: {error_msg}")
            
            fixes = self._fix_file_systematically(file_path, error_msg)
            if fixes > 0:
                total_fixes += fixes
                print(f"  [OK] Applied {fixes} fixes")
            else:
                print(f"  [SKIP] No automated fix available")
        
        print(f"\n{'='*60}")
        print(f"COMPREHENSIVE FIXING COMPLETE")
        print(f"Total fixes applied: {total_fixes}")
        print(f"{'='*60}")
        
        return total_fixes
    
    def _get_files_with_syntax_errors(self) -> List[Tuple[Path, str]]:
        """Get all files with syntax errors"""
        files_with_errors = []
        
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
                    files_with_errors.append((file_path, str(e)))
            except Exception:
                pass
        
        return files_with_errors
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        skip_patterns = ['fix_', 'fixer', 'audit']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _fix_file_systematically(self, file_path: Path, error_msg: str) -> int:
        """Fix syntax errors in a specific file based on error message"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            fixes = 0
            
            # Pattern-based fixing based on error message
            if "unterminated string literal" in error_msg:
                content, fix_count = self._fix_unterminated_strings(content)
                fixes += fix_count
            
            elif "expected an indented block" in error_msg:
                content, fix_count = self._fix_indentation_blocks(content)
                fixes += fix_count
            
            elif "f-string: expecting" in error_msg:
                content, fix_count = self._fix_fstring_braces(content)
                fixes += fix_count
            
            elif "invalid syntax" in error_msg and "comma" in error_msg:
                content, fix_count = self._fix_missing_commas(content)
                fixes += fix_count
            
            elif "unexpected EOF" in error_msg:
                content, fix_count = self._fix_unexpected_eof(content)
                fixes += fix_count
            
            # General pattern fixes
            content, additional_fixes = self._apply_general_fixes(content)
            fixes += additional_fixes
            
            # Validate and write if changes made
            if content != original_content:
                if self._validate_syntax_fix(content):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    self.fixes_applied.append(f"{file_path.relative_to(self.root_dir)} - {fixes} fixes")
                    return fixes
            
            return 0
            
        except Exception as e:
            print(f"  [ERROR] {e}")
            return 0
    
    def _fix_unterminated_strings(self, content: str) -> Tuple[str, int]:
        """Fix unterminated string literals"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            original_line = line
            
            # Pattern: f"[MAIN]" -> f"[MAIN]
            if re.search(r'f""?\[', line):
                line = re.sub(r'f""(\[)', r'f"\1', line)
            
            # Pattern: Missing closing quotes in logging calls
            if re.search(r'self\.(Error|Log|Debug)\(f"[^"]*$', line):
                if not line.endswith('")'):
                    line = line + '")'
            
            # Pattern: Missing closing quote in f-strings
            if 'f"' in line and line.count('"') % 2 == 1:
                if not line.endswith('"') and not line.endswith('")'):
                    line = line + '"'
            
            if line != original_line:
                lines[i] = line
                fixes += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_indentation_blocks(self, content: str) -> Tuple[str, int]:
        """Fix indentation issues systematically"""
        fixes = 0
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Found a statement that should have an indented block
            if stripped.endswith(':') and any(keyword in stripped for keyword in ['try:', 'except', 'if', 'else:', 'elif', 'for', 'while', 'def', 'class']):
                current_indent = len(line) - len(line.lstrip())
                expected_indent = current_indent + 4
                
                # Check next non-empty line
                j = i + 1
                while j < len(lines) and not lines[j].strip():
                    j += 1
                
                if j < len(lines):
                    next_line = lines[j]
                    next_stripped = next_line.strip()
                    next_indent = len(next_line) - len(next_line.lstrip()) if next_stripped else 0
                    
                    # If next line is not properly indented or is a control statement
                    if next_stripped and (next_indent <= current_indent or 
                                        next_stripped.startswith(('except', 'finally', 'else', 'elif'))):
                                            # Insert pass statement
                        lines.insert(j, ' ' * expected_indent + 'pass')
                        fixes += 1
                        i = j + 1
                        continue
                    elif not next_stripped:
                        # Empty line, insert pass
                        lines[j] = ' ' * expected_indent + 'pass'
                        fixes += 1
                
                elif j >= len(lines) and stripped == 'try:':
                    # Try block at end of file
                    lines.append(' ' * expected_indent + 'pass')
                    fixes += 1
            
            i += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_fstring_braces(self, content: str) -> Tuple[str, int]:
        """Fix f-string brace matching"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'f"' in line and '{' in line:
                original_line = line
                
                # Count braces
                open_braces = line.count('{')
                close_braces = line.count('}')
                
                if open_braces > close_braces:
                    missing = open_braces - close_braces
                    
                    # Add missing closing braces before final quote
                    if line.endswith('"') or line.endswith('")'):
                        if line.endswith('")'):
                            line = line[:-2] + '}' * missing + '")'
                        else:
                            line = line[:-1] + '}' * missing + '"'
                        
                        lines[i] = line
                        fixes += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_missing_commas(self, content: str) -> Tuple[str, int]:
        """Fix missing commas in function calls and parameter lists"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            original_line = line
            
            # Pattern: function(arg1 arg2) -> function(arg1, arg2)
            line = re.sub(r'(\w+)\s+(\w+)(?=\s*[,)])', r'\1, \2', line)
            
            if line != original_line:
                lines[i] = line
                fixes += 1
        
        return '\n'.join(lines), fixes
    
    def _fix_unexpected_eof(self, content: str) -> Tuple[str, int]:
        """Fix unexpected EOF by adding missing brackets"""
        fixes = 0
        
        # Count unmatched brackets
        open_parens = content.count('(')
        close_parens = content.count(')')
        open_braces = content.count('{')
        close_braces = content.count('}')
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        
        additions = []
        if open_parens > close_parens:
            additions.extend([')'] * (open_parens - close_parens))
            fixes += open_parens - close_parens
        
        if open_braces > close_braces:
            additions.extend(['}'] * (open_braces - close_braces))
            fixes += open_braces - close_braces
        
        if open_brackets > close_brackets:
            additions.extend([']'] * (open_brackets - close_brackets))
            fixes += open_brackets - close_brackets
        
        if additions:
            content += ''.join(additions)
        
        return content, fixes
    
    def _apply_general_fixes(self, content: str) -> Tuple[str, int]:
        """Apply general syntax fixes"""
        fixes = 0
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            original_line = line
            
            # Fix double colons
            if '::' in line:
                line = line.replace('::', ':')
                fixes += 1
            
            # Fix orphaned operators at line start
            if line.strip().startswith(('and ', 'or ', 'not ')) and i > 0:
                # Move to end of previous line
                lines[i-1] += ' ' + line.strip()
                line = ''
                fixes += 1
            
            lines[i] = line
        
        return '\n'.join(lines), fixes
    
    def _validate_syntax_fix(self, content: str) -> bool:
        """Validate that syntax fix worked"""
        try:
            ast.parse(content)
            return True
        except SyntaxError:
            return False

def main():
    """Fix all remaining syntax errors"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = ComprehensiveSyntaxErrorFixer(root_dir)
    
    total_fixes = fixer.fix_all_remaining_syntax_errors()
    
    if fixer.fixes_applied:
        print(f"\nFILES SUCCESSFULLY FIXED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return total_fixes > 0

if __name__ == "__main__":
    main()