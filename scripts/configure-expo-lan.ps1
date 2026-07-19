$ErrorActionPreference = 'Stop'

$interfaceAlias = 'Ethernet'
$ruleName = 'Anasta Expo Metro 8082 (Private LAN)'

$profile = Get-NetConnectionProfile -InterfaceAlias $interfaceAlias -ErrorAction Stop
if ($profile.NetworkCategory -ne 'Private') {
  Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
}

$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($rule) {
  $rule | Set-NetFirewallRule -Enabled True -Profile Private -Direction Inbound -Action Allow | Out-Null
} else {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Description 'Allow Expo Metro only from the local subnet on private networks.' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 8082 `
    -Profile Private `
    -RemoteAddress LocalSubnet | Out-Null
}

Write-Host ''
Write-Host 'Expo LAN access is configured.' -ForegroundColor Green
Get-NetConnectionProfile -InterfaceAlias $interfaceAlias |
  Format-Table Name, InterfaceAlias, NetworkCategory -AutoSize
Get-NetFirewallRule -DisplayName $ruleName |
  Format-Table DisplayName, Enabled, Direction, Action, Profile -AutoSize
Get-NetFirewallRule -DisplayName $ruleName |
  Get-NetFirewallPortFilter |
  Format-Table Protocol, LocalPort -AutoSize
Get-NetFirewallRule -DisplayName $ruleName |
  Get-NetFirewallAddressFilter |
  Format-Table RemoteAddress -AutoSize

Read-Host 'Press Enter to close this window'
