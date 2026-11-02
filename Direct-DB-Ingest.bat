@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

title AetherBI Direct Local-to-DB Ingest
echo ===============================================================
echo  AetherBI · Zero-Bandwidth Local-to-Database Ingest
echo ===============================================================
echo.

if not exist "local-dropzone" mkdir "local-dropzone"

if "%~1"=="" (
  echo Scanning .\local-dropzone ...
  call npx --yes tsx scripts/direct-db-ingest.ts
) else (
  echo Scanning dropped path: %*
  call npx --yes tsx scripts/direct-db-ingest.ts %*
)

echo.
echo Done. Press any key to close.
pause >nul
endlocal
