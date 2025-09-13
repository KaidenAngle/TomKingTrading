# Example: Proper TastyTrade Integration with Tom King Framework
# Shows how to eliminate redundancy and use existing architecture

from AlgorithmImports import *
from helpers.atomic_order_executor import EnhancedAtomicOrderExecutor
from brokers.tastytrade_api_client import TastytradeApiClient
from brokers.tastytrade_integration_adapter import TastytradeIntegrationAdapter

class TomKingWithTastyTradeIntegration(QCAlgorithm):
    """
    Example showing CORRECT integration pattern:
    - NO redundant order execution 
    - Uses existing AtomicOrderExecutor
    - TastyTrade provides live data + execution backend
    - All existing safety features preserved
    """
    
    def Initialize(self):
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2025, 1, 1)
        self.SetCash(30000)
        
        # Add securities
        spy = self.AddEquity("SPY", Resolution.Minute)
        spy_options = self.AddOption("SPY", Resolution.Minute)
        spy_options.SetFilter(-50, 50, timedelta(0), timedelta(days=60))
        
        # ==========================================
        # CORRECT INTEGRATION PATTERN
        # ==========================================
        
        # 1. Initialize existing atomic executor (NO CHANGES)
        self.atomic_executor = EnhancedAtomicOrderExecutor(self)
        
        # 2. Initialize TastyTrade API client (DATA + HELPER METHODS ONLY)
        self.tastytrade_client = TastytradeApiClient(self)
        
        # 3. Create integration adapter (ELIMINATES REDUNDANCY)
        self.tastytrade_integration = TastytradeIntegrationAdapter(
            self, self.atomic_executor, self.tastytrade_client
        )
        
        # Log integration status
        status = self.tastytrade_integration.get_integration_status()
        self.Log(f"TastyTrade Integration Status: {status}")
        
    def OnData(self, data):
        """Example usage of integrated system"""
        
        # Check if it's Friday for 0DTE
        if self.Time.weekday() == 4:  # Friday
            
            # Use TastyTrade for live market data
            spy_quote = self.tastytrade_client.get_quote("SPY")
            
            if spy_quote:
                self.Log(f"SPY Live Quote: {spy_quote['last']} (source: {spy_quote['source']})")
            
            # Get option chain with TastyTrade data in live mode
            chain = self.tastytrade_client.get_option_chain("SPY", dte=0)
            
            if chain and chain.get('expirations'):
                # Find suitable strikes
                strikes = self._find_iron_condor_strikes(chain)
                
                if strikes:
                    # ============================================
                    # EXECUTE USING EXISTING ATOMIC ARCHITECTURE
                    # ============================================
                    
                    # This uses the EXISTING atomic executor
                    # TastyTrade integration provides live execution backend
                    # NO duplicate implementations!
                    
                    success = self.tastytrade_integration.execute_iron_condor_live(
                        short_call=strikes['call_short'],
                        long_call=strikes['call_long'],
                        short_put=strikes['put_short'], 
                        long_put=strikes['put_long'],
                        quantity=1,
                        limit_price=1.50  # $1.50 credit target
                    )
                    
                    if success:
                        self.Log("✅ Iron condor executed using integrated system")
                    else:
                        self.Log("❌ Iron condor execution failed")
    
    def _find_iron_condor_strikes(self, chain):
        """Helper to find iron condor strikes"""
        
        # This is just example logic - real implementation would be more sophisticated
        if not chain or not chain.get('expirations'):
            return None
        
        exp = chain['expirations'][0]  # Use first expiration
        strikes = exp.get('strikes', [])
        
        if len(strikes) < 4:
            return None
        
        # Find strikes roughly 10 delta (simplified)
        mid_idx = len(strikes) // 2
        
        return {
            'put_short': strikes[mid_idx - 2]['strike'],   # Short put
            'put_long': strikes[mid_idx - 3]['strike'],    # Long put  
            'call_short': strikes[mid_idx + 2]['strike'],  # Short call
            'call_long': strikes[mid_idx + 3]['strike']    # Long call
        }
    
    def OnEndOfAlgorithm(self):
        """Clean shutdown"""
        
        if hasattr(self, 'tastytrade_integration'):
            self.tastytrade_integration.shutdown()
        
        self.Log("Algorithm ended - TastyTrade integration shut down")

# ==========================================
# COMPARISON: WRONG vs RIGHT PATTERNS
# ==========================================

"""
❌ WRONG PATTERN (What we had before):

class TastytradeApiClient:
    def place_order(self, ...):           # REDUNDANT
        # Duplicates atomic executor
        
    def place_multi_leg_order(self, ...): # REDUNDANT  
        # Duplicates atomic executor
        
    def place_iron_condor_order(self, ...): # REDUNDANT
        # Duplicates execute_iron_condor_atomic()

✅ CORRECT PATTERN (What we have now):

class TastytradeApiClient:
    def get_quote(self, ...):                    # DATA ONLY
    def get_option_chain(self, ...):             # DATA ONLY
    def submit_order_to_tastytrade(self, ...):   # BACKEND ONLY
    def build_tastytrade_order_payload(self, ...): # HELPER ONLY
    
class TastytradeIntegrationAdapter:
    def execute_iron_condor_live(self, ...):    # USES EXISTING ATOMIC
        return self.atomic_executor.execute_iron_condor_atomic(...)

RESULT:
- No redundant order execution logic
- Existing safety features preserved  
- TastyTrade provides live data + execution backend
- Clean separation of concerns
- Production-ready architecture
"""