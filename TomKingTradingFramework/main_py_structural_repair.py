#!/usr/bin/env python3
"""
MAIN.PY STRUCTURAL REPAIR TOOL
Systematically fix all malformed try-except structures and indentation issues in main.py
Zero-tolerance approach for critical framework file
"""

import re
import ast
from pathlib import Path

class MainPyStructuralRepair:
    """Specialized repair tool for main.py structural issues"""
    
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.content = ""
        self.lines = []
        self.issues_found = []
        self.fixes_applied = 0
        
    def load_file(self):
        """Load the main.py file content"""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                self.content = f.read()
                self.lines = self.content.splitlines()
            print(f"[MAIN-REPAIR] Loaded {len(self.lines)} lines from {self.file_path}")
            return True
        except Exception as e:
            print(f"[MAIN-REPAIR] Failed to load file: {e}")
            return False
    
    def scan_for_structural_issues(self):
        """Scan for all structural issues in main.py"""
        self.issues_found = []
        
        # Pattern 1: Empty try blocks
        empty_try_pattern = re.compile(r'^(\s*)try:\s*$')
        
        # Pattern 2: Orphaned except clauses
        except_pattern = re.compile(r'^(\s*)except\s+.*:\s*$')
        
        # Pattern 3: Function definitions with wrong indentation
        func_def_pattern = re.compile(r'^(\s{4,})def\s+\w+\(.*\):\s*$')
        
        # Pattern 4: Missing indentation after control structures
        control_structures = ['try:', 'except:', 'if ', 'for ', 'while ', 'def ', 'class ']
        
        for i, line in enumerate(self.lines):
            line_num = i + 1
            
            # Check for empty try blocks
            if empty_try_pattern.match(line):
                # Check if next non-empty line is an except or has wrong indentation
                next_line_idx = i + 1
                while next_line_idx < len(self.lines) and not self.lines[next_line_idx].strip():
                    next_line_idx += 1
                
                if next_line_idx < len(self.lines):
                    next_line = self.lines[next_line_idx]
                    if (except_pattern.match(next_line) or 
                        not next_line.startswith('    ' + line.split('try:')[0] + '    ')):
                            self.issues_found.append({
                            'type': 'empty_try_block',
                            'line': line_num,
                            'content': line.strip(),
                            'description': 'Empty try block with malformed structure'
                        })
            
            # Check for indentation issues after control structures
            for control in control_structures:
                if control in line and line.strip().endswith(':'):
                    # Check next non-empty line indentation
                    next_line_idx = i + 1
                    while next_line_idx < len(self.lines) and not self.lines[next_line_idx].strip():
                        next_line_idx += 1
                    
                    if next_line_idx < len(self.lines):
                        current_indent = len(line) - len(line.lstrip())
                        next_line = self.lines[next_line_idx]
                        next_indent = len(next_line) - len(next_line.lstrip())
                        
                        # For control structures, next line should be indented more
                        if next_indent <= current_indent and not next_line.strip().startswith(('except', 'elif', 'else', 'finally')):
                            self.issues_found.append({
                                'type': 'indentation_error',
                                'line': line_num,
                                'next_line': next_line_idx + 1,
                                'content': line.strip(),
                                'next_content': next_line.strip(),
                                'description': f'Missing indentation after {control.strip()}'
                            })
            
            # Check for duplicate except clauses
            if except_pattern.match(line):
                # Look for another except clause immediately following
                next_line_idx = i + 1
                if next_line_idx < len(self.lines) and except_pattern.match(self.lines[next_line_idx]):
                    self.issues_found.append({
                        'type': 'duplicate_except',
                        'line': line_num,
                        'next_line': next_line_idx + 1,
                        'content': line.strip(),
                        'description': 'Duplicate except clauses'
                    })
        
        print(f"[MAIN-REPAIR] Found {len(self.issues_found)} structural issues")
        return len(self.issues_found)
    
    def apply_systematic_repairs(self):
        """Apply systematic repairs to all identified issues"""
        self.fixes_applied = 0
        
        # Work backwards through the file to avoid line number shifts
        for issue in reversed(self.issues_found):
            if issue['type'] == 'empty_try_block':
                self._fix_empty_try_block(issue)
            elif issue['type'] == 'indentation_error':
                self._fix_indentation_error(issue)
            elif issue['type'] == 'duplicate_except':
                self._fix_duplicate_except(issue)
        
        # Apply common structural fixes
        self._fix_common_patterns()
        
        print(f"[MAIN-REPAIR] Applied {self.fixes_applied} systematic repairs")
    
    def _fix_empty_try_block(self, issue):
        """Fix empty try blocks by adding proper content or removing"""
        line_idx = issue['line'] - 1
        
        # Find the matching except block
        except_idx = -1
        for i in range(line_idx + 1, len(self.lines)):
            if 'except' in self.lines[i]:
                except_idx = i
                break
        
        if except_idx > 0:
            # Add a pass statement to the try block
            indent = len(self.lines[line_idx]) - len(self.lines[line_idx].lstrip())
            self.lines.insert(line_idx + 1, ' ' * (indent + 4) + 'pass')
            self.fixes_applied += 1
    
    def _fix_indentation_error(self, issue):
        """Fix indentation errors by adjusting subsequent lines"""
        line_idx = issue['line'] - 1
        next_line_idx = issue['next_line'] - 1
        
        if next_line_idx < len(self.lines):
            current_line = self.lines[line_idx]
            next_line = self.lines[next_line_idx]
            
            current_indent = len(current_line) - len(current_line.lstrip())
            expected_indent = current_indent + 4
            
            # Fix the indentation of the next line
            stripped_content = next_line.lstrip()
            if stripped_content:  # Don't fix empty lines
                self.lines[next_line_idx] = ' ' * expected_indent + stripped_content
                self.fixes_applied += 1
    
    def _fix_duplicate_except(self, issue):
        """Fix duplicate except clauses"""
        line_idx = issue['line'] - 1
        next_line_idx = issue['next_line'] - 1
        
        # Remove the duplicate except clause
        if next_line_idx < len(self.lines):
            del self.lines[next_line_idx]
            self.fixes_applied += 1
    
    def _fix_common_patterns(self):
        """Fix common structural patterns found in main.py"""
        
        # Pattern 1: Fix function definitions with wrong indentation
        for i, line in enumerate(self.lines):
            if re.match(r'^(\s{8,})def\s+\w+\(.*\):\s*$', line):
                # Function definitions should be at class level (4 spaces) or module level (0 spaces)
                if 'def initialize_' in line or 'def OnData' in line or 'def OnEndOfDay' in line:
                    # These are method definitions, should be at 4 spaces
                    stripped = line.lstrip()
                    self.lines[i] = '    ' + stripped
                    self.fixes_applied += 1
        
        # Pattern 2: Fix orphaned code blocks
        orphan_patterns = [
            r'^\s*# Log and handle unexpected exception\s*$',
            r'^\s*print\(f\'Unexpected exception: \{e\}\'\)\s*$',
            r'^\s*raise\s*$'
        ]
        
        for i in range(len(self.lines) - 1, -1, -1):  # Reverse iteration for safe deletion
            line = self.lines[i]
            for pattern in orphan_patterns:
                if re.match(pattern, line):
                    # Check if this line is orphaned (not properly indented within a block)
                    if i > 0 and not self._is_properly_nested(i):
                        del self.lines[i]
                        self.fixes_applied += 1
                        break
    
    def _is_properly_nested(self, line_idx):
        """Check if a line is properly nested within a control structure"""
        if line_idx <= 0:
            return True
        
        current_indent = len(self.lines[line_idx]) - len(self.lines[line_idx].lstrip())
        
        # Look backwards for the controlling structure
        for i in range(line_idx - 1, max(-1, line_idx - 10), -1):
            prev_line = self.lines[i]
            if prev_line.strip() and prev_line.strip().endswith(':'):
                prev_indent = len(prev_line) - len(prev_line.lstrip())
                return current_indent > prev_indent
        
        return False
    
    def save_file(self):
        """Save the repaired file"""
        try:
            repaired_content = '\n'.join(self.lines)
            with open(self.file_path, 'w', encoding='utf-8') as f:
                f.write(repaired_content)
            print(f"[MAIN-REPAIR] Saved repaired file: {self.file_path}")
            return True
        except Exception as e:
            print(f"[MAIN-REPAIR] Failed to save file: {e}")
            return False
    
    def validate_syntax(self):
        """Validate the syntax of the repaired file"""
        try:
            repaired_content = '\n'.join(self.lines)
            ast.parse(repaired_content)
            print(f"[MAIN-REPAIR] ✅ Syntax validation PASSED")
            return True
        except SyntaxError as e:
            print(f"[MAIN-REPAIR] ❌ Syntax validation FAILED: {e}")
            print(f"[MAIN-REPAIR] Error at line {e.lineno}: {e.text}")
            return False
        except Exception as e:
            print(f"[MAIN-REPAIR] ❌ Validation error: {e}")
            return False

def main():
    """Execute comprehensive structural repair of main.py"""
    print("=" * 80)
    print("MAIN.PY STRUCTURAL REPAIR - ZERO-TOLERANCE APPROACH")
    print("=" * 80)
    
    main_py_path = "D:/OneDrive/Trading/Claude/TomKingTradingFramework/main.py"
    
    # Initialize repair tool
    repair_tool = MainPyStructuralRepair(main_py_path)
    
    # Load file
    if not repair_tool.load_file():
        return False
    
    # Scan for issues
    issue_count = repair_tool.scan_for_structural_issues()
    if issue_count == 0:
        print("[MAIN-REPAIR] No structural issues found")
        return True
    
    # Show sample issues
    print("\n[MAIN-REPAIR] Sample issues found:")
    for issue in repair_tool.issues_found[:5]:  # Show first 5
        print(f"  Line {issue['line']}: {issue['type']} - {issue['description']}")
    
    if len(repair_tool.issues_found) > 5:
        print(f"  ... and {len(repair_tool.issues_found) - 5} more issues")
    
    # Apply repairs
    print(f"\n[MAIN-REPAIR] Applying systematic repairs to {issue_count} issues...")
    repair_tool.apply_systematic_repairs()
    
    # Validate syntax before saving
    if repair_tool.validate_syntax():
        # Save repaired file
        if repair_tool.save_file():
            print(f"\n[MAIN-REPAIR] ✅ MAIN.PY STRUCTURAL REPAIR COMPLETE")
            print(f"[MAIN-REPAIR] Fixed {repair_tool.fixes_applied} structural issues")
            return True
    else:
        print(f"\n[MAIN-REPAIR] ❌ Repairs failed syntax validation - not saving")
    
    return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)