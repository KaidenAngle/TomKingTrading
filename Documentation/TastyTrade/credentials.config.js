/**
 * TASTYTRADE API CREDENTIALS CONFIGURATION
 * 
 * IMPORTANT: This file contains sensitive API credentials.
 * 
 * TO USE THIS FRAMEWORK:
 * 1. Replace the values below with your own TastyTrade API credentials
 * 2. Keep this file secure and NEVER commit it to public repositories
 * 3. Add 'credentials.config.js' to your .gitignore file
 * 
 * TO GET YOUR CREDENTIALS:
 * 1. Log in to TastyTrade
 * 2. Go to Account Settings > API
 * 3. Create a new API application
 * 4. Copy your Client ID and Client Secret
 * 5. Use your TastyTrade login username and password
 */

// Trading Mode Selection
// CRITICAL: Controls which environment the system connects to
const TRADING_MODE = process.env.TRADING_MODE || 'paper'; // 'sandbox' | 'paper' | 'real'

// Mode-specific configurations
const modeConfigs = {
    // SANDBOX MODE: For testing features with TastyTrade cert environment
    sandbox: {
        apiBaseUrl: 'https://api.cert.tastyworks.com',
        oauthUrl: 'https://api.cert.tastyworks.com/oauth/token',
        streamerUrl: 'wss://streamer.cert.tastyworks.com',
        // Sandbox credentials from developer.tastyworks.com
        clientId: process.env.SANDBOX_CLIENT_ID || 'd99becce-b939-450c-9133-c8ecb2e096b1',
        clientSecret: process.env.SANDBOX_CLIENT_SECRET || '98911c87a7287ac6665fc96a9a467d54fd02f7ed', // Same secret for all environments
        username: process.env.SANDBOX_USERNAME || 'kaiden.angle@gmail.com',
        password: process.env.SANDBOX_PASSWORD || '56F@BhZ6z6sES9f', // Using same password as production
        accountNumber: process.env.SANDBOX_ACCOUNT || 'SANDBOX_ACCOUNT',
        allowLiveTrading: false,
        requiresRealData: true, // Still requires REAL data from sandbox API
        description: 'Sandbox mode using TastyTrade cert environment for testing'
    },
    
    // PAPER TRADING MODE: For testing strategies with different balances
    paper: {
        apiBaseUrl: 'https://api.tastyworks.com',
        oauthUrl: 'https://api.tastyworks.com/oauth/token',
        streamerUrl: 'wss://streamer.tastyworks.com',
        // Production credentials for real data access
        clientId: 'bfca2bd1-b3f3-4941-b542-0267812f1b2f',
        clientSecret: '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
        refreshToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw',
        username: 'kaiden.angle@gmail.com',
        password: '56F@BhZ6z6sES9f',
        accountNumber: '5WX12569', // Paper trading account
        allowLiveTrading: false, // Paper trading never executes real trades
        simulatedBalance: 35000, // Starting balance for paper trading
        requiresRealData: true, // Must use REAL market data
        description: 'Paper trading with real market data but simulated execution'
    },
    
    // REAL MODE: For actual trading (DO NOT USE FOR TESTING)
    real: {
        apiBaseUrl: 'https://api.tastyworks.com',
        oauthUrl: 'https://api.tastyworks.com/oauth/token',
        streamerUrl: 'wss://streamer.tastyworks.com',
        // Production credentials
        clientId: 'bfca2bd1-b3f3-4941-b542-0267812f1b2f',
        clientSecret: '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
        refreshToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw',
        username: 'kaiden.angle@gmail.com',
        password: '56F@BhZ6z6sES9f',
        accountNumber: '5WX12569', // Real account (currently $16.09)
        allowLiveTrading: false, // Set to true ONLY when ready for real trading
        requiresRealData: true,
        maxOrderValue: 1000, // Safety limit for real trading
        requireConfirmation: true,
        description: 'REAL MONEY TRADING - USE WITH EXTREME CAUTION'
    }
};

// Get active configuration based on mode
const activeConfig = modeConfigs[TRADING_MODE];

if (!activeConfig) {
    throw new Error(`Invalid TRADING_MODE: ${TRADING_MODE}. Must be 'sandbox', 'paper', or 'real'`);
}

// Export the configuration for the selected mode
module.exports = {
    // Current mode indicator
    mode: TRADING_MODE,
    
    // Mode description
    modeDescription: activeConfig.description,
    
    // API Credentials from active mode
    clientId: activeConfig.clientId,
    clientSecret: activeConfig.clientSecret,
    refreshToken: activeConfig.refreshToken || null,
    username: activeConfig.username,
    password: activeConfig.password,
    
    // Account settings
    accountNumber: activeConfig.accountNumber,
    simulatedBalance: activeConfig.simulatedBalance || null,
    
    // API Environment Settings  
    environment: TRADING_MODE === 'sandbox' ? 'sandbox' : 'production',
    
    // URLs from active mode
    apiBaseUrl: activeConfig.apiBaseUrl,
    oauthUrl: activeConfig.oauthUrl,
    streamerUrl: activeConfig.streamerUrl,
    
    // Safety Settings
    allowLiveTrading: activeConfig.allowLiveTrading,
    maxOrderValue: activeConfig.maxOrderValue || 10000,
    requireConfirmation: activeConfig.requireConfirmation !== false,
    requiresRealData: activeConfig.requiresRealData,
    
    // Session Settings
    tokenRefreshBuffer: 300,  // Refresh token 5 minutes before expiry
    maxRetries: 3,            // Maximum API retry attempts
    requestTimeout: 30000,    // API request timeout in milliseconds
    
    // Data validation settings
    validateRealData: true,   // Always validate data is real, not simulated
    failOnSimulatedData: true, // Fail immediately if simulated data detected
    
    // Mode switching helper
    switchMode: function(newMode) {
        if (!['sandbox', 'paper', 'real'].includes(newMode)) {
            throw new Error(`Invalid mode: ${newMode}`);
        }
        console.log(`\n🔄 Switching from ${TRADING_MODE} to ${newMode} mode`);
        console.log(`   Please restart the application with: TRADING_MODE=${newMode} node [script]`);
        return `TRADING_MODE=${newMode}`;
    },
    
    // Display current configuration
    displayConfig: function() {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 TOM KING TRADING FRAMEWORK - ${TRADING_MODE.toUpperCase()} MODE`);
        console.log('='.repeat(60));
        console.log(`Mode: ${TRADING_MODE}`);
        console.log(`Description: ${activeConfig.description}`);
        console.log(`API URL: ${activeConfig.apiBaseUrl}`);
        console.log(`Account: ${activeConfig.accountNumber || 'Not configured'}`);
        console.log(`Live Trading: ${activeConfig.allowLiveTrading ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`Real Data Required: ${activeConfig.requiresRealData ? '✅ YES' : '❌ NO'}`);
        if (activeConfig.simulatedBalance) {
            console.log(`Paper Balance: £${activeConfig.simulatedBalance.toLocaleString()}`);
        }
        console.log('='.repeat(60) + '\n');
    }
};

/**
 * EXAMPLE CONFIGURATION (DO NOT USE THESE VALUES):
 * 
 * module.exports = {
 *     clientId: 'lWRikW2EGhfgS1SB2HmUxPpPgeFdpTBm',
 *     clientSecret: '98911c87a74f8914df9c108044bb52e0d93db06c9989719a32be8a892217ac5f',
 *     username: 'john.doe@email.com',
 *     password: 'SecurePassword123!',
 *     environment: 'production',
 *     allowLiveTrading: false
 * };
 */