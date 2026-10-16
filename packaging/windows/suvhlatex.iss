#define MyAppName "suvhlatex"
#ifndef MyAppVersion
  #define MyAppVersion "0.1.4"
#endif

[Setup]
AppId={{A2F5D6A9-8C7D-4D7F-9D0F-9D4A15B8E4F1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=suvhlatex contributors
DefaultDirName={localappdata}\Programs\suvhlatex
DefaultGroupName={#MyAppName}
SetupIconFile=..\suvhlatex.ico
OutputDir=..\..\dist
OutputBaseFilename=suvhlatex-{#MyAppVersion}-windows-x64-setup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\suvhlatex.exe

[Files]
Source: "..\..\dist\suvhlatex.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README-WINDOWS.md"; DestDir: "{app}"; Flags: isreadme

[Icons]
Name: "{group}\suvhlatex"; Filename: "{app}\suvhlatex.exe"
Name: "{userdesktop}\suvhlatex"; Filename: "{app}\suvhlatex.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\suvhlatex.exe"; Description: "Launch suvhlatex"; Flags: nowait postinstall skipifsilent
