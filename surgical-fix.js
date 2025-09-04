#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 SURGICAL FIX - Targeted repair of specific syntax patterns');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

// Most common patterns causing issues
const commonFixes = [
    // Pattern: logger.info('SYSTEM', something();  -> logger.info('SYSTEM', something());
    /logger\.(info|error|warn|debug)\((.*?);$/gm,
    
    // Pattern: forEach(x);); -> forEach(x);
    /\.forEach\([^)]*\);\);/g,
    
    // Pattern: .repeat(60); -> .repeat(60));
    /\.repeat\((\d+)\);$/gm
];

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixed = false;
    
    // Quick line-by-line fix for most obvious issues
    const lines = content.split('\n');
    const fixedLines = lines.map(line => {
        let fixedLine = line;
        
        // Fix missing closing parentheses in logger calls
        if (line.includes('logger.') && line.includes('(') && !line.match(/\)\s*;?\s*$/)) {
            // If line contains logger call but doesn't end with ) or );
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;
            
            if (openParens > closeParens && line.endsWith(';')) {
                fixedLine = line.slice(0, -1) + ');';  // Replace final ; with );
                fileFixed = true;
            }
        }
        
        // Fix double semicolons  
        if (line.includes(';;')) {
            fixedLine = fixedLine.replace(/;;/g, ';');
            fileFixed = true;
        }
        
        // Fix );); pattern
        if (line.includes('););')) {
            fixedLine = fixedLine.replace(/\);\);/g, ');');
            fileFixed = true;
        }
        
        return fixedLine;
    });
    
    if (fileFixed) {
        const newContent = fixedLines.join('\n');
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Applied surgical fixes to ${file}`);
        totalFixed++;
    }
});

console.log(`\n🎯 SURGICAL FIX COMPLETE: Fixed ${totalFixed} files`);

// Test one file to see if we're making progress
try {
    const testFile = path.join(srcDir, 'masterController.js');
    const { execSync } = require('child_process');
    execSync(`node -c "${testFile}"`, { stdio: 'pipe' });
    console.log('✅ masterController.js syntax test PASSED');
} catch (error) {
    console.log('❌ masterController.js still has syntax errors');
    
    // Show the specific error
    const lines = error.message.split('\n');
    const errorLine = lines.find(line => line.includes('SyntaxError'));
    if (errorLine) {
        console.log(`   Error: ${errorLine}`);
    }
}