/**
 * Test Token Refresh with Correct Format
 */

async function testTokenRefresh() {
    console.log('Testing OAuth2 token refresh...\n');
    
    // Load credentials
    process.env.TRADING_MODE = 'paper';
    const config = require('./credentials.config.js');
    
    console.log('Using credentials:');
    console.log(`  Client Secret: ${config.clientSecret.substring(0, 10)}...`);
    console.log(`  Refresh Token: ${config.refreshToken.substring(0, 20)}...`);
    console.log(`  API URL: ${config.oauthUrl}\n`);
    
    // Test with form-urlencoded
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
        client_secret: config.clientSecret
    });
    
    console.log('Sending request with application/x-www-form-urlencoded...');
    
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
            console.log('\n✅ SUCCESS! Token refresh worked!');
            console.log(`Access Token: ${data.access_token.substring(0, 30)}...`);
            console.log(`Token Type: ${data.token_type}`);
            if (data.expires_in) {
                console.log(`Expires In: ${data.expires_in} seconds`);
            } else {
                console.log('Token does not expire');
            }
            
            // Now test if we can use the token
            console.log('\n🔍 Testing API with new token...');
            await testAPIWithToken(data.access_token);
            
        } else {
            console.log('\n❌ Token refresh failed');
            console.log('Error data:', data);
        }
        
    } catch (error) {
        console.error('Request failed:', error);
    }
}

async function testAPIWithToken(token) {
    try {
        // Try to get account info
        const response = await fetch('https://api.tastyworks.com/accounts', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API call successful!');
            console.log(`Found ${data.data?.length || 0} accounts`);
            
            if (data.data && data.data.length > 0) {
                const account = data.data[0];
                console.log(`Account: ${account.account?.['account-number'] || 'N/A'}`);
            }
        } else {
            console.log(`API call failed: ${response.status}`);
        }
        
    } catch (error) {
        console.error('API test failed:', error);
    }
}

// Run test
testTokenRefresh().catch(console.error);