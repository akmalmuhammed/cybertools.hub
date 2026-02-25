param(
    [string]$Host = "127.0.0.1",
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Starting Vite dev server at http://$Host`:$Port ..."
npm run dev -- --host $Host --port $Port
