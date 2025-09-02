# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔐 SESSION INITIALIZATION
**IMPORTANT**: Always start new sessions with `--dangerously-skip-permissions` flag to avoid constant permission prompts.
This has been requested by the user for efficiency.

## Project Overview
Tom King Trading Framework v17 - Advanced automated trading system implementing Tom King's systematic trading methodology with comprehensive JavaScript pattern analysis engine, TastyTrade API integration, real-time HTML dashboard, and Section 9B advanced strategies. Designed to transform £35k into £80k within 8 months using proven options and futures strategies with strict risk management protocols.

## Project Goal: £35k to £80k in 8 Months
Transform £35,000 into £80,000 within 8 months using Tom King's systematic options and futures strategies, achieving financial freedom with £10,000 monthly income through 12% monthly compounding while maintaining 52-65% buying power usage and strict risk protocols. Using his Zero DTE Friday strategy (no losses in 2+ years), Long-Term 112 trades, and diversified futures strangles, we target aggressive but achievable 6.67% monthly returns while maintaining strict risk management (5% max per trade, 50% max buying power). The goal is complete financial independence by month 18, when the account reaches £100k and can sustainably generate £3,000 monthly at conservative 3% returns - enough to quit traditional employment and live off trading income alone.

## Development Status
🚧 v17 ACTIVE DEVELOPMENT: Core framework implemented with pattern analysis engine, API integration, and dashboard. Testing framework operational with comprehensive test scenarios. Focus on backtesting validation, risk management refinement, and production readiness verification.

## Framework Architecture

### Core Components
- **Pattern Analysis Engine**: JavaScript-based market analysis system implementing Tom King's methodology with VIX regime detection, correlation analysis, and technical indicators
- **TastyTrade API Integration**: OAuth2 authentication, real-time market data, option chains, and order preparation (not execution)
- **Testing Framework**: Comprehensive test scenarios covering all 10 strategies across different market conditions
- **Risk Management System**: Automated correlation group limits, position sizing, and buying power monitoring
- **HTML Dashboard**: Real-time position tracking, P&L visualization, and trade recommendations
- **Section 9B Strategies**: Advanced spreads, butterflies, and defensive adjustment protocols

### Execution Modes
1. **API Mode**: Real-time data from TastyTrade API
2. **Manual Mode**: Web search-based data gathering
3. **Test Mode**: Simulated data for testing scenarios

## Key Framework Files

### Core Documentation
- `TOM KING TRADING FRAMEWORK v17.txt` - Complete framework specification and implementation guide
- `CORE_FRAMEWORK.txt` - Core framework components and architecture
- `API_INTEGRATION.txt` - TastyTrade API integration documentation
- `HTML_DASHBOARD.txt` - Dashboard implementation and features
- `Comprehensive Tom King Trading Research Report.txt` - Research analysis and strategy insights
- `Tom King Complete Trading System Documentation 2025 Updated.txt` - Latest strategy documentation
- `API Documentation/` - Complete TastyTrade API reference guides

### Implementation Files
- `TomKingTrader/src/app.js` - Main application server with WebSocket support
- `TomKingTrader/src/enhancedPatternAnalysis.js` - Pattern analysis engine implementation
- `TomKingTrader/src/enhancedRecommendationEngine.js` - Trade recommendation system
- `TomKingTrader/src/tastytradeAPI.js` - TastyTrade API integration
- `TomKingTrader/src/testingFramework.js` - Testing framework and scenarios
- `TomKingTrader/src/riskManager.js` - Risk management and correlation monitoring
- `TomKingTrader/src/backtestingEngine.js` - Backtesting and historical validation
- `TomKingTrader/public/testing.html` - Interactive testing dashboard

## 🚨 CRITICAL FILE CREATION PREVENTION RULES

### 🚫 ABSOLUTE REDUNDANCY PREVENTION PROTOCOL

#### MANDATORY CHECKLIST BEFORE ANY FILE OPERATION
1. **CHECK FIRST**: Run `ls` or `Glob` to see if file/module already exists
2. **SEARCH FIRST**: Use `Grep` to find existing implementations before creating new ones
3. **EDIT FIRST**: Always prefer editing existing files over creating new ones
4. **ASK FIRST**: If unsure, ask user before creating any new file
5. **VERIFY FIRST**: Check ARCHIVE_ALL folder - it might already exist there

#### 🛑 STRICT MODULE ARCHITECTURE - NO DUPLICATES ALLOWED

**ONE MODULE PER FUNCTION DOMAIN:**
- **P&L/Performance**: `performanceMetrics.js` ONLY (no plCalculationEngine, no tomKingTracker)
- **Orders**: `orderManager.js` ONLY (no orderPreparation, no orderBuilder)
- **Data**: `dataManager.js` ONLY (no historicalDataManager, no dataLoader)
- **Greeks**: `greeksCalculator.js` ONLY (no greeksIntegration, no realGreeksManager)
- **Patterns**: `enhancedPatternAnalysis.js` ONLY (no patternAnalyzer, no patternValidation)
- **Signals**: `signalGenerator.js` ONLY (no recommendationEngine, no signalBuilder)

**CONSOLIDATION RULES:**
- Found missing functionality? ADD to existing module, NEVER create new file
- Need related feature? EXTEND existing module, NEVER create parallel file
- Different approach needed? REFACTOR existing module, NEVER duplicate

**FORBIDDEN ACTIONS:**
```javascript
// ❌ NEVER create these if base module exists:
orderPreparation.js      // Use orderManager.js
plCalculationEngine.js   // Use performanceMetrics.js
historicalDataManager.js // Use dataManager.js
greeksIntegration.js     // Use greeksCalculator.js
patternValidator.js      // Use enhancedPatternAnalysis.js
```

### ABSOLUTE PROHIBITIONS
- **NEVER** create a new file if similar functionality exists
- **NEVER** create documentation files unless explicitly requested
- **NEVER** create test files in src/ directory
- **NEVER** create demo/example files without explicit request
- **NEVER** create backup files - use git for version control
- **NEVER** recreate files that were archived - they were archived for a reason

### DIRECTORY STRUCTURE RULES
The following is the ONLY acceptable structure for TomKingTrader:
```
TomKingTrader/
├── src/          # Core modules ONLY (no tests, no demos)
├── core/         # Unified orchestrators ONLY
├── public/       # Web dashboard files ONLY
├── reporting/    # Report generators ONLY
├── utils/        # Utilities ONLY
└── node_modules/ # Dependencies
```

**DO NOT CREATE**:
- tests/ or test/ directories
- demo/ or examples/ directories
- docs/ or documentation/ directories
- output/, exports/, logs/ directories (create in temp if needed)
- Any new directories without explicit user request

### EXISTING INFRASTRUCTURE (DO NOT RECREATE)
**Pattern Analysis** - Already have 5 modules + 1 unified:
- enhancedPatternAnalysis.js
- patternAnalysis.js
- enhancedPatternIntegration.js
- patternValidation.js
- enhancedPatternTester.js
- core/unifiedPatternAnalyzer.js (orchestrates all)

**Position Management** - Already have 3 modules + 1 unified:
- positionManager.js
- positionTracker.js
- tomKingTracker.js
- core/unifiedPositionManager.js (orchestrates all)

**Entry Point** - Already have single unified entry:
- index.js (replaces 6 old executors)

### VERIFICATION COMMANDS
Before creating ANY file, run these checks:
```bash
# Check if file exists
ls -la [directory] | grep [filename]

# Search for existing implementations
grep -r "class.*[ClassName]" --include="*.js"

# Check archives
ls -la D:/OneDrive/Trading/Claude/ARCHIVE_ALL/
```

### CONSEQUENCES OF VIOLATIONS
Each unnecessary file creation:
- Confuses the codebase
- Wastes time and resources
- Makes it harder to find the right code
- Duplicates existing functionality
- Violates user trust

## 🚨 CRITICAL FILE CREATION PREVENTION RULES

### STOP CREATING UNNECESSARY FILES
1. **NEVER create new files unless EXPLICITLY requested by user**
2. **ALWAYS check if a file/module already exists before creating**
3. **ALWAYS prefer editing existing files over creating new ones**
4. **NEVER create test/demo/proof/validation files unless specifically asked**
5. **NEVER create documentation/summary/report files unless user requests**
6. **NEVER create "FINAL_" or "COMPLETE_" versions - edit existing files**

### Before Creating ANY File - MANDATORY CHECKLIST
- [ ] Did the user explicitly ask for this specific file?
- [ ] Have I searched for existing files with similar functionality?
- [ ] Is this file ESSENTIAL for running the trading system?
- [ ] Can I achieve the same result by editing an existing file?

**If ANY answer is NO → DO NOT CREATE THE FILE**

### ESSENTIAL STRUCTURE ONLY (6 folders max)
```
TomKingTrader/
├── index.js              # Single entry point
├── src/                  # Core modules (42 files) - DO NOT ADD MORE
├── core/                 # Unified modules (3 files) - DO NOT ADD MORE
├── public/               # Dashboard
├── reporting/            # Reports
├── utils/                # Utilities
└── node_modules/         # Dependencies
```

**ANY file/folder outside this structure = WRONG**

### What Already Exists (DO NOT RECREATE)
- ✅ Complete API integration (src/tastytradeAPI.js)
- ✅ Pattern analysis (5 modules in src/, 1 unified in core/)
- ✅ Position tracking (3 modules in src/, 1 unified in core/)
- ✅ Risk management (src/riskManager.js)
- ✅ All 10 strategies (src/strategies.js)
- ✅ Backtesting (src/backtestingEngine.js)
- ✅ Dashboard (public/index.html)
- ✅ Single entry point (index.js)

### Dynamic Parameter Verification (NO HARDCODING)
Always extract parameters from source documentation:
```javascript
// GOOD - Dynamic extraction
const vixBP = await extractFromDocs('VIX.*BP|buying.*power');

// BAD - Hardcoded values
const maxBP = 0.35; // NEVER DO THIS
```

## Development Deployment

### Running the Framework
```javascript
// Start the trading application server
cd TomKingTrader
node src/app.js

// Run testing framework
node src/testingFramework.js

// Execute backtesting scenarios
node src/backtestingEngine.js

// Start with dashboard
// Open TomKingTrader/public/testing.html in browser
```

### Framework Modules
```javascript
// Load core components
const PatternAnalysis = require('./src/enhancedPatternAnalysis');
const API = require('./src/tastytradeAPI');
const TestFramework = require('./src/testingFramework');
const RecommendationEngine = require('./src/enhancedRecommendationEngine');
const RiskManager = require('./src/riskManager');
```

### Current Implementation Status

## Pattern Analysis System
- **VIX Regime Detection**: 5-level volatility classification with position sizing adjustments
- **Correlation Analysis**: Real-time position correlation monitoring with group limits
- **Technical Indicators**: ATR, RSI, EMAs (8,21,50,200), VWAP calculations
- **Pattern Recognition**: Tom King methodology implementation for entry/exit signals
- **Greeks Integration**: Delta, gamma, theta, vega calculations for options positions
- **Multi-timeframe Support**: Multiple timeframe analysis capabilities

## Testing Framework
- **Strategy Testing**: All 10 Tom King strategies with scenario testing
- **Market Condition Simulation**: Bull, bear, sideways market environments
- **Risk Management Validation**: Correlation limits and buying power constraints
- **Historical Scenario Testing**: August 2024 crash prevention validation
- **Backtesting Engine**: Historical performance validation with real market data
- **Performance Metrics**: Win rate tracking and P&L analysis

## API Integration
- **OAuth2 Authentication**: TastyTrade API authentication flow
- **Market Data Streaming**: Real-time quotes and option chain data
- **Order Preparation**: Trade setup validation (execution disabled for safety)
- **Account Management**: Balance and position monitoring
- **WebSocket Support**: Real-time data feeds for dashboard updates

## Dashboard and Visualization
- **Real-time Dashboard**: Live position monitoring and P&L tracking
- **Trade Recommendations**: Visual display of strategy signals and setups
- **Risk Visualization**: Buying power usage, correlation heat maps
- **Performance Charts**: P&L progression and win rate analytics
- **Market Data Display**: VIX levels, key indicators, and regime status

## Research Integration
- **Tom King Methodology**: Complete implementation of proven strategies based on 30+ years experience
- **August 2024 Lessons**: Incorporated risk management improvements from major volatility event
- **Strategy Hierarchy**: 1-1-2 Long Term, Strangles, 0DTE Friday following Tom's preferences
- **Volatility Adaptation**: Enhanced VIX regime awareness beyond Tom's original approach
- **Correlation Management**: Systematic group limits to prevent concentration risk

## Critical Implementation Requirements

### Data Structure
All market data must conform to the `searchedData` object structure with proper parsing of:
- Price data (current, open, close, ranges)
- Technical indicators (ATR, RSI, EMAs, VWAP)
- Volatility metrics (IV, IV Rank, IV Percentile)
- Option chain data (strikes, deltas, bid/ask spreads)

### Account Phases
- **Phase 1** (£30-40k): MCL, MGC, GLD, TLT strangles, 0DTE on Fridays
- **Phase 2** (£40-60k): Add MES, MNQ, currency futures, enhanced strategies
- **Phase 3** (£60-75k): Full futures upgrade, butterflies, complex spreads
- **Phase 4** (£75k+): Professional deployment, all strategies available

### Risk Management Rules
- Maximum 35% buying power usage with real-time monitoring
- Correlation group limits (max 3 positions per group) with automated enforcement
- VIX-based position sizing adjustments across 5 volatility regimes
- 21 DTE defensive management with automatic alerts
- 50% profit target for most strategies with automatic exit signals
- 5% maximum risk per individual trade
- Real-time P&L tracking with stop-loss triggers

## API Integration Points

### TastyTrade API Endpoints (Fully Implemented)
- **Authentication**: Complete OAuth2 flow with automatic refresh tokens
- **Account Data**: Real-time balances, positions, and buying power
- **Market Data**: Live quotes, option chains, and volatility data
- **Order Management**: Order preparation, validation, and status tracking
- **WebSocket Streaming**: Real-time data feeds for positions and market updates
- **Historical Data**: Backtesting and performance analysis capabilities

## Testing and Validation Framework

### Current Test Coverage
1. **Strategy Implementation Testing**
   - All 10 Tom King strategies with multiple scenarios
   - VIX regime-based position sizing validation
   - Entry and exit signal accuracy testing
   - Defensive adjustment trigger validation

2. **Risk Management Validation**
   - Correlation group limit enforcement (max 3 per group)
   - Buying power usage monitoring (35% maximum)
   - Position sizing calculations with UK pound sterling
   - August 2024 crash scenario prevention testing

3. **API Integration Testing**
   - TastyTrade OAuth2 authentication flow
   - Market data retrieval and parsing accuracy
   - Option chain data validation
   - WebSocket streaming functionality

4. **Backtesting Framework**
   - Historical scenario recreation and validation
   - Performance metrics calculation
   - Win rate and P&L tracking across different market conditions
   - Strategy effectiveness measurement

## Critical Development Notes

### Implementation Requirements (Current Status)
- ✅ All pricing calculations use UK pound sterling (£) with USD conversion
- ✅ JavaScript execution environment with Node.js pattern analysis engine
- ✅ Correlation group limits implementation (max 3 positions per group)
- ✅ Day-specific strategy validation (0DTE Friday after 10:30 AM, etc.)
- ✅ Tom King methodology faithful implementation across all strategies

### Core Features Implemented
1. ✅ Pattern analysis engine with VIX regime detection
2. ✅ TastyTrade API integration with OAuth2 authentication
3. ✅ Risk management system with correlation monitoring
4. ✅ Real-time dashboard with position tracking
5. ✅ Comprehensive testing framework with backtesting capabilities

### Advanced Features in Development
1. 🔄 Calendarized 1-1-2 strategy variant implementation
2. 🔄 Enhanced volatility spike protection protocols
3. 🔄 Complete Section 9B advanced strategies integration
4. 🔄 Performance optimization and production readiness
5. 🔄 Live deployment preparation and final validation

### August 2024 Lesson Integration
The framework incorporates critical lessons from Tom King's August 5, 2024 experience where excessive correlation led to significant losses:

**Risk Management Enhancements:**
- Strict correlation group limits (maximum 3 positions per group)
- Real-time correlation monitoring across all positions
- VIX-based position sizing adjustments during volatility spikes
- Enhanced defensive management protocols
- Historical scenario testing for validation

**Implementation Status:**
- ✅ Correlation group enforcement implemented
- ✅ VIX regime detection operational
- ✅ August 2024 scenario testing completed
- 🔄 Enhanced volatility adaptation in development

## Git Version Control & Backup System

### Repository Structure
- **Main Branch**: Stable production-ready code
- **Development Branch**: Active development and testing
- **Feature Branches**: Individual feature development

### Daily Automated Backup
The system automatically commits changes daily with descriptive messages tracking:
- Configuration changes
- Strategy adjustments
- Performance metrics
- Risk parameter updates

### Commit Message Format
```
type: brief description

Detailed explanation if needed
- Bullet points for multiple changes
- Reference to specific strategies or modules
```

Types: feat, fix, docs, test, refactor, chore, risk, api

### Important Files to Track
- Framework documentation (v17.2 production release)
- TomKingTrader/ implementation and configuration changes
- Test results and performance metrics from comprehensive test suite
- Risk management parameter adjustments and correlation monitoring
- API credentials and authentication status
- Real-time dashboard configurations and customizations

### Manual Backup Command
```bash
cd D:/OneDrive/Trading/Claude
git add -A
git commit -m "backup: Daily framework state - [date]"
```

### Viewing Change History
```bash
git log --oneline -10  # Last 10 commits
git diff HEAD~1        # Changes since last commit
git status            # Current changes
```

This version control system ensures all changes are tracked, allowing recovery from any issues and providing a complete audit trail of framework evolution.

## Current Development Status

### Framework v17 Implementation Progress
The Tom King Trading Framework v17 represents a comprehensive implementation of Tom King's proven trading methodology:

**✅ Core Systems Operational**
- Pattern Analysis Engine implementing Tom King's methodology
- TastyTrade API Integration with OAuth2 authentication
- Real-time HTML Dashboard with position monitoring
- Comprehensive Testing Framework with backtesting
- Risk Management System with correlation monitoring
- WebSocket streaming for real-time updates

**✅ Trading Strategies Implemented**
- Friday Zero DTE (Tom King's signature strategy)
- Long-Term 112 strategies with multiple variants
- Futures strangles across micro/mini contracts
- Basic Section 9B spread strategies
- VIX regime-based position sizing
- Defensive adjustment protocols

**🔄 Development Focus Areas**
- Enhanced Section 9B advanced strategies
- Calendarized 1-1-2 implementation
- Production readiness optimization
- Enhanced volatility spike protection
- Performance validation and backtesting refinement

**🎯 Progress Toward £35k → £80k Goal**
The framework provides solid foundation for the trading plan:
- Risk management protocols (5% max per trade, VIX-based 45-80% BP usage)
- All account phases supported (£30k-£80k progression)
- Tom King methodology faithful implementation
- Correlation group limits to prevent concentration risk
- UK pound sterling calculations throughout

**Next Development Steps**
1. Complete advanced strategy implementations
2. Enhance backtesting with historical data validation
3. Performance optimization for real-time execution
4. Final production readiness verification
5. Gradual deployment with safety protocols

## Claude Code Tool Usage Guidelines

### Agent Tool Usage
- Use Agent tool for complex searches when not confident about finding matches quickly
- Use for searching keywords like "config" or "logger" across the codebase
- NOT for specific file paths (use Read/Glob instead)
- NOT for specific class definitions (use Glob instead)
- Launch multiple agents concurrently when possible for performance

### File Operations
- ALWAYS prefer editing existing files over creating new ones
- NEVER proactively create documentation files (*.md) unless explicitly requested
- Use Read tool before editing to understand context
- Use MultiEdit for multiple changes to same file
- Always use absolute paths, not relative paths

### Git Commit Guidelines
When creating commits:
1. Run in parallel: git status, git diff, git log (to understand context)
2. Analyze changes and draft concise commit message focusing on "why" not "what"
3. Use HEREDOC format for commit messages:
```bash
git commit -m "$(cat <<'EOF'
type: brief description

Detailed explanation if needed
- Bullet points for changes

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```
4. NEVER update git config
5. NEVER push unless explicitly requested
6. Retry once if pre-commit hooks fail

### Search Best Practices
- Use Grep for content search (NOT bash grep/find)
- Use Glob for file pattern matching
- Use ripgrep (rg) if bash search needed
- Batch multiple searches together for performance
- Avoid cd command - use absolute paths instead

### Todo Management
Use TodoWrite for:
- Complex multi-step tasks (3+ steps)
- Non-trivial planning requirements
- Multiple user-provided tasks
- Tracking progress systematically

Don't use for:
- Single straightforward tasks
- Trivial operations
- Purely informational requests

### Important Reminders
- Maintain current directory with absolute paths
- Quote file paths with spaces properly
- Only one task in_progress at a time
- Mark tasks complete immediately after finishing
- Never mark partial work as completed
- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary
- ALWAYS prefer editing existing files to creating new ones

## 🚨 CRITICAL ANTI-WASTE PROTOCOL (September 2, 2025)

### MANDATORY PRE-TASK CHECKLIST
Before ANY task, MUST execute:
```bash
# 1. Understand current state
ls *.js | wc -l                           # How many files exist?
ls src/*.js | wc -l                       # What's in src?
ls ARCHIVE_REDUNDANT/*.js 2>/dev/null | wc -l  # What's archived?

# 2. Check for existing implementations
grep -l "functionName" src/*.js           # Does this function exist?
find . -name "*pattern*" -type f          # Any similar files?

# 3. Verify claims from previous sessions
git log --oneline -10                     # What was actually done?
git diff HEAD~1 --stat                    # What actually changed?
```

### FILE CREATION PREVENTION PROTOCOL

#### BEFORE creating ANY new file, ask yourself:
1. **Does a similar file already exist?**
   - Check: `ls *similar*pattern*.js`
   - Check: `grep -r "similar functionality" --include="*.js"`
   - If YES → EDIT that file, don't create new

2. **Is this truly needed?**
   - Can existing code be modified?
   - Is this just a different version of something?
   - Would editing be better than creating?
   - If unsure → DON'T CREATE

3. **Have I created this before?**
   - Check: `ls *FINAL*.md | wc -l`
   - Check: `ls *REPORT*.md | wc -l`
   - Check: `ls *BACKTEST*.js | wc -l`
   - If > 1 → STOP, use existing

### EXISTING INFRASTRUCTURE MAP (DO NOT RECREATE)

#### Core Trading Engine
```
src/
├── tastytradeAPI.js       # 2,980 lines - COMPLETE OAuth2 implementation
├── strategies.js          # ALL 10 Tom King strategies
├── riskManager.js         # VIX-based BP, correlation limits
├── backtestingEngine.js   # 1,529 lines - ONLY backtest needed
├── positionManager.js     # Position tracking, correlation groups
├── orderManager.js        # Order preparation and validation
├── greeksCalculator.js    # Black-Scholes implementation
└── config.js             # ALL configuration in ONE place
```

#### Dashboard System
```
public/
├── index.html            # MAIN and ONLY dashboard
└── js/dashboard.js       # Dashboard logic (1,134 lines)
```

#### DO NOT CREATE:
- Another backtest engine (use src/backtestingEngine.js)
- Another dashboard (use public/index.html)
- Another API integration (use src/tastytradeAPI.js)
- Another config file (use src/config.js)
- Test files in root (use tests/ folder)
- Multiple versions of same report

### VERIFICATION PROTOCOL (MANDATORY)

#### After EVERY claimed action:
```bash
# Verify file operations
ls -la [claimed_file]                    # Does it exist?
wc -l [claimed_file]                     # Is it substantial?
head -20 [claimed_file]                  # Does it have content?

# Verify deletions/moves
ls ARCHIVE_REDUNDANT/ | wc -l            # Actually archived?
ls *.js | wc -l                          # Actually reduced?

# Verify edits
grep "old_pattern" file.js               # Old pattern gone?
grep "new_pattern" file.js               # New pattern present?
```

### DYNAMIC PARAMETER VERIFICATION SYSTEM

#### Instead of hardcoding, ALWAYS verify from source:
```javascript
// 1. Find the source of truth
const sourceFiles = {
    tomKingDocs: 'Tom King Complete Trading System Documentation*.txt',
    riskManager: 'src/riskManager.js',
    config: 'src/config.js',
    strategies: 'src/strategies.js'
};

// 2. Extract current values dynamically
function getCurrentParameters() {
    // Read from Tom King documentation
    const tomKingDoc = readFile(sourceFiles.tomKingDocs);
    const vixRegimes = extractVIXRegimes(tomKingDoc);
    const winRates = extractWinRates(tomKingDoc);
    
    // Compare with implementation
    const configValues = readFile(sourceFiles.config);
    const differences = compareValues(tomKingDoc, configValues);
    
    return { correct: tomKingDoc, current: configValues, differences };
}

// 3. Self-validate before any changes
function validateParameter(param, value) {
    const truth = getCurrentParameters();
    return truth.correct[param] === value;
}
```

#### Dynamic BP Verification:
```bash
# Don't hardcode "0.35" - find what's actually wrong
grep -o "maxBPUsage:\s*[0-9\.]*" src/*.js | sort -u
# Then compare with Tom King docs
grep -i "buying power\|bp.*[0-9]+%" "Tom King*.txt"
```

#### Dynamic Win Rate Verification:
```bash
# Find actual win rates in docs
grep -i "win rate.*[0-9]+%\|[0-9]+%.*win" "Tom King*.txt" | head -20
# Compare with code
grep -o "winRate:\s*[0-9]*" src/*.js | sort -u
```

#### Dynamic Correlation Verification:
```bash
# Find phase-based limits in docs
grep -i "phase.*correlation\|correlation.*phase" -A3 -B3 "Tom King*.txt"
# Check implementation
grep -o "maxCorrelatedPositions:\s*[0-9]" src/config.js
```

#### Self-Correcting Pattern:
```javascript
// Instead of: "35% is wrong, should be 45-80%"
// Do this:
async function fixBPUsage() {
    // 1. Find source of truth
    const tomKingBP = await extractFromDocs('BP|buying power');
    
    // 2. Find current implementation
    const currentBP = await findInCode('maxBPUsage|MAX_BP');
    
    // 3. Identify mismatches
    const issues = compareImplementations(tomKingBP, currentBP);
    
    // 4. Fix only actual mismatches
    for (const issue of issues) {
        await fixIssue(issue.file, issue.current, tomKingBP[issue.param]);
    }
}
```

### COMMON FAILURE PATTERNS TO AVOID

#### 1. The "Multiple Final Versions" Pattern
```
FINAL_REPORT.md
FINAL_REPORT_V2.md
FINAL_REPORT_UPDATED.md
FINAL_VERIFICATION_REPORT.md
TRULY_FINAL_REPORT.md        # STOP! Use ONE file
```

#### 2. The "Redundant Backtest" Pattern
```
backtestingEngine.js         # Use this
PROFESSIONAL_BACKTEST.js     # Don't create
ADVANCED_BACKTEST.js         # Don't create
COMPREHENSIVE_BACKTEST.js    # Don't create
```

#### 3. The "False Claim" Pattern
```
"Archived 37 files"          # But actually only 5
"Fixed all BP issues"        # But 33 files still wrong
"100% complete"              # But major issues remain
```

#### 4. The "Recreate Existing" Pattern
```
Creating new dashboard       # When public/index.html exists
Writing new API integration  # When src/tastytradeAPI.js exists
Making new config system     # When src/config.js exists
```

### HONEST REPORTING REQUIREMENTS

#### When reporting completion, MUST include:
1. **Actual file count changes**
   ```bash
   Before: X files in root
   After: Y files in root
   Moved: Z files to archive
   ```

2. **Actual grep verification**
   ```bash
   grep -r "35%" --include="*.js" | wc -l
   # Should be 0 for BP fixes
   ```

3. **Actual functionality test**
   ```bash
   node -c src/*.js  # Syntax check
   node PRODUCTION_LAUNCHER.js  # Does it run?
   ```

### MEMORY NOTES FOR FUTURE SESSIONS

#### What EXISTS (as of September 2, 2025):
- ✅ Complete TastyTrade API with OAuth2 (src/tastytradeAPI.js)
- ✅ All 10 strategies implemented (src/strategies.js)
- ✅ Risk management with VIX-based BP (src/riskManager.js)
- ✅ Single backtest engine (src/backtestingEngine.js)
- ✅ Single dashboard (public/index.html)
- ✅ Greeks calculations (src/greeksCalculator.js)
- ✅ WebSocket streaming (src/marketDataStreamer.js)

#### What DOESN'T need creating:
- ❌ More backtest engines
- ❌ More dashboards
- ❌ More API integrations
- ❌ More config files
- ❌ Test files in root
- ❌ Multiple "final" reports

#### Common incorrect values to fix:
- 35% BP → Should be VIX-based 45-80%
- 92% win rate → Should be 88% for 0DTE
- Fixed correlation → Should be phase-based
- 50% BP in backtesting → Should use getMaxBPUsage()

### STARTUP PROTOCOL FOR EVERY SESSION

1. **Check what exists**
   ```bash
   ls *.js | head -20
   ls src/*.js | wc -l
   ls ARCHIVE_REDUNDANT/*.js 2>/dev/null | wc -l
   ```

2. **Check for problems**
   ```bash
   grep -r "0\.35" --include="*.js" | wc -l  # Should be 0
   grep -r "winRate.*92" --include="*.js" | wc -l  # Should be 0
   ```

3. **Understand history**
   ```bash
   git log --oneline -10
   cat HONEST_VERIFICATION_REPORT.md 2>/dev/null | head -50
   ```

### THE GOLDEN RULE

**"If it exists, EDIT it. If it doesn't exist, QUESTION whether you really need to create it."**

Remember: The Tom King Trading Framework is ALREADY comprehensive. Most tasks should be:
- Fixing parameters (BP, win rates)
- Improving existing code
- Removing redundancies
- Verifying correctness

NOT creating new versions of what already exists.