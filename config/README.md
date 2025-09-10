# Critical Configuration Files

## ⚠️ WARNING: DO NOT DELETE OR MODIFY WITHOUT BACKUP

This directory contains critical configuration files for the Tom King Trading Framework. These files are essential for:
- QuantConnect API access
- Claude Code functionality
- MCP server connections
- Project settings

## Directory Structure

### `/critical/`
- Contains essential configuration files that should never be deleted
- Backed up versions of all critical settings

### `/claude-code/`
- Claude Code specific configurations
- Project settings and instructions
- Environment variables and permissions

### `/quantconnect/`
- QuantConnect MCP server configurations
- API credentials and connection settings
- Standalone and project-embedded configs

## File Descriptions

### QuantConnect Files
- `mcp-server-config.json` - MCP server configuration (copy of .mcp.json)
- `standalone-mcp-config.json` - Standalone MCP config for manual startup
- Contains your QuantConnect User ID and API token

### Claude Code Files
- `claude-instructions.md` - Main CLAUDE.md file with framework knowledge
- `project-settings` - Project-level settings and environment variables
- `settings.json` - Claude Code behavior configuration (in .claude/ directory)

## Backup Strategy

Before making ANY changes:
1. Copy current configs to `/critical/` with timestamp
2. Test changes in development
3. Keep working backups of all configurations

## Recovery

If configurations are accidentally deleted:
1. Check `/critical/` for backups
2. Copy from this directory back to root locations
3. Restart Claude Code to reload configurations

## Security Notes

- API tokens are stored in these files
- Keep this directory in private repositories only
- Never commit API keys to public repos
- Use environment variables for sensitive data when possible