param(
  [Parameter(Mandatory)] [string] $SignedPackage,
  [Parameter(Mandatory)] [string] $SetupExecutable,
  [Parameter(Mandatory)] [string] $SignTool
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SignedPackage).Path
$catalog = Join-Path $source 'Micbridge.cat'
$sys = Join-Path $source 'SimpleAudioSample.sys'
$inf = Join-Path $source 'SimpleAudioSample.inf'
foreach ($file in @($catalog, $sys, $inf, $SetupExecutable, $SignTool)) {
  if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
$identity = Get-Content -LiteralPath $inf -Raw
if ($identity -notmatch 'ROOT\\Micbridge' -or $identity -notmatch 'Micbridge Microphone') { throw 'Unexpected driver identity' }
& (Join-Path $PSScriptRoot 'verify-windows-driver.ps1') -Package $source -SignTool $SignTool
& $SignTool verify /kp /v $catalog
if ($LASTEXITCODE) { throw 'Production kernel-policy catalog signature failed' }
foreach ($file in @($sys, $inf)) {
  & $SignTool verify /kp /v /c $catalog $file
  if ($LASTEXITCODE) { throw "Catalog does not verify package member: $file" }
}
$destination = Join-Path $PSScriptRoot '../native/windows-driver/package'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
foreach ($file in @($catalog, $sys, $inf, $SetupExecutable)) { Copy-Item -LiteralPath $file -Destination $destination }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../native/windows-driver/install.ps1') -Destination $destination
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../.tools/micbridge-driver/LICENSE') -Destination (Join-Path $destination 'MS-PL.txt')
Write-Output 'Verified production driver staged for Windows packaging.'
