$ErrorActionPreference = 'Stop'
if (-not $env:RUNNER_TEMP -or $env:GITHUB_ACTIONS -ne 'true') {
  throw 'This installation check runs only on a disposable GitHub Actions runner.'
}
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = (Resolve-Path "release/Micbridge-$version-windows-x64-setup.exe").Path
$installDir = Join-Path $env:RUNNER_TEMP 'Micbridge install smoke'
$appExe = Join-Path $installDir 'Micbridge.exe'
$uninstaller = Join-Path $installDir 'Uninstall Micbridge.exe'
if (Test-Path -LiteralPath $installDir) { throw 'Smoke install directory already exists.' }
try {
  $setup = Start-Process -FilePath $installer -ArgumentList ('/S /currentuser /D=' + $installDir) -WindowStyle Hidden -Wait -PassThru
  if ($setup.ExitCode -ne 0) { throw "Installer failed: $($setup.ExitCode)" }
  if (Test-Path -LiteralPath (Join-Path $installDir 'resources/native')) { throw 'Retired native helper is still bundled.' }
  foreach ($file in @($appExe, $uninstaller, (Join-Path $installDir 'resources/notices/MICBRIDGE-LICENSE.txt'),
    (Join-Path $installDir 'resources/vb-cable/VBCABLE_Driver_Pack45.zip'),
    (Join-Path $installDir 'resources/vb-cable/install.ps1'),
    (Join-Path $installDir 'resources/vb-cable/endpoints.cs'))) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing installed file: $file" }
  }
  & (Join-Path $installDir 'resources/vb-cable/verify.ps1') -Archive (Join-Path $installDir 'resources/vb-cable/VBCABLE_Driver_Pack45.zip')
  Add-Type -Path (Join-Path $installDir 'resources/vb-cable/endpoints.cs')
  [void][MicbridgeCableEndpoints]::GetBaseMicrophoneCount()
  if (Test-Path -LiteralPath (Join-Path $installDir 'resources/windows-driver')) { throw 'Experimental unsigned driver must not be bundled.' }
  $registration = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {
    $_.DisplayName -eq "Micbridge $version" -and $_.UninstallString -and $_.UninstallString.Contains($uninstaller)
  })
  if ($registration.Count -ne 1) { throw 'Per-user uninstaller registration not found.' }
  $desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Micbridge.lnk'
  $menuShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs/Micbridge.lnk'
  if (-not (Test-Path -LiteralPath $desktopShortcut) -or -not (Test-Path -LiteralPath $menuShortcut)) {
    throw 'Installer shortcuts not found.'
  }
  Write-Output 'Installer verified: custom directory with spaces, installed files, shortcuts, and per-user uninstall registration.'
} finally {
  # Stop only this test installation if its finish page launched the app.
  Get-Process -Name Micbridge -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $appExe } | Stop-Process
  if (Test-Path -LiteralPath $uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -WindowStyle Hidden -Wait -PassThru
    if ($uninstall.ExitCode -ne 0) { throw "Uninstaller failed: $($uninstall.ExitCode)" }
    for ($attempt = 0; $attempt -lt 30 -and (Test-Path -LiteralPath $appExe); $attempt++) { Start-Sleep -Seconds 1 }
    if (Test-Path -LiteralPath $appExe) { throw 'Uninstaller did not remove the installed executable.' }
    $remaining = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' | Where-Object {
      $_.DisplayName -eq "Micbridge $version" -and $_.UninstallString -and $_.UninstallString.Contains($uninstaller)
    })
    if ($remaining.Count) { throw 'Uninstaller registration remains after uninstall.' }
    Write-Output 'Uninstall verified: executable and per-user registration removed.'
  }
}
