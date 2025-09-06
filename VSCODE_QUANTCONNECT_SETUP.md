# VS Code QuantConnect Setup Guide

## Fixing "command 'qc-commands.backtest.inactivate' not found" Error

This error occurs when the QuantConnect VS Code extension is not properly installed or configured. Here's how to fix it:

## Solution 1: Use QuantConnect Web Terminal Instead

The easiest solution is to use the QuantConnect web terminal directly:

1. **Open your project in browser:**
   ```
   https://www.quantconnect.com/terminal/24926818
   ```

2. **Run backtest from web interface:**
   - Click the Backtest button (play icon) in the top toolbar
   - View results directly in the browser

## Solution 2: Use LEAN CLI (Recommended for Local Development)

### Install LEAN CLI

1. **Install Python and pip if not already installed**

2. **Install LEAN CLI:**
   ```bash
   pip install lean
   ```

3. **Login to QuantConnect:**
   ```bash
   lean login
   ```
   Enter your QuantConnect credentials when prompted.

### Configure Your Project

1. **Create lean.json in your project root:**
   ```json
   {
     "data-folder": "./data",
     "algorithm-language": "Python",
     "engine-image": "quantconnect/lean:latest"
   }
   ```

2. **Create config.json for local backtesting:**
   ```json
   {
     "cloud-id": 24926818,
     "local-id": 1,
     "project-name": "TomKingTrading",
     "organization-id": "9fdfe971013fafe77700e18267986aa7"
   }
   ```

### Run Backtests via CLI

1. **Cloud Backtest (using QuantConnect servers):**
   ```bash
   lean cloud backtest "TomKingTrading" --open
   ```

2. **Local Backtest (using your computer):**
   ```bash
   lean backtest "TomKingTrading"
   ```

## Solution 3: Fix VS Code Extension (If You Have It)

### Check Extension Installation

1. **Open VS Code Extensions (Ctrl+Shift+X)**
2. **Search for "QuantConnect"**
3. **If not installed, install it**
4. **If installed, try:**
   - Disable and re-enable the extension
   - Uninstall and reinstall
   - Reload VS Code window (Ctrl+Shift+P → "Developer: Reload Window")

### Alternative: Use Command Palette

Instead of clicking buttons, use VS Code Command Palette:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "QuantConnect" to see available commands
3. Look for backtest-related commands

## Solution 4: Direct API Commands

Since we have the MCP server working, you can also run backtests programmatically:

### Using Our Existing Setup

The backtests are already running successfully through our API integration:

1. **Latest Successful Backtest:**
   - ID: `0d0035b467c0b8ec5e697d4bfcf6d69f`
   - Status: Completed Successfully
   - Project: 24926818

2. **To run a new backtest:**
   - Simply ask me to run it
   - I'll use the QuantConnect API directly
   - Results appear instantly

## Recommended Workflow for You

Given that the VS Code extension seems problematic, I recommend:

1. **Edit code locally in VS Code** (as you're doing now)
2. **Use me to upload and run backtests** (I handle the API)
3. **View results in the web terminal** for detailed analysis

This way you get:
- Local editing comfort in VS Code
- Automated backtest execution through me
- Professional results viewing in QuantConnect web interface

## Quick Commands Reference

### Through Me (Claude):
- "Run a backtest" - I'll compile and run it
- "Check backtest status" - I'll get the latest results
- "Upload this file" - I'll sync to QuantConnect cloud

### Through Web Terminal:
- Click Backtest button for quick runs
- Click Results icon to view all backtests
- Use Console for debugging output

### Through LEAN CLI:
```bash
lean cloud push           # Push local changes to cloud
lean cloud pull           # Pull cloud changes to local
lean cloud backtest       # Run backtest on cloud
lean live deploy          # Deploy to paper/live trading
```

## Your Current Setup Status

✅ **What's Working:**
- Project created in QuantConnect (ID: 24926818)
- Files uploaded successfully
- Backtests running via API
- Results accessible

❌ **What's Not Working:**
- VS Code extension commands
- Direct button clicks in VS Code

✅ **Solution:**
- Continue editing in VS Code
- Use me or web terminal for execution
- This is actually more efficient!

---

*Note: The VS Code extension issues are common and don't affect your ability to develop and test strategies. The workflow I've set up for you (edit locally → upload via API → run in cloud) is actually what many professional quants use.*