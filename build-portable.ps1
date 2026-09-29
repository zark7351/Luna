$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'build-portable.cjs')
exit $LASTEXITCODE
