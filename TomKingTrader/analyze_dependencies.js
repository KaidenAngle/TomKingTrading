#!/usr/bin/env node
/**
 * Circular Dependency Analysis Script
 * Systematically analyzes all require statements to detect circular dependencies
 */

const fs = require('fs');
const path = require('path');

class DependencyAnalyzer {
  constructor() {
    this.dependencies = new Map();
    this.visited = new Set();
    this.recursionStack = new Set();
    this.circularDependencies = [];
  }

  /**
   * Extract require statements from a JavaScript file
   */
  extractRequires(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const requires = [];
      
      // Match require('./something') patterns
      const requirePattern = /require\(['"]\.\/([^'"]+)['"]\)/g;
      let match;
      
      while ((match = requirePattern.exec(content)) !== null) {
        const requiredModule = match[1];
        // Remove .js extension if present
        const moduleName = requiredModule.replace(/\.js$/, '');
        requires.push(moduleName);
      }
      
      return requires;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error.message);
      return [];
    }
  }

  /**
   * Build dependency map for all modules
   */
  buildDependencyMap(srcDir) {
    console.log('📊 Building dependency map...\n');
    
    const files = fs.readdirSync(srcDir)
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace('.js', ''));

    // Build dependency map
    files.forEach(file => {
      const filePath = path.join(srcDir, `${file}.js`);
      const requires = this.extractRequires(filePath);
      
      // Filter to only local requires that exist
      const localRequires = requires.filter(req => 
        files.includes(req) || files.includes(req.replace('.js', ''))
      );
      
      this.dependencies.set(file, localRequires);
      
      if (localRequires.length > 0) {
        console.log(`📁 ${file}.js requires: ${localRequires.join(', ')}`);
      }
    });
    
    console.log(`\n✅ Analyzed ${files.length} modules`);
    return files;
  }

  /**
   * Depth-First Search to detect circular dependencies
   */
  dfs(module, path = []) {
    if (this.recursionStack.has(module)) {
      // Found a cycle
      const cycleStart = path.indexOf(module);
      const cycle = path.slice(cycleStart).concat([module]);
      this.circularDependencies.push(cycle);
      return true;
    }

    if (this.visited.has(module)) {
      return false;
    }

    this.visited.add(module);
    this.recursionStack.add(module);
    path.push(module);

    const dependencies = this.dependencies.get(module) || [];
    
    for (const dep of dependencies) {
      if (this.dependencies.has(dep)) {
        if (this.dfs(dep, [...path])) {
          // Propagate cycle detection
          return true;
        }
      }
    }

    this.recursionStack.delete(module);
    return false;
  }

  /**
   * Find all circular dependencies
   */
  findCircularDependencies() {
    console.log('\n🔍 Searching for circular dependencies...\n');
    
    this.visited.clear();
    this.recursionStack.clear();
    this.circularDependencies = [];

    for (const [module] of this.dependencies) {
      if (!this.visited.has(module)) {
        this.dfs(module);
      }
    }

    return this.circularDependencies;
  }

  /**
   * Generate dependency graph visualization
   */
  generateDependencyGraph() {
    console.log('\n📊 DEPENDENCY GRAPH:');
    console.log('=' .repeat(60));
    
    for (const [module, deps] of this.dependencies) {
      if (deps.length > 0) {
        console.log(`${module}`);
        deps.forEach((dep, index) => {
          const isLast = index === deps.length - 1;
          const connector = isLast ? '└──' : '├──';
          console.log(`  ${connector} ${dep}`);
        });
        console.log('');
      }
    }
  }

  /**
   * Analyze and report findings
   */
  analyze(srcDir = './src') {
    console.log('🔍 CIRCULAR DEPENDENCY ANALYSIS');
    console.log('=' .repeat(60));
    
    const modules = this.buildDependencyMap(srcDir);
    const cycles = this.findCircularDependencies();
    
    if (cycles.length === 0) {
      console.log('✅ NO CIRCULAR DEPENDENCIES FOUND!');
      console.log('   All modules can be loaded safely.');
    } else {
      console.log(`❌ FOUND ${cycles.length} CIRCULAR DEPENDENCIES:`);
      console.log('');
      
      cycles.forEach((cycle, index) => {
        console.log(`🔄 Circular Dependency #${index + 1}:`);
        console.log(`   ${cycle.join(' → ')}`);
        console.log('');
        
        // Suggest resolution strategy
        console.log('💡 Resolution Strategy:');
        if (cycle.length === 2) {
          console.log('   - Direct circular dependency');
          console.log('   - Consider dependency injection or lazy loading');
        } else {
          console.log('   - Indirect circular dependency');
          console.log('   - Extract common functionality to a separate module');
        }
        console.log('');
      });
    }

    this.generateDependencyGraph();
    
    // Module statistics
    console.log('\n📈 MODULE STATISTICS:');
    console.log('=' .repeat(60));
    console.log(`Total modules: ${modules.length}`);
    console.log(`Modules with dependencies: ${Array.from(this.dependencies.values()).filter(deps => deps.length > 0).length}`);
    
    const dependencyCounts = Array.from(this.dependencies.values()).map(deps => deps.length);
    const maxDeps = Math.max(...dependencyCounts);
    const avgDeps = (dependencyCounts.reduce((a, b) => a + b, 0) / dependencyCounts.length).toFixed(1);
    
    console.log(`Maximum dependencies per module: ${maxDeps}`);
    console.log(`Average dependencies per module: ${avgDeps}`);
    
    // Find modules with highest dependencies
    const highDepModules = Array.from(this.dependencies.entries())
      .filter(([, deps]) => deps.length >= 5)
      .sort((a, b) => b[1].length - a[1].length);
    
    if (highDepModules.length > 0) {
      console.log('\n⚠️  MODULES WITH HIGH DEPENDENCIES:');
      highDepModules.forEach(([module, deps]) => {
        console.log(`   ${module}: ${deps.length} dependencies`);
      });
    }
    
    return {
      totalModules: modules.length,
      circularDependencies: cycles.length,
      cycles: cycles,
      highDependencyModules: highDepModules
    };
  }
}

// Run analysis
if (require.main === module) {
  const analyzer = new DependencyAnalyzer();
  analyzer.analyze('./src');
}

module.exports = DependencyAnalyzer;