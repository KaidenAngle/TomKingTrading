#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚨 MASS EMERGENCY FIX - Fixing specific double parentheses pattern');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Fix the most common pattern: logger.info(...)));  should be logger.info(...);
    const fixPattern1 = content.replace(/logger\.(info|error|warn|debug)\(([^)]*)\)\)\);/g, "logger.$1($2);");
    
    // Fix: .repeat(60)));  should be .repeat(60));
    const fixPattern2 = fixPattern1.replace(/\.repeat\((\d+)\)\)\);/g, ".repeat($1));");
    
    // Fix: (...););  should be (...);
    const fixPattern3 = fixPattern2.replace(/\(([^)]*)\);\);/g, "($1);");
    
    // Count actual changes
    const changes1 = (originalContent.match(/logger\.(info|error|warn|debug)\([^)]*\)\)\);/g) || []).length;
    const changes2 = (originalContent.match(/\.repeat\(\d+\)\)\);/g) || []).length;
    const changes3 = (originalContent.match(/\([^)]*\);\);/g) || []).length;
    
    const totalChanges = changes1 + changes2 + changes3;
    
    if (fixPattern3 !== originalContent && totalChanges > 0) {
        fs.writeFileSync(filePath, fixPattern3);
        console.log(`✅ Fixed ${totalChanges} patterns in ${file}`);
        totalFixed += totalChanges;
    }
});

console.log(`\n🎯 MASS FIX COMPLETE: Fixed ${totalFixed} patterns total`);

// Test critical files
const criticalFiles = ['app.js', 'earningsCalendar.js', 'fedAnnouncementProtection.js', 'riskManager.js'];

console.log('\n🔍 Testing critical files:');
criticalFiles.forEach(file => {
    try {
        const filePath = path.join(srcDir, file);
        const { execSync } = require('child_process');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} - syntax OK`);
    } catch (error) {
        const errorLine = error.message.split('\n')[1] || 'unknown error';
        console.log(`❌ ${file} - ${errorLine}`);
    }
});

console.log('\n🔄 Attempting app startup test...');
try {
    const appPath = path.join(srcDir, 'app.js');
    const { execSync } = require('child_process');
    
    // Just test if it can be parsed and start loading
    const output = execSync(`timeout 2 node "${appPath}" 2>&1 || echo "timeout"`, { 
        encoding: 'utf8',
        timeout: 3000
    });
    
    if (output.includes('SyntaxError')) {
        console.log('❌ App still has syntax errors');
        const errorLines = output.split('\n').slice(0, 3);
        errorLines.forEach(line => console.log(`   ${line}`));
    } else {
        console.log('✅ App syntax appears clean - framework may be functional');
    }
} catch (error) {
    console.log('⚠️  App test completed (timeout or other)');
}