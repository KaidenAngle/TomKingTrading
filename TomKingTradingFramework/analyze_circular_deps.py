#!/usr/bin/env python
"""
Circular Dependency Analyzer for Tom King Trading Framework
Identifies circular dependencies between modules for Phase 6 event bus resolution
"""

import ast
import os
from collections import defaultdict, deque
from pathlib import Path

def extract_imports_from_file(file_path):
    """Extract local imports from a Python file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        tree = ast.parse(content)
        imports = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):
                if node.module and (node.module.startswith(('core.', 'strategies.', 'risk.', 'helpers.'))):
                    imports.append(node.module)
            elif isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.startswith(('core.', 'strategies.', 'risk.', 'helpers.')):
                        imports.append(alias.name)
        
        return imports
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return []

def find_circular_dependencies():
    """Find circular dependencies in the framework"""
    imports_map = {}
    
    # Walk through all Python files
    for root, dirs, files in os.walk('.'):
        # Skip non-framework directories
        if any(skip in root for skip in ['__pycache__', 'Documentation', '.git', 'tests']):
            continue
            
        for file in files:
            if file.endswith('.py') and not file.startswith('test_'):
                file_path = os.path.join(root, file)
                
                # Get module name from path
                module_path = file_path.replace('.\\', '').replace('.py', '').replace('\\', '.')
                if module_path.startswith('.'):
                    module_path = module_path[1:]
                
                imports = extract_imports_from_file(file_path)
                if imports:
                    imports_map[module_path] = imports
    
    return imports_map

def detect_circles(imports_map):
    """Detect circular dependencies using DFS"""
    circles = []
    
    def dfs(module, path, visited):
        if module in path:
            # Found a cycle
            cycle_start = path.index(module)
            cycle = path[cycle_start:] + [module]
            circles.append(cycle)
            return
        
        if module in visited or module not in imports_map:
            return
            
        visited.add(module)
        new_path = path + [module]
        
        for imported in imports_map.get(module, []):
            dfs(imported, new_path, visited.copy())
    
    # Check each module for circular dependencies
    for module in imports_map:
        dfs(module, [], set())
    
    # Remove duplicates
    unique_circles = []
    for circle in circles:
        if circle not in unique_circles:
            unique_circles.append(circle)
    
    return unique_circles

def prioritize_circles(circles, imports_map):
    """Prioritize circular dependencies by impact"""
    priority_modules = {
        'core.': 10,  # Highest priority
        'strategies.': 8,
        'risk.': 9,
        'helpers.': 6
    }
    
    scored_circles = []
    for circle in circles:
        score = 0
        components = len(circle)
        
        # Score based on module types involved
        for module in circle:
            for prefix, points in priority_modules.items():
                if module.startswith(prefix):
                    score += points
                    break
        
        # Bonus for involving core managers
        manager_keywords = ['manager', 'unified', 'coordinator', 'state']
        for module in circle:
            if any(keyword in module.lower() for keyword in manager_keywords):
                score += 5
        
        scored_circles.append((score, components, circle))
    
    # Sort by score (descending) then by components (ascending)
    scored_circles.sort(key=lambda x: (-x[0], x[1]))
    
    return scored_circles

if __name__ == "__main__":
    print("Tom King Trading Framework - Circular Dependency Analysis")
    print("=" * 60)
    
    imports_map = find_circular_dependencies()
    circles = detect_circles(imports_map)
    
    print(f"\nTotal modules analyzed: {len(imports_map)}")
    print(f"Circular dependencies found: {len(circles)}")
    
    if circles:
        print("\nCIRCULAR DEPENDENCIES (sorted by priority):")
        print("-" * 50)
        
        prioritized = prioritize_circles(circles, imports_map)
        
        for i, (score, components, circle) in enumerate(prioritized[:10], 1):
            print(f"\n{i}. PRIORITY SCORE: {score} (Components: {components})")
            cycle_str = " -> ".join(circle)
            print(f"   CYCLE: {cycle_str}")
            
            # Show what each module imports from the next
            print("   DEPENDENCIES:")
            for j in range(len(circle) - 1):
                current = circle[j]
                next_module = circle[j + 1]
                if current in imports_map and next_module in imports_map[current]:
                    print(f"     {current} imports {next_module}")
    
    print(f"\n\nModule Import Summary:")
    print("-" * 30)
    
    # Show most connected modules
    import_counts = defaultdict(int)
    for module, imports in imports_map.items():
        import_counts[module] = len(imports)
    
    sorted_modules = sorted(import_counts.items(), key=lambda x: x[1], reverse=True)
    
    print("Most connected modules (potential circular dependency sources):")
    for module, count in sorted_modules[:10]:
        print(f"  {module}: {count} imports")
        if module in imports_map:
            print(f"    -> {', '.join(imports_map[module][:5])}")