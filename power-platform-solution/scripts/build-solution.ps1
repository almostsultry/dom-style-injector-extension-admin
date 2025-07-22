# DOM Style Injector Extension - Power Platform Solution Builder
# This script builds a managed solution package for deployment

param(
    [Parameter(Mandatory=$false)]
    [string]$SolutionName = "DOMStyleInjectorExtension",
    
    [Parameter(Mandatory=$false)]
    [string]$Version = "1.0.0.0",
    
    [Parameter(Mandatory=$false)]
    [switch]$Managed = $true,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "../dist"
)

Write-Host "Building DOM Style Injector Extension Solution..." -ForegroundColor Green

# Check if Power Platform CLI is installed
try {
    $pacVersion = pac --version
    Write-Host "Power Platform CLI Version: $pacVersion" -ForegroundColor Cyan
}
catch {
    Write-Error "Power Platform CLI is not installed. Please install it using: npm install -g @microsoft/powerplatform-cli"
    exit 1
}

# Create output directory if it doesn't exist
$outputDir = Join-Path $PSScriptRoot $OutputPath
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

# Navigate to solution directory
$solutionDir = Join-Path $PSScriptRoot ".."
Set-Location $solutionDir

# Initialize solution if not already initialized
if (!(Test-Path ".\$SolutionName.cdsproj")) {
    Write-Host "Initializing solution..." -ForegroundColor Yellow
    pac solution init `
        --publisher-name "domstyleinjector" `
        --publisher-prefix "cr123" `
        --outputDirectory "."
}

# Add components to solution
Write-Host "Adding components to solution..." -ForegroundColor Yellow

# Add entity
if (Test-Path ".\src\Entities\cr123_domstylecustomizations\Entity.xml") {
    pac solution add-reference `
        --path ".\src\Entities\cr123_domstylecustomizations"
}

# Add security roles
$securityRoles = @(
    ".\src\SecurityRoles\cr123_domstyleadmin.xml",
    ".\src\SecurityRoles\cr123_domstyleuser.xml"
)

foreach ($role in $securityRoles) {
    if (Test-Path $role) {
        pac solution add-reference --path $role
    }
}

# Update solution version
Write-Host "Updating solution version to $Version..." -ForegroundColor Yellow
$solutionXml = Get-Content ".\solution.xml"
$solutionXml = $solutionXml -replace '<Version>.*</Version>', "<Version>$Version</Version>"
Set-Content ".\solution.xml" $solutionXml

# Build the solution
Write-Host "Building solution package..." -ForegroundColor Yellow
$solutionType = if ($Managed) { "Managed" } else { "Unmanaged" }
$outputFile = Join-Path $outputDir "$($SolutionName)_$($Version)_$($solutionType).zip"

msbuild /t:build /restore /p:Configuration=Release

# Export solution
Write-Host "Exporting solution..." -ForegroundColor Yellow
pac solution export `
    --path $outputFile `
    --name $SolutionName `
    --managed:$Managed `
    --overwrite

if (Test-Path $outputFile) {
    Write-Host "Solution package created successfully!" -ForegroundColor Green
    Write-Host "Output: $outputFile" -ForegroundColor Cyan
    
    # Display solution contents
    Write-Host "`nSolution Contents:" -ForegroundColor Yellow
    Write-Host "- Entity: cr123_domstylecustomizations" -ForegroundColor White
    Write-Host "- Security Roles: DOM Style Administrator, DOM Style User" -ForegroundColor White
    Write-Host "- Publisher: domstyleinjector (cr123)" -ForegroundColor White
    Write-Host "- Version: $Version" -ForegroundColor White
    Write-Host "- Type: $solutionType" -ForegroundColor White
}
else {
    Write-Error "Failed to create solution package"
    exit 1
}

Write-Host "`nNext Steps:" -ForegroundColor Green
Write-Host "1. Import the solution to your target environment using Power Platform Admin Center" -ForegroundColor White
Write-Host "2. Assign the 'DOM Style Administrator' role to users who need full access" -ForegroundColor White
Write-Host "3. Assign the 'DOM Style User' role to users who need read-only access" -ForegroundColor White
Write-Host "4. Configure the browser extension to connect to your Dataverse environment" -ForegroundColor White