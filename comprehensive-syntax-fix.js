#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 COMPREHENSIVE SYNTAX FIX - Correcting all malformed logger calls');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileFixed = 0;
    const originalContent = content;
    
    // Fix all patterns of malformed syntax from console.log cleanup
    const fixes = [
        // Pattern: method(...));  should be method(...);
        { 
            pattern: /logger\.(info|error|warn|debug)\(([^)]*)\)\);/g,
            replacement: 'logger.$1($2);',
            description: 'Fix double closing parentheses'
        },
        // Pattern: forEach(...));  should be forEach(...);
        { 
            pattern: /\.forEach\(([^)]*)\)\);/g,
            replacement: '.forEach($1);',
            description: 'Fix forEach double parentheses'
        },
        // Pattern: .repeat(60); + 'text')  should be .repeat(60) + 'text')
        { 
            pattern: /\.repeat\((\d+)\);\s*\+/g,
            replacement: '.repeat($1) +',
            description: 'Fix repeat with semicolon plus'
        },
        // Pattern: method(args;);  should be method(args);
        { 
            pattern: /logger\.(info|error|warn|debug)\(([^)]*);(\)\s*;)/g,
            replacement: 'logger.$1($2)$3',
            description: 'Fix semicolon inside arguments'
        }
    ];
    
    fixes.forEach(fix => {
        const before = content;
        content = content.replace(fix.pattern, fix.replacement);
        const matches = (before.match(fix.pattern) || []).length;
        if (matches > 0) {
            console.log(`  ✓ ${fix.description}: ${matches} fixes in ${file}`);
            fileFixed += matches;
        }
    });
    
    // Additional specific fixes for complex cases
    
    // Fix pattern: .catch(error => logger.error(...)););
    content = content.replace(
        /\.catch\(([^)]*logger\.error[^}]*)\)\);/g,
        '.catch($1);'
    );
    
    // Fix getStatus()); pattern 
    content = content.replace(
        /'([^']*)', ([^.]+\.\w+\([^)]*\))\);/g,
        "'$1', $2);"
    );
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        if (fileFixed > 0) {
            console.log(`✅ Fixed ${fileFixed} syntax errors in ${file}`);
        } else {
            console.log(`✅ Applied additional fixes to ${file}`);
            fileFixed = 1; // Count as 1 fix
        }
        totalFixed += fileFixed;
    }
});

console.log(`\n🎯 COMPREHENSIVE FIX COMPLETE: Fixed ${totalFixed} syntax errors total`);

// Now verify all files can be parsed
console.log('\n🔍 Final syntax verification...');
let remainingErrors = 0;
const errorFiles = [];

for (const file of jsFiles) {
    try {
        const filePath = path.join(srcDir, file);
        require(filePath); // This will catch syntax errors
    } catch (error) {
        if (error.toString().includes('SyntaxError')) {
            console.log(`❌ Syntax error in ${file}: ${error.message.split('\n')[0]}`);
            remainingErrors++;
            errorFiles.push({ file, error: error.message.split('\n')[0] });
        }
    }
}

if (remainingErrors === 0) {
    console.log('🎉 ALL FILES PASS SYNTAX VALIDATION!');
} else {
    console.log(`⚠️  ${remainingErrors} files still have syntax errors:`);
    errorFiles.forEach(({file, error}) => {
        console.log(`   ${file}: ${error}`);
    });
}