#!/usr/bin/env python3
"""
Deploy Complete TomKingTradingFramework to QuantConnect
Systematically deploy all 83 Python files to QuantConnect project 24998303
"""

import os
import json
import requests
from pathlib import Path

# Framework directory
FRAMEWORK_DIR = Path("TomKingTradingFramework")
PROJECT_ID = 24998303

def get_all_python_files():
    """Get all Python files in the framework"""
    files = []
    for root, dirs, filenames in os.walk(FRAMEWORK_DIR):
        for filename in filenames:
            if filename.endswith('.py'):
                file_path = Path(root) / filename
                relative_path = file_path.relative_to(FRAMEWORK_DIR)
                files.append({
                    'full_path': file_path,
                    'relative_path': str(relative_path).replace('\\', '/'),
                    'name': filename
                })
    return sorted(files, key=lambda x: x['relative_path'])

def read_file_content(file_path):
    """Read file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None

def main():
    """Main deployment script"""
    
    print("=== TOM KING TRADING FRAMEWORK DEPLOYMENT ===")
    print(f"Target Project: {PROJECT_ID}")
    print(f"Framework Directory: {FRAMEWORK_DIR.absolute()}")
    
    # Get all Python files
    python_files = get_all_python_files()
    print(f"Found {len(python_files)} Python files to deploy")
    
    # List all files for review
    print("\nFiles to deploy:")
    for i, file_info in enumerate(python_files, 1):
        print(f"  {i:2d}. {file_info['relative_path']}")
    
    # Prepare deployment instructions
    deployment_commands = []
    
    for file_info in python_files:
        content = read_file_content(file_info['full_path'])
        if content is None:
            continue
            
        # Create the deployment command
        cmd = {
            'action': 'create_or_update_file',
            'name': file_info['relative_path'],
            'content': content,
            'size': len(content)
        }
        deployment_commands.append(cmd)
    
    # Save deployment plan
    deployment_plan = {
        'project_id': PROJECT_ID,
        'total_files': len(deployment_commands),
        'commands': deployment_commands
    }
    
    with open('deployment_plan.json', 'w') as f:
        json.dump(deployment_plan, f, indent=2)
    
    print(f"\nDeployment plan created: deployment_plan.json")
    print(f"Total files: {len(deployment_commands)}")
    print(f"Total size: {sum(cmd['size'] for cmd in deployment_commands):,} characters")
    
    # Show breakdown by directory
    dir_counts = {}
    for file_info in python_files:
        dir_name = str(Path(file_info['relative_path']).parent)
        if dir_name == '.':
            dir_name = 'root'
        dir_counts[dir_name] = dir_counts.get(dir_name, 0) + 1
    
    print("\nBreakdown by directory:")
    for dir_name, count in sorted(dir_counts.items()):
        print(f"  {dir_name}: {count} files")
    
    return deployment_commands

if __name__ == '__main__':
    commands = main()