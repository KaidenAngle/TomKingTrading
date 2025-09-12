#!/usr/bin/env python3
"""
SIMPLE FINAL AUDIT
Quick verification that major fixes have been applied
"""

import os
import re
from pathlib import Path

class SimpleFinalAudit:
    """Simple final audit of fixes"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        
    def run_audit(self):
        """Run simple audit"""
        print("SIMPLE FINAL AUDIT")
        print("=" * 50)
        
        python_files = list(self.root_dir.rglob("*.py"))
        # Skip audit files
        python_files = [f for f in python_files if 'audit' not in f.name.lower() and 'fix' not in f.name.lower()]
        
        print(f"Checking {len(python_files)} files...")
        
        # Count issues
        bare_except_count = 0
        print_statement_count = 0
        blocking_sleep_count = 0
        todo_count = 0
        syntax_error_count = 0
        
        for file_path in python_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Count bare except clauses
                bare_except_count += len(re.findall(r'except:\s*$', content, re.MULTILINE))
                
                # Count print statements (excluding test files)
                if 'test' not in file_path.name.lower():
                    print_statement_count += len(re.findall(r'print\s*\(', content))
                
                # Count blocking sleep calls
                blocking_sleep_count += len(re.findall(r'time\.sleep\s*\(', content))
                
                # Count TODO comments
                todo_count += len(re.findall(r'#\s*(?:TODO|FIXME)', content, re.IGNORECASE))
                
                # Check syntax
                try:
                    compile(content, str(file_path), 'exec')
                except SyntaxError:
                    syntax_error_count += 1
                    
            except Exception:
                pass  # Skip files we can't read
        
        # Report results
        print("\nRESULTS:")
        print("-" * 50)
        print(f"Bare except clauses remaining:    {bare_except_count}")
        print(f"Print statements remaining:       {print_statement_count}")
        print(f"Blocking sleep calls remaining:   {blocking_sleep_count}")
        print(f"TODO comments remaining:          {todo_count}")
        print(f"Files with syntax errors:         {syntax_error_count}")
        
        total_critical_issues = bare_except_count + blocking_sleep_count + syntax_error_count
        
        print("-" * 50)
        if total_critical_issues == 0:
            print("CRITICAL SAFETY ISSUES: RESOLVED")
        else:
            print(f"CRITICAL SAFETY ISSUES: {total_critical_issues} REMAINING")
        
        print(f"QUALITY ISSUES: {print_statement_count + todo_count} minor items remaining")
        
        return total_critical_issues == 0

def main():
    """Run simple audit"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    auditor = SimpleFinalAudit(root_dir)
    return auditor.run_audit()

if __name__ == "__main__":
    main()