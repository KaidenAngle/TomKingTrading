# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- Risk management protocols (5% max per trade, 35% max BP usage)
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