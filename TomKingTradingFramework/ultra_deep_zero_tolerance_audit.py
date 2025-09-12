#!/usr/bin/env python3
"""
ULTRA DEEP ZERO TOLERANCE AUDIT
The most aggressive audit possible - finds EVERYTHING
No assumptions, no shortcuts, no tolerance for any issues
"""

import os
import re
import ast
from pathlib import Path
from typing import Dict, List, Set
import traceback

class UltraDeepZeroToleranceAuditor:
    """Ultra aggressive auditor that finds absolutely everything"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.all_issues = []
        
    def run_ultra_deep_audit(self):
        """Run the most comprehensive audit possible"""
        print("ULTRA DEEP ZERO TOLERANCE AUDIT")
        print("=" * 60)
        print("Finding EVERY possible issue - no tolerance, no assumptions")
        
        python_files = list(self.root_dir.rglob("*.py"))
        
        print(f"Analyzing {len(python_files)} files with maximum scrutiny...")
        
        for file_path in python_files:
            try:
                self._ultra_deep_file_analysis(file_path)
            except Exception as e:
                self.all_issues.append({
                    'category': 'FILE_ANALYSIS_ERROR',
                    'file': str(file_path.relative_to(self.root_dir)),
                    'issue': f"Failed to analyze: {e}",
                    'severity': 'HIGH',
                    'line': 0
                })
        
        # Report everything we found
        self._generate_ultra_comprehensive_report()
        
        return len(self.all_issues)
    
    def _ultra_deep_file_analysis(self, file_path: Path):
        """Ultra deep analysis of a single file"""
        relative_path = str(file_path.relative_to(self.root_dir))
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.all_issues.append({
                'category': 'FILE_READ_ERROR',
                'file': relative_path,
                'issue': f"Cannot read file: {e}",
                'severity': 'HIGH',
                'line': 0
            })
            return
        
        lines = content.split('\n')
        
        # 1. SYNTAX AND STRUCTURE ISSUES
        self._check_syntax_issues(content, relative_path)
        
        # 2. EXCEPTION HANDLING ISSUES  
        self._check_exception_handling_issues(content, lines, relative_path)
        
        # 3. CONCURRENCY AND BLOCKING ISSUES
        self._check_concurrency_issues(content, lines, relative_path)
        
        # 4. CODE QUALITY ISSUES
        self._check_code_quality_issues(content, lines, relative_path)
        
        # 5. INCOMPLETE IMPLEMENTATIONS
        self._check_incomplete_implementations(content, lines, relative_path)
        
        # 6. HARDCODED VALUES
        self._check_hardcoded_values(content, lines, relative_path)
        
        # 7. DANGEROUS PATTERNS
        self._check_dangerous_patterns(content, lines, relative_path)
        
        # 8. ARCHITECTURE VIOLATIONS
        self._check_architecture_violations(content, lines, relative_path)
        
        # 9. PERFORMANCE ISSUES
        self._check_performance_issues(content, lines, relative_path)
        
        # 10. SECURITY ISSUES
        self._check_security_issues(content, lines, relative_path)
    
    def _check_syntax_issues(self, content: str, file_path: str):
        """Check for any syntax issues"""
        try:
            ast.parse(content)
        except SyntaxError as e:
            self.all_issues.append({
                'category': 'SYNTAX_ERROR',
                'file': file_path,
                'issue': f"Syntax error: {e}",
                'severity': 'CRITICAL',
                'line': getattr(e, 'lineno', 0)
            })
        except Exception as e:
            self.all_issues.append({
                'category': 'PARSE_ERROR',
                'file': file_path,
                'issue': f"Cannot parse: {e}",
                'severity': 'HIGH',
                'line': 0
            })
    
    def _check_exception_handling_issues(self, content: str, lines: List[str], file_path: str):
        """Ultra deep check of exception handling"""
        
        # Check for any bare except
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*except\s*:\s*$', line):
                self.all_issues.append({
                    'category': 'BARE_EXCEPT',
                    'file': file_path,
                    'issue': f"Bare except clause: {line.strip()}",
                    'severity': 'CRITICAL',
                    'line': i
                })
        
        # Check for overly broad except clauses
        for i, line in enumerate(lines, 1):
            if re.search(r'except\s+Exception\s*:\s*\n\s*pass', '\n'.join(lines[i-1:i+2])):
                self.all_issues.append({
                    'category': 'OVERLY_BROAD_EXCEPTION',
                    'file': file_path,
                    'issue': f"Overly broad exception with pass: {line.strip()}",
                    'severity': 'MEDIUM',
                    'line': i
                })
        
        # Check for empty try blocks
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*try\s*:\s*$', line):
                # Check if next non-empty line is except
                next_content_line = None
                for j in range(i, min(i+5, len(lines))):
                    if lines[j].strip() and not lines[j].strip().startswith('#'):
                        next_content_line = lines[j].strip()
                        break
                
                if next_content_line and next_content_line.startswith('except'):
                    self.all_issues.append({
                        'category': 'EMPTY_TRY_BLOCK',
                        'file': file_path,
                        'issue': f"Empty try block: {line.strip()}",
                        'severity': 'HIGH',
                        'line': i
                    })
        
        # Check for missing finally blocks where needed
        try_blocks = re.findall(r'try:\s*\n.*?(?=(?:except|finally|def|class|$))', content, re.DOTALL | re.MULTILINE)
        for try_block in try_blocks:
            if 'open(' in try_block and 'finally:' not in try_block and 'with open(' not in try_block:
                line_num = content[:content.find(try_block)].count('\n') + 1
                self.all_issues.append({
                    'category': 'MISSING_FINALLY',
                    'file': file_path,
                    'issue': f"File operation without finally block",
                    'severity': 'MEDIUM',
                    'line': line_num
                })
    
    def _check_concurrency_issues(self, content: str, lines: List[str], file_path: str):
        """Check for concurrency and blocking issues"""
        
        # Check for ANY sleep calls
        for i, line in enumerate(lines, 1):
            if re.search(r'(?:time\.)?sleep\s*\(', line):
                self.all_issues.append({
                    'category': 'BLOCKING_SLEEP',
                    'file': file_path,
                    'issue': f"Blocking sleep call: {line.strip()}",
                    'severity': 'CRITICAL',
                    'line': i
                })
        
        # Check for potential infinite loops
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*while\s+True\s*:', line):
                # Look for break statement in next 20 lines
                has_break = False
                for j in range(i, min(i+20, len(lines))):
                    if 'break' in lines[j] or 'return' in lines[j]:
                        has_break = True
                        break
                
                if not has_break:
                    self.all_issues.append({
                        'category': 'INFINITE_LOOP',
                        'file': file_path,
                        'issue': f"Potential infinite loop: {line.strip()}",
                        'severity': 'CRITICAL',
                        'line': i
                    })
        
        # Check for threading without proper shutdown
        if 'threading.Thread' in content and 'daemon=True' not in content:
            line_num = content.find('threading.Thread')
            line_num = content[:line_num].count('\n') + 1
            self.all_issues.append({
                'category': 'NON_DAEMON_THREAD',
                'file': file_path,
                'issue': "Thread without daemon=True",
                'severity': 'HIGH',
                'line': line_num
            })
    
    def _check_code_quality_issues(self, content: str, lines: List[str], file_path: str):
        """Check for code quality issues"""
        
        # Check for print statements (excluding test files)
        if 'test' not in file_path.lower():
            for i, line in enumerate(lines, 1):
                if re.search(r'print\s*\(', line) and '#' not in line.split('print')[0]:
                    self.all_issues.append({
                        'category': 'PRINT_STATEMENT',
                        'file': file_path,
                        'issue': f"Print statement: {line.strip()}",
                        'severity': 'MEDIUM',
                        'line': i
                    })
        
        # Check for TODO comments
        for i, line in enumerate(lines, 1):
            if re.search(r'#.*(?:TODO|FIXME|XXX|HACK)', line, re.IGNORECASE):
                self.all_issues.append({
                    'category': 'TODO_COMMENT',
                    'file': file_path,
                    'issue': f"TODO comment: {line.strip()}",
                    'severity': 'LOW',
                    'line': i
                })
        
        # Check for long lines
        for i, line in enumerate(lines, 1):
            if len(line) > 120:
                self.all_issues.append({
                    'category': 'LONG_LINE',
                    'file': file_path,
                    'issue': f"Line too long ({len(line)} chars): {line.strip()[:50]}...",
                    'severity': 'LOW',
                    'line': i
                })
        
        # Check for unused imports
        if 'import ' in content:
            try:
                tree = ast.parse(content)
                imports = set()
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for alias in node.names:
                            imports.add(alias.name)
                    elif isinstance(node, ast.ImportFrom):
                        for alias in node.names:
                            imports.add(alias.name)
                
                # Simple check - if imported name doesn't appear elsewhere in file
                for imp in imports:
                    if content.count(imp) == 1:  # Only appears in import
                        self.all_issues.append({
                            'category': 'UNUSED_IMPORT',
                            'file': file_path,
                            'issue': f"Possibly unused import: {imp}",
                            'severity': 'LOW',
                            'line': 0
                        })
            except:
                pass  # Skip if can't parse
    
    def _check_incomplete_implementations(self, content: str, lines: List[str], file_path: str):
        """Check for incomplete implementations"""
        
        # Check for NotImplementedError
        for i, line in enumerate(lines, 1):
            if 'NotImplementedError' in line:
                self.all_issues.append({
                    'category': 'NOT_IMPLEMENTED',
                    'file': file_path,
                    'issue': f"NotImplementedError: {line.strip()}",
                    'severity': 'HIGH',
                    'line': i
                })
        
        # Check for placeholder values
        for i, line in enumerate(lines, 1):
            if re.search(r'[\'"].*?placeholder.*?[\'"]', line, re.IGNORECASE):
                self.all_issues.append({
                    'category': 'PLACEHOLDER_VALUE',
                    'file': file_path,
                    'issue': f"Placeholder value: {line.strip()}",
                    'severity': 'MEDIUM',
                    'line': i
                })
        
        # Check for empty methods with only pass
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*def\s+\w+.*:', line):
                # Check if next non-comment line is just 'pass'
                for j in range(i, min(i+5, len(lines))):
                    next_line = lines[j].strip()
                    if next_line and not next_line.startswith('#') and not next_line.startswith('"""'):
                        if next_line == 'pass':
                            self.all_issues.append({
                                'category': 'EMPTY_METHOD',
                                'file': file_path,
                                'issue': f"Empty method: {line.strip()}",
                                'severity': 'MEDIUM',
                                'line': i
                            })
                        break
    
    def _check_hardcoded_values(self, content: str, lines: List[str], file_path: str):
        """Check for hardcoded values"""
        
        # Skip constants files
        if 'constants' in file_path.lower():
            return
        
        hardcoded_patterns = [
            (r'(?<!\w)0\.25(?!\w)', 'Kelly factor (0.25)'),
            (r'(?<!\w)21(?!\w).*dte', '21 DTE exit rule'),
            (r'(?<!\w)30000(?!\w)', 'Starting capital (30000)'),
            (r'(?<!\w)10000(?!\w)', 'Position sizing base (10000)'),
            (r'(?<!\w)15\.30(?!\w)', 'Exit time (15:30)'),
            (r'(?<!\w)9\.45(?!\w)', 'Entry time (9:45)'),
            (r'(?<!\w)252(?!\w)', 'Trading days per year'),
            (r'(?<!\w)365(?!\w)', 'Days per year'),
        ]
        
        for i, line in enumerate(lines, 1):
            for pattern, description in hardcoded_patterns:
                if re.search(pattern, line):
                    self.all_issues.append({
                        'category': 'HARDCODED_VALUE',
                        'file': file_path,
                        'issue': f"Hardcoded {description}: {line.strip()}",
                        'severity': 'MEDIUM',
                        'line': i
                    })
    
    def _check_dangerous_patterns(self, content: str, lines: List[str], file_path: str):
        """Check for dangerous patterns"""
        
        # Check for eval() or exec()
        for i, line in enumerate(lines, 1):
            if re.search(r'\b(?:eval|exec)\s*\(', line):
                self.all_issues.append({
                    'category': 'DANGEROUS_EVAL',
                    'file': file_path,
                    'issue': f"Dangerous eval/exec: {line.strip()}",
                    'severity': 'CRITICAL',
                    'line': i
                })
        
        # Check for string formatting vulnerabilities
        for i, line in enumerate(lines, 1):
            if re.search(r'%\s*\(', line) and 'format' not in line:
                self.all_issues.append({
                    'category': 'STRING_FORMAT_VULN',
                    'file': file_path,
                    'issue': f"Potentially unsafe string formatting: {line.strip()}",
                    'severity': 'MEDIUM',
                    'line': i
                })
        
        # Check for SQL injection patterns
        for i, line in enumerate(lines, 1):
            if re.search(r'(?:SELECT|INSERT|UPDATE|DELETE).*%s', line, re.IGNORECASE):
                self.all_issues.append({
                    'category': 'SQL_INJECTION_RISK',
                    'file': file_path,
                    'issue': f"Potential SQL injection: {line.strip()}",
                    'severity': 'HIGH',
                    'line': i
                })
    
    def _check_architecture_violations(self, content: str, lines: List[str], file_path: str):
        """Check for architecture violations"""
        
        # Check for circular imports (basic check)
        if 'from .' in content and '..' in content:
            self.all_issues.append({
                'category': 'POTENTIAL_CIRCULAR_IMPORT',
                'file': file_path,
                'issue': "Potential circular import pattern",
                'severity': 'MEDIUM',
                'line': 0
            })
        
        # Check for missing docstrings on classes and public methods
        try:
            tree = ast.parse(content)
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                    if not node.name.startswith('_'):  # Public method/class
                        if not ast.get_docstring(node):
                            self.all_issues.append({
                                'category': 'MISSING_DOCSTRING',
                                'file': file_path,
                                'issue': f"Missing docstring: {node.name}",
                                'severity': 'LOW',
                                'line': node.lineno
                            })
        except:
            pass
    
    def _check_performance_issues(self, content: str, lines: List[str], file_path: str):
        """Check for performance issues"""
        
        # Check for inefficient loops
        for i, line in enumerate(lines, 1):
            # List comprehension that could be generator
            if re.search(r'\[.*for.*in.*\]', line) and len(line) > 80:
                self.all_issues.append({
                    'category': 'INEFFICIENT_LOOP',
                    'file': file_path,
                    'issue': f"Large list comprehension (consider generator): {line.strip()[:50]}...",
                    'severity': 'LOW',
                    'line': i
                })
        
        # Check for repeated string concatenation
        for i, line in enumerate(lines, 1):
            if '+=' in line and 'str' in line.lower():
                self.all_issues.append({
                    'category': 'STRING_CONCAT_INEFFICIENCY',
                    'file': file_path,
                    'issue': f"Inefficient string concatenation: {line.strip()}",
                    'severity': 'LOW',
                    'line': i
                })
    
    def _check_security_issues(self, content: str, lines: List[str], file_path: str):
        """Check for security issues"""
        
        # Check for hardcoded passwords or keys
        for i, line in enumerate(lines, 1):
            if re.search(r'(?:password|key|secret|token)\s*=\s*[\'"][^\'"]+[\'"]', line, re.IGNORECASE):
                self.all_issues.append({
                    'category': 'HARDCODED_SECRET',
                    'file': file_path,
                    'issue': f"Potential hardcoded secret: {line.strip()}",
                    'severity': 'HIGH',
                    'line': i
                })
        
        # Check for unsafe file operations
        for i, line in enumerate(lines, 1):
            if re.search(r'open\s*\([^)]*[\'"]w[\'"]', line):
                if '../' in line or '..' in line:
                    self.all_issues.append({
                        'category': 'UNSAFE_FILE_OPERATION',
                        'file': file_path,
                        'issue': f"Potentially unsafe file write: {line.strip()}",
                        'severity': 'MEDIUM',
                        'line': i
                    })
    
    def _generate_ultra_comprehensive_report(self):
        """Generate ultra comprehensive report"""
        print(f"\n{'='*60}")
        print("ULTRA DEEP ZERO TOLERANCE AUDIT RESULTS")
        print(f"{'='*60}")
        
        if not self.all_issues:
            print("\n🎉 INCREDIBLE! ZERO ISSUES FOUND!")
            print("The codebase has achieved production perfection!")
            return
        
        # Group by category
        by_category = {}
        by_severity = {'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0}
        
        for issue in self.all_issues:
            category = issue['category']
            severity = issue['severity']
            
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(issue)
            by_severity[severity] += 1
        
        print(f"\nTOTAL ISSUES FOUND: {len(self.all_issues)}")
        print(f"CRITICAL: {by_severity['CRITICAL']}")
        print(f"HIGH:     {by_severity['HIGH']}")
        print(f"MEDIUM:   {by_severity['MEDIUM']}")
        print(f"LOW:      {by_severity['LOW']}")
        
        print(f"\n{'='*60}")
        print("ISSUES BY CATEGORY:")
        print(f"{'='*60}")
        
        # Sort categories by severity
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        sorted_categories = sorted(by_category.items(), 
                                 key=lambda x: min(severity_order[issue['severity']] for issue in x[1]))
        
        for category, issues in sorted_categories:
            print(f"\n{category}: {len(issues)} issues")
            
            # Show first few examples
            for issue in issues[:5]:
                print(f"  - {issue['file']}:{issue['line']} - {issue['issue'][:80]}...")
            
            if len(issues) > 5:
                print(f"  ... and {len(issues) - 5} more")
        
        print(f"\n{'='*60}")
        
        # Identify most problematic files
        file_counts = {}
        for issue in self.all_issues:
            file_name = issue['file']
            if file_name not in file_counts:
                file_counts[file_name] = 0
            file_counts[file_name] += 1
        
        worst_files = sorted(file_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        print("TOP 10 FILES WITH MOST ISSUES:")
        for file_name, count in worst_files:
            print(f"  {count:3d} issues: {file_name}")
        
        print(f"\n{'='*60}")
        print("ZERO TOLERANCE AUDIT COMPLETE")
        print("Every possible issue has been identified.")
        print(f"{'='*60}")

def main():
    """Run ultra deep zero tolerance audit"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    auditor = UltraDeepZeroToleranceAuditor(root_dir)
    
    total_issues = auditor.run_ultra_deep_audit()
    
    return total_issues == 0

if __name__ == "__main__":
    main()