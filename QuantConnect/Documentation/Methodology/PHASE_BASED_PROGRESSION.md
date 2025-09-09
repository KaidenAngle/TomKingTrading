# Phase-Based Portfolio Progression System

## Overview
Tom King's framework uses a 4-phase progression system. Each phase unlocks new strategies and increases position limits based on PROVEN SUCCESS, not time or wishes.

## The Four Phases

### Phase 1: Foundation (£30-40k / $30-40k)
**Goal**: Prove you can follow rules and make consistent profits

#### Allowed Strategies
- **0DTE Friday**: 1-2 iron condors max
- **IPMCC**: 100 shares + weekly calls
- **Futures Strangles**: /MCL only (1 contract)
- **LEAP Protection**: Begin building ladder

#### Position Limits
- Max 3 positions total
- Max 5% per position
- Max 30% buying power usage
- SPY delta limit: -300

#### Success Criteria to Advance
- [ ] 20+ trades completed
- [ ] 60%+ win rate
- [ ] No position > 5% loss
- [ ] Followed all exit rules
- [ ] Account growth to £40k

### Phase 2: Scaling (£40-60k / $40-60k)
**Goal**: Add complexity while maintaining discipline

#### New Strategies Unlocked
- **LT112**: 1-2 put spreads
- **Enhanced 0DTE**: Up to 3 iron condors
- **Ratio Spreads**: 1:2 ratios allowed
- **Multiple Futures**: /MCL + /GC strangles

#### Increased Limits
- Max 5 positions total
- Max 7% per position
- Max 50% buying power usage
- SPY delta limit: -500

#### Success Criteria to Advance
- [ ] 50+ total trades
- [ ] 65%+ win rate maintained
- [ ] Successful LT112 management
- [ ] No correlation disasters
- [ ] Account growth to £60k

### Phase 3: Optimization (£60-75k / $60-75k)
**Goal**: Optimize returns with advanced strategies

#### New Strategies Unlocked
- **Butterflies**: Iron butterflies for pin risk
- **Calendar Spreads**: Time decay optimization
- **/ES Upgrade**: Move from /MES to /ES
- **Broken Wings**: Directional iron condors

#### Enhanced Limits
- Max 7 positions total
- Max 10% per position
- Max 65% buying power usage
- SPY delta limit: -750

#### Success Criteria to Advance
- [ ] 100+ total trades
- [ ] 70%+ win rate achieved
- [ ] Managed drawdown < 15%
- [ ] All strategies profitable
- [ ] Account growth to £75k

### Phase 4: Professional Deployment (£75k+)
**Goal**: Full system deployment with all strategies

#### All Strategies Available
- **Full 0DTE Program**: Daily opportunities
- **Multiple LT112s**: Up to 3 positions
- **Advanced Ratios**: 1:3 and 2:3 spreads
- **Diagonal Spreads**: LEAP-based diagonals
- **Full Futures Suite**: /ES, /CL, /GC, /SI

#### Maximum Limits
- Max 10 positions total
- Max 15% per position (still capped!)
- Max 80% buying power usage
- SPY delta limit: -1000

## Why Phase-Based Progression?

### The Problem with Jumping to Full Size
```
Beginner with $100k account:
- Tries to trade like Phase 4 immediately
- Takes 10 positions at max size
- One correlation event wipes out 40%
- Account destroyed in one day
```

### The Solution: Earned Progression
```
Same trader using phases:
- Phase 1: Learns discipline with small size
- Phase 2: Adds complexity gradually
- Phase 3: Optimizes what works
- Phase 4: Deploys full system with experience
```

## Phase Transition Rules

### Automatic Advancement
```python
def check_phase_advancement(self) -> bool:
    """Check if ready to advance phase
    
    IMPORTANT: Must meet ALL criteria, not just account value
    Jumping phases is how accounts blow up
    """
    current_phase = self.current_phase
    
    if current_phase == 1:
        if (self.Portfolio.TotalPortfolioValue >= 40000 and
            self.total_trades >= 20 and
            self.win_rate >= 0.60 and
            self.max_position_loss < 0.05):
            return True
            
    elif current_phase == 2:
        if (self.Portfolio.TotalPortfolioValue >= 60000 and
            self.total_trades >= 50 and
            self.win_rate >= 0.65 and
            self.has_managed_lt112_successfully()):
            return True
            
    # etc...
    return False
```

### Forced Demotion
```python
def check_phase_demotion(self) -> bool:
    """Check if should demote phase
    
    CRITICAL: Drawdowns force phase reduction
    Pride comes before the fall
    """
    portfolio_value = self.Portfolio.TotalPortfolioValue
    
    # Demote if fall below phase minimum
    if self.current_phase == 4 and portfolio_value < 70000:
        self.current_phase = 3
        self.Error("PHASE DEMOTION: Returning to Phase 3")
        return True
        
    # Also demote on severe drawdown
    if self.current_drawdown > 0.20:
        self.current_phase = max(1, self.current_phase - 1)
        self.Error(f"PHASE DEMOTION: Drawdown {self.current_drawdown:.1%}")
        return True
        
    return False
```

## Strategy Availability by Phase

| Strategy | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|----------|---------|---------|---------|---------|
| 0DTE Friday | 1-2 ICs | 3 ICs | 4 ICs | Unlimited |
| LT112 | ❌ | 1-2 | 2-3 | 3+ |
| IPMCC | ✅ | ✅ | ✅ | ✅ |
| Futures Strangle | /MCL only | +/GC | +/ES | All |
| LEAP Ladders | Start | Build | Build | Complete |
| Butterflies | ❌ | ❌ | ✅ | ✅ |
| Calendars | ❌ | ❌ | ✅ | ✅ |
| Ratios | ❌ | 1:2 | 1:3 | 2:3 |
| Diagonals | ❌ | ❌ | ❌ | ✅ |

## Common Phase Mistakes

### Mistake 1: "I have the money, I'm Phase 4"
**Reality**: Phase is earned through experience, not account size

### Mistake 2: "I'll skip Phase 2"
**Reality**: Each phase teaches critical lessons. Skipping = future disaster

### Mistake 3: "Demotion is failure"
**Reality**: Demotion is risk management. Better than account destruction

### Mistake 4: "I can handle more positions"
**Reality**: Position limits exist because of correlation risk

## Phase-Based Configuration

### Dynamic Parameters
```python
PHASE_PARAMETERS = {
    1: {
        "max_positions": 3,
        "max_position_size": 0.05,
        "max_bp_usage": 0.30,
        "max_spy_delta": -300,
        "strategies": ["0DTE", "IPMCC", "MCL_Strangle", "LEAP_Start"]
    },
    2: {
        "max_positions": 5,
        "max_position_size": 0.07,
        "max_bp_usage": 0.50,
        "max_spy_delta": -500,
        "strategies": ["0DTE", "LT112", "IPMCC", "Futures_Strangle", "LEAP", "Ratio_2_1"]
    },
    3: {
        "max_positions": 7,
        "max_position_size": 0.10,
        "max_bp_usage": 0.65,
        "max_spy_delta": -750,
        "strategies": ["All_except_diagonals"]
    },
    4: {
        "max_positions": 10,
        "max_position_size": 0.15,
        "max_bp_usage": 0.80,
        "max_spy_delta": -1000,
        "strategies": ["All"]
    }
}
```

## Monitoring Phase Progress

### Dashboard Display
```python
def display_phase_progress(self) -> str:
    """Show current phase and progress to next
    
    Motivates proper progression
    Prevents premature advancement
    """
    phase = self.current_phase
    next_phase = phase + 1 if phase < 4 else 4
    
    display = f"Current Phase: {phase}\n"
    display += f"Portfolio: ${self.Portfolio.TotalPortfolioValue:,.0f}\n"
    display += f"Total Trades: {self.total_trades}\n"
    display += f"Win Rate: {self.win_rate:.1%}\n"
    
    if phase < 4:
        # Show requirements for next phase
        requirements = self.get_phase_requirements(next_phase)
        display += f"\nPhase {next_phase} Requirements:\n"
        for req, value in requirements.items():
            current = self.get_current_value(req)
            met = "✅" if current >= value else "❌"
            display += f"{met} {req}: {current}/{value}\n"
    
    return display
```

## Summary

Phase-based progression is **essential portfolio development** that:

1. **Prevents overtrading** by beginners
2. **Builds experience** systematically
3. **Unlocks strategies** based on proven success
4. **Scales risk** with demonstrated ability
5. **Forces discipline** through requirements

Tom King developed this system after 40 years and 6 blown accounts. Each phase represents lessons learned from real losses.

**Respect the phases or repeat the failures.**