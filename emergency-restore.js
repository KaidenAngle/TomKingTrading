#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY RESTORE - Using simple pattern fixes');

const srcDir = path.join(__dirname, 'TomKingTrader', 'src');
const jsFiles = fs.readdirSync(srcDir).filter(file => file.endsWith('.js'));

let totalFixed = 0;

jsFiles.forEach(file => {
    const filePath = path.join(srcDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Emergency fixes - very simple patterns
    
    // Fix: logger.info('SYSTEM', '='.repeat(60);   should have closing )
    content = content.replace(/logger\.(info|error|warn|debug)\(([^)]*\.repeat\(\d+\));/g, 'logger.$1($2));');
    
    // Fix: logger.info(..., something();   should have closing )  
    content = content.replace(/logger\.(info|error|warn|debug)\(([^)]*\(\));/g, 'logger.$1($2));');
    
    // Fix: forEach(...););  should be forEach(...);
    content = content.replace(/\.forEach\(([^)]*)\);\);/g, '.forEach($1);');
    
    // Fix obvious double semicolon issues
    content = content.replace(/;;/g, ';');
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Applied emergency fixes to ${file}`);
        totalFixed++;
    }
});

console.log(`\n🎯 EMERGENCY RESTORE COMPLETE: Fixed ${totalFixed} files`);

// Quick syntax check
console.log('\n🔍 Quick syntax check...');
let errorCount = 0;

jsFiles.slice(0, 5).forEach(file => {  // Check first 5 files only
    try {
        const filePath = path.join(srcDir, file);
        const { execSync } = require('child_process');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
        console.log(`✅ ${file} - syntax OK`);
    } catch (error) {
        console.log(`❌ ${file} - still has errors`);
        errorCount++;
    }
});

if (errorCount === 0) {
    console.log('🎉 Sampled files pass syntax check!');
} else {
    console.log(`⚠️  ${errorCount} of 5 sampled files still have errors`);
}