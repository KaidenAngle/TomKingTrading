@echo off
REM Configuration Restoration Script
REM Use this if critical config files are accidentally deleted

echo ======================================
echo Tom King Trading Framework Config Restore
echo ======================================
echo.

echo Checking for critical files in root directory...
if exist "..\.mcp.json" (
    echo ✓ .mcp.json found
) else (
    echo ✗ .mcp.json MISSING - restoring from backup
    copy "quantconnect\mcp-server-config.json" "..\.mcp.json"
    echo   Restored .mcp.json
)

if exist "..\CLAUDE.md" (
    echo ✓ CLAUDE.md found
) else (
    echo ✗ CLAUDE.md MISSING - restoring from backup
    copy "claude-code\claude-instructions.md" "..\CLAUDE.md"
    echo   Restored CLAUDE.md
)

if exist "..\.claude-settings" (
    echo ✓ .claude-settings found
) else (
    echo ✗ .claude-settings MISSING - restoring from backup
    copy "claude-code\project-settings" "..\.claude-settings"
    echo   Restored .claude-settings
)

if exist "..\quantconnect_mcp_config.json" (
    echo ✓ quantconnect_mcp_config.json found
) else (
    echo ✗ quantconnect_mcp_config.json MISSING - restoring from backup
    copy "quantconnect\standalone-mcp-config.json" "..\quantconnect_mcp_config.json"
    echo   Restored quantconnect_mcp_config.json
)

echo.
echo Configuration check complete!
echo If you need to restore from timestamped backups, check critical\backup_* directories
pause