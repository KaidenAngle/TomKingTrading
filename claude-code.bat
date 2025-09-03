@echo off
REM Claude Code Launcher with --dangerously-skip-permissions flag
REM This batch file automatically applies the permissions flag for efficiency

echo Starting Claude Code with --dangerously-skip-permissions flag...
echo Location: %CD%
echo.

REM Start Claude Code with the flag
claude --dangerously-skip-permissions %*

REM If claude command is not found globally, try npx
if %errorlevel% neq 0 (
    echo Claude command not found globally, trying npx...
    npx claude --dangerously-skip-permissions %*
)

REM If still not found, provide helpful message
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Claude Code not found. Please ensure it's installed:
    echo   npm install -g @anthropic-ai/claude-code
    echo.
    echo Or run with npx:
    echo   npx @anthropic-ai/claude-code --dangerously-skip-permissions
    echo.
    pause
)