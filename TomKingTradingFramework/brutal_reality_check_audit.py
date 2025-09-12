#!/usr/bin/env python3
"""
BRUTAL REALITY CHECK AUDIT
No excuses, no assumptions, no shortcuts.
Find EVERYTHING that's still broken, incomplete, or substandard.
"""

import ast
import re
import os
import subprocess
from pathlib import Path
from typing import Dict, List, Set
import importlib.util

class BrutalRealityAudit:
    """Absolutely unforgiving audit - find every remaining issue"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.total_issues = 0
        self.compilation_failures = []
        self.import_failures = []
        self.placeholder_violations = []
        self.truncation_violations = []
        self.shortcut_violations = []
        self.redundancy_violations = []
        
    def test_every_python_file_compilation(self) -> Dict:
        """Test EVERY Python file for compilation - no exceptions"""
        print("[BRUTAL] Testing compilation of EVERY Python file...")
        
        failures = []
        successes = []
        
        for py_file in self.base_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ['.git', '__pycache__', 'venv']):
                continue
                
            try:
                result = subprocess.run(
                    ['python', '-m', 'py_compile', str(py_file)],
                    capture_output=True, text=True, cwd=self.base_path, timeout=10
                )
                
                if result.returncode != 0:
                    failures.append({
                        'file': str(py_file.relative_to(self.base_path)),
                        'error': result.stderr.strip(),
                        'stdout': result.stdout.strip()
                    })
                else:
                    successes.append(str(py_file.relative_to(self.base_path)))
                    
            except Exception as e:
                failures.append({
                    'file': str(py_file.relative_to(self.base_path)),
                    'error': f"Exception during compilation test: {str(e)}",
                    'stdout': ''
                })
        
        self.compilation_failures = failures
        return {
            'total_files': len(successes) + len(failures),
            'successes': len(successes), 
            'failures': len(failures),
            'failed_files': failures
        }
    
    def test_actual_imports(self) -> Dict:
        """Try to actually import and instantiate key framework classes"""
        print("[BRUTAL] Testing actual imports and instantiation...")
        
        critical_imports = [
            ('main', 'TomKingTradingIntegrated'),
            ('core.unified_state_manager', 'UnifiedStateManager'),
            ('core.unified_vix_manager', 'UnifiedVIXManager'),
            ('risk.unified_risk_manager', 'UnifiedRiskManager'),
            ('validation.comprehensive_position_opening_validator', 'PositionOpeningValidator')
        ]
        
        import_results = []
        
        # Change to framework directory for imports
        original_path = os.getcwd()
        os.chdir(self.base_path)
        
        try:
            for module_name, class_name in critical_imports:
                try:
                    # Try actual import
                    spec = importlib.util.spec_from_file_location(
                        module_name, 
                        self.base_path / f"{module_name.replace('.', '/')}.py"
                    )
                    if spec and spec.loader:
                        module = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(module)
                        
                        # Try to get the class
                        if hasattr(module, class_name):
                            import_results.append({
                                'module': module_name,
                                'class': class_name,
                                'status': 'SUCCESS',
                                'error': None
                            })
                        else:
                            import_results.append({
                                'module': module_name,
                                'class': class_name,
                                'status': 'CLASS_NOT_FOUND',
                                'error': f"Class {class_name} not found in module"
                            })
                    else:
                        import_results.append({
                            'module': module_name,
                            'class': class_name,
                            'status': 'MODULE_SPEC_FAILED',
                            'error': "Could not create module spec"
                        })
                        
                except Exception as e:
                    import_results.append({
                        'module': module_name,
                        'class': class_name,
                        'status': 'FAILED',
                        'error': str(e)
                    })
        finally:
            os.chdir(original_path)
        
        self.import_failures = [r for r in import_results if r['status'] != 'SUCCESS']
        return {
            'total_tests': len(critical_imports),
            'successes': len([r for r in import_results if r['status'] == 'SUCCESS']),
            'failures': len(self.import_failures),
            'results': import_results
        }
    
    def find_all_placeholders_brutally(self) -> Dict:
        """Find EVERY placeholder, TODO, incomplete implementation"""
        print("[BRUTAL] Hunting for ALL placeholders and incomplete code...")
        
        placeholder_patterns = [
            (r'TODO:?(?!\s*(?:COMPLETED|DONE|FIXED))', 'TODO comment'),
            (r'FIXME:?(?!\s*(?:COMPLETED|DONE|FIXED))', 'FIXME comment'),
            (r'XXX:?(?!\s*(?:COMPLETED|DONE|FIXED))', 'XXX comment'),
            (r'PLACEHOLDER(?!\s*(?:REPLACED|IMPLEMENTED))', 'PLACEHOLDER text'),
            (r'NotImplementedError', 'NotImplementedError exception'),
            (r'raise\s+NotImplemented', 'NotImplemented exception'),
            (r'pass\s*#.*(?:todo|fixme|placeholder|temp|implement)', 'Placeholder pass statement'),
            (r'\.\.\.(?!\s*\))', 'Ellipsis placeholder'),
            (r'#.*(?:stub|skeleton|template)(?!\s*(?:complete|done|final))', 'Stub/skeleton code'),
            (r'#.*(?:not.*implemented|to.*be.*implemented)', 'Not implemented comment'),
            (r'"(?:TODO|FIXME|PLACEHOLDER)"', 'Placeholder string literal'),
            (r"'(?:TODO|FIXME|PLACEHOLDER)'", 'Placeholder string literal'),
            (r'return\s+None\s*#.*(?:todo|fixme|implement)', 'Placeholder return'),
            (r'def\s+\w+\([^)]*\):\s*(?:#[^\n]*)?\s*pass\s*$', 'Empty function stub'),
            (r'class\s+\w+[^:]*:\s*(?:#[^\n]*)?\s*pass\s*$', 'Empty class stub')
        ]
        
        violations = []
        
        for py_file in self.base_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ['.git', '__pycache__', 'venv']):
                continue
                
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    lines = content.splitlines()
                    
                for pattern, violation_type in placeholder_patterns:
                    for match in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
                        line_num = content[:match.start()].count('\n') + 1
                        line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ''
                        
                        # Skip if it's in an audit/test tool or comment about the pattern
                        if any(exclude in str(py_file).lower() for exclude in ['audit', 'test_', 'fixer', 'repair']):
                            continue
                            
                        violations.append({
                            'file': str(py_file.relative_to(self.base_path)),
                            'line': line_num,
                            'type': violation_type,
                            'content': line_content,
                            'match': match.group()
                        })
                        
            except Exception as e:
                violations.append({
                    'file': str(py_file.relative_to(self.base_path)),
                    'line': 0,
                    'type': 'FILE_READ_ERROR',
                    'content': f"Error reading file: {str(e)}",
                    'match': ''
                })
        
        self.placeholder_violations = violations
        return {
            'total_violations': len(violations),
            'violations': violations
        }
    
    def find_all_truncations_brutally(self) -> Dict:
        """Find EVERY truncation, incomplete implementation, cut-off code"""
        print("[BRUTAL] Hunting for ALL truncations and incomplete code...")
        
        truncation_patterns = [
            (r'\.\.\.(?:\s*#.*(?:truncated|more|continues|cut.*off))', 'Explicit truncation marker'),
            (r'#.*(?:truncated|cut.*off|continues.*but.*not.*shown)', 'Truncation comment'),
            (r'#.*(?:\[.*more.*code.*\]|\[.*continued.*\])', 'More code marker'),
            (r'#.*(?:implementation.*incomplete|partial.*implementation)', 'Incomplete implementation'),
            (r'#.*(?:rest.*of.*code|additional.*code.*needed)', 'Missing code indication'),
            (r'def\s+\w+\([^)]*\):[^}]*?#.*(?:incomplete|partial)', 'Incomplete function'),
            (r'class\s+\w+[^:]*:[^}]*?#.*(?:incomplete|partial)', 'Incomplete class'),
            (r'if.*:.*#.*(?:handle.*later|implement.*later)', 'Deferred implementation'),
            (r'except.*:.*#.*(?:handle.*later|implement.*later)', 'Deferred exception handling')
        ]
        
        violations = []
        
        for py_file in self.base_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ['.git', '__pycache__', 'venv']):
                continue
                
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    lines = content.splitlines()
                    
                for pattern, violation_type in truncation_patterns:
                    for match in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE | re.DOTALL):
                        line_num = content[:match.start()].count('\n') + 1
                        line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ''
                        
                        # Skip audit tools
                        if any(exclude in str(py_file).lower() for exclude in ['audit', 'test_', 'fixer', 'repair']):
                            continue
                            
                        violations.append({
                            'file': str(py_file.relative_to(self.base_path)),
                            'line': line_num,
                            'type': violation_type,
                            'content': line_content,
                            'match': match.group()[:100]  # Limit match display
                        })
                        
            except Exception as e:
                pass  # Skip file read errors for this check
        
        self.truncation_violations = violations
        return {
            'total_violations': len(violations),
            'violations': violations
        }
    
    def find_shortcuts_and_hacks_brutally(self) -> Dict:
        """Find ALL shortcuts, hacks, temporary solutions"""
        print("[BRUTAL] Hunting for ALL shortcuts and hack implementations...")
        
        shortcut_patterns = [
            (r'#.*(?:quick.*fix|quick.*hack)', 'Quick fix comment'),
            (r'#.*(?:temporary|temp)(?!\s*(?:file|dir))', 'Temporary solution'),
            (r'#.*\bhack\b(?!\s*(?:proof|secure))', 'Hack comment'),
            (r'#.*workaround(?!\s+for\s+(?:known|documented))', 'Workaround without explanation'),
            (r'#.*shortcut', 'Shortcut comment'),
            (r'#.*(?:lazy|sloppy|dirty).*(?:implementation|fix)', 'Lazy implementation'),
            (r'#.*(?:should.*be.*better|needs.*improvement)', 'Improvement needed'),
            (r'#.*(?:not.*ideal|suboptimal)', 'Suboptimal implementation'),
            (r'sleep\(\d+\)', 'Hard-coded sleep (potential shortcut)'),
            (r'time\.sleep\(\d+\)', 'Hard-coded time.sleep'),
            (r'import\s+time.*#.*(?:temp|quick)', 'Temporary time import'),
            (r'try:.*except:.*pass.*#.*(?:ignore|suppress)', 'Exception suppression shortcut')
        ]
        
        violations = []
        
        for py_file in self.base_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ['.git', '__pycache__', 'venv']):
                continue
                
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    lines = content.splitlines()
                    
                for pattern, violation_type in shortcut_patterns:
                    for match in re.finditer(pattern, content, re.IGNORECASE | re.MULTILINE):
                        line_num = content[:match.start()].count('\n') + 1
                        line_content = lines[line_num - 1].strip() if line_num <= len(lines) else ''
                        
                        # Skip audit tools
                        if any(exclude in str(py_file).lower() for exclude in ['audit', 'test_', 'fixer', 'repair']):
                            continue
                            
                        violations.append({
                            'file': str(py_file.relative_to(self.base_path)),
                            'line': line_num,
                            'type': violation_type,
                            'content': line_content,
                            'match': match.group()
                        })
                        
            except Exception as e:
                pass  # Skip file read errors
        
        self.shortcut_violations = violations
        return {
            'total_violations': len(violations),
            'violations': violations
        }
    
    def find_actual_redundancies_brutally(self) -> Dict:
        """Find ACTUAL code redundancies and duplications"""
        print("[BRUTAL] Hunting for REAL redundancies and duplicate code...")
        
        violations = []
        function_signatures = {}
        class_definitions = {}
        import_statements = {}
        
        for py_file in self.base_path.rglob("*.py"):
            if any(skip in str(py_file) for skip in ['.git', '__pycache__', 'venv']):
                continue
                
            try:
                with open(py_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                # Skip audit/test files
                if any(exclude in str(py_file).lower() for exclude in ['audit', 'test_', 'fixer', 'repair']):
                    continue
                
                # Check for duplicate imports within same file
                imports = re.findall(r'^(?:from\s+\S+\s+)?import\s+.+$', content, re.MULTILINE)
                seen_imports = set()
                for imp in imports:
                    if imp in seen_imports:
                        violations.append({
                            'file': str(py_file.relative_to(self.base_path)),
                            'type': 'duplicate_import_same_file',
                            'content': imp,
                            'severity': 'medium'
                        })
                    seen_imports.add(imp)
                
                # Check for similar function implementations
                functions = re.finditer(r'def\s+(\w+)\s*\([^)]*\):(.*?)(?=def\s+\w+|class\s+\w+|\Z)', content, re.DOTALL)
                for func_match in functions:
                    func_name = func_match.group(1)
                    func_body = func_match.group(2)
                    
                    # Normalize function body for comparison
                    normalized = re.sub(r'\s+', ' ', func_body).strip()
                    normalized = re.sub(r'self\.\w+', 'self.VAR', normalized)
                    normalized = re.sub(r'[\'"][^\'\"]*[\'"]', 'STRING', normalized)
                    
                    # Skip very small functions
                    if len(normalized) < 50:
                        continue
                        
                    signature_key = f"{func_name}_{hash(normalized) % 10000}"
                    
                    if normalized in function_signatures:
                        violations.append({
                            'file': str(py_file.relative_to(self.base_path)),
                            'type': 'duplicate_function_implementation',
                            'content': f"Function '{func_name}' similar to '{function_signatures[normalized]['function']}'",
                            'other_file': function_signatures[normalized]['file'],
                            'severity': 'high'
                        })
                    else:
                        function_signatures[normalized] = {
                            'file': str(py_file.relative_to(self.base_path)),
                            'function': func_name
                        }
                        
            except Exception as e:
                pass  # Skip file processing errors
        
        self.redundancy_violations = violations
        return {
            'total_violations': len(violations),
            'violations': violations
        }
    
    def execute_brutal_audit(self) -> Dict:
        """Execute the most thorough audit possible"""
        print("=" * 80)
        print("BRUTAL REALITY CHECK AUDIT - NO MERCY")
        print("=" * 80)
        print("Finding EVERY remaining issue - no assumptions, no shortcuts")
        print("=" * 80)
        
        results = {}
        
        # Test 1: Compilation of every Python file
        results['compilation'] = self.test_every_python_file_compilation()
        
        # Test 2: Actual import testing
        results['imports'] = self.test_actual_imports()
        
        # Test 3: Brutal placeholder hunting
        results['placeholders'] = self.find_all_placeholders_brutally()
        
        # Test 4: Brutal truncation hunting
        results['truncations'] = self.find_all_truncations_brutally()
        
        # Test 5: Brutal shortcut hunting
        results['shortcuts'] = self.find_shortcuts_and_hacks_brutally()
        
        # Test 6: Real redundancy detection
        results['redundancies'] = self.find_actual_redundancies_brutally()
        
        # Calculate totals
        self.total_issues = (
            results['compilation']['failures'] +
            results['imports']['failures'] +
            results['placeholders']['total_violations'] +
            results['truncations']['total_violations'] +
            results['shortcuts']['total_violations'] +
            results['redundancies']['total_violations']
        )
        
        results['summary'] = {
            'total_issues_found': self.total_issues,
            'zero_tolerance_achieved': self.total_issues == 0,
            'categories_with_issues': [k for k, v in results.items() 
                                     if k != 'summary' and 
                                     (v.get('failures', 0) > 0 or v.get('total_violations', 0) > 0)]
        }
        
        return results
    
    def generate_brutal_report(self, results: Dict) -> str:
        """Generate uncompromising audit report"""
        report = []
        report.append("=" * 80)
        report.append("BRUTAL REALITY CHECK AUDIT REPORT")
        report.append("=" * 80)
        
        if results['summary']['zero_tolerance_achieved']:
            report.append("🎯 ZERO-TOLERANCE STATUS: ✅ TRULY ACHIEVED")
        else:
            report.append("🎯 ZERO-TOLERANCE STATUS: ❌ STILL HAS ISSUES")
            report.append(f"TOTAL ISSUES FOUND: {results['summary']['total_issues_found']}")
        
        # Detailed breakdown
        for category, data in results.items():
            if category == 'summary':
                continue
                
            failures = data.get('failures', 0)
            violations = data.get('total_violations', 0)
            total_issues = failures + violations
            
            if total_issues > 0:
                report.append(f"\n❌ {category.upper()}: {total_issues} ISSUES")
                report.append("-" * 40)
                
                if 'failed_files' in data:
                    for failure in data['failed_files'][:3]:
                        report.append(f"  COMPILATION FAILURE: {failure['file']}")
                        report.append(f"    Error: {failure['error'][:100]}")
                        
                if 'results' in data:
                    failed_imports = [r for r in data['results'] if r['status'] != 'SUCCESS']
                    for failure in failed_imports[:3]:
                        report.append(f"  IMPORT FAILURE: {failure['module']}.{failure['class']}")
                        report.append(f"    Error: {failure['error'][:100]}")
                        
                if 'violations' in data:
                    for violation in data['violations'][:3]:
                        report.append(f"  {violation['type']}: {violation['file']}:{violation.get('line', 'unknown')}")
                        report.append(f"    {violation['content'][:100]}")
                        
                if total_issues > 3:
                    report.append(f"  ... and {total_issues - 3} more issues")
            else:
                report.append(f"\n✅ {category.upper()}: CLEAN")
        
        report.append("\n" + "=" * 80)
        if results['summary']['zero_tolerance_achieved']:
            report.append("AUDIT RESULT: ZERO-TOLERANCE TRULY ACHIEVED")
        else:
            report.append("AUDIT RESULT: MORE WORK REQUIRED")
        report.append("=" * 80)
        
        return "\n".join(report)

def main():
    """Execute brutal reality check"""
    framework_path = "D:/OneDrive/Trading/Claude/TomKingTradingFramework"
    
    audit = BrutalRealityAudit(framework_path)
    results = audit.execute_brutal_audit()
    
    report = audit.generate_brutal_report(results)
    print(report)
    
    # Save report
    with open(framework_path + "/brutal_reality_audit_report.txt", 'w') as f:
        f.write(report)
    
    return results['summary']['zero_tolerance_achieved']

if __name__ == "__main__":
    success = main()
    print(f"\nBRUTAL AUDIT COMPLETE: {'SUCCESS' if success else 'ISSUES FOUND'}")
    exit(0 if success else 1)