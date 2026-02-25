param(
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Installing dependencies with npm ci..."
npm ci
if ($LASTEXITCODE -ne 0) {
    throw "npm ci failed."
}

if (-not $SkipValidation) {
    Write-Host "Running lint..."
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        throw "npm run lint failed."
    }

    Write-Host "Running tests..."
    npm test
    if ($LASTEXITCODE -ne 0) {
        throw "npm test failed."
    }

    Write-Host "Running build..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed."
    }
}

Write-Host "Workspace is ready. Start dev server with .\\scripts\\dev.ps1"
