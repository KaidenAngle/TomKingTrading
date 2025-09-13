# region imports
from AlgorithmImports import *
import json
import threading
from threading import Lock
from datetime import datetime
from typing import Dict, List, Optional
from collections import deque
# endregion

class TastytradeWebSocket:
    """
    WebSocket connection for real-time data streaming
    Critical for 0DTE trades and Greeks updates
    
    Note: In QuantConnect backtesting, this is simulated
    In live trading, connects to actual WebSocket feed
    """
    
    def __init__(self, algorithm, symbols: List[str]):
        self.algorithm = algorithm
        self.symbols = symbols
        self.is_connected = False
        self.last_quotes = {}
        self.greeks_cache = {}
        self.quote_history = {}  # Store recent quotes for momentum
        
        # Thread synchronization
        self._quotes_lock = Lock()
        self._greeks_lock = Lock()
        self._connection_lock = Lock()
        
        # Connection settings
        self.ws_url = "wss://tasty-openapi-ws.dxfeed.com/realtime"
        self.reconnect_attempts = 0
        self.max_reconnects = 5
        
        # Initialize quote history
        for symbol in symbols:
            self.quote_history[symbol] = deque(maxlen=100)  # Keep last 100 quotes
            
        # For backtesting, we'll simulate WebSocket data
        self.is_backtest = not algorithm.LiveMode
        
    def connect(self):
        """Establish WebSocket connection for real-time data"""
        
        if self.is_backtest:
            self.algorithm.Log("[WebSocket] Simulated connection in backtest mode")
            self.is_connected = True
            self.simulate_websocket_data()
            return
            
        # Live trading WebSocket connection
        self.algorithm.Log(f"[WebSocket] Connecting to {self.ws_url}")
        
        try:
            self.setup_live_websocket()
        except Exception as e:
            # Log and handle unexpected exception
            self.algorithm.Error(f"[WebSocket] Connection failed: {str(e)}")
            self.handle_connection_failure()
            raise
            
    def simulate_websocket_data(self):
        """Simulate WebSocket data in backtest mode"""
        
        # In backtest, use QuantConnect's data
        for symbol_str in self.symbols:
            if symbol_str in self.algorithm.Securities:
                security = self.algorithm.Securities[symbol_str]
                
                # Simulate quote
                self.last_quotes[symbol_str] = {
                    'bid': float(security.BidPrice) if security.BidPrice else 0,
                    'ask': float(security.AskPrice) if security.AskPrice else 0,
                    'last': float(security.Price),
                    'mid': float((security.BidPrice + security.AskPrice) / 2) if security.BidPrice else float(security.Price),
                    'spread': float(security.AskPrice - security.BidPrice) if security.BidPrice else 0,
                    'volume': security.Volume,
                    'timestamp': self.algorithm.Time
                }
                
                # Add to history
                self.quote_history[symbol_str].append(self.last_quotes[symbol_str])
                
    def setup_live_websocket(self):
        """Setup actual WebSocket for live trading"""
        
        # This would be the actual WebSocket implementation
        # For QuantConnect, we primarily use their data feeds
        # WebSocket would supplement with real-time updates
        
        self.is_connected = True
        self.algorithm.Log("[WebSocket] Live connection established")
        
    def process_quote(self, quote_data: Dict):
        """Process real-time quote updates"""
        
        symbol = quote_data.get("eventSymbol", quote_data.get("symbol"))
        if not symbol:
            return
            
        bid = quote_data.get("bidPrice", 0)
        ask = quote_data.get("askPrice", 0)
        last = quote_data.get("lastPrice", 0)
        bid_size = quote_data.get("bidSize", 0)
        ask_size = quote_data.get("askSize", 0)
        volume = quote_data.get("volume", 0)
        
        # Update cache
        quote = {
            'bid': bid,
            'ask': ask,
            'last': last,
            'mid': (bid + ask) / 2 if bid and ask else last,
            'spread': ask - bid if bid and ask else 0,
            'bid_size': bid_size,
            'ask_size': ask_size,
            'volume': volume,
            'timestamp': self.algorithm.Time
        }
        
        # Update quotes (thread-safe)
        with self._quotes_lock:
            self.last_quotes[symbol] = quote
            self.quote_history[symbol].append(quote)
        
        # Check for trading opportunities
        self.check_real_time_opportunities(symbol, quote)
        
    def process_greeks(self, greeks_data: Dict):
        """Process real-time Greeks updates for options"""
        
        symbol = greeks_data.get("eventSymbol")
        if not symbol:
            return
            
        # Update Greeks (thread-safe)
        with self._greeks_lock:
            self.greeks_cache[symbol] = {
                'delta': greeks_data.get("delta", 0),
                'gamma': greeks_data.get("gamma", 0),
                'theta': greeks_data.get("theta", 0),
                'vega': greeks_data.get("vega", 0),
                'rho': greeks_data.get("rho", 0),
                'iv': greeks_data.get("volatility", 0),
                'timestamp': self.algorithm.Time
            }
        
        # Check portfolio Greeks limits
        self.check_greeks_limits()
        
    def check_real_time_opportunities(self, symbol: str, quote: Dict):
        """Check for real-time trading opportunities"""
        
        # 0DTE Friday detection
        if self.algorithm.Time.DayOfWeek == DayOfWeek.Friday:
            self.check_0dte_entry(symbol, quote['last'])
            
        # Momentum spike detection
        self.check_momentum_spike(symbol, quote)
        
        # Spread widening detection (liquidity issues)
        self.check_spread_alert(symbol, quote)
        
    def check_0dte_entry(self, symbol: str, price: float):
        """Real-time 0DTE opportunity detection"""
        
        # Only during 0DTE hours
        hour = self.algorithm.Time.Hour
        minute = self.algorithm.Time.Minute
        
        if hour < 10 or (hour == 10 and minute < 30):
            return
        if hour >= 15 and minute >= 30:
            return
            
        # Only for ES/MES/SPY
        if symbol not in ["SPY", "/ES", "/MES", "ES", "MES"]:
            return
            
        # Get opening price
        if symbol not in self.algorithm.Securities:
            return
            
        security = self.algorithm.Securities[symbol]
        open_price = security.Open
        
        if open_price <= 0:
            return
            
        # Calculate move from open
        move_pct = ((price - open_price) / open_price) * 100
        
        # Tom King's 0.5% rule for 0DTE entry
        if abs(move_pct) > 0.5:
            self.algorithm.Log(f"""
            ====================================
            [0DTE SIGNAL] Real-time Detection
            ====================================
            Symbol: {symbol}
            Move from open: {move_pct:.2f}%
            Current price: ${price:.2f}
            Open price: ${open_price:.2f}
            Time: {self.algorithm.Time}
            
            ACTION: Check 0DTE entry conditions
            ====================================
            """)
            
            # Trigger 0DTE analysis
            if hasattr(self.algorithm, 'strategies'):
                self.algorithm.strategies.trigger_0dte_analysis(symbol, move_pct)
                
    def check_momentum_spike(self, symbol: str, quote: Dict):
        """Detect sudden momentum spikes"""
        
        if len(self.quote_history[symbol]) < 10:
            return
            
        # Get last 10 quotes
        recent_quotes = list(self.quote_history[symbol])[-10:]
        
        # Calculate average price
        avg_price = sum(q['last'] for q in recent_quotes) / len(recent_quotes)
        
        # Check for spike
        current_price = quote['last']
        spike_pct = ((current_price - avg_price) / avg_price) * 100 if avg_price > 0 else 0
        
        # Alert on 0.3% spike in last 10 ticks
        if abs(spike_pct) > 0.3:
            self.algorithm.Debug(f"[MOMENTUM] {symbol} spike: {spike_pct:.2f}% from 10-tick average")
            
            # Could trigger momentum protection here
            if hasattr(self.algorithm, 'risk_manager'):
                self.algorithm.risk_manager.on_momentum_spike(symbol, spike_pct)
                
    def check_spread_alert(self, symbol: str, quote: Dict):
        """Alert on unusual spread widening"""
        
        spread = quote['spread']
        mid = quote['mid']
        
        if mid <= 0:
            return
            
        # Calculate spread as percentage of mid
        spread_pct = (spread / mid) * 100
        
        # Alert thresholds
        if symbol in ["SPY", "QQQ", "IWM"]:
            threshold = 0.05  # 5 basis points for liquid ETFs
        elif symbol.startswith("/"):
            threshold = 0.02  # 2 basis points for futures
        else:
            threshold = 0.10  # 10 basis points for others
            
        if spread_pct > threshold:
            self.algorithm.Debug(f"[SPREAD ALERT] {symbol} spread: {spread_pct:.3f}% (threshold: {threshold*TradingConstants.FULL_PERCENTAGE:.1f}%)")
            
    def check_greeks_limits(self):
        """Monitor portfolio Greeks in real-time"""
        
        if not self.greeks_cache:
            return
            
        total_delta = sum(g.get('delta', 0) for g in self.greeks_cache.values())
        total_gamma = sum(g.get('gamma', 0) for g in self.greeks_cache.values())
        total_theta = sum(g.get('theta', 0) for g in self.greeks_cache.values())
        total_vega = sum(g.get('vega', 0) for g in self.greeks_cache.values())
        
        # Alert on Greeks limits
        alerts = []
        
        if abs(total_delta) > 50:
            alerts.append(f"Delta: {total_delta:.2f}")
            
        if abs(total_gamma) > 10:
            alerts.append(f"Gamma: {total_gamma:.2f}")
            
        if total_theta < -100:
            alerts.append(f"Theta: ${total_theta:.2f}/day")
            
        if abs(total_vega) > 500:
            alerts.append(f"Vega: ${total_vega:.2f}")
            
        if alerts:
            self.algorithm.Log(f"[GREEKS WARNING] Limits exceeded: {', '.join(alerts)}")
            
    def get_real_time_quote(self, symbol: str) -> Optional[Dict]:
        """Get latest real-time quote"""
        
        # If in backtest, update from QC data
        if self.is_backtest:
            self.simulate_websocket_data()
            
        return self.last_quotes.get(symbol)
        
    def get_real_time_greeks(self, symbol: str) -> Optional[Dict]:
        """Get latest Greeks for option"""
        
        return self.greeks_cache.get(symbol)
        
    def get_quote_momentum(self, symbol: str, lookback: int = 20) -> Optional[float]:
        """Calculate recent price momentum"""
        
        if symbol not in self.quote_history:
            return None
            
        history = list(self.quote_history[symbol])
        
        if len(history) < lookback:
            return None
            
        recent = history[-lookback:]
        
        # Calculate momentum as price change
        first_price = recent[0]['last']
        last_price = recent[-1]['last']
        
        if first_price <= 0:
            return None
            
        momentum = ((last_price - first_price) / first_price) * 100
        return momentum
        
    def get_volume_profile(self, symbol: str) -> Dict:
        """Get volume profile from recent quotes"""
        
        if symbol not in self.quote_history:
            return {}
            
        history = list(self.quote_history[symbol])[-50:]  # Last 50 quotes
        
        if not history:
            return {}
            
        total_volume = sum(q.get('volume', 0) for q in history)
        avg_volume = total_volume / len(history) if history else 0
        
        # Current vs average
        current_volume = history[-1].get('volume', 0) if history else 0
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        return {
            'current': current_volume,
            'average': avg_volume,
            'ratio': volume_ratio,
            'total_recent': total_volume
        }
        
    def handle_connection_failure(self):
        """Handle WebSocket connection failures"""
        
        self.reconnect_attempts += 1
        
        if self.reconnect_attempts <= self.max_reconnects:
            self.algorithm.Log(f"[WebSocket] Reconnection attempt {self.reconnect_attempts}/{self.max_reconnects}")
            
            # Wait before reconnecting (exponential backoff)
            wait_seconds = min(60, 2 ** self.reconnect_attempts)
            threading.Timer(wait_seconds, self.connect).start()
        else:
            self.algorithm.Error("[WebSocket] Max reconnection attempts reached")
            
            # Switch to manual mode if available
            if hasattr(self.algorithm, 'manual_mode'):
                self.algorithm.manual_mode.activate_manual_mode("WebSocket connection lost")
                
    def disconnect(self):
        """Disconnect WebSocket"""
        
        self.is_connected = False
        self.algorithm.Log("[WebSocket] Disconnected")
        
    def is_healthy(self) -> bool:
        """Check if WebSocket connection is healthy"""
        
        if not self.is_connected:
            return False
            
        # Check if we're receiving quotes
        if self.last_quotes:
            # Check if quotes are recent (within last minute)
            for symbol, quote in self.last_quotes.items():
                if 'timestamp' in quote:
                    age = (self.algorithm.Time - quote['timestamp']).total_seconds()
                    if age > 60:
                        self.algorithm.Debug(f"[WebSocket] Stale quote for {symbol}: {age:.0f}s old")
                        return False
                        
        return True
        
    def get_statistics(self) -> Dict:
        """Get WebSocket statistics"""
        
        stats = {
            'connected': self.is_connected,
            'symbols': len(self.symbols),
            'quotes_cached': len(self.last_quotes),
            'greeks_cached': len(self.greeks_cache),
            'reconnect_attempts': self.reconnect_attempts
        }
        
        # Add quote freshness
        if self.last_quotes:
            ages = []
            for symbol, quote in self.last_quotes.items():
                if 'timestamp' in quote:
                    age = (self.algorithm.Time - quote['timestamp']).total_seconds()
                    ages.append(age)
                    
            if ages:
                stats['avg_quote_age_seconds'] = sum(ages) / len(ages)
                stats['max_quote_age_seconds'] = max(ages)
                
        return stats