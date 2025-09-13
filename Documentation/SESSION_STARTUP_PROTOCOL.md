# Session Startup Protocol for Claude Code

## Overview
Protocol to ensure comprehensive documentation knowledge is loaded at the start of every Claude Code session for the Tom King Trading Framework project.

## Automatic Knowledge Loading

### Essential Documentation to Read on Startup:
```markdown
1. CRITICAL_DO_NOT_CHANGE.md - Mandatory rules and systematic development approach
2. TROUBLESHOOTING_GUIDE.md - Common issues and development best practices  
3. README.md - Complete framework overview and navigation
4. Development/implementation-audit-protocol.md - Core systematic methodology
5. Development/quick-reference.md - Immediate consultation guide
```

### Architecture Knowledge Priorities:
```markdown
High Priority (Always Load):
- UNIFIED_SYSTEM_VERIFICATION_METHODOLOGY.md - "Audit before assume" methodology
- FRAMEWORK_ORGANIZATION_PATTERNS.md - Directory structure and git patterns
- STATE_MACHINE_ARCHITECTURE.md - Production state management

Context-Specific (Load as Needed):
- PERFORMANCE_OPTIMIZATION_PATTERNS.md - When optimization work needed
- MULTI_AGENT_VERIFICATION_FRAMEWORK.md - When adding new components
- CRITICAL_RUNTIME_STABILIZATION_PATTERNS.md - When working with runtime issues
```

## User Startup Command

### Recommended Session Initialization:
```markdown
"Please read the following documentation files to refresh your knowledge of the Tom King Trading Framework:

Essential Files:
- Documentation/CRITICAL_DO_NOT_CHANGE.md
- Documentation/TROUBLESHOOTING_GUIDE.md  
- Documentation/Development/implementation-audit-protocol.md
- Documentation/Development/quick-reference.md

This ensures you have complete knowledge of:
- Systematic development methodology ('audit before assume')
- Critical rules that must never be changed
- Implementation audit protocol and tools
- Development best practices and troubleshooting

After reading these, you'll have full context for safe, systematic development work."
```

## Session Context Keywords

### Keywords That Should Trigger Documentation Reading:
- "interface" → Read unified system verification methodology
- "organization" → Read framework organization patterns
- "redundant" → Read implementation audit protocol
- "state machine" → Read state machine architecture
- "assume" → Read unified system verification methodology
- "development" → Read critical rules and troubleshooting

## Knowledge Verification Checklist

### After Documentation Reading, Verify Knowledge Of:
- [ ] **Systematic Auditing**: "Audit before assume" methodology
- [ ] **Implementation Protocol**: Pre-change verification steps
- [ ] **Critical Rules**: What must never be changed
- [ ] **Audit Tools**: `./audit-tools.sh` commands and usage
- [ ] **Interface Testing**: `test_interface_integrity.py` workflow
- [ ] **Framework Organization**: Directory structure patterns
- [ ] **Git History Preservation**: Use `git mv` never copy/delete
- [ ] **Evidence-Based Development**: Verify before fixing

## Automation Suggestions

### .claude-settings Integration:
```json
{
  "startupActions": [
    "Read Documentation/CRITICAL_DO_NOT_CHANGE.md",
    "Read Documentation/TROUBLESHOOTING_GUIDE.md", 
    "Read Documentation/Development/implementation-audit-protocol.md",
    "Read Documentation/Development/quick-reference.md"
  ],
  "contextKeywords": {
    "interface": "Read Documentation/Architecture/UNIFIED_SYSTEM_VERIFICATION_METHODOLOGY.md",
    "organization": "Read Documentation/Architecture/FRAMEWORK_ORGANIZATION_PATTERNS.md",
    "development": "Read Documentation/CRITICAL_DO_NOT_CHANGE.md"
  }
}
```

### Hook Integration:
```markdown
If Claude Code supports startup hooks, add:

<session-start-hook>
Read essential Tom King Trading Framework documentation:
- Documentation/CRITICAL_DO_NOT_CHANGE.md  
- Documentation/Development/implementation-audit-protocol.md
- Documentation/Development/quick-reference.md
This ensures complete systematic development knowledge.
</session-start-hook>
```

## Benefits of Consistent Documentation Loading

### Prevents Knowledge Gaps:
- No assumptions about existing problems
- Complete awareness of systematic methodology
- Understanding of critical rules and constraints
- Awareness of available tools and protocols

### Ensures Best Practices:
- Always use "audit before assume" approach
- Proper framework organization patterns
- Interface integrity verification workflow
- Evidence-based development decisions

### Maintains System Quality:
- Prevents redundant implementations
- Preserves architectural decisions
- Maintains git history properly
- Follows established patterns

## Implementation Notes

This protocol serves as documentation for the user to establish consistent session startup procedures. The user should reference this protocol when starting new Claude Code sessions to ensure comprehensive knowledge transfer and maintain the high-quality development standards established for the Tom King Trading Framework.

The systematic approach documented here guarantees that critical development methodology knowledge is never lost between sessions, preventing regression to assumption-driven development patterns that could compromise system quality and safety.