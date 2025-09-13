#!/usr/bin/env python3
"""
Documentation Verification Script
Prevents critical documentation/code drift by verifying all documented files exist

This script was created after discovering critical mismatches during Phase 2 verification:
- 3 documented risk management files didn't exist in actual codebase
- Could have led to implementation errors and developer confusion
"""

import os
import sys
import re
from pathlib import Path
from typing import List, Tuple, Dict

class DocumentationVerifier:
    def __init__(self, framework_root: str):
        self.framework_root = Path(framework_root)
        self.code_root = self.framework_root / "TomKingTradingFramework"
        self.issues_found = []
        self.files_verified = 0
        
    def verify_implementation_audit_protocol(self) -> List[str]:
        """Verify files listed in implementation-audit-protocol.md exist"""
        
        audit_file = self.framework_root / "Documentation/Development/implementation-audit-protocol.md"
        if not audit_file.exists():
            return [f"CRITICAL: {audit_file} does not exist"]
        
        issues = []
        content = audit_file.read_text(encoding='utf-8')
        
        # Extract file paths from the architecture map
        # Pattern: ├── filename.py or └── filename.py
        file_pattern = r'[├└]── ([a-zA-Z0-9_/\.]+\.py)'
        documented_files = re.findall(file_pattern, content)
        
        for file_path in documented_files:
            # Convert relative path to absolute
            full_path = self.code_root / file_path
            
            if not full_path.exists():
                issues.append(f"MISSING: {file_path} (documented but file doesn't exist)")
            else:
                self.files_verified += 1
        
        return issues
    
    def verify_unified_audit_methodology(self) -> List[str]:
        """Verify files listed in UNIFIED_AUDIT_METHODOLOGY.md exist"""
        
        audit_file = self.framework_root / "Documentation/Development/UNIFIED_AUDIT_METHODOLOGY.md"
        if not audit_file.exists():
            return [f"WARNING: {audit_file} does not exist"]
        
        issues = []
        content = audit_file.read_text(encoding='utf-8')
        
        # Same pattern as implementation audit protocol
        file_pattern = r'[├└]── ([a-zA-Z0-9_/\.]+\.py)'
        documented_files = re.findall(file_pattern, content)
        
        for file_path in documented_files:
            full_path = self.code_root / file_path
            
            if not full_path.exists():
                issues.append(f"MISSING: {file_path} (documented in UNIFIED_AUDIT_METHODOLOGY.md but file doesn't exist)")
            else:
                self.files_verified += 1
        
        return issues
    
    def verify_tastytrade_integration_docs(self) -> List[str]:
        """Verify TastyTrade integration files match documentation"""
        
        issues = []
        
        # Key TastyTrade files that should exist based on documentation
        tastytrade_files = [
            "brokers/tastytrade_api_client.py",
            "brokers/tastytrade_integration_adapter.py", 
            "brokers/tastytrade_websocket.py",
            "config/tastytrade_credentials_secure.py",
            "test_tastytrade_connection.py",
            "examples/tastytrade_integration_example.py"
        ]
        
        for file_path in tastytrade_files:
            full_path = self.code_root / file_path
            
            if not full_path.exists():
                issues.append(f"MISSING: {file_path} (TastyTrade integration file)")
            else:
                self.files_verified += 1
        
        return issues
    
    def verify_strategy_files(self) -> List[str]:
        """Verify strategy files with state machines exist"""
        
        issues = []
        
        # Expected strategy files based on documentation
        strategy_files = [
            "strategies/base_strategy_with_state.py",
            "strategies/friday_0dte_with_state.py",
            "strategies/lt112_with_state.py", 
            "strategies/ipmcc_with_state.py",
            "strategies/futures_strangle_with_state.py",
            "strategies/leap_put_ladders_with_state.py"
        ]
        
        for file_path in strategy_files:
            full_path = self.code_root / file_path
            
            if not full_path.exists():
                issues.append(f"MISSING: {file_path} (documented strategy with state machine)")
            else:
                self.files_verified += 1
        
        return issues
    
    def verify_core_systems(self) -> List[str]:
        """Verify core system files exist"""
        
        issues = []
        
        # Core files that must exist
        core_files = [
            "core/state_machine.py",
            "core/unified_state_manager.py",
            "core/unified_vix_manager.py", 
            "core/unified_position_sizer.py",
            "helpers/atomic_order_executor.py",
            "main.py"
        ]
        
        for file_path in core_files:
            full_path = self.code_root / file_path
            
            if not full_path.exists():
                issues.append(f"CRITICAL: {file_path} (core system file)")
            else:
                self.files_verified += 1
        
        return issues
    
    def scan_for_undocumented_files(self) -> List[str]:
        """Find Python files that might not be documented"""
        
        issues = []
        
        # Get all Python files in key directories
        key_dirs = ["core", "risk", "helpers", "strategies", "brokers"]
        
        documented_files = set()
        
        # Collect all documented files from audit protocols
        for doc_file in ["implementation-audit-protocol.md", "UNIFIED_AUDIT_METHODOLOGY.md"]:
            doc_path = self.framework_root / f"Documentation/Development/{doc_file}"
            if doc_path.exists():
                content = doc_path.read_text(encoding='utf-8')
                file_pattern = r'[├└]── ([a-zA-Z0-9_/\.]+\.py)'
                documented_files.update(re.findall(file_pattern, content))
        
        # Scan for actual files
        for dir_name in key_dirs:
            dir_path = self.code_root / dir_name
            if dir_path.exists():
                for py_file in dir_path.glob("**/*.py"):
                    if py_file.name == "__init__.py":
                        continue
                        
                    # Get relative path from code root
                    rel_path = py_file.relative_to(self.code_root)
                    rel_path_str = str(rel_path).replace("\\", "/")
                    
                    if rel_path_str not in documented_files:
                        issues.append(f"UNDOCUMENTED: {rel_path_str} (exists but not in documentation)")
        
        return issues
    
    def run_verification(self) -> bool:
        """Run complete verification suite"""
        
        print("=" * 60)
        print("DOCUMENTATION VERIFICATION STARTING")
        print("=" * 60)
        print(f"Framework Root: {self.framework_root}")
        print()
        
        # Run all verification checks
        all_issues = []
        
        print("1. Verifying implementation-audit-protocol.md files...")
        issues = self.verify_implementation_audit_protocol()
        if issues:
            all_issues.extend(issues)
            for issue in issues:
                print(f"  [FAIL] {issue}")
        else:
            print("  [OK] All files in implementation-audit-protocol.md exist")
        
        print("\n2. Verifying UNIFIED_AUDIT_METHODOLOGY.md files...")
        issues = self.verify_unified_audit_methodology()
        if issues:
            all_issues.extend(issues)
            for issue in issues:
                print(f"  [FAIL] {issue}")
        else:
            print("  [OK] All files in UNIFIED_AUDIT_METHODOLOGY.md exist")
        
        print("\n3. Verifying TastyTrade integration files...")
        issues = self.verify_tastytrade_integration_docs()
        if issues:
            all_issues.extend(issues)
            for issue in issues:
                print(f"  [FAIL] {issue}")
        else:
            print("  [OK] All TastyTrade integration files exist")
        
        print("\n4. Verifying strategy files...")
        issues = self.verify_strategy_files()
        if issues:
            all_issues.extend(issues)
            for issue in issues:
                print(f"  [FAIL] {issue}")
        else:
            print("  [OK] All documented strategy files exist")
        
        print("\n5. Verifying core system files...")
        issues = self.verify_core_systems()
        if issues:
            all_issues.extend(issues)
            for issue in issues:
                print(f"  [FAIL] {issue}")
        else:
            print("  [OK] All core system files exist")
        
        print("\n6. Scanning for undocumented files...")
        issues = self.scan_for_undocumented_files()
        if issues:
            all_issues.extend(issues)
            print(f"  [WARN] Found {len(issues)} potentially undocumented files:")
            for issue in issues[:10]:  # Show first 10
                print(f"    {issue}")
            if len(issues) > 10:
                print(f"    ... and {len(issues) - 10} more")
        else:
            print("  [OK] All Python files appear to be documented")
        
        # Summary
        print("\n" + "=" * 60)
        print("VERIFICATION SUMMARY")
        print("=" * 60)
        print(f"Files Verified: {self.files_verified}")
        print(f"Issues Found: {len(all_issues)}")
        
        if all_issues:
            print("\nALERT: ISSUES DETECTED:")
            critical_issues = [i for i in all_issues if "CRITICAL" in i]
            missing_issues = [i for i in all_issues if "MISSING" in i and "CRITICAL" not in i]
            undoc_issues = [i for i in all_issues if "UNDOCUMENTED" in i]
            
            if critical_issues:
                print(f"\n  CRITICAL ({len(critical_issues)}):")
                for issue in critical_issues:
                    print(f"    {issue}")
            
            if missing_issues:
                print(f"\n  MISSING FILES ({len(missing_issues)}):")
                for issue in missing_issues:
                    print(f"    {issue}")
            
            if undoc_issues:
                print(f"\n  UNDOCUMENTED ({len(undoc_issues)}):")
                for issue in undoc_issues[:5]:  # Show first 5
                    print(f"    {issue}")
                if len(undoc_issues) > 5:
                    print(f"    ... and {len(undoc_issues) - 5} more")
            
            print(f"\n[FAIL] VERIFICATION FAILED - {len(all_issues)} issues found")
            return False
        else:
            print("\n[OK] VERIFICATION PASSED - No critical issues found")
            print("INFO: Documentation is synchronized with codebase")
            return True

def main():
    """Main entry point"""
    
    # Detect framework root (look for main.py)
    current_dir = Path.cwd()
    framework_root = None
    
    # Check current directory and parents for main.py and TomKingTradingFramework
    for path in [current_dir] + list(current_dir.parents):
        if (path / "TomKingTradingFramework" / "main.py").exists() and (path / "Documentation").exists():
            framework_root = path
            break
        # Also check if we're inside TomKingTradingFramework
        if (path / "main.py").exists() and (path.parent / "Documentation").exists():
            framework_root = path.parent
            break
    
    if framework_root is None:
        print("ERROR: Could not find Tom King Trading Framework root directory")
        print("   Looking for directory containing main.py and Documentation/")
        sys.exit(1)
    
    # Run verification
    verifier = DocumentationVerifier(str(framework_root))
    success = verifier.run_verification()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()