@echo off
title Pushing KVN TEAPOWDER to GitHub
echo ===================================================================
echo Pushing KVN TEAPOWDER (Storefront + Admin Portal) to GitHub
echo Destination: https://github.com/kavinash008/KVN-tea-powder.git
echo ===================================================================
set "PATH=C:\Users\Kavin\.gemini\antigravity\scratch\mingit\cmd;C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin https://github.com/kavinash008/KVN-tea-powder.git
git push -u origin main
echo ===================================================================
echo All files pushed successfully to https://github.com/kavinash008/KVN-tea-powder!
echo ===================================================================
pause
