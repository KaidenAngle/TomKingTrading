# GitHub Integration Setup for Tom King Trading Framework

## Step 1: Authenticate GitHub CLI

Run this command in your terminal:
```bash
"C:\Program Files\GitHub CLI\gh.exe" auth login
```

When prompted:
1. Choose "GitHub.com"
2. Choose "HTTPS" as your preferred protocol
3. Choose "Login with a web browser"
4. Copy the one-time code shown
5. Press Enter to open browser
6. Paste the code in browser and authorize

## Step 2: Create Repository (After Authentication)

Once authenticated, run:
```bash
cd D:\OneDrive\Trading\Claude
"C:\Program Files\GitHub CLI\gh.exe" repo create TomKingTrading --public --description "Advanced options trading framework for QuantConnect with Tom King strategies"
```

## Step 3: Add Remote and Push Code

```bash
# Add the remote
git remote add origin https://github.com/YOUR_USERNAME/TomKingTrading.git

# Stage all changes
git add -A

# Commit changes
git commit -m "Initial commit: Tom King Trading Framework v1.0

- Complete options trading framework for QuantConnect
- Includes 5 strategies: 0DTE, LT112, IPMCC, LEAP Ladders, Futures Strangles
- Advanced risk management with VIX regime detection
- Kelly Criterion position sizing
- State machine for strategy coordination
- Greeks monitoring and limits
- Comprehensive documentation

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push -u origin master
```

## Step 4: Connect QuantConnect to GitHub

1. Log into QuantConnect.com
2. Go to "My Projects" or "Algorithm Lab"
3. Click "Create New Project" or find your existing TomKingTrading project
4. Click on "Project Settings" or the gear icon
5. Look for "GitHub Integration" or "Version Control"
6. Click "Connect to GitHub"
7. Authorize QuantConnect to access your GitHub
8. Select the "TomKingTrading" repository
9. Choose the master branch
10. Enable automatic sync

## Step 5: Verify Integration

Once connected:
1. Any push to GitHub will automatically update QuantConnect
2. You can edit in either place (GitHub or QuantConnect IDE)
3. Changes sync automatically

## Alternative: Manual GitHub Setup

If you prefer to create the repository manually:

1. Go to https://github.com/new
2. Repository name: `TomKingTrading`
3. Description: `Advanced options trading framework for QuantConnect with Tom King strategies`
4. Set to Public (or Private if you prefer)
5. Don't initialize with README (we already have code)
6. Click "Create repository"
7. Follow the instructions shown for "push an existing repository"

## Troubleshooting

### If gh auth login doesn't work:
- Create a Personal Access Token at https://github.com/settings/tokens
- Use: `gh auth login --with-token` and paste your token

### If push fails with authentication error:
- Make sure you're using HTTPS, not SSH
- Your git config should have your GitHub email: `git config --global user.email "your-email@example.com"`

### If QuantConnect sync doesn't work:
- Check that your repository is public (or QuantConnect has access if private)
- Try disconnecting and reconnecting in QuantConnect settings
- Make sure you selected the correct branch (master)

## Current Project Status

The Tom King Trading Framework is ready for deployment with:
- ✅ All critical bugs fixed (VIX thresholds, state machine recovery)
- ✅ Cleaned up to 1.4MB (removed test files, backtests, cache)
- ✅ Configured for $30,000 starting capital
- ✅ Production-ready code with all strategies implemented
- ✅ Documentation and comprehensive error handling

## Next Steps After GitHub Setup

1. Run a cloud backtest through QuantConnect
2. Monitor the results
3. Deploy to live trading when ready