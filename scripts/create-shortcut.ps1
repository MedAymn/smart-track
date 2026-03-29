$TargetFile = "wscript.exe"
$ShortcutFile = "$env:USERPROFILE\Desktop\Phone Tracker.lnk"
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutFile)
$Shortcut.TargetPath = $TargetFile
$Shortcut.Arguments = """$env:CD\launch.vbs"""
$Shortcut.WorkingDirectory = "$env:CD"
$Shortcut.IconLocation = "$env:CD\public\vite.svg"
$Shortcut.Save()
