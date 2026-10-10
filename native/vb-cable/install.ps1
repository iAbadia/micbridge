param([switch]$Elevate, [switch]$RenameOnly)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"
try {
  $existing = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.HardwareID -contains 'VBAudioVACWDM' })
  if ($existing.Count -and -not $RenameOnly) {
    if (@($existing | Where-Object ConfigManagerErrorCode -ne 0).Count) { throw 'An existing VB-CABLE device is disabled or failed to start. Check it in Windows Device Manager before continuing.' }
    Write-Output 'Reusing existing VB-CABLE without changing its name or reinstalling it.'
    exit 0
  }
  if ($Elevate) {
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    if ($RenameOnly) { $arguments += ' -RenameOnly' }
    $process = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -Wait -PassThru
    exit $process.ExitCode
  }
  if (-not $RenameOnly) {
    & (Join-Path $PSScriptRoot 'verify.ps1') -Archive (Join-Path $PSScriptRoot 'VBCABLE_Driver_Pack45.zip')
    Add-Type -Path (Join-Path $PSScriptRoot 'endpoints.cs')
    $defaults = [MicbridgeCableEndpoints]::CaptureDefaults()
    # Keep the vendor installer and all signed driver files intact. Its visible
    # installation window also explains the driver and its reboot requirement.
    try { $setup = Start-Process -FilePath (Join-Path $PSScriptRoot 'package\VBCABLE_Setup_x64.exe') -WindowStyle Normal -Wait -PassThru }
    finally { [void][MicbridgeCableEndpoints]::RestoreDefaults($defaults) }
    $installed = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.HardwareID -contains 'VBAudioVACWDM' })
    if (-not $installed.Count) { throw 'VB-CABLE installation was cancelled or did not create the virtual device.' }
  }
  if ($RenameOnly) { Add-Type -Path (Join-Path $PSScriptRoot 'endpoints.cs') }
  if ($RenameOnly -and -not [MicbridgeCableEndpoints]::GetBaseMicrophoneCount()) { throw 'No active base VB-CABLE microphone was found. Install VB-CABLE, restart Windows and enable its recording endpoint first.' }
  $renamed = 0
  for ($attempt = 0; $attempt -lt 10 -and -not $renamed; $attempt++) {
    $renamed = [MicbridgeCableEndpoints]::RenameMicrophone()
    if (-not $renamed) { Start-Sleep -Seconds 1 }
  }
  if (-not $renamed) { Write-Output 'Microphone display name unchanged. Restart Windows; use Rename virtual microphone from Micbridge if needed.' }
  else { Write-Output 'Microphone display name: Micbridge Microphone (VB-CABLE).' }
  if (-not $RenameOnly) { Write-Output 'Restart Windows to finalize VB-CABLE setup. Check your default speakers and microphone in Windows Sound settings.'; exit 3010 }
  exit 0
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }
