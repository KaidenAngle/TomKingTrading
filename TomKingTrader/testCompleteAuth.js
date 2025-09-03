/**
 * Complete Authentication Test - Session + Remember Token
 */

async function testCompleteAuth() {
    console.log('Testing complete authentication flow...\n');
    
    const config = require('./credentials.config.js');
    
    console.log('Step 1: Create session with username/password');
    
    try {
        // Create session
        const sessionResponse = await fetch('https://api.tastyworks.com/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TomKingFramework/17.0',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                login: config.username,
                password: config.password,
                "remember-me": true  // This may generate a remember token
            })
        });
        
        console.log(`Response: ${sessionResponse.status}`);
        
        if (!sessionResponse.ok) {
            const error = await sessionResponse.json();
            console.log('Error:', error);
            return;
        }
        
        const sessionData = await sessionResponse.json();
        console.log('\n✅ Session created!');
        
        // Extract all possible tokens
        const sessionToken = sessionData.data?.['session-token'];
        const rememberToken = sessionData.data?.['remember-token'];
        const user = sessionData.data?.user;
        
        console.log('\nTokens received:');
        if (sessionToken) console.log(`  Session Token: ${sessionToken.substring(0, 30)}...`);
        if (rememberToken) console.log(`  Remember Token: ${rememberToken.substring(0, 30)}...`);
        if (user) console.log(`  User: ${user.email || user.username || 'Unknown'}`);
        
        // Test different authorization methods
        console.log('\n\nStep 2: Testing different authorization methods...\n');
        
        // Test 1: Session token in Authorization header
        console.log('Test 1: Session token as Authorization header');
        const test1 = await fetch('https://api.tastyworks.com/customers/me', {
            headers: {
                'Authorization': sessionToken,  // Without Bearer prefix
                'Accept': 'application/json',
                'User-Agent': 'TomKingFramework/17.0'
            }
        });
        console.log(`  Result: ${test1.status} ${test1.statusText}`);
        
        // Test 2: Session token as Bearer
        console.log('\nTest 2: Session token as Bearer token');
        const test2 = await fetch('https://api.tastyworks.com/customers/me', {
            headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json',
                'User-Agent': 'TomKingFramework/17.0'
            }
        });
        console.log(`  Result: ${test2.status} ${test2.statusText}`);
        
        // Test 3: Remember token if exists
        if (rememberToken) {
            console.log('\nTest 3: Remember token as Bearer');
            const test3 = await fetch('https://api.tastyworks.com/customers/me', {
                headers: {
                    'Authorization': `Bearer ${rememberToken}`,
                    'Accept': 'application/json',
                    'User-Agent': 'TomKingFramework/17.0'
                }
            });
            console.log(`  Result: ${test3.status} ${test3.statusText}`);
        }
        
        // Find which one worked
        let workingToken = null;
        let workingMethod = '';
        
        if (test1.ok) {
            workingToken = sessionToken;
            workingMethod = 'Session token without Bearer';
            const data = await test1.json();
            console.log('\n✅ SUCCESS with session token (no Bearer prefix)!');
            console.log('Customer ID:', data.data?.id);
        } else if (test2.ok) {
            workingToken = sessionToken;
            workingMethod = 'Session token with Bearer';
            const data = await test2.json();
            console.log('\n✅ SUCCESS with Bearer session token!');
            console.log('Customer ID:', data.data?.id);
        } else if (rememberToken && test3.ok) {
            workingToken = rememberToken;
            workingMethod = 'Remember token with Bearer';
            const data = await test3.json();
            console.log('\n✅ SUCCESS with Bearer remember token!');
            console.log('Customer ID:', data.data?.id);
        }
        
        if (workingToken) {
            console.log('\n\nStep 3: Get accounts with working token...');
            const accountsResponse = await fetch('https://api.tastyworks.com/accounts', {
                headers: {
                    'Authorization': workingMethod.includes('Bearer') ? `Bearer ${workingToken}` : workingToken,
                    'Accept': 'application/json',
                    'User-Agent': 'TomKingFramework/17.0'
                }
            });
            
            if (accountsResponse.ok) {
                const accountsData = await accountsResponse.json();
                console.log('✅ Accounts retrieved!');
                
                if (accountsData.data && accountsData.data.items) {
                    accountsData.data.items.forEach(item => {
                        const account = item.account;
                        console.log(`  Account: ${account['account-number']}`);
                        console.log(`    Type: ${account['account-type-name']}`);
                        console.log(`    Nickname: ${account.nickname || 'None'}`);
                    });
                }
            }
            
            console.log('\n\n📝 SOLUTION FOUND:');
            console.log(`Use: ${workingMethod}`);
            console.log('Update tastytradeAPI.js to use session authentication');
            console.log(`Token format: ${workingMethod.includes('Bearer') ? 'Bearer TOKEN' : 'TOKEN only'}`);
        } else {
            console.log('\n❌ None of the authorization methods worked');
            console.log('The API might require a different authentication approach');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// Run test
testCompleteAuth().catch(console.error);