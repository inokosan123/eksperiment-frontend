param(
  [switch]$Clear,
  [ValidateSet('lan', 'tunnel')]
  [string]$Connection = 'lan',
  [ValidateSet('go', 'dev-client')]
  [string]$Target = 'go'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$port = if ($Connection -eq 'tunnel') { 8081 } else { 8082 }

# Avoid CIM/WMI process inspection here: it can require elevated permissions
# on Windows. The fixed project port is a more reliable single-server lock.
$existingStatus = $null
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if ($curl) {
  $existingStatus = & $curl.Source `
    --max-time 2 `
    --silent `
    "http://127.0.0.1:$port/status" 2>$null
  if ($LASTEXITCODE -ne 0) { $existingStatus = $null }
}

if ($existingStatus -eq 'packager-status:running') {
  Write-Host "Expo is already running for this project on port $port."
  Write-Host 'Use that terminal; a second Metro watcher was not started.'
  exit 0
}

$tcpClient = [System.Net.Sockets.TcpClient]::new()
$portInUse = $false
try {
  $connect = $tcpClient.ConnectAsync('127.0.0.1', $port)
  $portInUse = $connect.Wait(1000) -and $tcpClient.Connected
} catch {
  $portInUse = $false
} finally {
  $tcpClient.Dispose()
}

if ($portInUse) {
  Write-Error "Port $port is occupied by an unresponsive or non-Expo process. Stop it before starting this project."
  exit 1
}

$env:BROWSER = 'none'
if ($Target -eq 'dev-client') {
  # EAS profile variables are build-time only. The local Metro process must
  # expose the same public config or the installed development client will
  # correctly load the bundle but keep Anasta's native editor pilot disabled.
  $env:ANASTA_NATIVE_BUILD = '1'
  $env:EXPO_PUBLIC_NATIVE_RICH_TEXT_EDITOR = '1'
} else {
  # Expo Go does not contain either native dependency. Explicitly remove
  # inherited pilot flags so a shell previously used for a development client
  # cannot accidentally activate the native path in Expo Go.
  Remove-Item Env:ANASTA_NATIVE_BUILD -ErrorAction SilentlyContinue
  Remove-Item Env:EXPO_PUBLIC_NATIVE_RICH_TEXT_EDITOR -ErrorAction SilentlyContinue
}
if ($env:FORCE_COLOR -and $env:NO_COLOR) {
  Remove-Item Env:NO_COLOR -ErrorAction SilentlyContinue
}
$watchGuard = (Join-Path $projectRoot 'scripts\expo-watchfile-guard.cjs').Replace('\', '/')
if ($env:NODE_OPTIONS -notlike '*expo-watchfile-guard.cjs*') {
  $watchGuardOption = "--require=$watchGuard"
  $env:NODE_OPTIONS = if ([string]::IsNullOrWhiteSpace($env:NODE_OPTIONS)) {
    $watchGuardOption
  } else {
    "$env:NODE_OPTIONS $watchGuardOption"
  }
}

# Metro defaults to roughly half of the available CPU cores. The Windows
# native watcher keeps that concurrency safe, so do not throttle transforms.
$expoArgs = @('start', "--$Target", "--$Connection", '--port', "$port")
if ($Clear) { $expoArgs += '--clear' }

$portableNode = Join-Path $projectRoot '.tools\node-v22.23.1-win-x64\node.exe'
$expoCli = Join-Path $projectRoot 'node_modules\expo\bin\cli'
$routeTypeGenerator = Join-Path $projectRoot 'scripts\generate-expo-router-types.cjs'

# Expo Router 6.0.24's live typed-route watcher treats `..\components` as an
# in-app route on Windows because it checks only for the POSIX `../` prefix.
# Generate a verified declaration from app/ once before startup, then disable
# only Expo CLI's automatic TypeScript watcher. This preserves typed routes and
# prevents unrelated source files from corrupting `.expo/types/router.d.ts`.
$env:EXPO_NO_TYPESCRIPT_SETUP = '1'
if ((Test-Path -LiteralPath $portableNode) -and (Test-Path -LiteralPath $routeTypeGenerator)) {
  & $portableNode $routeTypeGenerator
} else {
  & node $routeTypeGenerator
}
if ($LASTEXITCODE -ne 0) {
  Write-Error 'Verified Expo Router type generation failed; Metro was not started.'
  exit $LASTEXITCODE
}

if ((Test-Path -LiteralPath $portableNode) -and (Test-Path -LiteralPath $expoCli)) {
  Write-Host "Starting Expo target '$Target' over $Connection with Node $(& $portableNode --version)..."
  & $portableNode $expoCli @expoArgs
} else {
  Write-Host "Starting Expo target '$Target' over $Connection with the system Node runtime..."
  & npx.cmd expo @expoArgs
}
exit $LASTEXITCODE
