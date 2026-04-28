$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$tempRoot = Join-Path $projectRoot '.expo-temp'

if (!(Test-Path -LiteralPath $tempRoot)) {
  New-Item -ItemType Directory -Path $tempRoot | Out-Null
}

Set-Location $projectRoot
$env:TMP = $tempRoot
$env:TEMP = $tempRoot
$env:BROWSER = 'none'

Write-Host "Project: $projectRoot"
Write-Host "TMP/TEMP: $tempRoot"
Write-Host "Starting Expo in tunnel mode..."

npx.cmd expo start --tunnel -c --port 8090
