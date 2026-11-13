@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Installs (or updates) the AsciiDoc Preview Style extension into VS Code.
rem Place this file next to vscode-asciidoc-preview-style-v<version>.vsix and run it.

set "SCRIPT_DIR=%~dp0"
set "VSIX_COUNT=0"
set "VSIX_FILE="

for /f "delims=" %%F in ('dir /b /a-d "%SCRIPT_DIR%vscode-asciidoc-preview-style-v*.vsix" 2^>nul') do (
    set /a VSIX_COUNT+=1
    set "VSIX_FILE=%%F"
)

if "%VSIX_COUNT%"=="0" (
    echo ERROR: No vscode-asciidoc-preview-style-v*.vsix was found in "%SCRIPT_DIR%".
    exit /b 1
)
if not "%VSIX_COUNT%"=="1" (
    echo ERROR: %VSIX_COUNT% VSIX files were found in "%SCRIPT_DIR%". Keep only one and run again:
    dir /b /a-d "%SCRIPT_DIR%vscode-asciidoc-preview-style-v*.vsix"
    exit /b 1
)

where code >nul 2>&1
if errorlevel 1 (
    echo ERROR: The "code" command was not found on PATH.
    echo Install VS Code and enable "Add to PATH", or run "Shell Command: Install 'code' command in PATH" from VS Code.
    exit /b 1
)

echo Installing %VSIX_FILE% ...
call code --install-extension "%SCRIPT_DIR%%VSIX_FILE%" --force
if not "%ERRORLEVEL%"=="0" (
    echo ERROR: Failed to install %VSIX_FILE%.
    exit /b 1
)

echo Installed %VSIX_FILE%.
echo Reload VS Code windows to activate the new version.
exit /b 0
