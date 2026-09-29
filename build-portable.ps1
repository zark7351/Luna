$ErrorActionPreference = 'Stop'
$sourceRoot = $PSScriptRoot
$runtimeRoot = Join-Path $sourceRoot 'node_modules/electron/dist'
if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'electron.exe'))) {
    throw 'Run npm install and node node_modules/electron/install.js first.'
}
$outputRoot = Join-Path (Split-Path $sourceRoot -Parent) 'LunaPet-Windows'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Copy-Item -Path (Join-Path $runtimeRoot '*') -Destination $outputRoot -Recurse -Force
$appRoot = Join-Path $outputRoot 'resources/app'
New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
foreach ($file in @('package.json','main.js','preload.js','core.js','network.js','renderer.js','style.css','index.html','README.md','ASSET-PROMPT.txt')) {
    Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination $appRoot -Force
}
Copy-Item -LiteralPath (Join-Path $sourceRoot 'assets') -Destination $appRoot -Recurse -Force
Move-Item -LiteralPath (Join-Path $outputRoot 'electron.exe') -Destination (Join-Path $outputRoot 'LunaPet.exe') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'README.md') -Destination (Join-Path $outputRoot '使用说明.md') -Force
Write-Output "Portable app: $outputRoot/LunaPet.exe"
