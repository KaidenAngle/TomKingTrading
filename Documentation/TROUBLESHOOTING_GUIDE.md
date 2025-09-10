# Troubleshooting Guide

## Common Issues and Solutions

### 1. "VIX data unavailable - halting strategy"
**Cause**: VIX data feed issue or market closed
**Solution**: 
- Check if market is open
- Verify VIX symbol is added in Initialize()
- This is CORRECT behavior - never trade without VIX

### 2. "Circuit breaker triggered"
**Cause**: Rapid drawdown, high correlation, or margin spike
**Solution**:
- Wait 30 minutes minimum
- Check what triggered it in logs
- System will auto-recover to Phase 1 sizing
- This is PROTECTING you from disaster

### 3. "SPY concentration limit exceeded"
**Cause**: Too many strategies want SPY exposure
**Solution**:
- System is working correctly
- Wait for existing positions to close
- Check total SPY delta across all strategies

### 4. "State transition blocked"
**Cause**: Invalid state transition attempted
**Solution**:
- Check state machine diagram for valid transitions
- Verify current state in ObjectStore
- Each strategy has different valid transitions

### 5. "Partial fill detected"
**Cause**: Multi-leg order didn't complete atomically
**Solution**:
- System will attempt rollback automatically
- Check incomplete order groups in ObjectStore
- May require manual intervention

### 6. "Cannot enter position - Phase limit"
**Cause**: Trying to exceed phase-based position limits
**Solution**:
- Check current phase and limits
- This is CORRECT - prevents overtrading
- Advance phase through proven success only

### 7. "21 DTE defensive exit triggered"
**Cause**: Position reached 21 days to expiration
**Solution**: This is CORRECT - prevents gamma disasters

### 8. "Interface integrity test failed"
**Cause**: Component missing expected methods after changes
**Solution**:
- Run `python test_interface_integrity.py` to identify specific missing methods
- Add only the missing methods identified in the test report
- This prevents runtime crashes in production

### 9. "Framework directory organization issues"
**Cause**: Files moved without preserving git history
**Solution**:
- Always use `git mv` instead of copy/delete
- Check `git log --follow <file>` to verify history preservation
- See [Framework Organization Patterns](Architecture/FRAMEWORK_ORGANIZATION_PATTERNS.md)

### 10. "Redundant implementation detected"
**Cause**: Adding functionality that already exists elsewhere
**Solution**:
- Run implementation audit: `./audit-tools.sh audit <concept>`
- Use existing systems instead of creating duplicates
- Follow [Implementation Audit Protocol](Development/implementation-audit-protocol.md)

### 11. "Assuming problems exist without verification"
**Cause**: Starting development work based on assumptions
**Solution**:
- STOP - Run systematic interface audit first
- Use "audit before assume" methodology
- See [Systematic Interface Auditing](Architecture/SYSTEMATIC_INTERFACE_AUDITING.md)
- Most "problems" are actually assumptions - verify before fixing

## Development Best Practices

### Before Making ANY Changes:
1. **Audit existing implementations**: `./audit-tools.sh audit <concept>`
2. **Map current architecture**: `./audit-tools.sh map`
3. **Verify interface integrity**: `./audit-tools.sh interfaces` 
4. **Check for redundancy**: `./audit-tools.sh health`

### Never Skip These Verifications:
- Interface integrity testing before deployment
- Git history preservation during reorganization  
- Implementation audit protocol before adding new features
- Evidence-based development instead of assumption-driven work

**Remember**: Every line of code exists for a reason. Understand before changing.

### 8. "Order rejected - insufficient buying power"
**Cause**: Not enough margin for position
**Solution**:
- Check margin usage
- Reduce position size
- Close other positions if needed

## Common Mistakes to Avoid

### ❌ DON'T: Try to trade when circuit breaker active
✅ DO: Wait for system to clear the circuit breaker

### ❌ DON'T: Override phase-based limits
✅ DO: Earn advancement through proven success

### ❌ DON'T: Disable 21 DTE exit
✅ DO: Accept the exit as critical risk management

### ❌ DON'T: Add try/catch around VIX data
✅ DO: Let system fail-fast without VIX

### ❌ DON'T: Force trades when SPY concentrated
✅ DO: Wait or trade different underlyings

## Debug Commands

### Check System State
```python
self.Debug(f"System State: {self.state_manager.get_system_state()}")
self.Debug(f"Active Strategies: {self.state_manager.get_active_strategies()}")
self.Debug(f"Current Phase: {self.current_phase}")
```

### Check Risk Metrics
```python
self.Debug(f"SPY Delta: {self.spy_concentration_manager.get_total_delta()}")
self.Debug(f"Margin Used: {self.Portfolio.TotalMarginUsed}")
self.Debug(f"Portfolio Greeks: {self.greeks_monitor.get_portfolio_greeks()}")
```

### Check Circuit Breakers
```python
self.Debug(f"Circuit Breaker Status: {self._check_circuit_breakers()}")
self.Debug(f"Drawdown: {self.current_drawdown}")
self.Debug(f"Correlation: {self.correlation_limiter.get_max_correlation()}")
```

## Recovery Procedures

### After System Crash
1. System auto-loads states from ObjectStore
2. Check for incomplete orders
3. Verify position consistency
4. Resume from saved state

### After Circuit Breaker
1. Wait 30 minutes
2. System resets to Phase 1 sizing
3. Verify data feeds working
4. Start with single position

### After Partial Fill
1. Check rollback status
2. Verify no naked positions
3. May need manual close/reopen
4. Document issue for review

## Performance Issues

### Slow Execution
- Check number of active positions
- Verify data feeds responsive
- Review debug log size

### Memory Issues
- Check ObjectStore size
- Clear old debug logs
- Verify not storing price data

## Getting Help

### Information Hierarchy
1. Check COMPLETE_REFERENCE_GUIDE.md first
2. Check specific Architecture/ or Methodology/ docs
3. Review CRITICAL_DO_NOT_CHANGE.md
4. Check original TomKingMethodology/ docs

### Common Questions
- "Why 9:45 AM?" → Architecture/TIMING_WINDOWS_AND_SCHEDULING.md
- "Why 21 DTE?" → Methodology/21_DTE_DEFENSIVE_EXIT_RULE.md
- "Why Phase limits?" → Methodology/PHASE_BASED_PROGRESSION.md
- "Why fail-fast?" → Architecture/FAIL_FAST_ERROR_PHILOSOPHY.md

## Remember

Every "error" or "limitation" is actually protection:
- Circuit breakers prevent account destruction
- Phase limits prevent overtrading
- SPY limits prevent concentration risk
- 21 DTE exit prevents gamma disasters
- Fail-fast prevents trading with bad data

**The system is protecting you from expensive mistakes. Trust the safety systems.**