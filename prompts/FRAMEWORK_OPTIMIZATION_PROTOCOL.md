# Tom King Trading Framework - Comprehensive Optimization Protocol

**MANDATORY PRE-EXECUTION**: Before executing this prompt, you must have thoroughly read and understood the Tom King methodology document, README.md, CRITICAL_DO_NOT_CHANGE.md, SESSION_STARTUP_PROTOCOL.md, and Implementation Audit Protocol, ensuring you understand why 0DTE waits until 10:30 AM, why correlation limits exist (3 max per group), the August 5 disaster lesson, and all VIX-based position sizing rules - then proceed to solve all issues in an additive manner suitable for production with no placeholders, no truncations, no redundancies, no repeated functionality, no shortcuts, always utilizing documentation instructions, reverse engineering and auditing before any changes.

## Prompt: Framework Optimization & Cleanup Execution

Execute the attached COMPREHENSIVE_SYSTEM_ANALYSIS.md findings systematically to optimize and clean up the Tom King Trading Framework. Work through every discovered issue with meticulous attention to detail, using the Implementation Audit Protocol before ANY changes. This is extensive work requiring multiple passes - DO NOT stop until every optimization is complete and verified.

## Phase 1: Pre-Execution Audit & Mapping
**Time Estimate: 2-3 hours**
**Critical: Complete this ENTIRELY before making ANY changes**

### 1.1 Load and Verify System Analysis
```python
# First, load and parse the COMPREHENSIVE_SYSTEM_ANALYSIS.md
analysis_doc = load_document("COMPREHENSIVE_SYSTEM_ANALYSIS.md")

# Extract all findings:
- 250+ total files across 100+ components (not 92 as initially counted)
- 3 redundant caching systems identified
- 4 separate state management systems
- 15 managers with complex initialization
- Circular dependency chains documented
- Performance bottlenecks identified
```

### 1.2 Execute Implementation Audit Protocol
For EVERY finding in the analysis, run the mandatory audit:

```bash
# For each optimization area identified:
grep -r "cache\|Cache" . --include="*.py" | sort | uniq
grep -r "state\|State" . --include="*.py" | sort | uniq  
grep -r "manager\|Manager" . --include="*.py" | sort | uniq

# Map ALL existing implementations before touching anything
find . -name "*.py" -exec grep -l "HighPerformanceCache\|PositionAwareCache\|MarketDataCache" {} \;
```

### 1.3 Create Dependency Map
Document EVERY component that will be affected by optimizations:
- Which strategies use which caching systems?
- Which managers depend on which state systems?
- What will break if we consolidate?
- What tests exist for affected components?

### 1.4 Backup Critical Systems
```bash
# Create timestamped backup of entire framework
cp -r . ../tom_king_backup_$(date +%Y%m%d_%H%M%S)/

# Document current working state
git status > pre_optimization_state.txt
python main.py --test > pre_optimization_test.txt
```

## Phase 2: Caching System Consolidation
**Finding**: "3 Separate caching systems (HighPerformanceCache, PositionAwareCache, MarketDataCache)"
**Goal**: Single intelligent cache with automatic invalidation

### 2.1 Audit Existing Cache Usage
```python
# Map EVERY cache usage across all 250+ files
cache_usage_map = {}
for file in all_python_files:
    # Document which cache each component uses
    # Document what data each cache stores
    # Document cache invalidation patterns
```

### 2.2 Design Unified Cache Architecture
```python
class UnifiedIntelligentCache:
    """
    Consolidates all 3 caching systems per COMPREHENSIVE_SYSTEM_ANALYSIS.md
    - Automatic price-change invalidation
    - Position-aware expiration  
    - Memory-efficient unified storage
    """
    
    def __init__(self):
        # Single cache to rule them all
        self._cache = {}
        self._invalidation_rules = {}
        self._memory_limit = 500 * 1024 * 1024  # 500MB
```

### 2.3 Systematic Migration
For EACH of the 3 caches, migrate systematically:

1. **HighPerformanceCache migrations**:
   - Find all usages: `grep -r "HighPerformanceCache" --include="*.py"`
   - Update each usage to UnifiedIntelligentCache
   - Verify functionality preserved
   - Run tests after each migration

2. **PositionAwareCache migrations**:
   - Find all usages: `grep -r "PositionAwareCache" --include="*.py"`
   - Preserve position-specific invalidation logic
   - Update to unified cache
   - Test position change scenarios

3. **MarketDataCache migrations**:
   - Find all usages: `grep -r "MarketDataCache" --include="*.py"`
   - Preserve price-change invalidation
   - Migrate to unified system
   - Test market data updates

### 2.4 Verification After Consolidation
```python
# Verify no orphaned cache references
assert grep_count("HighPerformanceCache") == 0
assert grep_count("PositionAwareCache") == 0  
assert grep_count("MarketDataCache") == 0

# Verify unified cache works
test_unified_cache_invalidation()
test_unified_cache_memory_limits()
test_unified_cache_performance()
```

## Phase 3: State Management Unification
**Finding**: "4 separate state systems (UnifiedStateManager, strategy states, PositionStateManagerQC, OrderStateRecovery)"
**Goal**: Hierarchical state system per analysis recommendations

### 3.1 Map State Dependencies
```python
# Document EVERY state interaction
state_dependencies = {
    'UnifiedStateManager': find_all_usages(),
    'PositionStateManagerQC': find_all_usages(),
    'OrderStateRecovery': find_all_usages(),
    'strategy_states': find_all_strategy_state_machines()
}
```

### 3.2 Create Hierarchical State Architecture
```python
class HierarchicalStateManager:
    """
    Implements recommended structure from COMPREHENSIVE_SYSTEM_ANALYSIS.md:
    - SystemState (emergency halts, circuit breakers)
    - StrategyStates (individual strategy states)
    - PositionStates (position lifecycle)
    - OrderStates (order execution states)
    """
    
    def __init__(self):
        self.system_state = SystemState()
        self.strategy_states = {}
        self.position_states = {}
        self.order_states = {}
```

### 3.3 Migrate Each State System
**DO NOT use placeholders - implement FULLY**:

1. Migrate UnifiedStateManager → HierarchicalStateManager.system_state
2. Migrate strategy state machines → HierarchicalStateManager.strategy_states
3. Migrate PositionStateManagerQC → HierarchicalStateManager.position_states
4. Migrate OrderStateRecovery → HierarchicalStateManager.order_states

### 3.4 Verify State Persistence
```python
# Critical: August 5 lesson - must survive crashes
test_state_persistence_after_crash()
test_state_recovery_accuracy()
test_multi_leg_order_state_recovery()
```

## Phase 4: Manager Initialization Optimization
**Finding**: "15 managers with sequential initialization"
**Goal**: Dependency injection with automatic resolution

### 4.1 Document Manager Dependencies
Create complete dependency graph for all 15 managers:
```python
manager_dependencies = {
    'DataFreshnessValidator': [],
    'DynamicMarginManager': ['UnifiedVIXManager'],
    'UnifiedVIXManager': [],
    # ... document all 15
}
```

### 4.2 Implement Dependency Injection
```python
class ManagerFactory:
    """
    Implements recommendation from COMPREHENSIVE_SYSTEM_ANALYSIS.md
    - Automatic dependency resolution
    - Parallel initialization where possible
    - Built-in verification
    """
    
    def create_all_managers(self, algorithm):
        # Topological sort for correct order
        initialization_order = self._resolve_dependencies()
        
        # Parallel initialization of independent managers
        independent_managers = self._identify_independent()
        parallel_init(independent_managers)
        
        # Sequential for dependent managers
        for manager_class in initialization_order:
            self._create_with_dependencies(manager_class)
```

### 4.3 Migrate Manager Initialization
Replace the 15 sequential initializations in main.py:
```python
# OLD: 15 sequential lines
# NEW: Single factory call
self.manager_factory = ManagerFactory()
self.managers = self.manager_factory.create_all_managers(self)
```

## Phase 5: Performance Bottleneck Resolution
**Finding**: "Scheduled methods 23-25% CPU overhead, Greeks calculation redundancy"

### 5.1 Convert to Event-Driven Architecture
```python
# Map ALL scheduled methods
scheduled_methods = find_all_scheduled_methods()

# Convert each to event-driven
for method in scheduled_methods:
    # Identify trigger condition
    # Create event handler
    # Remove schedule
    # Test new trigger
```

### 5.2 Centralize Greeks Calculations
```python
class CentralGreeksService:
    """
    Implements recommendation from COMPREHENSIVE_SYSTEM_ANALYSIS.md
    - Single calculation point
    - Cached results with TTL
    - Invalidation on position changes
    """
    
    def get_portfolio_greeks(self, cache_ttl=300):
        # Check cache first
        if self._cache_valid():
            return self._cached_greeks
            
        # Single calculation for all
        greeks = self._calculate_once()
        self._cache_with_ttl(greeks, cache_ttl)
        return greeks
```

## Phase 6: Circular Dependency Resolution
**Finding**: "StrategyCoordinator → Strategies → StateManager → PositionManager → GreeksMonitor → StrategyCoordinator"

### 6.1 Implement Event Bus Pattern
```python
class EventBus:
    """
    Breaks circular dependencies per COMPREHENSIVE_SYSTEM_ANALYSIS.md
    """
    
    def __init__(self):
        self.subscribers = {
            'PositionChanged': [],
            'MarketData': [],
            'StateTransition': [],
            'RiskThreshold': []
        }
    
    def publish(self, event_type, data):
        # Decoupled event propagation
        for subscriber in self.subscribers[event_type]:
            subscriber.handle_event(data)
```

### 6.2 Refactor Circular Dependencies
For EACH circular chain identified:
1. Map the dependency chain
2. Identify communication points
3. Replace direct calls with events
4. Verify decoupling
5. Test event propagation

## Phase 7: Risk Management Unification
**Finding**: "Separate August2024CorrelationLimiter, SPYConcentrationManager, CircuitBreakers"

### 7.1 Create Unified Risk Manager
```python
class UnifiedRiskManager:
    """
    Plugin architecture per COMPREHENSIVE_SYSTEM_ANALYSIS.md
    """
    
    def __init__(self):
        self.plugins = [
            CorrelationPlugin(),  # August 5 lesson
            ConcentrationPlugin(),  # SPY limits
            CircuitBreakerPlugin(),  # Emergency halts
            MarginPlugin()  # VIX-based margins
        ]
```

### 7.2 Migrate Risk Components
**Preserve ALL safety logic - August 5 lesson**:
1. Extract correlation logic → CorrelationPlugin
2. Extract SPY logic → ConcentrationPlugin
3. Extract circuit breaker logic → CircuitBreakerPlugin
4. Verify NO safety features lost

## Phase 8: Remove Discovered Redundancies

### 8.1 Component Deduplication
From the 250+ files discovered:
```python
# Find duplicate implementations
duplicates = {
    'kelly_criterion': ['risk/kelly_criterion.py', 'core/unified_position_sizer.py'],
    'vix_checks': find_all_vix_implementations(),
    'state_persistence': find_all_state_saves(),
    # ... map all duplicates
}

# For each duplicate set:
for component, locations in duplicates.items():
    # Determine canonical implementation
    # Update all references
    # Remove redundant files
    # Test thoroughly
```

### 8.2 Clean Orphaned Files
```python
# From the audit, remove:
- Unused test files
- Orphaned helpers
- Duplicate documentation
- Old backup files

# But PRESERVE:
- Intentional redundancy (VIX checks)
- Safety-critical duplicates
- Tom King methodology docs
```

## Phase 9: Integration Testing

### 9.1 Component Integration Tests
For EVERY optimization made:
```python
def test_optimization_preserves_functionality():
    # Test cache consolidation
    assert unified_cache_works()
    
    # Test state unification
    assert hierarchical_state_works()
    
    # Test manager factory
    assert all_managers_initialized()
    
    # Test event bus
    assert no_circular_dependencies()
    
    # Test risk unification
    assert all_safety_features_active()
```

### 9.2 End-to-End Validation
```python
# Run complete system test
def test_full_system_after_optimization():
    # Initialize with optimized components
    # Run through all 5 strategies
    # Verify August 5 protections
    # Check performance improvements
    # Validate no regressions
```

## Phase 10: Final Verification

### 10.1 Verify Against Findings
Check EVERY finding from COMPREHENSIVE_SYSTEM_ANALYSIS.md:
- [ ] 3 caches consolidated to 1
- [ ] 4 state systems unified
- [ ] 15 managers use dependency injection
- [ ] Scheduled methods converted to events
- [ ] Greeks centralized
- [ ] Circular dependencies broken
- [ ] Risk management unified
- [ ] Performance improved by 20%+

### 10.2 Production Readiness
```python
# Final checks:
assert no_placeholders_exist()
assert no_truncated_implementations()
assert all_tests_passing()
assert performance_targets_met()
assert safety_systems_verified()
```

## Success Criteria

1. **Caching**: Single UnifiedIntelligentCache replacing 3 systems
2. **State**: HierarchicalStateManager replacing 4 systems
3. **Managers**: ManagerFactory with dependency injection
4. **Performance**: 20%+ improvement from event-driven architecture
5. **Greeks**: CentralGreeksService with caching
6. **Dependencies**: Event bus pattern, no circular chains
7. **Risk**: UnifiedRiskManager with plugins
8. **File Count**: Reduced from 250+ to <150 through deduplication
9. **Safety**: ALL August 5 protections preserved
10. **Quality**: Zero placeholders, truncations, or shortcuts

## Execution Instructions

1. **DO NOT SKIP PHASES** - Each phase depends on previous
2. **USE IMPLEMENTATION AUDIT PROTOCOL** - Before EVERY change
3. **NO PLACEHOLDERS** - Implement everything fully
4. **TEST AFTER EACH CHANGE** - Don't accumulate untested changes
5. **PRESERVE SAFETY SYSTEMS** - August 5 lesson is paramount
6. **DOCUMENT EVERYTHING** - Track what was changed and why
7. **MULTIPLE PASSES REQUIRED** - This is 10-15 hours of work minimum
8. **VERIFY AGAINST ANALYSIS** - Continuously check COMPREHENSIVE_SYSTEM_ANALYSIS.md

Begin execution immediately with Phase 1 audit. Do not proceed to Phase 2 until Phase 1 is 100% complete. Continue through all 10 phases systematically until the framework is fully optimized per the analysis findings.

Remember: This system trades real money. Every optimization must preserve or enhance safety while improving performance. The August 5, 2024 disaster that cost £308,000 must never happen again.