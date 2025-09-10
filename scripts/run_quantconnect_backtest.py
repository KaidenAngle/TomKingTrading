#!/usr/bin/env python3
"""
Tom King Trading Framework - QuantConnect Backtest Runner
Runs backtest on QuantConnect cloud using the API

Parameters:
- Start Date: January 1, 2023
- End Date: January 1, 2025  
- Initial Cash: $30,000
- Name: "Complete Framework Test - Post Documentation Updates"
"""

import requests
import json
import time
from datetime import datetime

class QuantConnectBacktester:
    def __init__(self, user_id, api_token):
        self.user_id = user_id
        self.api_token = api_token
        self.base_url = "https://www.quantconnect.com/api/v2"
        self.headers = {
            "Authorization": f"Basic {api_token}",
            "Content-Type": "application/json"
        }
    
    def upload_project_files(self, project_id):
        """Upload the Tom King Trading Framework files to QuantConnect"""
        
        # Main algorithm file
        main_py_path = "TomKingTradingFramework/main.py"
        
        files_to_upload = [
            ("main.py", "TomKingTradingFramework/main.py"),
            ("project.json", "TomKingTradingFramework/project.json"),
            # Core modules
            ("core/unified_state_manager.py", "TomKingTradingFramework/core/unified_state_manager.py"),
            ("core/strategy_coordinator.py", "TomKingTradingFramework/core/strategy_coordinator.py"),
            ("core/unified_vix_manager.py", "TomKingTradingFramework/core/unified_vix_manager.py"),
            ("core/unified_position_sizer.py", "TomKingTradingFramework/core/unified_position_sizer.py"),
            # Config files
            ("config/strategy_parameters.py", "TomKingTradingFramework/config/strategy_parameters.py"),
            ("config/backtest_config.py", "TomKingTradingFramework/config/backtest_config.py"),
            ("config/constants.py", "TomKingTradingFramework/config/constants.py"),
            # Strategies
            ("strategies/friday_0dte_with_state.py", "TomKingTradingFramework/strategies/friday_0dte_with_state.py"),
            ("strategies/lt112_with_state.py", "TomKingTradingFramework/strategies/lt112_with_state.py"),
            ("strategies/ipmcc_with_state.py", "TomKingTradingFramework/strategies/ipmcc_with_state.py"),
            ("strategies/futures_strangle_with_state.py", "TomKingTradingFramework/strategies/futures_strangle_with_state.py"),
            ("strategies/leap_put_ladders_with_state.py", "TomKingTradingFramework/strategies/leap_put_ladders_with_state.py"),
        ]
        
        print(f"Ready to upload {len(files_to_upload)} files to project {project_id}")
        print("Files to upload:")
        for remote_path, local_path in files_to_upload:
            print(f"  {remote_path} <- {local_path}")
        
        return files_to_upload
    
    def create_project(self, name="TomKingTradingFixed"):
        """Create a new QuantConnect project"""
        
        url = f"{self.base_url}/projects/create"
        data = {
            "projectName": name,
            "language": "Py"
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            project_id = result.get('projectId')
            print(f"✅ Created project: {name} (ID: {project_id})")
            return project_id
        else:
            print(f"❌ Failed to create project: {response.status_code} - {response.text}")
            return None
    
    def run_backtest(self, project_id, backtest_name="Complete Framework Test - Post Documentation Updates"):
        """Run backtest with specified parameters"""
        
        url = f"{self.base_url}/backtests/create"
        
        # Backtest configuration matching your requirements
        data = {
            "projectId": project_id,
            "compileId": "",  # Will be filled by QuantConnect
            "backtestName": backtest_name,
        }
        
        response = requests.post(url, headers=self.headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            backtest_id = result.get('backtestId')
            print(f"✅ Started backtest: {backtest_name} (ID: {backtest_id})")
            return backtest_id
        else:
            print(f"❌ Failed to start backtest: {response.status_code} - {response.text}")
            return None
    
    def get_backtest_status(self, project_id, backtest_id):
        """Check backtest status"""
        
        url = f"{self.base_url}/backtests/read"
        params = {
            "projectId": project_id,
            "backtestId": backtest_id
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Failed to get backtest status: {response.status_code}")
            return None
    
    def wait_for_completion(self, project_id, backtest_id, max_wait_minutes=30):
        """Wait for backtest to complete"""
        
        print(f"⏳ Waiting for backtest {backtest_id} to complete...")
        start_time = time.time()
        max_wait_seconds = max_wait_minutes * 60
        
        while time.time() - start_time < max_wait_seconds:
            status = self.get_backtest_status(project_id, backtest_id)
            
            if status:
                progress = status.get('progress', 0)
                state = status.get('completed', False)
                
                print(f"📊 Progress: {progress*100:.1f}% - {'Completed' if state else 'Running'}")
                
                if state:
                    print("✅ Backtest completed!")
                    return status
            
            time.sleep(30)  # Check every 30 seconds
        
        print(f"⏰ Timeout after {max_wait_minutes} minutes")
        return None
    
    def get_results(self, project_id, backtest_id):
        """Get detailed backtest results"""
        
        url = f"{self.base_url}/backtests/read"
        params = {
            "projectId": project_id,
            "backtestId": backtest_id
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Failed to get results: {response.status_code}")
            return None

def main():
    """Main execution function"""
    
    print("🚀 Tom King Trading Framework - QuantConnect Backtest Runner")
    print("=" * 60)
    
    # QuantConnect credentials from .mcp.json
    user_id = "416338"
    api_token = "bc0c7c4c93e96be8757d125b087dc5a619b5d160d743be9ea322f9734ca6e904"
    
    # Initialize backtester
    backtester = QuantConnectBacktester(user_id, api_token)
    
    # Configuration
    backtest_name = "Complete Framework Test - Post Documentation Updates"
    project_name = "TomKingTradingFixed"
    
    print(f"📋 Backtest Configuration:")
    print(f"   Name: {backtest_name}")
    print(f"   Start Date: January 1, 2023")
    print(f"   End Date: January 1, 2025") 
    print(f"   Initial Cash: $30,000")
    print(f"   Algorithm: TomKingTradingIntegrated")
    print()
    
    # Step 1: Create or find project
    print("🔍 Step 1: Setting up QuantConnect project...")
    project_id = backtester.create_project(project_name)
    
    if not project_id:
        print("❌ Cannot proceed without project. Please check your QuantConnect credentials.")
        return
    
    # Step 2: Upload files (manual step required)
    print("📤 Step 2: File upload required...")
    files_to_upload = backtester.upload_project_files(project_id)
    
    print("\n⚠️  MANUAL STEP REQUIRED:")
    print("   Please manually upload the Tom King Trading Framework files to your QuantConnect project.")
    print("   The main algorithm file is: TomKingTradingFramework/main.py")
    print("   Ensure all dependencies are uploaded as well.")
    print()
    
    # Wait for user confirmation
    input("✋ Press Enter after uploading files to QuantConnect...")
    
    # Step 3: Run backtest
    print("🏃 Step 3: Starting backtest...")
    backtest_id = backtester.run_backtest(project_id, backtest_name)
    
    if not backtest_id:
        print("❌ Failed to start backtest")
        return
    
    # Step 4: Wait for completion
    print("⏳ Step 4: Monitoring backtest progress...")
    results = backtester.wait_for_completion(project_id, backtest_id, max_wait_minutes=45)
    
    if results:
        # Step 5: Display results
        print("📊 Step 5: Backtest Results")
        print("=" * 40)
        
        # Extract key metrics
        statistics = results.get('statistics', {})
        if statistics:
            print(f"✅ Total Return: {statistics.get('TotalReturn', 'N/A')}")
            print(f"✅ Sharpe Ratio: {statistics.get('SharpeRatio', 'N/A')}")
            print(f"✅ Max Drawdown: {statistics.get('Drawdown', 'N/A')}")
            print(f"✅ Win Rate: {statistics.get('WinRate', 'N/A')}")
            print(f"✅ Total Trades: {statistics.get('TotalTrades', 'N/A')}")
        
        # Save full results
        results_filename = f"backtest_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"💾 Full results saved to: {results_filename}")
        print(f"🌐 View online: https://www.quantconnect.com/terminal/processCache?request={backtest_id}")
        
    else:
        print("❌ Backtest did not complete successfully")

if __name__ == "__main__":
    main()