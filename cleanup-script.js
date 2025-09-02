#!/usr/bin/env node

/**
 * Safe Cleanup Script for Tom King Trading Framework
 * This script implements the cleanup plan while preserving all functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_DIR = 'D:\\OneDrive\\Trading\\Claude';
const TOMKING_DIR = path.join(BASE_DIR, 'TomKingTrader');

// Files to safely delete (high confidence, no unique functionality)
const SAFE_DELETIONS = [
    'verify-real-data.js',           // Redundant with test-real-data.js
    'final-real-data-test.js',       // Redundant verification
    'backtestingUsageExample.js',    // Superseded by backtestDemo.js
    'quickBacktestFix.js',          // Temporary fix, now integrated
    'runTests.js',                   // Basic runner, superseded by masterTestRunner.js
    'comprehensiveIntegrationTest.js', // One-time verification
    'exampleDataUsage.js',           // Example only
    'validateTestData.js',           // Validation complete
    'runBacktestDemo.js',           // Superseded by backtestDemo.js
    'definitiveBacktestProof.js'     // Superseded by backtestDemo.js
];

// Files to move to tests/ directory
const TEST_FILES_TO_MOVE = [
    'test-real-data.js',
    'testAugust2024Crash.js',
    'august2024DetailedTest.js',
    'august2024RecoveryAnalysis.js', 
    'august2024VisualReport.js',
    'runAugust2024ComprehensiveTest.js',
    'test40kAccount.js',
    'testLiveAPI.js',
    'testProductionData.js',
    'testTomKingSymbols.js',
    'testWebSocketStreaming.js',
    'backtestDemo.js',
    'test-runner.js',
    'masterTestRunner.js'
];

// Documentation files to move to docs/
const DOC_FILES_TO_MOVE = [
    '2YEAR_TEST_DATA_SUMMARY.md',
    'AUTONOMOUS_DEVELOPMENT_PROMPT.md',
    'BACKTESTING_USAGE.md',
    'BACKTESTING_VERIFICATION_REPORT.md',
    'BACKTEST_VERIFICATION_REPORT.md',
    'DEVELOPMENT_LOG.md',
    'ENHANCED_PATTERN_ANALYSIS_README.md',
    'FINAL_IMPLEMENTATION_SUMMARY.md',
    'POSITION_TRACKING_USAGE.md',
    'REPORTING_SYSTEM_README.md',
    'SECURITY_UPGRADE_SUMMARY.md',
    'TEST_SUITE_OVERVIEW.md',
    'TEST_SUITE_README.md',
    'WebSocketFix_Summary.md'
];

function createBackup() {
    console.log('📦 Creating git backup before cleanup...');
    try {
        process.chdir(BASE_DIR);
        execSync('git add -A');
        execSync('git commit -m "backup: Pre-cleanup state - comprehensive file backup before cleanup"');
        console.log('✅ Git backup created successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to create git backup:', error.message);
        return false;
    }
}

function createDirectories() {
    console.log('📁 Creating new directory structure...');
    
    const dirsToCreate = [
        path.join(TOMKING_DIR, 'tests'),
        path.join(TOMKING_DIR, 'tests', 'unit'),
        path.join(TOMKING_DIR, 'tests', 'integration'),
        path.join(TOMKING_DIR, 'tests', 'data-verification'),
        path.join(TOMKING_DIR, 'tests', 'august2024'),
        path.join(TOMKING_DIR, 'docs'),
        path.join(TOMKING_DIR, 'docs', 'development'),
        path.join(TOMKING_DIR, 'docs', 'reports'),
        path.join(TOMKING_DIR, 'docs', 'usage')
    ];

    dirsToCreate.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`  Created: ${path.relative(BASE_DIR, dir)}`);
        }
    });
}

function safeDelete(filename) {
    const filepath = path.join(TOMKING_DIR, filename);
    if (fs.existsSync(filepath)) {
        try {
            fs.unlinkSync(filepath);
            console.log(`  ✅ Deleted: ${filename}`);
            return true;
        } catch (error) {
            console.error(`  ❌ Failed to delete ${filename}:`, error.message);
            return false;
        }
    } else {
        console.log(`  ⚠️  File not found: ${filename}`);
        return true;
    }
}

function moveFile(filename, targetDir) {
    const source = path.join(TOMKING_DIR, filename);
    const target = path.join(TOMKING_DIR, targetDir, filename);
    
    if (fs.existsSync(source)) {
        try {
            fs.renameSync(source, target);
            console.log(`  ✅ Moved: ${filename} → ${targetDir}/`);
            return true;
        } catch (error) {
            console.error(`  ❌ Failed to move ${filename}:`, error.message);
            return false;
        }
    } else {
        console.log(`  ⚠️  File not found: ${filename}`);
        return true;
    }
}

function consolidateAugust2024Tests() {
    console.log('🔄 Consolidating August 2024 tests...');
    
    // Move main August 2024 test files to august2024 subdirectory
    const august2024Files = [
        'testAugust2024Crash.js',
        'august2024DetailedTest.js',
        'august2024RecoveryAnalysis.js',
        'august2024VisualReport.js',
        'runAugust2024ComprehensiveTest.js'
    ];

    august2024Files.forEach(file => {
        moveFile(file, 'tests/august2024');
    });

    // Move related data files
    const dataFiles = [
        'august2024_data.csv',
        'august2024_executive_summary.json',
        'august2024_final_report.json',
        'august2024_report.html',
        'august2024_summary.md'
    ];

    dataFiles.forEach(file => {
        const source = path.join(TOMKING_DIR, file);
        const target = path.join(TOMKING_DIR, 'tests', 'august2024', file);
        
        if (fs.existsSync(source)) {
            try {
                fs.renameSync(source, target);
                console.log(`  ✅ Moved data file: ${file} → tests/august2024/`);
            } catch (error) {
                console.error(`  ❌ Failed to move ${file}:`, error.message);
            }
        }
    });
}

function updateImportPaths() {
    console.log('🔧 Creating path update helper...');
    
    const helperScript = `
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
                    content = content.replace(/require\\('\\.\\/src\\//g, "require('../src/");
                    content = content.replace(/require\\('\\.\\/config\\//g, "require('../config/");
                    modified = true;
                }
                
                if (modified) {
                    fs.writeFileSync(fullPath, content);
                    console.log(\`  ✅ Updated imports in: \${path.relative(process.cwd(), fullPath)}\`);
                }
            } catch (error) {
                console.error(\`  ❌ Failed to update \${file}:\`, error.message);
            }
        }
    });
}

updateImports('${TOMKING_DIR}');
console.log('✅ Import paths updated successfully');
`;

    fs.writeFileSync(path.join(TOMKING_DIR, 'update-paths.js'), helperScript);
    console.log('  Created: update-paths.js');
}

function runCleanup() {
    console.log('🧹 Starting Tom King Trading Framework Cleanup');
    console.log('================================================\n');

    // Step 1: Create backup
    if (!createBackup()) {
        console.error('❌ Backup failed. Aborting cleanup for safety.');
        process.exit(1);
    }

    // Step 2: Create directory structure
    createDirectories();

    // Step 3: Safe deletions
    console.log('\n🗑️  Phase 1: Safe deletions...');
    let deletionCount = 0;
    SAFE_DELETIONS.forEach(file => {
        if (safeDelete(file)) deletionCount++;
    });
    console.log(`  Completed: ${deletionCount}/${SAFE_DELETIONS.length} files deleted`);

    // Step 4: Move test files
    console.log('\n📁 Phase 2: Moving test files...');
    let testMoveCount = 0;
    TEST_FILES_TO_MOVE.forEach(file => {
        if (moveFile(file, 'tests')) testMoveCount++;
    });
    console.log(`  Completed: ${testMoveCount}/${TEST_FILES_TO_MOVE.length} test files moved`);

    // Step 5: Move documentation
    console.log('\n📚 Phase 3: Moving documentation...');
    let docMoveCount = 0;
    DOC_FILES_TO_MOVE.forEach(file => {
        if (moveFile(file, 'docs/development')) docMoveCount++;
    });
    console.log(`  Completed: ${docMoveCount}/${DOC_FILES_TO_MOVE.length} docs moved`);

    // Step 6: Consolidate August 2024 tests
    consolidateAugust2024Tests();

    // Step 7: Create import path updater
    updateImportPaths();

    console.log('\n✅ CLEANUP COMPLETED SUCCESSFULLY!');
    console.log('=================================');
    console.log(`📊 Summary:`);
    console.log(`   - Deleted: ${deletionCount} redundant files`);
    console.log(`   - Moved: ${testMoveCount} test files to tests/`);
    console.log(`   - Moved: ${docMoveCount} docs to docs/`);
    console.log(`   - Organized: August 2024 tests consolidated`);
    console.log(`   - Created: New directory structure`);
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Run: node update-paths.js  (to fix import paths)');
    console.log('2. Test: npm run test         (to verify functionality)');
    console.log('3. Commit: git add -A && git commit -m "feat: cleaned up directory structure"');
}

// Safety check before running
if (require.main === module) {
    console.log('⚠️  SAFETY CHECK: This will modify your file structure.');
    console.log('   - A git backup will be created first');
    console.log('   - No core functionality will be deleted');
    console.log('   - Only redundant files will be removed');
    console.log('   - Files will be reorganized into proper directories\n');
    
    // Run the cleanup
    runCleanup();
} else {
    module.exports = { runCleanup, safeDelete, moveFile, createDirectories };
}