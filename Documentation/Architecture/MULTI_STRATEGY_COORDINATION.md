# Multi-Strategy Coordination

## Overview
Five strategies operate simultaneously, each with different timeframes and risk profiles. Without coordination, they could create dangerous portfolio concentrations or conflicting positions.

## The Strategies and Their Relationships

### Strategy Overview
```
Strategy         | Timeframe | Underlying | Direction    | Priority
-----------------|-----------|------------|--------------|----------
0DTE Friday      | 0 days    | SPY        | Neutral      | 1 (highest)
LT112           | 112 days  | SPY        | Bullish      | 2
IPMCC           | 30-45 days| Multiple   | Covered      | 3
Futures Strangle | 45 days   | /ES        | Neutral      | 4
LEAP Ladders    | 365+ days | SPY        | Protection   | 5 (lowest)
```

## Why Coordination is Essential

### Without Coordination (Dangerous)
```
Friday 9:30 AM:
- 0DTE places iron condor: -500 delta
- LT112 places put spread: -300 delta
- LEAP adds protective put: -200 delta
- Total: -1000 delta (way over-exposed!)

Market rallies 2%:
- Portfolio loses $20,000 (disaster)
```

### With Coordination (Safe)
```
Friday 9:30 AM:
- StrategyCoordinator checks total exposure
- 0DTE approved for -500 delta
- LT112 rejected (would exceed limit)
- LEAP approved for -200 delta
- Total: -700 delta (within limits)

Market rallies 2%:
- Portfolio loses $7,000 (manageable)
```

## The StrategyCoordinator Component

### Core Responsibilities
```python
class StrategyCoordinator:
    def __init__(self):
        self.strategy_priorities = {}
        self.execution_history = []
        self.strategy_states = {}
        
    def get_execution_order(self) -> List[str]:
        """Determine which strategies can execute
        
        Considers:
        1. Priority order
        2. Current states
        3. Risk limits
        4. Market conditions
        """
```

### Priority System
```python
STRATEGY_PRIORITIES = {
    '0DTE': 1,           # Highest - time sensitive
    'LT112': 2,          # High - specific entry windows
    'IPMCC': 3,          # Medium - flexible timing
    'FuturesStrangle': 4, # Low - patient entry
    'LEAPLadders': 5     # Lowest - long-term building
}
```

## Coordination Patterns

### Pattern 1: Emergency Halt
```
Trigger: Circuit breaker activated
Action: UnifiedStateManager.halt_all_trading()

Result:
├─ All strategies → ERROR state
├─ No new positions allowed
├─ Existing positions enter defensive mode
└─ Manual intervention required
```

### Pattern 2: Margin Pressure
```
Trigger: Margin usage > 70%
Action: Coordinator limits new entries

Priority execution:
1. Exit losing positions first
2. High priority strategies only
3. Reduce position sizes
4. Skip low priority strategies
```

### Pattern 3: Correlation Spike
```
Trigger: Inter-strategy correlation > 0.8
Action: Reduce SPY exposure

Steps:
1. Block new SPY positions
2. Consider closing newest positions
3. Diversify into other underlyings
4. Wait for correlation to drop
```

## State-Based Coordination

### State Machine Integration
```python
def can_strategy_execute(self, strategy_name: str) -> bool:
    # Check system state
    if self.system_state == "EMERGENCY":
        return False
    
    # Check other strategies' states
    critical_states = ["ERROR", "MARGIN_CALL", "EMERGENCY_EXIT"]
    for other_strategy, state in self.strategy_states.items():
        if state in critical_states:
            return False  # Don't add risk when another strategy is in trouble
    
    # Check strategy-specific rules
    if strategy_name == "0DTE":
        # Can't trade if LT112 is in defensive exit
        if self.strategy_states.get("LT112") == "DEFENSIVE_21DTE":
            return False
```

### Why States Matter for Coordination
1. **Risk Awareness**: Know when strategies are in trouble
2. **Capital Efficiency**: Don't tie up capital during exits
3. **Cascade Prevention**: Stop problems from spreading

## Resource Allocation

### Buying Power Management
```python
def allocate_buying_power(self) -> Dict[str, float]:
    """Distribute available buying power by priority
    
    Not equal allocation - priority-based
    """
    available = self.get_available_buying_power()
    
    allocations = {
        '0DTE': available * 0.30,        # 30% for highest priority
        'LT112': available * 0.25,       # 25%
        'IPMCC': available * 0.20,       # 20%
        'FuturesStrangle': available * 0.15,  # 15%
        'LEAPLadders': available * 0.10  # 10% for protection
    }
```

### Why Not Equal Allocation?
- **0DTE**: Needs capital ready on Fridays
- **LT112**: Specific entry opportunities
- **LEAP**: Builds slowly over time
- **Priority**: Time-sensitive strategies first

## Greeks Aggregation

### Portfolio-Level Greeks
```python
def calculate_portfolio_greeks(self) -> Dict:
    """Aggregate Greeks across all strategies
    
    Critical for risk management
    """
    total_delta = 0
    total_gamma = 0
    total_theta = 0
    total_vega = 0
    
    for strategy in self.strategies:
        greeks = strategy.get_position_greeks()
        total_delta += greeks['delta']
        total_gamma += greeks['gamma']
        total_theta += greeks['theta']
        total_vega += greeks['vega']
```

### Greeks Limits Coordination
```
Maximum Portfolio Greeks:
├─ Delta: ±1000 (direction risk)
├─ Gamma: ±50 (acceleration risk)
├─ Theta: -500 (time decay limit)
└─ Vega: ±1000 (volatility risk)

If any limit exceeded:
→ Block new positions increasing that Greek
→ Consider hedging or reducing
```

## Event-Based Coordination

### Market Events
```python
def handle_market_event(self, event_type: str):
    """Coordinate strategy responses to events
    
    Different strategies need different responses
    """
    if event_type == "FOMC":
        # 0DTE: Skip trading today
        # LT112: Reduce position size
        # LEAP: Good time to buy protection
        
    elif event_type == "EARNINGS":
        # IPMCC: Don't sell calls
        # Others: Normal operation
        
    elif event_type == "EXPIRATION":
        # 0DTE: High activity day
        # Others: Avoid SPY positions
```

## Testing Coordination

### Scenarios to Test

#### Scenario 1: All Strategies Want Entry
```
Setup: Perfect conditions for all strategies
Test: Verify priority execution order
Expected: High priority trades first, respect limits
```

#### Scenario 2: Cascade Failure
```
Setup: One strategy hits max loss
Test: Other strategies respond appropriately
Expected: Defensive positioning, no new risk
```

#### Scenario 3: Resource Contention
```
Setup: Limited buying power
Test: Allocation follows priority
Expected: Critical strategies get resources first
```

## Common Misconceptions

### "Each strategy is independent"
**Reality**: They share the same portfolio and risk budget

### "Simple round-robin would work"
**Reality**: Some strategies are time-critical, others can wait

### "Just track total positions"
**Reality**: Need to track correlations, Greeks, and states

## Configuration

### Coordination Parameters
```python
# Maximum simultaneous active strategies
MAX_ACTIVE_STRATEGIES = 3

# Minimum time between strategy executions
MIN_EXECUTION_INTERVAL = timedelta(minutes=5)

# Emergency halt threshold
PORTFOLIO_LOSS_HALT = -0.05  # -5% triggers halt
```

## Summary

Multi-Strategy Coordination is **critical portfolio infrastructure** that:

1. **Prevents Concentration** - No accidental over-exposure
2. **Manages Resources** - Allocates capital by priority
3. **Handles Emergencies** - Coordinates defensive actions
4. **Optimizes Execution** - Time-sensitive strategies first

Without coordination, multiple strategies would create chaos. With it, they work as a sophisticated portfolio system.

**This is portfolio risk management, not unnecessary complexity.**