@echo off
rem Scheduled wrapper for supabase-to-mariadb.mjs (Task Scheduler se call hota hai)
set "NODE=C:\Program Files\nodejs\node.exe"
set "SCRIPT=C:\next-vtech\vtech-frontend\scripts\supabase-to-mariadb.mjs"
set "LOG=C:\next-vtech\vtech-frontend\scripts\supabase-to-mariadb.log"
echo ===== [%date% %time%] scheduled run ===== >> "%LOG%"
"%NODE%" "%SCRIPT%" --quiet >> "%LOG%" 2>&1
exit /b %errorlevel%
