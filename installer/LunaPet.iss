#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\LunaPet-Windows"
#endif
#ifndef ReleaseDir
  #define ReleaseDir "..\..\LunaPet-Release"
#endif

[Setup]
AppId={code:ReleaseAppId}
AppName=露娜
AppVersion={#AppVersion}
AppVerName=露娜 {#AppVersion}
AppPublisher=LunaPet
DefaultDirName={localappdata}\Programs\LunaPet
DefaultGroupName=露娜
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#ReleaseDir}
OutputBaseFilename=LunaPet-{#AppVersion}-Setup
SetupIconFile=..\assets\luna.ico
UninstallDisplayIcon={app}\LunaPet.exe
VersionInfoVersion={#AppVersion}
VersionInfoProductName=露娜
VersionInfoDescription=露娜安装程序
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
Name: "{userprograms}\露娜\露娜"; Filename: "{app}\LunaPet.exe"; WorkingDir: "{app}"; AppUserModelID: "LunaPet.Desktop"; Check: not IsTestMode
Name: "{userdesktop}\露娜"; Filename: "{app}\LunaPet.exe"; WorkingDir: "{app}"; AppUserModelID: "LunaPet.Desktop"; Tasks: desktopicon; Check: not IsTestMode

[Run]
Filename: "{app}\LunaPet.exe"; WorkingDir: "{app}"; Description: "启动露娜"; Flags: nowait postinstall skipifsilent; Check: not IsTestMode

[Code]
function IsTestMode: Boolean;
begin
  Result := ExpandConstant('{param:LUNATEST|0}') = '1';
end;

function ReleaseAppId(Param: String): String;
begin
  if IsTestMode then
    Result := 'LunaPet-Isolated-Installer-Test'
  else
    Result := '{1BE771C4-C431-4C6B-93C8-22C726B8477A}';
end;

// User data is outside {app}; never enumerate or remove AppData/custom save directories.
// No [UninstallDelete] entry is intentionally present.
