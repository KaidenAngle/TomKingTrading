@echo off
REM Create desktop shortcut for Claude Code launcher

set "shortcut_name=Claude Code (Trading)"
set "target_script=%~dp0start-claude.cmd"
set "desktop=%USERPROFILE%\Desktop"

echo Creating desktop shortcut: %shortcut_name%
echo Target: %target_script%
echo Desktop: %desktop%
echo.

REM Create VBS script to create shortcut
echo Set oWS = WScript.CreateObject("WScript.Shell") > "%temp%\CreateShortcut.vbs"
echo sLinkFile = "%desktop%\%shortcut_name%.lnk" >> "%temp%\CreateShortcut.vbs"
echo Set oLink = oWS.CreateShortcut(sLinkFile) >> "%temp%\CreateShortcut.vbs"
echo oLink.TargetPath = "%target_script%" >> "%temp%\CreateShortcut.vbs"
echo oLink.WorkingDirectory = "%~dp0" >> "%temp%\CreateShortcut.vbs"
echo oLink.Description = "Launch Claude Code with --dangerously-skip-permissions for Tom King Trading Framework" >> "%temp%\CreateShortcut.vbs"
echo oLink.IconLocation = "cmd.exe,0" >> "%temp%\CreateShortcut.vbs"
echo oLink.Save >> "%temp%\CreateShortcut.vbs"

REM Execute VBS script
cscript //nologo "%temp%\CreateShortcut.vbs"

REM Clean up
del "%temp%\CreateShortcut.vbs"

echo.
echo Desktop shortcut created successfully!
echo You can now double-click "%shortcut_name%" on your desktop to start Claude Code.
echo.
pause