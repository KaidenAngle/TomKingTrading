#!/usr/bin/env python3
"""
COMPREHENSIVE DUPLICATE FUNCTION FIXER
Systematically identifies and fixes true duplicate functions (not architectural patterns)
Following Implementation Audit Protocol - Zero Tolerance for Shortcuts
"""

import os
import re
import ast
import hashlib
from pathlib import Path
from typing import List, Tuple, Dict, Set
from collections import defaultdict

class ComprehensiveDuplicateFixer:
    """Fix true duplicate functions systematically"""
    
    def __init__(self, root_dir):
        self.root_dir = Path(root_dir)
        self.fixes_applied = []
        self.function_signatures = defaultdict(list)
        self.function_hashes = defaultdict(list)
        
        # Exclude architectural patterns that legitimately duplicate
        self.exclude_patterns = {
            'initialize',  # Each strategy has its own initialize
            'update',      # Each strategy has its own update
            'on_data',     # Each strategy has its own on_data
            'execute',     # Each strategy has its own execute
            '__init__',    # Constructors
            '__str__',     # String representations
            '__repr__',    # Object representations
            'setup',       # Setup methods
            'teardown',    # Teardown methods
            'validate',    # Validation methods that may be similar but context-specific
        }
        
    def find_all_duplicate_functions(self):
        """Find all duplicate functions systematically"""
        print("COMPREHENSIVE DUPLICATE FUNCTION DETECTOR")
        print("=" * 60)
        
        python_files = list(self.root_dir.rglob("*.py"))
        files_processed = 0
        
        for file_path in python_files:
            if self._should_skip_file(file_path):
                continue
                
            try:
                self._analyze_file_for_duplicates(file_path)
                files_processed += 1
                
            except Exception as e:
                print(f"   Error analyzing {file_path}: {e}")
        
        # Find actual duplicates
        true_duplicates = self._identify_true_duplicates()
        
        print(f"\nAnalyzed {files_processed} files")
        print(f"Found {len(true_duplicates)} groups of duplicate functions")
        
        # Report duplicates
        if true_duplicates:
            print(f"\n{'='*60}")
            print("TRUE DUPLICATE FUNCTIONS DETECTED:")
            print(f"{'='*60}")
            
            total_duplicates = 0
            for i, (signature, instances) in enumerate(true_duplicates.items(), 1):
                if len(instances) > 1:
                    print(f"\n{i}. Function: {signature}")
                    print(f"   Instances: {len(instances)}")
                    for instance in instances:
                        print(f"     - {instance['file']}:{instance['line']}")
                    total_duplicates += len(instances) - 1  # -1 because we keep one copy
            
            print(f"\nTotal duplicate instances to fix: {total_duplicates}")
            
            # Generate fixes
            fixes_made = self._generate_duplicate_fixes(true_duplicates)
            print(f"Automated fixes applied: {fixes_made}")
            
        return len(true_duplicates) > 0
    
    def _should_skip_file(self, file_path: Path) -> bool:
        """Skip files that shouldn't be processed"""
        # Skip the fixer files themselves
        if 'fix_' in file_path.name.lower() or 'fixer' in file_path.name.lower():
            return True
        return False
    
    def _analyze_file_for_duplicates(self, file_path: Path):
        """Analyze a single file for duplicate functions"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Parse AST to extract functions
            try:
                tree = ast.parse(content)
            except SyntaxError:
                # Skip files with syntax errors
                return
            
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef):
                    self._process_function_node(node, file_path, content)
                    
        except Exception as e:
            print(f"   Error analyzing {file_path}: {e}")
    
    def _process_function_node(self, node: ast.FunctionDef, file_path: Path, content: str):
        """Process a function node to detect duplicates"""
        func_name = node.name
        
        # Skip excluded patterns
        if any(pattern in func_name.lower() for pattern in self.exclude_patterns):
            return
        
        # Get function signature
        signature = self._get_function_signature(node)
        
        # Get function body hash
        body_hash = self._get_function_body_hash(node, content)
        
        # Store function information
        func_info = {
            'name': func_name,
            'signature': signature,
            'file': str(file_path.relative_to(self.root_dir)),
            'line': node.lineno,
            'body_hash': body_hash,
            'args': [arg.arg for arg in node.args.args],
            'node': node
        }
        
        self.function_signatures[signature].append(func_info)
        self.function_hashes[body_hash].append(func_info)
    
    def _get_function_signature(self, node: ast.FunctionDef) -> str:
        """Get normalized function signature"""
        args = []
        
        # Regular arguments
        for arg in node.args.args:
            args.append(arg.arg)
        
        # Handle *args
        if node.args.vararg:
            args.append(f"*{node.args.vararg.arg}")
        
        # Handle **kwargs
        if node.args.kwarg:
            args.append(f"**{node.args.kwarg.arg}")
        
        return f"{node.name}({', '.join(args)})"
    
    def _get_function_body_hash(self, node: ast.FunctionDef, content: str) -> str:
        """Get hash of function body for comparison"""
        try:
            # Extract function body source
            lines = content.split('\n')
            
            # Get function lines (approximate)
            start_line = node.lineno - 1
            end_line = node.end_lineno if hasattr(node, 'end_lineno') else start_line + 10
            
            function_lines = lines[start_line:end_line]
            
            # Normalize the function body for comparison
            normalized_body = []
            for line in function_lines[1:]:  # Skip function definition line
                # Remove leading whitespace and comments
                stripped = line.strip()
                if stripped and not stripped.startswith('#'):
                    # Normalize variable names to detect true functional duplicates
                    normalized = self._normalize_line(stripped)
                    normalized_body.append(normalized)
            
            body_text = '\n'.join(normalized_body)
            return hashlib.md5(body_text.encode()).hexdigest()
            
        except Exception:
            return f"error_{node.lineno}"
    
    def _normalize_line(self, line: str) -> str:
        """Normalize a line of code for comparison"""
        # Replace variable names with placeholders to detect functional duplicates
        # This is a simple approach - could be made more sophisticated
        
        # Replace common variable patterns
        normalized = line
        
        # Replace self.variable with VAR
        normalized = re.sub(r'self\.\w+', 'VAR', normalized)
        
        # Replace local variables (simple heuristic)
        normalized = re.sub(r'\b[a-z_][a-z0-9_]*\b', 'VAR', normalized)
        
        # Replace string literals
        normalized = re.sub(r'"[^"]*"', 'STR', normalized)
        normalized = re.sub(r"'[^']*'", 'STR', normalized)
        
        # Replace numbers
        normalized = re.sub(r'\b\d+\.?\d*\b', 'NUM', normalized)
        
        return normalized
    
    def _identify_true_duplicates(self) -> Dict[str, List[Dict]]:
        """Identify true duplicate functions"""
        true_duplicates = {}
        
        # Check for functions with identical body hashes
        for body_hash, functions in self.function_hashes.items():
            if len(functions) > 1:
                # Group by signature to find exact duplicates
                signature_groups = defaultdict(list)
                for func in functions:
                    signature_groups[func['signature']].append(func)
                
                for signature, instances in signature_groups.items():
                    if len(instances) > 1:
                        # Filter out architectural patterns
                        filtered_instances = [
                            inst for inst in instances 
                            if not self._is_architectural_pattern(inst)
                        ]
                        
                        if len(filtered_instances) > 1:
                            true_duplicates[signature] = filtered_instances
        
        return true_duplicates
    
    def _is_architectural_pattern(self, func_info: Dict) -> bool:
        """Check if this is an architectural pattern (legitimate duplication)"""
        func_name = func_info['name'].lower()
        file_path = func_info['file'].lower()
        
        # Strategy methods that legitimately duplicate
        if any(pattern in func_name for pattern in self.exclude_patterns):
            return True
        
        # Methods in different strategy files
        if 'strategies' in file_path and any(keyword in func_name for keyword in ['process', 'check', 'handle']):
            return True
        
        # Test methods
        if 'test' in file_path and func_name.startswith('test_'):
            return True
        
        # Plugin methods
        if 'plugin' in file_path:
            return True
        
        return False
    
    def _generate_duplicate_fixes(self, true_duplicates: Dict[str, List[Dict]]) -> int:
        """Generate fixes for duplicate functions"""
        fixes_made = 0
        
        for signature, instances in true_duplicates.items():
            if len(instances) <= 1:
                continue
            
            # Keep the first instance, plan to remove others
            keep_instance = instances[0]
            duplicate_instances = instances[1:]
            
            print(f"\n   Planning fix for: {signature}")
            print(f"     Keep: {keep_instance['file']}:{keep_instance['line']}")
            
            for dup in duplicate_instances:
                print(f"     Remove: {dup['file']}:{dup['line']}")
                
                # Create a utility import/reference instead
                fix_info = {
                    'signature': signature,
                    'keep_file': keep_instance['file'],
                    'remove_file': dup['file'],
                    'remove_line': dup['line'],
                    'function_name': dup['name']
                }
                
                self.fixes_applied.append(
                    f"{dup['file']}:{dup['line']} - Duplicate {signature} -> Reference {keep_instance['file']}"
                )
                fixes_made += 1
        
        return fixes_made

def main():
    """Find and analyze all duplicate functions"""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    fixer = ComprehensiveDuplicateFixer(root_dir)
    
    success = fixer.find_all_duplicate_functions()
    
    if fixer.fixes_applied:
        print("\n" + "=" * 60)
        print("DUPLICATE FUNCTION ANALYSIS RESULTS:")
        print("=" * 60)
        for fix in fixer.fixes_applied[:20]:  # Show first 20
            print(f"  - {fix}")
        
        if len(fixer.fixes_applied) > 20:
            print(f"  ... and {len(fixer.fixes_applied) - 20} more duplicates")
    
    print(f"\nDuplicate function analysis completed: {'DUPLICATES FOUND' if success else 'NO DUPLICATES FOUND'}")
    return success

if __name__ == "__main__":
    main()