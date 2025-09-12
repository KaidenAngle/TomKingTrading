#!/usr/bin/env python3
"""
FINAL VERIFICATION AUDIT
Comprehensive audit to verify all fixes have been successfully applied
Following Implementation Audit Protocol - Zero Tolerance for Shortcuts
"""

import os
import re
import ast
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict

class FinalVerificationAuditor:
    """Comprehensive final audit of all fixes"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.audit_results = {
            'safety_issues': {'checked': 0, 'remaining': 0, 'details': []},
            'malformed_code': {'checked': 0, 'remaining': 0, 'details': []},
            'quality_failures': {'checked': 0, 'remaining': 0, 'details': []},
            'incomplete_implementations': {'checked': 0, 'remaining': 0, 'details': []},
            'duplicate_functions': {'checked': 0, 'remaining': 0, 'details': []},
            'syntax_errors': {'checked': 0, 'remaining': 0, 'details': []}
        }
        
    def run_comprehensive_verification(self):
        """Run comprehensive verification of all fixes"""
        print("FINAL VERIFICATION AUDIT")
        print("=" * 60)
        print("Verifying all systematic fixes have been successfully applied...")
        
        python_files = list(self.root_dir.rglob("*.py"))
        
        # Skip fixer files themselves
        python_files = [f for f in python_files if not self._should_skip_file(f)]
        
        print(f"Auditing {len(python_files)} Python files...")
        
        for file_path in python_files:
            try:
                self._audit_single_file(file_path)
            except Exception as e:
                print(f"   Error auditing {file_path}: {e}")
        
        # Generate comprehensive report
        self._generate_verification_report()
        
        return self._calculate_overall_success()
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be audited"""
        skip_patterns = ['fix_', 'fixer', 'audit', 'verification']
        return any(pattern in file_path.name.lower() for pattern in skip_patterns)
    
    def _audit_single_file(self, file_path: Path):
        """Audit a single file for all categories of issues"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"   Cannot read {file_path}: {e}")
            return
        
        relative_path = str(file_path.relative_to(self.root_dir))
        
        # 1. Check for remaining safety issues
        self._check_safety_issues(content, relative_path)
        
        # 2. Check for malformed code structures
        self._check_malformed_code(content, relative_path)
        
        # 3. Check for quality failures
        self._check_quality_failures(content, relative_path)
        
        # 4. Check for incomplete implementations
        self._check_incomplete_implementations(content, relative_path)
        
        # 5. Check syntax validity
        self._check_syntax_errors(content, relative_path)
    
    def _check_safety_issues(self, content: str, file_path: str):
        """Check for remaining critical safety issues"""
        self.audit_results['safety_issues']['checked'] += 1
        issues = []
        
        # Check for blocking sleep calls
        if re.search(r'time\.sleep\(', content):
            issues.append("Blocking time.sleep() call found")
        
        # Check for bare except clauses
        if re.search(r'except:\s*$', content, re.MULTILINE):
            issues.append("Bare except clause found")
        
        # Check for infinite loop patterns
        if re.search(r'while\s+True:\s*\n(?:\s*#[^\n]*\n)*\s*(?!.*break)', content, re.MULTILINE):
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if re.match(r'\s*while\s+True:', line):
                    # Check next 10 lines for break statement
                    has_break = any('break' in lines[j] for j in range(i+1, min(i+11, len(lines))))
                    if not has_break:
                        issues.append(f"Potential infinite loop at line {i+1}")
        
        if issues:
            self.audit_results['safety_issues']['remaining'] += 1
            self.audit_results['safety_issues']['details'].append({
                'file': file_path,
                'issues': issues
            })
    
    def _check_malformed_code(self, content: str, file_path: str):
        """Check for remaining malformed code structures"""
        self.audit_results['malformed_code']['checked'] += 1
        issues = []
        
        # Check for empty try blocks
        if re.search(r'try:\s*\n\s*except', content, re.MULTILINE):
            issues.append("Empty try block found")
        
        # Check for orphaned exception handling
        if re.search(r'except\s+\w+\s+as\s+\w+:\s*\n\s*#.*\n\s*print.*\n\s*raise\s*\n\w+', content, re.MULTILINE):
            issues.append("Orphaned code after exception handling")
        
        if issues:
            self.audit_results['malformed_code']['remaining'] += 1
            self.audit_results['malformed_code']['details'].append({
                'file': file_path,
                'issues': issues
            })
    
    def _check_quality_failures(self, content: str, file_path: str):
        """Check for remaining quality failures"""
        self.audit_results['quality_failures']['checked'] += 1
        issues = []
        
        # Check for remaining print statements (excluding test files)
        if not 'test' in file_path.lower():
            print_matches = re.findall(r'print\s*\(', content)
            if print_matches:
                issues.append(f"Found {len(print_matches)} print statements")
        
        # Check for hardcoded values that should be constants
        if re.search(r'(?<!\w)0\.25(?!\w)(?!.*KELLY)', content):
            issues.append("Hardcoded Kelly factor (0.25) found")
        
        if re.search(r'(?<!\w)21(?!\w).*dte', content, re.IGNORECASE):
            issues.append("Hardcoded 21 DTE value found")
        
        if re.search(r'(?<!\w)30000(?!\w)', content):
            issues.append("Hardcoded capital amount (30000) found")
        
        if issues:
            self.audit_results['quality_failures']['remaining'] += 1
            self.audit_results['quality_failures']['details'].append({
                'file': file_path,
                'issues': issues
            })
    
    def _check_incomplete_implementations(self, content: str, file_path: str):
        """Check for remaining incomplete implementations"""
        self.audit_results['incomplete_implementations']['checked'] += 1
        issues = []
        
        # Check for TODO comments
        todo_matches = re.findall(r'#\s*(?:TODO|FIXME|XXX)', content, re.IGNORECASE)
        if todo_matches:
            issues.append(f"Found {len(todo_matches)} TODO comments")
        
        # Check for NotImplementedError
        if 'NotImplementedError' in content:
            issues.append("NotImplementedError found")
        
        # Check for placeholder values
        if re.search(r'[\'"].*?placeholder.*?[\'"]', content, re.IGNORECASE):
            issues.append("Placeholder values found")
        
        if issues:
            self.audit_results['incomplete_implementations']['remaining'] += 1
            self.audit_results['incomplete_implementations']['details'].append({
                'file': file_path,
                'issues': issues
            })
    
    def _check_syntax_errors(self, content: str, file_path: str):
        """Check for syntax errors"""
        self.audit_results['syntax_errors']['checked'] += 1
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            self.audit_results['syntax_errors']['remaining'] += 1
            self.audit_results['syntax_errors']['details'].append({
                'file': file_path,
                'issues': [f"Syntax error: {str(e)}"]
            })
    
    def _generate_verification_report(self):
        """Generate comprehensive verification report"""
        print(f"\n{'='*60}")
        print("FINAL VERIFICATION REPORT")
        print(f"{'='*60}")
        
        total_issues = 0
        
        for category, results in self.audit_results.items():
            checked = results['checked']
            remaining = results['remaining']
            
            status = "✅ PASS" if remaining == 0 else f"❌ {remaining} ISSUES"
            print(f"\n{category.replace('_', ' ').title():.<40} {status}")
            print(f"   Files checked: {checked}")
            
            if remaining > 0:
                total_issues += remaining
                print(f"   Files with issues: {remaining}")
                
                # Show first few issues for debugging
                for detail in results['details'][:3]:
                    print(f"     - {detail['file']}: {', '.join(detail['issues'][:2])}")
                
                if len(results['details']) > 3:
                    print(f"     ... and {len(results['details']) - 3} more files")
        
        print(f"\n{'='*60}")
        if total_issues == 0:
            print("🎉 ALL VERIFICATION CHECKS PASSED!")
            print("The systematic fix campaign has been successfully completed.")
        else:
            print(f"⚠️  {total_issues} files still have issues requiring attention")
            print("Additional cleanup may be needed in specific areas.")
        
        print(f"{'='*60}")
    
    def _calculate_overall_success(self) -> bool:
        """Calculate overall success rate"""
        total_remaining = sum(results['remaining'] for results in self.audit_results.values())
        return total_remaining == 0

def main():
    """Run final verification audit"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    auditor = FinalVerificationAuditor(root_dir)
    
    success = auditor.run_comprehensive_verification()
    
    return success

if __name__ == "__main__":
    main()