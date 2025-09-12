# 🚨 CRITICAL FILES - DO NOT DELETE 🚨

## ⚠️ READ THIS FIRST BEFORE MODIFYING ANYTHING ⚠️

This directory contains **PRODUCTION TRADING SYSTEM** files that are essential for:
- QuantConnect API access ($$ YOUR MONEY $$)
- Claude Code functionality  
- Trading algorithm execution
- Configuration management

### 🔴 NEVER DELETE THESE FILES:

#### Claude Code Configuration
- **`.mcp.json`** 🔑 - QuantConnect API access (contains your API token)
- **`CLAUDE.md`** 🧠 - Claude's trading knowledge and methodology  
- **`.claude-settings`** ⚙️ - Project environment and permissions
- **`.claude/settings.json`** 🎛️ - Claude Code behavior settings

#### QuantConnect Integration  
- **`quantconnect_mcp_config.json`** 🔌 - Standalone MCP server config
- **All files in `config/` directory** 📁 - Protected backups and recovery tools

### 🟡 BEFORE ANY CHANGES:
```bash
# Create backup first!
config\BACKUP_SCRIPT.bat
```

### 🆘 IF ACCIDENTALLY DELETED:
1. **DON'T PANIC** - Run: `config\RESTORE_CONFIG.bat`
2. **Check backups** in `config/` directories
3. **Restart Claude Code** after restoration

### 💡 SAFE TO DELETE/MODIFY:
- Temporary files (*.tmp, *.log, *.cache)
- Backtest results (`backtest-results/`)
- Python cache (`__pycache__/`)
- Node modules (`node_modules/`)

### 📖 FOR MORE INFO:
- Read `config\README.md` for detailed explanations
- Check `Documentation/` for framework documentation
- See `config\ORGANIZATION_SUMMARY.md` for recent changes

---
**🎯 Goal: £35k → £80k transformation through systematic trading**  
**🔒 Protection: These files make that possible - handle with care!**

**This file serves as a visual warning. If you see this, STOP and think before deleting anything!**