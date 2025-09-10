# region imports
from AlgorithmImports import *
import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import threading
import queue
# endregion

class PaperTradingAdapter:
    """
    Hybrid Integration: QuantConnect for logic + Tastytrade Sandbox for paper trading
    
    This allows you to:
    1. Run QuantConnect algorithms normally
    2. Mirror trades to Tastytrade sandbox for realistic execution
    3. Get real broker feedback without risking money
    4. Test the full trade lifecycle (entry, management, exit)
    """
    
    def __init__(self, algorithm, enable_mirroring=True):
        self.algorithm = algorithm
        self.enable_mirroring = enable_mirroring
        
        # Sandbox configuration
        self.sandbox_config = {
            'api_base': 'https://api.cert.tastyworks.com',
            'oauth_url': 'https://api.cert.tastyworks.com/oauth/token',
            'username': 'kaiden.angle@gmail.com',
            'password': '56F@BhZ6z6sES9f',
            'client_id': 'd99becce-b939-450c-9133-c8ecb2e096b1',
            'client_secret': '98911c87a7287ac6665fc96a9a467d54fd02f7ed'
        }
        
        # Session management
        self.session_token = None
        self.sandbox_account = None
        self.is_authenticated = False
        
        # Order tracking
        self.qc_to_sandbox_orders = {}  # Map QC orders to sandbox orders
        self.order_queue = queue.Queue()
        
        # Position tracking
        self.sandbox_positions = {}
        self.qc_positions = {}
        
        # Initialize if enabled
        if self.enable_mirroring:
            self.initialize_sandbox()
    
    def initialize_sandbox(self):
        """Initialize connection to Tastytrade sandbox"""
        
        self.algorithm.Log("=" * 60)
        self.algorithm.Log("INITIALIZING HYBRID SANDBOX MODE")
        self.algorithm.Log("QuantConnect: Algorithm execution")
        self.algorithm.Log("Tastytrade Sandbox: Paper trading mirror")
        self.algorithm.Log("=" * 60)
        
        # Authenticate with sandbox
        if self.authenticate_sandbox():
            self.algorithm.Log("[OK] Sandbox authentication successful")
            
            # Get sandbox account
            if self.get_sandbox_account():
                self.algorithm.Log(f"[OK] Sandbox account: {self.sandbox_account}")
                self.is_authenticated = True
                
                # Start order processing thread
                self.start_order_processor()
            else:
                self.algorithm.Error("Failed to get sandbox account")
        else:
            self.algorithm.Error("Failed to authenticate with sandbox")
    
    def authenticate_sandbox(self) -> bool:
        """Authenticate with Tastytrade sandbox"""
        
        try:
            data = {
                'login': self.sandbox_config['username'],
                'password': self.sandbox_config['password'],
                'remember-me': True
            }
            
            response = requests.post(
                f"{self.sandbox_config['api_base']}/sessions",
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
                return True
            else:
                self.algorithm.Error(f"Sandbox auth failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.algorithm.Error(f"Sandbox auth error: {str(e)}")
            return False
    
    def get_sandbox_account(self) -> bool:
        """Get sandbox account number"""
        
        try:
            headers = {
                'Authorization': self.session_token,
                'User-Agent': 'TomKingFramework/17.0'
            }
            
            response = requests.get(
                f"{self.sandbox_config['api_base']}/customers/me/accounts",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                accounts = data.get('data', {}).get('items', [])
                
                if accounts:
                    # Use first account
                    self.sandbox_account = accounts[0].get('account', {}).get('account-number')
                    return True
                else:
                    # Create sandbox account if none exists
                    return self.create_sandbox_account()
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Get account error: {str(e)}")
            return False
    
    def create_sandbox_account(self) -> bool:
        """Create a new sandbox account if none exists"""
        
        self.algorithm.Log("Creating new sandbox account...")
        
        try:
            headers = {
                'Authorization': self.session_token,
                'User-Agent': 'TomKingFramework/17.0'
            }
            
            data = {
                'account': {
                    'margin-or-cash': 'Margin',
                    'is-test-drive': True
                }
            }
            
            response = requests.post(
                f"{self.sandbox_config['api_base']}/accounts",
                json=data,
                headers=headers,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                self.sandbox_account = result.get('data', {}).get('account-number')
                self.algorithm.Log(f"Created sandbox account: {self.sandbox_account}")
                return True
            
            return False
            
        except Exception as e:
            self.algorithm.Error(f"Create account error: {str(e)}")
            return False
    
    def start_order_processor(self):
        """Start background thread to process orders"""
        
        def process_orders():
            while True:
                try:
                    order = self.order_queue.get(timeout=1)
                    if order:
                        self.execute_sandbox_order(order)
                except Exception as e:
                    self.algo.Debug(f"Order queue processing error: {e}")
        
        thread = threading.Thread(target=process_orders, daemon=True)
        thread.start()
    
    def on_order_event(self, order_event):
        """
        Mirror QuantConnect order events to Tastytrade sandbox
        Called by main algorithm when orders are placed
        """
        
        if not self.enable_mirroring or not self.is_authenticated:
            return
        
        # Log the event
        self.algorithm.Log(f"[HYBRID] Mirroring order: {order_event.Symbol} "
                          f"{order_event.Direction} {order_event.Quantity}")
        
        # Queue order for sandbox execution
        if order_event.Status == OrderStatus.Filled:
            self.order_queue.put({
                'qc_order_id': order_event.OrderId,
                'symbol': str(order_event.Symbol),
                'quantity': order_event.Quantity,
                'direction': order_event.Direction,
                'fill_price': order_event.FillPrice,
                'order_type': order_event.OrderType
            })
    
    def execute_sandbox_order(self, order_data):
        """Execute order in Tastytrade sandbox"""
        
        try:
            # Map symbol
            symbol = self.map_symbol_to_sandbox(order_data['symbol'])
            
            # Determine order side
            side = 'Buy' if order_data['direction'] == OrderDirection.Buy else 'Sell'
            action = 'BTO' if side == 'Buy' else 'STO'  # Buy/Sell to Open
            
            # Build sandbox order
            sandbox_order = {
                'symbol': symbol,
                'quantity': abs(order_data['quantity']),
                'action': action,
                'order-type': 'Market',  # Use market orders for simplicity
                'time-in-force': 'Day'
            }
            
            # Send to sandbox
            headers = {
                'Authorization': self.session_token,
                'User-Agent': 'TomKingFramework/17.0',
                'Content-Type': 'application/json'
            }
            
            response = requests.post(
                f"{self.sandbox_config['api_base']}/accounts/{self.sandbox_account}/orders",
                json=sandbox_order,
                headers=headers,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                sandbox_order_id = result.get('data', {}).get('id')
                
                # Track mapping
                self.qc_to_sandbox_orders[order_data['qc_order_id']] = sandbox_order_id
                
                self.algorithm.Log(f"[SANDBOX] Order placed: {symbol} {action} "
                                 f"{order_data['quantity']} @ Market")
                self.algorithm.Log(f"          Sandbox Order ID: {sandbox_order_id}")
            else:
                self.algorithm.Error(f"[SANDBOX] Order failed: {response.status_code}")
                self.algorithm.Error(f"          Response: {response.text[:200]}")
                
        except Exception as e:
            self.algorithm.Error(f"[SANDBOX] Order error: {str(e)}")
    
    def map_symbol_to_sandbox(self, qc_symbol: str) -> str:
        """Map QuantConnect symbol to Tastytrade format"""
        
        # Remove any QC-specific formatting
        symbol = str(qc_symbol).split(' ')[0].upper()
        
        # Futures mapping
        if symbol in ['ES', 'MES', 'CL', 'MCL', 'GC', 'MGC']:
            return f"/{symbol}"
        
        # Options would need more complex mapping
        # For now, just return equity symbols as-is
        return symbol
    
    def get_sandbox_positions(self) -> Dict:
        """Get current positions from sandbox"""
        
        if not self.is_authenticated:
            return {}
        
        try:
            headers = {
                'Authorization': self.session_token,
                'User-Agent': 'TomKingFramework/17.0'
            }
            
            response = requests.get(
                f"{self.sandbox_config['api_base']}/accounts/{self.sandbox_account}/positions",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                positions = data.get('data', {}).get('items', [])
                
                self.sandbox_positions = {}
                for pos in positions:
                    symbol = pos.get('symbol')
                    quantity = pos.get('quantity')
                    self.sandbox_positions[symbol] = quantity
                
                return self.sandbox_positions
            
        except Exception as e:
            self.algorithm.Error(f"Get positions error: {str(e)}")
        
        return {}
    
    def get_sandbox_balance(self) -> Dict:
        """Get account balance from sandbox"""
        
        if not self.is_authenticated:
            return {}
        
        try:
            headers = {
                'Authorization': self.session_token,
                'User-Agent': 'TomKingFramework/17.0'
            }
            
            response = requests.get(
                f"{self.sandbox_config['api_base']}/accounts/{self.sandbox_account}/balances",
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                balance_data = data.get('data', {})
                
                return {
                    'net_liquidation': float(balance_data.get('net-liquidating-value', 0)),
                    'cash_balance': float(balance_data.get('cash-balance', 0)),
                    'buying_power': float(balance_data.get('derivative-buying-power', 0))
                }
            
        except Exception as e:
            self.algorithm.Error(f"Get balance error: {str(e)}")
        
        return {}
    
    def sync_positions(self):
        """Compare QC and sandbox positions"""
        
        if not self.is_authenticated:
            return
        
        # Get QC positions
        qc_positions = {}
        for holding in self.algorithm.Portfolio:
            if holding.Value.Invested:
                qc_positions[str(holding.Key)] = holding.Value.Quantity
        
        # Get sandbox positions
        sandbox_positions = self.get_sandbox_positions()
        
        # Log comparison
        self.algorithm.Log("\n" + "=" * 60)
        self.algorithm.Log("POSITION SYNC CHECK")
        self.algorithm.Log("-" * 60)
        
        self.algorithm.Log("QuantConnect Positions:")
        for symbol, qty in qc_positions.items():
            self.algorithm.Log(f"  {symbol}: {qty}")
        
        self.algorithm.Log("\nSandbox Positions:")
        for symbol, qty in sandbox_positions.items():
            self.algorithm.Log(f"  {symbol}: {qty}")
        
        # Check for mismatches
        all_symbols = set(qc_positions.keys()) | set(sandbox_positions.keys())
        mismatches = []
        
        for symbol in all_symbols:
            qc_qty = qc_positions.get(symbol, 0)
            sb_qty = sandbox_positions.get(symbol, 0)
            
            if qc_qty != sb_qty:
                mismatches.append(f"{symbol}: QC={qc_qty}, Sandbox={sb_qty}")
        
        if mismatches:
            self.algorithm.Log("\n[WARNING] Position mismatches:")
            for mismatch in mismatches:
                self.algorithm.Log(f"  {mismatch}")
        else:
            self.algorithm.Log("\n[OK] Positions are synchronized")
        
        self.algorithm.Log("=" * 60)
    
    def log_performance_comparison(self):
        """Compare performance between QC and sandbox"""
        
        if not self.is_authenticated:
            return
        
        # Get QC performance
        qc_value = float(self.algorithm.Portfolio.TotalPortfolioValue)
        qc_cash = float(self.algorithm.Portfolio.Cash)
        
        # Get sandbox balance
        sandbox_balance = self.get_sandbox_balance()
        
        # Log comparison
        self.algorithm.Log("\n" + "=" * 60)
        self.algorithm.Log("PERFORMANCE COMPARISON")
        self.algorithm.Log("-" * 60)
        
        self.algorithm.Log("QuantConnect:")
        self.algorithm.Log(f"  Portfolio Value: ${qc_value:,.2f}")
        self.algorithm.Log(f"  Cash: ${qc_cash:,.2f}")
        
        self.algorithm.Log("\nTastytrade Sandbox:")
        self.algorithm.Log(f"  Net Liquidation: ${sandbox_balance.get('net_liquidation', 0):,.2f}")
        self.algorithm.Log(f"  Cash Balance: ${sandbox_balance.get('cash_balance', 0):,.2f}")
        self.algorithm.Log(f"  Buying Power: ${sandbox_balance.get('buying_power', 0):,.2f}")
        
        self.algorithm.Log("=" * 60)

# Usage in main algorithm:
"""
class TomKingTradingAlgorithm(QCAlgorithm):
    def Initialize(self):
        # Enable hybrid sandbox mode
        self.hybrid_sandbox = PaperTradingAdapter(self, enable_mirroring=True)
        
        # Rest of initialization...
        
    def OnOrderEvent(self, orderEvent):
        # Let hybrid system mirror the order
        if hasattr(self, 'hybrid_sandbox'):
            self.hybrid_sandbox.on_order_event(orderEvent)
        
        # Your regular order handling...
        
    def OnEndOfDay(self):
        # Daily position sync check
        if hasattr(self, 'hybrid_sandbox'):
            self.hybrid_sandbox.sync_positions()
            self.hybrid_sandbox.log_performance_comparison()
"""