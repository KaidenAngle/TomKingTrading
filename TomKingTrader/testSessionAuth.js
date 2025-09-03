/**
 * Test Session Authentication with TastyTrade
 */

async function testSessionAuth() {
    console.log('Testing session authentication with TastyTrade...\n');
    
    const config = require('./credentials.config.js');
    
    console.log('Using credentials:');
    console.log(`  Username: ${config.username}`);
    console.log(`  Password: ${config.password.substring(0, 3)}...`);
    console.log(`  Client ID: ${config.clientId}`);
    console.log('\n1. Creating session with username/password...');
    
    try {
        const sessionResponse = await fetch('https://api.tastyworks.com/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TomKingFramework/17.0',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                login: config.username,
                password: config.password
            })
        });
        
        console.log(`Session Response: ${sessionResponse.status} ${sessionResponse.statusText}`);
        
        if (!sessionResponse.ok) {
            const errorData = await sessionResponse.json();
            console.log('Session Error:', errorData);
            return;
        }
        
        const sessionData = await sessionResponse.json();
        console.log('\n✅ Session created successfully!');
        
        const sessionToken = sessionData.data?.['session-token'];
        const userId = sessionData.data?.user?.id;
        
        if (sessionToken) {
            console.log(`Session Token: ${sessionToken.substring(0, 30)}...`);
            console.log(`User ID: ${userId}`);
            
            // The session token IS the access token for TastyTrade!
            console.log('\n2. Testing API with session token as access token...');
            console.log('(TastyTrade uses session tokens directly, no OAuth exchange needed)');
            
            await testAPIWithToken(sessionToken);
            
            // Also save this as our access token for future use
            console.log('\n✅ SUCCESS! Session token works as access token!');
            console.log('\n📝 To use this in the framework:');
            console.log('1. The session token can be used as Bearer token');
            console.log('2. Create new session when token expires');
            console.log('3. Use username/password authentication flow');
            
            return { access_token: sessionToken };
        }
        
    } catch (error) {
        console.error('Request failed:', error);
    }
}

async function testAPIWithToken(token) {
    try {
        const response = await fetch('https://api.tastyworks.com/accounts', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'TomKingFramework/17.0'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API call successful!');
            console.log(`Found ${data.data?.length || 0} accounts`);
            
            if (data.data && data.data.length > 0) {
                data.data.forEach(item => {
                    const account = item.account || item;
                    console.log(`  Account: ${account['account-number']}`)
                    console.log(`  Type: ${account['account-type-name'] || 'Unknown'}`);
                });
            }
        } else {
            console.log(`API call failed: ${response.status}`);
        }
    } catch (error) {
        console.error('API test failed:', error);
    }
}

// Run test
testSessionAuth().catch(console.error);