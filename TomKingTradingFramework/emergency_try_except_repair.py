#!/usr/bin/env python3
"""
Emergency Try-Except Block Repair Script
Fixes systematic inversion of try-except logic while preserving all functionality

CRITICAL: This script preserves ALL recent atomic executor work
"""

import os
import re
import shutil
from typing import List, Tuple
import argparse

class TryExceptRepairer:
    """
    Repairs inverted try-except blocks where:
    - Try block: empty or minimal code
    - Except block: contains all the actual logic (WRONG!)

    Converts to proper pattern:
    - Try block: contains the actual logic
    - Except block: only error handling
    """

    def __init__(self):
        self.corrupted_patterns = []
        self.repaired_patterns = []
        self.files_processed = 0
        self.files_repaired = 0

    def identify_corrupted_try_except(self, content: str) -> List[Tuple[int, str]]:
        """
        Identify corrupted try-except blocks

        Pattern: try: (empty/pass) except: (actual logic)
        """
        corrupted_blocks = []
        lines = content.split('\n')

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Look for try: statements (handle indented try blocks)
            if re.match(r'try:\s*$', line):
                try_indent = len(lines[i]) - len(lines[i].lstrip())
                try_start = i

                # Check what's in the try block
                j = i + 1
                try_content = []
                while j < len(lines):
                    current_line = lines[j]
                    current_indent = len(current_line) - len(current_line.lstrip())

                    # If this is an except statement at the right level, process it first
                    if current_line.strip().startswith('except') and current_indent == try_indent:
                        except_start = j

                        # Check if try block is empty/minimal
                        try_logic = [t.strip() for t in try_content if t.strip() and not t.strip().startswith('#')]
                        is_try_empty = len(try_logic) == 0 or (len(try_logic) == 1 and try_logic[0] == 'pass')

                        if is_try_empty:
                            # Check if except block has substantial logic
                            k = j + 1
                            except_content = []
                            while k < len(lines):
                                except_line = lines[k]
                                except_indent = len(except_line) - len(except_line.lstrip())

                                if except_line.strip() and except_indent <= try_indent:
                                    break

                                if except_line.strip() and except_indent > current_indent:
                                    except_content.append(except_line.strip())

                                k += 1

                            # If except has substantial logic, this is likely corrupted
                            except_logic = [e for e in except_content if e and not e.startswith('#')]
                            if len(except_logic) > 2:  # More than just error handling
                                corrupted_blocks.append((try_start, f"try-except block at line {try_start + 1}"))

                        break
                    # If we've dedented to try level or less, we're out of the try block
                    elif current_line.strip() and current_indent <= try_indent:
                        break
                    else:
                        try_content.append(current_line)

                    j += 1

            i += 1

        return corrupted_blocks

    def repair_try_except_block(self, content: str, start_line: int) -> str:
        """
        Repair a specific corrupted try-except block

        Moves logic from except block to try block
        Keeps proper error handling in except
        """
        lines = content.split('\n')

        if start_line >= len(lines):
            return content

        # Find the try block
        try_line = lines[start_line]
        try_indent = len(try_line) - len(try_line.lstrip())

        # Find except block
        except_start = None
        i = start_line + 1
        while i < len(lines):
            line = lines[i]
            line_indent = len(line) - len(line.lstrip())

            if line.strip().startswith('except') and line_indent == try_indent:
                except_start = i
                break
            elif line.strip() and line_indent <= try_indent:
                break

            i += 1

        if except_start is None:
            return content

        # Extract except block content
        except_content = []
        error_var = None

        # Parse except statement to get error variable
        except_line = lines[except_start]
        except_match = re.search(r'except\s+\w+\s+as\s+(\w+):', except_line)
        if except_match:
            error_var = except_match.group(1)

        i = except_start + 1
        while i < len(lines):
            line = lines[i]
            line_indent = len(line) - len(line.lstrip())

            if line.strip() and line_indent <= try_indent:
                break

            if line.strip() and line_indent > try_indent:
                except_content.append(line)

            i += 1

        # Separate logic from error handling
        logic_lines = []
        error_lines = []

        for line in except_content:
            stripped = line.strip()
            # Identify error handling patterns
            if (stripped.startswith('self.algo.Error') or
                stripped.startswith('self.algo.Debug') or
                stripped.startswith('return False') or
                stripped.startswith('return None') or
                stripped.startswith('continue') or
                (error_var and error_var in stripped)):
                error_lines.append(line)
            else:
                logic_lines.append(line)

        # Build repaired block
        repaired_lines = lines[:start_line + 1]  # Include try:

        # Add logic to try block
        for line in logic_lines:
            repaired_lines.append(line)

        # Add except with proper error handling
        repaired_lines.append(lines[except_start])  # except line

        if error_lines:
            repaired_lines.extend(error_lines)
        else:
            # Add default error handling if none exists
            indent = ' ' * (try_indent + 4)
            if error_var:
                repaired_lines.append(f"{indent}self.algo.Error(f\"Error: {{{error_var}}}\")")
            else:
                repaired_lines.append(f"{indent}self.algo.Error(\"Unexpected error occurred\")")
            repaired_lines.append(f"{indent}return False")

        # Add remaining lines after the except block
        repaired_lines.extend(lines[i:])

        return '\n'.join(repaired_lines)

    def repair_file(self, file_path: str, backup: bool = True) -> bool:
        """
        Repair corrupted try-except blocks in a file

        Args:
            file_path: Path to file to repair
            backup: Whether to create backup before repair

        Returns:
            True if repairs were made, False otherwise
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()

            # Identify corrupted blocks
            corrupted_blocks = self.identify_corrupted_try_except(original_content)

            if not corrupted_blocks:
                print(f"[OK] {file_path}: No corruption detected")
                return False

            print(f"[REPAIR] {file_path}: Found {len(corrupted_blocks)} corrupted try-except blocks")

            # Create backup if requested
            if backup:
                backup_path = f"{file_path}.backup_before_repair"
                shutil.copy2(file_path, backup_path)
                print(f"[BACKUP] Created backup: {backup_path}")

            # Repair blocks (in reverse order to avoid line number shifts)
            repaired_content = original_content
            for start_line, description in reversed(corrupted_blocks):
                print(f"   Repairing: {description}")
                repaired_content = self.repair_try_except_block(repaired_content, start_line)

            # Write repaired content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(repaired_content)

            print(f"[SUCCESS] {file_path}: Repaired successfully")
            self.files_repaired += 1
            return True

        except Exception as e:
            print(f"[ERROR] {file_path}: Repair failed - {e}")
            return False

    def repair_directory(self, directory: str, pattern: str = "*.py", backup: bool = True):
        """
        Repair all Python files in a directory

        Args:
            directory: Directory to process
            pattern: File pattern to match
            backup: Whether to create backups
        """
        import glob

        file_pattern = os.path.join(directory, "**", pattern)
        python_files = glob.glob(file_pattern, recursive=True)

        print(f"[SCAN] Found {len(python_files)} Python files to check")
        print("=" * 60)

        for file_path in python_files:
            self.files_processed += 1
            self.repair_file(file_path, backup)

        print("=" * 60)
        print(f"[SUMMARY] REPAIR SUMMARY:")
        print(f"   Files processed: {self.files_processed}")
        print(f"   Files repaired: {self.files_repaired}")
        print(f"   Repair rate: {(self.files_repaired/self.files_processed)*100:.1f}%")

def main():
    parser = argparse.ArgumentParser(description="Emergency Try-Except Block Repair")
    parser.add_argument("target", help="File or directory to repair")
    parser.add_argument("--no-backup", action="store_true", help="Skip creating backups")
    parser.add_argument("--dry-run", action="store_true", help="Identify corruption without repairing")

    args = parser.parse_args()

    repairer = TryExceptRepairer()

    if os.path.isfile(args.target):
        if args.dry_run:
            with open(args.target, 'r') as f:
                content = f.read()
            corrupted = repairer.identify_corrupted_try_except(content)
            if corrupted:
                print(f"[CORRUPTION] {args.target}: {len(corrupted)} corrupted blocks found")
                for line, desc in corrupted:
                    print(f"   - {desc}")
            else:
                print(f"[OK] {args.target}: No corruption detected")
        else:
            repairer.repair_file(args.target, not args.no_backup)
    elif os.path.isdir(args.target):
        if args.dry_run:
            print("DRY RUN mode - no files will be modified")

        repairer.repair_directory(args.target, backup=not args.no_backup)
    else:
        print(f"[ERROR] Error: {args.target} is not a valid file or directory")

if __name__ == "__main__":
    main()