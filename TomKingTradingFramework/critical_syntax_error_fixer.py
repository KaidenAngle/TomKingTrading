#!/usr/bin/env python3
"""
CRITICAL SYNTAX ERROR FIXER
Systematically identifies and fixes ALL syntax errors preventing code execution
Following Implementation Audit Protocol - Zero Tolerance Approach
"""

import os
import ast
import re
from pathlib import Path
from typing import List, Dict, Tuple

class CriticalSyntaxErrorFixer:
    """Systematically fix all syntax errors with zero tolerance"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.syntax_errors = []
        self.fixes_applied = []
        
    def identify_and_fix_all_syntax_errors(self):
        """Identify and fix ALL syntax errors systematically"""
        print("CRITICAL SYNTAX ERROR FIXER")
        print("=" * 60)
        print("Zero tolerance approach - fixing ALL syntax errors")
        
        python_files = list(self.root_dir.rglob("*.py"))
        # Skip audit files to avoid interference
        python_files = [f for f in python_files if not self._should_skip_file(f)]
        
        print(f"Analyzing {len(python_files)} files for syntax errors...")
        
        # Phase 1: Identify ALL syntax errors
        for file_path in python_files:
            self._identify_syntax_errors(file_path)
        
        print(f"\nFound {len(self.syntax_errors)} files with syntax errors:")
        for error in self.syntax_errors:
            print(f"  - {error['file']}:{error['line']} - {error['type']}")
        
        # Phase 2: Fix each syntax error systematically
        print(f"\nFixing {len(self.syntax_errors)} syntax errors...")
        
        fixes_made = 0
        for error_info in self.syntax_errors:
            try:
                if self._fix_single_syntax_error(error_info):
                    fixes_made += 1
                    print(f"  [OK] Fixed: {error_info['file']}:{error_info['line']}")
                else:
                    print(f"  [FAIL] Failed: {error_info['file']}:{error_info['line']}")
            except Exception as e:
                print(f"  [ERROR] Error fixing {error_info['file']}: {e}")
        
        print(f"\nFixed {fixes_made}/{len(self.syntax_errors)} syntax errors")
        
        # Phase 3: Validate ALL files now parse correctly
        print("\nValidating all files parse correctly...")
        remaining_errors = 0
        for file_path in python_files:
            if not self._validate_syntax(file_path):
                remaining_errors += 1
        
        print(f"Validation complete: {remaining_errors} files still have syntax errors")
        
        return fixes_made, remaining_errors
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip audit and fixer files"""
        skip_patterns = ['audit', 'fixer', 'fix_']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _identify_syntax_errors(self, file_path: Path):
        """Identify syntax errors in a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try to parse the file
            try:
                ast.parse(content)
            except SyntaxError as e:
                self.syntax_errors.append({
                    'file': str(file_path.relative_to(self.root_dir)),
                    'full_path': file_path,
                    'line': e.lineno or 0,
                    'column': e.offset or 0,
                    'type': str(e.msg),
                    'text': e.text or '',
                    'content': content
                })
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    def _fix_single_syntax_error(self, error_info: Dict) -> bool:
        """Fix a single syntax error"""
        file_path = error_info['full_path']
        content = error_info['content']
        error_line = error_info['line']
        error_type = error_info['type']
        
        # Make a backup of original content
        original_content = content
        
        try:
            # Apply specific fixes based on error type
            if 'unterminated string literal' in error_type.lower():
                content = self._fix_unterminated_string(content, error_line)
            elif 'expected an indented block' in error_type.lower():
                content = self._fix_missing_indentation(content, error_line)
            elif 'invalid syntax' in error_type.lower() and 'comma' in error_type.lower():
                content = self._fix_missing_comma(content, error_line)
            elif 'unexpected eof' in error_type.lower():
                content = self._fix_unexpected_eof(content)
            elif 'invalid character' in error_type.lower():
                content = self._fix_invalid_character(content, error_line)
            else:
                # Generic syntax error fix
                content = self._fix_generic_syntax_error(content, error_line, error_type)
            
            # Validate the fix worked
            try:
                ast.parse(content)
                
                # Write the fixed content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                self.fixes_applied.append(f"{error_info['file']}:{error_line} - Fixed {error_type}")
                return True
                
            except SyntaxError:
                # Fix didn't work, restore original
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(original_content)
                return False
                
        except Exception as e:
            print(f"Error fixing {file_path}: {e}")
            # Restore original content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(original_content)
            return False
    
    def _fix_unterminated_string(self, content: str, error_line: int) -> str:
        """Fix unterminated string literals"""
        lines = content.split('\n')
        
        if error_line <= len(lines):
            line = lines[error_line - 1]
            
            # Look for common unterminated string patterns
            # Pattern 1: f"[MAIN] text without closing quote
            if re.search(r'f?"?\[.*?\]\s*[^"]*$', line):
                # Add closing quote and parenthesis if it looks like a logging call
                if line.strip().endswith('(f"') or 'self.Error(f"' in line or 'self.Log(f"' in line:
                    fixed_line = line + '")'
                elif '"' in line and line.count('"') % 2 == 1:
                    fixed_line = line + '"'
                else:
                    fixed_line = line
                    
                lines[error_line - 1] = fixed_line
        
        return '\n'.join(lines)
    
    def _fix_missing_indentation(self, content: str, error_line: int) -> str:
        """Fix missing indentation after control structures"""
        lines = content.split('\n')
        
        if error_line <= len(lines):
            # Look at the previous line to determine correct indentation
            prev_line_idx = error_line - 2
            if prev_line_idx >= 0:
                prev_line = lines[prev_line_idx]
                
                # If previous line ends with ':' it needs an indented block
                if prev_line.strip().endswith(':'):
                    # Determine indentation level
                    prev_indent = len(prev_line) - len(prev_line.lstrip())
                    proper_indent = ' ' * (prev_indent + 4)
                    
                    # If the current line is empty or only whitespace, add a pass statement
                    current_line = lines[error_line - 1] if error_line <= len(lines) else ''
                    
                    if not current_line.strip():
                        lines[error_line - 1] = proper_indent + 'pass'
                    elif not current_line.startswith(proper_indent):
                        # Fix indentation of existing content
                        content_stripped = current_line.strip()
                        if content_stripped:
                            lines[error_line - 1] = proper_indent + content_stripped
                        else:
                            lines[error_line - 1] = proper_indent + 'pass'
        
        return '\n'.join(lines)
    
    def _fix_missing_comma(self, content: str, error_line: int) -> str:
        """Fix missing comma in function calls or lists"""
        lines = content.split('\n')
        
        if error_line <= len(lines):
            line = lines[error_line - 1]
            
            # Common patterns where commas are missing
            # Pattern 1: Function arguments without commas
            if '(' in line and ')' in line:
                # Look for patterns like: func(arg1 arg2) -> func(arg1, arg2)
                fixed_line = re.sub(r'(\w+)\s+(\w+)(?=\s*[,)])', r'\1, \2', line)
                if fixed_line != line:
                    lines[error_line - 1] = fixed_line
        
        return '\n'.join(lines)
    
    def _fix_unexpected_eof(self, content: str) -> str:
        """Fix unexpected end of file (usually unclosed brackets)"""
        # Count brackets to find missing ones
        open_parens = content.count('(')
        close_parens = content.count(')')
        open_braces = content.count('{')
        close_braces = content.count('}')
        open_brackets = content.count('[')
        close_brackets = content.count(']')
        
        # Add missing closing brackets at the end
        additions = []
        if open_parens > close_parens:
            additions.extend([')'] * (open_parens - close_parens))
        if open_braces > close_braces:
            additions.extend(['}'] * (open_braces - close_braces))
        if open_brackets > close_brackets:
            additions.extend([']'] * (open_brackets - close_brackets))
        
        if additions:
            content += ''.join(additions)
        
        return content
    
    def _fix_invalid_character(self, content: str, error_line: int) -> str:
        """Fix invalid characters in the source"""
        lines = content.split('\n')
        
        if error_line <= len(lines):
            line = lines[error_line - 1]
            
            # Remove common invalid characters
            invalid_chars = ['\u2013', '\u2014', '\u2018', '\u2019', '\u201c', '\u201d']
            fixed_line = line
            
            for char in invalid_chars:
                if char in fixed_line:
                    if char in ['\u2018', '\u2019']:  # Smart quotes
                        fixed_line = fixed_line.replace(char, "'")
                    elif char in ['\u201c', '\u201d']:  # Smart double quotes
                        fixed_line = fixed_line.replace(char, '"')
                    elif char in ['\u2013', '\u2014']:  # Em/en dashes
                        fixed_line = fixed_line.replace(char, '-')
            
            lines[error_line - 1] = fixed_line
        
        return '\n'.join(lines)
    
    def _fix_generic_syntax_error(self, content: str, error_line: int, error_type: str) -> str:
        """Fix generic syntax errors"""
        lines = content.split('\n')
        
        if error_line <= len(lines):
            line = lines[error_line - 1]
            
            # Common generic fixes
            # Fix 1: Remove duplicate colons
            if '::' in line:
                lines[error_line - 1] = line.replace('::', ':')
            
            # Fix 2: Fix malformed f-strings
            elif 'f"' in line and line.count('"') % 2 == 1:
                lines[error_line - 1] = line + '"'
            
            # Fix 3: Fix misplaced operators
            elif line.strip().startswith(('and ', 'or ', 'not ')):
                # These shouldn't be at the beginning of a line
                if error_line > 1:
                    # Move to end of previous line
                    lines[error_line - 2] += ' ' + line.strip()
                    lines[error_line - 1] = ''
        
        return '\n'.join(lines)
    
    def _validate_syntax(self, file_path: Path) -> bool:
        """Validate that a file has no syntax errors"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            ast.parse(content)
            return True
        except SyntaxError:
            return False
        except Exception:
            return False

def main():
    """Fix all critical syntax errors"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = CriticalSyntaxErrorFixer(root_dir)
    
    fixes_made, remaining_errors = fixer.identify_and_fix_all_syntax_errors()
    
    print(f"\n{'='*60}")
    print("CRITICAL SYNTAX ERROR FIXING COMPLETE")
    print(f"{'='*60}")
    print(f"Fixes applied: {fixes_made}")
    print(f"Remaining errors: {remaining_errors}")
    
    if fixer.fixes_applied:
        print(f"\nFIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    success = remaining_errors == 0
    print(f"\nResult: {'SUCCESS - All syntax errors fixed' if success else 'PARTIAL - Some errors remain'}")
    
    return success

if __name__ == "__main__":
    main()