#!/usr/bin/env node

/**
 * Comprehensive Path Fix Script
 * Updates all import paths in moved test files
 */

const fs = require('fs');
const path = require('path');

function fixPathsInFile(filePath, baseLevel) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Determine the prefix based on directory nesting
        const prefix = baseLevel === 1 ? '../' : '../../';
        
        // Fix common import patterns
        const patterns = [
            { from: /require\s*\(\s*['"]\.\//g, to: `require('${prefix}` },
            { from: /require\s*\(\s*['"]\.\.\//g, to: `require('${prefix}` },
            { from: /require\s*\(\s*['"]src\//g, to: `require('${prefix}src/` },
            { from: /require\s*\(\s*['"]config\//g, to: `require('${prefix}config/` },
            { from: /require\s*\(\s*['"]data\//g, to: `require('${prefix}data/` }
        ];
        
        patterns.forEach(pattern => {
            if (pattern.from.test(content)) {
                content = content.replace(pattern.from, pattern.to);
                modified = true;
            }
        });
        
        // Special handling for src/ imports
        if (content.includes("./src/")) {
            content = content.replace(/require\(['"]\.\/src\//g, `require('${prefix}src/`);
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`  ✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error(`  ❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

function processDirectory(dir, baseLevel = 1) {
    const files = fs.readdirSync(dir);
    let fixedCount = 0;
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.includes('node_modules')) {
            fixedCount += processDirectory(fullPath, baseLevel + 1);
        } else if (file.endsWith('.js')) {
            if (fixPathsInFile(fullPath, baseLevel)) {
                fixedCount++;
            }
        }
    });
    
    return fixedCount;
}

console.log('🔧 Fixing import paths in all test files...\n');

const testsDir = path.join(__dirname, 'tests');
const fixedCount = processDirectory(testsDir);

console.log(`\n✅ Path fixing completed: ${fixedCount} files updated`);