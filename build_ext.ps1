$sourcePath = ".\prompt_hub_extension"
$destinationPath = ".\static\motiverse_extension.zip"

if (Test-Path $destinationPath) {
    Remove-Item $destinationPath -Force
}
Compress-Archive -Path "$sourcePath\*" -DestinationPath $destinationPath -Force
Write-Host "✅ Extension successfully packaged to $destinationPath"
