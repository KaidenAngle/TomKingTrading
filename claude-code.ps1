# Claude Code PowerShell Launcher with --dangerously-skip-permissions flag
# This PowerShell script automatically applies the permissions flag for efficiency

Write-Host "Starting Claude Code with --dangerously-skip-permissions flag..." -ForegroundColor Green
Write-Host "Location: $(Get-Location)" -ForegroundColor Cyan
Write-Host ""

try {
    # Try to run claude command directly
    & claude --dangerously-skip-permissions @args
} catch {
    Write-Host "Claude command not found globally, trying npx..." -ForegroundColor Yellow
    try {
        # Try with npx
        & npx claude --dangerously-skip-permissions @args
    } catch {
        Write-Host ""
        Write-Host "ERROR: Claude Code not found. Please ensure it's installed:" -ForegroundColor Red
        Write-Host "  npm install -g @anthropic-ai/claude-code" -ForegroundColor White
        Write-Host ""
        Write-Host "Or run with npx:" -ForegroundColor White
        Write-Host "  npx @anthropic-ai/claude-code --dangerously-skip-permissions" -ForegroundColor White
        Write-Host ""
        Read-Host "Press Enter to continue"
    }
}