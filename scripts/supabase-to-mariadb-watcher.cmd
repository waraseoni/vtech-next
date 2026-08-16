@echo off
rem 1-min watcher: remote "Sync Now" request (Supabase system_info.sync_pending)
rem ko uthata hai — request mili to sync chala deta hai, warna turant exit.
rem Har 1 min chalane ke liye Task Scheduler me:
rem   schtasks /Create /TN "VTech Sync Watcher" /TR "C:\vtech-next\vtech-next\scripts\supabase-to-mariadb-watcher.cmd" /SC MINUTE /MO 1 /F
set "NODE=C:\Program Files\nodejs\node.exe"
set "SCRIPT=C:\vtech-next\vtech-next\scripts\supabase-to-mariadb.mjs"
set "LOG=C:\vtech-next\vtech-next\scripts\sync-watcher.log"
"%NODE%" "%SCRIPT%" --quiet --watcher >> "%LOG%" 2>&1
exit /b %errorlevel%
