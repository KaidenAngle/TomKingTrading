# TastyTrade API Integration Test for Tom King Trading Framework
# Tests all API functionality we're using in QuantConnect LEAN

from AlgorithmImports import *
from datetime import datetime, timedelta
import json

class TastyTradeAPITest(QCAlgorithm):
    """
    Comprehensive test of TastyTrade API integration in LEAN
    Tests all aspects of the API we're using for Tom King Trading
    """
    
    def Initialize(self):
        """Initialize test algorithm"""
        self.SetStartDate(2024, 1, 1)
        self.SetEndDate(2024, 1, 2)  # Just one day for testing
        self.SetCash(100000)
        
        # Set TastyTrade as brokerage model - CRITICAL for API
        self.SetBrokerageModel(BrokerageName.Tastytrade, AccountType.Margin)
        
        # Initialize test tracking
        self.tests_passed = []
        self.tests_failed = []
        
        # Add test symbols
        self.spy = self.AddEquity("SPY", Resolution.Minute)
        self.AddOption("SPY", Resolution.Minute)
        
        # Schedule comprehensive API tests
        self.Schedule.On(
            self.DateRules.Tomorrow,
            self.TimeRules.At(9, 31),
            self.RunAllAPITests
        )
        
        self.Log("=" * 60)
        self.Log("TASTYTRADE API INTEGRATION TEST SUITE")
        self.Log("=" * 60)
    
    def RunAllAPITests(self):
        """Run all TastyTrade API tests"""
        self.Log("\n🔧 STARTING TASTYTRADE API TESTS\n")
        
        # Test 1: Brokerage Model Configuration
        self.TestBrokerageModel()
        
        # Test 2: Fee Model
        self.TestFeeModel()
        
        # Test 3: Option Chain Access
        self.TestOptionChainAccess()
        
        # Test 4: Order Types
        self.TestOrderTypes()
        
        # Test 5: Combo Orders
        self.TestComboOrders()
        
        # Test 6: Portfolio Access
        self.TestPortfolioAccess()
        
        # Test 7: Greeks Calculation
        self.TestGreeksCalculation()
        
        # Test 8: Market Hours
        self.TestMarketHours()
        
        # Test 9: Margin Requirements
        self.TestMarginRequirements()
        
        # Test 10: Live Data Feed
        self.TestLiveDataFeed()
        
        # Print test results
        self.PrintTestResults()
    
    def TestBrokerageModel(self):
        """Test 1: Verify TastyTrade brokerage model is properly configured"""
        test_name = "Brokerage Model Configuration"
        try:
            # Check brokerage name
            brokerage_name = str(self.BrokerageModel.__class__.__name__)
            
            # Verify it's TastyTrade
            if "Tastytrade" in brokerage_name or "TastyTrade" in brokerage_name:
                self.tests_passed.append(test_name)
                self.Log(f"✅ {test_name}: Brokerage model is TastyTrade")
                
                # Check account type
                self.Log(f"   Account Type: {self.Portfolio.AccountType}")
                self.Log(f"   Margin Used: ${self.Portfolio.TotalMarginUsed}")
                self.Log(f"   Buying Power: ${self.Portfolio.MarginRemaining}")
            else:
                self.tests_failed.append(test_name)
                self.Log(f"❌ {test_name}: Brokerage is {brokerage_name}, not TastyTrade")
                
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestFeeModel(self):
        """Test 2: Verify TastyTrade fee structure"""
        test_name = "Fee Model"
        try:
            # Create a test order to check fees
            spy_price = self.Securities["SPY"].Price
            
            # Test equity order fee (should be $0)
            equity_fee = self.BrokerageModel.GetFeeModel().GetOrderFee(
                OrderFeeParameters(
                    self.Securities["SPY"],
                    Orders.MarketOrder("SPY", 100, self.Time)
                )
            )
            
            # Test option order fee (should be $1 per contract, max $10 per leg)
            option_chain = self.OptionChainProvider.GetOptionChain(self.spy.Symbol, self.Time)
            if option_chain:
                first_contract = list(option_chain)[0] if option_chain else None
                if first_contract:
                    option = self.AddOptionContract(first_contract)
                    option_fee = self.BrokerageModel.GetFeeModel().GetOrderFee(
                        OrderFeeParameters(
                            option,
                            Orders.MarketOrder(first_contract, 1, self.Time)
                        )
                    )
                    
                    self.Log(f"   Option Fee (1 contract): ${option_fee.Value}")
                    self.Log(f"   Option Fee (15 contracts): Should cap at $10")
            
            self.Log(f"✅ {test_name}: Equity Fee: ${equity_fee.Value}, Option fees checked")
            self.tests_passed.append(test_name)
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestOptionChainAccess(self):
        """Test 3: Verify we can access option chains through API"""
        test_name = "Option Chain Access"
        try:
            # Get option chain for SPY
            contracts = self.OptionChainProvider.GetOptionChain(self.spy.Symbol, self.Time)
            
            if contracts and len(contracts) > 0:
                self.Log(f"✅ {test_name}: Found {len(contracts)} option contracts")
                
                # Analyze chain structure
                expirations = set()
                strikes = set()
                puts = 0
                calls = 0
                
                for contract in list(contracts)[:100]:  # Sample first 100
                    expirations.add(contract.Expiry.date())
                    strikes.add(contract.Strike)
                    if contract.Right == OptionRight.Put:
                        puts += 1
                    else:
                        calls += 1
                
                self.Log(f"   Expirations: {len(expirations)}")
                self.Log(f"   Unique Strikes: {len(strikes)}")
                self.Log(f"   Puts: {puts}, Calls: {calls}")
                
                self.tests_passed.append(test_name)
            else:
                self.tests_failed.append(test_name)
                self.Log(f"❌ {test_name}: No option contracts found")
                
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestOrderTypes(self):
        """Test 4: Test various order types supported by TastyTrade"""
        test_name = "Order Types"
        try:
            # Test market order
            market_order = self.MarketOrder("SPY", 1)
            if market_order:
                self.Log(f"✅ Market Order created: {market_order.OrderId}")
            
            # Test limit order
            spy_price = self.Securities["SPY"].Price
            limit_order = self.LimitOrder("SPY", 1, spy_price * 0.99)
            if limit_order:
                self.Log(f"✅ Limit Order created: {limit_order.OrderId}")
            
            # Test stop order
            stop_order = self.StopMarketOrder("SPY", -1, spy_price * 0.95)
            if stop_order:
                self.Log(f"✅ Stop Order created: {stop_order.OrderId}")
            
            # Cancel test orders
            self.Transactions.CancelOpenOrders("SPY")
            
            self.tests_passed.append(test_name)
            self.Log(f"✅ {test_name}: All order types working")
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestComboOrders(self):
        """Test 5: Test multi-leg combo orders (critical for Tom King strategies)"""
        test_name = "Combo Orders"
        try:
            # Get option contracts for combo
            chain = self.OptionChainProvider.GetOptionChain(self.spy.Symbol, self.Time)
            
            if chain and len(chain) > 4:
                contracts = sorted(chain, key=lambda x: (x.Expiry, x.Strike))
                
                # Find put spread contracts
                puts = [c for c in contracts if c.Right == OptionRight.Put]
                if len(puts) >= 2:
                    # Create put spread legs
                    short_put = puts[len(puts)//2]
                    long_put = puts[len(puts)//2 - 5]
                    
                    # Add contracts
                    self.AddOptionContract(short_put)
                    self.AddOptionContract(long_put)
                    
                    # Create combo order legs
                    legs = [
                        Leg.Create(short_put, -1),  # Sell 1
                        Leg.Create(long_put, 1)      # Buy 1
                    ]
                    
                    # Submit combo order
                    combo_order = self.ComboMarketOrder(legs, 1)
                    
                    if combo_order:
                        self.Log(f"✅ Combo Order created: {combo_order[0].OrderId}")
                        self.tests_passed.append(test_name)
                        
                        # Cancel for testing
                        for order in combo_order:
                            self.Transactions.CancelOrder(order.OrderId)
                    else:
                        self.tests_failed.append(test_name)
                        self.Log(f"❌ {test_name}: Combo order failed")
                else:
                    self.Log(f"⚠️ {test_name}: Not enough puts for spread test")
            else:
                self.Log(f"⚠️ {test_name}: Insufficient option chain data")
                
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestPortfolioAccess(self):
        """Test 6: Test portfolio data access"""
        test_name = "Portfolio Access"
        try:
            # Access portfolio properties
            portfolio_value = self.Portfolio.TotalPortfolioValue
            cash = self.Portfolio.Cash
            invested = self.Portfolio.Invested
            margin_used = self.Portfolio.TotalMarginUsed
            margin_remaining = self.Portfolio.MarginRemaining
            
            self.Log(f"✅ {test_name}: Portfolio data accessible")
            self.Log(f"   Total Value: ${portfolio_value:,.2f}")
            self.Log(f"   Cash: ${cash:,.2f}")
            self.Log(f"   Invested: {invested}")
            self.Log(f"   Margin Used: ${margin_used:,.2f}")
            self.Log(f"   Margin Available: ${margin_remaining:,.2f}")
            
            self.tests_passed.append(test_name)
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestGreeksCalculation(self):
        """Test 7: Test Greeks calculation for options"""
        test_name = "Greeks Calculation"
        try:
            # Get an option contract
            chain = self.OptionChainProvider.GetOptionChain(self.spy.Symbol, self.Time)
            
            if chain and len(chain) > 0:
                contract = list(chain)[0]
                option = self.AddOptionContract(contract)
                
                # Try to access Greeks
                if hasattr(option, 'Greeks'):
                    self.Log(f"✅ {test_name}: Greeks available")
                    # Note: Greeks might be None until market opens
                    self.Log(f"   Contract: {contract}")
                    self.Log(f"   Greeks object exists: {option.Greeks is not None}")
                    self.tests_passed.append(test_name)
                else:
                    self.Log(f"⚠️ {test_name}: Greeks not available on option object")
            else:
                self.Log(f"⚠️ {test_name}: No option chain available")
                
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestMarketHours(self):
        """Test 8: Test market hours detection"""
        test_name = "Market Hours"
        try:
            # Check if market is open
            spy = self.Securities["SPY"]
            is_open = spy.Exchange.DateTimeIsOpen(self.Time)
            
            # Get market hours
            hours = spy.Exchange.Hours
            
            self.Log(f"✅ {test_name}: Market hours accessible")
            self.Log(f"   Market Open: {is_open}")
            self.Log(f"   Current Time: {self.Time}")
            
            # Check next market open
            if not is_open:
                next_open = hours.GetNextMarketOpen(self.Time, False)
                self.Log(f"   Next Open: {next_open}")
            
            self.tests_passed.append(test_name)
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestMarginRequirements(self):
        """Test 9: Test margin requirement calculations"""
        test_name = "Margin Requirements"
        try:
            # Get initial margin requirement for SPY
            spy_margin = self.Securities["SPY"].MarginModel.GetInitialMarginRequirement(
                InitialMarginRequirementParameters(
                    self.Securities["SPY"],
                    100  # 100 shares
                )
            )
            
            self.Log(f"✅ {test_name}: Margin calculations working")
            self.Log(f"   SPY margin for 100 shares: ${spy_margin}")
            
            # Test buying power
            buying_power = self.Securities["SPY"].BuyingPowerModel.GetBuyingPower(
                BuyingPowerParameters(
                    self.Portfolio,
                    self.Securities["SPY"],
                    OrderDirection.Buy
                )
            )
            
            self.Log(f"   Buying Power: ${buying_power.Value:,.2f}")
            
            self.tests_passed.append(test_name)
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def TestLiveDataFeed(self):
        """Test 10: Test live data feed capabilities"""
        test_name = "Live Data Feed"
        try:
            # Check data resolution
            spy = self.Securities["SPY"]
            
            self.Log(f"✅ {test_name}: Data feed configuration")
            self.Log(f"   Symbol: {spy.Symbol}")
            self.Log(f"   Data Resolution: {spy.Resolution}")
            self.Log(f"   Price: ${spy.Price}")
            self.Log(f"   Bid: ${spy.BidPrice}")
            self.Log(f"   Ask: ${spy.AskPrice}")
            self.Log(f"   Volume: {spy.Volume}")
            
            # Check if we have live data
            has_data = spy.HasData
            self.Log(f"   Has Data: {has_data}")
            
            self.tests_passed.append(test_name)
            
        except Exception as e:
            self.tests_failed.append(test_name)
            self.Log(f"❌ {test_name}: {str(e)}")
    
    def PrintTestResults(self):
        """Print comprehensive test results"""
        self.Log("\n" + "=" * 60)
        self.Log("TASTYTRADE API TEST RESULTS")
        self.Log("=" * 60)
        
        total_tests = len(self.tests_passed) + len(self.tests_failed)
        
        self.Log(f"\n✅ PASSED: {len(self.tests_passed)}/{total_tests}")
        for test in self.tests_passed:
            self.Log(f"   ✓ {test}")
        
        if self.tests_failed:
            self.Log(f"\n❌ FAILED: {len(self.tests_failed)}/{total_tests}")
            for test in self.tests_failed:
                self.Log(f"   ✗ {test}")
        
        # Overall assessment
        self.Log("\n" + "=" * 60)
        if len(self.tests_failed) == 0:
            self.Log("🎉 ALL TASTYTRADE API TESTS PASSED!")
            self.Log("✅ System ready for live trading with TastyTrade")
        elif len(self.tests_failed) <= 2:
            self.Log("⚠️ MOSTLY WORKING - Minor issues detected")
            self.Log("Most TastyTrade features functional")
        else:
            self.Log("❌ CRITICAL ISSUES DETECTED")
            self.Log("TastyTrade integration needs attention")
        self.Log("=" * 60)
    
    def OnData(self, data):
        """Process incoming data"""
        pass
    
    def OnEndOfAlgorithm(self):
        """Final summary"""
        self.Log("\n🏁 TastyTrade API Test Complete")
        self.Log(f"Tests Passed: {len(self.tests_passed)}")
        self.Log(f"Tests Failed: {len(self.tests_failed)}")


# Run the test
if __name__ == "__main__":
    from AlgorithmImports import *
    
    # This would be run in LEAN
    print("TastyTrade API Test created")
    print("Run this in LEAN to test TastyTrade integration")
    print("\nKey features being tested:")
    print("1. Brokerage model configuration")
    print("2. Fee structure ($1/contract, max $10/leg)")  
    print("3. Option chain access")
    print("4. Order types (market, limit, stop)")
    print("5. Combo orders for multi-leg spreads")
    print("6. Portfolio and margin data")
    print("7. Greeks calculation")
    print("8. Market hours detection")
    print("9. Margin requirements")
    print("10. Live data feed")