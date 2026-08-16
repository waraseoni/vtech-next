@echo off
rem Scheduled wrapper for supabase-to-mariadb.mjs (Task Scheduler se call hota hai)
set "NODE=C:\Program Files\nodejs\node.exe"
set "SCRIPT=C:\vtech-next\vtech-next\scripts\supabase-to-mariadb.mjs"
set "LOG=C:\vtech-next\vtech-next\scripts\supabase-to-mariadb.log"
"%NODE%" "%SCRIPT%" --quiet >> "%LOG%" 2>&1
exit /b %errorlevel%
