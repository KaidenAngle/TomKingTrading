# region imports
from AlgorithmImports import *
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
# endregion

class TastytradeDataProvider:
    """
    Hybrid data provider that uses Tastytrade API for live trading
    while maintaining QuantConnect compatibility for backtesting
    """
    
    def __init__(self, algorithm, use_tastytrade: bool = False):
        self.algorithm = algorithm
        self.use_tastytrade = use_tastytrade and algorithm.LiveMode
        
        # Tastytrade API credentials (set in live mode only)
        self.api_base = "https://api.tastytrade.com"
        self.refresh_token = None
        self.access_token = None
        self.account_number = None
        
        # Cache for option chains to reduce API calls
        self.option_chain_cache = {}
        self.cache_expiry = {}
        
        # Initialize if in live mode with Tastytrade
        if self.use_tastytrade:
            self.initialize_tastytrade()
    
    def initialize_tastytrade(self):
        """Initialize Tastytrade connection in live mode"""
        try:
            # These would be set via QuantConnect's brokerage configuration
            self.refresh_token = self.algorithm.GetParameter("tastytrade-refresh-token")
            self.account_number = self.algorithm.GetParameter("tastytrade-account-number")
            
            if self.refresh_token:
                self.refresh_access_token()
                self.algorithm.Log("Tastytrade API initialized successfully")
        except Exception as e:
            self.algorithm.Error(f"Failed to initialize Tastytrade: {str(e)}")
            self.use_tastytrade = False
    
    def refresh_access_token(self):
        """Refresh the Tastytrade access token"""
        if not self.refresh_token:
            return False
            
        try:
            response = requests.post(
                f"{self.api_base}/sessions",
                json={"refresh_token": self.refresh_token}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("data", {}).get("token")
                return True
        except Exception as e:
            self.algorithm.Error(f"Token refresh failed: {str(e)}")
        
        return False
    
    def get_option_chain(self, symbol: str, expiry_dte: int = None) -> Dict:
        """
        Get option chain data from Tastytrade or QuantConnect
        
        Returns unified format regardless of source
        """
        if self.use_tastytrade:
            return self._get_tastytrade_option_chain(symbol, expiry_dte)
        else:
            return self._get_quantconnect_option_chain(symbol, expiry_dte)
    
    def _get_tastytrade_option_chain(self, symbol: str, expiry_dte: int) -> Dict:
        """Get option chain from Tastytrade API"""
        
        # Check cache first
        cache_key = f"{symbol}_{expiry_dte}"
        if cache_key in self.option_chain_cache:
            if datetime.now() < self.cache_expiry.get(cache_key, datetime.min):
                return self.option_chain_cache[cache_key]
        
        try:
            # IMPORTANT: Tastytrade uses session tokens WITHOUT Bearer prefix!
            headers = {"Authorization": self.access_token}
            
            # Get option chain
            response = requests.get(
                f"{self.api_base}/option-chains/{symbol}/nested",
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Parse Tastytrade format to unified format
                chain = self._parse_tastytrade_chain(data, expiry_dte)
                
                # Cache for 5 minutes
                self.option_chain_cache[cache_key] = chain
                self.cache_expiry[cache_key] = datetime.now() + timedelta(minutes=5)
                
                return chain
                
        except Exception as e:
            self.algorithm.Error(f"Tastytrade API error: {str(e)}")
            # Fall back to QuantConnect
            return self._get_quantconnect_option_chain(symbol, expiry_dte)
        
        return {}
    
    def _get_quantconnect_option_chain(self, symbol: str, expiry_dte: int) -> Dict:
        """Get option chain from QuantConnect"""
        
        chain = {}
        
        try:
            # Get the symbol object
            equity = self.algorithm.Securities.get(symbol)
            if not equity:
                equity = self.algorithm.AddEquity(symbol, Resolution.Minute)
            
            # Calculate expiry date
            expiry = self.algorithm.Time + timedelta(days=expiry_dte)
            
            # Get contracts
            contracts = self.algorithm.OptionChainProvider.GetOptionContractList(
                equity.Symbol, 
                self.algorithm.Time
            )
            
            # Filter by expiry
            filtered = [c for c in contracts 
                       if (c.ID.Date - self.algorithm.Time).days == expiry_dte]
            
            # Build chain structure
            chain = {
                'symbol': symbol,
                'expiry_dte': expiry_dte,
                'strikes': {},
                'atm_strike': equity.Price,
                'underlying_price': equity.Price
            }
            
            for contract in filtered:
                strike = contract.ID.StrikePrice
                
                if strike not in chain['strikes']:
                    chain['strikes'][strike] = {
                        'call': None,
                        'put': None
                    }
                
                # Add contract data
                contract_data = {
                    'strike': strike,
                    'bid': None,  # Will be populated when contract is added
                    'ask': None,
                    'delta': None,
                    'gamma': None,
                    'theta': None,
                    'vega': None,
                    'iv': None,
                    'volume': None,
                    'open_interest': None
                }
                
                if contract.ID.OptionRight == OptionRight.Call:
                    chain['strikes'][strike]['call'] = contract_data
                else:
                    chain['strikes'][strike]['put'] = contract_data
                    
        except Exception as e:
            self.algorithm.Error(f"QuantConnect chain error: {str(e)}")
        
        return chain
    
    def _parse_tastytrade_chain(self, data: Dict, expiry_dte: int) -> Dict:
        """Parse Tastytrade API response to unified format"""
        
        chain = {
            'symbol': data.get('underlying_symbol'),
            'expiry_dte': expiry_dte,
            'strikes': {},
            'atm_strike': None,
            'underlying_price': None
        }
        
        try:
            # Get expirations
            expirations = data.get('data', {}).get('expirations', [])
            
            # Find the right expiration
            target_date = datetime.now() + timedelta(days=expiry_dte)
            best_expiry = None
            min_diff = float('inf')
            
            for exp in expirations:
                exp_date = datetime.strptime(exp['expiration_date'], '%Y-%m-%d')
                diff = abs((exp_date - target_date).days)
                if diff < min_diff:
                    min_diff = diff
                    best_expiry = exp
            
            if best_expiry:
                # Parse strikes
                for strike_data in best_expiry.get('strikes', []):
                    strike = float(strike_data['strike'])
                    
                    chain['strikes'][strike] = {
                        'call': self._parse_tastytrade_option(strike_data.get('call')),
                        'put': self._parse_tastytrade_option(strike_data.get('put'))
                    }
                
                # Set ATM strike
                if chain['strikes']:
                    underlying = float(data.get('data', {}).get('underlying_price', 0))
                    chain['underlying_price'] = underlying
                    chain['atm_strike'] = min(chain['strikes'].keys(), 
                                             key=lambda x: abs(x - underlying))
            
        except Exception as e:
            self.algorithm.Error(f"Parse error: {str(e)}")
        
        return chain
    
    def _parse_tastytrade_option(self, option_data: Dict) -> Optional[Dict]:
        """Parse individual option data from Tastytrade"""
        
        if not option_data:
            return None
            
        return {
            'strike': float(option_data.get('strike', 0)),
            'bid': float(option_data.get('bid', 0)),
            'ask': float(option_data.get('ask', 0)),
            'delta': float(option_data.get('delta', 0)),
            'gamma': float(option_data.get('gamma', 0)),
            'theta': float(option_data.get('theta', 0)),
            'vega': float(option_data.get('vega', 0)),
            'iv': float(option_data.get('implied_volatility', 0)),
            'volume': int(option_data.get('volume', 0)),
            'open_interest': int(option_data.get('open_interest', 0))
        }
    
    def find_delta_strike(self, symbol: str, delta: float, expiry_dte: int, 
                         option_type: str = 'put') -> Tuple[float, float]:
        """
        Find strike closest to target delta
        Returns: (strike, premium)
        """
        
        chain = self.get_option_chain(symbol, expiry_dte)
        
        if not chain or not chain.get('strikes'):
            return None, None
        
        best_strike = None
        best_premium = None
        min_delta_diff = float('inf')
        
        for strike, options in chain['strikes'].items():
            option = options.get(option_type)
            
            if option and option.get('delta'):
                delta_diff = abs(abs(option['delta']) - abs(delta))
                
                if delta_diff < min_delta_diff:
                    min_delta_diff = delta_diff
                    best_strike = strike
                    best_premium = option.get('bid', 0)
        
        return best_strike, best_premium
    
    def get_0dte_iron_condor(self, symbol: str) -> Dict:
        """
        Get 0DTE iron condor strikes and pricing
        Specifically for Friday 0DTE strategy
        """
        
        chain = self.get_option_chain(symbol, 0)
        
        if not chain or not chain.get('strikes'):
            return {}
        
        atm = chain.get('atm_strike', 0)
        if not atm:
            return {}
        
        # Find 10-delta strikes (Tom King methodology)
        put_strike, put_premium = self.find_delta_strike(symbol, 0.10, 0, 'put')
        call_strike, call_premium = self.find_delta_strike(symbol, 0.10, 0, 'call')
        
        if not all([put_strike, call_strike]):
            return {}
        
        # Calculate iron condor setup
        ic_data = {
            'underlying': symbol,
            'atm_price': atm,
            'put_short': put_strike,
            'put_long': put_strike - 30,  # 30-point wings for ES
            'call_short': call_strike,
            'call_long': call_strike + 30,
            'put_credit': put_premium,
            'call_credit': call_premium,
            'total_credit': put_premium + call_premium,
            'max_risk': 30 - (put_premium + call_premium),
            'data_source': 'tastytrade' if self.use_tastytrade else 'quantconnect'
        }
        
        return ic_data
    
    def get_strangle_strikes(self, symbol: str, expiry_dte: int = 90, 
                            delta: float = 0.05) -> Dict:
        """
        Get strangle strikes for futures or ETFs
        Used by LT112 and futures strangle strategies
        """
        
        chain = self.get_option_chain(symbol, expiry_dte)
        
        if not chain:
            return {}
        
        put_strike, put_premium = self.find_delta_strike(symbol, delta, expiry_dte, 'put')
        call_strike, call_premium = self.find_delta_strike(symbol, delta, expiry_dte, 'call')
        
        if not all([put_strike, call_strike]):
            return {}
        
        return {
            'symbol': symbol,
            'expiry_dte': expiry_dte,
            'put_strike': put_strike,
            'call_strike': call_strike,
            'put_premium': put_premium,
            'call_premium': call_premium,
            'total_credit': put_premium + call_premium,
            'data_source': 'tastytrade' if self.use_tastytrade else 'quantconnect'
        }
    
    def place_order_with_tastytrade(self, order_details: Dict) -> bool:
        """
        Place order through Tastytrade API in live mode
        Falls back to QuantConnect for backtesting
        """
        
        if not self.use_tastytrade:
            # Use QuantConnect's order system
            return self._place_quantconnect_order(order_details)
        
        try:
            # IMPORTANT: Tastytrade uses session tokens WITHOUT Bearer prefix!
            headers = {"Authorization": self.access_token}
            
            # Build Tastytrade order
            tastytrade_order = self._build_tastytrade_order(order_details)
            
            response = requests.post(
                f"{self.api_base}/accounts/{self.account_number}/orders",
                headers=headers,
                json=tastytrade_order
            )
            
            if response.status_code == 201:
                order_id = response.json().get('data', {}).get('id')
                self.algorithm.Log(f"Tastytrade order placed: {order_id}")
                return True
            else:
                self.algorithm.Error(f"Tastytrade order failed: {response.text}")
                return False
                
        except Exception as e:
            self.algorithm.Error(f"Order placement error: {str(e)}")
            return False
    
    def _build_tastytrade_order(self, details: Dict) -> Dict:
        """Build order in Tastytrade format"""
        
        # This would need to be customized based on Tastytrade's exact API format
        return {
            "order_type": details.get('order_type', 'limit'),
            "time_in_force": details.get('time_in_force', 'day'),
            "legs": details.get('legs', []),
            "price": details.get('limit_price'),
            "price_effect": details.get('price_effect', 'credit')
        }
    
    def _place_quantconnect_order(self, details: Dict) -> bool:
        """Place order through QuantConnect"""
        
        try:
            # This uses QuantConnect's standard order methods
            # Implementation depends on order type
            return True
        except Exception as e:
            self.algorithm.Error(f"QC order error: {str(e)}")
            return False

# Usage in main algorithm:
"""
def Initialize(self):
    # Check if we're using Tastytrade as broker
    self.use_tastytrade = self.GetParameter("use-tastytrade-data") == "true"
    
    # Initialize hybrid data provider
    self.data_provider = TastytradeDataProvider(self, use_tastytrade=self.use_tastytrade)
    
def OnData(self, data):
    # Get option chain (from Tastytrade in live, QC in backtest)
    chain = self.data_provider.get_option_chain("SPY", 30)
    
    # Get 0DTE setup for Friday
    if self.Time.weekday() == 4:  # Friday
        ic_setup = self.data_provider.get_0dte_iron_condor("SPY")
        
    # Place orders through appropriate broker
    order = {
        'symbol': 'SPY',
        'legs': [...],
        'order_type': 'limit',
        'limit_price': 1.50
    }
    self.data_provider.place_order_with_tastytrade(order)
"""