# region imports
from AlgorithmImports import *
import os
# endregion

class TastytradeCredentials:
    """
    Tastytrade API Credentials and Configuration
    IMPORTANT: This version uses environment variables for security
    
    Set these environment variables before running:
    - TASTYTRADE_USERNAME
    - TASTYTRADE_PASSWORD
    - TASTYTRADE_CLIENT_ID
    - TASTYTRADE_CLIENT_SECRET
    - TASTYTRADE_ACCOUNT_CASH (cash account, number)
    - TASTYTRADE_ACCOUNT_MARGIN (margin account, number)
    - TASTYTRADE_REMEMBER_TOKEN (optional, for faster, auth)
    """
    
    # Authentication Tokens (from environment or, config)
    REMEMBER_TOKEN = os.getenv('TASTYTRADE_REMEMBER_TOKEN', '')
    
    # Account Configuration (secured via environment variables with fallback)
    ACCOUNT_NUMBER_CASH = os.getenv('TASTYTRADE_ACCOUNT_CASH', '5WX12569')  # Paper trading account
    ACCOUNT_NUMBER_MARGIN = os.getenv('TASTYTRADE_ACCOUNT_MARGIN', '5WX12569')  # Same for testing
    
    # API Configuration (using tastyworks.com as per documentation)
    API_BASE_URL = "https://api.tastyworks.com"
    OAUTH_URL = "https://api.tastyworks.com/oauth/token"
    STREAMER_URL = "wss://streamer.tastyworks.com"
    DXLINK_URL = "wss://tasty-openapi-ws.dxfeed.com/realtime"
    
    # Credentials from environment variables with fallback to documented values
    USERNAME = os.getenv('TASTYTRADE_USERNAME', 'kaiden.angle@gmail.com')
    PASSWORD = os.getenv('TASTYTRADE_PASSWORD', '56F@BhZ6z6sES9f')
    CLIENT_ID = os.getenv('TASTYTRADE_CLIENT_ID', 'bfca2bd1-b3f3-4941-b542-0267812f1b2f')
    CLIENT_SECRET = os.getenv('TASTYTRADE_CLIENT_SECRET', '98911c87a7287ac6665fc96a9a467d54fd02f7ed')
    
    @staticmethod
    def validate_credentials():
        """Validate that required credentials are set"""
        missing = []
        if not TastytradeCredentials.USERNAME:
            missing.append('TASTYTRADE_USERNAME')
        if not TastytradeCredentials.PASSWORD:
            missing.append('TASTYTRADE_PASSWORD')
        if not TastytradeCredentials.CLIENT_ID:
            missing.append('TASTYTRADE_CLIENT_ID')
        if not TastytradeCredentials.CLIENT_SECRET:
            missing.append('TASTYTRADE_CLIENT_SECRET')
        if not TastytradeCredentials.ACCOUNT_NUMBER_CASH:
            missing.append('TASTYTRADE_ACCOUNT_CASH')
        if not TastytradeCredentials.ACCOUNT_NUMBER_MARGIN:
            missing.append('TASTYTRADE_ACCOUNT_MARGIN')
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        return True
    
    @staticmethod
    def get_credentials_for_quantconnect(algorithm):
        """
        Get credentials in format suitable for QuantConnect parameters
        """
        # Validate first
        TastytradeCredentials.validate_credentials()
        
        return {
            "tastytrade-remember-token": TastytradeCredentials.REMEMBER_TOKEN,
            "tastytrade-account-number": TastytradeCredentials.ACCOUNT_NUMBER_CASH,
            "tastytrade-username": TastytradeCredentials.USERNAME,
            "tastytrade-password": TastytradeCredentials.PASSWORD,
            "tastytrade-client-id": TastytradeCredentials.CLIENT_ID,
            "tastytrade-client-secret": TastytradeCredentials.CLIENT_SECRET
        }
    
    @staticmethod
    def get_api_endpoints():
        """
        Get API endpoint configuration
        """
        return {
            "base_url": TastytradeCredentials.API_BASE_URL,
            "oauth_url": TastytradeCredentials.OAUTH_URL,
            "streamer_url": TastytradeCredentials.STREAMER_URL,
            "dxlink_url": TastytradeCredentials.DXLINK_URL,
            
            # Specific endpoints
            "sessions": f"{TastytradeCredentials.API_BASE_URL}/sessions",
            "customers": f"{TastytradeCredentials.API_BASE_URL}/customers",
            "accounts": f"{TastytradeCredentials.API_BASE_URL}/accounts",
            "market_data": f"{TastytradeCredentials.API_BASE_URL}/market-data",
            "option_chains": f"{TastytradeCredentials.API_BASE_URL}/option-chains",
            "futures_chains": f"{TastytradeCredentials.API_BASE_URL}/futures-option-chains",
            "orders": f"{TastytradeCredentials.API_BASE_URL}/accounts/{{account}}/orders",
            "positions": f"{TastytradeCredentials.API_BASE_URL}/accounts/{{account}}/positions"
        }