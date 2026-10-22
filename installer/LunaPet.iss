#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\Claude-Windows"
#endif
#ifndef ReleaseDir
  #define ReleaseDir "..\..\Claude-Release"
#endif

[Setup]
AppId={code:ReleaseAppId}
AppName=克劳德
AppVersion={#AppVersion}
AppVerName=克劳德 {#AppVersion}
AppPublisher=Claude
DefaultDirName={localappdata}\Programs\Claude
DefaultGroupName=克劳德
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#ReleaseDir}
OutputBaseFilename=Claude-{#AppVersion}-Setup
SetupIconFile=..\assets\claude.ico
UninstallDisplayIcon={app}\Claude.exe
VersionInfoVersion={#AppVersion}
VersionInfoProductName=克劳德
VersionInfoDescription=克劳德安装程序
WizardStyle=modern
Compression=lzma2/normal
SolidCompression=yes
CloseApplications=no
RestartApplications=no
CreateUninstallRegKey=not IsTestMode
UsePreviousAppDir=not IsTestMode
UsePreviousGroup=not IsTestMode
UsePreviousTasks=not IsTestMode
UsePreviousLanguage=no
UninstallLogMode=append

[Languages]
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "快捷方式："; Check: not IsTestMode

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "state.json,state.json.tmp,collection.json,reminders.json,collection-files\*,*.log"

[Icons]
Name: "{userprograms}\克劳德\克劳德"; Filename: "{app}\Claude.exe"; WorkingDir: "{app}"; AppUserModelID: "Claude.Companion.Desktop"; Check: not IsTestMode
Name: "{userdesktop}\克劳德"; Filename: "{app}\Claude.exe"; WorkingDir: "{app}"; AppUserModelID: "Claude.Companion.Desktop"; Tasks: desktopicon; Check: not IsTestMode

[Run]
Filename: "{app}\Claude.exe"; WorkingDir: "{app}"; Description: "启动克劳德"; Flags: nowait postinstall skipifsilent; Check: not IsTestMode

[Code]
function IsTestMode: Boolean;
begin
  Result := ExpandConstant('{param:LUNATEST|0}') = '1';
end;

function ReleaseAppId(Param: String): String;
begin
  if IsTestMode then
    Result := 'Claude-Isolated-Installer-Test'
  else
    Result := '{1BE771C4-C431-4C6B-93C8-22C726B8477A}';
end;

// User data is outside {app}; never enumerate or remove AppData/custom save directories.
// No [UninstallDelete] entry is intentionally present.
