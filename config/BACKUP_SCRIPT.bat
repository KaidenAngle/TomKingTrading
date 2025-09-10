@echo off
REM Critical Configuration Backup Script
REM Run this before making any changes to configurations

set TIMESTAMP=%date:~-4,4%-%date:~-10,2%-%date:~-7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_DIR=critical\backup_%TIMESTAMP%

echo Creating backup: %BACKUP_DIR%
mkdir "%BACKUP_DIR%"

REM Backup critical files from root
copy "..\.mcp.json" "%BACKUP_DIR%\mcp.json" 2>nul
copy "..\CLAUDE.md" "%BACKUP_DIR%\CLAUDE.md" 2>nul
copy "..\.claude-settings" "%BACKUP_DIR%\claude-settings" 2>nul
copy "..\quantconnect_mcp_config.json" "%BACKUP_DIR%\quantconnect_mcp_config.json" 2>nul

REM Backup .claude directory
xcopy "..\.claude\*" "%BACKUP_DIR%\.claude\" /E /I /Q 2>nul

REM Backup current config directory
xcopy "claude-code\*" "%BACKUP_DIR%\config\claude-code\" /E /I /Q 2>nul
xcopy "quantconnect\*" "%BACKUP_DIR%\config\quantconnect\" /E /I /Q 2>nul

echo Backup created successfully: config\%BACKUP_DIR%
echo.
echo Files backed up:
dir "%BACKUP_DIR%" /B