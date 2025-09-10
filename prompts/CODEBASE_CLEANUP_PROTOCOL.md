# Tom King Trading System - Complete Codebase Cleanup Protocol

## Mission: Eliminate All Waste, Redundancy, and Confusion

Execute a systematic cleanup of the entire Tom King Trading System codebase. Remove every trace of waste, redundancy, placeholder content, and confusing elements until the codebase is pristine and focused.

## PHASE 1: File & Directory Structure Cleanup

**Directory Organization:**
- **Remove duplicate directories** with similar names or purposes
- **Consolidate scattered files** into logical groupings
- **Eliminate empty or near-empty directories**
- **Standardize naming conventions** across all folders
- **Remove backup/temp directories** (anything with .bak, .tmp, .old, etc.)

**File Consolidation:**
- **Merge duplicate files** that serve the same purpose
- **Eliminate redundant configurations** (multiple config files for same thing)
- **Remove truncated/incomplete files** that serve no purpose
- **Consolidate similar utility functions** into single modules
- **Delete unused test files** or placeholder test stubs

## PHASE 2: Code Redundancy Elimination

**Duplicate Code Detection:**
```python
# Find and eliminate:
- Identical functions in multiple files
- Near-identical code blocks with minor variations
- Repeated calculations in different modules
- Duplicate constant definitions across files
- Redundant import statements
- Multiple implementations of same logic
```

**Consolidation Strategy:**
- **Create single authoritative implementation** for each function
- **Move shared utilities** to common modules
- **Establish single source of truth** for constants and configurations
- **Eliminate copy-paste patterns** through proper abstraction
- **Remove vestigial code** from refactoring attempts

## PHASE 3: Placeholder & Incomplete Content Removal

**Systematic Placeholder Hunt:**
```python
ELIMINATE_PATTERNS = [
    r"# TODO.*",
    r"# FIXME.*", 
    r"# XXX.*",
    r"# HACK.*",
    r"# TEMP.*",
    r"^\s*pass\s*$",
    r"^\s*\.\.\.\s*$",
    r"raise NotImplementedError",
    r"print\([\"']DEBUG:",
    r"print\([\"']PLACEHOLDER:",
    r"return None\s*#.*placeholder",
    r"def.*placeholder.*:",
    r"class.*Placeholder.*:",
    r"# This is a placeholder",
    r"# Implementation pending",
    r"# Will implement later",
]
```

**Content Removal:**
- **Delete all placeholder functions** that return dummy values
- **Remove commented-out code blocks** (dead code)
- **Eliminate debug print statements** and temporary logging
- **Remove incomplete docstrings** (just `"""TODO"""`type)
- **Delete empty try/except blocks** with only pass statements
- **Remove unused variables and imports**

## PHASE 4: Code Quality & Clarity Cleanup

**Naming Convention Standardization:**
- **Standardize variable names** (remove abbreviations, unclear names)
- **Unify function naming patterns** (consistent verb patterns)
- **Clarify class names** (remove generic names like Manager, Handler)
- **Standardize file names** (consistent patterns across modules)
- **Remove misleading names** that don't match actual functionality

**Code Structure Cleanup:**
- **Remove unnecessary nested functions** that could be standalone
- **Eliminate overly complex inheritance** that serves no purpose
- **Simplify overly abstracted code** that obscures functionality
- **Remove unused class methods** and properties
- **Consolidate similar classes** that duplicate functionality

## PHASE 5: Documentation & Comment Cleanup

**Comment Rationalization:**
- **Remove obvious comments** that just restate the code
- **Delete outdated comments** that no longer match the code
- **Eliminate redundant docstrings** across similar functions
- **Remove placeholder documentation** that adds no value
- **Consolidate repeated explanations** into single authoritative docs

**Documentation Cleanup:**
- **Remove duplicate README files** or conflicting documentation
- **Eliminate outdated installation instructions**
- **Remove redundant API documentation** that duplicates code comments
- **Delete incomplete documentation** that provides no useful information

## PHASE 6: Import & Dependency Cleanup

**Import Optimization:**
```python
# Clean up patterns like:
import sys, os, time, datetime  # Split to separate lines
from module import *            # Make specific
import unused_module           # Delete
import module as m             # Use full names for clarity
```

**Dependency Rationalization:**
- **Remove unused dependencies** from requirements files
- **Eliminate redundant imports** that import same functionality
- **Consolidate related imports** into logical groupings
- **Remove version conflicts** in dependency specifications
- **Clean up circular dependencies** through proper refactoring

## PHASE 7: Configuration & Settings Cleanup

**Configuration Consolidation:**
- **Merge duplicate config files** serving same purpose
- **Remove conflicting settings** across different configs
- **Eliminate unused configuration options**
- **Standardize configuration format** (all JSON, or all YAML, etc.)
- **Remove hardcoded values** scattered throughout code

**Settings Rationalization:**
- **Create single settings hierarchy** instead of scattered constants
- **Remove duplicate default values** defined in multiple places
- **Eliminate conflicting environment variable names**
- **Consolidate database/API connection settings**

## PHASE 8: Test & Validation Cleanup

**Test Code Cleanup:**
- **Remove duplicate test cases** testing same functionality
- **Eliminate empty test functions** with only pass statements
- **Consolidate similar test utilities** into shared modules
- **Remove outdated tests** for removed functionality
- **Clean up test data files** and remove unused fixtures

**Validation Logic Cleanup:**
- **Merge duplicate validation functions** across modules
- **Remove redundant error checking** that duplicates built-in validation
- **Consolidate similar exception handling** patterns
- **Eliminate defensive programming** that checks same thing multiple times

## PHASE 9: Performance & Efficiency Cleanup

**Efficiency Improvements:**
- **Remove redundant calculations** performed multiple times
- **Eliminate unnecessary data transformations** (convert, convert back)
- **Consolidate database queries** that fetch similar data
- **Remove inefficient loops** that could be simplified
- **Clean up memory leaks** from unclosed resources

**Algorithm Cleanup:**
- **Replace inefficient algorithms** with standard library equivalents
- **Remove reinvented wheels** (custom sort functions, etc.)
- **Eliminate unnecessary complexity** in simple operations
- **Consolidate similar mathematical operations**

## PHASE 10: Final Polish & Validation

**Comprehensive Review:**
- **Read every remaining file** to ensure it serves a clear purpose
- **Verify no functionality was lost** during cleanup
- **Confirm all remaining code** is actively used
- **Check that cleanup improved** rather than harmed readability
- **Validate system still works** after all cleanup

**Final Standards:**
- **Every file has a clear, single purpose**
- **No duplicate implementations exist**
- **No placeholder or incomplete content remains**
- **All naming is clear and consistent**
- **Code is as simple as possible but no simpler**
- **Directory structure is logical and organized**

## Success Criteria

The cleanup is complete when:
- [ ] No duplicate code exists anywhere in the codebase
- [ ] No placeholder implementations remain
- [ ] Every file serves a clear, unique purpose
- [ ] All naming conventions are consistent
- [ ] No unused imports, variables, or functions exist
- [ ] Directory structure is logical and organized
- [ ] No conflicting configurations or settings
- [ ] All comments and documentation add real value
- [ ] System functionality is preserved or improved
- [ ] Codebase is focused, clean, and maintainable

## Execution Instructions

**Work systematically through each phase:**
1. **Start with file structure** - organize the foundation
2. **Eliminate redundancies** - remove all duplicate implementations
3. **Clean placeholders** - remove all incomplete content
4. **Polish code quality** - improve clarity and consistency
5. **Validate functionality** - ensure nothing was broken
6. **Repeat until perfect** - continue until no improvements possible

**For every cleanup action, document:**
- What was removed/consolidated
- Why it was redundant/unnecessary  
- What impact the change has
- Verification that functionality is preserved

**Execute ruthlessly** - when in doubt, remove it. Clean code is better than cluttered code.