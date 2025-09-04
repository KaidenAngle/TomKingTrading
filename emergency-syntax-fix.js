#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY SYNTAX FIX - Correcting malformed logger calls');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileFixed = 0;
    
    // Fix malformed logger calls with semicolons inside parentheses
    // Pattern: logger.method('CATEGORY', something(););
    // Should be: logger.method('CATEGORY', something());
    
    const patterns = [
        // Fix repeat() calls
        { 
            pattern: /logger\.(info|error|warn|debug)\(([^)]+\.repeat\([^)]+\));(\)\s*;)/g,
            replacement: 'logger.$1($2)$3'
        },
        // Fix JSON.stringify calls  
        { 
            pattern: /logger\.(info|error|warn|debug)\(([^)]+JSON\.stringify[^)]+\));(\)\s*;)/g,
            replacement: 'logger.$1($2)$3'
        },
        // Fix method calls like getStatus()
        { 
            pattern: /logger\.(info|error|warn|debug)\(([^)]+\(\));(\)\s*;)/g,
            replacement: 'logger.$1($2)$3'
        },
        // Fix forEach patterns
        { 
            pattern: /(\w+\.forEach\([^)]+logger\.[^)]+\));(\)\s*;)/g,
            replacement: '$1)$2'
        }
    ];
    
    patterns.forEach(({ pattern, replacement }) => {
        const before = content;
        content = content.replace(pattern, replacement);
        const matches = (before.match(pattern) || []).length;
        fileFixed += matches;
    });
    
    if (fileFixed > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Fixed ${fileFixed} syntax errors in ${file}`);
        totalFixed += fileFixed;
    }
});

console.log(`\n🎯 EMERGENCY FIX COMPLETE: Fixed ${totalFixed} syntax errors`);

// Verify all files can be parsed now
console.log('\n🔍 Verifying syntax...');
let syntaxErrors = 0;

jsFiles.forEach(file => {
    try {
        const filePath = path.join(srcDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        new Function(content); // Quick syntax check
    } catch (error) {
        console.log(`❌ Syntax error in ${file}: ${error.message}`);
        syntaxErrors++;
    }
});

if (syntaxErrors === 0) {
    console.log('✅ All files pass syntax validation');
} else {
    console.log(`❌ ${syntaxErrors} files still have syntax errors`);
}