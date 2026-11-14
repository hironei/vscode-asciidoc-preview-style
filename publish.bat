@echo off
setlocal EnableExtensions
rem Build the release package: package (.vsix) in a staging folder -> artifact\.
rem Usage: publish.bat          build and package
rem        publish.bat clean    remove leftover local staging output only
rem This script does not run any Git or GitHub operation.

set "ROOT_DIR=%~dp0"
pushd "%ROOT_DIR%" || exit /b 1

set "OUT_DIR=%CD%\artifact"
set "STAGE_DIR=%CD%\artifact\.staging"

if /i "%~1"=="clean" (
  if not "%~2"=="" goto :usage
  goto :clean
)
if not "%~1"=="" goto :usage

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node was not found in PATH.
  popd
  exit /b 1
)
where npx >nul 2>&1
if errorlevel 1 (
  echo ERROR: npx was not found in PATH.
  popd
  exit /b 1
)

for /f "usebackq delims=" %%V in (`node -p "require('./package.json').version"`) do set "VERSION=%%V"
for /f "usebackq delims=" %%N in (`node -p "require('./package.json').name"`) do set "NAME=%%N"
if not defined VERSION (
  echo ERROR: could not read version from package.json.
  popd
  exit /b 1
)
if not defined NAME (
  echo ERROR: could not read name from package.json.
  popd
  exit /b 1
)

rem Build into a dedicated staging folder so the previous good artifact survives a failed build.
if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
if exist "%STAGE_DIR%" (
  echo ERROR: failed to clean "%STAGE_DIR%".
  popd
  exit /b 1
)
mkdir "%STAGE_DIR%" || (
  popd
  exit /b 1
)

set "VSIX_NAME=%NAME%-v%VERSION%.vsix"
call npx --yes @vscode/vsce package --out "%STAGE_DIR%\%VSIX_NAME%"
if errorlevel 1 (
  echo ERROR: vsce package failed.
  popd
  exit /b 1
)
if not exist "%STAGE_DIR%\%VSIX_NAME%" (
  echo ERROR: "%STAGE_DIR%\%VSIX_NAME%" was not created.
  popd
  exit /b 1
)

copy /y "%ROOT_DIR%scripts\install.cmd" "%STAGE_DIR%\install.cmd" >nul
if errorlevel 1 (
  echo ERROR: failed to copy scripts\install.cmd to "%STAGE_DIR%".
  popd
  exit /b 1
)

rem Replace the previous deliverables only after the new ones were built successfully.
del /q "%OUT_DIR%\*.vsix" "%OUT_DIR%\install.cmd" >nul 2>&1
move /y "%STAGE_DIR%\%VSIX_NAME%" "%OUT_DIR%\%VSIX_NAME%" >nul || (
  echo ERROR: failed to move the VSIX into "%OUT_DIR%".
  popd
  exit /b 1
)
move /y "%STAGE_DIR%\install.cmd" "%OUT_DIR%\install.cmd" >nul || (
  echo ERROR: failed to move install.cmd into "%OUT_DIR%".
  popd
  exit /b 1
)
rmdir "%STAGE_DIR%" >nul 2>&1

echo Created: %OUT_DIR%\%VSIX_NAME%
echo Created: %OUT_DIR%\install.cmd
popd
exit /b 0

:clean
rem Removes only the staging folder. The latest VSIX and install.cmd in artifact\ are kept.
echo Keep  : %OUT_DIR%\*.vsix
echo Keep  : %OUT_DIR%\install.cmd
if not exist "%STAGE_DIR%" (
  echo Absent: %STAGE_DIR%
  popd
  exit /b 0
)
rem Refuse to follow reparse points (symlink/junction) inside the candidate.
dir /a:l /s /b "%STAGE_DIR%" 2>nul | findstr "^" >nul
if not errorlevel 1 (
  echo ERROR: reparse point found under "%STAGE_DIR%"; refusing to delete.
  popd
  exit /b 1
)
rmdir /s /q "%STAGE_DIR%"
if exist "%STAGE_DIR%" (
  echo ERROR: failed to remove "%STAGE_DIR%".
  popd
  exit /b 1
)
echo Removed: %STAGE_DIR%
popd
exit /b 0

:usage
echo Usage: publish.bat [clean]
popd
exit /b 2
