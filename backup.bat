@echo off
REM Tom King Trading Framework - Automated Backup Script
REM Runs daily to commit all changes with descriptive messages

cd /d D:\OneDrive\Trading\Claude

REM Get current date and time
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "Min=%dt:~10,2%"
set "timestamp=%YY%-%MM%-%DD% %HH%:%Min%"

echo ========================================
echo Tom King Trading Framework - Auto Backup
echo Date: %timestamp%
echo ========================================

REM Check for changes
git status --porcelain > temp_status.txt
set /p changes=<temp_status.txt
del temp_status.txt

if "%changes%"=="" (
    echo No changes detected. Backup not needed.
    exit /b 0
)

echo Changes detected. Creating backup...

REM Add all changes
git add -A

REM Create commit with timestamp
git commit -m "backup: Daily framework state - %timestamp%" -m "Automated backup of all framework changes" -m "- Configuration updates" -m "- Test results" -m "- Trading logs" -m "- Documentation changes"

echo Backup complete!

REM Optional: Push to remote if configured
REM git push origin main 2>nul

echo ========================================
echo Backup successful at %timestamp%
echo ========================================