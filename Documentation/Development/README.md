# Development Documentation

This directory contains development protocols and tools for the Tom King Trading Framework.

## Files

### [`implementation-audit-protocol.md`](implementation-audit-protocol.md)
Comprehensive protocol for preventing redundant implementations and ensuring systematic development approach.

**Key Features:**
- Pre-change verification checklist
- System architecture mapping guidelines  
- Approved implementation patterns vs anti-patterns
- Change impact analysis framework

**Usage:** Review before making any changes to the trading framework to prevent redundant implementations.

### [`audit-tools.sh`](audit-tools.sh)  
Practical implementation of the audit protocol as executable bash scripts.

**Commands:**
```bash
# Audit existing implementations before changes
./audit-tools.sh audit kelly

# Validate for redundant implementations
./audit-tools.sh validate calculate_position_size

# Show system architecture map
./audit-tools.sh map

# Check interface compatibility  
./audit-tools.sh interfaces

# Quick framework health check
./audit-tools.sh health
```

## Integration with Development Workflow

1. **Before implementing any fix:** Run `./audit-tools.sh audit <concept>` to check existing implementations
2. **After making changes:** Run `./audit-tools.sh validate <function>` to check for redundancy
3. **Regular maintenance:** Run `./audit-tools.sh health` to detect common issues

## Protocol Adherence

The audit protocol prevents the redundancy issues encountered in previous development cycles by enforcing:

- ✅ Comprehensive system mapping before changes
- ✅ Leveraging existing unified managers (VIX, Position Sizing, State)
- ✅ Layered fallback patterns instead of duplicate implementations
- ✅ Consistent data validation approaches
- ❌ Avoiding hardcoded fallbacks and redundant calculations

Refer to [`implementation-audit-protocol.md`](implementation-audit-protocol.md) for detailed guidelines and examples.