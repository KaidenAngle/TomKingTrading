# Critical File Protection Guide

## Overview
Essential files for Tom King Trading Framework are protected with backups and recovery tools.

## Critical Files (DO NOT DELETE)
- **`.mcp.json`** - QuantConnect API credentials
- **`CLAUDE.md`** - Trading framework knowledge  
- **`.claude-settings`** - Project environment
- **`.claude/settings.json`** - Claude Code settings

## Protection Measures
- ✅ Backups in `config/` directory
- ✅ Recovery script: `config/RESTORE_CONFIG.bat`
- ✅ Status check: `config/FILE_STATUS_CHECK.bat`

## Quick Recovery
If files are deleted: Run `config\RESTORE_CONFIG.bat`

## Documentation
See `config/README.md` for complete details.