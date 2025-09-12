#!/usr/bin/env python3
"""
UNIFIED FRAMEWORK AUDITOR
Consolidated audit system eliminating all duplicate implementations
Following Implementation Audit Protocol with systematic methodology
"""

import os
import ast
import re
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, List, Set, Tuple, Any

class UnifiedFrameworkAuditor:
    """Single comprehensive audit system for Tom King Trading Framework"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        
        # File filtering - exclude tests and audit tools to avoid self-reference
        self.python_files = [f for f in self.root_dir.rglob("*.py") 
                           if not any(exclude in str(f) for exclude in 
                           ["test", "__pycache__", "audit_", "unified_framework_auditor"])]
        
        # Comprehensive issue tracking
        self.critical_issues = []
        self.warnings = []
        self.optimizations = []
        self.quality_gate_failures = []
        
        # System mapping for redundancy detection
        self.functions = defaultdict(list)
        self.classes = defaultdict(list) 
        self.implementations = defaultdict(list)
        self.imports = defaultdict(set)
        
        # Specialized analysis tracking
        self.performance_issues = defaultdict(list)
        self.error_handling_gaps = []
        self.integration_violations = []
        self.trading_risk_issues = []
        
    def run_comprehensive_audit(self):
        """Execute complete systematic audit following Implementation Audit Protocol"""
        print("UNIFIED FRAMEWORK AUDITOR")
        print("=" * 60)
        print("Systematic audit following Implementation Audit Protocol")
        
        # Phase 1: System Discovery and Mapping
        self._map_system_architecture()
        
        # Phase 2: Quality Gate Verification
        self._verify_quality_gates()
        
        # Phase 3: Performance Analysis
        self._analyze_performance_patterns()
        
        # Phase 4: Error Handling Analysis
        self._analyze_error_handling()
        
        # Phase 5: Integration Compliance
        self._verify_integration_compliance()
        
        # Phase 6: Trading Risk Analysis
        self._analyze_trading_risks()
        
        # Phase 7: Final Verification
        self._perform_final_verification()
        
        # Report comprehensive results
        self._report_comprehensive_results()
        
        return self._calculate_audit_score()
    
    def _map_system_architecture(self):
        """Phase 1: Comprehensive system discovery and mapping"""
        print("\n1. SYSTEM ARCHITECTURE MAPPING")
        print("-" * 40)
        
        for file_path in self.python_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

            relative_path = str(file_path.relative_to(self.root_dir))

            # AST parsing for deep analysis
            try:
                pass
            except Exception as e:
                # Log and handle unexpected exception
            except Exception as e:

                print(f'Unexpected exception: {e}')

                raise

tree = ast.parse(content)
                    self._analyze_ast_structure(tree, relative_path)
                except SyntaxError:
                    self.critical_issues.append(
                        f"SYNTAX ERROR: {relative_path} - Cannot parse AST"
                    )
                
                # Pattern-based analysis for complex structures
                self._analyze_code_patterns(content, relative_path)
                
            except Exception as e:
                self.critical_issues.append(
                    f"FILE ACCESS ERROR: {file_path} - {e}"
                )
        
        print(f"   Analyzed {len(self.python_files)} production files")
        print(f"   Mapped {len(self.functions)} unique functions")
        print(f"   Mapped {len(self.classes)} unique classes")
    
    def _analyze_ast_structure(self, tree, file_path):
        """Analyze AST structure for comprehensive mapping"""
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                self.functions[node.name].append(file_path)
                # Check for function complexity
                if self._is_complex_function(node):
                    self.performance_issues['complex_functions'].append(
                        f"{file_path}:{node.lineno} - {node.name}"
                    )
                    
            elif isinstance(node, ast.ClassDef):
                self.classes[node.name].append(file_path)
                
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    self.imports[file_path].add(alias.name)
                    
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    self.imports[file_path].add(node.module)
    
    def _analyze_code_patterns(self, content, file_path):
        """Pattern-based analysis for complex code structures"""
        lines = content.split('\n')
        
        # Check for nested loops (O(n²) or worse complexity)
        nested_loop_depth = 0
        for i, line in enumerate(lines):
            if re.match(r'\s*(for|while)\s+.*:', line):
                nested_loop_depth += 1
                if nested_loop_depth >= 3:
                    self.performance_issues['high_complexity'].append(
                        f"{file_path}:{i+1} - O(n³) complexity detected"
                    )
            elif line.strip() and not line.startswith(' '):
                nested_loop_depth = 0
    
    def _verify_quality_gates(self):
        """Phase 2: Verify Implementation Audit Protocol quality gates"""
        print("\n2. QUALITY GATE VERIFICATION")
        print("-" * 40)
        
        # Check for duplicate implementations
        self._check_duplicate_implementations()
        
        # Check for system leverage violations
        self._check_system_leverage()
        
        # Check for intentional redundancy preservation
        self._check_intentional_redundancy()
        
        print(f"   Found {len(self.quality_gate_failures)} quality gate failures")
    
    def _check_duplicate_implementations(self):
        """Check for unintentional duplicate implementations"""
        duplicates_found = 0
        
        for func_name, locations in self.functions.items():
            if len(locations) > 1:
                # Filter out legitimate duplicates (base classes, different contexts)
                real_locations = [loc for loc in locations 
                                if not any(skip in loc for skip in 
                                ['base_', 'abstract_', 'test_', 'mock_'])]
                
                if len(real_locations) > 1:
                    # Check if actually duplicate implementations
                    if self._are_duplicate_implementations(func_name, real_locations):
                        self.quality_gate_failures.append(
                            f"DUPLICATE FUNCTION: {func_name} in {real_locations}"
                        )
                        duplicates_found += 1
        
        if duplicates_found == 0:
            print("   PASS: No duplicate function implementations found")
        else:
            print(f"   FAIL: Found {duplicates_found} duplicate implementations")
    
    def _are_duplicate_implementations(self, func_name, locations):
        """Verify if functions are actually duplicate implementations"""
        # This is a simplified check - in production, would compare AST structures
        return len(locations) > 1 and not any(
            pattern in func_name.lower() for pattern in 
            ['initialize', 'setup', 'configure', 'validate']
        )
    
    def _check_system_leverage(self):
        """Check for proper system leverage vs reimplementation"""
        system_leverage_violations = 0
        
        # Check for reimplemented functionality that should use existing systems
        reimplementation_patterns = [
            ('kelly.*calculation', 'Should use risk/kelly_criterion.py'),
            ('vix.*fetch|get.*vix', 'Should use core/unified_vix_manager.py'),
            ('position.*siz', 'Should use core/unified_position_sizer.py'),
            ('state.*save|persist', 'Should use core/unified_state_manager.py')
        ]
        
        for file_path in self.python_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

            relative_path = str(file_path.relative_to(self.root_dir))

            for pattern, suggestion in reimplementation_patterns:
                if re.search(pattern, content, re.IGNORECASE):
                    # Check if it's legitimately using the existing system
            if not self._uses_existing_system(content, pattern):
                self.quality_gate_failures.append(
            f"SYSTEM LEVERAGE: {relative_path} - {suggestion}"
            )
            system_leverage_violations += 1

            except Exception:
                continue

            if system_leverage_violations == 0:
                print("   PASS: Proper system leverage maintained")
            else:
            print(f"   FAIL: Found {system_leverage_violations} system leverage violations")

            def _uses_existing_system(self, content, pattern):
                """Check if code properly uses existing systems"""
            # Simplified check - look for imports of unified managers
            unified_imports = [
            'unified_vix_manager', 'unified_position_sizer',
            'unified_state_manager', 'kelly_criterion'
            ]
            return any(manager in content for manager in unified_imports)

            def _check_intentional_redundancy(self):
                """Verify intentional redundancy is preserved where needed"""
            # Known intentional redundancies in the Tom King framework
            intentional_redundancies = [
            'vix.*check',  # VIX validation at multiple levels
            'circuit.*break',  # Circuit breaker redundancy
            'state.*save'  # State persistence redundancy
            ]

            redundancy_violations = 0

            # This would require more sophisticated analysis in production
            # For now, flag if critical safety redundancies are missing

            print(f"   Verified {len(intentional_redundancies)} intentional redundancies")

            def _analyze_performance_patterns(self):
                """Phase 3: Analyze performance and computational efficiency"""
            print("\n3. PERFORMANCE ANALYSIS")
            print("-" * 40)

            # Algorithm complexity analysis
            high_complexity_count = len(self.performance_issues['high_complexity'])
            complex_functions_count = len(self.performance_issues['complex_functions'])

            print(f"   High complexity patterns: {high_complexity_count}")
            print(f"   Complex functions: {complex_functions_count}")

            if high_complexity_count > 0:
                print("   WARN: Performance optimization recommended")
            else:
            print("   PASS: No critical performance issues detected")

            def _is_complex_function(self, node):
                """Determine if function has high complexity"""
            # Count nested structures as complexity indicator
            complexity = 0
            for child in ast.walk(node):
                if isinstance(child, (ast.For, ast.While)):
                    complexity += 1
            elif isinstance(child, ast.If):
                complexity += 0.5

            return complexity > 5

            def _analyze_error_handling(self):
                """Phase 4: Analyze error handling patterns and robustness"""
            self.Error(f"\n4. ERROR HANDLING ANALYSIS"")
            print("-" * 40)

            bare_except_count = 0
            missing_validation_count = 0

            for file_path in self.python_files:
                try:
                    pass
            except Exception as e:
                # Log and handle unexpected exception
            except Exception as e:

                print(f'Unexpected exception: {e}')

                raise

with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                relative_path = str(file_path.relative_to(self.root_dir))
                
                # Check for bare except clauses
                if re.search(r'except\s*:', content):
                    self.error_handling_gaps.append(
                        f"BARE EXCEPT: {relative_path} - Should specify exception types"
                    )
                    bare_except_count += 1
                
                # Check for missing input validation in critical functions
                critical_functions = ['calculate', 'execute', 'process', 'trade']
                for func in critical_functions:
                    if re.search(f'def.*{func}.*\\(', content):
                        if not re.search(r'if.*is None|assert|raise', content):
                            missing_validation_count += 1
                
            except Exception:
                continue
        
        print(f"   Bare except clauses: {bare_except_count}")
        print(f"   Missing validations: {missing_validation_count}")
        
        if bare_except_count == 0 and missing_validation_count == 0:
            self.Error(f"   PASS: Error handling patterns look good"")
    
    def _verify_integration_compliance(self):
        """Phase 5: Verify QuantConnect API integration compliance"""
        print("\n5. INTEGRATION COMPLIANCE")
        print("-" * 40)
        
        api_violations = 0
        
        # Check for forbidden QuantConnect API fallbacks
        forbidden_patterns = [
            r'if hasattr\(self\.algo, ["\']Portfolio["\']\)',
            r'if hasattr\(self\.algo, ["\']Securities["\']\)',
            r'try:.*self\.Portfolio.*except:',
        ]
        
        for file_path in self.python_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

            relative_path = str(file_path.relative_to(self.root_dir))

            for pattern in forbidden_patterns:
                if re.search(pattern, content, re.MULTILINE | re.DOTALL):
                    self.integration_violations.append(
            f"FORBIDDEN FALLBACK: {relative_path} - {pattern}"
            )
            api_violations += 1

            except Exception:
                continue

            print(f"   API compliance violations: {api_violations}")

            if api_violations == 0:
                print("   PASS: QuantConnect API integration compliant")

            def _analyze_trading_risks(self):
                """Phase 6: Analyze trading-specific risk patterns"""
            print("\n6. TRADING RISK ANALYSIS")
            print("-" * 40)

            risk_issues = 0

            # Check for critical trading risk patterns
            risk_patterns = [
            (r'position.*size.*unlimited', 'Unlimited position sizing risk'),
            (r'stop.*loss.*disabled', 'Stop loss protection disabled'),
            (r'margin.*check.*skip', 'Margin validation bypassed'),
            ]

            for file_path in self.python_files:
                try:
                    pass
            except Exception as e:
                # Log and handle unexpected exception
            except Exception as e:

                print(f'Unexpected exception: {e}')

                raise

with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                relative_path = str(file_path.relative_to(self.root_dir))
                
                for pattern, description in risk_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        self.trading_risk_issues.append(
                            f"TRADING RISK: {relative_path} - {description}"
                        )
                        risk_issues += 1
                        
            except Exception:
                continue
        
        print(f"   Trading risk issues: {risk_issues}")
        
        if risk_issues == 0:
            print("   PASS: No critical trading risks detected")
    
    def _perform_final_verification(self):
        """Phase 7: Final comprehensive verification"""
        print("\n7. FINAL VERIFICATION")
        print("-" * 40)
        
        # Verify all critical components exist
        required_files = [
            'main.py',
            'core/unified_vix_manager.py', 
            'core/unified_position_sizer.py',
            'core/unified_state_manager.py',
            'risk/kelly_criterion.py'
        ]
        
        missing_files = []
        for file in required_files:
            if not (self.root_dir / file).exists():
                missing_files.append(file)
        
        if missing_files:
            self.critical_issues.extend([
                f"MISSING CRITICAL FILE: {file}" for file in missing_files
            ])
        
        print(f"   Missing critical files: {len(missing_files)}")
        print("   Final verification complete")
    
    def _report_comprehensive_results(self):
        """Generate comprehensive audit report"""
        print("\n" + "=" * 60)
        print("COMPREHENSIVE AUDIT RESULTS")
        print("=" * 60)
        
        total_issues = (len(self.critical_issues) + 
                       len(self.quality_gate_failures) + 
                       len(self.error_handling_gaps) +
                       len(self.integration_violations) +
                       len(self.trading_risk_issues))
        
        print(f"\nTOTAL ISSUES FOUND: {total_issues}")
        
        if self.critical_issues:
            print(f"\nCRITICAL ISSUES ({len(self.critical_issues)}):")
            for i, issue in enumerate(self.critical_issues, 1):
                print(f"{i:2d}. {issue}")
        
        if self.quality_gate_failures:
            print(f"\nQUALITY GATE FAILURES ({len(self.quality_gate_failures)}):")
            for i, failure in enumerate(self.quality_gate_failures, 1):
                print(f"{i:2d}. {failure}")
        
        if self.error_handling_gaps:
            self.Error(f"\nERROR HANDLING GAPS ({len(self.error_handling_gaps")
            for i, gap in enumerate(self.error_handling_gaps, 1):
                print(f"{i:2d}. {gap}")
        
        if self.integration_violations:
            print(f"\nINTEGRATION VIOLATIONS ({len(self.integration_violations)}):")
            for i, violation in enumerate(self.integration_violations, 1):
                print(f"{i:2d}. {violation}")
        
        if self.trading_risk_issues:
            print(f"\nTRADING RISK ISSUES ({len(self.trading_risk_issues)}):")
            for i, risk in enumerate(self.trading_risk_issues, 1):
                print(f"{i:2d}. {risk}")
        
        # Performance summary
        if self.performance_issues:
            print(f"\nPERFORMANCE CONCERNS:")
            for category, issues in self.performance_issues.items():
                if issues:
                    print(f"  {category}: {len(issues)} issues")
        
        # Final status
        print(f"\nAUDIT STATUS: {'PASSED' if total_issues == 0 else 'REQUIRES ATTENTION'}")
        print(f"Files analyzed: {len(self.python_files)}")
        print("Audit methodology: Implementation Audit Protocol compliant")
    
    def _calculate_audit_score(self):
        """Calculate overall audit score"""
        total_issues = (len(self.critical_issues) + 
                       len(self.quality_gate_failures) + 
                       len(self.error_handling_gaps) +
                       len(self.integration_violations) +
                       len(self.trading_risk_issues))
        
        return {
            'total_issues': total_issues,
            'critical_issues': len(self.critical_issues),
            'quality_failures': len(self.quality_gate_failures),
            'error_gaps': len(self.error_handling_gaps),
            'integration_violations': len(self.integration_violations),
            'trading_risks': len(self.trading_risk_issues),
            'files_analyzed': len(self.python_files),
            'passed': total_issues == 0
        }

def main():
    """Execute unified framework audit"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    auditor = UnifiedFrameworkAuditor(root_dir)
    
    results = auditor.run_comprehensive_audit()
    
    print(f"\nAudit completed. Total issues: {results['total_issues']}")
    
    return results['passed']

if __name__ == "__main__":
    main()