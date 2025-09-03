/**
 * Test Username/Password Authentication
 */

async function testPasswordAuth() {
    console.log('Testing username/password authentication...\n');
    
    // Load credentials
    process.env.TRADING_MODE = 'paper';
    const config = require('./credentials.config.js');
    
    console.log('Using credentials:');
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${config.password.substring(0, 3)}...`);
    console.log(`  Client ID: ${config.clientId}`);
    console.log(`  Client Secret: ${config.clientSecret.substring(0, 10)}...`);
    console.log(`  API URL: ${config.oauthUrl}\n`);
    
    // Try password grant type
    const params = new URLSearchParams({
        grant_type: 'password',
        username: config.username,
        password: config.password,
        client_id: config.clientId,
        client_secret: config.clientSecret
    });
    
    console.log('Sending password authentication request...');
    
    try {
        const response = await fetch(config.oauthUrl || 'https://api.tastyworks.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'TomKingFramework/17.0'
            },
            body: params.toString()
        });
        
        console.log(`Response status: ${response.status} ${response.statusText}`);
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('\n✅ SUCCESS! Authentication worked!');
            console.log(`Access Token: ${data.access_token.substring(0, 30)}...`);
            if (data.refresh_token) {
                console.log(`Refresh Token: ${data.refresh_token.substring(0, 30)}...`);
                console.log('\n⚠️  SAVE THIS REFRESH TOKEN in credentials.config.js!');
            }
            console.log(`Token Type: ${data.token_type}`);
            
            // Test the token
            console.log('\n🔍 Testing API with new token...');
            await testAPIWithToken(data.access_token);
            
            return data;
            
        } else {
            console.log('\n❌ Authentication failed');
            console.log('Error:', data);
            
            if (data.error === 'invalid_grant') {
                console.log('\nPossible issues:');
                console.log('1. Wrong username/password');
                console.log('2. Account needs 2FA');
                console.log('3. Password needs to be updated');
            }
        }
        
    } catch (error) {
        console.error('Request failed:', error);
    }
}

async function testAPIWithToken(token) {
    try {
        // Get accounts
        console.log('Fetching accounts...');
        const response = await fetch('https://api.tastyworks.com/accounts', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API call successful!');
            
            if (data.data && data.data.length > 0) {
                console.log(`\nFound ${data.data.length} account(s):`);
                data.data.forEach(item => {
                    const account = item.account;
                    console.log(`  Account: ${account['account-number']}`);
                    console.log(`  Type: ${account['account-type-name']}`);
                    console.log(`  Nickname: ${account.nickname || 'N/A'}`);
                });
                
                // Try to get balance
                const accountNumber = data.data[0].account['account-number'];
                await getBalance(token, accountNumber);
            }
        } else {
            console.log(`API call failed: ${response.status}`);
            const error = await response.text();
            console.log('Error:', error);
        }
        
    } catch (error) {
        console.error('API test failed:', error);
    }
}

async function getBalance(token, accountNumber) {
    try {
        console.log(`\nFetching balance for account ${accountNumber}...`);
        const response = await fetch(`https://api.tastyworks.com/accounts/${accountNumber}/balances`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const balance = data.data;
            console.log('✅ Balance retrieved:');
            console.log(`  Net Liquidating Value: $${balance['net-liquidating-value']}`);
            console.log(`  Cash Balance: $${balance['cash-balance']}`);
            console.log(`  Buying Power: $${balance['derivative-buying-power']}`);
        }
        
    } catch (error) {
        console.error('Balance fetch failed:', error);
    }
}

// Run test
testPasswordAuth().catch(console.error);