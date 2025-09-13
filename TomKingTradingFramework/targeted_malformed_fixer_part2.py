#!/usr/bin/env python3
"""
TARGETED MALFORMED CODE FIXER - PART 2
Fixes remaining malformed files identified from the error output
"""

import os
import re
from pathlib import Path

class TargetedMalformedFixerPart2:
    """Fix remaining malformed patterns"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        
    def fix_remaining_malformed_patterns(self):
        """Fix remaining malformed patterns"""
        print("TARGETED MALFORMED CODE FIXER - PART 2")
        print("=" * 50)
        
        # Remaining files from the error output
        remaining_files = [
            "greeks/greeks_monitor.py",
            "greeks/phase_based_greeks_limits.py",
            "helpers/atomic_order_executor.py",
            "helpers/corporate_events_checker.py",
            "helpers/data_freshness_validator.py",
            "helpers/data_validation.py",
            "helpers/future_options_manager.py",
            "helpers/option_chain_manager.py",
            "helpers/option_order_executor.py",
            "helpers/order_state_recovery.py",
            "helpers/performance_tracker_safe.py",
            "helpers/quantconnect_event_calendar.py",
            "helpers/simple_order_helpers.py",
            "helpers/unified_order_pricing.py",
            "optimization/dynamic_correlation_monitor.py",
            "optimization/option_chain_cache.py",
            "reporting/trading_dashboard.py",
            "risk/dynamic_margin_manager.py",
            "risk/live_trading_components.py",
            "risk/manual_mode_fallback.py",
            "risk/order_validation.py",
            "risk/parameters.py",
            "risk/pre_trade_validators.py",
            "risk/production_logging.py",
            "risk/unified_risk_manager.py",
            "strategies/base_strategy_with_state.py",
            "strategies/earnings_avoidance.py",
            "strategies/friday_0dte_with_state.py",
            "strategies/futures_strangle_with_state.py",
            "strategies/ipmcc_execution_manager.py",
            "strategies/ipmcc_with_state.py",
            "strategies/leap_put_ladders_with_state.py",
            "strategies/lt112_component_manager.py",
            "strategies/lt112_with_state.py",
            "strategies/strategy_order_executor.py",
            "validation/comprehensive_position_opening_validator.py",
            "validation/system_validator.py",
            "risk/plugins/circuit_breaker_plugin.py",
            "risk/plugins/concentration_plugin.py",
            "risk/plugins/correlation_plugin.py"
        ]
        
        total_fixes = 0
        
        for file_path_str in remaining_files:
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
    """Fix remaining malformed code structures"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = TargetedMalformedFixerPart2(root_dir)
    
    success = fixer.fix_remaining_malformed_patterns()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 50)
        print("FIXES APPLIED:")
        for fix in fixer.fixes_applied:
            print(f"  - {fix}")
    
    return success

if __name__ == "__main__":
    main()