@echo off
setlocal

set NODE_ENV=production

echo Cleaning build folders...
if exist dist rmdir /s /q dist
if exist dist-electron rmdir /s /q dist-electron
if exist build rmdir /s /q build

echo Building helper binary...
call npm run build:win-helper

echo Building main process...
call npm run build:main

echo Building renderer process...
call npm run build:render

if "%1"=="--ia32" (
  set PLATFORM=ia32
) else (
  set PLATFORM=x64
)

echo Building Electron app for %PLATFORM%...
call electron-builder --win --%PLATFORM% --config electron-builder-win.json

echo Build complete!