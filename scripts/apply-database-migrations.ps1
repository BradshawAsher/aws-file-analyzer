$ErrorActionPreference = 'Stop'

$Azd = Get-Command azd -ErrorAction SilentlyContinue
if (-not $Azd) {
    $AzdPath = Join-Path $env:LOCALAPPDATA 'Programs\Azure Dev CLI\azd.exe'
    if (-not (Test-Path -LiteralPath $AzdPath)) {
        throw "Azure Developer CLI (azd) is not installed or available on PATH."
    }
    $Azd = Get-Item -LiteralPath $AzdPath
}

$AzdPath = if ($Azd.Source) { $Azd.Source } elseif ($Azd.FullName) { $Azd.FullName } else { 'azd' }
& $AzdPath env get-values | ForEach-Object {
    $name, $value = $_.Split('=', 2)
    Set-Item "env:$name" $value.Trim('"')
}

if (-not $env:SQL_SERVER -or -not $env:SQL_DATABASE) {
    throw "SQL_SERVER and SQL_DATABASE are unavailable. Run 'azd provision' first."
}

$connection = "Server=tcp:$($env:SQL_SERVER).database.windows.net,1433;Database=$($env:SQL_DATABASE);Authentication=Active Directory Default;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

dotnet tool update --global dotnet-ef --version 8.*
dotnet ef database update `
    --project .\backend\OpenAiChat.csproj `
    --connection $connection

if ($LASTEXITCODE -ne 0) {
    throw "EF Core migration failed with exit code $LASTEXITCODE."
}

Write-Host "Azure SQL schema is up to date."
