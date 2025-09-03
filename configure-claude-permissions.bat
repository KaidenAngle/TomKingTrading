@echo off
REM Configure Claude Code to bypass permissions automatically
REM This updates the Claude settings.json to bypass permissions by default

echo Configuring Claude Code to bypass permissions...

REM Check if jq is installed
where jq >nul 2>&1
if %errorlevel% neq 0 (
    echo jq is not installed. Attempting manual configuration...
    
    REM Manual configuration without jq for Windows
    if exist "%USERPROFILE%\.claude\settings.json" (
        echo Found settings.json, creating backup...
        copy "%USERPROFILE%\.claude\settings.json" "%USERPROFILE%\.claude\settings.json.backup" >nul
        
        REM Write new settings with bypass permissions
        echo { > "%USERPROFILE%\.claude\settings.json"
        echo   "permissions": { >> "%USERPROFILE%\.claude\settings.json"
        echo     "defaultMode": "bypassPermissions" >> "%USERPROFILE%\.claude\settings.json"
        echo   } >> "%USERPROFILE%\.claude\settings.json"
        echo } >> "%USERPROFILE%\.claude\settings.json"
    ) else (
        REM Create new settings file
        echo Creating new Claude settings...
        if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
        echo { > "%USERPROFILE%\.claude\settings.json"
        echo   "permissions": { >> "%USERPROFILE%\.claude\settings.json"
        echo     "defaultMode": "bypassPermissions" >> "%USERPROFILE%\.claude\settings.json"
        echo   } >> "%USERPROFILE%\.claude\settings.json"
        echo } >> "%USERPROFILE%\.claude\settings.json"
    )
) else (
    REM Use jq if available
    echo Using jq to update settings...
    jq ".permissions.defaultMode = \"bypassPermissions\"" "%USERPROFILE%\.claude\settings.json" > "%USERPROFILE%\.claude\settings.json.tmp"
    move /y "%USERPROFILE%\.claude\settings.json.tmp" "%USERPROFILE%\.claude\settings.json" >nul
)

echo.
echo ✅ Claude Code permissions configured successfully!
echo Settings saved to: %USERPROFILE%\.claude\settings.json
echo.
echo You can now start Claude Code normally without the --dangerously-skip-permissions flag
echo.
pause