#!/usr/bin/env python3
"""
Direct QuantConnect API Upload Script
Bypasses LEAN CLI limitations by uploading files directly via QuantConnect API
"""

import os
import json
import requests
import hashlib
from pathlib import Path
from typing import Dict, List, Optional
import time

class QuantConnectSync:
    """Sync local files directly to QuantConnect using their API"""
    
    def __init__(self, user_id: str, api_token: str, organization_id: Optional[str] = None):
        self.user_id = user_id
        self.api_token = api_token
        self.organization_id = organization_id
        self.base_url = "https://www.quantconnect.com/api/v2"
        self.headers = {
            "Authorization": f"Bearer {user_id}:{api_token}"
        }
        
    def create_project(self, name: str, language: str = "Py") -> Dict:
        """Create a new project in QuantConnect"""
        endpoint = f"{self.base_url}/projects/create"
        data = {
            "name": name,
            "language": language
        }
        if self.organization_id:
            data["organizationId"] = self.organization_id
            
        response = requests.post(endpoint, json=data, headers=self.headers)
        response.raise_for_status()
        result = response.json()
        
        if result.get("success"):
            print(f"[SUCCESS] Created project: {name} (ID: {result['projects'][0]['projectId']})")
            return result['projects'][0]
        else:
            raise Exception(f"Failed to create project: {result.get('errors', 'Unknown error')}")
    
    def get_project(self, project_id: int) -> Optional[Dict]:
        """Get project details"""
        endpoint = f"{self.base_url}/projects/read"
        params = {"projectId": project_id}
        
        response = requests.get(endpoint, params=params, headers=self.headers)
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                return result.get("projects", [{}])[0]
        return None
    
    def update_file(self, project_id: int, file_name: str, content: str) -> bool:
        """Update or create a file in the project"""
        endpoint = f"{self.base_url}/files/update"
        
        # QuantConnect expects file paths relative to project root
        if file_name.startswith("/"):
            file_name = file_name[1:]
            
        data = {
            "projectId": project_id,
            "name": file_name,
            "content": content
        }
        
        response = requests.post(endpoint, json=data, headers=self.headers)
        
        if response.status_code == 200:
            result = response.json()
            if result.get("success"):
                print(f"  [OK] Uploaded: {file_name}")
                return True
            else:
                self.Error(f"  [ERROR] Failed to upload {file_name}: {result.get('errors', 'Unknown')}")
        else:
            self.Error(f"  [ERROR] HTTP {response.status_code} for {file_name}")
            
        return False
    
    def delete_file(self, project_id: int, file_name: str) -> bool:
        """Delete a file from the project"""
        endpoint = f"{self.base_url}/files/delete"
        data = {
            "projectId": project_id,
            "name": file_name
        }
        
        response = requests.post(endpoint, json=data, headers=self.headers)
        return response.status_code == 200 and response.json().get("success", False)
    
    def sync_directory(self, local_path: str, project_id: int, 
                      exclude_patterns: List[str] = None) -> Dict:
        """Sync entire directory to QuantConnect project"""
        
        if exclude_patterns is None:
            exclude_patterns = [
                "__pycache__", ".git", ".vscode", ".idea", 
                "*.pyc", "*.pyo", "*.pyd", ".DS_Store", 
                "backtests", "backtest-results", "*.log",
                ".env", "credentials.json", "api-keys.json"
            ]
        
        local_path = Path(local_path)
        if not local_path.exists():
            raise FileNotFoundError(f"Path not found: {local_path}")
        
        # Get all Python files and config files
        files_to_sync = []
        for ext in ["*.py", "*.json", "*.txt", "*.md"]:
            files_to_sync.extend(local_path.rglob(ext))
        
        # Filter out excluded patterns
        filtered_files = []
        for file_path in files_to_sync:
            skip = False
            for pattern in exclude_patterns:
                if pattern in str(file_path):
                    skip = True
                    break
            if not skip:
                filtered_files.append(file_path)
        
        print(f"\n[INFO] Found {len(filtered_files)} files to sync")
        
        stats = {
            "total": len(filtered_files),
            "uploaded": 0,
            "failed": 0,
            "skipped": 0
        }
        
        # Upload files in batches to avoid rate limiting
        batch_size = 10
        for i in range(0, len(filtered_files), batch_size):
            batch = filtered_files[i:i+batch_size]
            
            for file_path in batch:
                try:
                # Calculate relative path for QuantConnect
                relative_path = file_path.relative_to(local_path)
                qc_path = str(relative_path).replace("\\", "/")

                # Read file content
                with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

                # Skip very large files
                if len(content) > 500000:  # 500KB limit per file
                print(f"  [SKIP] File too large: {qc_path}")
                stats["skipped"] += 1
                continue

                # Upload to QuantConnect
                if self.update_file(project_id, qc_path, content):
                stats["uploaded"] += 1
                else:
                stats["failed"] += 1

                except Exception as e:
                self.Error(f"  [ERROR] Failed to process {file_path}: {str(e")
                stats["failed"] += 1

                # Rate limiting pause between batches
                if i + batch_size < len(filtered_files):
                time.sleep(1)

                print(f"\n[SUMMARY] Upload complete:")
                print(f"  - Uploaded: {stats['uploaded']}/{stats['total']}")
                print(f"  - Failed: {stats['failed']}")
                print(f"  - Skipped: {stats['skipped']}")

                return stats

                def create_and_sync(self, project_name: str, local_path: str) -> Optional[int]:
                """Create project and sync all files"""
                try:
                except Exception as e:
                # Log and handle unexpected exception
                except Exception as e:

                    print(f'Unexpected exception: {e}')

                    raise

            # Log and handle unexpected exception

            print(f'Unexpected exception: {e}')

            raise
# Create the project
            project = self.create_project(project_name)
            project_id = project['projectId']
            
            # Sync files
            print(f"\n[INFO] Starting sync to project ID: {project_id}")
            stats = self.sync_directory(local_path, project_id)
            
            if stats["uploaded"] > 0:
                print(f"\n[SUCCESS] Project ready at: https://www.quantconnect.com/project/{project_id}")
                return project_id
            else:
                self.Log(f"\n[WARNING] No files uploaded successfully"")
                return None
                
        except Exception as e:
            self.Error(f"\n[ERROR] Sync failed: {str(e")
            return None


def main():
    """Main entry point for standalone execution"""
    
    # Load credentials from environment or config
    config_path = Path("D:/OneDrive/Trading/Claude/QuantConnect/.QuantConnect/credentials")
    
    if config_path.exists():
        with open(config_path, 'r') as f:
            creds = json.load(f)
            user_id = creds.get("user-id")
            api_token = creds.get("api-access-token")
            organization_id = creds.get("preferred-organization-id")
    else:
        # Prompt for credentials
        print("QuantConnect credentials not found.")
        user_id = input("Enter User ID: ")
        api_token = input("Enter API Token: ")
        organization_id = input("Enter Organization ID (optional): ") or None
    
    # Initialize sync client
    sync = QuantConnectSync(user_id, api_token, organization_id)
    
    # Project configuration
    project_name = "TomKingTrading-Direct"
    local_path = "D:/OneDrive/Trading/Claude/QuantConnect/TomKingTrading"
    
    print(f"\n=== QuantConnect Direct Upload ===")
    print(f"Project: {project_name}")
    print(f"Source: {local_path}")
    print(f"User: {user_id}")
    
    # Run sync
    project_id = sync.create_and_sync(project_name, local_path)
    
    if project_id:
        print(f"\n[SUCCESS] Deployment complete!")
        print(f"Project URL: https://www.quantconnect.com/project/{project_id}")
        print(f"\nNext steps:")
        print(f"1. Open the project in QuantConnect")
        print(f"2. Click 'Build' to compile")
        print(f"3. Click 'Backtest' to run")
    else:
        self.Error(f"\n[FAILED] Deployment failed. Check errors above."")


if __name__ == "__main__":
    main()