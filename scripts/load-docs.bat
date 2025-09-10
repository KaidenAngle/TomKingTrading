@echo off
REM Tom King Trading Framework Documentation Loader
REM Creates a context file that directs Claude to read essential documentation

set TEMP_FILE=%TEMP%\claude-tom-king-context-%RANDOM%.md
set PROJECT_DIR=D:\OneDrive\Trading\Claude

echo === CLAUDE: READ THIS FILE IMMEDIATELY FOR STARTUP CONTEXT === > "%TEMP_FILE%"
echo. >> "%TEMP_FILE%"
echo This file was auto-generated on startup to provide essential context. >> "%TEMP_FILE%"
echo READ ALL DOCUMENTATION in: D:\OneDrive\Trading\Claude\Documentation >> "%TEMP_FILE%"
echo. >> "%TEMP_FILE%"
echo CRITICAL FILES TO READ: >> "%TEMP_FILE%"
echo - Documentation/CRITICAL_DO_NOT_CHANGE.md >> "%TEMP_FILE%"
echo - Documentation/TROUBLESHOOTING_GUIDE.md >> "%TEMP_FILE%"
echo - Documentation/Development/implementation-audit-protocol.md >> "%TEMP_FILE%"
echo - Documentation/Development/quick-reference.md >> "%TEMP_FILE%"
echo. >> "%TEMP_FILE%"
echo === METHODOLOGY REMINDER === >> "%TEMP_FILE%"
echo ALWAYS use AUDIT-BEFORE-ASSUME methodology before making any changes. >> "%TEMP_FILE%"
echo Search existing implementations FIRST before adding new code. >> "%TEMP_FILE%"
echo. >> "%TEMP_FILE%"
echo === CONTEXT FILE LOCATION === >> "%TEMP_FILE%"

echo 📚 CLAUDE CONTEXT FILE CREATED: %TEMP_FILE%
echo 🎯 Please read this file immediately for Tom King Trading Framework context