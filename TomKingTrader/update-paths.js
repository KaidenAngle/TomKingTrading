
// Path Update Helper - Run this to fix import paths after cleanup
// This script will be run automatically after the cleanup

const fs = require('fs');
const path = require('path');

function updateImports(dir, depth = 0) {
    if (depth > 3) return; // Prevent infinite recursion
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.includes('node_modules')) {
            updateImports(fullPath, depth + 1);
        } else if (file.endsWith('.js')) {
            try {
                let content = fs.readFileSync(fullPath, 'utf8');
                let modified = false;
                
                // Update relative paths for moved files
                if (fullPath.includes('tests/')) {
                    content = content.replace(/require\('\.\/src\//g, "require('../src/");
                    content = content.replace(/require\('\.\/config\//g, "require('../config/");
                    modified = true;
                }
                
                if (modified) {
                    fs.writeFileSync(fullPath, content);
                    console.log(`  ✅ Updated imports in: ${path.relative(process.cwd(), fullPath)}`);
                }
            } catch (error) {
                console.error(`  ❌ Failed to update ${file}:`, error.message);
            }
        }
    });
}

updateImports(__dirname);
console.log('✅ Import paths updated successfully');
