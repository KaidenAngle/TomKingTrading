# Claude Code Launcher Setup

This folder contains several launcher scripts to automatically start Claude Code with the `--dangerously-skip-permissions` flag for the Tom King Trading Framework project.

## Quick Start (Recommended)

### Option 1: Double-Click Launcher
1. **Double-click `start-claude.cmd`** - This will automatically start Claude Code in the correct directory with the permissions flag

### Option 2: Create Desktop Shortcut
1. **Double-click `create-desktop-shortcut.bat`** to create a desktop shortcut
2. **Double-click the "Claude Code (Trading)" shortcut** on your desktop anytime you want to start Claude Code

## Available Scripts

### `start-claude.cmd` (Recommended)
- **Usage**: Double-click to start
- **Features**: 
  - Automatically sets working directory to Tom King Trading project
  - Tries multiple ways to launch Claude Code
  - Provides helpful error messages if Claude Code isn't found
  - Shows clear status messages

### `claude-code.bat` 
- **Usage**: Run from command prompt with `claude-code.bat`
- **Features**: 
  - Passes through any additional arguments
  - Tries both global and npx installation methods

### `claude-code.ps1`
- **Usage**: Run from PowerShell with `.\claude-code.ps1`
- **Features**: 
  - PowerShell version with colored output
  - Same functionality as batch file
  - Better error handling

### `create-desktop-shortcut.bat`
- **Usage**: Double-click once to create desktop shortcut
- **Features**: 
  - Creates "Claude Code (Trading)" shortcut on desktop
  - Shortcut automatically runs start-claude.cmd
  - One-time setup

## Installation Requirements

Ensure Claude Code is installed via one of these methods:

```bash
# Global installation (recommended)
npm install -g @anthropic-ai/claude-code

# Or use with npx (no installation needed)
npx @anthropic-ai/claude-code --dangerously-skip-permissions
```

## Why --dangerously-skip-permissions?

This flag is requested in the project's CLAUDE.md file to avoid constant permission prompts and improve development efficiency for the Tom King Trading Framework.

## Command Line Alternatives

If you prefer command line, you can also create aliases:

### Windows Command Prompt
```cmd
doskey claude-trade=claude --dangerously-skip-permissions $*
```

### PowerShell
```powershell
# Add to your PowerShell profile
function Start-ClaudeTrading { claude --dangerously-skip-permissions @args }
Set-Alias -Name claude-trade -Value Start-ClaudeTrading
```

## Troubleshooting

### "Claude command not found"
- Install Claude Code globally: `npm install -g @anthropic-ai/claude-code`
- Or use npx: `npx @anthropic-ai/claude-code --dangerously-skip-permissions`

### Scripts won't run
- Right-click script → "Run as administrator" if needed
- For PowerShell scripts, you may need to enable execution: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Wrong directory
- All scripts are designed to work from `D:\OneDrive\Trading\Claude`
- If you move the project, update the paths in `create-desktop-shortcut.bat`

## Integration with Development Workflow

These launchers integrate with the Tom King Trading Framework development workflow:
- Automatically starts in the correct project directory
- Applies the permissions flag as specified in CLAUDE.md
- Works with the existing git repository structure
- Compatible with the TomKingTrader/ subdirectory structure

## Security Note

The `--dangerously-skip-permissions` flag reduces security prompts but should only be used in trusted development environments. This is specifically requested for the Tom King Trading Framework project to improve development efficiency.