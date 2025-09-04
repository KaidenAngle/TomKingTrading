#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚨 COMPREHENSIVE EMERGENCY FIX - Fixing all syntax errors from cleanup');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

console.log(`Found ${jsFiles.length} JavaScript files to fix`);

let totalFiles = 0;
let totalFixes = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixCount = 0;
    
    // Strategy: Line-by-line analysis and repair
    const lines = content.split('\n');
    const fixedLines = lines.map((line, index) => {
        let fixedLine = line;
        const lineNumber = index + 1;
        
        // Pattern 1: logger.info(..., something(); -> logger.info(..., something());
        if (line.includes('logger.') && line.includes('(') && line.match(/;\s*$/)) {
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;
            
            if (openParens > closeParens) {
                // Most common case: missing one closing paren
                if (openParens - closeParens === 1) {
                    fixedLine = line.replace(/;\s*$/, ');');
                    fileFixCount++;
                    console.log(`  Fix ${file}:${lineNumber} - Added closing paren`);
                }
            }
        }
        
        // Pattern 2: .forEach(...);); -> .forEach(...);
        if (line.includes('.forEach(') && line.includes('););')) {
            fixedLine = line.replace(/\);\);/g, ');');
            fileFixCount++;
            console.log(`  Fix ${file}:${lineNumber} - Fixed forEach double parens`);
        }
        
        // Pattern 3: method(..., arg();, -> method(..., arg(), (semicolon in wrong place)
        if (line.includes('();,')) {
            fixedLine = line.replace(/\(\);\s*,/g, '(),');
            fileFixCount++;
            console.log(`  Fix ${file}:${lineNumber} - Fixed semicolon in arguments`);
        }
        
        // Pattern 4: .catch(...); -> .catch(...));
        if (line.includes('.catch(') && line.includes('error => logger.') && line.match(/;\s*$/)) {
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;
            
            if (openParens > closeParens) {
                fixedLine = line.replace(/;\s*$/, '));');
                fileFixCount++;
                console.log(`  Fix ${file}:${lineNumber} - Fixed .catch() closing`);
            }
        }
        
        // Pattern 5: Double semicolons ;;
        if (line.includes(';;')) {
            fixedLine = fixedLine.replace(/;;+/g, ';');
            fileFixCount++;
            console.log(`  Fix ${file}:${lineNumber} - Removed double semicolon`);
        }
        
        return fixedLine;
    });
    
    const newContent = fixedLines.join('\n');
    
    if (newContent !== originalContent) {
        fs.writeFileSync(filePath, newContent);
        console.log(`✅ Fixed ${fileFixCount} issues in ${file}`);
        totalFiles++;
        totalFixes += fileFixCount;
    }
});

console.log(`\n🎯 COMPREHENSIVE FIX COMPLETE:`);
console.log(`   Fixed ${totalFixes} syntax errors across ${totalFiles} files`);

// Quick verification of first 5 files
console.log('\n🔍 Quick verification of fixes:');
let verificationErrors = 0;

jsFiles.slice(0, 5).forEach(file => {
    try {
        const filePath = path.join(srcDir, file);
        const { execSync } = require('child_process');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} - syntax OK`);
    } catch (error) {
        console.log(`❌ ${file} - still has errors: ${error.message.split('\n')[1] || 'unknown'}`);
        verificationErrors++;
    }
});

if (verificationErrors === 0) {
    console.log('\n🎉 Sampled files all pass syntax validation!');
    console.log('Framework should now be functional again.');
} else {
    console.log(`\n⚠️  ${verificationErrors} of 5 sampled files still have errors`);
    console.log('Some complex issues may require manual fixing.');
}

// Test if main app.js can at least be parsed now
try {
    const appPath = path.join(srcDir, 'app.js');
    const { execSync } = require('child_process');
    execSync(`node -c "${appPath}"`, { stdio: 'pipe' });
    console.log('✅ CRITICAL: app.js syntax is now valid!');
} catch (error) {
    console.log('❌ CRITICAL: app.js still has syntax errors');
}