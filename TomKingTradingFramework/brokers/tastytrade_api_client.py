# region imports
from AlgorithmImports import *
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.tastytrade_credentials_secure import TastytradeCredentials
# endregion

class TastytradeApiClient:
    """
    Fixed Tastytrade Data Provider for Tom King Trading Framework
    Based on working JavaScript implementation
    
    Key fixes applied:
    1. No "Bearer" prefix for session tokens
    2. Use remember token for authentication
    3. Correct endpoint paths
    4. Proper symbol mapping
    """
    
    def __init__(self, algorithm):
        self.algorithm = algorithm
        self.is_live = algorithm.LiveMode if hasattr(algorithm, 'LiveMode') else False
        
        # Get credentials
        self.credentials = TastytradeCredentials()
        self.endpoints = TastytradeCredentials.get_api_endpoints()
        
        # Session management
        self.session_token = None
        self.remember_token = TastytradeCredentials.REMEMBER_TOKEN
        self.last_auth_time = None
        self.session_duration = timedelta(hours=23)  # Refresh daily
        
        # Cache management
        self.quote_cache = {}
        self.option_chain_cache = {}
        self.cache_duration = timedelta(minutes=1)  # 1 minute cache for quotes
        
        # Initialize connection if in live mode
        if self.is_live:
            self.authenticate()
    
    def authenticate(self) -> bool:
        """
        Authenticate with Tastytrade API
        Uses remember token if available, falls back to username/password
        """
        try:
            # Try remember token first
            if self.remember_token:
                self.algorithm.Log("Attempting authentication with remember token")
                
                data = {
                    'remember-token': self.remember_token
                }
                
                response = requests.post(
                    self.endpoints['sessions'],
                    json=data,
                    headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'TomKingFramework/17.0'
                    },
                    timeout=30
                )
                
                if response.status_code == 201:
                    session_data = response.json().get('data', {})
                    self.session_token = session_data.get('session-token')
                    new_remember = session_data.get('remember-token')
                    
                    if new_remember:
                        self.remember_token = new_remember
                        self.algorithm.Log(f"New remember token received")
                    
                    self.last_auth_time = datetime.now()
                    self.algorithm.Log("Authentication successful with remember token")
                    return True
            
            # Fall back to username/password
            self.algorithm.Log("Attempting username/password authentication")
            
            data = {
                'login': TastytradeCredentials.USERNAME,
                'password': TastytradeCredentials.PASSWORD,
                'remember-me': True
            }
            
            response = requests.post(
                self.endpoints['sessions'],
                json=data,
                headers={
                    'Content-Type': 'application/json',
                    'User-Agent': 'TomKingFramework/17.0'
                },
                timeout=30
            )
            
            if response.status_code == 201:
                session_data = response.json().get('data', {})
                self.session_token = session_data.get('session-token')
                self.remember_token = session_data.get('remember-token')
                
                if self.remember_token:
                    self.algorithm.Log(f"New remember token: {self.remember_token[:50]}...")
                
                self.last_auth_time = datetime.now()
                self.algorithm.Log("Authentication successful with username/password")
                return True
            else:
                self.algorithm.Error(f"Authentication failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.algorithm.Error(f"Authentication error: {str(e)}")
            return False
    
    def ensure_authenticated(self) -> bool:
        """Ensure we have a valid session token"""
        
        # Check if we need to re-authenticate
        if not self.session_token or not self.last_auth_time:
            return self.authenticate()
        
        # Check if session is expired
        if datetime.now() - self.last_auth_time > self.session_duration:
            self.algorithm.Log("Session expired, re-authenticating")
            return self.authenticate()
        
        return True
    
    def get_headers(self) -> Dict:
        """
        Get headers for API requests
        CRITICAL: No Bearer prefix for Tastytrade!
        """
        return {
            'Authorization': self.session_token,  # Direct token, NO Bearer prefix
            'User-Agent': 'TomKingFramework/17.0',
            'Accept': 'application/json'
        }
    
    def map_symbol(self, symbol: str) -> Tuple[str, str]:
        """
        Map symbol to Tastytrade format
        Returns: (mapped_symbol, symbol_type)
        """
        
        # Futures symbols
        if symbol in ['ES', 'MES', 'CL', 'MCL', 'GC', 'MGC', 'NQ', 'MNQ', 'RTY', 'M2K']:
            return f"/{symbol}", "Future"
        
        # Index symbols
        if symbol in ['VIX', 'SPX', 'NDX', 'RUT', 'DJX']:
            return f"${symbol}", "Index"
        
        # ETFs and stocks
        return symbol, "Equity"
    
    def get_quote(self, symbol: str) -> Optional[Dict]:
        """
        Get real-time quote from Tastytrade
        Falls back to QuantConnect if not in live mode
        """
        
        # Use QuantConnect in backtest mode
        if not self.is_live:
            return self._get_qc_quote(symbol)
        
        # Check cache
        cache_key = f"quote_{symbol}"
        if cache_key in self.quote_cache:
            cached_time, cached_data = self.quote_cache[cache_key]
            if datetime.now() - cached_time < self.cache_duration:
                return cached_data
        
        # Ensure authenticated
        if not self.ensure_authenticated():
            return self._get_qc_quote(symbol)
        
        try:
            # Map symbol
            mapped_symbol, symbol_type = self.map_symbol(symbol)
            
            # Build request
            params = {
                'symbols': mapped_symbol,
                'types': symbol_type
            }
            
            response = requests.get(
                self.endpoints['market_data'],
                params=params,
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('data', {}).get('items', [])
                
                if items:
                    # Extract first item
                    item = items[0] if isinstance(items, list) else items[list(items.keys())[0]]
                    
                    quote = {
                        'symbol': symbol,
                        'last': float(item.get('last', 0) or item.get('mark', 0)),
                        'bid': float(item.get('bid', 0) or 0),
                        'ask': float(item.get('ask', 0) or 0),
                        'volume': float(item.get('volume', 0) or 0),
                        'open': float(item.get('open', 0) or 0),
                        'high': float(item.get('high', 0) or 0),
                        'low': float(item.get('low', 0) or 0),
                        'close': float(item.get('close', 0) or item.get('last', 0)),
                        'timestamp': datetime.now(),
                        'source': 'tastytrade'
                    }
                    
                    # Cache result
                    self.quote_cache[cache_key] = (datetime.now(), quote)
                    
                    return quote
            
            # Fall back to QuantConnect
            self.algorithm.Log(f"Tastytrade quote failed for {symbol}, using QuantConnect")
            return self._get_qc_quote(symbol)
            
        except Exception as e:
            self.algorithm.Error(f"Quote error for {symbol}: {str(e)}")
            return self._get_qc_quote(symbol)
    
    def _get_qc_quote(self, symbol: str) -> Optional[Dict]:
        """Get quote from QuantConnect"""
        
        try:
            security = self.algorithm.Securities.get(symbol)
            
            if not security:
                # Try to add the security
                if symbol in ['SPY', 'QQQ', 'IWM', 'DIA']:
                    security = self.algorithm.AddEquity(symbol, Resolution.Minute)
                else:
                    return None
            
            return {
                'symbol': symbol,
                'last': float(security.Price),
                'bid': float(security.BidPrice),
                'ask': float(security.AskPrice),
                'volume': float(security.Volume),
                'open': float(security.Open),
                'high': float(security.High),
                'low': float(security.Low),
                'close': float(security.Close),
                'timestamp': self.algorithm.Time,
                'source': 'quantconnect'
            }
            
        except Exception as e:
            self.algorithm.Error(f"QC quote error for {symbol}: {str(e)}")
            return None
    
    def get_option_chain(self, symbol: str, dte: int = None) -> Optional[Dict]:
        """
        Get option chain from Tastytrade or QuantConnect
        """
        
        # Use QuantConnect in backtest mode
        if not self.is_live:
            return self._get_qc_option_chain(symbol, dte)
        
        # Check cache
        cache_key = f"chain_{symbol}_{dte}"
        if cache_key in self.option_chain_cache:
            cached_time, cached_data = self.option_chain_cache[cache_key]
            if datetime.now() - cached_time < timedelta(minutes=5):
                return cached_data
        
        # Ensure authenticated
        if not self.ensure_authenticated():
            return self._get_qc_option_chain(symbol, dte)
        
        try:
            # Determine endpoint
            mapped_symbol, symbol_type = self.map_symbol(symbol)
            
            if symbol_type == "Future":
                # Remove leading slash for futures option chains
                clean_symbol = mapped_symbol[1:] if mapped_symbol.startswith('/') else mapped_symbol
                endpoint = f"{self.endpoints['futures_chains']}/{clean_symbol}/nested"
            else:
                endpoint = f"{self.endpoints['option_chains']}/{symbol}/nested"
            
            response = requests.get(
                endpoint,
                headers=self.get_headers(),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('data', {}).get('items', [])
                
                # Parse chain
                chain = self._parse_tastytrade_chain(items, symbol, dte)
                
                # Cache result
                self.option_chain_cache[cache_key] = (datetime.now(), chain)
                
                return chain
            
            # Fall back to QuantConnect
            self.algorithm.Log(f"Tastytrade chain failed for {symbol}, using QuantConnect")
            return self._get_qc_option_chain(symbol, dte)
            
        except Exception as e:
            self.algorithm.Error(f"Option chain error for {symbol}: {str(e)}")
            return self._get_qc_option_chain(symbol, dte)
    
    def _parse_tastytrade_chain(self, expirations: List, symbol: str, target_dte: int = None) -> Dict:
        """Parse Tastytrade option chain response"""
        
        chain = {
            'symbol': symbol,
            'expirations': [],
            'target_dte': target_dte,
            'source': 'tastytrade'
        }
        
        today = datetime.now().date()
        
        for exp_data in expirations:
            exp_date_str = exp_data.get('expiration-date')
            if not exp_date_str:
                continue
            
            exp_date = datetime.strptime(exp_date_str, '%Y-%m-%d').date()
            days_to_exp = (exp_date - today).days
            
            # Filter by DTE if specified
            if target_dte is not None:
                if abs(days_to_exp - target_dte) > 3:  # 3 day tolerance
                    continue
            
            exp_info = {
                'expiration_date': exp_date_str,
                'dte': days_to_exp,
                'strikes': []
            }
            
            # Parse strikes
            for strike_data in exp_data.get('strikes', []):
                strike = float(strike_data.get('strike-price', 0))
                
                put_data = strike_data.get('put')
                call_data = strike_data.get('call')
                
                strike_info = {
                    'strike': strike,
                    'put': self._parse_option_data(put_data) if put_data else None,
                    'call': self._parse_option_data(call_data) if call_data else None
                }
                
                exp_info['strikes'].append(strike_info)
            
            chain['expirations'].append(exp_info)
        
        return chain
    
    def _parse_option_data(self, option_data: Dict) -> Dict:
        """Parse individual option data from Tastytrade"""
        
        return {
            'symbol': option_data.get('symbol'),
            'bid': float(option_data.get('bid', 0) or 0),
            'ask': float(option_data.get('ask', 0) or 0),
            'last': float(option_data.get('last', 0) or 0),
            'mark': float(option_data.get('mark', 0) or 0),
            'delta': float(option_data.get('delta', 0) or 0),
            'gamma': float(option_data.get('gamma', 0) or 0),
            'theta': float(option_data.get('theta', 0) or 0),
            'vega': float(option_data.get('vega', 0) or 0),
            'iv': float(option_data.get('implied-volatility', 0) or 0),
            'volume': int(option_data.get('volume', 0) or 0),
            'open_interest': int(option_data.get('open-interest', 0) or 0)
        }
    
    def _get_qc_option_chain(self, symbol: str, dte: int = None) -> Optional[Dict]:
        """Get option chain from QuantConnect"""
        
        try:
            # Get underlying
            underlying = self.algorithm.Securities.get(symbol)
            if not underlying:
                underlying = self.algorithm.AddEquity(symbol, Resolution.Minute)
            
            # Get option contracts
            contracts = self.algorithm.OptionChainProvider.GetOptionContractList(
                underlying.Symbol,
                self.algorithm.Time
            )
            
            # Build chain structure
            chain = {
                'symbol': symbol,
                'expirations': [],
                'target_dte': dte,
                'source': 'quantconnect'
            }
            
            # Group by expiration
            exp_groups = {}
            for contract in contracts:
                exp_date = contract.ID.Date
                days_to_exp = (exp_date - self.algorithm.Time).days
                
                # Filter by DTE if specified
                if dte is not None:
                    if abs(days_to_exp - dte) > 3:
                        continue
                
                exp_key = exp_date.strftime('%Y-%m-%d')
                if exp_key not in exp_groups:
                    exp_groups[exp_key] = {
                        'expiration_date': exp_key,
                        'dte': days_to_exp,
                        'strikes': {}
                    }
                
                strike = float(contract.ID.StrikePrice)
                if strike not in exp_groups[exp_key]['strikes']:
                    exp_groups[exp_key]['strikes'][strike] = {
                        'strike': strike,
                        'put': None,
                        'call': None
                    }
                
                # Add option data (would need to subscribe for real data)
                option_data = {
                    'symbol': str(contract.Symbol),
                    'bid': 0,
                    'ask': 0,
                    'last': 0,
                    'delta': 0,
                    'gamma': 0,
                    'theta': 0,
                    'vega': 0,
                    'iv': 0,
                    'volume': 0,
                    'open_interest': 0
                }
                
                if contract.ID.OptionRight == OptionRight.Call:
                    exp_groups[exp_key]['strikes'][strike]['call'] = option_data
                else:
                    exp_groups[exp_key]['strikes'][strike]['put'] = option_data
            
            # Convert to list format
            for exp_data in exp_groups.values():
                exp_data['strikes'] = list(exp_data['strikes'].values())
                chain['expirations'].append(exp_data)
            
            return chain
            
        except Exception as e:
            self.algorithm.Error(f"QC option chain error: {str(e)}")
            return None
    
    def find_10_delta_strikes(self, symbol: str, dte: int = 0) -> Optional[Dict]:
        """
        Find 10-delta strikes for Tom King's 0DTE strategy
        Returns strikes for iron condor setup
        """
        
        chain = self.get_option_chain(symbol, dte)
        
        if not chain or not chain.get('expirations'):
            return None
        
        # Get first expiration (closest to target DTE)
        exp_data = chain['expirations'][0]
        strikes = exp_data.get('strikes', [])
        
        # Find 10-delta strikes
        put_10_delta = None
        call_10_delta = None
        
        for strike_data in strikes:
            put = strike_data.get('put')
            call = strike_data.get('call')
            
            # Check put delta (looking for -0.10)
            if put and not put_10_delta:
                delta = abs(put.get('delta', 0))
                if 0.08 <= delta <= 0.12:  # 10-delta with tolerance
                    put_10_delta = {
                        'strike': strike_data['strike'],
                        'delta': -delta,
                        'bid': put.get('bid', 0),
                        'ask': put.get('ask', 0)
                    }
            
            # Check call delta (looking for 0.10)
            if call and not call_10_delta:
                delta = abs(call.get('delta', 0))
                if 0.08 <= delta <= 0.12:  # 10-delta with tolerance
                    call_10_delta = {
                        'strike': strike_data['strike'],
                        'delta': delta,
                        'bid': call.get('bid', 0),
                        'ask': call.get('ask', 0)
                    }
            
            # Stop if both found
            if put_10_delta and call_10_delta:
                break
        
        if not (put_10_delta and call_10_delta):
            return None
        
        # Build iron condor setup
        wing_width = 30  # Standard 30-point wings for ES
        
        return {
            'symbol': symbol,
            'dte': dte,
            'expiration': exp_data['expiration_date'],
            'put_short': put_10_delta['strike'],
            'put_long': put_10_delta['strike'] - wing_width,
            'call_short': call_10_delta['strike'],
            'call_long': call_10_delta['strike'] + wing_width,
            'put_credit': (put_10_delta['bid'] + put_10_delta['ask']) / 2,
            'call_credit': (call_10_delta['bid'] + call_10_delta['ask']) / 2,
            'total_credit': None,  # Will be calculated
            'max_risk': wing_width,
            'put_delta': put_10_delta['delta'],
            'call_delta': call_10_delta['delta'],
            'source': chain.get('source', 'unknown')
        }
    
    def place_order(self, symbol: str, quantity: int, order_type: str = 'MARKET', 
                    limit_price: float = None, stop_price: float = None) -> Optional[Dict]:
        """
        Place an order through TastyTrade API
        
        Args:
            symbol: Option or stock symbol
            quantity: Number of contracts (positive for buy, negative for sell)
            order_type: 'MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'
            limit_price: Limit price for limit orders
            stop_price: Stop price for stop orders
            
        Returns:
            Order response from API or None if failed
        """
        if not self.is_session_valid():
            self.authenticate()
        
        if not self.session_token:
            self.algorithm.Error("Cannot place order - not authenticated")
            return None
        
        try:
            # Get account number
            account_info = self.get_account_info()
            if not account_info:
                self.algorithm.Error("Cannot get account info for order placement")
                return None
            
            account_number = account_info['account_number']
            
            # Build order payload
            order_payload = {
                'order-type': order_type.lower(),
                'time-in-force': 'Day',  # Day order by default
                'legs': [{
                    'instrument-type': 'Option' if '/' in symbol else 'Equity',
                    'symbol': symbol,
                    'quantity': abs(quantity),
                    'action': 'Buy to Open' if quantity > 0 else 'Sell to Open'
                }]
            }
            
            # Add price if limit or stop order
            if order_type in ['LIMIT', 'STOP_LIMIT'] and limit_price:
                order_payload['price'] = limit_price
            if order_type in ['STOP', 'STOP_LIMIT'] and stop_price:
                order_payload['stop-trigger'] = stop_price
            
            # Submit order
            url = f"{self.endpoints['base']}/accounts/{account_number}/orders"
            
            response = requests.post(
                url,
                json=order_payload,
                headers={
                    'Authorization': self.session_token,  # No "Bearer" prefix
                    'Content-Type': 'application/json',
                    'User-Agent': 'TomKingFramework/17.0'
                },
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                order_data = response.json().get('data', {})
                self.algorithm.Log(f"Order placed successfully: {symbol} x{quantity}")
                return order_data
            else:
                self.algorithm.Error(f"Order placement failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Exception placing order: {str(e)}")
            return None
    
    def place_multi_leg_order(self, legs: List[Dict], order_type: str = 'MARKET', 
                             limit_price: float = None) -> Optional[Dict]:
        """
        Place a multi-leg option order (spreads, iron condors, etc.)
        
        Args:
            legs: List of leg definitions, each containing:
                  - symbol: Option symbol
                  - quantity: Number of contracts
                  - action: 'buy' or 'sell'
            order_type: 'MARKET' or 'LIMIT'
            limit_price: Net credit/debit limit price
            
        Returns:
            Order response or None if failed
        """
        if not self.is_session_valid():
            self.authenticate()
        
        if not self.session_token:
            self.algorithm.Error("Cannot place order - not authenticated")
            return None
        
        try:
            # Get account number
            account_info = self.get_account_info()
            if not account_info:
                return None
            
            account_number = account_info['account_number']
            
            # Build multi-leg order
            order_legs = []
            for leg in legs:
                order_legs.append({
                    'instrument-type': 'Option',
                    'symbol': leg['symbol'],
                    'quantity': abs(leg['quantity']),
                    'action': 'Buy to Open' if leg['action'] == 'buy' else 'Sell to Open'
                })
            
            order_payload = {
                'order-type': order_type.lower(),
                'time-in-force': 'Day',
                'legs': order_legs
            }
            
            if order_type == 'LIMIT' and limit_price:
                order_payload['price'] = limit_price
            
            # Submit order
            url = f"{self.endpoints['base']}/accounts/{account_number}/orders"
            
            response = requests.post(
                url,
                json=order_payload,
                headers={
                    'Authorization': self.session_token,
                    'Content-Type': 'application/json',
                    'User-Agent': 'TomKingFramework/17.0'
                },
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                self.algorithm.Log(f"Multi-leg order placed: {len(legs)} legs")
                return response.json().get('data', {})
            else:
                self.algorithm.Error(f"Multi-leg order failed: {response.text}")
                return None
                
        except Exception as e:
            self.algorithm.Error(f"Exception in multi-leg order: {str(e)}")
            return None
    
    def get_account_info(self) -> Optional[Dict]:
        """Get account information from Tastytrade"""
        
        if not self.is_live:
            return self._get_qc_account_info()
        
        if not self.ensure_authenticated():
            return self._get_qc_account_info()
        
        try:
            # Get account balance
            account_num = TastytradeCredentials.ACCOUNT_NUMBER_CASH
            
            response = requests.get(
                f"{self.endpoints['accounts']}/{account_num}/balances",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                
                return {
                    'account_number': account_num,
                    'net_liquidation': float(data.get('net-liquidating-value', 0) or 0),
                    'cash_balance': float(data.get('cash-balance', 0) or 0),
                    'buying_power': float(data.get('derivative-buying-power', 0) or 0),
                    'maintenance_margin': float(data.get('maintenance-requirement', 0) or 0),
                    'source': 'tastytrade'
                }
            
            return self._get_qc_account_info()
            
        except Exception as e:
            self.algorithm.Error(f"Account info error: {str(e)}")
            return self._get_qc_account_info()
    
    def _get_qc_account_info(self) -> Dict:
        """Get account info from QuantConnect"""
        
        return {
            'account_number': 'QC_ACCOUNT',
            'net_liquidation': float(self.algorithm.Portfolio.TotalPortfolioValue),
            'cash_balance': float(self.algorithm.Portfolio.Cash),
            'buying_power': float(self.algorithm.Portfolio.MarginRemaining),
            'maintenance_margin': float(self.algorithm.Portfolio.TotalMarginUsed),
            'source': 'quantconnect'
        }
    
    def is_session_valid(self) -> bool:
        """Check if the current session token is still valid"""
        
        if not self.session_token:
            return False
        
        if not self.last_auth_time:
            return False
        
        # Check if session is expired
        if datetime.now() - self.last_auth_time > self.session_duration:
            return False
        
        return True
    
    def get_positions(self) -> List[Dict]:
        """Get all current positions from account"""
        
        if not self.is_live:
            return self._get_qc_positions()
        
        if not self.ensure_authenticated():
            return self._get_qc_positions()
        
        try:
            account_num = TastytradeCredentials.ACCOUNT_NUMBER_CASH
            
            response = requests.get(
                f"{self.endpoints['accounts']}/{account_num}/positions",
                headers=self.get_headers(),
                timeout=15
            )
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                items = data.get('items', [])
                
                positions = []
                for item in items:
                    position = {
                        'symbol': item.get('symbol', ''),
                        'instrument_type': item.get('instrument-type', ''),
                        'quantity': float(item.get('quantity', 0)),
                        'average_price': float(item.get('average-price', 0) or 0),
                        'mark_value': float(item.get('mark-value', 0) or 0),
                        'multiplier': float(item.get('multiplier', 1) or 1),
                        'close_price': float(item.get('close-price', 0) or 0),
                        'realized_day_gain': float(item.get('realized-day-gain', 0) or 0),
                        'unrealized_day_gain': float(item.get('unrealized-day-gain', 0) or 0),
                        'source': 'tastytrade'
                    }
                    positions.append(position)
                
                return positions
            
            return self._get_qc_positions()
            
        except Exception as e:
            self.algorithm.Error(f"Positions error: {str(e)}")
            return self._get_qc_positions()
    
    def _get_qc_positions(self) -> List[Dict]:
        """Get positions from QuantConnect Portfolio"""
        
        positions = []
        
        for symbol, holding in self.algorithm.Portfolio.items():
            if holding.Quantity != 0:
                position = {
                    'symbol': str(symbol),
                    'instrument_type': 'Equity',
                    'quantity': float(holding.Quantity),
                    'average_price': float(holding.AveragePrice),
                    'mark_value': float(holding.HoldingsValue),
                    'multiplier': 1.0,
                    'close_price': float(holding.Price),
                    'realized_day_gain': float(holding.Profit),
                    'unrealized_day_gain': float(holding.UnrealizedProfit),
                    'source': 'quantconnect'
                }
                positions.append(position)
        
        return positions
    
    def get_order_status(self, order_id: str) -> Optional[Dict]:
        """Get status of a specific order"""
        
        if not self.is_live:
            return None  # QC orders are managed differently
        
        if not self.ensure_authenticated():
            return None
        
        try:
            account_num = TastytradeCredentials.ACCOUNT_NUMBER_CASH
            
            response = requests.get(
                f"{self.endpoints['accounts']}/{account_num}/orders/{order_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json().get('data', {})
                
                return {
                    'order_id': data.get('id', ''),
                    'status': data.get('status', ''),
                    'filled_quantity': int(data.get('filled-quantity', 0) or 0),
                    'remaining_quantity': int(data.get('remaining-quantity', 0) or 0),
                    'avg_fill_price': float(data.get('average-fill-price', 0) or 0),
                    'order_type': data.get('order-type', ''),
                    'time_in_force': data.get('time-in-force', ''),
                    'legs': data.get('legs', []),
                    'source': 'tastytrade'
                }
            
            return None
            
        except Exception as e:
            self.algorithm.Error(f"Order status error: {str(e)}")
            return None
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an existing order"""
        
        if not self.is_live:
            return False  # QC orders handled differently
        
        if not self.ensure_authenticated():
            return False
        
        try:
            account_num = TastytradeCredentials.ACCOUNT_NUMBER_CASH
            
            response = requests.delete(
                f"{self.endpoints['accounts']}/{account_num}/orders/{order_id}",
                headers=self.get_headers(),
                timeout=10
            )
            
            if response.status_code == 204:
                self.algorithm.Log(f"Order {order_id} cancelled successfully")
                return True
            
            self.algorithm.Error(f"Failed to cancel order {order_id}: {response.text}")
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Cancel order error: {str(e)}")
            return False

# Usage in main algorithm:
"""
class TomKingTradingAlgorithm(QCAlgorithm):
    def Initialize(self):
        # Initialize Tastytrade integration
        self.tastytrade = TastytradeApiClient(self)
        
        # Log account info
        account = self.tastytrade.get_account_info()
        if account:
            self.Log(f"Account: {account['account_number']}")
            self.Log(f"Balance: ${account['net_liquidation']}")
            self.Log(f"Source: {account['source']}")
    
    def OnData(self, data):
        # Friday 0DTE check
        if self.Time.weekday() == 4:  # Friday
            # Get 10-delta strikes for SPY
            ic_setup = self.tastytrade.find_10_delta_strikes("SPY", dte=0)
            
            if ic_setup:
                self.Log(f"0DTE Iron Condor Setup:")
                self.Log(f"  Puts: {ic_setup['put_short']}/{ic_setup['put_long']}")
                self.Log(f"  Calls: {ic_setup['call_short']}/{ic_setup['call_long']}")
                self.Log(f"  Credit: ${ic_setup['put_credit']:.2f} + ${ic_setup['call_credit']:.2f}")
                self.Log(f"  Source: {ic_setup['source']}")
"""