param(
  [switch]$Clear
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$projectPattern = [Regex]::Escape($projectRoot)

# Expo silently offers another port when a server is already running. That is
# convenient once, but it leaves several Metro file watchers attached to this
# same workspace. Reuse the existing project server instead of creating one.
$existingExpo = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -eq 'node.exe' -and
    $_.CommandLine -match $projectPattern -and
    $_.CommandLine -match 'expo[\\/]bin[\\/]cli' -and
    $_.CommandLine -match '(?:^|\s)start(?:\s|$)'
  } |
  Select-Object -First 1

if ($existingExpo) {
  Write-Host "Expo is already running for this project (PID $($existingExpo.ProcessId))."
  Write-Host 'Use that terminal; a second Metro watcher was not started.'
  exit 0
}

$portOwner = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -First 1

if ($portOwner) {
  Write-Error "Port 8082 is already occupied by PID $($portOwner.OwningProcess). Stop it before starting this project."
  exit 1
}

$env:BROWSER = 'none'
$watchGuard = (Join-Path $projectRoot 'scripts\expo-watchfile-guard.cjs').Replace('\', '/')
$watchGuardOption = "--require=$watchGuard"
$env:NODE_OPTIONS = if ([string]::IsNullOrWhiteSpace($env:NODE_OPTIONS)) {
  $watchGuardOption
} else {
  "$env:NODE_OPTIONS $watchGuardOption"
}

$expoArgs = @('expo', 'start', '--go', '--lan', '--port', '8082')
if ($Clear) { $expoArgs += '--clear' }

& npx.cmd @expoArgs
exit $LASTEXITCODE
