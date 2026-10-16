<#
.SYNOPSIS
  Antigravity 2.0 — 1-Command Installer for Arabic / RTL Formatting Fix
.EXAMPLE
  irm https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   Antigravity 2.0 — Arabic / RTL Formatting Fix Installer      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$RepoUrl = "https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer"
$PluginDir = Join-Path $HOME ".gemini\config\plugins\arabic-rtl-fixer"
$SidecarDir = Join-Path $PluginDir "sidecars\rtl_fixer_panel"
$AssetsDir = Join-Path $PluginDir "assets"
$LibDir = Join-Path $PluginDir "lib"

New-Item -ItemType Directory -Force -Path $SidecarDir | Out-Null
New-Item -ItemType Directory -Force -Path $AssetsDir | Out-Null
New-Item -ItemType Directory -Force -Path $LibDir | Out-Null

$FilesToFetch = @(
    @{ Remote = "plugin.json"; Local = (Join-Path $PluginDir "plugin.json") },
    @{ Remote = "assets/logo.svg"; Local = (Join-Path $AssetsDir "logo.svg") },
    @{ Remote = "lib/patcher.cjs"; Local = (Join-Path $LibDir "patcher.cjs") },
    @{ Remote = "lib/injection.js"; Local = (Join-Path $LibDir "injection.js") },
    @{ Remote = "patch_antigravity_rtl.js"; Local = (Join-Path $PluginDir "patch_antigravity_rtl.js") },
    @{ Remote = "patch_antigravity_rtl.py"; Local = (Join-Path $PluginDir "patch_antigravity_rtl.py") },
    @{ Remote = "Install-RTL-Fix.bat"; Local = (Join-Path $PluginDir "Install-RTL-Fix.bat") },
    @{ Remote = "Restore-Original.bat"; Local = (Join-Path $PluginDir "Restore-Original.bat") },
    @{ Remote = "sidecars/rtl_fixer_panel/sidecar.json"; Local = (Join-Path $SidecarDir "sidecar.json") },
    @{ Remote = "sidecars/rtl_fixer_panel/server.cjs"; Local = (Join-Path $SidecarDir "server.cjs") },
    @{ Remote = "sidecars/rtl_fixer_panel/ui.html"; Local = (Join-Path $SidecarDir "ui.html") }
)

Write-Host "[1/3] Installing Antigravity UI Plugin to: $PluginDir" -ForegroundColor Yellow
foreach ($item in $FilesToFetch) {
    $localSource = Join-Path $PSScriptRoot ($item.Remote -replace '/', '\')
    if ($PSScriptRoot -and (Test-Path $localSource)) {
        Copy-Item -Path $localSource -Destination $item.Local -Force
    } else {
        Invoke-WebRequest -Uri "$RepoUrl/$($item.Remote)" -OutFile $item.Local -UseBasicParsing
    }
}
Write-Host "  [+] UI Plugin & Sidecar installed." -ForegroundColor Green

Write-Host "[2/3] Patching Antigravity 2.0 interface (creating automatic backup)..." -ForegroundColor Yellow

$AgyExe = Join-Path $env:LOCALAPPDATA "Programs\antigravity\Antigravity.exe"
if (-not (Test-Path $AgyExe)) {
    $AgyExe = Join-Path $env:LOCALAPPDATA "antigravity\Antigravity.exe"
}

$PatchJs = Join-Path $PluginDir "patch_antigravity_rtl.js"
$PatchPy = Join-Path $PluginDir "patch_antigravity_rtl.py"

if (Test-Path $AgyExe) {
    $env:ELECTRON_RUN_AS_NODE = "1"
    & $AgyExe $PatchJs
    Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python $PatchPy
} else {
    Write-Host "  [!] Could not locate Antigravity.exe automatically." -ForegroundColor Red
}

Write-Host ""
Write-Host "[3/3] Complete. Restart Antigravity 2.0 (or press Ctrl+Shift+N) to apply." -ForegroundColor Green
Write-Host ""
