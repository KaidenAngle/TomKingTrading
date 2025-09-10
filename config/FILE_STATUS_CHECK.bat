@echo off
echo ======================================
echo 🚨 CRITICAL FILE STATUS CHECK 🚨
echo ======================================
echo.

set /a missing=0

echo Checking critical files...
echo.

if exist ".mcp.json" (
    echo ✅ .mcp.json - QuantConnect API credentials
) else (
    echo ❌ .mcp.json MISSING! - QuantConnect API access broken
    set /a missing+=1
)

if exist "CLAUDE.md" (
    echo ✅ CLAUDE.md - Trading framework knowledge  
) else (
    echo ❌ CLAUDE.md MISSING! - Claude will lose trading context
    set /a missing+=1
)

if exist ".claude-settings" (
    echo ✅ .claude-settings - Project environment
) else (
    echo ❌ .claude-settings MISSING! - Project settings lost
    set /a missing+=1
)

if exist ".claude\settings.json" (
    echo ✅ .claude\settings.json - Claude Code settings
) else (
    echo ❌ .claude\settings.json MISSING! - Claude Code configuration lost
    set /a missing+=1
)

if exist "config\" (
    echo ✅ config\ directory - Backup and recovery tools
) else (
    echo ❌ config\ directory MISSING! - All backups and recovery tools lost
    set /a missing+=1
)

echo.
echo ======================================
if %missing%==0 (
    echo 🎉 ALL CRITICAL FILES PRESENT
    echo System is ready for trading operations
) else (
    echo 🚨 %missing% CRITICAL FILES MISSING!
    echo RUN: config\RESTORE_CONFIG.bat to recover
    echo DO NOT PROCEED WITH TRADING UNTIL FIXED
)
echo ======================================
pause