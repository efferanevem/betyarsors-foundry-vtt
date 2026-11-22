# Links this repository into the local Foundry VTT systems folder as a directory junction
# (same approach as the reference project; no admin rights needed).
# Usage: npm run link   or   powershell -File scripts/link.ps1 [-DataPath <FoundryUserDataPath>]
param(
  [string]$DataPath = "$env:LOCALAPPDATA\FoundryVTT"
)

$SystemId = "betyarsors"
$Source = Resolve-Path (Join-Path $PSScriptRoot "..")
$SystemsDir = Join-Path $DataPath "Data\systems"
$Target = Join-Path $SystemsDir $SystemId

if (-not (Test-Path $SystemsDir)) {
  Write-Error "Foundry systems directory not found: $SystemsDir (pass -DataPath)"
  exit 1
}

if (Test-Path $Target) {
  $item = Get-Item $Target -Force
  if ($item.LinkType) {
    Write-Host "Link already exists: $Target -> $($item.Target)"
    exit 0
  }
  Write-Error "$Target exists and is not a link; remove it manually first."
  exit 1
}

New-Item -ItemType Junction -Path $Target -Target $Source | Out-Null
Write-Host "Linked $Target -> $Source"
