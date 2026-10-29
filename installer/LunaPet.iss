#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\Claudie-Windows"
#endif
#ifndef ReleaseDir
  #define ReleaseDir "..\..\Claudie-Release"
#endif

[Setup]
AppId={code:ReleaseAppId}
AppName=Claudie
AppVersion={#AppVersion}
AppVerName=Claudie {#AppVersion}
AppPublisher=Claudie
DefaultDirName={localappdata}\Programs\Claudie
DefaultGroupName=Claudie
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#ReleaseDir}
OutputBaseFilename=Claudie-{#AppVersion}-Setup
SetupIconFile=..\assets\claude.ico
UninstallDisplayIcon={app}\Claudie.exe
VersionInfoVersion={#AppVersion}
VersionInfoProductName=Claudie
VersionInfoDescription=Claudie 安装程序
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

; Remove only this product's retired executable and shortcuts during an upgrade.
; Keep the release AppId so existing installations and uninstall records are upgraded.
[InstallDelete]
Type: files; Name: "{app}\Claude.exe"
Type: files; Name: "{app}\claudex.exe"
Type: files; Name: "{app}\claude maid.exe"
Type: files; Name: "{userdesktop}\claude maid.lnk"; Check: not IsTestMode
Type: files; Name: "{userprograms}\claude maid\claude maid.lnk"; Check: not IsTestMode
Type: dirifempty; Name: "{userprograms}\claude maid"; Check: not IsTestMode
Type: files; Name: "{userdesktop}\claudex.lnk"; Check: not IsTestMode
Type: files; Name: "{userprograms}\claudex\claudex.lnk"; Check: not IsTestMode
Type: dirifempty; Name: "{userprograms}\claudex"; Check: not IsTestMode
Type: files; Name: "{userdesktop}\克劳德.lnk"; Check: not IsTestMode
Type: files; Name: "{userprograms}\克劳德\克劳德.lnk"; Check: not IsTestMode
Type: dirifempty; Name: "{userprograms}\克劳德"; Check: not IsTestMode

[Icons]
Name: "{userprograms}\Claudie\Claudie"; Filename: "{app}\Claudie.exe"; WorkingDir: "{app}"; AppUserModelID: "claudex.Companion.Desktop"; Check: not IsTestMode
Name: "{userdesktop}\Claudie"; Filename: "{app}\Claudie.exe"; WorkingDir: "{app}"; AppUserModelID: "claudex.Companion.Desktop"; Tasks: desktopicon; Check: not IsTestMode

[Run]
Filename: "{app}\Claudie.exe"; WorkingDir: "{app}"; Description: "启动 Claudie"; Flags: nowait postinstall skipifsilent; Check: not IsTestMode

[Code]
function IsTestMode: Boolean;
begin
  Result := ExpandConstant('{param:LUNATEST|0}') = '1';
end;

function ReleaseAppId(Param: String): String;
begin
  if IsTestMode then
    Result := 'claudex-Isolated-Installer-Test'
  else
    Result := '{1BE771C4-C431-4C6B-93C8-22C726B8477A}';
end;

// User data is outside {app}; never enumerate or remove AppData/custom save directories.
// No [UninstallDelete] entry is intentionally present.
