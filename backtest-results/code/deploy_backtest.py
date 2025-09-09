#!/usr/bin/env python3
"""
Deploy Tom King Trading System Backtest to QuantConnect
Handles project upload, compilation, and backtest execution
"""

import requests
import json
import time
import os
import sys
from datetime import datetime
from pathlib import Path

class QuantConnectDeployer:
    """Deploy and run backtests on QuantConnect Cloud"""
    
    def __init__(self):
        # Load config
        config_path = Path(__file__).parent / "config.json"
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.project_id = self.config.get('cloud-id', 24926818)
        self.api_token = os.environ.get('QC_API_TOKEN', '')
        
        if not self.api_token:
            print("ERROR: QC_API_TOKEN environment variable not set")
            print("Get your token from: https://www.quantconnect.com/account")
            sys.exit(1)
        
        self.base_url = "https://www.quantconnect.com/api/v2"
        self.headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
    
    def compile_project(self):
        """Compile the project on QuantConnect"""
        print(f"Compiling project {self.project_id}...")
        
        url = f"{self.base_url}/compile/create"
        payload = {'projectId': self.project_id}
        
        response = requests.post(url, json=payload, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            compile_id = data.get('compileId')
            print(f"Compilation started: {compile_id}")
            return compile_id
        else:
            print(f"Compilation failed: {response.text}")
            return None
    
    def check_compile_status(self, compile_id):
        """Check compilation status"""
        url = f"{self.base_url}/compile/read"
        params = {
            'projectId': self.project_id,
            'compileId': compile_id
        }
        
        response = requests.get(url, params=params, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            state = data.get('state')
            
            if state == 'BuildSuccess':
                print("✅ Compilation successful!")
                return True
            elif state == 'BuildError':
                print("❌ Compilation failed!")
                print(f"Errors: {data.get('logs', '')}")
                return False
            else:
                print(f"Compilation state: {state}")
                return None
        else:
            print(f"Status check failed: {response.text}")
            return False
    
    def create_backtest(self, compile_id, name=None):
        """Create and run a backtest"""
        if not name:
            name = f"Tom King System Test - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        print(f"Creating backtest: {name}")
        
        url = f"{self.base_url}/backtests/create"
        payload = {
            'projectId': self.project_id,
            'compileId': compile_id,
            'backtestName': name,
            'parameters': {
                'starting-cash': '44500',
                'enable-defensive-mode': 'true',
                'max-correlated-positions': '3',
                'enable-august-2024-protection': 'true'
            }
        }
        
        response = requests.post(url, json=payload, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            backtest_id = data.get('backtestId')
            print(f"Backtest created: {backtest_id}")
            return backtest_id
        else:
            print(f"Backtest creation failed: {response.text}")
            return None
    
    def check_backtest_status(self, backtest_id):
        """Check backtest status and get results"""
        url = f"{self.base_url}/backtests/read"
        params = {
            'projectId': self.project_id,
            'backtestId': backtest_id
        }
        
        response = requests.get(url, params=params, headers=self.headers)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('completed'):
                print("\n✅ BACKTEST COMPLETE!")
                self.display_results(data)
                return True
            else:
                progress = data.get('progress', 0)
                print(f"Progress: {progress:.1f}%")
                return False
        else:
            print(f"Status check failed: {response.text}")
            return False
    
    def display_results(self, backtest_data):
        """Display backtest results"""
        print("\n" + "=" * 80)
        print("BACKTEST RESULTS - TOM KING TRADING SYSTEM")
        print("=" * 80)
        
        result = backtest_data.get('result', {})
        statistics = result.get('Statistics', {})
        
        # Key metrics
        print("\n📊 PERFORMANCE METRICS:")
        print(f"  Total Return: {statistics.get('Total Trades', 'N/A')}")
        print(f"  Annual Return: {statistics.get('Annual Return', 'N/A')}")
        print(f"  Sharpe Ratio: {statistics.get('Sharpe Ratio', 'N/A')}")
        print(f"  Max Drawdown: {statistics.get('Drawdown', 'N/A')}")
        print(f"  Win Rate: {statistics.get('Win Rate', 'N/A')}")
        
        # Trading statistics
        print("\n📈 TRADING STATISTICS:")
        print(f"  Total Trades: {statistics.get('Total Trades', 'N/A')}")
        print(f"  Average Win: {statistics.get('Average Win', 'N/A')}")
        print(f"  Average Loss: {statistics.get('Average Loss', 'N/A')}")
        print(f"  Profit Factor: {statistics.get('Profit Factor', 'N/A')}")
        
        # Risk metrics
        print("\n🛡️ RISK METRICS:")
        print(f"  Value at Risk: {statistics.get('Value at Risk', 'N/A')}")
        print(f"  Beta: {statistics.get('Beta', 'N/A')}")
        print(f"  Information Ratio: {statistics.get('Information Ratio', 'N/A')}")
        
        # Tom King specific targets
        print("\n🎯 TOM KING TARGETS:")
        
        # Check monthly return (target 8-9%)
        annual_return = float(statistics.get('Annual Return', '0').replace('%', ''))
        monthly_return = annual_return / 12
        target_status = "✅" if monthly_return >= 8 else "⚠️"
        print(f"  {target_status} Monthly Return: {monthly_return:.1f}% (Target: 8-9%)")
        
        # Check win rate
        win_rate = float(statistics.get('Win Rate', '0').replace('%', ''))
        win_status = "✅" if win_rate >= 70 else "⚠️"
        print(f"  {win_status} Win Rate: {win_rate:.1f}% (Target: 70%+)")
        
        # Check drawdown
        drawdown = float(statistics.get('Drawdown', '0').replace('%', ''))
        dd_status = "✅" if abs(drawdown) < 20 else "❌"
        print(f"  {dd_status} Max Drawdown: {drawdown:.1f}% (Limit: <20%)")
        
        # Check Sharpe
        sharpe = float(statistics.get('Sharpe Ratio', '0'))
        sharpe_status = "✅" if sharpe > 2 else "⚠️"
        print(f"  {sharpe_status} Sharpe Ratio: {sharpe:.2f} (Target: >2.0)")
        
        print("\n" + "=" * 80)
        
        # Overall assessment
        if monthly_return >= 8 and win_rate >= 70 and abs(drawdown) < 20:
            print("✅ SYSTEM MEETS TOM KING PERFORMANCE TARGETS!")
        else:
            print("⚠️ SYSTEM NEEDS OPTIMIZATION TO MEET TARGETS")
        
        print("=" * 80)
    
    def run_full_deployment(self):
        """Run complete deployment and backtest"""
        print("\n🚀 DEPLOYING TOM KING TRADING SYSTEM TO QUANTCONNECT")
        print("=" * 80)
        
        # Step 1: Compile
        compile_id = self.compile_project()
        if not compile_id:
            return False
        
        # Wait for compilation
        max_attempts = 30
        for i in range(max_attempts):
            time.sleep(2)
            status = self.check_compile_status(compile_id)
            if status is True:
                break
            elif status is False:
                return False
        
        # Step 2: Create backtest
        backtest_id = self.create_backtest(compile_id)
        if not backtest_id:
            return False
        
        # Step 3: Wait for backtest completion
        print("\nRunning backtest...")
        max_wait = 600  # 10 minutes max
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            time.sleep(5)
            if self.check_backtest_status(backtest_id):
                return True
        
        print("⚠️ Backtest timed out")
        return False

def main():
    """Main execution"""
    deployer = QuantConnectDeployer()
    
    # Run different backtest scenarios
    scenarios = [
        {
            'name': 'Full Year 2024',
            'start': '2024-01-01',
            'end': '2024-12-31'
        },
        {
            'name': 'August 2024 Crash Test',
            'start': '2024-07-01',
            'end': '2024-09-01'
        },
        {
            'name': 'High VIX Period',
            'start': '2024-03-01',
            'end': '2024-04-30'
        }
    ]
    
    print("\n📋 BACKTEST SCENARIOS:")
    for i, scenario in enumerate(scenarios, 1):
        print(f"  {i}. {scenario['name']} ({scenario['start']} to {scenario['end']})")
    
    choice = input("\nSelect scenario (1-3) or 'all' for all scenarios: ")
    
    if choice.lower() == 'all':
        for scenario in scenarios:
            print(f"\n\n{'='*80}")
            print(f"RUNNING: {scenario['name']}")
            print('='*80)
            deployer.run_full_deployment()
    else:
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(scenarios):
                scenario = scenarios[idx]
                print(f"\nRunning: {scenario['name']}")
                deployer.run_full_deployment()
            else:
                print("Invalid choice")
        except ValueError:
            print("Invalid input")

if __name__ == "__main__":
    main()