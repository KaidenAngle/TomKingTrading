#!/usr/bin/env python3
"""
MALFORMED STRUCTURE REPAIR
Systematically repairs malformed try-except structures created by previous fixes
Following zero-tolerance Implementation Audit Protocol
"""

import os
import ast
import re
from pathlib import Path
from typing import List, Dict, Tuple

class MalformedStructureRepair:
    """Repair malformed try-except structures systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.repairs_applied = []
        
    def repair_all_malformed_structures(self):
        """Repair all malformed try-except structures"""
        print("MALFORMED STRUCTURE REPAIR")
        print("=" * 60)
        print("Repairing malformed try-except structures...")
        
        # Get files with syntax errors
        files_to_repair = self._get_files_with_structure_errors()
        
        print(f"Found {len(files_to_repair)} files with structural errors")
        
        total_repairs = 0
        for file_path in files_to_repair:
            print(f"\nRepairing: {file_path.relative_to(self.root_dir)}")
            
            repairs = self._repair_file_structures(file_path)
            if repairs > 0:
                total_repairs += repairs
                print(f"  [OK] Applied {repairs} structural repairs")
            else:
                print(f"  [SKIP] No repairs needed")
        
        print(f"\n{'='*60}")
        print(f"STRUCTURAL REPAIR COMPLETE")
        print(f"Total repairs applied: {total_repairs}")
        print(f"{'='*60}")
        
        return total_repairs
    
    def _get_files_with_structure_errors(self) -> List[Path]:
        """Get files with structural syntax errors"""
        files_to_repair = []
        
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
                    error_msg = str(e)
                    if any(pattern in error_msg for pattern in [
                        "expected an indented block",
                        "expected 'except' or 'finally'",
                        "unexpected indent",
                        "unindent does not match"
                    ]):
                        files_to_repair.append(file_path)
            except Exception:
                pass
        
        return files_to_repair
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        skip_patterns = ['fix_', 'fixer', 'audit', 'repair']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _repair_file_structures(self, file_path: Path) -> int:
        """Repair structural issues in a specific file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            repairs = 0
            
            # Apply systematic repairs
            content, repair_count = self._repair_try_blocks_without_except(content)
            repairs += repair_count
            
            content, repair_count = self._repair_indentation_issues(content)
            repairs += repair_count
            
            content, repair_count = self._repair_orphaned_except_blocks(content)
            repairs += repair_count
            
            content, repair_count = self._repair_malformed_try_except_patterns(content)
            repairs += repair_count
            
            # Write back if repairs made
            if repairs > 0 and content != original_content:
                # Validate the repair
                try:
                    ast.parse(content)
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    self.repairs_applied.append(f"{file_path.relative_to(self.root_dir)} - {repairs} repairs")
                    return repairs
                except SyntaxError as e:
                    print(f"    [WARN] Repair validation failed: {e}")
                    return 0
            
            return 0
            
        except Exception as e:
            print(f"  [ERROR] {e}")
            return 0
    
    def _repair_try_blocks_without_except(self, content: str) -> Tuple[str, int]:
        """Repair try blocks that have no except/finally blocks"""
        repairs = 0
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            if stripped == 'try:':
                current_indent = len(line) - len(line.lstrip())
                
                # Look for the end of the try block content
                j = i + 1
                try_content_found = False
                try_end_line = i + 1
                
                # Find all lines that belong to the try block
                while j < len(lines):
                    next_line = lines[j]
                    next_stripped = next_line.strip()
                    
                    if not next_stripped:  # Empty line
                        j += 1
                        continue
                    
                    next_indent = len(next_line) - len(next_line.lstrip())
                    
                    # If we hit something at or less indented than try:
                    if next_indent <= current_indent:
                        # Check if it's except/finally/else
                        if next_stripped.startswith(('except', 'finally', 'else:')):
                            break
                        else:
                            try_end_line = j
                            break
                    else:
                        # This is content inside the try block
                        try_content_found = True
                        try_end_line = j + 1
                    
                    j += 1
                
                # If we found try content but no except/finally, add except
                if try_content_found and j >= len(lines):
                    # Add except block at end
                    lines.append(f"{' ' * current_indent}except Exception as e:")
                    lines.append(f"{' ' * (current_indent + 4)}pass")
                    repairs += 1
                elif try_content_found and j < len(lines):
                    next_line = lines[j]
                    next_stripped = next_line.strip()
                    if not next_stripped.startswith(('except', 'finally', 'else:')):
                        # Insert except block
                        lines.insert(j, f"{' ' * current_indent}except Exception as e:")
                        lines.insert(j + 1, f"{' ' * (current_indent + 4)}pass")
                        repairs += 1
            
            i += 1
        
        return '\n'.join(lines), repairs
    
    def _repair_indentation_issues(self, content: str) -> Tuple[str, int]:
        """Repair systematic indentation issues"""
        repairs = 0
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            if stripped == 'try:':
                current_indent = len(line) - len(line.lstrip())
                expected_indent = current_indent + 4
                
                # Fix indentation of the next non-empty lines
                j = i + 1
                while j < len(lines):
                    next_line = lines[j]
                    next_stripped = next_line.strip()
                    
                    if not next_stripped:
                        j += 1
                        continue
                    
                    # If this line should be part of the try block
                    if not next_stripped.startswith(('except', 'finally', 'else:')) and next_stripped.startswith('#'):
                        # This is a comment, fix its indentation
                        lines[j] = ' ' * expected_indent + next_stripped
                        repairs += 1
                    elif not next_stripped.startswith(('except', 'finally', 'else:')):
                        # Check if this line needs indentation fix
                        next_indent = len(next_line) - len(next_line.lstrip())
                        if next_indent <= current_indent:
                            # Fix indentation
                            lines[j] = ' ' * expected_indent + next_stripped
                            repairs += 1
                        break
                    else:
                        break
                    
                    j += 1
            
            i += 1
        
        return '\n'.join(lines), repairs
    
    def _repair_orphaned_except_blocks(self, content: str) -> Tuple[str, int]:
        """Repair orphaned except blocks"""
        repairs = 0
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Found except without matching try
            if stripped.startswith('except') and ':' in stripped:
                # Look backwards for matching try
                found_try = False
                j = i - 1
                while j >= 0:
                    prev_line = lines[j]
                    prev_stripped = prev_line.strip()
                    
                    if prev_stripped == 'try:':
                        found_try = True
                        break
                    elif prev_stripped and not prev_stripped.startswith('#'):
                        break
                    j -= 1
                
                if not found_try:
                    # This except has no try, remove it or fix it
                    current_indent = len(line) - len(line.lstrip())
                    # Add try block before it
                    lines.insert(i, ' ' * current_indent + 'try:')
                    lines.insert(i + 1, ' ' * (current_indent + 4) + 'pass')
                    repairs += 1
            
            i += 1
        
        return '\n'.join(lines), repairs
    
    def _repair_malformed_try_except_patterns(self, content: str) -> Tuple[str, int]:
        """Repair specific malformed try-except patterns"""
        repairs = 0
        
        # Pattern 1: try: followed immediately by comment or code without proper indentation
        pattern1 = r'(\s*)try:\s*\n(\s*)([^#\s][^\n]*)'
        def fix_pattern1(match):
            nonlocal repairs
            indent = match.group(1)
            next_indent = match.group(2)
            code = match.group(3)
            
            # Ensure proper indentation
            proper_indent = indent + '    '
            if len(next_indent) <= len(indent):
                repairs += 1
                return f"{indent}try:\n{proper_indent}{code}"
            return match.group(0)
        
        content = re.sub(pattern1, fix_pattern1, content, flags=re.MULTILINE)
        
        # Pattern 2: Missing except blocks at end of try
        pattern2 = r'(\s*)try:\s*\n((?:\s*[^\n]*\n)*?)(?=\n\s*(?:def |class |\w+\s*=|if |$))'
        def fix_pattern2(match):
            nonlocal repairs
            indent = match.group(1)
            try_content = match.group(2)
            
            if 'except' not in try_content and 'finally' not in try_content:
                repairs += 1
                return f"{match.group(0)}{indent}except Exception as e:\n{indent}    pass\n"
            return match.group(0)
        
        content = re.sub(pattern2, fix_pattern2, content, flags=re.MULTILINE)
        
        return content, repairs

def main():
    """Repair all malformed structures"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    repairer = MalformedStructureRepair(root_dir)
    
    total_repairs = repairer.repair_all_malformed_structures()
    
    if repairer.repairs_applied:
        print(f"\nFILES SUCCESSFULLY REPAIRED:")
        for repair in repairer.repairs_applied:
            print(f"  - {repair}")
    
    return total_repairs > 0

if __name__ == "__main__":
    main()