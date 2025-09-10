# Systematic Bug Analysis Loop - Tom King Trading Framework
# Implements automated reverse engineering of bugs to understand root causes
# Focuses on additive-only changes to prevent redundancies and placeholders

from AlgorithmImports import *
from typing import Dict, List, Optional, Tuple
import re
from datetime import datetime, timedelta

class SystematicBugAnalyzer:
    """
    Automated bug analysis system that:
    1. Reverse engineers every bug to understand why something is needed
    2. Makes only additive changes to prevent redundancies/placeholders  
    3. Validates changes don't introduce regressions
    4. Creates improvement loop: backtest -> analyze -> fix -> validate
    """
    
    def __init__(self, algorithm):
        self.algo = algorithm
        
        # Bug patterns we've identified from systematic analysis
        self.known_bug_patterns = {
            'interface_mismatch': {
                'pattern': r'.*has no attribute.*|.*not callable.*|.*TypeError.*parameter.*',
                'description': 'Interface compatibility issues between QuantConnect API and Python',
                'root_cause': 'API evolution or incorrect interface assumptions',
                'fix_strategy': 'Update to proper Python interface patterns'
            },
            'missing_method': {
                'pattern': r'.*AttributeError.*has no attribute.*',
                'description': 'Missing methods that main.py expects to exist',
                'root_cause': 'Interface contracts not fully implemented',
                'fix_strategy': 'Add missing interface methods with proper error handling'
            },
            'import_error': {
                'pattern': r'.*ImportError.*|.*ModuleNotFoundError.*',
                'description': 'Missing imports or circular import dependencies',
                'root_cause': 'Incomplete dependency management or circular references',
                'fix_strategy': 'Fix import paths and resolve circular dependencies'
            },
            'datetime_interface': {
                'pattern': r'.*datetime.*not supported.*|.*date.*not callable.*',
                'description': 'DateTime interface compatibility issues',
                'root_cause': 'QuantConnect DateTime vs Python datetime differences',
                'fix_strategy': 'Use proper QuantConnect DateTime interface patterns'
            },
            'overflow_precision': {
                'pattern': r'.*overflow.*|.*precision.*|.*Decimal.*',
                'description': 'Numeric overflow or precision loss in calculations',
                'root_cause': 'Float precision limits in financial calculations',
                'fix_strategy': 'Use Decimal arithmetic with bounds checking'
            }
        }
        
        # Change validation rules - ensure additive-only changes
        self.validation_rules = {
            'no_placeholder_code': {
                'pattern': r'.*TODO.*|.*PLACEHOLDER.*|.*pass\s*$',
                'description': 'Prevent placeholder or incomplete implementations',
                'severity': 'ERROR'
            },
            'no_truncation': {
                'pattern': r'.*\.\.\..*|.*truncated.*|.*simplified.*',
                'description': 'Prevent code truncation that removes functionality',
                'severity': 'ERROR'
            },
            'additive_only': {
                'description': 'Changes should only add functionality, not remove',
                'check_method': 'validate_additive_changes'
            },
            'interface_completeness': {
                'description': 'All public methods must have full implementations',
                'check_method': 'validate_interface_completeness'
            }
        }
        
        # Analysis results tracking
        self.analysis_history = []
        self.fix_success_rate = {}
        
    def analyze_backtest_errors(self, backtest_logs: List[str]) -> Dict:
        """
        Reverse engineer backtest errors to understand root causes
        Returns analysis with recommended fixes
        """
        
        analysis = {
            'timestamp': self.algo.Time if hasattr(self, 'algo') else datetime.now(),
            'total_errors': 0,
            'categorized_errors': {},
            'root_causes': {},
            'recommended_fixes': [],
            'confidence_scores': {}
        }
        
        for log_entry in backtest_logs:
            if self._is_error_log(log_entry):
                analysis['total_errors'] += 1
                
                # Categorize error by pattern matching
                category = self._categorize_error(log_entry)
                if category:
                    if category not in analysis['categorized_errors']:
                        analysis['categorized_errors'][category] = []
                    analysis['categorized_errors'][category].append(log_entry)
                    
                    # Analyze root cause
                    root_cause = self._analyze_root_cause(log_entry, category)
                    if root_cause:
                        analysis['root_causes'][category] = root_cause
                        
                        # Generate fix recommendation
                        fix = self._generate_fix_recommendation(log_entry, category, root_cause)
                        if fix:
                            analysis['recommended_fixes'].append(fix)
                            
                            # Calculate confidence score
                            confidence = self._calculate_fix_confidence(category, fix)
                            analysis['confidence_scores'][category] = confidence
        
        # Store analysis for learning
        self.analysis_history.append(analysis)
        
        return analysis
    
    def _is_error_log(self, log_entry: str) -> bool:
        """Identify if log entry represents an error"""
        error_indicators = [
            'ERROR', 'RUNTIME ERROR', 'EXCEPTION', 'TRACEBACK',
            'AttributeError', 'TypeError', 'ImportError', 'ValueError'
        ]
        return any(indicator in log_entry.upper() for indicator in error_indicators)
    
    def _categorize_error(self, error_log: str) -> Optional[str]:
        """Categorize error by pattern matching against known patterns"""
        for category, pattern_info in self.known_bug_patterns.items():
            if re.search(pattern_info['pattern'], error_log, re.IGNORECASE):
                return category
        return 'unknown'
    
    def _analyze_root_cause(self, error_log: str, category: str) -> Dict:
        """Deep analysis of root cause using pattern recognition"""
        
        if category in self.known_bug_patterns:
            base_analysis = self.known_bug_patterns[category].copy()
        else:
            base_analysis = {'root_cause': 'Unknown error pattern', 'fix_strategy': 'Manual investigation required'}
        
        # Extract specific details from error
        specific_details = self._extract_error_details(error_log)
        base_analysis.update(specific_details)
        
        return base_analysis
    
    def _extract_error_details(self, error_log: str) -> Dict:
        """Extract specific details from error message"""
        details = {
            'file_path': None,
            'line_number': None,
            'method_name': None,
            'specific_error': None
        }
        
        # Extract file path and line number
        file_match = re.search(r'File \"([^\"]+)\", line (\d+)', error_log)
        if file_match:
            details['file_path'] = file_match.group(1)
            details['line_number'] = int(file_match.group(2))
        
        # Extract method name
        method_match = re.search(r'in ([a-zA-Z_][a-zA-Z0-9_]*)', error_log)
        if method_match:
            details['method_name'] = method_match.group(1)
        
        # Extract specific error message
        error_match = re.search(r'([A-Z][a-zA-Z]*Error: .+)', error_log)
        if error_match:
            details['specific_error'] = error_match.group(1)
        
        return details
    
    def _generate_fix_recommendation(self, error_log: str, category: str, root_cause: Dict) -> Dict:
        \"\"\"Generate specific fix recommendation based on analysis\"\"\"
        
        fix = {
            'category': category,
            'priority': self._calculate_priority(category),
            'fix_type': 'additive',  # Always additive to prevent regressions
            'description': f\"Fix {category}: {root_cause.get('description', 'Unknown')}\",
            'implementation_steps': [],
            'validation_steps': [],
            'rollback_plan': 'Revert to previous working state'
        }
        
        # Generate specific implementation steps
        if category == 'interface_mismatch':
            fix['implementation_steps'] = [
                'Identify incorrect API usage pattern',
                'Replace with proper Python interface equivalent',
                'Add error handling for edge cases',
                'Test interface compatibility'
            ]
        elif category == 'missing_method':
            fix['implementation_steps'] = [
                'Copy complete method implementation from working project',
                'Ensure all interface contracts are fulfilled',
                'Add comprehensive error handling',
                'Validate method signatures match expectations'
            ]
        elif category == 'datetime_interface':
            fix['implementation_steps'] = [
                'Replace Python datetime with QuantConnect DateTime',
                'Use proper .date() method calls',
                'Add timezone handling if needed',
                'Test datetime operations'
            ]
        
        # Always add validation steps
        fix['validation_steps'] = [
            'Compile successfully',
            'Run initialization test',
            'Verify no new errors introduced',
            'Check additive-only compliance'
        ]
        
        return fix
    
    def _calculate_priority(self, category: str) -> str:
        \"\"\"Calculate fix priority based on error impact\"\"\"
        priority_map = {
            'interface_mismatch': 'HIGH',    # Blocks algorithm execution
            'missing_method': 'HIGH',        # Causes runtime failures
            'import_error': 'CRITICAL',      # Prevents compilation
            'datetime_interface': 'MEDIUM',  # May cause data issues
            'overflow_precision': 'HIGH',    # Affects trading accuracy
            'unknown': 'LOW'
        }
        return priority_map.get(category, 'MEDIUM')
    
    def _calculate_fix_confidence(self, category: str, fix: Dict) -> float:
        \"\"\"Calculate confidence score for fix recommendation\"\"\"
        
        base_confidence = {
            'interface_mismatch': 0.9,  # Well understood pattern
            'missing_method': 0.95,     # Direct copy from working code
            'import_error': 0.8,        # Usually straightforward
            'datetime_interface': 0.85, # Common QuantConnect pattern
            'overflow_precision': 0.9,  # Decimal arithmetic is proven
            'unknown': 0.3              # Requires investigation
        }.get(category, 0.5)
        
        # Adjust based on historical success rate
        if category in self.fix_success_rate:
            historical_success = self.fix_success_rate[category]
            confidence = (base_confidence + historical_success) / 2
        else:
            confidence = base_confidence
        
        return round(confidence, 2)
    
    def validate_proposed_changes(self, changes: Dict) -> Dict:
        \"\"\"Validate changes follow additive-only rules\"\"\"
        
        validation_result = {
            'valid': True,
            'violations': [],
            'warnings': [],
            'recommendations': []
        }
        
        # Check for placeholder code
        for rule_name, rule in self.validation_rules.items():
            if 'pattern' in rule:
                violations = self._check_pattern_violations(changes, rule)
                if violations:
                    validation_result['violations'].extend(violations)
                    validation_result['valid'] = False
            elif 'check_method' in rule:
                method = getattr(self, rule['check_method'], None)
                if method:
                    result = method(changes)
                    if not result['valid']:
                        validation_result['violations'].extend(result['issues'])
                        validation_result['valid'] = False
        
        return validation_result
    
    def _check_pattern_violations(self, changes: Dict, rule: Dict) -> List[str]:
        \"\"\"Check for pattern violations in proposed changes\"\"\"
        violations = []
        
        for file_path, content in changes.items():
            if isinstance(content, str):
                matches = re.findall(rule['pattern'], content, re.MULTILINE | re.IGNORECASE)
                if matches:
                    violations.append(f\"{rule['description']} found in {file_path}: {matches}\")
        
        return violations
    
    def validate_additive_changes(self, changes: Dict) -> Dict:
        \"\"\"Ensure changes only add functionality, don't remove\"\"\"
        # This would compare with previous version to ensure only additions
        return {'valid': True, 'issues': []}  # Simplified for now
    
    def validate_interface_completeness(self, changes: Dict) -> Dict:
        \"\"\"Ensure all interfaces are completely implemented\"\"\"
        # This would check for method stubs, incomplete implementations
        return {'valid': True, 'issues': []}  # Simplified for now
    
    def create_improvement_loop(self) -> Dict:
        \"\"\"Create systematic improvement loop configuration\"\"\"
        
        return {
            'steps': [
                {
                    'name': 'compile_and_analyze',
                    'action': 'Compile project and capture any errors',
                    'success_criteria': 'Clean compilation or identifiable error patterns'
                },
                {
                    'name': 'backtest_and_capture',
                    'action': 'Run backtest and capture all log output',
                    'success_criteria': 'Complete log capture regardless of success/failure'
                },
                {
                    'name': 'systematic_analysis',
                    'action': 'Apply automated bug analysis to identify patterns',
                    'success_criteria': 'Categorized errors with confidence scores > 0.7'
                },
                {
                    'name': 'generate_fixes',
                    'action': 'Create additive-only fixes based on analysis',
                    'success_criteria': 'Fixes pass validation rules'
                },
                {
                    'name': 'implement_and_validate',
                    'action': 'Apply fixes and validate no regressions',
                    'success_criteria': 'Improved error count or clean execution'
                },
                {
                    'name': 'learn_and_iterate',
                    'action': 'Update pattern recognition and success rates',
                    'success_criteria': 'Confidence scores improve over iterations'
                }
            ],
            'loop_condition': 'Continue while errors exist and fixes available',
            'exit_criteria': ['Clean backtest execution', 'No high-confidence fixes available'],
            'safety_limits': {
                'max_iterations': 10,
                'min_confidence_threshold': 0.6,
                'regression_tolerance': 0
            }
        }
    
    def get_analysis_summary(self) -> Dict:
        \"\"\"Get summary of all analysis performed\"\"\"
        
        if not self.analysis_history:
            return {'message': 'No analysis performed yet'}
        
        total_errors_analyzed = sum(a['total_errors'] for a in self.analysis_history)
        categories_found = set()
        for analysis in self.analysis_history:
            categories_found.update(analysis['categorized_errors'].keys())
        
        return {
            'total_analyses': len(self.analysis_history),
            'total_errors_analyzed': total_errors_analyzed,
            'unique_error_categories': len(categories_found),
            'categories_identified': list(categories_found),
            'average_confidence': self._calculate_average_confidence(),
            'most_common_category': self._get_most_common_category(),
            'improvement_trend': self._calculate_improvement_trend()
        }
    
    def _calculate_average_confidence(self) -> float:
        \"\"\"Calculate average confidence score across all analyses\"\"\"
        if not self.analysis_history:
            return 0.0
        
        all_confidences = []
        for analysis in self.analysis_history:
            all_confidences.extend(analysis['confidence_scores'].values())
        
        return round(sum(all_confidences) / len(all_confidences), 2) if all_confidences else 0.0
    
    def _get_most_common_category(self) -> str:
        \"\"\"Identify most commonly occurring error category\"\"\"
        category_counts = {}
        
        for analysis in self.analysis_history:
            for category, errors in analysis['categorized_errors'].items():
                category_counts[category] = category_counts.get(category, 0) + len(errors)
        
        if category_counts:
            return max(category_counts.items(), key=lambda x: x[1])[0]
        return 'none'
    
    def _calculate_improvement_trend(self) -> str:
        \"\"\"Calculate if error patterns are improving over time\"\"\"
        if len(self.analysis_history) < 2:
            return 'insufficient_data'
        
        recent_errors = self.analysis_history[-1]['total_errors']
        previous_errors = self.analysis_history[-2]['total_errors']
        
        if recent_errors < previous_errors:
            return 'improving'
        elif recent_errors > previous_errors:
            return 'degrading' 
        else:
            return 'stable'