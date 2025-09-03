@echo off
REM Quick Claude Code Launcher
REM Double-click this file to start Claude Code with --dangerously-skip-permissions

title Claude Code Launcher

echo ===============================================
echo  Claude Code Launcher for Tom King Trading
echo ===============================================
echo.
echo Starting Claude Code with --dangerously-skip-permissions flag...
echo Working Directory: %CD%
echo.

REM Change to the correct directory
cd /d "D:\OneDrive\Trading\Claude"

REM Try multiple ways to start Claude Code
claude --dangerously-skip-permissions 2>nul
if %errorlevel% equ 0 goto :end

echo Trying with npx...
npx claude --dangerously-skip-permissions 2>nul
if %errorlevel% equ 0 goto :end

echo Trying with full package name...
npx @anthropic-ai/claude-code --dangerously-skip-permissions 2>nul
if %errorlevel% equ 0 goto :end

echo.
echo ERROR: Could not start Claude Code. Please check installation:
echo   npm install -g @anthropic-ai/claude-code
echo.
echo Alternative: Run directly with:
echo   npx @anthropic-ai/claude-code --dangerously-skip-permissions
echo.
pause

:end
echo.
echo Claude Code session ended.
pause