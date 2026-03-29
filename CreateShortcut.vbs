Set oWS = WScript.CreateObject(" "WScript.Shell)  
sLinkFile = C:\Users\lenovo\Desktop\PhoneTracker.lnk  
Set oLink = oWS.CreateShortcut(sLinkFile)  
oLink.TargetPath = C:\Users\lenovo\Desktop\ai_Projects\phone-tracker\node_modules\.bin\electron.cmd  
