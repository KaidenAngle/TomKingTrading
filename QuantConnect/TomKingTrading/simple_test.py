# region imports
from AlgorithmImports import *
# endregion

class SimpleTestAlgorithm(QCAlgorithm):
    """
    Simple test algorithm to verify QuantConnect LEAN setup
    """

    def Initialize(self):
        """Initialize the algorithm with basic settings"""
        # Set the time period and cash
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 2, 1)
        self.SetCash(35000)  # £35,000 starting capital
        
        # Set the data resolution
        self.UniverseSettings.Resolution = Resolution.Daily
        
        # Set brokerage model to TastyTrade
        self.SetBrokerageModel(BrokerageName.TastyTrade)
        
        # Add SPY for testing
        self.spy = self.AddEquity("SPY", Resolution.Daily)
        self.spy.SetDataNormalizationMode(DataNormalizationMode.Raw)
        
        # Schedule function to run every day
        self.Schedule.On(
            self.DateRules.EveryDay("SPY"),
            self.TimeRules.At(10, 0),
            self.Trade
        )
        
        self.Log("Simple Test Algorithm initialized with £35,000")
        self.Log("Testing Tom King Trading Framework setup")
        
    def Trade(self):
        """Simple trading logic for testing"""
        if not self.Portfolio.Invested:
            # Buy 100 shares of SPY for testing
            self.SetHoldings("SPY", 0.5)
            self.Log(f"Bought SPY at {self.Securities['SPY'].Price}")
        elif self.Portfolio["SPY"].UnrealizedProfitPercent > 0.02:
            # Sell if we have 2% profit
            self.Liquidate("SPY")
            self.Log(f"Sold SPY at {self.Securities['SPY'].Price}")
    
    def OnData(self, data):
        """Process incoming data"""
        if not data.ContainsKey("SPY"):
            return
        
        price = data["SPY"].Close
        self.Plot("Price", "SPY", price)
        
    def OnEndOfAlgorithm(self):
        """Final logging"""
        self.Log(f"Algorithm completed. Final portfolio value: £{self.Portfolio.TotalPortfolioValue:,.2f}")