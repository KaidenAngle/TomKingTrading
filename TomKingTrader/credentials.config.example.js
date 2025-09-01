/**
 * TASTYTRADE API CREDENTIALS CONFIGURATION TEMPLATE
 * 
 * SETUP INSTRUCTIONS:
 * 1. Copy this file and rename it to 'credentials.config.js'
 * 2. Fill in your TastyTrade API credentials
 * 3. Never share or commit the actual credentials.config.js file
 * 
 * TO GET YOUR API CREDENTIALS:
 * 1. Log in to TastyTrade: https://tastyworks.com
 * 2. Go to Account Settings > API Access
 * 3. Create a new API application
 * 4. Copy the Client ID and Client Secret
 * 5. Use your TastyTrade login username and password
 */

module.exports = {
    // Replace with your TastyTrade API OAuth2 Credentials
    clientId: 'YOUR_CLIENT_ID_HERE',
    clientSecret: 'YOUR_CLIENT_SECRET_HERE',
    
    // Replace with your TastyTrade login credentials
    username: 'YOUR_TASTYTRADE_USERNAME',
    password: 'YOUR_TASTYTRADE_PASSWORD',
    
    // Environment Settings (keep as 'production' for live data)
    environment: 'production',
    
    // Safety Settings - IMPORTANT: Keep these as-is for safety
    allowLiveTrading: false,      // NEVER set to true unless you want automated trading
    maxOrderValue: 10000,         // Maximum order value safety limit
    requireConfirmation: true,    // Always require manual confirmation
    
    // Technical Settings (usually don't need to change)
    tokenRefreshBuffer: 300,      // Refresh token 5 minutes before expiry
    maxRetries: 3,                // Maximum API retry attempts
    requestTimeout: 30000         // API request timeout in milliseconds
};