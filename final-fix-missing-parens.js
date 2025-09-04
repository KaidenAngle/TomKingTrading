#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 FINAL FIX - Missing closing parentheses in logger calls');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fixes = 0;
    
    // Pattern: logger.info(...);  where there should be logger.info(...));
    // This happens when there's a function call in the arguments
    const lines = content.split('\n');
    const fixedLines = lines.map((line, index) => {
        // Check if line contains logger call ending with ;
        if (line.match(/^\s*logger\.(info|error|warn|debug)\(.+\);?\s*$/)) {
            // Count open and close parentheses
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;
            
            if (openParens > closeParens) {
                const missing = openParens - closeParens;
                const additionalParens = ')'.repeat(missing);
                const fixedLine = line.replace(/;\s*$/, additionalParens + ';');
                fixes++;
                console.log(`  Fixed ${file}:${index + 1} - Added ${missing} closing paren(s)`);
                return fixedLine;
            }
        }
        return line;
    });
    
    const newContent = fixedLines.join('\n');
    
    if (newContent !== originalContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed ${fixes} logger calls in ${file}`);
        totalFixed += fixes;
    }
});

console.log(`\n🎯 FINAL FIX COMPLETE: Fixed ${totalFixed} missing parentheses`);

// Test the specific file that was failing
console.log('\n🔍 Testing positionManager.js:');
try {
    const filePath = path.join(srcDir, 'positionManager.js');
    const { execSync } = require('child_process');
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    console.log('✅ positionManager.js - syntax OK');
} catch (error) {
    const errorLine = error.message.split('\n')[1] || 'unknown error';
    console.log(`❌ positionManager.js - ${errorLine}`);
}

// Test app startup
console.log('\n🚀 Final app startup test:');
try {
    const appPath = path.join(srcDir, 'app.js');
    const { spawn } = require('child_process');
    
    const child = spawn('node', [appPath], {
        cwd: path.dirname(appPath),
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let hasError = false;
    
    child.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
        const errorText = data.toString();
        if (errorText.includes('SyntaxError')) {
            hasError = true;
            console.log('❌ Framework still has syntax errors:');
            console.log(errorText.split('\n').slice(0, 3).join('\n'));
        }
        output += errorText;
    });
    
    // Kill after 3 seconds
    setTimeout(() => {
        child.kill();
        if (!hasError) {
            if (output.length > 0) {
                console.log('✅ Framework started successfully! Output preview:');
                console.log(output.split('\n').slice(0, 5).join('\n'));
            } else {
                console.log('✅ Framework appears to start without syntax errors');
            }
        }
    }, 3000);
    
} catch (error) {
    console.log('⚠️  Error testing startup:', error.message);
}