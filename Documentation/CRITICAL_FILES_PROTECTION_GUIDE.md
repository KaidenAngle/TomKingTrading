# 🚨 CRITICAL FILES - DO NOT DELETE 🚨

## ⚠️ WARNING: These files are ESSENTIAL for the Tom King Trading Framework ⚠️

### 🔴 NEVER DELETE THESE FILES:

#### Claude Code Configuration
- **`.mcp.json`** 🔑 - QuantConnect API access (contains your API token)
- **`CLAUDE.md`** 🧠 - Claude's trading knowledge and methodology  
- **`.claude-settings`** ⚙️ - Project environment and permissions
- **`.claude/settings.json`** 🎛️ - Claude Code behavior settings

#### QuantConnect Integration  
- **`quantconnect_mcp_config.json`** 🔌 - Standalone MCP server config
- **All files in `config/` directory** 📁 - Protected backups and recovery tools

### 🆘 IF ACCIDENTALLY DELETED:
1. **DON'T PANIC** - Run: `config\RESTORE_CONFIG.bat`
2. **Check backups** in `config/` directories
3. **Restart Claude Code** after restoration

### 💡 SAFE TO DELETE/MODIFY:
- Temporary files (*.tmp, *.log, *.cache)
- Backtest results (`backtest-results/`)
- Python cache (`__pycache__/`)
- Node modules (`node_modules/`)

### 🔒 BEFORE MAKING ANY CHANGES:
Run: `config\BACKUP_SCRIPT.bat` to create timestamped backup

---
**This file serves as a visual warning. If you see this, STOP and think before deleting anything!**