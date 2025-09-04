#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 FIXING MASTERCONTROLLER.JS - Pattern-based repair');

const filePath = path.join(__dirname, 'TomKingTrader', 'src', 'masterController.js');
let content = fs.readFileSync(filePath, 'utf8');
const originalContent = content;

console.log('Original file size:', content.length, 'characters');

// Fix common patterns
let fixCount = 0;

// Pattern 1: logger.info(..., something(); -> logger.info(..., something());
const pattern1 = /logger\.(info|error|warn|debug)\(([^)]*)\);$/gm;
content = content.replace(pattern1, (match, method, args) => {
    if (!args.includes('()') && !args.includes(').')) {
        return match; // Skip if no function call
    }
    fixCount++;
    return `logger.${method}(${args});`;
});

// Pattern 2: More specific fixes for missing closing parens
const lines = content.split('\n');
const fixedLines = lines.map((line, index) => {
    let fixedLine = line;
    
    // Fix lines that end with ); but should end with );
    if (line.includes('logger.') && line.includes('(') && line.match(/;$/)) {
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        
        if (openParens > closeParens) {
            fixedLine = line.replace(/;$/, ');');
            fixCount++;
            console.log(`Fixed line ${index + 1}:`, line.trim());
        }
    }
    
    // Fix .catch(...); patterns
    if (line.includes('.catch(') && line.match(/\);\s*$/) && !line.includes('));')) {
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        
        if (openParens > closeParens) {
            fixedLine = line.replace(/\);$/, '));');
            fixCount++;
            console.log(`Fixed catch line ${index + 1}:`, line.trim());
        }
    }
    
    return fixedLine;
});

const finalContent = fixedLines.join('\n');

if (finalContent !== originalContent) {
    fs.writeFileSync(filePath, finalContent);
    console.log(`✅ Applied ${fixCount} fixes to masterController.js`);
} else {
    console.log('❌ No fixes applied');
}

// Test syntax
try {
    const { execSync } = require('child_process');
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    console.log('✅ masterController.js syntax test PASSED');
} catch (error) {
    console.log('❌ masterController.js still has syntax errors:');
    const errorLines = error.message.split('\n').slice(0, 5);
    errorLines.forEach(line => {
        if (line.trim()) console.log(`   ${line}`);
    });
}