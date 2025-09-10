# region imports
from AlgorithmImports import *
# endregion

class BrokerConfiguration:
    """
    Configuration for broker selection and data source management
    Allows seamless switching between Tastytrade (live) and QuantConnect (backtest)
    """
    
    @staticmethod
    def get_broker_settings(algorithm) -> Dict:
        """
        Determine which broker and data source to use
        """
        
        # Check if we're in live mode
        is_live = algorithm.LiveMode
        
        # Check user preference
        preferred_broker = algorithm.GetParameter("preferred-broker") or "quantconnect"
        
        settings = {
            'broker': 'quantconnect',
            'data_source': 'quantconnect',
            'use_tastytrade_data': False,
            'use_tastytrade_execution': False,
            'hybrid_mode': False
        }
        
        if is_live and preferred_broker == "tastytrade":
            settings.update({
                'broker': 'tastytrade',
                'data_source': 'tastytrade',
                'use_tastytrade_data': True,
                'use_tastytrade_execution': True,
                'hybrid_mode': False
            })
        elif is_live and preferred_broker == "hybrid":
            # Use Tastytrade for option data but QC for execution
            settings.update({
                'broker': 'quantconnect',
                'data_source': 'tastytrade',
                'use_tastytrade_data': True,
                'use_tastytrade_execution': False,
                'hybrid_mode': True
            })
        
        return settings
    
    @staticmethod
    def get_tastytrade_config(algorithm) -> Dict:
        """
        Get Tastytrade-specific configuration
        """
        
        return {
            'account_number': algorithm.GetParameter("tastytrade-account-number"),
            'refresh_token': algorithm.GetParameter("tastytrade-refresh-token"),
            'client_id': algorithm.GetParameter("tastytrade-client-id"),
            'environment': algorithm.GetParameter("tastytrade-environment") or "production",
            
            # API endpoints
            'api_base': "https://api.tastytrade.com",
            'websocket_url': "wss://streamer.tastytrade.com",
            
            # Rate limits
            'max_requests_per_minute': 120,
            'max_websocket_subscriptions': 100,
            
            # Data preferences
            'use_for_greeks': True,
            'use_for_iv_rank': True,
            'use_for_option_chains': True,
            'use_for_underlying_prices': False,  # Use QC for this
            
            # Order preferences
            'default_order_type': 'limit',
            'default_time_in_force': 'day',
            'use_smart_routing': True
        }
    
    @staticmethod
    def get_data_source_priority(algorithm, data_type: str) -> List[str]:
        """
        Get prioritized list of data sources for different data types
        
        Args:
            data_type: 'option_chain', 'greeks', 'quotes', 'fundamentals'
        
        Returns:
            List of data sources in priority order
        """
        
        broker_settings = BrokerConfiguration.get_broker_settings(algorithm)
        
        priorities = {
            'option_chain': [],
            'greeks': [],
            'quotes': [],
            'fundamentals': []
        }
        
        if broker_settings['use_tastytrade_data']:
            # Tastytrade is best for options data
            priorities['option_chain'] = ['tastytrade', 'quantconnect', 'cache']
            priorities['greeks'] = ['tastytrade', 'calculated', 'cache']
            priorities['quotes'] = ['quantconnect', 'tastytrade', 'cache']
            priorities['fundamentals'] = ['quantconnect', 'cache']
        else:
            # QuantConnect only mode
            priorities['option_chain'] = ['quantconnect', 'cache']
            priorities['greeks'] = ['quantconnect', 'calculated', 'cache']
            priorities['quotes'] = ['quantconnect', 'cache']
            priorities['fundamentals'] = ['quantconnect', 'cache']
        
        return priorities.get(data_type, ['quantconnect'])
    
    @staticmethod
    def should_use_tastytrade_for(algorithm, operation: str) -> bool:
        """
        Determine if Tastytrade should be used for a specific operation
        
        Args:
            operation: 'option_chain', 'place_order', 'get_positions', etc.
        
        Returns:
            Boolean indicating whether to use Tastytrade
        """
        
        broker_settings = BrokerConfiguration.get_broker_settings(algorithm)
        
        # In backtest mode, never use Tastytrade
        if not algorithm.LiveMode:
            return False
        
        operations_map = {
            # Data operations
            'option_chain': broker_settings['use_tastytrade_data'],
            'get_greeks': broker_settings['use_tastytrade_data'],
            'get_iv_rank': broker_settings['use_tastytrade_data'],
            
            # Execution operations
            'place_order': broker_settings['use_tastytrade_execution'],
            'cancel_order': broker_settings['use_tastytrade_execution'],
            'modify_order': broker_settings['use_tastytrade_execution'],
            
            # Account operations
            'get_positions': broker_settings['broker'] == 'tastytrade',
            'get_buying_power': broker_settings['broker'] == 'tastytrade',
            'get_account_value': broker_settings['broker'] == 'tastytrade'
        }
        
        return operations_map.get(operation, False)
    
    @staticmethod
    def get_symbol_mapping(symbol: str, from_broker: str, to_broker: str) -> str:
        """
        Map symbols between different brokers
        
        Tastytrade and QuantConnect may use different symbol formats
        """
        
        # Symbol mappings
        mappings = {
            # Futures mappings
            ('ES', 'quantconnect', 'tastytrade'): '/ES',
            ('ES', 'tastytrade', 'quantconnect'): 'ES',
            ('/ES', 'tastytrade', 'quantconnect'): 'ES',
            
            ('MES', 'quantconnect', 'tastytrade'): '/MES',
            ('MES', 'tastytrade', 'quantconnect'): 'MES',
            ('/MES', 'tastytrade', 'quantconnect'): 'MES',
            
            ('CL', 'quantconnect', 'tastytrade'): '/CL',
            ('MCL', 'quantconnect', 'tastytrade'): '/MCL',
            
            ('GC', 'quantconnect', 'tastytrade'): '/GC',
            ('MGC', 'quantconnect', 'tastytrade'): '/MGC',
            
            # Options on futures
            ('ES_OPTIONS', 'quantconnect', 'tastytrade'): '/ES',
            
            # ETFs are usually the same
            ('SPY', 'quantconnect', 'tastytrade'): 'SPY',
            ('QQQ', 'quantconnect', 'tastytrade'): 'QQQ',
            ('IWM', 'quantconnect', 'tastytrade'): 'IWM',
        }
        
        # Check for exact mapping
        key = (symbol, from_broker, to_broker)
        if key in mappings:
            return mappings[key]
        
        # Default: return unchanged
        return symbol
    
    @staticmethod
    def validate_broker_connection(algorithm) -> Dict:
        """
        Validate that broker connection is properly configured
        """
        
        broker_settings = BrokerConfiguration.get_broker_settings(algorithm)
        validation = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        if broker_settings['broker'] == 'tastytrade':
            config = BrokerConfiguration.get_tastytrade_config(algorithm)
            
            # Check required parameters
            if not config['account_number']:
                validation['errors'].append("Missing Tastytrade account number")
                validation['is_valid'] = False
            
            if not config['refresh_token']:
                validation['errors'].append("Missing Tastytrade refresh token")
                validation['is_valid'] = False
            
            # Warnings for optional settings
            if not config['client_id']:
                validation['warnings'].append("Tastytrade client ID not set")
        
        return validation

# Usage example in main algorithm:
"""
def Initialize(self):
    # Get broker configuration
    self.broker_config = BrokerConfiguration.get_broker_settings(self)
    
    # Validate connection
    validation = BrokerConfiguration.validate_broker_connection(self)
    if not validation['is_valid']:
        for error in validation['errors']:
            self.Error(error)
        raise Exception("Broker configuration invalid")
    
    # Log configuration
    self.Log(f"Broker: {self.broker_config['broker']}")
    self.Log(f"Data Source: {self.broker_config['data_source']}")
    self.Log(f"Hybrid Mode: {self.broker_config['hybrid_mode']}")
    
def OnData(self, data):
    # Check which data source to use
    if BrokerConfiguration.should_use_tastytrade_for(self, 'option_chain'):
        # Use Tastytrade data provider
        chain = self.data_provider.get_option_chain("SPY", 30)
    else:
        # Use QuantConnect
        chain = self.get_qc_option_chain("SPY", 30)
"""