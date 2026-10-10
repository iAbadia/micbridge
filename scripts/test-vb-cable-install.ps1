$ErrorActionPreference = 'Stop'
if (-not $env:RUNNER_TEMP -or $env:GITHUB_ACTIONS -ne 'true') {
  throw 'Driver installation checks run only on a disposable GitHub Actions runner.'
}
$directory = (Resolve-Path 'release/win-unpacked/resources/vb-cable').Path
& (Join-Path $directory 'verify.ps1') -Archive (Join-Path $directory 'VBCABLE_Driver_Pack45.zip')
$existing = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.HardwareID -contains 'VBAudioVACWDM' })
if ($existing.Count) { throw 'Fresh-install test requires a runner without VB-CABLE.' }

# Vendor's hidden installation switches are exercised only in a disposable VM.
# The shipping wizard uses the visible official setup rather than assuming users
# consent to an unattended global driver installation.
$setup = Start-Process -FilePath (Join-Path $directory 'package/VBCABLE_Setup_x64.exe') -ArgumentList '-i -h' -WindowStyle Hidden -PassThru
if (-not $setup.WaitForExit(120000)) { $setup.Kill(); throw 'VB-CABLE unattended test setup timed out.' }
$devices = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.HardwareID -contains 'VBAudioVACWDM' })
if (-not $devices.Count -or @($devices | Where-Object ConfigManagerErrorCode -ne 0).Count) {
  throw "VB-CABLE device failed to start; setup exit code $($setup.ExitCode)."
}
$signed = @(Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -eq 'VB-Audio Virtual Cable' })
if (-not $signed.Count -or @($signed | Where-Object { -not $_.IsSigned }).Count) { throw 'Installed driver is not reported signed.' }
foreach ($service in @('AudioEndpointBuilder', 'Audiosrv')) {
  Set-Service -Name $service -StartupType Manual
  Start-Service -Name $service
}
# Hosted Windows runners can deny microphone capture by default. Configure
# capture consent only in this disposable VM, never in the shipping installer.
foreach ($root in @('HKCU:', 'HKLM:')) {
  $consent = "$root\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone"
  New-Item -Path $consent -Force | Out-Null
  Set-ItemProperty -Path $consent -Name Value -Value Allow
  New-Item -Path "$consent\NonPackaged" -Force | Out-Null
  Set-ItemProperty -Path "$consent\NonPackaged" -Name Value -Value Allow
}
Add-Type -Path (Join-Path $directory 'endpoints.cs')
$count = 0
for ($attempt = 0; $attempt -lt 20 -and -not $count; $attempt++) {
  $count = [MicbridgeCableEndpoints]::GetBaseMicrophoneCount()
  if (-not $count) { Start-Sleep -Seconds 1 }
}
if (-not $count) { throw 'Signed driver installed but its recording endpoint is unavailable.' }
if ([MicbridgeCableEndpoints]::RenameMicrophone() -ne 1) { throw 'Expected exactly one base microphone to rename.' }
Write-Output ('Recording endpoint name: ' + [MicbridgeCableEndpoints]::GetMicrophoneNames()[0])
if ([MicbridgeCableEndpoints]::GetMicrophoneNames()[0] -notlike 'Micbridge Microphone (VB-CABLE)*') { throw 'Display name was not persisted.' }
if ([MicbridgeCableEndpoints]::RenameMicrophone() -ne 1) { throw 'Repeat rename must be idempotent.' }
# Exercise preservation against an actual available endpoint on this VM. A
# Windows installation may replace the user's previous default with the cable.
$defaults = [MicbridgeCableEndpoints]::CaptureDefaults()
if ([MicbridgeCableEndpoints]::RestoreDefaults($defaults) -ne 0) { throw 'Unchanged defaults must not be rewritten.' }
$reuse = Start-Process -FilePath 'powershell.exe' -ArgumentList ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $directory 'install.ps1') + '"') -WindowStyle Hidden -Wait -PassThru
if ($reuse.ExitCode -ne 0) { throw 'Existing-driver reuse failed.' }
Add-Type -Path 'scripts/windows-audio-roundtrip.cs'
Write-Output ([CableRoundtrip]::Run())
Write-Output 'Verified: fresh signed driver installation, started PnP device, recording endpoint, persistent display name, repeat rename and existing-driver reuse.'
