# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Tom King Trading Framework v17 - Complete automated trading system with JavaScript pattern analysis engine (2000+ lines), TastyTrade API integration, HTML dashboard with real-time updates, and Section 9B advanced strategies. Implements Tom King's systematic trading methodology across multiple account phases (£30k-£75k+).

## Project Goal: £35k to Financial Freedom in 7-8 Months
Transform £35,000 ($46,000) into £76,000 ($100,000) within 7-8 months using Tom King's systematic options and futures strategies, achieving financial freedom with £8,750 monthly income through 11-13% monthly compounding while maintaining 52-65% buying power usage and strict risk protocols. Using his Zero DTE Friday strategy (no losses in 2+ years), Long-Term 112 trades, and diversified futures strangles, we target aggressive but achievable 6.67% monthly returns while maintaining strict risk management (5% max per trade, 50% max buying power). The goal is complete financial independence by month 18, when the account reaches £100k and can sustainably generate £3,000 monthly at conservative 3% returns - enough to quit traditional employment and live off trading income alone.

## Development Status
✅ v17 COMPLETE: Successfully merged v14 (complete manual features) with v16 (API integration) with all features restored plus new enhancements.

## Framework Architecture

### Core Components
- **Pattern Analysis Engine**: JavaScript-based analysis (2000+ lines) that processes market data and generates trade recommendations
- **TastyTrade API Integration**: Real-time data fetching, position management, and order execution
- **Manual Web Search Mode**: Fallback for gathering market data without API access
- **HTML Dashboard**: Real-time visualization of positions, analysis, and recommendations
- **Section 9B Advanced Strategies**: Complex spread strategies and risk management protocols

### Execution Modes
1. **API Mode**: Real-time data from TastyTrade API
2. **Manual Mode**: Web search-based data gathering
3. **Test Mode**: Simulated data for testing scenarios

## Key Framework Files

### Core Documentation
- `TOM KING TRADING FRAMEWORK v14.txt` - Previous stable version with complete features
- `TOM KING TRADING FRAMEWORK v16.txt` - Current version with API integration
- `TOM KING TRADING FRAMEWORK v17.txt` - Latest development version
- `Tom King Complete Trading System Documentation 2.pdf` - Complete strategy reference (49 pages)
- `Tastytrade API Setup Reference.docx` - API configuration guide

### Implementation Files (To Be Created)
- `pattern-analysis.js` - Core pattern analysis engine
- `api-integration.js` - TastyTrade API wrapper
- `dashboard.html` - Trading dashboard interface
- `test-suite.js` - Comprehensive testing scenarios

## Development Workflow

### Merge Strategy (v14 + v16 → v17)
1. **Restore from v14**: Search parsing instructions, progressive Friday analysis, integration examples
2. **Preserve from v16**: API integration, WebSocket streaming, automated data collection
3. **New additions**: Section 9B full integration, comprehensive error handling, test suite

### Running the Framework
```javascript
// Execute pattern analysis (requires REPL/analysis tool)
node pattern-analysis.js --mode=[api|manual|test]

// Test specific scenarios
node test-suite.js --scenario=[friday-0dte|strangle-90dte|defensive-adjustment]

// Run with extended thinking for complex operations
claude --extended-thinking
```

### Testing Requirements
- Test all 10 trading strategies across different market conditions
- Validate position sizing calculations with UK pound sterling
- Test API authentication and data fetching
- Verify correlation group limits
- Test defensive adjustments at 21 DTE and 50% profit targets
- Recreate August 5, 2024 scenario (£308k loss prevention test)
- Test VIX regime transitions (all 5 levels)
- Validate 0DTE timing restrictions (after 10:30 AM only)

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
- Maximum 35% buying power usage
- Correlation group limits (max 3 positions per group)
- VIX-based position sizing adjustments
- 21 DTE defensive management
- 50% profit target for most strategies

## API Integration Points

### TastyTrade API Endpoints
- Authentication: OAuth2 with refresh tokens
- Account data: `/accounts/{account-id}/balances`
- Market data: `/market-data/quotes`
- Option chains: `/option-chains/{symbol}`
- Order execution: `/orders`
- WebSocket streaming: `wss://streamer.tastyworks.com`

## Testing Priorities

1. **Core Functionality**
   - Pattern analysis calculations
   - Position sizing algorithms
   - Entry/exit signal generation

2. **API Integration**
   - Authentication flow
   - Data fetching and parsing
   - Order preparation (not execution in test)

3. **Risk Management**
   - Correlation group tracking
   - Buying power calculations
   - Defensive adjustment triggers

4. **Dashboard Updates**
   - Real-time position display
   - P&L calculations
   - Alert notifications

## Critical Development Notes

### Non-Negotiable Requirements
- All pricing must use UK pound sterling (£) throughout
- Framework REQUIRES JavaScript execution environment (REPL/Node.js) for pattern analysis
- Never exceed correlation group limits (max 3 positions per group)
- Always validate day-specific strategy permissions (e.g., 0DTE only on Friday after 10:30 AM)
- Preserve ALL v14 features when merging with v16/v17

### Missing Features to Restore (from v14)
1. Complete "How to Parse Search Results" section with all examples
2. Progressive Friday Pre-Market Analysis (three phases: 9:00-9:30, 9:30-10:00, 10:00-10:30)
3. Complete Integration Example (£45,000 Phase 2 walkthrough)
4. Explicit BP requirements table
5. Manual mode search parsing instructions

### New Features to Complete (for v17)
1. Error handling classes (APIFailureHandler, DataSynchronizer)
2. Symbol utilities (occToStreamerSymbol, getNextFriday, get45DTEExpiration)
3. Greeks Monitor with WebSocket subscriptions
4. Section 9B advanced strategies full integration
5. Comprehensive test suite covering all scenarios

### August 2024 Lesson
The framework must prevent the £308k loss from excessive correlation that occurred on August 5, 2024. This is enforced through strict correlation group limits and real-time monitoring.

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
- All framework versions (v14, v16, v17)
- Configuration changes in TomKingTrader/
- Test results and performance metrics
- Risk management parameter adjustments

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