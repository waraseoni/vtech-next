' VBScript wrapper — hides node.exe console window
' Used by Task Scheduler to run sync silently
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c ""C:\next-vtech\vtech-frontend\scripts\supabase-to-mariadb-sync.cmd""", 0, True
Set WshShell = Nothing
