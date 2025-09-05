# 📚 Documentation Organization Guide

## Directory Structure and Contents

This documentation is organized by topic for easy navigation and reference during development.

---

## 📁 Documentation/QuantConnect/
**Purpose:** Everything related to QuantConnect LEAN platform

### Files to Move Here:
- `Quantconnect-Writing-Algorithms-Python.pdf`
- `Quantconnect-Local-Platform-Python.pdf`
- Any QuantConnect CLI guides
- LEAN engine documentation
- Algorithm examples from QuantConnect

### Subdirectories:
- `/Setup/` - Installation and configuration guides
- `/Algorithms/` - Example algorithms and templates
- `/Backtesting/` - Backtesting guides and results
- `/LiveTrading/` - Live deployment documentation

---

## 📁 Documentation/TastyTrade/
**Purpose:** TastyTrade API and integration documentation

### Files to Move Here:
- `TastyTrade API OverView.txt`
- `Getting Started.txt`
- `Order Submission.txt`
- `Order Flow.txt`
- `Order Management.txt`
- `Streaming Market Data.txt`
- `Streaming Account Data.txt`
- `Sandbox.txt`
- `FAQ.txt`
- `The 0Auth 2.0 Authorization Framework.txt`

### Subdirectories:
- `/API_Reference/` - Endpoint documentation
- `/Authentication/` - OAuth and session management
- `/WebSocket/` - Streaming data documentation
- `/Examples/` - Code examples and snippets

---

## 📁 Documentation/TomKingMethodology/
**Purpose:** Tom King's trading strategies and rules

### Files to Move Here:
- `TOM KING TRADING FRAMEWORK v17.txt`
- `Tom King Complete Trading System Documentation 2025 Updated.txt`
- `Comprehensive Tom King Trading Research Report.txt`
- Any strategy-specific documentation

### Subdirectories:
- `/Strategies/` - Individual strategy documentation
  - `Friday_0DTE.md`
  - `LongTerm_112.md`
  - `Futures_Strangles.md`
- `/RiskManagement/` - Risk rules and parameters
- `/AccountPhases/` - Phase 1-4 progression
- `/Results/` - Historical performance and case studies

---

## 📁 Documentation/APIs/
**Purpose:** General API documentation and integration guides

### Files to Move Here:
- `API JSON documents/` folder contents
- Any REST API documentation
- WebSocket protocol guides
- Rate limiting documentation

### Subdirectories:
- `/REST/` - RESTful API documentation
- `/WebSocket/` - Real-time streaming APIs
- `/Authentication/` - Auth flows for various platforms

---

## 📁 Documentation/Strategies/
**Purpose:** Strategy implementation details and code

### Contents:
- Strategy flowcharts
- Entry/exit rules
- Backtesting results
- Optimization parameters

### Subdirectories:
- `/Options/` - Options strategies
- `/Futures/` - Futures strategies
- `/Defensive/` - Defensive adjustments
- `/Advanced/` - Section 9B strategies

---

## 📁 Documentation/Backtesting/
**Purpose:** Backtesting methodology and results

### Contents:
- Historical test results
- Performance metrics
- Drawdown analysis
- Win rate statistics

### Subdirectories:
- `/Results/` - Test results by date
- `/Methodology/` - How backtests are conducted
- `/Optimization/` - Parameter optimization results

---

## 📗 Quick Reference Guide

### When You Need...

**To set up QuantConnect:**
→ `Documentation/QuantConnect/Setup/`

**TastyTrade API endpoints:**
→ `Documentation/TastyTrade/API_Reference/`

**Tom King strategy rules:**
→ `Documentation/TomKingMethodology/Strategies/`

**OAuth implementation:**
→ `Documentation/TastyTrade/Authentication/`

**Backtesting results:**
→ `Documentation/Backtesting/Results/`

**Risk management parameters:**
→ `Documentation/TomKingMethodology/RiskManagement/`

---

## 🎯 Benefits of This Organization

1. **Clear Separation** - Each platform/topic has its own space
2. **Easy Navigation** - Find what you need quickly
3. **No Confusion** - QuantConnect vs TastyTrade clearly separated
4. **Logical Grouping** - Related documents stay together
5. **Future Proof** - Easy to add new documentation

---

## 📝 File Naming Convention

### Use These Patterns:
- `SETUP_*.md` - Setup and installation guides
- `API_*.md` - API reference documentation
- `STRATEGY_*.md` - Strategy implementation
- `BACKTEST_*.md` - Backtesting results
- `README.md` - Overview for each folder

### Date Format:
- Use `YYYY-MM-DD` for dated documents
- Example: `BACKTEST_2025-09-04_Results.md`

---

## 🔄 Migration Checklist

### QuantConnect Files:
- [ ] Move both QuantConnect PDFs
- [ ] Create setup instructions
- [ ] Add algorithm examples

### TastyTrade Files:
- [ ] Move all API text files
- [ ] Organize by functionality
- [ ] Add authentication guides

### Tom King Files:
- [ ] Move framework documentation
- [ ] Separate strategies
- [ ] Document risk rules

### Cleanup:
- [ ] Remove duplicates
- [ ] Update file references
- [ ] Create index files

---

## 💡 Tips for Claude/AI

**When starting a session:**
1. Check `Documentation/README_ORGANIZATION.md` first
2. Navigate to relevant section based on task
3. Reference specific files by their new paths

**For QuantConnect work:**
→ Start in `Documentation/QuantConnect/`

**For API integration:**
→ Check both `Documentation/TastyTrade/` and `Documentation/APIs/`

**For strategy implementation:**
→ Cross-reference `Documentation/TomKingMethodology/` and `Documentation/Strategies/`

---

## 📌 Important Notes

- **Version Control**: All documentation is git-tracked
- **Updates**: When adding new docs, follow this structure
- **References**: Update code comments to reflect new paths
- **Backups**: Keep original file structure until migration verified

---

*Last Updated: September 4, 2025*
*Organization Version: 1.0*