$ErrorActionPreference = 'Stop'
try {
  $helper = Join-Path $PSScriptRoot 'MicbridgeDriverSetup.exe'
  $inf = Join-Path $PSScriptRoot 'SimpleAudioSample.inf'
  $process = Start-Process -FilePath $helper -ArgumentList @('install', ('"' + $inf + '"')) -Verb RunAs -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -notin @(0, 3010)) { throw "Driver setup failed: $($process.ExitCode)" }
  if ($process.ExitCode -eq 3010) { Write-Output 'Restart Windows to finish driver installation.' }
  exit 0
} catch { Write-Error $_; exit 1 }
