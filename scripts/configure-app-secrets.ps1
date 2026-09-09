param(
    [string]$Project = ".\backend\OpenAiChat.csproj"
)

$ErrorActionPreference = 'Stop'

if (Test-Path 'C:\Users\s-bas\.aws\norton-web-shield-root.pem') {
    $env:REQUESTS_CA_BUNDLE = 'C:\Users\s-bas\.aws\norton-web-shield-root.pem'
}

$Azd = Get-Command azd -ErrorAction SilentlyContinue
if (-not $Azd) {
    $AzdPath = Join-Path $env:LOCALAPPDATA 'Programs\Azure Dev CLI\azd.exe'
    if (-not (Test-Path -LiteralPath $AzdPath)) {
        throw "Azure Developer CLI (azd) is not installed or available on PATH."
    }
    $Azd = Get-Item -LiteralPath $AzdPath
}

$AzdPath = if ($Azd.Source) { $Azd.Source } elseif ($Azd.FullName) { $Azd.FullName } else { 'azd' }
$values = & $AzdPath env get-values
$environment = @{}
foreach ($line in $values) {
    $name, $value = $line.Split('=', 2)
    $environment[$name] = $value.Trim('"')
}

$vaultName = $environment['AZURE_KEY_VAULT_NAME']
if ([string]::IsNullOrWhiteSpace($vaultName)) {
    throw "AZURE_KEY_VAULT_NAME is unavailable. Run 'azd provision' first."
}

$secretLines = dotnet user-secrets list --project $Project
$localSecrets = @{}
foreach ($line in $secretLines) {
    if ($line -match '^(.+?)\s*=\s*(.*)$') {
        $localSecrets[$matches[1].Trim()] = $matches[2]
    }
}

$secretMap = @{
    'Gemini:ApiKey' = 'gemini-api-key'
    'Jwt:Key' = 'jwt-key'
    'AWS:AccessKey' = 'aws-access-key-id'
    'AWS:SecretKey' = 'aws-secret-access-key'
}

foreach ($entry in $secretMap.GetEnumerator()) {
    $value = $localSecrets[$entry.Key]
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required local user secret '$($entry.Key)' is missing."
    }

    az keyvault secret set `
        --vault-name $vaultName `
        --name $entry.Value `
        --value $value `
        --output none
}

Write-Host "Application secrets were copied to Azure Key Vault without printing their values."

