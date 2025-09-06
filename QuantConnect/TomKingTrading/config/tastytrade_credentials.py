# region imports
from AlgorithmImports import *
# endregion

class TastytradeCredentials:
    """
    Tastytrade API Credentials and Configuration
    IMPORTANT: Keep this file secure and add to .gitignore
    
    Remember Token obtained: 2025-09-05
    This token allows authentication without username/password
    """
    
    # Authentication Tokens (from successful test)
    REMEMBER_TOKEN = "3P8FxwF-1MwmpspQjOHjOJ9JKM33Urh_3vVbPGO97Kfk5-p4C2D0VgTX8Ww1FQOEzKy56xg5qGnI98dJxFtBBQ"
    
    # Account Configuration
    ACCOUNT_NUMBER_CASH = "5WX12569"  # Cash account
    ACCOUNT_NUMBER_MARGIN = "5WW81442"  # Margin account
    
    # API Configuration
    API_BASE_URL = "https://api.tastyworks.com"
    OAUTH_URL = "https://api.tastyworks.com/oauth/token"
    STREAMER_URL = "wss://streamer.tastyworks.com"
    DXLINK_URL = "wss://tasty-openapi-ws.dxfeed.com/realtime"
    
    # Credentials (for fallback authentication)
    USERNAME = "kaiden.angle@gmail.com"
    PASSWORD = "56F@BhZ6z6sES9f"
    CLIENT_ID = "bfca2bd1-b3f3-4941-b542-0267812f1b2f"
    CLIENT_SECRET = "98911c87a7287ac6665fc96a9a467d54fd02f7ed"
    
    # Old refresh token (revoked, but keeping for reference)
    OLD_REFRESH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw"
    
    @staticmethod
    def get_credentials_for_quantconnect(algorithm):
        """
        Get credentials in format suitable for QuantConnect parameters
        """
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
            "market_data": f"{TastytradeCredentials.API_BASE_URL}/market-data/by-type",
            "option_chains": f"{TastytradeCredentials.API_BASE_URL}/option-chains",
            "futures_chains": f"{TastytradeCredentials.API_BASE_URL}/futures-option-chains",
            "orders": f"{TastytradeCredentials.API_BASE_URL}/orders",
            "positions": f"{TastytradeCredentials.API_BASE_URL}/positions"
        }