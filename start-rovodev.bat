@echo off
REM Launch Rovo Dev agent for VS Code
"C:\Users\Owner\AppData\Roaming\Code\User\workspaceStorage\e77878cf2b8b0301d516684ff0d98818\atlassian.atlascode\atlascode-rovodev-bin\0.12.10\atlassian_cli_rovodev.exe" serve 40000 --xid rovodev-ide-vscode --site-url https://seanthetechyyy.atlassian.net --respect-configured-permissions
pause