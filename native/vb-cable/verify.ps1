param([Parameter(Mandatory=$true)][string]$Archive)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = "$PSHOME\Modules;$env:PSModulePath"
$expected = 'B950E39F01AF1D04EA623C8F6D8EB9B6EA5C477C637295FABF20631C85116BFB'
if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash -ne $expected) { throw 'VB-CABLE checksum mismatch.' }
$package = Join-Path (Split-Path $Archive) 'package'
Expand-Archive -LiteralPath $Archive -DestinationPath $package -Force
$catalog = Get-AuthenticodeSignature (Join-Path $package 'vbaudio_cable64_win10.cat')
if ($catalog.Status -ne 'Valid' -or $catalog.SignerCertificate.Subject -notmatch '^CN=Microsoft Windows Hardware Compatibility Publisher,') { throw 'VB-CABLE Microsoft catalog signature is invalid.' }
$setup = Get-AuthenticodeSignature (Join-Path $package 'VBCABLE_Setup_x64.exe')
if ($setup.Status -ne 'Valid' -or $setup.SignerCertificate.Subject -notmatch 'BUREL VINCENT') { throw 'VB-CABLE setup publisher signature is invalid.' }
Write-Output 'Verified Microsoft driver catalog and VB-Audio setup publisher.'
