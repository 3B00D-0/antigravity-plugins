<#
.SYNOPSIS
  Antigravity Plugins — Root Installer
.EXAMPLE
  irm https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"
$PluginInstallerUrl = "https://raw.githubusercontent.com/3B00D-0/antigravity-plugins/main/plugins/arabic-rtl-fixer/install.ps1"
Invoke-RestMethod -Uri $PluginInstallerUrl | Invoke-Expression
