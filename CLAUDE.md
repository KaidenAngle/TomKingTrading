# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Tom King Trading Framework v17.2 - Production-ready automated trading system with comprehensive JavaScript pattern analysis engine (3500+ lines), complete TastyTrade API integration, real-time HTML dashboard, and advanced Section 9B strategies. Fully implements Tom King's systematic trading methodology across all account phases (£35k-£80k+).

## Project Goal: £35k to £80k in 8 Months
Transform £35,000 into £80,000 within 8 months using Tom King's systematic options and futures strategies, achieving financial freedom with £10,000 monthly income through 12% monthly compounding while maintaining 52-65% buying power usage and strict risk protocols. Using his Zero DTE Friday strategy (no losses in 2+ years), Long-Term 112 trades, and diversified futures strangles, we target aggressive but achievable 6.67% monthly returns while maintaining strict risk management (5% max per trade, 50% max buying power). The goal is complete financial independence by month 18, when the account reaches £100k and can sustainably generate £3,000 monthly at conservative 3% returns - enough to quit traditional employment and live off trading income alone.

## Development Status
✅ v17.2 PRODUCTION READY: Complete implementation with all features operational, comprehensive testing suite, secure credentials management, and enhanced pattern analysis system.

## Framework Architecture

### Core Components
- **Enhanced Pattern Analysis System**: Advanced JavaScript-based analysis (3500+ lines) with multi-timeframe processing, VIX regime detection, and correlation analysis
- **Complete TastyTrade API Integration**: Full OAuth2 authentication, real-time market data, option chains, and order management
- **Comprehensive Test Suite**: 25+ test scenarios covering all strategies and market conditions
- **Secure Credentials Management**: Encrypted credential storage and automatic token refresh
- **Real-time HTML Dashboard**: Live position monitoring, P&L tracking, and risk visualization
- **Advanced Section 9B Strategies**: Complete implementation of complex spreads and defensive adjustments

### Execution Modes
1. **API Mode**: Real-time data from TastyTrade API
2. **Manual Mode**: Web search-based data gathering
3. **Test Mode**: Simulated data for testing scenarios

## Key Framework Files

### Core Documentation
- `TOM KING TRADING FRAMEWORK v17.txt` - Production-ready complete implementation (229KB)
- `CORE_FRAMEWORK.txt` - Core framework components and architecture
- `ADVANCED_STRATEGIES.txt` - Section 9B advanced strategies implementation
- `API_INTEGRATION.txt` - TastyTrade API integration documentation
- `HTML_DASHBOARD.txt` - Dashboard implementation and features
- `API Documentation/` - Complete TastyTrade API reference guides

### Production Implementation Files
- `TomKingTrader/src/app.js` - Main application entry point (88KB)
- `TomKingTrader/src/enhancedPatternAnalysis.js` - Advanced pattern analysis engine (64KB)
- `TomKingTrader/src/enhancedRecommendationEngine.js` - Trade recommendation system (53KB)
- `TomKingTrader/src/tastytradeAPI.js` - Complete API integration (81KB)
- `TomKingTrader/src/testingFramework.js` - Comprehensive test suite (49KB)
- `TomKingTrader/src/comprehensiveTestSuite.js` - Advanced testing scenarios (49KB)
- `TomKingTrader/public/testing.html` - Real-time testing dashboard

## Production Deployment

### Running the Framework
```javascript
// Start the complete trading framework
cd TomKingTrader
node src/app.js

// Run comprehensive test suite
node src/comprehensiveTestSuite.js

// Execute specific test scenarios
node testRunner.js

// Start with testing dashboard
// Open TomKingTrader/public/testing.html in browser
```

### Framework Modules
```javascript
// Load specific components
const PatternAnalysis = require('./src/enhancedPatternAnalysis');
const API = require('./src/tastytradeAPI');
const TestSuite = require('./src/testingFramework');
const RecommendationEngine = require('./src/enhancedRecommendationEngine');
```

### Production Features Implemented

## Enhanced Pattern Analysis System
- **Multi-timeframe Analysis**: 1-minute, 5-minute, 15-minute, 1-hour, and daily patterns
- **VIX Regime Detection**: Automatic classification across 5 volatility regimes (0-12, 12-20, 20-30, 30-40, 40+)
- **Correlation Analysis**: Real-time monitoring of position correlations with automatic limits
- **Greeks Calculations**: Delta, gamma, theta, vega with real-time updates
- **Technical Indicators**: ATR, RSI, EMAs (8,21,50,200), VWAP, Bollinger Bands
- **Pattern Recognition**: Support/resistance, momentum, mean reversion patterns

## Comprehensive Test Suite
- **25+ Test Scenarios**: All trading strategies across different market conditions
- **Market Condition Testing**: Bull, bear, sideways, high volatility environments  
- **Strategy-Specific Tests**: Friday 0DTE, Long-Term 112, strangles, butterflies
- **Risk Management Testing**: Correlation limits, buying power usage, defensive adjustments
- **Historical Scenario Recreation**: August 5, 2024 crash prevention validation
- **Performance Benchmarking**: Execution time and accuracy metrics

## Secure Credentials Management
- **Encrypted Storage**: AES-256 encryption for API credentials
- **Automatic Token Refresh**: OAuth2 token management with refresh handling
- **Environment Variables**: Secure configuration management
- **Access Control**: Role-based permissions for different trading functions
- **Audit Logging**: Complete transaction and access history

## Option Chain Implementation
- **Real-time Data**: Live option prices, Greeks, and volatility metrics
- **Strike Selection**: Automated strike selection based on delta targets
- **Expiration Management**: DTE tracking with automatic expiration handling
- **IV Analysis**: Implied volatility rank and percentile calculations
- **Spread Pricing**: Accurate bid-ask spread analysis for complex strategies

## Futures Contract Mapping
- **Complete Symbol Mapping**: All micro and mini futures contracts
- **Contract Specifications**: Multipliers, tick sizes, margin requirements
- **Expiration Cycles**: Automatic next-month contract selection
- **Currency Conversion**: USD to GBP conversion for all P&L calculations
- **Correlation Groups**: Predefined correlation mappings for risk management

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

## Production Testing Coverage

### Implemented Test Categories
1. **Pattern Analysis Validation**
   - All 10 trading strategies tested across market conditions
   - Technical indicator accuracy verification
   - VIX regime classification testing
   - Correlation analysis validation

2. **API Integration Tests**
   - OAuth2 authentication flow testing
   - Market data fetching and parsing validation
   - Option chain data accuracy verification
   - Order preparation and validation testing

3. **Risk Management Tests**
   - Correlation group limit enforcement
   - Buying power usage monitoring
   - Position sizing calculation accuracy
   - Defensive adjustment trigger testing

4. **System Integration Tests**
   - Real-time dashboard updates
   - P&L calculation accuracy
   - Alert notification systems
   - Error handling and recovery procedures

## Critical Development Notes

### Production Requirements (All Implemented)
- ✅ All pricing uses UK pound sterling (£) throughout with automatic USD conversion
- ✅ Complete JavaScript execution environment with Node.js pattern analysis
- ✅ Automated correlation group limits enforcement (max 3 positions per group)
- ✅ Day-specific strategy validation (0DTE only Friday after 10:30 AM, etc.)
- ✅ All v14 features preserved and enhanced in v17.2 implementation

### Completed Feature Implementation
1. ✅ Complete search result parsing with all examples (SEARCH_PARSING.txt)
2. ✅ Progressive Friday Pre-Market Analysis with three phases implemented
3. ✅ Complete integration examples across all account phases
4. ✅ Explicit BP requirements table with real-time monitoring
5. ✅ Manual mode search parsing instructions fully documented

### Advanced Features Completed (v17.2)
1. ✅ Complete error handling classes (APIFailureHandler, DataSynchronizer)
2. ✅ Full symbol utilities suite (occToStreamerSymbol, getNextFriday, get45DTEExpiration)
3. ✅ Greeks Monitor with WebSocket subscriptions and real-time updates
4. ✅ Section 9B advanced strategies fully integrated and tested
5. ✅ Comprehensive test suite covering all 25+ scenarios and market conditions

### August 2024 Lesson (Fully Addressed)
✅ The framework prevents the £308k loss from excessive correlation that occurred on August 5, 2024. This is enforced through:
- Automated correlation group limits with real-time enforcement
- Advanced correlation analysis across all positions
- Immediate alerts when correlation thresholds are approached
- Historical scenario testing to validate prevention measures
- Enhanced risk management protocols with automatic position sizing adjustments

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

## Production Status Summary

### Framework v17.2 Complete Implementation
The Tom King Trading Framework v17.2 is now production-ready with all critical components implemented and tested:

**✅ Core Systems Operational**
- Enhanced Pattern Analysis System (3500+ lines)
- Complete TastyTrade API Integration with OAuth2
- Real-time HTML Dashboard with live updates
- Comprehensive Test Suite (25+ scenarios)
- Secure Credentials Management
- Advanced Risk Management with correlation monitoring

**✅ All Trading Strategies Implemented**
- Friday Zero DTE (Tom King's signature strategy)
- Long-Term 112 strategies
- Futures strangles across all contract types
- Section 9B advanced spreads and butterflies
- Defensive adjustment protocols
- VIX regime-based position sizing

**✅ Production-Ready Features**
- Automated correlation group enforcement
- Real-time P&L tracking in GBP
- Historical scenario testing (including Aug 5, 2024 prevention)
- Complete error handling and recovery
- Audit logging and transaction history
- Live market data streaming

**🎯 Ready for £35k → £80k Goal**
The framework is fully equipped to execute the 8-month trading plan with:
- Strict risk management (5% max per trade, 35% max BP usage)
- Automated strategy execution across all account phases
- Real-time monitoring and alerts
- Complete audit trail for performance tracking

**Next Steps for Live Deployment**
1. Final credential configuration for live TastyTrade account
2. Initial small-scale testing with minimal position sizes
3. Gradual scaling according to account phase progression
4. Continuous monitoring and performance optimization

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