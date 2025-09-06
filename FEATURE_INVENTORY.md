# TomKingTrader JS System - Complete Feature Inventory

## Core Trading Strategies (10 Tom King + 7 Section 9B)

### Tom King Core Strategies (src/strategies.js)
1. **Friday 0DTE Strategy** - SPX/SPY 0DTE trades on Fridays after 10:30 AM
2. **Long-Term 1-1-2 Strategy** - 45-90 DTE balanced spreads
3. **Futures Strangles** - MCL (Oil), MGC (Gold) micro futures
4. **IPMCC Strategy** (src/ipmccStrategy.js) - Income-focused covered calls
5. **LEAP Put Ladders** (src/leapPutLadderStrategy.js) - Long-term protection
6. **Calendarized 1-1-2** (src/calendarized112Strategy.js) - Time-spread variation
7. **Iron Condors** - High probability range-bound trades
8. **Broken Wing Butterflies** - Asymmetric risk/reward
9. **Ratio Spreads** - Premium collection with upside
10. **Diagonal Spreads** - Calendar + directional bias

### Section 9B Advanced Strategies (src/section9BStrategies.js)
1. **Enhanced Butterfly** - Dynamic wing adjustments
2. **Batman Spread** - High volatility specialist
3. **Broken Wing Condor** - Phase 4 only, asymmetric profit
4. **Christmas Tree Butterfly** - Multi-strike optimization
5. **Jade Lizard** - Premium collection with protection
6. **Twisted Sister** - Complex volatility play
7. **Super Bull** - Aggressive bullish positioning

## Risk Management Components

### Position & Portfolio Management
- **RiskManager** (src/riskManager.js) - Kelly Criterion, VaR, position sizing
- **PositionManager** (src/positionManager.js) - Track and manage all positions
- **AssignmentRiskMonitor** (src/assignmentRiskMonitor.js) - Monitor assignment risk
- **EmergencyProtocol** (src/emergencyProtocol.js) - Circuit breakers and panic buttons

### Correlation & Diversification
- **Correlation Groups** - Max positions per sector (3 equity, 2 energy, etc.)
- **SectorRotationTracker** (src/sectorRotationTracker.js) - Sector momentum tracking
- **VIX Regime Management** - BP usage based on VIX levels (45%-80%)

### Defensive Management Rules
- **21 DTE Rule** - Close/manage positions at 21 DTE
- **50% Profit Target** - Auto-close winners at 50% max profit
- **200% Loss Stop** - Hard stop at 2x credit received
- **Friday Psychology Protection** (src/fridayPsychologyProtection.js)
- **Fed Announcement Protection** (src/fedAnnouncementProtection.js)
- **Momentum Spike Protection** (src/momentumSpikeProtection.js)

## Market Analysis & Data

### Real-Time Data Streaming
- **TastyTradeAPI** (src/tastytradeAPI.js) - Live market data and execution
- **MarketDataStreamer** (src/marketDataStreamer.js) - WebSocket streaming
- **AccountStreamer** (src/accountStreamer.js) - Account updates

### Advanced Analytics
- **GreeksCalculator** (src/greeksCalculator.js) - Options Greeks calculations
- **VixTermStructure** (src/vixTermStructure.js) - Contango/backwardation analysis
- **EnhancedPatternAnalysis** (src/enhancedPatternAnalysis.js) - Technical patterns
- **MarketMicrostructureMonitor** (src/marketMicrostructureMonitor.js) - Order flow
- **OptionsFlowAnomalyDetector** (src/optionsFlowAnomalyDetector.js) - Unusual activity
- **OptionsPinningDetector** (src/optionsPinningDetector.js) - Pin risk analysis

### Economic & Event Calendars
- **EarningsCalendar** (src/earningsCalendar.js) - Earnings dates
- **EconomicDataCalendar** (src/economicDataCalendar.js) - Economic releases
- **FuturesRollCalendar** (src/futuresRollCalendar.js) - Futures expiration
- **TreasuryAuctionCalendar** (src/treasuryAuctionCalendar.js) - Treasury events

## Trading Execution & Automation

### Order Management
- **OrderManager** (src/orderManager.js) - Order routing and execution
- **PositionAutomation** (src/positionAutomation.js) - Automated position management
- **SignalGenerator** (src/signalGenerator.js) - Trade signal generation
- **EnhancedRecommendationEngine** (src/enhancedRecommendationEngine.js) - AI recommendations

### Income & Performance
- **IncomeGenerator** (src/incomeGenerator.js) - Income-focused strategies
- **PerformanceMetrics** (src/performanceMetrics.js) - Performance tracking
- **TradeJournal** (src/tradeJournal.js) - Trade logging and analysis
- **UKTaxTracker** (src/ukTaxTracker.js) - UK tax calculations

## System Integration & Testing

### Core System
- **MasterController** (src/masterController.js) - Central orchestration
- **TradingSystemIntegration** (src/tradingSystemIntegration.js) - Module integration
- **DataManager** (src/dataManager.js) - Data persistence and caching
- **Config** (src/config.js) - System configuration
- **Logger** (src/logger.js) - Comprehensive logging

### Testing & Validation
- **BacktestingEngine** (src/backtestingEngine.js) - Historical backtesting
- **PatternValidation** (src/patternValidation.js) - Pattern verification

## Account Phases & Progression

### Phase System
- **Phase 1**: £30-40k - Basic strategies only
- **Phase 2**: £40-60k - Add futures, advanced spreads
- **Phase 3**: £60-75k - Add Section 9B strategies
- **Phase 4**: £75k+ - Full arsenal, all 17 strategies

### Buying Power Management by VIX
- VIX < 16: 45% BP usage
- VIX 16-20: 65% BP usage  
- VIX 20-25: 75% BP usage
- VIX 25-30: 80% BP usage (Tom King maximum)
- VIX > 30: 80% BP (crisis mode)

## Status Check Commands

Let me test each major component to verify functionality...