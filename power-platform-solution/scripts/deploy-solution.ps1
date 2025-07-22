# DOM Style Injector Extension - Power Platform Solution Deployment
# This script deploys the solution to a target Dataverse environment

param(
    [Parameter(Mandatory=$true)]
    [string]$EnvironmentUrl,
    
    [Parameter(Mandatory=$false)]
    [string]$SolutionFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$ImportAsHolding = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$PublishWorkflows = $true,
    
    [Parameter(Mandatory=$false)]
    [switch]$OverwriteUnmanagedCustomizations = $true
)

Write-Host "DOM Style Injector Extension - Solution Deployment" -ForegroundColor Green
Write-Host "Target Environment: $EnvironmentUrl" -ForegroundColor Cyan

# Check if Power Platform CLI is installed
try {
    $pacVersion = pac --version
    Write-Host "Power Platform CLI Version: $pacVersion" -ForegroundColor Cyan
}
catch {
    Write-Error "Power Platform CLI is not installed. Please install it using: npm install -g @microsoft/powerplatform-cli"
    exit 1
}

# Find solution file if not specified
if ([string]::IsNullOrEmpty($SolutionFile)) {
    $distPath = Join-Path $PSScriptRoot "..\dist"
    $solutionFiles = Get-ChildItem -Path $distPath -Filter "*_Managed.zip" | Sort-Object LastWriteTime -Descending
    
    if ($solutionFiles.Count -eq 0) {
        Write-Error "No solution files found. Please run build-solution.ps1 first."
        exit 1
    }
    
    $SolutionFile = $solutionFiles[0].FullName
    Write-Host "Using solution file: $($solutionFiles[0].Name)" -ForegroundColor Yellow
}

# Verify solution file exists
if (!(Test-Path $SolutionFile)) {
    Write-Error "Solution file not found: $SolutionFile"
    exit 1
}

# Authenticate to environment
Write-Host "`nAuthenticating to environment..." -ForegroundColor Yellow
try {
    pac auth create --url $EnvironmentUrl
}
catch {
    Write-Host "Authentication failed. Trying to select existing connection..." -ForegroundColor Yellow
    pac auth select --url $EnvironmentUrl
}

# Check who-am-i to verify connection
Write-Host "`nVerifying connection..." -ForegroundColor Yellow
pac org who

# Import solution
Write-Host "`nImporting solution..." -ForegroundColor Yellow
$importParams = @{
    path = $SolutionFile
}

if ($ImportAsHolding) {
    $importParams.Add("import-as-holding", $true)
}

if ($PublishWorkflows) {
    $importParams.Add("publish-workflows", $true)
}

if ($OverwriteUnmanagedCustomizations) {
    $importParams.Add("overwrite-unmanaged-customizations", $true)
}

try {
    pac solution import @importParams
    Write-Host "Solution imported successfully!" -ForegroundColor Green
}
catch {
    Write-Error "Failed to import solution: $_"
    exit 1
}

# Publish all customizations
Write-Host "`nPublishing customizations..." -ForegroundColor Yellow
pac solution publish

# Verify deployment
Write-Host "`nVerifying deployment..." -ForegroundColor Yellow
$solutions = pac solution list
$solutionName = "DOMStyleInjectorExtension"
$deployedSolution = $solutions | Where-Object { $_ -like "*$solutionName*" }

if ($deployedSolution) {
    Write-Host "Solution verified in environment!" -ForegroundColor Green
    Write-Host $deployedSolution -ForegroundColor White
}
else {
    Write-Warning "Could not verify solution deployment. Please check manually in Power Platform Admin Center."
}

# Display post-deployment steps
Write-Host "`nPost-Deployment Steps:" -ForegroundColor Green
Write-Host "1. Verify the cr123_domstylecustomizations table is created" -ForegroundColor White
Write-Host "2. Assign security roles to users:" -ForegroundColor White
Write-Host "   - DOM Style Administrator: For users who need to create/edit customizations" -ForegroundColor White
Write-Host "   - DOM Style User: For users who only need to read customizations" -ForegroundColor White
Write-Host "3. Configure the browser extension with:" -ForegroundColor White
Write-Host "   - Environment URL: $EnvironmentUrl" -ForegroundColor Cyan
Write-Host "   - Table Name: cr123_domstylecustomizations" -ForegroundColor Cyan
Write-Host "4. Test synchronization from the browser extension" -ForegroundColor White

# Create configuration file for browser extension
$configPath = Join-Path $PSScriptRoot "..\docs\dataverse-config.json"
$config = @{
    environmentUrl = $EnvironmentUrl
    tableName = "cr123_domstylecustomizations"
    solutionName = $solutionName
    deploymentDate = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

$config | ConvertTo-Json | Set-Content $configPath
Write-Host "`nConfiguration saved to: $configPath" -ForegroundColor Cyan