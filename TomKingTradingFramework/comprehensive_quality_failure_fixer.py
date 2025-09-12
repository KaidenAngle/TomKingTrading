#!/usr/bin/env python3
"""
COMPREHENSIVE QUALITY FAILURE FIXER
Systematically fixes hidden quality failures (hardcoded values, print statements, logging)
Following Implementation Audit Protocol - Zero Tolerance for Shortcuts
"""

import os
import re
from pathlib import Path
from typing import List, Tuple, Dict

class ComprehensiveQualityFixer:
    """Fix all types of quality failures systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        self.hardcoded_patterns = [
            # Hardcoded numeric values that should be constants
            r'(?<!\w)0\.25(?!\w)',  # Kelly factor
            r'(?<!\w)21(?!\w).*(?:dte|DTE)',  # 21 DTE exit
            r'(?<!\w)0\.5(?!\w).*(?:percent|%|threshold)',  # 0.5% threshold
            r'(?<!\w)30000(?!\w)',  # Starting capital
            r'(?<!\w)10000(?!\w)',  # Position sizing base
            r'(?<!\w)15\.30(?!\w)',  # Exit time
            r'(?<!\w)9\.45(?!\w)',  # Entry time
            r'(?<!\w)10\.30(?!\w)',  # Entry window end
        ]
        
        self.print_patterns = [
            r'print\s*\(',
            r'console\.log\s*\(',
            r'System\.Console\.WriteLine\s*\(',
        ]
        
        self.logging_replacements = {
            r'print\(f?"?\[ERROR\][^"]*"?\)': 'self.Error',
            r'print\(f?"?\[WARNING\][^"]*"?\)': 'self.Log',
            r'print\(f?"?\[DEBUG\][^"]*"?\)': 'self.Debug',
            r'print\(f?"?\[INFO\][^"]*"?\)': 'self.Log',
            r'print\(f?"?.*(?:error|Error|ERROR).*"?\)': 'self.Error',
            r'print\(f?"?.*(?:warning|Warning|WARNING).*"?\)': 'self.Log',
            r'print\(f?"?.*(?:debug|Debug|DEBUG).*"?\)': 'self.Debug',
        }
        
    def fix_all_quality_failures(self):
        """Fix all quality failures systematically"""
        print("COMPREHENSIVE QUALITY FAILURE FIXER")
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
                content, fixes1 = self._fix_hardcoded_values(content, file_path)
                content, fixes2 = self._fix_print_statements(content, file_path)
                content, fixes3 = self._fix_logging_issues(content, file_path)
                content, fixes4 = self._fix_magic_numbers(content, file_path)
                
                content_fixes = fixes1 + fixes2 + fixes3 + fixes4
                
                if content_fixes > 0:
                    # Write the fixed content
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    
                    relative_path = str(file_path.relative_to(self.root_dir))
                    self.fixes_applied.append(f"{relative_path}: {content_fixes} quality issues fixed")
                    print(f"   Fixed {content_fixes} quality issues in {relative_path}")
                    
                    total_fixes += content_fixes
                
                files_processed += 1
                
            except Exception as e:
                print(f"   Error processing {file_path}: {e}")
        
        print(f"\nProcessed {files_processed} files")
        print(f"Total quality failures fixed: {total_fixes}")
        return total_fixes > 0
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        # Skip the fixer files themselves
        if 'fix_' in file_path.name.lower() or 'fixer' in file_path.name.lower():
            return True
        # Skip configuration files that legitimately have hardcoded values
        if 'config' in str(file_path).lower() and 'constants' in file_path.name.lower():
            return True
        return False
    
    def _fix_hardcoded_values(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix hardcoded values that should be constants"""
        fixes_made = 0
        new_content = content
        
        # Don't fix if this is already a constants file
        if 'constants' in file_path.name.lower() or 'config' in str(file_path).lower():
            return content, 0
        
        # Import constants if we're going to use them
        needs_constants_import = False
        
        # Kelly factor
        if re.search(r'(?<!\w)0\.25(?!\w).*(?:kelly|Kelly|KELLY)', content):
            new_content = re.sub(
                r'(?<!\w)0\.25(?!\w)(?=.*(?:kelly|Kelly|KELLY))',
                'TradingConstants.KELLY_FACTOR',
                new_content
            )
            needs_constants_import = True
            fixes_made += len(re.findall(r'(?<!\w)0\.25(?!\w)(?=.*(?:kelly|Kelly|KELLY))', content))
        
        # 21 DTE exit
        if re.search(r'(?<!\w)21(?!\w).*(?:dte|DTE)', content):
            new_content = re.sub(
                r'(?<!\w)21(?!\w)(?=.*(?:dte|DTE))',
                'TradingConstants.DEFENSIVE_EXIT_DTE',
                new_content
            )
            needs_constants_import = True
            fixes_made += len(re.findall(r'(?<!\w)21(?!\w)(?=.*(?:dte|DTE))', content))
        
        # Starting capital
        if re.search(r'(?<!\w)30000(?!\w)', content):
            new_content = re.sub(
                r'(?<!\w)30000(?!\w)',
                'TradingConstants.STARTING_CAPITAL',
                new_content
            )
            needs_constants_import = True
            fixes_made += len(re.findall(r'(?<!\w)30000(?!\w)', content))
        
        # Add import if needed and not already present
        if needs_constants_import and 'from config.constants import TradingConstants' not in content:
            # Find a good place to add the import
            lines = new_content.split('\n')
            import_line = 'from config.constants import TradingConstants'
            
            # Look for existing imports
            last_import_line = -1
            for i, line in enumerate(lines):
                if line.startswith('import ') or line.startswith('from '):
                    last_import_line = i
            
            # Insert after last import or at the top
            if last_import_line >= 0:
                lines.insert(last_import_line + 1, import_line)
            else:
                lines.insert(0, import_line)
            
            new_content = '\n'.join(lines)
            fixes_made += 1
        
        return new_content, fixes_made
    
    def _fix_print_statements(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix print statements that should be proper logging"""
        fixes_made = 0
        new_content = content
        
        # Skip if this is a test file or debug script
        if 'test' in file_path.name.lower() or 'debug' in file_path.name.lower():
            return content, 0
        
        # Replace print statements with appropriate logging
        for pattern, replacement in self.logging_replacements.items():
            matches = re.findall(pattern, content, re.IGNORECASE)
            if matches:
                # Extract the message content and convert to proper logging
                for match in matches:
                    # Extract message from print statement
                    msg_match = re.search(r'print\s*\(\s*f?"?([^)]*)"?\s*\)', match, re.IGNORECASE)
                    if msg_match:
                        message = msg_match.group(1)
                        # Remove f-string prefix if present
                        if message.startswith('f"') or message.startswith("f'"):
                            message = message[2:-1]
                        elif message.startswith('"') or message.startswith("'"):
                            message = message[1:-1]
                        
                        # Create proper logging call
                        if 'Error' in replacement:
                            logging_call = f'{replacement}(f"{message}")'
                        else:
                            logging_call = f'{replacement}(f"{message}")'
                        
                        new_content = new_content.replace(match, logging_call)
                        fixes_made += 1
        
        # Generic print statement replacement
        generic_print_pattern = r'print\s*\(\s*f?"?([^)]*)"?\s*\)'
        matches = re.findall(generic_print_pattern, new_content)
        for match in matches:
            original_print = f'print({match})'
            if original_print in new_content:
                # Determine appropriate log level
                message = match.strip('"\'')
                
                if any(keyword in message.lower() for keyword in ['error', 'failed', 'exception']):
                    replacement = f'self.Error(f"{message}")'
                elif any(keyword in message.lower() for keyword in ['warning', 'warn']):
                    replacement = f'self.Log(f"{message}")'  # QuantConnect uses Log for warnings
                elif any(keyword in message.lower() for keyword in ['debug']):
                    replacement = f'self.Debug(f"{message}")'
                else:
                    replacement = f'self.Log(f"{message}")'
                
                new_content = new_content.replace(original_print, replacement)
                fixes_made += 1
        
        return new_content, fixes_made
    
    def _fix_logging_issues(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix various logging-related issues"""
        fixes_made = 0
        new_content = content
        
        # Fix double logging (both print and self.Log)
        double_log_pattern = r'print\([^)]*\)\s*\n\s*self\.(Log|Debug|Error)\([^)]*\)'
        matches = re.findall(double_log_pattern, content)
        for match in matches:
            # Remove the print statement, keep the proper logging
            old_double = re.search(double_log_pattern, new_content).group(0)
            # Extract just the self.Log/Debug/Error part
            proper_log = re.search(r'self\.(Log|Debug|Error)\([^)]*\)', old_double).group(0)
            new_content = new_content.replace(old_double, proper_log)
            fixes_made += 1
        
        # Fix inconsistent logging prefixes
        log_prefix_patterns = [
            (r'self\.Log\(f?"?\[.*?\]', 'self.Log(f"'),
            (r'self\.Debug\(f?"?\[.*?\]', 'self.Debug(f"'),
            (r'self\.Error\(f?"?\[.*?\]', 'self.Error(f"'),
        ]
        
        for old_pattern, new_start in log_prefix_patterns:
            matches = re.findall(old_pattern, content)
            for match in matches:
                # Standardize the format
                fixed_match = re.sub(r'\[.*?\]', '', match) + '"[' + file_path.stem.upper() + '] '
                new_content = new_content.replace(match, fixed_match)
                fixes_made += 1
        
        return new_content, fixes_made
    
    def _fix_magic_numbers(self, content: str, file_path: Path) -> Tuple[str, int]:
        """Fix magic numbers that should be named constants"""
        fixes_made = 0
        new_content = content
        
        # Common magic numbers in trading
        magic_number_replacements = {
            r'(?<!\w)252(?!\w)(?=.*(?:trading|business|day))': 'TRADING_DAYS_PER_YEAR',  # 252 trading days
            r'(?<!\w)365(?!\w)(?=.*(?:day|year|calendar))': 'CALENDAR_DAYS_PER_YEAR',  # 365 calendar days
            r'(?<!\w)0\.01(?!\w)(?=.*(?:percent|threshold))': 'MIN_PRICE_CHANGE_THRESHOLD',  # 1% threshold
            r'(?<!\w)100(?!\w)(?=.*(?:percent|%)(?!.*contract))': 'FULL_PERCENTAGE',  # 100%
            r'(?<!\w)86400(?!\w)': 'SECONDS_PER_DAY',  # Seconds in a day
            r'(?<!\w)3600(?!\w)': 'SECONDS_PER_HOUR',  # Seconds in an hour
        }
        
        for pattern, constant_name in magic_number_replacements.items():
            matches = re.findall(pattern, content)
            if matches:
                new_content = re.sub(pattern, f'TradingConstants.{constant_name}', new_content)
                fixes_made += len(matches)
        
        return new_content, fixes_made

def main():
    """Fix all quality failures comprehensively"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = ComprehensiveQualityFixer(root_dir)
    
    success = fixer.fix_all_quality_failures()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 60)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied[:20]:  # Show first 20 to avoid spam
            print(f"  - {fix}")
        
        if len(fixer.fixes_applied) > 20:
            print(f"  ... and {len(fixer.fixes_applied) - 20} more files")
    
    print(f"\nQuality failure fixing completed: {'SUCCESS' if success else 'NO ISSUES FOUND'}")
    return success

if __name__ == "__main__":
    main()