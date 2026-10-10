param([Parameter(Mandatory)] [string] $Package, [string] $SignTool)
$ErrorActionPreference = 'Stop'
$catalog = Join-Path $Package 'Micbridge.cat'
$signature = Get-AuthenticodeSignature -LiteralPath $catalog
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'CN=Microsoft Windows Hardware Compatibility Publisher') {
  throw 'A Microsoft production-signed catalog is required. Test certificates are refused.'
}
if (!$SignTool) {
  $SignTool = Get-ChildItem 'C:/Program Files (x86)/Windows Kits/10/bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.Directory.Name -eq 'x64' } | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (!$SignTool -or !(Test-Path -LiteralPath $SignTool)) { throw 'WDK/SDK SignTool is required to verify a bundled driver.' }
& $SignTool verify /kp /v $catalog
if ($LASTEXITCODE) { throw 'Kernel-policy catalog verification failed.' }
foreach ($name in @('SimpleAudioSample.sys', 'SimpleAudioSample.inf')) {
  & $SignTool verify /kp /v /c $catalog (Join-Path $Package $name)
  if ($LASTEXITCODE) { throw "Signed catalog membership failed: $name" }
}
