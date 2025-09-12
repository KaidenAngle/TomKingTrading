#!/usr/bin/env python3
"""
TARGETED MALFORMED CODE FIXER
Fixes the specific malformed pattern created by bare except fixer
Pattern: Empty try block with all code outside the try-except structure
"""

import os
import re
from pathlib import Path

class TargetedMalformedFixer:
    """Fix the specific malformed pattern we identified"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_targeted_malformed_patterns(self):
        """Fix the specific malformed pattern"""
        print("TARGETED MALFORMED CODE FIXER")
        print("=" * 50)
        
        # Get list of files that were flagged in the previous run
        problem_files = [
            "final_deep_verification_audit.py",
            "position_state_manager.py", 
            "run_position_opening_audit.py",
            "sync_to_quantconnect.py",
            "unified_framework_auditor.py",
            "brokers/paper_trading_adapter.py",
            "brokers/tastytrade_api_client.py",
            "brokers/tastytrade_websocket.py",
            "core/central_greeks_service.py",
            "core/component_initializer.py",
            "core/dependency_container.py",
            "core/event_bus.py",
            "core/event_driven_ondata.py",
            "core/event_driven_optimizer.py",
            "core/manager_factory.py",
            "core/market_data_cache.py",
            "core/performance_cache.py",
            "core/state_machine.py",
            "core/strategy_coordinator.py",
            "core/unified_intelligent_cache.py",
            "core/unified_state_manager.py",
            "core/unified_vix_manager.py"
        ]
        
        total_fixes = 0
        
        for file_path_str in problem_files:
            file_path = self.root_dir / file_path_str
            if not file_path.exists():
                print(f"   Skipping {file_path_str} - file not found")
                continue
                
            try:
                fixes = self._fix_single_file(file_path)
                if fixes > 0:
                    total_fixes += fixes
                    self.fixes_applied.append(f"{file_path_str}: {fixes} malformed structures fixed")
                    print(f"   Fixed {fixes} structures in {file_path_str}")
            except Exception as e:
                print(f"   Error processing {file_path_str}: {e}")
        
        print(f"\nTotal malformed structures fixed: {total_fixes}")
        return total_fixes > 0
    
    def _fix_single_file(self, file_path: Path) -> int:
        """Fix malformed patterns in a single file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        
        # Look for the pattern: 
            # try:
                #     
        # except Exception as e:
            #     # Log and handle...
        #     print(...)
        #     raise
        # actual_code_that_should_be_in_try
        
        lines = content.split('\n')
        fixed_lines = []
        i = 0
        fixes_made = 0
        
        while i < len(lines):
            line = lines[i]
            
            # Look for try: followed by empty content then except
            if re.match(r'(\s+)try:\s*$', line):
                try_indent_match = re.match(r'(\s+)', line)
                try_indent = try_indent_match.group(1) if try_indent_match else '        '
                
                # Check if the next few lines follow the malformed pattern
                j = i + 1
                
                # Skip blank lines and check for except
                while j < len(lines) and (lines[j].strip() == '' or 
                                        lines[j].strip().startswith('except') == False):
                                            if lines[j].strip() != '' and not lines[j].strip().startswith('except'):
                                                break  # Found content, not the pattern we're looking for
                    j += 1
                
                # If we found except clause directly after try (with possible blank lines)
                if j < len(lines) and re.match(r'\s+except .+:', lines[j]):
                    # This is the malformed pattern
                    except_line = lines[j]
                    except_indent_match = re.match(r'(\s+)', except_line)
                    except_indent = except_indent_match.group(1) if except_indent_match else try_indent
                    
                    # Collect the exception handling code
                    k = j + 1
                    exception_handling = []
                    while k < len(lines):
                        next_line = lines[k]
                        if (next_line.strip().startswith('#') or
                            'print(' in next_line or
                            'Log(' in next_line or
                            'raise' in next_line.strip() or
                            next_line.strip() == ''):
                            exception_handling.append(next_line)
                            k += 1
                        else:
                            break
                    
                    # Collect the orphaned code (code that should be in try block)
                    orphaned_code = []
                    while k < len(lines):
                        next_line = lines[k]
                        # Stop at next function, class, or major control structure
                        if (re.match(r'\s*(?:def |class |if __name__|$)', next_line) or
                            (next_line.strip() and not next_line.startswith(' ' * len(try_indent)))):
                            break
                        orphaned_code.append(next_line)
                        k += 1
                    
                    # If we found orphaned code, fix the structure
                    if any(line.strip() for line in orphaned_code):
                        # Reconstruct the try-except block properly
                        fixed_lines.append(line)  # try:
                        
                            # Add orphaned code to try block with proper indentation
                        for orphan_line in orphaned_code:
                            if orphan_line.strip():
                                # Ensure proper indentation within try block
                                content = orphan_line.strip()
                                fixed_lines.append(f"{except_indent}{content}")
                            else:
                                fixed_lines.append('')  # Keep blank lines
                        
                        # Add the except block
                        fixed_lines.append(except_line)
                        fixed_lines.extend(exception_handling)
                        
                        fixes_made += 1
                        i = k
                        continue
            
            fixed_lines.append(line)
            i += 1
        
        if fixes_made > 0:
            fixed_content = '\n'.join(fixed_lines)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
        
        return fixes_made

def main():
    """Fix targeted malformed code structures"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = TargetedMalformedFixer(root_dir)
    
    success = fixer.fix_targeted_malformed_patterns()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 50)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return success

if __name__ == "__main__":
    main()