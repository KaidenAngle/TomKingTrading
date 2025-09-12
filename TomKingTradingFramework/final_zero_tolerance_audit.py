#!/usr/bin/env python3
"""
FINAL ZERO-TOLERANCE AUDIT TOOL
Comprehensive verification that ALL critical standards have been met:
- No placeholders, truncations, redundancies, repeated functionality, shortcuts
- Full compliance with documentation instructions and audit protocols
- Systematic reverse engineering validation of all fixes
"""

import ast
import re
import os
from pathlib import Path
from typing import List, Dict, Set, Tuple
import subprocess

class FinalZeroToleranceAudit:
    """Ultimate verification of zero-tolerance standards"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.issues_found = []
        self.files_scanned = 0
        self.total_violations = 0
        
        # Zero-tolerance violation patterns
        self.violation_patterns = {
            'placeholders': [
                r'TODO:?\s*(?!.*COMPLETED|.*DONE)',
                r'FIXME:?\s*(?!.*FIXED|.*RESOLVED)',
                r'XXX:?\s*(?!.*HANDLED|.*ADDRESSED)',
                r'PLACEHOLDER\s*(?!.*REPLACED|.*IMPLEMENTED)',
                r'# TODO(?!.*DONE|.*COMPLETED)',
                r'pass\s*#.*(?:placeholder|todo|fixme|temp)',
                r'NotImplemented(?:Error)?\s*\(',
                r'raise\s+NotImplemented',
                r'\.\.\.(?!\s*\))',  # Ellipsis not in function signatures
            ],
            'truncations': [
                r'\.\.\.(?:\s*#.*truncated)',
                r'#.*truncated',
                r'#.*\[.*truncated.*\]',
                r'#.*cut.*off',
                r'#.*continues.*but.*not.*shown',
                r'#.*\[.*more.*code.*\]',
            ],
            'shortcuts': [
                r'#.*quick.*fix',
                r'#.*temporary.*solution',
                r'#.*hack',
                r'#.*workaround(?!\s+for\s+known\s+issue)',
                r'#.*shortcut',
                r'#.*lazy\s+implementation',
            ],
            'dangerous_patterns': [
                r'\beval\s*\(',
                r'\bexec\s*\(',
                r'time\.sleep\s*\(',
                r'except\s*:\s*$',  # Bare except
                r'except\s*:\s*\n\s*pass',
            ]
        }
    
    def scan_all_python_files(self) -> List[Path]:
        """Get all Python files for comprehensive scanning"""
        python_files = []
        
        for root, dirs, files in os.walk(self.base_path):
            # Skip certain directories
            dirs[:] = [d for d in dirs if d not in {'.git', '__pycache__', '.vscode', 'venv', 'env'}]
            
            for file in files:
                if file.endswith('.py'):
                    python_files.append(Path(root) / file)
        
        return python_files
    
    def audit_file_for_violations(self, file_path: Path) -> Dict:
        """Comprehensive audit of single file for all violation types"""
        violations = {
            'placeholders': [],
            'truncations': [],
            'shortcuts': [],
            'dangerous_patterns': [],
            'redundancies': [],
            'repeated_functionality': [],
            'syntax_errors': [],
            'compilation_errors': []
        }
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.splitlines()
            
            # Test 1: Pattern-based violation detection
            for violation_type, patterns in self.violation_patterns.items():
                for pattern in patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        line_content = lines[line_num - 1].strip()
                        violations[violation_type].append({
                            'line': line_num,
                            'content': line_content,
                            'pattern': pattern,
                            'match': match.group()
                        })
            
            # Test 2: Syntax validation
            try:
                ast.parse(content)
            except SyntaxError as e:
                violations['syntax_errors'].append({
                    'line': e.lineno,
                    'content': e.text.strip() if e.text else '',
                    'error': str(e),
                    'type': 'SyntaxError'
                })
            
            # Test 3: Compilation test
            try:
                compile(content, str(file_path), 'exec')
            except Exception as e:
                violations['compilation_errors'].append({
                    'error': str(e),
                    'type': type(e).__name__
                })
            
            # Test 4: Redundancy detection
            violations['redundancies'] = self._detect_redundancies(content, lines)
            
            # Test 5: Repeated functionality detection
            violations['repeated_functionality'] = self._detect_repeated_functionality(content, lines)
            
            return violations
            
        except Exception as e:
            return {'file_error': str(e)}
    
    def _detect_redundancies(self, content: str, lines: List[str]) -> List[Dict]:
        """Detect redundant code patterns"""
        redundancies = []
        
        # Pattern 1: Duplicate try-except blocks
        try_except_blocks = re.findall(r'(try:\s*\n.*?except.*?:.*?)(?=\s*(?:try:|def|class|$))', 
                                      content, re.DOTALL)
        seen_blocks = set()
        for block in try_except_blocks:
            normalized = re.sub(r'\s+', ' ', block).strip()
            if normalized in seen_blocks:
                redundancies.append({
                    'type': 'duplicate_try_except',
                    'content': block[:100] + '...' if len(block) > 100 else block,
                    'severity': 'high'
                })
            seen_blocks.add(normalized)
        
        # Pattern 2: Duplicate import statements
        imports = re.findall(r'^(?:from\s+\S+\s+)?import\s+.+$', content, re.MULTILINE)
        seen_imports = set()
        for imp in imports:
            if imp in seen_imports:
                redundancies.append({
                    'type': 'duplicate_import',
                    'content': imp,
                    'severity': 'medium'
                })
            seen_imports.add(imp)
        
        # Pattern 3: Duplicate exception handling patterns
        exception_handlers = re.findall(r'except\s+.*?:\s*\n\s*.*?(?=\s*(?:except|finally|$))', 
                                       content, re.DOTALL)
        handler_patterns = {}
        for handler in exception_handlers:
            pattern = re.sub(r'except\s+\w+\s+as\s+\w+:', 'except Exception as e:', handler)
            pattern = re.sub(r'\s+', ' ', pattern).strip()
            if pattern in handler_patterns:
                redundancies.append({
                    'type': 'duplicate_exception_handler',
                    'content': handler[:100] + '...' if len(handler) > 100 else handler,
                    'severity': 'medium'
                })
            else:
                handler_patterns[pattern] = handler
        
        return redundancies
    
    def _detect_repeated_functionality(self, content: str, lines: List[str]) -> List[Dict]:
        """Detect repeated functionality patterns"""
        repeated_funcs = []
        
        # Pattern 1: Similar function implementations
        functions = re.findall(r'def\s+(\w+)\s*\([^)]*\):\s*"""([^"]+)"""\s*(.*?)(?=def|\Z)', 
                              content, re.DOTALL)
        
        func_signatures = {}
        for func_name, docstring, body in functions:
            # Normalize function body for comparison
            normalized_body = re.sub(r'\s+', ' ', body).strip()
            normalized_body = re.sub(r'self\.\w+', 'self.VAR', normalized_body)
            
            if normalized_body in func_signatures:
                repeated_funcs.append({
                    'type': 'similar_function_implementation',
                    'function1': func_signatures[normalized_body],
                    'function2': func_name,
                    'similarity': 'high',
                    'severity': 'high'
                })
            else:
                func_signatures[normalized_body] = func_name
        
        # Pattern 2: Repeated validation patterns
        validation_patterns = re.findall(r'if.*?hasattr.*?:\s*\n.*?try:.*?except.*?:', 
                                        content, re.DOTALL)
        if len(validation_patterns) > 3:
            repeated_funcs.append({
                'type': 'repeated_validation_pattern',
                'count': len(validation_patterns),
                'severity': 'medium',
                'suggestion': 'Consider extracting to validation utility function'
            })
        
        return repeated_funcs
    
    def check_documentation_compliance(self) -> Dict:
        """Verify compliance with documentation instructions"""
        compliance_issues = []
        
        # Check if CLAUDE.md exists and has required sections
        claude_md = self.base_path / "CLAUDE.md"
        if not claude_md.exists():
            compliance_issues.append({
                'type': 'missing_documentation',
                'file': 'CLAUDE.md',
                'severity': 'high',
                'description': 'Missing project documentation file'
            })
        else:
            with open(claude_md, 'r') as f:
                content = f.read()
                required_sections = [
                    'Tom King Trading Framework Specific',
                    'Critical Methodology - AUDIT BEFORE ASSUME',
                    'Non-Negotiable Parameters'
                ]
                
                for section in required_sections:
                    if section not in content:
                        compliance_issues.append({
                            'type': 'missing_documentation_section',
                            'section': section,
                            'severity': 'medium'
                        })
        
        # Check for Documentation/ directory structure
        doc_dir = self.base_path / "Documentation"
        if not doc_dir.exists():
            compliance_issues.append({
                'type': 'missing_documentation_directory',
                'severity': 'high',
                'description': 'Missing Documentation/ directory structure'
            })
        
        return {
            'compliance_issues': compliance_issues,
            'documentation_found': doc_dir.exists() if doc_dir else False,
            'claude_md_found': claude_md.exists() if claude_md else False
        }
    
    def execute_comprehensive_audit(self) -> Dict:
        """Execute the complete zero-tolerance audit"""
        print("=" * 80)
        print("FINAL ZERO-TOLERANCE COMPREHENSIVE AUDIT")
        print("=" * 80)
        print("Verifying: No placeholders, truncations, redundancies, shortcuts")
        print("Standard: Production-grade Tom King Trading Framework")
        print("=" * 80)
        
        # Get all Python files
        python_files = self.scan_all_python_files()
        self.files_scanned = len(python_files)
        print(f"\n[AUDIT] Scanning {self.files_scanned} Python files...")
        
        # Audit each file
        all_violations = {
            'placeholders': [],
            'truncations': [], 
            'shortcuts': [],
            'dangerous_patterns': [],
            'redundancies': [],
            'repeated_functionality': [],
            'syntax_errors': [],
            'compilation_errors': []
        }
        
        files_with_violations = []
        
        for file_path in python_files:
            violations = self.audit_file_for_violations(file_path)
            
            # Aggregate violations
            has_violations = False
            for violation_type, violation_list in violations.items():
                if violation_type != 'file_error' and violation_list:
                    all_violations[violation_type].extend([
                        {**v, 'file': str(file_path.relative_to(self.base_path))}
                        for v in violation_list
                    ])
                    has_violations = True
            
            if has_violations:
                files_with_violations.append(str(file_path.relative_to(self.base_path)))
        
        # Check documentation compliance
        doc_compliance = self.check_documentation_compliance()
        
        # Calculate totals
        total_violations = sum(len(violations) for violations in all_violations.values())
        
        # Generate comprehensive report
        return {
            'files_scanned': self.files_scanned,
            'files_with_violations': files_with_violations,
            'total_violations': total_violations,
            'violations_by_type': all_violations,
            'documentation_compliance': doc_compliance,
            'zero_tolerance_status': total_violations == 0 and len(doc_compliance['compliance_issues']) == 0,
            'critical_files_status': self._check_critical_files_status()
        }
    
    def _check_critical_files_status(self) -> Dict:
        """Check status of critical framework files"""
        critical_files = ['main.py', 'core/unified_state_manager.py', 'core/unified_vix_manager.py']
        status = {}
        
        for file_name in critical_files:
            file_path = self.base_path / file_name
            if file_path.exists():
                try:
                    # Test compilation
                    result = subprocess.run(['python', '-m', 'py_compile', str(file_path)], 
                                          capture_output=True, text=True, cwd=self.base_path)
                    status[file_name] = {
                        'exists': True,
                        'compiles': result.returncode == 0,
                        'error': result.stderr if result.returncode != 0 else None
                    }
                except Exception as e:
                    status[file_name] = {
                        'exists': True,
                        'compiles': False,
                        'error': str(e)
                    }
            else:
                status[file_name] = {'exists': False, 'compiles': False, 'error': 'File not found'}
        
        return status
    
    def generate_detailed_report(self, audit_results: Dict) -> str:
        """Generate comprehensive audit report"""
        report = []
        report.append("=" * 80)
        report.append("FINAL ZERO-TOLERANCE AUDIT REPORT")
        report.append("=" * 80)
        
        # Executive Summary
        if audit_results['zero_tolerance_status']:
            report.append("🎯 ZERO-TOLERANCE STATUS: ✅ ACHIEVED")
            report.append("All standards met: No placeholders, truncations, redundancies, shortcuts")
        else:
            report.append("🎯 ZERO-TOLERANCE STATUS: ❌ VIOLATIONS FOUND")
            report.append(f"Total violations: {audit_results['total_violations']}")
        
        report.append("")
        report.append(f"Files Scanned: {audit_results['files_scanned']}")
        report.append(f"Files with Violations: {len(audit_results['files_with_violations'])}")
        
        # Violation Details
        for violation_type, violations in audit_results['violations_by_type'].items():
            if violations:
                report.append(f"\n{violation_type.upper().replace('_', ' ')} ({len(violations)} found):")
                report.append("-" * 50)
                
                for violation in violations[:5]:  # Show first 5 of each type
                    file_name = violation.get('file', 'unknown')
                    line = violation.get('line', 'unknown')
                    content = violation.get('content', violation.get('match', ''))[:100]
                    report.append(f"  {file_name}:{line} - {content}")
                
                if len(violations) > 5:
                    report.append(f"  ... and {len(violations) - 5} more {violation_type}")
        
        # Critical Files Status
        report.append("\nCRITICAL FILES STATUS:")
        report.append("-" * 30)
        for file_name, status in audit_results['critical_files_status'].items():
            status_icon = "✅" if status['compiles'] else "❌"
            report.append(f"{status_icon} {file_name}: {'COMPILES' if status['compiles'] else 'ERROR'}")
            if status.get('error'):
                report.append(f"    Error: {status['error']}")
        
        # Documentation Compliance
        doc_issues = audit_results['documentation_compliance']['compliance_issues']
        if doc_issues:
            report.append(f"\nDOCUMENTATION COMPLIANCE ISSUES ({len(doc_issues)}):")
            report.append("-" * 40)
            for issue in doc_issues:
                report.append(f"  {issue['severity'].upper()}: {issue['type']} - {issue.get('description', '')}")
        
        # Recommendations
        if not audit_results['zero_tolerance_status']:
            report.append("\nRECOMMENDATIONS:")
            report.append("-" * 20)
            if audit_results['violations_by_type']['placeholders']:
                report.append("1. Replace all TODO/PLACEHOLDER comments with actual implementations")
            if audit_results['violations_by_type']['redundancies']:
                report.append("2. Eliminate duplicate code through refactoring and abstraction")
            if audit_results['violations_by_type']['dangerous_patterns']:
                report.append("3. CRITICAL: Remove all dangerous patterns (eval, exec, bare except)")
        
        report.append("\n" + "=" * 80)
        report.append("AUDIT COMPLETE")
        report.append("=" * 80)
        
        return "\n".join(report)

def main():
    """Execute final zero-tolerance audit"""
    framework_path = "D:/OneDrive/Trading/Claude/TomKingTradingFramework"
    
    audit_tool = FinalZeroToleranceAudit(framework_path)
    audit_results = audit_tool.execute_comprehensive_audit()
    
    # Generate and display report
    report = audit_tool.generate_detailed_report(audit_results)
    print(report)
    
    # Save report
    with open('final_zero_tolerance_audit_report.txt', 'w') as f:
        f.write(report)
    
    return audit_results['zero_tolerance_status']

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)