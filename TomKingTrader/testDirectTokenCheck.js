/**
 * Direct token check with exact API format
 */

async function testDirectToken() {
    console.log('Testing direct token with exact API format...\n');
    
    const credentials = {
        refreshToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6InJ0K2p3dCIsImtpZCI6IkZqVTdUT25qVEQ2WnVySlg2cVlwWmVPbzBDQzQ5TnIzR1pUN1E4MTc0cUkiLCJqa3UiOiJodHRwczovL2ludGVyaW9yLWFwaS5hcjIudGFzdHl0cmFkZS5zeXN0ZW1zL29hdXRoL2p3a3MifQ.eyJpc3MiOiJodHRwczovL2FwaS50YXN0eXRyYWRlLmNvbSIsInN1YiI6IlUyYTUyMWEwZS0zZmNmLTQzMjgtOGI5NS02MjA1ZDY4ODUwOGUiLCJpYXQiOjE3NTY0MTE3NzcsImF1ZCI6ImJmY2EyYmQxLWIzZjMtNDk0MS1iNTQyLTAyNjc4MTJmMWIyZiIsImdyYW50X2lkIjoiRzRmMzdmMTZjLWNlYTktNDhlYi05N2FiLTA1YzI0YjViMDQ2OCIsInNjb3BlIjoicmVhZCB0cmFkZSBvcGVuaWQifQ.bA7Mt0YbQj5aCptb3BlxD67YnzdlWysWzqGYbNChCTMV1VfmRxsQMQ7yGMcrv28izZuIihzC7_-tWKkLhxZTAw',
        clientSecret: '98911c87a7287ac6665fc96a9a467d54fd02f7ed',
        clientId: 'bfca2bd1-b3f3-4941-b542-0267812f1b2f'
    };
    
    // Try different combinations
    console.log('1. Testing with client_id + client_secret + refresh_token...');
    try {
        const params1 = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: credentials.refreshToken,
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret
        });
        
        const response1 = await fetch('https://api.tastyworks.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'TomKingFramework/17.0',
                'Accept': 'application/json'
            },
            body: params1.toString()
        });
        
        console.log(`Response: ${response1.status}`);
        const data1 = await response1.json();
        console.log('Result:', data1);
        
        if (response1.ok) {
            console.log('\n✅ SUCCESS with client_id + client_secret!');
            return data1;
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    
    console.log('\n2. Testing with just client_secret + refresh_token...');
    try {
        const params2 = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: credentials.refreshToken,
            client_secret: credentials.clientSecret
        });
        
        const response2 = await fetch('https://api.tastyworks.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'TomKingFramework/17.0',
                'Accept': 'application/json'
            },
            body: params2.toString()
        });
        
        console.log(`Response: ${response2.status}`);
        const data2 = await response2.json();
        console.log('Result:', data2);
        
        if (response2.ok) {
            console.log('\n✅ SUCCESS with just client_secret!');
            return data2;
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
    
    console.log('\n3. Testing direct use of the refresh token as Bearer...');
    try {
        const response3 = await fetch('https://api.tastyworks.com/accounts', {
            headers: {
                'Authorization': `Bearer ${credentials.refreshToken}`,
                'Accept': 'application/json',
                'User-Agent': 'TomKingFramework/17.0'
            }
        });
        
        console.log(`Response: ${response3.status}`);
        
        if (response3.ok) {
            const data3 = await response3.json();
            console.log('\n✅ Refresh token works as access token directly!');
            console.log('Accounts:', data3);
            return { access_token: credentials.refreshToken };
        } else {
            const error = await response3.text();
            console.log('Error:', error);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Run test
testDirectToken().catch(console.error);