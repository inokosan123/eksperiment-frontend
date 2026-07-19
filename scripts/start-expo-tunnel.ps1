param(
  [switch]$Clear
)

$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'start-expo.ps1'

& $launcher -Connection tunnel -Clear:$Clear
exit $LASTEXITCODE
