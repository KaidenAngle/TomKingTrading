# Tom King Trading Framework - Automated Backup Script (PowerShell)
# Enhanced version with detailed change tracking and smart commit messages

$ErrorActionPreference = "Stop"

# Change to project directory
Set-Location "D:\OneDrive\Trading\Claude"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Tom King Trading Framework - Auto Backup" -ForegroundColor Green
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Check for changes
$status = git status --porcelain

if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes detected. Backup not needed." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nChanges detected:" -ForegroundColor Green
Write-Host $status

# Analyze changes to create smart commit message
$modifiedFiles = @()
$addedFiles = @()
$deletedFiles = @()

foreach ($line in $status -split "`n") {
    if ($line -match "^\s*M\s+(.+)") { $modifiedFiles += $matches[1] }
    elseif ($line -match "^\s*A\s+(.+)") { $addedFiles += $matches[1] }
    elseif ($line -match "^\s*D\s+(.+)") { $deletedFiles += $matches[1] }
    elseif ($line -match "^\?\?\s+(.+)") { $addedFiles += $matches[1] }
}

# Build commit message based on changes
$commitTitle = "backup: Framework updates - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
$commitBody = @()

# Categorize changes
$hasConfig = $modifiedFiles + $addedFiles | Where-Object { $_ -match "config|\.env|settings" }
$hasTests = $modifiedFiles + $addedFiles | Where-Object { $_ -match "test|spec" }
$hasAPI = $modifiedFiles + $addedFiles | Where-Object { $_ -match "api|tastyTrade" }
$hasRisk = $modifiedFiles + $addedFiles | Where-Object { $_ -match "risk|position|correlation" }
$hasDocs = $modifiedFiles + $addedFiles | Where-Object { $_ -match "\.md$|\.txt$" }

if ($hasConfig) { $commitBody += "- Configuration updates" }
if ($hasTests) { $commitBody += "- Test suite modifications" }
if ($hasAPI) { $commitBody += "- API integration changes" }
if ($hasRisk) { $commitBody += "- Risk management adjustments" }
if ($hasDocs) { $commitBody += "- Documentation updates" }

if ($addedFiles.Count -gt 0) { 
    $commitBody += "- Added $($addedFiles.Count) new file(s)" 
}
if ($modifiedFiles.Count -gt 0) { 
    $commitBody += "- Modified $($modifiedFiles.Count) file(s)" 
}
if ($deletedFiles.Count -gt 0) { 
    $commitBody += "- Removed $($deletedFiles.Count) file(s)" 
}

# Add all changes
Write-Host "`nStaging changes..." -ForegroundColor Yellow
git add -A

# Create commit
$fullCommitMessage = "$commitTitle`n`n$($commitBody -join "`n")"
git commit -m $commitTitle -m "$($commitBody -join "`n")" | Out-Host

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Backup successful!" -ForegroundColor Green
Write-Host "Commit: $commitTitle" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

# Show last commit
Write-Host "`nLast commit:" -ForegroundColor Cyan
git log --oneline -1

# Optional: Push to remote if available
$remotes = git remote
if ($remotes) {
    Write-Host "`nPushing to remote..." -ForegroundColor Yellow
    try {
        git push origin main 2>&1 | Out-Host
        Write-Host "Successfully pushed to remote!" -ForegroundColor Green
    } catch {
        Write-Host "Could not push to remote (may not be configured)" -ForegroundColor Yellow
    }
}