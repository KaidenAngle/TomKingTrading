# CLAUDE.md

## Purpose
This file defines the conventions and expectations for how Claude should interact with QuantConnect projects.

## Development Environment
- Code should be **Python-first**, but C# examples may be used for reference if necessary.
- The project Id is in the config file, under `cloud-id`. Don't call the `list_backtests` tool unless it's absolutely needed.
- External dependencies must be avoided unless they are supported in QuantConnect's cloud environment. When in doubt, suggest native LEAN methods.
- When drafting code, prefer modular design. Place custom indicators in an `indicators/` directory.
- Prioritize classic QC algorithm design over the algorithm framework unless explicitly requested.
- When creating indicator objects (such as RSI, SMA, etc.), never overwrite the indicator method names (e.g., do not assign to `self.rsi`, `self.sma`, etc.). Instead, use a different variable name, preferably with a leading underscore for non-public instance variables (e.g., `self._rsi = self.rsi(self._symbol, 14)`). This prevents conflicts with the built-in indicator methods and ensures code reliability.
- After adding or editing code, call the compile tool (`create_compile` and `read_compile`) in the QuantConnect MCP server to get the syntax errors and then FIX ALL COMPILE WARNINGS.

---

## Data Handling
- Use QuantConnect's **built-in dataset APIs** (Equity, Futures, Options, Crypto, FX).  
- For alternative datasets, reference [QuantConnect's Data Library](https://www.quantconnect.com/datasets/) and link to documentation rather than suggesting unsupported APIs.

---

## Research Standards
- Backtest code should include:
  - A clear `initialize()` with securities, resolution, and cash set explicitly.
  - Example parameters (start date, end date, cash) that are realistic for production-scale testing.
  - At least one comment section explaining the strategy's core logic.
- When generating new strategies, provide a **one-paragraph explanation** of the trading idea in plain English before showing code.
- Prefer **transparent, explainable strategies**. Avoid "black-box" style outputs.

---

## Style Guidelines
- Code must follow **PEP8** where possible.
- Use **docstrings** on all public classes and functions.
- Responses should be in **Markdown**, with code blocks fenced by triple backticks and the language identifier.

---

## Risk Management
- Always emphasize risk controls in strategy outputs:
  - Max position sizing rules.
  - Stop-loss or drawdown limits.
  - Portfolio exposure constraints.
- Always use the `live_mode` flag and log the live mode in `initialize`.

---

## Security & Compliance
- Do not reference or fabricate API keys, credentials, or client secrets.
- Avoid suggesting integrations with unsupported brokers.
- If a user requests something outside QuantConnect's compliance boundaries (e.g., high-frequency order spoofing, or prohibited datasets), politely decline.

---

## Tone & Communication
- Keep responses professional, concise, and explanatory.
- Prioritize **clarity over cleverness**.  
- Always explain why you made a design choice if multiple options exist.

---

## Tom King Trading Framework Specific
- **Primary Project**: TomKingTradingFixed (QuantConnect project name)
- **Algorithm Class**: TomKingTradingIntegrated 
- **Main File**: main.py

### Critical Methodology - AUDIT BEFORE ASSUME
- **ALWAYS** search existing implementations before adding new code
- Read Documentation/CRITICAL_DO_NOT_CHANGE.md for non-negotiable rules
- Follow Documentation/Development/implementation-audit-protocol.md
- Use systematic auditing: `./audit-tools.sh audit <concept>` before changes

### Framework Architecture
- **Unified Managers**: VIX, Position Sizing, State Management (single source of truth)
- **Strategy State Machines**: Each strategy has separate state machine (0DTE, LT112, PMCC, Futures, LEAP)
- **Safety Systems**: Circuit breakers, phase limits, atomic order execution
- **Risk Controls**: Kelly sizing (0.25 factor), 21 DTE exits, SPY concentration limits

### Non-Negotiable Parameters (DO NOT CHANGE)
- Kelly Factor: 0.25 (Tom King's proven parameter)
- Defensive Exit: 21 DTE (prevents gamma disasters)
- Phase Limits: 1=3, 2=5, 3=7, 4=10 positions max
- VIX Thresholds: Strategy-specific (0DTE≥22, LT112: 12-35)
- Circuit Breakers: -3% drawdown, 90% correlation, 80% margin
- Timing Windows: 0DTE entry 9:45-10:30, exit 15:30

### Backtest Standards
- **Period**: 2023-2025 (2 years minimum)
- **Capital**: $30,000 starting (Phase 1)
- **Resolution**: Minute data
- **Targets**: 60-128% annual returns, <15% max drawdown
- **Benchmark**: SPY performance

### Integration Verification
- **MANDATORY**: Run complete integration verification in Initialize()
- Verify all managers are properly connected
- Fail fast if any component missing required methods
- Log integration status for debugging

### Essential Knowledge Directories
**ALWAYS** read these documentation areas for complete context:

#### 📋 Core Methodology
- **Phase System**: Read `Documentation/Methodology/PHASE_BASED_PROGRESSION.md` for current position limits and advancement criteria
- **Risk Management**: Check `Documentation/Methodology/` for Kelly sizing, Greeks management, disaster scenarios
- **Critical Rules**: Review `Documentation/CRITICAL_DO_NOT_CHANGE.md` for non-negotiable parameters

#### ⚙️ Technical Architecture  
- **Timing Logic**: `Documentation/Architecture/TIMING_WINDOWS_AND_SCHEDULING.md` for entry/exit windows
- **State Machines**: `Documentation/Architecture/STATE_MACHINE_ARCHITECTURE.md` for strategy lifecycle
- **QuantConnect Patterns**: `Documentation/Architecture/QUANTCONNECT_API_PATTERNS.md` for API usage rules
- **Circuit Breakers**: `Documentation/Architecture/CIRCUIT_BREAKER_THRESHOLDS.md` for protection systems

#### 📊 Strategy Implementation
- **Strategy Details**: `Documentation/Strategies/` directory for complete specifications
- **Backtest Requirements**: `Documentation/Backtesting/BACKTEST_SCENARIOS.md` for testing scenarios
- **Testing Standards**: `Documentation/Testing/TESTING_REQUIREMENTS.md` for validation requirements

#### 🛠️ Development Process
- **Audit Protocol**: `Documentation/Development/implementation-audit-protocol.md` - MANDATORY before changes
- **Quick Reference**: `Documentation/Development/quick-reference.md` for common patterns
- **Troubleshooting**: `Documentation/TROUBLESHOOTING_GUIDE.md` for common issues

### Dynamic Context Loading
When working on specific components, **automatically read relevant documentation**:

```bash
# Before any strategy work
find Documentation/Strategies/ -name "*.md" | head -5 | xargs cat

# Before architecture changes  
find Documentation/Architecture/ -name "*.md" | head -3 | xargs cat

# Before risk modifications
find Documentation/Methodology/ -name "*RISK*" -o -name "*KELLY*" -o -name "*PHASE*" | xargs cat
```

### Current System Discovery Commands
Use these to understand the current state dynamically:

```python
# Discover current strategies
strategies = glob("strategies/*_with_state.py") 

# Find all managers
managers = glob("core/unified_*.py")

# Locate risk components  
risk_systems = glob("risk/*.py")

# Check documentation structure
docs = glob("Documentation/**/*.md", recursive=True)
```

### Workflow: Dynamic Documentation Access
**Context-Driven Reading**: Instead of hardcoded knowledge, read documentation dynamically based on task:

1. **Starting Any Task**: Read `Documentation/SESSION_STARTUP_PROTOCOL.md`
2. **Before Changes**: Execute audit protocol from `Documentation/Development/`
3. **Strategy Work**: Scan `Documentation/Strategies/` for relevant files
4. **Risk Changes**: Review all files in `Documentation/Methodology/`
5. **Architecture Updates**: Check `Documentation/Architecture/` for patterns
6. **Testing**: Reference `Documentation/Testing/` for requirements
7. **Troubleshooting**: Consult `Documentation/TROUBLESHOOTING_GUIDE.md`

### Documentation Discovery Pattern
```bash
# Dynamic documentation discovery based on task context
task_type="$1"  # strategy, risk, architecture, testing, etc.

case $task_type in
  "strategy") docs_to_read="Documentation/Strategies/ Documentation/Methodology/PHASE_BASED_PROGRESSION.md" ;;
  "risk") docs_to_read="Documentation/Methodology/ Documentation/Architecture/CIRCUIT_BREAKER_THRESHOLDS.md" ;;
  "architecture") docs_to_read="Documentation/Architecture/ Documentation/CRITICAL_DO_NOT_CHANGE.md" ;;
  "testing") docs_to_read="Documentation/Testing/ Documentation/Backtesting/" ;;
  *) docs_to_read="Documentation/CRITICAL_DO_NOT_CHANGE.md Documentation/Development/quick-reference.md" ;;
esac

# Read relevant documentation dynamically
find $docs_to_read -name "*.md" 2>/dev/null | head -5 | xargs cat
```

### Future-Proof Approach
- **Directory-Based**: Reference documentation directories, not specific file counts
- **Pattern-Based**: Use file patterns (`*RISK*`, `*_with_state.py`) for discovery  
- **Task-Driven**: Read documentation based on current work context
- **Expandable**: New docs automatically included via directory scanning
- **Maintainable**: Changes to documentation structure don't break references